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
    id: 'Q-FINRA-TERMS',
    asked: '2026-10-15',
    status: 'open',
    ask: 'Create a free Individual account on developer.finra.org, accept its API Terms yourself, and provision a Public credential?',
    why: 'Researched 2026-10-15 (docs/public-data/FINRA-TERMS-2026-10-15.md): FINRA allows free, attributed, non-commercial display only through its API with a credential; the cdn.finra.org Reg SHO files fall under finra.org terms that need written consent. With the credential, Convexa moves all three datasets onto the API and production can turn FINRA back on.',
  },
  {
    id: 'Q-MOVE-MARKS',
    asked: '2026-10-15',
    status: 'answered',
    answered: '2026-10-16',
    answer: 'Keep: an API deploy clears the “moved from” marks; the date shown is always right.',
    ask: 'Calendar “moved from” marks: is it fine that an API deploy clears them (provisional: yes)?',
    why: 'Wave 1 review W1-26. The marks live in memory; keeping them across deploys needs a database. The date shown is always right; only the “moved from” note resets. Built on the provisional answer.',
  },
  {
    id: 'Q-CLUSTER-MERGE',
    asked: '2026-10-15',
    status: 'answered',
    answered: '2026-10-16',
    answer: 'Keep: identical same-day buys reported by related filers count as one buy.',
    ask: 'Insider clusters: count identical same-day buys reported by related filers as one buy (provisional: yes)?',
    why: 'Wave 1 review W1-31. Stops one trade looking like several insiders buying. Side effect: unrelated insiders buying identical lots at an offering price on the same day also merge. Built on the provisional answer.',
  },
  {
    id: 'Q-SAMPLE-MERGE',
    asked: '2026-10-15',
    status: 'answered',
    answered: '2026-10-16',
    answer: 'Keep: returning staging visitors get new sample alerts merged in by id; their own edits stay.',
    ask: 'Returning staging visitors: merge newly added sample alerts into their saved ones by id (provisional: yes)?',
    why: 'Wave 1 review W1-53. Their own edits and deletions are kept. The same gap leaves an old filled sample order in place until Reset demo data. Built on the provisional answer.',
  },
  {
    id: 'Q-STORED-HERE-WORDS',
    asked: '2026-10-15',
    status: 'answered',
    answered: '2026-10-16',
    answer: '“Stored here” means kept in this browser or on your account (as built); the canon row supersedes answer (6).',
    ask: '“Stored here” means “kept in this browser or your account” (as built), not “this browser only” (as the canon row says)?',
    why: 'Signed-in Risk inputs are stored on the account, and Settings tags them Stored here. Methodology defines the word the wider way, which is the true one; the canon row would need a superseding line.',
  },
  {
    id: 'Q-HOOD-NI',
    asked: '2026-10-15',
    status: 'open',
    ask: 'research/HOOD says net income $573M for Q2 2026; the 10-Q tags NetIncomeLoss $561M. Which is right?',
    why: 'Found while adding concept cells (metadata only). The row was left without a concept cell; the note’s figure is unchanged until you decide.',
  },
  {
    id: 'Q-PEERS-SOURCE',
    asked: '2026-10-15',
    status: 'answered',
    answered: '2026-10-16',
    answer: 'Keep the peer lists in the API (xbrl_frames.rs) for now.',
    ask: 'Peer lists: keep them in the API (as built), or add a peers: field to each note’s front matter (as the Peers card says)?',
    why: 'Notes have no peers field today, so the lists live in xbrl_frames.rs. Moving them is a small change to the notes and the notes tool.',
  },
  {
    id: 'Q-DESK-HIERARCHY',
    asked: '2026-10-16',
    status: 'answered',
    answered: '2026-10-16',
    answer: 'Approved as built (2026-10-16): price, change and verdict first; the chart and every level on the first screen.',
    ask: 'Approve the ticker desk’s new visual hierarchy (Ticker desk row, “Before → after” board), or say what to change?',
    why: 'Built in the 2026-10-16 build round and redrawn on the desk boards; nothing ships until you rule. The board shows the real captures of both builds side by side.',
  },
  {
    id: 'Q-ROW-CLICK',
    asked: '2026-10-16',
    status: 'answered',
    answered: '2026-10-16',
    answer: 'Keep: a click on a row opens its preview, as Enter does; the symbol link and the preview’s desk link navigate.',
    ask: 'Scanner: a click on a row opens its preview (as built), or goes straight to the desk?',
    why: 'Built so mouse and keyboard behave alike (Enter on a row opens the preview). The symbol link and the preview’s “Open the desk” still navigate.',
  },
  {
    id: 'Q-PALETTE-NAMES',
    asked: '2026-10-16',
    status: 'answered',
    answered: '2026-10-16',
    answer: 'None for now: live rows show the symbol; no legal names in capitals, no hand-kept list.',
    ask: '⌘K company names for live tickers: SEC’s legal names (“NVIDIA CORP”), a static list in the repo, or none?',
    why: 'Site check D-13. universe.json lists symbols only; the only name source the API reads is SEC’s company_tickers.json, whose names are legal names in capitals and may not cover the ETFs.',
  },
  {
    id: 'Q-SEC-LOCAL',
    asked: '2026-10-15',
    status: 'answered',
    answered: '2026-10-15',
    answer: 'Yes: lanes may use the production SEC_USER_AGENT value locally, for sec.gov only, to save real responses.',
    ask: 'May build lanes use the production SEC_USER_AGENT string locally to save real SEC responses?',
    why: 'Unblocks 13F holdings and Peers, and a real-data check of insider clusters and figures against the filing (their saved Form 4 and company-facts files are illustrative).',
  },
  {
    id: 'Q-NOTES',
    asked: '2026-10-15',
    status: 'answered',
    answered: '2026-10-15',
    answer: 'Yes, metadata only (concept cells and a filing column); every note diff is shown with the push.',
    ask: 'May build lanes add XBRL concept names and a filing column to your published notes, or will you?',
    why: 'Figures against the filing reads “not linked yet” until a note names its concepts; filing events need each chart block to say which filing reported each bar.',
  },
  {
    id: 'Q-PRIVACY',
    asked: '2026-10-14',
    status: 'answered',
    answered: '2026-10-15',
    answer: 'The owner’s public GitHub profile is the contact route.',
    ask: 'A privacy contact address, or rule that “ask the site’s owner” is final.',
    why: 'Closes the Privacy page’s last open item.',
  },
  {
    id: 'Q-FINRA',
    asked: '2026-10-13',
    status: 'answered',
    answered: '2026-10-15',
    answer: 'Interim: FINRA data on staging only; production shows it as Off until the owner confirms the terms (Q-FINRA-TERMS).',
    ask: 'Do FINRA’s display terms allow short interest, Reg SHO daily volume and OTC data on a public site (Q-2)?',
    why: 'Off-exchange volume waits on it, and FINRA short interest and short-sale volume are already live on production.',
  },
  {
    id: 'Q-ALERTS-SERVER',
    asked: '2026-10-15',
    status: 'answered',
    answered: '2026-10-15',
    answer: 'No: alerts stay browser-checked, and the page says so.',
    ask: 'Should public-data alerts be checked on the server?',
    why: 'Today the reader’s browser checks them while Alerts is open. Server checks need somewhere to send a firing (there is no email service), so this is a product call.',
  },
  {
    id: 'Q-STORED-HERE',
    asked: '2026-10-15',
    status: 'answered',
    answered: '2026-10-15',
    answer: 'Yes: “Stored here” joins P-2’s state words.',
    ask: 'Add “Stored here” to P-2’s closed list of state words, or reword the Settings tags?',
    why: 'The Settings board uses it; the canon’s list doesn’t have it.',
  },
  {
    id: 'Q-COMING-UP',
    asked: '2026-10-15',
    status: 'answered',
    answered: '2026-10-15',
    answer: 'The Calendar board: staging shows the sample notes’ review triggers.',
    ask: 'Staging /research Coming up: the Notes index board (empty) or the Calendar board (every sample note due)?',
    why: 'The two boards disagree; the build follows the Notes index board.',
  },
  {
    id: 'Q-REVIEW-DUE',
    asked: '2026-10-15',
    status: 'answered',
    answered: '2026-10-15',
    answer: 'Keep it: every valued note turns Review due the day after each FOMC.',
    ask: 'Every valued note turns Review due on Oct 29, the day after the FOMC decision. Keep that rule?',
    why: 'The Calendar rule makes every valued note due after each FOMC; it will touch your production notes on the next push.',
  },
  {
    id: 'Q-RECENT-PAGES',
    asked: '2026-10-15',
    status: 'answered',
    answered: '2026-10-15',
    answer: 'No: ⌘K Recent lists tickers only.',
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
 * Source D = the site-wide check against the boards, 2026-10-15 (tmp/qa/REPORT-wave2-D.md; the fix
 * round reproduced each before fixing). `status`: open, fixed, partial (`left` says what is), decided
 * (closed by an owner ruling; `left` says which) or not_reproduced (`left` says why); `commit` is the fix round's merge. The Wave 1 review's 71 findings
 * (docs/handover/2026-10-15-review-wave1.md) were all fixed in the same round and are not listed here.
 */
const D = 'Site check · 2026-10-15';
export const ISSUES = [
  { id: 'D-01', source: D, sev: 'high', env: 'production', screens: ['Research tab · note'], status: 'fixed', commit: 'c478dc97', title: 'Note tables wrap one or two characters a line on phones and split numbers on desktop' },
  { id: 'D-02', source: D, sev: 'high', env: 'staging', screens: ['Ticker desk'], status: 'fixed', commit: '4884e3fd', title: 'The demo desk has no Sample tag and shows live-feed cues (live dot, “as-of 15s”, running tape)' },
  { id: 'D-03', source: D, sev: 'high', env: 'staging', screens: ['Scanner'], status: 'fixed', commit: 'ac817eca', title: 'The demo Scanner has no sample marking; row preview and “Your view” card missing' },
  { id: 'D-04', source: D, sev: 'high', env: 'staging', screens: ['Positions'], status: 'fixed', commit: '621b1f9d', title: 'The seeded limit order fills on load: $950 at risk and −$256 instead of $300 and −$53' },
  { id: 'D-05', source: D, sev: 'high', env: 'staging', screens: ['Research · Markets'], status: 'fixed', commit: '798aef49', title: 'The demo note-rate chart lists the 14 production notes' },
  { id: 'D-06', source: D, sev: 'high', env: 'both', screens: ['Landing'], status: 'fixed', commit: '342db5b5', title: 'The hero curve crosses the headline and buttons at 390 px' },
  { id: 'D-07', source: D, sev: 'medium', env: 'staging', screens: ['AI read'], status: 'fixed', commit: 'b9c2bd2f', title: 'Demo verdict only after a click; trace line missing; real-clock ages in the drawer' },
  { id: 'D-08', source: D, sev: 'medium', env: 'both', screens: ['Landing', 'Ticker desk'], status: 'fixed', commit: '342db5b5', title: 'Structure field: gamma sign by red/green only, amber flip line, lines through labels (P-11)' },
  { id: 'D-09', source: D, sev: 'medium', env: 'production', screens: ['Research · Markets'], status: 'fixed', commit: '798aef49', title: 'About 8 s of wordless grey blocks on a cold load; frames don’t name their metric (P-10)' },
  { id: 'D-10', source: D, sev: 'medium', env: 'production', screens: ['Overlays', 'Settings'], status: 'fixed', commit: 'ac817eca', title: 'Log in and signed-out Settings never say sign-ups are closed; disabled Google button looks enabled' },
  { id: 'D-11', source: D, sev: 'medium', env: 'both', screens: ['Research · Markets'], status: 'fixed', commit: '798aef49', title: 'The curve title averages a twist into “rose”' },
  { id: 'D-12', source: D, sev: 'medium', env: 'production', screens: ['Data sources and credits'], status: 'fixed', commit: '7197eee6', title: 'Undated “Updated”, a doubled “Wednesday”, stale daily sources marked Updated, early summary count' },
  { id: 'D-13', source: D, sev: 'medium', env: 'both', screens: ['Global shell'], status: 'decided', commit: 'ac817eca', left: 'company names for live tickers: none, by your ruling of 2026-10-16 (Q-PALETTE-NAMES)', title: '⌘K rows: wall-clock ages on sample data, no company names' },
  { id: 'D-14', source: D, sev: 'medium', env: 'both', screens: ['Methodology'], status: 'fixed', commit: '7197eee6', title: 'What’s live words disagree with Credits and the board; release schedules missing' },
  { id: 'D-15', source: D, sev: 'medium', env: 'both', screens: ['Methodology'], status: 'fixed', commit: '7197eee6', title: '“Open Scanner” is the primary though production walls the Scanner; the board makes Ticker primary' },
  { id: 'D-16', source: D, sev: 'low', env: 'both', screens: ['Foundations'], status: 'fixed', commit: 'e1062021', title: 'Amber on outlined and text buttons, the avatar and the active nav label (ruling A: make them neutral)' },
  { id: 'D-17', source: D, sev: 'low', env: 'production', screens: ['Operator'], status: 'fixed', commit: '7197eee6', title: '/_ops/research shows only the unlock form; archive sections missing' },
  { id: 'D-18', source: D, sev: 'low', env: 'both', screens: ['Research · Markets', 'Planned · Calendar'], status: 'fixed', commit: 'cfd0c9ae', title: 'Curve legend, 1-month line, “Inverted below 0”, FOMC outcomes and jump rail missing; ranged dates drop out of Coming up' },
  { id: 'D-19', source: D, sev: 'low', env: 'staging', screens: ['Research · Markets', 'Research · Filings', 'Settings'], status: 'fixed', commit: 'cfd0c9ae', title: 'Rates strip and Filings frames untagged; footnotes cite real sources; Settings sample panels solid' },
  { id: 'D-20', source: D, sev: 'low', env: 'production', screens: ['Research · Notes'], status: 'fixed', commit: '798aef49', title: 'Coming up out of date order; mini-chart captions don’t explain dashed bars' },
  { id: 'D-21', source: D, sev: 'low', env: 'both', screens: ['Research tab · note'], status: 'fixed', commit: '432aac5a', title: 'Demo note lacks chart, rail and tag; live note says “gTC Berlin”; “All research” cut off at 390' },
  { id: 'D-22', source: D, sev: 'low', env: 'staging', screens: ['Ticker desk'], status: 'fixed', commit: 'b9c2bd2f', title: 'Context captions cut off; no ▲/▼ in the masthead; read strip scrolls at 390; NVDA values equal SPY’s' },
  { id: 'D-23', source: D, sev: 'low', env: 'both', screens: ['Positions', 'Settings', 'Scanner', 'Alerts'], status: 'fixed', commit: 'ac817eca', title: 'Green PAPER chip; Settings forms and “25000”; walls column shows one wall; seeded rule shows only “Gamma flip”' },
  { id: 'D-24', source: D, sev: 'low', env: 'both', screens: ['Research · Scorecard', 'Research · Notes', 'Privacy', 'Terms and disclaimer'], status: 'fixed', commit: '432aac5a', title: 'Calibration labels overlap; index filter chips missing; trust-page headings differ' },
  { id: 'D-25', source: D, sev: 'low', env: 'both', screens: ['Landing'], status: 'fixed', commit: '342db5b5', title: 'FLIP DIST reads −0.8% where the board says +0.8%' },
  { id: 'D-26', source: D, sev: 'low', env: 'production', screens: ['Technical tab', 'Ticker desk'], status: 'not_reproduced', commit: '4884e3fd', left: 'dev server only: React StrictMode runs the embed effect twice; not in a production build', title: 'TradingView logs “Cannot listen to the event from the provided iframe” on every load' },
];
