/**
 * OffExchangeBlocks — the largest-notional off-exchange ("dark pool") block prints (Figma
 * `Ticker · Off-Exchange Blocks`, node 149:667): a card with header + subtitle over recessed rows,
 * each `N sh @ $price` (mono) + a proximity tint chip + age. Rides the REST bundle only (never the
 * live stream), no offline state of its own, ages with the bundle freshness. Hidden when the Dark
 * pool toggle is off. Best-effort: off_exchange absent → its own "unavailable this cycle" copy.
 */
import { Box, Card, CardContent, Stack, Typography, Tooltip } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { OffExchange } from '@org/api';
import { BLOCK_MIN_SHARES_DISPLAY, BLOCKS_TOOLTIP, PROXIMITY_TOOLTIP, humanAge } from './copy';
import { typographyTokens } from '../../tokens';
import { TintChip } from './TintChip';

const MONO = typographyTokens.monoFontFamily;

interface Props {
  offExchange: OffExchange | null | undefined;
}

export function OffExchangeBlocks({ offExchange }: Props) {
  return (
    <Card variant="outlined" sx={{ mt: 3, borderRadius: 3 }}>
      <CardContent>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Typography variant="h6">Off-exchange blocks</Typography>
          <Tooltip arrow title={BLOCKS_TOOLTIP}>
            <InfoOutlinedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
          </Tooltip>
        </Stack>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
          Largest recent off-exchange prints near spot. Context, not a signal — no side or direction.
        </Typography>

        {!offExchange ? (
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>
            Off-exchange data unavailable this cycle.
          </Typography>
        ) : !(offExchange.blocks?.length) ? (
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>
            No blocks ≥ {(offExchange.block_min_shares ?? BLOCK_MIN_SHARES_DISPLAY).toLocaleString()} shares in the recent window.
          </Typography>
        ) : (
          <Stack spacing={0.5}>
            {/* Already largest-notional-first, top-5 from the backend — render in order, no re-sort/re-cap. */}
            {offExchange.blocks.map((b, i) => {
              const pct = b.proximity_pct * 100; // payload is a signed ratio vs spot
              const prox = `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}% vs spot`;
              return (
                <Box key={i} sx={{
                  px: 1.5, py: 1, borderRadius: 1.5, bgcolor: 'action.hover',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', rowGap: 0.5,
                }}>
                  <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                    <Typography sx={{ fontFamily: MONO, fontSize: 12 }}>
                      {b.shares.toLocaleString()} sh @ ${b.price.toFixed(2)}
                    </Typography>
                    {/* Proximity is context, not direction — a fixed (non-directional) tint. */}
                    <Tooltip arrow title={PROXIMITY_TOOLTIP}>
                      <span><TintChip tone="success" label={prox} /></span>
                    </Tooltip>
                  </Stack>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {humanAge(b.age_seconds)} ago
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

export default OffExchangeBlocks;
