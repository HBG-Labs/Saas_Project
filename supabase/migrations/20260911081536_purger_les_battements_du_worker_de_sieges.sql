-- =============================================================================
-- Le battement de cœur du worker de sièges entre dans la purge quotidienne
-- =============================================================================
--
-- `subscription_seat_sync_worker_runs` reçoit UNE LIGNE PAR RÉVEIL, y compris
-- quand la file est vide : c'est voulu, c'est ce qui permet de distinguer « le
-- worker tourne et n'a rien à faire » de « le worker ne tourne plus ». Mais
-- `20260909234645_durable_subscription_seat_sync.sql` l'a créée sans durée de
-- conservation, alors que la tâche planifiée se déclenche toutes les 2 minutes :
-- 720 lignes par jour, environ 260 000 par an, qui ne redescendent jamais.
--
-- C'est exactement le défaut que `20260906182132_observabilite_et_garde_plan.sql`
-- avait relevé pour `cron.job_run_details` — la nouvelle table n'a simplement pas
-- été ajoutée à la purge existante. On l'y ajoute ici plutôt que de créer une
-- seconde mécanique : la fonction est déjà appelée chaque jour à 03:20 UTC, il
-- n'y a donc AUCUNE tâche planifiée à créer.
--
-- Trente jours, et non sept comme `cron.job_run_details` : ces lignes portent
-- `synchronized` et `failed`, donc le comportement de la facturation des sièges.
-- Un mois couvre un cycle d'abonnement complet, ce qui permet de répondre après
-- coup à « ce siège a-t-il bien été répercuté sur Stripe ? ». Sept jours ne le
-- permettraient pas, et l'ordre de grandeur reste modeste : ~21 600 lignes.
--
-- La migration d'origine n'est pas retouchée : elle est appliquée, donc immuable
-- (voir `supabase/README.md`). `create or replace` remplaçant le corps entier,
-- les deux purges existantes sont reconduites À L'IDENTIQUE ci-dessous — les
-- omettre les supprimerait en silence.

create or replace function app.purger_journaux_exploitation()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from cron.job_run_details where end_time < now() - interval '7 days';
  delete from public.client_error_events where created_at < now() - interval '90 days';
  delete from public.subscription_seat_sync_worker_runs
   where ran_at < now() - interval '30 days';
end;
$$;

-- `create or replace` conserve les droits existants ; ce revoke est redondant et
-- volontaire : il rend la restriction lisible ici plutôt que dans une autre
-- migration, et reste sans effet si elle est déjà en place.
revoke all on function app.purger_journaux_exploitation() from public, anon, authenticated;

comment on function app.purger_journaux_exploitation() is
  'Purge quotidienne des journaux d''exploitation, battements du worker de sieges compris. Ne touche a aucune donnee metier.';

-- -----------------------------------------------------------------------------
-- Contrôles
-- -----------------------------------------------------------------------------

do $$
begin
  -- La purge doit bien viser les TROIS tables : un `create or replace` qui
  -- aurait perdu une ligne en route ne se verrait autrement qu'au moment où le
  -- journal concerné déborderait, des mois plus tard.
  if pg_catalog.pg_get_functiondef(
       'app.purger_journaux_exploitation()'::pg_catalog.regprocedure
     ) not like '%subscription_seat_sync_worker_runs%' then
    raise exception 'La purge ne couvre pas les battements du worker de sieges.';
  end if;

  if pg_catalog.pg_get_functiondef(
       'app.purger_journaux_exploitation()'::pg_catalog.regprocedure
     ) not like '%client_error_events%' then
    raise exception 'La purge des erreurs client a ete perdue.';
  end if;

  if pg_catalog.pg_get_functiondef(
       'app.purger_journaux_exploitation()'::pg_catalog.regprocedure
     ) not like '%job_run_details%' then
    raise exception 'La purge des executions planifiees a ete perdue.';
  end if;

  -- La tâche quotidienne qui appelle cette fonction doit toujours exister : sans
  -- elle, le corps ci-dessus ne s'exécuterait jamais.
  if not exists (
    select 1 from cron.job
    where jobname = 'purge-journaux-exploitation' and active
  ) then
    raise exception 'La tache quotidienne de purge est absente ou desactivee.';
  end if;
end
$$;
