#!/usr/bin/env node
// `npm run test:tools`: every hermetic tool spec under tools/ and apps/dashboard-e2e/tools/,
// including the supply-chain and browser-gate guard proofs. Left out because they are not hermetic:
//   tools/supply-chain/policy.spec.mjs — downloads a package tarball from registry.npmjs.org;
//   apps/dashboard-e2e/tools/real-negative-controls.spec.mjs — starts Playwright and a dev server.
import { spawnSync } from 'node:child_process';
import { globSync } from 'node:fs';

const notHermetic = new Set([
  'tools/supply-chain/policy.spec.mjs',
  'apps/dashboard-e2e/tools/real-negative-controls.spec.mjs',
]);
const files = globSync(['tools/**/*.spec.mjs', 'apps/dashboard-e2e/tools/**/*.spec.mjs'])
  .map((file) => file.replaceAll('\\', '/'))
  .filter((file) => !notHermetic.has(file))
  .sort();

const result = spawnSync(process.execPath, ['--test', ...process.argv.slice(2), ...files], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
