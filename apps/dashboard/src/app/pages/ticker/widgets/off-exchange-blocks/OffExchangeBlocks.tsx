/**
 * OffExchangeBlocks — the largest-notional off-exchange ("dark pool") block prints (Figma
 * `Ticker · Off-Exchange Blocks`, node 149:667): a card with header + subtitle over recessed rows,
 * each `N sh @ $price` (mono) + a proximity tint chip + age. Rides the REST bundle only (never the
 * live stream), no offline state of its own, ages with the bundle freshness. Hidden when the Dark
 * pool toggle is off. Best-effort: off_exchange absent → its own "unavailable this cycle" copy.
 */
import { memo } from 'react';
import { faceFor, figureStateOf } from '@/shared/figure';
import { TintChip } from '@/shared/ui/TintChip';
import { Widget } from '@/shared/ui/Widget';
import type { OffExchange } from '@convexa/api';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  BLOCK_MIN_SHARES_DISPLAY,
  BLOCKS_TOOLTIP,
  humanAge,
  PROXIMITY_TOOLTIP,
  withStructureAge,
} from '../_kit/copy';
import { DESK_IS_SAMPLE, scenarioAsOf, scenarioTimeOf } from '../_kit/sample';

// The proximity chip's hover tip needs a keyboard/focus path too (criterion 59) — the file-local
// `Tooltip describeChild` + `aria-describedby` + visually-hidden-description idiom
// (`PositionRow.tsx:154-185`'s pattern), not `AccessibleHelp` (a data chip, not a help icon).
const VISUALLY_HIDDEN = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  p: 0,
  m: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

interface Props {
  offExchange: OffExchange | null | undefined;
  /** Fill the parent's height (for the side-by-side row) instead of the default top margin. */
  fillHeight?: boolean;
  /** REST-bundle age (seconds) — product spine #4. */
  structureAgeSeconds?: number | null;
}

export const OffExchangeBlocks = memo(function OffExchangeBlocks({ offExchange, structureAgeSeconds = null }: Props) {
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
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Off-exchange data unavailable this cycle.
          </Typography>
        ) : !offExchange.blocks?.length ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No blocks ≥{' '}
            {(offExchange.block_min_shares ?? BLOCK_MIN_SHARES_DISPLAY).toLocaleString()} shares in
            the recent window.
          </Typography>
        ) : (
          <Stack spacing={0.5}>
            {/* Already largest-notional-first, top-5 from the backend — render in the backend's own
                order, never re-sorted. Ticker fidelity repair, change 2 (F2) — the design's compact
                quiet card shows exactly three bars (`design/src/screens/desk.mjs:43`'s
                `contextCard('Off-exchange blocks', ...)`, three literal rows, no "+N more"
                affordance), so the DISPLAY is capped to the first three of the backend's five —
                still its order, just fewer of them. */}
            {offExchange.blocks.slice(0, 3).map((b, i) => {
              const pct = b.proximity_pct * 100; // payload is a signed ratio vs spot
              const prox = `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}% vs spot`;
              // The print — a real Convexa-computed figure, always present on a delivered block
              // (SPEC §2.4): traced register resolved through the shared module rather than a
              // widget-local face constant (criterion 53).
              const printState = figureStateOf({
                value: `${b.shares.toLocaleString()} sh @ $${b.price.toFixed(2)}`,
                register: 'traced',
              });
              const proximityDescId = `off-exchange-proximity-${i}`;
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
                    <Typography
                      component="span"
                      data-figure-state={printState.figureState}
                      data-figure-register={printState.mono ? 'mono' : 'sans'}
                      sx={{ ...faceFor(printState.mono), fontSize: 12 }}
                    >
                      {b.shares.toLocaleString()} sh @ ${b.price.toFixed(2)}
                    </Typography>
                    {/* Proximity is context, not direction — NEUTRAL (stage-3 §5.3: the old
                        `success` tint tripped the green/red reservation on a datum whose own
                        subtitle says "no side or direction"). Hover AND keyboard-focus reachable
                        (criterion 59) — the file-local idiom, `AccessibleHelp`'s button chrome
                        would misrepresent a data chip as a help control. */}
                    <Tooltip arrow describeChild title={PROXIMITY_TOOLTIP}>
                      <Box
                        component="span"
                        tabIndex={0}
                        aria-describedby={proximityDescId}
                        // GATE Z (criterion 66, curvature-v2-surfaces phase 3): this focusable
                        // `<span>` is neither a `button`, `[role="button"]` nor an `a`, so
                        // `theme.ts`'s coarse-pointer floor selector never matches it — measured
                        // 86.6×24.75 at 393px/coarse (width already clears 44px; only height
                        // failed). Same mechanism, same fix idiom as the alerts Remove
                        // button/Switch this pass: a nested `@media` rule in the same `sx` object,
                        // so desktop/fine-pointer sizing (the plain `inline-block` pill) is
                        // unchanged.
                        sx={{
                          display: 'inline-block',
                          '@media (pointer: coarse)': { minHeight: 44, minWidth: 44 },
                        }}
                      >
                        <TintChip tone="neutral" label={prox} />
                        <Box component="span" id={proximityDescId} sx={VISUALLY_HIDDEN}>
                          {PROXIMITY_TOOLTIP}
                        </Box>
                      </Box>
                    </Tooltip>
                  </Stack>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {DESK_IS_SAMPLE
                      ? scenarioTimeOf(scenarioAsOf(), b.age_seconds)
                      : `${humanAge(b.age_seconds)} ago`}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>
    </Widget>
  );
});

export default OffExchangeBlocks;
