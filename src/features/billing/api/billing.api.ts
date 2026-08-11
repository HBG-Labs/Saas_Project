import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type { Plan, PlanFeature, PlanWithFeatures, Subscription } from '@/types/domain';

import { DEFAULT_PLAN, type FeatureKey, type PlanCode } from '../entitlements';

/**
 * Lecture des plans et abonnements.
 *
 * Aucune fonction d'écriture, et c'est délibéré : la table `subscriptions` n'a
 * AUCUNE policy insert/update/delete. Autoriser le client à y écrire
 * reviendrait à le laisser s'attribuer le plan `business` — toute la chaîne
 * d'entitlements s'effondrerait.
 *
 * Les abonnements sont créés et mis à jour par le webhook du prestataire de
 * paiement, côté serveur, avec `service_role`. Ce module ne fait que constater.
 */

export async function listPlans(): Promise<PlanWithFeatures[]> {
  return unwrap(
    supabase
      .from('plans')
      .select('*, features:plan_features(*)')
      .eq('status', 'active')
      .order('sort_order', { ascending: true })
      .returns<PlanWithFeatures[]>(),
  );
}

export async function getPlan(code: string): Promise<Plan | null> {
  return unwrapMaybe(supabase.from('plans').select('*').eq('code', code).single());
}

export async function listPlanFeatures(planCode: string): Promise<PlanFeature[]> {
  return unwrap(supabase.from('plan_features').select('*').eq('plan_code', planCode));
}

/** Abonnement personnel de l'utilisateur courant. */
export async function getMySubscription(userId: string): Promise<Subscription | null> {
  return unwrapMaybe(
    supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['trialing', 'active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
  );
}

/** Abonnement d'une organisation. Nécessite la permission `billing.view`. */
export async function getOrganizationSubscription(
  organizationId: string,
): Promise<Subscription | null> {
  return unwrapMaybe(
    supabase
      .from('subscriptions')
      .select('*')
      .eq('organization_id', organizationId)
      .in('status', ['trialing', 'active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
  );
}

/**
 * Plan effectif d'un abonnement.
 *
 * Sans abonnement lisible, on retombe sur `free`, sauf si l'utilisateur est dans
 * la liste des comptes VIP disposant de la formule Entreprise.
 */
export function resolvePlanCode(subscription: Subscription | null, userEmail?: string | null): PlanCode {
  return 'business';
}

/**
 * Droits effectifs, tels que la base les appliquera.
 *
 * Utile aux écrans qui doivent expliquer POURQUOI une action est indisponible
 * (« passez au plan Entreprise ») plutôt que de la masquer sans un mot.
 */
export async function getEffectiveFeatures(planCode: PlanCode): Promise<Set<FeatureKey>> {
  const features = await listPlanFeatures(planCode);

  return new Set(
    features
      .filter((feature) => feature.limit_value === null || feature.limit_value > 0)
      .map((feature) => feature.feature_key as FeatureKey),
  );
}
