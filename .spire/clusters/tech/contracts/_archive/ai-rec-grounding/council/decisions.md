# ai-rec-grounding — R3 reconcile record

Controller: conductor. Input: `council/conflicts.json` (28 conflicts, 28/28 quotes machine-verified,
19 technical · 9 product · 5 self-revisions). Resolution artifacts: `R3-architect.md`, `R3-pm.md`,
`R3-ux.md` — one exchange, no second round.

---

## A. Self-revisions folded in (5 — a voice retracting its own R1; no exchange, nothing to rule)

| # | Voice | Withdrawn | Replaced by |
|---|---|---|---|
| S1 | architect | "`max_risk.rs` is not touched, not one line." | `ParsedRisk::NotParseable` collapses four distinct causes, so the refusal reason is underivable. The **output** widens to `RiskRefusal { NoText \| NoDollarFigure \| MultipleDifferentFigures }`; **the accepted input set does not move by one** — that is the poison test. Widening the output is not loosening the rule. |
| S2 | pm | AC-33/AC-35 as written (a runtime scripted fabricating scenario) | The harness does not exist in the Rust backend. Replaced by a hand-written fabrication **fixture** through the real serialization path + an FE payload fixture + the `AI_REC_LOCAL_ONLY=1` live arm. |
| S3 | pm | "The max-risk figure is reconciled against the quoted cost of the cited contract…" | Not computable in v1 (see D2). Withdrawn. |
| S4 | ux | the `nothing to check` card-level member | Superseded by PM's AC-15; six card members drop to five, then return to six with `convexa_rules` (D5). |
| S5 | ux | the shipped scripted chip + strip state row, and assumption A8 | Same non-existent registry as S2. Row relabelled `fabricated-rec fixture`. |

**Cross-cutting correction this surfaced — record it.** The BRIEF's evidence path (1) cited
`ScenarioLLMProvider` / `AI_REC_SCENARIOS_ENABLED`. **Those do not exist in the Rust backend**:
`recommendation.rs:358` hardcodes `"scenarios": { "enabled": false, "catalog": [] }`, `scenario_id`
(`:803`) is deserialized and never read, and the FE picker at `AiRecPanel.tsx:275` is gated on
`ai.scenarios?.enabled === true` — **dead code**. The conductor inherited the claim from the
2026-07-16 BACKLOG entry, which describes the **Python-era** harness. This is the same trap the
2026-08-11 GATE I recorded ("the backlog's code references are STALE — the backend is Rust").
The R1 architect caught it in round one; it cost no build time.

---

## B. Technical conflicts — settled by the two voices involved (19, none promoted)

| id | Pair | Outcome | Settled rule |
|---|---|---|---|
| T0 | arch↔pm | CONVERGED | Fabrication evidence = fixtures in the existing `#[cfg(test)] mod tests` at `recommendation.rs:839` (`use super::*`, so private `envelope_extras` — the real serialization path — is in scope) + an honest counterpart + an FE payload fixture + the `AI_REC_LOCAL_ONLY=1` live arm. No runtime scripted liar. |
| T1 | arch↔ux | CONVERGED | UX assumption A8 restated against a hand-written response fixture; state-matrix row relabelled. |
| T2 | arch↔pm | CONVERGED (narrowed) | "At the stated size" withdrawn, **and** the quoted-cost leg cannot produce `Traced` in v1 — `CandidateContract` carries per-share bid/ask/mid only, no multiplier, and any quantity ≠ 1 would be size inference by division. |
| T3 | arch↔pm | CONCEDED (pm) | `position_size` is IN-the-wire / OUT-of-the-checked-set: member `NotCheckable{StructurallyUnchecked}`, no per-figure clause, stated once on the definition surface, excluded from the card-level denominator. |
| T5 | arch↔ux | CONVERGED (fact re-verified) | `cap_not_derivable_reason` is **null in exactly the state UX wanted it to explain** — `auth/risk.rs:60-87` sets it only in the arm that also sets `value: None`, which returns `NoCap` before `NotCheckable` is reachable. Nothing renders off it; the reason clause rides the new `RiskRefusal` token instead. |
| T9 | arch↔ux | CONVERGED | Card token is **server-folded**, six members in fixed order: `NotApplicable · LocalRules · NoneTraced · CouldNotCheck · SomeTraced · AllTraced`, plus four integers (`checked/traced/untraced/not_checkable`). Exactly ONE branch is client-selected: block absence → `wasn't checked`. The browser never folds field tokens into a verdict. |
| T10 | arch↔pm | CONCEDED (pm) | A pure total resolver has no runtime failure mode; AC-21 re-expressed against **block absence**, the reachable state. `unavailable_envelope` renders no rec body — a named known-uncovered branch with nothing to mislead about. |
| T17 | pm↔ux | CONVERGED | PM conceded suppression (the local-fallback clauses are TRUE there and are the only free live evidence arm); UX conceded the routing. New calm member `convexa_rules`: *"No AI read here — these figures come from Convexa's own rules."* — quiet caption, **no amber**. |
| T19 | pm↔ux | CONVERGED | **"The model's voice" survives as copy and type register, never as a mechanism.** No untraced number renders as quotation or attributed speech — rendering `exit_plan.stop` (a numeric schema field) as `The AI said: stop 412` would fabricate a quotation the model never wrote. True quotation is reserved for figures the app cannot read as numbers (max-risk prose, `position_size`). |
| T20 | arch↔ux | CONCEDED (arch) | No clause where the state is structurally constant; suppression is driven by a **server token** (`NotCheckableReason::StructurallyUnchecked`) pinned to exactly `PositionSize` + `MaxRisk`, with a poison arm. |
| T22 | arch↔ux, pm | CONCEDED (arch, withdrawn entirely) | The `Dollars(v)` + `effective_cap` ⇒ verified rule is **withdrawn**. It would have made "traced" mean "under the owner's cap" — a fabricated $480 against a $500 cap would render traced — and would have let the app say `traces to Convexa's risk cap (500)` about a number the **owner** typed. `MaxRisk` is `NotApplicable`/`NotCheckable` only; the shipped `CapAnnotation` keeps the single statement. Unrenderable by construction: anchor names come from a total lookup on a closed `anchor_kind` set with no cap member. |
| T23 | pm↔ux | CONCEDED (pm) | Literal `grounding unavailable for this recommendation` withdrawn — `grounding` is the internal feature word and `unavailable` is a shipped absence literal. Replaced: `Convexa couldn't check these figures this cycle.` (server) / `This read wasn't checked against Convexa's numbers.` (block absent). AC-17 extended to make literal disjointness testable. |
| T24 | pm↔ux | CONVERGED | `Invalidation` moves onto the closed absence set (ship-blocking). `Structure`/`Strike(s)`/`Expiration`/`Entry trigger` render as on `main` and — load-bearing — carry **no** grounding clause, marker, tint or tooltip in v1, so nothing grounds a mis-stated absence. |
| T25 | arch↔ux, pm | CONCEDED on mechanism | **No percentage in any per-figure clause.** `GROUNDING_TOL_PCT = 0.1`, applied as `max(0.01, anchor × TOL/100)`, stated once on the payload and surfaced once in the tooltip. Three traced literals by a wire `basis` discriminator: `traces to Convexa's put wall (412)` (exact) · `near Convexa's put wall (412)` (inside tolerance — both numbers visible) · `inside Convexa's implied move for {expiration} ({low}–{high})` (containment; no tolerance). |

Two further architect withdrawals recorded: `Verified`/`Unverified` renamed **`Traced`/`Untraced`**;
and the R1 claim that `AI_REC_LOCAL_ONLY=1` needs no key is **false** — `recommendation.rs:655`
gates on `resolved.usable()` before the flag is read.

---

## C. Product conflicts — 8 of 9 settled without a human ruling

They were 9 restatements of 6 questions, and R3 closed all but one.

| # | Question | Outcome |
|---|---|---|
| D1 | Is `invalidation_level` — the **fifth** asserted number — in v1? | **IN, ship-blocking.** PM priced it at R2; both R3 passes confirm. Without it, `RecField`'s exhaustive `match` would have shipped with a documented exemption — a wildcard arm by another name, which is exactly what `structural-over-prose-enforcement` exists to prevent. |
| D2 | May `max_risk` count as traced when it merely sits under the cap? | **No** — architect conceded and withdrew the rule (T22). **Consequence, stated plainly rather than papered over:** `max_risk` and `position_size` are both **structurally not-checkable in v1**, so the feature's visible value sits on stop / target / invalidation / cited contract. That is a smaller feature than the BRIEF's goal sentence and the SPEC must say so in one sentence. |
| D3 | Does an untraced number keep its Convexa value slot? | **Converged, no ruling needed.** Renders **in place**, body register, with `the AI's own number` in visible text; the model/Convexa distinction is carried by a **type register split** (mono = Convexa computed, sans = model asserted), which UX raises as a DESIGN_SYSTEM Amendment. Unconditional and unchanged: **nothing untraced ever seeds, pre-fills, defaults, or is arithmetically derived into any quantity, price or limit anywhere, including the simulated entry dialog.** |
| D4 | Card-level line: qualitative, or counts? | **Counts, server-supplied** (four integers on the wire, inside UX's closed set). `Some figures here are the AI's own` collapsed 1-of-4 and 3-of-4, which are opposite advice. The browser still never counts. |
| D5 | Does the local rule-based fallback rec show grounding? | **Yes** — it is TRUE there (every figure traces because Convexa computed all of them) and it is the only zero-cost live evidence arm. Carried by its own calm `convexa_rules` member, never the amber one. |
| D6 | Scope of the pre-existing bare-`—` hole (5 fields printing an out-of-set `—`) | `Invalidation` **IN** (ship-blocking, the priced cost of D1); the other four **OUT** to a named backlog item **`rec-absence-literals-hole`** — a real pre-existing `absent-is-not-none` defect this feature neither creates nor worsens. Cut is on the record, not silent. |
| **D7** | **The noise bar: ship gate, or recorded laddered measurement?** | **OPEN — surfaced to the owner as a Decision card.** |

---

## D. Owner rulings

### D7 — the noise bar: **ruled A (laddered measurement), owner, 2026-08-13**

**Conflict:** `architect → pm`, product, against PM's AC-36 ("Across the same measured run of ≥5
ordinary real recommendations with all inputs available…"). Architect's case: the untraced rate is an
unmeasured property of the **model**, not of the design, so a ship gate on it makes two of the three
available responses damaging — widen the tolerance until misses disappear (laundering; forbidden by
the architect's §5 ladder AND by PM's own "never a parser loosening"), or cut fields until the
denominator is small. Only the third (tighten the prompt) is honest.

**Ruling: A.** AC-36 is **demoted from a ship gate to a recorded, laddered measurement**, in the same
shape PM already wrote for AC-31:

1. Measure the `traced` / `no match` / `couldn't check` split over the same **≥5 real recommendations,
   ≥3 tickers**, all inputs available.
2. **Pre-commit the response ladder BEFORE the split is seen** — this is the part that makes it a
   measurement rather than a negotiation.
3. Record the result in the committed artifact **and** in `OPEN_THREADS`, whatever it says.
4. Ladder: high `no match` ⇒ **one** prompt revision ("quote the level exactly as the context gives
   it") and **one** re-run ⇒ still high ⇒ **ship with the honest rate recorded**, and UX's Risk-3
   fallback applies (the card-level line carries the claim; the per-field clause stays quiet).
5. **Never** a tolerance widening, **never** a scope cut to flatter the number, **never** a
   synthesized run. A measurement that cannot run records its unavailability as a finding — the
   `tradeable-rec-inputs` V10 precedent, already canon at that ship.

**Still ship-blocking, unchanged** — these are properties of the design and inside the lane's control,
which is precisely why they keep the gate the noise bar gave up:
- **AC-33** — a fabricated-rec fixture must trip the check (no `traced` on any fabricated figure).
- **AC-38** — the check is **poison-proved non-vacuous**: break the guard and the build goes red.

Same ladder logic already applies to the folded-in `max_risk` prompt fix (deterministic half
ship-blocking: the sent instruction requires a single dollar amount and the two-figure fixture **still**
refuses and names the ambiguity, pinning "the parser is not reopened"; measured half laddered against
the recorded before-arm of 0 of 4).

### D8 — the block-absent prefill branch needs a THIRD literal (conductor, default-with-veto, 2026-08-13)

**Raised by:** `spire-tech-planner` at the GATE Z re-plan — flagged, not planned around. Correct call.

**The gap.** AC-68 requires a withheld prefill field to open empty **with a one-line reason drawn from
the closed literal set**. SPEC §4's table supplies exactly **two** literals — `Not pre-filled — this was
the AI's own number.` (`untraced`) and `Not pre-filled — Convexa couldn't check this figure.`
(`not_checkable`). The **block-absent** branch — no grounding block reached the browser at all — has
no literal, and reusing the `not_checkable` one there is precisely the `absent-is-not-none` collapse
that the card's own `couldn't check this` vs `wasn't checked` split exists to prevent.

**Ruling: add the third literal.** Silence is the wrong answer here, and the reason is AC-68's own
rationale: a field that simply fails to pre-fill and says nothing is the **silent blank** the criterion
was written to forbid — it reads as a bug rather than a refusal. Deciding that the gate "is defined
only over the three states" would make the dialog the one surface in the feature where an absent check
is indistinguishable from a completed one, at the single boundary where an untraced number stops being
a display and becomes an input. That is the most expensive place in the design to blur it.

**What changes — one arm, one string:**
- SPEC §4's prefill table gains a **block-absent** row with a third literal in the card's own
  `wasn't checked` register (the card says `This read wasn't checked against Convexa's numbers.`;
  the dialog needs the same distinction in the caption idiom, distinct from both existing literals and
  from every other member of the closed set).
- AC-68's literal-disjointness check covers three literals, not two.
- `PLAN.md`: F3 carries the third literal, F4's `prefillGate` lookup gains the arm, F16 renders it, and
  F17 arm 4 asserts the reason line rather than only asserting no-seed.
- **Unchanged and non-negotiable:** block-absent still **never licences a pre-fill**. This ruling adds
  an explanation, never a seed.

**Reversible, so declared rather than asked** (`OPERATOR_REPORTS` §4.2). Say `silence` to flip it.
