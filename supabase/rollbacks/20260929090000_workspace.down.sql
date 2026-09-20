-- Retour arrière de 20260929090000_workspace.sql — À LA MAIN, JAMAIS PAR db push.
-- Supprime les espaces, pages, tâches et révisions saisis depuis l'application.
begin;
drop function if exists public.save_workspace_page(uuid, timestamptz, text, jsonb);
drop table if exists public.workspace_tasks;
drop table if exists public.workspace_page_revisions;
drop table if exists public.workspace_pages;
drop table if exists public.workspace_spaces;
drop function if exists app.guard_workspace_page();
drop function if exists app.guard_workspace_task();
drop function if exists app.archive_workspace_page_revision();
drop function if exists app.audit_workspace_space();
drop type if exists public.workspace_task_status;
drop type if exists public.workspace_task_priority;
delete from public.role_permissions where permission like 'workspace.%';
delete from public.plan_features where feature_key = 'workspace';
commit;
