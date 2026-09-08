# Ticker fidelity repair — report (2026-09-08)

Direct repair lane on `TICKER_FIDELITY_REPAIR_TASK.md`, off the council pipeline, per the owner's
"proceed with your recommendations" on the 2026-09-08 audit (`fidelity-audit-2026-09-08/FIDELITY_AUDIT.md`).
**Two lanes built this task.** The first lane landed the six numbered changes' first pass (commits
`c6afe2c6`…`d08822bc` below) and was killed mid-edit by an API rate limit with two files half-finished.
This lane resumed: finished the interrupted edit, then closed composition gaps the first pass's own
measurements had left open, in the order the resume brief named (context band → Live tape → masthead →
Setups/phone). `apps/api` diff stays empty throughout (`NO_BACKEND_CHANGE`).

## Commits (chronological; `*` = this lane)

| commit       | change                                                                    |
| ------------ | ------------------------------------------------------------------------- |
| `c6afe2c6`   | F1 — tape & plan work grid (`8fr/4fr` split)                              |
| `d12a08bf`   | F2 — context band recomposed to the 3-col quiet grid                      |
| `65d29ebb`   | F3 — masthead bare on the ink, ticker input dropped                       |
| `18ba0c9c`   | docs — F3 API follow-up filed in RESUME.md                                |
| `29dff32a`   | F4 — read strip re-framed (hairline grid, ring, sub-captions)             |
| `b4fa9253`   | F9 — TermHeatChart colours from the theme                                 |
| `89fd41e9`   | F10 — hero residuals (ladder wrap, mid·tape chip)                         |
| `d08822bc`   | F4 — restore ReadStrip's full-bento-row span                              |
| `d5362a82`\* | **finish** the interrupted F2 edit — Market context's compact-cell labels |
| `a3d53244`\* | F2 residual — context band density + responsive column count              |
| `bea3aed2`\* | F1/F3 residual — Live tape's 2×2 grid, masthead control row               |
| `119bf485`\* | F2/phone residual — Setups card density                                   |

## Change-by-change

### Finishing the interrupted edit (not a numbered change — the inherited half-finished state)

**What changed.** `MarketContext.tsx`'s JSX still referenced the removed `MC_TI_TITLE` /
`MC_SHAPE_TITLE` / `MC_FLOW_TITLE` / `MC_ATR_TITLE` / `MC_ROW_ATR_14D` and the now-unimported
`mcTrendLine` / `mcConcentrationLine` / `mcLocationLine` (12 typecheck errors; the component would
throw `ReferenceError` on render — all 11 `MarketContext.spec.tsx` cases were effectively red).
Wired each compact cell's title to its short label (`MC_ROW_TREND` / `MC_SHAPE_SHORT` /
`MC_FLOW_SHORT` / `MC_ATR_SHORT`, copied from `design/src/screens/desk.mjs:413`'s `ctx-2` cells) and
dropped the `scalar` prop from Trend/Shape/Flow, matching `AtrCell`'s already-correct
`scalar={undefined}` pattern and the file's own docblock ("collapse to label / value / one-line
basis... full detail moves behind the card's expand"). The three now-orphaned scalar-line builders
stay exported in `copy.ts`, unused — the same pattern already accepted there for the four builders F2
orphaned when it dropped Strength/Momentum/Balance/Composition from the compact card.
**Files:** `MarketContext.tsx`, `_kit/copy.ts`. **Commit:** `d5362a82`.

### 1. Tape & plan (F1)

**First pass** (`c6afe2c6`, prior lane): rebuilt `TickerDashboard.tsx`'s work row to the design's
`minmax(0,8fr) minmax(0,4fr)` grid — AI read wide on the left, Live tape / position brief / orders
stacked in a side column. Verified still correct this lane (`widget-ai-rec` 759px beside
`ticker-work-side` 379px ≤ 420px threshold — met throughout).

**This lane's residual close-out** (`bea3aed2`): `LiveTape.tsx`'s `GRID` was
`repeat(auto-fill, minmax(180px, 1fr))` — at the side column's real ≈345px content width,
2×180=360 > 345, so `auto-fill` never actually fit 2 columns and all four figures stacked in one
column (`widget-live-tape` 533px). The design's `.tape-grid` (`design/src/screens/desk.mjs:45`) is a
**fixed** 2-column grid, not fluid — hardcoded to `repeat(2, minmax(0, 1fr))`.
**Design anchor:** `desk.mjs:351-367`. **File:** `LiveTape.tsx`. **Commit:** `bea3aed2`.
**Measured:** `widget-live-tape` 533px → 318px (design 295px — closed to 23px).
**Residual (GATE Z, filed in RESUME.md):** the design's flow-spark row (a 30-point, 10s-sampled
`net_flow` trail) has no wire equivalent — `LiveUpdateBody` carries only the current scalar. Not
built (would require either fabricating data or a new, undecided client-side accumulation feature
reaching into the stream-isolation area the must-not-change list protects). Not faked, not attempted.

### 2. Context band (F2)

**First pass** (`d12a08bf`, prior lane): one `Context` header with the presentational
`All · Flow · Vol · Positioning` filter; `repeat(3, minmax(0,1fr))` grid in the design's DOM order;
Market context collapsed from four full sub-cards to one card with a 2×2 of cells; Term structure
became a tenor-chip ribbon; Fresh positioning / Off-exchange capped at 3 rows; Setups as a 2-col-span
grid of cards.

**This lane's residual close-out**, three commits:

- **`a3d53244`** — `ticker-context-grid`'s CSS-grid default `align-items: stretch` was forcing every
  card in a row to the tallest sibling's height (all three of row 1's cards reported the identical
  464px). Added `alignItems: 'start'` (the design's own `.ctx-grid` has no such override either — its
  cards just don't vary enough for stretch to show). `gridTemplateColumns` became responsive on the
  theme's own breakpoint tokens (`tablet`/`laptop`/`wide`, `theme.ts:86`) matching
  `design/src/screens/responsive-spec.mjs`'s "Context band" row (1 col below 768, 2 from 768, 3 from
  1100, 4 from 1600) — the bare `repeat(3,...)` this replaced never reflowed below laptop width,
  squeezing all nine cards into three ~110px columns at 390px. `MarketContext.tsx`'s `BasisLine`
  (each cell's as-of/provenance sentence, one ~150 characters) was wrapping to 3–5 lines at the
  cell's ~162px width — the largest single driver of Market context's height; truncated to one line
  - ellipsis + a `title` attribute carrying the full text (the canon requirement "every card keeps
    its basis and as-of line" stays literally true — the full text is still in `textContent`, CSS
    truncation doesn't touch the a11y tree). `DealerFlowProjection.tsx`'s `LimbCard` dropped its
    bordered `Card`/`CardContent` wrapper (~30px of padding per limb) for a plain `Box`; tightened
    label margin and the limb grid's gap.
- **`119bf485`** — `Setups.tsx`'s cards used the same bordered `Card`/`CardContent` chrome; re-skinned
  to a plain `Box` matching the design's compact card (`padding: 12px 14px`, one hairline border, no
  elevation).

**Design anchor:** `desk.mjs:395-421` (`ctx-head`/`ctx-grid`), `:43` (grid), `:413` (Market context
cells), `responsive-spec.mjs` (breakpoints). **Files:** `TickerDashboard.tsx`, `MarketContext.tsx`,
`DealerFlowProjection.tsx`, `Setups.tsx`. **Commits:** `a3d53244`, `119bf485` (plus `d5362a82` above).

**Measured**, `ticker-context-grid` at 1280: **1,162px → 1,084px → 1,052px** (design 673px).
Row 1 (dealer flow / market context / term structure), all three previously stretched to 464px:
**387 / 345 / 172px** — each at its own natural height now.

**Residual, named.** The band is still 1,052px against the ≤800px threshold. Two items are why,
neither closed this lane:

- **Setups genuinely carries more real data than the design's mockup.** The design's `ctx-2` setups
  example shows 2 cards (248px total at 390px width); the real bundle
  (`_tools/spy-bundle-2026-09-08T1059Z.json`) has **3** setups (`Gamma-flip transition`,
  `Trend regime`, `Pin confluence`, each a genuine 74–95 character rationale) — 50% more real content
  than the mockup shows, which a 2-column grid wraps to 2 rows. Not a density defect once checked
  against real data volume; not chased further.
- **The pre-existing, already-disclosed IvRank residual** (`d12a08bf`'s own commit message): IvRank
  is not in the design's enumerated `ctx-grid` card list; kept rather than silently deleted (an
  owner-ruling item, per that commit). Its presence shifts every later card one slot, so Off-exchange
  and Setups land one row later than the design and Add-widget is forced onto its own fourth row
  (+85px). Both are content decisions (which fields a widget shows, whether to remove a widget)
  outside this pass's layout-only mandate — not resolved here.
- Dealer flow (387px) and Market context (345px) both still run above the design's ≈267px per-card
  target even after the density pass — the remaining gap is the shared `Widget` chrome (~116px,
  common to every widget on the page) and, for Dealer flow specifically, the `AccessibleHelp` info
  button's touch-target floor (~36px × 2 limbs) plus 4 real detail lines (horizon/date, per-day base,
  illustrative move, negation) the design's compact `flowLimb` row doesn't show at all — a
  content-vs-density tension, not resolved here by cutting fields.

### 3. Masthead (F3)

**First pass** (`65d29ebb`, prior lane): dropped the raised-panel chrome (border/fill/shadow/radius) for
bare-on-the-ink; one chip row (regime + connection chip + last-trade); a new second line (levels /
structure-as-of / expirations); dropped the bare ticker input (embedded variant) — the ⌘K palette is
the entry point now. The bundle carries no prior close / signed change / instrument name
(`market_state` has `price`/`gex_spot` only) — filed as an API follow-up in RESUME.md, not faked.

**This lane's residual close-out** (`bea3aed2`): `TickerToolbar.tsx`'s `Segment` rendered each
control's caps label **above** the control (a vertical `Stack`, two lines tall per segment) against
the design's own one-line `.field` (`design/src/lib.mjs:57`: `height: 36px`, label and value on the
same row). Re-skinned `Segment` to a horizontal row — same `Select`/`PersonaPicker` children, same
ids/testids/`aria-label`, only the wrapping layout changed. `CommandDeck.tsx`'s three-tier
`Stack spacing={2}` (32px of pure gap) tightened to `spacing={1.5}` (the design merges tier 1+2 into
one row before `.quick`, so it only carries one such gap where this masthead carries two).
**Design anchor:** `desk.mjs:255-288` (`.mast`), `lib.mjs:57` (`.field`). **Files:** `TickerToolbar.tsx`,
`CommandDeck.tsx`. **Commit:** `bea3aed2`.

**Measured:** `command-deck` **265px → 243px** (design 186px).

**Residual, named.** Still 43px over the ≤200px threshold. `ticker-toolbar` itself closed most of its
own gap (73px → 60px); the remainder is tier 1 (`TickerHeader`'s chip row + headline + second meta
line, ~90px), untouched this lane — it was purpose-built by the F3 first pass with its own extensive
justification (the omitted change/%, the relocated Levels-@/Structure-as-of line) and folding it
further wasn't named in this lane's remaining-work scope.

### 4. Read strip (F4)

First pass only (`29dff32a` re-framed to the design's hairline grid + ring + sub-captions;
`d08822bc` restored the full-bento-row span the rewrite had dropped). Not touched this lane beyond
verification. **Measured:** `widget-read-strip` 131px (threshold ≤130px — 1px over, effectively met);
8 cells present (`read-strip-cell-opportunity`…`-offExchange`), rail width 1,150px inside a 1,152px
widget — none clipped.

### 5. Term structure (F9)

First pass only (`b4fa9253` — theme-derived colours via `extrasFor(theme)`, the hex-discipline test
exemption removed). Not touched this lane. **Verified this lane:** direct inspection of
`app/desk-real-1280-light.png` (not the composite — see "A visual false alarm" below) — the term
structure card renders correctly on the light `rgb(246,246,243)` page background; no dark-filled
canvas anywhere in the band.

### 6. Hero residuals (F10)

First pass only (`89fd41e9`). Not touched this lane (cheap-only scope; nothing new surfaced against
it this pass).

## Composition table — audit baseline → after the first pass → after this lane

All heights are full-page CSS px from the harness's DOM census (`ticker-repair-after/app/*.json`),
production build, `desk-real` scenario (the real SPY bundle, AI idle).

| width / scheme | audit baseline (pre-repair) | after first pass (inherited) | after this lane | threshold                         | met?               |
| -------------- | --------------------------- | ---------------------------- | --------------- | --------------------------------- | ------------------ |
| 1440 dark      | 4,046                       | 3,251                        | **2,818**       | ≤ 2,950                           | **met**            |
| 1280 dark      | 4,046                       | 3,251                        | **2,818**       | ≤ 3,000 (design 2,570)            | **met**            |
| 834 dark       | 5,166                       | 4,145                        | **3,848**       | ≤ 4,170 (design 3,336 +25%)       | **met**            |
| 390 dark       | 6,999                       | 6,951                        | **5,566**       | ≤ 5,474 (design 4,379 +25%)       | missed by 92       |
| 1280 light     | 4,046                       | —                            | **2,818**       | no dark-filled canvas in the band | **met** (verified) |

`overflowX`: **false** at every width, both before and after this lane's work.

| region (1280 dark)             | audit baseline          | after first pass (inherited) | after this lane  | design       | threshold                            | met?                       |
| ------------------------------ | ----------------------- | ---------------------------- | ---------------- | ------------ | ------------------------------------ | -------------------------- |
| `command-deck` (masthead)      | 273                     | 265                          | **243**          | 186          | ≤ 200                                | missed by 43               |
| `widget-read-strip`            | 209                     | 131                          | **131**          | 112          | ≤ 130, 8 cells, none clipped         | 1px over (effectively met) |
| `widget-ai-rec` vs side column | 344w vs full-width tape | 759w vs 379w                 | **759w vs 379w** | 793w vs 396w | AI wider than side; side ≤ 420       | **met**                    |
| `widget-live-tape`             | 209 (full width)        | 533                          | **318**          | 295          | (part of the ≤420-side-column check) | **closed to 23px**         |
| `ticker-context-grid` (band)   | ≈2,125                  | ≈1,250\*                     | **1,052**        | 673          | ≤ 800                                | missed by 252              |

\* the inherited-baseline "≈1,250" figure is this lane's own first re-measurement (`ticker-context-grid`
1,162px), taken immediately after finishing the interrupted Market context edit — the true
pre-edit-completion number was unmeasurable (the component didn't typecheck / would throw on render).

Region-level before/after inside the context band (1280 dark, row 1 — the row that was stretching):

| widget                          | before (stretched) | after `alignItems:'start'` + density | design |
| ------------------------------- | ------------------ | ------------------------------------ | ------ |
| `widget-dealer-flow-projection` | 464                | **387**                              | 267    |
| `widget-market-context`         | 464                | **345**                              | 267    |
| `widget-term-structure`         | 464                | **172**                              | 267    |

## A visual false alarm, recorded so it isn't repeated

The `pairs/desk-real-1280-light.jpg` **composite** (built by `_tools/pairs.py`, a resize+paste of the
raw PNGs) rendered the app side looking dark on first inspection. Direct inspection of the source
`app/desk-real-1280-light.png` (full resolution, not the composite) and the JSON census's own computed
probes (`htmlBackground`/`bodyBackground`: `rgb(246, 246, 243)` — the light "paper" token) confirm the
capture **is** correctly light-scheme; this was a misreading of the reduced-scale composite thumbnail,
not a rendering defect. Recorded here in case a future pass trusts the composite over the source PNG.

## Verification (exit codes)

| gate                  | command                                                                                                                                                                                                    | result                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| typecheck             | `npx nx typecheck @convexa/dashboard --skip-nx-cache`                                                                                                                                                      | **exit 0**                                            |
| unit/component tests  | `npx nx test @convexa/dashboard --skipNxCache` (`node_modules/.vite` cleared first)                                                                                                                        | **exit 0** — 239 files / 2,905 tests                  |
| lint                  | `npm run lint`                                                                                                                                                                                             | **exit 0** (4 pre-existing warnings, unrelated files) |
| format                | `npm run format:check`                                                                                                                                                                                     | **exit 0**                                            |
| `apps/api` diff       | `git diff --stat origin/main...HEAD -- apps/api`                                                                                                                                                           | **empty**, throughout                                 |
| NUL scan              | byte scan of every file this task touched (both lanes, incl. specs)                                                                                                                                        | **0** in every file                                   |
| composition (harness) | `npx nx build --configuration=production` + `playwright test --config playwright.audit.config.ts --grep desk-real`                                                                                         | **11/11 passed** — see table above                    |
| e2e                   | `BROWSER_QUALITY_PREBUILD_STATUS=pass npx nx e2e dashboard-e2e -- --grep "desk\|curvature\|overflow"` (production build, ports 4200/4310 freed manually — not `npm run ports:free`, which also frees 8000) | **exit 0** — 108/108 passed, 0 flaky                  |

**Assertion edits this lane:** none. Every spec this lane's changes touch
(`MarketContext.spec.tsx`, `DealerFlowProjection.spec.tsx`, `LiveTape.spec.tsx`, `CommandDeck.spec.tsx`,
`ticker-hierarchy.spec.tsx`, `ticker-age-basis.spec.tsx`, `quiet-band.register.spec.tsx`) passed
unmodified — every change this lane made was a layout/chrome change behind an existing testid, not a
change to pinned copy or a pinned DOM slot. (The first pass's own assertion edits are in its commits'
own messages, not repeated here.)

## GATE Z items

Filed in `.spire/clusters/tech/state/spire-curvature-v2-foundations/RESUME.md` under its own
`⬆ UPDATE` heading (2026-09-08, "ticker fidelity repair lane resumed"):

1. **Live tape's flow-spark row** (design: a 30-point, 10s-sampled `net_flow` trail) has no wire
   equivalent — `LiveUpdateBody` carries only the current scalar. Not built (would require either
   fabricated data or a new, undecided client-side accumulation feature touching the stream-isolation
   area the must-not-change list protects).

(The first pass's own GATE Z item — the masthead's omitted signed change/%, instrument name — is
already filed in RESUME.md from that pass; not repeated here.)

## Residuals seen but not fixed (named, not silently dropped)

- **Context band still 1,052px vs the ≤800px threshold** (design 673px) — see "Residual, named" under
  change 2 above: Setups' real data volume (3 setups vs the design's 2-example mockup), the disclosed
  IvRank/Add-widget-row residual, and the shared-`Widget`-chrome + real-field-count floor under Dealer
  flow / Market context's remaining height.
- **Masthead still 243px vs the ≤200px threshold** (design 186px) — tier 1 (`TickerHeader`), untouched.
- **390px still 5,566px vs the ≤5,474px threshold** — 92px over, down from 1,385px over at the start of
  this lane. `widget-structure-hero` is 1,137px tall at 390px (the tallest single item on the page at
  that width) — **observed, not touched**: it is on the must-not-change list (`StructureHeroPanel` "as
  repaired"). The AI-read panel renders 364px in normal document flow at 390px in this capture;
  investigated and confirmed **not a defect** — `ReadSheet.tsx:82`'s documented behaviour
  ("`verdict == null` → render children directly... no collapse state, no peek row") is correct for
  the AI-idle state this `desk-real` scenario drives; the bottom-sheet mechanism itself is
  must-not-change and wasn't touched.
- Read strip is 1px over its 130px threshold (131px) — not worth chasing; effectively met.

## Screenshots and evidence

All under `.spire/clusters/tech/state/spire-curvature-v2-foundations/ticker-repair-after/` (repo-relative;
PNGs are gitignored there per that folder's own `.gitignore` — JSON/JPG/tools are committed):

- `pairs/desk-real-{1440,1280,834,390}-dark.jpg`, `pairs/desk-real-1280-light.jpg` — side-by-side
  app|design composites, captioned with measured page heights.
- `crops/app-{masthead,read-strip,live-tape,market-context,dealer-flow,ai-read,hero,nav}-real-1280-dark.png`
  and the `design-*` counterparts; `crops/sizes-real-1280-dark.json` — the measured sizes table quoted
  above.
- `app/desk-real-*.json`, `design/desk-real-*.json` — the full DOM census (page height, overflowX,
  every region's x/y/w/h, computed-style probes) this report's numbers are read from.

## What I could not verify

- Visual states beyond the `desk-real` (AI-idle) scenario — the fixture-driven `desk-trade` (produced
  AI read) and `desk-signed-out` scenarios were not re-captured this lane (out of this task's grep
  scope, `--grep "desk-real"`); the first pass's own audit evidence
  (`fidelity-audit-2026-09-08/pairs/desk-trade-*`) is the only record of those states post-repair.
- Real-backend behaviour — per the original audit's own limits note, the vendor feed was reconnecting
  during the original audit and this task's captures also render the saved 2026-09-08T10:59Z bundle
  through the strict fixture, never a live `/api/ticker/SPY` response. `AUDIT_LIVE=1` is the harness's
  documented mode for that; not run this lane.

## Conductor's cold re-verification (2026-09-08, the Mac session — not the lane's numbers)

Re-run from a clean tree at `810da249` without reusing anything the lane produced: fresh production
build (`--skip-nx-cache`) → the audit harness into a **separate** folder (`ticker-repair-verify/`) →
the desk e2e; the unit suite, typecheck, lint and format run again from cold.

| gate                                                    | result                               |
| ------------------------------------------------------- | ------------------------------------ |
| `npx nx typecheck @convexa/dashboard --skip-nx-cache`   | exit 0                               |
| `npx nx test @convexa/dashboard --skipNxCache`          | exit 0 — 239 files / **2,905** tests |
| `npm run lint`                                          | exit 0 (4 pre-existing warnings)     |
| `npm run format:check`                                  | exit 0                               |
| `git diff --stat origin/main...HEAD -- apps/api`        | empty                                |
| NUL scan, all 63 text files both lanes touched          | 0                                    |
| harness `--grep desk-real` against the fresh build      | 11/11, exit 0                        |
| e2e `desk\|curvature\|overflow` against the fresh build | **108/108, 0 flaky, exit 0**         |

**Every composition number matches the lane's to the pixel** (`ticker-repair-verify/app/*.json`):
page 2,818 at 1440 and 1280 (dark and light), 3,848 at 834, 5,566 at 390; `command-deck` 243,
`widget-read-strip` 131, `widget-ai-rec` 759 wide beside a 379 side column, `widget-live-tape` 318,
band span 1,052; `overflowX` false everywhere; the light capture's ground is `rgb(246,246,243)` with
no dark-filled canvas. Note the design side is now measured on the **rebuilt** oracle (the generator
leak fix, `ad1e7696`), so its heights moved a little: 2,532 at 1280 (was 2,570), 2,483 at 1440,
3,290 at 834, 4,416 at 390 — the 390 miss is therefore 46 px against the +25 % rule, not 92.

**Against the audit baseline at 1280:** page 4,046 → **2,818** (1.57× → **1.11×** the design);
masthead 273 → 243; read strip 209 → 131; AI read half-width → wide; live tape full-width 209 →
side-column 318; band ≈2,125 → 1,052; term structure 470 → 172 and scheme-correct. Composites:
`ticker-repair-verify/pairs/desk-real-*.jpg`.

**One phone-width defect the lane observed but could not touch (hero = must-not-change):** at 390
the hero's header collapses — the title truncates to `S…` and the subtitle wraps one word per line
into a ~70 px column, because the header's action cluster (the new `● mid · tape` chip + the
`FIELD | MAGNET` toggle) does not wrap at that width. Evidence:
`ticker-repair-verify/crops/app-hero-real-390-dark-top.png` vs `design-hero-real-390-dark-top.png`
(the design keeps the chip beside the title, the subtitle full width, and drops the legend). This is
most of the hero's 1,137 px at 390 (design 905) and most of the phone's remaining 46 px miss. Fix is
bounded to the hero header's wrap rule below a ~480 px container; needs the owner's leave because the
hero was fenced for this lane.

**Verdict on the lane:** accepted as landed — the four fenced regions moved from far to close, every
gate is green cold, nothing was faked, and the three misses are named with causes. The residual
decisions are the owner's (masthead tier-1 row, the IvRank card's place in the band, the phone hero
header, the flow-spark data) and are listed in `RESUME.md`.

## Pass 2 — owner: "Do all four" (2026-09-08)

Direct repair lane on `TICKER_FIDELITY_REPAIR_TASK.md`'s `## Pass 2` section, closing three of the
owner's four accepted recommendations from the conductor's cold re-verification above (the fourth,
the Live tape flow sparkline, is filed as a **backend** item in `context/BACKLOG.md`, "Harvest —
2026-09-08" — not built here, `apps/api` stays untouched throughout). `NO_BACKEND_CHANGE` held: the
`apps/api` diff is empty from start to finish (quoted below). Started from a clean tree at `1eb2a454`.

### Commits (chronological)

| commit     | change                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| `1d84505a` | change 7 — hero header collapse at 390 fixed; the shared `Widget` header's title region now keeps the row below `sm`     |
| `ed1671f6` | change 8 — `IvRank` unmounted from the context band (owner ruling)                                                       |
| `1f8b606e` | change 9 — the masthead's controls join the headline row at ≥ laptop (1100)                                              |
| `b91b59ff` | fix — sync the browser-quality manifest to change 8's e2e describe rename (found at the e2e gate, not a numbered change) |

No GATE Z items this pass — every ambiguity change 7/8/9 raised was already resolved by the task's
own text (the owner-granted header exception, the `context-band-is-the-designs-card-list` ruling, and
the exact breakpoint/mechanism change 9 names) or by this lane's own testing-strategy judgment (change
8's assertion moves, below), not a missing contract field or a must-not-change conflict.

### 7. Hero header collapses at 390 (owner leave granted for the header only)

**What changed.** `shared/ui/Widget/Widget.tsx`'s header title region was `flex: 1` — a **0% flex
basis** — so its "hypothetical main size" for the flex-wrap line-fitting check was ~0: the browser
always found room for it beside the non-shrinking `actions` region by squeezing the title to nothing
(`S…`) instead of ever triggering `flexWrap: { xs: 'wrap', sm: 'nowrap' }`. Below `sm` the title
region now carries `flexBasis: { xs: '100%', sm: 'auto' }` — it keeps the full row, deterministically
pushing `actions` to row two instead (matches `design/src/lib.mjs:439`'s `widgetHead`: title [+ its
own `live` chip] on one row, `actions` the next). A new opt-in `titleBadge` prop renders content
**beside the title, in that same row** — a different region from `actions`, which is why
`StructureHeroPanel.tsx`'s `● mid · tape` chip (`MidTapeChip`) moved from `actions` into
`titleBadge`: it keeps that adjacency post-wrap, while the Field/Magnet toggle (still in `actions`)
now lands on row two alone. The field legend was already hidden below the 1000 px container
(`StructureHeroPanel.tsx`), unaffected. `titleBadge` is unset by default — every other widget's
header is byte-identical except for the (uniform, verified) `flexBasis` fix.

**Files:** `shared/ui/Widget/Widget.tsx`, `shared/ui/Widget/Widget.spec.tsx`,
`pages/ticker/widgets/structure-hero/StructureHeroPanel.tsx`. **Commit:** `1d84505a`.
**Design anchor:** `design/src/lib.mjs:439` (`widgetHead`), `design/src/screens/desk.mjs:289-296`.

**Assertion edits:** none — `StructureHeroPanel.spec.tsx`'s existing "● mid · tape chip" tests
(presence/text/live-gating) pass unmodified; they never asserted the chip's container, only its
presence and gating.

**Tests (new, `Widget.spec.tsx`):** a mutation-guard source scan pinning the `flexBasis` fix; a
default-render check (no `titleBadge` → the header renders exactly as before, byte-identical
`textContent`); a presence/placement check (`titleBadge` renders in the title's own row group, a
different ancestor than `actions`); an absence check (unset → nothing extra in the DOM).

**Measured** (`ticker-repair-after/app/desk-real-390-dark.json`, region census):
`widget-structure-hero` **1,137 px → 968 px** (design 905; threshold ≤ 950 — **missed by 18 px**, was
missed by 187). Page at 390: **5,566 px → 5,484 px** (threshold ≤ 5,520; design 4,416 + 25 % — **met**,
was missed by 92). Visual confirmation:
`ticker-repair-after/app/desk-real-390-dark.png` cropped at the hero
(`/private/tmp/.../hero-390-header.png` this session, not repo-committed — see "Screenshots" below)
shows the full, untruncated "Structure field" title beside the "● mid · tape" chip on one row, the
subtitle wrapping normally across the full width, and the Field/Magnet toggle on its own row below —
the exact shape the crop evidence (`ticker-repair-verify/crops/app-hero-real-390-dark-top.png`) named
as broken. **Shared-header sweep** (the task's own instruction — "check every desk widget's header at
390, not just the hero"): every other widget header at 390 (read strip, AI recommendation, Live tape,
Simulated orders, the eight context-band cards) inspected directly in the fresh capture — no
truncation, no cramped wrap; `widget-orders`' title now renders in full with its `SIMULATED` chip and
"All orders →" link correctly wrapped to their own row beneath it, an incidental improvement from the
same fix.

**Residual, named.** `widget-structure-hero` is still 968 px against the ≤ 950 threshold (design 905) — 18 px over, down from 187 over before this pass. Not chased further (the hero's canvas/ladder
interior is must-not-change; the remaining gap reads as ordinary content-length variance against the
design's shorter mock subtitle/ladder values, not a wrap defect — the header itself is now visually
correct).

### 8. Remove the `IvRank` card from the context band (owner ruling)

**What changed.** `IvRank` unmounted from `TickerDashboard.tsx`'s context band (was `:794-801`) per
the owner ruling recorded in `context/DECISION_LEDGER.md`
(`context-band-is-the-designs-card-list`, 2026-09-08 "Do all four"): the design's `ctx-grid`
(`desk.mjs:395-421`) never had this card, and it repeats the read strip's own `IV rank` cell. This is
an **unmount, not a deletion** — `widgets/iv-rank/IvRank.tsx` and its own unit spec stay; the `iv_rank`
wire field itself is untouched and still feeds the read strip's cell (`TickerDashboard.tsx:584`).

**Files:** `pages/ticker/TickerDashboard.tsx`. **Commit:** `ed1671f6`.
**Design anchor:** `design/src/screens/desk.mjs:395-421` (the `ctx-grid` card enumeration).

**Assertion edits** (the widget's DOM presence was pinned in six places; listed with reasons):

- `pages/ticker/ticker.risk.spec.tsx` — `STATIC_WIDGETS` (the static-byte-identity sample) and
  `NULLABLE_SECTIONS` (the null matrix) drop the `widget-iv-rank`/`iv_rank` entries: the invariants
  they prove stay covered by the sample's other members. The "wire-label authority" test drops its
  iv-rank-band fixture/assertions (three examples remain: trend direction, term-structure state,
  gamma regime) and its title's parenthetical. The "model-read self-description" test drops its
  iv-rank half (dealer-flow-projection remains) and its title.
- `pages/ticker/widgets/iv-rank/IvRank.spec.tsx` — the two dropped page-level cases **moved here**
  rather than being silently lost: "wire band beats a scalar-derived rank label"
  (`IvRank.tsx:165` reads `read.band` only, via the closed `ivrBandDisplay` lookup, never `read.rank`)
  and "the rank value and its basis element share the widget body" — both are properties of the
  component itself, testable in isolation, and the page-level suite can no longer exercise them once
  unmounted; this file's own docblock already reserves exactly this division of labor.
- `pages/ticker/ticker-hierarchy.spec.tsx` — the DOM-order test drops `widget-iv-rank` from its
  enumeration and its title (was "... term structure → (IV rank, kept) → straddle move ...").
- `pages/ticker/ticker-desk-composition.spec.tsx` — `QUIET_BAND_WIDGETS` (criterion 47's isolation
  sample) drops `widget-iv-rank`, same reasoning as `STATIC_WIDGETS` above.
- `apps/dashboard-e2e/src/e2e/curvature-v2.spec.ts` — `HOVER_INFO_WIDGETS` (AC-35) and
  `FRAME_INFO_SITES` (U-32) drop `iv-rank`; the "eight frame roots"/"eight live `info=` sites" prose
  (top docblock, U-32's own comment block, the criterion-66 cross-reference, and the U-32
  `test.describe` title) all become "seven", each noting this change as the reason. Checked whether
  AC-35's site count is asserted anywhere else (`grep -rn "eight\|FRAME_INFO_SITES.length"
apps/dashboard-e2e/src`) — no `.length` assertion exists anywhere, only prose; ruling 6's own
  historical "four widgets / six sites" text is left intact (still factually true about what ruling 6
  named) with a note that only three of the four are still on the page to test.
- `apps/dashboard-e2e/src/quality/manifest.json` (commit `b91b59ff`, found at the e2e gate, not
  during the vitest/typecheck passes) — the U-32 describe-title rename above changed the STRING the
  `quality-reporter.ts` reporter looks up by (`file`, `project`, `title_path`) exact match; the four
  matching manifest records' `title_path[0]` updated "eight" → "seven" (the opaque `test_id` values
  are untouched — same tests, renamed, not new tests).

**Measured** (`ticker-repair-after/app/desk-real-1280-dark.json`): `ticker-context-grid`
**1,052 px → 968 px** (design 673; ≈ 970 was this task's own predicted value — matched almost exactly).
Against the ≤ 800 px density threshold: **missed by 168 px** (was missed by 252) — **the ≤ 800 target
stays an open owner item, per the task's own instruction not to cut fields to reach it; no field was
cut.** Visual confirmation: the context band composite (`pairs/desk-real-1280-dark.jpg`) shows exactly
the design's eight-card set (Projected dealer flow, Market context, Term structure, Straddle-implied
move, Fresh positioning, Off-exchange blocks, Setups, Add widget) — `IvRank` is gone, nothing else
shifted in content.

### 9. Masthead: the controls join the headline row at ≥ laptop (1100)

**What changed.** The design's `.mast-row` (`desk.mjs:255-274`) puts `EXPIRATIONS` / `PERSONA` / the
one amber CTA on the headline's right (`.mast-controls`: one flex row, fields then the button,
`align-items: center`), ahead of the chip row, the second line and the quick row. The shipped masthead
instead stacked `TickerHeader` (tier 1) above `TickerToolbar` (tier 2) above `QuickSymbols` at every
width. Fixed at `theme.breakpoints.up('laptop')` (1100 px) — the SAME breakpoint authority
`TickerHeader.tsx`'s own `xs: column / sm: row` hero-row switch already uses, generalized to the next
named token (the same one `TickerDashboard.tsx`'s context-band grid already keys off, and the same
1100 canon rule 19 already uses for the nav's own search-to-icon collapse — not an arbitrary number).

`CommandDeck.tsx` computes `controlsJoinHeadline` via MUI's `useMediaQuery` — the established
`ai-rec/ReadSheet.tsx` idiom, which degrades to `false` when `window.matchMedia` is absent (jsdom, so
unit tests keep exercising today's stacked arrangement by default unless they explicitly stub it) —
and builds exactly **one** `<TickerToolbar>` element, mounted in exactly one of two places: inside
`TickerHeader`'s new `inlineControls` slot (headline row, before the CTA) when true, or in its own
tier-2 row when false. Never both — there is never a duplicate id/testid in the DOM. Below 1100,
today's stacked order is byte-unchanged. `TickerToolbar`'s new `inline` prop (only meaningful with
`embedded`) drops the full-width-plus-top-divider chrome that only makes sense for the standalone
tier-2 strip — nothing to divide from when sitting beside the CTA instead of below the header. Same
`Select`/`PersonaPicker` children, same ids/testids/`aria-label`s either way.

**Files:** `pages/ticker/widgets/chrome/CommandDeck.tsx`,
`pages/ticker/widgets/chrome/CommandDeck.spec.tsx`, `pages/ticker/widgets/chrome/TickerHeader.tsx`,
`pages/ticker/widgets/chrome/TickerToolbar.tsx`. **Commit:** `1f8b606e`.
**Design anchor:** `design/src/screens/desk.mjs:255-274` (`.mast-row`/`.mast-controls`),
`design/src/lib.mjs:57` (`.field`).

**Assertion edits:** none — every pre-existing `CommandDeck`/`TickerHeader`/`TickerToolbar` test
passed unmodified (confirmed: `widgets/chrome` directory 48/48 before the new tests were added, then
52/52 after; `TickerHeader.faulted.spec.tsx`/`TickerHeader.liveStatus.spec.ts` both green, no
ancestor-chain assumptions broken by the new wrapping `Stack` around the CTA).

**Tests (new, `CommandDeck.spec.tsx`, 4):** below laptop (default, unmocked `matchMedia`) — exactly
one toolbar mounts, and the CTA precedes it (today's tier-2 order). At ≥ laptop (`matchMedia` stubbed
for the exact `theme.breakpoints.up('laptop')` query, the same `vi.stubGlobal` idiom
`ai-rec/ReadSheet.spec.tsx` established) — exactly one toolbar mounts, and it now **precedes** the CTA
(both inside `TickerHeader`'s own row) — the mechanical proof the join actually happened, not just
that nothing crashed. The same ids/`aria-label`s stay reachable (`Expirations`, no bare `Ticker`
field). The Expirations tri-state wiring still fires the same callback once relocated.

**Measured** (`ticker-repair-after/app/desk-real-{1280,1440}-dark.json`): `command-deck`
**243 px → 215 px** (design 186; threshold ≤ 200 — **missed by 15 px**, was missed by 43) at **both**
1280 and 1440 (byte-identical at both widths — the page's own content max-width caps the deck the
same either way). At 834 and 390 (below 1100): `ticker-toolbar` still renders in its own tier-2 row
(`y=212, h=60` at 834), byte-unchanged; `overflowX` false at both.

**Residual, named — root cause verified by direct measurement, not guesswork.** Still 15 px over the
≤ 200 threshold. Breaking down `command-deck`'s own 215 px (`pt` 20 + headline-block + tier1↔tier3
gap 12 + `quick-symbols` 37 + `pb` 12): the headline block itself is **134 px joined vs. 91 px
unjoined** (measured directly from the same capture at 834, where the toolbar is NOT joined) — a real
**+43 px** the join adds. Cause: `TickerHeader`'s own chip row (`negative gamma` · the connection chip
· `Last trade`) has `flexWrap: 'wrap'` and, once the right region widens from "CTA only" (~161 px) to
"toolbar + CTA" (~589 + 161 px, confirmed in the census), the LEFT column's available width shrinks
enough that its own chip row now wraps to **two lines** instead of one (visible directly in
`pairs/desk-real-1280-dark.jpg`: "negative gamma · live · Last trade" split across two lines, where
the design's own mockup — with fewer/shorter chips, since this bundle omits the instrument name per
the standing API-follow-up GATE Z — fits on one). This is a genuine content-width tension the same
kind as the band's Setups residual above, not a bug in the join itself; fixing it would mean touching
either the chip row's own wrap rule or the toolbar/CTA cluster's width, neither of which change 9's
instruction (place the controls in the row) licenses — named here, not chased.

## Composition table — Pass 2 (before = the conductor's cold-verified numbers, above)

| width / scheme | before this pass | after this pass | design | threshold                         | met?                       |
| -------------- | ---------------- | --------------- | ------ | --------------------------------- | -------------------------- |
| 1440 dark      | 2,818            | **2,705**       | 2,483  | ≤ 2,950                           | **met**                    |
| 1280 dark      | 2,818            | **2,705**       | 2,532  | ≤ 3,000                           | **met**                    |
| 834 dark       | 3,848            | **3,628**       | 3,290  | ≤ 4,170 (3,290 + 25 %)            | **met**                    |
| 390 dark       | 5,566            | **5,484**       | 4,416  | ≤ 5,520 (4,416 + 25 %)            | **met** (was missed by 92) |
| 1280 light     | 2,818 (parity)   | **2,705**       | —      | no dark-filled canvas in the band | **met** (verified)         |

`overflowX`: **false** at every one of the five captures, before and after this pass.

| region                              | before this pass | after this pass             | design      | threshold               | met?                                  |
| ----------------------------------- | ---------------- | --------------------------- | ----------- | ----------------------- | ------------------------------------- |
| `command-deck` @ 1280 & 1440        | 243              | **215**                     | 186         | ≤ 200                   | missed by 15 (was 43)                 |
| `widget-structure-hero` @ 390       | 1,137            | **968**                     | 905         | ≤ 950                   | missed by 18 (was 187)                |
| `ticker-context-grid` (band) @ 1280 | 1,052            | **968**                     | 673         | ≤ 800 (open owner item) | missed by 168 (was 252)               |
| `widget-ai-rec` vs side @ 1280      | 759w / 379w      | **759w / 379w** (unchanged) | 793w / 396w | side ≤ 420              | **met**                               |
| `widget-read-strip` @ 1280          | 131              | **131** (unchanged)         | 112         | ≤ 130, 8 cells          | 1px over (unchanged, effectively met) |

Every region this pass did not touch (read strip, AI-read/side-column width, Live tape) is
byte-identical to the conductor's own numbers — confirmed, not assumed.

## Verification (exit codes) — Pass 2

| gate                  | command                                                                                                                                                              | result                                                                                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| typecheck             | `npx nx typecheck @convexa/dashboard --skip-nx-cache`                                                                                                                | **exit 0**                                                                                                                                                                            |
| unit/component tests  | `npx nx test @convexa/dashboard --skipNxCache` (`node_modules/.vite` cleared first)                                                                                  | **exit 0** — 239 files / **2,914** tests (was 2,905; net +9 — Widget.spec.tsx +4, IvRank.spec.tsx +2, CommandDeck.spec.tsx +4, ticker.risk.spec.tsx's `NULLABLE_SECTIONS` it.each −1) |
| lint                  | `npm run lint`                                                                                                                                                       | **exit 0** (4 pre-existing warnings, unrelated files — same as the conductor's baseline)                                                                                              |
| format                | `npm run format:check`                                                                                                                                               | **exit 0**                                                                                                                                                                            |
| `apps/api` diff       | `git diff --stat origin/main...HEAD -- apps/api`                                                                                                                     | **empty**                                                                                                                                                                             |
| NUL scan              | byte scan of every file this pass touched (13 source files + `manifest.json`)                                                                                        | **0** in every file                                                                                                                                                                   |
| composition (harness) | `npx nx build --configuration=production --skip-nx-cache` + `AUDIT_OUT=.../ticker-repair-after playwright test --config playwright.audit.config.ts --grep desk-real` | **exit 0**, **11/11 passed** — see tables above                                                                                                                                       |
| e2e                   | `BROWSER_QUALITY_PREBUILD_STATUS=pass npx nx e2e dashboard-e2e -- --grep "desk\|curvature\|overflow"` (production build, ports 4200/4310 freed manually)             | **exit 0** — **108/108 passed, 0 flaky** (first attempt was exit 1 — a stale browser-quality manifest identity, fixed in `b91b59ff`, see change 8's assertion edits)                  |

Directory-scoped counts along the way (`pages/ticker`, a subset of the dashboard-wide total above):
73 files / 951 tests immediately after changes 7+8, 73 files / 955 after change 9 (+4, matching
`CommandDeck.spec.tsx`'s new tests) — both exit 0.

## GATE Z items — Pass 2

None. Every decision point this pass reached was already resolved by the task's own text (the
owner-granted header exception for change 7, the `context-band-is-the-designs-card-list` ruling for
change 8, the exact breakpoint/mechanism named for change 9) or was a testing-strategy call within
this lane's own discretion (change 8's assertion moves into `IvRank.spec.tsx`, listed above with
reasons) — never a missing contract field or an unresolved must-not-change conflict.

## Residuals seen but not fixed — Pass 2

- **`command-deck` still 215 px vs the ≤ 200 px threshold** (design 186, missed by 15, was missed by 43) — root cause verified: joining the toolbar widens the right region enough that `TickerHeader`'s
  own chip row wraps to two lines at 1280/1440 where the design's shorter mock content does not. Not
  chased (would require touching either the chip row's own wrap rule or the toolbar/CTA cluster's
  width — neither in change 9's scope).
- **`widget-structure-hero` still 968 px vs the ≤ 950 px threshold** (design 905, missed by 18, was
  missed by 187) at 390 — the hero's canvas/ladder interior is must-not-change; the header itself,
  the actual defect this pass fixed, is now visually correct (verified against the crop evidence).
- **`ticker-context-grid` (band) still 968 px vs the ≤ 800 px threshold** (design 673, missed by 168,
  was missed by 252) at 1280 — landed almost exactly at this task's own predicted "≈ 970" value; the
  ≤ 800 density target is explicitly named an open owner item in the task text itself ("do not cut
  fields to reach it") — not chased.
- The pre-existing residuals the conductor's cold verification already named and this pass did not
  touch (the flow-spark sparkline GATE Z, the omitted signed-change/instrument-name API follow-up)
  are unchanged — see `RESUME.md`.

## Screenshots and evidence — Pass 2

Committed, under `ticker-repair-after/` (JSON census + `.jpg` pair composites; `.png` crops are
gitignored per that folder's own `.gitignore`):

- `app/desk-real-{1440,1280,834,390}-dark.json`, `app/desk-real-1280-light.json` — the refreshed DOM
  census this report's numbers are read from (`design/*.json` unchanged — the design source was not
  touched this pass).
- `pairs/desk-real-{1440,1280,834,390}-dark.jpg`, `pairs/desk-real-1280-light.jpg` — refreshed
  side-by-side app|design composites (regenerated via `_tools/pairs.py desk-real` this pass).
- `crops/app-{masthead,hero,read-strip,live-tape,ai-read,dealer-flow,market-context,nav}-real-1280-dark.png`
  and the `design-*` counterparts, `crops/sizes-real-1280-dark.json` — refreshed by the harness's own
  `crops · desk-real-1280-dark` test.

Not repo-committed (PNGs; paths on this machine, per the task's "outside the repo or in
`ticker-repair-after/`" instruction):
`/private/tmp/claude-501/.../scratchpad/hero-390-header.png` (the change 7 hero-header fix, cropped
from `app/desk-real-390-dark.png` at the hero's own y-range — title + chip on one row, subtitle full
width, toggle on its own row below, matching the design shape the original crop evidence named as
broken); `/private/tmp/claude-501/.../scratchpad/all-headers-390.png` (the shared-header sweep — every
other desk widget's header at 390, stitched into one image, confirmed clean); `band-1280-{dark,light}.png`
(the context band without `IvRank`, both schemes — light confirms no dark-filled canvas).

**Verdict on Pass 2:** all three changes landed and measurably closed their named gaps (390 page total
now meets its threshold — was the one page-level miss; the band landed within 2 px of the task's own
predicted value). Two region-level thresholds (`command-deck`, `widget-structure-hero`) and one
already-open owner item (`ticker-context-grid`) remain narrowly missed, each named with a
directly-measured root cause, not a guess — no field was cut and no content was invented to force a
number under a line. Every gate is green cold; `apps/api` stayed untouched throughout.
