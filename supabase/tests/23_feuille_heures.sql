-- =============================================================================
-- 23 — Feuille d'heures : temps hors intervention, journées, semaines, clôture
-- =============================================================================
--
-- Ce que cette suite prouve :
--
--   1. les heures contractuelles : 35 par défaut, surchargeables par membre,
--      bornées ;
--   2. le temps hors intervention obéit aux règles des segments d'intervention :
--      pour soi-même le serveur pose l'heure, un seul chronomètre par personne
--      toutes tables confondues, un segment clos est immuable, pas de
--      suppression ; qui gère la feuille corrige avec des horaires explicites,
--      sans chevauchement, et laisse une trace ;
--   3. le trajet se termine quand l'intervention commence ;
--   4. les journées sont découpées à minuit DANS LE FUSEAU DE L'ENTREPRISE, les
--      semaines comparent au contrat, chacun ne voit que les siennes sans
--      `timesheet.view_all` ;
--   5. la clôture fige le mois : plus rien n'entre, ne sort ni ne bouge ; elle
--      refuse un chronomètre encore ouvert ; ses totaux sont un instantané ;
--      la réouverture est journalisée et une seconde clôture repart des
--      chiffres à jour ;
--   6. une autre entreprise ne voit rien et ne clôture rien.
--
-- Transaction annulée. Rien ne reste en base.
-- =============================================================================

begin;
set local search_path = pg_temp, public;

-- @inclure communs/organisation-abonnee.sql

insert into t_ids (k, v) values
  ('patron',   '00000000-0000-4000-8000-000000230001'),
  ('chef',     '00000000-0000-4000-8000-000000230002'),
  ('tech_a',   '00000000-0000-4000-8000-000000230003'),
  ('tech_b',   '00000000-0000-4000-8000-000000230004'),
  ('patron_b', '00000000-0000-4000-8000-000000230005');
select pg_temp.creer_comptes();

create temporary table t_ctx (
  org_id uuid, autre_org_id uuid, membre_a uuid, membre_b uuid,
  interv_a uuid, interv_b uuid, trajet uuid, cloture uuid
);
grant select, update on t_ctx to authenticated;
insert into t_ctx (org_id, autre_org_id)
values (pg_temp.organisation_abonnee('heures-a', 'Heures A', 'patron', 'business'),
        pg_temp.organisation_abonnee('heures-b', 'Heures B', 'patron_b', 'business'));

select pg_temp.ajouter_membre(org_id, 'chef', 'team_leader') from t_ctx;
select pg_temp.ajouter_membre(org_id, 'tech_a', 'technician') from t_ctx;
select pg_temp.ajouter_membre(org_id, 'tech_b', 'technician') from t_ctx;
update t_ctx set
  membre_a = (select id from public.organization_members where user_id = pg_temp.uid('tech_a')),
  membre_b = (select id from public.organization_members where user_id = pg_temp.uid('tech_b'));

-- L'entreprise A travaille en Martinique (UTC−4, sans heure d'été).
update public.organizations set timezone = 'America/Martinique' where id = (select org_id from t_ctx);

-- Une mission et une intervention par technicien : celle de tech_a porte
-- l'histoire d'août, celle de tech_b sert au chronomètre.
do $$ declare v_m uuid; v_i uuid; begin
  insert into public.missions (organization_id, title, scheduled_start, scheduled_end, created_by, assigned_user_id, status)
  select org_id, 'Chantier A', '2026-08-03 12:00+00', '2026-08-05 06:00+00', pg_temp.uid('patron'), membre_a, 'in_progress'
  from t_ctx returning id into v_m;
  insert into public.interventions (mission_id, organization_id, technician_id, status)
  select v_m, org_id, membre_a, 'in_progress' from t_ctx returning id into v_i;
  update t_ctx set interv_a = v_i;

  insert into public.missions (organization_id, title, scheduled_start, scheduled_end, created_by, assigned_user_id, status)
  select org_id, 'Chantier B', now() - interval '1 hour', now() + interval '3 hours', pg_temp.uid('patron'), membre_b, 'assigned'
  from t_ctx returning id into v_m;
  insert into public.interventions (mission_id, organization_id, technician_id, status)
  select v_m, org_id, membre_b, 'in_progress' from t_ctx returning id into v_i;
  update t_ctx set interv_b = v_i;
end $$;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 1 — les heures contractuelles ==='; end $$;
-- =============================================================================

select pg_temp.ok((select weekly_hours from public.organizations where id = (select org_id from t_ctx)) = 35,
  '35 heures par defaut pour l''organisation');
select pg_temp.ok((select weekly_hours from public.organization_members where id = (select membre_a from t_ctx)) is null,
  'un membre sans surcharge suit l''organisation');

update public.organization_members set weekly_hours = 28 where id = (select membre_b from t_ctx);
select pg_temp.refuses(
  format($q$update public.organization_members set weekly_hours = 0 where id = %L$q$, (select membre_a from t_ctx)),
  'zero heure par semaine est refuse');
select pg_temp.refuses(
  format($q$update public.organizations set weekly_hours = 70 where id = %L$q$, (select org_id from t_ctx)),
  'soixante-dix heures par semaine est refuse');

-- =============================================================================
do $$ begin raise notice '=== PARTIE 2 — le temps hors intervention, memes regles ==='; end $$;
-- =============================================================================

select pg_temp.login('tech_a'); set local role authenticated;
do $$ declare v public.work_time_entries; begin
  -- Un horaire fourni par le navigateur n'est jamais retenu.
  insert into public.work_time_entries (member_id, kind, started_at, ended_at)
  select membre_a, 'travel', now() - interval '3 hours', now() - interval '2 hours' from t_ctx
  returning * into v;
  perform pg_temp.ok(v.started_at = now() and v.ended_at is null, 'pour soi-meme, le serveur pose l''heure et ouvre le segment');
  perform pg_temp.ok(v.organization_id = (select org_id from t_ctx) and v.member_user_id = pg_temp.uid('tech_a'),
    'organisation et compte derives de l''appartenance');
  update t_ctx set trajet = v.id;

  perform pg_temp.refuses(
    format($q$insert into public.work_time_entries (member_id, kind) values (%L, 'workshop')$q$, (select membre_a from t_ctx)),
    'un second segment ouvert pour la meme personne est refuse');
  perform pg_temp.refuses(
    format($q$update public.work_time_entries set kind = 'workshop' where id = %L$q$, v.id),
    'changer autre chose que la cloture est refuse');
  perform pg_temp.refuses(
    format($q$insert into public.work_time_entries (member_id, kind) values (%L, 'travel')$q$, (select membre_b from t_ctx)),
    'saisir du temps pour quelqu''un d''autre est refuse');

  update public.work_time_entries set ended_at = now() - interval '1 hour' where id = v.id returning * into v;
  perform pg_temp.ok(v.ended_at = now(), 'la cloture pose l''heure du serveur, pas celle du client');

  perform pg_temp.refuses(
    format($q$update public.work_time_entries set ended_at = null where id = %L$q$, v.id),
    'un segment clos ne se rouvre pas');
  -- La RLS filtre en silence : la suppression ne touche rien.
  delete from public.work_time_entries where id = v.id;
  perform pg_temp.ok(exists (select 1 from public.work_time_entries where id = v.id), 'un salarie ne supprime pas son temps');
  perform pg_temp.ok(public.stop_work_time() is null, 'stop_work_time sans chronometre ouvert ne renvoie rien');
end $$;
reset role;

-- Ce segment (now → now, durée nulle) ne gêne pas la suite ; le chef l'efface
-- pour garder des chiffres lisibles — et cette suppression est tracée.
select pg_temp.login('chef'); set local role authenticated;
delete from public.work_time_entries where id = (select trajet from t_ctx);
reset role;
-- Le journal se lit avec `audit.view` (patron), pas depuis un chef d'équipe :
-- les traces se vérifient hors rôle.
select pg_temp.ok(not exists (select 1 from public.work_time_entries where id = (select trajet from t_ctx))
  and exists (select 1 from public.audit_logs where action = 'timesheet.entry_deleted' and entity_id = (select trajet from t_ctx)),
  'qui gere la feuille supprime, et la suppression est tracee');

-- Le chef corrige un oubli : horaires explicites, trace au journal.
select pg_temp.login('chef'); set local role authenticated;
do $$ declare v public.work_time_entries; begin
  insert into public.work_time_entries (member_id, kind, started_at, ended_at, note)
  select membre_a, 'travel', '2026-08-03 11:15+00', '2026-08-03 12:00+00', 'Oubli du lundi' from t_ctx
  returning * into v;
  perform pg_temp.ok(v.started_at = '2026-08-03 11:15+00', 'qui gere la feuille pose des horaires explicites');
  update t_ctx set trajet = v.id;

  perform pg_temp.refuses(
    format($q$insert into public.work_time_entries (member_id, kind, started_at, ended_at) values (%L, 'workshop', '2026-08-03 11:30+00', '2026-08-03 12:30+00')$q$, (select membre_a from t_ctx)),
    'un chevauchement avec son propre temps est refuse');
  perform pg_temp.refuses(
    format($q$insert into public.work_time_entries (member_id, kind, started_at, ended_at) values (%L, 'workshop', now() + interval '1 hour', now() + interval '2 hours')$q$, (select membre_a from t_ctx)),
    'un segment dans le futur est refuse');
  perform pg_temp.refuses(
    format($q$insert into public.work_time_entries (member_id, kind, started_at, ended_at) values (%L, 'workshop', '2026-08-03 08:00+00', '2026-08-04 09:00+00')$q$, (select membre_a from t_ctx)),
    'plus de vingt-quatre heures d''un bloc est refuse');
end $$;
reset role;
select pg_temp.ok(exists (select 1 from public.audit_logs
  where action = 'timesheet.entry_declared' and entity_id = (select trajet from t_ctx) and user_id = pg_temp.uid('chef')),
  'une declaration pour un tiers laisse une trace');

-- =============================================================================
do $$ begin raise notice '=== PARTIE 3 — le trajet se termine quand l''intervention commence ==='; end $$;
-- =============================================================================

select pg_temp.login('tech_b'); set local role authenticated;
do $$ declare v_i public.intervention_time_entries; v_w public.work_time_entries; begin
  v_i := public.switch_intervention_time_entry((select interv_b from t_ctx), 'work');
  perform pg_temp.ok(v_i.ended_at is null, 'le chronometre d''intervention est ouvert');

  perform pg_temp.refuses(
    format($q$insert into public.work_time_entries (member_id, kind) values (%L, 'travel')$q$, (select membre_b from t_ctx)),
    'ouvrir un trajet a la main pendant une intervention est refuse');

  -- Par la fonction : le chronomètre d'intervention se ferme, le trajet s'ouvre.
  v_w := public.start_work_time((select org_id from t_ctx), 'travel', 'Retour depot');
  perform pg_temp.ok(v_w.ended_at is null and v_w.kind = 'travel', 'start_work_time ouvre le trajet');
  perform pg_temp.ok((select ended_at from public.intervention_time_entries where id = v_i.id) is not null,
    'start_work_time a ferme le chronometre d''intervention');

  -- Et dans l'autre sens : l'intervention démarre, le trajet se termine tout seul.
  v_i := public.switch_intervention_time_entry((select interv_b from t_ctx), 'work');
  perform pg_temp.ok((select ended_at from public.work_time_entries where id = v_w.id) is not null,
    'demarrer l''intervention a ferme le trajet');
  update public.intervention_time_entries set ended_at = now() where id = v_i.id;
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 4 — journees, semaines, fuseau ==='; end $$;
-- =============================================================================

-- Fixture historique : des segments d'intervention datés en août 2026. Le
-- garde force l'heure du serveur — on le lève le temps de poser l'histoire,
-- comme l'a fait la migration 20260910011102 pour reprendre l'existant.
alter table public.intervention_time_entries disable trigger intervention_time_entries_enforce;
insert into public.intervention_time_entries (intervention_id, organization_id, technician_id, technician_user_id, kind, started_at, ended_at)
select interv_a, org_id, membre_a, pg_temp.uid('tech_a'), k, s, e
from t_ctx, (values
  -- Lundi 3 août, Martinique : 8h–12h, pause, 13h–17h.
  ('work'::public.time_entry_kind,  '2026-08-03 12:00+00'::timestamptz, '2026-08-03 16:00+00'::timestamptz),
  ('pause',                         '2026-08-03 16:00+00',              '2026-08-03 17:00+00'),
  ('work',                          '2026-08-03 17:00+00',              '2026-08-03 21:00+00'),
  -- Nuit du 4 au 5 août : 22h → 2h locales, soit 02:00Z → 06:00Z le 5 en UTC.
  ('work',                          '2026-08-05 02:00+00',              '2026-08-05 06:00+00')
) as f(k, s, e);
alter table public.intervention_time_entries enable trigger intervention_time_entries_enforce;

-- Congés de tech_a : 10–11 août (2 jours) ; 31 août–1er septembre (2 jours, à
-- cheval). Déposés par lui, validés par le patron.
select pg_temp.login('tech_a'); set local role authenticated;
insert into public.leave_requests (organization_id, member_id, type, start_date, end_date, days_count)
select org_id, membre_a, 'paid_leave', date '2026-08-10', date '2026-08-11', 2 from t_ctx;
insert into public.leave_requests (organization_id, member_id, type, start_date, end_date, days_count)
select org_id, membre_a, 'rtt', date '2026-08-31', date '2026-09-01', 2 from t_ctx;
reset role;
select pg_temp.login('patron'); set local role authenticated;
update public.leave_requests set status = 'approved' where member_id = (select membre_a from t_ctx);
reset role;

-- tech_a à 10 h par semaine : les 765 minutes de la semaine dépassent.
update public.organization_members set weekly_hours = 10 where id = (select membre_a from t_ctx);

select pg_temp.login('chef'); set local role authenticated;
do $$ declare d record; w record; begin
  select * into d from public.timesheet_days where member_id = (select membre_a from t_ctx) and day = '2026-08-03';
  perform pg_temp.ok(d.intervention_minutes = 480 and d.other_minutes = 45 and d.total_minutes = 525 and d.on_leave = false,
    'lundi 3 aout : 480 min d''intervention, 45 de trajet, la pause exclue');

  select * into d from public.timesheet_days where member_id = (select membre_a from t_ctx) and day = '2026-08-04';
  perform pg_temp.ok(d.total_minutes = 120, 'la nuit du 4 : 120 min avant minuit, dans le fuseau de l''entreprise');
  select * into d from public.timesheet_days where member_id = (select membre_a from t_ctx) and day = '2026-08-05';
  perform pg_temp.ok(d.total_minutes = 120, 'la nuit du 5 : 120 min apres minuit');

  select * into w from public.timesheet_weeks where member_id = (select membre_a from t_ctx) and week_start = '2026-08-03';
  perform pg_temp.ok(w.total_minutes = 765 and w.contract_minutes = 600 and w.overtime_minutes = 165,
    'semaine du 3 aout : 765 min, contrat 600, depassement 165');

  perform pg_temp.ok((select count(distinct member_id) from public.timesheet_month((select org_id from t_ctx), '2026-08-15')) = 4,
    'timesheet_month avec view_all : les quatre membres actifs');
  perform pg_temp.ok((select count(*) from public.timesheet_month((select org_id from t_ctx), '2026-08-01') where member_id = (select membre_a from t_ctx)) = 31,
    'trente et un jours pour aout, travailles ou non');
  select * into d from public.timesheet_month((select org_id from t_ctx), '2026-08-01') where member_id = (select membre_a from t_ctx) and day = '2026-08-10';
  perform pg_temp.ok(d.on_leave and d.leave_type = 'paid_leave' and d.total_minutes = 0 and d.closed = false,
    'le 10 aout : en conge paye, zero minute, mois ouvert');
end $$;
reset role;

select pg_temp.login('tech_a'); set local role authenticated;
select pg_temp.ok((select count(distinct member_id) from public.timesheet_days) = 1
  and (select count(distinct member_id) from public.timesheet_month((select org_id from t_ctx), '2026-08-01')) = 1,
  'sans view_all, tech_a ne voit que sa feuille');
select pg_temp.ok((select count(*) from public.work_time_entries where member_id = (select membre_b from t_ctx)) = 0,
  'tech_a ne voit pas le temps de tech_b');
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 5 — la cloture ==='; end $$;
-- =============================================================================

select pg_temp.login('tech_a'); set local role authenticated;
select pg_temp.refuses(
  format($q$select public.close_timesheet_month(%L, %L, '2026-08-01')$q$, (select org_id from t_ctx), (select membre_a from t_ctx)),
  'un technicien ne cloture pas');
reset role;

select pg_temp.login('chef'); set local role authenticated;
do $$ declare c public.timesheet_closures; v public.work_time_entries; begin
  perform pg_temp.refuses(
    format($q$select public.close_timesheet_month(%L, %L, %L)$q$, (select org_id from t_ctx), (select membre_a from t_ctx), date_trunc('month', current_date)::date),
    'le mois en cours ne se cloture pas');

  -- Un chronomètre oublié en août chez tech_b.
  insert into public.work_time_entries (member_id, kind, started_at)
  select membre_b, 'workshop', '2026-08-20 14:00+00' from t_ctx returning * into v;
  perform pg_temp.refuses(
    format($q$select public.close_timesheet_month(%L, %L, '2026-08-01')$q$, (select org_id from t_ctx), (select membre_b from t_ctx)),
    'un segment encore ouvert sur le mois empeche la cloture');
  update public.work_time_entries set ended_at = '2026-08-20 15:00+00' where id = v.id;
  c := public.close_timesheet_month((select org_id from t_ctx), (select membre_b from t_ctx), '2026-08-01');
  perform pg_temp.ok(c.total_minutes = 60 and c.leave_days = 0, 'aout de tech_b clos : 60 minutes, aucun conge');

  c := public.close_timesheet_month((select org_id from t_ctx), (select membre_a from t_ctx), '2026-08-15', 'Envoye en paie');
  perform pg_temp.ok(c.month = '2026-08-01' and c.intervention_minutes = 720 and c.other_minutes = 45 and c.total_minutes = 765,
    'aout de tech_a clos : 720 min d''intervention, 45 de trajet');
  perform pg_temp.ok(c.leave_days = 3.0, 'trois jours de conge : deux entiers, un au prorata de la demande a cheval');
  perform pg_temp.ok(c.closed_by = pg_temp.uid('chef') and c.note = 'Envoye en paie', 'la cloture porte son auteur et sa note');
  update t_ctx set cloture = c.id;

  perform pg_temp.ok((select closed from public.timesheet_month((select org_id from t_ctx), '2026-08-01')
                      where member_id = (select membre_a from t_ctx) and day = '2026-08-03'),
    'timesheet_month dit que le mois est clos');

  -- Plus rien ne bouge.
  perform pg_temp.refuses(
    format($q$insert into public.work_time_entries (member_id, kind, started_at, ended_at) values (%L, 'travel', '2026-08-12 11:00+00', '2026-08-12 12:00+00')$q$, (select membre_a from t_ctx)),
    'ajouter du temps sur un mois clos est refuse');
  perform pg_temp.refuses(
    format($q$update public.work_time_entries set ended_at = '2026-08-03 12:30+00' where id = %L$q$, (select trajet from t_ctx)),
    'modifier un segment d''un mois clos est refuse');
  perform pg_temp.refuses(
    format($q$delete from public.work_time_entries where id = %L$q$, (select trajet from t_ctx)),
    'supprimer un segment d''un mois clos est refuse');
  perform pg_temp.refuses(
    format($q$select public.close_timesheet_month(%L, %L, '2026-08-01')$q$, (select org_id from t_ctx), (select membre_a from t_ctx)),
    'clore deux fois le meme mois est refuse');

  -- Un segment de septembre ne peut pas être déplacé en août.
  insert into public.work_time_entries (member_id, kind, started_at, ended_at)
  select membre_a, 'workshop', '2026-09-02 12:00+00', '2026-09-02 13:00+00' from t_ctx returning * into v;
  perform pg_temp.refuses(
    format($q$update public.work_time_entries set started_at = '2026-08-13 12:00+00', ended_at = '2026-08-13 13:00+00' where id = %L$q$, v.id),
    'deplacer un segment vers un mois clos est refuse');
end $$;
reset role;

select pg_temp.login('tech_a'); set local role authenticated;
-- Par l'intervenant lui-même, sur sa propre intervention : sans le garde de
-- mois clos, ce segment serait accepté (l'heure serait simplement remplacée).
select pg_temp.refuses(
  format($q$insert into public.intervention_time_entries (intervention_id, organization_id, kind, started_at) values (%L, %L, 'work', '2026-08-12 11:00+00')$q$,
    (select interv_a from t_ctx), (select org_id from t_ctx)),
  'un segment d''intervention sur un mois clos est refuse');
select pg_temp.refuses(
  format($q$select public.reopen_timesheet_month(%L)$q$, (select cloture from t_ctx)),
  'un technicien ne rouvre pas');
select pg_temp.ok((select count(*) from public.timesheet_closures where member_id = (select membre_a from t_ctx)) = 1
  and (select count(*) from public.timesheet_closures where member_id = (select membre_b from t_ctx)) = 0,
  'tech_a voit sa cloture, pas celle de tech_b');
reset role;

select pg_temp.login('chef'); set local role authenticated;
do $$ declare c public.timesheet_closures; begin
  c := public.reopen_timesheet_month((select cloture from t_ctx), 'Trajet oublie');
  perform pg_temp.ok(c.reopened_at is not null and c.reopened_by = pg_temp.uid('chef') and c.note = 'Trajet oublie',
    'la reouverture est datee, signee, annotee');
  perform pg_temp.refuses(
    format($q$select public.reopen_timesheet_month(%L)$q$, c.id),
    'rouvrir deux fois est refuse');

  insert into public.work_time_entries (member_id, kind, started_at, ended_at)
  select membre_a, 'travel', '2026-08-12 11:00+00', '2026-08-12 12:00+00' from t_ctx;

  c := public.close_timesheet_month((select org_id from t_ctx), (select membre_a from t_ctx), '2026-08-01');
  perform pg_temp.ok(c.total_minutes = 825 and c.other_minutes = 105, 'la seconde cloture repart des chiffres a jour');
  perform pg_temp.ok((select count(*) from public.timesheet_closures where member_id = (select membre_a from t_ctx) and month = '2026-08-01') = 2,
    'les deux clotures restent en historique');
end $$;
reset role;
select pg_temp.ok((select count(*) from public.audit_logs where action = 'timesheet.closed' and entity_type = 'timesheet_closure') = 3
  and exists (select 1 from public.audit_logs where action = 'timesheet.reopened' and entity_id = (select cloture from t_ctx)),
  'clotures et reouverture sont journalisees');

-- =============================================================================
do $$ begin raise notice '=== PARTIE 6 — une autre entreprise ==='; end $$;
-- =============================================================================

select pg_temp.login('patron_b'); set local role authenticated;
select pg_temp.ok((select count(*) from public.timesheet_days) = 0
  and (select count(*) from public.timesheet_closures) = 0
  and (select count(*) from public.timesheet_month((select org_id from t_ctx), '2026-08-01')) = 0,
  'l''entreprise B ne voit rien de l''entreprise A');
select pg_temp.refuses(
  format($q$select public.close_timesheet_month(%L, %L, '2026-07-01')$q$, (select org_id from t_ctx), (select membre_a from t_ctx)),
  'l''entreprise B ne cloture pas chez A');
select pg_temp.refuses(
  format($q$insert into public.work_time_entries (member_id, kind) values (%L, 'travel')$q$, (select membre_a from t_ctx)),
  'l''entreprise B ne saisit pas chez A');
reset role;

select 'TOUS LES TESTS PASSENT' as resultat;

rollback;
