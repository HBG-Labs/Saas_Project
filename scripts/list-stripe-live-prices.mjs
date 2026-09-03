#!/usr/bin/env node
/**
 * Rapprochement des tarifs Stripe et des formules de la base.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI UN SCRIPT PLUTÔT QU'UN COPIER-COLLER
 *
 * Passer en mode réel suppose d'inscrire cinq `price_...` en base. Recopiés à
 * la main depuis le tableau de bord, ils offrent cinq occasions de se tromper
 * d'un caractère — et une erreur de ce genre ne se voit nulle part : la base
 * accepte n'importe quelle chaîne, l'application démarre normalement, et
 * l'échec n'apparaît qu'au moment où un client clique sur « Payer ».
 *
 * Le rapprochement se fait donc sur le MONTANT, qui est déjà en base et qui
 * distingue les cinq lignes sans ambiguïté (19, 39, 69, 99 et 5 €). Le script
 * n'invente rien : il refuse de conclure dès qu'un montant ne tombe pas sur
 * exactement un tarif Stripe.
 *
 * LECTURE SEULE, ET RIEN D'AUTRE. Il n'écrit ni chez Stripe ni en base : il
 * imprime le SQL à relire, qui deviendra une migration.
 *
 *     node scripts/list-stripe-live-prices.mjs
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

if (!env.STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY absente de .env.local. Ajoutez la ligne, puis relancez.');
  process.exit(1);
}

const estReel = env.STRIPE_SECRET_KEY.startsWith('sk_live_') || env.STRIPE_SECRET_KEY.startsWith('rk_live_');
console.log(`Registre interrogé : ${estReel ? 'RÉEL (live)' : 'TEST'}\n`);
if (!estReel) {
  console.warn('⚠  Clé de TEST : les identifiants ci-dessous ne vaudront pas en réel.\n');
}

function euros(cents) {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}

// ── Ce que la base attend ────────────────────────────────────────────────────
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: plans, error } = await supabase
  .from('plans')
  .select('code, name, price_monthly_cents, extra_user_price_cents')
  .neq('code', 'free')
  .order('price_monthly_cents');

if (error || !plans?.length) {
  console.error('Lecture des formules impossible :', error?.message ?? 'aucune formule');
  process.exit(1);
}

// Le siège supplémentaire est uniforme entre formules : on prend la valeur
// telle qu'elle est, sans la supposer.
const montantsSiege = [...new Set(plans.map((p) => p.extra_user_price_cents))];
if (montantsSiege.length !== 1) {
  console.error(`Le prix du siège supplémentaire diffère selon les formules : ${montantsSiege.join(', ')}. Rapprochement impossible.`);
  process.exit(1);
}

const attendus = [
  ...plans.map((p) => ({ cle: p.code, libelle: p.name, cents: p.price_monthly_cents })),
  { cle: '__siege__', libelle: 'Siège supplémentaire', cents: montantsSiege[0] },
];

// ── Ce que Stripe propose ────────────────────────────────────────────────────
const reponse = await fetch(
  'https://api.stripe.com/v1/prices?active=true&limit=100&expand[]=data.product',
  {
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Stripe-Version': '2024-06-20',
    },
  },
);

const charge = await reponse.json();
if (!reponse.ok) {
  console.error('Stripe a refusé la lecture :', charge?.error?.message ?? 'erreur inconnue');
  process.exit(1);
}

const mensuelsEuros = (charge.data ?? []).filter(
  (p) =>
    p.recurring?.interval === 'month' &&
    p.recurring?.interval_count === 1 &&
    p.currency === 'eur',
);

console.log(`${mensuelsEuros.length} tarif(s) mensuel(s) en euros trouvé(s) chez Stripe.\n`);

// ── Rapprochement ────────────────────────────────────────────────────────────
let bloquant = 0;
const resolus = new Map();

for (const attendu of attendus) {
  const candidats = mensuelsEuros.filter((p) => p.unit_amount === attendu.cents);

  if (candidats.length === 1) {
    const nom = candidats[0].product?.name ?? '(produit sans nom)';
    resolus.set(attendu.cle, candidats[0].id);
    console.log(`  OK      ${attendu.libelle.padEnd(24)} ${euros(attendu.cents).padStart(9)}  ${candidats[0].id}`);
    console.log(`          « ${nom} »`);
  } else if (candidats.length === 0) {
    bloquant += 1;
    console.error(`  MANQUE  ${attendu.libelle.padEnd(24)} ${euros(attendu.cents).padStart(9)}  aucun tarif à ce montant`);
  } else {
    bloquant += 1;
    console.error(`  AMBIGU  ${attendu.libelle.padEnd(24)} ${euros(attendu.cents).padStart(9)}  ${candidats.length} tarifs à ce montant :`);
    for (const c of candidats) {
      console.error(`            ${c.id} — « ${c.product?.name ?? '?'} »`);
    }
  }
}

const restants = mensuelsEuros.filter((p) => ![...resolus.values()].includes(p.id));
if (restants.length > 0) {
  console.log('\nTarifs Stripe non rattachés à une formule (ce n’est pas une faute) :');
  for (const p of restants) {
    console.log(`    ${p.id}  ${euros(p.unit_amount).padStart(9)}  « ${p.product?.name ?? '?'} »`);
  }
}

// ── Le SQL à relire ──────────────────────────────────────────────────────────
if (bloquant > 0) {
  console.error(`\n${bloquant} rapprochement(s) impossible(s). Corrigez les tarifs chez Stripe avant d’aller plus loin.`);
  process.exit(1);
}

console.log('\n──────── SQL à relire, puis à verser en migration ────────\n');
for (const plan of plans) {
  console.log(
    `update public.plans set stripe_price_id_monthly = '${resolus.get(plan.code)}' where code = '${plan.code}';`,
  );
}
console.log(
  `update public.billing_settings set extra_seat_price_id_monthly = '${resolus.get('__siege__')}' where id;`,
);
console.log('');
