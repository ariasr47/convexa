/**
 * `LadderFoot` — re-houses Vol-norm GEX and Raw GEX (1% shock) from the twelve-tile grid this phase
 * decomposes (SPEC §2.3: "the twelve shipped cells decompose with zero orphans — 3 to ladder rows …
 * 2 to the ladder foot"). Criterion 6 (review): both cells and their tooltips are copied
 * BYTE-FOR-BYTE from the old dealer positioning widget's `:122-143` (deleted at FE-8), including
 * the `unavailable` arm — one of the
 * two cases where the frontend genuinely can observe the reason (an input dependency, not a bare
 * absence) — so D-14's `—` does not apply here.
 *
 * REPAIR TASK item 9 (`STRUCTURE_HERO_REPAIR_TASK.md`): the two cells are now `FigureRow`
 * (`direction="column"`) — Mono 18px 500, a sub-line naming each figure's role ("primary
 * magnitude" / "secondary"), compact, no card chrome — pinned to the bottom of the ladder column
 * by `margin-top: auto` on this component's own root, matching the design's `.ladder-foot`. Still
 * the SAME `figureStateOf` state machinery `FigureCell`/`LevelLadder` use — `NOT_LIVE` kept, the
 * `unavailable` literal arm untouched.
 */
import { NOT_LIVE } from '@/shared/liveness/liveClaim';
import type { VolNormalizedGex } from '@convexa/api';
import Box from '@mui/material/Box';
import { fmtUsdCompact } from '../_kit/copy';
import { FigureRow } from '../_kit/FigureCell';

export interface LadderFootProps {
  volNormalizedGex: VolNormalizedGex | null | undefined;
  netGex: number | null | undefined;
}

export function LadderFoot({ volNormalizedGex, netGex }: LadderFootProps) {
  return (
    <Box
      data-testid="ladder-foot"
      sx={{
        mt: 'auto',
        pt: '12px',
        borderTop: '1px solid',
        borderColor: 'divider',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
      }}
    >
      <FigureRow
        register="traced"
        direction="column"
        valueSize={18}
        label="Vol-norm GEX"
        value={volNormalizedGex == null ? 'unavailable' : fmtUsdCompact(volNormalizedGex.net_gex)}
        live={NOT_LIVE}
        caption="primary magnitude"
        info={
          volNormalizedGex == null
            ? 'Primary magnitude read — unavailable until ATM IV or 30d HV lands on this snapshot.'
            : `Primary magnitude (vol-normalized). ${volNormalizedGex.basis_note}`
        }
      />
      <FigureRow
        register="traced"
        direction="column"
        valueSize={18}
        label="Raw GEX (1% shock)"
        value={fmtUsdCompact(netGex ?? null)}
        live={NOT_LIVE}
        caption="secondary"
        info="Secondary: raw dollar dealer gamma for a fixed 1% shock. Prefer Vol-norm GEX above for cross-regime magnitude."
      />
    </Box>
  );
}

export default LadderFoot;
