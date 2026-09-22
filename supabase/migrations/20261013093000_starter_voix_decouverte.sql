-- =============================================================================
-- Starter goûte la voix — 30 minutes de transcription, résumé compris
-- =============================================================================
--
-- Décision produit du 22/09/2026. Starter (19 €) avait la transcription à 0 :
-- ses clients ne voyaient jamais ce qui fait la valeur du Pro. 30 minutes
-- par mois — de quoi enregistrer une quinzaine de minutes avec le direct
-- (qui consomme deux minutes de quota pour une minute d'audio) — coûtent
-- 0,14 $ par client et par mois et donnent une raison concrète de monter.
--
-- Free reste SANS ligne (l'absence vaut refus). Pro (120), Business (600) et
-- Enterprise (3000) ne changent pas.
--
-- Ce fichier ne touche PAS à `ai_assistant` : la décision du 02/09
-- (`20260902190000_ai_assistant_pro_plus.sql`) tient, l'Assistant reste à
-- partir de Pro. Le résumé d'un enregistrement, lui, cesse d'être une
-- requête d'Assistant : il fait partie de la transcription, déjà payée par
-- les minutes. C'est un changement du worker (`transcription-worker`), pas
-- du schéma — il corrige aussi un effet qui n'avait jamais été voulu : un
-- client Pro qui enregistrait beaucoup épuisait son quota d'Assistant en
-- résumés.
--
-- Rollback : supabase/rollbacks/20261013093000_starter_voix_decouverte.down.sql
-- =============================================================================

insert into public.plan_features (plan_code, feature_key, limit_value) values
  ('starter', 'ai_transcription_minutes', 30)
on conflict (plan_code, feature_key) do update set
  limit_value = excluded.limit_value;

do $$
declare v integer;
begin
  select limit_value into v from public.plan_features
  where plan_code = 'starter' and feature_key = 'ai_transcription_minutes';
  if v is distinct from 30 then
    raise exception 'Starter devrait porter 30 minutes de transcription, pas %.', v;
  end if;
  if exists (select 1 from public.plan_features
             where plan_code = 'free' and feature_key = 'ai_transcription_minutes') then
    raise exception 'Free ne doit porter aucune ligne de minutes.';
  end if;
end $$;
