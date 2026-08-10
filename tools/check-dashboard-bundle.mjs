#!/usr/bin/env node
/**
 * Gzip bundle budget gate for @convexa/dashboard production dist (§3.8 Phase A).
 *
 * Requires a prior production build:
 *   nx build @convexa/dashboard --configuration=production
 *
 * Usage:
 *   node tools/check-dashboard-bundle.mjs
 *   npm run check:bundle
 *   nx run @convexa/dashboard:check-bundle
 *
 * Budgets are gzip KB of hashed assets under apps/dashboard/dist/assets.
 * Calibrated 2026-08-10 from a clean prod build; tighten in Phase B after sparkline diet.
 *
 * Flags:
 *   --json     print machine-readable summary
 *   --list     list every .js asset with gzip KB (no fail)
 */
import { createGzip } from 'node:zlib';
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = path.join(root, 'apps', 'dashboard', 'dist', 'assets');

/** @typedef {{ name: string; maxGzipKb: number; match: (file: string) => boolean }} Budget */

/**
 * Hard gzip budgets (KB). Calibrated 2026-08-10 from a clean
 * `vite build --mode production` (Rolldown manualChunks: react/mui/router/charts).
 *
 * Observed baseline (gzip KB, approx): index 13 · react 54 · mui 100 · charts 108 ·
 * router 14 · Ticker 34 · Positions 30 · Scanner 10. Caps leave ~30–50% headroom for
 * dep bumps; Phase B (SVG sparklines) should lower vendor-charts + route-positions.
 *
 * Matching is on the asset file name (`index-*.js`, `mui-*.js`, …).
 */
const BUDGETS = /** @type {Budget[]} */ ([
  {
    name: 'entry-index',
    maxGzipKb: 30,
    match: (f) => /^index-.*\.js$/i.test(f),
  },
  {
    name: 'vendor-react',
    maxGzipKb: 70,
    match: (f) => /^react-.*\.js$/i.test(f),
  },
  {
    name: 'vendor-mui',
    maxGzipKb: 130,
    match: (f) => /^mui-.*\.js$/i.test(f),
  },
  {
    name: 'vendor-router',
    maxGzipKb: 25,
    match: (f) => /^router-.*\.js$/i.test(f),
  },
  {
    name: 'vendor-charts',
    maxGzipKb: 150,
    match: (f) => /^charts-.*\.js$/i.test(f) || /^LineChart-.*\.js$/i.test(f),
  },
  {
    name: 'vendor-misc',
    maxGzipKb: 40,
    match: (f) => /^vendor-.*\.js$/i.test(f),
  },
  {
    name: 'route-ticker',
    maxGzipKb: 55,
    match: (f) => /TickerDashboard/i.test(f),
  },
  {
    name: 'route-positions',
    maxGzipKb: 50,
    match: (f) => /PositionsPage/i.test(f),
  },
  {
    name: 'route-scanner',
    maxGzipKb: 20,
    match: (f) => /Scanner/i.test(f) && f.endsWith('.js'),
  },
  {
    // Catch any single JS asset that balloons without a named budget.
    name: 'any-js-asset',
    maxGzipKb: 160,
    match: (f) => f.endsWith('.js') && !f.endsWith('.map.js'),
  },
]);

async function gzipSize(filePath) {
  let total = 0;
  const sink = new Writable({
    write(chunk, _enc, cb) {
      total += chunk.length;
      cb();
    },
  });
  await pipeline(createReadStream(filePath), createGzip({ level: 9 }), sink);
  return total;
}

function kb(bytes) {
  return Math.round((bytes / 1024) * 10) / 10;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const asJson = args.has('--json');
  const listOnly = args.has('--list');

  if (!existsSync(assetsDir)) {
    console.error(
      `[check-bundle] missing ${path.relative(root, assetsDir)} — run a production build first:\n` +
        `  npx nx build @convexa/dashboard --configuration=production`,
    );
    process.exit(2);
  }

  const files = readdirSync(assetsDir).filter((f) => f.endsWith('.js') && !f.endsWith('.map'));
  if (files.length === 0) {
    console.error('[check-bundle] no .js assets in dist/assets');
    process.exit(2);
  }

  /** @type {{ file: string; gzipKb: number; rawKb: number }[]} */
  const measured = [];
  for (const file of files) {
    const full = path.join(assetsDir, file);
    const raw = statSync(full).size;
    const gz = await gzipSize(full);
    measured.push({ file, gzipKb: kb(gz), rawKb: kb(raw) });
  }
  measured.sort((a, b) => b.gzipKb - a.gzipKb);

  if (listOnly || asJson) {
    if (asJson) {
      console.log(JSON.stringify({ assets: measured, budgets: BUDGETS.map((b) => b.name) }, null, 2));
    } else {
      console.log('file\trawKB\tgzipKB');
      for (const m of measured) {
        console.log(`${m.file}\t${m.rawKb}\t${m.gzipKb}`);
      }
    }
    if (listOnly) process.exit(0);
  }

  /** @type {{ budget: string; file: string; gzipKb: number; maxGzipKb: number }[]} */
  const failures = [];
  /** @type {{ budget: string; file: string; gzipKb: number; maxGzipKb: number }[]} */
  const passes = [];

  for (const budget of BUDGETS) {
    if (budget.name === 'any-js-asset') {
      for (const m of measured) {
        if (m.gzipKb > budget.maxGzipKb) {
          failures.push({
            budget: budget.name,
            file: m.file,
            gzipKb: m.gzipKb,
            maxGzipKb: budget.maxGzipKb,
          });
        } else {
          passes.push({
            budget: budget.name,
            file: m.file,
            gzipKb: m.gzipKb,
            maxGzipKb: budget.maxGzipKb,
          });
        }
      }
      continue;
    }

    const hits = measured.filter((m) => budget.match(m.file));
    if (hits.length === 0) {
      // Named vendor chunks may be inlined into index under some Rolldown graphs — skip missing.
      if (!asJson) {
        console.log(`[check-bundle] skip ${budget.name}: no matching asset (ok if inlined)`);
      }
      continue;
    }
    for (const m of hits) {
      const row = {
        budget: budget.name,
        file: m.file,
        gzipKb: m.gzipKb,
        maxGzipKb: budget.maxGzipKb,
      };
      if (m.gzipKb > budget.maxGzipKb) failures.push(row);
      else passes.push(row);
    }
  }

  if (!asJson) {
    console.log('[check-bundle] top assets (gzip KB):');
    for (const m of measured.slice(0, 12)) {
      console.log(`  ${m.gzipKb.toString().padStart(6)}  ${m.file}`);
    }
    console.log('');
    if (failures.length === 0) {
      console.log(`[check-bundle] OK — ${passes.length} checks within budget (${files.length} js assets)`);
    } else {
      console.error('[check-bundle] FAILED budgets:');
      for (const f of failures) {
        console.error(
          `  ${f.budget}: ${f.file} = ${f.gzipKb} KB gzip > ${f.maxGzipKb} KB cap`,
        );
      }
      console.error(
        '\nSee docs/FRONTEND_PERFORMANCE_ANALYSIS.md §3.8 / npm run analyze:dashboard',
      );
    }
  } else if (!listOnly) {
    console.log(JSON.stringify({ ok: failures.length === 0, failures, passes, assets: measured }, null, 2));
  }

  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('[check-bundle]', e);
  process.exit(2);
});
