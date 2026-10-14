// Sample data for the v5 chart boards (2026-10-13). Every value here is an ILLUSTRATIVE design value,
// generated deterministically (seeded) so boards never change between builds. Shapes follow the public
// sources the app reads (U.S. Treasury par yield curve, CFTC Traders in Financial Futures, FINRA short
// interest and Reg SHO daily short volume, SEC EDGAR), but no number below is a real observation.
// Boards that draw these say so ("Illustrative values" / the Sample treatment in a demo).

export function rng(seed = 7) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const round = (v, dp = 2) => Math.round(v * 10 ** dp) / 10 ** dp;

// ---- calendar: 2025-10-13 → 2026-10-09, business days (no holiday calendar: illustrative) -------
const DAY = 86400000;
const START = Date.UTC(2025, 9, 13);
export const DAYS = [];
for (let t = START; t <= Date.UTC(2026, 9, 9); t += DAY) { const d = new Date(t).getUTCDay(); if (d !== 0 && d !== 6) DAYS.push(t); }
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dLabel = (t) => { const d = new Date(t); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`; };
export const dLong = (t) => { const d = new Date(t); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; };
export const monthStarts = () => { const out = []; let m = -1; DAYS.forEach((t, i) => { const mm = new Date(t).getUTCMonth(); if (mm !== m) { out.push({ i, t, m: mm, y: new Date(t).getUTCFullYear() }); m = mm; } }); return out; };

// ---- yields: a year of daily par yields at 11 tenors ------------------------------------------
export const TENORS = [['1M', 1 / 12], ['3M', 0.25], ['6M', 0.5], ['1Y', 1], ['2Y', 2], ['3Y', 3], ['5Y', 5], ['7Y', 7], ['10Y', 10], ['20Y', 20], ['30Y', 30]];
// level / slope / curvature factors drifting over the year (Nelson–Siegel shape), plus small noise
function nsYield(level, slope, curv, tau) { const l = 1.6; const a = (1 - Math.exp(-tau / l)) / (tau / l); return level + slope * a + curv * (a - Math.exp(-tau / l)); }
const r = rng(11);
let L = 4.42, S = -0.55, C = -0.9;
export const CURVES = DAYS.map((t, i) => {
  // a slow path: front end eases ~60 bp over the year (cuts priced), long end sticky → steepening
  L += (4.50 - L) * 0.004 + (r() - 0.5) * 0.028;
  S += (-1.05 - S) * 0.006 + (r() - 0.5) * 0.03;
  C += (-0.6 - C) * 0.004 + (r() - 0.5) * 0.04;
  const ys = TENORS.map(([, tau]) => round(nsYield(L, S, C, tau) + (r() - 0.5) * 0.01, 2));
  return { t, i, ys };
});
// a data gap: the source didn't publish on two days (shown as a gap, never interpolated)
export const CURVE_GAPS = [168, 169];
const ix = (k) => TENORS.findIndex(([n]) => n === k);
export const spread2s10s = CURVES.map((c) => (CURVE_GAPS.includes(c.i) ? null : round(c.ys[ix('10Y')] - c.ys[ix('2Y')], 2)));
export const y10 = CURVES.map((c) => (CURVE_GAPS.includes(c.i) ? null : c.ys[ix('10Y')]));
export const y2 = CURVES.map((c) => (CURVE_GAPS.includes(c.i) ? null : c.ys[ix('2Y')]));
export const latestCurve = CURVES[CURVES.length - 1];
export const curveAgo = (days) => CURVES[Math.max(0, CURVES.length - 1 - days)];

// FOMC decisions and CPI releases inside the window (illustrative dates; shapes, not a calendar)
export const EVENTS = [
  { t: Date.UTC(2025, 9, 29), kind: 'fomc', label: '−25', title: 'FOMC decision · −25 bp (illustrative)' },
  { t: Date.UTC(2025, 11, 10), kind: 'fomc', label: '−25', title: 'FOMC decision · −25 bp (illustrative)' },
  { t: Date.UTC(2026, 0, 28), kind: 'fomc', label: 'Hold', minor: true, title: 'FOMC decision · hold (illustrative)' },
  { t: Date.UTC(2026, 2, 18), kind: 'fomc', label: 'Hold', minor: true, title: 'FOMC decision · hold (illustrative)' },
  { t: Date.UTC(2026, 3, 29), kind: 'fomc', label: '−25', title: 'FOMC decision · −25 bp (illustrative)' },
  { t: Date.UTC(2026, 5, 17), kind: 'fomc', label: 'Hold', minor: true, title: 'FOMC decision · hold (illustrative)' },
  { t: Date.UTC(2026, 6, 29), kind: 'fomc', label: 'Hold', minor: true, title: 'FOMC decision · hold (illustrative)' },
  { t: Date.UTC(2026, 8, 16), kind: 'fomc', label: '−25', title: 'FOMC decision · −25 bp (illustrative)' },
];
export const dayIndex = (t) => { let best = 0; DAYS.forEach((d, i) => { if (Math.abs(d - t) < Math.abs(DAYS[best] - t)) best = i; }); return best; };

// ---- CFTC Traders in Financial Futures: weekly net positions, 3 years, four categories ------------
export const CFTC_WEEKS = 156;
export const CFTC_CATS = [
  { key: 'dealer', name: 'Dealers', short: 'Dealers' },
  { key: 'asset', name: 'Asset managers', short: 'Asset mgrs' },
  { key: 'lev', name: 'Leveraged funds', short: 'Lev. funds' },
  { key: 'other', name: 'Other reportables', short: 'Other' },
];
const rc = rng(23);
function walk(n, start, mean, k, vol) { let v = start; return Array.from({ length: n }, () => { v += (mean - v) * k + (rc() - 0.5) * vol; return Math.round(v); }); }
export const CFTC = {
  contract: '10-year Treasury note futures',
  unit: 'contracts, net long',
  series: {
    dealer: walk(CFTC_WEEKS, -120000, -60000, 0.05, 60000),
    asset: walk(CFTC_WEEKS, 820000, 1180000, 0.03, 70000),
    lev: walk(CFTC_WEEKS, -760000, -1040000, 0.03, 80000),
    other: walk(CFTC_WEEKS, 40000, 30000, 0.06, 30000),
  },
};
export function rangeStats(arr) { const s = [...arr].sort((a, b) => a - b); const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))]; const last = arr[arr.length - 1]; return { min: s[0], max: s[s.length - 1], p10: q(0.1), p90: q(0.9), median: q(0.5), last, pct: Math.round(((last - s[0]) / (s[s.length - 1] - s[0])) * 100) }; }

// ---- FINRA short interest (twice monthly) and Reg SHO daily short volume -------------------------
const rs = rng(41);
export const SI = Array.from({ length: 24 }, (_, i) => { const base = 248 + Math.sin(i / 3.2) * 22 + i * 1.6; return { i, label: `${MONTHS[(9 + Math.floor(i / 2)) % 12]} ${i % 2 ? 'late' : 'mid'}`, shares: round(base + (rs() - 0.5) * 10, 1), dtc: round(1.1 + Math.sin(i / 4) * 0.25 + (rs() - 0.5) * 0.1, 2) }; });
export const SI_GAP = 9; // one settlement the source never published: drawn as a gap
export const SHORT_VOL = Array.from({ length: 60 }, (_, i) => round(0.44 + Math.sin(i / 6) * 0.05 + (rs() - 0.5) * 0.06, 3));

// ---- forecasts: the Scorecard's calibration (10 bins), Wilson 95% intervals ----------------------
export function wilson(k, n, z = 1.96) { if (!n) return [0, 1]; const p = k / n; const d = 1 + (z * z) / n; const c = p + (z * z) / (2 * n); const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n)); return [round((c - m) / d, 3), round((c + m) / d, 3)]; }
export const CALIB = [
  { p: 0.05, n: 14, k: 1 }, { p: 0.15, n: 22, k: 4 }, { p: 0.25, n: 31, k: 7 }, { p: 0.35, n: 38, k: 12 }, { p: 0.45, n: 44, k: 21 },
  { p: 0.55, n: 41, k: 24 }, { p: 0.65, n: 33, k: 22 }, { p: 0.75, n: 24, k: 17 }, { p: 0.85, n: 12, k: 11 }, { p: 0.95, n: 5, k: 5 },
].map((b) => ({ ...b, hit: round(b.k / b.n, 3), ci: wilson(b.k, b.n) }));
export const CALIB_N = CALIB.reduce((s, b) => s + b.n, 0);
export const BRIER = round(CALIB.reduce((s, b) => s + b.k * (1 - b.p) ** 2 + (b.n - b.k) * b.p ** 2, 0) / CALIB_N, 3);
export const BY_MONTH = [['Nov', 18, 7], ['Dec', 14, 6], ['Jan', 22, 12], ['Feb', 19, 9], ['Mar', 25, 14], ['Apr', 21, 11], ['May', 17, 9], ['Jun', 23, 13], ['Jul', 20, 9], ['Aug', 26, 15], ['Sep', 24, 12], ['Oct', 9, 4]];

// ---- a research note: valuation range, bridge, figures ---------------------------------------
export const NOTE = {
  ticker: 'NVDA', price: 181.4, priceAsOf: 'Oct 9, 2026 close (TradingView display only; not used here)',
  // the note's own scenarios (owner's research), per share
  bear: 132, base: 196, bull: 248,
  bridge: [
    { label: 'FY26 EPS (reported)', v: 2.94, kind: 'start' },
    { label: 'Data-center volume', v: 0.88, kind: 'step' },
    { label: 'Gross-margin mix', v: -0.21, kind: 'step' },
    { label: 'Opex growth', v: -0.19, kind: 'step' },
    { label: 'Share count', v: 0.04, kind: 'step' },
    { label: 'FY27 EPS (base)', v: 3.46, kind: 'end' },
  ],
  revenue: [['Q3 FY25', 35.1], ['Q4 FY25', 39.3], ['Q1 FY26', 44.1], ['Q2 FY26', 46.7], ['Q3 FY26', 51.2], ['Q4 FY26', 56.0], ['Q1 FY27', 60.3], ['Q2 FY27', 64.9]],
  margin: [['Q3 FY25', 74.6], ['Q4 FY25', 73.0], ['Q1 FY26', 60.5], ['Q2 FY26', 72.4], ['Q3 FY26', 73.1], ['Q4 FY26', 72.0], ['Q1 FY27', 71.3], ['Q2 FY27', 72.2]],
  filings: [{ q: 0, label: '10-Q' }, { q: 2, label: '8-K' }, { q: 4, label: '10-K' }, { q: 6, label: '8-K' }],
};

// ---- dealer gamma surface (strike × tenor), the landing's one hero instrument ---------------------
export const GEX_STRIKES = Array.from({ length: 33 }, (_, i) => 540 + i * 2.5); // 540 → 620
export const GEX_TENORS = [1, 3, 7, 14, 21, 30, 45, 60, 90];
export function gexAt(k, d, spot = 573) {
  const call = Math.exp(-(((k - 590) / (10 + d * 0.35)) ** 2)) * (1.2 / Math.sqrt(1 + d / 9));
  const put = Math.exp(-(((k - 555) / (9 + d * 0.3)) ** 2)) * (1.05 / Math.sqrt(1 + d / 10));
  const pin = Math.exp(-(((k - spot) / 4) ** 2)) * (0.35 / (1 + d / 3));
  return round(call - put + pin * 0.4, 3);
}

// ---- planned tools (illustrative) --------------------------------------------------------------
export const LIQ = { adv: Array.from({ length: 40 }, (_, i) => round(38 + Math.sin(i / 5) * 6 + (rs() - 0.5) * 6, 1)), spread: Array.from({ length: 40 }, (_, i) => round(1.8 + Math.cos(i / 6) * 0.3 + (rs() - 0.5) * 0.3, 2)) };
export const OTC = Array.from({ length: 12 }, (_, i) => ({ w: `W${i + 1}`, ats: round(9 + Math.sin(i / 2) * 1.6 + (rs() - 0.5) * 1.2, 1), nonAts: round(31 + Math.cos(i / 3) * 3 + (rs() - 0.5) * 2, 1) }));
export const CLUSTERS = [
  { t: Date.UTC(2026, 1, 12), who: 3, net: -42.1, kind: 'sale', plan: true },
  { t: Date.UTC(2026, 2, 6), who: 1, net: -8.4, kind: 'sale', plan: true },
  { t: Date.UTC(2026, 4, 21), who: 4, net: -61.0, kind: 'sale', plan: true },
  { t: Date.UTC(2026, 5, 3), who: 2, net: 3.2, kind: 'buy', plan: false },
  { t: Date.UTC(2026, 7, 28), who: 5, net: -77.5, kind: 'sale', plan: true },
];
export const HOLDERS = [['Index fund A', 8.9, 0.1], ['Index fund B', 7.4, -0.2], ['Asset manager C', 4.1, 0.6], ['Pension D', 2.2, -0.4], ['Insurer E', 1.6, 0.0], ['Hedge fund F', 1.1, 0.9], ['Bank G', 0.9, -0.3], ['Other 13F filers', 33.8, 0.4]];
export const XBRL = { label: 'Revenue', unit: 'USD billions', rows: [['FY22', 26.97, '10-K'], ['FY23', 26.97, '10-K'], ['FY24', 60.92, '10-K'], ['FY25', 130.5, '10-K'], ['FY26', 196.4, '10-K']], restated: 'FY23' };
export const PEERS = [['NVDA', 72.2, 55.1, true], ['AMD', 51.4, 22.3], ['AVGO', 64.8, 38.0], ['INTC', 39.2, -4.5], ['QCOM', 55.6, 26.1], ['MRVL', 47.1, 6.2], ['TXN', 58.3, 30.2]];
export const CALENDAR = [
  { t: Date.UTC(2026, 9, 14), label: 'CPI', kind: 'macro', src: 'BLS' },
  { t: Date.UTC(2026, 9, 21), label: '10-Q due', kind: 'filing', src: 'SEC' },
  { t: Date.UTC(2026, 9, 28), label: 'FOMC', kind: 'macro', src: 'Fed' },
  { t: Date.UTC(2026, 10, 19), label: 'Results', kind: 'results', src: 'Company IR' },
  { t: Date.UTC(2026, 10, 24), label: 'Short interest', kind: 'data', src: 'FINRA' },
];
