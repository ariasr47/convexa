// Canvas registry — which screens become artboards, at which widths, on which page. Positions are
// computed (row flow per page), so adding a frame is one line.
export const pages = [
  { id: 'page-1', name: 'Ticker desk' },
  { id: 'page-2', name: 'Responsive' },
  { id: 'page-3', name: 'Site' },
  { id: 'page-4', name: 'Dialogs & gates' },
  { id: 'page-5', name: 'System' },
  { id: 'v4-data', name: 'v4 · Data states' },
  { id: 'v4-tools', name: 'v4 · Tools from public data' },
  { id: 'v4-app', name: 'v4 · App' },
  { id: 'v4-research', name: 'v4 · Research' },
  { id: 'v4-coverage', name: 'v4 · Coverage' },
];

// { name, screen, page, w, h, title, opts?, expand?, interactive? }
export const artboards = [
  { name: 'Main', screen: 'desk', page: 'page-1', w: 1440, h: 2300, title: 'Ticker desk · SPY (interactive · expand and resize the window)', expand: 'fill' },
  { name: 'DeskStates', screen: 'desk-states', page: 'page-1', w: 1440, h: 2200, title: 'Desk · loading, failed, offline, empty, Prime, closed' },
  { name: 'AiRead', screen: 'ai-read', page: 'page-1', w: 1440, h: 1720, title: 'AI read · nine states (narrow form)' },
  { name: 'Flows', screen: 'flows', page: 'page-1', w: 1440, h: 760, title: 'User flows' },
  { name: 'DirectionB', screen: 'direction-b', page: 'page-1', w: 760, h: 640, title: 'Direction B · sticky read rail' },
  { name: 'DirectionC', screen: 'direction-c', page: 'page-1', w: 760, h: 640, title: 'Direction C · focus mode' },

  { name: 'Desk1920', screen: 'desk', page: 'page-2', w: 1920, h: 2100, title: 'Desk · 1920 wide' },
  { name: 'Desk1280', screen: 'desk', page: 'page-2', w: 1280, h: 2400, title: 'Desk · 1280 laptop' },
  { name: 'Desk1024', screen: 'desk', page: 'page-2', w: 1024, h: 2900, title: 'Desk · 1024 tablet landscape' },
  { name: 'Desk834', screen: 'desk', page: 'page-2', w: 834, h: 3500, title: 'Desk · 834 tablet' },
  { name: 'Desk390', screen: 'desk', page: 'page-2', w: 390, h: 1400, title: 'Desk · 390 phone viewport (tap the AI read peek)', opts: { sheet: 'peek' } },
  { name: 'Landing834', screen: 'landing', page: 'page-2', w: 834, h: 4100, title: 'Landing · 834' },
  { name: 'Landing390', screen: 'landing', page: 'page-2', w: 390, h: 5000, title: 'Landing · 390' },
  { name: 'Scanner834', screen: 'scanner', page: 'page-2', w: 834, h: 2300, title: 'Scanner · 834 (cards)' },
  { name: 'Scanner390', screen: 'scanner', page: 'page-2', w: 390, h: 3900, title: 'Scanner · 390' },
  { name: 'Positions390', screen: 'positions', page: 'page-2', w: 390, h: 2600, title: 'Positions · 390 (cards)' },
  { name: 'Settings390', screen: 'settings', page: 'page-2', w: 390, h: 2300, title: 'Settings · 390 (tabs)' },
  { name: 'RespSpec', screen: 'responsive-spec', page: 'page-2', w: 1440, h: 1300, title: 'Responsive spec' },

  { name: 'Landing', screen: 'landing', page: 'page-3', w: 1440, h: 2960, title: 'Landing' },
  { name: 'Scanner', screen: 'scanner', page: 'page-3', w: 1440, h: 1300, title: 'Scanner' },
  { name: 'Positions', screen: 'positions', page: 'page-3', w: 1440, h: 1220, title: 'Positions' },
  { name: 'Alerts', screen: 'alerts', page: 'page-3', w: 1440, h: 1100, title: 'Alerts' },
  { name: 'Settings', screen: 'settings', page: 'page-3', w: 1440, h: 1820, title: 'Settings' },
  { name: 'Methodology', screen: 'methodology', page: 'page-3', w: 1440, h: 2400, title: 'Methodology' },
  { name: 'Blog', screen: 'blog', page: 'page-3', w: 1440, h: 900, title: 'Blog' },
  { name: 'Lab', screen: 'lab', page: 'page-3', w: 1440, h: 1000, title: 'Lab' },

  { name: 'Auth', screen: 'auth', page: 'page-4', w: 1440, h: 940, title: 'Sign in + auth wall' },
  { name: 'TradeEntry', screen: 'trade-entry', page: 'page-4', w: 1440, h: 1150, title: 'Trade entry · position and order variants' },
  { name: 'WhatsSent', screen: 'whats-sent', page: 'page-4', w: 1440, h: 960, title: 'What’s sent drawer' },
  { name: 'Persona', screen: 'persona', page: 'page-4', w: 1440, h: 900, title: 'Persona · picker and customize' },
  { name: 'OrderDetail', screen: 'order-detail', page: 'page-4', w: 1440, h: 760, title: 'Order detail' },
  { name: 'ViewEditor', screen: 'view-editor', page: 'page-4', w: 1440, h: 900, title: 'Scan view editor' },
  { name: 'NotFound', screen: 'not-found', page: 'page-4', w: 1440, h: 640, title: 'Route fallback + 404' },
  { name: 'Operator', screen: 'operator', page: 'page-4', w: 1440, h: 1080, title: 'Operator · metrics + research' },

  { name: 'Library', screen: 'library', page: 'page-5', w: 1440, h: 5900, title: 'Library · tokens, components, states, React mapping', opts: { dataStates: 'summary' } },
  { name: 'Components', screen: 'components-sheet', page: 'page-5', w: 1440, h: 2720, title: 'Components & motion sheet' },
  { name: 'DeskLight', screen: 'desk', page: 'page-5', w: 1440, h: 2300, title: 'Desk · light scheme (interactive)', opts: { scheme: 'light' } },
  { name: 'LandingLight', screen: 'landing', page: 'page-5', w: 1440, h: 2960, title: 'Landing · light scheme', opts: { scheme: 'light' } },

  // ---- v4 · Data states (wave 1, 2026-10-13) ----
  { name: 'V4SourceMap', screen: 'v4-source-map', page: 'v4-data', x: 0, y: 0, w: 1920, h: 5600, title: 'v4 · Source map: where every number comes from', findings: 'X-01, X-02, X-03, X-08, DS-01–DS-04' },
  { name: 'V4HybridDesk', screen: 'v4-hybrid-desk', page: 'v4-data', x: 2040, y: 0, w: 1440, h: 3400, title: 'v4 · Hybrid desk · NVDA · not-live panels explained', expand: 'fill', findings: 'X-01, X-03, X-05, X-06, TKR-01–TKR-07' },
  { name: 'V4HybridDeskSample', screen: 'v4-hybrid-desk', page: 'v4-data', x: 3600, y: 0, w: 1440, h: 3400, title: 'v4 · Hybrid desk · NVDA · sample illustrations on', opts: { sample: true }, expand: 'fill', findings: 'X-10, TKR-02, TKR-04' },
  { name: 'V4HybridDesk390', screen: 'v4-hybrid-desk', page: 'v4-data', x: 5160, y: 0, w: 390, h: 5200, title: 'v4 · Hybrid desk · NVDA · phone', findings: 'X-12, TKR-06, TKR-08' },
  { name: 'V4StateMatrix', screen: 'v4-state-matrix', page: 'v4-data', x: 0, y: 6100, w: 3220, h: 4200, title: 'v4 · State matrix · 9 families × 14 states', findings: 'X-01, X-02, X-09, X-10, DS-05–DS-08' },
  { name: 'V4StateMatrix390', screen: 'v4-state-matrix-phone', page: 'v4-data', x: 3340, y: 6100, w: 3740, h: 4700, title: 'v4 · State matrix · phone widths', findings: 'X-12, DS-05–DS-08' },

  // ---- v4 · Tools from public data (wave 2, 2026-10-13) ----
  { name: 'V4Roadmap', screen: 'v4-roadmap', page: 'v4-tools', x: 0, y: 0, w: 1920, h: 3600, title: 'v4 · Roadmap: everything Convexa can build without the paid feed', findings: 'TL-13, Q-1, Q-2, Q-3' },
  { name: 'V4Markets', screen: 'v4-markets', page: 'v4-tools', x: 2040, y: 0, w: 1440, h: 3300, title: 'v4 · Markets · rates, liquidity, calendar, positioning (built + build)', expand: 'fill', findings: 'X-08, TL-01, TL-03, TL-14' },
  { name: 'V4Filings', screen: 'v4-filings', page: 'v4-tools', x: 3600, y: 0, w: 1440, h: 1900, title: 'v4 · Filings · the SEC feed and filing detail (switch)', expand: 'fill', findings: 'X-13, DS-02, TL-15' },
  { name: 'V4Scorecard', screen: 'v4-scorecard', page: 'v4-tools', x: 5160, y: 0, w: 1440, h: 2000, title: 'v4 · Scorecard · forecasts live, signal track record blocked', expand: 'fill', findings: 'TL-12, TL-16' },
  { name: 'V4TickerResearch', screen: 'v4-ticker-research', page: 'v4-tools', x: 6720, y: 0, w: 1440, h: 2700, title: 'v4 · Ticker research · NVDA · every public panel', expand: 'fill', findings: 'TL-05–TL-11, TL-17' },
  { name: 'V4ToolLiquidity', screen: 'v4-tool-liquidity', page: 'v4-tools', x: 0, y: 4000, w: 1440, h: 2800, title: 'v4 · Tool · Liquidity panel · build', findings: 'TL-01, TL-02' },
  { name: 'V4ToolCalendar', screen: 'v4-tool-calendar', page: 'v4-tools', x: 1560, y: 4000, w: 1440, h: 2800, title: 'v4 · Tool · Macro calendar · build', findings: 'TL-03, TL-04' },
  { name: 'V4ToolOtc', screen: 'v4-tool-otc', page: 'v4-tools', x: 3120, y: 4000, w: 1440, h: 2800, title: 'v4 · Tool · Off-exchange volume (weekly) · build / verify', findings: 'TL-05, TKR-07' },
  { name: 'V4ToolClusters', screen: 'v4-tool-clusters', page: 'v4-tools', x: 4680, y: 4000, w: 1440, h: 2800, title: 'v4 · Tool · Insider clusters · build', findings: 'TL-06' },
  { name: 'V4ToolHolders', screen: 'v4-tool-holders', page: 'v4-tools', x: 6240, y: 4000, w: 1440, h: 2800, title: 'v4 · Tool · Fund holdings (13F) · build', findings: 'TL-07' },
  { name: 'V4ToolXbrl', screen: 'v4-tool-xbrl', page: 'v4-tools', x: 0, y: 7300, w: 1440, h: 2800, title: 'v4 · Tool · Note figures from XBRL · build', findings: 'TL-08, TL-09' },
  { name: 'V4ToolPeers', screen: 'v4-tool-peers', page: 'v4-tools', x: 1560, y: 7300, w: 1440, h: 2800, title: 'v4 · Tool · Peer table · build', findings: 'TL-10' },
  { name: 'V4ToolTa', screen: 'v4-tool-ta', page: 'v4-tools', x: 3120, y: 7300, w: 1440, h: 3000, title: 'v4 · Tool · Technical analysis · blocked', findings: 'TL-11, TKR-05, DS-03' },
  { name: 'V4ToolSignals', screen: 'v4-tool-signals', page: 'v4-tools', x: 4680, y: 7300, w: 1440, h: 2800, title: 'v4 · Tool · Signal track record · blocked', findings: 'TL-12' },
  ...appRows(),

  // ---- v4 · Research refresh (wave 4, 2026-10-13) ----
  { name: 'V4NoteView', screen: 'v4-note-view', page: 'v4-research', x: 0, y: 0, w: 1440, h: 4600, title: 'v4 · Note view · NVDA · neutral directions (supersedes the research canvas Main board)', expand: 'fill', findings: 'RSH-01, RSH-02' },
  { name: 'V4NoteView390', screen: 'v4-note-view', page: 'v4-research', x: 1560, y: 0, w: 390, h: 6600, title: 'v4 · Note view · phone', findings: 'RSH-03' },
  { name: 'V4NoteViewLight', screen: 'v4-note-view', page: 'v4-research', x: 2070, y: 0, w: 1440, h: 4600, title: 'v4 · Note view · light', opts: { scheme: 'light' }, expand: 'fill', findings: 'RSH-04' },
  { name: 'V4NoteStates', screen: 'v4-note-states', page: 'v4-research', x: 3630, y: 0, w: 1440, h: 2100, title: 'v4 · Note view · states', findings: 'RSH-06' },
  { name: 'V4ResearchIndex', screen: 'v4-research-index', page: 'v4-research', x: 0, y: 5020, w: 1440, h: 1900, title: 'v4 · Research index with the tabs', expand: 'fill', findings: 'RSH-05' },
  { name: 'V4ResearchIndex390', screen: 'v4-research-index', page: 'v4-research', x: 1560, y: 5020, w: 390, h: 3400, title: 'v4 · Research index · phone', findings: 'RSH-03' },
  { name: 'V4ResearchIndexLight', screen: 'v4-research-index', page: 'v4-research', x: 2070, y: 5020, w: 1440, h: 1900, title: 'v4 · Research index · light', opts: { scheme: 'light' }, expand: 'fill', findings: 'RSH-04' },
  { name: 'V4Markets390', screen: 'v4-markets', page: 'v4-research', x: 0, y: 7840, w: 390, h: 6400, title: 'v4 · Markets · phone', findings: 'RSH-03' },
  { name: 'V4Filings390', screen: 'v4-filings', page: 'v4-research', x: 510, y: 7840, w: 390, h: 3600, title: 'v4 · Filings · phone', findings: 'RSH-03' },
  { name: 'V4Scorecard390', screen: 'v4-scorecard', page: 'v4-research', x: 1020, y: 7840, w: 390, h: 3800, title: 'v4 · Scorecard · phone', findings: 'RSH-03' },
  { name: 'V4TickerResearch390', screen: 'v4-ticker-research', page: 'v4-research', x: 1530, y: 7840, w: 390, h: 6200, title: 'v4 · Ticker research · phone', findings: 'RSH-03' },
  { name: 'V4MarketsLight', screen: 'v4-markets', page: 'v4-research', x: 2040, y: 7840, w: 1440, h: 3300, title: 'v4 · Markets · light', opts: { scheme: 'light' }, expand: 'fill', findings: 'RSH-04' },
  { name: 'V4FilingsLight', screen: 'v4-filings', page: 'v4-research', x: 3600, y: 7840, w: 1440, h: 1900, title: 'v4 · Filings · light', opts: { scheme: 'light' }, expand: 'fill', findings: 'RSH-04' },
  { name: 'V4ScorecardLight', screen: 'v4-scorecard', page: 'v4-research', x: 5160, y: 7840, w: 1440, h: 2000, title: 'v4 · Scorecard · light', opts: { scheme: 'light' }, expand: 'fill', findings: 'RSH-04' },
  { name: 'V4TickerResearchLight', screen: 'v4-ticker-research', page: 'v4-research', x: 6720, y: 7840, w: 1440, h: 2700, title: 'v4 · Ticker research · light', opts: { scheme: 'light' }, expand: 'fill', findings: 'RSH-04' },
  { name: 'V4MarketsDemo', screen: 'v4-markets', page: 'v4-research', x: 8280, y: 7840, w: 1440, h: 3300, title: 'v4 · Markets · demo build (dashed chips)', opts: { demo: true }, expand: 'fill', findings: 'X-09, TL-14' },
  { name: 'V4StateMatrixLight', screen: 'v4-state-matrix', page: 'v4-research', x: 0, y: 14660, w: 3220, h: 4200, title: 'v4 · State matrix · light', opts: { scheme: 'light' }, findings: 'RSH-04, DS-05–DS-08' },
  { name: 'V4NoteView390Light', screen: 'v4-note-view', page: 'v4-research', x: 5190, y: 0, w: 390, h: 6600, title: 'v4 · Note view · phone · light', opts: { scheme: 'light' }, findings: 'RSH-04' },
  { name: 'V4Markets834', screen: 'v4-markets', page: 'v4-research', x: 9840, y: 7840, w: 834, h: 4600, title: 'v4 · Markets · 834 tablet', findings: 'RSH-03' },
  { name: 'V4HybridDesk834', screen: 'v4-hybrid-desk', page: 'v4-data', x: 5670, y: 0, w: 834, h: 4400, title: 'v4 · Hybrid desk · 834 tablet', findings: 'TKR-08' },
  { name: 'V4HybridDesk390Light', screen: 'v4-hybrid-desk', page: 'v4-data', x: 6624, y: 0, w: 390, h: 5200, title: 'v4 · Hybrid desk · phone · light', opts: { scheme: 'light' }, findings: 'RSH-04' },

  // ---- v4 · Coverage (wave 5, 2026-10-13) ----
  { name: 'V4Coverage', screen: 'v4-coverage', page: 'v4-coverage', x: 0, y: 0, w: 1920, h: 2600, title: 'v4 · Coverage matrix · route × width × theme × states', findings: 'coverage; gaps listed in the matrix' },
];

/** v4 · App: one row per route — desktop 1440 dark, phone 390, light 1440, states — with room above
 *  each row for the findings notes. */
function appRows() {
  const R = [
    // [route label, base name, screen, desktop h, phone h, states screen, states h, findings, extras]
    ['Global shell', 'Shell', 'v4-shell', 1100, 844, 'v4-shell-states', 2500, 'X-01, SHL-01–SHL-05', [], 'v4-shell-phone'],
    ['Landing', 'Landing', 'v4-landing', 3000, 5000, 'v4-landing-states', 1700, 'LND-01–LND-04', []],
    ['Ticker desk (desktop and phone on v4 · Data states)', 'Desk', null, 0, 0, 'v4-desk-states', 2600, 'X-02, DS-02, DS-03, TKR-03, TKR-05', [['V4DeskLight', 'v4-hybrid-desk', 1440, 3400, 'Hybrid desk · light', { scheme: 'light' }]]],
    ['Scanner', 'Scanner', 'v4-scanner', 1600, 2400, 'v4-scanner-states', 1900, 'SCN-01–SCN-04, X-11', []],
    ['Positions', 'Positions', 'v4-positions', 1600, 2600, 'v4-positions-states', 2000, 'POS-01–POS-04', [['V4PositionsSignedOut', 'v4-positions-signedout', 1440, 900, 'Positions · signed out (wall)', {}]]],
    ['Alerts', 'Alerts', 'v4-alerts', 1400, 2400, 'v4-alerts-states', 1700, 'ALR-01–ALR-03, Q-5', []],
    ['Settings', 'Settings', 'v4-settings', 2000, 2900, 'v4-settings-states', 1700, 'SET-01–SET-03', [['V4SettingsSignedOut', 'v4-settings-signedout', 1440, 1500, 'Settings · signed out', {}]]],
    ['Methodology', 'Methodology', 'v4-methodology', 2200, 3800, 'v4-docs-states', 1700, 'DOC-01, DOC-02', []],
    ['Blog', 'Blog', 'v4-blog', 900, 1500, null, 0, 'DOC-04', []],
    ['Lab', 'Lab', 'v4-lab', 1500, 2900, null, 0, 'DOC-03', []],
    ['404 and route fallback', 'NotFound', 'v4-not-found', 900, 1000, null, 0, 'DOC-04, DOC-05', []],
    ['Sign in and the wall', 'SignIn', 'v4-dlg-sign-in', 1000, 1000, 'v4-dlg-sign-in-states', 1700, 'DLG-04, POS-03', []],
    ['Trade entry', 'TradeEntry', 'v4-dlg-trade-entry', 1100, 1300, 'v4-dlg-trade-entry-states', 1800, 'DLG-01', []],
    ['Order detail', 'OrderDetail', 'v4-dlg-order-detail', 1000, 1100, 'v4-dlg-order-detail-states', 1200, 'DLG-02', []],
    ['What’s sent drawer', 'WhatsSent', 'v4-dlg-whats-sent', 1000, 1100, 'v4-dlg-whats-sent-states', 1800, 'DLG-03', []],
    ['Persona', 'Persona', 'v4-dlg-persona', 1000, 1100, 'v4-dlg-persona-states', 1100, 'DLG-05', []],
    ['Scan view editor', 'ViewEditor', 'v4-dlg-view-editor', 1000, 1200, 'v4-dlg-view-editor-states', 1100, 'DLG-06', []],
    ['Operator', 'Operator', 'v4-operator', 1200, 1500, 'v4-operator-states', 1100, 'OPS-01, OPS-02', []],
  ];
  const out = [];
  let y = 0;
  for (const [label, base, screen, dh, ph, st, sth, findings, extras, phoneScreen] of R) {
    let x = 0, rowH = 0;
    const add = (name, scr, w, h, title, opts = {}, expand = false) => { out.push({ name, screen: scr, page: 'v4-app', x, y, w, h, title, opts, findings, ...(expand ? { expand: 'fill' } : {}) }); x += w + 120; rowH = Math.max(rowH, h); };
    if (screen) {
      add(`V4${base}`, screen, 1440, dh, `v4 · ${label} · desktop`, {}, true);
      add(`V4${base}390`, phoneScreen || screen, 390, ph, `v4 · ${label} · phone`);
      add(`V4${base}Light`, screen, 1440, dh, `v4 · ${label} · light`, { scheme: 'light' }, true);
    }
    for (const [n, scr, w, h, t, o] of extras) add(n, scr, w, h, `v4 · ${t}`, o, true);
    if (st) add(`V4${base}States`, st, 1440, sth, `v4 · ${label} · states`);
    y += rowH + 420;
  }
  return out;
}

export const annotations = [
  { id: 'note-tweaks', page: 'page-1', w: 560, text: 'Ticker desk — the tweak chips switch readState (idle · loading · trade · no_trade · stale · cooldown · signed_out · no_key), live (pulses, particles, trail), scheme (dark · light) and the phone sheet (open · peek). Click “Analyze current snapshot” to run loading → trade; Field / Magnet switches the hero. Expand this frame and resize your window: the layout is fluid.' },
  { id: 'note-resp', page: 'page-2', w: 620, text: 'Same source, five widths. Every frame here renders the identical page body through one set of media and container queries — nothing is redrawn by hand. The phone desk docks the AI read as a bottom sheet; tables become cards under 1000px; the settings rail becomes tabs under 900px.' },
  { id: 'note-site', page: 'page-3', w: 520, text: 'Site surfaces at 1440. Copy is grounded in the product (69-name universe, ~60s desk cadence, ~3-min scanner sweep, 7–45 DTE, simulated book, BYO key); all prices, P/L, scores and timestamps are sample values.' },
  { id: 'note-dialogs', page: 'page-4', w: 520, text: 'Every overlay and gate in the product: sign-in and the private-testing wall, the one shared sim trade-entry dialog in both variants (with the six binding disclosures verbatim), the egress drawer, persona editing, order detail in both coverage states, the scan view editor, route fallback, 404, and the two operator surfaces.' },
  { id: 'note-v4-data', page: 'v4-data', x: 0, y: -520, w: 900, text: 'v4 · Data states (2026-10-13). The hybrid site: live where free public data reaches, honestly not live where the paid options feed is needed. Source map → state matrix → the NVDA desk in both honest options (explain, or a labelled sample). Every board names the review findings it resolves (design/REVIEW-2026-10-13.md). Figures are illustrative design values.' },
  { id: 'note-v4-tools', page: 'v4-tools', x: 0, y: -520, w: 900, text: 'v4 · Tools from public data (2026-10-13). Source of truth: docs/public-data/CANDIDATES.md and its status words (live · switch · build · verify · blocked). Top row: the roadmap and the built research pages, re-sourced and joined by the new tools. Rows below: one sheet per priority tool with desktop, phone and every state. Blocked tools draw their design target with illustrative values; the gate is open question Q-1.' },
  { id: 'note-v4-app', page: 'v4-app', x: 0, y: -520, w: 900, text: 'v4 · App (2026-10-13). One row per route: desktop 1440 dark, phone 390, light 1440, then the route’s states board. The ticker desk’s desktop and phone boards are on v4 · Data states. Findings per route: design/REVIEW-2026-10-13.md (wave 3). Figures are illustrative design values.' },
  { id: 'note-v4-research', page: 'v4-research', x: 0, y: -520, w: 900, text: 'v4 · Research refresh (2026-10-13). The note view with neutral directions supersedes the research canvas’s Main board (that canvas is left as it is); the index with its tabs; phone boards for Markets, Filings, Scorecard and ticker research; light boards for every research page and the state matrix; Markets in the demo build.' },
  { id: 'note-system', page: 'page-5', w: 560, text: 'The library is generated from tokens/tokens.json and src/components — every state shown there is a registered state. The light renders prove the scheme is a token swap, not a second layout.' },
];

/** Row-flow layout per page: 120px between frames, 140px between rows, wrap at 6400px. An artboard
 *  that carries its own x/y (the v4 pages, which leave room above each row for its findings note)
 *  keeps them. */
export function layout() {
  const placed = [];
  for (const p of pages) {
    let x = 0, y = 0, rowH = 0;
    for (const a of artboards.filter((b) => b.page === p.id)) {
      if (a.x !== undefined && a.y !== undefined) { placed.push({ ...a }); continue; }
      if (x > 0 && x + a.w > 6400) { x = 0; y += rowH + 140; rowH = 0; }
      placed.push({ ...a, x, y });
      x += a.w + 120;
      rowH = Math.max(rowH, a.h);
    }
  }
  return placed;
}

export function canvasJson() {
  return {
    pages,
    artboards: layout().map(({ name, screen, page, w, h, title, expand, x, y }) => ({
      file: `${name}.dc.html`, title, x, y, w, h, page,
      ...(screen === 'desk' ? { is_interactive: true } : {}),
      ...(expand ? { expand } : {}),
    })),
    annotations: [
      ...annotations.map((n) => ({ id: n.id, x: n.x ?? 0, y: n.y ?? -150, w: n.w, page: n.page, text: n.text })),
      // v4: one findings note above every v4 board, naming the review IDs it resolves.
      ...layout().filter((a) => a.findings).map((a) => ({ id: `find-${a.name}`, x: a.x, y: a.y - 230, w: Math.min(a.w, 640), page: a.page, text: `${a.title}. Resolves ${a.findings}. Findings: design/REVIEW-2026-10-13.md.` })),
    ],
    launch: { view: 'canvas', page: 'page-1' },
  };
}
