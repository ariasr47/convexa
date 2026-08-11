/**
 * Distance-to-spot secondary line for level StatTiles (Call/Put wall, Max pain, Gamma flip).
 * Display-only: pure projection from (level, spot). Never recolors direction of P/L —
 * green/red stay reserved for signed flow/gamma/P&L per DESIGN_SYSTEM.
 *
 * Format (examples): `+$10 · 4.0% above` · `−$10 · 4.0% below` · `at spot`
 * Dollar sign uses figure minus (U+2212) for negative, matching `fmtUsdCompact`.
 */

/** Anchor for levels: prefer structure spot, fall back to mid/price. */
export function levelSpot(m: { gex_spot?: number | null; price?: number | null }): number | null {
  const s = m.gex_spot ?? m.price;
  return s == null || !Number.isFinite(s) ? null : s;
}

/**
 * Human secondary line: how far `level` is from `spot`.
 * Returns `null` when either input is missing/non-finite (caller omits secondary).
 */
export function distanceToLevel(
  level: number | null | undefined,
  spot: number | null | undefined,
): string | null {
  if (level == null || spot == null) return null;
  if (!Number.isFinite(level) || !Number.isFinite(spot) || spot === 0) return null;

  const delta = level - spot;
  if (Math.abs(delta) < 1e-9) return 'at spot';

  const abs = Math.abs(delta);
  const pct = (abs / Math.abs(spot)) * 100;
  const sign = delta > 0 ? '+' : '−';
  const side = delta > 0 ? 'above' : 'below';
  // Walls are whole-dollar strikes in practice; keep cents only when the gap is small.
  const dollar = abs >= 10 ? abs.toFixed(0) : abs < 1 ? abs.toFixed(2) : abs.toFixed(1);
  return `${sign}$${dollar} · ${pct.toFixed(1)}% ${side}`;
}
