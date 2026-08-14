# R3 — architect resolutions: ai-rec-grounding

One pass, ten conflicts (T0, T1, T2, T3, T5, T9, T10, T20, T22, T25). Every resolution names a type, a
member, a constant or a file. Rust type/variant names are mine (data-structure content); the serialized
spelling of any wire key is the synthesizer's INTERFACE_CONTRACT call, and the mapping below is 1:1 and
total so the synthesizer never has to choose a semantic.

Two things I withdraw up front, before the per-conflict rulings, because several resolutions depend on
them:

- **W1.** `Dollars(v)` + `effective_cap` present ⇒ verified is **dead**. UX and PM are both right; see T22.
- **W2.** My R1 §7 and R2 both claim the `AI_REC_LOCAL_ONLY=1` live arm runs with **"no key"**. That is
  **false**. `recommendation.rs:655` returns `base("unavailable", …)` when `!resolved.usable()`, and that
  check runs *before* the `local_only` read at :673. `ResolvedLlmKey::usable()` is
  `key_material.is_some() && key_source != "none"` (`llm.rs:115`). The live arm therefore needs
  `feature_flag_on()` plus either a stored BYO key for the signed-in user or an admin email with a shared
  env key. **No network call is made** (the `complete_strategy` branch is not taken), and the key material
  is never used — but a key must *resolve*. I over-claimed; the corrected claim is "no network, no vendor
  spend, a resolvable key required".

---

## T0 — `conflict_id 7b75ac93…` — PM's AC-33 rests on a scenario harness that does not exist

**CONVERGED.** PM self-revised to the same finding (`ba138d4d…`) and withdrew AC-33/AC-35 as written; UX
self-revised the matching state-matrix row. Nothing is contested. The settled evidence path, concretely:

1. **Server fabrication fixture (ship-blocking).** Lives in the existing `#[cfg(test)] mod tests` in
   `apps/api/src/services/recommendation.rs:839` — it is `use super::*`, so the private `envelope_extras`
   is in scope, and `envelope_extras` already **returns `serde_json::Value`s built by `json!` over
   `serde_json::to_value` of the typed enums**. Asserting on that return value *is* asserting on the
   serialization path; no new test binary, no `pub` widening of a private function. The hermetic inputs
   follow `cited.rs:96-110`: a two-contract chain → `CandidateSet::build(..., CandidateBudget::Prompt, …)`,
   a hand-written `StraddleMove` with one tenor, a hand-written `strategy: Value`.
   Four fabricated arms in one fixture: strike absent from the set, `exit_plan.stop` far from every anchor,
   `exit_plan.target` outside the pruned move for the cited tenor, `invalidation_level` far from every
   anchor. Asserted result: `checked = 4, traced = 0, untraced = 4`, card-level member `NoneTraced`, and
   no field carrying `Traced`.
2. **Honest counterpart fixture (same module):** stop exactly on `gamma_flip`, invalidation inside
   tolerance of `put_wall`, target inside the pruned move, cited triple in the set → `AllTraced`,
   `traced = 4`; and a one-field-off variant → `SomeTraced`, `traced = 3, untraced = 1`. Without this arm
   the fabrication fixture proves only that the resolver says no.
3. **Frontend arm:** a hand-written response fixture in the dashboard's ai-rec spec. No backend, no flag.
4. **Live browser arm (not ship-blocking):** `AI_REC_LOCAL_ONLY=1`, subject to W2.

**No env flag, no key, no network on arms 1–3.** AC-35's replacement is the property, not the guard: no
build-time or run-time configurable path can serve a fabricating provider on the deployed surface —
enforceable as a source scan asserting `RecRequestBody::scenario_id` is still never read and that no
provider selection reads an env flag other than `AI_REC_LOCAL_ONLY`.

**One honest cost of T22, recorded here because it lands on this evidence path:** with `MaxRisk` resolved
to `NotCheckable{StructurallyUnchecked}` (T22), the local-fallback card no longer demonstrates a
*renderable* not-checkable clause — `max_risk: "1R defined-risk"` now carries a suppressed clause. The live
arm demonstrates two `Traced` figures (`exit_plan.stop` and `invalidation_level`, both `gamma_flip`,
`recommendation.rs:780,783`) and the card-level line, and it requires `gamma_flip` to be non-null in the
bundle. A renderable `couldn't check this` is reachable **only from fixtures** in v1. That is a real
narrowing of the live demo and the SPEC should say it rather than let GATE Q discover it.

## T1 — `conflict_id 688d8687…` — UX A8 cites `AI_REC_SCENARIOS_ENABLED`

**CONVERGED.** UX self-revised (`319f77fe…`) and adopted the fixture substitution verbatim. Settled rule:
A8 reads "UX-16 is reachable from a hand-written response fixture in the dashboard spec, with no LLM call,
no network and no backend scenario registry"; the state-matrix row label
`scripted scenario (hallucinating provider)` becomes `fabricated-rec fixture`. The live-browser row keeps
`AI_REC_LOCAL_ONLY=1` **with W2's correction applied** — it is not key-free, and UX's row must not promise
that it is.

## T2 — `conflict_id 89d126ee…` — AC-32's "at the stated size"

**CONVERGED, with one narrowing I own.** PM withdrew "at the stated size" (`f7516c65…`); that half is
settled and `position_size` is not parsed by anything.

The narrowing: the leg PM kept — reconciliation against *the quoted cost of the cited contract* — also
cannot honestly produce `Traced` in v1, for two named reasons:

1. **There is no contract multiplier in the rec path.** `CandidateContract` (`candidates.rs:91-108`)
   carries `bid`/`ask`/`mid` **per share**; the underlying `Contract` type carries none either. Turning a
   quote into a dollar cost requires `× 100`, which exists nowhere on this path (the only `multiplier`
   field in the tree is `broker/mod.rs:52`, on a broker position, and `broker/stub.rs` hardcodes it). A
   `traces to Convexa's quoted cost` claim would therefore rest on an **assumed** multiplier that the chain
   data does not carry, and it would be silently false on any adjusted contract. That is verification
   theatre with a dollar sign on it.
2. **Any quantity other than one is size inference.** With the multiplier assumed, `$300` reconciles
   against a `$1.10` ask only as `300 ÷ 110 = 2.7 contracts`. Reading a quantity out of the risk figure by
   division is the same deferral (`OPEN_THREADS §7ad`) we all agreed not to reopen — it just does the
   reading with arithmetic instead of with a prose parser. The only non-inferring form is
   `|parsed_risk_dollars − ask × 100| ≤ tol`, i.e. **exactly one contract**, which will fire approximately
   never on real recs.

**Settled rule:** `MaxRisk` has **no `Traced` arm in v1**. Its closed answer set is
`NotApplicable` (field absent) and `NotCheckable{StructurallyUnchecked}` (field present). The SPEC states
in one sentence that this feature checks the stop, the target, the invalidation level and the cited
contract, and does not check the risk figure or the suggested size. The deferred `Traced` arm has a written
shape so a future cycle does not re-derive it: `CitedState::Cited` **and**
`contract.quote_presence == Quoted` **and** `ParsedRisk::Dollars(v)` **and**
`|v − ask × MULTIPLIER| ≤ max(0.01, cost × GROUNDING_TOL_PCT/100)`, unlocked by the typed size field plus a
data-sourced multiplier — not by either alone.

## T3 — `conflict_id 9b3f6144…` — `position_size` booked IN against a reference it cannot meet

**CONVERGED.** PM accepted in R2 (`"**\`PositionSize\`** — **permanently not-checkable this feature.**" —
accepted`). Settled rule: `position_size` stays in the wire vocabulary and carries
`NotCheckable{StructurallyUnchecked}` on every rec where the field has a value, `NotApplicable` where it
does not; §2 books it **IN-with-a-stated-limit**, the stated reason being structural ("Convexa does not
read a size out of prose", `max_risk.rs:1-2`); the typed machine-readable size field stays future-dated at
`OPEN_THREADS §7ad`. It is **not** in the card-level denominator (see T9). The scope table must not claim
coverage for it.

## T5 — `conflict_id ef593a54…` — UX-20's reason clause cannot ride `cap_not_derivable_reason`

**CONVERGED — the fact is now airtight and I re-verified it this round.** `effective_dollar_cap`
(`auth/risk.rs:60-87`) sets `not_derivable_reason: Some("percent_without_account_size")` in **exactly one
arm** (`:80-85`), and that arm also sets `value: None`. Every other arm sets `not_derivable_reason: None`.
`cap_verdict` (`cap_check.rs:19-31`) reaches `NotCheckable` only at step 3, which requires
`effective_cap == Some`. Therefore **whenever `verdict == NotCheckable`, `cap_not_derivable_reason` is
null, with no exception** — the token is null in precisely the state UX-20 wants explained.

**Settled rule:** UX-20's reason clause renders on a **new** closed token produced by widening the OUTPUT
of `max_risk.rs` (my R2 self-revision `9d5cd167…`), carried on the existing `cap_check` surface beside
`verdict`, never on `cap_not_derivable_reason`. Concretely, `ParsedRisk` gains a reason on its refusal:

```
ParsedRisk { Dollars(f64), NotParseable(RiskRefusal) }
RiskRefusal { NoText, NoDollarFigure, MultipleDifferentFigures }
```

with the mapping pinned against the existing tests, which must all still pass unchanged:
`None` → `NoText` (`:11`); `vals.len() == 0` → `NoDollarFigure` (covers `"1R defined-risk"` :70-72 and the
bare `"300"` :75-77); the trailing `_ =>` arm at `:43` → `MultipleDifferentFigures` (covers `"$300 to $500"`
:80-82). **Which inputs refuse does not move by one input** — the poison test is that changing any input's
parse *outcome* reds the build. `cap_not_derivable_reason` keeps its meaning and its own lookup; the two
tokens answer different questions (why the OWNER has no cap vs why the MODEL's figure was unreadable) and
neither may stand in for the other. Both stay closed tokens, both stay client lookups.

This also discharges PM's ask #2 with the correction that `max_risk.rs` **must** be touched — output only,
never acceptance.

## T9 — `conflict_id 3073fa48…` — one card-level member cannot be a server token

**CONVERGED**, and UX's own self-revision (`fe93aa25…`, withdrawing `nothing to check`) closes the last
gap. Settled mechanism — the card-level token is a closed enum with a **FIXED evaluation order, first
match wins**, mirroring `CapVerdict`'s `DO NOT REORDER` discipline (`cap_check.rs:15-18`):

| # | `CardGrounding` member | Emitted when | Client renders |
|---|---|---|---|
| 1 | `NotApplicable` | `strategy` is null, **or** `decision != "trade"`, **or** `checked == 0` | **nothing** — no card line, no per-field clause |
| 2 | `LocalRules` | the strategy came from `local_strategy_from_bundle` | the local-rules literal (T17/T8 is PM↔UX) |
| 3 | `NoneTraced` | `checked ≥ 1`, `traced == 0`, `untraced ≥ 1` | UX's none-traced literal |
| 4 | `CouldNotCheck` | `checked ≥ 1`, `traced == 0`, `untraced == 0` | UX's couldn't-check literal |
| 5 | `SomeTraced` | `traced ≥ 1` and `traced < checked` | UX's some-traced literal |
| 6 | `AllTraced` | `checked ≥ 1` and `traced == checked` | UX's all-traced literal |

Plus **exactly one client-selected branch**: *the block is absent from the response* → `wasn't checked`.
That is a lookup on **presence**, not a re-derivation from figures, so `digested-labels-not-raw-dump`
holds. UX-2 should read: "chosen by closed lookup on a server token when the block is present; its absence
renders `wasn't checked` and is the only member the browser selects."

**PM's ask #1 — counts: YES, emittable, and I am emitting four integers, not two.** The card token carries
`checked`, `traced`, `untraced`, `not_checkable`, computed inside the same pure fold in `grounding.rs`,
with a test pinning `traced + untraced + not_checkable == checked`. Four costs no more than two and it
lets PM's counted literal and UX's qualitative literal both be written without a single client-side
subtraction. **Denominator (`checked`), stated exactly:** the fields whose member is neither
`NotApplicable` nor `NotCheckable{StructurallyUnchecked}`, plus the cited contract when its `CitedState`
is not `None`. On a full model rec that is 4 — `exit_plan.stop`, `exit_plan.target`, `invalidation_level`,
cited contract — so PM's `3 of 4` example lands exactly, and `max_risk` / `position_size` never inflate the
denominator into a permanent `2 of 5`.

**AC-16's provenance discriminator:** required, and it is member 2 above — **not** a separate wire field
and **not** surgery on `key_source` or `scenario`. Mechanism: hoist the `local_only` env read
(`recommendation.rs:673-675`) to above the `base` closure and let `base` derive the member as
`if strategy.is_null() → NotApplicable; else if local_only → LocalRules; else …`. The env read stays in
`recommendation.rs`; `grounding.rs` takes a plain `bool` and remains a pure leaf (`rec_inputs/mod.rs:1-3`).
Whether the FE renders a distinct literal and whether per-field clauses are suppressed on that card is the
PM↔UX ruling in T17/T8 — both outcomes ride this one token.

## T10 — `conflict_id ae3c8c4a…` — AC-21 pins a failure mode that cannot occur

**CONVERGED.** Neither peer contested the fact; UX contests only the literal (their `6c78751c…`, a
copy swap that is not mine). Settled rule: **there is no "grounding pass failed" state.** The resolver is
a pure sync leaf over `serde_json::Value` + `&CandidateSet` with no `AppState`, no `reqwest`, no `.await`,
no env read and no `Result`; it is total by construction, and unavailable inputs are expressed as
`NotCheckable` on the affected field, never as an omitted block, never as an HTTP error. AC-21 is
re-expressed against the reachable state: *when no grounding block is present in the response, the card
renders one card-level statement in place of per-number states, no figure is presented as traced, and the
ticker page, bundle and stream are untouched.* Testable from a fixture payload with the block omitted.
The isolation guarantee is delivered **structurally**, not by a runtime catch.

**PM's ask #3 / UX's ask #5 — `unavailable_envelope` (`recommendation.rs:706-727`), answered:** it is
reached from exactly one place, the `build_bundle` failure at `:519-531`. It emits `"strategy": null`, no
`cap_check`, no `field_reasons`, no `cited_contract`, and it will emit no grounding block. **It renders no
rec body and no figures**, so it is *not* a card on which `wasn't checked` can mislead — UX's matrix row
"no grounding surface (no rec body exists)" already covers it. It is the only envelope in the file not
built by the `base` closure. Consequence for both lanes: the block-absent branch is reachable in
production only via (a) a client talking to a pre-feature server and (b) this bundle-failure envelope,
and (b) shows nothing to be wrong about. The SPEC names (b) as a known-uncovered branch rather than
discovering it; I am **not** claiming to close it, and I am not attaching a grounding block to it (the
`CandidateSet` it would need does not exist at that point in the function).

## T20 — `conflict_id 092c2e08…` — a permanently-constant per-field clause is furniture

**CONCEDED**, and I am supplying the mechanism that makes the concession enforceable instead of a client
habit. UX is right: a clause whose value is identical on every card that ever ships carries zero
information and teaches the reader to skip the line — which costs the `couldn't check this` that matters,
on the stop, the day a level source is genuinely missing.

**What replaces my claim:** the wire stays four-member and total (`position_size` and `max_risk` both carry
a member on every rec — omitting it is the `absent-is-not-none` collapse), and **suppression is driven by
a server token, not by field identity in the browser**. The `NotCheckable` member carries a closed reason:

```
NotCheckableReason {
  StructurallyUnchecked,      // this feature never checks this field — constant across every rec
  NoNamedLevel,               // every price anchor absent this cycle
  NoCitedExpiration,          // no expiration cited, so no tenor to test containment against
  StraddleMoveUnavailable,    // move absent, state != Ok, or the cited tenor not in the pruned move
}
```

The FE rule becomes a lookup: `NotCheckable{StructurallyUnchecked}` → **no clause**; every other
`NotCheckableReason` → `couldn't check this` with the reason clause. In v1 exactly two fields ever carry
`StructurallyUnchecked` — `PositionSize` and `MaxRisk` — and a test pins that set with a poison arm
(mark a third field structurally-unchecked → red), so the suppression cannot spread quietly into a field
we simply stopped checking.

**UX's ask #2, answered definitively:** this is a **new closed enum, not an extension of
`field_reasons::MissingInput`**. Extending `MissingInput` would add members that `field_reason` can never
emit (its `deps` lists at `:48-55` cannot produce them), leaving the shipped FE lookup carrying dead arms
for states that do not exist on that surface. The two enums answer different questions — "why is this
field null" vs "why could this present value not be checked" — and their token spellings are disjoint, so
a mis-wired lookup fails a typed exhaustiveness check rather than rendering the wrong sentence.

## T22 — `conflict_id 5659086d…` — the cap rule makes one wire member mean two things

**CONCEDED, without reservation.** UX is right on meaning and PM reaches the same place from the product
side. `traces to Convexa's risk cap (500)` is a sentence this app must not be able to say: the cap is a
number the **owner typed**, not a number Convexa computed from the chain, and a fabricated $480 against a
$500 cap would print as traced. I withdraw `Dollars(v)` + `effective_cap` ⇒ verified entirely.

**What replaces it — the whole of `MaxRisk` in v1:**

| Input | Member |
|---|---|
| `max_risk` absent/null | `NotApplicable` |
| `max_risk` present (any parse outcome) | `NotCheckable{StructurallyUnchecked}` |

No `Traced` arm (T2), no `Untraced` arm — `Untraced` would itself be an overclaim, because "we checked and
found nothing" is false when there is no source to check against. **No per-field grounding clause renders
under the risk figure** (T20's rule applies unchanged), so the `Traced` member keeps exactly one meaning
across every field: *the asserted number equals a number Convexa computed, within the stated tolerance, and
the anchor is named*. UX's single lookup is safe.

**The one statement about the risk figure stays where it already ships:** the cap surface
(`CapAnnotation` / `cap_check`), which gains the `RiskRefusal` token from T5 — that is PM's AC-30
observability, delivered on the surface that owns the fact, with no second vocabulary (PM AC-22/AC-34).
This is exactly UX's proposal ("Do not attach a grounding clause to `max_risk` at all") and exactly PM's
constraint ("Being under the cap alone never renders as traced"), and it goes one step further than PM's
revised AC-32 for the reasons in T2. The honest consequence, which the SPEC states in one sentence: this
feature's visible value sits on the stop, the target, the invalidation level and the cited contract.

## T25 — `conflict_id 4a61dda3…` — the tolerance disclosure

**CONCEDED on the disclosure, and here are the four things the spec needs.**

1. **The constant.** `pub const GROUNDING_TOL_PCT: f64 = 0.1;` — percent, declared in the grounding leaf
   beside its rule, following `candidates.rs:11` (`BAND_PCT`, "Payload-stated constant, never a query
   knob — deliberately, so it cannot erode"). Match rule:
   `|asserted − anchor| ≤ max(0.01, anchor × GROUNDING_TOL_PCT / 100.0)`. Emitted **once per response** on
   the grounding block, never per field, never as a query parameter.
2. **What the client renders when the numbers differ but are inside tolerance.** The traced clause,
   unchanged: the anchor's **name** and the anchor's **own value** — `traces to Convexa's put wall (412)`
   beside the model's `412.4`. **No tolerance text on the clause.** Both numbers are on screen, so the
   reader sees the actual gap instead of inferring it from a percentage. A traced clause with no value is
   a badge and is a defect (UX-8) — agreed and binding.
3. **Where the threshold is stated.** Exactly once, in the card-level definition surface, read off the
   payload constant and never composed client-side. **UX's ask #1, answered honestly:** the floor is real
   and only binds below a $10 anchor, so a percent-only sentence would understate the tolerance. The
   honest single sentence is of the form *"within 0.1% of the level, or one cent, whichever is larger"* —
   semantics pinned by me, wording UX's.
4. **The basis discriminator, so the client never picks a clause shape by inspecting which numbers are
   present.** UX's ask #1 is granted in full. A `Traced` member carries:

   - `MatchBasis::NamedLevel` → the anchor's closed id + the anchor's own value (2dp, `round2` precedent
     at `auth/risk.rs:132`). Closed anchor-id set, **fixed order, nearest wins, ties broken by this
     order**: `gex_spot`, `call_wall`, `put_wall`, `peak_gex_strike`, `gamma_flip`, `max_pain`, `vwap`,
     `vwap_upper_2`, `vwap_upper_3`, `vwap_lower_2`, `vwap_lower_3` (the price-scale levels on the sent
     `market_state`, `routes/market.rs:156-212`). UX's `{source}` label is a closed lookup on that id.
   - `MatchBasis::RangeContainment` → the tenor's `expiration` string plus `range_low` / `range_high`
     (2dp), where the range is `[anchor_spot − move_dollars, anchor_spot + move_dollars]` for the tenor
     matching the **cited expiration** in the **pruned** move (`StraddleMove::anchor_spot` off the type —
     never `market_state.price`, because `move_pct` is "Percent OF `anchor_spot`",
     `straddle_move.rs:49-50`). **Containment carries no tolerance at all** — `GROUNDING_TOL_PCT` applies
     only to `MatchBasis::NamedLevel`, i.e. to `ExitStop` and `InvalidationLevel`. The definition sentence
     must not imply the target was matched to 0.1%.

   Values ride the wire as **numbers rounded server-side to 2 decimals**, printed verbatim by the client
   with no arithmetic. (If UX needs pre-formatted strings instead, that is a serialization detail for the
   synthesizer; the content is settled either way.)

---

## Mechanism bill of materials (what the synthesizer must not have to guess)

**Per-field state — closed, four members, FIXED evaluation order, first match wins.** I rename R1's
`Verified`/`Unverified` to `Traced`/`Untraced`, conceding UX's export-artifact worry at zero cost: no token
that reaches a human-readable artifact should read as `verified`, which in a trading context is read as
"Convexa vetted this trade".

```
GroundingState {           // DO NOT REORDER
  NotApplicable,           // 1 — the field carries no value; presence-grounding does not apply
  NotCheckable(NotCheckableReason), // 2 — a value exists; the source we would resolve it against did not
  Traced(TracedAnchor),    // 3 — resolves to a number this app computed; the anchor is named + valued
  Untraced,                // 4 — the source was available and it resolves to nothing we computed
}
```

Total map to UX's committed render, with the single amendment from T20:

| Wire member | Client renders |
|---|---|
| `NotApplicable` | no clause |
| `NotCheckable{StructurallyUnchecked}` | **no clause** (T20 amendment) |
| `NotCheckable{NoNamedLevel \| NoCitedExpiration \| StraddleMoveUnavailable}` | `couldn't check this` + reason clause |
| `Traced{NamedLevel}` | `traces to Convexa's {source} ({value})` |
| `Traced{RangeContainment}` | `inside Convexa's implied move for {expiration} ({low}–{high})` |
| `Untraced` | `the AI's own number` |

**Field vocabulary.** `RecField` gains a fifth variant, `InvalidationLevel` (both peers priced it IN in
R2; if the human cuts it, the SPEC states the shortfall in one sentence and UX drops its row). The cited
contract is **derived, never duplicated**: `CitedState::Cited → Traced`, `RightUndetermined →
NotCheckable`, `OffSet → Untraced`, `None → NotApplicable`, with a test asserting the mapping is total.

**Per-field rules, v1, one per field, `match RecField` with no wildcard arm:**

| Field | Rule |
|---|---|
| `ExitStop` | nearest named level within `max(0.01, anchor × 0.1/100)`; all anchors absent → `NotCheckable{NoNamedLevel}` |
| `InvalidationLevel` | same rule, same anchor set |
| `ExitTarget` | containment in the pruned move for the **cited** tenor; no expiration cited → `NotCheckable{NoCitedExpiration}`; move absent/not `Ok`/tenor missing → `NotCheckable{StraddleMoveUnavailable}` |
| `MaxRisk` | `NotApplicable` / `NotCheckable{StructurallyUnchecked}` — no `Traced`, no `Untraced` (T2, T22) |
| `PositionSize` | `NotApplicable` / `NotCheckable{StructurallyUnchecked}` (T3, T20) |

**Binding rule, restated because it breaks silently:** ground against what was **SENT** — `pruned_move`
(`recommendation.rs:582`), never `raw_move` (`:580`); the `CandidateBudget::Prompt` set, never a `Handoff`
one. A future refactor that grounds a target against the unrestricted move marks it traced against a tenor
whose contracts the model never received.

**Structural guards (poison arms, all three):** (i) exhaustive `match RecField`, no wildcard — a sixth
field cannot ship without a rule; (ii) the partition assertion — for every field on every branch, a
`field_reason` exists **iff** grounding is `NotApplicable` (exclusive-or); (iii) the leaf-purity source
scan over `rec_inputs/*.rs` (no `crate::state`, `crate::routes`, `reqwest`, `.await`), with an
anti-vacuity assertion. Plus the pinned set of `StructurallyUnchecked` fields (T20) and
`traced + untraced + not_checkable == checked` (T9). `score_identity.rs` constants stay byte-identical.

## Assumptions the next round or the human may attack

1. **`GROUNDING_TOL_PCT = 0.1` is pre-registered, not measured.** PM pre-committed in R2 that a high
   no-match rate is answered with a prompt directive and never a wider tolerance. That pre-commitment is
   the only thing standing between this feature and laundering; if it is dropped at GATE Q the feature is
   worse than not shipping.
2. **`local_only` can be hoisted above the `base` closure without changing any other branch.** It is a
   pure env read at `recommendation.rs:673-675` with no side effect; I have read the code but not run it.
3. **The bundle's `market_state` carries the same level names as `routes/market.rs:156-212`.** Evidenced
   by `recommendation.rs:770` reading `/market_state/gamma_flip` and `:581` reading
   `/market_state/straddle_move` off the bundle. If a level is renamed on one path only, the anchor set
   loses a member silently — the anchor-id enum plus a fixture asserting each id resolves is the guard.
4. **No rec response is cached or persisted across a deploy.** If one is, a stored pre-feature response
   would render `wasn't checked` on a card with figures — the only production path where that member is
   both reachable and load-bearing. I did not verify this and I am not claiming it.
