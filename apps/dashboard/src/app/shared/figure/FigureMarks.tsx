/**
 * `FigureMarks` — the two value/label-row marks, MOVED out of `FigureCell.tsx` (`:130-149` and
 * `:154-156` before this change) as named exports (curvature-v2-surfaces SPEC §2.1, PLAN FE-1
 * step 3).
 *
 * WHY THE MOVE IS THE POINT. Both were module-private in `FigureCell.tsx` — that file exported only
 * `FigureCellProps`, `FigureCell`, `StatSkeleton` and its default — so the stroke pause icon was
 * genuinely unreachable outside the primitive, and every surface that needed one reached for the
 * literal `⏸` glyph instead (six sites on positions/broker today). Criteria 12, 27a, 27b, 28, 29
 * and 35e all wait on this landing.
 *
 * The bodies below are byte-for-byte the shipped ones, `data-testid="figure-live-dot"` and the
 * visually-hidden word `live` included — nine shipped desk specs key on that testid, and this task
 * is a move, not a rewrite.
 */
import PauseIcon from '@mui/icons-material/Pause';
import Box from '@mui/material/Box';

/** Standard MUI clip-rect visually-hidden technique (matches the established local pattern in
 *  `pages/scanner/ScanCard.tsx` — no shared util exists yet, so this follows that convention). */
const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  p: 0,
  m: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

/** The label-row live dot — the FIGURE's own claim, never the widget/chip claim (SPEC §4.1: three
 *  scopes never merge). Decorative + static; carries the single visually-hidden word "live". */
export function LiveDot() {
  return (
    <Box
      component="span"
      data-testid="figure-live-dot"
      sx={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        bgcolor: 'info.main',
        flex: '0 0 auto',
      }}
    >
      <Box component="span" sx={visuallyHidden}>
        live
      </Box>
    </Box>
  );
}

/** The value-row pause mark (F4/F5 only) — a real SVG icon component, never the literal `⏸` glyph
 *  in the copy (canon Icons row: any platform that colour-emoji-renders it must get the stroke
 *  icon instead). Decorative — the caption words already say "offline". */
export function PauseMark() {
  return <PauseIcon aria-hidden sx={{ fontSize: 14, color: 'text.secondary', flex: '0 0 auto' }} />;
}
