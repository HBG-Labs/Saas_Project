-- =============================================================================
-- 21 — Planning : conflits d'affectation, récurrences
-- =============================================================================
--
-- Ce que cette suite prouve :
--
--   1. un congé validé est un mur : l'affectation est refusée, à la mission
--      comme à la ligne d'affectation ;
--   2. un chevauchement de missions est refusé, sauf reconnu explicitement ;
--   3. `mission_conflicts` dit à l'écran ce que le garde refusera ;
--   4. valider un congé sur une mission affectée est refusé : on réaffecte d'abord ;
--   5. le générateur crée les missions échues, trace chaque occurrence, avance
--      la date, ne crée jamais deux fois la même visite, et pose l'heure dans
--      le fuseau de l'entreprise ;
--   6. un refus (quota, conflit) est tracé « skipped » sans avancer la date.
--
-- Transaction annulée. Rien ne reste en base.
-- =============================================================================

begin;
set local search_path = pg_temp, public;

-- @inclure communs/organisation-abonnee.sql

insert into t_ids (k, v) values
  ('patron',     '00000000-0000-4000-8000-000000210001'),
  ('tech_a',     '00000000-0000-4000-8000-000000210002'),
  ('tech_b',     '00000000-0000-4000-8000-000000210003'),
  ('patron_b',   '00000000-0000-4000-8000-000000210004');
select pg_temp.creer_comptes();

create temporary table t_ctx (org_id uuid, autre_org_id uuid, membre_a uuid, membre_b uuid, m1 uuid, m2 uuid, tache uuid);
grant select, update on t_ctx to authenticated;
insert into t_ctx (org_id, autre_org_id)
values (pg_temp.organisation_abonnee('planning-a', 'Planning A', 'patron', 'business'),
        pg_temp.organisation_abonnee('planning-b', 'Planning B', 'patron_b', 'free'));

select pg_temp.ajouter_membre(org_id, 'tech_a', 'technician') from t_ctx;
select pg_temp.ajouter_membre(org_id, 'tech_b', 'technician') from t_ctx;
update t_ctx set
  membre_a = (select id from public.organization_members where user_id = pg_temp.uid('tech_a')),
  membre_b = (select id from public.organization_members where user_id = pg_temp.uid('tech_b'));

-- L'entreprise A travaille en Martinique.
update public.organizations set timezone = 'America/Martinique' where id = (select org_id from t_ctx);

create function pg_temp.mission(p_titre text, p_debut timestamptz, p_fin timestamptz) returns uuid
language plpgsql as $$
declare v uuid;
begin
  insert into public.missions (organization_id, title, scheduled_start, scheduled_end, created_by)
  select org_id, p_titre, p_debut, p_fin, pg_temp.uid('patron') from t_ctx returning id into v;
  return v;
end $$;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 1 — le congé validé est un mur ==='; end $$;
-- =============================================================================

-- Congé de tech_a du 5 au 7 octobre : déposé par lui (une demande naît en
-- attente, par son titulaire), validé par le patron (leave.approve, jamais
-- sur soi-même) — les règles d'`enforce_leave_decision`.
select pg_temp.login('tech_a'); set local role authenticated;
insert into public.leave_requests (organization_id, member_id, type, start_date, end_date, days_count)
select org_id, membre_a, 'paid_leave', date '2026-10-05', date '2026-10-07', 3 from t_ctx;
reset role;
select pg_temp.login('patron'); set local role authenticated;
update public.leave_requests set status = 'approved' where member_id = (select membre_a from t_ctx);
reset role;

select pg_temp.login('patron'); set local role authenticated;
do $$ declare v uuid; begin
  v := pg_temp.mission('Pendant le conge', '2026-10-06 09:00+00', '2026-10-06 11:00+00');
  update t_ctx set m1 = v;

  perform pg_temp.refuses(
    format($q$update public.missions set assigned_user_id = %L, status = 'assigned' where id = %L$q$, (select membre_a from t_ctx), v),
    'affecter un technicien en conge valide est refuse');

  perform pg_temp.refuses(
    format($q$insert into public.mission_assignments (mission_id, member_id) values (%L, %L)$q$, v, (select membre_a from t_ctx)),
    'meme par la ligne d''affectation directe');

  perform pg_temp.refuses(
    format($q$update public.missions set assigned_user_id = %L, status = 'assigned', schedule_conflict_acknowledged = true where id = %L$q$, (select membre_a from t_ctx), v),
    'et reconnaitre le chevauchement n''y change rien : un conge ne se force pas');

  update public.missions set assigned_user_id = (select membre_b from t_ctx), status = 'assigned' where id = v;
  perform pg_temp.ok(true, 'tech_b, libre, est affecte sans difficulte');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 2 — deux missions, un technicien ==='; end $$;
-- =============================================================================

select pg_temp.login('patron'); set local role authenticated;
do $$ declare v uuid; begin
  -- tech_b est sur m1 le 6/10 de 09:00 à 11:00. Une seconde mission 10:00-12:00.
  v := pg_temp.mission('Chevauche m1', '2026-10-06 10:00+00', '2026-10-06 12:00+00');
  update t_ctx set m2 = v;

  perform pg_temp.refuses(
    format($q$update public.missions set assigned_user_id = %L, status = 'assigned' where id = %L$q$, (select membre_b from t_ctx), v),
    'un chevauchement non reconnu est refuse');

  update public.missions set assigned_user_id = (select membre_b from t_ctx), status = 'assigned', schedule_conflict_acknowledged = true where id = v;
  perform pg_temp.ok(
    (select assigned_user_id = (select membre_b from t_ctx) from public.missions where id = v),
    'reconnu, il passe');

  -- Une mission SANS fin compte pour une heure.
  update public.missions set scheduled_start = '2026-10-06 12:30+00', scheduled_end = null, schedule_conflict_acknowledged = false where id = v;
  perform pg_temp.ok(true, 'deplacee a 12:30 sans fin : plus de chevauchement avec 09:00-11:00 (fenetre d''une heure)');
  perform pg_temp.refuses(
    format($q$update public.missions set scheduled_start = '2026-10-06 10:30+00' where id = %L$q$, v),
    'ramenee a 10:30 sans fin : 10:30-11:30 chevauche, refuse');

  -- Renommer ne redeclenche rien.
  update public.missions set title = 'Renommee' where id = v;
  perform pg_temp.ok(true, 'modifier le titre ne rejoue pas le controle');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 3 — ce que l''ecran peut montrer ==='; end $$;
-- =============================================================================

select pg_temp.login('patron'); set local role authenticated;
do $$ declare n_missions int; n_conges int; begin
  select count(*) filter (where kind = 'mission'), count(*) filter (where kind = 'leave')
    into n_missions, n_conges
  from public.mission_conflicts((select membre_b from t_ctx), '2026-10-06 09:30+00', '2026-10-06 10:30+00', null);
  perform pg_temp.ok(n_missions = 1 and n_conges = 0, 'tech_b sur 09:30-10:30 : une mission genante, aucun conge');

  select count(*) filter (where kind = 'leave') into n_conges
  from public.mission_conflicts((select membre_a from t_ctx), '2026-10-07 14:00+00', '2026-10-07 15:00+00', null);
  perform pg_temp.ok(n_conges = 1, 'tech_a le 7/10 : son conge apparait');

  perform pg_temp.ok(
    (select count(*) = 0 from public.mission_conflicts((select membre_b from t_ctx), '2026-10-06 09:30+00', '2026-10-06 10:30+00', (select m1 from t_ctx))),
    'en excluant la mission qu''on edite, plus rien ne gene');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 4 — valider un conge sur une mission affectee ==='; end $$;
-- =============================================================================

-- tech_b est affecte sur m1 le 6/10. Il demande un RTT ce jour-la.
select pg_temp.login('tech_b'); set local role authenticated;
insert into public.leave_requests (organization_id, member_id, type, start_date, end_date, days_count)
select org_id, membre_b, 'rtt', date '2026-10-06', date '2026-10-06', 1 from t_ctx;
reset role;
do $$ begin perform pg_temp.ok(true, 'la demande est deposee : demander n''est pas valider'); end $$;

select pg_temp.login('patron'); set local role authenticated;
do $$ declare v_leave uuid; begin
  select id into v_leave from public.leave_requests where member_id = (select membre_b from t_ctx);

  perform pg_temp.refuses(
    format($q$update public.leave_requests set status = 'approved' where id = %L$q$, v_leave),
    'la valider est refuse tant que la mission est affectee a cette personne');

  -- tech_b est sur DEUX missions ce jour-la (m1, et m2 depuis la partie 2) :
  -- le garde l'a rappele — on libere les deux. tech_a etant lui-meme en
  -- conge, on ne reaffecte personne.
  update public.missions set assigned_user_id = null where id in (select m1 from t_ctx union select m2 from t_ctx);
  update public.leave_requests set status = 'approved' where id = v_leave;
  perform pg_temp.ok(true, 'les missions liberees, le conge se valide');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 5 — le generateur ==='; end $$;
-- =============================================================================

do $$ declare v uuid; begin
  insert into public.recurring_tasks (organization_id, title, frequency, next_date, assigned_member_id, estimated_minutes, created_by, is_active)
  select org_id, 'Entretien climatisation', 'monthly', current_date + 3, membre_a, 90, pg_temp.uid('patron'), true from t_ctx
  returning id into v;
  update t_ctx set tache = v;
end $$;

do $$ declare r record; v_m public.missions; begin
  select * into r from app.generate_recurring_missions(14);
  -- Le generateur est GLOBAL : sur la base liee, d'autres organisations ont
  -- leurs propres taches echues (creees puis annulees avec la transaction).
  -- On ne compte donc que la notre.
  perform pg_temp.ok(r.created >= 1,
    format('une tache echue dans l''horizon : au moins une mission creee (created=%s skipped=%s)', r.created, r.skipped));
  perform pg_temp.ok(
    (select count(*) = 1 from public.recurring_task_occurrences where recurring_task_id = (select tache from t_ctx) and status = 'created'),
    'la notre a exactement une occurrence, creee');

  select m.* into v_m from public.missions m
  join public.recurring_task_occurrences o on o.mission_id = m.id
  where o.recurring_task_id = (select tache from t_ctx);
  perform pg_temp.ok(v_m.status = 'assigned' and v_m.assigned_user_id = (select membre_a from t_ctx),
    'affectee au technicien de la tache');
  perform pg_temp.ok(
    (v_m.scheduled_start at time zone 'America/Martinique')::time = time '08:00'
      and v_m.scheduled_end - v_m.scheduled_start = interval '90 minutes',
    'a 08:00 heure de Martinique, pour la duree estimee');
  perform pg_temp.ok(
    exists (select 1 from public.mission_assignments a where a.mission_id = v_m.id and a.member_id = (select membre_a from t_ctx)),
    'avec sa ligne d''affectation, comme depuis l''ecran');
  perform pg_temp.ok(
    (select next_date = current_date + 3 + interval '1 month' and generated_count = 1 and last_generated_on = current_date + 3
       from public.recurring_tasks where id = (select tache from t_ctx)),
    'la date avance d''un mois, le compteur aussi');

  perform app.generate_recurring_missions(14);
  perform pg_temp.ok(true, 'repasser : la prochaine date de notre tache est hors horizon');
  perform pg_temp.ok(
    (select count(*) = 1 from public.recurring_task_occurrences where recurring_task_id = (select tache from t_ctx)),
    'et une seule occurrence existe');
end $$;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 6 — un refus est trace, la date n''avance pas ==='; end $$;
-- =============================================================================

do $$ declare v uuid; r record; begin
  -- tech_a est en conge du 5 au 7/10 : une tache qui tombe le 6/10 lui est
  -- affectee → le garde refuse, le generateur trace « skipped ».
  insert into public.recurring_tasks (organization_id, title, frequency, next_date, assigned_member_id, created_by, is_active)
  select org_id, 'Visite pendant le conge', 'weekly', date '2026-10-06', membre_a, pg_temp.uid('patron'), true from t_ctx
  returning id into v;

  select * into r from app.generate_recurring_missions(365);
  perform pg_temp.ok(r.skipped >= 1, 'une occurrence a ete ignoree');
  perform pg_temp.ok(
    (select status = 'skipped' and reason like '%congé%' from public.recurring_task_occurrences
      where recurring_task_id = v and occurrence_date = date '2026-10-06'),
    'tracee avec sa raison : le conge');
  perform pg_temp.ok(
    (select next_date = date '2026-10-06' and generated_count = 0 from public.recurring_tasks where id = v),
    'la date n''a pas avance : elle sera retentee');
end $$;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 7 — le fuseau ==='; end $$;
-- =============================================================================

do $$ begin
  perform pg_temp.refuses(
    format($q$update public.organizations set timezone = 'Mars/Olympus' where id = %L$q$, (select org_id from t_ctx)),
    'un fuseau inconnu est refuse');
  update public.organizations set timezone = 'Indian/Reunion' where id = (select org_id from t_ctx);
  perform pg_temp.ok(true, 'un fuseau IANA valide passe');
end $$;

do $$ begin
  raise notice '';
  raise notice ' TOUS LES TESTS PASSENT';
end $$;

select 'TOUS LES TESTS PASSENT' as resultat;

rollback;
