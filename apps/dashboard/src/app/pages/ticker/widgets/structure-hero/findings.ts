/**
 * The structure hero's findings (canon P-10: a chart's title states its finding when it has data,
 * and names its metric otherwise). Each sentence is assembled from the bundle's own levels and the
 * API's regime word; the sign rides in words and ±γ, never in hue (P-11).
 */

const ok = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);
const pct = (from: number, to: number) => Math.abs(((to - from) / from) * 100).toFixed(1);

/** The field's metric, the title whenever there is no finding to state. */
export const FIELD_METRIC = 'Net dealer gamma by strike';

/**
 * "Dealers are long gamma (+γ): spot 690.62 sits 1.0% above the 683.92 flip". The regime is the
 * API's (`signals.regime`), the side and distance come from the levels anchor and the flip. Without
 * a regime there is no finding: the metric. Without a flip, the regime alone.
 */
export function heroFinding({
  regime,
  spot,
  flip,
}: {
  regime: string | null | undefined;
  spot: number | null | undefined;
  flip: number | null | undefined;
}): string {
  if (regime !== 'positive_gamma' && regime !== 'negative_gamma') return FIELD_METRIC;
  const lead =
    regime === 'positive_gamma' ? 'Dealers are long gamma (+γ)' : 'Dealers are short gamma (−γ)';
  if (!ok(spot) || !ok(flip) || flip <= 0) return `${lead} at this snapshot`;
  if (spot === flip) return `${lead}: spot ${spot.toFixed(2)} sits on the flip`;
  return `${lead}: spot ${spot.toFixed(2)} sits ${pct(flip, spot)}% ${spot > flip ? 'above' : 'below'} the ${flip.toFixed(2)} flip`;
}

/**
 * The ladder's one-line finding, distances from the levels anchor: "The flip is 1.0% below; the
 * walls sit 1.9% above and 5.6% below". `null` without an anchor (the ladder then states only its
 * rows, as before).
 */
export function ladderFinding({
  anchor,
  flip,
  callWall,
  putWall,
}: {
  anchor: number | null | undefined;
  flip: number | null | undefined;
  callWall: number | null | undefined;
  putWall: number | null | undefined;
}): string | null {
  if (!ok(anchor) || anchor <= 0) return null;
  const side = (v: number) => (v > anchor ? 'above' : v < anchor ? 'below' : 'at spot');
  const dist = (v: number) => (v === anchor ? 'at spot' : `${pct(anchor, v)}% ${side(v)}`);
  const parts: string[] = [];
  if (ok(flip)) parts.push(`the flip is ${dist(flip)}`);
  if (ok(callWall) && ok(putWall) && callWall > anchor && putWall < anchor)
    parts.push(`the walls sit ${pct(anchor, callWall)}% above and ${pct(anchor, putWall)}% below`);
  else {
    if (ok(callWall)) parts.push(`the call wall is ${dist(callWall)}`);
    if (ok(putWall)) parts.push(`the put wall is ${dist(putWall)}`);
  }
  if (parts.length === 0) return null;
  const text = parts.join('; ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
