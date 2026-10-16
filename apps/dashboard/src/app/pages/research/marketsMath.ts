/**
 * The arithmetic behind the Markets view, kept apart from the drawing so it can be checked: the
 * 10-year a note was valued with, how far it has moved since, and the 2s10s spread. Rates are in
 * percent, as the Treasury reports them; differences are in percentage points.
 */

/** One business day of Treasury yields (`YieldPointWire`): any series may be missing that day. The
 *  1-month and 1-year are absent (undefined) from an API older than 2026-10-16: read them as missing. */
export type YieldPoint = {
  date: string;
  t1m?: number | null;
  t3m: number | null;
  t1y?: number | null;
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

const DAY_MS = 86_400_000;

/**
 * A daily series laid on a weekday axis (Monday to Friday, first date to last): each weekday's
 * position, and the runs of weekdays the series has no value for, which the 2s10s chart hatches as
 * "Not published" instead of closing them up (a bond-market holiday or a day the Treasury left the
 * 2- or 10-year blank). Weekends are not days on this axis, so they are never gaps. Dates are
 * YYYY-MM-DD, oldest first, and are read as UTC days so no time zone shifts them.
 */
export function onWeekdays(dates: string[]): {
  days: string[];
  index: Map<string, number>;
  gaps: { from: number; to: number }[];
} {
  const days: string[] = [];
  const index = new Map<string, number>();
  const gaps: { from: number; to: number }[] = [];
  if (dates.length === 0) return { days, index, gaps };
  const have = new Set(dates);
  const end = Date.parse(`${dates[dates.length - 1]}T00:00:00Z`);
  for (let t = Date.parse(`${dates[0]}T00:00:00Z`); t <= end; t += DAY_MS) {
    const weekday = new Date(t).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    const day = new Date(t).toISOString().slice(0, 10);
    const i = days.length;
    days.push(day);
    index.set(day, i);
    if (have.has(day)) continue;
    const open = gaps[gaps.length - 1];
    if (open && open.to === i - 1) open.to = i;
    else gaps.push({ from: i, to: i });
  }
  return { days, index, gaps };
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

/** The curve on `date`, or on the last business day before it with a 10-year (`daily` oldest first). */
export function curveOn(daily: YieldPoint[], date: string): YieldPoint | null {
  let found: YieldPoint | null = null;
  for (const p of daily) {
    if (p.date > date) break;
    if (p.t10y !== null) found = p;
  }
  return found;
}

/** `date` less `months` calendar months (a 31st falls back to the month's last day). */
export function monthsBefore(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 - months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, last));
  return first.toISOString().slice(0, 10);
}

/** A move under this, in points, reads as "held". */
const HELD = 0.05;

/**
 * The curve chart's title: the year's change at the front end (3-month) and the long end (30-year,
 * or the 10-year when the 30-year is missing), and what that did to the slope. Averaging the
 * maturities hid a twist: the demo's 3-month fell 0.21 while its average "rose 0.6" (D-11). Null
 * when either end lacks a value a year apart.
 */
export function curveFinding(latest: YieldPoint, ago: YieldPoint | null): string | null {
  if (!ago) return null;
  const longKey = latest.t30y !== null && ago.t30y !== null ? 't30y' : 't10y';
  const change = (k: 't3m' | 't10y' | 't30y') =>
    latest[k] !== null && ago[k] !== null ? (latest[k] as number) - (ago[k] as number) : null;
  const front = change('t3m');
  const long = change(longKey);
  if (front === null || long === null) return null;
  const move = (v: number, unit = '') =>
    Math.abs(v) < HELD
      ? `held within ${Math.max(0.01, Math.abs(v)).toFixed(2)}${unit}`
      : `${v > 0 ? 'rose' : 'fell'} ${Math.abs(v).toFixed(2)}${unit}`;
  const slope = long - front;
  const shape =
    Math.abs(slope) < HELD
      ? Math.abs(front) < HELD
        ? 'the curve barely moved'
        : `the whole curve ${front > 0 ? 'rose' : 'fell'} in parallel`
      : slope > 0
        ? 'the curve steepened'
        : 'the curve flattened';
  const inverts = (p: YieldPoint) => p.t3m !== null && p.t2y !== null && p.t3m > p.t2y;
  const tail = inverts(latest)
    ? '; the front still inverts'
    : inverts(ago)
      ? '; the front no longer inverts'
      : '';
  return `The front end ${move(front, ' points')} in a year while the ${longKey === 't30y' ? '30' : '10'}-year ${move(long)}: ${shape}${tail}`;
}
