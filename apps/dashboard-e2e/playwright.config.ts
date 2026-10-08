import { devices } from '@playwright/test';
import { sharedConfig } from './playwright.shared.config';

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

const PORT = Number(process.env['BROWSER_QUALITY_PORT'] ?? 4200);
const baseURL = process.env['BASE_URL'] || `http://localhost:${PORT}`;

const config = {
  ...sharedConfig('chromium'),
  testDir: './src/e2e',
  testMatch: [
    'app-loads.spec.ts',
    'broker-grouping.spec.ts',
    'broker.spec.ts',
    'curvature-v2.spec.ts',
    'desk-and-read.spec.ts',
    'navigation.spec.ts',
  ],
  reporter: [
    ['list'],
    [
      './src/quality/reporters/quality-reporter.ts',
      {
        gate: 'chromium',
        output: 'apps/dashboard-e2e/test-output/playwright/chromium/summary.json',
      },
    ],
  ],

  // The unit suite runs on the same machine; e2e already gets its own CI step so the browser does
  // not contend with the vitest workers (that contention flaked the unit tests under Cypress).
  use: {
    ...sharedConfig('chromium').use,
    baseURL,
    // The trace viewer is the main practical win of this migration for CI triage: a failed run
    // carries DOM snapshots, network and console rather than just a stack.
    trace: 'on-first-retry',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
};
export default config as any;
