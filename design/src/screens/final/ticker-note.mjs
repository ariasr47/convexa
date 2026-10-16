// Final · Convexa v1 — the ticker research tab and note view (/ticker/:symbol/research[/:slug]).
// Production: the owner's real note (research/NVDA/2026-10-13-initiation.md: title, strip, TL;DR, scorecard,
// revenue chart, margin comparison, GAAP bridge, catalysts, forecasts — figures as the note states them) in
// the v5 figure forms, with freshness by word and shape and the live public panels beside it (SEC set up
// and Updated; FINRA Off until its terms are confirmed — redrawn 2026-10-16). Staging: the shipped authored
// sample case (demo/catalog/shared.ts NVDA narrative) laid out in the same template, every figure dashed
// and hatched, with FINRA-shaped samples.
import { icon, finalPage } from '../../lib.mjs';
import { barList, chartFrame, fmt, plot, rangeBar, stateBody, ticks } from '../../chart-kit.mjs';
import { provChip, stateTag } from '../../components/data-states.mjs';
import { bridgeRows } from '../v5/system.mjs';
import { statesBoard } from '../v4/kit.mjs';
import { lastBar, sampleTaChart } from './ticker-tech.mjs';

export const TN_CSS = `
  .tn .nv { padding-top: 24px; }
  .nv-body .cf p.cf-sub { font-size: 12px; line-height: 1.45; color: var(--steel); }
  .nv-body .cf p.cf-note { font-size: 12px; line-height: 1.45; color: var(--steel); }
  .nv-body .cf .cstate p { font-size: 13px; line-height: 1.5; }
  .tn-tabs { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 4px; padding-top: 20px; }
  .tn-fresh { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; }
  .tn-fresh b { font-weight: 600; }
  .tn-dot { width: 10px; height: 10px; flex: 0 0 auto; }
  .tn-dot.d-full { border-radius: 50%; background: var(--phosphor); }
  .tn-dot.d-half { border-radius: 50%; border: 1px solid var(--phosphor); background: linear-gradient(90deg, var(--phosphor) 50%, transparent 50%); }
  .tn-dot.d-ring { border-radius: 50%; border: 2px solid var(--phosphor); }
  .tn-dot.d-square { border-radius: 2px; border: 2px solid var(--phosphor); }
  .tn-sc > div { grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr) auto; padding: 10px 0; font-size: 13px; }
  .tn-tldr { display: grid; grid-template-columns: 84px minmax(0, 1fr); gap: 10px 14px; align-items: baseline; }
  .tn-tldr .k { font: 500 18px/1.2 'IBM Plex Mono', monospace; }
  .tn-tldr p { font-size: 14.5px !important; line-height: 1.55 !important; }
  @media (max-width: 899px) { .tn-sc > div { grid-template-columns: minmax(0, 1fr) auto; } .tn-sc > div > :nth-child(2) { grid-column: 1 / -1; order: 3; } .tn-tldr { grid-template-columns: 1fr; gap: 2px; } .tn .hd-tabs a { min-height: 44px; } }
`;

const P = (title, tag, inner, { sample = false, label = '' } = {}) => `<section class="hd-p${sample ? ' is-sample' : ''}" aria-label="${label || title.replace(/<[^>]+>/g, '')}"><div class="ph"><h3>${title}</h3>${tag}</div>${inner}</section>`;
const tabs = (t) => `<div class="tn-tabs"><nav aria-label="${t}" class="hd-tabs"><a href="/ticker/${t}">Overview</a><a href="/ticker/${t}/technical-analysis">Technical</a><a href="/ticker/${t}/research" aria-current="page">Research</a></nav><span style="flex: 1;"></span><a href="/research" class="t-info" style="min-height: 24px; display: inline-flex; align-items: center; font-weight: 500;">All research →</a></div>`;
export const fresh = (k, word, rest) => `<span class="tn-fresh"><span aria-hidden="true" class="tn-dot d-${k}"></span><b>${word}</b><span class="steel">${rest}</span></span>`;

// ---- the real note's figures ------------------------------------------------------------------------
const NOTE = { price: 226.32, bear: 53.56, base: 199.43, bull: 431.39 };
const REV = [['Q1 FY26', 44.062], ['Q2 FY26', 46.743], ['Q3 FY26', 57.006], ['Q4 FY26', 68.127], ['Q1 FY27', 81.615], ['Q2 FY27', 96.221]];

function valueRange({ stale = false } = {}) {
  const { bear, base, bull, price } = NOTE; const lo = 0, hi = 450;
  return chartFrame({
    claim: stale ? 'Price against the value range' : `At $${fmt.num(price, 2)} the price sits ${Math.round(((price - base) / base) * 100)}% above the base case of $${fmt.num(base, 2)}`,
    sub: 'Value per share, $ · growth DCF from the note’s sourced inputs · bar = bear to bull · diamond = base case · line = price (the note’s, Oct 12 close)',
    state: stale ? 'stale' : 'computed', stateText: stale ? 'Price 34 days old' : 'Computed at build',
    body: `<div style="padding-top: 6px;">${stale ? '' : `<div style="position: relative; height: 18px; font: 600 11px/18px 'IBM Plex Mono', monospace; color: var(--phosphor);"><span style="position: absolute; left: ${((price / hi) * 100).toFixed(2)}%; transform: translateX(-50%); white-space: nowrap;">Price $${fmt.num(price, 2)} · Oct 12</span></div>`}${rangeBar({ lo, hi, band: [bear, bull], base, now: stale ? null : price, height: 30, labels: [{ v: bear, text: `Bear $${fmt.num(bear, 2)}` }, { v: base, text: `Base $${fmt.num(base, 2)}`, row: 2 }, { v: bull, text: `Bull $${fmt.num(bull, 2)}`, align: 1 }], aria: `Bear ${bear}, base ${base}, bull ${bull}${stale ? '' : `; price ${price}`}` })}</div>${stale ? '<p class="dline" style="margin: 0;">% to base hidden: the price is 34 days old. The range doesn’t depend on it; it returns when the note is re-dated.</p>' : '<p class="dline" style="margin: 0;">The range is very wide on purpose: the bear case is a full cycle, the bull case the guide’s growth lasting past FY2028. The diamond is the page’s one amber mark.</p>'}`,
    source: 'The note’s valuation · 10-Q Q2 FY2027', asof: 'Note of Oct 13, 2026',
  });
}
function revenueChart() {
  const g = 108.0, n = REV.length;
  const xt = [...REV.map(([q], i) => ({ v: i, label: { long: q, short: q.split(' ')[0] }, minor: i % 2 === 1 })), { v: n, label: { long: 'Q3 FY27 guide', short: 'Guide' } }];
  return chartFrame({
    claim: 'Revenue more than doubled in a year, to $96.2B; NVIDIA guides $108B for next quarter',
    sub: 'NVDA quarterly revenue · $ billions · Q1 FY26 – Q2 FY27, then the Q3 FY27 guide (±2%, the company’s range)',
    legendHtml: `<div class="cf-legend"><span class="k"><i style="background: var(--c-emph); height: 10px; width: 10px; border-radius: 2px;"></i>Latest reported</span><span class="k"><i style="background: var(--c-ctx); height: 10px; width: 10px; border-radius: 2px;"></i>Reported</span><span class="k"><i style="background: transparent; border: 1px dashed var(--c-axis); height: 10px; width: 10px; border-radius: 2px;"></i>Guide midpoint, range as a whisker</span></div>`,
    body: plot({ height: 240, pt: 34, pr: 16, prn: 8, pl: 50, x: { min: -0.6, max: n + 0.6, ticks: xt }, y: { min: 0, max: 120, ticks: ticks(0, 120, 40, (v) => (v === 120 ? '$120B' : String(v))) }, hlines: [{ v: 0, kind: 'zero' }], bars: [...REV.map(([, v], i) => ({ x: i, v, role: i === n - 1 ? 'emph' : 'ctx', label: i === 0 || i === n - 1 ? `$${fmt.num(v, 1)}B` : '' })), { x: n, v: g, out: true }], whiskers: [{ x: n, lo: g * 0.98, hi: g * 1.02 }], pointLabels: [{ x: n, y: g * 1.02, text: '$108B ± 2%' }], events: [{ x: 3, label: '10-K' }, { x: 5, label: '8-K 2.02', keep: true }], eventLane: { long: 'Filed', short: 'Filed' }, aria: 'NVDA quarterly revenue from $44.1B to $96.2B over six quarters; guide $108B ± 2%' }),
    source: '8-K 99.1 · Aug 26, 2026 · 10-Q', sourceHref: 'https://www.sec.gov/', asof: 'Q1 FY26 is the first half less Q2 (calc)',
  });
}
function marginChart() {
  const rows = [['NVIDIA FY2016–20', 28.3], ['AMD data center, Q2 2026', 31.3], ['Semiconductor industry', 35.3], ['Broadcom, FQ3-26', 53.9], ['NVIDIA FY2026', 60.4], ['NVIDIA Q2 FY2027', 66.2, 'emph']];
  return chartFrame({ claim: 'Today’s 66% margin is about double NVIDIA’s own past and above every peer', sub: 'GAAP operating margin · %', body: barList({ rows: rows.map(([n, v, r]) => ({ name: n, v, role: r || 'ctx', label: `${fmt.num(v, 1)}%` })), max: 80, labelW: 190, pr: 64, prn: 56, aria: rows.map(([n, v]) => `${n} ${v}%`).join(', ') }), source: 'Filings · Damodaran industry data', asof: 'The note’s margin targets come from this chart' });
}
function catalystsChart() {
  const ev = [[0, 'Today'], [7, 'GTC Berlin'], [34, 'Q3 results'], [47, 'GTC D.C.'], [60, 'Broadcom FQ4']];
  return chartFrame({ claim: 'Q3 results land in five weeks; GTC Berlin comes first', sub: 'NVDA catalysts from the note on a time scale · next 75 days from Oct 14, 2026', body: plot({ height: 84, pt: 34, pb: 26, pl: 16, pr: 16, prn: 16, ends: false, keyboard: false, x: { min: -2, max: 75, ticks: [0, 25, 50, 75].map((d) => ({ v: d, label: d === 0 ? 'Oct 14' : `+${d} days`, align: d === 75 ? 1 : undefined })) }, y: { min: 0, max: 1, ticks: [] }, events: ev.map(([d, l]) => ({ x: d, label: l, keep: l === 'Q3 results' || l === 'Today', ...(l === 'GTC Berlin' ? { lane: 2 } : {}) })), aria: 'Catalysts: GTC Berlin Oct 20–22, Q3 results Nov 17, GTC D.C. Nov 30, Broadcom FQ4 in December' }), source: 'The note’s catalysts', asof: 'Expected dates move when the company confirms' });
}

// ---- the live public panels (NotePublicPanels) ----------------------------------------------------
// Production (owner, 2026-10-15): SEC is set up (SEC_USER_AGENT on the API), so insider trades and
// Filed since this note read Updated; FINRA is Off until its display terms are confirmed
// (apps/dashboard/src/app/shared/dataState/finraSwitch.ts). Staging keeps the FINRA-shaped samples.
const FINRA_OFF_REASON = 'Off on this site until FINRA’s terms for showing its data here are confirmed. The demo shows sample data shaped like it.';
const finraOffPanel = (title) => P(title, stateTag('off'), `<span class="dline">${FINRA_OFF_REASON}</span>`);
// NVDA's Form 4s as the API counts them (apps/api edgar.rs form4_rows, parse_form4): the 16 filed in the
// 90 days to Oct 14, 2026 (Aug 7 – Oct 9), 25 open-market sales (code S) and no purchases (P),
// 4,332,118 shares sold, 9 of the sales in filings marked 10b5-1 (aff10b5One). Read from SEC EDGAR on
// 2026-10-16: data.sec.gov/submissions/CIK0001045810.json and each filing's form4.xml.
const insiderPanel = () => P('Insider trades · 90 days', stateTag('current', 'Updated · latest Oct 9'), `<span class="dval" style="font-size: 22px;">25 sales<span class="steel" style="font-size: 13px; font-family: 'IBM Plex Sans';"> · 0 buys</span></span><span class="dline">9 of the trades were under pre-set 10b5-1 plans, which schedule sales months ahead.</span><div class="drows">${[['Shares sold', '4.3M'], ['Shares bought', '0']].map(([k, v]) => `<div style="grid-template-columns: minmax(0, 1fr) auto; padding: 6px 0; font-size: 12px;"><span class="steel">${k}</span><span class="mono">${v}</span></div>`).join('')}</div><div>${provChip('SEC Form 4 · 16 filings, latest Oct 9', 'solid')}</div>`);
// The same submissions list: nothing but Forms 3, 4, 5 and 144 was filed after the note's Oct 13 (to the
// board's Oct 14, or to Oct 16 when it was read), so the panel is in its "Nothing yet" form, pointing at
// the note's results date (NotePublicPanels.tsx).
const filedSincePanel = () => P('Filed since this note', stateTag('current'), `<strong style="font-size: 13px;">Nothing yet. The note was written Oct 13, 2026.</strong><span class="dline">Next expected: Q3 FY2027 results, Nov 17. When a results or quarterly filing lands, the note comes due and the filing is listed here.</span><div>${provChip('SEC EDGAR · checked every hour', 'solid')}</div>`);
const publicPanels = () => `<span class="caps" style="margin-top: 8px;">Positioning and filings · live</span>${finraOffPanel('Short interest')}${finraOffPanel('Short-sale volume')}${insiderPanel()}${filedSincePanel()}`;

// =================================================================================================
// Production · the owner's NVDA note
// =================================================================================================
export function noteProductionBody({ minHeight = 0, scheme = 'dark', t = 'NVDA' } = {}) {
  const rail = `<nav class="nv-rail" aria-label="On this page">${['TL;DR', '01 · The verdict', '02 · Thesis scorecard', '03 · Revenue', '04 · Margins', '05 · GAAP and adjusted', '06 · Catalysts', '07 · Forecasts', 'Sources'].map((s, i) => `<a href="#s${i}"${i === 1 ? ' aria-current="true"' : ''}>${s}</a>`).join('')}<div style="margin-top: 10px; display: flex; flex-direction: column; gap: 6px;"><span style="display: block; height: 4px; border-radius: 2px; background: rgba(138,155,180,0.18);"><span style="display: block; height: 4px; width: 22%; border-radius: 2px; background: var(--phosphor);"></span></span><span class="dline" style="font-size: 11.5px;">about 14 min left</span></div></nav>`;
  const head = `<div style="display: flex; flex-direction: column; gap: 14px;">${fresh('full', 'Current', '· review by Oct 22 (GTC Berlin)')}
    <h1 class="display" style="margin: 0; font-size: clamp(28px, 2.8vw, 38px); line-height: 1.15; max-width: 26ch;">A 70% growth guide on a $412B year. What comes after FY2028 is the whole question.</h1>
    <p style="margin: 0; font-size: 15px; color: var(--steel);">NVIDIA · Nasdaq · AI accelerators, networking and the CUDA software stack</p>
    <div style="display: flex; flex-wrap: wrap; gap: 8px 10px; align-items: center;"><span class="stag k-solid">Initiation · Oct 13</span><span class="stag k-solid">${icon('calendar', 12)}Price as of Oct 12 · 2 days old</span><span class="stag k-quiet">Stance · not set</span><span class="stag k-quiet">Target · not set</span><span class="stag k-solid">14 min · 4 min skim</span></div></div>`;
  const strip = `<div class="rs-strip">${[['Price', '$226.32', 'close · Oct 12', 'TradingView close (display)'], ['Revenue · Q2 FY27', '$96.2B', '▲ 106% on a year', '8-K 99.1 · Aug 26'], ['Operating margin', '66.2%', '▲ 5.4 pts on a year', '10-Q · Q2 FY27'], ['Free cash flow', '$21.3B', '▼ from $48.6B in Q1', '10-Q · Q2 FY27']].map(([l, v, d, c]) => `<div style="background: var(--panel); padding: 14px 16px; display: flex; flex-direction: column; gap: 6px;"><span class="caps">${l}</span><span class="mono" style="font-size: 22px; font-weight: 500;">${v}</span><span class="pillN">${d}</span>${provChip(c, 'solid')}</div>`).join('')}</div>`;
  const tldr = `<section aria-labelledby="tldr" class="hd-p" style="gap: 12px;"><span id="tldr" class="caps">TL;DR · 30 seconds</span><div class="tn-tldr">${[['~70%', 'NVIDIA’s first full-year guide: FY2028 revenue up about 70%, limited by supply, not demand. Consensus sits at $692B.'], ['66%', 'GAAP operating margin in Q2 FY2027, about double the pre-AI level. The base case lets it fall to 45% by FY2034.'], ['$108.5B', 'The most NVIDIA could owe under guarantees for customers’ data centers, beside $99B of stakes in other companies, many of them buyers.']].map(([k, p]) => `<span class="k">${k}</span><p>${p}</p>`).join('')}</div></section>`;
  const sc = `<div class="drows tn-sc">${[['FY2028 grows about 70%', '~70%, supply-limited; consensus $692B', 'ok', '✓ On track'], ['Margins hold near 72%', 'Q3 74%; Q4 71–72%; FY2028 72–73%', 'watch', '! Watch'], ['Customers pay on normal terms', 'DSO 60, up from 45 a quarter earlier', 'watch', '! Watch'], ['Hyperscalers keep buying', '$48.7B, +13% on the quarter', 'ok', '✓ On track'], ['The capex cycle keeps rising', '~$800B in 2026, ~$1.3T expected in 2027', 'ok', '✓ On track']].map(([a, b, k, w]) => `<div><span style="font-weight: 600;">${a}</span><span class="steel">${b}</span><span class="status ${k}">${w}</span></div>`).join('')}</div><span class="dline">Status by glyph, word and weight: on track is outlined, watch is tinted. No direction colour: these are facts about the company.</span>`;
  const forecasts = `<div class="drows">${[['Nov 17', 'Q3 FY2027 revenue is at least $105.84B, the low end of guidance.'], ['Nov 17', 'NVIDIA guides Q4 FY2027 revenue at or above $124.5B, the consensus.'], ['Nov 17', 'NVIDIA keeps or raises its ~70% FY2028 growth outlook.'], ['Nov 17', 'DSO is at or below 60 days at the end of Q3 FY2027.'], ['Feb 2027', 'Q4 FY2027 GAAP gross margin is at least 71.0%.']].map(([d, c]) => `<div style="grid-template-columns: 72px minmax(0, 1fr) auto; padding: 10px 0;"><span class="mono steel">${d}</span><span style="font-size: 14px;">${c}</span><span class="stag k-quiet">P · not set</span></div>`).join('')}</div><span class="dline">Awaiting resolution. A probability set before the date is what the Scorecard scores; none is set yet.</span>`;
  const body = `<div class="nv-body">${head}${strip}${valueRange()}${tldr}
    <h2 id="s1" class="display">01 · The verdict</h2><p>The price needs growth after FY2028 that almost no company this size has kept up. Among companies with sales above $50B, real growth above 15% a year for five years happened in 3.3% of cases from 1950 to 2015.</p>
    <h2 id="s2" class="display">02 · Thesis scorecard</h2>${sc}
    <h2 id="s3" class="display">03 · Revenue and earnings quality</h2><p>Revenue more than doubled in a year, and growth sped up for a fourth straight quarter. Hyperscale revenue was $48.7B and AI clouds, industrial and enterprise $40.3B.</p>${revenueChart()}
    <h2 id="s4" class="display">04 · Margins against history and peers</h2>${marginChart()}
    <h2 id="s5" class="display">05 · GAAP and adjusted profit</h2><p>Operating profit is clean; net income is lifted by gains on stakes in other companies. The valuation uses operating profit only.</p>${bridgeRows({ steps: [['GAAP net income', 59688, 'total'], ['Gains on stakes, removed', -7473, 'step'], ['Acquisition costs, added back', 222, 'step'], ['Tax on the adjustments', 1517, 'step'], ['Non-GAAP net income', 53954, 'total']], claim: 'Gains on stakes lift GAAP net income $5.7B above non-GAAP', sub: 'Q2 FY2027 GAAP to non-GAAP net income · $ millions', source: '8-K 99.1 · Aug 26, 2026', asof: 'Note of Oct 13, 2026' }).replace(/<p class="cf-note">[\s\S]*?<\/p>/, '<p class="cf-note">Up steps filled, down steps outlined; the sign is in the label, never the hue.</p>')}
    <h2 id="s6" class="display">06 · Catalysts</h2>${catalystsChart()}
    <h2 id="s7" class="display">07 · Forecasts</h2>${forecasts}
    <p class="dline" style="font-size: 12px;">Personal research notes. Not investment advice. 26 sources, filings first.</p></div>`;
  const side = `<aside class="nv-side" aria-label="About this note">${P('This note comes due', '', `<div class="drows">${[['Oct 22', 'GTC Berlin ends (keynote Oct 21)'], ['Nov 11', 'Price turns 30 days old'], ['Nov 17', 'Q3 FY2027 results']].map(([d, w]) => `<div style="grid-template-columns: 56px minmax(0, 1fr);"><span class="mono steel">${d}</span><span>${w}</span></div>`).join('')}</div><span class="dline" style="font-size: 11.5px;">Worked out in your browser from the note’s own dates.</span>`)}${P('Why uncertainty is very high', '', '<span class="dline" style="font-size: 13px;">Consensus FY2028 revenue alone spans $506–778B, and three direct customers bought 44% of first-half revenue.</span>')}${publicPanels()}</aside>`;
  return finalPage({ scheme, minHeight, active: 'research', label: `${t} research note`, main: `<div class="wrap tn">${tabs(t)}<div class="nv">${rail}${body}${side}</div></div>` });
}

// =================================================================================================
// Staging · the authored sample case
// =================================================================================================
export function noteStagingBody({ minHeight = 0, scheme = 'dark', t = 'NVDA' } = {}) {
  const rail = `<nav class="nv-rail" aria-label="On this page">${['Thesis', 'Evidence', 'Risks', 'Invalidation', 'Catalysts'].map((s, i) => `<a href="#d${i}"${i === 0 ? ' aria-current="true"' : ''}>${s}</a>`).join('')}</nav>`;
  const b = lastBar();
  const body = `<div class="nv-body">
    <div style="display: flex; flex-direction: column; gap: 12px;"><span class="caps">Sample research note · authored for this scenario</span><h1 class="display" style="margin: 0; font-size: clamp(28px, 2.8vw, 38px); line-height: 1.15;">NVDA higher-variation case</h1><div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">${stateTag('sample', 'Sample note')}${provChip('Authored scenario · Oct 7, 2026 · portfolio-2026-10-07-v1 · advisory context', 'dashed')}</div></div>
    <h2 id="d0" class="display">Thesis</h2><p>The NVDA example pairs a rising close path with visibly larger authored bars to frame a higher-variation scenario.</p>
    <h2 id="d1" class="display">Evidence</h2>
    <div class="drows">${[[`The final close is the price anchor for this higher-variation case. Close: ${b.close.toFixed(2)} USD on ${b.date}.`, 'bar Oct 7'], [`The latest bar high-low span supplies its authored range evidence. High ${b.high.toFixed(2)} USD; low ${b.low.toFixed(2)} USD on ${b.date}.`, 'bar Oct 7']].map(([x, c]) => `<div style="grid-template-columns: minmax(0, 1fr) auto; padding: 10px 0;"><span style="font-size: 14px;">${x}</span>${provChip(c, 'dashed')}</div>`).join('')}</div>
    ${sampleTaChart({ height: 220, sym: 'NVDA', rsi: false, focus: false })}
    <h2 id="d2" class="display">Risks</h2><div class="drows">${['The synthetic range does not estimate real volatility.', 'The example has no semiconductor supply-chain inputs.'].map((x) => `<div style="padding: 10px 0;"><span style="font-size: 14px;">${x}</span></div>`).join('')}</div>
    <h2 id="d3" class="display">Invalidation</h2><p>Revisit the variation thesis if subsequent authored ranges contract across the same window.</p>
    <h2 id="d4" class="display">Catalysts</h2><div class="dna"><span class="caps">Not curated</span><span class="dline">The sample scenario carries no dated catalysts, so this note never comes due.</span></div>
    <p class="dline" style="font-size: 12px;">Same NVDA scenario · no external news, AI or forecast citations. Not investment advice.</p></div>`;
  const side = `<aside class="nv-side" aria-label="About this note">${P('About this sample', stateTag('demo'), '<span class="dline" style="font-size: 13px;">Every figure cites a sample bar from the Oct 7 scenario. The production site shows the owner’s real notes, with their sources, freshness and the public panels.</span>')}${P('Short interest · NVDA', stateTag('sample'), `<span class="dval" style="font-size: 22px;">1.3%<span class="steel" style="font-size: 13px; font-family: 'IBM Plex Sans';"> of float</span></span><span class="dline">Sample scenario, Oct 7. Not market data.</span><div>${provChip('Sample · shaped like FINRA short interest', 'dashed')}</div>`, { sample: true })}${P('Filed since this note', stateTag('sample'), `<span class="dline">Sample filing list: 8-K, Oct 2 (Item 7.01). Not an SEC record.</span><div>${provChip('Sample · shaped like SEC EDGAR', 'dashed')}</div>`, { sample: true })}</aside>`;
  return finalPage({ scheme, minHeight, demo: true, active: 'research', label: `${t} sample research note`, main: `<div class="wrap tn">${tabs(t)}<div class="nv">${rail}${body}${side}</div></div>` });
}

// =================================================================================================
// States
// =================================================================================================
export function noteStatesBoardBody({ minHeight = 0, scheme = 'dark' } = {}) {
  const items = [
    { name: 'Freshness · four words, four shapes', tag: null, when: 'Computed in the reader’s browser from the note’s own dates. Word and shape carry it; no colour.', html: `${fresh('full', 'Current', '· review by Oct 22 (GTC Berlin)')}${fresh('half', 'Review due', '· since Nov 17 (results filed after the note)')}${fresh('ring', 'Superseded', '· a newer note replaces it')}${fresh('square', 'Archived', '· not following since Aug 2')}` },
    { name: 'Review due banner', tag: null, when: 'A catalyst, kill or forecast window passed, the price turned 30 days old, or a results filing landed that the note doesn’t cite.', html: `<div role="status" class="dwarn">${icon('warn', 14)}<div style="display: flex; flex-direction: column; gap: 2px;"><strong style="font-size: 13px;">Review due. Written Oct 13, 35 days ago.</strong><span class="dline">Since then: Q3 FY2027 results 8-K, Nov 17. The figures below predate it.</span></div></div>` },
    { name: 'Superseded', tag: null, when: 'An older note opened by its address: points to the latest.', html: `<div class="hd-p"><strong>Superseded. A newer note (Nov 18) replaces this one.</strong><a href="/ticker/NVDA/research" class="t-info" style="min-height: 24px; display: inline-flex; gap: 4px; align-items: center;">Read the latest note ${icon('arrow', 12)}</a></div>` },
    { name: 'Price older than 30 days', tag: ['stale', 'Last good copy'], when: 'The % to base and the price line are hidden; the reason sits where the number was. The range stays.', html: valueRange({ stale: true }) },
    { name: 'Loading', tag: ['loading'], when: 'The note’s JSON is on its way: three skeletons at the final shape.', html: `<span class="skel" style="height: 30px; width: 70%;"></span><span class="skel" style="height: 90px; width: 100%;"></span><span class="skel" style="height: 220px; width: 100%;"></span>` },
    { name: 'Couldn’t load', tag: ['error'], when: 'The build’s note index didn’t arrive.', html: `<div class="dwarn">${icon('warn', 14)}<div><strong style="font-size: 13px;">NVDA research couldn’t load (the build index didn’t arrive).</strong><button class="btn secondary sm" type="button" style="margin-top: 6px;">Try again</button></div></div>` },
    { name: 'No note on this ticker', tag: ['empty', 'No note'], when: 'Teaches and links to the index.', html: `<strong>No research on RKLB yet.</strong><span class="dline">Notes appear here once they’re written. The research index lists every ticker that has them.</span><a href="/research" class="btn secondary" style="align-self: flex-start;">See all research</a>` },
    { name: 'Unknown note address', tag: ['empty', 'No such note'], when: 'Names the slug and links to the latest.', html: `<strong>No NVDA note named “q4-preview”.</strong><a href="/ticker/NVDA/research" class="t-info" style="min-height: 24px; display: inline-flex; gap: 4px; align-items: center;">Read the latest NVDA note ${icon('arrow', 12)}</a>` },
    { name: 'Public panels · source down', tag: ['unavailable'], when: 'FINRA didn’t answer and nothing is cached: unknown, not zero. The note doesn’t depend on it.', html: chartFrame({ claim: 'Short interest', sub: 'NVDA · FINRA settlements', state: 'unavailable', body: stateBody('unavailable', { height: 120, text: 'FINRA didn’t answer and no earlier report is cached.', cause: 'Convexa asks again in 10 minutes.' }), source: 'FINRA · short interest', asof: '—' }) },
    { name: 'Public panels · Off', tag: ['off'], when: 'PUBLIC_DATA=off: one line where the panels were, never silence.', html: chartFrame({ claim: 'Positioning and filings', sub: 'NVDA · FINRA and SEC', state: 'off', body: `<div class="cx" style="height: 90px;"><div class="cstate" role="status"><div class="msg"><p>Public-data panels are off on this server.</p><p class="q">They return when the operator switches the public-data API on.</p></div></div></div>` }) },
    { name: 'A bridge that crosses zero', tag: null, when: 'Five shipped notes (INTC, CRWV, META, SPCX, AMZN) have bridges with negative totals: up steps filled, down steps outlined, signed labels, totals below zero left of the zero line. The same rows form at 390.', html: bridgeRows().replace(/<p class="cf-note">[\s\S]*?<\/p>/, '<p class="cf-note">Up steps filled, down steps outlined; the sign is in the label, never the hue. Running totals below zero sit left of the zero line.</p>') },
    { name: 'Demo · sample data', tag: ['demo'], when: 'Staging: the authored sample case, labelled at the top and on every figure; no live panels.', html: `<div class="hd-p is-sample"><div class="ph"><h3>Sample research note · authored for this scenario</h3>${stateTag('sample')}</div><span class="dline">Same NVDA scenario · no external news, AI or forecast citations.</span></div>` },
  ];
  return statesBoard({ scheme, minHeight, title: 'Research tab · states', lead: 'Freshness by word and shape, the banners, a stale price, missing notes and addresses, a failed load, the public panels’ own states, a bridge below zero and the demo note.', trace: 'RSH-01, RSH-06, RP-01–RP-03, RN-01–RN-06, P-9, P-11', items });
}
