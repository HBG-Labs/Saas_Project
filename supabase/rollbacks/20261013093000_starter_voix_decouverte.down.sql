-- Retour arrière de 20261013093000_starter_voix_decouverte.sql — À LA MAIN, JAMAIS PAR db push.
-- Remet Starter à 0 minute (la ligne reste : la formule L'A eue explicitement).
-- Penser aussi à remettre le miroir TypeScript (entitlements.ts) et, si l'on
-- veut le comportement d'avant, à redéployer le worker avec le résumé compté
-- dans le quota d'Assistant.
begin;
update public.plan_features set limit_value = 0
where plan_code = 'starter' and feature_key = 'ai_transcription_minutes';
commit;
