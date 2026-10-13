#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const explicit = process.env.VITE_DATA_MODE;
if (explicit !== undefined && explicit !== 'demo' && explicit !== 'live') {
  console.error(
    `[build-dashboard] invalid VITE_DATA_MODE ${JSON.stringify(explicit)}; expected demo or live`,
  );
  process.exit(2);
}
const requested = process.argv.find((arg) => arg.startsWith('--mode='))?.slice('--mode='.length);
// Staging: Cloudflare Pages builds the `staging` branch as the all-sample demo
// (staging.convexa.pages.dev); production (`main`) and every other branch build live.
const branchDefault = process.env.CF_PAGES === '1' && process.env.CF_PAGES_BRANCH === 'staging';
const dataMode = requested ?? explicit ?? (branchDefault ? 'demo' : 'live');
if (dataMode !== 'demo' && dataMode !== 'live') {
  console.error(
    `[build-dashboard] invalid VITE_DATA_MODE ${JSON.stringify(dataMode)}; expected demo or live`,
  );
  process.exit(2);
}

const nx = path.join(root, 'node_modules', 'nx', 'dist', 'bin', 'nx.js');
const result = spawnSync(
  process.execPath,
  [nx, 'build', '@convexa/dashboard', '--configuration=production'],
  {
    cwd: root,
    env: { ...process.env, VITE_DATA_MODE: dataMode },
    stdio: 'inherit',
    shell: false,
  },
);
if (result.error) {
  console.error(`[build-dashboard] failed to start Nx: ${result.error.message}`);
  process.exit(2);
}
process.exit(result.status ?? 1);
