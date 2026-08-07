import { defineConfig, devices } from '@playwright/test';

/**
 * Configuration end-to-end.
 *
 * ⚠️ Playwright N'EST PAS INSTALLÉ en Phase 1 — ce fichier ne compile pas tant
 * que le paquet est absent (il est donc exclu du typecheck et du lint).
 *
 * Raison : Playwright télécharge ~500 Mo de navigateurs, et la Phase 1 ne
 * contient aucun parcours utilisateur réel à tester (les pages sont des
 * coquilles). Installer maintenant reviendrait à immobiliser de l'espace disque
 * pour vérifier des écrans qui vont changer.
 *
 * Activation en Phase 2, quand les formulaires d'authentification existeront :
 *
 *     npm install -D @playwright/test
 *     npx playwright install chromium
 *     npx playwright test
 *
 * Il faudra alors retirer les exclusions de `playwright.config.ts` et `e2e/`
 * dans tsconfig.node.json et eslint.config.js.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Le responsive est une contrainte d'architecture, pas une finition :
    // un profil mobile est prévu dès la mise en place.
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
