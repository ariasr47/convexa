/**
 * A sample source chip (canon P-8 and the 2026-10-13 provenance-chip row): dashed, in the chart
 * frame's source-chip drawing, naming what the sample is shaped like ("Shaped like a delayed SPY
 * quote · Oct 7, 2:30 PM ET"). Not a link: sample data has no document to open.
 *
 * Type and sides are the library's chip scale (fidelity FND-07: 11px/500, 9px label sides) on the
 * board's `.prov` line (Mono 11/1.2, 24px tall). At 390 the masthead's chip then fits one line in
 * the 358px column, as the board's does: with 10px sides and a 1.35 line its text needed 0.7px more
 * than the column gave and wrapped to two lines (39.7px tall). A longer text still wraps.
 */
import { typographyTokens } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';

export function SampleSourceChip({ text }: { text: string }) {
  return (
    <Box
      component="span"
      data-provenance="sample"
      sx={(t) => ({
        display: 'inline-block',
        maxWidth: '100%',
        minHeight: 24,
        px: '9px',
        py: '4.4px',
        fontFamily: typographyTokens.monoFontFamily,
        fontSize: 11,
        fontWeight: 500,
        lineHeight: 1.2,
        borderRadius: '12px',
        border: `1px dashed ${alpha(t.palette.text.secondary, 0.55)}`,
        color: 'text.secondary',
        overflowWrap: 'anywhere',
      })}
    >
      {text}
    </Box>
  );
}
