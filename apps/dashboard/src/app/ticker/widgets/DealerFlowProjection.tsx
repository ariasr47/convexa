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
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, Card, CardContent, Stack, Tooltip, Typography } from '@mui/material';
import type { DealerFlowProjection as Dfp } from '@org/api';
import { typographyTokens } from '../../tokens';
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
} from './copy';
import { Widget } from './Widget';

const MONO = typographyTokens.monoFontFamily;

interface Props {
  /** The additive static read (object | null). NO live/offline prop is accepted — this widget is
   *  bound to the last-bundle render path only (`[live-vs-static-isolation]`). */
  dfp: Dfp | null;
  revealIndex?: number;
}

/** A muted "unavailable this cycle" line (`text.disabled`) — the ONLY empty render. Never a 0. */
function EmptyLine({ text, testid }: { text: string; testid: string }) {
  return (
    <Typography variant="body2" data-testid={testid} sx={{ color: 'text.disabled' }}>
      {text}
    </Typography>
  );
}

/** A limb section header: the label + an ⓘ info affordance carrying the StatTile-family tooltip. */
function LimbLabel({ label, info }: { label: string; info: string }) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mb: 0.75 }}>
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: 0.3 }}
      >
        {label}
      </Typography>
      <Tooltip title={info} arrow placement="top">
        <InfoOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
      </Tooltip>
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
      <Typography variant="h6" sx={{ fontFamily: MONO }} data-testid="dfp-charm-drift">
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
      <Typography variant="h6" sx={{ fontFamily: MONO }} data-testid="dfp-vanna-base">
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

export function DealerFlowProjection({ dfp, revealIndex }: Props) {
  return (
    <Widget
      id="dealer-flow-projection"
      title={DFP_TITLE}
      subtitle={DFP_SUBTITLE}
      info={DFP_INFO}
      span={2}
      bodyVariant="inset"
      revealIndex={revealIndex}
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
                // Intrinsically responsive (matches DealerPositioning's idiom): the two limbs pair
                // side-by-side once the widget is wide enough (~440px) and stack below it, with no
                // container-query object key (this Emotion version doesn't pass `@container` through
                // and warns on the kebab-case condition).
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
