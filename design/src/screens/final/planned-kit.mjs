// Final · Planned — the shared kit for the planned public-data tools (docs/public-data/CANDIDATES.md):
// the three environments a planned board is drawn in, the host pages each tool would live on, the
// board note that says what a board shows, and a chart frame for non-ready states.
// Environments: 'prod' = production as it would ship (primary sources, solid frames, plausible public
// figures dated Oct 14, 2026); 'demo' = staging, the demo account on the Oct 7, 2026 scenario (dashed,
// hatched, "Demo · shaped like …"); 'target' = a blocked tool's design target in production (dashed and
// hatched, "Design target · illustrative", never passed off as data).
import { icon, finalPage, STAGING_DEMO_URL } from '../../lib.mjs';
import { chartFrame } from '../../chart-kit.mjs';
import { stateTag } from '../../components/data-states.mjs';
import { TT_CSS } from './ticker-tech.mjs';
import { calibChart, env as rcEnv } from './research-charts.mjs';

export const PL_CSS = `${TT_CSS}
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .pl-cap { display: flex; align-items: flex-start; gap: 4px 12px; padding: 12px clamp(16px, 3vw, 40px); border-bottom: 1px dashed var(--line-2); background: var(--ink-2); font: 500 12px/1.5 'IBM Plex Mono', monospace; color: var(--steel); }
  .pl-cap b { font-weight: 600; color: var(--phosphor); }
  .pl-page { padding-top: 28px; display: flex; flex-direction: column; gap: 24px; }
  .pl-h { display: flex; flex-direction: column; gap: 10px; }
  .pl-h h1 { margin: 0; font-size: clamp(30px, 3vw, 44px); letter-spacing: -0.02em; line-height: 1.05; }
  .pl-h .lead { margin: 0; max-width: 68ch; font-size: 15px; line-height: 1.55; color: var(--steel); text-wrap: pretty; }
  .pl-jump { display: flex; flex-wrap: wrap; gap: 6px 4px; align-items: center; padding: 8px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .pl-jump .lbl { font-size: 12px; color: var(--steel); margin-right: 6px; }
  .pl-jump a { display: inline-flex; align-items: center; min-height: 32px; padding: 0 10px; border-radius: 999px; font-size: 13px; color: var(--steel); text-decoration: none; }
  .pl-jump a[aria-current="true"] { color: var(--phosphor); font-weight: 600; box-shadow: inset 0 0 0 1px var(--phosphor); }
  .pl-lanes { display: flex; flex-direction: column; gap: 2px; margin-top: -6px; }
  .pl-lanes .ln { position: relative; height: 16px; }
  .pl-lanes .lb { position: absolute; left: 0; width: calc(var(--pl) - 10px); top: 0; text-align: right; font: 500 11px/16px 'IBM Plex Mono', monospace; color: var(--steel); }
  .pl-lanes .tr { position: absolute; left: var(--pl); right: var(--pr); top: 0; bottom: 0; }
  .pl-lanes .mk { position: absolute; top: 4px; width: 8px; height: 8px; transform: translateX(-50%); background: var(--steel); }
  .pl-lanes .mk.k-dot { border-radius: 50%; }
  .pl-lanes .mk.k-dia { transform: translateX(-50%) rotate(45deg); }
  .pl-lanes .mk.k-ring { border-radius: 50%; background: transparent; border: 1.5px solid var(--steel); box-sizing: border-box; }
  @container (max-width: 480px) { .pl-lanes .tr { right: var(--prn); } }
  .pl-sec { display: flex; flex-direction: column; gap: 14px; scroll-margin-top: 80px; }
  .pl-sec > header { display: flex; flex-direction: column; gap: 6px; }
  .pl-sec > header .row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
  .pl-sec h2 { margin: 0; font-family: 'Archivo', 'IBM Plex Sans', sans-serif; font-stretch: 112.5%; font-weight: 600; font-size: 24px; letter-spacing: -0.01em; }
  .pl-sec .sl { margin: 0; max-width: 72ch; font-size: 14px; line-height: 1.55; color: var(--steel); text-wrap: pretty; }
  .pl-2 { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: 16px; align-items: start; }
  .pl-2.even { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pl-stack { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .pl-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(190px, 100%), 1fr)); gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
  .pl-strip > div { background: var(--panel); padding: 12px 16px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .pl-strip .v { font: 500 22px/1.2 'IBM Plex Mono', monospace; }
  .pl-strip .s { font-size: 12px; line-height: 1.4; color: var(--steel); }
  .pl-strip.demo, .pl-strip.target { border-style: dashed; border-color: var(--steel-2); }
  .pl-mast { display: flex; flex-wrap: wrap; gap: 10px 28px; align-items: flex-end; }
  .pl-mast .who { flex: 999 1 420px; display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
  .pl-mast h1 { margin: 0; font-size: clamp(32px, 3vw, 44px); letter-spacing: -0.02em; line-height: 1; }
  .pl-note { display: flex; flex-direction: column; gap: 8px; padding: 16px 18px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); }
  .pl-note.demo { border-style: dashed; border-color: var(--steel-2); }
  .pl-note .t { margin: 0; font-family: 'Archivo', 'IBM Plex Sans', sans-serif; font-stretch: 112.5%; font-weight: 600; font-size: 18px; line-height: 1.3; }
  .pl-note .m { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; font-size: 12.5px; color: var(--steel); }
  .pl-band { display: flex; flex-direction: column; gap: 20px; padding-top: 8px; border-top: 1px solid var(--line-2); }
  .pl-band > .caps { color: var(--steel); }
  .pl-foot { margin: 0; font-size: 12px; line-height: 1.5; color: var(--steel); max-width: 90ch; }
  .pl-cal { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  .pl-cal > div { background: var(--ink-2); padding: 10px 10px 12px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .pl-cal .wk { font: 600 11px/1.3 'IBM Plex Mono', monospace; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); }
  .pl-cal .ev { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px; border-radius: 8px; border: 1px solid var(--line-2); background: var(--panel); font-size: 12.5px; line-height: 1.35; }
  .pl-cal .ev.est { border-style: dashed; background: transparent; }
  .pl-cal .ev.macro { box-shadow: inset 2px 0 0 var(--phosphor); }
  .pl-cal .ev .d { font: 500 11.5px/1.3 'IBM Plex Mono', monospace; color: var(--steel); }
  .pl-cal .ev b { font-weight: 600; color: var(--phosphor); }
  .pl-cal .ev .s { font-size: 11.5px; color: var(--steel); }
  .pl-cal .ev .tr { font-size: 11.5px; color: var(--phosphor); display: inline-flex; gap: 4px; align-items: center; }
  .pl-key { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12px; color: var(--steel); align-items: center; }
  .pl-key i { display: inline-block; width: 14px; height: 12px; border-radius: 3px; border: 1px solid var(--line-2); vertical-align: -2px; margin-right: 6px; background: var(--panel); }
  .pl-key i.est { border-style: dashed; background: transparent; }
  .pl-key i.macro { box-shadow: inset 2px 0 0 var(--phosphor); }
  .pl-chk { width: 100%; border-collapse: collapse; font-size: 13px; }
  .pl-chk th { text-align: left; font: 600 11px/1.4 'IBM Plex Mono', monospace; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); padding: 6px 10px; border-bottom: 1px solid var(--line-2); }
  .pl-chk td { padding: 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
  .pl-chk td.n { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .pl-chk td.c { font: 400 11.5px/1.45 'IBM Plex Mono', monospace; color: var(--steel); word-break: break-word; }
  .pl-chk tr.flag td { background: rgba(138,155,180,0.06); }
  .pl-rd { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; background: var(--line); border-radius: 10px; overflow: hidden; }
  .pl-rd > div { background: var(--ink-2); padding: 10px 12px; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .pl-rd .v { font: 500 18px/1.2 'IBM Plex Mono', monospace; }
  .pl-rd .s { font-size: 11.5px; color: var(--steel); line-height: 1.4; }
  .pl-tpr { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: 16px; align-items: start; }
  @container (max-width: 560px) { .pl-page .smx { --smc: 1 !important; } }
  @media (max-width: 1099px) { .pl-2, .pl-2.even, .pl-tpr { grid-template-columns: minmax(0, 1fr); } .pl-cal { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 767px) {
    .pl-page { padding-top: 18px; gap: 18px; }
    .pl-cal { grid-template-columns: minmax(0, 1fr); }
    .pl-jump { flex-wrap: nowrap; overflow-x: auto; }
    .pl-jump a { min-height: 44px; white-space: nowrap; }
    .pl-sec h2 { font-size: 21px; }
    .pl-rd { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .pl-chk thead { display: none; }
    .pl-chk tr { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 10px; padding: 10px 0; border-bottom: 1px solid var(--line); }
    .pl-chk td { padding: 0; border: 0; }
    .pl-chk td:nth-child(1) { grid-column: 1 / -1; }
    .pl-chk td.c { grid-column: 1 / -1; }
    .pl-chk td:last-child { grid-column: 1 / -1; }
    .pl-mast .hd-tabs a, .pl-page .btn { min-height: 44px; }
  }
`;

export const DEMO_URL = STAGING_DEMO_URL;

/** The three environments a planned board is drawn in. */
export function env(mode) {
  const demo = mode === 'demo', target = mode === 'target';
  return {
    mode, demo, target,
    kind: demo || target ? 'sample' : 'primary',
    sk: demo || target ? 'dashed' : 'solid',
    src: (real, shaped) => (demo ? `Demo · shaped like ${shaped}` : target ? `Design target · shaped like ${shaped}` : real),
    asof: (real) => (demo ? 'Scenario · Oct 7, 2026' : target ? 'Illustrative values · not data' : real),
  };
}

/** A chart frame in the environment's provenance (P-8): solid for production, dashed + hatch otherwise. */
export function frame(e, { claim, sub, body, real, shaped, asof, tag = ['current', ''], table = '', note = '', legendHtml = '', href = '' }) {
  return chartFrame({
    claim, sub, body, table, note, legendHtml,
    kind: e.kind,
    source: e.src(real, shaped), sourceKind: e.sk, sourceHref: e.mode === 'prod' ? href : '',
    asof: e.asof(asof),
    // D1 (owner, 2026-10-22; fidelity R-22): on the demo the source chip ("Demo · shaped like …") is the frame's
    // one Sample mark, so the head carries no Demo tag and the section head none either.
    state: e.demo ? '' : e.target ? 'sample' : tag[0], stateText: e.demo ? '' : e.target ? 'Design target · illustrative' : tag[1],
  });
}

/** A chart frame in a non-ready state at its final height: the title names the metric (P-10). */
export function frameState(state, { metric, sub = '', height = 160, text = '', cause = '', action = '', source = '', asof = '', stateText = '' }) {
  const warn = ['error', 'unavailable', 'stale'].includes(state);
  const body = state === 'loading'
    ? `<div class="cx" role="img" aria-label="Loading ${metric}" aria-busy="true" style="height: ${height}px;"><div class="cskel" aria-hidden="true"></div></div>`
    : `<div class="cx" style="height: ${height}px;"><div class="cstate${warn ? ' warn' : ''}" role="${warn && state !== 'stale' ? 'alert' : 'status'}"><div class="msg"><p>${text}</p>${cause ? `<p class="q">${cause}</p>` : ''}${action}</div></div></div>`;
  // P-10: a loading frame names its metric; P-2: loading and empty carry no tag (fidelity FND-11, ChartFrame.tsx).
  return chartFrame({ claim: metric, sub, body, source, asof, state: state === 'loading' || state === 'empty' ? '' : state, stateText });
}
export const retry = '<button class="btn secondary sm" type="button">Try again</button>';
export const demoLink = (path, text = 'See it on the demo →') => `<a href="${STAGING_DEMO_URL}${path}" class="t-info" style="display: inline-flex; gap: 6px; align-items: center; min-height: 24px; font-weight: 500;">${text}</a>`;

/** A design annotation above a product board: where the section sits and what its values are. Never product UI (P-4). */
export const boardNote = (scheme, html) => `<div class="v4" data-scheme="${scheme}" style="background: var(--ink); color: var(--phosphor);"><div class="pl-cap" role="note" aria-label="Board note">${icon('info', 13)}<span>${html}</span></div></div>`;

/** A section of a host page, under its own heading. */
export const section = ({ id, title, lead = '', tag = '', body }) => `<section class="pl-sec" id="${id}" aria-labelledby="${id}-h"><header><div class="row"><h2 id="${id}-h">${title}</h2>${tag}</div>${lead ? `<p class="sl">${lead}</p>` : ''}</header>${body}</section>`;

// ---- host pages ------------------------------------------------------------------------------------
const tabCounts = (html, demo) => (demo ? html.replace('<span class="cnt">14</span>', '<span class="cnt">6</span>').replace('<span class="cnt">77 open</span>', '<span class="cnt">34 open</span>') : html);
const jump = (items, on) => `<nav class="pl-jump" aria-label="On this page"><span class="lbl">On this page</span>${items.map(([id, n]) => `<a href="#${id}"${id === on ? ' aria-current="true"' : ''}>${n}</a>`).join('')}</nav>`;

/** /research/markets with the planned section added (Rates, Positioning: the Research · Markets row). */
export function marketsHost(e, { scheme = 'dark', minHeight = 0, on, body, note }) {
  const lead = 'Rates, positioning and the money behind them, from public sources, refreshed each business day. The 10-year on this page is the risk-free rate every note’s valuation starts from.';
  const main = `<div class="wrap pl-page"><div class="pl-h"><h1 class="display">Markets</h1><p class="lead">${lead}</p></div>${jump([['rates', 'Rates'], ['positioning', 'Positioning'], ['liquidity', 'Liquidity'], ['coming-up', 'Coming up']], on)}${body}<p class="pl-foot">${e.demo ? 'Demo · sample data shaped like the Federal Reserve’s, the Treasury’s, the BLS’s and the BEA’s files; nothing on this page is a real observation. Research and tools, not investment advice.' : 'Federal Reserve, U.S. Treasury, BLS, BEA and SEC data are public record; Convexa’s arithmetic is marked Computed. Research and tools, not investment advice.'}</p></div>`;
  return boardNote(scheme, note) + tabCounts(finalPage({ scheme, minHeight, active: 'research', tabs: 'Markets', demo: e.demo, label: 'Markets', main }), e.demo);
}

/** /ticker/:symbol/research — the note view, with the planned section in the public-record band under the note. */
export function noteHost(e, { scheme = 'dark', minHeight = 0, t = 'NVDA', body, note, band = 'Public record' }) {
  const tabsNav = `<nav aria-label="${t}" class="hd-tabs"><a href="/ticker/${t}">Overview</a><a href="/ticker/${t}/technical-analysis">Technical</a><a href="/ticker/${t}/research" aria-current="page">Research</a></nav>`;
  const head = e.demo
    ? `<div class="pl-note demo"><span class="caps">Sample research note · authored for this scenario</span><p class="t">NVDA higher-variation case</p><div class="m">${stateTag('sample', 'Sample note')}<span>Scenario of Oct 7, 2026 · Thesis, Evidence, Risks, Invalidation, Catalysts above</span></div></div>`
    : `<div class="pl-note"><span class="caps">Research note · Initiation · Oct 13, 2026</span><p class="t">A 70% growth guide on a $412B year. What comes after FY2028 is the whole question.</p><div class="m"><span class="stag k-solid">${icon('calendar', 12)}Price as of Oct 12</span><span>Sections 01–07 and the sources sit above this band</span></div></div>`;
  const main = `<div class="wrap pl-page"><div class="pl-mast"><div class="who"><h1 class="display">${t}</h1><span class="steel" style="font-size: 14px;">NVIDIA · Nasdaq</span></div>${tabsNav}</div>${head}<div class="pl-band"><span class="caps">${band} · ${t}</span>${body}</div><p class="pl-foot">${e.demo ? 'Demo · sample data; nothing here is an SEC or FINRA record. Not investment advice.' : 'From public SEC and FINRA records, each with its source and how late it reports. Personal research notes. Not investment advice.'}</p></div>`;
  return boardNote(scheme, note) + finalPage({ scheme, minHeight, active: 'research', demo: e.demo, label: `${t} research note`, main });
}

/** /research/scorecard with the signal track record (owner NO-8 A, 2026-10-25): the Scorecard as built
 *  (ScorecardPage.tsx), with no jump rail; the track record is the half-width card beside Calibration. */
export function scorecardHost(e, { scheme = 'dark', minHeight = 0, body, note }) {
  const main = `<div class="wrap pl-page"><div class="pl-h"><h1 class="display">Scorecard</h1><p class="lead">How the calls in the notes turn out. A forecast is scored when its date passes, but only if it carried your probability before then. Scoring a call after the answer is known would be fiction.</p></div><div class="pl-2 even" id="signals">${calibChart(rcEnv(e.demo, { frameTag: false }))}${body}</div><p class="pl-foot">${e.demo ? 'Sample forecasts and outcomes authored for the demo. Not investment advice.' : 'Forecasts come from each note’s forecasts block; setups from the scanner’s log. Personal research notes. Not investment advice.'}</p></div>`;
  return boardNote(scheme, note) + tabCounts(finalPage({ scheme, minHeight, active: 'research', tabs: 'Scorecard', demo: e.demo, label: 'Scorecard', main }), e.demo);
}

/** /ticker/:symbol/technical-analysis with Convexa's readings under the chart. */
export function techHost(e, { scheme = 'dark', minHeight = 0, t = 'NVDA', body, note }) {
  const tabsNav = `<nav aria-label="${t}" class="hd-tabs"><a href="/ticker/${t}">Overview</a><a href="/ticker/${t}/technical-analysis" aria-current="page">Technical</a><a href="/ticker/${t}/research">Research</a></nav>`;
  const main = `<div class="wrap pl-page"><div class="pl-mast"><div class="who"><h1 class="display">${t}</h1><span class="steel" style="font-size: 14px;">NVIDIA · Nasdaq</span></div>${tabsNav}</div>${body}<p class="pl-foot">Indicators describe the trend; they are not calls to buy or sell. Research and tools, not investment advice.</p></div>`;
  return boardNote(scheme, note) + finalPage({ scheme, minHeight, active: 'ticker', demo: e.demo, label: `${t} technical analysis`, main });
}
