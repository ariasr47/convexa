import { workspaceRoot } from '@nx/devkit';
import { defineConfig, devices } from '@playwright/test';

export type Gate = 'chromium' | 'compatibility' | 'accessibility' | 'visual';

export function sharedConfig(gate: Gate) {
  const port = Number(process.env.BROWSER_QUALITY_PORT ?? 4200);
  const baseURL = process.env.BASE_URL ?? `http://localhost:${port}`;
  return defineConfig({
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    failOnFlakyTests: true,
    retries: process.env.CI ? 1 : 0,
    use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
    webServer: {
      command: process.env.CI
        ? `npx nx run @convexa/dashboard:serve-static --port=${port}`
        : `npx nx run @convexa/dashboard:serve --port=${port}`,
      url: baseURL,
      reuseExistingServer: false,
      cwd: workspaceRoot,
      timeout: 180_000,
    },
    reporter: [
      ['list'],
      [
        './src/quality/reporters/quality-reporter.ts',
        { gate, output: `apps/dashboard-e2e/test-output/playwright/${gate}/summary.json` },
      ],
    ],
    projects:
      gate === 'compatibility'
        ? (['chromium', 'firefox', 'webkit'] as const).map((name) => ({
            name,
            use: {
              ...devices[
                name === 'chromium'
                  ? 'Desktop Chrome'
                  : name === 'firefox'
                    ? 'Desktop Firefox'
                    : 'Desktop Safari'
              ],
            },
          }))
        : [
            {
              name: gate === 'chromium' ? 'chromium' : 'chromium',
              use: { ...devices['Desktop Chrome'] },
            },
          ],
  });
}
