/**
 * Wall Magnet — optional Dealer positioning view (Levels | Magnet toggle).
 * Soft force metaphor only; structure-clock levels from REST.
 */
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useEffect, useRef } from 'react';

const INK = '#0B0F17';
const PANEL = '#131A24';
const PHOSPHOR = '#E9E4D6';
const STEEL = '#8A9BB4';
const AMBER = '#F2A93B';
const SIGNAL = '#5E8BC4';
const GREEN = '#2ecc71';
const RED = '#ff5c5c';

export function WallMagnetView({
  putWall,
  callWall,
  gammaFlip,
  spot,
  height = 200,
}: {
  putWall: number;
  callWall: number;
  gammaFlip: number;
  spot: number;
  height?: number;
}) {
  const reduced = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spotRef = useRef(spot);
  spotRef.current = spot;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let running = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let anim = spot;
    let vel = 0;

    const layout = () => {
      const w = Math.max(280, wrap.clientWidth);
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
      const target = spotRef.current;
      // Soft settle toward structure spot; walls as visual magnets
      if (!reduced) {
        const pull = (target - anim) * 0.08;
        const toPut = putWall - anim;
        const toCall = callWall - anim;
        const fPut = 0.02 * toPut * Math.exp(-Math.abs(toPut) / 20);
        const fCall = 0.02 * toCall * Math.exp(-Math.abs(toCall) / 20);
        vel = vel * 0.88 + pull + (fPut + fCall) * 0.01;
        anim += vel;
      } else {
        anim = target;
      }

      const pad = { l: 40, r: 16, t: 28, b: 28 };
      const plotW = w - pad.l - pad.r;
      const plotH = height - pad.t - pad.b;
      const minK = Math.min(putWall, callWall, gammaFlip, anim) - 8;
      const maxK = Math.max(putWall, callWall, gammaFlip, anim) + 8;
      const xOf = (k: number) => pad.l + ((k - minK) / (maxK - minK || 1)) * plotW;
      const midY = pad.t + plotH / 2;

      ctx.fillStyle = INK;
      ctx.fillRect(0, 0, w, height);
      ctx.fillStyle = PANEL;
      ctx.fillRect(pad.l, midY - 22, plotW, 44);

      const g = ctx.createLinearGradient(xOf(putWall), 0, xOf(callWall), 0);
      g.addColorStop(0, 'rgba(255,92,92,0.18)');
      g.addColorStop(0.5, 'rgba(242,169,59,0.06)');
      g.addColorStop(1, 'rgba(46,204,113,0.18)');
      ctx.fillStyle = g;
      ctx.fillRect(xOf(putWall), midY - 22, Math.max(4, xOf(callWall) - xOf(putWall)), 44);

      const level = (k: number, color: string, label: string, thick = 1.5) => {
        const x = xOf(k);
        ctx.strokeStyle = color;
        ctx.lineWidth = thick;
        ctx.beginPath();
        ctx.moveTo(x, pad.t);
        ctx.lineTo(x, pad.t + plotH);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = '600 10px "IBM Plex Sans", system-ui, sans-serif';
        ctx.fillText(label, Math.min(x + 4, pad.l + plotW - 56), pad.t + 12);
      };
      level(putWall, RED, `put $${putWall.toFixed(0)}`);
      level(callWall, GREEN, `call $${callWall.toFixed(0)}`);
      ctx.save();
      ctx.shadowColor = 'rgba(242,169,59,0.6)';
      ctx.shadowBlur = reduced ? 0 : 10;
      level(gammaFlip, AMBER, 'flip', 2);
      ctx.restore();

      const sx = xOf(anim);
      ctx.fillStyle = SIGNAL;
      ctx.beginPath();
      ctx.arc(sx, midY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PHOSPHOR;
      ctx.font = '600 11px "IBM Plex Mono", ui-monospace, monospace';
      ctx.fillText(`$${anim.toFixed(2)}`, Math.min(sx + 10, pad.l + plotW - 64), midY - 10);

      ctx.fillStyle = STEEL;
      ctx.font = '500 10px "IBM Plex Sans", system-ui, sans-serif';
      ctx.fillText('Magnet view · structure levels · display metaphor', pad.l, 16);

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
  }, [putWall, callWall, gammaFlip, height, reduced]);

  return (
    <div ref={wrapRef} data-testid="wall-magnet-view" style={{ width: '100%' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', borderRadius: 8 }} />
    </div>
  );
}
