import { useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import { Card, CardContent, Typography, Stack, Box, Tooltip as MuiTooltip } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell,
  ReferenceLine, Tooltip,
} from 'recharts';
import type { StrikeRow } from '@org/api';

interface Props {
  strikes: StrikeRow[];
  spot: number;
  callWall: number;
  putWall: number;
  gammaFlip: number;
  liveSpot?: number | null;
}

const fmtM = (v: number) => `${(v / 1e6).toFixed(1)}M`;

/**
 * Horizontal net-GEX profile: one bar per strike (green = net positive / call-dominated,
 * red = net negative / put-dominated), strikes high→low on the Y axis. Call/put walls are
 * drawn at full opacity; spot and gamma flip are dashed reference lines.
 */
export function GexProfileChart({ strikes, spot, callWall, putWall, gammaFlip, liveSpot }: Props) {
  const theme = useTheme();
  const green = theme.palette.success.main;
  const red = theme.palette.error.main;
  const slate = theme.palette.text.secondary; // neutral — DEX is positioning context, not direction

  const data = useMemo(() => {
    // A readable window around spot, but ALWAYS wide enough to include the walls it labels
    // (a round-number wall can sit just outside a fixed ±% band, which would crop the very
    // strike the chart names). Sorted high→low so high strikes sit on top.
    const lo = Math.min(spot * 0.88, putWall > 0 ? putWall : spot * 0.88);
    const hi = Math.max(spot * 1.12, callWall > 0 ? callWall : spot * 1.12);
    return strikes
      .filter((s) => s.strike >= lo && s.strike <= hi)
      .sort((a, b) => b.strike - a.strike);
  }, [strikes, spot, callWall, putWall]);

  // Snap a price to the nearest plotted strike so a category-axis reference line lands on a band.
  const nearest = (price: number) =>
    data.reduce(
      (best, s) => (Math.abs(s.strike - price) < Math.abs(best - price) ? s.strike : best),
      data[0]?.strike ?? price
    );

  if (!data.length) return null;

  // Per-strike DEX rides the same rows as GEX; show the series only when delta is present
  // (null chain-wide => omit the series, no error — GEX/profile unaffected).
  const hasDex = data.some((s) => s.net_dex != null);

  const LegendDot = ({ color, label }: { color: string; label: string }) => (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: color }} />
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Stack>
  );

  // Custom tooltip: GEX + (when present) DEX, Vol/OI and volume per strike, for auditability.
  // DEX is labeled distinctly because it is delta-exposure, a different unit from gamma GEX.
  const ProfileTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: StrikeRow }[] }) => {
    if (!active || !payload?.length) return null;
    const r = payload[0].payload;
    return (
      <Box sx={{ background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, px: 1.25, py: 0.75 }}>
        <Typography variant="caption" color="text.secondary">Strike ${r.strike}</Typography>
        <Typography variant="body2">Net GEX (gamma): ${fmtM(r.net_gex)}</Typography>
        {r.net_dex != null && <Typography variant="body2">Net DEX (delta): ${fmtM(r.net_dex)}</Typography>}
        {r.vol_oi_ratio != null && <Typography variant="body2">Vol/OI: {r.vol_oi_ratio.toFixed(2)}×</Typography>}
        {r.volume != null && <Typography variant="body2">Volume: {r.volume.toLocaleString()} contracts</Typography>}
      </Box>
    );
  };

  return (
    <Card variant="outlined" sx={{ mt: 3 }}>
      <CardContent>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap' }}>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <Typography variant="h6">GEX strike profile</Typography>
            <MuiTooltip arrow placement="top"
              title="Net dealer gamma at each strike. Green = call-dominated (resistance above price); red = put-dominated (support below). Dashed lines mark the spot, the gamma flip, and the live price.">
              <InfoOutlinedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
            </MuiTooltip>
          </Stack>
          <Stack direction="row" spacing={2}>
            <LegendDot color={green} label="Call-dominated (net +)" />
            <LegendDot color={red} label="Put-dominated (net −)" />
            {hasDex && <LegendDot color={slate} label="Net DEX (delta)" />}
          </Stack>
        </Stack>
        <ResponsiveContainer width="100%" height={Math.max(360, data.length * 22)}>
          <BarChart layout="vertical" data={data} margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
            <XAxis xAxisId="gex" type="number" tickFormatter={fmtM} stroke={theme.palette.text.secondary} />
            {/* Secondary axis for DEX — different unit (delta vs gamma) → its own scale, drawn on top. */}
            {hasDex && (
              <XAxis xAxisId="dex" type="number" orientation="top" tickFormatter={fmtM} stroke={slate} />
            )}
            <YAxis
              type="category" dataKey="strike" width={56}
              tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
            />
            <Tooltip cursor={{ fill: theme.palette.action.hover }} content={<ProfileTooltip />} />
            <ReferenceLine xAxisId="gex" x={0} stroke={theme.palette.divider} />
            <ReferenceLine
              y={nearest(spot)} stroke={theme.palette.primary.main} strokeDasharray="4 3"
              label={{ value: `spot $${spot.toFixed(0)}`, position: 'right', fontSize: 11, fill: theme.palette.primary.main }}
            />
            <ReferenceLine
              y={nearest(gammaFlip)} stroke={theme.palette.warning.main} strokeDasharray="4 3"
              label={{ value: `flip $${gammaFlip.toFixed(0)}`, position: 'right', fontSize: 11, fill: theme.palette.warning.main }}
            />
            {liveSpot != null && liveSpot > 0 && (
              <ReferenceLine
                y={nearest(liveSpot)} stroke={theme.palette.info.main} strokeWidth={2}
                label={{ value: `live $${liveSpot.toFixed(0)}`, position: 'right', fontSize: 11, fill: theme.palette.info.main }}
              />
            )}
            <Bar dataKey="net_gex" name="Net GEX" xAxisId="gex" isAnimationActive={false}>
              {data.map((s) => (
                <Cell
                  key={s.strike}
                  fill={s.net_gex >= 0 ? green : red}
                  fillOpacity={s.strike === callWall || s.strike === putWall ? 1 : 0.82}
                  stroke={s.strike === callWall || s.strike === putWall ? theme.palette.common.white : 'none'}
                  strokeWidth={s.strike === callWall || s.strike === putWall ? 1 : 0}
                />
              ))}
            </Bar>
            {/* Net DEX series — single neutral color (no directional green/red). */}
            {hasDex && (
              <Bar dataKey="net_dex" name="Net DEX (delta)" xAxisId="dex"
                fill={slate} fillOpacity={0.5} isAnimationActive={false} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default GexProfileChart;
