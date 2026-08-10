/**
 * Tiny per-position P/L trend sparkline (UX_BLUEPRINT §5.1 `trend`).
 *
 * Pure SVG — no Recharts. A `null` sample is a **break** (gap in the polyline), never 0 and never
 * interpolated (same honesty as the old `connectNulls={false}` recharts path). Ephemeral series
 * from the in-browser ring buffer; clears on reload.
 *
 * Color: last non-null sample sign → theme `success.main` / `error.main` (token discipline).
 */
import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMemo } from 'react';
import type { PlSample } from './useTrends';

const W = 72;
const H = 24;
const PAD = 2;
/** Build one or more SVG path `d` strings; null samples split segments (broken line). */
export function sparklinePathD(samples: PlSample[], width = W, height = H, pad = PAD): string[] {
  const vals = samples.map((s) => s.pl);
  const finite = vals.filter((v): v is number => v != null && Number.isFinite(v));
  if (finite.length < 2) return [];

  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = max - min || 1;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const n = samples.length;
  const xAt = (i: number) => pad + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (v: number) => pad + innerH - ((v - min) / span) * innerH;

  const paths: string[] = [];
  let d = '';
  let drawing = false;

  for (let i = 0; i < n; i++) {
    const v = vals[i];
    if (v == null || !Number.isFinite(v)) {
      if (drawing) {
        paths.push(d);
        d = '';
        drawing = false;
      }
      continue;
    }
    const x = xAt(i);
    const y = yAt(v);
    if (!drawing) {
      d = `M${x.toFixed(2)} ${y.toFixed(2)}`;
      drawing = true;
    } else {
      d += ` L${x.toFixed(2)} ${y.toFixed(2)}`;
    }
  }
  if (drawing && d) paths.push(d);
  // A single-point segment after a break is not a "line" — drop lonely M commands.
  return paths.filter((p) => p.includes(' L'));
}

export function PlSparkline({ samples, offline }: { samples: PlSample[]; offline?: boolean }) {
  const theme = useTheme();
  const plotted = samples.filter((s) => s.pl != null && Number.isFinite(s.pl as number));
  const paths = useMemo(() => sparklinePathD(samples), [samples]);

  if (plotted.length < 2 || paths.length === 0) {
    return (
      <Typography variant="caption" sx={{ color: 'text.disabled' }} data-testid="trend-empty">
        —
      </Typography>
    );
  }

  const last = plotted[plotted.length - 1].pl ?? 0;
  const color = last >= 0 ? theme.palette.success.main : theme.palette.error.main;

  return (
    <Box
      sx={{ width: W, height: H, opacity: offline ? 0.5 : 1, lineHeight: 0 }}
      data-testid="trend-sparkline"
      data-points={plotted.length}
      data-engine="svg-sparkline-v1"
    >
      <Box
        component="svg"
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        aria-hidden
        sx={{ display: 'block' }}
      >
        {paths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </Box>
    </Box>
  );
}
