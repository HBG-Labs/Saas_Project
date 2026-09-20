-- Retour arrière de 20260930090000_gestion_planning.sql — À LA MAIN, JAMAIS PAR db push.
-- Supprime les occurrences tracées et le fuseau ; les missions générées restent (ce sont des missions).
begin;
select cron.unschedule('recurring-missions-generate');
drop function if exists public.run_recurring_tasks(uuid, integer);
drop function if exists app.generate_recurring_missions(integer);
drop function if exists app.recurrence_step(public.recurrence_frequency);
drop table if exists public.recurring_task_occurrences;
drop type if exists public.recurring_occurrence_status;
alter table public.recurring_tasks drop column if exists last_generated_on, drop column if exists generated_count;
drop trigger if exists leave_requests_guard_missions on public.leave_requests;
drop trigger if exists mission_assignments_guard_schedule on public.mission_assignments;
drop trigger if exists missions_guard_schedule on public.missions;
drop function if exists app.guard_leave_against_missions();
drop function if exists app.guard_mission_assignment_schedule();
drop function if exists app.guard_mission_schedule();
drop function if exists public.mission_conflicts(uuid, timestamptz, timestamptz, uuid);
drop function if exists app.mission_occupies_slot(public.mission_status);
drop function if exists app.mission_window(timestamptz, timestamptz);
alter table public.missions drop column if exists schedule_conflict_acknowledged;
drop trigger if exists organizations_guard_timezone on public.organizations;
drop function if exists app.guard_organization_timezone();
alter table public.organizations drop column if exists timezone;
-- Le garde de périmètre retrouve sa liste d'origine (20260810100300) : à réappliquer depuis cette migration.
commit;
