/**
 * The arithmetic behind the Markets view, kept apart from the drawing so it can be checked: the
 * 10-year a note was valued with, how far it has moved since, and the 2s10s spread. Rates are in
 * percent, as the Treasury reports them; differences are in percentage points.
 */

/** One business day of Treasury yields (`YieldPointWire`): any series may be missing that day. */
export type YieldPoint = {
  date: string;
  t3m: number | null;
  t2y: number | null;
  t5y: number | null;
  t10y: number | null;
  t30y: number | null;
  real10y: number | null;
};

/** A valuation is flagged once the 10-year has moved this far from the rate it was built on. */
export const DRIFT_FLAG_POINTS = 0.25;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The 10-year on `date`, or on the last business day before it (a note priced on a bond holiday
 *  used the rate from the day before). `daily` is oldest first. */
export function tenYearOn(
  daily: YieldPoint[],
  date: string,
): { date: string; value: number } | null {
  let found: { date: string; value: number } | null = null;
  for (const p of daily) {
    if (p.date > date) break;
    if (p.t10y !== null) found = { date: p.date, value: p.t10y };
  }
  return found;
}

/** 10-year less 2-year, in points, on every day both were published. */
export function spread2s10s(daily: YieldPoint[]): { date: string; value: number }[] {
  return daily
    .filter((p) => p.t2y !== null && p.t10y !== null)
    .map((p) => ({ date: p.date, value: round2((p.t10y as number) - (p.t2y as number)) }));
}

export type NoteRate = {
  ticker: string;
  priced: string;
  used: { date: string; value: number } | null;
  drift: number | null;
  flagged: boolean;
};

/** Each note's discount-rate anchor: the 10-year on its price date, today's, and whether the gap
 *  has reached the flag. A note whose rate can't be found is reported, never flagged. */
export function noteRates(
  daily: YieldPoint[],
  latest: number,
  notes: { ticker: string; priced: string }[],
): NoteRate[] {
  return notes.map(({ ticker, priced }) => {
    const used = tenYearOn(daily, priced);
    const drift = used ? round2(latest - used.value) : null;
    return {
      ticker,
      priced,
      used,
      drift,
      flagged: drift !== null && Math.abs(drift) >= DRIFT_FLAG_POINTS,
    };
  });
}

/**
 * The part of the markets answer's `detail` that is about one source, or null when that source
 * answered this cycle. The API joins one sentence per source that failed
 * (apps/api/src/services/public_data/cache.rs `note`: "U.S. Treasury did not answer at 14:10 UTC;
 * showing data fetched at 08:10 UTC."), naming each by its source constant: "U.S. Treasury", "CFTC",
 * "Liquidity". A source with a sentence and data on the page is showing its last good copy.
 */
export function sourceNote(detail: string | null | undefined, source: string): string | null {
  if (!detail) return null;
  const start = `${source} did not answer`;
  const at = detail.indexOf(start);
  // Only at a sentence start: "Treasury Daily Treasury Statement" must not match "U.S. Treasury".
  if (at < 0 || (at > 0 && detail.slice(at - 2, at) !== '. ')) return null;
  const end = detail.indexOf('.', detail.indexOf(' UTC', at) + 4);
  return detail.slice(at, end < 0 ? undefined : end + 1);
}

/**
 * Whether a markets section is showing a last good copy. The API's per-section `source_state`
 * decides when it is present (lane 5, 2026-10-15: it alone knows whether the copy came from this
 * cycle's fetch); an API from before that field falls back to matching its sentence (sourceNote).
 */
export function servingLastGood(
  sourceState: string | null | undefined,
  detail: string | null | undefined,
  source: string,
): boolean {
  if (sourceState != null) return sourceState === 'last_good';
  return sourceNote(detail, source) != null;
}
