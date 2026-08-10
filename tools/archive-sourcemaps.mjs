#!/usr/bin/env node
/**
 * Private production sourcemaps (§4.6).
 *
 * Vite emits `hidden` maps next to hashed assets (no `//# sourceMappingURL` in JS, so browsers
 * never fetch them). This script **moves** `*.map` out of `dist/` into a local archive so they
 * are NOT uploaded to Cloudflare Pages / Docker HTML root.
 *
 * Usage (after `vite build --mode production`):
 *   node tools/archive-sourcemaps.mjs
 *
 * Restore for local debugging:
 *   copy apps/dashboard/sourcemaps-private/<stamp>/assets/*.map → dist/assets/
 *   then open DevTools and use "Add source map" if needed.
 */
import { existsSync, mkdirSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'apps', 'dashboard', 'dist');
const archiveRoot = path.join(root, 'apps', 'dashboard', 'sourcemaps-private');

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function main() {
  if (!existsSync(dist)) {
    console.error('[archive-sourcemaps] missing dist — build first');
    process.exit(2);
  }

  const maps = walk(dist).filter((f) => f.endsWith('.map'));
  if (maps.length === 0) {
    console.log('[archive-sourcemaps] no .map files in dist (ok if sourcemap disabled)');
    process.exit(0);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const destRoot = path.join(archiveRoot, stamp);
  mkdirSync(destRoot, { recursive: true });

  const moved = [];
  for (const src of maps) {
    const rel = path.relative(dist, src);
    const dest = path.join(destRoot, rel);
    mkdirSync(path.dirname(dest), { recursive: true });
    renameSync(src, dest);
    moved.push(rel.replace(/\\/g, '/'));
  }

  const manifest = {
    archived_at: new Date().toISOString(),
    count: moved.length,
    note: 'Hidden Vite sourcemaps — not linked from JS. Keep private; do not deploy to Pages/CDN.',
    files: moved,
  };
  writeFileSync(path.join(destRoot, 'MANIFEST.json'), JSON.stringify(manifest, null, 2));
  writeFileSync(path.join(archiveRoot, 'LATEST'), stamp + '\n');

  console.log(`[archive-sourcemaps] moved ${moved.length} maps → ${path.relative(root, destRoot)}`);
}

main();
