-- =============================================================================
-- SUITE DE TESTS — Prospect Radar : analytics (Phase 12)
-- =============================================================================
-- Rejoue les garanties posées par `20260925090000_prospecting_analytics.sql` :
--
--   un client REZO360 ordinaire ne peut pas appeler la RPC ; le funnel
--   compte une entreprise « atteinte » même si elle est ensuite refusée
--   (lecture de cohorte, pas d'instantané) ; les taux se calculent sur le
--   nombre de détections, jamais une division par zéro ; le filtre de
--   période porte sur la date de DÉTECTION.
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

create temporary table t_ids (k text primary key, v uuid);
grant select, insert on t_ids to authenticated;
create function pg_temp.uid(p_key text) returns uuid
language sql stable as $$ select v from pg_temp.t_ids where k = p_key $$;

insert into t_ids (k, v) select 'admin', id from auth.users where lower(email) = 'contact@rezo360.fr';
do $$ begin perform pg_temp.ok(pg_temp.uid('admin') is not null, 'contact@rezo360.fr existe réellement'); end $$;

create function pg_temp.login_admin() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.uid('admin'), 'email', 'contact@rezo360.fr', 'role', 'authenticated')::text, true);
end;
$$;

insert into t_ids (k, v) values ('client_owner', '00000000-0000-4000-8000-0000020a0001');
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', k || '@test.local',
       '$2a$10$testtesttesttesttesttesttesttesttesttesttesttesttestte', now(),
       '{"provider":"email","providers":["email"]}'::jsonb, json_build_object('display_name', k)::jsonb, now(), now()
from t_ids where k = 'client_owner';

create function pg_temp.login(p_key text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.uid(p_key), 'email', p_key || '@test.local', 'role', 'authenticated')::text, true);
end;
$$;

do $$ begin raise notice '=== PARTIE 1 — réservée à prospecting.view ==='; end $$;

select pg_temp.login('client_owner'); set local role authenticated;
do $$ begin
perform pg_temp.refuses(
  $sql$ select public.prospecting_analytics(null, null) $sql$,
  'un client ordinaire ne peut pas appeler les analytics');
end $$;
reset role;

do $$ begin raise notice '=== PARTIE 2 — funnel de cohorte, taux, filtre par date de détection ==='; end $$;

select pg_temp.login_admin(); set local role authenticated;

-- Trois prospects détectés le même jour : un converti (en étant passé par
-- toutes les étapes), un refusé APRÈS avoir été qualifié (doit quand même
-- compter comme « qualifié » dans le funnel — lecture de cohorte), un
-- resté nouveau. Score initial haut pour forcer un score_snapshot non nul.
insert into public.prospecting_zones (code, label, department_code, territory, priority, active)
values ('analytics_test_zone', 'Zone Analytics Test', '972', 'outre_mer', 91, true);

insert into public.prospects (siren, raison_sociale, ape_code, created_on, statut_administratif, departement, zone_id)
select '900000201', 'Convertible Analytics', '43.22A', current_date - interval '2 months', 'actif', '972',
       (select id from public.prospecting_zones where code = 'analytics_test_zone');
insert into public.prospects (siren, raison_sociale, ape_code, created_on, statut_administratif, departement, zone_id)
select '900000202', 'Qualifie Puis Refuse', '43.22A', current_date - interval '2 months', 'actif', '972',
       (select id from public.prospecting_zones where code = 'analytics_test_zone');
insert into public.prospects (siren, raison_sociale, ape_code, created_on, statut_administratif, departement, zone_id)
select '900000203', 'Reste Nouveau', '43.22A', current_date - interval '2 months', 'actif', '972',
       (select id from public.prospecting_zones where code = 'analytics_test_zone');

update public.prospects set status = 'a_qualifier' where siren = '900000201';
update public.prospects set status = 'contacte' where siren = '900000201';
update public.prospects set status = 'interesse' where siren = '900000201';
update public.prospects set status = 'essai' where siren = '900000201';

reset role;
select pg_temp.login('client_owner'); set local role authenticated;
insert into public.organizations (slug, name, created_by)
values ('analytics-test-org', 'Analytics Test Org', pg_temp.uid('client_owner'));
-- Résolu ICI, sous le rôle qui peut encore voir cette organisation (son
-- créateur) — un administrateur plateforme n'est membre d'AUCUNE
-- organisation cliente et ne la verrait pas via un SELECT direct ensuite
-- (même piège déjà rencontré et corrigé en Phase 9, voir mémoire du projet).
insert into t_ids (k, v) select 'org', id from public.organizations where slug = 'analytics-test-org';
reset role;

select pg_temp.login_admin(); set local role authenticated;
do $$ begin
perform public.convert_prospect_to_client('900000201', pg_temp.uid('org'));
end $$;

update public.prospects set status = 'a_qualifier' where siren = '900000202';
update public.prospects set status = 'refuse' where siren = '900000202';
-- '900000203' reste à 'nouveau', jamais touché.

do $$
declare
  v_stats jsonb;
begin
  v_stats := public.prospecting_analytics((current_date - interval '1 day')::date, (current_date + interval '1 day')::date);

  perform pg_temp.ok((v_stats->'funnel'->>'detected')::int >= 3, 'au moins les 3 prospects de test sont détectés dans la période');
  perform pg_temp.ok((v_stats->'funnel'->>'qualified')::int >= 2, '« qualifié » compte le converti ET le refusé (cohorte, pas instantané)');
  perform pg_temp.ok((v_stats->'funnel'->>'converted')::int >= 1, 'au moins un converti');

  -- Le refusé reste QUALIFIÉ dans le funnel même si son statut ACTUEL est
  -- « refuse » : c'est exactement la garantie de lecture par cohorte.
  perform pg_temp.ok(
    exists (
      select 1 from public.prospect_activities
      where siren = '900000202' and event = 'a_qualifier'
    ),
    'la timeline garde la trace du passage par « qualifié », même après un refus ultérieur'
  );
end $$;

do $$
declare
  v_stats jsonb;
begin
  -- Fenêtre qui exclut totalement la date de détection : funnel à zéro,
  -- jamais une division par zéro qui ferait échouer l'appel.
  v_stats := public.prospecting_analytics((current_date - interval '10 years')::date, (current_date - interval '9 years')::date);
  perform pg_temp.ok((v_stats->'funnel'->>'detected')::int = 0, 'aucune détection hors de la période demandée');
  perform pg_temp.ok((v_stats->'rates'->>'conversion')::numeric = 0, 'taux à 0, jamais une erreur de division par zéro');
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
