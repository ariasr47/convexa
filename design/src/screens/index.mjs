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
  library: s('Library · tokens, components, states', 'System', 'Every token and component with its states and markup, plus the React mapping.', (o) => libraryBody(o), LIB_CSS),
  'components-sheet': s('Components sheet', 'System', 'The condensed component and motion sheet from the canvas.', () => componentsBody()),
};
