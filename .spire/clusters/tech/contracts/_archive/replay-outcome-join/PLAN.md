# replay-outcome-join — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking. Execute from the workspace root. Keep this plan at
> `.spire/clusters/tech/contracts/replay-outcome-join/PLAN.md`.

**Goal:** Ship a third research CLI (`replay-outcome-join` / `ReplayOutcomeJoin` /
`cmd_replay_outcome_join`) that joins batch-backtest replayed scores to forward stock-bar labels
(`1d`/`5d`) and writes a dated measurement artifact — zero Options, Authorizes: nothing, no
trader UI.

**Architecture:** Thin clap command in `apps/api/src/main.rs` + pure join module
`apps/api/src/services/research/replay_outcome_join.rs`. Happy path: load
`BatchBacktestArtifact` wrapper via required `--replay` → optional snapshot-keyed `--labels`
(or Stocks `MarketDataPort::daily_bars` fill) → closed join dispositions (incl. `no_p0`) →
ranking rates under score-lab `large_abs_move` → dated report under `data/research/`. Same ship
adds one field `display_spot` on producer `ReplayedMeasurement`. Does not fold into `score-lab`
or `batch-backtest`. Existing `/api/_research/chain-snapshots/*` unchanged and never called.

**Tech stack:** Rust (`apps/api`, crate `api-rust`); clap 4; `chrono` RFC3339; `serde_json`
artifact. Reuse live: `join_sample_outcomes` / `LABEL_VERSION_V1` / `session_date_et`
(`outcomes.rs`), `as_of_key` ms bucket + `session_dates_of` (`pairing.rs`),
`LabelRule::MedianAbsMove` / `LABELS` (`labels.rs`), `man_whitney_auc` /
`top_decile_precision_recall` / `percentile_sorted` (`stats.rs`), `MetricState` /
`ROW_FLOOR` / `SESSION_FLOOR` (`vocabulary.rs`), producer literals
`miss_line` / `empty_book_line` / `unreadable_line` / `compute_failed_line`
(`batch_backtest.rs`). Frontend: `NO_UI_CHANGE` — structural Vitest only.

**Spec:** `.spire/clusters/tech/contracts/replay-outcome-join/SPEC.md` (owner-approved 2026-08-18)
**Interface:** `.spire/clusters/tech/contracts/replay-outcome-join/INTERFACE_CONTRACT.md`
**Decisions:** `.spire/clusters/tech/contracts/replay-outcome-join/council/decisions.md`

---

## Track map

| Track | Tasks | Ownership |
|---|---:|---|
| **Backend** (`apps/api`) | **B1 → B10** (strict order inside the track) | Main product surface |
| **Frontend** (`apps/dashboard` + Pages) | **F1** | `NO_UI_CHANGE` structural only |
| **Verification** | **V1 → V5** after B10 + F1 | Read-only gates |

**Parallelism:** Backend and Frontend tracks are independently executable. Verification runs after
both land.

---

## Global Constraints

Every task's requirements implicitly include this section.

**Standing project constraints (each has bitten this repo):**

- **`nx typecheck` is mandatory before any green claim on TS.** Vitest / cargo green ≠ FE types sound.
- **Check EXIT CODES, not printed summaries.** PowerShell: `$LASTEXITCODE` after every gate command.
- **`nx format:write` must ALWAYS be scoped with `--files=`.** Never bare.
- **Never write a literal NUL byte.**
- **Cite live Rust only** (`batch_backtest.rs`, `outcomes.rs`, `pairing.rs`, `labels.rs`,
  `cmd_join_outcomes`, `cmd_score_lab`, `cmd_batch_backtest`) — not Python-era assumptions.
- **Do not edit** `SPEC.md`, `INTERFACE_CONTRACT.md`, or other feature folders.
- **Never `git stash`** while other sessions may hold uncommitted work.

**Feature hard rules (settled — do not re-open):**

- **D1=A:** paired returns use capture-time `display_spot` as `p0`. Session-close is **not** a
  silent fallback. Missing / non-finite / ≤0 spot on a `replayed` row → first-class `no_p0`.
- **D-kpi:** primary family = score-lab `large_abs_move` (`LabelRule::MedianAbsMove`, median once
  over the full paired set for that horizon). Optional cheap secondaries `up_move` /
  `structure_event`. No go/no-go chrome. No new KPI names.
- **D-empty-pairs:** `counts.paired == 0` → honest degraded counts + Authorizes; **no** dated
  measurement file (default path or `--out`); `--json` may emit counts-only
  `measurement: false` with **no** `rates`; exit 0 for honest empty.
- **T0a:** `empty_book` = market-empty stored book only; never collapse with `unreadable` /
  `compute_failed`.
- **T0b:** Inputs/provenance names the **actual** label source (pinned `--labels` path and/or
  Stocks fill when that run fetched). Never a fixed “Stocks aggs” claim on a hermetic run.
- **T0c / AC-5a:** every printed rate carries horizon, `n_paired`, `n_sessions` (ET via
  `session_dates_of`), window/corpus identity, label rule/threshold/`label_version`, and
  locked `p0_basis` = capture-time underlying. Withhold the rate if any field is missing.
- **`--replay` required.** Load the live `BatchBacktestArtifact` envelope (`rows[]` inside the
  wrapper). Never `from_slice::<Vec<_>>` of bare rows.
- **Zero Options** on `cmd_replay_outcome_join`: no resolve/fetch-chain/Options snapshot/
  `compute_analytics_from_vendor` / Massive Options client. Stocks `daily_bars` only when
  labels missing.
- **`--labels` present ⇒ zero Stocks I/O.**
- **`NO_UI_CHANGE`:** no trader chrome; frontend track is structural only.
- **Authorizes: nothing** on live score / tier / gate / fingerprint / weight.
- **Sibling CLIs untouched** as separate entrypoints (`score-lab`, `batch-backtest`,
  `join-outcomes`).
- **Cardinality:** one attempted join-row = one `(symbol, as_of, horizon)`. Producer
  carry-through + `no_p0` explode once per evaluated horizon.
  `attempted = paired + no_snapshot + empty_book + unreadable + compute_failed + no_p0 + no_label`.

**Owner-locked planner pins (S2 Important residuals — settled, not GATE Z):**

1. **P-replay-envelope** — `--replay` loads the live `BatchBacktestArtifact` wrapper (`rows[]`).
   A valid `replayed` row missing positive finite `display_spot` (including every pre-additive
   artifact) is per-row `no_p0`, **not** file-unreadable. AC-32 `<reason>` is omitted / empty
   when the producer did not persist a reason (`ResearchRow.note` is `#[serde(skip)]` — loaded
   files never carry notes).
2. **P-keyspace-universe** — AC-34 key-space miss = zero intersection with **replayed** row
   identities (SPEC §2). An all-degraded `--replay` (no `replayed` rows) plus a snapshot-keyed
   `--labels` file is a **hard CLI error**, not AC-12 honest-empty success. Align “labels share
   no identities with replay corpus” to that **replayed** universe.

### Conformance spec

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/_research/chain-snapshots/{symbol}",
      "path_params": { "symbol": "SPY" },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "snapshots": "array",
        "snapshots[].symbol": "string",
        "snapshots[].as_of": "string",
        "snapshots[].source": "string",
        "store": "string",
        "detail": "string|null",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/chain-snapshots/{symbol}",
      "path_params": { "symbol": "ZZZZNOPE" },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "snapshots": "array",
        "store": "string",
        "detail": "string",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/chain-snapshots/{symbol}/snapshot",
      "path_params": { "symbol": "ZZZZNOPE" },
      "query": { "as_of": "2000-01-01T00:00:00.000000000Z" },
      "expect_status": 404,
      "required": {
        "error": "string",
        "detail": "string",
        "symbol": "string",
        "store": "string",
        "vendor_called": "boolean"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/chain-snapshots/{symbol}/snapshot",
      "path_params": { "symbol": "SPY" },
      "query": { "as_of": "1970-01-01T00:00:00.000000001Z" },
      "expect_status": 200,
      "required": {
        "symbol": "string",
        "as_of": "string",
        "source": "string",
        "store": "string",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "market": "object",
        "market.ticker": "string",
        "market.synchronized_spot": "number",
        "market.current_spot": "number",
        "market.timestamp": "number",
        "market.atm_iv": "number",
        "market.atm_iv_expiration": "string|null",
        "market.atm_iv_dte": "number|null",
        "market.market_phase": "string",
        "market.contracts": "array",
        "daily_bars": "array",
        "minutes": "array",
        "trades": "array"
      }
    }
  ]
}
```

**Baselines:**

| Check | Expectation |
|---|---|
| `cargo test -p api-rust -- replay_outcome_join` | exit 0; named ACs covered |
| `cargo test -p api-rust --test replay_outcome_join_cli` | exit 0 |
| `cargo test -p api-rust --test replay_outcome_join_isolation` | exit 0 |
| `npx nx test api` / `cargo test -p api-rust -p quant-engine` | exit 0 |
| `npx nx test @convexa/dashboard --testPathPattern=replay-outcome-join` | exit 0 (F1) |
| `npx nx typecheck @convexa/dashboard` | exit 0 |
| `interface_conformance` against Global Constraints block | PASS (or UNVERIFIABLE only on hit-probe seed failure) |
| `git diff --name-only -- apps/dashboard` | only the F1 structural spec (no product UI) |
| `score-lab --help` / `batch-backtest --help` / `join-outcomes --help` | all still present; join is a **separate** subcommand |

---

## File ownership

| Path | Change |
|---|---|
| `apps/api/src/services/research/batch_backtest.rs` | Add `display_spot` on `ReplayedMeasurement`; populate from `snap.display_spot` on replayed rows; keep existing literals reusable |
| `apps/api/src/services/research/pairing.rs` | Export `as_of_key` as `pub` (single ms-bucket definition) |
| `apps/api/src/services/research/replay_outcome_join.rs` | **Create** — load view, dispositions, join, rates, emit, fill helpers |
| `apps/api/src/services/research/mod.rs` | `pub mod replay_outcome_join;` |
| `apps/api/src/main.rs` | Add `Commands::ReplayOutcomeJoin` + `cmd_replay_outcome_join` + body-scan tests |
| `apps/api/tests/replay_outcome_join_cli.rs` | **Create** — hermetic integration harness |
| `apps/api/tests/replay_outcome_join_isolation.rs` | **Create** — source scans (no Options / no HTTP research / siblings intact / NO_UI path) |
| `apps/dashboard/src/app/replay-outcome-join.structural.spec.ts` | **Create** — NO_UI_CHANGE + Pages 404 non-regression |
| `functions/api/[[path]].ts` | **No change** (re-asserted by F1) |
| `apps/dashboard` product UI | **No change** |

**Do not touch:** `cmd_score_lab` / `cmd_join_outcomes` behavior (except shared pure helpers that stay
backward-compatible), serve `open_chain_snapshot_store`, trader routes, score/tier/fingerprint
math, capture append path, research HTTP handler envelopes, `DESIGN_SYSTEM.md`.

---

## Backend track

### B1 — Producer seam: `display_spot` on `ReplayedMeasurement`

**Files:** `apps/api/src/services/research/batch_backtest.rs`; existing unit tests in that module;
`apps/api/tests/batch_backtest_cli.rs` (extend only if a fixture construct breaks)

**Why:** AC-27; D1=A; same-ship producer additive. Pre-additive artifacts remain loadable; missing
spot becomes join `no_p0` (P-replay-envelope), not a producer hard fail.

- [ ] **Step 1: failing test** in `batch_backtest.rs` `#[cfg(test)]`:

```rust
#[test]
fn replayed_measurement_carries_positive_display_spot() {
    let m = sample_measurement();
    assert!(m.display_spot.is_finite() && m.display_spot > 0.0);
    let v = serde_json::to_value(&m).unwrap();
    assert!(v.get("display_spot").and_then(|x| x.as_f64()).unwrap() > 0.0);
}
```

Update `sample_measurement()` / every `ReplayedMeasurement { ... }` literal in this file to
include `display_spot: 100.0` (or the fixture spot in use). Run
`cargo test -p api-rust batch_backtest -- --nocapture` → FAIL (missing field).

- [ ] **Step 2: implement minimally**

```rust
#[derive(Debug, Clone, Serialize)]
pub struct ReplayedMeasurement {
    pub opportunity_score: i32,
    pub opportunity_tier: String,
    pub net_gex: f64,
    pub call_wall: f64,
    pub put_wall: f64,
    pub gamma_flip: f64,
    pub contract_count: usize,
    /// Capture-time underlying used at Path-B compute; join `p0` (D1=A).
    pub display_spot: f64,
}
```

In the `ResearchRow::replayed(...)` construction site inside the replay path (~line where
`ReplayedMeasurement { opportunity_score: score, ... }` is built), set:

```rust
display_spot: snap.display_spot,
```

Do **not** fall back to `gex_spot` or session-close. If `snap.display_spot` is non-finite or ≤0,
still persist the numeric value (join will classify `no_p0`); do not invent a substitute.

- [ ] **Step 3:** PASS. Commit: `feat(batch-backtest): persist capture display_spot on replayed rows`.

**Reviewer probe:** a pre-additive JSON fixture without `display_spot` must still deserialize in
B2’s load view as missing/default and become `no_p0` — not unreadable.

---

### B2 — Load view + RFC3339→ms adapter + key-space miss

**Files:** `apps/api/src/services/research/replay_outcome_join.rs` (**create**);
`apps/api/src/services/research/mod.rs`; `apps/api/src/services/research/pairing.rs`

**Why:** P-replay-envelope; AC-34 / P-keyspace-universe; pairing adapter (SPEC §2).
`AggregatesValue` has custom Serialize without Deserialize — do **not** force full
`BatchBacktestArtifact` Deserialize. Load a wrapper view that requires `rows[]`.

- [ ] **Step 1: export the ms bucket** in `pairing.rs`:

```rust
/// Millisecond bucket — mirrors `score_lab.rs::as_of_key` exactly.
pub fn as_of_key(as_of: f64) -> u64 {
    (as_of * 1000.0).round() as u64
}
```

(Change `fn as_of_key` → `pub fn as_of_key`; keep body identical.)

- [ ] **Step 2: create module + failing tests**

```rust
// apps/api/src/services/research/mod.rs — add:
pub mod replay_outcome_join;
```

```rust
//! Paid-book replay × forward-label measurement (research CLI).
//! Pure join + report assembly — I/O stays in `cmd_replay_outcome_join`.

use crate::services::research::batch_backtest::RowDisposition as ProducerDisposition;
use crate::services::research::pairing::as_of_key;
use crate::services::research::StructureOutcome;
use chrono::{DateTime, Utc};
use serde::Deserialize;
use std::collections::HashSet;
use std::path::Path;

pub const KEYSPACE_MISS_LINE: &str = "labels share no identities with replay corpus";
pub const AUTHORIZES_NOTHING: &str = "nothing";
pub const STANDING_TITLE: &str =
    "RESEARCH JOIN — REPLAYED SCORES × FORWARD LABELS · NOT LIVE";
pub const CLOSING_LINE: &str =
    "RESEARCH JOIN — NOT LIVE · Authorizes: nothing on the live score path.";
pub const GENRE: &str = "paid-book replay + forward-label measurement";
pub const P0_BASIS: &str = "capture-time underlying (display_spot)";

/// Minimal deserialize view of the live `BatchBacktestArtifact` envelope.
#[derive(Debug, Clone, Deserialize)]
pub struct ReplayArtifactView {
    pub rows: Vec<ReplayRowView>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ReplayRowView {
    pub symbol: String,
    pub as_of: String,
    #[serde(default)]
    pub source: String,
    pub disposition: ProducerDisposition,
    #[serde(flatten, default)]
    pub measurement: Option<ReplayMeasurementView>,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ReplayMeasurementView {
    pub opportunity_score: Option<i32>,
    pub opportunity_tier: Option<String>,
    pub net_gex: Option<f64>,
    pub call_wall: Option<f64>,
    pub put_wall: Option<f64>,
    pub gamma_flip: Option<f64>,
    pub contract_count: Option<usize>,
    /// Absent on every pre-additive artifact → treated as missing spot.
    #[serde(default)]
    pub display_spot: Option<f64>,
}

pub fn load_replay_artifact(path: &Path) -> anyhow::Result<ReplayArtifactView> {
    let bytes = std::fs::read(path)
        .map_err(|e| anyhow::anyhow!("unreadable --replay file: {e}"))?;
    // Reject bare arrays: must be the wrapper envelope with rows[].
    let v: serde_json::Value = serde_json::from_slice(&bytes)
        .map_err(|e| anyhow::anyhow!("unreadable --replay file: {e}"))?;
    if v.is_array() {
        anyhow::bail!("unreadable --replay file: expected BatchBacktestArtifact object with rows[]");
    }
    serde_json::from_value(v)
        .map_err(|e| anyhow::anyhow!("unreadable --replay file: {e}"))
}

pub fn rfc3339_to_as_of_secs(as_of: &str) -> anyhow::Result<f64> {
    let dt = DateTime::parse_from_rfc3339(as_of)
        .map_err(|e| anyhow::anyhow!("bad as_of RFC3339 '{as_of}': {e}"))?
        .with_timezone(&Utc);
    Ok(dt.timestamp() as f64 + f64::from(dt.timestamp_subsec_nanos()) / 1e9)
}

pub fn replayed_identity_keys(rows: &[ReplayRowView]) -> anyhow::Result<HashSet<(String, u64)>> {
    let mut out = HashSet::new();
    for r in rows {
        if r.disposition != ProducerDisposition::Replayed {
            continue;
        }
        let secs = rfc3339_to_as_of_secs(&r.as_of)?;
        out.insert((r.symbol.to_ascii_uppercase(), as_of_key(secs)));
    }
    Ok(out)
}

pub fn label_identity_keys(labels: &[StructureOutcome]) -> HashSet<(String, u64)> {
    labels
        .iter()
        .map(|o| (o.symbol.to_ascii_uppercase(), as_of_key(o.as_of)))
        .collect()
}

/// AC-34 / P-keyspace-universe: when `--labels` is present, require non-empty intersection
/// with **replayed** identities.
pub fn assert_labels_keyspace(
    replay_rows: &[ReplayRowView],
    labels: &[StructureOutcome],
) -> anyhow::Result<()> {
    let replayed = replayed_identity_keys(replay_rows)?;
    let label_keys = label_identity_keys(labels);
    if replayed.is_empty() || replayed.is_disjoint(&label_keys) {
        anyhow::bail!("{KEYSPACE_MISS_LINE}");
    }
    Ok(())
}
```

Also add `Deserialize` to producer `RowDisposition` in `batch_backtest.rs`:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RowDisposition { /* unchanged variants */ }
```

Failing tests in `replay_outcome_join.rs` `#[cfg(test)]`:

```rust
#[test]
fn rejects_bare_rows_array() {
    let dir = tempfile();
    let p = dir.join("bare.json");
    std::fs::write(&p, r#"[{"symbol":"SPY","as_of":"1970-01-01T00:00:00.000000001Z","disposition":"replayed"}]"#).unwrap();
    assert!(load_replay_artifact(&p).is_err());
}

#[test]
fn loads_wrapper_rows_and_missing_display_spot_is_none() {
    let dir = tempfile();
    let p = dir.join("wrap.json");
    std::fs::write(&p, r#"{"rows":[{"symbol":"SPY","as_of":"1970-01-01T00:00:00.000000001Z","source":"fixture","disposition":"replayed","opportunity_score":40,"opportunity_tier":"dormant","net_gex":1.0,"call_wall":100.0,"put_wall":90.0,"gamma_flip":95.0,"contract_count":10}]}"#).unwrap();
    let art = load_replay_artifact(&p).unwrap();
    assert_eq!(art.rows.len(), 1);
    assert!(art.rows[0].measurement.as_ref().unwrap().display_spot.is_none());
}

#[test]
fn keyspace_miss_when_no_replayed_rows_even_with_labels() {
    let rows = vec![ReplayRowView {
        symbol: "SPY".into(),
        as_of: "1970-01-01T00:00:00.000000001Z".into(),
        source: String::new(),
        disposition: ProducerDisposition::Missing,
        measurement: None,
    }];
    let labels = vec![/* one StructureOutcome at same clock — still miss because universe is replayed */];
    // construct a StructureOutcome with as_of matching; assert_labels_keyspace must Err with KEYSPACE_MISS_LINE
}
```

- [ ] **Step 3:** implement until PASS. Commit:
  `feat(replay-outcome-join): load BatchBacktestArtifact rows view + keyspace guard`.

**Reviewer probe:** all-degraded replay + matching label clocks → hard error (P-keyspace-universe),
not AC-12 success.

---

### B3 — Join dispositions + row / counts types

**Files:** `apps/api/src/services/research/replay_outcome_join.rs`

**Why:** AC-8–11, AC-32/33; `[absent-is-not-none]` enforced in a type.

- [ ] **Step 1: failing tests** for enum serde + reconciliation invariant.

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JoinDisposition {
    Paired,
    NoSnapshot,
    EmptyBook,
    Unreadable,
    ComputeFailed,
    NoP0,
    NoLabel,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct JoinCounts {
    pub attempted: usize,
    pub paired: usize,
    pub no_snapshot: usize,
    pub empty_book: usize,
    pub unreadable: usize,
    pub compute_failed: usize,
    pub no_p0: usize,
    pub no_label: usize,
}

impl JoinCounts {
    pub fn tally(&mut self, d: JoinDisposition) {
        self.attempted += 1;
        match d {
            JoinDisposition::Paired => self.paired += 1,
            JoinDisposition::NoSnapshot => self.no_snapshot += 1,
            JoinDisposition::EmptyBook => self.empty_book += 1,
            JoinDisposition::Unreadable => self.unreadable += 1,
            JoinDisposition::ComputeFailed => self.compute_failed += 1,
            JoinDisposition::NoP0 => self.no_p0 += 1,
            JoinDisposition::NoLabel => self.no_label += 1,
        }
    }

    pub fn reconciles(&self) -> bool {
        self.attempted
            == self.paired
                + self.no_snapshot
                + self.empty_book
                + self.unreadable
                + self.compute_failed
                + self.no_p0
                + self.no_label
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct JoinRow {
    pub symbol: String,
    pub as_of: String,
    pub session_date: String,
    pub horizon: String,
    pub disposition: JoinDisposition,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opportunity_score: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opportunity_tier: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_spot: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ret_simple: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ret_log: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub abs_move: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hit_call_wall: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hit_put_wall: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub crossed_flip: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bars_source: Option<String>,
    /// Operator reason — empty/omitted when producer did not persist one (P-replay-envelope).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}
```

Operator literals (reuse producer helpers where possible):

```rust
pub fn no_p0_line(symbol: &str, as_of: Option<&str>) -> String {
    match as_of {
        Some(ts) => format!("no capture-time spot for {symbol} at {ts}"),
        None => format!("no capture-time spot for {symbol}"),
    }
}

pub fn no_label_line(symbol: &str, horizon: &str, extra: Option<&str>) -> String {
    match extra {
        Some(e) if !e.is_empty() => {
            format!("no label for {symbol} at horizon {horizon}: {e}")
        }
        _ => format!("no label for {symbol} at horizon {horizon}"),
    }
}
```

Map producer → join disposition (before labels):

| Producer | Join |
|---|---|
| `missing` | `no_snapshot` |
| `empty_book` | `empty_book` |
| `unreadable` | `unreadable` |
| `compute_failed` | `compute_failed` |
| `replayed` + usable spot | (continue to label join) |
| `replayed` + missing/non-finite/≤0 spot | `no_p0` |

Usable spot predicate:

```rust
pub fn usable_display_spot(m: &ReplayMeasurementView) -> Option<f64> {
    m.display_spot
        .filter(|s| s.is_finite() && *s > 0.0)
}
```

- [ ] **Step 2:** PASS unit tests that (a) explode one `missing` across `1d,5d` →
  `attempted=2`, `no_snapshot=2`; (b) literals are textually distinct. Commit:
  `feat(replay-outcome-join): closed join dispositions + counts`.

**Reviewer probe:** poison a count so `attempted != Σ(degraded)+paired` — test must fail.

---

### B4 — Pure join assembly

**Files:** `apps/api/src/services/research/replay_outcome_join.rs`

**Why:** AC-1, AC-8–11, AC-33; classify `no_p0` **before** `join_sample_outcomes` (that helper
returns empty `Vec` on missing price — must not be rewritten as `no_label`).

- [ ] **Step 1: failing tests** covering mixed fixture dispositions.

```rust
pub struct JoinInput<'a> {
    pub replay: &'a [ReplayRowView],
    pub labels: &'a [StructureOutcome],
    pub horizons: &'a [&'a str],
}

pub fn join_rows(input: JoinInput<'_>) -> anyhow::Result<(Vec<JoinRow>, JoinCounts)> {
    // 1. Index labels by (symbol, as_of_ms, horizon_lower).
    // 2. For each replay row × each horizon:
    //    - map producer carry-through → JoinRow (reason empty for loaded artifacts)
    //    - replayed: usable_display_spot? else no_p0
    //    - look up label; miss → no_label
    //    - hit → paired with score + label fields
    // 3. Stable sort by (symbol, as_of, horizon)
    // 4. Tally counts; debug_assert reconciles()
}
```

Label index key = `(symbol.to_ascii_uppercase(), as_of_key(outcome.as_of), horizon.to_ascii_lowercase())`.
Replay side converts `row.as_of` via `rfc3339_to_as_of_secs` then `as_of_key`.

For `session_date` on every join row, use
`session_dates_of(std::iter::once(secs)).into_iter().next()` (ET), falling back to empty string
only if parse fails (should not — hard-fail earlier on bad RFC3339 in load/join entry).

Carry score fields only when producer was `replayed` (including `no_p0` / `no_label` rows that
still had a measurement).

- [ ] **Step 2:** implement until PASS. Commit:
  `feat(replay-outcome-join): pure join with no_p0-before-label`.

**Reviewer probe:** feed a `replayed` row with `display_spot: null` and a matching label — must be
`no_p0`, never `paired` / `no_label`.

---

### B5 — Ranking rates + T0c assumption fields

**Files:** `apps/api/src/services/research/replay_outcome_join.rs`

**Why:** AC-2, AC-3, AC-5a, AC-6, AC-25; D-kpi; MetricState honesty floors.

- [ ] **Step 1: failing tests** for median-once threshold, assumption presence, 5d not-omitted.

```rust
#[derive(Debug, Clone, Serialize)]
pub struct RateBlock {
    pub family: String,
    pub metric: String,
    pub horizon: String,
    pub n_paired: usize,
    pub n_sessions: usize,
    pub window: String,
    pub label_rule: String,
    pub threshold: Option<f64>,
    pub label_version: String,
    pub p0_basis: String,
    /// Present when computable; omit / use explicit not-computable sibling when absent.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

pub fn build_rates(
    paired: &[JoinRow],
    horizons: &[&str],
    corpus_window: &str,
) -> Vec<RateBlock> {
    // For each horizon independently:
    //   let rows_h = paired where horizon matches && abs_move finite && score present
    //   n_paired = rows_h.len()
    //   n_sessions = session_dates_of(rows_h as_of secs).len()
    //   if n_paired == 0 → emit not-computable RateBlock(s) with reason (AC-3), still naming horizon
    //   threshold = percentile_sorted(abs_moves, 0.5) once
    //   label bools via LabelRule::MedianAbsMove (abs_move >= threshold)
    //   metrics: auc (man_whitney_auc), lift_top_decile, precision_top_decile
    //   if n_paired < ROW_FLOOR || n_sessions < SESSION_FLOOR → MetricState::UnderMinimum honesty
    //   EVERY RateBlock must include the full T0c field set; if any cannot be supplied → withhold
}
```

Reuse:

```rust
use crate::services::research::labels::{LabelRule, LABELS};
use crate::services::research::outcomes::LABEL_VERSION_V1;
use crate::services::research::pairing::session_dates_of;
use crate::services::research::stats::{man_whitney_auc, percentile_sorted, top_decile_precision_recall};
use crate::services::research::vocabulary::{MetricState, ROW_FLOOR, SESSION_FLOOR};
```

Primary family key = `"large_abs_move"`. `label_rule` string =
`"abs_move >= median(abs_move) over the full paired set for this horizon"` (from `LABELS`).
`p0_basis` = `P0_BASIS`. Optional secondaries: if cheap, emit `up_move` / `structure_event`
blocks after primary; if wiring `opportunity_score × structure_event`, mark definitionally-coupled
via `MetricState` honesty (do not print a false-mandate AUC).

- [ ] **Step 2:** PASS. Commit: `feat(replay-outcome-join): large_abs_move rates with T0c fields`.

**Reviewer probe:** drop `p0_basis` from a rate JSON — AC-5a presence test must fail. Perfect
score/label alignment vs shuffled scores → distinguishable AUC (AC-25).

---

### B6 — Report emit (standing, zero-pair, provenance, `--json`)

**Files:** `apps/api/src/services/research/replay_outcome_join.rs`

**Why:** AC-4, AC-7, AC-12, AC-17, AC-18, AC-28, AC-30, AC-31; D-empty-pairs; T0b.

- [ ] **Step 1: define artifact + emit API**

```rust
#[derive(Debug, Clone, Serialize)]
pub struct JoinStanding {
    pub not_live: bool,
    pub corpus: String,
    pub framing: String,
    pub authorizes: String,
    /// Actual label source for THIS run (T0b).
    pub inputs: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct JoinCorpus {
    pub symbols: Vec<String>,
    pub window: String,
    pub n_attempted: usize,
    pub n_paired: usize,
    pub n_sessions: usize,
    pub run_stamp: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct JoinArtifact {
    pub standing: JoinStanding,
    pub authorizes: String,
    pub genre: String,
    pub horizons: Vec<String>,
    pub label_version: String,
    pub p0_basis: String,
    pub counts: JoinCounts,
    pub rows: Vec<JoinRow>,
    pub rates: Vec<RateBlock>,
    pub corpus: JoinCorpus,
}

pub fn measurement_identity_value(artifact: &JoinArtifact) -> serde_json::Value {
    let mut v = serde_json::to_value(artifact).expect("serialize");
    if let Some(obj) = v.get_mut("corpus").and_then(|c| c.as_object_mut()) {
        obj.remove("run_stamp");
    }
    v
}

pub enum EmitResult {
    /// paired ≥ 1 — durable file written (unless sink suppressed in tests)
    Measurement { artifact: JoinArtifact, path: PathBuf },
    /// paired == 0 — no file; optional counts-only JSON envelope
    HonestEmpty { counts: JoinCounts, envelope: serde_json::Value },
}

pub fn default_out_path(workspace_root: &Path, stamp: &str) -> PathBuf {
    workspace_root.join(format!("data/research/replay_outcome_join_{stamp}.json"))
}
```

Standing prose (exact SPEC §4):

```text
RESEARCH JOIN — REPLAYED SCORES × FORWARD LABELS · NOT LIVE
  Corpus:      <symbol / as_of span> · horizons <1d,5d or as run>
  Inputs:      replayed scores from stored snapshots · labels from <actual source for this run>
  Framing:     Measurement on books we already paid for. Not a live desk feed. Not Options API.
  Authorizes:  nothing. No live score, tier, gate, weight, or fingerprint change
               on the strength of this report.  [score-change-is-deliberate-and-measured]
```

Provenance helpers:

```rust
pub fn inputs_line(labels_path: Option<&Path>, stocks_fill_ran: bool) -> String {
    match (labels_path, stocks_fill_ran) {
        (Some(p), false) => format!(
            "replayed scores from stored snapshots · labels from pinned file {}",
            p.display()
        ),
        (None, true) => {
            "replayed scores from stored snapshots · labels from Stocks daily_bars fill".into()
        }
        (Some(p), true) => format!(
            "replayed scores from stored snapshots · labels from pinned file {} + Stocks daily_bars fill",
            p.display()
        ),
        (None, false) => {
            "replayed scores from stored snapshots · labels unavailable".into()
        }
    }
}
```

Zero-pair `--json` envelope:

```json
{
  "measurement": false,
  "paired": 0,
  "counts": { "...": "JoinCounts" },
  "authorizes": "nothing"
}
```

No `rates` key. Write **no** file to default path or `--out`.

Banned-phrase scan over emitted strings (AC-18 / AC-31): reuse the batch-backtest pattern —
reject `adopt`, `ship this weight`, `update the live score`, `winner ready for production`,
`● Live`, `live backtest`, plus `beats 0.467`.

- [ ] **Step 2:** tests for (a) paired≥1 writes file containing standing+rates+rows; (b) paired=0
  writes nothing; (c) second-run `measurement_identity_value` equality with pinned labels;
  (d) hermetic provenance does **not** contain `Stocks`. Commit:
  `feat(replay-outcome-join): emit measurement / honest-empty envelopes`.

**Reviewer probe:** force `paired=0` with `--out /tmp/x.json` — file must not exist afterward.

---

### B7 — Stocks fill + snapshot-keyed sidecar (when `--labels` absent)

**Files:** `apps/api/src/services/research/replay_outcome_join.rs`; thin I/O in
`cmd_replay_outcome_join` (B8)

**Why:** AC-14–16; corpus-covering window; INTERFACE Stocks fill section.

- [ ] **Step 1: pure helpers + failing tests**

```rust
/// Choose lookback so `now − lookback` reaches earliest replayed as_of (clamp 40–500).
pub fn lookback_days_for_corpus(earliest_as_of: DateTime<Utc>, now: DateTime<Utc>) -> i64 {
    let span = (now - earliest_as_of).num_days() + 15; // ≥5 session headroom ≈ 15 calendar days
    span.clamp(40, 500)
}

/// Build a synthetic StructureSample for join_sample_outcomes from a replayed row + spot.
pub fn synthetic_sample(row: &ReplayRowView, spot: f64) -> anyhow::Result<StructureSample> {
    let m = row.measurement.as_ref().ok_or_else(|| anyhow::anyhow!("replayed without measurement"))?;
    let as_of = rfc3339_to_as_of_secs(&row.as_of)?;
    Ok(StructureSample {
        symbol: row.symbol.to_ascii_uppercase(),
        as_of,
        price: Some(spot),
        score: m.opportunity_score.map(|s| s as f64),
        tier: m.opportunity_tier.clone(),
        regime: None,
        vol_regime: None,
        flip: m.gamma_flip,
        dist_to_flip_pct: None,
        call_wall: m.call_wall,
        put_wall: m.put_wall,
        dist_to_wall_pct: None,
        score_drivers: None,
        net_gex: m.net_gex,
        iv_hv_ratio: None,
        atm_iv: None,
        hv_30d: None,
    })
}
```

Fill algorithm (runs only when `--labels` absent):

1. Collect replayed rows with usable `display_spot`.
2. Per symbol, compute `lookback_days_for_corpus(earliest, Utc::now())`.
3. `market.daily_bars(symbol, lookback)` via injected `MarketDataPort` (fixture in tests).
4. For each usable replayed row, `join_sample_outcomes(&sample, &bars, horizons, joined_at, "massive_aggs_1d")`.
5. Horizons with no returned outcome → later `no_label` (reason may name window miss when
   `future.len() < n`).
6. Optionally write sidecar JSON `{ "outcomes": [ ... ] }` next to `--out` / default research dir
   for re-feed as `--labels` (snapshot-keyed: `as_of` epoch secs matching RFC3339→secs).

When Stocks fails / returns empty: rows stay `no_label`; **no** Options fallback (AC-16).

- [ ] **Step 2:** hermetic fixture-port tests: pinned labels ⇒ fill function not called (counter);
  missing labels ⇒ fill called; Options counter stays 0. Commit:
  `feat(replay-outcome-join): corpus-covering Stocks label fill`.

**Reviewer probe:** `--labels` present + a fill hook that panics if called — run must succeed.

---

### B8 — Clap command + `cmd_replay_outcome_join`

**Files:** `apps/api/src/main.rs`

**Why:** SPEC §2 component boundary; INTERFACE CLI invocation; AC-13/14/22/29 wiring.

- [ ] **Step 1: add variant** (place beside `BatchBacktest`):

```rust
/// Research: join batch-backtest replayed scores to forward stock-bar labels (measurement only).
ReplayOutcomeJoin {
    /// Batch-backtest research artifact (required).
    #[arg(long)]
    replay: PathBuf,
    /// Snapshot-keyed join-outcomes-shaped labels; when set ⇒ zero Stocks I/O.
    #[arg(long)]
    labels: Option<PathBuf>,
    #[arg(long)]
    out: Option<PathBuf>,
    /// Horizons as session counts with d suffix (default 1d,5d).
    #[arg(long, default_value = "1d,5d")]
    horizons: String,
    /// JSON on stdout; standing prose + progress on stderr.
    #[arg(long)]
    json: bool,
},
```

Wire match arm → `cmd_replay_outcome_join(replay, labels, out, &horizons, json).await?`.

- [ ] **Step 2: implement command body** (thin orchestrator):

```rust
async fn cmd_replay_outcome_join(
    replay: PathBuf,
    labels: Option<PathBuf>,
    out: Option<PathBuf>,
    horizons_raw: &str,
    json: bool,
) -> anyhow::Result<()> {
    use api_rust::services::research::replay_outcome_join::*;
    // parse horizons → Vec<&str> closed set must include only 1d/5d in v1 (bail on unknown)
    let art = load_replay_artifact(&replay)?;
    let (label_rows, stocks_fill_ran, labels_path_for_provenance) = match &labels {
        Some(p) => {
            let labs = load_labels_file(p)?;
            assert_labels_keyspace(&art.rows, &labs)?;
            (labs, false, Some(p.as_path()))
        }
        None => {
            // open MarketDataPort::live only here; call fill helpers; may write sidecar
            // ...
        }
    };
    let (rows, counts) = join_rows(JoinInput { replay: &art.rows, labels: &label_rows, horizons: &hz })?;
    // build rates if paired ≥ 1; emit; print standing first (stdout or stderr under --json)
    Ok(())
}
// --- end cmd_replay_outcome_join ---
```

`load_labels_file`: accept `{ "outcomes": [...] }` (join-outcomes artifact) **or** a bare
`StructureOutcome` array; reject unreadable with hard fault.

Exit codes:

| Case | Exit |
|---|---|
| usage / unreadable `--replay` / unreadable `--labels` / key-space miss | non-zero |
| paired ≥ 1 measurement | 0 |
| paired == 0 honest empty | 0 |

Mark body end with `// --- end cmd_replay_outcome_join ---` for isolation slicing (same pattern as
batch-backtest).

- [ ] **Step 3:** `cargo run -p api-rust -- replay-outcome-join --help` shows flags. Commit:
  `feat(replay-outcome-join): clap command wiring`.

**Reviewer probe:** omit `--replay` → clap error, non-zero. Pass diary-keyed labels against
replayed snapshot clocks with zero intersection → `KEYSPACE_MISS_LINE`, non-zero, no file.

---

### B9 — Isolation source guards + sibling coexistence

**Files:** `apps/api/tests/replay_outcome_join_isolation.rs` (**create**); optional inline tests in
`main.rs` mirroring batch-backtest body scans

**Why:** AC-13, AC-19, AC-21, AC-22, AC-29; `[structural-over-prose-enforcement]`.

- [ ] **Step 1: failing isolation tests**

```rust
fn cmd_replay_outcome_join_body() -> String {
    let src = std::fs::read_to_string(
        Path::new(env!("CARGO_MANIFEST_DIR")).join("src/main.rs"),
    ).unwrap();
    let start = src.find("async fn cmd_replay_outcome_join(").expect("cmd missing");
    let end = src[start..]
        .find("\n// --- end cmd_replay_outcome_join ---")
        .expect("end marker missing");
    src[start..start + end].to_string()
}

#[test]
fn cmd_body_does_not_reference_options_or_compute_or_research_http() {
    let body = cmd_replay_outcome_join_body();
    for needle in [
        "compute_analytics_from_vendor",
        "fetch_option",
        "fetch_chain",
        "resolve(",
        "/api/_research",
        "ChainSnapshotStore",
        "open_chain_snapshot_store",
    ] {
        assert!(
            !body.contains(needle),
            "cmd_replay_outcome_join must not contain {needle}"
        );
    }
}

#[test]
fn sibling_commands_still_present() {
    let src = std::fs::read_to_string(
        Path::new(env!("CARGO_MANIFEST_DIR")).join("src/main.rs"),
    ).unwrap();
    assert!(src.contains("async fn cmd_score_lab("));
    assert!(src.contains("async fn cmd_batch_backtest("));
    assert!(src.contains("async fn cmd_join_outcomes("));
    assert!(src.contains("async fn cmd_replay_outcome_join("));
}
```

Also scan `replay_outcome_join.rs` production source for Options needles (allow
`daily_bars` / `MarketDataPort` references only in documented fill helpers called from cmd).

- [ ] **Step 2:** PASS. Commit: `test(replay-outcome-join): isolation + sibling coexistence guards`.

**Reviewer probe:** temporarily insert `compute_analytics_from_vendor` into the cmd body — isolation
test must go red.

---

### B10 — Hermetic integration harness (AC suite)

**Files:** `apps/api/tests/replay_outcome_join_cli.rs` (**create**)

**Why:** Prefer one hermetic pass covering ship-blocking ACs (SPEC §3 method notes).

- [ ] **Step 1: build fixtures in-temp**

Construct a minimal `BatchBacktestArtifact`-shaped JSON with `rows[]` covering:

| Row | disposition | display_spot | purpose |
|---|---|---|---|
| SPY @ t1 | `replayed` | 100.0 | paired (with matching labels) |
| SPY @ t2 | `replayed` | absent | `no_p0` |
| QQQ @ t1 | `missing` | — | `no_snapshot` |
| IWM @ t1 | `empty_book` | — | `empty_book` |
| AAA @ t1 | `unreadable` | — | `unreadable` (reason empty on load) |
| BBB @ t1 | `compute_failed` | — | `compute_failed` (reason empty on load) |
| SPY @ t3 | `replayed` | 100.0 | `no_label` (no matching label for a horizon) |

Snapshot-keyed labels file: `StructureOutcome` rows whose `as_of` = `rfc3339_to_as_of_secs` of
the paired replay rows; include both `1d` and `5d` where needed. Enough paired rows (≥30 and
≥2 ET sessions) for computable rates **or** assert UnderMinimum honesty when intentionally thin
— cover both paths in separate cases.

Drive the pure API (`load → assert_labels_keyspace → join_rows → build_rates → emit`) rather than
only the clap binary when possible; add one `Command::cargo_bin` / `cargo run` smoke for help +
keyspace miss exit code.

Assertions (map to ACs):

1. Paired rows present (AC-1); 1d rates under `large_abs_move` (AC-2); 5d rate or explicit
   not-computable (AC-3).
2. Artifact twin of console figures (AC-4) — compare serialized measurement body.
3. Every rate has full T0c fields (AC-5a); horizons labeled distinctly (AC-6).
4. Second run byte-identical via `measurement_identity_value` (AC-7).
5. Disposition literals distinct; counts reconcile including `no_p0` (AC-8–11, AC-32/33).
6. Zero-pair fixture: no file; `--json` counts-only (AC-12).
7. Options call counter = 0 (AC-13); pinned labels ⇒ Stocks counter = 0 (AC-14).
8. Authorizes nothing + banned scan (AC-17/18); score triple unchanged after join (AC-19) —
   reuse `score_triple` pattern from `batch_backtest_cli.rs`.
9. Provenance hermetic path names pinned file, not Stocks (AC-28).
10. Standing first (AC-30); no Live badge strings (AC-31).
11. Key-space miss exits non-zero (AC-34); all-degraded+labels hard error (P-keyspace-universe).
12. Producer new replay writes `display_spot` (AC-27) — call batch-backtest replay helper or
    assert B1 field on a freshly built `ReplayedMeasurement`.

- [ ] **Step 2:** PASS full harness. Commit:
  `test(replay-outcome-join): hermetic AC harness`.

**Reviewer probe:** delete the AC-34 assertion; swap in a diary-keyed labels file that shares ET
calendar day but not ms identity — must still hard-fail (format conversion alone does not fix
identity).

---

## Frontend track

### F1 — `NO_UI_CHANGE` structural enforcement

**Files:** `apps/dashboard/src/app/replay-outcome-join.structural.spec.ts` (**create only**)

**Why:** AC-20, AC-21, AC-29; SPEC §4 `NO_UI_CHANGE`. No product UI. Mirror
`batch-backtest-cli.structural.spec.ts`.

- [ ] **Step 1: failing Vitest** (file missing → suite absent; create with assertions that bite)

```ts
/**
 * replay-outcome-join F1 — NO_UI_CHANGE (AC-20, AC-21, AC-29).
 * Pages 404 /api/_research non-regression + no trader chrome for join measurement +
 * no dashboard import of CLI/research join helpers.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DASHBOARD_SOURCES = import.meta.glob(
  ['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}', '!**/*.test.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const TRADER_FORBIDDEN = [
  'replay-outcome-join',
  'replay_outcome_join',
  'ReplayOutcomeJoin',
  'cmd_replay_outcome_join',
  'RESEARCH JOIN — REPLAYED SCORES',
] as const;

const CAPTURE_BROWSE_FORBIDDEN = ['/api/_research', 'chain-snapshots'] as const;
const CLIENT_FORBIDDEN = [...TRADER_FORBIDDEN, ...CAPTURE_BROWSE_FORBIDDEN] as const;

function workspaceRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'nx.json'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('nx workspace root not found from ' + process.cwd());
}

const ROOT = workspaceRoot();
const PAGES_FN = resolve(ROOT, 'functions', 'api', '[[path]].ts');
const CONVEXA_CLIENT = resolve(ROOT, 'libs', 'api', 'src', 'lib', 'convexa.ts');
const DASHBOARD_APP = resolve(ROOT, 'apps', 'dashboard', 'src', 'app');

function hitsIn(src: string, needles: readonly string[] = TRADER_FORBIDDEN): string[] {
  return needles.filter((n) => src.includes(n));
}

function isBlockedOnTraderOrigin(pathname: string): boolean {
  return (
    pathname === '/api/_metrics' ||
    pathname.startsWith('/api/_metrics/') ||
    pathname === '/api/_research' ||
    pathname.startsWith('/api/_research/')
  );
}

function extractOperator404Condition(src: string): string {
  const match = src.match(
    /if\s*\(([\s\S]*?)\)\s*\{\s*return new Response\(\s*['"]Not Found['"]\s*,\s*\{\s*status:\s*404\s*\}\s*\)/,
  );
  return match?.[1] ?? '';
}

function pagesSourceBlocksResearch(src: string): boolean {
  const cond = extractOperator404Condition(src);
  return (
    /pathname\s*===\s*['"]\/api\/_research['"]/.test(cond) &&
    /pathname\.startsWith\(\s*['"]\/api\/_research\/['"]\s*\)/.test(cond) &&
    /pathname\s*===\s*['"]\/api\/_metrics['"]/.test(cond) &&
    /pathname\.startsWith\(\s*['"]\/api\/_metrics\/['"]\s*\)/.test(cond)
  );
}

describe('F1 · no trader chrome for replay-outcome-join (AC-20/29)', () => {
  it('anti-vacuity — dashboard sources load', () => {
    const keys = Object.keys(DASHBOARD_SOURCES);
    expect(keys.length).toBeGreaterThan(10);
    expect(keys.some((k) => k.includes('/pages/'))).toBe(true);
    expect(keys.some((k) => k.endsWith('/shell/TopNav.tsx'))).toBe(true);
    expect(keys.some((k) => k.endsWith('/app.tsx'))).toBe(true);
  });

  it('trader sources do not mention replay-outcome-join chrome', () => {
    const hits: string[] = [];
    for (const [path, src] of Object.entries(DASHBOARD_SOURCES)) {
      for (const n of TRADER_FORBIDDEN) {
        if (src.includes(n)) hits.push(`${path}: ${n}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('does not add a trader page for join measurement', () => {
    expect(existsSync(resolve(DASHBOARD_APP, 'pages', 'replay-outcome-join'))).toBe(false);
    const leakPaths = Object.keys(DASHBOARD_SOURCES).filter((k) =>
      /replay-outcome-join|replay_outcome_join/.test(k),
    );
    expect(leakPaths).toEqual([]);
  });

  it('route table and nav stay free of join paths', () => {
    const appKey = Object.keys(DASHBOARD_SOURCES).find((k) => k.endsWith('/app.tsx'));
    const navKey = Object.keys(DASHBOARD_SOURCES).find((k) => k.endsWith('/shell/TopNav.tsx'));
    const appSrc = DASHBOARD_SOURCES[appKey as string];
    const navSrc = DASHBOARD_SOURCES[navKey as string];
    expect(hitsIn(appSrc, CLIENT_FORBIDDEN)).toEqual([]);
    expect(hitsIn(navSrc, CLIENT_FORBIDDEN)).toEqual([]);
  });

  it('mutation — injecting join chrome into a fake source is detected', () => {
    const poison =
      'export const x = "replay-outcome-join"; const cmd = "cmd_replay_outcome_join"; // ReplayOutcomeJoin RESEARCH JOIN — REPLAYED SCORES';
    expect(hitsIn(poison)).toEqual(
      expect.arrayContaining([
        'replay-outcome-join',
        'cmd_replay_outcome_join',
        'ReplayOutcomeJoin',
        'RESEARCH JOIN — REPLAYED SCORES',
      ]),
    );
  });
});

describe('F1 · Pages /api/_research 404 unchanged (AC-21)', () => {
  it('the same 404 branch covers /api/_research and /api/_research/*', () => {
    const src = readFileSync(PAGES_FN, 'utf8');
    expect(pagesSourceBlocksResearch(src)).toBe(true);
  });

  it('block list matches INTERFACE standing rule (exact + prefix)', () => {
    expect(isBlockedOnTraderOrigin('/api/_research/chain-snapshots/SPY')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/ticker/SPY')).toBe(false);
  });
});

describe('F1 · libs/api has no replay-outcome-join client', () => {
  it('convexa.ts does not grow a join or _research helper', () => {
    const src = readFileSync(CONVEXA_CLIENT, 'utf8');
    expect(src.includes('replay-outcome-join')).toBe(false);
    expect(src.includes('replayOutcomeJoin')).toBe(false);
  });
});
```

- [ ] **Step 2:** run
  `npx nx test @convexa/dashboard --testPathPattern=replay-outcome-join` → PASS.
  `npx nx typecheck @convexa/dashboard` → exit 0.

- [ ] **Step 3:** Commit: `test(replay-outcome-join): NO_UI_CHANGE structural guard`.

**Do not** edit `functions/api/[[path]].ts` unless F1 proves a regression (then fix + keep 404).

---

## Verification track

Run after B10 + F1. Record exit codes (`$LASTEXITCODE`).

### V1 — Backend unit + integration

```powershell
cargo test -p api-rust replay_outcome_join -- --nocapture
cargo test -p api-rust --test replay_outcome_join_cli -- --nocapture
cargo test -p api-rust --test replay_outcome_join_isolation -- --nocapture
```

**Expect:** exit 0; AC tables in B10 covered; Options needles absent from cmd body.

### V2 — Full api test + sibling coexistence smoke

```powershell
cargo test -p api-rust -p quant-engine
cargo run -p api-rust -- score-lab --help
cargo run -p api-rust -- batch-backtest --help
cargo run -p api-rust -- join-outcomes --help
cargo run -p api-rust -- replay-outcome-join --help
```

**Expect:** exit 0; all four helps print; siblings are **not** removed/renamed.

### V3 — Frontend structural + typecheck

```powershell
npx nx test @convexa/dashboard --testPathPattern=replay-outcome-join
npx nx typecheck @convexa/dashboard
```

**Expect:** exit 0 both. `git diff --name-only -- apps/dashboard` shows only the structural spec.

### V4 — Interface conformance (non-regression on capture research GETs)

```powershell
node .grok/tools/gates.mjs interface_conformance `
  --contract .spire/clusters/tech/contracts/replay-outcome-join/INTERFACE_CONTRACT.md
```

**Expect:** PASS on the four re-pinned endpoints. Hit-probe seed failure → UNVERIFIABLE only for
that row; must not reshape envelopes. No new `/api/_research/replay-outcome-join*` path in live
inventory.

### V5 — Manual / review checklist (AC-5b, AC-20, AC-22–24, AC-26)

- [ ] Assumption labels are human-readable (`1d`/`5d`, capture-time underlying / `display_spot`,
      median-once plain language) — AC-5b / AC-26.
- [ ] No trader nav/route for join (F1 proves structurally) — AC-20.
- [ ] `batch-backtest` and `score-lab` remain separately invocable — AC-22.
- [ ] Genre = paid-book replay + forward-label measurement (standing title / `genre` key) — AC-23.
- [ ] 0.467 appears only as historical context if at all — never a pass/fail bar — AC-24.
- [ ] Progress lines name phases (`load replay → load/join labels → pair → write`) and never
      present a partial write as the final research report title.

---

## Dependency graph (within backend)

```
B1 display_spot additive
 └─► B2 load view + keyspace
      └─► B3 dispositions/counts
           └─► B4 pure join
                ├─► B5 rates/T0c
                └─► B6 emit
                     ├─► B7 Stocks fill
                     └─► B8 clap wiring
                          ├─► B9 isolation guards
                          └─► B10 integration harness
F1 ∥ B1…B10
V1…V5 after B10+F1
```

---

## Planning notes for lanes (carry-forward)

- **Load view, not full `BatchBacktestArtifact` Deserialize.** Custom `AggregatesValue`
  Serialize has no Deserialize twin — requiring `rows[]` on an object wrapper satisfies
  P-replay-envelope without reshaping the producer.
- **Export `pairing::as_of_key`** — do not fork a second ms bucket.
- **Classify `no_p0` before `join_sample_outcomes`** — empty Vec from missing price must never
  become `no_label`.
- **P-keyspace-universe:** intersection is against **replayed** identities only. All-degraded
  replay + `--labels` → hard error. All-degraded **without** `--labels` → AC-12 honest empty.
- **AC-32 reasons:** loaded artifacts have empty notes (`#[serde(skip)]`); print literal
  families with omitted/empty `<reason>` — do not invent producer error text.
- Prefer calling pure `join_rows` / `emit` from tests; keep `cmd_*` thin.
- Stocks fill uses `MarketDataPort::daily_bars` only; inject fixture port in hermetic tests.
- Do not edit SPEC.md / INTERFACE_CONTRACT.md. If the tree contradicts this plan, report the
  conflict instead of silently resolving it.
