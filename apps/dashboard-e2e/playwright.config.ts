import { workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright e2e config for the dashboard.
 *
 * MIGRATION NOTE (2026-07-28): this repo ran Playwright, moved to Cypress on 2026-07-16, and moved
 * back. The port ran with BOTH runners live for one commit (`8c1c2b8`) — Playwright under `e2e-pw`,
 * Cypress keeping `e2e` — so the suites could be checked against each other before either was
 * deleted. The suite being ported exists to catch SILENT regressions, so the migration risk was
 * never "does it compile", it was "did an assertion quietly get weaker in translation". Equivalence
 * was established three ways: same test COUNT (29), same test INVENTORY via `--list`, and a MUTATION
 * check — reverting the CustomizationToolbar `flexWrap` fix failed exactly one test, `/positions
 * fits 900px`, with the real number. Cypress was removed only after that.
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
      ? `npx nx run @convexa/dashboard:serve-static --port=${PORT}`
      : `npx nx run @convexa/dashboard:serve`,
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
    cwd: workspaceRoot,
    timeout: 180_000,
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
