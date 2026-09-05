import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Configuration ESLint de REZO360.
 *
 * Au-delà des règles de style, ce fichier fait respecter MÉCANIQUEMENT
 * l'architecture en couches décrite dans ARCHITECTURE.md :
 *
 *     UI  →  features  →  services  →  Supabase
 *
 * Une convention non outillée finit toujours par être violée ; ici une
 * violation de couche casse le lint.
 */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'supabase/**',
      '.codex/**',
      '.claude/**',
      '.codex-remote-attachments/**',
      'output/**',
      'COdeFinal/**',
      'Test/**',
      'Saas_Project/**',
    ],
  },

  // ---------------------------------------------------------------- base TS
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      eqeqeq: ['error', 'smart'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // ------------------------------------------------------- React & a11y (§12)
  {
    files: ['**/*.{ts,tsx}'],
    // `configs.flat.*` et non `configs.*` : à la racine, eslint-plugin-react-hooks
    // expose encore l'ancien format eslintrc, incompatible avec la flat config.
    extends: [reactHooks.configs.flat.recommended, jsxA11y.flatConfigs.recommended],
  },
  {
    files: ['src/**/*.tsx'],
    extends: [reactRefresh.configs.vite],
  },

  // =====================================================================
  // FRONTIÈRES D'ARCHITECTURE
  // =====================================================================

  // 1. Le client Supabase n'est instanciable que par la couche services.
  //    Les features y accèdent via leur dossier `api/`. Rien d'autre ne
  //    doit connaître Supabase : ni les pages, ni les composants, ni lib/.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/services/**', 'src/features/*/api/**', 'src/types/**', 'src/test/**'],
    rules: {
      // Variante typescript-eslint : `allowTypeImports` laisse passer les
      // imports de TYPES (effacés à la compilation, donc incapables de faire
      // entrer le client dans le bundle) tout en bloquant les imports de valeur.
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@supabase/supabase-js',
                '@/services/supabase/client',
                '**/services/supabase/client',
              ],
              allowTypeImports: true,
              message:
                "Accès direct à Supabase interdit ici. Passez par src/services/** ou par le dossier api/ d'une feature.",
            },
          ],
        },
      ],
    },
  },

  // 2. Les primitives UI restent réutilisables : aucune logique métier.
  {
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*', '@/services/*', '@/tools/*'],
              message:
                'Une primitive UI ne doit dépendre ni des features, ni des services, ni des outils.',
            },
          ],
        },
      ],
    },
  },

  // 3. Une feature ne consomme une autre feature que par son API publique
  //    (son index.ts), jamais par ses fichiers internes.
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*/*'],
              message:
                'Importez la feature par son API publique (@/features/<nom>), pas par ses fichiers internes.',
            },
          ],
        },
      ],
    },
  },

  // =====================================================================
  // SYSTÈME MODULAIRE D'OUTILS
  // =====================================================================

  // 4. §16 — la logique de calcul doit être testable sans UI.
  //    compute.ts reste une fonction pure : pas de React, pas de réseau.
  {
    files: ['src/tools/**/compute.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react-router', '@/services/*', '@/features/*'],
              message:
                'compute.ts doit rester pur et testable sans DOM. Déplacez toute dépendance UI ou réseau dans le composant.',
            },
          ],
        },
      ],
    },
  },

  // 5. CORRECTIF — préservation du code splitting.
  //    src/tools/index.ts charge tous les index.ts d'outils en `eager`.
  //    Si un index.ts importait statiquement son composant, tout le code UI
  //    de tous les outils atterrirait dans le bundle initial.
  //    Le composant DOIT donc être référencé via lazy(() => import('./XTool')).
  //    Seuls les modules non-UI (compute, schema, types) sont importables.
  {
    files: ['src/tools/*/index.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'ImportDeclaration[source.value=/^\\.\\/(?!compute$|schema$|types$|constants$)/]',
          message:
            "Import statique interdit dans l'index d'un outil : il casserait le code splitting (src/tools/index.ts charge ces fichiers en eager). Utilisez Component: lazy(() => import('./MonOutilTool')).",
        },
      ],
    },
  },

  // ------------------------------------------------------------- tests
  {
    files: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'src/test/**/*.{ts,tsx}',
      'e2e/**/*.{test,spec}.{ts,tsx}',
    ],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': 'off',
      // Les helpers de test ne sont pas des composants : Fast Refresh ne les
      // concerne pas.
      'react-refresh/only-export-components': 'off',
    },
  },

  // ----------------------------------------------------- fichiers de config
  {
    files: ['*.config.{ts,js}', 'scripts/**'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },

  // Toujours en dernier : désactive tout ce qui entre en conflit avec Prettier.
  prettier,
);
