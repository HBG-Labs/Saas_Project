import { assertEquals } from 'jsr:@std/assert@1';

import { buildMessageId, buildReplyAddress } from '../_shared/portal-mail.ts';
import {
  createResendWebhookHandler,
  type ConversationRef,
  type ReceivedEmail,
  type WebhookStore,
} from './handler.ts';

/*
  Doublures en mémoire : le gestionnaire ne voit ni supabase-js ni `fetch`.
  Ces tests tournent sans permission, comme dans la CI.
*/

const SECRET_B64 = btoa('cle-webhook-de-test-32-octets!!!');
const WHSEC = `whsec_${SECRET_B64}`;
const REPLY_SECRET = 'secret-de-reponse';
const DOMAIN = 'inbound.rezo360.fr';
const NOW = 1_800_000_000;
const CONV: ConversationRef = {
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  organization_id: '11111111-1111-4111-8111-111111111111',
  contact_email: 'Jean.Client@example.com',
  status: 'open',
};
const OUT_MSG = '00000000-0000-4000-8000-000000000001';

async function sign(id: string, ts: string, body: string): Promise<string> {
  const key = Uint8Array.from(atob(SECRET_B64), (c) => c.charCodeAt(0));
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${id}.${ts}.${body}`));
  let bin = ''; for (const b of new Uint8Array(mac)) bin += String.fromCharCode(b);
  return `v1,${btoa(bin)}`;
}

interface Journal {
  events: Map<string, { outcome?: string; detail?: string }>;
  inbound: Array<Parameters<WebhookStore['insertInboundMessage']>[0]>;
  attachments: Array<Parameters<WebhookStore['storeAttachment']>[0]>;
  statuses: Array<{ id: string; status: string }>;
}

function makeStore(options: { conversation?: ConversationRef | null; knownEmailIds?: string[] } = {}) {
  const journal: Journal = { events: new Map(), inbound: [], attachments: [], statuses: [] };
  const conversation = options.conversation === undefined ? CONV : options.conversation;
  const store: WebhookStore = {
    recordEvent: ({ id }) => {
      const seen = journal.events.get(id);
      if (seen !== undefined && seen.outcome !== 'failed') return Promise.resolve('duplicate');
      journal.events.set(id, {});
      return Promise.resolve('new');
    },
    finishEvent: (id, outcome, detail) => {
      journal.events.set(id, { outcome, ...(detail === undefined ? {} : { detail }) });
      return Promise.resolve();
    },
    findConversationById: (id) => Promise.resolve(conversation !== null && conversation.id === id ? conversation : null),
    findConversationByMessageId: (id) => Promise.resolve(conversation !== null && id === OUT_MSG ? conversation : null),
    insertInboundMessage: (input) => {
      journal.inbound.push(input);
      return Promise.resolve({ id: `in-${journal.inbound.length}` });
    },
    storeAttachment: (input) => {
      journal.attachments.push(input);
      return Promise.resolve();
    },
    updateDeliveryStatus: (id, status) => {
      const known = (options.knownEmailIds ?? []).includes(id);
      if (known) journal.statuses.push({ id, status });
      return Promise.resolve(known);
    },
  };
  return { store, journal };
}

function makeResend(received: ReceivedEmail | null, bytes: Record<string, Uint8Array> = {}) {
  return {
    getReceived: () => Promise.resolve(received),
    getAttachment: (_e: string, id: string) => Promise.resolve(bytes[id] ?? null),
  };
}

function handler(store: WebhookStore, resend: ReturnType<typeof makeResend>) {
  return createResendWebhookHandler({
    webhookSecret: WHSEC,
    replySecret: REPLY_SECRET,
    inboundDomain: DOMAIN,
    store,
    resend,
    now: () => new Date(NOW * 1000),
  });
}

async function signedRequest(id: string, payload: unknown, tamper: (h: Headers) => void = () => {}): Promise<Request> {
  const body = JSON.stringify(payload);
  const headers = new Headers({
    'content-type': 'application/json',
    'svix-id': id,
    'svix-timestamp': String(NOW),
    'svix-signature': await sign(id, String(NOW), body),
  });
  tamper(headers);
  return new Request('https://x/resend-webhook', { method: 'POST', headers, body });
}

const QUOTED = ['Merci, 14 h me convient.', '', 'Le 12 sept. 2026, REZO360 a écrit :', '> Bonjour'].join('\n');

function receivedMail(to: string[], extra: Partial<ReceivedEmail> = {}): ReceivedEmail {
  return {
    from: 'Jean Client <jean.client@example.com>',
    to,
    subject: 'Re: Votre intervention',
    text: QUOTED,
    html: null,
    headers: { 'Message-ID': '<abc@example.com>', 'In-Reply-To': buildMessageId(OUT_MSG, DOMAIN) },
    attachments: [],
    ...extra,
  };
}

Deno.test('AC27 — signature absente ou invalide : 401, rien n’est lu ni écrit', async () => {
  const { store, journal } = makeStore();
  const h = handler(store, makeResend(null));

  const sans = await signedRequest('evt_1', { type: 'email.delivered' }, (hd) => hd.delete('svix-signature'));
  assertEquals((await h(sans)).status, 401);

  const fausse = await signedRequest('evt_1', { type: 'email.delivered' }, (hd) => hd.set('svix-signature', 'v1,AAAA'));
  assertEquals((await h(fausse)).status, 401);

  const autreId = await signedRequest('evt_1', { type: 'email.delivered' }, (hd) => hd.set('svix-id', 'evt_2'));
  assertEquals((await h(autreId)).status, 401);

  assertEquals(journal.events.size, 0);
});

Deno.test('AC26/AC28 — un événement valide est traité une fois ; son rejeu est absorbé', async () => {
  const { store, journal } = makeStore({ knownEmailIds: ['re_out_1'] });
  const h = handler(store, makeResend(null));
  const req = () => signedRequest('evt_deliv', { type: 'email.delivered', data: { email_id: 're_out_1' } });

  const first = await h(await req());
  assertEquals(first.status, 200);
  assertEquals(await first.json(), { received: true, updated: true });
  assertEquals(journal.statuses, [{ id: 're_out_1', status: 'delivered' }]);
  assertEquals(journal.events.get('evt_deliv')?.outcome, 'processed');

  const again = await h(await req());
  assertEquals(await again.json(), { duplicate: true });
  assertEquals(journal.statuses.length, 1);
});

Deno.test('un statut pour un identifiant inconnu est ignoré sans erreur', async () => {
  const { store, journal } = makeStore();
  const h = handler(store, makeResend(null));
  const res = await h(await signedRequest('evt_x', { type: 'email.bounced', data: { email_id: 're_inconnu' } }));
  assertEquals(await res.json(), { received: true, updated: false });
  assertEquals(journal.events.get('evt_x')?.outcome, 'ignored');
});

Deno.test('AC24 — une réponse par adresse HMAC est rattachée et nettoyée', async () => {
  const { store, journal } = makeStore();
  const address = await buildReplyAddress(CONV.id, REPLY_SECRET, DOMAIN);
  const mail = receivedMail([address], { headers: { 'Message-ID': '<abc@example.com>' } });
  const h = handler(store, makeResend(mail));

  const res = await h(await signedRequest('evt_in', { type: 'email.received', data: { email_id: 're_in_1' } }));
  assertEquals(await res.json(), { received: true, matched: true });
  assertEquals(journal.inbound.length, 1);
  const msg = journal.inbound[0];
  assertEquals(msg?.conversationId, CONV.id);
  assertEquals(msg?.organizationId, CONV.organization_id);
  assertEquals(msg?.senderEmail, 'jean.client@example.com');
  assertEquals(msg?.bodyText, 'Merci, 14 h me convient.');
  assertEquals(msg?.resendEmailId, 're_in_1');
  assertEquals(msg?.internetMessageId, '<abc@example.com>');
  assertEquals(journal.events.get('evt_in')?.outcome, 'processed');
});

Deno.test('AC24 — à défaut d’adresse, In-Reply-To sur notre Message-ID suffit', async () => {
  const { store, journal } = makeStore();
  const h = handler(store, makeResend(receivedMail(['contact@rezo360.fr'])));
  const res = await h(await signedRequest('evt_in2', { type: 'email.received', data: { email_id: 're_in_2' } }));
  assertEquals(await res.json(), { received: true, matched: true });
  assertEquals(journal.inbound[0]?.conversationId, CONV.id);
  assertEquals(journal.events.get('evt_in2')?.detail?.includes('via=in_reply_to'), true);
});

Deno.test('AC29 — un entrant sans indice est mis en quarantaine, jamais deviné', async () => {
  const { store, journal } = makeStore();
  const mail = receivedMail(['contact@rezo360.fr'], { headers: { 'In-Reply-To': '<x@gmail.com>' } });
  const h = handler(store, makeResend(mail));
  const res = await h(await signedRequest('evt_q', { type: 'email.received', data: { email_id: 're_q' } }));
  assertEquals(await res.json(), { received: true, matched: false });
  assertEquals(journal.inbound.length, 0);
  assertEquals(journal.events.get('evt_q')?.outcome, 'unmatched');
});

Deno.test('AC29 — une adresse valide mais un expéditeur qui n’est pas le contact : rejet', async () => {
  // L'adresse désigne bien une conversation ; mais ce n'est pas le client
  // qui écrit. On n'attribue pas au client un message qu'il n'a pas envoyé.
  const { store, journal } = makeStore();
  const address = await buildReplyAddress(CONV.id, REPLY_SECRET, DOMAIN);
  const h = handler(store, makeResend(receivedMail([address], { from: 'pirate@evil.example' })));
  const res = await h(await signedRequest('evt_p', { type: 'email.received', data: { email_id: 're_p' } }));
  assertEquals(await res.json(), { received: true, matched: false });
  assertEquals(journal.inbound.length, 0);
  assertEquals(journal.events.get('evt_p')?.outcome, 'rejected');
});

Deno.test('une conversation close ne reçoit plus de réponse', async () => {
  const { store, journal } = makeStore({ conversation: { ...CONV, status: 'closed' } });
  const address = await buildReplyAddress(CONV.id, REPLY_SECRET, DOMAIN);
  const h = handler(store, makeResend(receivedMail([address])));
  await h(await signedRequest('evt_c', { type: 'email.received', data: { email_id: 're_c' } }));
  assertEquals(journal.inbound.length, 0);
  assertEquals(journal.events.get('evt_c')?.outcome, 'rejected');
});

Deno.test('les pièces jointes autorisées sont stockées, les autres passées', async () => {
  const { store, journal } = makeStore();
  const address = await buildReplyAddress(CONV.id, REPLY_SECRET, DOMAIN);
  const mail = receivedMail([address], {
    attachments: [
      { id: 'att_pdf', filename: 'photo.pdf', content_type: 'application/pdf', size: 1000 },
      { id: 'att_exe', filename: 'virus.exe', content_type: 'application/x-msdownload', size: 1000 },
      { id: 'att_big', filename: 'gros.png', content_type: 'image/png', size: 16 * 1024 * 1024 },
    ],
  });
  const h = handler(store, makeResend(mail, { att_pdf: new Uint8Array([1, 2, 3]) }));
  await h(await signedRequest('evt_a', { type: 'email.received', data: { email_id: 're_a' } }));
  assertEquals(journal.attachments.length, 1);
  assertEquals(journal.attachments[0]?.filename, 'photo.pdf');
  assertEquals(journal.attachments[0]?.messageId, 'in-1');
  assertEquals(journal.events.get('evt_a')?.detail?.endsWith('pj=1/3'), true);
});

Deno.test('un contenu introuvable chez Resend laisse l’événement en échec, rejouable', async () => {
  const { store, journal } = makeStore();
  const h = handler(store, makeResend(null));
  const req = () => signedRequest('evt_f', { type: 'email.received', data: { email_id: 're_f' } });
  assertEquals((await h(await req())).status, 502);
  assertEquals(journal.events.get('evt_f')?.outcome, 'failed');
  // Le rejeu n'est PAS un doublon : le premier essai n'a rien produit.
  assertEquals((await h(await req())).status, 502);
});

Deno.test('un type inconnu est journalisé et ignoré', async () => {
  const { store, journal } = makeStore();
  const h = handler(store, makeResend(null));
  const res = await h(await signedRequest('evt_u', { type: 'email.opened', data: { email_id: 're_u' } }));
  assertEquals(await res.json(), { received: true, ignored: true });
  assertEquals(journal.events.get('evt_u')?.outcome, 'ignored');
});

Deno.test('seul POST est accepté', async () => {
  const { store } = makeStore();
  const h = handler(store, makeResend(null));
  assertEquals((await h(new Request('https://x/resend-webhook', { method: 'GET' }))).status, 405);
});
