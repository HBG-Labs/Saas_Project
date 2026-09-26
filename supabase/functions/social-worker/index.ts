import { createSocialWorkerHandler } from './handler.ts';
import { MockInstagramPublisher } from '../_shared/social-publisher.ts';

const missing: string[] = [];
if (!Deno.env.get('SUPABASE_URL')) missing.push('SUPABASE_URL');
if (!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) missing.push('SUPABASE_SERVICE_ROLE_KEY');
if (!Deno.env.get('SOCIAL_WORKER_SECRET')) missing.push('SOCIAL_WORKER_SECRET');

const publisherMode = Deno.env.get('SOCIAL_PUBLISHER_MODE') ?? 'dry_run';
if (publisherMode !== 'dry_run') {
  missing.push('SOCIAL_PUBLISHER_MODE=dry_run');
}

const handler = createSocialWorkerHandler({
  url: Deno.env.get('SUPABASE_URL') ?? '',
  serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  secret: Deno.env.get('SOCIAL_WORKER_SECRET') ?? '',
  missing,
  publisher: new MockInstagramPublisher(),
});

Deno.serve(handler);
