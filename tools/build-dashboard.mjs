#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeBlogHeads } from './write-blog-heads.mjs';

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

// Each blog post's address gets its own <title>, canonical and share tags (write-blog-heads.mjs).
// Here rather than inside the Nx target, so it reads the current docs/blog/posts.json even when Nx
// restores the dashboard build from its cache.
try {
  const dist = path.join(root, 'apps', 'dashboard', 'dist');
  const postsJson = readFileSync(path.join(root, 'docs', 'blog', 'posts.json'), 'utf8');
  for (const file of writeBlogHeads(dist, postsJson)) {
    console.log(`[build-dashboard] wrote ${path.relative(root, file)}`);
  }
} catch (error) {
  console.error(`[build-dashboard] blog heads: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
process.exit(0);
