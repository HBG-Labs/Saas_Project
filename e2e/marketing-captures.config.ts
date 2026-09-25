import { defineConfig } from '@playwright/test';
import config from '../playwright.config';

/** Dedicated isolated capture build; the normal QA command still typechecks. */
export default defineConfig({
  ...config,
  testDir: '.',
  testMatch: 'marketing-captures.spec.ts',
  workers: 1,
  webServer: {
    ...config.webServer,
    cwd: process.cwd(),
    command:
      process.env.MARKETING_CAPTURE_REUSE === '1'
        ? 'node node_modules/vite/bin/vite.js preview --outDir dist-captures --port 5199 --strictPort'
        : 'node node_modules/vite/bin/vite.js build --outDir dist-captures && node node_modules/vite/bin/vite.js preview --outDir dist-captures --port 5199 --strictPort',
    timeout: 240_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
