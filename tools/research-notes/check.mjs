#!/usr/bin/env node
// `npm run research:check`: parse every note under research/ and list each problem with its file and
// line. Exit 1 on any problem. The pre-push hook runs it, so a malformed note is caught before the
// Cloudflare build would fail on it. It never reads the clock: freshness is the reader's browser's job
// and `research:due`'s, so a push can't fail just because a day went by.
//
// `--values <TICKER>` also prints what the ticker's latest valuation computes.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatErrors, loadNotes } from './notes.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { notes, errors } = loadNotes(path.join(root, 'research'), root);
if (errors.length) {
  console.error(`research: ${errors.length} problem(s)\n${formatErrors(errors)}`);
  process.exit(1);
}
const tickers = new Set(notes.map((n) => n.ticker)).size;
console.log(`research: ${notes.length} note(s) across ${tickers} ticker(s), all valid`);

const at = process.argv.indexOf('--values');
if (at !== -1) {
  const ticker = (process.argv[at + 1] ?? '').toUpperCase();
  const note = notes.find((n) => n.ticker === ticker);
  const valuation =
    note &&
    [
      ...note.lead,
      ...note.parts.flatMap((p) => [...p.intro, ...p.sections.flatMap((s) => s.blocks)]),
    ].find((b) => b.type === 'valuation');
  if (!valuation) {
    console.error(`research: no valuation for ${ticker || '(no ticker given)'}`);
    process.exit(1);
  }
  const r = valuation.result;
  const money = (v) => `$${v.toFixed(2)}`;
  const pct = (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
  console.log(
    `\n${ticker} · ${note.slug} · price ${money(valuation.price.value)} @ ${valuation.price.asOf}`,
  );
  for (const [name, s] of Object.entries(r.scenarios))
    console.log(
      `  ${name.padEnd(5)} ${money(s.value).padStart(10)}  ${pct(s.vsPrice).padStart(8)} vs price  (going concern ${money(s.goingConcern)})`,
    );
  if (r.weighted)
    console.log(
      `  weighted ${money(r.weighted.value).padStart(7)}  ${pct(r.weighted.vsPrice).padStart(8)} vs price`,
    );
  const i = r.implied;
  console.log(
    `  implied growth ${i.growth === null ? `none in range (${i.bound})` : `${i.growth.toFixed(1)}%/yr, ${i.growthYears}`}` +
      ` · EV $${Math.round(i.ev).toLocaleString('en-US')}M · EV/revenue ${i.evToRevenue.toFixed(1)}×` +
      ` · steady-state ${i.steadyStateShare.toFixed(0)}% of price`,
  );
  if (r.sensitivity) {
    const s = r.sensitivity;
    console.log(`  sensitivity: ${s.row.key} (rows) × ${s.col.key} (columns)`);
    console.log(`  ${''.padEnd(8)}${s.col.labels.map((l) => l.padStart(10)).join('')}`);
    s.cells.forEach((row, ri) =>
      console.log(
        `  ${s.row.labels[ri].padEnd(8)}${row.map((c) => money(c.value).padStart(10)).join('')}`,
      ),
    );
  }
}
