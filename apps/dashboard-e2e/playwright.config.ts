import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

/**
 * Playwright e2e config for the dashboard.
 *
 * MIGRATION NOTE (2026-07-28): this repo ran Playwright, moved to Cypress on 2026-07-16, and is
 * moving back. During the port BOTH runners are live — `@nx/playwright/plugin` is registered in
 * nx.json under the target name **`e2e-pw`** while `@nx/cypress/plugin` keeps **`e2e`** — so the two
 * suites can be run against each other assertion-for-assertion before either is deleted. The suite
 * being ported exists to catch SILENT regressions, so the risk in a migration is not "does it
 * compile" but "did an assertion quietly get weaker in translation". Side-by-side is how that is
 * caught. At cutover this takes over `e2e` and the Cypress config/plugin/specs are removed.
 *
 * DELIBERATELY EQUAL COVERAGE, not expanded: chromium only, same five routes, same viewports, same
 * two colour schemes. Adding WebKit/Firefox is a separate decision with its own failures to triage —
 * mixing "migrate" with "widen coverage" makes it impossible to tell a port bug from a real one.
 *
 * The webServer block replaces `cypress.config.ts`'s `webServerCommands.default`; `serve-static`
 * (the built app) is the CI counterpart, matching the previous `ciWebServerCommand`.
 */

const PORT = 4200;
const baseURL = process.env['BASE_URL'] || `http://localhost:${PORT}`;

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src/e2e' }),

  // The unit suite runs on the same machine; e2e already gets its own CI step so the browser does
  // not contend with the vitest workers (that contention flaked the unit tests under Cypress).
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,

  use: {
    baseURL,
    // The trace viewer is the main practical win of this migration for CI triage: a failed run
    // carries DOM snapshots, network and console rather than just a stack.
    trace: 'on-first-retry',
  },

  webServer: {
    command: process.env['CI']
      ? `npx nx run @org/dashboard:serve-static --port=${PORT}`
      : `npx nx run @org/dashboard:serve`,
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
    cwd: workspaceRoot,
    timeout: 180_000,
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
