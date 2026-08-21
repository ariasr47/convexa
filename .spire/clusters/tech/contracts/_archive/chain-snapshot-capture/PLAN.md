# chain-snapshot-capture — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking. Execute from the workspace root. Keep this plan at
> `.spire/clusters/tech/contracts/chain-snapshot-capture/PLAN.md`.

**Goal:** After every successful **fresh-vendor** paid fetch on an **in-scope** producer (scanner
slow-lane / serve-ticker cold compute), append a dated raw `VendorBundle` to a research side-store
so operators can list/load that exact book later with **zero** Massive I/O — without touching the
trader UI, without hooking the warmer, and without letting capture write failure fail the desk.

**Architecture:** One-way capture leaf. `compute_analytics` materializes `VendorBundle` and returns
it to callers **without** capturing. Only `load_or_compute` and `load_analytics` (fresh-vendor
success) clone the bundle and `tokio::spawn` off-path serialize+append+prune. `refresh_analytics` /
`warmer.rs` never spawn capture. Side-store is append-only keyed by `(symbol, as_of)` with dual
retention (14d + 48/symbol). Research GETs under `/api/_research/chain-snapshots/...` (Railway-
direct + `METRICS_SECRET_TOKEN`); Pages trader origin 404s `/api/_research/*` like `_metrics`.

**Tech stack:** Rust Axum (`apps/api`, crate `api-rust`); optional Postgres (`--features postgres`);
Cloudflare Pages Function `functions/api/[[path]].ts`. Tests: `npx nx test api` /
`cargo test -p api-rust`. `NO_UI_CHANGE` for `apps/dashboard`.

**Spec:** `.spire/clusters/tech/contracts/chain-snapshot-capture/SPEC.md` (APPROVED 2026-08-18)
**Interface:** `.spire/clusters/tech/contracts/chain-snapshot-capture/INTERFACE_CONTRACT.md`

---

## Track map

| Track | Tasks | Ownership |
|---|---:|---|
| **Backend** (`apps/api`) | **B1 → B9** (strict order inside the track) | Main product surface |
| **Frontend / infra** | **F1 → F2** | Pages 404 + trader-chrome absence only |
| **Verification** | **V1 → V6** after B9 + F2 | Read-only gates |

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
- **Cite live Rust only** (`analytics.rs`, `live.rs`, `warmer.rs`, `pg_scan.rs`,
  `functions/api/[[path]].ts`) — not Python `scanstore`.
- **Do not edit** `SPEC.md`, `INTERFACE_CONTRACT.md`, or other feature folders.

**Feature hard rules (settled — do not re-open):**

- **D1=A:** every successful paid fresh-vendor fetch on an **in-scope** producer appends; **no**
  min-interval thinning. Missing append when storage is configured+writable is a defect (AC-28).
- **Dual retention only:** `CHAIN_SNAPSHOT_MAX_AGE_SECS=1_209_600` (14d) **and**
  `CHAIN_SNAPSHOT_MAX_PER_SYMBOL=48`. Never latest-wins collapse while younger history remains.
- **Warmer excluded (S2 Important #1 fill):** capture MUST NOT run inside `compute_analytics` and
  MUST NOT be spawned from `refresh_analytics` / `warmer.rs`. Hook only:
  - `load_or_compute` — after a fresh `compute_analytics` success (not cache hit)
  - `load_analytics` — after a fresh compute that returns source `"live"` (not `"cache"`)
  A builder who “clones VendorBundle at construction” **must still leave warmer uncaptured**.
- **List-miss provenance (S2 Important #2 fill):** INTERFACE still requires the `provenance` key on
  list miss. SPEC §4 Empty/Miss forbids a stored-load claim when `count === 0`. Exact wire strings:
  - **hit:** `provenance = "loaded from store · no vendor call"`
  - **miss:** `provenance = "no vendor call"` (INTERFACE “family / still no-vendor; does not imply a
    row exists”; does **not** say “loaded from store”)
  - **hit framing:** `RESEARCH READ — STORED CHAIN SNAPSHOT`
  - **miss framing:** `RESEARCH READ — NO STORED SNAPSHOT`
  - **miss `detail`:** exactly `no stored snapshot for <SYMBOL>` (load 404 may append ` at <as_of>`)
- **Off request path:** serve/ticker capture via `tokio::spawn` after the caller already holds
  `AnalyticsSnapshot`; never await capture I/O on the trader future.
- **Isolation:** capture write/prune failure → log `capture skipped — trader path unchanged`; desk
  unchanged. Storage absent → `capture not storing`; no false stored success.
- **Score byte-identity:** capture is a one-way leaf; signals/score/fingerprint never import it;
  blobs never scoring inputs.
- **Secret hygiene:** never persist request URLs / `apiKey` / env (`massive/rest.rs` injects
  `apiKey` into HTTP URLs — that string must not cross the serialize boundary).
- **`as_of`:** RFC 3339 UTC **with fractional seconds** (nanos). Store as **TEXT** (or integer
  nanos), **not** `timestamptz` (GATE Q seed `1970-01-01T00:00:00.000000001Z` must round-trip).
- **`NO_UI_CHANGE`:** no trader chrome. Frontend track is Pages 404 + structural absence only.
- **Optional `limit`:** when set, require `limit >= 1`; otherwise 400. Default (omitted) list is
  what AC-1 uses for count. Never report `store=miss` solely because `limit` clamped a page empty
  while rows exist.

**License one-liner (wire `license`):**
`Our research · not redistributed on a trader route.`

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
| `npx nx test api` / `cargo test -p api-rust -p quant-engine` | exit 0 |
| Feature tests named in B*/V* | exit 0; named ACs covered |
| `npx nx typecheck @convexa/dashboard` | exit 0 (FE track / V*) |
| Pages `/api/_research` 404 | status 404 (same as `_metrics`) |
| `interface_conformance` against Global Constraints block | PASS (or UNVERIFIABLE only on hit-probe seed failure) |
| `git diff --name-only -- apps/dashboard` | empty **or** only structural-test files if F2 adds a scan spec — **no** product UI |

---

## File ownership

| Path | Change |
|---|---|
| `apps/api/src/services/chain_snapshot/mod.rs` | **Create** — module root, re-exports |
| `apps/api/src/services/chain_snapshot/wire.rs` | **Create** — capture wire DTO + serialize/deserialize |
| `apps/api/src/services/chain_snapshot/store.rs` | **Create** — `ChainSnapshotStore` (memory/JSON + postgres) |
| `apps/api/src/services/chain_snapshot/capture.rs` | **Create** — off-path append+prune leaf + log lines |
| `apps/api/src/services/chain_snapshot/wire_tests.rs` or `#[cfg(test)]` in wire/store | Unit tests |
| `apps/api/src/services/mod.rs` | `pub mod chain_snapshot;` |
| `apps/api/src/services/analytics.rs` | Return `VendorBundle` from `compute_analytics`; spawn capture **only** from `load_or_compute` / `load_analytics`; **not** from `refresh_analytics` |
| `apps/api/src/services/warmer.rs` | **No capture call** (structural proof in B9) |
| `apps/api/src/config.rs` | Retention dials + store path env |
| `apps/api/src/state.rs` | Hold `ChainSnapshotStore` (or `Option` when not configured) |
| `apps/api/src/db/migrations.rs` | Migration v10 `chain_snapshots` |
| `apps/api/src/db/pg_scan.rs` **or** `apps/api/src/db/pg_chain_snapshot.rs` | Postgres append/list/load/prune (**prefer new file** — do not overload `scan_bundles`) |
| `apps/api/src/db/mod.rs` | Export new pg module if split |
| `apps/api/src/routes/research_chain_snapshots.rs` | **Create** — list + load handlers |
| `apps/api/src/routes/mod.rs` | Mount `/api/_research/chain-snapshots/...` |
| `apps/api/src/routes/health.rs` | Reuse `metrics_token_ok` (extract to shared helper if needed) |
| `apps/api/tests/chain_snapshot_capture.rs` | **Create** — integration harness |
| `apps/api/tests/chain_snapshot_isolation.rs` | **Create** — one-way leaf + warmer-exclusion source scans |
| `functions/api/[[path]].ts` | 404 `/api/_research` like `_metrics` |
| `apps/dashboard/**` | **No product UI.** Optional structural scan test only (F2) |

**Do not touch:** `scan_bundles` schema/semantics, `scan_structure_history` columns, score/tier/
fingerprint math, trader routes (`/api/ticker`, SSE, scan desk), warmer cadence, Massive hist
endpoints, dashboard pages/components/nav.

---

## Backend track

### B1 — Capture wire: VendorBundle ↔ bytes (no secrets)

**Files:** `apps/api/src/services/chain_snapshot/{mod.rs,wire.rs}`; `apps/api/src/services/mod.rs`

**Why:** SPEC §2.1 — persist parsed-domain via fixture-symmetric wire (`OptionsMarketState` +
`DailyBarWire` / `IntradayBarWire` / `TradePrintWire`), never HTTP URLs/`apiKey`.

- [ ] **Step 1: failing tests** in `wire.rs` `#[cfg(test)]`:

```rust
#[test]
fn round_trip_preserves_symbol_as_of_source_and_market() {
    // build a minimal VendorBundle (fixture source, 1 contract, empty companions)
    // serialize → deserialize → assert identity fields + market.contracts[0].strike_price
}

#[test]
fn serialized_bytes_contain_no_apikey_or_url_query() {
    let bytes = serialize_capture(&bundle).unwrap();
    let s = String::from_utf8_lossy(&bytes).to_ascii_lowercase();
    assert!(!s.contains("apikey"));
    assert!(!s.contains("api_key"));
    assert!(!s.contains("https://"));
}

#[test]
fn as_of_wire_preserves_fractional_seconds() {
    let as_of = DateTime::<Utc>::from_timestamp(0, 1).unwrap(); // 1 ns
    // serialize/deserialize; assert as_of string contains ".000000001" (or equivalent RFC3339)
}
```

Run: `cargo test -p api-rust chain_snapshot::wire -- --nocapture` → **FAIL** (module missing).

- [ ] **Step 2: implement** `ChainSnapshotWire`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainSnapshotWire {
    pub symbol: String,
    pub as_of: DateTime<Utc>, // serde RFC3339 with nanos
    pub source: MarketDataSourceKind, // live_massive | fixture
    pub market: OptionsMarketState,
    pub daily_bars: Vec<DailyBarWire>,
    pub minutes: Vec<IntradayBarWire>,
    pub trades: Vec<TradePrintWire>,
}
```

Map domain bars ↔ wire (mirror `market_data/fixture.rs` directions). `serialize_capture` /
`deserialize_capture` use `serde_json::to_vec` / `from_slice` only — **no** URL fields on the
struct. `as_of_string(dt)` helper: `dt.to_rfc3339_opts(SecondsFormat::Nanos, true)`.

- [ ] **Step 3:** re-run tests → PASS. Commit: `feat(chain-snapshot): capture wire round-trip`.

**Reviewer probe:** poison a wire JSON with `"url":"...apiKey=SECRET"` and assert deserialize
ignores unknown fields **and** a secrets scan of *our* serializer output stays clean.

---

### B2 — In-memory / JSON `ChainSnapshotStore` + dual retention

**Files:** `apps/api/src/services/chain_snapshot/store.rs`

**Why:** SPEC §2.2 / §2.4 — append-only side-store; dual prune after append; not `scan_bundles`.

- [ ] **Step 1: failing tests:**

```rust
#[tokio::test]
async fn append_then_list_increases_count_and_preserves_both_identities() { /* … */ }

#[tokio::test]
async fn second_append_does_not_clobber_first_inside_policy() { /* … */ }

#[tokio::test]
async fn exact_same_symbol_as_of_is_idempotent_on_conflict() { /* … */ }

#[tokio::test]
async fn count_cap_48_drops_oldest_first() {
    // with max_per_symbol=3 in test config: append 4 → count 3; oldest as_of missing; newest loadable
}

#[tokio::test]
async fn max_age_evicts_old_rows() {
    // plant as_of older than max_age; prune; load → miss
}

#[tokio::test]
async fn prune_failure_does_not_fail_append() {
    // unit: append returns Ok even if a test double prune errs (if using injectable prune);
    // at minimum: document JSON path never fails append on prune miss
}
```

Run → FAIL.

- [ ] **Step 2: implement** store API:

```rust
pub struct SnapshotMeta {
    pub symbol: String,
    pub as_of: DateTime<Utc>,
    pub source: MarketDataSourceKind,
}

pub enum ChainSnapshotStore {
    Memory(Arc<RwLock<MemoryInner>>),
    Json(JsonInner),
    #[cfg(feature = "postgres")]
    Postgres(PgChainSnapshotStore),
}

impl ChainSnapshotStore {
    pub async fn append(&self, wire: &ChainSnapshotWire, body: &[u8]) -> AppResult<()>;
    pub async fn list(&self, symbol: &str, limit: Option<usize>) -> AppResult<Vec<SnapshotMeta>>;
    pub async fn load(&self, symbol: &str, as_of: DateTime<Utc>) -> AppResult<Option<Vec<u8>>>;
    pub async fn prune_symbol(&self, symbol: &str, max_age: Duration, max_per: usize) -> AppResult<()>;
}
```

JSON layout (local): directory or single file under
`CHAIN_SNAPSHOT_STORE_PATH` (default beside scan store, e.g. `{scan_store_path}/chain_snapshots/`),
keyed by normalized symbol; each entry stores `as_of` **string**, `source`, and opaque body bytes
(base64 or sibling `.bin` — pick one and keep tests hermetic). Primary key = `(symbol, as_of_rfc3339)`.
`ON CONFLICT` / map-insert of identical key = no-op (idempotent).

Prune after successful append (caller in B5): delete where `now - as_of > max_age` **OR** excess
beyond `max_per` ordered by `as_of ASC`.

- [ ] **Step 3:** tests PASS. Commit: `feat(chain-snapshot): memory/json store + dual retention`.

**Reviewer probe:** assert store is **not** “one row per symbol” — two as_ofs coexist under cap.

---

### B3 — Postgres backend + migration v10

**Files:** `apps/api/src/db/migrations.rs`; `apps/api/src/db/pg_chain_snapshot.rs` (new);
`apps/api/src/db/mod.rs`

**Why:** parity with `ScanStore` when `DATABASE_URL` + postgres feature; nanos-safe `as_of`.

- [ ] **Step 1:** add migration **version 10** `chain_snapshots`:

```sql
CREATE TABLE IF NOT EXISTS chain_snapshots (
    symbol      TEXT NOT NULL,
    as_of       TEXT NOT NULL,          -- RFC3339 with fractional seconds (NOT timestamptz)
    source      TEXT NOT NULL,          -- live_massive | fixture
    body        BYTEA NOT NULL,         -- opaque capture JSON bytes
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (symbol, as_of)
);
CREATE INDEX IF NOT EXISTS chain_snapshots_symbol_as_of_idx
    ON chain_snapshots (symbol, as_of DESC);
```

- [ ] **Step 2:** implement `PgChainSnapshotStore` methods mirroring B2. Insert:

```sql
INSERT INTO chain_snapshots (symbol, as_of, source, body)
VALUES ($1, $2, $3, $4)
ON CONFLICT (symbol, as_of) DO NOTHING
```

Prune age: `DELETE … WHERE symbol = $1 AND as_of < $2` (compare RFC3339 text carefully — prefer
filtering in Rust after `SELECT as_of` for the symbol, or store a parallel `as_of_ns BIGINT` column
**in the same migration** if text comparison is unsafe). **Preferred:** add `as_of_ns BIGINT NOT NULL`
alongside `as_of TEXT` for prune/order; keep `as_of` text as the wire identity. PK stays
`(symbol, as_of)` text.

```sql
-- preferred shape
as_of    TEXT NOT NULL,
as_of_ns BIGINT NOT NULL,
```

- [ ] **Step 3:** unit/integration test behind `#[cfg(feature = "postgres")]` **or** shared logic
  tested via Memory in B2 and a compile-smoke of SQL strings. Commit:
  `feat(chain-snapshot): postgres store + migration v10`.

**Reviewer probe:** GATE Q seed `1970-01-01T00:00:00.000000001Z` round-trips; timestamptz must not
be the identity column.

---

### B4 — Config dials + AppState wiring

**Files:** `apps/api/src/config.rs`; `apps/api/src/state.rs`

- [ ] **Step 1: failing test** (config parse defaults):

```rust
#[test]
fn chain_snapshot_retention_defaults() {
    // with env cleared: max_age_secs == 1_209_600, max_per_symbol == 48
}
```

- [ ] **Step 2: add to `Config`:**

```rust
pub chain_snapshot_max_age_secs: u64,      // CHAIN_SNAPSHOT_MAX_AGE_SECS default 1_209_600
pub chain_snapshot_max_per_symbol: usize,  // CHAIN_SNAPSHOT_MAX_PER_SYMBOL default 48
pub chain_snapshot_store_path: PathBuf,    // CHAIN_SNAPSHOT_STORE_PATH (default under scan path)
pub chain_snapshot_enabled: bool,          // true when store opens successfully; false → capture not storing
```

Open `ChainSnapshotStore` in `AppState::new` with same postgres-vs-JSON selection pattern as
`ScanStore` (`state.rs` ~93–105). On open failure: log, set store to a `Disabled` variant or
`None`, desk still boots.

- [ ] **Step 3:** tests PASS. Commit: `feat(chain-snapshot): config + AppState store wiring`.

---

### B5 — Capture leaf (off-path append + prune + logs)

**Files:** `apps/api/src/services/chain_snapshot/capture.rs`

**Why:** SPEC §2.6 isolation; completion observed via log / list poll / test barrier — not trader 200.

- [ ] **Step 1: failing tests:**

```rust
#[tokio::test]
async fn capture_append_success_emits_chain_snapshot_appended_and_row_loadable() { /* … */ }

#[tokio::test]
async fn capture_write_failure_logs_skip_and_leaves_store_unchanged() {
    // inject failing store; call capture_best_effort; assert no panic; count unchanged
}

#[tokio::test]
async fn capture_when_store_disabled_logs_capture_not_storing() { /* … */ }
```

- [ ] **Step 2: implement:**

```rust
pub fn spawn_capture(state: AppState, bundle: VendorBundle) {
    tokio::spawn(async move {
        if let Err(e) = capture_best_effort(&state, bundle).await {
            warn!(error = %e, "capture skipped — trader path unchanged");
        }
    });
}

async fn capture_best_effort(state: &AppState, bundle: VendorBundle) -> AppResult<()> {
    let Some(store) = state.chain_snapshots.as_enabled() else {
        warn!("capture not storing");
        return Ok(());
    };
    let wire = to_wire(&bundle)?;
    let bytes = serialize_capture(&wire)?;
    // secrets assert in debug/test builds optional
    store.append(&wire, &bytes).await?;
    info!(symbol = %wire.symbol, as_of = %as_of_string(wire.as_of), "chain snapshot appended");
    if let Err(e) = store.prune_symbol(
        &wire.symbol,
        Duration::from_secs(state.config.chain_snapshot_max_age_secs),
        state.config.chain_snapshot_max_per_symbol,
    ).await {
        warn!(error = %e, "chain snapshot prune failed"); // do not fail append
    }
    Ok(())
}
```

Never call Massive. Never import from `signals` / score path.

- [ ] **Step 3:** PASS. Commit: `feat(chain-snapshot): best-effort capture leaf`.

---

### B6 — Hook sites (S2 Important #1) — NOT inside `compute_analytics`

**Files:** `apps/api/src/services/analytics.rs` (and only that for hooks)

**Live facts (verified):**
- `VendorBundle { … as_of: Utc::now(), source: LiveMassive }` is built inside `compute_analytics`
  (`analytics.rs` ~193–201) and currently dropped after `compute_analytics_from_vendor`.
- `load_or_compute` / `load_analytics` call `compute_analytics` on cache miss.
- `refresh_analytics` also calls `compute_analytics`; `warmer.rs` calls `refresh_analytics`.

**Mandatory shape:**

1. Change `compute_analytics` to return `(AnalyticsSnapshot, VendorBundle)` (or a small struct).
2. Update `load_or_compute`, `load_analytics`, `refresh_analytics` call sites to unpack.
3. **Capture spawn only here:**

```rust
// load_or_compute — inside join_or_run after fresh compute, BEFORE only returning snap:
let (snap, vendor) = compute_analytics(state, sym, None, None).await?;
state.gex_cache.set(snap.clone()).await;
seed_price_if_empty(state, &snap).await;
crate::services::chain_snapshot::spawn_capture(state.clone(), vendor);
Ok(snap)

// load_analytics — on the fresh-compute paths that today return source "live":
// after successful compute_analytics (both filter_active and singleflight branches),
// spawn_capture(state.clone(), vendor) then return (Some(snap), "live").
// Cache-hit returns MUST NOT spawn and MUST NOT re-fetch.
```

4. **`refresh_analytics`:**

```rust
let (snap, _vendor) = compute_analytics(state, sym, None, None).await?;
// intentionally drop _vendor — DO NOT spawn_capture
state.gex_cache.set(snap.clone()).await;
// … existing price warm …
Ok(snap)
```

- [ ] **Step 1: failing tests** in `tests/chain_snapshot_isolation.rs` (can land with B9) **and** a
  unit/integration test:

```rust
#[tokio::test]
async fn load_or_compute_fresh_path_appends_snapshot() { /* fixture or mock store on AppState */ }

#[tokio::test]
async fn gex_cache_hit_does_not_append() { /* warm cache; call load_or_compute; count unchanged */ }

#[tokio::test]
async fn refresh_analytics_does_not_append() { /* call refresh_analytics; count unchanged */ }
```

- [ ] **Step 2: implement hook as above.** Grep proof after edit:

```text
rg -n "spawn_capture" apps/api/src
```

Expected: definitions + calls **only** from `analytics.rs` `load_or_compute` / `load_analytics`.
Zero hits in `warmer.rs` / `refresh_analytics` body.

- [ ] **Step 3:** PASS. Commit: `feat(chain-snapshot): hook load_or_compute + load_analytics only`.

**Reviewer probe:** a builder cloning at construction inside `compute_analytics` would capture
warmer — this task’s tests must fail that mistake (`refresh_analytics_does_not_append`).

---

### B7 — Research HTTP list + load

**Files:** `apps/api/src/routes/research_chain_snapshots.rs`; `apps/api/src/routes/mod.rs`;
optionally extract `metrics_token_ok` from `health.rs` to a small shared fn.

**Why:** INTERFACE endpoints + AC-6–10, AC-25/26 framing.

- [ ] **Step 1: failing route tests** (axum oneshot or store-level + handler unit):

```rust
#[tokio::test]
async fn list_empty_zzzznopes_miss_envelope() {
    // GET list ZZZZNOPE → 200
    // store=miss, count=0, snapshots=[], vendor_called=false
    // detail == "no stored snapshot for ZZZZNOPE"
    // framing == "RESEARCH READ — NO STORED SNAPSHOT"
    // provenance == "no vendor call"   // S2 Important #2 fill
    // license == "Our research · not redistributed on a trader route."
}

#[tokio::test]
async fn load_miss_404_closed_detail() {
    // error=no_stored_snapshot, store=miss, vendor_called=false
    // detail starts with "no stored snapshot for "
}

#[tokio::test]
async fn load_hit_returns_typed_market_and_arrays() {
    // plant fixture snapshot; GET → 200; market.contracts non-fabricated;
    // provenance == "loaded from store · no vendor call"
    // framing == "RESEARCH READ — STORED CHAIN SNAPSHOT"
    // vendor_called == false
}

#[tokio::test]
async fn research_routes_never_increment_vendor_counter() { /* counter stays 0 */ }
```

- [ ] **Step 2: handlers**

Auth: same as `cache_metrics` — when `METRICS_SECRET_TOKEN` set, require Bearer /
`X-Metrics-Token`; else open. **Not** session-cookie auth (`"auth": true` forbidden).

List `GET /api/_research/chain-snapshots/{symbol}`:
- normalize symbol upper/trim
- optional `limit` — if present and `< 1` → 400; if present, page then
  `count = snapshots.len()`; if omitted, full in-policy list
- `store = hit` iff `count > 0` else `miss`
- miss requires closed `detail`; hit `detail: null`
- **never** call `MassiveRestClient`

Load `GET /api/_research/chain-snapshots/{symbol}/snapshot?as_of=...`:
- missing/unparseable `as_of` → 400/422
- miss → 404 body per INTERFACE
- hit → deserialize body → wire fields; `source` from stored lineage
- corrupt body → 500 `stored_snapshot_unreadable: …`, `vendor_called: false`
- store disabled → 500 `capture not storing` / `stored_snapshot_unreadable: capture not storing`

Mount in `routes/mod.rs`:

```rust
.route(
    "/api/_research/chain-snapshots/{symbol}",
    get(research_chain_snapshots::list_snapshots),
)
.route(
    "/api/_research/chain-snapshots/{symbol}/snapshot",
    get(research_chain_snapshots::load_snapshot),
)
```

- [ ] **Step 3:** PASS. Commit: `feat(chain-snapshot): research list/load routes`.

**Reviewer probe:** empty list must **not** use framing `RESEARCH READ — STORED CHAIN SNAPSHOT`
and must **not** use provenance `loaded from store · no vendor call`.

---

### B8 — Integration harness (SPEC §7 shape)

**Files:** `apps/api/tests/chain_snapshot_capture.rs`

Prefer **one** harness covering the silent-regression class over per-AC micro theaters.

- [ ] **Step 1: write the harness** (TDD: fail until B1–B7 complete):

```text
1. Open Memory/JSON store on a test AppState (no network Massive — use fixture VendorBundle plant
   OR intercept spawn_capture by calling capture_best_effort directly for store tests;
   for producer tests, drive load_or_compute with a fixture/mocked massive if available,
   else call spawn_capture/capture_best_effort with two distinct VendorBundles).
2. Baseline list count for T.
3. Capture cycle 1 → await completion (poll list until +1 OR read "chain snapshot appended").
4. Capture cycle 2 with different as_of → both identities listable + loadable (AC-1, AC-2, AC-4, AC-5).
5. Load hit body has market ATM/phase/contracts + bar/trade arrays (AC-3).
6. vendor_called / vendor counter = 0 on list+load including miss (AC-6, AC-7, AC-9, AC-10).
7. Force write failure → desk path still Ok; count unchanged (AC-12, AC-27 operator-only).
8. Cache-hit cycle → no new row (AC-11).
9. Dual retention age + count (AC-19, AC-20).
10. Secrets scan of stored bytes (AC-21).
11. Score/tier/fingerprint identical with capture on/off via existing score_identity pattern (AC-17).
12. Two as_ofs inside one UTC second both persist (§2.6).
13. refresh_analytics path does not append (AC-28 warmer exclusion).
```

Run: `cargo test -p api-rust --test chain_snapshot_capture -- --nocapture` → exit 0.

- [ ] **Step 2:** Commit: `test(chain-snapshot): integration harness for AC ship-blocking set`.

**AC map (backend `test`):** AC-1–14, AC-17–21, AC-24 (review note ok), AC-25–28. AC-15/16 shared
with F track. AC-22/23 → Verification review.

---

### B9 — Structural isolation + warmer exclusion scans

**Files:** `apps/api/tests/chain_snapshot_isolation.rs`

- [ ] **Step 1: tests** (pattern from `tests/research_isolation.rs`):

```rust
#[test]
fn signals_quant_engine_and_score_path_do_not_import_chain_snapshot() {
    // scan libs/quant-engine + services that own scoring; forbid "chain_snapshot"
}

#[test]
fn spawn_capture_not_referenced_from_warmer_or_refresh_analytics() {
    let warmer = fs::read_to_string("apps/api/src/services/warmer.rs").unwrap();
    assert!(!warmer.contains("spawn_capture"));
    assert!(!warmer.contains("chain_snapshot"));
    let analytics = fs::read_to_string("apps/api/src/services/analytics.rs").unwrap();
    // refresh_analytics function body must not contain spawn_capture
    let refresh = slice_fn(&analytics, "pub async fn refresh_analytics");
    assert!(!refresh.contains("spawn_capture"));
    // load_or_compute + load_analytics MUST contain spawn_capture (anti-vacuity)
    let loc = slice_fn(&analytics, "pub async fn load_or_compute");
    assert!(loc.contains("spawn_capture"));
}

#[test]
fn trader_routes_do_not_mount_research_chain_snapshots_under_ticker_or_scan() {
    // routes/mod.rs may mount /api/_research/... but apps/dashboard client must not
    // (FE F2). Backend: ensure path prefix is exactly /api/_research/
}
```

- [ ] **Step 2:** PASS. Commit: `test(chain-snapshot): isolation + warmer exclusion guards`.

---

## Frontend / infra track

### F1 — Pages edge 404 for `/api/_research/*`

**Files:** `functions/api/[[path]].ts`

**Why:** AC-16 / INTERFACE standing rule 4 — token gate alone is not the `_metrics` posture.
Live file already 404s `_metrics` at lines 44–46.

- [ ] **Step 1: failing assertion** (add a tiny node/vitest **or** document the exact patch and
  verify in V2). Prefer a unit test beside the function if the repo has one; otherwise V2 curls
  a local Pages emulator / static review plus a source scan:

```ts
// functions/api/[[path]].ts — extend the existing metrics block:
if (
  url.pathname === '/api/_metrics' ||
  url.pathname.startsWith('/api/_metrics/') ||
  url.pathname === '/api/_research' ||
  url.pathname.startsWith('/api/_research/')
) {
  return new Response('Not Found', { status: 404 });
}
```

- [ ] **Step 2:** apply patch. Source-scan test (can live under `apps/dashboard-e2e` **or** a
  small node test under `functions/` if present — if no runner, Verification V2 owns the
  `rg` proof):

```text
rg -n "_research" functions/api/[[path]].ts
```

Must show the 404 branch.

- [ ] **Step 3:** Commit: `fix(pages): 404 /api/_research like /api/_metrics`.

**Do not** proxy `_research` to Railway from Pages.

---

### F2 — Trader chrome absence (structural)

**Files:** optional `apps/dashboard/src/app/**/*.structural.spec.ts` **or** a repo test that
scans `apps/dashboard/src` + `libs/api/src/lib/convexa.ts`.

**Why:** AC-15, AC-16 (client absence), AC-27 — `NO_UI_CHANGE`.

- [ ] **Step 1: failing/passing scan test:**

```ts
// assert apps/dashboard/src has zero matches for:
//   /api/_research, chain-snapshots, "stored chain snapshot", "capture skipped"
// assert libs/api/src/lib/convexa.ts has zero /api/_research fetch helpers
// anti-vacuity: file list non-empty
```

- [ ] **Step 2:** if the tree is already clean, the test PASSES without product edits. Do **not**
  add UI. Commit only if a new spec file is added:
  `test(dashboard): no chain-snapshot trader chrome`.

**Parallel with backend:** F1/F2 do not wait on B*.

---

## Verification track

Run after Backend B9 + Frontend F2.

### V1 — Backend suite

- [ ] `npm run ports:free` (if any orphan servers)
- [ ] `npx nx test api`
  - Expect: exit 0 (`$LASTEXITCODE -eq 0`)
  - Includes: `chain_snapshot_*` unit/integration + existing `score_identity` still green

### V2 — Pages `_research` 404 proof

- [ ] `rg -n "api/_research" functions/api/[[path]].ts` shows 404 branch beside `_metrics`
- [ ] If a Pages/local edge harness exists, request `GET /api/_research/chain-snapshots/SPY` on the
  trader origin → **404**. If no harness: source proof + review note in QA (AC-16).

### V3 — Interface conformance

- [ ] Start API: `npx nx serve api` (port 8000)
- [ ] Plant GATE Q hit-probe row `(SPY, 1970-01-01T00:00:00.000000001Z)` fixture-source via store
  append helper / test admin — or mark hit probe **UNVERIFIABLE** if seed cannot run (INTERFACE
  allows this)
- [ ] Run `node .grok/tools/gates.mjs` / `interface_conformance` against the **Global Constraints**
  JSON block (exact tool path per conductor). Expect PASS on list SPY shape, list ZZZZNOPE miss
  keys, load miss 404, load hit 200 (when seeded)
- [ ] Manually assert miss `detail === "no stored snapshot for ZZZZNOPE"` and miss
  `provenance === "no vendor call"` (conformance is type-only on `detail` today)

### V4 — Dashboard typecheck + chrome absence

- [ ] `npx nx typecheck @convexa/dashboard` → exit 0
- [ ] `npx nx test @convexa/dashboard` if F2 added a spec → exit 0
- [ ] `git diff --name-only -- apps/dashboard` → no product UI files

### V5 — Review ACs

- [ ] **AC-22:** confirm PLAN/diff has no P3 batch backtest CLI
- [ ] **AC-23:** operator path = research HTTP (and optional CLI wrap) without trader UI
- [ ] **AC-24:** multi-ticker only via existing scanner sweep → `load_or_compute` (no new unbounded
  request sweep)

### V6 — AC traceability checklist (ship-blocking)

| AC | Track evidence |
|---|---|
| AC-1, AC-2, AC-4, AC-5, AC-28 | B8 harness + B6 hooks |
| AC-3, AC-25 | B7 load hit + framing/provenance |
| AC-6, AC-7, AC-8, AC-9, AC-10, AC-11 | B7 + B8 |
| AC-12, AC-13, AC-14, AC-27 | B5 + B8 (spawn / force-fail) |
| AC-15, AC-16 | F2 + F1 |
| AC-17, AC-18, AC-21 | B8 + B9 |
| AC-19, AC-20 | B2/B3 + B8 |
| AC-22, AC-23, AC-24 | V5 review |
| AC-26 | B7 store-error path |

Overall Verification PASS requires V1–V5 exit/review green and every `test`-marked AC mapped above.

---

## Planning fills (S2 residuals — not product re-opens)

1. **Warmer hook-site:** capture spawns only from `load_or_compute` / `load_analytics`; 
   `compute_analytics` may return `VendorBundle` but must not capture; `refresh_analytics` /
   `warmer.rs` discard the bundle.
2. **List-miss provenance:** required key kept; value on miss is exactly `no vendor call` (not
   `loaded from store · no vendor call`).
3. **`as_of` storage:** TEXT (+ optional `as_of_ns BIGINT` for prune), never identity-`timestamptz`.
4. **`limit`:** reject `< 1`; default list drives AC-1 counts.

---

## Out of scope (do not implement)

- Warmer / `refresh_analytics` capture
- Min-interval thinning
- Object-store infra
- P3 backtest CLI
- Trader UI / Pages proxy of `_research`
- Overloading `scan_bundles` or widening `scan_structure_history` into a chain dump
- Massive PIT / hist-chain endpoints
