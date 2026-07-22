/**
 * ArcDivider — the shared arc section divider (redesign-stage-2 §5; proposal §3 signature #3):
 * a full-width SHALLOW convex arc replacing a straight `<Divider/>` rule at section boundaries.
 * One of `shared/ui/arc.ts`'s exactly-three importers. Deliberately NOT exported from the
 * `shared/ui` barrel — consumers import the module path directly so the §8-1 seam pin
 * (importers == {shell/Footer.tsx, features/trading/outcomes/TrackRecordSection.tsx}) stays sound.
 *
 * Quiet structure by design: stroke = the `divider` palette slot at strokeWidth 1 — the signature
 * is the SHAPE, not a new amber spend. Fixed height (box reserved — no layout shift vs the `<hr>`
 * it replaces). Semantics: it replaces a `<Divider/>` (= `<hr>`), so the wrapper carries
 * `role="separator"` + `aria-orientation="horizontal"`; the SVG itself is aria-hidden.
 */
import { bowedArcPath } from '@/shared/ui/arc';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

/** Reserved divider height in px (contract §5.1: ~16–24, fixed). */
const HEIGHT = 20;
/** Shallow bow: control offset 4 units up → apex rise 2px ≈ 10% of height (a breath, not a hill). */
const ARC_PATH = bowedArcPath([0, 17], [1200, 17], 4);

export interface ArcDividerProps {
  /** Margin/spacing carried over from the replaced `<Divider/>` call site. */
  sx?: SxProps<Theme>;
}

export function ArcDivider({ sx }: ArcDividerProps) {
  return (
    <Box
      role="separator"
      aria-orientation="horizontal"
      data-testid="arc-divider"
      sx={[
        { height: HEIGHT, width: '100%', color: 'divider', flexShrink: 0 },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box
        component="svg"
        aria-hidden
        viewBox={`0 0 1200 ${HEIGHT}`}
        preserveAspectRatio="none"
        sx={{ display: 'block', width: '100%', height: '100%' }}
      >
        {/* non-scaling stroke: preserveAspectRatio="none" must not fatten the 1px rule. */}
        <path
          d={ARC_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </Box>
    </Box>
  );
}

export default ArcDivider;
