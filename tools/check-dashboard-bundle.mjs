#!/usr/bin/env node
/**
 * Bundle budget gate for @convexa/dashboard production dist (§3.8).
 *
 * **Primary metric: Brotli (quality 11)** — what modern browsers get from Cloudflare
 * Pages / most CDNs when Accept-Encoding includes `br`. Gzip is still reported for
 * comparison and legacy clients, but gates fail on brotli overruns.
 *
 * Requires a prior production build:
 *   nx build @convexa/dashboard --configuration=production
 *
 * Usage:
 *   node tools/check-dashboard-bundle.mjs
 *   npm run check:bundle
 *   nx run @convexa/dashboard:check-bundle
 *
 * Flags:
 *   --json     machine-readable summary (raw / gzip / brotli)
 *   --list     every .js asset with raw / gzip / brotli KB (no fail)
 */
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { constants, createBrotliCompress, createGzip } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = path.join(root, 'apps', 'dashboard', 'dist', 'assets');

/** @typedef {{ name: string; maxBrotliKb: number; match: (file: string) => boolean }} Budget */

/**
 * Hard **brotli** budgets (KB, quality 11). Calibrated 2026-08-10 after Phase B.
 *
 * Observed brotli (approx): mui 86 · LineChart 82 · react 47 · Ticker 35 · Positions 26 ·
 * index 11 · router 12 · Scanner 9. Caps leave headroom for dep bumps.
 *
 * Gzip remains ~12–17% larger on these assets; we print it but do not gate on it.
 */
const BUDGETS = /** @type {Budget[]} */ ([
  {
    name: 'entry-index',
    maxBrotliKb: 22,
    match: (f) => /^index-.*\.js$/i.test(f),
  },
  {
    name: 'vendor-react',
    maxBrotliKb: 60,
    match: (f) => /^react-.*\.js$/i.test(f),
  },
  {
    name: 'vendor-mui',
    maxBrotliKb: 110,
    match: (f) => /^mui-.*\.js$/i.test(f),
  },
  {
    name: 'vendor-router',
    maxBrotliKb: 20,
    match: (f) => /^router-.*\.js$/i.test(f),
  },
  {
    name: 'vendor-charts',
    maxBrotliKb: 110,
    match: (f) =>
      /^charts-.*\.js$/i.test(f) ||
      /^LineChart-.*\.js$/i.test(f) ||
      /^BarChart-.*\.js$/i.test(f) ||
      /^recharts/i.test(f),
  },
  {
    name: 'vendor-misc',
    maxBrotliKb: 35,
    match: (f) => /^vendor-.*\.js$/i.test(f),
  },
  {
    name: 'route-ticker',
    maxBrotliKb: 50,
    match: (f) => /TickerDashboard/i.test(f),
  },
  {
    name: 'route-positions',
    maxBrotliKb: 40,
    match: (f) => /PositionsPage/i.test(f),
  },
  {
    name: 'route-scanner',
    maxBrotliKb: 16,
    match: (f) => /Scanner/i.test(f) && f.endsWith('.js'),
  },
  {
    name: 'any-js-asset',
    maxBrotliKb: 120,
    match: (f) => f.endsWith('.js') && !f.endsWith('.map.js'),
  },
]);

/**
 * @param {string} filePath
 * @param {'gzip' | 'brotli'} kind
 */
async function compressedSize(filePath, kind) {
  let total = 0;
  const sink = new Writable({
    write(chunk, _enc, cb) {
      total += chunk.length;
      cb();
    },
  });
  const transform =
    kind === 'gzip'
      ? createGzip({ level: 9 })
      : createBrotliCompress({
          params: {
            // Max quality ≈ static CDN / precompress best case (CF serves strong br for assets).
            [constants.BROTLI_PARAM_QUALITY]: 11,
          },
        });
  await pipeline(createReadStream(filePath), transform, sink);
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

  /** @type {{ file: string; brotliKb: number; gzipKb: number; rawKb: number }[]} */
  const measured = [];
  for (const file of files) {
    const full = path.join(assetsDir, file);
    const raw = statSync(full).size;
    const [gz, br] = await Promise.all([
      compressedSize(full, 'gzip'),
      compressedSize(full, 'brotli'),
    ]);
    measured.push({ file, brotliKb: kb(br), gzipKb: kb(gz), rawKb: kb(raw) });
  }
  measured.sort((a, b) => b.brotliKb - a.brotliKb);

  if (listOnly || asJson) {
    if (asJson) {
      console.log(
        JSON.stringify(
          {
            metric: 'brotli-q11',
            assets: measured,
            budgets: BUDGETS.map((b) => ({ name: b.name, maxBrotliKb: b.maxBrotliKb })),
          },
          null,
          2,
        ),
      );
    } else {
      console.log('file\trawKB\tgzipKB\tbrotliKB\tvsGzip%');
      for (const m of measured) {
        const vs = m.gzipKb > 0 ? (((m.gzipKb - m.brotliKb) / m.gzipKb) * 100).toFixed(1) : '0';
        console.log(`${m.file}\t${m.rawKb}\t${m.gzipKb}\t${m.brotliKb}\t${vs}%`);
      }
    }
    if (listOnly) process.exit(0);
  }

  /** @type {{ budget: string; file: string; brotliKb: number; maxBrotliKb: number }[]} */
  const failures = [];
  /** @type {{ budget: string; file: string; brotliKb: number; maxBrotliKb: number }[]} */
  const passes = [];

  for (const budget of BUDGETS) {
    if (budget.name === 'any-js-asset') {
      for (const m of measured) {
        const row = {
          budget: budget.name,
          file: m.file,
          brotliKb: m.brotliKb,
          maxBrotliKb: budget.maxBrotliKb,
        };
        if (m.brotliKb > budget.maxBrotliKb) failures.push(row);
        else passes.push(row);
      }
      continue;
    }

    const hits = measured.filter((m) => budget.match(m.file));
    if (hits.length === 0) {
      if (!asJson) {
        console.log(`[check-bundle] skip ${budget.name}: no matching asset (ok if inlined)`);
      }
      continue;
    }
    for (const m of hits) {
      const row = {
        budget: budget.name,
        file: m.file,
        brotliKb: m.brotliKb,
        maxBrotliKb: budget.maxBrotliKb,
      };
      if (m.brotliKb > budget.maxBrotliKb) failures.push(row);
      else passes.push(row);
    }
  }

  // Phase B invariant: Positions route must not pull the recharts graph (SVG sparklines).
  const posFiles = measured.filter((m) => /PositionsPage/i.test(m.file));
  for (const m of posFiles) {
    const raw = readFileSync(path.join(assetsDir, m.file), 'utf8');
    if (/from"\.\/(?:charts-|LineChart-|BarChart-)/.test(raw) || /recharts/.test(raw)) {
      failures.push({
        budget: 'positions-no-charts',
        file: m.file,
        brotliKb: m.brotliKb,
        maxBrotliKb: 0,
      });
    }
  }

  if (!asJson) {
    console.log('[check-bundle] metric: brotli q11 (gzip shown for comparison)');
    console.log('  brotli   gzip   file');
    for (const m of measured.slice(0, 12)) {
      console.log(
        `  ${m.brotliKb.toString().padStart(6)}  ${m.gzipKb.toString().padStart(6)}  ${m.file}`,
      );
    }
    const top = measured[0];
    if (top && top.gzipKb > 0) {
      const save = (((top.gzipKb - top.brotliKb) / top.gzipKb) * 100).toFixed(1);
      console.log(
        `\n[check-bundle] top asset brotli vs gzip: −${save}% (${top.gzipKb} → ${top.brotliKb} KB on ${top.file})`,
      );
    }
    console.log('');
    if (failures.length === 0) {
      console.log(
        `[check-bundle] OK — ${passes.length} brotli checks within budget (${files.length} js assets)`,
      );
      if (posFiles.length)
        console.log('[check-bundle] OK — PositionsPage has no charts dependency');
    } else {
      console.error('[check-bundle] FAILED budgets (brotli KB):');
      for (const f of failures) {
        if (f.budget === 'positions-no-charts') {
          console.error(`  positions-no-charts: ${f.file} still imports recharts/charts chunk`);
        } else {
          console.error(`  ${f.budget}: ${f.file} = ${f.brotliKb} KB br > ${f.maxBrotliKb} KB cap`);
        }
      }
      console.error('\nSee docs/FRONTEND_PERFORMANCE_ANALYSIS.md §3.8 / npm run analyze:dashboard');
    }
  } else if (!listOnly) {
    console.log(
      JSON.stringify(
        { ok: failures.length === 0, metric: 'brotli-q11', failures, passes, assets: measured },
        null,
        2,
      ),
    );
  }

  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('[check-bundle]', e);
  process.exit(2);
});
