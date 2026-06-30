/**
 * A tiny per-position P/L trend sparkline (UX_BLUEPRINT §5.1 `trend`). Reuses the broken-line idiom
 * from the latency visualizer: `connectNulls={false}` so a feed gap is a BROKEN line, never 0 or
 * interpolated. Ephemeral — fed from the in-browser ring buffer; clears on reload.
 *
 * Re-skin (convexa-redesign): green/red by the last sample's sign, sourced from the theme
 * (`success.main` / `error.main`) instead of literal hexes — the only behavioral constant unchanged.
 */
import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ResponsiveContainer, LineChart, Line } from 'recharts';
import type { PlSample } from './useTrends';

export function PlSparkline({ samples, offline }: { samples: PlSample[]; offline?: boolean }) {
  const theme = useTheme();
  const plotted = samples.filter((s) => s.pl != null);
  if (plotted.length < 2) {
    return <Typography variant="caption" sx={{ color: 'text.disabled' }} data-testid="trend-empty">—</Typography>;
  }
  // A null sample becomes a `null` y → recharts breaks the line (connectNulls=false).
  const data = samples.map((s, i) => ({ i, pl: s.pl }));
  const last = plotted[plotted.length - 1].pl ?? 0;
  const color = last >= 0 ? theme.palette.success.main : theme.palette.error.main;
  return (
    <Box sx={{ width: 72, height: 24, opacity: offline ? 0.5 : 1 }} data-testid="trend-sparkline" data-points={plotted.length}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line type="monotone" dataKey="pl" stroke={color} dot={false} strokeWidth={1.5}
            isAnimationActive={false} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}
