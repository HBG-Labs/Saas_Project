import { assertEquals } from 'jsr:@std/assert@1';

import type { ProspectSearchCriteria, ProspectSourceProvider, RawProspect } from '../_shared/prospecting-provider.ts';
import { createProspectingWorkerHandler } from './handler.ts';

/*
  Même patron que `subscription-seat-sync-worker/handler.test.ts` : aucun
  réseau réel, `fetch` injecté répond depuis des réponses en mémoire. La
  source de détection (`ProspectSourceProvider`) est un double direct — ce
  fichier ne teste pas l'API Recherche d'Entreprises elle-même (voir
  `_shared/prospecting-provider.test.ts`), seulement l'orchestration.
*/

const ROOT = 'https://project.supabase.co';
const SECRET = 'prospecting-worker-secret';

function request(body?: unknown, secret = SECRET): Request {
  return new Request('https://worker.local', {
    method: 'POST',
    headers: { 'x-worker-secret': secret, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function stubProvider(results: RawProspect[]): ProspectSourceProvider & { calls: ProspectSearchCriteria[] } {
  const calls: ProspectSearchCriteria[] = [];
  return {
    name: 'recherche_entreprises',
    calls,
    search(criteria) {
      calls.push(criteria);
      return Promise.resolve({ results, totalResults: results.length });
    },
  };
}

function sampleProspect(overrides: Partial<RawProspect> = {}): RawProspect {
  return {
    siren: '123456789',
    raisonSociale: 'PLOMBERIE ANTILLES',
    nomCommercial: null,
    formeJuridique: '5710',
    apeCode: '43.22A',
    createdOn: '2026-06-01',
    statutAdministratif: 'actif',
    trancheEffectif: '01',
    establishment: {
      siret: '12345678900011',
      isHeadquarters: true,
      enseigne: null,
      adresseLine: '1 RUE DES ANTILLES 97200 FORT-DE-FRANCE',
      codePostal: '97200',
      commune: 'FORT-DE-FRANCE',
    },
    departement: '972',
    region: '02',
    ...overrides,
  };
}

function fakeSupabase(options: { sectors?: Array<{ ape_code: string; id: string }>; zone?: Record<string, unknown> | null }) {
  const calls: string[] = [];
  const zone =
    'zone' in options ? options.zone : { id: 'zone-1', code: 'martinique', department_code: '972', active: true };
  const sectors = options.sectors ?? [];

  const fetchImpl: typeof fetch = (input) => {
    const url = String(input);
    calls.push(url);

    if (url.includes('/prospecting_zones')) {
      // `.maybeSingle()` attend un tableau JSON (200) : vide = aucune ligne,
      // un élément = la ligne — pas un 406, contrairement à `.single()`.
      return Promise.resolve(
        new Response(JSON.stringify(zone ? [zone] : []), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    if (url.includes('/prospecting_sectors')) {
      return Promise.resolve(
        new Response(JSON.stringify(sectors), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );
    }
    if (url.includes('/prospecting_runs')) {
      if (url.includes('/rpc/')) return Promise.resolve(new Response('{}', { status: 200 }));
      // insert (POST) renvoie l'id créé ; update (PATCH) n'a besoin de rien.
      return Promise.resolve(
        new Response(JSON.stringify({ id: 'run-1' }), { status: 201, headers: { 'Content-Type': 'application/json' } }),
      );
    }
    if (url.includes('/rpc/upsert_prospect_establishment')) {
      return Promise.resolve(new Response('{}', { status: 200 }));
    }
    if (url.includes('/rpc/upsert_prospect')) {
      return Promise.resolve(
        new Response(JSON.stringify({ siren: '123456789', inserted: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    return Promise.resolve(new Response(JSON.stringify({ message: 'unexpected ' + url }), { status: 500 }));
  };

  return { fetchImpl, calls };
}

Deno.test('le worker de prospection refuse tout secret absent ou incorrect', async () => {
  const handler = createProspectingWorkerHandler({
    url: ROOT,
    serviceRoleKey: 'service-role',
    secret: SECRET,
    provider: stubProvider([]),
  });

  assertEquals((await handler(request(undefined, ''))).status, 401);
  assertEquals((await handler(request(undefined, 'incorrect'))).status, 401);
});

Deno.test("sans secteur actif ni apeCodes fourni, le worker refuse plutôt que de tout ramener", async () => {
  const { fetchImpl } = fakeSupabase({ sectors: [] });
  const handler = createProspectingWorkerHandler({
    url: ROOT,
    serviceRoleKey: 'service-role',
    secret: SECRET,
    provider: stubProvider([]),
    fetch: fetchImpl,
  });

  const response = await handler(request({}));
  assertEquals(response.status, 400);
});

Deno.test('sans zone active correspondante, le worker refuse', async () => {
  const { fetchImpl } = fakeSupabase({ zone: null });
  const handler = createProspectingWorkerHandler({
    url: ROOT,
    serviceRoleKey: 'service-role',
    secret: SECRET,
    provider: stubProvider([]),
    fetch: fetchImpl,
  });

  const response = await handler(request({ apeCodes: ['43.22A'] }));
  assertEquals(response.status, 400);
});

Deno.test('un petit échantillon est détecté, upserté, et le run reflète les compteurs', async () => {
  const { fetchImpl, calls } = fakeSupabase({ sectors: [{ ape_code: '43.22A', id: 'sector-1' }] });
  const provider = stubProvider([sampleProspect()]);
  const handler = createProspectingWorkerHandler({
    url: ROOT,
    serviceRoleKey: 'service-role',
    secret: SECRET,
    provider,
    fetch: fetchImpl,
  });

  const response = await handler(request({ apeCodes: ['43.22A'], limit: 5 }));
  const payload = await response.json();

  assertEquals(response.status, 200);
  assertEquals(payload.created, 1);
  assertEquals(payload.updated, 0);
  assertEquals(payload.errors, 0);
  assertEquals(provider.calls[0].departmentCode, '972');
  assertEquals(provider.calls[0].apeCode, '43.22A');
  assertEquals(
    calls.some((call) => call.includes('/rpc/upsert_prospect') && !call.includes('establishment')),
    true,
  );
  assertEquals(calls.some((call) => call.includes('/rpc/upsert_prospect_establishment')), true);
});

Deno.test('la limite plafonne au maximum de sécurité de la Phase 3, même si demandé plus grand', async () => {
  const { fetchImpl } = fakeSupabase({ sectors: [{ ape_code: '43.22A', id: 'sector-1' }] });
  const provider = stubProvider([sampleProspect()]);
  const handler = createProspectingWorkerHandler({
    url: ROOT,
    serviceRoleKey: 'service-role',
    secret: SECRET,
    provider,
    fetch: fetchImpl,
  });

  await handler(request({ apeCodes: ['43.22A'], limit: 10_000 }));
  assertEquals(provider.calls[0].perPage <= 25, true);
});

Deno.test('un code NAF mal formé est refusé avant tout appel réseau', async () => {
  const { fetchImpl } = fakeSupabase({ sectors: [] });
  const provider = stubProvider([]);
  const handler = createProspectingWorkerHandler({
    url: ROOT,
    serviceRoleKey: 'service-role',
    secret: SECRET,
    provider,
    fetch: fetchImpl,
  });

  const response = await handler(request({ apeCodes: ['4322A'] }));
  assertEquals(response.status, 400);
  assertEquals(provider.calls.length, 0);
});
