// v5 wave 3 · the planned tools, charted before they are built (docs/public-data/CANDIDATES.md; the v4
// tool sheets). Each gets its claim, its form, its source and delay, and its honest state. Status words
// (build · verify · switch · blocked) stay on the board (P-4, approved: design-only). Values illustrative.
import { baRow, barList, chartFrame, dataTable, fmt, plot, sparkline, ticks } from '../../chart-kit.mjs';
import { CALENDAR, CLUSTERS, HOLDERS, MONTHS, OTC, PEERS, XBRL, rng, wilson } from '../../data/charts.mjs';
import { statusChip } from '../../components/data-states.mjs';
import { thirdPartyFrame } from '../../components/charts.mjs';
import { v5Head, v5Wrap } from './system.mjs';

const r = rng(77);
const W = 26; // weeks
const fed = Array.from({ length: W }, (_, i) => +(6.62 - i * 0.004 + (r() - 0.5) * 0.01).toFixed(3));
const tga = Array.from({ length: W }, (_, i) => +(0.78 + Math.sin(i / 3) * 0.05 + (i > 21 ? 0.06 : 0) + (r() - 0.5) * 0.01).toFixed(3));
const rrp = Array.from({ length: W }, (_, i) => +(0.21 - i * 0.003 + (r() - 0.5) * 0.008).toFixed(3));
const net = fed.map((f, i) => +(f - tga[i] - rrp[i]).toFixed(3));
const wk = (i) => { const d = new Date(Date.UTC(2026, 3, 15) + i * 7 * 86400000); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`; };

function liquidity() {
  const ch4 = net[W - 1] - net[W - 5];
  return chartFrame({
    claim: `Net liquidity ${ch4 < 0 ? 'fell' : 'rose'} $${fmt.num(Math.abs(ch4) * 1000, 0)}B in four weeks, as the Treasury rebuilt its cash account`,
    sub: 'Fed balance sheet less the Treasury General Account less overnight reverse repo · $ trillions · weekly (H.4.1, Wednesdays) · axis starts at $5.4T, not zero: it shows change, not size',
    body: `${plot({ height: 220, pt: 34, pl: 56, pr: 90, prn: 56, x: { min: 0, max: W - 1, ticks: [0, 8, 16, W - 1].map((i) => ({ v: i, label: wk(i), align: i === 0 ? 0 : i === W - 1 ? 1 : undefined })) }, y: { min: 5.4, max: 5.8, ticks: ticks(5.4, 5.8, 0.1, (v) => (v === 5.8 ? '$5.8T' : fmt.num(v, 1))) }, series: [{ points: net.map((v, i) => [i, v]), role: 'emph', end: 'Net', endValue: `$${fmt.num(net[W - 1], 2)}T` }], events: [{ x: 6, label: 'FOMC', minor: true }, { x: 14, label: 'FOMC', minor: true }, { x: 21, label: 'Refunding', keep: true }, { x: 22, label: 'FOMC', minor: true }], eventLane: { long: 'Events', short: '' }, aria: 'Net liquidity weekly over 26 weeks' })}<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: 10px;">${[['Fed assets', fed, '$T'], ['TGA (subtracted)', tga, '$T'], ['Reverse repo (subtracted)', rrp, '$T']].map(([n, s, u]) => `<div class="hd-p" style="gap: 6px; padding: 12px 14px;"><span class="caps">${n}</span>${sparkline(s, { width: 120, height: 24, value: `$${fmt.num(s[s.length - 1], 2)}T`, scale: 'own range', aria: `${n} over 26 weeks` })}</div>`).join('')}</div>`,
    note: 'The claim is computed from the plotted series (the v4 sheet’s “fell $86B” didn’t match its own −$70B line, DB-04), and the date is the H.4.1 Wednesday, not the day it was read.',
    source: 'Federal Reserve H.4.1 · U.S. Treasury DTS', asof: 'Week to Wed Oct 7 · published Thu Oct 8',
    table: dataTable({ caption: 'Net liquidity and its inputs, $ trillions', cols: ['Week', 'Fed assets', 'TGA', 'Reverse repo', 'Net'], rows: net.map((v, i) => [wk(i), fmt.num(fed[i], 3), fmt.num(tga[i], 3), fmt.num(rrp[i], 3), fmt.num(v, 3)]).filter((_, i) => i % 3 === 0 || i === W - 1) }),
  });
}
function calendar() {
  const day0 = Date.UTC(2026, 9, 13); const d = (t) => (t - day0) / 86400000;
  return chartFrame({ claim: 'Five dated events in the next six weeks; results land on Nov 19', sub: 'NVDA and the market calendar · next 42 days · each event names its source', body: plot({ height: 96, pt: 52, pb: 26, pl: 16, pr: 16, prn: 16, ends: false, x: { min: -1, max: 42, ticks: [0, 14, 28, 42].map((v) => ({ v, label: v === 0 ? 'Oct 13' : `+${v / 7} wk`, align: v === 42 ? 1 : undefined })) }, y: { min: 0, max: 1, ticks: [] }, events: CALENDAR.map((e, i) => ({ x: d(e.t), label: `${e.label} · ${e.src}`, lane: i % 2 ? 2 : 1, keep: e.kind === 'results' })), aria: CALENDAR.map((e) => `${e.label} ${new Date(e.t).toUTCString().slice(5, 11)}`).join(', ') }), source: 'BLS · Fed · SEC · company IR · FINRA', asof: 'Calendar of Oct 13, 2026', table: dataTable({ caption: 'Upcoming events', cols: ['Date', 'Event', 'Source'], rows: CALENDAR.map((e) => [new Date(e.t).toUTCString().slice(5, 11), { t: e.label }, { t: e.src }]) }) });
}
function otc() {
  const med = [...OTC.map((w) => w.ats + w.nonAts)].sort((a, b) => a - b)[6];
  const last = OTC[OTC.length - 1];
  const fb = OTC.flatMap((w, i) => [{ x: i, y0: 0, y1: w.ats, role: i === OTC.length - 1 ? 'emph' : 'ctx' }, { x: i, y0: w.ats + 0.4, y1: w.ats + w.nonAts, role: 'ctx2' }]);
  return chartFrame({ claim: `Off-exchange trading was ${fmt.num(last.ats + last.nonAts, 0)}% of volume last week, ${last.ats + last.nonAts > med ? 'above' : 'below'} its 12-week median of ${fmt.num(med, 0)}%`, sub: 'NVDA share of weekly volume traded away from exchanges · percent · lower = in dark pools (ATS), upper = other off-exchange (non-ATS) · FINRA publishes two weeks late (ATS) and one week late (non-ATS)', body: plot({ height: 220, pl: 46, pr: 100, prn: 60, x: { min: -0.6, max: OTC.length - 0.4, ticks: OTC.map((w, i) => ({ v: i, label: w.w, minor: i % 2 === 1 })) }, y: { min: 0, max: 50, ticks: ticks(0, 50, 10, (v) => (v === 50 ? '50%' : String(v))) }, hlines: [{ v: 0, kind: 'zero' }, { v: med, kind: 'ref' }], fbars: fb, barW: 18, pointLabels: [{ x: OTC.length - 0.4, y: med, text: `median ${fmt.num(med, 0)}%`, pos: 'r' }], aria: 'Off-exchange share by week' }), source: 'FINRA · OTC Transparency', asof: 'ATS to Sep 28 · non-ATS to Oct 5', note: 'Display terms for FINRA’s files are with the owner (Q-2); this sheet draws the design only.' });
}
function clusters() {
  const t0 = Date.UTC(2026, 0, 1); const d = (t) => (t - t0) / 86400000;
  const rows = CLUSTERS;
  return chartFrame({ claim: 'Three clusters of insider sales this year, all under 10b5-1 plans; one small purchase', sub: 'NVDA Form 4 filings by date · ring = sale, filled = purchase · number = insiders in a 10-day cluster · $M net', body: plot({ height: 140, pt: 34, pb: 26, pl: 16, pr: 16, prn: 16, ends: false, x: { min: 0, max: 300, ticks: [0, 59, 120, 181, 243].map((v, i) => ({ v, label: ['Jan', 'Mar', 'May', 'Jul', 'Sep'][i] })) }, y: { min: 0, max: 1, ticks: [] }, regions: rows.filter((c) => c.who >= 3).map((c) => ({ x0: d(c.t) - 5, x1: d(c.t) + 5 })), dots: rows.map((c) => ({ x: d(c.t), y: 0.45, role: c.kind === 'buy' ? 'emph' : 'ctx', open: c.kind === 'sale', size: 10 + c.who * 3 })), events: rows.filter((c) => c.who >= 3 || c.kind === 'buy').map((c) => ({ x: d(c.t), label: `${c.who} · ${fmt.signed(c.net, 1)}M${c.plan ? ' · plan' : ''}`, keep: true })), aria: rows.map((c) => `${c.who} insiders ${c.kind} ${c.net}M`).join(', ') }), source: 'SEC EDGAR · Form 4', asof: 'Filed by Oct 9 · insiders file within 2 business days', note: 'Placed by date, not by index (the v4 strip spaced them evenly, DB-08). A sale under a 10b5-1 plan was scheduled in advance; the label says so.' });
}
function holders() {
  return chartFrame({ claim: 'Two index funds hold 16% of the shares; the biggest change was an asset manager adding 0.6 points', sub: 'NVDA shares held by 13F filers · % of shares outstanding · change since the prior quarter as ▲/▼ (company facts: neutral) · 13F filings arrive up to 45 days after the quarter', body: barList({ rows: HOLDERS.map(([n, v, ch], i) => ({ name: n, v, role: i === 2 ? 'emph' : 'ctx', label: `${fmt.num(v, 1)}% · ${ch > 0 ? '▲' : ch < 0 ? '▼' : '±'} ${fmt.num(Math.abs(ch), 1)}` })), max: 40, ticks: [{ v: 0, label: '0' }, { v: 20, label: '20%' }, { v: 40, label: '40%', align: 1 }], labelW: 170, pr: 120, aria: 'Holders by % of shares' }), source: 'SEC EDGAR · 13F-HR', asof: 'Quarter to Jun 30 · filed by Aug 14' });
}
function xbrl() {
  const rows = XBRL.rows;
  return chartFrame({ claim: 'Revenue grew sevenfold in three years; FY23 was restated in the FY24 10-K', sub: 'NVDA annual revenue as reported in XBRL company facts · $ billions · each bar names its filing', body: plot({ height: 240, pt: 36, pl: 50, pr: 24, prn: 12, x: { min: -0.6, max: rows.length - 0.4, ticks: rows.map(([y], i) => ({ v: i, label: y })) }, y: { min: 0, max: 200, ticks: ticks(0, 200, 50, (v) => (v === 200 ? '$200B' : String(v))) }, hlines: [{ v: 0, kind: 'zero' }], bars: rows.map(([y, v], i) => ({ x: i, v, role: i === rows.length - 1 ? 'emph' : 'ctx', label: `$${fmt.num(v, 1)}B` })), events: [{ x: 1, label: 'Restated', keep: true, title: 'FY23 restated in the FY24 10-K' }], eventLane: { long: 'Filed', short: '' }, aria: rows.map(([y, v]) => `${y} ${v}`).join(', ') }), source: 'SEC · XBRL company facts', asof: 'Through the FY26 10-K', table: dataTable({ caption: 'Annual revenue and the filing it comes from', cols: ['Fiscal year', 'Revenue ($B)', 'Filing'], rows: rows.map(([y, v, f]) => [y, fmt.num(v, 2), { t: y === XBRL.restated ? `${f} · restated` : f }]) }) });
}
function peers() {
  const strip = (title, idx, lo, hi, unit, tv) => { const vals = PEERS.map((p) => ({ t: p[0], v: p[idx], me: !!p[3] })).sort((a, b) => a.v - b.v); return `<div style="display: flex; flex-direction: column; gap: 4px;"><span class="caps">${title}</span>${plot({ height: 76, pt: 26, pb: 22, pl: 12, pr: 12, prn: 12, ends: false, keyboard: false, x: { min: lo, max: hi, ticks: tv.map((v, i, a) => ({ v, label: `${fmt.num(v, 0)}${unit}`, align: i === 0 ? 0 : i === a.length - 1 ? 1 : undefined })) }, y: { min: 0, max: 1, ticks: [] }, hlines: lo < 0 ? [] : [], dots: vals.map((p) => ({ x: p.v, y: 0.4, role: p.me ? 'emph' : 'ctx', size: p.me ? 12 : 9, open: !p.me })), pointLabels: vals.filter((p, i) => p.me || i === 0 || i === vals.length - 1).map((p) => ({ x: p.v, y: 0.4, text: `${p.t} ${fmt.num(p.v, 1)}${unit}` })), aria: vals.map((p) => `${p.t} ${p.v}`).join(', ') })}</div>`; };
  return chartFrame({ claim: 'NVDA leads its peers on both gross margin and growth, by a wide margin on growth', sub: 'Last fiscal year · % · filled = NVDA, rings = peers · labelled: NVDA and the extremes; all values in the table', body: `${strip('Gross margin', 1, 30, 80, '%', [30, 40, 50, 60, 70, 80])}${strip('Revenue growth', 2, -10, 60, '%', [-10, 0, 20, 40, 60])}`, source: 'SEC · XBRL company facts', asof: 'Latest 10-Ks', table: dataTable({ caption: 'Peers', cols: ['Ticker', 'Gross margin', 'Revenue growth'], rows: PEERS.map((p) => [p[0], `${fmt.num(p[1], 1)}%`, `${fmt.signed(p[2], 1)}%`]) }) });
}
function signals() {
  const S = [['Structure flip', 64, 41], ['Wall touch', 118, 63], ['Score ≥ 70', 52, 31], ['Term flip', 23, 11]];
  const n = S.length;
  const rows = S.map(([name, nn, k], i) => ({ name, n: nn, k, p: k / nn, ci: wilson(k, nn), y: i + 1 }));
  const body = plot({ height: n * 44 + 36, pl: 150, pr: 70, prn: 50, pt: 8, pb: 26, ends: false, x: { min: 0.2, max: 0.9, ticks: [0.25, 0.5, 0.75].map((v) => ({ v, label: `${v * 100}%` })) }, y: { min: n + 0.5, max: 0.5, ticks: [] }, segs: [{ x0: 0.5, y0: 0.5, x1: 0.5, y1: n + 0.5, role: 'edge', width: 1, dash: '4 4', essential: false }, ...rows.map((r) => ({ x0: r.ci[0], y0: r.y, x1: r.ci[1], y1: r.y, role: 'edge', width: 2 }))], dots: rows.map((r) => ({ x: r.p, y: r.y, role: 'emph', size: 10 })), pointLabels: rows.map((r) => ({ x: r.ci[1], y: r.y, text: `${Math.round(r.p * 100)}% · n ${r.n}`, pos: 'r' })), aria: rows.map((r) => `${r.name} ${Math.round(r.p * 100)}% of ${r.n}`).join(', ') });
  const names = rows.map((r) => `<span style="position: absolute; right: calc(100% + 12px); top: ${(((r.y - 0.5) / n) * 100).toFixed(2)}%; transform: translateY(-50%); font-size: 12.5px; color: var(--phosphor); white-space: nowrap;">${r.name}</span>`).join('');
  return chartFrame({ claim: 'Design target: how often each signal was right after costs, with how sure that is', sub: 'Share of signals that moved the way they pointed within 5 days, after costs · dot = rate, bar = 95% interval (Wilson), dashed = 50% · blocked: grading needs a daily price history licensed to Convexa (TradingView’s frame is display-only)', body: body.replace('<div class="pa">', `<div class="pa">${names}`), source: 'Sample · shaped like graded signals', sourceKind: 'dashed', asof: 'Scenario · Oct 7, 2026', kind: 'sample', state: 'sample', stateText: 'Design target · blocked' });
}

export function toolsBody({ scheme = 'dark', minHeight = 0 } = {}) {
  const T = (title, ids, status, defects, after) => baRow({ title: `${title} ${statusChip(status)}`, ids, before: '', defects, after });
  const rows = [
    T('Liquidity', 'PT-01 · DB-04', 'build', ['The v4 claim “fell $86B” didn’t match its own series (−$70B)', 'Axis from 5.5 without saying so; dated the day read, not the H.4.1 Wednesday'], liquidity()),
    T('Calendar', 'PT-02', 'build', ['A list; nothing showed how near each date is'], calendar()),
    T('Off-exchange volume', 'PT-03 · DB-07', 'build / verify', ['The claim cites a 12-week median the v4 chart never drew', 'No y scale; half the latest bar highlighted'], otc()),
    T('Insider clusters', 'PT-04 · DB-08', 'build', ['Rings spaced by index, not date; 6 rings for “12 sales”'], clusters()),
    T('Fund holdings (13F)', 'PT-05', 'build', ['Delta pills at 3.97:1 (measured, dark); the 45-day lag unstated'], holders()),
    T('Figures from XBRL', 'PT-06', 'switch', ['Restatements invisible; no filing per figure'], xbrl()),
    T('Peers', 'PT-07 · DB-09', 'build', ['No ticks; every dot unlabelled except in a list'], peers()),
    T('Signal track record', 'PT-08 · DB-10', 'blocked', ['The gap value was never printed; no intervals', 'The blocked target wore a solid “Computed” tag instead of the sample treatment'], signals()),
    T('Technical analysis', 'PT-09', 'live (TradingView chart) / blocked', ['Convexa’s own readings stay blocked; TradingView’s frame is display-only'], `${thirdPartyFrame({ height: 360, mini: true })}<div class="hd-p" style="gap: 8px;"><div class="ph"><h3>Readings Convexa would compute</h3><span class="stag k-quiet">Not live · price source</span></div><span class="dline">EMA 20/50, RSI 14, ADX, ATR, relative strength and realized vol need a daily price history licensed to Convexa. None is drawn from TradingView’s frame.</span></div>`),
  ];
  return v5Wrap(`${v5Head('The planned tools, charted', 'Each planned tool arrives designed: a claim its data supports, a form chosen for its question, its source and delay at the foot, and its honest state. Build status words appear on this board only (P-4).', 'PT-01–PT-09, DB-04, DB-07–DB-10')}${rows.join('')}`, { scheme, minHeight });
}
