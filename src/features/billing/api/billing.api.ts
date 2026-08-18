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

  const rawCode = subscription.plan_code;
  if (rawCode === 'ultimate') return 'enterprise';

  const known = PLAN_CODES.find((code) => code === rawCode);
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

/**
 * Situation de facturation d'une organisation, calculée par le SERVEUR.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CETTE FONCTION NE CALCULE RIEN
 *
 * Sièges inclus, effectif, dépassement et montant viennent tous de la RPC
 * `organization_billing_summary`. La tentation serait de les recomposer ici à
 * partir de `PRICING_PLANS` et du nombre de membres — c'est une multiplication,
 * après tout.
 *
 * Mais deux implémentations du même barème divergent, et celle qui diverge en
 * silence est celle qu'on affiche. Ici, ce serait le montant d'une facture :
 * l'écran annoncerait 39 € et le prélèvement serait de 49 €. `computeSubscriptionPrice`
 * de `config/pricing.ts` reste utile pour la page tarifaire PUBLIQUE, où aucune
 * organisation n'existe encore — jamais pour un montant réellement dû.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export interface BillingSummary {
  planCode: PlanCode;
  planName: string;
  includedSeats: number;
  activeSeats: number;
  extraSeats: number;
  extraSeatCents: number;
  baseCents: number;
  totalCents: number;
  /** `null` = aucun plafond ; le dépassement est facturé, pas refusé. */
  maxUsers: number | null;
}

export async function getBillingSummary(organizationId: string): Promise<BillingSummary | null> {
  const row = await unwrapMaybe(
    supabase.rpc('organization_billing_summary', { p_organization_id: organizationId }).maybeSingle(),
  );

  if (row === null) return null;

  return {
    planCode: resolvePlanCode({ plan_code: row.plan_code } as Subscription),
    planName: row.plan_name,
    includedSeats: row.included_seats,
    activeSeats: row.active_seats,
    extraSeats: row.extra_seats,
    extraSeatCents: row.extra_seat_cents,
    baseCents: row.base_cents,
    totalCents: row.total_cents,
    maxUsers: row.max_users,
  };
}

/**
 * Aligne la quantité de sièges facturés sur l'effectif réel.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CET APPEL NE DOIT JAMAIS FAIRE ÉCHOUER SON APPELANT
 *
 * Ajouter un technicien et synchroniser la facturation sont deux gestes de
 * nature différente. Le premier est un acte métier que le dirigeant attend ; le
 * second est une conséquence comptable. Faire dépendre l'un de l'autre
 * reviendrait à empêcher l'embauche parce que Stripe est lent.
 *
 * Cette fonction absorbe donc ses propres échecs et renvoie `false`. La
 * fonction Edge est idempotente — elle POSE une quantité au lieu de
 * l'incrémenter — de sorte qu'une synchronisation manquée se rattrape au
 * changement suivant.
 *
 * Reste un trou assumé, décrit dans `README-STRIPE.md` : un ajout isolé, suivi
 * d'aucun autre mouvement, laisse Stripe en retard jusqu'à la prochaine
 * modification d'effectif.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function syncSubscriptionSeats(organizationId: string): Promise<boolean> {
  try {
    // `invoke` déclare son retour en `any` : sans annotation explicite, la
    // déstructuration propagerait ce `any` dans tout l'appelant.
    const response: { data: { synced?: boolean } | null; error: unknown } =
      await supabase.functions.invoke<{ synced?: boolean }>('sync-subscription-seats', {
        body: { organizationId },
      });

    if (response.error !== null) return false;
    return response.data?.synced === true;
  } catch {
    return false;
  }
}
