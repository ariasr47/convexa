# archive-coverage-guardrails — implementation plan

> Execute from the isolated repository root. Preserve other work. Do not edit `SPEC.md` or
> `INTERFACE_CONTRACT.md`. Every task follows red → green → commit and reports a source conflict through
> GATE Z instead of adapting this approved design silently.

**Goal:** Give operators honest, bounded evidence for missing or unreadable SPY/QQQ/IWM session books,
plus a strict read-only local audit and storage-capacity procedure, without a vendor call, subscription,
trader-path change, or browser/UI change.

**Architecture:** One embedded, validated XNYS full-day calendar and one typed coverage evaluator are
shared by the producer, minute worker, metrics snapshot, and CLI audit. The worker performs eligible
ensure attempts first, then evaluates off-request-path and atomically publishes immutable evidence;
`GET /api/_metrics` only projects that memory. The CLI opens the configured live namespace through a
dedicated non-creating/non-migrating reader and disables the runtime success cache.

**Tech stack:** Rust 2021, Axum 0.8, Tokio, clap 4, chrono/chrono-tz, serde/serde_json, optional sqlx
Postgres, existing filesystem body store, repository Node-based interface conformance. No new crate,
service, account, or subscription is required.

**Spec:** `.spire/clusters/tech/contracts/archive-coverage-guardrails/SPEC.md` (APPROVED 2026-08-26)  
**Interface:** `.spire/clusters/tech/contracts/archive-coverage-guardrails/INTERFACE_CONTRACT.md`

## Track map

| Track | Tasks | Shape |
|---|---:|---|
| Backend + operations | B1 → B2 → B4 | Sequential execution; B4 is the one backend closer and owns the runbook |
| Frontend | none | `NO_UI_CHANGE`; no dashboard task and no frontend closer |
| Verification | V1–V7 | Runs after B4; QA independently repeats it at GATE Q |

## Global Constraints

- `NO_UI_CHANGE`: do not edit `apps/dashboard/**`, `functions/**`, generated `libs/api/**`, browser
  routes, copy, navigation, motion, or design-system files. AC-20 is proven by an empty dashboard diff.
- The activation date is exactly `2026-08-24` ET, checkpoint exactly `10:30:00
  America/New_York`, runtime lookback exactly five eligible sessions, and closed symbol order exactly
  `SPY`, `QQQ`, `IWM`. These are checked-in policy, not environment settings.
- Runtime and CLI use the same calendar, eligibility, identity, strict decoder/reconciliation, count,
  and last-readable logic. Audit changes only the selected range and disables the success cache.
- Runtime/CLI readers expose metadata lookup and strict load only. They have no insert, delete, prune,
  repair, migration, vendor, analytics, scoring, cache-mutation, trader-route, or SSE capability.
- The request handler performs no archive I/O. It reads the latest immutable snapshot and current
  process counters only; first failure is `unavailable`, later failure is `stale` with last-good facts.
- An archive gap never refuses startup. Invalid production policy/calendar or an unusable required live
  archive refuses before listener/workers. Evaluation failure never fails trader HTTP/SSE.
- Write-failure counters and warning keys are process-local. Count only failed SPY/QQQ/IWM archive
  inserts. One warning key is `(symbol, et_date)`, regardless of missing↔unreadable transitions.
- Warnings/metrics/audit never expose body bytes, locators, absolute paths, secrets, credentials, env
  values, or raw storage errors. Map faults to bounded vocabulary before rendering/logging.
- Do not touch `libs/quant-engine/**`, trader routes, SSE payloads, recommendations, score/tier/gate, or
  fingerprint code. The existing `apps/api/tests/score_identity.rs` pin remains green.
- No reconstruction or fixture can satisfy live coverage. The production reader is constructed only
  from configured production metadata/body roots; test fakes are injected directly into the evaluator.
- PowerShell gates must inspect `$LASTEXITCODE`. Formatting, if needed, is `cargo fmt --all -- --check`
  for verification and `cargo fmt --all` only on the feature branch before committing.

## Conformance spec

The generic interface runner cannot inject the operator's arbitrary metrics header. The G1 live-shape run therefore uses a local harness with `METRICS_SECRET_TOKEN` deliberately unset and primes one evaluator pass before the request. Dedicated route tests must separately prove both accepted operator-token headers and the 401 denial. `auth` is intentionally absent below because runner `auth` means session-cookie authentication, which is not this endpoint's boundary.

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/_metrics",
      "path_params": {},
      "query": {},
      "required": {
        "session_archive_coverage.status": "string",
        "session_archive_coverage.status_detail": "string|null",
        "session_archive_coverage.data_stale": "boolean",
        "session_archive_coverage.activation_et_date": "string",
        "session_archive_coverage.checkpoint_et": "string",
        "session_archive_coverage.lookback_eligible_sessions": "number",
        "session_archive_coverage.evaluated_at_et": "string|null",
        "session_archive_coverage.last_verified_at_utc": "string|null",
        "session_archive_coverage.range.start_et_date": "string|null",
        "session_archive_coverage.range.end_et_date": "string|null",
        "session_archive_coverage.required_symbols[]": "string",
        "session_archive_coverage.counts.expected": "number|null",
        "session_archive_coverage.counts.present": "number|null",
        "session_archive_coverage.counts.readable": "number|null",
        "session_archive_coverage.counts.missing": "number|null",
        "session_archive_coverage.counts.unreadable": "number|null",
        "session_archive_coverage.counts.not_due": "number|null",
        "session_archive_coverage.books[].symbol": "string",
        "session_archive_coverage.books[].et_date": "string",
        "session_archive_coverage.books[].status": "string",
        "session_archive_coverage.books[].source_as_of": "string|null",
        "session_archive_coverage.per_symbol[].symbol": "string",
        "session_archive_coverage.per_symbol[].last_readable_et_date": "string|null",
        "session_archive_coverage.per_symbol[].last_readable_source_as_of": "string|null",
        "session_archive_coverage.per_symbol[].write_failures_since_observation": "number",
        "session_archive_coverage.observation.started_at_utc": "string",
        "session_archive_coverage.observation.write_failures_total": "number"
      }
    }
  ]
}
```

## Independence

| Task | Lane | Paths | Depends on | Independent |
|---|---|---|---|---|
| B1-core-policy | backend | `apps/api/src/services/session_chain_archive/coverage.rs`; `apps/api/src/services/session_chain_archive/market_calendar.rs`; `apps/api/src/services/session_chain_archive/calendars/**`; `apps/api/src/services/session_chain_archive/ensure.rs`; `apps/api/src/services/session_chain_archive/mod.rs`; `apps/api/tests/archive_coverage_isolation.rs` | — | yes |
| B2-readonly-audit | backend | `apps/api/src/services/session_chain_archive/audit.rs`; `apps/api/src/services/session_chain_archive/store.rs`; `apps/api/src/services/session_chain_archive/body_store.rs`; `apps/api/src/db/pg_session_chain_archive.rs`; `apps/api/tests/archive_coverage_audit.rs` | B1-core-policy | yes |
| B4-backend-closer | backend | `apps/api/src/services/session_chain_archive/mod.rs`; `apps/api/src/services/session_chain_archive/archive.rs`; `apps/api/src/services/session_chain_archive/ensure_worker.rs`; `apps/api/src/services/chain_snapshot/capture.rs`; `apps/api/src/state.rs`; `apps/api/src/routes/health.rs`; `apps/api/src/routes/mod.rs`; `apps/api/src/main.rs`; `apps/api/src/server.rs`; `apps/api/src/capacity/identity.rs`; `apps/api/tests/archive_coverage_runtime.rs`; `apps/api/openapi/convexa.openapi.json`; `apps/api/openapi/parity-coverage.json`; `apps/api/openapi/generated-artifacts.manifest.json`; `apps/api/tests/fixtures/api_contract/boundary-evidence.json`; `apps/api/tests/fixtures/capacity-baseline/v1/identity/manifest.json`; `libs/api/src/generated/schema.ts`; `docs/DEPLOY_RUNBOOK.md`; `.spire/clusters/tech/contracts/archive-coverage-guardrails/conformance-receipt.json` | B1-core-policy, B2-readonly-audit | no |

The two `yes` rows have disjoint write paths, but they are **not parallel**: B2 consumes B1's evaluator
types, so execution is strictly B1 → B2 → B4. `mod.rs` is the one intentional sequential overlap between
B1 and the `no` closer row: B1 declares/exports only `coverage` and `market_calendar` so its code compiles;
B4 later adds `audit` and runtime-facing exports without rewriting those B1 declarations. B4 is the
**only backend closer** and owns integration, operations documentation, serve, and the backend
conformance receipt; it must not re-implement B1/B2 worker paths. There is no frontend row because the
approved design names no frontend file and requires `NO_UI_CHANGE`.

## Backend worker 1 — B1-core-policy

### Deliverable

Implement the validated policy, embedded calendar, deterministic evaluator, cache/dedup state, and the
shared producer eligibility correction. Export only the new `coverage` and `market_calendar` modules
from `session_chain_archive/mod.rs`; audit/runtime exports remain reserved for B4. Own only the B1 paths
in the table.

### Red tests

Create unit tests inside `market_calendar.rs` and `coverage.rs`, plus the mutation/source guards in
`apps/api/tests/archive_coverage_isolation.rs`.

```rust
#[test]
fn production_policy_is_fixed_and_validated() { /* activation=2026-08-24, 10:30 ET, lookback=5 */ }
#[test]
fn rejects_zero_or_above_ceiling_lookback() { /* CoveragePolicy::new -> Err */ }
#[test]
fn calendar_header_and_closed_vocab_are_exact() { /* id/version/domain/schema/name tokens */ }
#[test]
fn every_artifact_row_is_unique_in_domain_and_v1_exceptions_empty() { /* exhaustive */ }
#[test]
fn saturday_sunday_and_every_closure_are_ineligible() { /* iterate artifact */ }
#[test]
fn every_other_in_domain_weekday_is_eligible() { /* domain walk */ }
#[test]
fn out_of_domain_is_an_error_not_false() { /* 2025-12-31, 2036-01-01 */ }
#[test]
fn producer_and_detector_membership_are_identical() { /* same calendar method */ }

#[tokio::test]
async fn before_checkpoint_is_not_due_and_excluded_from_expected() {}
#[tokio::test]
async fn after_checkpoint_classifies_missing_readable_and_unreadable_exactly() {}
#[tokio::test]
async fn strict_identity_mismatch_is_unreadable() {}
#[tokio::test]
async fn latest_readable_is_selected_per_symbol_or_explicitly_absent() {}
#[tokio::test]
async fn runtime_range_is_five_eligible_sessions_floored_by_activation() {}
#[tokio::test]
async fn zero_expected_range_has_no_completeness_claim() {}
#[tokio::test]
async fn success_cache_reloads_changed_identity_and_expires_at_five_minutes() {}
#[tokio::test]
async fn warning_key_is_identity_only_and_survives_recovery_in_same_run() {}
```

In the isolation binary, scan `coverage.rs`, `market_calendar.rs`, and `ensure.rs` for forbidden
imports/calls (`massive`, `analytics`, `quant_engine`, trader routes, `insert_if_absent`, delete/prune,
`open_json`) and include a pure poison helper proving each scan fails when a banned token is injected.

Run first:

```powershell
cargo test -p api-rust market_calendar::tests coverage::tests -- --nocapture
cargo test -p api-rust --test archive_coverage_isolation -- --nocapture
```

Expected red: modules/tests do not exist or assertions fail. Do not weaken a calendar or identity test.

### Minimal implementation

First make the new modules part of the crate so every B1 red/green command compiles them:

```rust
// apps/api/src/services/session_chain_archive/mod.rs — B1 additions only
pub(crate) mod coverage;
pub(crate) mod market_calendar;
```

Use these closed types/signatures; serde tokens are snake_case and exhaustive matches use no wildcard.

```rust
pub const COVERAGE_SYMBOLS: [&str; 3] = ["SPY", "QQQ", "IWM"];
pub const MAX_RUNTIME_LOOKBACK: usize = 20;
pub const SUCCESS_CACHE_TTL: chrono::Duration = chrono::Duration::minutes(5);

#[derive(Clone, Debug)]
pub struct CoveragePolicy {
    pub activation_et_date: chrono::NaiveDate,
    pub checkpoint_et: chrono::NaiveTime,
    pub runtime_lookback_eligible_sessions: usize,
}

impl CoveragePolicy {
    pub fn production() -> Result<Self, CoverageError> {
        Self::new(
            chrono::NaiveDate::from_ymd_opt(2026, 8, 24).unwrap(),
            chrono::NaiveTime::from_hms_opt(10, 30, 0).unwrap(),
            5,
        )
    }
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BookCoverageStatus { NotDue, Readable, Missing, Unreadable }

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CoverageSnapshotStatus { Current, Stale, Unavailable }

pub trait LiveArchiveRead: Send + Sync {
    fn metadata<'a>(&'a self, symbol: &'a str, et_date: chrono::NaiveDate)
        -> futures_util::future::BoxFuture<'a, Result<Option<SessionBookMeta>, CoverageError>>;
    fn strict_load<'a>(&'a self, meta: &'a SessionBookMeta)
        -> futures_util::future::BoxFuture<'a, Result<StrictBook, CoverageError>>;
}

pub async fn evaluate<R: LiveArchiveRead>(
    reader: &R,
    calendar: &MarketCalendar,
    policy: &CoveragePolicy,
    selected: CoverageRange,
    now_utc: chrono::DateTime<chrono::Utc>,
    cache: &mut SuccessVerificationCache,
) -> Result<CoverageEvidence, CoverageFailure>;
```

`CoverageEvidence` contains the selected `books` matrix, numeric six-count `CoverageCounts`, exact
range, evaluation time, verified time, and exactly three last-readable rows. `CoverageFailure` carries
an optional already-computed range plus one bounded enum reason; it never carries `AppError` text.

Embed `calendars/xnys_full_day_2026_2035.v1.json` with `include_str!`. Its header is exactly:

```json
{
  "calendar_id": "XNYS-full-day",
  "schema_version": 1,
  "calendar_version": "2026-2035@2026-08-26.1",
  "domain_start": "2026-01-01",
  "domain_end": "2035-12-31",
  "scheduled_full_day_closures": [],
  "exceptional_full_day_closures": []
}
```

Populate `scheduled_full_day_closures` with objects
`{nominal_date,closed_et_date,name,observance}`. The exhaustive closed-date oracle below is binding;
Saturday New Year's Day has no observed closure (NYSE 2028 precedent), early closes are absent:

```text
2026: 01-01,01-19,02-16,04-03,05-25,06-19,07-03[07-04 friday_before],09-07,11-26,12-25
2027: 01-01,01-18,02-15,03-26,05-31,06-18[06-19 friday_before],07-05[07-04 monday_after],09-06,11-25,12-24[12-25 friday_before]
2028: 01-17,02-21,04-14,05-29,06-19,07-04,09-04,11-23,12-25
2029: 01-01,01-15,02-19,03-30,05-28,06-19,07-04,09-03,11-22,12-25
2030: 01-01,01-21,02-18,04-19,05-27,06-19,07-04,09-02,11-28,12-25
2031: 01-01,01-20,02-17,04-11,05-26,06-19,07-04,09-01,11-27,12-25
2032: 01-01,01-19,02-16,03-26,05-31,06-18[06-19 friday_before],07-05[07-04 monday_after],09-06,11-25,12-24[12-25 friday_before]
2033: 01-17,02-21,04-15,05-30,06-20[06-19 monday_after],07-04,09-05,11-24,12-26[12-25 monday_after]
2034: 01-02[01-01 monday_after],01-16,02-20,04-07,05-29,06-19,07-04,09-04,11-23,12-25
2035: 01-01,01-15,02-19,03-23,05-28,06-19,07-04,09-03,11-22,12-25
```

Use exact approved names from SPEC §2.1. `MarketCalendar::is_eligible(date)` returns `Result<bool>`;
it does not calculate holidays or infer observance at runtime. Validate duplicate nominal/closed dates,
domain, tokens, header, and the empty exceptional set once at construction.

Add the calendar-backed authority while retaining a temporary compiling seam for B4-owned legacy call
sites. B1 must not break the existing three-argument call in `ensure_worker.rs` before the closer can
integrate AppState's validated calendar:

```rust
pub fn ensure_eligible_with_calendar(
    symbol: &str,
    now: DateTime<Utc>,
    archive_enabled: bool,
    calendar: &MarketCalendar,
) -> Result<bool, CoverageError> {
    let et_date = now.with_timezone(&New_York).date_naive();
    Ok(is_ensure_symbol(symbol) && archive_enabled && calendar.is_eligible(et_date)?)
}

/// Temporary source-compatible seam for pre-B4 callers. Production integration must switch to
/// `ensure_eligible_with_calendar` using AppState's already-validated calendar.
pub fn ensure_eligible(symbol: &str, now: DateTime<Utc>, archive_enabled: bool) -> bool {
    MarketCalendar::embedded()
        .and_then(|calendar| ensure_eligible_with_calendar(symbol, now, archive_enabled, &calendar))
        .unwrap_or(false)
}
```

The temporary wrapper exists only so B1 compiles against B4-owned callers; it is not the final production
authority and must not be used by the post-B4 worker. Keep `ENSURE_SYMBOLS` byte-for-byte
`&["SPY", "QQQ", "IWM"]`; do not add a second holiday list.
The success cache key is `(symbol, et_date, source_as_of)` and caches only successful strict loads.
New/changed metadata bypasses it; `verified_at + 5 minutes <= now` forces a body reload. Audit supplies a
disabled cache. Warning policy returns identities to log; it does not log inside the pure evaluator.

B1 is not complete until all of the following are implemented—not merely type declarations:

- selected identities include explicit `not_due` rows before the ET checkpoint while excluding them
  from expected/present/readable/missing/unreadable totals;
- every due identity has exactly one strict state, counts reconcile algebraically, and each symbol's
  newest strictly readable ET date/source timestamp (or explicit absence) is returned;
- evaluation faults retain the optional already-computed range in `CoverageFailure` without fabricating
  counts, preparing B4's unavailable/stale publication logic;
- the success cache is bounded to five minutes, keys immutable source timestamp, caches only successes,
  and reloads new/changed/expired identities;
- warning selection deduplicates by `(symbol, et_date)` only, suppresses missing↔unreadable repeats,
  never warns for `not_due`, and does not clear the key after recovery in the same run;
- calendar construction exhaustively validates header/id/version/domain, every scheduled name and
  observance token, duplicate nominal/closed dates, out-of-domain rows, the exact date oracle, and the
  empty v1 exceptional-closure array; producer and detector tests walk the whole domain.

### Green and commit

```powershell
cargo test -p api-rust market_calendar::tests coverage::tests -- --nocapture
cargo test -p api-rust --test archive_coverage_isolation -- --nocapture
```

Expected: **16 unit tests + 8 isolation tests passed; 0 failed**. Commit:
`feat(archive): add coverage policy calendar and evaluator`.

Both commands must compile and pass from the repository root before B1 is handed to B2. A module file
that exists but is not declared in `mod.rs`, or an evaluator that omits any completion bullet above, is a
red/incomplete B1—not work deferred to the closer.

**Reviewer probe:** mutate one closure date, use weekday-only producer logic, accept an out-of-domain
date, cache an error, or key a warning by condition; a named test must go red.

## Backend worker 2 — B2-readonly-audit

### Deliverable

Implement the narrow live reader, non-mutating JSON/Postgres open paths, strict body reconciliation,
audit runner/output, and audit behavior tests. Own only B2 paths; depend on B1 types rather than copying
calendar/evaluator logic.

### Red tests

Create `apps/api/tests/archive_coverage_audit.rs` with exactly these nine high-level cases:

1. complete due range → ordered scope/count/matrix/last-readable lines, exact PASS, exit 0;
2. absent index → `missing`, exact FAIL, nonzero;
3. indexed missing/corrupt body → `unreadable`, no PASS, nonzero;
4. decoded symbol/date/source mismatch → `unreadable`, nonzero;
5. malformed/reversed/out-of-domain range → exact bounded ERROR, no counts claim, nonzero;
6. weekend/holiday/preactivation range → exact zero-expected sentence only, exit 0;
7. pre-checkpoint current date → `not due until 10:30:00 ET`, no warning, exit 0;
8. opening absent JSON index/body roots refuses without creating either path;
9. bytes, metadata mtimes, directory tree, and Postgres rows are identical before/after audit.

Add unit red tests for `FsBodyStore::open_read_only` and `SessionChainArchive::open_json_read_only`:

```rust
#[test]
fn read_only_body_open_requires_existing_directory() {
    let absent = unique_tmp("absent_body_root");
    let before = absent.exists();
    assert!(FsBodyStore::open_read_only(&absent).is_err());
    assert_eq!(absent.exists(), before);
}

#[tokio::test]
async fn read_only_json_open_never_creates_or_migrates() {
    // legacy body_b64 bytes and mtimes remain byte-identical; no body file is written.
}
```

Run first and observe red:

```powershell
cargo test -p api-rust --test archive_coverage_audit -- --nocapture
```

### Minimal implementation

Add metadata-only lookup without loading body bytes:

```rust
impl SessionChainArchive {
    pub async fn metadata(&self, symbol: &str, et_date: &str)
        -> AppResult<Option<SessionBookMeta>> { /* Memory/Json index; PG SELECT metadata only */ }

    pub async fn open_json_read_only(dir: &Path, ring: &Path, body_root: &Path)
        -> AppResult<Self> {
        // same conflict checks; require dir.is_dir() and body_root.is_dir();
        // MemoryInner::load_dir + FsBodyStore::open_read_only only;
        // NO create_dir_all, persist_symbol, put, plant, or migrate_inline_bodies.
    }
}

impl FsBodyStore {
    pub fn open_read_only(root: &Path) -> AppResult<Self> {
        if root.as_os_str().is_empty() || !root.is_dir() {
            return Err(AppError::Config("session archive body root unavailable".into()));
        }
        Ok(Self { root: root.to_path_buf() })
    }
}
```

Under `--features postgres`, add `PgSessionChainArchive::metadata` using only:

```sql
SELECT symbol, et_date, source_as_of, source
FROM session_chain_archive WHERE symbol = $1 AND et_date = $2
```

The audit factory consumes `Config`: when Postgres is configured it connects through the existing
`Pg::connect` and constructs the facade with `FsBodyStore::open_read_only`; otherwise it uses
`session_chain_archive_store_path` plus `session_chain_archive_body_root`. It never accepts an arbitrary
fixture/reconstruction path flag and never calls `AppState::new`, `open_json`, migration, or seed code.

Implement the strict wrapper and runner:

```rust
#[derive(Clone)]
pub struct ProductionLiveArchiveReader { archive: SessionChainArchive }

impl LiveArchiveRead for ProductionLiveArchiveReader {
    // metadata() delegates to facade metadata().
    // strict_load() calls facade load(), deserialize_capture(), then requires:
    // wire.symbol == meta.symbol,
    // et_date_from_as_of(wire.as_of) == meta.et_date,
    // wire.as_of == meta.source_as_of.
}

pub struct AuditRequest { pub from: NaiveDate, pub to: NaiveDate }
pub struct AuditResult { pub text: String, pub exit: std::process::ExitCode }

pub async fn run_audit(
    reader: &impl LiveArchiveRead,
    calendar: &MarketCalendar,
    policy: &CoveragePolicy,
    request: AuditRequest,
    now_utc: DateTime<Utc>,
) -> AuditResult;
```

Render SPEC §4 verbatim and in this order: header → scope → counts (only when evaluation succeeded) →
one row for every selected identity → exactly three last-readable lines → exactly one terminal outcome.
Use `\n`, not ANSI/color/icons. A valid zero-due range emits exactly
`No books were expected in this window.` as its terminal line and no PASS. Map inaccessible storage and
invalid range/calendar to `ERROR — archive coverage could not be checked: {bounded_reason}. No
completeness claim was produced.` and nonzero.

### Green and commit

```powershell
cargo test -p api-rust --test archive_coverage_audit -- --nocapture
```

Expected: **9 passed; 0 failed**. Existing store/body tests also report 0 failed. Commit:
`feat(archive): add strict read-only coverage audit`.

**Reviewer probe:** run against nonexistent roots and legacy inline JSON; no path/file may appear. Change
one decoded identity field; it must become unreadable. Poison `open_json_read_only` with `create_dir_all`
or `migrate_inline_bodies`; the side-effect test must fail.

## Backend closer — B4-backend-closer

### Deliverables

Integrate B1/B2 into process state, best-effort write telemetry, worker ordering, metrics, CLI, startup,
runtime tests, live serve, and `conformance-receipt.json`. Also update `docs/DEPLOY_RUNBOOK.md` with the
approved capacity procedure. Do not rewrite worker-owned files to change their semantics, and add no
automated deletion/resize action.

### Operations runbook

Add a section with this exact policy table and procedure:

```markdown
## Postgres and API durable-volume capacity

Treat these as two independent capacity signals. Volume usage is not archive-completeness evidence.

| Volume | Warning | Critical | Contains |
|---|---:|---:|---|
| Railway Postgres | 70% used | 85% used | application relational state and retained legacy data |
| Railway API durable data | 70% used | 85% used | session-book bodies, chain snapshots, and local durable files |

At 70% used:
1. Record used and provisioned capacity for that volume.
2. Measure contributing directories/tables, recent growth, and estimated runway.
3. Plan capacity expansion or separately authorize a scoped cleanup.

At 85% used:
1. Increase that volume's capacity immediately.
2. Verify the new provisioned capacity and free space after the change.
3. Re-run the measurement and record the result.

Neither threshold authorizes deleting session books, research evidence, or legacy rows. Cleanup,
retention changes, and reconstruction are separate changes. To inspect archive completeness without a
monitoring subscription, run:

`cargo run -p api-rust -- archive-coverage-audit --from YYYY-MM-DD --to YYYY-MM-DD`

The procedure requires only this repository, local process access, and existing Railway access.
```

Review the section against AC-21/22, then commit:
`docs(ops): add independent volume thresholds and archive audit`.

**Reviewer probe:** Postgres and API must not be combined; warning/critical must be 70/85; no sentence
may authorize deletion or claim disk usage equals coverage.

### Red integration tests

Create `apps/api/tests/archive_coverage_runtime.rs` with ten cases:

1. worker records ensure attempts before the same pass evaluates coverage;
2. holiday pass performs no ensure attempt and produces no expected identity/warning;
3. metrics reads a primed snapshot without invoking metadata/load/vendor and returns the full shape;
4. first post-range inspection fault is unavailable with known range, null six counts, empty books, null
   last-readable pairs, `data_stale=false`;
5. first range-computation fault is unavailable with null endpoints; later fault after success is stale
   and retains last-good matrix/timestamp;
6. failed SPY/QQQ/IWM archive inserts increment total/per-symbol once and remain best-effort; non-closed
   symbols do not increment;
7. a new AppState resets observation time/counters/warning ledger;
8. both accepted metrics headers return 200 + coverage; absent/wrong token returns existing 401 without
   `session_archive_coverage`;
9. valid policy and historical gaps permit startup/router construction; invalid policy/calendar refuses
   before listener/worker;
10. fixed market fixture produces the existing score/tier/fingerprint and trader route/SSE response
    bytes across current/missing/unreadable/stale/unavailable coverage states.

Run and observe red:

```powershell
cargo test -p api-rust --test archive_coverage_runtime -- --nocapture
```

### State and telemetry integration

Add one cloneable `ArchiveCoverageRuntime` to `AppState`. It owns policy/calendar, immutable latest
snapshot, last-good evidence, five-minute success cache, observation start, total/three atomic write
counters, and a bounded `HashSet<(String, NaiveDate)>` warning ledger. Initialize it before returning
AppState; test constructors may inject a validated policy/calendar/clock seam.

```rust
pub struct ArchiveWriteTelemetry {
    started_at_utc: DateTime<Utc>,
    total: AtomicU64,
    per_symbol: [AtomicU64; 3],
}

pub struct ArchiveCoverageRuntime {
    policy: CoveragePolicy,
    calendar: MarketCalendar,
    snapshot: RwLock<Arc<CoverageSnapshot>>,
    last_good: RwLock<Option<CoverageEvidence>>,
    cache: Mutex<SuccessVerificationCache>,
    warnings: Mutex<HashSet<(String, NaiveDate)>>,
    writes: ArchiveWriteTelemetry,
}
```

Preserve existing public capture/ensure test helpers by adding observed variants. Production calls pass
`Some(&state.archive_coverage.writes)`; hermetic helpers default to `None`:

```rust
pub async fn archive_session_best_effort(
    archive: &SessionChainArchive,
    telemetry: Option<&ArchiveWriteTelemetry>,
    wire: &ChainSnapshotWire,
    body: &[u8],
) {
    // On insert Err only: if SPY/QQQ/IWM, increment matching + total; bounded structured warn; return.
}
```

Thread the observer through `capture_best_effort` and the ensure worker's observed path. Keep archive
failure from changing the caller's `Ok(())`/ensure outcome. Never parse warning text to count failures.

### Worker ordering and warnings

Change `ensure_worker` so the minute task starts whenever the session archive is enabled. When the ensure
dial is off it skips ensure attempts but still evaluates coverage; this makes the guardrail independently
usable and lets conformance run without a paid fetch. One pass is:

```rust
pub async fn run_ensure_and_coverage_pass(state: &AppState) {
    if state.config.liquid_session_ensure_enabled {
        run_current_session_ensures(state).await; // completes first
    }
    let attempt = state.archive_coverage.evaluate(&state.session_archive, Utc::now()).await;
    state.archive_coverage.publish(attempt).await;
    for row in state.archive_coverage.new_warning_rows().await {
        tracing::warn!(
            symbol = %row.symbol,
            et_date = %row.et_date,
            condition = %row.status,
            checkpoint_et = "10:30:00 America/New_York",
            observation_started_at_utc = %state.archive_coverage.observation_started_at_utc(),
            evaluated_at_et = %row.evaluated_at_et,
            command = %format!("cargo run -p api-rust -- archive-coverage-audit --from {0} --to {0}", row.et_date),
            "Session archive incomplete after 10:30:00 ET"
        );
    }
}
```

Update every B4-owned production call site of the temporary three-argument `ensure_eligible` seam to
`ensure_eligible_with_calendar(..., state.archive_coverage.calendar())`. Production must never construct
or silently default a calendar inside the eligibility call. Update legacy caller tests to inject the
validated calendar; the source-compatible wrapper may remain only as a non-production compatibility seam.

The ledger inserts after deciding to warn, never removes on recovery, and retains only identities still
inside the bounded runtime window. A missing↔unreadable change updates the snapshot but not the key.

### Metrics and authorization

Add typed serde/utoipa DTOs for the exact contract fields and add
`session_archive_coverage: SessionArchiveCoverageWire` to `MetricsWire`, the representative contract
response, and the real JSON response. `cache_metrics` obtains one cloned snapshot plus atomic counter
values; it must not call `session_archive`, evaluator, calendar range computation, or any worker wake.

Maintain existing token behavior exactly. Dedicated route tests construct a valid 32-byte base64url token
and cover `Authorization: Bearer`, `X-Metrics-Token`, missing, and wrong. Unauthorized JSON stays the
existing `{error, detail}` and has no coverage field.

Status normalization is exact:

```rust
match evidence {
    Current(good) => current_wire(good, counters),
    Failed { last_good: Some(good), reason, evaluated_at } => stale_wire(good, reason, evaluated_at, counters),
    Failed { last_good: None, known_range, reason, evaluated_at } => unavailable_wire(known_range, reason, evaluated_at, counters),
}
```

Unavailable has six null counts, empty books, null last-readable pairs, null `last_verified_at_utc`,
`data_stale=false`, and known range preserved when available. Stale retains last-good matrix/counts and
`last_verified_at_utc`, sets `data_stale=true`, and carries a current bounded reason.

### CLI and startup integration

Add the clap command and dispatch only; all audit semantics stay in B2:

```rust
ArchiveCoverageAudit {
    #[arg(long)] from: String,
    #[arg(long)] to: String,
},

Commands::ArchiveCoverageAudit { from, to } => {
    let cfg = Config::from_env()?;
    let result = audit::run_configured(&cfg, &from, &to, Utc::now()).await;
    print!("{}", result.text);
    if result.exit != ExitCode::SUCCESS { anyhow::bail!("archive coverage audit failed"); }
}
```

Do not use `std::process::exit` inside the service module; keep result/exit testable. Ensure main prints no
second competing terminal result. If the current `anyhow` error footer would add a second `error:` line,
return a typed CLI outcome from `run` and map its exit code in `main` without re-rendering it.

During AppState/server construction, parse/validate production policy and embedded calendar before the
listener and worker. If `APP_ENV=prod`, require the current ET date inside the calendar domain and the
already-required archive store enabled. A planted historical/current gap is not a startup error.

Preserve B1's `coverage`/`market_calendar` declarations in `session_chain_archive/mod.rs` and add only
the later `audit` plus runtime-facing exports needed by B2/B4; do not expose them to browser contracts.
Update the representative OpenAPI response so generated contract checks see the additive field. In
`apps/api/src/routes/mod.rs`, register only the already-approved archive-coverage DTO schemas from
`routes/health.rs` in the existing OpenAPI component-schema list; do not add an endpoint, rename a field,
or widen any response beyond the verbatim conformance block. Then run
`npm run api:contract:generate`. Commit the resulting deterministic OpenAPI, parity, manifest,
boundary-evidence, and generated TypeScript schema bytes named in B4 ownership. This is shared generated
contract output, not a dashboard/runtime/UI task; do not hand-edit it or change the client facade.

The approved additive DTOs change bytes governed by the existing capacity byte-identity control. After
generation, use that control's existing deterministic SHA-256/file and generated-inventory mechanisms to
refresh only the five `API_ARTIFACTS` hash constants in `apps/api/src/capacity/identity.rs`, the corresponding
`api_contract_artifacts[*].base_sha256` values, and `generated_client_baseline.sha256` in
`apps/api/tests/fixtures/capacity-baseline/v1/identity/manifest.json`. Keep the generated-client `entries`
inventory closed and unchanged. Every source constant and matching manifest hash must equal the deterministic
current bytes of its named, already-approved artifact; retain an unchanged hash when its artifact bytes did
not move. In `identity.rs`, no edit is permitted outside the five `API_ARTIFACTS` hash string values: preserve
`REFERENCE_REVISION`, capture/projection/differing-path behavior, runtime exclusions, the market oracle, and
all capacity logic. Preserve the manifest's `reference_revision` exactly as
`c30ed8151b82f847fd75552528dcba30bdca5ae8`; preserve the helper/reference-seam hashes, request, fixed time,
seed, runtime exclusions, projection, and every `files[*].sha256` value for the SPY/SSE inputs and
`before/ticker.json`, `before/sse.json`, and `before/decision.json`. Do not normalize or rewrite those
fixtures. No capacity behavior or trader baseline is in scope. The byte-identity self-test must prove the
before ticker/SSE/decision bytes still produce empty differing-path sets.

### Green, serve, and closer commit

```powershell
cargo test -p api-rust --test archive_coverage_runtime -- --nocapture
cargo test -p api-rust --test archive_coverage_audit -- --nocapture
cargo test -p api-rust --test archive_coverage_isolation -- --nocapture
cargo test -p api-rust -p quant-engine
cargo build -p api-rust --features postgres
cargo fmt --all -- --check
npm run api:contract:generate
npm run api:contract:check
cargo test -p api-rust --test capacity_identity -- --nocapture
npm run capacity:baseline:self-test:byte-identity
```

Expected: runtime **10**, audit **9**, isolation **8** passed; full suite exit 0 with every test binary
reporting 0 failed; Postgres build, fmt, generation, contract check, capacity identity tests, and byte-identity
self-test exit 0. The capacity evidence retains the pinned reference revision, reports matching generated
artifact/inventory hashes, and reports ticker, SSE, and decision matches with no differing paths.

Start a local harness with `METRICS_SECRET_TOKEN` unset, archive enabled on existing temporary roots,
and `LIQUID_SESSION_ENSURE_ENABLED=false`. Wait until `/api/_metrics` has non-null `evaluated_at_et`, then:

```powershell
node .codex/tools/gates.mjs interface_conformance --contract .spire/clusters/tech/contracts/archive-coverage-guardrails/INTERFACE_CONTRACT.md --url http://127.0.0.1:8000 --out .spire/clusters/tech/contracts/archive-coverage-guardrails/conformance-receipt.json
```

Expected: exit 0; receipt `verdict: PASS`; **1/1 endpoint passed**. Stop the harness cleanly. Commit:
`feat(archive): integrate runtime guardrails metrics and CLI`.

**Reviewer probe:** place a counting/failing reader behind a primed snapshot and call metrics repeatedly;
the reader count cannot move. Poison order so evaluation runs before ensure and the named test must fail.
Restart state and counters/ledger must reset. Historical gaps must not refuse router/startup construction.

## Verification track

Verification is read-only. Any failure bounces to the owning task; QA does not patch product code.

### V1 — Targeted feature behavior

```powershell
cargo test -p api-rust market_calendar::tests coverage::tests -- --nocapture
cargo test -p api-rust --test archive_coverage_audit -- --nocapture
cargo test -p api-rust --test archive_coverage_runtime -- --nocapture
cargo test -p api-rust --test archive_coverage_isolation -- --nocapture
```

Expected: 16 + 9 + 10 + 8 passed, 0 failed. Evidence covers AC-1–19 and AC-23.

### V2 — Existing regression floor

```powershell
cargo test -p api-rust -p quant-engine
cargo test -p api-rust --test capacity_identity -- --nocapture
npm run capacity:baseline:self-test:byte-identity
```

Expected: exit 0; every binary/doc-test reports 0 failed. In particular existing
`session_chain_archive*`, `liquid_names_session_capture*`, production guardrail, metrics auth, and
`score_identity` tests remain green. Capacity manifest validation retains the historical reference revision
and all input/before-oracle hashes; byte-identity evidence reports ticker, SSE, and decision matches with
empty differing-path sets.

### V3 — Postgres compile/test boundary

```powershell
cargo build -p api-rust --features postgres
cargo test -p api-rust --features postgres --test archive_coverage_audit --no-run
```

Expected: both exit 0. If a real Postgres DSN is available, run the read-only audit case and compare rows
before/after; otherwise mark only that hosted observation UNVERIFIABLE, not the compiled adapter or JSON
side-effect suite.

### V4 — CLI text and exit matrix

Run the binary against temporary live-store fixtures for complete, missing, unreadable, mismatch,
holiday-only, pre-checkpoint, absent-root, invalid, and reversed ranges. Expected terminal/exit matrix:

| Case | Terminal | Exit |
|---|---|---:|
| complete | `PASS — every expected book is readable.` | 0 |
| missing/unreadable/mismatch | `FAIL — N missing and N unreadable expected books.` | nonzero |
| invalid/out-of-domain/inaccessible | `ERROR — ... No completeness claim was produced.` | nonzero |
| zero expected | `No books were expected in this window.` | 0 |

No output contains `offline`, `lost`, `recovered`, `restored`, absolute paths, locator strings, env names,
or more than one terminal outcome.

### V5 — Live interface and auth

Recreate the closer harness and independently run:

```powershell
node .codex/tools/gates.mjs interface_conformance --contract .spire/clusters/tech/contracts/archive-coverage-guardrails/INTERFACE_CONTRACT.md --url http://127.0.0.1:8000 --out .spire/clusters/tech/contracts/archive-coverage-guardrails/conformance-receipt-qa.json
```

Expected: exit 0, QA receipt PASS, 1/1. Separately run the token route test; expected two authorized 200s
and missing/wrong 401s with no coverage leak.

### V6 — Operations and no-UI review

```powershell
git diff --name-only -- apps/dashboard functions libs/api/src/lib libs/api/src/index.ts
git diff --name-only -- libs/api/src/generated
git diff --name-only -- libs/quant-engine apps/api/src/routes/ticker.rs apps/api/src/routes/stream.rs apps/api/src/services/recommendation.rs
```

Expected: first and third outputs empty; second output is exactly
`libs/api/src/generated/schema.ts`. Review `docs/DEPLOY_RUNBOOK.md`: Postgres and API volume are separate;
70% warning, 85% critical; growth/runway and post-expansion verification present; no deletion authority;
no paid monitoring requirement. Review the capacity identity source and manifest diffs separately: only the
five source `API_ARTIFACTS` hash strings and generated API/client manifest hash fields may change, and every
source/manifest artifact hash must equal the deterministic bytes of its named current artifact. The reference
revision, capture/projection/differing-path logic, runtime exclusions, capacity behavior, and every
ticker/SSE/decision input/output oracle hash must be byte-identical. This is AC-20–22 evidence.

### V7 — Formatting, contract generation, and final diff fence

```powershell
cargo fmt --all -- --check
npm run api:contract:check
git diff --check
git status --short
```

Expected: all exits 0 except `git status` (informational); no edits outside B1, B2, and B4 paths plus generated
API artifacts explicitly named in B4. If generation requires another path, stop at GATE Z rather than
silently widening ownership.

## Task-to-acceptance map

| Acceptance | Primary evidence |
|---|---|
| AC-1–3 | B1 evaluator + B2 strict reader + B4 metrics/runtime tests |
| AC-4 | B4 process telemetry/reset tests |
| AC-5–6 | B1 ET checkpoint/calendar exhaustive tests + producer/detector equality |
| AC-7–8 | B1 identity ledger + B4 structured-warning/recovery tests |
| AC-9–10 | B4 unavailable/stale wire and metrics auth tests + V5 |
| AC-11–15, AC-23 | B2 audit matrix + V4 |
| AC-16–17 | B2 production-reader/side-effect tests + B1 mutation guards |
| AC-18–20 | B4 byte-identity runtime test + V2/V6 empty diffs |
| AC-21–22 | B4 runbook + V6 review |

## Carry-forward to execution lanes

- The official NYSE calendar currently publishes 2026–2028 and explicitly says Saturday
  `2028-01-01` has no observed New Year's closure. The approved artifact extends the same checked policy
  through 2035; future exceptional exchange closures require a new reviewed `calendar_version`, not a
  runtime inference.
- Existing source seams were verified before planning: `ensure.rs` owns the trio and weekday helper;
  `ensure_worker.rs` owns the 60-second pass; `store.rs::open_json` creates/migrates and therefore cannot
  serve the audit; `body_store.rs::open` creates; `research_session_books.rs` already uses
  `deserialize_capture`; `state.rs` owns archive state and atomic precedent; `health.rs` owns metrics/token
  behavior; `main.rs` owns clap; `server.rs` validates before workers/listener; `archive.rs` swallows insert
  failure; `docs/DEPLOY_RUNBOOK.md` is the Railway operations seam.
- No frontend executioner is launched. The backend closer, not a worker, owns serve and the receipt.
