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
  /** Max pain — REST structure, drawn dashed in the field (repair task item 5). Optional/nullable:
   *  a missing max pain drops the dashed line and its marker label, never a synthetic zero. */
  maxPain?: number | null;
  /** Structure clock — seconds epoch, or null. */
  asOfSec: number | null;
  /** Live mid overlay (tape clock); null = structure-only. */
  liveMid: number | null;
  live: boolean;
  source: 'demo' | 'live' | 'rest';
}
