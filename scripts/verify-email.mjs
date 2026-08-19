#!/usr/bin/env node
/**
 * Vérification de bout en bout de l'envoi des invitations.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CE SCRIPT PROUVE, ET CE QU'IL NE PROUVE PAS
 *
 * Il crée une VRAIE invitation, demande son envoi, et lit la réponse de la
 * fonction. Une configuration incomplète produit alors un motif explicite —
 * « Envoi non configuré. Définissez … » — au lieu d'un silence.
 *
 * Il ne peut pas lire votre boîte aux lettres. « Le serveur a accepté le
 * message » n'est pas « le message est arrivé » : un domaine mal aligné, un
 * filtre anti-spam, une adresse inexistante se voient à la réception, pas ici.
 * La dernière étape reste manuelle, et le script le rappelle en terminant.
 *
 * L'invitation créée est RETIRÉE à la fin, y compris en cas d'échec : laisser
 * derrière soi des invitations de test fausserait le compte des sièges — un
 * membre invité n'est pas facturé, mais il occupe le quota d'une formule Free.
 *
 *   node scripts/verify-email.mjs destinataire@exemple.fr [email] [motdepasse]
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

const destinataire = args[0];
if (!destinataire || !destinataire.includes('@')) {
  console.error(
    '\nIndiquez une adresse de destination réelle :\n' +
      '  node scripts/verify-email.mjs vous@exemple.fr\n',
  );
  process.exit(1);
}

const email = args[1] ?? 'owner.a@nexoratech.local';
const password = args[2] ?? env.SEED_TEST_PASSWORD;

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
console.log(`\nConnecté : ${email}`);

const { data: memberships } = await supabase
  .from('organization_members')
  .select('organization_id')
  .eq('user_id', auth.user.id)
  .eq('status', 'active');

const organizationId = memberships?.[0]?.organization_id;
if (!organizationId) {
  console.error("Ce compte n'appartient à aucune organisation active.");
  process.exit(1);
}

// -------------------------------------------------- 2. une invitation réelle
console.log(`\n▶ Création d'une invitation pour ${destinataire}`);

const { data: invitation, error: inviteError } = await supabase
  .from('organization_invitations')
  .insert({ organization_id: organizationId, email: destinataire.toLowerCase(), role: 'technician' })
  .select('*')
  .single();

ok(!inviteError && invitation !== null, "L'invitation est créée en base", inviteError?.message);

if (!invitation) {
  await supabase.auth.signOut();
  process.exit(1);
}

// --------------------------------------------------------------- 3. l'envoi
console.log("\n▶ Demande d'envoi à la fonction");

let payload = {};
let status = 0;

try {
  const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/send-invitation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ invitationId: invitation.id }),
  });

  status = response.status;
  // Lire le TEXTE d'abord. Un 500 de la plateforme rend « Internal Server
  // Error » en clair, et `response.json()` levait alors une SyntaxError qui
  // remplaçait le diagnostic par une trace de pile : on apprenait que le
  // script avait planté, pas ce que le serveur avait répondu.
  const brut = await response.text();
  try {
    payload = brut === '' ? { error: 'réponse vide' } : JSON.parse(brut);
  } catch {
    payload = { error: brut.slice(0, 160) };
  }
} catch (error) {
  ok(false, 'La fonction répond', String(error));
}

// Le message d'erreur est aussi important que le succès : c'est lui qui dit
// quel secret manque, et c'est lui que l'écran d'invitation affichera.
ok(status === 200, 'La fonction accepte la demande', `HTTP ${status} — ${payload.error ?? ''}`);
ok(payload.sent === true, 'Le serveur de messagerie a accepté le message', payload.reason ?? payload.error ?? '');

// ------------------------------------------------------- 4. le lien envoyé
if (payload.sent === true) {
  console.log('\n▶ Le lien contenu dans le message');

  const lien = String(payload.link ?? payload.url ?? '');

  if (lien === '') {
    console.log("        (la fonction ne renvoie pas le lien ; contrôle visuel dans le message)");
  } else {
    ok(/^https?:\/\//.test(lien), 'Le lien est absolu, et non relatif', lien);
    ok(
      lien.includes(invitation.token ?? invitation.id),
      'Le lien porte bien le jeton de CETTE invitation',
    );
    console.log(`        ${lien}`);
  }
}

// ----------------------------------------------------------- 5. nettoyage
const { error: cleanupError } = await supabase
  .from('organization_invitations')
  .delete()
  .eq('id', invitation.id);

ok(!cleanupError, "L'invitation de test est retirée", cleanupError?.message);

// ---------------------------------------------------------------------- bilan
if (failures === 0) {
  console.log(
    '\nTOUTES LES VÉRIFICATIONS PASSENT' +
      `\n\nIL RESTE UNE ÉTAPE QUE CE SCRIPT NE PEUT PAS FAIRE :` +
      `\nouvrez ${destinataire} et vérifiez que le message est arrivé — en boîte de` +
      `\nréception, expédié par REZO360, avec un lien cliquable.\n`,
  );
} else {
  console.log(`\n${failures} VÉRIFICATION(S) EN ÉCHEC\n`);
}

await supabase.auth.signOut();
process.exit(failures === 0 ? 0 : 1);
