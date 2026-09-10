import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';

import {
  completeSubscriptionSeatSyncJob,
  deferSubscriptionSeatSyncJob,
  synchronizeSubscriptionSeatJob,
  type SubscriptionSeatSyncJob,
} from '../_shared/subscription-seats.ts';
import { workerSecretMatches } from '../_shared/worker-secret.ts';

const BATCH_SIZE = 25;
const BUDGET_MS = 50_000;

export interface SeatSyncWorkerConfig {
  url: string;
  serviceRoleKey: string;
  secret: string;
  fetch?: typeof fetch;
  now?: () => Date;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export function createSeatSyncWorkerHandler(config: SeatSyncWorkerConfig) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

    const providedSecret = request.headers.get('x-worker-secret') ?? '';
    if (!(await workerSecretMatches(providedSecret, config.secret))) {
      return json({ error: 'Accès refusé.' }, 401);
    }

    const clock = config.now ?? (() => new Date());
    const startedAt = clock().getTime();
    const withinBudget = () => clock().getTime() - startedAt < BUDGET_MS;
    const result = { attempted: 0, synchronized: 0, failed: 0 };

    const admin: SupabaseClient = createClient(config.url, config.serviceRoleKey, {
      ...(config.fetch ? { global: { fetch: config.fetch } } : {}),
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await admin.rpc('claim_subscription_seat_sync_jobs', {
      p_limit: BATCH_SIZE,
    });
    if (error) return json({ error: 'File de synchronisation illisible.' }, 503);

    for (const rawJob of data ?? []) {
      if (!withinBudget()) break;
      const job = rawJob as SubscriptionSeatSyncJob;
      result.attempted += 1;

      try {
        await synchronizeSubscriptionSeatJob(admin, job, config.fetch);
        await completeSubscriptionSeatSyncJob(admin, job);
        result.synchronized += 1;
      } catch (failure) {
        result.failed += 1;
        try {
          await deferSubscriptionSeatSyncJob(admin, job, failure, clock());
        } catch (deferFailure) {
          console.error('subscription seat worker: reprise impossible', deferFailure);
        }
      }
    }

    const durationMs = clock().getTime() - startedAt;
    const { error: heartbeatError } = await admin.from('subscription_seat_sync_worker_runs').insert({
      ran_at: clock().toISOString(),
      attempted: result.attempted,
      synchronized: result.synchronized,
      failed: result.failed,
      duration_ms: durationMs,
    });
    if (heartbeatError) {
      console.error('subscription seat worker: battement de cœur impossible', heartbeatError);
    }

    return json({ ...result, durationMs });
  };
}
