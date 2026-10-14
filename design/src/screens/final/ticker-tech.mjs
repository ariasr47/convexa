// Final · Convexa v1 — the Technical tab (/ticker/:symbol/technical-analysis).
// Production: TradingView's advanced chart as TradingView's (P-8 dotted frame, P-14 loads on view, candles
// kept, privacy line, loading in words, 12 s timeout). Staging: Convexa's own chart drawn from the demo's
// 60 sample bars, computed exactly as libs/api/src/lib/demo/indicators.ts does (EMA with SMA seed, Wilder
// RSI, Wilder ADX, simple-mean ATR), in a dashed, hatched sample frame.
import { icon, v4Page } from '../../lib.mjs';
import { chartFrame, dataTable, fmt, plot, stateBody } from '../../chart-kit.mjs';
import { thirdPartyFrame } from '../../components/charts.mjs';
import { provChip, stateTag } from '../../components/data-states.mjs';
import { statesBoard } from '../v4/kit.mjs';
import { DEMO_DESK } from './ticker-desk.mjs';

export const TT_CSS = `
  .tch { padding-top: 24px; display: flex; flex-direction: column; gap: 20px; }
  .tch-mast { display: flex; flex-wrap: wrap; gap: 12px 32px; align-items: flex-end; }
  .tch-mast .who { flex: 999 1 420px; display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
  .tch-mast h1 { margin: 0; font-size: clamp(32px, 3vw, 44px); letter-spacing: -0.02em; line-height: 1; }
  .tch-lead { margin: 0; max-width: 72ch; font-size: 14px; line-height: 1.55; color: var(--steel); }
  .tch-grid { display: grid; grid-template-columns: minmax(0, 8fr) minmax(0, 4fr); gap: 16px; align-items: start; }
  .tch-fig { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 1px; background: var(--line); border-radius: 10px; overflow: hidden; }
  .tch-fig > div { background: var(--ink-2); padding: 10px 12px; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .tch-fig .v { font: 500 18px/1.2 'IBM Plex Mono', monospace; }
  .tch-fig .s { font-size: 11px; color: var(--steel); line-height: 1.35; }
  .tch-links { display: flex; flex-wrap: wrap; gap: 4px 20px; }
  .tch-links a { min-height: 24px; display: inline-flex; align-items: center; font-weight: 500; }
  @media (max-width: 1099px) { .tch-grid { grid-template-columns: 1fr; } }
  @media (max-width: 767px) { .tch { padding-top: 16px; gap: 16px; } .tch .hd-tabs a { min-height: 44px; } .tch-fig { grid-template-columns: repeat(2, minmax(0, 1fr)); } .tch-links a { min-height: 44px; } .tch .hd-p { padding: 16px; } }
`;

// ---- the demo's NVDA sample bars (catalog/shared.ts makeScenario, nvda.seed.json: base 187, step 0.21, phase 5)
function demoBars(base = 187, step = 0.21, phase = 5) {
  const dates = []; const d = new Date('2026-10-07T12:00:00Z');
  while (dates.length < 60) { const w = d.getUTCDay(); if (w !== 0 && w !== 6) dates.unshift(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() - 1); }
  return dates.map((date, i) => { const close = +(base + i * step + Math.sin((i + phase) / 4) * base * 0.004).toFixed(2); const spread = +(base * 0.009 + (i % 4) * base * 0.0004).toFixed(2); return { date, close, high: +(close + spread).toFixed(2), low: +(close - spread).toFixed(2) }; });
}
function indicators(b) {
  const ema = (w) => { const a = 2 / (w + 1); let v = 0; return b.map((x, i) => { if (i < w - 1) return null; v = i === w - 1 ? b.slice(0, w).reduce((s, y) => s + y.close, 0) / w : a * x.close + (1 - a) * v; return v; }); };
  const tr = b.map((x, i) => (i ? Math.max(x.high - x.low, Math.abs(x.high - b[i - 1].close), Math.abs(x.low - b[i - 1].close)) : x.high - x.low));
  const atr = b.map((_, i) => (i < 13 ? null : tr.slice(i - 13, i + 1).reduce((s, y) => s + y, 0) / 14));
  const rsi = []; let ag = 0, al = 0;
  for (let i = 0; i < b.length; i++) {
    if (i === 0) { rsi.push(null); continue; }
    const ch = b[i].close - b[i - 1].close, g = Math.max(ch, 0), l = Math.max(-ch, 0);
    if (i <= 14) { ag += g / 14; al += l / 14; rsi.push(i === 14 ? 100 - 100 / (1 + ag / (al || 1e-9)) : null); }
    else { ag = (ag * 13 + g) / 14; al = (al * 13 + l) / 14; rsi.push(100 - 100 / (1 + ag / (al || 1e-9))); }
  }
  // Wilder ADX 14 (28-bar warmup), as indicators.ts computes it
  const up = (i) => Math.max(b[i].high - b[i - 1].high, 0), dn = (i) => Math.max(b[i - 1].low - b[i].low, 0);
  const pdm = b.map((_, i) => (i === 0 ? 0 : up(i) > dn(i) ? up(i) : 0));
  const ndm = b.map((_, i) => (i === 0 ? 0 : dn(i) > up(i) ? dn(i) : 0));
  let str = 0, sp = 0, sn = 0, a = 0; const dx = []; const adx = [];
  for (let i = 0; i < b.length; i++) {
    if (i < 13) { adx.push(null); continue; }
    if (i === 13) { str = tr.slice(0, 14).reduce((x, y) => x + y, 0); sp = pdm.slice(0, 14).reduce((x, y) => x + y, 0); sn = ndm.slice(0, 14).reduce((x, y) => x + y, 0); }
    else { str = str - str / 14 + tr[i]; sp = sp - sp / 14 + pdm[i]; sn = sn - sn / 14 + ndm[i]; }
    const pdi = str ? (100 * sp) / str : 0, ndi = str ? (100 * sn) / str : 0;
    dx[i] = pdi + ndi === 0 ? 0 : (100 * Math.abs(pdi - ndi)) / (pdi + ndi);
    if (i < 27) { adx.push(null); continue; }
    a = i === 27 ? dx.slice(14, 28).reduce((x, y) => x + y, 0) / 14 : (a * 13 + dx[i]) / 14;
    adx.push(a);
  }
  return { e20: ema(20), e50: ema(50), rsi, atr, adx };
}
const SEEDS = { SPY: [670, 0.32, 1, 'SPDR S&P 500 ETF · NYSE Arca'], NVDA: [187, 0.21, 5, 'NVIDIA · Nasdaq'] };
const CACHE = {};
const series = (sym) => (CACHE[sym] ||= (() => { const [b, st, ph] = SEEDS[sym]; const bars = demoBars(b, st, ph); return { BARS: bars, IND: indicators(bars) }; })());
const last = (a) => a[a.length - 1];
export const lastBar = (sym = 'NVDA') => last(series(sym).BARS);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dl = (s) => `${MON[+s.slice(5, 7) - 1]} ${+s.slice(8, 10)}`;
const monthTicks = (BARS) => BARS.map((b, i) => [b, i]).filter(([b, i]) => i === 0 || b.date.slice(5, 7) !== BARS[i - 1].date.slice(5, 7)).map(([b, i]) => ({ v: i, label: i === 0 ? dl(b.date) : MON[+b.date.slice(5, 7) - 1], align: i === 0 ? 0 : undefined }));

const tabsNav = (t, on = 'Technical') => `<nav aria-label="${t}" class="hd-tabs">${[['Overview', ''], ['Technical', '/technical-analysis'], ['Research', '/research']].map(([n, h]) => `<a href="/ticker/${t}${h}"${n === on ? ' aria-current="page"' : ''}>${n}</a>`).join('')}</nav>`;
const mast = (t, name) => `<div class="tch-mast"><div class="who"><h1 class="display">${t}</h1><span class="steel" style="font-size: 14px;">${name}</span></div>${tabsNav(t)}</div>`;
const links = (t, note = true) => `<div class="tch-links">${note ? `<a href="/ticker/${t}/research" class="t-info">Read ${t} research →</a>` : ''}<a href="/ticker/${t}" class="t-info">Back to the overview</a></div>`;

/** Convexa's chart from the sample bars: close (claim series), EMA 20 (steel), EMA 50 (chartContext2); RSI as its own panel. */
export function sampleTaChart({ height = 300, sym = 'SPY', rsi = true, focus = true } = {}) {
  const { BARS, IND } = series(sym);
  const n = BARS.length; const c = last(BARS).close, e20 = last(IND.e20), e50 = last(IND.e50);
  const above = (() => { let k = 0; for (let i = n - 1; i >= 0 && IND.e20[i] != null && BARS[i].close > IND.e20[i]; i--) k++; return k; })();
  const lo = Math.floor(Math.min(...BARS.map((b) => b.close)) / 2) * 2 - 2, hi = Math.ceil(Math.max(...BARS.map((b) => b.close)) / 2) * 2 + 2;
  const yt = []; for (let v = Math.ceil(lo / 4) * 4; v <= hi; v += 4) yt.push({ v, label: v + 4 > hi ? `$${v}` : String(v) });
  const price = plot({
    height, pl: 46, pr: 110, prn: 60, pt: 14,
    x: { min: -0.5, max: n - 0.5, ticks: monthTicks(BARS) },
    y: { min: lo, max: hi, ticks: yt },
    series: [
      { points: BARS.map((b, i) => [i, b.close]), role: 'emph', end: 'Close', endValue: `$${fmt.num(c, 2)}` },
      { points: IND.e20.map((v, i) => [i, v == null ? null : +v.toFixed(2)]), role: 'ctx', width: 1.5, end: { long: 'EMA 20', short: '20' }, endValue: fmt.num(e20, 2) },
      { points: IND.e50.map((v, i) => [i, v == null ? null : +v.toFixed(2)]), role: 'ctx2', width: 1.5, end: { long: 'EMA 50', short: '50' }, endValue: fmt.num(e50, 2) },
    ],
    focus: focus && { x: n - 1, title: `${dl(last(BARS).date)} · bar 60 of 60`, rows: [{ role: 'emph', value: `$${fmt.num(c, 2)}`, name: 'close' }, { role: 'ctx', value: fmt.num(e20, 2), name: 'EMA 20' }, { role: 'ctx2', value: fmt.num(e50, 2), name: 'EMA 50' }] },
    aria: `${sym} sample daily close from $${BARS[0].close} to $${c} over 60 bars, with EMA 20 and EMA 50`,
  });
  const rsiPlot = plot({ height: 120, pl: 46, pr: 110, prn: 60, pt: 10, pb: 24, keyboard: false, x: { min: -0.5, max: n - 0.5, ticks: [] }, y: { min: 0, max: 100, ticks: [{ v: 30, label: '30' }, { v: 70, label: '70' }] }, regions: [], hlines: [{ v: 70, kind: 'ref' }, { v: 30, kind: 'ref' }], series: [{ points: IND.rsi.map((v, i) => [i, v == null ? null : +v.toFixed(1)]), role: 'emph', width: 1.5, end: 'RSI 14', endValue: fmt.num(last(IND.rsi), 1) }], aria: `RSI 14 ending at ${fmt.num(last(IND.rsi), 1)}` });
  return chartFrame({
    claim: above > 0 ? `In the sample, ${sym} has closed above its 20-day average for ${above} sessions and sits ${fmt.num(((c - e50) / e50) * 100, 1)}% above the 50-day` : `In the sample, ${sym} closed below its 20-day average on Oct 7, ${fmt.signed(((c - e50) / e50) * 100, 1, '%')} against the 50-day`,
    sub: `${sym} daily close · USD · 60 synthetic daily bars to Oct 7, 2026 · EMA 20 and EMA 50 (EMA with SMA seed)${rsi ? ' · below: RSI 14 (Wilder), 0–100' : ''}`,
    legendHtml: `<div class="cf-legend"><span class="k" style="color: var(--c-emph);"><i></i><span style="color: var(--steel);">Close</span></span><span class="k" style="color: var(--c-ctx);"><i></i><span style="color: var(--steel);">EMA 20</span></span><span class="k" style="color: var(--c-ctx2);"><i></i><span style="color: var(--steel);">EMA 50 (from bar 50)</span></span></div>`,
    body: rsi ? `${price}<span class="caps" style="margin-top: 6px;">RSI 14 · dashed at 30 and 70</span>${rsiPlot}` : price,
    note: 'Indicators are descriptive context, not a forecast or a scored signal.',
    source: 'Sample series · shaped like daily bars', sourceKind: 'dashed', asof: 'Scenario · Oct 7, 2026', kind: 'sample', state: 'sample', stateText: 'Sample series · not recorded market history',
    table: dataTable({ caption: `${sym} sample bars, last 10, with indicators`, cols: ['Date', 'Close', 'EMA 20', 'EMA 50', 'RSI 14'], rows: BARS.slice(-10).map((b, j) => { const i = n - 10 + j; return [dl(b.date), fmt.num(b.close, 2), fmt.num(IND.e20[i], 2), fmt.num(IND.e50[i], 2), fmt.num(IND.rsi[i], 1)]; }) }),
  });
}
export function sampleReadings(sym = 'SPY') {
  const { IND } = series(sym);
  const f = [['EMA 20', fmt.num(last(IND.e20), 2), 'USD · daily close'], ['EMA 50', fmt.num(last(IND.e50), 2), 'USD · daily close'], ['RSI 14', fmt.num(last(IND.rsi), 1), 'Wilder · 0–100'], ['ADX 14', fmt.num(last(IND.adx), 1), 'Wilder · trend strength'], ['ATR 14', fmt.num(last(IND.atr), 2), 'USD · mean true range']];
  return `<section class="hd-p is-sample" aria-label="Readings, sample"><div class="ph"><h3>Readings on the last bar · Oct 7</h3>${stateTag('sample')}</div><div class="tch-fig">${f.map(([l, v, s]) => `<div><span class="caps">${l}</span><span class="v">${v}</span><span class="s">${s}</span></div>`).join('')}</div><span class="dline">Computed in the browser from the 60 sample bars. A reading still warming up says “Insufficient history · 12/28 bars” instead of a number.</span><div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">${provChip('Sample · shaped like daily bars', 'dashed')}<button class="btn ghost sm" type="button">${icon('refresh', 14)}Refresh sample</button></div></section>`;
}

export function techStagingBody({ minHeight = 0, scheme = 'dark', t = 'SPY' } = {}) {
  const main = `<div class="wrap tch">${mast(t, SEEDS[t][3])}<div style="display: flex; flex-direction: column; gap: 8px;"><span class="caps">Technical analysis · ${t}</span><p class="tch-lead">Exponential 20- and 50-day averages, RSI 14, ADX 14 and ATR 14, computed from the demo’s 60 sample daily bars. They describe the trend; they are not calls to buy or sell.</p></div>${sampleTaChart({ sym: t })}${sampleReadings(t)}${links(t)}<p class="dline" style="margin: 0;">Research and tools, not investment advice. Figures on this board are illustrative design values.</p></div>`;
  return v4Page({ scheme, minHeight, demo: true, active: 'ticker', label: `${t} technical analysis`, main });
}

const readingsNotLive = (t) => `<section class="hd-p" aria-label="Readings, not live"><div class="ph"><h3>Readings Convexa computes</h3>${stateTag('notLive')}</div><p class="dline" style="margin: 0;"><strong style="color: var(--phosphor);">Would show</strong> EMA 20 and 50, RSI 14, ADX 14 and ATR 14 on the last daily bar, computed by Convexa and traceable to each bar.</p><p class="dline" style="margin: 0;"><strong style="color: var(--phosphor);">Off because</strong> they need daily bars from the market-data feed, which this site doesn’t run. None of them is read from TradingView’s chart.</p><a href="${DEMO_DESK(t)}/technical-analysis" class="t-info" style="display: inline-flex; gap: 4px; align-items: center; min-height: 24px; font-weight: 500;">See them on the demo →</a></section>`;

export function techProductionBody({ minHeight = 0, scheme = 'dark', t = 'NVDA' } = {}) {
  const main = `<div class="wrap tch">${mast(t, 'NVIDIA · Nasdaq')}<div style="display: flex; flex-direction: column; gap: 8px;"><span class="caps">Technical analysis · ${t}</span><p class="tch-lead">Exponential 20- and 50-day averages and RSI 14, drawn by TradingView from its own prices. They describe the trend; they are not calls to buy or sell.</p></div>
    <div class="tch-grid">${thirdPartyFrame({ ticker: t, height: 620, phoneHeight: 480 })}<div style="display: flex; flex-direction: column; gap: 16px;">${readingsNotLive(t)}<section class="hd-p" aria-label="Research"><div class="ph"><h3>Research note</h3></div><span class="dline" style="font-size: 13px;">The note values ${t} from its own dated price (Oct 12), not from this chart.</span><a href="/ticker/${t}/research" class="t-info" style="display: inline-flex; gap: 4px; align-items: center; min-height: 24px; font-weight: 500;">Read ${t} research →</a></section></div></div>
    ${links(t, false)}<p class="dline" style="margin: 0;">Research and tools, not investment advice.</p></div>`;
  return v4Page({ scheme, minHeight, active: 'ticker', label: `${t} technical analysis`, main });
}

export function techStatesBody({ minHeight = 0, scheme = 'dark' } = {}) {
  const items = [
    { name: 'Loading', tag: ['loading'], when: 'From mount until TradingView’s iframe appears: the words at the frame’s final size (620, 480 on a phone). Nothing shifts when it draws.', html: thirdPartyFrame({ ticker: 'NVDA', state: 'loading', height: 260, phoneHeight: 260 }) },
    { name: 'Blocked or timed out', tag: null, when: 'TradingView’s script errored, or 12 s passed without its iframe. Information, not a failure of Convexa’s; the state resets when the symbol changes.', html: thirdPartyFrame({ ticker: 'NVDA', state: 'blocked' }) },
    { name: 'Live · TradingView', tag: ['thirdParty'], when: 'Production, on view (P-14): the dotted frame, TradingView’s candles and colours, its attribution, and the privacy line. Convexa reads nothing from it.', html: thirdPartyFrame({ ticker: 'NVDA', height: 260, phoneHeight: 260, mini: true }) },
    { name: 'A symbol TradingView may not list', tag: ['empty', 'Unknown listing'], when: 'A ticker outside Convexa’s exchange map and without a note is passed bare; if TradingView can’t place it the empty chart is inside its frame, where Convexa can’t see. So the page says so under the frame.', html: `<div class="hd-p"><span class="dline" style="font-size: 13px; color: var(--phosphor);">Convexa couldn’t match RKLB to an exchange, so TradingView picks the listing. If the chart above is empty, TradingView doesn’t list it under that name.</span><a href="https://www.tradingview.com/symbols/RKLB/" class="t-info" style="min-height: 24px; display: inline-flex; align-items: center;">Search RKLB on TradingView →</a></div>` },
    { name: 'Not live · readings', tag: ['notLive'], when: 'Production: Convexa’s own readings need daily bars from the paid feed; the panel says what they would be and links to the demo.', html: readingsNotLive('NVDA') },
    { name: 'Sample', tag: ['sample'], when: 'Staging: Convexa’s chart from the 60 sample bars, dashed and hatched, “Sample series · not recorded market history”.', html: sampleReadings() },
    { name: 'Warming up', tag: ['empty', 'Insufficient history'], when: 'Staging, a reading with fewer bars than its window (ADX needs 28): the reason and the count, never a zero.', html: `<div class="tch-fig" style="grid-template-columns: repeat(2, minmax(0, 1fr));"><div><span class="caps">ADX 14</span><span class="dnan" style="font-size: 14px;">Insufficient history</span><span class="s">12 of 28 bars</span></div><div><span class="caps">EMA 50</span><span class="dnan" style="font-size: 14px;">Insufficient history</span><span class="s">12 of 50 bars</span></div></div>` },
    { name: 'Not in the demo', tag: ['empty', 'No sample'], when: 'Staging, a symbol beyond the six: “No sample data for this symbol.” and the six to pick from.', html: `<div class="hd-p"><strong style="font-size: 13px;">No sample data for RKLB.</strong><span class="dline">The demo runs on SPY, QQQ, AAPL, MSFT, NVDA and TSLA.</span></div>` },
    { name: 'Couldn’t load', tag: ['error'], when: 'Staging, the sample bars failed to load: the cause and Retry demo.', html: chartFrame({ claim: 'SPY daily close with EMA 20 and EMA 50', sub: 'Sample bars', state: 'error', body: stateBody('error', { height: 140, text: 'The sample bars didn’t load.', cause: 'The demo’s scenario file for SPY didn’t arrive.', action: '<button class="btn secondary sm" type="button">Retry demo</button>' }) }) },
    { name: 'Not embedded', tag: null, when: 'TradingView’s technical-rating gauge words its summary as buy and sell calls, so it is never embedded.', html: `<div class="dna"><span class="caps">Left out on purpose</span><span class="dline">TradingView’s technical-rating gauge, which words its summary as calls to buy or sell.</span></div>` },
  ];
  return statesBoard({ scheme, minHeight, title: 'Technical tab · states', lead: 'TradingView’s frame on production, Convexa’s sample chart on staging, and every state of each, labelled with its word and when it happens.', trace: 'P-8, P-10, P-14, TKR-05, TL-11, TV-01–TV-05', items });
}
