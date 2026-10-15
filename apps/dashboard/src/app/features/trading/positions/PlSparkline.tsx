/**
 * Tiny per-position P/L trend sparkline (UX_BLUEPRINT §5.1 `trend`), on the v5 chart rules
 * (design/src/screens/v5/families-desk.mjs `plAfter`, canon P-9 and P-11):
 *
 * - Pure SVG. A `null` sample is a **break** (gap in the line), never 0 and never interpolated.
 *   Ephemeral series from the in-browser ring buffer; clears on reload.
 * - The y range always includes zero and the zero line is drawn (`chartRoles.axis`), so the sign is
 *   carried by POSITION (above or below the line), not by hue alone.
 * - P&L is money moving, so each run takes its own direction (`chartRoles.up` / `.down`), split at
 *   the zero crossing: segment by segment, never the last value's colour for the whole line.
 * - It has a text twin: `role="img"` with an aria-label saying where it is now, its low or high, and
 *   how many samples it holds.
 */
import { chartRoles } from '@/shared/charts/frame';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { useMemo } from 'react';
import type { PlSample } from './useTrends';

const W = 72;
const H = 24;
const PAD = 3;

export interface SparkSegment {
  /** +1: at or above zero; −1: below. */
  sign: 1 | -1;
  d: string;
}
export interface SparkGeometry {
  segments: SparkSegment[];
  /** The zero line's y. */
  zeroY: number;
  /** The last plotted point (the end dot) and its sign, or null. */
  last: { x: number; y: number; sign: 1 | -1 } | null;
}

const fx = (n: number) => n.toFixed(2);

/**
 * The sparkline's geometry. Runs of finite samples become polylines; a null sample breaks the line.
 * Inside a run, a sign change splits the line AT the interpolated zero crossing, so the part above
 * zero and the part below each carry their own direction. A run of one point draws nothing.
 * Returns null with fewer than two finite samples.
 */
export function plSparkGeometry(
  samples: PlSample[],
  width = W,
  height = H,
  pad = PAD,
): SparkGeometry | null {
  const vals = samples.map((s) => (s.pl != null && Number.isFinite(s.pl) ? s.pl : null));
  const finite = vals.filter((v): v is number => v != null);
  if (finite.length < 2) return null;
  const min = Math.min(0, ...finite);
  const max = Math.max(0, ...finite);
  const span = max - min || 1;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const n = samples.length;
  const xAt = (i: number) => pad + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (v: number) => pad + innerH - ((v - min) / span) * innerH;
  const signOf = (v: number): 1 | -1 => (v >= 0 ? 1 : -1);

  const segments: SparkSegment[] = [];
  let pts: [number, number][] = [];
  let sign: 1 | -1 = 1;
  const flush = () => {
    if (pts.length >= 2)
      segments.push({
        sign,
        d: pts.map(([x, y], i) => `${i ? 'L' : 'M'}${fx(x)} ${fx(y)}`).join(' '),
      });
    pts = [];
  };
  let prev: { i: number; v: number } | null = null;
  let last: SparkGeometry['last'] = null;
  for (let i = 0; i < n; i++) {
    const v = vals[i];
    if (v == null) {
      flush();
      prev = null;
      continue;
    }
    const p: [number, number] = [xAt(i), yAt(v)];
    if (prev == null) {
      sign = signOf(v);
      pts = [p];
    } else if (signOf(v) !== sign) {
      // Split at the zero crossing between prev and this sample (linear in index).
      const t = (0 - prev.v) / (v - prev.v);
      const z: [number, number] = [xAt(prev.i + t * (i - prev.i)), yAt(0)];
      pts.push(z);
      flush();
      sign = signOf(v);
      pts = [z, p];
    } else {
      pts.push(p);
    }
    prev = { i, v };
    last = { x: p[0], y: p[1], sign: signOf(v) };
  }
  flush();
  return { segments, zeroY: yAt(0), last };
}

const money = (v: number) =>
  `${v < 0 ? '−' : ''}$${Math.round(Math.abs(v)).toLocaleString('en-US')}`;

/** The sparkline's text twin. */
export function plSparkText(samples: PlSample[]): string {
  const vals = samples.map((s) => s.pl).filter((v): v is number => v != null && Number.isFinite(v));
  if (vals.length === 0) return 'No P/L samples this session.';
  const now = vals[vals.length - 1];
  const low = Math.min(...vals);
  const high = Math.max(...vals);
  const where = now >= 0 ? `Up ${money(now)} now` : `Down ${money(-now)} now`;
  return `P/L this session: ${where}; low ${money(low)}, high ${money(high)}; ${vals.length} samples.`;
}

export function PlSparkline({ samples, offline }: { samples: PlSample[]; offline?: boolean }) {
  const roles = chartRoles(useTheme());
  // The one direction choice: by the SIGN of each run (P-11), never by the last value alone.
  const dirColor = (sign: number) => (sign >= 0 ? roles.up : roles.down);
  const geo = useMemo(() => plSparkGeometry(samples), [samples]);
  const plotted = samples.filter((s) => s.pl != null && Number.isFinite(s.pl as number)).length;

  if (!geo || geo.segments.length === 0) {
    return (
      <Typography variant="caption" sx={{ color: 'text.disabled' }} data-testid="trend-empty">
        —
      </Typography>
    );
  }

  return (
    <Box
      component="span"
      role="img"
      aria-label={plSparkText(samples)}
      sx={{ width: W, height: H, opacity: offline ? 0.5 : 1, lineHeight: 0 }}
      data-testid="trend-sparkline"
      data-points={plotted}
      data-engine="svg-sparkline-v5"
    >
      <Box
        component="svg"
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        aria-hidden
        focusable="false"
        sx={{ display: 'block', overflow: 'visible' }}
      >
        <line
          x1={0}
          x2={W}
          y1={geo.zeroY}
          y2={geo.zeroY}
          stroke={roles.axis}
          strokeWidth={1}
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
        {geo.segments.map((seg, i) => (
          <path
            key={i}
            d={seg.d}
            fill="none"
            stroke={dirColor(seg.sign)}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {geo.last && (
          <circle cx={geo.last.x} cy={geo.last.y} r={2.5} fill={dirColor(geo.last.sign)} />
        )}
      </Box>
    </Box>
  );
}
