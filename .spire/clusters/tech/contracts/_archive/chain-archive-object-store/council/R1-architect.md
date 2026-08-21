# R1 — architect position: chain-archive-object-store

## Position

### Problem (verified at source)

Session-archive **bodies** today sit beside identity metadata:

- `SessionChainArchive` (`apps/api/src/services/session_chain_archive/store.rs`) is an enum
  `Disabled | Memory | Json | Failing | Postgres`. `StoredRow` / `JsonRecord` carry
  `body: Vec<u8>` / `body_b64` in the same structure as `(symbol, et_date, source_as_of, source)`.
- `PgSessionChainArchive` (`apps/api/src/db/pg_session_chain_archive.rs`) `INSERT`s and `SELECT`s
  column `body` as raw bytes; migration 11 (`apps/api/src/db/migrations.rs`) defines
  `body BYTEA NOT NULL` on `session_chain_archive`.
- Boot (`apps/api/src/state.rs` `open_session_chain_archive_store`) prefers Postgres when the
  pool exists, else `open_json` under `SESSION_CHAIN_ARCHIVE_STORE_PATH` (sibling of the ring
  path; path-conflict guard already rejects nest/equal with `chain_snapshot_store_path`).
- Parallel ring `ChainSnapshotStore` (`apps/api/src/services/chain_snapshot/store.rs`) and
  `pg_chain_snapshot` likewise store full-chain `body` / `body_b64` / BYTEA under dual
  retention (14d + 48/symbol). Local unthinned ring was observed at **3.77 GB for one day**
  (BRIEF). That is the disk-pressure precedent; this feature’s failure mode is weeks of
  **session** books filling the **app Postgres** OLTP volume.

Research list/load already returns metadata + body with mandatory `source_as_of` and
`vendor_called=false`; missing identity is `no session book`, bad/missing body bytes are
`session book unreadable` — never a Massive refill (live `research_session_books.rs`).

### Chosen shape — pointer index + filesystem body store (Railway volume / env path)

**Mechanism:** keep `SessionChainArchive` as the facade callers already hold
(`insert_if_absent` / `list` / `load` / `plant_conformance_seed`). Split **index content** from
**body bytes**:

1. **Index (Postgres row or thin Json metadata file)** holds only identity + provenance:
   `(symbol, et_date)` PK, `source_as_of`, `source_as_of_ns`, `source`, and a **body locator**
   (opaque storage key derived deterministically from `(symbol, et_date)` — not chain bytes).
   List stays index-only (no body I/O), matching today’s `SessionBookMeta` content.
2. **Body object store** is a new one-way leaf port behind the facade — put/get/delete-by-key
   of opaque byte blobs. **This ship’s only prod adapter is filesystem:** root directory from
   env (Railway volume mount or local path). Bodies are files under that root keyed by the
   locator. Local/dev without Postgres continues to use the same split under the existing
   archive dir family (thin metadata + sibling body files), so workspace JSON stops absorbing
   unbounded `body_b64`.
3. **Write path:** `insert_if_absent` first-wins on the index PK. Mechanism: if the identity
   already exists, return `Ok(false)` without body I/O; if absent, `put` body bytes under the
   locator, then insert the index row with that locator (`ON CONFLICT DO NOTHING` / in-memory
   map check). Conflict after a successful put leaves an orphan blob — acceptable; best-effort
   delete-on-conflict may run but must not fail the caller. `archive_session_best_effort`
   continues to swallow all errors so the ring append / trader path is unchanged
   (`archive.rs` already warns and returns).
4. **Research load path:** index lookup → if miss, `no session book`; if hit, `get` body by
   locator → if missing/corrupt, `session book unreadable`; on success return
   `StoredSessionBook { meta (incl. source_as_of), body }` with zero Massive. List never opens
   body objects.
5. **Trader / score isolation:** bundle, SSE, signals, quant-engine, fingerprint, and gate
   continue to import **zero** `session_chain_archive` (existing isolation tests). Liquid-name
   ensure stays on the off-path `Notify` worker; it may await body I/O because it is not the
   trader request path. Capture’s post-append `archive_session_best_effort` remains
   fire-and-forget relative to the caller’s success. **No trader request awaits object I/O.**

**Prod adapter named:** **Railway volume (or any host path) via env-configured filesystem
root** — not S3 this ship.

| Option | Complexity | Cost | Scalability (BRIEF load) | Team familiarity |
| --- | --- | --- | --- | --- |
| A. Pointer + FS / Railway volume | Low — path I/O, no new cloud SDK | Volume disk only; secrets = none beyond existing deploy env | Weeks of session books for liquid trio + incidental symbols — fits | High — mirrors live `Json` dir + `SESSION_CHAIN_ARCHIVE_STORE_PATH` |
| B. Pointer + S3-compatible | Higher — new crate, creds, retries, IAM | Object $ + review surface | Unbounded retention easier | Low — no `object_store` / AWS SDK in `apps/api/Cargo.toml` today |

**Decisive axis:** complexity + team familiarity under BRIEF-scale retention (corpus wait is
4–6 ET weeks, not terabytes). S3 remains a deferred second adapter on the same body-store
port if retention or multi-host sharing outgrows one volume — not in this ship’s build.

### 48-ring this ship

**Non-move.** `ChainSnapshotStore` / `pg_chain_snapshot` keep co-located BYTEA / `body_b64`
under the existing 14d + 48/symbol prune. Mechanism for leaving it: the ring is already
**bounded**; the session archive is **prune-proof and unbounded by design**, so it is the
OLTP-disk failure mode. Moving the ring is an explicit non-goal here (may be a later feature
if volume pressure returns inside the cap).

### Migration of existing Postgres BYTEA / Json `body_b64`

**Mechanism:** additive schema/index change that introduces the locator; a one-shot (or
boot-idempotent) migrator reads each row/file that still has inline body, `put`s bytes to the
body store, writes the locator, then clears/drops the inline body column/field so the app DB
no longer retains chain BYTEA. Dual-read during the cutover window: if locator present, load
from body store; else if legacy inline body still present, serve it (research-only). After
backfill proof, inline body storage is removed. Corrupt/unreadable legacy rows become
`session book unreadable`, not Massive refill.

### Component boundaries

| Component | Owns | Must not |
| --- | --- | --- |
| `SessionChainArchive` facade | first-wins identity API callers already use | vendor SDK; score/signals |
| Index adapter (Postgres / thin Json) | metadata + locator only | store chain BYTEA after migration |
| FS body store | opaque put/get/delete under env root | know MarketData / Massive; sit on trader routes |
| `archive_session_best_effort` / ensure worker | off-path / best-effort writers | fail trader HTTP on body errors |
| Research load (existing route surface) | index+body assemble; closed miss/unreadable/not-storing vocabulary | call Massive; invent new outcome collapse |

### Isolation / error rules

- **`[operator-vs-trader-path-separation]`:** body I/O belongs to research load + off-path
  archive/ensure writers. Trader bundle/SSE/ticker routes do not open the body store.
- **`[best-effort-isolated-or-null]`:** archive write failures stay swallowed at
  `archive_session_best_effort`; they never become trader HTTP errors or score inputs.
- **`[additive-keeps-score-byte-identical]`:** no import from signals/score/fingerprint/gate;
  opportunity_score / tier / `state_fingerprint` untouched.
- **`[absent-is-not-none]`:** keep four distinct outcomes — `no session book` ≠
  `session book unreadable` ≠ `session archive not storing` ≠ ring `no stored snapshot`. A
  locator with a missing object is **unreadable**, not “no book,” and not a vendor miss.
- **`[no-secrets-in-image]`:** body-root path and any future object credentials are runtime
  env only; image carries no bucket keys or `.env`.
- **`[cited-code-is-verified-not-assumed]`:** claims above cite live
  `session_chain_archive/store.rs`, `pg_session_chain_archive.rs`, `chain_snapshot/store.rs`,
  `migrations.rs` v11, `state.rs` open helper, `archive.rs` best-effort, and research load
  outcomes — not Python-era paths. Context pack §2 still narrates FastAPI; production backend
  is Axum/`api-rust` (Claude.md / `project.json`).

### Explicit non-goals

- P7 vendor hist-chain / Massive historical product.
- Raising the 48 ring cap.
- Moving ring snapshot bodies off BYTEA/JSON this ship.
- S3-compatible adapter implementation this ship (port may be shaped to allow it later).
- Live scoring, AI lab / P4, trader UI, copy, or endpoint/payload redesign (`NO_UI_CHANGE`).
- Rewriting Path-B CLIs beyond opening the same `SessionChainArchive` facade.

### Binding constraints restated

Domain: research list/load remains **zero Massive** with mandatory `source_as_of` on every
successful session-book load; first-wins `(symbol, et_date)` America/New_York identity;
48-ring prune still cannot delete session books (no FK / no shared prune API — live store has
**no prune method**). Promoted build invariants named above apply unchanged.

## Risks I see

1. **Orphan bodies after first-wins race** — two writers put bodies then one index insert
   loses; disk leaks unless a periodic sweeper or delete-on-conflict exists. Mechanism debt:
   either accept orphans until an operator GC, or best-effort delete of the losing locator.
2. **Partial migration** — dual-read forgotten on one code path could serve empty/wrong body
   or collapse unreadable→miss. Needs a structural test: poison locator / missing file →
   unreadable, not Massive.
3. **Ensure / promote latency** — off-path worker now does FS body put; still must not be
   wired onto trader request await points. Regression risk if someone `await`s archive from
   the serve cold path without best-effort wrapping.
4. **Volume vs Postgres coupling** — FS root misconfigured in prod yields `unreadable` for
   every book while index rows look healthy; deploy must treat body-root as required when
   archive is enabled (fail-open to `not storing` at open time is preferable to silent empty
   gets — attackable detail for PLAN).
5. **Context drift** — PROJECT_CONTEXT §2 still documents Python; implementers citing pack
   prose instead of Rust stores will attach to dead paths (`[cited-code-is-verified-not-assumed]`).

## Assumptions I'm making about the other two lanes

- **PM** will treat “Postgres table for a session identity does not retain chain BYTEA after
  migration” and “research load still returns body + `source_as_of` with `vendor_called=false`”
  as acceptance criteria, and will not expand scope to ring-body migration or hist-chain in
  this feature’s AC set.
- **PM** will accept filesystem / Railway volume as the named prod body backend for this ship
  (S3 deferred), falsifiable if product requires multi-host shared object storage before the
  4–6 week corpus completes.
- **UX** will uphold `NO_UI_CHANGE`: no trader-facing layout, chrome, or copy work; research
  outcome vocabulary stays the existing closed set (`no session book` / `session book
  unreadable` / `session archive not storing`) without new trader surfaces.
- **UX / PM** will not ask Architect for endpoint paths, JSON field names, or response
  envelope edits — those stay with the existing research surface and R4 interface synthesis.
- **PM** will keep Path-B CLI compatibility framed as “open the same store facade,” not a
  separate product surface, so Architect need not redesign CLI argument shapes.
