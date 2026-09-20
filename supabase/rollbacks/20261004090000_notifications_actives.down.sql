-- Retour arrière de 20261004090000_notifications_actives.sql — À LA MAIN, JAMAIS PAR db push.
-- Supprime la file, les triggers, le worker planifié et le réglage. Les e-mails
-- déjà envoyés le restent ; les lignes en attente sont perdues.
begin;
select cron.unschedule('notification-worker');
select cron.unschedule('notification-deliveries-purge');
drop trigger if exists intervention_reports_notify on public.intervention_reports;
drop trigger if exists leave_requests_notify on public.leave_requests;
drop trigger if exists missions_notify_assigned on public.missions;
drop function if exists app.notify_intervention_report();
drop function if exists app.notify_leave_request();
drop function if exists app.notify_mission_assigned();
drop function if exists app.trigger_notification_worker();
drop function if exists app.purge_notification_deliveries();
drop function if exists public.record_notification_delivery_result(uuid, text, text, text);
drop function if exists public.claim_notification_deliveries(integer);
drop function if exists app.display_name_of(uuid);
drop function if exists app.users_with_permission(uuid, text, uuid);
drop function if exists app.enqueue_notification(uuid, uuid, text, text, uuid, jsonb);
drop table if exists public.notification_worker_runs;
drop table if exists public.notification_deliveries;
alter table public.user_preferences drop column if exists notify_report_review;
commit;
