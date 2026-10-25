/**
 * DealerFlowProjection — the "Projected dealer flow" STATIC-read-family widget (dealer-flow-projection
 * FRONTEND_EXECUTION_CONTRACT). It surfaces the additive `market_state.dealer_flow_projection` object as
 * two labelled limbs — charm (delta drift into the next monthly OPEX) + vanna (delta per vol move) — with
 * every assumption visible beside the number (horizon, move sizes + reference direction, spot basis, the
 * binding honesty frame).
 *
 * Binding invariants (restated so the seam stays honest):
 *   - `[live-vs-static-isolation]` — STATIC. It takes NO `offline`/`isLive`/`streamOffline` prop, reads
 *     NEITHER the SSE stream NOR the payload-gap watchdog, and carries NO `⏸ offline` chip. On a stream
 *     drop it stays byte-identical + un-dimmed (contrast: the LiveTape tiles dim). It refreshes only on
 *     the REST poll (a new `dfp` value from a new bundle).
 *   - `[best-effort-isolated-or-null]` — per-limb + whole-object null render as muted "unavailable this
 *     cycle" text (`text.disabled`), NEVER a fabricated 0 / date / horizon; the limbs degrade
 *     independently; a null never blanks/errors the rest of the board.
 *   - `[additive-keeps-score-byte-identical]` — display-only context. No copy/color/placement implies it
 *     feeds score/gate/tier/setup; zero bull/bear/buy/sell/edge framing.
 *   - `theme-token-discipline` — token-only via MUI theme (`text.disabled`/`text.secondary`/`divider`,
 *     mono via tokens), zero hardcoded hex; dark/light parity comes from the shared `Widget`/tile chrome.
 *
 * Owner decision NO-1 A (2026-10-25, fidelity lane L5): in the quiet band the card is the board's
 * summary (`design/src/screens/final/ticker-desk.mjs:228`): the charm drift as the figure, its
 * horizon and the vanna base as the one line, and a foot: the sample source chip on the demo, the
 * static basis "Snapshot, never live" on the live build (no clock age, so the card stays
 * byte-identical across a stream drop). The two limbs, the +5 IV-pt illustration and the assumptions
 * footer render in the expand overlay. Both bodies keep the null rules above; a limb that is missing
 * is named in words, never shown as $0.
 */
import { typographyTokens } from '@/shared/theme/tokens';
import { AccessibleHelp } from '@/shared/ui';
import { Widget } from '@/shared/ui/Widget';
import { useWidgetProvenance } from '@/shared/ui/Widget/WidgetProvenanceContext';
import type { DealerFlowProjection as Dfp } from '@convexa/api';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { memo } from 'react';
import {
  CHARM_EMPTY,
  CHARM_LABEL,
  charmInfo,
  dayCount,
  DFP_HONESTY_FRAME,
  DFP_INFO,
  DFP_SUBTITLE,
  DFP_TITLE,
  DFP_WHOLE_EMPTY,
  dfpFooterAssumptions,
  fmtSignedUsdCompact,
  humanOpex,
  VANNA_EMPTY,
  VANNA_INFO,
  VANNA_LABEL,
  VANNA_NEGATION,
} from '../_kit/copy';
import {
  ContextSummary,
  OverlayFoot,
  OverlayLead,
  QUIET_BODY_SX,
  STATIC_BASIS,
  SummaryFoot,
  SummaryOrFull,
} from '../market-context/ContextSummary';

/** The board's sample source chip for this card (`ticker-desk.mjs:228`). */
const SAMPLE_SOURCE = 'Sample · shaped like dealer flow';

const MONO = typographyTokens.monoFontFamily;

interface Props {
  /** The additive static read (object | null). NO live/offline prop is accepted — this widget is
   *  bound to the last-bundle render path only (`[live-vs-static-isolation]`). */
  dfp: Dfp | null;
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
 * A limb section header: the label + an ⓘ info affordance carrying the StatTile-family tooltip.
 * Ruling 6 (curvature-v2-foundations): converted to the shipped `AccessibleHelp` pattern — a real
 * focusable `button`, reachable by tap and keyboard, not just hover (AC-35).
 */
function LimbLabel({ label, info }: { label: string; info: string }) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mb: 0.5 }}>
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: 0.3 }}
      >
        {label}
      </Typography>
      <AccessibleHelp label={`About ${label}`} text={info} />
    </Stack>
  );
}

/**
 * The limb block. Ticker fidelity repair, change 2 (F2) close-out: a plain `Box`, not a bordered
 * `Card`/`CardContent` — the outlined-card chrome (MUI's default 16px + the `&:last-child` 14px
 * override ≈ 30px of vertical padding per limb, on top of the widget's own inset well already
 * distinguishing this STATIC read visually) was the single largest reason a two-limb card ran
 * ≈464px against the design's ≈267px (`design/src/screens/desk.mjs:43`'s `contextCard('Projected
 * dealer flow', ...)`, "two limbs + one note"). Every figure/line/testid this widget renders is
 * unchanged — `DealerFlowProjection.spec.tsx`'s text-content assertions don't reference `Card`. */
function LimbCard({ children, testid }: { children: React.ReactNode; testid: string }) {
  return (
    <Box data-testid={testid} sx={{ minWidth: 0 }}>
      {children}
    </Box>
  );
}

/** The charm limb: signed drift figure + horizon (days + human OPEX date, together) + per-day base. */
function CharmSection({ charm }: { charm: NonNullable<Dfp['charm']> }) {
  return (
    <LimbCard testid="dfp-charm">
      <LimbLabel label={CHARM_LABEL} info={charmInfo(charm.opex_date)} />
      <Typography
        variant="h6"
        component="p"
        sx={{ fontFamily: MONO }}
        data-testid="dfp-charm-drift"
      >
        {fmtSignedUsdCompact(charm.projected_delta)} delta drift
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }} data-testid="dfp-charm-horizon">
        to {humanOpex(charm.opex_date)} ({dayCount(charm.horizon_days)})
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: 'text.secondary', fontFamily: MONO }}
        data-testid="dfp-charm-base"
      >
        base {fmtSignedUsdCompact(charm.per_day_base)} / day
      </Typography>
    </LimbCard>
  );
}

/** The vanna limb: the +1 IV pt base figure, the pre-scaled +5 IV pt illustrative figure (rendered
 *  directly — NEVER multiplied FE-side), and the reference-direction + negation line. No 2nd figure. */
function VannaSection({ vanna }: { vanna: NonNullable<Dfp['vanna']> }) {
  return (
    <LimbCard testid="dfp-vanna">
      <LimbLabel label={VANNA_LABEL} info={VANNA_INFO} />
      <Typography variant="h6" component="p" sx={{ fontFamily: MONO }} data-testid="dfp-vanna-base">
        {fmtSignedUsdCompact(vanna.projected_delta)} on +1 IV pt
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: 'text.secondary', fontFamily: MONO }}
        data-testid="dfp-vanna-illus"
      >
        {fmtSignedUsdCompact(vanna.illustrative_projected_delta)} on +5 IV pt (illus.)
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }} data-testid="dfp-vanna-negation">
        {VANNA_NEGATION}
      </Typography>
    </LimbCard>
  );
}

/**
 * The quiet-band summary. The figure is the charm drift; the line carries its horizon and the vanna
 * base. A missing limb is named by its pinned "unavailable this cycle" sentence in the line, and the
 * figure falls back to the other limb, so the card never shows a number it does not have.
 */
function DfpSummary({ dfp, foot }: { dfp: Dfp | null; foot: ReactNode }) {
  if (dfp == null) {
    return (
      <ContextSummary
        testid="dealer-flow-projection"
        line={<span data-testid="dfp-whole-empty">{DFP_WHOLE_EMPTY}</span>}
        foot={foot}
      />
    );
  }
  const { charm, vanna } = dfp;
  const vannaBase = vanna ? `${fmtSignedUsdCompact(vanna.projected_delta)} on +1 IV pt` : null;
  if (charm) {
    return (
      <ContextSummary
        testid="dealer-flow-projection"
        figure={`${fmtSignedUsdCompact(charm.projected_delta)} delta drift`}
        figureAttrs={{ 'data-testid': 'dfp-charm-drift' }}
        help={<AccessibleHelp label={`About ${CHARM_LABEL}`} text={charmInfo(charm.opex_date)} />}
        line={
          <>
            <span data-testid="dfp-charm-horizon">
              to {humanOpex(charm.opex_date)} ({dayCount(charm.horizon_days)})
            </span>
            {' from charm · '}
            {vannaBase != null ? (
              <>
                {'vanna '}
                <span data-testid="dfp-vanna-base">{vannaBase}</span>
              </>
            ) : (
              <span data-testid="dfp-vanna-empty">{VANNA_EMPTY}</span>
            )}
          </>
        }
        foot={foot}
      />
    );
  }
  if (vannaBase != null) {
    return (
      <ContextSummary
        testid="dealer-flow-projection"
        figure={vannaBase}
        figureAttrs={{ 'data-testid': 'dfp-vanna-base' }}
        help={<AccessibleHelp label={`About ${VANNA_LABEL}`} text={VANNA_INFO} />}
        line={
          <>
            {'from vanna · '}
            <span data-testid="dfp-charm-empty">{CHARM_EMPTY}</span>
          </>
        }
        foot={foot}
      />
    );
  }
  return (
    <ContextSummary
      testid="dealer-flow-projection"
      line={
        <>
          <span data-testid="dfp-charm-empty">{CHARM_EMPTY}</span>{' '}
          <span data-testid="dfp-vanna-empty">{VANNA_EMPTY}</span>
        </>
      }
      foot={foot}
    />
  );
}

/** The full read, in the expand overlay: both limbs, the illustration and the assumptions footer. */
function DfpFull({ dfp, foot }: { dfp: Dfp | null; foot: ReactNode }) {
  return (
    <Box data-testid="dealer-flow-projection">
      <OverlayLead>{DFP_SUBTITLE}</OverlayLead>
      {dfp == null ? (
        // Whole-read null: the shell + a single muted line. NO 0, NO error screen.
        <EmptyLine text={DFP_WHOLE_EMPTY} testid="dfp-whole-empty" />
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              // The two limbs pair side by side once the body is wide enough (2×210px, so in the
              // 1200px expand overlay) and stack below that (a phone's overlay), via
              // `auto-fit`/`minmax`. Before NO-1 this body sat in a ≈340–416px band card, where the
              // limbs always stacked; the overlay is now the only place it renders.
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: 1,
            }}
          >
            {dfp.charm != null ? (
              <CharmSection charm={dfp.charm} />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <EmptyLine text={CHARM_EMPTY} testid="dfp-charm-empty" />
              </Box>
            )}
            {dfp.vanna != null ? (
              <VannaSection vanna={dfp.vanna} />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <EmptyLine text={VANNA_EMPTY} testid="dfp-vanna-empty" />
              </Box>
            )}
          </Box>

          {/* Shared assumptions footer — always present with the read. Carries the linear/first-order
              framing + spot basis and the binding honesty frame (verbatim). */}
          <Box sx={{ mt: 1.75 }} data-testid="dfp-footer">
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {dfpFooterAssumptions(dfp.spot_basis)}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {DFP_HONESTY_FRAME}
            </Typography>
          </Box>
        </>
      )}
      {foot != null && <OverlayFoot>{foot}</OverlayFoot>}
    </Box>
  );
}

export const DealerFlowProjection = memo(function DealerFlowProjection({ dfp }: Props) {
  // The foot: the sample source chip on the demo (so the head carries no Sample tag, owner D1); on
  // the live build the read's static basis, never a clock age, so a stream drop or a bundle tick
  // leaves this card's text byte-identical.
  const sample = useWidgetProvenance() === 'sample';
  const foot = <SummaryFoot sample={sample} sampleSource={SAMPLE_SOURCE} basis={STATIC_BASIS} />;
  return (
    <Widget
      id="dealer-flow-projection"
      title={DFP_TITLE}
      info={DFP_INFO}
      sampleTag={false}
      bodySx={QUIET_BODY_SX}
      // Ticker fidelity repair, change 2 (F2) — one 1-col card of the context band's three-column
      // grid (`span` stays the `Widget` default). NO-1 A: the subtitle moved into the overlay body
      // (`DfpFull`), since the Widget header is shared by the band card and the overlay.
    >
      <SummaryOrFull
        summary={<DfpSummary dfp={dfp} foot={foot} />}
        full={<DfpFull dfp={dfp} foot={sample ? foot : null} />}
      />
    </Widget>
  );
});

export default DealerFlowProjection;
