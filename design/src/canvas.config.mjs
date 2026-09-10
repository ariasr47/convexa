// Canvas registry — which screens become artboards, at which widths, on which page. Positions are
// computed (row flow per page), so adding a frame is one line.
export const pages = [
  { id: 'page-1', name: 'Ticker desk' },
  { id: 'page-2', name: 'Responsive' },
  { id: 'page-3', name: 'Site' },
  { id: 'page-4', name: 'Dialogs & gates' },
  { id: 'page-5', name: 'System' },
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

  { name: 'Library', screen: 'library', page: 'page-5', w: 1440, h: 5400, title: 'Library · tokens, components, states, React mapping' },
  { name: 'Components', screen: 'components-sheet', page: 'page-5', w: 1440, h: 2720, title: 'Components & motion sheet' },
  { name: 'DeskLight', screen: 'desk', page: 'page-5', w: 1440, h: 2300, title: 'Desk · light scheme (interactive)', opts: { scheme: 'light' } },
  { name: 'LandingLight', screen: 'landing', page: 'page-5', w: 1440, h: 2960, title: 'Landing · light scheme', opts: { scheme: 'light' } },
];

export const annotations = [
  { id: 'note-tweaks', page: 'page-1', w: 560, text: 'Ticker desk — the tweak chips switch readState (idle · loading · trade · no_trade · stale · cooldown · signed_out · no_key), live (pulses, particles, trail), scheme (dark · light) and the phone sheet (open · peek). Click “Analyze current snapshot” to run loading → trade; Field / Magnet switches the hero. Expand this frame and resize your window: the layout is fluid.' },
  { id: 'note-resp', page: 'page-2', w: 620, text: 'Same source, five widths. Every frame here renders the identical page body through one set of media and container queries — nothing is redrawn by hand. The phone desk docks the AI read as a bottom sheet; tables become cards under 1000px; the settings rail becomes tabs under 900px.' },
  { id: 'note-site', page: 'page-3', w: 520, text: 'Site surfaces at 1440. Copy is grounded in the product (69-name universe, ~60s desk cadence, ~3-min scanner sweep, 7–45 DTE, simulated book, BYO key); all prices, P/L, scores and timestamps are sample values.' },
  { id: 'note-dialogs', page: 'page-4', w: 520, text: 'Every overlay and gate in the product: sign-in and the private-testing wall, the one shared sim trade-entry dialog in both variants (with the six binding disclosures verbatim), the egress drawer, persona editing, order detail in both coverage states, the scan view editor, route fallback, 404, and the two operator surfaces.' },
  { id: 'note-system', page: 'page-5', w: 560, text: 'The library is generated from tokens/tokens.json and src/components — every state shown there is a registered state. The light renders prove the scheme is a token swap, not a second layout.' },
];

/** Row-flow layout per page: 120px between frames, 140px between rows, wrap at 6400px. */
export function layout() {
  const placed = [];
  for (const p of pages) {
    let x = 0, y = 0, rowH = 0;
    for (const a of artboards.filter((b) => b.page === p.id)) {
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
    annotations: annotations.map((n) => ({ id: n.id, x: 0, y: -150, w: n.w, page: n.page, text: n.text })),
    launch: { view: 'canvas', page: 'page-1' },
  };
}
