import { defineConfig, type PlaywrightTestConfig } from '@playwright/test';
import path from 'node:path';
import { sharedConfig } from './playwright.shared.config';

const port = Number(process.env['BROWSER_QUALITY_PORT'] ?? 4217);
process.env['BROWSER_QUALITY_PORT'] = String(port);
const hostedUrl = process.env['DEMO_HOSTED_URL'];
if (!hostedUrl) process.env['BROWSER_QUALITY_PREBUILD_STATUS'] = 'pass';

const evidenceDir = path.resolve(process.cwd(), 'apps/dashboard-e2e/test-output/playwright/demo');
const shared = sharedConfig('chromium') as PlaywrightTestConfig;

export default defineConfig({
  ...shared,
  testDir: './src/demo',
  outputDir: path.join(evidenceDir, 'traces'),
  reporter: [['list'], ['json', { outputFile: path.join(evidenceDir, 'results.json') }]],
  webServer: hostedUrl ? undefined : shared.webServer,
  use: {
    ...shared.use,
    baseURL: hostedUrl ?? shared.use?.baseURL ?? `http://localhost:${port}`,
    actionTimeout: 15_000,
  },
});
