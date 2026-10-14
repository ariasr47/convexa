// v4 · Research pages built on public data: Markets, Filings, Scorecard, and a ticker's research tab.
// Ported from the v3 research boards (live canvas HxZArSCsbrjQCx8VBbYRw7, unchanged), re-sourced
// (Treasury, not FRED), re-stated in the v4 data-state vocabulary, and joined by the wave-2 tools.
import { fluidChart, icon, v4Page } from '../../lib.mjs';
import { dataCell, provChip, rangeBar, stateTag } from '../../components/data-states.mjs';
import { renderTool } from '../../components/tools.mjs';

export const RESEARCH_CSS = `
  .rs { padding-top: 32px; display: flex; flex-direction: column; gap: 28px; }
  .rs-h { display: flex; flex-direction: column; gap: 10px; }
  .rs-h h1 { margin: 0; font-size: clamp(32px, 3.4vw, 48px); letter-spacing: -0.02em; }
  .rs-h .lead { margin: 0; max-width: 64ch; font-size: 16px; color: var(--steel); line-height: 1.55; text-wrap: pretty; }
  .rs-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .rs-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(190px, 100%), 1fr)); gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
  .rs-strip > div { background: var(--panel); padding: 14px 18px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .rs-strip .v { font: 500 24px/1.2 'IBM Plex Mono', monospace; }
  .rs-2 { display: grid; grid-template-columns: minmax(0, 8fr) minmax(0, 4fr); gap: 16px; align-items: stretch; }
  .rs-2.half { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .rs-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  .rs-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr)); gap: 16px; }
  .rs-feed > div { display: grid; grid-template-columns: 64px 56px 64px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 11px 16px; border-top: 1px solid var(--line); font-size: 13px; }
  .rs-feed > div[aria-current="true"] { background: rgba(233,228,214,0.05); box-shadow: inset 2px 0 0 var(--phosphor); }
  .rs-chipbar { display: flex; flex-wrap: wrap; gap: 8px; }
  .rs-chipbar a { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line-2); color: var(--steel); text-decoration: none; font-size: 13px; }
  .rs-chipbar a[aria-current="true"] { color: var(--ink); background: var(--phosphor); border-color: var(--phosphor); font-weight: 600; }
  .rs-form { font: 600 11px 'IBM Plex Mono', monospace; padding: 2px 6px; border-radius: 5px; background: rgba(138,155,180,0.16); text-align: center; }
  .fut { display: grid; grid-template-columns: 140px 150px minmax(0, 1fr); gap: 8px 16px; align-items: center; }
  @container (max-width: 560px) { .fut { grid-template-columns: minmax(0, 1fr) auto; } .fut > :last-child { grid-column: 1 / -1; } }
  .rs-note-head h1 { margin: 0; max-width: 32ch; font-size: clamp(26px, 2.6vw, 34px); line-height: 1.15; }
  @media (max-width: 1099px) { .rs-3 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 899px) { .rs-2, .rs-2.half, .rs-3 { grid-template-columns: 1fr; } .rs-feed > div { grid-template-columns: 56px minmax(0, 1fr); } .rs-feed > div > :nth-child(2), .rs-feed > div > :nth-child(3) { display: none; } .rs-chipbar a { min-height: 44px; } }
`;

const P = (title, tag, inner, { label = '', sample = false, extra = '' } = {}) => `<section class="hd-p${sample ? ' is-sample' : ''}" aria-label="${label || title.replace(/<[^>]+>/g, '')}"${extra ? ` style="${extra}"` : ''}><div class="ph"><h3>${title}</h3>${tag}</div>${inner}</section>`;
const claim = (c, s) => `<div><p class="claim">${c}</p><p class="sub">${s}</p></div>`;
const src = (s) => `<p class="srcline">${s}</p>`;

// ---- Markets --------------------------------------------------------------------------------------
function curveChart() {
  const T = ['3M', '2Y', '5Y', '10Y', '30Y'], at = [0, 0.18, 0.36, 0.58, 1], now = [3.91, 3.62, 3.74, 4.18, 4.74], ago = [4.03, 3.60, 3.74, 4.07, 4.56];
  return fluidChart({
    height: 260, pl: 44, pr: 104, prn: 48, xmin: 0, xmax: 1, ymin: 3.4, ymax: 4.9,
    aria: 'Treasury par yields. Oct 9, 2026: 3-month 3.91, 2-year 3.62, 5-year 3.74, 10-year 4.18, 30-year 4.74. Oct 9, 2025: 4.03, 3.60, 3.74, 4.07, 4.56.',
    yTicks: [3.5, 4.0, 4.5].map((v) => ({ v, label: `${v.toFixed(1)}%` })),
    xTicks: T.map((t, i) => ({ v: at[i], label: t })),
    series: [
      { points: ago.map((v, i) => [at[i], v]), stroke: 'var(--steel)', width: 2, dash: '5 5', dots: true, hollow: true, end: { long: 'Oct 9, 2025', short: '2025' }, endColor: 'var(--steel)', endY: 4.48 },
      { points: now.map((v, i) => [at[i], v]), stroke: 'var(--phosphor)', width: 2.5, dots: true, end: { long: 'Oct 9, 2026', short: '2026' }, endY: 4.8 },
    ],
    pointLabels: now.map((v, i) => ({ x: at[i], y: v, text: v.toFixed(2), minor: i === 1 })),
  });
}
function decomposition() {
  const rows = [['10-year Treasury', 0.11], ['Real 10-year (TIPS)', 0.16], ['10-year breakeven', -0.05]];
  return `<div role="img" aria-label="Change over the year: 10-year up 0.11 points, real 10-year up 0.16, breakeven down 0.05" style="display: flex; flex-direction: column; gap: 14px;">${rows.map(([n, v]) => `<div style="display: flex; flex-direction: column; gap: 4px;"><div style="display: flex; justify-content: space-between; font-size: 12.5px;"><span>${n}</span><span class="mono">${v > 0 ? '▲ +' : '▼ −'}${Math.abs(v).toFixed(2)} pts</span></div><div style="position: relative; height: 10px; background: rgba(138,155,180,0.10); border-radius: 5px;"><span style="position: absolute; left: 50%; top: -3px; bottom: -3px; width: 1px; background: var(--line-2);"></span><span style="position: absolute; top: 0; bottom: 0; border-radius: 5px; background: var(--phosphor); ${v > 0 ? `left: 50%; width: ${v * 180}%;` : `right: 50%; width: ${-v * 180}%;`}"></span></div></div>`).join('')}</div>`;
}
function futures() {
  const rows = [
    ['10-year T-note · CBOT', [['Asset managers', '+812k', '+21k on week', 88], ['Leveraged funds', '−1,104k', '−36k on week', 9]]],
    ['E-mini S&amp;P 500 · CME', [['Asset managers', '+1,031k', '+8k on week', 81], ['Leveraged funds', '−402k', '+14k on week', 22]]],
    ['E-mini Nasdaq-100 · CME', [['Asset managers', '+96k', '−3k on week', 54], ['Leveraged funds', '−38k', '+2k on week', 47]]],
  ];
  return rows.map(([m, groups]) => `<div style="display: flex; flex-direction: column; gap: 10px; padding: 14px 0; border-top: 1px solid var(--line);"><span style="font-weight: 600; font-size: 13.5px;">${m}</span>${groups.map(([g, net, wk, pos]) => `<div class="fut"><span class="steel" style="font-size: 12.5px;">${g}</span><span class="mono" style="font-size: 13px;">${net} <span class="steel" style="font-size: 11px;">${wk}</span></span>${rangeBar(pos, { median: 50, aria: `${g} net position at ${pos}% of its 3-year range` })}</div>`).join('')}</div>`).join('');
}

export function marketsBody({ minHeight = 3600, scheme = 'dark', demo = false } = {}) {
  const cells = [['10-year Treasury', '4.18%', '▲ +0.11 pts on a year · was 4.07%', 'current'], ['Real 10-year (TIPS)', '1.89%', '▲ +0.16 pts on a year', 'current'], ['10-year breakeven', '2.29%', '10-year less real · ▼ −0.05 pts', 'computed'], ['2s10s spread', '+0.56', 'pts · year’s range 0.31–0.71', 'computed'], ['3-month bill', '3.91%', '▼ −0.12 pts on a year', 'current']];
  const kind = demo ? 'dashed' : 'solid';
  const main = `<div class="wrap rs">
    <div class="rs-h"><h1 class="display">Markets</h1><p class="lead">Rates, money, futures positioning and the release calendar, from public sources. The 10-year here is the risk-free rate every note’s valuation starts from.</p>
      <div class="rs-chips">${provChip(demo ? 'Demo · shaped like U.S. Treasury par and real curves · Oct 7' : 'U.S. Treasury · par and real curves · through Oct 9', kind)}${provChip(demo ? 'Demo · shaped like CFTC TFF · Oct 6' : 'CFTC TFF · as of Oct 6, out Oct 9', kind)}${provChip(demo ? 'Demo · shaped like Fed H.4.1 · TGA · RRP' : 'Fed H.4.1 · TGA · RRP · Oct 9', kind)}${provChip('Fed · BLS · BEA · Treasury schedules', kind)}</div></div>
    <section aria-label="Rates today" style="display: flex; flex-direction: column; gap: 10px;"><div style="display: flex; align-items: center; gap: 10px;"><span class="caps" style="color: var(--phosphor);">Rates today</span>${stateTag('current', 'Updated Oct 9')}</div><div class="rs-strip">${cells.map(([l, v, s, st]) => `<div><span class="caps" style="display: flex; gap: 6px; align-items: center;">${l}${st === 'computed' ? icon('sigma', 11) : ''}</span><span class="v">${v}</span><span class="dline" style="font-size: 12px;">${s}</span></div>`).join('')}</div></section>
    <div class="rs-2">${P('Treasury curve', stateTag('current', 'Updated Oct 9'), `${claim('The curve steepened in a year: the front fell, the 30-year rose.', 'Treasury par yields by maturity, %. Oct 9, 2026 against the same day a year earlier, dashed.')}${curveChart()}${src('Source: U.S. Treasury daily par yield curve. As of Oct 9, 2026 (Oct 12 was a bond-market holiday).')}`)}
      ${P('What moved the 10-year', stateTag('computed', 'Computed'), `${claim('Real yields did all of it; inflation expectations eased slightly.', 'Change over the year to Oct 9, percentage points. Breakeven = 10-year less real 10-year.')}${decomposition()}${src('Source: U.S. Treasury par and real yield curves. Arithmetic by Convexa.')}`)}</div>
    ${P('Liquidity', stateTag('current', 'Updated Oct 9'), renderTool('liquidity', {}), { label: 'Liquidity panel' })}
    <div class="rs-2 half">${P('Release calendar', stateTag('current', 'Scheduled'), renderTool('calendar', {}), { label: 'Macro calendar' })}
      ${P('Every note’s discount rate starts here', stateTag('computed', 'Computed'), `<div class="drows">${[['Rate the notes used (median)', '4.12%'], ['Rate today', '4.18%'], ['Largest drift since writing', '+0.31 pts · TSLA, Jul 21'], ['Flags a valuation at', '±0.25 pts']].map(([a, b]) => `<div style="grid-template-columns: minmax(0, 1fr) auto;"><span class="steel">${a}</span><span class="mono">${b}</span></div>`).join('')}</div><div style="display: flex; gap: 10px; align-items: flex-start;"><span aria-hidden="true" style="margin-top: 5px; width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--phosphor); flex: 0 0 auto;"></span><span class="dline" style="font-size: 13px;"><strong style="color: var(--phosphor);">1 note was valued at a rate the 10-year has since left:</strong> TSLA (3.87%). Its cost of capital deserves a second look.</span></div><a href="/ticker/TSLA/research" class="t-info" style="display: inline-flex; gap: 6px; align-items: center; min-height: 24px; font-weight: 500;">Open the TSLA note ${icon('arrow', 14)}</a>`)}</div>
    ${P('Futures positioning', stateTag('delayed', 'As of Oct 6 · out Oct 9'), `${claim('Asset managers’ 10-year longs sit near the top of their 3-year range; leveraged funds’ shorts near the bottom.', 'Net futures positions, thousands of contracts, with the 3-year range and its median. Reported as of Tuesday, published Friday.')}${futures()}${src('Source: CFTC Traders in Financial Futures, as of Oct 6, released Oct 9.')}`)}
    <p class="dline" style="margin: 0;">Research and tools, not investment advice. Figures on this board are illustrative design values.</p>
  </div>`;
  return v4Page({ scheme, minHeight, active: 'research', tabs: 'Markets', demo, label: 'Markets', main });
}

// ---- Filings --------------------------------------------------------------------------------------
export function filingsBody({ minHeight = 2600, scheme = 'dark' } = {}) {
  const exp = [['Oct 15', 'TSM', '6-K', '3Q26 results and 4Q26 guidance'], ['Oct 21', 'TSLA', '8-K', 'Q3 2026 results'], ['Oct 29', 'INTC', '8-K', 'Q3 2026 results'], ['Nov 17', 'NVDA', '8-K', 'Q3 FY2027 results']];
  const feed = [['Oct 9', 'NVDA', '8-K 5.02', 'Officer change', 'new since the note', true], ['Oct 2', 'TSLA', '8-K', 'Q3 production and deliveries', 'not cited'], ['Sep 30', 'MU', '8-K 2.02', 'FQ4-26 results and FQ1-27 guidance', 'in note'], ['Sep 29', 'TSLA', '8-K 1.01', 'New credit facilities', 'in note'], ['Aug 27', 'NVDA', '10-Q', 'Quarter to Jul 26', 'in note'], ['Aug 26', 'NVDA', '8-K 2.02', 'Q2 FY2027 results', 'in note'], ['Aug 10', 'INTC', '8-K 8.01', 'Upsized $20B stock offering priced', 'in note']];
  const detail = P('NVDA · 8-K · Item 5.02 · Oct 9, 2026', stateTag('current', 'Filed Oct 9'), `<p class="dline" style="margin: 0; font-size: 13px;"><strong style="color: var(--phosphor);">Filed after the NVDA note was written, so the note is due for review.</strong> An officer-change filing carries no figures; its text is in the filing itself.</p>
    <div class="hd-fig" style="grid-template-columns: repeat(3, minmax(0, 1fr));"><div><span class="caps">Form</span><span class="v" style="font-size: 15px;">8-K</span></div><div><span class="caps">Items</span><span class="v" style="font-size: 15px;">5.02</span></div><div><span class="caps">Accession</span><span class="v" style="font-size: 12px;">0001045810-26-000212</span></div></div>
    <span class="caps" style="margin-top: 6px;">The last results filing · 10-Q, quarter to Jul 26</span>
    <div class="drows">${[['Revenue', '$96,182M', '$46,743M'], ['Gross profit', '$72,099M', '$34,320M'], ['Operating income', '$63,867M', '$28,440M'], ['Diluted EPS', '$2.31', '$1.08']].map(([f, a, b]) => `<div style="grid-template-columns: minmax(0, 1fr) 100px 100px;"><span>${f}</span><span class="mono" style="text-align: right;">${a}</span><span class="mono steel" style="text-align: right;">${b}</span></div>`).join('')}</div>
    <span class="dline" style="font-size: 11px;">This period · prior year’s period. From the 10-Q’s XBRL facts.</span>
    <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 4px;"><a href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&amp;CIK=0001045810" class="btn primary">Open the filing ${icon('external', 14)}</a><button class="btn secondary" type="button">${icon('copy', 14)}Copy the draft command</button></div>`, { label: 'Filing detail', extra: 'position: sticky; top: 80px;' });
  const main = `<div class="wrap rs">
    <div class="rs-h"><h1 class="display">Filings</h1><p class="lead">What the 14 followed companies filed with the SEC, newest first. A results filing makes its note due; its figures arrive beside the note’s for a line-by-line update.</p>
      <div class="rs-chips">${provChip('SEC EDGAR · checked 14:00 UTC', 'solid')}<span class="steel" style="font-size: 12px; display: inline-flex; gap: 6px; align-items: center;"><span class="kbd">j</span><span class="kbd">k</span> move <span class="kbd">o</span> open the filing</span></div></div>
    <section aria-label="Expected" style="display: flex; flex-direction: column; gap: 10px;"><span class="caps" style="color: var(--phosphor);">Expected · next six weeks</span><div class="rs-cards">${exp.map(([d, t, f, w]) => `<div class="hd-p" style="border-style: dashed; padding: 14px 16px; gap: 6px;"><span class="mono" style="font-size: 13px;">${d} · ${t} <span class="rs-form">${f}</span></span><span style="font-size: 13px;">${w}</span><span class="dline" style="font-size: 11px;">makes its note due · confirmed date</span></div>`).join('')}</div></section>
    <nav aria-label="Filing kinds" class="rs-chipbar"><a href="?kind=all" aria-current="true">All · 11</a><a href="?kind=results">Results · 4</a><a href="?kind=periodic">Quarterly and annual · 1</a><a href="?kind=financing">Deals and financing · 3</a><a href="?kind=other">Other · 3</a></nav>
    <div class="rs-2" style="align-items: start;"><section class="hd-p" aria-label="Filed, last 90 days" style="padding: 0; gap: 0;"><div class="ph" style="padding: 16px 16px 10px;"><h3>Filed · last 90 days</h3>${stateTag('current', 'Checked 14:00 UTC')}</div><div class="rs-feed">${feed.map(([d, t, f, w, s, cur]) => `<div${cur ? ' aria-current="true"' : ''}><span class="mono steel">${d}</span><span class="mono" style="font-weight: 600;">${t}</span><span class="rs-form">${f}</span><span style="min-width: 0;">${w}</span><span class="dline" style="font-size: 11px;${s === 'new since the note' ? ' color: var(--phosphor); font-weight: 600;' : ''}">${s}</span></div>`).join('')}</div><p class="dline" style="margin: 0; padding: 12px 16px; border-top: 1px solid var(--line); font-size: 12px;">2 followed tickers aren’t listed with the SEC (SPCX, CBRS): their filings come from the companies’ own sites and appear in their notes only.</p></section>${detail}</div>
    <p class="dline" style="margin: 0;">Filings from SEC EDGAR, the public record. Research and tools, not investment advice. Figures are illustrative design values.</p>
  </div>`;
  return v4Page({ scheme, minHeight, active: 'research', tabs: 'Filings', label: 'Filings', main });
}

// ---- Scorecard ------------------------------------------------------------------------------------
export function scorecardBody({ minHeight = 2600, scheme = 'dark' } = {}) {
  const soon = [['Oct 15', 'TSM', '3Q26 gross margin is at least 66.0%, the guidance midpoint.'], ['Oct 15', 'TSM', 'TSMC guides 4Q26 revenue with a midpoint of at least $50.0B.'], ['Oct 21', 'TSLA', 'Q3 2026 automotive gross margin ex credits is at least 16.3%, Q2’s level.'], ['Oct 21', 'TSLA', 'Q3 2026 regulatory credit revenue is below $200M.'], ['Oct 27', 'HOOD', 'Q3 2026 net deposits are at least $15B.']];
  const counts = [18, 23, 8, 7, 7, 6, 0, 1, 3, 1, 3];
  const months = ['O', 'N', 'D', 'J', 'F', 'M', 'A', 'M', 'J', 'J', '’28'];
  const main = `<div class="wrap rs">
    <div class="rs-h"><h1 class="display">Scorecard</h1><p class="lead">How the calls in the notes turn out. A forecast is scored when its date passes, but only if it carried your probability before then: scoring a call after the answer is known would be fiction.</p></div>
    <div class="rs-strip">${[['Open forecasts', '77', 'across 14 notes'], ['With your probability', '0', 'the notes leave it blank for you'], ['Resolved', '0', 'first two on Oct 15'], ['Brier score', 'not set', 'needs resolved calls that carried a probability']].map(([l, v, s]) => `<div><span class="caps">${l}</span>${v === 'not set' ? '<span class="dnan" style="padding: 4px 0;">not set</span>' : `<span class="v">${v}</span>`}<span class="dline" style="font-size: 12px;">${s}</span></div>`).join('')}</div>
    <div class="rs-2">${P('Resolving in the next two weeks', stateTag('computed', 'From the notes'), `${claim('Eleven forecasts resolve in the next two weeks, all still without a probability.', 'Set one in the note’s forecasts block: copy the line, put your probability in the second cell, and push.')}<div class="drows">${soon.map(([d, t, c]) => `<div style="grid-template-columns: 52px 48px minmax(0, 1fr) auto;"><span class="mono steel">${d}</span><span class="mono" style="font-weight: 600;">${t}</span><span style="min-width: 0;">${c}</span><button class="btn ghost sm" type="button" aria-label="Copy the Markdown line for: ${c}">${icon('copy', 14)}Copy line</button></div>`).join('')}</div>`)}
      ${P('By month', stateTag('computed', 'From the notes'), `${claim('41 of the 77 resolve by the end of November.', 'Open forecasts by the month their date falls in, October 2026 to 2028.')}<div role="img" aria-label="Open forecasts per month: October 18, November 23, then fewer" style="display: grid; grid-template-columns: repeat(${counts.length}, minmax(0, 1fr)); gap: 6px; align-items: end; height: 150px; border-bottom: 1px solid var(--line-2);">${counts.map((n, i) => `<div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 4px; height: 100%;"><span class="mono" style="font-size: 11px;${i < 2 ? '' : ' color: var(--steel);'}">${n}</span><span style="display: block; width: 100%; max-width: 28px; height: ${n === 0 ? 2 : Math.round((n / 24) * 120)}px; border-radius: 4px 4px 1px 1px; background: ${i < 2 ? 'var(--phosphor)' : 'var(--steel)'};"></span></div>`).join('')}</div><div style="display: grid; grid-template-columns: repeat(${counts.length}, minmax(0, 1fr)); gap: 6px; text-align: center; font: 400 11px 'IBM Plex Mono', monospace; color: var(--steel);">${months.map((m) => `<span>${m}</span>`).join('')}</div>`)}</div>
    <div class="rs-2 half">${P('Calibration', stateTag('empty', 'Nothing yet'), `${claim('Calibration draws itself once 20 forecasts with your probability resolve.', 'How often calls made at each confidence came true, grouped in tenths. 0 of 20 resolved so far.')}<div aria-hidden="true" style="position: relative; height: 200px; border-left: 1px solid var(--line-2); border-bottom: 1px solid var(--line-2); margin-left: 32px;"><span style="position: absolute; left: 0; bottom: 0; width: 141%; height: 1px; background: var(--line-2); transform-origin: left bottom; transform: rotate(-45deg);"></span><span style="position: absolute; left: 50%; top: 45%; transform: translate(-50%, -50%); font-size: 13px; color: var(--steel);">0 of 20 resolved</span></div><p class="dline" style="margin: 0;">Brier score: the average squared miss. Saying 50% to everything scores 0.25; lower is better.</p>`)}
      ${P('Signal track record', stateTag('notLive', 'Not live · price source'), `<p class="dline" style="margin: 0; font-size: 13px;"><strong style="color: var(--phosphor);">Would show</strong> whether the scanner’s setups held up after trading costs: hit rate, median outcome, and how far each outcome landed from the level its setup named.</p><p class="dline" style="margin: 0; font-size: 13px;"><strong style="color: var(--phosphor);">Off because</strong> grading needs daily closes for every scanned symbol, licensed for public display. None is chosen yet (open question Q-1).</p><p class="dline" style="margin: 0; font-size: 13px;"><strong style="color: var(--phosphor);">Meanwhile</strong> it runs on staging’s sample prices, and the forecast half of this page is live.</p><div style="border: 1px dashed var(--steel-2); border-radius: 10px; padding: 12px; background-image: repeating-linear-gradient(135deg, transparent 0 10px, var(--hatch) 10px 20px); display: flex; flex-direction: column; gap: 8px;">${stateTag('sample', 'Sample · staging prices')}${renderTool('signals', { compact: true })}</div>`)}</div>
    <p class="dline" style="margin: 0;">Forecasts come from each note’s forecasts block. Research and tools, not investment advice.</p>
  </div>`;
  return v4Page({ scheme, minHeight, active: 'research', tabs: 'Scorecard', label: 'Scorecard', main });
}

// ---- Ticker research tab (NVDA) ---------------------------------------------------------------------
export function tickerResearchBody({ minHeight = 3600, scheme = 'dark' } = {}) {
  const cells = [['Revenue · Q2 FY27', '$96.2B', '▲ 106% on a year. Data Center $89.0B.', '8-K 99.1 · Aug 26'], ['Gross margin, GAAP', '75.0%', '▲ 2.6 pts on a year.', '8-K 99.1 · Aug 26'], ['Operating margin, GAAP', '66.2%', '▲ 5.4 pts on a year.', '8-K 99.1 · Aug 26'], ['Free cash flow · Q2', '$21.3B', '▼ from $48.6B in Q1.', '10-Q · Jul 26 quarter']];
  const main = `<div class="wrap rs">
    <div class="hd-mast" style="display: flex; flex-wrap: wrap; gap: 12px 32px; align-items: flex-end;"><div style="flex: 999 1 480px; display: flex; flex-direction: column; gap: 6px;"><div style="display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;"><span class="display" style="font-size: 40px; line-height: 1;">NVDA</span><span class="steel">NVIDIA · Nasdaq · AI accelerators, networking and the CUDA software stack</span></div><div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;"><span class="mono" style="font-size: 20px;">$226.32</span>${stateTag('delayed', 'Close · Mon Oct 12')}</div></div><nav aria-label="NVDA" class="hd-tabs" style="display: flex; gap: 4px;"><a href="/ticker/NVDA">Overview</a><a href="/ticker/NVDA/technical-analysis">Technical</a><a href="/ticker/NVDA/research" aria-current="page">Research</a></nav></div>
    <section class="rs-note-head" aria-labelledby="note-title" style="display: flex; flex-direction: column; gap: 12px; padding-bottom: 20px; border-bottom: 1px solid var(--line);">
      <div role="status" class="dwarn" style="max-width: 880px;">${icon('warn', 14)}<div style="display: flex; flex-direction: column; gap: 2px;"><strong style="font-size: 13px;">Review due. Written Oct 13; an 8-K landed Oct 9 after the note’s price date.</strong><span class="dline">Since then: officer change (8-K 5.02), Oct 9. CPI on Oct 15 and the FOMC on Oct 28 are this note’s next review triggers.</span></div></div>
      <h1 id="note-title" class="display">A 70% growth guide on a $412B year. What comes after FY2028 is the whole question.</h1>
      <div style="display: flex; flex-wrap: wrap; gap: 8px 18px; align-items: center; font-size: 13px; color: var(--steel);"><span style="display: inline-flex; gap: 8px; align-items: center;"><span aria-hidden="true" style="width: 9px; height: 9px; border-radius: 50%; background: linear-gradient(90deg, var(--phosphor) 50%, transparent 50%); border: 1px solid var(--phosphor);"></span><span style="color: var(--phosphor); font-weight: 600;">Review due</span></span><span>Written <span style="color: var(--phosphor);">Oct 13, 2026</span></span><span>26 sources</span><span class="prov dashed">Stance · your call</span></div>
    </section>
    <section aria-label="Key numbers" style="display: flex; flex-direction: column; gap: 10px;"><div style="display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: baseline;"><h2 class="display" style="margin: 0; font-size: 22px;">Key numbers, read from the filings</h2><span class="dline" style="font-size: 13px;">Each figure links to the filing and line it came from. Directions are company facts, so they stay neutral.</span></div>
      <div class="rs-strip">${cells.map(([l, v, s, c]) => `<div><span class="caps">${l}</span><span class="v">${v}</span><span class="dline" style="font-size: 12px;">${s}</span>${provChip(c, 'solid', '/research/filings')}</div>`).join('')}</div>
      <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; font-size: 13px;">${stateTag('computed', 'Checked against the 10-Q')}<span class="steel">6 figures checked: 4 match, operating margin differs by 0.2 pts (the 10-Q says 66.4%), supply commitments carry no XBRL tag.</span></div></section>
    <section aria-label="Who is positioned how" style="display: flex; flex-direction: column; gap: 12px;"><div style="display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: baseline;"><h2 class="display" style="margin: 0; font-size: 22px;">Who is positioned how</h2><span class="dline" style="font-size: 13px;">Short sellers, insiders, funds and off-exchange venues, from public records. Each card names its source and how late it reports.</span></div>
      <div class="rs-cards">${dataCell({ fam: 'pos', state: 'delayed', w: '100%', h: 'auto' })}${dataCell({ fam: 'pos', state: 'current', w: '100%', h: 'auto' })}
        ${P('Insider trades · 90 days', stateTag('computed', 'No cluster'), renderTool('clusters', { compact: true }) + provChip('SEC Form 4 · latest Oct 8', 'solid'), { label: 'Insider trades and clusters' })}
        ${P('Fund holdings · Q2', stateTag('delayed', 'Delayed · 45 days by law'), renderTool('holders', { compact: true }) + provChip('13F-HR · quarter to Jun 30', 'solid'), { label: 'Fund holdings' })}
        ${P('Off-exchange volume · weekly', stateTag('delayed', 'Delayed · 2 weeks'), renderTool('otc', { compact: true }) + provChip('FINRA OTC Transparency · wk Sep 22', 'solid'), { label: 'Off-exchange volume' })}
        ${P('Fails to deliver', stateTag('delayed', 'Delayed · 2 weeks'), `<span class="dval" style="font-size: 20px;">412k shares</span><span class="dline">peak daily fails, Sep 1–15 · 0.02% of shares outstanding</span><p class="dline" style="margin: 0;"><strong style="color: var(--phosphor);">What it does not mean:</strong> a fail is a late delivery, usually settled within days. It is not a short position, and not evidence of naked shorting by itself.</p>${provChip('SEC fails-to-deliver · first half of Sep', 'solid')}`, { label: 'Fails to deliver' })}</div></section>
    <div class="rs-2 half">${P('Price since this note', stateTag('computed', 'Computed · end of day'), renderTool('ta', { research: true }) + provChip('[EOD PRICE SOURCE] · close Oct 12', 'solid'), { label: 'Price since this note' })}
      ${P('Margins against peers', stateTag('computed', 'Computed · CY2026 Q2'), renderTool('peers', { compact: true }) + provChip('XBRL frames · CY2026Q2 · 9 filers', 'solid'), { label: 'Peer table' })}</div>
    ${dataCell({ fam: 'feed', state: 'current', w: '100%', h: 'auto' })}
    <p class="dline" style="margin: 0;">Personal research notes. Research and tools, not investment advice. Figures are illustrative design values.</p>
  </div>`;
  return v4Page({ scheme, minHeight, active: 'research', label: 'NVDA research', main });
}
