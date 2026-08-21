# batch-backtest-cli — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking. Execute from the workspace root. Keep this plan at
> `.spire/clusters/tech/contracts/batch-backtest-cli/PLAN.md`.

**Goal:** Ship a research CLI (`batch-backtest` / `BatchBacktest` / `cmd_batch_backtest`) that
replays already-stored dated options books from `ChainSnapshotStore` through Path-B
`compute_analytics_from_vendor` and writes a dated measurement artifact — zero Massive, no trader
UI, Authorizes: nothing on live score.

**Architecture:** New clap command sibling to `ScoreLab` / `JoinOutcomes` in
`apps/api/src/main.rs`. Orchestration + artifact types live under
`apps/api/src/services/research/batch_backtest.rs` (pure-ish, store-injected). CLI opens the chain
store **for read** via `ChainSnapshotStore::open_json` / `open_postgres` only — never
`Disabled`, never serve `open_chain_snapshot_store` (`apps/api/src/state.rs`). Replay path is
store → `deserialize_capture` / `to_vendor_bundle` → empty-book gate →
`compute_analytics_from_vendor` (hermetic params). Optional chronological split under D1=A
(≥1 `replayed` per side). No HTTP surface; existing `/api/_research/chain-snapshots/*` unchanged.

**Tech stack:** Rust (`apps/api`, crate `api-rust`); clap 4; `chrono` RFC3339 nanos;
`serde_json` artifact. Tests: `cargo test -p api-rust` / `npx nx test api`. Frontend:
`NO_UI_CHANGE` — structural Vitest only. Cite live:
`apps/api/src/services/chain_snapshot/store.rs`,
`apps/api/src/services/analytics.rs` (`compute_analytics_from_vendor`),
`apps/api/src/main.rs` (`cmd_score_lab`), `apps/api/src/state.rs` (serve opener — do not call).

**Spec:** `.spire/clusters/tech/contracts/batch-backtest-cli/SPEC.md` (APPROVED 2026-08-18)
**Interface:** `.spire/clusters/tech/contracts/batch-backtest-cli/INTERFACE_CONTRACT.md`

---

## Track map

| Track | Tasks | Ownership |
|---|---:|---|
| **Backend** (`apps/api`) | **B1 → B9** (strict order inside the track) | Main product surface |
| **Frontend** (`apps/dashboard` + Pages) | **F1** | `NO_UI_CHANGE` structural only |
| **Verification** | **V1 → V5** after B9 + F1 | Read-only gates |

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
- **Cite live Rust only** (`chain_snapshot/store.rs`, `analytics.rs`, `cmd_score_lab`, serve
  `open_chain_snapshot_store`) — not Python.
- **Do not edit** `SPEC.md`, `INTERFACE_CONTRACT.md`, or other feature folders.
- **Never `git stash`** while other sessions may hold uncommitted work.

**Feature hard rules (settled — do not re-open):**

- **D1=A:** refuse split unless **both** train and holdout each contain ≥1 row with disposition
  `replayed`. Skipped-only sides are empty for the refuse predicate. Message:
  `split refused — cannot form two non-empty buckets`. No artifact on refuse. No auto-fallback to
  unsplit. No train=0/holdout=0 theater.
- **T0a:** CLI opens json/pg for **read** via `ChainSnapshotStore::open_json` /
  `open_postgres`. Must **not** construct `Disabled` or call serve `open_chain_snapshot_store`.
  Capture write off (`CHAIN_SNAPSHOT_ENABLED=false`) with retained books on disk → still replay.
- **T0b:** `empty_corpus` → console only; **no** measurement artifact; exit success; zero Massive.
- **T1:** `empty_book` gated **before** compute; literal `empty stored book for <SYMBOL>`
  (optional ` at <as_of>`); no score figure.
- **`--as-of`:** AC-12 dated identity via `store.load`; mutually exclusive with `--from`/`--to`;
  no HTTP `/snapshot?as_of=`; no substitute as_of on miss.
- **`--train-frac`:** domain `f ∈ (0,1)` exclusive; else usage error before split.
- **`--json`:** stdout = JSON body (may start with `{`); standing prose + progress on **stderr**;
  `standing` also inside JSON.
- **`NO_UI_CHANGE`:** no trader chrome; frontend track is structural only.
- **Zero Massive** on list and replay; never `MassiveRestClient` / `MarketDataPort::live` in cmd body.
- **`compute_ms` / `cached_at` / `ttl_secs` excluded** from measurement payload and AC-9 identity.
- **Count identity:** `selected = replayed + skipped` always (`skipped` = missing | empty_book |
  unreadable | compute_failed).
- **`score-lab` untouched** as a separate entrypoint (AC-23).

**S2 Important residuals — planning pins (do not reopen product):**

1. **`none_replayed` artifact = MUST write** when `selected ≥ 1`. Aligns SPEC data flow
   (“write dated artifact when selected ≥ 1”) + INTERFACE schema (“refused splits and
   `empty_corpus` write **no** file”). The corpus-table “may” is superseded by this harder rule
   for implementers. AC-12’s disposition `missing` is observed on `rows[].disposition` in that
   artifact (and the miss console literal).
2. **`aggregates` key always present** on every written artifact. When
   `corpus_status = none_replayed`, emit `{ "replayed_count": 0 }` only — **do not omit** the
   `aggregates` key; **do not** emit score/tier/GEX min/max/mean or `tier_counts` presented as
   findings.
3. **`opportunity_tier` inputs (desk-identical):** after a successful
   `compute_analytics_from_vendor`, derive tier exactly as live serve does in
   `apps/api/src/routes/market.rs`:
   ```rust
   let gate = evaluate_gate(signals, DEFAULT_GATE_SCORE);
   let tier = compute_opportunity_tier(
       signals.opportunity_score,
       gate.ready,
       40, 60, 80,
   );
   ```
   Use `snap.signals` when `Some`, else rebuild via `generate_signals` + the snapshot’s market/GEX
   inputs the same way `chain_snapshot_capture` tests do. Bands are fixed `40/60/80`. Do **not**
   invent a score-only tier path that skips `evaluate_gate`.
4. **`--as-of` + `--split-at` / `--train-frac`:** not a usage error (SPEC §5 does not list it).
   It is a **guaranteed D1 refuse** after selection/replay (`|T*| = 1` → cannot form two
   `replayed`-non-empty buckets). Print the refuse literal; write **no** artifact; exit non-zero.
5. **Split row-ref inner shape:** each membership entry is
   `{ "symbol": "<SYM>", "as_of": "<RFC3339 nanos>" }` (identity only — not full row objects, not
   bare indices). Both `train` and `holdout` arrays include skipped rows that chronologically fall
   on that side (AC-4); skipped rows still do not fill the non-empty predicate.
6. **`none_replayed` console / standing:** treat as a **written-measurement** run (not the
   empty-corpus short path). Default mode: standing block first on stdout → corpus/rows →
   aggregates (`replayed_count: 0`) → closing Authorizes line. `--json`: JSON on stdout (includes
   `standing` + `corpus_status: "none_replayed"`); standing prose on stderr. Bind
   `standing.snapshots_loaded` = count of rows whose disposition is **not** `missing` (bytes were
   obtained). An `--as-of` all-miss run has `snapshots_loaded: 0`.

**Hermetic compute params (fixed every run):**

```rust
AnalyticsComputeParams {
    min_dte,              // from --min-dte if set
    max_dte,              // from --max-dte if set
    include_dark_pool: false,
    block_min_shares: 5000,
    ttl_secs: 0,
    iv_rank_enabled: false,
}
// iv_store: None
```

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
| `cargo test -p api-rust -- batch_backtest` | exit 0; named ACs covered |
| `npx nx test api` / `cargo test -p api-rust -p quant-engine` | exit 0 |
| `npx nx test @convexa/dashboard --testPathPattern=batch-backtest` | exit 0 (F1) |
| `npx nx typecheck @convexa/dashboard` | exit 0 |
| `interface_conformance` against Global Constraints block | PASS (or UNVERIFIABLE only on hit-probe seed failure) |
| `git diff --name-only -- apps/dashboard` | only the F1 structural spec (no product UI) |
| `score-lab --help` still lists ScoreLab | present; batch-backtest is a **separate** subcommand |

---

## File ownership

| Path | Change |
|---|---|
| `apps/api/src/services/research/batch_backtest.rs` | **Create** — types, select, replay, split, aggregates, emit |
| `apps/api/src/services/research/mod.rs` | `pub mod batch_backtest;` |
| `apps/api/src/main.rs` | Add `Commands::BatchBacktest` + `cmd_batch_backtest` + structural body-scan tests |
| `apps/api/tests/batch_backtest_cli.rs` | **Create** — hermetic integration harness |
| `apps/api/tests/batch_backtest_isolation.rs` | **Create** — source scans (no Massive / no Disabled / no serve opener / score-lab intact) |
| `apps/dashboard/src/app/batch-backtest-cli.structural.spec.ts` | **Create** — NO_UI_CHANGE + Pages 404 non-regression |
| `functions/api/[[path]].ts` | **No change** (re-asserted by F1) |
| `apps/dashboard` product UI | **No change** |

**Do not touch:** `cmd_score_lab` behavior, serve `open_chain_snapshot_store`, trader routes,
score/tier/fingerprint math, capture append path, research HTTP handlers’ envelopes,
`DESIGN_SYSTEM.md`.

---

## Backend track

### B1 — Types: dispositions, rows, artifact schema

**Files:** `apps/api/src/services/research/batch_backtest.rs`; `apps/api/src/services/research/mod.rs`

**Why:** Closed vocabularies from SPEC §2; INTERFACE required keys; S2 pins 1–2, 5–6.

- [ ] **Step 1: create module + failing tests**

```rust
// apps/api/src/services/research/mod.rs — add:
pub mod batch_backtest;
```

In `batch_backtest.rs` `#[cfg(test)]`:

```rust
#[test]
fn corpus_status_tokens_are_closed_and_disjoint() {
    // ok / partial / none_replayed only on written artifacts
    assert_eq!(CorpusStatus::from_counts(3, 3).as_str(), "ok");
    assert_eq!(CorpusStatus::from_counts(3, 2).as_str(), "partial");
    assert_eq!(CorpusStatus::from_counts(3, 0).as_str(), "none_replayed");
}

#[test]
fn none_replayed_aggregates_are_replayed_count_zero_only() {
    let agg = Aggregates::for_none_replayed();
    let v = serde_json::to_value(&agg).unwrap();
    assert_eq!(v["replayed_count"], 0);
    assert!(v.get("score_mean").is_none());
    assert!(v.get("tier_counts").is_none());
}

#[test]
fn split_row_ref_shape_is_symbol_as_of() {
    let r = SplitRowRef { symbol: "SPY".into(), as_of: "1970-01-01T00:00:00.000000001Z".into() };
    let v = serde_json::to_value(&r).unwrap();
    assert_eq!(v, json!({"symbol":"SPY","as_of":"1970-01-01T00:00:00.000000001Z"}));
}

#[test]
fn measurement_payload_omits_compute_ms() {
    let row = ReplayedMeasurement { /* minimal */ opportunity_score: 1, /* … */ };
    let s = serde_json::to_string(&row).unwrap();
    assert!(!s.contains("compute_ms"));
    assert!(!s.contains("cached_at"));
    assert!(!s.contains("ttl_secs"));
}
```

Run: `cargo test -p api-rust batch_backtest -- --nocapture` → **FAIL** (module missing).

- [ ] **Step 2: implement types**

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RowDisposition {
    Replayed,
    Missing,
    EmptyBook,
    Unreadable,
    ComputeFailed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CorpusStatus { Ok, Partial, NoneReplayed }

impl CorpusStatus {
    pub fn from_counts(selected: usize, replayed: usize) -> Self {
        debug_assert!(selected >= 1);
        if replayed == 0 { Self::NoneReplayed }
        else if replayed == selected { Self::Ok }
        else { Self::Partial }
    }
    pub fn as_str(self) -> &'static str { /* ok|partial|none_replayed */ }
}

#[derive(Debug, Clone, Serialize)]
pub struct SplitRowRef {
    pub symbol: String,
    pub as_of: String, // wire::as_of_string
}

#[derive(Debug, Clone, Serialize)]
pub struct ResearchRow {
    pub symbol: String,
    pub as_of: String,
    pub source: String,
    pub disposition: RowDisposition,
    #[serde(flatten, skip_serializing_if = "Option::is_none")]
    pub measurement: Option<ReplayedMeasurement>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReplayedMeasurement {
    pub opportunity_score: i32,
    pub opportunity_tier: String,
    pub net_gex: f64,
    pub call_wall: f64,
    pub put_wall: f64,
    pub gamma_flip: f64,
    pub contract_count: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct Counts {
    pub selected: usize,
    pub replayed: usize,
    pub skipped: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct SkippedBreakdown {
    pub missing: usize,
    pub empty_book: usize,
    pub unreadable: usize,
    pub compute_failed: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct Standing {
    pub not_live: bool,          // always true
    pub corpus: String,
    pub snapshots_loaded: usize, // non-missing count (S2 pin 6)
    pub massive_calls: usize,    // always 0 on success path
    pub framing: String,
    pub authorizes: String,      // "nothing"
}

#[derive(Debug, Clone, Serialize)]
pub struct BatchBacktestArtifact {
    pub standing: Standing,
    pub authorizes: String, // exact "nothing"
    pub corpus_status: CorpusStatus,
    pub counts: Counts,
    pub skipped_breakdown: SkippedBreakdown,
    pub rows: Vec<ResearchRow>,
    pub split: Option<SplitBlock>, // None → serialize as null
    pub aggregates: AggregatesValue,
    pub corpus: CorpusIdentity,
}
```

`AggregatesValue`: unsplit = one `BucketAggregates`; split success = `{ train, holdout }`.
`BucketAggregates` when `replayed ≥ 1` carries the closed set (`replayed_count`, `tier_counts`,
`score_min`/`max`/`mean`, `net_gex_min`/`max`/`mean`). `Aggregates::for_none_replayed()` →
`{ replayed_count: 0 }` only.

- [ ] **Step 3:** tests PASS. Commit: `feat(batch-backtest): artifact types + closed dispositions`.

**Reviewer probe:** serialize a `none_replayed` artifact and assert key `aggregates` exists and
lacks `score_mean`.

---

### B2 — Flag validation + store open-for-read

**Files:** `apps/api/src/services/research/batch_backtest.rs` (helpers); clap wiring lands in B8

**Why:** T0a; SPEC §2 flags; §5 usage errors.

- [ ] **Step 1: failing tests**

```rust
#[test]
fn train_frac_rejects_zero_one_and_non_finite() {
    assert!(parse_train_frac(0.0).is_err());
    assert!(parse_train_frac(1.0).is_err());
    assert!(parse_train_frac(f64::NAN).is_err());
    assert!(parse_train_frac(0.5).is_ok());
}

#[test]
fn as_of_mutually_exclusive_with_from_to() {
    let err = validate_flags(/* as_of Some, from Some */).unwrap_err();
    assert!(err.to_string().contains("as-of") || err.to_string().contains("usage"));
}

#[test]
fn both_split_flags_are_usage_error() {
    assert!(validate_flags(/* split_at + train_frac */).is_err());
}

#[test]
fn empty_symbols_after_parse_is_usage_error() {
    assert!(parse_symbols(" , , ").is_err());
}

#[tokio::test]
async fn open_store_for_read_uses_open_json_not_disabled() {
    let dir = tempfile::tempdir().unwrap();
    let store = open_chain_store_for_cli(Some(dir.path().to_path_buf()), /*pg*/ None)
        .await
        .unwrap();
    assert!(store.is_enabled());
    // list on empty dir succeeds (empty), does not err "capture not storing"
    assert!(store.list("SPY", None).await.unwrap().is_empty());
}
```

- [ ] **Step 2: implement**

```rust
pub fn parse_symbols(raw: &str) -> anyhow::Result<Vec<String>> {
    let v: Vec<String> = raw
        .split(',')
        .map(|s| s.trim().to_ascii_uppercase())
        .filter(|s| !s.is_empty())
        .collect();
    if v.is_empty() {
        anyhow::bail!("usage: --symbols requires at least one symbol");
    }
    Ok(v)
}

pub fn parse_train_frac(f: f64) -> anyhow::Result<f64> {
    if f.is_finite() && f > 0.0 && f < 1.0 { Ok(f) }
    else { anyhow::bail!("usage: --train-frac must be in (0,1) exclusive"); }
}

/// Opens json (path from --store or config.chain_snapshot_store_path) or postgres when
/// DATABASE_URL + feature. NEVER ChainSnapshotStore::disabled / open_chain_snapshot_store.
pub async fn open_chain_store_for_cli(
    store_override: Option<PathBuf>,
    cfg: &Config,
) -> anyhow::Result<ChainSnapshotStore> {
    // Prefer postgres when configured (mirror capture store selection), else:
    let path = store_override.unwrap_or_else(|| cfg.chain_snapshot_store_path.clone());
    ChainSnapshotStore::open_json(&path)
        .await
        .map_err(|e| anyhow::anyhow!("stored snapshot unreadable: {e}"))
}
```

Parse `--as-of` / `--from` / `--to` / `--split-at` with `wire::parse_as_of` (RFC3339; nanos
preserved). Invalid RFC3339 → usage/hard fail (non-zero, no artifact).

**Note (S2 minor):** `open_json` `create_dir_all`s — a missing default path becomes empty inventory
(`empty_corpus`), not AC-16. Exercise AC-16 with a truly unreadable path (e.g. file-as-dir, or
chmod-denied temp on Unix; on Windows use an invalid device path / read-only conflict). Document
the fixture in B9.

- [ ] **Step 3:** tests PASS. Commit: `feat(batch-backtest): flag validation + read-only store open`.

**Reviewer probe:** body of `open_chain_store_for_cli` must not contain `disabled(` or
`open_chain_snapshot_store`.

---

### B3 — Select identities + per-row replay (empty_book gate + tier)

**Files:** `apps/api/src/services/research/batch_backtest.rs`

**Why:** AC-1, AC-11–14; T1; S2 pin 3; zero Massive by construction.

- [ ] **Step 1: failing tests**

```rust
#[tokio::test]
async fn as_of_miss_is_missing_without_substitute() {
    let store = ChainSnapshotStore::memory();
    // plant SPY at as_of A; request as_of B
    let rows = select_and_replay(&store, &["SPY"], SelectMode::AsOf(b), /*…*/).await.unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].disposition, RowDisposition::Missing);
    assert!(rows[0].measurement.is_none());
}

#[tokio::test]
async fn empty_contracts_gate_before_compute() {
    let store = ChainSnapshotStore::memory();
    // plant bundle with market.contracts = vec![]
    let rows = select_and_replay(/*…*/).await.unwrap();
    assert_eq!(rows[0].disposition, RowDisposition::EmptyBook);
    assert!(rows[0].measurement.is_none());
}

#[tokio::test]
async fn replayed_row_carries_closed_d_metrics_and_desk_tier() {
    let store = ChainSnapshotStore::memory();
    // plant fixture_probe_bundle with contracts
    let rows = select_and_replay(/*…*/).await.unwrap();
    let m = rows[0].measurement.as_ref().unwrap();
    assert!(m.contract_count >= 1);
    // tier must equal evaluate_gate + compute_opportunity_tier(40,60,80) on same signals
}

#[tokio::test]
async fn unreadable_bytes_are_unreadable_not_missing() {
    // append garbage bytes under (SYM, as_of) via store internals / Json plant
}

#[tokio::test]
async fn compute_failed_isolates_sibling() {
    // one good + one that will Err inside compute (poisoned bundle if feasible);
    // assert sibling still Replayed
}
```

- [ ] **Step 2: implement selection + replay**

```rust
pub enum SelectMode {
    Window { from: Option<DateTime<Utc>>, to: Option<DateTime<Utc>>, limit: Option<usize> },
    AsOf(DateTime<Utc>),
}

pub async fn select_and_replay(
    store: &ChainSnapshotStore,
    symbols: &[String],
    mode: SelectMode,
    params: &AnalyticsComputeParams,
    progress: &mut dyn FnMut(&str), // phase lines → stderr later
) -> anyhow::Result<Vec<ResearchRow>> {
    let mut rows = Vec::new();
    match mode {
        SelectMode::AsOf(as_of) => {
            for sym in symbols {
                (progress)("load");
                rows.push(replay_one(store, sym, Some(as_of), params).await);
            }
        }
        SelectMode::Window { from, to, limit } => {
            for sym in symbols {
                (progress)("list");
                let metas = store.list(sym, limit).await
                    .map_err(|e| anyhow::anyhow!("stored snapshot unreadable: {e}"))?;
                let metas: Vec<_> = metas.into_iter().filter(|m| {
                    from.map(|f| m.as_of >= f).unwrap_or(true)
                        && to.map(|t| m.as_of <= t).unwrap_or(true)
                }).collect();
                if metas.is_empty() {
                    // per-symbol miss line emitted by console layer; row not added here —
                    // OR add a synthetic missing row only under --as-of.
                    // Unsplit list path: zero metas for all symbols → empty_corpus (no rows).
                    continue;
                }
                for meta in metas {
                    rows.push(replay_one(store, sym, Some(meta.as_of), params).await);
                }
            }
        }
    }
    rows.sort_by(|a, b| (&a.symbol, &a.as_of).cmp(&(&b.symbol, &b.as_of)));
    Ok(rows)
}

async fn replay_one(
    store: &ChainSnapshotStore,
    symbol: &str,
    as_of: Option<DateTime<Utc>>,
    params: &AnalyticsComputeParams,
) -> ResearchRow {
    let as_of = as_of.expect("as_of required for load");
    let as_of_s = as_of_string(as_of);
    match store.load(symbol, as_of).await {
        Err(e) => ResearchRow::skipped(symbol, &as_of_s, "", RowDisposition::Unreadable,
            /* console later */),
        Ok(None) => ResearchRow::missing(symbol, &as_of_s),
        Ok(Some(bytes)) => match deserialize_capture(&bytes) {
            Err(_) => ResearchRow::skipped(/* Unreadable */),
            Ok(wire) => {
                let source = format!("{:?}", wire.source); // or Display
                let vendor = to_vendor_bundle(wire);
                if vendor.market.contracts.is_empty() {
                    return ResearchRow::empty_book(symbol, &as_of_s, &source);
                }
                match compute_analytics_from_vendor(&vendor, params, None).await {
                    Err(e) => ResearchRow::compute_failed(symbol, &as_of_s, &source, e),
                    Ok(snap) => {
                        let signals = /* snap.signals or generate_signals(…) */;
                        let gate = evaluate_gate(&signals, DEFAULT_GATE_SCORE);
                        let tier = compute_opportunity_tier(
                            signals.opportunity_score, gate.ready, 40, 60, 80,
                        );
                        ResearchRow::replayed(symbol, &as_of_s, &source, ReplayedMeasurement {
                            opportunity_score: signals.opportunity_score,
                            opportunity_tier: tier,
                            net_gex: snap.gex.net_gex,
                            call_wall: snap.gex.call_wall,
                            put_wall: snap.gex.put_wall,
                            gamma_flip: snap.gex.gamma_flip,
                            contract_count: snap.contract_count,
                        })
                        // NEVER copy snap.compute_ms / cached_at / ttl_secs
                    }
                }
            }
        }
    }
}
```

**Console literals (emit in B6, collect reasons here):**

| Disposition | Exact / closed literal |
|---|---|
| `missing` | `no stored snapshot for <SYMBOL>` + required ` at <as_of>` when `--as-of` |
| `empty_book` | `empty stored book for <SYMBOL>` (optional ` at <as_of>`) |
| `unreadable` | `stored snapshot unreadable: <reason>` |
| `compute_failed` | `replay error for <SYMBOL> at <as_of>: <reason>` (planning pin — SPEC says “named”) |

- [ ] **Step 3:** tests PASS. Commit: `feat(batch-backtest): select + replay with empty_book gate`.

**Reviewer probe:** poison `contracts = []` and assert `compute_analytics_from_vendor` is **not**
invoked (counter / mock / `std::panic::catch_unwind` seam — prefer a `ReplayHooks` test double
with `compute_calls: AtomicUsize` if extracting the compute call behind a thin fn for tests).

---

### B4 — Counts, corpus_status, aggregates

**Files:** `apps/api/src/services/research/batch_backtest.rs`

**Why:** AC-3, AC-15; count identity; S2 pins 1–2.

- [ ] **Step 1: failing tests**

```rust
#[test]
fn selected_equals_replayed_plus_skipped() {
    let c = tally(&rows);
    assert_eq!(c.selected, c.replayed + c.skipped);
    assert_eq!(c.skipped, br.missing + br.empty_book + br.unreadable + br.compute_failed);
}

#[test]
fn aggregates_over_replayed_only() {
    // mix replayed + empty_book → score_mean uses replayed only; replayed_count == 1
}
```

- [ ] **Step 2: implement** `tally`, `build_aggregates`, `CorpusStatus::from_counts`. When
  `replayed == 0` and `selected >= 1` → `none_replayed` + `Aggregates::for_none_replayed()`.

- [ ] **Step 3:** PASS. Commit: `feat(batch-backtest): counts + aggregates`.

---

### B5 — Time-based split (D1) + row refs

**Files:** `apps/api/src/services/research/batch_backtest.rs`

**Why:** AC-4, AC-5, AC-6; D1=A; S2 pins 4–5.

- [ ] **Step 1: failing tests**

```rust
#[test]
fn split_at_assigns_membership_by_as_of() {
    // three replayed rows at t0<t1<t2; split_at = t1
    // train = {t0}, holdout = {t1,t2}; refs are {symbol,as_of}
}

#[test]
fn split_refuses_when_one_side_has_only_skipped() {
    // train has only empty_book; holdout has replayed → refuse
    let r = try_split(&rows, SplitRule::At(t)).unwrap_err();
    assert!(r.to_string().contains("split refused — cannot form two non-empty buckets"));
}

#[test]
fn train_frac_cut_index_is_floor() {
    // distinct as_ofs sorted T*; i = floor(f * |T*|); cut = T*[i]
}

#[test]
fn as_of_mode_plus_split_guarantees_refuse() {
    // one as_of across symbols → |T*|==1 → refuse (S2 pin 4)
}

#[test]
fn two_different_cuts_differ_in_membership_labels() {
    // ≥3 distinct replayed as_ofs (AC-5 fixture implication)
}
```

- [ ] **Step 2: implement**

```rust
pub enum SplitRule {
    At(DateTime<Utc>),
    TrainFrac(f64), // already validated ∈ (0,1)
}

pub struct SplitBlock {
    pub rule: String, // e.g. "split-at:<rfc3339>" or "train-frac:0.5→cut:<rfc3339>"
    pub train: Vec<SplitRowRef>,
    pub holdout: Vec<SplitRowRef>,
}

pub fn try_split(rows: &[ResearchRow], rule: SplitRule) -> Result<(SplitBlock, AggregatesValue), SplitRefuse> {
    let cut = match rule {
        SplitRule::At(t) => t,
        SplitRule::TrainFrac(f) => {
            let mut ts: Vec<DateTime<Utc>> = rows.iter()
                .filter_map(|r| parse_as_of(&r.as_of).ok())
                .collect();
            ts.sort();
            ts.dedup();
            if ts.is_empty() { return Err(SplitRefuse); }
            let i = ((f * (ts.len() as f64)).floor() as usize).min(ts.len().saturating_sub(1));
            // Note: i==0 or i past last replayed boundary still goes through membership + refuse check
            ts[i]
        }
    };
    let mut train = Vec::new();
    let mut holdout = Vec::new();
    for r in rows {
        let t = parse_as_of(&r.as_of).map_err(|_| SplitRefuse)?;
        let pref = SplitRowRef { symbol: r.symbol.clone(), as_of: r.as_of.clone() };
        if t < cut { train.push(pref); } else { holdout.push(pref); }
    }
    let train_replayed = rows.iter().filter(|r| r.disposition == RowDisposition::Replayed
        && parse_as_of(&r.as_of).unwrap() < cut).count();
    let holdout_replayed = rows.iter().filter(|r| r.disposition == RowDisposition::Replayed
        && parse_as_of(&r.as_of).unwrap() >= cut).count();
    if train_replayed < 1 || holdout_replayed < 1 {
        return Err(SplitRefuse);
    }
    let aggs = AggregatesValue::Split {
        train: build_bucket(rows, /* train predicate */),
        holdout: build_bucket(rows, /* holdout predicate */),
    };
    Ok((SplitBlock { rule: format_rule(&rule, cut), train, holdout }, aggs))
}
```

On `SplitRefuse`: caller prints exact `split refused — cannot form two non-empty buckets`, writes
**no** artifact, exits non-zero. Do **not** auto-run unsplit.

- [ ] **Step 3:** PASS. Commit: `feat(batch-backtest): chronological split with D1 refuse`.

**Reviewer probe:** a side of three `empty_book` rows must refuse even if `|train| >= 1` by raw count.

---

### B6 — Standing, console copy, artifact write, `--json`

**Files:** `apps/api/src/services/research/batch_backtest.rs`

**Why:** AC-2, AC-10, AC-18, AC-19, AC-25, AC-26; S2 pin 6; T0b.

- [ ] **Step 1: failing tests**

```rust
#[test]
fn standing_block_contains_not_live_and_authorizes_nothing() {
    let text = render_standing_prose(&standing);
    assert!(text.starts_with("RESEARCH REPLAY — STORED SNAPSHOTS · NOT LIVE"));
    assert!(text.contains("Authorizes:  nothing"));
    assert!(!text.to_lowercase().contains("adopt"));
    assert!(!text.contains("update the live score"));
}

#[test]
fn empty_corpus_writes_no_file_and_prints_both_lines() {
    // run with empty store + --symbols SPY
    // assert !out_path.exists()
    // stdout/stderr contains "empty research corpus — zero stored snapshots to replay"
    // and "no stored snapshot for SPY"
    // no standing block claiming snapshots loaded
}

#[test]
fn none_replayed_writes_artifact_with_standing() {
    // selected>=1 all skipped → file exists; corpus_status none_replayed; standing present
}

#[test]
fn json_mode_puts_json_on_stdout_and_standing_prose_on_stderr() {
    // capture writers; first stdout byte == b'{'; stderr contains RESEARCH REPLAY
}
```

- [ ] **Step 2: implement emit**

Exact standing block (SPEC §4):

```text
RESEARCH REPLAY — STORED SNAPSHOTS · NOT LIVE
  Corpus:      <symbol list or count> · <as_of span / split rule or unsplit>
  Snapshots:   <n loaded> · zero Massive calls this run
  Framing:     Replayed compute on books we already captured. Not a live desk feed.
  Authorizes:  nothing. No live score, tier, gate, weight, or fingerprint change
               on the strength of this report.
```

Closing line: `RESEARCH REPLAY — NOT LIVE · Authorizes: nothing on the live score path.`

```rust
pub fn emit_run(result: RunResult, opts: EmitOpts) -> anyhow::Result<()> {
    match result {
        RunResult::StoreUnreadable(msg) => { eprintln!("{msg}"); anyhow::bail!(msg) }
        RunResult::EmptyCorpus { symbols } => {
            for s in &symbols {
                println!("no stored snapshot for {s}"); // or stderr in --json — pin: stderr when --json
            }
            let line = "empty research corpus — zero stored snapshots to replay";
            if opts.json { eprintln!("{line}"); } else { println!("{line}"); }
            // NO file
            Ok(())
        }
        RunResult::SplitRefused => {
            eprintln!("split refused — cannot form two non-empty buckets");
            anyhow::bail!("split refused");
        }
        RunResult::Measurement(art) => {
            // write file (selected >= 1 always here, including none_replayed)
            // default: standing prose stdout first, then summary, closing line
            // --json: serde_json to stdout; standing prose to stderr; progress already stderr
            Ok(())
        }
    }
}
```

Default `--out`: `data/research/batch_backtest_<stamp>.json` under workspace root (mirror
score-lab stamp). Create parent dirs only when writing a measurement artifact.

Banned-string unit test: scan emitted strings for `adopt`, `ship this weight`,
`update the live score`, `winner ready for production`, `● Live`, `live backtest`.

- [ ] **Step 3:** PASS. Commit: `feat(batch-backtest): standing + artifact emit + json mode`.

---

### B7 — Clap `BatchBacktest` + `cmd_batch_backtest` orchestration

**Files:** `apps/api/src/main.rs`

**Why:** Distinct entrypoint beside `ScoreLab` (AC-23/24).

- [ ] **Step 1: failing clap parse test**

```rust
#[test]
fn batch_backtest_clap_parses_core_flags() {
    let cli = Cli::try_parse_from([
        "api-rust", "batch-backtest",
        "--symbols", "SPY,QQQ",
        "--as-of", "1970-01-01T00:00:00.000000001Z",
        "--json",
    ]).unwrap();
    match cli.cmd {
        Commands::BatchBacktest { symbols, as_of, json, .. } => {
            assert_eq!(symbols, "SPY,QQQ");
            assert!(as_of.is_some());
            assert!(json);
        }
        other => panic!("expected BatchBacktest, got {other:?}"),
    }
}

#[test]
fn score_lab_still_parses_as_its_own_command() {
    let cli = Cli::try_parse_from([
        "api-rust", "score-lab", "--outcomes", "x.json",
    ]).unwrap();
    assert!(matches!(cli.cmd, Commands::ScoreLab { .. }));
}
```

- [ ] **Step 2: add variant + command body**

```rust
/// P3 research: replay stored chain snapshots through Path-B compute (measurement only).
BatchBacktest {
    /// Comma-separated symbols (required).
    #[arg(long)]
    symbols: String,
    /// Override chain-snapshot store path (json). Opens for read; never Disabled.
    #[arg(long)]
    store: Option<PathBuf>,
    #[arg(long)]
    from: Option<String>,
    #[arg(long)]
    to: Option<String>,
    /// Single dated identity (RFC3339 UTC). Mutually exclusive with --from/--to.
    #[arg(long)]
    as_of: Option<String>,
    #[arg(long)]
    limit: Option<usize>,
    #[arg(long)]
    split_at: Option<String>,
    #[arg(long)]
    train_frac: Option<f64>,
    #[arg(long)]
    out: Option<PathBuf>,
    #[arg(long)]
    min_dte: Option<f64>,
    #[arg(long)]
    max_dte: Option<f64>,
    #[arg(long)]
    json: bool,
},
```

`cmd_batch_backtest` flow (mirror SPEC data flow):

1. Validate flags / parse symbols.
2. `Config::from_env` soft-fallback like score-lab (empty Massive key OK).
3. `open_chain_store_for_cli` — on err: loud fail, no artifact.
4. Progress phases on stderr: `list → load → replay → write` (never titled as final report).
5. `select_and_replay`.
6. If no rows selected under window path → `EmptyCorpus`.
7. If split requested → `try_split`; on refuse → `SplitRefused` (includes `--as-of`+split).
8. Else build artifact (unsplit `split: null`) including `none_replayed` when applicable → emit.

Genre labeling: standing title `RESEARCH REPLAY — STORED SNAPSHOTS` (not score-lab diary).

- [ ] **Step 3:** PASS. Commit: `feat(batch-backtest): clap BatchBacktest + cmd wiring`.

**Reviewer probe:** `cargo run -p api-rust -- batch-backtest --help` lists flags; `score-lab --help`
still works.

---

### B8 — Structural isolation guards

**Files:** `apps/api/tests/batch_backtest_isolation.rs`; `apps/api/src/main.rs` `#[cfg(test)]`

**Why:** AC-7/8/17/20/23; `[structural-over-prose-enforcement]`.

- [ ] **Step 1: failing source-scan tests**

```rust
fn cmd_batch_backtest_body() -> &'static str {
    // slice main.rs from "async fn cmd_batch_backtest(" to next top-level fn — same pattern as
    // cmd_score_lab_body in main.rs
}

#[test]
fn cmd_batch_backtest_does_not_reference_massive_or_live_or_disabled_opener() {
    let body = cmd_batch_backtest_body();
    for needle in [
        "MassiveRestClient",
        "MarketDataPort::live",
        "ChainSnapshotStore::disabled",
        "open_chain_snapshot_store",
    ] {
        assert!(
            !body.contains(needle),
            "cmd_batch_backtest must not contain {needle}"
        );
    }
    assert!(body.contains("open_json") || body.contains("open_chain_store_for_cli"));
}

#[test]
fn cmd_score_lab_still_exists_and_does_not_open_chain_snapshot_store() {
    let body = /* reuse score-lab body slice */;
    assert!(body.contains("run_lab") || body.contains("strict_collect"));
    assert!(!body.contains("ChainSnapshotStore"));
    assert!(!body.contains("compute_analytics_from_vendor"));
}

#[test]
fn batch_backtest_module_does_not_import_massive_client() {
    let src = include_str!("../src/services/research/batch_backtest.rs");
    assert!(!src.contains("MassiveRestClient"));
    assert!(!src.contains("MarketDataPort::live"));
}
```

Anti-vacuity: assert the body slice length > 200 and contains `batch_backtest` / `select_and_replay`
so an empty slice cannot silently pass.

- [ ] **Step 2:** fix any accidental imports. Commit:
  `test(batch-backtest): structural zero-Massive + score-lab coexistence guards`.

---

### B9 — Hermetic integration harness (ship-blocking ACs)

**Files:** `apps/api/tests/batch_backtest_cli.rs`

**Why:** SPEC §7 — one fixture corpus → run → assert dispositions + zero vendor + second-run
identity + empty/missing/empty_book/`--as-of` miss.

- [ ] **Step 1: plant helpers**

```rust
async fn plant(store: &ChainSnapshotStore, symbol: &str, as_of: DateTime<Utc>, empty: bool) {
    let mut b = fixture_probe_bundle(symbol, as_of);
    if empty { b.market.contracts.clear(); }
    let wire = to_wire(&b);
    let bytes = serialize_capture(&wire).unwrap();
    // Use store.append(&wire, &bytes) on Memory/Json
    store.append(&wire, &bytes).await.unwrap();
}
```

Use **nanos-distinct** as_ofs. For AC-12 tests, pass the full
`1970-01-01T00:00:00.000000001Z` string — second-truncated will correctly miss (S2 minor).

- [ ] **Step 2: cover in one (or few) `#[tokio::test]` modules**

| Test focus | ACs |
|---|---|
| Happy unsplit multi-symbol + D-metrics keys on replayed rows | AC-1, AC-2, AC-3, AC-25 |
| Split success membership + two different cuts differ | AC-4, AC-5 |
| Split refuse (skipped-only side) + `--as-of`+split refuse | AC-6; S2 pin 4 |
| Vendor-call counter / structural zero Massive on list+replay | AC-7, AC-8 |
| Second run byte-identical measurement body (strip `run_stamp` / path) | AC-9 |
| Empty corpus console-only + per-symbol miss | AC-10, AC-11 |
| `--as-of` miss no substitute + disposition in artifact | AC-12; S2 pin 1 |
| Empty book literal + no score figure | AC-13 |
| Compute failure isolated | AC-14 |
| Partial multi-symbol `corpus_status` | AC-15 |
| Store open hard fail | AC-16 |
| `CHAIN_SNAPSHOT_ENABLED=false` but `open_json` path still replays | AC-17 |
| `authorizes == "nothing"`; no adoption verbs | AC-18, AC-19 |
| Live score/tier/fingerprint byte-identical after run (reuse `score_triple` pattern from `chain_snapshot_capture.rs`) | AC-20 |
| `--train-frac` `0` / `1` usage error | §5 |
| `--json` standing on stderr | AC-25 |
| Pages research routes untouched — compile-only / leave to conformance | AC-22 (V3) |

Drive the library entrypoint (`run_batch_backtest(...)`) directly in unit/integration tests; add
1–2 `Command::cargo_bin` / `clap` smoke parses if useful. Prefer library calls for hermetic
speed.

Expected: `cargo test -p api-rust --test batch_backtest_cli -- --nocapture` → exit 0.

- [ ] **Step 3:** PASS. Commit: `test(batch-backtest): hermetic AC harness`.

**Reviewer probe:** delete the measurement file assertion on empty corpus; force a
`none_replayed` `--as-of` miss and assert the file **exists** with `rows[0].disposition ==
"missing"`.

---

## Frontend track

### F1 — `NO_UI_CHANGE` structural enforcement

**Files:** `apps/dashboard/src/app/batch-backtest-cli.structural.spec.ts` (**create only**)

**Why:** AC-21, AC-22; SPEC §4 `NO_UI_CHANGE`. No product UI. Mirror
`chain-snapshot-capture.structural.spec.ts`.

- [ ] **Step 1: failing Vitest** (file missing → suite absent; create with assertions that bite)

```ts
/**
 * batch-backtest-cli F1 — NO_UI_CHANGE (AC-21, AC-22).
 * Pages 404 /api/_research non-regression + no trader chrome for batch replay +
 * no dashboard import of CLI/research replay helpers.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DASHBOARD_SOURCES = import.meta.glob(
  ['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}', '!**/*.test.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const TRADER_FORBIDDEN = [
  'batch-backtest',
  'batch_backtest',
  'BatchBacktest',
  'RESEARCH REPLAY — STORED SNAPSHOTS',
  'cmd_batch_backtest',
] as const;

// reuse Pages 404 helpers from chain-snapshot structural (duplicate minimal copies —
// do not import across spec files if Vitest isolation prefers local)

describe('F1 · no trader chrome for batch-backtest (AC-21)', () => {
  it('anti-vacuity — dashboard sources load', () => {
    expect(Object.keys(DASHBOARD_SOURCES).length).toBeGreaterThan(10);
  });

  it('trader sources do not mention batch-backtest / research replay chrome', () => {
    const hits: string[] = [];
    for (const [path, src] of Object.entries(DASHBOARD_SOURCES)) {
      for (const n of TRADER_FORBIDDEN) {
        if (src.includes(n)) hits.push(`${path}: ${n}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('mutation — injecting batch-backtest into a fake source is detected', () => {
    expect('export const x = "batch-backtest"'.includes('batch-backtest')).toBe(true);
  });
});

describe('F1 · Pages /api/_research 404 unchanged (AC-22)', () => {
  // identical assertions to chain-snapshot-capture.structural.spec.ts F1
  // (pathname === '/api/_research' && startsWith '/api/_research/')
});

describe('F1 · libs/api has no batch-backtest client', () => {
  it('convexa.ts does not grow a batch-backtest or _research replay helper', () => {
    const src = readFileSync(resolve(ROOT, 'libs/api/src/lib/convexa.ts'), 'utf8');
    expect(src.includes('batch-backtest')).toBe(false);
    expect(src.includes('batchBacktest')).toBe(false);
  });
});
```

- [ ] **Step 2:** run `npx nx test @convexa/dashboard --testPathPattern=batch-backtest-cli` →
  PASS. `npx nx typecheck @convexa/dashboard` → exit 0.

- [ ] **Step 3:** Commit: `test(batch-backtest): NO_UI_CHANGE structural guard`.

**Do not** edit `functions/api/[[path]].ts` unless F1 proves a regression (then fix + keep 404).

---

## Verification track

Run after B9 + F1. Record exit codes.

### V1 — Backend unit + integration

```powershell
cargo test -p api-rust batch_backtest -- --nocapture
cargo test -p api-rust --test batch_backtest_cli -- --nocapture
cargo test -p api-rust --test batch_backtest_isolation -- --nocapture
```

**Expect:** exit 0; AC tables in B9 covered; structural needles absent.

### V2 — Full api test + score-lab coexistence smoke

```powershell
cargo test -p api-rust -p quant-engine
cargo run -p api-rust -- score-lab --help
cargo run -p api-rust -- batch-backtest --help
```

**Expect:** exit 0; both helps print; score-lab is **not** removed/renamed.

### V3 — Frontend structural + typecheck

```powershell
npx nx test @convexa/dashboard --testPathPattern=batch-backtest-cli
npx nx typecheck @convexa/dashboard
```

**Expect:** exit 0 both. `git diff --name-only -- apps/dashboard` shows only the structural spec.

### V4 — Interface conformance (non-regression on capture research GETs)

```powershell
node .grok/tools/interface_conformance.mjs `
  --contract .spire/clusters/tech/contracts/batch-backtest-cli/INTERFACE_CONTRACT.md `
  --report .spire/clusters/tech/contracts/batch-backtest-cli/conformance-receipt.json
```

(Use the repo’s actual conformance runner invocation if the path differs — same as prior
chain-snapshot / score-lab features.)

**Expect:** PASS on the four re-pinned endpoints. Hit-probe seed failure → UNVERIFIABLE only for
that row; must not reshape envelopes.

### V5 — Manual / review checklist (AC-21, AC-23, AC-24, AC-27, AC-28)

- [ ] No trader nav/route for batch replay (F1 proves structurally).
- [ ] Report genre = stored-chain research replay (standing title), not score-lab diary.
- [ ] Artifact `corpus` carries symbols, as_of range / identities, split_rule_or_unsplit, run_stamp.
- [ ] Progress lines name phases and are not titled as the final research report.
- [ ] `Authorizes: nothing` on console + artifact after a successful measurement (including
      `none_replayed`).

---

## Dependency graph (within backend)

```
B1 types
 └─► B2 open/flags
      └─► B3 select+replay
           ├─► B4 counts/aggregates
           └─► B5 split
                └─► B6 emit
                     └─► B7 clap wiring
                          ├─► B8 isolation guards
                          └─► B9 integration harness
F1 ∥ B1…B9
V1…V5 after B9+F1
```

---

## Planning notes for lanes (carry-forward)

- Prefer calling `run_batch_backtest(store, opts) -> RunResult` from tests; keep `cmd_*` thin.
- Reuse `fixture_probe_bundle` / `to_wire` / `serialize_capture` / `capture_into` patterns from
  `apps/api/tests/chain_snapshot_capture.rs` — do not invent a second wire format.
- Tier derivation **must** call `evaluate_gate` (S2 pin 3); copying score bands alone is wrong.
- `--store` overrides **chain-snapshot** path, not score-lab’s scan/structure store (S2 minor
  footgun).
- AC-5 fixture needs ≥3 distinct **replayed** as_ofs.
- Mid-run `store.load` `Err` after successful open: treat as per-row `unreadable` and continue
  siblings (planning pin for the S2 minor gap).
