# session-chain-archive — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking. Execute from the workspace root. Keep this plan at
> `.spire/clusters/tech/contracts/session-chain-archive/PLAN.md`.

**Goal:** Keep **one paid options book per symbol per ET trading session** in a sibling prune-proof
archive the 48-slot / 14-day `chain_snapshots` ring cannot delete, fed by a best-effort first-wins
byte-copy after every successful ring append — with dedicated research list/load under
`/api/_research/session-books/...`, zero Massive I/O on research read, and **no trader UI**.

**Architecture:** Sibling one-way leaf `SessionChainArchive` parallel to live
`ChainSnapshotStore` (`apps/api/src/services/chain_snapshot/{capture,store,wire}.rs`). Inside
`capture_into`: `ring.append` → `ring.prune_symbol` → `archive_session_best_effort` (insert-if-absent
on `(symbol, et_date)`). Session identity `et_date` is America/New_York calendar date of ring
`as_of: DateTime<Utc>` (same New_York rule as `services/research/outcomes.rs` `session_date_et`,
applied **directly on the `DateTime`** — never via `quant_engine::session_date_from_ns`, never via a
non-positive `f64` bridge when `DateTime` is in hand). Research GETs extend the live
`routes/research_chain_snapshots.rs` pattern under `/api/_research/session-books/...`
(Railway-direct + `METRICS_SECRET_TOKEN` gate family). Pages trader origin already 404s
`/api/_research/*` in `functions/api/[[path]].ts` — keep that posture; do not proxy.

**Tech stack:** Rust Axum (`apps/api`, crate `api-rust`); optional Postgres (`--features postgres`);
Cloudflare Pages Function `functions/api/[[path]].ts`. Tests: `npx nx test api` /
`cargo test -p api-rust`. `NO_UI_CHANGE` for `apps/dashboard` (structural empty-diff only).

**Spec:** `.spire/clusters/tech/contracts/session-chain-archive/SPEC.md` (APPROVED 2026-08-19)
**Interface:** `.spire/clusters/tech/contracts/session-chain-archive/INTERFACE_CONTRACT.md`

---

## Track map

| Track | Tasks | Ownership |
|---|---:|---|
| **Backend** (`apps/api`) | **B1 → B8** (strict order inside the track) | Main product surface |
| **Frontend / infra** | **F1 → F2** | Pages 404 non-regression + trader-chrome absence only |
| **Verification** | **V1 → V6** after B8 + F2 | Read-only gates |

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
- **Cite live Rust only** — `services/chain_snapshot/{capture,store,wire}.rs`,
  `db/pg_chain_snapshot.rs`, `config.rs` retention defaults, `analytics.rs` `spawn_capture`,
  `routes/research_chain_snapshots.rs` (`miss_detail` → `no stored snapshot for {symbol}`),
  `services/research/outcomes.rs` `session_date_et`, `functions/api/[[path]].ts` — **not** Python.
- **Do not edit** `SPEC.md`, `INTERFACE_CONTRACT.md`, or other feature folders.

**Feature hard rules (settled — do not re-open):**

- **Sibling store, not a ring flag.** `SessionChainArchive` is parallel to `ChainSnapshotStore`.
  Ring `prune_symbol` / `persist_symbol` / `DELETE FROM chain_snapshots` never open the archive
  dir/table. Archive exposes **no prune API in v1** (or a stub never called from capture).
- **Promote after every successful ring append; first-wins on `(symbol, et_date)`.** Order inside
  the capture task: `append` → `ring.prune_symbol` → `archive_session_best_effort`. Archive I/O
  must not delay ring prune; archive failure never fails append/prune; whole task stays off the
  trader HTTP await path (`spawn_capture` / `tokio::spawn`).
- **Body = byte-copy** of `serialize_capture` output already used for the ring row — no re-fetch,
  no second Massive call (AC-13).
- **`source_as_of` mandatory on every successful load** (RFC 3339 UTC with fractional seconds from
  the ring capture). It is provenance, **not** the identity key (owner ruling A).
- **Eligibility:** any successful paid ring append whose `as_of` yields an `et_date`. Skip when
  whole-second UTC `timestamp() <= 0` (not an archival candidate under `session_date_et`
  precondition). **Not** RTH-gated — pre/post-RTH remain eligible. Late-ET 20:00–23:59 America/New_York
  on calendar D archives under `et_date = D` (AC-27).
- **Four distinguishable outcomes** (never collapsed):
  - session miss: `no session book for <SYMBOL>` / `… on <ET_DATE>`
  - empty/pruned **ring** (ring vehicle only): live `no stored snapshot for <SYMBOL>` from
    `research_chain_snapshots.rs` `miss_detail` — **do not invent** `empty 48-ring for <SYMBOL>`
  - not storing: `session archive not storing` · `store=error`
  - load unreadable: `session book unreadable: <reason>` · `store=error`
  - list I/O fault (distinct): `session_archive_store_error` / `session archive store error: <reason>`
- **Zero vendor I/O on research read.** `vendor_called` always `false` (including miss). A `true`
  is a defect — unit / GATE Q assert exact false; conformance JSON checks type/presence only.
- **Auth posture:** when `METRICS_SECRET_TOKEN` is set, same bearer / `X-Metrics-Token` gate as
  `GET /api/_metrics` / chain-snapshots. When unset (local), open. Not session-cookie trader auth.
- **Json path:** default `data/session_chain_archive` via `SESSION_CHAIN_ARCHIVE_STORE_PATH`.
  Opening a path that **equals or nests under** `chain_snapshot_store_path` is a **config error**
  (fail open to Disabled / refuse Json backend) — structural, not a comment.
- **Enable dial:** `SESSION_CHAIN_ARCHIVE_ENABLED` defaults **true** (mirror `CHAIN_SNAPSHOT_ENABLED`;
  `0`/`false`/`no`/`off` disable).
- **Do not raise** `chain_snapshot_max_per_symbol` (48) or `chain_snapshot_max_age_secs` (14d)
  (AC-19). Do not rewrite Path-B / `batch-backtest` / `replay-outcome-join` (AC-21).
- **Score byte-identity:** archive is a one-way leaf; signals / score / tier / fingerprint / gate
  never import it (AC-17). Hit envelopes carry `authorizes: "nothing"` (AC-23).
- **Secrets:** reuse `debug_assert_no_secrets` / serialize-then-persist boundary; never persist
  URLs / `apiKey` / env (AC-18).
- **`NO_UI_CHANGE`:** no trader chrome. Frontend track is Pages 404 non-regression + structural
  absence only (AC-15/16).
- **GATE Q / conformance seed (dedicated archive plant — not the ring seed):** plant fixture-source
  row at **`(SPY, 2020-01-02)`** with `source_as_of = 2020-01-02T17:00:00.000000001Z`. Do **not**
  derive from ring `CONFORMANCE_SEED_AS_OF` (`1970-01-01T00:00:00.000000001Z`).

**License one-liner (wire `license`):**
`Our research · not redistributed on a trader route.`

### Conformance spec

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}",
      "path_params": { "symbol": "SPY" },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "books": "array",
        "books[].symbol": "string",
        "books[].et_date": "string",
        "books[].source_as_of": "string",
        "books[].source": "string",
        "store": "string",
        "detail": "string|null",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}",
      "path_params": { "symbol": "ZZZZNOPE" },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "books": "array",
        "store": "string",
        "detail": "string",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}/book",
      "path_params": { "symbol": "ZZZZNOPE" },
      "query": { "et_date": "2000-01-01" },
      "expect_status": 404,
      "required": {
        "error": "string",
        "detail": "string",
        "symbol": "string",
        "et_date": "string",
        "store": "string",
        "vendor_called": "boolean"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}/book",
      "path_params": { "symbol": "SPY" },
      "query": { "et_date": "2020-01-02" },
      "expect_status": 200,
      "required": {
        "symbol": "string",
        "et_date": "string",
        "source_as_of": "string",
        "source": "string",
        "store": "string",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string",
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
| `npx nx test api` / `cargo test -p api-rust -p quant-engine` | exit 0 |
| Feature tests named in B*/V* | exit 0; named ACs covered |
| `npx nx typecheck @convexa/dashboard` | exit 0 (FE track / V*) |
| Pages `/api/_research` 404 | status 404 (same as `_metrics`) — already in `functions/api/[[path]].ts` |
| `interface_conformance` against Global Constraints block | PASS (or UNVERIFIABLE only on hit-probe seed failure) |
| `git diff --name-only -- apps/dashboard` | empty **or** only structural-test files if F2 adds a scan spec — **no** product UI |
| Ring retention dials | still `48` / `1_209_600` — unchanged |

---

## File ownership

| Path | Change |
|---|---|
| `apps/api/src/services/session_chain_archive/mod.rs` | **Create** — module root, re-exports |
| `apps/api/src/services/session_chain_archive/et_date.rs` | **Create** — `et_date_from_as_of(DateTime<Utc>)` |
| `apps/api/src/services/session_chain_archive/store.rs` | **Create** — `SessionChainArchive` (Disabled/Memory/Json/Failing/Postgres) |
| `apps/api/src/services/session_chain_archive/archive.rs` | **Create** — `archive_session_best_effort` leaf + logs |
| `apps/api/src/services/mod.rs` | `pub mod session_chain_archive;` |
| `apps/api/src/services/chain_snapshot/capture.rs` | Hook archive after ring prune inside `capture_into` / `capture_best_effort` |
| `apps/api/src/config.rs` | `SESSION_CHAIN_ARCHIVE_*` dials + path-collision helper |
| `apps/api/src/state.rs` | Hold `session_archive: SessionChainArchive`; open beside ring store; extend `for_tests` |
| `apps/api/src/db/migrations.rs` | Migration **v11** `session_chain_archive` |
| `apps/api/src/db/pg_session_chain_archive.rs` | **Create** — Postgres insert-if-absent / list / load |
| `apps/api/src/db/mod.rs` | Export new pg module |
| `apps/api/src/routes/research_session_books.rs` | **Create** — list + load handlers |
| `apps/api/src/routes/mod.rs` | Mount `/api/_research/session-books/...` |
| `apps/api/src/routes/research_chain_snapshots.rs` | **Do not change** `miss_detail` / ring miss copy |
| `apps/api/tests/session_chain_archive.rs` | **Create** — integration harness (capture → poison prune → load → first-wins → fail write) |
| `apps/api/tests/session_chain_archive_isolation.rs` | **Create** — one-way leaf + prune isolation + path collision + Pages/route mounts |
| `functions/api/[[path]].ts` | **Verify only** — already 404s `/api/_research/*` (no product change expected) |
| `apps/dashboard/src/app/session-chain-archive.structural.spec.ts` | **Create** — AC-15/16 structural empty-diff + mutation probes |
| `apps/dashboard/**` (product) | **No product UI** |

**Do not touch:** ring retention defaults, ring `miss_detail`, score/tier/fingerprint math, trader
routes (`/api/ticker`, SSE, scan desk), warmer, Massive hist endpoints, Path-B /
`batch-backtest` / `replay-outcome-join` CLI rewires, dashboard pages/components/nav,
`DESIGN_SYSTEM.md`.

---

## Backend track

### B1 — ET session identity helper (DateTime → New_York calendar date)

**Files:** `apps/api/src/services/session_chain_archive/{mod.rs,et_date.rs}`;
`apps/api/src/services/mod.rs`

**Why:** SPEC §2.1 / AC-27 — identity is `(symbol, et_date)`; late-ET evenings must not UTC-bucket
to D+1. Live `session_date_et` in `outcomes.rs` is the cited New_York rule but takes `f64`; when
`DateTime<Utc>` is already in hand, apply the same calendar rule **directly**.

- [ ] **Step 1: failing tests** in `et_date.rs` `#[cfg(test)]`:

```rust
use chrono::{TimeZone, Utc};
use chrono_tz::America::New_York;

#[test]
fn late_et_evening_stays_on_et_calendar_date() {
    // 2024-06-03 22:30 America/New_York → UTC already 2024-06-04
    let et = New_York
        .with_ymd_and_hms(2024, 6, 3, 22, 30, 0)
        .single()
        .unwrap();
    let as_of = et.with_timezone(&Utc);
    assert_eq!(et_date_from_as_of(as_of).as_deref(), Some("2024-06-03"));
}

#[test]
fn non_positive_whole_second_timestamp_is_not_archival_candidate() {
    let as_of = DateTime::<Utc>::from_timestamp(0, 1).unwrap(); // timestamp() == 0
    assert!(et_date_from_as_of(as_of).is_none());
    let neg = DateTime::<Utc>::from_timestamp(-1, 0).unwrap();
    assert!(et_date_from_as_of(neg).is_none());
}

#[test]
fn matches_session_date_et_for_positive_instants() {
    let as_of = Utc.with_ymd_and_hms(2024, 1, 2, 17, 0, 0).single().unwrap();
    let from_dt = et_date_from_as_of(as_of).unwrap();
    let from_f64 = crate::services::research::outcomes::session_date_et(as_of.timestamp() as f64);
    assert_eq!(Some(from_dt), from_f64);
}
```

Run: `cargo test -p api-rust session_chain_archive::et_date -- --nocapture` → **FAIL** (module missing).

- [ ] **Step 2: implement:**

```rust
// apps/api/src/services/session_chain_archive/et_date.rs
use chrono::{DateTime, Datelike, Utc};
use chrono_tz::America::New_York;

/// America/New_York calendar `YYYY-MM-DD` for a ring `as_of`.
/// Returns `None` when whole-second UTC timestamp is `<= 0` (not archival).
pub fn et_date_from_as_of(as_of: DateTime<Utc>) -> Option<String> {
    if as_of.timestamp() <= 0 {
        return None;
    }
    let et = as_of.with_timezone(&New_York);
    Some(format!("{:04}-{:02}-{:02}", et.year(), et.month(), et.day()))
}
```

```rust
// mod.rs
//! Sibling prune-proof session archive beside the 48-ring.
//! One-way leaf: signals / score / fingerprint / gate never import this module.

mod archive;
mod et_date;
mod store;

pub use archive::archive_session_best_effort;
pub use et_date::et_date_from_as_of;
pub use store::{SessionBookMeta, SessionChainArchive};
```

Add `pub mod session_chain_archive;` to `services/mod.rs`.

- [ ] **Step 3:** re-run tests → PASS. Commit: `feat(session-archive): et_date from DateTime New_York`.

**Reviewer probe:** poison with an `as_of` whose UTC date is D+1 while ET wall is still D 20:00–23:59;
assert `et_date == D`. Confirm no call to `quant_engine::session_date_from_ns`.

---

### B2 — In-memory / JSON / Disabled / Failing `SessionChainArchive`

**Files:** `apps/api/src/services/session_chain_archive/store.rs`

**Why:** SPEC §2.3 — sibling backends; first-wins insert-if-absent; Json path collision structural;
Failing double for AC-10; **no prune API**.

- [ ] **Step 1: failing tests:**

```rust
#[tokio::test]
async fn insert_then_list_and_load_by_et_date() { /* plant one row; list count 1; load Some */ }

#[tokio::test]
async fn first_wins_second_insert_same_et_date_keeps_first_body() {
    // insert body A for (T,D); insert body B same (T,D); load == A; list len == 1
}

#[tokio::test]
async fn disabled_insert_and_list_report_not_storing() {
    let store = SessionChainArchive::disabled();
    let err = store.insert_if_absent(...).await.unwrap_err();
    assert!(err.to_string().contains("session archive not storing"));
}

#[tokio::test]
async fn failing_insert_errors_and_list_stays_empty() {
    let store = SessionChainArchive::failing();
    assert!(store.insert_if_absent(...).await.is_err());
    assert!(store.list("TSLA", None).await.unwrap().is_empty());
}

#[tokio::test]
async fn open_json_rejects_path_equal_or_nested_under_ring_path() {
    let ring = std::env::temp_dir().join("ring_snaps_test");
    let nested = ring.join("session_chain_archive");
    let err = SessionChainArchive::open_json(&nested, &ring).await.unwrap_err();
    assert!(err.to_string().contains("session archive path"));
}

#[tokio::test]
async fn list_orders_et_date_asc_and_limit_keeps_last_n() {
    // plant D1,D2,D3; limit=2 → [D2,D3]
}
```

Run → FAIL.

- [ ] **Step 2: implement** store API (mirror live `ChainSnapshotStore` shape, different key):

```rust
#[derive(Debug, Clone)]
pub struct SessionBookMeta {
    pub symbol: String,
    pub et_date: String,                 // YYYY-MM-DD
    pub source_as_of: DateTime<Utc>,     // provenance
    pub source: MarketDataSourceKind,
}

pub enum SessionChainArchive {
    Disabled,
    Memory(Arc<RwLock<MemoryInner>>),
    Json(JsonInner),
    /// Test double: insert always fails; list/load stay empty/miss.
    Failing,
    #[cfg(feature = "postgres")]
    Postgres(crate::db::pg_session_chain_archive::PgSessionChainArchive),
}

impl SessionChainArchive {
    pub fn disabled() -> Self { Self::Disabled }
    pub fn memory() -> Self { Self::Memory(Arc::new(RwLock::new(MemoryInner::default()))) }
    pub fn failing() -> Self { Self::Failing }
    pub fn is_enabled(&self) -> bool { !matches!(self, Self::Disabled) }

    pub async fn open_json(dir: &Path, ring_store_path: &Path) -> AppResult<Self> {
        if archive_path_conflicts(dir, ring_store_path) {
            return Err(AppError::Config(
                "session archive path equals or nests under chain_snapshot_store_path".into(),
            ));
        }
        std::fs::create_dir_all(dir)?;
        // load existing symbol files into MemoryInner (same JSON+base64 family as ring store)
        Ok(Self::Json(...))
    }

    /// Insert-if-absent on (symbol, et_date). Ok(true)=inserted, Ok(false)=already present.
    pub async fn insert_if_absent(
        &self,
        symbol: &str,
        et_date: &str,
        source_as_of: DateTime<Utc>,
        source: MarketDataSourceKind,
        body: &[u8],
    ) -> AppResult<bool>;

    pub async fn list(&self, symbol: &str, limit: Option<usize>) -> AppResult<Vec<SessionBookMeta>>;
    pub async fn load(&self, symbol: &str, et_date: &str) -> AppResult<Option<StoredSessionBook>>;
}

pub struct StoredSessionBook {
    pub meta: SessionBookMeta,
    pub body: Vec<u8>,
}

fn archive_path_conflicts(archive: &Path, ring: &Path) -> bool {
    let a = archive.components().collect::<Vec<_>>();
    let r = ring.components().collect::<Vec<_>>();
    if a == r {
        return true;
    }
    // archive nests under ring when ring is a prefix of archive
    a.starts_with(&r) && a.len() > r.len()
}
```

Primary key string = `et_date` (`YYYY-MM-DD`). Persist per-symbol JSON beside ring layout
conventions (reuse base64 body encoding pattern from `chain_snapshot/store.rs` `MemoryInner`
persist — read that file; do not share the ring map). **No `prune_*` method** on the public API.

Disabled → `AppError::Config("session archive not storing")` on insert/list/load.
Failing → insert `Err(...)`; list returns `Ok(vec![])`; load returns `Ok(None)`.

- [ ] **Step 3:** tests PASS. Commit: `feat(session-archive): memory/json/disabled/failing store`.

**Reviewer probe:** assert ring `ChainSnapshotStore::prune_symbol` source has **zero** references to
`session_chain_archive` / `SessionChainArchive` (poison later in B8). Two same-day inserts leave
exactly one identity.

---

### B3 — Postgres backend + migration v11

**Files:** `apps/api/src/db/migrations.rs`; `apps/api/src/db/pg_session_chain_archive.rs` (new);
`apps/api/src/db/mod.rs`

**Why:** SPEC §2.3 — sibling table; ring `DELETE FROM chain_snapshots` cannot name it; **no** FK /
ON DELETE CASCADE from the ring table.

- [ ] **Step 1:** add migration **version 11** `session_chain_archive`:

```sql
CREATE TABLE IF NOT EXISTS session_chain_archive (
    symbol         TEXT NOT NULL,
    et_date        TEXT NOT NULL,          -- America/New_York YYYY-MM-DD identity
    source_as_of   TEXT NOT NULL,          -- RFC3339 UTC with fractional seconds (provenance)
    source_as_of_ns BIGINT NOT NULL,
    source         TEXT NOT NULL,          -- live_massive | fixture
    body           BYTEA NOT NULL,
    archived_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (symbol, et_date)
);
CREATE INDEX IF NOT EXISTS session_chain_archive_symbol_et_date_idx
    ON session_chain_archive (symbol, et_date ASC);
```

Add a unit test beside the existing `chain_snapshots_migration_is_v10`:

```rust
#[test]
fn session_chain_archive_migration_is_v11() {
    let (v, name, body) = MIGRATIONS
        .iter()
        .find(|(_, n, _)| *n == "session_chain_archive")
        .expect("v11 session_chain_archive must exist");
    assert_eq!(*v, 11);
    assert!(body.contains("PRIMARY KEY (symbol, et_date)"));
    assert!(!body.contains("REFERENCES chain_snapshots"));
    assert!(!body.contains("ON DELETE CASCADE"));
}
```

- [ ] **Step 2:** implement `PgSessionChainArchive`:

```sql
INSERT INTO session_chain_archive
  (symbol, et_date, source_as_of, source_as_of_ns, source, body)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (symbol, et_date) DO NOTHING
```

List: `ORDER BY et_date ASC` then last-N when `limit` set (same shape as ring list after ASC).
Load: `SELECT … WHERE symbol = $1 AND et_date = $2`.

Mirror error mapping style from live `pg_chain_snapshot.rs` (`AppError::Config(format!(...))`).

- [ ] **Step 3:** compile-smoke + migration unit test PASS. Commit:
  `feat(session-archive): postgres store + migration v11`.

**Reviewer probe:** table name ≠ `chain_snapshots`; no FK; PK is `(symbol, et_date)` not `as_of`.

---

### B4 — Config dials + AppState wiring + dedicated conformance plant

**Files:** `apps/api/src/config.rs`; `apps/api/src/state.rs`

- [ ] **Step 1: failing tests** (config defaults + collision):

```rust
#[test]
fn session_chain_archive_defaults() {
    // with env cleared: enabled == true, store_path ends with "session_chain_archive"
}

#[test]
fn session_archive_path_must_not_nest_under_ring_default() {
    // default archive path is sibling of data/chain_snapshots, not under it
}
```

- [ ] **Step 2: add to `Config`:**

```rust
pub session_chain_archive_enabled: bool,       // SESSION_CHAIN_ARCHIVE_ENABLED default true
pub session_chain_archive_store_path: PathBuf, // SESSION_CHAIN_ARCHIVE_STORE_PATH
                                               // default workspace/data/session_chain_archive
```

Parse enable like `chain_snapshot_enabled` (`0`/`false`/`no`/`off` → false).

Wire in `AppState::new` / `open_session_chain_archive_store` parallel to
`open_chain_snapshot_store` in live `state.rs`:

- disabled dial → `SessionChainArchive::disabled()`
- postgres feature + pool → `open_postgres` + `plant_conformance_seed`
- else Json open with `(archive_path, config.chain_snapshot_store_path)`; on path conflict or open
  failure → warn + `Disabled` (desk still boots)

Extend `AppState`:

```rust
pub session_archive: SessionChainArchive,
```

Update `for_tests`:

```rust
pub async fn for_tests(
    chain_snapshots: ChainSnapshotStore,
    session_archive: SessionChainArchive,
) -> AppResult<Self>
```

Update all existing `AppState::for_tests(store)` call sites to
`AppState::for_tests(store, SessionChainArchive::disabled())` (ring research tests stay hermetic).

Dedicated seed (SPEC §2.4 / INTERFACE hit-probe):

```rust
pub const SESSION_ARCHIVE_SEED_SYMBOL: &str = "SPY";
pub const SESSION_ARCHIVE_SEED_ET_DATE: &str = "2020-01-02";
pub const SESSION_ARCHIVE_SEED_SOURCE_AS_OF: &str = "2020-01-02T17:00:00.000000001Z";

impl SessionChainArchive {
    pub async fn plant_conformance_seed(&self) -> AppResult<()> {
        let as_of = crate::services::chain_snapshot::wire::parse_as_of(
            SESSION_ARCHIVE_SEED_SOURCE_AS_OF,
        )?;
        let bundle = crate::services::chain_snapshot::wire::fixture_probe_bundle(
            SESSION_ARCHIVE_SEED_SYMBOL,
            as_of,
        );
        let wire = crate::services::chain_snapshot::wire::to_wire(&bundle);
        let bytes = crate::services::chain_snapshot::wire::serialize_capture(&wire)?;
        let et = et_date_from_as_of(as_of).expect("seed as_of must yield et_date");
        assert_eq!(et, SESSION_ARCHIVE_SEED_ET_DATE);
        let _ = self
            .insert_if_absent(
                SESSION_ARCHIVE_SEED_SYMBOL,
                &et,
                as_of,
                wire.source,
                &bytes,
            )
            .await?;
        Ok(())
    }
}
```

**Do not** plant via archival of ring `CONFORMANCE_SEED_AS_OF`.

- [ ] **Step 3:** tests PASS; existing ring `for_tests` call sites compile. Commit:
  `feat(session-archive): config + AppState + dedicated seed`.

**Reviewer probe:** defaults enabled=true; default path `data/session_chain_archive`; seed ET date
is `2020-01-02` not `1970-01-01` / `1969-12-31`.

---

### B5 — Archive leaf + hook into `capture_into` (after ring prune)

**Files:** `apps/api/src/services/session_chain_archive/archive.rs`;
`apps/api/src/services/chain_snapshot/capture.rs`

**Why:** SPEC §2.2 / §2.4 / AC-1 / AC-10 / AC-13 / AC-14 — best-effort side-effect after successful
ring append; desk unchanged on archive fail.

- [ ] **Step 1: failing tests** in `archive.rs` / `capture.rs` `#[cfg(test)]`:

```rust
#[tokio::test]
async fn successful_ring_append_archives_session_identity() {
    let ring = ChainSnapshotStore::memory();
    let archive = SessionChainArchive::memory();
    let as_of = /* positive ET daytime instant */;
    let bundle = fixture_probe_bundle("TSLA", as_of);
    capture_into(&ring, &archive, bundle, Duration::from_secs(1_209_600), 48)
        .await
        .unwrap();
    let et = et_date_from_as_of(as_of).unwrap();
    assert!(archive.load("TSLA", &et).await.unwrap().is_some());
}

#[tokio::test]
async fn archive_write_failure_does_not_fail_capture_into() {
    let ring = ChainSnapshotStore::memory();
    let archive = SessionChainArchive::failing();
    capture_into(&ring, &archive, bundle_at(1), Duration::from_secs(60), 48)
        .await
        .unwrap(); // Ok — ring row exists; archive empty
    assert_eq!(ring.list("TSLA", None).await.unwrap().len(), 1);
    assert!(archive.list("TSLA", None).await.unwrap().is_empty());
}

#[tokio::test]
async fn non_positive_as_of_skips_archive_without_error() {
    let ring = ChainSnapshotStore::memory();
    let archive = SessionChainArchive::memory();
    let as_of = DateTime::<Utc>::from_timestamp(0, 1).unwrap();
    // append may still succeed on ring; archive must skip (no et_date)
    // If ring accepts the row, archive.list stays empty for any et_date.
}

#[tokio::test]
async fn second_same_et_day_capture_keeps_first_session_body() { /* AC-6 */ }
```

- [ ] **Step 2: implement archive leaf:**

```rust
// archive.rs
use super::et_date::et_date_from_as_of;
use super::store::SessionChainArchive;
use crate::services::chain_snapshot::wire::{as_of_string, ChainSnapshotWire};
use tracing::{info, warn};

pub async fn archive_session_best_effort(
    archive: &SessionChainArchive,
    wire: &ChainSnapshotWire,
    body: &[u8],
) {
    let Some(et_date) = et_date_from_as_of(wire.as_of) else {
        // non-positive as_of — not an archival candidate
        return;
    };
    match archive
        .insert_if_absent(&wire.symbol, &et_date, wire.as_of, wire.source, body)
        .await
    {
        Ok(true) => info!(
            symbol = %wire.symbol,
            et_date = %et_date,
            source_as_of = %as_of_string(wire.as_of),
            "session archive appended"
        ),
        Ok(false) => { /* first-wins no-op */ }
        Err(e) => warn!(
            error = %e,
            "session archive write skipped — trader path unchanged"
        ),
    }
}
```

Extend live `capture_into` (read `chain_snapshot/capture.rs` — today ends after `prune_symbol`):

```rust
pub async fn capture_into(
    store: &ChainSnapshotStore,
    archive: &SessionChainArchive,
    bundle: VendorBundle,
    max_age: Duration,
    max_per: usize,
) -> AppResult<()> {
    if !store.is_enabled() {
        warn!("capture not storing");
        return Ok(());
    }
    let wire = to_wire(&bundle);
    let bytes = serialize_capture(&wire)?;
    debug_assert_no_secrets(&bytes);
    store.append(&wire, &bytes).await?;
    info!(symbol = %wire.symbol, as_of = %as_of_string(wire.as_of), "chain snapshot appended");
    if let Err(e) = store.prune_symbol(&wire.symbol, max_age, max_per).await {
        warn!(error = %e, "chain snapshot prune failed");
    }
    // AFTER prune — archive must not delay prune; failure never fails this Ok(())
    crate::services::session_chain_archive::archive_session_best_effort(archive, &wire, &bytes)
        .await;
    Ok(())
}
```

Update `capture_best_effort` to pass `&state.session_archive`. Update unit tests in
`capture.rs` and `tests/chain_snapshot_capture.rs` that call `capture_into` to pass
`SessionChainArchive::disabled()` or `memory()` as appropriate (ring-only tests → disabled).

Never call Massive from the archive leaf. Never import archive from `signals` / quant-engine.

- [ ] **Step 3:** PASS. Commit: `feat(session-archive): best-effort archive after ring prune`.

**Reviewer probe:** order is append → prune → archive; archive Err does not change `capture_into`
`Ok`; log line exactly contains `session archive write skipped — trader path unchanged`.

---

### B6 — Research list + load routes (`/api/_research/session-books/...`)

**Files:** `apps/api/src/routes/research_session_books.rs` (new); `apps/api/src/routes/mod.rs`

**Why:** SPEC §2.4 / INTERFACE endpoints 1–2 / AC-4–AC-8 / AC-11 / AC-23–AC-25. Extend live
`research_chain_snapshots.rs` pattern (token gate, normalize symbol, `vendor_called: false`) —
**sibling routes**, do not overload chain-snapshots.

- [ ] **Step 1: failing handler tests** (mirror style of live `research_chain_snapshots.rs`
  `#[cfg(test)]`):

```rust
#[tokio::test]
async fn list_empty_zzzznopes_session_miss_envelope() {
    // store=miss, detail exactly "no session book for ZZZZNOPES",
    // framing RESEARCH READ — NO SESSION BOOK, provenance "no vendor call",
    // authorizes "nothing", vendor_called false
}

#[tokio::test]
async fn load_miss_404_closed_detail() {
    // error no_session_book, detail "no session book for ZZZZNOPE on 2000-01-01",
    // no framing/license/authorizes required
}

#[tokio::test]
async fn load_hit_requires_source_as_of_and_authorizes_nothing() { /* plant + load */ }

#[tokio::test]
async fn load_missing_et_date_is_422() { /* not 400 */ }

#[tokio::test]
async fn disabled_store_is_500_not_storing_not_miss() { /* … */ }

#[tokio::test]
async fn unreadable_body_is_500_session_book_unreadable() { /* corrupt bytes under identity */ }

#[tokio::test]
async fn invalid_limit_is_400() { /* limit=0 → invalid_limit */ }
```

- [ ] **Step 2: implement** (closed copy from INTERFACE):

```rust
const LICENSE: &str = "Our research · not redistributed on a trader route.";
const FRAMING_HIT: &str = "RESEARCH READ — SESSION BOOK";
const FRAMING_MISS: &str = "RESEARCH READ — NO SESSION BOOK";
const PROVENANCE_HIT: &str = "loaded from session archive · no vendor call";
const PROVENANCE_MISS: &str = "no vendor call";
const AUTHORIZES: &str = "nothing";

fn session_miss_detail(symbol: &str, et_date: Option<&str>) -> String {
    match et_date {
        Some(d) => format!("no session book for {symbol} on {d}"),
        None => format!("no session book for {symbol}"),
    }
}
```

Reuse `metrics_token_ok` from `routes/health.rs` exactly as `research_chain_snapshots.rs` does.

**List** `GET /api/_research/session-books/{symbol}`:
- optional `limit` → `< 1` ⇒ 400 `invalid_limit` / `limit must be >= 1` / `vendor_called: false`
- Disabled ⇒ 500 `session_archive_not_storing` / `session archive not storing` / `store: error`
- Other list I/O ⇒ 500 `session_archive_store_error` / `session archive store error: <reason>`
  (**not** `session_book_unreadable`)
- empty ⇒ 200 `store=miss`, `detail` required exact session miss string, miss framing/provenance,
  `authorizes: "nothing"`
- hit ⇒ 200 `store=hit`, `detail: null`, hit framing/provenance, `books[]` with
  `symbol`/`et_date`/`source_as_of`/`source`

**Load** `GET /api/_research/session-books/{symbol}/book?et_date=`:
- missing/unparseable `et_date` ⇒ **422** (family of ring `as_of` required/unparseable) with
  `vendor_called: false` — **not** 400
- miss ⇒ **404** detail-only body (`no_session_book` + closed detail + echo identity)
- unreadable deserialize ⇒ 500 `session_book_unreadable` /
  `session book unreadable: <reason>`
- hit ⇒ 200 with mandatory `source_as_of`, `authorizes: "nothing"`, typed `market` / bars / trades
  from `deserialize_capture` (same wire body as ring — enough for `compute_analytics_from_vendor`)

Mount in `routes/mod.rs` beside chain-snapshots:

```rust
.route(
    "/api/_research/session-books/{symbol}",
    get(research_session_books::list_session_books),
)
.route(
    "/api/_research/session-books/{symbol}/book",
    get(research_session_books::load_session_book),
)
```

**Do not** edit `research_chain_snapshots.rs` `miss_detail`.

- [ ] **Step 3:** PASS. Commit: `feat(session-archive): research list/load session-books routes`.

**Reviewer probe:** ring list miss string still `no stored snapshot for <SYMBOL>`; session miss
never uses that string; load 404 has no Live badge fields; `vendor_called` exact `false`.

---

### B7 — Integration harness (SPEC §7 one-pass)

**Files:** `apps/api/tests/session_chain_archive.rs`

**Why:** Prefer one high-level pass covering ship-blocking ACs (SPEC §3 method notes).

- [ ] **Step 1: write the harness** (failing until B2–B6 land):

```rust
//! Integration harness for session-chain-archive (SPEC §7).
//!
//! capture during D → session identity → poison 48-ring prune → load with
//! vendor_called false + source_as_of → second same-day capture still one
//! identity → force archive write fail → desk/capture still Ok.

#[tokio::test]
async fn harness_capture_archive_poison_prune_first_wins_fail_isolation() {
    // 1. Capture bundle at known ET date D via capture_into(ring, archive, …)
    // 2. Assert archive list shows (T, D); load returns source_as_of + body (AC-1, AC-24)
    // 3. Late-ET as_of 20:00–23:59 → et_date stays D (AC-27) — dedicated assert
    // 4. Force ring prune with max_per=1 / append >48 tiny-cap rows; ring may drop D copies
    // 5. Session load (T, D) still Some (AC-2, AC-3 poison)
    // 6. RESEARCH_VENDOR_CALLS / a local AtomicU64 on session handlers stays 0 (AC-4, AC-5)
    // 7. Second same-day capture → still exactly one (T, D); first body retained (AC-6)
    // 8. Load miss closed detail; no date substitution (AC-7, AC-12)
    // 9. Ring empty list detail == "no stored snapshot for T" ≠ session miss (AC-8)
    // 10. Disabled archive → session archive not storing; ring capture still works (AC-9)
    // 11. Failing archive → capture_into Ok; no new session identity (AC-10)
    // 12. Corrupt body under identity → session book unreadable (AC-11)
    // 13. Secrets scan on archived bytes (AC-18)
    // 14. Score triple via compute_from_port unchanged vs baseline (AC-17) — archive not imported
}
```

Also cover Json path reject unit (can live in store tests from B2).

- [ ] **Step 2:** run `cargo test -p api-rust --test session_chain_archive -- --nocapture` → PASS.

- [ ] **Step 3:** Commit: `test(session-archive): integration harness prune+first-wins+isolation`.

**Reviewer probe:** poison prune is non-vacuous (ring count drops or forced prune runs); session
load still hits. Seed identity for conformance is separate from this harness ticker.

---

### B8 — Structural isolation + route/path guards

**Files:** `apps/api/tests/session_chain_archive_isolation.rs`

**Why:** `[structural-over-prose-enforcement]` / SPEC §8 — poison the forbidden thing; build goes red.

- [ ] **Step 1: failing/passing source scans** (mirror `tests/chain_snapshot_isolation.rs`):

```rust
#[test]
fn signals_quant_engine_score_path_do_not_import_session_chain_archive() {
    // libs/quant-engine/** and compute_analytics_from_vendor slice: no "session_chain_archive"
}

#[test]
fn ring_prune_symbol_does_not_reference_session_archive() {
    let store = fs::read_to_string("apps/api/src/services/chain_snapshot/store.rs").unwrap();
    let prune = slice_fn(&store, "pub async fn prune_symbol");
    assert!(!prune.contains("session_chain_archive"));
    assert!(!prune.contains("SessionChainArchive"));
    // anti-vacuity: capture.rs DOES contain archive_session_best_effort
    let capture = fs::read_to_string("apps/api/src/services/chain_snapshot/capture.rs").unwrap();
    assert!(capture.contains("archive_session_best_effort"));
}

#[test]
fn session_archive_public_api_has_no_prune_method() {
    let store = fs::read_to_string("apps/api/src/services/session_chain_archive/store.rs").unwrap();
    assert!(!store.contains("fn prune"));
    assert!(!store.contains("prune_symbol"));
}

#[test]
fn research_session_books_mounted_under_api_research_only() {
    let routes = fs::read_to_string("apps/api/src/routes/mod.rs").unwrap();
    assert!(routes.contains("/api/_research/session-books/{symbol}"));
    assert!(routes.contains("/api/_research/session-books/{symbol}/book"));
    let ticker = fs::read_to_string("apps/api/src/routes/ticker.rs").unwrap();
    assert!(!ticker.contains("session-books"));
    let scan = fs::read_to_string("apps/api/src/routes/scan.rs").unwrap();
    assert!(!scan.contains("session-books"));
}

#[test]
fn ring_miss_detail_unchanged_no_invented_empty_48_ring_phrase() {
    let src = fs::read_to_string("apps/api/src/routes/research_chain_snapshots.rs").unwrap();
    assert!(src.contains("no stored snapshot for {symbol}"));
    assert!(!src.contains("empty 48-ring"));
    // session route uses session miss copy
    let sess = fs::read_to_string("apps/api/src/routes/research_session_books.rs").unwrap();
    assert!(sess.contains("no session book for"));
    assert!(!sess.contains("no stored snapshot for"));
}

#[test]
fn retention_dials_unchanged_at_48_and_14d() {
    let cfg = fs::read_to_string("apps/api/src/config.rs").unwrap();
    // still default 48 and 1_209_600 for chain_snapshot_* — AC-19
    assert!(cfg.contains("env_u64(\"CHAIN_SNAPSHOT_MAX_PER_SYMBOL\", 48)"));
    assert!(cfg.contains("env_u64(\"CHAIN_SNAPSHOT_MAX_AGE_SECS\", 1_209_600)"));
}

#[test]
fn pages_function_still_404s_api_research() {
    let pages = fs::read_to_string("functions/api/[[path]].ts").unwrap();
    assert!(pages.contains("/api/_research"));
    assert!(pages.contains("status: 404"));
}
```

- [ ] **Step 2:** PASS. Commit: `test(session-archive): isolation + prune + miss-copy guards`.

---

## Frontend / infra track

### F1 — Pages `/api/_research/*` 404 non-regression (AC-16)

**Files:** `functions/api/[[path]].ts` (**verify only**)

**Why:** INTERFACE standing rule 4. Live file **already** 404s `_research` (lines 45–51) the same
way as `_metrics`. This task is a **non-regression proof**, not a product edit.

- [ ] **Step 1:** confirm the live branch still reads:

```ts
if (
  url.pathname === '/api/_metrics' ||
  url.pathname.startsWith('/api/_metrics/') ||
  url.pathname === '/api/_research' ||
  url.pathname.startsWith('/api/_research/')
) {
  return new Response('Not Found', { status: 404 });
}
```

- [ ] **Step 2:** if already present → **no code change**. If somehow missing → restore exactly the
  block above (do not invent a narrower allow-list). Covered by F2 structural + B8 pages scan.

- [ ] **Step 3:** Commit only if a restore was required:
  `fix(pages): restore /api/_research 404 like /api/_metrics`.

**Do not** proxy `_research` / `session-books` to Railway from Pages.

---

### F2 — Trader chrome absence (structural empty-diff) (AC-15, AC-16)

**Files:** `apps/dashboard/src/app/session-chain-archive.structural.spec.ts` (**create**)

**Why:** SPEC §4 `NO_UI_CHANGE` / AC-15 — no DOM harness; structural affordance scan. Mirror live
`chain-snapshot-capture.structural.spec.ts` / `batch-backtest-cli.structural.spec.ts`.

- [ ] **Step 1: write the structural spec** (must include anti-vacuity + mutation probes):

```ts
/**
 * session-chain-archive F1+F2 — NO_UI_CHANGE structural enforcement (AC-15, AC-16).
 *
 * F1: Pages trader origin 404s `/api/_research` like `/api/_metrics` (non-regression).
 * F2: no session-archive browse / replay / blob download affordance on trader sources;
 *     libs/api has no `/api/_research/session-books` fetch helper.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DASHBOARD_SOURCES = import.meta.glob(
  ['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}', '!**/*.test.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const TRADER_FORBIDDEN = [
  '/api/_research',
  'session-books',
  'session_chain_archive',
  'session archive',
  'RESEARCH READ — SESSION BOOK',
  'no session book for',
  'loaded from session archive',
] as const;

const CLIENT_FORBIDDEN = ['/api/_research', 'session-books'] as const;

// … workspaceRoot / pagesSourceBlocksResearch helpers — copy from
// chain-snapshot-capture.structural.spec.ts (same Pages 404 extractor) …

describe('F1 · Pages 404 /api/_research (AC-16 non-regression)', () => {
  it('same 404 branch covers /api/_research and session-books subpaths', () => {
    const src = readFileSync(PAGES_FN, 'utf8');
    expect(pagesSourceBlocksResearch(src)).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research/session-books/SPY')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research/session-books/SPY/book')).toBe(true);
  });
});

describe('F2 · no session-archive chrome on trader sources (AC-15)', () => {
  it('anti-vacuity — glob sees pages/features/shell', () => { /* same as sibling */ });

  it('dashboard production sources carry none of the session-archive needles', () => {
    const offenders: string[] = [];
    for (const [path, src] of Object.entries(DASHBOARD_SOURCES)) {
      const hits = hitsIn(src);
      if (hits.length) offenders.push(`${path} → ${hits.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('libs/api convexa.ts has no session-books research helper', () => {
    const src = readFileSync(CONVEXA_CLIENT, 'utf8');
    expect(hitsIn(src, CLIENT_FORBIDDEN)).toEqual([]);
  });

  it('mutation — scanner fires on poisoned trader source', () => {
    const poison =
      "fetch('/api/_research/session-books/SPY') // RESEARCH READ — SESSION BOOK";
    expect(hitsIn(poison)).toEqual(
      expect.arrayContaining([
        '/api/_research',
        'session-books',
        'RESEARCH READ — SESSION BOOK',
      ]),
    );
  });
});
```

- [ ] **Step 2:** `npx nx test @convexa/dashboard --testFile=session-chain-archive.structural.spec.ts`
  → exit 0. Do **not** add UI. `npx nx typecheck @convexa/dashboard` → exit 0.

- [ ] **Step 3:** Commit: `test(dashboard): no session-archive trader chrome`.

**Parallel with backend:** F1/F2 do not wait on B*.

---

## Verification track

Run after Backend B8 + Frontend F2.

### V1 — Backend suite

- [ ] `npm run ports:free` (if any orphan servers)
- [ ] `npx nx test api`
  - Expect: exit 0 (`$LASTEXITCODE -eq 0`)
  - Includes: `session_chain_archive*` + existing `chain_snapshot_*` + `score_identity` still green

### V2 — Pages `_research` 404 proof

- [ ] `rg -n "api/_research" functions/api/[[path]].ts` shows 404 branch beside `_metrics`
- [ ] F2 structural Pages cases green; if a Pages/local edge harness exists, request
  `GET /api/_research/session-books/SPY` on the trader origin → **404**. If no harness: source
  proof + review note in QA (AC-16).

### V3 — Interface conformance

- [ ] Start API: `npx nx serve api` (port 8000) — archive store enabled; dedicated seed planted at
  boot (`(SPY, 2020-01-02)` / `source_as_of=2020-01-02T17:00:00.000000001Z`) or plant manually
- [ ] Run:

```text
node .grok/tools/interface_conformance.mjs --contract .spire/clusters/tech/contracts/session-chain-archive/INTERFACE_CONTRACT.md --url http://127.0.0.1:8000 --report .spire/clusters/tech/contracts/session-chain-archive/conformance-receipt.json
```

  Expect PASS on list SPY shape, list ZZZZNOPE miss keys, load miss 404, load hit 200 (when seeded).
  Hit-probe UNVERIFIABLE only if seed step cannot run (INTERFACE allows).
- [ ] Manually assert (conformance is type-only on string tokens):
  - list miss `detail === "no session book for ZZZZNOPE"`
  - load 404 `detail === "no session book for ZZZZNOPE on 2000-01-01"`
  - hit `authorizes === "nothing"`, `framing === "RESEARCH READ — SESSION BOOK"`,
    `provenance === "loaded from session archive · no vendor call"`, `vendor_called === false`,
    `source_as_of` present
  - ring vehicle still emits `no stored snapshot for <SYMBOL>` (AC-8) — spot-check
    `GET /api/_research/chain-snapshots/ZZZZNOPE`

### V4 — Dashboard typecheck + chrome absence

- [ ] `npx nx typecheck @convexa/dashboard` → exit 0
- [ ] `npx nx test @convexa/dashboard --testFile=session-chain-archive.structural.spec.ts` → exit 0
- [ ] `git diff --name-only -- apps/dashboard` → no product UI files (structural spec only)

### V5 — Review ACs

- [ ] **AC-19:** `CHAIN_SNAPSHOT_MAX_PER_SYMBOL` still 48; age still 1_209_600 — not raised
- [ ] **AC-20:** no liquid-name force-capture (program #2) in diff
- [ ] **AC-21:** no object-store / hist-chain / Path-B CLI rewrite / AI-lab work in diff
- [ ] **AC-22:** operator path = `/api/_research/session-books/...` without trader UI
- [ ] **AC-23:** hit envelopes carry `authorizes: "nothing"` (unit + conformance)

### V6 — AC traceability checklist (ship-blocking)

| AC | Track evidence |
|---|---|
| AC-1 | B5 hook + B7 harness identity appears |
| AC-2, AC-3 | B7 poison prune → load still hits |
| AC-4, AC-5 | B6/B7 `vendor_called` false / counter 0 |
| AC-6 | B5/B7 first-wins |
| AC-7, AC-12 | B6 load 404 closed detail; no substitution |
| AC-8 | B6/B8 ring miss string unchanged ≠ session miss |
| AC-9 | B2/B6/B7 disabled → not-storing |
| AC-10, AC-14, AC-26 | B5 Failing double; capture Ok; no trader chrome |
| AC-11 | B6/B7 unreadable class |
| AC-13 | B5 archive leaf never calls Massive |
| AC-15, AC-16 | F2 + F1 + V2 |
| AC-17 | B7/B8 score path isolation + byte-identity |
| AC-18 | B7 secrets scan |
| AC-19 | B8 retention dial pin + V5 |
| AC-20, AC-21, AC-22 | V5 review |
| AC-23, AC-24, AC-25 | B6 hit envelope fields + V3 |
| AC-27 | B1 late-ET + B7 |

Overall Verification PASS requires V1–V5 exit/review green and every `test`-marked AC mapped above.

---

## Planning fills (not product re-opens)

1. **Hook site:** archive runs inside `capture_into` **after** `ring.prune_symbol`, with the same
   `(wire, body)` already serialized for the ring row. `capture_best_effort` passes
   `&state.session_archive`. Existing ring-only `capture_into` call sites take
   `SessionChainArchive::disabled()`.
2. **`et_date`:** `et_date_from_as_of(DateTime<Utc>)` in the archive module — New_York calendar rule
   matching `session_date_et`, no `f64` bridge when `DateTime` is in hand; `timestamp() <= 0` → skip.
3. **Conformance seed:** dedicated `(SPY, 2020-01-02)` plant — never ring `CONFORMANCE_SEED_AS_OF`.
4. **Pages:** already 404s `_research`; F1 is non-regression; F2 owns trader-chrome structural proof.
5. **List miss vs load 404:** list empty is HTTP 200 `store=miss` with full standing envelope
   including `authorizes`; load miss is HTTP 404 detail-only (INTERFACE).

---

## Out of scope (do not implement)

- Raising 48 / 14d ring retention
- Last-RTH / explicit-close selection (first-wins + visible `source_as_of` stand)
- Liquid-name force-capture (program #2)
- Object-store / dedicated volume (program #7)
- Path-B / `batch-backtest` / `replay-outcome-join` CLI rewires onto the session archive
- Rewriting ring research miss copy / inventing `empty 48-ring for <SYMBOL>`
- Trader UI / Settings / Ask-AI / nav / Pages proxy of `_research`
- Massive hist-chain / PIT endpoints
- Optional is/is-not prose print-layer on the HTTP envelope
- Human operator CLI wrappers (not a second conformance surface this ship)
