/**
 * Money as a filing tagged it. The wire's `unit` is the XBRL unit the filer used: 'USD', another ISO
 * currency ('TWD' for TSMC's IFRS revenue), or a per-share form ('USD/shares'). A foreign filer's
 * figures arrive in its own currency, so the label comes from the unit, never from an assumed '$':
 * a wrong currency on a money figure is silent and off by the exchange rate.
 */

const ISO = /^[A-Z]{3}$/;

/** '$' for US dollars, 'TWD ' for another ISO currency, null for a unit that isn't money. */
export function currencyPrefix(unit: string): string | null {
  const code = unit.split('/')[0].trim();
  if (code === 'USD') return '$';
  return ISO.test(code) ? `${code} ` : null;
}

const perShare = (unit: string) => /\/shares?$/i.test(unit);
const minus = (v: number) => (v < 0 ? '−' : '');
const grouped = (v: number, min: number, max: number) =>
  v.toLocaleString('en-US', { minimumFractionDigits: min, maximumFractionDigits: max });

/** In billions at a fixed precision: '$96.2B', 'TWD 2,894.3B'. */
export function formatBillions(v: number, unit: string, digits = 1): string {
  return `${minus(v)}${currencyPrefix(unit) ?? ''}${grouped(Math.abs(v) / 1e9, digits, digits)}B`;
}

/** A reported figure at a readable scale: '$96.2B', '$885.4M', '$2.31' per share, 'TWD 12.55'. */
export function formatFiled(v: number, unit: string): string {
  const prefix = currencyPrefix(unit) ?? '';
  const a = Math.abs(v);
  if (perShare(unit)) return `${minus(v)}${prefix}${a.toFixed(2)}`;
  if (a >= 1e9) return `${minus(v)}${prefix}${grouped(a / 1e9, 0, 2)}B`;
  if (a >= 1e6) return `${minus(v)}${prefix}${grouped(a / 1e6, 0, 1)}M`;
  return `${minus(v)}${prefix}${grouped(a, 0, 0)}`;
}

/** The unit as a chart's sub-line says it: '$ billions', 'TWD billions'. */
export function billionsWord(unit: string): string {
  const prefix = currencyPrefix(unit);
  return prefix ? `${prefix.trim()} billions` : 'billions';
}

/**
 * One unit for a whole series. A filer that switched currency (or a mixed answer) would otherwise
 * draw bars in two currencies on one axis. Keeps the years in the unit most years use; a tie goes to
 * USD, then to the alphabetically first code, so the choice never depends on input order.
 */
export function inOneUnit<T extends { unit: string }>(rows: T[]): T[] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.unit, (counts.get(r.unit) ?? 0) + 1);
  if (counts.size <= 1) return rows;
  const [unit] = [...counts.entries()].sort(
    ([a, n], [b, m]) =>
      m - n || Number(b === 'USD') - Number(a === 'USD') || (a < b ? -1 : a > b ? 1 : 0),
  )[0];
  return rows.filter((r) => r.unit === unit);
}

/**
 * Axis ticks from zero past `max` on a 1, 2 or 5 × 10ⁿ step, about `target` intervals: readable at
 * any magnitude (a $40B filer and a NT$3.8T one), never more than target + 1 ticks.
 */
export function niceTicks(max: number, target = 5): number[] {
  if (!(max > 0) || !Number.isFinite(max)) return [0, 1];
  const raw = max / target;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 5, 10].find((m) => m * p >= raw) ?? 10) * p;
  const top = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let i = 0; i * step <= top + step * 1e-9; i++)
    ticks.push(Number((i * step).toPrecision(12)));
  return ticks;
}
