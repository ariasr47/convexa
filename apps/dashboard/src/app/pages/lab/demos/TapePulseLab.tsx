/**
 * Tape Pulse — candidate for Live tape / Command Deck mid visualization.
 * Dual-clock: structure mid baseline (slow) vs streaming mid + last-print flashes.
 */
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useEffect, useRef, useState } from 'react';
import { LabShell } from '../LabShell';
import { DEMO_LEVELS } from '../structureFieldDemo';
import { LAB } from './labTokens';

export function TapePulseLab() {
  const reduced = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [titleSet, setTitleSet] = useState(false);

  useEffect(() => {
    document.title = 'Tape Pulse · Lab — Convexa';
    setTitleSet(true);
    return () => {
      document.title = 'Convexa';
    };
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let running = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const height = 220;
    const trail: { t: number; mid: number }[] = [];
    const prints: { t: number; px: number; dir: 1 | -1 }[] = [];
    let lastPrintT = 0;
    const base: number = DEMO_LEVELS.spot;

    const layout = () => {
      const w = Math.max(320, wrap.clientWidth);
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
      const t = now / 1000;
      // Synthetic tape mid
      const mid =
        base +
        Math.sin(t * 0.9) * 0.55 +
        Math.sin(t * 2.3) * 0.12 +
        (Math.sin(t * 0.07) > 0.92 ? Math.sin(t * 11) * 0.4 : 0);

      trail.push({ t: now, mid });
      while (trail.length > 120) trail.shift();
      while (trail.length && now - trail[0].t > 4000) trail.shift();

      // Occasional last-print flash
      if (!reduced && now - lastPrintT > 400 + Math.random() * 900) {
        lastPrintT = now;
        const dir: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
        prints.push({ t: now, px: mid, dir });
      }
      while (prints.length && now - prints[0].t > 900) prints.shift();

      const pad = { l: 48, r: 16, t: 36, b: 36 };
      const plotW = w - pad.l - pad.r;
      const plotH = height - pad.t - pad.b;
      const mids = trail.map((p) => p.mid);
      const lo = Math.min(...mids, base - 1.5);
      const hi = Math.max(...mids, base + 1.5);
      const yOf = (m: number) => pad.t + plotH * (1 - (m - lo) / (hi - lo || 1));
      const xOf = (i: number, n: number) => pad.l + (i / Math.max(1, n - 1)) * plotW;

      ctx.fillStyle = LAB.ink;
      ctx.fillRect(0, 0, w, height);
      const vg = ctx.createLinearGradient(0, 0, 0, height);
      vg.addColorStop(0, LAB.panel);
      vg.addColorStop(1, LAB.ink);
      ctx.fillStyle = vg;
      ctx.fillRect(pad.l, pad.t, plotW, plotH);

      // Structure baseline (slow clock — fixed "as-of mid")
      const yBase = yOf(base);
      ctx.strokeStyle = 'rgba(138,155,180,0.45)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pad.l, yBase);
      ctx.lineTo(pad.l + plotW, yBase);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = LAB.steel;
      ctx.font = '600 11px "IBM Plex Sans", system-ui, sans-serif';
      ctx.fillText(`structure mid $${base.toFixed(2)}`, pad.l + 6, yBase - 6);

      // Mid trail
      if (trail.length > 1) {
        ctx.beginPath();
        trail.forEach((p, i) => {
          const x = xOf(i, trail.length);
          const y = yOf(p.mid);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = LAB.signal;
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(94,139,196,0.5)';
        ctx.shadowBlur = reduced ? 0 : 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Live bead
      const last = trail[trail.length - 1];
      if (last) {
        const x = xOf(trail.length - 1, trail.length);
        const y = yOf(last.mid);
        const pulse = reduced ? 0.4 : 0.5 + 0.5 * Math.sin(now / 280);
        ctx.fillStyle = LAB.signal;
        ctx.beginPath();
        ctx.arc(x, y, 3.5 + pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = LAB.phosphor;
        ctx.font = '600 12px "IBM Plex Mono", ui-monospace, monospace';
        ctx.fillText(`live $${last.mid.toFixed(2)}`, Math.min(x + 8, pad.l + plotW - 100), y - 8);
      }

      // Print flashes
      for (const p of prints) {
        const age = (now - p.t) / 900;
        const a = 1 - age;
        const y = yOf(p.px);
        ctx.fillStyle =
          p.dir > 0 ? `rgba(46,204,113,${0.15 + a * 0.5})` : `rgba(255,92,92,${0.15 + a * 0.5})`;
        ctx.fillRect(pad.l, y - 1, plotW, 2);
        ctx.fillStyle = LAB.phosphor;
        ctx.globalAlpha = a;
        ctx.font = '600 11px "IBM Plex Sans", system-ui, sans-serif';
        ctx.fillText(p.dir > 0 ? '↑ print' : '↓ print', pad.l + plotW - 56, y - 4);
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = LAB.phosphor;
      ctx.font = '700 13px "IBM Plex Sans", system-ui, sans-serif';
      ctx.fillText('TAPE PULSE · dual-clock strip', pad.l, 22);
      ctx.fillStyle = LAB.steel;
      ctx.font = '500 11px "IBM Plex Sans", system-ui, sans-serif';
      ctx.fillText('structure baseline  ·  live mid trail  ·  print flashes', pad.l + 220, 22);

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
  }, [reduced, titleSet]);

  return (
    <LabShell
      title="Tape Pulse"
      tagline="Streaming mid trail with last-print flashes over a fixed structure mid. Shows how tape can stay honest next to REST levels without redrawing the whole board."
      tickerCandidate="Live tape tiles · Command Deck mid bead"
      testId="lab-tape-pulse"
    >
      <div ref={wrapRef} style={{ width: '100%' }}>
        <canvas
          ref={canvasRef}
          data-testid="tape-pulse-canvas"
          style={{
            display: 'block',
            width: '100%',
            borderRadius: '12px',
            border: '1px solid rgba(138,155,180,0.28)',
          }}
        />
      </div>
    </LabShell>
  );
}

export default TapePulseLab;
