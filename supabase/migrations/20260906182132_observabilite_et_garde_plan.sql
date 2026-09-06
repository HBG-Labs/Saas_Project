-- =============================================================================
-- Trois points releves par l'audit, et la purge des journaux d'exploitation
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. La formule ne s'ecrit pas depuis le navigateur
-- -----------------------------------------------------------------------------
--
-- `organizations.plan_code` etait modifiable par tout detenteur de
-- `organization.update`. La colonne ne pilote plus rien : les droits derivent
-- de `subscriptions`, ou seul le webhook Stripe ecrit. Elle n'en reste pas
-- moins un piege — le jour ou quelqu'un la relit en croyant qu'elle fait foi,
-- l'auto-attribution d'une formule payante devient reelle.
--
-- Verifie avant retrait : aucun code applicatif n'ecrit cette colonne. Le seul
-- `plan_code` ecrit par l'application vise `subscriptions`, en role serveur.

revoke update (plan_code) on public.organizations from authenticated;

-- -----------------------------------------------------------------------------
-- 2. La telemetrie ne doit pas pouvoir noyer la base
-- -----------------------------------------------------------------------------
--
-- `client_error_events` accepte jusqu'a douze kilo-octets par ligne, sans
-- plafond ni purge. Une boucle de rendu cote client suffirait a la remplir.
--
-- Le depassement n'echoue PAS : un trigger `before insert` qui renvoie `null`
-- abandonne la ligne en silence. Faire remonter une erreur n'aiderait
-- personne — le client ignore deja les echecs de telemetrie — et ajouterait du
-- bruit a une situation qui en produit deja trop.

create or replace function app.limiter_client_error_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recents integer;
begin
  select count(*) into v_recents
  from public.client_error_events e
  where e.user_id = new.user_id
    and e.created_at > now() - interval '1 minute';

  -- Trente par minute laisse passer une rafale legitime — une page qui casse
  -- en signale plusieurs — tout en bornant une boucle.
  if v_recents >= 30 then
    return null;
  end if;
  return new;
end;
$$;

create trigger client_error_events_limite
  before insert on public.client_error_events
  for each row execute function app.limiter_client_error_events();

revoke all on function app.limiter_client_error_events() from public, anon, authenticated;

comment on function app.limiter_client_error_events() is
  'Abandonne silencieusement les signalements au-dela de trente par minute et par utilisateur.';

-- -----------------------------------------------------------------------------
-- 3. Purge des journaux d'exploitation
-- -----------------------------------------------------------------------------
--
-- Deux journaux grossissent sans que personne ne les vide :
--
--   `cron.job_run_details` gagne 96 lignes par jour, une par reveil de
--   l'ordonnanceur. pg_cron ne les supprime jamais, pas meme quand la tache
--   est desactivee.
--
--   `client_error_events` n'a pas de duree de conservation, alors que la
--   politique de confidentialite en annonce une de douze mois pour le journal
--   d'activite. Quatre-vingt-dix jours suffisent a diagnostiquer une panne.

create or replace function app.purger_journaux_exploitation()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from cron.job_run_details where end_time < now() - interval '7 days';
  delete from public.client_error_events where created_at < now() - interval '90 days';
end;
$$;

revoke all on function app.purger_journaux_exploitation() from public, anon, authenticated;

comment on function app.purger_journaux_exploitation() is
  'Purge quotidienne des journaux d''exploitation. Ne touche a aucune donnee metier.';

-- 03:20 UTC : hors des heures ouvrees francaises, et decale des heures rondes
-- ou se bousculent les taches planifiees.
select cron.schedule(
  'purge-journaux-exploitation',
  '20 3 * * *',
  $$select app.purger_journaux_exploitation()$$
);

-- -----------------------------------------------------------------------------
-- Controles
-- -----------------------------------------------------------------------------

do $$
begin
  if has_column_privilege('authenticated', 'public.organizations', 'plan_code', 'UPDATE') then
    raise exception 'La formule doit rester inscriptible uniquement par le role serveur.';
  end if;

  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
    where c.relname = 'client_error_events' and t.tgname = 'client_error_events_limite'
  ) then
    raise exception 'Le plafond de telemetrie n''est pas installe.';
  end if;

  if not exists (
    select 1 from cron.job where jobname = 'purge-journaux-exploitation' and active
  ) then
    raise exception 'La purge des journaux n''a pas ete planifiee.';
  end if;
end
$$;
