#!/usr/bin/env node
/**
 * Vérification de bout en bout du centre d'assistance.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CE SCRIPT PROUVE
 *
 * Il agit en VISITEUR ANONYME — sans session, avec la seule clé publiable, comme
 * le ferait quelqu'un lisant la page Tarifs. C'est le chemin le plus exposé, et
 * celui qu'aucun test d'écran ne couvre : les policies s'y appliquent pour de
 * bon.
 *
 * Il dépose un fichier, écrit la demande, demande la notification, et lit ce
 * que la fonction répond — `notified: true`, ou le motif exact. Puis il vérifie
 * que la demande est bien ILLISIBLE, y compris pour lui qui vient de l'écrire.
 *
 * Il ne peut pas lire votre boîte. « Le serveur a accepté » n'est pas « le
 * message est arrivé » : la dernière étape reste manuelle.
 *
 * NETTOYAGE : la demande et son fichier sont retirés à la fin, avec
 * `service_role` s'il est disponible — sans quoi ils resteraient, la table
 * n'accordant aucun droit de suppression au client. Le script le dit s'il ne
 * peut pas nettoyer.
 *
 *   node scripts/verify-support.mjs
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

/** Client ANONYME : aucune session, exactement comme un visiteur. */
const anon = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
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

const marqueur = `verif-${Date.now()}`;
const adresse = `${marqueur}@exemple.invalid`;

// ------------------------------------------------------- 1. la pièce jointe
console.log('\n▶ Dépôt d’une pièce jointe, en visiteur anonyme');

// Un PNG minimal valide : 1 pixel transparent.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const chemin = `${marqueur}/capture.png`;

const { error: uploadError } = await anon.storage
  .from('support-attachments')
  .upload(chemin, png, { contentType: 'image/png', upsert: false });

ok(!uploadError, 'Un visiteur peut joindre un fichier', uploadError?.message);

// ---------------------------------------------------------- 2. la demande
console.log('\n▶ Écriture de la demande');

// Identifiant forgé ici : `RETURNING` exigerait une policy de lecture, qui
// n'existe pas — c'est précisément ce que ce script a permis de découvrir.
const requestId = crypto.randomUUID();

const { error: insertError } = await anon
  .from('support_requests')
  .insert({
    id: requestId,
    name: 'Vérification automatique',
    email: adresse,
    phone: '0600000000',
    message: `Demande de vérification ${marqueur}. Si vous lisez ceci, la chaîne fonctionne.`,
    attachments: uploadError
      ? []
      : [{ name: 'capture.png', path: chemin, size: png.length, type: 'image/png' }],
  });

ok(!insertError, 'La demande est enregistrée', insertError?.message);

// -------------------------------------------------- 3. elle reste illisible
console.log('\n▶ Cloisonnement');

const { data: relu } = await anon.from('support_requests').select('id').eq('email', adresse);

ok(
  (relu ?? []).length === 0,
  'Son auteur ne peut pas la relire — aucune policy de lecture',
  `${String((relu ?? []).length)} ligne(s) visible(s)`,
);

// --------------------------------------------------------- 4. la notification
if (!insertError) {
  console.log('\n▶ Notification');

  const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/send-support-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY },
    body: JSON.stringify({ requestId }),
  });

  const payload = await response.json();

  ok(response.status === 200, 'La fonction répond', `HTTP ${String(response.status)}`);
  ok(payload.stored === true, 'Elle confirme que la demande est conservée');
  ok(
    payload.notified === true,
    'Le serveur de messagerie a accepté le message',
    payload.reason ?? payload.error ?? '',
  );
}

// ------------------------------------------------------------- 5. nettoyage
const secret = env.SUPABASE_SERVICE_ROLE_KEY;

if (secret && !insertError) {
  const admin = createClient(env.VITE_SUPABASE_URL, secret, { auth: { persistSession: false } });
  await admin.from('support_requests').delete().eq('id', requestId);
  await admin.storage.from('support-attachments').remove([chemin]);
  console.log('\n  (demande et pièce jointe de test retirées)');
} else {
  console.log(
    `\n  ATTENTION : sans SUPABASE_SERVICE_ROLE_KEY dans .env.local, la demande de test` +
      `\n  reste en base. Retirez-la depuis le tableau de bord : email = ${adresse}`,
  );
}

// ---------------------------------------------------------------------- bilan
if (failures === 0) {
  console.log(
    '\nTOUTES LES VÉRIFICATIONS PASSENT' +
      '\n\nIL RESTE UNE ÉTAPE QUE CE SCRIPT NE PEUT PAS FAIRE :' +
      '\nouvrez contact@rezo360.fr et vérifiez que le message est arrivé,' +
      '\navec sa pièce jointe et une adresse de réponse exploitable.\n',
  );
} else {
  console.log(`\n${String(failures)} VÉRIFICATION(S) EN ÉCHEC\n`);
}

process.exit(failures === 0 ? 0 : 1);
