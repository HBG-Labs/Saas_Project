import { assertEquals } from 'jsr:@std/assert@1';

import type { ClaimedDelivery } from '../_shared/notification-emails.ts';
import { createNotificationWorkerHandler, type NotificationWorkerConfig } from './handler.ts';

/*
  Aucun réseau ni environnement réel : le client Supabase reçoit un `fetch`
  qui répond depuis la mémoire, `sendEmail` est injectée. Ce qui est vérifié :
  le secret ; le réglage coupé donne « skipped » sans envoi ; un envoi réussi
  donne « sent » avec l'identifiant ; un transport qui lève donne « error » avec
  le motif ; le battement de cœur compte juste.
*/

const ROOT = 'https://project.supabase.co';
const SECRET = 'notification-worker-secret';

function request(secret = SECRET): Request {
  return new Request('https://worker.local', {
    method: 'POST',
    headers: { 'x-worker-secret': secret },
  });
}

function livraison(partial: Partial<ClaimedDelivery>): ClaimedDelivery {
  return {
    id: crypto.randomUUID(),
    organization_id: 'org-1',
    organization_name: 'HBG Labs',
    recipient_user_id: 'u-1',
    recipient_email: 'tech@exemple.fr',
    recipient_name: 'Alice',
    event: 'mission_assigned',
    entity_id: 'm-1',
    payload: { title: 'Raccordement', path: '/missions/m-1' },
    attempts: 0,
    notify_new_mission: true,
    notify_leave_requests: true,
    notify_report_review: true,
    ...partial,
  };
}

function fakeSupabase(claimed: ClaimedDelivery[]) {
  const results: Array<Record<string, unknown>> = [];
  const heartbeats: Array<Record<string, unknown>> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    if (url.includes('/rpc/claim_notification_deliveries')) {
      return new Response(JSON.stringify(claimed), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('/rpc/record_notification_delivery_result')) {
      results.push(body);
      return new Response('null', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('/notification_worker_runs')) {
      heartbeats.push(body);
      return new Response('[]', { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 404 });
  };
  return { fetchImpl, results, heartbeats };
}

function config(partial: Partial<NotificationWorkerConfig>): NotificationWorkerConfig {
  return {
    url: ROOT,
    serviceRoleKey: 'service-role',
    secret: SECRET,
    appUrl: 'https://rezo360.com',
    timeZone: 'America/Martinique',
    sendEmail: () => Promise.resolve({ providerId: 'resend-1' }),
    ...partial,
  };
}

Deno.test('un mauvais secret est refusé avant tout tirage', async () => {
  const fake = fakeSupabase([livraison({})]);
  const handler = createNotificationWorkerHandler(config({ fetch: fake.fetchImpl }));
  const response = await handler(request('faux'));
  assertEquals(response.status, 401);
  assertEquals(fake.results.length, 0);
});

Deno.test(
  'réglage coupé : ignoré sans envoi ; réglage ouvert : envoyé avec l’identifiant',
  async () => {
    const envoyes: string[] = [];
    const fake = fakeSupabase([
      livraison({ id: 'a', notify_new_mission: false }),
      livraison({ id: 'b', event: 'leave_decided', payload: { status: 'approved' } }),
    ]);
    const handler = createNotificationWorkerHandler(
      config({
        fetch: fake.fetchImpl,
        sendEmail: (content, to) => {
          envoyes.push(`${to}:${content.subject}`);
          return Promise.resolve({ providerId: 'resend-42' });
        },
      }),
    );
    const response = await handler(request());
    assertEquals(response.status, 200);
    assertEquals(envoyes, ['tech@exemple.fr:Congé accordé']);
    assertEquals(fake.results[0], {
      p_id: 'a',
      p_outcome: 'skipped',
      p_provider_id: null,
      p_error: null,
    });
    assertEquals(fake.results[1], {
      p_id: 'b',
      p_outcome: 'sent',
      p_provider_id: 'resend-42',
      p_error: null,
    });
    assertEquals(fake.heartbeats[0]?.sent, 1);
    assertEquals(fake.heartbeats[0]?.skipped, 1);
    assertEquals(fake.heartbeats[0]?.failed, 0);
  },
);

Deno.test(
  'un transport qui lève, ou absent, rend « error » avec le motif — la base retentera',
  async () => {
    const fake = fakeSupabase([livraison({ id: 'a' }), livraison({ id: 'b' })]);
    let appels = 0;
    const handler = createNotificationWorkerHandler(
      config({
        fetch: fake.fetchImpl,
        sendEmail: () => {
          appels += 1;
          return appels === 1
            ? Promise.reject(new Error('Resend 503'))
            : Promise.resolve({ providerId: null });
        },
      }),
    );
    await handler(request());
    assertEquals(fake.results[0]?.p_outcome, 'error');
    assertEquals(fake.results[0]?.p_error, 'Resend 503');
    assertEquals(fake.results[1]?.p_outcome, 'sent');

    const sansTransport = fakeSupabase([livraison({ id: 'c' })]);
    await createNotificationWorkerHandler(
      config({ fetch: sansTransport.fetchImpl, sendEmail: null }),
    )(request());
    assertEquals(sansTransport.results[0]?.p_outcome, 'error');
    assertEquals(String(sansTransport.results[0]?.p_error).includes('pas configuré'), true);
  },
);
