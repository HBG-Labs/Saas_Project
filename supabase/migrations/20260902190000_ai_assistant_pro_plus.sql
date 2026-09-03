-- =============================================================================
-- Assistant IA — réservé à Pro et au-dessus
-- =============================================================================
--
-- Décision produit du 02/09/2026 : l'Assistant IA ne fait plus partie de
-- Starter. `0` plutôt qu'une suppression de la ligne : la formule L'AVAIT
-- explicitement, on la lui retire explicitement — distinct de l'absence de
-- ligne, qui dirait « n'a jamais été incluse ». Même geste que la remise à
-- plat de la matrice (`20260902100000`) : `on conflict ... do update` sur la
-- même paire (plan, feature) plutôt qu'un DELETE, pour que le test de
-- synchronisation (`extractInsertTuplesAcross`, qui ne lit que des INSERT)
-- voie la nouvelle valeur sans qu'il faille lui apprendre à lire les
-- suppressions composites.
--
-- Pro (100/mois), Business (300) et Enterprise (1000) ne changent pas.
insert into public.plan_features (plan_code, feature_key, limit_value) values
  ('starter', 'ai_assistant', 0)
on conflict (plan_code, feature_key) do update set
  limit_value = excluded.limit_value;
