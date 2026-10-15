/**
 * Chart roles (canon P-9, owner ruling 2026-10-14). Charts are neutral and ordinal: the claim's series
 * is `emph`; context steps down through `ctx` and then `ctx2`; a range is a `band` wash whose `edge`
 * hairlines and labels carry it. Green and red stay reserved for money moving (P&L, flow, gamma
 * sign) and never carry a sign alone (P-11): position or a signed label does too. Amber is spent
 * (the focus ring only), so it is no role here.
 *
 * Design: design/src/chart-kit.mjs (CHART_CSS --c-* roles).
 */
import { extrasFor } from '@/shared/theme/tokens';
import { alpha, type Theme } from '@mui/material/styles';

export interface ChartRoles {
  /** The claim's series: phosphor. */
  emph: string;
  /** First context step: steel. */
  ctx: string;
  /** Second context step: the older comparison. */
  ctx2: string;
  /** A range wash; never the only carrier. */
  band: string;
  /** A band's edges and other hairline marks (steel2). */
  edge: string;
  /** Gridlines. */
  grid: string;
  /** The zero line and axes. */
  axis: string;
  /** Money moving up / down: fills only, always with position or a signed label. */
  up: string;
  down: string;
}

export function chartRoles(t: Theme): ChartRoles {
  const x = extrasFor(t);
  return {
    emph: t.palette.text.primary,
    ctx: t.palette.text.secondary,
    ctx2: x.chartContext2,
    band: x.chartBand,
    edge: x.textTertiary,
    grid: alpha(t.palette.text.secondary, 0.14),
    axis: x.lineStrong,
    up: t.palette.success.main,
    down: t.palette.error.main,
  };
}
