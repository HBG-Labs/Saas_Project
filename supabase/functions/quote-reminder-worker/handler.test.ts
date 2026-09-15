import { assertEquals, assertMatch } from 'jsr:@std/assert@1';

import type { Message } from '../_shared/email.ts';
import type { OutboundStore } from '../_shared/portal-outbound.ts';
import type { ReminderContext, ReminderStore } from '../_shared/quote-reminders.ts';
import { createQuoteReminderWorkerHandler, type QuoteReminderWorkerConfig } from './handler.ts';

/*
  Sans permission Deno. Le RPC de tirage passe par un `fetch` factice ; les
  accès base sont des doubles (`stores`) ; l'envoi est une fonction injectée.
*/

const ROOT = 'https://project.supabase.co';
const SECRET = 'reminder-secret';
const NOW = new Date('2026-09-23T10:00:00.000Z');
// `buildReplyAddress` exige un vrai UUID de conversation.
const CONV = '11111111-2222-4333-8444-555555555555';

function request(secret = SECRET): Request {
  return new Request('https://worker.local', { method: 'POST', headers: { 'x-worker-secret': secret } });
}

interface Claimed {
  id: string; organization_id: string; quote_id: string; sequence: number; attempts: number; message_id: string | null;
}

function claimedFetch(rows: Claimed[]): typeof fetch {
  return (input) => {
    const url = String(input);
    if (url.includes('/rpc/claim_quote_reminders')) {
      return Promise.resolve(new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return Promise.resolve(new Response('{"message":"unexpected"}', { status: 500 }));
  };
}

function context(overrides: Partial<ReminderContext> = {}): ReminderContext {
  return {
    quote: {
      id: 'q1', reference: 'DEV-0007', title: 'Cabinet', status: 'sent', valid_until: '2026-10-15',
      sent_at: '2026-09-16T09:00:00.000Z', reminders_enabled: true, customer_id: 'c1',
    },
    totalCents: 100_000,
    conversation: { id: CONV, status: 'open' },
    clientRepliedSinceSent: false,
    portalEnabled: true,
    plannedCount: 2,
    ...overrides,
  };
}

function fakeStores(ctx: ReminderContext | null, options: { insertFails?: boolean } = {}) {
  const marks: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const inserted: string[] = [];
  const sentMessages: string[] = [];
  const failedMessages: Array<{ id: string; error: string }> = [];

  const reminders: ReminderStore = {
    context: () => Promise.resolve(ctx),
    insertOutboundMessage: ({ body }) => {
      if (options.insertFails) return Promise.resolve({ error: 'RLS' });
      inserted.push(body);
      return Promise.resolve({ id: `msg-${inserted.length}`, conversation_id: CONV });
    },
    markReminder: (id, patch) => { marks.push({ id, patch }); return Promise.resolve(); },
  };
  const outbound: OutboundStore = {
    conversationContext: () => Promise.resolve({
      subject: 'Devis DEV-0007', contactEmail: 'client@exemple.fr', contactName: 'Sophie Morel',
      organizationName: 'HBG Labs', lastInternetMessageId: '<first@inbound.rezo360.fr>', references: [],
    }),
    markSent: (id) => { sentMessages.push(id); return Promise.resolve(); },
    markFailed: (id, error) => { failedMessages.push({ id, error }); return Promise.resolve(); },
  };
  return { reminders, outbound, marks, inserted, sentMessages, failedMessages };
}

function config(overrides: Partial<QuoteReminderWorkerConfig>): QuoteReminderWorkerConfig {
  return {
    url: ROOT,
    serviceRoleKey: 'service-role',
    secret: SECRET,
    missing: [],
    send: () => Promise.resolve({ transport: 'resend', providerId: 'resend-1' }),
    replySecret: 'reply-secret',
    inboundDomain: 'inbound.rezo360.fr',
    portalUrl: 'https://app.rezo360.com/portail',
    formatDate: (iso) => `le ${iso}`,
    now: () => NOW,
    ...overrides,
  };
}

const REMINDER: Claimed = { id: 'r1', organization_id: 'org1', quote_id: 'q1', sequence: 1, attempts: 0, message_id: null };

Deno.test('refuse un secret absent ou faux, et refuse de tourner sans transport', async () => {
  const stores = fakeStores(context());
  const handler = createQuoteReminderWorkerHandler(config({ fetch: claimedFetch([]), stores }));
  assertEquals((await handler(request(''))).status, 401);

  const unconfigured = createQuoteReminderWorkerHandler(
    config({ fetch: claimedFetch([REMINDER]), stores, missing: ['RESEND_API_KEY'] }),
  );
  const response = await unconfigured(request());
  assertEquals(response.status, 503);
  assertEquals(stores.marks.length, 0, 'rien n’est tiré ni marqué : les relances attendent la configuration');
});

Deno.test('une relance due : message écrit dans le fil, courriel envoyé, relance marquée « sent »', async () => {
  const sent: Message[] = [];
  const stores = fakeStores(context());
  const handler = createQuoteReminderWorkerHandler(
    config({
      fetch: claimedFetch([REMINDER]),
      stores,
      send: (m) => { sent.push(m); return Promise.resolve({ transport: 'resend', providerId: 'resend-1' }); },
    }),
  );

  const body = await (await handler(request())).json();

  assertEquals(body.sent, 1);
  assertEquals(stores.inserted.length, 1);
  assertMatch(stores.inserted[0] ?? '', /DEV-0007 — Cabinet/);
  assertMatch(stores.inserted[0] ?? '', /le 2026-10-15/);
  assertEquals(sent.length, 1);
  assertEquals(sent[0]?.to, 'client@exemple.fr');
  // Dans le fil : « Re: » et `In-Reply-To` pointent le message précédent.
  assertEquals(sent[0]?.subject, 'Re: Devis DEV-0007');
  assertEquals(sent[0]?.headers?.['In-Reply-To'], '<first@inbound.rezo360.fr>');
  assertMatch(sent[0]?.replyTo ?? '', /@inbound\.rezo360\.fr$/);
  const final = stores.marks.at(-1)?.patch;
  assertEquals(final?.status, 'sent');
  assertEquals(final?.message_id, 'msg-1');
});

Deno.test('le devis a été accepté entre-temps : passée, avec le motif, sans courriel', async () => {
  const sent: Message[] = [];
  const stores = fakeStores(context({ quote: { ...context().quote, status: 'accepted' } }));
  const handler = createQuoteReminderWorkerHandler(
    config({ fetch: claimedFetch([REMINDER]), stores, send: (m) => { sent.push(m); return Promise.resolve({ transport: 'resend', providerId: null }); } }),
  );

  const body = await (await handler(request())).json();

  assertEquals(body.skipped, 1);
  assertEquals(sent.length, 0);
  assertEquals(stores.inserted.length, 0);
  assertEquals(stores.marks[0]?.patch.status, 'skipped');
  assertMatch(String(stores.marks[0]?.patch.reason), /accepté/);
});

Deno.test('le client a répondu dans le fil : on ne le relance pas', async () => {
  const stores = fakeStores(context({ clientRepliedSinceSent: true }));
  const handler = createQuoteReminderWorkerHandler(config({ fetch: claimedFetch([REMINDER]), stores }));
  const body = await (await handler(request())).json();
  assertEquals(body.skipped, 1);
  assertMatch(String(stores.marks[0]?.patch.reason), /déjà répondu/);
});

Deno.test('le fournisseur tombe : le message reste en échec dans le fil, la relance est replanifiée', async () => {
  const stores = fakeStores(context());
  const handler = createQuoteReminderWorkerHandler(
    config({ fetch: claimedFetch([REMINDER]), stores, send: () => Promise.reject(new Error('Resend 503')) }),
  );

  const body = await (await handler(request())).json();

  assertEquals(body.failed, 1);
  assertEquals(stores.failedMessages.length, 1);
  const final = stores.marks.at(-1)?.patch;
  assertEquals(final?.attempts, 1);
  assertEquals('status' in (final ?? {}), false, 'toujours pending : sera retentée');
  assertEquals(final?.next_attempt_at, '2026-09-23T10:01:00.000Z');
  assertMatch(String(final?.reason), /Resend 503/);
});

Deno.test('la reprise renvoie le message déjà écrit, sans en créer un second', async () => {
  const stores = fakeStores(context());
  const handler = createQuoteReminderWorkerHandler(
    config({ fetch: claimedFetch([{ ...REMINDER, attempts: 1, message_id: 'msg-precedent' }]), stores }),
  );

  const body = await (await handler(request())).json();

  assertEquals(body.sent, 1);
  assertEquals(stores.inserted.length, 0, 'aucune nouvelle insertion');
  assertEquals(stores.sentMessages, ['msg-precedent']);
});

Deno.test('au cinquième échec, la relance est abandonnée avec son motif', async () => {
  const stores = fakeStores(context());
  const handler = createQuoteReminderWorkerHandler(
    config({
      fetch: claimedFetch([{ ...REMINDER, attempts: 4, message_id: 'msg-precedent' }]),
      stores,
      send: () => Promise.reject(new Error('Resend 503')),
    }),
  );

  await handler(request());

  const final = stores.marks.at(-1)?.patch;
  assertEquals(final?.status, 'failed');
  assertEquals(final?.attempts, 5);
});

Deno.test('le message refuse de s’écrire (trigger) : échec compté, relance replanifiée', async () => {
  const stores = fakeStores(context(), { insertFails: true });
  const handler = createQuoteReminderWorkerHandler(config({ fetch: claimedFetch([REMINDER]), stores }));
  const body = await (await handler(request())).json();
  assertEquals(body.failed, 1);
  assertMatch(String(stores.marks.at(-1)?.patch.reason), /Message non écrit/);
});

Deno.test('la réponse HTTP ne porte que des compteurs', async () => {
  const stores = fakeStores(context());
  const handler = createQuoteReminderWorkerHandler(
    config({ fetch: claimedFetch([REMINDER]), stores, send: () => Promise.reject(new Error('clé re_SECRET invalide')) }),
  );
  const raw = await (await handler(request())).text();
  assertEquals(raw.includes('re_SECRET'), false);
  assertEquals(raw.includes('client@exemple.fr'), false);
  assertEquals(Object.keys(JSON.parse(raw)).sort(), ['attempted', 'durationMs', 'failed', 'sent', 'skipped']);
});
