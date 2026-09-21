-- Retour arrière de 20261006090000_stt_colonnes_et_flag.sql — À LA MAIN, JAMAIS PAR db push.
-- Le rollback LOGIQUE est le flag : `update organizations set stt_engine = 'legacy'`.
-- Ce fichier retire les colonnes (perte : brut, segments, résumé structuré, notes, moteur)
-- et rétablit les deux fonctions telles que définies dans 20261005090000 (§4).
begin;
drop trigger if exists workspace_recordings_transcript_raw_immutable on public.workspace_recordings;
drop function if exists app.guard_transcript_raw_immutable();
drop function if exists public.record_workspace_recording_result(uuid, text, text, text, text, text);
drop function if exists public.claim_workspace_recordings(integer);
-- Puis : recréer claim_workspace_recordings(integer) et record_workspace_recording_result(uuid,text,text,text,text)
-- depuis 20261005090000_enregistrements_vocaux.sql.
alter table public.workspace_recordings
  drop column if exists notes, drop column if exists summary_json, drop column if exists segments,
  drop column if exists transcript_normalized_at, drop column if exists transcript_raw, drop column if exists engine;
alter table public.organizations drop column if exists stt_engine;
commit;
