# chain-archive-object-store — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking. Execute from the workspace root. Keep this plan at
> `.spire/clusters/tech/contracts/chain-archive-object-store/PLAN.md`.

**Goal:** Keep **session-archive bodies** off app Postgres BYTEA / unbounded Json `body_b64` so
weeks of paid books can accumulate without the Railway OLTP volume becoming the retention policy —
thin index stays in Postgres/Json; bodies live under env dial
**`SESSION_CHAIN_ARCHIVE_BODY_ROOT`**; research list/load stay zero-Massive with the shipped
miss / unreadable / not-storing vocabulary; **no trader UI**.

**Architecture:** Keep the live `SessionChainArchive` facade
(`apps/api/src/services/session_chain_archive/store.rs` —
`insert_if_absent` / `list` / `load` / `plant_conformance_seed`) and the live Postgres adapter
(`apps/api/src/db/pg_session_chain_archive.rs`, migration 11 `body BYTEA NOT NULL`). Split
**index content** (identity + provenance + opaque locator) from **body bytes** via a one-way FS
leaf rooted at `SESSION_CHAIN_ARCHIVE_BODY_ROOT`. Body keys are **unique per put** (include
`source_as_of_ns` + put nonce — never `(symbol, et_date)` alone). Write path: identity-exists →
`Ok(false)` without body I/O; else `put` then index `insert_if_absent`; loser put is an orphan.
Migrator moves legacy inline BYTEA / `body_b64` into the body store and **clears/drops** the
inline body column/field (dual-read alone is not Done). **48-ring Non-move:** do not touch
`ChainSnapshotStore` / `pg_chain_snapshot` body co-location.

**Tech stack:** Rust Axum (`apps/api`, crate `api-rust`); optional Postgres (`--features postgres`);
Cloudflare Pages Function `functions/api/[[path]].ts`. Tests: `npx nx test api` /
`cargo test -p api-rust`. `NO_UI_CHANGE` for `apps/dashboard` (structural empty-diff only).

**Spec:** `.spire/clusters/tech/contracts/chain-archive-object-store/SPEC.md` (APPROVED 2026-08-20)
**Interface:** `.spire/clusters/tech/contracts/chain-archive-object-store/INTERFACE_CONTRACT.md`

---

## Track map

| Track | Tasks | Ownership |
|---|---:|---|
| **Backend** (`apps/api`) | **B1 → B8** (strict order inside the track) | Body store + index split + migrator clear/drop |
| **Frontend / infra** | **F1 → F2** | Pages 404 non-regression + trader-chrome / storage-vocab absence |
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
- **Cite live Rust only** — `services/session_chain_archive/store.rs` (facade + `StoredRow` /
  `JsonRecord.body_b64`), `db/pg_session_chain_archive.rs` (INSERT/SELECT `body`),
  `db/migrations.rs` v11 `body BYTEA NOT NULL`, `state.rs` `open_session_chain_archive_*`,
  `config.rs` archive dials, `routes/research_session_books.rs`,
  `services/chain_snapshot/store.rs` / `db/pg_chain_snapshot.rs` (ring Non-move cite),
  `functions/api/[[path]].ts` — **not** Python-era FastAPI paths from the context-pack §2 narration.
- **Do not edit** `SPEC.md`, `INTERFACE_CONTRACT.md`, or other feature folders.

**Feature hard rules (settled — do not re-open):**

- **Body/index split behind the existing facade.** Callers
  (`archive_session_best_effort`, ensure worker, research routes, Path-B openers) keep calling
  `SessionChainArchive::{insert_if_absent,list,load,plant_conformance_seed}`. No new HTTP surface.
- **Unique-per-put locator only.** Key must include `source_as_of` (ns) **and/or** a put nonce so
  two concurrent writers for the same `(symbol, et_date)` never share a key. Identity-only
  deterministic locators are **rejected** (would last-win the body while the index first-wins).
- **Write path (binding):** (1) if identity exists → `Ok(false)` **without body I/O**; (2) else
  `put` under unique key, then index `insert_if_absent` with that locator; (3) if index insert
  loses, first body retained via winning row; loser put is orphan (optional best-effort delete,
  must not fail caller); (4) never put under a shared identity-only key.
- **`SESSION_CHAIN_ARCHIVE_BODY_ROOT`:** required when archive is enabled **and** the FS body store
  is in use (Postgres prod + Json disk adapters). **No silent default.** Unset / empty / missing /
  unusable / path-conflicts with ring `CHAIN_SNAPSHOT_STORE_PATH` **or** the index Json dir →
  fail-open to Disabled / exact **`session archive not storing`**. Do **not** `create_dir_all` a
  default path that hides misconfig. Creating the configured root itself after validation is OK.
- **Memory adapter** may keep an in-process body map (not FS) so hermetic unit tests do not require
  `BODY_ROOT`. Json + Postgres **must** use the FS leaf.
- **Migrator clear/drop is DoD for AC-1/2.** Dual-read during cutover is allowed; finishing without
  clearing/dropping inline BYTEA / `body_b64` is **not** Done.
- **Four distinguishable outcomes** (never collapsed; exact shipped strings):
  - session miss: `no session book for <SYMBOL>` / `… on <ET_DATE>`
  - empty/pruned **ring** (ring vehicle only): live `no stored snapshot for <SYMBOL>`
  - not storing: `session archive not storing`
  - load unreadable (incl. missing object behind pointer): `session book unreadable: <reason>`
  - list I/O fault (distinct): `session archive store error: <reason>`
- **Missing object = unreadable**, not miss, not not-storing, not a fifth storage class. Opaque
  `<reason>` only — no S3 / volume / BYTEA / path product vocabulary on the wire.
- **Zero vendor I/O on research read.** `vendor_called` always `false`. List is **index-only**.
- **Desk isolation:** body I/O never sits on trader HTTP/SSE await; store failures never fail
  bundle / scan / SSE. Off-path ensure **may** await FS put. `archive_session_best_effort` keeps
  swallowing errors.
- **48-ring Non-move (AC-22):** do **not** migrate `ChainSnapshotStore` / `pg_chain_snapshot`
  bodies; do **not** raise `chain_snapshot_max_per_symbol` (48) or `chain_snapshot_max_age_secs`
  (`1_209_600`). Named residual: ring BYTEA may still pressure OLTP inside 14d+48/symbol.
- **Score byte-identity:** bodies/pointers are non-inputs; hit + list-miss keep
  `authorizes: "nothing"`.
- **Secrets:** `BODY_ROOT` is runtime env only (`no-secrets-in-image`); stored material carries no
  API keys.
- **`NO_UI_CHANGE`:** no trader chrome; no storage-backend product copy (S3 / volume / BYTEA /
  “session bodies moved”) on dashboard / Settings / Ask-AI / `/_ops`.
- **GATE Q seed:** plant `(SPY, 2020-01-02)` with
  `source_as_of = 2020-01-02T17:00:00.000000001Z` via the **split put+index** path under
  `BODY_ROOT`. Do **not** plant via ring `CONFORMANCE_SEED_AS_OF`.

**License one-liner (wire `license` — unchanged):**
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
| `git diff --name-only -- apps/dashboard` | empty **or** only structural-test files if F* adds a scan spec — **no** product UI |
| Ring retention dials | still `48` / `1_209_600` — unchanged |
| Ring body storage | `pg_chain_snapshot` / `ChainSnapshotStore` still co-locate `body` / `body_b64` (Non-move) |

---

## File ownership

| Path | Change |
|---|---|
| `apps/api/src/config.rs` | Add `session_chain_archive_body_root: Option<PathBuf>` from `SESSION_CHAIN_ARCHIVE_BODY_ROOT`; path-conflict helpers vs ring + index |
| `apps/api/src/services/session_chain_archive/body_store.rs` | **Create** — `FsBodyStore` put/get/delete + `mint_body_locator` (unique-per-put) |
| `apps/api/src/services/session_chain_archive/store.rs` | Split index vs body; Json metadata drops `body_b64` after migrator; open requires body root for Json |
| `apps/api/src/services/session_chain_archive/migrate.rs` | **Create** — legacy BYTEA / `body_b64` → put + locator + clear/drop |
| `apps/api/src/services/session_chain_archive/mod.rs` | Export body-store / migrator as needed (`pub(crate)`) |
| `apps/api/src/db/migrations.rs` | Migration **v12** — additive `body_locator TEXT`, make `body` nullable; later clear/drop path |
| `apps/api/src/db/pg_session_chain_archive.rs` | Index insert/list/load by locator; dual-read then no BYTEA after clear/drop |
| `apps/api/src/state.rs` | Open archive with validated `BODY_ROOT`; fail-open to Disabled; run migrator idempotently |
| `apps/api/src/main.rs` + other `Config { ... }` literals | Plumb `session_chain_archive_body_root: None` (or test temp path) |
| `apps/api/tests/chain_archive_object_store.rs` | **Create** — AC harness (off-OLTP, race, missing object, BODY_ROOT misconfig) |
| `apps/api/tests/chain_archive_object_store_isolation.rs` | **Create** — ring Non-move, trader-path, score leaf, retention dials, storage-vocab ban on routes |
| `apps/api/tests/session_chain_archive.rs` | Update Memory/Json plants to post-split expectations (bodies via locator path) |
| `apps/dashboard/src/app/chain-archive-object-store.structural.spec.ts` | **Create** — AC-15/16 structural + storage-backend chrome ban |
| `functions/api/[[path]].ts` | **Verify only** — already 404s `/api/_research/*` |
| `apps/dashboard/**` (product) | **No product UI** |

**Do not touch:** ring retention defaults, ring `miss_detail`, `ChainSnapshotStore` /
`pg_chain_snapshot` body columns, score/tier/fingerprint math, trader routes, Massive hist
endpoints, Path-B / `batch-backtest` / `replay-outcome-join` CLI rewires beyond opening the same
facade, dashboard pages/components/nav, `DESIGN_SYSTEM.md`, `SPEC.md`, `INTERFACE_CONTRACT.md`.

---

## Backend track

### B1 — `SESSION_CHAIN_ARCHIVE_BODY_ROOT` dial + path-conflict helpers

**Files:** `apps/api/src/config.rs`; every `Config { ... }` literal that currently sets
`session_chain_archive_store_path` (`state.rs`, `main.rs`, `services/research/batch_backtest.rs`,
`tests/batch_backtest_cli.rs`, and any other compile-break sites `cargo check` names).

**Why:** SPEC §2.2 / AC-8 — named dial, no silent default, nest-under-ring / nest-under-index
forbidden.

- [ ] **Step 1: failing tests** in `config.rs` `#[cfg(test)]`:

```rust
#[test]
fn body_root_unset_is_none_not_invented_path() {
    std::env::remove_var("SESSION_CHAIN_ARCHIVE_BODY_ROOT");
    // Construct via the same env reader the production path uses, or unit the helper:
    assert!(parse_optional_path_env("SESSION_CHAIN_ARCHIVE_BODY_ROOT_UNSET_SENTINEL").is_none());
}

#[test]
fn body_root_conflicts_when_equal_or_nested_under_ring_or_index() {
    let ring = PathBuf::from("data/chain_snapshots");
    let index = PathBuf::from("data/session_chain_archive");
    assert!(body_root_conflicts(Path::new("data/chain_snapshots"), &ring, &index));
    assert!(body_root_conflicts(Path::new("data/chain_snapshots/bodies"), &ring, &index));
    assert!(body_root_conflicts(Path::new("data/session_chain_archive"), &ring, &index));
    assert!(body_root_conflicts(Path::new("data/session_chain_archive/bodies"), &ring, &index));
    assert!(!body_root_conflicts(Path::new("data/session_chain_archive_bodies"), &ring, &index));
}
```

Run: `cargo test -p api-rust config::tests -- --nocapture` → **FAIL** (helpers/field missing).

- [ ] **Step 2: implement**

```rust
// on Config
/// Filesystem body-store root. Required when archive enabled + FS body store in use.
/// `None` = unset/empty → open fail-open to not-storing (no silent default).
pub session_chain_archive_body_root: Option<PathBuf>,

// in Config::from_env, after session_chain_archive_store_path:
let session_chain_archive_body_root = env::var("SESSION_CHAIN_ARCHIVE_BODY_ROOT")
    .ok()
    .map(|s| s.trim().to_string())
    .filter(|s| !s.is_empty())
    .map(PathBuf::from);

// helpers (same component-prefix style as live archive_path_conflicts in store.rs):
pub fn path_equals_or_nests(candidate: &Path, other: &Path) -> bool {
    let c = candidate.components().collect::<Vec<_>>();
    let o = other.components().collect::<Vec<_>>();
    c == o || (c.starts_with(&o) && c.len() > o.len())
}

pub fn body_root_conflicts(body_root: &Path, ring: &Path, index: &Path) -> bool {
    path_equals_or_nests(body_root, ring) || path_equals_or_nests(body_root, index)
}
```

Plumb `session_chain_archive_body_root: None` into every existing `Config { ... }` literal so the
crate compiles. Do **not** invent a default under `data/`.

- [ ] **Step 3:** re-run tests → PASS. Commit:
  `feat(session-archive): SESSION_CHAIN_ARCHIVE_BODY_ROOT dial`.

**Reviewer probe:** unset env must be `None`, not `data/session_chain_archive_bodies`. Poison equal
+ nested ring/index paths.

---

### B2 — `FsBodyStore` leaf + unique-per-put locator

**Files:** `apps/api/src/services/session_chain_archive/body_store.rs` (**create**);
`apps/api/src/services/session_chain_archive/mod.rs`.

**Why:** SPEC §2.2 / §2.7 / AC-9 — FS is the only prod body adapter this ship; identity-only keys
are rejected.

- [ ] **Step 1: failing tests** in `body_store.rs`:

```rust
#[test]
fn mint_body_locator_is_unique_across_calls_same_identity() {
    let a = mint_body_locator("TSLA", "2024-06-03", 1_718_424_000_000_000_000);
    let b = mint_body_locator("TSLA", "2024-06-03", 1_718_424_000_000_000_000);
    assert_ne!(a, b);
    assert!(a.contains("TSLA") || a.contains("tsla") || a.contains("2024-06-03"));
    // Must not be identity-only:
    assert_ne!(a, "TSLA/2024-06-03");
    assert_ne!(a, "TSLA/2024-06-03.bin");
}

#[tokio::test]
async fn put_get_roundtrip_and_missing_get_errors() {
    let root = std::env::temp_dir().join(format!(
        "sca_bodies_{}_{}",
        std::process::id(),
        Utc::now().timestamp_nanos_opt().unwrap_or(0)
    ));
    let store = FsBodyStore::open(&root).expect("open");
    let key = mint_body_locator("TSLA", "2024-06-03", 42);
    store.put(&key, b"abc").expect("put");
    assert_eq!(store.get(&key).expect("get"), b"abc");
    let missing = store.get("no/such/key.bin").unwrap_err();
    assert!(!missing.to_string().to_ascii_lowercase().contains("s3"));
    assert!(!missing.to_string().to_ascii_lowercase().contains("bytea"));
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn open_rejects_unusable_empty_root_without_create_dir_all_default() {
    // empty path / nonexistent parent that we refuse — open returns Err;
    // implementer must NOT invent data/session_chain_archive_bodies
    let err = FsBodyStore::open(Path::new("")).unwrap_err();
    assert!(!err.to_string().is_empty());
}
```

Run → FAIL (module missing).

- [ ] **Step 2: implement**

```rust
//! Filesystem body store under SESSION_CHAIN_ARCHIVE_BODY_ROOT.
//! One-way leaf: no MarketData / Massive knowledge.

use crate::error::{AppError, AppResult};
use rand::RngCore;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Clone, Debug)]
pub struct FsBodyStore {
    root: PathBuf,
}

/// Unique-per-put storage key. Never identity-only `(symbol, et_date)`.
pub fn mint_body_locator(symbol: &str, et_date: &str, source_as_of_ns: i64) -> String {
    let mut nonce = [0u8; 8];
    rand::thread_rng().fill_bytes(&mut nonce);
    let symbol = symbol.trim().to_ascii_uppercase();
    format!(
        "{symbol}/{et_date}/{source_as_of_ns}-{nonce}.bin",
        nonce = hex::encode(nonce)
    )
}

impl FsBodyStore {
    /// Validate root is non-empty and usable. Creates `root` itself only after validation —
    /// never invents a different default path.
    pub fn open(root: &Path) -> AppResult<Self> {
        if root.as_os_str().is_empty() {
            return Err(AppError::Config("session archive body root empty".into()));
        }
        fs::create_dir_all(root).map_err(|e| {
            AppError::Config(format!("session archive body root unusable: {e}"))
        })?;
        Ok(Self {
            root: root.to_path_buf(),
        })
    }

    pub fn put(&self, locator: &str, body: &[u8]) -> AppResult<()> {
        let path = self.resolved(locator)?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let tmp = path.with_extension("bin.tmp");
        fs::write(&tmp, body)?;
        fs::rename(&tmp, &path)?;
        Ok(())
    }

    pub fn get(&self, locator: &str) -> AppResult<Vec<u8>> {
        let path = self.resolved(locator)?;
        fs::read(&path).map_err(|e| AppError::Config(format!("body object unreadable: {e}")))
    }

    pub fn delete_best_effort(&self, locator: &str) {
        if let Ok(path) = self.resolved(locator) {
            let _ = fs::remove_file(path);
        }
    }

    fn resolved(&self, locator: &str) -> AppResult<PathBuf> {
        if locator.is_empty()
            || locator.contains("..")
            || Path::new(locator).is_absolute()
        {
            return Err(AppError::Config("invalid body locator".into()));
        }
        Ok(self.root.join(locator))
    }
}
```

Wire `mod body_store;` in `mod.rs` (`pub(crate)` is enough).

- [ ] **Step 3:** tests PASS. Commit: `feat(session-archive): FsBodyStore unique-per-put leaf`.

**Reviewer probe:** two mints for identical `(symbol, et_date, source_as_of_ns)` differ; locator
traversal (`..`) rejected; error strings carry no S3/BYTEA product vocabulary.

---

### B3 — Index/body split inside Memory + Json `SessionChainArchive`

**Files:** `apps/api/src/services/session_chain_archive/store.rs`

**Why:** SPEC §2.2 write/load rules; list stays index-only; Memory keeps in-process bodies for
hermetic tests; Json stores locator metadata + FS bodies.

Cite live shapes to change (do not assume — read before editing):

- `StoredRow` currently carries `body: Vec<u8>` (`store.rs` ~43–50).
- `JsonRecord` currently carries `body_b64: String` (`store.rs` ~361–369).
- `insert_if_absent` currently writes body inline for Memory/Json/Postgres (`store.rs` ~137–175).

- [ ] **Step 1: failing tests** (extend `store.rs` `#[cfg(test)]` + temp FS for Json):

```rust
#[tokio::test]
async fn memory_second_insert_same_et_date_skips_body_put_and_keeps_first() {
    let store = SessionChainArchive::memory();
    // plant body A; plant body B same (T,D); load == A
    // additionally: spy/count — second call must not allocate a second locator entry
    // (assert via public load body equality + list len == 1)
}

#[tokio::test]
async fn json_open_without_body_root_fails_open_contract() {
    // open_json(index, ring, body_root=None|/conflict) → Err mentioning not storing / body root
}

#[tokio::test]
async fn json_put_then_load_reads_from_body_root_not_body_b64() {
    // after insert, symbol json file must NOT contain a large body_b64 of the chain;
    // must contain body_locator; file under BODY_ROOT must exist
}

#[tokio::test]
async fn load_missing_object_behind_locator_is_err_not_none() {
    // insert; delete body file; load → Err (maps to session book unreadable upstream)
}
```

Run → FAIL.

- [ ] **Step 2: implement minimally**

Index row shape (Memory/Json):

```rust
struct StoredRow {
    symbol: String,
    et_date: String,
    source_as_of: DateTime<Utc>,
    source_as_of_ns: i64,
    source: MarketDataSourceKind,
    body_locator: String,
    /// Legacy dual-read only; must be None after migrator clear/drop.
    legacy_body: Option<Vec<u8>>,
}
```

`JsonRecord` after cutover:

```rust
struct JsonRecord {
    symbol: String,
    et_date: String,
    source_as_of: String,
    source_as_of_ns: i64,
    source: MarketDataSourceKind,
    body_locator: String,
    /// absent after migrator; serde default None for dual-read window
    #[serde(default, skip_serializing_if = "Option::is_none")]
    body_b64: Option<String>,
}
```

Memory holds `bodies: HashMap<String, Vec<u8>>` beside the index map.

`insert_if_absent` algorithm (all enabled backends):

```rust
// 1) if index has (symbol, et_date) → return Ok(false)  // no body I/O
// 2) locator = mint_body_locator(symbol, et_date, source_as_of_ns)
// 3) body_store.put(&locator, body)?
// 4) index insert_if_absent(meta + locator); if lost → body_store.delete_best_effort(&locator); Ok(false)
// 5) else Ok(true)
```

`load`:

```rust
// miss index → Ok(None)
// if body_locator present → get; missing/corrupt → Err(Config("…"))  // route maps to unreadable
// else if legacy_body/body_b64 present → Ok(Some)   // dual-read window only
// else → Err unreadable (pointer without body)
```

`list`: metadata only — **never** call `body_store.get`.

Change `open_json` signature to take `body_root: &Path` (and ring path); validate via
`body_root_conflicts` + `FsBodyStore::open`.

Keep facade method signatures for callers unchanged.

- [ ] **Step 3:** unit tests PASS. Commit:
  `feat(session-archive): split Memory/Json index from body store`.

**Reviewer probe:** Json on-disk symbol file after fresh insert has `body_locator` and no
`body_b64` (or empty/absent); deleting the object file makes `load` return `Err`, not `Ok(None)`.

---

### B4 — Open wiring, plant seed, fail-open to not-storing

**Files:** `apps/api/src/state.rs`; `apps/api/src/services/session_chain_archive/store.rs`
(`open_postgres`, `plant_conformance_seed`); `apps/api/src/config.rs` if helpers still needed.

**Why:** SPEC §2.2 open-time misconfig / AC-8; live `open_session_chain_archive_store` today opens
Postgres **without** a filesystem root (`state.rs` ~360–376) — this ship adds that requirement.

- [ ] **Step 1: failing tests**

```rust
#[tokio::test]
async fn open_json_with_unset_body_root_yields_disabled_not_storing() {
    // drive open_session_chain_archive_json / public open helper with body_root None
    // → SessionChainArchive::Disabled (or Err mapped to Disabled at state layer)
    let store = /* open with enabled=true, body_root=None */;
    let err = store.list("SPY", None).await.unwrap_err();
    assert!(err.to_string().contains("session archive not storing"));
}

#[tokio::test]
async fn plant_conformance_seed_uses_body_store_path() {
    // open Json with temp BODY_ROOT; plant; assert body file exists under BODY_ROOT;
    // assert index row has locator; load returns seed body
}
```

- [ ] **Step 2: implement**

```rust
// state.rs — sketch
async fn open_session_chain_archive_json(config: &Config) -> SessionChainArchive {
    let Some(body_root) = config.session_chain_archive_body_root.as_ref() else {
        warn!("SESSION_CHAIN_ARCHIVE_BODY_ROOT unset; session archive not storing");
        return SessionChainArchive::disabled();
    };
    if crate::config::body_root_conflicts(
        body_root,
        &config.chain_snapshot_store_path,
        &config.session_chain_archive_store_path,
    ) {
        warn!("SESSION_CHAIN_ARCHIVE_BODY_ROOT conflicts with ring/index; session archive not storing");
        return SessionChainArchive::disabled();
    }
    match SessionChainArchive::open_json(
        &config.session_chain_archive_store_path,
        &config.chain_snapshot_store_path,
        body_root,
    )
    .await
    {
        Ok(store) => { /* plant seed; return */ store }
        Err(e) => {
            warn!(error = %e, "session archive store open failed; session archive not storing");
            SessionChainArchive::disabled()
        }
    }
}

#[cfg(feature = "postgres")]
async fn open_session_chain_archive_store(...) -> SessionChainArchive {
    if !config.session_chain_archive_enabled {
        return SessionChainArchive::disabled();
    }
    let Some(body_root) = config.session_chain_archive_body_root.as_ref() else {
        warn!("SESSION_CHAIN_ARCHIVE_BODY_ROOT unset; session archive not storing");
        return SessionChainArchive::disabled();
    };
    if body_root_conflicts(...) {
        return SessionChainArchive::disabled();
    }
    let bodies = match FsBodyStore::open(body_root) {
        Ok(b) => b,
        Err(e) => {
            warn!(error = %e, "session archive body store unusable; session archive not storing");
            return SessionChainArchive::disabled();
        }
    };
    if let Some(p) = pg {
        let store = SessionChainArchive::open_postgres(p, bodies);
        // migrator runs in B6 — call site reserved here or in B6
        let _ = store.plant_conformance_seed().await;
        return store;
    }
    open_session_chain_archive_json(config).await
}
```

`plant_conformance_seed` stays on the facade and must go through split `insert_if_absent` (put +
index) — do not INSERT BYTEA directly.

- [ ] **Step 3:** tests PASS. Commit:
  `feat(session-archive): require BODY_ROOT at open; fail-open not-storing`.

**Reviewer probe:** no `create_dir_all("data/session_chain_archive_bodies")` anywhere; unset env
→ exact not-storing on list/load; Postgres pool present but BODY_ROOT unset still Disabled.

---

### B5 — Postgres index locator column + adapter (dual-read window)

**Files:** `apps/api/src/db/migrations.rs` (v12); `apps/api/src/db/pg_session_chain_archive.rs`;
`store.rs` Postgres arm.

**Why:** Live migration 11 defines `body BYTEA NOT NULL` on `session_chain_archive`
(`migrations.rs` ~287–296). Live adapter INSERT/SELECT binds `body` (`pg_session_chain_archive.rs`
~35–49, ~95–128). This ship adds locator and stops retaining unbounded BYTEA after clear/drop.

- [ ] **Step 1: failing tests**

```rust
#[test]
fn session_archive_body_locator_migration_is_v12() {
    let (v, name, sql) = MIGRATIONS
        .iter()
        .find(|(_, n, _)| *n == "session_chain_archive_body_locator")
        .expect("v12 body_locator migration");
    assert_eq!(*v, 12);
    assert!(sql.contains("body_locator"));
    assert!(sql.contains("DROP NOT NULL") || sql.contains("body") && sql.contains("NULL"));
}
```

Plus a postgres-gated integration test (or Memory-equivalent already covered) that insert stores
locator and SELECT list does not require body bytes.

- [ ] **Step 2: implement migration v12**

```sql
-- v12 session_chain_archive_body_locator
ALTER TABLE session_chain_archive
  ADD COLUMN IF NOT EXISTS body_locator TEXT;
ALTER TABLE session_chain_archive
  ALTER COLUMN body DROP NOT NULL;
```

Update `PgSessionChainArchive`:

```rust
pub struct PgSessionChainArchive {
    pg: Pg,
    bodies: FsBodyStore,
}

pub async fn insert_if_absent(...) -> AppResult<bool> {
    // 1) SELECT 1 FROM session_chain_archive WHERE symbol=$1 AND et_date=$2
    //    if Some → Ok(false)  // no body I/O
    // 2) locator = mint_body_locator(...); self.bodies.put(&locator, body)?;
    // 3) INSERT (symbol, et_date, source_as_of, source_as_of_ns, source, body_locator)
    //    ON CONFLICT DO NOTHING
    //    — do NOT bind chain bytes into body
    // 4) if rows_affected==0 { self.bodies.delete_best_effort(&locator); Ok(false) } else Ok(true)
}

pub async fn list(...) -> AppResult<Vec<SessionBookMeta>> {
    // SELECT symbol, et_date, source_as_of, source  — no body, no body I/O
}

pub async fn load(...) -> AppResult<Option<StoredSessionBook>> {
    // SELECT … body_locator, body
    // None row → Ok(None)
    // if body_locator present → bodies.get; Err on missing/corrupt
    // else if body Some(bytes) → dual-read Ok(Some)   // pre-migrator only
    // else → Err(Config("body object unreadable: missing"))
}
```

- [ ] **Step 3:** migration unit test PASS; `cargo test -p api-rust --features postgres` where
  available. Commit: `feat(session-archive): v12 body_locator postgres index`.

**Reviewer probe:** fresh INSERT after cutover writes `body_locator` and leaves `body` NULL; list
SQL has no `body` column; ring table `chain_snapshots.body` untouched.

---

### B6 — Migrator clear/drop (DoD for AC-1/2)

**Files:** `apps/api/src/services/session_chain_archive/migrate.rs` (**create**);
`store.rs` / `state.rs` boot hook; Json load/persist path.

**Why:** SPEC §2.4 — finishing migrator clear/drop so GATE Q can observe bodies off app OLTP;
dual-read alone is not enough.

- [ ] **Step 1: failing tests**

```rust
#[tokio::test]
async fn migrator_moves_json_body_b64_then_omits_it() {
    // hand-write a legacy symbol json with body_b64; open store+migrator;
    // assert body file under BODY_ROOT; re-read json → body_locator set, body_b64 absent;
    // load succeeds
}

#[tokio::test]
async fn migrator_clears_postgres_body_bytes() {
    // (postgres or sqlx test) row with body BYTEA + null locator → after migrate:
    // body_locator set; body IS NULL; load via FS succeeds
}

#[tokio::test]
async fn post_migrator_db_bytes_not_proportional_to_chain_size() {
    // archive N large bodies; assert sum of PG body octet_length is 0 (or column dropped);
    // assert FS total size grows with chain bytes (AC-1/2)
}
```

- [ ] **Step 2: implement**

```rust
/// Idempotent: for each index row/file still holding inline body, put → write locator → clear inline.
pub async fn migrate_inline_bodies(archive: &SessionChainArchive) -> AppResult<MigrateReport> {
    // Json: for each entry with body_b64 Some → mint, put, set locator, body_b64=None, persist
    // Postgres:
    //   SELECT symbol, et_date, source_as_of_ns, body FROM session_chain_archive
    //     WHERE body IS NOT NULL AND (body_locator IS NULL OR body_locator = '')
    //   for each: put unique locator; UPDATE SET body_locator=$l, body=NULL WHERE … AND body IS NOT NULL
    // Optional final: ALTER TABLE … DROP COLUMN body  (preferred DoD so BYTEA cannot return)
}
```

Call from open path after successful FS+index open (boot-idempotent). Corrupt legacy rows: leave
honest unreadable on load — **never** Massive refill.

If dropping the column, add migration **v13** `session_chain_archive_drop_body` that runs only
after the in-process migrator has cleared rows **or** combine: migrator NULLs all bodies, then
v13 `DROP COLUMN IF EXISTS body`. Prefer explicit drop so AC-1/2 observation is structural.

- [ ] **Step 3:** tests PASS. Commit:
  `feat(session-archive): migrator clear/drop inline BYTEA and body_b64`.

**Reviewer probe:** re-running migrator is a no-op; a row with locator + NULL body does not
re-put; GATE Q can assert `body` column absent or all-NULL and FS holds bytes.

---

### B7 — Integration harness (AC-1–12, 17, 18, 24 core)

**Files:** `apps/api/tests/chain_archive_object_store.rs` (**create**); update
`apps/api/tests/session_chain_archive.rs` only where Memory assumptions break.

**Why:** SPEC §7 prefers one high-level pass over per-AC micro-harnesses.

- [ ] **Step 1: write failing harness** covering:

1. Archive `(T, D)` under Json+temp `BODY_ROOT` → identity listable → body file under root →
   index file has no full `body_b64` (AC-1/2/4).
2. Load returns mandatory `source_as_of`; research route `vendor_called=false` / counter 0 (AC-3/24).
3. Miss identity → exact `no session book…` (AC-5); delete object → load maps to
   `session book unreadable:` (AC-6); corrupt bytes → unreadable (AC-7).
4. Unset/conflict `BODY_ROOT` → Disabled → exact `session archive not storing` (AC-8).
5. Concurrent `insert_if_absent` two tasks same `(T,D)` different bodies → load == **first** body;
   locators differ; winner object not overwritten (AC-9).
6. No date substitution on miss (AC-10); ring miss string still `no stored snapshot for` in
   `research_chain_snapshots.rs` (AC-11 cite).
7. Legacy body_b64/BYTEA row migrates and loads OR unreadable — never Massive (AC-12).
8. Score triple unchanged with archive on vs Disabled (AC-17); body bytes contain no `apikey`
   (AC-18).

Run → FAIL.

- [ ] **Step 2: implement only what B3–B6 missed until harness green.** Prefer fixing store/migrator
  over softening assertions.

- [ ] **Step 3:** `cargo test -p api-rust --test chain_archive_object_store -- --nocapture` exit 0.
  Commit: `test(session-archive): object-store AC harness`.

**Reviewer probe:** AC-9 must race real concurrent tasks (`tokio::join!`), not serial inserts only;
missing object must not return HTTP/store miss.

---

### B8 — Isolation / Non-move / structural backend guards

**Files:** `apps/api/tests/chain_archive_object_store_isolation.rs` (**create**).

**Why:** AC-13/14/16/19/22 + guardrails; ring Non-move must be **named and enforced by scan**.

- [ ] **Step 1: failing tests**

```rust
#[test]
fn ring_store_and_pg_chain_snapshot_still_colocate_body() {
    let ring = fs::read_to_string(workspace_root().join("apps/api/src/services/chain_snapshot/store.rs")).unwrap();
    assert!(ring.contains("body_b64"));
    let mig = fs::read_to_string(workspace_root().join("apps/api/src/db/migrations.rs")).unwrap();
    // chain_snapshots migration still has body BYTEA; no ring body_locator migration this ship
    assert!(mig.contains("chain_snapshots"));
    assert!(!mig.contains("chain_snapshots_body_locator"));
}

#[test]
fn retention_dials_unchanged_at_48_and_14d() {
    let cfg = fs::read_to_string(workspace_root().join("apps/api/src/config.rs")).unwrap();
    assert!(cfg.contains("env_u64(\"CHAIN_SNAPSHOT_MAX_PER_SYMBOL\", 48)"));
    assert!(cfg.contains("env_u64(\"CHAIN_SNAPSHOT_MAX_AGE_SECS\", 1_209_600)"));
}

#[test]
fn score_path_does_not_import_body_store() {
    // quant-engine + compute_analytics_from_vendor must not name session_chain_archive::body_store
}

#[test]
fn trader_routes_do_not_open_body_store() {
    for rel in ["apps/api/src/routes/ticker.rs", "apps/api/src/routes/scan.rs", /* sse */] {
        let src = fs::read_to_string(workspace_root().join(rel)).unwrap();
        assert!(!src.contains("FsBodyStore"));
        assert!(!src.contains("SESSION_CHAIN_ARCHIVE_BODY_ROOT"));
        assert!(!src.contains("session-books"));
    }
}

#[test]
fn research_routes_have_no_storage_backend_product_vocab() {
    let src = fs::read_to_string(
        workspace_root().join("apps/api/src/routes/research_session_books.rs"),
    ).unwrap();
    for banned in ["S3", "object store", "BYTEA", "Railway volume", "off Postgres"] {
        assert!(!src.contains(banned), "banned chrome: {banned}");
    }
    assert!(src.contains("session archive not storing"));
    assert!(src.contains("session book unreadable:"));
}

#[test]
fn archive_best_effort_still_swallows_errors() {
    // read archive.rs — still warn "session archive write skipped — trader path unchanged"
}
```

- [ ] **Step 2:** make scans accurate (anti-vacuity: files exist; positive asserts on live strings).

- [ ] **Step 3:** PASS. Commit: `test(session-archive): object-store isolation and ring Non-move`.

**Reviewer probe:** a poisoned `chain_snapshots_body_locator` string in migrations must fail the
Non-move test; trader route scan must be non-vacuous (files exist).

---

## Frontend / infra track

### F1 — Pages `/api/_research` 404 non-regression (AC-16)

**Files:** `apps/dashboard/src/app/chain-archive-object-store.structural.spec.ts` (**create**);
`functions/api/[[path]].ts` (**verify only**).

**Why:** SPEC AC-16 — Pages trader origin must keep 404 on `/api/_research` like `_metrics`. Cite
live `functions/api/[[path]].ts` lines 45–52.

- [ ] **Step 1: failing/red if Pages regresses** — mirror
  `session-chain-archive.structural.spec.ts` F1 block:

```ts
describe('F1 · Pages 404 /api/_research (AC-16)', () => {
  it('same 404 branch covers /api/_research and session-books subpaths', () => {
    const src = readFileSync(PAGES_FN, 'utf8');
    expect(pagesSourceBlocksResearch(src)).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research/session-books/SPY/book')).toBe(true);
  });
  it('mutation — omitting _research from the 404 if makes the guard fail', () => {
    /* metrics-only snippet → false; both → true */
  });
});
```

- [ ] **Step 2:** do **not** change Pages unless the guard is already broken (it is not). No product
  UI.

- [ ] **Step 3:** `npx nx test @convexa/dashboard --testPathPattern=chain-archive-object-store`
  → PASS for F1. Commit: `test(fe): chain-archive-object-store Pages 404 guard`.

**Reviewer probe:** mutation test proves the scanner bites.

---

### F2 — Trader-chrome + storage-backend vocabulary absence (AC-15)

**Files:** same structural spec as F1.

**Why:** `NO_UI_CHANGE` + hard ban on storage-backend chrome (SPEC §4).

- [ ] **Step 1: extend structural spec**

```ts
const TRADER_FORBIDDEN = [
  '/api/_research',
  'session-books',
  'session_chain_archive',
  'SESSION_CHAIN_ARCHIVE_BODY_ROOT',
  'object store',
  'object-store',
  'Railway volume',
  'BYTEA',
  'session bodies moved',
  'loaded from S3',
  'S3',
] as const;

describe('F2 · no storage / session-archive chrome on trader sources (AC-15)', () => {
  it('dashboard production sources carry none of the forbidden needles', () => {
    const offenders: string[] = [];
    for (const [path, src] of Object.entries(DASHBOARD_SOURCES)) {
      const hits = TRADER_FORBIDDEN.filter((n) => src.includes(n));
      if (hits.length) offenders.push(`${path} → ${hits.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });
  it('does not add trader pages for object-store / session-archive browse', () => {
    expect(existsSync(resolve(DASHBOARD_APP, 'pages', 'chain-archive-object-store'))).toBe(false);
    expect(existsSync(resolve(DASHBOARD_APP, 'pages', 'session-books'))).toBe(false);
  });
  it('libs/api has no session-books / body-root helper', () => {
    const src = readFileSync(CONVEXA_CLIENT, 'utf8');
    expect(CLIENT_FORBIDDEN.filter((n) => src.includes(n))).toEqual([]);
  });
});
```

Include anti-vacuity (glob sees pages/features/shell) and a mutation note: temporarily inserting
`BYTEA` into a scanned fixture string must fail — keep the mutation inside the spec as a pure
function test like session-chain-archive.

- [ ] **Step 2:** no dashboard product edits.

- [ ] **Step 3:** typecheck + test PASS. Commit:
  `test(fe): chain-archive-object-store NO_UI_CHANGE structural`.

**Reviewer probe:** `git diff --name-only -- apps/dashboard` shows only the structural spec (and
nothing under `pages/` / `features/` / `shell/` product files).

---

## Verification track

Run after B8 + F2. Read-only — no feature code changes unless a gate exposes a real defect (then
bounce to the owning track).

### V1 — API unit/integration suite

```powershell
npx nx test api
# or: cargo test -p api-rust -p quant-engine
echo $LASTEXITCODE   # expect 0
```

Expect: exit 0 including `chain_archive_object_store`, `chain_archive_object_store_isolation`,
existing `session_chain_archive*`, `liquid_names_session_capture*`.

### V2 — FE structural + typecheck

```powershell
npx nx test @convexa/dashboard --testPathPattern=chain-archive-object-store
npx nx typecheck @convexa/dashboard
echo $LASTEXITCODE   # expect 0 both
```

Expect: F1/F2 green; no product UI files in the feature diff.

### V3 — Bodies off OLTP observation (AC-1/2)

Re-run the harness tests that assert post-migrator Postgres `body` NULL/absent and FS growth.
If postgres feature unavailable locally, record UNVERIFIABLE for the PG half and still require the
Json clear/drop half green.

### V4 — Interface conformance re-pin

```powershell
npm run ports:free
# serve api with SESSION_CHAIN_ARCHIVE_ENABLED=true and a real SESSION_CHAIN_ARCHIVE_BODY_ROOT
node .grok/tools/gates.mjs interface_conformance --contract .spire/clusters/tech/contracts/chain-archive-object-store/INTERFACE_CONTRACT.md --url http://127.0.0.1:8000
```

Expect: PASS on list/miss/load shapes; hit-probe uses dedicated `(SPY, 2020-01-02)` seed via split
path — UNVERIFIABLE only if seed cannot run.

### V5 — Review ACs (19–23, 25) + named ring residual

Checklist (no code):

- [ ] AC-19: retention dials still 48 / 1_209_600
- [ ] AC-20: no Massive hist-chain purchase
- [ ] AC-21: no AI-rec lab P4 / corpus-wait completion / chore absorption
- [ ] AC-22: SPEC/decisions/plan explicitly name 48-ring Non-move + residual
- [ ] AC-23: operator verify via `/api/_research/session-books/...` without trader UI
- [ ] AC-25: Path-B tools still open the same `SessionChainArchive` facade

### V6 — Diff fence

```powershell
git diff --name-only -- apps/dashboard
git diff --name-only -- apps/api/src/services/chain_snapshot apps/api/src/db/pg_chain_snapshot.rs
```

Expect: dashboard = structural spec only (or empty); chain_snapshot / pg_chain_snapshot **empty
diff** (Non-move).

---

## Task ↔ AC map (quick)

| AC | Tasks |
|---|---|
| AC-1/2 bodies off OLTP + clear/drop | B5, B6, B7, V3 |
| AC-3/4 load+list zero Massive | B3, B7, V4 |
| AC-5–8 miss/unreadable/not-storing/BODY_ROOT | B2–B4, B7, V4 |
| AC-9 unique-per-put first-wins | B2, B3, B7 |
| AC-10–12 honesty/cutover | B6, B7 |
| AC-13/14 desk isolation | B8, archive.rs unchanged swallow |
| AC-15/16 no trader chrome / no redistribution | F1, F2, B8, V2/V6 |
| AC-17/18 score + secrets | B7, B8 |
| AC-19/22 ring Non-move + no cap raise | B8, V5, V6 |
| AC-20/21/23/25 review scope | V5 |
| AC-24 `authorizes: nothing` | B7, V4 |

---

## Planning notes for lanes (not open questions)

- **Memory vs FS:** Memory uses an in-process map so unit tests stay hermetic without `BODY_ROOT`.
  Json + Postgres require `SESSION_CHAIN_ARCHIVE_BODY_ROOT` at open.
- **Locator format:** `{SYMBOL}/{et_date}/{source_as_of_ns}-{8-byte-hex}.bin` via `rand` + existing
  `hex` crate — no new uuid dependency.
- **Ring residual:** accepted and named; do not “helpfully” migrate ring bodies.
- **Facade stability:** `archive_session_best_effort` / ensure / research HTTP signatures stay;
  internals gain put+locator.
