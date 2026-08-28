import {
  CORS_HEADERS,
  adminClient,
  callerClient,
  json,
  requireBillingAccess,
  resolveReturnUrl,
  resolveStripePrices,
  resolveTrialEnd,
  stripeRequest,
} from '../_shared/billing.ts';

/**
 * Changement ou rétrogradation de formule (Upgrade & Downgrade).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CETTE FONCTION RÉSOUD
 *
 * Si l'organisation possède DÉJÀ un abonnement Stripe actif :
 *   1. Elle ne réouvre PAS de nouvelle session Checkout.
 *   2. Elle modifie directement l'abonnement chez Stripe via l'API.
 *   3. Elle applique `proration_behavior = 'create_prorations'` :
 *      - En cas de surclassement, la différence est calculée au prorata.
 *      - En cas de rétrogradation, AUCUN montant n'est débité. Le trop-perçu
 *        est crédité sur le compte du client pour les factures suivantes.
 *
 * Si l'organisation n'a PAS ENCORE d'abonnement Stripe (formule Free ou essai) :
 *   Elle génère une URL Checkout Stripe standard.
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface Body {
  organizationId?: string;
  planCode?: string;
  successUrl?: string;
  cancelUrl?: string;
}

interface StripeItem {
  id: string;
  quantity?: number;
  price?: { id?: string };
}

interface StripeSubscription {
  id: string;
  items?: { data?: StripeItem[] };
  current_period_end?: number;
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  const authorization = request.headers.get('Authorization') ?? '';
  if (authorization === '') return json({ error: 'Authentification requise.' }, 401);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ error: 'Corps de requête invalide.' }, 400);
  }

  const organizationId = body.organizationId ?? '';
  const planCode = body.planCode ?? '';

  if (organizationId === '' || planCode === '') {
    return json({ error: 'organizationId et planCode sont obligatoires.' }, 400);
  }

  if (planCode === 'free') {
    return json(
      {
        error:
          "Pour repasser sur la formule Gratuite, utilisez la résiliation d'abonnement.",
      },
      400,
    );
  }

  const caller = callerClient(authorization);

  // Vérifie les droits de gestion de la facturation
  const access = await requireBillingAccess(caller, organizationId, authorization);
  if ('error' in access) return access.error;

  const { context } = access;

  // Vérifie que le plan cible est valide
  const { data: targetPlan } = await caller
    .from('plans')
    .select('code, name, status, is_organization_plan')
    .eq('code', planCode)
    .maybeSingle();

  if (!targetPlan || targetPlan.status !== 'active' || !targetPlan.is_organization_plan) {
    return json({ error: 'Formule inconnue ou indisponible.' }, 400);
  }

  // Quotas de sièges inclus pour le plan cible
  const { data: targetSeats } = await caller
    .from('plan_features')
    .select('limit_value')
    .eq('plan_code', planCode)
    .eq('feature_key', 'members')
    .maybeSingle();

  const includedSeats = targetSeats?.limit_value ?? 0;
  const extraSeats = Math.max(0, context.activeSeats - includedSeats);

  const prices = await resolveStripePrices(caller, planCode);
  if ('error' in prices) return json({ error: prices.error }, 503);

  // Recherche d'un abonnement Stripe existant
  const { data: subscription } = await caller
    .from('subscriptions')
    .select('id, provider, provider_subscription_id, provider_customer_id, status')
    .eq('organization_id', organizationId)
    .in('status', ['active', 'trialing', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // =========================================================================
  // SCÉNARIO A : Abonnement Stripe existant -> Mise à jour directe in-place
  // =========================================================================
  if (subscription?.provider_subscription_id) {
    try {
      const subId = subscription.provider_subscription_id;
      const remote = (await stripeRequest(
        `/v1/subscriptions/${subId}`,
        {},
        'GET',
      )) as StripeSubscription;

      const items = remote.items?.data ?? [];
      const seatItem = items.find((item) => item.price?.id === prices.extraSeatPriceId);
      const planItem = items.find((item) => item.price?.id !== prices.extraSeatPriceId) ?? items[0];

      if (!planItem) {
        return json({ error: "L'abonnement Stripe ne contient aucune ligne de tarif." }, 500);
      }

      const updateParams: Record<string, string> = {
        proration_behavior: 'create_prorations',
        'metadata[organization_id]': organizationId,
        'metadata[plan_code]': planCode,
        'items[0][id]': planItem.id,
        'items[0][price]': prices.planPriceId,
        'items[0][quantity]': '1',
      };

      if (extraSeats > 0 && seatItem) {
        updateParams['items[1][id]'] = seatItem.id;
        updateParams['items[1][price]'] = prices.extraSeatPriceId;
        updateParams['items[1][quantity]'] = String(extraSeats);
      } else if (extraSeats > 0) {
        updateParams['items[1][price]'] = prices.extraSeatPriceId;
        updateParams['items[1][quantity]'] = String(extraSeats);
      } else if (seatItem) {
        updateParams['items[1][id]'] = seatItem.id;
        updateParams['items[1][deleted]'] = 'true';
      }

      // Si une résiliation était programmée, la mise à jour réactive l'abonnement
      updateParams.cancel_at_period_end = 'false';

      await stripeRequest(`/v1/subscriptions/${subId}`, updateParams);

      // Mise à jour immédiate côté base avec client admin
      const admin = adminClient();
      await admin
        .from('subscriptions')
        .update({
          plan_code: planCode,
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      return json({
        success: true,
        updatedInPlace: true,
        planCode,
        planName: targetPlan.name,
        includedSeats,
        extraSeats,
      });
    } catch (error) {
      console.error('Erreur update subscription Stripe:', error);
      return json(
        { error: error instanceof Error ? error.message : 'Échec de la modification Stripe.' },
        502,
      );
    }
  }

  // =========================================================================
  // SCÉNARIO B : Pas encore d'abonnement Stripe -> Session Checkout classique
  // =========================================================================
  const { data: essai } = await caller
    .from('subscriptions')
    .select('status, trial_ends_at, current_period_end')
    .eq('organization_id', organizationId)
    .eq('status', 'trialing')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const finEssai = resolveTrialEnd(essai);

  const origin = request.headers.get('origin');
  const successUrl = resolveReturnUrl(
    body.successUrl,
    origin,
    '/organisation/facturation?paiement=ok',
  );
  const cancelUrl = resolveReturnUrl(
    body.cancelUrl,
    origin,
    '/organisation/facturation?paiement=annule',
  );

  if (successUrl === null || cancelUrl === null) {
    return json(
      {
        error:
          'Adresse de retour introuvable. Transmettez successUrl et cancelUrl absolues.',
      },
      400,
    );
  }

  const checkoutParams: Record<string, string> = {
    mode: 'subscription',
    'line_items[0][price]': prices.planPriceId,
    'line_items[0][quantity]': '1',
    success_url: successUrl,
    cancel_url: cancelUrl,
    'metadata[organization_id]': organizationId,
    'metadata[plan_code]': planCode,
    'subscription_data[metadata][organization_id]': organizationId,
    'subscription_data[metadata][plan_code]': planCode,
    payment_method_collection: 'always',
  };

  if (finEssai !== null) {
    checkoutParams['subscription_data[trial_end]'] = String(finEssai);
    checkoutParams['subscription_data[trial_settings][end_behavior][missing_payment_method]'] = 'cancel';
  }

  if (extraSeats > 0) {
    checkoutParams['line_items[1][price]'] = prices.extraSeatPriceId;
    checkoutParams['line_items[1][quantity]'] = String(extraSeats);
  }

  if (subscription?.provider_customer_id) {
    checkoutParams.customer = subscription.provider_customer_id;
  }

  try {
    const session = await stripeRequest('/v1/checkout/sessions', checkoutParams);

    return json({
      success: true,
      updatedInPlace: false,
      url: session.url,
      planCode,
      includedSeats,
      extraSeats,
    });
  } catch (error) {
    console.error('Erreur checkout session:', error);
    return json(
      { error: error instanceof Error ? error.message : 'Échec ouverture Checkout Stripe.' },
      502,
    );
  }
});
