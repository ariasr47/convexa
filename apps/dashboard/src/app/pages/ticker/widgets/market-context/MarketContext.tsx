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
 * The secondary rows this repair dropped from the compact card — Strength, Momentum, Balance, Center
 * of mass, Composition, ATR 5d/30d — stay dropped: the expand overlay shows the 2×2 below, not them.
 *
 * Owner decision NO-1 A (2026-10-25, fidelity lane L5): in the quiet band the card is now the
 * board's summary (`design/src/screens/final/ticker-desk.mjs:229`): trend and profile shape as one
 * Sans figure ("Uptrend · Dispersed"), flow vs positioning and the 14-day ATR as the one line, and a
 * foot: the sample source chip on the demo, the static basis "Snapshot, never live" on the live
 * build. The 2×2 with its basis lines and the advisory footer render in the expand overlay
 * (`SummaryOrFull`, `./ContextSummary.tsx`). Both bodies read the same closed lookups; a missing read
 * is named "unavailable" in the summary, never filled in.
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
import { useWidgetProvenance } from '@/shared/ui/Widget/WidgetProvenanceContext';
import type {
  AtrRead,
  FlowVsPositioningRead,
  GexProfileShapeRead,
  MarketContextPack,
  TrendMomentumRead,
} from '@convexa/api';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { memo, type ReactNode } from 'react';
import {
  fmt1,
  fmtAtrUsd,
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
import {
  ContextSummary,
  OverlayFoot,
  OverlayLead,
  QUIET_BODY_SX,
  STATIC_BASIS,
  SummaryFoot,
  SummaryOrFull,
} from './ContextSummary';

const MONO = typographyTokens.monoFontFamily;

/** The board's sample source chip for this card (`ticker-desk.mjs:229`). */
const SAMPLE_SOURCE = 'Sample · shaped like market context';

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

/** A summary part a read could not supply: its own words plus "unavailable", never a value. */
const missing = (what: string) => `${what} unavailable`;

/**
 * The quiet-band summary (`ticker-desk.mjs:229`): "Uptrend · Dispersed" as the figure, then "flow vs
 * positioning divergent · ATR 14d $12.94 (1.9%)". Every part goes through the same closed lookup as
 * the 2×2; a part whose read (or label) is missing leaves the figure and is named in the line.
 */
function McSummary({ pack, foot }: { pack: MarketContextPack | null; foot: ReactNode }) {
  if (pack == null) {
    return (
      <ContextSummary
        testid="market-context"
        line={<span data-testid="mc-whole-empty">{MC_WHOLE_EMPTY}</span>}
        foot={foot}
      />
    );
  }
  const direction = pack.trend_momentum?.direction;
  const trend = direction == null ? null : mcDisplay(MC_DIRECTION_DISPLAY, direction.label);
  const shapeRead = pack.gex_profile_shape;
  const shape =
    shapeRead == null ? null : mcDisplay(MC_CONCENTRATION_DISPLAY, shapeRead.concentration_label);
  const location = pack.flow_vs_positioning?.location;
  const flow = location == null ? null : mcDisplay(MC_LOCATION_DISPLAY, location.label);
  const atr14 = pack.atr?.atr_14d ?? null;

  // [key, part] pairs, joined with " · ".
  type Part = [key: string, node: ReactNode];
  const figureParts: Part[] = [];
  if (trend != null) figureParts.push(['trend', <span data-testid="mc-trend">{trend}</span>]);
  if (shape != null)
    figureParts.push(['shape', <span data-testid="mc-concentration">{shape}</span>]);

  const lineParts: Part[] = [];
  if (trend == null) lineParts.push(['trend', missing('trend')]);
  if (shape == null) lineParts.push(['shape', missing('profile shape')]);
  lineParts.push([
    'flow',
    flow != null ? (
      <>
        {'flow vs positioning '}
        <span data-testid="mc-location">{flow.toLocaleLowerCase('en-US')}</span>
      </>
    ) : (
      missing('flow vs positioning')
    ),
  ]);
  lineParts.push([
    'atr',
    atr14 != null ? (
      <>
        {'ATR 14d '}
        <span data-testid="mc-atr-14d">
          {fmtAtrUsd(atr14.value)} ({fmt1(atr14.pct_of_close)}%)
        </span>
      </>
    ) : (
      missing('ATR 14d')
    ),
  ]);

  const join = (parts: Part[]) =>
    parts.map(([key, node], i) => (
      <span key={key}>
        {i > 0 && ' · '}
        {node}
      </span>
    ));

  return (
    <ContextSummary
      testid="market-context"
      face="sans"
      figure={figureParts.length > 0 ? join(figureParts) : undefined}
      help={
        figureParts.length > 0 ? (
          <AccessibleHelp
            label={`About ${MC_ROW_TREND} and ${MC_SHAPE_SHORT.toLocaleLowerCase('en-US')}`}
            text={`${MC_TIP_TI_CARD} ${MC_TIP_SHAPE_CARD}`}
          />
        ) : undefined
      }
      line={join(lineParts)}
      foot={foot}
    />
  );
}

/** The full read, in the expand overlay: the 2×2 with each cell's basis, then the advisory footer. */
function McFull({ pack, foot }: { pack: MarketContextPack | null; foot: ReactNode }) {
  return (
    <Box data-testid="market-context">
      <OverlayLead>{MC_SUBTITLE}</OverlayLead>
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
      {foot != null && <OverlayFoot>{foot}</OverlayFoot>}
    </Box>
  );
}

export const MarketContext = memo(function MarketContext({ pack }: Props) {
  // The foot: the sample source chip on the demo (so the head carries no Sample tag, owner D1); on
  // the live build the read's static basis, never a clock age, so a stream drop or a bundle tick
  // leaves this card's text byte-identical.
  const sample = useWidgetProvenance() === 'sample';
  const foot = <SummaryFoot sample={sample} sampleSource={SAMPLE_SOURCE} basis={STATIC_BASIS} />;
  return (
    // NO-1 A: the subtitle moved into the overlay body (`McFull`), since the Widget header is shared
    // by the band card and the overlay.
    <Widget
      id="market-context"
      title={MC_TITLE}
      info={MC_INFO}
      sampleTag={false}
      bodySx={QUIET_BODY_SX}
    >
      <SummaryOrFull
        summary={<McSummary pack={pack} foot={foot} />}
        full={<McFull pack={pack} foot={sample ? foot : null} />}
      />
    </Widget>
  );
});

export default MarketContext;
