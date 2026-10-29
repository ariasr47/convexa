#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readInputs, writeHeads } from './write-blog-heads.mjs';

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
if (result.status !== 0) process.exit(result.status ?? 1);

// Every address's own head, the edge routing (_redirects, 404.html), the sitemap, and on a demo
// build the staging rules (write-blog-heads.mjs). Here rather than inside the Nx target, so it reads
// the current posts.json, research notes and universe even when Nx restores the build from its cache.
try {
  const dist = path.join(root, 'apps', 'dashboard', 'dist');
  const written = writeHeads(dist, { ...(await readInputs(root)), mode: dataMode });
  console.log(`[build-dashboard] heads: wrote ${written.length} files (${dataMode})`);
} catch (error) {
  console.error(`[build-dashboard] heads: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
process.exit(0);
