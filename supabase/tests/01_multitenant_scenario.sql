-- =============================================================================
-- SUITE DE TESTS — scénario multi-tenant du §18
-- =============================================================================
-- Rejoue de bout en bout le parcours demandé :
--
--   Entreprise A → équipe → 3 techniciens → mission fibre → affectation
--                → acceptation → intervention → compte rendu → contrôle → validation
--
-- puis vérifie que l'Entreprise B n'accède à AUCUNE donnée de l'Entreprise A.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- COMMENT L'EXÉCUTER
--
--   1. Appliquer d'abord TOUTES les migrations de `supabase/migrations/`.
--   2. Coller ce fichier ENTIER dans le SQL Editor du dashboard Supabase.
--   3. Exécuter, puis lire l'onglet des messages (NOTICE).
--
-- Le script se termine par `rollback` : il ne laisse AUCUNE donnée derrière lui.
-- En cas d'échec, il s'interrompt sur une exception nommant le test fautif.
--
-- Succès = la dernière notice affiche « TOUS LES TESTS PASSENT ».
--
-- Aucune méta-commande psql (`\echo`) n'est utilisée : le SQL Editor de
-- Supabase n'est pas psql et les rejetterait.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- POURQUOI DU SQL ET NON DES TESTS TYPESCRIPT
-- Ce qui est vérifié ici — RLS, triggers, séparation des pouvoirs — s'exécute
-- DANS PostgreSQL. Un test passant par le client JS mesurerait surtout la bonne
-- foi du client. Ici on endosse l'identité d'un utilisateur au niveau de la
-- session (`set local role` + `request.jwt.claims`), exactement comme le fait
-- PostgREST, et on constate ce que la base accorde ou refuse.
-- =============================================================================

begin;

-- `pg_temp` explicitement en tête : les fonctions utilitaires et la table
-- d'identités y vivent, et les fonctions SECURITY DEFINER des migrations
-- imposent leur propre search_path.
set local search_path = pg_temp, public;

-- -----------------------------------------------------------------------------
-- Identités de test
-- -----------------------------------------------------------------------------
create temporary table t_ids (k text primary key, v uuid);

insert into t_ids (k, v) values
  ('a_owner',   '00000000-0000-4000-8000-00000000a001'),
  ('a_manager', '00000000-0000-4000-8000-00000000a002'),
  ('a_tech1',   '00000000-0000-4000-8000-00000000a003'),
  ('a_tech2',   '00000000-0000-4000-8000-00000000a004'),
  ('a_tech3',   '00000000-0000-4000-8000-00000000a005'),
  ('b_owner',   '00000000-0000-4000-8000-00000000b001'),
  ('b_tech',    '00000000-0000-4000-8000-00000000b002');

-- Le scénario bascule en rôle `authenticated` pour rejouer les policies telles
-- que PostgREST les évalue. Ce rôle doit donc pouvoir lire la table d'identités,
-- faute de quoi `pg_temp.uid()` échoue en 42501 et tout le scénario s'arrête.
--
-- Superflu dans le SQL Editor, qui exécute l'ensemble sous `postgres`. Requis
-- dès que l'exécution passe par un rôle de connexion restreint — c'est le cas
-- de `supabase db query`, qui provisionne un rôle dédié.
grant select on t_ids to authenticated;

create function pg_temp.uid(p_key text) returns uuid
language sql stable as $$ select v from pg_temp.t_ids where k = p_key $$;

-- Bascule d'identité : reproduit ce que PostgREST installe pour un utilisateur
-- authentifié. `auth.uid()` lit `request.jwt.claims`.
create function pg_temp.login(p_key text) returns void
language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', pg_temp.uid(p_key),
      'email', p_key || '@test.local',
      'role', 'authenticated'
    )::text,
    true
  );
end;
$$;

create function pg_temp.ok(p_condition boolean, p_label text) returns void
language plpgsql as $$
begin
  -- `is not true` et non `not p_condition` : en SQL, `not null` vaut `null`, et
  -- un `if null then` ne s'exécute pas. La version précédente laissait donc
  -- PASSER en silence toute assertion dont l'expression valait NULL — le cas le
  -- plus courant étant une sous-requête qui ne ramène aucune ligne.
  --
  -- Trouvé en écrivant la suite 04 : `app.org_plan_code()` renvoyait NULL pour
  -- une organisation sans abonnement, `NULL = 'free'` valait NULL, et le test
  -- affichait « OK » sur une comparaison qui n'avait jamais été vraie.
  if p_condition is not true then
    raise exception 'ECHEC : % (condition %)', p_label,
      coalesce(p_condition::text, 'NULL')
      using errcode = 'assert_failure';
  end if;
  raise notice '  OK  %', p_label;
end;
$$;

-- -----------------------------------------------------------------------------
-- Comptes utilisateurs
-- -----------------------------------------------------------------------------
-- `encrypted_password` reçoit une valeur factice : aucun test ne s'authentifie
-- réellement, et dépendre de `pgcrypto` (installé dans le schéma `extensions`
-- sur Supabase) rendrait ce script sensible au search_path.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated',
  k || '@test.local', '$2a$10$testtesttesttesttesttesttesttesttesttesttesttesttestte',
  now(), '{"provider":"email","providers":["email"]}'::jsonb,
  json_build_object('display_name', k)::jsonb, now(), now()
from pg_temp.t_ids;

do $$ begin raise notice '=== PARTIE 1 — Parcours nominal Entreprise A ==='; end $$;

-- =============================================================================
-- 1.1 — Création de l'organisation par son propriétaire
-- =============================================================================
select pg_temp.login('a_owner');
set local role authenticated;

insert into public.organizations (slug, name, created_by)
values ('fibre-atlantique', 'Fibre Atlantique SAS', pg_temp.uid('a_owner'));

reset role;

do $$
declare v_org uuid; v_role public.org_role;
begin
  select id into v_org from public.organizations where slug = 'fibre-atlantique';
  perform pg_temp.ok(v_org is not null, 'L''organisation A est creee');

  select role into v_role from public.organization_members
  where organization_id = v_org and user_id = pg_temp.uid('a_owner');

  perform pg_temp.ok(v_role = 'owner',
    'Le createur devient automatiquement proprietaire (trigger handle_new_organization)');
end
$$;

-- =============================================================================
-- 1.2 — Abonnement Entreprise
-- =============================================================================
-- Écrit en tant que `postgres` : `subscriptions` n'a AUCUNE policy d'écriture.
-- En production, c'est le webhook du prestataire de paiement qui l'alimente.
--
-- La suppression préalable n'est pas une précaution de style : depuis
-- `app.start_organization_trial`, créer une organisation lui ouvre AUSSI un
-- essai. L'index partiel `subscriptions_active_org_idx` n'en tolère qu'un seul
-- actif, et l'insertion sèche échouait donc — ce fichier datait d'avant le
-- déclencheur.
delete from public.subscriptions
where organization_id in (select id from public.organizations where slug = 'fibre-atlantique');

insert into public.subscriptions (organization_id, plan_code, status, current_period_end)
select id, 'business', 'active', now() + interval '30 days'
from public.organizations where slug = 'fibre-atlantique';

do $$
declare v_org uuid;
begin
  select id into v_org from public.organizations where slug = 'fibre-atlantique';

  perform pg_temp.ok(
    (select plan_code from public.organizations where id = v_org) = 'business',
    'Le cache organizations.plan_code est synchronise par trigger');
  perform pg_temp.ok(app.org_has_feature(v_org, 'missions'),
    'Le plan business debloque la fonctionnalite missions');
  perform pg_temp.ok(not app.org_has_feature(v_org, 'fonctionnalite_inexistante'),
    'Une fonctionnalite inconnue reste refusee');
end
$$;

-- =============================================================================
-- 1.3 — Ajout des membres
-- =============================================================================
insert into public.organization_members (organization_id, user_id, role, status, joined_at)
select o.id, pg_temp.uid(m.k), m.r::public.org_role, 'active', now()
from public.organizations o,
     (values ('a_manager','manager'), ('a_tech1','technician'),
             ('a_tech2','technician'), ('a_tech3','technician')) as m(k, r)
where o.slug = 'fibre-atlantique';

do $$
declare v_count integer;
begin
  select count(*) into v_count
  from public.organization_members om
  join public.organizations o on o.id = om.organization_id
  where o.slug = 'fibre-atlantique';

  perform pg_temp.ok(v_count = 5,
    'L''organisation A compte 5 membres (1 owner, 1 manager, 3 techniciens)');
end
$$;

-- =============================================================================
-- 1.4 — Création de l'équipe fibre par le manager
-- =============================================================================
select pg_temp.login('a_manager');
set local role authenticated;

insert into public.teams (organization_id, name, slug, category_id, manager_id)
select o.id, 'Equipe Fibre Optique', 'equipe-fibre', c.id, m.id
from public.organizations o
join public.categories c on c.slug = 'fiber-optics'
join public.organization_members m
  on m.organization_id = o.id and m.user_id = pg_temp.uid('a_manager')
where o.slug = 'fibre-atlantique';

insert into public.team_members (team_id, member_id, role)
select t.id, om.id,
       case when om.user_id = pg_temp.uid('a_tech1') then 'lead' else 'member' end::public.team_member_role
from public.teams t
join public.organization_members om on om.organization_id = t.organization_id
where t.slug = 'equipe-fibre'
  and om.user_id in (pg_temp.uid('a_tech1'), pg_temp.uid('a_tech2'), pg_temp.uid('a_tech3'));

reset role;

do $$
declare v_count integer;
begin
  select count(*) into v_count
  from public.team_members tm join public.teams t on t.id = tm.team_id
  where t.slug = 'equipe-fibre';

  perform pg_temp.ok(v_count = 3, 'L''equipe fibre compte 3 techniciens');
end
$$;

-- =============================================================================
-- 1.5 — Création de la mission par le manager
-- =============================================================================
select pg_temp.login('a_manager');
set local role authenticated;

insert into public.missions
  (organization_id, created_by, title, description, category_id, priority, customer_name, city)
select o.id, pg_temp.uid('a_manager'),
       'Raccordement FTTH - Residence Les Tilleuls',
       'Tirage et soudure de 12 FO, mesures reflectometriques.',
       c.id, 'high', 'SCI Les Tilleuls', 'Nantes'
from public.organizations o
join public.categories c on c.slug = 'fiber-optics'
where o.slug = 'fibre-atlantique';

reset role;

-- La mission de ce scénario, retenue une fois pour toutes.
--
-- Les blocs de vérification s'exécutent en tant que `postgres`, donc SANS RLS :
-- un `from public.missions where id = pg_temp.mission_a()` y balaie la base entière et tombe sur
-- n'importe quelle mission réelle. Ce fichier a été écrit contre une base
-- vide ; il devient faux dès qu'elle ne l'est plus, et de la pire manière —
-- l'assertion porte alors sur une donnée qui n'a rien à voir.
-- Ancrée sur le TITRE, pas sur `created_at` : `now()` est figé pour toute la
-- transaction, donc chaque ligne insérée par ce script porte exactement le même
-- horodatage. Trier dessus revient à tirer au sort — ce qui donne un test qui
-- passe ou échoue selon l'ordre physique des lignes.
create function pg_temp.mission_a() returns uuid
language sql stable as $$
  select m.id
  from public.missions m
  join public.organizations o on o.id = m.organization_id
  where o.slug = 'fibre-atlantique'
    and m.title = 'Raccordement FTTH - Residence Les Tilleuls'
  limit 1
$$;

/** L'intervention et le compte rendu de CETTE mission, mêmes raisons. */
create function pg_temp.interv_a() returns uuid
language sql stable as $$
  select id from public.interventions
  where mission_id = pg_temp.mission_a()
  limit 1
$$;

create function pg_temp.report_a() returns uuid
language sql stable as $$
  select id from public.intervention_reports
  where intervention_id = pg_temp.interv_a()
  limit 1
$$;

do $$
declare v_ref text; v_status public.mission_status;
begin
  select reference, status into v_ref, v_status
  from public.missions where id = pg_temp.mission_a();

  perform pg_temp.ok(v_status = 'draft', 'La mission nait en brouillon');
  perform pg_temp.ok(v_ref ~ ('^' || to_char(now(), 'YYYY') || '-\d{4}$'),
    'La reference est generee au format AAAA-NNNN : ' || v_ref);
end
$$;

-- =============================================================================
-- 1.6 — Affectation à l'équipe
-- =============================================================================
select pg_temp.login('a_manager');
set local role authenticated;

-- Le `where` compte : sans lui, cet UPDATE porte sur TOUTES les missions que
-- la RLS laisse voir au responsable, pas sur celle du scénario.
update public.missions
set assigned_team_id = (select id from public.teams where slug = 'equipe-fibre'),
    status = 'assigned'
where id = pg_temp.mission_a();

reset role;

do $$
begin
  perform pg_temp.ok((select status from public.missions where id = pg_temp.mission_a()) = 'assigned',
    'Le manager peut affecter la mission a l''equipe');
  perform pg_temp.ok(
    (select count(*) from public.mission_status_events where mission_id = pg_temp.mission_a() and to_status = 'assigned') = 1,
    'Le changement d''etat est journalise exactement une fois');
end
$$;

-- =============================================================================
-- 1.7 — Acceptation puis démarrage par un technicien
-- =============================================================================
select pg_temp.login('a_tech1');
set local role authenticated;

update public.missions set status = 'accepted';
update public.missions set status = 'in_progress';

reset role;

do $$
begin
  perform pg_temp.ok((select status from public.missions where id = pg_temp.mission_a()) = 'in_progress',
    'Le technicien affecte accepte puis demarre la mission');
  perform pg_temp.ok((select actual_start from public.missions where id = pg_temp.mission_a()) is not null,
    'actual_start est horodate par le trigger, pas declare par le client');
end
$$;

-- =============================================================================
-- 1.8 — Intervention et compte rendu
-- =============================================================================
select pg_temp.login('a_tech1');
set local role authenticated;

insert into public.interventions (mission_id, technician_id, status, start_time)
select m.id, om.id, 'in_progress', now() - interval '3 hours'
from public.missions m
join public.organization_members om on om.organization_id = m.organization_id
where om.user_id = pg_temp.uid('a_tech1');

update public.interventions set status = 'completed', end_time = now();
update public.missions set status = 'completed';

insert into public.intervention_reports
  (intervention_id, work_description, observations, materials_used)
select id,
       'Tirage de 120 m de cable 12 FO, 24 soudures, mesures OTDR conformes.',
       'Fourreau partiellement obstrue au regard R3, curage realise.',
       '[{"reference":"CAB-12FO","quantite":120,"unite":"m"}]'::jsonb
from public.interventions;

update public.intervention_reports set status = 'submitted';

reset role;

do $$
declare v_mission public.mission_status; v_org uuid;
begin
  select status into v_mission from public.missions where id = pg_temp.mission_a();
  select organization_id into v_org from public.interventions where id = pg_temp.interv_a();

  perform pg_temp.ok((select status from public.intervention_reports where id = pg_temp.report_a()) = 'submitted',
    'Le compte rendu est soumis');
  perform pg_temp.ok((select submitted_at from public.intervention_reports where id = pg_temp.report_a()) is not null,
    'submitted_at est horodate par le trigger');
  perform pg_temp.ok(v_mission = 'submitted',
    'La mission suit automatiquement l''etat du compte rendu');
  perform pg_temp.ok(
    v_org = (select id from public.organizations where slug = 'fibre-atlantique'),
    'organization_id de l''intervention est derive de la mission');
end
$$;

-- =============================================================================
-- 1.9 — SÉPARATION DES POUVOIRS : le technicien tente de se valider lui-même
-- =============================================================================
do $$
declare v_report uuid;
begin
  select id into v_report from public.intervention_reports where id = pg_temp.report_a();

  perform pg_temp.login('a_tech1');
  set local role authenticated;

  begin
    update public.intervention_reports set status = 'approved' where id = v_report;
    -- Deux issues acceptables : exception du trigger, ou zéro ligne touchée par
    -- la policy. Seule une validation effective serait une faille.
  exception when others then
    null;
  end;

  reset role;

  perform pg_temp.ok(
    (select status from public.intervention_reports where id = v_report) <> 'approved',
    'EXIGENCE 12 : un technicien NE PEUT PAS valider son propre compte rendu');
end
$$;

-- =============================================================================
-- 1.10 — Validation par le manager
-- =============================================================================
select pg_temp.login('a_manager');
set local role authenticated;

update public.intervention_reports set status = 'approved';

reset role;

do $$
declare v_reviewer uuid; v_manager_member uuid;
begin
  select reviewed_by into v_reviewer from public.intervention_reports where id = pg_temp.report_a();
  select id into v_manager_member from public.organization_members
  where user_id = pg_temp.uid('a_manager');

  perform pg_temp.ok((select status from public.intervention_reports where id = pg_temp.report_a()) = 'approved',
    'Le manager valide le compte rendu');
  perform pg_temp.ok(v_reviewer = v_manager_member,
    'reviewed_by est renseigne par le trigger avec l''identite reelle du controleur');
  perform pg_temp.ok((select reviewed_at from public.intervention_reports where id = pg_temp.report_a()) is not null,
    'reviewed_at est horodate par le trigger');
  perform pg_temp.ok((select status from public.missions where id = pg_temp.mission_a()) = 'approved',
    'La mission passe a validee');
  perform pg_temp.ok(
    (select count(*) from public.mission_status_events where mission_id = pg_temp.mission_a() and to_status = 'approved') = 1,
    'La validation n''est journalisee qu''une seule fois');
end
$$;

-- =============================================================================
-- 1.11 — Journal d'audit
-- =============================================================================
do $$
declare v_actions text[];
begin
  select array_agg(distinct action) into v_actions from public.audit_logs;

  perform pg_temp.ok(v_actions @> array['mission.created'],  'Audit : creation de mission');
  perform pg_temp.ok(v_actions @> array['mission.assigned'], 'Audit : affectation');
  perform pg_temp.ok(v_actions @> array['report.submitted'], 'Audit : soumission du compte rendu');
  perform pg_temp.ok(v_actions @> array['report.approved'],  'Audit : validation');
  perform pg_temp.ok(v_actions @> array['member.added'],     'Audit : ajout de membre');
  perform pg_temp.ok(v_actions @> array['team.created'],     'Audit : creation d''equipe');
end
$$;

do $$
declare v_id uuid; v_raised boolean := false;
begin
  select id into v_id from public.audit_logs limit 1;
  begin
    update public.audit_logs set action = 'falsifie.action' where id = v_id;
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.ok(v_raised,
    'Le journal d''audit est immuable, meme pour un role privilegie');
end
$$;

do $$ begin raise notice '=== PARTIE 2 — Isolation Entreprise B ==='; end $$;

-- =============================================================================
-- 2.0 — Mise en place de l'Entreprise B
-- =============================================================================
select pg_temp.login('b_owner');
set local role authenticated;

insert into public.organizations (slug, name, created_by)
values ('reseaux-du-sud', 'Reseaux du Sud SARL', pg_temp.uid('b_owner'));

reset role;

delete from public.subscriptions
where organization_id in (select id from public.organizations where slug = 'reseaux-du-sud');

insert into public.subscriptions (organization_id, plan_code, status, current_period_end)
select id, 'business', 'active', now() + interval '30 days'
from public.organizations where slug = 'reseaux-du-sud';

insert into public.organization_members (organization_id, user_id, role, status, joined_at)
select id, pg_temp.uid('b_tech'), 'technician', 'active', now()
from public.organizations where slug = 'reseaux-du-sud';

-- =============================================================================
-- 2.1 — Lecture : B ne voit rien de A
-- =============================================================================
do $$
declare
  v_orgs int; v_missions int; v_teams int; v_members int;
  v_reports int; v_interventions int; v_audit int; v_events int;
  v_org_b uuid;
begin
  -- Identifiant de B relevé AVANT la bascule de rôle. Sous RLS, `b_owner` ne
  -- peut pas résoudre l'organisation de A : une comparaison bâtie après la
  -- bascule porterait sur NULL et rendrait l'assertion vide de sens.
  select id into v_org_b from public.organizations where slug = 'reseaux-du-sud';

  perform pg_temp.login('b_owner');
  set local role authenticated;

  select count(*) into v_orgs          from public.organizations;
  select count(*) into v_missions      from public.missions;
  select count(*) into v_teams         from public.teams;
  select count(*) into v_members       from public.organization_members;
  select count(*) into v_reports       from public.intervention_reports;
  select count(*) into v_interventions from public.interventions;
  -- Compte les lignes d'audit VISIBLES qui n'appartiennent pas à B. Compter
  -- toutes les lignes visibles ne testait rien : B voit légitimement les siennes
  -- (deux `member.added` écrits par trigger), et l'assertion « aucune ligne de A »
  -- échouait donc sur des lignes de B.
  select count(*) into v_audit
  from public.audit_logs
  where organization_id is distinct from v_org_b;
  select count(*) into v_events        from public.mission_status_events;

  reset role;

  perform pg_temp.ok(v_orgs = 1,          'B ne voit QUE sa propre organisation');
  perform pg_temp.ok(v_missions = 0,      'B ne voit AUCUNE mission de A');
  perform pg_temp.ok(v_teams = 0,         'B ne voit AUCUNE equipe de A');
  -- B compte DEUX membres : `b_owner`, créé par le trigger `handle_new_organization`
  -- lors de l'insertion de l'organisation, et `b_tech` ajouté juste au-dessus.
  -- L'attente précédente (1) ignorait le second et échouait donc toujours.
  -- Ce qui est réellement vérifié ici : B ne voit pas les 5 membres de A — un
  -- cloisonnement défaillant remonterait 7.
  perform pg_temp.ok(v_members = 2,       'B ne voit QUE ses propres membres');
  perform pg_temp.ok(v_reports = 0,       'B ne voit AUCUN compte rendu de A');
  perform pg_temp.ok(v_interventions = 0, 'B ne voit AUCUNE intervention de A');
  perform pg_temp.ok(v_audit = 0,         'B ne voit AUCUNE ligne d''audit de A');
  perform pg_temp.ok(v_events = 0,        'B ne voit AUCUN historique de mission de A');
end
$$;

-- =============================================================================
-- 2.2 — Écriture : B ne peut rien modifier chez A
-- =============================================================================
do $$
declare v_org_a uuid; v_mission uuid; v_raised boolean;
begin
  select id into v_org_a from public.organizations where slug = 'fibre-atlantique';
  select id into v_mission from public.missions where id = pg_temp.mission_a();

  v_raised := false;
  perform pg_temp.login('b_owner');
  set local role authenticated;
  begin
    insert into public.missions (organization_id, created_by, title)
    values (v_org_a, pg_temp.uid('b_owner'), 'Mission injectee');
  exception when others then
    v_raised := true;
  end;
  reset role;
  perform pg_temp.ok(v_raised, 'B ne peut PAS creer de mission dans l''organisation A');

  perform pg_temp.login('b_owner');
  set local role authenticated;
  update public.missions set title = 'Titre detourne' where id = v_mission;
  reset role;
  perform pg_temp.ok(
    (select title from public.missions where id = v_mission) <> 'Titre detourne',
    'B ne peut PAS modifier une mission de A');

  v_raised := false;
  perform pg_temp.login('b_owner');
  set local role authenticated;
  begin
    insert into public.organization_members (organization_id, user_id, role, status)
    values (v_org_a, pg_temp.uid('b_owner'), 'owner', 'active');
  exception when others then
    v_raised := true;
  end;
  reset role;
  perform pg_temp.ok(v_raised, 'B ne peut PAS s''ajouter comme membre de A');
end
$$;

do $$ begin raise notice '=== PARTIE 3 — Cloisonnement intra-organisation ==='; end $$;

-- =============================================================================
-- 3.1 — Moindre privilège à l'intérieur de A
-- =============================================================================
do $$
declare v_org uuid; v_visible int;
begin
  select id into v_org from public.organizations where slug = 'fibre-atlantique';

  -- Un technicien de l'équipe affectée voit bien la mission...
  perform pg_temp.login('a_tech2');
  set local role authenticated;
  select count(*) into v_visible from public.missions;
  reset role;
  perform pg_temp.ok(v_visible = 1, 'Un technicien de l''equipe affectee voit la mission');

  -- ...mais ne peut pas revenir sur la décision du contrôleur.
  perform pg_temp.login('a_tech2');
  set local role authenticated;
  begin
    update public.intervention_reports
    set status = 'rejected', rejection_reason = 'Refus force par un technicien';
  exception when others then
    null;
  end;
  reset role;
  perform pg_temp.ok(
    (select status from public.intervention_reports where id = pg_temp.report_a()) = 'approved',
    'Un technicien ne peut PAS refuser un compte rendu deja valide');

  -- Paramètres de l'organisation
  perform pg_temp.login('a_tech2');
  set local role authenticated;
  update public.organizations set name = 'Renommee par un technicien' where id = v_org;
  reset role;
  perform pg_temp.ok(
    (select name from public.organizations where id = v_org) = 'Fibre Atlantique SAS',
    'Un technicien ne peut PAS modifier l''organisation');

  -- Auto-promotion
  perform pg_temp.login('a_tech2');
  set local role authenticated;
  begin
    update public.organization_members set role = 'owner'
    where user_id = pg_temp.uid('a_tech2');
  exception when others then
    null;
  end;
  reset role;
  perform pg_temp.ok(
    (select role from public.organization_members where user_id = pg_temp.uid('a_tech2')) = 'technician',
    'Un technicien ne peut PAS s''auto-promouvoir proprietaire');

  -- Journal d'audit
  perform pg_temp.login('a_tech2');
  set local role authenticated;
  select count(*) into v_visible from public.audit_logs;
  reset role;
  perform pg_temp.ok(v_visible = 0, 'Un technicien ne voit PAS le journal d''audit');
end
$$;

-- =============================================================================
-- 3.2 — Machine à états : les raccourcis sont refusés
-- =============================================================================
do $$
declare v_org uuid; v_mission uuid; v_raised boolean := false;
begin
  select id into v_org from public.organizations where slug = 'fibre-atlantique';

  insert into public.missions (organization_id, created_by, title)
  values (v_org, pg_temp.uid('a_manager'), 'Mission de controle des transitions')
  returning id into v_mission;

  perform pg_temp.login('a_manager');
  set local role authenticated;
  begin
    -- Sauterait le compte rendu ET son contrôle.
    update public.missions set status = 'approved' where id = v_mission;
  exception when others then
    v_raised := true;
  end;
  reset role;

  perform pg_temp.ok(v_raised, 'La machine a etats refuse la transition draft -> approved');
end
$$;

-- =============================================================================
-- 3.3 — Intégrité structurelle
-- =============================================================================
do $$
declare v_raised boolean := false;
begin
  begin
    delete from public.organization_members
    where user_id = pg_temp.uid('a_owner') and role = 'owner';
  exception when others then
    v_raised := true;
  end;

  perform pg_temp.ok(v_raised, 'Le dernier proprietaire ne peut pas etre retire');
end
$$;

do $$
declare v_team uuid; v_member_b uuid; v_raised boolean := false;
begin
  select id into v_team from public.teams where slug = 'equipe-fibre';
  select id into v_member_b from public.organization_members
  where user_id = pg_temp.uid('b_tech');

  begin
    -- Les deux clés étrangères sont valides prises isolément : seule une
    -- vérification croisée attrape cette fuite inter-tenant.
    insert into public.team_members (team_id, member_id) values (v_team, v_member_b);
  exception when others then
    v_raised := true;
  end;

  perform pg_temp.ok(v_raised,
    'Un membre de B ne peut pas rejoindre une equipe de A, meme via un role privilegie');
end
$$;

-- =============================================================================
-- 3.4 — L'abonnement conditionne réellement l'accès
-- =============================================================================
do $$
declare v_org uuid; v_visible int;
begin
  select id into v_org from public.organizations where slug = 'fibre-atlantique';

  update public.subscriptions set status = 'canceled' where organization_id = v_org;

  perform pg_temp.login('a_manager');
  set local role authenticated;
  select count(*) into v_visible from public.missions;
  reset role;

  perform pg_temp.ok(v_visible = 0,
    'Abonnement resilie : le module professionnel se ferme cote serveur');

  update public.subscriptions set status = 'active' where organization_id = v_org;
end
$$;

-- =============================================================================
-- PARTIE 4 — Clients, sites et clôture
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 4.1 — Un responsable crée un client, un site, puis une mission sur ce site
-- -----------------------------------------------------------------------------
do $$
declare
  v_org uuid; v_cust uuid; v_cust2 uuid; v_site uuid; v_mission uuid;
  v_ref text; v_snapshot record;
begin
  select id into v_org from public.organizations where slug = 'fibre-atlantique';

  perform pg_temp.login('a_manager');
  set local role authenticated;

  insert into public.customers (organization_id, name, city, created_by)
  values (v_org, 'Mairie de Saint-Pierre', 'Saint-Pierre', pg_temp.uid('a_manager'))
  returning id, reference into v_cust, v_ref;

  -- Second client, jamais rattaché à une mission : c'est lui qui permettra de
  -- vérifier qu'un technicien ne découvre pas le portefeuille de l'entreprise.
  insert into public.customers (organization_id, name, created_by)
  values (v_org, 'Clinique du Nord', pg_temp.uid('a_manager'))
  returning id into v_cust2;

  insert into public.sites
    (customer_id, organization_id, name, address_line1, city, access_notes)
  values
    (v_cust, v_org, 'Annexe technique', '12 rue des Ecoles', 'Saint-Pierre',
     'Portail code 4412')
  returning id into v_site;

  -- `customer_id` volontairement omis : le trigger doit le déduire du site.
  insert into public.missions (organization_id, title, site_id, created_by)
  values (v_org, 'Raccordement de l''annexe', v_site, pg_temp.uid('a_manager'))
  returning id into v_mission;

  reset role;

  perform pg_temp.ok(v_ref ~ '^CLI-\d{4}$',
    'La reference client est generee au format CLI-NNNN');

  select customer_id, address_line1, city, location_label, customer_name
  into v_snapshot
  from public.missions where id = v_mission;

  perform pg_temp.ok(v_snapshot.customer_id = v_cust,
    'Le site impose son client a la mission');
  perform pg_temp.ok(v_snapshot.address_line1 = '12 rue des Ecoles',
    'L''adresse du site est recopiee sur la mission');
  perform pg_temp.ok(v_snapshot.customer_name = 'Mairie de Saint-Pierre',
    'Le nom du client est fige sur la mission');

  -- Renommer la fiche ne doit PAS réécrire l'instantané : c'est toute la raison
  -- d'être des colonnes textuelles conservées sur `missions`.
  update public.customers set name = 'Mairie de Saint-Pierre (fusionnee)' where id = v_cust;

  perform pg_temp.ok(
    (select customer_name from public.missions where id = v_mission)
      = 'Mairie de Saint-Pierre',
    'Renommer le client ne reecrit pas l''historique de la mission');

  -- Affectation au technicien, pour la vérification de cloisonnement suivante.
  update public.missions
  set assigned_user_id = (
        select m.id from public.organization_members m
        where m.organization_id = v_org and m.user_id = pg_temp.uid('a_tech1')
      ),
      status = 'assigned'
  where id = v_mission;
end
$$;

-- -----------------------------------------------------------------------------
-- 4.2 — Le technicien atteint SON site, pas le portefeuille clients
-- -----------------------------------------------------------------------------
do $$
declare v_customers int; v_sites int;
begin
  perform pg_temp.login('a_tech1');
  set local role authenticated;

  select count(*) into v_customers from public.customers;
  select count(*) into v_sites     from public.sites;

  reset role;

  -- Deux clients existent chez A ; le technicien n'en voit qu'un, celui de sa
  -- mission. C'est le cœur du modèle : le besoin terrain est couvert — adresse
  -- et codes d'accès — sans jamais livrer la liste des clients de l'entreprise.
  perform pg_temp.ok(v_customers = 1,
    'Le technicien ne voit que le client de SA mission');
  perform pg_temp.ok(v_sites = 1,
    'Le technicien atteint le site de SA mission');
end
$$;

-- -----------------------------------------------------------------------------
-- 4.2 bis — Voir un client n'autorise pas à y écrire
-- -----------------------------------------------------------------------------
--
-- Régression déjà survenue. Les policies d'écriture étaient déclarées `for all`,
-- avec la permission dans le `using` et la seule visibilité du client dans le
-- `with check`. Or PostgreSQL n'évalue pas le `using` à l'INSERT : la permission
-- n'était jamais consultée, et voir un client suffisait à lui ajouter contacts
-- et sites.
--
-- Le technicien est le cas critique : il DOIT voir le client de sa mission, et
-- ne doit rien pouvoir y écrire. Les deux tiennent ensemble ou pas du tout.
do $$
declare v_cust uuid; v_org uuid; v_raised boolean;
begin
  select id into v_org from public.organizations where slug = 'fibre-atlantique';
  select id into v_cust from public.customers where name like 'Mairie de Saint-Pierre%';

  v_raised := false;
  begin
    perform pg_temp.login('a_tech1');
    set local role authenticated;
    insert into public.customer_contacts (customer_id, organization_id, last_name)
    values (v_cust, v_org, 'Intrus');
    reset role;
  exception when others then
    v_raised := true;
    reset role;
  end;

  perform pg_temp.ok(
    v_raised or not exists (select 1 from public.customer_contacts where last_name = 'Intrus'),
    'Le technicien ne peut PAS ajouter un contact au client de sa mission');

  v_raised := false;
  begin
    perform pg_temp.login('a_tech1');
    set local role authenticated;
    insert into public.sites (customer_id, organization_id, name)
    values (v_cust, v_org, 'Site Intrus');
    reset role;
  exception when others then
    v_raised := true;
    reset role;
  end;

  perform pg_temp.ok(
    v_raised or not exists (select 1 from public.sites where name = 'Site Intrus'),
    'Le technicien ne peut PAS ajouter un site au client de sa mission');

  -- Le chef d'équipe consulte le portefeuille mais ne le tient pas : il a
  -- `customer.view`, pas `customer.update`.
  v_raised := false;
  begin
    perform pg_temp.login('a_tech1');
    set local role authenticated;
    update public.customers set name = 'Renomme par un technicien' where id = v_cust;
    reset role;
  exception when others then
    v_raised := true;
    reset role;
  end;

  perform pg_temp.ok(
    v_raised or not exists (select 1 from public.customers where name = 'Renomme par un technicien'),
    'Le technicien ne peut PAS renommer un client');
end
$$;

-- -----------------------------------------------------------------------------
-- 4.3 — Cloisonnement des clients entre organisations
-- -----------------------------------------------------------------------------
do $$
declare v_customers int; v_sites int; v_raised boolean;
begin
  perform pg_temp.login('b_owner');
  set local role authenticated;

  select count(*) into v_customers from public.customers;
  select count(*) into v_sites     from public.sites;

  reset role;

  perform pg_temp.ok(v_customers = 0, 'B ne voit AUCUN client de A');
  perform pg_temp.ok(v_sites = 0,     'B ne voit AUCUN site de A');

  -- Écriture croisée : B tente de rattacher un client à l'organisation A.
  v_raised := false;
  begin
    perform pg_temp.login('b_owner');
    set local role authenticated;

    insert into public.customers (organization_id, name, created_by)
    select id, 'Client pirate', pg_temp.uid('b_owner')
    from public.organizations where slug = 'fibre-atlantique';

    reset role;
  exception when others then
    v_raised := true;
    reset role;
  end;

  perform pg_temp.ok(
    v_raised or not exists (select 1 from public.customers where name = 'Client pirate'),
    'B ne peut pas creer un client chez A');
end
$$;

-- -----------------------------------------------------------------------------
-- 4.4 — Clôture : seulement depuis une mission validée
-- -----------------------------------------------------------------------------
do $$
declare v_mission uuid; v_raised boolean; v_status public.mission_status;
begin
  -- La mission de la Partie 1 s'est arrêtée à `approved`.
  v_mission := pg_temp.mission_a();

  perform pg_temp.ok(
    (select status from public.missions where id = v_mission) = 'approved',
    'Une mission validee est disponible pour la cloture');

  -- Un technicien ne clôture pas : il lui manque `mission.update`.
  --
  -- On teste le RÉSULTAT et non l'exception : selon que la policy exclut la
  -- ligne ou qu'un trigger la refuse, le serveur lève ou ne lève pas. Les deux
  -- refusent ; seule l'assertion sur l'état couvre les deux cas.
  begin
    perform pg_temp.login('a_tech1');
    set local role authenticated;
    update public.missions set status = 'closed' where id = v_mission;
    reset role;
  exception when others then
    reset role;
  end;

  select status into v_status from public.missions where id = v_mission;
  perform pg_temp.ok(v_status = 'approved', 'Un technicien ne peut pas cloturer une mission');

  -- Le responsable, si.
  perform pg_temp.login('a_manager');
  set local role authenticated;
  update public.missions set status = 'closed' where id = v_mission;
  reset role;

  select status into v_status from public.missions where id = v_mission;
  perform pg_temp.ok(v_status = 'closed', 'Le responsable cloture la mission validee');

  -- État terminal : plus aucune sortie, pas même vers `cancelled`.
  begin
    perform pg_temp.login('a_manager');
    set local role authenticated;
    update public.missions set status = 'cancelled' where id = v_mission;
    reset role;
  exception when others then
    reset role;
  end;

  select status into v_status from public.missions where id = v_mission;
  perform pg_temp.ok(v_status = 'closed', 'Une mission cloturee ne peut plus changer d''etat');
end
$$;

-- =============================================================================
-- PARTIE 5 — Gestion des membres et invitations
-- =============================================================================
--
-- Les trois règles que l'interface reflète en désactivant des actions. Elles ne
-- valent que si le serveur refuse VRAIMENT : un bouton grisé se contourne à la
-- console.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 5.1 — Élévation de privilèges
-- -----------------------------------------------------------------------------
do $$
declare v_org uuid; v_raised boolean; v_member uuid;
begin
  select id into v_org from public.organizations where slug = 'fibre-atlantique';

  -- Personne ne modifie son propre rôle, pas même un propriétaire.
  v_raised := false;
  begin
    perform pg_temp.login('a_owner');
    set local role authenticated;

    update public.organization_members set role = 'admin'
    where organization_id = v_org and user_id = pg_temp.uid('a_owner');

    reset role;
  exception when others then
    v_raised := true;
    reset role;
  end;

  perform pg_temp.ok(v_raised, 'Nul ne peut modifier son propre role');

  -- Seul un propriétaire peut en désigner un autre. Le manager a pourtant un
  -- rôle élevé : c'est bien la nature de l'action qui est refusée, pas le niveau
  -- de l'acteur.
  select m.id into v_member
  from public.organization_members m
  where m.organization_id = v_org and m.user_id = pg_temp.uid('a_tech1');

  v_raised := false;
  begin
    perform pg_temp.login('a_manager');
    set local role authenticated;

    update public.organization_members set role = 'owner' where id = v_member;

    reset role;
  exception when others then
    v_raised := true;
    reset role;
  end;

  perform pg_temp.ok(
    v_raised or (select role from public.organization_members where id = v_member) <> 'owner',
    'Un non-proprietaire ne peut pas creer un proprietaire');
end
$$;

-- -----------------------------------------------------------------------------
-- 5.2 — Quota de membres
-- -----------------------------------------------------------------------------
-- Ce bloc vérifiait autrefois qu'un membre au-delà du quota était REFUSÉ. Ce
-- n'est plus la règle : depuis la grille à cinq paliers
-- (`20260817101000_pricing_model.sql`), `plan_features.members` compte les
-- sièges INCLUS, et le dépassement est facturé 5 € au lieu d'être bloqué.
--
-- Le plafond dur ne subsiste que pour Free, porté par `plans.max_users`. La
-- suite 04 l'éprouve en détail ; on vérifie ici que le renversement s'applique
-- bien à une organisation Business réelle du scénario.
do $$
declare v_org uuid; v_actifs int; v_inclus int; v_apres int;
begin
  select id into v_org from public.organizations where slug = 'fibre-atlantique';
  select count(*) into v_actifs
  from public.organization_members where organization_id = v_org and status = 'active';

  select limit_value into v_inclus
  from public.plan_features where plan_code = 'business' and feature_key = 'members';

  perform pg_temp.ok(app.org_feature_limit(v_org, 'members') = v_inclus,
    'Business expose ses ' || v_inclus || ' sieges inclus');

  -- On abaisse le seuil sous l'effectif courant plutôt que de créer dix comptes.
  -- Tout est annulé par le rollback final.
  update public.plan_features set limit_value = v_actifs
  where plan_code = 'business' and feature_key = 'members';

  insert into public.organization_members (organization_id, user_id, role, status, joined_at)
  values (v_org, pg_temp.uid('b_tech'), 'technician', 'active', now());

  select app.org_billable_seats(v_org) into v_apres;

  perform pg_temp.ok(v_apres = v_actifs + 1,
    'Le membre au-dela des sieges inclus est ACCEPTE');
  perform pg_temp.ok(app.org_extra_seats(v_org) = 1,
    'Il est compte comme siege supplementaire');
  perform pg_temp.ok(
    app.org_monthly_amount_cents(v_org)
      = (select price_monthly_cents + extra_user_price_cents
         from public.plans where code = 'business'),
    'Le montant du mois integre le siege supplementaire');

  delete from public.organization_members
  where organization_id = v_org and user_id = pg_temp.uid('b_tech');

  update public.plan_features set limit_value = v_inclus
  where plan_code = 'business' and feature_key = 'members';
end
$$;

-- -----------------------------------------------------------------------------
-- 5.3 — Aperçu d'invitation
-- -----------------------------------------------------------------------------
do $$
declare
  v_org uuid; v_token uuid; v_id uuid;
  v_name text; v_role public.org_role; v_count int;
begin
  select id into v_org from public.organizations where slug = 'fibre-atlantique';

  perform pg_temp.login('a_owner');
  set local role authenticated;

  insert into public.organization_invitations (organization_id, email, role, invited_by)
  values (v_org, 'nouvelle.recrue@test.local', 'technician', pg_temp.uid('a_owner'))
  returning id, token into v_id, v_token;

  reset role;

  -- L'invité n'est PAS membre : il ne peut pas lire `organizations`. C'est toute
  -- la raison d'être de la fonction.
  perform pg_temp.login('b_tech');
  set local role authenticated;

  select organization_name, invited_role into v_name, v_role
  from public.get_invitation_preview(v_token);

  select count(*) into v_count from public.organizations;

  reset role;

  perform pg_temp.ok(v_name = 'Fibre Atlantique SAS',
    'L''apercu revele le nom de l''entreprise a un non-membre');
  perform pg_temp.ok(v_role = 'technician', 'L''apercu revele le role propose');
  perform pg_temp.ok(v_count = 1,
    'L''apercu n''ouvre AUCUN acces supplementaire aux organisations');

  -- Une invitation révoquée ne doit plus rien révéler.
  update public.organization_invitations set status = 'revoked' where id = v_id;

  perform pg_temp.login('b_tech');
  set local role authenticated;
  select count(*) into v_count from public.get_invitation_preview(v_token);
  reset role;

  perform pg_temp.ok(v_count = 0, 'Une invitation revoquee ne revele plus rien');

  -- Un jeton inventé non plus — indistinguable du cas précédent, à dessein.
  perform pg_temp.login('b_tech');
  set local role authenticated;
  select count(*) into v_count
  from public.get_invitation_preview('00000000-0000-4000-8000-0000000000ff'::uuid);
  reset role;

  perform pg_temp.ok(v_count = 0, 'Un jeton inconnu ne revele rien');
end
$$;

-- =============================================================================
-- PARTIE 6 — Équipes : périmètre du responsable et immuabilité d'organisation
-- =============================================================================
--
-- Rappel du contexte posé en Partie 1 : `equipe-fibre` appartient à A, et
-- `a_tech1` en est le `lead` — technicien au niveau de l'entreprise, responsable
-- au niveau de l'équipe. `a_tech2` et `a_tech3` en sont simples membres.
--
-- C'est exactement la distinction que le module doit préserver : le rôle
-- d'équipe donne un PÉRIMÈTRE, jamais des PERMISSIONS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 6.1 — Le rôle d'équipe donne un périmètre, pas des permissions
-- -----------------------------------------------------------------------------
do $$
declare v_team uuid; v_org uuid; v_raised boolean; v_member uuid;
begin
  select id into v_org from public.organizations where slug = 'fibre-atlantique';
  select id into v_team from public.teams where slug = 'equipe-fibre';

  -- Un technicien SIMPLE MEMBRE ne modifie pas l'équipe.
  v_raised := false;
  begin
    perform pg_temp.login('a_tech2');
    set local role authenticated;
    update public.teams set name = 'Renommee par un membre' where id = v_team;
    reset role;
  exception when others then v_raised := true; reset role; end;

  perform pg_temp.ok(
    v_raised or not exists (select 1 from public.teams where name = 'Renommee par un membre'),
    'Un technicien simple membre ne peut PAS modifier son equipe');

  -- Le technicien RESPONSABLE, si. Il n'a pourtant aucune permission
  -- « team.update » : c'est `app.my_led_team_ids()` qui lui ouvre la porte.
  perform pg_temp.login('a_tech1');
  set local role authenticated;
  perform pg_temp.ok(not app.has_org_permission(v_org, 'team.update'),
    'Le responsable d''equipe n''a PAS la permission team.update');
  update public.teams set description = 'Pilotee par son responsable' where id = v_team;
  reset role;

  perform pg_temp.ok(
    (select description from public.teams where id = v_team) = 'Pilotee par son responsable',
    'Le technicien RESPONSABLE peut modifier SON equipe');

  -- Et il ne gagne toujours pas le droit de contrôler un compte rendu.
  perform pg_temp.login('a_tech1');
  set local role authenticated;
  perform pg_temp.ok(not app.has_org_permission(v_org, 'intervention.review'),
    'Etre responsable d''equipe n''accorde PAS le controle des comptes rendus');
  reset role;

  -- Un simple membre ne compose pas l'équipe.
  select m.id into v_member from public.organization_members m
  where m.organization_id = v_org and m.user_id = pg_temp.uid('a_manager');

  v_raised := false;
  begin
    perform pg_temp.login('a_tech2');
    set local role authenticated;
    insert into public.team_members (team_id, member_id) values (v_team, v_member);
    reset role;
  exception when others then v_raised := true; reset role; end;

  perform pg_temp.ok(v_raised,
    'Un technicien simple membre ne peut PAS ajouter quelqu''un a l''equipe');
end
$$;

-- -----------------------------------------------------------------------------
-- 6.2 — Une équipe ne change jamais d'organisation
-- -----------------------------------------------------------------------------
--
-- Régression mesurée avant correctif : un utilisateur `manager` chez A et
-- simple membre chez B déplaçait une équipe de A vers B, avec ses membres — qui
-- référencent pourtant les `organization_members` de A.
--
-- Le `WITH CHECK` de la policy ne vérifiait que l'appartenance. Le renforcer
-- n'aurait pas suffi : sa branche `id in my_led_team_ids()` part de
-- `team_members` et ignore l'organisation de l'équipe, si bien que le
-- responsable serait passé malgré tout. Seul un trigger sait comparer
-- l'ancienne et la nouvelle ligne.
do $$
declare v_team uuid; v_org_b uuid; v_raised boolean;
begin
  select id into v_team from public.teams where slug = 'equipe-fibre';
  select id into v_org_b from public.organizations where slug = 'reseaux-du-sud';

  -- Tenté avec le rôle le plus élevé qui soit : si le propriétaire échoue,
  -- personne ne réussit.
  v_raised := false;
  begin
    perform pg_temp.login('a_owner');
    set local role authenticated;
    update public.teams set organization_id = v_org_b where id = v_team;
    reset role;
  exception when others then v_raised := true; reset role; end;

  perform pg_temp.ok(v_raised, 'Une equipe ne peut PAS changer d''organisation');
  perform pg_temp.ok(
    (select organization_id from public.teams where id = v_team) <> v_org_b,
    'L''equipe est restee dans son organisation d''origine');

  -- Même garantie sur les clients et les missions : la protection y était
  -- déduite d'un enchaînement de conditions, elle est désormais écrite.
  v_raised := false;
  begin
    perform pg_temp.login('a_owner');
    set local role authenticated;
    update public.customers set organization_id = v_org_b
    where name like 'Mairie de Saint-Pierre%';
    reset role;
  exception when others then v_raised := true; reset role; end;

  perform pg_temp.ok(v_raised, 'Un client ne peut PAS changer d''organisation');
end
$$;

-- -----------------------------------------------------------------------------
-- 6.3 — La lecture des équipes suit la matrice RBAC
-- -----------------------------------------------------------------------------
--
-- `employee` ne possède pas `team.view`. La policy n'exigeait que
-- `can_use_pro_module` : le serveur lui servait les équipes que l'interface lui
-- masquait. Miroir et autorité divergeaient, dans le sens permissif.
do $$
declare v_org uuid; v_vues int;
begin
  select id into v_org from public.organizations where slug = 'fibre-atlantique';

  -- Les changements de rôle sont faits SOUS L'IDENTITÉ DU PROPRIÉTAIRE.
  --
  -- `reset role` rétablit le rôle PostgreSQL mais laisse `request.jwt.claims`
  -- intact : `auth.uid()` continue de désigner le dernier utilisateur connecté.
  -- Rétrograder `a_tech3` juste après l'avoir incarné revenait donc à lui faire
  -- modifier son propre rôle, ce que `prevent_privilege_escalation` refuse — à
  -- raison.
  perform pg_temp.login('a_owner');

  -- Rétrogradation temporaire — annulée par le rollback final.
  update public.organization_members set role = 'employee'
  where organization_id = v_org and user_id = pg_temp.uid('a_tech3');

  perform pg_temp.login('a_tech3');
  set local role authenticated;
  select count(*) into v_vues from public.teams;
  reset role;

  perform pg_temp.ok(v_vues = 0, 'Un employe ne voit AUCUNE equipe');

  perform pg_temp.login('a_owner');

  update public.organization_members set role = 'technician'
  where organization_id = v_org and user_id = pg_temp.uid('a_tech3');

  perform pg_temp.login('a_tech3');
  set local role authenticated;
  select count(*) into v_vues from public.teams;
  reset role;

  perform pg_temp.ok(v_vues = 1, 'Un technicien voit a nouveau les equipes');
end
$$;

-- -----------------------------------------------------------------------------
-- 6.4 — L'intervenant fait avancer la mission, il ne la redéfinit pas
-- -----------------------------------------------------------------------------
--
-- La policy `missions_update_permitted` doit ouvrir l'écriture à l'intervenant
-- affecté, sans quoi il ne pourrait pas faire avancer la machine à états. Mais
-- une policy raisonne par LIGNE, jamais par COLONNE : accorder l'écriture pour
-- le statut, c'était l'accorder pour tout le reste.
--
-- Mesuré avant correctif : un technicien affecté a réécrit l'intitulé de sa
-- mission et l'a rattachée à un autre client. Pas une brèche multi-tenant —
-- tout restait dans l'entreprise — mais celui qui exécute redéfinissait ce
-- qu'il était censé faire, et à qui ce serait facturé.
--
-- Même principe que pour les comptes rendus : l'exécutant rend compte, il
-- n'arbitre pas.
do $$
declare v_mission uuid; v_org uuid; v_raised boolean; v_titre text;
begin
  select id into v_org from public.organizations where slug = 'fibre-atlantique';

  -- La mission de la Partie 4, affectée à `a_tech1` et restée en `assigned`.
  select id into v_mission from public.missions
  where organization_id = v_org and title = 'Raccordement de l''annexe';

  perform pg_temp.ok(v_mission is not null,
    'Une mission affectee au technicien est disponible');

  v_raised := false;
  begin
    perform pg_temp.login('a_tech1');
    set local role authenticated;
    update public.missions set title = 'Redefinie par l''intervenant' where id = v_mission;
    reset role;
  exception when others then v_raised := true; reset role; end;

  select title into v_titre from public.missions where id = v_mission;

  perform pg_temp.ok(v_raised and v_titre = 'Raccordement de l''annexe',
    'L''intervenant ne peut PAS reecrire l''intitule de sa mission');

  v_raised := false;
  begin
    perform pg_temp.login('a_tech1');
    set local role authenticated;
    update public.missions set customer_id = null where id = v_mission;
    reset role;
  exception when others then v_raised := true; reset role; end;

  perform pg_temp.ok(v_raised,
    'L''intervenant ne peut PAS changer le client de sa mission');

  -- Mais il DOIT pouvoir commenter : c'est sa contribution propre.
  perform pg_temp.login('a_tech1');
  set local role authenticated;
  update public.missions set notes = 'Portail ferme, passage par l''arriere' where id = v_mission;
  reset role;

  perform pg_temp.ok(
    (select notes from public.missions where id = v_mission)
      = 'Portail ferme, passage par l''arriere',
    'L''intervenant PEUT commenter sa mission');

  -- Et le responsable, lui, garde la main sur tout.
  perform pg_temp.login('a_manager');
  set local role authenticated;
  update public.missions set title = 'Raccordement annexe - revu' where id = v_mission;
  reset role;

  perform pg_temp.ok(
    (select title from public.missions where id = v_mission) = 'Raccordement annexe - revu',
    'Le responsable garde la main sur la definition de la mission');
end
$$;

-- =============================================================================
-- PARTIE 7 — Relevé du temps d'intervention
-- =============================================================================
--
-- Un relevé d'heures sert à facturer un client, à payer un salarié et à prouver
-- qu'on est intervenu. Il ne vaut que s'il est inopposable à celui qu'il engage.
--
-- Mesuré avant correctif : le technicien antidatait le début de son intervention
-- de six heures, et la rattachait à une autre mission.
-- =============================================================================

do $$
declare
  v_org uuid; v_interv uuid; v_entry uuid; v_second uuid;
  v_raised boolean; v_started timestamptz; v_net integer; v_ouverts int;
begin
  select id into v_org from public.organizations where slug = 'fibre-atlantique';
  select id into v_interv from public.interventions where id = pg_temp.interv_a();

  perform pg_temp.ok(v_interv is not null, 'Une intervention existe pour le releve');

  -- ---------------------------------------------------------------------------
  -- 7.1 — L'horloge appartient au serveur
  -- ---------------------------------------------------------------------------
  perform pg_temp.login('a_tech1');
  set local role authenticated;

  insert into public.intervention_time_entries (intervention_id, organization_id, kind)
  values (v_interv, v_org, 'work')
  returning id, started_at into v_entry, v_started;

  reset role;

  perform pg_temp.ok(v_started > now() - interval '10 seconds',
    'Le debut du segment est horodate par le serveur');

  -- ---------------------------------------------------------------------------
  -- 7.2 — Un seul segment ouvert à la fois
  -- ---------------------------------------------------------------------------
  --
  -- Le cas n'est pas théorique : un technicien qui ouvre l'application sur son
  -- téléphone ET sur la tablette du véhicule enverrait deux « démarrer ». Aucune
  -- vérification côté client ne peut fermer cette porte — deux appareils, deux
  -- sessions, aucune ne voit l'autre.
  v_raised := false;
  begin
    perform pg_temp.login('a_tech1');
    set local role authenticated;
    insert into public.intervention_time_entries (intervention_id, organization_id, kind)
    values (v_interv, v_org, 'work');
    reset role;
  exception when others then v_raised := true; reset role; end;

  perform pg_temp.ok(v_raised, 'Un second segment ouvert est refuse (double demarrage)');

  select count(*) into v_ouverts from public.intervention_time_entries
  where intervention_id = v_interv and ended_at is null;

  perform pg_temp.ok(v_ouverts = 1, 'Il n''y a jamais qu''un seul segment ouvert');

  -- ---------------------------------------------------------------------------
  -- 7.3 — Un segment clos est définitif
  -- ---------------------------------------------------------------------------
  perform pg_temp.login('a_tech1');
  set local role authenticated;
  update public.intervention_time_entries set ended_at = now() where id = v_entry;
  reset role;

  v_raised := false;
  begin
    perform pg_temp.login('a_tech1');
    set local role authenticated;
    -- Tentative d'allonger après coup un segment déjà facturable.
    update public.intervention_time_entries
    set ended_at = now() + interval '3 hours' where id = v_entry;
    reset role;
  exception when others then v_raised := true; reset role; end;

  perform pg_temp.ok(v_raised, 'Un segment clos ne peut plus etre modifie');

  -- ---------------------------------------------------------------------------
  -- 7.4 — Les pauses ne sont pas comptées
  -- ---------------------------------------------------------------------------
  perform pg_temp.login('a_tech1');
  set local role authenticated;

  insert into public.intervention_time_entries (intervention_id, organization_id, kind, reason)
  values (v_interv, v_org, 'pause', 'Dejeuner')
  returning id into v_second;

  update public.intervention_time_entries set ended_at = now() where id = v_second;
  reset role;

  v_net := app.intervention_worked_seconds(v_interv);

  perform pg_temp.ok(v_net >= 0, 'Le temps net est calculable');
  perform pg_temp.ok(
    v_net = (select coalesce(sum(extract(epoch from (ended_at - started_at)))::integer, 0)
             from public.intervention_time_entries
             where intervention_id = v_interv and kind = 'work' and ended_at is not null),
    'Le temps net ne compte QUE les segments de travail clos');

  -- ---------------------------------------------------------------------------
  -- 7.5 — Un responsable consulte, il ne pointe pas
  -- ---------------------------------------------------------------------------
  --
  -- Pointer les heures de quelqu'un d'autre viderait le relevé de son sens.
  v_raised := false;
  begin
    perform pg_temp.login('a_manager');
    set local role authenticated;
    insert into public.intervention_time_entries (intervention_id, organization_id, kind)
    values (v_interv, v_org, 'work');
    reset role;
  exception when others then v_raised := true; reset role; end;

  perform pg_temp.ok(v_raised,
    'Un responsable ne peut PAS pointer a la place de l''intervenant');
end
$$;

-- -----------------------------------------------------------------------------
-- 7.6 — L'intervention ne se déplace pas, et son heure ne se réécrit pas
-- -----------------------------------------------------------------------------
do $$
declare v_interv uuid; v_autre_mission uuid; v_raised boolean; v_avant timestamptz;
begin
  select id, start_time into v_interv, v_avant from public.interventions where id = pg_temp.interv_a();
  select id into v_autre_mission from public.missions
  where title like 'Raccordement annexe%' limit 1;

  v_raised := false;
  begin
    perform pg_temp.login('a_tech1');
    set local role authenticated;
    update public.interventions set mission_id = v_autre_mission where id = v_interv;
    reset role;
  exception when others then v_raised := true; reset role; end;

  perform pg_temp.ok(v_raised,
    'Une intervention ne peut PAS etre rattachee a une autre mission');

  -- L'antidatage n'est pas refusé : il est NEUTRALISÉ. L'écriture passe, le
  -- trigger réimpose l'heure d'origine. Ce qui compte est le résultat.
  perform pg_temp.login('a_tech1');
  set local role authenticated;
  update public.interventions set start_time = now() - interval '6 hours' where id = v_interv;
  reset role;

  perform pg_temp.ok(
    (select start_time from public.interventions where id = v_interv) = v_avant,
    'L''antidatage du debut est neutralise');
end
$$;

-- =============================================================================
-- PARTIE 8 — Paternité du compte rendu
-- =============================================================================
--
-- La séparation des pouvoirs était écrite dans un seul sens : « un intervenant
-- ne valide jamais son propre compte rendu » (vérifié en 1.9). Le versant
-- symétrique manquait.
--
-- Mesuré avant correctif : le contrôleur réécrivait le texte du technicien puis
-- validait — le compte rendu portait le nom de l'un et les mots de l'autre — et
-- pouvait encore modifier un compte rendu déjà validé.
--
-- Pour une pièce montrée à un client, ou produite en cas de litige, c'est la
-- fin de toute valeur probante.
-- =============================================================================

do $$
declare
  v_org uuid; v_report uuid; v_raised boolean; v_texte text; v_statut public.report_status;
  v_interv uuid; v_tech uuid; v_mission uuid;
begin
  select id into v_org from public.organizations where slug = 'fibre-atlantique';

  -- Un compte rendu neuf, à l'état soumis, sur une seconde intervention.
  select m.id into v_tech from public.organization_members m
  where m.organization_id = v_org and m.user_id = pg_temp.uid('a_tech2');

  insert into public.missions (organization_id, title, assigned_user_id, status, created_by)
  values (v_org, 'Mission pour paternite', v_tech, 'assigned', pg_temp.uid('a_manager'))
  returning id into v_mission;

  insert into public.interventions (mission_id, organization_id, technician_id, status, start_time)
  values (v_mission, v_org, v_tech, 'completed', now()) returning id into v_interv;

  insert into public.intervention_reports
    (intervention_id, organization_id, technician_id, work_description, status, submitted_at)
  values (v_interv, v_org, v_tech, 'Redige par le technicien', 'submitted', now())
  returning id into v_report;

  -- ---------------------------------------------------------------------------
  -- 8.1 — Celui qui contrôle n'écrit pas
  -- ---------------------------------------------------------------------------
  v_raised := false;
  begin
    perform pg_temp.login('a_manager');
    set local role authenticated;
    update public.intervention_reports
    set work_description = 'Reecrit par le controleur', status = 'approved'
    where id = v_report;
    reset role;
  exception when others then v_raised := true; reset role; end;

  select work_description, status into v_texte, v_statut
  from public.intervention_reports where id = v_report;

  perform pg_temp.ok(v_raised, 'Le controleur ne peut PAS reecrire le compte rendu');
  perform pg_temp.ok(v_texte = 'Redige par le technicien',
    'Le texte du technicien est intact');
  perform pg_temp.ok(v_statut = 'submitted',
    'La tentative de reecriture n''a pas valide le compte rendu');

  -- ---------------------------------------------------------------------------
  -- 8.2 — Mais il valide, et il refuse en motivant
  -- ---------------------------------------------------------------------------
  perform pg_temp.login('a_manager');
  set local role authenticated;
  update public.intervention_reports
  set status = 'rejected', rejection_reason = 'Photos manquantes sur le raccordement'
  where id = v_report;
  reset role;

  perform pg_temp.ok(
    (select status from public.intervention_reports where id = v_report) = 'rejected',
    'Le controleur PEUT refuser en motivant');

  -- L'auteur corrige, puis resoumet : c'est le chemin prévu pour une correction.
  perform pg_temp.login('a_tech2');
  set local role authenticated;
  update public.intervention_reports
  set work_description = 'Redige par le technicien - complete', status = 'submitted'
  where id = v_report;
  reset role;

  perform pg_temp.ok(
    (select work_description from public.intervention_reports where id = v_report)
      = 'Redige par le technicien - complete',
    'L''auteur PEUT corriger son compte rendu refuse');

  -- ---------------------------------------------------------------------------
  -- 8.3 — Un compte rendu validé est définitif
  -- ---------------------------------------------------------------------------
  perform pg_temp.login('a_manager');
  set local role authenticated;
  update public.intervention_reports set status = 'approved' where id = v_report;
  reset role;

  v_raised := false;
  begin
    perform pg_temp.login('a_manager');
    set local role authenticated;
    update public.intervention_reports
    set observations = 'Ajoute apres validation' where id = v_report;
    reset role;
  exception when others then v_raised := true; reset role; end;

  perform pg_temp.ok(v_raised,
    'Un compte rendu valide ne peut plus etre modifie, meme par le controleur');

  -- Ni par son auteur — mais par un autre mécanisme, et la nuance compte.
  --
  -- Pour le contrôleur, la ligne est VISIBLE en écriture et le trigger lève.
  -- Pour l'auteur, la policy `intervention_reports_update` ne retient que les
  -- états `draft` et `rejected` : un compte rendu validé est simplement HORS de
  -- sa portée. L'UPDATE ne touche aucune ligne et ne lève rien.
  --
  -- Tester l'exception ici passerait à côté : ce qu'il faut vérifier est le
  -- résultat, pas la manière dont il est obtenu.
  begin
    perform pg_temp.login('a_tech2');
    set local role authenticated;
    update public.intervention_reports
    set work_description = 'Retouche apres validation' where id = v_report;
    reset role;
  exception when others then reset role; end;

  perform pg_temp.ok(
    (select work_description from public.intervention_reports where id = v_report)
      <> 'Retouche apres validation',
    'L''auteur non plus ne modifie un compte rendu valide');

  -- ---------------------------------------------------------------------------
  -- 8.4 — Les informations de contrôle sont posées par le serveur
  -- ---------------------------------------------------------------------------
  perform pg_temp.ok(
    (select reviewed_by from public.intervention_reports where id = v_report) is not null,
    'Le controleur est enregistre par le serveur');
end
$$;

do $$
begin
  raise notice '';
  raise notice 'TOUS LES TESTS PASSENT';
  raise notice '';
end
$$;

rollback;

-- Verdict lisible hors du SQL Editor.
--
-- Les `raise notice` ci-dessus ne s'affichent que dans une console qui relaie
-- les messages du serveur ; l'API Management, qu'utilise `supabase db query`,
-- ne remonte que des lignes. Sans ce dernier select, un script entièrement
-- réussi et un script n'ayant produit aucune ligne se ressemblent.
--
-- Placé APRÈS le rollback : il ne dépend donc d'aucune donnée de test, et sa
-- seule présence prouve que l'exécution a atteint la fin du fichier — toute
-- assertion en échec ayant interrompu le script bien avant.
select 'TOUS LES TESTS PASSENT' as resultat;
