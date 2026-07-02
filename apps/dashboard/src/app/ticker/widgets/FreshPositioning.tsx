/**
 * FreshPositioning — the full-chain unusual-strike list (Vol/OI ≥ cutoff), ranked desc, top-N (Figma
 * `Ticker · Fresh Positioning`, node 149:639): a card with header + subtitle over recessed mono rows
 * (`$strike · Vol/OI N× · N contracts`). Static bundle field; activity only, no side/direction;
 * catches strikes outside the chart window.
 */
import { Box, Stack, Typography } from '@mui/material';
import type { StrikeRow } from '@org/api';
import { fmtThresh, freshCaption, volOiTip } from './copy';
import { typographyTokens } from '../../tokens';
import { Widget } from './Widget';

const MONO = typographyTokens.monoFontFamily;

interface Props {
  chainVolOiRatio: number | null;
  volOiThreshold: number;
  unusualStrikes: StrikeRow[];
  /** Fill the parent's height (for the side-by-side row) instead of the default top margin. */
  fillHeight?: boolean;
  revealIndex?: number;
}

export function FreshPositioning({ chainVolOiRatio, volOiThreshold, unusualStrikes, revealIndex }: Props) {
  return (
    <Widget
      id="fresh-positioning" title="Fresh positioning (Vol/OI)"
      subtitle={freshCaption(volOiThreshold)}
      info={volOiTip(volOiThreshold, unusualStrikes.length)}
      revealIndex={revealIndex}
    >
      <Box>
        {chainVolOiRatio == null ? (
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>Vol/OI unavailable this cycle.</Typography>
        ) : unusualStrikes.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>
            No strikes above the {fmtThresh(volOiThreshold)}× Vol/OI cutoff this session.
          </Typography>
        ) : (
          <Stack spacing={0.5}>
            {unusualStrikes.map((s) => (
              <Box key={s.strike} sx={{ px: 1.5, py: 1, borderRadius: 1.5, bgcolor: 'action.hover' }}>
                <Typography sx={{ fontFamily: MONO, fontSize: 12 }}>
                  ${s.strike}  ·  Vol/OI {(s.vol_oi_ratio as number).toFixed(2)}×  ·  {s.volume?.toLocaleString() ?? '—'} contracts
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Box>
    </Widget>
  );
}

export default FreshPositioning;
