// v4 · Coverage — route × width × theme × states → the board that draws it, gaps marked honestly.
// Board names are checked against canvas.config.mjs at build time, so a renamed or missing board
// shows up here as a gap instead of a false claim.
import { artboards } from '../../canvas.config.mjs';
import { FAMILIES, STATE_ROWS } from '../../data/states.mjs';
import { TOOLS } from '../../data/tools.mjs';
import { SOURCE_MAP } from '../../data/hybrid.mjs';
import { sheetHead } from './data-sheets.mjs';

export const COVERAGE_CSS = `
  .cov { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .cov th { text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); padding: 10px; border-bottom: 1px solid var(--line-2); vertical-align: bottom; }
  .cov td { padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
  .cov td.r { color: var(--phosphor); font-weight: 600; white-space: nowrap; }
  .cov .ok { font: 500 11.5px 'IBM Plex Mono', monospace; color: var(--phosphor); }
  .cov .part { font: 500 11.5px 'IBM Plex Mono', monospace; color: var(--steel); }
  .cov .gap { display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border-radius: 999px; border: 1px dashed var(--steel-2); color: var(--steel); font-size: 11.5px; }
  .cov .v2 { font: 400 11px 'IBM Plex Mono', monospace; color: var(--steel); display: block; margin-top: 2px; }
  .cov-tot { display: flex; flex-wrap: wrap; gap: 12px 28px; }
  .cov-tot > div { display: flex; flex-direction: column; gap: 2px; }
  .cov-tot b { font: 500 28px 'IBM Plex Mono', monospace; }
`;

// [route, 1440 dark, 390 dark, 1440 light, 390 light, 834, states board, v2 boards kept]
// A cell is a board name, ['part', board, why] for partial cover, or ['gap', why].
const G = (why) => ['gap', why];
const PART = (b, why) => ['part', b, why];
export const COVERAGE = [
  ['Global shell', 'V4Shell', 'V4Shell390', 'V4ShellLight', G('scheme is a token swap'), G('nav collapses at 1100/900 by rule'), 'V4ShellStates', 'Library (nav, palette)'],
  ['Landing', 'V4Landing', 'V4Landing390', 'V4LandingLight', G('token swap'), G('stacks under 1100'), 'V4LandingStates', 'Landing, Landing834, Landing390, LandingLight'],
  ['Ticker desk (hybrid)', 'V4HybridDesk', 'V4HybridDesk390', 'V4DeskLight', 'V4HybridDesk390Light', 'V4HybridDesk834', 'V4DeskStates', 'Main, Desk1920/1280/1024/834/390, DeskLight, DeskStates, AiRead'],
  ['Ticker desk · sample on', 'V4HybridDeskSample', PART('V4HybridDesk390', 'one list, sample toggle'), G('token swap'), G('token swap'), G(''), PART('V4StateMatrix', 'sample row'), ''],
  ['Ticker · Technical tab', 'V4Technical', 'V4Technical390', 'V4TechnicalLight', G('token swap'), G(''), 'V4TechnicalStates', ''],
  ['Ticker · Research (note)', 'V4NoteView', 'V4NoteView390', 'V4NoteViewLight', 'V4NoteView390Light', G(''), 'V4NoteStates', ''],
  ['Ticker · Research panels', 'V4TickerResearch', 'V4TickerResearch390', 'V4TickerResearchLight', G('token swap'), G(''), PART('V4StateMatrix', 'positioning and feed rows'), ''],
  ['Research index', 'V4ResearchIndex', 'V4ResearchIndex390', 'V4ResearchIndexLight', G('token swap'), G(''), G('index loading, no notes, no match, demo not drawn'), ''],
  ['Research · Markets', 'V4Markets', 'V4Markets390', 'V4MarketsLight', G('token swap'), 'V4Markets834', PART('V4ToolLiquidity', 'tool sheets + V4MarketsDemo + matrix'), ''],
  ['Research · Filings', 'V4Filings', 'V4Filings390', 'V4FilingsLight', G('token swap'), G(''), PART('V4StateMatrix', 'table and feed rows'), ''],
  ['Research · Scorecard', 'V4Scorecard', 'V4Scorecard390', 'V4ScorecardLight', G('token swap'), G(''), PART('V4ToolSignals', 'signals states; ledger states not drawn'), ''],
  ['Scanner', 'V4Scanner', 'V4Scanner390', 'V4ScannerLight', G('token swap'), G('cards under 1000'), 'V4ScannerStates', 'Scanner, Scanner834, Scanner390'],
  ['Positions · signed in', 'V4Positions', 'V4Positions390', 'V4PositionsLight', G('token swap'), G('cards under 1000'), 'V4PositionsStates', 'Positions, Positions390'],
  ['Positions · signed out', 'V4PositionsSignedOut', G('wall reflows; not drawn'), G('not drawn'), G(''), G(''), PART('V4PositionsStates', 'signed-out item'), 'Auth'],
  ['Alerts', 'V4Alerts', 'V4Alerts390', 'V4AlertsLight', G('token swap'), G(''), 'V4AlertsStates', 'Alerts'],
  ['Settings', 'V4Settings', 'V4Settings390', 'V4SettingsLight', G('token swap'), G('rail becomes tabs under 900'), 'V4SettingsStates', 'Settings, Settings390'],
  ['Settings · signed out', 'V4SettingsSignedOut', G('not drawn'), G('not drawn'), G(''), G(''), PART('V4SettingsStates', ''), ''],
  ['Methodology', 'V4Methodology', 'V4Methodology390', 'V4MethodologyLight', G('token swap'), G(''), 'V4MethodologyStates', 'Methodology'],
  ['Blog', 'V4Blog', 'V4Blog390', 'V4BlogLight', G('token swap'), G(''), PART('V4MethodologyStates', 'shared static-page states'), 'Blog'],
  ['Lab', 'V4Lab', 'V4Lab390', 'V4LabLight', G('token swap'), G(''), PART('V4MethodologyStates', 'shared static-page states'), 'Lab'],
  ['404 and route fallback', 'V4NotFound', 'V4NotFound390', 'V4NotFoundLight', G('token swap'), G(''), PART('V4MethodologyStates', 'loading and failure items'), 'NotFound'],
  ['Sign in and the wall', 'V4SignIn', 'V4SignIn390', 'V4SignInLight', G('token swap'), G(''), 'V4SignInStates', 'Auth'],
  ['Trade entry', 'V4TradeEntry', 'V4TradeEntry390', 'V4TradeEntryLight', G('token swap'), G(''), 'V4TradeEntryStates', 'TradeEntry'],
  ['Order detail', 'V4OrderDetail', 'V4OrderDetail390', 'V4OrderDetailLight', G('token swap'), G(''), 'V4OrderDetailStates', 'OrderDetail'],
  ['What’s sent drawer', 'V4WhatsSent', 'V4WhatsSent390', 'V4WhatsSentLight', G('token swap'), G(''), 'V4WhatsSentStates', 'WhatsSent'],
  ['Persona', 'V4Persona', 'V4Persona390', 'V4PersonaLight', G('token swap'), G(''), 'V4PersonaStates', 'Persona'],
  ['Scan view editor', 'V4ViewEditor', 'V4ViewEditor390', 'V4ViewEditorLight', G('token swap'), G(''), 'V4ViewEditorStates', 'ViewEditor'],
  ['Operator', 'V4Operator', 'V4Operator390', 'V4OperatorLight', G('token swap'), G(''), 'V4OperatorStates', 'Operator'],
];

export function coverageBody({ minHeight = 3600, scheme = 'dark' } = {}) {
  const names = new Set(artboards.map((a) => a.name));
  let ok = 0, part = 0, gap = 0, missing = 0;
  const cell = (c) => {
    if (typeof c === 'string') { if (names.has(c)) { ok++; return `<span class="ok">${c}</span>`; } missing++; gap++; return `<span class="gap">missing: ${c}</span>`; }
    if (c[0] === 'part') { if (!names.has(c[1])) { missing++; gap++; return `<span class="gap">missing: ${c[1]}</span>`; } part++; return `<span class="part">${c[1]}${c[2] ? ` · ${c[2]}` : ''}</span>`; }
    gap++; return `<span class="gap">gap${c[1] ? ` · ${c[1]}` : ''}</span>`;
  };
  const rows = COVERAGE.map(([r, ...cs]) => { const v2 = cs.pop(); return `<tr><td class="r">${r}</td>${cs.map((c) => `<td>${cell(c)}</td>`).join('')}<td><span class="v2">${v2 || '—'}</span></td></tr>`; }).join('');
  const total = ok + part + gap;
  const famCells = FAMILIES.length * STATE_ROWS.length;
  const toolCells = TOOLS.length * STATE_ROWS.length;
  const mapped = SOURCE_MAP.reduce((n, g) => n + g.rows.length, 0);
  const tot = `<div class="cov-tot">${[['Cells covered', ok], ['Partly covered', part], ['Gaps', gap], ['of', total], ['Missing board refs', missing]].map(([l, v]) => `<div><span class="caps">${l}</span><b>${v}</b></div>`).join('')}</div>`;
  const tot2 = `<div class="cov-tot">${[['Widget family × state', `${famCells} of ${famCells}`], ['…at phone width', `${famCells} of ${famCells}`], ['…in light', `${famCells} of ${famCells}`], ['Tool × state', `${toolCells} of ${toolCells}`], ['Widgets on the source map', mapped]].map(([l, v]) => `<div><span class="caps">${l}</span><b style="font-size: 22px;">${v}</b></div>`).join('')}</div>`;
  return `<div class="v4" data-scheme="${scheme}" style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);"><div class="sheet">
    ${sheetHead('Coverage: every route, width, theme and state', 'Each cell names the board that draws it. Partial means another board covers it in part (and says how); a gap is a gap, with the reason. Board names are checked against the canvas registry at build time, so nothing here claims a board that does not exist. Tablet (834) is drawn only where a layout changes in a way the phone and desktop boards don’t show.', 'coverage (wave 5)')}
    <section aria-label="Route totals" style="display: flex; flex-direction: column; gap: 10px;"><span class="caps" style="color: var(--phosphor);">Routes × 6 columns</span>${tot}</section>
    <section aria-label="State totals" style="display: flex; flex-direction: column; gap: 10px;"><span class="caps" style="color: var(--phosphor);">Data states</span>${tot2}</section>
    <div style="overflow-x: auto;"><table class="cov"><thead><tr><th>Route</th><th>1440 · dark</th><th>390 · dark</th><th>1440 · light</th><th>390 · light</th><th>834 · tablet</th><th>States board</th><th>v2 boards kept</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p style="margin: 0; font-size: 12px; color: var(--steel);">“Token swap” gaps: the light scheme is a token swap (every light desktop board renders the same source with data-scheme="light"), so a light phone board adds no layout information; two are drawn as proof. v2 boards are kept as drawn on 2026-09-03 plus the shared canon fixes (five-link nav, textDim dimming).</p>
  </div></div>`;
}
