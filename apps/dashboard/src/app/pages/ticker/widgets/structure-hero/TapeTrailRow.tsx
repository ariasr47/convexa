/**
 * TapeTrailRow — presentational hero child (SPEC §2.1/§2.5/§4.2). Wraps the existing
 * `chrome/TapePulseStrip` (kept where it is — PLAN.md FE-6 step 3) with the trail-paused caption
 * SPEC §4.6 requires, verbatim, two arms:
 *
 *   `tape paused · trail frozen`  — the latch currently holds a value (the trail has samples to
 *                                    freeze on)
 *   `tape paused`                — alone, so the caption never asserts a frozen trail that was
 *                                    never drawn (the same two-arm discipline owner ruling 2 sets
 *                                    for values)
 *
 * Every input here is a plain prop — no store read, no derivation of "is this live" a second way.
 * The host (`StructureHeroPanel`) decides WHEN the caption should render at all (`paused`) using the
 * SAME `streamOffline`/session-tape discipline `live-tape/LiveTape.tsx` already established
 * (`tileOffline = st ? false : streamOffline`) — a genuine drop, never a replay arm or a
 * not-yet-connected state.
 *
 * GATE Z (FE-11, SPEC §4.1 "Tape trail row" offline/stale column): `paused` is now ALSO forwarded
 * into `TapePulseStrip` so the `Mid` readout ITSELF carries the pause mark + dims, matching the
 * ladder mid row's own F4/F5 treatment — this row previously only rendered the caption BELOW the
 * readout, never marked the value. Because `paused` is the host's `tileOffline` (never true during a
 * replay standing), the mark can never appear during F6 — the same standing-union mechanism, not a
 * second one.
 */
import type { StructureFieldSurfaces } from '@/shared/charts/structure-field/StructureFieldCanvas';
import type { LevelPalette } from '@/shared/charts/structure-field/levelStrokes';
import type { LiveClaim } from '@/shared/liveness/liveClaim';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { TapePulseStrip } from '../chrome/TapePulseStrip';

export interface TapeTrailRowProps {
  structureMid: number;
  claim: LiveClaim;
  mid: number | null;
  lastTrade?: number | null;
  /** Does the mid latch currently hold a value — selects the trail caption's two arms. */
  retained: boolean;
  /** Show the trail-paused caption at all — true only on a genuine stream drop, never a replay arm
   *  and never the not-yet-connected state (host-computed, SPEC §4.6). */
  paused: boolean;
  palette: LevelPalette;
  surfaces: StructureFieldSurfaces;
  height?: number;
}

export function TapeTrailRow({
  structureMid,
  claim,
  mid,
  lastTrade,
  retained,
  paused,
  palette,
  surfaces,
  height,
}: TapeTrailRowProps) {
  return (
    <Box data-testid="tape-trail-row">
      <TapePulseStrip
        structureMid={structureMid}
        claim={claim}
        mid={mid}
        lastTrade={lastTrade}
        paused={paused}
        palette={palette}
        surfaces={surfaces}
        height={height}
      />
      {paused && (
        <Typography
          component="p"
          data-testid="tape-trail-caption"
          sx={{ fontSize: 11, color: 'text.secondary', mt: -0.5, mb: 1, px: 0.5 }}
        >
          {retained ? 'tape paused · trail frozen' : 'tape paused'}
        </Typography>
      )}
    </Box>
  );
}

export default TapeTrailRow;
