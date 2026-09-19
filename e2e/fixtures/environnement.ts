/**
 * L'origine Supabase des parcours E2E — et pourquoi elle est fausse.
 *
 * Ce projet n'existe pas. C'est délibéré : aucune requête oubliée ne peut
 * atteindre une base réelle, et aucune exécution ne peut écrire où que ce soit.
 * `playwright.config.ts` l'impose au serveur de développement, `supabase.ts`
 * intercepte tout ce qui part vers elle.
 *
 * La même valeur est déjà posée par la CI (`.github/workflows/quality.yml`).
 */
export const E2E_SUPABASE_URL = 'https://test-project.supabase.co';

/**
 * Port réservé aux parcours. Volontairement à l'écart de la plage 5173-5174 que
 * Vite attribue au développement : un parcours ne doit jamais réutiliser — ni
 * bloquer — le serveur ouvert à côté, qui pointe vers la base réelle.
 */
export const E2E_PORT = 5199;
export const E2E_URL = `http://localhost:${E2E_PORT}`;

/**
 * Clé de session de supabase-js : `sb-<ref>-auth-token`, où `<ref>` est le
 * premier segment de l'hôte. Dérivée plutôt qu'écrite en dur — changer l'URL
 * ci-dessus ne doit pas casser silencieusement l'installation de session.
 */
export const E2E_CLE_SESSION = `sb-${new URL(E2E_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
