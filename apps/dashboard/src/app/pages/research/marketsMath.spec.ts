// The Markets view tells a reader whether a note's discount rate is stale: the 10-year it was valued
// with against today's. A wrong lookup or flag is silent and misleads, so each rule is pinned:
// holidays fall back to the day before, missing series are skipped, and the flag fires at ±0.25.
import { describe, expect, it } from 'vitest';
import {
  curveFinding,
  curveOn,
  monthsBefore,
  noteRates,
  servingLastGood,
  sourceNote,
  spread2s10s,
  tenYearOn,
  type YieldPoint,
} from './marketsMath';

const day = (date: string, t2y: number | null, t10y: number | null): YieldPoint => ({
  date,
  t3m: null,
  t2y,
  t5y: null,
  t10y,
  t30y: null,
  real10y: null,
});
const daily = [
  day('2026-10-07', 4.77, 5.28),
  day('2026-10-08', 4.75, 5.22),
  day('2026-10-09', 4.8, 5.24),
  day('2026-10-12', null, null), // bond holiday: published empty
  day('2026-10-13', 4.9, 5.51),
];

describe('the rate a note was valued with', () => {
  it('uses the price date, or the last day before it when the market was shut', () => {
    expect(tenYearOn(daily, '2026-10-09')).toEqual({ date: '2026-10-09', value: 5.24 });
    expect(tenYearOn(daily, '2026-10-12')).toEqual({ date: '2026-10-09', value: 5.24 });
    expect(tenYearOn(daily, '2026-10-06')).toBeNull();
  });

  it('flags a valuation once the 10-year has moved a quarter point, either way', () => {
    const rows = noteRates(daily, 5.51, [
      { ticker: 'MU', priced: '2026-10-12' }, // 5.24 → +0.27: flagged
      { ticker: 'CRWV', priced: '2026-10-07' }, // 5.28 → +0.23: not yet
      { ticker: 'OLD', priced: '2026-01-01' }, // before the series: reported, never flagged
    ]);
    expect(rows.map((r) => [r.ticker, r.used?.value ?? null, r.drift, r.flagged])).toEqual([
      ['MU', 5.24, 0.27, true],
      ['CRWV', 5.28, 0.23, false],
      ['OLD', null, null, false],
    ]);
    expect(noteRates(daily, 4.99, [{ ticker: 'MU', priced: '2026-10-09' }])[0].flagged).toBe(true);
  });
});

describe('2s10s', () => {
  it('is the 10-year less the 2-year, on days both exist', () => {
    expect(spread2s10s(daily)).toEqual([
      { date: '2026-10-07', value: 0.51 },
      { date: '2026-10-08', value: 0.47 },
      { date: '2026-10-09', value: 0.44 },
      { date: '2026-10-13', value: 0.61 },
    ]);
  });
});

describe('which source a stale note is about', () => {
  // The state word for each source turns on this: an outage of one must not mark another stale.
  const detail =
    'U.S. Treasury did not answer at 14:10 UTC; showing data fetched at 08:10 UTC. Liquidity did not answer at 2026-10-14 14:10 UTC and no earlier copy is cached.';

  it('finds each source’s own sentence', () => {
    expect(sourceNote(detail, 'U.S. Treasury')).toBe(
      'U.S. Treasury did not answer at 14:10 UTC; showing data fetched at 08:10 UTC.',
    );
    expect(sourceNote(detail, 'Liquidity')).toBe(
      'Liquidity did not answer at 2026-10-14 14:10 UTC and no earlier copy is cached.',
    );
  });

  it('is null for a source that answered, and for no detail at all', () => {
    expect(sourceNote(detail, 'CFTC')).toBeNull();
    expect(sourceNote(null, 'U.S. Treasury')).toBeNull();
    expect(sourceNote('Demo sample: authored figures.', 'U.S. Treasury')).toBeNull();
  });

  it('matches a name only at a sentence start', () => {
    expect(sourceNote('X Treasury did not answer at 14:10 UTC.', 'Treasury')).toBeNull();
  });
});

describe('the curve’s title (D-11)', () => {
  const pt = (t3m: number, t2y: number, t10y: number, t30y: number | null): YieldPoint => ({
    date: '2026-10-07',
    t3m,
    t2y,
    t5y: null,
    t10y,
    t30y,
    real10y: null,
  });
  it('names a twist instead of averaging it into "rose"', () => {
    // The demo's year: 3-month 4.36 → 4.15, 30-year 4.70 → 5.41 (an average of +0.6).
    expect(curveFinding(pt(4.15, 4.6, 5.15, 5.41), pt(4.36, 3.9, 4.31, 4.7))).toBe(
      'The front end fell 0.21 points in a year while the 30-year rose 0.71: the curve steepened; the front no longer inverts',
    );
  });
  it('reads a held end, a flattening and a parallel move', () => {
    expect(curveFinding(pt(4.0, 4.1, 4.5, 4.81), pt(3.5, 3.6, 4.5, 4.8))).toBe(
      'The front end rose 0.50 points in a year while the 30-year held within 0.01: the curve flattened',
    );
    expect(curveFinding(pt(4.3, 4.4, 4.6, 4.9), pt(4.0, 4.1, 4.3, 4.6))).toBe(
      'The front end rose 0.30 points in a year while the 30-year rose 0.30: the whole curve rose in parallel',
    );
  });
  it('falls back to the 10-year without a 30-year, and is null without a year-ago curve', () => {
    expect(curveFinding(pt(4.0, 4.1, 4.6, null), pt(4.2, 4.3, 4.3, 4.8))).toBe(
      'The front end fell 0.20 points in a year while the 10-year rose 0.30: the curve steepened',
    );
    expect(curveFinding(pt(4.0, 4.1, 4.6, 4.9), null)).toBeNull();
  });
  it('finds the curve a month back, on or before the day', () => {
    expect(monthsBefore('2026-10-07', 1)).toBe('2026-09-07');
    expect(monthsBefore('2026-03-31', 1)).toBe('2026-02-28');
    expect(monthsBefore('2026-01-15', 1)).toBe('2025-12-15');
    expect(curveOn(daily, '2026-10-12')?.date).toBe('2026-10-09');
    expect(curveOn(daily, '2026-10-06')).toBeNull();
  });
});

describe('servingLastGood', () => {
  const stale = 'U.S. Treasury did not answer at 14:10 UTC; showing data fetched at 08:10 UTC.';
  it('trusts the API’s source_state over the sentence when the field is present', () => {
    expect(servingLastGood('last_good', null, 'U.S. Treasury')).toBe(true);
    expect(servingLastGood('updated', stale, 'U.S. Treasury')).toBe(false);
  });
  it('falls back to the sentence for an API from before the field', () => {
    expect(servingLastGood(undefined, stale, 'U.S. Treasury')).toBe(true);
    expect(servingLastGood(null, null, 'U.S. Treasury')).toBe(false);
  });
});
