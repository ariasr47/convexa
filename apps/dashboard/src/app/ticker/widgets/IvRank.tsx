/**
 * IvRank — the "IV rank" STATIC-read-family widget (iv-rank FRONTEND_EXECUTION_CONTRACT). It surfaces
 * the additive `market_state.iv_rank` single-object read as one of FOUR mutually-exclusive body states,
 * selected PURELY from the wire `state` discriminant + nullable `rank` (never re-derived FE-side):
 *   - Computed (rank defined): headline Rank + descriptor, secondary Percentile + descriptor, ONE band
 *     token (closed lookup), the self-describing envelope (window sessions · sample count · basis), and
 *     the advisory footer.
 *   - Computed · degenerate-flat (rank == null, flat reason): the flat note in the rank slot; Percentile
 *     + envelope + advisory footer still render; NO band token.
 *   - Building (state == 'building'): the "Building history — N of N_min sessions" message; NO rank, NO
 *     percentile, NO band; the advisory footer (+ basis line when a sample exists).
 *   - Unavailable (read == null, or an unknown state): the single muted "IV rank unavailable this
 *     cycle." line; no sub-content, no advisory footer. Fail-honest.
 *
 * Binding invariants (restated so the seam stays honest):
 *   - `[live-vs-static-isolation]` (AC-17) — STATIC. It takes NO `offline`/`isLive`/`streamOffline`
 *     prop, reads NEITHER the SSE stream NOR the payload-gap watchdog, and carries NO `⏸ offline` chip.
 *     On a stream drop it stays byte-identical + un-dimmed (contrast: the LiveTape tiles dim). It
 *     refreshes only on the REST poll (a new `read` value from a new bundle).
 *   - `model-read-carries-its-assumptions` (AC-7/8/18/19) — NEVER a bare number: the rank/percentile
 *     always appear WITH the basis line (window + sample count + basis) + advisory framing in the SAME
 *     body. The self-describing envelope is not gated behind interaction.
 *   - `digested-labels-not-raw-dump` (AC-6/9) — ONE band token via a closed lookup; NO chart/series/
 *     list/table/sparkline of daily IV in any state (there is no series on the wire). The band is NEVER
 *     re-derived from `rank`.
 *   - `additive-keeps-score-byte-identical` — display-only advisory context. No copy/color/placement
 *     implies it feeds score/gate/tier/setup; the band's rich/cheap lean-framing is the ONLY permitted
 *     directional language (and it inherits the advisory frame).
 *   - `best-effort-isolated-or-null` (AC-12/14/15) — the null/unknown-state read renders ONE muted
 *     line; a null never blanks/errors the rest of the board.
 *   - `theme-token-discipline` — token-only via the MUI theme (`text.disabled`/`text.secondary`/
 *     `divider`, mono via tokens), zero hardcoded hex; dark/light parity from the shared chrome.
 *   - No auth gate — renders for anonymous visitors; no session/gate call anywhere in it.
 */
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, Stack, Tooltip, Typography } from '@mui/material';
import type { IvRankRead } from '@org/api';
import { typographyTokens } from '../../tokens';
import {
  IVR_ADVISORY,
  IVR_FLAT_NOTE,
  IVR_INFO,
  IVR_PCT_LABEL,
  IVR_RANK_LABEL,
  IVR_SUBTITLE,
  IVR_TIP_BAND,
  IVR_TIP_BASIS,
  IVR_TIP_PCT,
  IVR_TIP_RANK,
  IVR_TITLE,
  IVR_WHOLE_EMPTY,
  ivrBandDisplay,
  ivrBasisLine,
  ivrBuildingMessage,
  ivrPctDescriptor,
  ivrRankDescriptor,
  ivrTipBuilding,
} from './copy';
import { Widget } from './Widget';

const MONO = typographyTokens.monoFontFamily;

interface Props {
  /** The additive static read (`m.iv_rank ?? null`). NO live/offline prop is accepted — this widget is
   *  bound to the last-bundle render path only (`[live-vs-static-isolation]`). */
  read: IvRankRead | null;
  revealIndex?: number;
}

/** A muted "unavailable this cycle" line (`text.disabled`) — the ONLY whole-read empty render. */
function EmptyLine({ text, testid }: { text: string; testid: string }) {
  return (
    <Typography variant="body2" data-testid={testid} sx={{ color: 'text.disabled' }}>
      {text}
    </Typography>
  );
}

/** A caption label + ⓘ info affordance (the tooltip carrier — the StatTile-family idiom). */
function CaptionLabel({ label, info, testid }: { label: string; info: string; testid?: string }) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: 0.3 }}
      >
        {label}
      </Typography>
      <Tooltip title={info} arrow placement="top">
        <InfoOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled' }} data-testid={testid} />
      </Tooltip>
    </Stack>
  );
}

/** The basis/envelope line (always visible with the numbers — `model-read-carries-its-assumptions`). */
function BasisLine({ read }: { read: IvRankRead }) {
  return (
    <Stack
      direction="row"
      spacing={0.5}
      sx={{ alignItems: 'flex-start', mt: 0.75 }}
      data-testid="ivr-basis-row"
    >
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', display: 'block' }}
        data-testid="ivr-basis"
      >
        {ivrBasisLine(
          read.window_sessions,
          read.window_cap,
          read.sample_count,
          read.iv_basis,
          read.basis_dte,
        )}
      </Typography>
      <Tooltip title={IVR_TIP_BASIS} arrow placement="top">
        <InfoOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
      </Tooltip>
    </Stack>
  );
}

/** The advisory footer — present with Computed + Building (verbatim, no interaction). */
function AdvisoryFooter() {
  return (
    <Box sx={{ mt: 1.75 }} data-testid="ivr-footer">
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {IVR_ADVISORY}
      </Typography>
    </Box>
  );
}

/** The Computed body (rank defined OR degenerate-flat). The rank slot carries either the headline
 *  number + descriptor, or — when `rank == null` — the flat note; the band renders ONLY with a defined
 *  rank; Percentile + basis line + footer render in both sub-cases. */
function ComputedBody({ read }: { read: IvRankRead }) {
  const band = read.rank != null && read.band != null ? ivrBandDisplay(read.band) : null;
  return (
    <>
      {/* Rank slot — headline number + descriptor, OR the flat note (never a fabricated midpoint). */}
      <Box sx={{ mb: 1.25 }} data-testid="ivr-rank-slot">
        <CaptionLabel label={IVR_RANK_LABEL} info={IVR_TIP_RANK} testid="ivr-rank-info" />
        {read.rank == null ? (
          <Typography variant="body1" sx={{ color: 'text.secondary' }} data-testid="ivr-flat-note">
            {IVR_FLAT_NOTE}
          </Typography>
        ) : (
          <>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
              <Typography
                variant="h4"
                sx={{ fontFamily: MONO, fontWeight: 700 }}
                data-testid="ivr-rank-value"
              >
                {read.rank}
              </Typography>
              {/* The ONE band token — closed lookup, never re-derived from the rank. Its lean-framing
                  tooltip is the ONLY permitted directional language (and it inherits the advisory frame). */}
              {band != null && (
                <Tooltip title={IVR_TIP_BAND} arrow placement="top">
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', fontWeight: 600 }}
                    data-testid="ivr-band"
                  >
                    {band}
                  </Typography>
                </Tooltip>
              )}
            </Stack>
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary' }}
              data-testid="ivr-rank-descriptor"
            >
              {ivrRankDescriptor(read.rank, read.window_cap)}
            </Typography>
          </>
        )}
      </Box>

      {/* Secondary — Percentile + descriptor (present in Computed AND degenerate-flat, D8b). */}
      {read.percentile != null && (
        <Box sx={{ mb: 0.5 }} data-testid="ivr-pct-slot">
          <CaptionLabel label={IVR_PCT_LABEL} info={IVR_TIP_PCT} testid="ivr-pct-info" />
          <Typography
            variant="body1"
            sx={{ fontFamily: MONO, fontWeight: 600 }}
            data-testid="ivr-pct-value"
          >
            {read.percentile}
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: 'text.secondary' }}
            data-testid="ivr-pct-descriptor"
          >
            {ivrPctDescriptor(read.percentile)}
          </Typography>
        </Box>
      )}

      <BasisLine read={read} />
      <AdvisoryFooter />
    </>
  );
}

/** The Building body — the "Building history — N of N_min sessions" message; NO rank/percentile/band.
 *  The advisory footer + the ⓘ carry the framing; the count lives in the message itself. */
function BuildingBody({ read }: { read: IvRankRead }) {
  return (
    <Box data-testid="ivr-building">
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'flex-start' }}>
        <Typography
          variant="body1"
          sx={{ color: 'text.secondary' }}
          data-testid="ivr-building-message"
        >
          {ivrBuildingMessage(read.sample_count, read.min_samples)}
        </Typography>
        <Tooltip title={ivrTipBuilding(read.min_samples)} arrow placement="top">
          <InfoOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
        </Tooltip>
      </Stack>
      <AdvisoryFooter />
    </Box>
  );
}

export function IvRank({ read, revealIndex }: Props) {
  // Body-state selection is wire-driven: the `state` discriminant + nullable `rank`. An unknown state
  // (or a null read) degrades to the Unavailable body — fail-honest, never a broken render.
  const body =
    read == null
      ? 'unavailable'
      : read.state === 'computed'
        ? 'computed'
        : read.state === 'building'
          ? 'building'
          : 'unavailable'; // unknown state → fail-honest

  return (
    <Widget
      id="iv-rank"
      title={IVR_TITLE}
      subtitle={IVR_SUBTITLE}
      info={IVR_INFO}
      span={1}
      bodyVariant="inset"
      revealIndex={revealIndex}
    >
      <Box data-testid="iv-rank">
        {body === 'unavailable' ? (
          // Whole-read null / unknown state: the shell + ONE muted line. No sub-content, no footer.
          <EmptyLine text={IVR_WHOLE_EMPTY} testid="ivr-whole-empty" />
        ) : body === 'building' ? (
          <BuildingBody read={read!} />
        ) : (
          <ComputedBody read={read!} />
        )}
      </Box>
    </Widget>
  );
}

export default IvRank;
