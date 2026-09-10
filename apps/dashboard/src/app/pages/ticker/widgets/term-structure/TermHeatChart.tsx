/**
 * Term Heat chart — structure-clock ATM IV by tenor (replaces Recharts line in term card).
 *
 * Ticker fidelity repair, change 5 (F9) — the module-level hex literals (`INK`/`PANEL`/`PHOSPHOR`/
 * `STEEL`/`GREEN`/`RED`/`SIGNAL`) are gone: this canvas takes its palette from `useTheme()`
 * (`theme.palette.*`), the SAME "resolved at JS-access time, not emitted as CSS" values
 * `shared/charts/structure-field/levelStrokes.ts`'s `resolveToken` already relies on under this
 * app's `cssVariables: true` theme — a Canvas 2D `fillStyle`/`strokeStyle` cannot resolve a
 * `var(--mui-palette-*)` string (canvas drawing is not part of the CSSOM), so these are read from
 * the theme OBJECT, never a CSS custom property. Computed internally (not taken as `palette`/
 * `surfaces` props the way `WallMagnetView.tsx` does after the hero repair) because — unlike the
 * hero's canvas/ladder/tape-trail trio, which share ONE resolved palette by identity across three
 * siblings (SPEC §2.7, criterion 7) — this chart has no sibling needing the identical object; a
 * local `useTheme()` is the same zero-hardcoded-hex fix with no prop plumbing for zero callers
 * (`TermStructure.tsx` no longer mounts this chart by default after F2's ribbon recompose — see
 * that file's own doc comment for the residual this leaves).
 *
 * The IV line is `info.main` (signal) in EVERY state, never a green/red split (`#2ecc71` is gone
 * outright — an IV LEVEL is a rate, not a direction). The heat gradient uses the theme's direction
 * pair (`success.main`/`error.main`) only for the two SIGNED states (contango/backwardation); the
 * unsigned `flat` state gets a neutral `text.secondary` tint, never a directional colour standing
 * in for "no direction" (the pre-fix code's `else` branch silently treated `flat` as contango-green
 * — not just off-palette, mislabelled).
 */
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { alpha, useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useRef } from 'react';

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
  const theme = useTheme();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Resolved ONCE per theme/scheme (SPEC §2.7's own pattern) — every colour this canvas paints,
  // read from the theme OBJECT (never a `var(--mui-palette-*)` CSS string, which a Canvas 2D
  // context cannot resolve).
  const palette = useMemo(
    () => ({
      ink: theme.palette.background.default,
      panel: theme.palette.background.paper,
      phosphor: theme.palette.text.primary,
      steel: theme.palette.text.secondary,
      signal: theme.palette.info.main,
      up: theme.palette.success.main,
      down: theme.palette.error.main,
    }),
    [theme],
  );

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

      ctx.fillStyle = palette.ink;
      ctx.fillRect(0, 0, w, height);
      ctx.fillStyle = palette.panel;
      ctx.fillRect(pad.l, pad.t, plotW, plotH);

      ctx.beginPath();
      ctx.moveTo(xOf(0), pad.t + plotH);
      points.forEach((p, i) => ctx.lineTo(xOf(i), yOf(p.atm_iv)));
      ctx.lineTo(xOf(points.length - 1), pad.t + plotH);
      ctx.closePath();
      const heat = ctx.createLinearGradient(0, pad.t, 0, pad.t + plotH);
      // The theme's direction pair — ONLY for the two SIGNED states. `flat` is genuinely
      // directionless and gets a neutral tint, never a colour that implies a sign it doesn't have.
      const heatColor =
        state === 'backwardation'
          ? palette.down
          : state === 'contango'
            ? palette.up
            : palette.steel;
      heat.addColorStop(0, alpha(heatColor, 0.32 + warm));
      heat.addColorStop(1, alpha(heatColor, 0.02));
      ctx.fillStyle = heat;
      ctx.fill();

      ctx.beginPath();
      points.forEach((p, i) => {
        const x = xOf(i);
        const y = yOf(p.atm_iv);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      // The IV line is a RATE, not a direction — signal in every state, never green/red.
      ctx.strokeStyle = palette.signal;
      ctx.lineWidth = 2;
      ctx.stroke();

      points.forEach((p, i) => {
        const x = xOf(i);
        const y = yOf(p.atm_iv);
        ctx.fillStyle = palette.phosphor;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = palette.steel;
        ctx.font = '500 10px "IBM Plex Sans", system-ui, sans-serif';
        ctx.fillText(`${p.dte}d`, x - 8, pad.t + plotH + 16);
        ctx.fillStyle = palette.phosphor;
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
  }, [points, state, height, reduced, palette]);

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
