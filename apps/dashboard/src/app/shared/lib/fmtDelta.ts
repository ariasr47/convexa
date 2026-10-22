/**
 * Compact neutral delta label: ↑2 · ↓1.5. Arrows only, never green/red, and nothing for zero.
 * Shared by the scanner's poll deltas and the ticker desk's structure-history path deltas.
 */
export function fmtDelta(n: number, digits = 0): string {
  const abs = Math.abs(n);
  const body = digits > 0 ? abs.toFixed(digits) : String(Math.round(abs));
  if (n > 0) return `↑${body}`;
  if (n < 0) return `↓${body}`;
  return '';
}
