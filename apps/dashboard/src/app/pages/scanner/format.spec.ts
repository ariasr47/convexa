/**
 * `/scanner` transports + closed lookups — the PURE unit suite. Risk-based (`qa-verify.md` §4): these
 * are the silently-regressing pieces — a lookup miss that guesses, a `null` that renders `0`, a
 * `building` row that grows a fabricated freshness claim, a sort that floats `null`s to the top, a
 * direction colour that leaks onto a rate. None of that is visible in a screenshot review.
 */
import { fmtDelta } from '@/shared/lib/fmtDelta';
import { downText, upText } from '@/shared/theme/tokens';
import type { ScanRow, SweepHeartbeat } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import {
  coarseAge,
  computePollDeltas,
  dash,
  directionColor,
  EM_DASH,
  EMPTY_FILTERS,
  filterRows,
  filtersActive,
  fmtPrice,
  fmtSignedPct,
  marketSessionPhase,
  nearerWall,
  partitionLeadGroup,
  relAge,
  scenarioStamp,
  sessionBadge,
  snapRows,
  sortRows,
  structureAsOfRel,
  sweepBanner,
  updatedText,
} from './format';
import {
  INDEX_MEGACAP_SYMBOLS,
  isIndexMegacap,
  regimeLabel,
  SESSION_LABEL,
  statusMeta,
  tierLabel,
  UNAVAILABLE_STATUS_META,
  volRegimeLabel,
  whyThisRow,
} from './labels';

const NOW = 1_800_000;

function row(over: Partial<ScanRow> = {}): ScanRow {
  return {
    symbol: 'SPY',
    price: 500,
    chg_pct: 1.2,
    score: 82,
    tier: 'prime',
    regime: 'positive_gamma',
    vol_regime: 'iv_rich',
    flip: 495,
    dist_to_flip_pct: 1,
    call_wall: 510,
    put_wall: 490,
    dist_to_wall_pct: -2,
    as_of: NOW - 42,
    status: 'ok',
    ...over,
  };
}

describe('relative ages', () => {
  it('relAge buckets seconds / minutes / hours', () => {
    expect(relAge(0)).toBe('0s');
    expect(relAge(42)).toBe('42s');
    expect(relAge(59.4)).toBe('59s');
    expect(relAge(120)).toBe('2m');
    expect(relAge(3600)).toBe('1h');
    expect(relAge(-5)).toBe('0s'); // clock skew never renders a negative age
  });

  it('coarseAge is the banner grain: minutes floored at 1, then hours, then days', () => {
    expect(coarseAge(10)).toBe('1 min');
    expect(coarseAge(180)).toBe('3 min');
    expect(coarseAge(720)).toBe('12 min');
    expect(coarseAge(3600)).toBe('1 hr');
    expect(coarseAge(90_000)).toBe('1 d');
  });
});

describe('honestly-missing rendering', () => {
  it('null/undefined/NaN render the em-dash, but a real 0 renders as data', () => {
    expect(dash(null, fmtPrice)).toBe(EM_DASH);
    expect(dash(undefined, fmtPrice)).toBe(EM_DASH);
    expect(dash(Number.NaN, fmtPrice)).toBe(EM_DASH);
    expect(dash(0, fmtPrice)).toBe('0.00'); // a zero is a value, NOT a missing value
    expect(dash(0, fmtSignedPct)).toBe('+0.00%');
    expect(dash(-2.5, fmtSignedPct)).toBe('−2.50%'); // a REAL minus sign
  });
});

describe('updatedText — the pinned `building` as_of trap', () => {
  it('a building row NEVER produces a freshness line, even with a fresh non-null as_of', () => {
    // The synthesized building row can carry a real recent epoch; INTERFACE §3.1 pins that it is
    // NOT a freshness claim. Branch on status FIRST.
    expect(updatedText(row({ status: 'building', as_of: NOW - 3 }), NOW)).toBeNull();
    expect(updatedText(row({ status: 'building', as_of: 0 }), NOW)).toBeNull();
  });

  it('ok/stale rows report their real age; a non-positive as_of makes no claim', () => {
    expect(updatedText(row({ status: 'ok', as_of: NOW - 42 }), NOW)).toBe('Structure as-of 42s');
    expect(updatedText(row({ status: 'stale', as_of: NOW - 600 }), NOW)).toBe(
      'Structure as-of 10m',
    );
    expect(updatedText(row({ status: 'error', as_of: 0 }), NOW)).toBeNull();
  });
});

describe('closed lookups (never re-derived, never guessed)', () => {
  it('every wire status maps to its pinned chip; an unknown status is fail-honest UNAVAILABLE', () => {
    expect(statusMeta('ok').label).toBeNull(); //          quiet — freshness is the only cue
    expect(statusMeta('stale')).toMatchObject({ label: '⚠ Stale', tone: 'warning' });
    expect(statusMeta('error')).toMatchObject({ label: '⚠ Error', tone: 'warning' });
    expect(statusMeta('building')).toMatchObject({ label: 'Building', tone: 'neutral' });
    expect(statusMeta('teleporting')).toBe(UNAVAILABLE_STATUS_META);
    expect(statusMeta('')).toBe(UNAVAILABLE_STATUS_META);
    // The warning tones carry a glyph in the label — hue never carries "warning" alone.
    expect(statusMeta('stale').label).toContain('⚠');
    expect(statusMeta('error').label).toContain('⚠');
    // No tooltip on this surface may claim a real-time feed.
    for (const s of ['stale', 'error', 'building']) {
      expect(statusMeta(s).tip('2m')).not.toMatch(/\blive\b/i);
    }
  });

  it('tier/regime/vol labels resolve from the closed tables; anything else renders NOTHING', () => {
    expect(tierLabel('prime')).toBe('Prime');
    expect(tierLabel('watch')).toBe('Watch');
    expect(regimeLabel('positive_gamma')).toBe('Pos γ');
    expect(regimeLabel('negative_gamma')).toBe('Neg γ');
    expect(volRegimeLabel('iv_rich')).toBe('IV rich');
    expect(volRegimeLabel('neutral')).toBe('Neutral');
    // Unknown / null ⇒ null ⇒ the cell renders no label (never the raw enum, never a guess).
    expect(tierLabel('legendary')).toBeNull();
    expect(regimeLabel('sideways_gamma')).toBeNull();
    expect(volRegimeLabel(null)).toBeNull();
  });
});

describe('direction colour is bound to chg_pct alone', () => {
  it('resolves the text-grade up/down hue by sign and neutral for a missing value', () => {
    expect(directionColor(1.2)).toBe(upText);
    expect(directionColor(0)).toBe(upText);
    expect(directionColor(-0.4)).toBe(downText);
    expect(directionColor(null)).toBe('text.primary');
    expect(directionColor(Number.NaN)).toBe('text.primary');
  });
});

describe('sortRows — client-side re-order, nulls last, stable', () => {
  const rows = [
    row({ symbol: 'AAA', score: 10 }),
    row({ symbol: 'BBB', score: null }),
    row({ symbol: 'CCC', score: 90 }),
    row({ symbol: 'DDD', score: 50 }),
  ];

  it('the default score-desc read floats the best first and sinks nulls to the bottom', () => {
    const out = sortRows(rows, { key: 'score', dir: 'desc' }).map((r) => r.symbol);
    expect(out).toEqual(['CCC', 'DDD', 'AAA', 'BBB']);
  });

  it('nulls stay LAST when the direction flips (an absent value is not a small value)', () => {
    const out = sortRows(rows, { key: 'score', dir: 'asc' }).map((r) => r.symbol);
    expect(out).toEqual(['AAA', 'DDD', 'CCC', 'BBB']);
    expect(out[out.length - 1]).toBe('BBB');
  });

  it('symbol-asc is alphabetical, ties keep wire order, and the input array is not mutated', () => {
    const tied = [row({ symbol: 'ZZ', score: 5 }), row({ symbol: 'YY', score: 5 })];
    expect(sortRows(tied, { key: 'score', dir: 'desc' }).map((r) => r.symbol)).toEqual([
      'ZZ',
      'YY',
    ]);
    expect(sortRows(rows, { key: 'symbol', dir: 'asc' }).map((r) => r.symbol)).toEqual([
      'AAA',
      'BBB',
      'CCC',
      'DDD',
    ]);
    expect(rows.map((r) => r.symbol)).toEqual(['AAA', 'BBB', 'CCC', 'DDD']); // untouched
  });
});

describe('partitionLeadGroup — the zero-state lead group (index-first-defaults AC-3)', () => {
  it('membership is the CLOSED lookup: every listed symbol is lead, anything else is rest', () => {
    for (const s of INDEX_MEGACAP_SYMBOLS) expect(isIndexMegacap(s)).toBe(true);
    expect(isIndexMegacap('GME')).toBe(false);
    expect(isIndexMegacap('ZZZZ')).toBe(false);
    expect(isIndexMegacap('')).toBe(false);
    // Closed means closed: no case-folding heuristic hides in the lookup (the wire is UPPER).
    expect(isIndexMegacap('spy')).toBe(false);
  });

  it('is a STABLE pure re-order: per-group order preserved, no row dropped/added/changed', () => {
    const rows = [
      row({ symbol: 'GME', score: 95 }),
      row({ symbol: 'SPY', score: 90 }),
      row({ symbol: 'COIN', score: 80 }),
      row({ symbol: 'QQQ', score: 70 }),
      row({ symbol: 'NVDA', score: null }),
    ];
    const { lead, rest } = partitionLeadGroup(rows);
    // Incoming (already-sorted) order is preserved INSIDE each group — score-desc stays score-desc.
    expect(lead.map((r) => r.symbol)).toEqual(['SPY', 'QQQ', 'NVDA']);
    expect(rest.map((r) => r.symbol)).toEqual(['GME', 'COIN']);
    // Nothing lost, nothing fabricated, input untouched.
    expect(lead.length + rest.length).toBe(rows.length);
    expect(lead[0]).toBe(rows[1]); // same object identity — a re-order, never a rebuild
    expect(rows.map((r) => r.symbol)).toEqual(['GME', 'SPY', 'COIN', 'QQQ', 'NVDA']);
  });

  it('degenerates honestly: all-lead and no-lead inputs produce an empty other side', () => {
    expect(partitionLeadGroup([row({ symbol: 'SPY' })]).rest).toEqual([]);
    expect(partitionLeadGroup([row({ symbol: 'GME' })]).lead).toEqual([]);
    expect(partitionLeadGroup([])).toEqual({ lead: [], rest: [] });
  });
});

describe('sweepBanner', () => {
  const hb = (over: Partial<SweepHeartbeat> = {}): SweepHeartbeat => ({
    updated_at: NOW - 5,
    sweep_last_completed: NOW - 30,
    universe_size: 25,
    ...over,
  });

  it('engages on a missing or behind heartbeat and stays quiet on a fresh one', () => {
    expect(sweepBanner(null, NOW)).toEqual({
      engaged: true,
      text: "Sweep hasn't reported yet — showing the last known rows.",
    });
    expect(sweepBanner(hb(), NOW).engaged).toBe(false);
    expect(
      sweepBanner(hb({ updated_at: NOW - 400, sweep_last_completed: NOW - 180 }), NOW),
    ).toEqual({ engaged: true, text: 'Sweep last ran 3 min ago — showing the last known rows.' });
    // Behind with NO completed pass: we cannot honestly say "last ran X ago".
    expect(sweepBanner(hb({ updated_at: NOW - 400, sweep_last_completed: null }), NOW).text).toBe(
      "Sweep hasn't reported yet — showing the last known rows.",
    );
  });
});

describe('desk filters — client-side only, nulls fail thresholds', () => {
  const rows = [
    row({ symbol: 'AAA', tier: 'prime', vol_regime: 'iv_rich', score: 90, dist_to_flip_pct: 0.5 }),
    row({ symbol: 'BBB', tier: 'watch', vol_regime: 'iv_cheap', score: 40, dist_to_flip_pct: 4 }),
    row({
      symbol: 'CCC',
      tier: 'actionable',
      vol_regime: 'neutral',
      score: null,
      dist_to_flip_pct: 1.2,
    }),
  ];

  it('empty filters are inactive and return the same array reference', () => {
    expect(filtersActive(EMPTY_FILTERS)).toBe(false);
    expect(filterRows(rows, EMPTY_FILTERS)).toBe(rows);
  });

  it('tier / vol / score / flip thresholds narrow independently and combine', () => {
    expect(filterRows(rows, { ...EMPTY_FILTERS, tier: 'prime' }).map((r) => r.symbol)).toEqual([
      'AAA',
    ]);
    expect(
      filterRows(rows, { ...EMPTY_FILTERS, volRegime: 'iv_cheap' }).map((r) => r.symbol),
    ).toEqual(['BBB']);
    // Null score fails a minScore threshold — absent is not ≥50.
    expect(filterRows(rows, { ...EMPTY_FILTERS, minScore: 50 }).map((r) => r.symbol)).toEqual([
      'AAA',
    ]);
    expect(filterRows(rows, { ...EMPTY_FILTERS, maxAbsDistFlip: 1 }).map((r) => r.symbol)).toEqual([
      'AAA',
    ]);
    expect(
      filterRows(rows, {
        tier: 'prime',
        volRegime: 'iv_rich',
        minScore: 70,
        maxAbsDistFlip: 1,
      }).map((r) => r.symbol),
    ).toEqual(['AAA']);
  });
});

describe('marketSessionPhase — US equity clock (America/New_York)', () => {
  // Fixed UTC instants. 2026-08-10 is a Monday; EDT = UTC-4.
  it('classifies RTH / pre / after / closed (weekday + weekend)', () => {
    // 14:00 UTC = 10:00 ET → RTH
    expect(marketSessionPhase(Date.UTC(2026, 7, 10, 14, 0, 0))).toBe('rth');
    // 12:00 UTC = 08:00 ET → pre
    expect(marketSessionPhase(Date.UTC(2026, 7, 10, 12, 0, 0))).toBe('pre');
    // 21:00 UTC = 17:00 ET → after
    expect(marketSessionPhase(Date.UTC(2026, 7, 10, 21, 0, 0))).toBe('after');
    // 02:00 UTC = 22:00 ET previous calendar day Sunday night → closed
    expect(marketSessionPhase(Date.UTC(2026, 7, 11, 3, 0, 0))).toBe('closed');
    // Saturday
    expect(marketSessionPhase(Date.UTC(2026, 7, 8, 15, 0, 0))).toBe('closed');
  });

  it('Thanksgiving 2026-11-26 10:00 ET is Closed, not RTH', () => {
    // EST (DST already ended): 10:00 ET = 15:00 UTC
    expect(marketSessionPhase(Date.UTC(2026, 10, 26, 15, 0, 0))).toBe('closed');
    expect(sessionBadge(Date.UTC(2026, 10, 26, 15, 0, 0)).label).toBe(SESSION_LABEL.closed);
  });

  it('holiday pre and after clocks are Closed (S2 pin, not a new AC)', () => {
    expect(marketSessionPhase(Date.UTC(2026, 10, 26, 13, 0, 0))).toBe('closed'); // 08:00 ET
    expect(marketSessionPhase(Date.UTC(2026, 10, 26, 22, 0, 0))).toBe('closed'); // 17:00 ET
  });

  it('early-close Friday 2026-11-27 10:00 ET remains RTH (still a session day)', () => {
    // EST: 10:00 ET = 15:00 UTC
    expect(marketSessionPhase(Date.UTC(2026, 10, 27, 15, 0, 0))).toBe('rth');
  });
});

// The demo stamps every row at the scenario's now: an age would always read "0s" (site check D-03).
describe('scenario stamp (demo)', () => {
  const STAMP = Date.parse('2026-10-07T18:30:00Z') / 1000; // 2:30 PM EDT
  it('reads the scenario clock in New York time, never an age', () => {
    expect(scenarioStamp(STAMP)).toBe('2:30 PM ET, Oct 7');
    expect(scenarioStamp(Date.parse('2026-11-02T03:30:00Z') / 1000)).toBe('10:30 PM ET, Nov 1');
    expect(updatedText(row({ status: 'ok', as_of: STAMP }), STAMP, true)).toBe(
      'Structure as-of 2:30 PM ET, Oct 7',
    );
    expect(structureAsOfRel(null, [row({ status: 'ok', as_of: STAMP })], STAMP, true)).toBe(
      '2:30 PM ET, Oct 7',
    );
  });
  it('keeps the age on a live build and claims nothing for a building row', () => {
    expect(updatedText(row({ status: 'ok', as_of: STAMP - 42 }), STAMP, false)).toBe(
      'Structure as-of 42s',
    );
    expect(updatedText(row({ status: 'building', as_of: STAMP }), STAMP, true)).toBeNull();
  });
});

describe('structureAsOfRel', () => {
  it('prefers sweep_last_completed, falls back to newest non-building as_of, never invents', () => {
    expect(
      structureAsOfRel(
        { updated_at: NOW, sweep_last_completed: NOW - 120, universe_size: 2 },
        [row({ as_of: NOW - 10 })],
        NOW,
      ),
    ).toBe('2m');
    // No sweep stamp → newest non-building as_of. building rows are ignored.
    expect(
      structureAsOfRel(
        null,
        [row({ status: 'building', as_of: NOW - 3 }), row({ as_of: NOW - 125 })],
        NOW,
      ),
    ).toBe('2m');
    expect(structureAsOfRel(null, [row({ status: 'building', as_of: NOW - 3 })], NOW)).toBeNull();
    expect(structureAsOfRel(null, [], NOW)).toBeNull();
  });
});

describe('whyThisRow — closed drivers only, never "live"', () => {
  it('surfaces tier + flip proximity for a healthy prime row', () => {
    const text = whyThisRow(
      row({
        tier: 'prime',
        dist_to_flip_pct: 0.8,
        regime: 'negative_gamma',
        vol_regime: 'iv_rich',
      }),
    );
    expect(text).toMatch(/Prime tier/);
    expect(text).toMatch(/within 0\.80% of flip/);
    expect(text).not.toMatch(/\blive\b/i);
    // Only 1–2 drivers.
    expect(text.split(' · ')).toHaveLength(2);
  });

  it('prefers wire score_drivers over field heuristics when present', () => {
    const text = whyThisRow(
      row({
        tier: 'prime',
        dist_to_flip_pct: 0.8,
        score_drivers: {
          proximity: 28,
          vol: 12,
          setups: 8,
          transition: 10,
          dark_pool: 0,
          total: 58,
        },
      }),
    );
    expect(text).toMatch(/near wall\/flip \(\+28\)/);
    expect(text).toMatch(
      /IV vs HV stretch \(\+12\)|flip transition \(\+10\)|active setups \(\+8\)/,
    );
    expect(text).not.toMatch(/Prime tier/);
    expect(text).not.toMatch(/\blive\b/i);
  });

  it('building / error are honest and never claim a score', () => {
    expect(whyThisRow(row({ status: 'building' }))).toMatch(/not yet scored/i);
    expect(whyThisRow(row({ status: 'error' }))).toMatch(/failed/i);
    expect(whyThisRow(row({ status: 'building' }))).not.toMatch(/\blive\b/i);
  });
});

describe('poll-to-poll deltas — structure change only', () => {
  it('first poll has no deltas; second poll diffs score and flip dist', () => {
    const a = [
      row({ symbol: 'AAA', score: 80, dist_to_flip_pct: 1.0 }),
      row({ symbol: 'BBB', score: 50, dist_to_flip_pct: -2 }),
    ];
    expect(computePollDeltas(a, null).size).toBe(0);
    const prev = snapRows(a);
    const b = [
      row({ symbol: 'AAA', score: 85, dist_to_flip_pct: 0.5 }),
      row({ symbol: 'BBB', score: 50, dist_to_flip_pct: -2 }), // unchanged → no entry
      row({ symbol: 'CCC', score: 10, dist_to_flip_pct: 3 }), // new symbol → no prior
    ];
    const d = computePollDeltas(b, prev);
    expect(d.get('AAA')).toEqual({ scoreDelta: 5, flipDistDelta: -0.5 });
    expect(d.has('BBB')).toBe(false);
    expect(d.has('CCC')).toBe(false);
  });

  it('fmtDelta uses neutral arrows and never green/red tokens', () => {
    expect(fmtDelta(3)).toBe('↑3');
    expect(fmtDelta(-1.25, 1)).toBe('↓1.3');
    expect(fmtDelta(0)).toBe('');
  });
});

describe('nearerWall — the wall dist_to_wall_pct measures (the API contract)', () => {
  // The contract's distance is (price − wall) / price, so a nearer CALL wall comes out negative; the
  // label must still name the call wall. SPY on the demo scenario: 690.62, walls 704.02 / 652.22.
  it.each([
    [
      'call wall nearer (distance negative)',
      { price: 690.62, call_wall: 704.02, put_wall: 652.22 },
      704.02,
    ],
    [
      'put wall nearer (distance positive)',
      { price: 660, call_wall: 704.02, put_wall: 652.22 },
      652.22,
    ],
    [
      'a tie goes to the call wall, as the API breaks it',
      { price: 500, call_wall: 510, put_wall: 490 },
      510,
    ],
    ['only one wall known', { price: 500, call_wall: null, put_wall: 490 }, 490],
    ['no price, two walls: no claim', { price: null, call_wall: 510, put_wall: 490 }, null],
  ] as const)('%s', (_, row, want) => {
    expect(nearerWall(row)).toBe(want);
  });
});
