#!/usr/bin/env node
/**
 * Contrôle d'aptitude au mode RÉEL de Stripe.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LE PIÈGE QUE CE SCRIPT EXISTE POUR ATTRAPER
 *
 * Le mode test et le mode réel de Stripe sont DEUX REGISTRES SÉPARÉS. Un
 * `price_...` créé en test n'existe pas en réel, et réciproquement. Rien dans
 * la forme de l'identifiant ne les distingue.
 *
 * Conséquence : on peut basculer `STRIPE_SECRET_KEY` en `sk_live_` en croyant
 * avoir terminé, laisser en base les tarifs de test, et ne le découvrir qu'au
 * premier vrai client — qui verra « No such price » au moment de payer. C'est
 * la panne la plus coûteuse possible, puisqu'elle ne se manifeste qu'en
 * production, sur un prospect qui avait sorti sa carte.
 *
 * Ce script relit donc CHAQUE identifiant de la base à travers la clé
 * réellement configurée, et refuse de conclure tant que l'un d'eux n'y répond
 * pas.
 *
 * CE QU'IL NE FAIT PAS : il n'encaisse rien et ne crée rien. Toutes ses
 * requêtes Stripe sont des lectures.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * USAGE
 *
 * Ajouter la clé secrète dans `.env.local` (jamais versionné, voir .gitignore) :
 *
 *     STRIPE_SECRET_KEY=sk_live_...
 *
 * puis :
 *
 *     node scripts/verify-stripe-live.mjs [email-proprietaire] [motdepasse]
 *
 * La clé n'est jamais affichée — seul son préfixe de mode l'est.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { readFileSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';

function readEnv() {
  const env = {};
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

const env = readEnv();
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const email = args[0] ?? 'business.owner@rezo360.test';
const password = args[1] ?? env.SEED_TEST_PASSWORD ?? 'Rezo360!2026';

let echecs = 0;
let alertes = 0;

function ok(condition, label, detail = '') {
  if (condition) {
    console.log(`  OK     ${label}`);
  } else {
    echecs += 1;
    console.error(`  ECHEC  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function alerte(label) {
  alertes += 1;
  console.warn(`  ALERTE ${label}`);
}

function titre(texte) {
  console.log(`\n${texte}`);
  console.log('─'.repeat(texte.length));
}

/** Lecture seule sur l'API Stripe. Aucune écriture n'est possible d'ici. */
async function stripeGet(chemin) {
  const reponse = await fetch(`https://api.stripe.com${chemin}`, {
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Stripe-Version': '2024-06-20',
    },
  });
  const charge = await reponse.json();
  if (!reponse.ok) {
    const message = charge?.error?.message ?? 'erreur inconnue';
    return { erreur: message, statut: reponse.status };
  }
  return charge;
}

function euros(cents) {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}

// ── 1. La clé et son mode ────────────────────────────────────────────────────
titre('1. Clé Stripe configurée');

if (!env.STRIPE_SECRET_KEY) {
  console.error("  ECHEC  STRIPE_SECRET_KEY absente de .env.local — rien à vérifier.");
  process.exit(1);
}

const cle = env.STRIPE_SECRET_KEY;
const estReel = cle.startsWith('sk_live_') || cle.startsWith('rk_live_');
const estTest = cle.startsWith('sk_test_') || cle.startsWith('rk_test_');

console.log(`  Mode détecté : ${estReel ? 'RÉEL (live)' : estTest ? 'TEST' : 'INDÉTERMINÉ'}`);
ok(estReel || estTest, 'Préfixe de clé reconnu', `commence par « ${cle.slice(0, 8)}… »`);

if (estTest) {
  alerte('Clé de TEST : ce contrôle vaut pour le registre de test, pas pour le réel.');
}

// ── 2. Le compte est-il réellement activé ? ──────────────────────────────────
titre('2. Compte Stripe');

const compte = await stripeGet('/v1/account');
if (compte.erreur) {
  ok(false, 'Lecture du compte', compte.erreur);
} else {
  console.log(`  Compte : ${compte.id}${compte.country ? ` (${compte.country})` : ''}`);
  ok(compte.charges_enabled === true, 'Encaissement autorisé (charges_enabled)');
  ok(compte.payouts_enabled === true, 'Virements autorisés (payouts_enabled)');
  const defauts = compte.requirements?.currently_due ?? [];
  if (defauts.length > 0) {
    alerte(`Stripe réclame encore : ${defauts.join(', ')}`);
  }
}

// ── 3. Les tarifs de la base existent-ils dans CE registre ? ─────────────────
titre('3. Tarifs de la base, relus à travers cette clé');

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error: erreurAuth } = await supabase.auth.signInWithPassword({ email, password });
if (erreurAuth) {
  // `billing_settings` exige une session ; `plans` non. On continue en dégradé
  // plutôt que d'abandonner, en signalant ce qui n'aura pas été vérifié.
  alerte(`Connexion à « ${email} » impossible (${erreurAuth.message}) — siège supplémentaire non vérifié.`);
}

const { data: plans } = await supabase
  .from('plans')
  .select('code, name, price_monthly_cents, stripe_price_id_monthly, status')
  .neq('code', 'free')
  .order('price_monthly_cents');

const { data: reglages } = await supabase
  .from('billing_settings')
  .select('extra_seat_price_id_monthly')
  .maybeSingle();

const aVerifier = [
  ...(plans ?? []).map((p) => ({
    libelle: `${p.name} (${p.code})`,
    priceId: p.stripe_price_id_monthly,
    centsAttendus: p.price_monthly_cents,
  })),
];

if (reglages?.extra_seat_price_id_monthly) {
  aVerifier.push({
    libelle: 'Siège supplémentaire',
    priceId: reglages.extra_seat_price_id_monthly,
    centsAttendus: null, // lu depuis plans.extra_user_price_cents, uniforme à 5 €
  });
}

for (const item of aVerifier) {
  if (!item.priceId) {
    ok(false, `${item.libelle} — identifiant de tarif absent en base`);
    continue;
  }

  const tarif = await stripeGet(`/v1/prices/${item.priceId}`);

  if (tarif.erreur) {
    ok(
      false,
      `${item.libelle} — ${item.priceId}`,
      tarif.statut === 404
        ? `INTROUVABLE dans le registre ${estReel ? 'RÉEL' : 'de TEST'} — c'est très probablement un tarif de l'autre mode`
        : tarif.erreur,
    );
    continue;
  }

  const bonneRecurrence = tarif.recurring?.interval === 'month' && tarif.recurring?.interval_count === 1;
  const bonneDevise = tarif.currency === 'eur';
  const bonMontant = item.centsAttendus === null || tarif.unit_amount === item.centsAttendus;

  ok(
    tarif.active && bonneRecurrence && bonneDevise && bonMontant,
    `${item.libelle} — ${item.priceId}`,
    [
      tarif.active ? '' : 'tarif ARCHIVÉ',
      bonneRecurrence ? '' : `récurrence ${tarif.recurring?.interval_count ?? '?'} × ${tarif.recurring?.interval ?? 'ponctuel'}`,
      bonneDevise ? '' : `devise ${tarif.currency}`,
      bonMontant ? '' : `montant Stripe ${euros(tarif.unit_amount)} ≠ base ${euros(item.centsAttendus)}`,
    ]
      .filter(Boolean)
      .join(', '),
  );

  if (tarif.active && bonneRecurrence && bonneDevise && bonMontant) {
    console.log(`         ${euros(tarif.unit_amount)} / mois`);
  }
}

// ── 4. Le webhook, sans quoi un paiement réussi ne s'inscrit nulle part ──────
titre('4. Endpoint webhook');

const urlAttendue = `${env.VITE_SUPABASE_URL}/functions/v1/stripe-webhook`;
const EVENEMENTS_REQUIS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
];

console.log(`  URL attendue : ${urlAttendue}`);

const endpoints = await stripeGet('/v1/webhook_endpoints?limit=100');
if (endpoints.erreur) {
  ok(false, 'Lecture des endpoints', endpoints.erreur);
} else {
  const cible = (endpoints.data ?? []).find((e) => e.url === urlAttendue);
  ok(cible !== undefined, 'Un endpoint pointe vers la fonction stripe-webhook');

  if (cible) {
    ok(cible.status === 'enabled', 'Endpoint activé', `statut « ${cible.status} »`);

    const couverts = new Set(cible.enabled_events ?? []);
    const tousEvenements = couverts.has('*');
    for (const evenement of EVENEMENTS_REQUIS) {
      ok(tousEvenements || couverts.has(evenement), `Événement écouté : ${evenement}`);
    }

    const superflus = [...couverts].filter((e) => e !== '*' && !EVENEMENTS_REQUIS.includes(e));
    if (superflus.length > 0) {
      // Pas une faute : le webhook ignore ce qu'il ne connaît pas. Mais chaque
      // événement inutile est une invocation de fonction facturée pour rien.
      alerte(`Événements écoutés mais non traités par le code : ${superflus.join(', ')}`);
    }
  } else if ((endpoints.data ?? []).length > 0) {
    console.log('  Endpoints existants dans ce registre :');
    for (const e of endpoints.data) console.log(`    - ${e.url} (${e.status})`);
  }
}

// ── Verdict ─────────────────────────────────────────────────────────────────
titre('Verdict');

if (echecs === 0) {
  console.log(
    `  Aucun échec${alertes > 0 ? `, ${alertes} alerte(s) à lire ci-dessus` : ''}.` +
      (estReel
        ? '\n  Le branchement RÉEL est cohérent : tarifs et webhook répondent sur la bonne clé.'
        : '\n  Registre de TEST vérifié. Relancer avec la clé sk_live_ avant toute vente.'),
  );
} else {
  console.error(`  ${echecs} échec(s), ${alertes} alerte(s). Ne pas ouvrir la vente en l'état.`);
}

await supabase.auth.signOut().catch(() => {});
process.exit(echecs === 0 ? 0 : 1);
