-- =============================================================================
-- Prospect Radar — Phase 10 : synchronisation quotidienne (CRON)
-- =============================================================================
--
-- CURSEUR DE PAGINATION — POURQUOI IL EXISTE
--
-- L'API Recherche d'Entreprises n'offre aucun filtre ni tri par date
-- (constaté et documenté en Phase 3, corrigé côté tri le 22/09/2026) : sans
-- curseur, un passage quotidien relirait indéfiniment la même première page
-- de chaque zone × secteur, sans jamais explorer le reste des résultats
-- disponibles (725 pour la seule Martinique/plomberie, par exemple).
--
-- `prospecting_sync_cursors` retient, par zone × secteur, la PROCHAINE page à
-- lire. Le worker avance ce curseur d'une page à chaque passage réussi, et
-- revient à la page 1 une fois la fin des résultats atteinte — ce qui
-- garantit à la fois une exploration progressive ET un rafraîchissement
-- périodique des entreprises déjà vues (leur statut administratif, leur
-- établissement, peuvent changer).
--
-- CRON — MÊME PATRON QUE `quote-reminder-worker`/`admin-signup-alert-worker`
--
-- Vault pour l'URL et le secret (jamais en dur dans une migration), une
-- fonction `app.trigger_prospecting_worker()` qui les lit et appelle
-- `net.http_post`, un job `pg_cron`. Le corps de la requête porte
-- `{"notify": true}` : c'est ce qui distingue un passage automatisé (qui
-- peut notifier) d'un appel manuel de test (qui ne notifie jamais) — voir
-- `prospecting-worker/handler.ts`.
--
-- 05:00 UTC : validé explicitement par l'utilisateur (§ validation Phase 2,
-- point 7), aucun conflit avec les CRON existants (vérifié : rien de
-- planifié à cette heure précise).
-- =============================================================================

create table public.prospecting_sync_cursors (
  zone_id    uuid not null references public.prospecting_zones (id) on delete cascade,
  sector_id  uuid not null references public.prospecting_sectors (id) on delete cascade,
  next_page  integer not null default 1 check (next_page >= 1),
  updated_at timestamptz not null default now(),
  primary key (zone_id, sector_id)
);

comment on table public.prospecting_sync_cursors is
  'Page suivante à lire pour chaque zone × secteur (Phase 10) — permet d''explorer progressivement les résultats '
  'de l''API plutôt que de relire indéfiniment la même première page. Écrite exclusivement par le worker.';

alter table public.prospecting_sync_cursors enable row level security;
revoke all on table public.prospecting_sync_cursors from public, anon;
grant select on table public.prospecting_sync_cursors to authenticated;
create policy "prospecting_sync_cursors_select_platform" on public.prospecting_sync_cursors
  for select to authenticated using (app.has_platform_permission('prospecting.view'));

grant select, insert, update on table public.prospecting_sync_cursors to service_role;

create trigger prospecting_sync_cursors_set_updated_at
  before update on public.prospecting_sync_cursors
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Déclencheur planifié — Vault, comme les autres workers
-- -----------------------------------------------------------------------------
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/prospecting-worker', 'prospecting_worker_url');
--   select vault.create_secret('<PROSPECTING_WORKER_SECRET>', 'prospecting_worker_secret');
create or replace function app.trigger_prospecting_worker()
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
  from vault.decrypted_secrets where name = 'prospecting_worker_url';
  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'prospecting_worker_secret';

  if v_url is null or v_secret is null then
    raise notice 'Worker de prospection non configuré : renseignez prospecting_worker_url et prospecting_worker_secret dans Vault.';
    return;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-worker-secret', v_secret),
    body    := '{"notify": true}'::jsonb,
    timeout_milliseconds := 55000
  );
end;
$$;

revoke all on function app.trigger_prospecting_worker() from public, anon, authenticated;

select cron.schedule(
  'prospecting-worker-daily',
  '0 5 * * *',
  $$select app.trigger_prospecting_worker()$$
);
