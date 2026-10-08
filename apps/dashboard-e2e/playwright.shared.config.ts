import { workspaceRoot } from '@nx/devkit';
import { defineConfig, devices } from '@playwright/test';

export type Gate = 'chromium' | 'compatibility' | 'accessibility' | 'visual';

export function sharedConfig(gate: Gate) {
  const port = Number(process.env.BROWSER_QUALITY_PORT ?? 4200);
  const prebuildStatus = process.env.BROWSER_QUALITY_PREBUILD_STATUS;
  const workerValue = process.env.BROWSER_QUALITY_WORKERS;
  const workers = workerValue === undefined ? undefined : Number(workerValue);
  if (
    workerValue !== undefined &&
    (!Number.isInteger(workers) || (workers as number) < 1 || (workers as number) > 16)
  )
    throw new Error('BROWSER_QUALITY_WORKERS must be an integer from 1 through 16');
  const builtArtifact = prebuildStatus === 'pass' || Boolean(process.env.CI);
  // Certificate exceptions belong only to the server this config starts. Hosted/BASE_URL
  // overrides always retain normal certificate verification, even when CI/prebuild is set.
  const externalUrl = process.env.DEMO_HOSTED_URL ?? process.env.BASE_URL;
  const localHttps = builtArtifact && externalUrl === undefined;
  const baseURL = externalUrl ?? `${builtArtifact ? 'https' : 'http'}://localhost:${port}`;
  const serveArtifact = `node apps/dashboard-e2e/tools/serve-dist.mjs apps/dashboard/dist ${port} localhost https`;
  return defineConfig({
    fullyParallel: true,
    ...(workers === undefined ? {} : { workers }),
    forbidOnly: Boolean(process.env.CI),
    failOnFlakyTests: true,
    retries: process.env.CI ? 1 : 0,
    use: {
      baseURL,
      ignoreHTTPSErrors: localHttps,
      trace: 'retain-on-failure',
      screenshot: 'only-on-failure',
    },
    webServer:
      externalUrl === undefined
        ? {
            command:
              prebuildStatus === 'pass'
                ? serveArtifact
                : process.env.CI
                  ? `npx nx run @convexa/dashboard:build --configuration=production && ${serveArtifact}`
                  : `npx nx run @convexa/dashboard:serve --port=${port}`,
            url: baseURL,
            ignoreHTTPSErrors: localHttps,
            reuseExistingServer: false,
            cwd: workspaceRoot,
            timeout: 180_000,
          }
        : undefined,
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
