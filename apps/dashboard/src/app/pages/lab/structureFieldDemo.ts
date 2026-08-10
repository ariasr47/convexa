/**
 * Synthetic dealer-field samples for the Structure Field lab (no network required).
 * Shaped like a skewed net-GEX curve: put ridge, zero-crossing flip, call ridge.
 */
import type { FieldSample, StructureFieldModel } from '@/shared/charts/structure-field';

export type { FieldSample, StructureFieldModel };

/** Demo curve — liquid-index feel, not a real chain. Multi-ridge for visual depth. */
export function buildDemoField(now = Date.now()): StructureFieldModel {
  const spot = 512.4;
  const putWall = 500;
  const callWall = 530;
  const gammaFlip = 508.2;
  const samples: FieldSample[] = [];
  for (let k = 470; k <= 560; k += 1) {
    const put = -2.8e9 * Math.exp(-0.5 * ((k - putWall) / 6.5) ** 2);
    const putShoulder = -0.55e9 * Math.exp(-0.5 * ((k - (putWall - 12)) / 5) ** 2);
    const call = 3.1e9 * Math.exp(-0.5 * ((k - callWall) / 7.2) ** 2);
    const callShoulder = 0.7e9 * Math.exp(-0.5 * ((k - (callWall + 14)) / 6) ** 2);
    const skew = -0.15e9 * ((k - spot) / 40);
    const body = 0.35e9 * Math.tanh((k - gammaFlip) / 8);
    const micro = 0.08e9 * Math.sin((k - spot) * 0.55) * Math.exp(-0.5 * ((k - spot) / 28) ** 2);
    samples.push({
      strike: k,
      netGex: put + putShoulder + call + callShoulder + skew + body + micro,
    });
  }
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
    .sort((a, b) => a.strike - b.strike);
}
