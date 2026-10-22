# Since you last looked: a 'what changed for X' read built from the data, with no AI

_Proposal, 2026-10-21; revised 2026-10-22 after the adversarial review. Kind: new-tool. Size: M. Depends on: research-demo-and-states (spec 4), step C2 for the staging part. The production part, Part A, can start at any time: it uses step B2's `filingTitle.ts`, or builds it at B2's path first if B2 hasn't landed (see Build plan). The staging part's tags also wait on owner decision D1 (States, Sample row)._

The revision re-measured everything it changed. Its scripts and output are in `tmp/ux-audit/spec-what-changed-since/rev/` (scratch, not committed): `prototype2.mts` (the revised rules over the staging seed and production's NVDA and TSM answers, exit 0), `height-probe.mjs` (a DOM prototype of the section inside production's note page, exit 0) and `timing-probe.mjs` (exit 0). Production was read with GET requests only; nothing was signed in or submitted.

## Why

DESIGN.md Q1 asks "What changed for X since I last looked, and does it matter?" (`docs/product/ai-analyst/DESIGN.md:62`). It is the owner's top question. Every input is already on the wire, but the inputs sit in five panels at the bottom of a long note, each with its own window, and nothing records when the reader last looked.

**Measured on 2026-10-22** (scripts and output in `tmp/ux-audit/spec-what-changed-since/`, scratch, not committed):

- **Production `/ticker/NVDA/research`, desk 1440×900.** The note's masthead ends at y=556. The panels that hold Q1's inputs start at y=19,829 (`#positioned`) and end at y=23,320 (`#filed-since`), on a 23,733 px page. That is 22 to 26 screens below the masthead (`probe.json`, `shots/production_desk_fold.png`).
- **Same route, phone 390×844.** The masthead ends at y=816. The panels run from y=33,447 to y=38,840 on a 39,432 px page, which is 40 to 46 screens down (`shots/production_phone_fold.png`).
- **Staging `/ticker/NVDA/research`.** The sample note is short, and the public-record band starts at y=1,968 on desk and y=3,174 on phone (`shots/staging_desk_fold.png`, `shots/staging_phone_fold.png`).
- **Each panel has its own window:**
  - Filings cover 90 days (`apps/api/src/services/public_data/edgar.rs:22`; `filed > today − 90`, `edgar.rs:190-192`).
  - Insider trades cover 365 days (`insider_trades.rs:23`). The staging sample answers 182 (`libs/api/src/lib/demo/public-data.ts:577`).
  - "Who holds it" shows the last complete 13F quarter only, and switches to the next quarter the day after its 45-day deadline (`edgar_13f.rs:9-11`, `:94-104`). On production that is the quarter to Jun 30, and 0 of 12 managers have filed the Sep 30 quarter yet (`prod-nvda.json`).
  - "Checked against the filing" reads the newest periodic report that has its figures in (`FiledFigures.tsx:164`).
  - FINRA reads Off on production (`shared/dataState/finraSwitch.ts:9`).
- **Nothing records a visit.** `recentTickers/store.ts` keeps symbols only (`store.ts:21-25`). A fresh production visit leaves one key, `convexa.theme-paint` (`probe.json`, `__storage`).
- **"Filed since this note" is anchored to the note, not to the reader.** It lists only filings after the note's date (`NotePublicPanels.tsx:102`). On production NVDA it says "Nothing yet. The note was written Oct 13, 2026.", but EDGAR answered six NVDA filings in its 90-day feed, filed Aug 14 to Sep 3 (`prod-nvda.json`). A reader who last looked in July has no panel that tells them what is new to them.

**Why now.** This is the cheapest new capability on the list, and it answers Q1 on both builds with data already on the wire:

- It is front-end only. It needs no key, no model and no licence change.
- On production it adds a working public feature where most desk panels say Not live.
- On staging it turns the note page from spec 4 into a story.
- It fixes the user-facing shape that the analyst's Q1 package (spec 6) will later fill.

### What the audit changed in the idea

Each input claim was checked against the code and the live sites. These are the claims that didn't hold:

1. **Placement.** `ResearchView.tsx` renders only the demo today. Live builds route to `NotesView` (`app.tsx:214-223`). Spec 4 (`04-research-demo-and-states.md`, Behaviour › "`/ticker/:symbol/research` on staging" › Ready row, and Build plan › C2) moves the demo note onto `NotesView` and `NoteView` and puts `NotePublicPanels` under it, so the section mounts in `NoteView` on both builds, not in `ResearchView`.
2. **Inputs.** The signature `changesSince(publicTicker, publicMarkets, since, now)` changes, for three reasons:
   - The production note page does not read `/api/public-data/markets`, by design: that answer is about 89 KB with no cache headers (`NotesView.tsx:198-202`). I measured 94,865 bytes with no `cache-control` header.
   - The results windows come from `/api/public-data/filings` (`PublicFilingsWire.results`), not from `/markets`.
   - FOMC days come from the Fed's dated table, `fomcDays(null)` (`NotesView.tsx:30`).

   So the function takes the same `CalendarInputs` the note already builds (`reviewTriggers.ts:51`). It adds no request.
3. **BLS and BEA.** These calendars are not inputs. Note triggers are FOMC decisions and results windows only (`reviewTriggers.ts:57-117`).
4. **"The largest 13F holder change among the 12 managers read."** The wire carries at most 8 holders (`edgar_13f.rs:53`, `edgar_13f.rs:745`), so the change is the largest among the 8 shown.
5. **"Shares short down about 9%."** That figure is the staging frame's finding from Apr 15 to Sep 30 ("Shares sold short fell about 9% since Apr 15, to 252M"). Under this spec's window rule for short interest (The window, below), the first-visit line compares the Sep 30 settlement with Jun 15, the last settlement certainly published before Jul 9: ▼ 2.3%, 257,836,740 to 252,000,235 shares (`rev/prototype2.mts` on a copy of the seed). The seed stays as it is (Open question 3).
6. **"FOMC Oct 28 makes the valuation due."** It is true, but Oct 28 is after the scenario day, so it is not a change in the window. It shows on a separate "Next" row.
7. **"Maps one-to-one onto the DESIGN.md §3 Q1 package sections."**
   - §3 defines no per-question sections (`DESIGN.md:171`).
   - Four kinds map onto Q1's evidence (`DESIGN.md:62`) and the §3 tools (`DESIGN.md:244-248`): filing, figures, insider and holders.
   - Short interest is Q13 evidence (`DESIGN.md:74`). The calendar is what makes a note due.
   - Q1's "the research note's kill criteria" is not covered by this slice.
   - Spec 6 (`06-analyst-phase0a-q1-package.md`, Behaviour › Sections) names its four sections `filings`, `insider_trades`, `holders` and `fundamentals`. The kinds here map onto them: `filing` to `filings`, `insider` to `insider_trades`, `holders` to `holders`, and `figures` to `fundamentals`.
8. **"Each line links to its panel below."** For filings this cannot hold, because no panel on the tab lists every filing in the window: `#filed-since` lists only filings after the note. Production filing lines link to the record itself on EDGAR. Staging filing lines link to Research → Filings, which lists the sample filings; spec 4 deletes `DemoNoteSide`, and with it the sample filing list (spec 4, Behaviour › "`/ticker/:symbol/research` on staging" › Dead code).
9. **8-K item words.** No item-meaning lookup exists in `apps/` or `libs/` today (grep for item titles: zero hits). Spec 4 step B2 adds it as `pages/research/filingTitle.ts`, with its table of SEC item captions (spec 4, Copy › Filing titles, a closed lookup).
10. **Production 13F data.** NORGES BANK reads `prior_shares: 0` while it holds 325,951,734 shares, so production's frame title says "the biggest change was NORGES BANK adding 1.3 points". `edgar_13f.rs:707-713` counts a manager whose prior 13F was read without the CUSIP as 0 shares. I did not verify whether Norges opened the position or the prior read missed it (Open question 1).
11. **"Insider buying only."** Q1's evidence names "open-market buys vs sales" (`DESIGN.md:62`). On production NVDA, 25 open-market sales by 3 insiders were filed Sep 2–23, and 16 of them are not marked as under a 10b5-1 plan (`rev/prod-nvda2.json`, transactions with `filed` in the window). Leaving sales out would let "nothing new" stand beside them, so the section gives sales one summary line (Line kinds).
12. **Foreign issuers.** TSM's ten 6-Ks (Aug 10 to Oct 15) carry kind `other`, no items, and the description "6-K", the form code itself. Its 13F rows are in receipts with `change_pts` null on every row, and its insider read reaches back only to Sep 2 (80 of 256 Form 4s read). Each case gets its own rule below (`rev/prod-tsm.json`, read 2026-10-22).

These claims were confirmed against the seed, with the Oct 7 scenario:

- 10-Q filed Aug 27 (`public-data.ts:401`). The idea's "diluted EPS $0.01 off the note" is true only of today's check frame: `demoFigures` adds a cent to the seed's $1.00 (`FiledFigures.tsx:67`, `public-data.ts:92`). Spec 4 step C2 retires `demoFigures`, and the demo's check frame then reads the sample note's own figures, as production reads the published note's (spec 4, Behaviour › "`/ticker/:symbol/research` on staging", "`demoFigures` goes"; Build plan › C2). Spec 4's rule 1 holds those figures to the 10-Q's, so the line says all 4 match (Worked examples, the staging list, line 1).
- 8-K Items 2.02 and 9.01 on Aug 27; 8-K Item 5.07 on Sep 24 (`public-data.ts:397-403`).
- A buying cluster of 3 insiders, Sep 14–19, whose last Form 4 was filed Sep 21 (`public-data.ts:588`).
- Sample holder D ▼ 0.6 (`public-data.ts:606`).
- Reset demo data clears every `convexa.demo.v1.` key (`libs/api/src/lib/demo/workspace.ts:28`, `:573-581`), so a stamp written through `demoStorageKey` is cleared with no new code.

## Who and when

- **The owner, on production.** Rodrigo opens `/ticker/NVDA/research` on Oct 22. If he last opened it on Oct 8, the section says "Nothing new since Oct 8.", says it checked filings, insider trades and 13F holders, says short interest is Off, and says the FOMC on Oct 28 makes the valuation due. He goes straight to the note. On a first visit in this browser it lists 7 changes since Jul 24, including the 10-Q (all 6 note figures match), three 8-Ks and the insider sales. It also says all 7 came before his Oct 13 note, so he knows the note may already cover them.
- **A recruiter or reviewer, on staging.** They open `/ticker/NVDA/research` from the landing. The first block under the masthead shows three changes: the 10-Q (every figure in the sample note matches it), an 8-K and a buying cluster. "All 7" adds the insider sales, the 13F cut and the short-interest move. The frame is dashed and hatched as sample, and every line jumps to its panel, or for a filing to Research → Filings. Under either D1 draft no line carries a Sample tag, and the heading never repeats the demo bar's "Demo · sample data"; whether the heading carries one Sample word waits on D1 (States, Sample row). They see that the product reads filings into a "what changed" answer with no model involved.

## Scope and non-goals

**In scope (slice 1):**

- One section on the ticker Research tab, on the latest note. The production part ships first; the staging part follows spec 4 step C2.
- One pure module, `changesSince.ts`: the lines, the window keys, the stamp gate and the advance rule.
- One per-ticker, last-seen store in this browser that survives corruption.
- One row on /privacy, and the `where` lines on /credits.
- One component module in the design catalog (`design/src/components/`).

**Non-goals:**

- The cross-name digest on `/research` (slice 2).
- Any change to the ticker desk (`/ticker/:symbol`). Its hierarchy is approved as built (DESIGN_SYSTEM.md Amendments, 2026-10-16, answer 1).
- Anything in ⌘K Recent, which lists tickers only by ruling (tracker `Q-RECENT-PAGES`).
- A price move: Q1's package has no price until analyst Phase 3 (`DESIGN.md:62`).
- One line per insider sale. Sales get one summary line per window, because most are routine and the insider panel itemises them.
- The note's own revisions, and kill criteria.
- Acceptance timestamps: the wire exposes `filed` dates only, and spec 6 adds `acceptanceDateTime` (spec 6, Scope and non-goals › In scope 1, Acceptance time; `DESIGN.md:183`).
- Account sync of the stamp (Open question 4).
- The section on older notes (`/ticker/:symbol/research/:slug`), and on tickers with no note (Open question 2).
- Changing the frame's own 13F wording. That is follow-up F1, conditional on Open question 1.
- Any AI, key or model call.

## Behaviour

### Where it sits

`NoteView` takes a `lead` render prop, rendered directly after `<Header>` and before the figure strip (`NoteView.tsx:709-711`). It is a render prop because `NoteView` owns what the section needs and `NotesView` doesn't have: `valued` comes from `allBlocks(note)` (`NoteView.tsx:665-668`), and `today` and the triggers are computed there (`:664-678`). `NotesView` passes the lead for the latest note only, the same rule `NotePublicPanels` follows (`NotesView.tsx:263`, `:289`). The section reuses the page's existing reads:

- `pub`, from `usePublicTicker` (`NotesView.tsx:196`);
- `results`, from `usePublicFilings` (`NotesView.tsx:203`);
- the `calendar` the note builds (`NotesView.tsx:204-207`).

**Staging needs spec 4 step C2.** These outputs of that step are required, and the staging ACs (1–4, and the staging half of 7) are blocked until it merges:

- `ResearchRoute` sends the demo through `NotesView` and `NoteView`, on the sample notes (spec 4, Build plan › C2);
- `NotePublicPanels` renders under the sample note, which gives staging the `#positioned`, `#insider-trades`, `#checked-filing` and `#fund-holdings` headings (spec 4, Behaviour › "`/ticker/:symbol/research` on staging" › Ready row). Today staging has none of `positioned`, `note-title` or `filed-since` (review probe, `tmp/ux-audit/review-what-changed-since/probe.json`);
- `NoteView` takes `today` (the scenario day on the demo) and the scenario-only calendar, FOMC dates and `DEMO_RESULTS_WINDOWS`, never the Fed's real table (spec 4, Behaviour › "`/ticker/:symbol/research` on staging"; `reviewTriggers.ts:146-149`);
- `sampleFrameSx`, the one shared sample treatment that spec 4 step C2 exports beside `ChartFrame` (`shared/charts/frame/sampleFrame.ts`, re-exported from `shared/charts/frame/index.ts`), used by `ChartFrame`, the note's strip and TL;DR, and this section: the dashed `textTertiary` border and the `hatch` stripe (spec 4, Design › Sample treatment, and Build plan › C2; drawn today inside `ChartFrame.tsx:113-131`).

The production part, Part A, can start at any time. It uses spec 4 step B2's `filingTitle.ts`, or builds it at B2's path first if B2 hasn't landed (Build plan › Part A).

### The window

- **`now`** is the ET calendar day, from `readerToday(mode, clock)`, and it governs the whole latest-note page:
  - On production it is the ET day of the wall clock, using `easternClock(now).slice(0, 10)` (`liquidityCalendar.ts:74-89`). EDGAR's filing dates are ET days. A reader's local day would skip filings: a reader in Tokyo at 06:45 on Oct 23 (17:45 ET on Oct 22) would be stamped Oct 23 before an Oct 22 filing reaches the wire on the API's next hourly check (`pages/trust/sources.ts:193`), and the next window would start after it.
  - `NotesView` passes the same day to `NoteView` as `today`, so the note's freshness, its "Next up" and the section agree. Today `NoteView` uses the reader's local day (`NoteView.tsx:664`). Spec 4 step C2 adds the `today` prop for the demo. Whichever of the two changes lands first adds it as `today?: string`, defaulting to `localToday()`. The cost is that after 9 PM Pacific time the note calls tomorrow "today" (Open question 5).
  - On staging it is always `DEMO_CALENDAR_TODAY`, `'2026-10-07'` (`libs/api/src/lib/demo/calendar.ts:11`), never the wall clock. Tracker D-07 was a real-clock bug on staging (`tracker-data.mjs:213`). The section shows the scenario day in its sub line (`Scenario · Oct 7, 2026`), as other sample frames do (`FiledFigures.tsx:258`), so the window's end is never hidden (P-3, rule 18's demo exception).
  - New code imports `DEMO_CALENDAR_TODAY`. It does not copy the local `DEMO_DAY` constants in `InsiderClusters.tsx:28` and `FiledFigures.tsx:31`.
- **`since` is inclusive and `now` is inclusive.** A change is in the window when `since ≤ date ≤ now`, where `date` is the line's window key (next list).
  - A change keyed after `now` is not listed yet. EDGAR dates a filing accepted after 5:30 PM ET with the next business day, so this happens. The next visit's `since` is at most today, which is before that date, so the line shows then. It is late but never lost.
  - The stamp is a day, not a time, so an item keyed on the day of the last visit shows again on the next visit. Repeating a line is safer than missing it silently.
- **The window key is the day the change reached the wire**, not the record's own date. The record's own date (`asOf`) is what the date column prints.

  | Kind | Window key (`date`) | Date column (`asOf`) | Why |
  |---|---|---|---|
  | `filing`, `figures` | `filed` | `filed` | A filing reaches the wire within the hour (`sources.ts:193`). Company facts can come up to 24 hours later, so the stamp is held while a fresh report's facts are missing (the advance rule). |
  | `insider` | the latest `filed` among the line's Form 4s | the same | Form 4 trades reach the wire with their filing (`InsiderTransactionWire.filed`). |
  | `holders` | the later of `quarterDeadline(quarter_end) + 1 day` and the latest shown row's `filed` | the latest shown row's `filed` | The wire shows only the last complete quarter and switches the day after its deadline (`edgar_13f.rs:83-91`, `:94-104`). Production NVDA's rows were filed Aug 7–14 but first appeared on Aug 15. Keyed on `filed`, a reader who visited Aug 14 and Aug 16 would see only T. Rowe's row (filed Aug 14) and lose the other seven. The API computes the switch from the UTC day (`mod.rs:1025`), never earlier than the ET day, so this key can only repeat a line. A late filer moves the key later, which also only repeats it. **Every row of the quarter counts**, not only the rows filed in the window. |
  | `shortInterest` | the earlier of `settlement + FINRA_LAG_DAYS` (14) and `now` | the settlement | FINRA publishes "about a week after each settlement date", and Convexa checks every 12 hours (`sources.ts:158`). A key later than the real publication day only repeats the line; an earlier one could skip it. So 14 days is an upper bound, with room for weekends, a holiday and the 12-hour check. Clamping to `now` keeps a settlement already on the wire inside the window. The build checks 14 against FINRA's published dissemination calendar before it ships. |
  | `calendar` | the decision day | the same | A scheduled date. |

  `quarterDeadline` is the TypeScript twin of `deadline()` (`edgar_13f.rs:83-91`: 45 days, moved to Monday from a weekend). Its spec pins the two dates the Rust test pins (`edgar_13f.rs:956-957`: Jun 30 → Aug 14, Sep 30 → Nov 16).
- **The first visit** to a ticker sets `since = now − 90 days` (DESIGN §3, `DESIGN.md:216-218`). That gives Jul 9 on staging and Jul 24 on production on Oct 22.
- **The 90-day floor.** `since` is never earlier than `now − 90`. An older stamp is clamped, and the heading says so.
  - The SEC feed starts the day after `now − 90` (`edgar.rs:191`), so a filing on the floor day itself can't be on the wire. This one-day edge is accepted and stated here.
- **How this differs from spec 6.** Spec 6's package window is `S < accepted ≤ C` on acceptance timestamps (spec 6, Behaviour › Sections, the `filings` and `insider_trades` rows). This slice has dates only, so it keeps the lower bound inclusive. Spec 6 serves no answer and adds no route or UI (spec 6, Scope and non-goals › Not in scope), so its package never fills this UI itself. When a later analyst phase serves the package here (Phase 1's desk panel and answers page, `DESIGN.md:508`, with analyst Phase 0 slice 0b (outside spec 6's scope, spec 6, Scope and non-goals › Not in scope) adding the `analyst_answers` table), the stamp becomes a timestamp and the lower bound becomes exclusive. That is the only change to the window.

### The advance rule

The store keeps one record per ticker:

```ts
type SinceRecord = {
  next: string;     // where the next day's window starts: the day of the last counted visit
  visited: string;  // the day of the last visit, counted or not
  shown: {          // what `visited`'s visit showed, so a same-day reload repeats it exactly
    since: string;
    heading: 'first' | 'return' | 'clamped' | 'held';
    lastVisit: string | null;
  };
};
```

`visitWindow(stored, now)` reads it:

| Stored record | `since` shown | Heading |
|---|---|---|
| none, unreadable, or `visited` after `now` (a changed clock) | `now − 90` | first visit |
| `visited` is `now` | `shown.since` | `shown.heading`, with `shown.lastVisit`: exactly what the first load today said, clamped or not |
| `visited` earlier, `next` before `now − 90` | `now − 90` | clamped, with the last visit's day |
| `visited` earlier, `next` before `visited` | `next` | held: the last visit wasn't counted |
| `visited` earlier, `next` equals `visited` | `next` | since your last visit |

`nextRecord(stored, shown, now, counted)` decides the write. Both functions are pure and both are pinned by tests:

- **A counted visit** writes `{ next: now, visited: now, shown }`.
- **A visit that isn't counted** writes `{ next: stored.next, visited: now, shown }` when a record exists, and writes nothing when none does, so the next visit is still a first visit.
- **Loading writes nothing.**
- On staging `now` never moves, so the list stays "Since Jul 9 (90 days, first visit)" until Reset demo data.

**When a visit counts: `stampable(changes)`.** A visit counts only when every kind was read, or is off for good. A kind that failed this visit could have changes that fall before the next visit's `since`, and they would never show. The gate is a pure function of `changesSince`'s answer: `stampable(c)` is `c.holds.length === 0`, and `holds` collects one reason per kind that blocks.

| Blocks the stamp (transient) | Does not block (permanent or complete) |
|---|---|
| SEC part stale (`tickerSecStale`, `secState.ts:24-25`) or down (`filings_state === 'unavailable'`) | FINRA `off` or `notSetUp` (`finraSwitch.ts:9`) |
| Company facts failed: `d.detail` names company facts, as the check frame reads it (`FiledFigures.tsx:240`) | Holders `hidden`, `notSetUp` or `empty` (`holdersView`, `holdersRead.ts:58-70`) |
| A periodic report in the window with no facts yet, filed within `FACTS_WAIT_DAYS` (3) of `now` | A periodic report still without facts after 3 days (TSM's 20-F filed Apr 16 has none: `rev/prod-tsm.json`). Its line says the figures aren't read |
| Holders `unavailable`, which includes "still being read" on the quarter-switch day (`edgar_13f.rs:901-906`), or a `last_good` holders copy | Insider partial coverage (`ready.partial`, `emptyPartial`: `secState.ts:41-48`). The API reads only the newest Form 4s, so the unread span never fills; it becomes a Not read row |
| Insider frame `unread` (`secState.ts:64`) | Insider `olderServer`, and `notSecFiler` (`secState.ts:31-32`) |
| FINRA on and `unavailable`, or a `last_good` short-interest copy | |

The whole-section failures (Couldn't load, Off server, SEC not set up, SEC down) never count, because nothing was read. Convexa reads company facts every 24 hours (`sources.ts:193`). The 3-day wait allows for that read plus a weekend, and it bounds how long a missing set of facts can hold the stamp: a 20-F whose facts never come (TSM's) stops holding after 3 days.

### The function

New file `apps/dashboard/src/app/pages/research/changesSince.ts`. It is pure: no React, no storage, no clock.

```ts
export type ChangeKind = 'filing' | 'figures' | 'insider' | 'holders' | 'shortInterest' | 'calendar';

export type ChangeLine = {
  kind: ChangeKind;
  /** YYYY-MM-DD the change reached the wire (or its safe upper bound, clamped to `now`); decides the window. */
  date: string;
  /** The record's own day, printed in the date column: filed, the last Form 4 filed, the latest 13F filed, the settlement. */
  asOf: string;
  text: string;
  /** `id` is the /credits anchor and the API's sources row id (pages/trust/sources.ts). */
  source: { id: 'sec' | 'finra-si' | 'schedules'; credit: string };
  /** The kind's words for the meta row, e.g. "quarter to Jun 30, complete after the Aug 14 deadline". */
  note: string | null;
  /** A word from the closed vocabulary (shared/dataState/vocabulary.ts). */
  state: DataStateKey;
  /** An in-page panel id, a link (EDGAR on production, a site page on staging), or nothing. */
  target: { panel: string } | { href: string } | null;
  /** `asOf` is before the note's date, so the note may already cover it. */
  beforeNote: boolean;
};

export type ChangesSince = {
  since: string;
  now: string;
  days: number; // daysBetween(since, now), format.ts
  lines: ChangeLine[]; // every change in the window, in package order
  next: ChangeLine | null; // the soonest calendar trigger after `now`
  checked: { kind: ChangeKind; text: string }[]; // read, and nothing new
  notRead: { kind: ChangeKind; state: DataStateKey; reason: string }[];
  holds: string[]; // why this visit can't count; empty when it can
};

export function changesSince(input: {
  ticker: PublicTicker;
  calendar: CalendarInputs; // reviewTriggers.ts:51
  note: { ticker: string; date: string; valued: boolean; aging: Aging };
  check: FiledCheck | null; // filedCheck() in filedCheck.ts: { rows, form, accession }; null when the note links no figures
  since: string;
  now: string;
  demo: boolean;
}): ChangesSince;

export function stampable(c: ChangesSince): boolean;
/** At most `max` (default 3) lines: the first line of each kind in package order, then the rest in package order. */
export function shownLines(lines: ChangeLine[], max?: number): ChangeLine[];
export function visitWindow(stored: SinceRecord | null, now: string): SinceRecord['shown'];
export function nextRecord(stored: SinceRecord | null, shown: SinceRecord['shown'], now: string, counted: boolean): SinceRecord | null;
export function readerToday(mode: DataMode, clock: Date): string;
export function quarterDeadline(quarterEnd: string): string;
export const FINRA_LAG_DAYS = 14;
export const FACTS_WAIT_DAYS = 3;
```

`filedCheck.ts` is new. It takes the check frame's filing inputs out of `FiledFigures.tsx`, where they are private today (`filingsOf` at `:83`, the newest-with-facts pick at `:164`). It exports `filedCheck(d, figures)`, which returns `{ rows: checkFigures(figures, filings), form, accession }`. The figures are the note's own on both builds: the published note's on production, and on the demo the sample note's, once spec 4 step C2 retires `demoFigures` (`:37`; spec 4, Behaviour › "`/ticker/:symbol/research` on staging", "`demoFigures` goes"). Until C2, `CheckFrame` keeps passing `demoFigures` on the demo, and the section is not on the demo until C2 (Where it sits), so the two never meet. `CheckFrame` and the section both call it with the same figures, so the line and the frame cannot check different figures.

### Line kinds

The kinds come in package order. On staging every line's state is `sample`; under either D1 draft the line does not draw it as a tag (States, Sample row). The production states are in the "State" column.

| Kind | In the window when | Text built from | State (production) | Target |
|---|---|---|---|---|
| `figures` | The newest periodic report (`ticker.periodic[0]`) is keyed in the window. One line, covering the report. | The lead fact is `Revenue`, else the first fact, as `FilingsPage.tsx:933` picks it. The value is from `formatBillions`, and the change is `figureChange(prior_value, value)` (`filings.ts:45-53`). The check clause is `filedFinding(check.rows, check.form, false)` verbatim (`FiledFigures.tsx:105-126`), when `check.accession` is this report. On staging the section's own sample treatment already says what the check frame's "In the sample" lead says (States, Sample row), so `demo` is false. With no facts yet, the line says its figures aren't read yet. | `computed` (`lastGood` when the SEC copy is stale) | panel `checked-filing` |
| `filing` | Each `ticker.filings` row keyed in the window, except the periodic report's accession, which the `figures` line covers. | **Company filings**, one line each: `<form>: <filingTitle(row)>`, with the 8-K items in brackets (spec 4's lookup and its lead-item rule, "+ N more": spec 4, Behaviour › "`/research/filings`" › Row titles on both builds, and Copy › Filing titles, a closed lookup). On production, EDGAR's `description` is added only when it says more than the form code, the test spec 4 uses for the Filings detail (same section). On staging it is never added: spec 4 step B2 writes every staging description to say more than the form code (spec 4, Copy › Staging seed descriptions), so that test would append one to every line, and the line's target, Research → Filings, already shows them. So a staging filing line's text is exactly `<form>: <filingTitle(row)>` and, for an 8-K, its items in brackets: the strings AC 1 checks. **A run of 3 or more company filings of one form with no items and no description beyond the form code** (TSM's 6-Ks) folds into one line with a count and a date span; the wire gives them nothing else to say. **Forms the company files as an investor**, not about itself (`N-PX`, `13F-HR`, `13F-NT`, and their `/A`), fold into one last line counted by form. | `updated` (`lastGood` when stale, `tickerSecStale`, `secState.ts:24-25`) | production: `{ href: filing.url }` (EDGAR); a fold: EDGAR's filing list for that company and form (`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=<cik>&type=<form>`). staging: `{ href: '/research/filings' }` |
| `insider` | Each API buying cluster (`insiders.clusters`, the rule in `insider_trades.rs:7-11,29-31,386-399`) whose last non-plan purchase Form 4 is keyed in the window. Then one line for non-plan open-market purchases in the window that sit outside every cluster. Then **one sales line** for the open-market sales filed in the window. Only Form 4s inside the read span count (partial coverage, below). | Insiders, days and trade-date span; roles, never names. The sales line gives the count, the insiders, the filed span and how many are not marked as under a 10b5-1 plan, and ends "No open-market buys." when there were none. | `computed` | panel `insider-trades` |
| `holders` | The quarter shown is keyed in the window (the window table). Every shown row counts. | Shares (`units: 'shares'`): the biggest absolute `change_pts` by `biggestChange(rows)` in `holdersRead.ts`, written with `changeText` (`holdersRead.ts:15-19`). `biggestChange` is the frame's current pick (`holdersRead.ts:37-41`), moved out unchanged so the frame and the line always agree. Follow-up F1 changes it for both at once, if Open question 1 is answered as recommended. Receipts, or any row with no `%` (`holdersRead.ts:32`): name the largest holder and its receipts, as `holdersFinding` does, and say no change is computed for receipts. | `delayed`, word "Delayed by law" (as `FundHoldings.tsx:179,219`) | panel `fund-holdings` |
| `shortInterest` | FINRA's part is live with a figure, and the latest settlement is keyed in the window. | Shares short at the latest settlement against the latest settlement whose key falls before `since`, using `figureChange`. | `delayed` | panel `positioned` (staging, after spec 4 step C2) |
| `calendar` | A `calendarTriggers()` event (`reviewTriggers.ts:57-117`) dated in the window: an FOMC decision after the note's date, for a valued note. | `FOMC_TRIGGER` | `computed` | `{ href: '/research/markets#coming-up' }` |

**Partial insider coverage.** When `history_filings_read < history_filings` and `history_reaches_back_to` is after `since`, the insider lines cover only `[history_reaches_back_to, now]`. A Not read row names the span that wasn't read and why. This is never "Checked, nothing new" (`secState.ts:41-48`).

**Order.**
- Package order is filings first: the `figures` line, then company filing lines newest first, then the investor-forms fold. Insider follows (clusters newest first, then other buys, then sales), then holders, short interest and calendar.
- `shownLines` picks at most 3 for the collapsed default: the first line of each kind present, then the rest in package order. The picked lines display in package order. "All N" shows every line.
- The order is fixed by kind, not by importance. Judging importance is the reader's job, or later the model's.

**Before this note.** When every line's `asOf` is before the note's date, the sub line says so once ("All 7 came before this note (Oct 13).") and no line carries a marker. When only some lines are earlier, those lines carry `before this note` in their meta. A reader who wrote or read the note can skip what it already covers.

**Rows that are not changes** (never counted in N):

- **Next.** The soonest calendar trigger dated after `now`: the next FOMC for a valued note, or the estimated results window (`ESTIMATE_TRIGGER`). One row.
- **Checked, nothing new.** Kinds read whose answer has nothing in the window, each with what was checked: filings; insider trades ("no open-market buys or sales filed"); 13F holders ("still the quarter to Jun 30; Sep 30 is due Nov 16, 0 of 12 managers filed", from `holders.window`); a FINRA part that is live but has no report (`publicPartGap` → `empty`, `vocabulary.ts:100-111`).
- **Not read.** Kinds whose source can't answer: FINRA `off`, `notSetUp` or `sourceDown`; holders `unavailable` or `notSetUp` (`holdersView`, `holdersRead.ts:58-70`); insider frame `unread` (`secState.ts:50-67`); the unread span of partial insider coverage; company facts that failed.
  - Each row carries its state word and reason.
  - The FINRA reason is the API's `short_interest_detail`, else `FINRA_OFF_REASON` (`finraSwitch.ts:12-13`). FINRA Off is always a visible row, never silence.
  - A kind whose answer is `hidden` or `olderServer` is left out of both lists.
- **Not counted.** One line when `holds` isn't empty: what blocked, and that the next visit starts from the same day.

### States

"Counted" means `next` moves to `now` (the advance rule).

| State | When | What shows | Counted |
|---|---|---|---|
| Loading | `pub.loading && !pub.data` | A `Skeleton variant="rounded"` at the collapsed shape's reserved height, with `aria-busy` and an `aria-label`, as the note page's skeletons are (`NotesView.tsx:212-218`). On production the note's asset finishes 55–100 ms before the ticker answer on every cold load (`rev/timing-probe.mjs`, 3 runs), so this state is seen every time and its height matters (Design). | nothing written |
| Couldn't load | `pub.error` or no data | One line and Try again (`pub.retry`). The tag is `couldntLoad`. | no |
| Off server | `d.state === 'off'` | One quiet line. The tag is `off`. | no |
| SEC not set up | `filings_state === 'not_configured'` | One line. The tag is `notSetUp`. | no |
| SEC down | `filings_state === 'unavailable'` and no filings | "Unknown, not empty". The tag is `sourceDown`. | no |
| Last good copy | SEC stale (`tickerSecStale`) | The lines show, with `lastGood`, plus a warning line with its icon (rule 5). | no |
| A kind down | Any other row of the "Blocks the stamp" table | The lines of the other kinds, that kind's Not read row, and the Not counted line | no |
| Empty | No lines | "Nothing new since <date>." plus the Checked and Not read rows | yes |
| List, collapsed (default) | 1 to N lines | Heading, sub line, up to 3 lines, then one footer row: "All N" when N > 3, Next, a compact Not read, and the `Stored here` tag with its ⓘ | yes |
| List, expanded | "All N" pressed | Every line, the Checked and Not read rows in full, the Stored here sentence, Sources, and FINRA's notice when a short-interest line shows; "Fewer" | — |
| Sample (staging) | `dataMode === 'demo'` | The shared sample frame, `sampleFrameSx` from spec 4 step C2 (spec 4, Design › Sample treatment; P-3, P-8); sub line `Scenario · Oct 7, 2026`. **No line carries a state tag** under either D1 draft: both give rows inside a frame no Sample tag. **The heading never takes `demo`** under either draft, because the demo bar is the page's one "Demo · sample data". **The heading's tag waits on D1** (spec 1 Q1, spec 3 Q2): none under spec 1's draft (border and hatch only), one `sample` tag ("Sample") under spec 3's (one word in the head). The sub line stays under both (spec 1, Scope and non-goals › Coordination with specs 03, 04 and 05). If the owner declines the shared row, the section keeps its first draft: `demo` on the heading and `sample` on every line (same section of spec 1). | yes; the scenario day |
| FINRA Off (production) | `short_interest_state === 'off'` | A Not read row: "Short interest" with the Off tag and the reason | yes (does not block) |
| Partial insider coverage | `history_reaches_back_to` after `since` | Insider lines from the covered span, and a Not read row for the rest | yes (does not block) |
| Clamped | `next` before `now − 90` | Heading "the longest this reads", and the lead names the last visit. A same-day reload says the same. | yes |
| Held | the last visit wasn't counted | Heading without "since your last visit"; the lead names the last visit and the day this starts from | — |
| Not live | Never | The section uses no paid feed, so it never says Not live (P-1). | — |
| Signed out / in | Either | Identical. The research tab is public, and the stamp belongs to the browser, not the account. | — |
| Storage blocked | `localStorage` throws | Renders as a first visit, in memory only, with no error shown or logged. | nothing written |
| Storage corrupt | The blob doesn't parse, or fails schema-1 validation | Renders as a first visit. **The first counted write replaces it.** The record is a convenience stamp, not user data, and production has no Reset; leaving a bad blob in place (as `recentTickers/store.ts:65-81` does for user data) would make every visit a first visit until the reader clears site data. A blob with `schema_version` above 1, written by a newer build, is never overwritten. | yes, replacing it |
| Phone (< 768) | Width | Each line stacks: the meta row (date, credit, tag), then the text. Rows are at least 44 px tall. Nothing scrolls sideways. | — |

### Each route

| Route | Change |
|---|---|
| `/ticker/:symbol/research` (latest note) | The section is added under the masthead, and the stamp is read and written. On production the page's `today` becomes the ET day. |
| `/ticker/:symbol/research/:slug` (older note) | Nothing is shown and no stamp is written. |
| `/ticker/:symbol` (desk) | Nothing. |
| `/research`, `/research/filings` | Nothing (slice 2). |
| ⌘K | Nothing. |
| `/privacy` | One key row. |
| `/credits` | The `where` text for `sec` and `schedules` names the section. |

### Worked examples (checked against the data)

All three come from `rev/prototype2.mts`, run on 2026-10-22 against a copy of the seed and production's GET answers (exit 0).

**Staging, NVDA, scenario Oct 7, first visit.** The window is Jul 9 to Oct 7, 90 days. The rules give 7 lines:

1. `figures` Aug 27: 10-Q for the period to Jul 26, revenue $45.0B, ▲ 6.4% on the period to Apr 26. All 4 figures in the note match the 10-Q. That is what `filedFinding` returns for the sample note's own figures: the note states the four the sample 10-Q tags (revenue, net income, diluted EPS and cash), and rule 1 holds them to the 10-Q's (spec 4, Behaviour › "`/ticker/:symbol/research` on staging", rule 1 and "`demoFigures` goes"). The prototype ran today's `demoFigures`, so it printed a cent-off EPS; this clause is not re-measured, because the sample note comes with C2 (spec 4, Build plan › C2). The cost: staging loses its visible Differs example, and rule 1 rules out authoring one.
2. `filing` Sep 24: 8-K, Item 5.07.
3. `filing` Aug 27: 8-K, Items 2.02 and 9.01.
4. `insider` Sep 21: a buying cluster, 3 insiders, Sep 14–19.
5. `insider` Sep 4: open-market sales, 3 by 3 insiders, filed Jul 10 to Sep 4; 1 not marked as under a 10b5-1 plan.
6. `holders`, keyed Aug 15, rows filed Aug 13: quarter to Jun 30, Sample holder D ▼ 0.6.
7. `shortInterest`, keyed Oct 7 (Sep 30 + 14, clamped to `now`), settlement Sep 30: ▼ 2.3%, Jun 15 to Sep 30.

The collapsed default shows 1, 2 and 4. "All 7" adds 3, 5, 6 and 7. All 7 came before the sample note, which spec 4 dates Oct 7 (spec 4, Behaviour › "`/ticker/:symbol/research` on staging", the dates and catalysts). The Next row reads: FOMC decision Oct 28 makes the valuation due. NVDA's sample note is valued (same section of spec 4, the "Note | Valuation bar" table).

**Production, NVDA, Oct 22, first visit.** The window is Jul 24 to Oct 22. The rules give 7 lines:

1. 10-Q for the period to Jul 26: revenue $96.2B, ▲ 18% on the period to Apr 26; the check clause is the live frame's, "All 6 figures in the note match the 10-Q" (`review-what-changed-since/frames.mjs`).
2. 8-K Sep 3, Item 8.01.
3. 8-K Aug 26, Items 2.02 and 9.01.
4. 8-K Aug 17, Items 1.01, 2.03 and 7.01.
5. "2 other filings: N-PX, 13F-HR" (NVIDIA's own fund-vote and holdings reports).
6. Open-market sales: 25 by 3 insiders, filed Sep 2–23; 16 not marked as under a 10b5-1 plan. No open-market buys.
7. 13F for the quarter to Jun 30, keyed Aug 15, rows filed Aug 7–14. With the frame's current rule: the biggest change is NORGES BANK ▲ 1.3. After F1: FMR LLC ▲ 0.1, and NORGES BANK shows no position in the prior quarter's 13F read.

The collapsed default shows 1, 2 and 6. All 7 came before the note (Oct 13). The other rows:
- **Not read:** short interest, Off.
- **Next:** FOMC decision Oct 28 (`fomc.ts:34`). The note gives its own results date, Nov 17, which suppresses the estimate.

**Production, NVDA, Oct 22, last visit Oct 8.** No line falls in Oct 8 to Oct 22. NVIDIA's newest Form 4, filed Oct 9, holds no open-market trade. The section reads "Nothing new since Oct 8.":
- **Checked, nothing new:** filings; insider trades; 13F holders (still the quarter to Jun 30; Sep 30 is due Nov 16, 0 of 12 managers filed).
- **Not read:** short interest, Off.
- **Next:** FOMC decision Oct 28.

**Production, TSM, Oct 22, first visit** (`rev/prod-tsm.json`). There is no figures line: the newest 20-F was filed Apr 16. The lines:
- one folded line, "10 foreign issuer reports (6-K), Aug 10 – Oct 15";
- the API's two buying clusters (21 insiders on Sep 7, 18 on Oct 7; see Open question 6);
- one line for 2 other open-market buys;
- the receipts line, "FMR LLC holds the most TSM depositary receipts among the managers read, 58.9M; no change is computed for receipts".

Not read: insider trades filed Jul 24 to Sep 1 (only the 80 newest of 256 Form 4 filings in the year are read), and short interest, Off.

## Copy

The voice is plain and short, and makes no claim beyond the data (DESIGN_SYSTEM.md rule 4). State words come only from `DATA_STATES` (`vocabulary.ts:32-51`). Dates use `formatShortDate` (`format.ts`); `formatNoteDate` is used when `since` falls in an earlier year than `now`. Where this table and a shared helper overlap, the helper wins: the check clause is always `filedFinding`'s sentence.

| Where | String |
|---|---|
| Heading (h2), first visit | `Since Jul 24 (90 days, first visit)` |
| Heading, return | `Since Oct 20 (2 days, since your last visit)` / `Since Oct 21 (1 day, since your last visit)` |
| Heading, clamped | `Since Jul 24 (90 days, the longest this reads)`, and the sub line adds `Your last visit was Jun 2, 2026.` |
| Heading, held | `Since Oct 20 (2 days)`, and the sub line adds `Your last visit, Oct 21, couldn’t read every source, so this starts from Oct 20, the last visit that did.` |
| Sub line, production | `What the public record added for NVDA, as filed. No AI reads it.` |
| Sub line, staging | `Scenario · Oct 7, 2026 · a sample record shaped like SEC and FINRA’s. No AI reads it.` |
| Before this note | appended to the sub line: `All 7 came before this note (Oct 13).` / staging `All 7 came before this sample note (Oct 7).` When only some lines are earlier: meta `before this note` on those lines |
| `figures` | `10-Q for the period to Jul 26: revenue $96.2B, ▲ 18% on the period to Apr 26. All 6 figures in the note match the 10-Q.` / staging `… revenue $45.0B, ▲ 6.4% … All 4 figures in the note match the 10-Q.` (Worked examples, the staging list, line 1). Every check clause is `filedFinding(rows, form, false)` plus a full stop. No facts yet: `10-Q for the period to Jul 26, filed; its figures aren’t read yet.` |
| `filing` | `8-K: Other events (Item 8.01)` · `8-K: Material agreement + 2 more (Items 1.01, 2.03, 7.01)` · `S-3ASR: Shelf registration` · a folded run: `10 foreign issuer reports (6-K), Aug 10 – Oct 15` · investor forms: `2 other filings: N-PX, 13F-HR` / `3 other filings: N-PX, 13F-HR ×2` |
| `insider` | `Buying cluster: 3 insiders bought on the open market within 6 days (Sep 14–19), none under a 10b5-1 plan` · `2 open-market buys by Director 1 and Director 2, outside 10b5-1 plans` · `Open-market sales: 25 by 3 insiders, filed Sep 2–23; 16 not marked as under a 10b5-1 plan. No open-market buys.` |
| `holders` | `13F, quarter to Jun 30: biggest change Sample holder D, ▼ 0.6 pts of shares outstanding` · after F1, suffix `; NORGES BANK shows no position in the prior quarter’s 13F read` · receipts: `13F, quarter to Jun 30: FMR LLC holds the most TSM depositary receipts among the managers read, 58.9M; no change is computed for receipts` |
| `shortInterest` | `Shares short ▼ 2.3%: 252M at the Sep 30 settlement, 258M at Jun 15` |
| `calendar` | `FOMC decision Sep 16: the note’s valuation is due` |
| Meta row | `<credit>`, the kind's note, then the state tag on production. Staging lines show no state tag under either D1 draft (States, Sample row). Production credits: `SEC EDGAR`, `SEC Form 4`, `SEC 13F`, `FINRA short interest`, `Federal Reserve`. Staging credits: `Shaped like SEC EDGAR`, `Shaped like SEC Form 4`, `Shaped like SEC 13F`, `Shaped like FINRA short interest`, `Scenario calendar`. Kind notes: holders `quarter to Jun 30, complete after the Aug 14 deadline`; short interest `published about a week after settlement` |
| Link targets | aria-label suffix `, opens on SEC EDGAR` (production filings) · `, opens Research → Filings` (staging filings) |
| More | `All 7` / `Fewer` |
| Next row | `Next: FOMC decision Oct 28 makes the valuation due` · `Next: results expected Nov 18–20, estimated from filing history` |
| Checked row | `Checked, nothing new: filings; insider trades (no open-market buys or sales filed); 13F holders (still the quarter to Jun 30; Sep 30 is due Nov 16, 0 of 12 managers filed)` |
| Not read row | `Not read: short interest.` + tag `Off` + `Off on this site until FINRA’s terms for showing its data here are confirmed.` · `Not read: insider trades filed Jul 24 – Sep 1. Only the 80 newest of 256 Form 4 filings in the year are read.` · `Not read: 13F holders.` + tag `Source down` + the API's detail · `Not read: the 10-Q’s figures.` + tag `Source down` + the API's detail |
| Not counted | `This visit isn’t counted: 13F holders didn’t answer. Next time this starts from Oct 20 again.` |
| Empty | `Nothing new since Oct 8.` |
| Loading (aria-label) | `Loading what changed for NVDA` |
| Couldn't load | `Couldn’t load what changed.` / `Convexa’s server didn’t answer, so this can’t say what’s new. The note doesn’t depend on it.` / button `Try again` |
| Off server | `Public-data panels are off on this server, so this can’t say what’s new.` |
| SEC not set up | `SEC filings aren’t set up on this server yet, so this can’t say what’s new.` |
| SEC down | `SEC EDGAR didn’t answer. What changed is unknown, not empty.` |
| Last good copy | `SEC EDGAR didn’t answer this hour. These lines come from the last good copy, and this visit isn’t counted until a fresh copy arrives.` |
| Stored here ⓘ (collapsed) and sentence (expanded), production | tag `Stored here` + `The day you last opened NVDA research is kept in this browser.` |
| Stored here, staging | tag `Stored here` + `The day you last opened NVDA research is kept in this browser until you reset the demo.` |
| Sources (expanded), production | `Sources: SEC EDGAR (filings, Form 4, 13F, company facts) · Federal Reserve (FOMC calendar)`, with links to `/credits#sec` and `/credits#schedules` |
| Sources (expanded), staging | `Shaped like SEC EDGAR, FINRA and the Fed’s calendar; nothing here is a record.` It does not begin "Sample", so under either D1 draft it is not a second sample mark in the frame's foot (States, Sample row). |
| FINRA notice | Shown only while a short-interest line is visible (staging, expanded). The same text as `NotePublicPanels.tsx:133-142`. |
| /privacy row | `convexa.since-last-looked.v1` · `The day you last opened each ticker’s research, so “Since you last looked” can start there.` · `When you open a ticker’s research` |

## Design

The section uses tokens and `shared/ui` pieces only. Nothing in it is on the Banned list.

- **Frame.**
  - Production uses `PANEL_SX` (`pages/research/ui.tsx:22-27`): `background.paper`, the `divider` border and a 12 px radius.
  - Staging spreads `sampleFrameSx`, the one shared sample treatment spec 4 step C2 exports beside `ChartFrame`, from `shared/charts/frame` (spec 4, Design › Sample treatment): the dashed `textTertiary` border and the hatch stripe (P-3, P-8). It is imported, not copied.
  - Padding is 16 px on phone and 24 px from `sm`, on the 4-pt ladder.
- **Heading.** h2, `id="since-last-looked"`, `DISPLAY` at 18 px, weight 600. On production a `DataStateTag` sits on the right: `updated` or `lastGood`. On staging the heading's tag waits on D1 (States, Sample row): none under spec 1's draft, `sample` under spec 3's, and `demo` under neither. The sub line is 12 px in `text.secondary`.
- **Lines.**
  - The list is an `<ol>`. Rows are split by `divider` hairlines.
  - Each row is one `<a>` with a minimum height of 44 px.
  - On desk, the row is a grid: the date column (`MONO` 12 px in `text.secondary`, 64 px wide, as in the "Filed since" list, `NotePublicPanels.tsx:206-208`; the height prototype used 56 px), the text (Plex Sans 14 px, wrapping, never truncated), then the meta inline (the credit at 12 px, a `ProvenanceChip link={false}`, `publicUi.tsx:41-42`, and on production a `DataStateTag`), then the trailing glyph.
  - On phone the meta row sits above the text.
  - Trailing glyph: a 16 px stroke chevron for an in-page target, or an open-in-new glyph for a link out.
  - The line text is a sentence, like a frame's finding, so it stays in Sans.
- **Collapsed by default.** Three lines, then one footer row: "All N" (a neutral text button, 44 px), the Next row, a compact Not read with its tag, and the `Stored here` tag with an ⓘ (`shared/ui/AccessibleHelp.tsx`) that holds its sentence. "All N" expands in place: every line, the Checked and Not read rows in full, Sources, and the FINRA notice when it applies. Expanding is the reader's action, so the shift it causes is not layout shift.
- **Colour.**
  - No amber. "All N" is a neutral text button (owner ruling A, 2026-10-15).
  - ▲ and ▼ carry the sign; no green or red (P-11, rule 5).
  - Warning states take `warning.*` and the icon, through `DataStateTag`.
- **No liveness.** No live dot, pulse or chip (rule 22). "All N" expands instantly, with no animation.
- **Anchors.** The target panels' headings get `scrollMarginTop: 96`, as note sections already have (`NoteView.tsx:778`), so the sticky nav doesn't cover them: `#positioned`, `#insider-trades`, `#checked-filing` and `#fund-holdings`. The section has `aria-labelledby="since-last-looked"`.
- **No layout shift.** The skeleton, and every settled state, keeps `min-height` at the collapsed shape's height: about 290 px at 1440 and 480 px at 390, re-measured on the built component. An Empty or Not read answer leaves room at the foot of the panel rather than pulling the note up.
- **Trade-off, measured.** These numbers come from a DOM prototype injected into production's note page under its masthead, with the page's own fonts and the spec's sizes and copy (`rev/height-probe.mjs`, `rev/height-probe.json`, `rev/desk-B3-production.png`):

  | Width | Shape | Section height | The note's figure strip moves from → to |
  |---|---|---|---|
  | 1440×900 | collapsed, 3 lines (default) | 293 px (staging copy 307) | y=588 → 913 (927) |
  | 1440×900 | 5 lines | 397 px | y=588 → 1,017 |
  | 390×844 | collapsed, 3 lines (default) | 479 px (staging copy 519) | y=840 → 1,343 (1,383) |
  | 390×844 | 5 lines | 668 px | y=840 → 1,531 |

  Collapsed, the desk's first screen holds the masthead and the three newest kinds of change. The strip's top sits 13 px below the fold, and the valuation and TL;DR row moves from y=722 to y≈1,047. On phone the strip already starts at the first screen's bottom edge (y=840 of 844), and the section moves it about 0.6 of a screen further. A returning reader gets the changes before the figures, and a first-time reader scrolls once more to the strip. The 5-line shape (and the original estimate of about 650 px desk, 1,040 px phone, `tmp/ux-audit/review-what-changed-since/mock-height.mjs`) would push the strip a full screen down on desk, which is why the default is collapsed.

```
desk (1440), collapsed default                                       phone (390)
NVDA  NVIDIA                                 Price as of Oct 12      NVDA  NVIDIA
A 70% growth guide on a $412B year…          Thesis reviewed Oct 13  A 70% growth guide…
┌─────────────────────────────────────────────────────────────────┐  ┌──────────────────────────────┐
│ Since Jul 24 (90 days, first visit)                 [Updated]   │  │ Since Jul 24 (90 days,       │
│ What the public record added for NVDA, as filed. No AI reads it.│  │ first visit)       [Updated] │
│ All 7 came before this note (Oct 13).                           │  │ What the public record …     │
├─────────────────────────────────────────────────────────────────┤  ├──────────────────────────────┤
│ Aug 26  10-Q for the period to Jul 26: revenue $96.2B, ▲ 18% …  │  │ Aug 26 · SEC EDGAR [Computed]│
│         … All 6 figures in the note match.  SEC EDGAR [Comp]  › │  │ 10-Q for the period to …   › │
│ Sep 3   8-K: Other events (Item 8.01)        SEC EDGAR [Upd]  ↗ │  │ Sep 3 · SEC EDGAR [Updated]  │
│ Sep 23  Open-market sales: 25 by 3 insiders, … SEC Form 4 [Co]› │  │ 8-K: Other events (Item … ↗ │
├─────────────────────────────────────────────────────────────────┤  │ …                            │
│ [All 7]  Next: FOMC decision Oct 28 makes the valuation due     │  │ [All 7] Next: FOMC Oct 28 …  │
│ Not read: short interest [Off]               [Stored here ⓘ]    │  │ Not read: short interest [Off]│
└─────────────────────────────────────────────────────────────────┘  │             [Stored here ⓘ]  │
Price  Market cap  P/E  …  (figure strip, y≈913)                     └──────────────────────────────┘
```

## Data and licence

There is no new request: the section reads answers the note page already fetched.

| Line kind | Source | Already on the page via | Cost | Display licence | AI licence | Production |
|---|---|---|---|---|---|---|
| filing, figures, insider, holders | SEC EDGAR: submissions, XBRL company facts, Form 4, 13F-HR | `/api/public-data/tickers/{t}` (71,048 bytes for NVDA, measured) | $0 | Reuse permitted, credit requested (`docs/product/ai-analyst/SOURCES.md:88`). Every line shows its SEC credit. A fold links to EDGAR's own filing list. | Not addressed; reuse permitted. Moot here: nothing goes to a model. | Shown publicly |
| calendar (FOMC) | Federal Reserve FOMC calendar: `fomc.ts` table on production, the scenario calendar on staging | `fomcDays(null)` (`NotesView.tsx:30`) | $0 | Public domain unless marked (SOURCES.md §3, Fed Board row). /credits says "U.S. government publications, free to show on a public site, credited to each agency" (`pages/trust/sources.ts:135`). | Not addressed (public domain) | Shown publicly |
| calendar (results window) | Estimated from EDGAR filing history | `/api/public-data/filings?tickers=` (2,154 bytes, measured) | $0 | As SEC | As SEC | Shown publicly |
| shortInterest | FINRA consolidated short interest | `/api/public-data/tickers/{t}` | $0 | Production: **Off** (owner ruling 2026-10-15, answer 4; `finraSwitch.ts:9`, `finra.rs:18`). Staging: authored sample shaped like FINRA (`public-data.ts:745-756`), with FINRA's notice. | Not used | Not read row, Off |

BLS, BEA and Treasury schedules are not inputs. No licensed data is used: no Massive, no news API. The stamp is a date per ticker in this browser, and nothing leaves the browser. The test fixtures are trimmed copies of production's NVDA and TSM answers: SEC data, reuse permitted, with FINRA Off, so they hold no FINRA figure.

## Acceptance criteria

**Staging. Blocked until spec 4 step C2 merges and Part A has landed** (C2: the sample notes on `NotesView` and `NoteView`, `NotePublicPanels` under them, and the `today` prop; Part A: the section, with `filingTitle.ts` from B2 or built at B2's path):

1. **The staging story.** In a fresh browser profile on staging `/ticker/NVDA/research` at 1440:
   - The section is the first block under the note masthead. Its heading reads `Since Jul 9 (90 days, first visit)`, and its sub line contains `Scenario · Oct 7, 2026` and `All 7 came before this sample note (Oct 7).`
   - Collapsed, it shows exactly 3 lines in this order:
     - the 10-Q figures line, containing `All 4 figures in the note match the 10-Q`. No line says `differs`: spec 4's rule 1 holds the sample note to the 10-Q's figures;
     - `8-K: Shareholder vote results (Item 5.07)`, dated Sep 24;
     - the buying-cluster line, dated Sep 21.
   - `All 7` adds, in package order:
     - `8-K: Results of operations (Items 2.02, 9.01)` (Aug 27);
     - the sales line (Sep 4);
     - the Sample holder D ▼ 0.6 line (Aug 13);
     - `Shares short ▼ 2.3%` (Sep 30).

     FINRA's notice then shows.
   - The two filing strings are exact: each filing line's text ends at its closing bracket, with no description after it (Line kinds, `filing` row).
   - The frame is dashed with the hatch stripe. The tags follow D1 (States, Sample row). Under either draft, no line carries a state tag and nothing in the section reads `Demo · sample data`; the heading carries no tag under spec 1's draft and one `Sample` under spec 3's. If the owner declines the row, the heading reads `Demo · sample data` and every line `Sample`.
   - The Next row names FOMC decision Oct 28.
   - _Check:_ a Playwright script in `tmp/ux-audit/spec-what-changed-since/` reads the section's text after deploy.
2. **A reload keeps the list.** Reload the same tab: the heading and lines are identical. _Check:_ the same script reloads and diffs the text.
3. **Staging ignores the wall clock.** With the browser clock fixed to 2026-12-01 (Playwright `page.clock.setFixedTime`), staging still reads `Since Jul 9 (90 days, first visit)`. _Check:_ script.
4. **Reset clears the stamp.** After Reset demo data, `localStorage` has no `convexa.demo.v1.convexa.since-last-looked.v1`, and the heading says first visit. _Check:_ script reads `localStorage` before and after.

**Production, read-only, after the owner deploys** (no sign-in, no form, nothing written outside the test profile):

5. **First visit.** In a fresh browser profile on production `/ticker/NVDA/research`:
   - The heading reads `Since <ET today − 90> (90 days, first visit)`.
   - When the newest periodic report was filed in the window, the first line starts with its form and contains, verbatim, the title of the "Checked against the filing" frame on the same page (`[data-testid="chart-filed-figures"]`), both read at test time. The AC holds when NVDA files its next 10-Q.
   - Short interest appears only in the Not read row, with `Off` and the FINRA reason.
   - No line says `Sample`. Expanded, the SEC credit links to `/credits#sec`.
   - _Check:_ read-only Playwright probe.
6. **Next day.** With a v1 record for NVDA injected via `addInitScript` (`next` and `visited` = yesterday, ET), production reads `Since <yesterday> (1 day, since your last visit)`. When no line falls in the window, `Nothing new since <yesterday>.` shows with a Checked row. _Check:_ script.
7. **Links land on their panels.** Each in-page line link scrolls its target heading into view, with the heading's top below the sticky nav's bottom: `#checked-filing`, `#insider-trades` and `#fund-holdings` on production, and `#positioned` on staging once spec 4 step C2 has merged. Production filing lines open EDGAR in a new tab. _Check:_ the script clicks each line and compares `getBoundingClientRect`.

**Local preview, live mode** (`npm run ports:free`, then `npm run serve:dashboard` on `localhost`). The browser clock is fixed to 2026-10-22, and `/api/public-data/*` is route-mocked from the trimmed production fixtures, so every run is deterministic and nothing reaches production:

8. **Storage blocked.** With `localStorage` made to throw (init script), the section renders the first-visit list. No console error comes from the section's modules: the dev server serves modules by path, so the script fails on any console error whose location is `pages/research/SinceLastLooked.tsx`, `sinceStore.ts` or `changesSince.ts`. _Check:_ script.
9. **Corrupt and newer blobs.**
   - With the key set to `{`, the section renders a first visit, and after the read the key holds a valid v1 record.
   - With the key set to `{"schema_version":2,"tickers":{}}`, the section renders a first visit and the key is byte-identical afterwards.
   - _Check:_ script.
10. **Failed read.** With `/api/public-data/tickers/*` aborted, the section shows `Couldn’t load what changed.` and Try again. A fresh profile gets no record; a profile with a record keeps its `next`. _Check:_ script.
11. **Loading holds its space.** With the ticker answer delayed 3 s, the skeleton shows with `aria-busy` and the aria-label `Loading what changed for NVDA`, at the reserved height (within 4 px), and then the list. Layout shift from navigation to idle is ≤ 0.05 at 1440 and at 390. _Check:_ script with a `PerformanceObserver` on `layout-shift`.
12. **A kind down doesn't count.** Each of these answers shows its Not read row, or the Last good copy warning, plus the `This visit isn’t counted` line, and leaves `next` unchanged:
    - `filings_source_state: 'last_good'`;
    - holders `state: 'unavailable'`;
    - insiders with `history_filings: 5, history_filings_read: 0, transactions: []`;
    - FINRA on with `short_interest_state: 'unavailable'`;
    - `detail` naming company facts.

    FINRA `off` alone counts. _Check:_ script, one mocked answer per case.
13. **Whole-section states.** Server `state: 'off'`, `filings_state: 'not_configured'`, and `filings_state: 'unavailable'` with no filings each show their one line and tag, and none moves `next`. _Check:_ script.
14. **Clamped and future stamps.**
    - A record whose `next` is 100 days back reads `… (90 days, the longest this reads)` with `Your last visit was <date>.`, and the same after a reload.
    - A record dated tomorrow reads as a first visit.
    - _Check:_ script.
15. **Signed-in parity.** With `/api/auth/session` mocked as signed in, the section's text equals the signed-out run. _Check:_ script.
16. **A foreign issuer.** With the TSM fixture, the lines include:
    - one `10 foreign issuer reports (6-K), Aug 10 – Oct 15` line;
    - the receipts holders line naming FMR LLC, with no change;
    - the Not read row for insider trades filed Jul 24 – Sep 1.

    _Check:_ script.

**Both:**

17. **Phone width.** At 390 px the page's `scrollWidth` is 390, and every line link is at least 44 px tall, collapsed and expanded. _Check:_ script.
18. **No new requests.** The request count on the route equals today's baseline:
    - production, desk and phone: `/api/public-data/filings?tickers=NVDA` ×1 and `/api/public-data/tickers/NVDA` ×1;
    - staging: 0 `/api/*` requests.

    The baseline was measured 2026-10-22 by `tmp/ux-audit/review-what-changed-since/probe.mjs`, which fetches nothing itself. The earlier ×2 came from the spec probe's own `fetch`. _Check:_ a request listener in a script that makes no request of its own.
19. **/privacy lists the key.** It shows `convexa.since-last-looked.v1`, and /credits' SEC card names the section. _Check:_ page text.
20. **The desk and ⌘K are untouched.** `/ticker/NVDA` (the desk) has no section. ⌘K Recent lists tickers only. The diff touches no file under `pages/ticker/widgets/`, nor `TickerDashboard.tsx` or `PublicDesk.tsx`. _Check:_ script plus `git diff --stat`.
21. **The rules are pinned by tests.** `changesSince.spec.ts` and `sinceStore.spec.ts` hold the cases under Verification, each seen red once. _Check:_ `npx nx test @convexa/dashboard`, exit code 0.

## Verification

**Tests owed under the risk rule.** A wrong window, a wrong stamp write or a wrong record fails silently: a missed filing reads as "nothing new". The window keys and the gate parse the public-data answer, and the stamp is a data write, so they earn tests. The copy and the UI earn none.

`pages/research/changesSince.spec.ts` covers these. Its fixtures are the seed (`demoPublicTicker`) and trimmed copies of production's NVDA and TSM answers.

- **Boundaries, per kind.**
  - Filing: keyed at `since` is in, at `since − 1` out, at `now` in, at `now + 1` out.
  - Insider: a cluster whose last Form 4 is filed after `now` is out.
  - Holders: quarter to Jun 30, rows filed Aug 7–14.
    - `since` Aug 14 with `now` Aug 14 is out, because the quarter is not on the wire until Aug 15.
    - `since` Aug 15 is in, and the biggest change is picked from all 8 rows, not only T. Rowe's.
    - `since` Aug 16 is out.
  - Short interest: settlement Sep 30.
    - `since` Oct 8 with `now` Oct 9 is in (the key is clamped to Oct 9).
    - `since` Oct 15 with `now` Oct 20 is out.
    - The base is the latest settlement keyed before `since`.
  - Figures: a 10-Q in the window with no facts, filed 1 day ago, gives the "not read yet" line and a hold. The same report 4 days on gives the line and no hold.
- **`quarterDeadline`.** Jun 30 → Aug 14 and Sep 30 → Nov 16, the Rust test's own dates (`edgar_13f.rs:956-957`).
- **The gate (`stampable`).** One case each:
  - Last good copy blocks;
  - SEC Source down blocks;
  - holders `unavailable` blocks;
  - insider `unread` blocks;
  - FINRA on and `unavailable` blocks;
  - company facts failing blocks;
  - a fresh 10-Q without facts blocks;
  - FINRA Off does not block;
  - insider partial coverage does not block;
  - a 20-F without facts filed 3+ days ago does not block.
- **First visit.** `visitWindow(null, '2026-10-07')` gives `since: '2026-07-09'` and heading `first`, and `days` is 90.
- **The advance rule** (`visitWindow`, `nextRecord`):
  - On the same day the stored `shown` is returned exactly, including a clamped heading and its `lastVisit`: the clamped-then-reload case.
  - On a later day `since` is `next`.
  - A `next` older than 90 days is clamped.
  - An uncounted visit keeps `next` and writes `visited`, so the next day's heading is `held`.
  - With no record, an uncounted visit writes nothing.
  - A future `visited` is a first visit.
- **FINRA Off.** `short_interest_state: 'off'` with its detail gives `notRead: [{ kind: 'shortInterest', state: 'off', reason }]` and no `shortInterest` line.
- **Line rules.**
  - The sales line counts only `kind: 'sale'` trades filed in the window, and its unmarked count is `!planned`.
  - The investor-forms fold counts by form.
  - A 6-K run of 3 or more folds; 2 do not.
  - Receipts give the largest holder and no change.
  - Partial coverage gives a Not read span starting at `since`.
- **The scenario clock.**
  - `readerToday('demo', new Date('2026-12-01T15:00:00Z'))` is `'2026-10-07'`.
  - `readerToday('live', new Date('2026-10-22T03:30:00Z'))` is `'2026-10-21'`: the ET day, not UTC.
- **The fixtures' stories.** The kinds and keys of the three worked examples (staging, production NVDA first visit, production TSM), and "nothing new" for NVDA since Oct 8. The tests assert kinds and dates, not copy.

`pages/research/sinceStore.spec.ts` covers:
- A corrupt blob reads as a first visit and is replaced by the first counted write.
- A `schema_version: 2` blob is never written over.
- Blocked storage keeps the record in memory only.
- A bad entry is dropped alone.
- The 100-ticker cap drops the oldest `visited`.

Each test must be seen to fail before it counts:
- flip `>=` to `>` at the lower bound;
- key holders on `filed` instead of the quarter switch;
- drop the clamp to `now` on the short-interest key;
- make `stampable` ignore holders;
- write `next: now` on an uncounted visit;
- drop `shown` from the same-day branch;
- keep a corrupt blob instead of replacing it;
- replace `DEMO_CALENDAR_TODAY` with the wall clock;
- make FINRA Off return no row.

Record the red runs in the PR body.

**Commands.** Check each exit code with `echo $?`, not the printed summary:

- `npx nx run-many -t typecheck -p @convexa/dashboard,@convexa/api` (Vitest does not typecheck)
- `npx nx test @convexa/dashboard`
- `node design/src/build.mjs` and `node design/src/verify-tokens.mjs`
- `npm run verify` (needs `gitleaks`)

**Observable checks.** Run AC 8–17 against a local preview first. Run AC 1–7 and AC 17–20 against staging and production only after the owner approves the deploy, and AC 1–4 only after spec 4 step C2 has merged. AC 1's heading-tag check waits on D1 (States, Sample row). On production the script never signs in, never submits a form and never writes outside its own test profile.

**Performance budgets:**
- 0 added requests (AC 18).
- `changesSince` takes ≤ 1 ms per pass on production NVDA's answer (194 transactions). The revised scratch prototype measured 0.17 ms mean over 1,000 passes in Node (`rev/prototype2.mts`).
- Collapsed section height: ≤ 320 px at 1440 and ≤ 540 px at 390. The prototype measured 293–307 px and 479–519 px (`rev/height-probe.json`). The figure strip's top at 1440×900 stays at y ≤ 930.
- Layout shift caused by the section: ≤ 0.05 at both widths, measured with a `PerformanceObserver` on `layout-shift` from navigation to idle, median of 3 cold loads (AC 11).
- The research route's chunk grows by ≤ 6 KB gzip. Compare the build output before and after.

## Build plan

**Step 0, before any code.** Record Open questions 1–6 in `design/src/screens/final/tracker-data.mjs` `OPEN_QUESTIONS`, where the owner's questions live (`:19`), with ids `Q-SINCE-13F-ZERO`, `Q-SINCE-NO-NOTE`, `Q-SINCE-SI-SEED`, `Q-SINCE-ACCOUNT`, `Q-SINCE-DAY` and `Q-TSM-CLUSTERS`, `asked: '2026-10-22'` and `status: 'open'`. Then run `node design/src/build.mjs`. Size XS.

**Part A, production.** Part A can start at any time. It uses spec 4 step B2's `filingTitle.ts`, or builds it at B2's path first if B2 hasn't landed (spec 4, Build plan › B2, and Scope and non-goals › Coordination with specs 01, 03 and 05).

1. **`pages/research/filedCheck.ts`** (new): move `filingsOf` out of `FiledFigures.tsx` (`:83`), and export `filedCheck(d, figures)`. `CheckFrame` calls it with the figures it checks today. The frame does not change. `demoFigures` (`:37`) stays in `FiledFigures.tsx`: spec 4 step C2 retires it (spec 4, Build plan › C2), and whichever of the two lands second rebases. Size XS.
2. **`holdersRead.ts`**: move the frame's biggest-change pick (`:37-41`) into an exported `biggestChange(rows)`, unchanged; `holdersFinding` and `changesSince` both call it. Size XS.
3. **`pages/research/changesSince.ts`**:
   - the types, `changesSince`, `stampable`, `shownLines`, `visitWindow`, `nextRecord`, `readerToday`, `quarterDeadline` and the two constants;
   - it reuses `figureChange`, `formatBillions`, `changeText`, `heldText`, `biggestChange`, `holdersView`, `insiderFrame`, `tickerSecStale`, `publicDataWord`, `publicPartGap`, `calendarTriggers`, `filedFinding`, `filingTitle`, `daysBetween` and `addDays`.

   Size S.
4. **`pages/research/changesSince.spec.ts`** and its two fixtures, trimmed from `rev/prod-nvda2.json` and `rev/prod-tsm.json`: the cases under Verification, each seen red once. Size S.
5. **`pages/research/sinceStore.ts`** and **`sinceStore.spec.ts`**:
   - The key is `convexa.since-last-looked.v1`, read and written through `demoStorageKey`, so Reset clears it (`mode.ts:49-54`).
   - The shape is `{ schema_version: 1, tickers: Record<string, SinceRecord> }`.
   - Dates are validated against `^\d{4}-\d{2}-\d{2}$`, and a bad entry is dropped alone.
   - It keeps at most 100 tickers; the oldest `visited` goes first.
   - Storage is re-read on mount, so other tabs' visits count.
   - Every read and write sits in try/catch. Blocked storage means memory only. Corrupt means a first visit, replaced by the first counted write. `schema_version > 1` is never written.

   Size S.
6. **`pages/research/SinceLastLooked.tsx`**:
   - every state under Behaviour;
   - the collapsed default and the expanded list;
   - the reserved `min-height`;
   - a write effect that runs once the answer settles: `nextRecord(stored, shown, now, stampable(changes))`.

   Size S.
7. **Mount:**
   - `NoteView.tsx` gains `lead?: (ctx: { today: string; valued: boolean; aging: Aging; calendar: CalendarInputs | null }) => ReactNode` after `<Header>`, and `today?: string`, under the name and meaning spec 4 step C2 gives it.
   - `NotesView.tsx` passes `today = readerToday(dataMode, new Date())` and the lead for the latest note, with `pub`, `filedCheck(...)` and the note.

   Size XS.
8. **Anchors:** `scrollMarginTop: 96` on `#positioned` (`NotePublicPanels.tsx:108-117`), `#insider-trades` (`InsiderClusters.tsx:112-117`), `#checked-filing` (`FiledFigures.tsx:132-137`) and `#fund-holdings` (`FundHoldings.tsx:41-47`). Size XS.
9. **Trust pages:**
   - a `KEYS` row in `pages/trust/PrivacyPage.tsx:44-82`;
   - the `where` text for `sec` and `schedules` in `pages/trust/sources.ts:126-150` and `:186-203`.

   Size XS.
10. **Design catalog.** Add a module to `design/src/components/` (for example `since-last-looked.mjs`) that draws the collapsed and expanded shapes and the states table on both builds. Rebuild with `node design/src/build.mjs` (DESIGN_SYSTEM.md, Components / patterns: inventory growth is catalog work, never a hand edit of `design/site`). Size S.
11. **Verify:** the commands with exit codes, then AC 8–17 against a local preview. Ask the owner before any push or deploy, then run AC 5–7 and 17–20 against production. Size S.

**Part B, staging.** It builds after spec 4 step C2. Its tags wait on D1 (States, Sample row).

12. **Demo mount:** spec 4's sample source passes the lead with the scenario day and the scenario calendar. Its `check` is `filedCheck` over the sample note's own figures, the ones the check frame reads after C2. The frame spreads spec 4's `sampleFrameSx`, and filing targets go to `/research/filings`. No line draws a state tag; the heading's tag follows D1's answer. Size XS.
13. **Verify:** AC 1–4 and the staging half of AC 7 after the owner approves the staging deploy. Size XS.

**Follow-up F1, only if Open question 1 is answered as recommended.** `biggestChange` excludes `prior_shares === 0` rows and returns them separately. Both the frame's title and the line then name them as "shows no position in the prior quarter’s 13F read". `holdersPeers.spec.ts` gains the zero-prior case. Size XS. Until F1 merges, the line uses the frame's current pick, so the two never disagree on one page.

**Size: M overall** (Part A is M, Part B XS, F1 XS). The files likely touched:

- **New:** `changesSince.ts`, `changesSince.spec.ts`, `sinceStore.ts`, `sinceStore.spec.ts`, `SinceLastLooked.tsx`, `filedCheck.ts`, two fixtures, and one `design/src/components/` module.
- **Changed:** `FiledFigures.tsx`, `holdersRead.ts`, `NoteView.tsx`, `NotesView.tsx`, `NotePublicPanels.tsx`, `InsiderClusters.tsx`, `FundHoldings.tsx`, `PrivacyPage.tsx`, `sources.ts` and `tracker-data.mjs`, plus `design/` regenerated.

Nothing under `apps/api`, and nothing on the desk. Part A can start at any time: it uses B2's `filingTitle.ts`, or builds it at B2's path first if B2 hasn't landed (Part A above). Part B builds after C2. `DemoNoteSide.tsx` is not touched: B2 edits it and C2 deletes it (spec 4, Build plan), and only Part B mounts on the demo note. `NotePublicPanels.tsx`, `FiledFigures.tsx`, `InsiderClusters.tsx`, `FundHoldings.tsx` and `NotesView.tsx` are also in spec 4's step A1; Part A is easier to build after A1, but does not need it. Specs 2 and 4 also edit `NoteView.tsx`, `NotesView.tsx`, `InsiderClusters.tsx`, `FundHoldings.tsx` and `FiledFigures.tsx` in other steps; README, Cross-spec fixes, fix 9 has the full table of shared files and their landing order.

## Open questions for the owner

1. **The 13F zero-prior rows.** Production NVDA's frame says "the biggest change was NORGES BANK adding 1.3 points" because the prior quarter's read shows Norges with 0 shares (`edgar_13f.rs:707-713`; `prod-nvda.json`). Should the frame and the new line call that buying?
   - **Recommended:** no. Follow-up F1 makes one rule for both: the biggest change counts only managers held in both quarters, and a zero-prior manager is named as "shows no position in the prior quarter’s 13F read".
   - Separately, check the API's prior-quarter read for Norges. It may be a missed CUSIP, not a new position.
2. **Tickers with no note on production.** `/ticker/AAPL/research` on production says "No research on AAPL yet" and shows no public panels (`NotesView.tsx:233-246`). Should the section show there anyway?
   - **Recommended:** not in slice 1. It would have no panels to link to. Slice 2's `/research` digest covers the followed names.
3. **The staging short-interest seed.** Since Jul 9, the line moves ▼ 2.3% (Jun 15 to Sep 30), not the "about 9%" the idea said. Keep the seed, or re-author it so the window shows a larger move?
   - **Recommended:** keep it. The seed also draws the short-interest chart and its finding ("fell about 9% since Apr 15"), and the line is true to it.
4. **The stamp on your account.** "Stored here" means this browser or your account. Should the signed-in owner's stamp sync to the account now?
   - **Recommended:** no. Keep it in this browser until a later analyst phase stores "since I last looked" per owner and ticker, set when an answer opens (`DESIGN.md:216-218`). That needs analyst Phase 0 slice 0b (outside spec 6's scope, spec 6, Scope and non-goals › Not in scope), with the `analyst_answers` table, and Phase 1's answers page (`DESIGN.md:507-508`). Spec 6 adds neither, and its `since` is always the cutoff minus 90 days (spec 6, Scope and non-goals › Not in scope, and Behaviour › Time rules). Then this store becomes its signed-out stand-in.
5. **Which day the latest-note page uses on production.** The section needs the ET day: with the reader's local day, a reader east of New York can be stamped past a filing before it reaches the wire (The window). The note itself uses the local day today (`NoteView.tsx:664`). Should the whole latest-note page use the ET day?
   - **Recommended:** yes. `NotesView` passes the ET day as `today`. The cost: after 9 PM Pacific time the note calls tomorrow "today".
   - **The alternative:** two days on one page. Around midnight the section's Next row and the note's "Next up" can then disagree about an FOMC day.
6. **TSM's monthly purchases read as buying clusters.** In production's TSM answer (GET, 2026-10-22):
   - 62 of 64 purchases fall on the 7th of a month, in lots of 5 to 149 shares, with one price per day ($76.20 on Sep 7, $79.39 on Oct 7). The API calls Sep 7 (21 insiders) and Oct 7 (18) buying clusters.
   - That is the shape of a scheduled plan purchase, not a cluster of separate decisions.
   - DESIGN.md:78 says TSM files no Form 4s, yet this answer counts 117 in 90 days.

   This section would surface those clusters under TSM's masthead, where today they sit at the bottom of the page.
   - **Recommended:** before Part A ships, open one of those Form 4s. If it is a plan purchase, fix the cluster rule in `insider_trades.rs` as its own change.
   - Until then the TSM fixture pins the API's clusters as they are, and the section shows what the insider panel already shows.
