import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createFacturXHandler } from './handler.ts';
import { preparerExportCii } from '../../../src/features/einvoicing/canonical/mapper.ts';
import { serializeCii } from '../../../src/features/einvoicing/serializers/cii.ts';
import { preparerTestFacturX } from '../../../src/features/einvoicing/canonical/test-preview.ts';
import { emetteurFacture } from '../../../src/features/einvoicing/validation/invoice.ts';
import type { InvoiceWithItems, Organization } from '../../../src/types/domain.ts';

// Real SQL snapshot, created with save_invoice_draft + issue_invoice then rolled back.
const fixture = JSON.parse(
  await Deno.readTextFile('test-results/facturx-journey/issued-invoice.json'),
) as InvoiceWithItems;
assert.equal(fixture.id, '00000000-0000-4000-8000-00000000f101');
assert.match(fixture.notes!, /DOCUMENT DE TEST/);
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const root = 'https://facturx-isolated.test';
const bucket = 'invoice-electronic-documents';
const objectPath = `${fixture.organization_id}/${fixture.id}/factur-x.pdf`;
const signedPath = `/storage/v1/object/sign/${bucket}/${objectPath}`;
const simulatedAt = new Date('2026-09-04T14:00:00Z');
const request = (extra: Record<string, unknown> = {}) =>
  new Request(`${root}/functions/v1/generate-facturx`, {
    method: 'POST',
    headers: { Authorization: 'Bearer owner-test', 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoiceId: fixture.id, ...extra }),
  });
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function isolatedService() {
  const state = {
    invoice: structuredClone(fixture),
    organization: {
      ...emetteurFacture(fixture, null),
      id: fixture.organization_id,
    } as Organization,
    readOnly: false,
    changeDuringRead: false,
    visible: true,
    stored: null as Uint8Array | null,
    document: null as Record<string, unknown> | null,
    failMetadataOnce: false,
    uploads: 0,
    inserts: 0,
    metadataReads: 0,
    signedLinks: 0,
    unexpected: [] as string[],
  };
  // No network permission is granted to this test. The real Supabase SDK uses this transport.
  const transport: typeof fetch = async (input, init) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    const path = url.pathname;
    try {
      assert.equal(url.origin, root);
      const caller = () => assert.equal(req.headers.get('authorization'), 'Bearer owner-test');
      const admin = () => assert.equal(req.headers.get('authorization'), 'Bearer service-test');
      if (state.readOnly) {
        assert.equal(req.method, 'GET', 'A simulation must never write');
        caller();
        assert.ok(!path.startsWith('/storage/'), 'A simulation must never use Storage');
        assert.ok(!path.includes('invoice_electronic_documents'));
      }
      if (path === '/auth/v1/user') {
        caller();
        return json({ id: 'owner-test', aud: 'authenticated', role: 'authenticated' });
      }
      if (path === '/rest/v1/invoices') {
        caller();
        assert.equal(url.searchParams.get('id'), `eq.${fixture.id}`);
        return json(state.visible ? state.invoice : null);
      }
      if (path === '/rest/v1/invoice_items') {
        caller();
        if (state.changeDuringRead) state.invoice.updated_at = '2026-09-04T14:01:00Z';
        return json(state.invoice.items);
      }
      if (path === '/rest/v1/organizations') {
        caller();
        assert.equal(url.searchParams.get('id'), `eq.${fixture.organization_id}`);
        return json(state.organization);
      }
      if (path === '/rest/v1/invoice_totals') {
        caller();
        return json(state.invoice.totals);
      }
      if (path === '/rest/v1/invoice_electronic_documents') {
        admin();
        if (req.method === 'GET') {
          state.metadataReads++;
          return json(state.document);
        }
        assert.equal(req.method, 'POST');
        state.inserts++;
        if (state.failMetadataOnce) {
          state.failMetadataOnce = false;
          return json({ message: 'Temporary metadata failure', code: 'TEST' }, 500);
        }
        if (state.document)
          return json({ code: '23505', message: 'Duplicate invoice document' }, 409);
        const data = await req.json();
        assert.equal(data.object_path, objectPath);
        assert.equal(data.invoice_id, fixture.id);
        assert.equal(data.organization_id, fixture.organization_id);
        assert.equal(data.pdf_sha256, hash(state.stored!));
        state.document = { ...data, generated_at: fixture.issued_at };
        return json(state.document);
      }
      if (path === signedPath) {
        if (req.method === 'POST') {
          caller();
          assert.equal((await req.json()).expiresIn, 60);
          assert.ok(state.visible && state.document && state.stored);
          state.signedLinks++;
          return json({ signedURL: `/object/sign/${bucket}/${objectPath}?token=isolated` });
        }
        assert.equal(req.method, 'GET');
        assert.equal(url.searchParams.get('token'), 'isolated');
        assert.ok(state.stored);
        return new Response(new Uint8Array(state.stored), {
          headers: { 'Content-Type': 'application/pdf' },
        });
      }
      if (path === `/storage/v1/object/${bucket}/${objectPath}` && req.method === 'POST') {
        admin();
        state.uploads++;
        assert.equal(req.headers.get('x-upsert'), 'false');
        if (state.stored)
          return json({ statusCode: '409', error: 'Duplicate', message: 'Already exists' }, 409);
        state.stored = new Uint8Array(await req.arrayBuffer());
        assert.equal(new TextDecoder().decode(state.stored.slice(0, 5)), '%PDF-');
        return json({ Key: `${bucket}/${objectPath}` });
      }
      if (
        (path === `/storage/v1/object/authenticated/${bucket}/${objectPath}` ||
          path === `/storage/v1/object/${bucket}/${objectPath}`) &&
        req.method === 'GET'
      ) {
        admin();
        return state.stored
          ? new Response(new Uint8Array(state.stored))
          : json({ message: 'Missing' }, 404);
      }
      throw new Error(`Unexpected request: ${req.method} ${path}`);
    } catch (error) {
      state.unexpected.push(String(error));
      throw error;
    }
  };
  return {
    state,
    transport,
    handle: createFacturXHandler({
      url: root,
      anonKey: 'anon-test',
      serviceRoleKey: 'service-test',
      fetch: transport,
      now: () => simulatedAt,
    }),
  };
}

Deno.test(
  'parcours SQL → génération → conservation → deux téléchargements identiques',
  async () => {
    const { state, transport, handle } = isolatedService();
    const response = await handle(request());
    assert.equal(response.status, 200, `${await response.clone().text()} ${state.unexpected}`);
    const metadata = await response.json();
    const downloaded = new Uint8Array(await (await transport(metadata.url)).arrayBuffer());
    assert.equal(downloaded.length, metadata.byteSize);
    assert.equal(hash(downloaded), metadata.sha256);
    assert.equal(state.document?.profile, 'EN 16931');
    const second = await handle(request());
    assert.equal(second.status, 200);
    assert.equal((await second.json()).sha256, metadata.sha256);
    assert.equal(state.uploads, 1);
    assert.equal(state.inserts, 1);
    assert.equal(state.signedLinks, 2);
    assert.deepEqual(state.unexpected, []);
    await Deno.writeFile('test-results/facturx-journey/downloaded.pdf', downloaded);
    const prepared = preparerExportCii(fixture);
    assert.ok(prepared.invoice, prepared.issues.join('; '));
    const xml = serializeCii(prepared.invoice);
    assert.equal(state.document?.xml_sha256, hash(new TextEncoder().encode(xml)));
    await Deno.writeTextFile('test-results/facturx-journey/downloaded.xml', xml);
    await Deno.writeTextFile(
      'test-results/facturx-journey/download-metadata.json',
      JSON.stringify(metadata, null, 2),
    );
  },
);

Deno.test('deux demandes concurrentes conservent un seul document', async () => {
  const { state, handle } = isolatedService();
  const responses = await Promise.all([handle(request()), handle(request())]);
  for (const response of responses) assert.equal(response.status, 200);
  const metadata = await Promise.all(responses.map((response) => response.json()));
  assert.equal(metadata[0].sha256, metadata[1].sha256);
  assert.equal(state.document?.pdf_sha256, hash(state.stored!));
  assert.deepEqual(state.unexpected, []);
});

Deno.test('reprend une conservation interrompue sans remplacer le PDF', async () => {
  const { state, handle } = isolatedService();
  state.failMetadataOnce = true;
  assert.equal((await handle(request())).status, 503);
  assert.ok(state.stored);
  assert.equal(state.document, null);
  const firstHash = hash(state.stored);
  const retry = await handle(request());
  assert.equal(retry.status, 200, `${await retry.clone().text()} ${state.unexpected}`);
  assert.equal((await retry.json()).sha256, firstHash);
  assert.equal(hash(state.stored), firstHash);
  assert.deepEqual(state.unexpected, []);
});

Deno.test('refuse un fichier orphelin différent, sans remplacement', async () => {
  const { state, handle } = isolatedService();
  state.stored = new TextEncoder().encode('%PDF-different');
  assert.equal((await handle(request())).status, 503);
  assert.equal(new TextDecoder().decode(state.stored), '%PDF-different');
  assert.equal(state.document, null);
  assert.deepEqual(state.unexpected, []);
});

Deno.test('revérifie l’accès à une facture même si son PDF existe', async () => {
  const { state, handle } = isolatedService();
  assert.equal((await handle(request())).status, 200);
  const reads = state.metadataReads;
  state.visible = false;
  assert.equal((await handle(request())).status, 404);
  assert.equal(state.metadataReads, reads);
  assert.equal(state.signedLinks, 1);
  assert.deepEqual(state.unexpected, []);
});

Deno.test('ne conserve ni brouillon ni facture aux identifiants mal formés', async () => {
  for (const status of ['draft', 'issued'] as const) {
    const { state, handle } = isolatedService();
    state.invoice.status = status;
    state.invoice.customer_registration_number = '123';
    assert.equal((await handle(request())).status, 422);
    assert.equal(state.uploads, 0);
    assert.equal(state.document, null);
    assert.deepEqual(state.unexpected, []);
  }
});

function isolatedDraft() {
  const service = isolatedService();
  service.state.readOnly = true;
  service.state.invoice.status = 'draft';
  service.state.invoice.issued_at = null;
  service.state.invoice.reference = `BR-${fixture.id}`;
  return service;
}

// Synthetic credit variant of the SQL invoice snapshot; no application data is written.
function makeCreditNote(source: InvoiceWithItems, scope: 'full' | 'partial' = 'full') {
  source.document_type = 'credit_note';
  source.credit_note_scope = scope;
  source.corrects_invoice_id = '00000000-0000-4000-8000-00000000f099';
  source.corrected_invoice_reference = 'FAC-2026-00008';
  source.corrected_invoice_issued_at = '2026-09-03T14:00:00Z';
  source.credit_note_reason = 'Annulation complète de la prestation. DOCUMENT DE TEST.';
  source.payment_method = null;
  source.payment_terms = 'Remboursement ou imputation à convenir avec le client.';
  source.early_payment_terms = 'Sans objet.';
  source.late_payment_terms = 'Sans objet.';
  if (source.status !== 'draft') source.reference = 'AV-2026-00001';
  if (scope === 'partial') {
    source.items = [{ ...source.items[0]!, quantity: 0.5 }];
    source.totals = {
      ...source.totals!,
      subtotal_cents: 6173,
      vat_cents: 1235,
      total_cents: 7408,
    };
  }
}

Deno.test(
  'avoir émis : conservation, téléchargement identique et contrôle de l’accès',
  async () => {
    const { state, handle, transport } = isolatedService();
    makeCreditNote(state.invoice);
    const before = JSON.stringify(state.invoice);
    const response = await handle(request());
    assert.equal(response.status, 200, await response.clone().text());
    const metadata = await response.json();
    const downloaded = new Uint8Array(await (await transport(metadata.url)).arrayBuffer());
    assert.equal(hash(downloaded), metadata.sha256);
    const repeated = await handle(request());
    assert.equal((await repeated.json()).sha256, metadata.sha256);
    assert.equal(state.uploads, 1);
    assert.equal(state.inserts, 1);
    assert.equal(JSON.stringify(state.invoice), before);
    const prepared = preparerExportCii(state.invoice);
    assert.ok(prepared.invoice, prepared.issues.join('; '));
    const xml = serializeCii(prepared.invoice);
    assert.match(xml, /<ram:TypeCode>381<\/ram:TypeCode>/);
    assert.equal(state.document?.xml_sha256, hash(new TextEncoder().encode(xml)));
    await Deno.mkdir('test-results/credit-note-journey', { recursive: true });
    await Deno.writeFile('test-results/credit-note-journey/downloaded.pdf', downloaded);
    await Deno.writeTextFile('test-results/credit-note-journey/downloaded.xml', xml);
    const reads = state.metadataReads;
    state.visible = false;
    assert.equal((await handle(request())).status, 404);
    assert.equal(state.metadataReads, reads);
    assert.deepEqual(state.unexpected, []);
  },
);

Deno.test('avoir sans référence d’origine : refus avant toute conservation', async () => {
  const { state, handle } = isolatedService();
  makeCreditNote(state.invoice);
  state.invoice.corrected_invoice_reference = null;
  assert.equal((await handle(request())).status, 422);
  assert.equal(state.uploads + state.inserts, 0);
  assert.deepEqual(state.unexpected, []);
});

Deno.test('avoir partiel émis : PDF et CII conservent le montant et la portée', async () => {
  const { state, handle, transport } = isolatedService();
  makeCreditNote(state.invoice, 'partial');
  const before = JSON.stringify(state.invoice);
  const response = await handle(request());
  assert.equal(response.status, 200, await response.clone().text());
  const metadata = await response.json();
  const downloaded = new Uint8Array(await (await transport(metadata.url)).arrayBuffer());
  assert.equal(hash(downloaded), metadata.sha256);
  const prepared = preparerExportCii(state.invoice);
  assert.ok(prepared.invoice, prepared.issues.join('; '));
  assert.equal(prepared.invoice.documentType, 'credit_note');
  if (prepared.invoice.documentType !== 'credit_note') throw new Error('Credit note expected');
  assert.equal(prepared.invoice.creditNoteScope, 'partial');
  assert.equal(prepared.invoice.totalCents, 7408);
  const xml = serializeCii(prepared.invoice);
  assert.match(xml, /Avoir partiel/);
  assert.equal(state.document?.xml_sha256, hash(new TextEncoder().encode(xml)));
  assert.equal(JSON.stringify(state.invoice), before);
  await Deno.mkdir('test-results/partial-credit-note-journey', { recursive: true });
  await Deno.writeFile('test-results/partial-credit-note-journey/downloaded.pdf', downloaded);
  await Deno.writeTextFile('test-results/partial-credit-note-journey/downloaded.xml', xml);
  assert.deepEqual(state.unexpected, []);
});

for (const variant of [
  'standard',
  'long',
  'credit-standard',
  'credit-long',
  'credit-partial-standard',
] as const) {
  Deno.test(`simulation ${variant} : PDF TEST direct, sans écriture ni numéro réel`, async () => {
    const { state, handle } = isolatedDraft();
    const isCredit = variant.startsWith('credit-');
    const isPartial = variant.includes('partial');
    if (isCredit) makeCreditNote(state.invoice, isPartial ? 'partial' : 'full');
    if (variant.endsWith('long')) {
      state.invoice.items = Array.from({ length: 60 }, (_, i) => ({
        ...fixture.items[0],
        id: `test-line-${i}`,
        position: i,
      }));
      state.invoice.totals = {
        ...fixture.totals!,
        subtotal_cents: 1481400,
        vat_cents: 296280,
        total_cents: 1777680,
      };
    }
    const before = JSON.stringify(state.invoice);
    const response = await handle(
      request({ mode: 'test', expectedUpdatedAt: state.invoice.updated_at }),
    );
    assert.equal(response.status, 200, `${await response.clone().text()} ${state.unexpected}`);
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(response.headers.get('content-disposition')!, /TEST-/);
    const pdf = new Uint8Array(await response.arrayBuffer());
    assert.equal(new TextDecoder().decode(pdf.slice(0, 5)), '%PDF-');
    assert.equal(JSON.stringify(state.invoice), before);
    assert.equal(state.uploads + state.inserts + state.metadataReads + state.signedLinks, 0);
    assert.equal(state.document, null);
    assert.deepEqual(state.unexpected, []);
    const prepared = preparerTestFacturX(state.invoice, state.organization, simulatedAt);
    assert.ok(prepared.invoice, prepared.issues.join('; '));
    const folder = isPartial
      ? 'test-results/partial-credit-note-test-mode'
      : isCredit
        ? 'test-results/credit-note-test-mode'
        : 'test-results/facturx-test-mode';
    await Deno.mkdir(folder, { recursive: true });
    await Deno.writeFile(`${folder}/${variant}.pdf`, pdf);
    await Deno.writeTextFile(`${folder}/${variant}.xml`, serializeCii(prepared.invoice));
  });
}

Deno.test('simulation : refuse une facture émise, inaccessible, invalide ou modifiée', async () => {
  for (const scenario of ['issued', 'inaccessible', 'invalid', 'stale', 'concurrent'] as const) {
    const { state, handle } = isolatedDraft();
    if (scenario === 'issued') state.invoice.status = 'issued';
    if (scenario === 'inaccessible') state.visible = false;
    if (scenario === 'invalid') state.invoice.customer_registration_number = '123';
    if (scenario === 'concurrent') state.changeDuringRead = true;
    const response = await handle(
      request({
        mode: 'test',
        expectedUpdatedAt: scenario === 'stale' ? 'stale' : state.invoice.updated_at,
      }),
    );
    assert.equal(
      response.status,
      scenario === 'inaccessible' ? 404 : scenario === 'invalid' ? 422 : 409,
      `${scenario}: ${await response.clone().text()}`,
    );
    assert.equal(state.uploads + state.inserts + state.metadataReads + state.signedLinks, 0);
    assert.deepEqual(state.unexpected, []);
  }
});

Deno.test('simulation : refuse un mode inconnu ou une version absente', async () => {
  const { state, handle } = isolatedDraft();
  assert.equal((await handle(request({ mode: 'unknown' }))).status, 400);
  assert.equal((await handle(request({ mode: 'test' }))).status, 400);
  assert.equal(state.uploads + state.inserts + state.metadataReads + state.signedLinks, 0);
  assert.deepEqual(state.unexpected, []);
});
