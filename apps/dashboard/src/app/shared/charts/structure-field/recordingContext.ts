/**
 * A recording fake `CanvasRenderingContext2D` (SPEC §7, PLAN FE-4). `single-motion-moment.spec.ts:
 * 54-55` matches only LITERAL `@keyframes <name>` text, so a Canvas2D rAF loop — the sweep, the
 * drift, the particles, the trail — declares nothing that scan can see. THIS is the enforcement for
 * them: drive `paintStructureStep`/`paintFrameStep` (`paintStep.ts`) against a fake context and count
 * what was actually drawn.
 *
 * Records exactly what criterion 20 is keyed on and nothing else — a recorder that captures every
 * Canvas2D call makes the assertions unreadable and the failures unattributable (SPEC row 20's own
 * "against a recording 2D context" clause names four things: trail points, particle `arc()` calls,
 * sweep gradient fills, and non-zero level strokes).
 *
 * BUCKETING, stated plainly so nobody re-derives it under time pressure:
 *   - `trailPoints` — `arc()` calls at the mid-trail's one hardcoded dot radius, `2.2`
 *     (`paintFrameStep`'s "Tape: mid trail" block). Every other `arc()` in the file (particles, the
 *     tape bead + outer ring, the hover probe) uses a radius that is never exactly `2.2`, so this is
 *     a genuine bucket, not a coincidence of the fixtures below.
 *   - `arcs` — every OTHER `arc()` call. In `paintStep.spec.ts`'s criterion-20 fixtures `liveMid` is
 *     left `null`, so the tape block (bead/ring) and the hover probe never run — the only possible
 *     source of a non-trail arc is the particle field, which is exactly what the assertions need.
 *   - `gradientFills` — every `createLinearGradient()`/`createRadialGradient()` call, structure step
 *     and frame step alike. `paintStructureStep` alone produces a nonzero, `m.live`-independent count
 *     (vignette, wall blooms, heat columns, area fill), so tests reset this counter to `0` AFTER
 *     calling the structure step and BEFORE calling the frame step — the assertion is "the frame step
 *     contributed nothing", not "nothing was ever drawn".
 *   - `strokes` — every `stroke()` call's CURRENT `strokeStyle`, in call order. The level lines set
 *     `strokeStyle` to a raw `palette.*` value (no alpha wrapping); every other stroke in the file
 *     (drift, the tape's dashed line, the hover crosshair) wraps its colour in `withAlpha(...)`,
 *     producing a different string. Filtering for exact equality to a raw palette colour is therefore
 *     a real, non-coincidental bucket for "did a level line paint".
 *   - `lineToCalls` — every `lineTo()` call. The structure step's own guides/level-lines/curve each
 *     call it too, so this is reset the same way `gradientFills` is. With `liveMid: null` and no
 *     hover point (`paintStep.spec.ts`'s criterion-20 fixtures), the ONLY frame-step source of a
 *     `lineTo()` is the warped field-line drift — this is what proves drift's `if (m.live)` gate
 *     (SPEC row 20's "drift ... stop", not itself one of the row's four named machine checks, but
 *     verified anyway rather than left as an unenforced prose claim).
 */

export interface Recording {
  trailPoints: number;
  arcs: number;
  gradientFills: number;
  strokes: string[];
  lineToCalls: number;
}

const TRAIL_DOT_RADIUS = 2.2;

export function recordingContext(): { ctx: CanvasRenderingContext2D; rec: Recording } {
  const rec: Recording = { trailPoints: 0, arcs: 0, gradientFills: 0, strokes: [], lineToCalls: 0 };
  let currentStrokeStyle = '';

  const target: Record<string, unknown> = {
    measureText: (text: string) => ({ width: text.length * 7 }),
    createLinearGradient: () => {
      rec.gradientFills += 1;
      return { addColorStop: () => undefined };
    },
    createRadialGradient: () => {
      rec.gradientFills += 1;
      return { addColorStop: () => undefined };
    },
    arc: (_x: number, _y: number, r: number) => {
      if (r === TRAIL_DOT_RADIUS) rec.trailPoints += 1;
      else rec.arcs += 1;
    },
    lineTo: () => {
      rec.lineToCalls += 1;
    },
    stroke: () => {
      rec.strokes.push(currentStrokeStyle);
    },
  };

  const ctx = new Proxy(target, {
    get: (t, key) => {
      if (key === 'strokeStyle') return currentStrokeStyle;
      if (key in t) return t[key as string];
      return () => undefined;
    },
    set: (t, key, value) => {
      if (key === 'strokeStyle') currentStrokeStyle = String(value);
      t[key as string] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;

  return { ctx, rec };
}
