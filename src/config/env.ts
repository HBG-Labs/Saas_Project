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
const envSchema = z
  .object({
    VITE_SUPABASE_URL: z.url({
      error: 'VITE_SUPABASE_URL doit être une URL valide (https://<ref>.supabase.co)',
    }),
    VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1, 'VITE_SUPABASE_PUBLISHABLE_KEY est requis'),
    VITE_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
    /**
     * Adresse canonique de l'application. Elle peut être omise en local, mais
     * elle est obligatoire en production afin que les retours OAuth, Stripe et
     * les liens envoyés par courriel ciblent toujours `app.rezo360.com`.
     */
    VITE_PUBLIC_APP_URL: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
      z.url().optional(),
    ),
    /** Identifiant du déploiement affiché dans les journaux d'erreurs. */
    VITE_APP_VERSION: z.string().min(1).max(120).optional(),
    /**
     * Identifiant du pixel Meta. FACULTATIF, et c'est essentiel : sans lui,
     * `src/lib/meta-pixel.ts` est entièrement inerte. Le développement, les
     * tests et les prévisualisations n'ont donc rien à configurer, et ne
     * risquent pas d'envoyer des événements dans les statistiques réelles.
     *
     * La chaîne vide vaut absence : un hébergeur qui déclare la variable sans
     * la remplir ne doit pas faire échouer le démarrage de l'application.
     *
     * Le format est vérifié parce que l'erreur classique est de coller ici
     * autre chose que l'identifiant — l'URL du gestionnaire d'événements, ou un
     * jeton d'accès. Un identifiant Meta est purement numérique.
     */
    VITE_META_PIXEL_ID: z.preprocess(
      (valeur) => (typeof valeur === 'string' && valeur.trim() === '' ? undefined : valeur),
      z
        .string()
        .trim()
        .regex(
          /^\d{10,20}$/,
          'VITE_META_PIXEL_ID doit être l’identifiant numérique du pixel (10 à 20 chiffres), ' +
            'et non une URL ni un jeton d’accès',
        )
        .optional(),
    ),
  })
  .superRefine((value, context) => {
    if (value.VITE_APP_ENV === 'production' && !value.VITE_PUBLIC_APP_URL) {
      context.addIssue({
        code: 'custom',
        path: ['VITE_PUBLIC_APP_URL'],
        message: 'VITE_PUBLIC_APP_URL est requis en production (ex. https://app.rezo360.com)',
      });
    }

    if (
      value.VITE_APP_ENV === 'production' &&
      value.VITE_PUBLIC_APP_URL &&
      new URL(value.VITE_PUBLIC_APP_URL).protocol !== 'https:'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['VITE_PUBLIC_APP_URL'],
        message: 'VITE_PUBLIC_APP_URL doit utiliser HTTPS en production',
      });
    }
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

    /*
      Le conseil dépend de qui lit.

      « Copiez .env.example vers .env.local » n'a aucun sens pour quelqu'un qui
      ouvre un site déployé : il n'a pas de dépôt. Et le rappel qui compte en
      production ne compte pas en local — Vite fige ces valeurs À LA
      COMPILATION, si bien qu'ajouter les variables chez l'hébergeur ne change
      rien tant qu'on n'a pas reconstruit. C'est la cause la plus fréquente
      d'un « je les ai pourtant renseignées ».
    */
    const remedy = import.meta.env.DEV
      ? 'Copiez .env.example vers .env.local puis renseignez les valeurs de votre projet Supabase.'
      : "Renseignez ces variables chez l'hébergeur, puis RELANCEZ UN DÉPLOIEMENT : " +
        'leurs valeurs sont figées au moment de la compilation, les modifier ne suffit pas.';

    throw new Error(`Configuration d'environnement invalide.\n\n${details}\n\n${remedy}`);
  }

  return result.data;
}

export const env: Env = parseEnv(import.meta.env);

export const isProduction = env.VITE_APP_ENV === 'production';
export const isDevelopment = env.VITE_APP_ENV === 'development';
