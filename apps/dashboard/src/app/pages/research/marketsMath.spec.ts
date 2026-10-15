// The Markets view tells a reader whether a note's discount rate is stale: the 10-year it was valued
// with against today's. A wrong lookup or flag is silent and misleads, so each rule is pinned:
// holidays fall back to the day before, missing series are skipped, and the flag fires at ±0.25.
import { describe, expect, it } from 'vitest';
import {
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
