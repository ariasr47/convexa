// Final · Convexa v1 — the Research group: Notes (the index), Markets, Filings, Scorecard, under the
// Research tabs (lib.mjs v4Tabs). Production runs on public data and the owner's real notes in
// research/ (14 tickers, all written Oct 13, 2026); staging is the demo account on the Oct 7, 2026
// scenario with the demo's six authored sample notes. Charts are the ruled v5 forms (./research-charts.mjs);
// spec cards are in ./research-spec.mjs.
import { icon, finalPage, STAGING_DEMO_URL } from '../../lib.mjs';
import { provChip, stateTag } from '../../components/data-states.mjs';
import { chartFrame } from '../../chart-kit.mjs';
import { statesBoard } from '../v4/kit.mjs';
import { DATES, byMonthChart, calibChart, cftcChart, cftcMultiples, curveChart, decompChart, driftChart, env, figuresChart, figuresTable, frameState, miniBars, ratesToday, signalsChart, spreadChart } from './research-charts.mjs';
import { FILINGS_SPEC, INDEX_SPEC, MARKETS_SPEC, SCORECARD_SPEC } from './research-spec.mjs';
import { PL_CSS, boardNote, env as plEnv, section } from './planned-kit.mjs';
import { calSection, liqSection } from './planned.mjs';

export const FR_CSS = `
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .fr-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; padding: 12px 16px; border-radius: 12px; border: 1px solid var(--line); background: var(--panel); }
  .fr-legend .n { font: 500 12px 'IBM Plex Mono', monospace; color: var(--steel); }
  .fr-2 { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: 16px; align-items: start; }
  .fr-2.half { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fr-c3 { display: grid; grid-template-columns: repeat(var(--fc, 3), minmax(0, 1fr)); gap: 12px; }
  @container (max-width: 760px) { .fr-c3 { grid-template-columns: minmax(0, 1fr); } }
  .fr-dl { margin: 0; display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 8px 16px; font-size: 13px; }
  .fr-dl dt { color: var(--steel); } .fr-dl dd { margin: 0; color: var(--phosphor); }
  .fr-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr)); gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
  .fr-strip > div { background: var(--panel); padding: 14px 18px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .fr-strip .v { font: 500 24px/1.2 'IBM Plex Mono', monospace; }
  .fr-strip.demo { border-style: dashed; border-color: var(--steel-2); }
  .fr-bar { display: flex; flex-wrap: wrap; gap: 8px 10px; align-items: center; }
  .fr-bar .grp { display: inline-flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .fr-bar .lbl { font-size: 12px; color: var(--steel); margin-right: 2px; }
  .fr-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  .v4 .fr-card, .v4 .fr-card h2, .v4 .fr-card .mono { text-decoration: none; color: var(--phosphor); }
  .fr-card { gap: 10px; }
  .v4 .rs-chipbar a:not([aria-current="true"]) { color: var(--steel); }
  .v4 .rs-chipbar a[aria-current="true"] { color: var(--ink); }
  .fr-card.demo { border-style: dashed; border-color: var(--steel-2); position: relative; }
  .fr-card.demo::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 8px; border-radius: 11px 11px 0 0; background: repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in srgb, var(--steel) 28%, transparent) 6px 12px); }
  .fr-card .t { display: flex; justify-content: space-between; align-items: baseline; gap: 6px 8px; flex-wrap: wrap; }
  .fr-card h2 { margin: 0; font-family: 'Archivo', 'IBM Plex Sans', sans-serif; font-stretch: 112.5%; font-weight: 600; font-size: 16.5px; line-height: 1.3; text-wrap: balance; }
  .fr-card .meta { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; color: var(--steel); }
  .fr-card .ft { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid var(--line); margin-top: auto; }
  .fr-mini { display: flex; flex-direction: column; gap: 6px; }
  .fr-mini .cap { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; color: var(--steel); }
  .fr-mini .cap b { font: 500 12px 'IBM Plex Mono', monospace; color: var(--phosphor); white-space: nowrap; }
  .fr-fresh { display: inline-flex; gap: 8px; align-items: center; font-size: 12.5px; }
  .fr-fresh i { display: inline-block; width: 10px; height: 10px; flex: 0 0 auto; box-sizing: border-box; border-radius: 50%; border: 1px solid var(--phosphor); }
  .fr-fresh i.full { background: var(--phosphor); }
  .fr-fresh i.half { background: linear-gradient(90deg, var(--phosphor) 50%, transparent 50%); }
  .fr-fresh i.sq { border-radius: 2px; border-width: 2px; }
  .fr-feed > div { display: grid; grid-template-columns: 56px 56px 84px minmax(0, 1fr) 128px; gap: 12px; align-items: center; padding: 10px 16px; border-top: 1px solid var(--line); font-size: 13px; }
  .fr-feed > div[aria-current="true"] { background: rgba(138,155,180,0.08); box-shadow: inset 2px 0 0 var(--phosphor); }
  .fr-form { font: 600 11px 'IBM Plex Mono', monospace; padding: 2px 6px; border-radius: 5px; background: rgba(138,155,180,0.16); text-align: center; white-space: nowrap; justify-self: start; }
  .fr-std { font-size: 12px; color: var(--steel); }
  .fr-std.new { color: var(--phosphor); font-weight: 600; }
  .fr-exp { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr)); gap: 12px; }
  .fr-exp > div { padding: 12px 14px; gap: 4px; }
  .fr-nc details > summary { cursor: pointer; font-size: 13px; font-weight: 600; color: var(--text-info); min-height: 24px; display: inline-flex; align-items: center; }
  .fr-tick { display: flex; flex-wrap: wrap; gap: 6px; }
  .fr-tick span { font: 500 12px 'IBM Plex Mono', monospace; padding: 2px 8px; border: 1px solid var(--line-2); border-radius: 6px; }
  .fr-soon > div { display: grid; grid-template-columns: 56px 52px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 8px 0; border-top: 1px solid var(--line); font-size: 13px; }
  .fr-p { font: 500 12px 'IBM Plex Mono', monospace; padding: 1px 8px; border-radius: 999px; border: 1px dashed var(--line-2); color: var(--steel); white-space: nowrap; }
  @container (max-width: 480px) { .smx { --smc: 1 !important; } }
  @container (max-width: 720px) { .smx { --smc: 2 !important; } }
  @media (max-width: 1099px) { .fr-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 899px) {
    .fr-2, .fr-2.half { grid-template-columns: minmax(0, 1fr); }
    .fr-cards { grid-template-columns: minmax(0, 1fr); }
    .fr-feed > div { grid-template-columns: 52px minmax(0, 1fr); gap: 4px 10px; padding: 12px 14px; }
    .fr-feed > div > :nth-child(2) { grid-row: 1; grid-column: 2; }
    .fr-feed > div > :nth-child(3) { display: none; }
    .fr-feed > div > :nth-child(4), .fr-feed > div > :nth-child(5) { grid-column: 2; }
    .fr-soon > div { grid-template-columns: 52px minmax(0, 1fr); }
    .fr-soon > div > :nth-child(3), .fr-soon > div > :nth-child(4) { grid-column: 2; }
    .fr-soon .btn { min-height: 44px; justify-self: start; }
    .fr-bar .pill, .fr-bar .pill-on { min-height: 44px; }
    .rs-chipbar a { min-height: 44px; }
    .rs-h h1 { font-size: 34px; }
  }
`;

const DEMO_LINK = (path, text = 'See it on the demo →') => `<a href="${STAGING_DEMO_URL}${path}" class="t-info" style="display: inline-flex; gap: 6px; align-items: center; min-height: 24px; font-weight: 500;">${text}</a>`;
const head = (title, lead, chips = '') => `<div class="rs-h"><h1 class="display">${title}</h1><p class="lead">${lead}</p>${chips ? `<div class="rs-chips">${chips}</div>` : ''}</div>`;
const legendBar = (items) => `<section class="fr-legend" aria-label="Data on this page"><span class="caps" style="color: var(--phosphor);">On this page</span>${items.map(([k, w, n]) => `<span style="display: inline-flex; gap: 6px; align-items: center;">${stateTag(k, w)}<span class="n">${n}</span></span>`).join('')}</section>`;
const foot = (t) => `<p class="dline" style="margin: 0;">${t}</p>`;
const chip = (e, real, shaped) => provChip(e.src(real, shaped), e.sk);
const P = (title, tag, inner, { label = '', demo = false, id = '' } = {}) => `<section class="hd-p"${demo ? ' style="border-style: dashed; border-color: var(--steel-2);"' : ''} aria-label="${label || title.replace(/<[^>]+>/g, '')}"${id ? ` id="${id}"` : ''}><div class="ph"><h3>${title}</h3>${tag}</div>${inner}</section>`;
// staging's tab badges count the demo's notes and forecasts, not production's
const page = (o) => { const html = finalPage(o); return o.demo ? html.replace('<span class="cnt">14</span>', '<span class="cnt">6</span>').replace('<span class="cnt">77 open</span>', '<span class="cnt">34 open</span>') : html; };

// =================================================================================================
// 1 · Research index (/research)
// =================================================================================================
// [ticker, company, title, uncertainty, fresh ('full'|'half'), freshness words, next, chart caption, values, guide idx, latest label]
const NOTES = [
  ['AMD', 'Advanced Micro Devices', 'The price already pays for AMD winning a real share of AI chips.', 'very high', 'full', 'Current · review by Nov 3', 'Q3 2026 results · Nov 3 · in 20 days', 'Quarterly revenue, $M', [7658, 7438, 7685, 9246, 10270, 10253, 11536, 13000], [7], '$11,536M'],
  ['AMZN', 'Amazon.com', 'The AI build-out is paid for now. Whether it earns its cost is the whole question.', 'high', 'full', 'Current · review by Oct 27', 'Q3 2026 results · Oct 27–30 · in ~2 weeks', 'Quarterly net sales, $B', [187.8, 155.7, 167.7, 180.2, 213.4, 181.5, 200.6, 199.5], [7], '$200.6B'],
  ['CBRS', 'Cerebras Systems', 'A $25B backlog, and a price that needs the bull case.', 'very high', 'half', 'Review due · since Oct 14', 'Lock-up tranche · today', 'Core revenue by quarter, $M', [99.5, 103.3, 136, 171, 191.3, 209.9, 215, 269], [6, 7], '$209.9M'],
  ['CRWV', 'CoreWeave', 'A $104B backlog, built on $35B of debt.', 'extreme', 'full', 'Current · review by Nov 5', 'Q3 2026 results · Nov 5–16 · in ~3 weeks', 'Quarterly revenue, $M', [982, 1212, 1365, 1572, 2078, 2575, 3525, 4622], [6, 7], '$2,575M'],
  ['GOOGL', 'Alphabet', 'A $200B-a-year build-out, priced as if it earns what search did.', 'high', 'full', 'Current · review by Oct 28', 'Q3 2026 results · Oct 28 · in 14 days', 'Quarterly revenue, $M', [88268, 96469, 90234, 96428, 102346, 113828, 109896, 119796], [], '$119,796M'],
  ['HOOD', 'Robinhood Markets', 'Record trading at a cyclical broker. The price needs it to compound for years.', 'high', 'full', 'Current · review by Oct 27', 'Q3 2026 results · Oct 27 · in 13 days', 'GAAP operating margin by year, %', [-90.4, -74.4, -28.7, 35.7, 46.8, 46.0, 28.0], [6], '46.0% TTM'],
  ['INTC', 'Intel', 'A $577B price on a foundry with $293M of outside sales.', 'very high', 'full', 'Current · review by Oct 29', 'Q3 2026 results · Oct 29 · in 15 days', 'Quarterly revenue, $M', [14260, 12667, 12859, 13653, 13674, 13577, 16128, 16300], [7], '$16,128M'],
  ['META', 'Meta Platforms', 'The ad machine is growing faster. The AI build now costs half its revenue.', 'high', 'full', 'Current · review by Oct 21', 'Q3 2026 results · Oct 21 · in 7 days', 'Quarterly revenue, $M', [48385, 42314, 47516, 51242, 59893, 56311, 60801, 62500], [7], '$60,801M'],
  ['MSFT', 'Microsoft', 'Microsoft now spends 44% of its revenue on capex. What that capital earns decides the price.', 'medium', 'full', 'Current · review by Oct 28', 'FQ1-27 results · Oct 28 · in 14 days', 'Quarterly revenue, $M (FY ends Jun 30)', [65585, 69632, 70066, 76441, 77673, 81273, 82886, 90007, 90400], [8], '$90,007M'],
  ['MU', 'Micron Technology', 'Record margins on a cyclical chip. How long they last is the whole question.', 'high', 'full', 'Current · review by Dec 9', 'Capital return steps up · Dec 9 · in ~8 weeks', 'GAAP gross margin by fiscal year, %', [20.2, 41.5, 58.9, 45.7, 30.6, 37.6, 45.2, -9.1, 22.4, 39.8, 80.7], [], '80.7% FY26'],
  ['NVDA', 'NVIDIA', 'A 70% growth guide on a $412B year. What comes after FY2028 is the whole question.', 'very high', 'full', 'Current · review by Oct 20', 'GTC Berlin · Oct 20 · in 6 days', 'Quarterly revenue, $M', [44062, 46743, 57006, 68127, 81615, 96221, 108000], [6], '$96,221M'],
  ['SPCX', 'SpaceX', 'Starlink earns the profit; the price is a bet on an AI cloud.', 'very high', 'full', 'Current · review by Oct 24', 'Lock-up tranche · Oct 24 · in 10 days', 'Revenue by quarter, $B', [4.07, 4.07, 5.27, 5.27, 4.69, 7.81, 25], [6], '$7.81B'],
  ['TSLA', 'Tesla', 'Car margins near 1%, and a price set by robotaxis and robots.', 'very high', 'full', 'Current · review by Oct 21', 'Q3 2026 results · Oct 21 · in 7 days', 'Quarterly revenue, $M', [25707, 19335, 22496, 28095, 24901, 22387, 28236, 27890], [7], '$28,236M'],
  ['TSM', 'TSMC', 'Indispensable to AI. The price assumes the boom keeps compounding for years.', 'high', 'full', 'Current · review by Oct 15', '3Q26 results and 4Q26 guide · Oct 15 · tomorrow', 'Quarterly revenue, NT$ billions', [868.46, 839.25, 933.79, 989.92, 1046.09, 1134.1, 1270.38, 1494.25, 1610], [8], 'NT$1,494B'],
];
// the demo's six authored sample notes (libs/api/src/lib/demo/catalog/shared.ts researchNarratives). The bars
// are the seed's last ten daily close changes, % to two places (makeScenario over each catalog/*.seed.json
// base, step and phase; ResearchIndexPage.tsx useSampleCards), and Next is each note's first sample trigger
// (fidelity R-15, 2026-10-25; ruling 2026-10-14 (3): bar values follow the seed).
const FOMC_NEXT = 'FOMC decision · Oct 28 · in 21 days';
const DEMO_NOTES = [
  ['AAPL', 'Apple', 'AAPL single-name range case', 'The AAPL case uses a compact single-name path to discuss how a close can sit inside a wider authored daily range.', [0.13, 0.11, 0.09, 0.07, 0.05, 0.02, 0, -0.02, -0.04, -0.05], FOMC_NEXT],
  ['MSFT', 'Microsoft', 'MSFT steady-trend case', 'The MSFT scenario emphasizes a steadier sequence of daily closes for a trend-versus-pause discussion.', [0.12, 0.1, 0.07, 0.05, 0.02, 0, -0.02, -0.03, -0.05, -0.05], FOMC_NEXT],
  ['NVDA', 'NVIDIA', 'NVDA higher-variation case', 'The NVDA example pairs a rising close path with visibly larger authored bars to frame a higher-variation scenario.', [0.13, 0.1, 0.08, 0.05, 0.03, 0.02, -0.01, -0.02, -0.02, -0.02], FOMC_NEXT],
  ['QQQ', 'Invesco QQQ Trust', 'QQQ growth-duration case', 'The QQQ example gives growth-duration exposure a distinct rising path with a wider daily range than its neighboring close changes.', [0.15, 0.14, 0.13, 0.11, 0.08, 0.06, 0.04, 0.01, -0.01, -0.02], FOMC_NEXT],
  ['SPY', 'SPDR S&amp;P 500 ETF', 'SPY breadth and balance case', 'The synthetic SPY path rises gradually while alternating closes keep the example focused on broad-market balance.', [0.14, 0.14, 0.13, 0.11, 0.09, 0.07, 0.05, 0.02, 0, -0.02], FOMC_NEXT],
  ['TSLA', 'Tesla', 'TSLA reversal and range case', 'The TSLA case uses a more oscillating authored path to discuss range and reversal risk without implying direction.', [0.1, 0.07, 0.05, 0.03, 0.01, -0.01, -0.02, -0.03, -0.02, -0.01], 'Q3 results · Oct 22 · in 15 days'],
];
// The demo's Coming up: the five sample triggers in date order (the app's demo calendar of Oct 7).
const DEMO_COMING = [['Oct 22', 'TSLA · Q3 results', '', '~2 weeks'], ['Oct 28', 'Fed · FOMC decision', 'every note', '~3 weeks'], ['Oct 29', 'MSFT · Q1 FY27 results', '', '~3 weeks'], ['Oct 29', 'AAPL · Results, estimated from filing history', 'Oct 29–Nov 2', '~3 weeks'], ['Nov 18', 'NVDA · Results, estimated from filing history', 'Nov 18–20', '~6 weeks']];
const fresh = (k, w) => `<span class="fr-fresh"><i class="${k}" aria-hidden="true"></i><strong style="font-weight: 600;">${w.split(' · ')[0]}</strong><span class="steel">· ${w.split(' · ').slice(1).join(' · ')}</span></span>`;

function noteCard([t, co, title, unc, fk, fw, next, cap, vals, guide, last]) {
  return `<a href="/ticker/${t}/research" class="hd-p fr-card" aria-label="${t} · ${co} · ${title}"><div class="t"><span><span class="mono" style="font-weight: 600; font-size: 16px;">${t}</span> <span class="steel" style="font-size: 13px;">${co}</span></span><span class="prov dashed">Stance · your call</span></div>
    <h2>${title}</h2>
    <div class="fr-mini"><div class="cap"><span>${cap}${guide.length ? ' · dashed = guide or consensus' : ''}</span><b>${last}</b></div>${miniBars(vals, { guide, aria: `${t} ${cap}: ${vals.join(', ')}${guide.length ? '; last bar is guidance or consensus' : ''}` })}</div>
    <div class="meta"><span>Uncertainty · ${unc}</span><span>Next · ${next}</span></div>
    <div class="ft">${fresh(fk, fw)}<span class="steel" style="font-size: 12px;">Written Oct 13</span><span class="t-info" style="display: inline-flex; gap: 4px; align-items: center; font-weight: 500; font-size: 13px;">Open note ${icon('arrow', 13)}</span></div></a>`;
}
function demoCard([t, co, title, thesis, vals, next]) {
  return `<a href="/ticker/${t}/research" class="hd-p fr-card demo" aria-label="${t} · ${title} · sample note"><div class="t" style="margin-top: 4px;"><span><span class="mono" style="font-weight: 600; font-size: 16px;">${t}</span> <span class="steel" style="font-size: 13px;">${co}</span></span>${stateTag('sample', 'Sample note')}</div>
    <h2>${title}</h2><p class="dline" style="margin: 0; font-size: 13px;">${thesis}</p>
    <div class="fr-mini"><div class="cap"><span>Daily close change, % · last 10 sessions</span><b class="${vals[vals.length - 1] > 0 ? 't-up' : vals[vals.length - 1] < 0 ? 't-down' : ''}">${vals[vals.length - 1] > 0 ? '▲ +' : vals[vals.length - 1] < 0 ? '▼ −' : '± '}${Math.abs(vals[vals.length - 1]).toFixed(2)}%</b></div>${miniBars(vals, { aria: `${t} sample daily change over 10 sessions: ${vals.join(', ')}` })}</div>
    <div class="meta"><span>Next · ${next}</span></div>
    <div class="ft">${fresh('full', 'Current · scenario of Oct 7')}<span class="t-info" style="display: inline-flex; gap: 4px; align-items: center; font-weight: 500; font-size: 13px;">Open note ${icon('arrow', 13)}</span></div></a>`;
}

export function indexBody({ demo = false, scheme = 'dark', minHeight = 0 } = {}) {
  const filters = demo
    ? `<div class="fr-bar" role="group" aria-label="Filter notes"><div class="fld" style="flex: 1 1 260px; max-width: 340px;"><span class="in">${icon('search', 15)}<span class="steel">Find a ticker</span></span></div><span class="pill-on">All · 6</span><span class="pill">Current · 6</span></div>`
    : `<div class="fr-bar" role="group" aria-label="Filter notes"><div class="fld" style="flex: 1 1 260px; max-width: 340px;"><span class="in">${icon('search', 15)}<span class="steel">Find a ticker</span></span></div><span class="grp"><span class="lbl">Stance</span><span class="pill-on">All · 14</span><span class="pill" style="border-style: dashed;">Stance not set · 14</span></span><span class="grp"><span class="lbl">Freshness</span><span class="pill">Current · 13</span><span class="pill">Review due · 1</span></span></div>`;
  const coming = demo
    ? `<section class="hd-p is-sample" aria-label="Coming up · next 10 weeks"><div class="ph"><h3>Coming up · next 10 weeks</h3>${stateTag('sample')}</div><p class="dline" style="margin: 0;">Each note’s results date, the FOMC decision for every note, and results windows estimated from filing history. Each date is when its note comes due for review. As of Oct 7, 2026.</p><div class="drows">${DEMO_COMING.map(([d, w, x, m]) => `<div style="grid-template-columns: 64px minmax(0, 1fr) auto; font-size: 13px;"><span class="mono steel">${d}</span><span><span style="font-weight: 600;">${w}</span>${x ? `<span class="steel"> · ${x}</span>` : ''}</span><span class="dline">${m}</span></div>`).join('')}</div></section>`
    : P('Coming up · next 10 weeks', stateTag('computed', 'From every note'), `<p class="dline" style="margin: 0;">Catalysts from every note. Each date is also when its note comes due for review.</p><div class="drows">${[['Oct 14', 'CBRS · Lock-up tranche', 'today'], ['Oct 15', 'TSM · 3Q26 results and 4Q26 guide', 'tomorrow'], ['Oct 20', 'NVDA · GTC Berlin', 'in 6 days'], ['Oct 21', 'META · Q3 2026 results', 'in 7 days'], ['Oct 21', 'TSLA · Q3 2026 results', 'in 7 days'], ['Oct 24', 'SPCX · Lock-up tranche', 'in 10 days']].map(([d, w, m]) => `<div style="grid-template-columns: 64px minmax(0, 1fr) auto; font-size: 13px;"><span class="mono steel">${d}</span><span style="font-weight: 600;">${w}</span><span class="dline">${m}</span></div>`).join('')}</div>`);
  const cards = demo ? DEMO_NOTES.map(demoCard).join('') : NOTES.map(noteCard).join('');
  const main = `<div class="wrap rs">
    ${head('Research', demo ? 'Research notes on the tickers Convexa follows. Each opens with its thesis, the evidence and what would change it.' : 'Notes on the 14 tickers being followed. Each names its sources, says when it comes due and why, and leaves the stance to you. Each opens with a 30-second summary.', demo ? '' : provChip('Research notes · built Oct 14, 2026', 'solid'))}
    ${filters}${coming}
    <section aria-label="Notes" class="fr-cards">${cards}</section>
    ${foot(demo ? 'Sample notes written for the demo; no news, filings or AI read is cited. Not investment advice.' : 'Personal research notes. Prices in the notes are each note’s own, from its price date. Not investment advice.')}
  </div>`;
  return page({ scheme, minHeight, active: 'research', tabs: 'Notes', demo, label: 'Research', main });
}

// =================================================================================================
// 2 · Markets (/research/markets)
// =================================================================================================
// Staging's Rates today strip has no source line, so its head says Sample and the strip gains the 8px hatch
// stripe beside its dashed border (2026-10-22, owner D1, spec 01 step 5; the alerts Panel's ::before band).
const STRIP_HATCH = '<style>.fr-strip.fd-hatch { position: relative; } .fr-strip.fd-hatch::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 8px; border-radius: 11px 11px 0 0; pointer-events: none; z-index: 1; background: repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in srgb, var(--steel) 28%, transparent) 6px 12px); }</style>';
// The page as shipped since the MARKETS_SPEC fix round (2026-10-15, D-18; fidelity R-13, 2026-10-25): an On this
// page rail, then four sections. Rates: the strip, curve 7fr beside decomposition 5fr, then 2s10s and note-rate
// drift each on a full-width row (owner NO-5 B: drift's height follows the note count, so no pairing balances).
// Positioning: the three contracts' ranges, then the four trader groups. Liquidity and Coming up are the
// Planned boards' sections (planned.mjs), drawn here in place.
const MK_JUMP = (on = '') => `<nav class="pl-jump" aria-label="On this page"><span class="lbl">On this page</span>${[['rates', 'Rates'], ['positioning', 'Positioning'], ['liquidity', 'Liquidity'], ['coming-up', 'Coming up']].map(([id, n]) => `<a href="#${id}"${id === on ? ' aria-current="true"' : ''}>${n}</a>`).join('')}</nav>`;
export function marketsBody({ demo = false, scheme = 'dark', minHeight = 0, phone = false } = {}) {
  const e = env(demo, { frameTag: false }); const l = DATES(demo); const pe = plEnv(demo ? 'demo' : 'prod');
  const cells = ratesToday();
  const rates = section({ id: 'rates', title: 'Rates', body: `
    <section aria-label="Rates today" style="display: flex; flex-direction: column; gap: 10px;"><div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;"><h2 class="caps" style="margin: 0; color: var(--phosphor);">Rates today · ${l.nowL}</h2>${demo ? stateTag('sample') : stateTag('current', 'Updated · rates Oct 13')}</div>${demo ? STRIP_HATCH : ''}<div class="fr-strip${demo ? ' demo fd-hatch' : ''}">${cells.map(([lb, v, s, st]) => `<div><span class="caps" style="display: flex; gap: 6px; align-items: center;">${lb}${st === 'computed' ? icon('sigma', 11) : ''}</span><span class="v">${v}</span><span class="dline" style="font-size: 12px;">${s}</span></div>`).join('')}</div></section>
    <div class="fr-2">${curveChart(e)}${decompChart(e)}</div>
    ${spreadChart(e)}
    ${driftChart(e)}` });
  const positioning = section({ id: 'positioning', title: 'Positioning', body: `${cftcChart(e)}${cftcMultiples(e, { cols: 4 })}` });
  const main = `<div class="wrap rs">
    ${head('Markets', demo ? 'Rates, positioning and the money behind them, shaped like the public sources Convexa reads each business day. The 10-year on this page is the risk-free rate every note’s valuation starts from.' : 'Rates and futures positioning from public sources, refreshed each business day. The 10-year on this page is the risk-free rate every note’s valuation starts from.', `${chip(e, 'U.S. Treasury · par and real curves · through Oct 13', 'U.S. Treasury daily par and real yield curves')}${chip(e, 'CFTC · Traders in Financial Futures · as of Oct 6', 'CFTC Traders in Financial Futures')}`)}
    ${demo ? '' : legendBar([['current', 'Updated', 2], ['computed', 'Computed', 3], ['delayed', 'Delayed by source', 2]])}
    ${MK_JUMP()}
    ${rates}
    ${positioning}
    ${phone ? '' : liqSection(pe)}
    ${phone ? '' : calSection(pe)}
    ${foot(demo ? 'Demo · sample data shaped like the Federal Reserve’s, the Treasury’s, the CFTC’s, the BLS’s and the BEA’s files; nothing on this page is a real observation. Research and tools, not investment advice.' : 'Federal Reserve, U.S. Treasury, CFTC, BLS, BEA and SEC data are public record; Convexa’s arithmetic is marked Computed. Research and tools, not investment advice.')}
  </div>`;
  // At 390 Liquidity and Coming up would take the board past the canvas's 8,000px frame; both are drawn at 390 on
  // the Research · Markets · Liquidity and Planned · Calendar phone boards, so this board stops after Positioning.
  return (phone ? boardNote(scheme, '<b>Phone board:</b> after Positioning the page continues with Liquidity and Coming up, drawn at 390 on the Research · Markets · Liquidity and Planned · Calendar rows.') : '') + page({ scheme, minHeight, active: 'research', tabs: 'Markets', demo, label: 'Markets', main });
}

// =================================================================================================
// 3 · Filings (/research/filings)
// =================================================================================================
// production (once SEC_USER_AGENT is set): 90 days, Forms 3/4/5/144 excluded; standing against each note (written Oct 13)
const FEED = [
  ['Oct 14', 'CBRS', '8-K 8.01', 'Lock-up early release notice', 'Other', 'new since the note', true],
  ['Oct 9', 'TSM', '6-K', 'September 2026 revenue report', 'Other', 'in note'],
  ['Oct 8', 'INTC', '8-K 1.01', 'Amended foundry supply agreement', 'Deals and financing', 'not cited'],
  ['Oct 6', 'MU', '10-K', 'Fiscal 2026 annual report', 'Quarterly and annual', 'in note'],
  ['Oct 2', 'TSLA', '8-K 8.01', 'Q3 2026 production and deliveries', 'Other', 'in note'],
  ['Sep 23', 'MU', '8-K 2.02', 'FQ4-26 results and FQ1-27 guidance', 'Results', 'in note'],
  ['Sep 11', 'CRWV', '8-K 2.03', 'Delayed-draw term loan', 'Deals and financing', 'in note'],
  ['Aug 27', 'NVDA', '10-Q', 'Quarter to Jul 26, 2026', 'Quarterly and annual', 'in note', 'sel'],
  ['Aug 27', 'NVDA', '8-K 2.02', 'Q2 FY2027 results', 'Results', 'in note'],
];
const FEED_DEMO = [
  ['Sep 24', 'MSFT', '8-K 5.07', 'Demo sample filing · shareholder vote', 'Other', 'in note'],
  ['Sep 24', 'NVDA', '8-K 5.07', 'Demo sample filing · shareholder vote', 'Other', 'in note'],
  ['Sep 24', 'TSLA', '8-K 5.07', 'Demo sample filing · shareholder vote', 'Other', 'not cited'],
  ['Aug 27', 'NVDA', '10-Q', 'Demo sample filing · quarter to Jul 26', 'Quarterly and annual', 'in note', 'sel'],
  ['Aug 27', 'NVDA', '8-K 2.02', 'Demo sample filing · results', 'Results', 'in note'],
  ['Aug 27', 'MSFT', '10-Q', 'Demo sample filing · quarter to Jun 30', 'Quarterly and annual', 'in note'],
  ['Aug 27', 'MSFT', '8-K 2.02', 'Demo sample filing · results', 'Results', 'in note'],
  ['Aug 27', 'TSLA', '10-Q', 'Demo sample filing · quarter to Jun 30', 'Quarterly and annual', 'in note'],
  ['Aug 27', 'TSLA', '8-K 2.02', 'Demo sample filing · results', 'Results', 'in note'],
];
const EXPECTED = [['Oct 15', 'TSM', '6-K', '3Q26 results and 4Q26 guide'], ['Oct 21', 'META', '8-K 2.02', 'Q3 2026 results'], ['Oct 21', 'TSLA', '8-K 2.02', 'Q3 2026 results'], ['Oct 27', 'HOOD', '8-K 2.02', 'Q3 2026 results'], ['Oct 28', 'GOOGL', '8-K 2.02', 'Q3 2026 results'], ['Oct 28', 'MSFT', '8-K 2.02', 'FQ1-27 results']];
const expectedSection = (demo) => `<section aria-label="Expected" style="display: flex; flex-direction: column; gap: 10px;"><div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;"><h2 class="caps" style="margin: 0; color: var(--phosphor);">Expected · next six weeks</h2>${demo ? stateTag('empty', 'Nothing yet') : stateTag('computed', 'From the notes')}</div>${demo ? '<p class="dline" style="margin: 0;">The demo’s sample notes carry no dated results, so nothing is expected in this scenario.</p>' : `<div class="fr-exp">${EXPECTED.map(([d, t, f, w]) => `<div class="hd-p"><span class="mono" style="font-size: 13px;">${d} · ${t} <span class="fr-form">${f}</span></span><span style="font-size: 13px;">${w}</span><span class="dline" style="font-size: 11px;">makes the ${t} note due when filed</span></div>`).join('')}</div>`}</section>`;

function filingDetail(demo) {
  const e = env(demo, { frameTag: false });
  return `<section class="hd-p" aria-label="Filing detail" style="position: sticky; top: 80px;${demo ? ' border-style: dashed; border-color: var(--steel-2);' : ''}"><div class="ph"><h3>NVDA · 10-Q · quarter to Jul 26, 2026</h3>${demo ? stateTag('sample') : stateTag('current', 'Filed Aug 27')}</div>
    <p class="dline" style="margin: 0; font-size: 13px;"><strong style="color: var(--phosphor);">The NVDA note already cites this filing.</strong> Its figures below come from the SEC’s machine-readable company facts, beside the prior year’s period.</p>
    <div class="hd-fig" style="grid-template-columns: repeat(3, minmax(0, 1fr));"><div><span class="caps">Form</span><span class="v" style="font-size: 15px;">10-Q</span></div><div><span class="caps">Period</span><span class="v" style="font-size: 15px;">Jul 26</span></div><div><span class="caps">Accession</span><span class="v" style="font-size: 12px;">${demo ? 'sample' : '0001045810-26-000184'}</span></div></div>
    ${figuresChart(e)}
    <div style="display: flex; gap: 10px; flex-wrap: wrap;"><a href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&amp;CIK=0001045810" class="btn primary">Open the filing ${icon('external', 14)}</a></div></section>`;
}
function feedSection(rows, demo) {
  const e = env(demo, { frameTag: false });
  return `<section class="hd-p" aria-label="Filed, last 90 days" style="padding: 0; gap: 0;${demo ? ' border-style: dashed; border-color: var(--steel-2);' : ''}"><div class="ph" style="padding: 16px 16px 10px;"><h3>Filed · last 90 days · newest first</h3>${demo ? stateTag('sample') : stateTag('current', 'Updated · checked 14:00 UTC')}</div><div class="fr-feed" role="list">${rows.map(([d, t, f, w, k, s, sel]) => `<div role="listitem"${sel ? ' aria-current="true"' : ''}><span class="mono steel">${d}</span><span class="mono" style="font-weight: 600;">${t}</span><span class="fr-form">${f}</span><span style="min-width: 0;">${w} <span class="steel" style="font-size: 12px;">· ${k}</span></span><span class="fr-std${s === 'new since the note' ? ' new' : ''}">${s === 'new since the note' ? icon('info', 12) + ' ' : ''}${s}</span></div>`).join('')}</div>
    <p class="dline" style="margin: 0; padding: 12px 16px; border-top: 1px solid var(--line); font-size: 12px;">${demo ? 'SPY and QQQ are funds, not company filers, so EDGAR lists no company reports for them. AAPL has no sample filings in this scenario.' : 'All 14 followed companies resolve in EDGAR’s ticker map. Ownership forms (3, 4, 5, 144) are left out.'}</p>${demo ? '' : `<div style="padding: 0 16px 14px;">${chip(e, 'SEC EDGAR · submissions, checked Oct 14, 14:00 UTC', 'SEC EDGAR')}</div>`}</section>`;
}
export function filingsBody({ demo = false, scheme = 'dark', minHeight = 0, setUp = true } = {}) {
  const e = env(demo);
  const lead = 'What the 14 followed companies filed with the SEC, newest first. A results or quarterly filing the note hasn’t read makes it due.';
  let body;
  if (!demo && !setUp) {
    body = `${legendBar([['notConfigured', 'Not set up', 1], ['computed', 'Computed', 1]])}
    <section class="hd-p fr-nc" aria-labelledby="nc-h" style="gap: 14px; max-width: 920px;"><div class="ph"><h3 id="nc-h" style="font-size: 18px;">SEC filings aren’t set up on this site yet.</h3>${stateTag('notConfigured')}</div>
      <p style="margin: 0; font-size: 14px; line-height: 1.55;">Filings come from SEC EDGAR, which asks every program that reads it to identify itself with a contact address. This site hasn’t been given one, so nothing is fetched and no filing is shown. Nothing here is a fault: the notes keep their own dates, so nothing comes due late.</p>
      <dl class="fr-dl"><dt>Would show</dt><dd>What the 14 followed companies filed in the last 90 days, newest first; which filings a note hasn’t read yet; reported figures from each quarterly and annual report</dd><dt>Covers</dt><dd><span class="fr-tick">${NOTES.map((n) => `<span>${n[0]}</span>`).join('')}</span></dd><dt>Meanwhile</dt><dd>Each note links the filings it cites, and Expected below still works from the notes’ own dates</dd></dl>
      <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: center;">${DEMO_LINK('/research/filings', 'See sample filings on the demo →')}<a href="https://www.sec.gov/edgar/search/" class="t-info" style="display: inline-flex; gap: 6px; align-items: center; min-height: 24px;">Search EDGAR yourself ${icon('external', 13)}</a></div>
      <details><summary>For the site’s operator</summary><p class="dline" style="margin: 8px 0 0; font-size: 13px;">Set <span class="mono">SEC_USER_AGENT</span> on the API to a name and a contact email address (EDGAR’s fair-access rule), then restart it. Filings appear within the hour; company facts within a day.</p></details>
    </section>
    ${expectedSection(false)}`;
  } else {
    const rows = demo ? FEED_DEMO : FEED;
    const counts = demo ? [['All', 9], ['Results', 3], ['Quarterly and annual', 3], ['Other', 3]] : [['All', 9], ['Results', 2], ['Quarterly and annual', 2], ['Deals and financing', 2], ['Other', 3]];
    body = `${expectedSection(demo)}
    <nav aria-label="Filing kinds" class="rs-chipbar">${counts.map(([k, n], i) => `<a href="?kind=${k.toLowerCase().split(' ')[0]}"${i === 0 ? ' aria-current="true"' : ''}>${k} · ${n}</a>`).join('')}</nav>
    <div class="fr-2" style="align-items: start;">${feedSection(rows, demo)}${filingDetail(demo)}</div>`;
  }
  const chips = demo ? provChip('Demo · shaped like SEC EDGAR · Oct 7', 'dashed') : setUp ? `${provChip('SEC EDGAR · checked Oct 14, 14:00 UTC', 'solid', 'https://www.sec.gov/edgar/search/')}<span class="steel only-wide" style="font-size: 12px; display: inline-flex; gap: 6px; align-items: center;"><span class="kbd">j</span><span class="kbd">k</span> move <span class="kbd">o</span> open the filing</span>` : provChip('SEC EDGAR · not set up on this site', 'solid');
  const main = `<div class="wrap rs">${head('Filings', demo ? 'How Convexa lists each followed company’s SEC filings, newest first. A results or quarterly filing the note hasn’t read makes it due.' : lead, chips)}${body}
    ${foot(demo ? 'Sample filings shaped like SEC EDGAR; each links to the SEC’s browse page. Not investment advice.' : 'Filings from SEC EDGAR, the public record. Research and tools, not investment advice.')}</div>`;
  return page({ scheme, minHeight, active: 'research', tabs: 'Filings', demo, label: 'Filings', main });
}

// =================================================================================================
// 4 · Scorecard (/research/scorecard)
// =================================================================================================
const SOON = [
  ['Oct 15', 'TSM', '3Q26 gross margin is at least 66.0%, the guidance midpoint.'],
  ['Oct 15', 'TSM', 'TSMC guides 4Q26 revenue with a midpoint of at least $50.0B.'],
  ['Oct 21', 'META', 'Q3 2026 revenue is at least $62.5B, the guide midpoint.'],
  ['Oct 21', 'META', 'The Q3 release keeps the 2026 capex range’s low end at $130B or higher.'],
  ['Oct 21', 'TSLA', 'Q3 2026 automotive gross margin ex credits is at least 16.3%, Q2’s level.'],
  ['Oct 21', 'TSLA', 'Q3 2026 regulatory credit revenue is below $200M.'],
  ['Oct 21', 'TSLA', 'Q3 2026 revenue is at least $27.89B, the MarketBeat consensus.'],
  ['Oct 27', 'HOOD', 'Q3 2026 net deposits are at least $15B.'],
  ['Oct 27', 'HOOD', 'Q3 2026 total net revenues are at least $1.42B, the consensus.'],
  ['Oct 27', 'HOOD', 'Q3 2026 event-contract revenue is above Q2’s $156M.'],
  ['Oct 27', 'HOOD', 'Robinhood Gold has at least 5.2M subscribers at the end of Q3 2026.'],
  ['Oct 28', 'GOOGL', 'Q3 2026 Google Cloud revenue is at least $28.0B.'],
  ['Oct 28', 'GOOGL', 'Alphabet raises its 2026 capex guidance to a midpoint above $200B.'],
  ['Oct 28', 'MSFT', 'FQ1-27 revenue is at least $89.85B, the low end of guidance.'],
  ['Oct 28', 'MSFT', 'FQ1-27 Azure growth is 45% or more in constant currency.'],
  ['Oct 28', 'MSFT', 'FQ1-27 capex including finance leases is above $50B.'],
];
const SOON_DEMO = [
  ['Oct 8', 'NVDA', 'The authored daily range stays above $4.00 for the next three sample sessions.', '64%'],
  ['Oct 9', 'TSLA', 'A later authored close sits outside the current 10-session range.', '35%'],
  ['Oct 13', 'MSFT', 'The authored close holds above its 20-session average through Oct 13.', '72%'],
  ['Oct 14', 'AAPL', 'The next authored close lands inside the latest high–low range.', '80%'],
];
const PAST_DUE_DEMO = [['Oct 2', 'QQQ', 'The authored path keeps its higher-close sequence through Oct 2.'], ['Oct 5', 'SPY', 'Closes keep alternating around the gradual rise through Oct 5.'], ['Oct 6', 'TSLA', 'The oscillating path makes a new 10-session low by Oct 6.']];

function signalsOff() {
  return chartFrame({
    claim: 'Signal track record', sub: 'Hit rate and average move after costs, by scanner setup', state: 'notLive', stateText: 'Not live · price source',
    body: `<div style="display: flex; flex-direction: column; gap: 12px; min-height: 236px;"><p style="margin: 0; font-size: 14px; line-height: 1.55; text-wrap: pretty;">Grading the scanner’s setups means pricing what happened after each one, net of trading costs. That needs a price history licensed for public display, and the free feeds are for personal use only.</p><dl class="fr-dl"><dt>Would show</dt><dd>Hit rate and average move after costs, by setup</dd><dt>Would need</dt><dd>Daily closes for every scanned symbol, with display rights</dd><dt>Meanwhile</dt><dd>It runs on the demo’s sample prices</dd></dl>${DEMO_LINK('/research/scorecard')}</div>`,
  });
}
function calibEmpty() {
  return frameState('empty', { metric: 'Calibration', sub: 'How often calls made at each stated probability came true, in tenths, with a 95% interval per bin', stateText: 'Nothing yet', height: 236, text: 'Calibration draws itself once 20 forecasts that carried your probability have resolved. 0 of 20 so far.', cause: 'Every open forecast still has a blank probability. Set one in the note’s forecasts block before its date: a probability added after the answer is known is not scored.' });
}
export function scorecardBody({ demo = false, scheme = 'dark', minHeight = 0 } = {}) {
  const e = env(demo);
  const ledger = demo
    ? [['Open forecasts', '34', 'across the 6 sample notes'], ['With your probability', '31', 'of 34'], ['Resolved', '264', 'scored in the sample history'], ['Brier score', '0.198', 'saying 50% to everything scores 0.250']]
    : [['Open forecasts', '77', 'across 14 notes'], ['With your probability', '0', 'the notes leave it blank for you'], ['Resolved', '0', 'first on Oct 15'], ['Brier score', 'not set', 'needs resolved calls that carried a probability']];
  const strip = `<section aria-label="Ledger" class="fr-strip${demo ? ' demo' : ''}">${ledger.map(([lb, v, s]) => `<div><span class="caps">${lb}</span>${v === 'not set' ? '<span class="dnan" style="padding: 4px 0;">not set</span>' : `<span class="v">${v}</span>`}<span class="dline" style="font-size: 12px;">${s}</span></div>`).join('')}</section>`;
  const soonRows = (demo ? SOON_DEMO : SOON).map(([d, t, c, p]) => `<div><span class="mono steel">${d}</span><span class="mono" style="font-weight: 600;">${t}</span><span style="min-width: 0;">${c}</span>${p ? `<span class="fr-p" style="border-style: solid; color: var(--phosphor);">P ${p}</span>` : `<button class="btn ghost sm" type="button" aria-label="Copy the row for: ${c.replace(/’/g, '')}">${icon('copy', 14)}Copy row</button>`}</div>`).join('');
  const soon = P(demo ? 'Four forecasts resolve in the next two weeks; all carry a probability.' : 'Sixteen forecasts resolve in the next two weeks, all still without a probability.', demo ? stateTag('demo') : stateTag('computed', 'From the notes'), `<p class="dline" style="margin: 0;">${demo ? 'Sample forecasts on the demo’s authored price paths.' : 'Copy a row, paste it over the same row in the note’s forecasts block, replace ___ with your probability, and push. The check refuses the row until you do.'}</p><div class="fr-soon">${soonRows}</div>`, { demo, label: 'Next two weeks' });
  const pastDue = demo ? P('3 past their dates and waiting for an outcome.', stateTag('demo'), `<p class="dline" style="margin: 0;">Add yes, no or void as the fifth cell of each row, set updated: in the front matter, and log it in the change log.</p><div class="fr-soon">${PAST_DUE_DEMO.map(([d, t, c]) => `<div><span class="mono steel">${d}</span><span class="mono" style="font-weight: 600;">${t}</span><span style="min-width: 0;">${c}</span><button class="btn ghost sm" type="button" aria-label="Copy the row for: ${c}">${icon('copy', 14)}Copy row</button></div>`).join('')}</div>`, { demo: true, label: 'Past due' }) : '';
  const main = `<div class="wrap rs">
    ${head('Scorecard', 'How the calls in the notes turn out. A forecast is scored when its date passes, but only if it carried your probability before then: scoring a call after the answer is known would be fiction.', demo ? provChip('Demo · the sample notes’ forecasts · scenario of Oct 7', 'dashed') : provChip('The notes’ forecasts blocks · built Oct 14, 2026', 'solid'))}
    ${demo ? '' : legendBar([['computed', 'Computed', 3], ['empty', 'Nothing yet', 1], ['notLive', 'Not live', 1]])}
    ${strip}${pastDue}
    <div class="fr-2">${soon}${byMonthChart(e)}</div>
    <div class="fr-2 half">${demo ? calibChart(e) : calibEmpty()}${demo ? signalsChart(e) : signalsOff()}</div>
    ${foot(demo ? 'Sample forecasts and outcomes authored for the demo. Not investment advice.' : 'Forecasts come from each note’s forecasts block. Personal research notes. Not investment advice.')}
  </div>`;
  return page({ scheme, minHeight, active: 'research', tabs: 'Scorecard', demo, label: 'Scorecard', main });
}

// =================================================================================================
// States boards
// =================================================================================================
const msgFrame = (metric, state, text, cause, action = '', stateText = '') => frameState(state, { metric, height: 150, text, cause, action, stateText });
const retry = '<button class="btn secondary sm" type="button">Try again</button>';

function indexStates({ scheme = 'dark', minHeight = 0 } = {}) {
  const hood = NOTES.find((n) => n[0] === 'HOOD'), nvda = NOTES.find((n) => n[0] === 'NVDA');
  const items = [
    { name: 'Freshness · three words, three shapes', tag: ['computed', 'Worked out in your browser'], when: 'From each note’s dates and the filings feed: due once a catalyst, kill or forecast date passes, the price turns 30 days old, or a results or periodic filing lands that the note doesn’t cite.', html: `${fresh('full', 'Current · review by Oct 21')}${fresh('half', 'Review due · since Oct 14')}${fresh('sq', 'Archived · not following since Aug 2')}<span class="dline">Word and shape carry it; no colour.</span>` },
    { name: 'Mini chart · losses hang below zero', tag: ['current', 'From the note'], when: 'One scale that includes zero; a zero line whenever a value is negative. Guide or consensus bars are dashed outlines; the latest reported bar is phosphor.', html: `<div class="fr-mini"><div class="cap"><span>HOOD · ${hood[7]}</span><b>${hood[10]}</b></div>${miniBars(hood[8], { guide: hood[9] })}</div><div class="fr-mini"><div class="cap"><span>NVDA · ${nvda[7]} · dashed = guide</span><b>${nvda[10]}</b></div>${miniBars(nvda[8], { guide: nvda[9] })}</div>` },
    { name: 'No ticker matches', tag: ['empty'], when: 'The search or the filters leave no card.', html: `<strong>No ticker matches these filters.</strong><span class="dline">Search matches ticker and company name. Clear the filters to see all 14.</span><button class="btn secondary sm" type="button" style="align-self: flex-start;">Clear filters</button>` },
    { name: 'No notes yet', tag: ['empty'], when: 'A build with an empty research/ folder.', html: `<strong>No research published yet.</strong><span class="dline">Notes will be listed here as they’re written.</span>` },
    { name: 'Filings check unavailable', tag: ['notConfigured'], when: 'Production while SEC_USER_AGENT is unset (or public data is off): freshness falls back to the notes’ own dates.', html: `<span class="dline" style="font-size: 13px;">Freshness here comes from each note’s dates. Filings aren’t checked on this site yet, so a new 10-Q won’t mark a note due until its own date passes.</span>` },
    { name: 'Coming up · nothing in 10 weeks', tag: ['empty'], when: 'No catalyst in any note within 70 days (the demo’s sample notes carry none).', html: `<strong>Nothing comes due in the next 10 weeks.</strong><span class="dline">Catalysts from every note appear here with their dates.</span>` },
    { name: 'Demo · sample notes', tag: ['demo'], when: 'Staging: the six authored sample notes, dashed with the hatch stripe; tab badges count them (Notes 6).', html: demoCard(DEMO_NOTES[2]) },
    { name: 'Stance and uncertainty', tag: ['local', 'Your call'], when: 'No note sets a stance, so every card says “Stance · your call” (dashed: not a figure).', html: `<div style="display: flex; gap: 8px; flex-wrap: wrap;"><span class="prov dashed">Stance · your call</span><span class="dline">Uncertainty · very high</span></div>` },
  ];
  return statesBoard({ scheme, minHeight, title: 'Research · Notes · states', lead: 'The index is built from research/ at deploy time, so it has no loading or network-error state of its own. What changes is each note’s freshness, the filters, and whether the filings check is available.', items });
}
function marketsStates({ scheme = 'dark', minHeight = 0 } = {}) {
  const e = env(false);
  const items = [
    { name: 'Loading · final size', tag: ['loading'], when: 'First paint while /api/public-data/markets answers. Every panel holds its final height (CLS 0).', html: frameState('loading', { metric: 'Treasury par yield curve', height: 150 }) },
    { name: 'Couldn’t load', tag: ['error'], when: 'Convexa’s own API didn’t answer. Cause and Try again; the notes and the Scorecard don’t depend on it.', html: msgFrame('Rates and positioning', 'error', 'Rates and positioning didn’t load.', 'Convexa’s server didn’t answer at 14:10 UTC, so there is nothing to show yet.', retry) },
    { name: 'Last good copy', tag: ['stale'], when: 'A source failed this cycle; the earlier copy shows dimmed with when it was fetched.', html: `<div class="dwarn" role="status">${icon('warn', 14)}<span class="dline">U.S. Treasury did not answer at 14:10 UTC; showing data fetched at 08:10 UTC.</span></div>${stateTag('stale', 'Last good copy · rates Oct 9')}` },
    { name: 'Source down · rates', tag: ['unavailable', 'Source down · rates'], when: 'The Treasury didn’t answer and nothing is cached. Positioning still shows.', html: msgFrame('Treasury par yield curve', 'unavailable', 'Rates are unavailable right now.', 'The Treasury’s rate files didn’t answer and there is no earlier copy to show. Convexa asks again in 10 minutes.') },
    { name: 'Source down · positioning', tag: ['unavailable', 'Source down · positioning'], when: 'The CFTC didn’t answer and nothing is cached. Rates still show.', html: msgFrame('Futures positioning', 'unavailable', 'Futures positioning is unavailable right now.', 'The CFTC didn’t answer and there is no earlier copy to show. Convexa asks again in 10 minutes.') },
    { name: 'Off', tag: ['off'], when: 'PUBLIC_DATA=off on this server. No retry.', html: msgFrame('Rates and positioning', 'off', 'Public data is switched off on this server.', 'Rates and positioning come from the U.S. Treasury and the CFTC through Convexa’s API, which has them turned off.') },
    { name: 'Delayed by source', tag: ['delayed', 'Delayed by source · positioning as of Oct 6'], when: 'Always, for CFTC: positions as of Tuesday, published Friday.', html: `<span class="dline">Reported as of Tuesday and published Friday, so this view is three days old when it updates.</span>` },
    { name: 'A year-ago point is missing', tag: ['empty', 'Nothing yet'], when: 'The decomposition needs both years: without one, its frame stays and says what’s missing instead of vanishing.', html: msgFrame('What moved the 10-year', 'empty', 'Not enough history to split the move.', 'The real-yield curve has no value for Oct 13, 2025, so the year’s change can’t be split into real yield and breakeven.', '', 'Nothing yet') },
    { name: 'Demo', tag: ['demo'], when: 'Staging: every frame dashed with the hatch stripe; its “Demo · shaped like …” chip is its one Sample mark, since the demo bar is the page’s one “Demo · sample data” (owner D1). No live tags, no stale line.', html: decompChart(env(true, { frameTag: false })) },
  ];
  void e;
  return statesBoard({ scheme, minHeight, title: 'Research · Markets · states', lead: 'Two sources, each with its own failure: a failure of one never blanks the other. Words from the P-2 vocabulary; every non-ready chart frame names its metric (P-10).', items });
}
function filingsStates({ scheme = 'dark', minHeight = 0 } = {}) {
  const items = [
    { name: 'Loading · final size', tag: ['loading'], when: 'First paint while /api/public-data/filings answers.', html: frameState('loading', { metric: 'Filings, last 90 days', height: 150 }) },
    { name: 'Not set up', tag: ['notConfigured'], when: 'Any server where SEC_USER_AGENT is unset (API state not_configured): reader copy, Expected from the notes, no feed. Production is set up.', html: `<strong>SEC filings aren’t set up on this site yet.</strong><span class="dline">EDGAR asks every program that reads it to identify itself with a contact address. This site hasn’t been given one.</span><span class="fr-nc"><details><summary>For the site’s operator</summary></details></span>` },
    { name: 'Couldn’t load', tag: ['error'], when: 'Convexa’s API didn’t answer.', html: msgFrame('Filings, last 90 days', 'error', 'Filings didn’t load.', 'Convexa’s server didn’t answer. The notes keep their own dates, so nothing comes due late because of it.', retry) },
    { name: 'Off', tag: ['off'], when: 'PUBLIC_DATA=off on this server.', html: msgFrame('Filings, last 90 days', 'off', 'Public data is switched off on this server.', 'Filings come from SEC EDGAR through Convexa’s API, which has them turned off.') },
    { name: 'Last good copy', tag: ['stale'], when: 'EDGAR failed this cycle; the earlier copy stays, dimmed, with its time.', html: `<div class="dwarn" role="status">${icon('warn', 14)}<span class="dline">SEC EDGAR did not answer at 14:00 UTC; showing data fetched at 13:00 UTC.</span></div>` },
    { name: 'Nothing filed', tag: ['empty'], when: 'No filing in 90 days for the followed companies, or none of the chosen kind.', html: `<strong>Nothing filed in the last 90 days.</strong><span class="dline">When a followed company files with the SEC it appears here within the hour.</span>` },
    { name: 'Not an SEC filer', tag: ['empty', 'Not listed'], when: 'A followed ticker EDGAR’s ticker map doesn’t know (the API’s missing list): named, not silently dropped.', html: `<span class="dline" style="font-size: 13px;">SPY and QQQ are funds, not company filers, so EDGAR lists no company reports for them.</span>` },
    { name: 'Figures not yet', tag: ['empty', 'Not yet'], when: 'A results release (8-K 2.02): its tables are in the exhibit.', html: `<span class="dline" style="font-size: 13px;">A results release. Its tables are in the exhibit; the same figures arrive in machine-readable form with the next quarterly or annual report.</span>` },
    { name: 'Figures couldn’t load', tag: ['error'], when: 'The company-facts request failed: an error, never shown as “not yet”.', html: msgFrame('Reported figures', 'error', 'Couldn’t load the reported figures.', 'The SEC’s company-facts request failed at 10:12 UTC (HTTP 503). The filing itself is linked above.', retry) },
    { name: 'New since the note', tag: ['current', 'Filed Oct 14'], when: 'A filing after the note’s date that the note doesn’t cite; results and periodic ones make the note due.', html: `<span class="fr-std new">${icon('info', 12)} new since the note</span><span class="dline">Filed after the CBRS note was written. A lock-up notice doesn’t make the note due; a 10-Q or results 8-K would.</span>` },
    { name: 'Demo', tag: ['demo'], when: 'Staging: sample filings for MSFT, NVDA and TSLA, dashed, each linked to the SEC’s browse page. The Filed feed and Detail say Sample once, in their heads (owner D1).', html: provChip('Demo · shaped like SEC EDGAR · Oct 7', 'dashed') },
  ];
  return statesBoard({ scheme, minHeight, title: 'Research · Filings · states', lead: 'EDGAR is reachable without a key, but only with an identifying User-Agent. Until the operator sets one the page says so in reader’s words, and keeps the part that doesn’t need EDGAR (Expected, from the notes).', items });
}
function scorecardStates({ scheme = 'dark', minHeight = 0 } = {}) {
  const items = [
    { name: 'Calibration · nothing yet', tag: ['empty'], when: 'Fewer than 20 resolved forecasts that carried a probability (production today: 0 of 20).', html: calibEmpty() },
    { name: 'Signal track record · not live', tag: ['notLive', 'Not live · price source'], when: 'Production: no daily price history licensed for public display.', html: signalsOff() },
    { name: 'Brier · not set', tag: ['empty', 'not set'], when: 'No resolved call carried a probability.', html: `<span class="dnan" style="padding: 4px 0;">not set</span><span class="dline">needs resolved calls that carried a probability</span>` },
    { name: 'Nothing in the next two weeks', tag: ['empty'], when: 'No forecast date falls in the next 14 days.', html: `<strong>Nothing resolves in the next two weeks.</strong>` },
    { name: 'Past due', tag: ['computed', 'From the notes'], when: 'A forecast’s date passed without an outcome. Appears above the lists, only when there are any.', html: `<strong>2 past their dates and waiting for an outcome.</strong><span class="dline">Add yes, no or void as the fifth cell of each row, set updated: in the front matter, and log it in the change log.</span>` },
    { name: 'Calibration · ready', tag: ['computed'], when: 'Once 20 scored forecasts exist: hit rate per tenth with its Wilson interval and n; the 90%+ bin says it holds too few to judge.', html: `<span class="dline">Drawn on the staging board: dot = hit rate, bar = 95% interval, n above each, dashed diagonal = perfectly calibrated.</span>` },
    { name: 'Demo', tag: ['demo'], when: 'Staging: the sample notes’ forecasts with an authored scored history, so calibration and the signal track record draw.', html: `<span class="dline">Sample forecasts and outcomes authored for the demo.</span>` },
  ];
  return statesBoard({ scheme, minHeight, title: 'Research · Scorecard · states', lead: 'No API: the page reads every note’s forecasts block at build time. It has no loading or network-error state; its states are about how much has resolved.', items });
}

const B = (id, title, w, h, body, opts) => ({ id, title, w, h, body, ...(opts ? { opts } : {}) });
export const ROWS = [
  { key: 'research-index', label: 'Research · Notes', css: FR_CSS, specH: 2083, spec: INDEX_SPEC, boards: [
    B('staging', 'Staging · demo account', 1440, 1379, (o) => indexBody({ ...o, demo: true })),
    B('production', 'Production', 1440, 2597, (o) => indexBody(o)),
    B('phone', 'Phone · production', 390, 6417, (o) => indexBody(o)),
    B('light', 'Light · production', 1440, 2597, (o) => indexBody(o), { scheme: 'light' }),
    B('states', 'States', 1440, 1407, (o) => indexStates(o)),
  ] },
  { key: 'research-markets', label: 'Research · Markets', css: FR_CSS + PL_CSS, specH: 2210, spec: MARKETS_SPEC, boards: [
    B('staging', 'Staging · demo account', 1440, 2657, (o) => marketsBody({ ...o, demo: true })),
    B('production', 'Production', 1440, 2843, (o) => marketsBody(o)),
    B('phone', 'Phone · production', 390, 5659, (o) => marketsBody({ ...o, phone: true })),
    B('light', 'Light · production', 1440, 2843, (o) => marketsBody(o), { scheme: 'light' }),
    B('states', 'States', 1440, 2146, (o) => marketsStates(o)),
  ] },
  { key: 'research-filings', label: 'Research · Filings', css: FR_CSS, specH: 2187, spec: FILINGS_SPEC, boards: [
    B('staging', 'Staging · demo account', 1440, 1325, (o) => filingsBody({ ...o, demo: true })),
    // Production is set up (SEC_USER_AGENT set on the API, owner 2026-10-15): the production boards
    // draw the live feed. Not set up stays as a state example on the states board (2026-10-16).
    B('production', 'Production', 1440, 1547, (o) => filingsBody(o)),
    B('phone', 'Phone · production', 390, 3200, (o) => filingsBody(o)),
    B('light', 'Light · production', 1440, 1547, (o) => filingsBody(o), { scheme: 'light' }),
    B('states', 'States', 1440, 1823, (o) => filingsStates(o)),
  ] },
  { key: 'research-scorecard', label: 'Research · Scorecard', css: FR_CSS, specH: 1964, spec: SCORECARD_SPEC, boards: [
    B('staging', 'Staging · demo account', 1440, 1955, (o) => scorecardBody({ ...o, demo: true })),
    B('production', 'Production', 1440, 2050, (o) => scorecardBody(o)),
    B('phone', 'Phone · production', 390, 4949, (o) => scorecardBody(o)),
    B('light', 'Light · production', 1440, 2050, (o) => scorecardBody(o), { scheme: 'light' }),
    B('states', 'States', 1440, 1265, (o) => scorecardStates(o)),
  ] },
];
void figuresTable;
