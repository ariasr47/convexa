import { useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import { Card, CardContent, Typography, Stack, Box, Tooltip as MuiTooltip } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, ReferenceLine, Tooltip,
} from 'recharts';
import type { StrikeRow } from '@org/api';
import { typographyTokens } from './tokens';

interface Props {
  strikes: StrikeRow[];
  spot: number;
  callWall: number;
  putWall: number;
  gammaFlip: number;
  liveSpot?: number | null;
}

const MONO = typographyTokens.monoFontFamily;
const fmtM = (v: number) => `$${(v / 1e6).toFixed(1)}M`;

/**
 * GEX strike profile — a vertical diverging bar chart of net dealer gamma by strike: strikes spread
 * across the X-axis (low→high), net GEX as bars from a zero baseline — green = call-dominated (net +,
 * up), red = put-dominated (net −, down). Call/put walls are full-opacity with a white hairline; spot
 * / gamma flip / live price are dashed reference lines. Wide + compact (uses horizontal space, short
 * height); each bar hovers a per-strike tooltip (GEX · DEX · Vol/OI · volume).
 */
export function GexProfileChart({ strikes, spot, callWall, putWall, gammaFlip, liveSpot }: Props) {
  const theme = useTheme();
  const green = theme.palette.success.main;
  const red = theme.palette.error.main;

  const data = useMemo(() => {
    // A readable window around spot, always wide enough to include the walls it labels.
    const lo = Math.min(spot * 0.9, putWall > 0 ? putWall : spot * 0.9);
    const hi = Math.max(spot * 1.1, callWall > 0 ? callWall : spot * 1.1);
    return strikes.filter((s) => s.strike >= lo && s.strike <= hi).sort((a, b) => a.strike - b.strike);
  }, [strikes, spot, callWall, putWall]);

  if (!data.length) return null;

  // Snap a price to the nearest plotted strike so a category-axis reference line lands on a bar.
  const nearest = (price: number) =>
    data.reduce((best, s) => (Math.abs(s.strike - price) < Math.abs(best - price) ? s.strike : best), data[0].strike);

  const isWall = (k: number) => k === callWall || k === putWall;

  const LegendDot = ({ color, label }: { color: string; label: string }) => (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: color }} />
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
    </Stack>
  );

  const ProfileTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: StrikeRow }[] }) => {
    if (!active || !payload?.length) return null;
    const r = payload[0].payload;
    return (
      <Box sx={{ background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, px: 1.25, py: 0.75 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>Strike ${r.strike}</Typography>
        <Typography variant="body2">Net GEX (gamma): {fmtM(r.net_gex)}</Typography>
        {r.net_dex != null && <Typography variant="body2">Net DEX (delta): {fmtM(r.net_dex)}</Typography>}
        {r.vol_oi_ratio != null && <Typography variant="body2">Vol/OI: {r.vol_oi_ratio.toFixed(2)}×</Typography>}
        {r.volume != null && <Typography variant="body2">Volume: {r.volume.toLocaleString()} contracts</Typography>}
      </Box>
    );
  };

  // De-collide the three reference-line labels: each gets a fixed vertical slot above the plot so
  // they stay legible even when two lines snap to the same/adjacent strike (higher slot = higher row).
  const refLabel = (text: string, color: string, slot: number) =>
    ({ value: text, position: 'top' as const, dy: -slot * 12, fontSize: 10, fill: color, fontFamily: MONO });

  return (
    <Card variant="outlined" sx={{ mt: 3, borderRadius: 3 }}>
      <CardContent>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', rowGap: 0.5 }}>
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
          </Stack>
        </Stack>

        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 42, right: 8, left: 0, bottom: 0 }} barCategoryGap="14%">
            <XAxis
              dataKey="strike" type="category" tickFormatter={(v) => `$${v}`} interval="preserveStartEnd" minTickGap={28}
              tick={{ fontSize: 10, fill: theme.palette.text.disabled, fontFamily: MONO }} stroke={theme.palette.divider} tickLine={false}
            />
            <YAxis
              tickFormatter={fmtM} width={50} tick={{ fontSize: 10, fill: theme.palette.text.secondary }}
              stroke={theme.palette.divider} tickLine={false} axisLine={false}
            />
            <Tooltip cursor={{ fill: theme.palette.action.hover }} content={<ProfileTooltip />} />
            <ReferenceLine y={0} stroke={theme.palette.divider} />
            <ReferenceLine x={nearest(spot)} stroke={theme.palette.primary.main} strokeDasharray="4 3" label={refLabel(`spot $${spot.toFixed(0)}`, theme.palette.primary.main, 0)} />
            <ReferenceLine x={nearest(gammaFlip)} stroke={theme.palette.warning.main} strokeDasharray="4 3" label={refLabel('flip', theme.palette.warning.main, 1)} />
            {liveSpot != null && liveSpot > 0 && (
              <ReferenceLine x={nearest(liveSpot)} stroke={theme.palette.info.main} strokeWidth={2} label={refLabel('live', theme.palette.info.main, 2)} />
            )}
            <Bar dataKey="net_gex" name="Net GEX" radius={[2, 2, 0, 0]} isAnimationActive={false}>
              {data.map((s) => (
                <Cell
                  key={s.strike}
                  fill={s.net_gex >= 0 ? green : red}
                  fillOpacity={isWall(s.strike) ? 1 : 0.82}
                  stroke={isWall(s.strike) ? theme.palette.common.white : 'none'}
                  strokeWidth={isWall(s.strike) ? 1 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default GexProfileChart;
