/**
 * OffExchangeBlocks — the largest-notional off-exchange ("dark pool") block prints (Figma
 * `Ticker · Off-Exchange Blocks`, node 149:667): a card with header + subtitle over recessed rows,
 * each `N sh @ $price` (mono) + a proximity tint chip + age. Rides the REST bundle only (never the
 * live stream), no offline state of its own, ages with the bundle freshness. Hidden when the Dark
 * pool toggle is off. Best-effort: off_exchange absent → its own "unavailable this cycle" copy.
 *
 * Owner decision NO-1 A (2026-10-25, fidelity lane L5): in the quiet band the card is the board's
 * summary (`design/src/screens/final/ticker-desk.mjs:231`): the largest print as the figure with its
 * proximity chip, its time as the one line, and on the demo the sample source chip; on the live build
 * the foot states the structure's as-of. The three rows and the subtitle render in the expand overlay.
 */
import { visuallyHidden } from '@/shared/a11y/visuallyHidden';
import { faceFor, figureStateOf } from '@/shared/figure';
import { TintChip } from '@/shared/ui/TintChip';
import { Widget } from '@/shared/ui/Widget';
import { useWidgetProvenance } from '@/shared/ui/Widget/WidgetProvenanceContext';
import type { OffExchange } from '@convexa/api';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { memo, useId, type ReactNode } from 'react';
import {
  BLOCK_MIN_SHARES_DISPLAY,
  BLOCKS_TOOLTIP,
  humanAge,
  PROXIMITY_TOOLTIP,
  withStructureAge,
} from '../_kit/copy';
import { DESK_IS_SAMPLE, scenarioAsOf, scenarioTimeOf } from '../_kit/sample';
import {
  ContextSummary,
  OverlayFoot,
  OverlayLead,
  QUIET_BODY_SX,
  structureAsOf,
  SummaryFoot,
  SummaryOrFull,
} from '../market-context/ContextSummary';

/** The board's sample source chip for this card (`ticker-desk.mjs:231`). */
const SAMPLE_SOURCE = 'Sample · shaped like block prints';
const SUBTITLE =
  'Largest recent off-exchange prints near spot. Context, not a signal — no side or direction';

// The proximity chip's hover tip needs a keyboard/focus path too (criterion 59) — the
// `Tooltip describeChild` + `aria-describedby` + visually-hidden-description idiom
// (`PositionRow.tsx`'s pattern), not `AccessibleHelp` (a data chip, not a help icon).

interface Props {
  offExchange: OffExchange | null | undefined;
  /** Fill the parent's height (for the side-by-side row) instead of the default top margin. */
  fillHeight?: boolean;
  /** REST-bundle age (seconds) — product spine #4. */
  structureAgeSeconds?: number | null;
}

type Block = NonNullable<OffExchange['blocks']>[number];

/** "+1.2% vs spot" / "−0.4% vs spot": the payload is a signed ratio vs spot. */
const proximityText = (b: Block) => {
  const pct = b.proximity_pct * 100;
  return `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}% vs spot`;
};

/** "1,371,000 sh @ $687.86": the print, a real Convexa-computed figure on a delivered block. */
const printText = (b: Block) => `${b.shares.toLocaleString()} sh @ $${b.price.toFixed(2)}`;

/** The print's time: the scenario clock on the demo, an age on the live build. */
const printTime = (b: Block) =>
  DESK_IS_SAMPLE ? scenarioTimeOf(scenarioAsOf(), b.age_seconds) : `${humanAge(b.age_seconds)} ago`;

/**
 * Proximity is context, not direction — NEUTRAL (stage-3 §5.3: the old `success` tint tripped the
 * green/red reservation on a datum whose own subtitle says "no side or direction"). Hover AND
 * keyboard-focus reachable (criterion 59) — the file-local idiom, `AccessibleHelp`'s button chrome
 * would misrepresent a data chip as a help control.
 */
function ProximityChip({ block }: { block: Block }) {
  const descId = `off-exchange-proximity-${useId()}`;
  return (
    <Tooltip arrow describeChild title={PROXIMITY_TOOLTIP}>
      <Box
        component="span"
        tabIndex={0}
        aria-describedby={descId}
        // GATE Z (criterion 66, curvature-v2-surfaces phase 3): this focusable `<span>` is neither a
        // `button`, `[role="button"]` nor an `a`, so `theme.ts`'s coarse-pointer floor selector never
        // matches it — measured 86.6×24.75 at 393px/coarse (width already clears 44px; only height
        // failed). A nested `@media` rule in the same `sx` object, so desktop/fine-pointer sizing (the
        // plain `inline-block` pill) is unchanged.
        sx={{
          display: 'inline-block',
          '@media (pointer: coarse)': { minHeight: 44, minWidth: 44 },
        }}
      >
        <TintChip tone="neutral" label={proximityText(block)} />
        <Box component="span" id={descId} sx={visuallyHidden}>
          {PROXIMITY_TOOLTIP}
        </Box>
      </Box>
    </Tooltip>
  );
}

/** The two empty states, the same sentences in the band and the overlay. */
function emptySentence(offExchange: OffExchange | null | undefined): string | null {
  if (!offExchange) return 'Off-exchange data unavailable this cycle.';
  if (!offExchange.blocks?.length)
    return `No blocks ≥ ${(offExchange.block_min_shares ?? BLOCK_MIN_SHARES_DISPLAY).toLocaleString()} shares in the recent window.`;
  return null;
}

/**
 * The quiet-band summary: "1,371,000 sh @ $687.86" with its proximity chip, then "largest print,
 * 2:28 PM ET in the scenario". The backend sends the blocks largest-notional first, so the first
 * block is the largest print.
 */
function BlocksSummary({
  offExchange,
  foot,
}: {
  offExchange: OffExchange | null | undefined;
  foot: ReactNode;
}) {
  const empty = emptySentence(offExchange);
  const first = offExchange?.blocks?.[0];
  if (empty != null || first == null) return <ContextSummary line={empty} foot={foot} />;
  const printState = figureStateOf({ value: printText(first), register: 'traced' });
  return (
    <ContextSummary
      figure={printText(first)}
      figureAttrs={{
        'data-figure-state': printState.figureState,
        'data-figure-register': printState.mono ? 'mono' : 'sans',
      }}
      help={<ProximityChip block={first} />}
      line={`largest print, ${printTime(first)}`}
      foot={foot}
    />
  );
}

/** The prints, in the expand overlay: the subtitle, then the backend's first three rows. */
function BlocksFull({
  offExchange,
  subtitle,
  foot,
}: {
  offExchange: OffExchange | null | undefined;
  subtitle: string;
  foot: ReactNode;
}) {
  const empty = emptySentence(offExchange);
  return (
    <Box>
      <OverlayLead>{subtitle}</OverlayLead>
      {empty != null ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {empty}
        </Typography>
      ) : (
        <Stack spacing={0.5}>
          {/* Already largest-notional-first, top-5 from the backend — render in the backend's own
              order, never re-sorted. Ticker fidelity repair, change 2 (F2) — three rows, no "+N
              more" affordance (`design/src/screens/desk.mjs:43`'s `contextCard('Off-exchange
              blocks', ...)`), so the DISPLAY is capped to the first three of the backend's five. */}
          {(offExchange?.blocks ?? []).slice(0, 3).map((b, i) => {
            // The print — traced register resolved through the shared module rather than a
            // widget-local face constant (criterion 53).
            const printState = figureStateOf({ value: printText(b), register: 'traced' });
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
                    {printText(b)}
                  </Typography>
                  <ProximityChip block={b} />
                </Stack>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {printTime(b)}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      )}
      {foot != null && <OverlayFoot>{foot}</OverlayFoot>}
    </Box>
  );
}

export const OffExchangeBlocks = memo(function OffExchangeBlocks({
  offExchange,
  structureAgeSeconds = null,
}: Props) {
  // The foot: the sample source chip on the demo (so the head carries no Sample tag, owner D1), the
  // structure's as-of on the live build. The overlay repeats only the chip; its caption already
  // states the as-of.
  const sample = useWidgetProvenance() === 'sample';
  const foot = (
    <SummaryFoot
      sample={sample}
      sampleSource={SAMPLE_SOURCE}
      basis={structureAsOf(structureAgeSeconds)}
    />
  );
  return (
    // NO-1 A: the subtitle moved into the overlay body (`BlocksFull`), since the Widget header is
    // shared by the band card and the overlay.
    <Widget
      id="off-exchange-blocks"
      title="Off-exchange blocks"
      info={BLOCKS_TOOLTIP}
      sampleTag={false}
      bodySx={QUIET_BODY_SX}
    >
      <SummaryOrFull
        summary={<BlocksSummary offExchange={offExchange} foot={foot} />}
        full={
          <BlocksFull
            offExchange={offExchange}
            subtitle={withStructureAge(SUBTITLE, structureAgeSeconds)}
            foot={sample ? foot : null}
          />
        }
      />
    </Widget>
  );
});

export default OffExchangeBlocks;
