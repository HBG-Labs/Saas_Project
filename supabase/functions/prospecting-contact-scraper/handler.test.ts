import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { createContactScraperHandler, type CallerStore, type PageFetchResult } from './handler.ts';

const SIREN = '123456789';

function fakeCaller(overrides: Partial<CallerStore> = {}): CallerStore {
  return {
    getWebsite: async () => 'https://plomberie-antilles.fr',
    insertContacts: async (_siren, contacts) =>
      contacts.map((c, i) => ({ id: `contact-${i}`, contact_type: c.contactType, value: c.value })),
    ...overrides,
  };
}

function fakeFetchPage(byUrl: Record<string, PageFetchResult>) {
  return async (url: string): Promise<PageFetchResult> =>
    byUrl[url] ?? { ok: false, status: 404, text: '' };
}

async function post(handler: (req: Request) => Promise<Response>, body: unknown) {
  const response = await handler(
    new Request('http://localhost/prospecting-contact-scraper', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );
  return { status: response.status, body: await response.json() };
}

Deno.test('refuse une méthode autre que POST', async () => {
  const handler = createContactScraperHandler({
    caller: fakeCaller(),
    fetchPage: fakeFetchPage({}),
    resolveIsPublic: async () => true,
  });
  const response = await handler(new Request('http://localhost/x', { method: 'GET' }));
  assertEquals(response.status, 405);
});

Deno.test('refuse un SIREN mal formé', async () => {
  const handler = createContactScraperHandler({
    caller: fakeCaller(),
    fetchPage: fakeFetchPage({}),
    resolveIsPublic: async () => true,
  });
  const { status } = await post(handler, { siren: 'abc' });
  assertEquals(status, 400);
});

Deno.test('refuse quand aucun site officiel n’est renseigné', async () => {
  const handler = createContactScraperHandler({
    caller: fakeCaller({ getWebsite: async () => null }),
    fetchPage: fakeFetchPage({}),
    resolveIsPublic: async () => true,
  });
  const { status, body } = await post(handler, { siren: SIREN });
  assertEquals(status, 400);
  assertEquals((body as { error: string }).error.includes('Aucun site officiel'), true);
});

Deno.test('refuse une IP privée derrière le nom de domaine (protection SSRF, DNS rebinding)', async () => {
  const handler = createContactScraperHandler({
    caller: fakeCaller(),
    fetchPage: fakeFetchPage({}),
    resolveIsPublic: async () => false,
  });
  const { status } = await post(handler, { siren: SIREN });
  assertEquals(status, 400);
});

Deno.test('respecte un robots.txt qui interdit la page', async () => {
  const handler = createContactScraperHandler({
    caller: fakeCaller(),
    fetchPage: fakeFetchPage({
      'https://plomberie-antilles.fr/robots.txt': { ok: true, status: 200, text: 'User-agent: *\nDisallow: /' },
    }),
    resolveIsPublic: async () => true,
  });
  const { status, body } = await post(handler, { siren: SIREN });
  assertEquals(status, 403);
  assertEquals((body as { error: string }).error.includes('robots.txt'), true);
});

Deno.test('sans robots.txt (absent), lit la page normalement', async () => {
  const handler = createContactScraperHandler({
    caller: fakeCaller(),
    fetchPage: fakeFetchPage({
      'https://plomberie-antilles.fr/': {
        ok: true,
        status: 200,
        text: '<a href="mailto:contact@plomberie-antilles.fr">Contact</a>',
      },
    }),
    resolveIsPublic: async () => true,
  });
  const { status, body } = await post(handler, { siren: SIREN });
  assertEquals(status, 200);
  assertEquals((body as { found: unknown[] }).found.length, 1);
});

Deno.test('renvoie found: [] sans écrire si aucune coordonnée trouvée', async () => {
  let insertCalled = false;
  const handler = createContactScraperHandler({
    caller: fakeCaller({
      insertContacts: async (_siren, _contacts) => {
        insertCalled = true;
        return [];
      },
    }),
    fetchPage: fakeFetchPage({
      'https://plomberie-antilles.fr/': { ok: true, status: 200, text: '<p>Bienvenue</p>' },
    }),
    resolveIsPublic: async () => true,
  });
  const { status, body } = await post(handler, { siren: SIREN });
  assertEquals(status, 200);
  assertEquals((body as { found: unknown[] }).found, []);
  assertEquals(insertCalled, false);
});

Deno.test('propage un refus RLS (prospecting.manage manquant) sans écrire', async () => {
  const handler = createContactScraperHandler({
    caller: fakeCaller({ insertContacts: async () => ({ error: 'insufficient_privilege' }) }),
    fetchPage: fakeFetchPage({
      'https://plomberie-antilles.fr/': {
        ok: true,
        status: 200,
        text: '<a href="mailto:contact@plomberie-antilles.fr">Contact</a>',
      },
    }),
    resolveIsPublic: async () => true,
  });
  const { status } = await post(handler, { siren: SIREN });
  assertEquals(status, 403);
});

Deno.test('502 si le site officiel est injoignable', async () => {
  const handler = createContactScraperHandler({
    caller: fakeCaller(),
    fetchPage: fakeFetchPage({}),
    resolveIsPublic: async () => true,
  });
  const { status } = await post(handler, { siren: SIREN });
  assertEquals(status, 502);
});
