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
 * The shared webServer block serves the built app over local HTTPS in CI and keeps Vite HTTP
 * for development. Server readiness and browser navigation inherit the same shared origin.
 */

const shared = sharedConfig('chromium');

const config = {
  ...shared,
  testDir: './src/e2e',
  testMatch: ['curvature-v2.spec.ts', 'navigation.spec.ts'],
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
    ...shared.use,
    // Preserve the failing attempt itself; a passing retry cannot explain the original failure.
    trace: 'retain-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
};
export default config as any;
