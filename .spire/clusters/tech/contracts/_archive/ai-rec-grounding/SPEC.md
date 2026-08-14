# ai-rec-grounding — spec

**Source brief:** .spire/clusters/tech/contracts/ai-rec-grounding/BRIEF.md
**Council:** R1 positions · R2 critiques · R3 resolutions · decisions.md   (under council/)
**Skeptic:** council/S2-findings.md — 1 Critical, 7 Important, 3 Minor, all dispositioned
**GATE Z:** SYNTHESIZER_AMENDMENTS_REQUESTED.md — Z1 (AC-7 · AC-68 · §4 · §8) and Z2 (AC-32 · AC-36 ·
§9 item 7) folded; decisions.md §D8 (the block-absent prefill literal) folded into §4 + AC-68, with the
matching §5 literal name corrected; nothing else reopened
**Status:** draft — skeptic-reviewed, GATE Z amended, D8 folded

---

## 1. Goal + scope

The AI recommendation card asserts numbers a trader sizes against. Today exactly one assertion class is
checked server-side (`rec_inputs/cited.rs` matches the named contract against the candidate set;
`rec_inputs/cap_check.rs` compares the parsed `max_risk` against the owner's cap). Every other asserted
figure is rendered verbatim from the model with nothing comparing it to a number Convexa computed. This
feature generalizes the shipped `cited` mechanism to the model's other asserted price-scale numbers: at
serialization, each one either resolves to a figure this app computed — and the card names that figure —
or it renders **in place, marked as the AI's own**, never as one of Convexa's numbers. It also folds in
the measured `max_risk` prompt defect, because that is the same surface and the same session.

**The honest size of v1, stated plainly rather than papered over.** This feature checks **the exit stop,
the exit target, the invalidation level and the cited contract**. It does **not** check the dollar risk
figure (`max_risk`) or the suggested size (`position_size`) — both are **structurally not-checkable in
v1**: the cap is a number the *owner* typed (so "under the cap" is not traceability), there is no
contract multiplier anywhere on the rec path, and `position_size` is never parsed by any lane by design.
That is a smaller feature than the BRIEF's goal sentence ("every number the AI recommendation asserts"),
and it is recorded here as a stated limit rather than covered with a cap-anchored badge.

**In scope**

- Per-figure grounding for `exit_plan.stop`, `exit_plan.target` and `invalidation_level`, resolved
  server-side against the levels and the straddle-implied move **as sent to the model**.
- `RecField` gains a fifth variant, `InvalidationLevel` (D1, ship-blocking). Without it the exhaustive
  `match RecField` would have shipped with a documented exemption — a wildcard arm by another name.
- The cited contract's grounding, **derived from the shipped `CitedState`, never duplicated** into a
  second token that can drift; it contributes to the card-level counts and keeps `CitedContractLine` as
  its only rendered surface.
- `max_risk` and `position_size` stay **in the wire vocabulary** (omitting them is the
  `absent-is-not-none` collapse) but are **out of the checked set**: they carry
  `not_checkable / structurally_unchecked`, render no per-figure clause, and never enter the
  card-level denominator.
- A server-folded **card-level token plus four integers**; the browser never counts, compares or folds.
- The folded-in `max_risk` prompt fix: a single-dollar-figure directive in `build_rec_prompts`, plus a
  widening of the **output** of `max_risk.rs` to `RiskRefusal { NoText | NoDollarFigure |
  MultipleDifferentFigures }` so the refusal reason is renderable.
- `Invalidation` moves onto the shipped closed absence-literal set (`fieldLiteral`) — the priced cost of
  taking `invalidation_level` into the checked set.
- **A gated prefill in the shared simulated entry dialog.** The stop/target seed becomes conditional on
  the figure's grounding state, and a withheld field says why. This is a **behaviour change to a shipped
  surface** (§4), not a no-op: D3 names this dialog explicitly, and it is the one place in the app where
  an untraced number stops being a display and becomes an input.

**Out of scope**

- **No prose-number extraction.** `summary`, `rationale`, `key_points`, `entry_trigger`,
  `time_horizon` are not scanned for numbers, and the named-levels row does not ship. One statement,
  placed with the reasoning, says prose numbers are not checked.
- **No loosening of `max_risk.rs`'s acceptance.** Which inputs refuse does not move by one input.
  Only the output widens.
- **No parsing of `position_size`; no typed size field** (stays future-dated at `OPEN_THREADS §7ad`).
- **No cap-anchored traced claim.** `traces to Convexa's risk cap (500)` is a sentence this app must not
  be able to say, and it is unrenderable by construction (the anchor lookup has no cap member).
- **No widening of the export endpoint.** `GET /api/recommendation/export/{ticker}` carries no
  `strategy` and no system prompt, and it gains neither here — widening it would open a new egress
  surface and drag in `egress-copy-tracks-payload` for no stated product need (GATE Z, Z2). The
  consequence for the two criteria that assumed such an artifact is recorded in §9 item 7.
- **No refusal, no withholding, no auto-correction, no re-ask.** A figure that fails to resolve never
  blanks, greys, gates or re-prompts anything **on the card**; the entry-dialog prefill gate above is a
  deliberate, separately-stated exception on a different surface.
- **No runtime fabricating provider behind an env flag.** A config flip must never be able to put a
  lying model in front of a trader. Fabrication lives only in fixtures.
- **The four other bare-dash fields** — `Structure`, `Strike(s)`, `Expiration`, `Entry trigger` — render
  exactly as on `main`, and **carry no grounding clause, marker, chip, tint or tooltip in v1**. Their
  bare `—` is a real pre-existing `absent-is-not-none` defect this feature neither creates nor worsens;
  it is booked as the named backlog item **`rec-absence-literals-hole`** (HARD class, first-instance
  evidence supplied by this council) so the cut is on the record rather than silent.
- **No score / tier / gate / fingerprint / SSE / bundle-shape change. No new endpoint, route or page.**
- **No new or changed durable client store** (`loss-free-durable-migration` is not engaged).

**Future (deliberately deferred)**

- Prose numeric extraction against a bounded vocabulary of named levels.
- A refusal policy, gated on a measured fabrication rate over N≥20 real recs.
- A grounding-rate history readout per model/persona (needs accumulation).
- The typed machine-readable size field, plus a data-sourced contract multiplier — which together (and
  only together) unlock a `Traced` arm for `max_risk`, whose shape is written down in §2 so a future
  cycle does not re-derive it.
- `rec-absence-literals-hole` — the four remaining bare-dash fields.

<!-- spire:council-resolution:v1 9b3f6144437c4a4e0474353455039c04898cde015fd31b8394d56888fe198fda folded -->
<!-- spire:council-resolution:v1 b168920b82a72cb827487dd81e6772a2a409f58610256a265c41eaa0244ef159 folded -->
<!-- spire:council-resolution:v1 50ea270ded74e5ddd12f99e3dda7b3e198076024e60d0764033a9a4bbbc493e4 folded -->
<!-- spire:council-resolution:v1 bb0ff559ba8585a2213ac5f99778f112591d8a5df5680cc413865161cb105065 folded -->

---

## 2. Architecture

### 2.1 One new pure leaf

`apps/api/src/services/rec_inputs/grounding.rs` — a sixth sibling in the existing leaf module, under the
same contract as the other five (`rec_inputs/mod.rs:1-3`, "Each submodule is a pure leaf"): no
`AppState`, no `crate::routes`, no `reqwest`, no `.await`, no `Instant`, no env read, no `Result`.

- Consumed by exactly one caller: `envelope_extras` (`recommendation.rs:438-507`), which grows from a
  3-tuple to a 4-tuple. `envelope_extras` is called from the `base` closure (`:617-652`), the **sole**
  envelope constructor on all six return paths, so the block is total across every branch by
  construction rather than by branch-specific code.
- `cited.rs`, `cap_check.rs`, `max_risk.rs`, `digest.rs`, `field_reasons.rs` are **read-only
  dependencies** of the resolver. `field_reasons.rs` keeps answering "the field is null — why?";
  grounding answers "the field is non-null — where did that number come from?". Two consumers, one
  `RecField` vocabulary, both exhaustive matches with no wildcard arm.

### 2.2 The state vocabulary is closed, server-folded, and authoritative

Per figure, a closed four-member state with a **fixed evaluation order, first match wins** — mirroring
`CapVerdict`'s `DO NOT REORDER` discipline (`cap_check.rs:15-18`):

| # | Member | Meaning |
|---|---|---|
| 1 | `not_applicable` | the field carries no value; presence-grounding does not apply |
| 2 | `not_checkable(reason)` | a value exists; the source we would resolve it against did not. **We do not know.** |
| 3 | `traced(basis)` | resolves to a number this app computed; the anchor is named **and valued** |
| 4 | `untraced` | the source was available and it resolves to nothing we computed. **We checked and there is nothing.** |

The four-member wire is load-bearing, not a rounding: collapsing member 2 into member 4 would stamp
"this number matches nothing we own" on a number **nobody could check** — the fabricated-claim failure
`absent-is-not-none` (HARD) exists to prevent.

`not_checkable` carries its own closed reason — a **new** enum, deliberately *not* an extension of
`field_reasons::MissingInput` (extending it would add members `field_reason` can never emit, leaving the
shipped FE lookup carrying dead arms):

`structurally_unchecked` · `no_named_level` · `no_cited_expiration` · `straddle_move_unavailable`.

`traced` carries a **basis discriminator with three members** — `exact`, `near`, `inside_range` — so the
client never picks a clause shape by inspecting which numbers are present. `exact` and `near` also carry
a closed `anchor_kind` and the anchor's own value; `inside_range` carries the cited expiration and both
range endpoints. (The architect's two-member `MatchBasis` is widened to three here: the server, not the
browser, decides equality-versus-inside-the-window, because UX's three literals otherwise force a
client-side comparison.) **Which field may emit which basis is a closed, pinned relation** — see §2.6
guard 9.

**Naming, settled:** the members are `Traced` / `Untraced`, **never** `Verified` / `Unverified`. No token
that can reach a human-readable artifact may read as `verified`, which in a trading context is read as
"Convexa vetted this trade".

The **serialized spelling of every token is fixed once, in `INTERFACE_CONTRACT.md`.** This spec never
restates it.

### 2.3 Per-field resolution rules — declared, one per field, no generic matcher

`grounding` is a `match` over `RecField` with **no wildcard arm**, so a sixth field cannot ship without a
rule (compile error). **Within each rule the branch order is itself fixed and first-match-wins**, with
the same `DO NOT REORDER` discipline as the two headline enums — the branches below are not mutually
exclusive (a rec with no cited expiration usually also has no tenor in the pruned move), so the order is
what keeps two implementations from disagreeing about which reason renders.

| Field | Rule (branches in evaluation order) |
|---|---|
| `ExitStop` | 1. every anchor absent ⇒ `not_checkable(no_named_level)`. 2. nearest named anchor within `max(0.01, anchor × GROUNDING_TOL_PCT/100)`: equality ⇒ `traced(exact)`, otherwise ⇒ `traced(near)`. 3. else ⇒ `untraced` |
| `InvalidationLevel` | identical rule, identical anchor set, identical order (D1) |
| `ExitTarget` | 1. no expiration cited ⇒ `not_checkable(no_cited_expiration)` — **evaluated first**, because without a tenor there is nothing to test containment against and the move's own availability is not the reader's problem. 2. move absent / state ≠ `Ok` / cited tenor not in the pruned move ⇒ `not_checkable(straddle_move_unavailable)`. 3. inside `[anchor_spot − move_dollars, anchor_spot + move_dollars]` ⇒ `traced(inside_range)`. 4. else ⇒ `untraced`. Containment carries **no tolerance at all** |
| `MaxRisk` | `not_applicable` (absent) / `not_checkable(structurally_unchecked)` (present, any parse outcome). **No `traced` arm, no `untraced` arm** |
| `PositionSize` | `not_applicable` / `not_checkable(structurally_unchecked)` |

**Why `MaxRisk` has no `traced` arm.** The cap-anchored rule is withdrawn entirely: a fabricated $480
against a $500 cap would render traced, and the cap is the owner's number, not one Convexa computed from
the chain. The quoted-cost leg cannot replace it in v1 either — `CandidateContract`
(`candidates.rs:91-108`) carries per-share `bid`/`ask`/`mid` and **no multiplier anywhere on this path**,
and reconciling a dollar figure against a per-share quote at any quantity other than one is size
inference by division, which is the deferral nobody reopened. `untraced` would itself be an overclaim,
because "we checked and found nothing" is false when there is no source to check against. The **shipped
`CapAnnotation` remains the single statement about that figure** — one fact, one statement.

**The deferred `traced` arm, written down so it is not re-derived:** `CitedState::Cited` **and**
`quote_presence == Quoted` **and** `ParsedRisk::Dollars(v)` **and**
`|v − ask × MULTIPLIER| ≤ max(0.01, cost × GROUNDING_TOL_PCT/100)` — unlocked by the typed size field
**plus** a data-sourced multiplier, not by either alone.

**The anchor set** (price-scale levels read off the **sent** `market_state`, `routes/market.rs:156-212`),
a closed id set, fixed order, nearest wins, ties broken by this order: `gex_spot`, `call_wall`,
`put_wall`, `peak_gex_strike`, `gamma_flip`, `max_pain`, `vwap`, `vwap_upper_2`, `vwap_upper_3`,
`vwap_lower_2`, `vwap_lower_3`. Its **display labels are a total closed lookup**, tabulated once in §4.

**The tolerance.** `pub const GROUNDING_TOL_PCT: f64 = 0.1;` declared in the grounding leaf beside its
rule, following `candidates.rs:11` (`BAND_PCT` — "Payload-stated constant, never a query knob —
deliberately, so it cannot erode"). Applied as `max(0.01, anchor × GROUNDING_TOL_PCT/100.0)`, emitted
**once per response** on the block, never per field, never as a query parameter, and applied **only** to
the named-level fields — never to containment.

**Binding rule, written down because it breaks silently and invisibly:** ground against what was
**SENT** — `pruned_move` (`recommendation.rs:582`), never `raw_move` (`:580`); the
`CandidateBudget::Prompt` set, never a `Handoff` one. A future refactor that grounds a target against
the unrestricted move marks it traced against a tenor whose contracts the model never received. The
envelope is anchored on `StraddleMove::anchor_spot` off the type, never `market_state.price`, because
`move_pct` is "Percent OF `anchor_spot`" (`straddle_move.rs:49-50`).

**The cited contract is derived, never duplicated.** `CitedState::Cited → traced`,
`RightUndetermined → not_checkable`, `OffSet → untraced`, `None → not_applicable`, with a test asserting
the mapping is total. It gets **no `RecField` variant and no second wire token**; it feeds the
card-level counts only, and `CitedContractLine` stays its one rendered surface.

### 2.4 The card-level token is server-folded; exactly one branch is client-selected

A closed six-member enum, fixed evaluation order, first match wins:

| # | Member | Emitted when |
|---|---|---|
| 1 | `not_applicable` | `strategy` is null, **or** `decision != "trade"`, **or** `checked == 0` |
| 2 | `local_rules` | the strategy came from `local_strategy_from_bundle` |
| 3 | `none_traced` | `checked ≥ 1`, `traced == 0`, `untraced ≥ 1` |
| 4 | `could_not_check` | `checked ≥ 1`, `traced == 0`, `untraced == 0` |
| 5 | `some_traced` | `traced ≥ 1` and `traced < checked` |
| 6 | `all_traced` | `checked ≥ 1` and `traced == checked` |

Plus **exactly one client-selected branch: the block is absent from the response.** That is a lookup on
*presence*, not a re-derivation from figures, so `digested-labels-not-raw-dump` holds. The browser never
counts, compares, or folds per-field tokens into a card verdict.

**`not_applicable` preempts `local_rules`, deliberately, and here is the case it covers.** The local
rule-based strategy sets its stop and its invalidation level from `gamma_flip`
(`recommendation.rs:780,783`). On a snapshot where `gamma_flip` is null those fields are null, so — if
the rec also cites no contract and states no target — `checked == 0` and member 1 fires: **the card
renders no grounding line at all**, not the calm `local_rules` caption. That is correct rather than a
collapse: `local_rules` says "*these figures* come from Convexa's own rules", and there are no figures
to say it about. Rendering it anyway would be the `nothing to check` member the council already
withdrew (a line announcing that there is nothing to announce). The order is settled at T9 and is not
reopened here; what changes in this pass is that the branch is **named, specified and tested** (AC-64)
rather than discovered, and that the live evidence arm's dependency on a non-null `gamma_flip` is stated
in §7.

**Four integers ride with the token** — `checked`, `traced`, `untraced`, `not_checkable` — computed
inside the same pure fold, with a test pinning `traced + untraced + not_checkable == checked`. Four cost
no more than two and let both the counted card line and the per-field clauses be written with zero
client-side arithmetic.

**The denominator, stated exactly:** `checked` = the fields whose member is neither `not_applicable` nor
`not_checkable(structurally_unchecked)`, **plus** the cited contract when its `CitedState` is not `None`.
On a full model rec that is 4 — stop, target, invalidation level, cited contract — so `max_risk` and
`position_size` can never inflate an honest rec into a permanent "2 of 5". `not_checkable` counts only
the *varying* reasons (plus the cited contract's `RightUndetermined`), which is what keeps the identity
in the paragraph above true.

**The provenance discriminator for `local_rules`** is member 2 above — **not** a separate wire field and
**not** surgery on `key_source` or `scenario`. The `local_only` env read (`recommendation.rs:673-675`) is
hoisted above the `base` closure; `base` derives the member; `grounding.rs` takes a plain `bool` and
stays a pure leaf.

### 2.5 The `max_risk` seam (folded in)

Measured `cap_check: not_checkable` on **4 of 4** after-arm trades at the V10 run, because the model
names two different dollar figures in one sentence and the parser correctly refuses to guess.

**The parser is not reopened. The prompt is what changes.** `build_rec_prompts` (`llm.rs:137-156`) gains
a single-figure directive: the risk field names **exactly one** dollar figure in `$N` form; a percentage
may appear only as the same dollar figure.

**The output widens; the acceptance does not.** `ParsedRisk { Dollars(f64), NotParseable(RiskRefusal) }`
with `RiskRefusal { NoText, NoDollarFigure, MultipleDifferentFigures }`, mapped against the existing
tests, which must all still pass unchanged: `None → NoText` (`:11`); `vals.len() == 0 → NoDollarFigure`
(covers `"1R defined-risk"` and the bare `"300"`); the trailing `_ =>` arm → `MultipleDifferentFigures`
(covers `"$300 to $500"`). **The accepted input set does not move by one input** — the poison test is
that changing any input's parse *outcome* reds the build. Widening a refusal's reporting is not
loosening the refusal.

The token rides the shipped `cap_check` surface beside `verdict`. It does **not** ride
`cap_not_derivable_reason`, which is null in exactly the state it would be asked to explain:
`effective_dollar_cap` (`auth/risk.rs:60-87`) sets that reason in the one arm that also sets
`value: None`, and a null cap short-circuits `cap_verdict` to `NoCap` at step 2, so `NotCheckable` at
step 3 can never coexist with a non-null reason. The two tokens answer different questions — why the
*owner* has no cap versus why the *model's* figure was unreadable — and neither may stand in for the
other.

### 2.6 Structural enforcement (poison it and the build goes red)

Nine guards. **Every ship-blocking structural criterion in §3 maps to one of them by name** — a criterion
whose enforcement is prose is exactly what `structural-over-prose-enforcement` forbids:

| Guard | Enforces | Criterion |
|---|---|---|
| 1 | exhaustive match, no wildcard | AC-49 |
| 2 | partition assertion | AC-51 |
| 3 | leaf-purity scan + anti-vacuity | AC-55 |
| 4 | pinned `structurally_unchecked` set | AC-52 |
| 5 | count identity | AC-53 |
| 6 | score identity, two-armed | AC-48 |
| 7 | no configurable fabricating source | AC-45 |
| 8 | **resolution-boundary pin** | **AC-50, AC-54** |
| 9 | **legal `(field, basis)` pairs** | **AC-61** |

1. **Exhaustive `match RecField`, no wildcard, no exemption** — a sixth stated number cannot ship without
   a rule.
2. **The partition assertion** — for every field on every branch, a `field_reason` exists **iff**
   grounding is `not_applicable` (exclusive-or). Poison arm: make one field emit both, or neither.
3. **Leaf-purity source scan** over `rec_inputs/*.rs` (no `crate::state`, `crate::routes`, `reqwest`,
   `.await`) with an anti-vacuity assertion, following the `outcome-ledger` `?raw` scan and the
   `broker-option-grouping` two-arm scan.
4. **The `structurally_unchecked` set is pinned** to exactly `PositionSize` + `MaxRisk`; marking a third
   field structurally-unchecked reds the build, so clause suppression cannot spread quietly into a field
   we simply stopped checking.
5. **`traced + untraced + not_checkable == checked`.**
6. **Score identity, two-armed** — (a) the shipped assertions in `apps/api/tests/score_identity.rs` run
   unchanged and green; **(b) the pin file's own diff is empty.** Arm (b) exists because arm (a) can be
   "fixed" by editing the golden constants instead of the code, which is the exact laundering the file's
   own comment warns about ("Do NOT 'update' these to make a change pass — a diff here IS the
   regression"). The build lane records `git diff --stat -- apps/api/tests/score_identity.rs` as empty in
   its receipt at GATE Q; a non-empty diff there is a regression to be explained, never a fix. Precedent:
   the empty-`apps/api`-diff guard shipped on `outcome-ledger`.
7. **A source scan asserting no configurable fabricating source** — `RecRequestBody::scenario_id` is
   still never read, and no provider selection reads an env flag other than `AI_REC_LOCAL_ONLY`.
8. **The resolution-boundary pin — the mechanism that makes a *weakened* rule build-breaking.** Guards
   1–7 catch a *missing* rule, a *leaked* dependency or a *moved* score; none of them catches a rule
   that still exists but has been loosened (a widened tolerance, a dropped cent floor, a containment
   window opened to the unpruned move). That is a table-driven fixture set asserted **through
   `envelope_extras`** — the real serialization path, not the leaf's internal function, so a sibling
   file that bypasses the leaf cannot stay green (the `score-lab-signal-comparison` failure shape). Its
   arms, per named-level field:
   - the asserted value **exactly on** the anchor ⇒ `traced/exact`;
   - **just inside** the window ⇒ `traced/near`;
   - **just outside** the window ⇒ `untraced`;
   - a **sub-$10 anchor** where the `max(0.01, …)` floor binds rather than the percentage;
   and for `ExitTarget`: exactly on `range_low` and on `range_high` ⇒ `traced/inside_range`; just outside
   either endpoint ⇒ `untraced`; and one arm where the **pruned and unpruned moves differ**, asserting
   the target is not traced against a tenor that was never sent.
   **The boundary points are written as literal numbers, never computed from `GROUNDING_TOL_PCT`.** That
   is the whole of the anti-laundering property: a fixture that derives its own edges from the constant
   moves with the constant and proves nothing. Poison arms, each of which must red: widen the constant;
   delete the cent floor; swap `pruned_move` for `raw_move`; replace any field's rule body with a
   constant `Traced`.
   **Non-vacuity, asserted in the test itself:** for each checked field the fixture set must contain at
   least one arm resolving `traced` **and** at least one resolving `untraced`; a set that has drifted to
   a single outcome fails on its own before it can certify anything.
9. **The legal `(field, basis)` pairs are pinned** — `exit_stop` and `invalidation_level` may emit only
   `exact` or `near`; `exit_target` may emit only `inside_range`; `max_risk` and `position_size` may emit
   no basis at all. All three share one wire enum, so a match-arm bug that returns another field's basis
   compiles cleanly and would otherwise surface only if a fixture happened to exercise that exact pair.
   Poison arm: make `exit_stop` return `inside_range` (or `exit_target` return `exact`) and the build
   reds.

**Failure modes + isolation**

- **There is no "grounding pass failed" state.** The resolver is pure, synchronous and total over
  `serde_json::Value` + `&CandidateSet`, with no `Result`. Unavailable inputs are expressed as
  `not_checkable` **on the affected field**, never as an omitted block, never as an HTTP error. The
  `best-effort-isolated-or-null` guarantee is delivered **structurally**, not by a runtime catch — and
  omitting the block on failure would itself be the `absent-is-not-none` collapse.
- **Block absence has exactly one production cause: a client talking to a pre-feature server** (a tab
  open across a deploy; on this repo push = deploy, so a stale tab is real). The local fallback and the
  stub provider both return through the `base` closure and therefore **do** carry the block.
- **`unavailable_envelope` (`recommendation.rs:706-727`) is a named known-uncovered branch.** It is
  reached only from the `build_bundle` failure at `:519-531`, is the one envelope not built by `base`,
  emits no `cap_check` / `field_reasons` / `cited_contract` today and will emit no grounding block. It
  renders **no rec body and no figures**, so there is nothing there to mislead about. This spec names it
  rather than discovering it, and does not claim to close it — the `CandidateSet` a block would need
  does not exist at that point in the function.
- **A local-rules rec with no checkable figure** (the `gamma_flip`-null case in §2.4) renders no
  grounding line at all — the `not_applicable` branch, tested at AC-64, never the amber
  *wasn't checked* line.
- **A settings-read failure** degrades the risk block to `not_set` with a `warn!`, unchanged.
- **Nothing here is live-derived.** No field appears on the SSE payload; a stream drop cannot change,
  dim or re-check a grounding state.

**Not buildable / rejected approaches**

- **A generic numeric matcher walking the strategy against an anchor catalogue** — needs a path walker
  *and* a per-path tolerance policy anyway, so it avoids none of the work, and a new field silently gets
  a default rule instead of a compile error. Rejected at exactly the point `structural-over-prose-enforcement` matters.
- **Asking the model to self-declare a source per number** — rejected on principle, not cost: a model
  that fabricates a strike fabricates the provenance tag beside it. Worthless as verification by
  construction, and it would make the app's claim false while looking green.
- **A runtime scripted fabricating provider behind an env flag** — refused by all three lanes. It is new
  backend scope plus a production-reachability guard, and the `none traced` line looks identical whether
  the liar was scripted or real, so the demo would not prove what it appears to prove.
- **`ScenarioLLMProvider` / `AI_REC_SCENARIOS_ENABLED` do not exist in this backend.**
  `recommendation.rs:358` hardcodes `"scenarios": { "enabled": false, "catalog": [] }`, `scenario_id`
  (`:803`) is deserialized and never read, and the FE picker (`AiRecPanel.tsx:275`) is dead code. The
  BRIEF's observation path (1) inherited that from the Python-era backlog entry; it is corrected here.
- **A second `max_risk` parser anywhere** — breaks the module's own rule ("the ONE parse of `max_risk`,
  for the ONE consumer") and would put a parse in the browser, which `digested-labels-not-raw-dump`
  forbids.
- **Re-grounding a standing rec against a fresher bundle** — a verdict is pinned to the snapshot it was
  produced from; a live re-check that silently upgrades `untraced` to `traced` as the market drifts into
  the number is the failure this rule prevents.
- **Reordering the card-level enum so `local_rules` preempts `not_applicable`** — settled at T9 and not
  reopened; see §2.4 for why the current order is the correct answer to the `gamma_flip`-null case.
- **Widening the rec export endpoint to carry the strategy or the system prompt** — ruled out at GATE Z
  (Z2): it is a new egress surface, it engages `egress-copy-tracks-payload`, and no product need in this
  feature asks for it. See §9 item 7.

<!-- spire:council-resolution:v1 89d126ee68099d0a76171c09ac2a964ce9d85397048d97413c75e6bc15194abb folded -->
<!-- spire:council-resolution:v1 9d5cd16741226655f53394b6f044c38fa27b96dc8be8fa504bb6f648011151b8 folded -->
<!-- spire:council-resolution:v1 ef593a54fa6cbd604639bc23929989ce2123986093acdc603fd076245420cae4 folded -->
<!-- spire:council-resolution:v1 3073fa48b8f969fa3ba56cf0f6e2d9e896d5b1ae7192a56632e7ab8715f6146e folded -->
<!-- spire:council-resolution:v1 0d8a059606b38bb1f3685ec05457af16b323c05c590c8fda2178022df3d049d0 folded -->
<!-- spire:council-resolution:v1 f7516c65c2bd8ff8f9cfc017a0288e5926fabf48c7f3ed6ce3c73de5e606e1e1 folded -->
<!-- spire:council-resolution:v1 5659086da16f69181514a6e8f59b045cc87d0c448349719c5aff0442505558bd folded -->

---

## 3. Acceptance criteria (with user stories)

Every row is observable without reading source. `test` = automated, chosen where a silent regression
under an unrelated change is plausible (an invariant, negative space, a literal collapsing into a
synonym, a value quietly dropped in a refactor, a derivation creeping back into the browser).
`review` = verified by inspection, chosen where the thing is visible and intentional and a human notices
it on a normal pass (wording, placement, chrome, a committed measurement artifact).
**(SB)** marks a ship-blocking row: its failure produces a wrong trade or a false claim.

**Stories.** S1 only Convexa's own numbers read as Convexa's · S2 I still see what the model said ·
S3 one glance at how grounded this read is · S4 fog and fabrication look different · S5 I know where the
checking stops · S6 a cap check that actually checks · S7 show me it works against a liar · S8 nothing
else moves.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 1 | S1 | On a produced **trade** rec, each of the exit stop, the exit target and the invalidation level that carries a value renders exactly one grounding clause, visible without hovering or expanding anything; a value with no clause and no covering surface renders nowhere. **(SB)** | test |
| 2 | S1 | Every traced clause carries the anchor's **name and its own value** — or, for a containment match, both range endpoints — so the reader sees the gap between the model's figure and Convexa's. A traced clause naming a source with no number renders nowhere. **(SB)** | test |
| 3 | S1 | The clause shape is selected by the wire `basis` token alone: the browser never picks between the level and range shapes by inspecting which numbers are present, and never compares two figures. **(SB)** | test |
| 4 | S1 | A containment match reads as containment in a named range for the cited expiration, and is a visibly different sentence from a level match. | review |
| 5 | S1 | No per-figure clause anywhere on the card or in the export artifact states a percentage or a tolerance. The tolerance appears exactly once, on the card's definition surface, as one number taken from the response. | review |
| 6 | S1 | The anchor name renders through a **total** lookup on the closed anchor token — all eleven members map to the label table in §4 — and an unrecognized token renders the level-class fallback, never a raw wire string and never a badge. | test |
| 7 | S1 | **Nothing untraced pre-fills, seeds, defaults or is arithmetically derived into any quantity, price or limit anywhere in the app.** In the simulated entry dialog specifically, the stop and target prefill is **gated on that figure's grounding state**: a `traced` figure seeds exactly as it does on `main`; an `untraced` or `not_checkable` figure does **not** seed the price field, and no other field, quantity or limit acquires a value derived from it. **(SB)** | test |
| 8 | S1 | A traced and an untraced value, both carrying figures, are distinguishable in a black-and-white screenshot without hovering — never by colour alone — and the untraced one carries `the AI's own number` in visible text. **(SB)** | review |
| 9 | S1 | A value's type register is set by its grounding state (Convexa-computed vs model-asserted), never by which field it is, and the register never carries a state on its own. | test |
| 10 | S1 | No user-facing string in the ai-rec module contains `verified`, `confirmed`, `validated`, `approved`, `safe`, `trusted`, `grounding`, `hallucinated`, `suspect` or `invalid`, and no check glyph renders anywhere on the surface. **(SB)** | test |
| 11 | S2 | A rec whose exit stop traces to nothing still shows the stop the model gave, in place and readable without expanding anything. | test |
| 12 | S2 | No numeric figure renders as an attributed quotation from the model. Verbatim quotation occurs only where the stated figure cannot be read as a number at all. | test |
| 13 | S2 | The rec is never withheld, blanked, greyed or disabled because a figure failed to resolve: the verdict, the reasoning, the levels section and the entry action render exactly as on a fully traced rec. **(SB)** | test |
| 14 | S2 | No grounding state adds or removes a copy, export or accept affordance anywhere on the card. | review |
| 15 | S3 | Exactly one card-level line renders on a produced trade verdict, chosen by closed lookup on the server token; it sits below the verdict hero and above the risk tile. | test |
| 16 | S3 | The counted line renders the integers supplied on the response. Poisoning a per-field token in a fixture changes no count and no card-level member — the browser never counts, compares or folds. **(SB)** | test |
| 17 | S3 | The count's denominator excludes the dollar risk figure and the suggested size; a rec stating all four checkable figures reads out of 4, never out of 5 or 6. | test |
| 18 | S3 | On a fully traced rec the affirmative card-level line still renders — the summary states the positive rather than appearing only when something is wrong. | test |
| 19 | S3 | On a `no_trade` verdict no card-level line, per-figure clause, marker or caveat renders anywhere on the card — with a cap set and with none — and the shipped `—` plus its not-applicable tip remains the card's only not-applicable statement. **(SB)** | test |
| 20 | S3 | On a rec produced by the local rule-based source, the card-level line states the figures are Convexa's own rules rather than a model's, in the quiet caption idiom with no warning colour and no warning icon; the *wasn't checked* statement does not appear, and the per-figure clauses render normally. | test |
| 21 | S3 | Live arm: with `AI_REC_LOCAL_ONLY=1`, a resolvable key (no network call, no vendor spend) and a non-null `gamma_flip` in the bundle, the exit stop renders traced and names the Convexa level it was set from, and the shipped cap line renders its own couldn't-check verdict — both visible in a browser without expanding anything. | review |
| 22 | S4 | Every card-level and per-figure grounding literal is distinct from every other one **and** from all four shipped absence literals (`—`, `not set`, `unavailable`, `not given`); no grounding literal contains the feature's internal name; *we looked and it is not there* and *we could not look* never render as the same string. **(SB)** | test |
| 23 | S4 | A *couldn't check* clause names which missing input blocked the check, by closed lookup, never composed client-side. | test |
| 24 | S4 | A field carrying no value renders its absence through the shipped closed absence-literal set and carries no grounding state, marker, chip or tint. This holds for the invalidation level, which moves onto that set as part of this feature. **(SB)** | test |
| 25 | S4 | No grounding state, marker, chip, tint, tooltip or clause renders on the structure, the strikes, the expiration or the entry trigger — so no grounding claim ever attaches to a field whose absence this feature leaves mis-stated. **(SB)** | test |
| 26 | S4 | The suggested size and the dollar risk figure carry no per-figure grounding clause, marker, chip or tint on any rec, and the exclusion is stated once on the definition surface. | test |
| 27 | S4 | When a response carries no grounding information at all, the card renders one card-level *wasn't checked* statement in place of every per-figure clause — never silence, never a traced member — and the rec, the ticker page, the bundle and the live stream are otherwise unaffected: no error page, no HTTP error, no blanked card. Observed from a stored response fixture with the block omitted. **(SB)** | test |
| 28 | S4 | A rec for which **every** reference input is missing still returns and renders in full: every figure in the checked set carries *couldn't check*, and the verdict, the reasoning, the levels section and the entry action render exactly as on a fully traced rec. **(SB)** | test |
| 29 | S4 | On the bundle-failure envelope (no rec body, no figures) no card-level line and no per-figure clause renders at all. | test |
| 30 | S4 | On an SSE drop no grounding clause dims, changes, disappears or flips to *couldn't check*; the grounding surface renders un-dimmed with no offline marker while live-derived tiles degrade. | test |
| 31 | S4 | Grounding states are pinned to the moment the rec was produced: a newer bundle or an SSE tick never changes, re-derives or upgrades a state, and editing the risk inputs afterwards shows the shipped superseded-inputs strip rather than a changed grounding state. | test |
| 32 | S4 | **No grounding wire token ever renders as user-visible text** — not `traced`, `untraced`, `not_checkable`, `local_rules`, a refusal token or an anchor id. Every surface that states a grounding fact states it through the closed literal set. *(Amended at GATE Z: the rec export endpoint carries no strategy and no grounding block, so there is no export artifact to check — §9 item 7.)* | test |
| 33 | S5 | One statement, placed with the reasoning and not with the fields, says that numbers inside the AI's written reasoning are not checked. | review |
| 34 | S5 | No number inside the reasoning text acquires a grounding state, marker, chip, tint, link or tooltip, and prose numbers are excluded from the counts. | test |
| 35 | S5 | The definition surface **claims coverage for exactly the figures this feature checks**: it names no figure as checked that the feature does not check, any figure it names as *not* checked is genuinely unchecked, and it states that traced is a source claim rather than a judgement that the trade is good. | review |
| 36 | S6 | The instruction sent for the risk figure requires a single dollar amount and **is present in the assembled system prompt**; deleting the directive **reds the build**. Both halves ship-blocking. *(Amended at GATE Z: the "visible on the export surface" half is withdrawn — no export surface carries the prompt.)* **(SB)** | test |
| 37 | S6 | With a risk figure readable as one dollar amount and an effective cap present, the cap surface shows *within* or *above* with both numbers — shipped behaviour unchanged, and `within` still renders in the shipped warning chrome, never as success or green. | test |
| 38 | S6 | With a risk figure naming two different dollar amounts, the cap surface still refuses to decide and names the ambiguity as the reason; nothing guesses, rounds, picks the larger, or reports a pass by default. **(SB)** | test |
| 39 | S6 | Every existing `max_risk` parse case still refuses or accepts exactly as it does on `main` — the accepted input set does not move by one input — and changing any input's parse outcome reds the build. **(SB)** | test |
| 40 | S6 | *The read gave no risk figure*, *no dollar amount could be read* and *the read named more than one dollar amount* render as three distinct sentences by closed lookup on the wire token; nothing renders off `cap_not_derivable_reason`, and exactly one statement on the card names that ambiguity. | test |
| 41 | S6 | A committed before/after artifact records ≥5 real recs across ≥3 tickers with per-run verdict, ticker, persona and timestamp, against the recorded before-arm of 0 of 4. No run is synthesized; with no provider key the measurement is recorded as **not-run** and the pre-committed ladder applies. | review |
| 42 | S7 | A hand-written fabricated rec — an exit stop far from every named anchor, a target outside the pruned move for the cited tenor, an invalidation level far from every anchor, a strike absent from the candidate set — fed through the recommendation's own serialization path against a fixed reference set resolves **every** one of those figures to a non-traced state, resolves **none** to traced, reports `checked = 4, traced = 0, untraced = 4`, and folds to the *none traced* card member. No key, no network, no env flag. **(SB)** | test |
| 43 | S7 | The honest counterpart through the same path: stop exactly on a named level, invalidation inside the window of another, target inside the pruned move, cited triple in the set ⇒ *all traced*, `traced = 4`; a one-field-off variant ⇒ *some traced*, `traced = 3, untraced = 1`. Without this arm the fabrication fixture proves only that the resolver says no. **(SB)** | test |
| 44 | S7 | Rendering that same fabricated rec from a stored response fixture, the card shows the *none traced* line and an authorship clause on **every** value-bearing checked figure, and no figure renders as a Convexa-computed value. **(SB)** | test |
| 45 | S7 | Fabrication is reachable only from stored fixtures: on a running server no request parameter, setting or on-screen control selects an alternate or scripted recommendation source, and the app's own configuration readout reports none available. | review |
| 46 | S7 | With a contract outside the candidate set, the shipped off-set literal renders and the grounding vocabulary adds **no second statement** about that same fact. | test |
| 47 | S7 | The traced / untraced / couldn't-check split is measured over ≥5 real recs across ≥3 tickers with all inputs available, the response ladder is written down **before** the split is seen, and the result is recorded in the committed artifact and in `OPEN_THREADS` whatever it says. **Explicitly not ship-blocking** (owner ruling D7, 2026-08-13). | review |
| 48 | S8 | `opportunity_score`, `opportunity_tier` and `state_fingerprint` are byte-identical with and without this feature on both bundle branches, **and the pin file's own diff is empty** — the build receipt records `git diff --stat -- apps/api/tests/score_identity.rs` as empty, so a green run cannot have been bought by editing the goldens. **(SB)** | test |
| 49 | S8 | Adding a stated number to the rec without a grounding member makes the build go red rather than merely being discouraged, with **no wildcard arm and no documented exemption**. **(SB)** | test |
| 50 | S8 | **Loosening a shipped resolution rule reds the build**: with the boundary fixtures of §2.6 guard 8 in place — whose edge values are literal numbers, never derived from the tolerance constant — widening `GROUNDING_TOL_PCT`, deleting the cent floor, opening the containment window to the unpruned move, or replacing any field's rule with a constant `Traced` each turn at least one arm red. The fixture set asserts its own non-vacuity: every checked field carries at least one traced arm **and** at least one untraced arm. **(SB)** | test |
| 51 | S8 | For every field on every return branch, an absence reason exists **iff** the grounding state is *not applicable* (exclusive-or); making one field emit both, or neither, reds the build. | test |
| 52 | S8 | Marking a third field structurally-unchecked reds the build — the suppressed-clause set is exactly the suggested size and the dollar risk figure. | test |
| 53 | S8 | The four counts satisfy `traced + untraced + not_checkable == checked` on every branch. | test |
| 54 | S8 | A fixture in which the pruned and unpruned moves differ shows the target **not** traced against a tenor whose contracts were not sent. | test |
| 55 | S8 | The grounding leaf imports no app state, no route module, no HTTP client and no async runtime; the scan proving it is anti-vacuity-asserted. | test |
| 56 | S8 | The AI cooldown and daily-cap counters advance for a rec request exactly as before, and no grounding outcome ever triggers a re-request to the model. | test |
| 57 | S8 | Entry from a rec remains simulated behind the existing confirm regardless of grounding state, and no grounding state enables or reaches any real order path. | review |
| 58 | S8 | The grounding surface uses no success/error palette slot and no green or red; only the unhappy card-level members carry `warning.*` plus an `aria-hidden` icon; every state is fully stated in visible text and none is carried only by tooltip, icon or colour. | test |
| 59 | S8 | Zero hardcoded hex; mode-aware values only through `extrasFor(theme)`; caption text ≥ 11px and amber caption text clears 4.5:1 in **both** modes. | test |
| 60 | S8 | At 393px, with the longest clause on every clause-bearing field, there is no horizontal overflow — the clause wraps on its own line under the value. | test |
| 61 | S8 | `exit_stop` and `invalidation_level` never emit a containment basis and `exit_target` never emits a level basis; the suggested size and the dollar risk figure emit no basis at all. Returning another field's basis reds the build. | test |
| 62 | S3 | **The line budget holds.** On a fully traced trade card this feature renders **exactly one** card-level line and **at most three** per-figure clauses — four added lines, never more — and adds **no** second statement about the cited contract or the cap. On `no_trade` it renders zero. Counted on the rendered card, not on the source. | test |
| 63 | S3 | At 393px on a fully traced trade card, the verdict and the risk tile are both reachable in the first screen — the grounding line does not push the primary read below the fold. | review |
| 64 | S3 | A local-rules rec whose checkable figures are all absent (the `gamma_flip`-null case) renders **no** card-level line and **no** per-figure clause — never the amber *wasn't checked* line, never a `local_rules` line with nothing to qualify. | test |
| 65 | S5 | **The definition surface reads as an allowlist**: from it alone a reader can determine which figures are checked, and no field outside that list carries any marker, tint, absence treatment or adjacency that could be read as a coverage claim. Reviewed on a trade card that omits the structure and the entry trigger, beside a stop and an invalidation level that both carry clauses. | review |
| 66 | S8 | **The live payload matches the contract.** One real `POST /api/recommendation/{ticker}` response is captured to a committed receipt at GATE Q and walked against the documented required-path list in `INTERFACE_CONTRACT.md` §1a: every path present, every type as documented, every closed token a declared member. With no resolvable provider key the check is recorded as **not-run** with that reason, and the named gap in §7 stands. | review |
| 67 | S1 | The suggested size and the dollar risk figure render their values exactly as they do on `main` — this feature changes no value, format or placement on either, it only withholds a clause. | review |
| 68 | S1 | **The withheld prefill explains itself.** In the simulated entry dialog, a price field the AC-7 gate withholds opens **empty with a one-line reason directly beneath it**, drawn from the closed literal set — never a silent blank. **Three arms carry three distinct reasons** — the figure was the AI's own, Convexa couldn't check it, and no check reached the browser at all (D8) — and **all three literals are distinct from one another and from every other member of the closed set**. A `traced` figure still seeds the field exactly as on `main`. **This is a behaviour change to a shipped surface** (`prefill.ts:53-54` → `TradeEntryDialogView.tsx:221-222` seed unconditionally today); it belongs to the frontend track. | test |

<!-- spire:council-resolution:v1 fb162dbbec73f7177472a9d9f71f483ad869a52e68871161dad591b41c40798b folded -->

---

## 4. UI + interaction

**Flows.** Unchanged information order with **one insertion**: verdict hero → **[new: one card-level
grounding line]** → risk tile → plan → cited contract → exit → sizing → context → reasoning. The line is
a qualifier on everything below it, so it sits directly above the risk tile and nowhere else. It is one
line; it is never a section. Per-figure clauses render directly beneath the value they qualify, on the
exit stop, the exit target and the invalidation level only.

**The untraced figure stays in its slot.** It renders **in place**, in the model-asserted type register,
with `the AI's own number` in visible text directly beneath it. The slot relocation (moving the figure
out into attributed text) is **withdrawn**: composed with the permanently-unchecked pair and an
unmeasured untraced rate, it would empty Convexa's value slots on an ordinary card and move the numbers
the trader must act on out of scannable position — the `tradeable-rec-inputs` Critical recurring by its
original mechanism. What survives from that position, unconditionally: an untraced value **never renders
identically to a traced one**, and **nothing untraced ever seeds, pre-fills, defaults or is
arithmetically derived into any quantity, price or limit anywhere, including the simulated entry
dialog** — which is a real behaviour change, specified below.

**"The model's voice" survives as copy and as type register, never as a mechanism.** No untraced numeric
figure renders inside quotation marks or as attributed speech: `exit_plan.stop` is a numeric schema
field, so `The AI said: stop 412` would fabricate a quotation the model never wrote and restate the
field label inside its own value. Verbatim quotation is reserved for the one honest class — a stated
figure the app cannot read as a number at all (the max-risk prose, `position_size`), where the model's
literal characters *are* the payload.

### The simulated entry dialog — a gated prefill, and a stated behaviour change

On `main` the shared entry dialog seeds its stop and target price fields **unconditionally** from the
rec (`prefill.ts:53-54` → `TradeEntryDialogView.tsx:221-222`, `setStop(prefill?.stop ?? '')`). D3 settled
the opposite rule without conditions and named this exact surface: nothing untraced ever seeds,
pre-fills, defaults or is derived into any quantity, price or limit, **including the simulated entry
dialog**. This is the one place in the app where an untraced number stops being a display and becomes an
**input**, so the seed is gated on the figure's state:

| Figure's grounding state | Entry dialog behaviour |
|---|---|
| `traced` | seeds the price field exactly as it does on `main` |
| `untraced` | field opens **empty**, with its one-line reason directly beneath it |
| `not_checkable` | field opens **empty**, with its one-line reason directly beneath it |
| **no grounding block on the response** (a pre-feature server) | field opens **empty**, with its own one-line reason directly beneath it. **A missing check is never a licence to pre-fill** — the absence of a block licences an *explanation*, never a seed (D8) |
| `not_applicable` (the rec stated no figure) | unchanged from `main` — there was nothing to seed |

A withheld field **never comes up silently**: an unexplained blank reads as a bug rather than a refusal,
and a user who shrugs and retypes the number off the card has been protected from nothing. **Three**
literals, members of the same closed set, deliberately echoing the card's own words so the reader
connects the two surfaces — and, in the third row, keeping the card's `couldn't check` versus
`wasn't checked` split intact rather than collapsing it at the one boundary where a number becomes an
input:

| Trigger | Literal (verbatim) | Chrome |
|---|---|---|
| `untraced` | `Not pre-filled — this was the AI's own number.` | caption · `text.secondary` · no icon |
| `not_checkable` | `Not pre-filled — Convexa couldn't check this figure.` | caption · `text.secondary` · no icon |
| block absent | `Not pre-filled — this read wasn't checked against Convexa's numbers.` | caption · `text.secondary` · no icon |

The third literal borrows the card-level member's exact words (`wasn't checked against Convexa's
numbers`) so the two surfaces name one fact the same way, and it is a distinct string from both the card
literal (which has no `Not pre-filled — ` stem) and from the other two prefill literals (whose tails say
something else entirely). Reusing the `not_checkable` literal there would have been the
`absent-is-not-none` collapse the card's own split exists to prevent: *we could not check this figure*
and *no check reached this browser at all* are different facts, and the dialog is the worst place in the
feature to blur them.

Mechanism, so the build lane does not have to ask:

- **No wire change.** The gate reads `grounding.fields.exit_stop.state` / `.exit_target.state` off the
  same response the prefill already consumes, and the third arm is the *absence* of that block — a
  presence check, not a new field. `INTERFACE_CONTRACT.md` is unchanged by this amendment.
- **`single-shared-sim-entry-dialog` holds.** This is an additive gate on the **one** shared
  `features/trading/TradeEntryDialog`, expressed through its existing prefill input — never a second
  dialog, never a fork, never a real-money variant.
- **`no-real-order-path` holds.** Simulated dialog, simulated entry, the existing confirm.
- **Owner-visible cost, stated rather than buried:** clicking *Act* on a rec whose stop did not trace
  brings that field up empty. That is a real change to daily use, taken because a fabricated stop
  arriving pre-filled in a trade ticket is precisely the harm this feature exists to prevent.

### The line budget — a bound, not an aspiration

A fully traced trade card carries at most **six** grounding-adjacent lines: the card-level line, three
per-figure clauses, and the two shipped surfaces this feature deliberately does **not** duplicate
(`CitedContractLine`, `CapAnnotation`). **This feature adds at most four of those six**, and that is the
committed bound, checked on the rendered card (AC-62), not a wording aspiration.

Why four is acceptable rather than merely disclosed:

- Two of the six already ship and stay exactly one statement each — the whole point of deriving the
  cited contract's grounding instead of duplicating it, and of refusing a second sentence about the risk
  figure.
- Three of the four added lines are quiet single captions attached to values the trader is **already
  reading** on his one-pass route (risk → stop/target), not new rows competing for the scan.
- The count only goes **down** on the unhappy paths: the structurally-unchecked pair is suppressed
  permanently (2 lines that would otherwise appear on every card forever), `no_trade` renders zero, and
  the block-absent card renders exactly one line in place of all clauses.
- The two things that would have pushed it past four were both cut: the named-levels row and the
  per-figure tolerance text.

AC-63 checks the consequence that actually matters — that the verdict and the risk tile stay in the
first screen at 393px — because a line budget with no reference to the primary read is just arithmetic.
The entry dialog's reason line is not on this card and does not enter this budget; it replaces a value
that is no longer there.

### Component states

| Component | default (produced · trade) | loading | empty / no rec | error / degraded | offline / stale |
|---|---|---|---|---|---|
| Card-level grounding line | exactly one closed member below the verdict hero and above the risk tile. On a **local-rules** source that member is the calm caption one — no warning colour, no icon, nothing is wrong on that card | nothing renders — a pending check never occupies the space a verdict will | `no_trade` ⇒ **nothing renders**; idle/byo-CTA/cooldown/cap/signed-out ⇒ no grounding surface (no rec body exists); a local-rules rec with no checkable figure ⇒ **nothing renders** | block absent ⇒ *wasn't checked* in warning chrome; every checked figure not-checkable ⇒ *couldn't check* in warning chrome. **These two are the only degraded members** | renders byte-identical and **static** — never dimmed, never `⏸ offline`, never re-derived; the shipped stale / stale-born / superseded strips remain the only things that say the read is old |
| Per-figure clause (stop · target · invalidation) | one clause under the value, `variant="caption"` / `text.secondary`, no icon, no chip, no border | nothing | none — a clause renders **only** on the `value` member of `fieldLiteral` | *couldn't check this* plus the named missing input | static, exactly as above |
| Entry dialog price field (stop · target) | `traced` ⇒ seeded as on `main`; `untraced` / `not_checkable` ⇒ empty plus that arm's one-line reason | unchanged | no figure stated ⇒ unchanged from `main` | no grounding block on the response ⇒ **not seeded**, with the block-absent reason line (its own literal, never the `not_checkable` one) — an unverified payload is never a licence to pre-fill | unchanged; the gate reads the rec's pinned state, never a live value |
| Suggested size · Max risk | **no clause, ever** — the exclusion is stated once on the definition surface; the values themselves render exactly as on `main` | nothing | nothing | the shipped `CapAnnotation` carries the risk figure's one statement, now with its refusal reason | unchanged |
| Structure · Strike(s) · Expiration · Entry trigger | render exactly as on `main` — **no clause, marker, chip, tint or tooltip** | unchanged | unchanged | unchanged | unchanged |
| Invalidation field value | renders through the shipped closed `fieldLiteral` set (no bare `—` fallback) | unchanged | `—` / `not set` / `unavailable` / `not given` per the closed set | unchanged | unchanged |
| Fabricated-rec fixture (the proof state) | card-level *none traced* + `the AI's own number` on every value-bearing checked figure | — | — | — | — |

### Copy — the closed literal set

Nothing renders that the wire does not name; nothing on the wire renders ambiguously. Every string below
is produced by a **closed lookup on a wire token** in `literals.ts`, never by testing a null and never by
comparing two figures in the browser. Token spellings are authoritative in `INTERFACE_CONTRACT.md`.

**Card level — exactly one, on a produced trade verdict only**

| Token | Literal (verbatim) | Chrome |
|---|---|---|
| `all_traced` | `Every checked figure traces to a Convexa number.` | caption · `text.secondary` · no icon |
| `some_traced` | `{traced} of {checked} checked figures trace to a Convexa number — each exception says so below.` | caption · `text.secondary` · no icon |
| `none_traced` | `No figure here traces to a Convexa number.` | `warning.main` + `WarningAmberIcon` |
| `could_not_check` | `Convexa couldn't check these figures this cycle.` | `warning.main` + icon |
| `local_rules` | `No AI read here — these figures come from Convexa's own rules.` | caption · `text.secondary` · no icon |
| `not_applicable` | *(nothing renders — `no_trade`, or nothing checkable was stated)* | — |
| *block absent* (the only client-selected branch) | `This read wasn't checked against Convexa's numbers.` | `warning.main` + icon |

The counted member is settled over the qualitative one: `Some figures here are the AI's own` collapses
one-of-four and three-of-four into the same sentence, and those are opposite advice at 09:32. The
integers come off the wire; the browser never counts. `couldn't check` (the check ran and could not
conclude) and `wasn't checked` (no check reached the browser) are distinct literals and never synonyms.
Neither trigger uses the word `grounding` or any shipped absence literal.

**Per figure — on the exit stop, the exit target and the invalidation level only**

| Token | Literal (verbatim) | Tooltip |
|---|---|---|
| `traced` · basis `exact` | `traces to Convexa's {anchor} ({value})` | *(none — both numbers are already visible)* |
| `traced` · basis `near` | `near Convexa's {anchor} ({value})` | *(none)* |
| `traced` · basis `inside_range` | `inside Convexa's implied move for {expiration} ({low}–{high})` | *(none)* |
| `untraced` | `the AI's own number` | `Convexa compared this against the levels and quotes it computed and didn't find it. That doesn't make it wrong — it means Convexa can't vouch for it.` |
| `not_checkable` (varying reason) | `couldn't check this` | `{missing-input clause}. The figure above is the AI's, unchanged.` |
| `not_checkable` · `structurally_unchecked` | *(nothing renders)* | — |
| `not_applicable` | *(nothing renders)* | — |

`traces to`, never `matches` or `equals`; and `near` where the figures differ inside the window, so the
verb never asserts an equality the server did not find. Both numbers are on screen, so the reader sees
the actual gap instead of inferring it from a percentage. `the AI's own number` is deliberately not
`unverified`: it is a statement of authorship, not an accusation, generalizing the shipped
`MAX_RISK_TIP`.

**Entry-dialog prefill — the three literals above, in the same closed set.** They are the only strings
in this feature that render outside the rec card, and they are checked for disjointness with every other
member (AC-68).

**`{anchor}` — the total label lookup over the closed anchor token**

Five of the eleven reuse the words the shipped `Levels in play` strip already prints
(`reasoning.tsx:107-113`), so the reader meets the same name in both places; the other six are new
strings in the same lowercase in-sentence register and are reviewed with every other literal (AC-6).

| Token | Label | Note |
|---|---|---|
| `gex_spot` | `levels spot` | **not** `spot` — the levels anchor is not the live display price, and the card must not blur them |
| `call_wall` | `call wall` | shipped word |
| `put_wall` | `put wall` | shipped word |
| `peak_gex_strike` | `peak gamma strike` | new |
| `gamma_flip` | `gamma flip` | shipped word |
| `max_pain` | `max pain` | shipped word |
| `vwap` | `VWAP` | shipped word |
| `vwap_upper_2` | `VWAP +2σ` | new; matches the canon's own `± 2σ/3σ` notation |
| `vwap_upper_3` | `VWAP +3σ` | new |
| `vwap_lower_2` | `VWAP −2σ` | new |
| `vwap_lower_3` | `VWAP −3σ` | new |
| *(unrecognized)* | `a Convexa level` | the fallback arm — `traces to a Convexa level ({value})` / `near a Convexa level ({value})`: honest, still carries the number, never a badge and never a raw wire string |

**Missing-input clauses** (closed lookup on the not-checkable reason; three members are emittable in v1,
and the lookup carries no arm for a state the server cannot produce):

| Reason token | Clause |
|---|---|
| `no_named_level` | `Convexa had no named levels for this snapshot` |
| `straddle_move_unavailable` | `Convexa had no implied move for that expiration` |
| `no_cited_expiration` | `The read didn't name an expiration to measure against` |

**The definition tooltip — on the card-level line, once**

> `Traced` means the figure lines up with a number Convexa computed from the option chain — not a
> judgement that the trade is good. Convexa checks the stop, the target and the invalidation level. It
> doesn't check the suggested size; the contract named and your risk cap each have their own line.
> `Near` means the figure sits inside Convexa's match window for that level ({tolerance}% of the level,
> never less than a cent). The implied-move range is measured from the snapshot's spot at that
> expiration.

**This paragraph is an allowlist, and the allowlist is the halo mitigation.** A reader who sees specific
grounding language on the stop, the target and the invalidation level could otherwise generalize
"no marker here means this one was checked" onto the four fields this feature deliberately leaves alone
— which is the deeper half of UX's "grounding a lie" objection, and the risk D6's cut has to be safe
against. Two things carry it: the sentence above tells the reader *what is checked* rather than leaving
him to infer it from which fields carry clauses, and **no field outside that list gains any marker,
tint, tooltip or absence treatment** (AC-25), so there is no second signal to generalize from. AC-65
reviews the composition on a card that actually omits the structure and the entry trigger. This is
mitigation by copy and by absence, reviewed rather than measured against a real reader — the residual is
booked honestly in §9.

The tolerance number is read off the payload and never composed client-side; if the constant is absent
from the response the parenthesis is omitted entirely and nothing is hardcoded. Note for AC-35: naming
the suggested size **as not checked** is the point of that clause — the sentence UX withdrew was the R1
one that named it as *checked*. AC-35 forbids claiming coverage the feature lacks, never forbids
disclaiming it.

**The cap surface** (shipped `CapAnnotation`, unchanged except for the reason sentence appended to
`CAP_COULD_NOT_CHECK`; the three sentences describe *Convexa's reading*, never the model's intent):

| Refusal token | Rendered line |
|---|---|
| `no_text` | `Couldn't check against your cap. The read gave no risk figure.` |
| `no_dollar_figure` | `Couldn't check against your cap. Convexa couldn't read a dollar amount in the risk figure.` |
| `multiple_different_figures` | `Couldn't check against your cap. The read named more than one dollar amount.` |
| absent / unrecognized | `Couldn't check against your cap.` (the shipped literal alone — never a guess) |

`within` and `above` keep the shipped warning chrome. `within` must not quietly become a green tick the
day the prompt fix makes it common.

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (**Status: SET** — The Curvature
Terminal). This spec adheres to that canon and does not restate its token table.

**Design direction.** One new small component (`GroundingNote`) built on the shipped `CapAnnotation`
shape, plus additions to `copy.ts` / `literals.ts`. **No new colour, token, motion family or component
family**; `warning.*` plus icon per the canon's chrome rule; `extrasFor(theme)` for anything mode-aware;
zero hex. Asymmetry plus a single loud point: the card-level line is the only element that may carry
warning chrome, and only in its unhappy members; per-figure clauses are always quiet captions with no
icon, because untraced figures may be common and four warning icons per card become wallpaper inside a
week — which makes the honest marker *less* honest. **No green, no check glyph, no success slot,
including on the traced state** — canon reserves green/red for signed direction, and `CapAnnotation`
already establishes that even `within` renders through warning chrome. The entry dialog's reason line
reuses the same caption idiom and adds no chrome of its own.

**One rule extends the canon and therefore belongs in the canon's Amendments log, not here:** the **type
register as provenance** — the Convexa-computed register for figures the app computed, the body register
for figures the model asserted — promoted from optional to REQUIRED because it is the only mechanism on
the table that separates the two at a glance and in a black-and-white screenshot without spending
warning chrome. Binding condition: **the register never carries the state alone** — the clause is always
in visible text, so the distinction survives a screen reader, a monochrome screenshot and a coarse
pointer. The Amendment entry is appended to `DESIGN_SYSTEM.md` after the owner's ruling; it is not a
second design system invented in this section (see §9).

**Accessibility (binding).** Every state is fully stated in visible text; no state is carried only by a
tooltip, an icon or a colour (tooltips are unreachable on touch and this is a mobile-capable surface).
The warning icon is `aria-hidden` and the clause sits in the field's DOM order so it is announced with
its label — including the entry dialog's reason line, which is associated with its field rather than
floating beside it. Caption text ≥ 11px; amber caption text clears 4.5:1 in both modes, fixed via
`extrasFor(theme)` and never a hardcoded value. At 393px the clause wraps under its value.

**Density, named as the largest cost.** After this feature the card carries the stale-born strip, the
stale strip, the superseded strip, provenance chips, `Levels in play`, `What the numbers said`, the
freshness line, the cap annotation, the cited-contract line, four field literals — and now one grounding
line plus up to three clauses. The line budget above is the committed bound, AC-62 and AC-63 are its
checks, and the restraint is why the named-levels row does not ship and why the structurally-constant
clauses are suppressed.

<!-- spire:council-resolution:v1 803047bf234fc13e41eeb208761686ac031e6cbc581eda0e2153c8943d9cd5c7 folded -->
<!-- spire:council-resolution:v1 ee68410ce24e9c2eb4c18acf9a859bb6cfcec69d7bc518686ea7e6ed7ac9ba3f folded -->
<!-- spire:council-resolution:v1 a0a1136bbbc174e2fc92ebaee9b5ba8eec93b4c4585c38947282311d215c239e folded -->
<!-- spire:council-resolution:v1 c94a23bebee592aaa5cc1944e28800899ed747ff017c5380d87dffc55dd453b8 folded -->
<!-- spire:council-resolution:v1 35c04139650536bf536d2c0bd895ca7df6171d1dd490cacfc59999a871f8ef76 folded -->
<!-- spire:council-resolution:v1 f12477302e12aca98f0362dfff3fe2b5066211f34ab10ce1fb40d42a38e4fddf folded -->
<!-- spire:council-resolution:v1 092c2e0801249de0233c5db657a4f87ae8a022988b9fe96db4b4664cd5e6971b folded -->
<!-- spire:council-resolution:v1 6c78751c3b9859278efd70d0c512cc85d1d658337f99fecdd8b9968c0e62e4f9 folded -->
<!-- spire:council-resolution:v1 485199f38062ddcd99a20332b520e222f5884875ac4c5a187a73c57ccf48e75b folded -->
<!-- spire:council-resolution:v1 4a61dda348ebc048e02b3786c65e90f7070f4db18989b7acc4c5c46f65f2a96f folded -->
<!-- spire:council-resolution:v1 fe93aa2559b235df830cb5c665ff2686ce311c446cac58595a8d0bdd5a5e93b8 folded -->

---

## 5. Error handling

| Failure class | What the user sees | What is logged / retried |
|---|---|---|
| A reference input is unavailable this cycle (no named level, no cited expiration, no implied move for the cited tenor) | the affected figure alone reads `couldn't check this` plus the named missing input; every other figure resolves normally; if that is the whole checked set, the card-level line reads `Convexa couldn't check these figures this cycle.` | nothing new; no retry, no re-request to the model |
| **The check "fails"** | **Not a reachable state.** The resolver is pure, synchronous and total with no `Result`, so there is no failure mode to render. Unavailable inputs are expressed as `couldn't check` on the affected field, never as an omitted block, never as an HTTP error, never as a missing member | — |
| The response carries no grounding block (a browser talking to a pre-feature server across a deploy) | one card-level `This read wasn't checked against Convexa's numbers.` in place of every per-figure clause; no figure renders as a Convexa value; verdict, reasoning, levels and the entry action render normally. **The entry dialog treats every figure as not-seeded**, with the block-absent reason line — a payload with no grounding is never a licence to pre-fill | nothing; the state is client-selected on block **presence**, never re-derived from figures |
| Bundle failure (`unavailable_envelope`) | the shipped unavailable card: no rec body, no figures, and therefore no grounding surface at all | unchanged; **named known-uncovered branch** — this feature attaches no block there and does not claim to close it |
| A local-rules rec with no checkable figure (`gamma_flip` null, no cited contract, no target) | **no grounding line and no clause at all** — the `not_applicable` branch. Never the amber *wasn't checked* line, and never the calm local-rules line with no figures to qualify | nothing; the live evidence arm requires a non-null `gamma_flip` (§7) |
| The model's risk prose is unreadable | the shipped cap line refuses and names *which* reading failed (no risk figure / no dollar amount / more than one amount); nothing guesses, rounds, picks the larger or passes by default | unchanged |
| A settings read fails | the risk block degrades to `not_set`; the rec still returns | `warn!` as shipped |
| SSE drop / stale bundle | grounding renders byte-identical and static; the shipped stale, stale-born and superseded strips are the only surfaces that say the read is old | nothing; a verdict never silently re-resolves against a newer level |
| Provider error, cooldown, daily cap, no key, signed-out | the shipped states, unchanged; no rec body means no grounding surface | unchanged; cooldown and cap counters advance exactly as before |

**Isolation, restated as a rule:** a grounding outcome degrades the rec surface alone. It never produces
an HTTP error, never touches `market_state` / `strike_profile` / the bundle / the SSE path, never
withholds or blanks a card, and never triggers a re-request to the model. The one place a grounding
outcome changes an input rather than a display is the entry-dialog prefill gate (§4), which is stated as
a behaviour change rather than folded into "unchanged".

<!-- spire:council-resolution:v1 ae3c8c4ad2a53871d251974a00597ef443ac1c78133e2de5501e93abd743d4df folded -->

---

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/ai-rec-grounding/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** this feature **extends the backend additively**. It adds one
`grounding` object to the `POST /api/recommendation/{ticker}` response envelope (built by the same
`base` closure that already emits `cap_check` / `field_reasons` / `cited_contract`), one
`risk_refusal` token beside `cap_check.verdict`, and one `invalidation_level` key on `field_reasons`.
No new endpoint, no request-body change, no bundle or SSE change — and **no wire change from the GATE Z
amendment**: the entry-dialog prefill gate reads states already on that envelope. That POST endpoint
sits outside the machine-checkable conformance block (it needs a body, a key, and it spends the daily
cap); §1a of the interface file carries its required-path list explicitly so the payload can be walked
against a captured response at GATE Q (AC-66), and §7 below names what is left uncovered when no key
exists. The authoritative field list, the token spellings and their evaluation orders live in that file
and nowhere else — this spec references the interface, it never restates it.

---

## 7. Testing strategy

Risk-based, not one-test-per-criterion. Automate the invariants, the negative space and the things that
regress silently; review the visible and intentional.

**The evidence path — every arm exists in this tree.** The BRIEF's observation path (1) named a scripted
hallucinating provider that is Python-era and absent from the Rust backend; it is replaced, not
weakened.

1. **Server fabrication fixture (ship-blocking).** In the existing `#[cfg(test)] mod tests` at
   `recommendation.rs:839` — `use super::*`, so the private `envelope_extras` is in scope, and it already
   returns `serde_json::Value`s built over the typed enums, so asserting on its return value **is**
   asserting on the real serialization path. No new test binary, no `pub` widening. Hermetic inputs
   follow the `cited.rs:96-110` pattern: a two-contract chain into a `CandidateBudget::Prompt`
   `CandidateSet`, a hand-written one-tenor `StraddleMove`, a hand-written `strategy: Value`. Four
   fabricated arms in one fixture (AC-42).
2. **Honest counterpart fixture in the same module (ship-blocking)** — all-traced and one-field-off
   variants (AC-43). Without it the fabrication fixture proves only that the resolver says no.
3. **The boundary fixture set (ship-blocking, §2.6 guard 8)** — the arms that make a *loosened* rule
   red rather than only a *removed* one, asserted through the same `envelope_extras` path, with literal
   edge values and a self-asserted non-vacuity check (AC-50, AC-54, AC-61).
4. **Frontend payload fixtures** — a hand-written response fixture in the dashboard's ai-rec spec for
   the fabricated render, one with the block omitted, one with every reference input missing, one
   local-rules card, and one local-rules card with nothing checkable. No backend, no flag, no network.
   The entry-dialog gate is driven from the same fixtures: a traced-stop payload seeds, an
   untraced-stop payload opens empty with its reason line, a block-absent payload does not seed and
   carries its own third literal (AC-7, AC-68).
5. **Live browser arm (not ship-blocking)** — `AI_REC_LOCAL_ONLY=1`, which routes to
   `local_strategy_from_bundle` and already emits `exit_plan.stop` and `invalidation_level` on
   `gamma_flip`. **Correction carried from R3: this arm is not key-free.** `recommendation.rs:655`
   returns the unavailable envelope when `!resolved.usable()`, and that check runs *before* the
   `local_only` read, so the arm needs the feature flag plus a resolvable key. **No network call is
   made and no vendor spend is incurred** — the provider branch is not taken. It also requires
   `gamma_flip` to be non-null in the bundle; on a null-`gamma_flip` snapshot the local card has nothing
   checkable and renders no grounding line at all (§2.4), so that arm must be run on a snapshot where
   the flip resolved.
6. **A renderable `couldn't check this` is reachable only from fixtures in v1** — a real narrowing of
   the live demo, recorded here rather than discovered at GATE Q, and a direct consequence of suppressing
   the clause on the structurally-unchecked pair.

**How the live payload is verified at GATE Q, and what is not.** The conformance runner cannot exercise
`POST /api/recommendation/{ticker}`: it has no request-body support, the endpoint needs a resolvable
provider key, and a run would spend the AI daily cap. So the feature's own payload is verified in three
layers, and the residue is named rather than implied:

- **Layer 1 (ship-blocking, always available):** arms 1–3 above assert the serialized shape through
  `envelope_extras`, the function that actually builds the JSON. This catches every shape, token and
  totality claim in the contract, with no key and no network.
- **Layer 2 (review, key-gated):** AC-66 — one real response captured to a committed receipt at GATE Q
  and walked against the required-path list in `INTERFACE_CONTRACT.md` §1a. This is the only layer that
  observes the actual HTTP round trip, including the router, serde attribute drift and any middleware.
- **Layer 3 (always available):** the runner block in the interface file covers the two anonymous GET
  endpoints this feature depends on but does not change — the anchor set and the configuration readout.
- **The named gap:** with **no resolvable provider key**, layer 2 cannot run. In that case nothing
  observes the live HTTP body, only the in-process serialization; the receipt records the check as
  **not-run with that reason**, and the gap stands as a stated limit rather than a silent pass. It is
  not closed by asserting the same carve-out a previous feature used.

**Automated (`test`).** The nine structural guards of §2.6, each with its poison arm — the exhaustive
match, the partition assertion, the leaf-purity scan with anti-vacuity, the pinned
structurally-unchecked set, the count identity, the two-armed score-identity guard (assertions green
**and** the pin file's diff empty), the no-configurable-fabricator scan, the resolution-boundary pin,
and the legal `(field, basis)` pin. The `max_risk` parse-outcome pin (the accepted input set does not
move) and the prompt-directive source scan with its poison arm (AC-36). The FE closed-lookup tests
(literal disjointness, the eleven-member anchor label lookup plus its fallback, basis-driven clause
selection, no client comparison, suppression rules, block-absent branch, the line-budget count, the
entry-dialog prefill gate and its three reason lines). The banned-word and check-glyph source scan,
mutation-tested. The hex-discipline and contrast suites. The 393px no-overflow e2e.

**Reviewed (`review`).** Verbatim copy of every card-level, per-figure, anchor-label and entry-dialog
literal, the definition tooltip and its allowlist reading, the containment sentence shape, the
tolerance-stated-once placement, the quiet chrome of the local-rules member, the placement of the
prose-exclusion statement, the above-the-fold check, the halo composition on a card that omits fields,
the live browser arm, the captured-response walk, the configuration readout, and both measurement
artifacts.

**FE test tiers.** Unit for `literals.ts` selectors (pure, no React); component for the card-level line,
the per-figure clause, the line-budget count and the entry dialog's gated prefill; integration only at
the network boundary — the payload fixture is the mock, never a mocked selector or a mocked lookup.

**Two measurements, both laddered, both recorded whatever they say.**

- *The `max_risk` prompt fix.* Deterministic half is ship-blocking (AC-36, AC-38, AC-39). Measured half
  is laddered against the recorded before-arm of 0 of 4 (AC-41).
- *The untraced rate.* **Demoted from a ship gate to a recorded laddered measurement by owner ruling
  (D7, 2026-08-13)**, for a stated reason: the untraced rate is an unmeasured property of the **model**,
  not of this design, so a ship gate on it makes two of the three available responses damaging — widen
  the tolerance until misses disappear (laundering), or cut fields until the denominator is small. Only
  tightening the prompt is honest. **The ladder, pre-committed before the split is seen:** a high
  no-match rate ⇒ **one** prompt revision ("quote the level exactly as the context gives it") and
  **one** re-run ⇒ still high ⇒ **ship with the honest rate recorded** in the committed artifact and in
  `OPEN_THREADS`, with the card-level line carrying the claim while the per-field clause stays quiet.
  **Never a tolerance widening, never a scope cut to flatter the number, never a synthesized run.** A
  measurement that cannot run records its unavailability as a finding — the `tradeable-rec-inputs` V10
  precedent. **AC-42 and AC-50 remain ship-blocking**: they are properties of the design and inside the
  lane's control, which is exactly why they keep the gate the noise bar gave up. AC-50's boundary
  fixtures are also what make the "never a tolerance widening" half of that ladder enforceable rather
  than promised — widening the constant reds the build.

<!-- spire:council-resolution:v1 7b75ac938194cb0ee23c7c0f5dc3771e1538e4e0cf8c2fd21b466365d2d5c7a4 folded -->
<!-- spire:council-resolution:v1 688d868761114a7cb0fc232bcec8fde45fae1877e24a61101001d831ad394077 folded -->
<!-- spire:council-resolution:v1 ba138d4dd76736a0d0c996190cbecdbf576e686ec961fddb0424e37caab3d339 folded -->
<!-- spire:council-resolution:v1 319f77feaf3e4e7f6c43d684493c4bd2b0432ac5d03579957457308dbe3d2cad folded -->

---

## 8. Guardrails this feature must not break

- **`ai-asserted-numbers-are-traceable`** — its **first instance**. The key sits on the watch list at 0
  instances, deliberately unpromoted as aspirational; it promotes on ship, on evidence. The evidence is
  AC-42/43/44/50 plus the structural guards, not the prose in this file.
- **`absent-is-not-none` (HARD)** — traced / untraced / couldn't-check / not-applicable is a
  **four-state on the wire**, never a boolean, and the distinction survives to the client render: a
  number nobody could check must never read as a number we checked and passed. Enforced in the closed
  vocabulary, not in prose. The same rule is why the block is never omitted on failure, why
  `Invalidation` moves onto the shipped absence-literal set before any clause attaches to it, and why a
  withheld prefill states its reason instead of coming up blank.
- **`structural-over-prose-enforcement`** — poison the guard and the build goes red, and the poison test
  is proven non-vacuous. **Nine named guards in §2.6, each mapped to the criterion it enforces**; the
  exhaustive `match RecField` ships with no wildcard arm and no documented exemption, which is precisely
  why `InvalidationLevel` is in v1.
- **`digested-labels-not-raw-dump`** — the wire token is authoritative; the FE renders through a closed
  lookup and **never** re-derives a state, a count, a clause shape or an anchor label from the raw
  figures. Every closed set has a total client lookup, including the eleven-member anchor set and its
  fallback arm. Exactly one branch is client-selected, and it is a lookup on block **presence**.
- **`additive-keeps-score-byte-identical` (HARD)** — the entry gate, `opportunity_score`,
  `opportunity_tier` and `state_fingerprint` stay byte-identical on both bundle branches; the rec is a
  one-way leaf and nothing in `quant_engine` or `signals` imports `rec_inputs`. Enforced two-armed: the
  shipped `score_identity.rs` assertions green **and** that file's own diff empty in the build receipt,
  because a green run bought by editing the goldens is the failure the file's own comment warns about.
- **`best-effort-isolated-or-null`** — a check outcome degrades the rec surface alone: never an HTTP
  error, never the bundle, never SSE. Delivered structurally (a pure total function cannot throw) rather
  than by a runtime catch, and reconciled with `absent-is-not-none` by never omitting the block.
- **`model-read-carries-its-assumptions`** — a level match is a model-dependent read, so the response
  carries its own threshold (the payload-stated tolerance constant) and its own basis (the anchor's
  identity and value, or the range and the tenor it belongs to). Traced is a **provenance claim, never a
  correctness claim**: it means the number resolves to something we computed, never that the level will
  hold or that the trade is good.
- **`no-real-order-path`** — sizing and risk context only. No grounding state enables, gates or reaches
  a broker or order path; entry stays simulated behind the existing confirm. The prefill gate withholds
  a *value* inside the simulated dialog; it touches no execution path.
- **`single-shared-sim-entry-dialog`** — **this feature changes that dialog's behaviour** (the gated
  prefill, §4) and does so the only permitted way: an additive gate on the **one** shared
  `features/trading/TradeEntryDialog`, through its existing prefill input. No second dialog, no fork, no
  mode that blurs the simulated/real boundary. A later session reading this line should know the dialog
  is no longer untouched by this feature.
- **`theme-token-discipline`** — the new treatment binds to the MUI theme / `tokens.ts` through
  `extrasFor(theme)` inside sx callbacks, carries zero hardcoded hex, and dark/light parity is part of
  done.
- **`live-vs-static-isolation`** — grounding is declared **static** (chain-snapshot derived, pinned to
  the rec's snapshot). Nothing on this dimension appears on the SSE payload, and the surface does not
  inherit the degrade of the live-derived tiles beside it.
- **`egress-copy-tracks-payload`** — not engaged, deliberately: this feature adds nothing to any egress
  surface. The export endpoint is unchanged, which is exactly why the two criteria that assumed an
  export artifact were corrected rather than satisfied by widening it (§9 item 7).
- **`single-motion-moment`** — untouched: no animation family is added.

---

## 9. Open questions

1. **`GROUNDING_TOL_PCT = 0.1` is pre-registered, not measured.** It is the one number in this design
   nobody has validated. The boundary fixtures (§2.6 guard 8) make widening the constant
   build-breaking, so a quiet widening at GATE Q now requires deliberately editing literal fixture
   values. Whether `0.1` is the *right* number remains unmeasured, and the D7 ladder governs the answer.
2. **Whether any rec response is cached or persisted across a deploy is unverified.** If one is, a stored
   pre-feature response would render `wasn't checked` on a card that shows figures — the only production
   path where that member is both reachable and load-bearing. Flagged, not claimed either way.
3. **The DESIGN_SYSTEM Amendment for the type register (mono = Convexa computed · body = model asserted)
   needs the owner's ruling and append.** The feature ships the split as REQUIRED (AC-9), but the canon
   entry is a human-ruled Amendment, not something this spec may declare; until it is appended, the
   register rule lives only here.
4. **The hoist of the `local_only` env read above the `base` closure was read in the tree but not run.**
   It is a pure env read with no side effect, so the risk is low — but the `local_rules` card member and
   the live evidence arm both depend on it. The one concrete failure mode it interacts with is now
   specified rather than open: on a null-`gamma_flip` snapshot the local card has nothing checkable, so
   `not_applicable` preempts `local_rules` and no line renders (§2.4, AC-64). What remains open is only
   whether the hoist itself behaves as read.
5. **The halo risk is mitigated by copy and by absence, and reviewed — not measured against a real
   reader.** A trader who sees clauses on three fields may still generalize "no clause means checked"
   onto the four fields left bare. The allowlist tooltip and the total absence of any marker on those
   fields are the mitigation (AC-25, AC-65); the residual is the honest cost of D6's cut and rides with
   `rec-absence-literals-hole`. If the backlog item ships, this question closes with it.
6. **With no provider key at GATE Q, nothing observes the live HTTP body of the endpoint that carries
   this feature's payload** — only the in-process serialization path (§7, layer 2 versus the named gap).
   The conformance runner cannot cover a POST with a body that spends the AI daily cap, so this is a
   stated limit of the harness rather than a design choice, and AC-66 records it as not-run rather than
   passing it silently.
7. **No export surface carries the strategy, the grounding states or the system prompt — so none of
   them is externally observable off a saved artifact.** `GET /api/recommendation/export/{ticker}`
   carries context only (`persona_prompt` is assembled at `recommendation.rs:332-339` and is not the
   rec's system prompt), and the FE `HandoffDialog` was deleted at `convexa-redesign` GATE V. GATE Z
   ruled that widening the export is out of scope — it would open a new egress surface and engage
   `egress-copy-tracks-payload` for no stated product need. **The consequence, stated rather than
   hidden:** the prompt directive is observable only in the assembled prompt (AC-36, ship-blocking), the
   grounding states are observable only on the card and in the payload, and AC-5's export half is
   vacuously true because no artifact carries a clause at all. If an export-visible check is ever
   genuinely wanted, it is a scoped follow-on that must amend every shipped egress claim in the same
   change, not a criterion bolted onto this one.

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"source":"R2-architect.md","index":0,"conflict_id":"7b75ac938194cb0ee23c7c0f5dc3771e1538e4e0cf8c2fd21b466365d2d5c7a4","disposition":"folded","section":"§7"},{"source":"R2-architect.md","index":1,"conflict_id":"688d868761114a7cb0fc232bcec8fde45fae1877e24a61101001d831ad394077","disposition":"folded","section":"§7"},{"source":"R2-architect.md","index":2,"conflict_id":"89d126ee68099d0a76171c09ac2a964ce9d85397048d97413c75e6bc15194abb","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":3,"conflict_id":"9b3f6144437c4a4e0474353455039c04898cde015fd31b8394d56888fe198fda","disposition":"folded","section":"§1"},{"source":"R2-architect.md","index":4,"conflict_id":"9d5cd16741226655f53394b6f044c38fa27b96dc8be8fa504bb6f648011151b8","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":5,"conflict_id":"ef593a54fa6cbd604639bc23929989ce2123986093acdc603fd076245420cae4","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":6,"conflict_id":"b168920b82a72cb827487dd81e6772a2a409f58610256a265c41eaa0244ef159","disposition":"folded","section":"§1"},{"source":"R2-architect.md","index":7,"conflict_id":"fb162dbbec73f7177472a9d9f71f483ad869a52e68871161dad591b41c40798b","disposition":"folded","section":"§3"},{"source":"R2-architect.md","index":8,"conflict_id":"803047bf234fc13e41eeb208761686ac031e6cbc581eda0e2153c8943d9cd5c7","disposition":"folded","section":"§4"},{"source":"R2-architect.md","index":9,"conflict_id":"3073fa48b8f969fa3ba56cf0f6e2d9e896d5b1ae7192a56632e7ab8715f6146e","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":10,"conflict_id":"ae3c8c4ad2a53871d251974a00597ef443ac1c78133e2de5501e93abd743d4df","disposition":"folded","section":"§5"},{"source":"R2-pm.md","index":0,"conflict_id":"ba138d4dd76736a0d0c996190cbecdbf576e686ec961fddb0424e37caab3d339","disposition":"folded","section":"§7"},{"source":"R2-pm.md","index":1,"conflict_id":"0d8a059606b38bb1f3685ec05457af16b323c05c590c8fda2178022df3d049d0","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":2,"conflict_id":"f7516c65c2bd8ff8f9cfc017a0288e5926fabf48c7f3ed6ce3c73de5e606e1e1","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":3,"conflict_id":"ee68410ce24e9c2eb4c18acf9a859bb6cfcec69d7bc518686ea7e6ed7ac9ba3f","disposition":"folded","section":"§4"},{"source":"R2-pm.md","index":4,"conflict_id":"a0a1136bbbc174e2fc92ebaee9b5ba8eec93b4c4585c38947282311d215c239e","disposition":"folded","section":"§4"},{"source":"R2-pm.md","index":5,"conflict_id":"50ea270ded74e5ddd12f99e3dda7b3e198076024e60d0764033a9a4bbbc493e4","disposition":"folded","section":"§1"},{"source":"R2-pm.md","index":6,"conflict_id":"c94a23bebee592aaa5cc1944e28800899ed747ff017c5380d87dffc55dd453b8","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":0,"conflict_id":"35c04139650536bf536d2c0bd895ca7df6171d1dd490cacfc59999a871f8ef76","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":1,"conflict_id":"f12477302e12aca98f0362dfff3fe2b5066211f34ab10ce1fb40d42a38e4fddf","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":2,"conflict_id":"092c2e0801249de0233c5db657a4f87ae8a022988b9fe96db4b4664cd5e6971b","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":3,"conflict_id":"bb0ff559ba8585a2213ac5f99778f112591d8a5df5680cc413865161cb105065","disposition":"folded","section":"§1"},{"source":"R2-ux.md","index":4,"conflict_id":"5659086da16f69181514a6e8f59b045cc87d0c448349719c5aff0442505558bd","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":5,"conflict_id":"6c78751c3b9859278efd70d0c512cc85d1d658337f99fecdd8b9968c0e62e4f9","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":6,"conflict_id":"485199f38062ddcd99a20332b520e222f5884875ac4c5a187a73c57ccf48e75b","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":7,"conflict_id":"4a61dda348ebc048e02b3786c65e90f7070f4db18989b7acc4c5c46f65f2a96f","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":8,"conflict_id":"fe93aa2559b235df830cb5c665ff2686ce311c446cac58595a8d0bdd5a5e93b8","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":9,"conflict_id":"319f77feaf3e4e7f6c43d684493c4bd2b0432ac5d03579957457308dbe3d2cad","disposition":"folded","section":"§7"}]}
-->
