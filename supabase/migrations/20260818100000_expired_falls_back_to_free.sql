-- =============================================================================
-- Un essai expiré retombe en Gratuit, pas dans le vide
-- =============================================================================
--
-- L'INCOHÉRENCE, MESURÉE
--
-- Sur une organisation dont l'essai vient d'expirer :
--
--     app.org_plan_code()        → null
--     app.org_effective_plan()   → 'free'      (introduit le 17/08)
--     app.org_has_feature(…)     → false POUR TOUT, y compris les clés de Free
--
-- `org_has_feature` interroge `plan_features` avec `org_plan_code`, qui vaut
-- NULL : aucune ligne ne correspond, et l'organisation perd jusqu'aux trois
-- fonctionnalités du plan Gratuit. Elle n'est donc pas « repassée en Gratuit »,
-- elle est sortie de la grille.
--
-- POURQUOI CELA COMPTE MAINTENANT
--
-- La page d'inscription annonce désormais l'essai de quatorze jours et ce qui
-- suit son échéance. Promettre « l'entreprise bascule en formule Gratuite »
-- suppose que ce soit vrai — or ça ne l'était pas.
--
-- CE QUE CE CHANGEMENT N'OUVRE PAS
--
-- Free ne comprend que `catalog_access`, `calculation_history` et `favorites`.
-- Aucun module professionnel. `can_use_pro_module(org, 'missions')` reste donc
-- faux après expiration, exactement comme avant — les 34 policies qui en
-- dépendent ne changent pas de comportement. Seules les trois clés du plan
-- Gratuit deviennent accessibles, ce qui est précisément l'intention.
--
-- Les données, elles, n'ont jamais été touchées : missions, clients et comptes
-- rendus restent en base. Ils redeviennent lisibles dès la souscription.
-- =============================================================================

create or replace function app.org_has_feature(p_organization_id uuid, p_feature_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.plan_features f
    where f.plan_code = app.org_effective_plan(p_organization_id)
      and f.feature_key = p_feature_key
      -- 0 = fonctionnalité explicitement interdite, malgré la présence de la ligne.
      and (f.limit_value is null or f.limit_value > 0)
  );
$$;

-- Même correction pour le quota : un plan lu d'un côté et pas de l'autre
-- produirait des décisions contradictoires sur la même organisation.
create or replace function app.org_feature_limit(p_organization_id uuid, p_feature_key text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select f.limit_value
  from public.plan_features f
  where f.plan_code = app.org_effective_plan(p_organization_id)
    and f.feature_key = p_feature_key;
$$;
