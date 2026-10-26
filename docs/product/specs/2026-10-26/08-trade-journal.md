# Trade journal: his words, a real account, and a rulebook drawn from them

_Proposal, 2026-10-26, revised the same day after the S2 skeptic's and the AI-and-privacy reviews.
Kind: new-tool. Size: XL overall, shipped as seven slices (0, 1a, 1b, 2, 3, 4, 5). Slice 1a is L
and is useful on its own the day it ships, margin-call entry included. Slices 1a to 3 call no model.
Depends on: the owner gate (shipped in `d1f6ed0d`, with the Kelvin-sign fix `c9e8ebeb`). Slice 4
also depends on a DESIGN amendment (open question 4) and its own eval gate. No 2026-10-21 spec
blocks it. The journal's controls meet spec 2's 44px floor by themselves, and its table twins use
spec 2's link cell if it has landed._

Code citations are `file:line` at commit `7eeb7150` (2026-10-26), read with `git show` where the
working tree differs. The revision's citations were read at `48deb0d2`; no file under `apps/`,
`libs/` or `tools/` changed between the two. While this was written, other workflows had uncommitted
edits in `design/**` (including `account-pages.mjs` and `lib.mjs`, which shift the board lines cited
here by about 9) and one appended Amendments row in `DESIGN_SYSTEM.md` (no cited line moves).
`auth.rs` and `config.rs` had none. Lines may move.

This spec merges three design directions and the verdicts of three judges. The winner is
**Notebook-first**: you write first and add structure later. The parts taken from the other two
directions are listed under "How this design was chosen", which ends the Why section.

## Why

The owner asked for a journal of his real trades: entries that keep his thoughts at the time, the
positions, account balance and margin behind them, and an AI that runs on every new entry to gather
insights and strategies, find his downfalls and why he loses money, and help him build a rulebook it
derives from his journal. His request's own example is an entry written after the outcome was
known, about positions entered weeks earlier.

His words are paraphrased, not quoted, and none of his figures appear here: the repository is
public, and his request is in substance his first journal entry (Data and privacy → Never in the
public repo).

This is about a **real brokerage account**: real money, often a margin loan, and losses that matter.
Convexa's paper book is a different thing. Today nothing in Convexa can hold this:

- **Every trading surface is simulated.** The book's types say "No real order is ever placed"
  (`features/trading/positions/types.ts:5`). A real-money entry surface has to be a separate
  component, never a mode of the simulated `TradeEntryDialog` (`DESIGN_SYSTEM.md:165`, rule 10;
  `PROJECT_CONTEXT.md:376-390`).
- **Convexa can't read his balance or margin.** `BrokerBook` holds positions, legs and unrealized
  P/L. It has no account value, cash, margin loan, maintenance requirement or margin-call field
  (`apps/api/src/services/broker/mod.rs:74-91`), and the Webull provider is a placeholder that
  returns `adapter_fault` (`:110-125`). Every account figure in the journal is **typed by him**.
- **The existing AI is built for a single strategy read.** `complete_strategy` sends one request
  with a 60 s timeout and `max_tokens` 2048, parses strategy JSON (`services/llm.rs:12`, `:287`)
  and records no usage. Its prompt says "SIMULATED positions … Broker positions are not counted"
  (`:234`). Its egress promise is "no account or identity, no broker/order data"
  (`pages/ticker/widgets/ai-rec/copy.ts:89-94`). A journal read sends exactly that kind of data, so
  it needs its own path and its own promise.
- **Account figures may not ride on the decision log.** AC-29a: "no account-size value may ever
  reach a ledger or decision record" (`features/trading/model/types.ts:86`).
- **Research notes are the wrong home.** They are Markdown in a repository that has been public
  since 2026-10-19, compiled into the public bundle (`tools/research-notes/notes.mjs:1-9`).

The research method already names what a journal is for: "A decision journal keeps the reasoning
made at the time, which separates decision quality from outcome and blocks flattering hindsight
stories" (`docs/research-method/perspectives-and-forecasting.md:30`). His own example shows the
danger: it describes positions entered weeks earlier and is written from memory, after the result
is known. A design that mines memories as if they were reasoning at the time would build his
rulebook out of hindsight.

**What this design bets on:**

1. **Capture survives the worst day.** A margin-call entry takes three numbers and a sentence, in
   under a minute, on a phone. On that day the AI says nothing about it.
2. **A normal day costs one sentence.** The numbers carry forward, and structure is added later.
3. **Code does the arithmetic.** Margin used, excess liquidity, the drawdown with deposits taken
   out, where the money went, and every count are computed in Rust and cited. The model never
   assembles facts and never does sums.
4. **Small samples are said plainly.** A fixed table of ten behaviours is checked every week,
   including the rows that found nothing, and no rate is shown below 20.
5. **The rulebook is his.** The AI drafts first-person process rules from cited evidence. He
   rewords, adopts, versions and retires them. Nothing blocks a trade, and nothing places one.

### How this design was chosen

Three directions were judged through three lenses:

| Direction | Owner outcome (of 70) | Honesty and safety (of 90) | Fit and cost (of 60) |
|---|---|---|---|
| **Notebook-first**: write first, structure later | **55** | 75 | **49** |
| Ledger & Path: the account is the record, thoughts are pinned to it | 47 (partial text) | 73 | 37 (partial text) |
| Rulebook Loop: coach-first | not received | **76** | not received |

Notebook-first won on capture on a bad day, the daily cost of using it, trust, and time to first
value with no model. The honesty lens split it from the Rulebook Loop by one point.

**The comparison is incomplete.** Two of the three lenses never received the Rulebook Loop's text,
and one lens scored Ledger & Path on partial text. The only lens that saw all three ranked the
Rulebook Loop first (76 against 75). Grafting parts across directions doesn't make up for verdicts
that were never given, so open question 14 asks whether to re-run the two lenses first.

Each judge also named gaps in the winner that another direction had already solved. This spec
grafts them in:

- **From Ledger & Path:**
  - a "Money in or out" kind, and a drawdown with deposits taken out, with its method named;
  - a source on every snapshot (Statement · Broker screen · Memory);
  - "Correct a figure", which supersedes a figure and keeps the original visible;
  - the fixed detector table with the caption "With this many, one can look notable by chance";
  - "Closed by" (Me · Broker (liquidation) · Expiry · Assignment);
  - an optional exit price, or "No exit set";
  - an optional "Why go ahead anyway?" stored with a No answer;
  - the Path small multiples (account value, below the high, margin used) on one time axis;
  - "Where the money went";
  - the margin-call cross-check, and non-blocking sanity questions at the field;
  - the caption "The line joins your snapshots. Convexa has no prices between them."
- **From the Rulebook Loop:**
  - counter-evidence on every finding ("Cut the other way");
  - the downfalls he names himself, registered before the first review and tested first;
  - "linked to", never "caused";
  - an advice scan that also catches "should", "must" and "need to" aimed at him;
  - on the margin-call day, "Nothing here is graded" and "When you’re ready…";
  - a warning before save when text looks like an account number;
  - a flag on wording written from memory ("fast forward to today");
  - "Why this rule, in your words" at adoption;
  - the printable rulebook card;
  - older entries travel to the model only as digests.
- **From the fit-and-cost judge:**
  - slice 1 is split into 1a and 1b;
  - entry reads run in a batch at review time, and reading on every save is opt-in;
  - the Rust Wilson interval is named for what it is: a third implementation (Data and privacy).

**Rejected, with reasons:**

- A `g j` shortcut: `GO_TO` must mirror the nav ("Same order and targets as the primary nav",
  `shell/shortcuts.ts:12`).
- Adding journal rows to the palette's surface list, which is "exactly these, nothing else"
  (`shell/CommandPalette/commandTable.ts:18-28`). See open question 2 for a separate group.
- A projected cushion at an assumed 35% maintenance rate: brokers' requirements vary, and the
  sample's own call came from a raised requirement.
- "Broke R3", "breaking R3", and a required reason to go ahead.
- "Followed 6 of 7" style scores.
- A 60-minute window during which an edit still counts as written at the time.
- A decision-quality rating made after the outcome is known.
- An automatic AI read on the margin-call day.
- A hard cap of seven active rules (asserted, not evidenced).

**Input claims corrected while checking** (each is fixed below):

1. **"Figures he types render in Plex Sans."** Wrong. Rule 13, as widened by owner ruling D-D,
   says a figure the trader typed is traced to a record Convexa holds, so it renders in Mono with no
   dotted rule (`DESIGN_SYSTEM.md:168`). Typed balances and margin are Mono.
2. **"The owner gate is mid-edit, uncommitted."** It is committed (`c9e8ebeb`, `7eeb7150`), and at
   `7eeb7150` neither `auth.rs` nor `config.rs` has uncommitted changes.
3. **"`OWNER_ONLY_OPERATIONS` covers any method."** Three places assume otherwise, and the journal
   changes all three in slice 1a:
   - The OpenAPI tagging matches only `"GET"` and `"POST"` and panics on anything else
     (`routes/mod.rs:2254-2256`). It gains `PUT` and `DELETE` arms.
   - The contract checker's hermetic probe expects the owner 403 only for a `GET`
     (`tools/api-contract.mjs:213`); any other method falls through to 422 (`:235`). The journal's
     writes use the `OwnerUser` extractor, which refuses before the body is read, so an anonymous
     probe gets 403. The rule becomes: an owner-only operation expects 403 for every method, except
     `POST /api/recommendation/{ticker}`, which parses its body first and keeps its 422.
   - The doc comments on `OWNER_ONLY_OPERATIONS` (`routes/mod.rs:2266-2274`) and `OWNER_EMAILS`
     (`config.rs:71-82`) define the gate as guarding licence-derived "Derived Works" and leave out
     "the caller's own book" on purpose. Both comments, and DESIGN.md's owner-gate section
     (`DESIGN.md:440-444`), are amended to say the gate also guards owner-personal data.
4. **The winner's sample arc doesn't add up.** It showed margin used falling from about 66% to 41%
   with no sale to explain it. This spec re-authors the sample from positions, trades and marks, and
   every figure below was recomputed by script (scratch, not committed).
5. **A drawdown percent was ambiguous** between simple subtraction and a time-weighted chain.
   Computed facts names the method.
6. **There is no pen icon.** `icon('edit')` in `design/src/lib.mjs` renders an empty SVG (measured:
   0 path elements), and the Positions board already calls it (`account-pages.mjs:176`).
7. **The cost table.** `llm.rs:80` still defaults Anthropic to `claude-opus-4-8`. The journal names
   its own models, priced from `docs/product/ai-analyst/DESIGN.md:450-457`.
8. **The first sample contradicted the demo's own prices.** It marked NVDA at $110 and a QQQ 520
   call at $2.90, but the demo catalog's closes for the same dates are about $199 and $633
   (`libs/api/src/lib/demo/catalog/shared.ts:205-230` over each `*.seed.json`'s `base`, `step` and
   `phase`), which also put that call $87 below its intrinsic value. The sample is re-authored on
   the catalog: every stock mark is the catalog's close for its date, and every option mark is at or
   above intrinsic value (Computed facts → Worked example).

## Who and when

- **The owner, on production.** He is the only real user (`OWNER_EMAILS`). He writes on his phone
  the moment something happens: a fill, a scare, a margin call. On a normal day he writes a sentence
  and taps Save. On Mondays he runs a review, reads what his entries show, and turns the findings he
  agrees with into rules. Before a trade he opens "Plan a trade", answers his own rules and writes
  why. His first entries will mostly be written from memory, as his own example is. The design
  labels those entries and keeps them out of any claim about what he decided at the time, and his
  first reviews say so plainly ("Mostly from memory", Screens → Weekly review).
- **A recruiter or reviewer, on staging.** They open Positions › Journal on the demo and find a
  fictional trader's sample journal. It covers July to Oct 6, 2026, with a peak, adds below cost,
  margin creeping up, a margin call, and an account 42.6% below its recorded high. Its stock marks
  are the demo's own closes, so the Journal and the Ticker pages agree. They read an authored weekly
  review whose every number cites its entries, and a rulebook drawn from them. They can write an
  entry or adopt a rule in their own browser, and nothing is sent anywhere.

## Scope and non-goals

**In scope**

- Four section tabs on Positions: Book · Journal · Review · Rulebook. No sixth nav link (open
  question 1).
- Owner-only API routes and their tables, encrypted at rest. A JSON-file store for local dev, so
  entries survive a restart.
- The record:
  - sealed entries with kinds, a Written date and an About date;
  - account snapshots that carry forward;
  - money in or out;
  - typed positions;
  - later notes;
  - figure corrections;
  - withdrawing an entry.
- Computed facts in Rust: margin used, excess liquidity, leverage, loan to position value, change
  between snapshots, the drawdown with deposits taken out, the recorded high, where the money went,
  planned risk, and position P/L (all or nothing). One TypeScript copy of the account-level facts,
  for previews before save and for the demo, pinned to Rust by a parity test.
- The account chart (three small multiples with an event rail) and its table twin.
- The rulebook: hand-written and drafted rules, versions, pause and retire, Plan a trade with his
  answers and readings, adherence counts, and a printable card.
- The deterministic layer:
  - the entry parser and the Tidy queue;
  - his named suspicions;
  - the fixed detector table;
  - where the money went;
  - the event callout.
- The AI, off by default and on his own key:
  - entry reads (details and digest only);
  - the weekly synthesis (findings, an event callout, questions back, rule drafts);
  - corrections;
  - the What's sent drawer;
  - costs and caps;
  - the citation, advice and tone checks;
  - an eval gate.
- History import: write about an earlier day, paste positions, and read a trades CSV in the
  browser.
- Export (JSON), a merge-only restore that keeps "written at the time" only for sealed entries, and
  deleting the whole journal.
- The staging sample journal, served by the demo transport.
- Rows on `/privacy`, a Settings › Journal panel, and a pen icon.

**Not in scope**

- **No order, ever.** The journal never places, changes or cancels an order, and nothing in it
  writes to the simulated book or to a brokerage (`PROJECT_CONTEXT.md:346-351`).
- **No buy, sell or hold advice**, no market forecast, no sizing suggestion for a ticker.
- **No broker sync of balances or margin.** No source exists. A future source would be a separate
  spec, and it would carry its own provenance.
- **No screenshots or statement uploads.** The server accepts no files, and an image would be a
  new kind of egress.
- **No other accounts.** Every route is owner-only, and this analysis is personal to one real
  account, so it is never opened to other users in this form (compliance: `DESIGN.md:421-436`).
- **No journal content in git, `research/`, fixtures, boards, eval items, logs or commit
  messages.**
- **No journal figure in the ticker AI read, decision records, the outcomes ledger, alerts, the
  Settings risk inputs or any other export.** A rule stays in the rulebook. A hand-off to Settings or
  personas would be a separate spec.
- **No market strategies from the AI.** Process strategies drawn from his own entries become rule
  drafts and questions; what to buy, and when, stays out (open question 15).
- **No streaks, scores, badges, push notifications or nagging.**
- **No chat with the AI about findings.** A question-and-answer surface invites advice drift; it is
  later, if ever.
- **No server-side search.** Bodies are encrypted; search runs in the browser.
- **No edit of sealed text.** Later notes only. A short correction window is open question 9.
- **No application of rules** to Settings or personas, with or without a confirm.

## Information architecture

### Placement

Positions gains section tabs, reusing Research's pattern (`DESIGN_SYSTEM.md:273`, the 2026-10-13
row: a band under the top bar, the current tab underlined in text colour, not amber, and a sideways
rail on a phone). `ResearchTabs.tsx` is generalised into a shared `SectionTabs` rather than copied.

| Tab | Route | What it is |
|---|---|---|
| Book | `/positions` | Today's page, unchanged. Its SIMULATED framing and the planned Simulated · Broker segment (`account-pages.mjs:165`) stay on this tab only. |
| Journal | `/positions/journal` | The timeline of his real account. |
| Review | `/positions/review` | The weekly review. |
| Rulebook | `/positions/rulebook` | His rules. |

Review and Rulebook appear with their slices; before then the band reads Book · Journal (Build plan
→ What each slice shows).

The three journal tabs are about the real account. Each carries the subline "Your real account, in
your words.", and none carries a SIMULATED chip. TopNav already lights Positions for every
`/positions/*` path (`shell/TopNav.tsx:99`), so the nav keeps its five links (rule 19,
`DESIGN_SYSTEM.md:176`). The cost is one more click from other sections, which the capture paths
below cover.

### Routes

Each is a `lazyRoute` inside the AppShell (`app/route-boundaries.structural.spec.ts:1-5`), declared
before the catch-all (`app.tsx:359`). Each sits inside its own `RequireAuth` with `surface="your
journal"` and `demoPath="/positions/journal"`, as `/positions` does (`app.tsx:321-329`). The server
refuses anyone but the owner.

| Route | Screen |
|---|---|
| `/positions/journal` | Journal timeline |
| `/positions/journal/new` | Composer. `?kind=entered\|added\|trimmed\|closed\|margin_call\|money\|plan\|thinking`, `?about=YYYY-MM-DD`, `?symbol=NVDA`, `?quote=<finding question id>` |
| `/positions/journal/:entryId` | Entry |
| `/positions/journal/tidy` | Tidy up (slice 3) |
| `/positions/journal/import` | Import history (slice 5) |
| `/positions/review` | Latest review. `/positions/review/:reviewId` is a past one. `?finding=:id` opens the finding drawer. |
| `/positions/rulebook` | Rulebook |
| `/positions/rulebook/:ruleId` | Rule |
| `/positions/rulebook/print` | Printable rulebook card |
| `/settings#journal` | Settings › Journal panel: export and delete (1b), suspicions (3), AI consent, models and caps (4), reading on save and the bulk read (5) |

### Ways in for capture

- The header primary "Write entry" on every journal tab.
- The quick-capture box at the top of the timeline.
- On a phone, a sticky, safe-area-padded bottom bar on the journal tabs: amber "Write entry" and an
  outlined 44px "Margin call" with the warning glyph.
- ⌘K: a "Write" group with two rows, "Write a journal entry" and "Margin call entry". This is open
  question 2. The group sits after Go to. `PALETTE_COMMANDS` stays the five surfaces.
- No `g` key, because `GO_TO` mirrors the nav exactly (`shell/shortcuts.ts:12-19`).
- In the composer, ⌘↵ saves and Escape leaves while keeping the draft.

### Objects

- **Entry**: sealed text, a kind, `written_at` (set by the server), an optional `about_date`, and a
  source (typed, paste, csv or split). An entry has:
  - at most one **Snapshot** (typed figures and positions, each with a provenance, and an `as_of`
    date and time for the moment the figures describe);
  - optional **Money in or out**, with the date and time it happened;
  - **Later notes** (append-only);
  - **Details** (proposed by the parser or the AI, kept, fixed or rejected by him);
  - **Rule answers** (on plans).
- **Correction**: a superseding figure on a snapshot. The original stays visible.
- **Suspicion**: a downfall he names himself, tested first.
- **Review**: the computed parts (the week in numbers, the detector table, where the money went,
  events) and, if AI reads are on, one AI run with **Findings**, **Questions** and **Rule drafts**.
- **Rule**: **Versions** (append-only) and **Checks**.

### Order

The timeline defaults to **Written** order, the honest one. A segment switches to **About** order,
so an entry written Oct 26 about Aug 14 sorts by Aug 14. Every recalled card says both dates.

**Recalled is derived, never stored.** An entry is recalled when its kind is Imported, or when its
effective About date (the latest About-date correction, else `about_date`) is before the date it was
written. One function in `services/journal/store.rs` decides it on every read, so a correction made
in Tidy takes effect in the timeline, the detectors and every package at once.

**One time zone.** Every date the journal shows or counts by is in **America/New_York**, the market's
time zone, whatever the browser's zone: the Written date, `about_date`, day groups, "N days old",
weekdays, the Monday offer, "today" for the daily caps and the month for the monthly cap. The server
stores instants in UTC and converts once, in the store. An entry saved at 9:30 PM ET on Sep 29 about
Sep 29 is at the time, although it is already Sep 30 in UTC.

## Computed facts (binding; Rust computes them, and one pinned TypeScript copy previews them)

All money is integer cents. Percentages stay unrounded until display. Display rounds half up (away
from zero): whole percent for margin used, one decimal for drawdown, change and "% below average
cost", everywhere they appear.

Snapshots are ordered by `as_of`, then `written_at`. "Previous snapshot", the index and the recorded
high all follow that order, so a statement for Aug 4 written on Aug 21 sorts at Aug 4.

| Fact | Definition | From |
|---|---|---|
| Margin used | margin loan ÷ account value | two typed figures |
| Excess liquidity | account value − maintenance requirement | two typed figures |
| Leverage | long position value ÷ account value | typed positions × marks × multiplier, only when every position has a mark |
| Loan to position value | margin loan ÷ long position value; shown in the margin used ⓘ (open question 7) | the loan and typed positions, only when every position has a mark |
| Position share | one position's value ÷ long position value | typed positions × marks |
| Change since the previous snapshot | dollars: value now − value before − money in + money out; percent: the chain-linked step below | snapshots, money in/out |
| Chain-linked index | `I₀ = 1`; at each snapshot `Iₖ = Iₖ₋₁ × (Vₖ − Fₖ) ÷ Vₖ₋₁`, where `Fₖ` is the net money in (in minus out) whose `occurred_at` is after snapshot k−1's `as_of` and at or before snapshot k's | snapshots, money in/out |
| Recorded high | the snapshot with the highest index so far | the index |
| Below the recorded high | `Iₖ ÷ max(I₀…Iₖ) − 1` | the index |
| Lost since the high | value at the high − value now + net money in since the high | snapshots, money in/out |
| Account value alone | `Vₖ ÷ V_high − 1`, shown in the ⓘ beside "below the recorded high" | snapshots |
| Where the money went | per position since the high: value now + proceeds of sales − cost of buys − value at the high. The remainder (interest, fees, untyped trades) is shown as "Not explained by your typed marks" | positions, marks, kept trade details |
| Planned risk | stock: qty × \|entry − exit\|; a long option: premium paid (the `maxLoss.ts` eligible set) | kept details |
| Position P/L | all or nothing per position: a missing mark gives `not recorded`, never a partial sum (`positions/leg.ts:97-108` semantics) | positions, marks |

**Why the chain-linked percent.** A deposit made to meet a call raises account value and would hide
part of the loss in simple subtraction. The chain takes each deposit or withdrawal out on its day.
The ⓘ says so in words and shows the raw figure too. Dollars ("Lost since the high, net of money in
and out") are the unambiguous number, and they sit beside the percent.

**Recalled snapshots** take part in the index and the recorded high, drawn hollow and labelled "from
memory" or "from a statement". The recorded high says when it was written ("$51,251 · Aug 21 ·
written at the time").

**Edge cases (binding):**

- **No account value.** A snapshot whose account value is `not recorded` is skipped by the index, the
  recorded high and the change. The chain bridges it: money in or out across the gap is summed into
  the next step that has a value.
- **An account value at or below $0** breaks the chain. From that snapshot on, every percent fact
  (margin used, the change percent, the index, below the high, account value alone) reads `—`, with
  the line "Account value reached $0 or below on {date}, so a percent can’t be chained past it. The
  dollars still add up." Dollar facts carry on.
- **Money on the same day as a snapshot.** Money in or out carries a date and a time. The composer
  defaults the time to the save time, and when a snapshot falls on the same day it shows which side
  the money lands on: "Counted before your 3:40 PM numbers · Change". Without that, a deposit made
  after a morning snapshot would be taken out of the wrong step.

**Leg math.** A typed position is a new `RealLeg` record in `leg.ts`'s shape (unsigned quantity,
side enum, multiplier on the leg), never a `SimPosition` (`positions/leg.ts:20-59`).

**Where facts are computed.** Saved facts are always the server's. Two places need facts before the
server has them: the composer before save (the Computed box, the sanity question, the margin-call
cross-check and Plan a trade's projection, all of which must also work offline), and the staging
demo, which has no server at all. For both there is **one** TypeScript module,
`libs/api/src/lib/journal/facts.ts`. It covers the account-level facts only: margin used, excess
liquidity, the change since the previous snapshot, the chain-linked index, the recorded high, below
the high, account value alone, lost since the high, and the projection. A parity test runs it and
`facts.rs` over one shared fixture of the worked example below
(`apps/api/tests/fixtures/journal/worked-example.json`, synthetic) and fails on any difference, so the
two copies can't drift unnoticed. Facts that need legs (position value, position share, leverage,
loan to position value, P/L, where the money went) are Rust only. The demo seed carries them as
authored values, checked against `facts.rs` by criterion 6's test over the same fixture. A demo
visitor's own entry shows them as `—`.

### Worked example: the staging sample, checked by script

The sample is a fictional trader's, re-authored on the demo catalog. Every **stock mark** is the
catalog's close for that date (`libs/api/src/lib/demo/catalog/shared.ts:205-230`): NVDA $195.20 on
Aug 21 and $199.21 on Oct 6, for example. Every **option mark** is authored and at or above its
intrinsic value at that close; both strikes sit below spot throughout, so intrinsic is $0. The
options expire Dec 18 '26, which the demo's chain doesn't list (`shared.ts:6`), so no demo page shows
a second price for them. The headline (42.6% below the high) and the call ($2,750) were chosen apart
from any real account's figures.

Positions and trades:

- **Bought before the catalog's history begins** (about Jul 2, Jul 9 and Jul 14; 3 imported
  entries): NVDA 160 sh at $214.00, MSFT 30 sh at $498.00, and 6 TSLA Dec 18 '26 440 P at $31.00.
- Aug 26: entered 4 QQQ Dec 18 '26 600 P at $13.60 ($5,440). Exit named: $8.00 on the puts. "How
  sure are you this works out?" 70.
- Aug 28: added NVDA 60 at $195.50, 8.6% below the $214.00 average; it becomes $208.95.
- Sep 4: added 3 TSLA puts at $25.60, 17.4% below the $31.00 average; it becomes $29.20.
- Sep 11: added 3 TSLA puts at $22.90, 21.6% below $29.20; it becomes $27.63.
- Sep 18: added 3 TSLA puts at $19.80, 28.3% below $27.63; it becomes $26.06.
- Sep 29: margin call of $2,750, due Oct 1, 4:00 PM.
- Sep 30: trimmed NVDA 60 at $199.26 (Closed by: Me), −$581.67 against the $208.95 average. Money
  in: $2,500, at 10:05 AM, before that day's 3:40 PM snapshot.
- Oct 2: trimmed 5 TSLA puts at $13.10, as the Oct 1 plan said, −$6,480.00 against $26.06.

Option marks at each snapshot:

- TSLA 440 P: $28.20 · $27.40 · $26.90 · $25.60 · $24.70 · $21.60 · $19.80 · $15.40 · $14.20 ·
  $13.90 · $13.10 · $10.40 (Aug 4 to Oct 6).
- QQQ 600 P: $13.20 · $12.90 · $12.70 · $11.90 · $10.80 · $8.70 · $7.90 · $7.70 · $7.20 · $6.60 (Aug
  28 to Oct 6).

| Snapshot | Source | Account value | Margin loan | Maint. req. | Margin used | Below the recorded high | Account value alone |
|---|---|---|---|---|---|---|---|
| Aug 4 | Statement, written Aug 21 | $51,021 | $11,980.00 | not recorded | 23% | 0.0% | — |
| Aug 21 | Broker screen | **$51,251** (recorded high) | $12,033.60 | not recorded | 23% | 0.0% | 0.0% |
| Aug 28 | Broker screen | $50,835 | $29,225.90 | not recorded | 57% | −0.8% | −0.8% |
| Sep 4 | Broker screen | $49,821 | $36,959.30 | not recorded | 74% | −2.8% | −2.8% |
| Sep 8 | Broker screen | $48,913 | $36,998.00 | not recorded | 76% | −4.6% | −4.6% |
| Sep 15 | Broker screen | $45,629 | $43,936.40 | not recorded | 96% | −11.0% | −11.0% |
| Sep 18 | Broker screen | $43,277 | $49,911.40 | not recorded | 115% | −15.6% | −15.6% |
| Sep 25 | Broker screen | $36,146 | $50,002.50 | not recorded | 138% | −29.5% | −29.5% |
| Sep 29 | Broker screen | $34,047 | $50,055.40 | $36,797 | 147% | −33.6% | −33.6% |
| Sep 30 | Broker screen | $36,021 (+$2,500 in) | $35,612.90 | $34,900 | 99% | −34.6% | −29.7% |
| Oct 2 | Broker screen | $34,603 | $29,081.70 | not recorded | 84% | −37.2% | −32.5% |
| Oct 6 | Broker screen | $31,609 | $29,112.20 | not recorded | 92% | **−42.6%** | −38.3% |

Each snapshot's typed positions × marks − margin loan equals its account value to the cent. Cash is
$0 throughout; the loan absorbs it. The loan's growth between snapshots beyond the trades is margin
interest, at about 9.5% a year. Derived:

- Sep 29: excess liquidity $34,047 − $36,797 = −$2,750, which matches the broker's call.
- Sep 30: excess liquidity $36,021 − $34,900 = +$1,121.
- Oct 6: lost since the high, net of money in and out, $51,251 − $31,609 + $2,500 = **$22,142**.
- The margin-call event, Sep 25 → Sep 30: $36,021 − $36,146 − $2,500 = −$2,625 (−7.3% chained),
  which is 11.9% of $22,142.
- The week of Sep 28 – Oct 6, from the Sep 25 snapshot: $31,609 − $36,146 − $2,500 = −$7,037
  (−18.6% chained).
- Where the money went since Aug 21:

  | Position | Since the high | Share of the fall |
  |---|---|---|
  | TSLA Dec 18 '26 440 P | −$19,980 | 90.2% |
  | QQQ Dec 18 '26 600 P | −$2,800 | 12.6% |
  | NVDA | +$867 | — (a gain) |
  | MSFT | +$195 | — (a gain) |
  | Not explained by typed marks (interest, fees, untyped trades) | −$424 | 1.9% |
  | Total | −$22,142 | |

  Shares are of the $22,142 lost. They add to more than 100% because NVDA and MSFT gained.
- Leverage: 1.23× on Aug 21, 2.47× on Sep 29.
- Sep 18: margin used 115% of account value; loan to position value 53.6%.
- NVDA was over 40% of position value at 12 of 12 snapshots.
- Margin used set a new high at 7 of the 11 steps between snapshots (Aug 28 through Sep 29).
- The unrounded series ends at −42.6056% on Oct 6, so display rounding isn't at an edge there.

## Screens

Every screen uses tokens from `shared/theme/tokens.ts` only, `pageColumnSx`
(`shared/ui/PageColumn.tsx:11`), and the account-page title size `clamp(30px, 3vw, 40px)`. Figures
use `FigureCell` (`pages/ticker/widgets/_kit/FigureCell.tsx`): Mono, tabular, state in the label
row. Frames use `PanelContainer` (`shared/ui/PanelContainer.tsx`). Tags use `DataStateTag` and
`DATA_STATES` (`shared/dataState/vocabulary.ts:32-50`). Charts use `ChartFrame` with its
`TableTwin` (`shared/charts/frame/ChartFrame.tsx`). An ⓘ is `AccessibleHelp`
(`shared/ui/AccessibleHelp.tsx`). Below 600px, overlays are `bottomSheet` (`shared/ui/bottomSheet.ts`).
The Final-board kits are `design/src/screens/v4/kit.mjs`: `statesBoard`, `dlg`, `overPage`, `fld`,
`seg`, `sw`. `account-dialogs.mjs` supplies `overDemo` and `sheetsBody`, and
`components/risk-field.mjs` the traced/untraced figure.

**State words.** Only the closed P-2 set is used:

| Word | Used for |
|---|---|
| Stored here | his typed figures |
| Computed | Convexa's arithmetic |
| Couldn’t load | the journal didn't load |
| Not set up | no key, no model, no encryption key on the server |
| Off | AI reads off |
| Sign in | the wall |
| Sample | staging frames, with Demo · sample data on the demo bar |

Updated, Delayed by source, Last good copy, Source down, Paused, Not live and Live · TradingView
never appear on a journal screen. Value gaps use only rule 24's set (`DESIGN_SYSTEM.md:181`):

| Member | Used for |
|---|---|
| `not recorded` | never captured |
| `not set` | no exit named, or a rule with no limit |
| `not given` | no confidence stated |
| `no basis` | P/L with no average cost |
| `unrecognized` | an import line that didn't parse |
| `—` | a cell with nothing to show: percent facts past a chain break, a gain's share of the fall, and leg-based facts on a demo visitor's own entry |

Rule answers (Yes · No · Doesn’t apply · Not answered) are answer labels, not value gaps; they render
in Sans like any other label. Loading and empty states carry no tag.

### 1. Journal timeline · `/positions/journal`

**Purpose.** The home. He can write without leaving the page, and see the record in the order it was
written.

**1440** (page column 1280):

- **Header.**
  - h1 "Journal" (Archivo).
  - Subline, 15px `textDim`: "Your real account, in your words. Typed by you, stored on your account."
  - Right: the screen's one amber primary, "Write entry", with the new pen glyph.
- **Tab band**, as above.
- **Body grid:** main `minmax(0, 1fr)` and a 360 rail, gap 24.
- **Main, top: quick capture**, a quiet panel.
  - One line, "What happened, and what are you thinking?", which grows to six lines on focus.
  - Kind chips, optional and single-select: Entered · Added · Trimmed · Closed · Margin call ·
    Money in or out · Plan a trade · Just thinking.
  - Numbers line: "Numbers: carried from Oct 6 (1 day) · Update".
  - An outlined "Save" and a text link "Open full editor". Save is outlined because the header holds
    the screen's one amber fill.
- **Main, below.** The segment "Order by: Written · About". When an entry's "Revisit on…" date has
  come, a quiet line sits above the day groups: "Revisit due: your Aug 26 entry (QQQ puts) · Open".
  It is computed in the browser from `revisit_on`; nothing is notified, and nothing reaches Alerts
  (slice 1b). Then **day groups**:
  - A header such as "Tue Sep 29" with that day's snapshot line: labels in Sans, figures in Mono,
    "Account value $34,047 · margin used 147% · call $2,750".
  - Entry cards, quiet panels with no lift.
    - Row 1: the time "2:14 PM" (Sans 13, `textDim`), a kind pill (outlined, neutral), ticker
      chips (Mono 12, neutral), and the AI status at the right.
    - The Margin call pill carries the warning glyph and burnt-orange text, never red.
    - The body: the first 4 lines, Plex Sans 16/1.55, then "Read more".
    - Footer: "Written Oct 26 · about Aug 14" on recalled entries · "1 later note" · "Asked 2
      rules" on plans · "Corrected Aug 22" when a figure was corrected.
- **Rail.**
  1. **Account frame** (solid border: own data; `ChartFrame`).
     - Title, the finding: "Account value $31,609, 42.6% below its recorded high".
     - Body: the account value small multiple only, as a sparkline height of the Path chart.
     - "Open the account path" opens the full Path in a 760 drawer (slice 1b; before it, the frame
       has the figure strip only).
     - Figure strip below:
       - Account value $31,609 (Stored here · Oct 6);
       - Margin used 92% (Computed);
       - Since Oct 2: −$2,994 (−8.7%) in `textDown` with the minus sign;
       - Below the recorded high −42.6% (Computed) with its ⓘ.
  2. **Rulebook mini** (slice 2): "Active rules 2", each wording on one line. A rule with a limit
     shows its reading, e.g. "Margin used now 92% · R3 limit 50%", with the warning glyph and the
     word "above".
  3. **Review mini** (slice 3): "Last review Oct 7 · 4 findings · 0 entries since · Open review".
  4. **Filters**: search (run in the browser over decrypted entries), kind, ticker, "Written from
     memory", "Kept out of AI reads", "Has later notes".

**Phone (390).**
- h1 at 30px; the tab rail.
- An account peek row, "Account value $31,609 · margin used 92% · Oct 6 ›", that opens the Path and
  its table twin in a bottom sheet.
- No quick-capture box: the sticky bottom bar replaces it.
- Cards are full width with a 3-line clamp. Filters are in a bottom sheet.
- No horizontal overflow at 390 or 393.

**States.**

| State | Tag | Words |
|---|---|---|
| First run | — | Heading "Start with today." Body "Write what you hold, what you’re thinking and how the account looks. One sentence is enough. Nothing is sent to an AI until you turn AI reads on." Primary "Write the first entry". Links "Write about an earlier day" (1a) · "Name what you think goes wrong" (from slice 3) · "Bring in past trades" (from slice 5); a link whose slice hasn't shipped isn't drawn. The rail frames name their metric: "Account value · appears after your first snapshot". |
| Loading | — | Day-group skeletons at their final height. |
| Loaded | Stored here on figures | As above. |
| Couldn’t load | Couldn’t load | "Your journal didn’t load. Nothing is lost." + "Try again". Drafts held in this browser are still listed. |
| Not on your account yet (a save failed or the device is offline) | — | A strip on the card: "Not on your account yet. Kept in this browser until it goes through · Try again". |
| Signing out with an unsent entry | — | Sign-out stops first, inline: "{1} entry hasn’t reached your account yet. Signing out deletes it from this browser." + "Try sending now" · "Sign out and delete it" · "Stay signed in". Drafts are cleared on sign-out; a queued entry is never dropped without this. |
| Storage not set up (no journal encryption key on the server) | Not set up | "Journal storage isn’t set up on this server, so nothing can be saved yet." |
| Signed out (production) | Sign in | The Positions private-testing wall: "Sign in to open your journal". Sign-ups are closed. "See it on the demo →". |
| Not the owner (API 403 `owner_only`) | — | "This journal is private to the account that owns this Convexa." + "See it on the demo →". No P-2 word exists for this (open question 12). |
| Staging | Sample (once per frame) | The demo bar is the page's one "Demo · sample data · Oct 7, 2026". Frames are dashed, with the 8px steel hatch band. The account frame's source chip reads "Sample journal". Cards and rows carry no tag (D1, `DESIGN_SYSTEM.md:288`). |

### 2. Composer · `/positions/journal/new`

**Purpose.** The lowest-friction honest capture: text first, numbers carried forward, sealed on
save.

**1440.**
- A page, not a dialog, so a long write survives a stray click. Centred grid: editor column 720 and
  snapshot column 400, gap 32.
- **Top.**
  - h1 "New entry".
  - Meta: "Written when you save · Tue Sep 29" and "About: Today ▾".
  - Choosing an earlier date shows the info strip: "This will read “Written Oct 26 · about Aug
    14”. Reviews treat it as memory, not as what you thought at the time." It also sets the
    snapshot's "As of" to that day at 4:00 PM ET, which he can change ("As of Aug 14, 4:00 PM ·
    Change").
  - Kind chips: optional, single-select, 44px on touch. "Plan a trade" appears with slice 2.
- **Editor.** A quiet panel with a borderless textarea, Plex Sans 17/1.6, about 68ch wide, min-height
  320, growing with the text. Text renders through the browser-side Markdown subset
  (`pages/blog/markdown.ts:32`, `:139`), which emits no HTML. Placeholder by kind:
  - Default: "What happened, and what are you thinking right now?"
  - Entered or Added: "What did you buy or sell, why now, and what would tell you you’re wrong?"
  - Plan a trade: "What are you about to do, and why?"
  - Just thinking: "Anything on your mind about the account."
- **Optional reveals:**
  - "+ How sure are you this works out? (0–100)", on Entered and Added only. It resolves by row 10's
    rule (Weekly review → the fixed detector table).
  - "+ I’m wrong if…", with a price field "Exit at $ ___" and a checkbox "No exit set"
  - "+ Revisit on…"
  - On Trimmed or Closed: "Closed by: Me · Broker (liquidation) · Expiry · Assignment"
- **Checkbox:** "Keep this entry out of AI reads". It ships in 1a, so entries written before AI
  reads exist can already be kept out.
- **Footer.**
  - Left: "Draft saved 2:15 PM" with the Stored here tag. The draft is kept in this browser only, in
    plaintext under `convexa.journal.drafts.v1` (listed on `/privacy`), and cleared on save, on
    Discard and on sign-out.
  - Right: a text button "Discard draft" and the amber "Save entry" with ⌘↵.
  - Under them: "Saved entries stay as written. You can add a later note any time."
- **Before save:** a run of 9 or more digits shows the inline warning "This looks like an account
  number (9 or more digits in a row). Remove it? Entries never need one." with "Remove" and "Keep
  it". It never blocks.
- **Snapshot column.** A panel "Account snapshot" (Stored here).
  - Header: "Carried from Sep 25 · 4 days old", with the segment "Unchanged · Update numbers".
  - Update reveals the unit-bearing fields: Account value · Cash · Margin loan · Maintenance
    requirement · Buying power (optional) · "+ Margin call" (Call amount, Due by).
    - The $ unit is visible. Plain decimals only (owner answer of 2026-10-16 (4)).
    - Values group on blur ("$25,000").
    - Validation is inline: "Use a plain number like 41210 or 41,210.50".
    - Under each field, the previous value: "was $36,146 on Sep 25".
  - Source segment: "Broker screen · Statement · Memory". The default is Broker screen when About is
    today and Memory when it isn't.
  - **Sanity questions, never blocking:** a typed $3,604 instead of $36,040 reads "This is 90% below
    your Sep 25 snapshot ($36,146). Keep it?". It appears when a value moves more than 40% from the
    previous snapshot.
  - Positions: rows such as "NVDA · 220 sh · avg $208.95 · mark $199.20" and "QQQ · 4 × Dec 18 ’26 600
    P · avg $13.60 · mark $7.90". "Edit positions" (slice 1b) opens a 760 dialog built on the new
    `RealPositionRows`. It **copies** the `LegFields` grid into `features/journal` and imports only
    the pure `multiplierFor` (`features/trading/tradeEntry/LegFields.tsx:22`), which moves to
    `positions/leg.ts` with a re-export left behind. Nothing in `features/journal` imports from
    `tradeEntry`, so the real-account surface stays structurally separate from the sim dialog (rule
    10, `PROJECT_CONTEXT.md:376-390`). It is never `TradeEntryDialog` or a mode of it: no SIMULATED
    chip, no order control.
  - **Computed box** (Mono, Computed): Margin used 147% · Excess liquidity −$2,750 · Since Sep 25
    −$2,099 (−5.8%). Before save it is computed in the browser by the shared facts module (Computed
    facts → Where facts are computed), so it works offline; after save the card shows the server's.
  - Foot: "These are the numbers you type. Convexa can’t read balances or margin from your broker,
    and never places, changes or cancels an order."
  - Typed figures are Mono with no dotted rule (rule 13, ruling D-D). An empty field reads `not
    recorded`.
- **Money in or out** (kind chip, or "+ Money in or out" on any entry): Direction (In · Out),
  Amount, Date and time (the time defaults to now). On a day with a snapshot it shows "Counted
  before your 3:40 PM numbers · Change". Its foot: "Money in or out is taken out of the drawdown, so
  a deposit can’t hide a loss."

**Phone (390).**
- A full-screen page. Top bar: ✕ (leave and keep the draft) · "New entry".
- The kind chips are a sideways rail, and the editor fills the screen. Dictation is the keyboard's
  own.
- A toolbar is pinned above the keyboard: "Numbers: carried · Update" · "+" · amber "Save".
- Update opens a bottom sheet of `inputmode="decimal"` fields in 44px rows, actions stacked.

**States.**

| State | Tag | Words |
|---|---|---|
| Blank | — | Placeholders as above. |
| Draft restored | Stored here | "Picking up your draft from 1:58 PM · Discard". |
| No earlier snapshot | — | "No numbers yet. Add them, or save without; they’ll read “not recorded”." |
| Carried | Stored here | "Carried from Sep 25 · 4 days old". |
| Carried and old | Stored here | Plain text "Carried from Sep 6 · 23 days old". Not a warning: his numbers aren't a feed. |
| Validating | — | Inline at the field. |
| Saving | — | The in-flight indicator in the button. |
| Saved | — | Back to the timeline, the new card focused: "Saved · Tue Sep 29, 2:14 PM". |
| Save failed | — | "Couldn’t save to your account. Your text is kept in this browser until it goes through." + "Try again". Inline, never a toast. |
| Offline | — | The same words; the save is queued and retried with the same client id, so it can't land twice. |
| Walls and staging | as on the timeline | On staging, writes go to demo browser storage, and the Computed box comes from the shared facts module. Leg-based facts on a visitor's own entry read `—`. |

### 3. Composer · Margin call mode · `/positions/journal/new?kind=margin_call`

**Purpose.** Capture at the worst moment in under a minute, with nothing on the page that reads as
judgement.

**1440.** The same page, reduced.
- h1 "Margin call".
- A quiet info strip, not a warning: "Write it as it is, facts first. Nothing here is graded, and
  you can add more later. This page doesn’t contact your broker; its notice and deadline are what
  count."
- One compact row above the editor: Call amount ($) · Due by (date and time) · Account value now ($).
  Call amount is autofocused, and Due by is one native `datetime-local` input (criterion 4).
- Margin loan and Maintenance requirement are prefilled from the last snapshot under "More numbers".
  Positions default to "Unchanged since Sep 25", with one tap to edit.
- Placeholder: "What’s happening, and what are you weighing? It doesn’t have to be tidy."
- One optional line: "One thing you want to remember from today".
- Saving with only the numbers is allowed.
- **Cross-check, two neutral lines with no verdict** (computed in the browser before save, by the
  shared facts module):
  - When they match within $1: "Your broker’s call: $2,750" and "Your numbers compute excess
    liquidity of −$2,750. That matches the call."
  - When they don't: "Your broker’s call: $2,750" and "Your numbers compute −$2,762", with nothing
    more.
- **After save:** "Saved · Tue Sep 29, 2:14 PM. It’s in the record as you wrote it." Then one offer,
  "Add a later note when it’s resolved". On the timeline, a quiet line follows: "When you’re ready,
  a review can look at the weeks before this call. Nothing runs until you ask."

**Phone (390).** The three numbers stack as 44px fields above the editor, in the order things
happened. The bottom bar's "Margin call" opens this mode from any journal tab; ⌘K "Margin call
entry" does on desktop.

**States.** The composer's, plus a "Call amount `not recorded`" save, and entry from ⌘K on any page.
No AI read runs on a margin-call entry, even with reads on every save turned on.

### 4. Composer · Plan a trade · `/positions/journal/new?kind=plan`

**Purpose.** Check an intended trade against his own rules before he places it at his broker. His
answers are recorded. Nothing is blocked, and nothing is judged.

**1440.** The composer with the right column swapped: "Your rules" first, the snapshot below.
- Each active rule shows:
  - its number (Mono 13);
  - its wording (Sans 15);
  - its check question, e.g. "Is margin used at or below 50% of account value?";
  - a 44px segment: Yes · No · Doesn't apply. It starts unselected.
- A rule with a limit shows the reading as received: "Margin used 84% of account value (Oct 2
  snapshot, 3 days old) · R3 limit 50% · above", with the warning glyph beside "above". "within" is
  plain neutral text, never green. The reading never pre-fills his answer.
- **Projection, stated with its assumption:** "If the $1,280 is borrowed: margin used 84% → 88%".
  It is computed in the browser from his typed numbers by the shared facts module, with no
  maintenance-rate assumption.
- When the snapshot is more than 5 weekdays old, a burnt-orange strip with its icon reads: "These
  numbers are 20 days old. Update them for a current reading."
- **On a No answer**, an optional field: "Why go ahead anyway? (optional)". It is never required.
- The "+ I’m wrong if…" reveal is open by default for this kind.
- Above the amber "Save plan": "This journal doesn’t stop or place trades. It keeps what you
  decided, and why."
- Unanswered rules save as "Not answered", an answer label like the other three.

**Phone (390).** The rules stack first and the editor second, with a sticky "Save plan". Each rule's
segment is a 44px row.

**States.**

| State | Words |
|---|---|
| No rules | "No rules yet. Plans still save; rules you adopt later show up here." + "Write a rule". |
| No snapshot | Readings show `not recorded`. |
| Stale snapshot | The strip above. |
| Saved | "Plan saved · asked 2 rules · 1 answered No". |
| Walls and staging | As elsewhere. |

### 5. Entry · `/positions/journal/:entryId`

**Purpose.** One entry exactly as written, with its numbers, the details found in it, what the AI
made of it, and the rules it touched.

**1440.** Two columns, 720 and 400.
- **Left.**
  - Meta: "Tue Sep 29, 2026 · 2:14 PM" (set by the server) · the kind pill · "about Sep 29".
  - Recalled entries get an info strip: "Written Aug 21 about Aug 4. Reviews treat this as memory,
    not as what you thought at the time."
  - The body.
  - "Later notes", each dated ("Later note · Sep 30, 6:40 PM"), and an outlined "Add a later note"
    that opens an inline editor. A later note can be marked "Context for the AI".
- **Right panels.**
  - **Snapshot.**
    - Figures in Mono with Stored here; computed lines tagged Computed; a positions table.
    - "Correct a figure" opens an inline form: field, corrected value, reason. Saving adds a
      correction and keeps the original. On the sample's recalled Aug 4 snapshot: "Margin loan
      $11,890 → corrected to $11,980 on Aug 22: “the statement says 11,980”". The corrected figure
      is the one that makes positions × marks − loan equal the typed account value. "As of" is
      correctable the same way; no other correction moves it.
  - **Details found** (slice 3).
    - Each detail highlights its source span in the body on hover or focus, e.g. "Added · TSLA
      Dec 18 ’26 440 P · 3 at $19.80", from “added 3 more TSLA 440 puts at 19.80”.
    - Origin: "found by the parser" or "found by the AI".
    - Controls per row: "Keep" / "Fix" / "Not right", and "Keep all".
  - **AI read** (slice 4). Rule 16's states, with no verdict, so no amber text.
    - Head: "AI · read Oct 7, 6:58 AM · Sonnet 5.5 on your key".
    - "How the AI summarised this entry (used in reviews)": the 60-word digest, with "That’s not
      right".
    - "Cited in": links to findings that cite this entry.
    - "What was sent" opens the drawer.
    - Above every control in this panel that sends a request ("Read it now", "Run again", "Retry"),
      in full and never in a tooltip: "Reading sends this entry’s text, its numbers, the summaries of
      your 5 previous entries and your active rules to Anthropic (Sonnet 5.5) on your key."
  - **Rules** (slice 2). His plan answers, plus proposed touches: "R2 may apply: “added 3 more TSLA
    440 puts at 19.80”; the TSLA puts were 28.3% below your average cost." with "That’s right" /
    "Not right". Only kept touches count.
- **Foot.**
  - Toggle "Keep this entry out of AI reads".
  - Burnt-orange "Delete entry…" with an inline confirm: "Delete this entry’s words and numbers? The
    timeline keeps a line saying an entry was deleted on Oct 27. What was already sent to your AI
    provider is under its terms." Buttons: "Delete entry" / "Keep it".

**Phone (390).** One column (meta, body, later notes), then accordions: "Numbers", "Details found
(5)", "AI read", "Rules (2)". Drawers become bottom sheets with a peek row.

**AI read states** (rule 16, `DESIGN_SYSTEM.md:171`; words in Copy):

| State | Tag | Words |
|---|---|---|
| Off | Off | "AI reads are off. Turn them on in Settings › Journal." |
| No key | Not set up | "Add an Anthropic key in Settings to turn on AI reads. Writing, numbers and the rulebook work without one." |
| Model unset | Not set up | "Choose a model for journal reads in Settings › Journal." It links to the "Models for journal reads" control (Screen 13, slice 4). |
| Not read yet | — | "Not read yet. It’s read with the next review." |
| Reading | — | Named steps: "Reading this entry · Finding details · Writing the summary". |
| Read | — | As above. |
| Held | — | Margin-call entries with reads on every save (slice 5): "No read on the day of a margin call. It’s read with the next review." + the per-entry egress line + "Read it now". |
| Didn’t pass the check | — | "This read didn’t pass the number check, so it isn’t shown." + "Run again". |
| Request failure | — | "AI unavailable · Anthropic returned an error. Nothing was lost." + "Retry". Its own line, never shown as idle. |
| Refused | — | "Anthropic declined this read. Nothing from it is shown." |
| Cap reached | — | "This month’s journal AI cap of $5.00 is reached. Change it in Settings." |
| Kept out | — | "Kept out of AI reads since Oct 26." |
| Staging | Sample | "Sample read · No model was called". |

**Page states:**

| State | Words |
|---|---|
| Deleted | A tombstone line only: "An entry written Sep 29 was deleted on Oct 27." |
| Loading | — |
| Couldn’t load | As on the timeline. |
| Staging | Sample. |

### 6. Tidy up · `/positions/journal/tidy` (slice 3)

**Purpose.** Turn prose into structure afterwards, at his pace. Only kept details count.

**1440.** One column, 880.
- h1 "Tidy up".
- Sub: "Details found in your entries. Only the details you keep count in reviews and rule checks."
- Count: "14 details in 6 entries".
- One panel per entry:
  - the date and kind;
  - an excerpt with the source span highlighted;
  - rows of field · value · origin, each with "Keep" / "Fix" / "Not right";
  - "Keep all in this entry".
- Fix uses the same unit-bearing inputs. Each decision is an append-only row.
- A position found in prose can be kept as a detail: "Count “160 NVDA at $214.00” as a position in
  this entry?" The sealed snapshot is never changed.
- **The recalled-wording flag.** When an entry about today contains wording such as "fast forward",
  "looking back", "back then" or "in hindsight", the panel highlights the span and offers: "Part of
  this reads like it’s written from memory." Entries like his own example mix memory with today's
  numbers, so the offer never re-dates those numbers:
  - **"Split the remembered part into an entry about an earlier day"** (the default) + a date
    picker. It creates a new entry, written now and about the chosen day, whose body quotes the
    span with a link back ("Split from your Sep 29 entry"), source `split`, so it is recalled by
    construction. The original gains a `recalled_span` correction over that span, so the span is
    never quoted as what he thought at the time. The original's About date and its snapshot don't
    move.
  - **"Mark the whole entry as from memory"** + a date picker. It adds an About-date correction, so
    the text counts as recalled. The attached snapshot keeps its `as_of`: a figure typed as current
    stays current.
  - Either way, the original stays visible and sealed.

**Phone (390).** One card per entry, with 44px buttons.

**States:**

| State | Words |
|---|---|
| Empty | "Nothing to tidy." |
| Loading | — |
| Parser only (AI reads off) | Rows say "found by the parser". |
| Couldn’t load | As on the timeline. |
| Staging | Sample. |

### 7. Weekly review · `/positions/review`

**Purpose.** Once a week: what the entries show, counted and cited, and where rules might come from.
The computed parts (slice 3) need no model.

**1440.**
- h1 "Weekly review".
- **The egress sentence** (slice 4), above the action and never in a tooltip: "Running a review
  sends the text of entries written since the last review, short summaries of older ones, your
  snapshots, computed figures, rules and corrections to Anthropic (Sonnet 5.5 and Opus 5.5) on your
  key. Drafts and entries you kept out are never sent. View what’s sent"
- The amber primary "Run this week’s review", with "≈ $0.31 · estimate · up to $0.75" beside it.
  In slice 3 there is no Run: the page shows the computed sections, and a review row is stored when
  he taps "Save this week’s numbers" (`POST /api/journal/reviews`).
- **Main** `minmax(0, 1fr)` and **rail** 320.
- **Head:** "Review of Sep 28 – Oct 6 · as of Oct 7, 7:02 AM · 8 new entries (34 in all)". When the
  AI ran: "AI · Opus 5.5 on your key".
- **Main sections, in order:**
  1. **This week in numbers** (Computed strip, Mono):
     - Account value $36,146 (Sep 25) → $31,609 (Oct 6);
     - −$7,037 net of the $2,500 in;
     - −18.6% with money in and out taken out;
     - 8 entries · 2 plans · 1 rule answered No.
  2. **The account path** (`ChartFrame`, Design → Charts).
     - Title: "Account value fell 42.6% from its Aug 21 high, with money in and out taken out".
     - Three small multiples and the event rail. "Show the numbers" opens the twin.
  3. **One event, not a pattern** (Computed; the AI may phrase it): "The Sep 29 margin call. From
     Sep 25 to Sep 30, account value went from $36,146 to $36,021, with $2,500 put in on Sep 30:
     −$2,625, 11.9% of the $22,142 lost since the Aug 21 high. It’s one event, so it isn’t
     counted as a pattern."
  4. **Where the money went since the high** (`ChartFrame`, a neutral bar list with signed text):
     - TSLA puts −$19,980 · QQQ puts −$2,800 · NVDA +$867 · MSFT +$195;
     - "Not explained by your typed marks: −$424 (interest, fees or trades you didn’t type)";
     - caption: "The TSLA puts are 90.2% of the fall. That’s one position, not a pattern."
  5. **Patterns checked every review** (the fixed detector table, below):
     - his suspicions first, marked "You named this";
     - each row shows its count with dots, or its rate and interval at n ≥ 20;
     - caption: "10 patterns are checked every review. With this many, one can look notable by
       chance."
  6. **Findings** (AI, 5 at most). Each card has:
     - a label, "About what you decided" or "About what happened";
     - the claim, Sans 17;
     - the evidence line, e.g. "In 3 of 4 “Added” entries · cites 4";
     - either "4 counted; rates start at 20." or a rate such as "63% (Wilson 95%: 43–79%, n =
       24)";
     - "Cut the other way: 1 (NVDA, Aug 28)";
     - every stated figure with the check glyph, in Mono, linked to its fact;
     - actions: "Show entries" · outlined "Draft a rule from this" · text "That’s not right".
  7. **Questions your entries raise** (AI, 3 at most). Each has "Answer in a new entry", which opens
     the composer with the question quoted.
  8. **Rules this review**: per rule, "asked 2 · Yes 0 · No 1 · Doesn’t apply 1 · Not answered 0".
- **Rail.**
  - **How this ran:**
    - "Read 8 entries · Sonnet 5.5 · $0.09";
    - "Findings · Opus 5.5 · 17,400 in · 6,900 out · $0.21";
    - "Number check passed · 31 figures";
    - package "sha256:9f3c…" with Copy.
  - **Your suspicions**, each with its row ("I add to losers · row 1 · 3 of 4"), and "Edit", which
    opens them in Settings › Journal.
  - **Past reviews**, by date.
  - "Tidy up · 14 details waiting".

**Phone (390).**
- One column: the egress sentence and Run first, then the strip as a 2-column grid.
- The Path behind a peek row.
- Findings full width. The detector table becomes cards, and its twin stays.
- "How this ran" is collapsed. The finding drawer is a bottom sheet with a peek row.

**The fixed detector table** (computed by code from kept details and snapshots; the model never
counts):

| # | Pattern | Counts over (n) | Counted (k) | About | Sample, Oct 7 |
|---|---|---|---|---|---|
| 1 | Added 15% or more below your average cost | "Added" entries written at the time, with a kept price and a cost basis | the add's price is 15% or more below the position's average cost just before it | decided | 3 of 4 |
| 2 | Entered or added with no exit named | "Entered" and "Added" entries written at the time | no kept exit price and "No exit set" not ticked either | decided | 4 of 5 |
| 3 | Exit named, then passed while still held | positions with a kept exit price | a later snapshot, with the position still held, shows a mark at or below that exit | decided | 1 of 1 |
| 4 | Plan answered No on a rule, then carried out | plans with a No answer | a kept link from a later Entered, Added, Trimmed or Closed entry to that plan | decided | 0 of 1 |
| 5 | New position the same day as a losing close | losing closes | an Entered entry written the same ET day | decided | 0 of 2 |
| 6 | Larger than your usual entry within 5 weekdays of a winning close | winning closes | an Entered or Added entry within 5 weekdays after it, larger than usual (below) | decided | no winning closes yet |
| 7 | Margin used at a new high | steps between snapshots that both have margin used | the later snapshot's margin used is above every earlier one | happened | 7 of 11 |
| 8 | One position over 40% of position value | snapshots with every position marked | one position's share is above 40% | happened | 12 of 12 |
| 9 | A figure in your words differs from the computed one by more than 1 point | figures you wrote that match a computed fact by name | the difference is more than 1 point | decided | 1 of 3 |
| 10 | Your stated confidence against what happened (Brier score) | stated confidences that have resolved (below) | — (a score, from 20 resolved) | decided | 1 resolved |
| — | Written from memory (not a pattern) | all entries | recalled | — | 8 of 34 |

Below 20, a row reads "{k} of {n}", and the line under it reads "{n} counted; rates start at 20". The
two numbers are never written the same way: "3 of 4" is what was found, "4 counted" is how far the
row is from a rate.

**What each column means:**
- "Decided" rows count only entries written at the time, never recalled or imported ones, nor a
  `recalled_span`. They use only facts dated on or before the moment each case describes: the entry's
  `written_at`, or for row 3 the snapshot where the pass was seen.
- **Row 3, exactly.** The exit is the "I’m wrong if…" price, in the instrument's own price (a put's
  premium, a share's price). A pass is seen only at his snapshots: a position that crossed its exit
  and came back between two snapshots isn't counted, and the drawer says so ("Seen at your snapshots
  only"). In the sample, the QQQ puts' $8.00 exit is passed at the Sep 29 snapshot ($7.90), while
  still held.
- **Row 6, exactly.** A winning close is a Trimmed or Closed entry whose kept P/L against average cost
  is above $0. "Usual" is the median dollar size (quantity × price × multiplier) of his Entered and
  Added entries written at the time in the 90 days before the later entry, and needs at least 3 of
  them; "larger" is more than 1.5 times that median. A case with fewer than 3 earlier entries isn't
  counted and is listed as "no usual size yet". Weekdays are ET weekdays.
- **Row 10, exactly.** "How sure are you this works out?" (0–100) is asked on Entered and Added
  entries and names that position. It resolves **1** when the position is closed in full at a gain
  against its average cost, and **0** when it is closed in full at a loss or row 3's pass is seen.
  Until then it is open. The resolution date is that close's `written_at` or that snapshot's
  `as_of`. The score is the mean of (p ÷ 100 − outcome)², shown from 20 resolved. In the sample, the
  QQQ puts' 70 resolved 0 on Sep 29; the other three stated confidences are open, because a trim isn't
  a close in full. The rule is ported from `tools/research-notes/scoring.mjs` (Data and privacy →
  Statistics).
- Row 9's stated figures are found by the parser or by J1 and compared by code.
- **Suspicions** map to rows. His sample suspicions are "I add to losers" (row 1), "Too much
  margin" (row 7) and "I don’t sell when I said I would" (row 3). A suspicion no row can measure
  is listed as "Not measurable from your entries; asked in reviews".

**States** (rule 16 states, no verdict):

| State | Tag | Words |
|---|---|---|
| Too little written | — | "Reviews start once there are 3 saved entries. You have 2." |
| Mostly from memory | — | What he will actually see first: most of his early entries are recalled or imported, so the decided rows have little or nothing to count. A quiet strip leads the page: "Most of your entries so far are written from memory (9 of 11). Patterns about what you decided use only entries written at the time, so they start as you write them. What happened is below." Sections 1–4 render in full (the week in numbers, the Path, events, where the money went). Decided rows show their honest counts ("0 of 0 · counts start with entries written at the time"); happened rows count as usual. With AI reads on, findings are "About what happened" only, plus his words against his numbers and questions back; no "About what you decided" card is drawn. |
| Computed only, slice 3 | — | Sections 1–5 render, with "Save this week’s review" (stores the computed parts). No AI section, no Run, and no link to a setting that doesn't exist yet. |
| Computed only (AI off), from slice 4 | Off on the AI parts | Sections 1–5 render. Findings, questions and drafts are replaced by "AI reads are off. The counts above need no AI. Turn reads on in Settings › Journal." |
| No key or model unset | Not set up | Rule 16's copy; Run is replaced by "Set up in Settings". |
| Ready | — | "8 new entries since Sep 28 · ≈ $0.31". |
| Running | — | Named steps with result-shaped skeletons and the in-flight indicator: "Reading 8 new entries · Counting 10 patterns · Checking 31 figures against your snapshots · Writing findings". |
| Produced | — | As above. |
| Stale | — | A burnt-orange strip with its icon: "3 entries since this review. Its findings don’t include them. · Run again". The pinned review stays. |
| Didn’t pass the check | — | "This review didn’t pass the number check: 2 figures didn’t match your snapshots. It isn’t shown as findings." + a collapsed "See the failed draft", labelled "Failed draft · not findings". The computed sections still show. |
| Request failure | — | "AI unavailable · Anthropic returned an error. Your entries are unchanged." + "Retry". The previous review is never evicted. |
| Refused | — | "Anthropic declined this review. Nothing from it is shown; the counts above still stand." |
| Already running | — | "A review is already running." |
| Daily limit | — | "3 reviews today is the limit. The next can run tomorrow." |
| Monthly cap | — | "This month’s journal AI cap of $5.00 is reached. Change it in Settings." |
| Over the per-run limit | — | "This review could cost up to $1.12, over the $1.00 limit per run. Keep some entries out, or raise the limit in Settings." The check uses the worst case (Models, cost and caching → Caps). |
| Staging | Sample | The authored Oct 7 review. Run plays the steps and returns it: "Sample review · No model was called. Entries you write here aren’t read." |

### 8. Finding drawer · `/positions/review/:reviewId?finding=:id`

**Purpose.** Show exactly which entries and numbers a claim rests on, and let him correct it.

**1440.**
- A 560 drawer from the right. Top: the claim and its label.
- **Evidence:** one row per cited entry, with:
  - its date and kind;
  - the quoted span highlighted (entry id and character offsets);
  - any cited figure with the check glyph, in Mono ("Margin used 115% · Sep 18 snapshot").
- **How it was counted:**
  - k, n and the selection rule in plain words ("counted: “Added” entries written at the time, with
    a kept price and a cost basis");
  - the interval, or the building line.
- **Cut the other way:** a table of the counter-cases.
- **What it doesn’t use:** "Entries written from memory or imported aren’t used for what you
  decided." For row 3: "Seen at your snapshots only."
- **"That’s not right"** offers three choices:
  1. "It misread what I wrote": he picks the quote. A correction row supersedes the detail.
  2. "It’s missing context": opens a later note on the cited entry, marked "Context for the AI".
  3. "Not a pattern to me", with an optional reason. It isn't raised again until 5 more entries
     change the count.
- Past corrections are listed: "You marked this “missing context” on Oct 6."
- Escape closes the drawer and returns focus to the card.

**Phone (390).** A bottom sheet with a grab handle and a peek row showing the claim.

**States:**

| State | Words |
|---|---|
| Loading | — |
| Produced | As above. |
| A cited entry was deleted | "1 cited entry was deleted; this finding is out of date." |
| Staging | Sample. |

### 9. Rulebook · `/positions/rulebook`

**Purpose.** His rules, in his words, each tied to the entries it came from, with how often he
answered when asked.

**1440.**
- h1 "Rulebook". Sub: "Your rules, in your words. Each one cites the entries it came from. Convexa
  never enforces them."
- The amber "Write a rule"; outlined "Copy as text" and "Print".
- **Main 840, rail 320.**
- **"Drafted from your journal (2)"** (drafts arrive with slice 4): draft cards, unnumbered until
  adopted, with:
  - the intro "A draft from your entries. Reword it until it’s yours, or set it aside.";
  - editable wording (Sans 17);
  - "Because": the finding, "cites 4 entries", and its sample state ("3 of 4 · 4 counted; rates
    start at 20"), shown on the card so a rule drawn from building evidence says so;
  - a "Check by asking" field;
  - an optional limit (metric · comparison · value) from a closed metric list: margin used % of
    account value, excess liquidity $, position % below average cost, open positions, entries the
    same day as a losing close, weekdays to an earnings date he typed. An AI draft's value is either
    a figure he wrote, quoted and cited, or a pattern's threshold, labelled "Convexa’s pattern
    threshold, not from your entries"; otherwise it is `not set` for him to fill (The AI
    interaction → the check);
  - "Why this rule, in your words" (required to adopt);
  - outlined "Adopt" and text "Not for me".
- **"Active (2)":** one row per rule:
  - "R3" (Mono 13) and its wording;
  - "v1 · since Sep 30";
  - "Asked in 2 plans · Yes 0 · No 1 · Doesn’t apply 1 · Not answered 0";
  - "Account change after Yes vs after No: too few to judge (0 and 1 counted; rates start at 20)";
  - "Margin used now 92% · limit 50% · above" with the warning glyph, as neutral text;
  - a row menu: Edit (makes a new version) · Pause · Retire.
- **"Paused"** and **"Retired (1)"** are collapsed, each with its reason and dates: "R1 retired Sep
  24: “I add from my phone and can’t always write first.”"
- **Rail:** "Before you trade": an outlined "Plan a trade". A rule goes nowhere else: no Settings or
  persona hand-off in this spec.
- Counts are neutral steel dots: no green or red, no streaks, no score.
- **Numbering.** A rule gets the next number when it becomes active, written by him or adopted from a
  draft, and keeps it through versions, pauses and retirement. Drafts and declined drafts have no
  number.

**Print** (`/positions/rulebook/print`): one page in clean type with the active rules' numbers,
wordings and check questions, "Adopted {date} · v{n}", and the foot "Your rules, in your words.
Printed Oct 7, 2026." It holds no figures, so it can sit by the screen.

**Phone (390).** Accordion sections and one card per rule. The row menu is a bottom sheet.

**States:**

| State | Words |
|---|---|
| Empty | "No rules yet. Write one, or let the weekly review draft some from your entries." |
| Drafts only | — |
| Stale draft | "Evidence changed since this was drafted: 3 new entries." |
| Loading | — |
| Couldn’t load | As on the timeline. |
| Staging | Sample. |

### 10. Rule · `/positions/rulebook/:ruleId`

**1440.** One column, 880.
- The wording, then a version timeline (time column and event):
  - "v1 adopted Sep 30: drafted by the Sep 28 review from the finding “Added 15% or more below
    your average cost”; the draft read “…I don’t add to it.”"
  - "v2 Oct 3: you added “the same day”."
- His why, in a quiet quote.
- The origin finding and its cited entries.
- A check table: date · entry link · his answer · the reading at the time · his "why go ahead"
  if any · the account change to the next snapshot, signed with ▼/▲ and text.
- A counts block that follows the floor of 20.
- Actions: Edit, Pause, Retire (with a reason).

**Phone (390).** Stacked. The table becomes cards, and the table twin stays the accessible path.

**States:** Active · Paused · Retired · Declined draft (read-only, with his reason) · Building
counts · Staging.

### 11. Import history · `/positions/journal/import` (slice 5; "Write about an earlier day" ships in 1a)

**1440.** A three-step page, 880 wide.
1. **Choose:**
   - "Write about an earlier day" opens the composer with About set (slice 1a).
   - "Paste positions from your broker": a textarea.
   - "Read a trades CSV": `input type="file"`, read in the browser with FileReader. The sentence
     "The file is read in this browser. Only the rows you import are sent to your account."
2. **Preview:** parsed rows in a table. A line that can't be read shows `unrecognized` beside the raw
   line. CSV columns get a mapping control; no broker format is assumed.
3. **File them:** "One entry per day" or "One entry per trade". Each becomes kind Imported, written
   now, about the trade date: "Imported Oct 26 · about Aug 14".

A `convexa-journal-v1` export is restored from Settings › Journal (slice 1b), not from this page
(Data and privacy → Export and delete).

Then: "Want to add what you remember thinking? It’ll be marked as written from memory." Import is
merge-only: rows already imported are matched by hash and skipped.

**Phone (390).** The same steps stacked. A CSV can be picked from Files.

**States:**

| State | Words |
|---|---|
| Empty | — |
| Parsing | — |
| Parsed with unrecognized lines | Those lines show `unrecognized` beside the raw text. |
| Duplicates skipped | "12 rows were already in your journal." |
| Saved | — |
| Parse failed | "This file couldn’t be read as a table. Nothing was imported." |
| Staging | A sample paste, prefilled. |

### 12. What's sent drawer (on Review, Entry and Settings)

**1440.**
- A 520 drawer. Header: "What’s sent to Anthropic · Sonnet 5.5 and Opus 5.5 on your key".
- The categories come from one server table, the `build_export` pattern
  (`services/recommendation.rs:413-477`):
  - "Text of entries written since the last review: 8 entries, 2,090 words"
  - "Short summaries of older entries: 26"
  - "Later notes marked as context: 1"
  - "Snapshots: 12 (account value, cash, margin loan, maintenance requirement, margin call and due
    date, money in or out, positions and marks)"
  - "Computed figures: 31"
  - "The 10-pattern table and your suspicions"
  - "Active rules: 2, with your plan answers"
  - "Your corrections: 1"
- "Convexa never adds your email, name, broker credentials or AI key to what’s sent. Text you write
  is sent as written."
- "Never sent: the simulated book, drafts, deleted entries, and the 2 entries you kept out, with
  their numbers, money in or out, details and notes. Computed figures sent to the AI leave those 2
  entries out, so they can differ from the ones on your pages."
- Then:
  - the token and cost estimate, and the worst case;
  - the package id with Copy;
  - "Copy all" (the canonical JSON), with its "Copied" state.
- After a run, the drawer shows the package that was actually sent, with its stored usage.

**Phone (390).** A bottom sheet with a grab handle and a peek row.

**States:**

| State | Words |
|---|---|
| Loading | — |
| Ready | As above. |
| AI off | What would be sent, headed "Nothing is sent while AI reads are off". |
| Staging | A sample package: "No model is called on the demo". |

### 13. Settings › Journal · `/settings#journal`

A Settings panel beside the AI providers panel (`features/auth/SettingsPage.tsx:644`). Each part
lands with its slice, and a part whose slice hasn't shipped isn't drawn:

- **Slice 1b: "Export journal (JSON)"**: a download. "This file isn’t encrypted. Keep it somewhere
  private." Beside it, **"Restore from an export"**: pick a `convexa-journal-v1` file; it is
  merge-only, and entries whose seal doesn't verify come back as Imported (Data and privacy → Export
  and delete).
- **Slice 1b: burnt-orange "Delete journal…"**: an inline confirm that requires typing "delete
  journal". It offers "Export first", and says what deletion reaches (Data and privacy → Delete).
- **Slice 3: "Downfalls you suspect"** (up to 5 lines in his words): "Reviews test these first." The
  first run's "Name what you think goes wrong" and the Review rail's "Edit" open this.
- **Slice 4: toggle "AI reads of my journal"**, Off by default. Above it, not in a tooltip:
  "Turning this on lets Convexa send your journal text, numbers and rules to Anthropic on your key
  when you run a review, tap Read on an entry or accept a bulk read of older entries, and, if you
  turn them on below, on each save and each Monday. Nothing is sent until one of those happens."
  - With no Anthropic key, the toggle is replaced by "Add an Anthropic key in Settings › AI first".
- **Slice 4: "Models for journal reads"**: "Entry reads" (Sonnet 5.5 · Opus 5.5) and "Reviews"
  (Opus 5.5 · Sonnet 5.5), defaulting to open question 6's answer. The AI read's "Model unset" state
  links here.
- **Slice 4: "Offer the weekly review each Monday"** (on).
- **Slice 4: "Monthly cost cap for the journal":** $5.00 by default. "Limit per run": $1.00. Below
  them: "This month: $0.31 of $5.00 · 1 review · 8 entry reads".
- **Slice 5: "Read each entry right after I save it"** (off; margin-call entries are never read on
  save). Its own egress line sits under it, in full: "With this on, each save sends that entry’s
  text, its numbers, the summaries of your 5 previous entries and your active rules to Anthropic
  (Sonnet 5.5) on your key. Margin-call entries are never sent on save."
- **Slice 5: "Run it automatically Mondays at 7:00 AM ET"** (off; open question 16 recommends
  deferring it). Its egress line: "Each Monday at 7:00 AM ET this sends what a review sends, without
  you tapping Run." After an automatic run, the Review page leads with "Ran automatically Mon {Oct
  5}, 7:00 AM · sent {8} entries’ text and {26} summaries · What was sent".

**States:**

| State | Tag |
|---|---|
| Off | Off |
| On | — |
| No key | Not set up |
| Cap reached | — |
| Exporting | — |
| Restoring | — |
| Delete confirm | — |
| Signed out | Sign in |
| Staging | Sample. Writes refused with the demo's existing copy, as for AI keys (`libs/api/src/lib/demo/transport.ts:1319-1330`). |

## User flows

### First entry (starting after a bad stretch, as his example does)

1. Signed in on production, he opens Positions › Journal. `GET /api/journal/entries` passes
   `OwnerUser` and returns nothing. The timeline shows "Start with today."
2. He taps "Write the first entry". The composer says "No numbers yet." He taps "Update numbers" and
   types today's account value, cash, margin loan and maintenance requirement, with source Broker
   screen.
3. He writes what he holds and how he feels, in a few sentences. Nothing interrupts the save. From
   slice 3, the parser sees wording like "fast forward to today" and Tidy offers to split the
   remembered part into an entry about an earlier day; today's numbers stay on today's entry.
4. He saves (⌘↵). The server stamps `written_at`, seals the entry and encrypts the body and figures.
   The card appears, and the rail reads "Account value · one snapshot so far".
5. A line offers "How you got here: Write about an earlier day". He writes "About Aug 14" from
   memory, with what he bought and why, and that day's account value with source Statement if he has
   one, otherwise Memory. It saves as "Written Oct 26 · about Aug 14", drawn as a hollow point.
6. With a high now recorded (labelled "from a statement" or "from memory"), the rail computes "below
   the recorded high". If he put money in after August, he adds a "Money in or out" entry and the
   percent stops hiding it.
7. From slice 3, a last optional prompt: "Name what you think goes wrong" (up to 5 suspicions). AI
   reads stay off. From slice 4, each card says "Not read: AI reads are off".
8. His first reviews show the "Mostly from memory" state: events, where the money went, and his
   words against his numbers, with the decided rows waiting for entries written at the time.

### A normal day

1. He opens Journal, or ⌘K "Write a journal entry" from any page.
2. In the quick-capture box: "Sold 5 of the TSLA puts at 13.10. Felt relief more than conviction."
   He picks Trimmed.
3. The numbers line reads "carried from Sep 30 (2 days)". He taps Update, changes Account value and
   Margin loan, and the other fields carry over with their dates.
4. ⌘↵ saves it, in about 30 seconds.
5. With slice 3, the parser proposes "Trimmed · TSLA Dec 18 ’26 440 P · 5 at $13.10" and links it to
   the Oct 1 plan that named $13.10. He keeps both in Tidy later in the week, in one pass.

### The margin-call day

1. The broker's notice arrives on his phone. He opens Positions › Journal and taps "Margin call" in
   the bottom bar.
2. Three fields: Call amount $2,750 · Due by Oct 1, 4:00 PM · Account value $34,047. Positions are
   one tap: "Unchanged since Sep 25".
3. He writes it as it is ("Broker raised the NVDA requirement before earnings. I don’t want to sell
   NVDA below what I paid.") and saves, in under a minute. Numbers alone would also save.
4. The cross-check reads "Your broker’s call: $2,750 · Your numbers compute excess liquidity of
   −$2,750. That matches the call." The confirmation reads "Saved · Tue Sep 29, 2:14 PM. It’s in the
   record as you wrote it." One offer follows: "Add a later note when it’s resolved".
5. No model runs. The timeline's quiet line says a review can look at the weeks before the call when
   he asks.
6. Next day he writes a Money in entry ($2,500, 10:05 AM) and a Trimmed entry ("Sold 60 NVDA at
   199.26 to meet the call", Closed by: Me), with updated numbers at 3:40 PM (account value $36,021,
   margin loan $35,612.90, maintenance $34,900, excess liquidity +$1,121). He adds a later note on
   the call: "Met on Sep 30: sold 60 NVDA, put in $2,500."
7. The next review names it under "One event, not a pattern" with its dollar size.

### The weekly review

1. On Monday the Review tab shows "Ready · 8 new entries since Sep 28 · ≈ $0.31". The computed
   sections are already on the page.
2. He reads the egress sentence, optionally opens "What’s sent", and taps "Run this week’s review".
3. Named steps stream past:
   - Sonnet 5.5 reads each new entry (details, a digest, flags);
   - code counts the 10 patterns;
   - Opus 5.5 writes findings from the counts, digests and quotes;
   - the server's check recomputes every number and every k and n, and verifies every quote byte
     for byte.
4. It passes, and the findings render. Had it failed, the page would say so and show no findings.
5. He opens a finding, reads the quoted spans and the counter-case, and marks one "missing
   context", which opens a later note on the cited entry.
6. He answers one of the "Questions your entries raise" in a new Just thinking entry.
7. He opens "Draft a rule from this" on a finding (the next flow), then clears 14 details in Tidy.

### An insight becomes a rule

1. The Sep 28 review's finding reads: "In 3 of the 4 adds you wrote at the time, the price was 15%
   or more below your average cost: the TSLA puts on Sep 4 (17.4%), Sep 11 (21.6%) and Sep 18
   (28.3%)." It also reads "4 counted; rates start at 20" and "Cut the other way: 1 (NVDA, Aug 28,
   8.6% below your average cost)".
2. "Draft a rule from this" shows that review's draft for the finding (at most 3 per review): "When
   a position is 15% or more below my average cost, I don’t add to it." Check by asking: "Is this
   position less than 15% below my average cost?" Limit: position % below average cost · at or
   above · 15, labelled "15% is Convexa’s pattern threshold, not from your entries".
3. It appears on the Rulebook under "Drafted from your journal", with no number yet. "Because" links
   the finding and its 4 entries and shows "3 of 4 · 4 counted; rates start at 20".
4. On Sep 30 he writes his why ("Three TSLA put adds, each lower.") and taps Adopt. It becomes R2
   (R1 was his own rule, written Aug 21 and retired Sep 24), v1, with `adopted_at`, its origin, and
   the AI's wording kept in its history. That evening he writes R3 himself, after the call.
5. On Oct 3 he edits R2 to "…I don’t add to it the same day.", which is v2. v1 stays listed with its
   dates.
6. Had he chosen "Not for me", his reason would be stored. The draft would stay read-only, with no
   number, and wouldn't be drafted again until 5 more entries change the count.
7. The AI never adopts a rule, and nothing is ever deleted.

### A rule check before a trade

1. Before buying SPY puts at his broker, he opens ⌘K "Write a journal entry" and picks Plan a trade,
   or Rulebook › "Plan a trade". On a phone, the bottom bar's "Write entry" then the Plan chip.
2. "Your rules" lists R2 and R3. R3 shows "Margin used 84% of account value (Oct 2 snapshot, 3 days
   old) · R3 limit 50% · above", with the warning glyph, and "If the $1,280 is borrowed: margin used
   84% → 88%".
3. He answers R3 No and R2 Doesn't apply. Under the No, the optional "Why go ahead anyway?" gets
   "It’s a hedge; it should lower the risk."
4. He writes "Buying 2 SPY Dec 18 ’26 640 P at 6.40 as a hedge. I’m wrong if SPY closes above 705."
   and saves the plan.
5. It is recorded with his answers and readings: "Plan saved · asked 2 rules · 1 answered No".
   Nothing is blocked, and no order exists.
6. If he later writes the Entered entry, the parser or J1 proposes "This carries out the Oct 5
   plan", and he keeps the link. Detector 4 then counts it.

### History import (his own example's shape)

1. His example is an entry about positions entered weeks earlier, written after the outcome is
   known.
2. "Write about an earlier day" with About set to the day. He writes what he bought and why, as he
   remembers it, and types that day's numbers with source Memory or Statement. It saves as "Written
   Oct 26 · about Aug 14".
3. Alternatively (slice 5), "Paste positions from your broker" fills positions through the parser,
   or "Read a trades CSV" files one Imported entry per trade day. Both are read in the browser and
   kept only after he confirms.
4. The timeline in About order reads Aug 14 → Oct 26 as events. In Written order, all of them were
   written today, which is the honest order.
5. The Path draws recalled snapshots hollow and at-the-time ones filled, and its legend says so in
   words.
6. Reviews use recalled and imported entries for what happened (figures, dates, outcomes), never
   as evidence of what he thought at the time.

### Other flows

- **Correcting a figure.** On the entry, "Correct a figure" → field, value, reason → a correction
  row. Computed facts use the corrected value, and the snapshot shows both with dates. Findings that
  cited the old figure go stale.
- **Correcting the AI.** "It misread what I wrote" (a detail or digest), "It’s missing context" (a
  later note marked as context) or "Not a pattern to me" (suppressed until n grows by 5). Each is an
  append-only feedback row, sent as an `owner_feedback` fact in the next package. Code recomputes
  counts after a corrected detail. The model's counts are never trusted.
- **Turning on AI reads.** Settings › Journal: the egress sentence, then the toggle and the cap.
  Existing entries aren't read in bulk without asking (slice 5). The offer carries its own egress
  line above its button: "Sends the full text of 34 entries, once each, with their numbers and your
  active rules, to Anthropic (Sonnet 5.5, batch price) on your key. Entries you kept out are left
  out." Then "Read them now · ≈ $0.18". It takes an explicit tap.
- **Withdrawing an entry.** "Delete entry…" → the inline confirm → the words, numbers, details and
  AI outputs for that entry are purged. A dated tombstone line stays, and reviews that read it keep
  their counts but no longer hold its text.
- **A staging visitor.** The Sample journal under the demo bar. They read it, run the review (it
  replays the authored one), write an entry (kept in this browser under demo keys; its account
  facts come from the shared facts module, its leg facts read `—`), and adopt or retire a rule.
  "Reset demo data" restores the seed (`libs/api/src/lib/demo/workspace.ts:576`).

## The AI interaction

### Where it sits

This is a new question family in the analyst architecture, added by a DESIGN amendment (open
question 4):

- **J1** "What does this entry say?": details and a digest. No observations.
- **J2** "What do my entries show?": findings, the event phrasing, and questions back.
- **J3** "Draft rules from that evidence": part of J2's output, at most 3.
- **J4** "Did I follow my rules?": counted by code, never by a model.

The amendment also does three things:

1. It scopes "Simulated only" (`DESIGN.md:425`) to the analyst's market questions.
2. It records his decision to send real positions, balances and margin to his own provider.
3. It adds a licence value `owner_personal` for owner-typed data, which never leaves the owner's
   account and is never shown publicly.

The journal doesn't wait for analyst Phase 0's tables or per-user cap. Its runs live in
`journal_ai_runs`, and its caps are read from that table, so they are durable and per account by
construction. It reuses `services/analyst/canonical.rs` as it is: the key sort, the number rule,
and `package_id` = sha256 of the canonical JSON (`canonical.rs:153`).

### Off by default, on his key

Nothing is sent until he turns AI reads on. Runs use his own Anthropic key, encrypted and
write-only. There is no server key.

The journal has **its own resolver**, `services/journal/ai.rs::resolve_journal_key`. It reads
`auth.inspect_ai_slot(user, "anthropic")` (`services/auth/service.rs:684`) directly and takes the
models from `journal_settings.model_entry` and `model_review`. It does **not** go through
`resolve_llm_key_for` (`services/recommendation.rs:118-215`), which returns the provider and model
he chose for ticker reads (OpenAI, xAI, Gemini or Grok included) and would send his journal to a
model the What's sent drawer didn't name. It is not gated by `AI_REC_IN_APP_ENABLED`
(`recommendation.rs:89-95`), so turning off ticker reads doesn't silently turn off the journal, and
the reverse. An empty Anthropic slot gives "Not set up" and no request. The other providers in
`llm_catalog.rs` show "Not set up · journal reads run on an Anthropic key for now" (open question
5).

### Packages

A deterministic, pure package builder in `apps/api/src/services/journal/package.rs`:

- **The fact catalog.** Every number the AI may state is a fact in the package, with an id. This is
  the whole list J1 and J2 may cite:

  | Family | Id | Holds |
  |---|---|---|
  | Entry text | `journal:entry:<uuid>:<written_at>` | the sealed text, quoted by character offsets |
  | Typed figure | `journal:snapshot.<field>:<snapshot>:<as_of>` | account value, cash, margin loan, maintenance requirement, buying power, call amount, due by |
  | Account fact | `journal:computed.<fact>:<snapshot>:<as_of>` | margin used, excess liquidity, leverage, loan to position value, change ($ and %), the index, below the high, account value alone, lost since the high |
  | Position fact | `journal:position.<position>.<fact>:<snapshot>` | value, share of position value, average cost, P/L |
  | Trade fact | `journal:trade.<detail>.<fact>` | price, quantity, average cost before, % below average cost, P/L against average cost |
  | Where the money went | `journal:money_went.<position or remainder>.<usd or share>:<review>` | each position since the high, and the remainder |
  | Event | `journal:event.<event>.<usd, pct or share>:<review>` | the event's dollars, chained percent and share of the fall |
  | Detector row | `journal:detector.<key>:<review>` | k, n and the list of cases |
  | Detector case | `journal:detector.<key>.case.<i>.<field>:<review>` | each counted case's own figures, e.g. each add's % below average cost |
  | Detector threshold | `journal:detector.<key>.threshold` | the pattern's constant: 15 for row 1, 40 for row 8, 1 point for row 9 |
  | Rule limit | `journal:rule.<number>.v<version>.limit` | a limit he set |

- **Cutoff:** J1's is the entry's `written_at`, so it never sees anything written later. J2's is the
  review's start, and it marks each fact as at the time, recalled or imported.
- **"The last review"** is the latest review whose AI run passed the check. Computed-only reviews,
  failed checks, refusals and request failures don't move it, so a failed run never drops entries
  from the next package. "Entries written since the last review" have a `written_at` after its
  cutoff.
- **Never added by Convexa:** his email, name, broker `account_ref` and credentials, the AI key, the
  simulated book, drafts and deleted entries. Text he writes goes as written; the composer's 9-digit
  warning is a writing aid, not a filter, so nothing promises that an account number he typed is
  removed.
- **Kept-out entries.** "Keep this entry out of AI reads" withholds the entry's text, its snapshot,
  its money in or out, its details and its later notes, "Context for the AI" notes included. Every
  computed fact in the package is recomputed without them; the chain bridges a withheld snapshot as
  it bridges a missing value. `omitted` lists each with the reason `owner_excluded` and the note
  "Computed figures exclude {2} entries". The review's AI sections say "AI figures leave out {2}
  entries you kept out"; the computed sections above them stay complete. Ticking the box on an
  entry that holds money in or out says what that costs: "The AI’s drawdown will count this money
  as a gain or a loss."
- **The J1 package:** the entry, its snapshot, its computed facts, the digests of the 5 previous
  entries not kept out, and the active rules.
- **The J2 package:**
  - the detector table, with its cases and thresholds;
  - the full text of entries written since the last review;
  - J1's digest and kept spans for every older entry (older text travels only as digests);
  - every snapshot and the computed series;
  - where the money went and the event facts;
  - rules with versions and plan answers;
  - suspicions;
  - previous findings and corrections.

### The completion path

A new `complete_journal()` in `services/llm.rs`, beside `complete_strategy`:

- streaming, with a 180 s budget in place of 60 s;
- structured output against a JSON schema (`output_config.format`);
- `max_tokens` 4,000 for J1 and 16,000 for J2;
- usage captured (input, output, cache write, cache read);
- `stop_reason: "refusal"` mapped to the Refused state;
- **one `info!` line per provider request**, `journal.provider_request`, with the run id, model,
  HTTP status and token counts and never any content, on success as well as failure. Today
  `llm.rs` logs only failures (`:301`, `:309`, `:318`), so an empty log proves nothing; with this
  line, and a per-process request counter that tests read, "0 requests" can be observed;
- **a base-URL override for tests.** The Anthropic URL is hard-coded today (`llm.rs:284`).
  `complete_journal` reads `JOURNAL_ANTHROPIC_BASE_URL` only when `APP_ENV` isn't `prod` (the check
  at `config.rs:477`), so a local run can point at a stub. Production ignores the variable.

**No server-side model fallback.** A fallback would send his data to a model the What's sent drawer
didn't name. Anthropic's Citations feature isn't used: it can't be combined with structured output,
and a valid pointer isn't a correct number. The check below is the guard.

### What the AI returns, and the check that gates it

| Pass | Returns |
|---|---|
| J1 | Details with character spans:<br>- action, symbol, quantity and price;<br>- the thesis sentence and the "wrong if" sentence;<br>- stated confidence (only a number he wrote);<br>- figures he stated, e.g. "margin around 55%";<br>- the recalled-wording flag;<br>- a proposed link to a plan, and proposed rule touches;<br>- a 60-word digest. |
| J2 | - At most 5 findings, each tied to one detector row or the event;<br>- the event phrasing;<br>- at most 3 questions back;<br>- at most 3 rule drafts, each tied to a finding, each limit cited to a figure he wrote or a detector threshold, or `not set`. |

**The check** is deterministic, on the server, after every run (DESIGN.md §5.2's rule):

1. Every quote cites an entry id and character offsets and equals the stored text byte for byte.
2. Every number in the AI's own words cites a fact from the catalog above and equals it after
   display rounding. **Number words are numbers:** one through twenty, a dozen, half, twice, double
   and triple are parsed and checked like digits, so "Three of the four adds" cites row 1's k and n
   exactly as "3 of 4" does.
3. Every k and n equals code's count for the cited detector. The model's own counts are never
   trusted.
4. A "decided" finding quotes only entries written at the time, never a `recalled_span`, and uses
   only facts dated on or before the moment each case describes (the entry's `written_at`, or for
   row 3 the snapshot where the pass was seen).
5. No rate appears below n = 20. Below it the payload has the journal's own `building` shape,
   `{ state: 'building', k, n, n_min }`, with no rate or interval field. This **deviates on purpose**
   from the outcomes Cohort's `building` (`features/trading/outcomes/types.ts:45-49`), which carries
   no k so that "a 3-for-3 cell" has nowhere to put 100%: a pattern row's k is the count itself, cited
   and drawn as dots, and no rate is derived from it.
6. The advice and tone scan (below) finds nothing in the AI's own words; quotes of his words are
   excluded.
7. **Counts and rates come only from code.** Words that state a count, a rate or a frequency without
   a cited fact fail in the AI's own words: most, mostly, usually, often, frequently, rarely,
   always, never, every time, each time, again and again, in a row, streak, consistently, tends to.
8. **A rule draft's numbers.** A limit, and any number in a draft's wording, is either a figure he
   wrote, quoted and cited by offsets, or a pattern's threshold cited as
   `journal:detector.<key>.threshold` and shown with "Convexa’s pattern threshold, not from your
   entries". Anything else fails. A draft with neither has its limit `not set`, for him to fill.

**The allowlist**, after DESIGN.md §5.2's: numbers that need no citation are dates that are a cited
fact's own metadata; rule and version numbers ("R2", "v2"); an option's strike and expiry inside a
cited position's name ("TSLA Dec 18 ’26 440 P"); and anything inside a quote of his words. Nothing
else: not the floor of 20 (the card states it, so the model never needs to), not a threshold outside
a cited threshold fact, not a round number.

One failure fails the whole read. A failed read is stored with status `failed_check` and shown as
failed, never as findings.

### What the AI may say

- What his entries say, quoted and cited.
- Counts, from the detector table only, with "Cut the other way".
- Changes in his own numbers, cited.
- The gap between a figure in his words and the computed one, as a question, not a verdict.
- That a single event moved a stated number of dollars, named as one event.
- "Linked to", never "caused".
- Questions back.
- First-person conditional rule drafts about his process. These are the "strategies" the journal
  offers: how he sizes, when he borrows, when he exits, how he plans, each drawn from his own cited
  evidence (open question 15).

### What the AI never says

- Buy, sell, hold, trim, add, roll, hedge or size anything, for any ticker.
- Any market forecast or view of a ticker, and any market strategy: what to trade, which setups,
  when to get in.
- Judgements of him: "reckless", "undisciplined", "gambling", "impulsive", "failed", "should have".
- Diagnoses ("revenge trading", "tilt", "FOMO") unless quoting his own words.
- "Should", "must" or "need to" addressed to him.
- Causal claims ("this caused your loss"), including counterfactuals ("lower margin would have
  avoided the call").
- The overclaiming words the ai-rec scan bans (`pages/ticker/widgets/ai-rec/bannedWords.scan.spec.ts:19-30`),
  except "suspect": J2 is fed his suspicions and is told to write "you named" instead.
- Praise or reassurance ("great job", "don’t worry", "everyone gets margin called").
- Streaks, scores, grades or percentages of discipline.
- Counts, rates or frequencies in words (check point 7).
- A rate below 20.
- Any use of a later outcome to judge an earlier decision.

**The scan is code**, and in production it is the only guard (the judge runs in the eval), so it is
built to over-fail: a false hit costs a re-run, a missed one costs advice. A hit fails the read. It
fails on:

- the word list: the ai-rec list minus "suspect", plus the judgement, diagnosis and praise words
  above;
- a sentence that **starts with a base-form verb** from a trading or risk list, whether or not it
  names a symbol: reduce, cut, lower, raise, increase, sell, buy, add, trim, close, exit, hedge,
  roll, deleverage, rebalance, avoid, consider, stop, start, try, keep, hold, size;
- an imperative trading verb within 5 words of a symbol, anywhere in a sentence;
- a modal aimed at "you": should, must, need to, ought to, have to;
- a **hedged suggestion**: consider, might want to, may want to, worth, would help, it may be wise,
  it would be better, would have avoided, would have prevented;
- a **leading question** that names an action on a symbol or position ("Would selling NVDA earlier
  have helped?");
- the count words of check point 7.

Rule drafts are first person and start with When, Before, After or Every, so the verb rule doesn't
catch them. Quotes of his words are excluded throughout. An eval judge scores tone as well.

### Tone guide, with the margin-call case

There is no persona: personas frame market reads, and this read is about him. Sentences start from
the evidence ("In 3 of the 4 adds…"), never "You always…". Every read says it is AI, with its model
and as-of. Every number in the "It says" column cites a fact in the catalog.

| Situation | It says | It never says |
|---|---|---|
| The day of the call | Nothing. The card: "No read on the day of a margin call. It’s read with the next review." | "Sorry to hear that." · "Here’s what went wrong." |
| The event, in the review | "The Sep 29 margin call. From Sep 25 to Sep 30, account value went from $36,146 to $36,021, with $2,500 put in on Sep 30: −$2,625, 11.9% of the $22,142 lost since the Aug 21 high. It’s one event, so it isn’t counted as a pattern." | "Margin calls keep happening to you." · "This shows you can’t handle leverage." |
| What drove the fall | "The TSLA puts are 90.2% of the fall since the Aug 21 high. That’s one position, not a pattern." | "TSLA ruined your account." |
| A decided finding | "In 3 of the 4 adds you wrote at the time, the price was 15% or more below your average cost: the TSLA puts on Sep 4 (17.4%), Sep 11 (21.6%) and Sep 18 (28.3%). The NVDA add on Aug 28 was 8.6% below." The card adds "4 counted; rates start at 20" and "Cut the other way: 1 (NVDA, Aug 28)". | "You keep averaging down on losers." · "Classic loss aversion." |
| A happened finding | "Margin used set a new high at 7 of the 11 steps between your snapshots, from 57% on Aug 28 to 147% on Sep 29. No rule about margin existed before R3 on Sep 30." | "You were reckless with margin." · "You should have cut leverage." · "Margin rose in a row for weeks." |
| His words against his numbers | "On Sep 18 you wrote that margin was “around 55%”. Your Sep 18 snapshot computes 115% of account value ($49,911.40 borrowed on $43,277), or 53.6% of position value. Which number were you looking at?" | "You were wrong about your margin." · "You were in denial." |
| A question back | "Your Sep 4, Sep 11 and Sep 18 adds are 3 of the 4 that pattern 1 counted, and each says a version of “it has to roll over”. What would have told you it wasn’t going to?" | "Hope is not a strategy." · "Would selling the puts earlier have helped?" |
| Something that went as planned | "Your Oct 1 plan named a price, $13.10, and the Oct 2 trim of the TSLA puts was made at it. What was different about writing that one?" | "Great discipline!" · "Keep it up." |
| A rule draft | "When a position is 15% or more below my average cost, I don’t add to it." Its limit reads "15% · Convexa’s pattern threshold, not from your entries". | "Sell TSLA." · "Never use margin." · "Reduce your NVDA position." · A limit the model picked: "When margin used is above 50%…" |
| The drawdown, his words | "You wrote “down about 40%”. With money in and out taken out, your snapshots compute −42.6% from the Aug 21 high; account value alone is −38.3%." | "You’re down 42.6% because of bad decisions." |

### Models, cost and caching

Prices are from `docs/product/ai-analyst/DESIGN.md:453-457`, per million tokens:

| Model | Input | Output | Cached read | Cache write (5-min) |
|---|---|---|---|---|
| Opus 5.5 (`claude-opus-5-5`) | $4 | $20 | $0.20 | $5 |
| Sonnet 5.5 (`claude-sonnet-5-5`) | $2 | $10 | $0.20 | $2.50 |

**Recommended (open question 6):**

- **J1 on Sonnet 5.5**, effort `low`. Extraction is high-volume and needs no deep reasoning.
- **J2 on Opus 5.5**, effort `high`, set explicitly because Opus 5.5's default is `medium`. Its
  output is read by him and gates his rules.

**Token budgets** (estimates; slice 4 replaces them with logged usage):

| Pass | Static prefix (cached) | Package | Output, thinking included | Cost |
|---|---|---|---|---|
| J1, one entry | 4,000: system, schema, field list | about 1,400 | about 700 | cold ≈ $0.020 (4,000 × $2.50 + 1,400 × $2 + 700 × $10, per million); warm, prefix read from cache ≈ $0.011 |
| J2, one review at 34 entries | 5,000: system, schema, detector glossary, tone rules | about 12,400: detector table 1,500, older digests 3,060, new text 2,800, snapshots and series 2,240, rules 1,200, findings and corrections 1,500, suspicions 100 | about 6,900 | ≈ $0.21 ($0.025 cache write + $0.050 input + $0.138 output) |

- **One review at the sample's size:** 8 J1 reads ($0.020 + 7 × $0.011 ≈ $0.09) plus J2 ($0.21) ≈
  **$0.31**.
- **A month at two entries a trading day and one review a week:** ≈ **$1.40** at the start. After a
  year it is ≈ $2.10, because each older entry adds about 90 digest tokens (≈ $0.0004) to every
  review.
- **Reading on every save** (opt-in) costs more, because the prefix is usually cold: ≈ $0.020 per
  entry, about $0.83 a month on J1 alone.
- **The first bulk read** of 34 entries, computed as the review's J1 estimate is (one cold read at
  $0.0198, the rest warm at $0.0106): ≈ $0.37 at the standard price, so ≈ **$0.18** at the Batch
  API's half price. Cache hits inside a batch are best effort; with none, it is ≈ $0.34.
- **J2 on Sonnet** would be about half ($0.11 a review).
- **The worst case**, which the per-run cap checks, is the estimated input plus `max_tokens` of
  output: a J1 read ≤ $0.053 cold and $0.044 warm (4,000 output tokens), and J2 ≤ $0.395 (16,000
  output tokens at $20 per million is $0.32 alone). A review at the sample's size is ≤ **$0.75**.

**Caching.** Each pass has a byte-stable static prefix: no timestamps, canonical JSON, a fixed
schema and glossary. The volatile package comes after the last breakpoint. J1 reads run as a batch
at review time, so the prefix is written once and read 7 times within 5 minutes. J2 runs weekly and
is cold each time. Each prefix is long enough to cache on its model, which is checked when built
(`usage.cache_read_input_tokens` > 0 on the second J1 read). The Batch API (half price) is used only
when he isn't waiting: the Monday auto-run and the first bulk read after turning reads on, in slice
5.

**Caps.**

| Cap | Value | How it's enforced |
|---|---|---|
| Per run | $1.00 | A run whose worst case (above) exceeds it isn't started, so the cap is hard, not an estimate. `max_tokens` bounds the output. |
| Per month | $5.00 by default | Summed from `journal_ai_runs.cost_micros`, worst case for a run in flight. Cost rows outlive Delete journal, with their packages and outputs purged, so deleting the journal doesn't reset the month. |
| Per day | 3 reviews and 60 entry reads | Counted from the same table. |

None of these is the process-global rec counter (`recommendation.rs:41-42`).

### Failures

| Failure | What happens |
|---|---|
| Provider error or timeout | Request failure, with Retry. Entry reads already made keep their results. J2 still runs: it has the full text of new entries. |
| `max_tokens` reached (truncated JSON) | The schema check fails. The run is shown as "The answer was cut off" under request failure. |
| Refusal | Refused. No automatic retry. |
| Check failed | The failed draft is kept, collapsed and labelled. |
| A second run while one is running | `409 run_in_progress`, "A review is already running." |
| Cap reached | No request is sent. |

A failed refresh never evicts the pinned review.

### The eval gate (before J1 or J2 ships)

- **The set:** a frozen, hashed golden set of 12 authored synthetic journals, flagged `illustrative:
  true`, never his entries:
  - 6 with planted downfalls (adds below cost, size after wins, passed exits, margin creeping up
    before an event);
  - 4 traps: one catastrophic event, a journal **mostly from memory** (1 entry written at the time
    and 10 recalled, his own likely start), prose figures that disagree with snapshots, a deposit
    during a drawdown;
  - 2 with nothing notable.
- **The bar:**
  - the number check passes on 100% of runs after at most one retry;
  - 0 advice or tone hits;
  - every planted pattern appears among the top 5 findings;
  - the event is never generalised;
  - on the mostly-from-memory journal, no "About what you decided" finding at all: only what
    happened, his words against his numbers, and questions back;
  - rule drafts are 100% process rules, and every draft limit is a figure he wrote or a cited
    pattern threshold, never one the model chose;
  - pass^3: each item passes in 3 of 3 runs.
- **The judge** is from another provider and sees only synthetic data. He reads 10 outputs in full
  before switching reads on.
- **Cost:** ≈ 12 journals × 3 runs × $0.31 ≈ $11, plus judging, about $6 at Sonnet-equivalent rates.

## The rulebook

**What a rule is.** A first-person conditional process rule: "When / Before / After / Every
[condition], I [action]." It has:

- **Check by asking**: a yes/no question for plan time.
- **An optional limit** on the closed metric list (Screens → Rulebook), checked by code.
- **Origin**: a finding with its cited entries, or "written by you".
- **His why**, in his words. It is required to adopt.

**Wording rules, enforced by code on AI drafts.** He may write anything himself.

- first person;
- one condition and one action;
- about his process, never a ticker, a price target or a market view;
- measurable where possible;
- no "never" or "always" unless he writes it.

**The sample's rulebook.** Numbers follow the order rules became active.

| Rule | Status | Wording | Check by asking | Limit | His why |
|---|---|---|---|---|---|
| R1 | written by him Aug 21, retired Sep 24 | "Before I add to a position, I write why in the journal first." | "Did I write why first?" | — | Retired with: "I add from my phone and can’t always write first." |
| R2 | v2, Oct 3; v1 adopted Sep 30 from the Sep 28 review's draft, which lacked "the same day" | "When a position is 15% or more below my average cost, I don’t add to it the same day." | "Is this position less than 15% below my average cost?" | position % below average cost · at or above · 15 (Convexa’s pattern threshold, not from your entries) | "Three TSLA put adds, each lower." |
| R3 | v1, written by him Sep 30, after the call | "When margin used is above 50% of account value, I don’t open or add to a position." | "Is margin used at or below 50% of account value?" | margin used · above · 50% (his figure) | "147% turned a bad month into a margin call." |
| Draft | drafted by the Oct 7 review | "Every Entered or Added entry gets an “I’m wrong if…” line before I place it." | — | `not set` | — |
| Draft | drafted by the Oct 7 review | "Before an earnings date for a position I hold on margin, I check my broker’s margin requirement for it." | — | `not set` | — |

The earnings draft is drawn from his own Sep 29 words about the raised NVDA requirement.

**Lifecycle.**

1. Drafted, by a review (3 at most) or by "Draft a rule from this". A draft has no number.
2. Adopt as written, Edit then adopt, or Not for me (his reason stored; the draft stays read-only).
3. Active v1, with `adopted_at` and the next rule number. A rule he writes himself starts here.
4. An edit makes v2. v1 is kept with its dates, his reason, and the AI's original wording.
5. Pause: no checks are asked.
6. Retire: with a reason and a date. The rule stays listed.

The AI never adopts a rule, and nothing is ever deleted.

**How it is checked.**

1. **At plan time, by him.** Yes · No · Doesn't apply, starting unselected. A limit shows its
   reading as received ("within" plain, "above" with the warning glyph, never green). His answer is
   never pre-filled. "Why go ahead anyway?" is optional on a No. A snapshot older than 5 weekdays
   raises the stale strip.
2. **After the fact.** Proposed touches from the parser or J1 ("R2 may apply: …"), and only the ones
   he keeps count.
3. **All counts are computed by code.** The UI says which are "answered by you" (plan answers) and
   which are "computed" (limit readings), because his answers can't be checked against anything.

**How adherence is shown.**

- Per rule: "Asked in 2 plans · Yes 0 · No 1 · Doesn’t apply 1 · Not answered 0", as neutral count
  dots. "Not answered" is an answer label with its count, not a value gap.
- "Account change after Yes vs after No" stays withheld as "too few to judge (0 and 1 counted;
  rates start at 20)" until both sides reach 20. After that it shows a mean change and a
  Wilson-bounded "next snapshot higher" rate, labelled "linked to, not caused by".
- No streaks, badges, scores or "discipline %".

**Where an adopted rule can go.** Nowhere else, in this spec. The earlier draft offered to copy a
limit into a Settings risk input, but no metric on the closed list matches either Settings slot
(Account size and Max risk per trade, `features/auth/copy.ts:214-247`), and Account size would have
put his real balance into every ticker AI read. So the hand-off is cut, and no journal path writes a
risk input (criterion 19). PersonaConfig limits (`DESIGN.md:268-299`) would be a separate spec. The
journal itself never enforces anything and never touches an order.

## Copy

The voice is plain and short, and claims nothing beyond the record (rule 4). State words come only
from `DATA_STATES`, and value gaps only from rule 24's nine. Dates use `formatShortDate`. Typographic
apostrophes are used in UI strings, as `vocabulary.ts` does.

| Where | String |
|---|---|
| Tab band | `Book` · `Journal` · `Review` · `Rulebook` |
| Journal h1 / subline | `Journal` / `Your real account, in your words. Typed by you, stored on your account.` |
| Primary (journal tabs) | `Write entry` |
| Phone bottom bar | `Write entry` · `Margin call` |
| ⌘K group / rows (Q2) | `Write` / `Write a journal entry` · `Margin call entry` |
| Quick capture | `What happened, and what are you thinking?` · `Numbers: carried from {Oct 2} ({4} days) · Update` · `Save` · `Open full editor` |
| Kind chips | `Entered` · `Added` · `Trimmed` · `Closed` · `Margin call` · `Money in or out` · `Plan a trade` · `Just thinking` · (import) `Imported` |
| Order segment | `Order by: Written · About` |
| Recalled card | `Written {Oct 26} · about {Aug 14}` |
| First run | `Start with today.` · `Write what you hold, what you’re thinking and how the account looks. One sentence is enough. Nothing is sent to an AI until you turn AI reads on.` · `Write the first entry` · `Write about an earlier day` · `Bring in past trades` · `Name what you think goes wrong` |
| Rail account frame | finding `Account value {$31,609}, {42.6}% below its recorded high` · loading/empty `Account value` · `Account value · appears after your first snapshot` · `Account value · one snapshot so far` |
| Below-the-high ⓘ | `Each deposit or withdrawal is taken out on its day, so money you put in can’t hide a loss and money you take out isn’t counted as one. Account value alone is {38.3}% below its recorded high.` |
| Chain break | `Account value reached $0 or below on {Sep 29}, so a percent can’t be chained past it. The dollars still add up.` |
| Money timing | `Counted before your {3:40 PM} numbers · Change` · `The AI’s drawdown will count this money as a gain or a loss.` |
| Margin used ⓘ | `Margin loan as a share of account value. 100% means you’ve borrowed as much as the account is worth. As a share of your positions’ value it is {53.6}%.` |
| Revisit | `Revisit due: your {Aug 26} entry ({QQQ puts}) · Open` |
| Sign-out with an unsent entry | `{1} entry hasn’t reached your account yet. Signing out deletes it from this browser.` · `Try sending now` · `Sign out and delete it` · `Stay signed in` |
| Chart caption | `The line joins your snapshots. Convexa has no prices between them.` · legend `● written at the time · ○ written later, from memory or a statement` |
| Couldn’t load | `Your journal didn’t load. Nothing is lost.` · `Try again` |
| Not on account yet | `Not on your account yet. Kept in this browser until it goes through · Try again` |
| Storage not set up | `Journal storage isn’t set up on this server, so nothing can be saved yet.` |
| Wall (signed out) | `Sign in to open your journal` · `See it on the demo →` |
| Not the owner | `This journal is private to the account that owns this Convexa.` |
| Composer h1 / meta | `New entry` · `Written when you save · {Tue Sep 29}` · `About: Today ▾` |
| About strip | `This will read “Written {Oct 26} · about {Aug 14}”. Reviews treat it as memory, not as what you thought at the time.` · `As of {Aug 14}, {4:00 PM} · Change` |
| Placeholders | `What happened, and what are you thinking right now?` · `What did you buy or sell, why now, and what would tell you you’re wrong?` · `What are you about to do, and why?` · `Anything on your mind about the account.` |
| Reveals | `+ How sure are you this works out? (0–100)` · `+ I’m wrong if…` · `Exit at` · `No exit set` · `+ Revisit on…` · `Closed by: Me · Broker (liquidation) · Expiry · Assignment` |
| Keep out | `Keep this entry out of AI reads` |
| Account number scan | `This looks like an account number (9 or more digits in a row). Remove it? Entries never need one.` · `Remove` · `Keep it` |
| Draft / save | `Draft saved {2:15 PM}` · `Discard draft` · `Save entry` · `Saved entries stay as written. You can add a later note any time.` · `Picking up your draft from {1:58 PM} · Discard` |
| Saved | `Saved · {Tue Sep 29, 2:14 PM}` |
| Save failed | `Couldn’t save to your account. Your text is kept in this browser until it goes through.` · `Try again` |
| Snapshot panel | `Account snapshot` · `Carried from {Sep 25} · {4} days old` · `Unchanged · Update numbers` · `was {$36,146} on {Sep 25}` · `Broker screen · Statement · Memory` · `No numbers yet. Add them, or save without; they’ll read “not recorded”.` |
| Fields | `Account value` · `Cash` · `Margin loan` · `Maintenance requirement` · `Buying power` · `+ Margin call` · `Call amount` · `Due by` |
| Validation | `Use a plain number like 41210 or 41,210.50` |
| Sanity question | `This is {90}% below your {Sep 25} snapshot ({$36,146}). Keep it?` |
| Snapshot foot | `These are the numbers you type. Convexa can’t read balances or margin from your broker, and never places, changes or cancels an order.` |
| Money in or out | `In · Out` · `Money in or out is taken out of the drawdown, so a deposit can’t hide a loss.` |
| Margin call mode | h1 `Margin call` · strip `Write it as it is, facts first. Nothing here is graded, and you can add more later. This page doesn’t contact your broker; its notice and deadline are what count.` · `More numbers` · `Unchanged since {Sep 25}` · `What’s happening, and what are you weighing? It doesn’t have to be tidy.` · `One thing you want to remember from today` |
| Cross-check | `Your broker’s call: {$2,750}` · `Your numbers compute excess liquidity of {−$2,750}. That matches the call.` · `Your numbers compute {−$2,762}` |
| After a call | `Saved · {Tue Sep 29, 2:14 PM}. It’s in the record as you wrote it.` · `Add a later note when it’s resolved` · `When you’re ready, a review can look at the weeks before this call. Nothing runs until you ask.` |
| Plan a trade | `Your rules` · `Yes · No · Doesn’t apply` · `{Margin used 84%} of account value ({Oct 2} snapshot, {3} days old) · {R3} limit {50%} · above` · `within` · `If the {$1,280} is borrowed: margin used {84%} → {88%}` · `Why go ahead anyway? (optional)` · `This journal doesn’t stop or place trades. It keeps what you decided, and why.` · `Save plan` · `Plan saved · asked {2} rules · {1} answered No` · `No rules yet. Plans still save; rules you adopt later show up here.` |
| Stale snapshot strip | `These numbers are {20} days old. Update them for a current reading.` |
| Entry | `Written {Aug 21} about {Aug 4}. Reviews treat this as memory, not as what you thought at the time.` · `Later note · {Sep 30, 6:40 PM}` · `Add a later note` · `Context for the AI` |
| Correct a figure | `Correct a figure` · `{Margin loan} {$11,890} → corrected to {$11,980} on {Aug 22}: “{reason}”` |
| Details | `Details found` · `found by the parser` · `found by the AI` · `Keep` · `Fix` · `Not right` · `Keep all` |
| AI read head | `AI · read {Oct 7, 6:58 AM} · {Sonnet 5.5} on your key` · `How the AI summarised this entry (used in reviews)` · `Cited in` · `What was sent` |
| AI read states | `AI reads are off. Turn them on in Settings › Journal.` · `Add an Anthropic key in Settings to turn on AI reads. Writing, numbers and the rulebook work without one.` · `Choose a model for journal reads in Settings › Journal.` · `Reading sends this entry’s text, its numbers, the summaries of your 5 previous entries and your active rules to Anthropic ({Sonnet 5.5}) on your key.` · `Not read yet. It’s read with the next review.` · `Reading this entry · Finding details · Writing the summary` · `No read on the day of a margin call. It’s read with the next review.` · `Read it now` · `This read didn’t pass the number check, so it isn’t shown.` · `Run again` · `AI unavailable · Anthropic returned an error. Nothing was lost.` · `Retry` · `Anthropic declined this read. Nothing from it is shown.` · `Kept out of AI reads since {Oct 26}.` · `Sample read · No model was called` |
| Rule touch | `{R2} may apply: “{quote}”; the {TSLA puts} were {28.3}% below your average cost.` · `That’s right` · `Not right` |
| Delete entry | `Delete entry…` · `Delete this entry’s words and numbers? The timeline keeps a line saying an entry was deleted on {Oct 27}. What was already sent to your AI provider is under its terms.` · `Delete entry` · `Keep it` · tombstone `An entry written {Sep 29} was deleted on {Oct 27}.` |
| Tidy | `Tidy up` · `Details found in your entries. Only the details you keep count in reviews and rule checks.` · `{14} details in {6} entries` · `Keep all in this entry` · `Count “{160 NVDA at $214.00}” as a position in this entry?` · `Part of this reads like it’s written from memory.` · `Split the remembered part into an entry about an earlier day` · `Mark the whole entry as from memory` · `Split from your {Sep 29} entry` · `Nothing to tidy.` |
| Review h1 / egress | `Weekly review` · `Running a review sends the text of entries written since the last review, short summaries of older ones, your snapshots, computed figures, rules and corrections to Anthropic ({Sonnet 5.5} and {Opus 5.5}) on your key. Drafts and entries you kept out are never sent.` · `View what’s sent` |
| Review action | `Run this week’s review` · `≈ {$0.31} · estimate · up to {$0.75}` · `Set up in Settings` |
| Review head | `Review of {Sep 28} – {Oct 6} · as of {Oct 7, 7:02 AM} · {8} new entries ({34} in all)` · `AI · {Opus 5.5} on your key` |
| Week strip | `This week in numbers` · `Account value {$36,146} ({Sep 25}) → {$31,609} ({Oct 6})` · `{−$7,037} net of the {$2,500} in` · `{−18.6}% with money in and out taken out` · `{8} entries · {2} plans · {1} rule answered No` |
| Path title | `Account value fell {42.6}% from its {Aug 21} high, with money in and out taken out` |
| Event | `One event, not a pattern` · `It’s one event, so it isn’t counted as a pattern.` |
| Money went | `Where the money went since the high` · `Not explained by your typed marks: {−$424} (interest, fees or trades you didn’t type)` · `The {TSLA puts} are {90.2}% of the fall. That’s one position, not a pattern.` |
| Detector table | `Patterns checked every review` · `You named this` · `{3} of {4}` · `{4} counted; rates start at 20` · `{63}% (Wilson 95%: {43}–{79}%, n = {24})` · `no winning closes yet` · `no usual size yet` · `{1} resolved` · `{1} resolved; a score starts at 20` · `Seen at your snapshots only` · `Not measurable from your entries; asked in reviews` · caption `10 patterns are checked every review. With this many, one can look notable by chance.` |
| Finding card | `About what you decided` · `About what happened` · `In {3} of {4} “Added” entries · cites {4}` · `Cut the other way: {1} ({NVDA, Aug 28})` · `Show entries` · `Draft a rule from this` · `That’s not right` |
| Questions | `Questions your entries raise` · `Answer in a new entry` |
| Rules this review | `Rules this review` · `asked {2} · Yes {0} · No {1} · Doesn’t apply {1} · Not answered {0}` |
| How this ran | `How this ran` · `Read {8} entries · {Sonnet 5.5} · {$0.09}` · `Findings · {Opus 5.5} · {17,400} in · {6,900} out · {$0.21}` · `Number check passed · {31} figures` |
| Review states | `Reviews start once there are 3 saved entries. You have {2}.` · `Most of your entries so far are written from memory ({9} of {11}). Patterns about what you decided use only entries written at the time, so they start as you write them. What happened is below.` · `{0} of {0} · counts start with entries written at the time` · `Save this week’s review` · `AI figures leave out {2} entries you kept out` · `Ran automatically Mon {Oct 5}, 7:00 AM · sent {8} entries’ text and {26} summaries · What was sent` · `AI reads are off. The counts above need no AI. Turn reads on in Settings › Journal.` · `{8} new entries since {Sep 28} · ≈ {$0.31}` · `Reading {8} new entries · Counting 10 patterns · Checking {31} figures against your snapshots · Writing findings` · `{3} entries since this review. Its findings don’t include them.` · `Run again` · `This review didn’t pass the number check: {2} figures didn’t match your snapshots. It isn’t shown as findings.` · `See the failed draft` · `Failed draft · not findings` · `AI unavailable · Anthropic returned an error. Your entries are unchanged.` · `Anthropic declined this review. Nothing from it is shown; the counts above still stand.` · `The answer was cut off.` · `A review is already running.` · `3 reviews today is the limit. The next can run tomorrow.` · `This month’s journal AI cap of {$5.00} is reached. Change it in Settings.` · `This review could cost up to {$1.12}, over the {$1.00} limit per run. Keep some entries out, or raise the limit in Settings.` · `Sample review · No model was called. Entries you write here aren’t read.` |
| Finding drawer | `Evidence` · `How it was counted` · `counted: {selection rule}` · `Cut the other way` · `What it doesn’t use` · `Entries written from memory or imported aren’t used for what you decided.` · `It misread what I wrote` · `It’s missing context` · `Not a pattern to me` · `You marked this “{missing context}” on {Oct 6}.` · `{1} cited entry was deleted; this finding is out of date.` |
| Rulebook | `Rulebook` · `Your rules, in your words. Each one cites the entries it came from. Convexa never enforces them.` · `Write a rule` · `Copy as text` · `Print` · `Drafted from your journal ({2})` · `A draft from your entries. Reword it until it’s yours, or set it aside.` · `Because` · `Check by asking` · `Why this rule, in your words` · `Adopt` · `Not for me` · `Active ({2})` · `v{1} · since {Sep 30}` · `Asked in {2} plans · Yes {0} · No {1} · Doesn’t apply {1} · Not answered {0}` · `Account change after Yes vs after No: too few to judge ({0} and {1} counted; rates start at 20)` · `Convexa’s pattern threshold, not from your entries` · `answered by you` · `computed` · `Edit` · `Pause` · `Retire` · `Paused` · `Retired ({1})` · `Evidence changed since this was drafted: {3} new entries.` · `No rules yet. Write one, or let the weekly review draft some from your entries.` |
| Print card foot | `Your rules, in your words. Printed {Oct 7, 2026}.` |
| Import | `Write about an earlier day` · `Paste positions from your broker` · `Read a trades CSV` · `The file is read in this browser. Only the rows you import are sent to your account.` · `One entry per day` · `One entry per trade` · `Imported {Oct 26} · about {Aug 14}` · `Want to add what you remember thinking? It’ll be marked as written from memory.` · `{12} rows were already in your journal.` · `This file couldn’t be read as a table. Nothing was imported.` |
| What's sent | `What’s sent to Anthropic · {Sonnet 5.5} and {Opus 5.5} on your key` · `Convexa never adds your email, name, broker credentials or AI key to what’s sent. Text you write is sent as written.` · `Never sent: the simulated book, drafts, deleted entries, and the {2} entries you kept out, with their numbers, money in or out, details and notes. Computed figures sent to the AI leave those {2} entries out, so they can differ from the ones on your pages.` · `Copy all` · `Copied` · `Nothing is sent while AI reads are off` · `No model is called on the demo` |
| Settings › Journal | `Journal` · `AI reads of my journal` · `Turning this on lets Convexa send your journal text, numbers and rules to Anthropic on your key when you run a review, tap Read on an entry or accept a bulk read of older entries, and, if you turn them on below, on each save and each Monday. Nothing is sent until one of those happens.` · `Add an Anthropic key in Settings › AI first` · `Models for journal reads` · `Entry reads` · `Reviews` · `Read each entry right after I save it` · `With this on, each save sends that entry’s text, its numbers, the summaries of your 5 previous entries and your active rules to Anthropic ({Sonnet 5.5}) on your key. Margin-call entries are never sent on save.` · `Offer the weekly review each Monday` · `Run it automatically Mondays at 7:00 AM ET` · `Each Monday at 7:00 AM ET this sends what a review sends, without you tapping Run.` · `Monthly cost cap for the journal` · `Limit per run` · `This month: {$0.31} of {$5.00} · {1} review · {8} entry reads` · `Downfalls you suspect` · `Reviews test these first.` · `Export journal (JSON)` · `This file isn’t encrypted. Keep it somewhere private.` · `Restore from an export` · `Delete journal…` · `Type “delete journal” to confirm.` · `Export first` |
| Bulk read offer | `Sends the full text of {34} entries, once each, with their numbers and your active rules, to Anthropic ({Sonnet 5.5}, batch price) on your key. Entries you kept out are left out.` · `{34} entries haven’t been read. Read them now · ≈ {$0.18}` |
| Not set up (provider) | `Not set up · journal reads run on an Anthropic key for now` |
| Staging | source chip `Sample journal` · `Sample review · No model was called` |
| /privacy store rows | `Journal` · `On your account, encrypted. Only you can open it.` · `When you write an entry` — and `Journal drafts and unsent entries` · `In this browser, not encrypted. Drafts clear when the entry saves, on Discard and on sign-out; an unsent entry stays until it reaches your account, and sign-out asks first.` · `When you start writing` |
| /privacy egress row | `Your AI provider (Anthropic), only with journal AI reads on: when you run a review, read an entry, accept a bulk read of older entries, or turn on reading on save or the Monday run. It gets the entries you allow, your numbers and rules, on your own key.` |
| Page foot | `Not investment advice.` |

## Design

**Canon cited:**

- rules 4 (honesty copy), 5 (warning pattern), 6 (focus), 7 (touch);
- rule 10 (real-money entry is a separate component);
- rule 13 with ruling D-D (typed figures are Mono with no dotted rule);
- rule 16 (AI states), 17 (no overflow), 19 (five links), 21 (panels are containers), 22 (no
  liveness);
- rules 23 and 24;
- P-2, P-3, P-6, P-8 to P-13, NO-13 B;
- D1 and D2 (`DESIGN_SYSTEM.md:288`);
- owner ruling A (amber on the one primary).

### Type register

| Face | Used for |
|---|---|
| Archivo | page titles and the review's section titles. Stat values are never headings. |
| IBM Plex Sans | entry text (16/1.55 in cards, 17/1.6 in the editor), AI prose (Sans 17 for claims), his quotes (Sans with a 2px steel left rule), rule wordings (Sans 17/600) and every not-a-number member |
| IBM Plex Mono, tabular | every figure he typed and every figure Convexa computed. AI-stated figures appear only traced (check glyph + Mono, linked to the fact); an untraced figure fails the check, so it never renders. |

Inter is banned.

### Palette roles

Values live only in `tokens.ts`; the boards use the mirror.

| Role | Used for |
|---|---|
| ink / panel | surfaces |
| phosphor | the claim's series and primary text |
| steel | context, reference lines (the recorded high, a rule's limit), count dots, neutral bars |
| `chartBand` wash | the below-the-high area |
| `chartContext2` | a second context series |
| `textDim` | dimmed text, never opacity |
| amber | only the one primary per screen, the focus ring and the in-flight indicator. A journal read has no verdict word, so no amber text anywhere. |
| burnt orange (`warning.*`) with its icon | the Margin call pill, "above" readings, stale strips, failures and the Delete actions (with the word, never red) |
| `textUp` / `textDown` | only signed money text (change, P/L, where the money went), always with + or − or ▲/▼ |

Counts, rates, adherence and "within" are never tinted. No green or red on any status.

### Charts

They are drawn in the chart system: `ChartFrame`, `frame/roles.ts`, P-8 to P-13.

1. **The account path.** Three small multiples on one date axis, with an event rail beneath. Past
   three series, P-9 asks for small multiples.
   - **Account value:** a phosphor line through one point per snapshot, straight segments, no
     smoothing. Filled points were written at the time. Hollow points were recalled, from memory or
     a statement, and the legend says so in words. The recorded high is a steel dashed line
     labelled "$51,251 · recorded high · Aug 21".
   - **Below the recorded high:** the chain-linked series as a phosphor line over a `chartBand`
     wash between it and the zero line. The sign is carried by position below zero and by the "−"
     in its labels (P-11). The end label reads "−42.6%". Past a chain break the line stops, and the
     break is labelled in words.
   - **Margin used:** a phosphor line. Each active rule's limit is a steel dashed line labelled "R3
     · 50%". No colour for points above it.
   - **Event rail:**
     - the margin call: the warning glyph and "Call $2,750";
     - money in or out: "+$2,500" text;
     - trims and closes: ticks with their kind initial;
     - a notes lane of entry ticks.
   - **Caption:** "The line joins your snapshots. Convexa has no prices between them."
   - No crosshair, and no keyboard path on the chart itself (NO-13 B). The table twin (date ·
     source · account value · margin loan · margin used · below the high · money in or out · event)
     is the keyboard path.
   - A data-driven tween of at most 600 ms, instant under reduced motion (P-12). Chart text is
     11px or larger (P-13); narrow axes drop ticks.
2. **Where the money went.** Horizontal bars, neutral steel, extending left from a zero line for a
   loss and right for a gain. Signed text in `textDown`/`textUp` with "−"/"+". It has a twin.
3. **Detector counts.** Below n = 20, a dot strip: n dots of 8px with 4px gaps, k filled phosphor,
   the rest steel outline, with the text "3 of 4" and, under it, "4 counted; rates start at 20".
   Dots, not bars, because a bar reads as a rate.
   At n ≥ 20: a 0–100% track with a phosphor fill to the rate and a steel whisker for the Wilson
   interval, with the text "63% (43–79%) · n = 24". It has a twin.
4. **Rule asks.** The same dot strip per answer kind.

**Titles state the finding only when there is data (P-10).** Loading, empty and failed frames name
the metric: "Account value", "Where the money went since the high", "Patterns checked every review".

**Frames** are solid on production (his own data) and dashed with the 8px steel hatch band on
staging. A staging frame names the sample once, through the source chip "Sample journal" (D1).

### Panels, spacing, motion and overlays

- Every frame is a container-query context (rule 21). Quiet panels for cards never lift. Normal
  panels lift 2px to `e2`.
- Spacing is on the 4-point ladder. Radius: panels 12, dialogs 16, controls 8, pills 999.
- No pulse, flash, trail or live dot: the journal is a record, not a stream (rules 18 and 22).
- Hover transitions run 160–220 ms. The bottom sheet takes 320 ms.
- Overlays:
  - dialogs are 560 (wide 760); drawers 520 (the finding drawer 560);
  - below 600px, all are bottom sheets with a grab handle and actions stacked at 44px;
  - errors are inline, never a toast;
  - destructive actions confirm inline, with no modal on a modal;
  - Escape closes every overlay and returns focus to its opener.
- Every hover reveal (span highlighting, row menus) has a tap and focus path (rule 20).
- Every page foot carries "Not investment advice."

### Breakpoints

One fluid body per screen across the six bands. Grids use `minmax(0, 1fr)`. Figures step 20 → 17 →
15px by container. No horizontal overflow at 390, 393, 834, 900 or 1280. The only sideways rails
are the tab band, the kind chips and the import mapping table.

### Canon events (each an Amendments row, open question 2)

1. **A pen glyph.** A stroke icon on the 24 grid named `edit`, added to `design/src/lib.mjs` and to
   the app's icon set.
2. **The second use of section tabs.** Positions gets Book · Journal · Review · Rulebook.
3. **A ⌘K "Write" group** with two rows, after Go to. `PALETTE_COMMANDS` and `GO_TO` are unchanged.
4. **Rule 16's scope.** The journal read uses rule 16's states and anatomy (evidence before prose,
   grounding in a drawer, bottom sheet with a peek row, request failure never idle, pinned result
   never evicted, stale as a warning strip). It has no verdict, so the verdict-first clause and its
   amber verdict word don't apply.
5. **[journal-figures-stay-in-journal]**, a PROJECT_CONTEXT record. Journal balances, margin, text,
   positions and rule limits never reach decision records, the outcomes ledger, alerts, the Settings
   risk inputs, the ticker AI read or any export but the journal's own. There is no exit; a hand-off
   would be a separate spec and a new record. AC-29a stays as written; the journal is a separate
   store.

### Design source

Add the rows below (BOARD BRIEF) in `design/src/screens/final/journal.mjs` (new) and
`journal-kit.mjs`, with `section: 'planned'`. Import them in `index.mjs` (`:1-52`; a row on no
page fails the build). Sample strings go in `design/src/data/journal-sample.mjs`. Regenerate with
`node design/src/build.mjs`; never hand-edit `design/canvas` or `design/site`. Build status chips
appear on boards only (P-4).

## Data and privacy

### Store

The journal gets its own tables in production Postgres (Railway), added by new forward-only
migrations, the next free numbers after 13 (`db/migrations.rs:312`). postgres-migrate applies them
before deploy.

| Migration | Slice |
|---|---|
| `journal_core` | 1a |
| `journal_rules` | 2 |
| `journal_review` | 3 |
| `journal_ai` | 4 |

For local dev there is a JSON-file store at `data/journal.json`, under the gitignored `/data/`
(`.gitignore:105`, the auth store's pattern at `config.rs:475`). It holds ciphertext too, so entries
survive a restart and are never "ephemeral" as `user_book` is on a JSON build
(`routes/book.rs:313-321`). It is not `user_book`'s blob, and it is not the DecisionRecord log.

### Tables (all keyed by `user_id`)

- **`journal_entries`**:
  - `id` uuid, `user_id`, `client_id` uuid (idempotent create);
  - `kind`: entered | added | trimmed | closed | margin_call | money | plan | thinking | imported |
    deleted;
  - `body_ct`, `body_chars`, `written_at` (set by the server);
  - `about_date` (null unless set). There is no `recalled` column: recalled is derived on read from
    the kind and the latest About-date correction (Information architecture → Order);
  - `source`: typed | paste | csv | split; `confidence_ct` (0–100, null unless given);
    `wrong_if_ct`;
  - `exit_price_ct` (null unless named) and `no_exit_set` (boolean), `closed_by_ct`, `revisit_on`;
  - `ai_excluded`, `deleted_at`, `seal_tag` (the export seal, below), `schema_version`.
  - **Sealed, with one permitted mutation.** The store module exposes insert, append (for notes,
    corrections, details and the other append-only tables) and a single `tombstone(id)` function,
    and nothing else that writes `journal_entries`. `tombstone` takes only the id: it sets `kind` to
    `deleted` and `deleted_at`, and sets every `_ct` column to null. It has no parameter through
    which a body could be written, so it can null a body but never replace one. The JSON dev store
    implements the same trait with the same three writers.
- **`journal_snapshots`**: `id`, `entry_id` unique, `as_of` (timestamptz; defaults to `written_at`
  when About is today and to 4:00 PM ET of `about_date` otherwise, editable before save and
  correctable after, and never moved by an About-date correction), `source` (statement |
  broker_screen | memory | import), `figures_ct`.
  - Each figure is `{ cents | null, provenance: typed | carried(from_snapshot_id) | not_recorded }`.
  - Positions are `RealLeg[]`: `{ symbol, instrument, side, qty (unsigned), multiplier, right,
    strike, expiry, avg_cost_cents, mark_cents | null, provenance }`.
- **`journal_corrections`**: `id`, `target` (a snapshot field, `snapshot.as_of`, `about_date`, or
  `recalled_span` with offsets), `value_ct`, `reason_ct`, `written_at`, `supersedes_id`.
  Append-only.
- **`journal_money`**: `id`, `entry_id`, `direction` (in | out), `amount_ct`, `occurred_at`
  (timestamptz).
- **`journal_later_notes`**: `id`, `entry_id`, `body_ct`, `written_at`, `ai_context`. Append-only.
- **`journal_details`**: `id`, `entry_id`, `field`, `value_ct`, `span_start`, `span_end`, `origin`
  (parser | ai), `run_id`, `status` (proposed | kept | fixed | rejected), `decided_at`.
  Append-only; superseded by a new row.
- **`journal_suspicions`**: `id`, `text_ct`, `detector_key | null`, `created_at`, `retired_at`.
- **`journal_reviews`**: `id`, `cutoff`, `computed_ct` (the week strip, the detector table, where
  the money went, events), `ai_run_id | null`. Created by `POST /api/journal/reviews` (slice 3),
  with or without an AI run.
- **`journal_ai_runs`**: `id`, `kind` (entry | review), `entry_id`, `cutoff`, `package_id`,
  `package_ct`, `provider`, `model_id`, `prompt_version` (`j-entry-1`, `j-review-1`), `effort`,
  `input_tokens`, `output_tokens`, `cache_read`, `cache_write`, `cost_micros`, `status` (produced |
  failed_check | request_failed | refused | capped), `check_ct`, `output_ct`, `started_at`,
  `finished_at`. This is the analyst_answers shape (`DESIGN.md:198-206`). Delete journal nulls
  `package_ct`, `check_ct` and `output_ct` and keeps the cost and token columns, so the month's cap
  still counts what was spent.
- **`journal_findings`**: `id` = hash(type, detector, selection rule), `run_id`, `type` (decided |
  happened | event), `claim_ct`, `cited_entry_ids`, `cited_fact_ids`, `state` (building |
  computed), `k`, `n`, `n_min`, `wilson_lo`, `wilson_hi` (absent while building), `status` (shown |
  dismissed).
- **`journal_feedback`**: `id`, `target_kind` (finding | detail | digest | rule_touch), `target_id`,
  `verdict` (misread | missing_context | not_a_pattern | agree), `note_ct`, `written_at`.
  Append-only.
- **`journal_rules`** (`id`, `number`: null while a draft, set once to the next number when the
  rule first becomes active; `created_at`) and **`journal_rule_versions`**:
  - `rule_id`, `version`, `wording_ct`, `check_question_ct`, `limit_json`, `origin_json`,
    `drafted_wording_ct`, `why_ct`;
  - `status`: drafted | active | paused | retired | declined;
  - `reason_ct`, `from_ts`, `to_ts`.
  - Append-only.
- **`journal_rule_checks`**: `id`, `rule_id`, `version`, `entry_id`, `answer` (yes | no | na |
  unanswered), `reading_json`, `why_anyway_ct`, `origin` (plan | kept_touch), `created_at`.
- **`journal_settings`**: `ai_reads`, `read_on_save`, `offer_monday`, `auto_monday`,
  `monthly_cap_cents`, `run_cap_cents`, `model_entry`, `model_review`, `updated_at`.

### Encryption at rest

Every `_ct` column is AES-256-GCM through the `EncryptionKeyRing` type (`services/auth/crypto.rs:94-198`):

- **Its own ring, in the ring's own shape:** `JOURNAL_ENCRYPTION_ACTIVE_KEY_ID` and
  `JOURNAL_ENCRYPTION_KEYS_JSON` (a JSON object of key id → 32-byte URL-safe base64 key), the same
  pair the AI-key ring reads (`crypto.rs:95-96`), so keys rotate the same way. It is separate from
  the AI-key ring so one leaked key doesn't open both.
- **A prefixed constructor with no fallback.** `EncryptionKeyRing::from_env()` hard-codes the
  `AI_KEY_ENCRYPTION_*` names and also reads a legacy single `AI_KEY_ENCRYPTION_KEY` (`:110`), and the
  module falls back to an ephemeral per-process key when none is set (`crypto.rs:3`, `:215`). Slice
  1a adds `EncryptionKeyRing::from_env_prefixed(prefix)`, which reads only `{prefix}_ACTIVE_KEY_ID`
  and `{prefix}_KEYS_JSON`, has no legacy key and no ephemeral fallback, and returns `None` when
  either is missing. `from_env()` becomes a wrapper over it plus its legacy key, unchanged in
  behaviour.
- **The AAD is bound to the row and the column:** `journal.v1|{user_id}|{table}|{row_id}|{column}|{key_id}`,
  through `encrypt_with_aad` and `decrypt_with_aad`. Today's `v1.{keyid}` (`crypto.rs:133`) would let
  a ciphertext move between rows unnoticed.
- **No key, no writes.** With no journal ring, writes are refused ("Journal storage isn't set up on
  this server"). The journal fails closed, never in plaintext, and never on a key that dies with the
  process. Local dev therefore sets the two variables too: their names go in `apps/api/.env.example`
  with empty values, with a one-line way to make a dev key (Verification, step 5). The owner's rule
  is that an agent never commits a `.env*` file, so the build lane stops and hands him that edit.
- **Plaintext metadata, on purpose:** ids, kind, `written_at`, `about_date`, `revisit_on` (a date,
  like `about_date`), `no_exit_set`, `ai_excluded` and the other flags, counts, token usage and cost.
  Everything else is encrypted, symbols, confidence, exit price and "Closed by" included. Search and
  ticker filters run in the browser after decryption.
- **The export seal.** On insert the server stores `seal_tag` = HMAC-SHA256, under a key derived
  from the journal ring, over `user_id`, `id`, `written_at`, `kind` and the SHA-256 of the body. An
  export carries it, and a restore uses it (Export and delete).
- **Logs** carry ids, sizes and timings only. Error bodies never echo content.

### Owner gate

Every `/api/journal*` operation uses `OwnerUser` (`routes/auth.rs:1104-1147`):

- signed out is 403 `auth_required`;
- any other account is 403 `owner_only`;
- an unset `OWNER_EMAILS` refuses everyone (`config.rs:71-83`).

Each operation is listed in `OWNER_ONLY_OPERATIONS` (`routes/mod.rs:2275`), whose OpenAPI tagging
must gain `PUT` and `DELETE` arms (`:2254-2256`). Each registers through `contract_route!` with
representative responses. OpenAPI is regenerated and the `capacity/identity.rs` oracle re-pinned in
the same commit (`PROJECT_CONTEXT.md:538-545`), then the TS schema. The browser has no owner flag,
and the server decides.

The same change, in slice 1a:

- **The contract probe.** `tools/api-contract.mjs:213` expects the owner 403 only for a `GET`, and
  every other owner-only method falls through to the 422 rule at `:235`. Every journal operation
  uses the `OwnerUser` extractor, which refuses before the body is read, so an anonymous probe gets
  403 and `npm run api:contract:check` would fail. The rule becomes "owner access → 403, any method",
  with the one exception named: `POST /api/recommendation/{ticker}` parses its body before
  `require_owner` and keeps its 422.
- **What the gate means.** The doc comments on `OWNER_ONLY_OPERATIONS` (`routes/mod.rs:2266-2274`)
  and `OWNER_EMAILS` (`config.rs:71-82`) define the list as licence-derived "Derived Works" and
  leave out "the caller's own book" on purpose. Both are amended to say the gate also guards
  owner-personal data (the journal), which reaches the owner's account alone for a different
  reason: it is his. DESIGN.md's owner-gate section (`DESIGN.md:440-444`) gains the same line, as an
  appended amendment.

### API (by slice)

| Slice | Operations |
|---|---|
| 1a | `GET/POST /api/journal/entries` · `GET /api/journal/entries/{id}` · `POST /api/journal/entries/{id}/notes` · `POST /api/journal/entries/{id}/corrections` · `DELETE /api/journal/entries/{id}` |
| 1b | `GET /api/journal/export` · `POST /api/journal/restore` (a `convexa-journal-v1` file, merge-only) · `DELETE /api/journal` |
| 2 | `GET/POST /api/journal/rules` · `POST /api/journal/rules/{id}/versions` |
| 3 | `POST /api/journal/details` · `GET/PUT /api/journal/suspicions` · `GET/POST /api/journal/reviews` (the POST stores a review's computed parts and cutoff) · `GET /api/journal/reviews/{id}` |
| 4 | `GET/PUT /api/journal/settings` · `GET /api/journal/ai/package` (What's sent) · `POST /api/journal/ai/runs` (takes a review id, or an entry id for one read) · `GET /api/journal/ai/runs/{id}` · `POST /api/journal/feedback` |
| 5 | `POST /api/journal/import` (confirmed rows only) |

Rule checks travel inside a plan entry's `POST`, so they need no route of their own. There is no
facts-preview route: previews before save come from the shared TypeScript facts module (Computed
facts → Where facts are computed). From slice 4, "Run this week's review" calls
`POST /api/journal/reviews` and then `POST /api/journal/ai/runs` with the new review's id.

### Egress, shown before any model call

- Nothing leaves in slices 1a to 3.
- From slice 4, a run sends only what the journal's own category table lists. The drawer is built
  from the same table, so it can't drift (the AC-90 pattern, `recommendation.rs:413-477`). It is
  shown before and after each run, with the package id, provider, model, token and cost estimate,
  and afterwards the stored usage.
- The ticker read's "no account or identity, no broker/order data" promise is not reused.
- **Every control that can reach the provider shows its own egress line, in full, in the same
  view, never in a tooltip.** There are six triggers, and each has its words in Copy:

  | Trigger | Slice | Where the line sits |
  |---|---|---|
  | "Run this week's review" | 4 | above the button (the review sentence) |
  | "Read it now", "Run again", "Retry" on an entry | 4 | above the buttons in the AI read panel (the per-entry sentence) |
  | "Retry" on a failed review | 4 | the review sentence stays above it |
  | "Read each entry right after I save it" | 5 | under the toggle, and, while it is on, under the composer's Save: "Saving also sends this entry’s text, its numbers, the summaries of your 5 previous entries and your active rules to Anthropic (Sonnet 5.5) on your key." (not on a margin-call entry, which is never sent on save) |
  | The bulk read of older entries | 5 | above "Read them now" (the bulk sentence) |
  | The Monday auto-run | 5 | under its toggle, plus the after-run notice on the Review page |

### Export and delete

- **Export.** "Export journal (JSON)" returns everything decrypted (entries, snapshots, money,
  notes, corrections, details, rules with versions and checks, reviews, AI runs' outputs) as
  `convexa-journal-v1` with `schema_version`, and each entry's `seal_tag`. The page warns that the
  file is plaintext.
- **Restore** (`POST /api/journal/restore`, slice 1b). Merge-only, matching by id and content hash;
  it never overwrites. The pattern is `features/trading/outcomes/archive.ts:1-20`. The file is
  plaintext and can be edited, so an entry keeps its original `id`, `written_at` and kind only when
  its `seal_tag` verifies against the server's key for the id, `written_at`, kind and body in the
  file. Any other entry lands as kind Imported, written now and about its original date, so it is
  recalled: an edited export can't launder memory into "written at the time". Snapshots, notes and
  rule versions follow their entry.
- **Withdraw an entry.** The store's one `tombstone` call (Tables): it nulls the entry's ciphertext
  columns, and the same transaction removes its snapshot, money, notes, details, rule checks and J1
  output. Findings that cite it lose their quotes from it and are marked out of date. Stored
  packages that contain it are dropped (`package_ct` nulled, `package_id` kept). The tombstone row
  keeps only `id`, `written_at`, `deleted_at` and kind `deleted`.
- **Delete journal.** Requires typing "delete journal", offers export first, and removes every row,
  except that `journal_ai_runs` keeps its cost and token columns with packages and outputs nulled,
  so the month's cap isn't reset.
- **What deletion reaches.** Whether Railway keeps database backups, and for how long, is not
  checked by this spec. Build step 1a reads the project's backup setting and writes the true
  sentence into the delete copy. The copy also says: "What was already sent to your AI provider is
  under its terms."

### Never in the public repo

- No real text or figures in fixtures, eval items, `research/`, design boards, screenshots, logs or
  commit messages.
- **Nor the owner's own request text and figures, or any claim about his account's state**, in
  specs, ledgers, briefs or commit messages: his request is, in substance, his first journal entry.
  Paraphrase it with no figures.
- Fixtures are synthetic and flagged `illustrative: true`, and the sample's headline figures are
  chosen apart from any real account's.
- gitleaks can't catch personal prose, so this is a review rule. The production boards draw the
  sample trader's figures with the board note "Figures illustrative; production shows only the
  owner’s entries".

### /privacy

`PrivacyPage.tsx` gains two store rows (the encrypted journal on his account, and the plaintext
drafts and unsent entries in the browser) and an egress row that names every trigger (Copy). Its
header comment (`PrivacyPage.tsx:1-17`) gains the journal tables and the browser key
`convexa.journal.drafts.v1` in its list of shipped stores (`:5-9`).

### Staging (the demo transport)

- **Every route has a handler.** The demo transport (`libs/api/src/lib/demo/transport.ts`) handles
  every `/api/journal*` route, so none falls through to `demo_unavailable` (`:1702`).
- **Storage.** Data lives in demo browser storage under `demoStorageKey` keys (`demo/mode.ts:49`).
  It is seeded by `initializeDemoWorkspace` (`demo/workspace.ts:202`) and restored by
  `resetDemoWorkspace` (`:576`).
- **The seed** is the Sample journal of the worked example, and each part lands in the slice that
  renders it, so no slice ships data that no screen shows:

  | Slice | Seeded |
  |---|---|
  | 1a | 34 entries (26 written at the time, 5 recalled, 3 imported), 12 snapshots with their leg facts precomputed, 1 money-in entry, 5 later notes, the Aug 22 correction. The 2 plan entries are cards only. |
  | 2 | R1 (retired), R2 (two versions), R3, and the 2 plans' rule answers. R2's origin shows the finding's title as text until slice 4 seeds the finding. |
  | 3 | Suspicions, kept details, and the computed parts of the Sep 21, Sep 28 and Oct 7 reviews. |
  | 4 | Those reviews' AI parts (findings, questions, the two drafts), the entries' sample AI reads, and the sample package for What's sent. |
  | 5 | The sample paste on the Import page. |

- **Facts on the demo.** Account facts for seeded and visitor-written entries come from the shared
  TypeScript facts module; leg facts are the seed's precomputed values, and `—` on a visitor's own
  entry.
- **The review run** plays the steps and returns the authored Oct 7 review. Settings writes and AI
  keys are refused with the demo's existing copy.
- **Marking.** The demo bar is the page's one "Demo · sample data · Oct 7, 2026" ("As of Oct 7,
  2026" from 600px). Each frame is dashed with the 8px steel hatch band and names the sample once,
  with the source chip "Sample journal". Rows and cards carry no Sample tag (D1 and D2).
- **The sample is fictional and impersonal.** No name, no likeness, demo symbols only (NVDA, TSLA,
  QQQ, MSFT, SPY). It mirrors the shape of a drawdown, not the owner's account, and its headline
  (42.6% below the high, a $2,750 call) was chosen apart from his figures. Its stock marks are the
  demo catalog's closes and its options expire on a date the demo's chain doesn't list, so no demo
  page shows a second price for anything it holds.

### Statistics

Wilson intervals are computed on the server, in one Rust function ported from `ledger.ts`'s
semantics (`features/trading/outcomes/ledger.ts:104-110`). This is a third implementation, beside
`ledger.ts` and `pages/research/wilson.ts:11-21`, which disagree at n = 0. The journal never renders
a rate below 20, so that disagreement is unreachable here. A test pins the Rust function to
`ledger.ts`'s values for n ≥ 20. Merging the two TypeScript copies is a separate follow-up, not part
of this spec.

The **Brier score** (row 10) is likewise a **second implementation** of a module whose header says
"ONE implementation" (`tools/research-notes/scoring.mjs:7`). The Rust port takes only the score
(the mean squared miss over resolved items with a probability), not the calibration bins. A test
pins it to `scoring.mjs`'s own output on 3 fixed inputs, run once with `node` when the port is
written and frozen as literals in the Rust test. `scoring.mjs`'s header gains a line naming the
port, so the claim stays true as written.

## Acceptance criteria

Each criterion names the slice that makes it checkable; it is checked when that slice ships and
re-checked by every later slice that touches it.

1. **Owner-only by construction** (1a). Every `/api/journal*` operation in the OpenAPI document
   carries `x-convexa-access: owner`. Signed out gives 403 `auth_required`, another account 403
   `owner_only`, and an unset `OWNER_EMAILS` refuses everyone. `npm run api:contract:check` exits 0
   with the widened probe. _Check:_ the OpenAPI-walking test, three `curl` calls against a local
   API, and the contract check's exit code.
2. **Sealed** (1a). After `POST /api/journal/entries`, no operation changes an entry's body or
   `written_at`: the document has no `PUT` or `PATCH` on entries. The store's only writers to
   `journal_entries` are `insert` and `tombstone(id)`, and `tombstone` can null a body but never
   write one. _Check:_ a test over the store trait, run against both the Postgres store and the
   JSON dev store: it lists the trait's writers (exactly insert, append and tombstone), and asserts
   that after a tombstone every `_ct` column is null, `written_at` is unchanged, and no call path
   exists that sets a non-null body on an existing id.
3. **Encrypted and row-bound** (1a). A body ciphertext copied into another row's column fails to
   decrypt. Saving an entry containing a sentinel word, then `pg_dump` of the local database, gives 0
   matches for the sentinel. _Check:_ the AAD test, and `pg_dump | grep -c SENTINEL` printing 0, with
   its exit status read from `$pipestatus`.
4. **Margin-call capture is short** (1a). At 390 with a coarse pointer, from Positions › Journal:
   tap "Margin call", type the call amount, set the due date and time, type the account value, then
   tap Save. That is at most 6 interactions, where an interaction is one tap or one field's typing
   (focus included), and "Due by" is one native `datetime-local` input, counted as one however many
   taps its picker takes. The first field (Call amount) is autofocused, so its typing is one
   interaction with no tap. The entry appears on the timeline with the Margin call pill. _Check:_ a
   Playwright walk counts the actions; the owner times one real run under 60 s.
5. **No read on the margin-call day** (5, with reading on save). With "Read each entry right after I
   save it" on, saving a margin-call entry makes 0 provider requests, and the card reads "No read on
   the day of a margin call. It’s read with the next review." _Check:_ the `journal.provider_request`
   counter reads 0 and the API log has no `journal.provider_request` line for the save (both from
   slice 4's completion path), and a text read.
6. **The computed facts reproduce** (1a for account facts, 1b for leg facts, 3 for detectors). On
   the sample seed, the server's facts equal the worked example: every margin used and excess
   liquidity, the chain-linked series (−42.6% on Oct 6), account value alone (−38.3%), $22,142 lost
   since the high, where the money went (−$19,980 · −$2,800 · +$867 · +$195 · remainder −$424),
   leverage 1.23× and 2.47×, and the detector column: row 1 3 of 4, row 2 4 of 5, row 3 1 of 1, row
   4 0 of 1, row 5 0 of 2, row 6 no winning closes, row 7 7 of 11, row 8 12 of 12, row 9 1 of 3, row
   10 1 resolved, written from memory 8 of 34. _Check:_ Rust tests over the seed fixture, and the
   TypeScript parity test over the same fixture.
7. **A deposit can't hide a loss** (1a). Two fixtures that differ only by a $D deposit and an end
   value higher by $D give the same chain-linked drawdown, including when the deposit falls on a
   snapshot's day before or after it. _Check:_ a test.
8. **Type register** (1a). Typed and computed figures render in the Mono token with no dotted rule.
   `not recorded`, `not set`, `not given`, `no basis` and `unrecognized` render in Sans. _Check:_
   `getComputedStyle(el).fontFamily` over the timeline, entry and composer at 1440.
9. **No hue-only meaning** (1a, re-checked by 2 to 4). In journal routes, the theme's success and
   error fills appear on no element. `textUp`/`textDown` appear only on text that also carries +, −,
   ▲ or ▼. "within" is never tinted, and the Margin call pill and "above" carry the warning glyph.
   _Check:_ a computed-style scan.
10. **No rate below 20** (3). In every review payload, a detector row or finding with n < 20 has the
    `building` shape with no rate or interval field (absent, not null), and the page shows "{k} of
    {n}" with "{n} counted; rates start at 20". _Check:_ a test on the review builder, and a text
    read.
11. **The table is fixed** (3). Every review shows all 10 detector rows in the fixed order, zeros
    included, with the caption "10 patterns are checked every review. With this many, one can look
    notable by chance." _Check:_ a text read on staging and on a local production build.
12. **The number check gates findings** (4). Each of seven mutated J2 outputs is stored as
    `failed_check`, and the page shows the failed state with no findings. The mutations: a figure ≠
    its fact; a quote ≠ its span; k ≠ code's count; a decided finding citing a recalled entry; a
    count written in words that disagrees with code ("Four of the adds"); an uncited count word
    ("most of your adds"); and a draft limit that is neither his figure nor a cited threshold.
    _Check:_ a test.
13. **The advice and tone scan** (4). Each of these in the AI's own words fails the read, and the
    same words inside a quote of his do not: "sell TSLA", "you should", "reckless", "this caused your
    loss", "great job", "Reduce leverage.", "Consider cutting margin below 50%.", "It may be worth
    trimming the largest position.", "Lower margin would have avoided the call.", "Would selling
    NVDA earlier have helped?", "Margin rose in a row." "You named three suspicions" passes.
    _Check:_ a table test.
14. **Egress shown before any call** (4, and 5 for its triggers). The What's sent drawer's
    categories equal the package's categories for the same run, item for item. An entry marked
    "Keep this entry out of AI reads" appears only in `omitted`, and none of its text, figures,
    money, details or notes appears anywhere in the package, derived series included. Every control
    that can reach the provider (the six triggers in Data and privacy → Egress) renders its egress
    line in the same view. _Check:_ a test on the builder (excluded figures absent from the
    serialised package, and computed facts equal a recompute without the excluded entries), a text
    diff of the drawer against the package JSON, and a Playwright walk over the six controls.
15. **Off by default** (4). A fresh account with an Anthropic key saved makes 0 provider requests
    while entries are saved and reviews' computed parts render, until the toggle is on and Run is
    tapped. _Check:_ the `journal.provider_request` counter and log lines over a scripted session.
16. **Costs recorded, caps enforced** (4). Every run row has token counts and `cost_micros`. With
    $0.10 of the monthly cap left, a run whose worst case is $0.75 isn't started and the page shows
    the cap line. After Delete journal, the month's spend is unchanged. _Check:_ a test, and a local
    run against a stub provider through `JOURNAL_ANTHROPIC_BASE_URL` (honoured only when `APP_ENV`
    isn't `prod`).
17. **No eviction** (4). With a review pinned, a refresh answered 500 leaves the review on the page
    with "AI unavailable · Anthropic returned an error. Your entries are unchanged." _Check:_
    Playwright `page.route`.
18. **Staging is whole and marked once** (1a, re-checked by every slice). On staging, every journal
    route answers from the demo transport, and none returns `demo_unavailable`. "Demo · sample data"
    appears once per page, in the bar. Each journal frame has `data-provenance="sample"` and exactly
    one "Sample" mark. A review run shows "No model was called" (from 4). _Check:_ Playwright text
    and attribute reads on `https://staging.convexa.pages.dev/positions/journal`, and on
    `/positions/review` and `/positions/rulebook` once their slices ship.
19. **Journal figures stay in the journal** (1a, re-checked by 2 to 5).
    `git grep -n -i journal -- apps/api/src/services/recommendation.rs apps/api/src/routes/recommendation.rs apps/dashboard/src/app/pages/ticker/widgets/ai-rec apps/dashboard/src/app/features/trading/model apps/dashboard/src/app/features/trading/outcomes apps/dashboard/src/app/features/alerts apps/dashboard/src/app/features/auth/RiskInputsSection.tsx apps/dashboard/src/app/features/auth/riskInputs.ts`
    prints nothing and exits 1 (it does today, at `48deb0d2`). The SPY desk's What's sent drawer
    lists no journal category, and no journal path writes a Settings risk input. _Check:_ run the
    grep and read its exit code; open the drawer.
20. **The plan check never verdicts** (2). On Plan a trade, every rule's segment starts unselected,
    no element in "Your rules" uses success colours, and Save works with every rule unanswered.
    _Check:_ Playwright.
21. **Phone and touch** (1a, re-checked by every slice). On every journal route that has shipped,
    at 390 and 393, in both schemes, `documentElement.scrollWidth == clientWidth`, and with a coarse
    pointer no interactive element is under 44px. _Check:_ by observation: a scratch Playwright probe
    run in Verification step 6 and recorded with the slice (the routes, the widths, the two numbers
    and the smallest tap target), not committed. The layout spec this once extended was retired
    (`.spire/clusters/tech/state/RETIRED.md:70`), and the repo writes no layout tests.
22. **Withdraw is real** (1a). After "Delete entry", the entry's `_ct` columns, snapshot, notes,
    details, checks and J1 output are null or gone. The tombstone shows "An entry written {date} was
    deleted on {date}.", and findings citing it read "out of date". _Check:_ a test, and a read of
    the local database row.
23. **Export round-trips, and an edit can't launder memory** (1b). Export then restore into an empty
    local journal gives the same entries, `written_at`s, figures, notes and rule versions. A second
    restore adds nothing ("N rows were already in your journal"). An exported entry whose body was
    edited by hand restores as kind Imported, written now, so recalled. _Check:_ a test.
24. **The dev store keeps entries** (1a). On a local API without `DATABASE_URL`, with
    `JOURNAL_ENCRYPTION_ACTIVE_KEY_ID` and `JOURNAL_ENCRYPTION_KEYS_JSON` set, an entry saved before a
    restart is returned after it. With them unset, Save shows "Journal storage isn’t set up on this
    server" and nothing is written. _Check:_ `npm run serve:api` with the variables (Verification,
    step 5), save, restart, `GET`; then once without them.
25. **The account-number warning** (1a). Typing "Acct 123456789" shows the warning before save, and
    Save still works with "Keep it". "$41,210.50" doesn't trigger it. _Check:_ Playwright.
26. **The sample adds up, and agrees with the demo** (1a). For each of the 12 sample snapshots,
    Σ(qty × mark × multiplier) + cash − margin loan = account value, to the cent. Every stock mark
    equals the demo catalog's close for that date (tolerance $0.00), and every option mark is at or
    above its intrinsic value at that close. No sample option has an expiry in the demo chain's
    `EXPIRIES` (`shared.ts:6`). _Check:_ a scratch script over `libs/api/src/lib/demo/journal.ts` and
    the catalog seeds, run once when the seed is written (not a committed test: it is authored
    data).
27. **The time zone and the snapshot date** (1a). An entry saved at 9:30 PM ET on Sep 29 about Sep 29
    is at the time; one saved at 12:30 AM ET on Sep 30 about Sep 29 is recalled. An About-date
    correction makes an entry recalled at once and never moves its snapshot's `as_of`. The Aug 4
    statement snapshot written Aug 21 sorts at Aug 4 in the index. _Check:_ tests.
28. **The journal's own key** (4). With his ticker-read preference set to OpenAI and both an OpenAI
    and an Anthropic key saved, a journal run's request goes to Anthropic with the journal's model.
    With `AI_REC_IN_APP_ENABLED` off, the journal still runs. With no Anthropic key, the run is "Not
    set up" and makes 0 requests. _Check:_ a test against the stub.
29. **Mostly from memory** (3, and 4 for its AI parts). A journal of 1 entry written at the time and
    10 recalled shows the "Mostly from memory" strip, decided rows at "0 of 0", happened rows counted,
    and, with AI on, no "About what you decided" finding. _Check:_ a text read on a local fixture.

## Verification

Risk-based, per CLAUDE.md. Tests are written for logic that can fail silently and cost something:
money arithmetic, the account boundary, data writes, parsers and import, the detector counts that
feed his rulebook, and the egress contract. Each owed test is mutation-checked: break the rule once
and see it go red.

**Owed tests** (beside the code):

- **Money arithmetic** (`services/journal/facts.rs`, and `libs/api/src/lib/journal/facts.ts` for
  the parity test):
  - margin used and excess liquidity, including a missing account value (`not recorded`, never a
    division) and a zero or negative one (`—`);
  - the chain-linked index with money in and with money out, on the worked example;
  - criterion 7's invariance, with the deposit before and after a same-day snapshot;
  - a snapshot with no account value is bridged, with money across the gap summed into the next
    step;
  - an account value at or below $0 breaks the chain: every later percent is `—`, and dollars carry
    on;
  - snapshot order by `as_of`: the Aug 4 statement written Aug 21 sorts at Aug 4 for the index, the
    high and "previous snapshot";
  - the recorded high with a recalled point;
  - where the money went (sums to the change net of money, and the remainder line);
  - planned risk for stock and a long option;
  - position P/L all or nothing;
  - display rounding half up (away from zero) at an exact edge (−24.85% → −24.9%), and the sample's
    −42.6056% → −42.6%;
  - **parity**: `facts.ts` and `facts.rs` give identical results on every fact they share, over the
    worked-example fixture and the edge-case fixtures above.
- **Recalled and dates:**
  - recalled is derived from the latest About-date correction (a correction flips it; a later one
    flips it back);
  - the America/New_York date at both sides of UTC midnight (criterion 27);
  - an About-date correction never moves a snapshot's `as_of`, and a Tidy split creates a recalled
    entry and a `recalled_span` without touching the original's snapshot.
- **Detectors** (`services/journal/detectors.rs`), because his rulebook is drawn from their counts:
  - each row's k and n on the seed (criterion 6);
  - recalled and imported entries, and `recalled_span`s, are excluded from every decided row;
  - a decided row uses only facts dated on or before the moment it describes (a later snapshot never
    changes an earlier add's % below average cost);
  - a row with nothing to count reads 0 of 0, and is still listed;
  - row 3 sees a pass only at a snapshot; row 6 skips a case with fewer than 3 earlier entries; row
    10 resolves on a full close or a pass and not on a trim.
- **The account boundary:**
  - the OpenAPI walk, failing on any journal operation not tagged owner;
  - `PUT` and `DELETE` arms in the tagging;
  - a query test showing one `user_id`'s rows invisible to another's session (the owner list can
    hold two emails).
- **Data writes:**
  - the store trait's writers are exactly insert, append and tombstone, on both stores (criterion
    2); a later note doesn't change the entry;
  - an idempotent create on a repeated `client_id`;
  - a correction supersedes and keeps the original;
  - a tombstone nulls every `_ct` column, keeps `written_at`, and purges the listed rows;
  - AAD binding (a ciphertext moved across rows or columns fails);
  - writes refused with no journal ring, and `from_env_prefixed` returns `None` with either variable
    missing (no ephemeral key);
  - a JSON dev store round-trip;
  - restore: a sealed entry keeps its `written_at`; an edited one lands as Imported (criterion 23);
  - Delete journal keeps `journal_ai_runs`' cost columns and nulls their content.
- **Parsers and import:**
  - the entry parser: tickers from his universe plus symbols he has used, money, percents,
    quantities ("200 sh", "3 contracts"), option notation ("QQQ 600P 12/18"), dates, action verbs;
  - the recalled-wording list, one case each;
  - the 9-digit scan (money with grouping or decimals excluded);
  - paste-positions parsing;
  - CSV mapping, with an `unrecognized` line kept and the duplicate hash;
  - the existing plain-decimal input rule is reused, not rewritten.
- **The egress contract:**
  - the package builder is deterministic (two builds give one `package_id`);
  - `omitted` lists excluded entries, no excluded text or figure appears anywhere in the package,
    and the package's computed facts equal a recompute without them (criterion 14);
  - the category table equals the drawer's list;
  - the journal resolver uses the Anthropic slot and the journal's models whatever the ticker
    preference, and ignores `AI_REC_IN_APP_ENABLED` (criterion 28);
  - the number check's seven mutations, number words included (criterion 12);
  - the advice and tone table (criterion 13), and that "suspect" isn't on the journal's list;
  - no rate field below 20 (criterion 10);
  - Rust Wilson equals `ledger.ts` at 3 cases with n ≥ 20, and Rust Brier equals `scoring.mjs` at 3
    cases;
  - the per-run cap refuses on the worst case and the monthly cap refuses, both before any request
    (the request counter stays at 0).
- **Contract:** `npm run api:contract:check`, with representatives for every journal operation and
  the widened owner probe.

No tests for layout, copy, the sample's wording or boards (CLAUDE.md: no UI, copy or snapshot
tests). The acceptance criteria above check those by observation, criterion 21 included. The eval
gate (The AI interaction) is not a unit test; it runs before slice 4 ships, and its result is
recorded with the slice.

**Commands** (check exit codes, not summaries; the shell is zsh, so use `$pipestatus` or no pipe):

1. `npx nx test api` → exit 0.
2. `npx nx test @convexa/dashboard`, `npx nx test @convexa/api` (the facts parity test) and
   `npx nx typecheck @convexa/dashboard` → exit 0 (Vitest doesn't typecheck).
3. `npm run api:contract:check` → exit 0.
4. `npm run verify` → exit 0 (needs `gitleaks`).
5. `npm run ports:free`, then `npm run serve:api` and `npm run serve:dashboard`.
   - The API needs the journal ring locally. Make a dev key with
     `openssl rand -base64 32 | tr '+/' '-_' | tr -d '='` and set
     `JOURNAL_ENCRYPTION_ACTIVE_KEY_ID=dev1` and `JOURNAL_ENCRYPTION_KEYS_JSON={"dev1":"<that key>"}`
     in the local env file, never committed (`apps/api/.env.example` lists the names only).
   - Sign in as the owner locally and walk the flows at 390 and 1440, dark and light.
   - Then `VITE_DATA_MODE=demo npm run serve:dashboard` for the sample, and the acceptance script on
     both.
6. The observation probes, recorded with the slice and not committed: criterion 21's overflow and
   tap probe on every shipped journal route at 390 and 393 in both schemes, and criterion 4's
   interaction count.
7. After deploy: the same script read-only against staging. On production, only the signed-out
   wall and a signed-in empty first run. No real entry is ever written by a script.

## Build plan

Overall size **XL**. Each slice ships alone, behind the owner gate, and slices 1a to 3 call no
model. Before step 1, record this spec's questions in
`design/src/screens/final/tracker-data.mjs` `OPEN_QUESTIONS` (the 2026-10-21 README's rule,
`README.md:260-272`).

| # | Step | Files likely touched | Size |
|---|---|---|---|
| 0 | **Design board** (BOARD BRIEF): the spec cards and boards, the pen icon in the design set, sample strings; regenerate | `design/src/screens/final/journal.mjs` (new), `journal-kit.mjs` (new), `index.mjs`, `design/src/lib.mjs` (`edit` icon), `design/src/data/journal-sample.mjs` (new) | M |
| 1a | **The notebook.** Migration `journal_core`. Owner-only routes (with the `PUT`/`DELETE` arms, the widened contract probe and the amended gate comments), the journal ring (`from_env_prefixed`, no ephemeral key) with row-bound AAD and the seal tag, and the JSON dev store on the same three-writer trait. The composer (text, kinds, About with `as_of`, margin-call mode, money in or out with its time, snapshot with carry-forward, source, sanity questions, the 9-digit warning, Keep out of AI reads). Seal, later notes, corrections, withdraw. The timeline (Written/About, ET dates, derived recalled), the entry page, the computed facts with their edge cases, the shared TypeScript facts module and its parity test, and the rail's account frame (value and figure strip). `SectionTabs` with Book · Journal, the routes and walls, sign-out with an unsent entry. The demo transport with slice 1a's part of the seed. The /privacy rows and key, and the backup-retention check for the delete copy. Owed tests: money, parity, recalled and dates, boundary, writes. | `apps/api/src/db/migrations.rs`, `routes/journal.rs` (new), `routes/mod.rs` (`OWNER_ONLY_OPERATIONS`, its doc comment and the arms), `services/journal/{mod,store,facts,crypto}.rs` (new), `services/auth/crypto.rs` (`from_env_prefixed` and the AAD functions), `config.rs` (the `OWNER_EMAILS` comment), `capacity/identity.rs`, `tools/api-contract.mjs` (owner → 403 for any method), `docs/product/ai-analyst/DESIGN.md` (an appended owner-gate amendment), `apps/api/.env.example` (names only; handed to the owner to commit), `apps/api/tests/fixtures/journal/worked-example.json` (new, synthetic); regenerated: `apps/api/openapi/*`, `libs/api/src/generated/schema.ts`; `libs/api/src/lib/convexa.ts`, `libs/api/src/lib/journal/facts.ts` and its spec (new), `libs/api/src/lib/demo/{transport,workspace,journal}.ts`; `apps/dashboard/src/app/app.tsx`, `pages/positions/journal/*` (new), `shared/ui/SectionTabs.tsx` (from `pages/research/ResearchTabs.tsx`), `features/auth/AuthContext.tsx` (the sign-out check), `pages/trust/PrivacyPage.tsx` | L |
| 1b | **The account path, positions and the way out.** The Path chart (three multiples, event rail, twin) and its drawer, `RealPositionRows` (typed positions and marks, leverage, loan to position value, P/L), the "Revisit due" line, export, restore and delete journal, the Settings › Journal panel (export, restore and delete), the ⌘K Write group (if open question 2 is approved). | `pages/positions/journal/AccountPath.tsx` (new), `features/journal/RealPositionRows.tsx` (new; a copy of the `LegFields` grid, importing only `multiplierFor`), `features/trading/positions/leg.ts` and `tradeEntry/LegFields.tsx` (`multiplierFor` moves, with a re-export), `routes/journal.rs`, `services/journal/store.rs` (restore), `features/auth/SettingsPage.tsx`, `shell/CommandPalette/CommandPalette.tsx` | M |
| 2 | **The rulebook, no model.** Migration `journal_rules`. Hand-written rules, numbering at activation, versions, pause and retire, Plan a trade with answers, readings, the projection and "Why go ahead anyway?". Adherence counts with the floor of 20. Print and Copy as text (open question 16). The Rulebook tab, the rail's Rulebook mini, the entry's Rules panel. Slice 2's part of the seed. | `routes/journal.rs`, `services/journal/rules.rs` (new), `pages/positions/rulebook/*` (new), `libs/api/src/lib/demo/journal.ts` | M |
| 3 | **The review, no model.** Migration `journal_review`. The entry parser and Tidy (with the split), suspicions and their Settings panel, the detector table with rows 3, 6 and 10 as defined, the week strip, where the money went, the event callout, the Review page's computed sections with "Save this week's review" and the "Mostly from memory" state, `POST /api/journal/reviews`, the Review tab and rail mini, the Rust Wilson and Brier. Owed parser and detector tests. Slice 3's part of the seed. | `services/journal/{parser,detectors,review,stats}.rs` (new), `routes/journal.rs`, `pages/positions/review/*` (new), `pages/positions/journal/Tidy.tsx` (new), `features/auth/SettingsPage.tsx` (suspicions), `tools/research-notes/scoring.mjs` (a header line naming the port), `libs/api/src/lib/demo/journal.ts` | L |
| 4 | **The AI.** Prerequisites: the DESIGN amendment (open question 4), the model and cap answers (open question 6), the strategies answer (open question 15), and the eval gate passing. Migration `journal_ai`. Settings consent, the model picker, caps; What's sent; `resolve_journal_key`; `complete_journal()` with streaming, structured output, usage, the per-request log line and counter, and the non-production base-URL override; J1 and J2 with J3 drafts; the fact catalog, the number check (number words, count words, the allowlist, draft limits), the advice and tone scan, the caps on the worst case; findings, questions, drafts, corrections, the stale and failure states; the entry's AI panel with its egress line. Slice 4's part of the seed. | `services/llm.rs`, `services/journal/{package,ai,check,scan}.rs` (new), `routes/journal.rs`, `pages/positions/review/*`, `features/auth/SettingsPage.tsx`, `docs/product/ai-analyst/DESIGN.md` (appended amendment), an eval set under `apps/api/tests/fixtures/journal_eval/` (synthetic, `illustrative: true`), `libs/api/src/lib/demo/journal.ts` | L |
| 5 | **The rest.** Paste and CSV import (owed parser tests), reading on every save with its egress line, the bulk read offer with its egress line and the Batch API, and the Monday auto-run with its toggle line and after-run notice (open question 16 recommends deferring CSV mapping and the auto-run). | `pages/positions/journal/Import.tsx` (new), `services/journal/import.rs` (new), `routes/journal.rs`, `features/auth/SettingsPage.tsx` | M |
| 6 | **Verification:** the commands above, the acceptance script, the observation probes, screenshots at 390 and 1440 in both schemes on both builds | `tmp/ux-audit/…` (scratch) | S |

Revisit reminders no longer go through Alerts: the Alerts `note` kind is "Note coming due" for
research notes and SEC filings (`features/alerts/kinds.ts:84-90`), and its rules live in plaintext
`localStorage` (`features/alerts/store.ts:1-4`), which would put a journal symbol and date outside
the journal. The "Revisit due" line on the timeline (slice 1b) replaces them.

### What each slice shows

A surface whose slice hasn't shipped is **not drawn**; nothing links to it, and no state stands in
for it.

| Surface | 1a | 1b | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| Tab band | Book · Journal | same | + Rulebook | + Review | same | same |
| Rail: account frame | value and figure strip | + "Open the account path" | same | same | same | same |
| Rail: Rulebook mini | not drawn | not drawn | drawn | drawn | drawn | drawn |
| Rail: Review mini | not drawn | not drawn | not drawn | drawn | drawn | drawn |
| First-run links | "Write about an earlier day" | same | same | + "Name what you think goes wrong" | same | + "Bring in past trades" |
| Composer kind chips | all but Plan a trade | same | + Plan a trade | same | same | same |
| Entry page panels | Snapshot (figures, correct a figure) | + positions table | + Rules | + Details found | + AI read | same |
| Review page | not drawn | not drawn | not drawn | computed sections, "Save this week's review" | + egress, Run, AI sections | + after-run notice |
| Settings › Journal | not drawn | export, restore, delete | same | + suspicions | + AI toggle, models, Monday offer, caps | + read on save, auto-run |
| Tidy, Import | not drawn | not drawn | not drawn | Tidy | same | + Import |
| Demo seed | entries, snapshots, money, notes, correction | same | + rules and plan answers | + suspicions, details, review computed parts | + AI parts | + sample paste |

Copy that names a later surface is held back with it: the Review page's "Turn reads on in Settings ›
Journal" appears only from slice 4, and "Choose a model…" links to a control that ships in the same
slice.

**Shared files.** Specs 1, 2 and 4 of 2026-10-21 also edit `ChartFrame.tsx` and the shell. Rebase
on them; never merge `design/canvas` or `design/site` by hand, regenerate them. The migration numbers
are the next free ones at build time; other workflows may take 14 first.

## BOARD BRIEF

For the boards stage. Eight rows, all `section: 'planned'`, so they land on the "Planned · not built"
page (`index.mjs:20-52`). Board files are named `F<Key><Id>`, and each row also has its spec card,
built with `specBody` (`spec.mjs:44-78`): widgets, states, phone, acceptance, built, rulings and
code.

**Data on the boards.**

- Staging boards draw the Sample journal: Oct 7, 2026, dashed frames with the 8px steel hatch band,
  one "Sample journal" chip per frame, and the demo bar.
- Production boards draw either the wall, the first run, or the sample trader's figures in solid
  frames, with the board-only note "Figures illustrative; production shows only the owner’s entries"
  (P-4: board-only).
- No board ever holds the owner's real data.

### Row `journal-timeline` · "Journal · Timeline" (`/positions/journal`)

| Board | Width | What it shows | States drawn |
|---|---|---|---|
| Staging · demo account | 1440 | Tab band (Journal current), header with amber "Write entry", quick capture, day groups Sep 29 – Oct 6 (margin-call card, money-in card, plan card, recalled card "Written Aug 21 · about Aug 4"), rail: account frame (title finding, −42.6%), rulebook mini (R3 "above"), review mini, filters | Loaded |
| Production · signed out | 1440 | The private-testing wall: "Sign in to open your journal", "See it on the demo →" | Sign in |
| Production · first run | 1440 | "Start with today." empty state, metric-named rail frames | First run |
| Production · illustrative | 1440 | The staging layout in solid frames with the board note | Loaded |
| Phone · staging | 390 | Tab rail, account peek row, cards with a 3-line clamp, sticky bottom bar ("Write entry", "Margin call") | Loaded |
| Light · staging | 1440 | The staging board in light | Loaded |
| States | 1440 | Loading skeletons; Couldn’t load; Not on your account yet (card strip); Sign-out with an unsent entry; Storage not set up; Not the owner; staging marking reference | 7 states |

### Row `journal-compose` · "Journal · New entry" (`/positions/journal/new`)

| Board | Width | What it shows | States drawn |
|---|---|---|---|
| Staging · normal day | 1440 | Editor with a Trimmed entry, snapshot column "Carried from Sep 30 · 2 days old" with Update open, Computed box, source segment | Carried |
| Margin call mode | 1440 | The three-number row, the "Nothing here is graded" strip, cross-check lines (matching), after-save confirmation inset | Saved |
| Plan a trade | 1440 | "Your rules" with R3 (reading "84% · limit 50% · above", projection 84% → 88%) and R2; a No answer with "Why go ahead anyway?" | Unanswered → answered |
| Phone · margin call | 390 | Full-screen page, stacked 44px fields, the keyboard toolbar | Typing |
| Phone · plan a trade | 390 | Rules first with 44px segments, sticky "Save plan" | — |
| Light · staging | 1440 | The normal-day board in light | — |
| States | 1440 | Blank; Draft restored; No earlier snapshot; Carried and old (plain text); Validating ("Use a plain number…"); Sanity question; Account-number warning; Saving; Save failed; Offline; Stale snapshot strip (plan); Cross-check mismatch (two neutral lines); No rules (plan); Money timing ("Counted before your 3:40 PM numbers") | 14 states |

### Row `journal-entry` · "Journal · Entry" (`/positions/journal/:id`)

| Board | Width | What it shows | States drawn |
|---|---|---|---|
| Staging · the Sep 29 call | 1440 | Body, later note "Met on Sep 30…", snapshot with call and Computed lines, details found, AI read (digest, Cited in, the per-entry egress line), rules panel, foot with Delete entry… | Read |
| Staging · recalled entry | 1440 | "Written Aug 21 about Aug 4" strip, a Statement snapshot, the correction "Margin loan $11,890 → corrected to $11,980 on Aug 22" | Corrected |
| Phone · staging | 390 | Stacked body and accordions; the What's sent sheet's peek row | — |
| Light · staging | 1440 | The Sep 29 board in light | — |
| States | 1440 | AI read: Off · No key · Model unset · Not read yet · Reading · Held · Didn’t pass the check · Request failure · Refused · Cap reached · Kept out · Sample; page: Deleted tombstone, Loading, Couldn’t load; delete inline confirm | 16 states |

### Row `journal-review` · "Journal · Weekly review" (`/positions/review`)

| Board | Width | What it shows | States drawn |
|---|---|---|---|
| Staging · Oct 7 review | 1440 | Egress sentence, amber Run, week strip, the Path (three multiples, event rail), the event callout, where the money went, the 10-row detector table with suspicions first and the caption, 4 findings with Cut the other way, 3 questions, rules this review, rail (How this ran, suspicions, past reviews, Tidy) | Produced |
| Production · AI off | 1440 | The computed sections only, with "AI reads are off. The counts above need no AI…" | Computed only |
| Production · mostly from memory | 1440 | His likely first weeks: the "Mostly from memory" strip ("9 of 11"), the week in numbers, the Path with mostly hollow points, events, where the money went, decided rows at "0 of 0 · counts start with entries written at the time", happened rows counted, findings "About what happened" only, questions back | Mostly from memory |
| Phone · staging | 390 | Egress and Run first, strip as a 2-column grid, detector cards, findings, collapsed How this ran | — |
| Light · staging | 1440 | The Oct 7 board in light | — |
| States | 1440 | Too little written; Computed only, slice 3 ("Save this week’s review"); No key; Ready; Running (named steps and result-shaped skeletons); Stale strip over a pinned review; Didn’t pass the check (failed draft collapsed); Request failure (pinned stays); Refused; Already running; Daily limit; Monthly cap; Over the per-run limit (worst case); a detector row at n ≥ 20 (bar with Wilson whisker, "63% (43–79%) · n = 24"); Sample run | 15 states |

### Row `journal-rulebook` · "Journal · Rulebook" (`/positions/rulebook`, `/:ruleId`, `/print`)

| Board | Width | What it shows | States drawn |
|---|---|---|---|
| Staging · rulebook | 1440 | Two unnumbered drafts (Because, sample state, Check by asking, limit `not set`, Why this rule), Active R2 and R3 (asks as dots, "too few to judge", R2's limit labelled as Convexa's pattern threshold, R3's reading "above"), Retired R1 collapsed, rail (Plan a trade) | Loaded |
| Staging · rule R2 | 1440 | Version timeline v1 → v2, his why, origin finding with cited entries, check table, counts block | Active |
| Print card | 1440 (A4 inset) | One page of active rules, no figures | — |
| Phone · staging | 390 | Accordions, rule cards, row menu as a bottom sheet | — |
| Light · staging | 1440 | The rulebook in light | — |
| States | 1440 | Empty; Drafts only; Stale draft; Adopt in progress (Why required); Not for me with reason; Paused; Retired; Declined draft read-only; Loading; Couldn’t load | 10 states |

### Row `journal-tidy-import` · "Journal · Tidy up and import" (`/positions/journal/tidy`, `/import`)

| Board | Width | What it shows | States drawn |
|---|---|---|---|
| Staging · Tidy | 1440 | Panels per entry with highlighted spans, Keep/Fix/Not right, a position-from-prose prompt, the recalled-wording offer (Split · Mark the whole entry) | Loaded |
| Staging · Import | 1440 | Three steps: choose, preview with `unrecognized` lines and a mapping control, file them | Parsed |
| Phone · staging | 390 | Tidy cards and the import steps stacked | — |
| States | 1440 | Tidy: Empty, Parser only, Couldn’t load. Import: Parsing, Duplicates skipped, Parse failed, Saved | 7 states |

### Row `journal-overlays` · "Journal · Drawers and sheets"

| Board | Width | What it shows | States drawn |
|---|---|---|---|
| Finding drawer · staging | 1440 | 560 drawer over the review: evidence rows with spans, How it was counted, Cut the other way, What it doesn't use, the three correction choices | Produced |
| What's sent drawer · staging | 1440 | 520 drawer: categories, "Convexa never adds…", Never sent (kept-out entries and their figures), estimate and worst case, package id, Copy all | Ready |
| Edit positions dialog · staging | 1440 | 760 dialog on `RealPositionRows` (legs grid, marks), no SIMULATED chip, no order control | — |
| Account path drawer · staging | 1440 | 760 drawer with the full Path and its table twin open | — |
| Phone · bottom sheets | 390 | Finding, What's sent, Edit positions, rule menu, filters, Update numbers: each with grab handle, peek row, actions stacked at 44px | — |
| States | 1440 | Finding: cited entry deleted, past corrections listed; What's sent: AI off, after a run (stored usage), Copied; delete journal typed confirm | 6 states |

### Row `journal-settings` · "Journal · Settings panel" (`/settings#journal`)

| Board | Width | What it shows | States drawn |
|---|---|---|---|
| Staging · demo account | 1440 | The panel: egress sentence naming every trigger, toggle, models, sub-toggles each with its egress line, caps with "This month", suspicions, export, restore, Delete journal… | Sample (writes refused) |
| Phone · production | 390 | The panel stacked | On |
| States | 1440 | Off; On; No key ("Add an Anthropic key in Settings › AI first"); Cap reached; Exporting; Restoring; Delete confirm; Signed out | 8 states |

**Count:** 44 boards (7 + 7 + 5 + 6 + 6 + 4 + 6 + 3) plus 8 spec cards. Open question 16 would drop the print card board if print is deferred.

## Open questions for the owner

1. **Should the journal live in Positions' tabs or get a sixth nav link?**
   - Rule 19 allows five links (`DESIGN_SYSTEM.md:176`). Research joined only by amendment.
   - Positions is already behind the sign-in wall and already planned to show real holdings, and
     TopNav lights it for every `/positions/*` path.
   - _Recommended: tabs on Positions (Book · Journal · Review · Rulebook)._ Revisit with a nav
     amendment after four weeks if he writes daily and the extra click costs him.
   - Holds up step 0 and slice 1a's routes.
2. **Approve the five canon rows in Design → Canon events?** They are:
   - the pen glyph;
   - the second use of section tabs;
   - a ⌘K "Write" group (`PALETTE_COMMANDS` and `GO_TO` unchanged);
   - rule 16's scope for a verdict-free read;
   - the [journal-figures-stay-in-journal] record.

   Each is an Amendments row, appended, never rewritten.
   - _Recommended: approve all five as written._ The ⌘K group is the only one that can be dropped
     without loss; the phone's bottom bar covers capture.
   - Holds up step 0 (pen, tabs), slice 1b (⌘K) and slice 4 (rule 16 scope).
3. **Keep journal figures out of every other store, as a written rule, while AC-29a stays as
   written?**
   - The journal holds exactly what AC-29a keeps out of decision records.
   - _Recommended: yes._ Its own store, its own rule, and no exit. The earlier draft's Settings
     hand-off is cut: no closed metric matched a Settings slot, and Account size would have carried
     his real balance into every ticker AI read.
   - Holds up slice 1a.
4. **Send his real positions, balances, margin and words to his AI provider, by a DESIGN
   amendment?**
   - Today's line is "Simulated only" (`DESIGN.md:425`).
   - The amendment would:
     - add the J1–J4 family;
     - scope "Simulated only" to market questions;
     - add the licence value `owner_personal`;
     - record that this analysis is never opened to other accounts.
   - _Recommended: yes, with reads off by default, per-entry exclusion, and the eval gate first._
     Append the amendment under DESIGN.md's Amendments, and one line under §7 recording that the J
     family is sequenced outside Q1–Q14 (the precedent of spec 7's Q4).
   - Holds up slice 4 only. Slices 1a to 3 need no model.
5. **Anthropic only for journal reads at first?**
   - The cost table, caching, structured output and refusal handling are specified for Anthropic.
     The other BYO providers (`llm_catalog.rs:8`) would each need their own schema and usage
     mapping.
   - _Recommended: Anthropic only in slice 4._ The others show "Not set up · journal reads run on
     an Anthropic key for now".
   - Holds up slice 4.
6. **Which models, and what caps?**
   - _Recommended:_
     - Sonnet 5.5 for entry reads (≈ $0.011–0.020 each);
     - Opus 5.5 at effort `high` for the review (≈ $0.21);
     - about $1.40 a month at two entries a trading day;
     - caps of $1.00 per run, checked against the worst case ($0.75 for a review at the sample's
       size), $5.00 a month, and 3 reviews and 60 entry reads a day;
     - no automatic fallback to another model.
   - Sonnet for both would halve the review's cost; decide after the eval compares them on the
     golden set.
   - Holds up slice 4.
7. **What margin figure does your broker show?**
   - "Margin used" here is margin loan ÷ account value. 100% means he has borrowed as much as the
     account is worth.
   - Some brokers show loan ÷ position value, or leverage. In the sample, Sep 18 reads 115% one way
     and 53.6% the other.
   - _Recommended: keep loan ÷ account value as "Margin used", show leverage beside it and loan ÷
     position value in the ⓘ when positions are typed, and name his broker's own figure in the ⓘ
     once he tells us which it is._
   - Holds up slice 1a's copy.
8. **Measure "down from the high" with money in and out taken out?**
   - _Recommended: yes, the chain-linked percent as the headline._ Beside it go "lost since the
     high, net of money in and out" in dollars, and the raw "account value alone" in the ⓘ.
   - Simple subtraction would let a deposit made to meet a call hide part of the loss.
   - Holds up slice 1a.
9. **Should saved text be correctable for a few minutes?**
   - Sealing protects "what I thought at the time", and a typo becomes permanent.
   - Figures already get "Correct a figure", which keeps the original.
   - _Recommended: no text window at launch; later notes only._ Revisit after a month. If he wants
     one, 10 minutes, labelled "Corrected 4 min later", with the original kept.
   - Holds up slice 1a.
10. **Keep the floor of 20 for every rate, knowing most rows will read "counted; rates start at
    20" for months?**
    - One trader rarely reaches 20 of anything quickly.
    - _Recommended: keep 20_, the canon's floor (`outcomes/types.ts:20`). The early value comes from
      what needs no rate: events and their dollars, where the money went, counts with citations,
      the gap between his words and his numbers, and questions back.
    - Holds up slice 3.
11. **Read entries at review time, with reading on every save opt-in?**
    - Per-save reads cost more (cold cache) and add per-entry noise.
    - _Recommended: yes._ Margin-call entries are never read on save either way.
    - Holds up slice 4.
12. **Is the not-the-owner wall left without a state word?**
    - P-2 is closed and has no "owner only" word. Sign-ups are closed, so the wall is rare.
    - _Recommended: a wall with its sentence and no tag._ No amendment.
    - Holds up slice 1a.
13. **Build the journal ahead of the analyst roadmap?**
    - DESIGN.md's phases cover Q1–Q14 about markets. The journal is a separate track whose model
      slice has its own eval gate.
    - _Recommended: yes, slices 1a to 3 now (no model), and slice 4 after its eval passes._ Its runs
      and caps live in its own table, so it doesn't wait on Phase 0's `analyst_answers` or per-user
      cap.
    - Holds up the sequencing of every slice.
14. **Re-run the two judge lenses that never saw the Rulebook Loop?**
    - Two of the three lenses didn't receive its text, and one scored Ledger & Path on partial text.
      The one lens that saw all three ranked the Rulebook Loop first, 76 against 75 (How this design
      was chosen).
    - _Recommended: yes, before step 0._ Two lens runs on the full texts are cheap next to building
      on an incomplete comparison. If the Rulebook Loop wins, this spec's record, facts, privacy and
      AI sections carry over; what changes is the home screen (rules first instead of the notebook).
    - Holds up step 0.
15. **What does "strategies" mean to you?**
    - The request asks the AI to "gather insights and strategies". This spec reads that as
      **process** strategies drawn from his own entries (how he sizes, when he borrows, when he
      exits, how he plans) and keeps **market** strategies (what to buy, which setups, when to get
      in) out of the journal's AI.
    - The reason isn't compliance. DESIGN.md §6 says that with no other users "there is no client
      relationship and no adviser question" (`DESIGN.md:422-423`). The reason is evidence: the
      journal holds one account over a few months, the number check can verify a count of his own
      behaviour but not a claim about a market, and market reads already have a home in the
      analyst's question family, cited to market data.
    - _Recommended: process strategies only, as rule drafts and questions back;_ if he wants market
      strategies, they belong to the analyst roadmap, which can read his rulebook as a constraint.
    - Holds up slice 4's prompt and the eval bar.
16. **Defer the parts a single user won't reach for months?**
    - Most rows will read "counted; rates start at 20" for months (open question 10), and the
      journal has one user.
    - _Recommended: defer to a later spec_ the printable rulebook card, CSV column mapping (paste
      stays) and the Monday auto-run, and drop their boards. **Keep** the n ≥ 20 rate path and row
      10: each is a few lines over code that criteria 6 and 10 already require, and removing them
      would change the fixed table's count of 10.
    - If deferred, slices 2 and 5 shrink, and the board count falls by one.
    - Holds up slices 2 and 5.
