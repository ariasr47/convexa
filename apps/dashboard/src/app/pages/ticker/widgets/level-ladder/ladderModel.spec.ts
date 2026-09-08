/**
 * `ladderModel.ts` — SPEC §2.3, criteria 1, 3, 5. Pure model tests; the DOM-level equivalents
 * (criteria 1's `[data-figure-state]` count, 2, 7, 8, 23) live in `LevelLadder.spec.tsx`.
 *
 * MUTATION PROOFS (poison → confirm red → revert, both actually run — not narrated):
 *   1. `ABSENT_DISTANCE` on the mid row replaced with `distanceToLevel(input.mid, input.anchor)` —
 *      "the mid row's distance is never a computed zero/string" test goes red naming the computed
 *      string ("at spot" for the coincident fixture below), not merely "not '—'".
 *   2. The sort replaced with a fixed declaration-order return (no `.sort()` call) — the crossing-case
 *      test (put wall priced above mid) goes red because the fixed order keeps Put wall last.
 *   Both reverted after confirming red; the fixed diff for each is recorded in this file's own
 *   history (not narrated further here — this comment records that they were run, not their output).
 */
import { isDeliveringLive, NOT_LIVE, type LiveClaim } from '@/shared/liveness/liveClaim';
import { describe, expect, it } from 'vitest';
import {
  ABSENT_DISTANCE,
  ABSENT_LEVEL,
  buildLadder,
  formatAnchorText,
  type LadderInput,
} from './ladderModel';

const LIVE: LiveClaim = isDeliveringLive(
  { live: true, market_session: 'regular' } as Parameters<typeof isDeliveringLive>[0],
  false,
);

const FULL_INPUT: LadderInput = {
  callWall: 260,
  putWall: 240,
  maxPain: 250,
  gammaFlip: 248,
  mid: 252,
  midLive: LIVE,
  anchor: 250,
};

describe('buildLadder — exactly five rows, at every data state (criterion 1)', () => {
  it('all levels present', () => {
    const rows = buildLadder(FULL_INPUT);
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.id).sort()).toEqual(
      ['callWall', 'gammaFlip', 'maxPain', 'mid', 'putWall'].sort(),
    );
  });

  it('all levels null — still five rows, none dropped', () => {
    const rows = buildLadder({
      callWall: null,
      putWall: null,
      maxPain: null,
      gammaFlip: null,
      mid: null,
      midLive: NOT_LIVE,
      anchor: null,
    });
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.price === ABSENT_LEVEL)).toBe(true);
  });

  it('three levels null, two present — five rows, no row dropped', () => {
    const rows = buildLadder({
      ...FULL_INPUT,
      callWall: null,
      maxPain: null,
      gammaFlip: null,
    });
    expect(rows).toHaveLength(5);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId['callWall'].price).toBe(ABSENT_LEVEL);
    expect(byId['maxPain'].price).toBe(ABSENT_LEVEL);
    expect(byId['gammaFlip'].price).toBe(ABSENT_LEVEL);
    expect(byId['putWall'].price).toBe('$240');
    expect(byId['mid'].price).toBe('$252');
  });

  it('levels crossing — a put wall priced above the mid is a real state, sorted by computed price', () => {
    const rows = buildLadder({ ...FULL_INPUT, putWall: 300 });
    const order = rows.map((r) => r.id);
    // Put wall ($300) now outranks call wall ($260), max pain ($250) and mid ($252).
    expect(order[0]).toBe('putWall');
    expect(order).toContain('callWall');
    expect(order).toContain('mid');
  });

  it('a null level sinks to the bottom in declaration order, never removed', () => {
    const rows = buildLadder({ ...FULL_INPUT, callWall: null });
    expect(rows).toHaveLength(5);
    expect(rows[rows.length - 1].id).toBe('callWall');
  });
});

describe('buildLadder — row 2 labels, the e2e anchor (criterion 2)', () => {
  it('renders the exact words "Call wall" and "Put wall"', () => {
    const rows = buildLadder(FULL_INPUT);
    const labels = rows.map((r) => r.label);
    expect(labels).toContain('Call wall');
    expect(labels).toContain('Put wall');
  });
});

describe('buildLadder — distance anchor is the levels spot, never the mid (criterion 3)', () => {
  it('every non-mid row is distancePercentOnly(level, anchor) — the bare percentage, dollar delta moved to distanceTitle (F10 hero residual)', () => {
    const rows = buildLadder(FULL_INPUT);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    // The VISIBLE distance is the design's bare form (`desk.mjs:320`'s `dist: '−0.81%'`) — no
    // dollar, no "above"/"below" word (the ticker fidelity repair, change 6/F10: this is what
    // shortened the ladder column enough to stop wrapping — `STRUCTURE_HERO_REVIEW.md`'s own
    // residual). `distanceToLevel` itself is UNCHANGED (`distanceToLevel.spec.ts`, untouched) —
    // `LiveTape.tsx`'s gamma-flip caption keeps the full form; this is a second, shorter rendering
    // of the SAME projection, not a reformat of the shared helper.
    expect(byId['callWall'].distance).toBe('+4.0%');
    expect(byId['putWall'].distance).toBe('−4.0%');
    expect(byId['maxPain'].distance).toBe('at spot');
    expect(byId['gammaFlip'].distance).toBe('−0.8%');

    // The full line survives — moved to `distanceTitle`, a hover affordance (`FigureRow`'s
    // `captionTitle`), never a second visible line. `at spot` has nothing to elaborate.
    expect(byId['callWall'].distanceTitle).toBe('+$10 · 4.0% above');
    expect(byId['putWall'].distanceTitle).toBe('−$10 · 4.0% below');
    expect(byId['maxPain'].distanceTitle).toBeUndefined();
    expect(byId['gammaFlip'].distanceTitle).toBe('−$2.0 · 0.8% below');
  });

  it('falls back to price when gex_spot (the anchor) is absent', () => {
    const rows = buildLadder({ ...FULL_INPUT, anchor: null });
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    // distanceToLevel returns null when its spot argument is null, so the caller's ABSENT_DISTANCE
    // fallback fires — this is the "falls back" contract exercised end-to-end via LadderInput.anchor,
    // which callers compute as `gex_spot ?? price` before construction.
    expect(byId['callWall'].distance).toBe(ABSENT_DISTANCE);
  });

  it('the mid row distance is ALWAYS the not-applicable member, never a computed zero, never "at spot", never blank', () => {
    // anchor === mid would make distanceToLevel return 'at spot' if it were (wrongly) computed.
    const rows = buildLadder({ ...FULL_INPUT, mid: 250, anchor: 250 });
    const mid = rows.find((r) => r.id === 'mid')!;
    expect(mid.distance).toBe(ABSENT_DISTANCE);
    expect(mid.distance).not.toBe('at spot');
    expect(mid.distance).not.toBe('0');
    expect(mid.distance).not.toBe('');
  });
});

describe('buildLadder — D-14, the absent-level literal (criterion 5)', () => {
  it('a null call_wall keeps its row and label, and renders `—` in both value and distance cells', () => {
    const rows = buildLadder({ ...FULL_INPUT, callWall: null });
    const callWall = rows.find((r) => r.id === 'callWall')!;
    expect(callWall.label).toBe('Call wall');
    expect(callWall.price).toBe('—');
    expect(callWall.distance).toBe('—');
    expect(callWall.price).not.toBe('$—');
    expect(callWall.price).not.toBe(0);
    expect(callWall.price).not.toBe('unavailable');
  });

  it('a legal zero level renders `$0`, never the absent literal (reviewer probe)', () => {
    const rows = buildLadder({ ...FULL_INPUT, maxPain: 0 });
    const maxPain = rows.find((r) => r.id === 'maxPain')!;
    expect(maxPain.price).toBe('$0');
    expect(maxPain.price).not.toBe(ABSENT_LEVEL);
  });

  it('all five absences use the SAME literal', () => {
    const rows = buildLadder({
      callWall: null,
      putWall: undefined,
      maxPain: null,
      gammaFlip: undefined,
      mid: null,
      midLive: NOT_LIVE,
      anchor: null,
    });
    for (const r of rows) {
      if (r.id === 'mid') continue; // mid's distance is ABSENT_DISTANCE by construction, always.
      expect(r.price).toBe(ABSENT_LEVEL);
    }
  });
});

describe('buildLadder — stroke identity (criterion 7 model half)', () => {
  it('each row carries its own token key, matching LadderRowId', () => {
    const rows = buildLadder(FULL_INPUT);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.stroke]));
    expect(byId).toEqual({
      callWall: 'callWall',
      maxPain: 'maxPain',
      gammaFlip: 'gammaFlip',
      putWall: 'putWall',
      mid: 'mid',
    });
  });
});

describe('buildLadder — the mid row live claim (criterion 8 model half)', () => {
  it('only the mid row carries a live claim; the four structure rows are always NOT_LIVE', () => {
    const rows = buildLadder(FULL_INPUT);
    for (const r of rows) {
      if (r.id === 'mid') {
        expect(r.live).toBe(LIVE);
      } else {
        expect(r.live).toBe(NOT_LIVE);
      }
    }
  });

  it('the mid row is NOT_LIVE when midLive is NOT_LIVE', () => {
    const rows = buildLadder({ ...FULL_INPUT, midLive: NOT_LIVE });
    const mid = rows.find((r) => r.id === 'mid')!;
    expect(mid.live).toBe(NOT_LIVE);
  });
});

describe('buildLadder — mid row offline/replay, GATE Z (SPEC §4.1, criterion 16b)', () => {
  it('defaults to no offline and no replay when the caller omits both', () => {
    const rows = buildLadder(FULL_INPUT);
    const mid = rows.find((r) => r.id === 'mid')!;
    expect(mid.offline).toBeNull();
    expect(mid.replay).toBe(false);
  });

  it('the mid row carries `offline: {retained: true}` when the caller passes it, retained', () => {
    const rows = buildLadder({ ...FULL_INPUT, midOffline: { retained: true } });
    const mid = rows.find((r) => r.id === 'mid')!;
    expect(mid.offline).toEqual({ retained: true });
    expect(mid.replay).toBe(false);
  });

  it('the mid row carries `offline: {retained: false}` (bare) when the caller passes it', () => {
    const rows = buildLadder({ ...FULL_INPUT, midOffline: { retained: false } });
    const mid = rows.find((r) => r.id === 'mid')!;
    expect(mid.offline).toEqual({ retained: false });
  });

  it('the mid row carries `replay: true` when the caller passes `midReplay`', () => {
    const rows = buildLadder({ ...FULL_INPUT, midReplay: true });
    const mid = rows.find((r) => r.id === 'mid')!;
    expect(mid.replay).toBe(true);
    // 16b: a replay standing never also carries offline.
    expect(mid.offline).toBeNull();
  });

  it('the four structure rows NEVER carry offline or replay, regardless of the mid row standing', () => {
    const rows = buildLadder({
      ...FULL_INPUT,
      midOffline: { retained: true },
      midReplay: true,
    });
    for (const r of rows) {
      if (r.id === 'mid') continue;
      expect(r.offline).toBeNull();
      expect(r.replay).toBe(false);
    }
  });
});

describe('formatAnchorText — the header states the anchor once (criterion 4)', () => {
  it('names gex_spot when present', () => {
    expect(formatAnchorText(250)).toBe('$250');
  });

  it('falls back to the absent-level literal when the anchor is absent (caller passes price then)', () => {
    expect(formatAnchorText(null)).toBe(ABSENT_LEVEL);
  });

  it('a legal zero anchor renders `$0`, not the absent literal', () => {
    expect(formatAnchorText(0)).toBe('$0');
  });
});
