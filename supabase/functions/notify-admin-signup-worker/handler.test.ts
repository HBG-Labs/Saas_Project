import { assertEquals, assertExists } from 'jsr:@std/assert@1';

import { createSignupAlertWorkerHandler, type SignupAlertWorkerConfig } from './handler.ts';

/*
  Comme `subscription-seat-sync-worker/handler.test.ts` : aucun réseau ni
  environnement réel. Le client Supabase reçoit un `fetch` qui répond depuis
  des tableaux en mémoire, et `sendEmail`/`sendPush` sont des fonctions
  injectées — jamais le `fetch` global.
*/

const ROOT = 'https://project.supabase.co';
const SECRET = 'signup-worker-secret';

function request(secret = SECRET): Request {
  return new Request('https://worker.local', { method: 'POST', headers: { 'x-worker-secret': secret } });
}

interface Alert {
  user_id: string;
  email: string;
  signed_up_at: string;
  attempts: number;
  email_status: 'pending' | 'sent' | 'skipped';
  push_status: 'pending' | 'sent' | 'skipped';
}

/**
 * Un client Supabase factice minimal : répond au RPC de tirage, aux lectures
 * d'enrichissement (aucune ligne trouvée nulle part — un profil sans
 * entreprise, le cas le plus courant), aux mises à jour de la ligne d'alerte
 * et à l'insertion du battement de cœur.
 */
function fakeSupabase(claimed: Alert[]) {
  const calls: string[] = [];
  const updates: Array<Record<string, unknown>> = [];
  const heartbeats: Array<Record<string, unknown>> = [];

  const fetchImpl: typeof fetch = (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${url}`);

    if (url.includes('/rpc/claim_admin_signup_alerts')) {
      return Promise.resolve(
        new Response(JSON.stringify(claimed), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );
    }
    // Enrichissement : profil, appartenance, organisation, abonnement — aucune
    // ligne nulle part, ce qui est le cas normal juste après l'inscription.
    if (
      url.includes('/profiles') ||
      url.includes('/organization_members') ||
      url.includes('/organizations') ||
      url.includes('/industries') ||
      url.includes('/subscriptions') ||
      url.includes('/plans')
    ) {
      return Promise.resolve(new Response('null', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    if (url.includes('/admin_signup_alerts') && method === 'PATCH') {
      updates.push(init?.body ? JSON.parse(String(init.body)) : {});
      return Promise.resolve(new Response('[{}]', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    if (url.includes('/admin_signup_alert_worker_runs')) {
      heartbeats.push(init?.body ? JSON.parse(String(init.body)) : {});
      return Promise.resolve(new Response(null, { status: 201 }));
    }
    return Promise.resolve(new Response('{"message":"unexpected"}', { status: 500 }));
  };

  return { fetchImpl, calls, updates, heartbeats };
}

function baseConfig(overrides: Partial<SignupAlertWorkerConfig> = {}): Omit<SignupAlertWorkerConfig, 'fetch'> & {
  fetch?: typeof fetch;
} {
  return {
    url: ROOT,
    serviceRoleKey: 'service-role',
    secret: SECRET,
    adminEmail: 'harry@rezo360.fr',
    appUrl: 'https://app.rezo360.com',
    sendEmail: async () => ({ providerId: 'resend-1' }),
    formatSignedUpAt: (iso) => `le ${iso}`,
    oneSignalAppId: 'app-1',
    oneSignalExternalUserId: 'harry',
    sendPush: async () => undefined,
    now: () => new Date('2026-09-15T10:00:00.000Z'),
    ...overrides,
  };
}

function alert(overrides: Partial<Alert> = {}): Alert {
  return {
    user_id: 'user-1',
    email: 'nouveau@example.com',
    signed_up_at: '2026-09-15T09:59:00.000Z',
    attempts: 0,
    email_status: 'pending',
    push_status: 'pending',
    ...overrides,
  };
}

// -------------------------------------------------------------- 1. sécurité

Deno.test('le worker refuse tout secret absent ou incorrect', async () => {
  const { fetchImpl } = fakeSupabase([]);
  const handler = createSignupAlertWorkerHandler(baseConfig({ fetch: fetchImpl }));

  assertEquals((await handler(request(''))).status, 401);
  assertEquals((await handler(request('incorrect'))).status, 401);
});

Deno.test('le worker refuse toute méthode autre que POST', async () => {
  const { fetchImpl } = fakeSupabase([]);
  const handler = createSignupAlertWorkerHandler(baseConfig({ fetch: fetchImpl }));
  const response = await handler(new Request('https://worker.local', { method: 'GET' }));
  assertEquals(response.status, 405);
});

// ------------------------------------------------- 2. une inscription → 1+1

Deno.test('une inscription en attente déclenche exactement un e-mail et un push', async () => {
  const emailCalls: unknown[] = [];
  const pushCalls: unknown[] = [];
  const { fetchImpl, updates, heartbeats } = fakeSupabase([alert()]);

  const handler = createSignupAlertWorkerHandler(
    baseConfig({
      fetch: fetchImpl,
      sendEmail: async (content, to) => {
        emailCalls.push({ to, subject: content.subject });
        return { providerId: 'resend-1' };
      },
      sendPush: async (payload) => {
        pushCalls.push(payload);
      },
    }),
  );

  const response = await handler(request());
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(emailCalls.length, 1);
  assertEquals(pushCalls.length, 1);
  assertEquals(body.attempted, 1);
  assertEquals(body.sent, 1);
  assertEquals(body.failed, 0);
  assertEquals(updates.length, 1);
  assertEquals(updates[0]?.email_status, 'sent');
  assertEquals(updates[0]?.push_status, 'sent');
  assertEquals(heartbeats.length, 1);
  assertEquals(heartbeats[0]?.attempted, 1);
});

// ---------------------------------------------- 8. deuxième nouvel utilisateur

Deno.test('deux inscriptions dans le même passage produisent deux alertes indépendantes', async () => {
  const emailCalls: string[] = [];
  const { fetchImpl } = fakeSupabase([
    alert({ user_id: 'user-1', email: 'premier@example.com' }),
    alert({ user_id: 'user-2', email: 'second@example.com' }),
  ]);

  const handler = createSignupAlertWorkerHandler(
    baseConfig({
      fetch: fetchImpl,
      sendEmail: async (_content, to) => {
        emailCalls.push(to);
        return { providerId: null };
      },
    }),
  );

  const body = await (await handler(request())).json();

  assertEquals(body.attempted, 2);
  assertEquals(body.sent, 2);
  // L'admin est TOUJOURS le destinataire (les deux lignes concernent des
  // inscrits différents, mais l'alerte, elle, part au même endroit).
  assertEquals(emailCalls, ['harry@rezo360.fr', 'harry@rezo360.fr']);
});

// --------------------------- 6/7. panne fournisseur : l'autre canal continue

Deno.test('le fournisseur e-mail tombe en panne : le push part quand même, rien ne lève', async () => {
  const pushCalls: unknown[] = [];
  const { fetchImpl, updates } = fakeSupabase([alert()]);

  const handler = createSignupAlertWorkerHandler(
    baseConfig({
      fetch: fetchImpl,
      sendEmail: async () => {
        throw new Error('Resend 503 : service indisponible');
      },
      sendPush: async (payload) => {
        pushCalls.push(payload);
      },
    }),
  );

  const response = await handler(request());
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(pushCalls.length, 1);
  assertEquals(body.failed, 1);
  assertEquals(updates[0]?.push_status, 'sent');
  assertEquals('email_status' in updates[0], false);
});

Deno.test('le fournisseur push tombe en panne : l’e-mail part quand même, rien ne lève', async () => {
  const emailCalls: unknown[] = [];
  const { fetchImpl, updates } = fakeSupabase([alert()]);

  const handler = createSignupAlertWorkerHandler(
    baseConfig({
      fetch: fetchImpl,
      sendEmail: async () => {
        emailCalls.push(true);
        return { providerId: 'resend-1' };
      },
      sendPush: async () => {
        throw new Error('OneSignal 500 : erreur interne');
      },
    }),
  );

  const response = await handler(request());
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(emailCalls.length, 1);
  assertEquals(body.failed, 1);
  assertEquals(updates[0]?.email_status, 'sent');
  assertEquals('push_status' in updates[0], false);
});

// --------------------------------------------- 9. pas de double envoi en reprise

Deno.test('une reprise ne renvoie jamais un canal déjà marqué « sent »', async () => {
  const emailCalls: unknown[] = [];
  const pushCalls: unknown[] = [];
  // Simule un deuxième passage du worker après un premier essai partiel :
  // `claim_admin_signup_alerts` ne renvoie ce type de ligne QUE si un canal
  // reste `pending` (voir la migration) — ici, l'e-mail est déjà acquis.
  const { fetchImpl, updates } = fakeSupabase([alert({ email_status: 'sent', push_status: 'pending', attempts: 1 })]);

  const handler = createSignupAlertWorkerHandler(
    baseConfig({
      fetch: fetchImpl,
      sendEmail: async () => {
        emailCalls.push(true);
        return { providerId: 'resend-1' };
      },
      sendPush: async (payload) => {
        pushCalls.push(payload);
      },
    }),
  );

  await handler(request());

  assertEquals(emailCalls.length, 0, 'l’e-mail déjà envoyé ne doit jamais repartir');
  assertEquals(pushCalls.length, 1);
  assertEquals('email_status' in updates[0], false);
  assertEquals(updates[0]?.push_status, 'sent');
});

// --------------------------------------------------- 10. rien de sensible ne fuite

Deno.test('la réponse HTTP ne contient ni adresse, ni contenu, ni détail d’erreur', async () => {
  const { fetchImpl } = fakeSupabase([alert()]);
  const handler = createSignupAlertWorkerHandler(
    baseConfig({
      fetch: fetchImpl,
      sendEmail: async () => {
        throw new Error('Resend 401 : clé re_SECRET_XYZ invalide');
      },
    }),
  );

  const response = await handler(request());
  const raw = await response.text();

  assertEquals(raw.includes('re_SECRET_XYZ'), false);
  assertEquals(raw.includes('nouveau@example.com'), false);
  assertEquals(raw.includes(SECRET), false);
  assertEquals(Object.keys(JSON.parse(raw)).sort(), ['attempted', 'durationMs', 'failed', 'sent']);
});

// --------------------------------------------------- configuration absente

Deno.test('canaux non configurés : le worker termine proprement, sans lever', async () => {
  const { fetchImpl, updates } = fakeSupabase([alert()]);
  const handler = createSignupAlertWorkerHandler(
    baseConfig({ fetch: fetchImpl, sendEmail: null, sendPush: null, adminEmail: undefined }),
  );

  const response = await handler(request());
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.failed, 1);
  assertExists(updates[0]?.last_error);
});

// --------------------------------------------------------- aucune tâche

Deno.test('un passage sans alerte en attente écrit tout de même un battement de cœur', async () => {
  const { fetchImpl, heartbeats } = fakeSupabase([]);
  const handler = createSignupAlertWorkerHandler(baseConfig({ fetch: fetchImpl }));

  const body = await (await handler(request())).json();

  assertEquals(body, { attempted: 0, sent: 0, failed: 0, durationMs: 0 });
  assertEquals(heartbeats.length, 1);
});
