import { defineConfig } from '@playwright/test';
import { loadEnv } from 'vite';

import { readDemoEnvironment } from './demo/helpers/env';

const loaded = loadEnv('demo', process.cwd(), '');
for (const [name, value] of Object.entries(loaded)) {
  if (process.env[name] === undefined) process.env[name] = value;
}

const demo = readDemoEnvironment();

export default defineConfig({
  testDir: './demo',
  testMatch: 'commercial-demo.spec.ts',
  outputDir: './demo-output/test-artifacts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  forbidOnly: true,
  reporter: [['line']],
  expect: { timeout: 20_000 },
  use: {
    baseURL: demo.baseUrl,
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: {
    command: 'npm run dev -- --mode demo --host 127.0.0.1 --port 4173',
    url: demo.baseUrl,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
