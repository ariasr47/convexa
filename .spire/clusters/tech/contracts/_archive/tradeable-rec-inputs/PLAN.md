# tradeable-rec-inputs — implementation plan

**Spec:** `.spire/clusters/tech/contracts/tradeable-rec-inputs/SPEC.md` (approved, locked)
**Interface:** `.spire/clusters/tech/contracts/tradeable-rec-inputs/INTERFACE_CONTRACT.md`
**Method:** `.claude/plan/PLAN_METHOD.md`
**Tracks:** backend (B1–B18) · frontend (F1–F13) · verification (V0–V11)

**Goal.** Give the AI recommendation the three inputs that make `max_risk` / `position_size` /
`exit_plan.target` / `exit_plan.stop` answerable *and checkable* — a bounded candidate contract set,
the owner's own risk numbers, and the straddle-implied move — and render every absence as a named
state instead of an em-dash.

**Architecture shape.** Two pure selectors in `libs/quant-engine` (straddle move; capped candidate
set); the move rides `AnalyticsSnapshot` → `market_state`, the candidate set never does and is
recomputed per request from `snap.contracts`; one owner record on the existing per-user settings
store (both adapters); one client-supplied positions digest that is never persisted; and one
prompt-assembly step in `services/recommendation.rs` + `services/llm.rs` where all four meet behind a
pruned `market_state` clone.

**Stack it binds.** Backend `apps/api` (crate `api-rust`, Axum/Tokio, Rust) over `libs/quant-engine`;
frontend `apps/dashboard` (`@convexa/dashboard`, React 19 + Vite + MUI) over the shared TS client
`libs/api` (`@convexa/api`).

---

## Global constraints

Binding on **both** lanes. Violating any of these is a build defect, not a style note.

1. **Never edit** `SPEC.md` or `INTERFACE_CONTRACT.md`. A contradiction between this plan and the
   tree is reported, never silently resolved (PLAN_METHOD "Plans are code").
2. **Score byte-identity is HARD.** Nothing added here may reach `generate_signals`,
   `market_state_from_gex`, the entry gate, `opportunity_tier` or `state_fingerprint`. The
   enforcement is the call graph: `market_state_from_gex` has a fixed positional argument list
   (`apps/api/src/routes/market.rs:98-115`), and `quant-engine` does not depend on `api-rust`.
3. **Closed vocabularies are authoritative on the wire.** The frontend renders every state, reason,
   basis, presence, verdict and drop reason by **closed lookup on the token** — never by inspecting a
   `null`, never by re-deriving a label from a scalar, never by array order.
4. **`0.0` never ships as an IV or a greek**; `no_two_sided_quote` never asserts that no quote
   existed; no per-quote freshness/session/age label exists anywhere in v1.
5. **STATIC everywhere.** No datum added here rides SSE, dims on a stream drop, or gains an offline
   marker.
6. **One computation, one place:** one `max_risk` parse (server-side), zero parses of
   `position_size` on either side of the wire, one cap verdict (pinned, never recomputed), one
   effective-dollar-cap derivation (server-side), one tenor-restriction function.
7. **Repo traps** (`CLAUDE.md`, all previously paid for): never a bare `nx format:write` — always
   `npx nx format:write --files <paths>`; a green `nx test` does **not** typecheck, so
   `npm run typecheck` is mandatory; judge every command by its **exit code**
   (`$LASTEXITCODE` in PowerShell, `echo $?` in bash), never by a printed summary; never write a
   literal NUL byte into a source file; free ports before any run-the-app step
   (`npm run ports:free`), and never point a verification run at `:8000` (a known orphan serves
   stale code there).
8. **Conformance spec — copied verbatim from `INTERFACE_CONTRACT.md` so both lanes inherit one
   binding shape.** Backend emits exactly this; frontend types bind exactly this.

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
        "market_state.straddle_move": "object",
        "market_state.straddle_move.state": "string",
        "market_state.straddle_move.as_of": "string|null",
        "market_state.straddle_move.session_basis": "string|null",
        "market_state.straddle_move.anchor_spot": "number|null",
        "market_state.straddle_move.anchor_basis": "string",
        "market_state.straddle_move.anchor_label": "string",
        "market_state.straddle_move.primary_expiration": "string|null",
        "market_state.straddle_move.wide_quote_threshold_pct": "number",
        "market_state.straddle_move.tenors": "array",
        "market_state.straddle_move.tenors[].expiration": "string",
        "market_state.straddle_move.tenors[].dte": "number",
        "market_state.straddle_move.tenors[].strike_used": "number",
        "market_state.straddle_move.tenors[].straddle_price": "number",
        "market_state.straddle_move.tenors[].move_dollars": "number",
        "market_state.straddle_move.tenors[].move_pct": "number",
        "market_state.straddle_move.tenors[].basis": "string",
        "market_state.straddle_move.tenors[].wide_quotes": "boolean",
        "signals.opportunity_score": "number",
        "signals.opportunity_tier": "string",
        "ai_eval.state_fingerprint": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/candidates/{ticker}",
      "path_params": { "ticker": "SPY" },
      "query": {},
      "required": {
        "ticker": "string",
        "state": "string",
        "as_of": "string|null",
        "snapshot_age_seconds": "number|null",
        "session_basis": "string|null",
        "quote_age": "string",
        "anchor_spot": "number|null",
        "anchor_basis": "string",
        "band_pct": "number",
        "budget": "string",
        "sent_to_model": "boolean",
        "caps.tenors": "number",
        "caps.rights": "number",
        "caps.strikes_per_tenor_right": "number",
        "caps.max_records": "number",
        "caps.max_bytes": "number",
        "included.contracts": "number",
        "included.expirations": "array",
        "included.expiration_count": "number",
        "omitted.total": "number",
        "omitted.expirations_omitted_by_cap": "number",
        "omitted.by_reason.outside_window": "number",
        "omitted.by_reason.outside_band": "number",
        "omitted.by_reason.no_interest": "number",
        "omitted.by_reason.expiration_cap": "number",
        "omitted.by_reason.strike_cap": "number",
        "liquidity.quoted": "number",
        "liquidity.no_two_sided_quote": "number",
        "liquidity.atm_relative_spread_band": "string",
        "liquidity.wide_quotes": "boolean",
        "liquidity.wide_quote_threshold_pct": "number",
        "contracts": "array",
        "contracts[].expiration": "string",
        "contracts[].dte": "number",
        "contracts[].strike": "number",
        "contracts[].right": "string",
        "contracts[].distance_pct": "number",
        "contracts[].quote_presence": "string",
        "contracts[].bid": "number|null",
        "contracts[].ask": "number|null",
        "contracts[].mid": "number|null",
        "contracts[].spread_pct_of_mid": "number|null",
        "contracts[].open_interest": "number",
        "contracts[].volume": "number",
        "contracts[].iv_state": "string",
        "contracts[].iv": "number|null",
        "contracts[].greeks.delta": "number|null",
        "contracts[].greeks.gamma": "number|null",
        "contracts[].greeks.theta": "number|null",
        "contracts[].greeks.vega": "number|null"
      }
    },
    {
      "method": "GET",
      "path": "/api/recommendation/export/{ticker}",
      "path_params": { "ticker": "SPY" },
      "query": {},
      "required": {
        "ticker": "string",
        "context.market_state.straddle_move": "object",
        "context.market_state.straddle_move.state": "string",
        "context.candidates.state": "string",
        "context.candidates.budget": "string",
        "context.candidates.sent_to_model": "boolean",
        "context.candidates.included.contracts": "number",
        "context.candidates.included.expiration_count": "number",
        "context.candidates.omitted.total": "number",
        "context.candidates.liquidity.atm_relative_spread_band": "string",
        "context.risk_inputs.state": "string",
        "context.risk_inputs.account_size": "number|null",
        "context.risk_inputs.effective_dollar_cap.state": "string",
        "context.open_positions.source": "string",
        "context.open_positions.state": "string",
        "egress_note": "string",
        "egress_categories": "array",
        "egress_categories[].key": "string",
        "egress_categories[].sent": "boolean"
      }
    },
    {
      "method": "GET",
      "path": "/api/auth/settings",
      "auth": true,
      "path_params": {},
      "query": {},
      "required": {
        "theme": "string",
        "risk_inputs": "object",
        "risk_inputs.state": "string",
        "risk_inputs.account_size": "number|null",
        "risk_inputs.per_trade_cap": "object|null",
        "risk_inputs.effective_dollar_cap": "object",
        "risk_inputs.effective_dollar_cap.state": "string",
        "risk_inputs.effective_dollar_cap.value": "number|null",
        "risk_inputs.effective_dollar_cap.not_derivable_reason": "string|null",
        "risk_inputs.effective_dollar_cap.derived_from": "object",
        "risk_inputs.storage_available": "boolean",
        "risk_inputs.updated_at": "number|null"
      }
    }
  ]
}
```

### Constants this plan fixes (the spec leaves the numbers to the build)

Every one of these rides the payload so it cannot erode silently, and every one is a single `const`
in exactly one module.

| Constant | Value | Where | Why this number |
|---|---|---|---|
| `BAND_PCT` | `15.0` | `quant-engine/src/candidates.rs` | SPEC §2.2 / INTERFACE `band_pct`. Payload-stated constant, never a query knob |
| `MOVE_DTE_FLOOR` | `7.0` | `quant-engine/src/straddle_move.rs` | Matches the shipped ATM-IV anchor rule ("nearest tenor ≥ 7 DTE", PROJECT_CONTEXT §3) so the move's tenor and the ATM-IV tenor agree |
| `MOVE_MAX_TENORS` | `3` | same | SPEC §2.1 "cap 3" |
| `WIDE_QUOTE_THRESHOLD_PCT` | `15.0` | `quant-engine/src/candidates.rs`, re-exported to the move | One threshold for both surfaces so `wide_quotes == (band == wide)` can never disagree |
| `SPREAD_TIGHT_PCT` | `5.0` | same | `tight` ≤ 5 · `moderate` ≤ 15 · `wide` > 15 · `unknown` when no quoted ATM pair |
| `CandidateBudget::Handoff.max_bytes` | `24_000` | same | A fully-populated record serializes to ~340–380 bytes; 64 × 380 ≈ 24.3k |
| `CandidateBudget::Prompt.max_bytes` | `8_000` | same | 20 × 380 ≈ 7.6k. Revisable **only** by the §7.3 pre-committed cut ladder (V7) |

### Reconciliations an implementer must not re-litigate

- **"0 is a legal entry" (SPEC §2.4) vs "a zero entry is refused" (AC-18/AC-36).** AC-36 states the
  reconciliation itself: the **type** has no zero-means-unset inhabitant (`Option<f64>`, never a
  sentinel), and a zero **entry** is refused by validation on both sides. Implement both.
- **Straddle placement (SPEC §4).** "A fifth sub-card inside `market-context` **if the backend nests
  it there**, otherwise a compact widget immediately after `iv-rank`." The contract nests it at
  `market_state.straddle_move`, **not** inside `market_context` — so the ruling resolves to the
  compact widget after `IvRank` (`TickerDashboard.tsx:604`). No twelfth bento widget question
  arises: it lands in the existing quiet "Supporting context" zone.
- **Settings panel order (SPEC §4 flow 1).** "Directly under Preferences, above AI key." The shipped
  order is Account → AI key → Brokerage → Preferences (`SettingsPage.tsx:167/223/228/233`), which
  cannot satisfy both clauses. F5 satisfies both by moving the **Preferences** panel above the AI-key
  panel and inserting `Risk inputs` between them: Account → Preferences → **Risk inputs** → AI key →
  Brokerage. The ruling's stated reason (a trader input must not be grouped with credentials) is
  what makes this the correct reading. No AC pins the old order, and
  `features/auth/auth.risk.spec.tsx:35` explicitly disclaims asserting Settings page structure.
- **AC-79 "the same default it shows today".** Today `prefill.ts:33 parseQty` reads a quantity out of
  `position_size` and seeds the dialog (`tradeEntry/TradeEntryDialogView.tsx:207`). SPEC §1
  out-of-scope ("a numeric size pre-fill … never populated from the model"), §2.5 ("no parse of
  `position_size` anywhere") and §7 (a source scan proving no parse is reachable) are unambiguous:
  the parse is **deleted**, and "today's default" is the dialog's own default of `1`.

### Cross-lane seams

The two lanes are independently executable from the first commit. Nothing in track F waits on track
B **to build**; three joint checks in track V wait on both.

| Seam | Frontend builds against | Backend task that must land before the joint check |
|---|---|---|
| `market_state.straddle_move` | `libs/api` types (F1) + fixtures (F2) | B4 + B5 → V8 |
| `GET /api/candidates/{ticker}` | F1 `getCandidates` + F2 mock | B6 → V8 |
| `risk_inputs` on settings | F1 types + F2 mock `settingsWrite` | B8 + B9 → V8 |
| `sent.*` / `cap_check.*` / `field_reasons.*` / `cited_contract.*` / `strategy.right` | F2 mock rec responses (fixtures in F4) | B10–B16 → V9/V10 |
| `context.candidates` / `risk_inputs` / `open_positions` / `egress_categories` | F2 mock export | B17 → V8 |
| Request body `open_positions` digest | F10 sends it; the mock records it | B16 consumes it → V9 |

`libs/api` (`@convexa/api`, `scope:shared`) is written **once, by the frontend lane, in F1**. The
backend lane never edits it; if the backend finds the contract under-specified, that is a GATE Z
question, not a unilateral type edit.

---

## Track B — backend

Crate/module conventions: new `quant-engine` modules are pure (no I/O, no `AppState`, no vendor
types); new `api-rust` modules under `services/` are leaves that `routes/` calls. Run
`cargo test -p quant-engine` (fast) during B1–B3 and `npx nx test api` from B4 on.

### B1 — `quant-engine`: shared window/meta types + the straddle-implied move selector

**Files:** `libs/quant-engine/src/types.rs` (append) · `libs/quant-engine/src/straddle_move.rs`
(new) · `libs/quant-engine/src/lib.rs` (register + re-export).

**Test first.** Add to the bottom of `straddle_move.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{ContractType, Greeks};
    use chrono::TimeZone;

    fn q(strike: f64, side: ContractType, exp: &str, bid: Option<f64>, ask: Option<f64>, iv: f64) -> Contract {
        Contract {
            strike_price: strike,
            contract_type: side,
            open_interest: 100.0,
            expiration_date: exp.into(),
            implied_volatility: iv,
            greeks: Some(Greeks { gamma: Some(0.01), delta: Some(0.5), theta: None, vega: None }),
            volume: Some(10.0),
            bid,
            ask,
        }
    }
    fn meta() -> SnapshotMeta {
        SnapshotMeta { as_of_iso: Some("2026-08-12T20:05:00Z".into()), session_basis: Some("after_close".into()) }
    }
    fn as_of() -> DateTime<Utc> { Utc.with_ymd_and_hms(2026, 8, 12, 20, 5, 0).unwrap() }

    #[test]
    fn market_basis_move_is_the_atm_straddle_mid() {
        let chain = vec![
            q(100.0, ContractType::Call, "2026-09-18", Some(3.0), Some(3.4), 0.30),
            q(100.0, ContractType::Put, "2026-09-18", Some(2.6), Some(3.0), 0.30),
        ];
        let mv = compute_straddle_move(&chain, 100.0, as_of(), DteWindow::default(), &meta());
        assert_eq!(mv.state, StraddleMoveState::Ok);
        let t = &mv.tenors[0];
        assert_eq!(t.basis, MoveBasis::AtmStraddleMid);
        assert!((t.straddle_price - 6.0).abs() < 1e-9); // 3.2 + 2.8
        assert!((t.move_dollars - 6.0).abs() < 1e-9);
        assert!((t.move_pct - 6.0).abs() < 1e-9);
        assert_eq!(mv.primary_expiration.as_deref(), Some("2026-09-18"));
        assert_eq!(mv.anchor_basis, AnchorBasis::GexSpot);
    }

    #[test]
    fn a_missing_leg_changes_the_basis_value_and_never_silently_substitutes() {
        let chain = vec![
            q(100.0, ContractType::Call, "2026-09-18", Some(3.0), None, 0.30),
            q(100.0, ContractType::Put, "2026-09-18", Some(2.6), Some(3.0), 0.30),
        ];
        let mv = compute_straddle_move(&chain, 100.0, as_of(), DteWindow::default(), &meta());
        assert_eq!(mv.tenors[0].basis, MoveBasis::IvDerivedEstimate);
        assert!(mv.tenors[0].quote_spread_pct_of_mid.is_none());
        assert!(!mv.tenors[0].wide_quotes);
    }

    #[test]
    fn no_quote_and_no_iv_yields_the_no_quote_state_with_an_empty_tenor_list() {
        let chain = vec![
            q(100.0, ContractType::Call, "2026-09-18", None, None, 0.0),
            q(100.0, ContractType::Put, "2026-09-18", None, None, 0.0),
        ];
        let mv = compute_straddle_move(&chain, 100.0, as_of(), DteWindow::default(), &meta());
        assert_eq!(mv.state, StraddleMoveState::NoQuote);
        assert!(mv.tenors.is_empty());
        assert_eq!(mv.session_basis.as_deref(), Some("after_close"));
    }

    #[test]
    fn no_expiration_in_window_is_its_own_state() {
        let chain = vec![
            q(100.0, ContractType::Call, "2026-09-18", Some(3.0), Some(3.4), 0.30),
            q(100.0, ContractType::Put, "2026-09-18", Some(2.6), Some(3.0), 0.30),
        ];
        let w = DteWindow { min: Some(0.0), max: Some(3.0) };
        let mv = compute_straddle_move(&chain, 100.0, as_of(), w, &meta());
        assert_eq!(mv.state, StraddleMoveState::NoExpirationInWindow);
        assert!(mv.tenors.is_empty());
    }

    #[test]
    fn bad_anchor_yields_not_computed_and_the_object_is_never_null() {
        let mv = compute_straddle_move(&[], 0.0, as_of(), DteWindow::default(), &meta());
        assert_eq!(mv.state, StraddleMoveState::NotComputed);
        assert_eq!(mv.wide_quote_threshold_pct, WIDE_QUOTE_THRESHOLD_PCT);
    }

    #[test]
    fn at_most_three_tenors_ascending_and_sparse_ones_are_omitted_never_null() {
        let mut chain = Vec::new();
        for exp in ["2026-08-21", "2026-09-18", "2026-10-16", "2026-11-20"] {
            chain.push(q(100.0, ContractType::Call, exp, Some(3.0), Some(3.4), 0.30));
            chain.push(q(100.0, ContractType::Put, exp, Some(2.6), Some(3.0), 0.30));
        }
        chain.push(q(100.0, ContractType::Call, "2026-12-18", None, None, 0.0)); // sparse: omitted
        let mv = compute_straddle_move(&chain, 100.0, as_of(), DteWindow::default(), &meta());
        assert_eq!(mv.tenors.len(), MOVE_MAX_TENORS);
        assert!(mv.tenors.windows(2).all(|w| w[0].dte < w[1].dte));
        assert!(!mv.tenors.iter().any(|t| t.expiration == "2026-12-18"));
    }

    #[test]
    fn a_wide_straddle_carries_the_marker_and_the_threshold_applied() {
        let chain = vec![
            q(100.0, ContractType::Call, "2026-09-18", Some(2.0), Some(4.4), 0.30),
            q(100.0, ContractType::Put, "2026-09-18", Some(2.0), Some(3.6), 0.30),
        ];
        let mv = compute_straddle_move(&chain, 100.0, as_of(), DteWindow::default(), &meta());
        assert!(mv.tenors[0].wide_quotes);
        assert!(mv.tenors[0].quote_spread_pct_of_mid.unwrap() > WIDE_QUOTE_THRESHOLD_PCT);
        assert_eq!(mv.wide_quote_threshold_pct, WIDE_QUOTE_THRESHOLD_PCT);
    }
}
```

Run `cargo test -p quant-engine straddle` — expect a compile error (module does not exist). That is
the red state.

**Implement.** In `types.rs`, append the two shapes both new selectors share:

```rust
/// Active DTE window for the rec-input selectors. `None` on a bound = unbounded.
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct DteWindow {
    pub min: Option<f64>,
    pub max: Option<f64>,
}

impl DteWindow {
    pub fn contains(&self, dte: f64) -> bool {
        self.min.map(|m| dte >= m).unwrap_or(true) && self.max.map(|m| dte <= m).unwrap_or(true)
    }
}

/// Set-level snapshot facts the pure selectors carry through but never derive.
/// `session_basis` is `MarketPhase::classify(SNAPSHOT as_of)` — classified by the caller, of the
/// SNAPSHOT, never of `now`, and never re-derived per contract.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct SnapshotMeta {
    pub as_of_iso: Option<String>,
    pub session_basis: Option<String>,
}
```

`straddle_move.rs` — the whole module:

```rust
//! Straddle-implied move (SPEC §2.1). Pure, total, best-effort: EVERY branch returns a
//! `StraddleMove` object carrying a closed `state`. It is never null and never an error.
use crate::greeks::time_to_expiry_years;
use crate::types::{Contract, ContractType, DteWindow, SnapshotMeta};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Nearest tenor at or above this DTE is the default render (matches the shipped ATM-IV anchor).
pub const MOVE_DTE_FLOOR: f64 = 7.0;
pub const MOVE_MAX_TENORS: usize = 3;
/// Shared with the candidate set so `wide_quotes` can never disagree across the two surfaces.
pub const WIDE_QUOTE_THRESHOLD_PCT: f64 = 15.0;
/// Brenner–Subrahmanyam ATM straddle ≈ 0.7979 · S · σ · √T (the IV-derived basis only).
const ATM_STRADDLE_IV_COEFF: f64 = 0.797_884_560_802_865;
/// How many strikes either side of the anchor may be tried before the basis falls to IV.
const ADJACENT_STRIKE_TRIES: usize = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StraddleMoveState { Ok, NoQuote, NotComputed, NoExpirationInWindow }

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MoveBasis { AtmStraddleMid, IvDerivedEstimate }

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AnchorBasis { GexSpot }

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StraddleTenor {
    pub expiration: String,
    pub dte: i64,
    pub strike_used: f64,
    pub strike_distance_pct: f64,
    pub straddle_price: f64,
    pub move_dollars: f64,
    /// Percent OF `anchor_spot` — never of the live display price.
    pub move_pct: f64,
    pub basis: MoveBasis,
    pub quote_spread_pct_of_mid: Option<f64>,
    pub wide_quotes: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StraddleMove {
    pub state: StraddleMoveState,
    pub as_of: Option<String>,
    pub session_basis: Option<String>,
    pub anchor_spot: Option<f64>,
    pub anchor_basis: AnchorBasis,
    /// The words the basis line renders for the anchor. Rendered VERBATIM by the client.
    pub anchor_label: String,
    pub primary_expiration: Option<String>,
    pub wide_quote_threshold_pct: f64,
    /// ≤ 3, ascending by DTE. Sparse tenors are omitted, never emitted null.
    pub tenors: Vec<StraddleTenor>,
}

pub const ANCHOR_LABEL: &str = "levels-anchor";

impl StraddleMove {
    fn empty(state: StraddleMoveState, anchor_spot: Option<f64>, meta: &SnapshotMeta) -> Self {
        Self {
            state,
            as_of: meta.as_of_iso.clone(),
            session_basis: meta.session_basis.clone(),
            anchor_spot,
            anchor_basis: AnchorBasis::GexSpot,
            anchor_label: ANCHOR_LABEL.into(),
            primary_expiration: None,
            wide_quote_threshold_pct: WIDE_QUOTE_THRESHOLD_PCT,
            tenors: Vec::new(),
        }
    }
}

/// THE tenor-selection rule. Used by the move AND by the candidate set, so the primary tenor is
/// always present in the candidate block and the intersection invariant holds by construction.
/// Never re-implement "nearest in window" locally.
pub fn select_tenors(mut expirations: Vec<(String, i64)>, window: DteWindow, cap: usize) -> Vec<(String, i64)> {
    expirations.retain(|(_, dte)| *dte > 0 && window.contains(*dte as f64));
    expirations.sort_by_key(|(_, dte)| *dte);
    expirations.dedup_by(|a, b| a.0 == b.0);
    let at_or_above_floor: Vec<(String, i64)> =
        expirations.iter().filter(|(_, d)| *d as f64 >= MOVE_DTE_FLOOR).cloned().collect();
    let ordered = if at_or_above_floor.is_empty() { expirations } else { at_or_above_floor };
    ordered.into_iter().take(cap).collect()
}

/// Compute the move. `anchor_spot` is `gex_spot` (the levels anchor), NEVER the live display price.
pub fn compute_straddle_move(
    contracts: &[Contract],
    anchor_spot: f64,
    as_of: DateTime<Utc>,
    window: DteWindow,
    meta: &SnapshotMeta,
) -> StraddleMove {
    if !(anchor_spot > 0.0) || !anchor_spot.is_finite() || contracts.is_empty() {
        return StraddleMove::empty(StraddleMoveState::NotComputed, None, meta);
    }
    let anchor = Some(anchor_spot);

    // Distinct expirations with their DTE (parsed once).
    let mut by_exp: BTreeMap<String, i64> = BTreeMap::new();
    for c in contracts {
        let key = c.expiration_key().to_string();
        if by_exp.contains_key(&key) { continue; }
        let Ok(d) = NaiveDate::parse_from_str(&key, "%Y-%m-%d") else { continue };
        by_exp.insert(key, (time_to_expiry_years(d, as_of) * 365.0).round() as i64);
    }
    let tenors = select_tenors(by_exp.into_iter().collect(), window, MOVE_MAX_TENORS);
    if tenors.is_empty() {
        return StraddleMove::empty(StraddleMoveState::NoExpirationInWindow, anchor, meta);
    }

    let mut out: Vec<StraddleTenor> = Vec::with_capacity(tenors.len());
    for (exp, dte) in &tenors {
        if let Some(t) = tenor_move(contracts, anchor_spot, exp, *dte) {
            out.push(t);
        }
    }
    if out.is_empty() {
        return StraddleMove::empty(StraddleMoveState::NoQuote, anchor, meta);
    }
    let mut mv = StraddleMove::empty(StraddleMoveState::Ok, anchor, meta);
    mv.primary_expiration = Some(out[0].expiration.clone());
    mv.tenors = out;
    mv
}

fn tenor_move(contracts: &[Contract], anchor: f64, exp: &str, dte: i64) -> Option<StraddleTenor> {
    // Candidate strikes with BOTH legs present, nearest to the anchor first.
    let mut strikes: Vec<f64> = contracts
        .iter()
        .filter(|c| c.expiration_key() == exp)
        .map(|c| c.strike_price)
        .collect();
    strikes.sort_by(|a, b| {
        (a - anchor).abs().partial_cmp(&(b - anchor).abs()).unwrap_or(std::cmp::Ordering::Equal)
    });
    strikes.dedup();

    let leg = |k: f64, side: ContractType| -> Option<&Contract> {
        contracts.iter().find(|c| {
            c.expiration_key() == exp && (c.strike_price - k).abs() < 1e-6 && c.contract_type == side
        })
    };
    let mid = |c: &Contract| -> Option<(f64, f64)> {
        match (c.bid, c.ask) {
            (Some(b), Some(a)) if a >= b => Some(((a + b) / 2.0, a - b)),
            _ => None,
        }
    };

    // Market basis: the first strike (nearest, then adjacent) whose BOTH legs carry a two-sided
    // quote. Adjacent substitution stays INSIDE this basis; the strike used and its distance ride
    // the payload, which is what makes the substitution honest.
    for k in strikes.iter().take(ADJACENT_STRIKE_TRIES) {
        let (Some(c), Some(p)) = (leg(*k, ContractType::Call), leg(*k, ContractType::Put)) else { continue };
        let (Some((cm, cs)), Some((pm, ps))) = (mid(c), mid(p)) else { continue };
        let price = cm + pm;
        if !(price > 0.0) { continue; }
        let spread_pct = (cs + ps) / price * 100.0;
        return Some(StraddleTenor {
            expiration: exp.to_string(),
            dte,
            strike_used: *k,
            strike_distance_pct: round4((k - anchor) / anchor * 100.0),
            straddle_price: round4(price),
            move_dollars: round4(price),
            move_pct: round4(price / anchor * 100.0),
            basis: MoveBasis::AtmStraddleMid,
            quote_spread_pct_of_mid: Some(round4(spread_pct)),
            wide_quotes: spread_pct > WIDE_QUOTE_THRESHOLD_PCT,
        });
    }

    // IV-derived estimate — a DIFFERENT basis value, never a silent substitute. IV == 0.0 is the
    // unpriced sentinel (rest.rs:813-817) and can never feed this.
    let k = *strikes.first()?;
    let iv = contracts
        .iter()
        .filter(|c| c.expiration_key() == exp && (c.strike_price - k).abs() < 1e-6)
        .map(|c| c.implied_volatility)
        .find(|iv| *iv > 0.0 && iv.is_finite())?;
    let t_years = (dte as f64 / 365.0).max(1.0 / 365.0);
    let price = ATM_STRADDLE_IV_COEFF * anchor * iv * t_years.sqrt();
    if !(price > 0.0) { return None; }
    Some(StraddleTenor {
        expiration: exp.to_string(),
        dte,
        strike_used: k,
        strike_distance_pct: round4((k - anchor) / anchor * 100.0),
        straddle_price: round4(price),
        move_dollars: round4(price),
        move_pct: round4(price / anchor * 100.0),
        basis: MoveBasis::IvDerivedEstimate,
        quote_spread_pct_of_mid: None,
        wide_quotes: false,
    })
}

#[inline]
fn round4(x: f64) -> f64 { (x * 10_000.0).round() / 10_000.0 }
```

`lib.rs`: add `pub mod straddle_move;` beside `pub mod signals;` and

```rust
pub use straddle_move::{
    compute_straddle_move, select_tenors, AnchorBasis, MoveBasis, StraddleMove, StraddleMoveState,
    StraddleTenor, ANCHOR_LABEL, MOVE_DTE_FLOOR, MOVE_MAX_TENORS, WIDE_QUOTE_THRESHOLD_PCT,
};
```
and add `DteWindow, SnapshotMeta` to the existing `pub use types::{...}` list.

**Verify.** `cargo test -p quant-engine straddle` → 7 tests, `test result: ok`, `$LASTEXITCODE` 0.

**Commit.** `feat(engine): straddle-implied move selector (closed state, basis enum, tenor cap)`

**Reviewer probe.** That `NoQuote` and `NoExpirationInWindow` cannot be produced by the same input
class; that `iv == 0.0` can never reach the IV basis; that `move_pct` divides by `anchor_spot` and
nothing else.

---

### B2 — `quant-engine`: the capped candidate set (the cap is a type, not a convention)

**Files:** `libs/quant-engine/src/candidates.rs` (new) · `lib.rs`.

**Test first** (same file, `mod tests`) — name them exactly:

- `record_and_byte_ceilings_bind_and_whichever_binds_first_wins`
- `raising_a_ceiling_in_a_test_build_makes_the_guard_fail` (poison: rebuild caps with
  `strikes_per_tenor_right: 99` and assert the built set still never exceeds `max_records`)
- `included_plus_dropped_equals_rows_scanned` (over a 900-row synthetic chain)
- `drop_reasons_are_evaluated_in_fixed_order_and_each_row_counted_once` (a row that is outside the
  window **and** outside the band **and** has no interest counts **only** as `outside_window`)
- `a_zero_bid_row_is_included_as_no_two_sided_quote_and_never_claims_no_quote_existed`
- `a_greeks_absent_row_carries_unpriced_and_ships_no_zero_iv_or_greek`
- `zero_oi_and_zero_volume_rows_are_dropped_as_no_interest_before_any_cap`
- `ranking_is_nearest_to_anchor_not_liquidity`
- `the_primary_move_tenor_is_always_present_in_the_candidate_block`

**Implement** — the load-bearing shapes and the one constructor:

```rust
//! Bounded, ranked, hard-capped candidate contract set (SPEC §2.2). Pure: takes `&[Contract]`,
//! has NO access to any provider port, and issues no request on any path.
use crate::straddle_move::{select_tenors, WIDE_QUOTE_THRESHOLD_PCT};
use crate::types::{Contract, ContractType, DteWindow, SnapshotMeta};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

/// Payload-stated constant, never a query knob — deliberately, so it cannot erode.
pub const BAND_PCT: f64 = 15.0;
pub const SPREAD_TIGHT_PCT: f64 = 5.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CandidateBudget { Handoff, Prompt }

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct CandidateCaps {
    pub tenors: usize,
    pub rights: usize,
    pub strikes_per_tenor_right: usize,
    pub max_records: usize,
    pub max_bytes: usize,
}

impl CandidateBudget {
    pub const fn caps(self) -> CandidateCaps {
        match self {
            Self::Handoff => CandidateCaps { tenors: 4, rights: 2, strikes_per_tenor_right: 8, max_records: 64, max_bytes: 24_000 },
            Self::Prompt => CandidateCaps { tenors: 2, rights: 2, strikes_per_tenor_right: 5, max_records: 20, max_bytes: 8_000 },
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CandidateSetState { Ok, NoneInBand, Unavailable }

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QuotePresence { Quoted, NoTwoSidedQuote }

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IvState { Priced, Unpriced }

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SpreadBand { Tight, Moderate, Wide, Unknown }

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CandidateGreeks { pub delta: Option<f64>, pub gamma: Option<f64>, pub theta: Option<f64>, pub vega: Option<f64> }

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CandidateContract {
    pub expiration: String,
    pub dte: i64,
    pub strike: f64,
    pub right: ContractType,
    pub distance_pct: f64,
    pub quote_presence: QuotePresence,
    pub bid: Option<f64>,
    pub ask: Option<f64>,
    pub mid: Option<f64>,
    pub spread_abs: Option<f64>,
    pub spread_pct_of_mid: Option<f64>,
    pub open_interest: f64,
    pub volume: f64,
    pub iv_state: IvState,
    pub iv: Option<f64>,
    pub greeks: CandidateGreeks,
}

/// Five closed reasons, FIXED evaluation order, each contract counted EXACTLY once.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct DropLedger {
    pub outside_window: u32,
    pub outside_band: u32,
    pub no_interest: u32,
    pub expiration_cap: u32,
    pub strike_cap: u32,
}
impl DropLedger {
    pub fn total(&self) -> u32 {
        self.outside_window + self.outside_band + self.no_interest + self.expiration_cap + self.strike_cap
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CandidateLiquidity {
    pub quoted: u32,
    pub no_two_sided_quote: u32,
    pub atm_relative_spread_band: SpreadBand,
    pub wide_quotes: bool,
    pub wide_quote_threshold_pct: f64,
}

/// The ONLY constructor is [`CandidateSet::build`], and it truncates. An implementer who loops
/// without a bound cannot compile a violation: the fields are private.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct CandidateSet {
    state: CandidateSetState,
    as_of: Option<String>,
    session_basis: Option<String>,
    /// One member in v1. Per-contract age is FORBIDDEN on this wire.
    quote_age: &'static str,
    anchor_spot: Option<f64>,
    anchor_basis: &'static str,
    band_pct: f64,
    budget: CandidateBudget,
    sent_to_model: bool,
    caps: CandidateCaps,
    included: IncludedBlock,
    omitted: OmittedBlock,
    liquidity: CandidateLiquidity,
    contracts: Vec<CandidateContract>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct IncludedBlock { pub contracts: u32, pub expirations: Vec<String>, pub expiration_count: u32 }

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct OmittedBlock { pub total: u32, pub expirations_omitted_by_cap: u32, pub by_reason: DropLedger }

impl CandidateSet {
    pub fn state(&self) -> CandidateSetState { self.state }
    pub fn contracts(&self) -> &[CandidateContract] { &self.contracts }
    pub fn included_expirations(&self) -> &[String] { &self.included.expirations }
    pub fn budget(&self) -> CandidateBudget { self.budget }
    pub fn has_quoted_contract(&self) -> bool {
        self.contracts.iter().any(|c| c.quote_presence == QuotePresence::Quoted)
    }

    /// A stated failure — never an error, never a null.
    pub fn unavailable(budget: CandidateBudget, sent_to_model: bool, meta: &SnapshotMeta, anchor: Option<f64>) -> Self { /* … empty blocks, state = Unavailable … */ }

    /// Build the set. Total; truncates by the documented ladder; asserts its own drop-sum invariant.
    pub fn build(
        contracts: &[Contract],
        anchor_spot: f64,
        as_of: DateTime<Utc>,
        window: DteWindow,
        budget: CandidateBudget,
        sent_to_model: bool,
        meta: &SnapshotMeta,
    ) -> Self { /* algorithm below */ }
}
```

`build` algorithm, in this exact order (the order **is** the drop ledger's contract):

1. `rows_scanned = contracts.len()`. Bad anchor (`!(anchor_spot > 0.0)`) ⇒
   `CandidateSet::unavailable(...)`.
2. **Per row, first reason that applies wins:** DTE ≤ 0 or outside `window` ⇒ `outside_window`;
   `|strike − anchor| / anchor × 100 > BAND_PCT` ⇒ `outside_band`; `open_interest == 0.0 && volume
   unwrap_or(0.0) == 0.0` ⇒ `no_interest`. Otherwise keep.
3. `select_tenors(kept distinct expirations, window, caps.tenors)` — **the same function the move
   uses**. Kept rows on a non-selected expiration ⇒ `expiration_cap`;
   `expirations_omitted_by_cap = distinct_kept − selected.len()`.
4. Per `(expiration, right)` group: sort by `|strike − anchor|` ascending (ties → lower strike
   first), keep `caps.strikes_per_tenor_right`, rest ⇒ `strike_cap`.
5. **Record ceiling:** while `included > caps.max_records`, drop the farthest strike from the largest
   group ⇒ `strike_cap`.
6. **Byte ceiling:** `while serde_json::to_vec(&contracts).len() > caps.max_bytes` and some group has
   > 1 strike, drop the farthest strike from the largest group ⇒ `strike_cap`. (Same ladder as 5 —
   "strikes per (tenor, right) first", SPEC §5.)
7. `debug_assert_eq!(included as u32 + ledger.total(), rows_scanned as u32)` **and** the same as a
   hard assertion inside the test.
8. Per-contract mapping: `quote_presence = Quoted` iff both `bid` and `ask` are `Some` and
   `ask >= bid`, else `NoTwoSidedQuote` with `bid/ask/mid/spread_* = None` — **the row is still
   included**. `iv_state = Unpriced` when `implied_volatility <= 0.0` **or** `greeks.gamma.is_none()`,
   and then `iv: None` and every greek `None`; `0.0` never ships.
9. Liquidity: counts over included rows; `atm_relative_spread_band` from the nearest-to-anchor
   quoted row in the primary tenor (`≤ SPREAD_TIGHT_PCT` ⇒ `Tight`, `≤ WIDE_QUOTE_THRESHOLD_PCT` ⇒
   `Moderate`, else `Wide`; no quoted row ⇒ `Unknown`); `wide_quotes = band == Wide`.
10. `state = if included == 0 { NoneInBand } else { Ok }`.

`lib.rs`: `pub mod candidates;` + re-export every public item above.

**Verify.** `cargo test -p quant-engine candidates` → 9 tests ok, exit 0.

**Commit.** `feat(engine): capped candidate-set selector with a fixed-order drop ledger`

**Reviewer probe.** That step 2's order is literal and each row `continue`s after being counted (a
row must not be able to land in two buckets); that the byte ladder cannot loop forever on a
single-strike set; that `no_interest` precedes both caps.

---

### B3 — `quant-engine`: the one tenor-restriction function (prompt-block consistency)

**Files:** `libs/quant-engine/src/candidates.rs` (append) · `lib.rs`.

**Test first:** `restricting_a_three_tenor_move_to_two_candidate_tenors_yields_exactly_two`, and the
poison arm `widening_the_restriction_makes_the_intersection_assertion_fail` — build the assertion
helper `assert_tenor_subset(move, set)` used by B15's test and prove it returns `Err` when a move
tenor is absent from the set.

**Implement.**

```rust
/// THE restriction. Every assembly point calls this — never a local filter (SPEC §2.2).
/// Invariant enforced: `tenors(move) ⊆ tenors(candidates)` in any artifact carrying both blocks.
pub fn restrict_move_to_tenors(mv: &StraddleMove, allowed: &[String]) -> StraddleMove {
    let mut out = mv.clone();
    out.tenors.retain(|t| allowed.iter().any(|e| e == &t.expiration));
    out.primary_expiration = out.tenors.first().map(|t| t.expiration.clone());
    if out.tenors.is_empty() && out.state == StraddleMoveState::Ok {
        // Unreachable while the candidate set is non-empty (both sides use `select_tenors`), so this
        // only fires on an empty/unavailable set. Never present a move for an expiration whose
        // contracts were not sent.
        out.state = StraddleMoveState::NotComputed;
    }
    out
}

/// Assertion helper shared by the guard tests (`Err(expiration)` names the first violation).
pub fn assert_tenor_subset(mv: &StraddleMove, allowed: &[String]) -> Result<(), String> {
    match mv.tenors.iter().find(|t| !allowed.iter().any(|e| e == &t.expiration)) {
        Some(t) => Err(t.expiration.clone()),
        None => Ok(()),
    }
}
```

**Verify.** `cargo test -p quant-engine restrict` → 2 tests ok, exit 0.
**Commit.** `feat(engine): shared move-to-candidate tenor restriction + subset guard`
**Reviewer probe.** That `primary_expiration` is re-derived from the surviving list rather than
filtered in place (a dropped primary must not leave a dangling name).

---

### B4 — snapshot member + compute wiring

**Files:** `apps/api/src/state.rs` · `apps/api/src/services/analytics.rs`.

**Test first.** In `analytics.rs`'s existing `mod hermetic_tests`, add
`fixture_path_b_attaches_a_straddle_move_object_with_a_state`: assert `snap.straddle_move.is_some()`
and that its `state` is one of the four members (the fixture chain is thin — the assertion is on
totality, not on `Ok`).

**Implement.** `state.rs`, in `AnalyticsSnapshot` beside `vol_normalized_gex`:

```rust
    /// Straddle-implied move (additive, post-score, never a scoring input). Always an object with a
    /// closed `state` when present; `None` only for snapshots written before this feature.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub straddle_move: Option<quant_engine::StraddleMove>,
```

`analytics.rs`, in `compute_analytics_from_vendor` after `vol_normalized_gex` is computed:

```rust
    let straddle_move = Some(quant_engine::compute_straddle_move(
        &market.contracts,
        market.synchronized_spot,
        as_of,
        quant_engine::DteWindow { min: params.min_dte, max: params.max_dte },
        &quant_engine::SnapshotMeta {
            as_of_iso: Some(as_of.to_rfc3339()),
            // The SNAPSHOT's phase, not `now` (INTERFACE rule 5).
            session_basis: Some(market.market_phase.as_str().to_string()),
        },
    ));
```
and add `straddle_move,` to the returned `AnalyticsSnapshot`. Add `straddle_move: None,` to the two
struct literals in `state.rs`'s `mod tests::empty_snap` and anywhere else `AnalyticsSnapshot { .. }`
is built (`cargo check` names them all).

**Verify.** `npx nx test api` → previously-green count + 1, exit 0.
**Commit.** `feat(api): attach the straddle-implied move to the analytics snapshot`
**Reviewer probe.** That the `SnapshotMeta.session_basis` string comes from
`snap.market_phase` (classified from the snapshot) and never from `MarketPhase::classify(Utc::now())`
or from `routes/stream.rs:61-80`'s differently-membered `market_session()`.

---

### B5 — bundle emission + score byte-identity + the poison test

**Files:** `apps/api/src/routes/market.rs` · `apps/api/tests/score_identity.rs` (new).

**Test first — and run it BEFORE the emission edit.** `score_identity.rs` computes a fixture
snapshot through `compute_analytics_from_vendor` on **both** branches and pins the score/tier/
fingerprint:

```rust
//! AC-83/AC-84 — score/tier/state_fingerprint byte-identity across this feature, on BOTH bundle
//! branches, plus the poison arm that proves the pin can bite.
use api_rust::services::analytics::{compute_from_port, AnalyticsComputeParams};
use api_rust::services::market_data::{load_fixture_dir, MarketDataPort};
use quant_engine::{evaluate_gate, market_state_from_gex, generate_signals, DEFAULT_GATE_SCORE};

// Captured on the unchanged tree at V0 by running this test with `--nocapture` and reading the
// printed triple. Do NOT "update" these to make a change pass — a diff here IS the regression.
const PINNED_SCORE: i32 = /* V0 */ 0;
const PINNED_TIER: &str = /* V0 */ "";
const PINNED_FINGERPRINT: &str = /* V0 */ "";

#[tokio::test]
async fn score_tier_and_fingerprint_are_byte_identical_on_both_bundle_branches() { /* dark_pool true and false */ }

#[test]
fn poison_adding_a_move_derived_value_to_the_scoring_inputs_changes_the_fingerprint() {
    // Non-vacuity: substitute a move-derived number into ONE positional argument of
    // `market_state_from_gex` and assert the fingerprint DIFFERS. If this ever passes unchanged,
    // the identity test above is asserting nothing.
}
```

Run it now (`cargo test -p api-rust --test score_identity -- --nocapture`), read the printed triple,
paste it into the three consts, re-run: green. **Then** make the emission edit and re-run: still
green.

**Implement.** `routes/market.rs`, inside the `market_state` `json!` literal after
`"vol_normalized_gex": snap.vol_normalized_gex,`:

```rust
        // Straddle-implied move — additive, attached AFTER `generate_signals`, object|never-bare-null.
        "straddle_move": snap.straddle_move,
```

**Verify.** `cargo test -p api-rust --test score_identity` → 2 tests ok, exit 0; then
`npx nx test api` full.
**Commit.** `feat(api): emit market_state.straddle_move (score byte-identity pinned + poisoned)`
**Reviewer probe.** That the emission sits **after** `generate_signals`/`evaluate_gate` in
`build_bundle` and that no branch of `sig_v` reads it.

---

### B6 — `GET /api/candidates/{ticker}`

**Files:** `apps/api/src/routes/candidates.rs` (new) · `apps/api/src/routes/mod.rs`.

**Trap this task exists to avoid:** `load_analytics(state, sym, min_dte, max_dte, ...)` **bypasses
the warm cache whenever a DTE filter is active** (`analytics.rs:29-40`) and therefore issues a vendor
fetch. AC-13 forbids that here. The route must obtain the snapshot exactly as
`GET /api/contract/{ticker}` does — `load_analytics(&state, &sym, None, None, false)`
(`routes/contract.rs:45`) — and pass the query window to the **selector** instead.

**Test first.** `apps/api/tests/candidate_route.rs`:
`route_reads_the_warm_snapshot_with_no_window_and_never_refreshes` (source-level assertion on the one
call site, with an anti-vacuity check that the file was read and contains `load_analytics`), plus
unit tests on the envelope builder for `state: none_in_band` and for `budget=prompt` caps.

**Implement.**

```rust
//! `GET /api/candidates/{ticker}` — the dedicated deliberate pull (SPEC §2.3 mechanism 1).
//! Never on the bundle, never on SSE, never on a passive page load. Issues NO vendor request:
//! the snapshot read is the pre-existing warm-cache/singleflight read `/api/contract` already does.
use crate::error::AppError;
use crate::services::analytics::load_analytics;
use crate::state::AppState;
use axum::extract::{Path, Query, State};
use axum::Json;
use quant_engine::{CandidateBudget, CandidateSet, DteWindow, SnapshotMeta};
use serde::Deserialize;
use serde_json::Value;

#[derive(Debug, Deserialize, Default)]
pub struct CandidatesQuery {
    pub min_dte: Option<f64>,
    pub max_dte: Option<f64>,
    /// `handoff` (default) | `prompt`. The ±15% band is NOT a query knob.
    pub budget: Option<String>,
}

pub async fn get_candidates(
    State(state): State<AppState>,
    Path(ticker): Path<String>,
    Query(q): Query<CandidatesQuery>,
) -> Result<Json<Value>, AppError> {
    let sym = ticker.trim().to_ascii_uppercase();
    if sym.is_empty() || sym.len() > 12 {
        return Err(AppError::NotFound(format!("invalid ticker {ticker}")));
    }
    // WARM READ ONLY — None/None so the cache is never bypassed, `refresh` always false.
    let (snap_opt, _) = load_analytics(&state, &sym, None, None, false).await?;
    // 404 is reserved for "this ticker has no chain at all" (the /api/contract carve-out).
    let snap = snap_opt.ok_or_else(|| AppError::NotFound(format!("No option-chain data for {sym}")))?;
    if snap.contracts.is_empty() {
        return Err(AppError::NotFound(format!("No option-chain data for {sym}")));
    }
    let budget = match q.budget.as_deref() {
        Some("prompt") => CandidateBudget::Prompt,
        _ => CandidateBudget::Handoff,
    };
    let age = state.gex_cache.age_secs(&sym).await;
    let set = CandidateSet::build(
        &snap.contracts,
        snap.gex_spot,
        chrono::Utc::now(),
        DteWindow { min: q.min_dte, max: q.max_dte },
        budget,
        false, // computed for display / hand-off — NOT sent to the model
        &SnapshotMeta {
            as_of_iso: chrono::DateTime::from_timestamp(snap.cached_at, 0).map(|d| d.to_rfc3339()),
            session_basis: Some(snap.market_phase.as_str().to_string()),
        },
    );
    Ok(Json(crate::services::rec_inputs::candidate_envelope(&sym, &set, age)))
}
```

`services/rec_inputs/mod.rs` (new module directory; `pub mod cap_check; pub mod cited; pub mod
field_reasons; pub mod max_risk;` land in B10–B14) gains:

```rust
/// The §1 envelope: `serde` of the set + the four route-level facts. ONE serializer — the route,
/// the export and the rec response all call it, so the drawer and the endpoint cannot drift.
pub fn candidate_envelope(ticker: &str, set: &CandidateSet, snapshot_age_seconds: Option<f64>) -> Value {
    let mut v = serde_json::to_value(set).unwrap_or_else(|_| serde_json::json!({}));
    if let Some(o) = v.as_object_mut() {
        o.insert("ticker".into(), serde_json::json!(ticker));
        o.insert("snapshot_age_seconds".into(), serde_json::json!(snapshot_age_seconds));
    }
    v
}
```

`routes/mod.rs`: `mod candidates;` and, beside the `/api/contract/{ticker}` line,
`.route("/api/candidates/{ticker}", get(candidates::get_candidates))`.

**Verify.** `npx nx test api`, exit 0. Manual smoke deferred to V8 (never on :8000).
**Commit.** `feat(api): GET /api/candidates/{ticker} — bounded deliberate pull off the warm chain`
**Reviewer probe.** The two `None`s in the `load_analytics` call and the literal `false` for
`refresh`; that 404 fires only for a missing/empty chain and every other outcome is a 200 carrying a
`state`.

---

### B7 — the isolation guards (AC-13 + AC-14)

**Files:** `apps/api/tests/candidate_isolation.rs` (new), modelled on the shipped
`apps/api/tests/research_isolation.rs` (reuse its `rust_files` walker verbatim).

Four tests, each with an anti-vacuity assertion:

1. `no_bundle_path_module_references_the_candidates_module` — scan
   `apps/api/src/routes/market.rs`, `routes/stream.rs`, `state.rs`, `services/analytics.rs` for
   `candidates` / `CandidateSet`; assert none. Anti-vacuity: the scanned set is non-empty and
   contains all four names.
2. `the_guard_bites` — the same regex over a mutated string
   (`"use quant_engine::CandidateSet;"`) must match.
3. `the_selector_has_no_vendor_access` — `libs/quant-engine/Cargo.toml` contains no `reqwest`/
   `hyper`/`tokio` dependency line, and `libs/quant-engine/src/candidates.rs` contains no
   `AppState`/`massive`/`fetch_`.
4. `the_candidates_route_never_forces_a_refresh` — `routes/candidates.rs` contains
   `load_analytics(&state, &sym, None, None, false)` and contains no `true` in that call, and
   contains no `refresh_analytics`.

**Verify.** `cargo test -p api-rust --test candidate_isolation` → 4 ok, exit 0.
**Commit.** `test(api): candidate-set isolation guards (bundle scan + no-vendor + no-refresh)`
**Reviewer probe.** That test 2 fails if the regex in test 1 is weakened.

---

### B8 — the risk block on the settings record (both adapters + migration)

**Files:** `apps/api/src/services/auth/store.rs` · `apps/api/src/db/pg_auth.rs` ·
`apps/api/src/db/migrations.rs`.

**Test first** (in `store.rs`'s `mod tests`):
`an_old_settings_record_without_risk_fields_reads_forward_unchanged`,
`a_corrupt_settings_blob_degrades_to_defaults_without_overwriting_the_original` (write a malformed
JSON file, open the store, read defaults, then assert the file bytes are unchanged),
`zero_is_storable_as_a_value_and_absent_is_a_distinct_state`.

**Implement.** `SettingsRecord` gains three optional fields with `#[serde(default)]` (that default is
the whole disk-JSON migration):

```rust
    #[serde(default)]
    pub risk_account_size: Option<f64>,
    #[serde(default)]
    pub risk_cap_value: Option<f64>,
    /// "usd" | "percent". Stored WITH its value — never two independent truths.
    #[serde(default)]
    pub risk_cap_unit: Option<String>,
    #[serde(default)]
    pub risk_updated_at: Option<f64>,
```

`SettingsPatch` gains `pub risk_account_size: Option<Option<f64>>` and
`pub per_trade_cap: Option<Option<(f64, String)>>` — the outer `Option` is "field present in the
request", the inner is "clear it". `update_settings` (both adapters) applies:

```rust
        if let Some(v) = patch.risk_account_size {
            cur.risk_account_size = v;           // Some(x) sets, None clears
            cur.risk_updated_at = Some(now_secs());
        }
        if let Some(v) = patch.per_trade_cap {
            match v {
                Some((value, unit)) => { cur.risk_cap_value = Some(value); cur.risk_cap_unit = Some(unit); }
                None => { cur.risk_cap_value = None; cur.risk_cap_unit = None; }
            }
            cur.risk_updated_at = Some(now_secs());
        }
```

`JsonAuthStore::open_sqlite` already degrades with `unwrap_or_default()` (`store.rs:100`) — the
loss-free half is that it must **not** persist until a write happens; assert that in the test.

Postgres: `migrations.rs` gains version **8**:

```rust
    (
        8,
        "user_settings_risk_block",
        r#"
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS risk_account_size DOUBLE PRECISION;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS risk_cap_value     DOUBLE PRECISION;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS risk_cap_unit      TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS risk_updated_at    DOUBLE PRECISION;
"#,
    ),
```
and `pg_auth.rs`'s three `user_settings` statements (`SELECT` at :274, `INSERT` at :305, upsert at
:336) gain the four columns.

**Verify.** `npx nx test api` (+3), then `cargo check -p api-rust --features postgres` — exit 0.
**Commit.** `feat(api): per-user risk block on the settings record (both adapters, migration 8)`
**Reviewer probe.** That no code path can write `0` to mean unset; that the corrupt-blob test
asserts the **file bytes**, not just the read result.

---

### B9 — `risk_inputs` on `GET`/`PUT /api/auth/settings` + the one cap derivation

**Files:** `apps/api/src/services/auth/risk.rs` (new) · `services/auth/mod.rs` ·
`services/auth/service.rs` (`SettingsWire`, `write_settings`) · `apps/api/src/routes/auth.rs`
(`SettingsBody`).

**Test first** (in `risk.rs`): `a_dollar_cap_derives_to_itself_with_no_account_size`;
`a_percent_cap_without_an_account_size_is_not_derivable_and_names_why`;
`a_percent_cap_derives_against_the_account_size`; `nothing_entered_is_not_set_never_a_zero`;
`a_dollar_cap_above_the_account_size_is_refused`; `a_percent_cap_outside_0_to_100_is_refused`;
`a_percent_cap_is_never_refused_on_account_size_grounds`; `zero_negative_and_nonfinite_are_refused`.
In `routes/auth.rs`-level coverage: `a_put_without_a_session_stores_nothing` (call `put_settings`
with no cookie, assert the shipped auth error and that the store is untouched).

**Implement** (`risk.rs`):

```rust
//! The risk block: derivation and refusals. The effective dollar cap is derived EXACTLY ONCE, HERE.
//! No other module — and no client — multiplies the owner's entered values.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CapUnit { Usd, Percent }

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct PerTradeCap { pub value: f64, pub unit: CapUnit }

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CapState { Derived, NotDerivable, NotSet }

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct DerivedFrom { pub account_size: Option<f64>, pub cap_value: Option<f64>, pub cap_unit: Option<CapUnit> }

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct EffectiveDollarCap {
    pub state: CapState,
    pub value: Option<f64>,
    pub not_derivable_reason: Option<&'static str>,
    pub derived_from: DerivedFrom,
}

pub fn effective_dollar_cap(account_size: Option<f64>, cap: Option<PerTradeCap>) -> EffectiveDollarCap {
    let derived_from = DerivedFrom {
        account_size,
        cap_value: cap.map(|c| c.value),
        cap_unit: cap.map(|c| c.unit),
    };
    match (cap, account_size) {
        (None, _) => EffectiveDollarCap { state: CapState::NotSet, value: None, not_derivable_reason: None, derived_from },
        (Some(c), _) if c.unit == CapUnit::Usd =>
            EffectiveDollarCap { state: CapState::Derived, value: Some(round2(c.value)), not_derivable_reason: None, derived_from },
        (Some(c), Some(a)) =>
            EffectiveDollarCap { state: CapState::Derived, value: Some(round2(a * c.value / 100.0)), not_derivable_reason: None, derived_from },
        (Some(_), None) =>
            EffectiveDollarCap { state: CapState::NotDerivable, value: None, not_derivable_reason: Some("percent_without_account_size"), derived_from },
    }
}

/// Server-side refusals — authoritative, mirroring the client's (INTERFACE §4). Nothing is stored
/// when this returns `Err`.
pub fn validate(account_size: Option<Option<f64>>, cap: Option<Option<(f64, String)>>, stored_account: Option<f64>) -> Result<(), &'static str> {
    if let Some(Some(a)) = account_size {
        if !a.is_finite() || a <= 0.0 { return Err("Enter a number greater than zero."); }
    }
    if let Some(Some((v, ref unit))) = cap {
        if !v.is_finite() || v <= 0.0 { return Err("Enter a number greater than zero."); }
        match unit.as_str() {
            "percent" => { if v > 100.0 { return Err("Enter a percentage between 0 and 100."); } }
            "usd" => {
                // Compared against the account size AS IT WILL BE after this patch.
                let effective = match account_size { Some(a) => a, None => stored_account };
                if let Some(a) = effective { if v > a { return Err("A dollar cap can't exceed your account size."); } }
            }
            _ => return Err("Cap unit must be usd or percent."),
        }
    }
    Ok(())
}
```

`SettingsWire` gains `pub risk_inputs: RiskInputsWire` built from the record:
`{ state: set|not_set, account_size, per_trade_cap, effective_dollar_cap, storage_available, updated_at }`
where `state = set` iff either owner value is present, and `storage_available` mirrors the store's
health (`true` for the JSON adapter with a writable path and for a live PG pool). `routes/auth.rs`'s
`SettingsBody` gains the two double-optional fields and passes them into `SettingsPatch`;
`write_settings` calls `risk::validate` **before** `update_settings` and maps `Err` to the shipped
`validation(...)` 422. The session resolve at `routes/auth.rs:151-155` is unchanged — that is the
whole write gate (AC-24).

**Verify.** `npx nx test api` (+9), `cargo check -p api-rust --features postgres`, exit 0.
**Commit.** `feat(api): risk_inputs wire + one server-side effective-cap derivation + refusals`
**Reviewer probe.** That `effective_dollar_cap` is called from exactly one place per response path
(`rg -n "effective_dollar_cap\(" apps/api/src` should show the definition, the settings wire and the
rec assembly — nothing else); that a percent cap can never hit the account-size refusal.

---

### B10 — the ONE `max_risk` parse

**Files:** `apps/api/src/services/rec_inputs/max_risk.rs` (new).

**Test first:** `"$300"` → `Dollars(300.0)`; `"1.5% of account ($300)"` → `Dollars(300.0)`;
`"$1,250.50"` → `Dollars(1250.5)`; `"1R defined-risk"` → `NotParseable`; `"300"` → `NotParseable`
(a bare number is never dollars); `"$300 to $500"` → `NotParseable`; `"$300 ($300)"` →
`Dollars(300.0)`; `None` → `NotParseable`.

**Implement.**

```rust
/// The ONE parse of `max_risk`, for the ONE consumer (the cap check). `position_size` is NEVER
/// parsed by any lane. Closed output: a dollar figure, or "not parseable" — never a default.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ParsedRisk { Dollars(f64), NotParseable }

pub fn parse_max_risk_dollars(text: Option<&str>) -> ParsedRisk {
    let Some(t) = text else { return ParsedRisk::NotParseable };
    let chars: Vec<char> = t.chars().collect();
    let mut vals: Vec<f64> = Vec::new();
    let mut i = 0usize;
    while i < chars.len() {
        if chars[i] != '$' { i += 1; continue; }
        let mut j = i + 1;
        while j < chars.len() && chars[j].is_whitespace() { j += 1; }
        let start = j;
        while j < chars.len() && (chars[j].is_ascii_digit() || chars[j] == ',' || chars[j] == '.') { j += 1; }
        if j > start {
            let raw: String = chars[start..j].iter().filter(|c| **c != ',').collect();
            if let Ok(v) = raw.trim_end_matches('.').parse::<f64>() {
                if v.is_finite() && v >= 0.0 { vals.push(v); }
            }
        }
        i = j.max(i + 1);
    }
    match vals.len() {
        0 => ParsedRisk::NotParseable,
        1 => ParsedRisk::Dollars(vals[0]),
        // Two mentions of the SAME figure ("$300 ($300)") stay unambiguous; two different ones do not.
        _ if vals.iter().all(|v| (*v - vals[0]).abs() < 1e-9) => ParsedRisk::Dollars(vals[0]),
        _ => ParsedRisk::NotParseable,
    }
}
```

**Verify.** `cargo test -p api-rust max_risk` → 8 ok, exit 0.
**Commit.** `feat(api): the single server-side max_risk dollar parse (closed output)`
**Reviewer probe.** That a bare number is never read as dollars, and that the function is `pub` in
exactly one module with no sibling copy.

---

### B11 — the cap verdict (five members, one fixed order)

**Files:** `apps/api/src/services/rec_inputs/cap_check.rs` (new) ·
`apps/api/tests/fixtures/rec/{no_trade_with_cap.json,no_trade_no_cap.json,entry_null_risk.json,entry_equal_to_cap.json}` (new).

**Test first — the three §7 names the spec calls out:**
`a_no_trade_fixture_with_a_cap_set_yields_not_applicable`,
`the_same_no_trade_fixture_with_no_cap_yields_not_applicable_not_no_cap`,
`an_entry_stating_fixture_with_a_null_risk_figure_yields_not_checkable`, plus
`equality_is_within` and `strictly_greater_is_above`.

**Implement.**

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CapVerdict { NotApplicable, NoCap, NotCheckable, Within, Above }

/// FIXED evaluation order, first match wins (SPEC §2.5 table). DO NOT REORDER — the order is what
/// keeps two implementations from disagreeing, and member 1 is what keeps a `no_trade` card free of
/// a "couldn't check" caveat it never earned.
pub fn cap_verdict(states_entry: bool, effective_cap: Option<f64>, parsed: ParsedRisk) -> CapVerdict {
    if !states_entry { return CapVerdict::NotApplicable; }          // 1
    let Some(cap) = effective_cap else { return CapVerdict::NoCap }; // 2
    match parsed {
        ParsedRisk::NotParseable => CapVerdict::NotCheckable,        // 3
        ParsedRisk::Dollars(v) if v <= cap => CapVerdict::Within,     // 4 — equality is WITHIN
        ParsedRisk::Dollars(_) => CapVerdict::Above,                  // 5
    }
}
```
`states_entry` is `strategy.decision == "trade"`; an absent strategy is `false`.

**Verify.** `cargo test -p api-rust cap_check` → 5 ok, exit 0.
**Commit.** `feat(api): pinned cap verdict with not_applicable resolved first`
**Reviewer probe.** That nothing between members 1 and 2 can return early, and that no caller
recomputes the verdict (it is computed once and copied onto the envelope).

---

### B12 — per-field reasons (declared dependency order + the tie-break)

**Files:** `apps/api/src/services/rec_inputs/field_reasons.rs` (new).

**Test first:** `a_present_value_has_no_reason`; `a_null_field_with_every_input_present_is_not_given`;
`a_null_max_risk_with_no_risk_block_is_unavailable_naming_the_risk_block`;
`position_size_with_both_dependencies_absent_names_the_risk_block_on_every_run` (loop 100×, assert
the token is stable — AC-72a); `exit_stop_never_reports_a_missing_input`.

**Implement.**

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub enum RecField { MaxRisk, PositionSize, ExitTarget, ExitStop }
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)] #[serde(rename_all = "snake_case")] pub enum ReasonKind { NotGiven, Unavailable }
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)] #[serde(rename_all = "snake_case")] pub enum MissingInput { RiskBlock, CandidateQuotes, StraddleMove }
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)] pub struct FieldReason { pub reason: ReasonKind, pub missing_input: Option<MissingInput> }

/// What the ASSEMBLER actually inserted — never a question put to the model.
#[derive(Debug, Clone, Copy)]
pub struct InputPresence { pub risk_block: bool, pub candidate_quotes: bool, pub straddle_move: bool }

pub fn field_reason(field: RecField, value_present: bool, p: InputPresence) -> Option<FieldReason> {
    if value_present { return None; }
    // Declared priority order; `missing_input` names the FIRST absent dependency. `position_size` is
    // the only field with two, and when BOTH are absent the token is `risk_block` — the input the
    // owner can fix and the one the `Set your risk inputs` action clears.
    let deps: Vec<(bool, MissingInput)> = match field {
        RecField::MaxRisk => vec![(p.risk_block, MissingInput::RiskBlock)],
        RecField::PositionSize => vec![(p.risk_block, MissingInput::RiskBlock), (p.candidate_quotes, MissingInput::CandidateQuotes)],
        RecField::ExitTarget => vec![(p.straddle_move, MissingInput::StraddleMove)],
        RecField::ExitStop => vec![], // market-state levels only — always present
    };
    Some(match deps.into_iter().find(|(present, _)| !*present) {
        Some((_, missing)) => FieldReason { reason: ReasonKind::Unavailable, missing_input: Some(missing) },
        None => FieldReason { reason: ReasonKind::NotGiven, missing_input: None },
    })
}
```

**Verify.** `cargo test -p api-rust field_reasons` → 5 ok, exit 0.
**Commit.** `feat(api): server-derived per-field reasons with a deterministic tie-break`
**Reviewer probe.** That `find` (first match) is used rather than any "collect all" shape — the wire
carries one token, never two.

---

### B13 — the right token on the rec schema

**Files:** `apps/api/src/services/llm.rs` (schema string at :124-131; `parse_strategy_json` at
:341-390).

**Test first** (in `llm.rs`'s `mod tests`): `a_call_right_is_projected`; `a_put_right_is_projected`;
`an_unrecognised_right_stays_absent_and_never_defaults`; `an_absent_right_stays_absent`
(contrast asserted against the shipped `bias` default of `neutral`).

**Implement.** In the schema string, after `\"strikes\":number[],\"expiration\":string|null,` add
`\"right\":\"call\"|\"put\"|null,` and append one sentence to the instruction block:

```
When you name a single contract, state `right` as call or put. If the structure has more than one
leg, leave `right` null — do not guess.
```

In `parse_strategy_json`, beside the `bias` coercion:

```rust
    // Deliberately UNLIKE `bias` (which defaults to "neutral"): an unrecognised or absent right
    // stays ABSENT. A defaulted right is exactly the confidently-wrong match this exists to prevent.
    let right = match v.get("right").and_then(|r| r.as_str()) {
        Some("call") => Value::String("call".into()),
        Some("put") => Value::String("put".into()),
        _ => Value::Null,
    };
```
and `"right": right,` in the returned object.

**Verify.** `cargo test -p api-rust llm` → 4 new + existing ok, exit 0.
**Commit.** `feat(api): right token on the rec schema — no default, ever`
**Reviewer probe.** That `right` has no `unwrap_or`, and that the schema sentence does not invite a
guess.

---

### B14 — the cited contract (a match key with no partial constructor)

**Files:** `apps/api/src/services/rec_inputs/cited.rs` (new) ·
`apps/api/tests/candidate_isolation.rs` (append one structural test).

**Test first:** `two_strikes_yield_none`; `a_missing_expiration_yields_none`;
`a_missing_right_with_the_strike_and_expiration_in_the_set_yields_right_undetermined_with_both_legs`;
`a_missing_right_with_the_strike_absent_yields_off_set`;
`a_full_triple_absent_from_the_set_yields_off_set`; `a_full_triple_in_the_set_yields_cited`;
`the_local_rule_based_fallback_shape_yields_none` (`strikes: []`, `expiration: null`). Structural:
`the_match_key_constructor_takes_a_non_optional_right` — assert `cited.rs` contains
`right: ContractType` in the `CitedKey::new` signature and contains no `right: Option<ContractType>`
in that impl block, with the mutated-string anti-vacuity arm.

**Implement.**

```rust
/// The match key. Private fields, one constructor taking all three parts: a partial key cannot be
/// built, so "match on strike + expiration and pick a side" is not expressible.
#[derive(Debug, Clone, PartialEq)]
pub struct CitedKey { expiration: String, strike: f64, right: ContractType }

impl CitedKey {
    pub fn new(expiration: String, strike: f64, right: ContractType) -> Self { Self { expiration, strike, right } }
    /// The ONLY derivation from a parsed rec: EXACTLY one strike AND an expiration AND a right.
    pub fn from_strategy(strikes: &[f64], expiration: Option<&str>, right: Option<ContractType>) -> Option<Self> {
        match (strikes, expiration, right) {
            ([k], Some(e), Some(r)) => Some(Self::new(e.to_string(), *k, r)),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CitedState { Cited, RightUndetermined, OffSet, None }

pub struct CitedOutcome { pub state: CitedState, pub contract: Option<CandidateContract>, pub legs: Vec<CandidateContract> }

pub fn resolve_cited(set: &CandidateSet, strikes: &[f64], expiration: Option<&str>, right: Option<ContractType>) -> CitedOutcome {
    let (Some(exp), [k]) = (expiration, strikes) else {
        return CitedOutcome { state: CitedState::None, contract: None, legs: Vec::new() };
    };
    let pair: Vec<CandidateContract> = set.contracts().iter()
        .filter(|c| c.expiration == exp && (c.strike - *k).abs() < 1e-6)
        .cloned().collect();
    match right {
        Some(r) => match pair.iter().find(|c| c.right == r) {
            Some(c) => CitedOutcome { state: CitedState::Cited, contract: Some(c.clone()), legs: Vec::new() },
            // The exact contract was not sent — the ORIGINAL, narrower meaning of off_set.
            None => CitedOutcome { state: CitedState::OffSet, contract: None, legs: Vec::new() },
        },
        // Right absent while strike AND expiration ARE in the set: its own state, never `off_set`
        // (which would rename "we can't tell which leg you mean" as "we didn't send it").
        None if !pair.is_empty() => CitedOutcome { state: CitedState::RightUndetermined, contract: None, legs: pair },
        None => CitedOutcome { state: CitedState::OffSet, contract: None, legs: Vec::new() },
    }
}
```

**Verify.** `cargo test -p api-rust cited` + `--test candidate_isolation` → 7 + 1 ok, exit 0.
**Commit.** `feat(api): structural cited-contract match (no partial key, four closed states)`
**Reviewer probe.** That `RightUndetermined` can never fall through to `OffSet`; that
`CitedKey`'s fields are private and no other module constructs one.

---

### B15 — prompt assembly: candidate block, risk block, digest, pruned `market_state`

**Files:** `apps/api/src/services/llm.rs` (`build_rec_prompts`) ·
`apps/api/src/services/recommendation.rs` (call site).

**Test first** (`llm.rs` tests): `the_prompt_block_never_exceeds_twenty_records`;
`the_forwarded_move_is_restricted_to_the_candidate_tenors`;
`widening_the_restriction_makes_the_subset_assertion_fail` (poison, via
`quant_engine::assert_tenor_subset`); `the_positions_digest_rides_the_prompt_labelled_simulated`.

**Implement.** Change the signature to take an explicit assembled context (the wholesale forward at
`llm.rs:137` is what this replaces):

```rust
/// The rec-input blocks the assembler inserted. `market_state` here is ALREADY a pruned clone.
pub struct RecPromptContext<'a> {
    pub market_state: Value,          // pruned: `straddle_move` restricted to the candidate tenors
    pub signals: Option<&'a Value>,
    pub ai_eval: Option<&'a Value>,
    pub candidates: Value,            // the §1 envelope, budget=prompt, sent_to_model=true
    pub risk_inputs: Value,           // the as-sent risk block (§4 shape) or `{state:"not_set"}`
    pub open_positions: Value,        // the client digest, labelled `simulated`
}

pub fn build_rec_prompts(ticker: &str, ctx: &RecPromptContext<'_>, persona_name: &str) -> (String, String)
```
The `context` json becomes:

```rust
    let context = json!({
        "ticker": ticker,
        "market_state": ctx.market_state,
        "signals": ctx.signals,
        "ai_eval": ctx.ai_eval,
        "candidate_contracts": ctx.candidates,
        "risk_inputs": ctx.risk_inputs,
        "open_positions": ctx.open_positions,
        "open_positions_note": "SIMULATED positions from the owner's browser only. Broker positions are not counted.",
        "strike_profile_note": "strike_profile omitted from prompt if large; use walls/flip from market_state",
    });
```
And one clause in the system prompt after the schema:

```
Size within the owner's stated risk block when one is present; if it is absent, say so rather than
inventing a figure. The candidate contracts listed are the only ones Convexa sent you.
```

The pruning happens in `recommendation.rs` before the call:

```rust
    let set = CandidateSet::build(&snap.contracts, snap.gex_spot, now, window, CandidateBudget::Prompt, true, &meta);
    let mut ms = bundle.get("market_state").cloned().unwrap_or(json!({}));
    if let Some(mv) = snap.straddle_move.as_ref() {
        // ONE restriction function, never a local filter (SPEC §2.2, AC-55).
        let pruned = quant_engine::restrict_move_to_tenors(mv, set.included_expirations());
        if let Some(o) = ms.as_object_mut() {
            o.insert("straddle_move".into(), serde_json::to_value(&pruned).unwrap_or(Value::Null));
        }
    }
```

**Verify.** `cargo test -p api-rust llm` → 4 new ok, exit 0.
**Commit.** `feat(api): rec prompt assembly with a pruned market_state clone and a bounded block`
**Reviewer probe.** That `market_state` reaches the prompt **only** through `ctx.market_state`
(`rg -n "get\(\"market_state\"\)" apps/api/src/services/llm.rs` must return nothing).

---

### B16 — rec response envelope + the request digest

**Files:** `apps/api/src/services/recommendation.rs` (`RecRequestBody`, `generate_recommendation`,
`base` closure) · `apps/api/src/services/rec_inputs/digest.rs` (new: the total digest parser + the
FNV-1a change detector).

**Test first:** `an_unlabelled_or_malformed_digest_parses_to_not_sent_and_never_fails_the_rec`;
`the_digest_is_never_written_to_any_store` (source scan: `recommendation.rs` contains no
`update_settings`/`set_credential`/`put_book` on the digest path);
`the_envelope_carries_cap_check_field_reasons_and_cited_contract_beside_pinned_fingerprint`;
`the_risk_inputs_digest_changes_when_a_value_changes_and_is_stable_otherwise`.

**Implement.** `RecRequestBody` gains `#[serde(default)] pub open_positions: Option<Value>` (a raw
`Value`, so a malformed digest can never 422 the rec), parsed by:

```rust
/// Total: any shape failure ⇒ `not_sent`. An unlabelled digest is unconstructable (the `source`
/// key is required), and `not_sent` is deliberately distinct from `none_open`.
pub fn parse_digest(v: Option<&Value>) -> Value {
    let fallback = json!({ "source": "simulated", "state": "not_sent", "this_underlying": null, "portfolio": null });
    let Some(v) = v else { return fallback };
    if v.get("source").and_then(|s| s.as_str()) != Some("simulated") { return fallback; }
    match v.get("state").and_then(|s| s.as_str()) {
        Some(s @ ("none_open" | "not_sent" | "unavailable")) => json!({
            "source": "simulated",
            "state": s,
            "this_underlying": v.get("this_underlying").cloned().unwrap_or(Value::Null),
            "portfolio": v.get("portfolio").cloned().unwrap_or(Value::Null),
        }),
        _ => fallback,
    }
}

/// Change detector only — never a security primitive, never persisted server-side.
pub fn risk_inputs_digest(account_size: Option<f64>, cap_value: Option<f64>, cap_unit: Option<&str>) -> String {
    let canon = format!("{account_size:?}|{cap_value:?}|{}", cap_unit.unwrap_or("-"));
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for b in canon.as_bytes() { h ^= *b as u64; h = h.wrapping_mul(0x1000_0000_01b3); }
    format!("{h:016x}")
}
```

The `base` closure gains, beside `"pinned_fingerprint": pinned`:

```rust
            "sent": {
                "budget": "prompt",
                "candidates": sent_candidates,          // envelope, sent_to_model: true
                "straddle_move_tenors": sent_tenors,    // ⊆ sent.candidates expirations
                "risk_inputs": sent_risk_inputs,        // the AS-SENT block (§4 shape)
                "risk_inputs_digest": sent_digest,
                "open_positions": sent_positions,
            },
            "cap_check": {
                "verdict": verdict,
                "effective_dollar_cap": eff_cap_value,  // carried even when not_applicable
                "cap_not_derivable_reason": cap_reason,
                "parsed_risk_dollars": parsed_dollars,
                "model_max_risk_text": model_text,      // the model's raw prose, for attribution
            },
            "field_reasons": field_reasons,
            "cited_contract": cited,
```
A risk-block read failure is caught and degrades to `{state:"not_set"}` with a `warn!` — the rec
never fails on a settings read (SPEC §5).

**Verify.** `npx nx test api`, exit 0.
**Commit.** `feat(api): rec envelope gains the as-sent echo, cap verdict, reasons and cited contract`
**Reviewer probe.** That `sent.straddle_move_tenors` is derived from the **pruned** move, not the
snapshot's; that the digest never reaches a store call.

---

### B17 — export: candidate / risk / positions sections + the amended egress note

**Files:** `apps/api/src/services/recommendation.rs` (`build_export`) ·
`apps/api/src/routes/recommendation.rs` (`get_export` — optional session).

**Test first:** `an_anonymous_export_reports_risk_inputs_not_set_with_the_section_present`;
`the_egress_note_is_composed_from_the_categories_and_no_longer_claims_no_account_or_identity`;
`a_category_that_was_not_sent_is_present_with_sent_false`;
`the_export_candidate_block_uses_the_handoff_budget_and_sent_to_model_false`.

**Implement.** `get_export` resolves the session optionally with the shipped mechanism
(`routes/recommendation.rs:84-88`) and passes `Option<&UserRecord>` plus the snapshot into
`build_export`. `build_export` adds to `context`: `candidates` (handoff envelope),
`risk_inputs` (the §4 shape; anonymous ⇒ `{state:"not_set", …}` — present, never omitted),
`open_positions` (`{source:"simulated", state:"not_sent", …}` — a GET carries no client digest), and
at top level:

```rust
    let categories = json!([
        {"key": "context",        "sent": true},
        {"key": "candidates",     "sent": candidates_sent},
        {"key": "risk_inputs",    "sent": risk_sent},
        {"key": "open_positions", "sent": false},
        {"key": "persona_prompt", "sent": true},
        {"key": "glossary",       "sent": true},
    ]);
```
with the note composed from exactly those `sent: true` keys, in SPEC §4's wording, and the shipped
"no account or identity" clause removed.

**Verify.** `npx nx test api`, exit 0.
**Commit.** `feat(api): export carries candidates, risk inputs, positions and an enumerated egress note`
**Reviewer probe.** That the note is **built from** `egress_categories` rather than written beside
them (a hand-written note is how AC-90 goes false).

---

### B18 — the pre-commit measurement harness (§7.1 + §7.2)

**Files:** `apps/api/src/infrastructure/massive/rest.rs` (one `pub` counting method) ·
`apps/api/src/main.rs` (a `QuoteFill` subcommand).

Counts must come off the **raw vendor rows**, before `normalize_contract`'s `> 0.0` filter
(`rest.rs:823-824`) — otherwise the filter biases the result toward "no quote".

```rust
/// §7.1 measurement — counts off the RAW rows: vendor-null is counted separately from filtered-zero.
pub struct QuoteFillCounts {
    pub rows: usize,
    pub both_sides: usize,
    pub one_side: usize,
    pub vendor_null: usize,
    pub filtered_zero: usize,
    /// §7.2 — the key set of ONE raw row, so a quote timestamp can be confirmed or ruled out.
    pub sample_row_keys: Vec<String>,
}
pub async fn fetch_chain_quote_fill(&self, ticker: &str) -> AppResult<QuoteFillCounts>
```
The subcommand prints the whole-chain counts, the counts restricted to the ±15% band ∩ the active
window, and the counts restricted to the 64-record candidate set (built via `CandidateSet::build`),
and writes `data/research/quote_fill_<utc>.json`.

**Verify.** `cargo test -p api-rust`, exit 0; the live run is V7.
**Commit.** `feat(api): quote-fill + raw-row measurement harness for the §7 pre-commit pass`
**Reviewer probe.** That the counts are taken before normalization, and that the candidate-set
restriction reuses `CandidateSet::build` rather than a re-implemented band filter.

---

## Track F — frontend

Run `npx nx test @convexa/dashboard` per task and `npm run typecheck` at least at F13 (Vitest does
not typecheck). Every new component binds theme tokens via `extrasFor(theme)`; zero hardcoded hex;
no new keyframe family.

### F1 — `libs/api`: the wire types + `getCandidates`

**Files:** `libs/api/src/lib/convexa.ts`.

Add, bound **exactly** to the conformance block above:

- `StraddleMoveState`, `MoveBasis`, `StraddleTenor`, `StraddleMove`; `MarketState.straddle_move:
  StraddleMove` (non-optional — the backend always emits an object).
- `CandidateSetState`, `QuotePresence`, `IvState`, `SpreadBand`, `CandidateContract`,
  `CandidateCaps`, `CandidateSetEnvelope`.
- `CapUnit`, `PerTradeCap`, `EffectiveDollarCap`, `RiskInputs`; `UserSettings` gains
  `risk_inputs?: RiskInputs` (optional **only** as resilience against an older backend, exactly like
  `RecStatus.scenarios` at :1271 — an absent block degrades to `not_set`, never a throw).
- `RecStrategy.right?: OptionRight | null`; `RecResponse` gains `sent?`, `cap_check?`,
  `field_reasons?`, `cited_contract?`; `RecRequest` gains `open_positions?: OpenPositionsDigest`;
  `RecExport` gains the typed `context.candidates` / `context.risk_inputs` /
  `context.open_positions` / `egress_categories`.
- `export async function getCandidates(symbol, opts?: {minDte?, maxDte?, budget?}):
  Promise<CandidateSetEnvelope>` — modelled on `fetchTrackedContract` (:1015), `ApiError` on non-2xx.

**Verify.** `npm run typecheck` → exit 0.
**Commit.** `feat(api-client): wire types for candidates, straddle move, risk inputs and cap check`
**Reviewer probe.** That every enum is a string-literal union (so a closed lookup is type-checked)
and that no type widens a documented `number|null` to `number`.

### F2 — extend the shared network-boundary mock

**Files:** `apps/dashboard/src/app/features/auth/testBackend.ts`.

Add: `risk_inputs` on the settings GET/PUT shapes (with `settingsWrite: 'validation'` returning the
server refusal), a `/api/candidates/` handler returning a fixture envelope, the rec POST additions
(`sent`, `cap_check`, `field_reasons`, `cited_contract`, `strategy.right`), the export additions, a
`recPostBodies: string[]` capture (so F10 can assert the digest that was sent), and setters
`setRiskInputs(...)`, `setCapCheck(...)`, `setCandidates(...)`. Mock **the network boundary only** —
never an app internal.

**Verify.** `npx nx test @convexa/dashboard` (unchanged count, exit 0).
**Commit.** `test(dashboard): extend the mock backend with the tradeable-rec-inputs wire`

### F3 — copy + the two design-canon amendments

**Files:** `features/auth/copy.ts` · `pages/ticker/widgets/ai-rec/copy.ts` ·
`pages/ticker/widgets/straddle-move/copy.ts` (new) ·
`.spire/clusters/tech/context/DESIGN_SYSTEM.md` (Amendments table only).

Every string comes **verbatim** from SPEC §4 — the egress sentence first in the Settings section
helper, the four-field literals and their tips, the provenance chip and tip, the superseded strip,
the undetermined-right pair, the drawer labels, `none omitted`, the straddle basis/advisory/tooltip
lines, and the amended `COPY.export.egress` fallback (which must assert the same thing as the
server-composed note — AC-90). Add two rows to the DESIGN_SYSTEM Amendments table (dated, with
cause): the unit-bearing numeric input, and the two new members of the closed not-a-number
vocabulary (`not set`, `size not suggested`).

**Verify.** `npx nx test @convexa/dashboard`, exit 0.
**Commit.** `feat(dashboard): rec-input copy + two recorded design-canon amendments`
**Reviewer probe.** That `size not suggested` and `not set` are separate constants with the
one-sentence distinction in a comment, and that no synonym of `not set` exists anywhere.

### F4 — pure literal selectors (closed lookup, no null inspection)

**Files:** `pages/ticker/widgets/ai-rec/literals.ts` + `literals.spec.ts` (new) ·
`pages/ticker/widgets/ai-rec/fixtures.ts` (new: `noTradeRec()`, `tradeRecNoRiskBlock()`,
`tradeRecOverCap()`, `tradeRecEqualToCap()`, `recRightUndetermined()`, `recOffSet()`).

```ts
export type FieldLiteral =
  | { kind: 'value'; text: string }
  | { kind: 'dash' }          // `—`          + `No entry, so there is nothing to size.`
  | { kind: 'not_set' }       // `not set`    + `Set your risk inputs`
  | { kind: 'unavailable' }   // `unavailable` + the missing input named
  | { kind: 'not_given' };    // `not given`

/** AC-69/70/71/72: exactly ONE member of the closed set. `null`/`undefined`/`NaN`/`0`/'' never render. */
export function fieldLiteral(args: {
  decision: RecDecision;
  value: string | number | null | undefined;
  reason: RecFieldReason | null | undefined;
}): FieldLiteral {
  if (args.decision === 'no_trade') return { kind: 'dash' };           // first, always
  const v = args.value;
  if (typeof v === 'number' && Number.isFinite(v) && v !== 0) return { kind: 'value', text: String(v) };
  if (typeof v === 'string' && v.trim() !== '') return { kind: 'value', text: v };
  if (args.reason?.reason === 'not_given') return { kind: 'not_given' };
  if (args.reason?.missing_input === 'risk_block') return { kind: 'not_set' };
  return { kind: 'unavailable' };
}

export type CapSurface =
  | { kind: 'none' }                                    // no_trade: NOTHING renders
  | { kind: 'no_cap' }                                  // no verdict; the cap reads `not set`
  | { kind: 'not_checkable' }
  | { kind: 'comparison'; within: boolean };

/** Closed lookup on the wire token — never a null test (AC-58a is carried entirely by member 1). */
export function capSurface(verdict: CapVerdict | null | undefined): CapSurface {
  switch (verdict) {
    case 'not_applicable': return { kind: 'none' };
    case 'no_cap': return { kind: 'no_cap' };
    case 'within': return { kind: 'comparison', within: true };
    case 'above': return { kind: 'comparison', within: false };
    case 'not_checkable': return { kind: 'not_checkable' };
    default: return { kind: 'none' };   // an unknown token renders nothing, never a guess
  }
}
```
Plus `citedLine(state, contract, legs)` and `liquidityLine(envelope)` (the digested
`{N} candidates across {M} expirations · ATM spread {BAND} · {K} omitted ({REASON})`, `none omitted`
at zero, using the wire counts only — the browser never subtracts two numbers).

**Verify.** `npx nx test @convexa/dashboard -- literals` → ~18 tests, exit 0.
**Commit.** `feat(dashboard): closed-lookup literal selectors for the rec surfaces`
**Reviewer probe.** That `fieldLiteral` checks `no_trade` **before** touching the value, and that
`capSurface`'s `default` renders nothing.

### F5 — Settings `Risk inputs` panel

**Files:** `features/auth/RiskInputsSection.tsx` (new) · `features/auth/riskInputs.ts` (new: pure
validation + formatting, **no arithmetic on entered values**) · `features/auth/validation.ts`
(re-export) · `features/auth/useSettings.ts` (`setRiskInputs`) · `features/auth/SettingsPage.tsx`
(panel order per the reconciliation above) · `features/auth/riskInputs.spec.tsx` (new).

Tests (component, against the F2 mock): save + reload round-trip; DOM-order assertion that the
section helper's **first sentence** names the AI-provider egress and precedes **both** inputs;
local refusals for zero/negative/non-numeric, dollar-cap > account size, percent outside `(0,100]`;
a percent cap never refused on account-size grounds and no refusal mentioning the account size; a
dollar cap with no account size saves and shows the same figure; a percent cap with no account size
shows *Account size: not set* as the not-derivable reason; anonymous renders `aria-disabled` +
focusable controls (never the HTML `disabled` attribute) and writes nothing durable; failed save
keeps typed values, shows `settings.saveError` verbatim, never `Saved`; storage-unavailable copy.

**Verify.** `npx nx test @convexa/dashboard -- riskInputs`, exit 0.
**Commit.** `feat(dashboard): Risk inputs settings panel with the egress disclosure above the fields`
**Reviewer probe.** `rg -n "\*|/" features/auth/riskInputs.ts` — the module must contain no
multiplication or division of an entered value; the derived figure is rendered from
`effective_dollar_cap.value` only, and only under a *derived from your inputs* label.

### F6 — `Straddle-implied move` widget

**Files:** `pages/ticker/widgets/straddle-move/{StraddleMove.tsx,copy.ts,index.ts,StraddleMove.spec.tsx}`
(new) · `pages/ticker/widgets/index.ts` · `pages/ticker/TickerDashboard.tsx` (insert immediately
after `<IvRank …/>` at :604).

Renders exactly one tenor — `primary_expiration` matched by exact expiration, never array order,
never a DTE comparison. Headline `± $X.XX  (± Y.Z%)` mono/tabular (never a heading element); the
basis line and the advisory line are visible without hovering; the term "Expected move" appears only
inside the tooltip. Three distinct unavailable literals chosen by closed lookup on `state`. Takes no
`offline`/`isLive` prop and binds no opacity to stream state.

**Verify.** `npx nx test @convexa/dashboard -- StraddleMove` → ~9 tests, exit 0.
**Commit.** `feat(dashboard): straddle-implied move widget (static, self-describing)`
**Reviewer probe.** `expect(source).not.toMatch(/streamOffline|isLive|opacity:/)` in the spec, and
that the tenor is selected by `find(t => t.expiration === primary_expiration)`.

### F7 — rec panel: four fields, provenance chip, cap annotation, cited contract

**Files:** `pages/ticker/widgets/ai-rec/AiRecPanel.tsx` (:875-941 region) ·
`ai-rec/CapAnnotation.tsx`, `ai-rec/CitedContractLine.tsx`, `ai-rec/ProvenanceChip.tsx` (new) ·
`ai-rec/ai-rec.risk.spec.tsx` (extend).

All four fields render through `fieldLiteral`; the cap surface through `capSurface`. `warning.*` +
icon only — never brand amber, never a success/error slot. The over-cap rec stays actionable (Accept
enabled). The superseded strip uses the shipped stale-strip treatment and fires by comparing
`sent.risk_inputs_digest` against the currently stored block.

**Verify.** `npx nx test @convexa/dashboard -- ai-rec`, exit 0.
**Commit.** `feat(dashboard): rec panel renders the four fields, cap check and cited contract`
**Reviewer probe.** That `no_trade` renders **no** cap DOM node at all (assert
`queryByTestId('cap-annotation')` is null with a cap set **and** with none).

### F8 — `What the numbers said` strip

**Files:** `pages/ticker/widgets/ai-rec/NumbersSaidStrip.tsx` (new) · `AiRecPanel.tsx` (rendered on
**every** verdict, including the `no_trade` branch at :822-850) · spec.

One digested liquidity line + the move for the cited expiration (exact match; no match ⇒ says so for
that expiry and never relabels another tenor's number). No per-contract rows, no strike axis, no
sorting, no expansion.

**Verify.** `npx nx test @convexa/dashboard -- NumbersSaid`, exit 0.
**Commit.** `feat(dashboard): digested candidate-liquidity strip on every verdict`

### F9 — export drawer sections

**Files:** `pages/ticker/widgets/ai-rec/StateExportDrawer.tsx` · spec.

Adds `Candidate contracts`, `Your risk inputs` (labelled as-sent **or** as-next, never both, never
unlabelled) and `Open positions` sections; an unsent category renders `Not sent — you haven't set
this.` rather than an omitted section; the drawer names which consumer it is showing and how many
contracts across how many expirations that consumer carried; when the as-sent set cannot be
recovered it says so instead of listing a re-assembled one. `View what's sent` stays reachable in
every panel state.

**Verify.** `npx nx test @convexa/dashboard -- StateExportDrawer`, exit 0.
**Commit.** `feat(dashboard): export drawer enumerates candidates, risk inputs and positions`

### F10 — the open-positions digest

**Files:** `features/trading/positions/digest.ts` + `digest.spec.ts` (new) ·
`pages/ticker/widgets/ai-rec/useAiRecommendation.ts` (send it) · `pages/ticker/TickerDashboard.tsx`
(pass the store read).

Pure derivation from the durable positions store: `{source:'simulated', state, this_underlying,
portfolio}` with the three-state vocabulary (`none_open` checked-and-empty · `not_sent` · `unavailable`
when the store faulted). `max_loss` reuses the shipped eligibility (`positions/maxLoss.ts`) — a
defined figure only inside the eligible closed set, else the reason the FE already computes.

**Verify.** `npx nx test @convexa/dashboard -- digest`, exit 0.
**Commit.** `feat(dashboard): simulated open-positions digest sent with the rec request`
**Reviewer probe.** That a faulted store can never produce `none_open`.

### F11 — entry flow: delete the size parse, quote the size beside the field

**Files:** `pages/ticker/widgets/ai-rec/prefill.ts` (delete `parseQty`, drop `qty` from
`recToPrefill`) · `features/trading/tradeEntry/TradeEntryDialogView.tsx` (size text beside the
quantity field, cap annotation from props) · `features/trading/model/captureDigest.ts` +
`model/types.ts` (`EntryContextDigest` gains `risk_block_present: boolean | null`) ·
`ai-rec.risk.spec.tsx` (replace the `parseQty` assertions).

The dialog receives the verdict token and the two numbers as **already-rendered props** and contains
no cap computation. A rec with no size shows `size not suggested` — a distinct literal from
`not set` — and the quantity field still opens at the dialog's default of `1`.

**Verify.** `npx nx test @convexa/dashboard -- "TradeEntryDialog|ai-rec"`, exit 0.
**Commit.** `feat(dashboard): rec size is displayed beside the quantity field, never into it`
**Reviewer probe.** `rg -n "position_size" apps/dashboard/src` must show display sites only — no
`match`, `parseInt`, `parseFloat` or `Number(` anywhere near it.

### F12 — AC-29a: the account-size exclusion, two arms

**Files:** `features/trading/outcomes/boundaries.spec.ts` (extend the shipped mutation-guarded
`?raw` scan, which already globs `features/trading/**` at :122-126).

- **Behavioural arm:** a rec produced under a risk block → accepted into a position → closed into the
  ledger → the ledger **export's serialized form** contains no account-size value.
- **Source arm:** over `TRADING_SOURCES`, no production module writes an account-size value into a
  ledger or decision record — assert no `account_size` / `accountSize` / `risk_account_size`
  identifier appears in an object literal assigned into a `DecisionRecord`/ledger shape, with the
  same anti-vacuity assertion the existing scan uses (a mutated source string **must** match).

Note for the implementer: `features/trading/model/captureDigest.ts` **does** exist (SPEC §2.6's
parenthetical says otherwise; the enforceable subject named in that row —
`features/trading/**` under the boundary scan — is unaffected and covers it). The F11 flag lands in
that file, so the source arm must cover it and must not be narrowed to `outcomes/`.

**Verify.** `npx nx test @convexa/dashboard -- boundaries`, exit 0.
**Commit.** `test(dashboard): AC-29a — no account size in any persisted client artifact`

### F13 — design, a11y and typecheck sweep

**Files:** none new — run and fix.

`npx nx test @convexa/dashboard -- "hex-discipline|single-motion-moment|type-floor"` (each must pass
with **no new exemption entry**), a 393px no-overflow assertion for the rec panel, the Settings
`Risk inputs` panel and the drawer, ≥44px targets, then `npm run typecheck` and
`npx nx format:write --files <only the files this feature touched>`.

**Commit.** `style(dashboard): design-canon sweep for the rec-input surfaces`

---

## Track V — verification

Every step names its command and what "pass" looks like. **Judge exit codes, not printed
summaries.** Record each result in
`.spire/clusters/tech/contracts/tradeable-rec-inputs/verification-notes.md`.

**V0 — baselines (run BEFORE any edit, on a clean tree).**
```powershell
npx nx test api            ; "api exit=$LASTEXITCODE"
npx nx test @convexa/dashboard ; "dash exit=$LASTEXITCODE"
npm run typecheck          ; "tsc exit=$LASTEXITCODE"
```
Record: the Rust `test result: ok. N passed` for each of `api-rust` and `quant-engine`, the Vitest
`Tests  N passed (N)` and file count, and all three exit codes = 0. Every later expectation is
"baseline + the deltas this plan adds"; a baseline that is not green is a STOP.

**V1 — engine unit suites.** `cargo test -p quant-engine` → baseline + 18 (B1 7, B2 9, B3 2), exit 0.

**V2 — Rust build under the production feature (mandatory, separate).**
`cargo check -p api-rust --features postgres` → exit 0. Then
`cargo clippy -p api-rust -p quant-engine --all-targets` → **zero new warnings in the modules this
pass added** (the repo's standing bar).

**V3 — backend suites.** `npx nx test api` → baseline + ~45, exit 0. Individually confirm the five
poison guards go red when poisoned and green otherwise:
`cargo test -p api-rust --test score_identity` · `--test candidate_isolation` ·
`cargo test -p quant-engine candidates::tests::raising_a_ceiling` ·
`cargo test -p api-rust llm::tests::widening_the_restriction` ·
`npx nx test @convexa/dashboard -- boundaries`.

**V4 — frontend suites.** `npx nx test @convexa/dashboard` → baseline + ~70, exit 0.

**V5 — typecheck.** `npm run typecheck` → exit 0. (A green Vitest run proves nothing here.)

**V6 — lint + format check.** `npm run lint` → exit 0;
`npx nx format:check --files <touched files>` → exit 0. **Never a bare `nx format:write`.**

**V7 — the §7 pre-commit measurement (schedule: after B18 lands, before V8).**
One **evening** run (post-16:00 ET, ideally 20:00–23:00 ET) and one RTH run, on SPY and one thin
single-name from `apps/api/config/universe.json`:
```powershell
$env:MASSIVE_API_KEY="<key>"; cargo run -p api-rust -- quote-fill --tickers SPY,<thin> --json
```
Record all three count families (whole chain · band ∩ window · the 64-record candidate set), with
vendor-null counted separately from filtered-zero, plus the §7.2 raw-row key dump. Then apply the
**pre-committed** response — do not re-decide it:
- candidate-set fill healthy at night ⇒ ship as designed;
- near-zero at night, healthy in RTH ⇒ add the evening fixture
  (`quant-engine/src/candidates.rs::evening_chain_all_no_quote`) and record the scope fact; the
  design is unchanged;
- near-zero in RTH too ⇒ **STOP and escalate to the owner** (SPEC §9.1 scope escalation);
- a per-row quote timestamp present ⇒ note it as a like-for-like follow-up; **do not** implement it
  here;
- assembled prompt over budget ⇒ cut strikes per (tenor, right): 2×2×4, then 2×2×3; owner only if
  2×2×3 still does not fit; **never** fall back to one tenor.

**V8 — live interface conformance (never on :8000 — an orphan serves stale code there).**
```powershell
npm run ports:free 8000 4200 4300 8010
$env:HTTP_BIND="127.0.0.1:8010"; $env:MASSIVE_API_KEY="<key>"; cargo run -p api-rust -- serve
# second shell — obtain a session first:
curl -i -X POST http://127.0.0.1:8010/api/auth/signup -H "content-type: application/json" `
  -d '{"email":"conf+<run>@example.test","password":"<12+ chars>"}'   # read gf_session from Set-Cookie
node .claude/tools/interface_conformance.mjs `
  --contract .spire/clusters/tech/contracts/tradeable-rec-inputs/INTERFACE_CONTRACT.md `
  --url http://127.0.0.1:8010 `
  --auth-cookie gf_session=<value> `
  --report .spire/clusters/tech/contracts/tradeable-rec-inputs/conformance-receipt.json
```
Pass = exit 0 and a receipt with `"verdict": "PASS"` covering all four endpoints. **Exit 2 without
`--auth-cookie` is a configuration error, not a FAIL** (INTERFACE "Running this contract") — supply
a cookie and re-run. Endpoint order in the block is load-bearing: `/api/ticker/{ticker}` runs first
and warms the snapshot the candidates read then serves off.

**V9 — the shapes outside the machine-checkable block.** `PUT /api/auth/settings` and
`POST /api/recommendation/{ticker}` are asserted by the build's own tests (V3), plus one manual
signed-in round trip against `:8010`: save a risk block, request a rec, and confirm the response
carries `sent.risk_inputs`, `cap_check.verdict`, `field_reasons` and `cited_contract`. A conformance
run must never spend the daily cap or a provider key — this step is deliberate and manual.

**V10 — AC-89, the before/after verdict comparison (ship condition).** Across **at least five named
tickers including one after-hours run**, record the pre-feature and post-feature verdicts, list every
`no_trade` → trade flip with the input the rec cited for the change, and hand it to the owner for
review. Write it to
`.spire/clusters/tech/contracts/tradeable-rec-inputs/before-after-verdicts.md`. The binding framing
is the yardstick: better inputs should mostly make `no_trade` **better-argued**, not convert it to
trades — a flip rate that looks like conversion is a finding, not a pass.

**V11 — the `review` sweep + final green.** Walk SPEC §3's `review` rows on a running app at 393px
and at desktop (AC-10, AC-17, AC-28, AC-33, AC-34, AC-40, AC-44, AC-45, AC-62, AC-91, AC-96), then:
```powershell
npm run ci     ; "ci exit=$LASTEXITCODE"
```
Pass = exit 0 for the whole chain (lint → typecheck → test → build → check:bundle).

---

## Ship-blocking AC coverage

| AC | Built by | Proven by |
|---|---|---|
| AC-7 (band empty vs assembly failure) | B2, B6 | `cargo test -p quant-engine candidates`; V8 |
| AC-15 (risk block round-trips) | B8, B9, F5 | `-- riskInputs`; V8 (`/api/auth/settings`) |
| AC-24 (server-enforced write gate) | B9 | `cargo test -p api-rust` gate test; V9 |
| AC-27 (no risk block still yields a rec) | B12, B16, F4 | `field_reasons` + `-- literals` |
| AC-29a (no account size persisted) | F11, F12 | `-- boundaries` (both arms) |
| AC-38 (`none_open` is stated) | F10 | `-- digest` |
| AC-45 (visible basis + advisory) | F3, F6 | `-- StraddleMove`; V11 |
| AC-49 (wide-quote marker + threshold) | B1 | `cargo test -p quant-engine straddle` |
| AC-58a (no cap surface on `no_trade`) | B11, F4, F7 | `cap_check` fixtures; `-- ai-rec` |
| AC-66 (liquidity line on every verdict) | B6, F8 | `-- NumbersSaid` |
| AC-83 (score byte-identity, both branches) | B4, B5 | `--test score_identity` (+ poison) |
| AC-89 (before/after comparison) | — | V10, owner review |
| AC-90 (egress note truth) | B17, F3 | export tests + copy-parity test |

## Flags for the conductor

1. **`captureDigest.ts` does exist** at `apps/dashboard/src/app/features/trading/model/captureDigest.ts`,
   contrary to SPEC §2.6's parenthetical. This does not change the enforcement subject (the boundary
   scan globs `features/trading/**`), it **widens** it: F11's `risk_block_present` flag lands in that
   file and F12's source arm must cover it. Recorded here rather than worked around.
2. **`max_bytes`, `WIDE_QUOTE_THRESHOLD_PCT`, `SPREAD_TIGHT_PCT` and `MOVE_DTE_FLOOR` are planner
   choices**, not spec values (the spec leaves the numbers to the build). Each rides the payload and
   each is a single `const`. V7 may revise the prompt byte ceiling by the pre-committed ladder only.
3. **The `:8000` orphan** is a standing repo hazard (`CLAUDE.md`); V8 serves on `:8010` deliberately.
   If a run must use `:8000`, `npm run ports:free` first and re-verify the served build.
