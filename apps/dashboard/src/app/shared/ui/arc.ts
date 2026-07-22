/**
 * arc.ts — THE convex-arc geometry primitive (redesign-stage-2 §2-1; convexa-design skill
 * "arc in exactly 3 places"). Pure geometry: quadratic-arc path builders + the arc-X glyph
 * constants. No React, no theme, no color — consumers bind their own token slots.
 *
 * BINDING: this module has EXACTLY three permitted importers —
 *   1. `shell/ConvexaMark.tsx`   (the mark's arc-X glyph)
 *   2. `pages/landing/HeroCurve.tsx` (the one orchestrated hero moment)
 *   3. `shared/ui/ArcDivider.tsx` (the shared section-seam divider)
 * — enforced by SET EQUALITY in `arc.spec.ts` (§8-1). A fourth importer is a violation, not a
 * flourish: it fails the build. Deliberately NOT re-exported from the `shared/ui` barrel
 * (`index.ts`) so the importer scan stays sound — import the module path directly.
 */

/** A 2D point in SVG user units. */
export type Pt = readonly [number, number];

/** The single path constructor: one quadratic-Bézier arc `M from Q control to`. */
export function quadArcPath(from: Pt, control: Pt, to: Pt): string {
  return `M ${from[0]} ${from[1]} Q ${control[0]} ${control[1]} ${to[0]} ${to[1]}`;
}

/**
 * Control point for a chord bowed perpendicular by `bow` user units. Positive `bow` displaces
 * the control toward the LEFT normal of travel (for a left→right horizontal chord: upward).
 * The apex of the resulting quadratic sits at half the control displacement (bow/2).
 */
export function bowedControl(from: Pt, to: Pt, bow: number): Pt {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  // Left normal of (dx, dy) in SVG coordinates (y grows downward) = (dy, -dx) / len.
  const nx = dy / len;
  const ny = -dx / len;
  const mx = (from[0] + to[0]) / 2;
  const my = (from[1] + to[1]) / 2;
  return [round2(mx + nx * bow), round2(my + ny * bow)];
}

/** Convex arc over a chord — a quadratic bowed perpendicular by `bow` (see `bowedControl`). */
export function bowedArcPath(from: Pt, to: Pt, bow: number): string {
  return quadArcPath(from, bowedControl(from, to, bow), to);
}

/**
 * A chained multi-segment arc: `M from Q c1 p1 Q c2 p2 …` — for silhouettes a single quadratic
 * cannot carry (e.g. the hero payoff curve: a long baseline-hugging run, then the steep convex
 * sweep). Callers keep tangent continuity by placing each control on the previous segment's
 * end-tangent line.
 */
export function quadChainPath(from: Pt, ...segments: ReadonlyArray<readonly [Pt, Pt]>): string {
  return (
    `M ${from[0]} ${from[1]} ` +
    segments.map(([control, to]) => `Q ${control[0]} ${control[1]} ${to[0]} ${to[1]}`).join(' ')
  );
}

/**
 * Numerically measured quadratic-arc length (dense polyline sum — deterministic). Used by the
 * hero moment to pin its stroke-dash constants; cheap enough to compute once at module load.
 */
export function quadArcLength(from: Pt, control: Pt, to: Pt, steps = 256): number {
  let length = 0;
  let px = from[0];
  let py = from[1];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x = u * u * from[0] + 2 * u * t * control[0] + t * t * to[0];
    const y = u * u * from[1] + 2 * u * t * control[1] + t * t * to[1];
    length += Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  return length;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ------------------------------------------------------------------------------------------
// The arc-X glyph — "the X cut from two convex arcs" (proposal §3 signature #1).
// Single-sourced geometry: the ConvexaMark lockup renders these paths live; the favicon /
// apple-touch / og assets are GENERATED from the same constants by
// `apps/dashboard/tools/generate-brand-assets.mts` (committed binaries are the contract).
// ------------------------------------------------------------------------------------------

/** The glyph design box (square — the Expanded caps voice carries a wide X). */
export const ARC_X_VIEWBOX = '0 0 100 100';

/**
 * The two convex strokes. Each is a payoff-curve-like convex arc (bowed, never a straight
 * diagonal): the up-stroke rises bottom-left → top-right hugging the baseline before sweeping
 * up (the hero curve's own gesture); the down-stroke is its mirror. They cross just below
 * optical center — a slightly dropped waist, owned as a brand trait.
 */
export const ARC_X_PATHS: readonly [string, string] = [
  // Up-stroke: bottom-left → top-right, convex (control pulled toward the lower-right).
  quadArcPath([12, 91], [58, 62], [88, 9]),
  // Down-stroke: top-left → bottom-right (mirror of the up-stroke).
  quadArcPath([12, 9], [42, 62], [88, 91]),
] as const;

/** Lockup stroke weight (glyph units) — optically matched to the Archivo 700 Expanded stem. */
export const ARC_X_STROKE = 18;

/**
 * Favicon/monogram stroke weight (glyph units) — a SMALL-SIZE MASTER: deliberately heavier
 * than the lockup weight so the X survives a 16px browser tab, never a naive scale-down.
 */
export const ARC_X_FAVICON_STROKE = 21;
