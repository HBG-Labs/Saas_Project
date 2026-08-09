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
  if not p_condition then
    raise exception 'ECHEC : %', p_label using errcode = 'assert_failure';
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

do $$
declare v_ref text; v_status public.mission_status;
begin
  select reference, status into v_ref, v_status from public.missions limit 1;

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

update public.missions
set assigned_team_id = (select id from public.teams where slug = 'equipe-fibre'),
    status = 'assigned';

reset role;

do $$
begin
  perform pg_temp.ok((select status from public.missions limit 1) = 'assigned',
    'Le manager peut affecter la mission a l''equipe');
  perform pg_temp.ok(
    (select count(*) from public.mission_status_events where to_status = 'assigned') = 1,
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
  perform pg_temp.ok((select status from public.missions limit 1) = 'in_progress',
    'Le technicien affecte accepte puis demarre la mission');
  perform pg_temp.ok((select actual_start from public.missions limit 1) is not null,
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
  select status into v_mission from public.missions limit 1;
  select organization_id into v_org from public.interventions limit 1;

  perform pg_temp.ok((select status from public.intervention_reports limit 1) = 'submitted',
    'Le compte rendu est soumis');
  perform pg_temp.ok((select submitted_at from public.intervention_reports limit 1) is not null,
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
  select id into v_report from public.intervention_reports limit 1;

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
  select reviewed_by into v_reviewer from public.intervention_reports limit 1;
  select id into v_manager_member from public.organization_members
  where user_id = pg_temp.uid('a_manager');

  perform pg_temp.ok((select status from public.intervention_reports limit 1) = 'approved',
    'Le manager valide le compte rendu');
  perform pg_temp.ok(v_reviewer = v_manager_member,
    'reviewed_by est renseigne par le trigger avec l''identite reelle du controleur');
  perform pg_temp.ok((select reviewed_at from public.intervention_reports limit 1) is not null,
    'reviewed_at est horodate par le trigger');
  perform pg_temp.ok((select status from public.missions limit 1) = 'approved',
    'La mission passe a validee');
  perform pg_temp.ok(
    (select count(*) from public.mission_status_events where to_status = 'approved') = 1,
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
  select id into v_mission from public.missions limit 1;

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
    (select status from public.intervention_reports limit 1) = 'approved',
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
  select id into v_mission
  from public.missions where status = 'approved' limit 1;

  perform pg_temp.ok(v_mission is not null,
    'Une mission validee est disponible pour la cloture');

  -- Un technicien ne clôture pas : il lui manque `mission.update`.
  v_raised := false;
  begin
    perform pg_temp.login('a_tech1');
    set local role authenticated;
    update public.missions set status = 'closed' where id = v_mission;
    reset role;
  exception when others then
    v_raised := true;
    reset role;
  end;

  perform pg_temp.ok(v_raised, 'Un technicien ne peut pas cloturer une mission');

  -- Le responsable, si.
  perform pg_temp.login('a_manager');
  set local role authenticated;
  update public.missions set status = 'closed' where id = v_mission;
  reset role;

  select status into v_status from public.missions where id = v_mission;
  perform pg_temp.ok(v_status = 'closed', 'Le responsable cloture la mission validee');

  -- État terminal : plus aucune sortie, pas même vers `cancelled`.
  v_raised := false;
  begin
    perform pg_temp.login('a_manager');
    set local role authenticated;
    update public.missions set status = 'cancelled' where id = v_mission;
    reset role;
  exception when others then
    v_raised := true;
    reset role;
  end;

  perform pg_temp.ok(v_raised, 'Une mission cloturee ne peut plus changer d''etat');
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
do $$
declare v_org uuid; v_raised boolean; v_actifs int;
begin
  select id into v_org from public.organizations where slug = 'fibre-atlantique';
  select count(*) into v_actifs
  from public.organization_members where organization_id = v_org and status = 'active';

  perform pg_temp.ok(app.org_feature_limit(v_org, 'members') = 25,
    'Le plan business plafonne a 25 membres');

  -- Plutôt que de créer vingt-cinq comptes fictifs, on abaisse le plafond sous
  -- l'effectif courant. Le trigger est le même ; seule la borne change. Tout est
  -- annulé par le rollback final.
  update public.plan_features set limit_value = v_actifs
  where plan_code = 'business' and feature_key = 'members';

  v_raised := false;
  begin
    insert into public.organization_members (organization_id, user_id, role, status, joined_at)
    values (v_org, pg_temp.uid('b_tech'), 'technician', 'active', now());
  exception when others then
    v_raised := true;
  end;

  perform pg_temp.ok(v_raised, 'Le membre au-dela du quota est refuse');

  update public.plan_features set limit_value = 25
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
