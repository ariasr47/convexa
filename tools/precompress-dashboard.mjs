#!/usr/bin/env node
/**
 * Write sibling `.gz` / `.br` for compressible dashboard dist assets (§3.8 optional).
 *
 * Used by:
 *   - production Vite build (post-step) → Docker nginx `gzip_static` / `brotli_static`
 *   - any host that prefers precompressed files over on-the-fly CPU
 *
 * Cloudflare Pages still on-the-fly brotli/gzip at the edge; extra siblings are small and
 * harmless if ignored. Docker nginx benefits immediately via gzip_static (and brotli_static
 * when the image has ngx_brotli).
 *
 * Usage:
 *   node tools/precompress-dashboard.mjs
 *   node tools/precompress-dashboard.mjs --dir apps/dashboard/dist
 */
import {
  createReadStream,
  createWriteStream,
  existsSync,
  readdirSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { constants, createBrotliCompress, createGzip } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const COMPRESSIBLE = new Set([
  '.js',
  '.mjs',
  '.css',
  '.html',
  '.svg',
  '.json',
  '.txt',
  '.xml',
  '.map',
  '.woff', // rare; woff2 is already compressed — skipped below
]);

/** Already-encoded or useless to re-compress. */
const SKIP_EXT = new Set(['.gz', '.br', '.woff2', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.gif']);

const MIN_BYTES = 512; // don't bother with tiny files

function parseDirArg(argv) {
  const i = argv.indexOf('--dir');
  if (i >= 0 && argv[i + 1]) return path.resolve(root, argv[i + 1]);
  return path.join(root, 'apps', 'dashboard', 'dist');
}

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

function shouldCompress(file) {
  const ext = path.extname(file).toLowerCase();
  if (SKIP_EXT.has(ext)) return false;
  if (!COMPRESSIBLE.has(ext)) return false;
  // Never compress the precompressed siblings again.
  if (file.endsWith('.gz') || file.endsWith('.br')) return false;
  const st = statSync(file);
  return st.size >= MIN_BYTES;
}

async function writeGzip(src, dest) {
  await pipeline(createReadStream(src), createGzip({ level: 9 }), createWriteStream(dest));
}

async function writeBrotli(src, dest) {
  await pipeline(
    createReadStream(src),
    createBrotliCompress({
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 11,
        [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
      },
    }),
    createWriteStream(dest),
  );
}

async function main() {
  const dist = parseDirArg(process.argv.slice(2));
  if (!existsSync(dist)) {
    console.error(`[precompress] missing ${path.relative(root, dist)} — build first`);
    process.exit(2);
  }

  const files = walk(dist).filter(shouldCompress);
  let wrote = 0;
  let skipped = 0;

  for (const file of files) {
    const gz = `${file}.gz`;
    const br = `${file}.br`;
    const raw = statSync(file).size;

    try {
      await writeGzip(file, gz);
      await writeBrotli(file, br);
      const gzSize = statSync(gz).size;
      const brSize = statSync(br).size;
      // If compressed is larger (tiny/uncompressible), drop the sibling.
      if (gzSize >= raw) {
        unlinkSync(gz);
        skipped += 1;
      } else {
        wrote += 1;
      }
      if (brSize >= raw) {
        unlinkSync(br);
        skipped += 1;
      } else {
        wrote += 1;
      }
    } catch (e) {
      console.error(`[precompress] failed ${path.relative(root, file)}:`, e);
      process.exit(2);
    }
  }

  console.log(
    `[precompress] ${path.relative(root, dist)}: ${files.length} sources → ` +
      `${wrote} siblings written` +
      (skipped ? `, ${skipped} dropped (no savings)` : ''),
  );
}

main().catch((e) => {
  console.error('[precompress]', e);
  process.exit(2);
});
