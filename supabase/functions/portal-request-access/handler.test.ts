import { assertEquals } from 'jsr:@std/assert@1';

import type { Message } from '../_shared/email.ts';
import { createPortalRequestAccessHandler, renderOtpEmail, type AccessStore, type PortalGate } from './handler.ts';

const GATE: PortalGate = {
  organization_id: '11111111-1111-4111-8111-111111111111',
  organization_name: 'Plomberie Dupont',
  contact_id: '22222222-2222-4222-8222-222222222222',
};

function setup(options: { gate?: PortalGate | null; recent?: number; sendFails?: string; missing?: string[] } = {}) {
  const journal = { recorded: [] as PortalGate[], issued: [] as string[], emails: [] as Message[] };
  const store: AccessStore = {
    portalGate: () => Promise.resolve(options.gate === undefined ? GATE : options.gate),
    recentRequests: () => Promise.resolve(options.recent ?? 0),
    recordRequest: (gate) => { journal.recorded.push(gate); return Promise.resolve(); },
    issueOtp: (email) => { journal.issued.push(email); return Promise.resolve({ code: '482913' }); },
  };
  const handler = createPortalRequestAccessHandler({
    store,
    send: (message) => {
      journal.emails.push(message);
      if (options.sendFails) return Promise.reject(new Error(options.sendFails));
      return Promise.resolve({ transport: 'resend', providerId: 're_otp' });
    },
    missing: options.missing ?? [],
    now: () => new Date('2026-09-13T10:00:00Z'),
  });
  return { handler, journal };
}

const post = (body: unknown) =>
  new Request('https://x/portal-request-access', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

Deno.test('AC04 — un contact autorisé reçoit un code par courriel, jamais dans la réponse', async () => {
  const { handler, journal } = setup();
  const res = await handler(post({ email: ' Jean.Client@Example.com ' }));
  assertEquals(res.status, 200);
  const body = await res.text();
  assertEquals(body.includes('482913'), false);

  assertEquals(journal.issued, ['jean.client@example.com']);
  assertEquals(journal.recorded, [GATE]);
  assertEquals(journal.emails.length, 1);
  assertEquals(journal.emails[0]?.to, 'jean.client@example.com');
  assertEquals(journal.emails[0]?.text.includes('482913'), true);
  assertEquals(journal.emails[0]?.subject.includes('Plomberie Dupont'), true);
});

Deno.test('AC04/AC05 — une adresse inconnue ou révoquée obtient la même réponse, sans code', async () => {
  const autorise = setup();
  const inconnu = setup({ gate: null });
  const a = await autorise.handler(post({ email: 'jean.client@example.com' }));
  const b = await inconnu.handler(post({ email: 'inconnu@example.com' }));
  assertEquals(a.status, b.status);
  assertEquals(await a.text(), await b.text());
  assertEquals(inconnu.journal.issued, []);
  assertEquals(inconnu.journal.emails, []);
});

Deno.test('au-delà du plafond, la réponse ne change pas mais rien ne part', async () => {
  const { handler, journal } = setup({ recent: 3 });
  const res = await handler(post({ email: 'jean.client@example.com' }));
  assertEquals(res.status, 200);
  assertEquals(journal.issued, []);
  assertEquals(journal.emails, []);
});

Deno.test('une adresse mal formée est refusée avant toute lecture', async () => {
  const { handler, journal } = setup();
  assertEquals((await handler(post({ email: 'pas-une-adresse' }))).status, 400);
  assertEquals((await handler(post({ email: 42 }))).status, 400);
  assertEquals((await handler(post({}))).status, 400);
  assertEquals(journal.issued, []);
});

Deno.test('un échec d’envoi est dit franchement à un appelant autorisé', async () => {
  const { handler } = setup({ sendFails: 'Resend 403 : Domain not verified' });
  const res = await handler(post({ email: 'jean.client@example.com' }));
  assertEquals(res.status, 502);
});

Deno.test('sans configuration, la fonction refuse et nomme ce qui manque', async () => {
  const { handler, journal } = setup({ missing: ['RESEND_API_KEY', 'PORTAL_FROM_EMAIL'] });
  const res = await handler(post({ email: 'jean.client@example.com' }));
  assertEquals(res.status, 500);
  assertEquals(((await res.json()) as { error: string }).error.includes('PORTAL_FROM_EMAIL'), true);
  assertEquals(journal.issued, []);
});

Deno.test('le courriel du code échappe le nom de l’organisation', () => {
  const { html, text } = renderOtpEmail({ organizationName: 'A <b>', code: '123456', expiresMinutes: 60 });
  assertEquals(html.includes('A &lt;b&gt;'), true);
  assertEquals(html.includes('<b>'), false);
  assertEquals(text.includes('123456'), true);
});
