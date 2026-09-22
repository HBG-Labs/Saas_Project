-- Retour arrière de 20261009090000_stt_segments_resume.sql — À LA MAIN, JAMAIS PAR db push.
-- Aucune colonne n'a été ajoutée : seule la fonction change. Les valeurs déjà
-- écrites dans segments / summary_json restent (elles étaient nulles avant).
-- À faire AVANT : redéployer transcription-worker sans p_segments/p_summary_json,
-- sinon le worker échoue sur une signature inconnue.
begin;
drop function if exists public.record_workspace_recording_result(uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb);
-- Puis : recréer record_workspace_recording_result(uuid,text,text,text,text,text,text,jsonb)
-- depuis 20261008090000_stt_normalisation.sql (§2).
commit;
