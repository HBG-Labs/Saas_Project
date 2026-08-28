import {
  CORS_HEADERS,
  adminClient,
  callerClient,
  json,
  requireBillingAccess,
  stripeRequest,
} from '../_shared/billing.ts';

/**
 * Résiliation programmée (rétrogradation vers Free) ou reprise d'abonnement.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CETTE FONCTION GÈRE
 *
 * - `action = 'cancel'` : Pose `cancel_at_period_end = true` chez Stripe
 *   et en base. L'accès reste actif jusqu'à la fin de période payée (0 € débité).
 * - `action = 'resume'` : Annule la résiliation programmée (`cancel_at_period_end = false`).
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface Body {
  organizationId?: string;
  action?: 'cancel' | 'resume';
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
  const action = body.action ?? 'cancel';

  if (organizationId === '') {
    return json({ error: 'organizationId est obligatoire.' }, 400);
  }

  const caller = callerClient(authorization);

  const access = await requireBillingAccess(caller, organizationId, authorization);
  if ('error' in access) return access.error;

  const { data: subscription } = await caller
    .from('subscriptions')
    .select('id, provider_subscription_id, status, current_period_end')
    .eq('organization_id', organizationId)
    .in('status', ['active', 'trialing', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!subscription) {
    return json({ error: 'Aucun abonnement actif trouvé pour cette organisation.' }, 404);
  }

  const admin = adminClient();
  const cancelAtPeriodEnd = action === 'cancel';

  // Si l'abonnement est géré par Stripe
  if (subscription.provider_subscription_id) {
    try {
      await stripeRequest(`/v1/subscriptions/${subscription.provider_subscription_id}`, {
        cancel_at_period_end: String(cancelAtPeriodEnd),
      });

      await admin
        .from('subscriptions')
        .update({
          cancel_at_period_end: cancelAtPeriodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      return json({
        success: true,
        cancelAtPeriodEnd,
        currentPeriodEnd: subscription.current_period_end,
      });
    } catch (error) {
      console.error('Erreur Stripe cancel/resume:', error);
      return json(
        { error: error instanceof Error ? error.message : 'Échec de la demande auprès de Stripe.' },
        502,
      );
    }
  }

  // Si c'est un essai sans Stripe
  if (action === 'cancel') {
    const { error: rpcErr } = await caller.rpc('cancel_organization_subscription', {
      p_organization_id: organizationId,
    });
    if (rpcErr) return json({ error: rpcErr.message }, 400);
  } else {
    const { error: rpcErr } = await caller.rpc('resume_organization_subscription', {
      p_organization_id: organizationId,
    });
    if (rpcErr) return json({ error: rpcErr.message }, 400);
  }

  return json({
    success: true,
    cancelAtPeriodEnd,
    currentPeriodEnd: subscription.current_period_end,
  });
});
