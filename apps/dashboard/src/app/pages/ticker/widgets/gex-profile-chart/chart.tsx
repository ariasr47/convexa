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

/** The readable strike window around spot, always wide enough to include the walls it labels.
 *  Shared with the section wrapper so it can decide whether to render the widget at all. */
export function windowedStrikes(
  strikes: StrikeRow[],
  spot: number,
  callWall: number,
  putWall: number,
): StrikeRow[] {
  const lo = Math.min(spot * 0.9, putWall > 0 ? putWall : spot * 0.9);
  const hi = Math.max(spot * 1.1, callWall > 0 ? callWall : spot * 1.1);
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
