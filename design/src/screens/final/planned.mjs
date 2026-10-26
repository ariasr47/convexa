// Final · Convexa v1 — the Planned section: one row per planned public-data tool, in the order of
// docs/public-data/CANDIDATES.md and design/src/data/tools.mjs (liquidity, calendar, off-exchange volume,
// insider clusters, 13F holders, XBRL figures, peers, signal track record, technical readings). Each row:
// the spec card (./planned-spec.mjs), staging (the demo account, sample), production as it would ship
// (live public data; for a blocked tool its design target, labelled), phone, and every state. The tools
// are recomposed per tool from the v5 charted forms (screens/v5/tools-v5.mjs) on their host pages.
import { icon } from '../../lib.mjs';
import { provChip, stateTag } from '../../components/data-states.mjs';
import { thirdPartyFrame } from '../../components/charts.mjs';
import { statesBoard } from '../v4/kit.mjs';
import { PL_CSS, env, frameState, retry, demoLink, section, boardNote, marketsHost, noteHost, scorecardHost, techHost } from './planned-kit.mjs';
import { calendarChart, checkTag, clusterStats, clustersChart, holdersChart, liquidityChart, liquidityStrip, otcChart, otcData, peersChart, signalsChart, taReadings, xbrlCheck, xbrlHistory } from './planned-charts.mjs';
import { CALENDAR_SPEC, CLUSTERS_SPEC, HOLDERS_SPEC, LIQUIDITY_SPEC, OTC_SPEC, PEERS_SPEC, SIGNALS_SPEC, TA_SPEC, XBRL_SPEC } from './planned-spec.mjs';
import { sampleTaChart } from './ticker-tech.mjs';

const PROD = env('prod'), DEMO = env('demo'), TARGET = env('target');
const PLAUSIBLE = 'Values are plausible public-record figures drawn for the design; the build fetches them.';
const DEMO_NOTE = 'Staging · the demo account on the Oct 7, 2026 scenario. Every value is sample data.';
const msg = (metric, state, text, cause = '', action = '', stateText = '') => frameState(state, { metric, height: 130, text, cause, action, stateText });
const nc = (what) => `<strong style="font-size: 13px;">SEC filings aren’t set up on this site yet.</strong><span class="dline">${what} EDGAR asks every program that reads it to identify itself with a contact address; this site hasn’t been given one.</span><details class="dop"><summary>For the site’s operator</summary><span class="mono" style="font-size: 11px; color: var(--steel);">Set SEC_USER_AGENT on the API</span></details>`;
const offFrame = (metric, src) => msg(metric, 'off', 'Public data is switched off on this server.', `${src} come through Convexa’s API, which has public data turned off.`);
const B = (id, title, w, h, body, opts) => ({ id, title, w, h, body, ...(opts ? { opts } : {}) });

// =================================================================================================
// 1 · Liquidity — /research/markets
// =================================================================================================
export const liqSection = (e) => section({ id: 'liquidity', title: 'Liquidity', lead: 'How much money the Fed’s balance sheet leaves in the system after the Treasury’s cash account and overnight reverse repo. When the Treasury rebuilds its cash, it drains reserves the same way the Fed shrinking would.', tag: e.demo ? '' : stateTag('computed', 'Computed · week to Oct 7'), body: `${liquidityStrip(e)}${liquidityChart(e)}` });
const liqBody = (e) => (o) => marketsHost(e, { ...o, on: 'liquidity', body: liqSection(e), note: e.demo ? DEMO_NOTE : `<b>New section on /research/markets</b>, under Positioning (Rates and Positioning are on the Research · Markets row). ${PLAUSIBLE}` });
function liqStates(o) {
  const M = 'Net liquidity, weekly';
  const items = [
    { name: 'Loading · final size', tag: ['loading'], when: 'First paint while /api/public-data/markets answers; the frame holds its height (CLS 0).', html: frameState('loading', { metric: M, height: 150 }) },
    { name: 'Computed · weekly', tag: ['computed', 'Computed · weekly'], when: 'All three inputs exist for the latest H.4.1 Wednesday. The claim is computed from the plotted series.', html: liquidityStrip(PROD) },
    { name: 'Delayed by source', tag: ['delayed', 'Delayed by source · H.4.1'], when: 'The Fed moves the H.4.1 for a holiday. Last week’s figure stays, current to its own date.', html: `<span class="dline">The H.4.1 for Wed Nov 25 is published Fri Nov 27 this week (Thanksgiving). Showing the week to Nov 18.</span>` },
    { name: 'Last good copy', tag: ['stale'], when: 'One input failed this cycle; the earlier net stays dimmed with when it was fetched.', html: `<div class="dwarn" role="status">${icon('warn', 14)}<span class="dline">The Treasury’s Daily Treasury Statement didn’t answer at 16:10 ET; showing the net computed Oct 8 at 16:40 ET.</span></div>${stateTag('stale', 'Last good copy · week to Oct 7')}` },
    { name: 'Source down', tag: ['unavailable', 'Source down · Fed'], when: 'The Fed’s download didn’t answer and nothing is cached: unknown, not empty. Rates and positioning still show.', html: msg(M, 'unavailable', 'Liquidity is unavailable right now.', 'The Federal Reserve’s H.4.1 download didn’t answer and there is no earlier copy to show. Convexa asks again in 30 minutes.') },
    { name: 'Couldn’t load', tag: ['error'], when: 'Convexa’s API didn’t answer.', html: msg(M, 'error', 'Liquidity didn’t load.', 'Convexa’s server didn’t answer at 14:10 UTC.', retry) },
    { name: 'Nothing yet', tag: ['empty'], when: 'A fresh deploy with no H.4.1 week and DTS day on the same date.', html: msg(M, 'empty', 'Nothing to net yet.', 'The panel needs one H.4.1 week and a Daily Treasury Statement for the same Wednesday; the next lands Thursday.', '', 'Nothing yet') },
    { name: 'Off', tag: ['off'], when: 'PUBLIC_DATA=off on this server. No retry.', html: offFrame(M, 'Fed, Treasury and NY Fed figures') },
    { name: 'Demo', tag: ['demo'], when: 'Staging: dashed and hatched, “Demo · shaped like …”, scenario date; no live tag.', html: liquidityStrip(DEMO) },
  ];
  return statesBoard({ ...o, title: 'Liquidity · states', lead: 'Three public sources netted into one weekly figure. A failure of one input never blanks the rest of Markets. Words from the P-2 vocabulary; every non-ready frame names its metric (P-10).', trace: 'PT-01, DB-04, TL-01', items });
}

// =================================================================================================
// 2 · Calendar — /research/markets
// =================================================================================================
export const calSection = (e) => section({ id: 'coming-up', title: 'Coming up', lead: 'Macro releases and the followed companies’ results, next six weeks. A results date makes its note due; the FOMC makes every note with a valuation due, because it moves the discount rate.', tag: e.demo ? '' : stateTag('current', 'Scheduled · read Oct 14'), body: calendarChart(e) });
const calBody = (e) => (o) => marketsHost(e, { ...o, on: 'coming-up', body: calSection(e), note: e.demo ? DEMO_NOTE : `<b>New section on /research/markets</b>, last on the page. Results dates come from the 14 notes (research/); windows are estimated from EDGAR filing history. ${PLAUSIBLE}` });
function calStates(o) {
  const M = 'Releases and results, next six weeks';
  const items = [
    { name: 'Loading · final size', tag: ['loading'], when: 'First paint.', html: frameState('loading', { metric: M, height: 150 }) },
    { name: 'Scheduled', tag: ['current', 'Scheduled'], when: 'Every agency schedule read within its refresh window (daily).', html: `<div class="pl-cal" style="grid-template-columns: 1fr;"><div><span class="wk">Oct 26–30</span><div class="ev macro"><span class="d">Oct 28</span><b>FOMC statement</b><span class="s">Fed · 2:00 PM ET</span><span class="tr">${icon('calendar', 11)}Makes due: every valued note</span></div></div></div>` },
    { name: 'Estimated window', tag: ['computed', 'Estimated'], when: 'No announced date: a dashed window from the company’s last four 10-Q and 10-K dates. It becomes a date when the company announces one.', html: `<div class="pl-cal" style="grid-template-columns: 1fr;"><div><div class="ev est"><span class="d">Oct 27–30</span><b>AMZN Q3 results</b><span class="s">Estimated from filing history · last four: Oct 30, Jul 30, May 1, Feb 6</span></div></div></div>` },
    { name: 'Moved by source', tag: ['delayed', 'Moved by source'], when: 'An agency moved a release: the new date, and where it moved from.', html: `<span class="dline">BLS moved the September CPI from Oct 14 to Oct 15. The new date is on the calendar and on the notes it touches.</span>` },
    { name: 'Not set up · estimates', tag: ['notConfigured'], when: 'SEC_USER_AGENT unset: no filing history to estimate from. Rows fall back to the notes’ own dates.', html: `<span class="dline" style="font-size: 13px;">Results dates come from the notes only. Estimating the rest needs SEC filings, which aren’t set up on this site yet.</span>` },
    { name: 'Last good copy', tag: ['stale'], when: 'A schedule failed to refresh.', html: `<div class="dwarn" role="status">${icon('warn', 14)}<span class="dline">BEA’s schedule didn’t answer this morning; showing the copy read Oct 13.</span></div>` },
    { name: 'Couldn’t load', tag: ['error'], when: 'Convexa’s API didn’t answer. The notes keep their own dates.', html: msg(M, 'error', 'The calendar didn’t load.', 'Convexa’s server didn’t answer. Each note still lists its own dates.', retry) },
    { name: 'Nothing scheduled', tag: ['empty'], when: 'A quiet week says so in its column; six empty weeks teach what will appear.', html: msg(M, 'empty', 'Nothing scheduled in the next six weeks.', 'Fed, BLS, BEA and Treasury releases and the followed companies’ results appear here as their dates are set.', '', 'Nothing yet') },
    { name: 'Demo', tag: ['demo'], when: 'Staging: the demo’s six names on sample dates.', html: `<span class="dline">Sample schedule around the Oct 7 scenario; dashed and hatched, “Demo · shaped like agency schedules and EDGAR filing history”.</span>` },
  ];
  return statesBoard({ ...o, title: 'Calendar · states', lead: 'Three kinds of date with three looks: a published schedule, a date from the note, and an estimated window. An estimate never looks like an announcement.', trace: 'PT-02, TL-03, TL-04', items });
}

// =================================================================================================
// 3 · Off-exchange volume — /ticker/:symbol/research
// =================================================================================================
const otcSection = (e) => section({ id: 'off-exchange', title: 'Where it traded', lead: 'Shares that changed hands away from the exchanges each week: in alternative trading systems, and with wholesalers and dealers. A free, late stand-in for block-trade data.', tag: e.demo ? '' : stateTag('delayed', 'Delayed by source · 2 weeks'), body: `${otcChart(e)}<p class="pl-foot">FINRA owns and is the source of this data. Shown free for non-commercial personal use; please don’t redistribute it.</p>` });
const otcBody = (e) => (o) => noteHost(e, { ...o, body: otcSection(e), note: e.demo ? DEMO_NOTE : `<b>New section in the public-record band under the NVDA note</b> (the note is on the Ticker · Note row). Ships once FINRA’s display terms are confirmed. ${PLAUSIBLE}` });
function otcStates(o) {
  const M = 'NVDA off-exchange volume, weekly'; const L = otcData(PROD).slice(-1)[0];
  const items = [
    { name: 'Loading · final size', tag: ['loading'], when: 'First paint while /api/public-data/tickers/NVDA answers.', html: frameState('loading', { metric: M, height: 150 }) },
    { name: 'Delayed by source', tag: ['delayed', 'Delayed by source · 2 weeks'], when: 'Always: FINRA publishes Tier 1 names two weeks after the week ends.', html: `<span class="dval" style="font-size: 22px;">${L.ats + L.non}M<span class="steel" style="font-size: 13px; font-family: 'IBM Plex Sans';"> shares, week of Sep 21</span></span><span class="dline">ATS ${L.ats}M · non-ATS ${L.non}M · the week of Sep 28 publishes Oct 19.</span>` },
    { name: 'Delayed · Tier 2', tag: ['delayed', 'Delayed by source · 4 weeks'], when: 'Names outside NMS Tier 1: FINRA publishes four weeks late.', html: `<span class="dline">A Tier 2 name: FINRA publishes this week four weeks after it ends, so the latest week here is Sep 7.</span>` },
    { name: 'Nothing reported', tag: ['empty'], when: 'FINRA lists no off-exchange trades for the symbol that week.', html: msg(M, 'empty', 'No off-exchange volume reported for this week.', 'FINRA lists a symbol only when an ATS or another off-exchange venue reports trades in it.', '', 'Nothing yet') },
    { name: 'Last good copy', tag: ['stale'], when: 'FINRA failed this cycle.', html: `<div class="dwarn" role="status">${icon('warn', 14)}<span class="dline">FINRA didn’t answer at 06:00 UTC; showing data fetched Oct 13 at 06:00 UTC.</span></div>` },
    { name: 'Source down', tag: ['unavailable'], when: 'FINRA down, nothing cached. The short-data cards beside it keep their own states.', html: msg(M, 'unavailable', 'Off-exchange volume is unavailable right now.', 'FINRA’s OTC Transparency files didn’t answer and there is no earlier copy. Convexa asks again in an hour.') },
    { name: 'Couldn’t load', tag: ['error'], when: 'Convexa’s API didn’t answer.', html: msg(M, 'error', 'Off-exchange volume didn’t load.', 'Convexa’s server didn’t answer. The note above doesn’t depend on it.', retry) },
    { name: 'Off', tag: ['off'], when: 'PUBLIC_DATA=off. If FINRA’s terms rule out public display, the section is removed rather than shown off.', html: offFrame(M, 'FINRA figures') },
    { name: 'Demo', tag: ['demo'], when: 'Staging: twelve sample weeks, dashed and hatched.', html: `<span class="dline">Sample weeks ending Sep 14, “Demo · shaped like FINRA OTC Transparency”.</span>` },
  ];
  return statesBoard({ ...o, title: 'Off-exchange volume · states', lead: 'Weekly shares from FINRA, always late by design. The chart counts shares, never a share of all volume: that total needs consolidated volume, which no free source licenses for display.', trace: 'PT-03, DB-07, TL-05, TKR-07', items });
}

// =================================================================================================
// 4 · Insider clusters — /ticker/:symbol/research
// =================================================================================================
const clSection = (e, compact = false) => section({ id: 'insiders', title: `Insider trades · ${e.demo ? '6' : '12'} months`, lead: 'Every Form 4 by insider and date. A cluster is three or more insiders buying on the open market within ten days; sales under pre-set 10b5-1 plans never count.', tag: e.demo ? '' : stateTag('computed', 'Computed from Form 4'), body: clustersChart(e, { compact }) });
const clBody = (e, compact = false) => (o) => noteHost(e, { ...o, body: clSection(e, compact), note: e.demo ? DEMO_NOTE : `<b>The Insider trades card, expanded into the public-record band</b>, live now that SEC_USER_AGENT is set on production. Roles, not names. ${PLAUSIBLE}` });
function clStates(o) {
  const M = 'NVDA insider trades, 12 months'; const s = clusterStats(PROD);
  const items = [
    { name: 'Not set up', tag: ['notConfigured'], when: 'If SEC_USER_AGENT is unset (production has it set).', html: nc('Insider trades come from SEC Form 4, through EDGAR.') },
    { name: 'Loading · final size', tag: ['loading'], when: 'First paint.', html: frameState('loading', { metric: M, height: 150 }) },
    { name: 'No cluster', tag: ['empty', 'No cluster'], when: 'No buying cluster in the window. Says so, and what one would be.', html: `<span class="dval" style="font-size: 20px;">No cluster</span><span class="dline">${s.sales.length} sales by ${new Set(s.sales.map((x) => x[0])).size} insiders in 12 months, all under 10b5-1 plans; no open-market purchases. A cluster is three or more insiders buying within ten days.</span>` },
    { name: 'Buying cluster', tag: ['computed', 'Cluster · 3 insiders'], when: 'Three or more insiders bought on the open market within ten days. Named by role; each trade links to its Form 4 in the table twin, not on the plot (S2-Q2, S2-Q3).', html: `<strong style="font-size: 13px;">Three directors bought within six days (Sep 14–19).</strong><span class="dline">Open-market purchases, outside any plan. Roles only; names stay in the filings.</span>` },
    { name: 'Filed late', tag: ['delayed', 'Delayed by source · up to 2 days'], when: 'A Form 4 lands up to two business days after the trade; the dot sits on the trade date.', html: `<span class="dline">Trade Oct 9, filed Oct 13. The dot sits on Oct 9; the as-of line counts filings by Oct 13.</span>` },
    { name: 'Last good copy', tag: ['stale'], when: 'EDGAR failed this cycle.', html: `<div class="dwarn" role="status">${icon('warn', 14)}<span class="dline">SEC EDGAR didn’t answer at 14:00 UTC; showing data fetched at 13:00 UTC.</span></div>` },
    { name: 'Source down', tag: ['unavailable'], when: 'EDGAR down, nothing cached: unknown, not empty.', html: msg(M, 'unavailable', 'Insider trades are unavailable right now.', 'SEC EDGAR didn’t answer and there is no earlier copy. Unknown, not empty.') },
    { name: 'Couldn’t load', tag: ['error'], when: 'Convexa’s API didn’t answer.', html: msg(M, 'error', 'Insider trades didn’t load.', 'Convexa’s server didn’t answer. The note above doesn’t depend on it.', retry) },
    { name: 'Demo', tag: ['demo'], when: 'Staging: a sample with one buying cluster, so the form is visible.', html: `<span class="dline">Sample Form 4 rows, “Demo · shaped like SEC Form 4”, scenario of Oct 7.</span>` },
  ];
  return statesBoard({ ...o, title: 'Insider clusters · states', lead: 'Placed by trade date (DB-08). Ring = sale, filled = open-market purchase: shape carries the kind, never hue (P-11).', trace: 'PT-04, DB-08, TL-06', items });
}

// =================================================================================================
// 5 · Fund holdings (13F) — /ticker/:symbol/research
// =================================================================================================
const hStrip = (e) => `<div class="pl-strip${e.demo ? ' demo' : ''}">${(e.demo ? [['All 13F filers', '61.2%', 'of sample shares · ▲ 0.3 pts'], ['Filers reporting', '3,140', 'sample quarter'], ['Next quarter', 'Window open', 'sample deadline']] : [['All 13F filers', '67.8%', 'of shares outstanding · ▲ 0.4 pts on the quarter'], ['Filers reporting NVDA', '5,212', 'quarter to Jun 30'], ['Quarter to Sep 30', '312 filed', 'of about 5,400 · due Mon Nov 16']]).map(([l, v, s]) => `<div><span class="caps">${l}</span><span class="v">${v}</span><span class="s">${s}</span></div>`).join('')}</div>`;
const hSection = (e) => section({ id: 'holders', title: 'Who holds it', lead: 'The largest institutional holders at the last complete quarter, from their 13F filings, and what each added or cut. 13F arrives up to 45 days after the quarter, by law.', tag: e.demo ? '' : stateTag('delayed', 'Delayed by law · 45 days'), body: `${hStrip(e)}${holdersChart(e)}` });
const hBody = (e, labelW) => (o) => noteHost(e, { ...o, body: labelW ? section({ id: 'holders', title: 'Who holds it', lead: 'The largest institutional holders at the last complete quarter, from their 13F filings. 13F arrives up to 45 days after the quarter, by law.', tag: stateTag('delayed', 'Delayed by law · 45 days'), body: `${hStrip(e)}${holdersChart(e, { labelW })}` }) : hSection(e), note: e.demo ? DEMO_NOTE : `<b>New section in the public-record band under the NVDA note</b>. Holder names are placeholders on this board; the build shows each filer’s name as filed. ${PLAUSIBLE}` });
function hStates(o) {
  const M = 'NVDA largest 13F holders';
  const items = [
    { name: 'Delayed by law', tag: ['delayed', 'Delayed by law · 45 days'], when: 'Always: managers file up to 45 days after the quarter.', html: `<span class="dline">Quarter to Jun 30, filed by Aug 14. What anyone bought or sold since Jun 30 isn’t in it.</span>` },
    { name: 'Window open', tag: ['current', 'Window open'], when: 'Oct 1 – Nov 16: the new quarter is arriving. The chart stays on the last complete quarter until the deadline; a line counts what has arrived.', html: `<span class="dline">312 of about 5,400 managers have filed for the quarter to Sep 30. They’re due Mon Nov 16; the chart switches quarters then.</span>` },
    { name: 'No 13F filer', tag: ['empty'], when: 'No manager reports the security (small names, many funds).', html: msg(M, 'empty', 'No 13F filer reports this security.', '13F covers US-listed stocks held by managers with over $100M; many small names have none.', '', 'Nothing yet') },
    { name: 'Not set up', tag: ['notConfigured'], when: 'SEC_USER_AGENT unset.', html: nc('Fund holdings come from 13F filings, through EDGAR.') },
    { name: 'Loading · final size', tag: ['loading'], when: 'First paint.', html: frameState('loading', { metric: M, height: 150 }) },
    { name: 'Last good copy', tag: ['stale'], when: 'EDGAR failed this cycle.', html: `<div class="dwarn" role="status">${icon('warn', 14)}<span class="dline">SEC EDGAR didn’t answer at 02:00 UTC; showing holdings read Oct 13.</span></div>` },
    { name: 'Couldn’t load', tag: ['error'], when: 'Convexa’s API didn’t answer.', html: msg(M, 'error', 'Fund holdings didn’t load.', 'Convexa’s server didn’t answer. The note above doesn’t depend on it.', retry) },
    { name: 'Off', tag: ['off'], when: 'PUBLIC_DATA=off.', html: offFrame(M, '13F holdings') },
    { name: 'Demo', tag: ['demo'], when: 'Staging: six sample holders.', html: `<span class="dline">“Demo · shaped like SEC 13F-HR information tables”, scenario of Oct 7.</span>` },
  ];
  return statesBoard({ ...o, title: 'Fund holdings (13F) · states', lead: 'Change in points of shares outstanding, so a split or a buyback can’t read as buying. ▲/▼ with the number: company facts stay neutral, never green or red.', trace: 'PT-05, TL-07', items });
}

// =================================================================================================
// 6 · Figures against the filing (XBRL) — /ticker/:symbol/research
// =================================================================================================
const xSection = (e) => section({ id: 'checked', title: 'Checked against the filing', lead: 'Every figure this note states, beside the value the company tagged in its filing for the same period. The note keeps its own figure; where they differ, both are shown.', tag: e.demo ? '' : stateTag('computed', 'Checked Oct 14'), body: `${xbrlCheck(e)}${xbrlHistory(e)}` });
const xBody = (e) => (o) => noteHost(e, { ...o, body: xSection(e), note: e.demo ? DEMO_NOTE : `<b>New section in the public-record band under the NVDA note</b>, once SEC_USER_AGENT is set. Figures are the note’s and the 10-Q’s (quarter to Jul 26, 2026), as on the Note and Filings rows. ${PLAUSIBLE}` });
function xStates(o) {
  const M = 'NVDA note figures against the 10-Q';
  const items = [
    { name: 'Per-row checks', tag: ['computed', 'Checked against the filing'], when: 'Every figure resolved. Glyph and word carry the result; “Differs” adds burnt orange, never red.', html: `<div style="display: flex; flex-wrap: wrap; gap: 8px;">${checkTag('matches')}${checkTag('differs · 0.2 pts')}${checkTag('computed')}${checkTag('not tagged')}</div><span class="dline">Matches at the note’s precision · Differs, with the gap · Computed from tagged inputs · Not tagged: no standard concept, the note cites the filing.</span>` },
    { name: 'Facts not in yet', tag: ['delayed', 'Facts not in yet'], when: 'The 10-Q is filed but its XBRL facts haven’t reached the API (usually within a day).', html: `<span class="dline">The 10-Q filed Nov 19 is on EDGAR; its tagged figures usually reach the API within a day. Checked against the previous 10-Q until then.</span>` },
    { name: 'Not set up', tag: ['notConfigured'], when: 'If SEC_USER_AGENT is unset (production has it set).', html: nc('Figures are checked against the SEC’s company facts, through EDGAR.') },
    { name: 'Loading · final size', tag: ['loading'], when: 'First paint.', html: frameState('loading', { metric: M, height: 150 }) },
    { name: 'Couldn’t load', tag: ['error'], when: 'The company-facts request failed: an error, never shown as “matches” or “not yet”.', html: msg(M, 'error', 'Couldn’t load the filed figures.', 'The SEC’s company-facts request failed at 10:12 UTC (HTTP 503). The note’s figures are unchanged.', retry) },
    { name: 'No concept on any figure', tag: ['empty'], when: 'A note whose figures carry no XBRL concept yet.', html: msg(M, 'empty', 'This note’s figures aren’t linked to the filing yet.', 'Each figure needs its concept (for example us-gaap:Revenues) in the note’s front matter; then its filed value appears beside it.', '', 'Nothing yet') },
    { name: 'Research check · author', tag: ['computed', 'Before publishing'], when: 'npm run verify lists the same differences for the author and fails on one it can’t explain.', html: `<span class="mono" style="font-size: 12px; color: var(--phosphor);">research/NVDA/2026-10-13-initiation.md</span><span class="dline">Operating margin, GAAP · Q2 FY27: the note says 66.2%, the 10-Q tags 66.37%. Fix it or mark it “as reported in the 8-K”.</span>` },
    { name: 'Demo', tag: ['demo'], when: 'Staging: four sample figures against a sample 10-Q.', html: `<span class="dline">“Demo · shaped like SEC XBRL company facts”, scenario of Oct 7.</span>` },
  ];
  return statesBoard({ ...o, title: 'Figures against the filing · states', lead: 'A check, not an editor: the note’s words and figures are never rewritten. Readers see the comparison on the note; the author sees it before publishing.', trace: 'PT-06, TL-08, TL-09', items });
}

// =================================================================================================
// 7 · Peers — /ticker/:symbol/research
// =================================================================================================
const pSection = (e, compact = false) => section({ id: 'peers', title: 'Against its peers', lead: 'One reported figure across the note’s peer list for the same calendar quarter, from each company’s tagged filing.', tag: e.demo ? '' : stateTag('computed', 'Computed · CY2026 Q2'), body: peersChart(e, { compact }) });
const pBody = (e, compact = false) => (o) => noteHost(e, { ...o, body: pSection(e, compact), note: e.demo ? DEMO_NOTE : `<b>New section in the public-record band under the NVDA note</b>, once SEC_USER_AGENT is set; the peer list comes from the note. NVDA’s figures match its 10-Q; the peers’ are plausible values drawn for the design; the build fetches them.` });
function pStates(o) {
  const M = 'NVDA against its peers, CY2026 Q2';
  const items = [
    { name: 'Computed', tag: ['computed', 'Computed · CY2026 Q2'], when: 'At least four peers have filed for the calendar quarter.', html: `<span class="dline">9 of 9 filers. NVDA filled; peers as rings; NVDA and the extremes labelled, every value in the table.</span>` },
    { name: 'Some peers not filed', tag: ['delayed', '2 of 9 not filed'], when: 'Peers that haven’t filed for the quarter are named, never dropped silently.', html: `<span class="dline">ADI and MRVL haven’t filed for the calendar quarter yet; their dots appear when they do.</span>` },
    { name: 'Too few peers', tag: ['empty'], when: 'Fewer than four peers have filed.', html: msg(M, 'empty', 'Not enough peers have filed this quarter.', 'A peer comparison needs at least four filers with the figure for the same calendar quarter; three have filed.', '', 'Nothing yet') },
    { name: 'Not set up', tag: ['notConfigured'], when: 'SEC_USER_AGENT unset.', html: nc('Peer figures come from the SEC’s XBRL frames, through EDGAR.') },
    { name: 'Loading · final size', tag: ['loading'], when: 'First paint.', html: frameState('loading', { metric: M, height: 150 }) },
    { name: 'Couldn’t load', tag: ['error'], when: 'The frames request failed.', html: msg(M, 'error', 'Peer figures didn’t load.', 'The SEC’s frames request failed. The note above doesn’t depend on it.', retry) },
    { name: 'Negative growth', tag: ['computed'], when: 'A peer shrank: its dot sits left of a drawn zero line and its label carries the sign (P-11).', html: `<span class="dline">INTC +1.9% sits just right of zero; a shrinking peer would read “−4.5%” left of the line.</span>` },
    { name: 'Demo', tag: ['demo'], when: 'Staging: five sample peers.', html: `<span class="dline">“Demo · shaped like SEC XBRL frames”, scenario of Oct 7.</span>` },
  ];
  return statesBoard({ ...o, title: 'Peers · states', lead: 'Two dot strips, one per question. Calendar quarters, with fiscal-quarter mapping explained under the chart.', trace: 'PT-07, DB-09, TL-10', items });
}

// =================================================================================================
// 8 · Signal track record — /research/scorecard (blocked)
// =================================================================================================
const sigBody = (e) => (o) => scorecardHost(e, { ...o, body: signalsChart(e), note: e.demo ? DEMO_NOTE : '<b>Design target, not data.</b> Production shows this section as Not live · price source today (Research · Scorecard row) and until Convexa holds a licensed daily price history and the scanner’s setups. Every value here is illustrative.' });
function sigStates(o) {
  const M = 'Signal track record';
  const items = [
    { name: 'Not live · price source', tag: ['notLive', 'Not live · price source'], when: 'Production today (shipped): what it would show, why it’s off, a link to the demo.', html: `<p class="dline" style="margin: 0;"><strong style="color: var(--phosphor);">Would show</strong> how often each scanner setup reached its level after costs, with intervals.</p><p class="dline" style="margin: 0;"><strong style="color: var(--phosphor);">Off because</strong> grading needs daily prices licensed for public display, and the setups come from the options feed this site doesn’t run.</p>${demoLink('/research/scorecard#signals')}` },
    { name: 'Design target', tag: ['sample', 'Design target · illustrative'], when: 'This board only: the target drawn on illustrative values, dashed and hatched.', html: `<span class="dline">Never shipped as data. The frame’s border and tag say so (P-3, P-8).</span>` },
    { name: 'Too few to judge', tag: ['empty', 'Too few to judge'], when: 'A setup family with fewer than 20 graded setups: its row says so instead of a rate.', html: `<span class="dline">Term flip · 11 graded. Too few to judge; shown once 20 have been graded.</span>` },
    { name: 'Still open', tag: ['computed', 'Open · not graded'], when: 'Setups from the last five sessions can’t be graded yet.', html: `<span class="dline">6 setups from Oct 8–14 are still open; they’re graded on Oct 21.</span>` },
    { name: 'Loading · final size', tag: ['loading'], when: 'First paint.', html: frameState('loading', { metric: M, height: 150 }) },
    { name: 'Couldn’t load', tag: ['error'], when: 'Grades failed to load.', html: msg(M, 'error', 'The track record didn’t load.', 'Convexa’s server didn’t answer. Forecast calibration above doesn’t depend on it.', retry) },
    { name: 'Demo', tag: ['demo'], when: 'Staging: the demo’s authored setups graded on sample prices.', html: signalsChart(DEMO).replace(/<details[\s\S]*<\/details>/, '') },
  ];
  return statesBoard({ ...o, title: 'Signal track record · states', lead: 'Blocked twice in production: by a daily price history licensed for public display, and by the scanner’s setups, which need the options feed. Production keeps the shipped Not live panel.', trace: 'PT-08, DB-10, TL-12', items });
}

// =================================================================================================
// 9 · Technical readings — /ticker/:symbol/technical-analysis (blocked in production)
// =================================================================================================
const taProd = (o) => techHost(TARGET, { ...o, note: '<b>Design target for Convexa’s readings, not data.</b> TradingView’s chart is live today (Ticker · Technical row); the readings beside it show Not live · price source until Convexa holds a daily price history licensed for public display. Reading values are illustrative.', body: `<div style="display: flex; flex-direction: column; gap: 8px;"><span class="caps">Technical analysis · NVDA</span><p class="tch-lead">TradingView draws the chart from its own prices. Convexa’s readings below would come from a daily price history licensed to Convexa.</p></div><div class="pl-tpr">${thirdPartyFrame({ ticker: 'NVDA', height: 560, phoneHeight: 480 })}${section({ id: 'readings', title: 'Readings Convexa computes', body: taReadings(TARGET) })}</div>` });
const taDemo = (o) => techHost(DEMO, { ...o, note: DEMO_NOTE, body: `<div style="display: flex; flex-direction: column; gap: 8px;"><span class="caps">Technical analysis · NVDA</span><p class="tch-lead">Computed from the demo’s 60 sample daily bars. They describe the trend; they are not calls to buy or sell.</p></div>${sampleTaChart({ sym: 'NVDA', height: 260 })}${section({ id: 'readings', title: 'Readings Convexa computes', body: taReadings(DEMO) })}` });
function taStates(o) {
  const items = [
    { name: 'Not live · price source', tag: ['notLive', 'Not live · price source'], when: 'Production today: the readings need a licensed daily price history. Says what they’d be and links to the demo.', html: `<p class="dline" style="margin: 0;"><strong style="color: var(--phosphor);">Would show</strong> trend against EMA 20 and 50, RSI 14, ATR 14, 20-day realized volatility, support and resistance, and relative strength against SPY and SMH, computed by Convexa.</p><p class="dline" style="margin: 0;"><strong style="color: var(--phosphor);">Off because</strong> Convexa has no daily prices licensed to it. TradingView’s chart is display-only: nothing is read from it.</p>${demoLink('/ticker/NVDA/technical-analysis')}` },
    { name: 'Live · TradingView', tag: ['thirdParty'], when: 'The chart beside the readings, production (shipped, P-14).', html: thirdPartyFrame({ ticker: 'NVDA', height: 200, phoneHeight: 200, mini: true }) },
    { name: 'Design target', tag: ['sample', 'Design target · illustrative'], when: 'This board only.', html: `<span class="dline">The production board’s readings are illustrative, dashed and hatched; never shipped as data.</span>` },
    { name: 'Insufficient history', tag: ['empty', 'Insufficient history'], when: 'A reading with fewer bars than its window: the count, never a zero.', html: `<div class="pl-rd" style="grid-template-columns: repeat(2, minmax(0, 1fr));"><div><span class="caps">Realized vol · 20 days</span><span class="dnan" style="font-size: 14px;">Insufficient history</span><span class="s">12 of 21 bars</span></div><div><span class="caps">Relative strength · 3 months</span><span class="dnan" style="font-size: 14px;">Insufficient history</span><span class="s">40 of 63 bars</span></div></div>` },
    { name: 'Loading · final size', tag: ['loading'], when: 'First paint.', html: frameState('loading', { metric: 'NVDA readings on the last daily bar', height: 120 }) },
    { name: 'Couldn’t load', tag: ['error'], when: 'Bars failed to load (staging: Retry demo).', html: msg('NVDA readings on the last daily bar', 'error', 'The daily bars didn’t load.', 'The demo’s scenario file for NVDA didn’t arrive.', '<button class="btn secondary sm" type="button">Retry demo</button>') },
    { name: 'Demo', tag: ['demo'], when: 'Staging: computed in the browser from the 60 sample bars.', html: `<span class="dline">EMA 20/50, RSI 14, ADX 14 and ATR 14 ship today on staging; realized vol, support and resistance and relative strength are the planned additions.</span>${provChip('Demo · shaped like daily bars', 'dashed')}` },
  ];
  return statesBoard({ ...o, title: 'Technical readings · states', lead: 'TradingView’s frame is theirs and live; Convexa’s readings are ours and blocked in production. The two never mix: no reading is computed from TradingView’s chart.', trace: 'PT-09, TL-11, TKR-05, DS-03', items });
}

// =================================================================================================
// Rows
// =================================================================================================
const P = 'planned';
export const ROWS = [
  { key: 'planned-liquidity', section: P, label: 'Planned · Liquidity', css: PL_CSS, specH: 1737, spec: LIQUIDITY_SPEC, boards: [
    B('staging', 'Staging · demo account', 1440, 1412, liqBody(DEMO)),
    B('production', 'Production · as it would ship', 1440, 1424, liqBody(PROD)),
    B('phone', 'Phone · production', 390, 2215, liqBody(PROD)),
    B('states', 'States', 1440, 1845, liqStates),
  ] },
  { key: 'planned-calendar', section: P, label: 'Planned · Calendar', css: PL_CSS, specH: 1659, spec: CALENDAR_SPEC, boards: [
    B('staging', 'Staging · demo account', 1440, 1304, calBody(DEMO)),
    B('production', 'Production · as it would ship', 1440, 1645, calBody(PROD)),
    B('phone', 'Phone · production', 390, 3105, calBody(PROD)),
    B('states', 'States', 1440, 1546, calStates),
  ] },
  { key: 'planned-otc', section: P, label: 'Planned · Off-exchange volume', css: PL_CSS, specH: 1539, spec: OTC_SPEC, boards: [
    B('staging', 'Staging · demo account', 1440, 1256, otcBody(DEMO)),
    B('production', 'Production · as it would ship', 1440, 1286, otcBody(PROD)),
    B('phone', 'Phone · production', 390, 1814, otcBody(PROD)),
    B('states', 'States', 1440, 1803, otcStates),
  ] },
  { key: 'planned-clusters', section: P, label: 'Planned · Insider clusters', css: PL_CSS, specH: 1541, spec: CLUSTERS_SPEC, boards: [
    B('staging', 'Staging · demo account', 1440, 1240, clBody(DEMO)),
    B('production', 'Production · as it would ship', 1440, 1270, clBody(PROD)),
    B('phone', 'Phone · production', 390, 1808, clBody(PROD, true)),
    B('states', 'States', 1440, 1464, clStates),
  ] },
  { key: 'planned-holders', section: P, label: 'Planned · Fund holdings (13F)', css: PL_CSS, specH: 1472, spec: HOLDERS_SPEC, boards: [
    B('staging', 'Staging · demo account', 1440, 1276, hBody(DEMO)),
    B('production', 'Production · as it would ship', 1440, 1374, hBody(PROD)),
    B('phone', 'Phone · production', 390, 2026, hBody(PROD, 140)),
    B('states', 'States', 1440, 1647, hStates),
  ] },
  { key: 'planned-xbrl', section: P, label: 'Planned · Figures against the filing', css: PL_CSS, specH: 1574, spec: XBRL_SPEC, boards: [
    B('staging', 'Staging · demo account', 1440, 1498, xBody(DEMO)),
    B('production', 'Production · as it would ship', 1440, 1658, xBody(PROD)),
    B('phone', 'Phone · production', 390, 2631, xBody(PROD)),
    B('states', 'States', 1440, 1373, xStates),
  ] },
  { key: 'planned-peers', section: P, label: 'Planned · Peers', css: PL_CSS, specH: 1321, spec: PEERS_SPEC, boards: [
    B('staging', 'Staging · demo account', 1440, 1153, pBody(DEMO)),
    B('production', 'Production · as it would ship', 1440, 1183, pBody(PROD)),
    B('phone', 'Phone · production', 390, 1654, pBody(PROD, true)),
    B('states', 'States', 1440, 1250, pStates),
  ] },
  { key: 'planned-signals', section: P, label: 'Planned · Signal track record', css: PL_CSS, specH: 1369, spec: SIGNALS_SPEC, boards: [
    B('staging', 'Staging · demo account', 1440, 1165, sigBody(DEMO)),
    B('production', 'Production · design target (blocked)', 1440, 1195, sigBody(TARGET)),
    B('phone', 'Phone · production design target', 390, 1602, sigBody(TARGET)),
    B('states', 'States', 1440, 1562, sigStates),
  ] },
  { key: 'planned-ta', section: P, label: 'Planned · Technical readings', css: PL_CSS, specH: 1638, spec: TA_SPEC, boards: [
    B('staging', 'Staging · demo account', 1440, 1841, taDemo),
    B('production', 'Production · design target (blocked)', 1440, 1467, taProd),
    B('phone', 'Phone · production design target', 390, 2561, taProd),
    B('states', 'States', 1440, 1456, taStates),
  ] },
];
void boardNote;

/** The SEC record of a note's public-record band, in the order NotePublicPanels mounts it (SecRecordSections.tsx):
 *  insider trades, the figures against the filing, fund holdings and peers. The Note boards draw it under the
 *  note (fidelity DESK-15 and owner NO-4 A, 2026-10-25); each section's own row draws its states. */
export const publicRecordSections = (e) => `${clSection(e)}${xSection(e)}${hSection(e)}${pSection(e)}`;
export { env as plannedEnv } from './planned-kit.mjs';
