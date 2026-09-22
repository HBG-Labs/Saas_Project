-- Retour arrière de 20261011090000_stt_reveil_immediat.sql — À LA MAIN, JAMAIS PAR db push.
-- Le cron chaque minute reprend seul le relais ; rien d'autre ne change.
begin;
drop trigger if exists workspace_recordings_wake_worker on public.workspace_recordings;
drop function if exists app.wake_transcription_worker();
commit;
