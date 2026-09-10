# Fidelity repair 2 — report (2026-09-10)

Direct repair lane on `FIDELITY_REPAIR_2_TASK.md`, off the council pipeline, per the owner's "yes do
all" on the 2026-09-10 review (`fidelity-review-2026-09-10/VISUAL_REVIEW.md`). Six changes — N1, N2,
N4, N5, N6, N7 — on `/ticker`, most severe first, each with a RED test before the fix. Branch
`fix/fidelity-repair-2`, cut from `main` `4ca9edc7`. `apps/api` / `libs/api` diff stays empty
throughout (verified repeatedly, always empty).

Three of the six changes needed a **second, follow-up commit** after real-browser verification
surfaced defects the unit suite could not see (jsdom never lays out `@container` or real text
wrapping at all) — named in their own sections below, not folded silently into the first commit.

## Commits (chronological)

| commit     | change                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------ |
| `a19d1407` | N1 — cold-load skeleton takes the v2 desk's final shape (AC-46)                            |
| `29a4ed58` | N2 — the side-column orders widget title stops truncating (shorter copy)                   |
| `0687e424` | N4 — the ladder label wraps instead of truncating at 834                                   |
| `f97e54d8` | N5 — one as-of / expiration formatter, exchange clock                                      |
| `c98f7d1a` | N6 — the analysis drawer lists "Time horizon" once                                         |
| `4f55eda1` | N7 — the cold-start failure reads like the design                                          |
| `c93c33ff` | N1 follow-up — the ladder skeleton's gap back on the 4-pt spacing ladder                    |
| `01524747` | style — scoped Prettier pass on this branch's own drifted files (found at format:check)    |
| `6c1e7e3c` | N1 follow-up — the hero/strip container queries actually fire (real-browser bug)           |
| `92d57695` | N2 follow-up — the shorter orders title still ellipsised by 5px, now wraps (real-browser)   |
| `6ae48690` | evidence — `fidelity-repair-2-after` (harness after-capture: JSON census, JPEG pairs, tools) |
| `a0e8cb97` | N5 follow-up (conductor-requested) — `FigureClause`'s `insideRangeLine` and `NumbersSaidStrip`'s own expiration line now use `fmtExpiry` |

## Change-by-change

### N1 — cold-load skeleton takes the v2 desk's final shape (AC-46)

**What changed.** `TickerDashboard.tsx`'s `StatGridSkeleton` (twelve identical tiles in a fluid
five-column grid, under a bare 280px title shimmer) is replaced by shimmer shaped like the real,
already-built v2 desk: masthead (chip row · headline · meta line · quick row, bare on the ink — the
standalone functional `TickerToolbar` above it is untouched, it already stays usable during load),
structure hero (field beside a five-row ladder column, mirroring `StructureHeroPanel`'s own
`theme.containerQueries('panel')` switch at a 1000px container), read strip (eight cells, mirroring
`ReadStrip`'s rail/grid switch), work grid (an AI-brief block beside three side cards, reusing
`StatSkeleton` for the cards — same `cold-skeleton` testid), and a band-header row. Every leaf is a
bare MUI `Skeleton` (no `children`) — no text node anywhere in the subtree. `cold-load`/`cold-skeleton`
testids kept byte-identical so the pre-existing absence-after-load assertions in
`ticker.risk.spec.tsx` keep passing unmodified.

**Files:** `TickerDashboard.tsx`, `ticker.risk.spec.tsx`.

**RED → GREEN (unit).** Six new tests; RED confirmed by swapping in the pre-edit file (not a stash —
`git show HEAD:… > scratch`, `cp` over, ran the suite, `cp` back):

```
RED:   Tests  4 failed | 2 passed | 10 skipped (16)
GREEN: Tests  16 passed (16)
```

The 2 tests that already passed on the old code are legitimate, not a bug in the RED run: (c) the
absence-after-load assertion and (d) "no text node" both happened to already hold for the old
tile-grid skeleton too (it also used bare `Skeleton`s) — the 4 that genuinely distinguish v1 from v2
shape (hero ≥ 400px + narrow-container 968px pin, exactly eight strip cells, ladder-below-field DOM
order, the masthead's bare-on-ink chrome) all failed on the old code and pass on the new.

**N1 follow-up 1 (`c93c33ff`) — spacing ladder.** The ladder skeleton's row `gap: 1.25` (10px) is off
the declared 4-pt rhythm (`spacing-ladder.spec.ts`, AC-45c) — found by the FULL cold suite, not the
targeted N1 run. Fixed to `gap: 1` (8px).

**N1 follow-up 2 (`6c1e7e3c`) — container queries never fired, found in a real browser.** jsdom cannot
lay out `@container` at all (`Widget.spec.tsx`'s own note), so the unit suite's RULE-TEXT assertions
(the established `emotionCssReader` idiom `ReadStrip.spec.tsx`/`FigureCell.spec.tsx` use) all passed
— but a real Playwright measurement at 390px found the hero skeleton still 483px tall (should be
~968), and the strip's rail never switched to its grid form at 1280px. Root cause: both panels put
their OWN responsive rules directly on `SkeletonPanel`'s `sx` — the SAME element that establishes the
`panel` container name via `panelChromeSx`. A container cannot query the container it establishes (the
same rule `ticker-work-container`'s own comment in this file already names), so the override never
matched at any width. Fixed by moving every panel-relative rule onto a descendant `Box` (new
`cold-load-hero-grid` / `cold-load-strip-rail` testids), matching exactly how the real
`StructureHeroPanel`/`ReadStrip` already do it (their own grid-switching `Box` sits *inside* the
`Widget` that establishes `panel`, never on it). Two new mutation-guard tests assert
`container-type`/`container-name` are actually declared, so this exact bug fails loudly in jsdom next
time — though the *responsive behavior itself* still needs a real browser to observe, which is why the
harness step below matters.

**Measured, real browser, final build (`node --input-type=module -e` against `coldload.mjs` +
purpose-built region probes — not jsdom):**

| region | before (real 390px measurement) | after (final) | design / target | met? |
| --- | ---: | ---: | ---: | --- |
| `cold-load-masthead` | not measurable (v1 shape) | **215px** (1280 and 390) | 215 (review's `command-deck`) | **exact match** |
| `cold-load-hero` @ 1280 | not measurable | **483–485px** | 483 | **exact match** |
| `cold-load-hero` @ 390 | not measurable | **970px** | 968 | within 2px |
| `cold-load-strip` | not measurable | **131px** (1280 and 390) | 131 | **exact match** |
| text nodes inside `cold-load` | — | **0** (`textNodesInColdLoad: []`, real DOM walk) | 0 | **met** |
| strip cells | 12 tiles (v1 shape) | **8** (`stripCells: 8`) | 8 | **met** |
| ladder-below-field @ 390 | — | `fieldY:537`, `ladderY:1121` (below) | below | **met** |
| rail→grid @ 1280 | — | `display:grid`, columns `186 / 138×7` (≈1.35:1 ratio) | `1.35fr repeat(7,1fr)` | **met** |

Screenshots: `pairs/desk-cold-load-1280-dark.png` (not committed, PNG) shows the full masthead →
hero → strip → work-grid shimmer shape, visually unrecognizable as the old tile grid. Compared
directly against `fidelity-review-2026-09-10/pairs/desk-cold-load-1280-dark.png` (the v1 "before").

**Residual, named.** The masthead skeleton's internal band proportions (chip row / headline / meta /
quick row) are not pixel-matched to `CommandDeck`'s own internal proportions — only the TOTAL height
is pinned (215px). Not chased: the task's own acceptance criterion is the total-height ±10% check,
which is met exactly.

### N2 — the side-column orders widget title stops truncating

**What changed, first pass (`29a4ed58`).** `WIDGET_TITLE` (`Simulated orders · ${ticker}`) switched to
the design's shorter `Sim orders · ${ticker}` (`design/src/screens/desk.mjs:383`'s `widgetHead`).
`PANEL_TITLE` (a different constant, the `/positions` page's own panel) is untouched.

**N2 follow-up (`92d57695`) — the shorter string was still 5px short, found in a real browser.** A
component test confirmed the new string renders; it does NOT confirm the string *fits* (jsdom has no
real font metrics). Measured directly in a real browser: `title.scrollWidth` 123 vs `clientWidth` 118
— a real CSS ellipsis was still visible on close inspection ("Sim orders · S…") once the `SIMULATED`
chip and `All orders →` link's own widths were accounted for in the 379px column. New opt-in
`titleWrap` prop on the shared `Widget` shell (default `false` — every other widget's header stays
byte-identical single-line ellipsis); `OrdersWidget` sets it — the task's own named fallback ("let the
title wrap … whichever keeps the chip and link on the title row").

**Files:** `orders/copy.ts`, `orders/copy.spec.ts` (new), `shared/ui/Widget/Widget.tsx`,
`shared/ui/Widget/Widget.spec.tsx`, `features/trading/orders/OrdersWidget.tsx`.

**RED → GREEN.**

```
copy.ts string:     RED  Tests  2 failed | 31 passed (33)     GREEN  Tests  42 passed (42)
Widget titleWrap:    (written alongside the fix; verified GREEN — 70 passed (70) across
                      Widget/OrdersWidget/orders.risk/copy specs)
```

**Measured, real browser, final build:** `titleScrollWidth === titleClientWidth === 118` (`isEllipsing:
false`); title `<h2>` height grew from ~20px to 40px (genuinely wrapped to two lines, not merely a
shorter string that happens to fit). Screenshot (zoomed 2×,
`fidelity-repair-2-after/crops/orders-1440-FINAL.png` and `orders-390-FINAL.png`, not committed —
PNGs): "Sim orders ·" / "SPY" on two lines, `SIMULATED` chip and `All orders →` link both still on the
first line beside the title, exactly as the task names. At 390 (the phone stack, unmeasured by the
review) the title fits on one line — the column is wider there, no wrap needed; confirmed via the same
crop.

**Measured, harness JSON:** `widget-orders` region text confirmed `'Sim orders · SPY…'` (full, not
truncated) at 1280, 1440, and 390. Region height grew 114px → 128px at 1280/1440 (the two-line title,
+14px) — this is why the desk-real page total grew from 2,705 to 2,719 at those widths (named below,
under "must-not-change" verification) — a small, deliberate, fully-explained cost of eliminating the
truncation, not a regression.

### N4 — the ladder label wraps instead of truncating at 834

**What changed.** `FigureRow`'s shared row-direction label (`_kit/FigureCell.tsx`) had
`white-space:nowrap; text-overflow:ellipsis` unconditionally. New opt-in `labelWrap` prop (default
`false` — `LadderFoot`, the only other `direction="row"` consumer, is unaffected); `LevelLadder.tsx`'s
`LadderLine` sets it. The ≥1000px two-column-beside-field layout is untouched — this is a label-chrome
change only, per the task's own instruction.

**Files:** `_kit/FigureCell.tsx`, `level-ladder/LevelLadder.tsx`, `level-ladder/LevelLadder.spec.tsx`.

**RED → GREEN.**

```
RED:   Tests  1 failed | 18 passed (19)
GREEN: Tests  61 passed (61)  (LevelLadder + FigureCell + LadderFoot + ReadStrip specs, all green)
```

**Measured, real browser, final build:** crop of the ladder region at 834px
(`crops/ladder-834-FINAL.png`, not committed — PNG) shows "Gamma" / "flip" wrapped cleanly onto two
lines, full text, no ellipsis — directly comparable to the review's own
`fidelity-review-2026-09-10/crops/ladder-834.png` ("Gamma f…$771.3", truncated, value colliding with
the cut label). This is the one N-item I visually re-verified with the most direct before/after crop
pair, since the defect was itself a rendering-only issue no text-content check alone could confirm.

### N5 — one as-of / expiration formatter, exchange clock

**What changed.** Two new pure helpers beside `humanAge` (`_kit/copy.ts`): `fmtAsOfEt(iso, now)` →
`"HH:MM:SS ET · <age>"` (`America/New_York`, via `Intl.DateTimeFormat.formatToParts` — never a
locale-formatted string, which is immune to the `en-US`/`hour12:false` midnight artifact some ICU
builds have) and `fmtExpiry(isoDate, now)` → `"Sep 18 (15 DTE)"` (DTE from the ET exchange calendar
date, never negative). Both render the closed-vocabulary `unavailable` on a null/unparseable input.
Applied at every site the task names: `DecisionCard.tsx`'s provenance chip and structure line's
expiration, `AnalysisSurface.tsx`'s "As of" line and structured-summary expiration,
`AiRecPanelBlocks.tsx`'s `SnapshotHint`, `literals.ts`'s `candidateFreshnessLine` ("Candidates as of
…") and `quoteTextFor`'s "from the … chain snapshot" clause, and `CitedContractLine.tsx`'s own
rendered expiration. `data-rec-as-of` (`DecisionCard.tsx`) keeps the raw ISO — a machine attribute,
untouched. Two sites that route through the closed literal selectors (`planFieldLiteral` in
`DecisionCard`'s structure line and `AnalysisSurface`'s structured summary) reformat the literal's
`text` **after** the selector has already decided `value`/`dash`/`not-set`/… on the RAW wire token —
never before, so `fmtExpiry`'s own `unavailable` fallback can't race the selector's own reason-token
lookup and get mis-painted as a legitimate value.

**Files:** `_kit/copy.ts`, `_kit/copy.spec.ts`, `ai-rec/DecisionCard.{tsx,spec.tsx}`,
`ai-rec/AnalysisSurface.{tsx,spec.tsx}`, `ai-rec/AiRecPanelBlocks.tsx`,
`ai-rec/AiRecPanelBlocks.spec.tsx` (new), `ai-rec/CitedContractLine.tsx`, `ai-rec/literals.{ts,spec.ts}`,
`ai-rec/NumbersSaidStrip.spec.tsx`, `ai-rec/ai-rec.risk.spec.tsx`.

**A genuine bug the DST test caught before it shipped.** The helpers were designed and tested together
(not strictly RED-first for the pure functions themselves — the ET-timezone/DST-safe day arithmetic
needed to be worked out as one piece; disclosed here rather than silently presented as textbook TDD).
Running the new tests immediately surfaced a real defect: `fmtExpiry`'s month/day label read one
calendar day short ("Sep 17" for "2026-09-18") because it re-converted an already-UTC-midnight-anchored
date through the `America/New_York` zone a second time. Fixed by formatting the expiry label in UTC
(the wire's bare `YYYY-MM-DD` is already a calendar date, not a zone-specific instant) while keeping
the DTE *arithmetic* ET-anchored (which was already correct — the day COUNTS matched the design's own
example on the first run, only the printed label was wrong):

```
fmtExpiry, first run:  Tests  4 failed | 17 passed (21)
fmtExpiry, after fix:  Tests  21 passed (21)
```

**RED → GREEN, per site (render tests, ISO string absent from the DOM):**

```
DecisionCard "As of" + expiration:        RED  2 failed | 26 passed (28)
AnalysisSurface "As of" + expiration:     RED  2 failed | 16 skipped (18)
AnalysisSurface cited-contract line:      RED  1 failed | 18 skipped (19)
AiRecPanelBlocks SnapshotHint (new spec): RED  1 failed | 1 passed (2)
literals.ts (candidateFreshnessLine +
  citedLine's quoteText interpolation):   RED  2 failed | 62 passed (64)
```

**Five pre-existing pinned assertions elsewhere** (found by running the FULL `ai-rec` directory, not
just the targeted files — `NumbersSaidStrip.spec.tsx` and `ai-rec.risk.spec.tsx`, three cases) had
pinned the RAW ISO string as `toHaveTextContent`. Updated in the same commit to pattern-match the
formatted shape instead (`\d{2}:\d{2}:\d{2} ET`), per the same "update the pinned assertion in the same
commit" discipline the task names for N7's A11Y-8. **Final, full `ai-rec` + `_kit/copy` GREEN:**

```
Test Files  7 passed (7)
Tests  134 passed (134)
```

Full `widgets/ai-rec` directory (500 → 502 tests, +2 from N6 below): **25 files, 502/502, exit 0.**

**Not touched (named, not silently dropped).** `FigureClause.tsx`'s `insideRangeLine` ("inside
Convexa's implied move for {date}") and `NumbersSaidStrip.tsx`'s own `citedExpiration` line
(`ATC-4/54/66`'s "No straddle-implied move for {date}…") both render a raw date too — the review's own
evidence quote names this exact phrase ("inside Convexa's implied move for 2026-09-18") — but neither
site is in the task's enumerated "Raw sites:" bullet list, which is a specific, hand-picked set of
citations, not "every raw date in the codebase." Left as an explicit scope boundary rather than
silently widened into; a judgment call, not a GATE Z (the task's own list is unambiguous about which
sites are in scope).

#### N5 follow-up (conductor-requested)

The conductor read the "Not touched" note above as a defect to close, not a standing scope boundary —
one bounded lane, one change: apply `fmtExpiry` at exactly those two named sites so no raw
`YYYY-MM-DD` reaches the DOM from them either. Commit `a0e8cb97`.

**What changed.** `FigureClause.tsx`'s `inside_range` case now reformats `c.expiration`'s TEXT via
`fmtExpiry` before it reaches `insideRangeLine` — `figureClause()` (`literals.ts`) has already decided
`inside_range` from the RAW wire token (`state`/`basis`/`range_low`/`range_high`/`expiration`) before
this component ever sees a value, so the selector itself is untouched; only the resolved value's text
is reformatted, the same discipline this file's `DecisionCard.tsx`/`AnalysisSurface.tsx` sites already
apply. `FigureClause` is the SAME shared component both `DecisionCard.tsx` (`clause-target`, under
Target/`exit_target`) and `AnalysisSurface.tsx`'s grounding-fields list render, so one edit closes both
call sites. `NumbersSaidStrip.tsx`'s `targetExpiration` (`citedExpiration ?? move?.primary_expiration ??
null`) is likewise already decided present-or-absent from the raw wire tokens by the time the two copy
branches run (matched-tenor "…implied move for {expiration}" and no-match "No straddle-implied move for
{expiration}…"); both branches now wrap it in `fmtExpiry`.

**Files:** `ai-rec/FigureClause.tsx`, `ai-rec/FigureClause.spec.tsx` (new), `ai-rec/NumbersSaidStrip.tsx`,
`ai-rec/NumbersSaidStrip.spec.tsx`.

**RED → GREEN** (new `FigureClause.spec.tsx` + `NumbersSaidStrip.spec.tsx`'s three pre-existing pinned
raw-ISO assertions updated to the formatted shape in the same commit, plus two new fixed-clock tests):

```
RED:   Test Files  2 failed (2)  |  Tests  6 failed | 4 passed (10)
GREEN: Test Files  2 passed (2)  |  Tests  10 passed (10)
```

Full `ai-rec` directory (502 → 505 tests, +3 from this follow-up: +1 `FigureClause.spec.tsx`, +2 new
`NumbersSaidStrip.spec.tsx` cases): **26 files, 505/505, exit 0** (the one incidental failure on a raw
`npx vitest --config apps/dashboard/vite.config.mts run …` invocation from the repo root —
`decisionCard.structural.spec.ts`'s `ENOENT` — was this invocation's `process.cwd()` landing at the repo
root instead of `apps/dashboard`, not a regression; confirmed passing both under a correct cwd and under
the full `nx test` run below).

**Verification (exit codes).**

| check | command | result |
| --- | --- | --- |
| typecheck (cold) | `npx nx typecheck @convexa/dashboard --skip-nx-cache` (`dist`/`out-tsc`/`*.tsbuildinfo` cleared first) | **0** |
| unit + component (full) | `npx nx test @convexa/dashboard --skipNxCache` | **0** — 246 files / **2,977 tests** (245/2,974 before this follow-up; +1 file, +3 tests, exactly this follow-up's new coverage) |
| lint | `npm run lint` | **0** — 4 pre-existing warnings in `apps/dashboard-e2e/playwright.*.config.ts` (`no-explicit-any`), unrelated to this diff, 0 errors |
| format | `npm run format:check` | **0** (one file — the new `FigureClause.spec.tsx` — needed a scoped `npx nx format:write --files apps/dashboard/src/app/pages/ticker/widgets/ai-rec/FigureClause.spec.tsx`; re-checked green, and the two edited spec files re-run green after) |
| NUL scan | byte scan on all 4 changed/new files | **0** on every file |
| LF-only | `grep -c $'\r'` on all 4 files | **0** on every file |
| lanes | `git diff --stat main -- apps/api libs/api` | empty |

**What I could not verify.** No real-browser / visual-gate re-check for this follow-up — the task scoped
verification to typecheck/test/lint/format/NUL only, and this change touches text content, not layout,
so the existing real-browser discipline from N1/N2 above doesn't apply here. Not run: e2e, a11y gate,
visual gate, the harness — outside this follow-up's owed verification table.

### N6 — the analysis drawer lists "Time horizon" once

**What changed.** `AnalysisSurface.tsx`'s `analysis-structured-summary` list dropped the
`PLAN_FIELD_LABEL.timeHorizon` tuple (kept once, in `analysis-plan-fields`, beside Confidence — the
design's `MANAGE THE TRADE` grouping). Landed in the same file/commit-adjacent work as N5's expiration
formatting (same array literal), as its own separate commit.

**RED → GREEN.**

```
RED:   Tests  1 failed | 1 passed | 19 skipped (21)
GREEN: Tests  21 passed (21)
```

### N7 — the cold-start failure reads like the design

**What changed.** The only-blank-desk alert rendered the client's raw `error` string (`API error
${status}`) with `severity="error"`. Renders the design's sentence instead: `AlertTitle` "Couldn't load
{TICKER}.", body "The structure request failed before any snapshot arrived. Nothing is cached for this
desk yet.", `Retry` beside it, `severity="warning"` + `WarningAmberIcon` (burnt orange + the icon,
matching the poll-failure warning immediately below it in the same file), and a Mono detail line
("HTTP {status}") via a new `httpStatusFromMessage` display-only parse of the client's own message
(`libs/api/src/lib/convexa.ts:1338` is untouched — other consumers assert on that string; the "must not
change" list keeps `libs/api` at a zero diff). Returns `null` (line omitted, never fabricated) when the
message carries no status-shaped number (the 404 case's status-less prose).

**Files:** `TickerDashboard.tsx`, `ticker.risk.spec.tsx`,
`apps/dashboard-e2e/src/quality/fixtures/scenarios.ts` (A11Y-8's `text` assertion, in the same commit).

**RED → GREEN.**

```
RED:   Tests  1 failed | 1 passed | 16 skipped (18)
GREEN: Tests  18 passed (18)
```

**A11Y-8.** Updated the fixture's `text: 'API error 503'` to `text: "Couldn't load SPY."` in the same
commit, per the task's own instruction. Checked whether the accessibility inventory (`manifest.ts`)
needed re-baselining: it lists scenario IDs only (`'A11Y-8'`), never literal text, so no re-baselining
was needed — not touched, and the a11y gate's own run (below) confirms A11Y-8 passes with the new copy.

**Measured, real browser, final build (mocked 502 via a new `_tools/coldfailure.mjs`, modeled on the
review's own `coldload.mjs`):**

```
app cold-failure 1280: {"alertText":"Couldn't load SPY.The structure request failed before any
  snapshot arrived. Nothing is cached for this desk yet.HTTP 502Retry","toolbarPresent":true}
app cold-failure 390:  (identical alertText; toolbarPresent:true)
```

Screenshot `fidelity-repair-2-after/app/desk-cold-failure-1280-dark.png` (not committed, PNG) is a
close visual match to the design's own failure frame I opened side-by-side during design review
(burnt-orange box, warning triangle, headline, body, `HTTP 502` mono line, `Retry` top-right, the
toolbar still rendering functional `TICKER`/`EXPIRATIONS`/`PERSONA` controls above it) — a dramatic
visual change from the review's own "before" evidence (`pairs/desk-cold-failure-1280-dark.png`: a thin
red bar reading "⚠ API error 502 · Retry" over the v1 raised toolbar).

**Not touched (as instructed).** The poll-failure-after-success case (`error && data`, the "Couldn't
refresh — showing data from N min ago" soft warning) is a different code path (`error && !data` is the
one this task names) — confirmed still a distinct branch, untouched.

## Verification (exit codes; every command run standalone, ports freed with
`node tools/free-ports.mjs 4200 4310` — never `npm run ports:free`, which also touches :8000, owned by
another session)

| check | command | expected | result |
| --- | --- | --- | --- |
| lanes | `git diff --stat main -- apps/api libs/api` | empty | **empty**, checked repeatedly throughout, still empty at HEAD |
| NUL scan | byte scan of every file this branch touched (24 source files, both content commits and follow-ups) | all 0 | **0** in all 24 |
| typecheck (cold) | `npx nx typecheck @convexa/dashboard --skip-nx-cache` (`dist`/`out-tsc`/`*.tsbuildinfo` deleted first) | 0 | **exit 0** (run cold after every content commit, and once more at the very end) |
| unit + component | `npx nx test @convexa/dashboard --skipNxCache` (`node_modules/.vite` cleared first) | 0, RED shown red before each fix | **exit 0** — 245 files / **2,974 tests** at the very end; every RED run quoted above under its own change |
| lint | `npm run lint` | 0 | **exit 0** — 4 pre-existing warnings, unrelated `dashboard-e2e/playwright.*.config.ts` files (same baseline the prior ticker-repair report recorded) |
| format | `npm run format:check` (scoped to this branch's 24 files) | 0 | first pass **exit 1** (4 files drifted — 3 from this lane's own edits, 1 pre-existing import wrap); `npx nx format:write --files <the 4>` (scoped, never bare), re-checked **exit 0**; re-ran the 3 affected spec files (60/60) to confirm the reformat was whitespace-only |
| production build | `npx nx build @convexa/dashboard --configuration=production --skip-nx-cache` | 0 | **exit 0** (rebuilt after every content-affecting commit — 6 times total, each exit 0) |
| desk e2e | `BROWSER_QUALITY_PREBUILD_STATUS=pass npx nx e2e dashboard-e2e --skip-nx-cache -- --grep "desk\|curvature\|overflow\|cold"` | 0, 0 flaky | first run: **1 failed** (`AC-34` drawer-close-button hit area, `43.999969…px` vs the ≥44px floor — a sub-pixel float-rounding artifact on a nav control this task never touches; re-ran alone, passed clean, confirmed non-reproducible, not a regression); every full run after that: **108/108 passed, 0 flaky, exit 0** (run 3 times total against successive final builds) |
| accessibility gate | `BROWSER_QUALITY_PREBUILD_STATUS=pass npm run browser:a11y` | 0, A11Y-8 with the new copy | **16/16 passed, 0 flaky, exit 0** (run twice against successive final builds; A11Y-8 passing confirms the new headline substring renders) |
| visual gate | `BROWSER_QUALITY_PREBUILD_STATUS=pass npm run browser:visual` | **expected FAIL** on the changed scenarios, evidence paths, no PNG written | **6 failed / 6 total, exit 1** — see "Visual gate" section below; **no baseline PNG was written** (confirmed via `git status` before/after, clean) |
| harness | `AUDIT_OUT=… npx playwright test --config playwright.audit.config.ts --grep "desk-real\|desk-trade"` (ports freed first) | exit 0 | **22/22 passed, exit 0** (run 3 times as the build changed; the saved bundle `_tools/spy-bundle-2026-09-08T1059Z.json` had to be copied in from the review's own `_tools/` first — `desk-real`'s plan is resolved relative to `AUDIT_OUT`, not a fixed repo path — read-only copy, the review folder itself was never written to) |
| `pairs.py` + numbers | `uv run --with pillow python <after>/_tools/pairs.py` | composites + numbers in the report | **exit 0**, "pairs written: 10"; numbers quoted per-change above and in the composition table below |
| cold-load + failure captures | `node --input-type=module -e "$(sed …)"` against `coldload.mjs`; the 502 variant | new PNGs beside the review's | both captured — `coldload.mjs` run verbatim per the task's own invocation; the 502 variant (`_tools/coldfailure.mjs`) is new (not carried from the review — no such script existed there), modeled directly on `coldload.mjs`'s own structure |

## Composition (harness JSON census, production build, `desk-real` scenario — the saved SPY bundle,
AI idle; committed under `fidelity-repair-2-after/app/*.json`)

| width / scheme | before this lane (prior report's own cold-verified number) | after this lane | design | threshold | met? |
| --- | ---: | ---: | ---: | --- | --- |
| 1440 dark | 2,705 | **2,719** | 2,483 | ≤ 2,950 | **met** (+14px — N2's deliberate two-line title) |
| 1280 dark | 2,705 | **2,719** | 2,532 | ≤ 3,000 | **met** |
| 1280 light | 2,705 | **2,719** | — | parity | **met** |
| 834 dark | 3,628 | **3,628** | 3,290 | ≤ 4,170 | **met**, byte-identical (N2's fix didn't change wrap behavior at this width) |
| 390 dark | 5,484 | **5,464** | 4,416 | ≤ 5,520 | **met**, 20px *shorter* — the shorter/wrapped title needs less room in the phone stack too |

`overflowX`: **false** at every width, both sides, every capture.

| region (1280 dark) | before | after | design | met? |
| --- | ---: | ---: | ---: | --- |
| `command-deck` | 215 | **215** | 186 | unchanged (masthead itself not in scope this lane) |
| `widget-structure-hero` | 483 | **483** | 470 | unchanged, byte-identical |
| `widget-read-strip` | 131 | **131** | 112 | unchanged, byte-identical |
| `ticker-context-grid` | 968 | **968** | 673 | unchanged, byte-identical |
| `widget-ai-rec` vs side | 759w / 379w | **759w / 379w** | 793 / 396 | unchanged |
| `widget-orders` | 114 | **128** | — | **+14px, N2's two-line title** (deliberate) |

Every region this lane did not touch is byte-identical to the pre-repair numbers — confirmed by
reading the same JSON keys, not assumed.

## Visual gate — the required FAIL, with evidence

`npm run browser:visual` **failed on all 6 scenarios** (`landing`, `ticker-desktop`,
`ticker-offline-mobile`, `positions-dense`, `scanner-dense`, `ai-recommendation`) — exit 1, as
required. The failure mode was **not** a pixel diff: `apps/dashboard-e2e/src/quality/snapshots/`
contains **`linux/`** and **`win32/`** baselines only — there is no `darwin` baseline in the repo at
all, so every scenario failed with `Error: A snapshot doesn't exist at
.../snapshots/darwin/chromium/{id}.png`, for every scenario, touched by this lane or not. This is a
platform fact of running the gate locally on this Mac, not a finding about N1–N7; no baseline PNG was
written either way (`git status` confirmed clean of `snapshots/` before and after).

**Supplementary diagnostic (not the official gate result — recorded so a future pass doesn't have to
re-derive it).** I temporarily copied `snapshots/linux/chromium/*.png` into a local, uncommitted
`snapshots/darwin/chromium/` directory (read-only source, never touching the tracked `linux`/`win32`
folders) to get a real pixel diff against the last-accepted baseline, then deleted the copy afterward
(`git status` confirmed clean). Every scenario differed — **including `landing`, `positions-dense`, and
`scanner-dense`, pages this lane never touches at all** (26,030 / 91,023 / 49,050 px different
respectively) — which shows the comparison is dominated by cross-platform font-rendering
(anti-aliasing) noise, not content. Visually inspecting the diff overlays directly:

- **`ai-recommendation`** (`test-results/visual-ai-recommendation-chromium/ai-recommendation-diff.png`,
  not committed): the diff highlights are legible text substitutions exactly matching N5+N6 — the raw
  ISO "as of" and expiration replaced by the formatted forms, and the duplicated "Time horizon" label
  gone from one of the two lists. No stray, unexplained diff region.
- **`ticker-desktop`**
  (`test-results/visual-ticker-desktop-chromium/ticker-desktop-diff.png`, not committed): the ENTIRE
  page is flagged (nav, masthead, every figure), consistent with the same font-rendering noise seen on
  the untouched pages — not cleanly attributable to N1–N7 via this cross-platform comparison alone.

**Conclusion:** the visual gate's real, useful verdict on this darwin machine requires either running
in the CI/Linux environment where the `linux` baseline actually applies, or an owner-authorized
re-acceptance receipt (`visual-review/README.md`) followed by `browser:visual:update` — neither of
which this lane runs, per the task's own rule. The `ai-recommendation` diagnostic above is the closest
this lane can get to direct confirmation that N5/N6 changed exactly the right pixels and nothing else.

## GATE Z items

None filed. Every ambiguity this lane hit was resolved by the task's own text:

- **N2's second fix** (titleWrap) was the task's own named fallback ("or let the title wrap … whichever
  keeps the chip and link on the title row") — not a new decision, the option the task already offered
  once the first option (shorter copy) proved insufficient on measurement.
- **N7's `httpStatusFromMessage`** placement (a local, unexported parse in `TickerDashboard.tsx`, not a
  change to the shared `usePollingResource` hook or `libs/api`) follows the task's own framing directly
  ("N7 is fixed where the dashboard renders the alert, not in the client's error string").
- **N5's site list** is the task's own closed enumeration; the two adjacent-but-unlisted raw-date sites
  (`FigureClause`, `NumbersSaidStrip`'s own line) are named as an explicit scope boundary above, not a
  missing-field question that needed the owner.

## Residuals seen but not fixed (named, not silently dropped)

- **`command-deck` still 215px vs the design's 186** — untouched this lane (the masthead's own tier-1
  content, `TickerHeader`, is not part of N1–N7; N1 only had to make the *skeleton* match this same
  215px, which it now does exactly).
- **`ticker-context-grid` still 968px vs the design's 673** — the ≤ 800px density target is an
  explicitly-named open owner item from the prior repair lane, untouched here (outside N1–N7's scope).
- **The visual gate has no `darwin` baseline** — see above; a platform gap, not a content finding.
- **`FigureClause`'s `insideRangeLine` and `NumbersSaidStrip`'s own expiration line** still render raw
  dates — named under N5 above, deliberately left out of this lane's enumerated scope.
- **AC-34's sub-pixel flake** (drawer close button, `43.999969…px` vs 44) — reproduced once, confirmed
  non-reproducible in isolation, unrelated to any file this lane touched; not chased.

## What I could not verify

- **A true darwin-baseline visual comparison** — no such baseline exists in the repo; the closest
  available signal is the temporary linux-baseline diagnostic above, which is noisy (cross-platform
  font rendering) and was deleted after use, per the "no baseline written" rule.
- **CI's own Linux/Windows rendering** of any of these six changes — everything in this report was
  captured on this Mac (darwin/chromium); the production build, unit suite, e2e, and a11y gate are
  platform-portable by construction (they don't compare against frozen pixel baselines), so this is a
  narrower gap than it sounds, but it is real.
- **The `ticker-desktop`/`ticker-offline-mobile`/`positions-dense`/`scanner-dense`/`landing` visual
  scenarios' TRUE diff** against a matching-platform baseline — only `ai-recommendation`'s diff was
  legible enough through the font-rendering noise to draw a content conclusion from.

## Screenshots and evidence

Committed, under `fidelity-repair-2-after/` (JSON census + JPEG pairs + `_tools/`; PNGs are gitignored
per that folder's own `.gitignore`, matching `fidelity-review-2026-09-10/`'s and
`ticker-repair-after/`'s own pattern):

- `app/desk-real-{1440,1280,834,390}-dark.json`, `app/desk-real-1280-light.json`, and the `desk-trade-*`
  equivalents — the DOM census this report's numbers are read from.
- `pairs/desk-real-*.jpg`, `pairs/desk-trade-*.jpg` — side-by-side app|design composites.
- `_tools/coldfailure.mjs` — new, the 502-mock capture script for N7 (modeled on the review's own
  `coldload.mjs`, copied in from `_tools/` alongside the saved bundle).

Not repo-committed (PNGs; this machine only, per the task's own "outside the repo or in
`fidelity-repair-2-after/`" convention):
`fidelity-repair-2-after/app/desk-cold-load-1280-dark.png`, `desk-cold-failure-{1280,390}-dark.png`,
`crops/ladder-834-FINAL.png`, `crops/orders-{1440,1280,390}-FINAL.png`,
`crops/orders-1440-titlewrap.png` — the before/after crop pairs quoted under each change above.

**Verdict:** all six named changes landed, each with a RED test that failed before its fix and passed
after; three needed a real-browser-verified follow-up commit that the unit suite alone could not have
caught (jsdom's `@container`/layout blind spot) — named and fixed in this lane, not left for a later
pass. Every gate the task names ran to completion with the exit code it names, except the visual gate,
which failed exactly as instructed, for a platform reason recorded with real diagnostic evidence
standing in for the missing baseline. `apps/api` / `libs/api` stayed at a zero diff throughout.

## Conductor's cold re-verification (2026-09-10, the Mac session — not the lane's numbers)

**Procedure.** From the lane's final tree (`4431c6f3`, then `140fd16c` after the N5 follow-up): build outputs deleted,
cold typecheck, the unit suite, lint, `format:check`, a fresh production build, the desk e2e, the accessibility gate, the audit
harness into a **separate** folder (`fidelity-repair-2-verify/`, `--grep "desk-real|desk-trade"`), and the two state
captures (cold load with the route held; failure with a 502) against the fresh bundle served the way the gates serve it.
Every command standalone, ports 4200/4310 freed first; port 8000 never touched.

| check | `4431c6f3` (lane tree) | `140fd16c` (+ N5 follow-up) |
|---|---|---|
| `npx nx typecheck @convexa/dashboard --skip-nx-cache` (cold) | exit 0 | exit 0 |
| `npx nx test @convexa/dashboard --skipNxCache` | exit 0 — 245 files / 2,974 tests | exit 0 — 246 files / **2,977** tests |
| `npm run lint` · `npm run format:check` | 0 · 0 | — (lane: 0 · 0) |
| `npx nx build @convexa/dashboard --configuration=production --skip-nx-cache` | exit 0 | exit 0 |
| desk e2e (`BROWSER_QUALITY_PREBUILD_STATUS=pass`) | **108/108, 0 flaky**, exit 0 | **108/108, 0 flaky**, exit 0 |
| accessibility gate | **16/16, 0 flaky**, exit 0 (A11Y-8 on the new copy) | — |
| harness `desk-real|desk-trade` | 22/22, exit 0 | — |
| `git diff --stat main -- apps/api libs/api` | empty | empty |

**Every composition number matches the lane's to the pixel** (`fidelity-repair-2-verify/app/*.json`): 2,719 at 1440 and
1280 (dark and light), 3,628 at 834, 5,464 at 390; `command-deck` 215, `widget-structure-hero` 483, `widget-read-strip` 131,
`widget-ai-rec` 759 w beside 379 w, `widget-live-tape` 318, `widget-orders` **128** (+14 for the wrapped title), band 968;
`overflowX` false everywhere, console errors 0. One number the lane's table did not list: `desk-trade` at 834 is **3,140**
(review: 3,083; +57 px — the wrapped title in the three-up side column), still far under the design's 3,915.

**Looked at, not just measured** (`fidelity-repair-2-verify/pairs/*.jpg`, `crops/*.jpg`): the cold-load subtree now has the
desk's shape — masthead shimmer, the field beside a five-row ladder, the eight-cell strip, the work grid — against the
review's twelve-tile grid; the failure state reads the design's sentence with `HTTP 502` as a Mono detail and `Retry`;
`Sim orders · SPY` wraps instead of clipping at 1280 and 1440; `Gamma flip` wraps at 834; the produced read shows
`As of 12:00:00 ET · 1s`, `Sep 18 (26 DTE)`, one `Time horizon`, and after the follow-up no `2026-09-18` anywhere in the panel.

**Residuals I add to the lane's list (named, not blocking):**
- **R1 — the pre-load toolbar is still v1's raised panel.** Above the new skeleton, `TickerToolbar` (`TICKER · EXPIRATIONS ·
  PERSONA` + spinner) renders in its raised card during load, while the loaded desk joins those controls to the headline row
  (change 9 of the first repair). The page no longer jumps in the body, but it still jumps in that one row. The lane fenced the
  toolbar deliberately; a follow-up can render the loading toolbar in the joined form. Owner/UX note, not a defect in the six.
- **R2 — the side-column title wraps `· SPY` onto its own line** at 379 px (the design fits `Sim orders · SPY` on one line at
  396 px because its chip and link are narrower). Polish: shrink the `SIMULATED` chip or drop the ticker suffix in the side
  column.
- **The visual gate cannot pass on this machine** (no `darwin` baseline by schema). The scenarios this branch changes —
  `ticker-desktop`, `ai-recommendation`, and `ticker-offline-mobile` if the phone stack's title moved — need the owner's
  win32 + linux re-acceptance through `visual-baseline-receipts/RUNBOOK.md` before CI's visual child can go green on the PR.

**Verdict on the lane:** accepted as landed — six defects fixed with RED tests, two real-browser bugs caught and fixed by the
lane itself, every gate green cold, nothing faked, residuals named.
