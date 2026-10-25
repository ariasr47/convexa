// Final · Convexa v1 — the ticker research tab and note view (/ticker/:symbol/research[/:slug]).
// Production: the owner's real note (research/NVDA/2026-10-13-initiation.md: title, strip, TL;DR, scorecard,
// revenue chart, margin comparison, GAAP bridge, catalysts, forecasts — figures as the note states them) in
// the v5 figure forms, with freshness by word and shape. Since 2026-10-25 (owner NO-4 A) the board draws the
// shipped anatomy: the head, strip and [value range | TL;DR] across the column, then rail, parts and side
// cards ("Filed since this note" under "This note comes due"), then the public record under the note: who is
// positioned how (FINRA Off, SEC Updated) and the SEC record. Staging: the shipped authored sample case
// (demo/catalog/shared.ts NVDA narrative) with its sample side panels and the "Public record · NVDA" band.
import { icon, finalPage } from '../../lib.mjs';
import { barList, chartFrame, fmt, plot, rangeBar, stateBody, ticks } from '../../chart-kit.mjs';
import { provChip, stateTag } from '../../components/data-states.mjs';
import { bridgeRows } from '../v5/system.mjs';
import { statesBoard } from '../v4/kit.mjs';
import { lastBar, sampleTaChart } from './ticker-tech.mjs';
import { plannedEnv, publicRecordSections } from './planned.mjs';
import { PL_CSS, boardNote } from './planned-kit.mjs';

export const TN_CSS = `${PL_CSS}
  .tn .nv { padding-top: 24px; }
  .tn-tabs { border-bottom: 1px solid var(--line); }
  .tn-head { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 16px 24px; padding-top: 28px; }
  .tn-head .l { flex: 999 1 540px; min-width: 0; display: flex; flex-direction: column; gap: 12px; }
  .tn-head .who { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 18px; }
  .tn-head .tk { font-family: 'Archivo', 'IBM Plex Sans', sans-serif; font-stretch: 112.5%; font-weight: 800; font-size: 56px; line-height: 1; }
  .tn-head h1 { margin: 0; font-size: 38px; line-height: 1.12; max-width: 26ch; text-wrap: balance; }
  .tn-head .deck { margin: 0; font-size: 16px; line-height: 1.6; color: var(--steel); max-width: 70ch; }
  .tn-head .r { flex: 1 1 300px; display: flex; flex-direction: column; gap: 6px; align-items: flex-start; font-size: 12px; color: var(--steel); }
  .tn-head .r .k { font-family: 'IBM Plex Mono', monospace; color: var(--phosphor); }
  .tn-lead { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 16px; }
  .tn-lead > .v { flex: 999 1 520px; min-width: 0; } .tn-lead > .t { flex: 1 1 340px; min-width: 0; }
  .tn-part { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
  .tn-part .n { font: 400 12px 'IBM Plex Mono', monospace; color: var(--steel); }
  .tn-part b { font-family: 'Archivo', 'IBM Plex Sans', sans-serif; font-stretch: 112.5%; font-weight: 700; font-size: 15px; letter-spacing: 0.06em; text-transform: uppercase; }
  .tn-part i { flex: 1; height: 1px; background: rgba(138,155,180,0.22); }
  .tn-sec { display: flex; flex-direction: column; gap: 6px; }
  .tn-sec .eb { font: 600 12px 'IBM Plex Mono', monospace; letter-spacing: 0.04em; color: var(--steel); text-transform: uppercase; }
  .nv-body .tn-sec h2 { margin: 0; font-size: 26px; line-height: 1.2; text-wrap: balance; }
  .tn-rparts { display: flex; flex-direction: column; gap: 2px; }
  .tn-rparts a { display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; gap: 6px; align-items: center; }
  .tn-rparts .c { font: 400 11px 'IBM Plex Mono', monospace; color: var(--steel); }
  .tn-band { display: flex; flex-direction: column; gap: 32px; padding-top: 40px; }
  .tn-band > header { display: flex; flex-direction: column; gap: 4px; }
  .tn-pos { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr)); gap: 16px; align-items: start; }
  .tn .nv.prod { grid-template-columns: 220px minmax(0, 1fr) 450px; }
  .tn .nv.stg { grid-template-columns: 220px minmax(0, 530px) minmax(0, 1fr); }
  .tn .nv-body ul.tn-ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 10px; font-size: 16px; line-height: 1.6; }
  .tn .nv-body ul.tn-ul small { font-size: 12.5px; color: var(--steel); }
  .tn .side-k { font: 600 11px 'IBM Plex Sans', sans-serif; letter-spacing: 0.08em; text-transform: uppercase; color: var(--steel); }
  @media (max-width: 1299px) { .tn .nv.prod, .tn .nv.stg { grid-template-columns: 200px minmax(0, 1fr); } }
  @media (max-width: 899px) { .tn .nv.prod, .tn .nv.stg { grid-template-columns: 1fr; } .tn-head .tk { font-size: 40px; } .tn-head h1 { font-size: 26px; } .nv-body .tn-sec h2 { font-size: 21px; } }
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

// =================================================================================================
// Production · the owner's NVDA note
// =================================================================================================
export function noteProductionBody({ minHeight = 0, scheme = 'dark', t = 'NVDA', phone = false } = {}) {
  // Owner NO-4 A (2026-10-25): the shipped anatomy (NoteView.tsx, NotesView.tsx, spec 04). The head, the strip
  // and [value range | TL;DR] span the column; then the rail of the note's five parts, the parts, and the side
  // cards (Next up, This note comes due, Filed since this note, Why uncertainty, your stance); then, under the
  // note, the public record: who is positioned how, and the SEC record. Only "Filed since this note" moved
  // to the side, under "This note comes due". The body draws an excerpt of each part, numbered as shipped.
  const PARTS = [['The verdict', 3], ['The evidence', 7], ['The debate', 3], ['Valuation and what’s next', 4], ['The record', 2]];
  const rail = `<nav class="nv-rail" aria-label="On this page"><span class="side-k" style="padding: 0 10px 6px;">On this page</span><span class="dline" style="padding: 0 10px 8px; font-size: 12px;">Part 1 of 5 · about 14 min left</span><div class="tn-rparts">${PARTS.map(([n, c], i) => `<a href="#p${i + 1}"${i === 0 ? ' aria-current="true"' : ''}><span class="c">${i + 1}</span><span>${n}</span><span class="c">${c}</span></a>`).join('')}</div></nav>`;
  const head = `<div class="tn-head"><div class="l"><div class="who"><span class="tk">${t}</span><span style="display: flex; flex-direction: column;"><span style="font-size: 17px; font-weight: 600;">NVIDIA</span><span class="steel" style="font-size: 13px;">Nasdaq · AI accelerators, networking and the CUDA software stack</span></span></div>
    <h1 class="display">A 70% growth guide on a $412B year. What comes after FY2028 is the whole question.</h1>
    <p class="deck">NVIDIA sells most of the chips, networking and software that AI data centers run on, and it keeps about two-thirds of its revenue as operating profit. Its own guide puts FY2028 revenue about 70% higher, so the price rests on what follows: growth that companies this size almost never keep up, and margins that stay far above NVIDIA’s pre-AI level while its largest buyers design their own chips.</p></div>
    <div class="r"><span><span class="k">Price</span> as of Oct 12, 2026 · 2 days old</span><span><span class="k">Thesis</span> reviewed Oct 13, 2026 · 1 day ago</span><span style="display: inline-flex; flex-wrap: wrap; gap: 6px; align-items: center;"><span class="k">Status</span>${fresh('full', 'Current', '· review by Oct 22 (GTC Berlin)')}</span><span style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px;"><span class="stag k-quiet">Stance · your call</span><span class="stag k-quiet">Position · not stated</span><span class="stag k-quiet">14 min · 4 min skim</span><span class="stag k-quiet">Initiation · first note</span></span></div></div>`;
  const strip = `<div class="rs-strip">${[['Price', '$226.32', 'close · Oct 12', 'TradingView close (display)'], ['Revenue · Q2 FY27', '$96.2B', '▲ 106% on a year', '8-K 99.1 · Aug 26'], ['Operating margin', '66.2%', '▲ 5.4 pts on a year', '10-Q · Q2 FY27'], ['Free cash flow', '$21.3B', '▼ from $48.6B in Q1', '10-Q · Q2 FY27']].map(([l, v, d, c]) => `<div style="background: var(--panel); padding: 14px 16px; display: flex; flex-direction: column; gap: 6px;"><span class="caps">${l}</span><span class="mono" style="font-size: 22px; font-weight: 500;">${v}</span><span class="pillN">${d}</span>${provChip(c, 'solid')}</div>`).join('')}</div>`;
  const tldr = `<section aria-labelledby="tldr" class="hd-p" style="gap: 12px;"><span id="tldr" class="caps">TL;DR · 30 seconds</span><div class="tn-tldr">${[['~70%', 'NVIDIA’s first full-year guide: FY2028 revenue up about 70%, limited by supply, not demand. Consensus sits at $692B.'], ['66%', 'GAAP operating margin in Q2 FY2027, about double the pre-AI level. The base case lets it fall to 45% by FY2034.'], ['$108.5B', 'The most NVIDIA could owe under guarantees for customers’ data centers, beside $99B of stakes in other companies, many of them buyers.']].map(([k, p]) => `<span class="k">${k}</span><p>${p}</p>`).join('')}</div></section>`;
  const sec = (n, label, title, inner) => `<section class="tn-sec" id="s${n}"><span class="eb">${String(n).padStart(2, '0')} · ${label}</span><h2 class="display">${title}</h2>${inner}</section>`;
  const part = (n, title) => `<div class="tn-part" id="p${n}"><span class="n">Part ${n}</span><b>${title}</b><i></i></div>`;
  const sc = `<div class="drows tn-sc">${[['FY2028 grows about 70%', '~70%, supply-limited; consensus $692B', 'ok', '✓ On track'], ['Margins hold near 72%', 'Q3 74%; Q4 71–72%; FY2028 72–73%', 'watch', '! Watch'], ['Customers pay on normal terms', 'DSO 60, up from 45 a quarter earlier', 'watch', '! Watch'], ['Hyperscalers keep buying', '$48.7B, +13% on the quarter', 'ok', '✓ On track'], ['The capex cycle keeps rising', '~$800B in 2026, ~$1.3T expected in 2027', 'ok', '✓ On track']].map(([a, b, k, w]) => `<div><span style="font-weight: 600;">${a}</span><span class="steel">${b}</span><span class="status ${k}">${w}</span></div>`).join('')}</div><span class="dline">Status by glyph, word and weight: on track is outlined, watch is tinted. No direction colour: these are facts about the company.</span>`;
  const forecasts = `<div class="drows">${[['Nov 17', 'Q3 FY2027 revenue is at least $105.84B, the low end of guidance.'], ['Nov 17', 'NVIDIA guides Q4 FY2027 revenue at or above $124.5B, the consensus.'], ['Nov 17', 'NVIDIA keeps or raises its ~70% FY2028 growth outlook.'], ['Nov 17', 'DSO is at or below 60 days at the end of Q3 FY2027.'], ['Feb 2027', 'Q4 FY2027 GAAP gross margin is at least 71.0%.']].map(([d, c]) => `<div style="grid-template-columns: 72px minmax(0, 1fr) auto; padding: 10px 0;"><span class="mono steel">${d}</span><span style="font-size: 14px;">${c}</span><span class="stag k-quiet">P · not set</span></div>`).join('')}</div><span class="dline">Awaiting resolution. A probability set before the date is what the Scorecard scores; none is set yet.</span>`;
  const body = `<div class="nv-body">
    ${part(1, 'The verdict')}
    ${sec(1, 'What the price implies', 'The price needs growth after FY2028 that almost no company this size has kept up.', '<p>Among companies with sales above $50B, real sales growth above 15% a year for five years happened in 3.3% of cases from 1950 to 2015. Today’s operating profit, capitalized with no growth at all, supports well under half of the price.</p>')}
    ${sec(2, 'Margins against history and peers', 'Today’s margin is about double NVIDIA’s own past and above every peer.', marginChart())}
    ${sec(3, 'Thesis scorecard', 'Growth is on track; margins, financing and custom chips need watching.', sc)}
    ${part(2, 'The evidence')}
    ${sec(5, 'Revenue and earnings quality', 'Revenue more than doubled in a year, and growth sped up for a fourth straight quarter.', revenueChart())}
    ${sec(6, 'GAAP and adjusted profit', 'Operating profit is clean; net income is lifted by gains on stakes in other companies.', bridgeRows({ steps: [['GAAP net income', 59688, 'total'], ['Gains on stakes, removed', -7473, 'step'], ['Acquisition costs, added back', 222, 'step'], ['Tax on the adjustments', 1517, 'step'], ['Non-GAAP net income', 53954, 'total']], claim: 'Gains on stakes lift GAAP net income $5.7B above non-GAAP', sub: 'Q2 FY2027 GAAP to non-GAAP net income · $ millions', source: '8-K 99.1 · Aug 26, 2026', asof: 'Note of Oct 13, 2026' }).replace(/<p class="cf-note">[\s\S]*?<\/p>/, '<p class="cf-note">Up steps filled, down steps outlined; the sign is in the label, never the hue.</p>'))}
    ${part(4, 'Valuation and what’s next')}
    ${sec(15, 'Catalysts', 'November’s results update the 70% guide; Broadcom and the hyperscalers’ capex plans follow.', catalystsChart())}
    ${sec(17, 'Forecasts', 'Five checkable calls, scored when they resolve.', forecasts)}
    <p class="dline" style="font-size: 12px;">Personal research notes. Not investment advice. 26 sources, filings first.</p></div>`;
  const side = `<aside class="nv-side" aria-label="About this note">${P('<span class="side-k">Next up · in 6 days</span>', '', '<strong style="font-size: 15px;">GTC Berlin</strong><span class="dline" style="font-size: 13px;">Oct 20–22</span>')}${P('<span class="side-k">This note comes due</span>', '', `<div class="drows">${[['Oct 22', 'GTC Berlin ends (keynote Oct 21)'], ['Oct 28', 'FOMC decision · moves the discount rate'], ['Nov 11', 'Price turns 30 days old'], ['Nov 17', 'Q3 FY2027 results']].map(([d, w]) => `<div style="grid-template-columns: 56px minmax(0, 1fr);"><span class="mono steel">${d}</span><span>${w}</span></div>`).join('')}</div><span class="dline" style="font-size: 11.5px;">After the first date, this page names what happened since. Worked out in your browser from the note’s own dates and the published release calendar.</span>`)}${filedSincePanel()}${P('<span class="side-k">Why uncertainty is very high</span>', '', '<span style="font-size: 13px; line-height: 1.5;">Consensus FY2028 revenue alone spans $506–778B, and three direct customers bought 44% of first-half revenue.</span><span class="dline">That is why the value range is wide: $53.56 to $431.39 a share.</span>')}<section class="hd-p" style="background: transparent; border-style: dashed;" aria-label="Your stance, target, position"><span class="side-k">Your stance, target, position</span><span style="font-size: 14px;">Not set yet.</span><span class="dline">These are the author’s own calls, set in the note’s front matter. Nothing on this page sets them.</span></section></aside>`;
  const positioned = `<section class="pl-sec" aria-labelledby="positioned"><header><div class="row"><h2 id="positioned">Who is positioned how</h2></div><p class="sl">Short sellers and insiders, from public records. Each card names its source and how late it reports.</p></header><div class="tn-pos">${finraOffPanel('Short interest')}${finraOffPanel('Short-sale volume')}${insiderPanel()}</div></section>`;
  // At 390 the four SEC sections would take the board past the canvas's 8,000px frame; each has its own phone
  // board on its Planned row, so the phone board stops after Who is positioned how and says so above the page.
  const band = `<div class="tn-band">${positioned}${phone ? '' : publicRecordSections(plannedEnv('prod'))}</div>`;
  return (phone ? boardNote(scheme, '<b>Phone board:</b> under Who is positioned how the page continues with the SEC record (insider trades, figures against the filing, fund holdings, peers); each is drawn at 390 on its own Planned row.') : '') + finalPage({ scheme, minHeight, active: 'research', label: `${t} research note`, main: `<div class="wrap tn">${tabs(t)}${head}<div style="display: flex; flex-direction: column; gap: 16px; padding-top: 24px;">${strip}<div class="tn-lead"><div class="v">${valueRange()}</div><div class="t">${tldr}</div></div></div><div class="nv prod">${rail}${body}${side}</div>${band}</div>` });
}

// =================================================================================================
// Staging · the authored sample case
// =================================================================================================
export function noteStagingBody({ minHeight = 0, scheme = 'dark', t = 'NVDA' } = {}) {
  // As shipped (fidelity DESK-15, 2026-10-25; spec 04 C2 keeps this layout): the rail with Assumptions, the
  // Evidence with each source line, the side's short-interest bars and Filings, then the "Public record · NVDA"
  // band under the note (shipped 2026-10-15), every section in its sample form.
  const rail = `<nav class="nv-rail" aria-label="On this page">${['Thesis', 'Evidence', 'Risks', 'Invalidation', 'Catalysts', 'Assumptions'].map((s, i) => `<a href="#d${i}"${i === 0 ? ' aria-current="true"' : ''}>${s}</a>`).join('')}</nav>`;
  const b = lastBar();
  const src = `<small>Source: portfolio-2026-10-07-v1:NVDA:${b.date}</small>`;
  const ul = (items) => `<ul class="tn-ul">${items.map((x) => `<li>${x}</li>`).join('')}</ul>`;
  const body = `<div class="nv-body">
    <div style="display: flex; flex-direction: column; gap: 12px;"><span class="caps">Sample research note · authored for this scenario</span><h1 class="display" style="margin: 0; font-size: clamp(28px, 2.8vw, 38px); line-height: 1.15;">NVDA higher-variation case</h1><div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">${stateTag('sample', 'Sample note')}${provChip('Authored scenario · Oct 7, 2026 · portfolio-2026-10-07-v1 · advisory context', 'dashed')}</div></div>
    <h2 id="d0" class="display">Thesis</h2><p>The NVDA example pairs a rising close path with visibly larger authored bars to frame a higher-variation scenario.</p>
    <h2 id="d1" class="display">Evidence</h2>
    ${ul([`The final close is the price anchor for this higher-variation case. Close: ${b.close.toFixed(2)} USD on ${b.date}. ${src}`, `The latest bar high-low span supplies its authored range evidence. High ${b.high.toFixed(2)} USD; low ${b.low.toFixed(2)} USD on ${b.date}. ${src}`])}
    ${sampleTaChart({ height: 220, sym: 'NVDA', rsi: false, focus: false })}
    <h2 id="d2" class="display">Risks</h2>${ul(['The synthetic range does not estimate real volatility.', 'The example has no semiconductor supply-chain inputs.'])}
    <h2 id="d3" class="display">Invalidation</h2><p>Revisit the variation thesis if subsequent authored ranges contract across the same window.</p>
    <h2 id="d4" class="display">Catalysts</h2>${ul(['Not curated for this sample.'])}
    <h2 id="d5" class="display">Assumptions</h2>${ul(['Daily OHLCV values are synthetic and authored for this scenario.', 'No live provider, broker, or AI response is used.'])}
    <p class="dline" style="font-size: 12px;">Same NVDA scenario · no external news, AI or forecast citations. Not investment advice.</p>
    <button class="btn ghost sm" type="button" style="align-self: flex-start;">Refresh sample</button></div>`;
  // The demo's short interest (libs/api demo/public-data.ts: 3.0e8 × (0.92 + 0.08 sin i) over the twelve
  // settlements Apr 15 – Sep 30), on the v5 bar form: 276M to 252M, 1.05% of 24.0B shares, 1.68 days to cover.
  const SET = ['Apr 15', 'Apr 30', 'May 15', 'May 29', 'Jun 15', 'Jun 30', 'Jul 15', 'Jul 31', 'Aug 14', 'Aug 29', 'Sep 15', 'Sep 30'];
  const SI = SET.map((_, i) => Math.round(300 * (0.92 + 0.08 * Math.sin(i))));
  const siBars = chartFrame({
    claim: 'Shares sold short fell about 9% since Apr 15, to 252M (1.05% of shares out)',
    sub: 'NVDA short interest at each FINRA settlement · millions of shares · right: % of the Aug 20 shares outstanding (SEC) · last 12 settlements · 1.68 days to cover',
    body: plot({ height: 150, pl: 40, pr: 44, prn: 40, pt: 18, pb: 24, ends: false, keyboard: false, x: { min: -0.6, max: SET.length - 0.4, ticks: [0, 3, 6, 11].map((i) => ({ v: i, label: SET[i] })) }, y: { min: 0, max: 500, ticks: [{ v: 0, label: '0' }, { v: 250, label: '250M' }, { v: 500, label: '500M' }] }, hlines: [{ v: 0, kind: 'zero' }], bars: SI.map((v, i) => ({ x: i, v, role: i === SI.length - 1 ? 'emph' : 'ctx', label: i === SI.length - 1 ? '252M' : '' })), barW: 14, aria: `NVDA shares sold short at each settlement, Apr 15 to Sep 30: ${SI.join(', ')} million` }),
    kind: 'sample', source: 'Demo · shaped like FINRA short interest', sourceKind: 'dashed', asof: 'Settled Sep 30, 2026 · published about a week later',
  });
  const filings = `<section class="hd-p is-sample" aria-label="Filings"><div class="ph"><h3>Filings</h3>${stateTag('sample')}</div><div class="drows">${[['Sep 24', '8-K', 'Item 5.07'], ['Aug 27', '10-Q', ''], ['Aug 27', '8-K', 'Item 2.02, 9.01']].map(([d, f, x]) => `<div style="grid-template-columns: 56px 40px minmax(0, 1fr); font-size: 13px; padding: 9px 0;"><span class="mono steel">${d}</span><span class="mono">${f}</span><span class="steel">${x}</span></div>`).join('')}</div><span class="dline">A sample filing list for the scenario. Not SEC records.</span><div>${provChip('Sample · shaped like SEC EDGAR', 'dashed')}</div></section>`;
  const side = `<aside class="nv-side" aria-label="About this note">${P('About this sample', stateTag('demo'), '<span class="dline" style="font-size: 13px;">Every figure cites a sample bar from the Oct 7 scenario. The production site shows the owner’s real notes, with their sources, freshness and the public panels.</span>')}${siBars}${filings}</aside>`;
  const band = `<div class="tn-band"><header><span class="caps" style="color: var(--phosphor);">Public record · ${t}</span><span class="dline" style="font-size: 13px;">Demo · sample data; nothing here is an SEC record.</span></header>${publicRecordSections(plannedEnv('demo'))}</div>`;
  return finalPage({ scheme, minHeight, demo: true, active: 'research', label: `${t} sample research note`, main: `<div class="wrap tn">${tabs(t)}<div class="nv stg">${rail}${body}${side}</div>${band}</div>` });
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
