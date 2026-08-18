import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Socle commun aux fonctions de facturation.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LE PRINCIPE QUI GOUVERNE CE FICHIER
 *
 * Le client ne décide de RIEN de ce qui coûte de l'argent. Il annonce une
 * intention — « je veux passer en Pro, en mensuel » — et le serveur recalcule
 * tout : le plan existe-t-il, l'appelant a-t-il le droit de payer pour cette
 * organisation, combien de sièges sont réellement actifs, quel est le tarif.
 *
 * Un corps de requête tel que `{ plan: 'enterprise', price: 19, seats: 0 }` ne
 * produit pas une erreur de validation : les champs `price` et `seats` ne sont
 * simplement jamais lus. C'est plus sûr que de les valider, parce qu'un champ
 * qu'on ne lit pas ne peut pas être mal validé.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export function env(name: string): string {
  const value = Deno.env.get(name);
  if (value === undefined || value === '') {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
}

/** Client agissant AVEC le jeton de l'appelant : la RLS s'applique. */
export function callerClient(authorization: string): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
  });
}

/** Client `service_role` : contourne la RLS. À réserver au webhook. */
export function adminClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
}

export interface BillingContext {
  organizationId: string;
  planCode: string;
  planName: string;
  includedSeats: number;
  activeSeats: number;
  extraSeats: number;
  totalCents: number;
}

/**
 * Vérifie le droit de facturer, puis lit la situation réelle.
 *
 * `billing.manage` est réservée au propriétaire — un administrateur gère les
 * membres, pas le moyen de paiement. La permission est lue dans
 * `role_permissions`, la table qui fait autorité : réécrire la matrice ici la
 * ferait diverger au premier changement de rôle.
 */
export async function requireBillingAccess(
  caller: SupabaseClient,
  organizationId: string,
): Promise<{ context: BillingContext } | { error: Response }> {
  const {
    data: { user },
  } = await caller.auth.getUser();

  if (!user) return { error: json({ error: 'Session invalide.' }, 401) };

  const { data: membership } = await caller
    .from('organization_members')
    .select('role, status')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.status !== 'active') {
    return { error: json({ error: "Vous n'appartenez pas à cette organisation." }, 403) };
  }

  const { data: permission } = await caller
    .from('role_permissions')
    .select('permission')
    .eq('role', membership.role)
    .eq('permission', 'billing.manage')
    .maybeSingle();

  if (!permission) {
    return {
      error: json({ error: "Seul le propriétaire peut gérer l'abonnement." }, 403),
    };
  }

  // La synthèse vient du SERVEUR, jamais du corps de la requête.
  const { data: summary, error } = await caller
    .rpc('organization_billing_summary', { p_organization_id: organizationId })
    .maybeSingle();

  if (error || !summary) {
    return { error: json({ error: "Facturation illisible pour cette organisation." }, 400) };
  }

  return {
    context: {
      organizationId,
      planCode: summary.plan_code,
      planName: summary.plan_name,
      includedSeats: summary.included_seats,
      activeSeats: summary.active_seats,
      extraSeats: summary.extra_seats,
      totalCents: summary.total_cents,
    },
  };
}

/**
 * Adresse de retour, après paiement ou après passage au portail.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE N'EST PAS UNE SIMPLE CONCATÉNATION
 *
 * La première version écrivait `${origin}/organisation/facturation`. Quand
 * l'en-tête `Origin` est absent — appel hors navigateur, script, certains
 * clients mobiles — la chaîne devenait `/organisation/facturation`, une URL
 * relative que Stripe refuse avec « Not a valid URL ».
 *
 * L'échec survenait donc au moment du paiement, sur un message qui ne désigne
 * rien de ce qui est en cause. Mesuré par `scripts/verify-stripe.mjs`.
 *
 * Trois sources, dans l'ordre : ce que l'appelant demande, l'origine de la
 * requête, puis `APP_URL`. Et une validation, parce qu'une URL de redirection
 * non contrôlée est un tremplin d'hameçonnage : on n'accepte que `http` et
 * `https`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function resolveReturnUrl(
  explicite: string | undefined,
  origin: string | null,
  chemin: string,
): string | null {
  const candidat =
    explicite ?? (origin !== null && origin !== '' ? `${origin}${chemin}` : undefined) ??
    (Deno.env.get('APP_URL') !== undefined ? `${Deno.env.get('APP_URL') ?? ''}${chemin}` : undefined);

  if (candidat === undefined) return null;

  try {
    const url = new URL(candidat);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export interface StripePrices {
  planPriceId: string;
  extraSeatPriceId: string;
}

/**
 * Identifiants de tarif Stripe du plan visé.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA FACTURATION EST MENSUELLE, ET SEULEMENT MENSUELLE
 *
 * Un abonnement Stripe ne peut pas mélanger deux périodicités : tous ses
 * articles partagent le même intervalle. Un forfait annuel accompagné de sièges
 * facturés au mois n'est donc pas exprimable, et facturer les sièges à l'année
 * n'était pas voulu.
 *
 * Plutôt que d'afficher un tarif annuel impossible à encaisser, ou de plafonner
 * en silence l'effectif des abonnés annuels, l'annuel n'est pas proposé. Les
 * colonnes `*_annual` subsistent en base, vides : le jour où la question sera
 * rouverte, le schéma est là.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Lus en BASE et non dans le paquet JavaScript : le webhook doit pouvoir faire
 * le chemin inverse — d'un `price_...` reçu, retrouver le plan — pour absorber
 * un changement effectué depuis le tableau de bord Stripe.
 */
export async function resolveStripePrices(
  client: SupabaseClient,
  planCode: string,
): Promise<StripePrices | { error: string }> {
  const { data: plan } = await client
    .from('plans')
    .select('stripe_price_id_monthly')
    .eq('code', planCode)
    .maybeSingle();

  const { data: settings } = await client
    .from('billing_settings')
    .select('extra_seat_price_id_monthly')
    .maybeSingle();

  const planPriceId = plan?.stripe_price_id_monthly;
  const extraSeatPriceId = settings?.extra_seat_price_id_monthly;

  if (!planPriceId || !extraSeatPriceId) {
    return {
      error:
        `Tarifs Stripe non configurés pour « ${planCode} ». ` +
        'Renseignez plans.stripe_price_id_monthly et billing_settings.extra_seat_price_id_monthly.',
    };
  }

  return { planPriceId, extraSeatPriceId };
}

/**
 * Appel de l'API Stripe en `application/x-www-form-urlencoded`.
 *
 * Pas de SDK : Stripe n'en publie pas pour Deno, et l'API REST tient en une
 * fonction. Une dépendance de plus dans une fonction Edge, c'est une surface de
 * plus à mettre à jour pour un gain nul ici.
 */
export async function stripeRequest(
  path: string,
  params: Record<string, string>,
  method: 'POST' | 'GET' = 'POST',
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams(params);
  const url = method === 'GET' ? `https://api.stripe.com${path}?${body.toString()}` : `https://api.stripe.com${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${env('STRIPE_SECRET_KEY')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      // Version épinglée : une évolution de l'API Stripe ne doit pas changer le
      // comportement de cette fonction sans qu'on l'ait décidé.
      'Stripe-Version': '2024-06-20',
    },
    ...(method === 'POST' ? { body } : {}),
  });

  const payload = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    const detail = (payload.error as { message?: string } | undefined)?.message ?? 'inconnue';
    throw new Error(`Stripe a refusé ${path} : ${detail}`);
  }

  return payload;
}

/** Suppression d'une ressource Stripe — retirer une ligne d'abonnement, par exemple. */
export async function stripeDelete(path: string): Promise<void> {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${env('STRIPE_SECRET_KEY')}`,
      'Stripe-Version': '2024-06-20',
    },
  });

  if (!response.ok) {
    const payload = (await response.json()) as { error?: { message?: string } };
    throw new Error(`Stripe a refusé la suppression ${path} : ${payload.error?.message ?? 'inconnue'}`);
  }
}
