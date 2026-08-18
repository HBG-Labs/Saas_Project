-- =============================================================================
-- Correctif : l'`upsert` du webhook ne trouvait pas sa cible
-- =============================================================================
--
-- LE DÉFAUT
--
-- `20260817101200_stripe_events.sql` a créé un index unique PARTIEL :
--
--     create unique index subscriptions_provider_subscription_idx
--       on public.subscriptions (provider_subscription_id)
--       where provider_subscription_id is not null;
--
-- Le raisonnement paraissait bon — dire explicitement que deux lignes ne
-- peuvent pas décrire le même abonnement Stripe, sans se prononcer sur les
-- lignes d'essai qui n'en ont pas.
--
-- Mais PostgreSQL exige qu'un `on conflict (colonne)` désigne un index dont le
-- PRÉDICAT est reproduit dans la clause. `supabase-js` génère un `on conflict`
-- sans prédicat : la commande échoue avec
--
--     42P10: there is no unique or exclusion constraint matching
--            the ON CONFLICT specification
--
-- Autrement dit, l'écriture centrale du système de facturation ne pouvait
-- ABOUTIR dans aucun cas. Le premier correctif — contrôler l'erreur au lieu de
-- l'ignorer — n'a fait que rendre l'échec visible ; il ne le supprimait pas.
--
-- Trouvé en rejouant la séquence du webhook dans `04_billing_scenario.sql`,
-- pas en relisant le code.
--
-- LA CORRECTION
--
-- Un index unique ORDINAIRE. PostgreSQL traite par défaut les valeurs nulles
-- comme distinctes (`NULLS DISTINCT`) : les abonnements d'essai, qui n'ont pas
-- d'identifiant Stripe, coexistent donc sans se gêner. La garantie est la même,
-- et `on conflict` sait la viser.
-- =============================================================================

drop index if exists public.subscriptions_provider_subscription_idx;

create unique index if not exists subscriptions_provider_subscription_idx
  on public.subscriptions (provider_subscription_id);

comment on index public.subscriptions_provider_subscription_idx is
  'Cible de l''`on conflict` du webhook Stripe. NON partiel : un index partiel exige que le prédicat figure dans la clause, ce que supabase-js ne génère pas.';
