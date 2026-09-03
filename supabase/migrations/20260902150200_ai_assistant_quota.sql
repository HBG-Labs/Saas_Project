-- =============================================================================
-- Assistant IA — quota par formule
-- =============================================================================
--
-- La route `/assistant-ia` n'était jusqu'ici gardée que par
-- `RequireOrganization` : tout compte, y compris Gratuit, pouvait appeler
-- l'Edge Function sans aucune limite — un modèle facturé au token, ouvert sans
-- quota. Cette migration ajoute `ai_assistant` à `plan_features`, seul geste
-- qui manque pour que `app.can_use_pro_module`, `app.org_feature_limit` et
-- `app.ai_quota_status` (migration précédente) deviennent effectifs.
--
-- Suit le patron de `20260902130000_attachments_in_pro.sql` : un ajout à la
-- matrice existante, pas une redéfinition — contrairement à
-- `20260902100000_realigne_la_matrice_des_formules.sql`, qui remet tout à
-- plat. `on conflict ... do update` rend le fichier rejouable.
--
-- FORMULE GRATUITE EXCLUE délibérément : sans ligne dans `plan_features`,
-- `app.org_has_feature` renvoie faux et la route se ferme proprement (Phase 2
-- du plan) plutôt que d'ouvrir un accès à quota zéro qui afficherait un mur
-- d'erreur à chaque question.
insert into public.plan_features (plan_code, feature_key, limit_value) values
  ('starter',    'ai_assistant', 30),
  ('pro',        'ai_assistant', 100),
  ('business',   'ai_assistant', 300),
  -- Illimité, comme le reste de la matrice Enterprise vis-à-vis de Business.
  ('enterprise', 'ai_assistant', null)
on conflict (plan_code, feature_key) do update set
  limit_value = excluded.limit_value;
