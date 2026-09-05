import { defineConfig, devices } from '@playwright/test';

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
    // Le premier chargement d'une route lazy peut inclure la compilation Vite
    // à froid, particulièrement sur les runners CI et les mobiles émulés.
    timeout: 15_000,
  },

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
