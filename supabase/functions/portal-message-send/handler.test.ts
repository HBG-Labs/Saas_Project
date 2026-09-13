import { assertEquals } from 'jsr:@std/assert@1';

import type { Message } from '../_shared/email.ts';
import { buildMessageId, parseReplyAddress } from '../_shared/portal-mail.ts';
import {
  createPortalMessageSendHandler,
  renderOutboundEmail,
  type AdminStore,
  type CallerStore,
  type ConversationContext,
  type InsertedMessage,
} from './handler.ts';

const CONV = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const ORG = '11111111-1111-4111-8111-111111111111';
const MSG = '00000000-0000-4000-8000-000000000001';
const REPLY_SECRET = 'secret-de-reponse';
const DOMAIN = 'inbound.rezo360.fr';

const CONTEXT: ConversationContext = {
  subject: 'Votre intervention du 15/09',
  contactEmail: 'jean.client@example.com',
  contactName: 'Jean Client',
  organizationName: 'Plomberie Dupont',
  lastInternetMessageId: null,
  references: [],
};

interface Journal {
  conversations: Array<Parameters<CallerStore['createConversation']>[0]>;
  inserts: Array<Parameters<CallerStore['insertMessage']>[0]>;
  sent: Array<{ id: string } & Parameters<AdminStore['markSent']>[1]>;
  failed: Array<{ id: string; error: string }>;
  emails: Message[];
}

function setup(options: {
  direction?: 'outbound' | 'inbound';
  insertError?: string;
  createError?: string;
  context?: ConversationContext | null;
  sendFails?: string;
  missing?: string[];
} = {}) {
  const journal: Journal = { conversations: [], inserts: [], sent: [], failed: [], emails: [] };
  const caller: CallerStore = {
    createConversation: (input) => {
      journal.conversations.push(input);
      return Promise.resolve(options.createError ? { error: options.createError } : { id: CONV });
    },
    insertMessage: (input) => {
      journal.inserts.push(input);
      if (options.insertError) return Promise.resolve({ error: options.insertError });
      const row: InsertedMessage = { id: MSG, conversation_id: input.conversationId, organization_id: ORG, direction: options.direction ?? 'outbound' };
      return Promise.resolve(row);
    },
  };
  const admin: AdminStore = {
    conversationContext: () => Promise.resolve(options.context === undefined ? CONTEXT : options.context),
    markSent: (id, input) => { journal.sent.push({ id, ...input }); return Promise.resolve(); },
    markFailed: (id, error) => { journal.failed.push({ id, error }); return Promise.resolve(); },
  };
  const handler = createPortalMessageSendHandler({
    caller,
    admin,
    send: (message) => {
      journal.emails.push(message);
      if (options.sendFails) return Promise.reject(new Error(options.sendFails));
      return Promise.resolve({ transport: 'resend', providerId: 're_abc' });
    },
    replySecret: REPLY_SECRET,
    inboundDomain: DOMAIN,
    portalUrl: 'https://rezo360.com/portail',
    missing: options.missing ?? [],
  });
  return { handler, journal };
}

const post = (body: unknown) =>
  new Request('https://x/portal-message-send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: 'Bearer jeton' },
    body: JSON.stringify(body),
  });

Deno.test('AC23 — un message de l’entreprise part par Resend et garde l’identifiant fournisseur', async () => {
  const { handler, journal } = setup();
  const res = await handler(post({ conversationId: CONV, body: 'Bonjour,\n\nnous passons à 14 h.' }));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { messageId: MSG, conversationId: CONV, status: 'sent', providerId: 're_abc' });

  assertEquals(journal.emails.length, 1);
  const mail = journal.emails[0]!;
  assertEquals(mail.to, 'jean.client@example.com');
  assertEquals(mail.subject, 'Votre intervention du 15/09');
  assertEquals(mail.headers?.['Message-ID'], buildMessageId(MSG, DOMAIN));
  assertEquals('In-Reply-To' in (mail.headers ?? {}), false);
  // L'adresse de réponse est celle de CETTE conversation, vérifiable par HMAC.
  assertEquals(await parseReplyAddress(mail.replyTo ?? '', REPLY_SECRET, DOMAIN), CONV);

  assertEquals(journal.sent, [{
    id: MSG, providerId: 're_abc', internetMessageId: buildMessageId(MSG, DOMAIN),
    recipientEmail: 'jean.client@example.com', inReplyTo: null, references: null,
  }]);
  assertEquals(journal.failed, []);
});

Deno.test('une réponse dans un fil porte In-Reply-To, References et « Re: »', async () => {
  const previous = '<abc@example.com>';
  const ours = buildMessageId('00000000-0000-4000-8000-000000000000', DOMAIN);
  const { handler, journal } = setup({ context: { ...CONTEXT, lastInternetMessageId: previous, references: [ours] } });
  await handler(post({ conversationId: CONV, body: 'Parfait.' }));
  const mail = journal.emails[0]!;
  assertEquals(mail.subject, 'Re: Votre intervention du 15/09');
  assertEquals(mail.headers?.['In-Reply-To'], previous);
  assertEquals(mail.headers?.['References'], `${ours} ${previous}`);
});

Deno.test('AC25 — un message du client depuis le portail est enregistré, sans courriel', async () => {
  const { handler, journal } = setup({ direction: 'inbound' });
  const res = await handler(post({ conversationId: CONV, body: 'Merci !' }));
  assertEquals(await res.json(), { messageId: MSG, conversationId: CONV, status: 'received' });
  assertEquals(journal.emails.length, 0);
  assertEquals(journal.sent.length, 0);
});

Deno.test('AC30 — un refus de Resend laisse le message en échec avec le motif', async () => {
  const { handler, journal } = setup({ sendFails: 'Resend 403 : Domain not verified' });
  const res = await handler(post({ conversationId: CONV, body: 'Bonjour' }));
  assertEquals(res.status, 502);
  const body = await res.json();
  assertEquals(body.status, 'failed');
  assertEquals(body.messageId, MSG);
  assertEquals(journal.failed, [{ id: MSG, error: 'Resend 403 : Domain not verified' }]);
  assertEquals(journal.sent, []);
});

Deno.test('AC26 — le refus de la base (RLS, trigger) est renvoyé sans envoi', async () => {
  const { handler, journal } = setup({ insertError: 'Vous ne pouvez pas écrire dans cette conversation.' });
  const res = await handler(post({ conversationId: CONV, body: 'Bonjour' }));
  assertEquals(res.status, 403);
  assertEquals(journal.emails.length, 0);
});

Deno.test('ouvrir une conversation exige un objet ; elle est créée sous les droits de l’appelant', async () => {
  const { handler, journal } = setup();
  const sans = await handler(post({ contactId: CONV, body: 'Bonjour' }));
  assertEquals(sans.status, 400);
  assertEquals(journal.conversations.length, 0);

  const avec = await handler(post({ contactId: CONV, subject: 'Question sur le devis', body: 'Bonjour', quoteId: MSG }));
  assertEquals(avec.status, 200);
  assertEquals(journal.conversations, [{ contactId: CONV, subject: 'Question sur le devis', missionId: null, quoteId: MSG, invoiceId: null }]);
  assertEquals(journal.inserts[0]?.conversationId, CONV);
});

Deno.test('la création refusée par la base n’insère aucun message', async () => {
  const { handler, journal } = setup({ createError: 'new row violates row-level security policy' });
  const res = await handler(post({ contactId: CONV, subject: 'X', body: 'Bonjour' }));
  assertEquals(res.status, 403);
  assertEquals(journal.inserts.length, 0);
});

Deno.test('un corps vide, trop long, ou un identifiant mal formé sont refusés avant toute écriture', async () => {
  const { handler, journal } = setup();
  assertEquals((await handler(post({ conversationId: CONV, body: '   ' }))).status, 400);
  assertEquals((await handler(post({ conversationId: CONV, body: 'x'.repeat(20001) }))).status, 400);
  // Un identifiant invalide est traité comme absent : il faut alors un objet.
  assertEquals((await handler(post({ conversationId: "' or 1=1 --", body: 'x' }))).status, 400);
  assertEquals(journal.inserts.length, 0);
});

Deno.test('sans configuration Resend, la fonction refuse et nomme ce qui manque', async () => {
  const { handler, journal } = setup({ missing: ['RESEND_API_KEY'] });
  const res = await handler(post({ conversationId: CONV, body: 'Bonjour' }));
  assertEquals(res.status, 500);
  assertEquals(((await res.json()) as { error: string }).error.includes('RESEND_API_KEY'), true);
  assertEquals(journal.inserts.length, 0);
});

Deno.test('le courriel échappe le HTML et pointe vers le portail', () => {
  const { html, text } = renderOutboundEmail({
    organizationName: 'Plomberie <Dupont>',
    contactName: 'Jean',
    body: 'Ligne 1 <script>x</script>\n\nLigne 2',
    portalUrl: 'https://rezo360.com/portail',
  });
  assertEquals(html.includes('<script>'), false);
  assertEquals(html.includes('&lt;script&gt;'), true);
  assertEquals(html.includes('Plomberie &lt;Dupont&gt;'), true);
  assertEquals(html.includes('https://rezo360.com/portail'), true);
  assertEquals(text.includes('Ligne 1 <script>x</script>'), true);
});
