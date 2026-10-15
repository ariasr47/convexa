// Final · the screen tracker's inputs that don't live on a spec card (2026-10-15).
//
// Everything about a screen's items comes from its spec card (`built`, with `waits` and `ask` on the
// open ones). This file holds only what no card can: the owner's open questions, and the known issues
// that checks found on built screens. Update an issue's `status` when its fix merges (`fixed`, with the
// commit), and a question's when the owner answers it (`answered`, with the answer); never delete an
// entry, so the tracker keeps the record.

/** Why an open item is open. An open item with no `waits` is "To build". */
export const WAITS = {
  build: { word: 'To build', note: 'Buildable now; queued' },
  owner: { word: 'Waiting on you', note: 'Needs an answer from the owner' },
  parked: { word: 'Parked by you', note: 'An owner ruling parks it' },
  spend: { word: 'Needs paid data', note: 'Needs a licensed source' },
  decided: { word: 'Left out on purpose', note: 'Deliberate; the card says why' },
};

/** Questions only the owner can answer. Items point at them with `ask: '<id>'`. */
export const OPEN_QUESTIONS = [
  {
    id: 'Q-SEC-LOCAL',
    asked: '2026-10-15',
    status: 'open',
    ask: 'May build lanes use the production SEC_USER_AGENT string locally to save real SEC responses?',
    why: 'Unblocks 13F holdings and Peers, and a real-data check of insider clusters and figures against the filing (their saved Form 4 and company-facts files are illustrative).',
  },
  {
    id: 'Q-NOTES',
    asked: '2026-10-15',
    status: 'open',
    ask: 'May build lanes add XBRL concept names and a filing column to your published notes, or will you?',
    why: 'Figures against the filing reads “not linked yet” until a note names its concepts; filing events need each chart block to say which filing reported each bar.',
  },
  {
    id: 'Q-PRIVACY',
    asked: '2026-10-14',
    status: 'open',
    ask: 'A privacy contact address, or rule that “ask the site’s owner” is final.',
    why: 'Closes the Privacy page’s last open item.',
  },
  {
    id: 'Q-FINRA',
    asked: '2026-10-13',
    status: 'open',
    ask: 'Do FINRA’s display terms allow short interest, Reg SHO daily volume and OTC data on a public site (Q-2)?',
    why: 'Off-exchange volume waits on it, and FINRA short interest and short-sale volume are already live on production.',
  },
  {
    id: 'Q-ALERTS-SERVER',
    asked: '2026-10-15',
    status: 'open',
    ask: 'Should public-data alerts be checked on the server?',
    why: 'Today the reader’s browser checks them while Alerts is open. Server checks need somewhere to send a firing (there is no email service), so this is a product call.',
  },
  {
    id: 'Q-STORED-HERE',
    asked: '2026-10-15',
    status: 'open',
    ask: 'Add “Stored here” to P-2’s closed list of state words, or reword the Settings tags?',
    why: 'The Settings board uses it; the canon’s list doesn’t have it.',
  },
  {
    id: 'Q-COMING-UP',
    asked: '2026-10-15',
    status: 'open',
    ask: 'Staging /research Coming up: the Notes index board (empty) or the Calendar board (every sample note due)?',
    why: 'The two boards disagree; the build follows the Notes index board.',
  },
  {
    id: 'Q-REVIEW-DUE',
    asked: '2026-10-15',
    status: 'open',
    ask: 'Every valued note turns Review due on Oct 29, the day after the FOMC decision. Keep that rule?',
    why: 'The Calendar rule makes every valued note due after each FOMC; it will touch your production notes on the next push.',
  },
  {
    id: 'Q-RECENT-PAGES',
    asked: '2026-10-15',
    status: 'open',
    ask: 'Should ⌘K Recent also list pages (as the board shows), not just tickers?',
    why: 'It needs one more browser storage key and a line on the Privacy page.',
  },
  {
    id: 'Q-AMBER',
    asked: '2026-10-15',
    status: 'answered',
    answer: 'A: the boards win; amber stays on the one primary action (DESIGN_SYSTEM.md Amendments, 2026-10-15).',
    ask: 'Outlined and text buttons: neutral as the boards draw them, or amber as the 2026-10-13 theme default?',
    why: 'Site check finding D-16.',
  },
];

/**
 * Known issues on built screens, from the checks that found them. `screens` uses the spec cards'
 * labels. `env`: where it shows (staging, production or both).
 * Source D = the site-wide check against the boards, 2026-10-15 (tmp/qa/REPORT-wave2-D.md, not yet
 * verified by a second agent; the fix workflow verifies each before fixing).
 */
const D = 'Site check · 2026-10-15';
export const ISSUES = [
  { id: 'D-01', source: D, sev: 'high', env: 'production', screens: ['Research tab · note'], status: 'open', title: 'Note tables wrap one or two characters a line on phones and split numbers on desktop' },
  { id: 'D-02', source: D, sev: 'high', env: 'staging', screens: ['Ticker desk'], status: 'open', title: 'The demo desk has no Sample tag and shows live-feed cues (live dot, “as-of 15s”, running tape)' },
  { id: 'D-03', source: D, sev: 'high', env: 'staging', screens: ['Scanner'], status: 'open', title: 'The demo Scanner has no sample marking; row preview and “Your view” card missing' },
  { id: 'D-04', source: D, sev: 'high', env: 'staging', screens: ['Positions'], status: 'open', title: 'The seeded limit order fills on load: $950 at risk and −$256 instead of $300 and −$53' },
  { id: 'D-05', source: D, sev: 'high', env: 'staging', screens: ['Research · Markets'], status: 'open', title: 'The demo note-rate chart lists the 14 production notes' },
  { id: 'D-06', source: D, sev: 'high', env: 'both', screens: ['Landing'], status: 'open', title: 'The hero curve crosses the headline and buttons at 390 px' },
  { id: 'D-07', source: D, sev: 'medium', env: 'staging', screens: ['AI read'], status: 'open', title: 'Demo verdict only after a click; trace line missing; real-clock ages in the drawer' },
  { id: 'D-08', source: D, sev: 'medium', env: 'both', screens: ['Landing', 'Ticker desk'], status: 'open', title: 'Structure field: gamma sign by red/green only, amber flip line, lines through labels (P-11)' },
  { id: 'D-09', source: D, sev: 'medium', env: 'production', screens: ['Research · Markets'], status: 'open', title: 'About 8 s of wordless grey blocks on a cold load; frames don’t name their metric (P-10)' },
  { id: 'D-10', source: D, sev: 'medium', env: 'production', screens: ['Overlays', 'Settings'], status: 'open', title: 'Log in and signed-out Settings never say sign-ups are closed; disabled Google button looks enabled' },
  { id: 'D-11', source: D, sev: 'medium', env: 'both', screens: ['Research · Markets'], status: 'open', title: 'The curve title averages a twist into “rose”' },
  { id: 'D-12', source: D, sev: 'medium', env: 'production', screens: ['Data sources and credits'], status: 'open', title: 'Undated “Updated”, a doubled “Wednesday”, stale daily sources marked Updated, early summary count' },
  { id: 'D-13', source: D, sev: 'medium', env: 'both', screens: ['Global shell'], status: 'open', title: '⌘K rows: wall-clock ages on sample data, no company names' },
  { id: 'D-14', source: D, sev: 'medium', env: 'both', screens: ['Methodology'], status: 'open', title: 'What’s live words disagree with Credits and the board; release schedules missing' },
  { id: 'D-15', source: D, sev: 'medium', env: 'both', screens: ['Methodology'], status: 'open', title: '“Open Scanner” is the primary though production walls the Scanner; the board makes Ticker primary' },
  { id: 'D-16', source: D, sev: 'low', env: 'both', screens: ['Foundations'], status: 'open', title: 'Amber on outlined and text buttons, the avatar and the active nav label (ruling A: make them neutral)' },
  { id: 'D-17', source: D, sev: 'low', env: 'production', screens: ['Operator'], status: 'open', title: '/_ops/research shows only the unlock form; archive sections missing' },
  { id: 'D-18', source: D, sev: 'low', env: 'both', screens: ['Research · Markets', 'Planned · Calendar'], status: 'open', title: 'Curve legend, 1-month line, “Inverted below 0”, FOMC outcomes and jump rail missing; ranged dates drop out of Coming up' },
  { id: 'D-19', source: D, sev: 'low', env: 'staging', screens: ['Research · Markets', 'Research · Filings', 'Settings'], status: 'open', title: 'Rates strip and Filings frames untagged; footnotes cite real sources; Settings sample panels solid' },
  { id: 'D-20', source: D, sev: 'low', env: 'production', screens: ['Research · Notes'], status: 'open', title: 'Coming up out of date order; mini-chart captions don’t explain dashed bars' },
  { id: 'D-21', source: D, sev: 'low', env: 'both', screens: ['Research tab · note'], status: 'open', title: 'Demo note lacks chart, rail and tag; live note says “gTC Berlin”; “All research” cut off at 390' },
  { id: 'D-22', source: D, sev: 'low', env: 'staging', screens: ['Ticker desk'], status: 'open', title: 'Context captions cut off; no ▲/▼ in the masthead; read strip scrolls at 390; NVDA values equal SPY’s' },
  { id: 'D-23', source: D, sev: 'low', env: 'both', screens: ['Positions', 'Settings', 'Scanner', 'Alerts'], status: 'open', title: 'Green PAPER chip; Settings forms and “25000”; walls column shows one wall; seeded rule shows only “Gamma flip”' },
  { id: 'D-24', source: D, sev: 'low', env: 'both', screens: ['Research · Scorecard', 'Research · Notes', 'Privacy', 'Terms and disclaimer'], status: 'open', title: 'Calibration labels overlap; index filter chips missing; trust-page headings differ' },
  { id: 'D-25', source: D, sev: 'low', env: 'both', screens: ['Landing'], status: 'open', title: 'FLIP DIST reads −0.8% where the board says +0.8%' },
  { id: 'D-26', source: D, sev: 'low', env: 'production', screens: ['Technical tab', 'Ticker desk'], status: 'open', title: 'TradingView logs “Cannot listen to the event from the provided iframe” on every load' },
];
