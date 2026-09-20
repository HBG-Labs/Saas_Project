import { defineConfig, devices } from '@playwright/test';

import { E2E_PORT, E2E_SUPABASE_URL, E2E_URL } from './e2e/fixtures/environnement';

/**
 * Configuration Playwright E2E pour REZO360.
 *
 * Exécution :
 * - `npm run test:e2e` (mode headless)
 * - `npm run test:e2e:ui` (mode interactif avec Playwright UI)
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  expect: {
    /*
      Le premier chargement d'une route lazy inclut la compilation Vite à
      froid. Sur les écrans authentifiés, qui tirent beaucoup plus de modules
      que la vitrine, 15 s ne suffisaient pas : deux parcours d'intervention
      échouaient à 27 s pendant que les mêmes assertions passaient en 4 s une
      fois le serveur chaud — un faux rouge, aussi trompeur qu'un faux vert.

      Piste si cela redevient gênant : servir un build de production plutôt que
      le serveur de développement. Le build prend ~7 s et supprime toute
      compilation à la demande.
    */
    timeout: 25_000,
  },

  use: {
    baseURL: E2E_URL,
    trace: 'on-first-retry',
    /*
      Le service worker de la PWA (`public/sw.js`) réémet les requêtes depuis
      son propre contexte : elles échappent alors à `page.route`, partent pour
      de bon et échouent en `ERR_FAILED`. Symptôme observé : des parcours verts
      ou rouges selon que le worker était déjà actif ou non.

      Il est donc neutralisé ici. Le comportement hors connexion mérite ses
      propres tests, avec le worker activé explicitement — pas d'être subi par
      tous les autres.
    */
    serviceWorkers: 'block',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],

  webServer: {
    /*
      UN BUILD, PAS LE SERVEUR DE DÉVELOPPEMENT.

      Vite compile chaque route à la première visite. Sur les écrans
      authentifiés, qui tirent beaucoup de modules, cela dépassait 25 s — les
      mêmes assertions passant ensuite en 2 s. Étirer les délais n'aurait fait
      que masquer le problème et ralentir chaque échec réel.

      Le build prend une dizaine de secondes UNE fois, puis tous les parcours
      sont rapides et déterministes. Bonus : ils s'exécutent sur le bundle
      réellement livré, pas sur une variante de développement.

      `dist-e2e` plutôt que `dist` : les variables `VITE_*` sont figées à la
      compilation, et un build portant une origine Supabase factice ne doit
      jamais pouvoir être déployé par erreur.

      Port dédié, distinct de la plage 5173-5174 du développement courant.
    */
    command: `npm run build -- --outDir dist-e2e && npx vite preview --outDir dist-e2e --port ${E2E_PORT} --strictPort`,
    url: E2E_URL,
    /*
      JAMAIS le serveur de développement déjà ouvert.

      En local, `npm run dev` lit `.env.local`, qui pointe vers la BASE RÉELLE.
      Réutiliser ce serveur ferait tourner les parcours contre la production :
      les interceptions ne correspondraient à rien, la session de test serait
      rangée sous une autre clé, et surtout une requête non interceptée
      partirait pour de bon. Playwright démarre donc son propre serveur, avec
      l'environnement ci-dessous.
    */
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      // Origine factice : aucune route de `e2e/fixtures/supabase.ts` ne peut
      // atteindre un projet réel, et une requête oubliée échoue au DNS plutôt
      // que d'écrire quelque part. C'est la même valeur qu'en CI.
      VITE_SUPABASE_URL: E2E_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_e2e_only',
    },
  },
});
