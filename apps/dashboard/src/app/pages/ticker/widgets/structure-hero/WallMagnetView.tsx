/**
 * Wall Magnet — optional Dealer positioning view (Field | Magnet toggle).
 * Soft force metaphor only; structure-clock levels from REST.
 *
 * REPAIR TASK item 10 (`STRUCTURE_HERO_REPAIR_TASK.md`; `design/src/lib.mjs:320-340`): takes
 * `palette` + `surfaces` — the SAME resolved objects `StructureFieldCanvas`/`LevelLadder`/
 * `TapePulseStrip` already receive from `StructureHeroPanel` (criterion 7) — in place of the module-
 * level hex literals this file used to carry. `hex-discipline.spec.ts`'s exemption entry for this
 * file is removed in the same commit. Height now matches the field (300, was 200) so the Field/
 * Magnet toggle no longer changes the panel's height; the band is 68px tall (was an ad-hoc 44), and
 * the reading line states the exact distance-from-flip percentage + the honesty footnote the design
 * source carries.
 */
import type { LevelPalette } from '@/shared/charts/structure-field/levelStrokes';
import { withAlpha } from '@/shared/charts/structure-field/levelStrokes';
import type { StructureFieldSurfaces } from '@/shared/charts/structure-field/StructureFieldCanvas';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useEffect, useRef } from 'react';

export interface WallMagnetViewProps {
  putWall: number;
  callWall: number;
  gammaFlip: number;
  spot: number;
  height?: number;
  /** The SAME resolved objects the field canvas and the ladder receive (criterion 7) — never a
   *  second colour table, never a module-level hex literal. */
  palette: LevelPalette;
  surfaces: StructureFieldSurfaces;
}

export function WallMagnetView({
  putWall,
  callWall,
  gammaFlip,
  spot,
  height = 300,
  palette,
  surfaces,
}: WallMagnetViewProps) {
  const reduced = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spotRef = useRef(spot);
  spotRef.current = spot;
  const paletteRef = useRef(palette);
  paletteRef.current = palette;
  const surfacesRef = useRef(surfaces);
  surfacesRef.current = surfaces;

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
    const BAND = 68;

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

    const paint = () => {
      if (!running) return;
      const pal = paletteRef.current;
      const sur = surfacesRef.current;
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

      const pad = { l: 40, r: 16, t: 28, b: 44 };
      const plotW = w - pad.l - pad.r;
      const plotH = height - pad.t - pad.b;
      const minK = Math.min(putWall, callWall, gammaFlip, anim) - 8;
      const maxK = Math.max(putWall, callWall, gammaFlip, anim) + 8;
      const xOf = (k: number) => pad.l + ((k - minK) / (maxK - minK || 1)) * plotW;
      const midY = pad.t + plotH / 2;

      ctx.fillStyle = sur.ink;
      ctx.fillRect(0, 0, w, height);
      ctx.fillStyle = sur.panel;
      ctx.fillRect(pad.l, midY - BAND / 2, plotW, BAND);

      const g = ctx.createLinearGradient(xOf(putWall), 0, xOf(callWall), 0);
      g.addColorStop(0, withAlpha(pal.putWall, 0.18));
      g.addColorStop(0.5, withAlpha(pal.gammaFlip, 0.06));
      g.addColorStop(1, withAlpha(pal.callWall, 0.18));
      ctx.fillStyle = g;
      ctx.fillRect(xOf(putWall), midY - BAND / 2, Math.max(4, xOf(callWall) - xOf(putWall)), BAND);

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
      level(putWall, pal.putWall, `put $${putWall.toFixed(0)}`);
      level(callWall, pal.callWall, `call $${callWall.toFixed(0)}`);
      ctx.save();
      ctx.shadowColor = withAlpha(pal.gammaFlip, 0.6);
      ctx.shadowBlur = reduced ? 0 : 10;
      level(gammaFlip, pal.gammaFlip, 'flip', 2);
      ctx.restore();

      const sx = xOf(anim);
      ctx.fillStyle = pal.mid;
      ctx.beginPath();
      ctx.arc(sx, midY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = sur.phosphor;
      ctx.font = '600 11px "IBM Plex Mono", ui-monospace, monospace';
      ctx.fillText(`$${anim.toFixed(2)}`, Math.min(sx + 10, pad.l + plotW - 64), midY - 10);

      // The reading line (repair task item 10): exact distance from the flip + the dealer-dampening
      // metaphor, in Sans 11 steel — `design/src/lib.mjs:338`.
      const distPct = gammaFlip !== 0 ? ((anim - gammaFlip) / Math.abs(gammaFlip)) * 100 : 0;
      const side = distPct >= 0 ? 'above' : 'below';
      ctx.fillStyle = sur.steel;
      ctx.font = '500 11px "IBM Plex Sans", system-ui, sans-serif';
      ctx.fillText(
        `${Math.abs(distPct).toFixed(2)}% ${side} the flip · dealers dampen moves here`,
        pad.l,
        midY + BAND / 2 + 18,
      );

      // Footnote — the display-metaphor honesty clause, verbatim (`design/src/lib.mjs:339`).
      ctx.fillStyle = sur.steel;
      ctx.font = '500 10px "IBM Plex Sans", system-ui, sans-serif';
      ctx.fillText(
        'Magnet view · structure levels · a display metaphor, not a forecast',
        pad.l,
        height - 12,
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
    // `spot`/`palette`/`surfaces` are read from refs so this rAF loop is not torn down every live
    // tick or every theme-identical re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [putWall, callWall, gammaFlip, height, reduced]);

  return (
    <div ref={wrapRef} data-testid="wall-magnet-view" style={{ width: '100%' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} />
    </div>
  );
}
