/**
 * The Wilson score interval for a hit rate: how sure a calibration bin can be, given how many calls
 * it holds. Unlike the normal approximation it stays inside 0–1 and doesn't collapse to a point when
 * every call in a bin came true (or none did), which is exactly when a small bin needs it most.
 *
 *   p̂ = k / n,  centre = (p̂ + z²/2n) / (1 + z²/n),
 *   half-width = z · √(p̂(1 − p̂)/n + z²/4n²) / (1 + z²/n),  z = 1.96 for 95%.
 *
 * Design: design/src/data/charts.mjs `wilson`. wilson.spec.ts checks it against hand-worked values.
 */
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  // No calls: nothing is known, so the interval is all of it.
  if (n <= 0) return [0, 1];
  const p = k / n;
  const z2 = z * z;
  const d = 1 + z2 / n;
  const c = p + z2 / (2 * n);
  const m = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return [clamp((c - m) / d), clamp((c + m) / d)];
}
