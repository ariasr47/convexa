import type { ScanRow, SweepHeartbeat } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import { isPlausibleTicker, matchNotes, matchTickers, paletteScoreCell } from './format';

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

describe('matchTickers — P3 prefix-then-substring match on the symbol', () => {
  it('ranks prefix matches before substring-only ones, case-insensitively; a blank query returns every row; no match is []', () => {
    const cases: Array<{ name: string; symbols: string[]; query: string; expected: string[] }> = [
      {
        name: 'prefix matches sort before substring-only matches',
        symbols: ['TSLA', 'SPY', 'SPX'],
        query: 'sp',
        expected: ['SPY', 'SPX'],
      },
      {
        name: 'a substring-only match (not a prefix) still appears, after prefix matches',
        symbols: ['MSPY', 'SPY'],
        query: 'SP',
        expected: ['SPY', 'MSPY'],
      },
      {
        name: 'an empty query returns every row unfiltered',
        symbols: ['AAPL', 'MSFT'],
        query: '',
        expected: ['AAPL', 'MSFT'],
      },
      {
        name: 'a whitespace-only query returns every row unfiltered',
        symbols: ['AAPL', 'MSFT'],
        query: '   ',
        expected: ['AAPL', 'MSFT'],
      },
      { name: 'case-insensitive', symbols: ['AAPL'], query: 'aa', expected: ['AAPL'] },
      {
        name: 'no match returns an empty array, never null/undefined',
        symbols: ['AAPL'],
        query: 'ZZZZ',
        expected: [],
      },
    ];
    for (const { name, symbols, query, expected } of cases) {
      const rows = symbols.map((symbol) => ({ symbol, name: null }));
      const result = matchTickers(rows, query);
      expect(Array.isArray(result), name).toBe(true);
      const got = result.map((r) => r.symbol);
      expect(got, name).toEqual(expected);
    }
  });
});

describe('matchTickers / matchNotes — names and notes come after symbols', () => {
  it('a company-name match follows every symbol match, and a one-letter query never matches names', () => {
    const rows = [
      { symbol: 'NVDA', name: 'NVIDIA' },
      { symbol: 'AMD', name: 'Advanced Micro Devices' },
      { symbol: 'VNM', name: null },
    ];
    expect(matchTickers(rows, 'nv').map((r) => r.symbol)).toEqual(['NVDA']);
    expect(matchTickers(rows, 'vn').map((r) => r.symbol)).toEqual(['VNM']);
    expect(matchTickers(rows, 'micro').map((r) => r.symbol)).toEqual(['AMD']);
    expect(matchTickers(rows, 'i')).toEqual([]);
  });

  it('notes match by ticker prefix first, then by title, without repeats', () => {
    const notes = [
      { ticker: 'NVDA', title: 'Networking guide' },
      { ticker: 'MU', title: 'Memory cycle and NVDA demand' },
    ];
    expect(matchNotes(notes, 'nvda').map((n) => n.ticker)).toEqual(['NVDA', 'MU']);
    expect(matchNotes(notes, 'm').map((n) => n.ticker)).toEqual(['MU']);
    expect(matchNotes(notes, '')).toHaveLength(2);
  });
});

describe('isPlausibleTicker — AC-31 the "Open anyway" gate', () => {
  it('accepts 1-5 letters; rejects 6+ letters, digits, empty, and punctuation', () => {
    const cases: Array<[string, boolean]> = [
      ['A', true],
      ['AAPL', true],
      ['ABCDE', true],
      ['ABCDEF', false],
      ['AAP1', false],
      ['', false],
      ['AA PL', false],
      ['AA-PL', false],
    ];
    for (const [query, expected] of cases) {
      expect(isPlausibleTicker(query), JSON.stringify(query)).toBe(expected);
    }
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
    const sweep: SweepHeartbeat = {
      sweep_last_completed: 1900,
      universe_size: 500,
      updated_at: 1990,
    };
    const cell = paletteScoreCell(row({ status: 'stale', score: 55, as_of: 1990 }), sweep, NOW_S);
    expect(cell.text).toBe('55');
    expect(cell.freshness).toMatch(/stale/i);
    expect(cell.freshness).toMatch(/sweep/i);
  });

  it('building renders the bare em-dash, never a fabricated 0', () => {
    const cell = paletteScoreCell(
      row({ status: 'building', score: null, as_of: 1990 }),
      null,
      NOW_S,
    );
    expect(cell.text).toBe('—');
    expect(cell.text).not.toBe('0');
  });

  it('error renders "unavailable", never blank, never 0', () => {
    const cell = paletteScoreCell(row({ status: 'error', score: null, as_of: 1990 }), null, NOW_S);
    expect(cell.text).toBe('unavailable');
  });

  it(
    'GATE Q bounce finding 4 / [absent-is-not-none] — error with the wire epoch sentinel `as_of: 0` ' +
      'never fabricates a freshness age, at the fixture now AND a real wall-clock now (projection.rs: ' +
      'project_error clones project_building, which sets as_of: 0.0 — a real `GET /api/scan` response, ' +
      'not a hypothetical fixture)',
    () => {
      // The real wall-clock `now` reproduces QA's exact observed defect shape: before the fix this
      // computed `now - 0` as a real elapsed age (e.g. "496824h ago") — an absent timestamp must
      // render as a member of the closed not-a-number vocabulary (here: no freshness at all), never
      // as a computed age.
      for (const nowS of [NOW_S, Math.floor(Date.now() / 1000)]) {
        const cell = paletteScoreCell(row({ status: 'error', score: null, as_of: 0 }), null, nowS);
        expect(cell.text, `now=${nowS}`).toBe('unavailable');
        expect(cell.freshness, `now=${nowS}`).toBeNull();
      }
    },
  );

  it('D-13 — a sample scan row never carries a wall-clock age; a live one still does', () => {
    // The demo's as_of is the scenario's timestamp: against the visitor's clock it read
    // "as of 184h ago" on data that was never live.
    const nowS = Math.floor(Date.now() / 1000);
    const scenario = nowS - 184 * 3600;
    const sample = paletteScoreCell(row({ status: 'ok', score: 81, as_of: scenario }), null, nowS, {
      sample: true,
    });
    expect(sample).toEqual({ text: '81', tier: 'Actionable', freshness: null });
    const sweep: SweepHeartbeat = {
      sweep_last_completed: scenario,
      universe_size: 6,
      updated_at: scenario,
    };
    const stale = paletteScoreCell(row({ status: 'stale', as_of: scenario }), sweep, nowS, {
      sample: true,
    });
    expect(stale.freshness).toBe('stale');
    const live = paletteScoreCell(row({ status: 'ok', score: 81, as_of: scenario }), null, nowS);
    expect(live.freshness).toBe('as of 184h ago');
  });

  it('the tier rides beside a score through the closed lookup: a miss or no score shows none', () => {
    expect(paletteScoreCell(row({ tier: 'prime', score: 88 }), null, NOW_S).tier).toBe('Prime');
    expect(paletteScoreCell(row({ tier: 'mythic', score: 88 }), null, NOW_S).tier).toBeNull();
    expect(paletteScoreCell(row({ tier: null, score: 88 }), null, NOW_S).tier).toBeNull();
    expect(
      paletteScoreCell(row({ status: 'building', tier: 'prime', score: null }), null, NOW_S).tier,
    ).toBeNull();
    expect(
      paletteScoreCell(row({ status: 'error', tier: 'prime', score: null }), null, NOW_S).tier,
    ).toBeNull();
  });

  it('an unknown status degrades honestly rather than throwing', () => {
    expect(() =>
      paletteScoreCell(row({ status: 'weird' as ScanRow['status'], score: 10 }), null, NOW_S),
    ).not.toThrow();
  });
});
