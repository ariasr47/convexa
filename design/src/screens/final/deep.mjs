// Final · Convexa v1 — deep group (wave 2): the AI read in depth (after the desk) and the remaining
// overlays (after the dialogs row). Renderers live in ./deep-read.mjs and ./deep-overlays.mjs. Facts in
// the specs were read from the shipped app (2026-10-14); file:line cites are on main.
import { TK_CSS } from './ticker-desk.mjs';
import { DR_CSS, analysisBody, exportBody, peekBody, productionBody, sheetBody, statesBody as readStates } from './deep-read.mjs';
import { OV_CSS, archiveBody, expandBody, notifyBody, reassessBody, resetBody, resetPageBody, sheetsBody, statesBody as overlayStates, viewsBody } from './deep-overlays.mjs';

const D = 'apps/dashboard/src/app/';
const AI = `${D}pages/ticker/widgets/ai-rec/`;
const ENV = 'Env 2026-10-14';

const AI_READ = {
  title: 'AI read',
  route: '/ticker/:ticker · the read panel, its drawers and the phone sheet',
  job: 'Ask for a risk-first read of one ticker’s current dealer structure, see exactly what it was given and how much of it traces to Convexa’s numbers, and never mistake it for an order.',
  env: {
    production: 'Not live. A read reads the options structure (walls, flip, flow, candidate contracts), which needs the Massive feed. The panel says what it would show and why it is off, links “See it on the demo →”, and the export says nothing is sent. No request to /api/recommendation/*.',
    staging: 'The demo’s “Sample analysis · SPY”: an authored no-trade read for the scenario’s expiry set (Careful sample reader, Oct 7, 2:30 PM ET). No model is called, no key, no cooldown or limit. The full-analysis drawer, the sample export and, on a phone, the read sheet all open on it.',
  },
  widgets: [
    { name: 'Read panel (wide brief / rail)', source: 'GET /api/recommendation/status/{T}; POST /api/recommendation/{T} on request · reader’s own key · pinned to the snapshot', production: 'notLive', staging: ['sample', 'Sample read'] },
    { name: 'Full analysis & data drawer (560)', source: 'The pinned read: summary, rationale, levels from the bundle, numbers said, cited contract, grounding counts, cap check, as-sent inputs', production: 'notLive', staging: ['sample', 'Sample read'] },
    { name: 'Export drawer (420)', source: 'GET /api/recommendation/export/{T} · demo: authored export, every category marked not sent', production: ['notLive', 'Nothing sent'], staging: 'sample' },
    { name: 'Phone read sheet', source: 'Same panel under 768px, portalled into a bottom sheet; peek row carries the verdict', production: 'notLive', staging: ['sample', 'Sample read'] },
    { name: 'Grounding (traced / untraced)', source: 'Server-side check of each figure against the snapshot (rec.grounding)', production: '—', staging: ['sample', '3 of 4 traced'] },
  ],
  states: [
    { tag: 'notLive', when: 'Production, always: would show / off because / See it on the demo →. Replaces “Market data is paused.”' },
    { tag: ['sample', 'Sample read'], when: 'Staging, always: the authored read in a dashed, hatched frame; “This is an authored example. No model was called.”' },
    { tag: ['error', 'Couldn’t load'], when: 'Staging: “Sample data could not load.” with Retry demo; an earlier sample stays under “Showing the last sample.”' },
    { tag: 'Idle', when: 'Feed build, signed in, a key set, no read yet (A1a); with no fresh edge, a footnote and “Ask anyway” (A1b, A1c over a read).' },
    { tag: 'loading', when: 'Request in flight (A2): three named steps, skeletons in the result’s shape.' },
    { tag: 'Trade', when: 'A3: verdict first; the verdict word is the panel’s only amber text; risk before rationale.' },
    { tag: 'No trade', when: 'A4: a complete answer, same weight; the action becomes “Alert me at …”.' },
    { tag: ['stale', 'Older snapshot'], when: 'A5 over any produced read: a newer snapshot arrived; burnt orange strip with Refresh analysis.' },
    { tag: 'Cooldown · daily limit', when: 'A6a / A6b: the last read stays pinned; the wait or the reset time in words.' },
    { tag: 'locked', when: 'A7, feed build, signed out: “Sign in to ask the AI for a read.”; the export link stays.' },
    { tag: ['notConfigured', 'Add a key'], when: 'A8: eight powering reasons, one frame, never collapsed.' },
    { tag: 'error', when: 'A10: the request failed; cause + Retry; a pinned read is never evicted by a failed refresh.' },
  ],
  phone: 'Under 768px the whole panel moves into a bottom sheet (radius 16, max 85% of the viewport, 320 ms). It opens expanded when a read lands; a chevron minimizes it to a 60px peek row carrying only the verdict (and the Sample tag on staging), and the peek row reopens it. Actions stack full width at 44px. With no verdict yet (idle, loading, signed out) there is nothing to peek at, so the panel stays inline. Both drawers become full-width sheets.',
  acceptance: [
    'Production /ticker/NVDA: zero requests to /api/recommendation/*; the read shows Not live with “Would show”, “Off because” and a link to https://staging.convexa.pages.dev/ticker/NVDA.',
    'Staging /ticker/SPY: the panel is titled “Sample analysis · SPY”, carries the Sample tag and “No model was called”, and its verdict reads “No trade · sit this one out”, the same words as the desk board.',
    'Staging: “Full analysis & data” opens a 560px drawer whose grounding line reads “Checked 4 · traced 3 · untraced 1 · not checkable 0”, matching “3 of 4 figures trace to Convexa” on the panel.',
    'Staging: the export drawer is titled “Sample analysis export · SPY”; its banner says nothing was sent; the three not-sent categories say why (the demo calls no model), not “you haven’t set this”.',
    'At 393px with a read on screen, exactly one verdict node exists: minimizing unmounts the sheet body and mounts the peek row; tapping it restores the sheet.',
    'The only amber text in the panel is the Trade verdict word; No trade is never red or amber; stale uses burnt orange with the warning icon.',
    'Escape closes either drawer and returns focus to the control that opened it.',
  ],
  built: [
    { status: 'shipped', what: 'The read’s state machine: 15 request × 6 result states folded into ten body cases and three annexes (readLayout.ts, presentationPolicy.ts), the panel, AnalysisSurface (560 drawer), StateExportDrawer (420), ReadSheet with the peek row.' },
    { status: 'shipped', what: 'The demo read: an authored no_trade per expiry set (libs/api/src/lib/demo/transport.ts:494-530), status in_app_enabled false, the “Sample analysis export” header.' },
    { status: 'shipped', what: 'Demo panel takes the live anatomy (2026-10-14): ReadSheet with its peek row, DecisionCard (Why, Re-engage), “Full analysis & data”, on the scenario clock; the summary leads with the variant (“Authored sample: SPY shows … authored score 74”).' },
    { status: 'partial', what: 'Demo export: every category is sent:false, so candidates, risk inputs and open positions read “Not sent — you haven’t set this.”, which is wrong for the demo; the glossary section carries the sample paragraph.' },
    { status: 'todo', what: 'Production Not live panel and the nothing-sent export; today CommandDeck doesn’t render while paused and the status call 503s (useAiRecommendation.ts:113-142).' },
    { status: 'todo', what: 'Copy alignment: “AI unavailable — try again” → “Couldn’t get a read” with a cause; “AI recommendation · T” → “AI read · T”; “—” → “·” in the no-trade verdict to match the desk.' },
  ],
  rulings: ['P-1', 'P-2', 'P-3', 'P-4', 'P-11', 'P-13', 'Amber spent', 'canon rule 16', ENV],
  code: [`${AI}AiRecPanel.tsx · AiRecPanelBlocks.tsx · DecisionCard.tsx`, `${AI}AnalysisSurface.tsx · StateExportDrawer.tsx · ReadSheet.tsx`, `${AI}useAiRecommendation.ts · presentationPolicy.ts · readLayout.ts · copy.ts`, 'libs/api/src/lib/demo/transport.ts (recommendation, recommendationExport, recommendationStatus)', 'apps/api/src/routes/recommendation.rs', 'design/src/screens/final/deep-read.mjs'],
};

const OVERLAYS = {
  title: 'More overlays',
  route: 'dialogs on /positions, /ticker/:ticker, /alerts; /account/reset and /account/invite (proposed)',
  job: 'The smaller decisions that happen over a page: copying a reassessment request for a real holding, importing a track-record archive, reading one widget large, saving a positions view, letting alerts notify, and getting back into an invited account.',
  env: {
    production: 'Signed out visitors reach only the notification ask (Alerts on public data) and account recovery. Reassessment, archive and views sit on Positions, behind the private-testing wall; signed in they work as on staging, with a real Webull holding. Recovery exists only here.',
    staging: 'Always the demo account: the reassessment request for its one authored AAPL holding, the archive import, the expanded widget on the sample desk, the view dialogs. No sign-in or recovery anywhere.',
  },
  widgets: [
    { name: 'Reassessment request', source: 'The broker book (/api/broker/book, read-only Webull) · demo: one authored AAPL holding', production: ['locked', 'Sign in · then Snapshot'], staging: 'sample' },
    { name: 'Archive import / export', source: 'convexa.* stores in this browser (outcomes/archive.ts)', production: ['locked', 'Sign in · then Stored here'], staging: 'local' },
    { name: 'Expanded widget', source: 'Any desk widget’s own body (Widget.tsx)', production: 'Its widget’s state', staging: 'sample' },
    { name: 'View dialogs (name, rename, delete)', source: 'Positions customization store (this browser)', production: ['locked', 'Sign in · then Stored here'], staging: 'local' },
    { name: 'Browser notification ask', source: 'Notification API · the alerts store’s notifyBrowser flag', production: 'local', staging: 'local' },
    { name: 'Password reset / invitation', source: 'Proposed: POST /api/auth/reset, /api/auth/reset/confirm, /api/auth/invite/accept · needs an email sender', production: 'locked', staging: '— (none)' },
  ],
  states: [
    { tag: 'local', when: 'Archive, views and the notification setting live in this browser; the toasts say so.' },
    { tag: ['error', 'Declined'], when: 'Import declined (the file: unreadable, not ours, newer version); views can’t save while the store is faulted; reset link expired.' },
    { tag: 'Declined · your history', when: 'Stored history unreadable: the import stops before touching anything. Not an error style; no Retry.' },
    { tag: ['notConfigured', 'Blocked here'], when: 'The browser blocked notifications: where to change it; alerts still list.' },
    { tag: 'Not in this browser', when: 'No Notification API: says so; nothing to press.' },
    { tag: 'locked', when: 'Production: recovery and invitations; Positions overlays behind the wall.' },
    { tag: 'unavailable', when: 'Reset email or sign-in service down: says so, never “wrong email”.' },
    { tag: 'sample', when: 'Staging reassessment on the authored holding; the expanded sample chart keeps its dashed, hatched frame.' },
  ],
  phone: 'Under 600px each dialog is a bottom sheet: full width, a grab handle, actions stacked at 44px, the page dimmed behind. The expanded widget is a near-full-height sheet and its chart re-lays itself out (short labels, text ≥ 11px). The reset page is one column with 44px fields.',
  acceptance: [
    'Reassessment: the dialog shows the as-of basis above the request and offers only Copy request and Close; no control writes to the book or the brokerage.',
    'Archive: nothing is written before Import is pressed; after any import all three lines show, zeros included; a declined import says the existing data was not changed.',
    'Expand: the expanded dialog is the same widget body (same state tag and frame) at up to 1200 × 720; Escape returns focus to the expand control; reduced motion opens it instantly.',
    'Delete view names the view and says positions are unaffected; the destructive button is burnt orange with the word, never red.',
    'Notifications: the control reads “on” only while Notification.permission is “granted”; denied and unsupported each show their own sentence; “Turn off” stops them without a browser prompt.',
    'Reset: the confirmation reads the same for a registered and an unregistered email; a used or expired link shows no form and offers a new link.',
    'Staging: no “Sign in”, “Log in”, “Sign up” or reset control appears in any overlay.',
  ],
  built: [
    { status: 'shipped', what: 'Reassessment request (broker/reassess.tsx: “Build reassessment”, basis line, JSON, Copy request / Close), archive import with confirm, report and both decline classes (outcomes/ArchiveBlock.tsx), expand dialog with view-transition morph (Widget.tsx:509-562), view dialogs (CustomizationToolbar.tsx:604-694), the notification permission request and its denied / unavailable sentences (AlertsPage.tsx:271-276).' },
    { status: 'shipped', what: 'Reassessment on the demo: source “demo_sample” and a synthetic basis (“on the demo book as of Oct 7, 2026 · 2:30 PM ET · synthetic”), the Sample tag and Copied (reassess.tsx, 2026-10-15).' },
    { status: 'shipped', what: 'Notifications: Convexa’s ask before the browser prompt, “Browser notifications on” with Turn off (no browser prompt; off holds across a reload), and blocked / unavailable with nothing to press (BrowserNotifyControl.tsx, 2026-10-15).' },
    { status: 'shipped', what: 'Delete view: outlined burnt orange with the word (CustomizationToolbar.tsx, 2026-10-15).' },
    { status: 'todo', what: 'Account recovery and invitation acceptance: no reset endpoint, no token store, no email sender. The sign-in dialog has only log in / sign up today. Parked by owner (2026-10-14): the privacy page says to ask the owner.' },
  ],
  rulings: ['P-2', 'P-3', 'P-4', 'P-8', 'P-12', 'P-13', 'Amber spent', ENV],
  code: [`${D}features/trading/broker/reassess.tsx · BrokerTabPanel.tsx`, `${D}features/trading/outcomes/ArchiveBlock.tsx · copy.ts · archive.ts`, `${D}shared/ui/Widget/Widget.tsx`, `${D}features/trading/positions/CustomizationToolbar.tsx · labels.ts`, `${D}features/alerts/useAlerts.ts · pages/alerts/AlertsPage.tsx`, `${D}features/auth/AuthDialog.tsx · copy.ts · apps/api/src/routes/auth.rs`, 'design/src/screens/final/deep-overlays.mjs'],
};

export const ROWS = [
  {
    key: 'ai-read', after: 'desk', label: 'AI read', css: TK_CSS + DR_CSS, specH: 2677, spec: AI_READ,
    boards: [
      { id: 'staging', title: 'Staging · full analysis drawer', w: 1440, h: 1500, body: (o) => analysisBody(o) },
      { id: 'export', title: 'Staging · sample export drawer', w: 1440, h: 1020, body: (o) => exportBody(o) },
      { id: 'peek', title: 'Phone · staging · peek row', w: 390, h: 900, body: (o) => peekBody(o) },
      { id: 'sheet', title: 'Phone · staging · sheet open', w: 390, h: 1210, body: (o) => sheetBody(o) },
      { id: 'production', title: 'Production · Not live', w: 1440, h: 1230, body: (o) => productionBody(o) },
      { id: 'states', title: 'States', w: 1440, h: 3308, body: (o) => readStates(o) },
    ],
  },
  {
    key: 'overlays', after: 'dialogs', label: 'More overlays', css: OV_CSS, specH: 2450, spec: OVERLAYS,
    boards: [
      { id: 'reassess', title: 'Reassessment request · staging', w: 1440, h: 980, body: (o) => reassessBody(o) },
      { id: 'archive', title: 'Import archive · staging', w: 1440, h: 900, body: (o) => archiveBody(o) },
      { id: 'expand', title: 'Expanded widget · staging', w: 1440, h: 900, body: (o) => expandBody(o) },
      { id: 'views', title: 'Name this view · staging', w: 1440, h: 900, body: (o) => viewsBody(o) },
      { id: 'notify', title: 'Browser notifications · production', w: 1440, h: 900, body: (o) => notifyBody(o) },
      { id: 'reset', title: 'Reset password · production (designed)', w: 1440, h: 900, body: (o) => resetBody(o) },
      { id: 'reset-page', title: 'Set a new password · production (designed)', w: 1440, h: 900, body: (o) => resetPageBody(o) },
      { id: 'phone', title: 'Phone · bottom sheets', w: 390, h: 4291, body: (o) => sheetsBody(o) },
      { id: 'states', title: 'States', w: 1440, h: 3017, body: (o) => overlayStates(o) },
    ],
  },
];
