import { assertEquals } from 'jsr:@std/assert@1';

import { createSeatSyncWorkerHandler } from './handler.ts';

const ROOT = 'https://project.supabase.co';
const SECRET = 'seat-worker-secret';

function request(secret = SECRET): Request {
  return new Request('https://worker.local', {
    method: 'POST',
    headers: { 'x-worker-secret': secret },
  });
}

Deno.test('le worker de sièges refuse tout secret absent ou incorrect', async () => {
  const handler = createSeatSyncWorkerHandler({
    url: ROOT,
    serviceRoleKey: 'service-role',
    secret: SECRET,
  });

  assertEquals((await handler(request(''))).status, 401);
  assertEquals((await handler(request('incorrect'))).status, 401);
});

Deno.test('un passage sans tâche écrit un battement de cœur', async () => {
  const calls: string[] = [];
  const fakeFetch: typeof fetch = (input, init) => {
    const url = String(input);
    calls.push(`${init?.method ?? 'GET'} ${url}`);

    if (url.includes('/rpc/claim_subscription_seat_sync_jobs')) {
      return Promise.resolve(
        new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );
    }
    if (url.includes('/subscription_seat_sync_worker_runs')) {
      return Promise.resolve(new Response(null, { status: 201 }));
    }
    return Promise.resolve(new Response('{"message":"unexpected"}', { status: 500 }));
  };

  const handler = createSeatSyncWorkerHandler({
    url: ROOT,
    serviceRoleKey: 'service-role',
    secret: SECRET,
    fetch: fakeFetch,
    now: () => new Date('2026-09-09T12:00:00.000Z'),
  });
  const response = await handler(request());

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    attempted: 0,
    synchronized: 0,
    failed: 0,
    durationMs: 0,
  });
  assertEquals(calls.some((call) => call.includes('claim_subscription_seat_sync_jobs')), true);
  assertEquals(calls.some((call) => call.includes('subscription_seat_sync_worker_runs')), true);
});
