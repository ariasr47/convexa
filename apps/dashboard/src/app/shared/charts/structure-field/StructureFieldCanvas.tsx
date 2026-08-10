/**
 * Structure Field — Canvas2D dual-clock instrument for dealer net-GEX.
 *
 * Structure layer paints to an offscreen buffer only when samples/levels change.
 * Every rAF frame: blit structure → dynamic field (warped lines, particles, flip well)
 * → tape mid + trail → 60Hz probe. React only receives a small hover readout string.
 *
 * Used by the ticker GEX strike profile and the /lab comparison page.
 * Theme literals match tokens.ts. Honors prefers-reduced-motion.
 */
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useEffect, useRef, useState } from 'react';
import type { FieldSample, StructureFieldModel } from './types';

const INK = '#0B0F17';
const PANEL = '#131A24';
const PHOSPHOR = '#E9E4D6';
const STEEL = '#8A9BB4';
const AMBER = '#F2A93B';
const SIGNAL = '#5E8BC4';
const GREEN = '#2ecc71';
const RED = '#ff5c5c';
const RAISED = '#1B2432';
const BURNT = '#E07A3F';

export interface StructureFieldCanvasProps {
  model: StructureFieldModel;
  height?: number;
  className?: string;
  /**
   * `ticker` — embed in Widget (no title strip / tape pill; frame owns honesty copy).
   * `lab` — full instrument chrome (default).
   */
  variant?: 'lab' | 'ticker';
}

interface Particle {
  /** 0..1 along strike span */
  u: number;
  /** 0 = on curve, 1 = at zero line */
  v: number;
  speed: number;
  sign: 1 | -1;
  size: number;
  life: number;
}

interface MidSample {
  mid: number;
  t: number;
}

function fmtM(v: number): string {
  const a = Math.abs(v);
  const s = v < 0 ? '-' : '';
  if (a >= 1e9) return `${s}${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}${(a / 1e3).toFixed(0)}K`;
  return `${s}${a.toFixed(0)}`;
}

function relAge(asOfSec: number | null, nowMs: number): string {
  if (asOfSec == null) return 'demo as-of';
  const s = Math.max(0, Math.floor(nowMs / 1000 - asOfSec));
  if (s < 60) return `Structure as-of ${s}s ago`;
  if (s < 3600) return `Structure as-of ${Math.floor(s / 60)}m ago`;
  return `Structure as-of ${Math.floor(s / 3600)}h ago`;
}

function probeLabel(best: FieldSample): string {
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
function strokeSmooth(
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

function roundRect(
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

function gexAt(samples: StructureFieldModel['samples'], strike: number): number {
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

export function StructureFieldCanvas({
  model,
  height = 480,
  className,
  variant = 'lab',
}: StructureFieldCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef(model);
  modelRef.current = model;
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const [hoverReadout, setHoverReadout] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;
  const embedded = variant === 'ticker';
  const pad = embedded
    ? { l: 48, r: 14, t: 28, b: 36 }
    : { l: 56, r: 20, t: 40, b: 48 };

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let raf = 0;
    let running = true;
    let lastT = performance.now();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Offscreen structure buffer (static between model changes)
    const off = document.createElement('canvas');
    const offCtx = off.getContext('2d');
    let structureDirty = true;
    let structureKey = '';

    // Dynamic sim state
    const particles: Particle[] = [];
    const midTrail: MidSample[] = [];
    let spawnAcc = 0;

    const layout = () => {
      const w = Math.max(320, wrap.clientWidth);
      const h = height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      off.width = canvas.width;
      off.height = canvas.height;
      if (offCtx) offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      structureDirty = true;
      return { w, h };
    };

    let { w, h } = layout();

    const makeKey = (m: StructureFieldModel) =>
      `${m.symbol}|${m.spot}|${m.putWall}|${m.callWall}|${m.gammaFlip}|${m.samples.length}|${m.samples[0]?.strike}|${m.samples[m.samples.length - 1]?.strike}|${m.samples[0]?.netGex}|${m.samples[Math.floor(m.samples.length / 2)]?.netGex}`;

    const paintStructure = (m: StructureFieldModel) => {
      if (!offCtx) return;
      const o = offCtx;
      const samples = m.samples;
      const plotW = w - pad.l - pad.r;
      const plotH = h - pad.t - pad.b;
      const minK = samples[0].strike;
      const maxK = samples[samples.length - 1].strike;
      let maxAbs = 1;
      for (const s of samples) maxAbs = Math.max(maxAbs, Math.abs(s.netGex));

      const xOf = (k: number) => pad.l + ((k - minK) / (maxK - minK || 1)) * plotW;
      const yOf = (g: number) => pad.t + plotH / 2 - (g / maxAbs) * (plotH * 0.42);
      const y0 = yOf(0);

      const pts = samples.map((s) => ({ x: xOf(s.strike), y: yOf(s.netGex) }));

      o.fillStyle = INK;
      o.fillRect(0, 0, w, h);

      // Deep vignette
      const vg = o.createRadialGradient(w * 0.5, h * 0.42, 20, w * 0.5, h * 0.48, Math.max(w, h) * 0.72);
      vg.addColorStop(0, PANEL);
      vg.addColorStop(0.55, '#101722');
      vg.addColorStop(1, INK);
      o.fillStyle = vg;
      o.fillRect(pad.l, pad.t, plotW, plotH);

      // Soft wall heat blooms (structure pressure)
      const bloom = (k: number, color: string, radius: number) => {
        const x = xOf(k);
        const g = o.createRadialGradient(x, y0, 4, x, y0, radius);
        g.addColorStop(0, color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        o.fillStyle = g;
        o.fillRect(x - radius, pad.t, radius * 2, plotH);
      };
      bloom(m.putWall, 'rgba(255,92,92,0.18)', plotW * 0.14);
      bloom(m.callWall, 'rgba(46,204,113,0.16)', plotW * 0.14);
      bloom(m.gammaFlip, 'rgba(242,169,59,0.12)', plotW * 0.1);

      // Strike heat columns — |GEX| intensity (structure density)
      const colW = Math.max(2, plotW / samples.length);
      for (const s of samples) {
        const x = xOf(s.strike);
        const intensity = Math.min(1, Math.abs(s.netGex) / maxAbs);
        const top = s.netGex >= 0 ? yOf(s.netGex) : y0;
        const bot = s.netGex >= 0 ? y0 : yOf(s.netGex);
        const colH = Math.max(1, bot - top);
        const grad = o.createLinearGradient(0, top, 0, bot);
        if (s.netGex >= 0) {
          grad.addColorStop(0, `rgba(46,204,113,${0.06 + intensity * 0.28})`);
          grad.addColorStop(1, 'rgba(46,204,113,0.02)');
        } else {
          grad.addColorStop(0, 'rgba(255,92,92,0.02)');
          grad.addColorStop(1, `rgba(255,92,92,${0.06 + intensity * 0.28})`);
        }
        o.fillStyle = grad;
        o.fillRect(x - colW * 0.45, top, colW * 0.9, colH);
      }

      // Quiet horizontal guides
      o.strokeStyle = 'rgba(138,155,180,0.1)';
      o.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = pad.t + (plotH * i) / 4;
        o.beginPath();
        o.moveTo(pad.l, y);
        o.lineTo(pad.l + plotW, y);
        o.stroke();
      }

      // Zero line
      o.strokeStyle = 'rgba(138,155,180,0.4)';
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
      fill.addColorStop(0, 'rgba(46,204,113,0.28)');
      fill.addColorStop(0.48, 'rgba(19,26,36,0.04)');
      fill.addColorStop(0.52, 'rgba(19,26,36,0.04)');
      fill.addColorStop(1, 'rgba(255,92,92,0.28)');
      o.fillStyle = fill;
      o.fill();

      // Curve glow + core
      o.save();
      o.shadowColor = 'rgba(94,139,196,0.65)';
      o.shadowBlur = 18;
      o.strokeStyle = SIGNAL;
      o.lineWidth = 2.6;
      o.lineJoin = 'round';
      strokeSmooth(o, pts);
      o.stroke();
      o.restore();
      o.strokeStyle = 'rgba(233,228,214,0.55)';
      o.lineWidth = 1;
      strokeSmooth(o, pts);
      o.stroke();

      // Level lines
      const level = (k: number, color: string, label: string, width = 1.5, yLabel = 14) => {
        const x = xOf(k);
        if (x < pad.l || x > pad.l + plotW) return;
        o.strokeStyle = color;
        o.lineWidth = width;
        o.globalAlpha = 0.88;
        o.beginPath();
        o.moveTo(x, pad.t);
        o.lineTo(x, pad.t + plotH);
        o.stroke();
        o.globalAlpha = 1;
        o.fillStyle = color;
        o.font = '600 11px "IBM Plex Sans", system-ui, sans-serif';
        o.fillText(label, Math.min(x + 6, pad.l + plotW - 78), pad.t + yLabel);
      };

      level(m.putWall, RED, `put $${m.putWall.toFixed(0)}`, 1.6, 14);
      level(m.callWall, GREEN, `call $${m.callWall.toFixed(0)}`, 1.6, 14);
      level(m.spot, STEEL, `spot $${m.spot.toFixed(1)}`, 1, 42);

      // Flip — structural amber (static core; breath is dynamic)
      {
        const x = xOf(m.gammaFlip);
        o.save();
        o.shadowColor = 'rgba(242,169,59,0.8)';
        o.shadowBlur = 20;
        o.strokeStyle = AMBER;
        o.lineWidth = 2.75;
        o.beginPath();
        o.moveTo(x, pad.t);
        o.lineTo(x, pad.t + plotH);
        o.stroke();
        o.restore();
        o.fillStyle = AMBER;
        o.font = '700 11px "IBM Plex Sans", system-ui, sans-serif';
        o.fillText('flip', Math.min(x + 6, pad.l + plotW - 40), pad.t + 28);
      }

      // Axis labels (structure)
      o.fillStyle = STEEL;
      o.font = '500 11px "IBM Plex Sans", system-ui, sans-serif';
      o.fillText(`$${minK.toFixed(0)}`, pad.l, h - 16);
      o.fillText(`$${maxK.toFixed(0)}`, pad.l + plotW - 40, h - 16);
      o.fillText('+ dealer γ', pad.l + 4, pad.t + 14);
      o.fillText('− dealer γ', pad.l + 4, pad.t + plotH - 8);
    };

    const paint = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      const m = modelRef.current;
      const samples = m.samples;
      const reduce = reducedRef.current;

      if (samples.length < 2) {
        ctx.fillStyle = INK;
        ctx.fillRect(0, 0, w, h);
        raf = requestAnimationFrame(paint);
        return;
      }

      const key = makeKey(m);
      if (key !== structureKey) {
        structureKey = key;
        structureDirty = true;
        particles.length = 0;
      }
      if (structureDirty && offCtx) {
        paintStructure(m);
        structureDirty = false;
      }

      // Blit structure
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(off, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const plotW = w - pad.l - pad.r;
      const plotH = h - pad.t - pad.b;
      const minK = samples[0].strike;
      const maxK = samples[samples.length - 1].strike;
      let maxAbs = 1;
      for (const s of samples) maxAbs = Math.max(maxAbs, Math.abs(s.netGex));
      const xOf = (k: number) => pad.l + ((k - minK) / (maxK - minK || 1)) * plotW;
      const yOf = (g: number) => pad.t + plotH / 2 - (g / maxAbs) * (plotH * 0.42);
      const y0 = yOf(0);
      const strikeOf = (u: number) => minK + u * (maxK - minK);

      // --- Dynamic: flip gravity well breath ---
      {
        const x = xOf(m.gammaFlip);
        const breath = reduce ? 0.35 : 0.28 + 0.22 * Math.sin(now / 900);
        const band = plotW * 0.045;
        const well = ctx.createLinearGradient(x - band, 0, x + band, 0);
        well.addColorStop(0, 'rgba(242,169,59,0)');
        well.addColorStop(0.5, `rgba(242,169,59,${breath * 0.22})`);
        well.addColorStop(1, 'rgba(242,169,59,0)');
        ctx.fillStyle = well;
        ctx.fillRect(x - band, pad.t, band * 2, plotH);

        // Soft scan sweep across plot (structure "alive" without lying about gamma)
        if (!reduce) {
          const sweep = ((now / 12) % (plotW + 80)) - 40;
          const sg = ctx.createLinearGradient(pad.l + sweep - 30, 0, pad.l + sweep + 30, 0);
          sg.addColorStop(0, 'rgba(233,228,214,0)');
          sg.addColorStop(0.5, 'rgba(233,228,214,0.035)');
          sg.addColorStop(1, 'rgba(233,228,214,0)');
          ctx.fillStyle = sg;
          ctx.fillRect(pad.l, pad.t, plotW, plotH);
        }
      }

      // --- Dynamic: warped field lines (force field) ---
      {
        const lines = 7;
        for (let li = 0; li < lines; li++) {
          const baseY = pad.t + ((li + 0.5) / lines) * plotH;
          const amp = (0.55 + 0.45 * Math.sin(now / 1400 + li)) * (reduce ? 0.35 : 1);
          ctx.beginPath();
          const steps = 48;
          for (let si = 0; si <= steps; si++) {
            const u = si / steps;
            const k = strikeOf(u);
            const g = gexAt(samples, k);
            const bend = (g / maxAbs) * plotH * 0.12 * amp;
            const x = pad.l + u * plotW;
            const y = baseY - bend;
            if (si === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          const midG = gexAt(samples, strikeOf(0.5));
          const a = 0.04 + 0.06 * Math.abs(midG) / maxAbs;
          ctx.strokeStyle =
            midG >= 0 ? `rgba(46,204,113,${a})` : `rgba(255,92,92,${a})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // --- Particles: gamma pressure flowing toward zero (hedging metaphor) ---
      if (!reduce) {
        spawnAcc += dt * 28;
        while (spawnAcc >= 1 && particles.length < 90) {
          spawnAcc -= 1;
          // Bias spawn to high-|GEX| strikes
          let u = Math.random();
          let bestU = u;
          let bestAbs = 0;
          for (let t = 0; t < 4; t++) {
            const uu = Math.random();
            const ga = Math.abs(gexAt(samples, strikeOf(uu)));
            if (ga > bestAbs) {
              bestAbs = ga;
              bestU = uu;
            }
          }
          u = bestU;
          const g = gexAt(samples, strikeOf(u));
          if (Math.abs(g) < maxAbs * 0.08) continue;
          particles.push({
            u,
            v: 0.02 + Math.random() * 0.12,
            speed: 0.18 + Math.random() * 0.45 * (Math.abs(g) / maxAbs),
            sign: g >= 0 ? 1 : -1,
            size: 1.2 + Math.random() * 1.8,
            life: 0.7 + Math.random() * 0.9,
          });
        }

        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.v += p.speed * dt;
          p.life -= dt * 0.35;
          // slight drift toward flip (field attractor)
          const flipU = (m.gammaFlip - minK) / (maxK - minK || 1);
          p.u += (flipU - p.u) * 0.04 * dt;
          if (p.v >= 1 || p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
          const k = strikeOf(p.u);
          const g = gexAt(samples, k);
          const yCurve = yOf(g);
          const x = xOf(k);
          const y = yCurve + (y0 - yCurve) * p.v;
          const alpha = Math.max(0, Math.min(1, p.life)) * (1 - p.v * 0.55);
          ctx.fillStyle =
            p.sign > 0 ? `rgba(46,204,113,${0.15 + alpha * 0.65})` : `rgba(255,92,92,${0.15 + alpha * 0.65})`;
          ctx.beginPath();
          ctx.arc(x, y, p.size * (1 - p.v * 0.4), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // --- Tape: mid trail + live pulse ---
      if (m.liveMid != null && Number.isFinite(m.liveMid)) {
        if (!reduce && m.live) {
          const last = midTrail[midTrail.length - 1];
          if (!last || Math.abs(last.mid - m.liveMid) > 0.002 || now - last.t > 80) {
            midTrail.push({ mid: m.liveMid, t: now });
            while (midTrail.length > 48) midTrail.shift();
          }
          // prune old
          while (midTrail.length && now - midTrail[0].t > 2200) midTrail.shift();

          for (let i = 0; i < midTrail.length; i++) {
            const s = midTrail[i];
            const age = (now - s.t) / 2200;
            const a = (1 - age) * 0.35;
            if (a <= 0.02) continue;
            const x = xOf(s.mid);
            ctx.fillStyle = `rgba(94,139,196,${a})`;
            ctx.beginPath();
            ctx.arc(x, y0, 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (!m.live) {
          midTrail.length = 0;
        }

        const x = xOf(m.liveMid);
        const pulse = m.live && !reduce ? 0.55 + 0.45 * Math.sin(now / 320) : 0.35;

        // Vertical beam
        ctx.save();
        const beam = ctx.createLinearGradient(x, pad.t, x, pad.t + plotH);
        beam.addColorStop(0, 'rgba(94,139,196,0)');
        beam.addColorStop(0.5, `rgba(94,139,196,${0.12 + pulse * 0.18})`);
        beam.addColorStop(1, 'rgba(94,139,196,0)');
        ctx.fillStyle = beam;
        ctx.fillRect(x - 6, pad.t, 12, plotH);

        ctx.strokeStyle = SIGNAL;
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
        ctx.shadowColor = 'rgba(94,139,196,0.9)';
        ctx.shadowBlur = 14 + pulse * 10;
        ctx.fillStyle = SIGNAL;
        ctx.beginPath();
        ctx.arc(x, y0, 3.8 + pulse * 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = `rgba(233,228,214,${0.35 + pulse * 0.4})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y0, 8 + pulse * 4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = PHOSPHOR;
        ctx.font = '600 11px "IBM Plex Sans", system-ui, sans-serif';
        ctx.fillText(
          m.live ? `live $${m.liveMid.toFixed(2)}` : `mid $${m.liveMid.toFixed(2)}`,
          Math.min(x + 8, pad.l + plotW - 88),
          pad.t + plotH - 10,
        );
        ctx.restore();
      }

      // --- Hover probe (60Hz local) ---
      const hover = hoverRef.current;
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
        const hx = xOf(best.strike);
        const hy = yOf(best.netGex);
        const intensity = Math.min(1, Math.abs(best.netGex) / maxAbs);

        // Soft magnet disk
        const mg = ctx.createRadialGradient(hx, hy, 2, hx, hy, 36 + intensity * 20);
        mg.addColorStop(0, best.netGex >= 0 ? 'rgba(46,204,113,0.22)' : 'rgba(255,92,92,0.22)');
        mg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.arc(hx, hy, 40 + intensity * 18, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(233,228,214,0.28)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hx, pad.t);
        ctx.lineTo(hx, pad.t + plotH);
        ctx.moveTo(pad.l, hy);
        ctx.lineTo(pad.l + plotW, hy);
        ctx.stroke();

        ctx.fillStyle = PHOSPHOR;
        ctx.shadowColor = 'rgba(233,228,214,0.5)';
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
        ctx.fillStyle = 'rgba(27,36,50,0.9)';
        roundRect(ctx, bx, by, barW, barH, 2);
        ctx.fill();
        ctx.fillStyle = best.netGex >= 0 ? GREEN : RED;
        roundRect(ctx, bx, by, barW * intensity, barH, 2);
        ctx.fill();

        const label = probeLabel(best);
        ctx.font = '600 12px "IBM Plex Mono", ui-monospace, monospace';
        const tw = ctx.measureText(label).width + 16;
        const rx = Math.min(Math.max(hx - tw / 2, pad.l), pad.l + plotW - tw);
        const ry = Math.max(pad.t + 8, hy - 34);
        ctx.fillStyle = RAISED;
        ctx.strokeStyle = 'rgba(138,155,180,0.4)';
        roundRect(ctx, rx, ry, tw, 22, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = PHOSPHOR;
        ctx.fillText(label, rx + 8, ry + 15);
      }

      // Title strip + tape pill — lab chrome only (ticker Widget owns honesty copy).
      if (!embedded) {
        ctx.fillStyle = PHOSPHOR;
        ctx.font = '700 13px "IBM Plex Sans", system-ui, sans-serif';
        ctx.fillText(`${m.symbol} · dealer field`, pad.l, 22);
        ctx.fillStyle = STEEL;
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
        ctx.font = '700 10px "IBM Plex Sans", system-ui, sans-serif';
        const pw = ctx.measureText(pill).width + 14;
        ctx.fillStyle = m.live ? 'rgba(94,139,196,0.28)' : 'rgba(224,122,63,0.22)';
        roundRect(ctx, w - pad.r - pw - 8, 8, pw, 18, 9);
        ctx.fill();
        ctx.fillStyle = m.live ? SIGNAL : BURNT;
        ctx.fillText(pill, w - pad.r - pw + 0, 21);
      }

      // Soft phosphor grain (static-ish via time hash — very subtle terminal feel)
      if (!reduce) {
        ctx.globalAlpha = 0.03;
        for (let i = 0; i < 18; i++) {
          const gx = pad.l + ((Math.sin(now * 0.001 + i * 12.1) * 0.5 + 0.5) * plotW);
          const gy = pad.t + ((Math.cos(now * 0.0007 + i * 7.3) * 0.5 + 0.5) * plotH);
          ctx.fillStyle = PHOSPHOR;
          ctx.fillRect(gx, gy, 1.2, 1.2);
        }
        ctx.globalAlpha = 1;
      }

      raf = requestAnimationFrame(paint);
    };

    const onResize = () => {
      ({ w, h } = layout());
    };
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      hoverRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const m = modelRef.current;
      if (m.samples.length < 2) return;
      const minK = m.samples[0].strike;
      const maxK = m.samples[m.samples.length - 1].strike;
      const plotW = w - pad.l - pad.r;
      const kx = minK + ((hoverRef.current.x - pad.l) / plotW) * (maxK - minK);
      let best = m.samples[0];
      let bestD = Infinity;
      for (const s of m.samples) {
        const d = Math.abs(s.strike - kx);
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
      setHoverReadout(probeLabel(best));
    };
    const onLeave = () => {
      hoverRef.current = null;
      setHoverReadout(null);
    };

    window.addEventListener('resize', onResize);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(paint);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
    };
  }, [
    height,
    variant,
    embedded,
    model.samples,
    model.spot,
    model.callWall,
    model.putWall,
    model.gammaFlip,
    model.symbol,
  ]);

  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  return (
    <div ref={wrapRef} className={className} style={{ width: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        data-testid="structure-field-canvas"
        style={{
          display: 'block',
          width: '100%',
          height,
          borderRadius: 12,
          border: '1px solid rgba(138,155,180,0.28)',
          boxShadow: '0 0 0 1px rgba(11,15,23,0.6), 0 18px 48px -24px rgba(0,0,0,0.65)',
          cursor: 'crosshair',
          touchAction: 'none',
        }}
      />
      {hoverReadout && (
        <div
          style={{
            position: 'absolute',
            right: 12,
            bottom: 12,
            fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
            fontSize: 12,
            color: PHOSPHOR,
            background: RAISED,
            border: '1px solid rgba(138,155,180,0.3)',
            borderRadius: 8,
            padding: '6px 10px',
            pointerEvents: 'none',
          }}
        >
          {hoverReadout}
        </div>
      )}
    </div>
  );
}

export default StructureFieldCanvas;
