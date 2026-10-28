// Final · the screen tracker's inputs that don't live on a spec card (2026-10-15).
//
// Everything about a screen's items comes from its spec card (`built`, with `waits` and `ask` on the
// open ones). This file holds only what no card can: the Convexa version each built row shipped in, the
// owner's open questions, and the known issues that checks found on built screens. Update an issue's
// `status` when its fix merges (`fixed`, with the commit), and a question's when the owner answers it
// (`answered`, with the answer); never delete an entry, so the tracker keeps the record.

/** Why an open item is open. An open item with no `waits` is "To build". */
export const WAITS = {
  build: { word: 'To build', note: 'Buildable now; queued' },
  owner: { word: 'Waiting on you', note: 'Needs an answer from the owner' },
  parked: { word: 'Parked by you', note: 'An owner ruling parks it' },
  spend: { word: 'Needs paid data', note: 'Needs a licensed source' },
  decided: { word: 'Left out on purpose', note: 'Deliberate; the card says why' },
};

/**
 * The Convexa version each row on a built page shipped in (2026-10-28). Convexa has one version, the root
 * package.json's, in SemVer; 1.0.0 is the first release (the first push after 2026-10-28, tagged v1.0.0).
 * The rule: every row on a built page has an entry, the version of the release it first shipped in, set once;
 * a later change to a shipped row is a design/CHANGELOG.md entry, not a new value here. A row on a planned page
 * or the prototypes page has none until the release that moves it to a built page. The build fails on a
 * missing, extra or non-SemVer entry, or one after the package.json version (index.mjs).
 */
export const SHIPPED_IN = {
  scanner: '1.0.0',
  desk: '1.0.0',
  'ai-read': '1.0.0',
  technical: '1.0.0',
  note: '1.0.0',
  'research-index': '1.0.0',
  'research-markets': '1.0.0',
  'research-filings': '1.0.0',
  'research-scorecard': '1.0.0',
  positions: '1.0.0',
  alerts: '1.0.0',
  settings: '1.0.0',
  operator: '1.0.0',
  dialogs: '1.0.0',
  overlays: '1.0.0',
  landing: '1.0.0',
  methodology: '1.0.0',
  blog: '1.0.0',
  credits: '1.0.0',
  privacy: '1.0.0',
  terms: '1.0.0',
  'not-found': '1.0.0',
  shell: '1.0.0',
  foundations: '1.0.0',
  library: '1.0.0',
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
    id: 'Q-GITHUB-HREF',
    asked: '2026-10-22',
    status: 'answered',
    answered: '2026-10-25',
    answer: 'The repository, https://github.com/ariasr47/convexa',
    ask: 'The staging footer’s “GitHub ↗” link (spec 01, Q3): your GitHub profile, or the public repository?',
    why: 'docs/product/specs/2026-10-21/README.md, Owner decisions (S1-Q3). Asked while the staging footer shipped without the link; since 1ded978b (2026-10-25) it ships “GitHub ↗” to the repository.',
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
    id: 'Q-SAMPLE-ONCE',
    asked: '2026-10-22',
    status: 'answered',
    answered: '2026-10-22',
    answer:
      'Spec 3’s text: the bar is the page’s one “Demo · sample data”; a frame names the sample once, by a Sample or Demo source chip or else one word in its head; the “Sample note” kind pill stays (DESIGN_SYSTEM.md Amendments, 2026-10-22).',
    ask: 'D1 (spec 1 Q1, spec 3 Q2): on the demo, the bar is the page’s one “Demo · sample data”; does a sample frame with no source line still say “Sample” in its head (spec 3), or only show its dashed, hatched border (spec 1)?',
    why: 'docs/product/specs/2026-10-21/README.md, Owner decisions. The border and hatch never reach the accessibility tree. Holds up spec 1 steps 5 and 8, spec 3 commit (d), spec 4 C2, spec 5’s staging heading and spec 7 criterion 5. Under this answer spec 1’s criterion 12 is recounted and its criterion 13 takes the spec-3 form.',
  },
  {
    id: 'Q-BAR-AS-OF',
    asked: '2026-10-22',
    status: 'answered',
    answered: '2026-10-22',
    answer:
      'Yes: from 600px up the demo bar reads “As of Oct 7, 2026” (DESIGN_SYSTEM.md Amendments, 2026-10-22).',
    ask: 'D2 (spec 1 Q2): from 600px up, should the demo bar’s as-of read “As of Oct 7, 2026” rather than the brief’s “Sample scenario · Oct 7, 2026”?',
    why: 'docs/product/specs/2026-10-21/README.md, Owner decisions. The brief’s wording spends the page’s whole sample-word budget on chrome (6 of 6 at 1440). Below 600px the bar reads “Demo · sample data · Oct 7, 2026”, which needs no ruling. Spec 3’s desk and Scanner strings follow it.',
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
  // ---- Spec 08, the trade journal (docs/product/specs/2026-10-26/08-trade-journal.md): its 19 questions, recorded
  // at its step 0 by the 2026-10-21 README's rule (Owner decisions). Questions 1 to 16 were answered by the owner on
  // 2026-10-28, every recommendation taken as written; 17 to 19 were added after the canon review the same day and
  // answered under his standing instruction for the journal (take every recommendation), so each can be reversed
  // before its slice is built (1b for 19, 2 for 17 and 18). The spec's "Owner answers (2026-10-28)" is the record.
  {
    id: 'Q-JOURNAL-01', asked: '2026-10-26', status: 'answered', answered: '2026-10-28',
    answer: 'Tabs on Positions: Book · Journal · Review · Rulebook, and no sixth nav link. Revisit with a nav amendment after four weeks of daily use.',
    ask: 'Spec 08, Q1: does the journal live in Positions’ tabs, or get a sixth nav link?',
    why: 'Rule 19 allows five links; Positions is already behind the sign-in wall and TopNav lights it for every /positions/* path. Held step 0 and slice 1a’s routes.',
  },
  {
    id: 'Q-JOURNAL-02', asked: '2026-10-26', status: 'answered', answered: '2026-10-28',
    answer: 'Approved as written: the pen glyph, Positions’ section tabs, the ⌘K “Write” group and rule 16’s verdict-free scope are DESIGN_SYSTEM.md Amendments rows of 2026-10-28; [journal-figures-stay-in-journal] is a PROJECT_CONTEXT record.',
    ask: 'Spec 08, Q2: approve the five canon rows (Design → Canon events)?',
    why: 'Each is an Amendments row, appended, never rewritten. Held step 0 (pen, tabs), slice 1b (⌘K) and slice 4 (rule 16’s scope).',
  },
  {
    id: 'Q-JOURNAL-03', asked: '2026-10-26', status: 'answered', answered: '2026-10-28',
    answer: 'Yes: the journal is its own store with its own rule and no exit; AC-29a stays as written.',
    ask: 'Spec 08, Q3: keep journal figures out of every other store, as a written rule, while AC-29a stays as written?',
    why: 'The journal holds exactly what AC-29a keeps out of decision records. Held slice 1a.',
  },
  {
    id: 'Q-JOURNAL-04', asked: '2026-10-26', status: 'answered', answered: '2026-10-28',
    answer: 'Yes, with reads off by default, per-entry exclusion and the eval gate first. The amendment was appended to DESIGN.md the same day (cc87d08c, corrected in b30b2664).',
    ask: 'Spec 08, Q4: send his real positions, balances, margin and words to his own AI provider, by a DESIGN amendment?',
    why: 'The analyst’s line was “Simulated only” (DESIGN.md:425). Holds slice 4 only; slices 1a to 3 call no model.',
  },
  {
    id: 'Q-JOURNAL-05', asked: '2026-10-26', status: 'answered', answered: '2026-10-28',
    answer: 'Anthropic only in slice 4; the other providers show “Not set up · journal reads run on an Anthropic key for now”.',
    ask: 'Spec 08, Q5: Anthropic only for journal reads at first?',
    why: 'The cost table, caching, structured output and refusal handling are specified for Anthropic. Holds slice 4.',
  },
  {
    id: 'Q-JOURNAL-06', asked: '2026-10-26', status: 'answered', answered: '2026-10-28',
    answer: 'Sonnet 5.5 for entry reads, Opus 5.5 at effort high for reviews; caps of $1.00 per run checked against the worst case, $5.00 a month, and 3 reviews and 60 entry reads a day; no automatic fallback.',
    ask: 'Spec 08, Q6: which models, and what caps?',
    why: 'A review at the sample’s size is about $0.31, and at worst $0.76. Holds slice 4.',
  },
  {
    id: 'Q-JOURNAL-07', asked: '2026-10-26', status: 'answered', answered: '2026-10-28',
    answer: '“Margin used” stays loan ÷ account value, with leverage beside it and loan ÷ position value in the ⓘ; his broker’s own figure is named there once he says which it is.',
    ask: 'Spec 08, Q7: what margin figure does your broker show?',
    why: 'Brokers differ: in the sample, Sep 18 reads 115% one way and 53.6% the other. Held slice 1a’s copy.',
  },
  {
    id: 'Q-JOURNAL-08', asked: '2026-10-26', status: 'answered', answered: '2026-10-28',
    answer: 'Yes: the chain-linked percent is the headline, with the dollars lost since the high beside it and account value alone in the ⓘ.',
    ask: 'Spec 08, Q8: measure “down from the high” with money in and out taken out?',
    why: 'Simple subtraction would let a deposit made to meet a call hide part of the loss. Held slice 1a.',
  },
  {
    id: 'Q-JOURNAL-09', asked: '2026-10-26', status: 'answered', answered: '2026-10-28',
    answer: 'No text-correction window at launch; later notes only. Revisit after a month.',
    ask: 'Spec 08, Q9: should saved text be correctable for a few minutes?',
    why: 'Sealing protects what he thought at the time; figures already get “Correct a figure”, which keeps the original. Held slice 1a.',
  },
  {
    id: 'Q-JOURNAL-10', asked: '2026-10-26', status: 'answered', answered: '2026-10-28',
    answer: 'Yes: the floor of 20 stays for every rate.',
    ask: 'Spec 08, Q10: keep the floor of 20 for every rate, knowing most rows will read “counted; rates start at 20” for months?',
    why: 'The early value comes from what needs no rate: events and their dollars, where the money went, cited counts, his words against his numbers, questions back. Held slice 3.',
  },
  {
    id: 'Q-JOURNAL-11', asked: '2026-10-26', status: 'answered', answered: '2026-10-28',
    answer: 'Yes: entries are read at review time, reading on every save is opt-in, and margin-call entries are never read on save.',
    ask: 'Spec 08, Q11: read entries at review time, with reading on every save opt-in?',
    why: 'Per-save reads cost more (a cold cache) and add per-entry noise. Holds slice 4.',
  },
  {
    id: 'Q-JOURNAL-12', asked: '2026-10-26', status: 'answered', answered: '2026-10-28',
    answer: 'Yes: the not-the-owner wall is its sentence and no tag; no amendment.',
    ask: 'Spec 08, Q12: is the not-the-owner wall left without a state word?',
    why: 'P-2 is closed and has no owner-only word; sign-ups are closed, so the wall is rare. Held slice 1a.',
  },
  {
    id: 'Q-JOURNAL-13', asked: '2026-10-26', status: 'answered', answered: '2026-10-28',
    answer: 'Yes: slices 1a to 3 now, with no model; slice 4 after its eval passes.',
    ask: 'Spec 08, Q13: build the journal ahead of the analyst roadmap?',
    why: 'Its runs and caps live in its own table, so it doesn’t wait on the analyst’s Phase 0. Held the order of every slice.',
  },
  {
    id: 'Q-JOURNAL-14', asked: '2026-10-26', status: 'answered', answered: '2026-10-28',
    answer: 'Yes, and done on 2026-10-28: on the full texts Notebook-first stays first overall (81.3 against 79.7), so the home stays the notebook; the Rulebook Loop won the owner-outcome lens, so grafts G1 to G8 were added (a council verdict, DECISION_LEDGER trade-journal-rejudge-grafts).',
    ask: 'Spec 08, Q14: re-run the two judge lenses that never saw the Rulebook Loop, before step 0?',
    why: 'Two of the three lenses never received its text. Held step 0.',
  },
  {
    id: 'Q-JOURNAL-15', asked: '2026-10-26', status: 'answered', answered: '2026-10-28',
    answer: 'Process strategies only, as rule drafts and questions back; market strategies belong to the analyst roadmap. A finding linked to gains never becomes a draft.',
    ask: 'Spec 08, Q15: what do “strategies” mean for the journal’s AI?',
    why: 'The number check can verify a count of his own behaviour, not a claim about a market. Holds slice 4’s prompt and the eval bar.',
  },
  {
    id: 'Q-JOURNAL-16', asked: '2026-10-26', status: 'answered', answered: '2026-10-28',
    answer: 'Deferred to a later spec: the printable rulebook card, CSV column mapping (paste stays) and the Monday auto-run, with their one board, so the board count falls from 44 to 43; the n ≥ 20 rate path and detector row 10 stay.',
    ask: 'Spec 08, Q16: defer the parts a single user won’t reach for months?',
    why: 'Most rows will read “counted; rates start at 20” for months, and the journal has one user. Held slices 2 and 5; the spec’s Scope → Deferred to a later spec lists them.',
  },
  {
    id: 'Q-JOURNAL-17', asked: '2026-10-28', status: 'answered', answered: '2026-10-28',
    answer: 'Yes (G1): a one-line reason is required to save a plan that goes ahead against a rule, never to trade (422 reason_required); Doesn’t apply and Not answered need none, and “broke” and “breaking” stay out of the copy. Under the owner’s standing instruction; reversible before slice 2.',
    ask: 'Spec 08, Q17: require a one-line reason to go ahead against a rule?',
    why: 'Added after the canon review: it reverses, in part, an item the approved spec rejected (e0236051). Holds G1 in slice 2 and criterion 30.',
  },
  {
    id: 'Q-JOURNAL-18', asked: '2026-10-28', status: 'answered', answered: '2026-10-28',
    answer: 'Yes (G3): at most 7 active rules (409 rule_limit); drafts and paused rules don’t count, and “Your drafts” keeps what he writes at the limit. Under the owner’s standing instruction; reversible before slice 2.',
    ask: 'Spec 08, Q18: cap active rules at 7?',
    why: 'Added after the canon review: it reverses an item the approved spec rejected (e0236051). Holds G3 in slice 2 and criterion 32.',
  },
  {
    id: 'Q-JOURNAL-19', asked: '2026-10-28', status: 'answered', answered: '2026-10-28',
    answer: 'Yes (G6’s label), his own label only: optional, sealed with the entry, never computed, suggested, counted or totalled, and never asked on a margin-call entry, a broker liquidation or a trim written while a call is open. Under the owner’s standing instruction; reversible before slice 1b.',
    ask: 'Spec 08, Q19: ask for his own decision label on a trim or close?',
    why: 'Added after the canon review: it reverses, for his own label only, an item the approved spec rejected (e0236051). Holds G6’s label in slice 1b and criterion 35’s label half.',
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
