import baseConfig from '../../eslint.config.mjs';

// Playwright e2e project (migrated from Cypress 2026-07-28). The `eslint-plugin-cypress`
// recommended config that used to lead this array is gone with the runner; Playwright needs no
// equivalent plugin for this suite's rules, so the base workspace config stands alone.
export default [...baseConfig];
