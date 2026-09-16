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

function fakeSupabase(options: {
  sectors?: Array<{ ape_code: string; id: string }>;
  zones?: Array<Record<string, unknown>>;
  cursors?: Array<{ zone_id: string; sector_id: string; next_page: number }>;
  scores?: Record<string, number>;
}) {
  const calls: string[] = [];
  const zones = options.zones ?? [
    { id: 'zone-1', code: 'martinique', label: 'Martinique', department_code: '972', active: true },
  ];
  const sectors = options.sectors ?? [];
  const cursors = options.cursors ?? [];
  const scores = options.scores ?? {};

  const upsertedSirens: string[] = [];
  const cursorUpserts: Array<{ zone_id: string; sector_id: string; next_page: number }> = [];

  const fetchImpl: typeof fetch = (input, init) => {
    const url = String(input);
    calls.push(url);

    if (url.includes('/rpc/upsert_prospect') && !url.includes('establishment') && init?.body) {
      const parsed = JSON.parse(String(init.body)) as { p_siren?: string };
      if (parsed.p_siren) upsertedSirens.push(parsed.p_siren);
    }

    if (url.includes('/prospecting_sync_cursors')) {
      if (init?.method === 'POST' && init.body) {
        const parsed = JSON.parse(String(init.body)) as { zone_id: string; sector_id: string; next_page: number };
        cursorUpserts.push(parsed);
        return Promise.resolve(new Response('{}', { status: 200 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify(cursors), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );
    }
    if (url.includes('/prospecting_zones')) {
      // `.maybeSingle()`/liste attend un tableau JSON (200), pas un 406.
      const filtered = url.includes('code=eq.')
        ? zones.filter((zone) => url.includes(`code=eq.${zone.code}`))
        : zones;
      return Promise.resolve(
        new Response(JSON.stringify(filtered), { status: 200, headers: { 'Content-Type': 'application/json' } }),
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
    if (url.includes('/prospects') && !url.includes('/rpc/')) {
      const rows = Object.entries(scores).map(([siren, opportunity_score]) => ({ siren, opportunity_score }));
      return Promise.resolve(
        new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } }),
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

  return { fetchImpl, calls, upsertedSirens, cursorUpserts };
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
  const { fetchImpl } = fakeSupabase({ zones: [] });
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

Deno.test(
  "une page pleine est toujours demandée, même si le budget global restant est plus petit — " +
    "sans quoi il n'y aurait jamais rien à trier",
  async () => {
    const { fetchImpl } = fakeSupabase({ sectors: [{ ape_code: '43.22A', id: 'sector-1' }] });
    const provider = stubProvider([sampleProspect()]);
    const handler = createProspectingWorkerHandler({
      url: ROOT,
      serviceRoleKey: 'service-role',
      secret: SECRET,
      provider,
      fetch: fetchImpl,
    });

    await handler(request({ apeCodes: ['43.22A'], limit: 2 }));
    assertEquals(provider.calls[0].perPage, 25);
  },
);

Deno.test(
  "priorise les entreprises les plus récemment créées — l'API ne le fait pas elle-même",
  async () => {
    const { fetchImpl, upsertedSirens } = fakeSupabase({ sectors: [{ ape_code: '43.22A', id: 'sector-1' }] });
    const provider = stubProvider([
      sampleProspect({ siren: '111111111', createdOn: '1990-01-01' }),
      sampleProspect({ siren: '222222222', createdOn: '2026-06-01' }),
      sampleProspect({ siren: '333333333', createdOn: null }),
      sampleProspect({ siren: '444444444', createdOn: '2010-01-01' }),
    ]);
    const handler = createProspectingWorkerHandler({
      url: ROOT,
      serviceRoleKey: 'service-role',
      secret: SECRET,
      provider,
      fetch: fetchImpl,
    });

    const response = await handler(request({ apeCodes: ['43.22A'], limit: 2 }));
    const payload = await response.json();

    assertEquals(response.status, 200);
    assertEquals(payload.filtered, 2);
    // Les deux plus récentes (2026 puis 2010), dans cet ordre — jamais la plus
    // ancienne (1990) ni celle sans date connue.
    assertEquals(upsertedSirens, ['222222222', '444444444']);
  },
);

Deno.test('plusieurs zones actives sont traitées dans le même run, sans dépasser le plafond global', async () => {
  const { fetchImpl } = fakeSupabase({
    sectors: [{ ape_code: '43.22A', id: 'sector-1' }],
    zones: [
      { id: 'zone-1', code: 'martinique', label: 'Martinique', department_code: '972', active: true },
      { id: 'zone-2', code: 'guadeloupe', label: 'Guadeloupe', department_code: '971', active: true },
    ],
  });
  const provider = stubProvider([sampleProspect(), sampleProspect({ siren: '987654321' })]);
  const handler = createProspectingWorkerHandler({
    url: ROOT,
    serviceRoleKey: 'service-role',
    secret: SECRET,
    provider,
    fetch: fetchImpl,
  });

  const response = await handler(request({ apeCodes: ['43.22A'], limit: 3 }));
  const payload = await response.json();

  assertEquals(response.status, 200);
  assertEquals(payload.zones, ['martinique', 'guadeloupe']);
  // Une recherche par zone au minimum, avec le bon département à chaque fois.
  assertEquals(provider.calls.some((call) => call.departmentCode === '972'), true);
  assertEquals(provider.calls.some((call) => call.departmentCode === '971'), true);
  // Le plafond global (3) est respecté même réparti sur deux zones.
  assertEquals(payload.filtered <= 3, true);
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

Deno.test('Phase 10 — lit le curseur existant et interroge la bonne page', async () => {
  const { fetchImpl } = fakeSupabase({
    sectors: [{ ape_code: '43.22A', id: 'sector-1' }],
    cursors: [{ zone_id: 'zone-1', sector_id: 'sector-1', next_page: 3 }],
  });
  const provider = stubProvider([sampleProspect()]);
  const handler = createProspectingWorkerHandler({
    url: ROOT,
    serviceRoleKey: 'service-role',
    secret: SECRET,
    provider,
    fetch: fetchImpl,
  });

  await handler(request({ apeCodes: ['43.22A'] }));
  assertEquals(provider.calls[0].page, 3);
});

Deno.test("Phase 10 — sans curseur existant, repart de la page 1", async () => {
  const { fetchImpl } = fakeSupabase({ sectors: [{ ape_code: '43.22A', id: 'sector-1' }] });
  const provider = stubProvider([sampleProspect()]);
  const handler = createProspectingWorkerHandler({
    url: ROOT,
    serviceRoleKey: 'service-role',
    secret: SECRET,
    provider,
    fetch: fetchImpl,
  });

  await handler(request({ apeCodes: ['43.22A'] }));
  assertEquals(provider.calls[0].page, 1);
});

Deno.test('Phase 10 — avance le curseur d’une page quand la fin des résultats n’est pas atteinte', async () => {
  const { fetchImpl, cursorUpserts } = fakeSupabase({
    sectors: [{ ape_code: '43.22A', id: 'sector-1' }],
    cursors: [{ zone_id: 'zone-1', sector_id: 'sector-1', next_page: 2 }],
  });
  const provider: ProspectSourceProvider = {
    name: 'recherche_entreprises',
    // 25 résultats renvoyés sur un total de 100 : encore de la marge, page suivante.
    search: () => Promise.resolve({ results: [sampleProspect()], totalResults: 100 }),
  };
  const handler = createProspectingWorkerHandler({
    url: ROOT,
    serviceRoleKey: 'service-role',
    secret: SECRET,
    provider,
    fetch: fetchImpl,
  });

  await handler(request({ apeCodes: ['43.22A'] }));

  assertEquals(cursorUpserts, [{ zone_id: 'zone-1', sector_id: 'sector-1', next_page: 3 }]);
});

Deno.test('Phase 10 — revient à la page 1 une fois la fin des résultats atteinte', async () => {
  const { fetchImpl, cursorUpserts } = fakeSupabase({
    sectors: [{ ape_code: '43.22A', id: 'sector-1' }],
    cursors: [{ zone_id: 'zone-1', sector_id: 'sector-1', next_page: 4 }],
  });
  const provider: ProspectSourceProvider = {
    name: 'recherche_entreprises',
    // Page 4 × 25 = 100, totalResults = 90 : la fin est déjà dépassée.
    search: () => Promise.resolve({ results: [sampleProspect()], totalResults: 90 }),
  };
  const handler = createProspectingWorkerHandler({
    url: ROOT,
    serviceRoleKey: 'service-role',
    secret: SECRET,
    provider,
    fetch: fetchImpl,
  });

  await handler(request({ apeCodes: ['43.22A'] }));

  assertEquals(cursorUpserts, [{ zone_id: 'zone-1', sector_id: 'sector-1', next_page: 1 }]);
});

Deno.test('Phase 10 — notifie uniquement sur demande explicite (notify: true), jamais un appel manuel', async () => {
  const { fetchImpl } = fakeSupabase({
    sectors: [{ ape_code: '43.22A', id: 'sector-1' }],
    scores: { '123456789': 85 },
  });
  const provider = stubProvider([sampleProspect()]);
  let sent = 0;
  const handler = createProspectingWorkerHandler({
    url: ROOT,
    serviceRoleKey: 'service-role',
    secret: SECRET,
    provider,
    fetch: fetchImpl,
    notifyEmail: 'contact@rezo360.fr',
    sendNotification: () => {
      sent += 1;
      return Promise.resolve({ transport: 'resend' as const, providerId: null });
    },
  });

  await handler(request({ apeCodes: ['43.22A'] })); // notify absent
  assertEquals(sent, 0);

  const response = await handler(request({ apeCodes: ['43.22A'], notify: true }));
  const payload = await response.json();
  assertEquals(sent, 1);
  assertEquals(payload.notified, true);
});

Deno.test('Phase 10 — n’envoie aucune notification si aucun prospect n’a été CRÉÉ (mise à jour seule ne compte pas)', async () => {
  const { fetchImpl } = fakeSupabase({ sectors: [{ ape_code: '43.22A', id: 'sector-1' }] });
  const provider = stubProvider([sampleProspect()]);
  let sent = 0;

  // Reprend le double `fakeSupabase`, mais force `inserted: false` pour ce test.
  const fetchWithUpdateOnly: typeof fetch = (input, init) => {
    const url = String(input);
    if (url.includes('/rpc/upsert_prospect') && !url.includes('establishment')) {
      return Promise.resolve(
        new Response(JSON.stringify({ siren: '123456789', inserted: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    return fetchImpl(input, init);
  };

  const handler = createProspectingWorkerHandler({
    url: ROOT,
    serviceRoleKey: 'service-role',
    secret: SECRET,
    provider,
    fetch: fetchWithUpdateOnly,
    notifyEmail: 'contact@rezo360.fr',
    sendNotification: () => {
      sent += 1;
      return Promise.resolve({ transport: 'resend' as const, providerId: null });
    },
  });

  const response = await handler(request({ apeCodes: ['43.22A'], notify: true }));
  const payload = await response.json();

  assertEquals(sent, 0);
  assertEquals(payload.notified, false);
});

Deno.test('Phase 10 — sans transport de notification configuré, le run réussit quand même', async () => {
  const { fetchImpl } = fakeSupabase({ sectors: [{ ape_code: '43.22A', id: 'sector-1' }] });
  const provider = stubProvider([sampleProspect()]);
  const handler = createProspectingWorkerHandler({
    url: ROOT,
    serviceRoleKey: 'service-role',
    secret: SECRET,
    provider,
    fetch: fetchImpl,
    // Ni notifyEmail ni sendNotification : notification non configurée.
  });

  const response = await handler(request({ apeCodes: ['43.22A'], notify: true }));
  const payload = await response.json();

  assertEquals(response.status, 200);
  assertEquals(payload.notified, false);
});
