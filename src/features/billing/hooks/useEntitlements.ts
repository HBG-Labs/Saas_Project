import { useQuery } from '@tanstack/react-query';
import { useContext } from 'react';

import { useAuth } from '@/features/auth';
import { OrganizationContext } from '@/features/organizations';
import { qk } from '@/lib/query-keys';

import {
  getMySubscription,
  getOrganizationPlanCode,
  getOrganizationSubscription,
  resolvePlanCode,
} from '../api/billing.api';
import {
  DEFAULT_PLAN,
  planFeatureLimit,
  planHasFeature,
  type FeatureKey,
  type PlanCode,
} from '../entitlements';

const PLAN_HIERARCHY: Record<PlanCode, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  business: 3,
  enterprise: 4,
};

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
 * table `subscriptions`, fermée en écriture au client.
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
 * Droits attachés au COMPTE et à l'ORGANISATION ACTIVE.
 *
 * Si l'utilisateur appartient à une organisation abonnée (ex: Pro, Business, Enterprise),
 * il bénéficie automatiquement du plan de son entreprise pour les outils métiers,
 * l'historique et les exports.
 */
export function useUserEntitlements(): Entitlements {
  const { user, status } = useAuth();
  const userId = user?.id ?? null;

  const orgContext = useContext(OrganizationContext);
  const organizationId = orgContext?.organization?.id ?? null;

  const userSubQuery = useQuery({
    queryKey: qk.billing.mySubscription(userId),
    queryFn: () => (userId === null ? Promise.resolve(null) : getMySubscription(userId)),
    enabled: userId !== null,
    staleTime: 5 * 60_000,
  });

  const orgPlanQuery = useQuery({
    queryKey: [...qk.billing.all, 'plan-code', organizationId ?? 'none'],
    queryFn: () =>
      organizationId === null
        ? Promise.resolve(DEFAULT_PLAN)
        : getOrganizationPlanCode(organizationId),
    enabled: organizationId !== null,
    staleTime: 5 * 60_000,
  });

  const userPlan = userId === null ? DEFAULT_PLAN : resolvePlanCode(userSubQuery.data ?? null);
  const orgPlan = organizationId === null ? DEFAULT_PLAN : (orgPlanQuery.data ?? DEFAULT_PLAN);

  // Le plan effectif retient le meilleur niveau entre l'abonnement personnel et l'organisation active
  const planCode = PLAN_HIERARCHY[orgPlan] >= PLAN_HIERARCHY[userPlan] ? orgPlan : userPlan;

  return {
    planCode,
    has: (feature) => planHasFeature(planCode, feature),
    limit: (feature) => planFeatureLimit(planCode, feature),
    isLoading:
      status === 'loading' ||
      (userId !== null && userSubQuery.isPending) ||
      (organizationId !== null && orgPlanQuery.isPending),
  };
}

/**
 * Abonnement brut de l'organisation, pour l'écran de facturation.
 *
 * Distinct de `useOrganizationEntitlements`, qui n'en retient que le plan
 * effectif : afficher « votre abonnement est en retard de paiement » suppose de
 * connaître le statut, que la réduction en `PlanCode` a précisément écarté.
 *
 * `null` est une réponse valide — une organisation sans abonnement est sur le
 * plan gratuit, ce n'est pas une anomalie.
 */
export function useOrganizationSubscription(organizationId: string | null) {
  return useQuery({
    queryKey: qk.billing.organizationSubscription(organizationId ?? 'none'),
    queryFn: () =>
      organizationId === null ? null : getOrganizationSubscription(organizationId),
    enabled: organizationId !== null,
    staleTime: 5 * 60_000,
  });
}

/**
 * Droits attachés à une ORGANISATION (missions, équipes, clients, audit…).
 *
 * Distincts de ceux du compte : c'est l'entreprise qui souscrit `business`, pas
 * la personne. Un même utilisateur peut être `pro` à titre individuel et membre
 * d'une organisation restée en `free`.
 */
export function useOrganizationEntitlements(organizationId: string | null): Entitlements {
  // Le CODE de la formule, pas l'abonnement : `subscriptions` est réservée à
  // `billing.view`, et l'interroger ici refusait le module professionnel à tout
  // technicien — alors que le serveur le lui ouvre. Clé de cache distincte de
  // `organizationSubscription`, qui sert l'écran de facturation.
  const { data, isPending } = useQuery({
    queryKey: [...qk.billing.all, 'plan-code', organizationId ?? 'none'],
    queryFn: () =>
      organizationId === null
        ? Promise.resolve(DEFAULT_PLAN)
        : getOrganizationPlanCode(organizationId),
    enabled: organizationId !== null,
    staleTime: 5 * 60_000,
  });

  const planCode = organizationId === null ? DEFAULT_PLAN : (data ?? DEFAULT_PLAN);

  return {
    planCode,
    has: (feature) => planHasFeature(planCode, feature),
    limit: (feature) => planFeatureLimit(planCode, feature),
    isLoading: organizationId !== null && isPending,
  };
}
