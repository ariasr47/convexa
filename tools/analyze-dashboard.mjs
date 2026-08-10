#!/usr/bin/env node
/**
 * Production dashboard build with rollup-plugin-visualizer output.
 * Writes apps/dashboard/dist/stats.html (treemap, gzip/brotli annotations).
 *
 * Usage: node tools/analyze-dashboard.mjs
 *    or: npm run analyze:dashboard
 *    or: nx run @convexa/dashboard:analyze
 *
 * Prod perf claims still require `nx preview` (or deployed Pages) — stats.html is for weight only.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cwd = path.join(root, 'apps', 'dashboard');

const result = spawnSync('npx', ['vite', 'build', '--mode', 'production'], {
  cwd,
  env: { ...process.env, ANALYZE: '1' },
  stdio: 'inherit',
  shell: true,
});

if ((result.status ?? 1) === 0) {
  console.log('\n[analyze] Open apps/dashboard/dist/stats.html for the treemap.');
}

process.exit(result.status ?? 1);
