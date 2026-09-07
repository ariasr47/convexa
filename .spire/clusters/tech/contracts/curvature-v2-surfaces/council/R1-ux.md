# R1 — ux position: curvature-v2-surfaces

## Position

### 0. What I read at source, and the five things it corrects

The BRIEF verified five facts and told me a sixth phase's brief got three wrong. I read the twelve
surfaces before writing copy. Six more facts are wrong or missing in what this phase inherited, and
four of them change what the states must be.

| # | Claim in the inherited record | What the code says |
|---|---|---|
| 1 | BRIEF: "the **settings rail** → tabs at 900 … brought under the same responsive discipline" | **There is no settings rail.** `SettingsPage.tsx:156` is a single `Container maxWidth="sm"` at 640px with five stacked `PanelCard`s. The rail exists only in the design (`design/src/screens/settings.mjs:28-31`). "Bringing it under responsive discipline" is **building it**, not collapsing it. |
| 2 | BRIEF invariant watch: "Scanner rows and positions rows are **snapshot** surfaces and must never wear a live mark" | The scanner opens a **real SSE** (`useLivePrices.ts:57`, `/api/stream/prices`) and already says `Prices live` (`labels.ts:25`). The positions page opens a **real SSE** (`PositionsPage.tsx:118`) and the approved canvas draws a **live chip with a dot on every live-marked position row** (`design/src/screens/positions.mjs:21,64,81`). The BRIEF sentence and the canvas contradict each other. §3 below is my resolution. |
| 3 | Phase-1 ruling 6: "AC-35 is then **page-wide** on the ticker surface and **true**" | False today. Ruling 6 fixed six *widget-internal* ⓘ sites; the **`Widget` frame's own ⓘ was never converted** — `Widget.tsx:245-249` still renders a bare `InfoOutlinedIcon` inside a hover `Tooltip` with no focusable host, at **seven live call sites** including five of the eight quiet-band widgets (`off-exchange-blocks/OffExchangeBlocks.tsx:39`, `term-structure/TermStructure.tsx:34`, `market-context/MarketContext.tsx:417`, `iv-rank/IvRank.tsx:276`, `fresh-positioning/FreshPositioning.tsx:38`, `dealer-flow-projection/DealerFlowProjection.tsx:159`, `structure-hero/StructureHeroPanel.tsx:216`). |
| 4 | BRIEF: the quiet band gains "**register enforcement**" | Four of the eight contain **zero mono figures and, in two cases, zero figures at all**. `Setups.tsx` renders a name, a chip and a rationale — nothing to convert. `term-structure`, `off-exchange-blocks` and `setups` carry no `monoFontFamily` anywhere. Register enforcement on them is a *decision about whether their numbers become figures*, not a conversion. |
| 5 | Phase-1 decisions ruling 4 closed the radius debt | The sweep was numeric-only, and `radius-scale.spec.ts:72-84` only scans numeric values. **String radii survived**: `Scanner.tsx:52`, `ScanTable.tsx:289`, `ScanCard.tsx:70` all render `'10px'` panels against the declared panel role of **12**; `SettingsPage.tsx:67` renders `borderRadius: 2.5` = **30px** (2.5 × the now-12 `shape.borderRadius`) and passes the guard because 2.5 ≤ 3. |
| 6 | `useLivePrices.ts:16-17`: "the last known prices are KEPT, **dimmed by the caller**" | **No caller dims them.** `ScanTableProps` (`ScanTable.tsx:47-60`) and `ScanCardProps` (`ScanCard.tsx:30-35`) take no offline input; `Scanner.tsx:230-239` passes none. The only offline surfacing on the whole page is one header string swap at `Scanner.tsx:144`. A dropped price stream leaves a retained live price rendering at **full strength, indistinguishable from a fresh tick**, forever. The canvas requires the opposite (`design/src/screens/scanner.mjs:107`: "Prices dim and the cadence header says *Prices offline · showing last known*"). |

### 1. One state vocabulary for all twelve surfaces — 19 states

I am not inventing a second system. The **nine figure states already ship** in `FigureCell.tsx:252-300`
with distinct `data-figure-state` markers; I adopt them verbatim and add **ten panel states** so a
surface's own condition is nameable without touching a figure.

**Figure states (F1–F9) — shipped, verified at `FigureCell.tsx`.**

| # | `data-figure-state` | Renders | Caption | Source |
|---|---|---|---|---|
| F1 | `default` | Mono figure, no dot | caller's basis line | `:297,299` |
| F2 | `loading` | `StatSkeleton`, shimmer, **no numerals** | none | `:339-353` |
| F3 | `live` | Mono figure **+ label-row dot** | caller's basis line | `:297-298` |
| F4 | `offline-retained` | pause icon + retained figure @50% | `offline · last known` | `:260-268` |
| F5 | `offline-bare` | pause icon + a member of the nine @50%, Sans | `offline` | `:269-277` |
| F6 | `replay` | Mono full strength, **no dot, no pause** | `session replay` | `:279-283` |
| F7 | `empty` | `—`, Sans, 15px fixed | caller's basis line | `:284-288` |
| F8 | `unavailable` | any other member of the nine, Sans, 15px fixed | caller's basis line | `:284-288` |
| F9 | `untraced` | Sans figure **+ dotted rule** | `{assertedBy} · untraced` | `:289-294` |

Two properties I will hold every call site to, because they are what make the register real:
`register` is required with no default (`:166`), and the literal branch is **always Sans whatever
`register` says** (`:288`) — so a not-a-number can never enter the mono figure register, which is the
inversion phase-1 ruling 3 exists to prevent.

**Panel states (P1–P10) — one set, per surface.**

| # | State | What the user sees | What must NOT happen |
|---|---|---|---|
| P1 | cold load | skeleton, zero numerals | never appears after the first read |
| P2 | ready | the surface | — |
| P3 | **checked-and-empty** | "we looked; there is nothing" | must not read as P4 |
| P4 | **never-checked** | "we do not have this" | must not assert a market fact |
| P5 | filtered-empty | "your filter excludes everything" | must not read as P3 |
| P6 | degraded-with-data | warning strip **over intact rows** | rows never blank |
| P7 | stream-offline | live-derived figures → F4/F5; static figures unchanged | static data must not dim |
| P8 | cold-start failure | error + one retry | the only blank screen |
| P9 | gated / signed-out | writes refused, reads intact | must not claim account persistence |
| P10 | write-refused (faulted durable store) | banner; **nothing dims, no pause mark** | faulted must not look like offline (`PositionRow.tsx:122-126`) |

Which surface can enter which: **scanner** P1·P2·P3·P4·P5·P6·P7 · **positions** P2·P3·P7·P9·P10 ·
**settings** P1·P2·P9 · **alerts** P2·P3·P4·P9 · **quiet band** P2·P3·P4·P7(never — see §3).

### 2. Per surface

#### 2.1 Scanner — `pages/scanner/`

*User:* a trader triaging the tracked universe. *Job:* "which name deserves the deep-dive right now."
*Structure:* head (identity + the two-speed basis) → toolbar (view, filters, density) → the 11-column
table ≥ the card threshold, cards below → per-row status + as-of.

**Two data ages on one row, and only one of them may claim liveness.** Price is streamed; score,
tier, regime, flip, walls and as-of are swept. That is already the page's stated design
(`useLivePrices.ts:5-7`) and the canvas's (`design/src/screens/scanner.mjs:69`).

| Datum | Cell | States it can enter |
|---|---|---|
| Price | `FigureCell register="traced"` | F1 (swept price, no live tick yet) · F3 (live tick, stream delivering) · **F4** (stream down, live price retained) · F7 (`—`) |
| Chg %, Score, Flip, Walls | `FigureCell register="traced" live={NOT_LIVE}` | F1 · F7 |
| Tier / Regime / Vol | closed-lookup chip or label | present · F7 · **F8 `unavailable`** on a lookup miss |
| As-of, Status | caption + chip | — |

**Copy, exact:**

- Cadence header, delivering: `Prices live · structure ~3 min · hot names sooner` — unchanged
  (`labels.ts:25`), plus the signal dot the canvas draws (`scanner.mjs:69`), **gated on the same
  predicate that licenses an F3 price**.
- Cadence header, stream down: `Prices offline · showing last known · structure ~3 min` — unchanged
  (`labels.ts:32`) and now **actually true**, because the rows dim.
- New foot line, table and cards: `Per-row age is the structure snapshot, never the price.`
  (verbatim from `scanner.mjs:90`).
- Status chips lose the `⚠` **character**: `'⚠ Stale'` → `Stale`, `'⚠ Error'` → `Error`
  (`labels.ts:205,212`). Canon's Icons row is explicit that a typographic truth mark is a stand-in and
  the app must render the stroke icon; rule 5 already requires warning + icon always. The tone and the
  tips are unchanged.
- **A closed-lookup miss stops rendering `—`.** `ScanCells.tsx:167` (`{text ?? EM_DASH}`) collapses
  "the wire sent null" and "the wire sent an enum this build does not know" into one literal. The
  second is F8 `unavailable`, with the tip the page **already wrote for exactly this case**:
  *"This row reported a state this build does not recognize. Treating it as unavailable."*
  (`labels.ts:228`). I am reusing a shipped member and a shipped sentence, not minting anything.
- I do **not** adopt the canvas's 13-column re-cut (`scanner.mjs:23`) or its amber score bar
  (`scanner.mjs:35`). The BRIEF scopes this phase to the shipped 11-column set; re-cutting columns is
  a product decision I will raise at R2, not take here.

#### 2.2 Positions — `pages/positions/` + `features/trading/positions/`

*User:* the same trader holding a paper book. *Job:* "what am I holding, what is it worth, and how
much of that number can I trust." *Structure:* header (identity + Net P/L) → toolbar → table/cards →
the static Track record.

**The record/mark split is the whole surface.** Record fields (contract, structure line, qty, net
entry, max loss, expiry, status) are durable and never dim — `PositionRow.tsx:10-12` already says so.
Mark fields (mark, P/L, P/L %, Δ entry, session Δ, trend) are live-derived.

**Three defects the states must fix:**

1. **A fabricated zero on the page's biggest figure.** `PositionsPage.tsx:147-154` sums only rows
   where `pl_dollar != null`. When **every** mark fails the reduce returns `0`, `formatNetPl(0)`
   (`:77`) renders `+$0`, and `:189` paints it **`success.main` green**. "Net P/L (open) +$0" in green
   is a total mark failure wearing the costume of a flat book. Required: when no open row is marked
   the figure is **F8 `unavailable`**, never a number; when some are, the label keeps its word but
   gains a mandatory coverage caption `{n} of {m} open marked` so the total never silently under-reports.
2. **A dim with no reason.** `PositionsPage.tsx:190` sets `opacity: 0.5` on a stream drop with no
   pause mark and no caption. That is F4's costume without F4's disclosure. As a `FigureCell` it is
   F4 (`offline · last known`) when a retained total exists and F5 otherwise.
3. **The pause glyph is a character.** `PositionRow.tsx:68` (`const OFFLINE = '⏸ offline'`) and the
   inline `⏸` at `:378,388` are exactly what the canon's Icons row forbids; `FigureCell` already
   renders a real `PauseIcon` (`FigureCell.tsx:154-156`). The conversion deletes the glyph.

**The three positions-side members stay non-synonymous — and one of them must stay absent.**

| Member | Means | Ships at | On the sim book |
|---|---|---|---|
| `not recorded` | the saved record never held this fact | `PositionRow.tsx:166` + `NOT_RECORDED_TIP` (`labels.ts:121-124`) | yes |
| `no basis` | the denominator is about zero while the dollar figure beside it renders fine | `labels.ts:126-136` | yes |
| `not provided` | **the feed did not send it** | `broker/brokerView.ts` | **never** |

`notANumber.ts:15-16` records that the broker view substitutes `NOT_RECORDED → NOT_PROVIDED` *per
surface by design*. So the honest, positively-observable non-synonymy criterion is: the sim book
renders `not recorded` and never `not provided`; the broker view renders `not provided` and never
`not recorded`; `no basis` appears only on the `pl_pct` cell and never on a dollar figure. That is
three checkable facts, not a count — matching ruling 3's "closure and non-synonymy, never a count".

One more copy note: the four literals today render `variant="body2"` at `text.disabled`
(`PositionRow.tsx:145-152`); `FigureCell`'s literal branch renders 15px Sans at `text.primary`
(`:221,226`). That is a **visible change to shipped copy treatment** and it is the correct one — a
literal is a statement, not a greyed-out placeholder — but it must be reviewed, not slipped in.

#### 2.3 Settings — `features/auth/SettingsPage.tsx`

*User:* the account holder. *Job:* "change one thing and know it stuck." *Structure:* per the canvas,
**rail (220) + content column (760)**, rail → horizontal tabs at **900** (canon Tokens breakpoints;
`settings.mjs:15` uses `max-width: 899px`, which agrees). Note `responsive-spec.mjs:27` places the
collapse in the 768–999 band — the canon's 900 wins and the design's own two files disagree; I am
taking 900 and flagging it.

Rail sections, in the shipped panel order and named from the shipped headings —
**Account · Preferences · Risk inputs · AI providers · Brokerage** (`SettingsPage.tsx:170,229,356,361,366`
= `settings.mjs:29`). The panel order is already load-bearing: `:226-228` records that a trader input
must not be grouped with credentials. The rail must not reorder it.

**States and copy:**

- **P1 cold load.** Today `disabled={!auth.ready}` (`:247,275,289`) silently freezes every control
  with no explanation. Copy: one line above the Preferences fields, `Checking your session…`,
  removed the moment `auth.ready` flips.
- **P9 anonymous.** Already honest (`:164`, `C.subtitleAnonymous`). Unchanged.
- **Saved confirmation is green today and canon bans that.** `:387` is
  `<Alert severity="success">`. Canon Banned, v2 row: *"Green/red on status chips, success states or
  hit rates."* The word `Saved` stays; the green goes — a neutral snackbar with the check icon. The
  save-**error** alert at `:344` I am **not** unilaterally recolouring: an error is arguably a true
  error state rather than a status chip, and I would rather raise it than guess. R2 conflict, §"Risks".
- The 30px panel radius at `:67` (`borderRadius: 2.5` × 12) is off the declared panel role of 12.

#### 2.4 Alerts — `pages/alerts/AlertsPage.tsx` (242 lines; the least layout, the most copy debt)

*User:* a trader who wants to be told when structure crosses. *Job:* "arm a rule and trust what it
says." *Structure:* head → composer → Rules → Recent.

This surface is where my defining failure mode is live in four places:

| Site | What it renders | Why it is wrong |
|---|---|---|
| `AlertsPage.tsx:189` | `` `${r.symbol} · ${r.kind}` `` → **`SPY · score_gate`** | The raw wire enum, in the trader-visible label, while the closed `KINDS` lookup sits nine lines above it at `:21-25`. `[digested-labels-not-raw-dump]`: the FE renders through a closed lookup and **never re-derives**. |
| `AlertsPage.tsx:193` | `` {r.level ?? 'level'} `` → **`gamma_flip`**, or the word **`level`** | Raw enum again, and `'level'` is a tenth absence literal outside the closed nine. |
| `AlertsPage.tsx:192` | `` `≥ ${r.scoreMin ?? 60}` `` | A **number with no vouched source at this site**. The evaluator's fallback is also 60 (`evaluate.ts:83`) but it is a *second copy of the constant*; the composer's default is **70** (`:39`). Three numbers, three files, one displayed claim. |
| `evaluate.ts:73,116` | `` `${sym} tier ${mem.lastTier} → ${tier}` `` and `` (rule.level ?? 'level').replace('_', ' ') `` | The **stored event message** re-derives its label from the scalar, so a fixed page label cannot repair history. `.replace('_', ' ')` also replaces only the first underscore. |

**Copy, exact:**

- Rule label: `{SYMBOL} · {KINDS label}` → `SPY · Score gate`. Threshold line:
  `Score gate` → `≥ {scoreMin}`; **when `scoreMin` is absent render the member `not set`**, never a
  default. `not set` is defined as the one member the trader can act on, cleared by typing — which is
  exactly true here.
- Level line: `{LEVELS label}` → `Gamma flip`. A durable record missing its level renders
  `not recorded` (never captured — the member's literal meaning). See §"Risks" for the surface-extension
  question this raises.
- Missing honesty line, adopted verbatim from the canvas (`alerts.mjs:37`):
  `A rule needs its ticker desk open to evaluate. Nothing runs in the background, and a missed move is never back-filled.`
  The shipped page implies this (`:68-70`) and never states it.
- Missing durable disclosure. `ALERTS_KEY = 'convexa.alerts.v1'` (`types.ts:47`) has no server backup
  and the page never says so: `Stored in this browser · not synced to your account.`
- **P3 vs P4.** `Recent (0)` today says *"Firings appear after a structure snapshot crosses a rule"*
  (`:209`) whether rules exist or not. Split: no rules → `No rules yet — add a score gate on SPY to
  try the path.` (unchanged, `:164`); rules armed, nothing fired → keep `:209`; rules armed but no
  desk has been opened this session → `Nothing has been evaluated yet — open a ticker desk.`
- **The unread mark stops being a coloured edge.** `:219-221` renders `borderLeft: 3` in
  `primary.main` — a state carried by a coloured edge, which is the exact anatomy canon's Banned table
  kills in its v2 accent-bar row, and an amber spend besides. Replace with an `Unread` chip in the
  label row; the `data-read` attribute at `:216` already exists for observation.
- Firing timestamps (`:233`, bare `toLocaleString()`) must **name their zone**. The canvas uses
  `10:12 ET` (`alerts.mjs:41`). If the page cannot resolve ET it renders the local zone abbreviation —
  a bare wall-clock beside a market event is a claim about which clock, and we would be guessing.
- **I withdraw the canvas's per-rule `desk open` live chip** (`alerts.mjs:33`). `useAlerts` exposes no
  such fact (`useAlerts.ts:99-110`); evaluation happens only when some mounted page calls
  `evaluateSnap`. A chip claiming a desk is open, with no predicate behind it, is a liveness claim we
  cannot vouch for — the canvas draws a state the code cannot answer.

#### 2.5 The eight quiet-band widgets

They are **not one thing**, and treating them as one is how this arm gets mis-sized.

| Widget | Has figures? | What "register enforcement" actually means |
|---|---|---|
| `iv-rank` | yes, hand-rolled mono | convert the rank / percentile figures to `FigureCell register="traced"` |
| `market-context` | label rows + small mono scalars | the **scalars** are the figures; the label rows are labels |
| `straddle-move` | yes, hand-rolled mono | convert |
| `dealer-flow-projection` | yes, hand-rolled mono | convert |
| `term-structure` | **no mono anywhere** | a heat chart. Nothing to convert; chart text is outside the chip floor by the shipped exemption (`type-floor.spec.tsx:99`) |
| `fresh-positioning` | mono **list rows** at 12px (`FreshPositioning.tsx:56`) | a list, not a cell. Forcing `FigureCell` here would make eight identical cards out of one scannable list |
| `off-exchange-blocks` | print list | same |
| `setups` | **no figure at all** (`Setups.tsx:34-49`) | nothing to convert |

So the honest scope is: **four convert, four do not**, and for the four that do not, "register
enforcement" means *mono only where the value is traced* plus the container steps they inherit for
free — `Widget.tsx:180` already declares `containerName: 'panel'`, which is the container `FigureCell`
queries (`FigureCell.tsx:218-219`). The steps are not new plumbing; they arrive with the primitive.

**Three copy fixes in this arm, all in my lane:**

1. **`MC_CELL_EMPTY = 'unavailable this cycle'` (`_kit/copy.ts:355`) is a tenth absence literal in a
   figure slot** — used at `MarketContext.tsx:291,299,375`. Split it the way the design already draws
   it (`design/src/components/figure-cell.mjs:40`): value `unavailable` (a member of the nine),
   caption `this cycle`. The whole-widget sentences (`MC_WHOLE_EMPTY`, `IVR_WHOLE_EMPTY`,
   `DFP_WHOLE_EMPTY` …) are **prose**, not values, and stay as they are.
2. **`Setups.tsx:32` collapses "never checked" into "we checked and there is nothing."**
   `setups?.length ? … : <Alert severity="info">No clean setup right now.</Alert>` renders the same
   sentence for `undefined` (the bundle never carried it) and `[]` (computed, none found). "No clean
   setup right now" is a **positive claim about the market** for a ticker nobody scored — the exact
   fabrication `[absent-is-not-none]` was promoted to stop. Split: `[]` keeps the sentence;
   `undefined` gets `Setups unavailable this cycle.`, matching the `*_WHOLE_EMPTY` family idiom.
   `fresh-positioning` already does this correctly (`FreshPositioning.tsx:41` vs `:45`) — the fix is
   to copy a pattern this codebase already owns.
3. **`Setups.tsx:41` `s.conviction.toUpperCase()`** dumps the raw enum uppercased. Closed lookup;
   a miss renders nothing, per the scanner's own `closed()` idiom (`scanner/labels.ts:254-257`). The
   tone map at `:24-27` is already closed — only the label is not.

**And the frame ⓘ.** All seven `info=` sites listed in §0 row 3 move to `AccessibleHelp`
(`ai-rec/AccessibleHelp.tsx`), the pattern ruling 6 named and forbade duplicating. This is not new
scope: it is ruling 6's own criterion, currently certified true on a page where it demonstrably fails.

### 3. The liveness line — per datum, never per surface

The BRIEF's "snapshot surfaces must never wear a live mark" and the approved canvas cannot both be
read literally. The reconciliation that keeps both honest is **the mark belongs to the datum, not the
page**, which is precisely how canon already separates rule 13 (a per-figure provenance mark) from
rule 18 (one page-level connection chip) after the 2026-09-03 clarification.

| Surface | May wear a live mark | Never |
|---|---|---|
| Scanner | the **price** cell, gated on the price stream delivering **and** this symbol having a live tick | score · tier · regime · flip · walls · as-of · any row chrome |
| Positions | **mark · P/L · P/L % · Δ entry · session Δ · trend**, gated on the page stream | contract · structure · qty · net entry · **max loss** · expiry · status · Track record |
| Settings | nothing | everything |
| Alerts | nothing | everything, including the canvas's `desk open` chip |
| Quiet band | nothing | everything — and `Widget.tsx:422-423` already forbids the live edge on quiet chrome by construction |

`max loss` is explicitly on the never list because its own tooltip promises it: *"It is static: it
doesn't move with the market, so it never dims when the feed drops."* (`positions/labels.ts:205-206`).
That promise is currently kept and must survive the conversion.

**The seam I cannot close from my lane:** the brand that makes this checkable — `LiveClaim`, mintable
only by `isDeliveringLive`/`andPresent`/`NOT_LIVE` (`liveClaim.ts:23-29`) — takes a ticker
`LiveUpdate`. The scanner's price stream yields `{price, ts}` (`useLivePrices.ts:24-27`), which cannot
produce the brand. And **positions already mints a second answer**: `PositionsPage.tsx:88` calls
`genuineIsLive`, the predicate `liveClaim.ts:41-45` names in terms as the wrong one because *"it does
not check `market_session`, so it reads `true` while the venue is closed and the wire's `live` flag is
stale-but-true."* Two of the four surfaces in scope answer "is this live?" with something other than
the branded predicate today. That is the `one-liveness-predicate` ledger key, unclosed. I state the
requirement; the architect owns the mechanism.

### 4. Acceptance criteria → states → `Verify by`

`test` where a break would be silent or is negative space; `review` where the change is visible and
intentional. Per `spire-tech-risk-based-verify`; these marks land in SPEC §3's own column.

| # | Criterion | State(s) | Verify by |
|---|---|---|---|
| U-1 | Every figure on scanner/positions/settings/alerts renders through `FigureCell` with an explicit `register`; no call site relies on a default | F1–F9 | test |
| U-2 | No `FigureCell` on these four surfaces renders a `NotANumber` member in the mono register | F5·F7·F8 | test |
| U-3 | Scanner row structure figures (score, tier, regime, flip, walls, as-of) carry **no** live dot in any state | F1 | test (negative space) |
| U-4 | The scanner price cell shows the dot **only** while the price stream is delivering and that symbol has a live tick | F1·F3 | test |
| U-5 | A dropped price stream renders retained prices at F4 with the pause mark, and the header reads `Prices offline · showing last known · structure ~3 min` | P7·F4 | test |
| U-6 | A scanner closed-lookup miss renders `unavailable` with the "does not recognize" tip, not `—` | F8 | test |
| U-7 | Scanner status chip labels carry no `⚠` character and the chip renders a stroke warn icon | P2·P6 | review |
| U-8 | The `Per-row age is the structure snapshot, never the price.` foot line is present in both table and card layouts | P2 | review |
| U-9 | Positions record fields (contract, structure, qty, net entry, max loss, expiry, status) never dim and never show a pause mark on a stream drop | P7 | test |
| U-10 | Positions mark fields render F4 with `offline · last known` when a retained value exists and F5 with `offline` when none does | P7·F4·F5 | test |
| U-11 | **No `⏸` character** appears in any positions source string | P7 | test (source scan) |
| U-12 | Net P/L renders `unavailable` — never `+$0`, never green — when no open row is marked | F8 | test |
| U-13 | Net P/L carries `{n} of {m} open marked` whenever any open row is unmarked | P2·P7 | test |
| U-14 | The sim book renders `not recorded` and never `not provided`; the broker view the reverse; `no basis` only on `pl_pct` | F8 | test |
| U-15 | Each of the three positions-side members keeps its own distinct tip | F8 | review |
| U-16 | Faulted store: banner shown, **nothing dims, no pause mark** (faulted ≠ offline) | P10 | test |
| U-17 | The settings rail lists the five sections in shipped panel order and collapses to horizontal tabs at 900 in both directions | P2 | test |
| U-18 | The rail's tab strip is the only sideways-scrolling element on settings; no page-body overflow at 393/834/900/1280 | P2 | test |
| U-19 | While `auth.ready` is false, settings shows `Checking your session…` and removes it on ready | P1 | review |
| U-20 | The saved confirmation is not green and carries no success palette slot | P2 | test |
| U-21 | Alerts renders no raw wire enum: no `score_gate`/`tier_change`/`level_touch`/`gamma_flip`/`call_wall`/`put_wall` string reaches the DOM | P2 | test (negative space) |
| U-22 | A rule with no `scoreMin` renders `not set`; no numeric default is displayed at the rule row | F8 | test |
| U-23 | Alert **event messages** are built from the closed lookups, so stored history renders the same labels as the rule list | P2 | test |
| U-24 | The back-fill honesty line and the `Stored in this browser` disclosure are present | P2 | review |
| U-25 | Alerts empty states distinguish no-rules · rules-but-nothing-fired · nothing-evaluated-yet | P3·P4 | review |
| U-26 | The unread mark is not a coloured edge and spends no amber | P2 | test |
| U-27 | Every firing timestamp names its zone | P2 | review |
| U-28 | Alerts carries no liveness mark of any kind | P2 | test (negative space) |
| U-29 | `Setups` renders a different string for `undefined` than for `[]`, and the `undefined` string makes no claim about the market | P3·P4 | test |
| U-30 | `Setups` conviction labels come from a closed lookup; an unknown value renders nothing | P2 | test |
| U-31 | No figure slot on the quiet band renders `unavailable this cycle` as its value; the member is `unavailable` and `this cycle` is the caption | F8 | test |
| U-32 | Every `Widget` frame ⓘ is a focusable control reachable by tap, Enter/Space and Escape at every breakpoint | P2 | test |
| U-33 | Converted quiet-band figures step 20 → 17 → 15px against the **named** `panel` container | F1·F3 | test |
| U-34 | A closed-vocabulary literal does **not** step with the container (it is not a figure) | F5·F7·F8 | test |
| U-35 | Panel radius on scanner/settings panels renders 12px | P2 | test |
| U-36 | Scanner cards ↔ table cross at the agreed threshold in both directions, with no datum rendered two ways | P2 | test |
| U-37 | Every surface's degraded copy names the degrade; no surface dims without saying why | P6·P7 | review |

### 5. What I am **not** doing locally

- Not restating tokens. Values stay in `tokens.ts`; the canon is the rules authority.
- Not minting a tenth vocabulary member. Every literal above is one of the shipped nine.
- Not adopting the canvas's scanner column re-cut or its `desk open` chip.
- Not inventing a second focusable-help pattern (ruling 6 forbids it by name).
- Not re-laying-out the quiet band. Ruling 6 preserved their composition; I am changing affordances,
  register and absence copy, not arrangement.

## Risks I see

1. **The settings rail is new construction wearing a maintenance phase's name.** The BRIEF says
   "brought under the same responsive discipline"; the code has no rail (`SettingsPage.tsx:156`). If
   this is scoped as a collapse rule it will be estimated at hours and cost days, and the phase's
   only genuinely new user-facing surface will ship without a design pass. My lane's honest position:
   the rail is a **new navigation surface**, five sections, sticky, with a scroll-spy question nobody
   has answered (does the active item follow scroll, or only click?). I have not answered it here
   because answering it would be inventing behavior.
2. **The scanner card threshold is three different numbers.** Shipped is `down('sm')` = **600**
   (`Scanner.tsx:87`). The canvas is **1000** (`scanner.mjs:18`, `responsive-spec.mjs:25`: cards 2-up
   at 768–999). The BRIEF calls it "phone-width" = **768**. At 834 and 900 — two of the four widths
   the overflow suite pins — the shipped table renders where the design says cards. Whichever wins,
   the overflow suite is currently green against a layout the canvas does not describe.
3. **The "never wear a live mark" sentence, taken literally, deletes true information.** A position
   marked from the live tape *is* live-marked, and the canvas draws it (`positions.mjs:21,64`).
   Enforcing the sentence would force us to hide a provenance fact we can vouch for, which is the
   opposite failure from the one the invariant guards. §3 is my resolution; if the council prefers the
   literal reading, I want that stated as a ruling, because it also silently deletes the scanner's
   shipped `Prices live` header.
4. **`not recorded` on the alerts surface is a vocabulary-surface extension.** Canon rule 24 says the
   three ship "on the **positions** and broker surfaces". Alerts is a third durable client store with
   the same failure mode. I believe this is the "per-surface subset, not a second vocabulary" the rule
   already anticipates — but I am flagging it rather than assuming, because a member quietly appearing
   on a fourth surface is how a closed vocabulary stops being closed.
5. **The red save-error alert.** `SettingsPage.tsx:344` spends `error.main` on a non-directional
   status. Canon reserves green/red for direction and names "status chips, success states" in the ban.
   I am confident about the green Saved toast and **not** confident about the red error alert; a
   confident ruling either way is better than my guess.
6. **Converting the four positions literals changes their visual weight.** `text.disabled` → 15px Sans
   at `text.primary`. Correct, and a visible diff on a shipped surface — GATE Q will see it and should
   know it was intended.
7. **The `Verify by = test` rows that assert negative space (U-3, U-21, U-28) are the ones most
   likely to ship vacuous.** A scan for absent strings passes identically when the scan is broken.
   Each needs the mutation proof this project's own `[structural-over-prose-enforcement]` bar demands:
   poison the thing the rule forbids and watch the build go red.
8. **Copy the FE can silently drop.** Three of my `review` rows (U-8, U-24, U-27) are single lines
   that a lane under time pressure will read as decoration. They are the honesty disclosures; they are
   the reason the rows above them are allowed to make claims at all.

## Assumptions I'm making about the other two lanes

- **The architect will extend the `LiveClaim` brand to a second stream shape rather than let the
  scanner mint a raw boolean.** `isDeliveringLive` (`liveClaim.ts:47`) takes a `LiveUpdate`; the
  scanner's price stream yields `{price, ts}` (`useLivePrices.ts:24-27`). If the brand is not
  extended, U-4 and U-5 cannot be enforced structurally and degrade to `review`. Falsifiable: the
  architect either names one predicate covering both streams, or states that the scanner price cell
  carries no dot at all.
- **The architect will replace `genuineIsLive` at `PositionsPage.tsx:88` with the branded predicate in
  this phase.** I am writing positions states against a single liveness answer. If that call site
  stays, U-9 and U-10 are asserted against a predicate that reads `true` with the venue closed.
- **PM will scope the settings rail as new construction, not a collapse rule**, and will answer
  whether the rail is click-only or scroll-spy. If PM scopes it as responsive polish, I withdraw
  U-17's "in both directions" clause because there will be nothing to collapse.
- **PM will rule on the scanner card threshold as a single number** (600 / 768 / 1000) and will accept
  that the overflow suite's 834 and 900 rows change meaning when it moves. I am not choosing it.
- **PM will keep the scanner's shipped 11-column set for this phase** and treat the canvas's 13-column
  re-cut (`scanner.mjs:23`) as phase 4. If PM adopts the re-cut, every scanner AC above needs
  re-pointing and the `SCAN_COLUMNS` locked-set assertion moves.
- **The architect will treat the four non-figure quiet-band widgets as out of `FigureCell` scope.**
  `Setups.tsx` has no figure; `term-structure`, `off-exchange-blocks` and `fresh-positioning` carry no
  mono figure cell. If the architect plans eight conversions, four of them have no target and the arm
  is over-sized by half.
- **The architect will fix `Widget.tsx:245-249` once at the frame** rather than at seven call sites.
  Seven local fixes would create the second focusable-help pattern ruling 6 bans.
- **PM will price the Net P/L coverage caption (U-13) as required, not nice-to-have.** It is the only
  thing standing between a partial mark failure and a total the trader reads as complete. If PM cuts
  it, I want U-12's `unavailable` arm kept at minimum — a wrong total is worse than no total.
- **Neither lane will treat "no backend change" as licence to leave `evaluate.ts` alone.**
  `evaluate.ts:73,116` writes labels into **durable** event records (`convexa.alerts.v1`), so a
  page-level label fix repairs the future and not the history. That is a frontend pure-logic file, not
  a server internal, and U-23 depends on it.
- **The architect will not change any durable key or shape on `convexa.alerts.v1` or the positions
  stores.** Every state above assumes the existing records load unchanged. If a shape change is
  proposed, `[loss-free-durable-migration]` applies and my P10 (write-refused) state needs a
  migration-failure arm I have not written.
- **PM will not ask for a `success`-severity confirmation anywhere on these four surfaces.** I have
  written U-20 against the canon's ban; if PM's criteria carry "shows a success message", the two rows
  contradict and mine is the one grounded in the canon's Banned table.
