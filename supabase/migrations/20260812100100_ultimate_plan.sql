-- =============================================================================
-- Formule Ultimate, et alignement du quota Entreprise
-- =============================================================================
--
-- LE CONSTAT
--
-- Le miroir TypeScript `entitlements.ts` déclare quatre formules — `free`,
-- `pro`, `business`, `ultimate` — et la page tarifaire les annonce toutes les
-- quatre. La table `plans` n'en connaît que trois. Un abonnement `ultimate`
-- serait donc rejeté par la clé étrangère `subscriptions_plan_code_fkey`, et
-- `app.org_plan_code()` ne saurait qu'en faire.
--
-- Le second écart porte sur le quota : le seed d'origine accorde 25 membres au
-- plan Entreprise, le miroir en annonce 10. Le test `entitlements.test.ts`
-- compare les deux paire par paire et échoue — à raison. C'est la base qui
-- s'aligne sur l'offre commerciale publiée, pas l'inverse.
--
-- CE QUE CETTE MIGRATION NE CHANGE PAS
--
-- Les tarifs déjà en base restent tels quels : les aligner sur `pricing.ts`
-- (49 € contre 39,99 € pour Entreprise) est une décision commerciale, pas une
-- correction technique, et elle n'a pas sa place dans une migration de
-- cohérence.
--
-- Rien n'est supprimé. Les deux abonnements existants restent sur `business`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- La formule Ultimate
-- -----------------------------------------------------------------------------
--
-- `is_organization_plan` à `true` : comme Entreprise, elle est souscrite par une
-- ORGANISATION. La contrainte `subscriptions_subject_xor` interdit qu'un
-- abonnement porte à la fois un `user_id` et un `organization_id` ; un employé
-- ne peut donc pas en détenir une copie personnelle.
insert into public.plans (
  code, name, description,
  price_monthly_cents, price_annual_cents, currency,
  is_organization_plan, sort_order
)
values (
  'ultimate',
  'Ultimate',
  'Grands comptes et structures multi-sites : gouvernance, audit et support dédié.',
  9900, 94800, 'EUR',
  true, 40
)
on conflict (code) do update set
  name                 = excluded.name,
  description          = excluded.description,
  price_monthly_cents  = excluded.price_monthly_cents,
  price_annual_cents   = excluded.price_annual_cents,
  is_organization_plan = excluded.is_organization_plan,
  sort_order           = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- Fonctionnalités
-- -----------------------------------------------------------------------------
--
-- Ultimate reprend l'intégralité du périmètre Entreprise ; seul le quota de
-- membres les distingue. Les lignes sont énumérées plutôt que copiées par
-- `insert ... select` depuis `business` : le seed doit rester lisible tel quel,
-- puisque `entitlements.test.ts` le lit pour vérifier le miroir TypeScript.
insert into public.plan_features (plan_code, feature_key, limit_value) values
  -- Alignement du quota Entreprise sur l'offre publiée.
  ('business', 'members',             10),

  -- -------------------------------------------------------------- ultimate
  ('ultimate', 'catalog_access',      null),
  ('ultimate', 'calculation_history', null),
  ('ultimate', 'favorites',           null),
  ('ultimate', 'pro_tools',           null),
  ('ultimate', 'export_pdf',          null),
  ('ultimate', 'export_csv',          null),
  ('ultimate', 'organizations',       null),
  ('ultimate', 'customers',           null),
  ('ultimate', 'teams',               null),
  ('ultimate', 'members',             20),
  ('ultimate', 'missions',            null),
  ('ultimate', 'interventions',       null),
  ('ultimate', 'intervention_review', null),
  ('ultimate', 'audit_log',           null),
  ('ultimate', 'statistics',          null),
  ('ultimate', 'attachments',         null)
on conflict (plan_code, feature_key) do update set
  limit_value = excluded.limit_value;
