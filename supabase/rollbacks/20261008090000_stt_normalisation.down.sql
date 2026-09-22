-- Retour arrière de 20261008090000_stt_normalisation.sql — À LA MAIN, JAMAIS PAR db push.
-- Le rollback LOGIQUE est le flag : `update organizations set stt_engine = 'legacy'`
-- (en legacy, aucune normalisation n'a lieu ; le brut reste le texte).
-- Ce fichier retire la trace (perte : la liste des remplacements ; le brut et le texte restent)
-- et rétablit record_workspace_recording_result telle que définie dans 20261006090000 (§4).
-- À faire AVANT : redéployer transcription-worker sans les paramètres p_raw/p_normalization,
-- sinon le worker échoue sur une signature inconnue.
begin;
drop function if exists public.record_workspace_recording_result(uuid, text, text, text, text, text, text, jsonb);
-- Puis : recréer record_workspace_recording_result(uuid,text,text,text,text,text)
-- depuis 20261006090000_stt_colonnes_et_flag.sql (§4).
alter table public.workspace_recordings
  drop constraint if exists workspace_recordings_normalized_has_raw,
  drop constraint if exists workspace_recordings_normalization_diff_array;
update public.workspace_recordings set transcript_normalized_at = null where transcript_normalized_at is not null;
alter table public.workspace_recordings drop column if exists normalization_diff;
commit;
