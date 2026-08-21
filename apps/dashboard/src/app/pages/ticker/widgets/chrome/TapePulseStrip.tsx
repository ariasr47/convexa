/**
 * Tape Pulse strip — thin dual-clock mid trail under Command Deck.
 * Structure mid from REST; live mid + print flashes from liveTapeStore.
 */
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { typographyTokens } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect, useRef } from 'react';
import { useLiveTape } from '../../liveTapeStore';

const INK = '#0B0F17';
const PANEL = '#131A24';
const SIGNAL = '#5E8BC4';

export interface TapePulseStripProps {
  /** Structure-clock mid (REST gex_spot / price). */
  structureMid: number;
  height?: number;
}

export function TapePulseStrip({ structureMid, height = 88 }: TapePulseStripProps) {
  const reduced = useReducedMotion();
  const tape = useLiveTape();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const midRef = useRef<number | null>(null);
  const liveRef = useRef(false);
  const lastTradeRef = useRef<number | null>(null);
  const liveMid =
    tape.isLive && tape.live?.mid != null && Number.isFinite(tape.live.mid) ? tape.live.mid : null;
  const isLive = Boolean(tape.isLive && tape.live?.live && !tape.streamOffline);
  const displayMid = liveMid ?? structureMid;
  const chartHeight = Math.max(44, height - 28);

  midRef.current = liveMid;
  liveRef.current = isLive;
  lastTradeRef.current = tape.isLive && tape.live?.last_trade != null ? tape.live.last_trade : null;

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

    const paint = (now: number) => {
      if (!running) return;
      const liveMid = midRef.current;
      const isLive = liveRef.current;
      const lt = lastTradeRef.current;
      const displayMid = liveMid ?? structureMid;

      trail.push({ t: now, mid: displayMid });
      while (trail.length > 100) trail.shift();
      while (trail.length && now - trail[0].t > 5000) trail.shift();

      if (isLive && lt != null && lt !== lastLt) {
        if (lastLt != null && !reduced) {
          prints.push({ t: now, mid: lt, dir: lt >= lastLt ? 1 : -1 });
        }
        lastLt = lt;
      }
      while (prints.length && now - prints[0].t > 800) prints.shift();

      const pad = { l: 10, r: 10, t: 6, b: 8 };
      const plotW = w - pad.l - pad.r;
      const plotH = chartHeight - pad.t - pad.b;
      const mids = trail.map((p) => p.mid);
      const lo = Math.min(...mids, structureMid - 0.5);
      const hi = Math.max(...mids, structureMid + 0.5);
      const yOf = (m: number) => pad.t + plotH * (1 - (m - lo) / (hi - lo || 1));
      const xOf = (i: number, n: number) => pad.l + (i / Math.max(1, n - 1)) * plotW;

      ctx.fillStyle = INK;
      ctx.fillRect(0, 0, w, chartHeight);
      ctx.fillStyle = PANEL;
      ctx.fillRect(pad.l, pad.t, plotW, plotH);

      const yBase = yOf(structureMid);
      ctx.strokeStyle = 'rgba(138,155,180,0.4)';
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
        ctx.strokeStyle = SIGNAL;
        ctx.lineWidth = 1.75;
        ctx.stroke();
      }

      const last = trail[trail.length - 1];
      if (last) {
        const x = xOf(trail.length - 1, trail.length);
        const y = yOf(last.mid);
        const pulse = isLive && !reduced ? 0.5 + 0.5 * Math.sin(now / 300) : 0.35;
        ctx.fillStyle = SIGNAL;
        ctx.beginPath();
        ctx.arc(x, y, 3 + pulse, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const p of prints) {
        const age = (now - p.t) / 800;
        const a = Math.max(0, 1 - age);
        ctx.fillStyle = p.dir > 0 ? `rgba(46,204,113,${0.2 * a})` : `rgba(255,92,92,${0.2 * a})`;
        ctx.fillRect(pad.l, yOf(p.mid) - 1, plotW, 2);
      }

      raf = requestAnimationFrame(paint);
    };

    const onResize = () => {
      w = layout();
    };
    window.addEventListener('resize', onResize);
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => onResize());
    resizeObserver?.observe(wrap);
    raf = requestAnimationFrame(paint);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      resizeObserver?.disconnect();
    };
  }, [structureMid, chartHeight, reduced]);

  return (
    <Box
      ref={wrapRef}
      data-testid="tape-pulse-strip"
      sx={{
        width: '100%',
        mb: 1,
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        data-testid="tape-pulse-header"
        sx={{
          minHeight: '28px',
          px: 1.25,
          py: 0.5,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: 1.5,
          rowGap: 0.25,
        }}
      >
        <Stack
          direction="row"
          spacing={0.75}
          useFlexGap
          sx={{ alignItems: 'center', flex: '1 1 220px', minWidth: 0, flexWrap: 'wrap' }}
        >
          <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 700 }}>
            Tape
          </Typography>
          <Typography
            variant="caption"
            data-testid="tape-mid-readout"
            sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}
          >
            {isLive ? 'Live' : 'Mid'}{' '}
            <Box
              component="span"
              sx={{ color: 'text.primary', fontFamily: typographyTokens.monoFontFamily }}
            >
              ${displayMid.toFixed(2)}
            </Box>
          </Typography>
          {!isLive && (
            <Typography
              component="span"
              variant="caption"
              data-testid="tape-stream-state"
              sx={{ color: 'text.disabled', whiteSpace: 'nowrap' }}
            >
              {tape.streamOffline ? '⏸ Stream offline' : 'Stream off'}
            </Typography>
          )}
        </Stack>
        <Typography
          component="span"
          variant="caption"
          data-testid="tape-structure-readout"
          sx={{ ml: 'auto', color: 'text.secondary', whiteSpace: 'nowrap' }}
        >
          Structure{' '}
          <Box component="span" sx={{ fontFamily: typographyTokens.monoFontFamily }}>
            ${structureMid.toFixed(2)}
          </Box>
        </Typography>
      </Box>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ display: 'block', width: '100%', height: chartHeight }}
      />
    </Box>
  );
}

export default TapePulseStrip;
