# curvature-v2-surfaces — council decisions (R3 reconcile)

Status: **R3 complete — four owner rulings recorded 2026-09-06 (D-A → A · D-B → OUT, phase 4 · D-C → IN · D-D → TRACED);
R4 synthesis dispatched the same day.** Input: `council/conflicts.json` — **27 conflicts, 27/27 quotes machine-verified**
(`council_conflicts` exit 0). 7 self-revisions folded · 2 technical conflicts converged by those self-revisions ·
11 technical conflicts dispatched for ONE resolution exchange · **4 product calls surfaced to the owner one at a time
(D-A · D-B · D-C · D-D)** — one further product conflict collapsed into a self-revision + D-A, see §4. (First written as
"3"; S2 Minor #2 caught the undercount — D-D was added after the technical exchange surfaced the register precedent.) Conflict ids are the first 10 hex of
`conflict_id`; `#n` is the index in `conflicts.json`.

## 1. Self-revisions — folded, no exchange (a voice withdrawing its own R1 claim)

| # | id | voice | withdrawn | stands instead |
|---|---|---|---|---|
| 7 | `8ba032e3b5` | architect | non-goal 7 "`features/trading/broker/` is untouched" — false: `PortfolioPanel.tsx:22,176` mounts `BrokerTabPanel` as the second tab of `/positions` | Narrowed non-goal: **no broker DATA work, no `/api/broker/*` change, no change to the deliberate `NOT_RECORDED → NOT_PROVIDED` substitution (`notANumber.ts:15-16`)**. Broker-tab figures are IN for register enforcement and the non-synonymy assertion, phrased as three checkable facts (sim renders `not recorded` never `not provided`; broker the reverse; `no basis` only on `pl_pct`). |
| 8 | `2c93136ce6` | architect | assumption "PM will not require a per-figure live dot on `/scanner`" and its "option C or nothing" consequence | The honest menu is A / B / C with corrected costs (B needs **no** backend change but re-opens `[one-liveness-predicate]`). Carried into **D-A**. |
| 14 | `d000b908a8` | pm | row 7's universal "every figure in the eight widgets steps 20 → 17 → 15" — `FreshPositioning.tsx:15,56` is a deliberate 12px list; `term-structure`/`setups` have no figures | **7a**: every figure at the 20px base steps against its own **named** `panel` container, verified by a RENDERED assertion at a narrowed container width. **7b**: off-ladder widgets keep their shipped size and are named with reason in the build report. Rows 53/54 (register enforced; no untraced mono figure) stand on all eight. |
| 15 | `65bd9b07f2` | pm | "shipped copy on positions and scanner … stays byte-identical" — contradicted by pm's own row 29 (`PositionRow.tsx:68,378,388` `⏸` text marks) | Freeze narrowed to **semantic wording, meaning and order**. Three permitted change classes, each itemized in the build report: (1) typographic truth mark (`⚠`, `⏸`) → declared stroke icon; (2) raw wire token → closed-lookup label; (3) a NEW honesty/basis line. Anything else stays an R2-class conflict. |
| 24 | `1eee801a38` | ux | U-1's mechanism half "renders through `FigureCell`" — `ScanCard.tsx:54-56` is one `<a>`; `FigureCell.tsx:307` mounts a focusable button | U-1 as a **property**: every figure declares an explicit register at its call site and renders register, liveness and absence through the ONE shared decision module; no local font constant; no default. Satisfiable by `FigureCell` on panel-shaped figures and by the extracted module elsewhere. Depends on #16's outcome (module must carry the states, not only the register). |
| 25 | `7374669048` | ux | U-7 "scanner chip labels carry no `⚠`" — the canon's Icons row names exactly two typographic truth marks (pause, ring); rule 5 + `labels.ts:196` make the `⚠` glyph the deliberate mechanism | U-7 dropped; scanner status labels stay byte-identical. **Amendments question filed for the owner** (not this phase): does the Icons row's colour-emoji clause reach `U+26A0` in a chip label? (`labels.ts:196,205,211`). U-11 (no `⏸` character on positions) is unaffected and stands. |
| 26 | `4f915a4ad0` | ux | "The steps are not new plumbing; they arrive with the primitive" — `MarketContext.tsx:443` lays four ~210px figures across one ~900px panel, so the nearest named container never crosses 360px and the step never fires | U-33 kept, mechanism re-pointed: each figure in a converted multi-figure quiet-band widget wraps in its own nested `PanelContainer` (same name, nearest-ancestor wins — `ReadStrip.tsx:54` is the shipped precedent); verified by a RENDERED assertion, never by rule presence. |

## 2. Technical conflicts converged by a self-revision — folded, no exchange

- **#11** `a3216467da` (pm → architect, Broker tab): resolved by #7. **Broker tab IN** for register + vocabulary on its figures — read-only, no new network calls, **no entry/order/cancel control** (`no-real-order-path` intact). The `not provided` arm of the non-synonymy criterion is therefore assertable this phase.
- **#12** `eebd259eca` (pm → ux, U-1 not observable): resolved by #24. Criterion states the outcome (visible register; poison run proves no call site renders a figure without one; no not-a-number in the mono register; table and card never disagree about one datum); the component name lives in the architecture contract only.

## 3. Technical conflicts — ONE resolution exchange, 2026-09-06 — **22/22 verdicts CONVERGE, zero promoted**

Inboxes: `R3-inbox-architect.json`, `R3-inbox-pm.json`, `R3-inbox-ux.json`. Signed text: `R3-architect.md` (230 lines),
`R3-pm.md` (161), `R3-ux.md` (249) — **R4 reads those three files for the exact wording**; this section is the controller's
fold, checked pairwise (each side wrote what it would sign without seeing the other; every pair landed on the same mechanism).

- **#0 + #16 — the central mechanism (SETTLED).** Extract the **whole** F1–F9 branch (`FigureCell.tsx:250-300`) into
  `shared/figure/figureState.ts` (pure, no JSX) + `shared/figure/FigureMarks.tsx` (`PauseMark` `:154-156` and `LiveDot`
  `:130-149` are module-private today — the file exports only `:158,:238,:339,:355` — so they move out as named exports and
  `FigureCell` imports them back). **Not** under `pages/ticker/widgets/_kit/`: `features/trading/positions/` importing from
  `pages/` inverts the dependency direction the repo records at `notANumber.ts:18-23` and `liveClaim.ts:9-14`. Signature:
  `figureStateOf({ value, register, live, offline, replay, caption, assertedBy }) → { figureState, isLiteral, mono, isFigure,
  dim, untraced, showDot, showPause, caption }` — `dim` (`:266,275`) and `untraced` (`:294`) included, or the scanner's
  "figures stay, dimmed" (`labels.ts:30-32`) still has nothing behind it. `live` keeps the `LiveClaim` brand
  (`FigureCell.tsx:171`, `liveClaim.ts:23-29`) so the extraction is no back door around the one-mint rule; a scanner caller
  can pass only `NOT_LIVE`. Consumers: `FigureCell` (`:238`), the `ScanCells` atoms (`:51,68,82,98,161,178,218`),
  `PositionRow.cellContent` (`:191`); the positions header readout (`PositionsPage.tsx:177-195`) keeps `FigureCell` itself.
  Every consumer emits `data-figure-state` on the element wrapping the value: `FigureCell` keeps it on the card root (`:303`)
  so the nine shipped specs keyed on it are untouched; atoms/cells emit it on their own node (e.g. `cell-price`,
  `ScanCells.tsx:71-77`) — an assertion queries state at the cell testid and never assumes co-location with
  `data-figure-register` (`:212`). **Chrome does not travel:** no `CellCard`, no second label row (`ScanTable.tsx:107-145`
  IS rule 13's label row), no nested button inside `ScanCard`'s single anchor (`:54-59`, `focusableHelp={false}` `:107`
  stays; shipped tip + `aria-describedby` `ScanCells.tsx:115,132-140` stay). **The ladder does not travel:** 20/17/15 and
  the 15px literal size are `FigureCell`'s panel-scale constants; table cells (`fontSize: 'inherit'`, `ScanCells.tsx:74`)
  and 12px list rows keep inherited size — register and state travel, size does not (pm 7b). Input plumbing:
  `ScanTableProps` (`ScanTable.tsx:47-60`) and `ScanCardProps` (`ScanCard.tsx:30-35`) gain **one** prop, per-symbol
  `{ retained: boolean } | null`, computed once at `Scanner.tsx:119-126` (`retained` true only when the displayed price came
  from the now-dead stream; a symbol that never ticked keeps the polled swept price — no pause mark).
- **#2 (SETTLED).** Split by figure, not widget. `off-exchange-blocks` (`:24,79-81`) and `fresh-positioning` (`:15,56-58`):
  delete the local `MONO`, resolve register through the module, lift `'—'` into its own Sans span **at the row's 12px**
  (never the 15px literal size), no size/layout/order change, named in the build report. `term-structure` and `setups` are
  figure-free in the DOM. **Explicit non-goal, cited:** `TermHeatChart.tsx:105-106` paints `${p.atm_iv.toFixed(1)}%` onto a
  canvas with a hard-coded `'600 10px "IBM Plex Mono"'` — no DOM assertion can reach it. Deliverable is pm rows 53/54's
  property, not a count. (`lookalikes.spec.ts:22-27,47-55` exempts four OTHER widgets; neither of these two — converting them
  edits no spec.)
- **#3 (SETTLED — option a).** Positions table cells keep `literal()` (`PositionRow.tsx:145-153`) and its per-member tips;
  the three-way distinction is asserted by `test` against the shipped testids `cell-unavailable` (`:164`),
  `cell-not-recorded` (`:166`), `cell-no-basis` (`:348`) — already asserted at `positions.risk.spec.tsx:858,859,885`; the tip
  texts are `review`. Option (b) withdrawn by both: a value-row help host would put two focusable-help affordances in one
  cell of the primitive 16 sites depend on — the duplicate pattern ruling 6 bans. `FigureCell` conversion on positions = the
  header readout only. `dashCell` (`:167`) is deliberately untestidded (`:69`) — no assertion may assume a DOM hook for `—`.
  **CONDUCTOR call (reversible):** the tips are hover-only — `literal()` wraps a plain `<Typography>` with no `tabIndex`
  and no `describeChild` (rule 20; Banned "Hover-only affordances") — fix **IN** this phase with the file's own idiom at
  `PositionRow.tsx:396-401` (`Tooltip describeChild` + `aria-describedby`), attributes only, zero wording change. Reason:
  a `review` mark must not certify an affordance a keyboard cannot reach on the very cells the non-synonymy criterion
  rests on. Reversal: OUT → carried debt with `PositionRow.tsx:147-151` attached.
- **#4 (SETTLED).** **U-23a** forward-only: a firing recorded after this phase builds its label from the closed lookups
  (`evaluate.ts:73,94,116`), and the rule list stops rendering a threshold the record does not hold (`AlertsPage.tsx:192`
  `≥ ${r.scoreMin ?? 60}` against `types.ts:22` and `evaluate.ts:83`'s third copy of `60`). **U-23b** carried debt: pre-phase
  event strings are legacy content (`types.ts:32`, `AlertsPage.tsx:225`); the Recent list may not claim history was
  re-labelled. History repair **not chosen**; if ever: additive fields, read-new-else-old, `message` never deleted, never
  gated behind a read that can throw — `store.ts:66-68` resets to `empty()` on a parse failure and `:41-49` overwrites the
  durable key (the live `loss-free-durable-migration` breach; pm's P4 read-fault latch is the fix and R4 carries it).
- **#17 (SETTLED).** Exactly one positions cell inverts rule 24: `delta_entry` (`PositionRow.tsx:374` `...MONO` + `:377`
  `DASH`) → route through the shipped `dashCell` (`:167`, same `DELTA_ENTRY_TIP`); the word `—` is byte-identical, only the
  register changes Mono → Sans (inside #15's freeze). `session_delta` (`:387-388`) is #13's icon/vocabulary defect, not
  this. The header readout hand-binds the mono face at `PositionsPage.tsx:185` — absorbed by its `FigureCell` conversion.
  Enforcement: extend the **shipped** `?raw` scan at `fonts.spec.ts:154-167` (already mutation-guarded `:157-161`) with two
  needles — (1) no closed-nine member inside a mono-bound `sx`; (2) no font-family literal or widget-local `monoFontFamily`
  binding outside `shared/theme/tokens.ts` and the module — scoped to `features/trading/`, `pages/positions/`,
  `pages/scanner/`.
- **#1 (feasibility SETTLED; the choice is D-A).** Both sign this cost table. **(A)** zero new mints, buildable today: the
  retained arm rides the unbranded `offline` prop (`FigureCell.tsx:174,257-268`); repair `useLivePrices.ts:65-67`
  (`setOffline(false)` on ANY frame, including a payload-less heartbeat) by driving `retained` from the per-symbol `ts`
  age (`:24-27`) — staleness of a timestamp is not a venue claim, so no mint; header rewording edits the shipped
  `scanner.risk.spec.tsx:869` (`/Prices (live|offline)/`). **(B)** defeats the only shipped enforcement of pm row 6 —
  `liveClaim.spec.ts:68-80` scans banned **names** globbed at `pages/ticker/widgets/**`, so a fourth mint passes by
  construction; and its dot cannot be censused against a closed venue (`live-dot-census.spec.tsx:1-31` builds its worst
  case from `market_session:'closed'` + `live:true`, which the prices frame never carries). **(C)** client cost small
  (`LivePrice` is declared locally at `useLivePrices.ts:24-27`); the whole cost is the backend fence + pm row 67.
  **Shared under all three:** the per-symbol streamed/swept input lands at one atom (`ScanCells.tsx:68`, used by
  `ScanTable.tsx:181` and `ScanCard.tsx:95`) and the stream's offline flag enters row 14's flash gate.
  **Independent of A/B/C:** `PositionsPage.tsx:88` still calls the banned `genuineIsLive` and the fence's glob does not
  reach `pages/positions/` — widen the glob to the four surfaces with explicit EXEMPT entries (row 6 becomes enforceable).
- **#13 (SETTLED).** Two lines: (1) `literal()` + tips stay; (2) the live-derived cells — `mark` (`:284-320`), `pl`
  (`:321-341`), `pl_pct` (`:342-367`), `delta_entry` (`:368-382`), `session_delta` (`:383-392`), `trend` (`:393-411`) — owe
  the offline contract via the #16 module: pm **27a** (retained value, reduced emphasis, stroke pause, `offline · last known`),
  **27b** (closed-nine member + pause icon, no last-known words), **28** (no bare pause marker), **29** (stroke icon, never a
  character). The three character marks go (`OFFLINE` `:68`, `' ⏸'` `:378`, the bare `'⏸'` that replaces the whole
  session-delta value `:388` — which has a retained arm, `ctx.sessionDelta` `RowContext:119-120`). `dim` comes from the
  module, never a cell-local `liveDim` (`:200`) — that is what stops `PositionsPage.tsx:190`'s shape (opacity, no pause,
  no caption) being re-minted per cell. `PositionCard.tsx:76-87` roots on a plain `Box` (no anchor) — it CAN host the
  primitive but takes the module route so table and card cannot render one datum two ways (`ScanCells.tsx:1-3` precedent).
- **#21 (SETTLED).** Row 56 amended + **56a closed two-site carve-out** + **57b**: (i) `_kit/copy.ts:355` `MC_CELL_EMPTY =
  'unavailable this cycle'` sits in a figure **value** slot (`MarketContext.tsx:291,299,375`) → value `unavailable`,
  caption `this cycle` (`design/src/components/figure-cell.mjs:40`); (ii) `Setups.tsx:52` renders one sentence for
  `undefined` and `[]` (`:32`) → `[]` keeps `No clean setup right now.` byte-for-byte, `undefined` renders
  `Setups unavailable this cycle.` **Nothing else**; `*_WHOLE_EMPTY` prose (`copy.ts:297,352-354`) untouched. Only
  collapse in the band — `FreshPositioning.tsx:41/45` and `OffExchangeBlocks.tsx:46/50` already split the two arms.
- **#22 (SETTLED except the precedent → D-D).** Row 47 → **47a** a price threshold renders in the rule's own summary line
  with the `$` prefix — today it does not render at all (written `AlertsPage.tsx:48`, evaluated `evaluate.ts:110`, absent
  from `:191-195`); **47b** a score gate renders the bare index beside its closed-lookup label `Score gate` (`≥ 72`, never
  `≥ 72 pts`); **47c** no numeric control takes a value whose unit is only implied — a money input states its unit as part
  of the control; a structure-level rule: label from `LEVELS`, no number of the rule's own, absent → a closed-nine member
  (per §5's fourth-surface routing), never the bare word `level` (`:193`); tier change stays byte-identical. Absent
  threshold → ux proposes `not set`: **R4 must confirm it is a member of the closed nine at `notANumber.ts:26-36`**;
  if not, use the nearest member or file an Amendments line rather than minting a tenth literal.
- **#23 (SETTLED).** Row 35 amended: "…signed-P&L direction only, and only where the tinted value is a computed P&L over
  marked rows — never a zero standing in for an unmarked or empty book, never on a closed-vocabulary member." States, label
  `Net P/L (open)` and `data-testid="positions-net-pl"` unchanged: **35a** no open rows → `—` (F7, no tint) — today `+$0`
  green (`PositionsPage.tsx:189,193`); **35b** open rows, none marked → `unavailable` (F8), no number, no tint, caption
  `0 of {m} open marked`; **35c** some marked → the computable sum + mandatory caption `{n} of {m} open marked`; **35d** all
  marked → total, no caption; **35e** stream drop → F4/F5 (pause mark + `offline · last known` when retained) replacing the
  bare `opacity: 0.5` at `:190`; offline captions take precedence over the coverage caption (the primitive's shipped
  behaviour `FigureCell.tsx:253,262,271`). Coverage is countable from the set the sum already walks (`:147-154`).

Index of the eleven (ids re-checked against `conflicts.json`, 25/25 match):

| pair | # | id | question |
|---|---|---|---|
| architect ↔ ux | 0 | `6c2cf2c5e9` | `FigureCell` cannot enter the scanner (single-anchor card; sticky nowrap table cells; header IS the label row) → extract the register/vocabulary/step decision into a pure module |
| architect ↔ ux | 16 | `7da0330a44` | …and whether the extraction must carry the WHOLE F1–F9 branch (`FigureCell.tsx:250-300`: dot, pause, `offline · last known`, `data-figure-state`) so the scanner/positions degraded arms have a host |
| architect ↔ ux | 2 | `cbef7514e4` | `off-exchange-blocks` (`:24,79-81`) and `fresh-positioning` (`:15,56-58`) DO carry mono runs from widget-local constants, with `'—'` interpolated into a mono run → split by figure, not by widget |
| architect ↔ ux | 3 | `b0f85405a7` | positions `literal()` tips (`PositionRow.tsx:145-153`) are the only non-synonymy affordance; `FigureCell` has no value-row help host → keep `literal()`, scope conversion to the header readout, or fund a help host on the primitive |
| architect ↔ ux | 17 | `66cd71c107` | `PositionRow.tsx:374-377` renders `DASH` inside a `MONO` cell → every absent-value path routes through `literal()`; `?raw` scan extended to `features/trading/positions/` |
| architect ↔ ux | 4 | `50ef9a81be` | stored `AlertEvent.message` is pre-rendered (`types.ts:32`) → forward-only criterion + carried debt, or an additive read-new-else-old shape change with a pre-phase fixture |
| architect ↔ pm | 1 | `d09285682d` | rows 6 and 11 unsatisfiable together on the scanner — exchange the FEASIBILITY/cost of options A / B / C only; the choice is **D-A** |
| architect ↔ pm | 13 | `1f765d5bd8` | "the table keeps its atoms" is mechanism, not scope — the live-derived cells (`:68,378,388`) still owe the offline contract |
| pm ↔ ux | 21 | `154fb2122f` | row 56's composition freeze must carve out `_kit/copy.ts:355` (value slot holds a non-member) and `Setups.tsx:52` (one sentence for `undefined` and `[]`) |
| pm ↔ ux | 22 | `77667a5927` | row 47: a score gate has no unit — split by threshold type; **register of a user-entered number** is a precedent question (promote if unresolved) |
| pm ↔ ux | 23 | `338807da91` | row 35 certifies the green `+$0` on a fully-unmarked book (`PositionsPage.tsx:147-154,189`) → add a Net P/L row (`unavailable` when no open row is marked; coverage caption when partial) |

The id column above was wrong by one row across the `pm ↔ ux` block in the first draft; pm's R3 caught it, it was corrected
against `conflicts.json` (25/25 ids verified by script), and the inbox files — generated from `conflicts.json` — were never wrong.

## 4. Product calls — the owner's, surfaced one at a time (Decision cards)

**D-A — scanner price liveness** (#10 `f81c19bae5` pm→architect, #18 `918e665561` ux→architect; substrate #1, #8).
Facts agreed by all three: the scanner runs a real price SSE (`useLivePrices.ts:39-57`), the frame carries no
`market_session` and no wire `live` flag (`:69`), and `labels.ts:25` reads `Prices live · structure ~3 min · hot names sooner`.
All three reject "option A with the `Prices live` header left standing".
- (A) no live dot on scanner prices this phase; header reworded to state cadences without asserting liveness; stream
  drop renders the F4 retained arm via the unbranded `offline.retained` route (dim + stroke pause + `offline · last known`).
  Per-symbol live marks → carried debt against the phase that adds session fields to `/api/stream/prices`. **Conductor recommends.**
- (B) per-symbol "streamed" mark → second mint (re-opens `[one-liveness-predicate]`) or a mark the canon lacks; reads live with the venue closed.
- (C) add `market_session` + `live` to `/api/stream/prices` → re-opens NO_BACKEND_CHANGE.
**Ruling: A — OWNER, 2026-09-06.** No live mark on any scanner figure in any connection state (pm row 11 → **11A**; row 15
amended so the basis line states the two cadences and asserts liveness in no state). `labels.ts:25` is reworded without the
word "live" — the one scanner sentence this phase may touch (closes §4's copy-freeze residual; edits the shipped
`scanner.risk.spec.tsx:869`). Stream drop → the F4 retained arm through the unbranded `offline.retained` route, computed at
`Scanner.tsx:119-126` and driven by per-symbol `ts` age (repairs `useLivePrices.ts:65-67`'s heartbeat-clears-offline defect
with no mint and no backend change). `[one-liveness-predicate]` untouched. **Carried debt, dated:** per-symbol live marks on
`/scanner` wait for the phase that adds `market_session` + `live` to `/api/stream/prices`. **Independent of the ruling and
IN:** widen `liveClaim.spec.ts:68-80`'s glob to the four surfaces with explicit EXEMPT entries, and replace the banned
`genuineIsLive` at `PositionsPage.tsx:88`.
**CONDUCTOR clarification of A, 2026-09-06 (reversible):** R4 read at source that the header's companion gloss —
`labels.ts:26-29` `cadenceGloss`, opening `Prices stream live.`, rendered as the `Jargon` gloss of the same header at
`Scanner.tsx:143-146` — is a second liveness sentence no voice had cited, so the owner ruled a closed set of ONE sentence
without that fact. The ruling's stated reason ("a page sentence asserting liveness that no datum vouches for") reaches the
gloss exactly as it reaches the header, and the gloss is the same UI element's tooltip. **Ruled: the closed set is the
header AND its gloss — two sentences in one constant object, both reworded without asserting liveness; still nothing else on
scanner.** `cadenceHeaderOffline` (`:32`, "Prices offline · showing last known") is a truthful degraded statement and stays. (First
written as `:31`, which is the doc-comment line; R4's targeted fold corrected it at source.)
Reversal: owner says the set stays at one → the gloss keeps its shipped text and R4's §9 item 1 becomes GATE Z debt.

**D-B — settings section navigation (rail ≥900 → horizontal control <900)** (#5 `fac0c6c7cb`, #9 `faf6bdeea6`, #19 `ae12488953`).
Facts agreed: no rail ships (`SettingsPage.tsx:156` is a 640px centred column); the canvas draws it
(`design/src/screens/settings.mjs:1,5,15,28-31`) so the design-first rule is satisfied; it is the phase's only net-new
construction and drags unanswered behaviour (click vs scroll-spy; deep-link landing <900; focus order; 44px floor).
- (IN) own criteria block; click-only unless UX answers otherwise; sized as construction.
- (OUT → phase 4) recorded as carried debt with the canvas citation; settings criterion becomes "five sections reachable at
  every checked width, no page-body overflow"; U-17/U-18 and pm rows 37/38 withdrawn. **Conductor recommends** — keeps
  phase 3 a pure conversion phase; phase 4 already owns the responsive sweep.
**Ruling: OUT → phase 4 — OWNER, 2026-09-06.** Settings ships its single 640px column this phase; its figures convert and
its panels adopt the declared scales, nothing else. pm rows 37/38 and ux U-17/U-18 are withdrawn; the settings responsive
criterion is "every one of the five sections is reachable at every checked width with no page-body overflow".
**Carried debt, dated, with the canvas citation** `design/src/screens/settings.mjs:1,5,15,28-31`: the section navigation is
phase 4's, and its GATE I must answer three behaviours before build — active item on click vs scroll-spy, deep-link landing
below 900, focus order — plus the 44px floor on the horizontal strip. The BRIEF's "brought under the same responsive
discipline" wording for Settings does **not** survive into SPEC. One copy hazard travels with the debt: the canvas footnote
"Saved to your account." (`settings.mjs:30`) is false for `convexa.uiprefs.v1` (`localPrefs.ts:15`) and must not be imported.

**D-C — Widget-frame ⓘ as a focusable control** (#6 `db0bcfc326` architect→ux).
Fact: `Widget.tsx:245-249` renders `info` as a bare icon in a hover tooltip at **eight** live `<Widget info=…>` sites —
`OffExchangeBlocks.tsx:39`, `DealerFlowProjection.tsx:159`, `TermStructure.tsx:34`, `MarketContext.tsx:417`,
`FreshPositioning.tsx:38`, `IvRank.tsx:276`, `StructureHeroPanel.tsx:216`, **`LiveTape.tsx:179`** — two of them on the desk
(hero and live tape); phase 1's ruling 6 declared AC-35 satisfied page-wide and it is not. (The council and the decision card
said **seven**; S2's Critical corrected it against the tree and the conductor re-counted at source 2026-09-06 — `LiveTape.tsx:173-181`
passes `info={info}` unconditionally. The ruling's mechanism — one change at the single render site — reaches all eight by
construction; the count matters for the enumerated criterion and for which desk specs re-run.)
- (IN) desk reopened for this ONE shared-frame change only; the desk's shipped specs re-run inside the criterion. **Conductor recommends** —
  the alternative mints the duplicate focusable-help pattern ruling 6 bans.
- (OUT) U-32 narrows to a wrapper at the quiet band's five sites (duplicate pattern) or drops.
**Ruling: IN — OWNER, 2026-09-06.** The `Widget` frame's `info` becomes a focusable control (tap, Enter/Space, Escape) using
the ONE shipped focusable-help pattern (`AccessibleHelp`), at all **eight** live `info=` sites (count corrected after S2; the
owner ruled the mechanism, which is count-independent). **The ticker desk is reopened for this single shared-frame change and
nothing else**: no desk layout, copy, state or spec content changes; the desk's own shipped specs (a11y tree, focus order, the
single-motion-moment and live-dot census suites — for the **hero AND the live tape**) are re-run inside this criterion and must
stay green, so the churn is measured here rather than discovered at GATE Q. Phase-1 ruling 6's AC-35
("page-wide on the ticker surface and true") is recorded as having been **false at the time it was declared** — `Widget.tsx:245-249`
never had a focusable host — and becomes true with this change.

**D-D — register of a user-entered number** (from #22 `77667a5927`; pm and ux both marked it `PRECEDENT — owner/architect line`).
The trader types a score gate (`≥ 72`) or a price threshold (`$500`). Canon rule 13 defines Mono as "traced to Convexa's
computation" and Sans + dotted rule as "asserted but untraced"; the shipped primitive renders `register: 'asserted'` with the
caption `${assertedBy} · untraced` (`FigureCell.tsx:293`), which on the trader's own number would read `you · untraced`.
- (TRACED) user-entered numbers render Mono; at GATE S amend rule 13's clause to "traced to Convexa's computation **or to a
  record the trader entered**". **Conductor recommends** — the number IS the record, reproducible exactly, no model in the
  path; it binds risk inputs, sim entry and alert thresholds alike.
- (THIRD REGISTER) declare a third register value → an Amendments event, out of phase 3; alerts thresholds would render
  Sans without the dotted rule in the meantime.
**Ruling: A (TRACED) — OWNER, 2026-09-06.** A user-entered number renders in the Mono (traced) register with no dotted rule;
the F9 caption `${assertedBy} · untraced` is never produced for a user-entered value. Rows 47a/47b render Mono. R4 states this
ONCE as a cross-surface rule (it binds risk inputs, sim entry and alert thresholds), not per row. **Canon amendment queued for
GATE S** (filed now under `_MANIFEST.md` Open amendments): rule 13's clause becomes "traced to Convexa's computation **or to a
record the trader entered**" — a one-clause widening, applied at close-out like phase 2's four, never mid-build.

**Collapsed, not surfaced — copy-freeze scope** (#20 `3dba77c9ca` ux→pm): its target sentence was withdrawn by pm's #15.
Residual is an instruction to R4: enumerate the closed set of sentences this phase may touch as explicit AC lines —
(1) `labels.ts:25` only under D-A (A); (2) nothing else on scanner; (3) positions: additions only (Net P/L coverage caption,
per #23) plus the three permitted classes in #15. Everything else byte-identical, proven by a scan.

## 5. Asks routed
- Alerts history repair (pm ask) → decided by #4's exchange; default forward-only with carried debt.
- `not recorded` on alerts as a fourth surface (ux ask) → R4 states it as the per-surface subset canon rule 24 anticipates;
  if the skeptic disagrees it becomes an Amendments line.
- Direction-reserved colours on the settings save-ERROR alert (ux ask) → pm↔ux may settle in #22/#23's exchange; else R4 applies
  rule 16's ten-state list literally (an error alert is a state, not a direction).

## 6. S2 adversarial review — pass 1, 2026-09-06: **PASS WITH FINDINGS** (1 Critical · 2 Important · 2 Minor) → R4 pass 2

| sev | finding | disposition |
|---|---|---|
| Critical | D-C's closed count "seven `info=` sites" is false — eight (`LiveTape.tsx:179` missed); SB criterion U-32 inherits it | **Verified at source by the conductor** (grep of `<Widget … info=` → 8). Fixed in §4 D-C above; R4 pass 2 corrects §1, U-32 and the desk-spec re-run scope (hero + live tape). |
| Important | N-1 says the extended `fonts.spec.ts:154-167` scan "keeps its mutation guard", but `:157-161` only proves an `Inter` literal is caught — neither new needle has a guard | R4 pass 2: each new needle ships its own red-going poison test; "keeps" wording removed. |
| Important | The `retained` staleness cutoff behind criteria 12/13 is never given a number or a cited constant | Routed to the **architect** for one targeted answer (`R3-architect-addendum.md`): the predicate, the constant, the moment criterion 12 becomes true; R4 pass 2 folds it. |
| Minor | `INTERFACE_CONTRACT.md` labels `PUT /api/scan/view`'s 503 as `auth_unavailable`; at source it is universe-unavailable (`scan.rs:776-782`) | R4 pass 2 relabels. |
| Minor | This file's headline said "3 product calls"; §4 records four | Fixed above. |

S2 also **tested and resolved** §9 item 4: canon rule 24's "ship on the positions and broker surfaces" is **descriptive** (the
rule's own next sentence pre-approves a member on an unlisted surface as "a per-surface subset, not a second vocabulary",
`DESIGN_SYSTEM.md:179`), so `not recorded` on alerts is consistent with the canon → R4 pass 2 records that reading in §4.5 and
closes §9 item 4. Everything else S2 checked held (27/27 conflicts traced; D-A/D-D mechanics; the single positions register
inversion; the alerts loss path; the quiet-band freeze; durable-key inventory; the conformance block vs the generated schema;
95 criteria / 53 SB re-counted; no scope leakage).

## 7. S2 adversarial review — pass 2, 2026-09-06: **PASS WITH FINDINGS** — 5/5 pass-1 findings CLOSED; loop capped

| sev | finding (new, on the pass-2 repair) | status |
|---|---|---|
| Critical | U-32 says the desk specs are re-run "for the hero AND the live tape", but no named spec exercises the **hero's** `Widget`-frame ⓘ (`StructureHeroPanel.tsx:216`): the only hero-scoped AC-35 assertion targets `ladder-foot` (`LadderFoot.tsx:23`, a different `FigureCell` control), and `structure-hero` is absent from `HOVER_INFO_WIDGETS` (`curvature-v2.spec.ts:502-507`). A build that converts every site except the hero would pass U-32. | **OPEN — owner** |
| Important | Neither §2.8 nor U-32 pins the accessible name of the promoted `Widget`-frame button; the reused assertion `getByRole('button', { name: /^About /i }).first()` would keep matching pre-existing body buttons (`IvRank.tsx:118`, `MarketContext.tsx:134-146`, `DealerFlowProjection.tsx:71-83`, `FigureCell.tsx:307`) if the new button were named differently. | **OPEN — owner** |

Conductor's proposed disposition (not applied — the cap says these are the owner's): fold both in ONE targeted synthesizer
pass on approval, before GATE PLAN — (1) §2.8/U-32 name a hero-scoped assertion on the `Widget`-frame header ⓘ (extend AC-35's
site list to all eight `info=` sites, hero and live tape included, asserting the header control, not `ladder-foot`); (2) the
promoted call carries the accessible name **`About {title}`**, matching every shipped `AccessibleHelp` call, stated in §2.8 and
U-32. Neither changes a ruling; both make U-32's teeth real. Reversal: the owner declines → both stay OPEN into GATE PLAN and
the planner bounces U-32 at GATE Z (it cannot plan a verification it cannot run).
