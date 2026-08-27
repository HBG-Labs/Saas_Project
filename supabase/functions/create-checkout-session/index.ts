import {
  CORS_HEADERS,
  callerClient,
  json,
  requireBillingAccess,
  resolveStripePrices,
  resolveReturnUrl,
  stripeRequest,
} from '../_shared/billing.ts';

/**
 * Ouverture d'une session de paiement Stripe.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE LE CLIENT PEUT DEMANDER, ET CE QU'IL NE PEUT PAS IMPOSER
 *
 * Il transmet trois choses : l'organisation, le plan visé, la périodicité.
 * Tout le reste — le prix, le nombre de sièges, le supplément — est recalculé
 * ici depuis la base. Un corps `{ plan: 'enterprise', price: 19, seats: 0 }`
 * n'échoue pas à la validation : `price` et `seats` ne sont jamais lus.
 *
 * DEUX LIGNES D'ABONNEMENT, PAS UNE PAR EFFECTIF
 *
 *   ligne 1 : le plan            quantity = 1
 *   ligne 2 : le siège en plus   quantity = sièges au-delà des inclus
 *
 * Un tarif unique à 5 € dont seule la quantité varie. Créer un tarif par
 * effectif possible — la faute classique — produirait des centaines
 * d'identifiants pour exprimer une multiplication.
 *
 * Free n'a AUCUN abonnement Stripe : une souscription à 0 € coûterait un objet
 * à synchroniser, à renouveler et à annuler, pour zéro euro encaissé.
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface Body {
  organizationId?: string;
  planCode?: string;
  successUrl?: string;
  cancelUrl?: string;
}

/** Minimum imposé par Stripe entre maintenant et un `trial_end` accepté. */
const MINIMUM_ESSAI_MS = 48 * 60 * 60 * 1000;

/**
 * L'échéance d'essai à reprendre dans l'abonnement Stripe, en secondes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI LE RELIQUAT SUIT LE CLIENT
 *
 * Sans ce paramètre, souscrire pendant l'essai le referme et débite aussitôt.
 * Mesuré : une organisation créée à 21:41, avec un essai courant jusqu'au 1er
 * septembre, a été prélevée à 21:43 — quatorze jours d'essai perdus pour avoir
 * décidé trop tôt.
 *
 * Le produit punissait donc celui qui s'abonne vite, et le client rationnel
 * attendait le dernier jour — jour où il n'est pas connecté. En reprenant
 * l'échéance déjà annoncée, s'abonner ne coûte plus rien avant la date promise,
 * puis le renouvellement se fait tout seul. On garde l'inscription sans carte,
 * et on gagne la conversion automatique.
 *
 * UN HORODATAGE ABSOLU, PAS UN NOMBRE DE JOURS
 *
 * `trial_period_days` ne prend qu'un entier : il arrondirait, et déplacerait la
 * date affichée à l'écran. On promet une date, on transmet cette date.
 *
 * LE SEUIL DE 48 HEURES
 *
 * Stripe refuse un `trial_end` trop proche. En deçà, on n'envoie rien et le
 * prélèvement est immédiat — comportement d'aujourd'hui. Le dire ici évite un
 * refus opaque au moment du paiement, sur un message qui ne désigne rien.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function resolveTrialEnd(
  essai: { status?: string | null; trial_ends_at?: string | null; current_period_end?: string | null } | null,
): number | null {
  if (!essai || essai.status !== 'trialing') return null;

  const brut = essai.trial_ends_at ?? essai.current_period_end;
  if (brut == null) return null;

  const echeance = new Date(brut).getTime();
  if (Number.isNaN(echeance)) return null;

  if (echeance - Date.now() < MINIMUM_ESSAI_MS) return null;

  return Math.floor(echeance / 1000);
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
    return json({ error: "La formule Gratuite ne se souscrit pas : elle est l'état par défaut." }, 400);
  }

  const caller = callerClient(authorization);

  // Droit de facturer + situation réelle de l'organisation.
  const access = await requireBillingAccess(caller, organizationId, authorization);
  if ('error' in access) return access.error;

  // Le plan VISÉ, qui n'est pas forcément le plan courant.
  const { data: targetPlan } = await caller
    .from('plans')
    .select('code, name, status, is_organization_plan')
    .eq('code', planCode)
    .maybeSingle();

  if (!targetPlan || targetPlan.status !== 'active' || !targetPlan.is_organization_plan) {
    return json({ error: 'Formule inconnue ou indisponible pour une organisation.' }, 400);
  }

  // Sièges inclus dans le plan VISÉ : passer de Pro à Business change le seuil,
  // donc le supplément. Lire ceux du plan courant facturerait de travers.
  const { data: targetSeats } = await caller
    .from('plan_features')
    .select('limit_value')
    .eq('plan_code', planCode)
    .eq('feature_key', 'members')
    .maybeSingle();

  const includedSeats = targetSeats?.limit_value ?? 0;
  const extraSeats = Math.max(0, access.context.activeSeats - includedSeats);

  const prices = await resolveStripePrices(caller, planCode);
  if ('error' in prices) return json({ error: prices.error }, 503);

  const { data: existing } = await caller
    .from('subscriptions')
    .select('provider_customer_id')
    .eq('organization_id', organizationId)
    .not('provider_customer_id', 'is', null)
    .maybeSingle();

  // L'essai EN COURS, s'il y en a un. Lu séparément de `existing`, qui ne
  // retient que les lignes portant déjà un client Stripe : une organisation en
  // essai n'en a précisément aucun.
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
          "Adresse de retour introuvable. Transmettez `successUrl` et `cancelUrl` absolues, " +
          'ou configurez le secret APP_URL.',
      },
      400,
    );
  }

  const params: Record<string, string> = {
    mode: 'subscription',
    'line_items[0][price]': prices.planPriceId,
    'line_items[0][quantity]': '1',
    success_url: successUrl,
    cancel_url: cancelUrl,
    // Ces métadonnées sont la SEULE façon pour le webhook de rattacher un
    // événement Stripe à une organisation. Sans elles, un paiement réussi
    // n'aurait nulle part où s'inscrire.
    'metadata[organization_id]': organizationId,
    'metadata[plan_code]': planCode,
    'subscription_data[metadata][organization_id]': organizationId,
    'subscription_data[metadata][plan_code]': planCode,
    // EXPLICITE, et non laissé au défaut de Stripe. Avec un essai, Checkout
    // peut décider de ne pas réclamer de carte ; sans carte, l'abonnement
    // s'éteindrait à l'échéance au lieu de se renouveler, et toute l'opération
    // perdrait son objet. Même principe que `proration_behavior` : un défaut
    // implicite qui décide d'un prélèvement peut changer sans nous.
    payment_method_collection: 'always',
  };

  if (finEssai !== null) {
    params['subscription_data[trial_end]'] = String(finEssai);
    // À l'échéance, sans moyen de paiement valide, on s'ARRÊTE plutôt que
    // d'émettre une facture impayée. Une créance ouverte sur un client qui
    // n'a jamais payé n'apporte rien ; l'organisation retombe sur Gratuit par
    // le chemin déjà éprouvé, ses données intactes.
    params['subscription_data[trial_settings][end_behavior][missing_payment_method]'] = 'cancel';
  }

  // La seconde ligne n'existe que s'il y a un dépassement : une quantité nulle
  // ferait apparaître « 0 × siège supplémentaire » sur la facture du client.
  if (extraSeats > 0) {
    params['line_items[1][price]'] = prices.extraSeatPriceId;
    params['line_items[1][quantity]'] = String(extraSeats);
  }

  if (existing?.provider_customer_id) {
    params.customer = existing.provider_customer_id;
  }

  try {
    const session = await stripeRequest('/v1/checkout/sessions', params);

    return json({
      url: session.url,
      // Renvoyé pour affichage : l'utilisateur doit voir ce qu'il s'apprête à
      // payer AVANT d'être redirigé, et ce montant vient du serveur.
      planCode,
      includedSeats,
      activeSeats: access.context.activeSeats,
      extraSeats,
      /**
       * Date jusqu'à laquelle rien ne sera prélevé, ou `null` si le paiement
       * est immédiat. Renvoyée pour que l'écran puisse le dire AVANT la
       * redirection : « vous ne serez pas débité avant le 1er septembre » n'a
       * de valeur qu'annoncé au moment du choix.
       */
      trialEnd: finEssai === null ? null : new Date(finEssai * 1000).toISOString(),
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Échec Stripe.' }, 502);
  }
});
