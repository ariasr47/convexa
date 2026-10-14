// Screen registry — one entry per surface. `body(opts)` returns the inner HTML; `css` is the surface's
// own rules (tokens.css is always included); `interactive` marks screens with logic (the desk).
import { DESK_CSS, deskBody, deskProps, deskScript } from './desk.mjs';
import { STATES_CSS, deskStatesBody } from './desk-states.mjs';
import { aiReadBody } from './ai-read.mjs';
import { flowsBody } from './flows.mjs';
import { directionBBody, directionCBody } from './directions.mjs';
import { RESPSPEC_CSS, respSpecBody } from './responsive-spec.mjs';
import { LANDING_CSS, landingBody } from './landing.mjs';
import { SCAN_CSS, scannerBody } from './scanner.mjs';
import { POS_CSS, positionsBody } from './positions.mjs';
import { SETTINGS_CSS, settingsBody } from './settings.mjs';
import { ALERTS_CSS, alertsBody } from './alerts.mjs';
import { METHOD_CSS, methodologyBody } from './methodology.mjs';
import { BLOG_CSS, blogBody, labBody } from './blog.mjs';
import { DIALOGS_CSS, authBody, notFoundBody, operatorBody, orderDetailBody, personaBody, tradeEntryBody, viewEditorBody, whatsSentBody } from './dialogs.mjs';
import { LIB_CSS, libraryBody } from './library-page.mjs';
import { componentsBody } from './components-sheet.mjs';
import { SHEET_CSS, sourceMapBody, stateMatrixBody } from './v4/data-sheets.mjs';
import { HYBRID_CSS, hybridDeskBody } from './v4/hybrid-desk.mjs';
import { TOOLS_CSS, roadmapBody, toolSheetBody } from './v4/tools-sheets.mjs';
import { RESEARCH_CSS, filingsBody, marketsBody, scorecardBody, tickerResearchBody } from './v4/research.mjs';
import { TOOLS } from '../data/tools.mjs';
import { KIT_CSS } from './v4/kit.mjs';
import { SHELL_CSS, deskStatesBody as deskStatesV4Body, landingBody as landingV4Body, landingStatesBody, shellBody, shellPhoneBody, shellStatesBody } from './v4/shell-landing.mjs';
import { APP_CSS, alertsBody as alertsV4Body, alertsStatesBody, positionsBody as positionsV4Body, positionsStatesBody, scannerBody as scannerV4Body, scannerStatesBody, settingsBody as settingsV4Body, settingsStatesBody } from './v4/app-pages.mjs';
import { NOTES_CSS, noteStatesBody, noteViewBody, researchIndexBody } from './v4/notes.mjs';
import { COVERAGE_CSS, coverageBody } from './v4/coverage.mjs';
import { technicalBody, technicalStatesBody } from './v4/technical.mjs';
import { ALERTS5_CSS, alertsFlowBody, alertsPageBody, alertsStates5Body } from './v5/alerts-public.mjs';
import { famMarketsBody, famNoteFiguresBody, famNoteValuationBody, famPanelsBody, famScorecardBody } from './v5/families-research.mjs';
import { famDeskBody, famOtherBody } from './v5/families-desk.mjs';
import { toolsBody } from './v5/tools-v5.mjs';
import { TV5_CSS, tvFramingBody } from './v5/tv-v5.mjs';
import { V5_CSS, auditBody, chartSystemBody, chartStatesBody, chartPhoneBody, thirdPartyBody } from './v5/system.mjs';
import { DIALOGS, DOCS_CSS, blogBody as blogV4Body, dialogBody, dialogStatesBody, docsStatesBody, labBody as labV4Body, methodologyBody as methodologyV4Body, notFoundBody as notFoundV4Body, operatorBody as operatorV4Body, operatorStatesBody } from './v4/docs-dialogs.mjs';

const s = (title, group, desc, body, css = '', extra = {}) => ({ title, group, desc, body, css, ...extra });

export const screens = {
  desk: s('Ticker desk', 'Ticker desk', 'The SPY desk, fluid at any width. Read state, liveness, scheme and the phone sheet are switchable.', (o) => deskBody(o), DESK_CSS, { interactive: { props: deskProps, script: deskScript } }),
  'desk-states': s('Desk states', 'Ticker desk', 'Loading, cold-start failure, stream offline, empty selection, Prime tier, market closed and session replay.', (o) => deskStatesBody(o), STATES_CSS),
  'ai-read': s('AI read · nine states', 'Ticker desk', 'The narrow form of the AI read in every state, with the analysis drawer.', () => aiReadBody()),
  flows: s('User flows', 'Ticker desk', 'The product spine and the gated path to a read.', () => flowsBody()),
  'direction-b': s('Direction B · sticky read rail', 'Ticker desk', 'Low-fi alternate layout.', () => directionBBody()),
  'direction-c': s('Direction C · focus mode', 'Ticker desk', 'Low-fi alternate layout.', () => directionCBody()),
  'responsive-spec': s('Responsive spec', 'Ticker desk', 'Breakpoints and reflow rules for every surface.', (o) => respSpecBody(o), RESPSPEC_CSS),
  landing: s('Landing', 'Site', 'The front door: one offer, one action, the product as the hero.', (o) => landingBody(o), LANDING_CSS),
  scanner: s('Scanner', 'Site', 'The dense universe read; table on wide screens, cards under 1000px.', (o) => scannerBody(o), SCAN_CSS),
  positions: s('Positions', 'Site', 'The simulated book with honest marks and the track record.', (o) => positionsBody(o), POS_CSS),
  settings: s('Settings', 'Site', 'Account, preferences, risk inputs, AI providers, brokerage.', (o) => settingsBody(o), SETTINGS_CSS),
  alerts: s('Alerts', 'Site', 'Structure rules, the rules list and the fired log.', (o) => alertsBody(o), ALERTS_CSS),
  methodology: s('Methodology', 'Site', 'How Convexa works, as a document.', (o) => methodologyBody(o), METHOD_CSS),
  blog: s('Blog', 'Site', 'The blog index in the app theme.', (o) => blogBody(o), BLOG_CSS),
  lab: s('Lab', 'Site', 'The instrument lab.', (o) => labBody(o), BLOG_CSS),
  auth: s('Sign in + auth wall', 'Dialogs & gates', 'The sign-in dialog and the private-testing wall.', (o) => authBody(o), DIALOGS_CSS),
  'trade-entry': s('Trade entry', 'Dialogs & gates', 'The one shared simulated entry dialog, both variants.', (o) => tradeEntryBody(o), DIALOGS_CSS),
  'whats-sent': s('What’s sent drawer', 'Dialogs & gates', 'The egress drawer.', (o) => whatsSentBody(o), DIALOGS_CSS),
  persona: s('Persona', 'Dialogs & gates', 'Picker and customize form.', (o) => personaBody(o), DIALOGS_CSS),
  'order-detail': s('Order detail', 'Dialogs & gates', 'Watching and not-evaluated states.', (o) => orderDetailBody(o), DIALOGS_CSS),
  'view-editor': s('Scan view editor', 'Dialogs & gates', 'Universe picker with drag order.', (o) => viewEditorBody(o), DIALOGS_CSS),
  'not-found': s('Route fallback + 404', 'Dialogs & gates', 'Loading a route, and nothing at this address.', (o) => notFoundBody(o), DIALOGS_CSS),
  operator: s('Operator', 'Dialogs & gates', 'Metrics and the research archive, off the trader shell.', (o) => operatorBody(o), DIALOGS_CSS),
  library: s('Library · tokens, components, states', 'System', 'Every token and component with its states and markup, plus the React mapping.', (o) => libraryBody(o), LIB_CSS + V5_CSS),
  'components-sheet': s('Components sheet', 'System', 'The condensed component and motion sheet from the canvas.', () => componentsBody()),
  // ---- v4 (2026-10-13) ----
  'v4-source-map': s('Source map', 'v4 · Data states', 'Every widget on every screen: what it needs, its free or paid source, its delay, build status and its state on the hybrid site.', (o) => sourceMapBody(o), SHEET_CSS),
  'v4-state-matrix': s('State matrix', 'v4 · Data states', 'Nine widget families in all fourteen data states, desktop widths.', (o) => stateMatrixBody(o), SHEET_CSS),
  'v4-state-matrix-phone': s('State matrix · phone', 'v4 · Data states', 'The same matrix at phone widths: sheets for the AI read and dialogs, 44px controls.', (o) => stateMatrixBody({ ...o, phone: true }), SHEET_CSS),
  'v4-hybrid-desk': s('Hybrid desk · NVDA', 'v4 · Data states', 'Public data live, options panels honestly not live, with a toggle to a labelled sample.', (o) => hybridDeskBody(o), HYBRID_CSS),
  'v4-roadmap': s('Roadmap · tools from public data', 'v4 · Tools from public data', 'Every row of docs/public-data/CANDIDATES.md with source, delay, status and what it unlocks.', (o) => roadmapBody(o), SHEET_CSS + TOOLS_CSS),
  'v4-markets': s('Markets', 'v4 · Tools from public data', 'Rates, liquidity, the release calendar and futures positioning, from public sources.', (o) => marketsBody(o), HYBRID_CSS + RESEARCH_CSS),
  'v4-filings': s('Filings', 'v4 · Tools from public data', 'The SEC feed for followed companies, with the filing detail and reported figures.', (o) => filingsBody(o), HYBRID_CSS + RESEARCH_CSS),
  'v4-scorecard': s('Scorecard', 'v4 · Tools from public data', 'Forecast ledger and calibration, with the signal track record blocked on a price source.', (o) => scorecardBody(o), HYBRID_CSS + RESEARCH_CSS),
  'v4-ticker-research': s('Ticker research · NVDA', 'v4 · Tools from public data', 'A note’s header, its figures checked against the filing, and every public-data panel for the ticker.', (o) => tickerResearchBody(o), HYBRID_CSS + RESEARCH_CSS),
  // ---- v4 · App (wave 3): every route ----
  ...(() => {
    const V = HYBRID_CSS + RESEARCH_CSS + KIT_CSS + SHELL_CSS + APP_CSS + DOCS_CSS;
    const g = 'v4 · App';
    return {
      'v4-shell': s('Shell · nav, notice, ⌘K', g, 'The five-link nav, the data notice and the jump-to box, open over Research.', (o) => shellBody(o), V),
      'v4-shell-phone': s('Shell · phone menu', g, 'The phone menu drawer.', (o) => shellPhoneBody(o), V),
      'v4-shell-states': s('Shell · states', g, 'Notice, nav, jump-to, skip link and footer in every state.', (o) => shellStatesBody(o), V),
      'v4-landing': s('Landing', g, 'One offer, one action, the model as the hero, labelled as a sample.', (o) => landingV4Body(o), V),
      'v4-landing-states': s('Landing · states', g, 'Reduced motion, the live band’s failures, demo, closed sign-ups.', (o) => landingStatesBody(o), V),
      'v4-desk-states': s('Hybrid desk · states', g, 'Each source failing, off, unset or unchosen.', (o) => deskStatesV4Body(o), V),
      'v4-technical': s('Technical tab · NVDA', g, 'TradingView’s daily chart, shown as TradingView’s (shipped 2026-10-13).', (o) => technicalBody(o), V),
      'v4-technical-states': s('Technical tab · states', g, 'Loading, blocked loader, demo, no note, what is not embedded.', (o) => technicalStatesBody(o), V),
      'v4-scanner': s('Scanner', g, 'Not live by default; a labelled sample scan; the last real board as a dated archive.', (o) => scannerV4Body(o), V),
      'v4-scanner-states': s('Scanner · states', g, 'Explain, archive, loading, empty, filtered, signed out, demo, keyboard preview.', (o) => scannerStatesBody(o), V),
      'v4-positions': s('Positions', g, 'Paper book with honest mark bases.', (o) => positionsV4Body(o), V),
      'v4-positions-signedout': s('Positions · signed out', g, 'The private-testing wall.', (o) => positionsV4Body({ ...o, signedOut: true }), V),
      'v4-positions-states': s('Positions · states', g, 'Empty, mark bases, store fault, broker, demo, orders.', (o) => positionsStatesBody(o), V),
      'v4-alerts': s('Alerts', g, 'Release and filing rules on public data; structure kinds not live.', (o) => alertsV4Body(o), V),
      'v4-alerts-states': s('Alerts · states', g, 'Empty, not live, paused, blocked notifications, store fault, a firing.', (o) => alertsStatesBody(o), V),
      'v4-settings': s('Settings', g, 'Account, preferences, risk inputs, AI providers, brokerage.', (o) => settingsV4Body(o), V),
      'v4-settings-signedout': s('Settings · signed out', g, 'What works without an account.', (o) => settingsV4Body({ ...o, signedOut: true }), V),
      'v4-settings-states': s('Settings · states', g, 'Validation, not set, save failed, changed elsewhere, disconnect, demo.', (o) => settingsStatesBody(o), V),
      'v4-methodology': s('Methodology', g, 'How Convexa works, with “What’s live on this site”.', (o) => methodologyV4Body(o), V),
      'v4-blog': s('Blog', g, 'The blog index.', (o) => blogV4Body(o), V),
      'v4-lab': s('Lab', g, 'Instrument candidates on synthetic data.', (o) => labV4Body(o), V),
      'v4-not-found': s('404', g, 'Nothing at this address.', (o) => notFoundV4Body(o), V),
      'v4-docs-states': s('Static pages · states', g, 'Route loading and failure, deep links, the Lab’s off control.', (o) => docsStatesBody(o), V),
      'v4-operator': s('Operator', g, 'Metrics and the session archive, off the trader shell.', (o) => operatorV4Body(o), V),
      'v4-operator-states': s('Operator · states', g, 'Locked, off, unavailable, empty.', (o) => operatorStatesBody(o), V),
      'v4-note-view': s('Note view · NVDA', 'v4 · Research', 'The note with neutral directions: freshness, figures with sources, the case, thesis checks, the bridge, forecasts.', (o) => noteViewBody(o), V + NOTES_CSS),
      'v4-research-index': s('Research index', 'v4 · Research', 'Every ticker with notes, under the Research tabs.', (o) => researchIndexBody(o), V + NOTES_CSS),
      'v4-note-states': s('Note view · states', 'v4 · Research', 'Freshness, superseded, stale price, missing, failed, demo.', (o) => noteStatesBody(o), V + NOTES_CSS),
      'v4-coverage': s('Coverage matrix', 'v4 · Coverage', 'Route × width × theme × states, each cell naming its board, gaps marked.', (o) => coverageBody(o), SHEET_CSS + COVERAGE_CSS),
      ...Object.fromEntries(Object.keys(DIALOGS).flatMap((k) => [[`v4-dlg-${k}`, s(DIALOGS[k].title, g, `${DIALOGS[k].title} over a blurred page; a bottom sheet under 600px.`, dialogBody(k), V)], [`v4-dlg-${k}-states`, s(`${DIALOGS[k].title} · states`, g, `${DIALOGS[k].title} in every state.`, dialogStatesBody(k), V)]])),
    };
  })(),
  ...Object.fromEntries(TOOLS.map((t) => [`v4-tool-${t.key}`, s(`Tool · ${t.name}`, 'v4 · Tools from public data', `${t.unlocks}. Status: ${t.status}.`, (o) => toolSheetBody({ ...o, tool: t.key }), SHEET_CSS + TOOLS_CSS + HYBRID_CSS)])),
  // ---- v5 (2026-10-13): charts — audit, system, families, tools, TradingView, frontier ----
  ...(() => {
    const g = 'v5 · Charts';
    const V = HYBRID_CSS + RESEARCH_CSS + KIT_CSS + V5_CSS;
    return {
      'v5-audit': s('Charts · every chart, audited', g, 'Fifty-two app charts, twenty-one board marks and nine planned tools: the top ten upgrades, counts and what recurs.', (o) => auditBody(o), V),
      'v5-system': s('Charts · one chart system', g, 'Rules from the canon, colour roles with measured contrast and validator verdicts, mark specs, every primitive and its React module.', (o) => chartSystemBody(o), V),
      'v5-states': s('Charts · every state', g, 'Ready and the seven data states at final size, scrub and keyboard focus, primitive × state.', (o) => chartStatesBody(o), V),
      'v5-phone': s('Charts · on a phone', g, 'Re-layout at 390: short labels, fewer ticks, one-column facets, the bridge as rows.', (o) => chartPhoneBody(o), V),
      'v5-fam-note-figures': s('Families · note figures', g, 'Column chart, proportion, bridge (crossing zero), index mini chart, compare: before and after.', (o) => famNoteFiguresBody(o), V),
      'v5-fam-note-valuation': s('Families · valuation', g, 'Price vs value, football field, odds, sensitivity, implied growth, catalysts: before and after.', (o) => famNoteValuationBody(o), V),
      'v5-fam-markets': s('Families · Markets', g, 'Curve, decomposition, 2s10s, note-rate drift, CFTC positioning: before and after.', (o) => famMarketsBody(o), V),
      'v5-fam-scorecard': s('Families · Scorecard and Filings', g, 'By month (counts what it draws), calibration with Wilson intervals, reported figures: before and after.', (o) => famScorecardBody(o), V),
      'v5-fam-panels': s('Families · note panels', g, 'Short interest, short-sale volume (a gated design target), switched-off panels: before and after.', (o) => famPanelsBody(o), V),
      'v5-fam-desk': s('Families · ticker desk', g, 'Structure field, magnet, ladder, term structure, straddle, tape, path, opportunity: before and after (sample, beside not live).', (o) => famDeskBody(o), V),
      'v5-fam-other': s('Families · scanner, positions, operator, Lab', g, 'The smaller charts and what the rulings settled.', (o) => famOtherBody(o), V),
      'v5-tools': s('Planned tools, charted', g, 'Liquidity, calendar, OTC, insider clusters, 13F, XBRL, peers, signal track record, TA.', (o) => toolsBody(o), V),
      'v5-tv': s('TradingView, framed', g, 'The Technical tab, the desk’s price panel, the frame’s states, load on request, and where a frame belongs.', (o) => tvFramingBody(o), V + TV5_CSS),
      // Q-5, ruled by the owner 2026-10-13: alerts on public data
      'q5-alerts': s('Alerts on public data', 'Ruled · Q-5', 'Six alert kinds that work on the semi-live site, each with its source, delay and state word.', (o) => alertsPageBody(o), V + APP_CSS + ALERTS5_CSS),
      'q5-alerts-flow': s('New alert · flow', 'Ruled · Q-5', 'Choose, set up, read back: the create-alert dialog (a bottom sheet on phones).', (o) => alertsFlowBody(o), V + APP_CSS + ALERTS5_CSS),
      'q5-alerts-states': s('Alerts on public data · states', 'Ruled · Q-5', 'Every state of the page and the dialog.', (o) => alertsStates5Body(o), V + APP_CSS + ALERTS5_CSS),
      'v5-third-party': s('Charts · ours and theirs', g, 'A Convexa chart beside TradingView’s frame: the eight deliberate differences and the frame’s two states.', (o) => thirdPartyBody(o), V),
    };
  })(),
};
