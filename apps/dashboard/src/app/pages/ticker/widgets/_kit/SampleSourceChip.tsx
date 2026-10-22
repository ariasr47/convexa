/**
 * A sample source chip (canon P-8 and the 2026-10-13 provenance-chip row): dashed, in the chart
 * frame's source-chip drawing, naming what the sample is shaped like ("Shaped like a delayed SPY
 * quote · Oct 7, 2:30 PM ET"). Not a link: sample data has no document to open.
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
        px: 1.25,
        py: '4px',
        fontFamily: typographyTokens.monoFontFamily,
        fontSize: 11,
        lineHeight: 1.35,
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
