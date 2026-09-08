/**
 * Distance-to-spot secondary line for level StatTiles (Call/Put wall, Max pain, Gamma flip).
 * Display-only: pure projection from (level, spot). Never recolors direction of P/L —
 * green/red stay reserved for signed flow/gamma/P&L per DESIGN_SYSTEM.
 *
 * Two renderings of the SAME projection (`projectDistance`, private):
 *   - `distanceToLevel` — the full line: `+$10 · 4.0% above` · `−$10 · 4.0% below` · `at spot`.
 *     Dollar sign uses figure minus (U+2212) for negative, matching `fmtUsdCompact`. Unchanged by
 *     the ticker fidelity repair — `LiveTape.tsx`'s gamma-flip caption still uses this full form.
 *   - `distancePercentOnly` (F10 hero residual, ticker fidelity repair change 6) — the design's bare
 *     ladder distance: `+4.0%` · `−4.0%` · `at spot`. `ladderModel.ts` uses this for the ladder's
 *     visible distance column; the full line moves to that row's `title` attribute instead.
 */

/** Anchor for levels: prefer structure spot, fall back to mid/price. */
export function levelSpot(m: { gex_spot?: number | null; price?: number | null }): number | null {
  const s = m.gex_spot ?? m.price;
  return s == null || !Number.isFinite(s) ? null : s;
}

/** The shared delta/percent/sign projection both `distanceToLevel` and `distancePercentOnly`
 *  build on — one computation, two renderings, never two independently-drifting formulas. */
function projectDistance(
  level: number,
  spot: number,
): { abs: number; pct: number; sign: '+' | '−'; side: 'above' | 'below' } | 'at-spot' {
  const delta = level - spot;
  if (Math.abs(delta) < 1e-9) return 'at-spot';
  const abs = Math.abs(delta);
  return {
    abs,
    pct: (abs / Math.abs(spot)) * 100,
    sign: delta > 0 ? '+' : '−',
    side: delta > 0 ? 'above' : 'below',
  };
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

  const p = projectDistance(level, spot);
  if (p === 'at-spot') return 'at spot';
  // Walls are whole-dollar strikes in practice; keep cents only when the gap is small.
  const dollar = p.abs >= 10 ? p.abs.toFixed(0) : p.abs < 1 ? p.abs.toFixed(2) : p.abs.toFixed(1);
  return `${p.sign}$${dollar} · ${p.pct.toFixed(1)}% ${p.side}`;
}

/**
 * Ticker fidelity repair, change 6 (F10 hero residual) — the design's bare ladder distance
 * (`design/src/screens/desk.mjs:320`'s `dist: '−0.81%'`, no dollar, no "above"/"below" word): the
 * SAME `level`/`spot` inputs `distanceToLevel` takes, the signed percentage ONLY. `distanceToLevel`
 * itself is UNCHANGED (LiveTape.tsx's gamma-flip caption keeps the full form — out of this repair's
 * scope) — this is a second rendering of the SAME shared projection, not a second formula.
 */
export function distancePercentOnly(
  level: number | null | undefined,
  spot: number | null | undefined,
): string | null {
  if (level == null || spot == null) return null;
  if (!Number.isFinite(level) || !Number.isFinite(spot) || spot === 0) return null;

  const p = projectDistance(level, spot);
  if (p === 'at-spot') return 'at spot';
  return `${p.sign}${p.pct.toFixed(1)}%`;
}
