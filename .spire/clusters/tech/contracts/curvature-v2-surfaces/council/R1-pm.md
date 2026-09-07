# R1 — pm position: curvature-v2-surfaces

## Position

Phase 3 makes the register a **property of the app**. Today a trader who leaves the ticker desk crosses
into four surfaces where "is this number Convexa's?" is answered by per-surface convention or not at
all. This position defines what a stranger must be able to observe on each of those surfaces, plus the
eight quiet-band widgets, without reading code.

Every product fact below was read at source and is cited `file:line`. Three of them contradict or
sharpen sentences in the BRIEF; they are called out where they land.

### 0. Facts I verified at source (the ones that move scope)

| # | Fact | Evidence |
|---|---|---|
| V1 | **The four surfaces have zero figure primitive between them** — and none of their panels is a container-query context. `Widget`/`PanelContainer` appear in **no** file under `pages/scanner`, `features/trading/positions`, `features/auth` or `pages/alerts`. | primitive: 0 matches under those four trees; container mechanism ships at `shared/ui/PanelContainer.tsx:15-18` and `shared/ui/Widget/Widget.tsx:180` |
| V2 | **The eight quiet-band widgets already sit inside a named `panel` container** — all eight render inside `Widget`. What they lack is figures that *respond* to it, plus register enforcement. So their conversion is register + stepped figures, **not** new container declarations. | `MarketContext.tsx:439-442` ("one of the four hand-rolled StatTile-family widgets ruling 6 keeps unconverted (not register-enforced, not container-stepped); adding `@container` here is a later phase's rebuild"); `DealerFlowProjection.tsx:183` says the same |
| V3 | **The scanner is NOT a pure snapshot surface.** It subscribes to a genuine price stream for the symbols on screen and overlays streamed prices onto swept rows, so one column carries **two provenances at once**. The page-level line says `Prices live` today. | `pages/scanner/useLivePrices.ts:39-57`, `Scanner.tsx:115-126`, `labels.ts:25` |
| V4 | **The scanner's offline copy promises a treatment the render does not perform.** `labels.ts:30-32` says "the figures stay, **dimmed**, and say why"; the only thing that changes on a drop is the header string (`Scanner.tsx:144`). There is **no `opacity` binding anywhere under `pages/scanner/`** (0 matches). | `labels.ts:30-32`, `Scanner.tsx:144`, `Scanner.tsx:89` |
| V5 | **The scanner's price flash is gated on the sweep, not the stream** (`flashActive = !workerDown && !degraded`), so a polled price change still flashes while the page says prices are offline. Canon rule 22 requires the flash stop when the stream drops. | `Scanner.tsx:89` vs `Scanner.tsx:115` |
| V6 | **Settings has no rail to collapse.** It is a 640px centred single column of five stacked panels. The v2 design specifies a 220px section rail + 760px column that becomes tabs under 900. So "rail → tabs at 900" is **new construction**, not a responsive fix. | `features/auth/SettingsPage.tsx:156` + panels at `:170,:229,:356,:361,:366`; design `screens/settings.mjs:1,28-29`, `screens/responsive-spec.mjs:27`, `screens/library-page.mjs:175` |
| V7 | **Alerts carries state in a coloured edge** — an unread firing is distinguished by an amber left border and nothing else. That is the exact banned anatomy the figure cell exists to end, and it spends brand amber on decoration. | `pages/alerts/AlertsPage.tsx:219-220` |
| V8 | **Alerts fabricates a threshold.** A rule with no recorded score minimum renders `≥ 60` — a number the record does not hold, and not even the composer's own default of 70. Its kind and level render the **raw wire token** (`score_gate`, `gamma_flip`) although a closed label lookup exists two screens up. | `AlertsPage.tsx:192` (`?? 60`), `:189`, `:193`; lookups at `:21-32`; composer default `:39` |
| V9 | **The alerts durable store destroys the original on the first write after a corrupt read.** An unparseable blob degrades to empty, and the next write overwrites the same key. `[loss-free-durable-migration]` requires degrade-to-empty **without destroying the original**. There is no version chain: the read hardcodes the schema version regardless of what was on disk. | `features/alerts/store.ts:66-68` + `:41-49` + `:61` |
| V10 | **Positions renders a bare pause mark with no value**: on a stream drop the session-delta cell renders `⏸` alone — neither a retained value with "last known" nor a vocabulary member with the mark. And the pause mark is a **text character**, not the declared stroke icon. | `PositionRow.tsx:388`, `:68` |
| V11 | **All three positions-side vocabulary members are reachable on the one `/positions` route** — the sim tab emits `not recorded` and `no basis`, and the Broker tab (which replaced the locked placeholder) emits `not provided`. Non-synonymy is therefore observable on a single surface. | `PositionRow.tsx:166`, `:348`; `positions/labels.ts:121-133`; `broker/brokerView.ts:13-14,146-150`; `PortfolioPanel.tsx:8,176`; union at `shared/copy/notANumber.ts:26-36` |
| V12 | **Two of the four surfaces are behind a sign-in wall** (owner lockdown 2026-08-06): `/positions` and `/scanner`. `/settings` and `/alerts` are public. A "signed out" criterion on the first two must assert the wall, not an empty page. | `app.tsx:152-165` |
| V13 | **The alerts page has zero colocated tests** — `pages/alerts/` contains exactly one file. It is the least-covered of the four surfaces and carries the most canon violations. | `pages/alerts/` glob = 1 file |
| V14 | **Absent scanner values render in the mono figure register today.** The em-dash atom is built with the surface's `MONO` constant, so a not-a-number literal renders as a figure — the inversion canon rule 24 exists to prevent. | `ScanCells.tsx:51-61` (+ `:13`, `:193`) |

### 1. Who this is for, and the stories

The trader who spends the other half of the session off the desk: triaging the universe, watching an
open book, arming a rule, setting a preference.

- **S1 — Scan honestly.** On the scanner I can tell, per row, which number Convexa computed and how old it is, without leaving the row.
- **S2 — Read my book.** On positions I can tell "we never captured this" from "the feed did not send it" from "the denominator is absent" — three different truths, three different words.
- **S3 — Set up without being lied to.** On settings I can reach any section at any width, nothing claims to be live, and nothing says "saved" when it did not save.
- **S4 — Arm a rule.** On alerts I can see which rules are armed and which firings I have not read, in a black-and-white screenshot.
- **S5 — The band under the desk agrees with the desk.** The eight quiet-band widgets answer the register question exactly the way the hero and read strip above them do.
- **S6 — Degraded is styled truth.** Every surface tells me when a value is stale, offline, absent or never recorded — and never invents one to fill the gap.
- **S7 — Empty and signed-out are their own states.** Neither reads as a failure, and neither is confusable with the other.
- **S8 — My data survives the upgrade.** No saved rule, view or position is lost by anything this phase ships.

### 2. Scope

**In**

1. Every figure on **scanner · positions (sim + broker tabs) · settings · alerts** renders through the shared figure primitive, carrying its register and its liveness in the same place the desk does.
2. **Register enforcement + container steps for the eight quiet-band widgets**, converted **in place** — phase 1 ruling 6 preserved their layout deliberately and this phase changes the anatomy, not the composition.
3. **The closed nine** enforced where these surfaces produce absent values, with the three positions-side members asserted **non-synonymous** (V11 makes this observable on one route).
4. **Declared scales + panels-as-containers** on the four surfaces (4-pt spacing ladder; radius roles panel/dialog/control/pill).
5. **Degraded-state conformance** on the four surfaces: the two offline arms, faulted store, worker-down, building rows, empty views, absent values.
6. **Settings section navigation** — a persistent section list ≥900 and the same five section names as a horizontal control below it (V6: this is construction, and I am calling it In deliberately, not smuggling it).
7. **Scanner card fallback** verified at the checked widths, rendering the same register and the same vocabulary as the table.
8. **Alerts**: unread state off the coloured edge; closed-lookup labels; no fabricated threshold defaults.
9. **Alerts durable-store safety** — a corrupt blob no longer destroys the original (V9). One of five client stores holding the user's entire record, with no server backup.
10. The **`tooltip` z-rung declared at 60** to match shipped code — a canon line at GATE S, no code change, closing phase 1/2 carried debt.

**Out (this phase)**

- Landing, blog, site, methodology and lab pages — phase 4.
- The **responsive sweep**: the design's laptop/small-laptop column drops for the scanner and positions tables, and any move of the scanner's table→cards threshold. The design specifies a five-band scanner (`design/src/screens/responsive-spec.mjs:25-26`) the shipped app does not implement; this phase records the gap and phase 4 owns it. **Naming it here is the point** — otherwise nobody owns it.
- The structure field's point-by-point **curve text-equivalent** (P1) and the **spacing-exemption remainder** — phase 4.
- The **ticker desk** — closed at phase 2, not reopened.
- The amber-census evasion debt (F1) — phase 4.
- Any backend change, any real order path, any score/tier/fingerprint change, any alerts server sync.
- Re-composing any of the eight quiet-band widgets, or rewording any shipped label/tooltip on positions or scanner.

**Future-dated (named, with a phase attached)**

| Item | Home |
|---|---|
| Scanner five-band responsive column set + 2-up tablet cards | phase 4 (responsive sweep) |
| Positions table column drop at laptop widths | phase 4 |
| Server-owned alerts (multi-device sync) | post-go-live track, not a Curvature phase |
| Broker tab real data | `broker-connect` track |
| A per-surface **subset** of the closed nine | only if a wrong-surface literal is ever observed (ruling 3's accepted cost) |

### 3. Product behaviour, per surface

**Scanner.** Two data ages on one row, each labelled as what it is. Structure (score, tier, regime,
vol, flip, walls, distances) is a **snapshot** and never wears a live mark. Price is **genuinely
streamed for some symbols and swept for others in the same column** (V3), so liveness is a per-figure
property, resolved per symbol — not a page-level claim. On a stream drop, a streamed price keeps its
last value at reduced emphasis with the pause marker; a never-streamed price stays at full strength
with no marker and no "last known" words (the two arms owner ruling 2 settled). The page's basis line
states the price state and the structure cadence separately. Absent values render as vocabulary
members in body type, never as mono figures (V14).

**Positions.** The book is where the vocabulary earns its keep. `not recorded`, `not provided` and
`no basis` each mean something different and each must be independently reachable and independently
asserted. `no basis` stays a **cell-level** state — the dollar figure beside it still renders. Live
cells degrade with a real pause **icon** and a real value or a real literal, never a bare mark (V10).
Faulted-store and offline stay distinguishable states. The Broker tab stays read-only; the one entry
affordance opens the single shared sim dialog.

**Settings.** Nothing here is live, nothing here is a scoring input, and nothing here is green.
Sections are reachable at every width. A failed write reverts the control and shows a non-blocking
error — and shows no confirmation. A value the user has not supplied says `not set` and never
pre-fills a number.

**Alerts.** State lives in the label row and in type, not in a coloured edge (V7). Every rule reads
back in the same words the composer offered (V8). A threshold the record does not hold renders a
vocabulary member, not a number. The page says plainly that rules evaluate on structure snapshots,
and carries no live mark anywhere.

**Quiet band.** Eight widgets, converted in place. Register enforced, figures stepped at their own
panel width, every hover-revealed help control reachable by tap and focus — including the
off-exchange proximity chip, which is a hover-only tooltip on a non-focusable span today
(`OffExchangeBlocks.tsx:85-89`) and sits **outside** the four widgets ruling 6 fixed.

### 4. Acceptance criteria

`test` = automated · `review` = verified by inspection · **SB** = ship-blocking. Verification method is
risk-based: automated where a silent regression is plausible (register, vocabulary, liveness marks,
absent values, durable data, overflow), review where the behaviour is visible and intentional (copy,
composition, light-mode look). **No row demands a test per criterion**; one test may carry several.

#### A. Cross-surface — the register becomes a property of the app

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 1 | S1·S5 | Every figure on scanner, positions, settings and alerts renders with a visible register — Mono for a figure traced to Convexa's own computation, Sans with a dotted rule for one asserted but untraced — and no surface sets a figure's typeface from its own local font constant | test (**SB**) |
| 2 | S1 | A call site that supplies no register cannot render a figure: poisoning one site by removing its register makes the build go red, and the poison proof is shown non-vacuous | test (**SB**) |
| 3 | S6 | A not-a-number value renders as one of the closed nine, as small Sans text, on all four surfaces — never in the mono figure register, never with a unit or currency prefix, never stepped as a figure | test (**SB**) |
| 4 | S6 | No figure on the four surfaces renders `null`, `undefined`, `NaN`, an empty cell, or a `0` standing in for an absent value, in any state | test (**SB**) |
| 5 | S1 | A figure carries a live mark only while **its own** value came from a delivering stream; no surface asserts liveness for a figure by page convention, by a header sentence, or by a widget-level flag | test (**SB**) |
| 6 | S1 | The four surfaces consume the one shipped liveness predicate and mint no second one, so the desk and a surface can never disagree about whether the same stream is live | test (**SB**) |
| 7 | S5 | Every figure on the four surfaces and in the eight widgets steps 20 → 17px under 360px of its own panel's width → 15px under 280px, at a fixed viewport width; a closed-vocabulary literal does not step | test |
| 8 | all | Every panel on the four surfaces is a container-query context, so the same figure reads at the same steps in a cell or in a rail without a viewport change | test |

#### B. Scanner

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 9 | S1 | Every scanner figure — price, change, score, flip, walls and their distances — states its register in **both** the table and the card layout, and the two layouts render the same datum identically | test (**SB**) |
| 10 | S1 | The scanner's structure figures (score, tier, regime, vol, flip, walls, distances) carry **no** live mark in any connection state | test (**SB**) |
| 11 | S1 | The price figure carries a live mark only for a symbol whose displayed price came from the stream this session; a symbol still showing the swept price carries no mark **in the same column, at the same moment** | test (**SB**) |
| 12 | S6 | On a stream drop, a price figure showing a streamed value renders that value at reduced emphasis with the pause marker; every structure figure beside it keeps identical text and is not dimmed | test (**SB**) |
| 13 | S6 | On a stream drop, a symbol that never received a streamed price renders its swept price at full strength, with no pause marker and no "last known" wording | test (**SB**) |
| 14 | S6 | While the price stream is down, no price figure flashes on change | test (**SB**) |
| 15 | S6 | The page's basis line states the price state and the structure cadence as two separate claims, and says no word asserting liveness while the stream is down | review |
| 16 | S6 | With the sweep worker down, rows keep rendering their last-known values under the warning treatment (burnt orange + icon), every figure keeps its register, and no row is blanked | test |
| 17 | S6 | A row the sweep has not computed yet renders its status chip plus closed-vocabulary members in its figure cells — never a `0`, never a mono em-dash | test |
| 18 | S7 | First load renders the cold placeholder with zero figures; it never appears after the first successful read and is not confusable with an uncomputed row or a degraded read | test |
| 19 | S7 | An empty saved view and a filter matching nothing render two different messages with two different recovery controls, and neither renders as an error | test |
| 20 | S7 | Signed out, the scanner renders the sign-in wall naming the surface — never an empty table, never a converted-but-blank page | test |
| 21 | S1 | At every width where the dense table renders, no column is clipped, the table scrolls inside its own container, and the page itself never scrolls sideways | test (browser) (**SB**) |
| 22 | S1 | At phone width the card layout carries every datum the table row carries, in the same register and the same words | test |

#### C. Positions

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 23 | S2 | Every figure in the sim book and in the Broker tab renders with a stated register; a value the app could not compute does not render in the mono register | test (**SB**) |
| 24 | S2 | `not recorded`, `not provided` and `no basis` are each reachable in at least one producible positions state, each carrying its own explanation | test (**SB**) |
| 25 | S2·S6 | The three are asserted **non-synonymous**: a record that never held the fact renders `not recorded` and neither of the other two; a feed that did not send the fact renders `not provided` and neither of the other two; an absent cost basis renders `no basis` and neither of the other two | test (**SB**) |
| 26 | S2 | `no basis` is a cell-level state — the dollar P/L beside it still renders as a figure | test |
| 27 | S6 | On a stream drop, a live-derived positions figure holding a last streamed value renders it at reduced emphasis with the pause marker and says it is the last known; with no such value it renders a vocabulary member with the pause marker and **no** "last known" words | test (**SB**) |
| 28 | S6 | No positions cell renders a bare pause marker with neither a value nor a vocabulary member beside it | test (**SB**) |
| 29 | S6 | The pause marker renders as the declared stroke icon on every positions surface, never as a text character a platform may colour-emoji | test |
| 30 | S6 | With the durable store faulted, every write affordance on a row is refused but still focusable and explained, nothing dims, and no pause marker appears — faulted and offline stay distinct states | test |
| 31 | S6 | A closed or cancelled row carries no live mark and no pause marker in any connection state | test |
| 32 | S7 | Signed out, positions renders the sign-in wall naming the surface — never an empty book that reads as "you have no positions" | test |
| 33 | S7 | Signed in with an empty book, the empty state is distinct from the wall and from a load failure | test |
| 34 | S2 | The Broker tab renders read-only with no entry, order or cancel control, and the one entry affordance on the surface opens the single shared sim entry dialog | test (**SB**) |
| 35 | S2 | Tinting on this surface stays signed-P&L direction only — never by side, never call-vs-put, never by tier | test |

#### D. Settings

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 36 | S3 | Every figure on settings renders with a stated register, and a value the user has not supplied renders `not set` — never a pre-filled number and never an inferred unit | test (**SB**) |
| 37 | S3 | At ≥900px the five sections are reachable from a persistent section list without scrolling past unrelated panels; below 900px the same five section names are reachable from a horizontal control; no section is unreachable at any checked width | test |
| 38 | S3 | Every shipped section deep-link still lands on its section, at every checked width | test |
| 39 | S3·S7 | Signed out, the page states that preferences are stored in this browser only, and never claims account persistence | test |
| 40 | S3·S6 | A failed write renders a non-blocking error, returns the control to its last known value, and shows **no** confirmation | test (**SB**) |
| 41 | S3 | The save confirmation is neutral chrome: no chip, confirmation or readiness mark on settings renders in the direction-reserved colours | test (**SB**) |
| 42 | S3 | No control or chip on settings carries a live mark or a pulse; credential readiness is stated as a state, never as a stream | test (**SB**) |
| 43 | S3 | A stored credential is shown as a masked hint only, with no key material rendered in any state | review |

#### E. Alerts

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 44 | S4 | Read and unread firings are distinguishable in a black-and-white screenshot: the distinction is carried in the label row and in type, and no state on this surface is carried by a coloured edge alone | test (**SB**) |
| 45 | S4 | Every rule's kind and level render the human label from the surface's closed lookup; no raw wire token is ever displayed | test (**SB**) |
| 46 | S4·S6 | A rule with no threshold recorded renders a closed-vocabulary member — never a default number the record does not hold | test (**SB**) |
| 47 | S4 | Every threshold a rule does carry renders in the traced register with its unit visible beside it | test |
| 48 | S4·S7 | "No rules" and "no firings" render two different messages, each naming the next action, and neither renders as an error | test |
| 49 | S4·S6 | The page states that rules evaluate on structure snapshots rather than a stream, and no element on it carries a live mark or a pulse | test (**SB**) |
| 50 | S4·S6 | A denied or unavailable browser-notification permission renders a state saying so; the control never reads as "on" for a permission the browser did not grant | test |
| 51 | S8 | Every rule and firing saved before this phase is present after it, enabled or disabled exactly as saved | test (**SB**) |
| 52 | S8 | An unreadable alerts blob degrades to an empty list **without overwriting the stored original**, and the page renders its empty state rather than throwing | test (**SB**) |

#### F. The eight quiet-band widgets

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 53 | S5 | Each of the eight widgets renders its figures with a stated register, and none sets a figure typeface from a widget-local font constant | test (**SB**) |
| 54 | S5 | No quiet-band widget can render an untraced figure in the mono register, in any state | test (**SB**) |
| 55 | S5 | Each widget's figures step at its **own** panel width (20 → 17 → 15) at a fixed viewport width | test |
| 56 | S5 | Each widget keeps its shipped composition: label wording, ordering, grouping and tooltip text are unchanged by the conversion | review |
| 57 | S5·S6 | Each widget's unavailable-this-cycle state renders its own message with its figures as vocabulary members, and an unavailable widget never blanks or degrades a neighbour | test |
| 58 | S5 | No quiet-band figure carries a live mark in any connection state | test (**SB**) |
| 59 | S5 | Every hover-revealed help control across the eight widgets is reachable by tap and by keyboard focus at every checked width — including the off-exchange proximity chip | test (**SB**) |
| 60 | S5 | Each widget states its own basis and as-of, and none is a scoring input | review |
| 61 | S5 | The off-exchange band stays neutral and context-only: no directional colour, no side claim, block prints display-only | test |

#### G. Whole-phase guardrails

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 62 | all | At **393px in both colour schemes** and at **834, 900 and 1280 in the one scheme the standing suite runs**, none of the four surfaces has horizontal page overflow | test (browser) (**SB**) |
| 63 | all | The executed case list captured before GATE Q names every width × scheme combination row 62 claims; a combination claimed but not executed is a FAIL of this row, not a PASS of row 62 | review (build report) (**SB**) |
| 64 | all | In light mode at 393 and 1280, no surface this phase touches renders a scheme-invariant background or text colour | test |
| 65 | all | No figure, chip or label on the four surfaces or the eight widgets renders below the 11px floor at any checked width | test |
| 66 | all | Every control this phase creates or touches meets the 44px effective hit area in **both** dimensions on a coarse pointer at 393px; anything failing outside that set is itemized with `file:line` in the build report as carried debt with a phase attached | test + review |
| 67 | all | `git diff origin/main...HEAD -- apps/api` returns zero lines, and score, tier and fingerprint are byte-identical | test (**SB**) |
| 68 | all | `npm run typecheck` exits 0, recorded separately from the suite's own exit code | test (**SB**) |
| 69 | all | Every gate this phase lands is proven by a poison run that goes red, and each poison proof is itself proven non-vacuous | review (build report) (**SB**) |
| 70 | S8 | No durable key or shape this phase touches loses user data: read-new-else-old, promote-forward, never-delete, idempotent, never-throw — verified against a blob written before the phase | test (**SB**) |

**Why some rows are `review` and not `test`.** Rows 15, 43, 56, 60 and 63 describe visible, intentional
output whose regression would be immediately obvious to a reviewer opening the page, and whose
automation would pin wording or composition this phase promises not to change. Rows 3, 5, 25, 46, 52
and 54 are automated precisely because they can regress **silently**: a wrong literal, a missing
register, a fabricated default and an overwritten store all render as plausible pages.

### 5. Calls I am asking the council to settle (my recommendation attached)

| # | Call | My position |
|---|---|---|
| P1 | **The BRIEF says "Scanner rows and positions rows are snapshot surfaces and must never wear a live mark." That is false as an absolute** (V3): the scanner streams prices per symbol and the positions mark degrades on a stream drop. | Split it. **Structure** figures never wear a live mark (rows 10, 58); **price** and **mark** wear one exactly when their own value came off the stream (rows 11, 27). The invariant's intent survives; its wording does not. |
| P2 | **Settings "rail → tabs at 900" is new construction, not a collapse** (V6). | **In**, scoped to navigation over the five existing panels with **zero** change to panel content. It is the one item here that is not a conversion, and it should be sized as such rather than discovered mid-build. |
| P3 | **The 11-column table's per-cell cost** (the BRIEF's own open question). | Product requirement is the **outcome**, not the mechanism: every scanner figure states its register and its absent values in both layouts, and the two layouts never disagree about one datum (row 9). The two layouts already share one set of per-datum atoms (`ScanCells.tsx:2-3`), so if per-cell chrome is too expensive at 1280, the honest answer is register + vocabulary on the shared atoms — **not** dropping the register from the table. If the architect says even that is too expensive, that is an R2 conflict, not a silent narrowing. |
| P4 | **The alerts store destroys a corrupt blob on first write** (V9). Fix in phase, or park? | **Fix in phase.** It is one of five client stores holding the user's entire record with no server backup, this phase is the only one touching alerts, and the fix is a read-path guarantee, not a key change (row 52). |
| P5 | **Design and code disagree about the scanner's responsive behaviour** (design specifies column drops at laptop widths and cards from tablet down; the shipped app has a locked 11-column set and switches to cards at its `sm` boundary). | **Future-date to phase 4** and record it in the manifest's carried debt. Doing it here doubles the phase and re-opens a locked column set. Not recording it is how it becomes nobody's. |

## Risks I see

1. **The register is a claim about provenance, and the scanner's price column has two provenances at once** (V3). If the build gives that column one register or one page-level live flag, the app will assert something false for half the rows, in a screenshot, silently. This is the single most likely way this phase ships a new honesty defect while claiming to close one.
2. **"Convert, not re-skin" invites re-composition.** Positions and scanner copy is pinned by shipped specs in other features' suites; a lane that "improves" a label while converting it breaks acceptance criteria that belong to features this phase never read. Rows 56 and 22 exist to fence this, but they are a fence, not a wall.
3. **Alerts has zero component tests** (V13) and the most violations (V7, V8). It is the surface where a conversion regression is least likely to be caught and most likely to be believed. Its rows are weighted to `test` for that reason.
4. **Vacuous degraded-state criteria.** Phase 2's split of criterion 16 is the lesson: a criterion that demands two marks the app cannot produce together goes green against an unreachable state. Rows 12/13 and 27/28 each name **which arm** they assert; if a fixture cannot reach one of them, the honest outcome is a bounce, not a pass.
5. **The settings rail drags obligations the phase did not fund** — focus order, touch targets, a second navigation model, and a new place for the 44px floor to fail. Row 66's "named in the build report" clause is the containment, and it will be tested here first.
6. **Non-synonymy can pass vacuously.** Row 25 is only meaningful if three *different* fixtures reach three *different* arms. A single fixture asserting three strings differ proves nothing about the app.
7. **Zero container contexts on four surfaces** (V1) means rows 7 and 8 are real work on every panel, not a prop. If the build declares the context only where a figure happens to sit today, the next figure added inherits a silent viewport-sized step.
8. **Scope pressure from the design source.** The v2 design describes a five-band scanner and a column-dropping positions table. Every one of those is a legitimate v2 requirement and none of them is this phase's. Without P5 recorded, they arrive as "while we're in here".

## Assumptions I'm making about the other two lanes

**Architect**

- The shared figure primitive can be **consumed from `features/` and `pages/` outside `pages/ticker/`** without inverting the repo's downward dependency rule — by moving or re-exporting it the way the closed-vocabulary union was moved to `shared/copy/notANumber.ts:18-23` for exactly this reason. If it must stay ticker-local, **rows 1, 23, 36 and 53 are unbuildable as written** and I need that at R2, not at build.
- The scanner's price cell can be given a **per-symbol provenance input** (this value came from the stream / this value came from the sweep). Row 11 is unsatisfiable against a single page-level "stream is up" boolean, and today only that boolean exists (`useLivePrices.ts:29-34`).
- Declaring the four surfaces' panels as container contexts uses the **shipped named-container mechanism** (`shared/ui/PanelContainer.tsx:15-18`) and introduces **no second container name** — an unnamed context would let a nested rail answer a figure's query instead of the panel.
- Converting the eight quiet-band widgets requires **no change to what data they receive** — the register is derivable from inputs each widget already has. If any of the eight cannot know whether a figure is traced, say so at R2 and row 54 needs a different answer for that widget rather than a blanket one.
- The alerts store can be made corrupt-blob-safe **without a key or shape change**, so row 51 is a no-op migration rather than a version chain.
- A figure primitive per cell in an 11-column table with a full scan set is **affordable at 1280**. If it is not, the fallback is register + vocabulary on the existing shared per-datum atoms (P3) — I will not accept dropping the register from the table layout.
- Nothing this phase does touches the request path or any scoring input, so row 67's empty backend diff is a verification, not a negotiation.

**UX**

- The **shipped copy on positions and scanner is not a variable this phase** — labels, tooltips, column names and status wording stay byte-identical. My rows assume wording is fixed; a proposed rewording is an R2 conflict, not a detail.
- Settings section navigation is specified as **navigation over the five existing panels** (Account · Preferences · Risk inputs · AI providers · Brokerage), with no panel content change and no new settings surface.
- The unread-firing state gets a **non-colour carrier** that survives a black-and-white screenshot, and the coloured edge is deleted rather than re-toned (V7).
- There is **one** offline treatment specified across all four surfaces — not four — and the pause mark is specified as the declared stroke icon, closing V10's text character.
- **No converted surface gains a hover-only affordance**, and the off-exchange proximity chip gets a focusable trigger (`OffExchangeBlocks.tsx:85-89`), since it sits outside the four widgets ruling 6 already fixed.
- UX will treat the scanner's live mark as the **per-figure dot** of canon rule 13, not as a page-level connection chip. A connection chip on a surface whose structure is a snapshot would be a rule-18 claim about a page that is only partly live, and I will conflict it.
- UX will **not** specify a "live"-styled readiness chip on settings (the design source draws one at `design/src/screens/settings.mjs:63`); credential readiness is a state, and row 42 says so.
