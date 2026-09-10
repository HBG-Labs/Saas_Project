import {
  adminClient,
  CORS_HEADERS,
  callerClient,
  json,
  requireOrganizationMembership,
} from '../_shared/billing.ts';
import {
  completeSubscriptionSeatSyncJob,
  deferSubscriptionSeatSyncJob,
  getSubscriptionSeatSyncJob,
  synchronizeSubscriptionSeatJob,
  type SubscriptionSeatSyncJob,
} from '../_shared/subscription-seats.ts';

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
 * La base écrit désormais une tâche durable à chaque changement d'effectif et
 * l'ordonnanceur `subscription-seat-sync-worker` la reprend périodiquement.
 * Cette route utilisateur ne remplace pas la file : elle permet seulement de
 * la réveiller immédiatement après une action visible dans l'interface.
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface Body {
  organizationId?: string;
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

  // Déclencher cette remise en cohérence ne permet pas de choisir une quantité
  // ni un tarif : le serveur traite uniquement la tâche écrite par le trigger.
  // Tout membre actif peut donc la réveiller, y compris l'invité qui vient
  // d'accepter son invitation.
  const access = await requireOrganizationMembership(caller, organizationId, authorization);
  if ('error' in access) return access.error;

  const admin = adminClient();
  let job: SubscriptionSeatSyncJob | null = null;

  try {
    job = await getSubscriptionSeatSyncJob(admin, organizationId);
    if (!job) return json({ synced: true, reason: 'Aucune synchronisation en attente.' });

    const result = await synchronizeSubscriptionSeatJob(admin, job);
    await completeSubscriptionSeatSyncJob(admin, job);
    return json(result);
  } catch (error) {
    if (job) {
      try {
        await deferSubscriptionSeatSyncJob(admin, job, error);
      } catch (deferError) {
        console.error('sync-subscription-seats: reprise non planifiée', deferError);
      }
    }
    return json({ error: error instanceof Error ? error.message : 'Échec Stripe.' }, 502);
  }
});
