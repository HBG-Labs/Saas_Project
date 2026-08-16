-- =============================================================================
-- SUITE DE TESTS — planning, congés et géolocalisation
-- =============================================================================
-- Rejoue les garanties posées par les migrations `20260816*` :
--
--   demande de congé → décision par un tiers → solde ; position déclarée par
--   son seul titulaire → piste purgée automatiquement
--
-- et vérifie que chacune tient CÔTÉ SERVEUR, indépendamment de l'interface.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- CE QUE CE FICHIER PROTÈGE EN PARTICULIER
--
-- Deux règles de cette architecture ne vivent PAS dans une policy, et ne
-- peuvent donc pas y vivre : « on ne statue pas sur ses propres congés » et
-- « une demande décidée est figée » portent sur une TRANSITION, pas sur un
-- état. Une policy raisonne par ligne ; ces règles comparent l'avant et
-- l'après. Elles sont dans `app.enforce_leave_decision`, et rien d'autre que ce
-- fichier ne les vérifie.
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
  if not p_condition then
    raise exception 'ECHEC : %', p_label using errcode = 'assert_failure';
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

-- Le patron dépose une demande POUR LUI, puis tente de la valider lui-même.
-- Il a pourtant `leave.approve` : c'est la séparation des pouvoirs qui
-- l'arrête, pas le manque de droit.
select pg_temp.login('patron');
set local role authenticated;

do $$
declare v_org uuid; v_moi uuid; v_leave uuid;
begin
  select id into v_org from public.organizations where slug = 'essai-planning';
  v_moi := pg_temp.member('essai-planning', 'patron');

  insert into public.leave_requests
    (organization_id, member_id, type, start_date, end_date, days_count)
  values (v_org, v_moi, 'rtt', '2026-11-02', '2026-11-02', 1)
  returning id into v_leave;

  perform pg_temp.refuses(
    format($sql$ update public.leave_requests set status = 'approved' where id = %L $sql$, v_leave),
    'Meme un proprietaire ne valide pas ses propres conges'
  );
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
begin
  select id into v_leave from public.leave_requests
  where member_id = pg_temp.member('essai-planning', 'poseur');

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
  perform pg_temp.ok(v_days = 5, 'Une decision ne reecrit pas la duree demandee');
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
do $$ begin raise notice ''; raise notice '=== PARTIE 5 — Une position n''appartient qu''a son auteur ==='; end $$;
-- =============================================================================

select pg_temp.login('poseur');
set local role authenticated;

do $$
declare v_org uuid; v_moi uuid; v_collegue uuid;
begin
  select id into v_org from public.organizations where slug = 'essai-planning';
  v_moi      := pg_temp.member('essai-planning', 'poseur');
  v_collegue := pg_temp.member('essai-planning', 'resp');

  insert into public.technician_locations
    (member_id, organization_id, latitude, longitude, presence, battery_pct)
  values (v_moi, v_org, 48.8566, 2.3522, 'on_road', 82);

  perform pg_temp.ok(
    exists (select 1 from public.technician_locations where member_id = v_moi),
    'Un intervenant declare sa propre position'
  );

  -- Le geste que rien d'autre n'empêche : écrire pour un collègue.
  perform pg_temp.refuses(
    format(
      $sql$ insert into public.technician_locations
              (member_id, organization_id, latitude, longitude)
            values (%L, %L, 48.0, 2.0) $sql$,
      v_collegue, v_org
    ),
    'Nul ne declare la position d''un collegue'
  );
end
$$;

reset role;

-- Pas même le propriétaire de l'entreprise.
select pg_temp.login('patron');
set local role authenticated;

-- Attention au piège documenté dans ARCHITECTURE.md : quand la policy exclut
-- la ligne, l'UPDATE ne touche RIEN et ne lève AUCUNE exception. Attendre une
-- erreur ici ferait échouer un test alors que la garantie tient. On teste donc
-- le RÉSULTAT — la position est-elle inchangée ? — et non la manière.
do $$
declare v_poseur uuid; v_lat double precision;
begin
  v_poseur := pg_temp.member('essai-planning', 'poseur');

  update public.technician_locations
  set latitude = 0, longitude = 0
  where member_id = v_poseur;

  select latitude into v_lat from public.technician_locations where member_id = v_poseur;

  perform pg_temp.ok(v_lat = 48.8566,
    'Un proprietaire ne reecrit pas la position de ses salaries');
  perform pg_temp.ok(v_lat is not null,
    'Il la LIT en revanche : il a location.view_all');
end
$$;

reset role;

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 6 — La piste se purge toute seule ==='; end $$;
-- =============================================================================

select pg_temp.login('poseur');
set local role authenticated;

-- Un relevé ANTIDATÉ au-delà de la fenêtre est purgé par sa propre insertion.
-- Découvert en écrivant ce test, et c'est la bonne propriété : la durée de
-- conservation ne se contourne pas en falsifiant l'horodatage.
do $$
declare v_org uuid; v_moi uuid; v_count integer;
begin
  select id into v_org from public.organizations where slug = 'essai-planning';
  v_moi := pg_temp.member('essai-planning', 'poseur');

  insert into public.technician_location_pings
    (organization_id, member_id, latitude, longitude, recorded_at)
  values (v_org, v_moi, 48.85, 2.35, now() - interval '180 days');

  select count(*) into v_count from public.technician_location_pings where member_id = v_moi;
  perform pg_temp.ok(v_count = 0,
    'Un releve antidate au-dela de la fenetre ne survit pas a son insertion');

  insert into public.technician_location_pings
    (organization_id, member_id, latitude, longitude)
  values (v_org, v_moi, 48.86, 2.36);

  select count(*) into v_count from public.technician_location_pings where member_id = v_moi;
  perform pg_temp.ok(v_count = 1, 'Un releve du jour est conserve');
end
$$;

reset role;

-- La piste vieillit ; le relevé suivant l'élague. On vieillit ici la ligne
-- hors session, faute de pouvoir attendre soixante jours.
update public.technician_location_pings
set recorded_at = now() - interval '90 days'
where member_id = pg_temp.member('essai-planning', 'poseur');

select pg_temp.login('poseur');
set local role authenticated;

do $$
declare v_org uuid; v_moi uuid; v_count integer;
begin
  select id into v_org from public.organizations where slug = 'essai-planning';
  v_moi := pg_temp.member('essai-planning', 'poseur');

  insert into public.technician_location_pings
    (organization_id, member_id, latitude, longitude)
  values (v_org, v_moi, 48.87, 2.37);

  select count(*) into v_count from public.technician_location_pings where member_id = v_moi;
  perform pg_temp.ok(v_count = 1,
    'Un nouveau releve purge ceux de plus de soixante jours (CNIL)');

  select count(*) into v_count from public.technician_location_pings
  where member_id = v_moi and recorded_at < now() - interval '60 days';
  perform pg_temp.ok(v_count = 0, 'Plus aucun releve au-dela de la fenetre de conservation');
end
$$;

-- Cesser de partager est un droit : aucune permission demandée.
do $$
declare v_moi uuid;
begin
  v_moi := pg_temp.member('essai-planning', 'poseur');

  delete from public.technician_locations where member_id = v_moi;

  perform pg_temp.ok(
    not exists (select 1 from public.technician_locations where member_id = v_moi),
    'Un intervenant cesse de partager sa position quand il le decide'
  );
end
$$;

reset role;

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 7 — Coherence metier des taches recurrentes ==='; end $$;
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
