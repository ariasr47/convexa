/**
 * Criterion 20 (SPEC row 20, S8, `test`) — "On a drop the field keeps its last computed geometry —
 * curve, wall lines and flip line still painted — while trail, drift, beam and sweep stop: against a
 * recording 2D context, `live: false` yields zero trail points, zero particle `arc()` calls, zero
 * sweep gradient fills and non-zero level strokes." Plus criterion 22's automatable half (a static —
 * not merely absent — frame for the drift under reduced motion; the review-only half is the browser
 * check, not this file).
 *
 * WHY THIS FILE CAN EXIST AT ALL. `single-motion-moment.spec.ts:54-55` matches only literal
 * `@keyframes <name>` text; a Canvas2D rAF loop declares none, so that scan cannot see the sweep, the
 * drift, the particles or the trail. `paintStructureStep`/`paintFrameStep` (PLAN FE-4's extraction)
 * make those motions reachable by a pure function taking every input as an argument, so
 * `recordingContext()` can drive both into one fake 2D context and count exactly what criterion 20
 * names.
 */
import { describe, expect, it } from 'vitest';
import type { LevelPalette } from './levelStrokes';
import {
  computeGeometry,
  driftAmplitude,
  emptyFrameState,
  paintFrameStep,
  paintStructureStep,
  type StructureFieldSurfaces,
} from './paintStep';
import { recordingContext } from './recordingContext';
import type { StructureFieldModel } from './types';

// Distinctive, non-real-palette strings — a test proves the RIGHT bucket painted, not merely that
// something painted (the same discipline `StructureFieldCanvas.spec.tsx` already uses).
const PALETTE: LevelPalette = {
  callWall: 'rgb(1,2,3)',
  mid: 'rgb(4,5,6)',
  maxPain: 'rgb(7,8,9)',
  gammaFlip: 'rgb(10,11,12)',
  putWall: 'rgb(13,14,15)',
};
const SURFACES: StructureFieldSurfaces = {
  ink: 'rgb(20,20,20)',
  panel: 'rgb(21,21,21)',
  raised: 'rgb(22,22,22)',
  phosphor: 'rgb(23,23,23)',
  steel: 'rgb(24,24,24)',
  warning: 'rgb(25,25,25)',
};

const BASE_MODEL: StructureFieldModel = {
  symbol: 'SPY',
  samples: [
    { strike: 448, netGex: -2_000_000 },
    { strike: 450, netGex: 3_000_000 },
    { strike: 452, netGex: 1_000_000 },
  ],
  spot: 450,
  callWall: 452,
  putWall: 448,
  gammaFlip: 449,
  asOfSec: null,
  liveMid: null,
  live: false,
  source: 'rest',
};

function modelWith(overrides: Partial<StructureFieldModel>): StructureFieldModel {
  return { ...BASE_MODEL, ...overrides };
}

const PAD = { l: 56, r: 20, t: 40, b: 48 };
// Same geometry for every case (samples never change) — only `live`/`liveMid`/`reduced` vary.
const GEOM = computeGeometry(BASE_MODEL, PAD, 600, 300, false, false);

/**
 * Structure-step gradients/arcs are `m.live`-INDEPENDENT (vignette, wall blooms, heat columns, area
 * fill always paint) — see `recordingContext.ts`'s own doc for why every criterion-20 case resets
 * these three counters right after the structure step and before the frame step it is actually
 * testing. `strokes` is NOT reset — the level-stroke assertions need what the structure step wrote.
 */
function resetFrameOnlyCounters(rec: {
  trailPoints: number;
  arcs: number;
  gradientFills: number;
  lineToCalls: number;
}) {
  rec.trailPoints = 0;
  rec.arcs = 0;
  rec.gradientFills = 0;
  rec.lineToCalls = 0;
}

describe('paintStep — criterion 20 (S8, SB via the recording context)', () => {
  it('live: false — trail, particles and the sweep+well gradients STOP; level strokes still paint', () => {
    const { ctx, rec } = recordingContext();
    const frame = emptyFrameState();
    const m = modelWith({ live: false });

    paintStructureStep(m, ctx, GEOM, PALETTE, SURFACES);
    resetFrameOnlyCounters(rec);
    paintFrameStep(m, ctx, GEOM, frame, 1000, false, PALETTE, SURFACES);

    expect(rec.trailPoints).toBe(0);
    expect(rec.arcs).toBe(0);
    expect(rec.gradientFills).toBe(0);
    // Drift: with `liveMid: null` and no hover point, the ONLY frame-step source of a `lineTo()` is
    // the warped field-line drift (`recordingContext.ts`'s own doc) — zero here proves its
    // `if (m.live)` gate, which is otherwise unenforced prose in SPEC row 20 ("drift ... stop").
    expect(rec.lineToCalls).toBe(0);
    // The four structure strokes still paint — put wall, call wall, spot, flip — each identified by
    // its EXACT, un-alpha-wrapped palette colour (see recordingContext.ts's bucketing doc).
    expect(rec.strokes.filter((s) => s === PALETTE.putWall).length).toBeGreaterThan(0);
    expect(rec.strokes.filter((s) => s === PALETTE.callWall).length).toBeGreaterThan(0);
    expect(rec.strokes.filter((s) => s === PALETTE.gammaFlip).length).toBeGreaterThan(0);
  });

  it('ANTI-VACUITY: live: true produces trail points, particle arc() calls, sweep gradient fills and drift lineTo() calls', () => {
    // Without this, the row above would pass against a paint step that draws NOTHING at all
    // (phase 1 shipped two `expect(true).toBe(true)` bodies under a "MUTATION PROOF" heading —
    // criterion 57 exists precisely so this repeat is caught).
    const { ctx, rec } = recordingContext();
    const frame = emptyFrameState();
    const m = modelWith({ live: true, liveMid: 450 });

    paintStructureStep(m, ctx, GEOM, PALETTE, SURFACES);
    resetFrameOnlyCounters(rec);
    for (let t = 0; t < 8; t++) {
      paintFrameStep(m, ctx, GEOM, frame, 1000 + t * 100, false, PALETTE, SURFACES);
    }

    expect(rec.trailPoints).toBeGreaterThan(0);
    expect(rec.arcs).toBeGreaterThan(0);
    expect(rec.gradientFills).toBeGreaterThan(0);
    expect(rec.lineToCalls).toBeGreaterThan(0);
  });

  it('reduced: true (live delivering) — sweep + particles stop exactly like a drop; drift keeps painting; level strokes intact', () => {
    // Row 22 (review) names drift/trail/beam for a STATIC frame under reduced motion, NOT sweep or
    // particles — those two have no sensible static form and keep their pre-existing bare `!reduced`
    // gate. This proves they still fully stop, and that drift is NOT additionally gated on `reduced`
    // the way sweep/particles are (see the `driftAmplitude` describe block below for the actual
    // static-vs-animated proof, which the stroke-STYLE bucket here cannot see).
    const { ctx, rec } = recordingContext();
    const frame = emptyFrameState();
    const m = modelWith({ live: true });

    paintStructureStep(m, ctx, GEOM, PALETTE, SURFACES);
    resetFrameOnlyCounters(rec);
    paintFrameStep(m, ctx, GEOM, frame, 1000, true, PALETTE, SURFACES);

    expect(rec.arcs).toBe(0);
    expect(rec.gradientFills).toBe(0);
    // Drift keeps painting under reduce (unlike the live:false case above) — its `lineTo()` calls are
    // nonzero; `driftAmplitude` below proves the SHAPE those calls trace is static, not merely present.
    expect(rec.lineToCalls).toBeGreaterThan(0);
    expect(rec.strokes.filter((s) => s === PALETTE.putWall).length).toBeGreaterThan(0);
    expect(rec.strokes.filter((s) => s === PALETTE.callWall).length).toBeGreaterThan(0);
    expect(rec.strokes.filter((s) => s === PALETTE.gammaFlip).length).toBeGreaterThan(0);
  });
});

describe('driftAmplitude — criterion 22 (review), the automatable half', () => {
  it('is a STATIC frame under reduced motion: the same value at two different `now`s', () => {
    const a = driftAmplitude(0, 1000, true, false);
    const b = driftAmplitude(0, 5000, true, false);
    expect(a).toBe(b);
  });

  it('ANTI-VACUITY: is genuinely time-varying when NOT reduced (so the row above proves something)', () => {
    const a = driftAmplitude(0, 1000, false, false);
    const b = driftAmplitude(0, 5000, false, false);
    expect(a).not.toBe(b);
  });
});

/**
 * MUTATION PROOFS (criterion 57) — actually run against this file during the build (poisoned,
 * confirmed red, reverted), not kept as permanent poisoned tests (a permanently-red test would fail
 * CI). Exact captured output:
 *
 *   1. Removed `&& m.live` from the sweep/well gate (`if (!reduced && m.live)` → `if (!reduced)`).
 *      Re-ran: "live: false — trail, particles and the sweep+well gradients STOP" failed at line 102
 *      (`expect(rec.gradientFills).toBe(0)`) — `AssertionError: expected 2 to be +0`. Reverted.
 *   2. Removed `&& m.live` from the particle gate the same way. Re-ran: the same test failed at
 *      line 101 (`expect(rec.arcs).toBe(0)`) — `AssertionError: expected 1 to be +0`. Reverted.
 *   3. Replaced the drift block's `if (m.live) {` with `if (true) {` (always ran). Re-ran: the same
 *      test failed at line 106 (`expect(rec.lineToCalls).toBe(0)`) — `AssertionError: expected 336 to
 *      be +0` (7 lines × 48 `lineTo()` calls each). Reverted.
 *   4. Changed `driftAmplitude`'s reduced branch from a fixed constant to
 *      `(0.55 + 0.45 * Math.sin(now / 1400 + li)) * (reduced ? 0.35 : calm ? 0.55 : 1)` (time-
 *      dependent again). Re-ran: "is a STATIC frame under reduced motion" failed —
 *      `AssertionError: expected 0.29567476880561666 to be 0.12686633984882378`. Reverted.
 */
