import type { ScanRow, SweepHeartbeat } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import { isPlausibleTicker, matchSymbols, paletteScoreCell } from './format';

function row(over: Partial<ScanRow> = {}): ScanRow {
  return {
    symbol: 'SPY',
    status: 'ok',
    tier: 'actionable',
    score: 62,
    as_of: 1000,
    price: 500,
    chg_pct: 0.1,
    call_wall: null,
    put_wall: null,
    flip: null,
    dist_to_wall_pct: null,
    dist_to_flip_pct: null,
    regime: null,
    vol_regime: null,
    ...over,
  } as ScanRow;
}

describe('matchSymbols — P3 prefix-then-substring match on the symbol', () => {
  it('prefix matches sort before substring-only matches', () => {
    const rows = [row({ symbol: 'TSLA' }), row({ symbol: 'SPY' }), row({ symbol: 'SPX' })];
    const result = matchSymbols(rows, 'sp');
    expect(result.map((r) => r.symbol)).toEqual(['SPY', 'SPX']);
  });

  it('a substring-only match (not a prefix) still appears, after prefix matches', () => {
    const rows = [row({ symbol: 'MSPY' }), row({ symbol: 'SPY' })];
    const result = matchSymbols(rows, 'SP');
    expect(result.map((r) => r.symbol)).toEqual(['SPY', 'MSPY']);
  });

  it('an empty query returns every row unfiltered', () => {
    const rows = [row({ symbol: 'AAPL' }), row({ symbol: 'MSFT' })];
    expect(matchSymbols(rows, '')).toHaveLength(2);
    expect(matchSymbols(rows, '   ')).toHaveLength(2);
  });

  it('case-insensitive', () => {
    const rows = [row({ symbol: 'AAPL' })];
    expect(matchSymbols(rows, 'aa')).toHaveLength(1);
  });

  it('no match returns an empty array, never null/undefined', () => {
    const rows = [row({ symbol: 'AAPL' })];
    expect(matchSymbols(rows, 'ZZZZ')).toEqual([]);
  });
});

describe('isPlausibleTicker — AC-31 the "Open anyway" gate', () => {
  it('accepts 1-5 letters', () => {
    expect(isPlausibleTicker('A')).toBe(true);
    expect(isPlausibleTicker('AAPL')).toBe(true);
    expect(isPlausibleTicker('ABCDE')).toBe(true);
  });
  it('rejects 6+ letters, digits, empty, and punctuation', () => {
    expect(isPlausibleTicker('ABCDEF')).toBe(false);
    expect(isPlausibleTicker('AAP1')).toBe(false);
    expect(isPlausibleTicker('')).toBe(false);
    expect(isPlausibleTicker('AA PL')).toBe(false);
    expect(isPlausibleTicker('AA-PL')).toBe(false);
  });
});

describe('paletteScoreCell — AC-29/AC-29b: the wire status vocabulary through a closed lookup', () => {
  const NOW_S = 2000;

  it('ok renders the score, and a freshness caption never bare', () => {
    const cell = paletteScoreCell(row({ status: 'ok', score: 73, as_of: 1990 }), null, NOW_S);
    expect(cell.text).toBe('73');
    expect(cell.freshness).toBeTruthy();
  });

  it('stale renders the score WITH its sweep age beside it', () => {
    const sweep: SweepHeartbeat = { sweep_last_completed: 1900, universe_size: 500, updated_at: 1990 };
    const cell = paletteScoreCell(row({ status: 'stale', score: 55, as_of: 1990 }), sweep, NOW_S);
    expect(cell.text).toBe('55');
    expect(cell.freshness).toMatch(/stale/i);
    expect(cell.freshness).toMatch(/sweep/i);
  });

  it('building renders the bare em-dash, never a fabricated 0', () => {
    const cell = paletteScoreCell(row({ status: 'building', score: null, as_of: 1990 }), null, NOW_S);
    expect(cell.text).toBe('—');
    expect(cell.text).not.toBe('0');
  });

  it('error renders "unavailable", never blank, never 0', () => {
    const cell = paletteScoreCell(row({ status: 'error', score: null, as_of: 1990 }), null, NOW_S);
    expect(cell.text).toBe('unavailable');
  });

  it('GATE Q bounce finding 4 / [absent-is-not-none] — error with the wire epoch sentinel `as_of: 0` ' +
      'never fabricates a freshness age (projection.rs: project_error clones project_building, which ' +
      'sets as_of: 0.0 — a real `GET /api/scan` response, not a hypothetical fixture)', () => {
    const cell = paletteScoreCell(row({ status: 'error', score: null, as_of: 0 }), null, NOW_S);
    expect(cell.text).toBe('unavailable');
    // Before the fix this computed `NOW_S - 0` as a real elapsed age (e.g. "496824h ago" against a
    // real epoch `now`) — an absent timestamp must render as a member of the closed not-a-number
    // vocabulary (here: no freshness at all), never as a computed age.
    expect(cell.freshness).toBeNull();
  });

  it('the same sentinel at a REAL wall-clock `now` (not the fixture NOW_S=2000) does not fabricate a ' +
      'huge fake age — reproduces QA\'s exact observed defect shape', () => {
    const realNowS = Math.floor(Date.now() / 1000);
    const cell = paletteScoreCell(row({ status: 'error', score: null, as_of: 0 }), null, realNowS);
    expect(cell.freshness).toBeNull();
  });

  it('an unknown status degrades honestly rather than throwing', () => {
    expect(() =>
      paletteScoreCell(row({ status: 'weird' as ScanRow['status'], score: 10 }), null, NOW_S),
    ).not.toThrow();
  });
});
