#!/usr/bin/env node
/**
 * Private production sourcemaps (§4.6).
 *
 * Vite emits `hidden` maps next to hashed assets (no `//# sourceMappingURL` in JS, so browsers
 * never fetch them). This script **moves** `*.map` out of `dist/` into deterministic local
 * `sourcemaps-private/current/` so they are NOT uploaded to Cloudflare Pages / Docker HTML root.
 *
 * Usage (after `vite build --mode production`):
 *   node tools/archive-sourcemaps.mjs
 *
 * Restore for local debugging:
 *   copy apps/dashboard/sourcemaps-private/current/assets/*.map → dist/assets/
 *   then open DevTools and use "Add source map" if needed.
 */
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'apps', 'dashboard', 'dist');
const archiveRoot = path.join(root, 'apps', 'dashboard', 'sourcemaps-private');
const currentRoot = path.join(archiveRoot, 'current');

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

export function archiveSourcemaps({
  workspaceRoot = root,
  distDir = dist,
  currentDir = currentRoot,
} = {}) {
  if (!existsSync(distDir)) throw new Error('missing dist — build first');
  const resolved = path.resolve(currentDir);
  if (!resolved.startsWith(`${path.resolve(workspaceRoot)}${path.sep}`))
    throw new Error('Refusing sourcemap output outside workspace');
  if (existsSync(resolved)) rmSync(resolved, { recursive: true, force: true });
  const destRoot = resolved;
  mkdirSync(destRoot, { recursive: true });
  const maps = walk(distDir).filter((f) => f.endsWith('.map'));

  const moved = [];
  for (const src of maps) {
    const rel = path.relative(distDir, src);
    const dest = path.join(destRoot, rel);
    mkdirSync(path.dirname(dest), { recursive: true });
    renameSync(src, dest);
    moved.push(rel.replace(/\\/g, '/'));
  }

  const manifest = {
    count: moved.length,
    note: 'Hidden Vite sourcemaps — not linked from JS. Keep private; do not deploy to Pages/CDN.',
    files: moved.sort().map((rel) => ({
      path: rel,
      sha256: createHash('sha256')
        .update(readFileSync(path.join(destRoot, rel)))
        .digest('hex'),
    })),
  };
  writeFileSync(path.join(destRoot, 'MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  return { count: moved.length, files: manifest.files, destRoot };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = archiveSourcemaps();
    console.log(
      `[archive-sourcemaps] moved ${result.count} maps → ${path.relative(root, result.destRoot)}`,
    );
  } catch (error) {
    console.error(`[archive-sourcemaps] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
}
