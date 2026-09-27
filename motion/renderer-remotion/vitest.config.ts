import { defineConfig } from 'vitest/config';

// Tests unitaires du renderer : aucun navigateur, aucun encodage vidéo.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    testTimeout: 30_000,
  },
});
