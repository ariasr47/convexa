/**
 * What a note's chart block says only in words, read back as numbers for the plot: the unit in its
 * caption ("Quarterly revenue, $M") and a guidance range in a bar's label ("61,500 ± 1,500",
 * "$3.45–3.60B"). Both feed what readers see — the unit on the axis, the range as a whisker — so a
 * wrong read draws a wrong figure. Anything that doesn't parse cleanly gives null, and the chart then
 * draws without it (no unit on the top tick; the guidance as its midpoint with the label in words).
 */

export interface Unit {
  pre: string;
  suf: string;
}

const UNITS: [RegExp, Unit][] = [
  [/,\s*NT\$ billions\b/, { pre: 'NT$', suf: 'B' }],
  [/,\s*\$M\b/, { pre: '$', suf: 'M' }],
  [/,\s*\$B\b/, { pre: '$', suf: 'B' }],
  [/,\s*%(?=[\s,(]|$)/, { pre: '', suf: '%' }],
  [/,\s*millions\b/, { pre: '', suf: 'M' }],
];

/** The unit a caption names after a comma ("…, $M", "…, %"), or null. */
export function captionUnit(caption: string | null): Unit | null {
  if (!caption) return null;
  for (const [re, unit] of UNITS) if (re.test(caption)) return unit;
  return null;
}

/** A plain number for chart text: thousands separated, a true minus. */
export function fmt(n: number): string {
  const s = Math.abs(n).toLocaleString('en-US', {
    maximumFractionDigits: Math.abs(n) < 10 && n !== Math.round(n) ? 2 : 1,
  });
  return n < 0 ? `−${s}` : s;
}

/** A number in its unit: −$1,393M, 46.8%, NT$1,494.3B. */
export function fmtIn(n: number, unit: Unit | null): string {
  if (!unit) return fmt(n);
  const s = `${unit.pre}${fmt(Math.abs(n))}${unit.suf}`;
  // A word joiner keeps the minus on the same line as "$" when a title wraps.
  return n < 0 ? `−\u2060${s}` : s;
}

const NUM = String.raw`(\d[\d,]*(?:\.\d+)?)\s*([BM])?`;
const num = (s: string, suffix?: string) =>
  Number(s.replace(/,/g, '')) * (suffix === 'B' ? 1e9 : suffix === 'M' ? 1e6 : 1);

/**
 * The low and high of a guidance label, in the bar's own unit, or null. Reads "A–B" and "C ± D" (D may
 * be a percent of C); a "B" or "M" suffix ("$3.45–3.60B" on a $M chart) is reconciled by keeping the
 * one scale whose range contains the bar's midpoint, so a label that disagrees with its bar draws no
 * whisker rather than a wrong one.
 */
export function guideRange(shown: string, value: number): { lo: number; hi: number } | null {
  const text = shown.replace(/[~$]/g, '').replace(/NT/g, '');
  let lo: number;
  let hi: number;
  const pm = new RegExp(`${NUM}\\s*±\\s*${NUM}\\s*(%)?`).exec(text);
  const dash = new RegExp(`${NUM}\\s*[–-]\\s*${NUM}`).exec(text);
  if (pm) {
    const centre = num(pm[1], pm[2]);
    const d = pm[5] ? centre * (Number(pm[3].replace(/,/g, '')) / 100) : num(pm[3], pm[4] ?? pm[2]);
    lo = centre - d;
    hi = centre + d;
  } else if (dash) {
    // "$3.45–3.60B": the suffix written once, at the end, applies to both ends.
    const suffix = dash[4] ?? dash[2];
    lo = num(dash[1], dash[2] ?? suffix);
    hi = num(dash[3], suffix);
  } else return null;
  if (!(hi > lo)) return null;
  // The label's scale against the chart's: the one where the range holds the bar.
  for (const f of [1, 1e-3, 1e-6, 1e-9]) {
    const a = lo * f;
    const b = hi * f;
    const tol = (b - a) * 1e-6;
    if (a - tol <= value && value <= b + tol) return { lo: a, hi: b };
  }
  return null;
}
