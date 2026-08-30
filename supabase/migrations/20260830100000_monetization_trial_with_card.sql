-- =============================================================================
-- Modèle Croissance & Monétisation : Essai 14 jours avec Carte Bancaire (Stripe)
-- =============================================================================
--
-- LE CONSTAT
--
-- Jusqu'ici, `app.start_organization_trial()` insérait systématiquement un essai
-- 'business' de 14 jours sans carte bancaire à la création de chaque
-- organisation. Cette approche permettait à un utilisateur de recréer
-- continuellement des adresses pour bénéficier indéfiniment des modules
-- professionnels sans jamais payer.
--
-- LE NOUVEAU MODÈLE
--
-- 1. Une organisation nouvellement créée commence désormais en formule 'free'
--    par défaut (ou sans abonnement, ce qui résout vers 'free').
-- 2. L'accès à une période d'essai de 14 jours sur les formules payantes
--    (Starter, Pro, Business, Enterprise) passe par Stripe Checkout avec
--    validation d'une carte bancaire (0 € débité aujourd'hui).
-- 3. Le webhook Stripe écrit ensuite la ligne 'trialing' avec le provider
--    'stripe' et l'identifiant Stripe d'abonnement.
-- 4. Une organisation n'a droit qu'à un seul essai : la fonction
--    `app.is_trial_eligible(org_id)` permet de savoir si l'organisation peut
--    bénéficier des 14 jours offerts ou si la souscription est directement payante.
-- =============================================================================

create or replace function app.start_organization_trial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Les nouvelles organisations ne reçoivent plus d'essai sans carte bancaire.
  -- Elles démarrent en formule gratuite ; l'essai 14 jours s'active
  -- via Stripe Checkout lors de la saisie sécurisée du moyen de paiement.
  return new;
end;
$$;

/**
 * Détermine si une organisation est éligible à un essai gratuit de 14 jours.
 * Une organisation n'est éligible que si elle n'a jamais souscrit ni bénéficié
 * d'un essai via Stripe.
 */
create or replace function app.is_trial_eligible(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.subscriptions s
    where s.organization_id = p_organization_id
      and (s.provider_subscription_id is not null or s.status in ('active', 'past_due'))
  );
$$;

revoke all on function app.is_trial_eligible(uuid) from public, anon;
grant execute on function app.is_trial_eligible(uuid) to authenticated;
