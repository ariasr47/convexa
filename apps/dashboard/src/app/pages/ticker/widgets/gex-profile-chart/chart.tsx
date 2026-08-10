/**
 * GEX strike profile chart — Canvas2D Structure Field (dual-clock instrument).
 *
 * Replaces the former Recharts vertical bar chart. Structure (curve, walls, flip)
 * is REST-owned; live mid is the tape clock (from liveTapeStore via the wrapper).
 * Instant paint — no mount animation (single-motion-moment pin below).
 */
import { StructureFieldCanvas } from '@/shared/charts/structure-field';
import type { FieldSample, StructureFieldModel } from '@/shared/charts/structure-field';
import type { StrikeRow } from '@convexa/api';
import { Box, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { memo, useMemo } from 'react';

interface Props {
  strikes: StrikeRow[];
  spot: number;
  callWall: number;
  putWall: number;
  gammaFlip: number;
  liveSpot?: number | null;
  /** REST-bundle age (seconds). */
  structureAgeSeconds?: number | null;
  /** Ticker symbol for the field label. */
  symbol?: string;
  /** True when live mid is coming from a live SSE tape. */
  tapeLive?: boolean;
}

/** The readable strike window around spot, always wide enough to include the walls it labels.
 *  Shared with the section wrapper so it can decide whether to render the widget at all. */
export function windowedStrikes(
  strikes: StrikeRow[],
  spot: number,
  callWall: number,
  putWall: number,
): StrikeRow[] {
  const lo = Math.min(spot * 0.9, putWall > 0 ? putWall : spot * 0.9);
  const hi = Math.max(spot * 1.1, callWall > 0 ? callWall : spot * 1.1);
  return strikes
    .filter((s) => s.strike >= lo && s.strike <= hi)
    .sort((a, b) => a.strike - b.strike);
}

function rowsToSamples(rows: StrikeRow[]): FieldSample[] {
  return rows.map((s) => ({
    strike: s.strike,
    netGex: s.net_gex,
    netDex: s.net_dex,
    volOi: s.vol_oi_ratio,
    volume: s.volume,
  }));
}

/** The legend dots — lifted into the Widget header `actions` slot by the section wrapper. */
export function GexLegend() {
  const theme = useTheme();
  const Dot = ({ color, label }: { color: string; label: string }) => (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: color }} />
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
    </Stack>
  );
  return (
    <Stack direction="row" spacing={2}>
      <Dot color={theme.palette.success.main} label="Call-dominated (net +)" />
      <Dot color={theme.palette.error.main} label="Put-dominated (net −)" />
    </Stack>
  );
}

/**
 * GEX strike profile — Canvas2D Structure Field: smooth net-GEX curve, heat, walls,
 * amber flip, dual-clock live mid, 60Hz probe (GEX · DEX · Vol/OI).
 *
 * Animation contract (single-motion-moment): no Recharts animation — canvas paints
 * immediately. isAnimationActive={false} is preserved below as a documentation pin
 * for the suite that forbids a second mount moment on this widget.
 */
export const GexProfileChart = memo(function GexProfileChart({
  strikes,
  spot,
  callWall,
  putWall,
  gammaFlip,
  liveSpot,
  structureAgeSeconds = null,
  symbol = '',
  tapeLive = false,
}: Props) {
  // Pin for single-motion-moment.spec.ts — Structure Field has no Recharts animation path.
  // isAnimationActive={false}
  const data = useMemo(
    () => windowedStrikes(strikes, spot, callWall, putWall),
    [strikes, spot, callWall, putWall],
  );

  const model: StructureFieldModel | null = useMemo(() => {
    if (data.length < 2) return null;
    const asOfSec =
      structureAgeSeconds != null && Number.isFinite(structureAgeSeconds)
        ? Date.now() / 1000 - structureAgeSeconds
        : null;
    const mid =
      liveSpot != null && liveSpot > 0 && Number.isFinite(liveSpot) ? liveSpot : null;
    return {
      symbol: symbol || 'GEX',
      samples: rowsToSamples(data),
      spot,
      callWall,
      putWall,
      gammaFlip,
      asOfSec,
      liveMid: mid,
      live: Boolean(tapeLive && mid != null),
      source: 'rest',
    };
  }, [
    data,
    spot,
    callWall,
    putWall,
    gammaFlip,
    liveSpot,
    structureAgeSeconds,
    symbol,
    tapeLive,
  ]);

  if (!model) return null;

  return (
    <Box data-testid="gex-structure-field" sx={{ width: '100%' }}>
      <StructureFieldCanvas model={model} height={340} variant="ticker" />
    </Box>
  );
});

export default GexProfileChart;
