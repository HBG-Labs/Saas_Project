import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import {
  cancelSubscription,
  createBillingPortalSession,
  createCheckoutSession,
  getBillingSummary,
  resumeSubscription,
} from '../api/billing.api';
import type { PlanCode } from '../entitlements';

/**
 * Souscription et gestion de l'abonnement, côté composants.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CES HOOKS REDIRIGENT AU LIEU DE RENVOYER
 *
 * Une session de paiement Stripe expire au bout de vingt-quatre heures, et son
 * URL ne sert qu'une fois. La stocker dans l'état d'un composant inviterait à
 * la réutiliser — un utilisateur qui clique deux fois, ou revient en arrière,
 * atterrirait sur une session déjà consommée.
 *
 * On redirige donc immédiatement. `window.location.assign` plutôt que le
 * routeur : la destination est un domaine tiers, hors de l'application.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Situation de facturation, telle que le SERVEUR la calcule. */
export function useBillingSummary(organizationId: string | null) {
  return useQuery({
    queryKey: [...qk.billing.all, 'summary', organizationId],
    queryFn: () => (organizationId === null ? null : getBillingSummary(organizationId)),
    enabled: organizationId !== null,
  });
}

export function useCheckout(organizationId: string | null) {
  return useMutation({
    mutationFn: async (planCode: PlanCode) => {
      if (organizationId === null) throw new Error('Aucune organisation sélectionnée.');
      return createCheckoutSession({ organizationId, planCode });
    },
    onSuccess: (url) => {
      window.location.assign(url);
    },
  });
}

export function useBillingPortal(organizationId: string | null) {
  return useMutation({
    mutationFn: async () => {
      if (organizationId === null) throw new Error('Aucune organisation sélectionnée.');
      return createBillingPortalSession(organizationId);
    },
    onSuccess: (url) => {
      window.location.assign(url);
    },
  });
}

/**
 * Résilier, et se raviser.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Ces deux-là ne redirigent nulle part : la décision s'inscrit en base et
 * l'écran doit la refléter sur-le-champ. D'où l'invalidation — sans elle,
 * l'entreprise cliquerait « Résilier » et verrait le même écran qu'avant, ce
 * qui est la meilleure façon de la faire cliquer une seconde fois.
 *
 * On invalide `subscription` ET `summary` : la première porte le drapeau, la
 * seconde le montant affiché. N'en rafraîchir qu'une laisserait l'écran se
 * contredire lui-même.
 * ─────────────────────────────────────────────────────────────────────────────
 */
function useBillingMutation<TArgs, TResult>(
  organizationId: string | null,
  action: (organizationId: string) => Promise<TResult>,
) {
  const queryClient = useQueryClient();

  return useMutation<TResult, Error, TArgs>({
    mutationFn: async () => {
      if (organizationId === null) throw new Error('Aucune organisation sélectionnée.');
      return action(organizationId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.billing.all });
    },
  });
}

/** Programme la résiliation ; renvoie la date jusqu'à laquelle l'accès court. */
export function useCancelSubscription(organizationId: string | null) {
  return useBillingMutation<void, string | null>(organizationId, cancelSubscription);
}

/** Annule une résiliation qui n'a pas encore pris effet. */
export function useResumeSubscription(organizationId: string | null) {
  return useBillingMutation<void, void>(organizationId, resumeSubscription);
}
