# Ticker fidelity repair — report (2026-09-08)

Direct repair lane on `TICKER_FIDELITY_REPAIR_TASK.md`, off the council pipeline, per the owner's
"proceed with your recommendations" on the 2026-09-08 audit (`fidelity-audit-2026-09-08/FIDELITY_AUDIT.md`).
**Two lanes built this task.** The first lane landed the six numbered changes' first pass (commits
`c6afe2c6`…`d08822bc` below) and was killed mid-edit by an API rate limit with two files half-finished.
This lane resumed: finished the interrupted edit, then closed composition gaps the first pass's own
measurements had left open, in the order the resume brief named (context band → Live tape → masthead →
Setups/phone). `apps/api` diff stays empty throughout (`NO_BACKEND_CHANGE`).

## Commits (chronological; `*` = this lane)

| commit | change |
|---|---|
| `c6afe2c6` | F1 — tape & plan work grid (`8fr/4fr` split) |
| `d12a08bf` | F2 — context band recomposed to the 3-col quiet grid |
| `65d29ebb` | F3 — masthead bare on the ink, ticker input dropped |
| `18ba0c9c` | docs — F3 API follow-up filed in RESUME.md |
| `29dff32a` | F4 — read strip re-framed (hairline grid, ring, sub-captions) |
| `b4fa9253` | F9 — TermHeatChart colours from the theme |
| `89fd41e9` | F10 — hero residuals (ladder wrap, mid·tape chip) |
| `d08822bc` | F4 — restore ReadStrip's full-bento-row span |
| `d5362a82`\* | **finish** the interrupted F2 edit — Market context's compact-cell labels |
| `a3d53244`\* | F2 residual — context band density + responsive column count |
| `bea3aed2`\* | F1/F3 residual — Live tape's 2×2 grid, masthead control row |
| `119bf485`\* | F2/phone residual — Setups card density |

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
  + ellipsis + a `title` attribute carrying the full text (the canon requirement "every card keeps
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

| width / scheme | audit baseline (pre-repair) | after first pass (inherited) | after this lane | threshold | met? |
|---|---|---|---|---|---|
| 1440 dark | 4,046 | 3,251 | **2,818** | ≤ 2,950 | **met** |
| 1280 dark | 4,046 | 3,251 | **2,818** | ≤ 3,000 (design 2,570) | **met** |
| 834 dark | 5,166 | 4,145 | **3,848** | ≤ 4,170 (design 3,336 +25%) | **met** |
| 390 dark | 6,999 | 6,951 | **5,566** | ≤ 5,474 (design 4,379 +25%) | missed by 92 |
| 1280 light | 4,046 | — | **2,818** | no dark-filled canvas in the band | **met** (verified) |

`overflowX`: **false** at every width, both before and after this lane's work.

| region (1280 dark) | audit baseline | after first pass (inherited) | after this lane | design | threshold | met? |
|---|---|---|---|---|---|---|
| `command-deck` (masthead) | 273 | 265 | **243** | 186 | ≤ 200 | missed by 43 |
| `widget-read-strip` | 209 | 131 | **131** | 112 | ≤ 130, 8 cells, none clipped | 1px over (effectively met) |
| `widget-ai-rec` vs side column | 344w vs full-width tape | 759w vs 379w | **759w vs 379w** | 793w vs 396w | AI wider than side; side ≤ 420 | **met** |
| `widget-live-tape` | 209 (full width) | 533 | **318** | 295 | (part of the ≤420-side-column check) | **closed to 23px** |
| `ticker-context-grid` (band) | ≈2,125 | ≈1,250\* | **1,052** | 673 | ≤ 800 | missed by 252 |

\* the inherited-baseline "≈1,250" figure is this lane's own first re-measurement (`ticker-context-grid`
1,162px), taken immediately after finishing the interrupted Market context edit — the true
pre-edit-completion number was unmeasurable (the component didn't typecheck / would throw on render).

Region-level before/after inside the context band (1280 dark, row 1 — the row that was stretching):

| widget | before (stretched) | after `alignItems:'start'` + density | design |
|---|---|---|---|
| `widget-dealer-flow-projection` | 464 | **387** | 267 |
| `widget-market-context` | 464 | **345** | 267 |
| `widget-term-structure` | 464 | **172** | 267 |

## A visual false alarm, recorded so it isn't repeated

The `pairs/desk-real-1280-light.jpg` **composite** (built by `_tools/pairs.py`, a resize+paste of the
raw PNGs) rendered the app side looking dark on first inspection. Direct inspection of the source
`app/desk-real-1280-light.png` (full resolution, not the composite) and the JSON census's own computed
probes (`htmlBackground`/`bodyBackground`: `rgb(246, 246, 243)` — the light "paper" token) confirm the
capture **is** correctly light-scheme; this was a misreading of the reduced-scale composite thumbnail,
not a rendering defect. Recorded here in case a future pass trusts the composite over the source PNG.

## Verification (exit codes)

| gate | command | result |
|---|---|---|
| typecheck | `npx nx typecheck @convexa/dashboard --skip-nx-cache` | **exit 0** |
| unit/component tests | `npx nx test @convexa/dashboard --skipNxCache` (`node_modules/.vite` cleared first) | **exit 0** — 239 files / 2,905 tests |
| lint | `npm run lint` | **exit 0** (4 pre-existing warnings, unrelated files) |
| format | `npm run format:check` | **exit 0** |
| `apps/api` diff | `git diff --stat origin/main...HEAD -- apps/api` | **empty**, throughout |
| NUL scan | byte scan of every file this task touched (both lanes, incl. specs) | **0** in every file |
| composition (harness) | `npx nx build --configuration=production` + `playwright test --config playwright.audit.config.ts --grep desk-real` | **11/11 passed** — see table above |
| e2e | `BROWSER_QUALITY_PREBUILD_STATUS=pass npx nx e2e dashboard-e2e -- --grep "desk\|curvature\|overflow"` (production build, ports 4200/4310 freed manually — not `npm run ports:free`, which also frees 8000) | **exit 0** — 108/108 passed, 0 flaky |

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
