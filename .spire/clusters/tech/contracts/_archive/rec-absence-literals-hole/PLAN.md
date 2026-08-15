# rec-absence-literals-hole — implementation plan

**Spec:** `.spire/clusters/tech/contracts/rec-absence-literals-hole/SPEC.md` (approved; not editable here)
**Interface:** `.spire/clusters/tech/contracts/rec-absence-literals-hole/INTERFACE_CONTRACT.md` (not editable here)
**Method:** `.claude/plan/PLAN_METHOD.md`
**Tracks:** Backend (B0–B7) · Frontend (F0–F17) · Verification (V1–V10). B and F are independently
executable in parallel; they share **zero files**.

---

## 0. Goal, shape, stack

**Goal.** Make *"nobody named this field"* visibly different from *"no entry, so there is nothing to
size"* on the six AI-rec plan/conviction slots, and stop an unnamed field from arriving at the
simulated entry surface as a pre-typed, one-confirm-submittable value.

**Shape.** Three moving parts. (1) The Rust assembler gains six keys on the shipped `field_reasons`
object, computed by a **sibling** enum + function in `rec_inputs/field_reasons.rs` (`RecField` stays at
five; `RecPlanField` is new at six) and emitted from the one `json!` site that rides every `base()`
envelope. (2) The browser gains a **sibling selector** in `literals.ts` (`planFieldLiteral`) whose
fallthrough is `not_given` (never `unavailable`) and which carries an explicit `unrecognized_value`
arm; the six render sites stop taking a `React.ReactNode` and start taking a `PlanFieldLiteral`, which
is what turns a bare `?? '—'` into a **type error**. (3) The one shared simulated entry dialog's
prefill seam carries `null` for "never named", the draft carries the file's existing `''` sentinel, and
the submit predicate grows one conjunct so an unstated direction cannot be confirmed.

**Stack.** Rust (Axum/Tokio, crate `api-rust`) + `serde_json`; TypeScript/React 19 + MUI 9 + Vite;
Vitest + Testing Library; Nx 23. Backend tests are `cargo test -p api-rust`; frontend tests are
`nx test @convexa/dashboard`; types are `nx typecheck` (a green `nx test` does **not** typecheck).

**Four things every lane carries.**

1. **Poison or it isn't a guard.** `[structural-over-prose-enforcement]`: for every guard this plan
   adds, the task is *write it, poison it, watch the build go red, restore the source
   byte-identically, watch it go green* — and record the poison + observed failure in the task's
   commit message. A guard with no demonstrated red is not done (§7).
2. **`[lane-check]` is a scheduled task, not a fact.** Every one is a named task below (B0.2, F0.3,
   F0.4, F0.5). Do not upgrade one to settled by assertion; if a check fails, the task says what to do,
   and if that is not enough, **stop and report** rather than adapt the design.
3. **Never loosen a guard to make it pass.** Precedent: `ai-rec-grounding`'s CRLF episode, where the
   tempting fix satisfied the guard's NAME and destroyed its BEHAVIOUR. If a shipped guard reds, the
   default is *the change is wrong*, not *the guard is wrong*.
4. **Exit codes, not printed summaries.** A suite in this repo once printed `1004 passed` while
   exiting non-zero. Check `$LASTEXITCODE` (PowerShell) / `$?` (bash) after every command.

**One base commit, recorded once.** Both lanes capture the pre-work commit before their first edit:

```powershell
git rev-parse HEAD          # record as BASE in the lane notes; every empty-diff check uses it
```

Every `git diff` below is written against `$BASE`, **never against `main`** — a lane that commits onto
`main` would make a `git diff main` check silently empty, i.e. a false green on a ship-blocking row.

---

## 1. Global Constraints

### 1.1 Conformance spec (copied VERBATIM from `INTERFACE_CONTRACT.md` — GATE PLAN law)

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

Both lanes inherit this shape. Neither endpoint above changes; they are in the block because they
carry the score-identity fields (`[additive-keeps-score-byte-identical]`) and the gated-state readout.
**This block does not cover this feature's own payload** — `POST /api/recommendation/{ticker}` is
verified by the three layers of INTERFACE_CONTRACT §1a (see V4). A green receipt here is necessary and
not sufficient.

### 1.2 Wire truth (authoritative in INTERFACE_CONTRACT §1 — restated only as constraints)

- `field_reasons` carries **exactly eleven** keys: `max_risk`, `position_size`, `exit_target`,
  `exit_stop`, `invalidation_level`, `structure`, `strikes`, `expiration`, `entry_trigger`,
  `time_horizon`, `confidence`.
- `reason` ∈ `{not_given, unavailable, unrecognized_value}`; `missing_input` ∈
  `{risk_block, candidate_quotes, straddle_move, candidate_set}`, non-null **iff**
  `reason == "unavailable"`.
- `unrecognized_value` has **exactly one construction site**: the `RecPlanField::Confidence` arm of
  `plan_field_reason`.
- `candidate_set` is reachable on `strikes` / `expiration` only, and **only** from
  `PlanInputPresence.candidate_set == Some(false)`. `None` (= the producer declared no dependency, i.e.
  the local-rules branch) can never yield `unavailable`.
- The shipped null-only closure `present = |v| v.map(|x| !x.is_null()).unwrap_or(false)`
  (`recommendation.rs:470`) **must not** be reused for the six. Per-field, type-aware predicates only.
- `strategy.time_horizon` may now be `null` (the `"1–5 sessions"` constant is deleted).
- Evaluation orders are contract, `DO NOT REORDER`.
- `grounding` is untouched, byte-identical. `RecField` stays at five.

### 1.3 Path allow-list (SPEC §2.6 — supersedes the BRIEF's)

| Tree | Files |
|---|---|
| Backend | `apps/api/src/services/rec_inputs/field_reasons.rs` · `apps/api/src/services/recommendation.rs` |
| Shared types | `libs/api/src/lib/convexa.ts` |
| FE — ai-rec | `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/**` (`literals.ts`, `copy.ts`, `AiRecPanel.tsx`, `prefill.ts`, `fixtures.ts`, the guard specs). `reasoning.tsx` needs **no** change (§2.3); if a lane concludes otherwise that is a **deviation to state, not absorb**. |
| FE — Accept flow | `apps/dashboard/src/app/pages/ticker/useTickerTradeFlows.ts` |
| FE — shared entry dialog | `apps/dashboard/src/app/features/trading/tradeEntry/TradeEntryDialogView.tsx` · `apps/dashboard/src/app/features/trading/tradeEntry/types.ts`. `LegFields.tsx` is **read, not edited** (a cast is the only permitted edit, per F0.4). |
| Canon | `.spire/clusters/tech/context/DESIGN_SYSTEM.md` `## Amendments` (V8, at approval only) |

**Empty diff required** under `libs/quant-engine/` and every signals / scoring / SSE module (AC-36).
Anything outside this table is a stop-and-report, not a judgement call.

### 1.4 Plan-level resolutions (decisions this plan makes where the spec constrains but does not spell)

Recorded here so a reviewer can probe them, and so no lane "discovers" them differently.

- **R-1 — `plan_field_reason`'s second parameter is a three-member enum, not a `bool`.** The contract
  pins the signature `plan_field_reason(field, value_present, presence) -> Option<FieldReason>` **and**
  pins the confidence order whose arm 3 (*stated but off Convexa's scale* → `unrecognized_value`) must
  live inside that function's `Confidence` arm. A `bool` cannot distinguish arm 1 from arm 3, so
  `value_present` is typed `PlanValue { Present, Absent, OffScale }`. Arity, order, parameter name and
  return type are unchanged; the single-emit-site property is preserved and tested (B1).
- **R-2 — the `unrecognized_value` arm is evaluated BEFORE the shared value arms.** AC-24 requires the
  raw off-scale string never reach the chip or the DOM; the shipped value arm would render it as a
  value. §2.3 mandates an explicit arm but does not pin its position — before the value arms is the
  only position that satisfies AC-24. Pinned by test (F3).
- **R-3 — the FE `unavailable` arm keys on the token PAIR** (`reason === 'unavailable' &&
  missing_input === 'candidate_set'`). AC-25 is worded as *"only from an explicit
  `missing_input: candidate_set`"*; keying on the pair makes that literally true and keeps a degraded
  server from ever routing `risk_block` onto a field that cannot depend on owner input (AC-23). Still
  a closed lookup on wire tokens only — no field inference, no null test.
- **R-4 — the five inline plan labels are hoisted into `copy.ts`.** §7 Layer 2 calls this
  *"recommended, not required"*; this plan requires it, because the standing line's `{labels}` (§4),
  the render sites and the Layer-2 guard's enumeration must be one constant or they drift.
- **R-5 — the `no_trade` hero conviction slot is anchored by `data-testid`, not label text.** It has
  no label (the chip label *is* the text). Every other enumerated slot stays label-anchored per §7
  Layer 2. `data-testid` is already carved out of the shipped banned-word scan (`MACHINERY_ATTR`).
- **R-6 — the entry-surface reason for unseeded contract fields is ONE line in the View**, not three
  lines beside three inputs, because those three inputs live in `LegFields.tsx`, which §2.6 pins as
  read-not-edited. It reuses the shipped withheld-reason seam shape (a closed-set string built in
  `prefill.ts`, carried verbatim, never re-spelled in the dialog).
- **R-7 — the exact wording of that reason line is plan-authored** (§4 constrains it — *states only
  that the read did not give the field, names no cause* — but does not spell it). Pinned in F2 as
  `Not pre-filled — the read named no {labels}.`, following the shipped `PREFILL_WITHHELD` idiom.
  **Flag for UX review at GATE Q** (AC-12d is a `review` row).

---

## Track B — backend (`apps/api`)

Owner: backend lane. Touches two files. No FE dependency; do not wait on Track F.

### B0 — pre-flight: baseline + lane-checks

**B0.1 Baseline.** Run and record, before touching anything:

```powershell
git rev-parse HEAD                                     # record as BASE
cargo check -p api-rust --features postgres ; $LASTEXITCODE
cargo test -p api-rust -p quant-engine ; $LASTEXITCODE
```

Expected: both exit `0`. Record BASE and the test count printed by `cargo test` (the
`test result: ok. N passed` lines for the `api-rust` and `quant-engine` targets) in the lane notes —
every later task states its expected delta against this N, and every empty-diff check uses BASE.

**B0.2 `[lane-check]` — none of the six is reachable through `resolve_field`.** Read
`apps/api/src/services/rec_inputs/grounding.rs` around `fn resolve_field` and confirm it still
`match`es exhaustively over `RecField` with no wildcard. Confirm the two guards named in §2.1
(`grounding.rs:519`, `:559`) still exist and still red when the `RecField` set changes.
**If a wildcard arm exists**, the "widening `RecField` would file a present structure as absent"
argument still holds (the six carry no `f64`), but say so in the lane report — do not silently rely on
a property you did not observe.

**B0.3 Grounding baseline for AC-31.** Run the shipped guard alone and record its result verbatim:

```powershell
cargo test -p api-rust the_denominator_excludes_the_dollar_risk_figure_and_the_suggested_size ; $LASTEXITCODE
```

Expected: `1 passed`, exit `0`. This exact command must produce the exact same output at V3 **with the
test file unedited** (`git diff --exit-code apps/api/src/services/rec_inputs/grounding.rs`).

*Reviewer should probe:* that BASE and N are recorded, not remembered.

---

### B1 — the sibling enum, the new tokens and `plan_field_reason`

**File:** `apps/api/src/services/rec_inputs/field_reasons.rs` (only).

**Step 1 — write the failing tests.** Append inside the existing `mod tests`:

```rust
    // ---- rec-absence-literals-hole ------------------------------------------------------------

    fn no_dep() -> PlanInputPresence {
        PlanInputPresence { candidate_set: None }
    }

    #[test]
    fn the_two_field_enums_stay_disjoint_at_five_and_six() {
        // A tally, not a spelling test: merging the two enums is the failure this pins (AC-32).
        const REC_FIELDS: [RecField; 5] = [
            RecField::MaxRisk,
            RecField::PositionSize,
            RecField::ExitTarget,
            RecField::ExitStop,
            RecField::InvalidationLevel,
        ];
        const PLAN_FIELDS: [RecPlanField; 6] = [
            RecPlanField::Structure,
            RecPlanField::Strikes,
            RecPlanField::Expiration,
            RecPlanField::EntryTrigger,
            RecPlanField::TimeHorizon,
            RecPlanField::Confidence,
        ];
        assert_eq!(REC_FIELDS.len(), 5);
        assert_eq!(PLAN_FIELDS.len(), 6);
    }

    #[test]
    fn a_stated_plan_value_has_no_reason() {
        for f in [RecPlanField::Structure, RecPlanField::Strikes, RecPlanField::Confidence] {
            assert!(plan_field_reason(f, PlanValue::Present, no_dep()).is_none(), "{f:?}");
        }
    }

    #[test]
    fn a_field_with_no_declared_dependency_is_always_not_given() {
        for f in [
            RecPlanField::Structure,
            RecPlanField::EntryTrigger,
            RecPlanField::TimeHorizon,
        ] {
            let r = plan_field_reason(f, PlanValue::Absent, PlanInputPresence { candidate_set: Some(false) })
                .unwrap();
            assert_eq!(r.reason, ReasonKind::NotGiven, "{f:?}");
            assert!(r.missing_input.is_none(), "{f:?}");
        }
    }

    #[test]
    fn strikes_and_expiration_are_unavailable_only_when_the_declared_set_is_empty() {
        for f in [RecPlanField::Strikes, RecPlanField::Expiration] {
            // declared and unmet -> unavailable + candidate_set
            let r = plan_field_reason(f, PlanValue::Absent, PlanInputPresence { candidate_set: Some(false) })
                .unwrap();
            assert_eq!(r.reason, ReasonKind::Unavailable, "{f:?}");
            assert_eq!(r.missing_input, Some(MissingInput::CandidateSet), "{f:?}");
            // declared and met -> not_given
            let r = plan_field_reason(f, PlanValue::Absent, PlanInputPresence { candidate_set: Some(true) })
                .unwrap();
            assert_eq!(r.reason, ReasonKind::NotGiven, "{f:?}");
            // NOT declared (the local-rules branch) -> not_given, even though nothing was named
            let r = plan_field_reason(f, PlanValue::Absent, no_dep()).unwrap();
            assert_eq!(r.reason, ReasonKind::NotGiven, "{f:?}");
            assert!(r.missing_input.is_none(), "{f:?}");
        }
    }

    #[test]
    fn confidence_follows_its_fixed_order_and_never_collapses_off_scale_into_never_answered() {
        let absent = plan_field_reason(RecPlanField::Confidence, PlanValue::Absent, no_dep()).unwrap();
        assert_eq!(absent.reason, ReasonKind::NotGiven);
        assert!(plan_field_reason(RecPlanField::Confidence, PlanValue::Present, no_dep()).is_none());
        let off = plan_field_reason(RecPlanField::Confidence, PlanValue::OffScale, no_dep()).unwrap();
        assert_eq!(off.reason, ReasonKind::UnrecognizedValue);
        assert!(off.missing_input.is_none());
    }

    #[test]
    fn unrecognized_value_is_unconstructable_from_any_other_field() {
        // The single-emit-site invariant, stated as a property over BOTH functions.
        for f in [
            RecPlanField::Structure,
            RecPlanField::Strikes,
            RecPlanField::Expiration,
            RecPlanField::EntryTrigger,
            RecPlanField::TimeHorizon,
        ] {
            for v in [PlanValue::Absent, PlanValue::OffScale] {
                let r = plan_field_reason(f, v, PlanInputPresence { candidate_set: Some(true) });
                assert_ne!(
                    r.map(|x| x.reason),
                    Some(ReasonKind::UnrecognizedValue),
                    "{f:?} must never emit unrecognized_value"
                );
            }
        }
        // The shipped five-field function has no such arm at all.
        let p = InputPresence { risk_block: false, candidate_quotes: false, straddle_move: false };
        for f in [
            RecField::MaxRisk,
            RecField::PositionSize,
            RecField::ExitTarget,
            RecField::ExitStop,
            RecField::InvalidationLevel,
        ] {
            for present in [true, false] {
                let r = field_reason(f, present, p);
                assert_ne!(r.map(|x| x.reason), Some(ReasonKind::UnrecognizedValue), "{f:?}");
            }
        }
    }

    #[test]
    fn missing_input_is_non_null_iff_the_reason_is_unavailable() {
        let cases = [
            plan_field_reason(RecPlanField::Strikes, PlanValue::Absent, PlanInputPresence { candidate_set: Some(false) }),
            plan_field_reason(RecPlanField::Strikes, PlanValue::Absent, no_dep()),
            plan_field_reason(RecPlanField::Confidence, PlanValue::OffScale, no_dep()),
        ];
        for c in cases.into_iter().flatten() {
            assert_eq!(c.missing_input.is_some(), c.reason == ReasonKind::Unavailable);
        }
    }
```

Run: `cargo test -p api-rust field_reasons` → **expected: does not compile** (`RecPlanField`,
`PlanValue`, `PlanInputPresence`, `plan_field_reason`, `ReasonKind::UnrecognizedValue`,
`MissingInput::CandidateSet` are all undefined). That is the failing state.

**Step 2 — implement.** In the same file: add `UnrecognizedValue` to `ReasonKind` (after
`Unavailable`), add `CandidateSet` to `MissingInput` (after `StraddleMove`), and append after
`field_reason`:

```rust
/// The SIX plan/conviction fields. A **separate** enum from `RecField` on purpose: `RecField` is a
/// shared key whose other consumer (`grounding::resolve_field`) is an exhaustive match over an
/// `Option<f64>` that none of these six can inhabit. Merging them would file a present structure as
/// absent and would move the user-visible `n of m` pair. Pinned at 6 by a tally test.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RecPlanField {
    Structure,
    Strikes,
    Expiration,
    EntryTrigger,
    TimeHorizon,
    Confidence,
}

/// What the assembler found in the slot. THREE members, not a bool: `Absent` and `OffScale` are
/// different facts (`[absent-is-not-none]`) — "it never answered" versus "it answered off our
/// scale" — and collapsing them is the defect this feature exists to close, one layer up.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlanValue {
    Present,
    Absent,
    /// Reachable on `Confidence` only (INTERFACE_CONTRACT §1, confidence arm 3).
    OffScale,
}

/// The dependency DECLARATION, with `[absent-is-not-none]` applied to the flag itself:
/// `None` = this producer declared no dependency on the candidate set (the local-rules branch);
/// `Some(false)` = it declared one and the set was empty; `Some(true)` = declared and met.
/// `unavailable` is emitted from `Some(false)` and from nowhere else.
#[derive(Debug, Clone, Copy)]
pub struct PlanInputPresence {
    pub candidate_set: Option<bool>,
}

/// Sibling of `field_reason` for the six. Returns the SHIPPED `FieldReason` struct unchanged.
pub fn plan_field_reason(
    field: RecPlanField,
    value_present: PlanValue,
    presence: PlanInputPresence,
) -> Option<FieldReason> {
    if value_present == PlanValue::Present {
        return None;
    }
    let not_given = FieldReason { reason: ReasonKind::NotGiven, missing_input: None };
    Some(match field {
        // THE ONLY construction site of `unrecognized_value` in the codebase. An `OffScale` handed to
        // any other arm falls to `not_given` — it cannot mint a second emit site.
        RecPlanField::Confidence => match value_present {
            PlanValue::OffScale => {
                FieldReason { reason: ReasonKind::UnrecognizedValue, missing_input: None }
            }
            _ => not_given,
        },
        // The two fields that declare a candidate-set dependency. `None` = no dependency declared,
        // so an empty set says nothing about them and the honest answer stays `not_given`.
        RecPlanField::Strikes | RecPlanField::Expiration => match presence.candidate_set {
            Some(false) => FieldReason {
                reason: ReasonKind::Unavailable,
                missing_input: Some(MissingInput::CandidateSet),
            },
            _ => not_given,
        },
        // No declared dependency: `unavailable` is structurally unreachable on these three.
        RecPlanField::Structure | RecPlanField::EntryTrigger | RecPlanField::TimeHorizon => not_given,
    })
}
```

Run: `cargo test -p api-rust field_reasons` → **expected: all green**, delta `+7` tests over B0.1.

**Step 3 — commit.** `feat(api): add RecPlanField + plan_field_reason for the six plan fields`

*Reviewer should probe:* that `RecField` gained no member; that `Some(true)` and `None` produce the
same token by two different code paths on purpose; that `OffScale` on a non-confidence field is tested,
not merely commented.

---

### B2 — the per-field, type-aware `value_present` predicates

**File:** `apps/api/src/services/rec_inputs/field_reasons.rs`.

The shipped null-only closure must not be reused (§2.2). The predicate reads the parsed
`strategy: Value`, so it lives beside the enum it keys on and is unit-testable without the assembler.

**Step 1 — failing tests** (append to `mod tests`):

```rust
    #[test]
    fn empty_string_empty_array_and_off_scale_are_all_absent_never_present() {
        use serde_json::json;
        let s = json!({
            "structure": "",
            "strikes": [],
            "expiration": "   ",
            "entry_trigger": null,
            "time_horizon": "",
            "confidence": "moderate",
        });
        assert_eq!(plan_value(RecPlanField::Structure, &s), PlanValue::Absent);
        assert_eq!(plan_value(RecPlanField::Strikes, &s), PlanValue::Absent);
        assert_eq!(plan_value(RecPlanField::Expiration, &s), PlanValue::Absent);
        assert_eq!(plan_value(RecPlanField::EntryTrigger, &s), PlanValue::Absent);
        assert_eq!(plan_value(RecPlanField::TimeHorizon, &s), PlanValue::Absent);
        // "moderate" is STATED and off-scale — never `Absent`, never `Present`.
        assert_eq!(plan_value(RecPlanField::Confidence, &s), PlanValue::OffScale);
    }

    #[test]
    fn the_hazard_row_none_of_the_empties_can_produce_unavailable_with_a_declared_empty_set() {
        use serde_json::json;
        // §2.2's ship-blocking hazard: reusing the null-only closure would make all of these read
        // `present`, the wire would carry `null`, and the browser would render `unavailable` over a
        // field nobody ever named.
        let s = json!({ "structure": "", "strikes": [], "expiration": "", "confidence": "moderate" });
        let declared_empty = PlanInputPresence { candidate_set: Some(false) };
        for f in [RecPlanField::Structure, RecPlanField::Confidence] {
            let r = plan_field_reason(f, plan_value(f, &s), declared_empty).unwrap();
            assert_ne!(r.reason, ReasonKind::Unavailable, "{f:?}");
        }
    }

    #[test]
    fn stated_values_are_present_and_strikes_needs_one_finite_number() {
        use serde_json::json;
        let s = json!({
            "structure": "long call",
            "strikes": [260.0],
            "expiration": "2026-07-18",
            "entry_trigger": "break above 252",
            "time_horizon": "5d",
            "confidence": "high",
        });
        for f in [
            RecPlanField::Structure,
            RecPlanField::Strikes,
            RecPlanField::Expiration,
            RecPlanField::EntryTrigger,
            RecPlanField::TimeHorizon,
            RecPlanField::Confidence,
        ] {
            assert_eq!(plan_value(f, &s), PlanValue::Present, "{f:?}");
        }
        // A non-numeric or null-only array carries no strike.
        assert_eq!(
            plan_value(RecPlanField::Strikes, &json!({ "strikes": [null, "260"] })),
            PlanValue::Absent
        );
        // An absent strategy (the early-return `Value::Null` envelopes) reads absent, never present.
        assert_eq!(plan_value(RecPlanField::Structure, &serde_json::Value::Null), PlanValue::Absent);
    }
```

Run: `cargo test -p api-rust field_reasons` → **expected: does not compile** (`plan_value` undefined).

**Step 2 — implement** (same file; add `use serde_json::Value;` beside `use serde::Serialize;`):

```rust
/// PER-FIELD and TYPE-AWARE (INTERFACE_CONTRACT §1). The shipped shared closure
/// `present = |v| v.map(|x| !x.is_null()).unwrap_or(false)` (`recommendation.rs:470`) is NULL-ONLY and
/// must NOT be used here: under it `""`, `[]` and `"moderate"` all read *present*.
pub fn plan_value(field: RecPlanField, strategy: &Value) -> PlanValue {
    let text = |key: &str| -> PlanValue {
        match strategy.get(key).and_then(|v| v.as_str()) {
            Some(s) if !s.trim().is_empty() => PlanValue::Present,
            _ => PlanValue::Absent,
        }
    };
    match field {
        RecPlanField::Structure => text("structure"),
        RecPlanField::Expiration => text("expiration"),
        RecPlanField::EntryTrigger => text("entry_trigger"),
        RecPlanField::TimeHorizon => text("time_horizon"),
        RecPlanField::Strikes => {
            let any_finite = strategy
                .get("strikes")
                .and_then(|v| v.as_array())
                .map(|a| a.iter().any(|x| x.as_f64().map_or(false, |n| n.is_finite())))
                .unwrap_or(false);
            if any_finite { PlanValue::Present } else { PlanValue::Absent }
        }
        // FIXED ORDER, first match wins, DO NOT REORDER (INTERFACE_CONTRACT §1):
        //   1. null or trimmed-empty  -> Absent      (=> not_given)
        //   2. low | medium | high    -> Present     (=> no reason; the value renders)
        //   3. any other non-empty    -> OffScale    (=> unrecognized_value)
        RecPlanField::Confidence => match strategy.get("confidence").and_then(|v| v.as_str()) {
            None => PlanValue::Absent,
            Some(s) if s.trim().is_empty() => PlanValue::Absent,
            Some(s) if matches!(s.trim(), "low" | "medium" | "high") => PlanValue::Present,
            Some(_) => PlanValue::OffScale,
        },
    }
}
```

Run → **expected: green**, delta `+3` over B1.

**Step 3 — commit.** `feat(api): per-field type-aware presence predicates for the six`

*Reviewer should probe:* the confidence match arms are in contract order and the first two cannot be
reordered without a test going red; `map_or` is used rather than `is_some_and` for toolchain safety
(either is fine — the behaviour is identical).

---

### B3 — emit the six keys from the one `json!` site

**File:** `apps/api/src/services/recommendation.rs`.

**Step 1 — failing tests** (append inside `#[cfg(test)] mod tests`, which starts at `:884`):

```rust
    #[test]
    fn field_reasons_carries_exactly_eleven_keys_with_exact_spellings() {
        let set = CandidateSet::unavailable(CandidateBudget::Prompt, true, &SnapshotMeta::default(), None);
        let (_cap, fr, _cited, _g) = envelope_extras(
            &Value::Null, &set, None, None, false, None, GroundingAnchors::empty(), false,
        );
        let obj = fr.as_object().expect("field_reasons is an object");
        let mut keys: Vec<&str> = obj.keys().map(|k| k.as_str()).collect();
        keys.sort_unstable();
        // Hand-built with `json!`, so NOTHING else pins these spellings: a typo'd key is invisible on
        // both sides and would be wrong on every field at once (AC-32).
        assert_eq!(
            keys,
            vec![
                "confidence", "entry_trigger", "exit_stop", "exit_target", "expiration",
                "invalidation_level", "max_risk", "position_size", "strikes", "structure",
                "time_horizon",
            ]
        );
        assert_eq!(obj.len(), 11);
    }

    #[test]
    fn the_six_ride_the_local_rules_envelope_and_never_claim_unavailable_there() {
        let set = CandidateSet::unavailable(CandidateBudget::Prompt, true, &SnapshotMeta::default(), None);
        let strategy = local_strategy_from_bundle(&serde_json::json!({
            "signals": { "setups": [{ "bias": "long", "name": "Flip reclaim", "strategy": "long call",
                                      "rationale": "r", "conviction": "medium" }] },
            "market_state": { "gamma_flip": 245.0 },
        }));
        // local_only = true => the producer declares NO candidate-set dependency.
        let (_cap, fr, _cited, _g) = envelope_extras(
            &strategy, &set, None, None, false, None, GroundingAnchors::empty(), true,
        );
        for k in ["strikes", "expiration"] {
            assert_eq!(fr[k]["reason"], "not_given", "{k} must not claim an input failed here");
            assert!(fr[k]["missing_input"].is_null(), "{k}");
        }
        // Rule-authored, so they carry values and no reason at all.
        for k in ["structure", "entry_trigger", "confidence"] {
            assert!(fr[k].is_null(), "{k} was authored by the rules and needs no reason");
        }
        // AC-33 — the input-independent constant is gone; the horizon is honestly absent.
        assert_eq!(fr["time_horizon"]["reason"], "not_given");
        assert!(strategy["time_horizon"].is_null());
    }

    #[test]
    fn a_declared_empty_candidate_set_names_candidate_set_on_the_two_fields_that_depend_on_it() {
        let set = CandidateSet::unavailable(CandidateBudget::Prompt, true, &SnapshotMeta::default(), None);
        let strategy = serde_json::json!({
            "decision": "trade", "structure": "", "strikes": [], "expiration": null,
            "entry_trigger": "", "time_horizon": null, "confidence": null,
        });
        let (_cap, fr, _cited, _g) = envelope_extras(
            &strategy, &set, None, None, false, None, GroundingAnchors::empty(), false,
        );
        for k in ["strikes", "expiration"] {
            assert_eq!(fr[k]["reason"], "unavailable", "{k}");
            assert_eq!(fr[k]["missing_input"], "candidate_set", "{k}");
        }
        for k in ["structure", "entry_trigger", "time_horizon", "confidence"] {
            assert_eq!(fr[k]["reason"], "not_given", "{k}");
            assert!(fr[k]["missing_input"].is_null(), "{k}");
        }
    }

    #[test]
    fn an_off_scale_confidence_is_reported_as_unrecognized_value_not_as_never_answered() {
        let set = CandidateSet::unavailable(CandidateBudget::Prompt, true, &SnapshotMeta::default(), None);
        let strategy = serde_json::json!({ "decision": "trade", "confidence": "quite high" });
        let (_cap, fr, _cited, _g) = envelope_extras(
            &strategy, &set, None, None, false, None, GroundingAnchors::empty(), false,
        );
        assert_eq!(fr["confidence"]["reason"], "unrecognized_value");
        assert!(fr["confidence"]["missing_input"].is_null());
    }
```

Run: `cargo test -p api-rust recommendation` → **expected: the eleven-key test fails with 5 keys**, and
the other three fail (`fr["strikes"]` is `Null`). The local-rules test also fails on
`strategy["time_horizon"]` until B4 — that assertion stays red across one task boundary by design.

**Step 2 — implement.** Two edits, both inside `envelope_extras`.

(a) Extend the `field_reasons` import at the top of the file (confirm its exact current spelling before
editing — it may be a grouped `use`): add `plan_field_reason, plan_value, PlanInputPresence,
RecPlanField`.

(b) Replace the `field_reasons` block at `:478-484` with:

```rust
    // The SIX plan/conviction fields ride the same object, built at this ONE site so they cannot be
    // partially applied (INTERFACE_CONTRACT rule 2). `local_only` declares NO candidate-set
    // dependency — the local-rules producer needs no set at all, so an empty set says nothing about
    // its `strikes`/`expiration` and `unavailable` must stay unreachable there.
    let plan_presence = PlanInputPresence {
        candidate_set: if local_only { None } else { Some(!set.contracts().is_empty()) },
    };
    let pfr = |field: RecPlanField| -> Value {
        match plan_field_reason(field, plan_value(field, strategy), plan_presence) {
            Some(r) => serde_json::to_value(r).unwrap_or(Value::Null),
            None => Value::Null,
        }
    };
    let field_reasons = json!({
        "max_risk": fr(RecField::MaxRisk, present(strategy.get("max_risk"))),
        "position_size": fr(RecField::PositionSize, present(strategy.get("position_size"))),
        "exit_target": fr(RecField::ExitTarget, present(strategy.pointer("/exit_plan/target"))),
        "exit_stop": fr(RecField::ExitStop, present(strategy.pointer("/exit_plan/stop"))),
        "invalidation_level": fr(RecField::InvalidationLevel, present(strategy.get("invalidation_level"))),
        "structure": pfr(RecPlanField::Structure),
        "strikes": pfr(RecPlanField::Strikes),
        "expiration": pfr(RecPlanField::Expiration),
        "entry_trigger": pfr(RecPlanField::EntryTrigger),
        "time_horizon": pfr(RecPlanField::TimeHorizon),
        "confidence": pfr(RecPlanField::Confidence),
    });
```

The five shipped rows are **unchanged, character for character**. No `Result` and no fallible call is
added; the shipped `unwrap_or(Value::Null)` is reused, so a missing token degrades to a literal and
never to an HTTP error (`[best-effort-isolated-or-null]`).

Run → **expected: green** except the `time_horizon` assertion, which B4 closes.

**Step 3 — commit.** `feat(api): emit the six plan-field reasons on every base envelope`

*Reviewer should probe:* (i) `local_only` is already a parameter of `envelope_extras` (`:449`) — no new
plumbing; (ii) on the early-return `Value::Null` envelopes with `local_only == false` and an empty set,
`strikes`/`expiration` will read `unavailable/candidate_set`. That is unobservable (a gated/unavailable
card renders no field rows at all, AC-28) and the contract states no exception for it, so this plan adds
no special case — **but say so in the GATE Q report** rather than letting a reader discover it.

---

### B4 — delete the one genuine no-author constant (AC-33)

**File:** `apps/api/src/services/recommendation.rs`, `local_strategy_from_bundle`.

**Step 1.** The failing assertion already exists (B3's local-rules test asserts
`strategy["time_horizon"].is_null()`).

**Step 2 — implement.** At `:829`, change

```rust
        "time_horizon": "1–5 sessions",
```

to

```rust
        // rec-absence-literals-hole §2.4 — DELETED: a named author with ZERO input dependence. No
        // rule and no read computed it; it was the same string on every card. The assembler now
        // states nothing and `plan_field_reason` reports `not_given` (AC-33).
        "time_horizon": null,
```

Leave the sibling `no_trade` branch (`:792`) alone — it already emits `null`.

Run: `cargo test -p api-rust` → **expected: green**, delta `+4` over B2 (B3's four tests).

**Step 3 — commit.** `fix(api): stop asserting an input-independent time horizon on local-rules cards`

*Reviewer should probe:* `time_horizon` in `apps/api` still appears in exactly two files
(`recommendation.rs`, `llm.rs`) — re-run `rg -n "time_horizon" apps/api/src` and confirm no
`ai_eval` / export / stored-evaluation consumer appeared since the spec's audit.

---

### B5 — the guard tests, poisoned

No new production code. This task **proves** B1–B4's guards bite. For each row: apply the poison, run
the named command, record the observed failure text, `git checkout --` the file, re-run, record green,
and confirm `git diff --exit-code` on the poisoned file.

| # | Guard | Poison | Must red |
|---|---|---|---|
| P-B1 | eleven-key pin | rename `"entry_trigger"` to `"entrytrigger"` in the `json!` | `cargo test -p api-rust field_reasons_carries_exactly_eleven_keys_with_exact_spellings` |
| P-B2 | tally | add a seventh member to `RecPlanField` | `cargo test -p api-rust the_two_field_enums_stay_disjoint_at_five_and_six` (a compile error is an acceptable red — record which it was) |
| P-B3 | §2.2 hazard | for `Structure`, replace `plan_value(field, strategy)` with the null-only `present(strategy.get("structure"))` mapped to `Present`/`Absent` | `cargo test -p api-rust the_hazard_row` |
| P-B4 | single emit site | add an `OffScale => UnrecognizedValue` arm to `Structure` | `cargo test -p api-rust unrecognized_value_is_unconstructable_from_any_other_field` |
| P-B5 | local-rules exemption | change `if local_only { None }` to `Some(!set.contracts().is_empty())` unconditionally | `cargo test -p api-rust the_six_ride_the_local_rules_envelope` |
| P-B6 | AC-33 | restore `"1–5 sessions"` | same test as P-B5 |

**Commit.** `test(api): record the poison drill for the six-field reason guards` (the body carries the
six observed failures; no source change survives it).

*Reviewer should probe:* that `git log -p` for this commit shows **no** change to `field_reasons.rs` or
`recommendation.rs` — a poison drill that leaves residue is a failed drill.

---

### B6 — score / fingerprint identity and the empty diff (AC-20, AC-36)

```powershell
git diff --stat $BASE -- libs/quant-engine ; $LASTEXITCODE      # expected: EMPTY output
git diff --stat $BASE -- apps/api/src/services/signals apps/api/src/routes ; $LASTEXITCODE
```

`$BASE` is the commit recorded at B0.1 — **not** `main`, which a lane committing onto `main` would make
vacuously empty. Expected: both print nothing (this feature adds no route and no signals change).
`cargo test -p quant-engine` must show the **same** pass count as B0.1.

**Commit:** none (verification only; the receipt goes in the lane report).

---

### B7 — backend lane close-out

```powershell
cargo check -p api-rust --features postgres ; $LASTEXITCODE
cargo test -p api-rust -p quant-engine ; $LASTEXITCODE
```

Expected: exit `0` on both; `api-rust` pass count = B0.1 + 14 (7 from B1, 3 from B2, 4 from B3);
`quant-engine` unchanged. Report the numbers, not the word "green".

---

## Track F — frontend (`apps/dashboard`, `libs/api`)

Owner: frontend lane. Independent of Track B — every FE test drives a **fixture**, never a live server.

### F0 — pre-flight: baseline + the `[lane-check]`s

**F0.1 Baseline (mandatory, before any edit).**

```powershell
git rev-parse HEAD                                    # record as BASE
npx nx test @convexa/dashboard ; $LASTEXITCODE
npx nx typecheck @convexa/dashboard ; $LASTEXITCODE
```

Record: total passed, total failed, and **the exact list of failing spec files**. The known baseline is
~1700 passing with **5 accepted pre-existing red spec files**; a 6th red file was reported as a new
regression. Write the observed list into the lane notes. Every later "expected output" in this track
means: *the same red file list as F0.1, plus zero new red files*. `app.risk.spec.tsx` is a **proven
load-sensitive flake** — if and only if it is the sole failure, re-run it alone
(`npx nx test @convexa/dashboard -- app.risk`) before calling anything red.

If `nx typecheck` reports phantom TS2353/TS6305 errors, delete `apps/dashboard/dist`,
`apps/dashboard/out-tsc` and `*.tsbuildinfo`, then rebuild `tsconfig.app.json` before
`tsconfig.spec.json` (a recorded trap).

**F0.2 Shipped-guard baseline.** Run the file that path-pins the dialog and record it green:

```powershell
npx nx test @convexa/dashboard -- ai-rec.grounding ; $LASTEXITCODE
```

**F0.3 `[lane-check]` — the label→value DOM traversal (§7 Layer 2).** It is **already solved in the
tree**: `ai-rec.grounding.spec.tsx:114-120` ships `fieldValueEl(label)`, documented as
`<Box><Stack><Typography(label)/></Stack><Typography(value)/></Box>` → `labelEl.closest('div')
?.parentElement` → `querySelector('p')`. Confirm by reading it, and confirm it still passes at F0.2.
The Layer-2 guard (F13) copies this helper verbatim with a comment naming its origin (spec files export
nothing here). **Do not guess the walk; if the shipped helper stops working, that is a stop-and-report.**

**F0.4 `[lane-check]` — MUI's `value` prop against a widened `right`.** After F10 lands,
`LegFields.tsx:162` (`<ToggleButtonGroup exclusive value={draft.right} …>`) receives `OptionRight | ''`.
Run `npx nx typecheck @convexa/dashboard` and check for an error at that line. Expected: **none**.
**If it errors**, the permitted fix is a cast **at that one call site**
(`value={draft.right as OptionRight}`) — never a change to the sentinel choice, never a nullable
`right` (both are explicitly rejected approaches, §2.6). Record the result either way.

**F0.5 `[lane-check]` — the `EntryPrefill` pass-throughs.** Confirm that
`apps/dashboard/src/app/features/trading/positions/PortfolioPanel.tsx:39`,
`.../positions/PositionsPanel.tsx:58`, `.../trading/TradeEntryDialog.tsx:13` and
`.../trading/tradeEntry/index.ts:4` only **declare/forward** the prop and that no body reads
`strike`/`expiration`/`right` expecting a non-null:

```powershell
npx nx typecheck @convexa/dashboard ; $LASTEXITCODE
rg -n "prefill\.(strike|expiration|right)" apps/dashboard/src/app
```

Expected after F10/F11: `rg` shows reads only inside `TradeEntryDialogView.tsx` (the seed lines) and
`prefill.ts`. Any other hit is a site this plan did not schedule → stop and report.

---

### F1 — the shared type mirror

**File:** `libs/api/src/lib/convexa.ts` (only). Type-level; no behaviour.

```ts
export type MissingInput = 'risk_block' | 'candidate_quotes' | 'straddle_move' | 'candidate_set';

export interface FieldReason {
  reason: 'not_given' | 'unavailable' | 'unrecognized_value';
  missing_input: MissingInput | null;
}

export interface FieldReasons {
  max_risk: FieldReason | null;
  position_size: FieldReason | null;
  exit_target: FieldReason | null;
  exit_stop: FieldReason | null;
  /** ai-rec-grounding — same shape as its four siblings. */
  invalidation_level: FieldReason | null;
  // rec-absence-literals-hole — the six plan/conviction fields. OPTIONAL (`?:`) because a
  // pre-feature server omits them entirely, and that state is renderable, not an error.
  structure?: FieldReason | null;
  strikes?: FieldReason | null;
  expiration?: FieldReason | null;
  entry_trigger?: FieldReason | null;
  time_horizon?: FieldReason | null;
  confidence?: FieldReason | null;
}
```

`RecStrategy.confidence` stays `RecConfidence | null` — an off-scale value is never rendered from the
value (R-2), so no widening is needed and none is made.

Run: `npx nx typecheck @convexa/dashboard @convexa/api` → expected exit `0`, no new errors.
**Commit:** `feat(api-types): mirror the six field_reasons keys and the two new tokens`

*Reviewer should probe:* the six are optional and the five shipped are not — an accidental `?:` on a
shipped key would silently weaken five existing call sites.

---

### F2 — copy: labels, the new word, the tips, the card-level strings

**File:** `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/copy.ts`. `RISK_FIELD_COPY` is
**untouched** (AC-34). Append after it (`:197`):

```ts
// ---- rec-absence-literals-hole: the six plan/conviction slots -----------------------------------

/** The five plan-row labels, hoisted out of `AiRecPanel.tsx`'s inline literals so the renderer, the
 *  standing line and the Layer-2 guard read ONE constant. CARD ORDER — the standing line joins the
 *  first four in this order. */
export const PLAN_FIELD_LABEL = {
  structure: 'Structure',
  strikes: 'Strike(s)',
  expiration: 'Expiration',
  entryTrigger: 'Entry trigger',
  timeHorizon: 'Time horizon',
  confidence: 'Confidence',
} as const;

/** The POSITION-DEFINING four, in card order (AC-10a). Time horizon and Confidence are excluded on
 *  purpose: their absence is not what makes a rec unactionable (AC-11). */
export const POSITION_DEFINING_LABELS = [
  PLAN_FIELD_LABEL.structure,
  PLAN_FIELD_LABEL.strikes,
  PLAN_FIELD_LABEL.expiration,
  PLAN_FIELD_LABEL.entryTrigger,
] as const;

/** The six take the SHIPPED words with a PRODUCER-NEUTRAL tip on their own sibling entry. The shipped
 *  `not_given` tip names a producer ("The AI produced a trade read but…") and would contradict the
 *  local-rules line on the same card; the WORD holds in every state, the shipped TIP does not. */
export const PLAN_FIELD_COPY = {
  notGiven: {
    text: RISK_FIELD_COPY.notGiven.text,
    tip: 'Nothing stated a value for this. Nothing failed; it was simply never filled in.',
  },
  unavailable: {
    text: RISK_FIELD_COPY.unavailable.text,
    tip: RISK_FIELD_COPY.unavailable.tip,
  },
  dash: { text: RISK_FIELD_COPY.dash.text, tip: RISK_FIELD_COPY.dash.tip },
  /** The ONE new member of the closed not-a-number vocabulary (decisions.md §C #21). One emit site. */
  unrecognized: {
    text: 'unrecognized',
    tip:
      "The read named a conviction outside Convexa's scale. Convexa shows low, medium or high only; " +
      "it won't repeat an answer it can't place.",
  },
} as const;

/** The card-level standing statement (AC-10a/c). NOT an absence word — a standing statement — so the
 *  one-new-word rule is not engaged. Producer-neutral; no icon, no tint, plain body text. */
export const notActionableLine = (labels: readonly string[]) =>
  `Not actionable as given. Never named: ${labels.join(', ')}.`;

/** The DTE caption, reworded: a property of the REQUEST (vouched by the owner's own filter), never a
 *  containment claim about the value. Renders on the `value` member only, and never if either bound is
 *  unknown — a literal `?` must not reach the DOM (AC-26/27). The dash is U+2013 (en dash), matching
 *  the shipped caption; it is NOT the U+2014 the §7 guards target. */
export const dteWindowCaption = (min: number, max: number) => ` · your DTE window: ${min}–${max}`;

/** The entry-surface reason for a contract field the read never named (AC-12a/b/c/d). Follows the
 *  shipped `PREFILL_WITHHELD` idiom, names NO cause, and is built in `prefill.ts` and carried verbatim
 *  — the dialog never re-spells it. */
export const prefillUnnamedReason = (labels: readonly string[]) =>
  `Not pre-filled — the read named no ${labels.join(', ')}.`;
```

**Test (new file `copy.plan.spec.ts` in the same folder):**

```ts
import { describe, expect, it } from 'vitest';
import {
  dteWindowCaption,
  literalCopy,
  notActionableLine,
  PLAN_FIELD_COPY,
  POSITION_DEFINING_LABELS,
  prefillUnnamedReason,
} from './copy';

const RESERVED = '—'; // the reserved mark, ESCAPED so this file cannot poison the Layer-3 scan

describe('rec-absence-literals-hole · the new copy', () => {
  it('no new string contains the reserved mark', () => {
    const all = [
      ...Object.values(PLAN_FIELD_COPY).flatMap((c) => [c.text, c.tip]),
      notActionableLine(POSITION_DEFINING_LABELS),
      dteWindowCaption(7, 45),
      prefillUnnamedReason(['Strike(s)']),
    ];
    for (const s of all) expect(s).not.toContain(RESERVED);
  });

  it('the DTE caption uses an EN dash and interpolates both bounds, never a question mark', () => {
    expect(dteWindowCaption(7, 45)).toBe(' · your DTE window: 7–45');
    expect(dteWindowCaption(7, 45)).not.toContain('?');
  });

  it('the standing line names the missing fields in card order and no cause', () => {
    expect(notActionableLine(['Structure', 'Expiration'])).toBe(
      'Not actionable as given. Never named: Structure, Expiration.',
    );
  });

  it('the six carry a producer-neutral tip (no AI, no rule named)', () => {
    for (const w of ['AI', 'model', 'rule']) {
      expect(PLAN_FIELD_COPY.notGiven.tip).not.toContain(w);
    }
  });

  it('literalCopy is total over the closed set; only `dash` carries the reserved mark', () => {
    for (const k of ['value', 'not_set', 'unavailable', 'not_given', 'unrecognized'] as const) {
      expect(literalCopy(k).text).not.toContain(RESERVED);
      expect(literalCopy(k).tip.length).toBeGreaterThan(0);
    }
    expect(literalCopy('dash').text).toBe(RESERVED);
  });
});
```

(The `literalCopy` row is red until F4 — write it now, land it green there.)

Run: `npx nx test @convexa/dashboard -- copy.plan` → red first, then green after F4.
Also re-run `npx nx test @convexa/dashboard -- bannedWords.scan` → **must stay green** (the new strings
live in this folder and are scanned).

**Commit:** `feat(ai-rec): copy for the six absence literals, the standing line and the DTE caption`

*Reviewer should probe:* `unrecognized` is spelled once; `RISK_FIELD_COPY.notGiven.tip` is byte-identical
to its pre-work value.

---

### F3 — the sibling selector

**File:** `.../ai-rec/literals.ts`. `fieldLiteral` and the `FieldLiteral` union are **not edited**.

**Step 1 — failing tests** (new file `planLiterals.spec.ts` beside `literals.spec.ts`):

```ts
import { describe, expect, it } from 'vitest';
import { fieldLiteral, planFieldLiteral } from './literals';

const trade = 'trade' as const;

describe('rec-absence-literals-hole · planFieldLiteral (the sibling selector)', () => {
  it('THE DEFAULTS DIFFER — this is the whole point, and a later merge must red here', () => {
    const args = { decision: trade, value: null, reason: null } as const;
    expect(fieldLiteral(args)).toEqual({ kind: 'unavailable' }); // shipped fallthrough, unchanged
    expect(planFieldLiteral(args)).toEqual({ kind: 'not_given' }); // sibling fallthrough
  });

  it('a stated value renders through the SHARED value arms, identically to the shipped selector', () => {
    for (const v of ['long call', '5d', 'break above 252']) {
      expect(planFieldLiteral({ decision: trade, value: v, reason: null })).toEqual({
        kind: 'value',
        text: v,
      });
    }
  });

  it('an off-scale conviction renders the ONE new word and never leaks the raw string', () => {
    const l = planFieldLiteral({
      decision: trade,
      value: 'quite high',
      reason: { reason: 'unrecognized_value', missing_input: null },
    });
    expect(l).toEqual({ kind: 'unrecognized' });
    expect(JSON.stringify(l)).not.toContain('quite high');
  });

  it('unrecognized_value NEVER collapses into not_given (the fix reproducing the defect)', () => {
    expect(
      planFieldLiteral({
        decision: trade,
        value: 'quite high',
        reason: { reason: 'unrecognized_value', missing_input: null },
      }),
    ).not.toEqual({ kind: 'not_given' });
  });

  it('unavailable renders ONLY from the explicit candidate_set pair, never from a fallthrough', () => {
    expect(
      planFieldLiteral({
        decision: trade,
        value: null,
        reason: { reason: 'unavailable', missing_input: 'candidate_set' },
      }),
    ).toEqual({ kind: 'unavailable' });
    for (const reason of [
      { reason: 'unavailable', missing_input: 'risk_block' },
      { reason: 'not_given', missing_input: null },
      { reason: 'wat' as unknown as 'not_given', missing_input: null },
    ] as const) {
      expect(planFieldLiteral({ decision: trade, value: null, reason })).toEqual({
        kind: 'not_given',
      });
    }
  });

  it('no_trade short-circuits FIRST, before the value is touched', () => {
    expect(planFieldLiteral({ decision: 'no_trade', value: 'long call', reason: null })).toEqual({
      kind: 'dash',
    });
  });

  it('never renders not_set — none of the six depends on owner input (AC-23)', () => {
    const kinds = [
      planFieldLiteral({ decision: trade, value: null, reason: null }),
      planFieldLiteral({
        decision: trade,
        value: '',
        reason: { reason: 'unavailable', missing_input: 'risk_block' },
      }),
    ].map((l) => l.kind);
    expect(kinds).not.toContain('not_set');
  });
});
```

**Step 2 — implement.** Append to `literals.ts` after `fieldLiteral` (`:63`):

```ts
/**
 * The SIBLING of `FieldLiteral` for the six plan/conviction fields. A PROPER SUPERSET, not a disjoint
 * union: TS structural typing then makes it impossible to hand a `PlanFieldLiteral` to a parameter
 * typed `FieldLiteral` without an explicit unsafe cast, so the one new word cannot leak into a shipped
 * consumer. The shipped union gains no member.
 */
export type PlanFieldLiteral = FieldLiteral | { kind: 'unrecognized' };

/**
 * The sibling selector. Shares the shipped value arms and the `no_trade`-first short-circuit, and
 * differs in exactly two ways: an EXPLICIT `unrecognized_value` arm, and a fallthrough of `not_given`
 * rather than `unavailable`.
 *
 * ARM ORDER IS LOAD-BEARING (plan R-2): the `unrecognized_value` arm sits AHEAD of the value arms,
 * because an off-scale conviction arrives as a non-empty string and the shipped value arm would paint
 * it (AC-24 forbids the raw string reaching the DOM). Everything after it is the shipped value test,
 * then a CLOSED LOOKUP ON THE WIRE TOKEN ALONE — no null test, no sibling-field inference, no
 * re-derivation (`[digested-labels-not-raw-dump]`, `[absent-is-not-none]`).
 *
 * `unavailable` requires BOTH tokens (plan R-3): the reason AND `missing_input: 'candidate_set'`, the
 * only missing input any of the six can declare. `not_set` is unreachable here by construction — none
 * of the six depends on owner input (AC-23).
 */
export function planFieldLiteral(args: {
  decision: RecDecision;
  value: string | number | null | undefined;
  reason: FieldReason | null | undefined;
}): PlanFieldLiteral {
  if (args.decision === 'no_trade') return { kind: 'dash' }; // first, always
  if (args.reason?.reason === 'unrecognized_value') return { kind: 'unrecognized' };
  const v = args.value;
  if (typeof v === 'number' && Number.isFinite(v) && v !== 0)
    return { kind: 'value', text: String(v) };
  if (typeof v === 'string' && v.trim() !== '') return { kind: 'value', text: v };
  if (args.reason?.reason === 'unavailable' && args.reason.missing_input === 'candidate_set')
    return { kind: 'unavailable' };
  return { kind: 'not_given' };
}
```

Run: `npx nx test @convexa/dashboard -- planLiterals literals.spec` → the new file green and
**`literals.spec.ts` unchanged and still green** (`git diff --exit-code` on it).

**Step 3 — commit.** `feat(ai-rec): planFieldLiteral, the sibling selector with a not_given fallthrough`

*Reviewer should probe:* the shipped `fieldLiteral` body is byte-identical; the arm-order comment is
backed by a test that would red if the `unrecognized_value` arm moved below the value arms.

---

### F4 — one copy table, two renderers

**File:** `copy.ts`. Append:

```ts
/** ONE mapping from a `PlanFieldLiteral` kind to (text, tip). `confidence` renders as a `Chip`, not a
 *  `Field`, so a second RENDERER is unavoidable — this keeps it from becoming a second COPY TABLE. */
export function literalCopy(
  kind: 'value' | 'dash' | 'not_set' | 'unavailable' | 'not_given' | 'unrecognized',
): { text: string; tip: string } {
  switch (kind) {
    case 'dash':
      return PLAN_FIELD_COPY.dash;
    case 'unavailable':
      return PLAN_FIELD_COPY.unavailable;
    case 'unrecognized':
      return PLAN_FIELD_COPY.unrecognized;
    case 'not_set':
      // Unreachable on the six (AC-23); named explicitly so a future caller cannot read a missing arm
      // as "falls through to not_given".
      return { text: RISK_FIELD_COPY.notSet.text, tip: RISK_FIELD_COPY.notSet.tip };
    case 'value':
    case 'not_given':
    default:
      return PLAN_FIELD_COPY.notGiven;
  }
}
```

Run: `npx nx test @convexa/dashboard -- copy.plan` → green (5 tests).
**Commit:** `feat(ai-rec): one literalCopy table shared by the field and chip renderers`

---

### F5 — the six typed render sites (Layer 1; AC-1/2/22/26)

**File:** `AiRecPanel.tsx`.

**Step 1 — the two renderers.** Add beside `RiskField` (after `:820`, outside it):

```tsx
/** The plan-row renderer: takes a `PlanFieldLiteral`, NEVER a rendered `React.ReactNode`. That is
 *  what makes a bare `?? '—'` at one of these sites a TYPE ERROR rather than a style violation
 *  (§7 Layer 1). The `Field` primitive is unchanged — the literal→element mapping happens here. */
function PlanField({
  label,
  literal,
  caption,
}: {
  label: string;
  literal: PlanFieldLiteral;
  /** Rendered ONLY beside the `value` member (AC-26) — the caller decides, this component enforces. */
  caption?: ReactNode;
}) {
  if (literal.kind === 'value')
    return (
      <Field
        label={label}
        value={
          <>
            {literal.text}
            {caption}
          </>
        }
      />
    );
  const cfg = literalCopy(literal.kind);
  return <Field label={label} tip={cfg.tip} value={cfg.text} />;
}

/** The conviction slot. A `Chip` when a value was stated; PLAIN TEXT (chip suppressed) for every
 *  absence member — a chip whose label is an absence word reads as a stated grade. Same copy table as
 *  `PlanField` (`literalCopy`), never a second one. */
function ConvictionSlot({ literal }: { literal: PlanFieldLiteral }) {
  if (literal.kind === 'value') return <Chip size="small" label={literal.text} />;
  const cfg = literalCopy(literal.kind);
  return (
    <Tooltip arrow describeChild title={cfg.tip}>
      <Typography variant="body2">{cfg.text}</Typography>
    </Tooltip>
  );
}
```

**Step 2 — hoist the six literals** beside `dteMin`/`dteMax` (`:848`), so each is computed exactly once
and F7's standing line reads the same objects the rows render:

```tsx
  const structureLiteral = planFieldLiteral({
    decision: s.decision,
    value: s.structure,
    reason: rec.field_reasons?.structure,
  });
  const strikesLiteral = planFieldLiteral({
    decision: s.decision,
    // Joining the array into a display string BEFORE the lookup is formatting, not cause selection
    // (§2.3 UX-3(a)).
    value: s.strikes.length ? s.strikes.map((x) => `$${x}`).join(' / ') : '',
    reason: rec.field_reasons?.strikes,
  });
  const expirationLiteral = planFieldLiteral({
    decision: s.decision,
    value: s.expiration,
    reason: rec.field_reasons?.expiration,
  });
  const entryTriggerLiteral = planFieldLiteral({
    decision: s.decision,
    value: s.entry_trigger,
    reason: rec.field_reasons?.entry_trigger,
  });
  const timeHorizonLiteral = planFieldLiteral({
    decision: s.decision,
    value: s.time_horizon,
    reason: rec.field_reasons?.time_horizon,
  });
  const convictionLiteral = planFieldLiteral({
    decision: s.decision,
    value: s.confidence,
    reason: rec.field_reasons?.confidence,
  });
```

**Step 3 — replace the four plan rows** at `:1080-1101`:

```tsx
          {/* 3. Plan. Every row goes through `planFieldLiteral` — a closed lookup on the wire token,
              never a null test, never a bare fallback (rec-absence-literals-hole §2.3). */}
          <Stack direction="row" spacing={4} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <PlanField label={PLAN_FIELD_LABEL.structure} literal={structureLiteral} />
            <PlanField label={PLAN_FIELD_LABEL.strikes} literal={strikesLiteral} />
            <PlanField
              label={PLAN_FIELD_LABEL.expiration}
              literal={expirationLiteral}
              caption={
                dteMin != null && dteMax != null ? (
                  <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
                    {dteWindowCaption(dteMin, dteMax)}
                  </Typography>
                ) : undefined
              }
            />
            <PlanField label={PLAN_FIELD_LABEL.entryTrigger} literal={entryTriggerLiteral} />
          </Stack>
```

**Step 4 — replace the read-context pair** at `:1153-1159`:

```tsx
            <PlanField label={PLAN_FIELD_LABEL.timeHorizon} literal={timeHorizonLiteral} />
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                {PLAN_FIELD_LABEL.confidence}
              </Typography>
              <ConvictionSlot literal={convictionLiteral} />
            </Box>
```

Add imports: `PLAN_FIELD_LABEL`, `dteWindowCaption`, `literalCopy` from `./copy`;
`planFieldLiteral, type PlanFieldLiteral` from `./literals`.

**Step 5 — run.** `npx nx typecheck @convexa/dashboard` → exit `0`.
`npx nx test @convexa/dashboard -- ai-rec` → the shipped ai-rec specs must stay green; if one reds
because a fixture now renders `not given` where it printed the reserved mark, **that is the feature
working** — update that assertion and say so in the commit body. Do **not** touch `literals.spec.ts`.

**Step 6 — commit.** `feat(ai-rec): render the six plan slots through the typed literal (Layer 1)`

*Reviewer should probe:* all six sites are gone from the `?? '—'` shape; the DTE caption now requires
**both** bounds (AC-26) where the shipped code accepted either; `Field` gained no prop (§2.3).

---

### F6 — the `no_trade` hero conviction (AC-3d)

**File:** `AiRecPanel.tsx`, `:943-944` only. **`:956-996` keeps a zero-line diff** — confirm with
`git diff` before committing.

```tsx
              {/* AC-3d — the ONE carve-out from the no-plan-rows rule: an absent conviction renders
                  `not given` as TEXT, never the reserved mark, never nothing. This line sits OUTSIDE
                  the four-field risk row below, which keeps its zero-line diff. */}
              <Box data-testid="no-trade-conviction">
                {s.confidence ? (
                  <Chip size="small" variant="outlined" label={`conviction · ${s.confidence}`} />
                ) : (
                  <Typography variant="body2">{literalCopy('not_given').text}</Typography>
                )}
              </Box>
```

This slot deliberately does **not** route through `planFieldLiteral`: that selector short-circuits
`no_trade` to `dash`, which is exactly what AC-3d forbids here. The copy still comes from the one table.

Run: `npx nx test @convexa/dashboard -- ai-rec` → green.
**Commit:** `feat(ai-rec): a no_trade card states an absent conviction instead of showing nothing`

*Reviewer should probe:* `git diff` shows no change between `:956` and `:996`; the four risk slots on a
`no_trade` card still render the reserved mark (AC-3b).

---

### F7 — the card-level standing line (AC-10a/b/c, AC-11, AC-15)

**File:** `AiRecPanel.tsx`, trade branch only, directly under `<GroundingNote …>` (`:1022`).

```tsx
  // AC-10 — the ONE standing line. Exempt ONLY on an AFFIRMATIVE local-rules declaration; a response
  // with no grounding block at all is NOT an exemption (AC-10c) — missing information never is.
  const localRulesDeclared = rec.grounding?.card === 'local_rules';
  const unnamedPositionFields = (
    [
      [PLAN_FIELD_LABEL.structure, structureLiteral],
      [PLAN_FIELD_LABEL.strikes, strikesLiteral],
      [PLAN_FIELD_LABEL.expiration, expirationLiteral],
      [PLAN_FIELD_LABEL.entryTrigger, entryTriggerLiteral],
    ] as const
  )
    .filter(([, l]) => l.kind !== 'value')
    .map(([label]) => label);
  const standingLine =
    !localRulesDeclared && unnamedPositionFields.length > 0
      ? notActionableLine(unnamedPositionFields)
      : null;
```

Render:

```tsx
          {standingLine && (
            <Typography
              variant="body2"
              data-testid="rec-not-actionable"
              sx={{ color: 'text.secondary' }}
            >
              {standingLine}
            </Typography>
          )}
```

Plain body text, no icon, no tint, no `warning.*` (§4: the card-level amber is already spent by the
grounding line, and DESIGN_SYSTEM makes `warning.*` icon-mandatory). Placed **after**
`<GroundingNote/>` so both render, never merged — at most two card-level statements (AC-15).

The predicate keys on the **literal**, i.e. on the value being absent — the same discipline as AC-12e —
so a pre-feature response with no `field_reasons` at all still fires the line (AC-10c).

Run: `npx nx typecheck` then `npx nx test @convexa/dashboard -- ai-rec` → green.
**Commit:** `feat(ai-rec): one standing not-actionable line, exempt only on a declared local-rules card`

*Reviewer should probe:* Time horizon and Confidence are **not** in the list (AC-11); the exemption
reads `=== 'local_rules'`, never a negation of something else.

---

### F8 — fixtures for the new states

**File:** `fixtures.ts` (add `FieldReason` to the `@convexa/api` type import). Append:

```ts
// ---- rec-absence-literals-hole ------------------------------------------------------------------

const reason = (
  reason: FieldReason['reason'],
  missing_input: FieldReason['missing_input'] = null,
): FieldReason => ({ reason, missing_input });

/** The primary observation shape: a `trade` card on which NONE of the six was named. */
export function recNoneNamed(): RecResponse {
  const r = baseResponse({
    strategy: baseStrategy({
      structure: null,
      strikes: [],
      expiration: null,
      entry_trigger: null,
      time_horizon: null,
      confidence: null,
    }),
  });
  r.field_reasons = {
    ...r.field_reasons,
    structure: reason('not_given'),
    strikes: reason('not_given'),
    expiration: reason('not_given'),
    entry_trigger: reason('not_given'),
    time_horizon: reason('not_given'),
    confidence: reason('not_given'),
  };
  return r;
}

/** Three named, three not (AC-2): only the unnamed three may change. */
export function recHalfNamed(): RecResponse {
  const r = baseResponse({
    strategy: baseStrategy({ expiration: null, time_horizon: null, confidence: null }),
  });
  r.field_reasons = {
    ...r.field_reasons,
    expiration: reason('not_given'),
    time_horizon: reason('not_given'),
    confidence: reason('not_given'),
  };
  return r;
}

/** The candidate set was declared and empty — the ONLY source of `unavailable` on these six. */
export function recCandidateSetEmpty(): RecResponse {
  const r = baseResponse({ strategy: baseStrategy({ strikes: [], expiration: null }) });
  r.field_reasons = {
    ...r.field_reasons,
    strikes: reason('unavailable', 'candidate_set'),
    expiration: reason('unavailable', 'candidate_set'),
  };
  return r;
}

/** A conviction stated OFF Convexa's scale. The raw string must never reach the DOM (AC-24). */
export function recOffScaleConfidence(): RecResponse {
  const r = baseResponse({
    strategy: baseStrategy({ confidence: 'quite high' as RecStrategy['confidence'] }),
  });
  r.field_reasons = { ...r.field_reasons, confidence: reason('unrecognized_value') };
  return r;
}

/** A reason token this build does not recognise (AC-6). */
export function recUnknownToken(): RecResponse {
  const r = recNoneNamed();
  r.field_reasons = {
    ...r.field_reasons,
    structure: { reason: 'wat' as FieldReason['reason'], missing_input: null },
  };
  return r;
}

/** NO per-field reason information at all — a pre-feature or degraded server (AC-5). */
export function recNoFieldReasonsBlock(): RecResponse {
  const r = recNoneNamed();
  delete (r as { field_reasons?: unknown }).field_reasons;
  return r;
}

/** Values everywhere but blank-ish: `""` / whitespace / `[]` (AC-7). */
export function recBlankValues(): RecResponse {
  const r = baseResponse({
    strategy: baseStrategy({
      structure: '',
      strikes: [],
      expiration: '   ',
      entry_trigger: '',
      time_horizon: '  ',
      confidence: null,
    }),
  });
  r.field_reasons = {
    ...r.field_reasons,
    structure: reason('not_given'),
    strikes: reason('not_given'),
    expiration: reason('not_given'),
    entry_trigger: reason('not_given'),
    time_horizon: reason('not_given'),
    confidence: reason('not_given'),
  };
  return r;
}

/** The local-rules card the standing line is EXEMPT on (AC-10b), matching what the server emits. */
export function recLocalRulesUnnamed(): RecResponse {
  const r = recLocalRules();
  r.strategy = baseStrategy({
    structure: 'long call',
    strikes: [],
    expiration: null,
    time_horizon: null,
  });
  r.field_reasons = {
    ...r.field_reasons,
    strikes: reason('not_given'),
    expiration: reason('not_given'),
    time_horizon: reason('not_given'),
  };
  return r;
}

/** Only Time horizon and Confidence unnamed — literals, but NO standing line (AC-11). */
export function recOnlySoftFieldsUnnamed(): RecResponse {
  const r = baseResponse({ strategy: baseStrategy({ time_horizon: null, confidence: null }) });
  r.field_reasons = {
    ...r.field_reasons,
    time_horizon: reason('not_given'),
    confidence: reason('not_given'),
  };
  return r;
}
```

Run: `npx nx typecheck @convexa/dashboard` → exit `0`.
**Commit:** `test(ai-rec): fixtures for the six unnamed-field states`

---

### F9 — card render regressions (AC-1/2/3a-d/4/5/6/7/8/10/11/14/19/22/23/24/25/26/28)

**File:** new `ai-rec.absence.spec.tsx` in the ai-rec folder. Copy the harness from
`ai-rec.grounding.spec.tsx:31-120` verbatim (`installBackend`, `renderApp`, `panel`, `settle`, `ask`,
`fieldValueEl`) with a header comment naming the origin. **Integration mocks the network boundary
only** — never the selector, never the copy table, never the submit predicate.

```tsx
const RESERVED = '—';
const SIX = Object.values(PLAN_FIELD_LABEL);
```

Rows (one `it` each, each naming its AC):

- **AC-1 (SB)** — `recNoneNamed()`: each of `SIX` resolves to a value element whose text is non-empty,
  is one of `{not given, unavailable, unrecognized}`, and contains no `RESERVED`; the resolved count
  is exactly 6.
- **AC-2** — `recHalfNamed()`: the three named slots read the producer's exact strings (`long call`,
  `$260`, `break above 252`); the three unnamed read `not given`.
- **AC-22 (SB)** — `recAllTraced()`: every one of `SIX` renders the producer's text and the panel
  contains none of the three absence words.
- **AC-4 (SB)** — three conditions rendered **through the selector** — never-stated (`recNoneNamed`,
  Structure), candidate-set-missing (`recCandidateSetEmpty`, Strike(s)), the reserved mark
  (`noTradeRec`, Max risk) — produce three pairwise-distinct, non-empty strings
  (`new Set([...]).size === 3`). Non-vacuity is poison P-F4 (F16).
- **AC-5 (SB)** — `recNoFieldReasonsBlock()`: all six read `not given`; no slot contains `null`,
  `undefined`, `NaN` or `RESERVED`; `queryByRole('alert')` is null.
- **AC-6** — `recUnknownToken()`: Structure reads `not given`; the panel text does not contain `wat`.
- **AC-7 (SB)** — `recBlankValues()`: all six read their absence literal; every slot's
  `textContent.trim().length > 0`.
- **AC-24 (SB)** — `recOffScaleConfidence()`: the Confidence slot reads `unrecognized`, is not
  `not given`, and `panel().textContent` does not contain `quite high`.
- **AC-25 (SB)** — `recCandidateSetEmpty()`: Strike(s) and Expiration read `unavailable`; the other
  four do not. `recLocalRulesUnnamed()`: **no** slot reads `unavailable`.
- **AC-23** — across `recNoneNamed()` and `recCandidateSetEmpty()`: no slot reads `not set` and
  `queryByTestId('risk-field-set-risk-inputs')` is null within the six.
- **AC-26** — `recAllTraced()` with both DTE bounds: the Expiration slot contains
  ` · your DTE window: `. `recNoneNamed()`: it does not. A bundle missing either bound: no caption and
  no `?` in that slot.
- **AC-3a/3b/3c (SB)** — `noTradeRec()`: `queryByText` for each of the five plan labels is **null** (no
  row, placeholder, skeleton or ghost); the four risk slots read `RESERVED`; no absence literal from
  this feature appears anywhere on the card **except** the conviction carve-out.
- **AC-3d (SB)** — `noTradeRec()` with `confidence: null`: `getByTestId('no-trade-conviction')` reads
  `not given`, is non-empty, contains no `RESERVED`.
- **AC-8** — `recNoneNamed()`: capture the six slot strings, fire the mocked `EventSource`'s `onerror`,
  await a tick, assert the six strings are identical.
- **AC-14 (SB)** — for `recNoneNamed`, `recBlankValues`, `recCandidateSetEmpty`,
  `recNoFieldReasonsBlock`: `Trade · long` renders and the reasoning section is present.
- **AC-19/28** — the gated states already covered by the shipped specs (cooldown / cap / no key):
  `queryByText(label)` is null for all six labels, and no absence literal appears.
- **AC-10a (SB)** — `recNoneNamed()` on the model path: exactly one `rec-not-actionable`, naming
  `Structure, Strike(s), Expiration, Entry trigger`. `recAllTraced()`: none.
- **AC-10b (SB)** — `recLocalRulesUnnamed()`: `queryByTestId('rec-not-actionable')` is null and the
  shipped local-rules line still renders.
- **AC-10c** — `recNoFieldReasonsBlock()` with `grounding` also deleted: the line **does** render.
- **AC-11 (SB)** — `recOnlySoftFieldsUnnamed()`: those two slots read `not given`, no standing line,
  and Accept opens the dialog seeded exactly as on a fully-specified card.

Run: `npx nx test @convexa/dashboard -- ai-rec.absence` → red first, then green.
**Commit:** `test(ai-rec): the absence-literal render regressions (AC-1..AC-28)`

*Reviewer should probe:* every assertion goes through the rendered DOM, not a selector call; `RESERVED`
is written as an escape everywhere so this file cannot poison the Layer-3 scan.

---

### F10 — the prefill seam: types + producer (AC-12a/b/c/d/e, AC-13)

**Files:** `features/trading/tradeEntry/types.ts` and `ai-rec/prefill.ts`.

**Step 1 — failing unit tests** (new `prefill.absence.spec.ts` in the ai-rec folder):

```ts
import { describe, expect, it } from 'vitest';
import { biasToRight, recToPrefill } from './prefill';

const named = {
  decision: 'trade', bias: 'long', structure: 'long call', strikes: [260],
  expiration: '2026-07-18', entry_trigger: 'x', invalidation_level: 1, max_risk: '$1',
  position_size: '1', exit_plan: { target: null, stop: null }, time_horizon: '5d',
  confidence: 'medium', rationale: 'r',
} as const;

describe('rec-absence-literals-hole · the prefill seam', () => {
  it('AC-12c — an unnamed structure derives NO direction, even when a bias is stated', () => {
    expect(biasToRight({ structure: null, bias: 'short' })).toBeNull();
    expect(biasToRight({ structure: '   ', bias: 'long' })).toBeNull();
  });

  it('a STATED structure still derives exactly as today (bias fallback included)', () => {
    expect(biasToRight({ structure: 'long put spread', bias: 'long' })).toBe('put');
    expect(biasToRight({ structure: 'long call', bias: 'short' })).toBe('call');
    // Stated but naming neither word: the bias derivation stands UNCHANGED — a parse that found no
    // keyword is a different fact from an unnamed structure, and is out of scope here.
    expect(biasToRight({ structure: 'iron condor', bias: 'short' })).toBe('put');
    expect(biasToRight({ structure: 'iron condor', bias: 'long' })).toBe('call');
  });

  it('AC-12a/b — an unnamed strike/expiration arrive as null, never 0 and never an empty string', () => {
    const pf = recToPrefill({ ...named, strikes: [], expiration: null, structure: null }, 'P', 'c');
    expect(pf?.strike).toBeNull();
    expect(pf?.expiration).toBeNull();
    expect(pf?.right).toBeNull();
  });

  it('AC-12e — the refusal keys on the VALUE, not on a reason token (none is read here)', () => {
    // `recToPrefill` takes no `field_reasons` argument at all — a degraded response with no reason
    // information still refuses to seed, structurally.
    const pf = recToPrefill({ ...named, strikes: [] }, 'P', 'c');
    expect(pf?.strike).toBeNull();
    expect(recToPrefill.length).toBeLessThanOrEqual(4); // no fifth `reasons` parameter appeared
  });

  it('AC-12d — the reason line names the fields and NO cause', () => {
    const pf = recToPrefill({ ...named, strikes: [], expiration: null }, 'P', 'c');
    expect(pf?.contractWithheldReason).toContain('Strike(s)');
    expect(pf?.contractWithheldReason).toContain('Expiration');
    for (const cause of ['because', 'failed', 'missing', 'AI', 'error'])
      expect(pf?.contractWithheldReason?.toLowerCase()).not.toContain(cause.toLowerCase());
  });

  it('AC-13 — a fully-named rec seeds exactly as today, and carries NO reason line', () => {
    const pf = recToPrefill(named, 'P', 'c');
    expect(pf?.strike).toBe(260);
    expect(pf?.expiration).toBe('2026-07-18');
    expect(pf?.right).toBe('call');
    expect(pf?.contractWithheldReason).toBeNull();
  });
});
```

**Step 2 — implement.**

`types.ts` — widen `EntryPrefill` (`:24-40`):

```ts
  /** `null` = THE READ NAMED NO EXPIRATION. Distinct from `''`, which is the DRAFT's sentinel. */
  expiration: string | null;
  /** `null` = the read named no strike. Never 0 — a zero strike is a real, submittable number. */
  strike: number | null;
  /** `null` = the read named no structure, so no direction is derivable. */
  right: OptionRight | null;
```

plus the new member:

```ts
  /** rec-absence-literals-hole (AC-12a/b/c/d) — ONE line naming the contract fields the read did not
   *  give, built by the producer and rendered VERBATIM (the same seam `stopWithheldReason` uses; this
   *  file never re-spells the copy). `null` ⇒ nothing to explain. */
  contractWithheldReason?: string | null;
```

and `LegDraft.right` (`:152`):

```ts
  /** `''` = the read named no structure, so no direction is typed yet. Deliberately the file's own
   *  falsy sentinel (see `strike` above and `price` below), NOT a nullable — the falsy handling this
   *  file already contains extends to `right` unchanged and no third convention is introduced. */
  right: OptionRight | '';
```

`newDraft()` keeps `right: 'call'` — a dialog opened directly is unaffected (AC-13).

`prefill.ts` — widen `AiPrefill` **identically** (`expiration: string | null`, `strike: number | null`,
`right: OptionRight | null`, plus `contractWithheldReason?: string | null`), then:

```ts
/** Single-leg long ghost trade carries one `right`: derive it from structure first, then bias.
 *  **A NEVER-NAMED STRUCTURE DERIVES NOTHING** — the presence check sits AHEAD of the lowercasing
 *  collapse, because the bias fallback fires regardless of whether structure was named and would
 *  otherwise hand back a submittable direction for a structure nobody stated (AC-12c). */
export function biasToRight(strategy: Pick<RecStrategy, 'structure' | 'bias'>): OptionRight | null {
  if (strategy.structure == null || strategy.structure.trim() === '') return null;
  const s = strategy.structure.toLowerCase();
  if (s.includes('put')) return 'put';
  if (s.includes('call')) return 'call';
  if (strategy.bias === 'short') return 'put';
  return 'call';
}
```

and inside `recToPrefill`, replacing the three seed expressions:

```ts
  const strike = strategy.strikes.find((x) => Number.isFinite(x)) ?? null;
  const expiration = strategy.expiration?.trim() ? strategy.expiration : null;
  const right = biasToRight(strategy);
  // The refusal keys on the VALUE being absent — no reason token is read here, by construction, so a
  // degraded or pre-feature response still refuses to seed and never becomes a blocked Accept (AC-12e).
  const unnamed = [
    right === null ? PLAN_FIELD_LABEL.structure : null,
    strike === null ? PLAN_FIELD_LABEL.strikes : null,
    expiration === null ? PLAN_FIELD_LABEL.expiration : null,
  ].filter((x): x is string => x !== null);
  return {
    expiration,
    strike,
    right,
    contractWithheldReason: unnamed.length ? prefillUnnamedReason(unnamed) : null,
    // …stop / target / withheld reasons / provenance / sizingNote / sizeText unchanged…
  };
```

Delete the stale doc-comment sentence at `prefill.ts:51` claiming the dialog "snaps to the nearest
available strike from there" — **the operator does not implement it** (§2.5), and the claim already
misled one council pass.

Run: `npx nx test @convexa/dashboard -- prefill.absence` → green;
`npx nx typecheck @convexa/dashboard` → **expected: errors in `TradeEntryDialogView.tsx` only** (that is
F11's red state). An error anywhere else means F0.5 failed → stop and report.

**Commit:** `feat(trading): the prefill seam carries null for a field the read never named`

*Reviewer should probe:* `AiPrefill` and `EntryPrefill` were widened **identically** — they are related
only structurally, and a divergence breaks `useTickerTradeFlows.ts:67-68` at compile time, which is the
desired failure mode; `strikes.find(Number.isFinite)` mirrors the server predicate rather than
reproducing `strikes[0]`.

---

### F11 — the dialog: seeds, the submit predicate, the cascades (AC-12a/b/c/f, AC-13, AC-37)

**File:** `features/trading/tradeEntry/TradeEntryDialogView.tsx` only.

**Step 1 — the seed lines** (`:207`, `:214`, `:215`). The dialog branches on **prefill presence**, not
on the field value — `??` cannot express that (it fires identically on `null` and `undefined`):

```tsx
    // `prefill === undefined` (opened directly, not via Accept) keeps today's nearest-strike /
    // first-expiration / `call` defaults BYTE-IDENTICAL (AC-13). A prefill that arrived with a field
    // the read never named seeds the draft's own empty sentinel, which the confirm control rejects.
    const exp = prefill ? (prefill.expiration ?? '') : (expirations[0] ?? '');
```
```tsx
        strike: prefill ? (prefill.strike ?? '') : nearest,
        right: prefill ? (prefill.right ?? '') : 'call',
```

The `||` chain at `:207` **must** go: `''` is falsy and would fall back to `expirations[0]`, which is
precisely the "a real date the rec never named" defect.

**Step 2 — the submit predicate** (`:362-364`) gains **exactly one conjunct**:

```tsx
  /** Every OPTION leg must name its contract; an equity leg has no contract to name. `!!d.right` is
   *  the new conjunct: `right` is the one contract field the predicate could not see, and the `''`
   *  sentinel is falsy, so the same shape serves. The strike and expiration arms are UNCHANGED —
   *  the seam maps their unstated case onto values those arms already reject. */
  const everyLegAddressed = legs.every(
    (d) => d.qty >= 1 && (d.kind === 'equity' || (d.strike !== '' && !!d.expiration && !!d.right)),
  );
```

**Step 3 — the cascades.** A type change is not local. Five sites, four of them edits:

| Site | Edit |
|---|---|
| `:317` | `right: isOption ? (d.right === '' ? null : d.right) : null,` — mirrors the shipped strike narrow one line above. Submit already rejects `''`, but TypeScript cannot know that, so the narrow is required, not defensive. |
| `:421` | `right: d.kind === 'option' ? (d.right === '' ? null : d.right) : null,` |
| `:241` | `if (!open || !expiration || strike === '' || right === '') return;` — **discovered by this plan, not named in §2.5**: `:245`/`:254` pass `right` into `fetchTrackedContract({ …, right: OptionRight })` (`convexa.ts:1230`) and `resolveMarketFill(…, right: OptionRight, …)` (`positions/entry.ts:29`). The added disjunct both fixes the type and is behaviourally right: an unnamed direction has no contract to quote. |
| `:395` | `if (goodTilInvalid || strike === '' || !expiration || right === '') return;` — **discovered by this plan**: `:400` passes `right` into `OrderEntrySubmit.right: OptionRight` (non-nullable, via `OrderContract`). Mirrors the shipped `strike === ''` guard on the same line. |
| `:635` | **no edit.** `''` is not nullish, so `prev[0]?.right ?? 'call'` propagates the unstated direction to an added leg — correct behaviour (the added leg is equally unsubmittable) and type-safe. |

**Step 4 — the reason region.** Immediately after the `+ Add leg` button (`:645`), mirroring the shipped
withheld-reason treatment at `:797-805`:

```tsx
          {/* rec-absence-literals-hole (AC-12a/b/c/d) — the read named no contract field(s): ONE line,
              literal-agnostic on purpose so the copy stays owned by `ai-rec/copy.ts` and this file
              never re-spells it. An unexplained blank reads as a bug rather than a refusal. */}
          {prefill?.contractWithheldReason && (
            <Typography
              variant="caption"
              data-testid="entry-contract-withheld"
              sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
            >
              {prefill.contractWithheldReason}
            </Typography>
          )}
```

Run: `npx nx typecheck @convexa/dashboard` → exit `0` (F10's errors clear).
`npx nx test @convexa/dashboard` → the tradeEntry / positions / orders specs must stay green apart from
any that asserted the old `right: 'call'` default **on an AI-prefill path** — those are the feature
working; update them and say so. A red on the **no-prefill** path is AC-13 failing → fix the code, never
the assertion.

**Commit:** `feat(trading): the entry dialog leaves a never-named contract field unseeded and unsubmittable`

*Reviewer should probe:* the two discovered cascade sites (`:241`, `:395`); that the strike and
expiration conjuncts are untouched; that `newDraft()`'s `'call'` default survives; that
`ai-rec.grounding.spec.tsx` still passes **unedited** (F15).

---

### F12 — Layer 4: the submit-gate guard (AC-12f, SB)

**File:** new `apps/dashboard/src/app/features/trading/tradeEntry/submitGate.spec.tsx`.

This is the guard a build lane can skip while every other AC reads green. It drives the **real dialog**
and asserts the **confirm control**, never the predicate expression.

Header comment: *Layer 4 (SPEC §7, AC-12f) — the submit gate itself, proven. A build lane can widen the
types and render an empty-looking control without ever re-deriving this predicate; only this guard
notices.*

Arms:

1. **unstated strike** — render `<TradeEntryDialog open prefill={{ expiration: '2026-07-18',
   strike: null, right: 'call', … }} …/>`; the confirm button (`Open simulated position`) is
   **disabled**.
2. **unstated expiration** — same with `expiration: null` → disabled.
3. **unstated direction** — same with `right: null` → disabled, **and** the Call/Put toggle has no
   pressed button (`within(toggleGroup).queryAllByRole('button', { pressed: true })` is empty).
4. **the bias-only case** — prefill built by `recToPrefill({ structure: null, bias: 'short', … })`:
   confirm disabled. This is the one `biasToRight` path that still produced a submittable direction
   after the enumerated `:45` fix.
5. **non-vacuity, in the same run** — a fully-stated prefill plus a typed manual price: confirm
   **enabled**. Without this arm the four rows above pass on a dialog that never enables.
6. **typing clears the refusal** — arm 3 plus a user click on `Call` and the remaining fields filled:
   confirm becomes enabled. The surface is never a dead end.

**The poison (run it, record it, revert it):** remove `&& !!d.right` from `:363` → arms 3, 4 and 6 red
while arm 5 stays green. Then remove `&& !!d.expiration` → arm 2 reds. Then `d.strike !== ''` → arm 1
reds. Restore byte-identically (`git diff --exit-code`).

Run: `npx nx test @convexa/dashboard -- submitGate` → green (6 tests).
**Commit:** `test(trading): Layer 4 — prove the confirm control rejects every unstated contract field`

---

### F13 — Layer 2: the label-anchored render guard (AC-16, AC-17)

**File:** new `.../ai-rec/reservedMark.render.spec.tsx`.

Mechanism: for each **enumerated** field, find the label element by its rendered label string, then read
the value element via the shipped two-hop walk (F0.3). The conviction slot resolves via the chip label
or the suppressed-chip `<p>`; the `no_trade` hero conviction resolves via `data-testid` (R-5).

```tsx
const RESERVED = '—';

/** Copied from `ai-rec.grounding.spec.tsx:114-120` — the SHIPPED traversal, not a guessed one. */
function fieldValueEl(label: string): HTMLElement { /* …verbatim… */ }

function convictionValueEl(): HTMLElement {
  const box = within(panel()).getByText(PLAN_FIELD_LABEL.confidence).parentElement as HTMLElement;
  const el = box.querySelector('.MuiChip-label') ?? box.querySelector('p');
  if (!el) throw new Error('no conviction value element');
  return el as HTMLElement;
}

/** The enumeration, DECLARED — arm (a)'s subject. A guard that resolves five of six and passes as
 *  "non-empty" is not enforcement. Five plan labels + five risk labels; the conviction slot resolves
 *  separately (it is a chip, not a `Field`), for eleven in total on a trade card. */
const TRADE_SLOTS = [
  PLAN_FIELD_LABEL.structure,
  PLAN_FIELD_LABEL.strikes,
  PLAN_FIELD_LABEL.expiration,
  PLAN_FIELD_LABEL.entryTrigger,
  PLAN_FIELD_LABEL.timeHorizon,
  COPY.risk.maxRisk,
  COPY.risk.invalidation,
  'Suggested size',
  'Target',
  'Stop',
];
const NO_TRADE_SLOTS = [COPY.risk.maxRisk, 'Suggested size', 'Target', 'Stop'];
```

Three non-vacuity arms, each its own `it`:

- **(a) coverage with an exact count.** On `recNoneNamed()`: every label in `TRADE_SLOTS` resolves,
  `resolved.length === TRADE_SLOTS.length` **and** `=== 10`, plus `convictionValueEl()` resolves → 11.
  On `noTradeRec()`: all of `NO_TRADE_SLOTS` resolve, `=== 4`, plus
  `getByTestId('no-trade-conviction')` → 5, and each of the five plan labels `queryByText` is **null**.
- **(b) the poison** — documented in the header and executed in F16: restore
  `value={s.structure ?? '—'}` at one of the six sites → this guard reds; restore the code → green.
- **(c) non-empty text** — every resolved slot has `textContent.trim().length > 0`.

**The rule** (its own `it`): across `recNoneNamed()`, `recHalfNamed()`, `recCandidateSetEmpty()`,
`recNoFieldReasonsBlock()`, `recBlankValues()`, `recOffScaleConfidence()` — no resolved value slot
contains `RESERVED`. On `noTradeRec()` — exactly the four risk slots contain `RESERVED` and the hero
conviction does not. **Card-level lines, tooltips and reasoning prose are outside the queried set by
construction** (the walk only ever reaches a `Field`'s value `<p>` or the chip label), not by exemption
— assert that positively: on the `no_trade` card, `panel().textContent` **does** contain `RESERVED`
while the resolved plan slots do not, so the guard cannot be passing because nothing resolved.

Run: `npx nx test @convexa/dashboard -- reservedMark.render` → green.
**Commit:** `test(ai-rec): Layer 2 — the label-anchored reserved-mark render guard, with coverage count`

*Reviewer should probe:* the count assertions are literal integers **as well as** `.length`
comparisons — a mislabeled enumeration must not be able to agree with itself.

---

### F14 — Layer 3: the narrow source-pattern scan (AC-17)

**File:** new `.../ai-rec/emDashCoalesce.scan.spec.ts`.

Targets the **coalescing pattern**, not the character — silent against the ~135 legitimate punctuation
em-dashes in this folder (`copy.ts` 50, `AiRecPanel.tsx` 57, `literals.ts` 28), so it ships no standing
red. Follows the shipped `bannedWords.scan.spec.ts` idiom (`import.meta.glob` with
`{ query: '?raw', import: 'default', eager: true }`, a `.spec.` filter, `stripComments`, **two**
anti-vacuity tests) but **not its rule**.

```ts
const RAW: Record<string, string> = import.meta.glob('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const EM = '—';

/** Normalize CR-LF to LF, then the escape and entity spellings to the literal character, so the
 *  pattern cannot be evaded by respelling it. `core.autocrlf = true` and there is no `.gitattributes`
 *  — the `ai-rec-grounding` guard-8c pin failed closed on a fresh Windows checkout for exactly this. */
function normalize(src: string): string {
  return src
    .replace(/\r\n/g, '\n')
    .replace(/\\u\{?2014\}?/gi, EM)
    .replace(/&mdash;/gi, EM)
    .replace(/&#8212;/g, EM)
    .replace(/&#x2014;/gi, EM);
}
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}
const coalesce = () => new RegExp(`\\?\\?\\s*(['"\`])\\s*${EM}\\s*\\1`, 'g');
```

Tests:

1. **anti-vacuity 1** — the glob found ≥10 non-spec files, including `./AiRecPanel.tsx`,
   `./literals.ts`, `./copy.ts`.
2. **the rule** — no non-spec file under the folder matches, after `normalize` + `stripComments`.
3. **anti-vacuity 2 (the mutation)** — the matcher DOES fire on a poison written in **escaped** form
   and on each respelling:

```ts
    for (const poison of [
      `value={s.structure ?? '${EM}'}`,
      'value={s.structure ?? "\\u2014"}',
      "value={s.structure ?? '&mdash;'}",
      `value={s.structure ?? '${EM}'}\r\n`,
    ]) {
      expect(normalize(poison).match(coalesce()), poison).not.toBeNull();
    }
```

4. **the bound, stated** — the scan does **not** fire on prose punctuation
   (`Not pre-filled ${EM} the read named no Strike(s).`), proving it is not the character-level scan §7
   rejects.

**Bound, recorded in the file header:** folder-scoped and evadable by rewriting the expression.
**AC-17 does not lean on it** — Layer 2 is the DOM-output assertion no source rewrite can evade.

Run: `npx nx test @convexa/dashboard -- emDashCoalesce` → green (4 tests).
**Commit:** `test(ai-rec): Layer 3 — the coalescing-pattern scan with its two anti-vacuity arms`

---

### F15 — the shipped path pin (`ai-rec.grounding.spec.tsx:516`)

**Default expectation: NO edit.** The pin is a set-equality over files that **export** a
`/^TradeEntry.*Dialog$/` function; this feature edits `TradeEntryDialogView.tsx`'s body and adds no
exporter, so the pin should hold **unedited**.

**Procedure:**

1. `npx nx test @convexa/dashboard -- ai-rec.grounding` → expected green, and
   `git diff --exit-code apps/dashboard/src/app/pages/ticker/widgets/ai-rec/ai-rec.grounding.spec.tsx`
   → expected clean.
2. **If it reds, STOP.** Do not edit the array to make it pass — this project has a recorded incident
   where the tempting fix satisfied a guard's NAME and destroyed its BEHAVIOUR. Report which fact
   changed.
3. **Re-prove the pin once, regardless** (this is the "pin re-proved" §2.6 asks for): add a scratch
   `export function TradeEntryScratchDialog() {}` under `features/trading/`, run the guard, record that
   it reds naming the scratch file, delete the scratch, re-run, record green, confirm `git status`
   clean.

**Commit:** none if no edit was needed; the drill is reported at V2.

---

### F16 — the Layer 1/2/3 poison drill

No production change. Execute, record the observed failure text, and revert each byte-identically.

| # | Layer | Poison | Must red |
|---|---|---|---|
| P-F1 | 1 (type) | at the Structure row, replace `<PlanField …/>` with `<Field label={PLAN_FIELD_LABEL.structure} value={s.structure ?? '—'} />` | `npx nx typecheck @convexa/dashboard` (`Type 'string' is not assignable…`) **and** `npx nx test -- reservedMark.render` — AC-17's *two independent places* |
| P-F2 | 2 (coverage) | drop `PLAN_FIELD_LABEL.timeHorizon` from `TRADE_SLOTS` | the coverage arm reds on the **count**, not on emptiness |
| P-F3 | 3 (scan) | add `const y = X.a ?? '—';` to `literals.ts` | `npx nx test -- emDashCoalesce` |
| P-F4 | rule | point `planFieldLiteral`'s `unavailable` arm at `{ kind: 'not_given' }` | F9's AC-4 pairwise-distinctness row — collapsing any two conditions onto one literal must be visible |

After each: `git checkout -- <file>` and confirm `git diff --exit-code` before the next.

**Commit:** `test(ai-rec): record the four-layer poison drill` (the body carries the observed failures;
no source change survives).

---

### F17 — frontend lane close-out

```powershell
npx nx typecheck @convexa/dashboard ; $LASTEXITCODE
npx nx lint @convexa/dashboard ; $LASTEXITCODE
npx nx test @convexa/dashboard ; $LASTEXITCODE
npx nx build @convexa/dashboard --configuration=production ; $LASTEXITCODE
npx nx format:write --files <the changed files, comma-separated>
git diff --stat $BASE -- apps/dashboard/src/app/pages/ticker/widgets/gex-profile-chart apps/dashboard/src/app/shared
```

Expected: exit `0` everywhere; the F0.1 red-file list unchanged and no new red file; pass count =
F0.1 + ~50 (F2 5, F3 7, F9 ~20, F10 6, F12 6, F13 5, F14 4). The last `git diff` is expected **empty** —
this feature reaches neither the chart nor the shared kernel. **Never run a bare `nx format:write`**: one
bare run reformatted 92 unrelated files.

---

## Track V — verification

Every step names its command and its expected output. "Run the suite" is not a verification step.

### V1 — the commands and their expected outputs

```powershell
npm run ports:free                                          # before any run-the-app step
cargo check -p api-rust --features postgres                 # exit 0
cargo test -p api-rust -p quant-engine                      # exit 0; api-rust = B0.1 + 14
npx nx typecheck @convexa/dashboard                         # exit 0 — a green nx test does NOT typecheck
npx nx lint @convexa/dashboard                              # exit 0
npx nx test @convexa/dashboard                              # exit 0 modulo the F0.1 baseline red list
npx nx build @convexa/dashboard --configuration=production  # exit 0
npm run ci                                                  # lint → typecheck → test → build → bundle
```

**Expected FE outcome, stated honestly:** the F0.1 baseline was ~1700 passing with **5 accepted
pre-existing red spec files** (a 6th was reported as a new regression — if it is present at F0.1 it is
in the baseline and is **not** this feature's; if it is absent at F0.1 and present here, it **is**).
Report the number, the red-file list and the exit code — **never the word "green" alone**. If
`app.risk.spec.tsx` is the only failure, re-run it alone first (proven load-sensitive flake). If a port
is busy, `npm run ports:free` — orphaned dev servers serve stale code and have fed a verification pass
before.

### V2 — the poison matrix (the deliverable, not decoration)

One table in the GATE Q report with the **observed** failure text for every row: B5's P-B1…P-B6, F16's
P-F1…P-F4, F12's three predicate-conjunct poisons, F15's path-pin re-proof. Each row records: poison
applied · command · observed red · restore · observed green · `git diff --exit-code` clean. **A guard
with an empty "observed red" cell is not done.**

### V3 — grounding byte-identity (AC-31, SB)

1. `git diff --exit-code apps/api/src/services/rec_inputs/grounding.rs` → **clean** (the `checked == 4`
   guard passes UNEDITED).
2. `cargo test -p api-rust the_denominator_excludes_the_dollar_risk_figure_and_the_suggested_size` →
   identical output to B0.3.
3. On the GATE-Q captured response (V4 layer 2, or the in-process fixture if no key material):
   `grounding.counts` is identical to the pre-feature baseline captured **on the same request shape**,
   and the card's `n of m` pair prints the same two integers. AC-31 pins **unchanged-ness against an
   observed baseline**, never a remembered integer — capture the baseline from `$BASE` first.
4. None of the six appears in `grounding.fields` or in `counts`.

### V4 — the endpoint's own payload (INTERFACE_CONTRACT §1a, three layers)

- **Layer 1 (ship-blocking, always available):** B3's four `envelope_extras` tests — every key,
  spelling, token, order and totality claim asserted in-process, with no key and no network.
- **Layer 2 (live HTTP, key-gated):** with key material configured, `npm run ports:free ;
  npx nx serve api`, POST one real rec, and walk the captured body against the §1a path list plus its
  five cross-checks (eleven keys; `reason` ∈ the closed set with `unrecognized_value` on `confidence`
  only; `missing_input` non-null iff `unavailable`, and `candidate_set` on `strikes`/`expiration` only;
  no `unavailable` on a `local_rules` card; `grounding.counts` equal to the baseline). Commit the
  receipt beside the contract.
- **The named gap:** with no resolvable key material, layer 2 **cannot run** and nothing observes the
  live HTTP body. Record it as **not-run with that reason**. It is never recorded as a pass.
- **Layer 3 (the runner block):**

```powershell
npm run ports:free
npx nx serve api      # :8000, needs a working DATA_PROVIDER key
node .claude/tools/interface_conformance.mjs `
  --contract .spire/clusters/tech/contracts/rec-absence-literals-hole/INTERFACE_CONTRACT.md `
  --url http://127.0.0.1:8000 `
  --report .spire/clusters/tech/contracts/rec-absence-literals-hole/conformance-receipt.json
```

Expected: both endpoints pass. Endpoint order is load-bearing (the ticker read warms the snapshot the
status read serves from); neither is `"auth": true`, so no `--auth-cookie`. **A green receipt here is
necessary and not sufficient.**

**Cost warning carried into every gate report:** the `AI_REC_LOCAL_ONLY` fixture is **not free** — it
spends no provider money and makes no provider call, but it **requires configured key material and
consumes one in-process cap unit** (`recommendation.rs:704` returns the unavailable envelope before the
local-only branch unless `resolved.usable()`, and `commit_query()` runs on that path), and the
`no_fresh_edge` gate and the cooldown short-circuit ahead of it. **No criterion may describe it as free.**

### V5 — score / tier / fingerprint identity (AC-20, AC-36, SB)

```powershell
git diff --stat $BASE -- libs/quant-engine
git diff --stat $BASE -- apps/api/src/services/signals apps/api/src/routes
```

`$BASE` is the pre-work commit from B0.1/F0.1 — **not** `main` (a lane committing onto `main` would make
this vacuously empty, i.e. a false green on a ship-blocking row). Expected: both print nothing. Then,
for one ticker before and after (or from the V4 layer-3 receipt), `signals.opportunity_score`,
`signals.opportunity_tier` and `ai_eval.state_fingerprint` are byte-identical. They are served on a
**different endpoint** that gains zero new bytes, and the rec is not a fingerprint input at all.

### V6 — SSE identity (AC-8)

Covered in-process by F9's AC-8 row. Additionally confirm by inspection that no new field reaches the
SSE payload builder (`rg -n "field_reasons|entry_trigger|time_horizon" apps/api/src` shows no hit in any
live/SSE module). Every datum here is STATIC, pinned to the rec's snapshot.

### V7 — the review rows (AC-9/12d/15/18/19/21/27/29/34/35)

A written walk in the GATE Q report, one paragraph each, with a screenshot or a rendered-text quote:

- **AC-9** stale / stale-born / superseded: the six unchanged; only the existing strips change.
- **AC-12d** the entry reason line names no cause — **and flag R-7's plan-authored wording for UX**.
- **AC-15** both card-level lines render, never merged, at most two on any card.
- **AC-18** the distinct absence strings are the shipped closed set **plus exactly `unrecognized`** —
  **not closeable until V8's Amendments row exists.**
- **AC-19** the non-rec states (unavailable, error, cooldown, cap, no key, signed-out) show current copy
  and no absence literal from this feature.
- **AC-21** the omission-rate artifact (V9).
- **AC-27** the DTE caption reads as a statement about the **request**, not a containment claim.
- **AC-29** every absence literal is real text in the value slot, ≥11px, contrast-passing in **dark and
  light** — walk both themes.
- **AC-34** the tip on all six is producer-neutral; `RISK_FIELD_COPY` and the four shipped risk fields
  are unchanged (`git diff $BASE -- copy.ts` shows additions only).
- **AC-35** composition review on the local-rules card (`trade`, `strikes: []`, `expiration: null`):
  literals present, tip contradicting nothing, coherent beside the shipped local-rules line. **This
  fixture requires configured key material and consumes one cap unit** (V4).

### V8 — the one required canon event (AC-18's precondition)

**At approval only.** Append to `.spire/clusters/tech/context/DESIGN_SYSTEM.md` `## Amendments`
(`:162`), verbatim:

> One new member of the closed not-a-number vocabulary — `unrecognized` (the read named a conviction
> outside Convexa's scale). Emittable from exactly one place (the confidence enum validation) so it
> cannot become a second `unavailable`.

Cause: `rec-absence-literals-hole`, decisions.md §C #21. **Until that row exists, AC-18 is not
closeable.**

### V9 — AC-21, the omission artifact, recorded honestly

Across whatever trade-verdict recs the gate actually observes, record how many carried an unnamed
position-defining field, and record **N honestly** — no floor, no threshold, non-gating. A zero observed
rate on the model path does **not** retire the feature. If the gate observed only local-rules cards, say
exactly that.

### V10 — the binding record rule (SPEC §9.1)

**No gate report, ledger row or BACKLOG line may record `ai-rec-grounding` SPEC §9 item 5 as closed
while half two stands.** Half one (the false not-applicability verdict on absent fields) closes here;
half two (generalizing *"no clause means checked"* onto **stated** structure / trigger / horizon /
conviction) does **not**, because the unconditional scope caption was cut on line budget. Record it as
**half one closed, half two a named surviving residual.**

---

## Appendix — task/file matrix (collision check)

| File | Tasks |
|---|---|
| `apps/api/src/services/rec_inputs/field_reasons.rs` | B1, B2 |
| `apps/api/src/services/recommendation.rs` | B3, B4 |
| `libs/api/src/lib/convexa.ts` | F1 |
| `…/ai-rec/copy.ts` | F2, F4 |
| `…/ai-rec/literals.ts` | F3 |
| `…/ai-rec/AiRecPanel.tsx` | F5, F6, F7 |
| `…/ai-rec/fixtures.ts` | F8 |
| `…/ai-rec/prefill.ts` | F10 |
| `…/trading/tradeEntry/types.ts` | F10 |
| `…/trading/tradeEntry/TradeEntryDialogView.tsx` | F11 |
| new spec files | F2, F3, F9, F12, F13, F14 |
| `.spire/…/DESIGN_SYSTEM.md` | V8 (at approval) |

No file appears in both tracks. `useTickerTradeFlows.ts` needs **no edit** — it is on the §2.6
allow-list because it is the Accept path, and F0.5 verifies it compiles unchanged against the widened
seam. `LegFields.tsx` and `reasoning.tsx` are **read, not edited**; a cast at `LegFields.tsx:162` is the
only edit either may receive, and only if F0.4 demands it.
