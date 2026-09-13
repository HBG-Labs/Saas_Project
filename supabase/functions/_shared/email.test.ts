import { assertEquals, assertRejects } from 'jsr:@std/assert@1';

import { buildResendPayload, resolveTransport, sendMessage } from './email.ts';

/*
  Ces tests tournent SANS permission, comme dans la CI : ni environnement, ni
  réseau. C'est pour cela que le choix du transport est une fonction pure et
  que la clé voyage dans l'état plutôt que d'être relue à l'envoi.
*/

Deno.test('SMTP l’emporte par défaut quand les deux transports sont configurés', () => {
  const state = resolveTransport({
    smtpHost: 'mail.infomaniak.com', resendKey: 're_x', from: 'noreply@rezo360.fr', fromVariable: 'FROM',
  });
  assertEquals(state.transport, 'smtp');
  assertEquals(state.missing, []);
  assertEquals(state.resendApiKey, undefined);
});

Deno.test('le portail peut exiger Resend même si SMTP est configuré', () => {
  const state = resolveTransport({
    smtpHost: 'mail.infomaniak.com', resendKey: 're_x', from: 'contact@rezo360.fr', fromVariable: 'PORTAL_FROM_EMAIL',
    require: 'resend',
  });
  assertEquals(state.transport, 'resend');
  assertEquals(state.resendApiKey, 're_x');
});

Deno.test('exiger Resend sans clé se déclare non configuré, sans retomber sur SMTP', () => {
  // Retomber sur SMTP enverrait le message par un canal sans identifiant ni
  // retour possible : mieux vaut un refus qui nomme ce qui manque.
  const state = resolveTransport({
    smtpHost: 'mail.infomaniak.com', resendKey: undefined, from: 'contact@rezo360.fr', fromVariable: 'PORTAL_FROM_EMAIL',
    require: 'resend',
  });
  assertEquals(state.transport, null);
  assertEquals(state.missing, ['RESEND_API_KEY']);
});

Deno.test('l’expéditeur absent est nommé', () => {
  const state = resolveTransport({ smtpHost: 'h', resendKey: undefined, from: undefined, fromVariable: 'PORTAL_FROM_EMAIL' });
  assertEquals(state.missing, ['PORTAL_FROM_EMAIL']);
});

Deno.test('la charge utile Resend porte les en-têtes de fil et les pièces jointes', () => {
  const payload = buildResendPayload(
    {
      to: 'client@example.com',
      subject: 'Re: Votre intervention',
      html: '<p>Bonjour</p>',
      text: 'Bonjour',
      replyTo: 'reply+abc.def@inbound.rezo360.fr',
      headers: { 'Message-ID': '<msg-1@inbound.rezo360.fr>', 'In-Reply-To': '<msg-0@inbound.rezo360.fr>' },
      attachments: [{ filename: 'devis.pdf', content: 'JVBERi0=', contentType: 'application/pdf' }],
    },
    'REZO360 <contact@rezo360.fr>',
  );
  assertEquals(payload.reply_to, ['reply+abc.def@inbound.rezo360.fr']);
  assertEquals(payload.headers, { 'Message-ID': '<msg-1@inbound.rezo360.fr>', 'In-Reply-To': '<msg-0@inbound.rezo360.fr>' });
  assertEquals(payload.attachments, [{ filename: 'devis.pdf', content: 'JVBERi0=', content_type: 'application/pdf' }]);
});

Deno.test('sans en-têtes ni pièces jointes, la charge utile n’en déclare pas', () => {
  const payload = buildResendPayload(
    { to: 'a@b.c', subject: 's', html: '<p>x</p>', text: 'x', headers: {}, attachments: [] },
    'noreply@rezo360.fr',
  );
  assertEquals('headers' in payload, false);
  assertEquals('attachments' in payload, false);
  assertEquals('reply_to' in payload, false);
});

Deno.test('l’envoi Resend renvoie l’identifiant attribué', async () => {
  const requetes: Request[] = [];
  const fetchStub: typeof fetch = (input, init) => {
    requetes.push(new Request(input, init));
    return Promise.resolve(new Response(JSON.stringify({ id: 're_123' }), { status: 200 }));
  };
  const result = await sendMessage(
    { to: 'a@b.c', subject: 's', html: '<p>x</p>', text: 'x' },
    { transport: 'resend', from: 'noreply@rezo360.fr', missing: [], resendApiKey: 're_secret' },
    fetchStub,
  );
  assertEquals(result, { transport: 'resend', providerId: 're_123' });
  assertEquals(requetes.length, 1);
  assertEquals(requetes[0].headers.get('Authorization'), 'Bearer re_secret');
});

Deno.test('un refus de Resend fait échouer l’envoi avec le motif', async () => {
  const fetchStub: typeof fetch = () =>
    Promise.resolve(new Response('{"message":"Domain not verified"}', { status: 403 }));
  await assertRejects(
    () => sendMessage(
      { to: 'a@b.c', subject: 's', html: '<p>x</p>', text: 'x' },
      { transport: 'resend', from: 'noreply@rezo360.fr', missing: [], resendApiKey: 're_secret' },
      fetchStub,
    ),
    Error,
    'Resend 403',
  );
});

Deno.test('un transport absent refuse avant tout appel réseau', async () => {
  let appels = 0;
  const fetchStub: typeof fetch = () => { appels += 1; return Promise.resolve(new Response('')); };
  await assertRejects(
    () => sendMessage(
      { to: 'a@b.c', subject: 's', html: '', text: '' },
      { transport: null, from: undefined, missing: ['RESEND_API_KEY'], },
      fetchStub,
    ),
    Error,
    'RESEND_API_KEY',
  );
  assertEquals(appels, 0);
});
