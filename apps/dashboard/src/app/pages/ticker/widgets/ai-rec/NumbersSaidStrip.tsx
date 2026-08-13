/**
 * NumbersSaidStrip — the digested `What the numbers said` line (SPEC §4, AC-4/54/66, ship-blocking).
 * Renders on EVERY verdict including `no_trade` — the straddle-implied move renders exactly as it
 * does on a trade verdict (the same rendering path, same copy). One digested liquidity line + the
 * move for the cited expiration (exact match; no match ⇒ says so for that expiry and never relabels
 * another tenor's number). No per-contract rows, no strike axis, no sorting, no expansion.
 */
import type { CandidateSetEnvelope, StraddleMove as StraddleMoveRead } from '@convexa/api';
import { Box, Typography } from '@mui/material';
import { headline } from '../straddle-move/copy';
import { candidateFreshnessLine, liquidityLine } from './literals';

interface Props {
  candidates: CandidateSetEnvelope | null | undefined;
  move: StraddleMoveRead | null | undefined;
  /** The expiration this rec cites — `null` (e.g. `no_trade`) falls back to the payload's own
   *  designated primary tenor, so the strip still carries a real move reading (AC-66). */
  citedExpiration: string | null;
}

export function NumbersSaidStrip({ candidates, move, citedExpiration }: Props) {
  const targetExpiration = citedExpiration ?? move?.primary_expiration ?? null;
  const tenor =
    move?.state === 'ok' && targetExpiration
      ? (move.tenors.find((t) => t.expiration === targetExpiration) ?? null)
      : null;
  const freshness = candidateFreshnessLine(candidates);

  return (
    <Box data-testid="numbers-said-strip" sx={{ mt: 1 }}>
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', display: 'block' }}
        data-testid="numbers-said-liquidity"
      >
        {liquidityLine(candidates)}
      </Typography>
      {/* AC-8 — the candidate set's as-of AND whether it's live-session or prior-close, visible
          without hovering, on every candidate-derived surface. */}
      {freshness && (
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', display: 'block' }}
          data-testid="numbers-said-freshness"
        >
          {freshness}
        </Typography>
      )}
      {targetExpiration && (
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', display: 'block' }}
          data-testid={tenor ? 'numbers-said-move' : 'numbers-said-move-absent'}
        >
          {tenor
            ? `${headline(tenor.move_dollars, tenor.move_pct)} implied move for ${targetExpiration}`
            : `No straddle-implied move for ${targetExpiration} in this read.`}
        </Typography>
      )}
    </Box>
  );
}
