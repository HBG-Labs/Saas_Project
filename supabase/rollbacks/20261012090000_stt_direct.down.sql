-- Retour arrière de 20261012090000_stt_direct.sql — À LA MAIN, JAMAIS PAR db push.
-- À faire AVANT : retirer la fonction Edge transcription-live-token et
-- redéployer le front sans le direct, sinon les clients appellent une porte absente.
begin;
drop function if exists public.live_transcription_access(uuid, uuid);
-- Puis : recréer reserve_transcription_minutes(uuid) depuis 20261005090000_enregistrements_vocaux.sql (§4).
drop function if exists public.reserve_transcription_minutes(uuid);
drop table if exists public.transcription_live_sessions;
alter table public.workspace_recordings
  drop constraint if exists workspace_recordings_transcript_live_length,
  drop column if exists live_used,
  drop column if exists transcript_live;
commit;
