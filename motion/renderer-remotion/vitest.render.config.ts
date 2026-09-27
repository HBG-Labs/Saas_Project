import { defineConfig } from 'vitest/config';

// Smoke test de rendu réel (Chromium + encodage) : lancé à part, pas à chaque
// `npm run check`, car il télécharge un navigateur et dure plusieurs dizaines de secondes.
export default defineConfig({
  test: {
    include: ['test/**/*.render.test.ts'],
    environment: 'node',
    testTimeout: 600_000,
    hookTimeout: 600_000,
    fileParallelism: false,
  },
});
