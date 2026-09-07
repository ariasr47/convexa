# curvature-v2-surfaces — council decisions (R3 reconcile)

Status: **R3 in progress** — 2026-09-06. Input: `council/conflicts.json` — **27 conflicts, 27/27 quotes machine-verified**
(`council_conflicts` exit 0). 7 self-revisions folded · 2 technical conflicts converged by those self-revisions ·
11 technical conflicts dispatched for ONE resolution exchange · **3 product calls surfaced to the owner one at a time**
(one further product conflict collapsed into a self-revision + D-A, see §4). Conflict ids are the first 10 hex of
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

## 3. Technical conflicts — ONE resolution exchange dispatched 2026-09-06

Inboxes: `R3-inbox-architect.json`, `R3-inbox-pm.json`, `R3-inbox-ux.json`. Responses land as `R3-{role}.md`.
Converged → folded here; not converged → promoted to a product call.

| pair | # | id | question |
|---|---|---|---|
| architect ↔ ux | 0 | `6c2cf2c5e9` | `FigureCell` cannot enter the scanner (single-anchor card; sticky nowrap table cells; header IS the label row) → extract the register/vocabulary/step decision into a pure module |
| architect ↔ ux | 16 | `154fb2122f` | …and whether the extraction must carry the WHOLE F1–F9 branch (`FigureCell.tsx:250-300`: dot, pause, `offline · last known`, `data-figure-state`) so the scanner/positions degraded arms have a host |
| architect ↔ ux | 2 | `cbef7514e4` | `off-exchange-blocks` (`:24,79-81`) and `fresh-positioning` (`:15,56-58`) DO carry mono runs from widget-local constants, with `'—'` interpolated into a mono run → split by figure, not by widget |
| architect ↔ ux | 3 | `b0f85405a7` | positions `literal()` tips (`PositionRow.tsx:145-153`) are the only non-synonymy affordance; `FigureCell` has no value-row help host → keep `literal()`, scope conversion to the header readout, or fund a help host on the primitive |
| architect ↔ ux | 17 | `66cd71c107` | `PositionRow.tsx:374-377` renders `DASH` inside a `MONO` cell → every absent-value path routes through `literal()`; `?raw` scan extended to `features/trading/positions/` |
| architect ↔ ux | 4 | `50ef9a81be` | stored `AlertEvent.message` is pre-rendered (`types.ts:32`) → forward-only criterion + carried debt, or an additive read-new-else-old shape change with a pre-phase fixture |
| architect ↔ pm | 1 | `d09285682d` | rows 6 and 11 unsatisfiable together on the scanner — exchange the FEASIBILITY/cost of options A / B / C only; the choice is **D-A** |
| architect ↔ pm | 13 | `1f765d5bd8` | "the table keeps its atoms" is mechanism, not scope — the live-derived cells (`:68,378,388`) still owe the offline contract |
| pm ↔ ux | 21 | `77667a5927` | row 56's composition freeze must carve out `_kit/copy.ts:355` (value slot holds a non-member) and `Setups.tsx:52` (one sentence for `undefined` and `[]`) |
| pm ↔ ux | 22 | `338807da91` | row 47: a score gate has no unit — split by threshold type; **register of a user-entered number** is a precedent question (promote if unresolved) |
| pm ↔ ux | 23 | `3dba77c9ca`* | row 35 certifies the green `+$0` on a fully-unmarked book (`PositionsPage.tsx:147-154,189`) → add a Net P/L row (`unavailable` when no open row is marked; coverage caption when partial) |

\* id per `conflicts.json`; verify at fold time.

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
**Ruling: PENDING.**

**D-B — settings section navigation (rail ≥900 → horizontal control <900)** (#5 `fac0c6c7cb`, #9 `faf6bdeea6`, #19 `ae12488953`).
Facts agreed: no rail ships (`SettingsPage.tsx:156` is a 640px centred column); the canvas draws it
(`design/src/screens/settings.mjs:1,5,15,28-31`) so the design-first rule is satisfied; it is the phase's only net-new
construction and drags unanswered behaviour (click vs scroll-spy; deep-link landing <900; focus order; 44px floor).
- (IN) own criteria block; click-only unless UX answers otherwise; sized as construction.
- (OUT → phase 4) recorded as carried debt with the canvas citation; settings criterion becomes "five sections reachable at
  every checked width, no page-body overflow"; U-17/U-18 and pm rows 37/38 withdrawn. **Conductor recommends** — keeps
  phase 3 a pure conversion phase; phase 4 already owns the responsive sweep.
**Ruling: PENDING.**

**D-C — Widget-frame ⓘ as a focusable control** (#6 `db0bcfc326` architect→ux).
Fact: `Widget.tsx:245-249` renders `info` as a bare icon in a hover tooltip at seven live sites, one of them the desk hero
(`StructureHeroPanel.tsx:216`); phase 1's ruling 6 declared AC-35 satisfied page-wide and it is not.
- (IN) desk reopened for this ONE shared-frame change only; the desk's shipped specs re-run inside the criterion. **Conductor recommends** —
  the alternative mints the duplicate focusable-help pattern ruling 6 bans.
- (OUT) U-32 narrows to a wrapper at the quiet band's five sites (duplicate pattern) or drops.
**Ruling: PENDING.**

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
