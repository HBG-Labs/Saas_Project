import { z } from 'zod';

/**
 * Validation des variables d'environnement au démarrage.
 *
 * Sans ce garde-fou, une variable oubliée se manifeste bien plus tard sous la
 * forme d'un `undefined` opaque au milieu d'un appel réseau. Ici l'application
 * échoue immédiatement, en nommant précisément ce qui manque.
 *
 * Rappel de sécurité : Vite n'injecte dans le bundle que les variables
 * préfixées `VITE_`. Toute clé serveur (service_role) est donc structurellement
 * exclue du frontend.
 */
const envSchema = z.object({
  VITE_SUPABASE_URL: z.url({
    error: 'VITE_SUPABASE_URL doit être une URL valide (https://<ref>.supabase.co)',
  }),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1, 'VITE_SUPABASE_PUBLISHABLE_KEY est requis'),
  VITE_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Exportée uniquement pour les tests : permet de valider un objet arbitraire
 * sans dépendre de `import.meta.env`.
 */
export function parseEnv(source: unknown): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  • ${issue.path.join('.')} : ${issue.message}`)
      .join('\n');

    throw new Error(
      `Configuration d'environnement invalide.\n\n${details}\n\n` +
        'Copiez .env.example vers .env.local puis renseignez les valeurs de votre projet Supabase.',
    );
  }

  return result.data;
}

export const env: Env = parseEnv(import.meta.env);

export const isProduction = env.VITE_APP_ENV === 'production';
export const isDevelopment = env.VITE_APP_ENV === 'development';
