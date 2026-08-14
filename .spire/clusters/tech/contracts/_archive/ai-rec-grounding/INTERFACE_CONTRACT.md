# ai-rec-grounding — interface contract

**Spec:** `.spire/clusters/tech/contracts/ai-rec-grounding/SPEC.md` (§6 points here)
**Backend:** `apps/api` (crate `api-rust`, Axum/Tokio) over `libs/quant-engine`
**Frontend:** `apps/dashboard` (React 19 + Vite + MUI), `pages/ticker/widgets/ai-rec/`
**Status:** draft — skeptic-reviewed (R4 pass 2); GATE Z touched this file only to strike the Z2
export-artifact claims (rule 7, §1 prompt paragraph, §4). No token, shape, order or conformance-block
change. Z1 required none: the entry-dialog prefill gate reads states already on this payload.

This feature **adds and extends backend surface**. It is **not** `NO_BACKEND_CHANGE`.

This file is the single FE↔BE truth. Every token spelling, every evaluation order and every nullability
below is authoritative here and is not restated in `SPEC.md`. The one thing that lives on the other side
of the line is **copy**: the human words each token renders are owned by `SPEC.md` §4 and are not
duplicated here, because two copies of a closed lookup table is exactly how the two drift apart.

---

## Standing rules for every field below

1. **Closed vocabularies are authoritative on the wire.** The frontend renders every state, reason,
   basis, anchor and card-level member by **closed lookup on the token**. It never re-derives a label
   from a scalar, never picks a literal by inspecting a `null`, never compares two figures, and never
   counts (`[digested-labels-not-raw-dump]`, `[absent-is-not-none]`). **The wire never carries a
   composed or free-text label** — no `source_label`, no pre-rendered sentence. Every closed token in
   this file has a **total** client-side lookup defined once in `SPEC.md` §4, including the eleven-member
   `anchor_kind` set and its unrecognized-token fallback.
2. **The grounding block is total and is never omitted.** It is emitted by the `base` closure
   (`apps/api/src/services/recommendation.rs:617-652`), the sole envelope constructor on all six return
   paths, so every field carries a member on every branch. An unavailable input is expressed as
   `not_checkable` **on the affected field** — never as an omitted block, never as a missing member,
   never as an HTTP error. There is no "the check failed" state: the resolver is a pure, synchronous,
   total leaf with no `Result`.
3. **Exactly one branch is client-selected: the absence of `grounding` from the response.** That is a
   lookup on *presence*, not a re-derivation, and it has one production cause — a browser talking to a
   server that predates this feature. The local fallback and the stub provider both return through
   `base` and therefore **do** carry the block.
4. **One known-uncovered branch, named.** `unavailable_envelope` (`recommendation.rs:706-727`, reached
   only from the `build_bundle` failure at `:519-531`) is the one envelope not built by `base`. It emits
   no `cap_check`, no `field_reasons`, no `cited_contract` today and emits **no `grounding`**. It carries
   `"strategy": null` and renders no rec body and no figures, so nothing there can mislead. This feature
   does not attach a block to it and does not claim to close it.
5. **Ground against what was SENT.** Resolution uses `pruned_move` (`recommendation.rs:582`) and the
   `CandidateBudget::Prompt` candidate set — never `raw_move` (`:580`), never a `Handoff` set. The
   containment envelope is anchored on `StraddleMove::anchor_spot` off the type, never on
   `market_state.price` (`move_pct` is "Percent OF `anchor_spot`", `straddle_move.rs:49-50`).
6. **Fixed evaluation orders are part of the contract** — for the two headline enums **and inside each
   per-field rule**, whose branches are not mutually exclusive. First match wins, `DO NOT REORDER`,
   mirroring `CapVerdict` (`cap_check.rs:15-18`). The order is what keeps two implementations from
   disagreeing about which member, or which reason, a given rec produces.
7. **`Traced` / `Untraced`, never `Verified` / `Unverified`.** No token that can reach a human-readable
   surface may read as `verified`, which in a trading context is read as "Convexa vetted this trade".
   **No user-visible surface ever prints one of these tokens**: every surface that states a grounding
   fact renders it through the closed literal set in `SPEC.md` §4. (There is no export artifact to check
   — the rec export endpoint carries no `strategy` and no grounding block; see §4 below and `SPEC.md`
   §9 item 7.)
8. **Nothing here is live.** No field below appears on the SSE payload. Every datum is STATIC
   (chain-snapshot derived) and pinned to the snapshot the rec was produced from.
9. **Nothing here is a scoring input.** `signals.opportunity_score`, `signals.opportunity_tier` and
   `ai_eval.state_fingerprint` are byte-identical with and without every field added by this feature, on
   both bundle branches.
10. **Numbers ride the wire as numbers, rounded server-side to 2 decimals**, printed verbatim by the
    client with no arithmetic.

---

## Endpoints

### 1. `POST /api/recommendation/{ticker}` — EXISTING, extended additively · **session required** (auth outermost)

The in-app rec. **No request-body change.** The response envelope gains one `grounding` object beside
the shipped `cap_check` / `field_reasons` / `cited_contract`, one token on `cap_check`, and one key on
`field_reasons`.

**Response additions**

| Path | Type | Notes |
|---|---|---|
| `grounding` | object | always present on every `base`-built envelope (rule 2); absent only per rule 4 or from a pre-feature server |
| `grounding.card` | enum | six members, fixed order (below) |
| `grounding.counts.checked` | number | the denominator — composition stated below |
| `grounding.counts.traced` | number | entries whose `state = traced` |
| `grounding.counts.untraced` | number | entries whose `state = untraced` |
| `grounding.counts.not_checkable` | number | entries whose `state = not_checkable` **excluding** every `structurally_unchecked` one, **plus** the cited contract when its state is `right_undetermined`. Invariant: `traced + untraced + not_checkable == checked` |
| `grounding.tolerance_pct` | number | `0.1` — the payload-stated constant, emitted **once per response**, never per field, never a query knob. Applies **only** to the named-level fields, never to containment |
| `grounding.fields.exit_stop` | object | always present |
| `grounding.fields.exit_target` | object | always present |
| `grounding.fields.invalidation_level` | object | always present |
| `grounding.fields.max_risk` | object | always present |
| `grounding.fields.position_size` | object | always present |
| `grounding.fields.*.state` | enum | four members, fixed order (below) |
| `grounding.fields.*.basis` | enum \| null | `exact` · `near` · `inside_range`; non-null **iff** `state = traced`, and constrained per field (below) |
| `grounding.fields.*.anchor_kind` | enum \| null | closed anchor id (below); non-null **iff** `basis ∈ {exact, near}` |
| `grounding.fields.*.anchor_value` | number \| null | the anchor's **own** value, 2dp; non-null **iff** `basis ∈ {exact, near}` |
| `grounding.fields.*.range_low` | number \| null | 2dp; non-null **iff** `basis = inside_range` |
| `grounding.fields.*.range_high` | number \| null | 2dp; non-null **iff** `basis = inside_range` |
| `grounding.fields.*.expiration` | string \| null | the **cited** expiration the range belongs to; non-null **iff** `basis = inside_range` |
| `grounding.fields.*.not_checkable_reason` | enum \| null | four members (below); non-null **iff** `state = not_checkable` |
| `cap_check.risk_refusal` | enum \| null | `no_text` · `no_dollar_figure` · `multiple_different_figures`; non-null **iff** `cap_check.parsed_risk_dollars` is null and the risk text was examined |
| `field_reasons.invalidation_level` | object \| null | NEW key, same shape as its four siblings: `null` when the field has a value, else `{ reason, missing_input }`. Required so `Invalidation` can render through the shipped closed absence-literal set |

**Every key is always present**, `null` where the discriminator does not carry it. A client must not
select a clause shape by inspecting which of these keys are non-null — it switches on `state`, then on
`basis`, then on `not_checkable_reason`. The nullability rules above exist so a mis-wired renderer fails
a typed exhaustiveness check instead of printing the wrong sentence.

**One FE consumer beyond the card, recorded here because it reads these states:** the shared simulated
entry dialog's prefill is gated on `grounding.fields.exit_stop.state` / `.exit_target.state`
(`SPEC.md` §4). That is a read of fields already on this payload — **it adds nothing to this contract**,
and a response with no `grounding` block is treated as not-seeded rather than as permission to pre-fill.

**`grounding.fields.*.state` — closed, four members, FIXED order, first match wins**

| # | Member | Meaning |
|---|---|---|
| 1 | `not_applicable` | the field carries no value; presence-grounding does not apply |
| 2 | `not_checkable` | a value exists; the source it would resolve against did not. **We do not know** |
| 3 | `traced` | the value resolves to a number this app computed; the anchor is named and valued |
| 4 | `untraced` | the source was available and the value resolves to nothing we computed. **We checked and there is nothing** |

Collapsing 2 into 4 is forbidden: it would stamp "matches nothing we own" on a number nobody could
check — the fabricated claim `[absent-is-not-none]` (HARD) exists to prevent.

**`grounding.fields.*.not_checkable_reason` — closed, four members**

| Member | Emitted for |
|---|---|
| `structurally_unchecked` | this feature never checks this field. In v1 this is emitted for **exactly** `max_risk` and `position_size`; a test pins that set with a poison arm |
| `no_named_level` | every price anchor absent this cycle (`exit_stop`, `invalidation_level`) |
| `no_cited_expiration` | no expiration cited, so no tenor to test containment against (`exit_target`) |
| `straddle_move_unavailable` | the move is absent, its state is not `Ok`, or the cited tenor is not in the pruned move (`exit_target`) |

This is a **new** closed enum, deliberately **not** an extension of
`field_reasons::MissingInput { RiskBlock | CandidateQuotes | StraddleMove }`. The two answer different
questions — "why is this field null" versus "why could this present value not be checked" — and their
token spellings are disjoint, so a mis-wired lookup fails a typed exhaustiveness check rather than
rendering the wrong sentence. Extending `MissingInput` would add members `field_reason` can never emit,
leaving the shipped FE lookup carrying dead arms.

**`grounding.fields.*.anchor_kind` — closed, fixed order, nearest wins, ties broken by this order**

`gex_spot` · `call_wall` · `put_wall` · `peak_gex_strike` · `gamma_flip` · `max_pain` · `vwap` ·
`vwap_upper_2` · `vwap_upper_3` · `vwap_lower_2` · `vwap_lower_3`

Read off the **sent** `market_state` (`apps/api/src/routes/market.rs:156-212`) — the same eleven keys the
conformance block below pins on `GET /api/ticker/{ticker}`, so a rename on one path alone cannot pass
unnoticed. **There is no cap member and there never will be one in this set** — that is what makes the
sentence `traces to Convexa's risk cap (500)` unrenderable by construction rather than merely unwritten.
The wire carries the **token only**; its eleven display labels plus the unrecognized-token fallback are
a total client lookup tabulated once in `SPEC.md` §4 (rule 1).

**Per-field resolution, v1 — one declared rule per field, `match RecField` with no wildcard arm, branches in the order given**

| Field | Rule (evaluation order) |
|---|---|
| `exit_stop` | 1. all anchors absent ⇒ `not_checkable/no_named_level`. 2. nearest named anchor within `max(0.01, anchor × tolerance_pct/100)`: equal ⇒ `traced/exact`, else ⇒ `traced/near`. 3. otherwise ⇒ `untraced` |
| `invalidation_level` | identical rule, identical anchor set, identical order. `RecField` gains this fifth variant in v1 |
| `exit_target` | 1. **no cited expiration ⇒ `not_checkable/no_cited_expiration`** — evaluated first, because the two not-checkable branches overlap (no cited tenor usually also means no tenor in the pruned move) and the reader's actionable fact is the missing citation. 2. move absent / state ≠ `Ok` / cited tenor not in the pruned move ⇒ `not_checkable/straddle_move_unavailable`. 3. inside `[anchor_spot − move_dollars, anchor_spot + move_dollars]` ⇒ `traced/inside_range`. 4. otherwise ⇒ `untraced`. **Containment carries no tolerance at all** |
| `max_risk` | `not_applicable` (absent) / `not_checkable/structurally_unchecked` (present, any parse outcome). **No `traced` arm and no `untraced` arm in v1** |
| `position_size` | `not_applicable` / `not_checkable/structurally_unchecked`. Never parsed by any lane, on either side of the wire |

**Legal `(field, basis)` pairs — a closed relation, pinned with a poison arm** (SPEC §2.6 guard 9). All
three basis members share one wire enum, so a match-arm bug that returns another field's basis would
otherwise compile and serialize cleanly:

| Field | May emit | May never emit |
|---|---|---|
| `exit_stop` | `exact` · `near` | `inside_range` |
| `invalidation_level` | `exact` · `near` | `inside_range` |
| `exit_target` | `inside_range` | `exact` · `near` |
| `max_risk` · `position_size` | *(no basis — `basis` is always null)* | all three |

**The cited contract is derived, never duplicated.** `cited_contract.state` keeps its shipped shape and
gains no companion token. It maps `cited → traced`, `right_undetermined → not_checkable`,
`off_set → untraced`, `none → not_applicable` **for the card-level fold only**; a test asserts the
mapping is total. Its rendered surface remains the shipped `CitedContractLine` — one fact, one
statement.

**`grounding.card` — closed, six members, FIXED order, first match wins**

| # | Member | Emitted when |
|---|---|---|
| 1 | `not_applicable` | `strategy` is null, **or** `decision != "trade"`, **or** `checked == 0` |
| 2 | `local_rules` | the strategy came from `local_strategy_from_bundle` |
| 3 | `none_traced` | `checked ≥ 1`, `traced == 0`, `untraced ≥ 1` |
| 4 | `could_not_check` | `checked ≥ 1`, `traced == 0`, `untraced == 0` |
| 5 | `some_traced` | `traced ≥ 1` and `traced < checked` |
| 6 | `all_traced` | `checked ≥ 1` and `traced == checked` |

Plus **exactly one client-selected branch: `grounding` absent from the response** (rule 3).

**Member 1 preempts member 2 by design.** A local-rules rec on a snapshot with a null `gamma_flip` states
no checkable figure (its stop and invalidation both come from the flip, `recommendation.rs:780,783`), so
`checked == 0` and the card is `not_applicable` — nothing renders. `local_rules` asserts something about
*figures*; with no figures there is nothing to assert, and emitting it anyway would resurrect the
`nothing to check` member the council withdrew. Consumers must not "fix" this by reordering.

**`counts.checked` — the denominator, stated exactly.** The fields whose `state` is neither
`not_applicable` nor `not_checkable/structurally_unchecked`, **plus** the cited contract when
`cited_contract.state != "none"`. On a full model rec that is 4 — `exit_stop`, `exit_target`,
`invalidation_level`, cited contract. `max_risk` and `position_size` can never enter it, so an honest
rec can never read "2 of 5" forever. `counts.not_checkable` excludes the same two by the same rule (see
its row above), which is what keeps the sum identity true rather than exceeding `checked` by two on
every rec that states a risk figure and a size.

**`local_rules` is derived inside `base`, not from a new wire field.** The `AI_REC_LOCAL_ONLY` env read
(`recommendation.rs:673-675`) is hoisted above the `base` closure and passed in as a plain `bool`; the
grounding leaf performs no env read and stays pure. **`key_source` and `scenario` are not touched** —
`scenario` remains `null` on every path and `RecRequestBody::scenario_id` remains deserialized and never
read.

**`cap_check.risk_refusal` — the widened OUTPUT of the one `max_risk` parse**

`ParsedRisk { Dollars(f64), NotParseable(RiskRefusal) }` with
`RiskRefusal { NoText, NoDollarFigure, MultipleDifferentFigures }`, mapped against the existing tests in
`apps/api/src/services/rec_inputs/max_risk.rs`, which must all still pass unchanged:

| Token | Source arm | Example input |
|---|---|---|
| `no_text` | `None` (`:11`) | the field is absent |
| `no_dollar_figure` | `vals.len() == 0` (`:70-77`) | `"1R defined-risk"`, the bare `"300"` |
| `multiple_different_figures` | the trailing `_ =>` arm (`:43`, `:80-82`) | `"$300 to $500"` |

**The accepted input set does not move by one input.** Which inputs refuse is the ambiguity rule the
BRIEF pins as explicitly not reopened; only the *reporting* of a refusal widens. The poison test is that
changing any input's parse **outcome** reds the build. `cap_check.verdict` keeps its shipped five
members and its shipped evaluation order; `cap_check.cap_not_derivable_reason` keeps its shipped meaning
and **nothing in this feature renders off it** — it is null in exactly the state
(`verdict == not_checkable`) it would be asked to explain, because `effective_dollar_cap`
(`auth/risk.rs:60-87`) sets it only in the arm that also sets `value: None`, and a null cap
short-circuits `cap_verdict` to `no_cap` at step 2.

**Prompt change (no wire shape change).** `build_rec_prompts` (`llm.rs:137-156`) gains a directive
requiring the risk field to name **exactly one** dollar figure in `$N` form, with a percentage permitted
only as the same dollar figure. It is pinned by a source scan over the assembled system prompt and is
poison-proved (delete the directive and the build reds). **It is not observable on any export surface**
— no shipped artifact carries the rec's system prompt (GATE Z, Z2; `SPEC.md` §9 item 7), so the
assembled prompt plus the poison arm is the whole of the check.

### 1a. Verifying this endpoint's payload — the required-path list, and the named gap

This endpoint is **outside the machine-checkable block below**: the conformance runner has no
request-body support, the endpoint needs a resolvable provider key, and a run would spend the AI daily
cap. That carve-out matches the one the shipped `tradeable-rec-inputs` contract records for the same
endpoint — but a carve-out is not a verification plan, so here is the plan. Three layers, and what is
left uncovered:

- **Layer 1 — in-process, ship-blocking, always available.** The fixtures in the existing
  `#[cfg(test)] mod tests` at `recommendation.rs:839` assert on the return value of `envelope_extras`,
  the function that actually builds this JSON (`use super::*` puts the private function in scope). Every
  shape, token, order and totality claim above is asserted there, with no key and no network
  (SPEC §7 arms 1–3).
- **Layer 2 — live HTTP, reviewed, key-gated (SPEC AC-66).** At GATE Q one real response is captured to
  a committed receipt and walked against the list below: every path present, every type as documented,
  every closed token a declared member of its set. This is the only layer that observes the router,
  serde attribute drift and middleware.
- **Layer 3 — the runner block below.** Covers the two anonymous GET endpoints this feature reads from
  but does not change.
- **The named gap.** With no resolvable provider key, **layer 2 cannot run and nothing observes the live
  HTTP body** — only the in-process serialization. The receipt records the check as **not-run with that
  reason**; it is never recorded as a pass.

**Required paths for the captured response** (a produced trade verdict; the walk is mechanical):

```
status                                        string
strategy                                      object|null
cap_check.verdict                             string
cap_check.risk_refusal                        string|null
field_reasons.max_risk                        object|null
field_reasons.position_size                   object|null
field_reasons.exit_target                     object|null
field_reasons.exit_stop                       object|null
field_reasons.invalidation_level              object|null
cited_contract.state                          string
grounding.card                                string
grounding.tolerance_pct                       number
grounding.counts.checked                      number
grounding.counts.traced                       number
grounding.counts.untraced                     number
grounding.counts.not_checkable                number
grounding.fields.exit_stop.state              string
grounding.fields.exit_stop.basis              string|null
grounding.fields.exit_stop.anchor_kind        string|null
grounding.fields.exit_stop.anchor_value       number|null
grounding.fields.exit_stop.not_checkable_reason   string|null
grounding.fields.exit_target.state            string
grounding.fields.exit_target.basis            string|null
grounding.fields.exit_target.range_low        number|null
grounding.fields.exit_target.range_high       number|null
grounding.fields.exit_target.expiration       string|null
grounding.fields.exit_target.not_checkable_reason string|null
grounding.fields.invalidation_level.state     string
grounding.fields.invalidation_level.basis     string|null
grounding.fields.invalidation_level.anchor_kind   string|null
grounding.fields.invalidation_level.anchor_value  number|null
grounding.fields.invalidation_level.not_checkable_reason string|null
grounding.fields.max_risk.state               string
grounding.fields.max_risk.not_checkable_reason    string|null
grounding.fields.position_size.state          string
grounding.fields.position_size.not_checkable_reason string|null
```

Plus the three cross-checks a presence walk cannot express: `traced + untraced + not_checkable ==
checked`; every emitted `basis` legal for its field (table above); and `tolerance_pct` equal to the
constant the boundary fixtures were written against.

### 2. `GET /api/ticker/{ticker}` — EXISTING, **unchanged** · anonymous-ok · STATIC

This feature adds no field here and changes none. It is in the conformance block because the **anchor
set is read off this payload**: if a level is renamed on the bundle path only, the closed `anchor_kind`
set silently loses a member and levels stop resolving with nothing going red. The block pins the eleven
price-scale anchors, the straddle-move object the containment rule reads, and the three score-identity
fields that must stay byte-identical.

### 3. `GET /api/recommendation/status/{ticker}` — EXISTING, **unchanged** · anonymous-ok · no LLM

The app's own configuration readout. In the block because it is the observable side of "no configurable
path can serve a fabricating recommendation source": `scenarios.enabled` is hardcoded `false` and
`scenarios.catalog` hardcoded empty (`recommendation.rs:358`). This feature does not build a scenario
registry and does not enable one.

### 4. `GET /api/recommendation/export/{ticker}` — EXISTING, **unchanged** · anonymous-ok · no LLM

Carries no `strategy` and no system prompt, therefore no asserted figures and **no `grounding` block**.
Nothing is added here, and widening it was ruled out at GATE Z (Z2): it would open a new egress surface
and engage `egress-copy-tracks-payload` for no stated product need. **There is consequently no export
artifact that carries a grounding state or the prompt directive** — the criteria that assumed one were
corrected rather than satisfied by widening this endpoint (`SPEC.md` §9 item 7). Left out of the block
below because this feature makes no claim about it that a presence check could verify.

---

## Running this contract

```
npm run ports:free
npx nx serve api                      # :8000, needs a working DATA_PROVIDER key
node .claude/tools/interface_conformance.mjs \
  --contract .spire/clusters/tech/contracts/ai-rec-grounding/INTERFACE_CONTRACT.md \
  --url http://127.0.0.1:8000 \
  --report .spire/clusters/tech/contracts/ai-rec-grounding/conformance-receipt.json
```

Three operational facts, so a run does not fail for the wrong reason:

- **Endpoint order in the block is load-bearing.** The runner iterates sequentially, so
  `GET /api/ticker/{ticker}` runs first and warms the ticker's analytics snapshot; the status read then
  serves off that warm snapshot.
- **No endpoint in this block is marked `"auth": true`.** Both are anonymous reads, so no session is
  needed and `--auth-cookie` is unnecessary.
- **The block does not cover this feature's own payload.** `POST /api/recommendation/{ticker}` is
  verified by the three layers in §1a, not by this runner. A green receipt here is necessary and not
  sufficient; GATE Q also needs layer 1 green and layer 2 either walked or recorded not-run.

## Conformance spec

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/ticker/{ticker}",
      "path_params": { "ticker": "SPY" },
      "query": {},
      "required": {
        "market_state.ticker": "string",
        "market_state.gex_spot": "number",
        "market_state.call_wall": "number|null",
        "market_state.put_wall": "number|null",
        "market_state.peak_gex_strike": "number|null",
        "market_state.gamma_flip": "number|null",
        "market_state.max_pain": "number|null",
        "market_state.vwap": "number|null",
        "market_state.vwap_upper_2": "number|null",
        "market_state.vwap_upper_3": "number|null",
        "market_state.vwap_lower_2": "number|null",
        "market_state.vwap_lower_3": "number|null",
        "market_state.straddle_move": "object",
        "market_state.straddle_move.state": "string",
        "market_state.straddle_move.anchor_spot": "number|null",
        "market_state.straddle_move.anchor_basis": "string",
        "market_state.straddle_move.tenors": "array",
        "signals.opportunity_score": "number",
        "signals.opportunity_tier": "string",
        "ai_eval.state_fingerprint": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/recommendation/status/{ticker}",
      "path_params": { "ticker": "SPY" },
      "query": {},
      "required": {
        "availability.in_app_enabled": "boolean",
        "gate.state": "string",
        "cap.over_limit": "boolean",
        "cap.remaining_today": "number",
        "scenarios.enabled": "boolean",
        "scenarios.catalog": "array"
      }
    }
  ]
}
```
