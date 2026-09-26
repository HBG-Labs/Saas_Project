import { createClient } from 'npm:@supabase/supabase-js@2.112.2';

import {
  createMetaInstagramPublisherStore,
  createSocialWorkerStore,
} from '../_shared/social-worker-store.ts';
import { createSocialWorkerHandler } from './handler.ts';
import { MetaInstagramPublisher, MockInstagramPublisher } from '../_shared/social-publisher.ts';

const missing: string[] = [];
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
if (!supabaseUrl) missing.push('SUPABASE_URL');
if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
if (!Deno.env.get('SOCIAL_WORKER_SECRET')) missing.push('SOCIAL_WORKER_SECRET');

const publisherMode = Deno.env.get('SOCIAL_PUBLISHER_MODE') ?? 'dry_run';
const allowLivePublishing = Deno.env.get('SOCIAL_WORKER_ENABLE_LIVE') === 'true';
if (!['dry_run', 'live'].includes(publisherMode)) {
  missing.push('SOCIAL_PUBLISHER_MODE=dry_run|live');
}
if (publisherMode === 'live' && !allowLivePublishing) {
  missing.push('SOCIAL_WORKER_ENABLE_LIVE=true');
}

const encryptionKey = Deno.env.get('INSTAGRAM_TOKEN_ENCRYPTION_KEY') ?? '';
if (publisherMode === 'live' && !encryptionKey) {
  missing.push('INSTAGRAM_TOKEN_ENCRYPTION_KEY');
}

const admin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

const publisher =
  publisherMode === 'live'
    ? new MetaInstagramPublisher({
        store: admin
          ? createMetaInstagramPublisherStore({ admin, encryptionKey })
          : {
              loadCredential: () => Promise.resolve(null),
              createSignedAssetUrl: () => Promise.reject(new Error('Supabase non configuré.')),
              markContainer: () => Promise.reject(new Error('Supabase non configuré.')),
            },
        signedUrlTtlSeconds: Number(Deno.env.get('SOCIAL_MEDIA_SIGNED_URL_TTL_SECONDS') ?? 3600),
        pollAttempts: Number(Deno.env.get('SOCIAL_META_CONTAINER_POLL_ATTEMPTS') ?? 6),
        pollDelayMs: Number(Deno.env.get('SOCIAL_META_CONTAINER_POLL_DELAY_MS') ?? 1500),
        requestTimeoutMs: Number(Deno.env.get('SOCIAL_META_REQUEST_TIMEOUT_MS') ?? 15000),
        publishTimeoutMs: Number(Deno.env.get('SOCIAL_META_PUBLISH_TIMEOUT_MS') ?? 20000),
      })
    : new MockInstagramPublisher();

const handler = createSocialWorkerHandler({
  url: supabaseUrl,
  serviceRoleKey,
  secret: Deno.env.get('SOCIAL_WORKER_SECRET') ?? '',
  missing,
  publisher,
  allowLivePublishing,
  stores: admin ? { social: createSocialWorkerStore(admin) } : undefined,
});

Deno.serve(handler);
