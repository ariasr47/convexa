/**
 * `LadderFoot` — re-houses Vol-norm GEX and Raw GEX (1% shock) from the twelve-tile grid this phase
 * decomposes (SPEC §2.3: "the twelve shipped cells decompose with zero orphans — 3 to ladder rows …
 * 2 to the ladder foot"). Criterion 6 (review): both cells and their tooltips are copied
 * BYTE-FOR-BYTE from the old dealer positioning widget's `:122-143` (deleted at FE-8), including
 * the `unavailable` arm — one of the
 * two cases where the frontend genuinely can observe the reason (an input dependency, not a bare
 * absence) — so D-14's `—` does not apply here.
 */
import { NOT_LIVE } from '@/shared/liveness/liveClaim';
import type { VolNormalizedGex } from '@convexa/api';
import Stack from '@mui/material/Stack';
import { fmtUsdCompact } from '../_kit/copy';
import { FigureCell } from '../_kit/FigureCell';

export interface LadderFootProps {
  volNormalizedGex: VolNormalizedGex | null | undefined;
  netGex: number | null | undefined;
}

export function LadderFoot({ volNormalizedGex, netGex }: LadderFootProps) {
  return (
    <Stack direction="row" spacing={2} data-testid="ladder-foot">
      <FigureCell
        register="traced"
        label="Vol-norm GEX"
        value={volNormalizedGex == null ? 'unavailable' : fmtUsdCompact(volNormalizedGex.net_gex)}
        live={NOT_LIVE}
        info={
          volNormalizedGex == null
            ? 'Primary magnitude read — unavailable until ATM IV or 30d HV lands on this snapshot.'
            : `Primary magnitude (vol-normalized). ${volNormalizedGex.basis_note}`
        }
      />
      <FigureCell
        register="traced"
        label="Raw GEX (1% shock)"
        value={fmtUsdCompact(netGex ?? null)}
        live={NOT_LIVE}
        info="Secondary: raw dollar dealer gamma for a fixed 1% shock. Prefer Vol-norm GEX above for cross-regime magnitude."
      />
    </Stack>
  );
}

export default LadderFoot;
