import { assert, assertEquals } from 'jsr:@std/assert@1';

import { createQuotePdfHandler } from './handler.ts';

/*
  Hors CI, comme `generate-facturx/journey.test.ts` : `npm:pdfkit` a besoin de
  `--node-modules-dir`. Localement :
    deno test --node-modules-dir=auto --allow-read supabase/functions/generate-quote-pdf/handler.test.ts
*/

const root = 'https://quote-pdf-isolated.test';
const bucket = 'quote-documents';
const orgId = '00000000-0000-4000-8000-00000000a001';
const quoteId = '00000000-0000-4000-8000-00000000b001';
const objectPath = `${orgId}/${quoteId}/devis.pdf`;
const signedPath = `/storage/v1/object/sign/${bucket}/${objectPath}`;

const QUOTE = {
  id: quoteId,
  organization_id: orgId,
  reference: 'DEV-0007',
  title: 'Installation électrique du cabinet',
  customer_name: 'Cabinet dentaire Dr Morel',
  site_name: 'Cabinet — RDC',
  notes: null,
  valid_until: '2026-10-20',
  issue_date: '2026-09-01',
  created_at: '2026-09-01T10:00:00Z',
  customer_id: null,
  document_options: {},
  vat_rate: 20,
  status: 'sent',
};
const ORG = {
  id: orgId,
  name: 'HBG Labs',
  legal_name: 'HBG Labs SARL',
  address_line1: '1 rue du Bac à Sable',
  address_line2: null,
  postal_code: '75001',
  city: 'Paris',
  country: 'FR',
  registration_number: '123456789',
  vat_number: 'FR12345678900',
  email: 'contact@hbglabs.fr',
  phone: null,
  iban: null,
  bic: null,
  quote_payment_terms: null,
  quote_payment_method: null,
};
const ITEMS = [{ id: 'i1', description: 'Tableau divisionnaire', unit: 'Forfait', quantity: 1, unit_price_cents: 142_000, position: 0 }];

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

function request(body: Record<string, unknown>, auth = 'Bearer owner-test'): Request {
  return new Request(`${root}/functions/v1/generate-quote-pdf`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function isolatedService(overrides: { quote?: Record<string, unknown> | null; quoteStatus?: string } = {}) {
  const state = {
    quote: overrides.quote === undefined ? { ...QUOTE, status: overrides.quoteStatus ?? QUOTE.status } : overrides.quote,
    stored: null as Uint8Array | null,
    document: null as Record<string, unknown> | null,
    uploads: 0,
    inserts: 0,
    signedLinks: 0,
  };

  const transport: typeof fetch = async (input, init) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === '/auth/v1/user') {
      return json({ id: 'owner-test', aud: 'authenticated', role: 'authenticated' });
    }
    if (path === '/rest/v1/quotes') {
      return json(state.quote);
    }
    if (path === '/rest/v1/quote_items') {
      return json(ITEMS);
    }
    if (path === '/rest/v1/organizations') {
      return json(ORG);
    }
    if (path === '/rest/v1/quote_documents') {
      if (req.method === 'GET') return json(state.document);
      assertEquals(req.method, 'POST');
      state.inserts += 1;
      if (state.document) return json({ code: '23505', message: 'Duplicate' }, 409);
      const data = (await req.json()) as Record<string, unknown>;
      assertEquals(data.object_path, objectPath);
      assertEquals(data.quote_id, quoteId);
      state.document = { ...data, generated_at: '2026-09-16T10:00:00Z' };
      return json(state.document);
    }
    if (path === signedPath) {
      if (req.method === 'POST') {
        assert(state.document && state.stored);
        state.signedLinks += 1;
        return json({ signedURL: `/object/sign/${bucket}/${objectPath}?token=isolated` });
      }
      assert(state.stored);
      return new Response(new Uint8Array(state.stored));
    }
    if (path === `/storage/v1/object/${bucket}/${objectPath}` && req.method === 'POST') {
      state.uploads += 1;
      if (state.stored) return json({ statusCode: '409', error: 'Duplicate' }, 409);
      state.stored = new Uint8Array(await req.arrayBuffer());
      assertEquals(new TextDecoder().decode(state.stored.slice(0, 5)), '%PDF-');
      return json({ Key: `${bucket}/${objectPath}` });
    }
    throw new Error(`Requête inattendue : ${req.method} ${path}`);
  };

  return { state, transport };
}

function handler(transport: typeof fetch) {
  return createQuotePdfHandler({
    url: root,
    anonKey: 'anon-test',
    serviceRoleKey: 'service-test',
    fetch: transport,
    now: () => new Date('2026-09-16T10:00:00.000Z'),
  });
}

Deno.test('refuse une requête sans jeton', async () => {
  const { transport } = isolatedService();
  const response = await handler(transport)(
    new Request(`${root}/functions/v1/generate-quote-pdf`, {
      method: 'POST',
      body: JSON.stringify({ quoteId }),
    }),
  );
  assertEquals(response.status, 401);
});

Deno.test('refuse un devis introuvable ou inaccessible', async () => {
  const { transport } = isolatedService({ quote: null });
  const response = await handler(transport)(request({ quoteId }));
  assertEquals(response.status, 404);
});

Deno.test('refuse un brouillon : pas de PDF avant l’envoi', async () => {
  const { transport } = isolatedService({ quoteStatus: 'draft' });
  const response = await handler(transport)(request({ quoteId }));
  assertEquals(response.status, 409);
});

Deno.test('génère le PDF une première fois et le conserve', async () => {
  const { transport, state } = isolatedService();
  const response = await handler(transport)(request({ quoteId }));
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(state.uploads, 1);
  assertEquals(state.inserts, 1);
  assertEquals(body.url, `${root}/storage/v1/object/sign/${bucket}/${objectPath}?token=isolated`);
  assert(typeof body.sha256 === 'string' && /^[0-9a-f]{64}$/.test(body.sha256));
});

Deno.test('un second appel renvoie le document existant sans re-rendre ni re-téléverser', async () => {
  const { transport, state } = isolatedService();
  await handler(transport)(request({ quoteId }));
  assertEquals(state.uploads, 1);

  const second = await handler(transport)(request({ quoteId }));
  assertEquals(second.status, 200);
  assertEquals(state.uploads, 1, 'aucun nouveau téléversement');
  assertEquals(state.inserts, 1, 'aucune nouvelle ligne');
});

Deno.test('refuse un identifiant de devis mal formé', async () => {
  const { transport } = isolatedService();
  const response = await handler(transport)(request({ quoteId: 'pas-un-uuid' }));
  assertEquals(response.status, 400);
});

Deno.test('refuse toute méthode autre que POST', async () => {
  const { transport } = isolatedService();
  const response = await handler(transport)(
    new Request(`${root}/functions/v1/generate-quote-pdf`, { method: 'GET' }),
  );
  assertEquals(response.status, 405);
});
