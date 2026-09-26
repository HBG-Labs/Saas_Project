import { createInstagramConnectionHandler } from '../_shared/instagram-connection-handler.ts';
import { createInstagramSupabaseStore } from '../_shared/instagram-supabase-store.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const store = createInstagramSupabaseStore({
  url: supabaseUrl,
  anonKey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
});

Deno.serve(
  createInstagramConnectionHandler({
    store,
    env: {
      supabaseUrl,
      appUrl: Deno.env.get('APP_URL') ?? '',
      appId: Deno.env.get('INSTAGRAM_APP_ID') ?? '',
      appSecret: Deno.env.get('INSTAGRAM_APP_SECRET') ?? '',
      encryptionKey: Deno.env.get('INSTAGRAM_TOKEN_ENCRYPTION_KEY') ?? '',
    },
  }),
);
