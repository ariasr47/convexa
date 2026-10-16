/**
 * The extracted pure paint steps for the Structure Field (SPEC §2.1, §7 "how the motion rule
 * actually bites", PLAN FE-4).
 *
 * WHY THIS FILE EXISTS. `StructureFieldCanvas.tsx` used to hold a ~460-line rAF closure with
 * cross-frame mutable state (`particles`, `midTrail`, `spawnAcc`, `lastT`) and two paint routines
 * (`paintStructure` → an OFFSCREEN buffer, `paint` → the visible frame) buried inside a single
 * `useEffect`. Neither routine was reachable from a test: `single-motion-moment.spec.ts:54-55`
 * matches only LITERAL `@keyframes <name>` text, so a Canvas2D rAF loop declares nothing that scan
 * can see. `paintStructureStep` and `paintFrameStep` below are that same logic, made PURE (they take
 * every input as an argument, mutate only the `ctx` and the `frame` object handed to them, and read
 * no closure state) so `paintStep.spec.ts` can drive both into a recording fake 2D context
 * (`recordingContext.ts`) and prove criterion 20 directly: level strokes always paint, the ambient
 * motions (trail, drift, well, sweep) stop on `live: false` and stop or freeze under reduced motion.
 *
 * TWO STEPS, NOT ONE. `paintStructureStep` paints the levels/walls/flip/heat/vignette into whatever
 * `ctx` it is given — in production that is the OFFSCREEN buffer, run only when the structure key
 * changes (`StructureFieldCanvas.tsx`'s own dirty check, which stays in the host: the extraction
 * does not change WHEN it runs, only what it is). `paintFrameStep` paints everything that changes
 * every rAF tick — sweep, drift, particles, the tape mid trail/beam/bead, the hover probe, and (in
 * lab chrome) the title strip and phosphor grain. A recorder wired to the frame path ALONE would see
 * zero level strokes at any liveness, which is exactly why criterion 20 needs both.
 *
 * THE THREE LIVE GATES (criterion 20). Today's tree gates the sweep and the particle field on
 * `!reduce` alone, and the warped field-line drift on nothing but `reduce`'s damping factor — none
 * of the three stop on a genuine stream drop. Only the tape trail's own population/clear
 * (`:601`/`:621` in the pre-extraction file) and its pulse ternary (`:626`) already read `m.live`.
 * Below:
 *   - sweep + the flip-well breath (both are gradient fills — SPEC §7's recorder groups them as one
 *     "sweep gradient fills" bucket) run only while `!reduced && m.live`;
 *   - particles run only while `!reduced && m.live`;
 *   - drift is SKIPPED ENTIRELY when `!m.live` (criterion 20's "drift ... stop" on a drop), and
 *     renders a STATIC frame (a fixed, non-time-varying amplitude) when `reduced` — this is what
 *     makes it satisfy BOTH criterion 20 (stops on a drop) and criterion 22 (a static frame under
 *     reduced motion, `review`), rather than the two rows contradicting each other.
 * The tape mid's bead/ring/dashed line/label are DELIBERATELY left alone: they are the persistent
 * "last known mid position" marker (F6, session-tape/replay renders it at full strength, no pulse),
 * not an ambient liveness animation, and criterion 20's automated check does not name them — only
 * trail points, particle `arc()` calls, sweep gradient fills, and non-zero level strokes are
 * machine-checked (SPEC row 20's own "against a recording 2D context" clause). The `pulse` value
 * already collapses to a fixed 0.35 whenever `!m.live || reduced`, which is what gives the beam its
 * row-22 "static frame" reading without a dedicated gate.
 */
import type { LevelPalette } from './levelStrokes';
import { withAlpha } from './levelStrokes';
import type { MarkerLayoutBox } from './markerLayout';
import { layoutMarkerLabels } from './markerLayout';
import type { FieldSample, StructureFieldModel } from './types';

/** Round strike-axis step chosen so 5–8 ticks fit the window (repair task item 4). */
const STRIKE_AXIS_STEPS = [1, 2.5, 5, 10, 25] as const;

export function chooseStrikeStep(range: number): number {
  for (const step of STRIKE_AXIS_STEPS) {
    if (range / step <= 8) return step;
  }
  return STRIKE_AXIS_STEPS[STRIKE_AXIS_STEPS.length - 1];
}

export interface StructureFieldSurfaces {
  ink: string;
  panel: string;
  raised: string;
  phosphor: string;
  steel: string;
  /** The tenth former module literal (`BURNT`, the lab-chrome "TAPE OFF" pill) — mode-aware via
   *  `theme.palette.warning.main`. Not part of SPEC §2.7's illustrative 5-key snippet; added because
   *  leaving it out would leave one scheme-invariant hex literal in the file (criterion 53). */
  warning: string;
}

export interface Particle {
  /** 0..1 along strike span */
  u: number;
  /** 0 = on curve, 1 = at zero line */
  v: number;
  speed: number;
  sign: 1 | -1;
  size: number;
  life: number;
}

export interface MidSample {
  mid: number;
  t: number;
}

export interface Pad {
  l: number;
  r: number;
  t: number;
  b: number;
}

/** Everything derived from `(model.samples, pad, w, h, calm, embedded)` — recomputed per call, same
 *  as the pre-extraction code recomputed it fresh in both `paintStructure` and `paint`. Cheap, and
 *  keeping it that way means a model update is picked up immediately with no separate cache to bust. */
export interface Geometry {
  w: number;
  h: number;
  pad: Pad;
  plotW: number;
  plotH: number;
  minK: number;
  maxK: number;
  maxAbs: number;
  y0: number;
  calm: boolean;
  embedded: boolean;
}

/** The frame-state object replacing the closure's cross-frame mutable variables (PLAN FE-4). */
export interface FrameState {
  particles: Particle[];
  midTrail: MidSample[];
  spawnAcc: number;
  lastT: number;
  /** The most recent structure-step marker layout, so the frame step's tape label can avoid the
   *  same collisions the structure step already solved for put/call/flip/spot. Refreshed only when
   *  the structure step re-runs (host's own dirty check), not every frame. */
  markerBoxes: MarkerLayoutBox[];
}

export function emptyFrameState(): FrameState {
  return { particles: [], midTrail: [], spawnAcc: 0, lastT: 0, markerBoxes: [] };
}

/** Requires `model.samples.length >= 2` — callers guard this the same way the pre-extraction code
 *  did (`StructureFieldCanvas.tsx`'s own `samples.length < 2` early return). */
export function computeGeometry(
  model: StructureFieldModel,
  pad: Pad,
  w: number,
  h: number,
  calm: boolean,
  embedded: boolean,
): Geometry {
  const samples = model.samples;
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  const minK = samples[0].strike;
  const maxK = samples[samples.length - 1].strike;
  let maxAbs = 1;
  for (const s of samples) maxAbs = Math.max(maxAbs, Math.abs(s.netGex));
  const y0 = pad.t + plotH / 2; // yOf(0) — the (g / maxAbs) term is zero at g = 0
  return { w, h, pad, plotW, plotH, minK, maxK, maxAbs, y0, calm, embedded };
}

export function xOf(geom: Geometry, k: number): number {
  return geom.pad.l + ((k - geom.minK) / (geom.maxK - geom.minK || 1)) * geom.plotW;
}

export function yOf(geom: Geometry, g: number): number {
  return geom.pad.t + geom.plotH / 2 - (g / geom.maxAbs) * (geom.plotH * 0.42);
}

export function strikeOf(geom: Geometry, u: number): number {
  return geom.minK + u * (geom.maxK - geom.minK);
}

/**
 * The warped field-line drift's per-line amplitude — pulled out as its own pure function so
 * criterion 22's automatable half (`paintStep.spec.ts`) can prove "static frame under reduced
 * motion" directly (the same value at two different `now`s) rather than through the recording
 * context, whose `strokeStyle` bucket for drift does not depend on `amp` at all (only the PATH shape
 * does) and so cannot see this distinction.
 */
export function driftAmplitude(li: number, now: number, reduced: boolean, calm: boolean): number {
  if (reduced) return 0.55 * 0.35; // static — no time dependency, so it never appears to move
  return (0.55 + 0.45 * Math.sin(now / 1400 + li)) * (calm ? 0.55 : 1);
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

export function probeLabel(best: FieldSample): string {
  let label = `$${best.strike.toFixed(0)}  ·  net GEX ${fmtM(best.netGex)}`;
  if (best.netDex != null && Number.isFinite(best.netDex)) {
    label += `  ·  DEX ${fmtM(best.netDex)}`;
  }
  if (best.volOi != null && Number.isFinite(best.volOi)) {
    label += `  ·  Vol/OI ${best.volOi.toFixed(2)}×`;
  }
  return label;
}

/** Monotone cubic-ish polyline via Catmull-Rom samples (looks fluid, stays honest to data). */
export function strokeSmooth(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  closed = false,
) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  if (pts.length === 2) {
    ctx.lineTo(pts[1].x, pts[1].y);
    if (closed) ctx.closePath();
    return;
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
  if (closed) ctx.closePath();
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function gexAt(samples: StructureFieldModel['samples'], strike: number): number {
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

/**
 * P-11: a level's gamma sign in words, so the sign never rides on hue alone. Read from the field
 * itself at the level's strike, so the word can never disagree with the bars under it. A zero or
 * non-finite value carries no sign (no claim beats a wrong one).
 */
export function gammaSignWord(netGex: number): '+γ' | '−γ' | null {
  if (!Number.isFinite(netGex) || netGex === 0) return null;
  return netGex > 0 ? '+γ' : '−γ';
}

/** A wall's marker label: `call wall 580 · +γ` / `put wall 560 · −γ` (the Final boards' wording). */
export function wallLabel(
  kind: 'call' | 'put',
  strike: number,
  samples: StructureFieldModel['samples'],
): string {
  const base = `${kind} wall ${strike.toFixed(0)}`;
  const sign = gammaSignWord(gexAt(samples, strike));
  return sign ? `${base} · ${sign}` : base;
}

/**
 * PAINT STEP 1 — the structure layer (levels, walls, flip, heat, vignette). Byte-identical to the
 * pre-extraction `paintStructure` body; only the inputs changed shape (props/geom instead of a
 * closure). Callers run this only when the structure key changes and draw it into an OFFSCREEN
 * buffer that the frame step later blits — see the module doc for why this must be a separate step
 * from `paintFrameStep` for criterion 20 to be provable at all. Returns the marker label boxes so
 * the frame step's tape label can avoid the same collisions.
 */
export function paintStructureStep(
  m: StructureFieldModel,
  ctx: CanvasRenderingContext2D,
  geom: Geometry,
  palette: LevelPalette,
  surfaces: StructureFieldSurfaces,
): MarkerLayoutBox[] {
  const o = ctx;
  const { pad, plotW, plotH, minK, maxK, y0, calm } = geom;
  const samples = m.samples;

  const pts = samples.map((s) => ({ x: xOf(geom, s.strike), y: yOf(geom, s.netGex) }));

  o.fillStyle = surfaces.ink;
  o.fillRect(0, 0, geom.w, geom.h);

  // Deep vignette
  const vg = o.createRadialGradient(
    geom.w * 0.5,
    geom.h * 0.42,
    20,
    geom.w * 0.5,
    geom.h * 0.48,
    Math.max(geom.w, geom.h) * 0.72,
  );
  vg.addColorStop(0, surfaces.panel);
  vg.addColorStop(0.55, withAlpha(surfaces.panel, 0.6));
  vg.addColorStop(1, surfaces.ink);
  o.fillStyle = vg;
  o.fillRect(pad.l, pad.t, plotW, plotH);

  // Soft wall heat blooms (structure pressure)
  const bloom = (k: number, color: string, radius: number) => {
    const x = xOf(geom, k);
    const g = o.createRadialGradient(x, y0, 4, x, y0, radius);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    o.fillStyle = g;
    o.fillRect(x - radius, pad.t, radius * 2, plotH);
  };
  bloom(m.putWall, withAlpha(palette.putWall, 0.18), plotW * 0.14);
  bloom(m.callWall, withAlpha(palette.callWall, 0.16), plotW * 0.14);
  // No bloom at the flip: it is neutral now (the text colour), and a halo of ink reads as a smudge
  // on the light canvas. The flip carries its weight in the line itself (D-08).

  // Strike heat columns — |GEX| intensity (structure density)
  const colW = Math.max(2, plotW / samples.length);
  for (const s of samples) {
    const x = xOf(geom, s.strike);
    const intensity = Math.min(1, Math.abs(s.netGex) / geom.maxAbs);
    const top = s.netGex >= 0 ? yOf(geom, s.netGex) : y0;
    const bot = s.netGex >= 0 ? y0 : yOf(geom, s.netGex);
    const colH = Math.max(1, bot - top);
    const grad = o.createLinearGradient(0, top, 0, bot);
    if (s.netGex >= 0) {
      grad.addColorStop(0, withAlpha(palette.callWall, 0.06 + intensity * 0.28));
      grad.addColorStop(1, withAlpha(palette.callWall, 0.02));
    } else {
      grad.addColorStop(0, withAlpha(palette.putWall, 0.02));
      grad.addColorStop(1, withAlpha(palette.putWall, 0.06 + intensity * 0.28));
    }
    o.fillStyle = grad;
    o.fillRect(x - colW * 0.45, top, colW * 0.9, colH);
  }

  // Quiet horizontal guides
  o.strokeStyle = withAlpha(surfaces.steel, 0.1);
  o.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (plotH * i) / 4;
    o.beginPath();
    o.moveTo(pad.l, y);
    o.lineTo(pad.l + plotW, y);
    o.stroke();
  }

  // Zero line
  o.strokeStyle = withAlpha(surfaces.steel, 0.4);
  o.setLineDash([5, 5]);
  o.beginPath();
  o.moveTo(pad.l, y0);
  o.lineTo(pad.l + plotW, y0);
  o.stroke();
  o.setLineDash([]);

  // Area fill under smooth curve
  o.beginPath();
  o.moveTo(pts[0].x, y0);
  o.lineTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    o.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
  o.lineTo(pts[pts.length - 1].x, y0);
  o.closePath();
  const fill = o.createLinearGradient(0, pad.t, 0, pad.t + plotH);
  fill.addColorStop(0, withAlpha(palette.callWall, 0.28));
  fill.addColorStop(0.48, withAlpha(surfaces.panel, 0.04));
  fill.addColorStop(0.52, withAlpha(surfaces.panel, 0.04));
  fill.addColorStop(1, withAlpha(palette.putWall, 0.28));
  o.fillStyle = fill;
  o.fill();

  // Curve glow + core
  o.save();
  o.shadowColor = withAlpha(palette.mid, 0.65);
  o.shadowBlur = calm ? 8 : 18;
  o.strokeStyle = palette.mid;
  o.lineWidth = calm ? 2 : 2.6;
  o.lineJoin = 'round';
  strokeSmooth(o, pts);
  o.stroke();
  o.restore();
  o.strokeStyle = withAlpha(surfaces.phosphor, 0.55);
  o.lineWidth = 1;
  strokeSmooth(o, pts);
  o.stroke();

  // Level lines
  const level = (k: number, color: string, width = 1.5) => {
    const x = xOf(geom, k);
    if (x < pad.l || x > pad.l + plotW) return;
    o.strokeStyle = color;
    o.lineWidth = width;
    o.globalAlpha = 0.88;
    o.beginPath();
    o.moveTo(x, pad.t);
    o.lineTo(x, pad.t + plotH);
    o.stroke();
    o.globalAlpha = 1;
  };

  level(m.putWall, palette.putWall, 1.6);
  level(m.callWall, palette.callWall, 1.6);
  level(m.spot, surfaces.steel, 1);

  // Flip — neutral: phosphor in dark, ink in light (`palette.gammaFlip` resolves to `text.primary`),
  // never amber (P-15, ruling A). No glow: a halo of the text colour reads as a smudge in light mode,
  // and the weight already sets the flip apart from the thin steel spot line.
  {
    const x = xOf(geom, m.gammaFlip);
    o.strokeStyle = palette.gammaFlip;
    o.lineWidth = calm ? 2 : 2.75;
    o.beginPath();
    o.moveTo(x, pad.t);
    o.lineTo(x, pad.t + plotH);
    o.stroke();
  }

  // Max pain — dashed, steel (repair task item 5). Data-presence gated (a missing max pain drops
  // the line, never a synthetic zero), NOT liveness-gated — it paints in every `m.live` standing,
  // same as put/call/flip above, so the census above still holds.
  const hasMaxPain = m.maxPain != null && Number.isFinite(m.maxPain);
  if (hasMaxPain) {
    const x = xOf(geom, m.maxPain as number);
    if (x >= pad.l && x <= pad.l + plotW) {
      o.strokeStyle = palette.maxPain;
      o.lineWidth = 1;
      o.globalAlpha = 0.88;
      o.setLineDash([3, 3]);
      o.beginPath();
      o.moveTo(x, pad.t);
      o.lineTo(x, pad.t + plotH);
      o.stroke();
      o.setLineDash([]);
      o.globalAlpha = 1;
    }
  }

  // Measure and place every marker label ABOVE the plot, Mono 10 600, in the level's own colour
  // (repair task item 4) — collisions resolved by the existing lane solver so clustered levels
  // never cover one another. The bare `spot` label is REMOVED: the spot line stays, thin steel,
  // unlabelled (it is the ladder anchor, not a second price) — the tape/mid pill below is the one
  // price label on the field.
  o.font = '600 11px "IBM Plex Mono", ui-monospace, monospace';
  const markerDefs = [
    {
      id: 'put',
      x: xOf(geom, m.putWall),
      label: wallLabel('put', m.putWall, samples),
      color: palette.putWall,
      preferredLane: 0,
    },
    {
      id: 'call',
      x: xOf(geom, m.callWall),
      label: wallLabel('call', m.callWall, samples),
      color: palette.callWall,
      preferredLane: 0,
    },
    {
      id: 'flip',
      x: xOf(geom, m.gammaFlip),
      label: `flip ${m.gammaFlip.toFixed(2)}`,
      color: palette.gammaFlip,
      preferredLane: 1,
    },
    ...(hasMaxPain
      ? [
          {
            id: 'maxPain',
            x: xOf(geom, m.maxPain as number),
            label: `max pain ${(m.maxPain as number).toFixed(0)}`,
            color: palette.maxPain,
            preferredLane: 1,
          },
        ]
      : []),
  ].filter((marker) => Number.isFinite(marker.x) && marker.x >= pad.l && marker.x <= pad.l + plotW);
  const markerBoxes = layoutMarkerLabels({
    bounds: { left: pad.l, right: pad.l + plotW, top: pad.t + 2, bottom: pad.t + plotH - 2 },
    markers: markerDefs,
    measure: (label) => o.measureText(label).width,
    laneHeight: 14,
    laneGap: 2,
    reserved: [
      // The three left-edge y-axis value labels (`+$…M` / `0` / `−$…M`) — marker labels must never
      // be placed over any of them.
      { x: pad.l, y: pad.t, width: 56, height: 14 },
      { x: pad.l, y: y0 - 8, width: 40, height: 14 },
      { x: pad.l, y: pad.t + plotH - 18, width: 56, height: 14 },
    ],
  });
  o.font = '600 11px "IBM Plex Mono", ui-monospace, monospace';
  for (const marker of markerBoxes) {
    // Each label sits on its own knock-out plate, so a level line that runs under it (the flip
    // through the put wall's label, say) never strikes the text through (site check D-08).
    o.fillStyle = withAlpha(surfaces.ink, 0.88);
    roundRect(o, marker.x + 3, marker.y, marker.width - 6, marker.height, 3);
    o.fill();
    o.fillStyle = marker.color ?? surfaces.phosphor;
    o.fillText(marker.label, marker.x + 8, marker.y + 11);
  }

  // Axis (repair task item 4): strike ticks at a round step along the bottom, `±$<max>M` and `0` on
  // the left — both Mono 10 steel. Replaces the old two-corner `$min`/`$max` + `± dealer γ` labels.
  o.fillStyle = surfaces.steel;
  o.font = '500 11px "IBM Plex Mono", ui-monospace, monospace';
  const strikeStep = chooseStrikeStep(maxK - minK);
  const firstTick = Math.ceil(minK / strikeStep) * strikeStep;
  const tickDecimals = Number.isInteger(strikeStep) ? 0 : 1;
  const axisY = Math.min(geom.h - 6, pad.t + plotH + 18);
  for (let k = firstTick; k <= maxK + 1e-9; k += strikeStep) {
    const x = xOf(geom, k);
    if (x < pad.l || x > pad.l + plotW) continue;
    const label = k.toFixed(tickDecimals);
    const w = o.measureText(label).width;
    o.fillText(label, x - w / 2, axisY);
  }
  o.fillText(`+$${fmtM(geom.maxAbs)}`, pad.l, pad.t + 10);
  o.fillText('0', pad.l, y0 + 3);
  o.fillText(`−$${fmtM(geom.maxAbs)}`, pad.l, pad.t + plotH - 4);

  return markerBoxes;
}

/**
 * PAINT STEP 2 — everything that changes every rAF tick: the flip-well breath + sweep, the warped
 * field-line drift, particles, the tape mid trail/beam/bead/label, the hover probe and (lab chrome
 * only) the title strip + phosphor grain. See the module doc for the three live gates this task adds
 * (sweep, particles, drift) and why the tape bead/beam/label are deliberately left alone.
 *
 * `hover` is the pointer position in canvas-local pixels, or `null`/omitted when nothing is hovered.
 */
export function paintFrameStep(
  m: StructureFieldModel,
  ctx: CanvasRenderingContext2D,
  geom: Geometry,
  frame: FrameState,
  now: number,
  reduced: boolean,
  palette: LevelPalette,
  surfaces: StructureFieldSurfaces,
  hover: { x: number; y: number } | null = null,
): void {
  const { pad, plotW, plotH, minK, maxK, maxAbs, y0, calm, embedded, w } = geom;
  const samples = m.samples;

  // --- Dynamic: flip gravity well breath + scan sweep (CRITERION 20 — both are gradient fills that
  // must stop on a drop; neither has a row-22 "static frame" requirement, so both are fully gated). ---
  if (!reduced && m.live) {
    const x = xOf(geom, m.gammaFlip);
    const breath = calm ? 0.22 + 0.1 * Math.sin(now / 1100) : 0.28 + 0.22 * Math.sin(now / 900);
    const band = plotW * 0.045;
    const well = ctx.createLinearGradient(x - band, 0, x + band, 0);
    well.addColorStop(0, withAlpha(palette.gammaFlip, 0));
    well.addColorStop(0.5, withAlpha(palette.gammaFlip, breath * 0.22));
    well.addColorStop(1, withAlpha(palette.gammaFlip, 0));
    ctx.fillStyle = well;
    ctx.fillRect(x - band, pad.t, band * 2, plotH);

    // Soft scan sweep across plot (structure "alive" without lying about gamma)
    const sweep = ((now / 12) % (plotW + 80)) - 40;
    const sg = ctx.createLinearGradient(pad.l + sweep - 30, 0, pad.l + sweep + 30, 0);
    sg.addColorStop(0, withAlpha(surfaces.phosphor, 0));
    sg.addColorStop(0.5, withAlpha(surfaces.phosphor, 0.035));
    sg.addColorStop(1, withAlpha(surfaces.phosphor, 0));
    ctx.fillStyle = sg;
    ctx.fillRect(pad.l, pad.t, plotW, plotH);
  }

  // --- Dynamic: warped field lines (force field) — CRITERION 20/22: skipped entirely off the live
  // stream (stops on a drop), a STATIC (non-time-varying) frame under reduced motion, animated
  // otherwise. This is the one motion that must render SOMETHING under reduce, so it cannot share
  // the sweep/particles' bare `!reduced` gate. ---
  if (m.live) {
    const lines = calm ? 5 : 7;
    const strikeOfG = (u: number) => strikeOf(geom, u);
    for (let li = 0; li < lines; li++) {
      const baseY = pad.t + ((li + 0.5) / lines) * plotH;
      const amp = driftAmplitude(li, now, reduced, calm);
      ctx.beginPath();
      const steps = 48;
      for (let si = 0; si <= steps; si++) {
        const u = si / steps;
        const k = strikeOfG(u);
        const g = gexAt(samples, k);
        const bend = (g / maxAbs) * plotH * 0.12 * amp;
        const x = pad.l + u * plotW;
        const y = baseY - bend;
        if (si === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const midG = gexAt(samples, strikeOfG(0.5));
      const a = 0.04 + (0.06 * Math.abs(midG)) / maxAbs;
      ctx.strokeStyle = midG >= 0 ? withAlpha(palette.callWall, a) : withAlpha(palette.putWall, a);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // --- Particles: gamma pressure flowing toward zero (hedging metaphor). CRITERION 20: stops on a
  // drop, same bare gate as sweep (no static-frame requirement for particles either). ---
  if (!reduced && m.live) {
    frame.spawnAcc += Math.min(0.05, (now - frame.lastT) / 1000) * (calm ? 10 : 28);
    const maxP = calm ? 36 : 90;
    while (frame.spawnAcc >= 1 && frame.particles.length < maxP) {
      frame.spawnAcc -= 1;
      // Bias spawn to high-|GEX| strikes
      let u = Math.random();
      let bestU = u;
      let bestAbs = 0;
      for (let t = 0; t < 4; t++) {
        const uu = Math.random();
        const ga = Math.abs(gexAt(samples, strikeOf(geom, uu)));
        if (ga > bestAbs) {
          bestAbs = ga;
          bestU = uu;
        }
      }
      u = bestU;
      const g = gexAt(samples, strikeOf(geom, u));
      if (Math.abs(g) < maxAbs * 0.08) continue;
      frame.particles.push({
        u,
        v: 0.02 + Math.random() * 0.12,
        speed: 0.18 + Math.random() * 0.45 * (Math.abs(g) / maxAbs),
        sign: g >= 0 ? 1 : -1,
        size: 1.2 + Math.random() * 1.8,
        life: 0.7 + Math.random() * 0.9,
      });
    }

    const dt = Math.min(0.05, (now - frame.lastT) / 1000);
    for (let i = frame.particles.length - 1; i >= 0; i--) {
      const p = frame.particles[i];
      p.v += p.speed * dt;
      p.life -= dt * 0.35;
      // slight drift toward flip (field attractor)
      const flipU = (m.gammaFlip - minK) / (maxK - minK || 1);
      p.u += (flipU - p.u) * 0.04 * dt;
      if (p.v >= 1 || p.life <= 0) {
        frame.particles.splice(i, 1);
        continue;
      }
      const k = strikeOf(geom, p.u);
      const g = gexAt(samples, k);
      const yCurve = yOf(geom, g);
      const x = xOf(geom, k);
      const y = yCurve + (y0 - yCurve) * p.v;
      const particleAlpha = Math.max(0, Math.min(1, p.life)) * (1 - p.v * 0.55);
      ctx.fillStyle =
        p.sign > 0
          ? withAlpha(palette.callWall, 0.15 + particleAlpha * 0.65)
          : withAlpha(palette.putWall, 0.15 + particleAlpha * 0.65);
      ctx.beginPath();
      ctx.arc(x, y, p.size * (1 - p.v * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- Tape: mid trail + live pulse. Trail population/clear already reads `m.live` (unchanged by
  // this task); the bead/ring/beam/label are the persistent last-known-mid marker (F6) and are
  // deliberately NOT gated on `m.live` — see the module doc. ---
  if (m.liveMid != null && Number.isFinite(m.liveMid)) {
    if (!reduced && m.live) {
      const last = frame.midTrail[frame.midTrail.length - 1];
      if (!last || Math.abs(last.mid - m.liveMid) > 0.002 || now - last.t > 80) {
        frame.midTrail.push({ mid: m.liveMid, t: now });
        while (frame.midTrail.length > 48) frame.midTrail.shift();
      }
      // prune old
      while (frame.midTrail.length && now - frame.midTrail[0].t > 2200) frame.midTrail.shift();

      for (let i = 0; i < frame.midTrail.length; i++) {
        const s = frame.midTrail[i];
        const age = (now - s.t) / 2200;
        const a = (1 - age) * 0.35;
        if (a <= 0.02) continue;
        const x = xOf(geom, s.mid);
        ctx.fillStyle = withAlpha(palette.mid, a);
        ctx.beginPath();
        ctx.arc(x, y0, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (!m.live) {
      frame.midTrail.length = 0;
    }

    const x = xOf(geom, m.liveMid);
    const pulse = m.live && !reduced ? 0.55 + 0.45 * Math.sin(now / 320) : 0.35;

    // Vertical beam
    ctx.save();
    const beam = ctx.createLinearGradient(x, pad.t, x, pad.t + plotH);
    beam.addColorStop(0, withAlpha(palette.mid, 0));
    beam.addColorStop(0.5, withAlpha(palette.mid, 0.12 + pulse * 0.18));
    beam.addColorStop(1, withAlpha(palette.mid, 0));
    ctx.fillStyle = beam;
    ctx.fillRect(x - 6, pad.t, 12, plotH);

    ctx.strokeStyle = palette.mid;
    ctx.globalAlpha = 0.4 + pulse * 0.5;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, pad.t + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Bead + outer ring
    ctx.globalAlpha = 1;
    ctx.shadowColor = withAlpha(palette.mid, 0.9);
    ctx.shadowBlur = 14 + pulse * 10;
    ctx.fillStyle = palette.mid;
    ctx.beginPath();
    ctx.arc(x, y0, 3.8 + pulse * 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = withAlpha(surfaces.phosphor, 0.35 + pulse * 0.4);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y0, 8 + pulse * 4, 0, Math.PI * 2);
    ctx.stroke();

    // ONE pill on the zero line (repair task item 4) — `● mid X` while live, `○ mid X` while
    // retained/offline (the SAME `m.live` branch the label already used), panel fill + a signal
    // (mid) stroke. Fixed at the zero line beside the mid's own vertical line, never lane-stacked
    // with the level markers above the plot — this is the field's ONE price label.
    ctx.font = '600 11px "IBM Plex Mono", ui-monospace, monospace';
    const pillLabel = `${m.live ? '●' : '○'} mid ${m.liveMid.toFixed(2)}`;
    const textW = ctx.measureText(pillLabel).width;
    const boxW = textW + 16;
    const boxH = 18;
    let boxX = x + 8;
    if (boxX + boxW > pad.l + plotW) boxX = x - 8 - boxW;
    boxX = Math.max(pad.l, Math.min(boxX, pad.l + plotW - boxW));
    const boxY = y0 - boxH / 2;
    ctx.fillStyle = surfaces.panel;
    ctx.strokeStyle = withAlpha(palette.mid, 0.6);
    ctx.lineWidth = 1;
    roundRect(ctx, boxX, boxY, boxW, boxH, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = palette.mid;
    ctx.fillText(pillLabel, boxX + 8, boxY + 13);
    ctx.restore();
  }

  // --- Hover probe (60Hz local) ---
  if (hover) {
    const kx = minK + ((hover.x - pad.l) / plotW) * (maxK - minK);
    let best = samples[0];
    let bestD = Infinity;
    for (const s of samples) {
      const d = Math.abs(s.strike - kx);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    const hx = xOf(geom, best.strike);
    const hy = yOf(geom, best.netGex);
    const intensity = Math.min(1, Math.abs(best.netGex) / maxAbs);

    // Soft magnet disk
    const mg = ctx.createRadialGradient(hx, hy, 2, hx, hy, 36 + intensity * 20);
    mg.addColorStop(
      0,
      best.netGex >= 0 ? withAlpha(palette.callWall, 0.22) : withAlpha(palette.putWall, 0.22),
    );
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(hx, hy, 40 + intensity * 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = withAlpha(surfaces.phosphor, 0.28);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hx, pad.t);
    ctx.lineTo(hx, pad.t + plotH);
    ctx.moveTo(pad.l, hy);
    ctx.lineTo(pad.l + plotW, hy);
    ctx.stroke();

    ctx.fillStyle = surfaces.phosphor;
    ctx.shadowColor = withAlpha(surfaces.phosphor, 0.5);
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(hx, hy, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Field strength bar
    const barW = 52;
    const barH = 4;
    const bx = Math.min(Math.max(hx - barW / 2, pad.l), pad.l + plotW - barW);
    const by = Math.min(hy + 14, pad.t + plotH - 8);
    ctx.fillStyle = withAlpha(surfaces.raised, 0.9);
    roundRect(ctx, bx, by, barW, barH, 2);
    ctx.fill();
    ctx.fillStyle = best.netGex >= 0 ? palette.callWall : palette.putWall;
    roundRect(ctx, bx, by, barW * intensity, barH, 2);
    ctx.fill();

    // The strike's figures are HTML text beside the canvas (StructureFieldCanvas's readout, TD-01),
    // not a canvas label: a drawn label clipped at the plot's edge on a phone and doubled the text.
  }

  // Title strip + tape pill — lab chrome only (ticker Widget owns honesty copy).
  if (!embedded) {
    ctx.fillStyle = surfaces.phosphor;
    ctx.font = '700 13px "IBM Plex Sans", system-ui, sans-serif';
    ctx.fillText(`${m.symbol} · dealer field`, pad.l, 22);
    ctx.fillStyle = surfaces.steel;
    ctx.font = '500 11px "IBM Plex Sans", system-ui, sans-serif';
    const age = relAge(m.asOfSec, now);
    const src =
      m.source === 'demo'
        ? 'synthetic demo'
        : m.source === 'rest'
          ? 'structure snap'
          : 'live structure snap';
    ctx.fillText(`${age}  ·  ${src}  ·  probe strikes`, pad.l + 168, 22);

    const pill = m.live ? 'TAPE LIVE' : 'TAPE OFF';
    ctx.font = '700 11px "IBM Plex Sans", system-ui, sans-serif';
    const pw = ctx.measureText(pill).width + 14;
    ctx.fillStyle = m.live ? withAlpha(palette.mid, 0.28) : withAlpha(surfaces.warning, 0.22);
    roundRect(ctx, w - pad.r - pw - 8, 8, pw, 18, 9);
    ctx.fill();
    ctx.fillStyle = m.live ? palette.mid : surfaces.warning;
    ctx.fillText(pill, w - pad.r - pw + 0, 21);
  }

  // Soft phosphor grain — lab only (ticker stays calmer)
  if (!reduced && !calm) {
    ctx.globalAlpha = 0.03;
    for (let i = 0; i < 18; i++) {
      const gx = pad.l + (Math.sin(now * 0.001 + i * 12.1) * 0.5 + 0.5) * plotW;
      const gy = pad.t + (Math.cos(now * 0.0007 + i * 7.3) * 0.5 + 0.5) * plotH;
      ctx.fillStyle = surfaces.phosphor;
      ctx.fillRect(gx, gy, 1.2, 1.2);
    }
    ctx.globalAlpha = 1;
  }

  frame.lastT = now;
}
