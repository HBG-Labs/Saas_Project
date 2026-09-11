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
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      output: {
        /*
          UNE EXCEPTION AU « PAS DE manualChunks », ET POURQUOI.

          Ce fichier affirmait qu'ajouter manualChunks serait une optimisation
          prématurée. Mesuré sur le build réel, ça ne l'était plus : 281
          fichiers .js, dont 129 de moins d'1 Ko, et 95 d'entre eux réduits à
          une seule icône Lucide (124 à 300 octets chacun — voir
          `check-*.js` : `import{t as e}from"./createLucideIcon-*.js";var
          t=e('check',[['path',{d:'M20 6 9 17l-5-5'}]])`).

          Le fautif n'est pas la façon dont le code importe ces icônes
          (imports nommés, tree-shakables) : c'est l'algorithme par défaut de
          Rollup, qui extrait tout module partagé par 2+ chunks asynchrones
          dans son propre fichier — pour ne pas le dupliquer. Comme chaque
          icône Lucide est déjà son propre module source, et que des dizaines
          de pages chargées en différé en partagent, chaque icône commune
          devient son propre chunk.

          Mesuré en conditions réelles sur le site en production (compte de
          démonstration, connexion normale) : ces micro-fichiers prenaient
          chacun 200 à 400 ms, et un cinquième d'entre eux n'avaient toujours
          pas fini de charger trois secondes après l'arrivée sur le tableau
          de bord. Le poids total ne change presque pas — ce n'est pas un
          problème d'octets, c'est un problème de NOMBRE de requêtes.

          Regrouper `lucide-react` en un seul chunk collapse ~95 requêtes de
          quelques centaines d'octets en une seule, mise en cache une fois
          pour toute la session : 281 fichiers → 175, pour 20,9 Ko gzippés.
        */
        manualChunks(id) {
          if (id.includes('node_modules/lucide-react')) return 'icons';
        },
      },
    },
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
