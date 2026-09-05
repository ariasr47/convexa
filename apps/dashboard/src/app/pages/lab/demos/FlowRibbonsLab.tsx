/**
 * Flow Ribbons — candidate for Dealer flow projection.
 * Charm / vanna limbs as layered streaming ribbons (display metaphor).
 */
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useEffect, useRef } from 'react';
import { LabShell } from '../LabShell';
import { LAB } from './labTokens';

export function FlowRibbonsLab() {
  const reduced = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    document.title = 'Flow Ribbons · Lab — Convexa';
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
    const height = 300;

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

    type Ribbon = {
      amp: number;
      freq: number;
      phase: number;
      color: string;
      label: string;
      y0: number;
    };
    const ribbons: Ribbon[] = [
      { amp: 28, freq: 1.1, phase: 0, color: LAB.signal, label: 'charm', y0: 0.35 },
      { amp: 22, freq: 0.75, phase: 1.2, color: LAB.amber, label: 'vanna', y0: 0.55 },
      { amp: 16, freq: 1.4, phase: 2.1, color: LAB.green, label: 'net flow', y0: 0.72 },
    ];

    const paint = (now: number) => {
      if (!running) return;
      const t = now / 1000;
      const pad = { l: 56, r: 20, t: 40, b: 36 };
      const plotW = w - pad.l - pad.r;
      const plotH = height - pad.t - pad.b;

      ctx.fillStyle = LAB.ink;
      ctx.fillRect(0, 0, w, height);
      ctx.fillStyle = LAB.panel;
      ctx.fillRect(pad.l, pad.t, plotW, plotH);

      // Zero line
      const y0 = pad.t + plotH * 0.5;
      ctx.strokeStyle = 'rgba(138,155,180,0.3)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pad.l, y0);
      ctx.lineTo(pad.l + plotW, y0);
      ctx.stroke();
      ctx.setLineDash([]);

      const steps = 64;
      for (const r of ribbons) {
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const u = i / steps;
          const x = pad.l + u * plotW;
          const scroll = reduced ? 0 : t * r.freq;
          const wave =
            Math.sin(u * Math.PI * 3 + r.phase + scroll) * r.amp +
            Math.sin(u * Math.PI * 7 + scroll * 1.3) * (r.amp * 0.25);
          const y = pad.t + r.y0 * plotH + (reduced ? wave * 0.3 : wave);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 2.25;
        ctx.globalAlpha = 0.85;
        ctx.shadowColor = r.color;
        ctx.shadowBlur = reduced ? 0 : 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        // Particles along ribbon
        if (!reduced) {
          for (let p = 0; p < 8; p++) {
            const u = (((t * 0.08 * r.freq + p / 8) % 1) + 1) % 1;
            const x = pad.l + u * plotW;
            const wave =
              Math.sin(u * Math.PI * 3 + r.phase + t * r.freq) * r.amp +
              Math.sin(u * Math.PI * 7 + t * r.freq * 1.3) * (r.amp * 0.25);
            const y = pad.t + r.y0 * plotH + wave;
            ctx.fillStyle = r.color;
            ctx.globalAlpha = 0.35 + 0.4 * Math.sin(t * 3 + p);
            ctx.beginPath();
            ctx.arc(x, y, 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }

        ctx.fillStyle = r.color;
        ctx.font = '600 11px "IBM Plex Sans", system-ui, sans-serif';
        ctx.fillText(r.label, pad.l + 6, pad.t + r.y0 * plotH - r.amp - 4);
      }

      ctx.fillStyle = LAB.phosphor;
      ctx.font = '700 13px "IBM Plex Sans", system-ui, sans-serif';
      ctx.fillText('FLOW RIBBONS · projected dealer flow', pad.l, 22);
      ctx.fillStyle = LAB.steel;
      ctx.font = '500 11px "IBM Plex Sans", system-ui, sans-serif';
      ctx.fillText(
        'charm / vanna / net  ·  structure snapshot metaphor  ·  not live ticks',
        pad.l + 280,
        22,
      );

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
  }, [reduced]);

  return (
    <LabShell
      title="Flow Ribbons"
      tagline="Charm, vanna, and net projected flow as layered streaming ribbons. Display metaphor for dealer-flow projection — structure-clock honest, not a live tape of hedging prints."
      tickerCandidate="Dealer flow projection widget"
      testId="lab-flow-ribbons"
    >
      <div ref={wrapRef} style={{ width: '100%' }}>
        <canvas
          ref={canvasRef}
          data-testid="flow-ribbons-canvas"
          style={{
            display: 'block',
            width: '100%',
            borderRadius: '12px', // style= prop (not sx=), already literal px — string form closes radius-scale.spec.ts's blind spot
            border: '1px solid rgba(138,155,180,0.28)',
          }}
        />
      </div>
    </LabShell>
  );
}

export default FlowRibbonsLab;
