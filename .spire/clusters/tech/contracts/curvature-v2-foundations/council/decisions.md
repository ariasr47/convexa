# curvature-v2-foundations — R3 decisions record

Written by the conductor at R3. Every conflict from `conflicts.json` (32, all quote-verified by
`gates.mjs council_conflicts`) is accounted for here: folded self-revisions, agent-resolved technical
exchanges, and the questions routed to the owner. Per-conflict reasoning lives in `R3-architect.md`,
`R3-pm.md` and `R3-ux.md` — this file is the index and the outcome of record.

## 1. Self-revisions folded (9) — no exchange, per the method

A voice quoting its own R1 to withdraw a claim it could no longer defend. There is no opposing voice to
re-spawn and nothing for the owner to rule on.

| # | voice | withdrew |
|---|---|---|
| 1 | architect | My rule: at most one *visible* liveness claim per page, enforced in the e2e layer where visibility is real, plus a unit-level assertion that the resol |
| 2 | architect | `value: string \| NotANumber` where `NotANumber` is the **closed six-member union** from canon rule 24, exported as a type. The cell branches on membe |
| 3 | architect | If the palette wants recent tickers, that is a new `convexa.*` key and therefore a `[loss-free-durable-migration]` surface — my position is **defer it |
| 4 | pm | On a stream drop, a live-derived figure keeps its **last known value** at reduced opacity with the pause marker and says it is the last known value —  |
| 5 | pm | Each of the six not-a-number literals renders as small Sans text, never as a figure, and never substitutes for another member; the member count is six |
| 6 | pm | With a genuinely delivering stream, the page carries **exactly one** liveness claim — counting the chip, any live dot, any pulse and any "live" wordin |
| 7 | ux | \| **replay** \| `replay · {SYMBOL} {Wed Sep 2}` \| **outline** \| hollow ring \| no \| The only outlined chip; it names a *stored session*, which is  |
| 8 | ux | `FigureCell` lands **in place** at every existing `StatTile` call site (`LiveTape` 4 cells, `DealerPositioning` 11–12, `IvRank`, `MarketContext`, `Str |
| 9 | ux | Body shows **recent tickers** (client-local) then the tracked-universe default view. |

## 2. Technical conflicts, settled between the voices (13)

One exchange each, as the method caps it. Verdicts by voice: **architect** 3 resolved-agree · 3 position
stands · 2 conceded · 0 promoted. **pm** 4 conceded · 2 requirement-stands-evidence-withdrawn · 1
resolved-agree · 1 mark stands · 0 promoted. **ux** 3 stand · 4 conceded · 2 resolved-agree · 1
conceded-with-correction · 0 promoted. **No technical conflict was promoted to a product call**, and
every one was settled on a file:line read or a canon rule number rather than on seniority.

The five that change what gets built:

| conflict | outcome | evidence that settled it |
|---|---|---|
| Consumer count of the accent-bar primitive (raised twice, independently) | **Conceded by pm and ux.** Two importers, not six or seven | `LiveTape.tsx:35`, `DealerPositioning.tsx:25`; 16 render sites (12 + 4). `LiveTape.tsx:2` says five live-derived tiles; the JSX renders **four** — count from the JSX |
| AC-1, the single-liveness-claim criterion | **pm conceded**; rewritten in three scopes (page / widget / figure) | Canon rule 13 (`DESIGN_SYSTEM.md:168`) mandates a per-figure dot; rule 18 (`:173`) forbids a second page claim. Read literally they contradict, so rule 18 is chip-scoped |
| How to observe "one chip" | **Both proposed fixes rejected as wrong in the same direction** | `CommandDeck.tsx:226` mounts the chip conditionally; when condensed, the hero header stays mounted and not aria-hidden, and an out-of-viewport node passes `toBeVisible()` in both harnesses. Honest observable: one chip **in the viewport** at both scroll positions |
| Directional accent on Call wall / Put wall | **ux withdrew its own "replacement mark required"** — deleting the colour deletes no information | The side is in the label words (`DealerPositioning.tsx:103,111`: `label="Call wall"` / `"Put wall"`) and the sign is in the value glyphs, pinned by `_kit/copy.spec.ts:54` (`−$` prefix, U+2212). Labels stay ungossed: the shipped tooltip hedges with "*Tends* to act as resistance" and a label would drop the hedge |
| Container-query enforcement | **Two blockers found, both structural** | `Widget.tsx:157` sets `containerType` with **no `containerName`** (the only container declaration in the app), so a nested rail can answer instead of the panel; and `type-floor.spec.tsx:39` returns the *first* rule bearing the class, so it is blind to `@container` blocks and would pass with them deleted |

Mechanisms handed to R4: `containerName: 'panel'` as a required edit; `type ReplayStanding = Exclude<ConsumeStanding, { kind: 's0' }>` derived from the shipped 8-member union at `sessionTapeStanding.ts:46-54` rather than retyped; the connection-chip resolver kept **out** of the `shared/ui` barrel (`index.ts:10-13`) or a re-export blinds the importer-set scan, the same reason `arc.ts` is excluded; `ai-rec/AccessibleHelp.tsx:8-12` as the already-shipping focusable-ⓘ pattern.

## 3. Product conflicts → owner questions (10 conflicts, 6 distinct questions)

Several were raised from both directions, so they collapse. Status as of writing:

| # | question | raised by | status |
|---|---|---|---|
| 1 | What the trader sees **before the first stream fact** | all three, both directions | **RULED A** (owner, 2026-09-03) |
| 2 | **Offline retention** — conform to rule 13 now, or scope the clause | architect + ux vs pm | **RULED A** (owner, 2026-09-03) |
| 3 | **Closed vocabulary count** — six in canon vs nine shipped | ux + architect (both conceded their own six-member versions) | **RULED A** (owner, 2026-09-03) |
| 4 | **Pre-existing debt boundary** — spacing vs radius | pm vs architect | **RULED A** (owner, 2026-09-03) |
| 5 | **44px audit scope** | architect vs pm | **RULED A** (owner, 2026-09-03) |
| 6 | **Hover-only ⓘ affordances** on the four look-alike widgets | pm vs architect | **RULED A** (owner, 2026-09-03) |

**Withdrawn from the owner queue:** the call/put replacement mark (question 7 as originally counted) — ux
withdrew the requirement at R3 on verified evidence, so there is nothing left to rule.

## 4. Canon tension to record at close (not a blocking decision)

Rules 13 and 18 contradict each other read literally: a conforming figure cell's per-figure live dot is
"a second liveness claim" under rule 18. Resolved in-council as rule 18 being **chip-scoped**. This
belongs in the canon's Amendments table as a clarification, and is flagged for the owner at close.

## 5. Owner rulings

### Ruling 1 — pre-first-fact liveness (2026-09-03): **A, the wordless placeholder**

**The conflict that prompted it.** pm R-B/AC-9 required a loading chip before the first payload; ux §3
refused it in terms — *"A 'connecting' chip is the seventh state, and it is banned"* — grounded in
 `TickerHeader.tsx:329` returning `null` when there is no label to resolve. The architect marked it
`product` because both are honesty arguments pointing opposite ways and neither is a feasibility question.

**The ruling.** The chip **slot** renders the existing wordless cold-skeleton placeholder until the first
stream fact is observed; on that fact it latches to one of the six states and can never return to the
placeholder. This is the visible **absence of a claim**, not a seventh claim, so canon rule 18 stands
unamended at six states — record this reading in the canon rather than the state count.

**What binds the build:**
- The placeholder is **wordless**. Any text would assert a connection status we have not been told.
- The latch is **monotonic and structural** — a re-derivation that could re-enter the placeholder after a
  payload is a defect, not a state. The union must make re-entry unrepresentable rather than merely unlikely.
- The acceptance criterion asserts a **positive observable** (the placeholder is present in the chip slot
  before the first fact), which is what pm objected was missing from a bare absence: "nothing is on the
  page" passes identically when the resolver works, when it throws, and when the stream never opened.
- Observability follows the R3 finding: **one chip in the viewport** (`toBeInViewport`) at both scroll
  positions — not an attached-node count and not a visible-node count, both of which red-build correct code.

### Ruling 2 — offline retention (2026-09-03): **A, the cell supports it; the tape adopts it in phase 2**

**The conflict that prompted it.** pm AC-17 required that a live-derived figure "keeps its **last known
value** … never blanked, never replaced by a zero or a dash." ux and the architect both verified at source
that no live-derived cell does this: `LiveTape.tsx:73` gates on `numbersActive`, `:78` computes
`netFlow = numbersActive && live ? live.net_flow : null`, `:140` renders the `—` literal, and
`StatTile.tsx:139-146` prints a bare `⏸ offline` with no "last known" clause. Today's real output on a drop
is `— · ⏸ offline` — a pause marker attached to a value that is not there. The architect then corrected its
own R2 framing: retention is **not** new scope, because canon rule 13 (`DESIGN_SYSTEM.md:168`) already
requires "Offline keeps the **last known value at 50% opacity with a pause marker** and says so." The
question the owner faced was conformance, not scope.

**The ruling.** `FigureCell` implements the retained-value state, and the `· last known` clause is
**data-driven**: it renders only when a retained value actually exists, never as a fixed caption. Phase 1
does **not** add the retention latch to `LiveTape`; that lands in phase 2, where the desk rebuild already
touches that code. Canon rule 13 takes a one-line clarification recording that the clause is conditional.

**What binds the build:**
- The offline state has **two arms** (ux F4/F5): retained-value-present and no-retained-value. The second
  renders the not-a-number literal with the pause marker and **no** "last known" words.
- No fabrication: a caption asserting a last known value that does not exist is the failure this ruling
  exists to prevent, and it is exactly what the design drawing (`design/src/screens/desk-states.mjs:40`)
  would have produced if implemented literally.
- Retention is a **real mechanism, not wiring**: `useFlashOnChange.ts:44` writes `prev.current = value`
  *before* its null guard at `:46`, so a drop destroys the last non-null value. Nothing holds it today.
- Phase 2 owes: a last-non-null latch per live field, cleared on symbol change and on replay arm, plus a
  test that a latched value is **not** re-flashed by `useFlashOnChange` (it did not change).
- Carried into the phase-2 brief, not lost here.

### Ruling 3 — the closed not-a-number vocabulary (2026-09-03): **A, amend rule 24 to the shipped nine**

**The conflict that prompted it.** pm AC-19 asserted "the member count is six"; ux and the architect each
verified independently that the app ships more and each withdrew its own six-member version — the architect
conceding that its closed six-member `NotANumber` union was "worse than useless", because a seventh literal
is not a type error, it is a plain `string` that falls into the **mono figure register**. That is the exact
inversion the register exists to prevent: a missing cost basis would render as though Convexa had computed it.

**The shipped set, verified by count.** The canon's six (`—`, `unavailable`, `not given`, `not set`,
`size not suggested`, `unrecognized`) plus three that are spec-pinned as **non-synonymous**:
`not provided` (`broker/brokerView.ts` — the feed did not send it), `not recorded`
(`positions/PositionRow.tsx:166` — never captured), `no basis` (`positions/labels.ts:126` — cost basis absent).
`BrokerGroupHeader.spec.tsx:193-194` asserts specific literals must *not* appear, which is what makes them
distinct rather than sloppy.

**The ruling.** Canon rule 24 is amended to the shipped **nine**, recorded as one closed vocabulary with each
member's meaning. The register rule holds across all nine: any member renders as small Sans text, never as a
figure, and never substitutes for another member.

**What binds the build:**
- One closed union of nine, and — per the architect's R3 concession — **the caller picks the member**; the
  type enforces closure, not choice.
- The acceptance criterion asserts **closure and non-synonymy**, not a count. A count-based AC is what made
  pm's original row unsatisfiable without deleting shipped literals from screens this phase does not touch.
- Accepted cost of one vocabulary over two: nothing structurally prevents a ticker surface from rendering
  `no basis`, which would be meaningless there. No code path produces it today; if one appears, the fix is a
  per-surface subset, not a second vocabulary.

### Ruling 4 — the pre-existing debt boundary (2026-09-03): **A, radius In, spacing fenced**

**The conflict that prompted it.** The architect's non-goal 9 declared "**No burn-down of the pre-existing
spacing/radius debt** beyond making it visible and fenced", while its own §2 required a per-site read of the
numeric radius sites and its risk 3 conceded the result "will visibly change surfaces this phase claims not
to touch". pm marked the contradiction and asked for two rulings rather than one sentence covering both.

**The mechanism, verified by the controller.** `node_modules/@mui/system/borders/borders.mjs` resolves
`borderRadius` through `createUnaryUnit(props.theme, 'shape.borderRadius', 4, 'borderRadius')`, so a numeric
`borderRadius: n` in `sx` means **n x shape.borderRadius**, not n pixels. Moving the panel radius 10 -> 12
therefore scales every numeric site by 1.2x. Measured on 2026-09-03: **38 numeric `borderRadius` sites across
31 files** (excluding specs). The architect's spacing count of 86 occurrences across 35 files is recorded as
its number and was not independently verified here.

**The ruling.** **Radius is In**: every one of the 38 sites is read and set deliberately — to the declared
scale (panel 12 / dialog 16 / control 8 / pill 999) or to an explicit px value chosen to survive the shape
change. Silence is not an option at any of them, because the mechanism moves them whether or not anyone
looks. **Spacing is fenced**: a seeded exemption list ships as the phase-1 deliverable, its occurrence count
goes in the build report, and a named later phase burns it down.

**What binds the build:**
- The radius sweep is a **per-site judgement**, and no test would catch a wrong one. The build report must
  name every site whose rendered radius changes, so GATE Q can review the list rather than re-derive it.
- The dialog / control / pill radii need `MuiDialog` / `MuiButton` / input theme overrides; a single
  `shape.borderRadius` value cannot serve four declared roles (architect §2).
- The spacing exemption list must be **live-checked** — a stale list that silently stops matching is worse
  than no list, which is the failure mode the arc importer-set scan already guards against elsewhere.
- The exemption list carries an expiry: the named later phase, not an open-ended grandfather.

### Ruling 5 — the 44px touch-target audit (2026-09-03): **A, scoped to what this phase creates or touches**

**The conflict that prompted it.** pm AC-34 required that "every interactive control on the four product
surfaces" meet the 44px floor on a coarse pointer at 393px. The architect marked it ship-blocking in the
wrong way: an app-wide audit wearing a foundations criterion, whose failures could only be fixed by
re-laying-out screens the phase's own non-goals forbid it to touch. The shipped mechanism is also narrower
than the claim — `shared/theme/theme.ts:80-102` applies the coarse-pointer floor to the selector list
`button, [role="button"], a`, so an interactive element that is none of those three is outside the floor today.

**The ruling.** AC-34 narrows to the controls this phase **creates or touches**: the command palette dialog
and its rows, the burger drawer, the nav links, the connection chip if it becomes interactive, and
`FigureCell`'s info affordance (which this phase turns into a real focusable control). Anything failing
outside that set is **named in the build report** as accepted, carried debt with a phase attached — not
silently passing and not silently blocking the phase.

**What binds the build:**
- The narrowed criterion must still be measured, not asserted: an effective hit area in **both** dimensions
  on a coarse pointer at 393px.
- Any control this phase creates that is not a `button`, `[role="button"]` or `a` falls outside the theme's
  selector floor and needs its own explicit sizing — the selector list is the mechanism, so a new element
  type silently escapes it.
- "Named in the build report" means an itemized list with file:line, not a sentence acknowledging debt exists.

### Ruling 6 — the hover-only info affordances (2026-09-03): **A, fix the six sites in phase 1**

**The conflict that prompted it.** pm AC-35 requires that every control revealed on hover has a tap and
keyboard path. pm then verified that `IvRank.tsx:91` and `DealerFlowProjection.tsx:77` wrap a non-focusable
`InfoOutlinedIcon` in a hover `Tooltip`, and that neither widget imports the primitive this phase replaces —
so the architect's two-file sweep leaves them untouched and AC-35 would be **certified as passing on a page
where it demonstrably fails**. ux's R3 read narrowed the true gap to six hover-only info sites across the
four look-alike widgets (`IvRank`, `MarketContext`, `StraddleMove`, `DealerFlowProjection`), which are
otherwise already correct: all four are declared static and already render their figures in mono by hand, so
the register and liveness promises are visually true there today.

**The ruling.** Phase 1 fixes the six sites, using the pattern that already ships —
`ai-rec/AccessibleHelp.tsx:8-12`. This is a **deliberate exception** to the scope discipline set in ruling 5,
and the distinction is recorded so it is not read as a precedent: this is a mechanical swap onto an existing
component, not a re-layout, and it converts a false acceptance criterion into a true one. Canon rule 20 is
failing on the app's densest page today; a reviewer with a mouse cannot see it.

**What binds the build:**
- Use `AccessibleHelp`; do not invent a second focusable-help pattern. A second pattern is a new rule with no
  enforcement behind it.
- AC-35 is then page-wide on the ticker surface and true, rather than narrowed to the new primitive.
- The four widgets keep their current layout: this changes the affordance, not the composition. Their
  remaining structural gaps (no register enforcement, no container steps) stay out of phase 1 and belong to
  the phase that rebuilds them.
- Do not "fix" their mono figures: ux verified they are correct — a static figure's correct render is no dot.

### Ruling 7 — the light-mode floor for `steel2` (2026-09-03, post-build): **A, darken it**

**What prompted it.** SPEC §9 D-1 recorded that the canon states a measured **dark** floor for
`steel2`/`extras.textTertiary` and only "a solid light-mode value" for light, and refused to invent a
number. The build measured both schemes (AC-42) and the conductor recomputed every figure independently
from the raw hexes: light `#61708A` scores **4.23:1 on `panelRaised` `#ECECE7`** — the widget card surface
where a real tertiary label actually sits — against WCAG AA's 4.5:1 for normal text. Dark is fine (4.83
panel / 5.18 ink). Nothing gated on it, because no light floor existed to gate against.

**The ruling.** Darken the light-mode value until it clears **4.5:1 on every light surface where
`textTertiary` can appear**, and then declare that floor in the canon so it is enforceable rather than
rediscovered. A token value change is exactly what a foundations phase is for.

**Candidates computed by the conductor** (same hue 218°, same saturation, stepping lightness down):

| candidate | `panelRaised` #ECECE7 | `paper` #F6F6F3 | white | `raised2` #E3E3DD |
|---|---|---|---|---|
| `#61708A` (current) | 4.23 ✗ | 4.63 | 5.01 | 3.89 ✗ |
| `#5D6B84` | 4.54 ✓ | 4.97 | 5.38 | 4.18 ✗ |
| `#58657D` | 4.96 ✓ | 5.43 | 5.88 | 4.56 ✓ |

**What binds the build:**
- The lane picks the value by **where `textTertiary` can actually render**. If it can appear on `raised2`
  (a light surface this phase adds), `#5D6B84` is not enough and `#58657D` is the honest floor. Determine
  usage from the code; do not assume.
- The value changes in `tokens.ts` (the runtime authority) **and** in `design/tokens/tokens.json` (the
  mirror), and `node design/src/verify-tokens.mjs` must pass — the mirror drifting from the runtime is the
  precise failure that file exists to prevent.
- AC-42 stops being dark-only: the light floor is now stated, so it gets asserted, against the darkest
  light surface `textTertiary` may occupy.
- `BUILD_REPORT.md` §5 is updated with the new measurements; the old ones stay as the before.
- The canon gains the light floor as an Amendment (conductor's action at close, not the lane's).

### Ruling 8 — AC-13b (2026-09-03, post-GATE-Q): **A, amend the criterion**

**What prompted it.** GATE Q's re-run returned 79 PASS / 1 FAIL / 1 UNVERIFIABLE; the single FAIL was
AC-13b, and it is a defect in the criterion rather than in the code. As written it requires that
Opportunity-tier emphasis survive "in **type and the single amber word already inside the value string**".
QA verified in the browser that the value renders `77 - Actionable` as one Plex Mono span at
`rgb(233,228,214)`, identical in both schemes, and that `ValueGlyph` hardcodes `color: 'text.primary'` and
exposes no value colour. It then read `HEAD` and established the premise was **already false before this
phase**: the pre-phase call site passed `accentColor={tierColor}` and no `valueColor`. There has never been
an amber word in that value string. Tier emphasis lived in the accent bar this phase deletes.

**The ruling.** Amend AC-13b to assert what is true and wanted: tier emphasis survives in the **word**
(`Actionable`) carried inside the value string, in **type only** - no replacement colour, and never a
directional one. The guard the criterion exists to hold - that nothing reintroduces colour, least of all a
green/red one, on a non-directional datum - is preserved verbatim.

**Why not the alternative.** Rendering the tier word in text-grade amber was rejected: the canon spends
amber on the AI read's verdict word as the panel's **single** spend (rule 16), and a second amber word on
the same page dilutes precisely what makes the first one carry meaning. This is the same shape as the
earlier Call wall / Put wall resolution, where the label words already carried the distinction and a
replacement mark was withdrawn.

**What binds the follow-up:**
- The amendment is a **one-clause factual correction** to the criterion text. The hidden folding receipt and
  every `spire:council-resolution` marker stay byte-identical, and `contract_lint` must still exit 0.
- SPEC §9's D-1 entry and the AC-42 row are updated in the same pass to record that ruling 7 landed
  (`steel2` light = `#5D6B84`, floor now stated and asserted) rather than still reading "pending a ruling".
- Separately, two tests labelled "MUTATION PROOF" have no-op bodies (`expect(true).toBe(true)`) at
  `connectionState.spec.ts:101` and `FigureCell.spec.tsx:285`. Their comments are honest about why, but a
  no-op under that heading reads as coverage to every later reader; QA rejected both as proof and performed
  the mutations itself. They are replaced with real assertions (or the heading removed) in the same pass.
