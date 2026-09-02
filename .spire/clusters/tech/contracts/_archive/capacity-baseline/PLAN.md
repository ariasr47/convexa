# capacity-baseline — implementation plan

> **For agentic workers:** implement task-by-task, in order inside a lane. Steps use checkbox
> (`- [ ]`) syntax. Each task carries its own TDD cycle: write the failing test → run it, watch it
> fail → implement minimally → run it, watch it pass → commit. If this plan contradicts the tree,
> **report the conflict — do not resolve it silently** (`PLAN_METHOD.md`, "Plans are code").
> Do not edit `SPEC.md` or `INTERFACE_CONTRACT.md`.

**Goal:** Give maintainers independently invocable `capacity load` and `capacity soak` commands that
drive ticker-bundle HTTP and live SSE against a throwaway loopback process with mocked vendors, fail
the process when a locked harness p95 / unexpected-error / stream-hold / timeout / refusal-probe
threshold is crossed, and write a receipt that cannot be quoted as a production measurement, paid-feed
test, SLO, or permission to change score, tier, fingerprint, or production runtime defaults.

**Architecture:** A one-way leaf `apps/api/src/services/capacity_harness/` plus clap nested
`capacity {load|soak}` in `apps/api/src/main.rs`. The driver constructs `AppState::for_capacity_harness`
(never `Config::from_env`, never `server::serve`, never `stock_worker.start()`), binds
`routes::router(hold)` and `routes::router(probe)` on two `127.0.0.1:0` listeners, HTTP-clients
existing ticker/SSE routes, injects loopback `StreamEvent`s on a harness-only hub whose `subscribe`
updates the symbol set and does **not** enqueue `HubCmd`, evaluates D1 locks, and writes
`data/capacity/capacity_{load|soak}_{stamp}.json`. Additive `vendor_fixture: Option<Arc<FixtureCatalog>>`
on `AppState` (`None` in production `construct`). Production HTTP graph, OpenAPI, `quant-engine`,
dashboard, and production `StockStreamHub::subscribe` enqueue behavior stay unchanged.

**Tech stack:** Rust 2021 · Axum/Tokio (`apps/api`, crate `api-rust`) · clap 4 · reqwest (loopback
HTTP/SSE client) · `cargo test -p api-rust -p quant-engine --locked` · Nx 23 uncached targets
`api:capacity-load` / `api:capacity-soak` · GitHub Actions backend job (load only). **Frontend:
`NO_UI_CHANGE` — zero-task track.**

**Spec:** `.spire/clusters/tech/contracts/capacity-baseline/SPEC.md` (APPROVED 2026-08-28)
**Interface:** `.spire/clusters/tech/contracts/capacity-baseline/INTERFACE_CONTRACT.md`

---

## Track map

| Track | Tasks | Notes |
|---|---|---|
| **Backend** (`apps/api`) | **B1 → B9** (B9 is the lane closer) | The only build track |
| **Frontend** (`apps/dashboard`) | **none — zero-task track by design** | SPEC §4 `NO_UI_CHANGE`. Do not invent dashboard files, copy-table literals, or Vitest. |
| **Verification** | **V1 → V8**, after B9 | Exact commands + expected output. GATE Q runs soak once (V8). |

**Sequencing.** B1 (foundation, `Independent: no`) and B2 (hub, `Independent: yes`) may start together.
B3 waits on B1+B2. B4 waits on B3 and may run without sharing B2's path. B5 waits on B1+B3+B4 (writes
`capacity_harness/mod.rs` with B1). B6 waits on B5. B7 waits on B5+B6. B8 waits on B6 and does not
share B7's paths. B9 waits on every other backend task and writes only the lane receipt.

**Soak wall clock.** Production `capacity soak` is **600 s**. `cargo test` must **not** run that hold
(SPEC: soak is absent from the default backend CI job; GATE Q invokes soak once). Isolation tests
prove soak *wiring* (profile constants, source scan, receipt renderer, follow-up helper). The named
command's 600 s pass is **V8 / GATE Q**, not B7.

**Cold p95 is a v1 lock, not a dial.** If `cold coalesced bundle GET wall` p95 exceeds **4000 ms** on
the implementer's box or CI, **STOP and report GATE Z** (numbered amendment). Do not auto-tune D1
inside the driver.

---

## Global Constraints

Every task's requirements implicitly include this section.

### Standing project constraints (each has bitten this repo)

- **Check EXIT CODES, not printed summaries.** PowerShell: `$LASTEXITCODE` after every gate command.
- **A green `nx test` does not mean TS types are sound** — this track is Rust; still run
  `cargo check -p api-rust --features postgres` in the closer so postgres-gated files compile.
- **Never run a bare `nx format:write`.** Scope it: `npx nx format:write --files path/a,path/b`.
  Rust is `cargo fmt -p api-rust` only.
- **Never write a literal NUL byte.** Verify generated receipts with
  `python -c "import io;print(io.open('FILE','rb').read().count(bytes([0])))"` → `0`.
- **Never `git stash`** while other sessions may hold uncommitted work.
- **Do not edit** `SPEC.md`, `INTERFACE_CONTRACT.md`, `libs/quant-engine/**`, `apps/dashboard/**`,
  generated `@convexa/api` artifacts, or other feature folders.
- **Cite live Rust** (`analytics.rs` four-fetch join, `LiveCapacity::try_admit` uses `>= max`,
  `StockStreamHub::subscribe` enqueues `HubCmd`, `AppState::for_tests` is the wrong constructor,
  `gex_SPY.json` `meta.contract_count: 14218`).

### Feature hard rules (settled — do not re-open)

- Commands are `load` | `soak`. Evidence is `local` | `ci`. **No clap flag relabels evidence.**
  `Evidence: ci` only when `GITHUB_ACTIONS` is truthy **or** `CONVEXA_CAPACITY_CI_STEP` is truthy
  (workflow-only; set only in the capacity CI step). Ambient `CI=true` prints `local`.
- Load hold: **16** warm HTTP, **8** per-ticker SSE + **1** prices SSE, LiveCapacity **9 / 4**,
  wall **20 s** HTTP + **5 s** SSE + refusal probe, total **< 60 s**. 9 admits succeed at ceiling 9.
- Soak hold: **8** HTTP + **32** per-ticker SSE + non-zero prices SSE, **600 s**, production
  **500 / 50** on the hold instance (**under**; never mutate). Follow-up ticker-analysis on the
  **hold** instance before teardown.
- Overflow is always a **dedicated probe AppState** + **second** `127.0.0.1:0` bind of
  `routes::router(probe)`. Never a 10th client on the 9-holder, never 501 connections, never
  ceiling setter, never tower oneshot, never skip HTTP.
- Probe ceilings locked here: `LiveCapacity::new(1, 3)` (sessions=1, subscribers=3). Receipt prints
  them as **this process, not production defaults**.
- D1 fail-lines (successful samples of **that** named scenario only; no blended ticker-analysis p95;
  prices samples not mixed into per-ticker percentiles):

  | Basis (exact) | Fail-line |
  |---|---|
  | `warm cache-hit bundle GET wall` | p95 ≤ 150 ms |
  | `cold coalesced bundle GET wall` | p95 ≤ 4000 ms |
  | `per-ticker SSE time-to-first-byte` | p95 ≤ 200 ms |
  | `per-ticker SSE emit after inject` | p95 ≤ 500 ms |
  | `prices SSE time-to-first-byte` | p95 ≤ 200 ms |
  | `prices SSE emit after inject` | p95 ≤ 500 ms |

- Also fail: unexpected-error = 0 (probe 503s excluded), `unexpected stream-hold drops` = 0,
  `client timeout` = 0, hold-phase subscriber- and session-ceiling refusals = 0, overflow every
  attempt HTTP 503 + `Retry-After: 30` (zero refusals = vacuous FAIL), `request_count == 0`,
  post-shutdown `subscriber_count == 0`, identity skip = fail.
- Identity: oracle Path-B **before** driven work; post-work warm HTTP **score/tier/fingerprint
  triple** (not full envelope) **and** second in-process Path-B, each byte-identical to that
  oracle. Matching triple cannot turn a capacity FAIL into PASS. Source scan allows equality-to-oracle
  and forbids score-as-threshold.
- Fixture: `libs/quant-engine/tests/fixtures/gex_SPY.json`, refuse if `contracts.len() < 1000`
  (or `meta.contract_count` present and below floor). **No `syn_mini` fallback.**
- Harness never calls `server::serve`, `stock_worker.start()`, `Config::from_env`,
  `MassiveRestClient` fetch methods, `MarketDataPort::live`, or `connect_async`. Dummy key +
  `rest_base = "http://127.0.0.1:1"` + `request_count == 0`.
- Bind **`127.0.0.1:0` only** — never `0.0.0.0`, never `localhost` (IPv6 `[::1]` trap).
- Standing title is `CAPACITY HARNESS`, never `RESEARCH READ` / `RESEARCH REPLAY`.
  `MOCKED VENDORS` only when mock is vouched. `[BLOCKED]` vendor-leak title must **not** claim it.
- Production defaults untouched: `MAX_LIVE_SUBSCRIBERS=500`, `MAX_LIVE_SESSIONS=50`, Retry-After 30,
  `PUBLIC_RATE_LIMIT_PER_MIN=120`. Trader 503 detail stays
  `Live streaming is at capacity. Try again shortly.`
- `NO_UI_CHANGE`. No new HTTP operations. Empty `quant-engine` diff. Empty dashboard source diff.

### Interface contract (verbatim)

The block below is copied **verbatim** from `INTERFACE_CONTRACT.md` `## Conformance spec` so both
lanes inherit the same binding shape (GATE PLAN law). Empty `endpoints` is intentional:
**no production HTTP contract is introduced or amended**. It is not a claim that `api-rust` is
untouched.

## Conformance spec

```json
{
  "endpoints": []
}
```

The empty endpoint set is intentional and machine-checkable: **no production HTTP contract is introduced or amended**. It is not a claim that `api-rust` is untouched. Runtime load/soak evidence is the named CLI, exit code, and capacity receipt under `SPEC.md`; those runs must not be used as live API conformance against Massive.

---

## Locked literals (copy these; do not paraphrase)

**Surfaces (join with ` · ` only those that actually executed):**
`ticker-analysis HTTP` · `per-ticker SSE` · `prices SSE`

**Outcome classes (exact):** `ok` · `subscriber-ceiling refusal` · `session-ceiling refusal` ·
`rate-limit refusal` · `unexpected error` · `unexpected stream-hold drops` · `client timeout`

**p95 function:** sort successful samples ascending as `f64` ms; if empty, that scenario has no p95
(treat as FAIL / not a blended skip). Else
`sorted[((n - 1) as f64 * 0.95).floor() as usize]`. Unit **ms**, label **harness p95**.

**Evidence classifier** (`apps/api/src/services/capacity_harness/evidence.rs`):

```rust
pub fn classify_evidence() -> Evidence {
    fn truthy(name: &str) -> bool {
        std::env::var(name)
            .ok()
            .map(|v| {
                let t = v.trim();
                !t.is_empty() && t != "0" && !t.eq_ignore_ascii_case("false")
            })
            .unwrap_or(false)
    }
    if truthy("GITHUB_ACTIONS") || truthy("CONVEXA_CAPACITY_CI_STEP") {
        Evidence::Ci
    } else {
        Evidence::Local
    }
}
```

**Locked spans:** load = `20s warm HTTP + 5s SSE hold + refusal probe`; soak = `600s`.

**Closing line:** `CAPACITY HARNESS — NOT A PRODUCTION MEASUREMENT · Authorizes: nothing`

**Pass verdict (exact):**
`[PASS] {load|soak} — harness p95 within locks · unexpected errors 0 · unexpected stream-hold drops 0 · client timeout 0 · overflow probe 503 + Retry-After 30 · vendor I/O stayed in-process · not a production measurement`

**Load `[NOT RUN]` (exact):**
`[NOT RUN] soak — not part of this command. {ci|local} load evidence is not soak evidence.`

**Running (stderr, not a receipt title):**
`[RUNNING] {load|soak} — {elapsed} / {locked_span} — no verdict yet`

Vouched standing block, blocked standing block, and every `[FAIL]` / `[BLOCKED]` / `[INCOMPLETE]` /
`[ERROR]` / identity-fail line: copy SPEC §4 tables byte-for-byte (including
`harness locks — not production SLOs` and `this process (not production defaults)`).

**Banned in emitted strings (scan the run's own stdout + receipt):**
`production test`, `live load test`, `Massive soak`, `SLO`, `SLA`, `benchmark of production`,
`production ready`, `verified`, `certified`, `can handle`, `Railway`, `the live site`,
`our capacity`, `Massive latency`, `paid feed`, `live Options`, `vendor p95`,
`/api/_metrics`, `Massive p95`, `RESEARCH READ`, `RESEARCH REPLAY`, `● Live`, `WCAG`,
`pixel perfect`, `raise MAX_LIVE_SUBSCRIBERS`, `ship this p95`, `hosted production evidence`,
`results dashboard`, `metrics snapshot`, `production report`, `production ceiling`,
`certified limit`. Also forbid `MOCKED VENDORS` on a `[BLOCKED]` vendor-leak title, and
`0 requests selected` when any surface executed.

---

# Backend track

## B1 — Receipt types, standing, thresholds, evidence, golden loader

**Files:**
- `apps/api/src/services/mod.rs` (add `pub mod capacity_harness;`)
- `apps/api/src/services/capacity_harness/mod.rs`
- `apps/api/src/services/capacity_harness/types.rs`
- `apps/api/src/services/capacity_harness/evidence.rs`
- `apps/api/src/services/capacity_harness/standing.rs`
- `apps/api/src/services/capacity_harness/thresholds.rs`
- `apps/api/src/services/capacity_harness/receipt.rs`
- `apps/api/src/services/capacity_harness/fixture.rs`

**Depends on:** none. **Independent:** no (foundation).

### Tests first

Add `#[cfg(test)]` modules in `standing.rs`, `thresholds.rs`, `evidence.rs`, `fixture.rs`, `receipt.rs`.

```rust
// evidence.rs tests
#[test]
fn ambient_ci_true_without_github_actions_is_local() {
    // Use a child-process OR document that classify_evidence reads process env:
    // this unit test calls a test helper `classify_with` that takes a map.
}
```

Implement `classify_with(vars: &[(&str, &str)])` used by `classify_evidence()` so tests do not
mutate process env:

- `CI=true` only → `local`
- `GITHUB_ACTIONS=true` → `ci`
- `CONVEXA_CAPACITY_CI_STEP=1` → `ci`
- empty → `local`

```rust
// thresholds.rs
#[test]
fn p95_uses_successful_samples_only_and_named_basis() {
    let warm = vec![10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0, 100.0];
    assert!(p95_ms(&warm) <= 150.0);
    assert_eq!(BASIS_WARM, "warm cache-hit bundle GET wall");
}

#[test]
fn crossing_warm_p95_names_the_warm_lock() {
    let r = evaluate_thresholds(&forced_warm(200.0));
    assert!(r.failed.iter().any(|f| f.lock.contains("warm cache-hit bundle GET wall")));
}

#[test]
fn empty_samples_do_not_emit_a_blended_ticker_analysis_p95() {
    let text = render_p95_block(&empty_scenarios());
    assert!(!text.to_ascii_lowercase().contains("ticker-analysis p95"));
    assert!(!text.contains("/api/_metrics"));
}
```

```rust
// standing.rs
#[test]
fn vouched_standing_starts_with_capacity_harness_mocked_vendors() {
    let s = render_standing_vouched(&sample_ids(Command::Load, Evidence::Local, 9, 4, 1, 3));
    assert!(s.starts_with("CAPACITY HARNESS — MOCKED VENDORS · NOT A PRODUCTION MEASUREMENT"));
    assert!(s.contains("this process (not production defaults)"));
    assert!(s.contains("harness locks — not production SLOs"));
    assert!(s.contains("client timeout = 0"));
    assert!(s.contains("unexpected stream-hold drops = 0"));
    assert!(s.contains("Authorizes:  nothing"));
}

#[test]
fn blocked_standing_must_not_claim_mocked_vendors() {
    let s = render_standing_blocked(&sample_ids(Command::Load, Evidence::Local, 9, 4, 1, 3));
    assert!(s.starts_with("CAPACITY HARNESS — NOT A PRODUCTION MEASUREMENT"));
    assert!(!s.contains("MOCKED VENDORS"));
    assert!(!s.contains("in-process mock · 0 outbound vendor calls"));
}

#[test]
fn load_receipt_cannot_print_command_soak() {
    let rec = render_measurement(&load_pass_record());
    assert!(rec.contains("Command:     load"));
    assert!(!rec.contains("Command:     soak"));
}
```

```rust
// fixture.rs — point at syn_mini and a missing path
#[test]
fn syn_mini_is_refused_below_floor() {
    let p = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/market/syn_mini.json");
    let err = load_capacity_book(&p).unwrap_err();
    assert!(err.to_string().contains("1000") || err.to_string().contains("contract"));
}

#[test]
fn missing_golden_is_a_hard_error() {
    assert!(load_capacity_book(Path::new("no-such-gex.json")).is_err());
}

#[test]
fn gex_spy_loads_and_clears_the_floor() {
    let p = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../libs/quant-engine/tests/fixtures/gex_SPY.json");
    let book = load_capacity_book(&p).expect("golden");
    assert!(book.contracts.len() >= 1000);
    assert_eq!(book.ticker, "SPY");
}
```

```rust
// receipt.rs
#[test]
fn omitted_standing_fails_the_parser() {
    let raw = r#"{"command":"load","verdict":"PASS"}"#;
    assert!(parse_receipt(raw).is_err());
}

#[test]
fn short_non_measurement_has_no_p95_table() {
    let rec = render_short(Verdict::Vacuous, Command::Load, Evidence::Local);
    assert!(rec.contains("No pass recorded"));
    assert!(!rec.contains("harness p95 warm"));
    assert!(!rec.contains("observed p95"));
}

#[test]
fn pass_receipt_carries_identity_three_fields_and_ticker_inventory() {
    let j = serde_json::to_value(&sample_pass_json()).unwrap();
    assert!(j.get("identity_oracle").is_some());
    assert!(j.get("identity_http").is_some());
    assert!(j.get("identity_path_b").is_some());
    let inv = j["ticker_analysis_request_tickers"].as_array().unwrap();
    assert!(inv.iter().all(|t| t.as_str() == Some("SPY")));
}
```

Run (expect FAIL / compile-fail):

```
cargo test -p api-rust --lib capacity_harness -- --nocapture
```

### Implement

`mod.rs`:

```rust
//! One-way capacity load/soak leaf. Not imported by quant-engine, signals, routes, or server::serve.

pub mod evidence;
pub mod fixture;
pub mod receipt;
pub mod standing;
pub mod thresholds;
pub mod types;

pub use evidence::{classify_evidence, classify_with, Evidence};
pub use types::{Command, IdentityTriple, OutcomeClass};
```

`types.rs` — closed enums `Command { Load, Soak }`, `Evidence { Local, Ci }`, `Verdict { Pass, Fail, Blocked, Incomplete, Error, Vacuous, Partial }`, `OutcomeClass` with the seven exact serde/display literals, `IdentityTriple { opportunity_score: i32, opportunity_tier: String, state_fingerprint: String }`, `ScenarioName` with the six basis strings as associated constants, `CapacityProfile` with the locked numbers:

```rust
pub const LOAD_WARM_HTTP: usize = 16;
pub const LOAD_PER_TICKER_SSE: usize = 8;
pub const LOAD_PRICES_SSE: usize = 1;
pub const LOAD_HOLD_SUBSCRIBERS: usize = 9;
pub const LOAD_HOLD_SESSIONS: usize = 4;
pub const LOAD_HTTP_HOLD: Duration = Duration::from_secs(20);
pub const LOAD_SSE_HOLD: Duration = Duration::from_secs(5);
pub const SOAK_HTTP: usize = 8;
pub const SOAK_PER_TICKER_SSE: usize = 32;
pub const SOAK_PRICES_SSE: usize = 1;
pub const SOAK_HOLD_SUBSCRIBERS: usize = 500;
pub const SOAK_HOLD_SESSIONS: usize = 50;
pub const SOAK_HOLD: Duration = Duration::from_secs(600);
pub const PROBE_SESSIONS: usize = 1;
pub const PROBE_SUBSCRIBERS: usize = 3;
pub const CONTRACT_FLOOR: usize = 1000;
pub const WARM_P95_MS: f64 = 150.0;
pub const COLD_P95_MS: f64 = 4000.0;
pub const SSE_TTFB_P95_MS: f64 = 200.0;
pub const SSE_EMIT_P95_MS: f64 = 500.0;
```

`fixture.rs` — deserialize the golden the way `main.rs` `GoldenFixture` already does (`ticker`, `as_of`, `spot`, `contracts`, optional `meta.contract_count`). Adapt to `VendorBundle` with empty daily/minutes/trades, `MarketDataSourceKind::Fixture`, `synchronized_spot = spot`, `current_spot = spot`, `atm_iv` from `meta.atm_iv` if present else `0.2`. Refuse missing file, unreadable JSON, `contracts.len() < 1000`, or `meta.contract_count < 1000` when that key is present. Build a `FixtureCatalog` with one SPY insert so `AppState.vendor_fixture` can hold it.

`standing.rs` / `receipt.rs` — render the SPEC §4 vouched and blocked blocks; JSON receipt with `standing` first field; short non-measurement record; measurement record with per-scenario p95, class counts (always include `rate-limit refusal` as `0` when limiter off — never blank/`n/a`), process-local ceilings (hold vs probe), two bind addresses, `request_count`, `host_os`, `ticker_analysis_request_tickers`, identity three fields, soak follow-up flag.

`thresholds.rs` — `p95_ms`, `evaluate_thresholds`, named fail lock strings.

Also export `BANNED_EMIT_NEEDLES: &[&str]` for the anti-SLO scan.

Run until green:

```
cargo test -p api-rust --lib capacity_harness -- --nocapture
```

`$LASTEXITCODE` must be 0. `cargo fmt -p api-rust`. Commit.

**Reviewer probes:** mutate standing to drop `MOCKED VENDORS` on a pass render (test fails); add `--evidence` type anywhere in these files (later isolation forbids it); load a 999-contract slice (refuse); compute p95 mixing cold+warm in one vec (forbidden by API: separate scenario fields).

---

## B2 — Harness-only hub: subscribe updates symbols, does not enqueue `HubCmd`

**Files:** `apps/api/src/infrastructure/massive/ws.rs`

**Depends on:** none. **Independent:** yes.

Production `StockStreamHub::subscribe` on the live server must **still enqueue** `HubCmd`. Do not change `admit_and_subscribe`. Additive inner flag only.

### Tests first

At the bottom of `ws.rs` `#[cfg(test)]`:

```rust
#[tokio::test]
async fn production_dormant_subscribe_still_enqueues_hubcmd() {
    let cfg = crate::state::test_stub_config();
    let (hub, _worker) = StockStreamHub::dormant(&cfg);
    hub.subscribe(&["SPY".into()]).await.unwrap();
    assert_eq!(hub.cmds_enqueued(), 1);
    assert_eq!(hub.symbol_count().await, 1);
}

#[tokio::test]
async fn harness_local_subscribe_updates_symbols_and_does_not_enqueue() {
    let hub = StockStreamHub::harness_local();
    hub.subscribe(&["SPY".into()]).await.unwrap();
    hub.subscribe(&["SPY".into(), "QQQ".into()]).await.unwrap();
    assert_eq!(hub.symbol_count().await, 2);
    assert_eq!(hub.cmds_enqueued(), 0);
}

#[tokio::test]
async fn harness_publish_reaches_subscribers() {
    let hub = StockStreamHub::harness_local();
    let mut rx = hub.subscribe_events();
    hub.publish_event(crate::domain::StreamEvent {
        symbol: "SPY".into(),
        kind: crate::domain::StreamKind::Quote,
        ts_ns: 1,
        price: None,
        size: None,
        bid: Some(100.0),
        ask: Some(100.02),
        bid_size: None,
        ask_size: None,
    });
    let ev = tokio::time::timeout(Duration::from_millis(200), rx.recv())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(ev.symbol, "SPY");
}
```

Run `cargo test -p api-rust stock_stream_hub -- --nocapture` (or the module path that exists after you name the tests). Expect FAIL (no `harness_local`).

### Implement

On `HubInner` add:

```rust
emit_hub_cmd: bool,
cmds_enqueued: std::sync::atomic::AtomicU64,
```

`dormant` sets `emit_hub_cmd: true`. New:

```rust
pub fn harness_local() -> Self {
    let cfg = /* dummy Config: empty key, DataFeed::Delayed — do not call Config::from_env */;
    let (cmd_tx, _cmd_rx) = mpsc::unbounded_channel();
    let (event_tx, _) = broadcast::channel(BROADCAST_CAPACITY);
    Self {
        inner: Arc::new(HubInner {
            api_key: String::new(),
            feed: DataFeed::Delayed,
            cmd_tx,
            event_tx,
            symbols: RwLock::new(HashSet::new()),
            emit_hub_cmd: false,
            cmds_enqueued: AtomicU64::new(0),
        }),
    }
}

pub fn cmds_enqueued(&self) -> u64 {
    self.inner.cmds_enqueued.load(Ordering::Relaxed)
}

pub fn publish_event(&self, ev: StreamEvent) {
    let _ = self.inner.event_tx.send(ev);
}
```

`subscribe` after inserting symbols:

```rust
if self.inner.emit_hub_cmd {
    self.inner.cmds_enqueued.fetch_add(1, Ordering::Relaxed);
    self.inner
        .cmd_tx
        .send(HubCmd::Subscribe(up))
        .map_err(|e| AppError::Massive(format!("hub cmd: {e}")))?;
}
Ok(())
```

`test_stub_config` is `pub(crate)` in `state.rs` — either duplicate a tiny dummy `Config` in `harness_local` (preferred; do not create a `state` → `ws` cycle) or pass `&Config`. **Do not call `Config::from_env`.** Copy the `test_stub_config` field list only if you must; `harness_local` should not need a full `Config` if `HubInner` only stores `api_key` + `feed`.

`dormant` must set `cmds_enqueued: AtomicU64::new(0)` and `emit_hub_cmd: true` so production tests and `for_tests` still enqueue.

Run tests green. `cargo fmt -p api-rust`. Commit.

**Reviewer probes:** `emit_hub_cmd: true` path still `send(HubCmd::Subscribe)` (grep). `admit_and_subscribe` body unchanged. No `connect_async` added on this constructor.

---

## B3 — `vendor_fixture` + `AppState::for_capacity_harness`

**Files:** `apps/api/src/state.rs`

**Depends on:** B1, B2. **Independent:** no.

### Tests first

In `state.rs` `#[cfg(test)]` (or a focused module):

```rust
#[tokio::test]
async fn for_tests_leaves_vendor_fixture_none() {
    let s = AppState::for_tests(
        crate::services::chain_snapshot::ChainSnapshotStore::memory(),
        crate::services::session_chain_archive::SessionChainArchive::memory(),
    )
    .await
    .unwrap();
    assert!(s.vendor_fixture.is_none());
    assert_eq!(s.live_capacity.max_subscribers(), 0);
}

#[tokio::test]
async fn for_capacity_harness_sets_fixture_ceilings_limiter_and_harness_hub() {
    let book = crate::services::capacity_harness::fixture::load_capacity_book(&golden_path()).unwrap();
    let s = AppState::for_capacity_harness(book.catalog, 4, 9)
        .await
        .unwrap();
    assert!(s.vendor_fixture.is_some());
    assert_eq!(s.live_capacity.max_subscribers(), 9);
    assert_eq!(s.live_capacity.max_sessions(), 4);
    assert_eq!(s.config.public_rate_limit_per_min, 0);
    assert_eq!(s.config.rest_base, "http://127.0.0.1:1");
    assert!(!s.config.warm_enabled && !s.config.scan_enabled);
    assert_eq!(s.stock_hub.cmds_enqueued(), 0);
    s.stock_hub.subscribe(&["SPY".into()]).await.unwrap();
    assert_eq!(s.stock_hub.cmds_enqueued(), 0);
    assert_ne!(s.config.rest_base, "https://api.massive.com");
}

#[tokio::test]
async fn for_capacity_harness_refuses_app_env_prod() {
    std::env::set_var("APP_ENV", "prod");
    let book = crate::services::capacity_harness::fixture::load_capacity_book(&golden_path()).unwrap();
    let err = AppState::for_capacity_harness(book.catalog, 4, 9).await.err();
    std::env::remove_var("APP_ENV");
    assert!(err.is_some());
}
```

**Do not** use `set_var` if another test relies on `APP_ENV` concurrently — prefer a `for_capacity_harness_with_env` that takes `app_env: Option<&str>` internally, and production `for_capacity_harness` reads `std::env::var("APP_ENV")`. The prod-refuse test then calls the inner function with `Some("prod")`.

Also a unit test that `construct` path sets `vendor_fixture: None` (source scan in B7 is the structural proof; here assert a freshly constructed `for_runtime_guardrail_tests` is `None`).

Run `cargo test -p api-rust --lib for_capacity_harness -- --nocapture` — expect FAIL.

### Implement

Add on `AppState`:

```rust
/// `None` in production `construct`. `Some` only on `for_capacity_harness` / probe constructor.
pub vendor_fixture: Option<std::sync::Arc<crate::services::market_data::FixtureCatalog>>,
```

`construct` and `for_tests_with_config`: `vendor_fixture: None`.

After assembling `Self` in `construct`, if `production && self.vendor_fixture.is_some()` return
`AppError::Config("production construct refuses vendor_fixture=Some".into())`. (Today the field is
always `None` here; the guard is the poison that B7 / a unit test can trip via a `#[cfg(test)]`
helper `construct_with_fixture_for_poison` that sets Some + production=true.)

`for_capacity_harness`:

```rust
pub async fn for_capacity_harness(
    catalog: std::sync::Arc<crate::services::market_data::FixtureCatalog>,
    max_sessions: usize,
    max_subscribers: usize,
) -> AppResult<Self> {
    if std::env::var("APP_ENV").ok().as_deref() == Some("prod") {
        return Err(crate::error::AppError::Config(
            "capacity harness refuses APP_ENV=prod".into(),
        ));
    }
    let mut config = test_stub_config();
    config.massive_api_key = "capacity-harness-dummy-not-a-secret".into();
    config.rest_base = "http://127.0.0.1:1".into();
    config.warm_enabled = false;
    config.scan_enabled = false;
    config.chain_snapshot_enabled = false;
    config.session_chain_archive_enabled = false;
    config.liquid_session_ensure_enabled = false;
    config.public_rate_limit_per_min = 0;
    config.include_dark_pool = false;
    config.max_live_sessions = max_sessions;
    config.max_live_subscribers = max_subscribers;
    config.redis_url = None;
    // Refuse a constructor that would use the paid host or the process paid key as the fetch key.
    if config.rest_base.contains("massive.com") {
        return Err(crate::error::AppError::Config(
            "capacity harness refuses live Massive rest_base".into(),
        ));
    }
    if let Ok(env_key) = std::env::var("MASSIVE_API_KEY") {
        if !env_key.is_empty() && config.massive_api_key == env_key {
            return Err(crate::error::AppError::Config(
                "capacity harness refuses MASSIVE_API_KEY as the fetch key".into(),
            ));
        }
    }

    let prices = PriceCache::connect(None).await?;
    let massive = MassiveRestClient::new(&config)?;
    let gex_cache = GexCache::new(config.clone());
    // ... same auth/iv/scan memory wiring as for_tests_with_config ...
    let stock_hub = StockStreamHub::harness_local();
    let (_unused_hub, stock_worker) = StockStreamHub::dormant(&config);
    let stock_worker = Arc::new(StockStreamWorkerStarter::new(stock_worker));
    // Intentionally never call stock_worker.start().
    Ok(Self {
        config: Arc::new(config),
        prices,
        massive,
        gex_cache,
        gex_flight: GexFlight::new(),
        scan: ScanStore::memory(),
        universe: None,
        auth, broker,
        iv_store: IvStore::open(&unique_temp_iv_path())?,
        stock_hub,
        stock_worker,
        live_capacity: LiveCapacity::new(max_sessions, max_subscribers),
        rate_limiter: Arc::new(RateLimiter::new(0)),
        chain_snapshots: ChainSnapshotStore::disabled(),
        session_archive: SessionChainArchive::disabled(), // use the existing disabled/memory opener
        ensure_wake: EnsureWake::default(),
        ensure_gate: Arc::new(EnsureGate::new()),
        vendor_fixture: Some(catalog),
        #[cfg(feature = "postgres")]
        pg: None,
    })
}
```

Check live names for `ChainSnapshotStore::disabled` / `SessionChainArchive` not-storing constructors (`disabled` vs `memory`). Use whichever already means capture Disabled. Do **not** call `Config::from_env`.

Add `AppState::quick_live_price(&self, sym: &str)`:

```rust
pub async fn quick_live_price(&self, sym: &str) -> AppResult<crate::domain::LivePrice> {
    if let Some(cat) = &self.vendor_fixture {
        let b = cat.resolve(sym, None)?;
        return Ok(crate::domain::LivePrice {
            symbol: b.market.ticker.clone(),
            price: b.market.current_spot,
            bid: None,
            ask: None,
            ts_ns: b.market.timestamp,
            received_at: chrono::Utc::now().timestamp(),
        });
    }
    self.massive.fetch_quick_live_price(sym).await
}
```

When `None`, this is the existing fetch (byte-identical call). B4 switches call sites to this method.

If `SessionChainArchive::disabled` does not exist, use `memory()` **and** `config.session_chain_archive_enabled = false` so capture is off. Report a tree conflict if neither exists.

Run tests green. Update every `AppState { ... }` struct literal in this file with `vendor_fixture: None`. Commit.

**Reviewer probes:** `for_tests` still `LiveCapacity::new(0, 0)` and `rest_base` `https://api.massive.com` (unchanged wrong constructor). Production `construct` never reads a fixture path. Dummy key never equals a canary `MASSIVE_API_KEY` in the happy path.

---

## B4 — Fixture arm on Path B (`None` = today's four-fetch join)

**Files:**
- `apps/api/src/services/analytics.rs`
- `apps/api/src/routes/ticker.rs`
- `apps/api/src/routes/price.rs`

**Depends on:** B3. **Independent:** yes.

### Tests first

In `analytics.rs` `hermetic_tests` (already exists):

```rust
#[tokio::test]
async fn vendor_fixture_some_skips_massive_fetch_and_keeps_none_arm_intact() {
    // Build AppState via for_capacity_harness; call load_analytics("SPY").
    // assert massive.request_count() == 0
    // assert snapshot.contract_count >= 1000
}

#[tokio::test]
async fn vendor_fixture_none_still_calls_the_four_fetch_join() {
    // Source assertion: the None arm still contains fetch_options_market_state,
    // fetch_daily_bars, fetch_intraday_bars, fetch_recent_trades in one tokio::join!.
    let src = include_str!("analytics.rs");
    let start = src.find("async fn compute_analytics(").unwrap();
    let body = &src[start..];
    assert!(body.contains("state.massive.fetch_options_market_state(sym)"));
    assert!(body.contains("state.massive.fetch_daily_bars(sym, 400)"));
    assert!(body.contains("state.massive.fetch_intraday_bars(sym)"));
    assert!(body.contains("state.massive.fetch_recent_trades"));
}
```

The Some-arm integration test needs `for_capacity_harness` + `load_analytics`. Keep it in `analytics.rs` or a small `#[cfg(test)]` here.

Run `cargo test -p api-rust --lib vendor_fixture -- --nocapture` — expect FAIL (no Some arm).

### Implement

At the top of `compute_analytics`, **before** the existing `tokio::join!`:

```rust
if let Some(cat) = &state.vendor_fixture {
    let vendor = cat.resolve(sym, None)?;
    let params = AnalyticsComputeParams {
        min_dte,
        max_dte,
        include_dark_pool: state.config.include_dark_pool,
        block_min_shares: state.config.block_min_shares,
        ttl_secs: state.config.gex_ttl_for(sym).as_secs(),
        iv_rank_enabled: false,
    };
    let snap = compute_analytics_from_vendor(&vendor, &params, None).await?;
    return Ok((snap, vendor));
}
```

Leave the four-fetch join **byte-identical** in the `None` path (no reformat that hides a behavior change). Do **not** rewire onto `MarketDataPort::Live`.

Switch:

- `analytics.rs` `refresh_analytics` (`state.massive.fetch_quick_live_price` → `state.quick_live_price`)
- `routes/ticker.rs` `resolve_price_fast`
- `routes/price.rs` cold snapshot

When `vendor_fixture` is `None`, those still hit `MassiveRestClient`. Driven capacity surface is `GET /api/ticker/{ticker}` (`load_analytics`); the wrap is so a leaked price fetch cannot burn Massive.

Run:

```
cargo test -p api-rust --lib vendor_fixture -- --nocapture
cargo test -p api-rust --lib hermetic_tests -- --nocapture
```

`$LASTEXITCODE` 0. Commit.

**Reviewer probes:** `MarketDataPort::live` does not appear in `compute_analytics`. `None` arm still `tokio::join!` of the four fetches. `quant-engine` untouched.

---

## B5 — Driver: two loopback binds, HTTP/SSE clients, inject, overflow, identity, run loop

**Files:**
- `apps/api/src/services/capacity_harness/mod.rs` (export new mods)
- `apps/api/src/services/capacity_harness/identity.rs`
- `apps/api/src/services/capacity_harness/inject.rs`
- `apps/api/src/services/capacity_harness/clients.rs`
- `apps/api/src/services/capacity_harness/overflow.rs`
- `apps/api/src/services/capacity_harness/run.rs`

**Depends on:** B1, B3, B4. **Independent:** no (`mod.rs` overlap with B1).

This is the product body. Tests live next to the code **and** are expanded in B7; B5 must still red-green its own unit/integration tests so the module compiles and the load path can pass in-process.

### Tests first (B5-local)

```rust
// identity.rs — mirror apps/api/tests/score_identity.rs triple extraction
#[tokio::test]
async fn path_b_oracle_on_golden_is_stable_and_not_compared_only_to_itself() {
    let book = load_capacity_book(&golden_path()).unwrap();
    let a = identity_from_vendor(&book.vendor).await.unwrap();
    let b = identity_from_vendor(&book.vendor).await.unwrap();
    assert_eq!(a, b);
}

// overflow.rs
#[tokio::test]
async fn overflow_is_http_503_retry_after_30_on_the_probe_listener_not_oneshot() {
    // boot probe AppState LiveCapacity::new(1, 3); bind 127.0.0.1:0; reqwest GET /api/stream/SPY × 4
    // first 3 connect (SSE), 4th status 503, header Retry-After = 30
    // assert the 503 URL host:port equals probe_addr, not hold_addr
}

#[tokio::test]
async fn session_ceiling_one_admits_many_on_one_ticker_and_refuses_a_second_ticker() {
    // probe sessions=1 subscribers=3; two GET /api/stream/SPY admit; GET /api/stream/QQQ → 503
}

#[tokio::test]
async fn overflow_all_admit_is_vacuous_fail() {
    let report = evaluate_overflow(&OverflowObservation { subscriber_503: 0, session_503: 0, .. });
    assert!(!report.ok);
}

// clients.rs
#[tokio::test]
async fn bind_is_127_0_0_1_never_localhost_or_unspecified() {
    let src = include_str!("run.rs");
    assert!(src.contains("127.0.0.1:0"));
    assert!(!src.contains("0.0.0.0"));
    assert!(!src.contains("localhost"));
}

#[tokio::test]
async fn ticker_requests_are_single_symbol() {
    let inv = vec!["SPY".to_string(), "SPY".to_string()];
    assert!(inv.iter().all(|s| s == "SPY"));
}
```

Run `cargo test -p api-rust --lib capacity_harness -- --nocapture` — expect FAIL.

### Implement

**Identity** (`identity.rs`): copy the `score_identity.rs` / `build_bundle` scoring path with `dark_pool = false` (harness `include_dark_pool=false` ⇒ `resolve_dark_pool` is false ⇒ HTTP re-scores via `generate_signals(&ms_in, None)`):

```rust
pub async fn identity_from_vendor(
    vendor: &crate::services::market_data::VendorBundle,
) -> AppResult<IdentityTriple> {
    let params = AnalyticsComputeParams {
        include_dark_pool: false,
        iv_rank_enabled: false,
        ..AnalyticsComputeParams::default()
    };
    let snap = compute_analytics_from_vendor(vendor, &params, None).await?;
    Ok(triple_from_snapshot(&snap, snap.display_spot))
}

pub fn triple_from_http_json(body: &serde_json::Value) -> Result<IdentityTriple, String> {
    let score = body["signals"]["opportunity_score"]
        .as_i64()
        .ok_or("http-skip")? as i32;
    let tier = body["signals"]["opportunity_tier"]
        .as_str()
        .ok_or("http-skip")?
        .to_string();
    let fp = body["signals"]["state_fingerprint"]
        .as_str()
        .ok_or("http-skip")?
        .to_string();
    Ok(IdentityTriple {
        opportunity_score: score,
        opportunity_tier: tier,
        state_fingerprint: fp,
    })
}
```

`triple_from_snapshot` uses `market_state_from_gex` + `generate_signals(&ms_in, None)` + `evaluate_gate` + `compute_opportunity_tier(..., 40, 60, 80)` — **not** `snap.signals` alone, and **not** Path-B compared only to itself. HTTP identity reads the triple only (never full-envelope equality).

**Bind** (`clients.rs`):

```rust
pub async fn bind_loopback(app: axum::Router) -> AppResult<(SocketAddr, tokio::task::JoinHandle<()>)> {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let addr = listener.local_addr()?;
    let handle = tokio::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });
    Ok((addr, handle))
}

pub fn loopback_url(addr: SocketAddr, path: &str) -> String {
    format!("http://127.0.0.1:{}{path}", addr.port())
}
```

Layer `rate_limit_middleware` with `state.rate_limiter.clone()` onto `routes::router(state)` (limiter is 0). **Do not** call `server::serve`. **Do not** use `tower::oneshot` for overflow or stream holds.

HTTP GET `/api/ticker/SPY` with a reqwest client (timeout e.g. 10 s). Record wall ms, status, body. Map: 2xx → `ok`; 429 → `rate-limit refusal` **and** blocked-if-limiter-0; 503 with Retry-After 30 classified by caller (hold vs probe); other 4xx/5xx/transport → `unexpected error`; elapsed ≥ timeout → `client timeout` (not unexpected error).

SSE: reqwest `Accept: text/event-stream`, read bytes. TTFB = request start → first response byte. Treat `:` comments / `event: ` heartbeats as comments. `data:` lines are non-comment events. Hold the connection until cancelled.

**Inject** (`inject.rs`): 1 Hz `publish_event` quotes on SPY (and prices symbols) with **changing** bid/ask so `stream.rs` dirty-set fires (equal px is skipped). Start inject **after** clients observe the `connected` comment. Count non-comment events **after** first inject; 0 → scenario FAIL (not skip). Emit-after-inject = inject instant → first subsequent `data:` on that client.

**Overflow** (`overflow.rs`): HTTP clients of **probe** bind only.

- Subscriber wave: 4 concurrent `GET /api/stream/SPY` against probe (`max_subscribers=3`). Expect 3 admit + 1 `503` + `Retry-After: 30` classified `subscriber-ceiling refusal`.
- Drop those clients; wait until `probe.live_capacity.subscriber_count() == 0`.
- Session wave: 2 × `GET /api/stream/SPY` admit; `GET /api/stream/QQQ` → `503` + Retry-After 30 classified `session-ceiling refusal`.

If both waves record 0 of those 503s → vacuous FAIL (AC-23). Never oneshot. Never hit `hold_addr`.

**Run loop** (`run.rs`) — `pub async fn run(cmd: Command, json: bool, out: Option<PathBuf>) -> std::process::ExitCode`:

1. `evidence = classify_evidence()`.
2. Load golden; on fail → short record `[BLOCKED]`/`[ERROR]`, no p95 table, non-zero. Do not print `MOCKED VENDORS`.
3. If rest_base/key/host would be live/paid → `[BLOCKED] {cmd} — paid Options feed would be used. Harness must not burn the paid Options feed. No pass recorded.`
4. **Oracle first:** `identity_oracle = identity_from_vendor(&book.vendor)`.
5. `hold = AppState::for_capacity_harness(catalog.clone(), hold_sessions, hold_subs)`.
6. `probe = AppState::for_capacity_harness(catalog, PROBE_SESSIONS, PROBE_SUBSCRIBERS)` (separate LiveCapacity/hub).
7. Pre-subscribe `SPY` on **hold** hub (prices already on hub). Do **not** pre-subscribe `QQQ` on probe.
8. Bind hold + probe via `bind_loopback`. Never start `stock_worker`. Spawn a stderr progress task: `[RUNNING] … — no verdict yet`.
9. Cold wave: N concurrent `GET /api/ticker/SPY` (N = 16 load / 8 soak). Record each wall as **cold**. Push each `"SPY"` onto `ticker_analysis_request_tickers`.
10. Warm hold: keep N concurrent looping GETs for 20 s (load) or 600 s (soak). Record walls as **warm**.
11. SSE hold: 8 (load) / 32 (soak) `GET /api/stream/SPY` + 1 `GET /api/stream/prices?symbols=SPY`, concurrent, for 5 s (load) / 600 s (soak). Inject 1 Hz. Record TTFB + emit-after-inject per surface. Hold-phase subscriber-ceiling and session-ceiling counts must be 0. Unexpected drop during hold → `unexpected stream-hold drops`.
12. Disconnect SSE; hold `subscriber_count` must return to 0 (AC disconnect-release).
13. Overflow waves on **probe** only.
14. Post-work: warm HTTP GET `/api/ticker/SPY` → `identity_http` triple; second `identity_from_vendor` → `identity_path_b`. Both must equal `identity_oracle`. Skip / Path-B-only / mismatch → `[FAIL] {cmd} — identity check {oracle-missing|http-skip|path-b-only|mismatch}. Not a production measurement.` A capacity FAIL cannot be flipped to PASS by a matching triple.
15. Soak only: one more hold-instance ticker GET must be 2xx **before** teardown.
16. `request_count() == 0` or `[BLOCKED]` vendor I/O (no `MOCKED VENDORS`).
17. Abort listeners; both `subscriber_count == 0`.
18. If elapsed < locked span → `[INCOMPLETE]`.
19. If zero ticker GETs **and** zero stream clients → `[FAIL] … 0 requests selected; no pass recorded.`
20. If some work ran but a ship-required surface is 0 → `[FAIL] … 0 {missing surface} executed; no pass recorded.` (**not** `0 requests selected`).
21. Evaluate thresholds. Write receipt under `data/capacity/capacity_{load|soak}_{stamp}.json` (create dir). Default mode: standing first on **stdout**, progress on **stderr**. `--json`: JSON (including `standing`) on stdout; standing prose + progress on stderr.
22. Load command prints `[NOT RUN] soak — not part of this command. {ci|local} load evidence is not soak evidence.`
23. Scan emitted strings against banned needles. Secret canary: if `MASSIVE_API_KEY` is set, it must not appear in stdout/stderr/receipt (nor `apikey=`).
24. Exit 0 only on pass.

**Test-only hooks** (`#[cfg(test)]` on `run_with_hooks`): skip a surface, force warm samples, force unexpected-error / drops / timeouts, force overflow all-admit, bump a request_count double, abort early for INCOMPLETE. **Production `run()` never reads an env duration override and never shortens soak.** Hooks must not be clap flags.

`cmd` body (later B6) only calls `run`. Anti-vacuity: `run` **does** construct `for_capacity_harness`, bind `127.0.0.1:0` twice, evaluate thresholds, take oracle **before** driven work, then HTTP triple + second Path-B vs that oracle.

Client timeout class is on the standing Thresholds list and on `[PASS]`.

Run `cargo test -p api-rust --lib capacity_harness -- --nocapture`. A full in-process **load** (20 s + 5 s) is allowed here as one `#[tokio::test]` `hermetic_load_passes_with_zero_vendor_io` — keep it **< 60 s**. **No 600 s soak test in this module.**

If cold p95 > 4000 ms, STOP (GATE Z) — do not raise the lock.

`cargo fmt`. Commit.

**Reviewer probes:** overflow samples' URL port equals probe, not hold; `oneshot` string absent from these new files; HubCmd count 0 after many HTTP admits with worker off; identity HTTP is three fields; `ticker_analysis_request_tickers` has no multi-ticker entries.

---

## B6 — Clap nested `capacity {load|soak}` + thin `cmd_capacity_*`

**Files:** `apps/api/src/main.rs`

**Depends on:** B5. **Independent:** no.

### Tests first

Extend `main.rs` `#[cfg(test)]` (sibling of `batch_backtest_wiring`):

```rust
#[test]
fn capacity_load_and_soak_parse_as_distinct_nested_commands() {
    let load = Cli::try_parse_from(["api-rust", "capacity", "load"]).unwrap();
    let soak = Cli::try_parse_from(["api-rust", "capacity", "soak"]).unwrap();
    assert!(matches!(load.cmd, Commands::Capacity { action: CapacityAction::Load { .. }, .. }));
    assert!(matches!(soak.cmd, Commands::Capacity { action: CapacityAction::Soak { .. }, .. }));
}

#[test]
fn capacity_is_not_an_alias_of_serve_or_of_the_other_command() {
    let serve = Cli::try_parse_from(["api-rust", "serve"]).unwrap();
    assert!(matches!(serve.cmd, Commands::Serve { .. }));
    assert!(Cli::try_parse_from(["api-rust", "capacity"]).is_err()); // needs load|soak
}

#[test]
fn evidence_clap_flag_is_rejected() {
    assert!(Cli::try_parse_from(["api-rust", "capacity", "load", "--evidence", "ci"]).is_err());
    assert!(Cli::try_parse_from(["api-rust", "capacity", "load", "--ci"]).is_err());
}

#[test]
fn json_and_out_parse_on_capacity() {
    let cli = Cli::try_parse_from([
        "api-rust", "capacity", "load", "--json", "--out", "data/capacity/x.json",
    ])
    .unwrap();
    match cli.cmd {
        Commands::Capacity { json, out, .. } => {
            assert!(json);
            assert!(out.unwrap().ends_with("x.json"));
        }
        other => panic!("{other:?}"),
    }
}

const MAIN_SRC: &str = include_str!("main.rs");

fn cmd_capacity_body() -> &'static str { /* slice from async fn cmd_capacity to end marker */ }

#[test]
fn cmd_capacity_does_not_call_forbidden_seams_and_does_construct_harness() {
    let body = cmd_capacity_body();
    assert!(body.contains("capacity_harness::run") || body.contains("run("));
    for needle in [
        "Config::from_env",
        "server::serve",
        "stock_worker.start()",
        "MarketDataPort::live",
        "connect_async",
        "MassiveRestClient",
    ] {
        assert!(!body.contains(needle), "{needle}");
    }
}

#[test]
fn cmd_capacity_soak_uses_command_soak_not_a_short_alias() {
    let body = cmd_capacity_body();
    assert!(body.contains("Command::Soak") || body.contains("CapacityAction::Soak"));
    assert!(body.contains("Command::Load") || body.contains("CapacityAction::Load"));
}
```

Run `cargo test -p api-rust --bin api-rust -- --nocapture` — expect FAIL (no subcommand).

### Implement

```rust
/// Hermetic load/soak harness (not serve; not a research score lab).
Capacity {
    #[command(subcommand)]
    action: CapacityAction,
    /// JSON receipt on stdout; standing prose + progress on stderr.
    #[arg(long)]
    json: bool,
    #[arg(long)]
    out: Option<PathBuf>,
},
```

```rust
#[derive(Subcommand, Debug)]
enum CapacityAction {
    /// Short mocked-vendor load (CI + local).
    Load,
    /// 600s mocked-vendor soak (local + GATE Q; not default CI).
    Soak,
}
```

In `main`, **before** the generic `run(cli)` anyhow path (so FAIL verdicts are not wrapped as `error: …`):

```rust
if let Commands::Capacity { action, json, out } = cli.cmd {
    let cmd = match action {
        CapacityAction::Load => api_rust::services::capacity_harness::Command::Load,
        CapacityAction::Soak => api_rust::services::capacity_harness::Command::Soak,
    };
    return cmd_capacity(cmd, json, out).await;
}
```

```rust
async fn cmd_capacity(
    cmd: api_rust::services::capacity_harness::Command,
    json: bool,
    out: Option<PathBuf>,
) -> ExitCode {
    api_rust::services::capacity_harness::run(cmd, json, out).await
}
// --- end cmd_capacity ---
```

Handle `Capacity` in `async fn run` as `unreachable` or remove it from that match so it cannot fall through to `Config::from_env`. **cmd_capacity must not call `Config::from_env`.**

`--help` must list `capacity` with `load` and `soak`.

Green bin tests. Commit.

**Reviewer probes:** `capacity load` is not `serve`; soak is not an alias of load; no `--evidence` field on the struct.

---

## B7 — Isolation + CLI exit tests (poison → red)

**Files:**
- `apps/api/tests/capacity_baseline_isolation.rs`
- `apps/api/tests/capacity_cli.rs`
- `apps/api/tests/capacity_load.rs`

**Depends on:** B5, B6. **Independent:** no.

### Tests first / implement together (integration crate)

`capacity_baseline_isolation.rs` — source scans + poison (pattern: `live_capacity_isolation.rs`, `batch_backtest_isolation.rs`):

1. Harness leaf + `cmd_capacity` contain no `MassiveRestClient` fetch, no `stock_worker.start()`, no `Config::from_env`, no `MarketDataPort::live`, no `connect_async`.
2. Anti-vacuity: command path **does** `for_capacity_harness`, `127.0.0.1:0`, threshold evaluate, oracle **before** driven work, post-work HTTP triple match **and** second Path-B vs **that** oracle. Comparing Path-B only to itself is a scan fail.
3. Scan **allows** `opportunity_score` / tier / `state_fingerprint` equality-to-oracle and **forbids** `opportunity_score <` / fail-if-score-below-N as a capacity threshold.
4. Fixture floor: loader + `syn_mini` refuse (call the lib).
5. Receipt parser: standing omitted → fail.
6. `request_count` double: `run_with_hooks(bump_request_count)` → `[BLOCKED]`, non-zero, no `MOCKED VENDORS`.
7. Production construct + fixture Some + `APP_ENV=prod` refuses.
8. CI workflow grep: `.github/workflows/ci.yml` backend job contains `capacity load` (or `capacity:load` / `api:capacity-load`) and does **not** contain `capacity soak` / `capacity:soak` as a step (B8 lands this; write the grep now so B8 is forced to satisfy it — keep `#[ignore]` until B8 if the file is not yet wired, **or** land B8 first. Prefer writing the grep as asserting current FAIL then B8 makes it pass; if B8 is parallel Independent yes, put the workflow grep in B8's tests instead and keep B7 grepping the **driver** only). **Decision:** B7 greps `ci.yml` for soak-absent; B8 must land the load step so this test passes. **Order: finish B8 before claiming B7 green if you spawn them in parallel.** If spawned together, B7's CI grep waits on B8. Mark B7 `Depends on B5, B6, B8`.

   **Correction:** Independence table below sets B7 `Depends on` B5, B6, B8.

9. OpenAPI / generated artifacts: `git diff --exit-code` equivalent via hashing `tools/api-contract` outputs or reading that `npm run api:contract:check` is the closer's job; B7 asserts harness files add no `#[utoipa::path]`.
10. `quant-engine` not imported by the harness leaf except through `compute_analytics_from_vendor` / identity helpers already in `api-rust`.
11. HubCmd: worker off + many HTTP admits ⇒ `cmds_enqueued() == 0`.
12. Evidence: `classify_with(&[("CI","true")]) == Local`; clap `--evidence` already in B6.
13. Overflow path: source contains a second `127.0.0.1:0` bind of `routes::router` / probe state; overflow function contains `reqwest` or HTTP GET, not `oneshot`.
14. Dashboard copy: walk `apps/dashboard/src` — no new `capacity load` / `capacity soak` / `CAPACITY HARNESS` product literals (allow none). Empty-diff is closer.
15. Trader 503/429: `CAPACITY_DETAIL` still exact; 429 body still `error: rate_limited` + `Too many requests. Limit is {n} per minute per IP on data endpoints.`
16. Config defaults still 500 / 50 / 120 (read `config.rs` env default literals).
17. Identity skip hook → `[FAIL]` identity check `http-skip`.
18. Force warm p95 200 ms → non-zero, names `warm cache-hit bundle GET wall`.
19. Force unexpected-error > 0 → names `unexpected-error` / `unexpected error`.
20. Force stream-hold drops → names `unexpected stream-hold drops`.
21. Force client timeouts → names `client timeout`.
22. Vacuous zero-work hook → `[FAIL] … 0 requests selected` and no p95 table.
23. Partial-surface hook (HTTP ran, prices SSE skipped) → `0 prices SSE executed`, **not** `0 requests selected`.
24. 429-while-limiter-0 hook → `[BLOCKED]`/`[ERROR]`, not PASS.
25. Canary `MASSIVE_API_KEY=super-secret-canary-value` not present in rendered standing/receipt.
26. Soak profile constants: `SOAK_HOLD == 600s`, 8 HTTP, 32 SSE, 500/50. `cmd_capacity` soak maps `Command::Soak`. Follow-up helper source-scanned inside soak branch.

`capacity_cli.rs` — spawn `cargo run -p api-rust -- capacity load --help` is slow; prefer `Cli::try_parse_from` already in B6. Here: missing golden via `run_with_hooks` / loader override → non-zero, no success receipt file; live rest_base refuse before work.

`capacity_load.rs` — **one** hermetic in-process load (library `run(Command::Load, …)` writing to a temp `--out`):

- exit 0
- receipt `Command: load`, 16 warm clients, 8+1 SSE, hold `MAX_LIVE_SUBSCRIBERS=9`, total wall < 60 s
- six named harness p95 ≤ locks
- unexpected-error 0, `unexpected stream-hold drops` 0, `client timeout` 0
- `request_count == 0`, vouched mock line
- identity three fields equal
- `ticker_analysis_request_tickers` all `SPY`
- Surfaces lists the three driven names
- `[NOT RUN] soak`
- `Evidence: local` (test process does not set `GITHUB_ACTIONS`)
- standing first
- no banned needles

Do **not** call `capacity soak` here.

Run:

```
cargo test -p api-rust --test capacity_baseline_isolation -- --nocapture
cargo test -p api-rust --test capacity_cli -- --nocapture
cargo test -p api-rust --test capacity_load -- --nocapture
```

Record elapsed for `capacity_load`; must be < 60 s. `$LASTEXITCODE` 0. Commit.

**Reviewer probes:** poison a forbidden fetch string into `run.rs` (isolation goes red); omit identity HTTP match (isolation goes red); label a prices-missing run as `0 requests selected` (isolation goes red).

---

## B8 — Nx / npm / CI discoverability (load on merge CI, soak not)

**Files:**
- `apps/api/project.json`
- `package.json`
- `.github/workflows/ci.yml`

**Depends on:** B6. **Independent:** yes.

### Tests first

Add `apps/api/tests/capacity_ci_wiring.rs` **or** fold into B7 isolation if this task lands first. Keep wiring assertions in B7 (Depends on B8). This task's own check:

```
node -e "const p=require('./apps/api/project.json'); if(!p.targets['capacity-load']||p.targets['capacity-load'].cache!==false) process.exit(1)"
```

Expect FAIL before edit.

### Implement

`apps/api/project.json` targets (siblings of `serve` / `test`), **`cache: false`**:

```json
"capacity-load": {
  "executor": "nx:run-commands",
  "options": {
    "command": "cargo run -p api-rust --locked -- capacity load",
    "cwd": "{workspaceRoot}"
  },
  "cache": false
},
"capacity-soak": {
  "executor": "nx:run-commands",
  "options": {
    "command": "cargo run -p api-rust --locked -- capacity soak",
    "cwd": "{workspaceRoot}"
  },
  "cache": false
}
```

Root `package.json` scripts:

```json
"capacity:load": "nx run api:capacity-load --skip-nx-cache",
"capacity:soak": "nx run api:capacity-soak --skip-nx-cache"
```

`.github/workflows/ci.yml` **backend** job, after `Cargo test` and **before** or after postgres suites — a dedicated step that is **load only**:

```yaml
      - name: Capacity load harness
        run: cargo run -p api-rust --locked -- capacity load
        env:
          CONVEXA_CAPACITY_CI_STEP: "1"
```

Do **not** add soak to this job. Do **not** treat a skipped step as pass. `GITHUB_ACTIONS` is already set on the runner ⇒ `Evidence: ci`. The extra env is the workflow-only alternative SPEC allows.

Do not pass `MASSIVE_API_KEY` into that step as a used fetch key (repo secrets may still exist on the runner; the harness must ignore them — already refused if dummy == env key).

Verify listings:

```
npm run capacity:load -- --help
```

is not valid nx forwarding; instead:

```
npx nx show project api --json
```

must list `capacity-load` and `capacity-soak`. `npm run` without args prints `capacity:load` / `capacity:soak`.

Commit.

**Reviewer probes:** soak string absent from the backend job steps; load step present; both Nx targets `cache: false`.

---

## B9 — Backend closer (receipt only; do not re-implement workers)

**Files:** `.spire/clusters/tech/contracts/capacity-baseline/conformance-receipt.json`

**Depends on:** B1, B2, B3, B4, B5, B6, B7, B8. **Independent:** no.

This closer **does not** edit worker paths. It runs the lane gates and writes the receipt.

1. `git status --short` — only this feature's files.
2. `cargo fmt -p api-rust -- --check`
3. `cargo test -p api-rust -p quant-engine --locked` — exit 0. Record the summary line and `$LASTEXITCODE`.
4. `cargo check -p api-rust --features postgres` — exit 0.
5. `npm run api:contract:check` — exit 0 (OpenAPI / generated `@convexa/api` bytes unchanged).
6. `git diff --stat -- libs/quant-engine apps/dashboard libs/api` — **empty**.
7. `python -c "import io;print(io.open('apps/api/src/services/capacity_harness/run.rs','rb').read().count(bytes([0])))"` → `0` (repeat for new files if any).
8. `npm run ports:free` then `cargo run -p api-rust --locked -- capacity load` with `GITHUB_ACTIONS` unset → `Evidence: local`, exit 0, receipt under `data/capacity/`, wall < 60 s. This is the closer's "serve" analog. **Do not** point at Railway. **Do not** run soak here.
9. Write `conformance-receipt.json`:

```json
{
  "tool": "interface_conformance",
  "verdict": "PASS",
  "mode": "contract",
  "source": ".spire/clusters/tech/contracts/capacity-baseline/INTERFACE_CONTRACT.md",
  "note": "NO_BACKEND_CHANGE of production HTTP; endpoints is the empty set. Live ticker/SSE must not be used as Massive conformance.",
  "summary": { "pass": 0, "fail": 0, "total": 0 },
  "endpoints": []
}
```

Do **not** run `interface_conformance.mjs` against production ticker/SSE (that would be a paid-feed measurement). Empty `endpoints` is the contract.

Commit the receipt only if the gates above are exit 0.

**Reviewer probes:** receipt `endpoints` is `[]`; closer diff does not re-touch `run.rs` / `state.rs` / `analytics.rs`.

---

# Frontend track

**None.** SPEC §4 is `NO_UI_CHANGE`. §4 names no dashboard files. Do not add a Vitest, a copy-table row, a Settings footnote, a Ticker widget, or a `/_ops/metrics` series. Dashboard empty-diff is enforced by B7 isolation + B9 closer + V5. There is **no frontend closer**.

---

## Independence

| Task | Lane | Paths | Depends on | Independent |
|---|---|---|---|---|
| B1 | backend | `apps/api/src/services/mod.rs`; `apps/api/src/services/capacity_harness/mod.rs`; `apps/api/src/services/capacity_harness/types.rs`; `apps/api/src/services/capacity_harness/evidence.rs`; `apps/api/src/services/capacity_harness/standing.rs`; `apps/api/src/services/capacity_harness/thresholds.rs`; `apps/api/src/services/capacity_harness/receipt.rs`; `apps/api/src/services/capacity_harness/fixture.rs` | — | no |
| B2 | backend | `apps/api/src/infrastructure/massive/ws.rs` | — | yes |
| B3 | backend | `apps/api/src/state.rs` | B1, B2 | no |
| B4 | backend | `apps/api/src/services/analytics.rs`; `apps/api/src/routes/ticker.rs`; `apps/api/src/routes/price.rs` | B3 | yes |
| B5 | backend | `apps/api/src/services/capacity_harness/mod.rs`; `apps/api/src/services/capacity_harness/identity.rs`; `apps/api/src/services/capacity_harness/inject.rs`; `apps/api/src/services/capacity_harness/clients.rs`; `apps/api/src/services/capacity_harness/overflow.rs`; `apps/api/src/services/capacity_harness/run.rs` | B1, B3, B4 | no |
| B6 | backend | `apps/api/src/main.rs` | B5 | no |
| B8 | backend | `apps/api/project.json`; `package.json`; `.github/workflows/ci.yml` | B6 | yes |
| B7 | backend | `apps/api/tests/capacity_baseline_isolation.rs`; `apps/api/tests/capacity_cli.rs`; `apps/api/tests/capacity_load.rs` | B5, B6, B8 | no |
| B9 | backend | `.spire/clusters/tech/contracts/capacity-baseline/conformance-receipt.json` | B1, B2, B3, B4, B5, B6, B7, B8 | no |

B9 is the **only** backend closer. It does not re-implement worker paths. Frontend has no work and no closer.

Independent-yes path check: B2 `ws.rs`, B4 `analytics.rs`+`ticker.rs`+`price.rs`, B8 `project.json`+`package.json`+`ci.yml` share no equal/prefix write path with each other.

---

# Verification track

Run after B9. Check `$LASTEXITCODE` / `echo $?` after **every** command.

### V1 — Unit / integration suite

```
cargo test -p api-rust -p quant-engine --locked
```

**Expect:** exit 0. New tests (`capacity_harness`, `capacity_baseline_isolation`, `capacity_cli`, `capacity_load`, hub harness_local) all pass. Existing live-capacity / score-identity / api-contract tests still pass. **Soak 600 s is not in this suite.**

### V2 — Postgres compile (this track touches `state.rs`)

```
cargo check -p api-rust --features postgres
```

**Expect:** exit 0.

### V3 — Named load command (local evidence)

```
npm run ports:free
cargo run -p api-rust --locked -- capacity load
```

**Expect:** exit 0. Stdout starts with
`CAPACITY HARNESS — MOCKED VENDORS · NOT A PRODUCTION MEASUREMENT`.
Contains `Command:     load`, `Evidence:    local`, Surfaces including all three names,
`MAX_LIVE_SUBSCRIBERS=9`, six `harness p95` lines with the locked bases, `client timeout = 0`,
`unexpected stream-hold drops = 0`, `[PASS] load — …`, `[NOT RUN] soak — not part of this command. local load evidence is not soak evidence.`, closing Authorizes line. Wall **< 60 s**. Receipt file under `data/capacity/capacity_load_*.json`. `request_count` vouched 0. Identity three fields present and equal.

Then:

```
# PowerShell
$env:CI='true'; Remove-Item Env:GITHUB_ACTIONS -ErrorAction SilentlyContinue; cargo run -p api-rust --locked -- capacity load; Remove-Item Env:CI
```

**Expect:** still `Evidence:    local`.

### V4 — OpenAPI / generated client identity

```
npm run api:contract:check
```

**Expect:** exit 0, no artifact rewrite.

### V5 — Negative space diffs

```
git diff --stat -- libs/quant-engine apps/dashboard libs/api
```

**Expect:** empty. Grep `apps/dashboard/src` for `CAPACITY HARNESS` / `capacity:load` as product copy: no matches.

### V6 — CI workflow grep

```
rg -n "capacity" .github/workflows/ci.yml
```

**Expect:** a backend step running `capacity load`. No `capacity soak` / `capacity:soak` step in the default backend job.

### V7 — Forced-fail honesty (library hooks / isolation already in suite)

Re-run the named isolation tests if not covered by V1:

```
cargo test -p api-rust --test capacity_baseline_isolation -- --nocapture
```

**Expect:** exit 0, including vacuous / partial-surface / blocked / identity-skip / p95-cross cases.

### V8 — GATE Q soak (review + one real invocation)

```
npm run ports:free
cargo run -p api-rust --locked -- capacity soak
```

**Expect:** exit 0 after **600 s**. Receipt `Command:     soak` (never `load`), 8 HTTP + 32 per-ticker SSE, prices SSE non-zero, 600 s sustained, same six p95 locks, unexpected-error 0, stream-hold drops 0, client timeout 0, two refusal checks, vendor I/O 0, identity three fields, follow-up ticker-analysis served, `Evidence:    local`. This is **GATE Q**, not merge CI.

If soak is not run, AC-4/6/8/10/11/48 are **UNVERIFIABLE**, not a green skip.

---

## Review checklist (AC → task)

| ACs | Where |
|---|---|
| 1, 2 | B6 clap + B8 listings (review) |
| 3, 5, 7, 9, 15 (load), 32, 33, 36, 40, 41, 42 | B5 + `capacity_load` + V3 |
| 4, 6, 8, 10, 11, 48 | V8 GATE Q soak (48 review that GATE Q invoked it) |
| 12–14 | B7 force-fail hooks |
| 16–20, 38, 39, 49 | B5 run loop + B7 |
| 21–25 | B5 overflow + B7 |
| 26, 27, 28, 35 | B7 source pins + limiter 0 |
| 29, 30, 43, 44 | standing/render + B7 scans (43/44 review) |
| 31 | B8 CI + evidence classifier + B7 |
| 34, 47 | B9 empty diffs + api-contract-check |
| 37 | B7 canary |
| 45, 46 | inject count + fixture floor |

---

## What a reviewer should probe globally

- Production `subscribe` still `send(HubCmd::Subscribe)` when `emit_hub_cmd` is true.
- Overflow HTTP port ≠ hold port; no `oneshot` in harness run/overflow files.
- `capacity load` cannot print `Command: soak` or 32-connection / 10-minute evidence.
- Ambient `CI=true` is `Evidence: local`.
- D1 numbers appear only as constants — no auto-tune.
- Score/tier/fingerprint appear as identity equality, never as a p95/error lock.
- Dashboard / OpenAPI / `quant-engine` diffs stay empty.
