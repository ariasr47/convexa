/**
 * Convexa — cross-ticker mark contamination audit, run against an EXPORTED ARCHIVE.
 * =================================================================================
 * Companion to `cross-ticker-audit.js` (which runs in the browser console). This one reads the
 * file produced by the app's own **Export archive** button on /positions — no console, no pasting.
 *
 *   node docs/diagnostics/audit-archive.mjs "C:/Users/<you>/Downloads/convexa-archive-YYYY-MM-DD.json"
 *
 * WHY: `usePortfolio`/`useBrokerMarks` price EQUITY legs off the FOCUSED ticker's bundle price
 * rather than the leg's own `ticker` (confirmed + DOM-reproduced 2026-08-03). Those marks were
 * persisted into `realized_pl_dollar` on close and into every DecisionRecord's
 * `mark_price`/`pl_dollar`/`underlying_spot` — which feed the outcome ledger. A code fix corrects
 * future numbers only; this measures what is already on disk.
 *
 * READ-ONLY. Prints a report; writes nothing.
 */
import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) {
  console.error('usage: node docs/diagnostics/audit-archive.mjs <convexa-archive-*.json>');
  process.exit(2);
}

let env;
try {
  env = JSON.parse(readFileSync(path, 'utf8'));
} catch (e) {
  console.error(`Could not read/parse ${path}: ${e.message}`);
  process.exit(1);
}

const posStore = env?.stores?.positions ?? {};
const positions = Object.values(posStore.positions ?? {});
const decisions = Array.isArray(posStore.decisions) ? posStore.decisions : [];

const legsOf = (p) => (Array.isArray(p?.legs) ? p.legs : []);
const isEquity = (l) => l?.kind === 'equity';
const isClosed = (p) => p?.status === 'closed' || !!p?.close_time;

const tickers = new Set(positions.flatMap((p) => legsOf(p).map((l) => l?.ticker).filter(Boolean)));
const closed = positions.filter(isClosed);
const closedEquity = closed.filter((p) => legsOf(p).some(isEquity));
const openEquity = positions.filter((p) => !isClosed(p) && legsOf(p).some(isEquity));

// --- THE PROOF: one underlying_spot shared by two different tickers -------------------------
// Can only happen if both records took the same (focused) bundle's spot.
const bySpot = new Map();
for (const d of decisions) {
  const t = d?.contract?.ticker;
  const s = d?.underlying_spot;
  if (!t || typeof s !== 'number' || !Number.isFinite(s)) continue;
  const k = s.toFixed(4);
  if (!bySpot.has(k)) bySpot.set(k, new Map());
  bySpot.get(k).set(t, (bySpot.get(k).get(t) ?? 0) + 1);
}
const collisions = [...bySpot.entries()]
  .filter(([, m]) => m.size > 1)
  .map(([spot, m]) => ({ underlying_spot: Number(spot), tickers: [...m.keys()].join(', '), records: [...m.values()].reduce((a, b) => a + b, 0) }))
  .sort((a, b) => b.records - a.records);

// --- HEURISTIC: implausible implied exit on a closed single-equity position ------------------
const suspect = [];
for (const p of closedEquity) {
  const eq = legsOf(p).filter(isEquity);
  if (eq.length !== 1 || typeof p.realized_pl_dollar !== 'number') continue;
  const l = eq[0];
  const denom = (Number(l.qty) || 0) * (Number(l.multiplier) || 1);
  const entry = Number(l.entry_price);
  if (!denom || !entry) continue;
  const impliedExit = entry + p.realized_pl_dollar / denom;
  const movePct = Math.abs(impliedExit / entry - 1) * 100;
  if (movePct > 40) {
    suspect.push({
      ticker: l.ticker, entry: +entry.toFixed(2), impliedExit: +impliedExit.toFixed(2),
      movePct: +movePct.toFixed(1), realized: +p.realized_pl_dollar.toFixed(2),
      closed: p.close_time || '(none)',
    });
  }
}

// --- report ---------------------------------------------------------------------------------
const rule = '─'.repeat(64);
console.log(`\n${rule}\n CONVEXA — cross-ticker contamination audit\n ${path}\n exported_at: ${env?.exported_at ?? '(unknown)'}\n${rule}`);
console.log(`Distinct tickers      : ${tickers.size}  [${[...tickers].join(', ') || '—'}]`);
console.log(`Positions total       : ${positions.length}   (closed: ${closed.length})`);
console.log(`Decision records      : ${decisions.length}`);
console.log(`Orders                : ${Object.keys(env?.stores?.orders?.orders ?? {}).length}`);
console.log('');
console.log('AT-RISK POPULATION (equity legs only — options are not materially affected)');
console.log(`  closed w/ equity leg : ${closedEquity.length}   <- realized P/L already persisted`);
console.log(`  open   w/ equity leg : ${openEquity.length}   <- self-corrects when the fix ships`);
console.log('');

if (tickers.size <= 1) {
  console.log('✅ SINGLE-TICKER BOOK — the bug cannot have fired here. Nothing to remediate.');
} else if (closedEquity.length === 0 && collisions.length === 0) {
  console.log('✅ NO CONTAMINATED RECORDS — multi-ticker book, but no closed equity positions');
  console.log('   and no spot collisions. Your saved history is clean.');
} else {
  console.log(`PROOF — one spot shared by 2+ tickers: ${collisions.length} case(s)`);
  if (collisions.length) console.table(collisions.slice(0, 25));
  console.log(`HEURISTIC — implausible implied move (>40%) on a closed equity position: ${suspect.length}`);
  if (suspect.length) console.table(suspect.slice(0, 25));
}
console.log('');
console.log('NOTE: which ticker was focused at write time is not stored, so per-record proof is');
console.log('limited to the collisions above. Absence of collisions is strong evidence, not a');
console.log('guarantee — a single-ticker-at-a-time workflow leaves no collision fingerprint.');
console.log(`${rule}\n`);
