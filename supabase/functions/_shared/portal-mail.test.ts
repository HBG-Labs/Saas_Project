import { assertEquals, assertRejects } from 'jsr:@std/assert@1';

import {
  buildMessageId,
  buildReplyAddress,
  constantTimeEqual,
  extractReplyText,
  normalizeEmail,
  parseMessageId,
  parseReferences,
  parseReplyAddress,
  resolveInbound,
  verifySvixSignature,
} from './portal-mail.ts';

const SECRET = 'secret-de-test-tres-long';
const DOMAIN = 'inbound.rezo360.fr';
const CONV = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

Deno.test('l’adresse de réponse est déterministe et se relit', async () => {
  const address = await buildReplyAddress(CONV, SECRET, DOMAIN);
  assertEquals(address.startsWith('reply+a1b2c3d4e5f64a7b8c9d0e1f2a3b4c5d.'), true);
  assertEquals(address.endsWith('@inbound.rezo360.fr'), true);
  assertEquals(await parseReplyAddress(address, SECRET, DOMAIN), CONV);
  assertEquals(await buildReplyAddress(CONV, SECRET, DOMAIN), address);
});

Deno.test('un HMAC altéré, un autre secret ou un autre domaine ne rattachent rien', async () => {
  const address = await buildReplyAddress(CONV, SECRET, DOMAIN);
  const forged = address.replace(/\.([0-9a-f]{16})@/, (_m, tag: string) =>
    `.${tag.slice(0, 15)}${tag.endsWith('0') ? '1' : '0'}@`);
  assertEquals(await parseReplyAddress(forged, SECRET, DOMAIN), null);
  assertEquals(await parseReplyAddress(address, 'autre-secret', DOMAIN), null);
  assertEquals(await parseReplyAddress(address, SECRET, 'inbound.autre.fr'), null);
  assertEquals(await parseReplyAddress('reply+abc@inbound.rezo360.fr', SECRET, DOMAIN), null);
  assertEquals(await parseReplyAddress('contact@rezo360.fr', SECRET, DOMAIN), null);
});

Deno.test('l’UUID seul, sans HMAC valide, n’est jamais une autorisation', async () => {
  // Un attaquant qui connaît l'identifiant de conversation ne peut pas
  // fabriquer l'adresse : il lui manque le secret.
  const compact = CONV.replaceAll('-', '');
  assertEquals(await parseReplyAddress(`reply+${compact}.0000000000000000@${DOMAIN}`, SECRET, DOMAIN), null);
});

Deno.test('un identifiant de conversation invalide est refusé à la construction', async () => {
  await assertRejects(() => buildReplyAddress('pas-un-uuid', SECRET, DOMAIN), Error);
});

Deno.test('Message-ID : émission et relecture, domaine étranger ignoré', () => {
  const id = buildMessageId(CONV, DOMAIN);
  assertEquals(id, `<msg-${CONV}@inbound.rezo360.fr>`);
  assertEquals(parseMessageId(id, DOMAIN), CONV);
  assertEquals(parseMessageId(`<msg-${CONV}@autre.fr>`, DOMAIN), null);
  assertEquals(parseMessageId('<abc@gmail.com>', DOMAIN), null);
  assertEquals(parseMessageId(null, DOMAIN), null);
});

Deno.test('References : seuls nos identifiants sont retenus, dans l’ordre', () => {
  const refs = `<x@gmail.com> ${buildMessageId(CONV, DOMAIN)} <y@outlook.com> <msg-00000000-0000-4000-8000-000000000001@${DOMAIN}>`;
  assertEquals(parseReferences(refs, DOMAIN), [CONV, '00000000-0000-4000-8000-000000000001']);
  assertEquals(parseReferences(undefined, DOMAIN), []);
});

Deno.test('le rattachement suit l’ordre : adresse, puis In-Reply-To, puis References', async () => {
  const address = await buildReplyAddress(CONV, SECRET, DOMAIN);
  assertEquals(
    await resolveInbound({ to: ['contact@rezo360.fr', address], inReplyTo: '<x@gmail.com>' }, SECRET, DOMAIN),
    { kind: 'conversation', conversationId: CONV, via: 'reply_address' },
  );
  assertEquals(
    await resolveInbound({ to: ['contact@rezo360.fr'], inReplyTo: buildMessageId(CONV, DOMAIN) }, SECRET, DOMAIN),
    { kind: 'message', messageId: CONV, via: 'in_reply_to' },
  );
  assertEquals(
    await resolveInbound({ to: ['contact@rezo360.fr'], references: `<a@b.c> ${buildMessageId(CONV, DOMAIN)}` }, SECRET, DOMAIN),
    { kind: 'message', messageId: CONV, via: 'references' },
  );
});

Deno.test('AC29 — sans indice sûr, l’entrant est non rattaché, jamais deviné', async () => {
  assertEquals(
    await resolveInbound({ to: ['contact@rezo360.fr'], inReplyTo: '<x@gmail.com>', references: '<y@z.fr>' }, SECRET, DOMAIN),
    { kind: 'unmatched' },
  );
});

// --------------------------------------------------------------- Svix

async function sign(id: string, ts: string, body: string, secretB64: string): Promise<string> {
  const key = Uint8Array.from(atob(secretB64), (c) => c.charCodeAt(0));
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${id}.${ts}.${body}`));
  let bin = ''; for (const b of new Uint8Array(mac)) bin += String.fromCharCode(b);
  return `v1,${btoa(bin)}`;
}

const SECRET_B64 = btoa('cle-webhook-de-test-32-octets!!!');
const WHSEC = `whsec_${SECRET_B64}`;

Deno.test('AC26 — une signature Svix valide est acceptée', async () => {
  const now = 1_800_000_000;
  const body = '{"type":"email.delivered"}';
  const signature = await sign('msg_1', String(now), body, SECRET_B64);
  assertEquals(
    await verifySvixSignature({ id: 'msg_1', timestamp: String(now), signature }, body, WHSEC, now),
    true,
  );
});

Deno.test('AC27 — signature absente, fausse, ou corps modifié : rejet', async () => {
  const now = 1_800_000_000;
  const body = '{"type":"email.delivered"}';
  const signature = await sign('msg_1', String(now), body, SECRET_B64);
  assertEquals(await verifySvixSignature({ id: 'msg_1', timestamp: String(now), signature: null }, body, WHSEC, now), false);
  assertEquals(await verifySvixSignature({ id: 'msg_1', timestamp: String(now), signature: 'v1,AAAA' }, body, WHSEC, now), false);
  assertEquals(await verifySvixSignature({ id: 'msg_1', timestamp: String(now), signature }, body + ' ', WHSEC, now), false);
  assertEquals(await verifySvixSignature({ id: 'msg_2', timestamp: String(now), signature }, body, WHSEC, now), false);
  assertEquals(await verifySvixSignature({ id: 'msg_1', timestamp: String(now), signature }, body, 'whsec_autre', now), false);
});

Deno.test('AC27 — un horodatage trop ancien est rejeté même bien signé', async () => {
  const then = 1_800_000_000;
  const body = '{}';
  const signature = await sign('msg_1', String(then), body, SECRET_B64);
  assertEquals(await verifySvixSignature({ id: 'msg_1', timestamp: String(then), signature }, body, WHSEC, then + 301), false);
  assertEquals(await verifySvixSignature({ id: 'msg_1', timestamp: String(then), signature }, body, WHSEC, then + 299), true);
});

Deno.test('plusieurs signatures (rotation) : une seule doit correspondre', async () => {
  const now = 1_800_000_000;
  const body = '{}';
  const good = await sign('msg_1', String(now), body, SECRET_B64);
  assertEquals(
    await verifySvixSignature({ id: 'msg_1', timestamp: String(now), signature: `v1,ZZZZ ${good}` }, body, WHSEC, now),
    true,
  );
});

// ----------------------------------------------------------- nettoyage

Deno.test('la réponse est gardée, la citation retirée', () => {
  const brut = 'Merci, 14 h me convient.\n\nBonne journée.\n\nLe 12 sept. 2026 à 10:24, REZO360 <contact@rezo360.fr> a écrit :\n> Bonjour,\n> Votre intervention est confirmée.\n';
  assertEquals(extractReplyText(brut), 'Merci, 14 h me convient.\n\nBonne journée.');
  assertEquals(extractReplyText('Oui\r\n\r\nOn Sep 12, 2026, X wrote:\r\n> hello'), 'Oui');
  assertEquals(extractReplyText('> tout cité\n> rien de neuf'), '');
});

Deno.test('normalisation d’adresse et comparaison en temps constant', () => {
  assertEquals(normalizeEmail('Jean Client <Jean.Client@Example.COM>'), 'jean.client@example.com');
  assertEquals(normalizeEmail('  x@y.z '), 'x@y.z');
  assertEquals(constantTimeEqual('abc', 'abc'), true);
  assertEquals(constantTimeEqual('abc', 'abd'), false);
  assertEquals(constantTimeEqual('abc', 'ab'), false);
});
