-- =============================================================================
-- SUITE DE TESTS — Prospect Radar : conversion prospect → client (Phase 9)
-- =============================================================================
-- Rejoue les garanties posées par `20260923090000_prospecting_conversion.sql` :
--
--   la conversion relie le prospect à une VRAIE organisation active, arrête
--   les relances en attente, prend un instantané du score ; une organisation
--   ne peut jamais être liée à deux prospects ; un client REZO360 ordinaire
--   ne peut ni chercher d'organisations à convertir ni convertir quoi que ce
--   soit, même la sienne.
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
grant select on t_ids to authenticated;
create function pg_temp.uid(p_key text) returns uuid
language sql stable as $$ select v from pg_temp.t_ids where k = p_key $$;

-- L'administrateur réel, résolu par e-mail — jamais un UUID recopié.
insert into t_ids (k, v) select 'admin', id from auth.users where lower(email) = 'contact@rezo360.fr';
do $$ begin perform pg_temp.ok(pg_temp.uid('admin') is not null, 'contact@rezo360.fr existe réellement'); end $$;

create function pg_temp.login_admin() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.uid('admin'), 'email', 'contact@rezo360.fr', 'role', 'authenticated')::text, true);
end;
$$;

-- Un « client » ordinaire, propriétaire de sa propre organisation active —
-- exactement le profil qui ne doit jamais pouvoir toucher à la conversion,
-- pas même pour SA PROPRE organisation.
insert into t_ids (k, v) values ('client_owner', '00000000-0000-4000-8000-0000009a0001');
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
insert into public.organizations (slug, name, created_by)
values ('prospect-conversion-test', 'Client Ordinaire Conversion', pg_temp.uid('client_owner'));
reset role;

-- Résolu ICI, en tant que postgres, avant tout changement de rôle : passé ce
-- point, l'administrateur plateforme n'est membre d'AUCUNE organisation et ne
-- verrait pas cette ligne au travers de la RLS de `organizations` — exactement
-- ce que ce module doit garantir, mais qui rendrait `pg_temp.org_id()`
-- inutilisable s'il était résolu plus tard sous le rôle `authenticated`.
insert into t_ids (k, v) select 'org', id from public.organizations where slug = 'prospect-conversion-test';
create function pg_temp.org_id() returns uuid
language sql stable as $$ select pg_temp.uid('org') $$;

do $$ begin raise notice '=== PARTIE 1 — recherche d''organisations réservée à prospecting.manage ==='; end $$;

select pg_temp.login('client_owner'); set local role authenticated;
do $$ begin
perform pg_temp.refuses(
  $sql$ select * from public.prospecting_search_organizations('') $sql$,
  'un client ordinaire ne peut pas chercher d''organisations à convertir');
end $$;
reset role;

do $$ begin raise notice '=== PARTIE 2 — conversion : prospect lié à une vraie organisation active ==='; end $$;

select pg_temp.login_admin(); set local role authenticated;

insert into public.prospects (siren, raison_sociale, ape_code, created_on, statut_administratif, departement)
values ('900000101', 'Convertible SAS', '43.22A', current_date - interval '2 months', 'actif', '972');

insert into public.prospect_followups (siren, due_at, note)
values ('900000101', now() + interval '1 day', 'Relance prévue avant conversion');

do $$
declare
  v_org_id uuid := pg_temp.org_id();
begin
  perform public.convert_prospect_to_client('900000101', v_org_id);

  perform pg_temp.ok(
    (select status = 'converti' and converted_organization_id = v_org_id
     from public.prospects where siren = '900000101'),
    'le prospect est converti et lié à la bonne organisation');

  perform pg_temp.ok(
    (select count(*) from public.prospect_followups where siren = '900000101' and completed_at is null) = 0,
    'les relances en attente sont automatiquement arrêtées');

  perform pg_temp.ok(
    (select score_snapshot is not null from public.prospect_activities
     where siren = '900000101' and event = 'converti'),
    'la conversion prend un instantané du score, comme les autres transitions majeures');
end $$;

do $$ begin raise notice '=== PARTIE 3 — une organisation ne peut jamais être liée à deux prospects ==='; end $$;

insert into public.prospects (siren, raison_sociale, ape_code, statut_administratif)
values ('900000102', 'Second Prospect', '43.22A', 'actif');

do $$
begin
  perform pg_temp.refuses(
    format('select public.convert_prospect_to_client(%L, %L)', '900000102', pg_temp.org_id()),
    'convertir un second prospect vers une organisation déjà liée est refusé');
end $$;

do $$ begin raise notice '=== PARTIE 4 — garde-fous ==='; end $$;

do $$ begin
perform pg_temp.refuses(
  $sql$ select public.convert_prospect_to_client('900000102', gen_random_uuid()) $sql$,
  'convertir vers une organisation inexistante est refusé');
end $$;

reset role;

select pg_temp.login('client_owner'); set local role authenticated;
do $$
begin
  perform pg_temp.refuses(
    format('select public.convert_prospect_to_client(%L, %L)', '900000102', pg_temp.org_id()),
    'un client ordinaire ne peut convertir aucun prospect, même vers sa propre organisation');
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
