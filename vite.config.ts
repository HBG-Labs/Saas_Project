/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Nécessaire sous OneDrive : la surveillance native rate parfois des
    // événements sur un dossier synchronisé.
    watch: {
      usePolling: false,
      ignored: ['**/ezgif-*/**', '**/COdeFinal/**', '**/Test/**', '**/Saas_Project/**', '**/coverage/**'],
    },
  },
  build: {
    // Le découpage vient du lazy loading par route (src/app/router.tsx).
    // Pas de manualChunks ici : ce serait une optimisation prématurée (§13).
    sourcemap: false,
    target: 'es2022',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // La suite comporte des scénarios de formulaire complets. Sous CI, où les
    // 120 fichiers tournent en parallèle, le délai Vitest de 5 s produisait des
    // faux négatifs alors que les mêmes scénarios réussissaient isolément.
    testTimeout: 15_000,
    // `src/config/env.ts` valide l'environnement au chargement du module et
    // échoue s'il est incomplet. Ces valeurs factices — jamais des secrets —
    // permettent aux tests de s'exécuter sans fichier .env local, y compris en
    // intégration continue.
    env: {
      VITE_SUPABASE_URL: 'https://test-project.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_only',
      VITE_APP_ENV: 'development',
    },
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**', 'src/types/**'],
    },
  },
});
