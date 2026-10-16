/**
 * MarketContext — the "Market context" STATIC-read-family widget (ai-context-pack
 * FRONTEND_EXECUTION_CONTRACT), re-composed by the ticker fidelity repair (F2,
 * `design/src/screens/desk.mjs:43` `ctx-grid` + `contextCard('Market context', ...)`): ONE quiet
 * card carrying a 2×2 of headline values — Trend & momentum · Gamma profile shape · Flow vs
 * positioning · Average true range · 14-day — each a label / value / one-line basis cell, not the
 * four full StatTile-family sub-cards (Trend/Strength/Momentum, Concentration/Balance/Center-of-mass,
 * Location/Composition, ATR 5d/14d/30d) the pre-repair widget rendered. Each cell keeps its OWN basis
 * / as-of line (canon: the context band carries its own basis) — `mcTiBasis` / `mcShapeBasis` /
 * `MC_FLOW_BASIS` / `mcAtrBasis` are unchanged, byte-identical calls. The widget-level advisory
 * footer is unchanged too.
 *
 * The secondary rows this repair drops from the compact card — Strength, Momentum, Balance, Center
 * of mass, Composition, ATR 5d/30d — are not recoverable via the widget's `⤢` expand: `Widget`'s
 * expand renders the SAME `children` larger, never different content (this file's own prior
 * `digested-labels-not-raw-dump` comment already said as much: "the expanded overlay shows this same
 * body larger"). A residual, recorded in the repair report rather than solved with new shared
 * `Widget`/overlay plumbing this task's blast radius does not call for.
 *
 * Binding invariants (restated so the seam stays honest):
 *   - `[live-vs-static-isolation]` — STATIC. It takes NO `offline`/`isLive`/`streamOffline` prop,
 *     reads NEITHER the SSE stream NOR the payload-gap watchdog, and carries NO `⏸ offline` chip. On
 *     a stream drop it stays byte-identical + un-dimmed (contrast: the LiveTape tiles dim). It
 *     refreshes only on the REST poll (a new `pack` value from a new bundle); a stale bundle shares
 *     the page's existing treatment — no per-widget badge.
 *   - `[best-effort-isolated-or-null]` — the FOUR remaining cells are each independently nullable at
 *     two levels (per-read / whole-pack), each its own muted "unavailable this cycle" copy
 *     (`text.disabled`) — NEVER a fabricated 0 / $0 / 0% / label / date; a null never blanks/errors
 *     the rest of the board.
 *   - `[additive-keeps-score-byte-identical]` — display-only advisory context. No copy/color/
 *     placement implies it feeds score/gate/tier/setup; no buy/sell / "smart money" / stop/target /
 *     distance / sizing language anywhere.
 *   - Labels are NEVER re-derived FE-side: the wire enum is authoritative, displayed via the closed
 *     `mcDisplay` lookup only; an UNKNOWN enum value renders that label's unavailable state (no
 *     raw-enum pass-through, no threshold math).
 *   - `digested-labels-not-raw-dump` — labels + declared scalars only; no chart/series/OHLC/period
 *     table anywhere.
 *   - `theme-token-discipline` — token-only via the MUI theme (`text.disabled`/`text.secondary`/
 *     `divider`, mono via tokens), zero hardcoded hex; dark/light parity from the shared chrome.
 *   - No auth gate — renders for anonymous visitors; no session/gate call anywhere in it.
 */
import { faceFor, figureStateOf } from '@/shared/figure';
import { typographyTokens } from '@/shared/theme/tokens';
import { AccessibleHelp } from '@/shared/ui';
import { Widget } from '@/shared/ui/Widget';
import type {
  AtrRead,
  FlowVsPositioningRead,
  GexProfileShapeRead,
  MarketContextPack,
  TrendMomentumRead,
} from '@convexa/api';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import {
  MC_ADVISORY,
  MC_ATR_EMPTY,
  MC_ATR_SHORT,
  MC_CELL_EMPTY,
  MC_CELL_EMPTY_CAPTION,
  MC_CONCENTRATION_DISPLAY,
  MC_DIRECTION_DISPLAY,
  MC_FLOW_BASIS,
  MC_FLOW_EMPTY,
  MC_FLOW_SHORT,
  MC_INFO,
  MC_LOCATION_DISPLAY,
  MC_LOCATION_ROW_EMPTY,
  MC_ROW_TREND,
  MC_SHAPE_EMPTY,
  MC_SHAPE_SHORT,
  MC_SUBTITLE,
  MC_TI_EMPTY,
  MC_TIP_ATR_CARD,
  MC_TIP_FLOW_CARD,
  MC_TIP_SHAPE_CARD,
  MC_TIP_TI_CARD,
  MC_TITLE,
  MC_TREND_ROW_EMPTY,
  MC_WHOLE_EMPTY,
  mcAtrBasis,
  mcAtrLine,
  mcDisplay,
  mcShapeBasis,
  mcTiBasis,
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
    <Typography variant="body2" data-testid={testid} sx={{ color: 'text.secondary' }}>
      {text}
    </Typography>
  );
}

/**
 * A single-row cell degrading to the closed-nine member `unavailable` (SPEC §4.6 criterion 56a) —
 * the ONE quiet-band site where the empty state occupies a figure's own VALUE slot rather than a
 * widget-body sentence. Resolved through the shared module (register `traced`: this cell states no
 * asserted/untraced fact, only "we have nothing this cycle") so the literal renders Sans, never mono
 * (criterion 54), with the this-cycle meaning carried on its own caption underneath.
 */
function EmptyFigureCell({ testid }: { testid: string }) {
  const { figureState, mono } = figureStateOf({ value: MC_CELL_EMPTY, register: 'traced' });
  return (
    <Box data-testid={testid}>
      <Typography
        variant="body2"
        data-figure-state={figureState}
        data-figure-register={mono ? 'mono' : 'sans'}
        sx={{ ...faceFor(mono), color: 'text.secondary' }}
      >
        {MC_CELL_EMPTY}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
        {MC_CELL_EMPTY_CAPTION}
      </Typography>
    </Box>
  );
}

/**
 * A caption label + optional ⓘ info affordance (the cell's tooltip carrier). Ruling 6
 * (curvature-v2-foundations): the shipped `AccessibleHelp` pattern — a real focusable `button`,
 * reachable by tap and keyboard, not just hover (AC-35).
 */
function CaptionLabel({ label, info }: { label: string; info?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: 0.3 }}
      >
        {label}
      </Typography>
      {info && <AccessibleHelp label={`About ${label}`} text={info} />}
    </Box>
  );
}

/**
 * The always-visible per-cell basis line (the AC-4 surface — no interaction). Ticker fidelity
 * repair, change 2 (F2) close-out: single line, ellipsis-truncated, `title` carrying the full
 * sentence — matching the design's own one-line `ctx-2` sub-caption (`desk.mjs:413`, the `s` field:
 * "momentum positive", "5d 5.4 · 30d 6.8") without dropping the basis/as-of text the canon requires
 * every card keep (`mcTiBasis`/`mcShapeBasis`/`MC_FLOW_BASIS`/`mcAtrBasis` are real sentences, one of
 * them ~150 characters, that wrapped to 3–5 lines at the card's ~162px cell width and were the
 * single largest driver of Market context's 552px-then-464px stretch of its context-band row). The
 * FULL text stays in `textContent` (a `title` attribute doesn't remove anything from the a11y tree
 * or `getByText`) — only the paint is truncated.
 *
 * 2026-10-15 (site check D-22): the ellipsis is gone. A `title` is hover-only, so on touch and for
 * keyboard readers the basis/as-of sentence the canon requires was simply cut off ("As of session
 * Wed Oct 7 · da…"). The line wraps instead; the card grows to fit what it must say.
 */
function BasisLine({ text, testid }: { text: string; testid: string }) {
  return (
    <Typography
      variant="caption"
      sx={{ color: 'text.secondary', display: 'block', mt: 0.5, overflowWrap: 'break-word' }}
      data-testid={testid}
    >
      {text}
    </Typography>
  );
}

/**
 * One compact context-band cell: the family's own title (+ its card-level ⓘ) as caption, ONE
 * headline label/value/scalar row (the null-copy props), then the family's basis line — the design's
 * `label / value / one-line basis` shape (`desk.mjs:43`'s `ctx-2` cells). `whole == null` degrades the
 * ENTIRE cell (no basis, no scalar); `rowEmptyText` degrades only the value slot when the family read
 * exists but this one field does not.
 */
function CompactCell({
  title,
  info,
  testid,
  rowTestid,
  whole,
  wholeEmptyText,
  display,
  scalar,
  rowEmptyText,
  basisText,
}: {
  title: string;
  info: string;
  testid: string;
  /** The single retained row's own testid — kept identical to the pre-repair per-row `LabelRow`/
   *  `AtrRow` testid (`mc-trend` / `mc-concentration` / `mc-location` / `mc-atr-14d`) so the
   *  null-matrix spec's per-row slots need no rename, only a smaller matrix. */
  rowTestid: string;
  whole: unknown;
  wholeEmptyText: string;
  display: string | null;
  scalar?: string;
  rowEmptyText: string;
  basisText: string;
}) {
  return (
    <Box data-testid={testid} sx={{ minWidth: 0 }}>
      <CaptionLabel label={title} info={info} />
      {whole == null ? (
        <Box sx={{ mt: 0.75 }}>
          <EmptyLine text={wholeEmptyText} testid={`${testid}-empty`} />
        </Box>
      ) : (
        <Box sx={{ mt: 0.75 }} data-testid={rowTestid}>
          {display == null ? (
            rowEmptyText === MC_CELL_EMPTY ? (
              <EmptyFigureCell testid={`${rowTestid}-empty`} />
            ) : (
              <EmptyLine text={rowEmptyText} testid={`${rowTestid}-empty`} />
            )
          ) : (
            <>
              <Typography
                variant="body1"
                sx={{ fontWeight: 600 }}
                data-testid={`${rowTestid}-label`}
              >
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
      )}
      {whole != null && <BasisLine text={basisText} testid={`${testid}-basis`} />}
    </Box>
  );
}

/** Trend & momentum — the direction headline (Strength/Momentum drop from the compact cell). */
function TrendCell({ read }: { read: TrendMomentumRead | null }) {
  return (
    <CompactCell
      title={MC_ROW_TREND}
      info={MC_TIP_TI_CARD}
      testid="mc-ti"
      rowTestid="mc-trend"
      whole={read}
      wholeEmptyText={MC_TI_EMPTY}
      display={
        read?.direction == null ? null : mcDisplay(MC_DIRECTION_DISPLAY, read.direction.label)
      }
      rowEmptyText={MC_TREND_ROW_EMPTY}
      basisText={read ? mcTiBasis(read.as_of_session) : ''}
    />
  );
}

/** Gamma profile shape — the concentration headline (Balance/center-of-mass drop from the compact cell). */
function ShapeCell({ read }: { read: GexProfileShapeRead | null }) {
  return (
    <CompactCell
      title={MC_SHAPE_SHORT}
      info={MC_TIP_SHAPE_CARD}
      testid="mc-shape"
      rowTestid="mc-concentration"
      whole={read}
      wholeEmptyText={MC_SHAPE_EMPTY}
      display={read == null ? null : mcDisplay(MC_CONCENTRATION_DISPLAY, read.concentration_label)}
      rowEmptyText={MC_CELL_EMPTY}
      basisText={read ? mcShapeBasis(read.spot_basis, read.eligible_strikes) : ''}
    />
  );
}

/** Flow vs positioning · today — the location headline (Composition drops from the compact cell). */
function FlowCell({ read }: { read: FlowVsPositioningRead | null }) {
  return (
    <CompactCell
      title={MC_FLOW_SHORT}
      info={MC_TIP_FLOW_CARD}
      testid="mc-flow"
      rowTestid="mc-location"
      whole={read}
      wholeEmptyText={MC_FLOW_EMPTY}
      display={read?.location == null ? null : mcDisplay(MC_LOCATION_DISPLAY, read.location.label)}
      rowEmptyText={MC_LOCATION_ROW_EMPTY}
      basisText={MC_FLOW_BASIS}
    />
  );
}

/** Average true range · 14-day — the 14d headline (5d/30d drop from the compact cell). */
function AtrCell({ read }: { read: AtrRead | null }) {
  return (
    <CompactCell
      title={MC_ATR_SHORT}
      info={MC_TIP_ATR_CARD}
      testid="mc-atr"
      rowTestid="mc-atr-14d"
      whole={read}
      wholeEmptyText={MC_ATR_EMPTY}
      display={read?.atr_14d == null ? null : mcAtrLine(read.atr_14d)}
      scalar={undefined}
      rowEmptyText={MC_CELL_EMPTY}
      basisText={read ? mcAtrBasis(read.as_of_session, read.close_basis) : ''}
    />
  );
}

export function MarketContext({ pack }: Props) {
  return (
    <Widget id="market-context" title={MC_TITLE} subtitle={MC_SUBTITLE} info={MC_INFO}>
      <Box data-testid="market-context">
        {pack == null ? (
          // Whole-pack null (L5) ≡ missing key: the shell + ONE muted line. No cells, no
          // advisory footer (nothing to frame), NO 0, NO error screen.
          <EmptyLine text={MC_WHOLE_EMPTY} testid="mc-whole-empty" />
        ) : (
          <>
            {/* F2 — one card, a 2×2 of values (`desk.mjs:43`'s `ctx-2`), not four full sub-cards. */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 2,
              }}
            >
              <TrendCell read={pack.trend_momentum} />
              <ShapeCell read={pack.gex_profile_shape} />
              <FlowCell read={pack.flow_vs_positioning} />
              <AtrCell read={pack.atr} />
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
