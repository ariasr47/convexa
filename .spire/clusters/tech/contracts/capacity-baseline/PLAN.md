# capacity-baseline — implementation plan

> **For the backend executioner:** execute B0–B8, then hand final bytes to B9. Use RED → GREEN →
> REFACTOR → VERIFY → COMMIT. A moved seam or invalid RED is GATE Z; never weaken a bound oracle.

**Goal:** add one repository-owned Rust command that runs the approved fixture-only REST/SSE capacity
profiles, always retains a complete canonical report, and blocks the normal repository gate whenever
required evidence is missing or outside the fixed v1 guardrails.

**Architecture:** the one-way `apps/api/src/capacity/` leaf owns manifest, clients, fixture child,
JSONL control, samplers, runner, evaluator, report and self-tests. It drives the real router; `serve`
cannot reach its constructor. Seven children (`A`, `B`, `C`, `D1`, `D2`, `D3`, `E`) survive through one
recovery checkpoint. Frontend work is verification-only.

**Tech stack:** Rust 2021, Tokio, Axum, Clap, Reqwest/rustls, Serde JSON and SHA-256; existing Nx 23 and
Node 24 repository scripts; Windows 11 x64 (`Get-Process` through a persistent no-profile PowerShell
sampler) and Linux x64 (`/proc/<pid>`); current Rust route, quant-engine and API-contract test suites.

## Track map

| Track | Tasks | Execution shape |
|---|---|---|
| Backend / repository tooling | B0–B9 | One dependency-ordered lane. The tasks repeatedly extend the same `capacity` leaf and child/report protocol; splitting ownership would overlap paths and invalidate the TDD sequence. |
| Frontend implementation | none | Intentionally empty. No dashboard, dashboard-e2e, generated-client or frontend contract source changes are permitted. |
| Frontend `NO_UI_CHANGE` verification | F-V1–F-V2 | Source/tree fence plus existing dashboard tests/build and a bounded before/after review; this is verification, not a frontend build lane. |
| Integrated verification | V1–V10 | Focused Rust tests, both supported OS adapters, three public self-tests/receipts, normal/extended profile evidence, root aggregate, API conformance and protected-tree checks. |

## Global Constraints

- Preserve the exact 13 scenario IDs, v1 counts, cache preconditions, expected-outcome classes and
  thresholds from SPEC §2.3. A missing/extra/duplicate scenario, threshold or required observation is
  `did_not_pass`, never a partial pass.
- The normal command owns the exact 8+12+70+30+5+7+8 = 140-second internal ledger and reserves the
  remaining 40 seconds of the 180-second outer command allowance. Phase deadlines include cancellation
  acknowledgement and never lend time forward. Extended uses the same executable/manifest/evaluator,
  changes only the mixed soak to 900 seconds and adds the >1 MiB/min quiescent RSS slope refusal.
- Start exactly seven loopback workload children named `A`, `B`, `C`, `D1`, `D2`, `D3`, `E`. E is reset
  and reused sequentially. No child may be replaced or cleaned up before the shared 30-second recovery
  snapshot has recorded every child and the seven-child aggregate.
- Child assembly is callable only from the hidden capacity child mode. It receives an allowlisted,
  credential-free environment; `MarketDataPort::Fixture`; a non-network stock-event producer; memory or
  unique temporary-file stores; `127.0.0.1:0`; and subscriber cap 32. It must not construct Massive REST,
  Massive WebSocket, Redis, PostgreSQL, LLM, Google OAuth or any future source-pinned connector.
- Production `serve` retains its current config/schema/archive preflight and worker/listener order. There
  is no `HARNESS_MODE`, fixture environment flag, HTTP switch, fallback or production-selectable test
  constructor.
- `rest.rs` and `sse.rs` measure with `Instant` and return immutable observations. Only `evaluate.rs`
  decides outcomes. Percentiles are nearest-rank over completed observations; no supplemental p99 or
  median may replace a blocking measure.
- Windows and Linux resource adapters are required. Unsupported OS, missing process, parse failure,
  missing/non-finite sample or sampler helper exit is a named failure. Never report zero or skip. The
  Windows adapter keeps one `powershell.exe -NoLogo -NoProfile -NonInteractive` sampler alive per child
  and reads `WorkingSet64` and `Handles`; Linux reads `VmRSS` from `/proc/<pid>/status` and counts
  `/proc/<pid>/fd` entries without following symlinks. Both report bytes plus a closed semantic token.
- Active request, subscriber and SSE-task/Tokio-task counts use RAII guards at request entry/drop,
  `services/live_capacity.rs::SubscriberGuard`, and both real stream-task spawn/drop boundaries. No probe
  allocates or performs I/O on each SSE data tick. Production constructs the probe as disabled.
- Reports are canonical UTF-8 JSON with the exact member order from SPEC §2.6, one trailing newline,
  manifest-order scenarios, three-decimal milliseconds/slopes and integer byte/count units. A temp
  sibling is validated completely before atomic replacement. Handled failures still write all rows and
  exit nonzero; an incomplete temp never replaces the prior final.
- The three self-tests run only their named controls. Their outer exit is zero only when the healthy arm
  passes, every injected arm produces its exact nested rejection, and the retained receipt validates.
- The pinned outbound inventory is the seven source-verified construction sites present at planning:
  `massive_rest` (`infrastructure/massive/rest.rs`), `massive_websocket`
  (`infrastructure/massive/ws.rs`), `redis` (`infrastructure/redis/price_cache.rs`),
  `postgres_pool` (`db/postgres.rs`), `postgres_migration_connection`
  (`db/migration_runner.rs`), `llm_http` (`services/llm.rs`) and `google_oauth_http`
  (`services/auth/google_oauth.rs`). The checked manifest pins paths, constructor signatures and source
  SHA-256; the scan rejects a moved/added/unlisted connector until an explicit manifest amendment.
  Planning SHA-256 values are:

  | Connector | Planning source SHA-256 |
  |---|---|
  | `massive_rest` | `701e4e573350d3a584b1101e293c0b3868b0ed072b3d9fb43b9f1c0dc3fc01d1` |
  | `massive_websocket` | `473bc1b5973c62446c2f996d985b6246a6fc32275a4508cd55a0c559d05e13cc` |
  | `redis` | `0980a5991e77a7d77019cacd4657285b70b58cbe30e1247d74e80ea932240bde` |
  | `postgres_pool` | `498e2bfd51277d6d2c20673fac6e044bb14c642d221c27af50d1e799db39afac` |
  | `postgres_migration_connection` | `01f7fbc5c46d065a09227b265c6177c8c8c3563512f740bb7fa2aabc4687702e` |
  | `llm_http` | `7a8317259adc99a795b674c71e6b4c5f296058465e5151e36ac71fc5d9f1c28a` |
  | `google_oauth_http` | `e9e45bc3d59b1b9f960275e13423d0be8a9426bf003dd093b6ba246e29e06054` |

  B3 deliberately changes only `massive/ws.rs` to add a non-network fixture constructor; B6 records its
  post-B3 full-file hash and asserts the other six still equal this table. The constructor signature for
  live `connect_async(url)` remains separately pinned so the fixture addition cannot erase the connector.
- The byte-identity self-test runs the unchanged `npm run api:contract:check` first, then checks the five
  exact §2.1 artifacts in table order and the recursive `libs/api/src/generated/` entry inventory. It may
  not update an oracle, reference SHA, base digest, base entry or exclusion.
- The five accepted base digests are exactly
  `2803c58a00f563e6e136056582f1a5682fc05bfe196f501d9e813c48a8b35c8f`,
  `deec24e279c03c93c2af8da8f5ee3e694f188f5a3cca3ee7ce803f9ac17b9f87`,
  `c7f23f6ca20157d82efeb66f1fdb3662cc5d7a5096c331b29166562e6832c01b`,
  `b7b501c2852d433ebf08053b25c13763617d24f48914a08e180ca33b75015949`, and
  `724181c0d47cae9a3a7032eecfa21901c310f1406aab26e9b14735c43a352e9c`.
  The generated-client baseline is exactly `file\tlibs/api/src/generated/schema.ts\n` with digest
  `262f9c4f4e9fd5641c82b686237d58086c5d7d16a02fd9209821ae86e42bcbe9`.
- Before-oracles are generated once from detached revision
  `c30ed8151b82f847fd75552528dcba30bdca5ae8`. Normal execution is read-only. Runtime exclusions are only
  `meta.served_at`, `meta.compute_ms`, `meta.elapsed_ms`, `meta.cache.age_seconds`.
- Do not edit `libs/quant-engine/**`, scoring, recommendation, entry-gate, fingerprint, public route
  schemas, the five API-contract artifacts, `libs/api/src/generated/**`, dashboard source or browser
  source. The capacity leaf may not be imported by quant, routes other than the private attachment seams,
  scoring, recommendation or frontend code.
- Worktree prerequisite: before any Node-backed gate run `npm run worktree:link` when this worktree has no
  local `node_modules`; then run `npx nx sync:check`. Planning observed the API contract bytes themselves
  match, while the unlinked worktree currently fails only because its Prettier binary is unavailable.
- Use `cargo fmt`, not a repository-wide writer. Commit only task-owned paths and preserve unrelated dirty
  files.

The following block is copied verbatim from `INTERFACE_CONTRACT.md`.

## Conformance spec

The block is intentionally limited to the existing finite JSON route. It asserts the stable public bundle floor without inventing an endpoint or claiming that an HTTP JSON probe can validate a held SSE lifecycle.

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/ticker/{ticker}",
      "path_params": {
        "ticker": "SPY"
      },
      "query": {
        "min_dte": "7",
        "max_dte": "45"
      },
      "required": {
        "market_state": "object",
        "market_state.ticker": "string",
        "market_state.price": "number",
        "market_state.gamma_flip": "number",
        "market_state.call_wall": "number",
        "market_state.put_wall": "number",
        "market_state.iv_rank": "object|null",
        "signals": "object",
        "signals.opportunity_score": "number",
        "signals.opportunity_tier": "string",
        "signals.prime_prompt_eligible": "boolean",
        "ai_eval": "object",
        "ai_eval.ready": "boolean",
        "ai_eval.state_fingerprint": "string",
        "meta": "object",
        "meta.freshness": "object",
        "meta.freshness.stale": "boolean",
        "meta.freshness.stale_after_seconds": "number"
      }
    }
  ]
}
```

## Source-verified ground truth before implementation

- `apps/api/src/main.rs` owns `Commands`/`run`; use its `postgres-migrate` direct-`ExitCode` precedent.
- `apps/api/src/server.rs::serve` validates production before state, binds before workers and builds the
  real app through `routes::router`. Preserve it; add no capacity branch to `serve`.
- `AppState` stores a concrete live REST client; make it explicit/absent, add a crate-private fixture
  constructor, and move its nine live call sites to a fail-closed accessor.
- `apps/api/src/services/analytics.rs::load_analytics` reaches live Massive through private
  `compute_analytics`, while `compute_from_port` already proves fixture Path B. Select the fixture port
  only when the crate-private capacity constructor supplied it; production keeps the existing path.
- `StockStreamHub::dormant` still owns the live-worker path; add a distinct fixture producer so the real
  ticker SSE receives events without `connect_async` reachability.
- `apps/api/src/services/live_capacity.rs::SubscriberGuard` is the existing subscriber RAII boundary;
  `routes/stream.rs` has the two `tokio::spawn` SSE task boundaries. These are the source-verified probe
  attachment points.
- `apps/api/src/services/iv_store.rs::IvStore` has JSON/Postgres arms but no failing read arm. Add a
  crate-private fixture-only arm whose write succeeds/no-ops and whose `read_recent` returns the injected
  error; do not use an environment selector.
- `routes::router(state)` is the existing complete 52-operation graph. The ticker route is
  `routes/market.rs::get_ticker_bundle`; the stream route is `routes/stream.rs::stream_ticker`.
- Root `test` currently runs three Nx targets; the API project has no capacity targets. Baseline: 947
  listed Rust tests.
- The five pinned artifact hashes and 52-operation count match the approved values. The reference commit
  exists locally. `apps/api/tests/fixtures/market/syn_mini.json` is the only current general market fixture,
  so the capacity corpus must be committed separately rather than silently treating one symbol as 12
  identities.

---

### Task B0 — Lock the v1 manifest, corpus and observation types

**Files:** `apps/api/src/capacity/mod.rs` (create); `apps/api/src/capacity/manifest.rs` (create);
`apps/api/src/capacity/model.rs` (create); `apps/api/src/lib.rs`;
`apps/api/tests/fixtures/capacity-baseline/v1/manifest.json` (create);
`apps/api/tests/fixtures/capacity-baseline/v1/market.json` (create);
`apps/api/tests/fixtures/capacity-baseline/v1/iv-history.json` (create);
`apps/api/tests/capacity_manifest_report.rs` (create).

1. Record `cargo test -p api-rust -p quant-engine -- --list` = 947 named tests and the five protected
   hashes. Add RED tests named `manifest_has_exact_thirteen_rows_in_order`,
   `normal_profile_has_exact_140_second_ledger`, `extended_changes_only_soak_and_slope`,
   `fixture_hashes_and_identity_roles_are_closed`, and
   `missing_duplicate_or_reduced_manifest_member_is_rejected`. Observe compile failure because the module
   and types do not exist.
2. Add the concrete closed vocabulary; do not use strings internally:

```rust
pub enum Profile { Normal, Extended }
pub enum ScenarioId {
    RestCold, RestExpectedNotFound, RestWarmConcurrent, RestColdCoalesced,
    RestSharedCapacity, SseCapacityHold, SseCapacityRefusal, SseOrderlyChurn,
    SseAbruptDrop, MixedSoak, OptionalComputeFault, OutboundIsolation,
    PostLoadRecovery,
}
pub enum OutcomeClass {
    Accepted, ExpectedCapacityRefusal, ExpectedFixtureNotFound, UnexpectedError,
}
pub enum ScenarioStatus { Pass, DidNotPass }
pub enum ChildId { A, B, C, D1, D2, D3, E }
pub struct PhaseBudget { pub preflight: Duration, pub launch: Duration,
    pub workload: Duration, pub recovery: Duration, pub evaluation: Duration,
    pub cleanup: Duration, pub finalization: Duration }
pub fn manifest(profile: Profile) -> ValidatedManifest;
```

   Serde spellings are the exact contract tokens. `ValidatedManifest::try_from` checks set equality,
   order, counts/concurrency/hold/cache preconditions, required observations, threshold directions/units,
   normal total 140 seconds, normal soak 60 seconds and extended soak 900 seconds.
3. Commit one deterministic multi-symbol fixture containing 12 D1 cold identities, `SPY` for warm/SSE,
   `COAL` for the coalesced burst, eight `SHARE01`–`SHARE08` identities for D3, and no `NOFIX` entry.
   All are frozen valid `VendorBundle` inputs with no URL/credential. Commit at least 20 SPY IV samples so
   the healthy optional control produces an object. The JSON manifest pins every corpus relative path and
   SHA-256 plus its workload role.
4. `model.rs` owns immutable latency, REST, SSE, wave, one-second resource, isolation and recovery
   observations. Use integer bytes/counts and `Duration`; reject NaN/non-finite values before report
   conversion. Run the five tests; expected 5 passed. Commit
   `feat(capacity): lock v1 manifest and fixture corpus`.

**Reviewer probe:** change warm concurrency 16 to 15 or remove `post_load_recovery`; manifest validation
must fail before any listener binds.

---

### Task B1 — Implement evaluator, canonical report and atomic failure retention

**Files:** `apps/api/src/capacity/evaluate.rs` (create);
`apps/api/src/capacity/report.rs` (create); `apps/api/src/capacity/mod.rs`;
`apps/api/tests/capacity_manifest_report.rs`.

1. Add RED matrices for nearest-rank boundaries, equality/strict-breach directions, missing samples,
   every latency/error/disconnect/resource/recovery/slope/elapsed/isolation threshold family, scenario set
   equality, canonical byte stability, and atomic-replacement refusal. Observe the intended missing-symbol
   failures.
2. Implement pure APIs:

```rust
pub fn nearest_rank_ms(values: &[Duration], percentile: u8) -> Result<f64, EvidenceFailure>;
pub fn evaluate(manifest: &ValidatedManifest, observations: RunObservations) -> EvaluatedRun;
pub fn validate_report(report: &CapacityReport, manifest: &ValidatedManifest) -> Result<(), ReportError>;
pub fn canonical_bytes(report: &CapacityReport) -> Result<Vec<u8>, ReportError>;
pub fn atomic_replace(path: &Path, bytes: &[u8]) -> Result<(), ReportError>;
```

   `evaluate` always emits all 13 rows. Recovery requires ordered children A/B/C/D1/D2/D3/E and an
   independently evaluated aggregate; aggregate ceilings are +2 handles/descriptors, +2 tasks and
   +64 MiB, not seven allowances. Extended slope is ordinary least squares over quiescent one-second RSS
   samples expressed/rounded as MiB/min only after comparison.
3. Define report DTO fields in the exact §2.6 order. `claim` is exactly the settled sentence. Diagnostics
   say `<scenario>: observed <value> <unit>; required <direction> <threshold>; did not pass. Inspect local prerequisites/fixtures and rerun <same command>.`
   They contain no hostname, username, absolute path, environment dump, URL, token or secret.
4. `atomic_replace` writes `.<filename>.tmp-<pid>-<nonce>` in the same directory, flushes, validates the
   bytes by parsing back into the closed DTO, then uses platform-appropriate replace. On validation/write
   failure preserve the prior final and retain the diagnostic sibling.
5. Run `cargo test -p api-rust --test capacity_manifest_report`; expected exactly 12 passed, 0 failed.
   Commit `feat(capacity): evaluate closed evidence and write canonical reports`.

**Reviewer probe:** remove one resource sample from an otherwise passing soak and verify both
`mixed_soak` and summary become `did_not_pass`; the prior complete report remains byte-identical.

---

### Task B2 — Add cross-platform samplers and balanced lifecycle probes

**Files:** `apps/api/src/capacity/resources/mod.rs` (create);
`apps/api/src/capacity/resources/windows.rs` (create);
`apps/api/src/capacity/resources/linux.rs` (create);
`apps/api/src/capacity/harness_app.rs` (create skeleton);
`apps/api/src/services/live_capacity.rs`; `apps/api/src/routes/stream.rs`;
`apps/api/tests/capacity_resources.rs` (create).

1. Add RED tests `lifecycle_raii_balances_request_subscriber_and_task`,
   `subscriber_refusal_does_not_increment`, `missing_sample_is_not_zero`,
   `platform_semantic_is_exact`, `supported_sampler_observes_live_child`, and
   `sampler_failure_is_closed`. Each supported-OS run must execute, not ignore, its live-child test.
2. Add one disabled-by-default probe:

```rust
#[derive(Clone, Default)]
pub struct LifecycleProbe { inner: Option<Arc<Counters>> }
pub struct LifecycleGuard { counter: Option<Arc<AtomicUsize>> }
pub struct LifecycleSnapshot { pub active_requests: u64, pub active_subscribers: u64,
    pub active_sse_tasks: u64, pub tokio_tasks: u64 }
impl LifecycleProbe {
    pub fn disabled() -> Self;
    pub(crate) fn enabled() -> Self;
    pub fn request(&self) -> LifecycleGuard;
    pub fn subscriber(&self) -> LifecycleGuard;
    pub fn sse_task(&self) -> LifecycleGuard;
    pub fn snapshot(&self) -> LifecycleSnapshot;
}
```

   `SubscriberGuard` holds the optional lifecycle guard. Both `tokio::spawn` stream bodies acquire one
   SSE/task guard before spawn and retain it inside the future. Harness request middleware owns the
   request guard until the response body drops; production has only the disabled zero-allocation arm.
3. Implement `ResourceSampler::sample_self()` returning `rss_bytes`, `handles_or_fds` and the exact
   semantic token. Linux parses `VmRSS` with checked KiB→bytes conversion and counts directory entries.
   Windows starts one persistent PowerShell helper during preflight, sends `sample` lines and parses
   `<pid>\t<WorkingSet64>\t<Handles>`; require the returned PID to equal `std::process::id()`. Bound every
   read/write to 500 ms and terminate the helper during cleanup. No shell interpolation: PID is rendered
   from `u32`, and the script is a fixed literal.
4. Merge OS and lifecycle snapshots only when both are present. Run the six-test resource suite on the
   current Windows 11 x64 host; expected 6 passed. The Linux-specific live test is executed in V4.
   Commit `feat(capacity): observe platform resources and lifecycle balance`.

**Reviewer probe:** kill the sampler helper or rename `/proc/<pid>/status`; the sample becomes unavailable
and cannot serialize as zero/pass.

---

### Task B3 — Build the fixture-only child over the real production router

**Files:** `apps/api/src/capacity/harness_app.rs`;
`apps/api/src/capacity/runner.rs` (child protocol skeleton);
`apps/api/src/state.rs`; `apps/api/src/services/analytics.rs`;
`apps/api/src/services/iv_store.rs`; `apps/api/src/infrastructure/massive/ws.rs`;
`apps/api/src/routes/ticker.rs`; `apps/api/src/routes/price.rs`;
`apps/api/src/services/scanner/loop.rs`;
`apps/api/tests/capacity_harness.rs` (create).

1. Add RED integration/structural tests proving: fixture child binds `127.0.0.1:0`; ticker goes through
   `routes::router`; a frozen fixture request returns 200; absence returns the existing 404 envelope;
   fixture SSE produces a real data event; IV read fault leaves HTTP 200/`iv_rank:null`/required `ai_eval`;
   and production cannot select fixture assembly by environment.
2. Replace the false concrete-live assumption with explicit construction:

```rust
pub struct AppState {
    pub massive: Option<MassiveRestClient>,
    pub(crate) harness_market_data: Option<MarketDataPort>,
    pub(crate) lifecycle_probe: LifecycleProbe,
    // existing fields unchanged
}
impl AppState {
    pub fn massive(&self) -> AppResult<&MassiveRestClient>;
    pub(crate) async fn for_capacity_fixture(input: CapacityAppInput) -> AppResult<Self>;
}
```

   Normal/test constructors set `Some(MassiveRestClient)` and `None` fixture port. The capacity
   constructor sets `massive: None`, only `MarketDataPort::Fixture`, `PriceCache::Memory`, memory or
   unique-temp stores, fixture IV store, fixture stock hub, cap 32 and enabled probe. Update the nine live
   callers to `state.massive()?`; no caller falls back to fixture.
3. In `analytics.rs::compute_analytics`, choose `compute_from_port` only when the crate-private field is
   present; otherwise execute the existing Massive joins byte-for-byte. The fixture arm retains cache,
   singleflight and route serialization and never capture-spawns to production stores.
4. Add `IvStore::fixture_history` and `IvStore::fixture_fail_read` crate-private constructors. The latter
   returns a deterministic read error, has no production selector and never weakens the existing
   best-effort catch in `compute_analytics_from_vendor`.
5. Add `StockStreamHub::fixture()` returning
   `(StockStreamHub, FixtureStreamProducer, StockStreamWorkerStarter::disabled())`. The producer can
   publish only caller-supplied `StreamEvent`s to the existing broadcast bus; the disabled starter owns no
   worker and the fixture tuple has no URL/API key or `connect_async` reachability. `harness_app` emits the
   frozen sequence after the route has subscribed.
6. Assemble `routes::router(state)` plus only request-counting middleware, bind loopback, signal readiness
   only after bind/router/sampler/store validation, and serve with a private cancellation token. Run
   `cargo test -p api-rust --test capacity_harness`; expected exactly 8 passed. Commit
   `feat(capacity): assemble fixture-only loopback child`.

**Reviewer probe:** replace `massive: None` with `MassiveRestClient::new`; the constructor-inventory test
must fail even if no request was sent.

---

### Task B4 — Implement monotonic REST/SSE clients and protocol classification

**Files:** `apps/api/src/capacity/rest.rs` (create);
`apps/api/src/capacity/sse.rs` (create); `apps/api/src/capacity/model.rs`;
`apps/api/tests/capacity_clients.rs` (create).

1. Add RED real-socket tests for accepted JSON, fixture 404, malformed JSON, transport error, accepted
   SSE, exact 503 body plus `Retry-After: 30`, first data-bearing event parse, orderly close, abrupt drop,
   bounded timeout and an accepted stream surviving a refusal.
2. Implement `RestClient::request` and `SseClient::connect` against explicit `http://127.0.0.1:<port>`
   child addresses only. Reject any non-loopback host before constructing Reqwest requests. Latency begins
   immediately before send/connect and ends at the complete JSON body / accepted headers / classified
   refusal using `Instant`.
3. SSE parses event frames incrementally with a bounded line/event size, treats comments as non-data,
   validates `LiveUpdateBody`, and returns only the four closed outcome classes. Expected 404 and capacity
   refusal never increment unexpected errors; malformed/early EOF does.
4. Run `cargo test -p api-rust --test capacity_clients`; expected exactly 10 passed. Commit
   `feat(capacity): drive real REST and SSE sockets monotonically`.

**Reviewer probe:** change the 503 detail or omit `Retry-After`; only
`expected_capacity_refusal` must turn into `unexpected_error`.

---

### Task B5 — Orchestrate seven children, closed lanes and the 140-second ledger

**Files:** `apps/api/src/capacity/runner.rs`; `apps/api/src/capacity/mod.rs`;
`apps/api/tests/capacity_process.rs` (create).

1. Add RED process tests for exactly seven launches, bounded readiness with three consecutive one-second
   baselines, lanes A–E, E reset/re-readiness without replacement, continued independent lanes after one
   failure, cancellation acknowledgement, all-13-row timeout completion, shared recovery before cleanup,
   graceful shutdown, forced-cleanup failure and 140-second sum.
2. Define a versioned inherited JSONL protocol over child stdin/stdout:

```rust
enum ParentCommand { Sample { sequence: u64 }, ResetE, Shutdown }
enum ChildEvent {
    Ready { child: ChildId, pid: u32, addr: SocketAddr, protocol: u8 },
    Sample { sequence: u64, child: ChildId, resource: ResourceSnapshot },
    ResetReady { child: ChildId },
    ShutdownAck { child: ChildId },
    Failure { child: ChildId, stage: String, reason: String },
}
```

   Use `Command::env_clear()` and an explicit allowlist (`PATH`, required Windows system roots, Rust
   backtrace off, fixture/report roots, seed/clock and child ID). Reject inherited vendor/OAuth/LLM/
   database/Redis variables and redact absolute paths from retained diagnostics.
3. Implement lanes exactly: A 5s connect + shared 60s hold/soak/refusal + 5s drain; B ten sequential
   full-capacity waves at 6s each; C ten eight-client abrupt waves at 5s each; D1 12 cold identities plus
   absence within 8s; D2 five excluded warm-ups + 200/16 then 32 cold coalesced within 25s; D3 ten
   32-request batches over eight primed identities within 55s; E optional fault then reset/re-ready then
   outbound audit within 20s. Start lanes concurrently and preserve separate observation arrays/verdicts.
4. Sample once per second only after the stabilized baseline. After all traffic stops, keep every original
   PID alive for the same 30-second recovery window; sample each and aggregate before issuing shutdown.
   A lost PID is never replaced.
5. Wrap each phase in its own timeout including cancellation acknowledgement. On deadline, cancel that
   phase, mark every unfinished named scenario, continue safe independent groups, evaluate, clean up and
   write the complete report. Force-kill only the validated PID after the 7-second cleanup deadline and
   record the failure.
6. Run `cargo test -p api-rust --test capacity_process`; expected exactly 12 passed. Commit
   `feat(capacity): run seven isolated children on the fixed ledger`.

**Reviewer probe:** terminate B, C, D1, D2, D3 and E one at a time and inject an aggregate-only +3 task
delta; every mutation must fail `post_load_recovery` without erasing other lane evidence.

---

### Task B6 — Add connector-poison and optional-fault public controls

**Files:** `apps/api/src/capacity/self_test.rs` (create);
`apps/api/src/capacity/manifest.rs`; `apps/api/src/capacity/harness_app.rs`;
`apps/api/tests/fixtures/capacity-baseline/v1/outbound-connectors.json` (create);
`apps/api/tests/capacity_self_tests.rs` (create).

1. Add RED tests for non-empty seven-row connector inventory, healthy zero-attempt audit, each connector
   construction/invocation poison, a synthetic unlisted constructor, optional healthy/fault responses,
   unchanged core/`ai_eval` bytes, later SSE data, receipt validation and malformed-receipt refusal.
2. The checked connector manifest stores ordered `id`, repository-relative `path`, exact constructor
   signature and source SHA-256. The source scan recursively inventories Rust files without following
   symlinks, rejects known network primitives outside the inventory and rejects moved/missing signatures.
   The harness constructor receives a typed `ConnectorAudit`; every forbidden constructor facade records
   an attempt before returning `did_not_pass`. Production constructors do not import the audit.
3. `connector-poison` runs one healthy fixture audit, then each of the seven typed poisons, then a copied
   source-tree synthetic unlisted-constructor mutation. The receipt contains ordered `controls[]` with
   `connector_id`, `exercised`, nested scenario/summary verdict, expected failure and match; empty,
   tolerated, missing or extra rows make outer exit nonzero.
4. `optional-fault` starts one E-style fixture child, records healthy response with IV object and accepted
   SSE, resets to the identical baseline with the failing-read store, records HTTP 200 with only
   `market_state.iv_rank:null`, compares the manifest-defined core projection plus required
   `ai_eval.ready/state_fingerprint` bytes, then requires a later data event. Retain both response hashes
   and the stream observation in `optional-fault.json`.
5. Receipts use temp-sibling validation/atomic replacement and exact paths under
   `apps/api/data/capacity/self-tests/`. Run the focused suite; expected exactly 8 passed. Commit
   `feat(capacity): make isolation controls externally runnable`.

**Reviewer probe:** make one poison facade return success or delete the synthetic inventory probe; the
outer self-test must exit nonzero, not record a tolerated control.

---

### Task B7 — Commit and enforce the detached before/current identity corpus

**Files:** `apps/api/src/capacity/identity.rs` (create);
`apps/api/src/capacity/self_test.rs`;
`apps/api/tests/fixtures/capacity-baseline/v1/identity/manifest.json` (create);
`apps/api/tests/fixtures/capacity-baseline/v1/identity/capture-helper.rs` (create);
`apps/api/tests/fixtures/capacity-baseline/v1/identity/reference-test-seam.patch` (create);
`apps/api/tests/fixtures/capacity-baseline/v1/identity/inputs/spy.json` (create);
`apps/api/tests/fixtures/capacity-baseline/v1/identity/inputs/sse.json` (create);
`apps/api/tests/fixtures/capacity-baseline/v1/identity/before/ticker.json` (create);
`apps/api/tests/fixtures/capacity-baseline/v1/identity/before/sse.json` (create);
`apps/api/tests/fixtures/capacity-baseline/v1/identity/before/decision.json` (create);
`apps/api/tests/capacity_identity.rs` (create).

1. Before writing oracles, create a disposable detached worktree from the exact reference and prove the
   source commit:

```powershell
$identityRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("capacity-before-" + [guid]::NewGuid())
git worktree add --detach $identityRoot c30ed8151b82f847fd75552528dcba30bdca5ae8
git -C $identityRoot rev-parse HEAD
```

   Apply the committed `reference-test-seam.patch`, then copy only `capture-helper.rs` plus frozen inputs
   into that detached checkout. The patch is hash-pinned and may add only a `#[cfg(test)]` stock-hub event
   publisher plus the test-module include required to drive the existing socket route; assert the detached
   diff contains only those two test-seam hunks before building. The helper calls the reference revision's
   existing fixture Path B and `routes::market::build_bundle`, opens the real ticker SSE route, publishes
   the frozen event through the test-only hub seam, normalizes the event timestamp to the manifest clock,
   and calls public `generate_recommendation` with the already-shipped `AI_REC_LOCAL_ONLY=1` arm in its own
   child process. It must not copy current production source, scoring/recommendation edits or an oracle.
   Pin the helper and patch hashes in the manifest. Run the helper against the detached revision, inspect
   the three outputs, then remove the disposable worktree with `git worktree remove <exact path>`.
2. The manifest pins reference revision, helper/input/oracle paths and hashes, exact
   `SPY?min_dte=7&max_dte=45`, fixed UTC clock/seed, ordered projection and only the four allowed runtime
   exclusions. It embeds the five API artifact rows in the approved order and exact generated-client
   baseline entry/digest.
3. Implement current capture through the fixture child and real loopback routes. Canonicalize the complete
   decision-bearing ticker projection after removing only listed runtime paths; record the first
   data-bearing SSE body at the fixed input timestamp; separately project score, tier,
   `ai_eval.state_fingerprint`, entry gate and deterministic local-rules recommendation.
4. Run `npm run api:contract:check` unchanged with captured command/exit/status. Then hash all five files,
   validate exactly 52 operations in the baseline and emit `route_inventory`. Recursively enumerate every
   descendant of `libs/api/src/generated/` without following links, format regular files/directories/
   symlinks as `<type>\t<repo-relative-path>\n`, ordinal-sort and hash the concatenated UTF-8 bytes.
5. Negative controls operate in disposable copies: add one generated-client descendant and require the
   inventory mismatch; set existing `API_CONTRACT_TEST_EXTRA_OPERATION=1` for the unchanged checker and
   require its nested API-contract failure. Neither mutation touches the implementation worktree.
6. `byte-identity.json` records current full revision, governed after-tree digest, API command result,
   route row, all five artifact rows, generated inventory/base/current/additions/removals, exact exclusion
   list and before/after hashes for both decision artifacts. Any mismatch/malformed receipt makes outer
   exit nonzero. Run `cargo test -p api-rust --test capacity_identity`; expected exactly 7 passed. Commit
   `test(capacity): pin pre-feature route and decision identity`.

**Reviewer probe:** add a generated directory, enable the extra route, alter one oracle byte and add one
exclusion separately; all four mutations must be independently rejected.

---

### Task B8 — Expose CLI/Nx scripts, root aggregate and structural gates

**Files:** `apps/api/src/main.rs`; `apps/api/src/capacity/mod.rs`; `package.json`;
`apps/api/project.json`; `.github/workflows/ci.yml`;
`apps/api/tests/capacity_isolation.rs` (create); `tools/capacity-gate.spec.mjs` (create).

1. Add RED Clap/process tests for default normal, explicit extended and the exact self-test cases. Add
   structural tests for no production selector/import, no public operation change, capacity leaf import
   direction, report paths, package/Nx command equality, extended exclusion from `npm test`, and existing
   test-target ordering.
2. Add the concrete Clap shape and direct dispatcher:

```rust
Commands::CapacityBaseline {
    #[arg(long, value_enum, default_value_t = CapacityProfileArg::Normal)]
    profile: CapacityProfileArg,
    #[command(subcommand)]
    action: Option<CapacityAction>,
}
enum CapacityAction { SelfTest { #[arg(long, value_enum)] case: CapacitySelfTestCase },
                      #[command(hide = true)] Child { /* typed inherited-control args */ } }
```

   `main()` detects this arm after bootstrap/logging and returns `capacity::cli(...).await` directly.
   Normal/extended handled failures have already retained reports; child mode is inaccessible from
   environment and binds only loopback.
3. Add exact Nx targets using `cargo run -p api-rust --`:
   `capacity-baseline`, `capacity-baseline-extended`,
   `capacity-baseline-self-test-connector-poison`,
   `capacity-baseline-self-test-optional-fault`, and
   `capacity-baseline-self-test-byte-identity`, all `cache:false`. Their `options` are exactly:

```json
"capacity-baseline": {
  "executor": "nx:run-commands",
  "options": { "command": "cargo run -p api-rust -- capacity-baseline", "cwd": "{workspaceRoot}" },
  "cache": false
},
"capacity-baseline-extended": {
  "executor": "nx:run-commands",
  "options": { "command": "cargo run -p api-rust -- capacity-baseline --profile extended", "cwd": "{workspaceRoot}" },
  "cache": false
},
"capacity-baseline-self-test-connector-poison": {
  "executor": "nx:run-commands",
  "options": { "command": "cargo run -p api-rust -- capacity-baseline self-test --case connector-poison", "cwd": "{workspaceRoot}" },
  "cache": false
},
"capacity-baseline-self-test-optional-fault": {
  "executor": "nx:run-commands",
  "options": { "command": "cargo run -p api-rust -- capacity-baseline self-test --case optional-fault", "cwd": "{workspaceRoot}" },
  "cache": false
},
"capacity-baseline-self-test-byte-identity": {
  "executor": "nx:run-commands",
  "options": { "command": "cargo run -p api-rust -- capacity-baseline self-test --case byte-identity", "cwd": "{workspaceRoot}" },
  "cache": false
}
```

4. Add root scripts exactly named by SPEC. Preserve the old root target as `test:targets`, then define
   `test` in this exact order: `npm run test:targets`, connector-poison, optional-fault, byte-identity,
   normal baseline. Do not include extended. Each capacity script invokes its one Nx target with
   `--skip-nx-cache`:

```json
"test:targets": "nx run-many -t test -p @convexa/dashboard,@convexa/api,api",
"test": "npm run test:targets && npm run capacity:baseline:self-test:connector-poison && npm run capacity:baseline:self-test:optional-fault && npm run capacity:baseline:self-test:byte-identity && npm run capacity:baseline",
"capacity:baseline": "nx run api:capacity-baseline --skip-nx-cache",
"capacity:baseline:extended": "nx run api:capacity-baseline-extended --skip-nx-cache",
"capacity:baseline:self-test:connector-poison": "nx run api:capacity-baseline-self-test-connector-poison --skip-nx-cache",
"capacity:baseline:self-test:optional-fault": "nx run api:capacity-baseline-self-test-optional-fault --skip-nx-cache",
"capacity:baseline:self-test:byte-identity": "nx run api:capacity-baseline-self-test-byte-identity --skip-nx-cache"
```
5. Extend Linux CI after the same-revision Cargo test/build to run the three self-tests and normal command
   and upload all four retained JSON files on `always()`. Do not claim that Ubuntu is Windows evidence.
6. Add a Node mutation/propagation suite that works only in disposable temporary package roots. For each
   evaluator breach family (p95 latency, maximum latency, error, disconnect, RSS, handle/descriptor,
   Tokio task, per-child recovery, aggregate recovery, elapsed and connector isolation), feed the real
   Rust evaluator fixture to produce a complete failing report/process result, then substitute only the
   disposable root's capacity command with that recorded result while its other four stages succeed and
   invoke `npm test`. Assert root exit nonzero and byte-equal retained observed value/unit/threshold. A
   separate all-success row asserts zero. This is the compositional AC-22 proof: the Rust process proves
   every breach family; the disposable root aggregate proves no stage masks its exit. It never edits the
   implementation checkout or exposes a runtime test switch.
7. Run `cargo test -p api-rust --test capacity_isolation`; expected exactly 10 passed. Run the Clap help
   and all focused test binaries; commit `feat(capacity): wire repository commands and normal gate`.

**Reviewer probe:** put extended in root `test`, reorder normal before a self-test, add an HTTP route or
introduce `CAPACITY_HARNESS` env selection; structural tests must fail.

---

### Task B9-backend-closer — Run the integrated service and write only conformance evidence

**Files:** `.spire/clusters/tech/contracts/capacity-baseline/conformance-receipt.json` (create).

**Depends on:** B0–B8. This is the sole backend closer. It does not edit or re-implement worker-owned
source, fixture, workflow, script or test paths.

1. From final bytes, run all three public self-tests, validate their retained receipts, then run normal.
   Require seven recovery children, aggregate, all 13 rows, cleanup evidence, report verdict pass and
   command wall time ≤180 seconds. Leave the normal JSON at its specified ignored runtime path.
2. Start one fixture-only child through the capacity command's private closer hook, not production
   `serve`, and run the interface command from V8 against its loopback address. Write only the generic
   conformance receipt at the owned path; expected one endpoint passed, zero failed.
3. Hand the normal report, three receipts, exact target revision, Windows platform evidence and Linux CI
   artifact identifiers to QA. Stop the child after capture. Commit only the conformance receipt if the
   repository tracks it.

**Reviewer probe:** conformance must hit the same fixture `routes::router` child used by the harness;
running against an unrelated dev/prod server is not closer evidence.

## Independence

All implementation tasks are backend and dependency-ordered. Their path prefixes overlap by design, so
all are honestly `no`. There is no frontend implementation task and therefore no frontend closer.

| Task | Lane | Paths | Depends on | Independent |
|---|---|---|---|---|
| B0 | backend | `apps/api/src/capacity/**`; `apps/api/src/lib.rs`; `apps/api/tests/fixtures/capacity-baseline/v1/**`; `apps/api/tests/capacity_manifest_report.rs` | — | no |
| B1 | backend | `apps/api/src/capacity/**`; `apps/api/tests/capacity_manifest_report.rs` | B0 | no |
| B2 | backend | `apps/api/src/capacity/**`; `apps/api/src/services/live_capacity.rs`; `apps/api/src/routes/stream.rs`; `apps/api/tests/capacity_resources.rs` | B1 | no |
| B3 | backend | `apps/api/src/capacity/**`; `apps/api/src/state.rs`; `apps/api/src/services/analytics.rs`; `apps/api/src/services/iv_store.rs`; `apps/api/src/infrastructure/massive/ws.rs`; `apps/api/src/{routes/ticker.rs,routes/price.rs,services/scanner/loop.rs}`; `apps/api/tests/capacity_harness.rs` | B2 | no |
| B4 | backend | `apps/api/src/capacity/**`; `apps/api/tests/capacity_clients.rs` | B3 | no |
| B5 | backend | `apps/api/src/capacity/**`; `apps/api/tests/capacity_process.rs` | B4 | no |
| B6 | backend | `apps/api/src/capacity/**`; `apps/api/tests/fixtures/capacity-baseline/v1/**`; `apps/api/tests/capacity_self_tests.rs` | B5 | no |
| B7 | backend | `apps/api/src/capacity/**`; `apps/api/tests/fixtures/capacity-baseline/v1/identity/**`; `apps/api/tests/capacity_identity.rs` | B6 | no |
| B8 | backend | `apps/api/src/main.rs`; `apps/api/src/capacity/**`; `package.json`; `apps/api/project.json`; `.github/workflows/ci.yml`; `apps/api/tests/capacity_isolation.rs`; `tools/capacity-gate.spec.mjs` | B7 | no |
| B9-backend-closer | backend | `.spire/clusters/tech/contracts/capacity-baseline/conformance-receipt.json` | B0–B8 | no |

## Verification track

Run in order from the target revision. Check `$LASTEXITCODE` after every command. Reports/receipts are
evidence only when their closed validators pass. Do not replace missing Windows 11 or Linux x64 evidence
with the other platform.

### V1 — Worktree and immutable contract preflight

```powershell
npm run worktree:link
npx nx sync:check
git cat-file -e 'c30ed8151b82f847fd75552528dcba30bdca5ae8^{commit}'
npm run api:contract:check
```

Expected: all exit 0; reference commit exists; API output says the generated artifacts match the Rust
contract and retains exactly 52 operations. No command writes accepted contract artifacts.

### V2 — Focused pure and process suites

```powershell
cargo test -p api-rust --test capacity_manifest_report -- --nocapture
cargo test -p api-rust --test capacity_harness -- --nocapture
cargo test -p api-rust --test capacity_clients -- --nocapture
cargo test -p api-rust --test capacity_process -- --nocapture
cargo test -p api-rust --test capacity_self_tests -- --nocapture
cargo test -p api-rust --test capacity_identity -- --nocapture
cargo test -p api-rust --test capacity_isolation -- --nocapture
node --test tools/capacity-gate.spec.mjs
```

Expected pass counts in order: 12, 8, 10, 12, 8, 7 and 10; zero failed/ignored. The process suite uses
short test manifests, never sleeps for the production 60/900-second durations. The Node command reports
exactly 12 passed, 0 failed (eleven breach families plus the all-success control).

### V3 — Windows 11 x64 adapter and normal-profile evidence

On the current Windows 11 x64 host after `cargo test` has built the same revision:

```powershell
cargo test -p api-rust --test capacity_resources -- --nocapture
$clock=[System.Diagnostics.Stopwatch]::StartNew()
npm run capacity:baseline
$clock.Stop()
$clock.Elapsed.TotalMilliseconds
```

Expected: resource suite 6/6; command exits 0 in ≤180,000 ms; normal report says
`environment.os=windows`, `arch=x86_64`, sampler semantic `handles`, `summary.elapsed_ms≤180000`, exactly
13 passing scenarios and seven ordered recovery children plus passing aggregate/cleanup.

### V4 — Linux x64 adapter and normal-profile evidence

On Ubuntu 24.04 x64 CI from the same target revision:

```bash
cargo test -p api-rust --test capacity_resources -- --nocapture
/usr/bin/time -f '%e' npm run capacity:baseline
```

Expected: resource suite 6/6; command exits 0 in ≤180 seconds; report says `os=linux`, `arch=x86_64`,
sampler semantic `file_descriptors`, and the same closed 13-row/seven-child shape. Missing CI artifact is
UNVERIFIABLE, not a Windows-derived pass.

### V5 — Three externally runnable self-tests and receipt validation

```powershell
npm run capacity:baseline:self-test:connector-poison
npm run capacity:baseline:self-test:optional-fault
npm run capacity:baseline:self-test:byte-identity
```

Expected: each outer command exits 0. `connector-poison.json` has seven exercised rejecting connector
controls plus one rejecting unlisted-inventory control and no tolerated row. `optional-fault.json` has
healthy object, fault HTTP 200/null, equal core/`ai_eval` hashes and a later SSE data event.
`byte-identity.json` records the unchanged API check pass, 52-operation route row, five exact matching
artifact rows, exact one-entry generated inventory/no additions/removals, both matching decision hashes
and exactly four exclusions.

### V6 — Root aggregate and failure propagation

```powershell
npm test
```

Expected: existing dashboard/API/Rust target output passes first, then the three self-test commands, then
normal. The aggregate exits 0 only after all five stages; extended is absent. The V2 disposable
mutation/propagation suite is the non-destructive rejecting-path proof for every AC-22 breach family.

### V7 — Extended profile

```powershell
npm run capacity:baseline:extended
```

Expected: exit 0; extended report has the same 13 IDs/counts/thresholds, 900-second mixed soak and a
retained quiescent RSS slope observation ≤1 MiB/min. It does not read, write or satisfy the normal report
path. This release-evidence command is intentionally not in `npm test` and not subject to 180 seconds.

### V8 — Live generic interface conformance

After B9 exposes the fixture child URL:

```powershell
node .codex/tools/gates.mjs interface_conformance `
  --contract .spire/clusters/tech/contracts/capacity-baseline/INTERFACE_CONTRACT.md `
  --url http://127.0.0.1:<fixture-port> `
  --report .spire/clusters/tech/contracts/capacity-baseline/conformance-receipt.json
```

Expected: exit 0; receipt verdict `PASS`; exactly 1 passed, 0 failed, 1 total. SSE lifecycle evidence comes
from the harness report, not this finite JSON probe.

### V9 — Regression, formatting and protected contract/math paths

```powershell
cargo test -p api-rust -p quant-engine
cargo test -p api-rust --test score_identity
cargo test -p quant-engine --test golden --test signals_characterization
cargo fmt --all -- --check
cargo clippy -p api-rust --all-targets -- -D warnings
git diff --exit-code c30ed8151b82f847fd75552528dcba30bdca5ae8 -- `
  apps/api/openapi/precutover-operation-baseline.json `
  apps/api/openapi/convexa.openapi.json `
  apps/api/openapi/parity-coverage.json `
  apps/api/openapi/generated-artifacts.manifest.json `
  libs/api/src/generated/schema.ts `
  libs/quant-engine
```

Expected: all tests/checks exit 0; existing score identity is 3/3 and quant integrations 5/5; the five API
artifacts, generated schema and quant tree have no feature diff. The full Rust suite contains the recorded
947-test baseline plus every planned capacity test; no existing test is removed or ignored.

### V10 — Acceptance coverage and receipt audit

| SPEC criteria | Plan owners / evidence |
|---|---|
| AC-1 | B0, B5, B8; V3–V4, V6 |
| AC-2 | B0–B1, B5, B8; V7 |
| AC-3–AC-7 | B0, B4–B5; V2–V4 |
| AC-8–AC-12 | B2–B5; V2–V4 |
| AC-13–AC-15 | B1–B2, B5; V3–V4, V7 |
| AC-16 | B3, B6; V3–V5 |
| AC-17 | B6, B8; V5–V6 |
| AC-18 | B3, B6; V5–V6 |
| AC-19–AC-21 | B0–B2, B5; V2–V4 |
| AC-22 | B1, B6, B8; V2, V6 |
| AC-23 | B1; exact-copy review of normal and failure report in V3/V6 |
| AC-24 | F-V1–F-V2 |
| AC-25 | B7–B8; V1, V5, V9 |
| AC-26 | B3, B8; V2, V8–V9 |

Expected audit result: every AC-1 through AC-26 has at least one implementation owner and one named
runtime/test/review evidence source; none relies only on source inspection where SPEC says `test`.

## Frontend `NO_UI_CHANGE` verification track

### F-V1 — Structural frontend fence

```powershell
git diff --exit-code c30ed8151b82f847fd75552528dcba30bdca5ae8 -- `
  apps/dashboard apps/dashboard-e2e libs/api/src/lib libs/api/src/generated
```

Expected: empty diff. If concurrent unrelated frontend work exists on the target branch, compare the
feature commits/path ownership instead and record the exact unrelated paths; do not absorb or revert them.

### F-V2 — Existing product regression and bounded visible review

```powershell
npx nx test @convexa/dashboard
npx nx build @convexa/dashboard --configuration=production
```

Expected: both exit 0. Review Landing, Ticker, Scanner and Positions in the existing browser harness and
record: no new/changed control, copy, status, workflow, capacity link or failure surface. This review owns
AC-24 and the fixed report disclaimer review owns AC-23; no new screenshot baseline is created.
