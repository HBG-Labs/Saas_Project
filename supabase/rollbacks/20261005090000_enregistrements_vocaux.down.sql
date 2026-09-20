-- Retour arrière de 20261005090000_enregistrements_vocaux.sql — À LA MAIN, JAMAIS PAR db push.
-- PERTE DE DONNÉES : enregistrements (lignes) et consommation de minutes. Les
-- transcriptions déjà écrites dans les pages y restent. Les fichiers du bucket
-- se suppriment par l'API Storage AVANT de retirer le bucket.
begin;
select cron.unschedule('transcription-worker');
drop policy if exists workspace_audio_storage_read on storage.objects;
drop policy if exists workspace_audio_storage_upload on storage.objects;
drop policy if exists workspace_audio_storage_delete on storage.objects;
delete from storage.objects where bucket_id = 'workspace-audio';
delete from storage.buckets where id = 'workspace-audio';
drop function if exists app.trigger_transcription_worker();
drop table if exists public.transcription_worker_runs;
drop function if exists public.mark_workspace_audio_deleted(uuid);
drop function if exists public.claim_workspace_audio_purges(integer);
drop function if exists public.record_workspace_recording_result(uuid, text, text, text, text);
drop function if exists app.text_to_tiptap_blocks(text);
drop function if exists public.claim_workspace_recordings(integer);
drop function if exists public.reserve_transcription_minutes(uuid);
drop function if exists public.submit_workspace_recording(uuid, integer);
drop trigger if exists workspace_recordings_guard on public.workspace_recordings;
drop function if exists app.guard_workspace_recording();
drop table if exists public.workspace_recordings;
drop function if exists public.transcription_quota_status(uuid);
drop table if exists public.ai_transcription_usage;
delete from public.plan_features where feature_key = 'ai_transcription_minutes';
commit;
