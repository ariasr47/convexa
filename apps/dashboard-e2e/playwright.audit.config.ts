import { workspaceRoot } from '@nx/devkit';
import { defineConfig, devices } from '@playwright/test';

/**
 * Design-fidelity audit harness (2026-09-08). NOT a gate: nothing here asserts pass/fail. It renders
 * the built app (through the same strict fixtures the quality gates use) and the generated design
 * source (`design/site/*.html`) at the design's own artboard widths, and writes full-page PNGs plus a
 * measurement JSON per capture so composition can be compared by number, not by eye.
 *
 * Why a separate config: the visual gate is compare-only against six frozen baselines with a receipt
 * state machine (`visual-review/README.md`); this is a survey, so it must never write into that
 * machinery. Run it explicitly:
 *
 *   AUDIT_OUT=<folder> npx playwright test --config apps/dashboard-e2e/playwright.audit.config.ts
 *
 * The app server is the production bundle (`apps/dashboard/dist`) — build it first. The design site is
 * served as-is; its Google Fonts request is answered from `apps/dashboard/public/fonts` (same faces,
 * same weight ranges) so both sides render the identical font files with no external network.
 */
const APP_PORT = 4200;
const DESIGN_PORT = 4310;
// AUDIT_LIVE=1: serve the Vite dev server instead of the bundle — it proxies `/api` to the real
// backend on :8000 (start it first), so the anonymous surfaces render real, populated data.
const LIVE = process.env.AUDIT_LIVE === '1';

export default defineConfig({
  testDir: './src/audit',
  testMatch: ['fidelity.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Live mode's first navigation pays the cold Vite transform + dependency optimisation (minutes).
  timeout: LIVE ? 420_000 : 180_000,
  outputDir: 'test-output/playwright/audit',
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  webServer: [
    {
      command: LIVE
        ? `npx nx run @convexa/dashboard:serve --port=${APP_PORT}`
        : `npx http-server apps/dashboard/dist -c-1 --cors -a localhost -P http://localhost:${APP_PORT}? -p ${APP_PORT}`,
      url: `http://localhost:${APP_PORT}`,
      reuseExistingServer: false,
      cwd: workspaceRoot,
      timeout: 180_000,
    },
    {
      command: `npx http-server design/site -c-1 -a localhost -p ${DESIGN_PORT}`,
      url: `http://localhost:${DESIGN_PORT}/index.html`,
      reuseExistingServer: false,
      cwd: workspaceRoot,
      timeout: 120_000,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
