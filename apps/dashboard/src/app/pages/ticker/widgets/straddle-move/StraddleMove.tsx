/**
 * StraddleMove — the `Straddle-implied move` widget (tradeable-rec-inputs SPEC §2.1/§4, PLAN F6).
 * STATIC (rides the cached bundle, never the SSE stream): takes NO `offline`/`isLive` prop and binds
 * no opacity to any stream state (`[live-vs-static-isolation]`) — on an SSE drop it keeps rendering
 * the last bundle, un-dimmed.
 *
 * Renders EXACTLY ONE tenor — the payload's `primary_expiration`, matched by exact expiration.
 * Never array order, never a DTE comparison (AC-53). The three unavailable causes are chosen by
 * CLOSED LOOKUP on the wire `state` — never by inspecting a null (AC-46).
 *
 * Lane 4 hierarchy pass (board design/src/screens/final/ticker-desk.mjs straddleChart): the move is
 * read against the walls it is about. With data, the title states the finding (canon P-10: "Options
 * price a ±$2.48 move (±0.4%) to Oct 9; both walls sit outside it") and a range bar puts the move's
 * band, the spot and both walls on one price scale (P-9: the claim's band in the band wash with edge
 * hairlines, spot in phosphor, the walls in steel, every mark labelled). Every other state names the
 * metric. The figure sits at card scale (22px): it was a 34px h4, the largest numeral under the
 * masthead, outweighing the price it frames.
 */
import { memo } from 'react';
import { chartRoles } from '@/shared/charts/frame/roles';
import { typographyTokens } from '@/shared/theme/tokens';
import { AccessibleHelp } from '@/shared/ui';
import { Widget } from '@/shared/ui/Widget';
import type { StraddleMove as StraddleMoveRead } from '@convexa/api';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  ADVISORY_LINE,
  basisLine,
  headline,
  moveFinding,
  NO_EXPIRATION_IN_WINDOW,
  NO_QUOTE,
  TITLE,
  TOOLTIP,
  UNAVAILABLE,
  WIDE_QUOTES_MARKER,
} from './copy';

const MONO = typographyTokens.monoFontFamily;

interface Props {
  /** `market_state.straddle_move` — always an object on a post-feature backend; `null`/`undefined`
   *  tolerated defensively (an older cached payload) and treated as `not_computed`. */
  move: StraddleMoveRead | null | undefined;
  /** The walls the move is read against (`market_state.call_wall` / `put_wall`). Optional: without
   *  them the card states the move alone. */
  callWall?: number | null;
  putWall?: number | null;
}

function EmptyLine({ text, testid }: { text: string; testid: string }) {
  return (
    <Typography variant="body2" data-testid={testid} sx={{ color: 'text.secondary' }}>
      {text}
    </Typography>
  );
}

const finite = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);

/** The move's band, the spot and the walls on one price scale. Labels are HTML text at 11px or more
 *  (P-13); the walls name themselves, the band states its two edges. */
function MoveRange({
  spot,
  move,
  callWall,
  putWall,
}: {
  spot: number;
  move: number;
  callWall: number | null;
  putWall: number | null;
}) {
  const low = spot - move;
  const high = spot + move;
  const marks = [low, high, spot, callWall, putWall].filter(finite);
  const min = Math.min(...marks);
  const max = Math.max(...marks);
  const pad = (max - min) * 0.04 || 1;
  const lo = min - pad;
  const hi = max + pad;
  const x = (v: number) => `${(((v - lo) / (hi - lo)) * 100).toFixed(2)}%`;
  const wall = (value: number, name: string, side: 'left' | 'right') => (
    <>
      <Box
        aria-hidden
        sx={(t) => ({
          position: 'absolute',
          top: 22,
          height: 30,
          left: x(value),
          width: '2px',
          ml: '-1px',
          bgcolor: chartRoles(t).ctx,
        })}
      />
      <Box
        component="span"
        sx={{
          position: 'absolute',
          top: 0,
          left: x(value),
          transform: side === 'right' ? 'translateX(-100%)' : 'none',
          fontFamily: MONO,
          fontSize: 11,
          lineHeight: 1.6,
          color: 'text.secondary',
          whiteSpace: 'nowrap',
        }}
      >
        {name} {value.toFixed(2)}
      </Box>
    </>
  );
  // A wall left of the spot labels to its right, a wall right of it to its left, so both labels
  // stay inside the scale.
  const sideOf = (v: number): 'left' | 'right' => (v < spot ? 'left' : 'right');
  return (
    <Box
      role="img"
      data-testid="straddle-move-range"
      aria-label={`Implied move ${low.toFixed(2)} to ${high.toFixed(2)} around ${spot.toFixed(2)}${finite(putWall) ? `; put wall ${putWall.toFixed(2)}` : ''}${finite(callWall) ? `; call wall ${callWall.toFixed(2)}` : ''}`}
      sx={{ position: 'relative', height: 78, mt: 1.25, mx: 0.5 }}
    >
      <Box
        aria-hidden
        sx={(t) => ({
          position: 'absolute',
          top: 36,
          left: 0,
          right: 0,
          height: '1px',
          bgcolor: chartRoles(t).axis,
        })}
      />
      <Box
        aria-hidden
        sx={(t) => ({
          position: 'absolute',
          top: 27,
          height: 19,
          left: x(low),
          width: `calc(${x(high)} - ${x(low)})`,
          bgcolor: chartRoles(t).band,
          borderLeft: `1px solid ${chartRoles(t).edge}`,
          borderRight: `1px solid ${chartRoles(t).edge}`,
        })}
      />
      {finite(putWall) && wall(putWall, 'Put wall', sideOf(putWall))}
      {finite(callWall) && wall(callWall, 'Call wall', sideOf(callWall))}
      <Box
        aria-hidden
        sx={(t) => ({
          position: 'absolute',
          top: 31,
          left: x(spot),
          width: 11,
          height: 11,
          ml: '-5.5px',
          borderRadius: '50%',
          bgcolor: chartRoles(t).emph,
          boxShadow: `0 0 0 2px ${t.palette.background.paper}`,
        })}
      />
      <Box
        component="span"
        sx={{
          position: 'absolute',
          top: 54,
          left: `clamp(0%, ${x(spot)}, 100%)`,
          transform: 'translateX(-50%)',
          fontFamily: MONO,
          fontSize: 11,
          lineHeight: 1.6,
          color: 'text.primary',
          whiteSpace: 'nowrap',
        }}
      >
        {low.toFixed(2)} – {high.toFixed(2)}
      </Box>
    </Box>
  );
}

export const StraddleMove = memo(function StraddleMove({ move, callWall = null, putWall = null }: Props) {
  const state = move?.state ?? 'not_computed';
  const primary =
    state === 'ok'
      ? (move?.tenors.find((t) => t.expiration === move.primary_expiration) ?? null)
      : null;
  const spot = move?.anchor_spot ?? null;
  const ready = state === 'ok' && primary != null && move != null;
  // P-10: a finding over data, the metric otherwise.
  const title = ready
    ? moveFinding({
        moveDollars: primary.move_dollars,
        movePct: primary.move_pct,
        expiration: primary.expiration,
        spot,
        callWall,
        putWall,
      })
    : TITLE;

  return (
    <Widget
      id="straddle-move"
      title={title}
      titleWrap
      subtitle={ready ? `${TITLE} · ATM straddle · mid quotes` : undefined}
      span={ready ? 2 : 1}
      bodyVariant="inset"
    >
      <Box data-testid="straddle-move">
        {state === 'no_quote' && <EmptyLine text={NO_QUOTE} testid="straddle-move-no-quote" />}
        {state === 'no_expiration_in_window' && (
          <EmptyLine text={NO_EXPIRATION_IN_WINDOW} testid="straddle-move-no-window" />
        )}
        {(state === 'not_computed' || (state === 'ok' && !primary)) && (
          <EmptyLine text={UNAVAILABLE} testid="straddle-move-unavailable" />
        )}

        {ready && (
          <>
            {/* Headline — mono/tabular, never a heading element, at card scale. */}
            <Typography
              component="p"
              data-testid="straddle-move-headline"
              sx={{ m: 0, fontFamily: MONO, fontWeight: 600, fontSize: 22, lineHeight: 1.2 }}
            >
              {headline(primary.move_dollars, primary.move_pct)}
            </Typography>

            {finite(spot) && finite(primary.move_dollars) && primary.move_dollars > 0 && (
              <MoveRange
                spot={spot}
                move={primary.move_dollars}
                callWall={finite(callWall) ? callWall : null}
                putWall={finite(putWall) ? putWall : null}
              />
            )}

            {/* Basis line — visible without hovering, never tooltip-only (AC-45). */}
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'flex-start', mt: 0.75 }}>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary' }}
                data-testid="straddle-move-basis"
              >
                {basisLine(
                  primary.expiration,
                  primary.dte,
                  move.anchor_label,
                  move.anchor_spot ?? null,
                )}
              </Typography>
              {/* Ruling 6 (curvature-v2-foundations): the shipped `AccessibleHelp` pattern — a real
                  focusable `button`, reachable by tap and keyboard (AC-35). */}
              <AccessibleHelp label="About the straddle-implied move" text={TOOLTIP} />
            </Stack>

            {primary.wide_quotes && (
              <Chip
                size="small"
                variant="outlined"
                label={`${WIDE_QUOTES_MARKER} · threshold ${move.wide_quote_threshold_pct}%`}
                data-testid="straddle-move-wide-quotes"
                sx={{ mt: 0.75 }}
              />
            )}

            {/* Advisory line — not a forecast, not a probability, not a scored signal. */}
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', mt: 1 }}
              data-testid="straddle-move-advisory"
            >
              {ADVISORY_LINE}
            </Typography>
          </>
        )}
      </Box>
    </Widget>
  );
});

export default StraddleMove;
