/**
 * The landing hero's dealer-gamma surface (F1, canon P-15): the frozen model, the camera and the
 * static projection. Pure arithmetic, computed once at module load; no request, no DOM.
 *
 * Ported from the design source: `design/src/data/charts.mjs` (gexAt, GEX_STRIKES, GEX_TENORS),
 * `design/src/screens/final/shell-site-kit.mjs` (heroPoster: the static projection and its labels)
 * and `design/src/frontier/f1-gamma.js` (the WebGL view's grid, camera and fit). The values are
 * ILLUSTRATIVE — the model's shape, shaped like SPY dealer gamma — and every view of them is labelled
 * as a sample (P-3, P-15).
 *
 * Sign is carried by position (above or below the zero plane) and by the +γ / −γ labels, not by hue
 * alone (P-11). The flip contour is phosphor, not amber (P-15, amber spent).
 */

const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp;

/** design/src/data/charts.mjs gexAt, unchanged. */
function gexAt(k: number, d: number, spot = 573): number {
  const call = Math.exp(-(((k - 590) / (10 + d * 0.35)) ** 2)) * (1.2 / Math.sqrt(1 + d / 9));
  const put = Math.exp(-(((k - 555) / (9 + d * 0.3)) ** 2)) * (1.05 / Math.sqrt(1 + d / 10));
  const pin = Math.exp(-(((k - spot) / 4) ** 2)) * (0.35 / (1 + d / 3));
  return round(call - put + pin * 0.4, 3);
}

/** 33 strikes, 540 → 620. */
export const STRIKES: readonly number[] = Array.from({ length: 33 }, (_, i) => 540 + i * 2.5);
/** Days to expiry, spaced by √days on the depth axis. */
export const TENORS: readonly number[] = [1, 3, 7, 14, 21, 30, 45, 60, 90];
/** V[j][i]: net dealer gamma, $M per 1% move, at tenor j and strike i. */
export const V: readonly (readonly number[])[] = TENORS.map((d) =>
  STRIKES.map((k) => Number((gexAt(k, d) * 1.8).toFixed(3))),
);
export const VMAX = Math.max(...V.flat().map(Math.abs));
export const LEVELS = { put: 555, flip: 571, call: 590 } as const;
/** Height scale: the surface's tallest point is 0.45 world units. */
export const HSCALE = 0.45 / VMAX;

const SQ = TENORS.map(Math.sqrt);
const SQ0 = SQ[0];
const SQ1 = SQ[SQ.length - 1];
/** World x of a strike: −1 … 1. */
export const XS = (s: number) =>
  -1 + (2 * (s - STRIKES[0])) / (STRIKES[STRIKES.length - 1] - STRIKES[0]);
/** World z of a tenor: short tenors at the front (+0.7), long at the back (−0.7). */
export const ZT = (t: number) => 0.7 - (1.4 * (Math.sqrt(t) - SQ0)) / (SQ1 - SQ0);

export type Mat3 = [number, number, number, number, number, number, number, number, number];
/** Yaw about y, then pitch about x (row-major 3×3). */
export function rot(yaw: number, pitch: number): Mat3 {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return [cy, 0, sy, sp * sy, cp, -sp * cy, -cp * sy, sp, cp * cy];
}

/** The camera's home and its allowed range (the WebGL view fits every angle inside it). */
export const CAMERA = {
  yaw: -0.55,
  pitch: 0.52,
  yaw0: -0.62,
  yaw1: 0.62,
  pitch0: 0.25,
  pitch1: 0.8,
};

// ---- the static projection (the designed fallback) -----------------------------------------------
export const POSTER_W = 1000;
export const POSTER_H = 560;

const POSTER_R = rot(CAMERA.yaw, CAMERA.pitch);
const POSTER_K = (() => {
  // A static poster fits only its own angle (the WebGL view fits every angle it can turn to).
  let mu = 0;
  let mv = 0;
  const R = POSTER_R;
  for (const x of [-1, 1])
    for (const y of [-VMAX * HSCALE, VMAX * HSCALE])
      for (const z of [-0.7, 0.7]) {
        mu = Math.max(mu, Math.abs(R[0] * x + R[1] * y + R[2] * z));
        mv = Math.max(mv, Math.abs(R[3] * x + R[4] * y + R[5] * z));
      }
  return Math.min(((POSTER_W / 2) * 0.86) / mu, ((POSTER_H / 2) * 0.84) / mv);
})();

/** World → poster viewBox coordinates. */
export function posterPoint(x: number, y: number, z: number): [number, number] {
  const R = POSTER_R;
  return [
    POSTER_W / 2 + POSTER_K * (R[0] * x + R[1] * y + R[2] * z),
    POSTER_H / 2 - POSTER_K * (R[3] * x + R[4] * y + R[5] * z) + 0.04 * POSTER_H,
  ];
}
/** World → percentage of the stage, for HTML placed over the poster. */
export function posterPercent(x: number, y: number, z: number): { left: string; top: string } {
  const [px, py] = posterPoint(x, y, z);
  return {
    left: `${((px / POSTER_W) * 100).toFixed(2)}%`,
    top: `${((py / POSTER_H) * 100).toFixed(2)}%`,
  };
}

export type QuadSign = 'up' | 'down' | 'mid';
export interface PosterQuad {
  points: string;
  sign: QuadSign;
  opacity: number;
}

const pts = (p: [number, number][]) =>
  p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');

/** Painter's order (back to front), one quad per model cell. */
export const POSTER_QUADS: readonly PosterQuad[] = (() => {
  const R = POSTER_R;
  const depth = (x: number, y: number, z: number) => R[6] * x + R[7] * y + R[8] * z;
  const quads: (PosterQuad & { d: number })[] = [];
  for (let j = 0; j < TENORS.length - 1; j++)
    for (let i = 0; i < STRIKES.length - 1; i++) {
      const c = (
        [
          [i, j],
          [i + 1, j],
          [i + 1, j + 1],
          [i, j + 1],
        ] as const
      ).map(
        ([a, b]) => [XS(STRIKES[a]), V[b][a] * HSCALE, ZT(TENORS[b])] as [number, number, number],
      );
      const v = (V[j][i] + V[j][i + 1] + V[j + 1][i] + V[j + 1][i + 1]) / 4;
      const near = Math.abs(v) < 0.04 * VMAX;
      quads.push({
        points: pts(c.map((p) => posterPoint(...p))),
        d: c.reduce((s, p) => s + depth(...p), 0) / 4,
        sign: near ? 'mid' : v > 0 ? 'up' : 'down',
        opacity: near ? 1 : Number((0.3 + 0.62 * Math.min(1, Math.abs(v) / VMAX)).toFixed(2)),
      });
    }
  quads.sort((a, b) => a.d - b.d);
  return quads.map(({ points, sign, opacity }) => ({ points, sign, opacity }));
})();

/** The zero plane's outline. */
export const POSTER_PLANE = pts(
  (
    [
      [-1, 0, 0.7],
      [1, 0, 0.7],
      [1, 0, -0.7],
      [-1, 0, -0.7],
    ] as const
  ).map((p) => posterPoint(p[0], p[1], p[2])),
);

/** The flip contour on the zero plane: where dealers turn from short to long gamma. */
export const POSTER_FLIP: readonly [number, number, number, number][] = (() => {
  const out: [number, number, number, number][] = [];
  const cross = (jj: number) => {
    for (let i = 0; i < STRIKES.length - 1; i++) {
      const a = V[jj][i];
      const b = V[jj][i + 1];
      if (a < 0 !== b < 0 && STRIKES[i] > 560 && STRIKES[i] < 585) {
        const t = a / (a - b);
        return XS(STRIKES[i]) + t * (XS(STRIKES[i + 1]) - XS(STRIKES[i]));
      }
    }
    return null;
  };
  for (let j = 0; j < TENORS.length - 1; j++) {
    const x0 = cross(j);
    const x1 = cross(j + 1);
    if (x0 != null && x1 != null) {
      const [ax, ay] = posterPoint(x0, 0.004, ZT(TENORS[j]));
      const [bx, by] = posterPoint(x1, 0.004, ZT(TENORS[j + 1]));
      out.push([ax, ay, bx, by]);
    }
  }
  return out;
})();

// ---- labels on the surface -----------------------------------------------------------------------
export type LabelKind = 'tick' | 'axis' | 'level';
export interface SurfaceLabel {
  key: string;
  text: string;
  kind: LabelKind;
  /** Hidden when the stage is narrow (under 520px), so the rest stay clear of each other. */
  minor: boolean;
  /** Sits above its point by a fixed gap (the call wall, which marks the probe's home), so the probe dot
   *  never covers it at any width. */
  above?: boolean;
  /** Anchored by its right edge (the put wall), so on a narrow stage it grows away from the call wall label. */
  end?: boolean;
  world: [number, number, number];
}

const J7 = TENORS.indexOf(7);
const I_CALL = STRIKES.indexOf(LEVELS.call);

export const LABELS: readonly SurfaceLabel[] = [
  ...[540, 560, 580, 600, 620].map((s, n): SurfaceLabel => ({
    key: `k${s}`,
    text: String(s),
    kind: 'tick',
    minor: n % 2 === 1 || s === 580,
    world: [XS(s), 0, 0.8],
  })),
  ...[1, 7, 30, 90].map((t): SurfaceLabel => ({
    key: `t${t}`,
    text: `${t}d`,
    kind: 'tick',
    minor: t === 1,
    world: [1.1, 0, ZT(t)],
  })),
  { key: 'strike', text: 'Strike', kind: 'axis', minor: false, world: [0.35, 0, 1.0] },
  {
    key: 'call',
    text: `Call wall ${LEVELS.call} · +γ`,
    kind: 'level',
    minor: false,
    above: true,
    world: [XS(LEVELS.call), V[J7][I_CALL] * HSCALE, ZT(7)],
  },
  {
    key: 'put',
    text: `Put wall ${LEVELS.put} · −γ`,
    kind: 'level',
    minor: false,
    end: true,
    world: [XS(LEVELS.put) + 0.1, 0.22, ZT(30)],
  },
  {
    key: 'flip',
    text: `Flip ${LEVELS.flip}`,
    kind: 'level',
    minor: false,
    world: [XS(LEVELS.flip), 0.02, 1.12],
  },
];

// ---- the probe (keyboard and pointer share one grid index) ---------------------------------------
export interface Probe {
  i: number;
  j: number;
}
/** The call wall, a week out. */
export const PROBE_HOME: Probe = { i: I_CALL, j: J7 };

/** The probe's world point on the surface. */
export const probeWorld = (p: Probe): [number, number, number] => [
  XS(STRIKES[p.i]),
  V[p.j][p.i] * HSCALE,
  ZT(TENORS[p.j]),
];

const strikeText = (s: number) => (Number.isInteger(s) ? String(s) : s.toFixed(1));

/** “Strike 590 · 7 days · +$1.62M per 1% · dealers long gamma (moves tend to be damped)” */
export function readout(p: Probe): string {
  const v = V[p.j][p.i];
  const t = TENORS[p.j];
  const sign =
    v >= 0
      ? 'dealers long gamma (moves tend to be damped)'
      : 'dealers short gamma (moves tend to be amplified)';
  return `Strike ${strikeText(STRIKES[p.i])} · ${t} ${t === 1 ? 'day' : 'days'} · ${v >= 0 ? '+' : '−'}$${Math.abs(v).toFixed(2)}M per 1% · ${sign}`;
}

/** Arrow keys move the probe; null when the key isn't one. */
export function stepProbe(p: Probe, key: string): Probe | null {
  if (key === 'ArrowLeft') return { i: Math.max(0, p.i - 1), j: p.j };
  if (key === 'ArrowRight') return { i: Math.min(STRIKES.length - 1, p.i + 1), j: p.j };
  if (key === 'ArrowUp') return { i: p.i, j: Math.min(TENORS.length - 1, p.j + 1) };
  if (key === 'ArrowDown') return { i: p.i, j: Math.max(0, p.j - 1) };
  return null;
}
