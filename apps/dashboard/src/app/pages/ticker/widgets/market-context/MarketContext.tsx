/**
 * MarketContext — the "Market context" STATIC-read-family widget (ai-context-pack
 * FRONTEND_EXECUTION_CONTRACT). It surfaces the additive `market_state.market_context` pack as four
 * StatTile-family sub-cards — Trend & momentum · Gamma profile shape · Flow vs positioning · today ·
 * Average true range — with every headline label visible without expanding, a visible basis line per
 * card, per-label threshold tooltips, and ONE widget-level advisory footer.
 *
 * Binding invariants (restated so the seam stays honest):
 *   - `[live-vs-static-isolation]` — STATIC. It takes NO `offline`/`isLive`/`streamOffline` prop,
 *     reads NEITHER the SSE stream NOR the payload-gap watchdog, and carries NO `⏸ offline` chip. On
 *     a stream drop it stays byte-identical + un-dimmed (contrast: the LiveTape tiles dim). It
 *     refreshes only on the REST poll (a new `pack` value from a new bundle); a stale bundle shares
 *     the page's existing treatment — no per-widget badge.
 *   - `[best-effort-isolated-or-null]` — FIVE independent null levels: per-label (TI) / per-horizon
 *     (ATR) / per-sub-component (divergence) / per-read / whole-pack, each its own muted
 *     "unavailable this cycle" copy (`text.disabled`) — NEVER a fabricated 0 / $0 / 0% / label /
 *     date; a null never blanks/errors the rest of the board.
 *   - `[additive-keeps-score-byte-identical]` — display-only advisory context. No copy/color/
 *     placement implies it feeds score/gate/tier/setup; no buy/sell / "smart money" / stop/target /
 *     distance / sizing language anywhere.
 *   - Labels are NEVER re-derived FE-side: the wire enum is authoritative, displayed via the closed
 *     `mcDisplay` lookup only; an UNKNOWN enum value renders that label's unavailable state (no
 *     raw-enum pass-through, no threshold math).
 *   - `digested-labels-not-raw-dump` — labels + declared scalars only; no chart/series/OHLC/period
 *     table anywhere (the expanded overlay shows this same body larger).
 *   - `theme-token-discipline` — token-only via the MUI theme (`text.disabled`/`text.secondary`/
 *     `divider`, mono via tokens), zero hardcoded hex; dark/light parity from the shared chrome.
 *   - No auth gate — renders for anonymous visitors; no session/gate call anywhere in it.
 */
import { typographyTokens } from '@/shared/theme/tokens';
import { Widget } from '@/shared/ui/Widget';
import type {
  AtrHorizon,
  AtrRead,
  FlowVsPositioningRead,
  GexProfileShapeRead,
  MarketContextPack,
  TrendMomentumRead,
} from '@convexa/api';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  MC_ADVISORY,
  MC_ATR_EMPTY,
  MC_ATR_TITLE,
  MC_BALANCE_DISPLAY,
  MC_CELL_EMPTY,
  MC_COMPOSITION_DISPLAY,
  MC_COMPOSITION_ROW_EMPTY,
  MC_CONCENTRATION_DISPLAY,
  MC_DIRECTION_DISPLAY,
  MC_FLOW_BASIS,
  MC_FLOW_EMPTY,
  MC_FLOW_TITLE,
  MC_INFO,
  MC_LOCATION_DISPLAY,
  MC_LOCATION_ROW_EMPTY,
  MC_MOMENTUM_DISPLAY,
  MC_MOMENTUM_ROW_EMPTY,
  MC_ROW_ATR_14D,
  MC_ROW_ATR_30D,
  MC_ROW_ATR_5D,
  MC_ROW_BALANCE,
  MC_ROW_COM,
  MC_ROW_COMPOSITION,
  MC_ROW_CONCENTRATION,
  MC_ROW_LOCATION,
  MC_ROW_MOMENTUM,
  MC_ROW_STRENGTH,
  MC_ROW_TREND,
  MC_SHAPE_EMPTY,
  MC_SHAPE_TITLE,
  MC_STRENGTH_DISPLAY,
  MC_STRENGTH_ROW_EMPTY,
  MC_SUBTITLE,
  MC_TI_EMPTY,
  MC_TI_TITLE,
  MC_TIP_ATR_CARD,
  MC_TIP_BALANCE,
  MC_TIP_COM,
  MC_TIP_COMPOSITION,
  MC_TIP_CONCENTRATION,
  MC_TIP_FLOW_CARD,
  MC_TIP_LOCATION,
  MC_TIP_MOMENTUM,
  MC_TIP_SHAPE_CARD,
  MC_TIP_STRENGTH,
  MC_TIP_TI_CARD,
  MC_TIP_TREND,
  MC_TITLE,
  MC_TREND_ROW_EMPTY,
  MC_WHOLE_EMPTY,
  mcAtrBasis,
  mcAtrLine,
  mcBalanceLine,
  mcComLine,
  mcCompositionLine,
  mcConcentrationLine,
  mcDisplay,
  mcLocationLine,
  mcMomentumLine,
  mcShapeBasis,
  mcStrengthLine,
  mcTiBasis,
  mcTrendLine,
} from '../_kit/copy';

const MONO = typographyTokens.monoFontFamily;

interface Props {
  /** The additive static read (`m.market_context ?? null`). NO live/offline prop is accepted — this
   *  widget is bound to the last-bundle render path only (`[live-vs-static-isolation]`). */
  pack: MarketContextPack | null;
}

/** A muted "unavailable this cycle" line (`text.disabled`) — the ONLY empty render. Never a 0. */
function EmptyLine({ text, testid }: { text: string; testid: string }) {
  return (
    <Typography variant="body2" data-testid={testid} sx={{ color: 'text.disabled' }}>
      {text}
    </Typography>
  );
}

/** A caption label + optional ⓘ info affordance (the row/card tooltip carrier). */
function CaptionLabel({ label, info }: { label: string; info?: string }) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: 0.3 }}
      >
        {label}
      </Typography>
      {info && (
        <Tooltip title={info} arrow placement="top">
          <InfoOutlinedIcon
            sx={{ fontSize: 13, color: 'text.disabled' }}
            data-testid={`mc-info-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
          />
        </Tooltip>
      )}
    </Stack>
  );
}

/** The recessed sub-card — the LimbCard-style StatTile-family surface on the widget's inset well. */
function SubCard({
  title,
  info,
  testid,
  children,
}: {
  title: string;
  info: string;
  testid: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      variant="outlined"
      data-testid={testid}
      sx={{
        borderRadius: '12px',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        height: '100%',
      }}
    >
      <CardContent sx={{ '&:last-child': { pb: 1.75 } }}>
        <Box sx={{ mb: 0.75 }}>
          <CaptionLabel label={title} info={info} />
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}

/** One label row: caption row-label (+ ⓘ tooltip) → prominent headline display string → small mono
 *  scalar line. `display == null` (a null label OR an unknown wire enum) renders `emptyText` alone —
 *  that label's unavailable state, never a raw enum, never invented text. */
function LabelRow({
  rowLabel,
  info,
  display,
  scalar,
  emptyText,
  testid,
}: {
  rowLabel: string;
  info: string;
  display: string | null;
  scalar?: string;
  emptyText: string;
  testid: string;
}) {
  return (
    <Box sx={{ mb: 1 }} data-testid={testid}>
      <CaptionLabel label={rowLabel} info={info} />
      {display == null ? (
        <EmptyLine text={emptyText} testid={`${testid}-empty`} />
      ) : (
        <>
          <Typography variant="body1" sx={{ fontWeight: 600 }} data-testid={`${testid}-label`}>
            {display}
          </Typography>
          {scalar && (
            <Typography variant="body2" sx={{ color: 'text.secondary', fontFamily: MONO }}>
              {scalar}
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}

/** The always-visible per-card basis line (the AC-4 surface — no interaction). */
function BasisLine({ text, testid }: { text: string; testid: string }) {
  return (
    <Typography
      variant="caption"
      sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
      data-testid={testid}
    >
      {text}
    </Typography>
  );
}

/** Trend & momentum — three independently-nullable label rows + the as-of/window basis line. */
function TrendMomentumCard({ read }: { read: TrendMomentumRead | null | undefined }) {
  return (
    <SubCard title={MC_TI_TITLE} info={MC_TIP_TI_CARD} testid="mc-ti">
      {read == null ? (
        <EmptyLine text={MC_TI_EMPTY} testid="mc-ti-empty" />
      ) : (
        <>
          <LabelRow
            rowLabel={MC_ROW_TREND}
            info={MC_TIP_TREND}
            display={
              read.direction == null ? null : mcDisplay(MC_DIRECTION_DISPLAY, read.direction.label)
            }
            scalar={read.direction == null ? undefined : mcTrendLine(read.direction)}
            emptyText={MC_TREND_ROW_EMPTY}
            testid="mc-trend"
          />
          <LabelRow
            rowLabel={MC_ROW_STRENGTH}
            info={MC_TIP_STRENGTH}
            display={
              read.strength == null ? null : mcDisplay(MC_STRENGTH_DISPLAY, read.strength.label)
            }
            scalar={read.strength == null ? undefined : mcStrengthLine(read.strength)}
            emptyText={MC_STRENGTH_ROW_EMPTY}
            testid="mc-strength"
          />
          <LabelRow
            rowLabel={MC_ROW_MOMENTUM}
            info={MC_TIP_MOMENTUM}
            display={
              read.momentum == null ? null : mcDisplay(MC_MOMENTUM_DISPLAY, read.momentum.label)
            }
            scalar={read.momentum == null ? undefined : mcMomentumLine(read.momentum)}
            emptyText={MC_MOMENTUM_ROW_EMPTY}
            testid="mc-momentum"
          />
          <BasisLine text={mcTiBasis(read.as_of_session)} testid="mc-ti-basis" />
        </>
      )}
    </SubCard>
  );
}

/** Gamma profile shape — all-or-null read; an unknown enum degrades ONLY that row's label cell. */
function ShapeCard({ read }: { read: GexProfileShapeRead | null | undefined }) {
  return (
    <SubCard title={MC_SHAPE_TITLE} info={MC_TIP_SHAPE_CARD} testid="mc-shape">
      {read == null ? (
        <EmptyLine text={MC_SHAPE_EMPTY} testid="mc-shape-empty" />
      ) : (
        <>
          <LabelRow
            rowLabel={MC_ROW_CONCENTRATION}
            info={MC_TIP_CONCENTRATION}
            display={mcDisplay(MC_CONCENTRATION_DISPLAY, read.concentration_label)}
            scalar={mcConcentrationLine(read.concentration)}
            emptyText={MC_CELL_EMPTY}
            testid="mc-concentration"
          />
          <LabelRow
            rowLabel={MC_ROW_BALANCE}
            info={MC_TIP_BALANCE}
            display={mcDisplay(MC_BALANCE_DISPLAY, read.balance_label)}
            scalar={mcBalanceLine(read.balance)}
            emptyText={MC_CELL_EMPTY}
            testid="mc-balance"
          />
          {/* Center of mass — a scalar-only row by design (no label, no threshold). */}
          <Box sx={{ mb: 1 }} data-testid="mc-com">
            <CaptionLabel label={MC_ROW_COM} info={MC_TIP_COM} />
            <Typography
              variant="body1"
              sx={{ fontWeight: 600, fontFamily: MONO }}
              data-testid="mc-com-value"
            >
              {mcComLine(read.center_of_mass_distance)}
            </Typography>
          </Box>
          <BasisLine
            text={mcShapeBasis(read.spot_basis, read.eligible_strikes)}
            testid="mc-shape-basis"
          />
        </>
      )}
    </SubCard>
  );
}

/** Flow vs positioning · today — two independently-nullable sub-components + the pinned
 *  unsigned/no-side flow-basis line (always visible with the card). */
function FlowCard({ read }: { read: FlowVsPositioningRead | null | undefined }) {
  return (
    <SubCard title={MC_FLOW_TITLE} info={MC_TIP_FLOW_CARD} testid="mc-flow">
      {read == null ? (
        <EmptyLine text={MC_FLOW_EMPTY} testid="mc-flow-empty" />
      ) : (
        <>
          <LabelRow
            rowLabel={MC_ROW_LOCATION}
            info={MC_TIP_LOCATION}
            display={
              read.location == null ? null : mcDisplay(MC_LOCATION_DISPLAY, read.location.label)
            }
            scalar={read.location == null ? undefined : mcLocationLine(read.location)}
            emptyText={MC_LOCATION_ROW_EMPTY}
            testid="mc-location"
          />
          <LabelRow
            rowLabel={MC_ROW_COMPOSITION}
            info={MC_TIP_COMPOSITION}
            display={
              read.composition == null
                ? null
                : mcDisplay(MC_COMPOSITION_DISPLAY, read.composition.label)
            }
            scalar={read.composition == null ? undefined : mcCompositionLine(read.composition)}
            emptyText={MC_COMPOSITION_ROW_EMPTY}
            testid="mc-composition"
          />
          <BasisLine text={MC_FLOW_BASIS} testid="mc-flow-basis" />
        </>
      )}
    </SubCard>
  );
}

/** One ATR horizon row: label kept; a null horizon shows the muted cell text — NEVER `$0` / `0%`. */
function AtrRow({
  rowLabel,
  horizon,
  testid,
}: {
  rowLabel: string;
  horizon: AtrHorizon | null | undefined;
  testid: string;
}) {
  return (
    <Box sx={{ mb: 1 }} data-testid={testid}>
      <CaptionLabel label={rowLabel} />
      {horizon == null ? (
        <EmptyLine text={MC_CELL_EMPTY} testid={`${testid}-empty`} />
      ) : (
        <Typography
          variant="body1"
          sx={{ fontWeight: 600, fontFamily: MONO }}
          data-testid={`${testid}-value`}
        >
          {mcAtrLine(horizon)}
        </Typography>
      )}
    </Box>
  );
}

/** Average true range — three independently-nullable horizons + the as-of/close basis line. The
 *  card-level ⓘ carries the ATR tooltip (method + never-a-stop framing). */
function AtrCard({ read }: { read: AtrRead | null | undefined }) {
  return (
    <SubCard title={MC_ATR_TITLE} info={MC_TIP_ATR_CARD} testid="mc-atr">
      {read == null ? (
        <EmptyLine text={MC_ATR_EMPTY} testid="mc-atr-empty" />
      ) : (
        <>
          <AtrRow rowLabel={MC_ROW_ATR_5D} horizon={read.atr_5d} testid="mc-atr-5d" />
          <AtrRow rowLabel={MC_ROW_ATR_14D} horizon={read.atr_14d} testid="mc-atr-14d" />
          <AtrRow rowLabel={MC_ROW_ATR_30D} horizon={read.atr_30d} testid="mc-atr-30d" />
          <BasisLine
            text={mcAtrBasis(read.as_of_session, read.close_basis)}
            testid="mc-atr-basis"
          />
        </>
      )}
    </SubCard>
  );
}

export function MarketContext({ pack }: Props) {
  return (
    <Widget
      id="market-context"
      title={MC_TITLE}
      subtitle={MC_SUBTITLE}
      info={MC_INFO}
      span={2}
      bodyVariant="inset"
    >
      <Box data-testid="market-context">
        {pack == null ? (
          // Whole-pack null (L5) ≡ missing key: the shell + ONE muted line. No sub-cards, no
          // advisory footer (nothing to frame), NO 0, NO error screen.
          <EmptyLine text={MC_WHOLE_EMPTY} testid="mc-whole-empty" />
        ) : (
          <>
            <Box
              sx={{
                display: 'grid',
                // Intrinsically responsive (the DealerPositioning/DealerFlowProjection idiom): four
                // across when wide, 2×2 at medium, single column narrow — NEVER a `@container`
                // object key in sx (this Emotion version silently drops it; the dealer-flow post-QA
                // catch pinned the `auto-fit`/`minmax` idiom).
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: 2,
              }}
            >
              <TrendMomentumCard read={pack.trend_momentum} />
              <ShapeCard read={pack.gex_profile_shape} />
              <FlowCard read={pack.flow_vs_positioning} />
              <AtrCard read={pack.atr} />
            </Box>

            {/* Widget-level advisory footer — always present with a non-null pack (Default + L1–L4);
                verbatim, no interaction (`model-read-carries-its-assumptions`). */}
            <Box sx={{ mt: 1.75 }} data-testid="mc-footer">
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {MC_ADVISORY}
              </Typography>
            </Box>
          </>
        )}
      </Box>
    </Widget>
  );
}

export default MarketContext;
