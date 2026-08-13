-- =============================================================================
-- Une organisation naît avec son abonnement
-- =============================================================================
--
-- LE CONSTAT
--
-- `app.handle_new_organization()` donne bien au créateur sa ligne `owner`, mais
-- rien ne crée d'abonnement. Or toute la chaîne d'entitlements part de là :
--
--   app.org_plan_code(org)   → lit subscriptions WHERE organization_id = org
--   app.org_has_feature(...) → NULL n'a aucune ligne dans plan_features
--   app.can_use_pro_module() → false
--
-- Conséquence mesurée sur le parcours réel : un patron s'inscrit, crée son
-- entreprise, en devient propriétaire — et découvre un espace entièrement vide.
-- Pas un message, pas une explication : les policies de missions, clients,
-- équipes, interventions et audit renvoient toutes un ensemble vide, puisque
-- l'organisation n'a aucune formule. L'inscription mène à une impasse.
--
-- LE PRINCIPE
--
-- L'abonnement appartient à l'ORGANISATION, jamais à une personne — la
-- contrainte `subscriptions_subject_xor` l'impose déjà, et `user_id` reste donc
-- NULL ici. Un employé invité ensuite n'a pas d'abonnement propre : il utilise
-- celui de son entreprise, par `app.can_use_pro_module` qui ne regarde que
-- l'appartenance et le plan de l'organisation.
--
-- Cette période d'essai est posée par le SERVEUR. `subscriptions` n'a aucune
-- policy d'écriture : ni le patron ni un employé ne peut s'attribuer un plan.
-- Quand le prestataire de paiement entrera en jeu, il écrira dans cette même
-- table avec `service_role`, sur la même colonne `organization_id` — le modèle
-- ne changera pas, seule la provenance de la ligne changera.
--
-- L'essai s'éteint tout seul : `org_plan_code` écarte les abonnements dont
-- `current_period_end` est dépassé. Passé quatorze jours, l'organisation retombe
-- sans plan, et `RequirePlan` affiche enfin le message prévu pour ce cas.
-- =============================================================================

create or replace function app.start_organization_trial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Garde-fou plutôt que confiance à l'unicité du contexte : si une ligne existe
  -- déjà pour cette organisation, elle fait autorité. Un abonnement payant posé
  -- par le webhook ne doit jamais être doublé d'un essai.
  if exists (
    select 1 from public.subscriptions s where s.organization_id = new.id
  ) then
    return new;
  end if;

  insert into public.subscriptions (
    organization_id,
    plan_code,
    status,
    current_period_start,
    current_period_end,
    trial_ends_at
  )
  values (
    new.id,
    'business',
    'trialing',
    now(),
    now() + interval '14 days',
    now() + interval '14 days'
  );

  return new;
end;
$$;

-- `organizations_create_owner` s'exécute d'abord (ordre alphabétique) : le
-- propriétaire existe donc avant l'abonnement. L'ordre inverse fonctionnerait
-- aussi, les deux triggers étant indépendants, mais celui-ci se lit dans le sens
-- du parcours : on devient propriétaire, puis on souscrit.
drop trigger if exists organizations_start_trial on public.organizations;
create trigger organizations_start_trial
  after insert on public.organizations
  for each row execute function app.start_organization_trial();
