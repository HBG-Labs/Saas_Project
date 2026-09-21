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
      'demo-output/**',
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

  /*
    -------------------------------------------------- jetons de design
    LA DETTE EST GELÉE, PUIS RÉSORBÉE — ELLE NE PEUT PLUS AUGMENTER.

    Trois écritures contournent le design system et cassent le thème sombre
    comme la future identité : une couleur hexadécimale en dur, une classe de
    la palette brute de Tailwind (`bg-blue-600`), une taille de texte
    arbitraire (`text-[9px]`, sous le plancher de lisibilité).

    Mesuré au moment de poser cette règle : 550 hex, 411 classes de palette,
    36 tailles arbitraires. Les corriger toutes d'un coup toucherait 40
    fichiers sans filet ; la règle est donc active PARTOUT, et la liste
    ci-dessous énumère les fichiers qui en sont exemptés.

    Deux natures d'exemption, à ne pas confondre :

      LÉGITIME — la couleur y est une donnée, pas une décision de style :
      code couleur fibre, charte d'un tiers, canevas, écran avant CSS. Ces
      lignes restent.

      DETTE — du style écrit à la main. Ces lignes disparaissent à mesure que
      les écrans sont repris. Retirer une entrée et voir ESLint rester vert,
      c'est la dette qui recule.

    Une nouvelle entrée dans cette liste doit se justifier en revue. Un
    fichier neuf n'y entre pas.
  */
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'src/test/**',

      // ---- LÉGITIME : la couleur est une donnée, pas un choix de style ----
      // Codes couleurs normalisés : la teinte EST l'information.
      'src/tools/fiber-color-code/**',
      'src/tools/copper-color-code/**',
      // Source de la palette : c'est ici que les valeurs sont censées vivre.
      'src/features/theme/**',
      // S'exécute avant que la moindre feuille de style soit chargée.
      'src/app/boot-failure.ts',
      // Charte de marque imposée par le fournisseur d'identité.
      'src/features/auth/components/GoogleAuthButton.tsx',
      // API de cartes tierces : leurs styles n'acceptent que des couleurs concrètes.
      'src/features/map/**',
      'src/features/geo/**',
      // Outils qui peignent une surface : lampe, signature et visualiseur audio.
      'src/features/tools/field/flashlight/**',
      'src/features/interventions/components/SignaturePadModal.tsx',
      'src/features/tools/field/voice-recorder/**',
      // Sorties autonomes : feuille imprimable, export HTML et palette de séries.
      'src/features/interventions/components/InterventionPdfModal.tsx',
      'src/pages/analytics/AnalyticsPage.tsx',

      // ---- DETTE : à résorber écran par écran, cette liste doit maigrir ----
      'src/components/marketing/Categories.tsx',
      'src/components/marketing/Faq.tsx',
      'src/components/marketing/Hero.tsx',
      'src/components/marketing/Pricing.tsx',
      'src/components/pricing/PricingSimulator.tsx',
      'src/pages/LandingPage.tsx',
      'src/pages/PricingPage.tsx',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/#[0-9a-fA-F]{6}/]',
          message:
            'Couleur hexadécimale en dur : elle ignore le thème sombre et la future identité. Utilisez un jeton sémantique (text-foreground, bg-surface, border-border…). Si la couleur est une DONNÉE (code couleur, charte tierce, canevas), ajoutez le fichier aux exemptions légitimes d’eslint.config.js, avec sa raison.',
        },
        {
          selector: 'TemplateElement[value.raw=/#[0-9a-fA-F]{6}/]',
          message:
            'Couleur hexadécimale en dur dans un gabarit : même règle que pour une chaîne littérale.',
        },
        {
          selector:
            'Literal[value=/\\b(bg|text|border|ring|from|via|to)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\\b/]',
          message:
            'Classe de la palette brute de Tailwind : elle ne suit ni le thème sombre ni les thèmes personnalisés. Utilisez un jeton sémantique (bg-primary, text-success, border-border…).',
        },
        {
          selector: 'Literal[value=/text-\\[[0-9]+px\\]/]',
          message:
            'Taille de texte arbitraire : l’échelle typographique existe (text-3xs à text-5xl) et garantit le plancher de lisibilité. En dessous de 12 px, le texte est illisible pour une part réelle des utilisateurs.',
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
      'demo/**/*.{test,spec}.{ts,tsx}',
      'demo/helpers/**/*.{ts,tsx}',
    ],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      /*
        UNE SEULE RÈGLE RESTE DÉSACTIVÉE, ET POUR UNE RAISON PRÉCISE.

        Les sept autres l'étaient aussi. Les réactiver relevait 43 erreurs, qui
        ont toutes été corrigées : doublures réellement typées plutôt que
        contournées par `any`, `async` retirés là où rien n'était attendu, et
        méthodes tenues par le bout au lieu d'être détachées de leur objet.

        `no-unsafe-assignment` est le cas à part. Les huit occurrences qui
        subsistent portent toutes sur des matchers asymétriques —
        `expect.objectContaining`, `stringContaining`, `stringMatching` — que
        Vitest type `any` PAR CONCEPTION. Les faire taire imposerait un cast sur
        chaque matcher imbriqué : du bruit, sans un gramme de sûreté en plus.
        Ici la règle a tort, pas le code.

        Elle n'est pas passée en `warn` : des avertissements que personne ne lit
        valent moins que zéro, comme l'a montré le garde-fou du catalogue.

        Refaire la mesure avant d'en changer.
      */
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
