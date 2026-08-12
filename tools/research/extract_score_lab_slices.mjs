/**
 * ONE-SHOT extraction of the two score-lab fixture slices.
 *
 * SLICE A — `slice_2026-08-10`: the 221 PRE-CAPTURE-SPINE rows the deep dive measured. Captured
 *   before `13656ad` landed, so they carry score + geometry and NOTHING else. Their job is pinning
 *   reproduction of the published figures. Membership is defined by the outcomes artifact's own
 *   (symbol, as_of) key set — not "whatever is in the store today" — which makes it self-checking.
 *
 * SLICE B — `slice_current`: the FULLY POPULATED rows captured after the spine landed. Their job is
 *   letting IDENTITY 3 / COMPOSITION / basis_mix / AC-78 bite on real data instead of only on
 *   hand-built input. Membership is "every row for the three symbols that is NOT in slice A".
 *
 * Inputs are gitignored (`/data/`), so this cannot be re-run by a reviewer. It is committed so the
 * extraction is READABLE, and each PROVENANCE.md records what it produced.
 *
 *   node tools/research/extract_score_lab_slices.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const STORE = `${ROOT}data/scan.json`;
const OUTCOMES_IN = `${ROOT}data/research/outcomes_20260811T193619Z.json`;
const REPORT_IN = `${ROOT}data/research/score_lab_1d_20260811T193620Z.json`;
const OUT_A = `${ROOT}apps/api/tests/fixtures/research/slice_2026-08-10`;
const OUT_B = `${ROOT}apps/api/tests/fixtures/research/slice_current`;
const SYMBOLS = ['SPY', 'QQQ', 'IWM'];

/** Millisecond bucket — mirrors `score_lab.rs::as_of_key` exactly. */
const key = (symbol, asOf) => `${String(symbol).trim().toUpperCase()}|${Math.round(asOf * 1000)}`;
const bySymbolCount = (rows) => {
  const m = {};
  for (const r of rows) {
    const k = r.symbol.toUpperCase();
    m[k] = (m[k] ?? 0) + 1;
  }
  return m;
};
/** Population census — the number this plan's fixture map depends on. Never assume it; measure it. */
const census = (rows) => ({
  n: rows.length,
  score: rows.filter((s) => s.score != null).length,
  score_drivers: rows.filter((s) => s.score_drivers != null).length,
  net_gex: rows.filter((s) => s.net_gex != null).length,
  atm_iv: rows.filter((s) => s.atm_iv != null).length,
  hv_30d: rows.filter((s) => s.hv_30d != null).length,
  hv_only: rows.filter((s) => s.hv_30d != null && s.atm_iv == null).length,
});

// ---- SLICE A ----------------------------------------------------------------------------------
const outcomesA = JSON.parse(readFileSync(OUTCOMES_IN, 'utf8')).outcomes.filter(
  (o) => String(o.horizon).trim().toLowerCase() === '1d',
);
const wantedA = new Set(outcomesA.map((o) => key(o.symbol, o.as_of)));

const history = JSON.parse(readFileSync(STORE, 'utf8')).history ?? {};
const allForSymbols = [];
for (const [sym, series] of Object.entries(history)) {
  if (!SYMBOLS.includes(sym.toUpperCase())) continue;
  for (const s of series) allForSymbols.push(s);
}

const samplesA = allForSymbols.filter((s) => wantedA.has(key(s.symbol, s.as_of)));
const foundA = new Set(samplesA.map((s) => key(s.symbol, s.as_of)));
const missing = [...wantedA].filter((k) => !foundA.has(k));
if (missing.length > 0) {
  throw new Error(
    `SLICE A incomplete: ${missing.length} of ${wantedA.size} rows are no longer in the store ` +
      `(ring eviction — the ~2-day deadline was missed). STOP and pull from the prod history ` +
      `endpoint instead. First missing: ${missing[0]}`,
  );
}
if (samplesA.length !== outcomesA.length) {
  throw new Error(
    `duplicate (symbol, as_of): ${samplesA.length} samples for ${outcomesA.length} outcomes`,
  );
}

// ---- SLICE B ----------------------------------------------------------------------------------
const samplesB = allForSymbols.filter((s) => !wantedA.has(key(s.symbol, s.as_of)));
if (samplesB.length === 0) {
  throw new Error(
    'SLICE B empty — no post-spine rows found. Do not proceed without measuring why.',
  );
}

// NOTE: `outcomesA` is deliberately left in the SOURCE FILE's original order (not re-sorted).
// `pair_samples_outcomes` builds rows by iterating `outcomes` (not `samples`), so pearson's
// running-sum floating-point accumulation is order-sensitive — sorting here would silently
// change the last few bits of `score_vs_abs_move.pearson` relative to the pinned pre-feature
// oracle (measured: sorting shifted `pearson` from -0.021586482599806937 to
// -0.021586482599807014, an exact-equality test failure). Sample order does not affect
// correctness (samples are indexed into a HashMap keyed by (symbol, as_of ms)), so those two
// arrays are sorted for readability only.
const sortRows = (a, b) => a.symbol.localeCompare(b.symbol) || a.as_of - b.as_of;
samplesA.sort(sortRows);
samplesB.sort(sortRows);

mkdirSync(OUT_A, { recursive: true });
mkdirSync(OUT_B, { recursive: true });
writeFileSync(`${OUT_A}/samples.json`, JSON.stringify(samplesA));
writeFileSync(`${OUT_A}/outcomes.json`, JSON.stringify(outcomesA));
writeFileSync(`${OUT_A}/pre_feature_report.json`, readFileSync(REPORT_IN, 'utf8'));
writeFileSync(`${OUT_B}/samples.json`, JSON.stringify(samplesB));

console.log(
  JSON.stringify(
    {
      slice_a: {
        bySymbol: bySymbolCount(samplesA),
        census: census(samplesA),
        outcomes: outcomesA.length,
      },
      slice_b: { bySymbol: bySymbolCount(samplesB), census: census(samplesB) },
    },
    null,
    2,
  ),
);
