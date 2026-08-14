# ai-rec-grounding — implementation plan

**Spec:** `.spire/clusters/tech/contracts/ai-rec-grounding/SPEC.md` (approved 2026-08-13; amended at GATE Z; **D8 folded** — binding, never edited by a lane)
**Interface:** `.spire/clusters/tech/contracts/ai-rec-grounding/INTERFACE_CONTRACT.md` (locked FE↔BE truth; **unchanged by the GATE Z amendment and by D8**)
**Council:** `council/decisions.md` (T0–T25, D1–D8) · **Skeptic:** `council/S2-findings-pass2.md` (PASS) · **GATE Z:** `SYNTHESIZER_AMENDMENTS_REQUESTED.md`

**Goal.** At serialization, every price-scale number the AI recommendation asserts either resolves to a
figure Convexa computed — and the card names that figure and its value — or it renders in place, marked
as the AI's own, never as one of Convexa's numbers. And where such a number would stop being a display
and become an **input**, it is withheld with its reason.

**Architecture shape.** One new pure leaf `apps/api/src/services/rec_inputs/grounding.rs` (sixth sibling,
same purity contract as the other five) resolves five `RecField`s against the anchors read off the **sent**
`market_state` and the **pruned** straddle move, folds a card-level token plus four integers, and is
consumed by exactly one caller — `envelope_extras` in `recommendation.rs`, which grows from a 3-tuple to a
4-tuple and is called only from the `base` closure, the sole envelope constructor on all six return paths.
The browser renders every state through a **closed lookup on a wire token** and never counts, compares,
re-derives or folds. The shared simulated entry dialog's stop/target prefill becomes **gated on that
figure's grounding state**, and a withheld field says why — in one of **three** distinct reasons. The
folded-in `max_risk` fix widens the parser's **output** (`RiskRefusal`) and adds a single-dollar-figure
directive to the sent prompt; the accepted input set does not move by one input.

**Stack.** Backend `apps/api` (Rust, Axum/Tokio, crate `api-rust`, `npx nx serve api`, :8000 — **verify on
:8010**). Frontend `apps/dashboard` (React 19 + Vite + MUI, `npx nx serve @convexa/dashboard` :4200,
`npx nx test @convexa/dashboard`) plus the shared TS client `libs/api` (`@convexa/api`, source-consumed).

**Tracks — 48 items.** Backend **B1–B16**, Frontend **F1–F17**, Verification **V1–V15**. The two lanes run
in PARALLEL: no F-item reads a B-item's internals — every F-item binds only to the token spellings and
nullability rules in `INTERFACE_CONTRACT.md`, which F2 encodes as types on day one. **The gated prefill
(F15–F17) needs no new contract field** and therefore gates on no B-item.

---

## GATE Z — both items RESOLVED 2026-08-13; `F-BZ1` / `F-BZ2` unparked. D8 folded.

Record: `SYNTHESIZER_AMENDMENTS_REQUESTED.md` and `council/decisions.md` §D8. `SPEC.md` amended (AC-7,
AC-32, AC-36, new AC-68, §1, §4, §8, §9 item 7; then §4 + AC-68 again for D8).
`INTERFACE_CONTRACT.md` untouched throughout. AC numbering is stable — AC-1…AC-67 unchanged apart from
AC-7/32/36, AC-68 appended and then amended in place — so every B/F/V reference in this plan resolves.

- **Z1 → Reading A.** The stop/target prefill is **gated on the figure's grounding state**: `traced` seeds
  exactly as on `main`; `untraced` / `not_checkable` does **not** seed; `not_applicable` is unchanged
  (there was nothing to seed). **AC-68** requires a withheld field to open **empty with a one-line reason
  beneath it**, never a silent blank. **`F-BZ1` became F15 · F16 · F17** (plus the literals in F3 and the
  `prefillGate` lookup in F4). No wire change; `single-shared-sim-entry-dialog` held as an **additive gate
  on the one shared dialog, never a fork**; `no-real-order-path` untouched.
- **D8 → the block-absent branch gets its OWN third literal.** A response carrying **no grounding block**
  withholds the seed **and states why**, in its own words:
  `Not pre-filled — this read wasn't checked against Convexa's numbers.` — borrowing the card-level
  member's exact tail so the dialog and the card name one fact the same way. Reusing the `not_checkable`
  literal there would be the `absent-is-not-none` collapse the card's own `couldn't check` vs
  `wasn't checked` split exists to prevent. **Non-negotiable, restated in every item that touches it:
  block-absent still NEVER licences a pre-fill. D8 adds an explanation, never a seed.**
  Touched by this ruling: **F3** (the third literal), **F4** (the lookup arm + a five-arm test with
  three-way disjointness), **F16** (the third reason line), **F17 arm 4** (asserts the reason line, not
  merely the absence of a seed), **V3 row `F-c`** (the poison drill covers all three). Nothing else moves.
- **Z2 → criteria corrected, export not widened.** AC-32 is reduced to its verifiable residue (no
  grounding wire token ever renders as user-visible text; every surface stating a grounding fact does so
  through the closed literal set) — planned as an assertion in **F10**. AC-36's "visible on the export
  surface" clause is **struck**; both ship-blocking halves survive and are **B5, unchanged**. `F-BZ2` is
  closed with no new item.
- **Do not chase the withdrawn clauses.** No item may add the strategy, the grounding states or the
  system prompt to `GET /api/recommendation/export/{ticker}` or to `StateExportDrawer`. **AC-5's export
  half is vacuously true** (no artifact carries a clause at all) — V14 reviews only its card half.

**No open ambiguity remains in this plan.** The one residue the previous revision flagged (the missing
block-absent literal) is closed by D8. One **planning call**, made rather than defaulted, is recorded at
F4: an *unrecognized* state token — unreachable from a conformant server, since the wire enum is closed —
is treated as **not seeded, no reason line**, following the discipline this feature already establishes
three times over (`capSurface`, `figureClause`, `cardGroundingLine` all render nothing on an unknown
token, "never a guess"). It is safe on the axis that matters: it never seeds.

---

## Global Constraints (binding on both lanes)

### The conformance spec — copied VERBATIM from `INTERFACE_CONTRACT.md` § "Conformance spec"

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

### Rules neither lane may relax

1. **Closed vocabularies are authoritative on the wire.** The FE renders every state, reason, basis,
   anchor and card member by closed lookup on the token; it never re-derives a label from a scalar, never
   picks a literal by inspecting a `null`, never compares two figures, never counts. Exactly **one**
   branch is client-selected: `grounding` absent from the response (a lookup on **presence**).
2. **The grounding block is total and never omitted.** Emitted by the `base` closure
   (`recommendation.rs:617-652`); every field carries a member on every branch. An unavailable input is
   `not_checkable` **on the affected field** — never an omitted block, never a missing member, never an
   HTTP error. There is no "the check failed" state (the leaf is pure, total, no `Result`).
3. **Ground against what was SENT.** `pruned_move` (`recommendation.rs:582`), never `raw_move` (`:580`);
   the `CandidateBudget::Prompt` set, never `Handoff`. Containment anchors on `StraddleMove::anchor_spot`
   off the type, never `market_state.price`.
4. **Fixed evaluation orders are part of the contract** — for the two headline enums **and inside each
   per-field rule**. First match wins. `DO NOT REORDER`.
5. **`Traced` / `Untraced`, never `Verified` / `Unverified`.** No user-facing string in the ai-rec module
   may contain `verified`, `confirmed`, `validated`, `approved`, `safe`, `trusted`, `grounding`,
   `hallucinated`, `suspect`, `invalid`; no check glyph renders anywhere. **No grounding wire token ever
   renders as user-visible text** (AC-32, amended).
6. **Nothing here is live, nothing here is a scoring input.** No field appears on the SSE payload;
   `opportunity_score` / `opportunity_tier` / `state_fingerprint` stay byte-identical on both bundle
   branches, **and `apps/api/tests/score_identity.rs`'s own diff stays empty**.
7. **Numbers ride the wire as numbers, rounded server-side to 2 decimals**, printed verbatim by the
   client with no arithmetic.
8. **No wildcard arm and no documented exemption** on `match RecField`. Nine structural guards (SPEC
   §2.6), each poison-proved: poison it, the build goes RED, restore byte-identically.
9. **The shared entry dialog IS touched, the only permitted way** (SPEC §8, amended): an **additive gate**
   on the one `features/trading/TradeEntryDialog`, expressed through its **existing prefill input**. Never
   a second dialog, never a fork, never a real-money variant, never a mode that blurs the simulated/real
   boundary. `no-real-order-path` is untouched — the gate withholds a *value* inside the simulated dialog.
   **An absent grounding block is never a licence to pre-fill** (D8); it licences an explanation only.
10. **No egress surface grows.** The export endpoint and `StateExportDrawer` are unchanged;
    `egress-copy-tracks-payload` stays un-engaged (SPEC §8, §9 item 7).

### Environment traps — read before running anything (`CLAUDE.md` + the last feature's scars)

- **A green `nx test` does NOT mean the types are sound.** `npx nx typecheck` is a separate mandatory
  step; `cargo check -p api-rust --features postgres` likewise.
- **Check EXIT CODES, not printed summaries.** A suite once printed `1004 passed` while exiting non-zero.
  `$LASTEXITCODE` (PowerShell) / `echo $?` / `PIPESTATUS`, always.
- **An orphaned `api-rust` (PID 58588, unkillable) holds :8000**, serves stale code, and rewrites
  `data/scan.json` several times a minute. **Serve and verify on :8010**:
  `cargo run -p api-rust -- serve --bind 127.0.0.1:8010`. Any naive before/after byte check on
  `data/scan.json` produces a **false failure** — do not write one.
- **`npm run ports:free` is IPv4-only** and Vite binds IPv6 (`localhost:`, not `127.0.0.1`).
- **NEVER `git stash`** — a lane's stash/restore/drop destroyed the conductor's uncommitted work last
  feature. Use targeted `git checkout -- <file>` or a separate worktree.
- **Dashboard baseline: 1639 passing + 5 accepted pre-existing red files** (`readonly.spec.tsx`,
  `positions.risk.spec.tsx`, `grouping.integration.spec.tsx`, `stage3-amber.spec.ts`,
  `orders.risk.spec.tsx`). A **6th** red file is a new regression.
- **Stale `tsc --build` outputs produce phantom TS2353/TS6305 errors** — delete `apps/dashboard/dist`,
  `out-tsc`, `*.tsbuildinfo` and rebuild `tsconfig.app.json` before `tsconfig.spec.json`.
- **NEVER a bare `nx format:write`** — always `npx nx format:write --files path/a,path/b`.
- **No literal NUL bytes** in any file this feature writes. Verify:
  `python -c "import io;print(io.open('FILE','rb').read().count(bytes([0])))"` → `0`.

### Working discipline

TDD per item: write the failing test → run it, watch it fail → implement minimally → run it, watch it
pass → commit. One item = one commit. If the plan contradicts the tree, **report the conflict — never
resolve it silently**.

---

# TRACK B — backend (`apps/api`, crate `api-rust`)

> **Unmoved by D8.** No B-item changes: the third prefill arm is the *absence* of the grounding block, a
> presence check on data already specified. `INTERFACE_CONTRACT.md` is untouched.

## B1 — Preflight: capture the baseline (no code change)

**Files:** none. **Depends on:** nothing.

```powershell
cargo check -p api-rust --features postgres ; $LASTEXITCODE
cargo test  -p api-rust ; $LASTEXITCODE
git diff --stat -- apps/api/tests/score_identity.rs
```

**Expected:** both exit `0`; the third prints **nothing** (guard 6 arm (b) baseline). Record the
`cargo test` pass count; every later B-item states its delta against it.

**Reviewer probe:** if `cargo test -p api-rust` is already non-zero on a clean tree, STOP and report —
every "watch it go green" step below is unreadable against a red baseline.

---

## B2 — `RecField::InvalidationLevel` (D1, ship-blocking) + the fifth `field_reasons` key

**Files:** `apps/api/src/services/rec_inputs/field_reasons.rs`, `apps/api/src/services/recommendation.rs`.
**Depends on:** B1. **Enforces:** the exhaustive-match precondition for guard 1; the wire key
`field_reasons.invalidation_level`.

**Step 1 — the failing test.** Append to `field_reasons.rs`'s `mod tests`:

```rust
    #[test]
    fn invalidation_level_is_a_first_class_field_and_never_reports_a_missing_input() {
        let p = InputPresence { risk_block: false, candidate_quotes: false, straddle_move: false };
        let r = field_reason(RecField::InvalidationLevel, false, p).unwrap();
        assert_eq!(r.reason, ReasonKind::NotGiven);
        assert!(r.missing_input.is_none());
        assert!(field_reason(RecField::InvalidationLevel, true, p).is_none());
    }
```

`cargo test -p api-rust field_reasons` → **RED** (`no variant named InvalidationLevel`).

**Step 2 — implement.** Extend the enum:

```rust
pub enum RecField {
    MaxRisk,
    PositionSize,
    ExitTarget,
    ExitStop,
    InvalidationLevel,
}
```

and in `field_reason`'s `match field`, beside `RecField::ExitStop => vec![]`:

```rust
        // Market-state levels only, exactly like ExitStop — always present, so never `unavailable`.
        RecField::InvalidationLevel => vec![],
```

**Step 3 — the wire key.** In `recommendation.rs::envelope_extras`, extend the `field_reasons` json
(`:473-478`):

```rust
    let field_reasons = json!({
        "max_risk": fr(RecField::MaxRisk, present(strategy.get("max_risk"))),
        "position_size": fr(RecField::PositionSize, present(strategy.get("position_size"))),
        "exit_target": fr(RecField::ExitTarget, present(strategy.pointer("/exit_plan/target"))),
        "exit_stop": fr(RecField::ExitStop, present(strategy.pointer("/exit_plan/stop"))),
        "invalidation_level": fr(RecField::InvalidationLevel, present(strategy.get("invalidation_level"))),
    });
```

**Step 4:** `cargo test -p api-rust` → GREEN, baseline + 1. **Commit.**

**Reviewer probe:** `present()` is `v.map(|x| !x.is_null()).unwrap_or(false)` — a numeric `0` counts as
present. That is the same predicate grounding uses in B8, which is what makes guard 2's exclusive-or hold.
Do **not** "fix" one side without the other.

---

## B3 — `max_risk.rs`: widen the OUTPUT, move the accepted input set by zero

**Files:** `apps/api/src/services/rec_inputs/max_risk.rs`. **Depends on:** B1. **Enforces:** AC-39 (SB).

**Step 1 — the failing pin test** (written **before** the type changes, so its intent is on the record):

```rust
    /// AC-39 (SB) — the ACCEPTED INPUT SET does not move by one input. Each row pins an input's parse
    /// OUTCOME CLASS; changing any row's outcome reds the build. Widening a refusal's REPORTING is not
    /// loosening the refusal, so the reason is asserted BESIDE the class, never instead of it.
    #[test]
    fn the_accepted_input_set_does_not_move_by_one_input() {
        let cases: &[(Option<&str>, ParsedRisk)] = &[
            (Some("$300"),                    ParsedRisk::Dollars(300.0)),
            (Some("1.5% of account ($300)"),  ParsedRisk::Dollars(300.0)),
            (Some("$1,250.50"),               ParsedRisk::Dollars(1250.5)),
            (Some("$300 ($300)"),             ParsedRisk::Dollars(300.0)),
            (Some("1R defined-risk"),         ParsedRisk::NotParseable(RiskRefusal::NoDollarFigure)),
            (Some("300"),                     ParsedRisk::NotParseable(RiskRefusal::NoDollarFigure)),
            (Some("$300 to $500"),            ParsedRisk::NotParseable(RiskRefusal::MultipleDifferentFigures)),
            (None,                            ParsedRisk::NotParseable(RiskRefusal::NoText)),
        ];
        for (input, expected) in cases {
            assert_eq!(parse_max_risk_dollars(*input), *expected, "parse outcome moved for {input:?}");
        }
        // Anti-vacuity: an accepted and a refused input must not compare equal.
        assert_ne!(parse_max_risk_dollars(Some("$300")), parse_max_risk_dollars(Some("300")));
    }
```

**Step 2 — implement.** Replace `max_risk.rs:4-8`:

```rust
/// Why the ONE parse refused. The output widens so the refusal is renderable; the ACCEPTANCE does not
/// move — which inputs refuse is the ambiguity rule the BRIEF pins as explicitly not reopened.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RiskRefusal {
    NoText,
    NoDollarFigure,
    MultipleDifferentFigures,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ParsedRisk {
    Dollars(f64),
    NotParseable(RiskRefusal),
}
```

Map the three refusal sites — and **only** those three, with no change to any condition:

- `:11` → `let Some(t) = text else { return ParsedRisk::NotParseable(RiskRefusal::NoText) };`
- `:39` → `0 => ParsedRisk::NotParseable(RiskRefusal::NoDollarFigure),`
- `:43` → `_ => ParsedRisk::NotParseable(RiskRefusal::MultipleDifferentFigures),`

Update the shipped assertions at `:71`, `:76`, `:81`, `:91` to name the refusal — **the inputs are
untouched**, only the expected value gains its reason.

**Step 3:** the tree goes RED at `cap_check.rs:27` and `recommendation.rs:452`; both are B4. Land B3+B4
together if the compiler demands it, but keep each file's assertions in its own file.

**Reviewer probe:** diff the `while` loop and the `match vals.len()` **conditions** against `main`. A
single character changed in a condition (not a returned value) is the failure this item exists to prevent.

---

## B4 — `cap_check` consumes the widened output; `cap_check.risk_refusal` on the wire

**Files:** `apps/api/src/services/rec_inputs/cap_check.rs`, `apps/api/src/services/recommendation.rs`.
**Depends on:** B3. **Enforces:** AC-37, AC-38 (SB), AC-40 wire half.

**Step 1 — the failing test** (import becomes `use super::max_risk::{ParsedRisk, RiskRefusal};` at `:2`):

```rust
    #[test]
    fn every_refusal_reason_still_yields_exactly_one_verdict_not_checkable() {
        for r in [RiskRefusal::NoText, RiskRefusal::NoDollarFigure, RiskRefusal::MultipleDifferentFigures] {
            assert_eq!(cap_verdict(true, Some(500.0), ParsedRisk::NotParseable(r)), CapVerdict::NotCheckable);
        }
    }
```

**Step 2 — implement.** `cap_check.rs:27`:

```rust
        ParsedRisk::NotParseable(_) => CapVerdict::NotCheckable, // 3 — the reason rides `risk_refusal`
```

Nothing else in `cap_verdict` changes: five members, same order.

**Step 3 — the wire token.** In `envelope_extras`, replace `:450-453`:

```rust
    let (parsed_dollars, risk_refusal) = match parsed {
        ParsedRisk::Dollars(v) => (Some(v), None),
        ParsedRisk::NotParseable(r) => (None, Some(r)),
    };
```

and extend the `cap_check` json (`:498-504`) with **one** key, beside `verdict`:

```rust
        "risk_refusal": risk_refusal,
```

**Step 4:** `cargo test -p api-rust` → GREEN. **Commit.**

**Reviewer probe:** `cap_not_derivable_reason` must be untouched. It is null in exactly the state
`risk_refusal` explains (`auth/risk.rs:60-87` sets it only in the arm that also sets `value: None`, and a
null cap short-circuits to `NoCap` at step 2). Neither token may stand in for the other.

---

## B5 — the single-dollar-figure directive in the sent prompt

**Files:** `apps/api/src/services/llm.rs`. **Depends on:** B1. **Enforces:** AC-36 (SB) — **both** its
surviving halves. **UNCHANGED by the GATE Z amendment and by D8.** The "visible on the export surface"
clause is **withdrawn**: no lane adds the system prompt to `GET /api/recommendation/export/{ticker}` or to
`StateExportDrawer` (SPEC §9 item 7; that would open a new egress surface and engage
`egress-copy-tracks-payload` for no stated need).

**Step 1 — the failing test.** Add to `llm.rs`:

```rust
#[cfg(test)]
mod rec_prompt_tests {
    use super::*;
    use serde_json::json;

    fn ctx() -> RecPromptContext<'static> {
        RecPromptContext {
            market_state: json!({}),
            signals: None,
            ai_eval: None,
            candidates: json!({}),
            risk_inputs: json!({}),
            open_positions: json!({}),
        }
    }

    /// AC-36 (SB) — the directive is IN the assembled system prompt, and deleting it reds the build.
    #[test]
    fn the_assembled_system_prompt_requires_exactly_one_dollar_figure_for_the_risk_field() {
        let (system, _user) = build_rec_prompts("SPY", &ctx(), "Default (no persona)");
        assert!(system.contains("exactly one dollar figure"), "directive missing: {system}");
        assert!(system.contains("$N"), "the $N form must be named: {system}");
        assert!(
            system.contains("percentage") && system.contains("same dollar figure"),
            "the percentage carve-out must be stated: {system}"
        );
        // Anti-vacuity: the probe must not match a prompt that lacks the directive.
        assert!(!"You are a risk-first options strategist.".contains("exactly one dollar figure"));
    }
}
```

**Step 2 — implement.** In `build_rec_prompts` (`llm.rs:137-156`), append to the `system` format string
after `"The candidate contracts listed are the only ones Convexa sent you."`:

```rust
         " For `max_risk`, state exactly one dollar figure in $N form (for example $300). \
         A percentage may appear only if it names the same dollar figure — never a range, \
         never two different amounts."
```

**Step 3:** `cargo test -p api-rust` → GREEN, +1. **Commit.**

**Reviewer probe:** this is a **prompt** change, never a parser change. If a later item touches
`max_risk.rs`'s conditions to make the V13 measurement look better, that is the laundering D7 forbids.

---

## B6 — `grounding.rs`, part 1: the closed vocabularies and their exact wire spellings

**Files:** NEW `apps/api/src/services/rec_inputs/grounding.rs`; `apps/api/src/services/rec_inputs/mod.rs`.
**Depends on:** B2. **Enforces:** the token spellings in `INTERFACE_CONTRACT.md` §1.

**Step 1 — register the module.** `mod.rs`, after `pub mod field_reasons;`: `pub mod grounding;`

**Step 2 — the failing spelling pin** (written first):

```rust
#[cfg(test)]
mod tests {
    use super::*;

    /// The wire spellings ARE the contract. A rename silently breaks the FE's closed lookups, which is
    /// why they are pinned as strings rather than trusted to `rename_all`.
    #[test]
    fn every_token_serializes_to_its_contract_spelling() {
        assert_eq!(serde_json::to_value(GroundingState::NotApplicable).unwrap(), "not_applicable");
        assert_eq!(serde_json::to_value(GroundingState::NotCheckable).unwrap(), "not_checkable");
        assert_eq!(serde_json::to_value(GroundingState::Traced).unwrap(), "traced");
        assert_eq!(serde_json::to_value(GroundingState::Untraced).unwrap(), "untraced");
        assert_eq!(serde_json::to_value(MatchBasis::Exact).unwrap(), "exact");
        assert_eq!(serde_json::to_value(MatchBasis::Near).unwrap(), "near");
        assert_eq!(serde_json::to_value(MatchBasis::InsideRange).unwrap(), "inside_range");
        assert_eq!(serde_json::to_value(NotCheckableReason::StructurallyUnchecked).unwrap(), "structurally_unchecked");
        assert_eq!(serde_json::to_value(NotCheckableReason::NoNamedLevel).unwrap(), "no_named_level");
        assert_eq!(serde_json::to_value(NotCheckableReason::NoCitedExpiration).unwrap(), "no_cited_expiration");
        assert_eq!(serde_json::to_value(NotCheckableReason::StraddleMoveUnavailable).unwrap(), "straddle_move_unavailable");
        assert_eq!(serde_json::to_value(CardMember::NotApplicable).unwrap(), "not_applicable");
        assert_eq!(serde_json::to_value(CardMember::LocalRules).unwrap(), "local_rules");
        assert_eq!(serde_json::to_value(CardMember::NoneTraced).unwrap(), "none_traced");
        assert_eq!(serde_json::to_value(CardMember::CouldNotCheck).unwrap(), "could_not_check");
        assert_eq!(serde_json::to_value(CardMember::SomeTraced).unwrap(), "some_traced");
        assert_eq!(serde_json::to_value(CardMember::AllTraced).unwrap(), "all_traced");
    }

    #[test]
    fn every_anchor_kind_serializes_to_its_contract_spelling_in_the_fixed_order() {
        let expected = [
            "gex_spot", "call_wall", "put_wall", "peak_gex_strike", "gamma_flip", "max_pain",
            "vwap", "vwap_upper_2", "vwap_upper_3", "vwap_lower_2", "vwap_lower_3",
        ];
        assert_eq!(ANCHOR_ORDER.len(), 11, "the anchor set is eleven members, no more, no fewer");
        for (i, k) in ANCHOR_ORDER.iter().enumerate() {
            assert_eq!(serde_json::to_value(*k).unwrap(), expected[i], "anchor {i} spelling/order moved");
        }
        // There is no cap member and there never will be one — that is what makes
        // `traces to Convexa's risk cap (500)` unrenderable by construction.
        assert!(!expected.iter().any(|s| s.contains("cap")));
    }
}
```

**Step 3 — implement.** `grounding.rs` head:

```rust
//! Per-figure grounding: the SIXTH pure leaf (SPEC §2.1). Same contract as its five siblings — no
//! `AppState`, no `crate::routes`, no `reqwest`, no `.await`, no `Instant`, no env read, no `Result`.
//! `field_reasons` answers "the field is null — why?"; this answers "the field is non-null — where did
//! that number come from?". Two consumers, one `RecField` vocabulary, both exhaustive, no wildcard arm.
use super::cited::CitedState;
use super::field_reasons::RecField;
use quant_engine::{StraddleMove, StraddleMoveState};
use serde::Serialize;
use serde_json::Value;

/// Payload-stated constant, never a query knob — deliberately, so it cannot erode (following
/// `candidates.rs:11`'s `BAND_PCT`). Applied as `max(0.01, anchor * TOL/100.0)` to the NAMED-LEVEL
/// fields only; containment carries no tolerance at all.
pub const GROUNDING_TOL_PCT: f64 = 0.1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum GroundingState { NotApplicable, NotCheckable, Traced, Untraced }

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MatchBasis { Exact, Near, InsideRange }

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum NotCheckableReason {
    StructurallyUnchecked,
    NoNamedLevel,
    NoCitedExpiration,
    StraddleMoveUnavailable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AnchorKind {
    GexSpot, CallWall, PutWall, PeakGexStrike, GammaFlip, MaxPain,
    Vwap, VwapUpper2, VwapUpper3, VwapLower2, VwapLower3,
}

/// FIXED order — nearest wins, ties broken by this order. DO NOT REORDER.
pub const ANCHOR_ORDER: [AnchorKind; 11] = [
    AnchorKind::GexSpot, AnchorKind::CallWall, AnchorKind::PutWall, AnchorKind::PeakGexStrike,
    AnchorKind::GammaFlip, AnchorKind::MaxPain, AnchorKind::Vwap, AnchorKind::VwapUpper2,
    AnchorKind::VwapUpper3, AnchorKind::VwapLower2, AnchorKind::VwapLower3,
];

/// SIX members, FIXED evaluation order, first match wins. DO NOT REORDER — member 1 preempts member 2
/// deliberately (a local-rules rec with a null `gamma_flip` states no checkable figure, so there is
/// nothing for `local_rules` to assert about). Settled at T9; reordering it is a GATE Z reversal.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CardMember { NotApplicable, LocalRules, NoneTraced, CouldNotCheck, SomeTraced, AllTraced }

/// One field's resolution. Every key is ALWAYS serialized (never `skip_serializing_if`), `null` where
/// the discriminator does not carry it — a mis-wired renderer must fail a typed check, not print the
/// wrong sentence.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct FieldGrounding {
    pub state: GroundingState,
    pub basis: Option<MatchBasis>,
    pub anchor_kind: Option<AnchorKind>,
    pub anchor_value: Option<f64>,
    pub range_low: Option<f64>,
    pub range_high: Option<f64>,
    pub expiration: Option<String>,
    pub not_checkable_reason: Option<NotCheckableReason>,
}

impl FieldGrounding {
    fn bare(state: GroundingState) -> Self {
        Self { state, basis: None, anchor_kind: None, anchor_value: None,
               range_low: None, range_high: None, expiration: None, not_checkable_reason: None }
    }
    fn not_checkable(reason: NotCheckableReason) -> Self {
        let mut f = Self::bare(GroundingState::NotCheckable);
        f.not_checkable_reason = Some(reason);
        f
    }
    fn level(basis: MatchBasis, kind: AnchorKind, value: f64) -> Self {
        let mut f = Self::bare(GroundingState::Traced);
        f.basis = Some(basis);
        f.anchor_kind = Some(kind);
        f.anchor_value = Some(round2(value));
        f
    }
    fn contained(low: f64, high: f64, expiration: &str) -> Self {
        let mut f = Self::bare(GroundingState::Traced);
        f.basis = Some(MatchBasis::InsideRange);
        f.range_low = Some(round2(low));
        f.range_high = Some(round2(high));
        f.expiration = Some(expiration.to_string());
        f
    }
}

/// Wire rule 10 — numbers ride as numbers, rounded server-side to 2 decimals.
fn round2(v: f64) -> f64 { (v * 100.0).round() / 100.0 }
```

**Step 4:** `cargo test -p api-rust grounding` → GREEN, +2. **Commit.**

---

## B7 — `grounding.rs`, part 2: the anchor set and the nearest-anchor rule

**Files:** `apps/api/src/services/rec_inputs/grounding.rs`. **Depends on:** B6.

**Step 1 — the failing tests.** **Every edge value is a literal number, never computed from
`GROUNDING_TOL_PCT`** — that is the anti-laundering property.

```rust
    fn anchors_at(call_wall: f64) -> GroundingAnchors {
        let mut a = GroundingAnchors::empty();
        a.set(AnchorKind::CallWall, Some(call_wall));
        a
    }

    #[test]
    fn a_value_exactly_on_a_named_anchor_is_traced_exact() {
        let f = resolve_named_level(500.00, &anchors_at(500.00));
        assert_eq!(f.state, GroundingState::Traced);
        assert_eq!(f.basis, Some(MatchBasis::Exact));
        assert_eq!(f.anchor_kind, Some(AnchorKind::CallWall));
        assert_eq!(f.anchor_value, Some(500.00));
    }

    #[test]
    fn just_inside_the_window_is_traced_near_and_just_outside_is_untraced() {
        // anchor 500.00 -> window half-width 0.50. Literal edges, NEVER derived from the constant.
        assert_eq!(resolve_named_level(500.49, &anchors_at(500.00)).basis, Some(MatchBasis::Near));
        assert_eq!(resolve_named_level(500.51, &anchors_at(500.00)).state, GroundingState::Untraced);
    }

    #[test]
    fn under_ten_dollars_the_cent_floor_binds_rather_than_the_percentage() {
        // anchor 2.00 -> the percentage would give 0.002; the floor gives 0.01.
        assert_eq!(resolve_named_level(2.008, &anchors_at(2.00)).basis, Some(MatchBasis::Near));
        assert_eq!(resolve_named_level(2.015, &anchors_at(2.00)).state, GroundingState::Untraced);
    }

    #[test]
    fn every_anchor_absent_is_not_checkable_no_named_level() {
        let f = resolve_named_level(500.00, &GroundingAnchors::empty());
        assert_eq!(f.state, GroundingState::NotCheckable);
        assert_eq!(f.not_checkable_reason, Some(NotCheckableReason::NoNamedLevel));
    }

    #[test]
    fn a_tie_is_broken_by_the_fixed_anchor_order_not_by_map_iteration() {
        let mut a = GroundingAnchors::empty();
        a.set(AnchorKind::CallWall, Some(100.0));
        a.set(AnchorKind::GexSpot, Some(100.0));
        for _ in 0..100 {
            assert_eq!(resolve_named_level(100.0, &a).anchor_kind, Some(AnchorKind::GexSpot));
        }
    }

    #[test]
    fn the_anchor_set_is_read_off_the_sent_market_state_by_its_contract_keys() {
        let ms = serde_json::json!({ "gex_spot": 250.0, "call_wall": 260.0, "gamma_flip": null });
        let a = GroundingAnchors::from_market_state(&ms);
        assert_eq!(a.get(AnchorKind::GexSpot), Some(250.0));
        assert_eq!(a.get(AnchorKind::CallWall), Some(260.0));
        assert_eq!(a.get(AnchorKind::GammaFlip), None);
        assert_eq!(a.get(AnchorKind::MaxPain), None);
    }
```

**Step 2 — implement:**

```rust
/// The eleven price-scale anchors read off the SENT `market_state` (`routes/market.rs:156-212`). A
/// plain `Copy` value, built ONCE in `recommendation.rs` BEFORE the `base` closure — which is also what
/// keeps the leaf free of any borrow on the prompt context.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct GroundingAnchors([Option<f64>; 11]);

impl GroundingAnchors {
    pub fn empty() -> Self { Self([None; 11]) }

    fn index(kind: AnchorKind) -> usize {
        ANCHOR_ORDER.iter().position(|k| *k == kind).expect("ANCHOR_ORDER is total over AnchorKind")
    }

    pub fn set(&mut self, kind: AnchorKind, v: Option<f64>) {
        self.0[Self::index(kind)] = v.filter(|x| x.is_finite());
    }

    pub fn get(&self, kind: AnchorKind) -> Option<f64> { self.0[Self::index(kind)] }

    /// The wire key per anchor — the SAME eleven keys the conformance block pins on
    /// `GET /api/ticker/{ticker}`, so a rename on one path alone cannot pass unnoticed.
    pub fn wire_key(kind: AnchorKind) -> &'static str {
        match kind {
            AnchorKind::GexSpot => "gex_spot",
            AnchorKind::CallWall => "call_wall",
            AnchorKind::PutWall => "put_wall",
            AnchorKind::PeakGexStrike => "peak_gex_strike",
            AnchorKind::GammaFlip => "gamma_flip",
            AnchorKind::MaxPain => "max_pain",
            AnchorKind::Vwap => "vwap",
            AnchorKind::VwapUpper2 => "vwap_upper_2",
            AnchorKind::VwapUpper3 => "vwap_upper_3",
            AnchorKind::VwapLower2 => "vwap_lower_2",
            AnchorKind::VwapLower3 => "vwap_lower_3",
        }
    }

    pub fn from_market_state(market_state: &Value) -> Self {
        let mut a = Self::empty();
        for kind in ANCHOR_ORDER {
            a.set(kind, market_state.get(Self::wire_key(kind)).and_then(|v| v.as_f64()));
        }
        a
    }

    fn present(&self) -> impl Iterator<Item = (AnchorKind, f64)> + '_ {
        ANCHOR_ORDER.into_iter().filter_map(|k| self.get(k).map(|v| (k, v)))
    }
}

/// The named-level rule, in FIXED branch order (SPEC §2.3). DO NOT REORDER.
pub fn resolve_named_level(asserted: f64, anchors: &GroundingAnchors) -> FieldGrounding {
    // 1 — every anchor absent.
    let mut best: Option<(AnchorKind, f64, f64)> = None; // (kind, value, |delta|)
    for (kind, value) in anchors.present() {
        let delta = (asserted - value).abs();
        // Strictly-less keeps the FIXED order as the tie-break: the first anchor wins a tie.
        if best.map(|(_, _, d)| delta < d).unwrap_or(true) {
            best = Some((kind, value, delta));
        }
    }
    let Some((kind, value, delta)) = best else {
        return FieldGrounding::not_checkable(NotCheckableReason::NoNamedLevel);
    };
    // 2 — nearest named anchor within max(0.01, anchor * TOL/100).
    let window = (value.abs() * GROUNDING_TOL_PCT / 100.0).max(0.01);
    if delta < 1e-9 { return FieldGrounding::level(MatchBasis::Exact, kind, value); }
    if delta <= window { return FieldGrounding::level(MatchBasis::Near, kind, value); }
    // 3 — the source was available and it resolves to nothing we computed.
    FieldGrounding::bare(GroundingState::Untraced)
}
```

**Step 3:** `cargo test -p api-rust grounding` → GREEN, +6. **Commit.**

**Reviewer probe:** `delta < d` (strict) makes the tie-break the fixed order rather than iteration luck;
`delta <= window` (inclusive) makes the boundary point itself `near`. B13's fixtures sit a full cent
either side, so neither choice is load-bearing for them.

---

## B8 — `grounding.rs`, part 3: the exhaustive `match RecField`, no wildcard

**Files:** `apps/api/src/services/rec_inputs/grounding.rs`. **Depends on:** B7. **Enforces:** guard 1
(AC-49), guard 4 (AC-52), guard 9 (AC-61), the containment rule.

**Step 1 — the failing tests** (helpers first):

```rust
    fn tenor(expiration: &str, move_dollars: f64) -> quant_engine::StraddleTenor {
        quant_engine::StraddleTenor {
            expiration: expiration.into(), dte: 30, strike_used: 500.0, strike_distance_pct: 0.0,
            straddle_price: move_dollars, move_dollars, move_pct: 2.0,
            basis: Default::default(), quote_spread_pct_of_mid: None, wide_quotes: false,
        }
    }

    fn one_tenor_move() -> StraddleMove {
        StraddleMove {
            state: StraddleMoveState::Ok, as_of: None, session_basis: None,
            anchor_spot: Some(500.00), anchor_basis: Default::default(),
            anchor_label: "levels-anchor".into(), primary_expiration: Some("2026-09-18".into()),
            wide_quote_threshold_pct: 15.0, tenors: vec![tenor("2026-09-18", 10.00)],
        }
    }
```

If `MoveBasis` / `AnchorBasis` have no `Default`, name the concrete member from
`libs/quant-engine/src/straddle_move.rs:19-70` — do **not** add a `Default` impl to `quant-engine` for a
test's convenience.

```rust
    #[test]
    fn exit_target_with_no_cited_expiration_is_not_checkable_no_cited_expiration_first() {
        // Branch 1 is evaluated FIRST even though branch 2 would also fire.
        let f = resolve_field(RecField::ExitTarget, Some(505.0), None, None, &GroundingAnchors::empty());
        assert_eq!(f.not_checkable_reason, Some(NotCheckableReason::NoCitedExpiration));
    }

    #[test]
    fn exit_target_with_a_tenor_absent_from_the_pruned_move_is_straddle_move_unavailable() {
        let mv = one_tenor_move();
        let f = resolve_field(RecField::ExitTarget, Some(505.0), Some("2026-12-18"), Some(&mv), &GroundingAnchors::empty());
        assert_eq!(f.not_checkable_reason, Some(NotCheckableReason::StraddleMoveUnavailable));
    }

    #[test]
    fn exit_target_containment_carries_no_tolerance_at_all() {
        let mv = one_tenor_move(); // anchor_spot 500.00, move_dollars 10.00 -> [490.00, 510.00]
        let inside = |v: f64| resolve_field(RecField::ExitTarget, Some(v), Some("2026-09-18"), Some(&mv), &GroundingAnchors::empty());
        assert_eq!(inside(490.00).basis, Some(MatchBasis::InsideRange));
        assert_eq!(inside(510.00).basis, Some(MatchBasis::InsideRange));
        assert_eq!(inside(489.99).state, GroundingState::Untraced);
        assert_eq!(inside(510.01).state, GroundingState::Untraced);
        let f = inside(505.00);
        assert_eq!(f.range_low, Some(490.00));
        assert_eq!(f.range_high, Some(510.00));
        assert_eq!(f.expiration.as_deref(), Some("2026-09-18"));
    }

    #[test]
    fn the_structurally_unchecked_set_is_exactly_position_size_and_max_risk() {
        // guard 4 / AC-52 — marking a THIRD field structurally-unchecked reds the build.
        let mut structural: Vec<RecField> = Vec::new();
        for field in [RecField::MaxRisk, RecField::PositionSize, RecField::ExitTarget,
                      RecField::ExitStop, RecField::InvalidationLevel] {
            let f = resolve_field(field, Some(1.0), Some("2026-09-18"), Some(&one_tenor_move()), &anchors_at(1.0));
            if f.not_checkable_reason == Some(NotCheckableReason::StructurallyUnchecked) {
                structural.push(field);
            }
        }
        assert_eq!(structural, vec![RecField::MaxRisk, RecField::PositionSize]);
    }

    #[test]
    fn the_legal_field_basis_relation_is_closed() {
        // guard 9 / AC-61 — all three basis members share one wire enum, so a cross-field leak would
        // otherwise compile and serialize cleanly.
        let mv = one_tenor_move();
        let a = anchors_at(500.00);
        for field in [RecField::ExitStop, RecField::InvalidationLevel] {
            for v in [500.00, 500.49, 500.51] {
                let b = resolve_field(field, Some(v), Some("2026-09-18"), Some(&mv), &a).basis;
                assert_ne!(b, Some(MatchBasis::InsideRange), "{field:?} must never emit inside_range");
            }
        }
        for v in [490.00, 505.00, 510.01] {
            let b = resolve_field(RecField::ExitTarget, Some(v), Some("2026-09-18"), Some(&mv), &a).basis;
            assert!(b.is_none() || b == Some(MatchBasis::InsideRange), "exit_target emitted {b:?}");
        }
        for field in [RecField::MaxRisk, RecField::PositionSize] {
            assert_eq!(resolve_field(field, Some(1.0), None, None, &a).basis, None);
        }
    }

    #[test]
    fn an_absent_value_is_not_applicable_on_every_field() {
        for field in [RecField::MaxRisk, RecField::PositionSize, RecField::ExitTarget,
                      RecField::ExitStop, RecField::InvalidationLevel] {
            let f = resolve_field(field, None, None, None, &GroundingAnchors::empty());
            assert_eq!(f.state, GroundingState::NotApplicable, "{field:?}");
            assert!(f.not_checkable_reason.is_none());
        }
    }
```

**Step 2 — implement:**

```rust
/// ONE declared rule per field. `match RecField` with **no wildcard arm and no exemption**, so a sixth
/// stated number cannot ship without a rule (guard 1 / AC-49). Within each rule the branch order is
/// itself FIXED and first-match-wins — the branches are NOT mutually exclusive.
pub fn resolve_field(
    field: RecField,
    asserted: Option<f64>,
    cited_expiration: Option<&str>,
    pruned_move: Option<&StraddleMove>,
    anchors: &GroundingAnchors,
) -> FieldGrounding {
    match field {
        // Structurally not-checkable in v1: no `traced` arm, no `untraced` arm. The shipped
        // `CapAnnotation` remains the single statement about the risk figure (T22 — the cap-anchored
        // rule is WITHDRAWN: the cap is the owner's number, not one Convexa computed).
        RecField::MaxRisk | RecField::PositionSize => match asserted.is_some() {
            false => FieldGrounding::bare(GroundingState::NotApplicable),
            true => FieldGrounding::not_checkable(NotCheckableReason::StructurallyUnchecked),
        },
        RecField::ExitStop | RecField::InvalidationLevel => match asserted {
            None => FieldGrounding::bare(GroundingState::NotApplicable),
            Some(v) => resolve_named_level(v, anchors),
        },
        RecField::ExitTarget => {
            let Some(v) = asserted else {
                return FieldGrounding::bare(GroundingState::NotApplicable);
            };
            // 1 — no expiration cited. Evaluated FIRST: without a tenor there is nothing to test
            // containment against, and the move's own availability is not the reader's problem.
            let Some(exp) = cited_expiration else {
                return FieldGrounding::not_checkable(NotCheckableReason::NoCitedExpiration);
            };
            // 2 — move absent / state != Ok / cited tenor not in the PRUNED move.
            let hit = pruned_move
                .filter(|m| m.state == StraddleMoveState::Ok)
                .and_then(|m| m.anchor_spot.map(|s| (m, s)))
                .and_then(|(m, s)| m.tenors.iter().find(|t| t.expiration == exp).map(|t| (s, t)));
            let Some((anchor_spot, t)) = hit else {
                return FieldGrounding::not_checkable(NotCheckableReason::StraddleMoveUnavailable);
            };
            // 3 — containment, with NO tolerance at all.
            let (low, high) = (anchor_spot - t.move_dollars, anchor_spot + t.move_dollars);
            if v >= low && v <= high {
                FieldGrounding::contained(low, high, exp)
            } else {
                FieldGrounding::bare(GroundingState::Untraced) // 4
            }
        }
    }
}
```

For `MaxRisk` / `PositionSize` the caller passes a **presence sentinel** (`Some(1.0)`) built from
`strategy.get(...)` non-null-ness — never a parsed figure. B10 states that at the call site.

**Step 3:** `cargo test -p api-rust grounding` → GREEN, +7. **Commit.**

**Reviewer probe:** delete the `RecField::ExitTarget` arm and the build must fail to compile (no
wildcard). That is guard 1; V3 runs it as a poison drill.

---

## B9 — `grounding.rs`, part 4: the card fold, the four integers, the derived cited state

**Files:** `apps/api/src/services/rec_inputs/grounding.rs`. **Depends on:** B8. **Enforces:** guard 5
(AC-53), the six-member card order, the denominator (AC-17), the cited mapping.

**Step 1 — the failing tests:**

```rust
    #[test]
    fn the_cited_state_maps_totally_and_gains_no_second_wire_token() {
        assert_eq!(cited_as_state(CitedState::Cited), GroundingState::Traced);
        assert_eq!(cited_as_state(CitedState::RightUndetermined), GroundingState::NotCheckable);
        assert_eq!(cited_as_state(CitedState::OffSet), GroundingState::Untraced);
        assert_eq!(cited_as_state(CitedState::None), GroundingState::NotApplicable);
    }

    #[test]
    fn the_counts_satisfy_the_partition_identity_on_every_shape() {
        for cited in [CitedState::Cited, CitedState::RightUndetermined, CitedState::OffSet, CitedState::None] {
            for fields in sample_field_shapes() {
                let c = counts(&fields, cited);
                assert_eq!(c.traced + c.untraced + c.not_checkable, c.checked, "identity broken: {c:?}");
            }
        }
    }

    #[test]
    fn the_denominator_excludes_the_dollar_risk_figure_and_the_suggested_size() {
        // A full model rec: stop + target + invalidation + cited contract = 4, never 5 or 6.
        assert_eq!(counts(&full_model_rec_fields(), CitedState::Cited).checked, 4);
    }

    #[test]
    fn the_card_member_order_is_fixed_and_first_match_wins() {
        let na = Counts { checked: 0, traced: 0, untraced: 0, not_checkable: 0 };
        // 1 preempts 2 — the gamma_flip-null local-rules case (AC-64).
        assert_eq!(card_member(true, true, na), CardMember::NotApplicable);
        assert_eq!(card_member(false, true, na), CardMember::NotApplicable);
        let one_traced = Counts { checked: 1, traced: 1, untraced: 0, not_checkable: 0 };
        assert_eq!(card_member(true, true, one_traced), CardMember::LocalRules);
        assert_eq!(card_member(true, false, Counts { checked: 2, traced: 0, untraced: 2, not_checkable: 0 }), CardMember::NoneTraced);
        assert_eq!(card_member(true, false, Counts { checked: 2, traced: 0, untraced: 0, not_checkable: 2 }), CardMember::CouldNotCheck);
        assert_eq!(card_member(true, false, Counts { checked: 4, traced: 3, untraced: 1, not_checkable: 0 }), CardMember::SomeTraced);
        assert_eq!(card_member(true, false, Counts { checked: 4, traced: 4, untraced: 0, not_checkable: 0 }), CardMember::AllTraced);
    }
```

`sample_field_shapes()` returns a vector of `[FieldGrounding; 5]` covering all-traced, all-untraced,
all-not-checkable, mixed, and all-not-applicable, each alongside the structurally-unchecked pair.
`full_model_rec_fields()` returns stop/target/invalidation traced plus the pair
`not_checkable/structurally_unchecked`.

**Step 2 — implement:**

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct Counts { pub checked: u32, pub traced: u32, pub untraced: u32, pub not_checkable: u32 }

/// The cited contract's grounding is DERIVED from the shipped `CitedState`, never duplicated into a
/// second token that can drift. It feeds the card-level counts only; `CitedContractLine` stays its one
/// rendered surface.
pub fn cited_as_state(s: CitedState) -> GroundingState {
    match s {
        CitedState::Cited => GroundingState::Traced,
        CitedState::RightUndetermined => GroundingState::NotCheckable,
        CitedState::OffSet => GroundingState::Untraced,
        CitedState::None => GroundingState::NotApplicable,
    }
}

/// `checked` = the fields whose member is neither `not_applicable` nor
/// `not_checkable/structurally_unchecked`, PLUS the cited contract when its state is not `None`.
/// `not_checkable` excludes the same two by the same rule, which is what keeps the identity true.
pub fn counts(fields: &[FieldGrounding], cited: CitedState) -> Counts {
    let mut c = Counts { checked: 0, traced: 0, untraced: 0, not_checkable: 0 };
    let mut tally = |state: GroundingState, structural: bool| match state {
        GroundingState::NotApplicable => {}
        GroundingState::NotCheckable if structural => {}
        GroundingState::NotCheckable => { c.checked += 1; c.not_checkable += 1; }
        GroundingState::Traced => { c.checked += 1; c.traced += 1; }
        GroundingState::Untraced => { c.checked += 1; c.untraced += 1; }
    };
    for f in fields {
        tally(f.state, f.not_checkable_reason == Some(NotCheckableReason::StructurallyUnchecked));
    }
    tally(cited_as_state(cited), false);
    c
}

/// SIX members, FIXED order, first match wins. `local_only` is a plain `bool` passed in — the leaf
/// performs NO env read and stays pure.
pub fn card_member(states_entry: bool, local_only: bool, c: Counts) -> CardMember {
    if !states_entry || c.checked == 0 { return CardMember::NotApplicable; } // 1 — preempts 2 (T9)
    if local_only { return CardMember::LocalRules; }                         // 2
    if c.traced == 0 && c.untraced >= 1 { return CardMember::NoneTraced; }   // 3
    if c.traced == 0 { return CardMember::CouldNotCheck; }                   // 4
    if c.traced < c.checked { return CardMember::SomeTraced; }               // 5
    CardMember::AllTraced                                                    // 6
}
```

`states_entry` is `strategy.decision == "trade"` (an absent strategy is `false`) — computed once at the
call site exactly as `cap_verdict` already does.

**Step 3:** `cargo test -p api-rust grounding` → GREEN, +4. **Commit.**

---

## B10 — wire it in: `envelope_extras` → 4-tuple, anchors hoisted, `local_only` hoisted

**Files:** `apps/api/src/services/recommendation.rs`. **Depends on:** B9, B2, B4. **Enforces:** interface
rules 2, 3, 5; SPEC §2.4's provenance discriminator.

**⚠ The borrow trap, named so a lane does not rediscover it.** `pruned_market_state` is **moved** into
`RecPromptContext` at `:681`. The `base` closure is defined at `:617` and called at `:703` — after that
move. A closure that borrows `pruned_market_state` **will not compile**. Extract the anchors into a plain
`Copy` value **before** the closure and capture that.

**Step 1 — the failing test** (in `mod tests` at `:839`):

```rust
    #[test]
    fn envelope_extras_returns_a_total_grounding_block_on_a_null_strategy() {
        let set = CandidateSet::unavailable(CandidateBudget::Prompt, true, &SnapshotMeta::default(), None);
        let (_cap, _fr, _cited, grounding) = envelope_extras(
            &Value::Null, &set, None, None, false, None, GroundingAnchors::empty(), false,
        );
        assert_eq!(grounding["card"], "not_applicable");
        assert_eq!(grounding["tolerance_pct"], 0.1);
        for k in ["exit_stop", "exit_target", "invalidation_level", "max_risk", "position_size"] {
            assert!(grounding["fields"][k].is_object(), "missing field block {k}");
            assert_eq!(grounding["fields"][k]["state"], "not_applicable");
            assert!(grounding["fields"][k]["basis"].is_null());
        }
        for k in ["checked", "traced", "untraced", "not_checkable"] {
            assert_eq!(grounding["counts"][k], 0);
        }
    }
```

**Step 2 — implement.** Import beside the existing `rec_inputs` uses (`:16-20`):

```rust
use crate::services::rec_inputs::grounding::{
    card_member, counts, resolve_field, GroundingAnchors, GROUNDING_TOL_PCT,
};
```

`envelope_extras` (`:438-445`) gains two parameters and a fourth return value:

```rust
fn envelope_extras(
    strategy: &Value,
    set: &CandidateSet,
    effective_cap: Option<f64>,
    cap_not_derivable_reason: Option<&str>,
    risk_block_present: bool,
    pruned_move: Option<&StraddleMove>,
    anchors: GroundingAnchors,
    local_only: bool,
) -> (Value, Value, Value, Value) {
```

At the end of `envelope_extras`, before the return — reusing `outcome` (`:491`) and `present` (`:465`):

```rust
    // --- grounding (SPEC §2.1-2.4). The SENT inputs only: `pruned_move`, never `raw_move`; the
    // `Prompt` candidate set, never a `Handoff` one.
    let num = |p: Option<&Value>| p.and_then(|v| v.as_f64());
    let presence_sentinel = |p: Option<&Value>| present(p).then_some(1.0); // prose fields: presence only
    let cited_exp = expiration;
    let g = |field: RecField, asserted: Option<f64>| {
        resolve_field(field, asserted, cited_exp, pruned_move, &anchors)
    };
    let f_stop = g(RecField::ExitStop, num(strategy.pointer("/exit_plan/stop")));
    let f_target = g(RecField::ExitTarget, num(strategy.pointer("/exit_plan/target")));
    let f_inval = g(RecField::InvalidationLevel, num(strategy.get("invalidation_level")));
    let f_risk = g(RecField::MaxRisk, presence_sentinel(strategy.get("max_risk")));
    let f_size = g(RecField::PositionSize, presence_sentinel(strategy.get("position_size")));
    let all = [f_stop.clone(), f_target.clone(), f_inval.clone(), f_risk.clone(), f_size.clone()];
    let c = counts(&all, outcome.state);
    let card = card_member(states_entry, local_only, c);
    let grounding = json!({
        "card": card,
        "counts": c,
        "tolerance_pct": GROUNDING_TOL_PCT,
        "fields": {
            "exit_stop": f_stop,
            "exit_target": f_target,
            "invalidation_level": f_inval,
            "max_risk": f_risk,
            "position_size": f_size,
        },
    });

    (cap_check, field_reasons, cited_contract, grounding)
```

**The three hoists**, in `generate_recommendation`:

1. **Anchors — before the `base` closure** (insert after the `pruned_market_state` block ends at `:592`):

```rust
    // The eleven price-scale anchors, read off the SENT market_state and captured by VALUE — the
    // `base` closure cannot borrow `pruned_market_state`, which is moved into `RecPromptContext` at
    // the provider call below.
    let grounding_anchors = GroundingAnchors::from_market_state(&pruned_market_state);
```

2. **`local_only` — above the `base` closure.** Move the block at `:673-675` to sit immediately before
   `let base = …` at `:617`, unchanged in body, with the comment:

```rust
    // Hoisted above `base` so the card-level provenance member is derived inside the envelope
    // constructor and the grounding leaf takes a plain `bool` (SPEC §2.4). Pure env read, no side
    // effect; `AI_REC_LOCAL_ONLY=1` forces rule-based setups (free CI / offline demos).
```

Delete the original at `:673-675`; `let strategy = if local_only {` at `:677` reads the hoisted binding.

3. **The closure body** (`:617-652`):

```rust
        let (cap_check, field_reasons, cited_contract, grounding) = envelope_extras(
            &strategy, &candidate_set, effective_cap, cap_not_derivable_reason.as_deref(),
            risk_block_present, pruned_move.as_ref(), grounding_anchors, local_only,
        );
```

and in the `json!` literal, after `"cited_contract": cited_contract,`: `"grounding": grounding,`

**Step 3:** `cargo check -p api-rust --features postgres` then `cargo test -p api-rust` → GREEN, +1.
**Commit.**

**Reviewer probe:** `unavailable_envelope` (`:706-727`) is **deliberately untouched** — the named
known-uncovered branch. It renders no rec body and no figures, and the `CandidateSet` a block would need
does not exist at that point. Do not "fix" it.

---

## B11 — guard 2: the partition assertion, through `envelope_extras`

**Files:** `apps/api/src/services/recommendation.rs` (`mod tests`). **Depends on:** B10.
**Enforces:** AC-51.

```rust
    /// guard 2 / AC-51 — for EVERY field on EVERY branch, a `field_reason` exists IFF the grounding
    /// state is `not_applicable` (exclusive-or). Poison arm: make one field emit both, or neither.
    #[test]
    fn a_field_reason_exists_exactly_when_grounding_is_not_applicable() {
        let keys = ["max_risk", "position_size", "exit_target", "exit_stop", "invalidation_level"];
        let shapes = partition_strategy_shapes();
        // Anti-vacuity: the shapes must exercise BOTH sides of the biconditional.
        assert!(shapes.len() >= 4, "the shape set must cover more than one branch");
        for strategy in &shapes {
            let (_cap, fr, _cited, g) = extras_for(strategy);
            for k in keys {
                let has_reason = !fr[k].is_null();
                let is_na = g["fields"][k]["state"] == "not_applicable";
                assert_eq!(has_reason, is_na, "partition broken for {k} on {strategy}");
            }
        }
    }
```

`partition_strategy_shapes()` returns: a full trade rec; a trade rec with every figure null; a `no_trade`
rec; `Value::Null`; and a trade rec with only the stop stated. `extras_for(&strategy)` is a local helper
calling `envelope_extras` with a hermetic two-contract `CandidateSet` (copy the `cited.rs:96-110`
builder), the one-tenor `StraddleMove`, and a populated `GroundingAnchors`.

No production change should be needed — if one is, the partition is genuinely broken and the fix belongs
in `resolve_field`, **never** in the test. `cargo test -p api-rust` → GREEN, +1. **Commit.**

---

## B12 — the fabrication fixture and its honest counterpart (SPEC §7 arms 1–2)

**Files:** `apps/api/src/services/recommendation.rs` (`mod tests`). **Depends on:** B11.
**Enforces:** AC-42 (SB), AC-43 (SB), AC-28, AC-64.

Both arms assert on the **return value of `envelope_extras`** — the function that actually builds the
JSON — via `use super::*`. No new test binary, no `pub` widening, no key, no network, no env flag.

```rust
    /// The fixed reference set: anchors 500/510/490, a one-tenor pruned move [490, 510] for
    /// 2026-09-18, and a two-contract candidate set holding the 500 call + 500 put.
    fn reference_anchors() -> GroundingAnchors {
        let mut a = GroundingAnchors::empty();
        a.set(AnchorKind::GexSpot, Some(500.00));
        a.set(AnchorKind::CallWall, Some(510.00));
        a.set(AnchorKind::PutWall, Some(490.00));
        a
    }

    /// AC-42 (SB) — a hand-written fabricated rec through the recommendation's OWN serialization path:
    /// a stop far from every named anchor, a target outside the pruned move for the cited tenor, an
    /// invalidation level far from every anchor, a strike absent from the candidate set.
    #[test]
    fn a_fabricated_rec_resolves_every_asserted_figure_to_a_non_traced_state() {
        let strategy = json!({
            "decision": "trade",
            "strikes": [777.0], "expiration": "2026-09-18", "right": "call",
            "invalidation_level": 611.0,
            "max_risk": "$300", "position_size": "2 contracts",
            "exit_plan": { "target": 640.0, "stop": 623.0 },
        });
        let (_cap, _fr, cited, g) = extras_for(&strategy);
        assert_eq!(cited["state"], "off_set");
        for k in ["exit_stop", "exit_target", "invalidation_level"] {
            assert_eq!(g["fields"][k]["state"], "untraced", "{k} must not be traced");
            assert!(g["fields"][k]["basis"].is_null());
            assert!(g["fields"][k]["anchor_kind"].is_null());
        }
        assert_eq!(g["counts"], json!({"checked": 4, "traced": 0, "untraced": 4, "not_checkable": 0}));
        assert_eq!(g["card"], "none_traced");
    }

    /// AC-43 (SB) — without this arm the fabrication fixture proves only that the resolver says no.
    #[test]
    fn the_honest_counterpart_traces_all_four_and_the_one_field_off_variant_traces_three() {
        let honest = json!({
            "decision": "trade",
            "strikes": [500.0], "expiration": "2026-09-18", "right": "call",
            "invalidation_level": 490.30,                    // inside the put wall's window -> near
            "max_risk": "$300", "position_size": "2 contracts",
            "exit_plan": { "target": 505.0, "stop": 500.0 },  // stop exactly on gex_spot -> exact
        });
        let (_cap, _fr, cited, g) = extras_for(&honest);
        assert_eq!(cited["state"], "cited");
        assert_eq!(g["fields"]["exit_stop"]["basis"], "exact");
        assert_eq!(g["fields"]["exit_stop"]["anchor_kind"], "gex_spot");
        assert_eq!(g["fields"]["exit_stop"]["anchor_value"], 500.0);
        assert_eq!(g["fields"]["invalidation_level"]["basis"], "near");
        assert_eq!(g["fields"]["exit_target"]["basis"], "inside_range");
        assert_eq!(g["counts"], json!({"checked": 4, "traced": 4, "untraced": 0, "not_checkable": 0}));
        assert_eq!(g["card"], "all_traced");

        let one_off = json!({
            "decision": "trade",
            "strikes": [500.0], "expiration": "2026-09-18", "right": "call",
            "invalidation_level": 490.30,
            "max_risk": "$300", "position_size": "2 contracts",
            "exit_plan": { "target": 505.0, "stop": 623.0 },  // the one fabricated figure
        });
        let (_c, _f, _ci, g2) = extras_for(&one_off);
        assert_eq!(g2["counts"], json!({"checked": 4, "traced": 3, "untraced": 1, "not_checkable": 0}));
        assert_eq!(g2["card"], "some_traced");
    }

    /// AC-28 — every reference input missing: the rec still returns, in full.
    #[test]
    fn a_rec_with_every_reference_input_missing_still_returns_with_every_checked_figure_not_checkable() {
        let strategy = json!({
            "decision": "trade", "strikes": [], "expiration": null, "invalidation_level": 611.0,
            "max_risk": "$300", "position_size": "2 contracts",
            "exit_plan": { "target": 640.0, "stop": 623.0 },
        });
        let (_cap, _fr, _cited, g) = extras_for_bare(&strategy); // empty anchors, no move
        assert_eq!(g["fields"]["exit_stop"]["not_checkable_reason"], "no_named_level");
        assert_eq!(g["fields"]["invalidation_level"]["not_checkable_reason"], "no_named_level");
        assert_eq!(g["fields"]["exit_target"]["not_checkable_reason"], "no_cited_expiration");
        assert_eq!(g["card"], "could_not_check");
    }

    /// AC-64 — `not_applicable` preempts `local_rules`: there are no figures to qualify.
    #[test]
    fn a_local_rules_rec_with_a_null_gamma_flip_renders_no_card_line_at_all() {
        let strategy = json!({
            "decision": "trade", "strikes": [], "expiration": null, "invalidation_level": null,
            "max_risk": "1R defined-risk", "position_size": "small (rule-based local rec; not LLM)",
            "exit_plan": { "target": null, "stop": null },
        });
        let g = extras_local_only(&strategy);
        assert_eq!(g["counts"]["checked"], 0);
        assert_eq!(g["card"], "not_applicable");
    }
```

`cargo test -p api-rust` → GREEN, +4. **Commit.**

---

## B13 — guard 8: the resolution-boundary pin (the mechanism that makes a *weakened* rule red)

**Files:** `apps/api/src/services/recommendation.rs` (`mod tests`). **Depends on:** B12.
**Enforces:** AC-50 (SB), AC-54.

Guards 1–7 catch a *missing* rule, a *leaked* dependency or a *moved* score. None catches a rule that
still exists but has been **loosened**. This is that guard. It asserts **through `envelope_extras`** — the
real serialization path, not the leaf's internal function — so a sibling file that bypasses the leaf
cannot stay green (the `score-lab-signal-comparison` failure shape). **The boundary points are LITERAL
NUMBERS, never computed from `GROUNDING_TOL_PCT`.**

```rust
    /// guard 8 / AC-50 (SB) + AC-54. Poison arms, each of which must red (V3): widen the constant;
    /// delete the cent floor; swap `pruned_move` for `raw_move`; replace a rule body with constant
    /// Traced.
    #[test]
    fn the_resolution_boundaries_are_pinned_through_the_serialization_path() {
        // anchors: gex_spot 500.00 (window +/-0.50), put_wall 2.00 (window +/-0.01, the CENT FLOOR)
        // pruned move: 2026-09-18, anchor_spot 500.00, move_dollars 10.00 -> [490.00, 510.00]
        struct Arm { field: &'static str, value: f64, state: &'static str, basis: Option<&'static str> }
        let arms = [
            Arm { field: "exit_stop", value: 500.00, state: "traced",   basis: Some("exact") },
            Arm { field: "exit_stop", value: 500.49, state: "traced",   basis: Some("near") },
            Arm { field: "exit_stop", value: 500.51, state: "untraced", basis: None },
            Arm { field: "exit_stop", value: 2.008,  state: "traced",   basis: Some("near") },
            Arm { field: "exit_stop", value: 2.015,  state: "untraced", basis: None },
            Arm { field: "invalidation_level", value: 500.00, state: "traced",   basis: Some("exact") },
            Arm { field: "invalidation_level", value: 500.49, state: "traced",   basis: Some("near") },
            Arm { field: "invalidation_level", value: 500.51, state: "untraced", basis: None },
            Arm { field: "invalidation_level", value: 2.008,  state: "traced",   basis: Some("near") },
            Arm { field: "invalidation_level", value: 2.015,  state: "untraced", basis: None },
            Arm { field: "exit_target", value: 490.00, state: "traced",   basis: Some("inside_range") },
            Arm { field: "exit_target", value: 510.00, state: "traced",   basis: Some("inside_range") },
            Arm { field: "exit_target", value: 489.99, state: "untraced", basis: None },
            Arm { field: "exit_target", value: 510.01, state: "untraced", basis: None },
        ];
        for a in &arms {
            let g = boundary_extras(a.field, a.value);
            assert_eq!(g["fields"][a.field]["state"], a.state, "{} @ {}", a.field, a.value);
            match a.basis {
                Some(b) => assert_eq!(g["fields"][a.field]["basis"], b, "{} @ {}", a.field, a.value),
                None => assert!(g["fields"][a.field]["basis"].is_null(), "{} @ {}", a.field, a.value),
            }
        }
        // NON-VACUITY, asserted in the test itself: every checked field carries at least one traced arm
        // AND at least one untraced arm. A set drifted to a single outcome fails before it can certify.
        for field in ["exit_stop", "invalidation_level", "exit_target"] {
            assert!(arms.iter().any(|a| a.field == field && a.state == "traced"), "{field}: no traced arm");
            assert!(arms.iter().any(|a| a.field == field && a.state == "untraced"), "{field}: no untraced arm");
        }
    }

    /// AC-54 — pruned and unpruned moves differ: the target is NOT traced against a tenor whose
    /// contracts were never sent.
    #[test]
    fn a_target_is_never_traced_against_a_tenor_that_was_not_sent() {
        // raw: 2026-09-18 (10.00) AND 2026-12-18 (40.00). pruned: 2026-09-18 ONLY. The rec cites
        // 2026-12-18 with a target of 530.00 — inside the RAW [460.00, 540.00], unreachable pruned.
        let g = pruned_vs_raw_extras(530.00, "2026-12-18");
        assert_ne!(g["fields"]["exit_target"]["state"], "traced");
        assert_eq!(g["fields"]["exit_target"]["state"], "not_checkable");
        assert_eq!(g["fields"]["exit_target"]["not_checkable_reason"], "straddle_move_unavailable");
    }
```

`boundary_extras(field, value)` builds a trade strategy with only that field set (the other two named
fields null), the two-anchor set and the one-tenor pruned move. `pruned_vs_raw_extras` builds the
two-tenor raw move, restricts it via `quant_engine::restrict_move_to_tenors` to `["2026-09-18"]`, and
passes **the restricted one**.

`cargo test -p api-rust` → GREEN, +2. **Commit.**

**Reviewer probe:** grep this test for `GROUNDING_TOL_PCT`. If it appears in the arm table, the guard is
laundering-proof only by accident and the item must be redone.

---

## B14 — guards 3 + 7: the leaf-purity scan and the no-configurable-fabricator scan

**Files:** NEW `apps/api/tests/grounding_isolation.rs`. **Depends on:** B10. **Enforces:** AC-55, AC-45.
**Model:** `apps/api/tests/candidate_isolation.rs`, including both self-checks.

```rust
//! ai-rec-grounding — guards 3 and 7 (AC-55, AC-45). Modelled on `candidate_isolation.rs`, including
//! its anti-vacuity self-checks: a scan that cannot prove it bit is not enforcement.
use std::fs;
use std::path::PathBuf;

fn workspace_root() -> PathBuf { PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..") }

const LEAF_FILES: [&str; 6] =
    ["cap_check.rs", "cited.rs", "digest.rs", "field_reasons.rs", "grounding.rs", "max_risk.rs"];
const BANNED_IN_LEAF: [&str; 6] =
    ["crate::state", "crate::routes", "AppState", "reqwest", ".await", "std::env"];

fn leaf_sources() -> Vec<(String, String)> {
    let root = workspace_root().join("apps/api/src/services/rec_inputs");
    LEAF_FILES.iter()
        .map(|f| (f.to_string(), fs::read_to_string(root.join(f)).unwrap_or_else(|_| panic!("{f} missing"))))
        .collect()
}

/// guard 3 / AC-55 — the grounding leaf (and every sibling) imports no app state, no route module, no
/// HTTP client, no async runtime, and reads no env.
#[test]
fn the_rec_input_leaves_stay_pure() {
    let scanned = leaf_sources();
    // Anti-vacuity 1 — the scanned set is real and complete.
    assert_eq!(scanned.len(), 6, "expected exactly the six leaf files");
    assert!(scanned.iter().any(|(n, _)| n == "grounding.rs"), "grounding.rs must be scanned");
    // Anti-vacuity 2 — a truncated read must not read as clean.
    for (n, src) in &scanned {
        assert!(src.len() > 200, "{n} looks truncated: {} bytes", src.len());
    }
    let mut violations = Vec::new();
    for (n, src) in &scanned {
        for b in BANNED_IN_LEAF {
            if src.contains(b) { violations.push(format!("{n}: {b}")); }
        }
    }
    assert!(violations.is_empty(), "leaf purity broken: {violations:?}");
}

/// Anti-vacuity 3 — the same predicate over a poisoned string must fire.
#[test]
fn the_purity_scan_bites() {
    let poisoned = "use crate::state::AppState;\nasync fn x() { y().await; }";
    assert!(BANNED_IN_LEAF.iter().any(|b| poisoned.contains(b)));
}

/// guard 7 / AC-45 — no configurable fabricating source.
#[test]
fn no_configurable_path_can_serve_a_fabricating_recommendation_source() {
    let src = fs::read_to_string(workspace_root().join("apps/api/src/services/recommendation.rs"))
        .expect("recommendation.rs");
    assert!(src.contains("pub scenario_id: Option<String>"), "the field must still exist to be pinned");
    assert_eq!(
        src.matches("scenario_id").count(), 1,
        "`scenario_id` is DESERIALIZED AND NEVER READ — a second mention means something now reads it"
    );
    assert!(src.contains(r#""scenarios": { "enabled": false, "catalog": [] }"#));
    let env_reads: Vec<&str> = src.match_indices("std::env::var(")
        .map(|(i, _)| {
            let tail = &src[i..];
            let start = tail.find('"').unwrap() + 1;
            let end = tail[start..].find('"').unwrap() + start;
            &tail[start..end]
        })
        .collect();
    for name in &env_reads {
        assert!(
            ["AI_REC_LOCAL_ONLY", "DATABASE_URL", "AI_REC_METER_SCOPE"].contains(name),
            "unexpected env read on the rec path: {name}"
        );
    }
    assert!(!env_reads.is_empty(), "anti-vacuity: the env-read extractor found nothing");
}
```

If the allow-list needs a member the tree already has, **add the existing name and say so in the commit
message** — never widen it to a wildcard. `cargo test -p api-rust --test grounding_isolation` → GREEN.
**Commit.**

---

## B15 — guard 6: score identity, two-armed

**Files:** none changed. **Depends on:** B10. **Enforces:** AC-48 (SB).

```powershell
cargo test -p api-rust --test score_identity ; $LASTEXITCODE
git diff --stat -- apps/api/tests/score_identity.rs
```

**Expected:** exit `0`; the diff prints **nothing**. Paste both, verbatim, into the build receipt. Arm (a)
alone can be "fixed" by editing the goldens — the laundering `score_identity.rs:54-55` warns about. **A
non-empty diff is a regression to be explained, never a fix.** If the goldens moved, STOP: the rec leaf
has reached `signals`, the HARD `additive-keeps-score-byte-identical` invariant.

---

## B16 — backend lane close-out

**Depends on:** B1–B15.

```powershell
cargo fmt -p api-rust -- --check ; $LASTEXITCODE
cargo clippy -p api-rust --all-targets ; $LASTEXITCODE
cargo check -p api-rust --features postgres ; $LASTEXITCODE
cargo test  -p api-rust ; $LASTEXITCODE
```

All exit `0`. Record the final pass count and its delta against B1 (expect **+29**: B2 +1, B3 +1, B4 +1,
B5 +1, B6 +2, B7 +6, B8 +7, B9 +4, B10 +1, B11 +1, B12 +4). Hand V3 the guard list. **Commit.**

---

# TRACK F — frontend (`apps/dashboard` + `libs/api`)

Every F-item binds to `INTERFACE_CONTRACT.md`, never to a B-item's internals. F2 encodes the contract as
types on day one, so F3–F17 can be written and tested with **zero** backend running. **The gated prefill
(F4's lookup + F15–F17) needs no new contract field and gates on no B-item — including D8's third arm,
which is the *absence* of the block, a presence check on data already specified.**

## F1 — Preflight: baseline, and clear the stale-`tsc` trap

```powershell
Remove-Item -Recurse -Force apps/dashboard/dist, apps/dashboard/out-tsc -ErrorAction SilentlyContinue
Get-ChildItem -Recurse -Filter *.tsbuildinfo apps/dashboard | Remove-Item -Force -ErrorAction SilentlyContinue
npx nx typecheck @convexa/dashboard ; $LASTEXITCODE
npx nx test @convexa/dashboard ; $LASTEXITCODE
```

**Expected:** typecheck exits `0`; the suite reports **1639 passing** with exactly **5** red files
(`readonly.spec.tsx`, `positions.risk.spec.tsx`, `grouping.integration.spec.tsx`, `stage3-amber.spec.ts`,
`orders.risk.spec.tsx`). Record the exact numbers. **A 6th red file later is a new regression.**

---

## F2 — `libs/api`: the grounding types (contract-shaped, no runtime)

**Files:** `libs/api/src/lib/convexa.ts`. **Depends on:** F1. **Unchanged by D8** — the third prefill arm
is the absence of `grounding`, which this type already models as an optional key.

Insert after the `CitedContract` block (`:1549-1555`):

```ts
// ---- ai-rec-grounding response types (INTERFACE_CONTRACT §1) ------------------------------------

/** Four members, ONE fixed order server-side, first match wins. Collapsing `not_checkable` into
 *  `untraced` is forbidden: it would stamp "matches nothing we own" on a number nobody could check. */
export type GroundingState = 'not_applicable' | 'not_checkable' | 'traced' | 'untraced';

/** Non-null IFF `state === 'traced'`, and CONSTRAINED PER FIELD: `exit_stop`/`invalidation_level` may
 *  emit only `exact`/`near`; `exit_target` only `inside_range`; the other two, none. */
export type MatchBasis = 'exact' | 'near' | 'inside_range';

export type NotCheckableReason =
  | 'structurally_unchecked' | 'no_named_level' | 'no_cited_expiration' | 'straddle_move_unavailable';

/** The eleven price-scale anchors, read off the SENT market_state. There is no cap member and there
 *  never will be one — that is what makes `traces to Convexa's risk cap (500)` unrenderable. */
export type AnchorKind =
  | 'gex_spot' | 'call_wall' | 'put_wall' | 'peak_gex_strike' | 'gamma_flip' | 'max_pain'
  | 'vwap' | 'vwap_upper_2' | 'vwap_upper_3' | 'vwap_lower_2' | 'vwap_lower_3';

export type GroundingCard =
  | 'not_applicable' | 'local_rules' | 'none_traced' | 'could_not_check' | 'some_traced' | 'all_traced';

/** Every key is ALWAYS present, `null` where the discriminator does not carry it. A client must not
 *  select a clause shape by inspecting which keys are non-null — switch on `state`, then `basis`, then
 *  `not_checkable_reason`. */
export interface GroundingField {
  state: GroundingState;
  basis: MatchBasis | null;
  anchor_kind: AnchorKind | null;
  anchor_value: number | null;
  range_low: number | null;
  range_high: number | null;
  expiration: string | null;
  not_checkable_reason: NotCheckableReason | null;
}

export interface GroundingCounts {
  checked: number;
  traced: number;
  untraced: number;
  /** Excludes every `structurally_unchecked` one; includes the cited contract when
   *  `right_undetermined`. Invariant: traced + untraced + not_checkable === checked. */
  not_checkable: number;
}

export interface Grounding {
  card: GroundingCard;
  counts: GroundingCounts;
  /** The payload-stated constant, once per response. Never per field, never a query knob. */
  tolerance_pct: number;
  fields: {
    exit_stop: GroundingField;
    exit_target: GroundingField;
    invalidation_level: GroundingField;
    max_risk: GroundingField;
    position_size: GroundingField;
  };
}

/** The widened OUTPUT of the ONE `max_risk` parse. Non-null IFF `parsed_risk_dollars` is null and the
 *  risk text was examined. The ACCEPTED INPUT SET did not move by one input. */
export type RiskRefusal = 'no_text' | 'no_dollar_figure' | 'multiple_different_figures';
```

Then: `CapCheck` gains `risk_refusal: RiskRefusal | null;` under `verdict`; `FieldReasons` gains
`invalidation_level: FieldReason | null;`; `RecResponse` gains, beside `cited_contract`:
`/** Absent ONLY from a pre-feature server (the one client-selected branch). */ grounding?: Grounding;`

Prefer required keys + fixture updates over `?` — a required key is what makes a mis-wired renderer fail a
typed check. `npx nx typecheck` → `0` after F9. **Commit.**

---

## F3 — `copy.ts`: the closed literal set, verbatim from SPEC §4

**Files:** `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/copy.ts`. **Depends on:** F2.
**Every string is verbatim from SPEC §4 — do not improvise, do not re-wrap.** **D8: `PREFILL_WITHHELD`
carries THREE members.**

```ts
// ---- ai-rec-grounding (SPEC §4; verbatim) ------------------------------------------------------
// Every string below is produced by a CLOSED LOOKUP on a wire token in `literals.ts`, never by testing
// a null and never by comparing two figures in the browser.

/** Card level — exactly one, on a produced trade verdict only. */
export const GROUNDING_CARD = {
  all_traced: 'Every checked figure traces to a Convexa number.',
  none_traced: 'No figure here traces to a Convexa number.',
  could_not_check: "Convexa couldn't check these figures this cycle.",
  local_rules: "No AI read here — these figures come from Convexa's own rules.",
} as const;

/** `some_traced` interpolates the SERVER's integers — the browser never counts. */
export const someTracedLine = (traced: number, checked: number) =>
  `${traced} of ${checked} checked figures trace to a Convexa number — each exception says so below.`;

/** The ONE client-selected branch: `grounding` absent. Distinct from `could_not_check` — "the check
 *  ran and could not conclude" vs "no check reached the browser". Never synonyms. */
export const GROUNDING_BLOCK_ABSENT = "This read wasn't checked against Convexa's numbers.";

/** Per figure — on the exit stop, the exit target and the invalidation level only. */
export const tracesToLine = (anchor: string, value: number) => `traces to Convexa's ${anchor} (${value})`;
export const nearLine = (anchor: string, value: number) => `near Convexa's ${anchor} (${value})`;
export const insideRangeLine = (expiration: string, low: number, high: number) =>
  `inside Convexa's implied move for ${expiration} (${low}–${high})`;
export const UNTRACED_LINE = "the AI's own number";
export const UNTRACED_TIP =
  'Convexa compared this against the levels and quotes it computed and didn’t find it. That doesn’t ' +
  'make it wrong — it means Convexa can’t vouch for it.';
export const COULD_NOT_CHECK_LINE = "couldn't check this";
export const couldNotCheckTip = (clause: string) => `${clause}. The figure above is the AI's, unchanged.`;

/**
 * The withheld-prefill literals (SPEC §4 "The simulated entry dialog"; GATE Z Z1 + D8 / AC-68).
 * THREE members of the SAME closed set, each echoing the card's own words so the reader connects the
 * two surfaces. The third exists because reusing `not_checkable` for a response that carried NO block
 * would be the `absent-is-not-none` collapse the card's `couldn't check` vs `wasn't checked` split
 * exists to prevent — and the dialog is the worst place in the feature to blur them.
 *
 * Rendered VERBATIM by the shared dialog from the prefill input — the same seam `provenance` and
 * `sizingNote` already use (`TradeEntryDialogView.tsx:500,852`), so the dialog imports nothing from
 * `pages/` (dependency direction is downward only).
 */
export const PREFILL_WITHHELD = {
  untraced: "Not pre-filled — this was the AI's own number.",
  not_checkable: "Not pre-filled — Convexa couldn't check this figure.",
  block_absent: "Not pre-filled — this read wasn't checked against Convexa's numbers.",
} as const;

/** The total label lookup over the closed anchor token. Five reuse the words `Levels in play` already
 *  prints (`reasoning.tsx:107-113`); the fallback is honest and still carries the number. */
export const ANCHOR_LABEL = {
  gex_spot: 'levels spot', // NOT `spot` — the levels anchor is not the live display price
  call_wall: 'call wall',
  put_wall: 'put wall',
  peak_gex_strike: 'peak gamma strike',
  gamma_flip: 'gamma flip',
  max_pain: 'max pain',
  vwap: 'VWAP',
  vwap_upper_2: 'VWAP +2σ',
  vwap_upper_3: 'VWAP +3σ',
  vwap_lower_2: 'VWAP −2σ',
  vwap_lower_3: 'VWAP −3σ',
} as const;
export const ANCHOR_LABEL_FALLBACK = 'a Convexa level';

/** Missing-input clauses — three members are emittable in v1; the lookup carries NO arm for a state the
 *  server cannot produce (`structurally_unchecked` renders nothing at all). */
export const MISSING_INPUT_CLAUSE = {
  no_named_level: 'Convexa had no named levels for this snapshot',
  straddle_move_unavailable: 'Convexa had no implied move for that expiration',
  no_cited_expiration: "The read didn't name an expiration to measure against",
} as const;

/** The definition tooltip — on the card-level line, once. `{tolerance}` comes off the payload; if the
 *  constant is absent the parenthesis is omitted entirely and nothing is hardcoded. */
export const groundingDefinitionTip = (tolerance: number | null) =>
  'Traced means the figure lines up with a number Convexa computed from the option chain — not a ' +
  'judgement that the trade is good. Convexa checks the stop, the target and the invalidation level. ' +
  "It doesn't check the suggested size; the contract named and your risk cap each have their own " +
  'line. Near means the figure sits inside Convexa’s match window for that level' +
  (tolerance == null ? '' : ` (${tolerance}% of the level, never less than a cent)`) +
  '. The implied-move range is measured from the snapshot’s spot at that expiration.';

/** The cap surface — the shipped literal plus the refusal reason. Absent/unrecognized ⇒ the shipped
 *  literal ALONE, never a guess. */
export const CAP_REFUSAL_SENTENCE = {
  no_text: `${CAP_COULD_NOT_CHECK} The read gave no risk figure.`,
  no_dollar_figure: `${CAP_COULD_NOT_CHECK} Convexa couldn't read a dollar amount in the risk figure.`,
  multiple_different_figures: `${CAP_COULD_NOT_CHECK} The read named more than one dollar amount.`,
} as const;
```

`CAP_COULD_NOT_CHECK` already exists at `copy.ts:205` — reference it, never re-spell it. **Commit.**

---

## F4 — `literals.ts`: the closed-lookup selectors, unit-tested

**Files:** `.../ai-rec/literals.ts`, `literals.spec.ts`. **Depends on:** F3. **Enforces:** AC-3 (SB),
AC-6, AC-22 (SB), AC-23, AC-26, AC-40, and the **AC-7 / AC-68 gate lookup — five arms after D8**.

**Step 1 — the failing tests** (`literals.spec.ts`):

```ts
describe('ai-rec-grounding · closed lookups', () => {
  it('AC-3 — the clause shape is selected by the wire `basis` alone, never by which numbers are present', () => {
    const near = figureClause({ state: 'traced', basis: 'near', anchor_kind: 'call_wall',
      anchor_value: 412, range_low: 999, range_high: 999, expiration: '2026-09-18',
      not_checkable_reason: null });
    expect(near).toEqual({ kind: 'near', anchor: 'call wall', value: 412 });
    const range = figureClause({ state: 'traced', basis: 'inside_range', anchor_kind: 'call_wall',
      anchor_value: 412, range_low: 400, range_high: 420, expiration: '2026-09-18',
      not_checkable_reason: null });
    expect(range).toEqual({ kind: 'inside_range', expiration: '2026-09-18', low: 400, high: 420 });
  });

  it('AC-6 — all eleven anchor tokens map; an unrecognized token takes the level-class fallback', () => {
    for (const t of ['gex_spot','call_wall','put_wall','peak_gex_strike','gamma_flip','max_pain',
                     'vwap','vwap_upper_2','vwap_upper_3','vwap_lower_2','vwap_lower_3'] as const) {
      expect(anchorLabel(t)).toBeTruthy();
      expect(anchorLabel(t)).not.toMatch(/_/); // never a raw wire string
    }
    expect(anchorLabel('cap' as never)).toBe(ANCHOR_LABEL_FALLBACK);
    expect(anchorLabel(null)).toBe(ANCHOR_LABEL_FALLBACK);
  });

  it('AC-26 — the structurally-unchecked pair renders NO clause', () => {
    expect(figureClause({ state: 'not_checkable', not_checkable_reason: 'structurally_unchecked',
      basis: null, anchor_kind: null, anchor_value: null, range_low: null, range_high: null,
      expiration: null })).toEqual({ kind: 'none' });
  });

  it('AC-22 (SB) + AC-68 — every literal is distinct from every other AND from all four shipped absence literals', () => {
    const closedSet = [
      GROUNDING_CARD.all_traced, GROUNDING_CARD.none_traced, GROUNDING_CARD.could_not_check,
      GROUNDING_CARD.local_rules, GROUNDING_BLOCK_ABSENT, someTracedLine(1, 4),
      UNTRACED_LINE, COULD_NOT_CHECK_LINE,
      PREFILL_WITHHELD.untraced, PREFILL_WITHHELD.not_checkable, PREFILL_WITHHELD.block_absent,
    ];
    expect(new Set(closedSet).size).toBe(closedSet.length);
    const absence = ['—', 'not set', 'unavailable', 'not given'];
    for (const s of closedSet) expect(absence).not.toContain(s);
    expect(GROUNDING_CARD.could_not_check).not.toBe(GROUNDING_BLOCK_ABSENT);
    for (const s of closedSet) expect(s.toLowerCase()).not.toContain('grounding');
  });

  it('AC-68 (D8) — the THREE prefill literals are pairwise distinct in their TAILS, not merely as strings', () => {
    const three = [PREFILL_WITHHELD.untraced, PREFILL_WITHHELD.not_checkable, PREFILL_WITHHELD.block_absent];
    expect(new Set(three).size).toBe(3);
    // They deliberately SHARE the `Not pre-filled — ` stem; the distinction must live in the tail, and
    // no tail may be a substring of another (which would let one read as a truncation of the other).
    const stem = 'Not pre-filled — ';
    const tails = three.map((s) => { expect(s.startsWith(stem)).toBe(true); return s.slice(stem.length); });
    expect(new Set(tails).size).toBe(3);
    for (const a of tails) for (const b of tails) if (a !== b) expect(b.includes(a)).toBe(false);
    // The third borrows the CARD's exact words so the two surfaces name one fact the same way…
    expect(PREFILL_WITHHELD.block_absent).toContain("wasn't checked against Convexa's numbers");
    // …while staying a distinct string from the card literal itself.
    expect(PREFILL_WITHHELD.block_absent).not.toBe(GROUNDING_BLOCK_ABSENT);
  });

  it('AC-40 — the three refusal sentences are distinct; an absent/unknown token renders the shipped literal alone', () => {
    expect(capRefusalLine('not_checkable', 'no_text')).toBe(CAP_REFUSAL_SENTENCE.no_text);
    expect(capRefusalLine('not_checkable', null)).toBe(CAP_COULD_NOT_CHECK);
    expect(capRefusalLine('not_checkable', 'bogus' as never)).toBe(CAP_COULD_NOT_CHECK);
    expect(new Set(Object.values(CAP_REFUSAL_SENTENCE)).size).toBe(3);
  });

  it('AC-16 (SB) — poisoning a per-field token changes no count and no card member', () => {
    const g = allTracedGrounding();
    const poisoned = { ...g, fields: { ...g.fields, exit_stop: { ...g.fields.exit_stop, state: 'untraced' as const } } };
    expect(cardGroundingLine(poisoned)).toEqual(cardGroundingLine(g));
  });

  it('AC-7 (SB) / AC-68 — the prefill gate is a closed lookup on the wire state, FIVE arms', () => {
    const f = (state: GroundingState) => ({ state, basis: null, anchor_kind: null, anchor_value: null,
      range_low: null, range_high: null, expiration: null, not_checkable_reason: null });
    expect(prefillGate(f('traced'))).toEqual({ seed: true, reason: null });
    expect(prefillGate(f('untraced'))).toEqual({ seed: false, reason: PREFILL_WITHHELD.untraced });
    expect(prefillGate(f('not_checkable'))).toEqual({ seed: false, reason: PREFILL_WITHHELD.not_checkable });
    // `not_applicable` — the rec stated no figure; there was nothing to seed and nothing to explain.
    expect(prefillGate(f('not_applicable'))).toEqual({ seed: false, reason: null });
    // D8 — NO grounding block: never a seed, AND its own reason (never the `not_checkable` one).
    expect(prefillGate(undefined)).toEqual({ seed: false, reason: PREFILL_WITHHELD.block_absent });
    expect(prefillGate(null)).toEqual({ seed: false, reason: PREFILL_WITHHELD.block_absent });
    expect(prefillGate(undefined).reason).not.toBe(PREFILL_WITHHELD.not_checkable);
    // An unrecognized token is unreachable from a conformant server (the wire enum is closed); the
    // shipped discipline is "unknown renders nothing, never a guess" — and it never seeds.
    expect(prefillGate(f('bogus' as never))).toEqual({ seed: false, reason: null });
  });
});
```

**Step 2 — implement** (append to `literals.ts`):

```ts
// ---- ai-rec-grounding: closed lookups (SPEC §4, INTERFACE_CONTRACT rule 1) ----------------------

export type FigureClause =
  | { kind: 'none' }
  | { kind: 'exact'; anchor: string; value: number }
  | { kind: 'near'; anchor: string; value: number }
  | { kind: 'inside_range'; expiration: string; low: number; high: number }
  | { kind: 'untraced' }
  | { kind: 'not_checkable'; clause: string };

/** Total over the eleven-member closed set; an unrecognized token renders the level-class fallback,
 *  never a raw wire string and never a badge. */
export function anchorLabel(kind: AnchorKind | null | undefined): string {
  if (!kind) return ANCHOR_LABEL_FALLBACK;
  return ANCHOR_LABEL[kind] ?? ANCHOR_LABEL_FALLBACK;
}

/** Switch on `state`, then `basis`, then `not_checkable_reason` — NEVER on which keys are non-null, and
 *  never by comparing two figures (AC-3, ship-blocking). */
export function figureClause(f: GroundingField | null | undefined): FigureClause {
  if (!f) return { kind: 'none' };
  switch (f.state) {
    case 'traced':
      switch (f.basis) {
        case 'exact':
          return f.anchor_value == null
            ? { kind: 'none' } // a traced clause naming a source with no number renders NOWHERE (AC-2)
            : { kind: 'exact', anchor: anchorLabel(f.anchor_kind), value: f.anchor_value };
        case 'near':
          return f.anchor_value == null
            ? { kind: 'none' }
            : { kind: 'near', anchor: anchorLabel(f.anchor_kind), value: f.anchor_value };
        case 'inside_range':
          return f.range_low == null || f.range_high == null || f.expiration == null
            ? { kind: 'none' }
            : { kind: 'inside_range', expiration: f.expiration, low: f.range_low, high: f.range_high };
        default:
          return { kind: 'none' };
      }
    case 'untraced':
      return { kind: 'untraced' };
    case 'not_checkable': {
      const r = f.not_checkable_reason;
      if (!r || r === 'structurally_unchecked') return { kind: 'none' };
      const clause = MISSING_INPUT_CLAUSE[r];
      return clause ? { kind: 'not_checkable', clause } : { kind: 'none' };
    }
    case 'not_applicable':
    default:
      return { kind: 'none' };
  }
}

export type CardLine =
  | { kind: 'none' }
  | { kind: 'quiet'; text: string; tip: string | null }
  | { kind: 'warning'; text: string; tip: string | null };

/** The ONE client-selected branch is `grounding` ABSENT — a lookup on PRESENCE, never a re-derivation
 *  from figures. The browser never counts, compares or folds. */
export function cardGroundingLine(g: Grounding | null | undefined): CardLine {
  if (!g) return { kind: 'warning', text: GROUNDING_BLOCK_ABSENT, tip: null };
  const tip = groundingDefinitionTip(g.tolerance_pct ?? null);
  switch (g.card) {
    case 'all_traced':      return { kind: 'quiet', text: GROUNDING_CARD.all_traced, tip };
    case 'some_traced':     return { kind: 'quiet', text: someTracedLine(g.counts.traced, g.counts.checked), tip };
    case 'local_rules':     return { kind: 'quiet', text: GROUNDING_CARD.local_rules, tip };
    case 'none_traced':     return { kind: 'warning', text: GROUNDING_CARD.none_traced, tip };
    case 'could_not_check': return { kind: 'warning', text: GROUNDING_CARD.could_not_check, tip };
    case 'not_applicable':
    default:                return { kind: 'none' };
  }
}

/**
 * AC-7 (SB) / AC-68 — the simulated entry dialog's prefill gate. A CLOSED LOOKUP on the wire state.
 *
 *   traced          → seeds exactly as on `main`
 *   untraced        → withheld, with its own reason
 *   not_checkable   → withheld, with its own reason
 *   not_applicable  → the rec stated no figure: nothing to seed, nothing to explain (unchanged)
 *   NO BLOCK (D8)   → withheld, with its OWN THIRD reason — never the `not_checkable` one, which
 *                     would collapse "we could not check this figure" into "no check reached this
 *                     browser at all" (`absent-is-not-none`) at the one boundary where a number stops
 *                     being a display and becomes an input.
 *
 * **A missing check is NEVER a licence to pre-fill. D8 added an explanation, never a seed.**
 *
 * An unrecognized token is unreachable from a conformant server (the wire enum is closed). It is
 * treated as not-seeded with no reason, following the discipline this module already applies three
 * times (`capSurface`, `figureClause`, `cardGroundingLine`): unknown renders nothing, never a guess.
 */
export function prefillGate(
  f: GroundingField | null | undefined,
): { seed: boolean; reason: string | null } {
  if (f == null) return { seed: false, reason: PREFILL_WITHHELD.block_absent }; // D8 — checked FIRST
  switch (f.state) {
    case 'traced':        return { seed: true, reason: null };
    case 'untraced':      return { seed: false, reason: PREFILL_WITHHELD.untraced };
    case 'not_checkable': return { seed: false, reason: PREFILL_WITHHELD.not_checkable };
    case 'not_applicable':
    default:              return { seed: false, reason: null };
  }
}

/** The shipped `CAP_COULD_NOT_CHECK` literal plus the refusal reason. Absent/unrecognized ⇒ the shipped
 *  literal ALONE, never a guess. Nothing renders off `cap_not_derivable_reason`. */
export function capRefusalLine(
  verdict: CapVerdict | null | undefined,
  refusal: RiskRefusal | null | undefined,
): string {
  if (verdict !== 'not_checkable') return CAP_COULD_NOT_CHECK;
  return (refusal && CAP_REFUSAL_SENTENCE[refusal]) || CAP_COULD_NOT_CHECK;
}
```

**Note the ordering:** the `f == null` check must come **before** the `switch`, so block-absent and
`not_applicable` cannot collapse into one arm — they are different facts with different literals.

**Step 3:** `npx nx test @convexa/dashboard --testPathPattern literals` → GREEN. **Commit.**

---

## F5 — `GroundingNote.tsx`: the card-level line

**Files:** NEW `.../ai-rec/GroundingNote.tsx`. **Depends on:** F4. **Enforces:** AC-15, AC-18, AC-58,
AC-59. **No new colour, token, motion family or component family.** `warning.*` + an `aria-hidden` icon on
the two unhappy members only. **No green, no check glyph, no success slot — including on `all_traced`.**

```tsx
/**
 * GroundingNote — the ONE card-level grounding line (SPEC §4). Renders by CLOSED LOOKUP on the server
 * token via `cardGroundingLine`; the browser never counts, compares or folds. The only client-selected
 * branch is block ABSENCE. Sits below the verdict hero and above the risk tile, nowhere else.
 *
 * Chrome: only the unhappy members carry `warning.*` + icon — per-figure clauses are always quiet
 * captions, because four warning icons per card become wallpaper inside a week, which makes the honest
 * marker LESS honest.
 */
import type { Grounding } from '@convexa/api';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Stack, Tooltip, Typography } from '@mui/material';
import { cardGroundingLine } from './literals';

export function GroundingNote({ grounding }: { grounding: Grounding | null | undefined }) {
  const line = cardGroundingLine(grounding);
  if (line.kind === 'none') return null;
  const warn = line.kind === 'warning';
  return (
    <Stack
      direction="row"
      spacing={0.5}
      data-testid="grounding-card-line"
      data-member={grounding?.card ?? 'block_absent'}
      sx={{ alignItems: 'flex-start', flexWrap: 'wrap', rowGap: 0.5 }}
    >
      {warn && <WarningAmberIcon aria-hidden color="warning" sx={{ fontSize: 16 }} />}
      <Typography variant="caption" sx={{ color: warn ? 'warning.main' : 'text.secondary' }}>
        {line.text}
      </Typography>
      {line.tip && (
        <Tooltip arrow title={line.tip}>
          <InfoOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
        </Tooltip>
      )}
    </Stack>
  );
}
```

`variant="caption"` resolves ≥ 11px through the shipped theme — do not set a `fontSize`, and carry **zero
hex** (AC-59). **Commit.**

---

## F6 — `FigureClause.tsx`: the per-figure clause

**Files:** NEW `.../ai-rec/FigureClause.tsx`. **Depends on:** F4. **Enforces:** AC-1 (SB), AC-2 (SB),
AC-4, AC-8 (SB), AC-11. **Its type-register half is F12.**

```tsx
/**
 * FigureClause — the per-figure grounding clause, rendered directly beneath the value it qualifies, on
 * the exit stop, the exit target and the invalidation level ONLY. Always a quiet caption: no icon, no
 * chip, no border, no tint. Selected by the wire `basis` token alone (AC-3).
 *
 * An untraced value NEVER renders identically to a traced one: `the AI's own number` is in VISIBLE TEXT
 * beneath it (never colour alone, never tooltip alone — tooltips are unreachable on touch).
 */
import type { GroundingField } from '@convexa/api';
import { Tooltip, Typography } from '@mui/material';
import {
  COULD_NOT_CHECK_LINE, couldNotCheckTip, insideRangeLine, nearLine, tracesToLine,
  UNTRACED_LINE, UNTRACED_TIP,
} from './copy';
import { figureClause } from './literals';

export function FigureClause({ field, testId }: { field: GroundingField | null | undefined; testId: string }) {
  const c = figureClause(field);
  if (c.kind === 'none') return null;
  const caption = (text: string, tip?: string) => {
    const el = (
      <Typography variant="caption" data-testid={testId} data-clause={c.kind}
        sx={{ color: 'text.secondary', display: 'block' }}>
        {text}
      </Typography>
    );
    return tip ? <Tooltip arrow title={tip}>{el}</Tooltip> : el;
  };
  switch (c.kind) {
    case 'exact':         return caption(tracesToLine(c.anchor, c.value));
    case 'near':          return caption(nearLine(c.anchor, c.value));
    case 'inside_range':  return caption(insideRangeLine(c.expiration, c.low, c.high));
    case 'untraced':      return caption(UNTRACED_LINE, UNTRACED_TIP);
    case 'not_checkable': return caption(COULD_NOT_CHECK_LINE, couldNotCheckTip(c.clause));
  }
}
```

**Reviewer probe:** a clause must render **only** on the `value` member of `fieldLiteral` (SPEC §4
component states). F7 enforces that at the call site — which also keeps a numeric `0` stop (absent to
`fieldLiteral`, present to the server) from pairing an absence literal with a grounding sentence.

---

## F7 — wire the surfaces into `AiRecPanel`

**Files:** `.../ai-rec/AiRecPanel.tsx`. **Depends on:** F5, F6. **Enforces:** AC-1, AC-15, AC-19 (SB),
AC-24 (SB), AC-25 (SB), AC-62, AC-67. Four edits, and **only** these four.

**(a) The card-level line** — between the hero `Box` (ends `:996`) and the risk tile `Box` (opens `:1001`):

```tsx
          {/* The ONE card-level grounding line — a qualifier on everything below it, so it sits
              directly above the risk tile and nowhere else. It is one line; it is never a section. */}
          <GroundingNote grounding={rec.grounding} />
```

Not added to the `no_trade` branch (second line of defence for AC-19).

**(b) `Invalidation` moves onto the closed absence set** — replace the `Field` at `:1030-1034`:

```tsx
              <RiskField
                label={COPY.risk.invalidation}
                literal={fieldLiteral({
                  decision: s.decision,
                  value: s.invalidation_level,
                  reason: rec.field_reasons?.invalidation_level,
                })}
                valueTip="The level that says the idea is wrong. If price reaches it, the thesis is invalidated."
                clause={<FigureClause field={rec.grounding?.fields.invalidation_level} testId="clause-invalidation" />}
              />
```

`fmtNum` loses its last caller — grep and delete it if so.

**(c) The clause slot on `RiskField`** (`:757-798`), rendered **only** on the `value` member:

```tsx
function RiskField({ label, literal, valueTip, clause }: {
  label: string;
  literal: FieldLiteral;
  valueTip?: string;
  /** A clause renders ONLY on the `value` member — never beside an absence literal. */
  clause?: React.ReactNode;
}) {
  const navigate = useNavigate();
  if (literal.kind === 'value')
    return (
      <Box>
        <Field label={label} value={literal.text} tip={valueTip} />
        {clause}
      </Box>
    );
  /* …the existing absence branch, UNCHANGED, and it never renders `clause` … */
```

Then the two exit fields (`:1073-1088`):

```tsx
            <RiskField
              label="Target"
              literal={fieldLiteral({ decision: s.decision, value: s.exit_plan?.target, reason: rec.field_reasons?.exit_target })}
              clause={<FigureClause field={rec.grounding?.fields.exit_target} testId="clause-target" />}
            />
            <RiskField
              label="Stop"
              literal={fieldLiteral({ decision: s.decision, value: s.exit_plan?.stop, reason: rec.field_reasons?.exit_stop })}
              clause={<FigureClause field={rec.grounding?.fields.exit_stop} testId="clause-stop" />}
            />
```

**(d) Nothing else moves.** `Max risk` (`:1021-1029`) and `Suggested size` (`:1092-1099`) get **no**
`clause` prop, ever. `Structure` (`:1044`), `Strike(s)` (`:1045-1048`), `Expiration` (`:1049-1062`),
`Entry trigger` (`:1063`) render exactly as on `main` — **no clause, marker, chip, tint or tooltip**
(AC-25, SB; the halo mitigation is that there is no second signal to generalize from).

`npx nx typecheck` then `npx nx test @convexa/dashboard` → GREEN. **Commit.**

---

## F8 — `CapAnnotation`: the refusal sentence

**Files:** `.../ai-rec/CapAnnotation.tsx`. **Depends on:** F4. **Enforces:** AC-40, AC-37.

Replace `{CAP_COULD_NOT_CHECK}` at `:44` with:

```tsx
          {capRefusalLine(capCheck?.verdict, capCheck?.risk_refusal)}
```

and import `capRefusalLine` from `./literals`. **`within` and `above` keep the shipped warning chrome
untouched** — `within` must not quietly become a green tick the day the prompt fix makes it common.
**Commit.**

---

## F9 — `fixtures.ts`: the payload fixtures

**Files:** `.../ai-rec/fixtures.ts`. **Depends on:** F2. **Enforces:** SPEC §7 arm 4. No backend, no flag,
no network.

Add a `grounding` block to `baseResponse()` (all traced), `risk_refusal: null` on every `cap_check`, and
`invalidation_level: null` on every `field_reasons`, then export:

| Builder | Shape |
|---|---|
| `recAllTraced()` | card `all_traced`, counts `{4,4,0,0}`, stop `traced/exact` on `call_wall`, invalidation `traced/near`, target `traced/inside_range` |
| `recSomeTraced()` | card `some_traced`, counts `{4,3,1,0}`, stop `untraced` |
| `recFabricated()` | card `none_traced`, counts `{4,0,4,0}`, all three `untraced`, `cited_contract.state: 'off_set'` |
| `recCouldNotCheck()` | card `could_not_check`, counts `{3,0,0,3}`, stop/invalidation `not_checkable/no_named_level`, target `not_checkable/no_cited_expiration` |
| `recBlockAbsent()` | `baseResponse()` with the `grounding` key **deleted** (not null — deleted) |
| `recLocalRules()` | card `local_rules`, counts `{2,2,0,0}`, `strikes: []`, `expiration: null`, target `not_applicable` |
| `recLocalRulesNothingCheckable()` | card `not_applicable`, counts `{0,0,0,0}`, every field `not_applicable`, `invalidation_level: null`, `exit_plan: {target:null, stop:null}` |

Every fixture's `max_risk` / `position_size` field carries
`state: 'not_checkable', not_checkable_reason: 'structurally_unchecked'`, `basis: null`; every fixture
carries `tolerance_pct: 0.1`. `recAllTraced` / `recFabricated` / `recCouldNotCheck` / `recBlockAbsent` are
also the F17 prefill fixtures — one set, two consumers. **`recBlockAbsent()` must state real figures**
(`exit_plan.stop` / `target` non-null), or F17 arm 4 cannot tell "withheld" from "nothing to seed".
**Commit.**

---

## F10 — the card component specs

**Files:** NEW `.../ai-rec/ai-rec.grounding.spec.tsx`. **Depends on:** F7, F8, F9. **Enforces:** AC-1,
AC-11, AC-13, AC-15, AC-16, AC-17, AC-18, AC-19, AC-20, AC-24, AC-25, AC-26, AC-27, AC-28, AC-29, AC-30,
AC-31, AC-32, AC-34, AC-44, AC-46, AC-62, AC-64.

Integration only at the network boundary — **the payload fixture is the mock, never a mocked selector and
never a mocked lookup.** Reuse the harness from `ai-rec.risk.spec.tsx` (`App` under `MemoryRouter` +
`AuthProvider` + `AppThemeProvider`, fetch mock that THROWS on any unexpected call). One `it` each:

1. **AC-15/AC-18** — `recAllTraced()` renders exactly **one** `grounding-card-line`, affirmative text,
   positioned between the verdict hero and `cap-annotation` in DOM order.
2. **AC-17** — reads `4`, never `of 5` / `of 6`.
3. **AC-16 (SB)** — poison `fields.exit_stop.state` to `untraced` in a copy of `recAllTraced()`; the card
   line's text is **byte-identical**.
4. **AC-1/AC-11** — on `recFabricated()`, stop / target / invalidation each render their value **and**
   exactly one clause; the model's stop is still on screen without expanding anything.
5. **AC-44 (SB)** — `recFabricated()` shows the *none traced* line and `the AI's own number` on **every**
   value-bearing checked figure.
6. **AC-25 (SB)** — on every fixture, the `Structure` / `Strike(s)` / `Expiration` / `Entry trigger`
   subtrees contain **no** `data-clause` and no `data-testid` starting `clause-`.
7. **AC-26** — `Max risk` and `Suggested size` carry no clause on any fixture.
8. **AC-24 (SB)** — `invalidation_level: null` renders the closed absence literal and **no** clause.
9. **AC-19 (SB)** — `noTradeRec()` renders no card line, no clause, no cap surface, with a cap set and
   with none.
10. **AC-27 (SB)** — `recBlockAbsent()` renders exactly one card line reading
    `This read wasn't checked against Convexa's numbers.` **in place of every per-figure clause**;
    verdict / reasoning / levels / entry action all still render.
11. **AC-28 (SB)** — `recCouldNotCheck()` renders in full; every checked figure carries *couldn't check*.
12. **AC-20** — `recLocalRules()` renders the calm caption with **no** warning icon; clauses render
    normally.
13. **AC-64** — `recLocalRulesNothingCheckable()` renders **no** card line and **no** clause.
14. **AC-13 (SB)** — Accept button, reasoning section and levels strip render identically on
    `recFabricated()` and `recAllTraced()`.
15. **AC-30/AC-31** — drive the shipped SSE-drop and newer-bundle paths (`ai-rec.risk.spec.tsx` §4);
    clause text and card line are **byte-stable**, un-dimmed; POST count does not increase.
16. **AC-34** — no element inside the reasoning section carries `data-clause`.
17. **AC-62** — on `recAllTraced()`, `queryAllByTestId(/^clause-/)` ≤ **3** and
    `queryAllByTestId('grounding-card-line')` = **1**; on `noTradeRec()` both **0**.
18. **AC-32 (amended)** — **no grounding wire token ever renders as user-visible text.** Over every
    fixture, assert `document.body.textContent` contains none of `traced`, `untraced`, `not_checkable`,
    `not_applicable`, `local_rules`, `none_traced`, `could_not_check`, `some_traced`, `all_traced`,
    `inside_range`, `no_named_level`, `no_cited_expiration`, `straddle_move_unavailable`,
    `structurally_unchecked`, `no_text`, `no_dollar_figure`, `multiple_different_figures`, nor any of the
    eleven `anchor_kind` ids. **Anti-vacuity:** the same probe over a hand-built string containing
    `not_checkable` must fire. *(The withdrawn export half is not chased — no artifact carries a clause.)*

**Commit.**

---

## F11 — the banned-word / no-check-glyph source scan, mutation-tested

**Files:** NEW `.../ai-rec/bannedWords.scan.spec.ts`. **Depends on:** F3. **Enforces:** AC-10 (SB).
**Model:** `broker/noNaming.scan.spec.ts`, including both self-checks.

```ts
const RAW = import.meta.glob('./**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const BANNED = ['verified','confirmed','validated','approved','safe','trusted','grounding','hallucinated','suspect','invalid'];
const GLYPHS = ['✓','✔','☑','CheckCircle','CheckIcon','DoneIcon'];
```

Scan **string literals only** (identifiers like `GroundingNote` / `figureClause` are machinery, not copy).
Extract quoted literals from `'…'`, `"…"` and template chunks, skip `.spec.` files, and assert:

- **anti-vacuity 1:** ≥ 10 files scanned, including `./copy.ts`, `./literals.ts`, `./GroundingNote.tsx`,
  `./FigureClause.tsx`;
- **the rule:** no extracted literal contains any `BANNED` word (case-insensitive, whole word — so
  `invalidation_level` as a *token* is exempt but `invalid` as prose is not; assert the exemption
  explicitly so the carve-out is on the record). **All three `PREFILL_WITHHELD` members must pass this
  scan** — they are user-facing copy in this folder;
- **glyphs:** no source under the folder contains any member of `GLYPHS`;
- **anti-vacuity 2 (the mutation):** the same extractor over `const X = 'This figure is verified ✓';`
  **must** report both a banned word and a glyph.

**Commit.**

---

## F12 — the type register as provenance (**dependency: the DESIGN_SYSTEM Amendment**)

**Files:** `.../ai-rec/FigureClause.tsx` + `AiRecPanel.tsx`. **Depends on:** F7, **and on the owner
appending the Amendment to `.spire/clusters/tech/context/DESIGN_SYSTEM.md` § Amendments.**
**Enforces:** AC-9. **Not an assumption — do not build ahead of the append** (SPEC §9 item 3).

**Prerequisite check:** `grep -n "type register" .spire/clusters/tech/context/DESIGN_SYSTEM.md` must hit
under `## Amendments`. If not, the conductor takes it to the owner; the lane does **not** proceed and does
**not** invent the canon entry.

**Once appended:**

```tsx
/** AC-9 — the register is set by GROUNDING STATE (Convexa-computed vs model-asserted), never by which
 *  field it is, and it NEVER carries the state on its own: the clause is always in visible text, so the
 *  distinction survives a screen reader, a monochrome screenshot and a coarse pointer. */
export function registerSx(state: GroundingState | undefined) {
  return state === 'traced' ? { fontFamily: typographyTokens.monoFontFamily } : {};
}
```

`typographyTokens.monoFontFamily` is the shipped token (`shared/theme/tokens.ts:93`) — **zero hex, no new
token, no new family.** Apply to the `Field` value for stop / target / invalidation only. Spec assertions:
(a) two fields with the same state render the same register; (b) the same field with different states
renders different registers; (c) the visible clause text is present in **both** cases.

**If the Amendment is declined,** report it — that changes the AC, and it is a GATE Z question.

---

## F13 — the 393px no-overflow e2e

**Files:** `apps/dashboard-e2e/src/e2e/no-overflow.spec.ts`. **Depends on:** F7. **Enforces:** AC-60.

Extend `producedRecFixture` (`:186-…`) with a `grounding` block in its **densest** shape: card
`some_traced` (the longest card line), stop `traced/near` on `vwap_lower_3` (the longest anchor label),
target `traced/inside_range` with a full date and two 3-digit endpoints, invalidation
`not_checkable/no_named_level` (its only legal reason). Then, inside the existing
`for (const scheme of …)` block:

```ts
    test('ai-rec-grounding — the densest grounding card fits at 393px', async ({ page }) => {
      await seed(page, { scheme });
      await page.goto('/ticker/TSLA');
      await expect(page.getByText('Call wall').first()).toBeAttached();
      await page.getByRole('button', { name: 'Get AI recommendation' }).click();
      // VACUITY GUARD — the new content really did render before measuring.
      await expect(page.getByTestId('grounding-card-line')).toBeAttached();
      await expect(page.getByTestId('clause-stop')).toBeAttached();
      await expect(page.getByTestId('clause-target')).toBeAttached();
      await assertNoHorizontalOverflow(page);
    });
```

`npx playwright install chromium` first if the binary is missing. **Commit.**

---

## F15 — the gated prefill (AC-7, ship-blocking)

**Files:** `.../ai-rec/prefill.ts`, `apps/dashboard/src/app/pages/ticker/useTickerTradeFlows.ts`.
**Depends on:** F4 (the `prefillGate` lookup) and F2 (types). **Depends on NO B-item** — the gate reads
`grounding.fields.{exit_stop,exit_target}.state` off the same response the prefill already consumes; the
interface contract is unchanged.

**What changes on `main`, stated plainly.** `prefill.ts:53-54` seeds `stop`/`target` **unconditionally**
into `TradeEntryDialogView.tsx:221-222`. After this item, an `untraced` or `not_checkable` figure does not
seed — **and neither does a response that carried no grounding block at all** (D8: an absent check is
never a licence to pre-fill; it licences an explanation only). This is a **behaviour change to a shipped
surface** (SPEC §4, §8), taken because a fabricated stop arriving pre-filled in a trade ticket is the harm
this feature exists to prevent.

**Step 1 — the failing tests** (in `ai-rec.risk.spec.tsx`'s existing
`describe('ai-rec · recToPrefill (the handoff object)')`, which already covers this function):

```ts
  it('AC-7 (SB) — a TRACED stop/target seeds exactly as on `main`', () => {
    const rec = recAllTraced();
    const pf = recToPrefill(rec.strategy!, 'Default (no persona)', 's', rec.grounding);
    expect(pf!.stop).toBe(rec.strategy!.exit_plan.stop);
    expect(pf!.target).toBe(rec.strategy!.exit_plan.target);
    expect(pf!.stopWithheldReason).toBeNull();
    expect(pf!.targetWithheldReason).toBeNull();
  });

  it('AC-7 (SB) — an UNTRACED stop does not seed, and says why', () => {
    const rec = recFabricated();
    const pf = recToPrefill(rec.strategy!, 'Default (no persona)', 's', rec.grounding);
    expect(pf!.stop).toBeNull();
    expect(pf!.stopWithheldReason).toBe(PREFILL_WITHHELD.untraced);
  });

  it('AC-7 (SB) — a NOT_CHECKABLE target does not seed, and says why', () => {
    const rec = recCouldNotCheck();
    const pf = recToPrefill(rec.strategy!, 'Default (no persona)', 's', rec.grounding);
    expect(pf!.target).toBeNull();
    expect(pf!.targetWithheldReason).toBe(PREFILL_WITHHELD.not_checkable);
  });

  it('AC-7 (SB) + D8 — NO grounding block never licences a pre-fill, and carries its OWN reason', () => {
    const rec = recBlockAbsent(); // states real stop/target figures — see F9
    const pf = recToPrefill(rec.strategy!, 'Default (no persona)', 's', rec.grounding);
    expect(pf!.stop).toBeNull();
    expect(pf!.target).toBeNull();
    expect(pf!.stopWithheldReason).toBe(PREFILL_WITHHELD.block_absent);
    expect(pf!.targetWithheldReason).toBe(PREFILL_WITHHELD.block_absent);
    // Never the `not_checkable` literal — that would be the `absent-is-not-none` collapse.
    expect(pf!.stopWithheldReason).not.toBe(PREFILL_WITHHELD.not_checkable);
  });

  it('AC-7 (SB) — nothing else acquires a value derived from a withheld figure', () => {
    const rec = recFabricated();
    const pf = recToPrefill(rec.strategy!, 'Default (no persona)', 's', rec.grounding)!;
    // The shipped AC-79 rule still holds: there is no `qty` on the prefill at all.
    expect('qty' in pf).toBe(false);
    // strike / expiration / right come from the rec's OWN contract identity, not from stop/target.
    expect(pf.strike).toBe(rec.strategy!.strikes[0]);
    expect(pf.expiration).toBe(rec.strategy!.expiration);
  });
```

**Step 2 — implement.** `prefill.ts`:

```ts
export interface AiPrefill {
  expiration: string;
  strike: number;
  right: OptionRight;
  stop?: number | null;
  target?: number | null;
  /** AC-68 — the one-line reason a withheld price field shows, or `null` when the field seeded (or
   *  when there was nothing to seed). A CLOSED-SET string chosen by `prefillGate` (three withheld
   *  members after D8), carried verbatim the same way `provenance` / `sizingNote` already are — the
   *  shared dialog imports nothing from `pages/` (dependency direction is downward only). */
  stopWithheldReason?: string | null;
  targetWithheldReason?: string | null;
  provenance?: string;
  sizingNote?: string;
  sizeText: string;
}

/**
 * AC-7 (SB) — the stop/target seed is GATED on the figure's grounding state (SPEC §4, GATE Z Z1 + D8):
 * `traced` seeds exactly as on `main`; `untraced` / `not_checkable` withholds and states why;
 * `not_applicable` had nothing to seed; **a response with NO grounding block withholds too, with its
 * own third reason — a missing check is never a licence to pre-fill.** `position_size` is still never
 * parsed by any lane (AC-79).
 */
export function recToPrefill(
  strategy: RecStrategy,
  personaName: string,
  sizingCopy: string,
  grounding?: Grounding | null,
): AiPrefill | null {
  if (strategy.decision !== 'trade') return null;
  const stopGate = prefillGate(grounding?.fields.exit_stop);
  const targetGate = prefillGate(grounding?.fields.exit_target);
  return {
    expiration: strategy.expiration ?? '',
    strike: strategy.strikes.length ? strategy.strikes[0] : 0,
    right: biasToRight(strategy),
    stop: stopGate.seed ? (strategy.exit_plan?.stop ?? null) : null,
    target: targetGate.seed ? (strategy.exit_plan?.target ?? null) : null,
    stopWithheldReason: stopGate.reason,
    targetWithheldReason: targetGate.reason,
    provenance: `Pre-filled from AI read · ${personaName}`,
    sizingNote: sizingCopy,
    sizeText:
      strategy.position_size && strategy.position_size.trim()
        ? strategy.position_size
        : SIZE_NOT_SUGGESTED,
  };
}
```

**Note:** `grounding?.fields.exit_stop` evaluates to `undefined` when the block is absent, which is
exactly the input `prefillGate`'s D8 arm keys on — one expression covers both the missing-block and the
missing-field cases, and both withhold.

`useTickerTradeFlows.ts` — pass the block at **both** call sites, so Accept (`:67`) and Act (`:81`) are
gated by one change:

```ts
      const pf = recToPrefill(rec.strategy, personaName, COPY.accept.sizing, rec.grounding);
```

**Step 3:** `npx nx typecheck` then the spec → GREEN. **Commit.**

**Reviewer probe:** `onActRec`'s `plan.seededTrigger` comes from `parseTriggerSeed(rec.strategy.entry_trigger)`
— **prose**, not stop/target — so no order field derives from a withheld figure. Confirm that line is
untouched; if a later change routes stop/target into the trigger or the limit price, AC-7 breaks.

---

## F16 — the withheld-reason line in the shared dialog (AC-68, three arms)

**Files:** `apps/dashboard/src/app/features/trading/tradeEntry/types.ts`,
`apps/dashboard/src/app/features/trading/tradeEntry/TradeEntryDialogView.tsx`. **Depends on:** F15.

**Constraint (Global Constraint 9):** an **additive gate on the one shared dialog**, expressed through its
**existing prefill input**. No second dialog, no fork, no real-money variant. `no-real-order-path`
untouched — this withholds a *value* inside the simulated dialog.

**The render path is literal-agnostic by construction** — it prints whatever closed-set string the prefill
carries — so D8's third literal needs **no new JSX branch**. What D8 adds here is the **third test arm**:
the dialog must be proven to render all three, or "renders the reason" is only proven for two of them.

**Step 1 — the failing tests** (`TradeEntryDialog.risk.spec.tsx`, beside the shipped AC-79 test at `:217`):

```ts
  it('AC-68 — a withheld stop/target opens EMPTY with its one-line reason, never a silent blank', async () => {
    renderDialog({ prefill: { expiration: '2026-07-18', strike: 260, right: 'call',
      stop: null, target: null, sizeText: '2 contracts',
      stopWithheldReason: "Not pre-filled — this was the AI's own number.",
      targetWithheldReason: "Not pre-filled — Convexa couldn't check this figure." } });
    expect(await screen.findByLabelText('Stop (optional)')).toHaveValue(null);
    expect(screen.getByTestId('entry-stop-withheld')).toHaveTextContent(
      "Not pre-filled — this was the AI's own number.",
    );
    expect(screen.getByTestId('entry-target-withheld')).toHaveTextContent(
      "Not pre-filled — Convexa couldn't check this figure.",
    );
  });

  it('AC-68 (D8) — the block-absent reason renders too, in its own words', async () => {
    const reason = "Not pre-filled — this read wasn't checked against Convexa's numbers.";
    renderDialog({ prefill: { expiration: '2026-07-18', strike: 260, right: 'call',
      stop: null, target: null, sizeText: '2 contracts',
      stopWithheldReason: reason, targetWithheldReason: reason } });
    expect(await screen.findByLabelText('Stop (optional)')).toHaveValue(null);
    expect(screen.getByTestId('entry-stop-withheld')).toHaveTextContent(reason);
    expect(screen.getByTestId('entry-target-withheld')).toHaveTextContent(reason);
  });

  it('AC-68 — a TRACED (seeded) field shows the value and NO reason line', async () => {
    renderDialog({ prefill: { expiration: '2026-07-18', strike: 260, right: 'call',
      stop: 6, target: 12, sizeText: '2 contracts',
      stopWithheldReason: null, targetWithheldReason: null } });
    expect(await screen.findByLabelText('Stop (optional)')).toHaveValue(6);
    expect(screen.queryByTestId('entry-stop-withheld')).toBeNull();
    expect(screen.queryByTestId('entry-target-withheld')).toBeNull();
  });
```

**Step 2 — implement.** `types.ts` — extend `EntryPrefill` (`:24-33`):

```ts
  /** ai-rec-grounding AC-7/AC-68: the stop/target seed is GATED on the figure's grounding state. When
   *  a field is withheld it arrives `null` and carries this one-line reason, rendered verbatim beneath
   *  the input — a withheld field never comes up silently. One of THREE closed-set members (the AI's
   *  own number / Convexa couldn't check it / no check reached the browser). `undefined`/`null` ⇒
   *  nothing to explain. */
  stopWithheldReason?: string | null;
  targetWithheldReason?: string | null;
```

`TradeEntryDialogView.tsx` — the reset effect at `:221-222` is **unchanged** (`prefill?.stop` is already
`null` when withheld, and `?? ''` already yields the empty field). Add the reason line beneath each input
in the risk-plan `Stack` (`:779-806`):

```tsx
            <Box sx={{ flex: 1 }}>
              <FieldLabel htmlFor="entry-stop">Stop (optional)</FieldLabel>
              <TextField id="entry-stop" size="small" fullWidth type="number" value={stop}
                onChange={(e) => setStop(e.target.value === '' ? '' : Number(e.target.value))}
                slotProps={{ htmlInput: { 'aria-label': 'Stop (optional)' } }} sx={inputSx} />
              {/* AC-68 — a withheld price field says why, in one line, drawn from the closed literal
                  set and rendered VERBATIM (the same seam `provenance`/`sizingNote` use). Three
                  members after D8; this branch is literal-agnostic on purpose, so the copy stays owned
                  by `ai-rec/copy.ts` and this file never re-spells it. An unexplained blank reads as a
                  bug rather than a refusal. */}
              {prefill?.stopWithheldReason && (
                <Typography variant="caption" data-testid="entry-stop-withheld"
                  sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                  {prefill.stopWithheldReason}
                </Typography>
              )}
            </Box>
```

and the identical shape for `entry-target` / `targetWithheldReason`. Quiet caption, `text.secondary`, no
icon, no chip, zero hex — the chrome SPEC §4 assigns to all three literals.

**Step 3:** `npx nx typecheck` then `npx nx test @convexa/dashboard --testPathPattern TradeEntryDialog`
→ GREEN. **Commit.**

**Reviewer probe:** `orders.risk.spec.tsx` is one of the 5 accepted red files — confirm it is still red for
its **pre-existing** reason and that this item did not add a 6th red file or a new failure inside it.

---

## F17 — the prefill-gate integration specs (AC-7, AC-68)

**Files:** `.../ai-rec/ai-rec.grounding.spec.tsx` (a new `describe` block). **Depends on:** F15, F16, F9.

Drive the **real** flow — render the card from a payload fixture, click Accept (and Act), and assert on
the mounted dialog. The payload fixture is the mock; no mocked selector, no mocked lookup.

1. **AC-7 (SB) · traced** — from `recAllTraced()`, Accept ⇒ `Stop (optional)` holds the rec's stop and
   `Target (optional)` holds its target, exactly as on `main`; no `entry-*-withheld` node exists.
2. **AC-7 (SB) · untraced** — from `recFabricated()`, Accept ⇒ both price fields are **empty** and both
   reason lines render the `untraced` literal.
3. **AC-7 (SB) · not_checkable** — from `recCouldNotCheck()`, Accept ⇒ empty + the `not_checkable` line.
4. **AC-7 (SB) + AC-68 (D8) · block absent** — from `recBlockAbsent()` (which states real stop/target
   figures), Accept ⇒ both fields **empty** **and** both reason lines render
   `Not pre-filled — this read wasn't checked against Convexa's numbers.` Assert the rendered text is
   **not** the `not_checkable` literal — collapsing those two is the `absent-is-not-none` failure D8
   exists to prevent. *(This supersedes the ruled-minimum placeholder of the previous revision, which
   asserted only that the field did not seed.)*
5. **AC-7 (SB) · nothing else derived** — on the `recFabricated()` dialog, the quantity field still opens
   at the dialog's own default of `1` (the shipped AC-79 rule), and the strike / expiration / right come
   from the rec's contract identity, not from the withheld figures.
6. **AC-68 · never silent** — for arms 2, 3 **and 4**, every empty price field has a non-empty sibling
   reason node; assert by querying the field's parent `Box`, so a reason rendered somewhere else does not
   pass. **All three literals are exercised across the three arms** — the render is proven for the whole
   closed set, not for two thirds of it.
7. **`single-shared-sim-entry-dialog`** — the *Act* path (`onActRec`) opens **the same** dialog component
   with the same gate applied: assert one `entry-stop` in the DOM and that its withheld behaviour matches
   the Accept path. **Anti-fork guard:** `import.meta.glob('../../features/trading/**/*.tsx')` contains no
   second file exporting a component whose name matches `/TradeEntry.*Dialog/` other than the shipped one.

**Commit.**

---

## F14 — frontend lane close-out

**Depends on:** F1–F13, F15–F17 (F12 only if unblocked).

```powershell
npx nx lint @convexa/dashboard ; $LASTEXITCODE
npx nx typecheck ; $LASTEXITCODE
npx nx test @convexa/dashboard ; $LASTEXITCODE
npx nx format:check --files apps/dashboard/src/app/pages/ticker/widgets/ai-rec,apps/dashboard/src/app/pages/ticker/useTickerTradeFlows.ts,apps/dashboard/src/app/features/trading/tradeEntry,libs/api/src/lib/convexa.ts,apps/dashboard-e2e/src/e2e/no-overflow.spec.ts
```

All exit `0`; the suite reports **≥ 1639 + the new specs** passing with **exactly the same 5** red files.
Never a bare `nx format:write`. **Commit.**

---

# TRACK V — verification

Every item names its command and its expected output. **Check exit codes, not printed summaries.**
**Unmoved by D8 as an item set** — V3 gains coverage inside an existing row, V5 an expectation.

## V1 — backend types and build

```powershell
cargo check -p api-rust --features postgres ; $LASTEXITCODE
cargo clippy -p api-rust --all-targets ; $LASTEXITCODE
cargo fmt -p api-rust -- --check ; $LASTEXITCODE
```
**Expect:** `0`, `0`, `0`. A green `cargo test` does not imply a green `--features postgres` check.

## V2 — the backend suite

```powershell
cargo test -p api-rust ; $LASTEXITCODE
```
**Expect:** exit `0`; pass count = B1 baseline **+29**.

## V3 — the poison drill: every guard proven to bite

For each row: apply the mutation, run the command, observe **RED**, **restore byte-identically**, re-run
to **GREEN**. Record the failing test name per row. Restore with `git checkout -- <file>` —
**never `git stash`.**

| # | Guard | Poison | Command | Expect RED at |
|---|---|---|---|---|
| 1 | exhaustive match | delete the `RecField::ExitTarget` arm in `grounding.rs::resolve_field` | `cargo check -p api-rust` | `non-exhaustive patterns` |
| 2 | partition | make `invalidation_level`'s `fr(...)` always emit `Value::Null` | `cargo test -p api-rust a_field_reason_exists` | `partition broken for invalidation_level` |
| 3 | leaf purity | add `use crate::state::AppState;` to `grounding.rs` | `cargo test -p api-rust --test grounding_isolation` | `leaf purity broken` |
| 4 | structurally-unchecked set | add `RecField::ExitTarget` to the `MaxRisk \| PositionSize` arm | `cargo test -p api-rust the_structurally_unchecked_set` | set inequality |
| 5 | count identity | drop `c.checked += 1` from `counts`' `Traced` arm | `cargo test -p api-rust the_counts_satisfy` | `identity broken` |
| 6a | score identity | set `PINNED_SCORE_DP_TRUE = 9` | `cargo test -p api-rust --test score_identity` | `score (dark_pool=true) drifted` |
| 6b | pin-file diff | (no mutation — the check IS the diff) | `git diff --stat -- apps/api/tests/score_identity.rs` | must print **nothing** after 6a is restored |
| 7 | no fabricator | add `let _ = body.scenario_id;` to `generate_recommendation` | `cargo test -p api-rust no_configurable_path` | `scenario_id` count `2` |
| 8a | tolerance widening | `GROUNDING_TOL_PCT: f64 = 1.0` | `cargo test -p api-rust the_resolution_boundaries` | `exit_stop @ 500.51` |
| 8b | cent floor | `.max(0.01)` → `.max(0.0)` | same | `exit_stop @ 2.008` |
| 8c | pruned→raw | pass `raw_move.as_ref()` at the `base` call site | `cargo test -p api-rust a_target_is_never_traced` | target reads `traced` |
| 8d | constant Traced | replace the `ExitStop` arm body with `FieldGrounding::level(MatchBasis::Exact, AnchorKind::GexSpot, 0.0)` | `cargo test -p api-rust the_resolution_boundaries` | `exit_stop: no untraced arm` (non-vacuity) |
| 9 | field/basis leak | make `ExitStop` return `MatchBasis::InsideRange` | `cargo test -p api-rust the_legal_field_basis` | `exit_stop must never emit inside_range` |
| F-a | banned words | add `export const X = 'verified ✓';` to `copy.ts` | `npx nx test @convexa/dashboard --testPathPattern bannedWords` | banned-word + glyph assertions |
| F-b | **prefill gate (AC-7, SB)** | in `prefillGate`, make the `untraced` arm return `{ seed: true, reason: null }`; **then, separately**, make the `f == null` (block-absent) branch return `{ seed: true, reason: null }` | `npx nx test @convexa/dashboard --testPathPattern "literals\|grounding"` | the five-arm unit test **and** F17 arms 2 and 4 — **both mutations must be run**, because the block-absent branch is the one D8 added and an untested arm is an unproven guard |
| F-c | **withheld reason, all three literals (AC-68)** | (i) delete the `entry-stop-withheld` block from `TradeEntryDialogView.tsx`; (ii) restore, then point `PREFILL_WITHHELD.block_absent` at `PREFILL_WITHHELD.not_checkable` (the `absent-is-not-none` collapse D8 forbids) | `npx nx test @convexa/dashboard --testPathPattern "TradeEntryDialog\|literals\|grounding"` | (i) AC-68 "never a silent blank" ×3 arms; (ii) the three-way disjointness test **and** F17 arm 4's not-`not_checkable` assertion |
| F-d | **wire token leak (AC-32)** | render `{rec.grounding?.card}` verbatim in `GroundingNote` | `npx nx test @convexa/dashboard --testPathPattern grounding` | F10 item 18 |

**After the drill:** `git status --porcelain apps/api apps/dashboard libs/api` shows **only** the lane's
intended changes. **A guard written but never poison-proved does not satisfy
`structural-over-prose-enforcement`.**

## V4 — score identity, two-armed (AC-48, SB)

```powershell
cargo test -p api-rust --test score_identity ; $LASTEXITCODE
git diff --stat -- apps/api/tests/score_identity.rs
```
**Expect:** exit `0`; the diff prints **nothing**. Both lines paste verbatim into the receipt. A non-empty
diff is a regression to be explained, **never a fix**.

## V5 — the frontend suite and its accepted reds

```powershell
npx nx test @convexa/dashboard ; $LASTEXITCODE
```
**Expect:** exactly **5** red files, and exactly `readonly.spec.tsx`, `positions.risk.spec.tsx`,
`grouping.integration.spec.tsx`, `stage3-amber.spec.ts`, `orders.risk.spec.tsx`. **A 6th is a new
regression** — name it and stop. Pass count ≥ F1 baseline plus the new specs (`literals.spec.ts` incl. the
three-way disjointness and five-arm gate tests, `ai-rec.grounding.spec.tsx` incl. the F17 block,
`bannedWords.scan.spec.ts`, and the **three** new `TradeEntryDialog.risk.spec.tsx` cases). **F16 touches a
shared dialog** — confirm `TradeEntryDialog.risk.spec.tsx` and `positions.risk.spec.tsx` moved no further
into red.

## V6 — typecheck (Vitest does not typecheck)

```powershell
Remove-Item -Recurse -Force apps/dashboard/dist, apps/dashboard/out-tsc -ErrorAction SilentlyContinue
npx nx typecheck ; $LASTEXITCODE
```
**Expect:** `0`. TS2353/TS6305 ⇒ the stale-`tsc --build` trap: delete the artifacts, rebuild
`tsconfig.app.json` before `tsconfig.spec.json`, re-run.

## V7 — lint + scoped format

```powershell
npx nx lint @convexa/dashboard ; $LASTEXITCODE
npx nx format:check --files apps/dashboard/src/app/pages/ticker/widgets/ai-rec,apps/dashboard/src/app/features/trading/tradeEntry,libs/api/src/lib/convexa.ts,apps/api/src/services/rec_inputs,apps/api/src/services/recommendation.rs,apps/api/tests/grounding_isolation.rs
```
**Expect:** `0` and no unformatted files. **Never a bare `nx format:write`.**

## V8 — the 393px e2e

```powershell
npx playwright install chromium
npx nx e2e dashboard-e2e --grep "393px" ; $LASTEXITCODE
```
**Expect:** `0`, including the new densest-grounding-card test in **both** schemes with all four vacuity
locators attached before measuring.

## V9 — the interface conformance runner (layer 3)

```powershell
npm run ports:free
cargo run -p api-rust -- serve --bind 127.0.0.1:8010
node .claude/tools/interface_conformance.mjs `
  --contract .spire/clusters/tech/contracts/ai-rec-grounding/INTERFACE_CONTRACT.md `
  --url http://127.0.0.1:8010 `
  --report .spire/clusters/tech/contracts/ai-rec-grounding/conformance-receipt.json
```
**Expect:** exit `0`; both endpoints PASS with every required path present. **:8010, never :8000.**
Endpoint order is load-bearing (`GET /api/ticker/{ticker}` warms the snapshot first); neither endpoint
needs a session. **A green receipt here is necessary and not sufficient.**

## V10 — layer 2: the live payload walk (AC-66, key-gated)

With a resolvable key and a session cookie, POST once to
`http://127.0.0.1:8010/api/recommendation/TSLA` and walk the body against the **38-path required list** in
`INTERFACE_CONTRACT.md` §1a: every path present, every type as documented, every closed token a declared
member. Plus the three cross-checks a presence walk cannot express:
`traced + untraced + not_checkable == checked`; every emitted `basis` legal for its field; `tolerance_pct`
equal to the constant B13's fixtures were written against (`0.1`).

Write the body + the walk result to `.../ai-rec-grounding/live-payload-receipt.md`.
**With no key:** record **not-run, with that reason** — never a pass. The named gap (SPEC §9 item 6)
stands. Do not substitute layer 1 (V2) for it.

## V11 — the live browser arm (AC-21, review, not ship-blocking)

**Requires a resolvable key** — `recommendation.rs:655` returns the unavailable envelope when
`!resolved.usable()`, before the `local_only` read. **No network call, no vendor spend** — the provider
branch is not taken.

```powershell
$env:AI_REC_LOCAL_ONLY='1'; cargo run -p api-rust -- serve --bind 127.0.0.1:8010
npx nx serve @convexa/dashboard
```
Point the dashboard proxy at :8010. Pick a ticker whose snapshot has a **non-null `gamma_flip`** (check
`GET /api/ticker/{t}` first) — a null-flip snapshot renders no line at all, which is AC-64, not a failure.

**Expect, without expanding anything:** the card line reads
`No AI read here — these figures come from Convexa's own rules.` (calm caption, no amber, no icon); the
exit stop renders traced naming `gamma flip` with its value; the cap line reads
`Couldn't check against your cap. Convexa couldn't read a dollar amount in the risk figure.`
(`1R defined-risk` ⇒ `no_dollar_figure`). Screenshot light and dark.
**Also record AC-7 live:** the local rec's stop is `traced`, so clicking *Act* pre-fills the stop exactly
as on `main` and **no** reason line renders — the gate withholds nothing on this arm, which is the correct
observation, not a miss.

**With no key:** record not-run with that reason.

## V12 — the D7 laddered measurement (AC-47, review, explicitly NOT ship-blocking)

**Write the ladder into the artifact FIRST and commit it, before the split is seen.** That
pre-commitment is what makes this a measurement rather than a negotiation.
Artifact: `.../ai-rec-grounding/grounding-rate.md` (follows `tradeable-rec-inputs`'
`before-after-verdicts.md`).

1. **Pre-commit the ladder, verbatim:** *a high `no match` rate ⇒ **one** prompt revision ("quote the
   level exactly as the context gives it") and **one** re-run ⇒ still high ⇒ **ship with the honest rate
   recorded** here and in `OPEN_THREADS`, with the card-level line carrying the claim while the per-field
   clause stays quiet.* Commit this section **before step 2**.
2. **Measure:** ≥ **5 real recommendations** across ≥ **3 tickers**, all inputs available, real provider,
   never `AI_REC_LOCAL_ONLY`, on **:8010**. Record per run: ticker, persona, timestamp, `grounding.card`,
   the four integers. Pace with the shipped `"override": true` request field rather than idling out the
   60s process-wide cooldown (the documented user-facing mechanism, never a code change or a disabled
   check); the 50/day cap is nowhere near.
3. **Record the traced / no-match / couldn't-check split** here **and** in
   `.spire/clusters/tech/context/OPEN_THREADS.md`, **whatever it says**.
4. **Forbidden, absolutely:** a tolerance widening (B13 makes it build-breaking anyway), a scope cut to
   flatter the number, a synthesized run. **A measurement that cannot run records its unavailability as a
   finding** — the `tradeable-rec-inputs` V10 precedent.

**Do not** write a before/after byte check on `data/scan.json` — the :8000 orphan rewrites it several
times a minute and any naive check produces a **false failure**.

## V13 — the `max_risk` prompt measurement (AC-41, review)

The deterministic half is covered by B3/B5 + V2 + V3. This is the measured half, laddered against the
**recorded before-arm of 0 of 4** (`tradeable-rec-inputs` V10: 4 of 4 entry-stating after-arm trades came
back `cap_check: not_checkable`).

Record in `grounding-rate.md` or a sibling `max-risk-prompt-fix.md`: ≥5 real recs across ≥3 tickers with
per-run verdict, ticker, persona, timestamp, and the resulting `cap_check.verdict` /
`cap_check.risk_refusal`. **No run is synthesized.** With no key, record **not-run**; the same
pre-committed ladder applies.

## V14 — the review sweep

One pass, recorded as a checklist in the QA report, over the `review`-tier rows this plan does not
automate: AC-4, AC-5, AC-8, AC-14, AC-21, AC-33, AC-35, AC-41, AC-45, AC-47, AC-57, AC-63, AC-65, AC-66,
AC-67. Three carry named constraints:

- **AC-5** — review only the **card half** (no per-figure clause states a percentage or a tolerance; the
  tolerance appears exactly once, on the definition surface, taken from the response). **Its export half
  is vacuously true** — no artifact carries a clause at all (SPEC §9 item 7, GATE Z Z2). **Do not go
  looking for an export artifact.**
- **AC-65** — reviewed on a trade card that **omits** the structure and the entry trigger, beside a stop
  and an invalidation level that both carry clauses. From the definition surface alone a reader must be
  able to determine which figures are checked; no field outside that list may carry any marker, tint,
  absence treatment or adjacency readable as a coverage claim.
- **AC-63** — at 393px on a fully traced trade card, the verdict **and** the risk tile are both reachable
  in the first screen. *(The entry dialog's reason line is not on this card and does not enter the line
  budget — SPEC §4.)*

**Also read, verbatim, in this sweep:** all **three** `PREFILL_WITHHELD` literals as rendered in the
dialog (SPEC §4's prefill table is `review`-tier copy like every other literal table).

## V15 — hygiene close-out

```powershell
git status --porcelain
git diff --stat -- apps/api/tests/score_identity.rs
python -c "import io,glob;print(sum(io.open(f,'rb').read().count(bytes([0])) for f in glob.glob('.spire/clusters/tech/contracts/ai-rec-grounding/*.md')))"
npm run ci ; $LASTEXITCODE
```
**Expect:** only intended files changed; the score-identity diff **empty**; the NUL scan prints `0` (a
literal NUL makes a file binary to git and grep — it has landed three times in this repo); `npm run ci`
exits `0` modulo the 5 accepted red dashboard files.

---

## Dependency map

```
B1 ──┬─ B2 ─ B6 ─ B7 ─ B8 ─ B9 ─ B10 ─┬─ B11 ─ B12 ─ B13 ─┐
     ├─ B3 ─ B4 ──────────────────────┤                   ├─ B16 ─┐
     └─ B5 ───────────────────────────┴─ B14 ─ B15 ───────┘       │
                                                                   ├─ V1..V4, V9..V13
F1 ── F2 ─┬─ F3 ─ F4 ─┬─ F5 ─┬─ F7 ─┬─ F10 ─────────┐              │
          │           ├─ F6 ─┘      ├─ F12*         │              │
          │           ├─ F8 ────────┤               ├─ F14 ────────┘
          │           ├─ F11        ├─ F13          │
          │           └─ F15 ─ F16 ─┴─ F17 ─────────┘
          └─ F9 ──────────────────────┘  (fixtures feed F10 and F17)
* F12 additionally depends on the owner's DESIGN_SYSTEM Amendment append.
```

**Critical path (unchanged by D8):** `B1 → B2 → B6 → B7 → B8 → B9 → B10 → B11 → B12 → B13 → B16 → V3`.
The FE track never blocks on it — F2 encodes the contract, and every F-item, **including the gated prefill
and D8's third arm**, is testable against F9's payload fixtures with no backend running. The longest FE
chain is `F1 → F2 → F3 → F4 → F15 → F16 → F17 → F14`, still shorter than the backend chain.
