/**
 * TintChip — the small tinted status pill from the Figma ticker widgets (colored text on a subtle
 * same-color tint): proximity chips (Off-Exchange Blocks), conviction tags (Setups), etc. `neutral`
 * renders a muted grey. Non-directional by design — the tone is chosen by the caller.
 */
import { Box } from '@mui/material';
import { alpha } from '@mui/material/styles';

type Tone = 'success' | 'error' | 'info' | 'warning' | 'neutral';

export function TintChip({ tone, label }: { tone: Tone; label: string }) {
  return (
    <Box
      component="span"
      sx={(t) => ({
        display: 'inline-flex',
        alignItems: 'center',
        px: 0.75,
        py: '2px',
        borderRadius: '999px',
        fontSize: 11, // chip/label type floor ≥11px (Stage 0 item 4; 9px was the documented failure)
        fontWeight: 500,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        lineHeight: 1.5,
        color: tone === 'neutral' ? t.palette.text.secondary : t.palette[tone].main,
        bgcolor:
          tone === 'neutral'
            ? alpha(t.palette.text.secondary, 0.16)
            : alpha(t.palette[tone].main, 0.16),
      })}
    >
      {label}
    </Box>
  );
}

export default TintChip;
