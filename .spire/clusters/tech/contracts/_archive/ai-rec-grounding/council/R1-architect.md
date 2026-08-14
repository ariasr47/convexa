# R1 — architect position: ai-rec-grounding

## Position

### 0. What is actually in the tree (read this gate, not inherited)

Verified by reading `apps/api/src/services/rec_inputs/{mod,cited,cap_check,max_risk,field_reasons,digest}.rs`,
`apps/api/src/services/recommendation.rs`, `apps/api/src/services/llm.rs`,
`apps/api/src/routes/market.rs`, `libs/quant-engine/src/{candidates,straddle_move}.rs`,
`apps/api/tests/score_identity.rs`.

The seam is real and shaped right. Three facts that set the design:

1. **`envelope_extras` (`recommendation.rs:438-507`) is the single computation point.** It is a pure sync
   function returning a 3-tuple (`cap_check`, `field_reasons`, `cited_contract`), called from the `base`
   closure (`:617-652`), which is the **sole** envelope constructor on **all six** return paths
   (`unavailable`/no key, `gated_off`/no fresh edge, `unavailable`/over cap, `gated_off`/cooldown,
   `no_trade`, `produced`). Four of those pass `Value::Null` as `strategy`. So anything added here is
   automatically total across every branch — that property is why the partition invariant in §3 holds
   without branch-specific code.
2. **`field_reasons.rs` is exhaustive-by-match already.** `field_reason` (`:48-55`) matches `RecField`
   with **no wildcard arm**. Adding a variant is a compile error today. That is the enforcement mechanism
   I intend to reuse rather than invent.
3. **The BRIEF's observation path (1) does not exist in this backend.** `ScenarioLLMProvider` /
   `AI_REC_SCENARIOS_ENABLED` are Python-era. In Rust, `recommendation.rs:358` hardcodes
   `"scenarios": { "enabled": false, "catalog": [] }` and `RecRequestBody::scenario_id` (`:803`) is
   deserialized and **never read**. There is no scripted hallucinating provider to point at. §7 replaces
   that evidence path with one that exists.

### 1. The gap, stated precisely

`field_reasons.rs` answers *"the field is null — why?"* under `ReasonKind { NotGiven | Unavailable }`.
Nothing answers *"the field is non-null — where did that number come from?"*. The feature adds the second
question as a **parallel leaf with the same field vocabulary**, not as a rewrite of the first.

`cited.rs` is the one place presence *is* verified today, and it verifies exactly one thing: the
contract triple (strike + expiration + right) against `CandidateSet::contracts()`, under
`CitedState { Cited | RightUndetermined | OffSet | None }` with a `CitedKey` that has no partial
constructor. That module is the reference implementation. **Nothing in it changes.**

### 2. Component boundary: one new leaf, `services/rec_inputs/grounding.rs`

- Pure. No `AppState`, no `routes::`, no `reqwest`, no `.await`, no `Instant`, no env read — same
  contract as its five siblings (`mod.rs:1-3`: "Each submodule is a pure leaf").
- Consumed by exactly one caller: `envelope_extras`, which grows from a 3-tuple to a 4-tuple.
- `field_reasons.rs` behaviour is unchanged; the two modules partition one question space (§3).
- `cited.rs`, `cap_check.rs`, `max_risk.rs`, `digest.rs` are **read-only dependencies** — grounding calls
  them, never edits them.

### 3. Data-structure content

**The state vocabulary is a closed enum of FOUR members with a FIXED evaluation order, first match wins**
— deliberately mirroring `CapVerdict` (`cap_check.rs:6-31`, five members, `NotApplicable` first, with
the comment "DO NOT REORDER — the order is what keeps two implementations from disagreeing"):

| # | Member | Meaning |
|---|--------|---------|
| 1 | not-applicable | The field is absent. Nothing was asserted, so presence-grounding does not apply. |
| 2 | not-checkable | The field is present, but the source we would resolve it against was itself unavailable this cycle. **We do not know.** |
| 3 | verified | The field is present and resolves to a value this app computed; the anchor is named. |
| 4 | unverified | The field is present, the source was available, and it resolves to nothing we computed. **We checked and there is nothing.** |

**I am widening the BRIEF's three-state to four, and this is a load-bearing claim, not a rounding.**
`absent-is-not-none` (HARD) is precisely the rule that "we do not know" must not read as "we checked and
found nothing". Collapsing member 2 into member 4 would stamp *"this number matches nothing we own"* on a
number **nobody could check** — the fabricated-claim failure that invariant exists to prevent, one level
in. This is the same trap the `tradeable-rec-inputs` S2 skeptic caught (three individually-correct rules
composing into a "couldn't check your cap" caveat on every `no_trade` card), and it was fixed the same
way: put `not_applicable` first in a fixed order and make the bad composition unreachable by
construction. If PM/UX want three rendered treatments, that is a **render** collapse the FE may make
from four wire members; the wire must carry four. The exact serialized token spelling is the
synthesizer's INTERFACE_CONTRACT call, not mine.

**The field vocabulary stays `RecField`** — one enum, two consumers (`field_reason`, `grounding`), both
exhaustive matches with no wildcard arm.

**Scope addition the BRIEF did not name: `RecField` needs a FIFTH variant, `InvalidationLevel`.**
The strategy schema (`llm.rs:140-148`) emits these numeric fields: `strikes[]`, `expiration`, `right`,
`invalidation_level`, `exit_plan.target`, `exit_plan.stop`, `max_risk` (prose→parsed),
`position_size` (prose). `RecField`'s four cover everything except `invalidation_level` — which is a bare
`number|null` on the **price scale**, i.e. exactly the class of number that is a wrong trade when
fabricated, and it has **neither a reason nor a grounding today**. Its `field_reason` dependency list is
`vec![]` (market-state levels only — identical to `ExitStop`, `field_reasons.rs:54`), so the addition is
~2 lines there plus one resolution rule. Without it the BRIEF's goal sentence ("every number the AI
recommendation asserts") is false on ship. PM should price this; I am not empowered to cut it silently.

### 4. Data flow: the source universe, and the rule that it is the **as-sent** one

The resolver takes one struct assembled ONCE in `generate_recommendation`, beside the values already
assembled there (`:554-615`). Its content:

- **Candidate contracts** — `&CandidateSet` at `CandidateBudget::Prompt` (`:561-575`), the set that was
  actually sent.
- **Straddle-implied move** — `pruned_move` (`:582`), already restricted to the tenors present in the
  candidate block via `restrict_move_to_tenors`. Carries `anchor_spot` and `anchor_basis: GexSpot`
  on the type (`straddle_move.rs:61-62`), plus per-tenor `move_dollars` (`:48`).
- **Price-scale level anchors** — read from the sent `market_state` (`routes/market.rs:156-212`):
  `gex_spot`, `call_wall`, `put_wall`, `peak_gex_strike`, `gamma_flip`, `max_pain`, `vwap`,
  `vwap_upper_2/3`, `vwap_lower_2/3`. Each `Option<f64>` carried **with its name**, because a grounding
  that cannot say *which* level it matched is an unauditable badge.
- **Owner risk figures** — `effective_cap`, and the echoed risk block (`:600-612`).

**Binding rule: ground against what was SENT, never against the raw bundle.** Use `pruned_move`, not
`raw_move` (`:580`); the `Prompt`-budget set, not a `Handoff` one. The model can only be held to numbers
it was shown. This is the rule that breaks silently and invisibly later if it is not written down —
a future refactor that grounds `exit_plan.target` against the full unrestricted move would mark a target
"verified" against a tenor whose contracts the model never received.

### 5. The resolution rules — per field, declared, no generic matcher

This is the mechanism. Each `RecField` has exactly ONE rule; `grounding` is a `match` over `RecField`
with no wildcard arm, so a sixth field cannot ship without a rule (compile error).

**`MaxRisk`** — resolve against the owner's echoed figures via the EXISTING parse.
`ParsedRisk::NotParseable` ⇒ not-checkable. `Dollars(v)` with `effective_cap` present ⇒ verified,
anchored on the owner-supplied cap (`cap_verdict` already produced `Within`/`Above`; grounding names the
anchor, it does not re-decide). `Dollars(v)` with no cap ⇒ not-checkable, not unverified — the figure is a
real dollar amount, we simply have no owned number to resolve it against.
**`max_risk.rs` is not touched, not one line.** Its two-different-figures ambiguity rule is by design and
correct; the remedy for `NotParseable` is §6, never a parser loosening.

**`PositionSize`** — **permanently not-checkable this feature.** `max_risk.rs:1-2` is explicit:
"`position_size` is NEVER parsed by any lane." A typed machine-readable size field is a recorded deferral
(OPEN_THREADS §7ad: "typed machine-readable size field (future-dated, barred from riding the right-token
change)"). This feature does not start parsing prose sizing and does not introduce the typed field. The
honest wire answer is member 2, and the reason is structural, not a shortfall.

**`ExitTarget`** — **containment**, not identity. Verified iff the asserted target lies inside
`[anchor_spot − move_dollars, anchor_spot + move_dollars]` for the tenor matching the **cited
expiration** (the same exact-match tenor lookup `NumbersSaidStrip.tsx:22-25` already does — no
relabelling another tenor's number). Containment is the honest semantic for a target and it needs **no
tolerance constant at all**. Not-checkable when the move is absent, its state is not `Ok`, or no
expiration was cited. Unverified when the target sits outside the move the options market is pricing for
the tenor the model itself named. The envelope MUST be anchored on `StraddleMove::anchor_spot`, read off
the type — using `market_state.price` instead silently shifts the envelope, because `move_pct` is
documented "Percent OF `anchor_spot` — never of the live display price" (`straddle_move.rs:49-50`).

**`ExitStop` and `InvalidationLevel`** — nearest-named-level match. Verified iff the asserted level is
within tolerance of one of the named price anchors in §4, carrying that anchor's name. Otherwise
unverified. Not-checkable when every anchor is absent.

**The tolerance is the one number I cannot derive from the tree, and I am declaring it as an assumption
rather than asserting it.** Proposed mechanism, in three parts:
1. **Rule shape:** matched iff `|asserted − anchor| ≤ max(0.01, anchor × TOL_PCT/100)`.
2. **`TOL_PCT` is a payload-stated constant, never a query knob** — the precedent is verbatim in the
   tree: `candidates.rs:11`, `pub const BAND_PCT: f64 = 15.0` / "Payload-stated constant, never a query
   knob — deliberately, so it cannot erode." It rides the payload so the rule is auditable client-side
   and by an operator, satisfying `model-read-carries-its-assumptions`: a level grounding is a
   model-dependent read and must carry its own threshold/basis.
3. **Pre-registered default `TOL_PCT = 0.1`, plus a mandatory measurement and a PRE-COMMITTED response
   ladder:** measure the verified/unverified/not-checkable split for `ExitStop` + `InvalidationLevel` on
   real recs before ship. **If unverified is high because the model rounds (nearest anchor within ~1% of
   spot), the remedy is a PROMPT directive — "quote the level exactly as the context gives it" — and the
   tolerance does not move.** That is the identical judgement the last feature already recorded for
   `max_risk` ("The parser is right; the prompt is what changes", BRIEF, and OPEN_THREADS §7ad
   "a future prompt tweak, never a parser loosening"). Loosening a verification tolerance to make the
   verification pass is how this feature becomes theatre.

**The contract triple is NOT re-verified — it is re-expressed.** `strikes`/`expiration`/`right` grounding
IS `CitedState`, via a total mapping (`Cited`→verified, `RightUndetermined`→not-checkable,
`OffSet`→unverified, `None`→not-applicable). I deliberately do **not** add a `RecField` variant for it:
duplicating the fact into a second block gives the FE two tokens for one truth that can drift. Derive,
never duplicate. A test asserts the mapping is total.

### 6. The `max_risk` prompt defect (folded in)

Measured 4/4 `cap_check: not_checkable` at the V10 run. Cause: the model names two different dollar
figures in one sentence. Fix, entirely in `build_rec_prompts` (`llm.rs:137-156`), which today says only
*"Size within the owner's stated risk block when one is present; if it is absent, say so rather than
inventing a figure."* Add a single-figure directive: the risk field names **exactly one** dollar figure
in `$N` form; a percentage may appear only as the same dollar figure.

**A prompt string is prose, and prose is not enforcement.** The structural half is two-armed:
(a) a source-scan test pinning that the directive is present in the assembled system prompt, poison-proved
(delete the directive → red); (b) the measurement re-run showing the 4/4 `not_checkable` sample moving to
real verdicts. When the model disobeys anyway, the existing behaviour is already correct and unchanged:
`NotParseable` → `NotCheckable`, never a guess, never a default.

**Option considered and deferred:** ask the model for a typed numeric risk field instead of prose. Lower
long-run complexity (no parser at all) but it changes the strategy schema, hence the wire contract and
the FE render — not additive-cheap — and it collides with the recorded §7ad deferral. Prompt-first,
measure, revisit next cycle.

### 7. Isolation, error rules, and how this is verified without a fabricating provider

- **`best-effort-isolated-or-null` vs `absent-is-not-none` — a real tension, resolved explicitly.**
  Best-effort says "null/omitted field, never an HTTP error"; absent-is-not-none says the distinction must
  survive to the consumer. Omitting the grounding block on failure IS the collapse the second invariant
  forbids. Resolution: **the block is always present on every one of the six branches; failure is
  expressed as member 2 (not-checkable) on the affected field, never as an omitted block, never as an
  HTTP error, never as a missing member.** No bundle change, no SSE change, no new failure mode on
  `market_state`/`strike_profile`.
- **`additive-keeps-score-byte-identical` (HARD).** The mechanism is the module boundary plus the
  existing pin: `apps/api/tests/score_identity.rs` asserts score/tier/fingerprint on both bundle branches
  with a poison arm. Concretely, after this feature `PINNED_SCORE_DP_TRUE = 8`,
  `PINNED_TIER_DP_TRUE = "dormant"`, `PINNED_FINGERPRINT_DP_TRUE = "ad81df2ba2c3"` must be unchanged
  and the pinned constants must not be "updated" (`score_identity.rs:54-55`: "Do NOT 'update' these to
  make a change pass — a diff here IS the regression"). Nothing in `quant_engine` or `signals` imports
  `rec_inputs`; grounding adds no new edge.
- **`structural-over-prose-enforcement` — poison it and the build goes red.** Three named guards:
  (i) the exhaustive `match RecField` with no wildcard — add a field, fail to compile;
  (ii) the **partition assertion**: for every field on every branch, a reason exists **iff** grounding is
  not-applicable (exclusive-or). Poison arm: make one field emit both, or neither, and the test reds.
  This is the guard that makes "we never render an unexplained number" a property rather than a habit;
  (iii) a source scan over `apps/api/src/services/rec_inputs/*.rs` asserting no `crate::state`,
  `crate::routes`, `reqwest`, or `.await` — the leaf-purity lock — with an anti-vacuity assertion and a
  poison arm, following the `outcome-ledger` `?raw` scan and the `broker-option-grouping` two-arm scan.
- **`digested-labels-not-raw-dump`.** The state member is the authoritative wire token, rendered through
  a closed client lookup. **The FE never re-derives grounding** — no component compares an asserted stop
  to `market_state.gamma_flip`. Precedent already exists un-generalized: `ai-rec.risk.spec.tsx` §1
  ("Levels in play is bundle-sourced, never LLM-sourced"). The raw anchor catalogue does not need to go
  on the wire; the matched anchor's name does.
- **Verification without a hallucinating provider.** Because the resolver is a pure function over
  `serde_json::Value` + a `CandidateSet`, a fabricated recommendation is just a fixture. The evidence is
  a Rust integration test feeding hand-written fabricated strategies through `envelope_extras` against a
  hermetic `CandidateSet` (the pattern in `cited.rs:96-110` already builds one from a two-contract chain):
  a strike absent from the set, a stop far from every anchor, a target outside the implied move, a
  two-figure risk string — asserting the exact member for each. No env flag, no key, no network. **I
  recommend against building a runtime fabricating provider**: a config flip must never be able to put a
  lying model into production. If a *live browser* demonstration is wanted, one exists for free —
  `AI_REC_LOCAL_ONLY=1` routes to `local_strategy_from_bundle` (`recommendation.rs:729-791`), which
  already emits `exit_plan.stop = gamma_flip` (verified arm, anchored on a real level) and
  `max_risk: "1R defined-risk"` (not-checkable arm, `max_risk.rs:70-72` pins it `NotParseable`). Both
  arms, no new code.
- **`no-real-order-path`.** Sizing/risk context only. Nothing here reaches a broker or order path; the
  Accept flow is untouched.

### 8. Explicit non-goals

1. **No prose-number extraction.** `summary`, `rationale`, `key_points`, `entry_trigger`, `time_horizon`
   are not scanned for numbers. Adjudicating a number inside a sentence has no closed answer, and a wrong
   adjudication is worse than none — it would stamp "verified" on a paragraph.
2. **No loosening of `max_risk.rs`.** Explicitly not reopened, per the BRIEF and the §7ad record.
3. **No parsing of `position_size`; no typed size field.**
4. **No new vendor call, no new data dependency, no new `await`, no new endpoint fetch.**
5. **No score / gate / tier / fingerprint / SSE / bundle-shape change.**
6. **"Verified" is a provenance claim, never a correctness claim.** It means "this number resolves to
   something we computed" — never "this level will hold" or "this trade is good".
7. **No runtime fabricating LLM provider behind an env flag.**
8. **No new or changed durable client store**, so `loss-free-durable-migration` is not engaged.
9. **No generic JSON number-walker.** Rejected in §5; see the option table below.

### 9. Options compared

| | Complexity | Cost | Scales to a new field | Team familiarity |
|---|---|---|---|---|
| **A. Per-field declared rules in a new pure leaf (CHOSEN)** | Low — ~1 module, 5 rules, mirrors `field_reasons.rs` line-for-line | S–M inside the stated M | **Compile error** until a rule is written | Highest — identical shape to the module shipped last week |
| B. Generic numeric matcher walking the strategy value against an anchor catalogue | High — needs a path walker *and* a per-path tolerance policy anyway, so it does not actually avoid A's work | M–L | **Silently wrong** — a new field gets a default rule and nothing goes red | Low; no precedent in the tree |
| C. Ask the model to self-declare a source per number | Lowest | S | N/A | Medium |

C is rejected on principle, not cost: it is the model attesting to its own honesty. A model that
fabricates a strike fabricates the provenance tag beside it. It is worthless as verification **by
construction**, and shipping it would make the app's traceability claim false while looking green.
B is rejected because it fails `structural-over-prose-enforcement` at exactly the point that matters.

## Risks I see

- **Verification theatre.** The single largest risk: "verified" reading as endorsement, so a trader sizes
  harder against a fabricated-but-in-range target. The architectural half of the mitigation is that the
  wire carries the **matched anchor's name**, so the claim is auditable rather than a badge; the copy half
  is UX's and I am not writing it.
- **The tolerance constant is the one unmeasured number in this design.** If it is set loose to make the
  demo look good, the feature is worse than not shipping — it launders fabrications. The pre-committed
  ladder in §5 is what stops that, and it only works if PM pre-commits *before* seeing the split.
- **`invalidation_level` may get cut for scope** and the ship claim then overstates. Stated so it is a
  decision, not an oversight.
- **Drift between `field_reasons` and `grounding`** if a future field lands in one and not the other. The
  partition assertion (§7.ii) is the guard; if it is dropped for being "obvious", this risk returns
  immediately and silently.
- **Tenor mismatch.** If `ExitTarget` grounding ever runs against the unpruned move, targets get marked
  verified against tenors the model never saw. Guarded only by the §4 rule being written down and by the
  fixture asserting a pruned-vs-raw difference.
- **The BRIEF's evidence path (1) is stale** (§0.3). If the plan is written assuming a scenario registry
  exists, the verification lane discovers it does not, mid-build.
- **Six return paths, one closure.** The design leans hard on `base` being the sole envelope constructor.
  If a future branch constructs an envelope directly (as `unavailable_envelope` at `:706-727` already
  does — note it emits **no** `cap_check`/`field_reasons`/`cited_contract` at all today), grounding would
  be silently absent there. That function is reached only on a bundle failure; the partition assertion
  must either cover it or the SPEC must state it as a known-uncovered branch. **I flag this as a genuine
  pre-existing hole I found rather than one I am claiming to close.**

## Assumptions I'm making about the other two lanes

- **PM prices the fifth `RecField` variant (`InvalidationLevel`) as in-scope for the stated M effort.**
  Falsifiable: if PM defers it, the BRIEF's goal sentence "every number the AI recommendation asserts" is
  false on ship and the SPEC must say so in one sentence. I will withdraw the scope addition on a PM
  ruling, but not the requirement that the shortfall be stated.
- **PM/UX rule that an unverified number is still RENDERED, carrying its state, rather than dropped.** The
  BRIEF leaves this open ("dropped, or carried as an explicitly unverified state — the PM/UX call"). My
  architecture serves both, but I am assuming the **payload always carries the number and the FE decides**
  — if UX instead wants the server to omit unverified figures, that is a serialization change I have not
  designed and it directly collides with `absent-is-not-none` at the wire boundary.
- **UX renders at least three visually distinct treatments and will accept four wire members collapsed to
  three at render.** Falsifiable: if UX asks for a two-state green/grey badge, the HARD `absent-is-not-none`
  constraint is broken at the render boundary and I will contest it, citing the `positions-legs` precedent
  of four independently-assertable not-a-number literals.
- **UX does NOT re-derive grounding client-side.** No component compares `exit_plan.stop` to
  `market_state.gamma_flip`. Falsifiable by grepping the FE diff for a numeric comparison against a
  `market_state` level.
- **UX needs the matched anchor's NAME, not just the state token, to write honest copy** ("your stop sits
  on the put wall" vs "we could not place this stop"). If UX only wants the state token, carrying the
  anchor is dead weight and **I will withdraw it** — that is a cheap simplification, not a loss.
- **PM accepts that `position_size` is permanently not-checkable this feature** and does not treat that as
  a coverage failure. Falsifiable: if PM requires a size verdict, the typed-size-field deferral
  (OPEN_THREADS §7ad) must be reopened, which is a scope change, not a build detail.
- **PM pre-commits to "tighten the prompt, never loosen the tolerance" BEFORE the split is measured.**
  Falsifiable and the highest-leverage assumption in this document.
- **Neither lane asks for a runtime fabricating provider behind an env flag**, and both accept
  fixture-driven Rust tests plus the free `AI_REC_LOCAL_ONLY=1` live demo as the evidence path. Falsifiable
  the moment either position cites `AI_REC_SCENARIOS_ENABLED` as though it exists —
  `recommendation.rs:358` hardcodes `enabled: false`.
- **No new page, route, or endpoint.** I assume grounding rides the existing recommendation response
  envelope and renders inside the existing `pages/ticker/widgets/ai-rec/` folder. Falsifiable: if either
  lane proposes a new endpoint or a "grounding drawer" route, the additive/isolation story changes and I
  want to re-argue it.
- **PM does not treat this as a model-quality feature.** I assume nobody proposes retrying, re-prompting,
  or auto-correcting the model when a number comes back unverified. An auto-retry loop puts an unbounded
  vendor call on the rec path and breaks `best-effort-isolated-or-null`; I would contest it.
