-- =============================================================================
-- Assistant IA — plafonne aussi la formule Enterprise
-- =============================================================================
--
-- `20260902150200_ai_assistant_quota.sql` laissait Enterprise à `null`
-- (illimité), sur le même raisonnement que le reste de sa matrice vis-à-vis de
-- Business. Décision explicite : même la plus haute formule doit avoir un
-- plafond sur un usage facturé au token — un modèle payé à l'appel n'a pas de
-- palier "sans limite" ailleurs dans le produit.
--
-- 1000 : suit la progression x3 des paliers précédents (30 → 100 → 300 →
-- ~1000), plutôt que le ratio de sièges. Une migration séparée, pas une
-- édition de la précédente — celle-ci est déjà appliquée en production.
insert into public.plan_features (plan_code, feature_key, limit_value) values
  ('enterprise', 'ai_assistant', 1000)
on conflict (plan_code, feature_key) do update set
  limit_value = excluded.limit_value;
