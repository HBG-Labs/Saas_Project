-- =============================================================================
-- Ordonnancement des transmissions SUPER PDP
-- =============================================================================
--
-- `invoice_transmissions` portait depuis l'origine `next_attempt_at` et un
-- index de reprise que rien n'exploitait. Cette migration installe ce qui
-- manquait pour que le cycle de vie avance sans intervention humaine : le
-- journal des executions, et la tache qui reveille la fonction Edge.
--
-- CE QUI N'EST PAS AUTOMATISE : le premier depot. Une transmission `queued`
-- n'a pas d'echeance, l'ordonnanceur ne la voit donc pas. Une facture ne part
-- jamais sur le reseau reglementaire sans geste humain.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- -----------------------------------------------------------------------------
-- Battement de coeur
-- -----------------------------------------------------------------------------
--
-- Sans lui, un ordonnanceur muet est indiscernable d'un ordonnanceur qui n'a
-- rien a faire. C'est le mode de panne le plus vicieux : tout parait calme.

create table public.einvoicing_worker_runs (
  id            bigint generated always as identity primary key,
  ran_at        timestamptz not null default now(),
  organizations integer not null default 0 check (organizations >= 0),
  synchronized  integer not null default 0 check (synchronized >= 0),
  retried       integer not null default 0 check (retried >= 0),
  failures      integer not null default 0 check (failures >= 0),
  duration_ms   integer not null default 0 check (duration_ms >= 0)
);

create index einvoicing_worker_runs_recent_idx
  on public.einvoicing_worker_runs (ran_at desc);

comment on table public.einvoicing_worker_runs is
  'Journal des executions de l''ordonnanceur de transmission. Ecrit par le role serveur, jamais lisible par le navigateur.';

alter table public.einvoicing_worker_runs enable row level security;

-- Aucune policy : la table est volontairement fermee au client, comme
-- `stripe_events`. Elle n'interesse que l'exploitation, et son contenu ne
-- concerne aucune organisation en particulier.
revoke all on table public.einvoicing_worker_runs from public, anon, authenticated;
grant select, insert on table public.einvoicing_worker_runs to service_role;

-- -----------------------------------------------------------------------------
-- Declencheur
-- -----------------------------------------------------------------------------
--
-- L'URL et le secret vivent dans Vault, PAS dans ce fichier : une migration est
-- versionnee, un secret ne doit jamais l'etre. Tant que les deux ne sont pas
-- renseignes, la fonction ne fait rien et le dit. C'est volontaire : une tache
-- planifiee qui echoue toutes les quinze minutes contre une URL absente est
-- une nuisance, pas une alerte.
--
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/superpdp-worker',
--                              'superpdp_worker_url');
--   select vault.create_secret('<secret partage>', 'superpdp_worker_secret');

create or replace function app.declencher_ordonnanceur_transmission()
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
  from vault.decrypted_secrets where name = 'superpdp_worker_url';

  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'superpdp_worker_secret';

  if v_url is null or v_secret is null then
    raise notice 'Ordonnanceur non configure : renseignez superpdp_worker_url et superpdp_worker_secret dans Vault.';
    return;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',    'application/json',
      'x-worker-secret', v_secret
    ),
    body    := '{}'::jsonb,
    -- Sous le budget interne de la fonction, qui s'arrete a 50 s.
    timeout_milliseconds := 55000
  );
end;
$$;

revoke all on function app.declencher_ordonnanceur_transmission() from public, anon, authenticated;

comment on function app.declencher_ordonnanceur_transmission() is
  'Reveille la fonction Edge superpdp-worker. Sans secret Vault configure, ne fait rien.';

-- -----------------------------------------------------------------------------
-- Tache planifiee
-- -----------------------------------------------------------------------------
--
-- Toutes les quinze minutes. Un statut de plateforme n'evolue pas a la seconde,
-- et 96 reveils par jour restent negligeables.

select cron.schedule(
  'superpdp-transmission-scheduler',
  '*/15 * * * *',
  $$select app.declencher_ordonnanceur_transmission()$$
);

-- Controle : la tache doit exister et etre active.
do $$
begin
  if not exists (
    select 1 from cron.job
    where jobname = 'superpdp-transmission-scheduler' and active
  ) then
    raise exception 'La tache planifiee de transmission n''a pas ete creee.';
  end if;
end
$$;
