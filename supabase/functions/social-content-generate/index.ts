import { createSocialContentGenerateHandler } from '../_shared/social-content-handler.ts';
import { createSocialContentSupabaseStore } from '../_shared/social-content-supabase-store.ts';
import { createConfiguredSocialImageProvider } from '../_shared/social-image-provider.ts';
import { generateSocialImagesForWeek } from '../_shared/social-image-handler.ts';
import { createSocialImageSupabaseStore } from '../_shared/social-image-supabase-store.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const store = createSocialContentSupabaseStore({
  url: supabaseUrl,
  anonKey,
  serviceRoleKey,
});
const imageStore = createSocialImageSupabaseStore({
  url: supabaseUrl,
  anonKey,
  serviceRoleKey,
});
const imageEnv = {
  provider: Deno.env.get('SOCIAL_IMAGE_PROVIDER'),
  model: Deno.env.get('SOCIAL_IMAGE_MODEL'),
  allowMock: Deno.env.get('SOCIAL_IMAGE_ALLOW_MOCK'),
  openaiApiKey: Deno.env.get('SOCIAL_OPENAI_IMAGE_API_KEY'),
  quality: Deno.env.get('SOCIAL_IMAGE_QUALITY'),
  weeklyGenerationLimit: Deno.env.get('SOCIAL_IMAGE_WEEKLY_GENERATION_LIMIT'),
  maxConcurrency: Deno.env.get('SOCIAL_IMAGE_MAX_CONCURRENCY'),
  maxRetries: Deno.env.get('SOCIAL_IMAGE_MAX_RETRIES'),
};
const imageProvider = (() => {
  try {
    return createConfiguredSocialImageProvider(imageEnv);
  } catch (error) {
    console.error('social image provider configuration failed', error instanceof Error ? error.name : 'unknown');
    return null;
  }
})();

const visualGenerator = imageProvider
  ? {
      generate: (input: { organizationId: string; weekId: string; userId: string }) =>
        generateSocialImagesForWeek({
          store: imageStore,
          provider: imageProvider,
          env: imageEnv,
          organizationId: input.organizationId,
          weekId: input.weekId,
          userId: input.userId,
          now: () => new Date(),
          randomId: () => crypto.randomUUID(),
        }),
    }
  : undefined;

Deno.serve(
  createSocialContentGenerateHandler({
    store,
    visualGenerator,
    env: {
      provider: Deno.env.get('SOCIAL_AI_PROVIDER'),
      model: Deno.env.get('SOCIAL_AI_MODEL'),
      openaiApiKey: Deno.env.get('SOCIAL_OPENAI_API_KEY'),
      weeklyGenerationLimit: Deno.env.get('SOCIAL_AI_WEEKLY_GENERATION_LIMIT'),
    },
  }),
);
