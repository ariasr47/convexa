/**
 * FreshPositioning — the full-chain unusual-strike list (Vol/OI ≥ cutoff), ranked desc, top-N (Figma
 * `Ticker · Fresh Positioning`, node 149:639): a card with header + subtitle over recessed mono rows
 * (`$strike · Vol/OI N× · N contracts`). Static bundle field; activity only, no side/direction;
 * catches strikes outside the chart window.
 */
import { Box, Card, CardContent, Stack, Typography, Tooltip } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { StrikeRow } from '@org/api';
import { fmtThresh, freshCaption, volOiTip } from './copy';
import { typographyTokens } from '../../tokens';

const MONO = typographyTokens.monoFontFamily;

interface Props {
  chainVolOiRatio: number | null;
  volOiThreshold: number;
  unusualStrikes: StrikeRow[];
}

export function FreshPositioning({ chainVolOiRatio, volOiThreshold, unusualStrikes }: Props) {
  return (
    <Card variant="outlined" sx={{ mt: 3, borderRadius: 3 }}>
      <CardContent>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Typography variant="h6">Fresh positioning (Vol/OI)</Typography>
          <Tooltip arrow title={volOiTip(volOiThreshold, unusualStrikes.length)}>
            <InfoOutlinedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
          </Tooltip>
        </Stack>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
          {freshCaption(volOiThreshold)}
        </Typography>

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
      </CardContent>
    </Card>
  );
}

export default FreshPositioning;
