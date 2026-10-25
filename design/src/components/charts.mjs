// Chart primitives (v5, 2026-10-13) — the one chart system, as library entries. Each primitive renders
// itself in a ready state, the variants that matter for it (focused, collided, gapped…), and the seven
// data states every chart owes: loading at final size, empty, error with cause, stale (last good copy),
// not live, sample, demo. The `spec` names the shared React module the build step creates under
// apps/dashboard/src/app/shared/charts/ and what it replaces.
import { chartFrame, dataTable, fmt, legend, plot, rangeBar, smallMultiples, sparkline, stateBody, ticks } from '../chart-kit.mjs';
import { CFTC, CFTC_CATS, CURVES, DAYS, EVENTS, SI, SI_GAP, TENORS, curveAgo, dLabel, dLong, dayIndex, latestCurve, monthStarts, rangeStats, spread2s10s } from '../data/charts.mjs';
import { tvFrame, TV_CHIP } from './tradingview.mjs';
import { provChip, stateTag } from './data-states.mjs';

export const SHARED = 'apps/dashboard/src/app/shared/charts';

// ---- the demo charts every primitive is shown on -----------------------------------------------
const N = spread2s10s.length;
const ms = monthStarts();
const xTicksYear = ms.filter((m, k) => k % 2 === 0).map((m) => ({ v: m.i, label: { long: `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m.m]} ’${String(m.y).slice(2)}`, short: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][m.m] }, minor: false }));
const sp = spread2s10s.map((v, i) => [i, v]);
const spVals = spread2s10s.filter((v) => v != null);
const spLo = Math.min(...spVals), spHi = Math.max(...spVals);
// under 480px of container only the latest decision keeps its chip; every decision keeps its hairline and its table row
const evs = () => EVENTS.map((e, i, a) => ({ x: dayIndex(e.t), label: e.label, title: e.title, minor: e.minor, keep: i === a.length - 1 }));
const lastSp = spVals[spVals.length - 1];

export function spreadPlot({ height = 230, focus = null, events = true, gap = true, dim = false, keyboard = true } = {}) {
  return plot({
    height, pt: events ? 34 : 18, pl: 52, pr: 96, prn: 56,
    x: { min: 0, max: N - 1, ticks: xTicksYear },
    y: { min: 0, max: 1.2, ticks: ticks(0, 1.2, 0.4, (v) => (v === 1.2 ? `${fmt.num(v, 1)} pp` : fmt.num(v, 1))) },
    hlines: [{ v: 0, kind: 'zero', label: 'Inverted below 0' }],
    series: [{ id: 'sp', points: sp, role: dim ? 'ctx2' : 'emph', end: { long: '2s10s', short: '2s10s' }, endValue: `${fmt.num(lastSp)} pp` }],
    gaps: gap ? [{ x0: 167.5, x1: 169.5, label: { long: 'Not published', short: '—' } }] : [],
    events: events ? evs() : [], eventLane: { long: 'FOMC', short: 'Fed' },
    focus, keyboard,
    aria: `2s10s spread, daily, Oct 2025 to Oct 2026: between ${fmt.num(spLo)} and ${fmt.num(spHi)} points, ${fmt.num(lastSp)} now; FOMC decisions marked.`,
  });
}
const spreadTable = () => dataTable({ caption: '2s10s spread at each month start, percentage points', cols: ['Date', '10Y − 2Y (pp)'], rows: ms.map((m) => [dLong(m.t), spread2s10s[m.i] == null ? { t: 'not published' } : fmt.num(spread2s10s[m.i])]) });

const curveFrame = (o = {}) => {
  const now = latestCurve, mo = curveAgo(21), yr = curveAgo(250);
  const tx = (tau) => Math.sqrt(tau); // stated in the subtitle
  const pts = (c) => TENORS.map(([, tau], k) => [tx(tau), c.ys[k]]);
  return plot({
    height: o.height || 240, pr: 104, prn: 60,
    x: { min: tx(1 / 12), max: tx(30), ticks: TENORS.filter(([n]) => ['3M', '1Y', '2Y', '5Y', '10Y', '30Y'].includes(n)).map(([n, tau]) => ({ v: tx(tau), label: n, minor: ['1Y', '3M'].includes(n) })) },
    y: { min: 3, max: 5, ticks: ticks(3, 5, 0.5, (v) => (v === 5 ? '5.0 %' : fmt.num(v, 1))) },
    series: [
      { id: 'yr', points: pts(yr), role: 'ctx2', end: { long: `Oct 13 ’25`, short: '1Y ago' }, endValue: fmt.pct(yr.ys[10]) },
      { id: 'mo', points: pts(mo), role: 'ctx', end: { long: 'Sep 10', short: '1M ago' }, endValue: fmt.pct(mo.ys[10]) },
      { id: 'now', points: pts(now), role: 'emph', width: 2.5, dots: true, end: { long: 'Oct 9', short: 'Now' }, endValue: fmt.pct(now.ys[10]) },
    ],
    pointLabels: [{ x: tx(2), y: now.ys[4], text: fmt.pct(now.ys[4]), pos: 'b', minor: true }, { x: tx(10), y: now.ys[8], text: fmt.pct(now.ys[8]) }],
    focus: o.focus, keyboard: o.keyboard !== false,
    aria: `Treasury par yield curve now, a month ago and a year ago, 1 month to 30 years. 2-year ${fmt.pct(now.ys[4])}, 10-year ${fmt.pct(now.ys[8])}.`,
  });
};

// ---- the seven data states, at final size, for any primitive ----------------------------------
const STATE_COPY = {
  loading: { text: '' },
  empty: { text: 'No par yields in this range.', cause: 'Oct 10–13, 2026 is a weekend and Columbus Day; the Treasury publishes on business days after 3:30 PM ET. Widen the range, or the next curve lands Oct 14.' },
  error: { text: 'Couldn’t load the Treasury’s curve.', cause: 'Our request to /api/public-data/rates timed out after 10 s at 06:10 ET. Nothing is shown rather than a guess.', action: '<button class="btn secondary sm" type="button">Try again</button>' },
  notLive: { text: 'Not live on this site: dealer gamma needs a paid options feed this site doesn’t run.', cause: 'Rates, positioning and filings on this page are live; FINRA’s short data is off until its terms are confirmed.', action: '<a class="t-info" href="#sample">See a labelled sample →</a>' },
};
export const DATA_STATE_KEYS = ['loading', 'empty', 'error', 'stale', 'notLive', 'sample', 'demo'];
/** Draw a chart frame in one of the seven data states. ready(o) returns { body, table } for the ready mark. */
export function inState(state, { claim, sub, source, asof, ready, height = 230, name = '2s10s spread, past year' }) {
  if (state === 'stale') { const r = ready({ dim: true }); return chartFrame({ claim, sub, body: r.body, source, asof: 'Last good copy · fetched Oct 8, 06:10 ET · the Treasury hasn’t published since', state: 'stale', table: r.table }); }
  // D1 (owner, 2026-10-22): a sample frame names the sample once, here by its dashed source chip, so no head tag.
  if (state === 'sample') { const r = ready({}); return chartFrame({ claim, sub, body: r.body, source: 'Sample · shaped like the Treasury’s daily curve', sourceKind: 'dashed', asof: 'Scenario · Oct 7, 2026', kind: 'sample', table: r.table }); }
  if (state === 'demo') { const r = ready({}); return chartFrame({ claim, sub, body: r.body, source: 'Demo · shaped like U.S. Treasury data', sourceKind: 'dashed', asof: 'Scenario · Oct 7, 2026', kind: 'sample', table: r.table }); }
  const c = STATE_COPY[state];
  // A claim needs data: without it the title names the metric (P-10, loading included), never a finding computed from nothing.
  const titles = { loading: name, empty: name, error: name, notLive: 'Dealer gamma by strike' };
  const subs = { notLive: 'Net dealer gamma by strike · $ per 1% move · all expirations', loading: '' };
  return chartFrame({ claim: titles[state], sub: subs[state] ?? sub, body: stateBody(state, { height, ...c }), source: state === 'loading' || state === 'notLive' ? '' : source, asof: state === 'error' ? 'Last attempt · Oct 9, 06:10 ET' : state === 'empty' ? 'Checked · Oct 9' : '', state: state === 'loading' || state === 'empty' ? '' : state === 'error' ? 'error' : 'notLive' }); // FND-11: no Loading or Nothing yet tag (P-2)
}
const spreadReady = (o) => ({ body: spreadPlot({ dim: o.dim }), table: spreadTable() });
const SP_CLAIM = `The 2s10s spread stayed positive all year: ${fmt.num(spLo)} to ${fmt.num(spHi)} points, ${fmt.num(lastSp)} now`;
const SP_SUB = '10-year minus 2-year Treasury par yield · percentage points · daily, Oct 13 2025 – Oct 9 2026 · FOMC decisions marked';
const SP_SRC = 'U.S. Treasury · par yield curve';
const stateEntries = (ready = spreadReady, claim = SP_CLAIM, sub = SP_SUB) => DATA_STATE_KEYS.map((k) => ({ label: { loading: 'Loading · final size', empty: 'Empty · teaches', error: 'Error · cause + retry', stale: 'Stale · last good copy', notLive: 'Not live', sample: 'Sample', demo: 'Demo' }[k], props: { state: k, claim, sub, ready } }));
const renderState = (p) => inState(p.state, { claim: p.claim, sub: p.sub, source: SP_SRC, asof: 'As of Oct 9, 2026 · 6:00 PM ET', ready: p.ready });

// ---- the primitives -----------------------------------------------------------------------------
const spec = (id, name, react, path, change, notes = '') => ({ id, name, react, path: `${SHARED}/${path}`, change, notes });

const frame = {
  spec: spec('chart-frame', 'Chart frame', 'ChartFrame (new)', 'ChartFrame.tsx', 'One &lt;figure&gt; for every Convexa chart: claim title (a finding), subtitle (metric · unit · period), legend for ≥ 2 series, the plot, source chip + as-of, the table twin. Border is provenance (solid ours / primary, dotted third party, dashed sample). Replaces ChartTitle + FIGURE_SX + per-page captions (publicUi.tsx, Charts.tsx, MarketsPage.tsx).', 'Keeps its final height in every state (CLS 0). States come from the data-state vocabulary, never a new word.'),
  states: [{ label: 'Ready · primary source', props: { state: 'ready' } }, ...stateEntries()],
  render: (p) => (p.state === 'ready' ? chartFrame({ claim: SP_CLAIM, sub: SP_SUB, body: spreadPlot(), source: SP_SRC, sourceHref: 'https://home.treasury.gov/', asof: 'As of Oct 9, 2026 · 6:00 PM ET', table: spreadTable() }) : renderState(p)),
};

const axes = {
  spec: spec('chart-axes', 'Axes and gridlines', 'Plot · YAxis · XAxis (new)', 'Plot.tsx · scales.ts', 'Solid hairline grid (line), ≤ 5 y ticks on clean steps, the unit once on the top tick, mono tick labels at 11px; the zero line one step stronger (line2) and named when it means something (“Inverted below 0”). Bars always start at 0; a line may start elsewhere and says so. Replaces dashed grids (Charts.tsx:142-169, MarketsPage.tsx:305-320) and unlabelled units.'),
  states: [{ label: 'Line · zero named', props: 'zero' }, { label: 'Bars · baseline 0', props: 'bars' }, ...stateEntries()],
  render: (p) => {
    if (typeof p === 'object') return renderState(p);
    if (p === 'bars') {
      const v = SI.map((s, i) => ({ x: i, v: i === SI_GAP ? 0 : s.shares, role: i === SI.length - 1 ? 'emph' : 'ctx', out: i === SI_GAP }));
      return chartFrame({ claim: 'Shares sold short rose 9% over the year, to 286M', sub: 'NVDA shares short at each FINRA settlement · millions of shares · Oct 2025 – Oct 2026', body: plot({ height: 200, pr: 24, prn: 16, x: { min: -0.5, max: SI.length - 0.5, ticks: SI.filter((_, i) => i % 4 === 0).map((s) => ({ v: s.i, label: { long: s.label, short: s.label.split(' ')[0] } })) }, y: { min: 0, max: 300, ticks: ticks(0, 300, 100, (t) => (t === 300 ? '300M' : String(t))) }, hlines: [{ v: 0, kind: 'zero' }], bars: v, gaps: [{ x0: SI_GAP - 0.5, x1: SI_GAP + 0.5, label: { long: 'Not published', short: '—' } }], aria: 'Shares short at 24 FINRA settlements; one settlement not published.' }), source: 'FINRA · short interest', asof: 'Settlement Sep 30 · published Oct 9', table: '' });
    }
    return chartFrame({ claim: SP_CLAIM, sub: SP_SUB, body: spreadPlot({ events: false }), source: SP_SRC, asof: 'As of Oct 9, 2026' });
  },
};

const labels = {
  spec: spec('direct-labels', 'Direct labels and collisions', 'DirectLabels + labelLayout.ts (new)', 'DirectLabels.tsx · labelLayout.ts', 'Lines end in their name and last value; a label that would land within 30px of another moves and keeps a leader to its line; a third collision sends the set to the legend + table. Selective labels only: the latest, the extreme, the one that matters. Never a number on every point. Replaces the overlapping right-edge date labels (MarketsPage.tsx:378-399) and label thinning that hides values from sighted readers (Charts.tsx:70-106).'),
  states: [{ label: 'Three lines · collision resolved with leaders', props: 'collide' }, { label: 'Phone · short labels', props: 'phone' }, ...stateEntries()],
  render: (p) => (typeof p === 'object' ? renderState(p) : chartFrame({ claim: 'The curve steepened: the front end fell ~0.5 points, the 30-year barely moved', sub: 'U.S. Treasury par yields by maturity · percent · Oct 9 vs a month and a year earlier · maturities spaced by √years', body: `<div style="${p === 'phone' ? 'max-width: 360px;' : ''}">${curveFrame()}</div>`, legendHtml: legend([{ name: 'Oct 9', role: 'emph' }, { name: 'Sep 10', role: 'ctx' }, { name: 'Oct 13, 2025', role: 'ctx2' }]), source: SP_SRC, asof: 'As of Oct 9, 2026' })),
};

const events = {
  spec: spec('event-lane', 'Annotations and event markers', 'EventLane + events.ts (new)', 'EventLane.tsx · events.ts', 'One lane above the plot for dated events — FOMC decisions, filings (8-K, 10-Q, 10-K), results, CPI — each a labelled chip on a hairline, never a coloured dot alone. Chips within 9% of each other drop to a second lane; under 480px only priority events stay and the rest live in the table. An event is a fact with a source: filings link to EDGAR, FOMC to the Fed. Replaces: nothing (no Convexa chart marks events today).'),
  states: [{ label: 'FOMC decisions on the 2s10s', props: 'fomc' }, { label: 'Focused event', props: 'focus' }, ...stateEntries()],
  render: (p) => (typeof p === 'object' ? renderState(p) : chartFrame({ claim: SP_CLAIM, sub: SP_SUB, body: spreadPlot({ focus: p === 'focus' ? { x: dayIndex(EVENTS[4].t), title: `${dLong(DAYS[dayIndex(EVENTS[4].t)])} · FOMC decision`, rows: [{ role: 'emph', value: `${fmt.num(spread2s10s[dayIndex(EVENTS[4].t)])} pp`, name: '2s10s' }] } : null }), source: SP_SRC, asof: 'As of Oct 9, 2026' })),
};

const band = {
  spec: spec('range-band', 'Range band', 'RangeBand (new)', 'RangeBand.tsx', 'An interval drawn as a chartBand wash with steel2 edge hairlines and labelled bounds — a forecast interval, a year’s range, a valuation range. It states what it is (“3-year 10th–90th percentile”, “95% interval, Wilson”). Never a band that is true by construction (the 2s10s band was its own min–max, MarketsPage.tsx:555-562).'),
  states: [{ label: '10th–90th percentile band behind a weekly series', props: 'band' }, ...stateEntries()],
  render: (p) => {
    if (typeof p === 'object') return renderState(p);
    const s = CFTC.series.asset; const st = rangeStats(s); const n = s.length;
    const roll = s.map((_, i) => { const w = s.slice(Math.max(0, i - 51), i + 1).slice().sort((a, b) => a - b); return [i, w[Math.floor(w.length * 0.1)] / 1e3, w[Math.min(w.length - 1, Math.floor(w.length * 0.9))] / 1e3]; });
    return chartFrame({ claim: `Asset managers are near the top of their 1-year range: ${fmt.compact(st.last)} net long`, sub: 'Net futures position of asset managers, 10-year T-note · thousands of contracts · weekly, 3 years · band = trailing 52-week 10th–90th percentile', legendHtml: legend([{ name: 'Net position', role: 'emph' }, { name: 'Trailing-year 10th–90th pct', band: true }]), body: plot({ height: 220, pr: 92, x: { min: 0, max: n - 1, ticks: [{ v: 0, label: 'Oct ’23', align: 0 }, { v: 52, label: 'Oct ’24' }, { v: 104, label: 'Oct ’25' }, { v: n - 1, label: 'Oct ’26', align: 1 }] }, y: { min: 600, max: 1400, ticks: ticks(600, 1400, 200, (v) => (v === 1400 ? '1,400K' : fmt.num(v, 0))) }, bands: [{ points: roll.slice(51) }], series: [{ points: s.map((v, i) => [i, v / 1e3]), role: 'emph', end: { long: 'Net long', short: 'Net' }, endValue: `${fmt.compact(st.last)}` }], aria: 'Asset managers net long in 10-year note futures, weekly over three years, with the trailing-year 10th–90th percentile band.' }), source: 'CFTC · Traders in Financial Futures', asof: 'Positions Tue Oct 6 · published Fri Oct 9' });
  },
};

const rbar = {
  spec: spec('range-bar', 'Range bar', 'RangeBar (new)', 'RangeBar.tsx', 'Where a value sits in its range: a track, the band (when there is one), the median tick, the value marker (phosphor, 4px), and the base diamond — amber, the one amber mark on a chart. Every mark is named under the bar or in the legend line: the median tick was never explained (MarketsPage.tsx:894-926). Zero is marked when the range crosses it (long ↔ short).'),
  states: [{ label: 'CFTC row · median and zero named', props: 'cftc' }, { label: 'Valuation · bear–base–bull + price', props: 'val' }, ...stateEntries()],
  render: (p) => {
    if (typeof p === 'object') return renderState(p);
    if (p === 'val') return `<div style="display: flex; flex-direction: column; gap: 6px; width: 100%; max-width: 560px;"><span class="caps">Value per share · the note’s scenarios</span>${rangeBar({ lo: 100, hi: 280, band: [132, 248], base: 196, now: null, labels: [{ v: 132, text: 'Bear $132' }, { v: 196, text: 'Base $196' }, { v: 248, text: 'Bull $248' }], aria: 'Bear 132, base 196, bull 248 dollars per share' })}<span class="dline">The band is the bear–bull range, solid to its ends (the soft-ended gradient understated it). The amber diamond is the base case. Price is not drawn: Convexa holds no licensed price.</span></div>`;
    const s = CFTC.series.lev; const st = rangeStats(s);
    return `<div style="display: flex; flex-direction: column; gap: 6px; width: 100%; max-width: 560px;"><div style="display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap;"><span style="font-size: 13px; font-weight: 600;">Leveraged funds · 10-year note</span><span class="mono" style="font-size: 13px;">${fmt.compact(st.last)} <span style="color: var(--steel); font-size: 11px;">net · ${st.pct}% of 3-yr range</span></span></div>${rangeBar({ lo: st.min, hi: st.max, median: st.median, now: st.last, band: [st.p10, st.p90], labels: [{ v: st.min, text: `${fmt.compact(st.min)} 3-yr low`, align: 0 }, { v: st.max, text: `${fmt.compact(st.max)} high`, align: 1 }], aria: `Leveraged funds net ${fmt.compact(st.last)}, ${st.pct}% of the 3-year range; median ${fmt.compact(st.median)}` })}<span class="dline">Tick = 3-year median (${fmt.compact(st.median)}). Band = 10th–90th percentile. Bar = this week.</span></div>`;
  },
};

const multiples = {
  spec: spec('small-multiples', 'Small multiples', 'SmallMultiples (new)', 'SmallMultiples.tsx', 'More than three series become facets on shared scales, one series each, no categorical palette: three columns, two under 720px of container, one under 480. Used for CFTC categories, curve decomposition and peers. Replaces multi-hue legends that the grayscale test would fail.'),
  states: [{ label: 'Four CFTC categories, shared scale', props: 'cftc' }, ...stateEntries()],
  render: (p) => {
    if (typeof p === 'object') return renderState(p);
    const items = CFTC_CATS.map((c) => { const s = CFTC.series[c.key]; const st = rangeStats(s); return { title: c.name, value: `${fmt.num(st.last / 1e3, 0)}K net · ${st.pct}% of 3-yr range`, body: plot({ height: 96, pt: 8, pb: 20, pl: 44, pr: 12, prn: 12, ends: false, keyboard: false, x: { min: 0, max: s.length - 1, ticks: [{ v: 0, label: '’23', align: 0 }, { v: s.length - 1, label: '’26', align: 1 }] }, y: { min: -1400, max: 1400, ticks: [{ v: -1000, label: '−1,000' }, { v: 0, label: '0' }, { v: 1000, label: '+1,000' }] }, hlines: [{ v: 0, kind: 'zero' }], series: [{ points: s.map((v, i) => [i, v / 1e3]), role: 'emph', width: 1.5 }], aria: `${c.name} net position, weekly, 3 years` }) }; });
    return chartFrame({ claim: 'Asset managers and leveraged funds hold opposite sides, as they have for three years', sub: 'Net futures positions, 10-year T-note · thousands of contracts · weekly, Oct 2023 – Oct 2026 · same scale in every panel', body: smallMultiples(items, { cols: 4 }), source: 'CFTC · Traders in Financial Futures', asof: 'Positions Tue Oct 6 · published Fri Oct 9' });
  },
};

const spark = {
  spec: spec('sparkline', 'Sparkline', 'Sparkline (new; replaces lib sparkline + MiniChart bars)', 'Sparkline.tsx', 'A sparkline states its scaling (“own range” or “0-based”) and prints its end value; gaps break the line. A sparkbar that can go negative draws below a zero line — the index mini chart drew HOOD’s −90% margin as a 3px stub (ResearchIndexPage.tsx:98).'),
  states: [{ label: 'Line · own range, end value', props: 'line' }, { label: 'Bars · crosses zero', props: 'neg' }, ...stateEntries()],
  render: (p) => {
    if (typeof p === 'object') return renderState(p);
    if (p === 'neg') {
      const m = [-90.4, -74.4, -28.7, 4.2, 12.6, 18.1];
      return `<div style="display: flex; flex-direction: column; gap: 6px; width: 240px;"><span style="font-size: 12px; color: var(--steel);">Operating margin, % · FY21–FY26 · 0-based</span>${plot({ height: 72, pt: 6, pb: 6, pl: 0, pr: 44, prn: 44, keyboard: false, ends: false, x: { min: -0.5, max: 5.5, ticks: [] }, y: { min: -100, max: 30, ticks: [] }, hlines: [{ v: 0, kind: 'zero' }], bars: m.map((v, i) => ({ x: i, v, role: i === 5 ? 'emph' : 'ctx' })), pointLabels: [{ x: 5, y: 18.1, text: '18.1%' }, { x: 0, y: -90.4, text: '−90.4%', pos: 'b' }], aria: 'Operating margin from −90.4% to 18.1% over six years' })}</div>`;
    }
    return `<div style="display: flex; flex-direction: column; gap: 6px;">${sparkline(spread2s10s.slice(-120), { width: 140, height: 28, value: `${fmt.num(lastSp)} pp`, scale: 'own range · 6 mo', aria: `2s10s over six months, ${fmt.num(lastSp)} points now` })}</div>`;
  },
};

const scrub = {
  spec: spec('crosshair', 'Crosshair, scrub and readout', 'Crosshair + useScrub (new)', 'Crosshair.tsx · useScrub.ts', 'A hairline snaps to the nearest data x; every series at that x is ringed and listed in one readout (value first, mono; series second; a line key, never a box). Pointer, touch-drag (24px target) and keyboard drive the same index. Hover state lives in a ref + an isolated subtree, so scales never re-render on pointermove (CH7). The readout never holds the only copy of a value: the table twin does.'),
  states: [{ label: 'Scrubbed · readout', props: 'scrub' }, ...stateEntries()],
  render: (p) => {
    if (typeof p === 'object') return renderState(p);
    const fx = 199; return chartFrame({ claim: SP_CLAIM, sub: SP_SUB, body: spreadPlot({ focus: { x: fx, title: dLong(DAYS[fx]), rows: [{ role: 'emph', value: `${fmt.num(spread2s10s[fx])} pp`, name: '2s10s' }, { role: 'ctx', value: fmt.pct(CURVES[fx].ys[8]), name: '10-year' }, { role: 'ctx2', value: fmt.pct(CURVES[fx].ys[4]), name: '2-year' }] } }), source: SP_SRC, asof: 'As of Oct 9, 2026' });
  },
};

const keys = {
  spec: spec('chart-keyboard', 'Keyboard path', 'useChartKeyboard (new)', 'useChartKeyboard.ts', 'One tab stop per chart (role="group", aria-roledescription="chart"). ← → move one point, Shift+← → a month, Home/End first/last, PgUp/PgDn ten percent, Enter pins the readout, Esc clears. The readout text goes to a polite live region. The focus ring is the authored amber ring (rule 6) on the chart and on the focused point — the only amber besides the base diamond.'),
  states: [{ label: 'Focused · point 2 of 251', props: 'kbd' }, ...stateEntries()],
  render: (p) => {
    if (typeof p === 'object') return renderState(p);
    const fx = 214; return chartFrame({ claim: SP_CLAIM, sub: SP_SUB, body: `${spreadPlot({ focus: { x: fx, title: `${dLong(DAYS[fx])} · point ${fx + 1} of ${N}`, rows: [{ role: 'emph', value: `${fmt.num(spread2s10s[fx])} pp`, name: '2s10s' }] } })}<p class="cf-note" aria-live="polite"><span class="kbd">←</span> <span class="kbd">→</span> one day · <span class="kbd">⇧</span>+arrows one month · <span class="kbd">Home</span> <span class="kbd">End</span> · <span class="kbd">↵</span> pin · <span class="kbd">esc</span> clear</p>`, source: SP_SRC, asof: 'As of Oct 9, 2026' });
  },
};

const table = {
  spec: spec('data-table', 'Data table twin', 'ChartTable (new)', 'ChartTable.tsx', 'Every chart carries its numbers: a native &lt;details&gt; “Show the numbers”, a labelled focusable scroll box, a caption, th scope on both axes, mono figures, words for gaps (“not published”, never 0). Closed by default; never the only copy of a value either way.'),
  states: [{ label: 'Open', props: 'open' }, ...stateEntries()],
  render: (p) => (typeof p === 'object' ? renderState(p) : `<div style="width: 100%; max-width: 520px;">${dataTable({ caption: '2s10s spread at each month start, percentage points', cols: ['Date', '10Y − 2Y (pp)'], rows: ms.slice(0, 6).map((m) => [dLong(m.t), spread2s10s[m.i] == null ? { t: 'not published' } : fmt.num(spread2s10s[m.i])]), open: true })}</div>`),
};

const motion = {
  spec: spec('chart-motion', 'Reduced motion', '— (CSS + useReducedMotion)', 'chartMotion.ts', 'Charts do not animate on load (no grow-in, no count-up). Motion only between related states, ≤ 600ms, transform/opacity, preserving object constancy (the curve morph as the month changes, a bridge step). Under prefers-reduced-motion every one of those is an instant swap with the same end state. None is a keyframe, so the one-motion-moment inventory is unchanged.'),
  states: [{ label: 'Between two months · full motion vs reduced', props: 'm' }, ...stateEntries()],
  render: (p) => (typeof p === 'object' ? renderState(p) : `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr)); gap: 12px; width: 100%;"><div class="panel" style="padding: 12px 14px;"><span class="caps">Full motion</span><p class="dline" style="margin: 6px 0 0;">Curve points tween 400ms ease-out from Sep to Oct; labels cross-fade 160ms. Interruptible: a new month retargets from the current position.</p></div><div class="panel" style="padding: 12px 14px;"><span class="caps">Reduced motion</span><p class="dline" style="margin: 6px 0 0;">The October curve replaces September in one frame. The month label and the readout change in the same frame. Nothing else differs.</p></div></div>`),
};

const prov = {
  spec: spec('chart-provenance', 'Provenance, as-of and units', 'ChartFrame foot + ProvenanceChip', 'ChartFrame.tsx', 'Foot of every chart: the provenance chip (solid primary, dotted third party, dashed sample), then the as-of in mono (“Positions Tue Oct 6 · published Fri Oct 9”). The unit appears once in the subtitle and once on the top tick; the readout and the table repeat it. Mono for a figure Convexa traced; Sans with a dotted rule for an untraced figure (rule 23).'),
  states: [{ label: 'Primary · third party · sample', props: 'all' }, ...stateEntries()],
  render: (p) => (typeof p === 'object' ? renderState(p) : `<div style="display: flex; flex-direction: column; gap: 10px; width: 100%;"><div class="cf-foot">${provChip('U.S. Treasury · par yield curve', 'solid', 'https://home.treasury.gov/')}<span class="cf-asof">As of Oct 9, 2026 · 6:00 PM ET</span></div><div class="cf-foot">${provChip(TV_CHIP, 'dotted')}<span class="cf-asof">Convexa reads nothing from this frame</span></div><div class="cf-foot">${provChip('Sample · shaped like CFTC data', 'dashed')}<span class="cf-asof">Scenario · Oct 7, 2026</span></div></div>`),
};

const phone = {
  spec: spec('chart-phone', 'Phone re-layout', 'Plot container queries (useWidth / ResizeObserver)', 'Plot.tsx', 'Charts measure their container and re-lay themselves out; they are never scaled down, so text never falls under 11px. Under 480px: short labels, minor ticks and minor events drop, the right gutter narrows, legends move above, small multiples go to one column, columns with long names become horizontal bars. Replaces the 9–10px labels (Charts.tsx:77-78, ScorecardPage.tsx:565-592) and viewBox scale-down under 280px (MarketsPage.tsx:256).'),
  states: [{ label: 'The 2s10s at 340px', props: 'p' }, ...stateEntries()],
  render: (p) => (typeof p === 'object' ? renderState(p) : `<div style="width: 340px; max-width: 100%;">${chartFrame({ claim: 'The 2s10s stayed positive all year', sub: '10Y − 2Y · pp · daily, past year', body: spreadPlot({ height: 200 }), source: 'U.S. Treasury', asof: 'Oct 9, 2026' })}</div>`),
};

const third = {
  spec: spec('third-party-frame', 'Third-party frame', 'ThirdPartyFrame (new; wraps TradingViewEmbed)', '../embeds/ThirdPartyFrame.tsx', 'A frame Convexa does not draw: a descriptive name, never a claim (Convexa makes no claim about data it doesn’t read); the dotted chip above it; a dotted fence with an 8px inset so the party’s own palette never touches Convexa’s chrome; the party’s attribution untouched below; the privacy line. No crosshair, no table twin, no state words of ours inside it. Replaces the literal rgba fence in TradingViewEmbed (dark-scheme value used in both schemes).'),
  states: [{ label: 'Live · TradingView', props: 'live' }, { label: 'Loading · final size', props: 'loading' }, { label: 'Script blocked', props: 'blocked' }],
  render: (p) => `<div style="width: 100%; max-width: 640px;">${thirdPartyFrame({ state: p, height: 300, mini: true })}</div>`,
};

/** The deliberate line: Convexa's figure vs a third party's frame. */
export function thirdPartyFrame({ ticker = 'NVDA', state = 'live', height = 620, phoneHeight = 480, mini = false } = {}) {
  const inner = state === 'loading'
    ? `<div class="tvf" role="status" aria-busy="true" style="--tvh: ${height}px; --tvph: ${phoneHeight}px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--line); border-radius: 10px; background: var(--panel);"><span style="font-size: 13px; color: var(--steel);">Loading TradingView’s chart…</span></div>`
    : tvFrame({ ticker, state, height, phoneHeight, mini });
  return `<section class="tpf" aria-label="${ticker} daily chart by TradingView"><div class="tpf-h"><h3 class="tpf-name">${ticker} daily chart</h3>${provChip(TV_CHIP, 'dotted', `https://www.tradingview.com/symbols/NASDAQ-${ticker}/`)}${stateTag('thirdParty')}</div><div class="tpf-fence">${inner}</div><p class="tpf-note">TradingView draws this from its own prices; your browser sends it your IP address and this page’s address. Convexa reads, stores and computes nothing from it.</p></section>`;
}
export const TPF_CSS = `
  .tpf { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .tpf-h { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
  .tpf-name { margin: 0; font: 600 15px/1.35 'IBM Plex Sans', sans-serif; color: var(--phosphor); }
  .tpf-fence { padding: 8px; border: 1px dotted var(--steel-2); border-radius: 14px; background: var(--ink-2); }
  .tpf-fence .tvf { border-color: var(--line) !important; }
  .tpf-note { margin: 0; max-width: 640px; font-size: 12px; line-height: 1.45; color: var(--steel); }
  .tvf { height: var(--tvh); }
  @media (max-width: 767px) { .tvf { height: var(--tvph); } }
  .tvf[aria-busy="true"] { background: var(--panel); }
`;

export const chartEntries = [frame, axes, labels, events, band, rbar, multiples, spark, scrub, keys, table, motion, prov, phone, third].map((e) => ({ ...e, group: 'Charts', col: true }));
export { curveFrame, spreadTable, SP_CLAIM, SP_SUB, SP_SRC };
