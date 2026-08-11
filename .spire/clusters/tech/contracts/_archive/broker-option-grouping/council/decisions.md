# broker-option-grouping — R3 reconcile: decision record

> Written by the conductor at GATE C R3. Input was `council/conflicts.json` (25 conflicts, 25/25
> quotes verified by `gates.mjs council_conflicts`), not the R2 prose. Every outcome below is
> either a self-revision folded in, an agent-resolved technical exchange, or a human ruling.
> **Loop cap reached** — one resolution round plus one targeted pass on the single crossed point.
>
> Round tally: **25 conflicts** = 7 self-revisions + 15 technical + 3 product (which reduce to
> **2 distinct owner questions**). Technical outcome across all six exchange files: **0 UNRESOLVED**.

---

## 0. Conductor-verified corrections to the inbound record

Two factual errors were found and fixed at this gate rather than carried into the spec.

**C0-1 — the captured book composition (BRIEF, `OPEN_THREADS.md` §7z, `RESUME.md` all wrong).**
Raised by `architect` at R2, independently verified by the conductor and again by `pm` at R3, all
three against `apps/api/tests/fixtures/broker/positions_raw.json`:

| claimed (inherited) | measured |
|---|---|
| 13 positions | **14 holdings** = 5 equity (AMD · AAPL · INTC · MU · SPCX) + 9 option legs |
| "4 apparent verticals + 1 lone NVDA call" | **3 groups + 2 lone legs** — TSLA·3 · AAPL·2 · META·2 · NVDA·1 · PLTR·1 |

**The correction strengthens the feature's central rule.** TSLA's three legs are **+10 / −4 / +4** —
mismatched sizes. So the rejected qty+opposite-side pairing heuristic does not merely become wrong
"the day two same-sized spreads sit on one ticker": **it would mis-pair the owner's actual book
today.** The rejected alternative is a present hazard, not a future one. AAPL additionally carries
both an equity row and a 2-leg option group, giving the equities-excluded ruling a live instance.
BRIEF corrected in place; §7z and `RESUME.md` still to be corrected at GATE S.

**C0-2 — the group net figures. ⚠ THIS ENTRY WAS ITSELF WRONG; CORRECTED AT S2 (2026-08-06).**

The direction claim was always right: `architect` R2 offered AAPL as a possible net *credit*, `pm`
R3 corrected it, `architect` R3 withdrew it — **all five groups are debits.** That stands.

**The figures were wrong, and the conductor introduced the error.** The original version of this
entry read `AAPL 3,850.00 · META 3,802.00 · TSLA 13,760.00 · NVDA 7,889.00 · PLTR 4,990.00` and
explicitly overruled `architect`'s META figure of 3,805.00 as arithmetic error. It was not.
**The conductor summed Webull's raw `total_cost` — a figure this app never displays — instead of
the composition the spec actually specifies** (`Σ member.net_entry_cost`, where a leg's cost is
`unit_cost × reconstructed_multiplier × signed_qty`). `council-skeptic` caught it at S2 and it is
recorded here rather than quietly patched, because this entry was cited as ground truth by the
synthesizer and by `SPEC.md` §1.

Recomputed from `apps/api/tests/fixtures/broker/positions_raw.json` with the composition formula:

| group | **Convexa renders** | Webull raw `total_cost` | gap |
|---|---|---|---|
| AAPL | **3,850.00** | 3,850.00 | 0.00 |
| META | **3,805.00** | 3,802.00 | +3.00 |
| NVDA | **7,890.00** | 7,889.00 | +1.00 |
| PLTR | **4,990.00** | 4,990.00 | 0.00 |
| TSLA | **13,760.00** | 13,760.00 | 0.00 *(residuals +1.00 and −1.00 cancel)* |

`architect` was right on both counts: META is **3,805.00**, and its "worst real gap is META at
$3.00" is exactly this table's right-hand column. NVDA is **7,890.00**, which is additionally
pinned by a **shipped passing test** (`broker/genericOptionRow.spec.tsx:77,264`) — so the wrong
figure was contradicted by the repo the whole time.

**Why this matters beyond the arithmetic:** the two numbers differ precisely *because* of the
reconstructed multiplier, which is the thing this feature must be honest about. Quoting Webull's
raw total as "what the group shows" would have made the app's own disclosure incoherent — §5's
"$3.00 gap" disclosure math is computed against the rendered figure, not the raw one. The residual
is invisible inside Convexa (AC-8 is exact arithmetic over figures the app renders itself); it
exists **only** against Webull totals this app never displays, which is exactly why reasoning from
those totals was the wrong move.

Consequence unchanged: the credit-direction case has **no instance on the real book**, so AC-9b
requires a constructed fixture and must not be assumed covered by the live-book arm.

---

## 1. Self-revisions folded in (7) — no exchange, per the R3 rule

A voice quoting its own R1 to withdraw a claim it can no longer defend. There is no opposing voice
to re-spawn and nothing for the owner to rule on.

| # | voice | withdrawn | why it could not stand |
|---|---|---|---|
| 8 | architect | group-level `no basis` rule **and** the `pl_pct` field on the group struct | both other lanes independently ruled out rendering a group percent; a computed-but-unrendered `pl_pct` is a live path to a render. Absence is stronger enforcement than a ban. |
| 9 | pm | "grouping **upgrades automatically**, and only then may a group be named" | the `structure.ts:153` finding: contract detail makes legs legible but pairing still needs a combo id `/account/positions` does not carry. Restated as two stages + a new in-scope AC that the surface is *structurally* incapable of producing a name. |
| 10 | pm | AC-16's blanket ban on `—` across the whole group row | over-reached; the Qty column exists on the header and `—` is the correct not-applicable literal there. Split into a money-slot rule (16a) + a Qty rule (16b). AC-3 (no quantity *figure*) stands. |
| 11 | pm | AC-24's "shipped treatment" for `unrecognized` entries | it would have had QA certify the mobile `ModeledPl` omission as correct. → became owner question **Q1**. |
| 22 | ux | `Build reassessment` recommendation (c), group-header placement | justified as "a copy and placement change only" — it is not. `buildBrokerReassessment` takes a `BrokerPositionView`; a group is not one, so (c) needs a merged view: the forbidden guess, handed to an AI in a payload carrying a `structure` field. |
| 23 | ux | the `Qty` `—` literal on the group header | rendering `—` still asserts "there is a quantity slot and it does not apply"; omission asserts nothing. The real objection was a blank cell in a shared 4-column grid — a layout problem solved by spanning the identity cell, not by a literal. |
| 24 | ux | §6.6 dedupe of identical fidelity notes across grouped legs | subtracts content from a member row; the BRIEF, PM AC-5 (`test`, blocks) and architect Risk 8 all forbid it, and it trades away the "per-leg truth stays visible" mitigation that makes withholding an aggregate honest. |

**Note — a collision between two self-revisions,** caught by `ux` unprompted and not present in any
conflict entry: pm's revised AC-16b *requires* `—` in the group Qty slot while ux's revision
*deletes the cell*. Resolved without re-litigation to a decidable rule: **never a blank cell** —
either the identity cell spans column 2, or `—` occupies it. The mobile card omits the slot on both
form factors, which is structurally unlike the `ModeledPl` defect (nothing is claimed by its
absence).

---

## 2. Technical conflicts — agent-resolved (15, across 3 pair exchanges)

All three pairs returned **0 UNRESOLVED** and promoted nothing to the owner.

### 2.1 `architect` ↔ `pm` (6) — 4 converged, 2 conceded
- **AC-1 book composition** — pm conceded; rewritten to "3 collapsed groups + 2 lone legs, 10
  top-level entries". The 14-vs-13 question resolved by **splitting the arms**: the fixture is
  authoritative for the test arm; the owner's live-book review arm asserts **no absolute count**,
  because a live book changes daily.
- **The compounding claim — disproved and withdrawn.** pm's R1 held that the $0.00–$2.00 per-leg
  reconstruction residual multiplies across a group (~$8 at four legs). Measured per-leg residuals
  are `+1.00, 0, 0, 0, 0, +1.00, −1.00, +1.00, +2.00`, and because a group net is a **signed** sum
  they largely cancel: TSLA **$0.00**, AAPL **$0.00**, worst real gap META **$3.00**. Separately the
  guard is not $0–$2 but proportional — `max(0.01, 0.005 × |total_cost|)`
  (`webull_adapter.py:211-214`), permitting $39.45 on the NVDA row alone. Product consequence pm
  added: **the residual is invisible inside Convexa** — AC-8 is exact arithmetic over figures the app
  renders itself, so the gap exists only against Webull totals this app never displays. New AC-10
  states the mechanism and **no dollar amount**; AC-10b confines quantification to a proportion.
- **`debit`/`credit` vocabulary** — pm conceded; the "spread vocabulary" premise is dead. The words
  already ship on a single-leg broker row (`brokerView.ts:216`) and on both sim form factors. What
  survives is narrower and kept: **one figure, never two separate totals**.
- **Withholding counts vs AND-booleans** — architect conceded, struct specified. Per-leg cause is
  reachable without re-projection: `BrokerPositionView.broker` (declared `brokerView.ts:128`,
  assigned `:257`) carries the raw wire position, so `member.broker.legs[i].cost_basis.state`
  (closed tri-state, `libs/api/src/lib/broker.ts:46`) and `.multiplier` (`:79`) are both readable —
  `brokerView.ts:192-198` already does those reads one level down. AC-17 needs no re-cut. **The
  defect-preventing part:** the number rendered beside a literal must be a **union** cardinality —
  `legs_withholding_permanent = |{cost_basis 'not_supplied' OR multiplier == null}|`,
  `legs_withholding_transient = |{'unparseable' AND NOT in permanent}|`. Naive summation
  double-counts a doubly-broken leg and renders "2 of 2 legs" when one leg is fine. Denominator is
  always `leg_count`; the count shown always belongs to the literal actually shown. **The captured
  fixture exercises none of this** (all counts 0), so the withholding path needs constructed
  fixtures — including the mixed permanent/transient case, which is the only thing that pins the
  precedence order.
- **Group percent** — converged via the architect's own withdrawal; `no basis` is unreachable at
  group level by **absence** rather than by rule.

### 2.2 `architect` ↔ `ux` (6) — 3 converged, 3 conceded
- **The naming path — the round's most important landing.** Architect withdrew its own R2 helper
  list as defective: `netEntryCost` takes a `SimPosition` (`positions/leg.ts:87`), so a builder
  following that text literally would construct the very thing it banned. Final shape: net entry is
  `Σ member.net_entry_cost` (signed, on `PositionView` — `positions/view.ts:94-95`, computed
  `:372`), gated before the sum, `isFinite`-checked after; **no leg array is ever materialised at
  group level.** The choke point is one fact: **all four entry points to the naming machine take a
  `SimPosition`** — `structureKindOf` (`structure.ts:142`), `buildPositionView`, `netEntryCost`
  (`leg.ts:87`), `positionPl` (`leg.ts:97`) — so banning the constructor closes all four, including
  against the day `structure.ts:153`'s guard stops firing.
  **Import allow-list (not deny-list):** `./brokerView`, `./predicates`, `@org/api` types. Nothing
  from `positions/*`.
  **Three enforcement layers** (`structural-over-prose-enforcement` in practice): ESLint
  `no-restricted-imports` scoped to the module, build-breaking on `nx lint` · a source scan copying
  `unrenderedBrokerPl.spec.tsx:133-164` **including both self-checks** (the non-empty-file-set
  anti-vacuity assertion at `:147` and the mutation guard at `:161`) · a render regression on a
  fixture **with strike/expiry/right populated** — the post-`/trade/instrument` world simulated
  today — asserting no `STRUCTURE_LABELS` value reaches the group header. **Layer 3 is the one that
  fails on the day the guard stops firing.**
  Numerical identity with the union-of-legs fold is exact at render precision: 2-decimal `unit_cost`
  × whole-number multiplier (`_derive_multiplier` returns `float(round(ratio))`,
  `webull_adapter.py:206`) × integer qty ⇒ exact cents; float error ~1e-13 against a 5e-3 boundary.
- **`pl_pct` — conceded as NO, not "exists with no render path".** `plPctStateOf` and `NET_BASIS_EPS`
  live in `positions/leg.ts`, off the allow-list, so the group **physically cannot** compute a
  percent.
- **No group-level fidelity-note line** — both voices converged here from opposite directions (ux
  chose the architect's option (b); the architect then withdrew its own hoisting alternative as UI
  it does not own).

### 2.3 `pm` ↔ `ux` (3) — all converged
- **Fidelity-note dedup** — ux conceded in full; member rows keep their notes verbatim on expand,
  AC-5 unchanged. Forward note: pm's revisit trigger ("more than three identical note lines") was
  calibrated against the **pre-correction** book and TSLA's 3-leg group can already emit six, so it
  is restated as a condition on the change with its own AC, never as a subtraction from AC-5.
- **The lone-leg row** — pm conceded placement, ux conceded the count. Final copy:
  **`1 option leg · as Webull reports it`** — plain text, no button, no chevron and never a ghost
  one; the leg's own qty and entry figure unchanged; `netted by Convexa` never rendered there.
  AC-23 moves `review` → **`test`/blocks**. Rejected wordings, each for the same reason: `not
  grouped`, `nothing to group`, `the only one on this ticker` — all assert an **absence of
  siblings**, which is the banned "unpaired" reading in other words. `as Webull reports it` names
  the count's *source*, not a reason. Live twice on the corrected book (NVDA, PLTR).
- **Leg count vs position count** — ux's catch upheld; AC-6 as written was true only by today's
  one-leg-per-row coincidence and would have stayed green on the day it stopped meaning anything.
  Split three ways: **AC-6** nothing-is-lost, restated over **member positions** (`test`, blocks) ·
  **AC-6b** the header's visible number is the **leg** count, noun "legs" (`review`) · **AC-6c**
  expanding reveals exactly as many legs as the header counted (`test`, blocks). Group string:
  **`3 option legs · grouped by underlying`**. Both AC-6 and AC-6c carry a GATE Q note requiring a
  book where one member position holds two legs, so the tests cannot re-pin the coincidence.

---

## 3. The crossed point — one targeted pass (within the loop cap)

`architect` and `ux` ran their exchanges concurrently and landed **opposite** conclusions on the
×100 provenance clause; neither saw the other (ux's file records that it read the adapter branch
rather than wait). This was the only open point in the round, and copy is ux's lane, so ux was
re-spawned once with the architect's file.

**Ruling: KEEP the clause, gated on a derived boolean. `ux` withdrew its unconditional drop.**

- Why the falsification condition did not fire: the load-bearing variable in "if the answer is
  'sometimes supplied,' the clause drops" was never *sometimes* — it was **undetectably** sometimes.
  A *hardcoded* sentence keeps asserting after the feed changes on a zero-line diff; a **derived**
  one disappears on that same diff. The objection is answered at its root.
- Mechanism: provenance is already carried per position as a fixed note
  (`_NOTE_MULTIPLIER_RECONSTRUCTED`, `webull_adapter.py:231-232` → `brokerView.ts:259`, held
  verbatim in the FE at `fixtures.ts:165-166`); the boolean is computed in `brokerView.ts` only and
  OR'd across a group's members.
- Why the named residual does not sink it — ux checked rather than accepted the architect's "fails
  safe": **KEEP's failure floor equals DROP's ceiling** (a wrongly-false boolean renders exactly the
  composition-only copy ux had already vouched as final, so no reachable state is worse than DROP) ·
  **the disclosure does not actually vanish** (a backend copy edit changes the note's *wording*, not
  its *presence*, and member rows render `fidelity_notes` verbatim on expand) · **the inverse
  failure is not reachable by a copy edit** (a false clause needs the note appended off the
  reconstruction branch — a behavior change, already lying verbatim on the leg row).
- Two boundaries the mechanism forced that neither prior file had: the clause renders **only where
  the net figure renders** (absent on every withheld state; present on the `$0.00`-no-direction
  case), and a mixed group says **"at least one" and never a count** — the note is
  position-granular while the withholding counts are leg-granular, so interpolating one into a
  sentence about the other is exactly the unvouched number the architect warned against.
- Copy shape: basis label ungated and unchanged; tooltip and expanded sentence each gain a second
  variant whose false-state text is **byte-identical** to the R3 strings, so the clause is one
  auditable insertion rather than a rewrite. No tolerance figure in any variant — "worked out from
  the leg's own Webull totals", deliberately weaker than the backend's "reproduced exactly", because
  a lane does not restate another party's vouch in its own voice.
- The banning AC is **struck** (it would contradict the copy), replaced by AC-P1 (clause renders iff
  the boolean is true) · AC-P2 (single exported `brokerView.ts` constant, equal to `fixtures.ts`'s
  `NOTE_MULTIPLIER_RECONSTRUCTED`, present on captured fixtures) · AC-P3 (absent when withheld,
  present on `$0.00`) — all `test`, because all 9 captured legs take the reconstruction fallback, so
  the false branch is reachable only via a synthetic fixture and a `review` marking would mean
  unverified.

**Second-order fix surfaced by this exchange:** `FidelityNotes` renders in the *visible* row body
(`BrokerPositionRow.tsx:305`), so a default-collapsed group would have hidden the ×100 caveat behind
a click while still showing the figure that rests on it. Grouping would have introduced that
regression; the gated group-level clause repairs it.

---

## 4. Bugs in shipped code found while reconciling (not introduced by this feature)

- **The withheld-literal cascade has its precedence backwards.** `brokerView.ts:207-216` returns
  `UNAVAILABLE` on a mixed input (one leg `not_supplied`, another `unparseable`) — **transient beats
  permanent**, the opposite of what all three voices independently ruled for groups. It has never
  mattered because every Webull position maps to exactly one leg, so the mixed case is unreachable
  within a position. **A group of ≥2 reaches it for the first time**, and `unavailable` there sells
  the trader a refresh that cannot work. The corrected four-step cascade is a **byte-identical no-op
  at leg level**, which is what makes the architect's "one precedence function called at both
  levels" safe to adopt rather than a risky unification.
- **`$0.00 credit` is reachable at group level.** The direction word derives from `netEntryCost > 0`
  and `NET_BASIS_EPS` is off the allow-list, so a group whose legs cancel would render a direction
  word on a zero magnitude. Ruled: at group level a magnitude formatting to `0.00` renders `$0.00`
  with **no direction word**.
- **Three pre-existing UI defects** found by ux while grounding, all **out of this feature's scope
  unless the owner rules otherwise**: the desktop `⌄` disclosure button in
  `positions/LegDisclosure.tsx` renders with `aria-hidden` and no accessible name (ux's design
  authors a *new* named button, so this feature does not depend on the fix) · `BrokerPositionRow`'s
  `:focus-within { outline: 2px solid primary.main }` will stack with the theme's authored amber
  `:focus-visible` ring on a focused group button · nested bordered+padded cards inside a bordered+
  padded group card is the concrete 393px overflow mechanism, so children must drop their frame.
  Raised as `asks`, never assumed into scope.

---

## 5. Product conflicts — the owner's to rule (2 distinct questions)

The 3 `product` conflict entries reduce to 2 questions: two voices raised the same AC-24 quote
independently.

### Q1 — mobile/desktop parity on `unrecognized` entries — **RULED: A (owner, 2026-08-06)**
> **OWNER RULING — A: fix it inside this feature.** The mobile `ModeledPl` repair is **IN scope**,
> named as a pre-existing-defect repair rather than as grouping behaviour. `AC-24` reads "renders
> identically on both form factors" and the parity AC extends to **ungrouped** entries as well as
> group rows. `pm`'s R2 self-revision (#11) is thereby confirmed rather than overridden; `ux`'s R1
> §8 ruling that the desktop behaviour is the correct one stands as the convergence target.
> Rationale of record: `[absent-is-not-none]` is promoted canon and an omitted slot is precisely the
> shape it forbids — the mobile reader cannot distinguish "no answer" from "nothing to say", and
> grouping would have deepened the split rather than inherited it.
> Consequence for GATE Q: the repair is verified on **both** form factors and is not permitted to
> ride on a group-row-only parity assertion.

*(original framing, retained:)*
`BrokerPositionRow` renders `<ModeledPl>` for an `unrecognized` entry; `BrokerPositionCard` does
not (§7z). AC-24's "its shipped treatment" names one behaviour where two exist, so a test written
to it passes on both form factors while the divergence survives — AC-29's parity check covers group
rows only and AC-5 pins expanded legs to today's rendering, so nothing in the set catches it.
Engages promoted canon `[absent-is-not-none]`: an omitted slot is the forbidden shape.
Positions: `pm` self-revised to IN scope · `ux` withdrew its in-scope assertion and handed the call
back · `architect` classifies it as scope-not-fact.
- **A (recommended)** — fix in scope; AC-24 reads "renders identically on both form factors" and
  the parity AC extends to ungrouped entries.
- **B** — out of scope; AC-24 reads "unchanged on each form factor, including the recorded
  desktop/mobile `ModeledPl` divergence", so the split ships as a **named deferral** rather than
  something an AC silently blesses.
> Either way, AC-24 must name the treatment **per form factor**. That part is not a question.

### Q2 — `Build reassessment` placement after grouping — **RULED: A (owner, 2026-08-06)**
> **OWNER RULING — A: the affordance stays on the expanded leg row only.** The collapsed group
> carries **no reassess affordance and no disabled ghost of one**; the action is reachable only by
> expanding, on the individual leg it is true of. `pm`'s R1 ruling is confirmed; `ux`'s
> recommendation (c) was already withdrawn at R2 as unbuildable and is not revisited.
> Rationale of record: it adds no new claim, and it matches the shipped `positions-legs` precedent
> that suppresses `position_eval` for a multi-leg position and for a ticker holding more than one
> open position — "the app does not evaluate a subject it cannot faithfully represent". A group is
> precisely such a subject. Option (b) was declined because removing the action entirely would take
> away a capability that is honest at leg granularity, where the leg **is** a subject the app can
> represent.
> Consequence for the spec: no group-level reassess control, no placeholder, no tooltip stub — and
> the grouping module never needs `buildBrokerReassessment`, which keeps it clear of
> `BrokerPositionView` synthesis and consistent with the import allow-list.

*(original framing, retained:)*
Held back under the one-question-per-message rule. Option (c) (group header) is **withdrawn as
unbuildable**, not merely unpopular: `buildBrokerReassessment` takes a `BrokerPositionView`, a group
is not one, so (c) requires synthesizing a merged view — the forbidden guess, handed to an AI in a
payload carrying a `structure` field. The live question is therefore:
- **(a)** stay on the expanded leg row only — `pm`'s ruling, on the `positions-legs` precedent that
  the app does not evaluate a subject it cannot faithfully represent; no new claim, costs one click.
- **(b)** disappear from broker option rows entirely.

---

## 6. Status at the close of R3

**R3 CLOSED 2026-08-06.** Technical: settled, 0 unresolved. Product: **both questions ruled by the
owner — Q1 = A (mobile parity repair IN scope), Q2 = A (reassess stays on the expanded leg row).**
Nothing is outstanding. R4 synthesis is unblocked; the synthesizer folds this file's rulings as
given and invents nothing.
