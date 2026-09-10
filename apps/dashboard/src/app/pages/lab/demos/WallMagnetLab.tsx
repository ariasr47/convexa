/**
 * Wall Magnet — candidate for Dealer positioning levels visualization.
 * Spot as a mass attracted by put/call walls; flip as polarity.
 */
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useEffect, useRef } from 'react';
import { LabShell } from '../LabShell';
import { LAB } from './labTokens';

export function WallMagnetLab() {
  const reduced = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    document.title = 'Wall Magnet · Lab — Convexa';
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
    const height = 280;
    const put = 500;
    const call = 530;
    const flip = 508;
    let spot = 512.4;
    let vel = 0;

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
      const dt = 0.016;
      // Soft forces: walls repel from wrong side of flip; mild spring to mid-range
      if (!reduced) {
        const toPut = put - spot;
        const toCall = call - spot;
        // Walls attract when price is "inside" the range (dealer pin metaphor)
        const fPut = 0.08 * toPut * Math.exp(-Math.abs(toPut) / 18);
        const fCall = 0.08 * toCall * Math.exp(-Math.abs(toCall) / 18);
        const noise = Math.sin(now / 400) * 0.04 + Math.sin(now / 110) * 0.02;
        vel = vel * 0.92 + (fPut + fCall) * 0.015 + noise;
        spot += vel * dt * 60;
        spot = Math.min(call + 4, Math.max(put - 4, spot));
      }

      const pad = { l: 48, r: 20, t: 40, b: 48 };
      const plotW = w - pad.l - pad.r;
      const plotH = height - pad.t - pad.b;
      const minK = put - 12;
      const maxK = call + 12;
      const xOf = (k: number) => pad.l + ((k - minK) / (maxK - minK)) * plotW;
      const midY = pad.t + plotH / 2;

      ctx.fillStyle = LAB.ink;
      ctx.fillRect(0, 0, w, height);

      // Track
      ctx.fillStyle = LAB.panel;
      ctx.fillRect(pad.l, midY - 28, plotW, 56);
      ctx.strokeStyle = 'rgba(138,155,180,0.25)';
      ctx.strokeRect(pad.l, midY - 28, plotW, 56);

      // Force field glow between walls
      const g = ctx.createLinearGradient(xOf(put), 0, xOf(call), 0);
      g.addColorStop(0, 'rgba(255,92,92,0.2)');
      g.addColorStop(0.5, 'rgba(242,169,59,0.08)');
      g.addColorStop(1, 'rgba(46,204,113,0.2)');
      ctx.fillStyle = g;
      ctx.fillRect(xOf(put), midY - 28, xOf(call) - xOf(put), 56);

      const level = (k: number, color: string, label: string, thick = 2) => {
        const x = xOf(k);
        ctx.strokeStyle = color;
        ctx.lineWidth = thick;
        ctx.beginPath();
        ctx.moveTo(x, pad.t);
        ctx.lineTo(x, pad.t + plotH);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = '600 11px "IBM Plex Sans", system-ui, sans-serif';
        ctx.fillText(label, Math.min(x + 6, pad.l + plotW - 70), pad.t + 14);
      };

      level(put, LAB.red, `put $${put}`);
      level(call, LAB.green, `call $${call}`);
      ctx.save();
      ctx.shadowColor = 'rgba(242,169,59,0.7)';
      ctx.shadowBlur = reduced ? 0 : 14;
      level(flip, LAB.amber, 'flip', 2.5);
      ctx.restore();

      // Spot mass
      const sx = xOf(spot);
      const pulse = reduced ? 0.5 : 0.55 + 0.45 * Math.sin(now / 350);
      ctx.save();
      ctx.shadowColor = 'rgba(94,139,196,0.85)';
      ctx.shadowBlur = reduced ? 0 : 16 + pulse * 8;
      ctx.fillStyle = LAB.signal;
      ctx.beginPath();
      ctx.arc(sx, midY, 8 + pulse * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = LAB.phosphor;
      ctx.font = '700 12px "IBM Plex Mono", ui-monospace, monospace';
      ctx.fillText(`spot $${spot.toFixed(2)}`, Math.min(sx + 12, pad.l + plotW - 96), midY - 14);

      // Force arrows (display metaphor)
      if (!reduced) {
        ctx.strokeStyle = 'rgba(233,228,214,0.25)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          const k = put + ((call - put) * (i + 1)) / 6;
          const x = xOf(k);
          const pull = (flip - k) * 0.15;
          ctx.beginPath();
          ctx.moveTo(x, midY + 40);
          ctx.lineTo(x + pull, midY + 52);
          ctx.stroke();
        }
      }

      ctx.fillStyle = LAB.phosphor;
      ctx.font = '700 13px "IBM Plex Sans", system-ui, sans-serif';
      ctx.fillText('WALL MAGNET · pin range', pad.l, 22);
      ctx.fillStyle = LAB.steel;
      ctx.font = '500 11px "IBM Plex Sans", system-ui, sans-serif';
      ctx.fillText('put / flip / call as force geometry  ·  synthetic motion', pad.l + 200, 22);

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
      title="Wall Magnet"
      tagline="Treat put/call walls as attractors and the gamma flip as polarity. Spot drifts under soft forces — a physical reading of pin risk without claiming path prediction."
      tickerCandidate="Dealer positioning · walls & flip tiles"
      testId="lab-wall-magnet"
    >
      <div ref={wrapRef} style={{ width: '100%' }}>
        <canvas
          ref={canvasRef}
          data-testid="wall-magnet-canvas"
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

export default WallMagnetLab;
