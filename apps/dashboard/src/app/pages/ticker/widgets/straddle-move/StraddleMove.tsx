/**
 * StraddleMove — the `Straddle-implied move` widget (tradeable-rec-inputs SPEC §2.1/§4, PLAN F6).
 * STATIC (rides the cached bundle, never the SSE stream): takes NO `offline`/`isLive` prop and binds
 * no opacity to any stream state (`[live-vs-static-isolation]`) — on an SSE drop it keeps rendering
 * the last bundle, un-dimmed.
 *
 * Renders EXACTLY ONE tenor — the payload's `primary_expiration`, matched by exact expiration.
 * Never array order, never a DTE comparison (AC-53). The three unavailable causes are chosen by
 * CLOSED LOOKUP on the wire `state` — never by inspecting a null (AC-46).
 */
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
}

function EmptyLine({ text, testid }: { text: string; testid: string }) {
  return (
    <Typography variant="body2" data-testid={testid} sx={{ color: 'text.secondary' }}>
      {text}
    </Typography>
  );
}

export function StraddleMove({ move }: Props) {
  const state = move?.state ?? 'not_computed';
  const primary =
    state === 'ok'
      ? (move?.tenors.find((t) => t.expiration === move.primary_expiration) ?? null)
      : null;

  return (
    <Widget id="straddle-move" title={TITLE} span={1} bodyVariant="inset">
      <Box data-testid="straddle-move">
        {state === 'no_quote' && <EmptyLine text={NO_QUOTE} testid="straddle-move-no-quote" />}
        {state === 'no_expiration_in_window' && (
          <EmptyLine text={NO_EXPIRATION_IN_WINDOW} testid="straddle-move-no-window" />
        )}
        {(state === 'not_computed' || (state === 'ok' && !primary)) && (
          <EmptyLine text={UNAVAILABLE} testid="straddle-move-unavailable" />
        )}

        {state === 'ok' && primary && move && (
          <>
            {/* Headline — mono/tabular, never a heading element (component="p" keeps h6 styling off
                the document outline, matching the StatTile / IvRank idiom). */}
            <Typography
              variant="h4"
              component="p"
              data-testid="straddle-move-headline"
              sx={{ fontFamily: MONO, fontWeight: 700 }}
            >
              {headline(primary.move_dollars, primary.move_pct)}
            </Typography>

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
                  move.anchor_spot ?? 0,
                )}
              </Typography>
              {/* Ruling 6 (curvature-v2-foundations): converted to the shipped `AccessibleHelp`
                  pattern — a real focusable `button`, reachable by tap and keyboard (AC-35). */}
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
}

export default StraddleMove;
