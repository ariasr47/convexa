/**
 * FreshPositioning — the full-chain unusual-strike list (Vol/OI ≥ cutoff), ranked desc, top-N (Figma
 * `Ticker · Fresh Positioning`, node 149:639): a card with header + subtitle over recessed mono rows
 * (`$strike · Vol/OI N× · N contracts`). Static bundle field; activity only, no side/direction;
 * catches strikes outside the chart window.
 */
import { faceFor, figureStateOf } from '@/shared/figure';
import { Widget } from '@/shared/ui/Widget';
import type { StrikeRow } from '@convexa/api';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { fmtThresh, freshCaption, volOiTip, withStructureAge } from '../_kit/copy';

interface Props {
  chainVolOiRatio: number | null;
  volOiThreshold: number;
  unusualStrikes: StrikeRow[];
  /** Fill the parent's height (for the side-by-side row) instead of the default top margin. */
  fillHeight?: boolean;
  /** REST-bundle age (seconds) — product spine #4. */
  structureAgeSeconds?: number | null;
}

export function FreshPositioning({
  chainVolOiRatio,
  volOiThreshold,
  unusualStrikes,
  structureAgeSeconds = null,
}: Props) {
  return (
    <Widget
      id="fresh-positioning"
      title="Fresh positioning (Vol/OI)"
      subtitle={withStructureAge(freshCaption(volOiThreshold), structureAgeSeconds)}
      info={volOiTip(volOiThreshold, unusualStrikes.length)}
    >
      <Box>
        {chainVolOiRatio == null ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Vol/OI unavailable this cycle.
          </Typography>
        ) : unusualStrikes.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No strikes above the {fmtThresh(volOiThreshold)}× Vol/OI cutoff this session.
          </Typography>
        ) : (
          <Stack spacing={0.5}>
            {unusualStrikes.map((s) => {
              // The strike + Vol/OI ratio — always a real Convexa-computed figure on a row the
              // backend returned (SPEC §2.4): traced register through the shared module.
              const headState = figureStateOf({
                value: `$${s.strike} · Vol/OI ${(s.vol_oi_ratio as number).toFixed(2)}×`,
                register: 'traced',
              });
              // The contract count is a SEPARATE figure that can itself be absent — the absent
              // token gets its own Sans span at the row's own 12px (never `FigureCell`'s 15px
              // literal size, which would invert this 12px list's hierarchy) rather than sitting
              // inside the mono run (criterion 54: no untraced/not-a-number member in mono).
              const volumeText = s.volume != null ? s.volume.toLocaleString() : '—';
              const volumeState = figureStateOf({ value: volumeText, register: 'traced' });
              return (
                <Box
                  key={s.strike}
                  sx={{ px: 1.5, py: 1, borderRadius: 1.5, bgcolor: 'action.hover' }}
                >
                  <Typography
                    component="span"
                    data-figure-state={headState.figureState}
                    data-figure-register={headState.mono ? 'mono' : 'sans'}
                    sx={{ ...faceFor(headState.mono), fontSize: 12 }}
                  >
                    {`$${s.strike} · Vol/OI ${(s.vol_oi_ratio as number).toFixed(2)}× · `}
                  </Typography>
                  <Typography
                    component="span"
                    data-figure-state={volumeState.figureState}
                    data-figure-register={volumeState.mono ? 'mono' : 'sans'}
                    sx={{ ...faceFor(volumeState.mono), fontSize: 12 }}
                  >
                    {volumeText}
                  </Typography>
                  <Typography component="span" sx={{ ...faceFor(headState.mono), fontSize: 12 }}>
                    {' contracts'}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>
    </Widget>
  );
}

export default FreshPositioning;
