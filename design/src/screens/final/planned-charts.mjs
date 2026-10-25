// Final · Planned — the charts of the nine planned public-data tools, on the v5 chart kit (the ruled
// forms of screens/v5/tools-v5.mjs, P-8 to P-13), each parameterised by environment (./planned-kit.mjs).
// Production figures are plausible public-record values for a snapshot of Oct 14, 2026, drawn for the
// design (the build would fetch them); NVDA's reported figures match the owner's note and the Filings
// row (10-Q for the quarter to Jul 26, 2026). Staging figures are sample data on the Oct 7 scenario.
// Blocked tools draw their design target with illustrative values, dashed and hatched.
import { icon } from '../../lib.mjs';
import { barList, dataTable, fmt, plot, rangeBar, smallMultiples, sparkline, ticks } from '../../chart-kit.mjs';
import { rng, wilson } from '../../data/charts.mjs';
import { frame } from './planned-kit.mjs';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = 86400000;
const U = (y, m, d) => Date.UTC(y, m - 1, d);
const dl = (t) => { const d = new Date(t); return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}`; };
const legend = (items) => `<div class="cf-legend">${items.map(([k, label]) => `<span class="k">${k}<span style="color: var(--steel);">${label}</span></span>`).join('')}</div>`;
const swatch = (bg, extra = '') => `<i style="background: ${bg}; height: 10px; width: 10px; border-radius: 2px;${extra}"></i>`;
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// =================================================================================================
// 1 · Liquidity — Fed balance sheet less the TGA less reverse repo (weekly, H.4.1 Wednesdays)
// =================================================================================================
export function liquidityData(e) {
  const r = rng(e.demo ? 31 : 47), W = 26;
  const end = e.demo ? U(2026, 9, 30) : U(2026, 10, 7);
  const t = Array.from({ length: W }, (_, i) => end - (W - 1 - i) * 7 * DAY);
  const fed = t.map((_, i) => +(6.6 + i * 0.0042 + (r() - 0.5) * 0.008).toFixed(3));
  const tga = t.map((_, i) => +(0.83 + Math.sin(i / 3.5) * 0.04 + (i >= 21 ? ((i - 20) / 5) * 0.085 : 0) + (r() - 0.5) * 0.01).toFixed(3));
  const rrp = t.map((_, i) => +Math.max(0.004, 0.03 - i * 0.0008 + (r() - 0.5) * 0.004).toFixed(3));
  const net = fed.map((f, i) => +(f - tga[i] - rrp[i]).toFixed(3));
  return { W, t, fed, tga, rrp, net };
}
export function liquidityChart(e, { height = 220 } = {}) {
  const { W, t, fed, tga, rrp, net } = liquidityData(e);
  const ch4 = net[W - 1] - net[W - 5];
  const lo = Math.floor(Math.min(...net) * 10) / 10, hi = Math.ceil(Math.max(...net) * 10) / 10;
  // LIQUIDITY_SPEC as built (fidelity R-25): three shape lanes under the line, each mark on the first Wednesday
  // on or after its date: quarter ends (■), FOMC decisions (●, ◆ with projections) and corporate estimated-tax
  // days (○), with a dotted hairline up through the plot. Shape carries the kind, never hue (P-11).
  const at = (y, m, d) => t.findIndex((w) => w >= U(y, m, d));
  const MARKS = [['Quarter', 'sq', [[2026, 6, 30], [2026, 9, 30]]], ['FOMC', 'dot', [[2026, 4, 29], [2026, 7, 29]]], ['FOMC', 'dia', [[2026, 6, 17], [2026, 9, 16]]], ['Tax', 'ring', [[2026, 4, 15], [2026, 6, 15], [2026, 9, 15]]]]
    .flatMap(([lane, shape, ds]) => ds.map(([y, m, d]) => ({ lane, shape, x: at(y, m, d) }))).filter((k) => k.x >= 0);
  const LANES = ['Quarter', 'FOMC', 'Tax'];
  const X = (i) => ((i / (W - 1)) * 100).toFixed(2);
  const lanes = `<div class="pl-lanes" aria-hidden="true" style="--pl: 56px; --pr: 96px; --prn: 60px;">${LANES.map((ln) => `<div class="ln"><span class="lb">${ln}</span><span class="tr">${MARKS.filter((k) => k.lane === ln).map((k) => `<i class="mk k-${k.shape}" style="left: ${X(k.x)}%;"></i>`).join('')}</span></div>`).join('')}</div>`;
  const body = `${plot({ height, pt: 34, pl: 56, pr: 96, prn: 60, x: { min: 0, max: W - 1, ticks: [0, 8, 16, W - 1].map((i) => ({ v: i, label: dl(t[i]), align: i === 0 ? 0 : i === W - 1 ? 1 : undefined, minor: i === 8 })) }, y: { min: lo, max: hi, ticks: ticks(lo, hi, 0.1, (v) => (Math.abs(v - hi) < 1e-6 ? `$${fmt.num(v, 1)}T` : fmt.num(v, 1))) }, series: [{ points: net.map((v, i) => [i, v]), role: 'emph', end: 'Net', endValue: `$${fmt.num(net[W - 1], 2)}T` }], segs: [...new Set(MARKS.map((k) => k.x))].map((x) => ({ x0: x, y0: lo, x1: x, y1: hi, role: 'axis', width: 1, dash: '2 3', essential: false })), aria: `Net liquidity, weekly, ${dl(t[0])} to ${dl(t[W - 1])}: from $${fmt.num(net[0], 2)}T to $${fmt.num(net[W - 1], 2)}T` })}${lanes}
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr)); gap: 10px;">${[['Fed total assets', fed, `$${fmt.num(fed[W - 1], 2)}T`], ['Treasury cash, TGA · subtracted', tga, `$${fmt.num(tga[W - 1] * 1000, 0)}B`], ['Reverse repo · subtracted', rrp, `$${fmt.num(rrp[W - 1] * 1000, 0)}B`]].map(([n, s, v]) => `<div class="hd-p" style="gap: 6px; padding: 12px 14px;"><span class="caps">${n}</span>${sparkline(s, { width: 120, height: 24, value: v, scale: 'own range', aria: `${n}, 26 weeks, ending ${v}` })}</div>`).join('')}</div>`;
  return frame(e, {
    claim: `Net liquidity ${ch4 < 0 ? 'fell' : 'rose'} $${fmt.num(Math.abs(ch4) * 1000, 0)}B in four weeks as the Treasury’s cash account grew`,
    sub: `Fed balance sheet less the Treasury General Account less overnight reverse repo · $ trillions · weekly, on the H.4.1 Wednesday · axis starts at $${fmt.num(lo, 1)}T, not zero: it shows change, not size`,
    body,
    real: 'Federal Reserve H.4.1 · Treasury DTS · NY Fed', shaped: 'H.4.1 · DTS · NY Fed reverse repo',
    asof: e.demo ? '' : 'Week to Wed Oct 7 · published Thu Oct 8', tag: ['computed', 'Computed · weekly'],
    href: 'https://www.federalreserve.gov/releases/h41/',
    note: 'Each Wednesday’s Fed figure is netted against the Treasury’s cash and reverse repo on that same day (or the business day before it), so a daily swing in the Treasury’s cash never shows as a weekly move. Marks under the line, each on the first Wednesday on or after it: quarter ends (■), FOMC decisions (●, ◆ with projections; from the Fed’s calendar, checked Oct 14, 2026) and corporate estimated-tax days (○; from the IRS tax calendar), when the Treasury’s cash account tends to jump.',
    table: dataTable({ caption: 'Net liquidity and its inputs, $ trillions', cols: ['Week to', 'Fed assets', 'TGA', 'Reverse repo', 'Net'], rows: net.map((v, i) => [dl(t[i]), fmt.num(fed[i], 3), fmt.num(tga[i], 3), fmt.num(rrp[i], 3), fmt.num(v, 3)]).filter((_, i) => i % 3 === 1 || i === W - 1) }),
  });
}
export function liquidityStrip(e) {
  const { W, fed, tga, rrp, net } = liquidityData(e);
  const c = (v) => `${v > 0 ? '▲' : v < 0 ? '▼' : '±'} $${fmt.num(Math.abs(v) * 1000, 0)}B in 4 weeks`;
  return `<div class="pl-strip${e.demo ? ' demo' : ''}">${[['Net liquidity', `$${fmt.num(net[W - 1], 2)}T`, c(net[W - 1] - net[W - 5])], ['Fed total assets', `$${fmt.num(fed[W - 1], 2)}T`, c(fed[W - 1] - fed[W - 5])], ['Treasury cash (TGA)', `$${fmt.num(tga[W - 1] * 1000, 0)}B`, c(tga[W - 1] - tga[W - 5])], ['Reverse repo', `$${fmt.num(rrp[W - 1] * 1000, 0)}B`, c(rrp[W - 1] - rrp[W - 5])]].map(([l, v, s]) => `<div><span class="caps">${l}</span><span class="v">${v}</span><span class="s">${s}</span></div>`).join('')}</div>`;
}

// =================================================================================================
// 2 · Calendar — macro releases (published schedules) and results dates (the notes, or EDGAR cadence)
// =================================================================================================
// [date, label, source, kind: 'macro'|'note'|'est', window end (est only), makes due]
const CAL_PROD = [
  [U(2026, 10, 15), 'CPI, September', 'BLS · 8:30 AM ET', 'macro'],
  [U(2026, 10, 15), 'TSM 3Q26 results', 'From the note', 'note', 0, 'TSM'],
  [U(2026, 10, 21), 'META Q3 results', 'From the note', 'note', 0, 'META'],
  [U(2026, 10, 21), 'TSLA Q3 results', 'From the note', 'note', 0, 'TSLA'],
  [U(2026, 10, 27), 'HOOD Q3 results', 'From the note', 'note', 0, 'HOOD'],
  [U(2026, 10, 27), 'AMZN Q3 results', 'Estimated from filing history', 'est', U(2026, 10, 30), 'AMZN'],
  [U(2026, 10, 28), 'FOMC statement', 'Fed · 2:00 PM ET', 'macro', 0, 'every valued note'],
  [U(2026, 10, 28), 'GOOGL, MSFT Q3 results', 'From the notes', 'note', 0, 'GOOGL, MSFT'],
  [U(2026, 10, 29), 'GDP, Q3 advance', 'BEA · 8:30 AM ET', 'macro'],
  [U(2026, 10, 29), 'INTC Q3 results', 'From the note', 'note', 0, 'INTC'],
  [U(2026, 10, 30), 'PCE prices, September', 'BEA · 8:30 AM ET', 'macro'],
  [U(2026, 11, 3), 'AMD Q3 results', 'From the note', 'note', 0, 'AMD'],
  [U(2026, 11, 4), 'Quarterly refunding', 'Treasury · 8:30 AM ET', 'macro'],
  [U(2026, 11, 5), 'CRWV Q3 results', 'Estimated from filing history', 'est', U(2026, 11, 16), 'CRWV'],
  [U(2026, 11, 6), 'Jobs report, October', 'BLS · 8:30 AM ET', 'macro'],
  [U(2026, 11, 12), 'CPI, October', 'BLS · 8:30 AM ET', 'macro'],
  [U(2026, 11, 17), 'NVDA Q3 FY27 results', 'From the note', 'note', 0, 'NVDA'],
];
const CAL_DEMO = [
  [U(2026, 10, 8), 'CPI, September', 'Sample schedule', 'macro'],
  [U(2026, 10, 16), 'Retail sales, September', 'Sample schedule', 'macro'],
  [U(2026, 10, 22), 'TSLA results', 'Sample date', 'note', 0, 'TSLA'],
  [U(2026, 10, 28), 'FOMC statement', 'Sample schedule', 'macro', 0, 'every sample note'],
  [U(2026, 10, 29), 'MSFT results', 'Sample date', 'note', 0, 'MSFT'],
  [U(2026, 10, 29), 'AAPL results', 'Sample window', 'est', U(2026, 11, 2), 'AAPL'],
  [U(2026, 11, 6), 'Jobs report, October', 'Sample schedule', 'macro'],
  [U(2026, 11, 18), 'NVDA results', 'Sample window', 'est', U(2026, 11, 20), 'NVDA'],
];
export const calData = (e) => ({ list: e.demo ? CAL_DEMO : CAL_PROD, day0: e.demo ? U(2026, 10, 7) : U(2026, 10, 14) });
export function calendarChart(e, { macroOnly = false } = {}) {
  const { list, day0 } = calData(e);
  const mon = day0 - ((new Date(day0).getUTCDay() + 6) % 7) * DAY;
  const weeks = Array.from({ length: 6 }, (_, w) => mon + w * 7 * DAY);
  const items = macroOnly ? list.filter((x) => x[3] === 'macro') : list;
  const cell = ([t, label, src, kind, end, due]) => `<div class="ev${kind === 'est' ? ' est' : ''}${kind === 'macro' ? ' macro' : ''}"><span class="d">${dl(t)}${end ? `–${dl(end).replace(/^[A-Z][a-z]+ /, new Date(end).getUTCMonth() === new Date(t).getUTCMonth() ? '' : dl(end).split(' ')[0] + ' ')}` : ''}</span><b>${label}</b><span class="s">${src}</span>${due ? `<span class="tr">${icon('calendar', 11)}Makes due: ${due}</span>` : ''}</div>`;
  const grid = `<div class="pl-cal" role="list" aria-label="Next six weeks">${weeks.map((w) => { const evs = items.filter((x) => x[0] >= w && x[0] < w + 7 * DAY); return `<div role="listitem"><span class="wk">${dl(w)}–${dl(w + 4 * DAY).replace(MON[new Date(w).getUTCMonth()] + ' ', '')}</span>${evs.length ? evs.map(cell).join('') : '<span class="s" style="font-size: 12px; color: var(--steel);">Nothing scheduled</span>'}</div>`; }).join('')}</div>`;
  const nRes = new Set(list.filter((x) => x[3] !== 'macro').flatMap((x) => String(x[5]).split(', '))).size;
  const claim = e.demo ? `In the sample, ${nRes} of the six demo names report in the next six weeks; the Fed decides on Oct 28` : `${nRes} of the 14 followed companies report in the next six weeks; the Fed decides on Oct 28`;
  return frame(e, {
    claim, sub: `Macro releases from the agencies’ published schedules and results dates from the notes, or estimated from each company’s filing history · ${dl(weeks[0])} – ${dl(weeks[5] + 4 * DAY)} · times Eastern`,
    legendHtml: `<div class="pl-key"><span><i class="macro"></i>Macro release · published schedule</span><span><i></i>Results · date from the note</span><span><i class="est"></i>Results · estimated window, from filing history</span></div>`,
    body: grid,
    real: 'Fed · BLS · BEA · Treasury schedules · SEC EDGAR', shaped: 'agency schedules and EDGAR filing history',
    asof: 'Schedules read Oct 14, 2026', tag: ['current', 'Scheduled'],
    note: 'An estimated window comes from the company’s last four 10-Q and 10-K dates; it turns into a date when the company announces one (8-K Item 7.01 or a dated note catalyst).',
  });
}

// =================================================================================================
// 3 · Off-exchange volume — FINRA OTC Transparency, weekly, ATS and non-ATS (shares, not a share of volume)
// =================================================================================================
export function otcData(e) {
  const r = rng(e.demo ? 13 : 29);
  const last = e.demo ? U(2026, 9, 14) : U(2026, 9, 21);
  return Array.from({ length: 12 }, (_, i) => ({ t: last - (11 - i) * 7 * DAY, ats: Math.round(104 + Math.sin(i / 2) * 12 + (r() - 0.5) * 14), non: Math.round(272 + Math.cos(i / 3) * 22 + (r() - 0.5) * 20 + (i === 11 ? 34 : 0)) }));
}
export function otcChart(e, { height = 240 } = {}) {
  const W = otcData(e); const tot = W.map((w) => w.ats + w.non); const med = median(tot); const L = W[W.length - 1]; const lt = L.ats + L.non;
  const fb = W.flatMap((w, i) => [{ x: i, y0: 0, y1: w.ats, role: i === W.length - 1 ? 'emph' : 'ctx' }, { x: i, y0: w.ats + 4, y1: w.ats + w.non, role: 'ctx2' }]);
  return frame(e, {
    claim: `${e.demo ? 'In the sample, ' : ''}${lt}M NVDA shares traded off exchanges in the week of ${dl(L.t)}, ${Math.abs(lt - med) / med < 0.03 ? 'in line with' : lt > med ? `${Math.round(((lt - med) / med) * 100)}% above` : `${Math.round(((med - lt) / med) * 100)}% below`} the 12-week median of ${Math.round(med)}M`,
    sub: 'NVDA shares traded away from exchanges each week · millions · lower block = alternative trading systems (ATS, “dark pools”), upper = other off-exchange trades (non-ATS: wholesalers and dealers) · dashed = 12-week median of the total',
    legendHtml: legend([[swatch('var(--c-emph)'), 'ATS, latest week'], [swatch('var(--c-ctx)'), 'ATS'], [swatch('var(--c-ctx2)'), 'Non-ATS']]),
    body: plot({ height, pl: 46, pr: 110, prn: 64, x: { min: -0.6, max: W.length - 0.4, ticks: W.map((w, i) => ({ v: i, label: dl(w.t), minor: (W.length - 1 - i) % 3 !== 0 })) /* under 480px every third week, ending on the latest */ }, y: { min: 0, max: 500, ticks: ticks(0, 500, 100, (v) => (v === 500 ? '500M' : String(v))) }, hlines: [{ v: 0, kind: 'zero' }, { v: med, kind: 'ref' }], fbars: fb, barW: 18, pointLabels: [{ x: W.length - 0.4, y: med, text: `median ${Math.round(med)}M`, pos: 'pl-r' }, { x: W.length - 1, y: lt, text: `${lt}M` }], aria: W.map((w) => `week of ${dl(w.t)}: ATS ${w.ats}M, non-ATS ${w.non}M`).join('; ') }),
    real: 'FINRA · OTC Transparency', shaped: 'FINRA OTC Transparency',
    asof: e.demo ? '' : `Week of ${dl(L.t)} · published Oct 5`, tag: ['delayed', 'Delayed by source · 2 weeks'],
    href: 'https://otctransparency.finra.org/',
    note: 'Shares, not a share of all volume: the total needs consolidated volume, which no free source licenses for display. It shows where trading went, never who traded or which way.',
    table: dataTable({ caption: 'NVDA off-exchange volume by week, millions of shares', cols: ['Week of', 'ATS', 'Non-ATS', 'Total'], rows: W.map((w) => [dl(w.t), w.ats, w.non, w.ats + w.non]) }),
  });
}

// =================================================================================================
// 4 · Insider clusters — Form 4 by date and insider; a cluster = 3+ insiders buying within 10 days
// =================================================================================================
const ROLES = ['President and CEO', 'EVP and CFO', 'EVP, Operations', 'EVP, Field Operations', 'Director 1', 'Director 2', 'Director 3'];
// [insider, date, 'sale'|'buy', under a 10b5-1 plan]
function clusterTx(e) {
  if (e.demo) return [[0, U(2026, 6, 10), 'sale', true], [0, U(2026, 7, 8), 'sale', true], [1, U(2026, 6, 12), 'sale', true], [2, U(2026, 8, 3), 'sale', false], [4, U(2026, 9, 14), 'buy', false], [5, U(2026, 9, 16), 'buy', false], [6, U(2026, 9, 19), 'buy', false], [3, U(2026, 5, 20), 'sale', true], [1, U(2026, 9, 2), 'sale', true]];
  const out = [];
  // the CEO's plan: weekly sales Jun–Sep; officers sell after each results window; directors quarterly
  for (let w = 0; w < 16; w++) out.push([0, U(2026, 6, 15) + w * 7 * DAY, 'sale', true]);
  for (const base of [U(2025, 12, 1), U(2026, 3, 9), U(2026, 6, 8), U(2026, 9, 8)]) { out.push([1, base, 'sale', true], [2, base + 2 * DAY, 'sale', true], [3, base + 5 * DAY, 'sale', true]); }
  for (const [i, t] of [[4, U(2025, 12, 4)], [5, U(2026, 3, 12)], [4, U(2026, 6, 10)], [6, U(2026, 9, 10)], [5, U(2026, 9, 11)]]) out.push([i, t, 'sale', true]);
  return out;
}
/** Windows of 10 days in which 3+ distinct insiders traded the same way. */
function windows(tx, kind) {
  const xs = tx.filter((x) => x[2] === kind).sort((a, b) => a[1] - b[1]); const out = [];
  for (const a of xs) { const inW = xs.filter((b) => b[1] >= a[1] && b[1] < a[1] + 10 * DAY); const who = new Set(inW.map((b) => b[0])); if (who.size >= 3 && !out.some((w) => a[1] < w.t1)) out.push({ t0: a[1], t1: Math.max(...inW.map((b) => b[1])), who: who.size, n: inW.length, plan: inW.every((b) => b[3]) }); }
  return out;
}
export function clusterStats(e) { const tx = clusterTx(e); return { tx, sales: tx.filter((x) => x[2] === 'sale'), buys: tx.filter((x) => x[2] === 'buy'), sw: windows(tx, 'sale'), bw: windows(tx, 'buy') }; }
export function clustersChart(e, { compact = false } = {}) {
  const { tx, sales, buys, sw, bw } = clusterStats(e);
  const t0 = e.demo ? U(2026, 4, 8) : U(2025, 10, 14), t1 = e.demo ? U(2026, 10, 7) : U(2026, 10, 14);
  const X = (t) => (t - t0) / DAY; const n = ROLES.length;
  const mt = []; for (let m = 0; m < 13; m++) { const d = Date.UTC(new Date(t0).getUTCFullYear(), new Date(t0).getUTCMonth() + m + 1, 1); if (d < t1) mt.push({ v: X(d), label: MON[new Date(d).getUTCMonth()], minor: m % 2 === 1 }); }
  const labelW = compact ? 120 : 170;
  const regions = [...sw, ...bw].map((w) => ({ x0: X(w.t0) - 1.5, x1: X(w.t1) + 1.5 }));
  const body = plot({ height: n * 30 + 64, pt: 34, pb: 26, pl: labelW, pr: 24, prn: 12, ends: false, x: { min: 0, max: X(t1), ticks: mt }, y: { min: n + 0.5, max: 0.5, ticks: [] }, regions, dots: tx.map(([i, t, k]) => ({ x: X(t), y: i + 1, role: k === 'buy' ? 'emph' : 'ctx', open: k === 'sale', size: k === 'buy' ? 12 : 10 })), events: [...bw.map((w) => ({ x: X(w.t0), label: `Buying cluster · ${w.who} insiders`, keep: true })), ...sw.slice(-2).map((w) => ({ x: X(w.t0), label: `${w.who} insiders sold · plans`, minor: true }))], aria: `${sales.length} sales and ${buys.length} purchases by ${n} insiders; ${bw.length} buying clusters` });
  const names = ROLES.map((r, i) => `<span style="position: absolute; right: calc(100% + 12px); top: ${(((i + 0.5) / n) * 100).toFixed(2)}%; transform: translateY(-50%); width: ${labelW - 16}px; text-align: right; font-size: 12px; line-height: 1.2; color: var(--steel);">${r}</span>`).join('');
  const planned = sales.filter((s) => s[3]).length;
  const claim = bw.length
    ? `In the sample, three directors bought on the open market within ${Math.round((bw[0].t1 - bw[0].t0) / DAY) + 1} days in September: a buying cluster`
    : `No buying cluster in a year: ${new Set(sales.map((s) => s[0])).size} insiders sold ${sales.length} times, ${planned === sales.length ? 'every sale' : `${planned} of the sales`} under a pre-set 10b5-1 plan, and no one bought`;
  return frame(e, {
    claim, sub: `NVDA Form 4 transactions by insider and date · ${e.demo ? 'six months' : '12 months'} · ring = sale, filled = open-market purchase · shaded = 10 days with 3 or more insiders trading the same way`,
    legendHtml: legend([['<i style="width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--c-ctx); background: transparent; box-sizing: border-box;"></i>', 'Sale'], ['<i style="width: 12px; height: 12px; border-radius: 50%; background: var(--c-emph);"></i>', 'Open-market purchase'], ['<i style="width: 14px; height: 10px; border-radius: 2px; background: var(--c-band);"></i>', '3+ insiders within 10 days']]),
    body: body.replace('<div class="pa">', `<div class="pa">${names}`),
    real: 'SEC EDGAR · Form 4', shaped: 'SEC Form 4',
    asof: e.demo ? '' : 'Filed by Oct 13 · insiders file within 2 business days', tag: ['computed', 'Computed from Form 4'],
    href: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001045810&type=4',
    note: 'A cluster counts open-market purchases only. Sales under a 10b5-1 plan were scheduled months ahead and never count; option exercises and gifts are left out. Roles, not names: the names stay in the filings.',
    table: dataTable({ caption: 'Windows with 3 or more insiders trading the same way', cols: ['From', 'To', 'Kind', 'Insiders', 'Trades', 'Under a plan'], rows: [...bw.map((w) => [dl(w.t0), dl(w.t1), { t: 'Purchases' }, w.who, w.n, { t: w.plan ? 'all' : 'none' }]), ...sw.map((w) => [dl(w.t0), dl(w.t1), { t: 'Sales' }, w.who, w.n, { t: w.plan ? 'all' : 'some' }])] }),
  });
}

// =================================================================================================
// 5 · Fund holdings — 13F-HR, % of shares outstanding by the largest filers, change on the quarter
// =================================================================================================
// [holder (placeholder), % of shares, change in points]
const H_PROD = [['Index fund family A', 9.1, 0.1], ['Index fund family B', 7.2, -0.1], ['Asset manager C', 4.3, 0.6], ['Asset manager D', 2.3, -0.4], ['Pension fund E', 1.4, 0.0], ['Bank F', 1.2, -0.2], ['Hedge fund G', 0.8, 0.5], ['Insurer H', 0.6, -0.1]];
const H_DEMO = [['Sample holder A', 8.4, 0.2], ['Sample holder B', 6.9, -0.3], ['Sample holder C', 3.8, 0.4], ['Sample holder D', 2.1, -0.6], ['Sample holder E', 1.5, 0.1], ['Sample holder F', 0.9, 0.3]];
export const holdersData = (e) => (e.demo ? H_DEMO : H_PROD);
const WHO = { 'Asset manager C': 'an asset manager', 'Sample holder D': 'a sample holder' };
export function holdersChart(e, { labelW = 190 } = {}) {
  const H = holdersData(e); const big = H.reduce((a, b) => (Math.abs(b[2]) > Math.abs(a[2]) ? b : a));
  const two = H[0][1] + H[1][1];
  const arrow = (c) => `${c > 0 ? '▲' : c < 0 ? '▼' : '±'} ${fmt.num(Math.abs(c), 1)}`;
  return frame(e, {
    claim: `${e.demo ? 'In the sample, the' : 'The'} two largest holders own ${fmt.num(two, 1)}% of NVDA; the biggest change was ${WHO[big[0]] || 'one holder'} ${big[2] > 0 ? 'adding' : 'cutting'} ${fmt.num(Math.abs(big[2]), 1)} points`,
    sub: `NVDA shares held at the quarter’s end by the largest 13F filers · % of the ${e.demo ? 'sample' : '24.30B'} shares outstanding · ▲/▼ = change in points since the prior quarter · long US-listed positions only`,
    body: barList({ rows: H.map(([n, v, c]) => ({ name: n, v, role: n === big[0] ? 'emph' : 'ctx', label: `${fmt.num(v, 1)}% · ${arrow(c)}` })), max: 10, ticks: [{ v: 0, label: '0' }, { v: 5, label: '5%' }, { v: 10, label: '10%', align: 1 }], labelW, pr: 104, prn: 96, aria: H.map(([n, v, c]) => `${n} ${v}%, change ${c}`).join('; ') }),
    real: 'SEC EDGAR · 13F-HR', shaped: 'SEC 13F-HR information tables',
    asof: e.demo ? '' : 'Quarter to Jun 30 · filed by Aug 14', tag: ['delayed', 'Delayed by law · 45 days'],
    href: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=13F-HR',
    note: 'Change is in points of shares outstanding, so a split or a buyback can’t read as buying. A holder that filed late for the quarter is listed at its last filing, marked “late”.',
    table: dataTable({ caption: 'Largest 13F holders', cols: ['Holder', '% of shares', 'Change, pts'], rows: H.map(([n, v, c]) => [n, fmt.num(v, 1), fmt.signed(c, 1)]) }),
  });
}

// =================================================================================================
// 6 · Figures against the filing — XBRL company facts beside each figure the note states
// =================================================================================================
// [figure, in the note, from the filing, concept, check]
const X_PROD = [
  ['Revenue · Q2 FY27', '$96.2B', '$96,221M', 'us-gaap:Revenues', 'matches'],
  ['Gross margin, GAAP · Q2 FY27', '74.9%', '74.93%', 'GrossProfit ÷ Revenues', 'matches'],
  ['Operating margin, GAAP · Q2 FY27', '66.2%', '66.37%', 'OperatingIncomeLoss ÷ Revenues', 'differs · 0.2 pts'],
  ['Diluted EPS · Q2 FY27', '$2.31', '$2.31', 'us-gaap:EarningsPerShareDiluted', 'matches'],
  ['Free cash flow · Q2 FY27', '$21.3B', '$21.3B', 'NetCashProvidedByOperatingActivities − PaymentsToAcquirePropertyPlantAndEquipment', 'computed'],
  ['Guarantees for customers’ data centers', '$108.5B', '—', 'no standard concept', 'not tagged'],
];
const X_DEMO = [
  ['Revenue · sample quarter', '$38.4B', '$38,410M', 'us-gaap:Revenues', 'matches'],
  ['Net income · sample quarter', '$20.9B', '$20,870M', 'us-gaap:NetIncomeLoss', 'matches'],
  ['Diluted EPS · sample quarter', '$0.86', '$0.85', 'us-gaap:EarningsPerShareDiluted', 'differs · $0.01'],
  ['Cash and equivalents', '$9.8B', '$9,812M', 'us-gaap:CashAndCashEquivalentsAtCarryingValue', 'matches'],
];
export const xbrlRows = (e) => (e.demo ? X_DEMO : X_PROD);
export const checkTag = (s) => (s === 'matches' ? `<span class="stag k-solid">${icon('check', 12)}Matches</span>` : s.startsWith('differs') ? `<span class="stag k-warn">${icon('warn', 12)}Differs${s.slice(7)}</span>` : s === 'computed' ? `<span class="stag k-solid">${icon('sigma', 12)}Computed</span>` : `<span class="stag k-quiet">${icon('doc', 12)}Not tagged · cites the filing</span>`);
export function xbrlCheck(e) {
  const rows = xbrlRows(e); const off = rows.filter((r) => r[4].startsWith('differs'));
  const tbl = `<div role="region" aria-label="Figures against the filing" tabindex="0" style="overflow-x: auto;"><table class="pl-chk"><thead><tr><th scope="col">Figure</th><th scope="col">In the note</th><th scope="col">In the filing</th><th scope="col">Where it comes from</th><th scope="col">Check</th></tr></thead><tbody>${rows.map(([f, a, b, c, s]) => `<tr${s.startsWith('differs') ? ' class="flag"' : ''}><td><b style="font-weight: 600;">${f}</b></td><td class="n">${a}</td><td class="n">${b}</td><td class="c">${c}</td><td>${checkTag(s)}</td></tr>`).join('')}</tbody></table></div>`;
  return frame(e, {
    claim: `${e.demo ? 'In the sample, o' : 'O'}ne of ${rows.length} figures in the note differs from the ${e.demo ? 'sample 10-Q' : '10-Q'}: ${e.demo ? 'diluted EPS' : 'GAAP operating margin'}, by ${off[0][4].split(' · ')[1]}`,
    sub: `Each figure the note states, beside the value the ${e.demo ? 'sample filing' : '10-Q for the quarter to Jul 26, 2026 (filed Aug 27)'} tags for the same period · rounding to the note’s precision counts as a match`,
    body: tbl,
    real: 'SEC · XBRL company facts', shaped: 'SEC XBRL company facts',
    asof: e.demo ? '' : '10-Q filed Aug 27 · checked Oct 14', tag: ['computed', 'Checked against the filing'],
    href: 'https://data.sec.gov/api/xbrl/companyfacts/CIK0001045810.json',
    note: e.demo ? 'The note keeps its own figure; the check shows both and never rewrites the note.' : 'The note keeps its own 66.2%; the check shows both and never rewrites the note. The author sees the same flag in the research check before a note publishes.',
  });
}
const REV_FY = [['FY22', 26.914, 'Mar 18, 2022'], ['FY23', 26.974, 'Feb 24, 2023'], ['FY24', 60.922, 'Feb 21, 2024'], ['FY25', 130.497, 'Feb 26, 2025'], ['FY26', 215.938, 'Feb 25, 2026']];
export function xbrlHistory(e) {
  const rows = e.demo ? [['Year 1', 12.4, 'sample'], ['Year 2', 14.1, 'sample'], ['Year 3', 19.8, 'sample'], ['Year 4', 27.5, 'sample'], ['Year 5', 33.0, 'sample']] : REV_FY;
  const max = e.demo ? 40 : 240, step = e.demo ? 10 : 60;
  return frame(e, {
    claim: e.demo ? 'In the sample, revenue grew in each of five years, with no restatement' : `Revenue as filed grew ${Math.round(rows[4][1] / rows[0][1])}-fold in four fiscal years; no year was restated in a later 10-K`,
    sub: `NVDA annual revenue · $ billions · as tagged in each year’s 10-K · a figure changed by a later filing would carry a “Restated” marker`,
    body: plot({ height: 220, pt: 30, pl: 50, pr: 24, prn: 12, x: { min: -0.6, max: rows.length - 0.4, ticks: rows.map(([y], i) => ({ v: i, label: y })) }, y: { min: 0, max, ticks: ticks(0, max, step, (v) => (v === max ? `$${v}B` : String(v))) }, hlines: [{ v: 0, kind: 'zero' }], bars: rows.map(([, v], i) => ({ x: i, v, role: i === rows.length - 1 ? 'emph' : 'ctx', label: `$${fmt.num(v, 1)}B` })), aria: rows.map(([y, v]) => `${y} $${v}B`).join(', ') }),
    real: 'SEC · XBRL company facts', shaped: 'SEC XBRL company facts', asof: e.demo ? '' : 'Through the FY26 10-K', tag: ['current', 'Updated · on filing'],
    table: dataTable({ caption: 'Annual revenue and the filing it comes from', cols: ['Fiscal year', 'Revenue, $B', 'Filed'], rows: rows.map(([y, v, f]) => [y, fmt.num(v, 3), { t: f }]) }),
  });
}

// =================================================================================================
// 7 · Peers — one XBRL concept across filers for the same calendar quarter (frames API)
// =================================================================================================
// [ticker, GAAP gross margin %, revenue growth on a year %, is the note's company]
const P_PROD = [['NVDA', 74.9, 105.9, true], ['MU', 78.3, 96.4], ['AVGO', 67.2, 24.8], ['ADI', 61.5, 18.0], ['TXN', 57.9, 12.4], ['QCOM', 55.3, 9.6], ['AMD', 54.0, 31.6], ['MRVL', 50.8, 36.2], ['INTC', 38.4, 1.9]];
const P_DEMO = [['NVDA', 71.0, 44.0, true], ['Peer A', 63.0, 18.0], ['Peer B', 55.0, 12.0], ['Peer C', 48.0, 26.0], ['Peer D', 41.0, -6.0], ['Peer E', 58.0, 4.0]];
export const peersData = (e) => (e.demo ? P_DEMO : P_PROD);
export function peersChart(e, { compact = false } = {}) {
  const P = peersData(e);
  const strip = (title, idx, lo, hi, tv, zero) => {
    const vals = P.map((p) => ({ t: p[0], v: p[idx], me: !!p[3] })).sort((a, b) => a.v - b.v);
    const lab = vals.filter((p, i) => p.me || i === 0 || i === vals.length - 1);
    return `<div style="display: flex; flex-direction: column; gap: 4px;"><span class="caps">${title}</span>${plot({ height: 84, pt: 30, pb: 22, pl: 14, pr: 14, prn: 14, ends: false, keyboard: false, x: { min: lo, max: hi, ticks: tv.map((v, i, a) => ({ v, label: `${v}%`, align: i === 0 ? 0 : i === a.length - 1 ? 1 : undefined, minor: compact && i % 2 === 1 })) }, y: { min: 0, max: 1, ticks: [] }, segs: zero ? [{ x0: 0, y0: 0, x1: 0, y1: 1, role: 'axis', width: 1, essential: false }] : [], dots: vals.map((p) => ({ x: p.v, y: 0.4, role: p.me ? 'emph' : 'ctx', size: p.me ? 12 : 9, open: !p.me })), pointLabels: lab.map((p) => ({ x: p.v, y: !p.me && Math.abs(p.v - (vals.find((q) => q.me)?.v ?? -1e9)) < (hi - lo) * 0.2 ? 1 : 0.4, text: `${p.t} ${fmt.num(p.v, 1)}%` })) /* a label near NVDA's rises a row */, aria: vals.map((p) => `${p.t} ${p.v}%`).join(', ') })}</div>`;
  };
  const gm = [...P].sort((a, b) => b[1] - a[1]);
  const me = P.find((p) => p[3]);
  const rank = (arr) => arr.findIndex((p) => p[3]) + 1;
  const claim = e.demo
    ? `In the sample, NVDA leads ${P.length - 1} peers on both gross margin and growth`
    : `NVDA grew fastest of ${P.length} chipmakers, ${fmt.num(me[2], 0)}% on a year; on gross margin it ranks ${rank(gm) === 2 ? 'second, behind ' + gm[0][0] : rank(gm)}`;
  return frame(e, {
    claim, sub: `${e.demo ? 'Sample peers' : `${P.length} semiconductor filers`} · calendar quarter ${e.demo ? '(sample)' : '2026 Q2'} · filled = NVDA, rings = peers · labelled: NVDA and the extremes; every value in the table`,
    body: `${strip('GAAP gross margin, %', 1, 30, 90, [30, 45, 60, 75, 90])}${strip('Revenue growth on a year, %', 2, e.demo ? -10 : -10, e.demo ? 60 : 120, e.demo ? [-10, 0, 20, 40, 60] : [-10, 0, 30, 60, 90, 120], true)}`,
    real: 'SEC · XBRL frames API', shaped: 'SEC XBRL frames',
    asof: e.demo ? '' : `CY2026Q2 · ${P.length} of 9 filers have filed`, tag: ['computed', 'Computed · CY2026 Q2'],
    href: 'https://data.sec.gov/api/xbrl/frames/us-gaap/GrossProfit/USD/CY2026Q2.json',
    note: 'Fiscal quarters differ: the frames API maps each filing to the calendar quarter it mostly covers (NVDA’s quarter to Jul 26 counts as Q2). Growth compares the same company’s same quarter a year earlier.',
    table: dataTable({ caption: 'Peers, calendar quarter 2026 Q2', cols: ['Ticker', 'Gross margin', 'Revenue growth'], rows: gm.map((p) => [p[0], `${fmt.num(p[1], 1)}%`, fmt.signed(p[2], 1, '%')]) }),
  });
}

// =================================================================================================
// 8 · Signal track record — the scanner's setups graded after costs (blocked: needs licensed daily prices)
// =================================================================================================
const S_ROWS = [['Wall hold', 58, 41], ['Flip reclaim', 52, 33], ['Range fade', 49, 27], ['Gamma squeeze', 44, 19]];
export function signalsChart(e) {
  const rows = S_ROWS.map(([name, n, k], i) => ({ name, n, k, p: k / n, ci: wilson(k, n), y: i + 1 }));
  const N = rows.length;
  const body = plot({ height: N * 46 + 40, pl: 150, pr: 110, prn: 64, pt: 8, pb: 26, ends: false, x: { min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1].map((v) => ({ v, label: `${v * 100}%`, align: v === 0 ? 0 : v === 1 ? 1 : undefined })) }, y: { min: N + 0.5, max: 0.5, ticks: [] }, segs: [{ x0: 0.5, y0: 0.5, x1: 0.5, y1: N + 0.5, role: 'edge', width: 1, dash: '4 4', essential: false }, ...rows.map((r) => ({ x0: r.ci[0], y0: r.y, x1: r.ci[1], y1: r.y, role: 'edge', width: 2 }))], dots: rows.map((r, i) => ({ x: r.p, y: r.y, role: i === 0 ? 'emph' : 'ctx', size: 10 })), pointLabels: rows.map((r) => ({ x: r.ci[1], y: r.y, text: `${Math.round(r.p * 100)}% · n ${r.n}`, pos: 'pl-r' })), aria: rows.map((r) => `${r.name}: ${Math.round(r.p * 100)}% of ${r.n}, interval ${Math.round(r.ci[0] * 100)} to ${Math.round(r.ci[1] * 100)}%`).join('; ') });
  const names = rows.map((r) => `<span style="position: absolute; right: calc(100% + 12px); top: ${(((r.y - 0.5) / N) * 100).toFixed(2)}%; transform: translateY(-50%); font-size: 12.5px; color: var(--phosphor); white-space: nowrap;">${r.name}</span>`).join('');
  const above = rows.filter((r) => r.ci[0] > 0.5).length;
  return frame(e, {
    claim: e.target ? 'Design target: how often each setup reached its level after costs, and how sure that is' : `In the sample, wall holds reached their level ${Math.round(rows[0].p * 100)}% of the time after costs; ${above ? `${above} setup clears 50% with room to spare` : 'no setup clears 50% with room to spare'}`,
    sub: 'Share of the scanner’s setups that reached the level they named within 5 sessions, net of a 0.10% round-trip cost · dot = rate, bar = 95% interval (Wilson), dashed = 50% · n = setups graded',
    body: body.replace('<div class="pa">', `<div class="pa">${names}`),
    real: 'Scanner setup log · daily closes', shaped: 'graded scanner setups',
    tag: ['computed', 'Computed'],
    note: e.target ? 'The values are illustrative. Grading needs a daily price history licensed to Convexa (TradingView’s frame is display-only) and the scanner’s setups, which come from the options feed.' : 'Grades are research about how often a description held, not a recommendation.',
    table: dataTable({ caption: 'Setups graded after costs', cols: ['Setup', 'Graded', 'Reached', 'Rate', '95% interval'], rows: rows.map((r) => [r.name, r.n, r.k, `${Math.round(r.p * 100)}%`, `${Math.round(r.ci[0] * 100)}–${Math.round(r.ci[1] * 100)}%`]) }),
  });
}

// =================================================================================================
// 9 · Technical readings Convexa computes (blocked in production: needs licensed daily prices)
// =================================================================================================
// production design target (illustrative); staging computes from the demo's sample bars (the same
// generator as ./ticker-tech.mjs and the demo catalog: base, step, phase per symbol)
function demoBars(base, step, phase) {
  const dates = []; const d = new Date('2026-10-07T12:00:00Z');
  while (dates.length < 60) { const w = d.getUTCDay(); if (w !== 0 && w !== 6) dates.unshift(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() - 1); }
  return dates.map((date, i) => { const close = +(base + i * step + Math.sin((i + phase) / 4) * base * 0.004).toFixed(2); const spread = +(base * 0.009 + (i % 4) * base * 0.0004).toFixed(2); return { date, close, high: +(close + spread).toFixed(2), low: +(close - spread).toFixed(2) }; });
}
function demoValues() {
  // The NVDA and SPY seeds as the demo ships them (catalog/nvda.seed.json, spy.seed.json; R-28).
  const b = demoBars(190.54, 0.15, 5), spy = demoBars(670, 0.32, 1); const n = b.length;
  const ema = (w) => { const a = 2 / (w + 1); let v = b.slice(0, w).reduce((x, y) => x + y.close, 0) / w; for (let i = w; i < n; i++) v = a * b[i].close + (1 - a) * v; return v; };
  let ag = 0, al = 0; for (let i = 1; i < n; i++) { const ch = b[i].close - b[i - 1].close, g = Math.max(ch, 0), l = Math.max(-ch, 0); if (i <= 14) { ag += g / 14; al += l / 14; } else { ag = (ag * 13 + g) / 14; al = (al * 13 + l) / 14; } }
  const tr = b.map((x, i) => (i ? Math.max(x.high - x.low, Math.abs(x.high - b[i - 1].close), Math.abs(x.low - b[i - 1].close)) : x.high - x.low));
  const lr = b.slice(-21).map((x, i, a) => (i ? Math.log(x.close / a[i - 1].close) : null)).slice(1); const m = lr.reduce((x, y) => x + y, 0) / lr.length;
  const rv = Math.sqrt(lr.reduce((x, y) => x + (y - m) ** 2, 0) / (lr.length - 1)) * Math.sqrt(252) * 100;
  const last20 = b.slice(-20); const rel = b.map((x, i) => +((x.close / b[0].close) / (spy[i].close / spy[0].close) * 100).toFixed(2));
  return { close: b[n - 1].close, e20: ema(20), e50: ema(50), rsi: 100 - 100 / (1 + ag / (al || 1e-9)), noLoss: al < 1e-6, atr: tr.slice(-14).reduce((x, y) => x + y, 0) / 14, rv, sup: Math.min(...last20.map((x) => x.low)), res: Math.max(...last20.map((x) => x.high)), lo: Math.min(...b.map((x) => x.low)), hi: Math.max(...b.map((x) => x.high)), rel, vsSpy: rel[n - 1] - 100, vsSmh: null, asof: 'Oct 7', span: '60 sessions ago' };
}
const TARGET_TA = { close: 226.32, e20: 219.6, e50: 205.3, rsi: 58.4, atr: 7.82, rv: 41.2, sup: 212.4, res: 236.8, lo: 196.1, hi: 241.5, vsSpy: 8.4, vsSmh: 3.1, asof: 'Oct 13', span: '3 mo ago' };
function rsSeries(seed, drift) { const r = rng(seed); let v = 100; return Array.from({ length: 63 }, (_, i) => (i === 0 ? 100 : (v = +(v * (1 + drift / 6300 + (r() - 0.5) * 0.012)).toFixed(2)))); }
export function taReadings(e) {
  const v = e.demo ? demoValues() : TARGET_TA;
  const cells = [
    ['Trend', `${v.close > v.e20 && v.close > v.e50 ? 'Above both' : v.close < v.e20 && v.close < v.e50 ? 'Below both' : 'Between'}`, `close $${fmt.num(v.close, 2)} · EMA 20 $${fmt.num(v.e20, 2)} · EMA 50 $${fmt.num(v.e50, 2)}`],
    ['RSI 14', fmt.num(v.rsi, 1), v.noLoss ? 'no down close in the window · Wilder, 0–100' : 'Wilder · 0–100 · 70 and 30 marked'],
    ['ATR 14', `$${fmt.num(v.atr, 2)}`, `${fmt.num((v.atr / v.close) * 100, 1)}% of the close · mean true range`],
    ['Realized vol · 20 days', `${fmt.num(v.rv, 1)}%`, 'annualized, from daily closes · not implied vol'],
    ['Relative strength', fmt.signed(v.vsSpy, 1, '%'), `vs SPY over ${v.span === '3 mo ago' ? '3 months' : '60 sessions'}${v.vsSmh == null ? '' : ` · ${fmt.signed(v.vsSmh, 1, '%')} vs SMH`}`],
    ['Last bar', v.asof, 'daily close · end of day'],
  ];
  const sr = `<div style="display: flex; flex-direction: column; gap: 6px;"><span class="caps">Support and resistance · the 20-day low and high · range of 60 sessions ${fmt.num(v.lo, 0)}–${fmt.num(v.hi, 0)}</span>${rangeBar({ lo: v.lo, hi: v.hi, now: v.close, band: [v.sup, v.res], labels: [{ v: v.sup, text: `support $${fmt.num(v.sup, 2)}`, align: 1 }, { v: v.res, text: `resistance $${fmt.num(v.res, 2)}`, align: 1 }], aria: `Close $${fmt.num(v.close, 2)} between support $${fmt.num(v.sup, 2)} and resistance $${fmt.num(v.res, 2)}` })}</div>`;
  const rsPanel = (n, pts, d) => ({ title: `NVDA ${n}`, value: fmt.signed(d, 1, '%'), body: plot({ height: 96, pt: 10, pb: 22, pl: 34, pr: 12, prn: 8, ends: false, keyboard: false, x: { min: 0, max: pts.length - 1, ticks: [{ v: 0, label: v.span, align: 0 }, { v: pts.length - 1, label: v.asof, align: 1 }] }, y: { min: Math.min(92, Math.floor(Math.min(...pts)) - 1), max: Math.max(112, Math.ceil(Math.max(...pts)) + 1), ticks: [{ v: 100, label: '100' }] }, hlines: [{ v: 100, kind: 'ref' }], series: [{ points: pts.map((p, i) => [i, p]), role: 'emph', width: 1.5 }], aria: `NVDA relative to ${n}, rebased to 100, now ${fmt.signed(d, 1)}%` }) });
  const smh = e.demo ? { title: 'NVDA vs SMH (semiconductors)', value: '', body: '<div class="dna" style="min-height: 96px;"><span class="caps">No sample</span><span class="dline">The demo has no SMH bars, so this panel says so instead of drawing.</span></div>' } : rsPanel('vs SMH (semiconductors)', rsSeries(17, v.vsSmh), v.vsSmh);
  const rs = smallMultiples([rsPanel('vs SPY', e.demo ? v.rel : rsSeries(11, v.vsSpy), v.vsSpy), smh], { cols: 2 });
  const body = `<div class="pl-rd">${cells.map(([l, val, s2]) => `<div><span class="caps">${l}</span><span class="v">${val}</span><span class="s">${s2}</span></div>`).join('')}</div>${sr}<span class="caps">Relative strength · rebased to 100 · above 100 = NVDA did better</span>${rs}`;
  return frame(e, {
    claim: e.target ? 'Design target: NVDA’s readings on the last daily bar, computed by Convexa' : `In the sample, NVDA closed above its 20- and 50-day averages on Oct 7 and ${fmt.signed(v.vsSpy, 1, '%')} against SPY over 60 sessions`,
    sub: 'Computed from end-of-day bars · each reading traceable to its bars · a reading still warming up says how many bars it has',
    body, real: 'Convexa · from licensed daily bars', shaped: 'daily bars', tag: ['computed', 'Computed'],
    note: e.target ? 'Values are illustrative. Production shows Not live here until Convexa holds a daily price history licensed for public display; none of these is read from TradingView’s chart.' : 'Computed in the browser from the same 60 sample bars as the chart above. Descriptive context, not a forecast or a call to buy or sell.',
  });
}
