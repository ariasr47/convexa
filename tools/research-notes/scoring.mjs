// Scoring the forecast ledger: how good the calls in the notes turn out to be. A forecast counts only
// when it carried a probability AND resolved yes or no; a void one, an open one, or one whose
// probability was never written is counted but never scored, because scoring a call after the answer
// is known would be fiction. The Brier score is the mean squared miss: always answering 50% scores
// 0.25, a perfect record 0, and lower is better.
//
// ONE implementation, re-exported to the dashboard's Scorecard through `virtual:convexa-research`.

/**
 * @typedef {{ p: number | null, outcome: 'yes' | 'no' | 'void' | null }} Scorable
 * @typedef {{ lo: number, hi: number, n: number, meanP: number, hitRate: number }} CalibrationBin
 * @typedef {{ total: number, open: number, withProbability: number, resolved: number, scored: number,
 *   brier: number | null, bins: CalibrationBin[] }} Score
 */

/**
 * @param {Scorable[]} forecasts
 * @param {{ bins?: number }} [options] calibration buckets across 0–1 (default tenths)
 * @returns {Score}
 */
export function scoreForecasts(forecasts, { bins = 10 } = {}) {
  let open = 0;
  let withProbability = 0;
  let resolved = 0;
  let scored = 0;
  let squaredMiss = 0;
  const buckets = Array.from({ length: bins }, (_, i) => ({
    lo: i / bins,
    hi: (i + 1) / bins,
    n: 0,
    sumP: 0,
    hits: 0,
  }));
  for (const f of forecasts) {
    if (f.p !== null) withProbability += 1;
    if (f.outcome === null) {
      open += 1;
      continue;
    }
    resolved += 1;
    if (f.p === null || f.outcome === 'void') continue;
    const hit = f.outcome === 'yes' ? 1 : 0;
    squaredMiss += (f.p - hit) ** 2;
    scored += 1;
    // A probability of exactly 1 belongs in the top bucket, not one past it.
    const b = buckets[Math.min(bins - 1, Math.floor(f.p * bins))];
    b.n += 1;
    b.sumP += f.p;
    b.hits += hit;
  }
  return {
    total: forecasts.length,
    open,
    withProbability,
    resolved,
    scored,
    brier: scored ? squaredMiss / scored : null,
    bins: buckets
      .filter((b) => b.n > 0)
      .map((b) => ({ lo: b.lo, hi: b.hi, n: b.n, meanP: b.sumP / b.n, hitRate: b.hits / b.n })),
  };
}
