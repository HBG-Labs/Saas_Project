-- =============================================================================
-- Transition de clôture et droit d'accès au module Clients
-- =============================================================================
--
-- Fichier séparé de 20260809100100 : la valeur `closed` y est ajoutée à
-- l'énumération, et PostgreSQL interdit de l'employer dans la transaction qui
-- l'a créée. Elle est ici utilisable, la migration précédente ayant été validée.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- approved → closed
-- -----------------------------------------------------------------------------
--
-- Exige `mission.update`, la même permission que piloter une mission : clore
-- relève de l'exploitation, pas d'un pouvoir de contrôle distinct. Le chef
-- d'équipe peut donc clore les dossiers qu'il suit.
--
-- `assignee_only` reste faux : la clôture est un acte administratif, et
-- l'intervenant n'a pas à y prendre part.
--
-- Aucune transition ne part de `closed`, ce qui en fait un état terminal au même
-- titre que `cancelled`. Rouvrir une mission close reviendrait à rouvrir une
-- facture : si le besoin apparaît, ce sera une nouvelle mission, référence
-- comprise, et l'historique restera lisible.
insert into public.mission_status_transitions
  (from_status, to_status, required_permission, assignee_only, description)
values
  ('approved', 'closed', 'mission.update', false,
   'Clôturer le dossier — les travaux sont validés et l''affaire est facturable')
on conflict (from_status, to_status) do update set
  required_permission = excluded.required_permission,
  assignee_only       = excluded.assignee_only,
  description         = excluded.description;

-- -----------------------------------------------------------------------------
-- Le module Clients suit le plan `business`
-- -----------------------------------------------------------------------------
--
-- `null` signifie illimité : le nombre de clients n'est pas ce qui distingue les
-- offres. Ce qui les distingue, c'est l'accès au module — et l'ABSENCE de la
-- clé pour `free` et `pro` suffit à le refuser, `app.org_has_feature` ne
-- trouvant alors aucune ligne.
--
-- Cette clé est la condition évaluée par `can_use_pro_module(org, 'customers')`
-- dans les quatre policies de `customers` : sans elle, la table entière reste
-- invisible, quel que soit le rôle.
insert into public.plan_features (plan_code, feature_key, limit_value)
values ('business', 'customers', null)
on conflict (plan_code, feature_key) do update set
  limit_value = excluded.limit_value;
