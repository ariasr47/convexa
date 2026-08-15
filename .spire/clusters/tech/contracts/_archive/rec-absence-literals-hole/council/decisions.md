# R3 — reconcile: decisions (rec-absence-literals-hole)

Controller-owned record of every conflict outcome. Input is `council/conflicts.json` (28 conflicts,
28/28 quotes machine-verified by `council_conflicts`; 20 technical / 8 product, of which 2 product
are self-revisions). Round artifacts: `R1-{architect,pm,ux}.md`, `R2-{architect,pm,ux}.md`,
`R3-{architect,pm,ux}.md`.

---

## A. Self-revisions folded in (a voice retracting its own R1 — no exchange, no ruling)

Nine were filed. Eight fold in as written. **One does not** — see A.9, the controller catch.

| # | voice | withdrawn claim | replacement |
|---|---|---|---|
| 7 | architect | an absent `field_reasons` block renders `unavailable` | absent block ⇒ **`not_given`** on all six. `unavailable`'s shipped copy asserts an input failed; on a pre-feature server nothing failed and on the local-rules path nothing was attempted. Converges with ux #19 and pm #14. |
| 8 | architect | an out-of-set `confidence` reported via `value_present = false` | collapses "answered off-scale" into "declined to answer". Replaced by a **third reason value** emitted only by the plan-field function; FE vocabulary call left to ux/pm. Converges with ux #18 and pm #15. |
| 10 | pm | AC-3's "all six rows still display `—`" on a `no_trade` card | factually wrong — five of the six never mount there (`AiRecPanel.tsx:929-996`). Split into two criteria: rows absent entirely / the four risk fields unchanged. Restated as negative space per ux #22. |
| 11 | pm | the "couldn't read it this cycle" fact-table row | the degraded / pre-feature state renders the **never-stated** literal; the missing-input literal asserts a cause no producer gave. Forces AC-4's three-state fixture to be restated and AC-5/AC-6 pinned to a named literal. |
| 12 | pm | "No change to the `no_trade` branch." | **narrowed**, admitting ux #20 (an absent conviction renders a literal, not nothing). Booked as a scope expansion, not silently absorbed. |
| 13 | pm | AC-21's `N ≥ 10` measurement floor | it made a non-gating measurement depend on a provider key and cap spend the gate may not have. Withdrawn; the measurement survives without the floor. |
| 26 | ux | "`grounding.counts.checked` stays at three." | asserted from tooltip wording with no vouched source; the shipped guard pins `checked == 4` (`grounding.rs:613-615`). Restated as **unchanged-ness** (`counts` byte-identical, the shipped guard passes UNEDITED) per architect #3 — the stronger claim. |
| 27 | ux | `unavailable` keyed on `missing_input: candidate_quotes` | that flag is `set.has_quoted_contract()` (`recommendation.rs:460`) — strictly stronger than "the read had contracts to name", so an unquoted-but-present set would render "an input failed" when nothing failed. Replaced by an invariant-shaped requirement on the token's MEANING, letting the SPEC pin architect's token. |

### A.9 — CONTROLLER CATCH: pm's self-revision #9 is **NOT folded in as written**

pm withdrew *"Accept currently seeds contract fields from the rec"* — its own most falsifiable
assumption — citing architect's **R1** sentence *"These six are display-only; none seeds
`TradeEntryDialog`."*

**Architect's own R2 (conflict #5) says the opposite** and cites the code:
`recToPrefill` (`prefill.ts:59-86`) sets `strike: strategy.strikes.length ? strategy.strikes[0] : 0`,
and the function's own doc says the dialog snaps from there to the nearest available chain strike —
so **a rec that named no strike already produces a chain-derived strike at the entry surface.**

pm's withdrawal therefore rests on a claim **its own author superseded one round later**. Folding it
in would have written "these fields are display-only" into the SPEC as settled fact and deleted the
one criterion covering the path where an absence becomes a *typed input*. Both voices were
individually consistent; only the controller sees both.

**Disposition:** withdrawal **suspended**. Architect is settling the fact with line evidence at R3;
pm is restating B3/B4 + AC-12/AC-13 on the assumption that seeding is real. Resolved in §B below
once R3 returns. The owner's ruling on whether the prefill fix ships here is a separate question (§D).

---

## B. Technical conflicts — one resolution exchange (R3)

13 technical conflicts across three pairs. Dispatched as one exchange per voice, each answering only
the conflicts it is party to. Outcomes recorded here on return.

| # | raised by → source | substance | outcome |
|---|---|---|---|
| 0 | architect → ux | `RecField` widening vs a disjoint `RecPlanField` | *pending R3* |
| 1 | architect → ux | `candidate_quotes` is `has_quoted_contract()`, not "had contracts to name" | *pending R3* |
| 2 | architect → ux | UX-3's no-`.length`/`''` rule reds against the shipped `fieldLiteral` value arms | *pending R3* |
| 3 | architect → ux | `counts.checked` is 4, not 3 | *pending R3 (ux already withdrew — confirmation only)* |
| 4 | architect → ux | it is **four** fabricated fields on the local-rules path, not one | *pending R3 — facts only; scope is the owner's (§D)* |
| 6 | architect → pm | AC-10's standing line fires at base rate 1.0 on the `local_rules` path | *pending R3* |
| 14 | pm → architect | absent block must not render `unavailable` | converging with self-rev 7 |
| 15 | pm → architect | off-scale conviction needs its own reason | converging with self-rev 8 + ux #18 |
| 16 | pm → architect | the confidence predicate cannot see a server-supplied level | *pending R3* |
| 18 | ux → architect | same as #15, from the copy side; proposes `unrecognized_value` | converging |
| 19 | ux → architect | absent block ⇒ `not_given`; same as #14 | converging |
| 22 | ux → pm | AC-3 pins behavior the card lacks | converging with self-rev 10 |
| 24 | ux → pm | §9.5 closes in two halves; the SPEC may claim only the first | *pending R3 — pm rules what the SPEC may claim* |

**Note on convergence:** #14/#19 and #15/#18 arrived at the same two fixes from opposite lanes
(backend mechanism and user-facing copy) and architect had already self-revised both. Three voices
independently reaching one answer is the strongest signal this round produced.

---

## C. Controller rulings — declared, not asked (OPERATOR_REPORTS §4.2, default-with-veto)

Reversible calls with a clear recommendation, where both voices had already converged. Recorded here
so the owner can overturn any of them by name.

- **#17 + #23 — card-level line budget.** Both voices independently landed on the same rule: **at
  most two card-level statements, never merged** (`ai-rec-grounding`'s existing grounding line + one
  standing line). Merging would assert a causal link between "what Convexa checked" and "whether the
  rec is actionable" that neither statement owns. **Ruled:** ship pm's conditional standing line;
  **future-date** ux's unconditional section-level caption. ux's own attached condition is adopted
  with it — see #24: with the caption cut, **the SPEC must not claim §9.5 closes**, only that its
  first half does.
- **#20 — the `no_trade` conviction chip.** `AiRecPanel.tsx:943` renders `{s.confidence && <Chip …>}`,
  so an absent conviction renders **nothing, silently** — `absent-is-not-none` collapsing at the
  render boundary on the one field of the six that does mount in that branch. **Ruled:** it renders
  the never-stated literal when absent. Never `—` (reserved to the risk block, and conviction is not
  a sizing field), never nothing. The `:956-996` risk-field block keeps its zero-line diff; `:943`
  sits outside it.
- **#21 — one new vocabulary word.** pm's "no new absence word" holds for five of six. It cannot hold
  for `confidence`, the only banded field, which can return a stated answer that is not
  `low|medium|high`; the shipped five cannot say *"it answered, off our scale."* **Ruled:** exactly
  **one** addition, emittable from exactly one place (the confidence enum validation) so it cannot
  become a second `unavailable`, and recorded as a **DESIGN_SYSTEM Amendments row** on the 2026-08-12
  precedent. Exact wording is ux's lane at R4.

---

## D. R3 closed — architect's two reversals, CONTROLLER-VERIFIED

Architect's R3 reversed two findings that the other two lanes had already built on, in the direction
that *shrinks* this feature. A reversal against a voice's own interest is credible, but both owner
decisions turned on it and neither sibling could check it (the second one refutes architect's own R2).
So the controller verified both directly, in code, before ruling.

**D.1 — "the fabrications are rule-authored, not invented": VERIFIED TRUE.**
`struct Setup` at **`libs/quant-engine/src/signals.rs:66`** carries `pub conviction: String` —
non-optional, `Serialize`-derived, assigned at **all ten** construction sites (`:277, :306, :328,
:340, :353, :374, :398, :419, :434, :452`). `name`, `strategy` and `rationale` are likewise
non-optional `String`. Therefore the three fallbacks in `local_strategy_from_bundle` —
`unwrap_or("defined-risk structure")` `:806`, `unwrap_or("medium")` `:814`, `unwrap_or("Setup")`
`:801` — are **dead code on every shipped path**, and `structure` / `entry_trigger` / `confidence` are
**category (b): authored by the `generate_signals` rule, with a named author.** Not fabricated.
> **Controller note on the near-miss.** Architect cited the path as `signals.rs:66` in a backend whose
> own services directory has no such file; a first sweep scoped to `apps/api/` found `conviction` in
> exactly two places and the struct nowhere, which looks exactly like the project's standing
> Python-era-citation failure (RESUME standing fact 1, which has bitten three times). It was not that
> — the file is real, in **`libs/quant-engine`**, one crate over. **The lesson cuts both ways: a
> stale-looking citation is a reason to widen the search, not to convict.** Recorded because the
> opposite conclusion was one grep away and would have put a false "the app fabricates four values"
> into the SPEC.

**Consequence — ux's per-field honesty table is superseded where it rested on the defaults.**
`confidence` is *not* "un-describable"; it is a rule-authored value. What survives, and is folded in:
- **`time_horizon` is the ONE genuine case** — `"1–5 sessions"` is hardcoded unconditionally at
  `recommendation.rs:829` with **no input and no producer**. Category (c).
- **ux's tooltip contradiction stands and is IN SCOPE** (it needed no owner ruling): the shipped
  `not_given` tip *"The AI produced a trade read but didn't fill this in."* (`copy.ts:192-195`)
  contradicts *"No AI read here — these figures come from Convexa's own rules."* (`copy.ts:252`) on the
  same card. **Ruled:** the six take a producer-neutral tip on their sibling selector. No new
  vocabulary; `RISK_FIELD_COPY` untouched.

**D.2 — "Accept seeds a chain-derived strike": VERIFIED FALSE, and architect's R2 was the error.**
`prefill.ts:73` seeds the literal `0`; `TradeEntryDialogView.tsx:214` is `strike: prefill?.strike ?? nearest`
— `??` is **nullish**, `0` is not nullish, so the nearest-to-spot reduction at `:204-206` **never runs**.
The doc comment at `prefill.ts:51` claims the snap; **the operator does not implement it**, and reading
the comment instead of the operator is what produced architect's R2 error.
**What the seam actually does today, verified line by line:**
| rec omits | dialog opens with | mechanism |
|---|---|---|
| `strikes` | strike **`0`** | `prefill.ts:73` → `?? ` keeps `0` |
| `expiration` | the **first chain expiration** — a real date the rec never named | `prefill.ts:72` yields `''`, and `:207` uses `\|\|` (truthy), so `expirations[0]` wins |
| `structure` | **`call`** | `biasToRight`'s final fallback, `prefill.ts:45` |
So it is not a chain-derived *strike*, but it **is** a chain-derived expiration plus two invented
defaults, pre-typed into a tradeable surface. §A.9's suspension resolves: **pm's self-revision #9 is
VOID** (pm concurred at R3), B3 is reinstated as a change, B4 rules the outcome and leaves mechanism
to architect, AC-13 is promoted to ship-blocking.

**D.3 — the keyless-fixture premise, corrected by architect (settled fact 15).** All three lanes had
ratified it. `recommendation.rs:704` returns `unavailable` before the `local_only` branch unless
`resolved.usable()` (`llm.rs:114-116`), and `commit_query()` `:742` runs on that path too. The fixture
**spends no provider money and makes no provider call, but does require configured key material and
consumes a cap unit.** Any AC naming it as a free fixture must be reworded. *(Consistent with RESUME
standing fact 2, independently re-derived.)*

---

## E. Owner ruling (the one question reserved for the human)

Reduced from two to one by D.1's verification: with the "four fabrications" finding retired, the only
remaining scope call was **D.2's Accept/prefill seam**. `time_horizon` and the tooltip contradiction
are ruled in under §C's default-with-veto; the SPEC records both.

### E.1 — Accept / prefill seam: **OWNER RULED `A` — IN SCOPE for this feature** (2026-08-14)

Question put: fix the Accept seam in this feature, or ship the literals and book it separately?
Options as presented — **A** fix here (absence is honest *and* unactionable; feature grows to touch the
guarded, shared entry dialog) · **B** ship labels now, book the fix next (smaller, lands sooner; the
one-click path stays live). **Owner chose A.**

**Binding consequences the synthesizer must carry:**
1. The feature is **both lanes plus the entry-dialog tree** — no longer inside the BRIEF's original
   path allow-list. The BRIEF's `Effort: S–M` is superseded; the SPEC states the enlarged scope
   explicitly rather than letting a lane discover it.
2. **pm's B3 is a CHANGE, not a standing prohibition**, and **B4 rules the outcome**: no un-stated
   value is pre-typed, and none is submittable by a single confirm. Mechanism is architect's lane.
3. **AC-12's five criteria stand**, including **AC-12c** (structure has no input to blank, so the
   observable is the derived direction) and **AC-12e** — refusal keys on the **value being absent**,
   never on a reason token being present, so a degraded or pre-feature response stays satisfiable
   instead of turning into a blocked Accept. **AC-13 is ship-blocking**: widening the seam must not
   disturb the path every existing user hits.
4. The three seeded defaults are named individually in the SPEC — strike `0` (`prefill.ts:73`),
   `expirations[0]` (`TradeEntryDialogView.tsx:207`), `right: 'call'` (`prefill.ts:45`) — because each
   has a different mechanism and a fix for one does not imply a fix for the others.
5. Architect's priced cost is accepted: widen `AiPrefill`'s non-nullable `strike: number` /
   `expiration: string`, and edit `features/trading/tradeEntry/TradeEntryDialogView.tsx`, **which is
   path-pinned by a shipped guard** — that guard is updated deliberately and its pin re-proved, never
   loosened to pass. *(Precedent: `ai-rec-grounding`'s CRLF episode — the tempting fix for a broken
   guard satisfies its NAME while destroying its BEHAVIOUR.)*
6. `[single-shared-sim-entry-dialog]` binds and is **honored, not narrowed**: this is a change to the
   ONE shared sim dialog's seeding, not a fork. `[no-real-order-path]` is untouched — the surface
   stays `SIMULATED`.

---

## F. S2 adversarial review — 2 passes, loop capped

**Pass 1:** 2 Critical + 3 Important. Both Criticals controller-verified before bounce (`copy.ts` = 50
em-dashes; `TradeEntryDialogView.tsx:363` `d.strike !== ''` admits `null`). → R4 pass 2.

**Pass 2:** the three Importants **closed and verified** (AC-4 non-vacuity, §2.2 no longer duplicating
the interface, `time_horizon` precondition closed with evidence), 28/28 conflict markers survived the
rewrite. **Both Criticals MOVED rather than closed** — and both are now precision defects in the
SPEC's citations of *existing scaffolding*, not defects in the design:

1. **The L2 render guard's test ids do not exist.** SPEC says it queries slots "by the test ids the
   shipped card specs already use." **Controller-verified false:** the `Field` primitive every
   risk/plan value renders through (`reasoning.tsx:22-53`) has **no `data-testid` prop at all**, and
   the shipped specs locate values by label text (`getByText(COPY.risk.maxRisk)`). The mechanism is
   buildable but must be **invented this feature**, with no prior validation — the opposite of what
   "already use" claims.
2. **The `right` arm does not type-check.** The sentinel mapping is genuinely sound for `strike` and
   `expiration` (S2 traced all three cases against the real predicate). But `right` has no
   pre-existing sentinel: **controller-verified** `LegDraft.right: OptionRight` at
   `types.ts:152` is non-nullable, so the fix requires widening it — a file outside the §2.6 allow-list,
   which names only `TradeEntryDialogView.tsx` with no glob for that tree.
   *(Note the neighbouring precedent the SPEC could have cited: `price: number | ''` at `:154` carries
   the comment "`''` = not typed yet", the same sentinel shape as `strike`.)*

**The fold on `biasToRight :44` was judged SOUND** — it follows the owner's ruled AC-12c outcome rather
than widening past it — but carries the same "asserted the outcome, did not show the line" gap.

**Controller reading:** R4 and S2 do not disagree about any fact. There is nothing left to reconcile —
only two citations to correct and one allow-list entry to add. The 2-pass cap exists to stop uncapped
*debate*; this is not debate. Surfaced to the owner with that framing rather than silently spending a
third pass or silently shipping the gaps into the plan.

### F.1 — R4 pass 3 (owner-sanctioned beyond the cap) + controller verification

Owner ruled **A**: one targeted pass for the two citation defects, nothing reopened. Scoped to
S2 pass 2's two findings plus a self-audit of the same defect class.

**Both fixed, and the self-audit found a THIRD instance of the same class — which would have been a
second compile failure:**

| defect | fix | controller-verified |
|---|---|---|
| L2's "test ids the shipped specs already use" | **false** — `Field` (`reasoning.tsx:22-53`) takes `{label,value,tip,valueSx}`, no `data-testid`. Switched to **label-text anchoring** (a *true* reuse claim — shipped specs already do `getByText(COPY.risk.maxRisk)`), needing no new prop on a shared primitive. Records the part that argues against it: the four risk labels are `COPY.risk.*` constants but the five plan labels are inline literals (`:1081`, `:1100`, `:1153`), so hoisting them is **recommended, not required**. | ✅ |
| `right` arm does not type-check | `LegDraft.right` `OptionRight` → **`OptionRight \| ''`**, *not* `\| null` — taking the precedent one line down (`price: number \| ''` `:154`, "not typed yet"; `strike: number \| ''` `:151`). Yields ONE uniform rule — **seam carries `null`, draft carries `''`, mapped at the single boundary line** — replacing pass 2's asymmetric story. `types.ts` added to the §2.6 allow-list. | ✅ |
| **NEW (self-audit): the seam is not `AiPrefill`** | The dialog's prop is `prefill?: EntryPrefill` (`TradeEntryDialogView.tsx:117`) and `openEntry(prefill?: EntryPrefill)` (`useTickerTradeFlows.ts:58`); **`EntryPrefill` is declared at `types.ts:24-40` with the same three non-nullable members.** Both interfaces widen. | ✅ verified independently — `expiration: string`, `strike: number`, `right: OptionRight`, all non-nullable |

Also corrected by the audit: `useTickerTradeFlows.ts` sits **outside** the `ai-rec/**` glob and needed
its own allow-list entry · the L3 glob citation · the `RiskField` range (`:758`, the verified one) ·
§2.3 now states `Field` needs **no** new prop. Recorded in a new §2.7 so the class is not
re-introduced. **Six `[lane-check]` marks** now flag claims the synthesizer could not verify cheaply
rather than asserting them — the correct response to having been wrong three times about existing code.

**L2 non-vacuity strengthened** beyond what S2 asked: the guard **declares its enumeration and asserts
every enumerated label resolved, with an exact count**, so tagging five of six reds where a bare
"non-empty" assertion would have passed.

**`biasToRight` Important closed with the line shown**, not the outcome asserted:
`if (structure == null || structure.trim() === '') return null;` **ahead of** `:41`'s
`(structure ?? '').toLowerCase()` collapse — the same absent-vs-unparseable collapse §2.2 forbids
server-side, applied client-side. `:44`'s bias derivation stands unchanged when structure IS present.

**Controller verification performed directly** (not a third S2 pass — the owner sanctioned a spec pass,
not another review round): `EntryPrefill`/`LegDraft` types read at source · allow-list confirmed to
carry `types.ts` + `useTickerTradeFlows.ts` · **28/28 conflict markers intact** · `contract_lint`
**0 errors** · all four artifacts NUL-free (CLAUDE.md byte-scan trap).

**Carried, not fixed — the standing warning the plan and both lanes inherit:** `SPEC.md` is
**75,709 bytes / 790 lines** against a 40KB budget, and pass 3 *grew* it ~10KB (the §2.7 correction
table, the reuse-claim preamble, the expanded §2.5/§7 mechanisms). Accepted deliberately: the owner
ruled precision in, and no binding rule, AC, citation or recorded resolution was dropped to chase a
number. It is a real cost — every downstream reader re-attends it every turn.
