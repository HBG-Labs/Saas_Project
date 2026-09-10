import { createSeatSyncWorkerHandler } from './handler.ts';

Deno.serve(
  createSeatSyncWorkerHandler({
    url: Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    secret: Deno.env.get('SUBSCRIPTION_SEAT_SYNC_WORKER_SECRET') ?? '',
  }),
);
