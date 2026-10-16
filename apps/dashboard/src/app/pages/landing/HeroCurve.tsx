/**
 * HeroCurve — THE one orchestrated motion moment (redesign-stage-2 §4; proposal §3 signature #2):
 * the landing hero's payoff curve draws itself on mount and settles into the baseline. Landing-only,
 * so it lives on the page (dependency direction §1). One of `shared/ui/arc.ts`'s exactly-three
 * importers.
 *
 * Geometry (owned, never charted): a single convex payoff silhouette — flat-to-shallow and
 * baseline-hugging on the left, curving smoothly up to exit top-right (slope monotonically
 * increasing: that IS convexity) — plus the horizontal baseline it settles into. No data binding,
 * no fetch, no axis labels, no numbers: decorative geometry only (`aria-hidden`).
 *
 * Paint: curve = `primary.main` stroke (THE signature — not 16% wallpaper), baseline =
 * `text.secondary` at low opacity. NO fill, NO glow, NO radial gradient (the blob rode out with
 * the deleted hero motif; §8-7 scans for it).
 *
 * Motion (the ONE-motion rule): stroke-dash draw — paint-only, it repaints and never lays out.
 * Keyframes animate ONLY {stroke-dashoffset, opacity, transform} (§8-3 pins the set). The wrapper
 * is an absolute inset-0 overlay behind the hero copy: the hero box is sized by its CONTENT, so
 * the animation cannot shift layout by construction. One-shot on mount; never replays on
 * re-render. Reduced motion (the SHARED `useReducedMotion` hook, §4.2) renders the static final
 * frame — belt-and-braces, the CSS classes are also disabled under
 * `@media (prefers-reduced-motion: reduce)`.
 */
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { quadArcLength, quadChainPath, type Pt } from '@/shared/ui/arc';
import Box from '@mui/material/Box';
import { keyframes } from '@mui/material/styles';

// The payoff silhouette in a 1200×400 design box. The draw ORIGIN is the left, baseline-hugging
// end, so completing the draw visually plants the curve on the axis. Two tangent-continuous
// quadratic segments (a single quadratic rises too early): a long shallow run that keeps the
// curve UNDER the hero copy/CTAs, then the steep convex sweep exiting top-right through the
// hero's empty right region — slope monotonically increasing across both (that IS convexity).
const FROM: Pt = [0, 360];
const SEG1: readonly [Pt, Pt] = [
  [350, 359.5],
  [700, 352],
]; //     control on the baseline → tangent start
const SEG2: readonly [Pt, Pt] = [
  [1015, 345.25],
  [1200, 25],
]; //   control on SEG1's end tangent → smooth join
const CURVE_PATH = quadChainPath(FROM, SEG1, SEG2);
/** Path length in user units, computed once at module load (deterministic). */
const CURVE_LENGTH = Math.ceil(
  quadArcLength(FROM, SEG1[0], SEG1[1]) + quadArcLength(SEG1[1], SEG2[0], SEG2[1]),
);

const BASELINE_OPACITY = 0.35;
const CURVE_OPACITY = 0.9;

// §8-3: keyframes reference ONLY stroke-dashoffset / opacity / transform.
const drawIn = keyframes`
  from { stroke-dashoffset: ${CURVE_LENGTH}; }
  to { stroke-dashoffset: 0; }
`;
const baselineIn = keyframes`
  from { opacity: 0; }
  to { opacity: ${BASELINE_OPACITY}; }
`;

export function HeroCurve() {
  const reduced = useReducedMotion();

  return (
    <Box
      aria-hidden
      data-testid="hero-curve"
      sx={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        // The geometry needs the two-column hero: its steep sweep exits through the right column,
        // behind the surface panel. In one column (under `laptop`, the hero grid's own breakpoint)
        // there is no empty right region, and the stretched sweep cut through the headline, both
        // actions and the caption at 390 px (site check D-06). The phone board draws no curve.
        display: { xs: 'none', laptop: 'block' },
      }}
    >
      <Box
        component="svg"
        viewBox="0 0 1200 400"
        preserveAspectRatio="none"
        data-testid="hero-curve-svg"
        sx={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          '& .hero-curve-baseline': {
            stroke: (theme) => theme.palette.text.secondary,
            opacity: BASELINE_OPACITY,
          },
          '& .hero-curve-baseline-fade': {
            animation: `${baselineIn} 200ms ease-out both`,
          },
          '& .hero-curve-path': {
            stroke: (theme) => theme.palette.primary.main,
            opacity: CURVE_OPACITY,
          },
          // The draw: decisive start, soft settle (§4.2 — ~900ms, 150ms delay). `forwards` pins
          // the final frame; the class is applied once on mount and never toggled (one-shot).
          '& .hero-curve-draw': {
            strokeDasharray: CURVE_LENGTH,
            strokeDashoffset: CURVE_LENGTH,
            animation: `${drawIn} 900ms cubic-bezier(0.16, 1, 0.3, 1) 150ms forwards`,
          },
          // Belt-and-braces CSS fallback: even if JS misses the preference, the static final
          // frame renders (no dash, no animation).
          '@media (prefers-reduced-motion: reduce)': {
            '& .hero-curve-draw': {
              animation: 'none',
              strokeDasharray: 'none',
              strokeDashoffset: 0,
            },
            '& .hero-curve-baseline-fade': { animation: 'none' },
          },
        }}
      >
        {/* The baseline the curve settles into — quiet steel, fades in first (~200ms). */}
        <line
          className={
            reduced ? 'hero-curve-baseline' : 'hero-curve-baseline hero-curve-baseline-fade'
          }
          data-testid="hero-curve-baseline"
          x1={0}
          y1={FROM[1]}
          x2={1200}
          y2={FROM[1]}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {/* THE curve. Reduced motion → no draw class: full stroke, at rest (§8-2 named test). */}
        <path
          className={reduced ? 'hero-curve-path' : 'hero-curve-path hero-curve-draw'}
          data-testid="hero-curve-path"
          d={CURVE_PATH}
          fill="none"
          strokeWidth={3}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </Box>
    </Box>
  );
}

export default HeroCurve;
