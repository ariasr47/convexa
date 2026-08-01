/**
 * `/scanner` transports + closed lookups — the PURE unit suite. Risk-based (`qa-verify.md` §4): these
 * are the silently-regressing pieces — a lookup miss that guesses, a `null` that renders `0`, a
 * `building` row that grows a fabricated freshness claim, a sort that floats `null`s to the top, a
 * direction colour that leaks onto a rate. None of that is visible in a screenshot review.
 */
import type { ScanRow, SweepHeartbeat } from '@org/api';
import { describe, expect, it } from 'vitest';
import {
  coarseAge,
  dash,
  directionColor,
  EM_DASH,
  fmtPrice,
  fmtSignedPct,
  partitionLeadGroup,
  relAge,
  sortRows,
  sweepBanner,
  updatedText,
} from './format';
import {
  INDEX_MEGACAP_SYMBOLS,
  isIndexMegacap,
  regimeLabel,
  statusMeta,
  tierLabel,
  UNAVAILABLE_STATUS_META,
  volRegimeLabel,
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
    expect(updatedText(row({ status: 'ok', as_of: NOW - 42 }), NOW)).toBe('Updated 42s ago');
    expect(updatedText(row({ status: 'stale', as_of: NOW - 600 }), NOW)).toBe('Updated 10m ago');
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
  it('resolves success/error by sign and neutral for a missing value', () => {
    expect(directionColor(1.2)).toBe('success.main');
    expect(directionColor(0)).toBe('success.main');
    expect(directionColor(-0.4)).toBe('error.main');
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
