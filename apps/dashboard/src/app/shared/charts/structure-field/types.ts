/**
 * Structure Field model — dual-clock dealer net-GEX instrument (shared by ticker + lab).
 */

export interface FieldSample {
  strike: number;
  netGex: number;
  /** Optional probe extras (from StrikeRow when available). */
  netDex?: number | null;
  volOi?: number | null;
  volume?: number | null;
}

export interface StructureFieldModel {
  symbol: string;
  samples: FieldSample[];
  spot: number;
  callWall: number;
  putWall: number;
  gammaFlip: number;
  /** Structure clock — seconds epoch, or null. */
  asOfSec: number | null;
  /** Live mid overlay (tape clock); null = structure-only. */
  liveMid: number | null;
  live: boolean;
  source: 'demo' | 'live' | 'rest';
}
