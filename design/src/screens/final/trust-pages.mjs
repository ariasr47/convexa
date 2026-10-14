// Final · Convexa v1 — trust group: the three pages a public site owes its readers (2026-10-14).
// Data sources and credits (/credits), Privacy (/privacy), Terms and disclaimer (/terms). New screens:
// the app has no routes for them yet. Drawn in the site's document style (the Methodology page's
// on-this-page index beside a reading column), on the shell-site group's page wrapper per environment.
// Every claim about storage, the account and third parties is read from the code (see each row's spec).
import { icon } from '../../lib.mjs';
import { provChip, stateTag } from '../../components/data-states.mjs';
import { statesBoard } from '../v4/kit.mjs';
import { demoLink, sitePage } from './shell-site-kit.mjs';

export const TR_CSS = `
  .tr .doc article { max-width: 78ch; }
  .tr .doc article h2 { scroll-margin-top: 80px; }
  .tr .lead { font-size: 17px !important; color: var(--phosphor) !important; }
  .tr .upd { font: 500 12px 'IBM Plex Mono', monospace; color: var(--steel); }
  .tr-legend { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; padding: 12px 16px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); }
  .tr-legend .caps { color: var(--phosphor); }
  .tr-src { border: 1px solid var(--line); border-radius: 12px; background: var(--panel); padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; min-width: 0; scroll-margin-top: 80px; }
  .tr-src.k-demo { border-style: dashed; border-color: var(--steel-2); }
  .tr-src > header { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: flex-start; justify-content: space-between; }
  .tr-src h3 { margin: 0; font-size: 17px; line-height: 1.3; }
  .tr-src .own { display: block; margin-top: 2px; font-size: 13px; color: var(--steel); }
  .tr-src dl { margin: 0; display: grid; grid-template-columns: 168px minmax(0, 1fr); gap: 10px 16px; font-size: 14px; line-height: 1.55; }
  .tr-src dt { color: var(--steel); font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; padding-top: 3px; }
  .tr-src dd { margin: 0; color: var(--phosphor); text-wrap: pretty; }
  .tr-src .now { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
  .tr-src .now .dline { font-size: 13px; }
  .tr-src .links { display: flex; flex-wrap: wrap; gap: 8px 18px; align-items: center; padding-top: 12px; border-top: 1px solid var(--line); }
  .tr-src .links a { display: inline-flex; align-items: center; gap: 6px; min-height: 24px; font-size: 13.5px; font-weight: 600; text-decoration: none; }
  .tr-src details summary { cursor: pointer; font-size: 13px; color: var(--steel); min-height: 24px; display: inline-flex; align-items: center; }
  .tr .tr-notice, .tr-notice { margin: 0; font-size: 13.5px !important; color: var(--phosphor) !important; border-left: 2px solid var(--steel-2); background: var(--ink-2); padding: 10px 14px; border-radius: 0 8px 8px 0; font-size: 13.5px; line-height: 1.55; color: var(--phosphor); text-wrap: pretty; }
  .tr-notice b { font-weight: 600; }
  .tr-skel { display: inline-block; width: 150px; height: 24px; border-radius: 999px; }
  .tr-keys td:first-child { font: 500 12.5px/1.5 'IBM Plex Mono', monospace; white-space: nowrap; }
  .tr-keys td { font-size: 13.5px; }
  .tr-list { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; font-size: 15.5px; line-height: 1.6; color: var(--steel); }
  .tr-list strong { color: var(--phosphor); }
  .tr-box { border: 1px solid var(--line); border-radius: 12px; background: var(--panel); padding: 16px 18px; display: flex; flex-direction: column; gap: 8px; }
  .tr-box.k-demo { border-style: dashed; border-color: var(--steel-2); }
  .tr-box h3 { margin: 0; font-size: 15px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .tr-box p { font-size: 14px !important; }
  .tr-never { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 20px; margin: 0; padding: 0; list-style: none; }
  .tr-never li { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 8px; font-size: 14.5px; line-height: 1.5; color: var(--phosphor); }
  .tr-never li .ico { color: var(--steel); margin-top: 3px; }
  @media (max-width: 699px) {
    .tr-src { padding: 16px; }
    .tr-src dl { grid-template-columns: minmax(0, 1fr); gap: 2px; }
    .tr-src dd { margin-bottom: 10px; }
    .tr-never { grid-template-columns: minmax(0, 1fr); }
    .tr .lead { font-size: 16px !important; }
    .tr-keys thead { display: none; }
    .tr-keys tr { display: block; padding: 10px 0; border-bottom: 1px solid var(--line); }
    .tr-keys td { display: block; border: 0 !important; padding: 2px 0 !important; }
    .tr-keys td:first-child { white-space: normal; overflow-wrap: anywhere; }
    .tr-keys td:nth-child(3) { font-size: 12.5px; }
  }
`;

// ---- shared: the page in the document style; the footer (v4Footer) carries the three trust links ----
/** Marks the current trust page's footer link (shell/Footer.tsx gains the same three links). */
export function withTrustFooter(html, current = '') {
  const a = `<a href="${current}">`, i = current ? html.lastIndexOf(a) : -1; // the footer is the page's last link to it
  return i < 0 ? html : `${html.slice(0, i)}<a href="${current}" aria-current="page" style="color: var(--phosphor);">${html.slice(i + a.length)}`;
}
function docPage({ env, scheme, minHeight, label, path, toc, article }) {
  const main = `<div class="tr"><div class="wrap doc"><nav aria-label="On this page">${toc.map(([id, t], i) => `<a href="#${id}"${i === 0 ? ' aria-current="true"' : ''}>${t}</a>`).join('')}</nav><article>${article}</article></div></div>`;
  return withTrustFooter(sitePage({ env, scheme, minHeight, label, main }), path);
}
const h2 = (id, t) => `<h2 id="${id}" class="display">${t}</h2>`;
const P = (t) => `<p>${t}</p>`;
const ext = (text, href) => `<a href="${href}" rel="noopener">${text} ${icon('external', 13)}</a>`;
const tbl = (head, rows, cls = '') => `<div style="overflow-x: auto;"><table class="ss-tbl ${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

// ================================================================================================
// Data sources and credits (/credits)
// ================================================================================================
const FINRA_TERMS = 'FINRA’s terms for its free equity data (§2.3) ask for this notice wherever the data, or anything worked out from it, appears:';
export const FINRA_NOTICE = `<p class="tr-notice"><b>Data owned and provided by FINRA.</b> FINRA owns and is the source of the short-interest and short-sale-volume data on this site, including the percentages and averages Convexa calculates from it. Shown free for non-commercial personal use; please don’t redistribute it.</p>`;

export const SOURCES = [
  {
    id: 'treasury', toc: 'U.S. Treasury', name: 'Daily Treasury yield curve rates', owner: 'U.S. Department of the Treasury',
    reads: 'The daily par yield curve (3-month, 2-, 5-, 10- and 30-year) and the daily real yield curve (10-year).',
    cadence: 'Every business day, after the close (published after 3:30 PM ET). Convexa checks every 6 hours.',
    terms: 'U.S. government data, free to show on a public site. Convexa credits the Treasury on every card that uses it.',
    where: 'Research → Markets, and the discount-rate check on each research note.',
    link: ['Treasury interest-rate data', 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates'],
    prod: ['current', 'Updated · Oct 13'], prodNote: 'Rates for Monday, Oct 13, 2026 · checked 14:00 UTC.',
    shaped: 'Treasury’s daily curves',
  },
  {
    id: 'cftc', toc: 'CFTC', name: 'Traders in Financial Futures', owner: 'Commodity Futures Trading Commission (CFTC)',
    reads: 'Net positions of asset managers and leveraged funds in 10-year T-note, E-mini S&P 500 and E-mini Nasdaq-100 futures.',
    cadence: 'Weekly. Positions as of Tuesday, published Friday afternoon. Convexa checks every 12 hours.',
    terms: 'U.S. government data, free to show on a public site, credited to the CFTC.',
    where: 'Research → Markets, and the positioning card under each ticker’s note.',
    link: ['CFTC Commitments of Traders', 'https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm'],
    prod: ['delayed', 'Delayed by source · as of Oct 6'], prodNote: 'Positions as of Tuesday, Oct 6, published Friday, Oct 9. The next report is due Friday, Oct 16.',
    shaped: 'the CFTC’s weekly report',
  },
  {
    id: 'finra-si', toc: 'FINRA short interest', name: 'Consolidated short interest', owner: 'FINRA (Financial Industry Regulatory Authority)',
    reads: 'Shares sold short and days to cover for each followed ticker, at each settlement date.',
    cadence: 'Twice a month, about a week after each settlement date. Convexa checks every 12 hours.',
    terms: FINRA_TERMS, finra: true,
    where: 'The positioning card under each ticker’s research note.',
    link: ['FINRA short interest', 'https://www.finra.org/finra-data/browse-catalog/equity-short-interest'],
    prod: ['delayed', 'Delayed by source · settled Sep 30'], prodNote: 'Settlement of Sep 30, published Oct 9. The next settlement is Oct 15.',
    shaped: 'FINRA’s short-interest file',
  },
  {
    id: 'finra-shvol', toc: 'FINRA short-sale volume', name: 'Reg SHO daily short-sale volume', owner: 'FINRA (Financial Industry Regulatory Authority)',
    reads: 'Each trading day’s short-sale volume and total volume for each followed ticker. Convexa works out the short share and its 20-day average.',
    cadence: 'Every trading day, one business day late. Convexa reads each day’s file once.',
    terms: FINRA_TERMS, finra: true,
    where: 'The positioning card under each ticker’s research note.',
    link: ['FINRA short-sale volume', 'https://www.finra.org/finra-data/browse-catalog/short-sale-volume-data'],
    prod: ['current', 'Updated · Oct 13 file'], prodNote: 'The file for Monday, Oct 13.',
    shaped: 'FINRA’s daily Reg SHO files',
  },
  {
    id: 'sec', toc: 'SEC EDGAR', name: 'EDGAR filings and company facts', owner: 'U.S. Securities and Exchange Commission (SEC)',
    reads: 'Filings of the last 90 days, Form 4 insider trades, and the figures companies report in 10-Q, 10-K and 20-F filings (XBRL company facts).',
    cadence: 'As filed: a filing appears minutes after the SEC accepts it. Convexa checks filings every hour and company facts every 24 hours.',
    terms: 'Public record, free to show. The SEC asks every program that reads EDGAR to identify itself with a name and a contact address.',
    where: 'Research → Filings, the insider card and “Filed since this note” under each ticker’s note.',
    link: ['SEC EDGAR', 'https://www.sec.gov/edgar'],
    prod: ['notConfigured'], prodNote: 'This site hasn’t been given the contact line EDGAR asks for, so filings and insider trades don’t load yet.',
    operator: 'Set SEC_USER_AGENT on the API to a name and contact address, such as “Convexa research &lt;address&gt;”.',
    shaped: 'SEC EDGAR filings',
  },
  {
    id: 'tradingview', toc: 'TradingView', name: 'Advanced chart widget', owner: 'TradingView', third: true,
    reads: 'Nothing. TradingView draws daily candles, the 20- and 50-day EMAs and RSI 14 from its own prices, inside a frame on the Technical tab and the desk’s daily price panel.',
    cadence: 'TradingView’s own. US prices are delayed (Cboe One).',
    terms: 'Display only: Convexa reads, stores and computes nothing from the frame (TradingView policies §3). TradingView’s attribution, “Chart by TradingView”, stays exactly as it publishes it (§4).',
    privacy: 'Loading the chart sends your browser’s IP address and the page’s address to TradingView.',
    where: 'Ticker → Technical; the ticker desk’s daily price panel.',
    link: ['TradingView', 'https://www.tradingview.com'],
    prod: ['thirdParty'], prodNote: 'Loads when you open the view. Convexa can’t see whether TradingView is up.',
  },
  {
    id: 'massive', toc: 'Massive options feed', name: 'Options and stock market data', owner: 'Massive',
    reads: 'On a site that subscribes: option chains with greeks and implied volatility, option trades and quotes, and stock prices — the inputs to dealer structure, flow, the tape, scores and AI reads.',
    cadence: 'Streaming during market hours.',
    terms: 'A paid subscription. This site doesn’t subscribe.',
    where: 'The ticker desk’s structure, flow and AI read; the scanner; option prices in trade entry; the Lab.',
    link: ['Massive', 'https://massive.com'],
    prod: ['notLive'], prodNote: 'Nothing built from the options chain is live on this site. Each of those panels says so and links to the same screen on the demo.',
    shaped: 'the Massive options feed',
  },
];

/** One source card. env: production | staging; state overrides the production state (states board). */
export function sourceCard(s, { env = 'production', state = null, note = null, compact = false } = {}) {
  const stg = env === 'staging';
  let tag;
  let now;
  let chip = '';
  if (stg && s.id === 'tradingview') {
    tag = stateTag('off', 'Off on the demo');
    now = 'The demo never loads TradingView: the Technical tab draws sample bars instead, and no request leaves this browser.';
  } else if (stg) {
    tag = stateTag('demo');
    now = 'Sample data from the October 7, 2026 scenario. The demo never contacts this source.';
    chip = provChip(`Demo · shaped like ${s.shaped}`, 'dashed');
  } else {
    const st = state || s.prod;
    tag = st[0] === 'loading' ? '<span class="skel tr-skel" aria-label="Checking this source"></span>' : stateTag(st[0], st[1] || '');
    now = note ?? s.prodNote;
  }
  const op = !stg && !state && s.operator ? `<details><summary>For the site’s operator</summary><span class="dline">${s.operator}</span></details>` : '';
  const rows = [['What Convexa reads', s.reads], ['How often, how late', s.cadence], ['Terms', s.terms + (s.finra && !compact ? FINRA_NOTICE.replace('<p class="tr-notice">', '<p class="tr-notice" style="margin-top: 8px;">') : '')], ...(s.privacy ? [['Your privacy', s.privacy]] : []), ['Where it shows', s.where]];
  const body = compact ? '' : `<dl>${rows.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join('')}</dl>`;
  const links = compact ? '' : `<div class="links">${ext(s.link[0], s.link[1])}${!stg && (s.id === 'massive') ? demoLink('/ticker/SPY', 'See them on the demo') : ''}${stg && s.id === 'tradingview' ? `<a href="https://convexa.pages.dev/ticker/SPY/technical-analysis">TradingView’s chart on the live site ${icon('external', 13)}</a>` : ''}</div>`;
  return `<section class="tr-src${stg ? ' k-demo' : ''}" id="${s.id}" aria-labelledby="${s.id}-h"><header><div><h3 id="${s.id}-h">${s.name}</h3><span class="own">${s.owner}</span></div>${tag}</header><div class="now"><span class="dline">${now}</span>${chip}${op}</div>${body}${links}</section>`;
}

const CREDITS_TOC = [['sources', 'On this page'], ...SOURCES.map((s) => [s.id, s.toc]), ['typefaces', 'Typefaces'], ['ours', 'What Convexa makes']];
function legend(env) {
  const items = env === 'staging'
    ? [['demo', 'Demo · sample data', 6], ['off', 'Off on the demo', 1]]
    : [['current', 'Updated', 2], ['delayed', 'Delayed by source', 2], ['notConfigured', 'Not set up', 1], ['thirdParty', 'Live · TradingView', 1], ['notLive', 'Not live', 1]];
  return `<div class="tr-legend" id="sources" role="group" aria-label="Sources by state"><span class="caps">On this page</span>${items.map(([k, w, n]) => stateTag(k, `${w} · ${n}`)).join('')}</div>`;
}
const TYPE_ROWS = [
  ['IBM Plex Sans', 'Copyright 2019 IBM Corp.', 'SIL OFL 1.1', '/fonts/ibm-plex-sans/OFL.txt'],
  ['IBM Plex Mono', 'Copyright 2017 IBM Corp.', 'SIL OFL 1.1', '/fonts/ibm-plex-mono/OFL.txt'],
  ['Archivo', 'Copyright 2020 The Archivo Project Authors (Omnibus-Type)', 'SIL OFL 1.1', '/fonts/archivo/OFL.txt'],
];
function creditsArticle(env) {
  const stg = env === 'staging';
  const intro = stg
    ? `<p class="lead"><strong>This is the demo: every figure on it is sample data shaped like the sources below.</strong> The demo calls none of them, and none of its numbers describes a real market. The live site reads them as listed here.</p>`
    : `<p class="lead">Every figure on this site names its source on the card where it appears. This page lists them all: who owns each source, what Convexa reads from it, how often and how late it publishes, the terms it is shown under, and whether it is working on this site right now.</p>`;
  const after = stg
    ? `<p>On the live site, FINRA’s figures carry the notice FINRA’s terms require:</p>${FINRA_NOTICE}<div style="display: flex;"><a class="ss-demo" href="https://convexa.pages.dev/credits">The live site’s sources and credits ${icon('external', 13)}</a></div>`
    : `<p class="dline" style="font-size: 13px; margin: 0;">States are checked when you open this page. What each card says about its source never depends on that check.</p>`;
  return `<div style="display: flex; flex-direction: column; gap: 10px;"><span class="caps">Sources and credits</span><h1 class="display">Data sources and credits</h1>${intro}</div>
    ${legend(env)}
    ${after}
    ${SOURCES.map((s) => sourceCard(s, { env })).join('')}
    ${h2('typefaces', 'Typefaces')}${P('Three open-source typefaces, served from this site. Loading a page contacts no font service.')}
    ${tbl(['Typeface', 'Copyright', 'Licence'], TYPE_ROWS.map(([a, b, c, href]) => [a, b, `<a href="${href}">${c}</a>`]))}
    ${h2('ours', 'What Convexa makes')}${P('<strong>Research notes</strong> are written for Convexa, each with its price date and its review date. <strong>Computed</strong> figures — a yield spread, a short share, an average — are worked out by Convexa from the inputs named on their card. The landing page’s three illustrations are <strong>illustrative samples</strong>, labelled as such, and never market data.')}
    <p style="font-size: 13px; padding-top: 16px; border-top: 1px solid var(--line);">A source missing from this page, or a credit that’s wrong? The <a href="/methodology#data">Methodology page</a> says how each state is decided; the <a href="/privacy">Privacy page</a> says what each third party learns about you.</p>`;
}
export function creditsBoard(env) {
  return ({ minHeight = 0, scheme = 'dark' } = {}) => docPage({ env, scheme, minHeight, label: 'Data sources and credits', path: '/credits', toc: CREDITS_TOC, article: creditsArticle(env) });
}

/** Every live state a source card can show, with when it happens. */
export function creditsStates({ minHeight = 0, scheme = 'dark' } = {}) {
  const S = Object.fromEntries(SOURCES.map((s) => [s.id, s]));
  const c = (id, o = {}) => sourceCard(S[id], { compact: true, ...o });
  const items = [
    { name: 'Updated', tag: ['current'], when: 'The source answered on its schedule; the tag carries the source’s own date, never a clock time or a live dot.', html: c('treasury') },
    { name: 'Delayed by source', tag: ['delayed'], when: 'The source publishes late by design (CFTC weekly, FINRA short interest twice a month): the tag says as of when.', html: c('cftc') },
    { name: 'Last good copy', tag: ['stale'], when: 'This cycle’s fetch failed and the API is serving its earlier copy. Needs the API to report that (today it says “live” for both).', html: c('finra-si', { state: ['stale', 'Last good copy · Oct 13'], note: 'FINRA didn’t answer at 14:00 UTC. Showing the copy fetched Oct 13 at 02:00 UTC. Convexa asks again at 20:00 UTC.' }) },
    { name: 'Source down', tag: ['unavailable'], when: 'The source failed and nothing is kept. Its figures elsewhere are unknown, not empty.', html: c('treasury', { state: ['unavailable'], note: 'The Treasury didn’t answer and no earlier copy is kept. Convexa asks again at 20:00 UTC.' }) },
    { name: 'Not set up', tag: ['notConfigured'], when: 'Production today: SEC_USER_AGENT is unset (API state not_configured). Reader copy first; the operator hint folds away.', html: c('sec') },
    { name: 'Off', tag: ['off'], when: 'The operator set PUBLIC_DATA=off: every public source shows Off and Convexa calls none of them. No Try again.', html: c('cftc', { state: ['off'], note: 'Public data is switched off on this site. Convexa isn’t contacting the CFTC.' }) },
    { name: 'Not live', tag: ['notLive'], when: 'The Massive options feed, on production: what it would feed, why it is off, and the way to the demo.', html: c('massive').replace('</div></section>', `${demoLink('/ticker/SPY', 'See them on the demo')}</div></section>`) },
    { name: 'Live · TradingView', tag: ['thirdParty'], when: 'Always, on production: a third party draws it from its own prices; Convexa can’t see whether it is up, so it never claims Updated.', html: c('tradingview') },
    { name: 'Checking', tag: ['loading', 'Loading'], when: 'The state request is on its way: each tag is a skeleton at its final width. The card’s text is static and renders at once.', html: c('treasury', { state: ['loading'], note: 'Checking this source…' }) },
    { name: 'Couldn’t check', tag: ['error', 'Couldn’t load'], when: 'Our request for the states failed. The cards keep their text; the tags say Couldn’t load and the legend offers one Try again.', html: `<div class="tr-legend" style="border-color: var(--line-2);"><span class="caps">On this page</span>${stateTag('error', 'Couldn’t check the sources')}<span class="dline" style="font-size: 13px;">The site’s API didn’t answer. What each source is and its terms are still below.</span><button class="btn secondary sm" type="button">${icon('refresh', 14)}Try again</button></div>${c('cftc', { state: ['error'], note: 'Couldn’t check this source.' })}` },
    { name: 'Demo', tag: ['demo'], when: 'Staging: every card is dashed and says what its sample is shaped like; TradingView says Off on the demo.', html: sourceCard(S.treasury, { env: 'staging', compact: true }) },
    { name: 'FINRA’s notice', tag: null, when: 'Required by FINRA’s terms wherever its data or anything derived from it shows: on both FINRA cards here, and under every FINRA figure on the site (shipped in NotePublicPanels).', html: FINRA_NOTICE },
  ];
  return statesBoard({ scheme, minHeight, title: 'Data sources and credits · states', lead: 'The page’s text is static; only each source’s state tag is live. These are the states a tag can be in, and when each happens.', trace: 'P-1, P-2, Env 2026-10-14', items });
}

// ================================================================================================
// Privacy (/privacy)
// ================================================================================================
const PRIVACY_TOC = [['short', 'The short version'], ['browser', 'In this browser'], ['account', 'If you have an account'], ['leaves', 'What leaves your browser'], ['never', 'What Convexa doesn’t do'], ['clear', 'How to clear it'], ['changes', 'Changes']];
const KEYS = [
  ['convexa.uiprefs.v1', 'Your theme and default ticker, while you’re signed out.', 'When you change either in Settings'],
  ['convexa.theme-paint', 'The theme to paint before the page loads, so it doesn’t flash.', 'When the theme changes'],
  ['convexa.positions.v3', 'Your simulated (paper) positions and their history.', 'When you add, change or close one'],
  ['convexa.positions.touch_at', 'When the simulated book last changed.', 'With every change to the book'],
  ['convexa.orders.v1', 'Your simulated orders.', 'When you place, change or cancel one'],
  ['convexa.alerts.v1', 'Your alerts.', 'When you add or remove one'],
  ['convexa.personas.v1', 'The AI personas you made, and which one is active.', 'When you edit a persona'],
  ['convexa.recent-tickers.v1', 'The last tickers you opened, for the ⌘K jump box.', 'When you open a ticker'],
];
const SERVER_ROWS = [
  ['Your sign-in', 'Your email address and display name. Your password as an argon2 hash — never the password itself. When the account was made and when you last signed in.'],
  ['Your session', 'A record of each signed-in session; the browser holds one session cookie, gf_session. A session ends after 7 days unused, and after 30 days at most.'],
  ['Your settings', 'Theme, default ticker, scanner view, active persona, and the AI provider and model you chose.'],
  ['Your risk inputs', 'The account size and per-trade cap you type. Stored with your account, never in this browser; sent to your AI provider with each read you ask for.'],
  ['Your simulated book', 'A copy of your paper positions, orders and decision notes, so they follow you between devices. The copy with the newest timestamp wins, and this browser keeps its own copy too.'],
  ['Your AI key', 'Encrypted (AES-256-GCM). Only its last four characters are ever shown back; the key itself never returns to the browser.'],
  ['Your Webull keys', 'Only if you save them. Encrypted the same way; only the app key’s last four characters are shown back. Convexa doesn’t contact Webull yet, so they aren’t sent anywhere.'],
];
function privacyArticle(env) {
  const stg = env === 'staging';
  const short = stg
    ? `<p class="lead"><strong>This is the demo. Nothing you do here leaves this browser.</strong> The demo has no account, calls no server and loads no third party. What you change is kept in this browser under the convexa.demo.v1. prefix until you reset it.</p>`
    : `<p class="lead">Convexa runs no ads, no analytics and no tracking scripts. If you don’t sign in, what you do here stays in this browser. A few things do leave it, and this page names each one.</p>`;
  const browser = stg
    ? `${P('The demo keeps the same things the live site keeps, each under the <strong>convexa.demo.v1.</strong> prefix, so it never touches a live site’s data in the same browser. It adds four of its own: the demo account’s settings, its scanner view, its book’s fills, and a marker that says the sample book has been set up.')}${tbl(['Key (after the prefix)', 'What it holds'], [...KEYS.map(([k, w]) => [k, k === 'convexa.uiprefs.v1' ? 'The demo account’s theme and default ticker.' : w]), ['convexa.demo.auth.settings.v1', 'The demo account’s settings and risk inputs.'], ['convexa.demo.scan.view.v1', 'The demo scanner’s saved view.'], ['convexa.demo.book.v1', 'The demo book’s fills and marks.'], ['convexa.demo.workspace.initialized.v1', 'That the sample book has been set up.']], 'tr-keys')}`
    : `${P('These live in your browser’s local storage for this site. Nothing reads them but this site’s own pages, and none of them is sent anywhere unless you sign in (see below). Signed in, your settings come from your account instead.')}${tbl(['Key', 'What it holds', 'Written'], KEYS, 'tr-keys')}${P('Exporting your positions saves a file, convexa-archive-<em>date</em>.json, to your own device. Convexa keeps no copy of it.')}`;
  const account = stg
    ? `${P('The demo is always signed in to one shared demo account, and that account lives in this browser, not on a server. There’s no sign-out; <strong>Reset demo data</strong> in the bar puts it back as it started.')}`
    : `${P('Accounts are by invitation while Convexa is in private testing; sign-ups are closed. If you have one, Convexa’s server keeps the following, and nothing else about you:')}${tbl(['What', 'What’s kept'], SERVER_ROWS)}`;
  const leaves = stg
    ? P('Nothing. The demo makes no request to Convexa’s API or to any third party: its prices, filings and AI reads are all sample data built into the page. The Technical tab draws sample bars instead of loading TradingView.')
    : `${P('Your browser talks to two places: this site and, on two views, TradingView. Everything else is fetched by Convexa’s server, which never passes on who you are.')}
      ${tbl(['Who', 'When', 'What they get'], [
        ['Convexa’s hosts', 'Every visit', 'The site is served by Cloudflare Pages and its API runs on Railway. Like any host, they see your IP address with each request.'],
        ['TradingView', 'When you open the Technical tab or the desk’s price panel', 'Its chart loads a script and a frame from TradingView, which receives your IP address and the page’s address.'],
        ['Your AI provider', 'Only signed in, with your own key saved, when you ask for a read', 'Convexa’s server sends the ticker’s computed market state and signals, the candidate contracts, your risk inputs, a summary of your open positions in that ticker with your book’s count and capital at risk, and the persona’s name. “View what’s sent” on any ticker shows the export. The provider is the one you chose — Anthropic, OpenAI, xAI or Google Gemini — and its own privacy terms apply.'],
        ['Treasury, CFTC, FINRA, SEC', 'Never from your browser', 'Convexa’s server fetches public data once for every reader. These sources learn nothing about you.'],
      ])}`;
  const never = `<ul class="tr-never">${['No analytics, ads or tracking pixels', 'No third-party cookies set by Convexa', 'No font or script services beyond TradingView’s chart', 'Doesn’t sell what it keeps, or share it beyond what this page lists', 'Never places, changes or cancels a broker order', 'Never sends your AI key back to your browser'].map((t) => `<li>${icon('check', 15)}<span>${t}</span></li>`).join('')}</ul>`;
  const clear = stg
    ? `<div class="tr-box k-demo"><h3>${stateTag('demo')}Reset demo data</h3><p>The button in the demo bar removes every key under convexa.demo.v1. and sets the sample book up again. Nothing else in your browser is touched.</p></div>`
    : `<div class="tr-box"><h3>Signed out</h3><p>Clear this site’s data in your browser (site settings → clear data). That removes every key above. Export your positions first if you want to keep them.</p></div>
      <div class="tr-box"><h3>Signed in</h3><p>Signing out ends the session. In Settings you can remove your AI key and your Webull keys, which deletes them from the server. To delete the account itself, ask the site’s owner; there is no delete button yet.</p></div>`;
  return `<div style="display: flex; flex-direction: column; gap: 10px;"><span class="caps">Privacy</span><h1 class="display">Privacy</h1><span class="upd">Last updated Oct 14, 2026</span></div>
    ${h2('short', 'The short version')}${short}
    ${h2('browser', 'In this browser')}${browser}
    ${h2('account', stg ? 'The demo account' : 'If you have an account')}${account}
    ${h2('leaves', 'What leaves your browser')}${leaves}
    ${h2('never', 'What Convexa doesn’t do')}${never}
    ${h2('clear', 'How to clear it')}${clear}
    ${h2('changes', 'Changes')}${P('When this page changes, its date above changes with it. Where your data goes and who can see it are listed per source on <a href="/credits">Sources and credits</a>.')}`;
}
export function privacyBoard(env) {
  const toc = env === 'staging' ? PRIVACY_TOC.map(([id, t]) => [id, id === 'account' ? 'The demo account' : t]) : PRIVACY_TOC;
  return ({ minHeight = 0, scheme = 'dark' } = {}) => docPage({ env, scheme, minHeight, label: 'Privacy', path: '/privacy', toc, article: privacyArticle(env) });
}

// ================================================================================================
// Terms and disclaimer (/terms)
// ================================================================================================
const TERMS_TOC = [['what', 'What Convexa is'], ['advice', 'Not investment advice'], ['simulated', 'Simulated trades only'], ['broker', 'A connected brokerage'], ['data', 'Data can be late or wrong'], ['third', 'Third-party terms'], ['account', 'Your account'], ['liability', 'No warranty'], ['changes', 'Changes']];
function termsArticle(env) {
  const stg = env === 'staging';
  const demo = stg ? `<div class="tr-box k-demo"><h3>${stateTag('demo')}On this demo</h3><p>Every figure here is sample data from an authored scenario dated October 7, 2026. None of it describes a real market, a real company or a real account. The terms below are the live site’s, and apply here too.</p></div>` : '';
  return `<div style="display: flex; flex-direction: column; gap: 10px;"><span class="caps">Terms</span><h1 class="display">Terms and disclaimer</h1><span class="upd">Last updated Oct 14, 2026</span><p class="lead">Convexa is an analysis tool. It shows dealer positioning and public market data and explains how it reads them. It doesn’t tell you what to trade.</p></div>
    ${demo}
    ${h2('what', 'What Convexa is')}${P('Convexa reads options dealer positioning and public records — Treasury yields, futures positioning, short interest, SEC filings — and lays them out with their sources and dates. It publishes research notes, each with its price date and the date it should be reviewed by. Using the site means accepting these terms.')}
    ${h2('advice', 'Not investment advice')}${P('<strong>Nothing on Convexa is investment advice</strong>, and nothing on it is a recommendation to buy, sell or hold anything. Convexa makes no buy or sell calls. Structure is context for a plan, not a forecast of where a price will go.')}${P('An AI read is written by a model you choose, with your own key, framed by your persona and the risk inputs you type. It can be wrong. It is advisory, and nothing happens with it unless you accept it into the simulated book. You make your own decisions, and you are responsible for them.')}
    ${h2('simulated', 'Simulated trades only')}${P('<strong>Positions and orders in the sim book are simulated (paper).</strong> No money moves. Fills are modelled at the option’s mid or a price you enter, with no slippage and no partial fills, so simulated profit and loss is hypothetical and will differ from what a real order would have done.')}
    ${h2('broker', 'A connected brokerage is read-only')}${P('If you save Webull keys in Settings, Convexa stores them encrypted; it doesn’t contact Webull yet. <strong>A connected brokerage is read-only — Convexa never places, changes, or cancels an order.</strong> It has no way to: the broker connection has no write path. Removing your keys deletes them from Convexa and changes nothing at Webull.')}
    ${h2('data', 'Data can be late or wrong')}${P('Every source publishes on its own schedule, some of them weeks late, and any of them can be down, revised or mistaken. Each card says its source and its date, and says so when data is late, stale or missing — never a made-up value. Figures Convexa computes are only as good as their inputs. On this site, nothing built from the options chain is live. <a href="/credits">Sources and credits</a> lists every source and how late it is.')}
    ${h2('third', 'Third-party terms')}${P('Data and services from others come with their terms:')}
    <ul class="tr-list"><li><strong>FINRA</strong> owns and is the source of the short-interest and short-sale-volume data, including what Convexa calculates from it. Shown free for non-commercial personal use; please don’t redistribute it.</li><li><strong>TradingView</strong>’s chart is shown under TradingView’s terms, display only, with its attribution as published.</li><li><strong>Your AI provider</strong>’s terms apply to the key you bring and to what it writes.</li><li><strong>Webull</strong>’s terms apply to the keys you create there.</li><li><strong>The SEC, the Treasury and the CFTC</strong> publish public records; Convexa shows them as published, with their dates.</li></ul>
    ${h2('account', 'Your account')}${P('Accounts are by invitation while Convexa is in private testing; sign-ups are closed. Keep your password to yourself. Access can end, and features can change or stop, during testing. What the account keeps is on the <a href="/privacy">Privacy page</a>.')}
    ${h2('liability', 'No warranty')}${P('Convexa is provided as is, without warranty of any kind. To the extent the law allows, Convexa isn’t liable for any loss that comes from using it or from relying on anything it shows.')}
    ${h2('changes', 'Changes')}${P('When these terms change, the date above changes with them.')}
    <p style="font-size: 13px; padding-top: 16px; border-top: 1px solid var(--line);">Convexa is an analysis tool. Positions in the sim book are simulated (paper); a connected brokerage is read-only — Convexa never places, changes, or cancels an order. Not investment advice.</p>`;
}
export function termsBoard(env) {
  return ({ minHeight = 0, scheme = 'dark' } = {}) => docPage({ env, scheme, minHeight, label: 'Terms and disclaimer', path: '/terms', toc: TERMS_TOC, article: termsArticle(env) });
}
