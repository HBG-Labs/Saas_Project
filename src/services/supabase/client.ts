import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env } from '@/config/env';
import type { Database } from '@/types/database';

/**
 * Client Supabase — instance unique de l'application.
 *
 * C'est le SEUL endroit où le client est construit. La règle ESLint
 * `no-restricted-imports` interdit d'importer ce module (ou
 * `@supabase/supabase-js`) ailleurs que dans `src/services/**` et dans les
 * dossiers `api/` des features : Supabase ne doit jamais atteindre les
 * composants ni les pages.
 *
 * La clé utilisée est publique par conception ; la sécurité repose entièrement
 * sur les politiques RLS définies dans `supabase/migrations/`.
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  },
);
