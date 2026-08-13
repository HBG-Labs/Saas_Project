import { mapPostgrestError } from '@/lib/errors';
import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type { Plan, PlanFeature, PlanWithFeatures, Subscription } from '@/types/domain';

import { DEFAULT_PLAN, PLAN_CODES, type FeatureKey, type PlanCode } from '../entitlements';

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
 * Code de la formule d'une organisation, lisible par TOUS ses membres.
 *
 * Ne lit pas `subscriptions` : cette table est réservée à `billing.view`, et
 * s'y fier faisait conclure « pas d'abonnement » à tout technicien — donc lui
 * refuser des écrans que le serveur lui aurait ouverts. La RPC applique
 * exactement le même calcul que les policies, expiration comprise, et n'expose
 * que le code.
 */
export async function getOrganizationPlanCode(organizationId: string): Promise<PlanCode> {
  const { data, error } = await supabase.rpc('organization_plan_code', {
    p_organization_id: organizationId,
  });

  if (error) throw mapPostgrestError(error);

  const known = PLAN_CODES.find((code) => code === data);
  return known ?? DEFAULT_PLAN;
}

/**
 * Plan effectif d'un abonnement.
 *
 * Sans abonnement lisible, on retombe sur `free`. Aucune exception, aucune liste
 * d'adresses privilégiées : le plan vient de `subscriptions`, la seule source
 * que la base consulte pour appliquer les droits. Toute dérogation côté client
 * afficherait des fonctionnalités que le serveur refuse.
 *
 * `plan_code` est une clé étrangère vers `plans`, mais reste un `string` dans les
 * types générés. La comparaison au tableau `PLAN_CODES` fait le pont, et écarte
 * un code de plan ajouté en base sans l'être dans le miroir.
 */
export function resolvePlanCode(subscription: Subscription | null): PlanCode {
  if (subscription === null) return DEFAULT_PLAN;

  const known = PLAN_CODES.find((code) => code === subscription.plan_code);
  return known ?? DEFAULT_PLAN;
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
