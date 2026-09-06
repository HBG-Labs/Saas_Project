import { createWorkerHandler } from './handler.ts';

Deno.serve(
  createWorkerHandler({
    url: Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    secret: Deno.env.get('SUPERPDP_WORKER_SECRET') ?? '',
  }),
);
