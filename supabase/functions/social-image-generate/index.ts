import { createSocialImageGenerateHandler } from '../_shared/social-image-handler.ts';
import { createSocialImageSupabaseStore } from '../_shared/social-image-supabase-store.ts';

const store = createSocialImageSupabaseStore({
  url: Deno.env.get('SUPABASE_URL') ?? '',
  anonKey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
});

const handler = createSocialImageGenerateHandler({
  store,
  env: {
    provider: Deno.env.get('SOCIAL_IMAGE_PROVIDER'),
    model: Deno.env.get('SOCIAL_IMAGE_MODEL'),
    allowMock: Deno.env.get('SOCIAL_IMAGE_ALLOW_MOCK'),
    openaiApiKey: Deno.env.get('SOCIAL_OPENAI_IMAGE_API_KEY'),
    quality: Deno.env.get('SOCIAL_IMAGE_QUALITY'),
    weeklyGenerationLimit: Deno.env.get('SOCIAL_IMAGE_WEEKLY_GENERATION_LIMIT'),
    maxConcurrency: Deno.env.get('SOCIAL_IMAGE_MAX_CONCURRENCY'),
    maxRetries: Deno.env.get('SOCIAL_IMAGE_MAX_RETRIES'),
  },
});

Deno.serve(handler);
