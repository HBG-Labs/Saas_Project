/**
 * Contrôle de routage SUPER PDP, en lecture seule.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE SCRIPT
 *
 * `resolveElectronicAddresses` a deux branches entièrement distinctes. En bac à
 * sable, les adresses sont reprises d'un document de référence fourni par le
 * partenaire. En production, elles sont résolues dans l'annuaire, puis arbitrées
 * entre plusieurs adresses actives possibles.
 *
 * Les dépôts connus ont tous eu lieu en bac à sable : la branche production n'a
 * jamais été exécutée. Ce script la prouve SANS RIEN ENVOYER — les appels
 * d'annuaire sont des GET, et l'action `routing_check` rend la main avant toute
 * lecture ou écriture de `invoice_transmissions`.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   AUDIT_EMAIL=… AUDIT_PASSWORD=… node scripts/check-superpdp-routing.mjs
 *   AUDIT_EMAIL=… AUDIT_PASSWORD=… node scripts/check-superpdp-routing.mjs --invoice=<uuid>
 *
 * Le compte doit disposer de `invoice.manage` sur l'organisation raccordée.
 */

import { readFileSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes('=') && !line.startsWith('#'))
    .map((line) => {
      const at = line.indexOf('=');
      return [
        line.slice(0, at).trim(),
        line
          .slice(at + 1)
          .trim()
          .replace(/^["']|["']$/g, ''),
      ];
    }),
);

const email = process.env['AUDIT_EMAIL'];
const password = process.env['AUDIT_PASSWORD'];

if (!email || !password) {
  console.error('AUDIT_EMAIL et AUDIT_PASSWORD sont requis : ce contrôle passe par une session.');
  process.exit(1);
}

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_PUBLISHABLE_KEY'], {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError) {
  console.error(`Connexion refusée : ${authError.message}`);
  process.exit(1);
}

const demande = process.argv.find((arg) => arg.startsWith('--invoice='))?.slice(10);

/* Seules ces factures sont transmissibles : `can_transmit_invoice` exige un
   document émis et un destinataire professionnel. */
const { data: eligibles, error: readError } = await supabase
  .from('invoices')
  .select(
    'id,reference,status,customer_name,customer_registration_number,seller_registration_number',
  )
  .in('status', ['issued', 'sent', 'paid'])
  .eq('customer_type', 'company')
  .order('created_at', { ascending: false });

if (readError) {
  console.error(`Lecture des factures impossible : ${readError.message}`);
  process.exit(1);
}

if (!demande) {
  console.log('Factures éligibles au contrôle de routage :\n');
  for (const f of eligibles ?? []) {
    console.log(`  ${f.id}  ${f.reference.padEnd(16)} ${f.status.padEnd(7)} → ${f.customer_name}`);
  }
  console.log('\nRelancez avec --invoice=<uuid>. Aucun envoi n’a lieu.');
  process.exit(0);
}

const facture = (eligibles ?? []).find((f) => f.id === demande);
if (!facture) {
  console.error('Cette facture n’est pas éligible, ou n’est pas visible par ce compte.');
  process.exit(1);
}

console.log(`Contrôle du routage pour ${facture.reference} → ${facture.customer_name}`);
console.log(`  émetteur   ${facture.seller_registration_number ?? '—'}`);
console.log(`  client     ${facture.customer_registration_number ?? '—'}\n`);

const { data, error } = await supabase.functions.invoke('superpdp-invoice', {
  body: { invoiceId: demande, action: 'routing_check' },
});

if (error) {
  const detail = await error.context?.json?.().catch(() => null);
  console.error(`Contrôle en échec : ${detail?.error ?? error.message}`);
  process.exit(1);
}

console.log('Résolution obtenue :\n');
console.log(`  environnement      ${data.environment}`);
console.log(`  adresse émetteur   ${data.seller.scheme}:${data.seller.value}`);
console.log(`  adresse client     ${data.buyer.scheme}:${data.buyer.value}`);
console.log(`  UBL préparé        ${data.ublBytes} octets`);
console.log(`  dépôt effectué     ${data.submitted ? 'OUI — ANORMAL' : 'non'}`);

if (data.environment !== 'production') {
  console.log('\n⚠️  Branche bac à sable empruntée : la branche production reste non prouvée.');
} else {
  console.log('\n✅ Branche production exécutée et adresses résolues dans l’annuaire.');
}
