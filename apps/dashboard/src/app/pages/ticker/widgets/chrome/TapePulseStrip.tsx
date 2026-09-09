/**
 * Tape Pulse strip — thin dual-clock mid trail under Command Deck. PRESENTATIONAL (curvature-v2-
 * desk-and-read, SPEC §2.1/§4.2): the host (`structure-hero/TapeTrailRow.tsx`) computes the branded
 * claim + the latched mid ONCE, at the desk's single store read, and hands them down as props. This
 * file no longer calls `useLiveTape()` itself — that is SPEC §2.1's "second fabrication site"
 * (`:32-33,:39,:69,:77` used to read the store's own `isLive` flag off `tape` directly), fixed by
 * removing the read entirely rather than re-deriving it a second, correct way.
 *
 * `:33`'s old `isLive` (missing the `live.mid != null` requirement its own `liveMid` already had) is
 * replaced by `andPresent(claim, mid)` below — the SAME composition helper every other desk figure
 * uses, never a hand-rolled `&&` chain.
 *
 * `:71`/`:73`'s old paint-loop fallback (`displayMid = liveMid ?? structureMid`, pushed to the trail
 * EVERY rAF frame unconditionally, so the drawn trail could be composed of structure-mid samples) is
 * replaced: the trail pushes a point only while `activeClaim` holds — freezing (never zeroing, never
 * blanking) on a drop. `mid` is already the LATCHED value the caller computed (FE-2's
 * `useStreamLatch`), so the frozen trail's last point is the last genuinely-live tick, never a REST
 * bundle number.
 *
 * `:199`'s `{isLive ? 'Live' : 'Mid'}` word is DELETED, not demoted (SPEC §4.2) — the label is `Mid`
 * unconditionally. Liveness is carried once by the ladder's mid row dot; this readout never wears a
 * second one (criterion 8/9).
 *
 * GATE Z (FE-11, SPEC §4.1 "Tape trail row"): the `Mid` value itself now carries the offline/stale
 * pause mark + dim on a genuine drop (`paused`, the host's `tileOffline`) — never during a session
 * replay (the host defines `tileOffline` as `st ? false : streamOffline`, so `paused` structurally
 * cannot be true while replaying — the same standing-union mechanism criterion 16b requires, not an
 * `!isLive` branch). No dot: this readout never had one (SPEC §4.2).
 *
 * P5 (SPEC §2.7 mechanism): the former module-level `INK`/`PANEL`/`SIGNAL` hex literals are gone —
 * `surfaces.ink`/`surfaces.panel` and `palette.mid` (the SAME resolved objects the field and the
 * ladder receive) replace them, so this canvas can never drift onto a scheme-invariant fill
 * (criteria 52/53). Its `hex-discipline.spec.ts` exemption entry is removed in the same commit.
 *
 * REPAIR TASK item 7 (`STRUCTURE_HERO_REPAIR_TASK.md`; `design/src/screens/desk.mjs:302-306`): this
 * strip loses its own card chrome (no border, no radius, no `background.paper` fill) — it is a flat
 * row with a top hairline, inline with the caption ("Tape · 5m mid trail"), the fluid sparkline (30px
 * tall, was a boxed 60px canvas) and the `Mid`/`Structure` readouts, all in `tape-pulse-header`. Every
 * testid is unchanged.
 */
import { withAlpha, type LevelPalette } from '@/shared/charts/structure-field/levelStrokes';
import type { StructureFieldSurfaces } from '@/shared/charts/structure-field/StructureFieldCanvas';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { andPresent, type LiveClaim } from '@/shared/liveness/liveClaim';
import { extrasFor, typographyTokens } from '@/shared/theme/tokens';
import PauseIcon from '@mui/icons-material/Pause';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect, useRef } from 'react';

export interface TapePulseStripProps {
  /** Structure-clock mid (REST gex_spot / price) — unchanged readout, never gated. */
  structureMid: number;
  /** The host's base delivering claim (SPEC §2.1) — never re-derived here. */
  claim: LiveClaim;
  /** The mid to DISPLAY — already latch-resolved by the caller (FE-2): the last genuinely-live
   *  tick, retained across a drop, cleared only on the caller's reset token. Never a REST fallback
   *  (criterion 10/14). */
  mid: number | null;
  /** Optional last-print price, for the decorative buy/sell flash bars — same latch-adjacent
   *  discipline: only ever a raw stream figure, gated the same way as the trail below. */
  lastTrade?: number | null;
  /** SPEC §4.1 offline/stale (GATE Z, FE-11) — true only on a genuine stream drop, never a replay arm
   *  (host-computed `tileOffline`, mirrors `TapeTrailRow`'s own `paused`). Marks + dims the `Mid`
   *  value; never the `Structure` readout (that figure is REST, not stream-derived). */
  paused?: boolean;
  /** The SAME resolved objects `StructureFieldCanvas`/`LevelLadder` receive (SPEC §2.7) — never a
   *  second colour table, never a theme read of its own. */
  palette: LevelPalette;
  surfaces: StructureFieldSurfaces;
  height?: number;
}

export function TapePulseStrip({
  structureMid,
  claim,
  mid,
  lastTrade = null,
  paused = false,
  palette,
  surfaces,
  height = 30,
}: TapePulseStripProps) {
  const reduced = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const midRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const lastTradeRef = useRef<number | null>(null);
  // The composed "genuinely delivering AND this mid is present right now" claim (SPEC §2.1) — the
  // ONLY place this file answers "is this live", and it answers it through the shared composer.
  const activeClaim = andPresent(claim, mid);
  const displayMid = mid;
  // Repair task item 7 — the canvas IS the 30px sparkline now (no header height to subtract; the
  // caption/readouts sit beside it in the same flex row, not stacked above it).
  const chartHeight = height;

  midRef.current = mid;
  activeRef.current = Boolean(activeClaim);
  lastTradeRef.current = lastTrade;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let running = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const trail: { t: number; mid: number }[] = [];
    const prints: { t: number; mid: number; dir: 1 | -1 }[] = [];
    let lastLt: number | null = null;

    const layout = () => {
      const w = Math.max(1, wrap.clientWidth || 280);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(chartHeight * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${chartHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return w;
    };
    let w = layout();

    // Draw from the current trail/prints state. Runs inside the frame loop AND synchronously after
    // every layout: `layout()` resets `canvas.width`, which clears the bitmap, and deferring the
    // repaint to the next frame left the slot blank whenever no frame followed — F-D, the visual
    // gate's frozen frame, where `ticker-desktop` captured an empty sparkline in 6 of 7 runs.
    const draw = (now: number) => {
      const active = activeRef.current;
      const pad = { l: 10, r: 10, t: 6, b: 8 };
      const plotW = w - pad.l - pad.r;
      const plotH = chartHeight - pad.t - pad.b;
      const mids = trail.map((p) => p.mid);
      const lo = Math.min(...mids, structureMid - 0.5);
      const hi = Math.max(...mids, structureMid + 0.5);
      const yOf = (m: number) => pad.t + plotH * (1 - (m - lo) / (hi - lo || 1));
      const xOf = (i: number, n: number) => pad.l + (i / Math.max(1, n - 1)) * plotW;

      ctx.fillStyle = surfaces.ink;
      ctx.fillRect(0, 0, w, chartHeight);
      ctx.fillStyle = surfaces.panel;
      ctx.fillRect(pad.l, pad.t, plotW, plotH);

      const yBase = yOf(structureMid);
      ctx.strokeStyle = withAlpha(surfaces.steel, 0.4);
      // Set, never inherited: the trail stroke below leaves 1.75 on the context, and a resize resets it
      // to 1 — a baseline stroked at whichever was last rasterises to two intensities (F-D, 2nd cause).
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(pad.l, yBase);
      ctx.lineTo(pad.l + plotW, yBase);
      ctx.stroke();
      ctx.setLineDash([]);

      if (trail.length > 1) {
        ctx.beginPath();
        trail.forEach((p, i) => {
          const x = xOf(i, trail.length);
          const y = yOf(p.mid);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = palette.mid;
        ctx.lineWidth = 1.75;
        ctx.stroke();
      }

      const last = trail[trail.length - 1];
      if (last) {
        const x = xOf(trail.length - 1, trail.length);
        const y = yOf(last.mid);
        const pulse = active && !reduced ? 0.5 + 0.5 * Math.sin(now / 300) : 0.35;
        ctx.fillStyle = palette.mid;
        ctx.beginPath();
        ctx.arc(x, y, 3 + pulse, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const p of prints) {
        const age = (now - p.t) / 800;
        const a = Math.max(0, 1 - age);
        ctx.fillStyle =
          p.dir > 0 ? withAlpha(palette.callWall, 0.2 * a) : withAlpha(palette.putWall, 0.2 * a);
        ctx.fillRect(pad.l, yOf(p.mid) - 1, plotW, 2);
      }
    };

    // The frame loop: sample, draw, reschedule.
    const paint = (now: number) => {
      if (!running) return;
      const active = activeRef.current;
      const currentMid = midRef.current;
      const lt = lastTradeRef.current;

      // Push a trail point ONLY while the claim holds and the latched mid is present (SPEC §2.1) —
      // never a structure-mid fallback. On a drop the trail FREEZES at its last live point instead
      // of blanking, zeroing, or drifting onto a REST number.
      if (active && currentMid != null) {
        trail.push({ t: now, mid: currentMid });
      }
      while (trail.length > 100) trail.shift();
      while (trail.length && now - trail[0].t > 5000) trail.shift();

      if (active && lt != null && lt !== lastLt) {
        if (lastLt != null && !reduced) {
          prints.push({ t: now, mid: lt, dir: lt >= lastLt ? 1 : -1 });
        }
        lastLt = lt;
      }
      while (prints.length && now - prints[0].t > 800) prints.shift();

      draw(now);
      raf = requestAnimationFrame(paint);
    };

    const onResize = () => {
      w = layout();
      draw(performance.now());
    };
    window.addEventListener('resize', onResize);
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => onResize());
    resizeObserver?.observe(wrap);
    // The first paint is synchronous: the slot is never blank between mount and the first frame.
    paint(performance.now());
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      resizeObserver?.disconnect();
    };
  }, [structureMid, chartHeight, reduced, surfaces, palette]);

  return (
    <Box
      data-testid="tape-pulse-strip"
      sx={{
        width: '100%',
        pt: 1,
        mt: 1,
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box
        data-testid="tape-pulse-header"
        sx={{
          minHeight: '28px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: 1.5,
          rowGap: 0.25,
        }}
      >
        <Typography
          variant="caption"
          sx={{ color: 'text.primary', fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          Tape · 5m mid trail
        </Typography>
        {/* The fluid 30px sparkline — inline with the caption and the readouts (repair task item 7),
            no longer a boxed canvas stacked below its own header. */}
        <Box ref={wrapRef} sx={{ flex: '1 1 96px', minWidth: 0 }}>
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            style={{ display: 'block', width: '100%', height: chartHeight }}
          />
        </Box>
        <Stack
          direction="row"
          spacing={1.5}
          useFlexGap
          sx={{ alignItems: 'center', ml: 'auto', flexShrink: 0, flexWrap: 'wrap' }}
        >
          {/* `Mid` — unconditional (SPEC §4.2). The word never carries a liveness claim; the
              ladder's mid row dot is the one place liveness renders on the desk (criterion 8/9).
              GATE Z (FE-11): `paused` (genuine drop only, never replay) adds the pause mark + dims
              the value — the SAME `{retained}`-shape treatment the ladder mid row gets, applied here
              because `mid` already encodes retained-vs-bare (a latched number vs `—`). */}
          <Typography
            variant="caption"
            data-testid="tape-mid-readout"
            sx={{
              color: 'text.secondary',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 0.5,
            }}
          >
            Mid{' '}
            {paused && (
              <PauseIcon
                aria-hidden
                data-testid="tape-mid-pause"
                sx={{ fontSize: 14, color: 'text.secondary' }}
              />
            )}
            <Box
              component="span"
              // PR #46 CI repair, §A — solid `textDim`, never `opacity` (opacity composites with
              // whatever sits behind it and carries no contrast guarantee; the shipped paused Mid
              // value measured 2.54:1, under WCAG AA 4.5:1).
              sx={(t) => ({
                color: paused ? extrasFor(t).textDim : t.palette.text.primary,
                fontFamily: typographyTokens.monoFontFamily,
              })}
            >
              {displayMid != null ? `$${displayMid.toFixed(2)}` : '—'}
            </Box>
          </Typography>
          {/* The `tape-stream-state` node (⏸ Stream offline / Stream off) is DELETED here —
              curvature-v2-foundations SPEC §2.4: it was a SECOND page-scope liveness authority
              beside the header connection chip, exactly what canon rule 18 exists to stop. Its
              text folds into the ONE chip; `compatibility.spec.ts:48` (and the other pins named in
              PLAN FE-5 step 5) are re-pointed in the same change. */}
          <Typography
            component="span"
            variant="caption"
            data-testid="tape-structure-readout"
            sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}
          >
            Structure{' '}
            <Box component="span" sx={{ fontFamily: typographyTokens.monoFontFamily }}>
              ${structureMid.toFixed(2)}
            </Box>
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}

export default TapePulseStrip;
