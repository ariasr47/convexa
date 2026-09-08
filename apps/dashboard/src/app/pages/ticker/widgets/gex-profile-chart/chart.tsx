/**
 * GEX strike profile — pure windowing/mapping helpers shared with the desk's primary structure
 * instrument (`structure-hero/StructureHeroPanel.tsx`).
 *
 * GATE Z (FE-11, curvature-v2-desk-and-read): the STANDALONE chart component this file used to
 * export (`GexProfileChart`, plus its `GexLegend` header decoration) is DELETED — its own host
 * widget, `GexStrikeProfile.tsx`, is fully superseded by `StructureHeroPanel` (same
 * `StructureFieldCanvas`, same walls/flip/mid, same embedded `StructurePathStrip`) and is deleted
 * whole in the same commit. Coexisting on one ticker page was a KNOWN, NAMED, TEMPORARY condition
 * disclosed at FE-8/FE-6; this is where it resolves — the desk becomes ONE structure instrument, not
 * two overlapping ones. `windowedStrikes`/`rowsToSamples` below are NOT dead — `StructureHeroPanel`
 * calls both directly to build its own `StructureFieldModel`, which is exactly why this file survives
 * the widget's deletion instead of going with it.
 */
import type { FieldSample } from '@/shared/charts/structure-field';
import type { StrikeRow } from '@convexa/api';

/**
 * The readable strike window (repair task item 3 — `STRUCTURE_HERO_REPAIR_TASK.md`): the old
 * `spot ± 10%` window kept every wall inside it but gave the walls no more than ~13% of the plot
 * (SPY: $694–$847 while every level sat between $751–$780) — the structure the field exists to show
 * read as a flat tail of noise. The window is now anchored on the WALLS themselves: `lo/hi = walls ±
 * max(1.5% of spot, 25% of the wall span)`, widened only as far as needed so `gammaFlip`/`maxPain`
 * sit inside too, then the filter below naturally clamps to whatever strikes actually exist.
 * Non-positive walls fall back to the old plain `±10%` spot window (unchanged case).
 */
export function windowedStrikes(
  strikes: StrikeRow[],
  spot: number,
  callWall: number,
  putWall: number,
  gammaFlip?: number | null,
  maxPain?: number | null,
): StrikeRow[] {
  const wallsValid = callWall > 0 && putWall > 0;
  let lo: number;
  let hi: number;
  if (wallsValid) {
    const wallLo = Math.min(callWall, putWall);
    const wallHi = Math.max(callWall, putWall);
    const span = wallHi - wallLo;
    const pad = Math.max(spot * 0.015, span * 0.25);
    lo = wallLo - pad;
    hi = wallHi + pad;
  } else {
    lo = spot * 0.9;
    hi = spot * 1.1;
  }
  // Widen only as far as needed so the flip and max pain — also plotted on the field — sit inside.
  for (const level of [gammaFlip, maxPain]) {
    if (level != null && Number.isFinite(level) && level > 0) {
      lo = Math.min(lo, level);
      hi = Math.max(hi, level);
    }
  }
  return strikes
    .filter((s) => s.strike >= lo && s.strike <= hi)
    .toSorted((a, b) => a.strike - b.strike);
}

/** Exported so `structure-hero/StructureHeroPanel.tsx` can build the SAME `StructureFieldModel`
 *  shape directly (it renders `StructureFieldCanvas` itself, not through this file's own
 *  `GexProfileChart` — see that file's module doc for why the palette/surfaces IDENTITY the ladder
 *  shares with the canvas rules out routing through a component that resolves its own theme). */
export function rowsToSamples(rows: StrikeRow[]): FieldSample[] {
  return rows.map((s) => ({
    strike: s.strike,
    netGex: s.net_gex,
    netDex: s.net_dex,
    volOi: s.vol_oi_ratio,
    volume: s.volume,
  }));
}
