/**
 * Term Heat chart — structure-clock ATM IV by tenor (replaces Recharts line in term card).
 */
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useEffect, useRef } from 'react';

const INK = '#0B0F17';
const PANEL = '#131A24';
const PHOSPHOR = '#E9E4D6';
const STEEL = '#8A9BB4';
const GREEN = '#2ecc71';
const RED = '#ff5c5c';
const SIGNAL = '#5E8BC4';

export function TermHeatChart({
  points,
  state,
  height = 168,
}: {
  points: { dte: number; expiration: string; atm_iv: number }[];
  state: 'contango' | 'backwardation' | 'flat' | string;
  height?: number;
}) {
  const reduced = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas || points.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let running = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const layout = () => {
      const w = Math.max(200, wrap.clientWidth);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return w;
    };
    let w = layout();

    const paint = (now: number) => {
      if (!running) return;
      const pad = { l: 36, r: 12, t: 16, b: 28 };
      const plotW = w - pad.l - pad.r;
      const plotH = height - pad.t - pad.b;
      const ivs = points.map((p) => p.atm_iv);
      const minIv = Math.min(...ivs) - 1;
      const maxIv = Math.max(...ivs) + 1;
      const xOf = (i: number) => pad.l + (i / (points.length - 1)) * plotW;
      const yOf = (iv: number) => pad.t + plotH * (1 - (iv - minIv) / (maxIv - minIv || 1));
      const warm = !reduced ? 0.04 * Math.sin(now / 900) : 0;

      ctx.fillStyle = INK;
      ctx.fillRect(0, 0, w, height);
      ctx.fillStyle = PANEL;
      ctx.fillRect(pad.l, pad.t, plotW, plotH);

      ctx.beginPath();
      ctx.moveTo(xOf(0), pad.t + plotH);
      points.forEach((p, i) => ctx.lineTo(xOf(i), yOf(p.atm_iv)));
      ctx.lineTo(xOf(points.length - 1), pad.t + plotH);
      ctx.closePath();
      const heat = ctx.createLinearGradient(0, pad.t, 0, pad.t + plotH);
      if (state === 'backwardation') {
        heat.addColorStop(0, `rgba(255,92,92,${0.32 + warm})`);
        heat.addColorStop(1, 'rgba(255,92,92,0.02)');
      } else {
        heat.addColorStop(0, `rgba(46,204,113,${0.26 + warm})`);
        heat.addColorStop(1, 'rgba(94,139,196,0.04)');
      }
      ctx.fillStyle = heat;
      ctx.fill();

      ctx.beginPath();
      points.forEach((p, i) => {
        const x = xOf(i);
        const y = yOf(p.atm_iv);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = state === 'backwardation' ? RED : state === 'contango' ? GREEN : SIGNAL;
      ctx.lineWidth = 2;
      ctx.stroke();

      points.forEach((p, i) => {
        const x = xOf(i);
        const y = yOf(p.atm_iv);
        ctx.fillStyle = PHOSPHOR;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = STEEL;
        ctx.font = '500 10px "IBM Plex Sans", system-ui, sans-serif';
        ctx.fillText(`${p.dte}d`, x - 8, pad.t + plotH + 16);
        ctx.fillStyle = PHOSPHOR;
        ctx.font = '600 10px "IBM Plex Mono", ui-monospace, monospace';
        ctx.fillText(`${p.atm_iv.toFixed(1)}%`, x - 12, y - 8);
      });

      raf = requestAnimationFrame(paint);
    };

    const onResize = () => {
      w = layout();
    };
    window.addEventListener('resize', onResize);
    raf = requestAnimationFrame(paint);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [points, state, height, reduced]);

  return (
    <div
      ref={wrapRef}
      data-testid="term-heat-chart"
      style={{ width: '100%', flex: 1, minHeight: height }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height }} />
    </div>
  );
}
