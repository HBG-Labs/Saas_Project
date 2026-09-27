import tseslint from 'typescript-eslint';

// Ce qui s'exécute dans le navigateur de rendu doit être déterministe :
// une frame ne dépend que du Render Plan et de son numéro.
const determinismRules = {
  'no-restricted-properties': [
    'error',
    { object: 'Math', property: 'random', message: 'Une frame ne dépend que du Render Plan.' },
    { object: 'Date', property: 'now', message: 'Une frame ne dépend que du Render Plan.' },
    { object: 'performance', property: 'now', message: 'Une frame ne dépend que du Render Plan.' },
  ],
  'no-restricted-syntax': [
    'error',
    { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: 'Une frame ne dépend que du Render Plan.' },
  ],
};

// Le renderer interprète un plan : il ne lit ni exemple ni pack de données.
const boundaryRules = {
  'no-restricted-imports': [
    'error',
    { patterns: [{ group: ['**/examples/**', '**/packs/**', '**/integration/**'], message: 'Le renderer reçoit ses données en entrée.' }] },
  ],
};

export default tseslint.config(
  { ignores: ['node_modules/**', 'out/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      ...boundaryRules,
    },
  },
  { files: ['src/composition/**/*.{ts,tsx}', 'src/frame-state.ts'], rules: determinismRules },
  {
    files: ['src/**/*.test.{ts,tsx}', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },
);
