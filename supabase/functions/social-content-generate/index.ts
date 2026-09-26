import { createSocialContentGenerateHandler } from '../_shared/social-content-handler.ts';
import { createSocialContentSupabaseStore } from '../_shared/social-content-supabase-store.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const store = createSocialContentSupabaseStore({
  url: supabaseUrl,
  anonKey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
});

Deno.serve(
  createSocialContentGenerateHandler({
    store,
    env: {
      provider: Deno.env.get('SOCIAL_AI_PROVIDER'),
      model: Deno.env.get('SOCIAL_AI_MODEL'),
      openaiApiKey: Deno.env.get('SOCIAL_OPENAI_API_KEY'),
      weeklyGenerationLimit: Deno.env.get('SOCIAL_AI_WEEKLY_GENERATION_LIMIT'),
    },
  }),
);
