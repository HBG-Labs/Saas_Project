-- =============================================================================
-- Relances automatiques des devis, et expiration
-- =============================================================================
--
-- CE QUE ÇA FAIT
--
-- Un devis envoyé au client depuis REZO360 (messagerie du portail) et resté
-- sans réponse est relancé automatiquement, dans le même fil, à J+7 puis
-- J+14 (cadence réglable par entreprise), jamais après sa date de validité.
-- Passée cette date sans réponse, il passe en « Expiré » — statut qui existait
-- dans l'enum depuis le début sans que rien ne le pose jamais.
--
-- OÙ VIT LA DÉCISION
--
-- Ici, en base : le trigger PLANIFIE (une ligne par relance dans
-- `quote_reminders`) au moment où le devis passe à « envoyé », et DÉPLANIFIE
-- dès qu'il en sort. Le worker (`quote-reminder-worker`, toutes les 15 min)
-- n'a plus qu'à expédier ce qui est dû — même patron que les alertes
-- d'inscription et la synchronisation des sièges. Il revérifie tout de même
-- l'état du devis à l'envoi : entre la planification et l'échéance, une
-- semaine a passé.
--
-- POURQUOI `sent_at`
--
-- `quotes` n'avait pas de date d'envoi — seulement `updated_at`, qui bouge à
-- chaque retouche. Une relance se compte à partir de l'envoi, pas de la
-- dernière modification. La colonne reste NULLE pour les devis envoyés avant
-- cette migration : ils ne seront jamais relancés, plutôt que relancés d'un
-- coup pour des envois vieux de semaines dont on ignore la date réelle.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Colonnes
-- -----------------------------------------------------------------------------
alter table public.quotes
  add column sent_at           timestamptz,
  add column reminders_enabled boolean not null default true;

comment on column public.quotes.sent_at is
  'Date du passage à « envoyé », posée par trigger. NULL = envoyé avant les relances automatiques : jamais relancé.';
comment on column public.quotes.reminders_enabled is
  'Désactiver les relances automatiques pour CE devis, sans toucher au réglage de l''entreprise.';

alter table public.organizations
  add column quote_reminder_days integer[] not null default '{7,14}'
    constraint organizations_quote_reminder_days_check check (
      coalesce(array_length(quote_reminder_days, 1), 0) <= 5
      and 0 < all (quote_reminder_days)
      and 365 >= all (quote_reminder_days)
    );

comment on column public.organizations.quote_reminder_days is
  'Jours après l''envoi auxquels relancer un devis sans réponse. Vide = pas de relance. Jamais après valid_until.';

-- -----------------------------------------------------------------------------
-- La file des relances
-- -----------------------------------------------------------------------------
create table public.quote_reminders (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  quote_id        uuid not null references public.quotes (id) on delete cascade,
  -- 1 = première relance, 2 = deuxième… Un devis renvoyé (brouillon → envoyé
  -- une seconde fois) repart à 1 : l'historique des envois précédents reste,
  -- l'unicité ne porte que sur ce qui est EN ATTENTE (index partiel plus bas).
  sequence        integer not null check (sequence >= 1),
  due_at          timestamptz not null,
  status          text not null default 'pending'
                    check (status in ('pending', 'sent', 'skipped', 'failed')),
  -- Le message sortant produit, pour retrouver l'e-mail et son suivi.
  message_id      uuid references public.client_messages (id) on delete set null,
  -- Motif d'un `skipped` ou d'un `failed`, lisible par l'entreprise.
  reason          text,
  attempts        integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at       timestamptz,
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index quote_reminders_pending_sequence_idx
  on public.quote_reminders (quote_id, sequence)
  where status = 'pending';

create index quote_reminders_due_idx
  on public.quote_reminders (due_at, next_attempt_at)
  where status = 'pending';

create index quote_reminders_quote_idx on public.quote_reminders (quote_id);

alter table public.quote_reminders enable row level security;
revoke all on table public.quote_reminders from public, anon;
grant select on table public.quote_reminders to authenticated;
grant select, insert, update on table public.quote_reminders to service_role;

-- L'entreprise VOIT ses relances (prochaine échéance, historique, motif d'un
-- passage) ; elle ne les écrit jamais directement — elle agit sur le devis
-- (`reminders_enabled`, statut), et le trigger replanifie.
create policy "quote_reminders_select" on public.quote_reminders
  for select to authenticated
  using ((select app.has_org_permission(organization_id, 'quote.view')));

create trigger quote_reminders_set_updated_at
  before update on public.quote_reminders
  for each row execute function public.set_updated_at();

comment on table public.quote_reminders is
  'Relances planifiées d''un devis envoyé. Écrite par trigger (planification) et par quote-reminder-worker (envoi). Lecture seule pour l''entreprise.';

-- -----------------------------------------------------------------------------
-- La date d'envoi
-- -----------------------------------------------------------------------------
create or replace function app.stamp_quote_sent_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'sent' and (tg_op = 'INSERT' or old.status is distinct from 'sent') then
    -- Un devis renvoyé (brouillon → envoyé une seconde fois) repart de zéro :
    -- c'est un nouvel envoi, les relances se comptent depuis lui.
    new.sent_at := now();
  end if;
  return new;
end;
$$;

create trigger quotes_stamp_sent_at
  before insert or update of status on public.quotes
  for each row execute function app.stamp_quote_sent_at();

-- -----------------------------------------------------------------------------
-- La planification
-- -----------------------------------------------------------------------------
create or replace function app.plan_quote_reminders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days integer[];
  v_day  integer;
  v_seq  integer := 0;
  v_due  timestamptz;
begin
  if new.status <> 'sent' then
    -- Sorti de « envoyé » : ce qui restait à envoyer est passé, avec le motif,
    -- et reste visible dans l'historique du devis.
    update public.quote_reminders
       set status = 'skipped',
           reason = case new.status
                      when 'accepted' then 'Devis accepté'
                      when 'refused'  then 'Devis refusé'
                      when 'expired'  then 'Devis expiré'
                      else 'Devis repassé en brouillon'
                    end,
           locked_at = null
     where quote_id = new.id and status = 'pending';
    return new;
  end if;

  -- Toujours « envoyé » : tout ce qui n'est pas parti est remis à plat.
  -- Replanifier est plus simple et plus sûr que de raisonner sur ce qui a changé.
  delete from public.quote_reminders
   where quote_id = new.id and status = 'pending';

  if not new.reminders_enabled or new.sent_at is null then
    return new;
  end if;

  select array_agg(d order by d) into v_days
  from public.organizations o, unnest(o.quote_reminder_days) as d
  where o.id = new.organization_id;

  if v_days is null then
    return new;
  end if;

  foreach v_day in array v_days loop
    v_seq := v_seq + 1;
    v_due := new.sent_at + make_interval(days => v_day);
    -- Jamais le jour de l'expiration ni après : relancer un devis expiré est
    -- au mieux inutile, au pire gênant pour le client.
    if new.valid_until is not null and v_due::date >= new.valid_until then
      exit;
    end if;
    insert into public.quote_reminders (organization_id, quote_id, sequence, due_at)
    values (new.organization_id, new.id, v_seq, v_due);
  end loop;

  return new;
end;
$$;

create trigger quotes_plan_reminders
  after insert or update of status, valid_until, reminders_enabled, sent_at on public.quotes
  for each row execute function app.plan_quote_reminders();

comment on function app.plan_quote_reminders() is
  'Replanifie les relances d''un devis à chaque changement de statut, validité ou réglage. Idempotent.';

-- -----------------------------------------------------------------------------
-- L'expiration
-- -----------------------------------------------------------------------------
create or replace function app.expire_overdue_quotes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  -- Le trigger de planification passe les relances restantes en même temps.
  with expired as (
    update public.quotes
       set status = 'expired'
     where status = 'sent'
       and valid_until is not null
       and valid_until < current_date
    returning id
  )
  select count(*) into v_count from expired;
  return v_count;
end;
$$;

revoke all on function app.expire_overdue_quotes() from public, anon, authenticated;

comment on function app.expire_overdue_quotes() is
  'Passe en « expiré » les devis envoyés dont la validité est dépassée sans réponse. Appelée chaque nuit par pg_cron.';

-- 04:15 UTC : après minuit partout en France (métropole comme Antilles), avant
-- l'ouverture des bureaux.
select cron.schedule(
  'quotes-expire-overdue',
  '15 4 * * *',
  $$select app.expire_overdue_quotes()$$
);

-- -----------------------------------------------------------------------------
-- Le tirage atomique du worker
-- -----------------------------------------------------------------------------
create or replace function public.claim_quote_reminders(p_limit integer default 25)
returns table (
  id              uuid,
  organization_id uuid,
  quote_id        uuid,
  sequence        integer,
  attempts        integer,
  -- Message déjà écrit par un essai précédent : la reprise le renvoie, elle
  -- n'en crée pas un second dans le fil.
  message_id      uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select r.id
    from public.quote_reminders r
    where r.status = 'pending'
      and r.due_at <= now()
      and r.next_attempt_at <= now()
      and (r.locked_at is null or r.locked_at < now() - interval '15 minutes')
    order by r.due_at
    for update skip locked
    limit least(greatest(coalesce(p_limit, 25), 1), 100)
  ), claimed as (
    update public.quote_reminders r
       set locked_at = now()
      from candidates c
     where r.id = c.id
    returning r.id, r.organization_id, r.quote_id, r.sequence, r.attempts, r.message_id
  )
  select c.id, c.organization_id, c.quote_id, c.sequence, c.attempts, c.message_id from claimed c;
end;
$$;

revoke all on function public.claim_quote_reminders(integer) from public, anon, authenticated;
grant execute on function public.claim_quote_reminders(integer) to service_role;

-- -----------------------------------------------------------------------------
-- Le déclencheur planifié — Vault, comme les autres workers
-- -----------------------------------------------------------------------------
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/quote-reminder-worker', 'quote_reminder_worker_url');
--   select vault.create_secret('<QUOTE_REMINDER_WORKER_SECRET>', 'quote_reminder_worker_secret');
create or replace function app.trigger_quote_reminder_worker()
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
  from vault.decrypted_secrets where name = 'quote_reminder_worker_url';
  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'quote_reminder_worker_secret';

  if v_url is null or v_secret is null then
    raise notice 'Worker de relances non configuré : renseignez quote_reminder_worker_url et quote_reminder_worker_secret dans Vault.';
    return;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-worker-secret', v_secret),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
end;
$$;

revoke all on function app.trigger_quote_reminder_worker() from public, anon, authenticated;

-- Un quart d'heure : une relance à J+7 n'est pas à la minute près, et chaque
-- passage sans rien à faire coûte une requête vide.
select cron.schedule(
  'quote-reminder-worker',
  '*/15 * * * *',
  $$select app.trigger_quote_reminder_worker()$$
);
