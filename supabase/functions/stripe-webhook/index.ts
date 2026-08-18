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
  cancel_at_period_end?: boolean;
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
        // On RELIT l'abonnement chez Stripe au lieu de croire la charge utile.
        //
        // ─────────────────────────────────────────────────────────────────
        // POURQUOI NE PAS FAIRE CONFIANCE À L'ÉVÉNEMENT REÇU
        //
        // Un événement décrit l'objet À L'INSTANT où il a été émis. Rien ne
        // garantit l'ordre d'arrivée : Stripe rejoue après un échec, et un
        // rejeu manuel se fait dans l'ordre où l'on clique.
        //
        // Mesuré : un `subscription.updated` reçu à 03:47:27, puis un
        // `subscription.created` à 03:47:36. Le second est pourtant ANTÉRIEUR
        // dans la vie de l'abonnement — il le décrivait `incomplete`, avant
        // confirmation du paiement. En l'appliquant après, l'abonnement est
        // repassé en « paiement en retard » alors qu'il était réglé.
        //
        // Une comparaison d'horodatages corrigerait ce cas précis. Relire
        // l'objet supprime la classe entière : quel que soit l'événement, quel
        // que soit son âge, on écrit l'état COURANT. Le coût est un appel
        // d'API par événement — dérisoire au regard d'un abonnement affiché
        // comme impayé.
        // ─────────────────────────────────────────────────────────────────
        const recu = event.data.object as unknown as StripeSubscription;

        const courant = (await stripeRequest(
          `/v1/subscriptions/${recu.id}`,
          {},
          'GET',
        )) as unknown as StripeSubscription;

        // Les métadonnées voyagent avec l'événement et peuvent manquer sur
        // l'objet relu si elles ont été posées à la session : on les conserve.
        await applySubscription(
          admin,
          { ...courant, metadata: courant.metadata ?? recu.metadata },
          event.id,
        );
        break;
      }

      case 'invoice.payment_failed': {
        // MÊME TRAITEMENT QUE LES ÉVÉNEMENTS D'ABONNEMENT, et pour les mêmes
        // raisons. Cette branche écrivait `past_due` en dur, sans relire Stripe
        // et sans vérifier son écriture. Deux défauts déjà payés ailleurs :
        //
        //   • déduire un statut de l'événement plutôt que de l'objet. Un échec
        //     de paiement suivi d'un règlement produit trois `payment_failed`
        //     puis un abonnement `active` — observé tel quel : trois échecs à
        //     21:43, succès à 21:44. Qu'un rejeu tardif de l'un des trois
        //     arrive après, et l'abonnement réglé repassait « en retard » ;
        //   • ne pas contrôler le résultat de l'écriture. C'est exactement ce
        //     qui avait laissé encaisser un paiement sans accorder de droits,
        //     sans la moindre alarme.
        //
        // `applySubscription` fait les deux correctement : on relit, on lui
        // passe l'objet courant, elle lève si l'écriture échoue — et
        // l'événement est alors retiré du journal pour que Stripe rejoue.
        const invoice = event.data.object as { subscription?: string };

        if (invoice.subscription) {
          const courant = (await stripeRequest(
            `/v1/subscriptions/${invoice.subscription}`,
            {},
            'GET',
          )) as unknown as StripeSubscription;

          await applySubscription(admin, courant, event.id);
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
  let organizationId = sub.metadata?.organization_id;

  if (!organizationId) {
    // REPLI PAR IDENTIFIANT. Nos sessions de paiement posent l'organisation en
    // métadonnées, mais deux cas y échappent : un abonnement créé à la main
    // depuis le tableau de bord Stripe, et `invoice.payment_failed`, dont
    // l'objet est une facture — elle ne transporte pas les métadonnées de
    // l'abonnement, seulement son identifiant.
    //
    // Si nous connaissons déjà cet abonnement, son organisation est inscrite
    // chez nous : c'est une source aussi sûre que les métadonnées, et elle
    // évite qu'un échec de paiement tourne en boucle de rejeu faute de savoir
    // à qui l'imputer.
    const { data: connu } = await admin
      .from('subscriptions')
      .select('organization_id')
      .eq('provider_subscription_id', sub.id)
      .maybeSingle();

    organizationId = connu?.organization_id ?? undefined;
  }

  if (!organizationId) {
    throw new Error(`Abonnement ${sub.id} sans organisation connue ni en métadonnées.`);
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
  const status = STATUS_MAP[sub.status] ?? 'expired';
  const estVivant = status === 'trialing' || status === 'active' || status === 'past_due';

  // ---------------------------------------------------------------------------
  // L'ESSAI EN COURS CÈDE LA PLACE À L'ABONNEMENT PAYÉ
  // ---------------------------------------------------------------------------
  //
  // `subscriptions_active_org_idx` n'admet qu'UN abonnement vivant par
  // organisation — sans quoi les droits dépendraient de l'ordre de lecture.
  // Or `app.start_organization_trial` en a déjà ouvert un à la création de
  // l'entreprise.
  //
  // Insérer l'abonnement Stripe sans refermer l'essai viole donc cet index.
  // C'est exactement ce qui s'est produit au premier paiement réel : l'erreur
  // n'était pas contrôlée, le webhook répondait 200, journalisait l'événement
  // comme traité — et l'abonnement n'était écrit nulle part. Stripe ne
  // rejouait jamais, puisqu'on lui avait dit que tout allait bien.
  if (estVivant) {
    const { error: closeError } = await admin
      .from('subscriptions')
      .update({ status: 'canceled', canceled_at: new Date().toISOString() })
      .eq('organization_id', organizationId)
      .in('status', ['trialing', 'active', 'past_due'])
      // `or` et non deux filtres enchaînés. La version précédente combinait
      // `.neq(sub.id)` ET `.is(null)` : sur une ligne dont la colonne vaut
      // NULL, `NULL <> 'sub_x'` ne vaut pas TRUE mais NULL. Les deux
      // conditions ne pouvaient donc JAMAIS être vraies ensemble, l'essai
      // n'était jamais refermé, et l'insertion violait l'index d'unicité.
      //
      // Deux cas à fermer, et un seul s'exprime par une égalité : l'essai, qui
      // n'a pas d'abonnement Stripe, et un éventuel abonnement Stripe
      // ANTÉRIEUR, qui en a un différent.
      .or(`provider_subscription_id.is.null,provider_subscription_id.neq.${sub.id}`);

    if (closeError) {
      throw new Error(`Clôture de l'essai impossible : ${closeError.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // L'ÉCRITURE, ET SON ERREUR CONTRÔLÉE
  // ---------------------------------------------------------------------------
  //
  // `supabase-js` ne LÈVE PAS : il renvoie `{ data, error }`. Un `await` sans
  // vérification laisse donc passer un échec en silence — sur la seule écriture
  // qui compte de tout le système de facturation.
  const { error: upsertError } = await admin.from('subscriptions').upsert(
    {
      organization_id: organizationId,
      plan_code: planCode,
      status,
      current_period_start: period.start ?? new Date().toISOString(),
      current_period_end: period.end,
      trial_ends_at: iso(sub.trial_end),
      canceled_at: iso(sub.canceled_at),
      // Miroir du champ Stripe homonyme. Sans lui, une résiliation faite depuis
      // le portail resterait invisible chez nous jusqu'à son échéance : Stripe
      // n'envoie alors qu'un `subscription.updated` où seul ce drapeau change,
      // et l'entreprise verrait son abonnement décrit comme actif jusqu'au jour
      // où il s'éteint sans prévenir.
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      provider: 'stripe',
      provider_customer_id: sub.customer,
      provider_subscription_id: sub.id,
    },
    { onConflict: 'provider_subscription_id' },
  );

  if (upsertError) {
    // Relancé pour que l'appelant retire l'événement du journal : Stripe
    // rejouera, au lieu de considérer un échec comme un succès.
    throw new Error(`Écriture de l'abonnement ${sub.id} impossible : ${upsertError.message}`);
  }

  await admin.from('stripe_events').update({ organization_id: organizationId }).eq('id', eventId);
}
