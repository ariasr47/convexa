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
 */
import { typographyTokens } from '@/shared/theme/tokens';
import { AccessibleHelp } from '@/shared/ui';
import { Widget } from '@/shared/ui/Widget';
import type { DealerFlowProjection as Dfp } from '@convexa/api';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
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
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mb: 0.75 }}>
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

/** The recessed limb card — a StatTile-family surface so the reads sit on the widget's inset well. */
function LimbCard({ children, testid }: { children: React.ReactNode; testid: string }) {
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
      <CardContent sx={{ '&:last-child': { pb: 1.75 } }}>{children}</CardContent>
    </Card>
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

export function DealerFlowProjection({ dfp }: Props) {
  return (
    <Widget
      id="dealer-flow-projection"
      title={DFP_TITLE}
      subtitle={DFP_SUBTITLE}
      info={DFP_INFO}
      span={2}
      bodyVariant="inset"
    >
      <Box data-testid="dealer-flow-projection">
        {dfp == null ? (
          // Whole-read null: the shell + a single muted line. NO 0, NO error screen.
          <EmptyLine text={DFP_WHOLE_EMPTY} testid="dfp-whole-empty" />
        ) : (
          <>
            <Box
              sx={{
                display: 'grid',
                // Intrinsically responsive (matches ReadStrip's idiom): the two limbs pair
                // side-by-side once the widget is wide enough (~440px) and stack below it, via
                // `auto-fit`/`minmax`. CORRECTED (curvature-v2-foundations SPEC §2.5): the prior
                // claim here — that this Emotion version doesn't pass `@container` through and
                // warns on the kebab-case condition — is FALSE for the dependency state in this
                // tree (verified three levels down: Emotion emits an object key with an object
                // value verbatim, its kebab-case warning fires only in the scalar-value branch for
                // CSS property names; stylis 4.2.0 special-cases `@c…n` into the nested-at-rule
                // branch; MUI attaches `theme.containerQueries` and sorts container queries on every
                // `sx` result). Container-query support is NOT the risk. This widget stays on
                // `auto-fit`/`minmax` anyway — it is one of the four hand-rolled StatTile-family
                // widgets ruling 6 keeps unconverted; adding `@container` here is a later phase's
                // rebuild, not this comment fix.
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: 2,
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
      </Box>
    </Widget>
  );
}

export default DealerFlowProjection;
