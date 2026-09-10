-- =============================================================================
-- Synchronisation durable des sièges Stripe
-- =============================================================================
--
-- Un changement d'effectif est un fait PostgreSQL. Il ne doit pas dépendre de
-- la présence du navigateur qui l'a provoqué : la base crée donc une tâche
-- idempotente, puis un worker court la traite hors transaction.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table public.subscription_seat_sync_jobs (
  organization_id    uuid primary key
    references public.organizations (id) on delete cascade,
  desired_extra_seats integer not null check (desired_extra_seats >= 0),
  attempts            integer not null default 0 check (attempts >= 0),
  next_attempt_at     timestamptz not null default now(),
  locked_at           timestamptz,
  last_error          text,
  revision            uuid not null default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index subscription_seat_sync_jobs_due_idx
  on public.subscription_seat_sync_jobs (next_attempt_at, created_at);

comment on table public.subscription_seat_sync_jobs is
  'File serveur des effectifs a repercuter sur Stripe. Une ligne par organisation ; jamais exposee au navigateur.';

alter table public.subscription_seat_sync_jobs enable row level security;
revoke all on table public.subscription_seat_sync_jobs from public, anon, authenticated;
grant select, insert, update, delete on table public.subscription_seat_sync_jobs to service_role;

-- Un événement plus récent remplace l'intention précédente. La révision
-- empêche un worker parti avec l'ancienne quantité de supprimer la nouvelle.
create or replace function app.enqueue_subscription_seat_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
begin
  v_organization_id := case when tg_op = 'DELETE'
    then old.organization_id
    else new.organization_id
  end;

  insert into public.subscription_seat_sync_jobs (
    organization_id,
    desired_extra_seats
  ) values (
    v_organization_id,
    app.org_extra_seats(v_organization_id)
  )
  on conflict (organization_id) do update set
    desired_extra_seats = excluded.desired_extra_seats,
    attempts            = 0,
    next_attempt_at     = now(),
    locked_at           = null,
    last_error          = null,
    revision            = gen_random_uuid(),
    updated_at          = now();

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function app.enqueue_subscription_seat_sync() from public, anon, authenticated;

create trigger organization_members_enqueue_seat_sync_insert_delete
  after insert or delete on public.organization_members
  for each row execute function app.enqueue_subscription_seat_sync();

create trigger organization_members_enqueue_seat_sync_status
  after update of status on public.organization_members
  for each row execute function app.enqueue_subscription_seat_sync();

-- Les abonnements Stripe déjà présents entrent une fois dans la file lors du
-- déploiement, afin de réparer un éventuel écart historique.
insert into public.subscription_seat_sync_jobs (organization_id, desired_extra_seats)
select distinct
  s.organization_id,
  app.org_extra_seats(s.organization_id)
from public.subscriptions s
where s.organization_id is not null
  and s.provider_subscription_id is not null
on conflict (organization_id) do update set
  desired_extra_seats = excluded.desired_extra_seats,
  attempts            = 0,
  next_attempt_at     = now(),
  locked_at           = null,
  last_error          = null,
  revision            = gen_random_uuid(),
  updated_at          = now();

-- Réservation atomique : deux exécutions concurrentes ne traitent jamais la
-- même révision. Le verrou SQL ne dure que le temps de cette requête ; aucun
-- appel réseau n'a lieu dans une transaction PostgreSQL.
create or replace function public.claim_subscription_seat_sync_jobs(p_limit integer default 25)
returns table (
  organization_id     uuid,
  desired_extra_seats integer,
  attempts            integer,
  revision            uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select j.organization_id
    from public.subscription_seat_sync_jobs j
    where j.next_attempt_at <= now()
      and (j.locked_at is null or j.locked_at < now() - interval '5 minutes')
    order by j.next_attempt_at, j.created_at
    for update skip locked
    limit least(greatest(coalesce(p_limit, 25), 1), 100)
  ), claimed as (
    update public.subscription_seat_sync_jobs j
       set locked_at = now(),
           updated_at = now()
      from candidates c
     where j.organization_id = c.organization_id
    returning j.organization_id, j.desired_extra_seats, j.attempts, j.revision
  )
  select c.organization_id, c.desired_extra_seats, c.attempts, c.revision
  from claimed c;
end;
$$;

revoke all on function public.claim_subscription_seat_sync_jobs(integer)
  from public, anon, authenticated;
grant execute on function public.claim_subscription_seat_sync_jobs(integer) to service_role;

create table public.subscription_seat_sync_worker_runs (
  id          bigint generated always as identity primary key,
  ran_at      timestamptz not null default now(),
  attempted   integer not null default 0 check (attempted >= 0),
  synchronized integer not null default 0 check (synchronized >= 0),
  failed      integer not null default 0 check (failed >= 0),
  duration_ms integer not null default 0 check (duration_ms >= 0)
);

create index subscription_seat_sync_worker_runs_recent_idx
  on public.subscription_seat_sync_worker_runs (ran_at desc);

alter table public.subscription_seat_sync_worker_runs enable row level security;
revoke all on table public.subscription_seat_sync_worker_runs from public, anon, authenticated;
grant select, insert on table public.subscription_seat_sync_worker_runs to service_role;
grant usage, select on sequence public.subscription_seat_sync_worker_runs_id_seq to service_role;

-- Configuration hors dépôt :
--   select vault.create_secret(
--     'https://<ref>.supabase.co/functions/v1/subscription-seat-sync-worker',
--     'subscription_seat_sync_worker_url'
--   );
--   select vault.create_secret('<secret>', 'subscription_seat_sync_worker_secret');
create or replace function app.trigger_subscription_seat_sync_worker()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'subscription_seat_sync_worker_url';

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'subscription_seat_sync_worker_secret';

  if v_url is null or v_secret is null then
    raise notice 'Worker de sièges non configure : renseignez son URL et son secret dans Vault.';
    return;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-secret', v_secret
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
end;
$$;

revoke all on function app.trigger_subscription_seat_sync_worker()
  from public, anon, authenticated;

select cron.schedule(
  'subscription-seat-sync-worker',
  '*/2 * * * *',
  $$select app.trigger_subscription_seat_sync_worker()$$
);

do $$
begin
  if not exists (
    select 1 from cron.job
    where jobname = 'subscription-seat-sync-worker' and active
  ) then
    raise exception 'La tâche planifiée de synchronisation des sièges n''a pas été créée.';
  end if;
end
$$;
