/**
 * CitedContractLine — the cited-contract fact line (SPEC §4/§2.5, AC-73/74/75/76/77). A per-contract
 * quote renders ONLY when strike + expiration + right together resolve to exactly one contract in
 * the candidate set (structural — this component only RENDERS the server's closed `cited_contract`
 * verdict; it performs no matching of its own).
 */
import { fmtExpiry } from '@/pages/ticker/widgets/_kit/copy';
import type { CitedContract } from '@convexa/api';
import Typography from '@mui/material/Typography';
import { OFF_SET_LITERAL, UNDETERMINED_RIGHT_BOTH_LEGS, UNDETERMINED_RIGHT_NO_QUOTE } from './copy';
import { citedLine } from './literals';

export function CitedContractLine({
  cited,
  asOf = null,
}: {
  cited: CitedContract | undefined | null;
  /** The candidate set's own as-of (AC-8) — interpolated into the quoted-arm fact line. */
  asOf?: string | null;
}) {
  const line = citedLine(cited, asOf);

  if (line.kind === 'none') return null;

  if (line.kind === 'off_set') {
    return (
      <Typography
        variant="caption"
        data-testid="cited-contract-line"
        sx={{ color: 'text.secondary' }}
      >
        {OFF_SET_LITERAL}
      </Typography>
    );
  }

  if (line.kind === 'right_undetermined') {
    const hasLegs = line.legs.length > 0;
    return (
      <Typography
        variant="caption"
        data-testid="cited-contract-line"
        sx={{ color: 'text.secondary' }}
      >
        {hasLegs ? UNDETERMINED_RIGHT_BOTH_LEGS : UNDETERMINED_RIGHT_NO_QUOTE}
      </Typography>
    );
  }

  // cited
  const rightLabel = line.right === 'call' ? 'C' : 'P';
  return (
    <Typography
      variant="caption"
      data-testid="cited-contract-line"
      sx={{ color: 'text.secondary' }}
    >
      {/* Fidelity repair 2, N5 — the design's expiry form (`Sep 18 (15 DTE)`), never the raw
          `YYYY-MM-DD` date `citedLine` carries (that shape is `CitedLine`'s own data contract,
          pinned in `literals.spec.ts` — formatted here, at the render boundary, not upstream). */}
      {`${line.strike} ${rightLabel} ${fmtExpiry(line.expiration)} · ${line.quoteText}`}
    </Typography>
  );
}
