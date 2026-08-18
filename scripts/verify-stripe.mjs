#!/usr/bin/env node
/**
 * Vérification de bout en bout du branchement Stripe.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CE SCRIPT PROUVE, ET CE QU'IL NE PROUVE PAS
 *
 * Il ouvre une vraie session de paiement sur le compte Stripe en mode test, en
 * s'authentifiant avec un compte de démonstration. Il vérifie que le montant
 * annoncé vient du SERVEUR, que le droit de facturer est contrôlé, et que les
 * tarifs manquants sont signalés plutôt qu'ignorés.
 *
 * Il ne va PAS jusqu'au paiement : saisir une carte suppose un navigateur. La
 * dernière étape — l'arrivée de l'abonnement en base par le webhook — se
 * vérifie en réglant réellement la session, ou par « Send test webhook » depuis
 * le tableau de bord Stripe.
 *
 *   node scripts/verify-stripe.mjs [email] [motdepasse]
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
const email = args[0] ?? 'owner.a@nexoratech.local';
const password = args[1] ?? env.SEED_TEST_PASSWORD;

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let failures = 0;

function ok(condition, label, detail = '') {
  if (condition) {
    console.log(`  OK    ${label}`);
  } else {
    failures += 1;
    console.error(`  ECHEC ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function callFunction(name, body, token) {
  const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });

  return { status: response.status, payload: await response.json() };
}

// ---------------------------------------------------------------- 1. session
const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
  email,
  password,
});

if (authError || !auth.session) {
  console.error(`Connexion impossible pour ${email} : ${authError?.message ?? 'inconnue'}`);
  process.exit(1);
}

const token = auth.session.access_token;
console.log(`\nConnecté : ${email}\n`);

// ------------------------------------------------- 2. l'organisation et son état
const { data: memberships } = await supabase
  .from('organization_members')
  .select('organization_id, role')
  .eq('user_id', auth.user.id)
  .eq('status', 'active');

const organizationId = memberships?.[0]?.organization_id;
if (!organizationId) {
  console.error("Ce compte n'appartient à aucune organisation active.");
  process.exit(1);
}

console.log('▶ Synthèse de facturation, calculée par le serveur');

const { data: summary, error: summaryError } = await supabase
  .rpc('organization_billing_summary', { p_organization_id: organizationId })
  .maybeSingle();

ok(!summaryError && summary !== null, 'La RPC de synthèse répond', summaryError?.message);

if (summary) {
  const attendu =
    summary.plan_code === 'free'
      ? 0
      : summary.base_cents + summary.extra_seats * summary.extra_seat_cents;

  console.log(
    `        ${summary.plan_name} · ${summary.active_seats} sièges actifs ` +
      `(${summary.included_seats} inclus, ${summary.extra_seats} en supplément) ` +
      `= ${(summary.total_cents / 100).toFixed(2)} €`,
  );

  ok(summary.total_cents === attendu, 'Le montant correspond à la grille', `${attendu} attendu`);
  ok(summary.active_seats >= 1, 'L’effectif facturable est renseigné');
}

// ------------------------------------------------------- 3. session de paiement
console.log('\n▶ Ouverture d’une session de paiement Stripe');

const checkout = await callFunction(
  'create-checkout-session',
  {
    organizationId,
    planCode: 'pro',
    // Hors navigateur, il n'y a pas d'en-tête `Origin` : les adresses de retour
    // doivent être fournies. C'est précisément ce que la fonction exige
    // désormais, au lieu de forger une URL relative que Stripe refuse.
    successUrl: 'https://nexoratech.example/organisation/facturation?paiement=ok',
    cancelUrl: 'https://nexoratech.example/organisation/facturation?paiement=annule',
    // Valeurs que le serveur doit IGNORER : si elles étaient lues, le montant
    // renvoyé s'en trouverait changé.
    price: 1,
    seats: 0,
    extraSeats: 0,
  },
  token,
);

ok(checkout.status === 200, 'Stripe accepte la session', JSON.stringify(checkout.payload));

if (checkout.status === 200) {
  const url = String(checkout.payload.url ?? '');
  ok(url.startsWith('https://checkout.stripe.com/'), 'Une URL de paiement est renvoyée');
  ok(checkout.payload.planCode === 'pro', 'Le plan retenu est bien celui demandé');

  // RELIQUAT D'ESSAI. Ce compte est déjà abonné : aucun report ne doit être
  // demandé à Stripe. Le cas inverse — une organisation en essai dont la
  // session porte l'échéance déjà promise — a été éprouvé sur une organisation
  // jetable ; ici on garde la moitié qui se vérifie sans rien créer.
  ok(
    checkout.payload.trialEnd === null,
    'Une organisation déjà abonnée ne réclame aucun report de prélèvement',
    `trialEnd = ${String(checkout.payload.trialEnd)}`,
  );
  ok(checkout.payload.includedSeats === 5, 'Pro annonce cinq sièges inclus');

  const attenduExtra = Math.max(0, checkout.payload.activeSeats - 5);
  ok(
    checkout.payload.extraSeats === attenduExtra,
    'Le dépassement est recalculé côté serveur',
    `${attenduExtra} attendu, ${checkout.payload.extraSeats} reçu`,
  );

  // L'URL COMPLÈTE : tronquée, elle ne sert à rien. C'est par elle qu'on règle
  // la session de test, et donc qu'on éprouve la moitié retour du circuit.
  console.log(`
        Régler avec la carte 4242 4242 4242 4242 :
        ${url}`);
}

// --------------------------------------------------- 4. ce qui doit être refusé
console.log('\n▶ Ce que le serveur doit refuser');

const gratuit = await callFunction(
  'create-checkout-session',
  { organizationId, planCode: 'free' },
  token,
);
ok(gratuit.status === 400, 'La formule Gratuite ne se souscrit pas');

const inconnu = await callFunction(
  'create-checkout-session',
  { organizationId, planCode: 'ultimate' },
  token,
);
ok(inconnu.status === 400, 'Une formule inexistante est refusée');

const autre = await callFunction(
  'create-checkout-session',
  { organizationId: '00000000-0000-4000-8000-000000000000', planCode: 'pro' },
  token,
);
ok(
  autre.status === 403 || autre.status === 400,
  'Une organisation étrangère est refusée',
  `HTTP ${autre.status}`,
);

const sansJeton = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY },
  body: JSON.stringify({ organizationId, planCode: 'pro' }),
});
ok(sansJeton.status === 401, 'Un appel sans session est refusé');

// ------------------------------------------------------------- 5. portail client
console.log('\n▶ Portail de facturation');

const portail = await callFunction(
  'create-billing-portal-session',
  { organizationId, returnUrl: 'https://nexoratech.example/organisation/facturation' },
  token,
);
ok(
  portail.status === 400 || portail.status === 200,
  'Le portail répond de façon exploitable',
  JSON.stringify(portail.payload),
);
if (portail.status === 400) {
  console.log('        (aucun client Stripe pour l’instant : attendu avant le premier paiement)');
}

// ------------------------------------------------ 5bis. sieges factures
console.log('\n▶ Sièges supplémentaires réellement facturés');

// La question que cette section tranche : ajouter un membre change-t-il ce que
// STRIPE facture, ou seulement ce que nous affichons ? La fonction relit
// l'abonnement après écriture et renvoie `stripeQuantity` ; sans cette
// relecture, un « synced: true » ne prouvait que sa propre bonne volonté.
const sieges = await callFunction('sync-subscription-seats', { organizationId }, token);

ok(sieges.status === 200, 'La synchronisation des sièges répond', JSON.stringify(sieges.payload));

if (sieges.status === 200 && sieges.payload.synced !== false) {
  const p = sieges.payload;
  console.log(
    `        ${p.activeSeats} actifs − ${p.includedSeats} inclus = ${p.extraSeats} en supplément ; ` +
      `Stripe en facture ${p.stripeQuantity}`,
  );
  ok(
    p.stripeQuantity === p.extraSeats,
    'Stripe facture exactement le nombre de sièges en dépassement',
    `${p.extraSeats} attendu, ${p.stripeQuantity} chez Stripe`,
  );
  ok(p.synced === true, 'La fonction confirme l’alignement après relecture');
} else if (sieges.status === 200) {
  console.log(`        ${sieges.payload.reason ?? 'rien à synchroniser'}`);
}

// ------------------------------------------------------------- 6. resiliation
console.log('\n▶ Résiliation');

// Ce compte est celui d'une organisation dont Stripe encaisse réellement
// l'abonnement. La résiliation locale doit donc être REFUSÉE et renvoyer au
// portail : écrire ici une décision que la prochaine notification Stripe
// écraserait produirait deux vérités sur le même abonnement.
const { error: resiliationError } = await supabase.rpc('cancel_organization_subscription', {
  p_organization_id: organizationId,
});

ok(
  resiliationError !== null && /portail/i.test(resiliationError.message),
  'Un abonnement Stripe ne se résilie pas hors du portail',
  resiliationError?.message ?? 'la RPC a ACCEPTÉ',
);

const { error: repriseError } = await supabase.rpc('resume_organization_subscription', {
  p_organization_id: organizationId,
});

ok(
  repriseError !== null,
  'Reprendre un abonnement qui n’a pas été résilié est refusé',
  repriseError?.message ?? 'la RPC a ACCEPTÉ',
);

// ---------------------------------------------------------------------- bilan
console.log(
  failures === 0
    ? '\nTOUTES LES VÉRIFICATIONS PASSENT\n'
    : `\n${failures} VÉRIFICATION(S) EN ÉCHEC\n`,
);

await supabase.auth.signOut();
process.exit(failures === 0 ? 0 : 1);
