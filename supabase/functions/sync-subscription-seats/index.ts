import {
  CORS_HEADERS,
  callerClient,
  json,
  requireBillingAccess,
  resolveStripePrices,
  stripeDelete,
  stripeRequest,
} from '../_shared/billing.ts';

/**
 * Aligne la quantité de sièges facturés sur l'effectif réel.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUAND L'APPELER
 *
 * Après tout changement d'effectif : ajout d'un membre, acceptation d'une
 * invitation, retrait, suspension. L'appelant n'a rien à calculer — il signale
 * que l'effectif a bougé, le serveur relit et corrige.
 *
 * POURQUOI CE N'EST PAS UN TRIGGER POSTGRESQL
 *
 * Un trigger devrait appeler Stripe en HTTP depuis la base, via `pg_net`. Une
 * requête réseau dans une transaction est une mauvaise idée : elle allonge le
 * verrou, et son échec fait échouer l'ajout du membre. Perdre une
 * synchronisation de facturation est ennuyeux ; empêcher un dirigeant d'ajouter
 * un technicien parce que Stripe est lent ne l'est pas — c'est inacceptable.
 *
 * CE QUI RATTRAPE UN APPEL MANQUÉ
 *
 * Cette fonction est idempotente : elle peut être appelée dix fois de suite
 * sans effet cumulatif, puisqu'elle POSE une quantité au lieu de l'incrémenter.
 * Une organisation dont la synchronisation aurait échoué se recale au prochain
 * changement, ou à l'ouverture du portail de facturation.
 *
 * Reste un trou assumé : un ajout suivi d'aucun autre événement laisse Stripe
 * en retard jusqu'au mois suivant. Le combler demanderait une tâche
 * périodique — donc un planificateur, qui n'existe pas encore dans ce projet.
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface Body {
  organizationId?: string;
}

interface StripeItem {
  id: string;
  quantity?: number;
  price?: { id?: string };
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

  const { context } = access;

  const { data: subscription } = await caller
    .from('subscriptions')
    .select('provider_subscription_id, status')
    .eq('organization_id', organizationId)
    .not('provider_subscription_id', 'is', null)
    .maybeSingle();

  // Pas d'abonnement Stripe : essai en cours, ou formule Gratuite. Rien à
  // synchroniser, et ce n'est pas une erreur.
  if (!subscription?.provider_subscription_id) {
    return json({ synced: false, reason: 'Aucun abonnement Stripe pour cette organisation.' });
  }

  try {
    const remote = (await stripeRequest(
      `/v1/subscriptions/${subscription.provider_subscription_id}`,
      {},
      'GET',
    )) as { items?: { data?: StripeItem[] } };

    const items = remote.items?.data ?? [];

    const prices = await resolveStripePrices(caller, context.planCode);
    if ('error' in prices) return json({ error: prices.error }, 503);

    const seatItem = items.find((item) => item.price?.id === prices.extraSeatPriceId);

    // AUCUN PRÉLÈVEMENT ICI, ET C'EST EXPLICITE.
    //
    // `create_prorations` inscrit l'écart au prorata sur la PROCHAINE facture
    // mensuelle : ni carte demandée, ni paiement déclenché au moment où le
    // dirigeant ajoute un collaborateur. Un ajout en milieu de mois est facturé
    // pour les jours restants, un retrait produit un avoir de la même façon.
    //
    // C'est déjà le comportement par défaut de Stripe — raison de plus pour
    // l'écrire. Un défaut implicite qui décide d'un prélèvement est un défaut
    // qui peut changer sans nous, et le jour où il changerait, une carte serait
    // débitée sans que personne ici ait rien demandé. Le poser coûte un
    // paramètre ; ne pas le poser coûte une confiance.
    const auProchainRelevé = { proration_behavior: 'create_prorations' };

    // Trois situations, et chacune demande une instruction Stripe différente.
    if (context.extraSeats > 0 && seatItem) {
      await stripeRequest(`/v1/subscription_items/${seatItem.id}`, {
        quantity: String(context.extraSeats),
        ...auProchainRelevé,
      });
    } else if (context.extraSeats > 0) {
      await stripeRequest('/v1/subscription_items', {
        subscription: subscription.provider_subscription_id,
        price: prices.extraSeatPriceId,
        quantity: String(context.extraSeats),
        ...auProchainRelevé,
      });
    } else if (seatItem) {
      // Retour sous le seuil : on SUPPRIME la ligne au lieu de la mettre à
      // zéro. Une ligne « 0 × siège supplémentaire » figure sur la facture et
      // fait douter le client de ce qu'il paie.
      await stripeDelete(`/v1/subscription_items/${seatItem.id}`, auProchainRelevé);
    }

    // RELECTURE. Jusqu'ici cette fonction rendait compte de son INTENTION : elle
    // renvoyait le nombre de sièges qu'elle venait de demander, sans jamais
    // vérifier que Stripe l'avait retenu. Une réponse « synced: true » ne
    // prouvait donc rien — et c'est exactement l'angle mort qui avait laissé le
    // webhook journaliser des événements sans rien écrire.
    //
    // On relit l'abonnement et on renvoie ce que Stripe DÉTIENT. Un écart entre
    // `extraSeats` et `stripeQuantity` devient alors visible au lieu d'être
    // silencieux.
    const apres = (await stripeRequest(
      `/v1/subscriptions/${subscription.provider_subscription_id}`,
      {},
      'GET',
    )) as { items?: { data?: StripeItem[] } };

    const ligneSiege = (apres.items?.data ?? []).find(
      (item) => item.price?.id === prices.extraSeatPriceId,
    );
    const quantiteChezStripe = ligneSiege?.quantity ?? 0;

    return json({
      synced: quantiteChezStripe === context.extraSeats,
      activeSeats: context.activeSeats,
      includedSeats: context.includedSeats,
      extraSeats: context.extraSeats,
      /** Ce que Stripe facture réellement, relu après écriture. */
      stripeQuantity: quantiteChezStripe,
      totalCents: context.totalCents,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Échec Stripe.' }, 502);
  }
});
