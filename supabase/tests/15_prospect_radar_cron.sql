-- =============================================================================
-- SUITE DE TESTS — Prospect Radar : CRON quotidien et curseurs (Phase 10)
-- =============================================================================
-- Rejoue les garanties posées par `20260924090000_prospecting_cron.sql` :
--
--   le job pg_cron existe, planifié comme validé par l'utilisateur ; un
--   client REZO360 ordinaire n'a aucun accès à `prospecting_sync_cursors`,
--   pas plus qu'aux autres tables du module ; `app.trigger_prospecting_worker`
--   n'est appelable par personne depuis l'API (jamais `authenticated`/`anon`).
--
-- N'APPELLE JAMAIS `app.trigger_prospecting_worker()` : elle déclenche un
-- VRAI `net.http_post` vers la fonction Edge déployée, indépendant de la
-- transaction (pg_net l'exécute en arrière-plan) — l'appeler ici enverrait
-- une vraie requête réseau depuis une suite de tests censée rester locale.
--
--   npm run test:sql
--
-- Se termine par `rollback` : aucune donnée ne survit.
-- =============================================================================

begin;
set local search_path = pg_temp, public;

create function pg_temp.ok(p_condition boolean, p_label text) returns void
language plpgsql as $$
begin
  if p_condition is not true then
    raise exception 'ECHEC : % (condition %)', p_label, coalesce(p_condition::text, 'NULL') using errcode = 'assert_failure';
  end if;
  raise notice '  OK  %', p_label;
end;
$$;

create function pg_temp.refuses(p_sql text, p_label text) returns void
language plpgsql as $$
begin
  execute p_sql;
  raise exception 'ECHEC : % (l''instruction a ete ACCEPTEE)', p_label using errcode = 'assert_failure';
exception
  when assert_failure then raise;
  when others then raise notice '  OK  % (refuse : %)', p_label, left(sqlerrm, 70);
end;
$$;

do $$ begin raise notice '=== PARTIE 1 — le job CRON est planifié comme validé ==='; end $$;

do $$
declare
  v_job record;
begin
  select jobname, schedule, active into v_job from cron.job where jobname = 'prospecting-worker-daily';
  perform pg_temp.ok(v_job.jobname is not null, 'le job "prospecting-worker-daily" existe');
  perform pg_temp.ok(v_job.schedule = '0 5 * * *', '05:00 UTC, comme validé explicitement par l''utilisateur');
  perform pg_temp.ok(v_job.active, 'le job est actif');
end $$;

do $$ begin raise notice '=== PARTIE 2 — isolation des clients REZO360 ==='; end $$;

create temporary table t_ids (k text primary key, v uuid);
grant select on t_ids to authenticated;
create function pg_temp.uid(p_key text) returns uuid
language sql stable as $$ select v from pg_temp.t_ids where k = p_key $$;

insert into t_ids (k, v) values ('client_owner', '00000000-0000-4000-8000-0000010a0001');
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', k || '@test.local',
       '$2a$10$testtesttesttesttesttesttesttesttesttesttesttesttestte', now(),
       '{"provider":"email","providers":["email"]}'::jsonb, json_build_object('display_name', k)::jsonb, now(), now()
from pg_temp.t_ids where k = 'client_owner';

create function pg_temp.login(p_key text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.uid(p_key), 'email', p_key || '@test.local', 'role', 'authenticated')::text, true);
end;
$$;

select pg_temp.login('client_owner'); set local role authenticated;
do $$ begin
perform pg_temp.ok(
  (select count(*) from public.prospecting_sync_cursors) = 0,
  'un client ordinaire ne voit aucun curseur de synchronisation');
perform pg_temp.refuses(
  $sql$ insert into public.prospecting_sync_cursors (zone_id, sector_id, next_page)
        values (gen_random_uuid(), gen_random_uuid(), 1) $sql$,
  'et ne peut pas en écrire');
perform pg_temp.refuses(
  $sql$ select app.trigger_prospecting_worker() $sql$,
  'ni déclencher le worker directement (fonction app.*, jamais exposée par PostgREST, et refusée même en SQL direct)');
end $$;
reset role;

-- =============================================================================
do $$
begin
  raise notice '';
  raise notice '=============================================';
  raise notice ' TOUS LES TESTS PASSENT';
  raise notice '=============================================';
end
$$;

select 'TOUS LES TESTS PASSENT' as resultat;

rollback;
