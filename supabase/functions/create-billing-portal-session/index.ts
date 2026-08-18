import {
  CORS_HEADERS,
  callerClient,
  json,
  requireBillingAccess,
  stripeRequest,
} from '../_shared/billing.ts';

/**
 * Ouverture du portail de facturation Stripe.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI DÉLÉGUER PLUTÔT QUE CONSTRUIRE
 *
 * Changer de carte, télécharger une facture, résilier : Stripe fournit un
 * portail pour cela, conforme et localisé. Le refaire supposerait de manipuler
 * des moyens de paiement dans notre interface — donc d'entrer dans le périmètre
 * PCI-DSS pour ne rien apporter au client.
 *
 * L'annulation faite depuis le portail revient par le webhook
 * (`customer.subscription.deleted`), qui met à jour `subscriptions`. Aucune
 * écriture n'est faite ici : cette fonction ouvre une porte, elle ne décide de
 * rien.
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface Body {
  organizationId?: string;
  returnUrl?: string;
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
  if (organizationId === '') return json({ error: 'organizationId est obligatoire.' }, 400);

  const caller = callerClient(authorization);

  const access = await requireBillingAccess(caller, organizationId);
  if ('error' in access) return access.error;

  const { data: subscription } = await caller
    .from('subscriptions')
    .select('provider_customer_id')
    .eq('organization_id', organizationId)
    .not('provider_customer_id', 'is', null)
    .maybeSingle();

  if (!subscription?.provider_customer_id) {
    // Une organisation en essai ou en formule Gratuite n'a pas de client
    // Stripe. Le dire clairement vaut mieux qu'un portail vide.
    return json(
      { error: "Aucun abonnement payant : il n'y a rien à gérer dans le portail." },
      400,
    );
  }

  try {
    const session = await stripeRequest('/v1/billing_portal/sessions', {
      customer: subscription.provider_customer_id,
      return_url: body.returnUrl ?? `${request.headers.get('origin') ?? ''}/organisation/facturation`,
    });

    return json({ url: session.url });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Échec Stripe.' }, 502);
  }
});
