import assert from 'node:assert/strict';
import { createClient } from 'npm:@supabase/supabase-js@2.112.2';
import {
  deposerTransmission,
  marquerEchec,
  reserverTransmission,
  transitionAllowed,
  type TransmissionRow,
} from './superpdp-transmission.ts';

const RACINE = 'https://transmission.test';
const PARTENAIRE = 'https://api.superpdp.tech';

const transmission = (extra: Partial<TransmissionRow> = {}): TransmissionRow => ({
  id: '00000000-0000-4000-8000-0000000000t1',
  invoice_id: '00000000-0000-4000-8000-0000000000f1',
  organization_id: '00000000-0000-4000-8000-0000000000o1',
  provider_code: 'superpdp',
  status: 'queued',
  provider_submission_id: null,
  attempt_count: 0,
  provider_environment: 'production',
  ...extra,
});

const json = (valeur: unknown, status = 200) =>
  new Response(JSON.stringify(valeur), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * Banc isole : aucune permission reseau n'est accordee a ces tests. Le meme
 * transport sert au client Supabase et aux appels partenaire, ce qui permet
 * d'observer TOUT ce que le code emet — y compris ce qu'il n'emet pas.
 */
function banc(options: { depotExistant?: boolean } = {}) {
  const vu: string[] = [];
  let ligne = transmission({ status: 'submitting', attempt_count: 1 });

  const transport: typeof fetch = async (input, init) => {
    const requete = new Request(input, init);
    const url = new URL(requete.url);
    vu.push(`${requete.method} ${url.origin}${url.pathname}`);

    if (url.origin === PARTENAIRE) {
      // Recherche du depot par identifiant externe, avant toute creation.
      if (url.pathname === '/v1.beta/invoices' && requete.method === 'GET')
        return json({
          data: options.depotExistant ? [{ id: 448618, external_id: ligne.invoice_id }] : [],
          has_before: false,
          has_after: false,
        });
      if (url.pathname === '/v1.beta/invoices' && requete.method === 'POST')
        return json({ id: 999001, events: [] });
      if (url.pathname.startsWith('/v1.beta/invoices/')) return json({ id: 448618, events: [] });
      if (url.pathname === '/v1.beta/invoice_events')
        return json({ data: [], has_after: false });
      if (url.pathname === '/v1.beta/companies/me') return json({ id: 1, env: 'production' });
    }

    if (url.pathname === '/rest/v1/invoice_transmissions') {
      if (requete.method === 'PATCH') {
        const patch = JSON.parse(await requete.text()) as Record<string, unknown>;
        ligne = { ...ligne, ...(patch as Partial<TransmissionRow>) };
        return json(ligne);
      }
      return json(ligne);
    }
    if (url.pathname === '/rest/v1/invoice_transmission_events') {
      // La lecture sert a retrouver le dernier evenement connu : c'est une
      // collection, pas un objet. L'ecriture, elle, ne renvoie rien d'utile.
      if (requete.method === 'GET') return json([]);
      return json({}, 201);
    }

    throw new Error(`Appel inattendu : ${requete.method} ${url.pathname}`);
  };

  const admin = createClient(RACINE, 'service-test', {
    global: { fetch: transport },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { admin, transport, vu, etat: () => ligne };
}

Deno.test('la machine a etats refuse toute regression depuis un etat terminal', () => {
  for (const terminal of ['accepted', 'rejected', 'cancelled'] as const) {
    for (const cible of ['submitted', 'delivered', 'accepted', 'rejected'] as const) {
      if (terminal === cible) continue;
      assert.equal(transitionAllowed(terminal, cible), false, `${terminal} -> ${cible}`);
    }
  }
  // Une transmission remise au destinataire ne peut que se conclure.
  assert.equal(transitionAllowed('delivered', 'submitted'), false);
  assert.equal(transitionAllowed('delivered', 'accepted'), true);
  assert.equal(transitionAllowed('submitted', 'delivered'), true);
});

Deno.test('un depot deja enregistre chez le partenaire n’est jamais redepose', async () => {
  const { admin, transport, vu } = banc({ depotExistant: true });
  const original = globalThis.fetch;
  globalThis.fetch = transport;
  try {
    const resultat = await deposerTransmission(
      admin,
      transmission({ status: 'submitting', attempt_count: 1 }),
      '00000000-0000-4000-8000-0000000000f1',
      'jeton-test',
      'production',
    );
    assert.equal(resultat.provider_submission_id, '448618');
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(
    vu.filter((appel) => appel === `POST ${PARTENAIRE}/v1.beta/invoices`).length,
    0,
    'Une reprise ne doit jamais creer un second depot',
  );
});

Deno.test('un echec technique programme la reprise et journalise l’evenement', async () => {
  const { admin, vu, etat } = banc();
  await marquerEchec(
    admin,
    transmission({ status: 'submitting', attempt_count: 1 }),
    'La plateforme est injoignable.',
    new Date('2026-09-06T10:00:00.000Z'),
  );
  assert.equal(etat().status, 'failed');
  assert.equal(
    (etat() as unknown as { next_attempt_at: string }).next_attempt_at,
    '2026-09-06T10:05:00.000Z',
  );
  assert.ok(
    vu.includes(`POST ${RACINE}/rest/v1/invoice_transmission_events`),
    'L’echec doit laisser une trace dans le journal immuable',
  );
});

Deno.test('le plafond de tentatives arrete la reprise automatique', async () => {
  const { admin, etat } = banc();
  await marquerEchec(admin, transmission({ status: 'submitting', attempt_count: 5 }), 'Echec.');
  assert.equal((etat() as unknown as { next_attempt_at: string | null }).next_attempt_at, null);
});

Deno.test('la reservation echoue quand la ligne n’est plus reservable', async () => {
  const { admin, transport } = banc();
  const vide: typeof fetch = async (input, init) => {
    const requete = new Request(input, init);
    if (new URL(requete.url).pathname === '/rest/v1/invoice_transmissions') return json(null);
    return transport(input, init);
  };
  const client = createClient(RACINE, 'service-test', {
    global: { fetch: vide },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  assert.equal(await reserverTransmission(client, transmission()), null);
});

Deno.test('le depot enregistre l’environnement qui a attribue son identifiant', async () => {
  const { admin, transport, etat } = banc({ depotExistant: true });
  const original = globalThis.fetch;
  globalThis.fetch = transport;
  try {
    await deposerTransmission(
      admin,
      transmission({ status: 'submitting', attempt_count: 1 }),
      '00000000-0000-4000-8000-0000000000f1',
      'jeton-test',
      // Volontairement different de la valeur du fixture : c'est l'argument qui
      // doit faire foi, pas l'etat anterieur de la ligne.
      'sandbox',
    );
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(etat().provider_environment, 'sandbox');
});
