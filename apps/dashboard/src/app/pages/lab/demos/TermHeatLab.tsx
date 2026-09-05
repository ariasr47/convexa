/**
 * Term Heat — candidate for Term structure card.
 * Cross-tenor IV as a heat ribbon with contango/backwardation read.
 */
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useEffect, useRef } from 'react';
import { LabShell } from '../LabShell';
import { LAB } from './labTokens';

const TENORS = [7, 14, 30, 60, 90];

export function TermHeatLab() {
  const reduced = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    document.title = 'Term Heat · Lab — Convexa';
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
    const height = 260;

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
      // Contango base with mild oscillation; occasional backwardation tilt
      const tilt = Math.sin(t * 0.15) * 0.35;
      const ivs = TENORS.map((dte, i) => {
        const base = 0.18 + i * 0.012 + tilt * (i / TENORS.length);
        const wave = reduced ? 0 : Math.sin(t * 0.8 + i * 0.7) * 0.008;
        return Math.max(0.08, base + wave);
      });
      const slope = ivs[ivs.length - 1] - ivs[0];
      const regime = slope > 0.015 ? 'contango' : slope < -0.01 ? 'backwardation' : 'flat';

      const pad = { l: 52, r: 20, t: 44, b: 40 };
      const plotW = w - pad.l - pad.r;
      const plotH = height - pad.t - pad.b;
      const minIv = Math.min(...ivs) - 0.02;
      const maxIv = Math.max(...ivs) + 0.02;
      const xOf = (i: number) => pad.l + (i / (TENORS.length - 1)) * plotW;
      const yOf = (iv: number) => pad.t + plotH * (1 - (iv - minIv) / (maxIv - minIv || 1));

      ctx.fillStyle = LAB.ink;
      ctx.fillRect(0, 0, w, height);
      ctx.fillStyle = LAB.panel;
      ctx.fillRect(pad.l, pad.t, plotW, plotH);

      // Heat under ribbon
      ctx.beginPath();
      ctx.moveTo(xOf(0), pad.t + plotH);
      ivs.forEach((iv, i) => ctx.lineTo(xOf(i), yOf(iv)));
      ctx.lineTo(xOf(ivs.length - 1), pad.t + plotH);
      ctx.closePath();
      const heat = ctx.createLinearGradient(0, pad.t, 0, pad.t + plotH);
      if (regime === 'backwardation') {
        heat.addColorStop(0, 'rgba(255,92,92,0.35)');
        heat.addColorStop(1, 'rgba(255,92,92,0.02)');
      } else {
        heat.addColorStop(0, 'rgba(46,204,113,0.28)');
        heat.addColorStop(1, 'rgba(94,139,196,0.05)');
      }
      ctx.fillStyle = heat;
      ctx.fill();

      // Ribbon
      ctx.beginPath();
      ivs.forEach((iv, i) => {
        const x = xOf(i);
        const y = yOf(iv);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = regime === 'backwardation' ? LAB.red : LAB.green;
      ctx.lineWidth = 2.5;
      ctx.shadowColor =
        regime === 'backwardation' ? 'rgba(255,92,92,0.5)' : 'rgba(46,204,113,0.45)';
      ctx.shadowBlur = reduced ? 0 : 12;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Nodes
      ivs.forEach((iv, i) => {
        const x = xOf(i);
        const y = yOf(iv);
        ctx.fillStyle = LAB.phosphor;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = LAB.steel;
        ctx.font = '600 11px "IBM Plex Sans", system-ui, sans-serif';
        ctx.fillText(`${TENORS[i]}d`, x - 10, pad.t + plotH + 18);
        ctx.fillStyle = LAB.phosphor;
        ctx.font = '600 11px "IBM Plex Mono", ui-monospace, monospace';
        ctx.fillText(`${(iv * 100).toFixed(1)}%`, x - 14, y - 10);
      });

      ctx.fillStyle = LAB.phosphor;
      ctx.font = '700 13px "IBM Plex Sans", system-ui, sans-serif';
      ctx.fillText('TERM HEAT · vol term structure', pad.l, 22);
      ctx.fillStyle =
        regime === 'backwardation' ? LAB.red : regime === 'contango' ? LAB.green : LAB.steel;
      ctx.font = '700 11px "IBM Plex Sans", system-ui, sans-serif';
      ctx.fillText(regime.toUpperCase(), pad.l + 250, 22);
      ctx.fillStyle = LAB.steel;
      ctx.font = '500 11px "IBM Plex Sans", system-ui, sans-serif';
      ctx.fillText('synthetic ATM IV by tenor  ·  snapshot clock', pad.l + 340, 22);

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
      title="Term Heat"
      tagline="Cross-tenor IV as a heat ribbon: contango glows green, backwardation red. Candidate upgrade for the term-structure line chart — more terminal, still snapshot-honest."
      tickerCandidate="Term structure card"
      testId="lab-term-heat"
    >
      <div ref={wrapRef} style={{ width: '100%' }}>
        <canvas
          ref={canvasRef}
          data-testid="term-heat-canvas"
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

export default TermHeatLab;
