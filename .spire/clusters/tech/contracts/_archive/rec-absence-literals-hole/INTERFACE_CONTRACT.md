# rec-absence-literals-hole — interface contract

**Spec:** `.spire/clusters/tech/contracts/rec-absence-literals-hole/SPEC.md` (§6 points here)
**Backend:** `apps/api` (crate `api-rust`, Axum/Tokio) over `libs/quant-engine`
**Frontend:** `apps/dashboard` (React 19 + Vite + MUI), `pages/ticker/widgets/ai-rec/` and
`features/trading/tradeEntry/`
**Status:** draft

This feature **adds backend surface**. It is **NOT** `NO_BACKEND_CHANGE`.

This file is the single FE↔BE truth. Every key spelling, every token spelling, every nullability and
every evaluation order below is authoritative **here** and is not restated in `SPEC.md`. The one thing on
the other side of the line is **copy**: the human words each token renders are owned by `SPEC.md` §4 and
are not duplicated here, because two copies of a closed lookup table is exactly how the two drift apart.

---

## Standing rules for every field below

1. **Closed vocabularies are authoritative on the wire.** The frontend renders every reason and
   missing-input token by **closed lookup on the token**. It never re-derives a literal by inspecting a
   `null`, never infers one from a sibling field, and never paints a raw model string
   (`[digested-labels-not-raw-dump]`, `[absent-is-not-none]`). The wire never carries a composed or
   free-text label.
2. **The `field_reasons` object is total and rides every `base`-built envelope.** It is hand-built with
   `json!` at exactly one site (`apps/api/src/services/recommendation.rs:478-484`), called from `base()`
   at `:664`, so it is emitted on **every produced response — including the local-rules
   (`AI_REC_LOCAL_ONLY`) branch and the early-return `Value::Null` branches.** There is no branch where
   some of the eleven keys ship and others do not.
3. **Exactly one branch is client-selected: the absence of `field_reasons` from the response.** That is a
   lookup on *presence*, not a re-derivation, and it has one production cause — a browser talking to a
   server that predates this feature. In that state all six plan fields render the never-stated literal.
   Never the missing-input literal: on a pre-feature server nothing was attempted and nothing failed.
4. **One known-uncovered branch, named.** `unavailable_envelope` (`recommendation.rs:706-727`) is the one
   envelope not built by `base`. It emits no `field_reasons` and carries `"strategy": null`, so it renders
   no rec body and no figures. This feature attaches nothing to it and claims nothing about it.
5. **The presence predicate for these six is PER-FIELD and TYPE-AWARE.** The shipped shared closure
   `present = |v| v.map(|x| !x.is_null()).unwrap_or(false)` (`recommendation.rs:470`) is null-only and
   **must not** be reused here: under it `""`, `[]` and `"moderate"` all read *present*, the wire carries
   `null`, and the browser's shipped fallthrough renders the missing-input literal over a field nobody
   ever named. That is the defect this feature exists to close, reproduced one layer up by the fix.
6. **Fixed evaluation orders are part of the contract.** First match wins, `DO NOT REORDER`. This is what
   stops two implementations disagreeing about which reason a given rec produces.
7. **Nothing here is live.** No field below appears on the SSE payload. Every datum is STATIC, pinned to
   the snapshot the rec was generated from.
8. **Nothing here is a scoring input.** `signals.opportunity_score`, `signals.opportunity_tier` and
   `ai_eval.state_fingerprint` are byte-identical with and without every field added by this feature, and
   are served on a **different endpoint** that gains zero new bytes.
9. **`grounding` is untouched.** No field of the six enters `grounding.counts`; no `GroundingField`,
   anchor kind, tolerance or state is added for any of them. The shipped guard
   `the_denominator_excludes_the_dollar_risk_figure_and_the_suggested_size` (`grounding.rs:613-615`)
   passes **UNEDITED**.

---

## Endpoints

### 1. `POST /api/recommendation/{ticker}` — EXISTING, extended additively · **session required** (auth outermost)

The in-app rec. **No request-body change.** The response envelope's shipped `field_reasons` object gains
**six keys**; two closed enums gain **one member each**. No new endpoint, no new response block, no new
wire type.

**Response additions**

| Path | Type | Notes |
|---|---|---|
| `field_reasons.structure` | object \| null | NEW. `null` when the field carries a value, else `{ reason, missing_input }` |
| `field_reasons.strikes` | object \| null | NEW. Same shape |
| `field_reasons.expiration` | object \| null | NEW. Same shape |
| `field_reasons.entry_trigger` | object \| null | NEW. Same shape |
| `field_reasons.time_horizon` | object \| null | NEW. Same shape |
| `field_reasons.confidence` | object \| null | NEW. Same shape |
| `field_reasons.*.reason` | enum | **gains a third member** — `not_given` · `unavailable` · `unrecognized_value` |
| `field_reasons.*.missing_input` | enum \| null | **gains a fourth member** — `risk_block` · `candidate_quotes` · `straddle_move` · `candidate_set`; non-null **iff** `reason == "unavailable"` |
| `strategy.time_horizon` | string \| null | **CHANGED**: the input-independent constant `"1–5 sessions"` at `recommendation.rs:829` is deleted; the assembler emits `null` when nothing computed a horizon |

**The object carries EXACTLY ELEVEN keys, with exactly these spellings.** Five shipped —
`max_risk`, `position_size`, `exit_target`, `exit_stop`, `invalidation_level` — plus the six above. The
keys are hand-built with `json!`, **not** serde-derived, so nothing pins them today: a typo'd key is
invisible on both sides (the FE reads `undefined` and renders an absence literal) and would be wrong on
every field at once. A route-level test pins the set and the spellings.

**The FE mirror** in `libs/api/src/lib/convexa.ts`: `FieldReasons` (`:1545-1553`) gains the six keys as
optional (`?:`) `FieldReason | null`; the `reason` union (`:1541`) gains `'unrecognized_value'`; the
`MissingInput` union (`:1536`) gains `'candidate_set'`.

**Backend shape.** `apps/api/src/services/rec_inputs/field_reasons.rs` keeps `RecField` at **exactly
five** members and gains a **disjoint** `RecPlanField` at **exactly six**
(`Structure`, `Strikes`, `Expiration`, `EntryTrigger`, `TimeHorizon`, `Confidence`) plus
`plan_field_reason(field, value_present, presence) -> Option<FieldReason>`, returning the **shipped**
`FieldReason { reason, missing_input }` struct unchanged. `RecField` is **not** widened: it is a shared
key across two consumers and `resolve_field(field: RecField, asserted: Option<f64>, …)`
(`grounding.rs:230`) is an exhaustive `match` over an `Option<f64>` that none of these six can inhabit.
A tally test pins 5 and 6 so a later hand cannot merge them.

**`value_present` — per field, on the parsed `strategy: Value`**

| Key | `value_present` when | Declared dependency | Reason when absent |
|---|---|---|---|
| `structure` | non-null **and** a trimmed-non-empty string | none | `not_given` |
| `strikes` | non-null array containing **≥1 finite number** | candidate set | `unavailable` + `candidate_set` when the dependency is declared and unmet, else `not_given` |
| `expiration` | non-null **and** a trimmed-non-empty string | candidate set | as `strikes` |
| `entry_trigger` | non-null **and** a trimmed-non-empty string | none | `not_given` |
| `time_horizon` | non-null **and** a trimmed-non-empty string | none | `not_given` |
| `confidence` | non-null **and** a member of `{low, medium, high}` | none | ordered rule below |

**`confidence` — FIXED ORDER, first match wins, DO NOT REORDER**

| # | Condition | Emits |
|---|---|---|
| 1 | null, or a trimmed-empty string | `reason: "not_given"` |
| 2 | a member of `{low, medium, high}` | `None` (the key is `null`; the value renders) |
| 3 | any other non-empty string | `reason: "unrecognized_value"` |

Arm 3 is the **only** construction site of `unrecognized_value` in the codebase — the
`RecPlanField::Confidence` arm of `plan_field_reason`. It is forbidden on the shipped five by a test over
`field_reason` (`field_reasons.rs:42-63`), which has no such arm. Reporting an off-scale answer via
`value_present = false` is **forbidden**: it routes *"it answered, off our scale"* into *"it never
answered"*. Its only live producer is the LLM path (`llm.rs:423` passes `confidence` through
unvalidated; the prompt at `llm.rs:146` asks for `low|medium|high|null`), so it is **unreachable on the
local-rules path** and needs a unit fixture, not the rules-path card.

**`missing_input: "candidate_set"` — the new member, and its exact truth condition**

`candidate_set` means **the candidate set the assembler inserted was EMPTY**. Predicate:
`!set.contracts().is_empty()` off the shipped accessor `CandidateSet::contracts()`
(`candidates.rs:181-183`) — **no new `quant_engine` API**, which keeps the empty-diff-under-
`libs/quant-engine/` commitment structural.

It is **not** `candidate_quotes`. That flag is `set.has_quoted_contract()` (`recommendation.rs:460` →
`candidates.rs:190-192`), i.e. *some contract carries a two-sided quote* — strictly stronger than *the
read had contracts to name*. A set of forty unquoted contracts would set `candidate_quotes = false` and
render *an input failed* when *never named* is the truth.

**The truth condition `unavailable` must satisfy, and the mechanism that enforces it.** The literal may
render **only when this producer needed a specific Convexa-supplied input for this field on this cycle
and that input was absent** — nothing weaker. On the local-rules path the producer needed no candidate
set at all (`strikes: []` and `expiration: null` are unconditional at `recommendation.rs:822-823`), so
those two must emit `not_given` there **even if the set happens to be empty**. Mechanism:
`PlanInputPresence { candidate_set: Option<bool> }`, where `None` = *this producer declared no dependency
on the candidate set* (the local-rules branch), and `unavailable` is emitted **only** from `Some(false)`.
`[absent-is-not-none]` is applied to the flag itself, not just to the field.

**Consequently `unavailable` is reachable on `strikes` and `expiration` only** — the other four declare no
dependency and can only ever emit `not_given` (or, for `confidence`, `unrecognized_value`). And
`missing_input: "risk_block"` is **structurally unreachable** on all six: none of them depends on owner
input.

**Client-side fallthrough (the FE half of rule 3), stated here because it is a contract, not a style
choice.** The shipped `fieldLiteral` (`literals.ts:55-63`) falls through to the missing-input literal at
`:62` and **must not change** — five shipped fields and `literals.spec.ts` depend on it. The six take a
**sibling selector** in the same file that shares the shipped value arms (`:57-59`) and the
`no_trade`-first short-circuit (`:55`) and differs in exactly two ways: its final fallthrough is the
**never-stated** literal, and it carries an **explicit arm for `unrecognized_value`**. Without that
explicit arm the third token falls through to the never-stated default and the distinction the wire just
bought is destroyed inside the fix. One test pins both selectors' defaults; one test pins the
`unrecognized_value` arm.

**What does NOT change on this endpoint:** the request body · `ai_eval` · cooldown · daily cap ·
`cited_contract` · the candidate set · `cap_check` · the whole `grounding` block · the prompt and the
output schema (the model is never asked *why* it omitted a field — `field_reasons.rs:34`: *"What the
ASSEMBLER actually inserted — never a question put to the model."*).

### 1a. Verifying this endpoint's payload — the plan, and the named gap

This endpoint is **outside the machine-checkable block below**, and the carve-out is the same one the
shipped `ai-rec-grounding` and `tradeable-rec-inputs` contracts record for it: the conformance runner has
no request-body support, the endpoint is session-gated, it requires resolvable key material, and a run
consumes a daily-cap unit. A carve-out is not a verification plan, so here is the plan.

- **Layer 1 — in-process, ship-blocking, always available.** The fixtures in the existing
  `#[cfg(test)] mod tests` at `recommendation.rs:839` assert on the return value of `envelope_extras`,
  the function that builds this JSON. Every key, spelling, token, order and totality claim above is
  asserted there, with no key and no network.
- **Layer 2 — live HTTP, reviewed, key-gated.** At GATE Q one real response is captured to a committed
  receipt and walked against the path list below: every path present, every type as documented, every
  closed token a declared member of its set. This is the only layer that observes the router, serde
  attribute drift and middleware.
- **Layer 3 — the runner block below.** Covers the two anonymous GET endpoints this feature reads from
  and does not change.
- **The named gap.** With no resolvable key material, layer 2 cannot run and **nothing observes the live
  HTTP body** — only the in-process serialization. The receipt records the check as **not-run with that
  reason**; it is never recorded as a pass.

**A correction every lane must carry: the `AI_REC_LOCAL_ONLY` fixture is NOT free.**
`recommendation.rs:704` returns the `unavailable` envelope **before** the `local_only` branch unless
`resolved.usable()` (`llm.rs:114-116`, which requires `key_material.is_some() && key_source != "none"`),
and `commit_query()` (`:742`) runs on that path too, incrementing the daily count and arming the
cooldown (`:274-283`). The fixture **spends no provider money and makes no provider call, but it does
require configured key material and does consume one in-process cap unit**, and the `no_fresh_edge` gate
(`:710`) and the cooldown (`:716`) short-circuit ahead of it. No criterion may describe it as free.

**Required paths for the captured response** (a produced trade verdict; the walk is mechanical):

```
status                                        string
strategy                                      object|null
strategy.time_horizon                         string|null
field_reasons.max_risk                        object|null
field_reasons.position_size                   object|null
field_reasons.exit_target                     object|null
field_reasons.exit_stop                       object|null
field_reasons.invalidation_level              object|null
field_reasons.structure                       object|null
field_reasons.strikes                         object|null
field_reasons.expiration                      object|null
field_reasons.entry_trigger                   object|null
field_reasons.time_horizon                    object|null
field_reasons.confidence                      object|null
grounding.card                                string
grounding.counts.checked                      number
grounding.counts.traced                       number
grounding.counts.untraced                     number
grounding.counts.not_checkable                number
cited_contract.state                          string
cap_check.verdict                             string
```

Plus the cross-checks a presence walk cannot express:

1. `field_reasons` has **exactly eleven** keys, with exactly the spellings above.
2. Every non-null `field_reasons.*.reason` is a member of
   `{not_given, unavailable, unrecognized_value}`, and `unrecognized_value` appears on **`confidence` and
   nowhere else**.
3. Every non-null `field_reasons.*.missing_input` is a member of
   `{risk_block, candidate_quotes, straddle_move, candidate_set}`, is non-null **iff**
   `reason == "unavailable"`, and `candidate_set` appears on **`strikes` / `expiration` only**.
4. On a response whose `grounding.card == "local_rules"`, no `field_reasons.*.reason` equals
   `"unavailable"` on any of the six.
5. `grounding.counts` is identical to the pre-feature baseline captured on the same request shape.

### 2. `GET /api/ticker/{ticker}` — EXISTING, **unchanged** · anonymous-ok · STATIC

This feature adds no field here and changes none. It is in the runner block because it carries the three
score-identity fields that `[additive-keeps-score-byte-identical]` pins: a change to them is the loudest
possible signal that this feature reached somewhere it must not. `market_state.ticker` is pinned as the
cheap shape anchor.

### 3. `GET /api/recommendation/status/{ticker}` — EXISTING, **unchanged** · anonymous-ok · no LLM

The rec surface's own configuration readout, and the observable side of the gated / no-key / cap states
the card renders without any absence literal from this feature. Nothing is added here.

### 4. `GET /api/recommendation/export/{ticker}` — EXISTING, **unchanged** · anonymous-ok

Carries no `strategy` and therefore no `field_reasons`. **Widening it is out of scope** (ruled out under
`egress-copy-tracks-payload` at `ai-rec-grounding` GATE Z, Z2). Left out of the block below because this
feature makes no claim about it a presence check could verify.

---

## Running this contract

```
npm run ports:free
npx nx serve api                      # :8000, needs a working DATA_PROVIDER key
node .claude/tools/interface_conformance.mjs \
  --contract .spire/clusters/tech/contracts/rec-absence-literals-hole/INTERFACE_CONTRACT.md \
  --url http://127.0.0.1:8000 \
  --report .spire/clusters/tech/contracts/rec-absence-literals-hole/conformance-receipt.json
```

Three operational facts, so a run does not fail for the wrong reason:

- **Endpoint order in the block is load-bearing.** The runner iterates sequentially, so
  `GET /api/ticker/{ticker}` runs first and warms the ticker's analytics snapshot; the status read then
  serves off that warm snapshot.
- **No endpoint in this block is marked `"auth": true`.** Both are anonymous reads, so no session is
  needed and `--auth-cookie` is unnecessary.
- **The block does not cover this feature's own payload.** `POST /api/recommendation/{ticker}` is
  verified by the three layers in §1a. A green receipt here is necessary and **not sufficient**: GATE Q
  also needs layer 1 green and layer 2 either walked or recorded not-run with its reason.

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
        "cap.remaining_today": "number"
      }
    }
  ]
}
```
