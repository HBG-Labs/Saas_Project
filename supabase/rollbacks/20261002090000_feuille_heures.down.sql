-- Retour arrière de 20261002090000_feuille_heures.sql — À LA MAIN, JAMAIS PAR db push.
-- Supprime le temps hors intervention, les clôtures, les vues et les fonctions de
-- la feuille d'heures ; retire les heures contractuelles et les permissions.
-- PERTE DE DONNÉES : les segments `work_time_entries` et les clôtures sont effacés.
begin;
drop trigger if exists intervention_time_entries_close_work_time on public.intervention_time_entries;
drop trigger if exists a_intervention_time_entries_closed_month on public.intervention_time_entries;
drop policy if exists intervention_time_entries_select_timesheet on public.intervention_time_entries;
drop function if exists public.reopen_timesheet_month(uuid, text);
drop function if exists public.close_timesheet_month(uuid, uuid, date, text);
drop function if exists public.timesheet_month(uuid, date);
drop function if exists public.stop_work_time();
drop function if exists public.start_work_time(uuid, public.work_time_kind, text);
drop view if exists public.timesheet_weeks;
drop view if exists public.timesheet_days;
drop table if exists public.timesheet_closures;
drop table if exists public.work_time_entries;
drop function if exists app.close_work_time_on_intervention_start();
drop function if exists app.guard_time_entry_closed_month();
drop function if exists app.timesheet_is_closed(uuid, uuid, timestamptz);
drop function if exists app.timesheet_month_of(uuid, timestamptz);
drop function if exists app.guard_work_time_entry();
drop type if exists public.work_time_kind;
alter table public.organization_members drop column if exists weekly_hours;
alter table public.organizations drop column if exists weekly_hours;
delete from public.role_permissions where permission in ('timesheet.view_all', 'timesheet.manage');
commit;
