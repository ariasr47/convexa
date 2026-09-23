/**
 * Structure Field — Canvas2D dual-clock instrument for dealer net-GEX.
 *
 * Structure layer paints to an offscreen buffer only when samples/levels change.
 * Every rAF frame: blit structure → dynamic field (warped lines, particles, flip well)
 * → tape mid + trail → 60Hz probe. React only receives a small hover readout string.
 *
 * Used by the ticker GEX strike profile and the /lab comparison page.
 *
 * The canvas paints to Canvas2D and cannot consume MUI `sx` / `useTheme()` — it has no theme input
 * of its own. `palette` and `surfaces` below are the RESOLVED, scheme-aware colours the host resolves
 * once via `resolveLevelPalette(theme)` / `useTheme()` and hands down as props (SPEC §2.7); the level
 * stroke table itself lives in `levelStrokes.ts` so the ladder (FE-5) and this field can never drift
 * apart. Honors prefers-reduced-motion.
 *
 * PLAN FE-4 — the two paint routines (structure buffer / per-frame dynamics) are extracted as PURE
 * functions in `paintStep.ts` (`paintStructureStep` / `paintFrameStep`), driven here against real
 * canvas contexts and in `paintStep.spec.ts` against a recording fake one. This `useEffect` keeps
 * only what cannot be pure: canvas/DPR/layout setup, the mutable `FrameState`, the structure-key
 * dirty check, the blit, rAF scheduling and the DOM listeners.
 */
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { withAlpha, type LevelPalette } from './levelStrokes';
import {
  computeGeometry,
  emptyFrameState,
  paintFrameStep,
  paintStructureStep,
  probeLabel,
  type Pad,
  type StructureFieldSurfaces,
} from './paintStep';
import { structureBufferKey } from './structureBufferKey';
import type { StructureFieldModel } from './types';

export type { StructureFieldSurfaces } from './paintStep';

export interface StructureFieldCanvasProps {
  model: StructureFieldModel;
  height?: number;
  className?: string;
  /**
   * `ticker` — embed in Widget (no title strip / tape pill; frame owns honesty copy).
   * `lab` — full instrument chrome (default).
   */
  variant?: 'lab' | 'ticker';
  /**
   * The RESOLVED level palette (SPEC §2.7). The canvas paints to Canvas2D and cannot consume MUI
   * `sx`, so the host resolves token keys → colours with `resolveLevelPalette(theme)` and passes them
   * in. This is the theme input the file previously had none of, and it is what makes criterion 52
   * satisfiable — DELEGATED (P5).
   */
  palette: LevelPalette;
  /** The scheme's panel + body surfaces, same reason. Replaces the unconditional `INK`/`PANEL`/
   *  `RAISED`/`PHOSPHOR`/`STEEL`/`BURNT` fills the file used to carry as module-level hex. */
  surfaces: StructureFieldSurfaces;
  /**
   * GATE Z I-3 (SPEC amendment 3, AC-L5a) — override the canvas's accessible description: point
   * `aria-describedby` at an EXISTING DOM node (a host-owned visible caption) instead of the
   * internally-generated hidden summary paragraph below. The generated summary is written for a
   * REAL ticker desk — it claims "the live tape mid" and points at "the level ladder beside this
   * field", both true there (a real stream, a real ladder) and both FALSE on a frozen sample that
   * has neither. Every other consumer (the ticker desk, `/lab`) is unaffected: this prop is
   * unset there, so the generated summary still renders exactly as before.
   */
  describedById?: string;
}

export function StructureFieldCanvas({
  model,
  height = 480,
  className,
  variant = 'lab',
  palette,
  surfaces,
  describedById,
}: StructureFieldCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef(model);
  modelRef.current = model;
  // Criterion 24 (P1, DELEGATED, SPEC §4.4) — the canvas gains an accessible name and a summary
  // alternative. This promotes an unlabelled canvas from one widget among thirteen to the desk's
  // primary instrument; the design source already does this (`design/src/lib.mjs:296`).
  const summaryId = useId();
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const [hoverReadout, setHoverReadout] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;
  const embedded = variant === 'ticker';
  // Ticker: calmer instrument (fewer particles, softer FX) so paper widgets aren't overpowered.
  const calm = embedded;
  // Memoized (not a fresh literal per render): the effect below now hands the whole object to
  // `computeGeometry`, so its identity needs to be stable across renders where `embedded` — the only
  // thing it is derived from — has not changed, or the effect's dependency array cannot name it.
  const pad = useMemo<Pad>(
    () => (embedded ? { l: 40, r: 12, t: 20, b: 28 } : { l: 56, r: 20, t: 40, b: 48 }),
    [embedded],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let raf = 0;
    let running = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Offscreen structure buffer (static between model changes)
    const off = document.createElement('canvas');
    const offCtx = off.getContext('2d');
    let structureDirty = true;
    let structureKey = '';

    // The frame-state object replaces the closure's cross-frame mutable variables
    // (particles/midTrail/spawnAcc/lastT/markerBoxes) — PLAN FE-4.
    const frame = emptyFrameState();
    frame.lastT = performance.now();

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

    const paint = (now: number) => {
      if (!running) return;
      const m = modelRef.current;
      const reduce = reducedRef.current;

      if (m.samples.length < 2) {
        ctx.fillStyle = surfaces.ink;
        ctx.fillRect(0, 0, w, h);
        frame.lastT = now;
        raf = requestAnimationFrame(paint);
        return;
      }

      const geom = computeGeometry(m, pad, w, h, calm, embedded);

      const key = structureBufferKey(m);
      if (key !== structureKey) {
        structureKey = key;
        structureDirty = true;
        frame.particles.length = 0;
      }
      if (structureDirty && offCtx) {
        frame.markerBoxes = paintStructureStep(m, offCtx, geom, palette, surfaces);
        structureDirty = false;
      }

      // Blit structure
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(off, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      paintFrameStep(m, ctx, geom, frame, now, reduce, palette, surfaces, hoverRef.current);

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
    calm,
    model.samples,
    model.spot,
    model.callWall,
    model.putWall,
    model.gammaFlip,
    model.symbol,
    pad,
    palette,
    surfaces,
  ]);

  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  return (
    <div ref={wrapRef} className={className} style={{ width: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        data-testid="structure-field-canvas"
        role="img"
        aria-label={`Net dealer gamma by strike for ${model.symbol}`}
        aria-describedby={describedById ?? summaryId}
        style={{
          display: 'block',
          width: '100%',
          height,
          borderRadius: embedded ? 0 : 12,
          border: embedded ? 'none' : `1px solid ${withAlpha(surfaces.steel, 0.28)}`,
          // The ambient outer shadow (`rgba(0,0,0,0.65)`) is a deliberately MODE-INVARIANT literal,
          // not a `tokens.ts` export — GATE Z (curvature-v2-desk-and-read, 2026-09-05, QA F3)
          // removed the short-lived `fieldAmbientShadow` token: its only consumer is this
          // `embedded === false` branch (`/lab/structure-field`; the desk hero passes
          // `variant="ticker"`, so `embedded` is true there and this line never paints), and a
          // named export with one lab-only consumer, absent from the mirrored `additions` block in
          // `design/tokens/tokens.json`, contradicts DESIGN_SYSTEM.md:103's "Seven new names ...
          // mirrored" claim for that surface. This canvas also has no `useTheme()` to resolve
          // `elevationFor(theme)` from (SPEC §2.7 — it takes already-RESOLVED colours as props), so
          // there is no existing token this value can bind to without new prop plumbing. See the
          // exemption entry in `hex-discipline.spec.ts` for the "why a literal, not a token" note.
          boxShadow: embedded
            ? 'none'
            : `0 0 0 1px ${withAlpha(surfaces.ink, 0.6)}, 0 18px 48px -24px rgba(0,0,0,0.65)`,
          cursor: 'crosshair',
          touchAction: 'none',
        }}
      />
      {/* The text equivalent (criterion 24): what the field plots, the levels it marks, and a
          pointer at the ladder as its tabular equivalent (criterion 23 — the ladder already puts
          every level + distance in the DOM, beside the field). Visually hidden, not decorative —
          this is the canvas's accessible description, not a caption.
          GATE Z I-3: this claims a live tape mid and a ladder, both real facts on the ticker desk
          this paragraph is written for. Skipped entirely when `describedById` is set — a host
          supplying its own description (the landing's frozen sample) has neither fact to claim,
          and the override above already points screen readers at that host's own caption. */}
      {!describedById && (
        <p
          id={summaryId}
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          Net dealer gamma by strike for {model.symbol}, marking the call wall, put wall, gamma
          flip and max pain levels plus the live tape mid. The level ladder beside this field
          states the same levels and distances as text.
        </p>
      )}
      {hoverReadout && (
        <div
          style={{
            position: 'absolute',
            right: 12,
            bottom: 12,
            fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
            fontSize: 12,
            color: surfaces.phosphor,
            background: surfaces.raised,
            border: `1px solid ${withAlpha(surfaces.steel, 0.3)}`,
            borderRadius: '8px',
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
