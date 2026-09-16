-- =============================================================================
-- SUITE DE TESTS — Prospect Radar : autorisation plateforme, isolation, RLS
-- =============================================================================
-- Rejoue les garanties posées par `20260917090000_platform_admin_rbac.sql` et
-- `20260917100000_prospecting_schema.sql` :
--
--   l'administrateur reconnu (contact@rezo360.fr) a accès ; AUCUN client
--   REZO360 — même propriétaire de sa propre organisation — n'a le moindre
--   chemin d'accès, à aucune table ; l'opposition force le statut même contre
--   une tentative d'upsert ; l'assignation ne peut viser qu'un administrateur ;
--   la timeline est immuable et ne prend un instantané du score qu'aux
--   transitions qui comptent ; les contraintes d'unicité (priorité de zone,
--   dédoublonnage des coordonnées) tiennent.
--
--   npm run test:sql
--
-- Se termine par `rollback` : aucune donnée ne survit, y compris le prospect
-- et l'organisation de test créés ici.
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

-- -----------------------------------------------------------------------------
-- Fixture : un « client » ordinaire (propriétaire de sa propre organisation),
-- et l'administrateur RÉEL — jamais un UUID recopié à la main.
-- -----------------------------------------------------------------------------
create temporary table t_ids (k text primary key, v uuid);
insert into t_ids (k, v) values ('client_owner', '00000000-0000-4000-8000-0000001a0001');
grant select on t_ids to authenticated;

create function pg_temp.uid(p_key text) returns uuid
language sql stable as $$ select v from pg_temp.t_ids where k = p_key $$;

create function pg_temp.admin_uid() returns uuid
language sql stable as $$ select pg_temp.uid('admin') $$;

create function pg_temp.login(p_key text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.uid(p_key), 'email', p_key || '@test.local', 'role', 'authenticated')::text, true);
end;
$$;

create function pg_temp.login_admin() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.uid('admin'), 'email', 'contact@rezo360.fr', 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', k || '@test.local',
       '$2a$10$testtesttesttesttesttesttesttesttesttesttesttesttestte', now(),
       '{"provider":"email","providers":["email"]}'::jsonb, json_build_object('display_name', k)::jsonb, now(), now()
from pg_temp.t_ids;

-- L'administrateur n'est PAS un compte fabriqué par ce test : c'est le compte
-- réel, résolu par e-mail — jamais un UUID recopié à la main, ici comme dans
-- la migration.
insert into t_ids (k, v) select 'admin', id from auth.users where lower(email) = 'contact@rezo360.fr';

do $$ begin
perform pg_temp.ok(pg_temp.admin_uid() is not null, 'contact@rezo360.fr existe réellement (résolu, jamais codé en dur)');
end $$;

select pg_temp.login('client_owner'); set local role authenticated;
insert into public.organizations (slug, name, created_by) values ('prospect-radar-test', 'Client Ordinaire', pg_temp.uid('client_owner'));
reset role;

do $$ begin raise notice '=== PARTIE 1 — app.is_platform_admin / has_platform_permission ==='; end $$;

select pg_temp.login_admin(); set local role authenticated;
do $$ begin
perform pg_temp.ok(app.is_platform_admin(), 'contact@rezo360.fr est reconnu administrateur plateforme');
perform pg_temp.ok(app.has_platform_permission('prospecting.view'), 'il a prospecting.view');
perform pg_temp.ok(app.has_platform_permission('prospecting.manage'), 'il a prospecting.manage');
perform pg_temp.ok(not app.has_platform_permission('billing.internal_view'), 'il n''a PAS une permission qui n''existe pas');
end $$;
reset role;

select pg_temp.login('client_owner'); set local role authenticated;
do $$ begin
perform pg_temp.ok(not app.is_platform_admin(), 'un client ordinaire, même propriétaire de sa propre organisation, n''est pas administrateur');
perform pg_temp.ok(not app.has_platform_permission('prospecting.view'), 'et n''a prospecting.view sous aucun prétexte');
perform pg_temp.ok(not app.has_platform_permission('prospecting.manage'), 'ni prospecting.manage');
end $$;
reset role;

do $$ begin raise notice '=== PARTIE 2 — isolation totale des clients REZO360 ==='; end $$;

select pg_temp.login('client_owner'); set local role authenticated;

do $$ begin
perform pg_temp.ok((select count(*) from public.prospects) = 0, 'un client ne voit AUCUN prospect (table vide de son point de vue)');
perform pg_temp.ok((select count(*) from public.prospecting_zones) = 0, 'ni les zones de prospection');
perform pg_temp.ok((select count(*) from public.prospecting_sectors) = 0, 'ni les secteurs');
perform pg_temp.ok((select count(*) from public.prospecting_runs) = 0, 'ni l''historique des synchronisations');
perform pg_temp.ok((select count(*) from public.platform_admins) = 0, 'et ne voit pas la liste des administrateurs (même pas sa propre absence)');
end $$;

do $$ begin
perform pg_temp.refuses(
  $sql$ insert into public.prospects (siren, raison_sociale, ape_code) values ('123456789', 'Test', '43.22B') $sql$,
  'un client ne peut pas créer de prospect');
perform pg_temp.refuses(
  $sql$ insert into public.prospecting_zones (code, label, territory, priority) values ('test', 'Test', 'metropole', 99) $sql$,
  'ni une zone de prospection');
end $$;

reset role;

do $$ begin raise notice '=== PARTIE 3 — un administrateur peut détecter, qualifier, assigner ==='; end $$;

-- Le prospect créé par l'administrateur (ci-dessous) doit rester hors de
-- portée d'un client, MAINTENANT qu'une ligne existe réellement à masquer.
-- Assertion posée ici, avant sa création, pour qu'elle porte explicitement
-- sur CETTE ligne précise une fois qu'elle existe (voir fin de la Partie 3).

select pg_temp.login_admin(); set local role authenticated;

insert into public.prospects (siren, raison_sociale, ape_code, created_on, statut_administratif, commune, departement)
values ('123456789', 'Plomberie Test Martinique', '43.22B', current_date - interval '10 days', 'actif', 'Fort-de-France', '972');

do $$ begin
perform pg_temp.ok(
  (select opportunity_score = 0 and score_reasons = '[]'::jsonb from public.prospects where siren = '123456789'),
  'un prospect neuf part à 0, sans raison inventée');
end $$;

do $$ begin
perform pg_temp.ok(
  (select count(*) from public.prospect_activities where siren = '123456789' and event = 'detecte') = 1,
  'la détection écrit une ligne de timeline');
perform pg_temp.ok(
  (select score_snapshot from public.prospect_activities where siren = '123456789' and event = 'detecte') = 0,
  'avec un instantané du score au moment de la détection');
end $$;

do $$ begin
perform pg_temp.refuses(
  format($sql$ update public.prospects set assigned_to = %L where siren = '123456789' $sql$, pg_temp.uid('client_owner')),
  'assigner un prospect à quelqu''un qui n''est PAS administrateur plateforme est refusé');
end $$;

update public.prospects set assigned_to = pg_temp.admin_uid() where siren = '123456789';
do $$ begin
perform pg_temp.ok(
  (select assigned_to from public.prospects where siren = '123456789') = pg_temp.admin_uid(),
  'assigner à un véritable administrateur est accepté');
end $$;

reset role;
select pg_temp.login('client_owner'); set local role authenticated;
do $$ begin
perform pg_temp.ok(
  (select count(*) from public.prospects where siren = '123456789') = 0,
  'un client ne voit toujours pas CE prospect précis, une fois qu''il existe réellement');
end $$;

-- RLS masque la ligne : l'UPDATE ci-dessous n'affecte structurellement AUCUNE
-- ligne (pas d'exception à attendre — c'est le comportement normal d'un
-- UPDATE dont la clause WHERE ne rencontre, du point de vue du client,
-- littéralement aucune ligne). La preuve est que le statut reste inchangé
-- une fois revenu sous l'œil de l'administrateur.
update public.prospects set status = 'converti' where siren = '123456789';
reset role;

select pg_temp.login_admin(); set local role authenticated;
do $$ begin
perform pg_temp.ok(
  (select status <> 'converti' from public.prospects where siren = '123456789'),
  'la tentative du client n''a modifié aucune ligne réelle : RLS l''a rendue invisible, pas seulement en lecture');
end $$;

do $$ begin raise notice '=== PARTIE 4 — timeline : instantané seulement aux transitions qui comptent ==='; end $$;

update public.prospects set status = 'a_relancer' where siren = '123456789';
do $$ begin
perform pg_temp.ok(
  (select count(*) from public.prospect_activities where siren = '123456789' and event = 'a_relancer') = 1,
  'chaque changement de statut est journalisé');
perform pg_temp.ok(
  (select score_snapshot is null from public.prospect_activities where siren = '123456789' and event = 'a_relancer'),
  '« a_relancer » n''est pas un événement commercial majeur : aucun instantané de score');
end $$;

update public.prospects set status = 'contacte' where siren = '123456789';
do $$ begin
perform pg_temp.ok(
  (select score_snapshot is not null from public.prospect_activities where siren = '123456789' and event = 'contacte'),
  '« contacte » EST un événement majeur : le score est figé à cet instant');
end $$;

do $$ begin
perform pg_temp.refuses(
  $sql$ update public.prospect_activities set event = 'triche' where siren = '123456789' $sql$,
  'la timeline est immuable : une modification est refusée, même pour un administrateur');
perform pg_temp.refuses(
  $sql$ delete from public.prospect_activities where siren = '123456789' $sql$,
  'et une suppression aussi');
end $$;

do $$ begin raise notice '=== PARTIE 5 — opposition : plus forte qu''une tentative de réactivation ==='; end $$;

insert into public.prospect_suppressions (siren, reason) values ('123456789', 'Demande explicite de ne plus être contacté');

update public.prospects set status = 'nouveau' where siren = '123456789';
do $$ begin
perform pg_temp.ok(
  (select status = 'ne_plus_contacter' from public.prospects where siren = '123456789'),
  'même une tentative explicite de repasser « nouveau » est forcée vers « ne_plus_contacter »');
end $$;

-- Un « resync » simulé : le worker upserte comme s'il redétectait l'entreprise.
insert into public.prospects (siren, raison_sociale, ape_code)
values ('123456789', 'Plomberie Test Martinique', '43.22B')
on conflict (siren) do update set last_checked_at = now(), status = 'nouveau';
do $$ begin
perform pg_temp.ok(
  (select status = 'ne_plus_contacter' from public.prospects where siren = '123456789'),
  'une resynchronisation ne réactive jamais un prospect en opposition');
end $$;

do $$ begin raise notice '=== PARTIE 6 — contraintes d''intégrité ==='; end $$;

do $$ begin
perform pg_temp.refuses(
  $sql$ insert into public.prospecting_zones (code, label, territory, priority) values ('doublon', 'Doublon', 'outre_mer', 1) $sql$,
  'deux zones ne peuvent pas partager la même priorité (déjà prise par la Martinique)');
end $$;

insert into public.prospect_contacts (siren, contact_type, value, source)
values ('123456789', 'email', 'contact@plomberie-test.fr', 'test');
do $$ begin
perform pg_temp.refuses(
  $sql$ insert into public.prospect_contacts (siren, contact_type, value, source)
        values ('123456789', 'email', 'contact@plomberie-test.fr', 'autre_source') $sql$,
  'la même coordonnée n''est jamais dupliquée pour un même prospect');
end $$;

do $$ begin
perform pg_temp.refuses(
  $sql$ insert into public.prospects (siren, raison_sociale, ape_code) values ('12345', 'SIREN invalide', '43.22B') $sql$,
  'un SIREN qui n''a pas 9 chiffres est refusé');
perform pg_temp.refuses(
  $sql$ insert into public.prospects (siren, raison_sociale, ape_code) values ('987654321', 'NAF invalide', '4322B') $sql$,
  'un code NAF mal formé (sans le point) est refusé');
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
