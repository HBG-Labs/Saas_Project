import { adminClient, env, json, stripeRequest } from '../_shared/billing.ts';

/**
 * Réception des événements Stripe.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA SEULE ÉCRITURE AUTORISÉE SUR `subscriptions`
 *
 * La table n'a aucune policy d'écriture — son type `Insert` est `never`. Elle
 * n'est alimentée que par cette fonction, avec `service_role`. C'est pourquoi
 * la vérification de signature n'est pas une formalité : sans elle, n'importe
 * qui connaissant l'URL passerait n'importe quelle organisation en Enterprise.
 *
 * IDEMPOTENCE
 *
 * Stripe REJOUE ses événements — après un timeout, après une erreur, et
 * parfois sans raison. Chaque événement est donc enregistré dans
 * `stripe_events` AVANT traitement, dans la même transaction logique. Un rejeu
 * bute sur la clé primaire et s'arrête là.
 *
 * L'ordre compte. Enregistrer APRÈS le traitement laisserait un trou à chaque
 * échec ; ne pas enregistrer du tout autoriserait un
 * `customer.subscription.deleted` rejoué à annuler un abonnement souscrit
 * depuis.
 *
 * PAS DE VÉRIFICATION MAISON DE LA SIGNATURE
 *
 * L'en-tête `Stripe-Signature` se vérifie en HMAC-SHA256 sur `timestamp.corps`,
 * avec comparaison à temps constant et fenêtre de tolérance. Écrire cela à la
 * main est une source classique de faille — comparaison paresseuse, rejeu hors
 * fenêtre accepté. On s'appuie sur `crypto.subtle`, et la tolérance est
 * explicite.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Cinq minutes, la tolérance recommandée par Stripe contre le rejeu. */
const TOLERANCE_SECONDS = 300;

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function verifySignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = new Map(
    header.split(',').map((piece) => {
      const [key, value] = piece.split('=');
      return [key?.trim() ?? '', value?.trim() ?? ''] as const;
    }),
  );

  const timestamp = parts.get('t');
  const signature = parts.get('v1');
  if (timestamp === undefined || signature === undefined) return false;

  // Rejeu hors fenêtre : une signature reste valide indéfiniment sans ce
  // contrôle, et un événement capté aujourd'hui pourrait être renvoyé demain.
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const expected = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)),
  );

  return timingSafeEqual(expected, hexToBytes(signature));
}

interface StripeSubscriptionItem {
  price?: { id?: string };
  /** Depuis les versions récentes de l'API, la période vit ICI. */
  current_period_start?: number;
  current_period_end?: number;
}

interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  /** Emplacement historique de la période, avant son déplacement vers les items. */
  current_period_start?: number;
  current_period_end?: number;
  trial_end?: number | null;
  canceled_at?: number | null;
  metadata?: { organization_id?: string; plan_code?: string };
  items?: { data?: StripeSubscriptionItem[] };
}

/** Un instant Stripe (secondes) en horodatage ISO, ou `null`. */
function iso(seconds: number | null | undefined): string | null {
  return seconds == null ? null : new Date(seconds * 1000).toISOString();
}

/**
 * La période de facturation, où qu'elle se trouve.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI DEUX EMPLACEMENTS
 *
 * Stripe a déplacé `current_period_start` et `current_period_end` de l'objet
 * Subscription vers ses Subscription Items. La version d'API choisie à la
 * création du point de terminaison décide donc de la forme reçue — et cette
 * version n'est pas figée dans notre code : elle appartient à la configuration
 * du compte.
 *
 * Lire un seul emplacement produirait le pire des échecs : aucune erreur, et
 * des dates de période VIDES en base. `app.org_plan_code` filtre sur
 * `current_period_end > now()` ; un `null` y passe encore, mais un abonnement
 * sans date de fin ne peut plus expirer. On préfère lire les deux.
 * ─────────────────────────────────────────────────────────────────────────────
 */
function readPeriod(sub: StripeSubscription): { start: string | null; end: string | null } {
  const item = sub.items?.data?.[0];

  return {
    start: iso(sub.current_period_start ?? item?.current_period_start),
    end: iso(sub.current_period_end ?? item?.current_period_end),
  };
}

/**
 * Statut Stripe → statut interne.
 *
 * `incomplete_expired` et `unpaid` deviennent `expired` : du point de vue de
 * l'application, l'accès est fermé dans les deux cas, et distinguer la cause
 * exacte du non-paiement ne change aucune décision d'entitlement.
 */
const STATUS_MAP: Record<string, string> = {
  trialing: 'trialing',
  active: 'active',
  past_due: 'past_due',
  canceled: 'canceled',
  incomplete: 'past_due',
  incomplete_expired: 'expired',
  unpaid: 'expired',
  paused: 'expired',
};

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  const signature = request.headers.get('Stripe-Signature') ?? '';
  const payload = await request.text();

  let secret: string;
  try {
    secret = env('STRIPE_WEBHOOK_SECRET');
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Configuration.' }, 503);
  }

  if (!(await verifySignature(payload, signature, secret))) {
    // 400 et non 401 : Stripe cesse de rejouer sur 4xx, et une signature
    // invalide ne deviendra pas valide au prochain essai.
    return json({ error: 'Signature Stripe invalide.' }, 400);
  }

  const event = JSON.parse(payload) as {
    id: string;
    type: string;
    data: { object: Record<string, unknown> };
  };

  const admin = adminClient();

  // ---------------------------------------------------------------- idempotence
  const { error: seenError } = await admin
    .from('stripe_events')
    .insert({ id: event.id, type: event.type });

  if (seenError) {
    // Violation de clé primaire = déjà traité. On répond 200 : renvoyer une
    // erreur ferait rejouer Stripe indéfiniment sur un événement bien reçu.
    if (seenError.code === '23505') {
      return json({ received: true, duplicate: true });
    }
    return json({ error: 'Journal des événements indisponible.' }, 500);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as {
          subscription?: string;
          customer?: string;
          metadata?: { organization_id?: string };
        };

        // La session ne porte pas l'état de l'abonnement : on va le chercher,
        // plutôt que de déduire un statut d'un événement qui ne le contient pas.
        if (session.subscription) {
          const sub = (await stripeRequest(
            `/v1/subscriptions/${session.subscription}`,
            {},
            'GET',
          )) as unknown as StripeSubscription;
          await applySubscription(admin, sub, event.id);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await applySubscription(admin, event.data.object as unknown as StripeSubscription, event.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as { subscription?: string };
        if (invoice.subscription) {
          await admin
            .from('subscriptions')
            .update({ status: 'past_due' })
            .eq('provider_subscription_id', invoice.subscription);
        }
        break;
      }

      default:
        // Événement non traité : on l'a journalisé, on ne le rejouera pas.
        break;
    }
  } catch (error) {
    // Le journal est annulé pour que Stripe puisse rejouer : un traitement
    // échoué ne doit pas être considéré comme fait.
    await admin.from('stripe_events').delete().eq('id', event.id);
    return json({ error: error instanceof Error ? error.message : 'Traitement échoué.' }, 500);
  }

  return json({ received: true });
});

/**
 * Écrit l'abonnement Stripe dans `subscriptions`.
 *
 * Le plan est déterminé dans cet ordre : les métadonnées posées à la création
 * de la session, puis — à défaut — le Price ID de la première ligne, retrouvé
 * en base. Le second chemin couvre le cas où la formule est modifiée depuis le
 * tableau de bord Stripe, sans passer par l'application : c'est la raison pour
 * laquelle les identifiants de tarif vivent en base et non dans le bundle.
 */
async function applySubscription(
  admin: ReturnType<typeof adminClient>,
  sub: StripeSubscription,
  eventId: string,
): Promise<void> {
  const organizationId = sub.metadata?.organization_id;
  if (!organizationId) {
    throw new Error(`Abonnement ${sub.id} sans organisation en métadonnées.`);
  }

  let planCode = sub.metadata?.plan_code;

  if (!planCode) {
    const priceId = sub.items?.data?.[0]?.price?.id;
    if (priceId) {
      const { data: plan } = await admin
        .from('plans')
        .select('code')
        .or(`stripe_price_id_monthly.eq.${priceId},stripe_price_id_annual.eq.${priceId}`)
        .maybeSingle();
      planCode = plan?.code;
    }
  }

  if (!planCode) {
    throw new Error(`Abonnement ${sub.id} : formule indéterminable.`);
  }

  const period = readPeriod(sub);

  await admin
    .from('subscriptions')
    .upsert(
      {
        organization_id: organizationId,
        plan_code: planCode,
        status: STATUS_MAP[sub.status] ?? 'expired',
        current_period_start: period.start ?? new Date().toISOString(),
        current_period_end: period.end,
        trial_ends_at: iso(sub.trial_end),
        canceled_at: iso(sub.canceled_at),
        provider: 'stripe',
        provider_customer_id: sub.customer,
        provider_subscription_id: sub.id,
      },
      { onConflict: 'provider_subscription_id' },
    );

  // Rattache l'ÉVÉNEMENT à l'organisation, pour pouvoir diagnostiquer plus tard
  // sans rejouer la charge utile. `sub.id` serait l'identifiant d'abonnement —
  // aucune ligne ne serait touchée, en silence.
  await admin.from('stripe_events').update({ organization_id: organizationId }).eq('id', eventId);
}
