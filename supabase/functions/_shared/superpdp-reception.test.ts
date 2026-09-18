import assert from 'node:assert/strict';
import { createClient } from 'npm:@supabase/supabase-js@2.112.2';
import { mapEnInvoiceForStorage, syncIncomingInvoices } from './superpdp-reception.ts';

const RACINE = 'https://reception.test';
const PARTENAIRE = 'https://api.superpdp.tech';
const ORG = '00000000-0000-4000-8000-0000000000r1';
const ACCESS_TOKEN = 'jeton-acces';

const json = (valeur: unknown, status = 200) =>
  new Response(JSON.stringify(valeur), { status, headers: { 'Content-Type': 'application/json' } });

Deno.test('mapEnInvoiceForStorage — extrait les champs utiles, jamais une erreur sur un champ absent', () => {
  const complet = mapEnInvoiceForStorage({
    number: 'F-2026-001',
    issue_date: '2026-09-01',
    payment_due_date: '2026-10-01',
    currency_code: 'eur',
    seller: {
      name: 'Fournisseur SARL',
      trading_name: 'Le Fournisseur',
      legal_registration_identifier: { scheme: 'fr_siren', value: '852 322 915' },
    },
    buyer: { name: 'Client' },
    totals: { total_without_vat: 100, total_vat_amount: 20, total_with_vat: 120 },
  });
  assert.equal(complet.supplier_name, 'Le Fournisseur');
  assert.equal(complet.supplier_siren, '852322915');
  assert.equal(complet.currency_code, 'EUR');
  assert.equal(complet.amount_without_vat, 100);
  assert.equal(complet.amount_with_vat, 120);

  const incomplet = mapEnInvoiceForStorage({ seller: { name: 'Minimal' }, buyer: { name: 'Client' } });
  assert.equal(incomplet.supplier_name, 'Minimal');
  assert.equal(incomplet.supplier_siren, null);
  assert.equal(incomplet.currency_code, null);
  assert.equal(incomplet.amount_without_vat, null);
});

Deno.test('mapEnInvoiceForStorage — un identifiant sans SIREN valide (moins de 9 chiffres) reste null', () => {
  const mapped = mapEnInvoiceForStorage({
    seller: { name: 'Etranger', legal_registration_identifier: { value: 'DE123' } },
    buyer: { name: 'Client' },
  });
  assert.equal(mapped.supplier_siren, null);
});

/**
 * Banc isolé, même patron que `superpdp-worker/handler.test.ts` : un client
 * Supabase réel branché sur un `fetch` factice qui simule le protocole
 * PostgREST/Storage. Plus fidèle qu'un double à la main pour un module qui
 * chaîne autant d'appels.
 */
function banc(
  options: {
    connues?: Array<Record<string, unknown>>;
    incoming?: Array<Record<string, unknown>>;
    /**
     * Le curseur réel dépend de `max(provider_invoice_id)` en base — mais un
     * banc de test doit pouvoir le distinguer de « ce qui existe déjà » pour
     * représenter une vraie course (deux passages concurrents qui listent la
     * même page avant que l'un des deux n'ait fait avancer ce que l'autre
     * observe). Par défaut, dérivé de `connues` comme en production.
     */
    curseur?: number;
  } = {},
) {
  const ecritures: Array<{ table: string; corps: unknown }> = [];
  const connues = options.connues ?? [];
  const incoming = options.incoming ?? [];
  const curseur =
    options.curseur ??
    Math.max(0, ...connues.map((c) => Number(c['provider_invoice_id']) || 0));

  const transport: typeof fetch = async (input, init) => {
    const req = new Request(input, init);
    const url = new URL(req.url);

    if (url.origin === PARTENAIRE) {
      if (url.pathname === '/v1.beta/invoices' && req.method === 'GET') {
        const after = Number(url.searchParams.get('starting_after_id') ?? '0');
        const page = incoming.filter((i) => Number(i['id']) > after);
        return json({ data: page, has_after: false });
      }
      const detailMatch = /^\/v1\.beta\/invoices\/(\d+)$/.exec(url.pathname);
      if (detailMatch && req.method === 'GET') {
        if (url.searchParams.get('format') === 'original')
          return new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
            headers: { 'Content-Type': 'application/xml' },
          });
        return json({
          seller: { name: 'Fournisseur Test', legal_registration_identifier: { value: '852322915' } },
          buyer: { name: 'Client' },
          currency_code: 'EUR',
          issue_date: '2026-09-01',
          payment_due_date: '2026-10-01',
          totals: { total_without_vat: 100, total_vat_amount: 20, total_with_vat: 120 },
        });
      }
      return json({});
    }

    if (url.pathname === '/rest/v1/received_invoices') {
      if (req.method === 'GET') {
        const providerInvoiceId = url.searchParams.get('provider_invoice_id')?.replace('eq.', '');
        if (providerInvoiceId) {
          const found = connues.find((c) => c['provider_invoice_id'] === providerInvoiceId);
          return json(found ? [found] : []);
        }
        // Requête du curseur.
        return json(curseur > 0 ? [{ provider_invoice_id: String(curseur) }] : []);
      }
      const corps = JSON.parse(await req.text()) as Record<string, unknown>;
      ecritures.push({ table: 'received_invoices', corps });
      return json({
        id: 'nouvelle-facture',
        organization_id: ORG,
        provider_code: 'superpdp',
        provider_invoice_id: corps['provider_invoice_id'],
        regulatory_status: null,
      });
    }
    if (url.pathname === '/rest/v1/received_invoice_events') {
      if (req.method === 'GET') return json([]);
      ecritures.push({ table: 'received_invoice_events', corps: JSON.parse(await req.text()) });
      return json({}, 201);
    }
    if (url.pathname === '/rest/v1/received_invoice_documents') {
      if (req.method === 'GET') return json([]);
      ecritures.push({ table: 'received_invoice_documents', corps: JSON.parse(await req.text()) });
      return json({}, 201);
    }
    if (url.pathname.startsWith('/storage/v1/object/received-invoice-documents/')) {
      ecritures.push({ table: 'storage', corps: url.pathname });
      return json({ Key: url.pathname }, 200);
    }
    throw new Error(`Appel inattendu : ${req.method} ${url.pathname}`);
  };

  const admin = createClient(RACINE, 'service-test', { global: { fetch: transport } });
  return { admin, transport, ecritures };
}

Deno.test('une nouvelle facture reçue est ingérée : ligne, document et événements', async () => {
  const { admin, transport, ecritures } = banc({
    incoming: [{ id: 555, events: [{ id: 1, invoice_id: 555, status_code: 'api:received', status_text: 'reçue', created_at: '2026-09-01T00:00:00Z' }] }],
  });
  const original = globalThis.fetch;
  globalThis.fetch = transport;
  let bilan;
  try {
    bilan = await syncIncomingInvoices(admin, ORG, ACCESS_TOKEN, Date.now() + 30_000);
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(bilan.fetched, 1);
  assert.equal(bilan.created, 1);
  assert.equal(bilan.updated, 0);
  assert.equal(bilan.errors, 0);
  assert.ok(ecritures.some((e) => e.table === 'received_invoices'), 'la facture reçue est insérée');
  assert.ok(ecritures.some((e) => e.table === 'storage'), 'le document original est conservé');
  assert.ok(ecritures.some((e) => e.table === 'received_invoice_events'), "l'événement fourni est journalisé");
});

Deno.test('une facture déjà connue n’est jamais réinsérée (idempotence, ex. deux passages concurrents)', async () => {
  // Curseur explicitement DERRIÈRE la facture déjà connue (100 < 555) : c'est
  // exactement le cas réel où le filet de sécurité s'applique — deux
  // exécutions concurrentes du worker qui listent la même page avant que
  // l'une des deux n'ait fait avancer ce que l'autre observe.
  const { admin, transport, ecritures } = banc({
    connues: [{ id: 'deja-la', organization_id: ORG, provider_code: 'superpdp', provider_invoice_id: '555', regulatory_status: null }],
    incoming: [{ id: 555, events: [] }],
    curseur: 100,
  });
  const original = globalThis.fetch;
  globalThis.fetch = transport;
  let bilan;
  try {
    bilan = await syncIncomingInvoices(admin, ORG, ACCESS_TOKEN, Date.now() + 30_000);
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(bilan.created, 0, 'aucune nouvelle facture');
  assert.equal(bilan.updated, 1, 'comptée comme traitée (événements resynchronisés), pas comme nouvelle');
  assert.ok(
    !ecritures.some((e) => e.table === 'received_invoices'),
    'aucun INSERT sur received_invoices pour une facture déjà connue',
  );
});

Deno.test('le curseur repart du plus grand provider_invoice_id déjà connu, jamais de zéro', async () => {
  const { admin, transport } = banc({
    connues: [{ id: 'ancienne', organization_id: ORG, provider_code: 'superpdp', provider_invoice_id: '100', regulatory_status: null }],
    incoming: [{ id: 100, events: [] }, { id: 200, events: [] }],
  });
  const original = globalThis.fetch;
  globalThis.fetch = transport;
  let bilan;
  try {
    bilan = await syncIncomingInvoices(admin, ORG, ACCESS_TOKEN, Date.now() + 30_000);
  } finally {
    globalThis.fetch = original;
  }
  // Seule la facture 200 (> curseur 100) est neuve ; 100 est filtrée par
  // `starting_after_id` côté partenaire simulé, donc jamais même listée.
  assert.equal(bilan.fetched, 1);
});
