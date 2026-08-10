/**
 * Shared Structure Field helpers (Canvas2D + WebGL lab instruments).
 * Brand literals match tokens.ts — canvas/WebGL cannot use MUI sx.
 */

export const SF = {
  ink: '#0B0F17',
  panel: '#131A24',
  phosphor: '#E9E4D6',
  steel: '#8A9BB4',
  amber: '#F2A93B',
  signal: '#5E8BC4',
  green: '#2ecc71',
  red: '#ff5c5c',
  raised: '#1B2432',
  burnt: '#E07A3F',
} as const;

/** RGB 0..1 from #RRGGBB */
export function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  );
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function fmtM(v: number): string {
  const a = Math.abs(v);
  const s = v < 0 ? '-' : '';
  if (a >= 1e9) return `${s}${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}${(a / 1e3).toFixed(0)}K`;
  return `${s}${a.toFixed(0)}`;
}

export function relAge(asOfSec: number | null, nowMs: number): string {
  if (asOfSec == null) return 'demo as-of';
  const s = Math.max(0, Math.floor(nowMs / 1000 - asOfSec));
  if (s < 60) return `Structure as-of ${s}s ago`;
  if (s < 3600) return `Structure as-of ${Math.floor(s / 60)}m ago`;
  return `Structure as-of ${Math.floor(s / 3600)}h ago`;
}

export function gexAt(samples: { strike: number; netGex: number }[], strike: number): number {
  if (samples.length === 0) return 0;
  if (strike <= samples[0].strike) return samples[0].netGex;
  if (strike >= samples[samples.length - 1].strike) return samples[samples.length - 1].netGex;
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i];
    const b = samples[i + 1];
    if (strike >= a.strike && strike <= b.strike) {
      const t = (strike - a.strike) / (b.strike - a.strike || 1);
      return a.netGex + (b.netGex - a.netGex) * t;
    }
  }
  return 0;
}

export function structureKey(m: {
  symbol: string;
  spot: number;
  putWall: number;
  callWall: number;
  gammaFlip: number;
  samples: { strike: number; netGex: number }[];
}): string {
  const s = m.samples;
  return `${m.symbol}|${m.spot}|${m.putWall}|${m.callWall}|${m.gammaFlip}|${s.length}|${s[0]?.strike}|${s[s.length - 1]?.strike}|${s[0]?.netGex}|${s[Math.floor(s.length / 2)]?.netGex}`;
}
