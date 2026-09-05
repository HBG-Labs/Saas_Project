-- =============================================================================
-- SUITE DE TESTS — planning et congés
-- =============================================================================
-- Rejoue les garanties posées par les migrations `20260816*` :
--
--   demande de congé → décision par un tiers → solde → tâches récurrentes
--
-- et vérifie que chacune tient CÔTÉ SERVEUR, indépendamment de l'interface.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- CE QUE CE FICHIER PROTÈGE EN PARTICULIER
--
-- Deux règles de cette architecture ne vivent PAS dans une policy, et ne
-- peuvent donc pas y vivre : « hors propriétaire, on ne statue pas sur ses
-- propres congés » et « hors propriétaire, une demande décidée est figée »
-- portent sur une TRANSITION, pas sur un état. Une policy raisonne par ligne ;
-- ces règles comparent l'avant et l'après. Elles sont dans
-- `app.enforce_leave_decision`, et rien d'autre que ce fichier ne les vérifie.
--
-- COMMENT L'EXÉCUTER
--
--   npm run test:planning
--
-- ou en collant ce fichier dans le SQL Editor du dashboard Supabase.
--
-- Le script se termine par `rollback` : il ne laisse AUCUNE donnée derrière lui.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

set local search_path = pg_temp, public;

-- -----------------------------------------------------------------------------
-- Identités et utilitaires — même dispositif que 01 et 02
-- -----------------------------------------------------------------------------
create temporary table t_ids (k text primary key, v uuid);

insert into t_ids (k, v) values
  ('patron',    '00000000-0000-4000-8000-00000000d001'),
  ('resp',      '00000000-0000-4000-8000-00000000d002'),
  ('poseur',    '00000000-0000-4000-8000-00000000d003'),
  ('etranger',  '00000000-0000-4000-8000-00000000d004');

grant select on t_ids to authenticated;

create function pg_temp.uid(p_key text) returns uuid
language sql stable as $$ select v from pg_temp.t_ids where k = p_key $$;

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

create function pg_temp.refuses(p_sql text, p_label text) returns void
language plpgsql as $$
begin
  execute p_sql;
  raise exception 'ECHEC : % (l''instruction a ete ACCEPTEE)', p_label
    using errcode = 'assert_failure';
exception
  when assert_failure then raise;
  when others then raise notice '  OK  % (refuse : %)', p_label, left(sqlerrm, 60);
end;
$$;

create function pg_temp.member(p_slug text, p_who text) returns uuid
language sql stable as $$
  select m.id
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where o.slug = p_slug and m.user_id = pg_temp.uid(p_who)
$$;

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

-- -----------------------------------------------------------------------------
-- Deux entreprises, quatre personnes
-- -----------------------------------------------------------------------------
select pg_temp.login('patron');
set local role authenticated;
insert into public.organizations (slug, name, created_by, industry)
values ('essai-planning', 'Essai Planning', pg_temp.uid('patron'), 'hvac');
reset role;

select pg_temp.login('etranger');
set local role authenticated;
insert into public.organizations (slug, name, created_by, industry)
values ('essai-voisin', 'Essai Voisin', pg_temp.uid('etranger'), 'landscaping');
reset role;

-- Depuis 20260830100000, une organisation neuve démarre en Gratuit et aucun
-- essai n'est ouvert sans Stripe. Le planning est une capacité Business : ce
-- scénario l'attribue explicitement, comme le ferait le webhook en production.
insert into public.subscriptions
  (organization_id, plan_code, status, current_period_start, current_period_end)
select id, 'business', 'active', now(), now() + interval '30 days'
from public.organizations
where slug = 'essai-planning';

-- Le responsable et le poseur sont ajoutés en tant que FIXTURE, hors session :
-- passer par l'invitation exercerait la messagerie, qui n'est pas le sujet ici.
insert into public.organization_members (organization_id, user_id, role)
select o.id, pg_temp.uid('resp'), 'manager'
from public.organizations o where o.slug = 'essai-planning';

insert into public.organization_members (organization_id, user_id, role)
select o.id, pg_temp.uid('poseur'), 'technician'
from public.organizations o where o.slug = 'essai-planning';

-- =============================================================================
do $$ begin raise notice '=== PARTIE 1 — Une demande naît en attente ==='; end $$;
-- =============================================================================

select pg_temp.login('poseur');
set local role authenticated;

do $$
declare v_org uuid; v_me uuid; v_status public.leave_status;
begin
  select id into v_org from public.organizations where slug = 'essai-planning';
  v_me := pg_temp.member('essai-planning', 'poseur');

  -- Le client demande « approuve » d'emblée : le serveur doit refuser.
  perform pg_temp.refuses(
    format(
      $sql$ insert into public.leave_requests
              (organization_id, member_id, type, start_date, end_date, days_count, status)
            values (%L, %L, 'paid_leave', '2026-09-01', '2026-09-05', 5, 'approved') $sql$,
      v_org, v_me
    ),
    'Une demande ne peut pas naitre deja approuvee'
  );

  insert into public.leave_requests
    (organization_id, member_id, type, start_date, end_date, days_count, reason)
  values (v_org, v_me, 'paid_leave', '2026-09-01', '2026-09-05', 5, 'Vacances');

  select status into v_status from public.leave_requests where member_id = v_me;
  perform pg_temp.ok(v_status = 'pending', 'La demande est enregistree en attente');
end
$$;

-- Un technicien ne dépose pas pour un collègue : il n'a pas `leave.approve`.
do $$
declare v_org uuid; v_autre uuid;
begin
  select id into v_org from public.organizations where slug = 'essai-planning';
  v_autre := pg_temp.member('essai-planning', 'resp');

  perform pg_temp.refuses(
    format(
      $sql$ insert into public.leave_requests
              (organization_id, member_id, type, start_date, end_date, days_count)
            values (%L, %L, 'rtt', '2026-10-01', '2026-10-01', 1) $sql$,
      v_org, v_autre
    ),
    'Un technicien ne depose pas de demande pour un collegue'
  );
end
$$;

reset role;

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 2 — Nul ne statue sur ses propres conges ==='; end $$;
-- =============================================================================

select pg_temp.login('poseur');
set local role authenticated;

do $$
declare v_leave uuid;
begin
  select id into v_leave from public.leave_requests
  where member_id = pg_temp.member('essai-planning', 'poseur');

  -- Il n'a pas la permission : refusé pour cette raison d'abord.
  perform pg_temp.refuses(
    format($sql$ update public.leave_requests set status = 'approved' where id = %L $sql$, v_leave),
    'Le demandeur ne peut pas approuver sa propre demande'
  );
end
$$;

reset role;

-- Depuis 20260820120000, le propriétaire peut statuer sur ses propres congés :
-- dans une petite entreprise, il n'existe pas forcément de valideur distinct.
select pg_temp.login('patron');
set local role authenticated;

do $$
declare v_org uuid; v_moi uuid; v_leave uuid; v_status public.leave_status; v_by uuid;
begin
  select id into v_org from public.organizations where slug = 'essai-planning';
  v_moi := pg_temp.member('essai-planning', 'patron');

  insert into public.leave_requests
    (organization_id, member_id, type, start_date, end_date, days_count)
  values (v_org, v_moi, 'rtt', '2026-11-02', '2026-11-02', 1)
  returning id into v_leave;

  update public.leave_requests set status = 'approved' where id = v_leave;

  select status, reviewed_by into v_status, v_by
  from public.leave_requests
  where id = v_leave;

  perform pg_temp.ok(v_status = 'approved',
    'Le proprietaire peut valider ses propres conges');
  perform pg_temp.ok(v_by = pg_temp.uid('patron'),
    'Le serveur signe aussi la decision du proprietaire');
end
$$;

reset role;

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 3 — La decision est signee par le SERVEUR ==='; end $$;
-- =============================================================================

select pg_temp.login('resp');
set local role authenticated;

do $$
declare
  v_leave  uuid;
  v_by     uuid;
  v_at     timestamptz;
  v_days   numeric;
  v_avant  numeric;
begin
  select id, days_count into v_leave, v_avant from public.leave_requests
  where member_id = pg_temp.member('essai-planning', 'poseur');

  -- La demande porte sur le 1er au 5 septembre 2026, dont un samedi : le moteur
  -- en compte QUATRE, quel que soit le 5 annoncé à l'insertion.
  perform pg_temp.ok(v_avant = 4,
    'Le serveur a calcule la duree a l''insertion, samedi exclu');

  -- Le client tente de signer à la place de quelqu'un d'autre, et de réécrire
  -- la durée au passage. Les deux doivent être écrasés.
  update public.leave_requests
  set status      = 'approved',
      reviewed_by = pg_temp.uid('poseur'),
      days_count  = 99
  where id = v_leave;

  select reviewed_by, reviewed_at, days_count into v_by, v_at, v_days
  from public.leave_requests where id = v_leave;

  perform pg_temp.ok(v_by = pg_temp.uid('resp'),
    'Le decideur enregistre est l''appelant, pas celui qu''annonce le client');
  perform pg_temp.ok(v_at is not null, 'La decision est horodatee par le serveur');
  perform pg_temp.ok(v_days = v_avant, 'Une decision ne reecrit pas la duree calculee');
end
$$;

-- Une demande traitée est figée.
do $$
declare v_leave uuid;
begin
  select id into v_leave from public.leave_requests
  where member_id = pg_temp.member('essai-planning', 'poseur');

  perform pg_temp.refuses(
    format($sql$ update public.leave_requests set status = 'rejected' where id = %L $sql$, v_leave),
    'Une demande deja traitee n''est plus modifiable'
  );
end
$$;

reset role;

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 4 — Retrait par l''auteur, et cloisonnement ==='; end $$;
-- =============================================================================

select pg_temp.login('patron');
set local role authenticated;

do $$
declare v_leave uuid; v_status public.leave_status;
begin
  select id into v_leave from public.leave_requests
  where member_id = pg_temp.member('essai-planning', 'patron');

  update public.leave_requests set status = 'cancelled' where id = v_leave;

  select status into v_status from public.leave_requests where id = v_leave;
  perform pg_temp.ok(v_status = 'cancelled', 'L''auteur retire sa demande tant qu''elle est en attente');
end
$$;

reset role;

-- Un technicien ne voit QUE ses propres demandes : il n'a pas `leave.view`.
select pg_temp.login('poseur');
set local role authenticated;

do $$
declare v_total integer; v_miennes integer;
begin
  select count(*) into v_total from public.leave_requests;
  select count(*) into v_miennes from public.leave_requests
  where member_id = pg_temp.member('essai-planning', 'poseur');

  perform pg_temp.ok(v_total = v_miennes,
    'Sans leave.view, un technicien ne voit que ses propres demandes');
  perform pg_temp.ok(v_total > 0, 'Il voit bien les siennes');
end
$$;

reset role;

-- Une autre entreprise ne voit rien du tout.
select pg_temp.login('etranger');
set local role authenticated;

do $$
declare v_count integer;
begin
  select count(*) into v_count from public.leave_requests;
  perform pg_temp.ok(v_count = 0, 'Une entreprise ne voit pas les conges d''une autre');
end
$$;

reset role;

-- =============================================================================
-- PARTIES 5 et 6 — RETIRÉES avec l'abandon du suivi GPS continu
-- =============================================================================
--
-- Elles vérifiaient qu'une position n'appartient qu'à son auteur, et que la
-- piste se purge d'elle-même au-delà de soixante jours. Les deux garanties
-- tenaient ; c'est la fonctionnalité qui a été abandonnée.
--
-- Les tables `technician_locations` et `technician_location_pings` subsistent,
-- vides, et plus aucune policy de lecture ne peut être satisfaite depuis que
-- `location.view_all` a disparu de `role_permissions`
-- (`20260817100000_retire_live_tracking.sql`). Éprouver un chemin que personne
-- ne peut plus emprunter donnerait au vert de cette suite un sens trompeur.
--
-- Le GPS ne sert plus qu'à des relevés ponctuels, côté client, sans écriture
-- automatique : il n'y a donc rien à vérifier ici. `geolocation.test.ts` s'en
-- charge en refusant tout appel à `watchPosition`.
-- =============================================================================

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 5 — Coherence metier des taches recurrentes ==='; end $$;
-- =============================================================================

select pg_temp.login('patron');
set local role authenticated;

do $$
declare v_org uuid; v_type_fibre uuid;
begin
  select id into v_org from public.organizations where slug = 'essai-planning';

  select id into v_type_fibre from public.intervention_types
  where industry_code = 'fiber_telecom' limit 1;

  -- L'entreprise exerce le FROID. Un type fibre n'a rien à y faire, exactement
  -- comme pour une mission.
  perform pg_temp.refuses(
    format(
      $sql$ insert into public.recurring_tasks
              (organization_id, title, frequency, next_date, intervention_type_id)
            values (%L, 'Essai', 'yearly', '2026-12-01', %L) $sql$,
      v_org, v_type_fibre
    ),
    'Une tache recurrente ne peut pas porter le type d''un autre metier'
  );

  insert into public.recurring_tasks (organization_id, title, frequency, next_date)
  values (v_org, 'Entretien annuel PAC', 'yearly', '2026-12-01');

  perform pg_temp.ok(
    exists (select 1 from public.recurring_tasks where organization_id = v_org),
    'Une tache sans type d''intervention reste acceptee'
  );
end
$$;

reset role;

-- Un technicien consulte le planning, il ne le compose pas.
select pg_temp.login('poseur');
set local role authenticated;

do $$
declare v_org uuid; v_count integer;
begin
  select id into v_org from public.organizations where slug = 'essai-planning';

  select count(*) into v_count from public.recurring_tasks;
  perform pg_temp.ok(v_count = 1, 'Le technicien consulte les taches recurrentes');

  perform pg_temp.refuses(
    format(
      $sql$ insert into public.recurring_tasks (organization_id, title, frequency, next_date)
            values (%L, 'Intrusion', 'weekly', '2026-12-02') $sql$,
      v_org
    ),
    'Le technicien ne cree pas de tache recurrente'
  );
end
$$;

reset role;

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 6 — Le moteur de conges compte les JOURS ==='; end $$;
-- =============================================================================
--
-- Le décompte était `fin − début + 1`, calculé par le navigateur. Ces
-- assertions portent sur ce que cette formule se trompait à dire.

do $$
begin
  -- Vendredi 4 → lundi 7 septembre 2026 : deux jours ouvrés, pas quatre.
  perform pg_temp.ok(
    app.compute_leave_days('2026-09-04', '2026-09-07') = 2,
    'Un week-end au milieu d''une absence n''est pas decompte'
  );

  -- Lundi 27 avril → vendredi 1er mai 2026 : le 1er mai est férié.
  perform pg_temp.ok(
    app.compute_leave_days('2026-04-27', '2026-05-01') = 4,
    'Un jour ferie n''est pas decompte'
  );

  -- Le 22 mai commémore l'abolition en Martinique, et nulle part ailleurs.
  perform pg_temp.ok(
    app.compute_leave_days('2026-05-22', '2026-05-22', 'metropole') = 1
    and app.compute_leave_days('2026-05-22', '2026-05-22', 'martinique') = 0,
    'Les feries d''outre-mer ne s''appliquent qu''a leur territoire'
  );

  perform pg_temp.ok(
    app.compute_leave_days('2026-09-07', '2026-09-07', 'metropole', true) = 0.5,
    'Une demi-journee vaut une demi-journee'
  );

  -- Pâques gouverne le lundi de Pâques, l'Ascension et la Pentecôte : la liste
  -- figée qu'on remplace serait fausse dès 2027.
  perform pg_temp.ok(
    app.easter_sunday(2026) = date '2026-04-05' and app.easter_sunday(2027) = date '2027-03-28',
    'Paques est calculee, pas recopiee'
  );

  perform pg_temp.ok(
    (select count(*) from app.public_holidays(2026, 'metropole')) = 11,
    'Le socle national compte onze feries'
  );
end
$$;

-- Le détail est vérifiable, jour par jour.
do $$
declare v_samedi record;
begin
  select * into v_samedi
  from app.leave_day_breakdown('2026-09-04', '2026-09-07')
  where day = date '2026-09-05';

  perform pg_temp.ok(
    v_samedi.counted = false and v_samedi.value = 0 and v_samedi.reason = 'Samedi',
    'Chaque journee dit si elle compte, combien, et pourquoi'
  );
end
$$;

-- Le CLIENT ne décide pas de la durée.
select pg_temp.login('poseur');
set local role authenticated;

do $$
declare v_org uuid; v_me uuid; v_days numeric;
begin
  select id into v_org from public.organizations where slug = 'essai-planning';
  v_me := pg_temp.member('essai-planning', 'poseur');

  -- Le client annonce 99 jours sur une absence vendredi → lundi.
  insert into public.leave_requests
    (organization_id, member_id, type, start_date, end_date, days_count)
  values (v_org, v_me, 'rtt', '2026-09-04', '2026-09-07', 99);

  select days_count into v_days
  from public.leave_requests
  where member_id = v_me and type = 'rtt' and start_date = date '2026-09-04';

  perform pg_temp.ok(v_days = 2,
    'Le serveur ecrase la duree annoncee par le client');
end
$$;

-- Une période sans aucun jour ouvré ne consomme rien, et se refuse.
do $$
declare v_org uuid; v_me uuid;
begin
  select id into v_org from public.organizations where slug = 'essai-planning';
  v_me := pg_temp.member('essai-planning', 'poseur');

  perform pg_temp.refuses(
    format(
      $sql$ insert into public.leave_requests
              (organization_id, member_id, type, start_date, end_date, days_count)
            values (%L, %L, 'unpaid', '2026-09-05', '2026-09-06', 2) $sql$,
      v_org, v_me
    ),
    'Un week-end entier ne peut pas etre pose comme conge'
  );
end
$$;

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
