/**
 * OffExchangeBlocks — the largest-notional off-exchange ("dark pool") block prints (Figma
 * `Ticker · Off-Exchange Blocks`, node 149:667): a card with header + subtitle over recessed rows,
 * each `N sh @ $price` (mono) + a proximity tint chip + age. Rides the REST bundle only (never the
 * live stream), no offline state of its own, ages with the bundle freshness. Hidden when the Dark
 * pool toggle is off. Best-effort: off_exchange absent → its own "unavailable this cycle" copy.
 */
import { typographyTokens } from '@/shared/theme/tokens';
import { TintChip } from '@/shared/ui/TintChip';
import { Widget } from '@/shared/ui/Widget';
import { Box, Stack, Tooltip, Typography } from '@mui/material';
import type { OffExchange } from '@convexa/api';
import {
  BLOCK_MIN_SHARES_DISPLAY,
  BLOCKS_TOOLTIP,
  humanAge,
  PROXIMITY_TOOLTIP,
  withStructureAge,
} from '../_kit/copy';

const MONO = typographyTokens.monoFontFamily;

interface Props {
  offExchange: OffExchange | null | undefined;
  /** Fill the parent's height (for the side-by-side row) instead of the default top margin. */
  fillHeight?: boolean;
  /** REST-bundle age (seconds) — product spine #4. */
  structureAgeSeconds?: number | null;
}

export function OffExchangeBlocks({ offExchange, structureAgeSeconds = null }: Props) {
  return (
    <Widget
      id="off-exchange-blocks"
      title="Off-exchange blocks"
      info={BLOCKS_TOOLTIP}
      subtitle={withStructureAge(
        'Largest recent off-exchange prints near spot. Context, not a signal — no side or direction',
        structureAgeSeconds,
      )}
    >
      <Box>
        {!offExchange ? (
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>
            Off-exchange data unavailable this cycle.
          </Typography>
        ) : !offExchange.blocks?.length ? (
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>
            No blocks ≥{' '}
            {(offExchange.block_min_shares ?? BLOCK_MIN_SHARES_DISPLAY).toLocaleString()} shares in
            the recent window.
          </Typography>
        ) : (
          <Stack spacing={0.5}>
            {/* Already largest-notional-first, top-5 from the backend — render in order, no re-sort/re-cap. */}
            {offExchange.blocks.map((b, i) => {
              const pct = b.proximity_pct * 100; // payload is a signed ratio vs spot
              const prox = `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}% vs spot`;
              return (
                <Box
                  key={i}
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderRadius: 1.5,
                    bgcolor: 'action.hover',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    flexWrap: 'wrap',
                    rowGap: 0.5,
                  }}
                >
                  <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                    <Typography sx={{ fontFamily: MONO, fontSize: 12 }}>
                      {b.shares.toLocaleString()} sh @ ${b.price.toFixed(2)}
                    </Typography>
                    {/* Proximity is context, not direction — NEUTRAL (stage-3 §5.3: the old
                        `success` tint tripped the green/red reservation on a datum whose own
                        subtitle says "no side or direction"). */}
                    <Tooltip arrow title={PROXIMITY_TOOLTIP}>
                      <span>
                        <TintChip tone="neutral" label={prox} />
                      </span>
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
      </Box>
    </Widget>
  );
}

export default OffExchangeBlocks;
