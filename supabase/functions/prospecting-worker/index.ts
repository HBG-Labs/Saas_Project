import { createRechercheEntreprisesProvider } from '../_shared/prospecting-provider.ts';
import { createProspectingWorkerHandler } from './handler.ts';

Deno.serve(
  createProspectingWorkerHandler({
    url: Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    secret: Deno.env.get('PROSPECTING_WORKER_SECRET') ?? '',
    provider: createRechercheEntreprisesProvider(),
  }),
);
