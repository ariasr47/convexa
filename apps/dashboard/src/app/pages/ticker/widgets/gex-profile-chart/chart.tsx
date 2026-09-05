/**
 * GEX strike profile chart — Canvas2D Structure Field (dual-clock instrument).
 *
 * Replaces the former Recharts vertical bar chart. Structure (curve, walls, flip)
 * is REST-owned; live mid is the tape clock (from liveTapeStore via the wrapper).
 * Instant paint — no mount animation (single-motion-moment pin below).
 */
import type { FieldSample, StructureFieldModel } from '@/shared/charts/structure-field';
import { StructureFieldCanvas } from '@/shared/charts/structure-field';
import { resolveLevelPalette } from '@/shared/charts/structure-field/levelStrokes';
import { andPresent, NOT_LIVE, type LiveClaim } from '@/shared/liveness/liveClaim';
import { extrasFor } from '@/shared/theme/tokens';
import type { StrikeRow } from '@convexa/api';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
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
  /** The branded delivering claim (SPEC §2.1) — never a hand-rolled boolean. */
  tapeLive?: LiveClaim;
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
    .toSorted((a, b) => a.strike - b.strike);
}

/** Exported so `structure-hero/StructureHeroPanel.tsx` can build the SAME `StructureFieldModel`
 *  shape directly (it renders `StructureFieldCanvas` itself, not through this file's own
 *  `GexProfileChart` — see that file's module doc for why the palette/surfaces IDENTITY the ladder
 *  shares with the canvas rules out routing through a component that resolves its own theme). */
export function rowsToSamples(rows: StrikeRow[]): FieldSample[] {
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
  tapeLive = NOT_LIVE,
}: Props) {
  // Pin for single-motion-moment.spec.ts — Structure Field has no Recharts animation path.
  // isAnimationActive={false}
  const data = useMemo(
    () => windowedStrikes(strikes, spot, callWall, putWall),
    [strikes, spot, callWall, putWall],
  );

  // The canvas paints to Canvas2D and cannot consume MUI `sx`/`useTheme()` itself (SPEC §2.7) —
  // this host resolves token keys → colours and hands the RESOLVED, scheme-aware values down as
  // props. `palette` is the shared ladder/field stroke table (criterion 7); `surfaces` replaces the
  // canvas's former unconditional dark fills (criteria 52/53, DELEGATED P5).
  const theme = useTheme();
  const palette = useMemo(() => resolveLevelPalette(theme), [theme]);
  const surfaces = useMemo(
    () => ({
      ink: theme.palette.background.default,
      panel: theme.palette.background.paper,
      raised: extrasFor(theme).panelRaised,
      phosphor: theme.palette.text.primary,
      steel: theme.palette.text.secondary,
      warning: theme.palette.warning.main,
    }),
    [theme],
  );

  const model: StructureFieldModel | null = useMemo(() => {
    if (data.length < 2) return null;
    const asOfSec =
      structureAgeSeconds != null && Number.isFinite(structureAgeSeconds)
        ? Date.now() / 1000 - structureAgeSeconds
        : null;
    const mid = liveSpot != null && liveSpot > 0 && Number.isFinite(liveSpot) ? liveSpot : null;
    return {
      symbol: symbol || 'GEX',
      samples: rowsToSamples(data),
      spot,
      callWall,
      putWall,
      gammaFlip,
      asOfSec,
      liveMid: mid,
      // `andPresent` (SPEC §2.1) — never a hand-rolled `Boolean(x && y != null)` chain. The model's
      // own `live` field is a plain `boolean` (`shared/charts/structure-field/types.ts`, out of this
      // task's owned files), but a `LiveClaim` widens to it safely; the fabrication this replaces
      // was the composition, not the field's type.
      live: andPresent(tapeLive, mid),
      source: 'rest',
    };
  }, [data, spot, callWall, putWall, gammaFlip, liveSpot, structureAgeSeconds, symbol, tapeLive]);

  if (!model) return null;

  return (
    <Box
      data-testid="gex-structure-field"
      sx={{ width: '100%', borderRadius: '0 0 11px 11px', overflow: 'hidden' }}
    >
      <StructureFieldCanvas
        model={model}
        height={300}
        variant="ticker"
        palette={palette}
        surfaces={surfaces}
      />
    </Box>
  );
});

export default GexProfileChart;
