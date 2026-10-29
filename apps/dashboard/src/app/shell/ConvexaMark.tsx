/**
 * ConvexaMark — the CONVEXA lockup (redesign-stage-2 §3; proposal §3 signature #1). UI-ONLY brand
 * surface: the single place the visible wordmark renders (TopNav bar + drawer, Footer). It carries
 * NO data, NO fetch.
 *
 * Composition: `[CONVE] [arc-X glyph] [A]` — one word, caps, Archivo EXPANDED (a REAL `wdth` axis
 * value, never a faux transform). The X is the ONLY custom geometry: an inline SVG cut from two convex
 * arcs, geometry single-sourced from `shared/ui/arc.ts` (one of that module's exactly-three
 * importers). The glyph binds `primary.main` (gammaAmber — the one amber element in the lockup);
 * the letters bind the mounting context's `color` (text.primary). NO gradient anywhere (§8-5).
 *
 * Accessibility: the split text nodes would read "CONVE A", so the wrapper carries `role="img"` +
 * `aria-label="Convexa"` (the stable accessible name) and every inner node is aria-hidden.
 * The arc-X is sized in `em` against cap height, so a pre-Archivo fallback render may reflow
 * slightly on font swap but never collides (§3.1 accepted cost).
 */
import { typographyTokens } from '@/shared/theme/tokens';
import { ARC_X_PATHS, ARC_X_STROKE, ARC_X_VIEWBOX } from '@/shared/ui/arc';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface Props {
  /** Legacy call-site prop (nav ≈ 18, footer 16) — kept so call sites need zero churn; the
   *  lockup now scales purely with `fontSize` (the X is sized in em against cap height). */
  size?: number;
  /** Wordmark font size (CSS). Defaults to a nav-appropriate size. */
  fontSize?: string | number;
}

/** Shared letter treatment: Archivo Expanded 700 caps with slight positive tracking. */
const LETTERS = {
  fontFamily: typographyTokens.displayFontFamily,
  // The lockup wants full Expanded — the vendored Archivo variable file carries wdth 100–125%
  // (styles.css @font-face), so 125% is a REAL width, never a faux transform stretch (§3.2;
  // §10-4 n/a — the axis ceiling IS 125%).
  fontStretch: '125%',
  fontWeight: 700,
  letterSpacing: '0.03em',
  lineHeight: 1,
} as const;

export function ConvexaMark({ fontSize = '1.15rem' }: Props) {
  return (
    <Box
      role="img"
      aria-label="Convexa"
      data-testid="convexa-lockup"
      sx={{ display: 'inline-flex', alignItems: 'baseline', fontSize }}
    >
      <Typography aria-hidden component="span" sx={{ ...LETTERS, fontSize: 'inherit' }}>
        CONVE
      </Typography>
      {/* The arc-X — two convex arcs crossing; bottom edge sits on the text baseline
          (SVG baseline = bottom margin edge in a baseline-aligned flex row). */}
      <Box
        component="svg"
        viewBox={ARC_X_VIEWBOX}
        aria-hidden
        data-testid="convexa-mark"
        sx={{
          // Cap-height square (Archivo caps ≈ 0.72em); a touch of side-bearing via margin.
          width: '0.74em',
          height: '0.72em',
          mx: '0.045em',
          flexShrink: 0,
          color: 'primary.main',
          overflow: 'visible',
        }}
      >
        {ARC_X_PATHS.map((d) => (
          <path
            key={d}
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth={ARC_X_STROKE}
            strokeLinecap="round"
          />
        ))}
      </Box>
      <Typography aria-hidden component="span" sx={{ ...LETTERS, fontSize: 'inherit' }}>
        A
      </Typography>
    </Box>
  );
}

export default ConvexaMark;
