/**
 * Synthetic dealer-field samples for the Structure Field lab (no network required).
 * Shaped like a skewed net-GEX curve: put ridge, zero-crossing flip, call ridge.
 */
import type { FieldSample, StructureFieldModel } from '@/shared/charts/structure-field';

export type { FieldSample, StructureFieldModel };

/**
 * The Lab's synthetic SPY-shaped field, as the design draws it (design/src/screens/final/lab-draw.mjs
 * LV and SF_FIELD; owner ruling 2026-10-14). Net dealer gamma by strike in $M per 1% move: short gamma
 * below the 568.5 flip, bottoming at the 560 put wall; long above it, peaking at the 580 call wall.
 * The values cross zero once, between 567.5 and 570, so the flip label and the bars agree. (The curve
 * this replaced was labelled with a flip at 508.2 but crossed zero at 512.9, above its own spot.)
 */
export const DEMO_LEVELS = { putWall: 560, gammaFlip: 568.5, callWall: 580, spot: 573.12 } as const;
const DEMO_FIELD_M: readonly (readonly [strike: number, netGexM: number])[] = [
  [550, -61],
  [552.5, -123],
  [555, -233],
  [557.5, -357],
  [560, -430],
  [562.5, -367],
  [565, -235],
  [567.5, -103],
  [570, 68],
  [572.5, 158],
  [575, 332],
  [577.5, 488],
  [580, 500],
  [582.5, 394],
  [585, 233],
  [587.5, 112],
  [590, 58],
  [592.5, 43],
  [595, 40],
  [597.5, 40],
  [600, 40],
];

/** Demo field — synthetic, not a real chain. */
export function buildDemoField(now = Date.now()): StructureFieldModel {
  const { spot, putWall, callWall, gammaFlip } = DEMO_LEVELS;
  const samples: FieldSample[] = DEMO_FIELD_M.map(([strike, m]) => ({ strike, netGex: m * 1e6 }));
  const t = now / 1000;
  const liveMid =
    spot +
    Math.sin(t * 0.35) * 0.85 +
    Math.sin(t * 0.11) * 0.25 +
    Math.sin(t * 1.7) * 0.08 +
    (Math.sin(t * 0.03) > 0.97 ? Math.sin(t * 8) * 0.35 : 0);
  return {
    symbol: 'DEMO',
    samples,
    spot,
    callWall,
    putWall,
    gammaFlip,
    asOfSec: now / 1000 - 97,
    liveMid,
    live: true,
    source: 'demo',
  };
}

export function samplesFromStrikes(strikes: { strike: number; net_gex: number }[]): FieldSample[] {
  return strikes
    .filter((s) => Number.isFinite(s.strike) && Number.isFinite(s.net_gex))
    .map((s) => ({ strike: s.strike, netGex: s.net_gex }))
    .toSorted((a, b) => a.strike - b.strike);
}
