import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

// Cypress e2e config for the dashboard (replaces the prior Playwright setup).
// The @nx/cypress/plugin (nx.json) infers the e2e / e2e-ci targets from this file.
// webServerCommands.default makes `nx e2e dashboard-e2e` auto-start the dashboard
// dev server as a continuous dependency (the equivalent of Playwright's webServer);
// ciWebServerCommand serves the static build in CI. Spec + support paths come from
// the preset (cypressDir 'src': specs in src/**/*.cy.ts, support in src/support/e2e.ts).
export default defineConfig({
  e2e: {
    ...nxE2EPreset(__dirname, {
      cypressDir: 'src',
      bundler: 'vite',
      webServerCommands: {
        default: 'npx nx run @org/dashboard:serve',
      },
      ciWebServerCommand: 'npx nx run @org/dashboard:serve-static',
      ciBaseUrl: 'http://localhost:4200',
    }),
    baseUrl: process.env['BASE_URL'] || 'http://localhost:4200',
  },
});
