// Final · Research — the charts the four Research boards draw, on the v5 chart kit (the ruled "after"
// forms of screens/v5/families-research.mjs, P-8 to P-11). One builder per chart, parameterised by
// environment: production frames are solid with the primary source and its date (the board is a
// snapshot of Oct 14, 2026: Treasury through Oct 13, CFTC positions of Tue Oct 6 published Fri Oct 9);
// staging frames are dashed with the hatch stripe, the Demo tag and a "shaped like" chip on the
// Oct 7, 2026 scenario. Curve, spread and CFTC shapes come from data/charts.mjs (illustrative,
// deterministic); forecasts, notes and their figures are the owner's real notes in research/.
import { barList, chartFrame, dataTable, fmt, legend, plot, rangeBar, smallMultiples, ticks } from '../../chart-kit.mjs';
import { spreadPlot, spreadTable, SP_CLAIM } from '../../components/charts.mjs';
import { BRIER, CALIB, CALIB_N, CFTC, CFTC_CATS, TENORS, curveAgo, latestCurve, rangeStats, y10 } from '../../data/charts.mjs';

/** Environment: production (primary sources, solid) or staging (the demo, dashed + hatch). */
export const env = (demo) => ({
  demo,
  kind: demo ? 'sample' : 'primary',
  sk: demo ? 'dashed' : 'solid',
  // shaped text starting with '!' is literal sample (not shaped like a public source)
  src: (real, shaped) => (demo ? (shaped.startsWith('!') ? `Demo · ${shaped.slice(1)}` : `Demo · shaped like ${shaped}`) : real),
  asof: (real) => (demo ? 'Scenario · Oct 7, 2026' : real),
});

/** A chart frame in the environment's provenance: production keeps its own state tag, staging says Demo. */
export function frame(e, { claim, sub, body, real, shaped, asof, tag = ['current', ''], table = '', note = '', legendHtml = '', href = '' }) {
  return chartFrame({
    claim, sub, body, table, note, legendHtml,
    kind: e.kind,
    source: e.src(real, shaped), sourceKind: e.sk, sourceHref: e.demo ? '' : href,
    asof: e.asof(asof),
    state: e.demo ? 'demo' : tag[0], stateText: e.demo ? '' : tag[1],
  });
}

/** A chart in a non-ready state at its final height: the title names the metric, never a finding (P-10). */
export function frameState(state, { metric, sub = '', height = 220, text = '', cause = '', action = '', source = '', asof = '', stateText = '', body = '' }) {
  const warn = ['error', 'unavailable', 'stale'].includes(state);
  const msg = body || (state === 'loading'
    ? `<div class="cx" role="img" aria-label="Loading ${metric}" aria-busy="true" style="height: ${height}px;"><div class="cskel" aria-hidden="true"></div></div>`
    : `<div class="cx" style="height: ${height}px;"><div class="cstate${warn ? ' warn' : ''}" role="${warn && state !== 'stale' ? 'alert' : 'status'}"><div class="msg"><p>${text}</p>${cause ? `<p class="q">${cause}</p>` : ''}${action}</div></div></div>`);
  return chartFrame({ claim: state === 'loading' ? `<span class="skel" style="display: inline-block; width: 55%; height: 14px;" aria-hidden="true"></span><span class="sr-only">${metric}</span>` : metric, sub, body: msg, source, asof, state, stateText });
}

const ix = (n) => TENORS.findIndex(([k]) => k === n);
// labels: production's last curve is Oct 13 (Oct 12 was a bond-market holiday); staging's is the scenario day
export const DATES = (demo) => (demo
  ? { now: 'Oct 7', nowL: 'Oct 7, 2026', mo: 'Sep 8', yr: 'Oct 7 ’25', yrL: 'Oct 7, 2025', range: 'Oct 7 2025 – Oct 7 2026' }
  : { now: 'Oct 13', nowL: 'Oct 13, 2026', mo: 'Sep 11', yr: 'Oct 13 ’25', yrL: 'Oct 13, 2025', range: 'Oct 13 2025 – Oct 13 2026' });
const TSY = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates';
const CFTC_URL = 'https://www.cftc.gov/MarketReports/CommitmentsofTraders/';

// ---- Markets ----------------------------------------------------------------------------------
// the real 10-year (TIPS) now and a year earlier; breakeven = nominal less real (calc)
const REAL_NOW = 1.86, REAL_YR = 1.87;
export function decomp() {
  const now = latestCurve, yr = curveAgo(250);
  const d10 = +(now.ys[ix('10Y')] - yr.ys[ix('10Y')]).toFixed(2), dReal = +(REAL_NOW - REAL_YR).toFixed(2), dBe = +(d10 - dReal).toFixed(2);
  return { d10, dReal, dBe, n10: now.ys[ix('10Y')], y10: yr.ys[ix('10Y')] };
}
export function ratesToday() {
  const now = latestCurve, yr = curveAgo(250);
  const d = (k) => now.ys[ix(k)] - yr.ys[ix(k)];
  const sp = now.ys[ix('10Y')] - now.ys[ix('2Y')];
  const sv = spreadPlotVals();
  const chg = (v, was) => `${v > 0 ? '▲' : v < 0 ? '▼' : '±'} ${fmt.signed(v)} pts on a year · was ${fmt.pct(was)}`;
  return [
    ['10-year Treasury', fmt.pct(now.ys[ix('10Y')]), chg(d('10Y'), yr.ys[ix('10Y')]), 'current'],
    ['Real 10-year (TIPS)', fmt.pct(REAL_NOW), chg(REAL_NOW - REAL_YR, REAL_YR), 'current'],
    ['10-year breakeven', fmt.pct(now.ys[ix('10Y')] - REAL_NOW), '10-year less real (calc)', 'computed'],
    ['2s10s spread', `${fmt.signed(sp)} pts`, `year’s range ${fmt.num(sv.lo)}–${fmt.num(sv.hi)}`, 'computed'],
    ['3-month bill', fmt.pct(now.ys[ix('3M')]), chg(d('3M'), yr.ys[ix('3M')]), 'current'],
  ];
}
function spreadPlotVals() { const v = []; for (let i = 0; i < y10.length; i++) { const c = curveAgo(y10.length - 1 - i); if (y10[i] != null) v.push(+(c.ys[ix('10Y')] - c.ys[ix('2Y')]).toFixed(2)); } return { lo: Math.min(...v), hi: Math.max(...v) }; }

export function curveChart(e, { height = 260 } = {}) {
  const now = latestCurve, mo = curveAgo(21), yr = curveAgo(250), l = DATES(e.demo);
  const tx = (tau) => Math.sqrt(tau);
  const pts = (c) => TENORS.map(([, tau], k) => [tx(tau), c.ys[k]]);
  const front = now.ys[ix('3M')] - yr.ys[ix('3M')], long = now.ys[ix('30Y')] - yr.ys[ix('30Y')];
  const claim = `The front end ${front < 0 ? 'fell' : 'rose'} ${fmt.num(Math.abs(front), 2)} points in a year while the 30-year held within ${fmt.num(Math.max(0.01, Math.abs(long)), 2)}: the curve steepened`;
  const body = plot({
    height, pr: 104, prn: 60,
    x: { min: tx(1 / 12), max: tx(30), ticks: TENORS.filter(([n]) => ['3M', '1Y', '2Y', '5Y', '10Y', '30Y'].includes(n)).map(([n, tau]) => ({ v: tx(tau), label: n, minor: ['1Y', '3M'].includes(n) })) },
    y: { min: 3, max: 5, ticks: ticks(3, 5, 0.5, (v) => (v === 5 ? '5.0 %' : fmt.num(v, 1))) },
    series: [
      { points: pts(yr), role: 'ctx2', end: { long: l.yr, short: '1Y ago' }, endValue: fmt.pct(yr.ys[ix('30Y')]) },
      { points: pts(mo), role: 'ctx', end: { long: l.mo, short: '1M ago' }, endValue: fmt.pct(mo.ys[ix('30Y')]) },
      { points: pts(now), role: 'emph', width: 2.5, dots: true, end: { long: l.now, short: 'Now' }, endValue: fmt.pct(now.ys[ix('30Y')]) },
    ],
    pointLabels: [{ x: tx(2), y: now.ys[ix('2Y')], text: fmt.pct(now.ys[ix('2Y')]), pos: 'b', minor: true }, { x: tx(10), y: now.ys[ix('10Y')], text: fmt.pct(now.ys[ix('10Y')]), pos: 'b' }],
    aria: `Treasury par yield curve on ${l.nowL}, a month and a year earlier, 1 month to 30 years. 3-month ${fmt.pct(now.ys[ix('3M')])}, 2-year ${fmt.pct(now.ys[ix('2Y')])}, 10-year ${fmt.pct(now.ys[ix('10Y')])}.`,
  });
  return frame(e, {
    claim, body,
    sub: `U.S. Treasury par yields by maturity · percent · ${l.nowL} against a month and a year earlier · maturities spaced by √years · y starts at 3%`,
    legendHtml: legend([{ name: l.nowL, role: 'emph' }, { name: l.mo, role: 'ctx' }, { name: l.yrL, role: 'ctx2' }]),
    real: 'U.S. Treasury · daily par yield curve', shaped: 'U.S. Treasury data', asof: 'As of Oct 13, 2026 · published after 3:30 PM ET', tag: ['current', 'Updated Oct 13'], href: TSY,
    table: dataTable({ caption: 'Par yields by maturity, percent', cols: ['Maturity', l.nowL, l.mo, l.yrL], rows: TENORS.map(([n], k) => [n, fmt.num(now.ys[k]), fmt.num(mo.ys[k]), fmt.num(yr.ys[k])]) }),
  });
}

export function decompChart(e, { labelW = 170 } = {}) {
  const { d10, dReal, dBe } = decomp(); const l = DATES(e.demo); // values sit in the row names: the kit hides .pl.l hbar labels under 480px (class clash with long labels)
  const m = Math.max(0.1, Math.ceil((Math.max(Math.abs(d10), Math.abs(dReal), Math.abs(dBe)) * 1.5) / 0.05) * 0.05);
  const claim = Math.abs(d10) < 0.05 ? `The 10-year barely moved in a year (${fmt.signed(d10)}); real yields and expected inflation each moved less than a tenth` : Math.abs(dReal) >= 0.9 * Math.abs(d10) ? `Real yields did nearly all of the 10-year’s ${fmt.signed(d10)} point move` : `Mostly expected inflation: breakeven ${fmt.signed(dBe)} of the 10-year’s ${fmt.signed(d10)}`;
  return frame(e, {
    claim,
    sub: `Change over one year to ${l.nowL} · percentage points · 10-year = real (TIPS) + breakeven (calculated)`,
    body: barList({ rows: [{ name: `10-year · <span class="mono">${fmt.signed(d10)}</span>`, v: d10, role: 'emph' }, { name: `Real (TIPS) · <span class="mono">${fmt.signed(dReal)}</span>`, v: dReal }, { name: `Breakeven · <span class="mono">${fmt.signed(dBe)}</span>`, v: dBe }], min: -m, max: m, ticks: [{ v: -m, label: fmt.signed(-m, 2), align: 0 }, { v: 0, label: '0' }, { v: m, label: fmt.signed(m, 2), align: 1 }], labelW, pr: 24, prn: 16, aria: `Over a year: 10-year ${fmt.signed(d10)}, real ${fmt.signed(dReal)}, breakeven ${fmt.signed(dBe)} points` }),
    note: 'A shared zero and signed labels carry the direction; no colour does (P-11). The title is chosen from all three bars, never from their ratio alone.',
    real: 'U.S. Treasury · par and real curves', shaped: 'U.S. Treasury data', asof: `${l.nowL} vs ${l.yrL}`, tag: ['computed', 'Computed'], href: TSY,
  });
}

export function spreadChart(e, { height = 260 } = {}) {
  const l = DATES(e.demo);
  return frame(e, { claim: SP_CLAIM, sub: `10-year minus 2-year Treasury par yield · percentage points · daily, ${l.range} · FOMC decisions marked`, body: spreadPlot({ height }), real: 'U.S. Treasury · daily par yield curve', shaped: 'U.S. Treasury data', asof: 'As of Oct 13, 2026', tag: ['computed', 'Computed'], href: TSY, table: spreadTable() });
}

// Production: all 14 notes were written Oct 13 on a price date of Oct 12 (a bond-market holiday), so
// each discount rate started from the Oct 9 10-year. Staging: the demo's four single-name sample notes.
export const PROD_NOTES = ['AMD', 'AMZN', 'CBRS', 'CRWV', 'GOOGL', 'HOOD', 'INTC', 'META', 'MSFT', 'MU', 'NVDA', 'SPCX', 'TSLA', 'TSM'];
export function driftRows(demo) {
  const ys = y10.filter((v) => v != null); const today = ys[ys.length - 1];
  if (demo) return { today, rows: [['AAPL', today + 0.06], ['MSFT', today - 0.11], ['NVDA', today + 0.31], ['TSLA', today - 0.04]] };
  const used = ys[ys.length - 2];
  return { today, used, rows: PROD_NOTES.map((t) => [t, used]) };
}
export function driftChart(e) {
  const { today, used, rows: raw } = driftRows(e.demo);
  const rows = raw.map(([t, r], i) => ({ t, r, i: i + 1, flag: Math.abs(r - today) > 0.25 }));
  const n = rows.length; const flagged = rows.filter((r) => r.flag).length;
  const words = ['No note’s', 'One note’s', 'Two notes’', 'Three notes’'];
  const claim = e.demo
    ? `${words[flagged] || `${flagged} notes’`} discount rate started more than a quarter point from today’s 10-year (${fmt.pct(today)})`
    : `No note’s discount rate has moved a quarter point: all 14 started from the Oct 9 10-year, ${fmt.pct(used)}, now ${fmt.pct(today)}`;
  const body = plot({ height: n * 26 + 52, pl: 64, pr: 110, prn: 72, pt: 26, pb: 26, ends: false, keyboard: true, x: { min: 3.6, max: 4.8, ticks: [3.75, 4.0, 4.25, 4.5, 4.75].map((v) => ({ v, label: v === 4.75 ? '4.75%' : fmt.num(v, 2), minor: v === 3.75 || v === 4.25 })) }, y: { min: n + 0.5, max: 0.5, ticks: [] }, regions: [{ x0: today - 0.25, x1: today + 0.25 }], events: [{ x: today, label: `Today ${fmt.pct(today)}`, keep: true }], segs: rows.map((r) => ({ x0: r.r, y0: r.i, x1: today, y1: r.i, role: 'ctx', width: 1.5 })), dots: rows.map((r) => ({ x: r.r, y: r.i, role: r.flag ? 'emph' : 'ctx', size: 10 })), aria: `Each note's starting 10-year rate against today's ${fmt.pct(today)}` });
  const names = rows.map((r) => `<span style="position: absolute; right: calc(100% + 10px); top: ${(((r.i - 0.5) / n) * 100).toFixed(2)}%; transform: translateY(-50%); font: ${r.flag ? 600 : 400} 12px 'IBM Plex Mono', monospace; color: ${r.flag ? 'var(--phosphor)' : 'var(--steel)'};">${r.t}</span>${r.flag ? `<span style="position: absolute; left: calc(100% + 10px); top: ${(((r.i - 0.5) / n) * 100).toFixed(2)}%; transform: translateY(-50%); font-size: 12px; color: var(--phosphor); white-space: nowrap;">${fmt.signed(r.r - today)} · review</span>` : ''}`).join('');
  return frame(e, {
    claim,
    sub: 'The 10-year rate each note’s discount rate started from (dot) and the move to today (line) · percent · shaded = within ±0.25 points of today, where a valuation is flagged for review',
    body: body.replace('<div class="pa">', `<div class="pa">${names}`),
    real: 'The notes · U.S. Treasury 10-year', shaped: '!the sample notes · Treasury-shaped 10-year', asof: 'Oct 13, 2026', tag: ['computed', 'Computed'],
    table: dataTable({ caption: 'Each note’s starting 10-year rate and the drift to today', cols: ['Note', 'Rate used', 'Drift (pp)'], rows: rows.map((r) => [r.t, fmt.pct(r.r), fmt.signed(r.r - today)]) }),
  });
}

// three contracts, as the API reads them (services/public_data/cftc.rs:15-19)
export const CONTRACTS = [['10-year T-note · CBOT', 1, 0, 1, 0], ['E-mini S&amp;P 500 · CME', 0.7, 90000, 0.6, -40000], ['E-mini Nasdaq-100 · CME', 0.09, 2000, 0.05, 12000]];
export function cftcChart(e, { cols = 3 } = {}) {
  const contracts = CONTRACTS.map(([c, ka, a0, kl, l0]) => [c, CFTC.series.asset.map((v) => Math.round(v * ka + a0)), CFTC.series.lev.map((v) => Math.round(v * kl + l0))]);
  const row = (label, s) => { const st = rangeStats(s); const crosses = st.min < 0 && st.max > 0; const wk = s[s.length - 1] - s[s.length - 2]; return `<div style="display: flex; flex-direction: column; gap: 4px;"><div style="display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap;"><span style="font-size: 12.5px;">${label}</span><span class="mono" style="font-size: 12.5px;">${fmt.signedCompact(st.last)} <span style="color: var(--steel); font-size: 11px;">net · ${fmt.signedCompact(wk)} on the week · ${st.pct}% of 3-yr range</span></span></div>${rangeBar({ lo: st.min, hi: st.max, median: st.median, now: st.last, band: [st.p10, st.p90], labels: [{ v: st.min, text: `${fmt.signedCompact(st.min)} low`, align: 0 }, ...(crosses ? [{ v: 0, text: '0 · flat' }] : []), { v: st.max, text: `${fmt.signedCompact(st.max)} high`, align: 1 }], aria: `${label} ${fmt.signedCompact(st.last)} net, ${st.pct}% of its 3-year range; median ${fmt.signedCompact(st.median)}` })}</div>`; };
  return frame(e, {
    claim: (() => { const a = Math.min(...contracts.map(([, s]) => rangeStats(s).pct)), lv = Math.max(...contracts.map(([, , s]) => rangeStats(s).pct)); return `Asset managers’ longs sit at least ${a}% of the way up their 3-year range in all three contracts; leveraged funds no more than ${lv}%`; })(),
    sub: 'Net futures positions · contracts · this week within its 3-year range · tick = 3-year median · band = 10th–90th percentile · bar = this week · above zero is net long',
    body: `<div class="fr-c3" style="--fc: ${cols};">${contracts.map(([c, a, l]) => `<div class="hd-p" style="gap: 12px; padding: 14px 16px;"><h4 style="margin: 0; font-size: 14px;">${c}</h4>${row('Asset managers', a)}${row('Leveraged funds', l)}</div>`).join('')}</div>`,
    note: 'Reported as of Tuesday and published Friday, so this view is three days old when it updates. It describes who holds what, not what any of them will do.',
    real: 'CFTC · Traders in Financial Futures', shaped: 'CFTC data', asof: 'Positions Tue Oct 6 · published Fri Oct 9 · next Fri Oct 16', tag: ['delayed', 'Delayed by source · 3 days'], href: CFTC_URL,
  });
}
export function cftcMultiples(e, { cols = 4 } = {}) {
  return frame(e, {
    claim: 'Asset managers and leveraged funds hold opposite sides of the 10-year note, as they have for three years',
    sub: 'Net futures positions, 10-year T-note, by trader group · thousands of contracts · weekly, Oct 2023 – Oct 2026 · same scale in every panel',
    body: smallMultiples(CFTC_CATS.map((c) => { const s = CFTC.series[c.key]; const st = rangeStats(s); return { title: c.name, value: `${fmt.signedCompact(st.last)} net · ${st.pct}% of 3-yr range`, body: plot({ height: 96, pt: 8, pb: 20, pl: 44, pr: 12, prn: 12, ends: false, keyboard: false, x: { min: 0, max: s.length - 1, ticks: [{ v: 0, label: '’23', align: 0 }, { v: s.length - 1, label: '’26', align: 1 }] }, y: { min: -1400, max: 1400, ticks: [{ v: -1000, label: '−1M' }, { v: 0, label: '0' }, { v: 1000, label: '+1M' }] }, hlines: [{ v: 0, kind: 'zero' }], series: [{ points: s.map((v, i) => [i, v / 1e3]), role: 'emph', width: 1.5 }], aria: `${c.name}, net position, weekly, 3 years, ${fmt.signedCompact(st.last)} now` }) }; }), { cols }),
    note: 'Four groups become four panels on one scale, never four hues (P-9); above zero is net long, below is net short (P-11).',
    real: 'CFTC · Traders in Financial Futures', shaped: 'CFTC data', asof: 'Positions Tue Oct 6 · published Fri Oct 9', tag: ['delayed', 'Delayed by source · 3 days'], href: CFTC_URL,
  });
}

// ---- Scorecard --------------------------------------------------------------------------------
// production: the 77 open forecasts in the 14 notes, by the month they resolve (none past due)
export const BY_MONTH_PROD = [['Oct', 18], ['Nov', 23], ['Dec', 8], ['Jan', 7], ['Feb', 7], ['Mar', 6], ['Apr', 0], ['May', 1], ['Jun', 3], ['Jul', 1], ['Later', 3]];
export const BY_MONTH_DEMO = [['Past due', 3], ['Oct', 7], ['Nov', 6], ['Dec', 5], ['Jan', 4], ['Feb', 2], ['Mar', 3], ['Apr', 1], ['May', 0], ['Jun', 2], ['Later', 1]];
export function byMonthChart(e) {
  const bars = e.demo ? BY_MONTH_DEMO : BY_MONTH_PROD;
  const total = bars.reduce((s, b) => s + b[1], 0); const past = bars[0][0] === 'Past due' ? bars[0][1] : 0;
  const nov = bars.findIndex(([m]) => m === 'Nov'); const byNov = bars.slice(0, nov + 1).reduce((s, b) => s + b[1], 0);
  const max = Math.max(...bars.map((b) => b[1])); const top = Math.ceil(max / 10) * 10;
  return frame(e, {
    claim: `${byNov} of the ${total} open forecasts resolve by the end of November${past ? `, ${past} of them already past due` : ''}`,
    sub: `Open forecasts by the month they resolve · count · ${e.demo ? 'past-due first, so the bars sum to the total' : 'Oct 2026 – Jul 2027, then later'}`,
    body: plot({ height: 220, pr: 16, prn: 8, pl: 52, x: { min: -0.6, max: bars.length - 0.4, ticks: bars.map(([m], i) => ({ v: i, label: { long: m === 'Jan' ? 'Jan ’27' : m === 'Past due' ? 'Due' : m, short: m === 'Past due' ? 'Due' : m === 'Later' ? 'Later' : m.slice(0, 1) }, minor: i > 2 && i % 2 === 1 && m !== 'Later' })) }, y: { min: 0, max: top, ticks: ticks(0, top, 10, (v) => (v === top ? `${v} calls` : String(v))) }, hlines: [{ v: 0, kind: 'zero' }], bars: bars.map(([, n], i) => ({ x: i, v: n, role: i <= nov ? 'emph' : 'ctx', label: String(n) })), aria: bars.map(([m, n]) => `${m} ${n}`).join(', ') }),
    real: 'The notes’ forecasts blocks', shaped: '!the sample notes’ forecasts', asof: 'Built Oct 14, 2026', tag: ['computed', 'Computed'],
  });
}
export function calibChart(e) {
  const pts = CALIB;
  return frame(e, {
    claim: `Calls at 60–80% came true about as often as stated; the 90%+ bin holds only ${pts[pts.length - 1].n} calls, too few to judge`,
    sub: `Share of forecasts that came true, by stated probability · ${CALIB_N} resolved calls · dot = hit rate, bar = 95% interval (Wilson), n above each, dashed = perfectly calibrated · Brier ${fmt.num(BRIER, 3)} (0 is perfect, 0.250 is saying 50% to everything)`,
    body: plot({ height: 320, pl: 52, pr: 40, prn: 20, pt: 16, pb: 30, ends: false, x: { min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1].map((v) => ({ v, label: v === 1 ? '100% said' : `${v * 100}%`, align: v === 1 ? 1 : v === 0 ? 0 : undefined, minor: v === 0.25 || v === 0.75 })) }, y: { min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1].map((v) => ({ v, label: v === 1 ? '100% true' : `${v * 100}%` })) }, segs: [{ x0: 0, y0: 0, x1: 1, y1: 1, role: 'edge', width: 1, dash: '5 5', essential: false }], whiskers: pts.map((b) => ({ x: b.p, lo: b.ci[0], hi: b.ci[1] })), dots: pts.map((b) => ({ x: b.p, y: b.hit, role: 'emph', size: 10 })), pointLabels: pts.map((b) => ({ x: b.p, y: b.ci[1], text: `n ${b.n}`, minor: b.n > 20 && b.p > 0.2 && b.p < 0.8 })), aria: pts.map((b) => `${Math.round(b.p * 100)}%: ${Math.round(b.hit * 100)}% true of ${b.n}`).join('; ') }),
    real: 'The notes’ forecasts · graded at their dates', shaped: '!the sample notes’ forecasts', asof: 'Built Oct 14, 2026', tag: ['computed', 'Computed'],
    table: dataTable({ caption: 'Calibration by bin', cols: ['Stated', 'Calls', 'Came true', 'Rate', '95% interval'], rows: pts.map((b) => [`${Math.round(b.p * 100 - 5)}–${Math.round(b.p * 100 + 5)}%`, String(b.n), String(b.k), `${Math.round(b.hit * 100)}%`, `${Math.round(b.ci[0] * 100)}–${Math.round(b.ci[1] * 100)}%`]) }),
  });
}
/** Staging only: the scanner's setups graded on the demo's sample prices. */
export function signalsChart(e) {
  const rows = [['Wall hold', 58, 41], ['Flip reclaim', 52, 33], ['Gamma squeeze', 44, 19], ['Range fade', 49, 27]];
  return frame(e, {
    claim: 'Wall holds came true most often after costs; squeezes less than half the time',
    sub: 'Share of scanner setups that reached their named level within 5 sessions, after a 0.10% cost · by setup · n = setups graded',
    body: barList({ rows: rows.map(([n, v, k], i) => ({ name: `${n} · n ${k}`, v, role: i === 0 ? 'emph' : 'ctx', label: `${v}%` })), min: 0, max: 100, ticks: [{ v: 0, label: '0' }, { v: 50, label: '50%' }, { v: 100, label: '100%', align: 1 }], labelW: 160, pr: 52, prn: 44, aria: rows.map(([n, v, k]) => `${n} ${v}% of ${k}`).join(', ') }),
    real: 'Scanner setups · daily closes', shaped: '!setups graded on sample prices', asof: 'Scenario · Oct 7, 2026', tag: ['computed', 'Computed'],
  });
}

// ---- Filings: reported figures (company facts) -------------------------------------------------
// NVDA 10-Q for the quarter to Jul 26, 2026, against the same quarter a year earlier ($M; EPS in $)
export const FIGS = [['Revenue', 46743, 96221], ['Gross profit', 34320, 72099], ['Operating income', 28440, 63867], ['Net income', 26422, 54107], ['Diluted EPS', 1.08, 2.31, '$']];
export const FIGS_DEMO = [['Revenue', 30040, 38410], ['Net income', 16599, 20870], ['Diluted EPS', 0.67, 0.85, '$'], ['Cash and equivalents', 8563, 9812]];
export function figuresTable(demo) {
  const rows = demo ? FIGS_DEMO : FIGS;
  const cell = (v, u) => (u === '$' ? `$${fmt.num(v, 2)}` : `$${fmt.num(v, 0)}M`);
  return `<div class="cf-tw" role="region" aria-label="Reported figures" tabindex="0"><table><caption>${demo ? 'Sample 10-Q, quarter to Jul 26, 2026, against the same quarter a year earlier' : '10-Q for the quarter to Jul 26, 2026, against the same quarter a year earlier · XBRL company facts'}</caption><thead><tr><th scope="col">Figure</th><th scope="col">Prior period</th><th scope="col">This period</th><th scope="col">Change</th></tr></thead><tbody>${rows.map(([l, a, b, u]) => { const d = ((b - a) / Math.abs(a)) * 100; return `<tr><th scope="row" class="t">${l}</th><td>${cell(a, u)}</td><td>${cell(b, u)}</td><td>${d >= 0 ? '▲' : '▼'} ${fmt.num(Math.abs(d), 0)}%</td></tr>`; }).join('')}</tbody></table></div>`;
}
export function figuresChart(e) {
  return frame(e, {
    claim: e.demo ? 'Sample figures: revenue up 28% on the year' : 'Revenue and operating income more than doubled on the year',
    sub: 'NVDA 10-Q, quarter to Jul 26, 2026, against the same quarter a year earlier · change with ▲/▼, neutral (company facts)',
    body: figuresTable(e.demo), real: 'SEC · company facts (XBRL)', shaped: 'SEC EDGAR company facts', asof: 'Filed Aug 27, 2026', tag: ['current', 'Filed Aug 27'], href: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&amp;CIK=0001045810',
  });
}

// ---- Research index: the mini chart (one scale that includes zero; losses hang below it) -------
export function miniBars(vals, { label, aria, guide = [] }) {
  const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals); const pad = (hi - lo) * 0.06 || 1;
  const last = vals.length - 1 - [...vals].reverse().findIndex((_, k) => !guide.includes(vals.length - 1 - k));
  return plot({ height: 64, pt: 4, pb: 4, pl: 0, pr: 0, prn: 0, keyboard: false, ends: false, barW: 18, x: { min: -0.6, max: vals.length - 0.4, ticks: [] }, y: { min: lo - (lo < 0 ? pad : 0), max: hi + pad, ticks: [] }, hlines: [{ v: 0, kind: 'zero' }], bars: vals.map((v, i) => ({ x: i, v, role: i === last ? 'emph' : 'ctx', out: guide.includes(i) })), aria: aria || label });
}
