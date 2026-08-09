import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { qk } from '@/lib/query-keys';

import { getMySubscription, getOrganizationSubscription, resolvePlanCode } from '../api/billing.api';
import {
  DEFAULT_PLAN,
  planFeatureLimit,
  planHasFeature,
  type FeatureKey,
  type PlanCode,
} from '../entitlements';

/**
 * Droits effectifs de l'utilisateur — ou de l'organisation courante.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE HOOK NE PROTÈGE RIEN.
 *
 * Il sert à EXPLIQUER : afficher « 18 / 25 membres », proposer une page de
 * montée en gamme plutôt qu'une liste vide inexplicable, masquer une entrée de
 * menu qui mènerait à un refus. Le refus réel vient de PostgreSQL, où chaque
 * policy du module professionnel passe par `app.can_use_pro_module`.
 *
 * Conséquence directe : le plan n'est JAMAIS un état local. Il découle de la
 * table `subscriptions`, fermée en écriture au client. La version précédente le
 * stockait dans un `useState` qu'un bouton de l'interface pouvait faire passer à
 * « pro » — l'utilisateur s'accordait lui-même les droits qu'il voulait.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface Entitlements {
  planCode: PlanCode;
  /** La fonctionnalité est-elle incluse dans le plan ? */
  has: (feature: FeatureKey) => boolean;
  /** `null` = illimité · `0` = interdit · `n` = quota. */
  limit: (feature: FeatureKey) => number | null;
  isLoading: boolean;
}

/**
 * Droits attachés au COMPTE (catalogue, historique, favoris, outils pro).
 *
 * Un visiteur anonyme retombe sur `free` sans requête : il n'a pas d'abonnement,
 * et interroger le serveur pour l'apprendre coûterait un aller-retour à chaque
 * chargement de la page d'accueil.
 */
export function useUserEntitlements(): Entitlements {
  const { user, status } = useAuth();
  const userId = user?.id ?? null;

  const { data, isPending } = useQuery({
    queryKey: qk.billing.mySubscription(userId),
    queryFn: () => (userId === null ? Promise.resolve(null) : getMySubscription(userId)),
    enabled: userId !== null,
    // L'abonnement ne change qu'au retour d'un paiement : inutile de le
    // réinterroger à chaque montage d'un composant d'outil.
    staleTime: 5 * 60_000,
  });

  const planCode = userId === null ? DEFAULT_PLAN : resolvePlanCode(data ?? null);

  return {
    planCode,
    has: (feature) => planHasFeature(planCode, feature),
    limit: (feature) => planFeatureLimit(planCode, feature),
    // `status === 'loading'` compte comme un chargement : afficher les droits du
    // plan gratuit pendant la restauration de session ferait clignoter les
    // bannières de montée en gamme sous les yeux d'un abonné.
    isLoading: status === 'loading' || (userId !== null && isPending),
  };
}

/**
 * Droits attachés à une ORGANISATION (missions, équipes, clients, audit…).
 *
 * Distincts de ceux du compte : c'est l'entreprise qui souscrit `business`, pas
 * la personne. Un même utilisateur peut être `pro` à titre individuel et membre
 * d'une organisation restée en `free`.
 */
export function useOrganizationEntitlements(organizationId: string | null): Entitlements {
  const { data, isPending } = useQuery({
    queryKey: qk.billing.organizationSubscription(organizationId ?? 'none'),
    queryFn: () =>
      organizationId === null ? Promise.resolve(null) : getOrganizationSubscription(organizationId),
    enabled: organizationId !== null,
    staleTime: 5 * 60_000,
  });

  const planCode = organizationId === null ? DEFAULT_PLAN : resolvePlanCode(data ?? null);

  return {
    planCode,
    has: (feature) => planHasFeature(planCode, feature),
    limit: (feature) => planFeatureLimit(planCode, feature),
    isLoading: organizationId !== null && isPending,
  };
}
