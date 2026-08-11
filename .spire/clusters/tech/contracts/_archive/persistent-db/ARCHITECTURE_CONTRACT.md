# persistent-db — ARCHITECTURE CONTRACT

> Feature: **persistent-db**. Entry role: Architect (architect-first). **Infra fast-path — PM/UX
> skipped** (no product surface, `NO_INTERFACE_CHANGE`, `NO_UI_CHANGE`). This document is BOTH the
> technical-shape contract AND the build spec for the backend executioner.
>
> Goal: add a **persistent Postgres adapter** behind the EXISTING four auth store ports so
> accounts / sessions / per-user settings / encrypted AI keys survive restarts and span replicas,
> selected by the existing env factory (`ACCOUNT_STORE=postgres` + `DATABASE_URL`). **In-memory
> SQLite stays the default.** Storage-only — no app/scoring/endpoint/UI change.
>
> Lane note: backend-only. Author **correct-by-construction** — there is **no Postgres instance in
> this environment**, so live-DB verification is **deferred** to the owner (same pattern as Docker
> not being installed for `containerize-apps`). See §10 for the review checks that stand in and the
> runtime-verify steps the owner runs.

---

## 0. Restated binding constraints (the invariant watch)

These are restated verbatim-in-spirit and are BINDING on the build. Each is mapped to its
enforcement below.

- **`[additive-keeps-score-byte-identical]`** — this is a **storage-only** swap. The auth
  subpackage is a **one-way leaf** (`engine`/`signals`/`live`/`darkpool`/`chain_store`/the
  bundle-compute path NEVER import it; `main.py` is the sole orchestration boundary — CONTEXT §2/§5).
  The trading/bundle/SSE path is **stateless and never touches the DB**. `opportunity_score` /
  `opportunity_tier` / `state_fingerprint` / the entry gate stay **byte-identical** (24 / actionable /
  `79373ef9194e`, the user-accounts + byo-ai-key fixtures). Enforcement: the new adapter lives ONLY in
  `src/auth/`, imports only stdlib + its driver, and is reachable only through the four ports. (§6, §11)
- **`[best-effort-isolated-or-null]` — the AUTH carve-out** — auth is a real-HTTP-status class
  (`src/auth/errors.py`), NOT a null-on-failure bundle computation. A **DB outage** degrades the
  **auth subsystem** to its error class (signup/login → **503 `auth_unavailable`**; who-am-I /
  gated-action resolution → **treat-as-anonymous**, fail-closed) and **MUST NOT take down the
  anonymous bundle/SSE/trading path** (which never opens a DB connection). Auth fails **closed** —
  never silently grants access on a DB fault. (§5)
- **`[secret-encrypted-at-rest]`** — per-user AI keys move into Postgres **still as ciphertext**.
  `src/auth/crypto.py` (Fernet) encrypts BEFORE the store; the DB column holds only the ciphertext
  token + the non-secret masked `last4`. The encryption key (`AI_KEY_ENCRYPTION_KEY`) stays
  server-side env and is **never** written to the DB. The adapter NEVER decrypts. (§3.4, §8)
- **`[no-secrets-in-image]`** — `DATABASE_URL` (and any DB credentials) are injected at **runtime
  via env**, never baked into an image, never committed. Adds a `DATABASE_URL` row to
  `apps/api/.env.example` (value-less) and is `.dockerignore`d like the rest of `.env*`. (§4, §9)
- **`[server-side-gate-enforcement]`** — **unaffected**. Gating stays server-side (the `main.py`
  gate + the credential-endpoint signed-in checks are untouched); only the store backend changes. (§5)

**No durable-data migration.** The in-memory store has no durable data (it is empty every boot), so
Postgres starts on a **fresh schema**. There is nothing to back-fill or convert. (§3.6)

---

## 1. Adapter shape & driver (the pivotal call)

### 1.1 Shape: RAW SQL mirroring `sqlite_store.py` (NOT an ORM)
**Decision: raw parameterized SQL, mirroring `sqlite_store.py` one-to-one.** Add
`src/auth/postgres_store.py` as a sibling of `sqlite_store.py`, implementing the same four port
classes (`PgUserStore` / `PgSessionStore` / `PgUserSettingsStore` / `PgUserCredentialStore`) + a
`make_stores(database_url: str) -> AuthStores`.

Rationale:
- The schema is **4 tiny tables, ~15 columns, single-row keyed reads/writes** — there is no relational
  graph, no query-builder need, no migrations-heavy domain. An ORM is dead weight here.
- The existing adapter is **raw SQL**; mirroring it keeps the two adapters **behaviorally
  diff-able line-by-line** (the port-contract test in §10 runs the SAME assertions against both).
  An ORM would diverge the styles and obscure the parity review that substitutes for live-DB verification.
- The brief's steer: "lean toward matching the existing raw-SQL style unless ORM clearly pays off."
  It does not pay off. **No SQLAlchemy.**
- Param style: psycopg uses `%s` placeholders (vs sqlite3's `?`). The SQL strings differ ONLY in
  placeholder + the few dialect items in §3.5; the record-mapping helpers (`_row_to_user`, etc.) are
  structurally identical.

### 1.2 Driver & concurrency model: psycopg3 (sync) — MATCH the existing model
**Decision: psycopg 3 (`psycopg[binary]`) in SYNCHRONOUS mode. NOT asyncpg, NOT async.**

The concurrency model the adapter must match (verified in the shipped code):
- The auth stores are called from request handlers **synchronously** (e.g. `router.py` calls
  `svc.resolve_session(...)` directly in an `async def` without `await` on the store; `service.py`
  calls `self.stores.users.get_by_email(...)` synchronously). The ports are **sync ABCs** (`ports.py`).
- The in-memory adapter is a **lock-guarded synchronous** sqlite3 connection.
- Bundle COMPUTE runs in `asyncio.to_thread` (`main.py`), but that path never touches auth.

Therefore the Postgres adapter MUST keep the ports **synchronous** so it is a true drop-in. An async
driver (asyncpg) would force `await` into the port signatures and ripple through `service.py` /
`router.py` / `main.py` — that is a rewrite, not a swap, and would break the byte-identity guarantee
by churning the leaf. psycopg3 sync is the correct match.

Auth-call volume is tiny (a few small queries per request), and they run inside FastAPI's request
handling — synchronous DB calls there are acceptable for this surface (the heavy work is the bundle,
which is unaffected). The executioner SHOULD run blocking auth store calls the same way they run
today (directly in the handler); if the owner later wants them off the event loop, wrapping the
synchronous store calls in `to_thread` is a future optimization and out of scope here.

### 1.3 Connection pooling: `psycopg_pool.ConnectionPool` (sync pool)
**Decision: a single process-wide `psycopg_pool.ConnectionPool`**, created once when
`make_stores(database_url)` is first called (mirrors the single-shared-connection lifetime of
`_SharedDB` in `sqlite_store.py`, but as a pool because Postgres connections are real network
sockets and replicas/threads need concurrency).

- Pool sized modestly (default `min_size=1`, `max_size` small, e.g. 5–10 — operator-overridable via an
  env like `DATABASE_POOL_MAX` with a sane default; the executioner picks the exact knob name as it is
  pure operator config, NOT an interface). Each operation does `with pool.connection() as conn:` →
  `with conn.cursor() as cur:`. **No module-level long-lived single connection** (that was correct for
  `:memory:`; it is wrong for a networked DB across threads/replicas).
- The pool REPLACES the `_SharedDB` lock for serialization: Postgres handles concurrency server-side
  (MVCC + row locks), so the coarse module lock is NOT carried over. Concurrency correctness is via
  **transactions + atomic SQL** (§6), not a process lock.
- Pool creation is **lazy + best-effort at construction**: `make_stores` may build the pool with
  `open=False` / non-blocking open so that an unreachable DB at boot does NOT crash the process —
  the fault surfaces on first use as the auth error class (§5). (The executioner confirms psycopg_pool's
  open semantics; the requirement is: a dead DB at boot must not crash boot, it must fail the gated
  action.)

### 1.4 New dependencies (`apps/api/requirements.txt`)
Add, in a new `# --- persistent-db (Postgres auth store; server-side only) ---` block:
- **`psycopg[binary]`** — psycopg 3, the sync Postgres driver (binary wheel → no local build toolchain
  on Windows/slim image).
- **`psycopg-pool`** — the connection pool (`psycopg_pool.ConnectionPool`).

NO migration-framework dependency is added (see §3 — schema bootstrap is idempotent DDL, no Alembic).
NO ORM dependency. These are used ONLY inside `src/auth/` — the leaf boundary holds.

---

## 2. Module layout & the env-factory wiring

- **New file:** `apps/api/src/auth/postgres_store.py` — the adapter (the four port impls + the schema
  bootstrap + `make_stores(database_url)`). Imports stdlib + `psycopg` + `psycopg_pool` + the leaf's
  own `ports`/`errors`. NEVER imports the scoring path.
- **Edited file:** `apps/api/src/auth/__init__.py` — register the new factory in `_STORE_FACTORIES`
  (the ONLY wiring change). The in-memory path is untouched.
- **Edited file:** `apps/api/requirements.txt` — the two deps (§1.4).
- **Edited file:** `apps/api/.env.example` — value-less `DATABASE_URL=` (+ optional pool knob), with a
  comment that it is required only when `ACCOUNT_STORE=postgres`.
- **Edited file:** `apps/api/.env.example` / docs — the **stable-key requirement** note (§8).
- **No other files change.** `ports.py`, `sqlite_store.py`, `service.py`, `router.py`, `crypto.py`,
  `cookies.py`, `passwords.py`, `google_oauth.py`, `errors.py`, and ALL of `main.py`'s auth wiring are
  **untouched** — the swap is contained to one new adapter + one factory line.

The records in `ports.py` ARE the contract (CONTEXT §2). The Postgres adapter MUST return the exact
same dataclasses (`UserRecord` / `SessionRecord` / `SettingsRecord` / `CredentialRecord`) with the
same field types, the same None semantics, and the same error class (`errors.email_taken()` on a
collision) so behavior is **identical** to the in-memory adapter.

---

## 3. Schema (the four record types)

DDL mirrors `sqlite_store.py`'s `_init_schema` table-for-table, translated to Postgres types. Use a
dedicated table-name set identical to today's (`users`, `sessions`, `settings`, `ai_credentials`).

### 3.1 `users` (UserRecord)
| column          | type                      | notes |
|-----------------|---------------------------|-------|
| `id`            | `TEXT PRIMARY KEY`        | opaque server id (uuid4 hex), never the email |
| `email`         | `TEXT NOT NULL`           | as-entered canonical (stored stripped) |
| `email_lower`   | `TEXT NOT NULL UNIQUE`    | **case-insensitive uniqueness** key (lower-cased at write) |
| `display_name`  | `TEXT`                    | nullable, non-unique, display-only |
| `password_hash` | `TEXT`                    | argon2 hash incl. salt; **NULL for a Google-only account**; never plaintext |
| `google_sub`    | `TEXT UNIQUE`             | linked Google subject; NULL when unlinked (Postgres allows multiple NULLs under UNIQUE — matches sqlite) |
| `created_at`    | `DOUBLE PRECISION NOT NULL` | epoch seconds (`time.time()`), matches the REAL columns today |
| `last_login_at` | `DOUBLE PRECISION`        | NULL until first login |

- Uniqueness: `email_lower UNIQUE` (the case-insensitive email rule) + `google_sub UNIQUE` (the
  Google-subject link). On an insert collision the adapter catches `psycopg.errors.UniqueViolation`
  and raises `errors.email_taken()` — **identical** to the sqlite `IntegrityError` branch (non-enumerating).
- Index: the `UNIQUE` constraints already create the lookup indexes for `email_lower` + `google_sub`;
  `id` is the PK. No extra index needed (volume is tiny).

### 3.2 `sessions` (SessionRecord)
| column                | type                       | notes |
|-----------------------|----------------------------|-------|
| `id`                  | `TEXT PRIMARY KEY`         | the opaque session id the signed cookie carries |
| `user_id`             | `TEXT NOT NULL`            | FK-by-convention to `users.id` (see note) |
| `created_at`          | `DOUBLE PRECISION NOT NULL`| |
| `expires_at`          | `DOUBLE PRECISION NOT NULL`| idle/rolling expiry (advanced on active use, D4) |
| `absolute_expires_at` | `DOUBLE PRECISION NOT NULL`| hard cap |
| `revoked`             | `BOOLEAN NOT NULL DEFAULT FALSE` | sqlite stored INTEGER 0/1; Postgres native BOOLEAN, mapped to the dataclass `bool` |

- Index: add `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id)` so
  `revoke_all_for_user` (the designed-for "log out everywhere") is efficient. The single-session
  reads/touches/revokes hit the PK.
- **FK note:** the in-memory adapter does NOT declare a real FK on `sessions.user_id`. To keep behavior
  **identical** and avoid an insert-order/cascade behavior change, do **NOT** add a real
  `REFERENCES users(id)` FK in this swap (it would introduce new failure modes the sqlite tests never
  exercised). Keep `user_id` as a plain column. (A real FK is a deferred hardening, not this feature.)
- `revoked` mapping: store/read as native BOOLEAN; the dataclass field stays Python `bool` exactly as
  the sqlite adapter produces via `bool(row["revoked"])`.

### 3.3 `settings` (SettingsRecord)
| column              | type                            | notes |
|---------------------|---------------------------------|-------|
| `user_id`           | `TEXT PRIMARY KEY`              | one row per user |
| `active_persona_id` | `TEXT`                          | nullable (⇒ app default) |
| `default_ticker`    | `TEXT`                          | nullable (⇒ app default) |
| `theme`             | `TEXT NOT NULL DEFAULT 'dark'`  | enumerated {dark,light,system} — **validated in `service.py`/the sqlite adapter's `_VALID_THEMES` path, NOT a DB CHECK** (keep validation where it is; mirror the existing 422 behavior) |

- The `update` subset-patch + `upsert_defaults` semantics are reproduced exactly (§6.3). `theme`
  validation stays in the adapter's `update` (mirror `_VALID_THEMES` → `errors.validation(...)`), so a
  bad theme is still a 422, never a DB constraint error. Do NOT add a DB CHECK constraint (it would turn
  a clean 422 into a DB exception → 5xx behavior change).

### 3.4 `ai_credentials` (CredentialRecord) — **ciphertext only**
| column       | type                       | notes |
|--------------|----------------------------|-------|
| `user_id`    | `TEXT PRIMARY KEY`         | one row per user |
| `ciphertext` | `TEXT NOT NULL`            | **Fernet token ONLY** — encrypted by `crypto.py` BEFORE the store; NEVER plaintext, NEVER returned to a browser |
| `last4`      | `TEXT NOT NULL`            | cleartext **non-secret masked hint** (last 4 chars), set at save time; the ONLY credential datum a response may carry |
| `created_at` | `DOUBLE PRECISION NOT NULL`| preserved across an overwrite (rotate) |
| `updated_at` | `DOUBLE PRECISION NOT NULL`| |

- **The DB stores ONLY ciphertext + the masked hint.** There is no plaintext column, ever. The
  encryption key is server-side env (`AI_KEY_ENCRYPTION_KEY`), never in the DB. (§8)

### 3.5 Postgres dialect translations (the only deltas from `sqlite_store.py`)
- Placeholder `?` → `%s`.
- `REAL` → `DOUBLE PRECISION`.
- `INTEGER`-as-boolean `revoked` → native `BOOLEAN` (default `FALSE`).
- `INSERT OR IGNORE` (settings upsert-defaults) → `INSERT ... ON CONFLICT (user_id) DO NOTHING`.
- `INSERT ... ON CONFLICT(user_id) DO UPDATE SET ...` (credential set_key) → identical in Postgres
  syntax (`ON CONFLICT (user_id) DO UPDATE SET ...`), using `EXCLUDED.*`.
- The `create`-user collision branch catches `psycopg.errors.UniqueViolation` (vs `sqlite3.IntegrityError`).
- Transactions: psycopg3 connections are transactional by default; wrap multi-statement ops in the
  connection context (§6) rather than sqlite's `with self._conn:` autocommit-block idiom.

### 3.6 No data migration
The in-memory store is empty every boot, so there is **no durable data to migrate**. Postgres starts on
a fresh, empty schema created by §3.7. Nothing is back-filled or converted.

### 3.7 Schema creation & versioning — idempotent bootstrap (NO migration tool)
**Decision: an idempotent `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` bootstrap, run
once at `make_stores(database_url)` construction** (mirrors how `_SharedDB._init_schema()` runs in
sqlite's constructor). NO Alembic, NO separate migration step.

Rationale:
- The schema is 4 small tables created once; there is no migration history to manage (this is the
  first persistent schema). `CREATE TABLE IF NOT EXISTS` is idempotent, deploy-friendly, and
  multi-replica-safe (concurrent boots racing the DDL are tolerated — `IF NOT EXISTS` + catching a
  benign duplicate-table race is safe; wrap the bootstrap so a concurrent create does not crash boot).
- It runs **on startup** (first factory construction), consistent with the sqlite adapter. No separate
  ops step, no migration ordering to get wrong on a fresh deploy.
- **Forward-evolution seam (documented, not built):** when a future feature needs a schema change, the
  bootstrap can gain a tiny `schema_version` table + ordered idempotent steps, OR adopt a real
  migration tool then. That is a deliberate future call — explicitly OUT OF SCOPE here (this feature
  ships the fresh schema only). The executioner SHOULD add a one-line comment in the bootstrap marking
  this seam.

---

## 4. Env-factory extension

`apps/api/src/auth/__init__.py`:
- Add a `_make_postgres_stores()` factory that reads `DATABASE_URL` from env and calls
  `postgres_store.make_stores(database_url)`. If `ACCOUNT_STORE=postgres` but `DATABASE_URL` is
  unset/empty, raise a clear `ValueError` (config error, surfaced at boot/first use — same shape as the
  existing "Unknown ACCOUNT_STORE" raise).
- Register `"postgres": _make_postgres_stores` in `_STORE_FACTORIES`.
- **In-memory remains the default** — `ACCOUNT_STORE` unset ⇒ `"memory"` (unchanged). The default path
  (local / test / keyless) is byte-for-byte the same; no behavior change to the in-memory adapter.
- `DATABASE_URL` is read **only** inside this factory (the leaf), from runtime env — never baked, never
  committed (`[no-secrets-in-image]`). It is the standard `postgresql://user:pass@host:port/db` URL;
  the adapter passes it straight to the pool. **No host/provider is picked here** — ANY Postgres
  reachable by that URL works (local Docker Postgres or a managed one). That is a non-goal (§7).

The factory stays cached for the process lifetime (the existing `get_service()` memoization) so the
pool is created once.

---

## 5. DB-outage fail mode (the `[best-effort-isolated-or-null]` auth carve-out)

**Principle: auth fails CLOSED; the anonymous bundle/SSE/trading path stays fully UP** (it never opens
a DB connection — it is the stateless leaf-free path). The existing `main.py`/`service.py`/`router.py`
fault machinery already implements the right behavior; the adapter's job is to **let DB errors
propagate as exceptions into that machinery** (and NEVER swallow a DB error into a false success). The
contract pins each path:

| Path | DB-outage behavior | Mechanism (already present) |
|------|--------------------|------------------------------|
| **Bundle REST `/api/ticker`, SSE, ghost-trade, `/api/contract`, `/api/_metrics`** | **Unaffected — stays fully up.** Never opens a DB connection. | The scoring path does not import the auth leaf (CONTEXT §5). |
| **Who-am-I `GET /api/auth/session`** | **200, anonymous** (degrade-to-anonymous). | `service.resolve_session` + `session_status` already catch ALL exceptions → anonymous. A DB fault → anonymous. Fail-closed (never grants). |
| **Gated actions — `POST /api/recommendation/{ticker}`, `POST /api/positions/sim-trade/gate`** | **503 `auth_unavailable`** when the subsystem faults (vs 403 when cleanly anonymous). | `main._resolve_auth` returns `(None, ok=False)` on a `get_service()`/resolve exception → `_gate_or_response` emits 503. A raised DB error in resolve is caught by `resolve_session` → anonymous → 403; a pool/`get_service` construction fault → 503. **Either way fail-closed: the gated action does NOT proceed.** |
| **signup / login** | **503 `auth_unavailable`** (never a misleading 200 or bad-credentials). | `router.signup`/`login` already wrap any non-`AuthError` exception → `errors.auth_unavailable()`. A psycopg `OperationalError` from the store → 503. |
| **logout** | **idempotent 200** (best-effort revoke). | `service.logout` already swallows exceptions; a DB-unreachable revoke is a no-op 200 (the cookie is cleared regardless). Acceptable — fail-closed is irrelevant to logout. |
| **AI-key GET/PUT/DELETE** | **200 `storage_available:false`** (never 5xx). | `service.ai_key_hint`/`set_ai_key`/`delete_ai_key` already wrap store faults → storage-unavailable shape. A DB-down credential op reports storage unavailable, never leaks, never 5xx. |
| **settings GET/PUT** | resolve degrades to anonymous on a DB fault → **401 `auth_required`**; if the DB drops AFTER a successful resolve but BEFORE the store read/write, `get_settings`/`write_settings` are **not** wrapped → a raised DB error becomes a FastAPI **500**. | **Known edge (build note):** this is the one path that can 500 on a mid-request DB drop (the sqlite adapter never raised, so it was never wrapped). It is still **fail-closed** (no data is corrupted, no access granted) and does not touch the trader path. The executioner SHOULD wrap the settings store calls in `service.get_settings`/`write_settings` to surface `errors.auth_unavailable()` (503) on a non-`AuthError` store fault — a behavior-faithful hardening that keeps settings in the auth-class envelope. This is an internal-leaf change only (no interface/shape change; `NO_INTERFACE_CHANGE` holds). |

**Adapter rule:** the Postgres adapter MUST NOT catch-and-swallow connection/operational errors into a
false-success or a false-empty result. A read that cannot reach the DB must **raise** (so resolve
degrades to anonymous / signup-login → 503) — it must NEVER return `None` as if "no such user" (that
could mask an outage as a clean anonymous/empty and is still fail-closed but loses the honest 503 on
signup/login). The ONLY place a swallow-to-shape is correct is the AI-key path, where `service.py`
already owns that translation (the adapter still raises; the service catches).

**No new error codes, no new statuses, no new shapes** — the swap reuses the existing auth error class
entirely. `NO_INTERFACE_CHANGE` holds.

---

## 6. Concurrency / transactions (real concurrent DB vs the single-process lock)

The in-memory adapter relied on ONE process lock for serialization. Postgres is concurrent and
multi-replica, so correctness moves to **atomic SQL + transactions**. Per operation:

### 6.1 Session lifecycle (create / resolve / touch / revoke)
- **create**: single `INSERT` (PK = the opaque session id, collision-free by construction). One
  statement, auto-committed.
- **resolve/get**: single `SELECT` by PK. The expiry/revocation interpretation stays in `service.py`
  (unchanged) — the store returns the raw row exactly as `SessionStore.get` contracts.
- **touch** (rolling-expiry advance): single `UPDATE sessions SET expires_at=%s WHERE id=%s`. A
  last-writer-wins race on the idle expiry is **benign and identical to today** (the value only moves
  forward; `service.resolve_session` already guards `touch` failures with `try/except: pass`). No
  explicit transaction needed.
- **revoke / revoke_all_for_user**: single `UPDATE ... SET revoked=TRUE WHERE ...`. Idempotent;
  concurrent revokes converge. `revoke_all_for_user` uses the `idx_sessions_user_id` index.

### 6.2 Credential set / rotate / delete
- **set_key (set OR rotate)**: a single atomic upsert —
  `INSERT INTO ai_credentials (...) VALUES (...) ON CONFLICT (user_id) DO UPDATE SET
  ciphertext=EXCLUDED.ciphertext, last4=EXCLUDED.last4, updated_at=EXCLUDED.updated_at`.
  To preserve `created_at` on rotate (matching the sqlite adapter's read-then-write), either keep
  `created_at` out of the `DO UPDATE SET` clause (so the existing value is retained — the clean
  single-statement way, **preferred**) or do the read-then-write in one transaction. **Preferred:
  omit `created_at` from the update set** — one atomic statement, no read race, behavior identical
  (created_at preserved on rotate, set on first insert).
- **delete_key**: single `DELETE ... WHERE user_id=%s`. Idempotent (deleting when absent is a 0-row
  no-op → still `{set:false}` via the service).
- **get_record**: single `SELECT` by PK. Server-side only; never serializes ciphertext.

### 6.3 Settings (upsert_defaults / update)
- **upsert_defaults**: `INSERT ... ON CONFLICT (user_id) DO NOTHING` then `SELECT` the row — wrap the
  two statements in ONE transaction (connection context) so a concurrent creator can't interleave a
  missing-row read. Matches the sqlite `INSERT OR IGNORE` + read.
- **update** (subset patch, server-wins D7): in ONE transaction — `INSERT ... ON CONFLICT DO NOTHING`
  (ensure the row exists), then the per-column `UPDATE settings SET <col>=%s WHERE user_id=%s` for each
  key PRESENT in the patch (the exact subset-write semantics of the sqlite adapter), then `SELECT` the
  full row to echo. Theme is validated BEFORE the write (mirror `_VALID_THEMES`; 422 on bad). Two
  concurrent partial patches converge to last-writer-wins per column — identical to today.

### 6.4 User create (the email-collision race)
- **create**: rely on the `email_lower UNIQUE` constraint as the source of truth. Do the optimistic
  `INSERT`; on `psycopg.errors.UniqueViolation` raise `errors.email_taken()` (non-enumerating). This is
  **stronger** than the sqlite pre-check (which raced a SELECT-then-INSERT under one lock); the unique
  constraint makes the collision atomic at the DB, correct under real concurrency / multi-replica. The
  optional pre-`SELECT` (for the common clean-409) may be kept for parity but the constraint is the
  guarantee. `attach_google` / `mark_login` are single `UPDATE`s.

### 6.5 The per-admin AI metering counters — **OUT OF THE STORE PORTS (explicit non-goal)**
**Critical scoping finding (verified in code):** the per-admin shared-key daily allowance counters +
the per-identity cooldown/global-cap live in `src/core/ai_recommendation.py`'s **process-local,
ephemeral `_RateCollection`** (one lock, `dict[identity → _IdentityRate]`, "RESETS ON RESTART") — they
are **NOT** behind the four auth store ports. This feature swaps **only** the four ports. Therefore:
- The metering counters are **NOT migrated to Postgres** in this feature. They stay process-local +
  ephemeral. The brief lists them under "concurrency/transactions" as a thing to reason about — the
  reasoned conclusion is: **they are not in scope for the store swap**, because they are not store-port
  state.
- **Documented known-limitation / deferred seam:** under multiple replicas the metering is per-replica
  (each process counts independently), so an admin's shared-key allowance is effectively
  `N_replicas × AI_REC_ADMIN_FREE_DAILY` and the per-identity cooldown is per-replica. This is a
  **pre-existing property** (true today the moment a second replica exists — the `containerize-apps`
  thread already noted "not shared across replicas"), NOT a regression introduced here. Persisting /
  centralizing the metering counters (e.g. a 5th port + a `metering` table, or Redis) is a **named
  deferred seam** for a future feature, called out for the owner in §12. This feature does not change
  scoring, the rec leaf, or the metering — `[additive-keeps-score-byte-identical]` holds.

---

## 7. Non-goals (explicit)

- **No host/provider pick.** ANY Postgres reachable via `DATABASE_URL` (local Docker Postgres or a
  managed instance). This contract does not choose a vendor, region, or sizing.
- **No deploy, no CI.** Deploy is the NEXT feature (`deploy`); CI is not in scope.
- **No change to the in-memory adapter's behavior.** `sqlite_store.py` is untouched; `memory` stays the
  default; local/test/keyless runs are byte-identical.
- **No app / scoring / endpoint / payload / UI change.** `NO_INTERFACE_CHANGE`, `NO_UI_CHANGE`.
  Score/tier/`state_fingerprint` byte-identical.
- **No durable-data migration** (in-memory has none; fresh schema).
- **No migration framework** (Alembic etc.) — idempotent bootstrap DDL only (§3.7).
- **No real FK / cascade** added on `sessions.user_id` (preserve identical behavior; §3.2).
- **No async rewrite** of the ports (§1.2).
- **No persisting the AI-metering counters** (§6.5 — separate deferred seam).
- **No new credential-handling beyond ciphertext-at-rest** (the Security/red-team role at go-live owns
  adversarial review — CONTEXT §7f/§7h).

---

## 8. Ciphertext boundary + the STABLE-KEY requirement

- **Ciphertext boundary (unchanged + reaffirmed):** the crypto leaf (`src/auth/crypto.py`, Fernet)
  encrypts the raw AI key BEFORE it reaches the store; the Postgres `ai_credentials.ciphertext` column
  holds ONLY the Fernet token; `last4` is the only non-secret hint. The adapter NEVER encrypts/decrypts
  and NEVER sees `AI_KEY_ENCRYPTION_KEY`. `get_decrypted_ai_key` (the only decrypt) stays in
  `service.py` and is server-side only, never feeding a response. This is identical to byo-ai-key today
  — Postgres just durably stores the same ciphertext the sqlite adapter held in memory.
- **STABLE-KEY requirement (the headline operational note for persistent mode):** today, with the
  in-memory store, `AI_KEY_ENCRYPTION_KEY` and `AUTH_SESSION_SIGNING_KEY` may be unset (each falls back
  to an **ephemeral per-process key** — verified in `crypto.py` and `service._signing_key()`), because
  the stored data ALSO resets on restart, so an unreadable-after-restart key/cookie was harmless. **In
  persistent (`ACCOUNT_STORE=postgres`) mode this changes:** the ciphertext and the session rows now
  SURVIVE restarts/deploys/replicas, so:
  - `AI_KEY_ENCRYPTION_KEY` **MUST** be set to a **stable** value, identical across restarts and across
    all replicas — else the now-durable encrypted AI keys become **undecryptable** after a restart
    (every `get_decrypted_ai_key` → None → "no usable key"; users must re-enter their key). Different
    keys per replica ⇒ a key saved on replica A is unreadable on replica B.
  - `AUTH_SESSION_SIGNING_KEY` **MUST** be set to a **stable** value, identical across restarts and all
    replicas — else the signed session cookies become **unverifiable** after a restart (every session
    silently → anonymous; users are logged out on every deploy) and replicas can't validate each
    other's cookies.
  - **Build action:** the executioner MUST document this prominently — in `apps/api/.env.example`
    (a comment block on both keys: "REQUIRED + STABLE when `ACCOUNT_STORE=postgres`") and a
    `# persistent-db` note. **No code change is needed** for the stable-key behavior (the existing
    env-read + ephemeral-fallback is correct); this is a documentation/operational requirement. The
    fallback stays as the keyless-local convenience for `ACCOUNT_STORE=memory`.

---

## 9. Env / config summary (additions only)

| env | role | default | notes |
|-----|------|---------|-------|
| `ACCOUNT_STORE` | store backend selector (existing) | `memory` | `postgres` selects the new adapter; **memory stays default** |
| `DATABASE_URL` | Postgres connection URL (NEW) | unset | required ONLY when `ACCOUNT_STORE=postgres`; `postgresql://…`; **runtime env, never baked** (`[no-secrets-in-image]`); `.env.example` value-less + `.dockerignore`d |
| `DATABASE_POOL_MAX` (or chosen name) | pool max size (NEW, optional) | small (e.g. 10) | pure operator config; executioner finalizes the exact name/default |
| `AI_KEY_ENCRYPTION_KEY` | Fernet key (existing) | ephemeral fallback | **MUST be stable** in persistent mode (§8) |
| `AUTH_SESSION_SIGNING_KEY` | cookie HMAC key (existing) | ephemeral fallback | **MUST be stable** in persistent mode (§8) |

No env is renamed or removed. The session-lifetime knobs (`AUTH_SESSION_IDLE_SECONDS` /
`AUTH_SESSION_ABSOLUTE_SECONDS`) and the admin-metering envs are unchanged.

---

## 10. Verify / review checklist (live-DB DEFERRED — what stands in)

**No Postgres instance exists here**, so live verification is **deferred to the owner** (same pattern
as Docker for `containerize-apps`). The build is authored correct-by-construction; the substitutes are:

### 10.1 Port-contract test (the executioner WRITES this — the centerpiece)
A single behavioral test module that runs the **SAME assertions** against the in-memory adapter AND a
stand-in, asserting identical behavior:
- **Primary stand-in: SQLite-on-disk** (a `tempfile` sqlite DB) reusing the sqlite adapter's SQL —
  proves the port contract + the upsert/subset/uniqueness/created-at-preservation semantics
  deterministically with NO external service. (The existing in-memory adapter is the reference; the
  disk variant proves persistence-across-"reopen" behavior in the same dialect.)
- **Optional Postgres run (skipped unless `DATABASE_URL` set):** the SAME test parametrized to also run
  against `postgres_store` when a `DATABASE_URL` env is present (e.g. `@pytest.mark.skipif`-style guard
  or an env check) — so the owner's CI / local-Docker run exercises the real adapter with zero new code.
- Assertions (run against every adapter): create→get-by-id/email(case-insensitive)/google_sub;
  duplicate-email → `email_taken`; session create→get→touch(advances expiry)→revoke→resolves-revoked-as
  gone; `revoke_all_for_user`; settings upsert_defaults idempotent + subset `update` server-wins + bad
  theme → `validation`; credential set→get_record(ciphertext round-trips via crypto)→rotate(created_at
  preserved, last4 updated)→delete idempotent; **ciphertext-only** (no plaintext ever stored — assert
  the stored value is the Fernet token, decrypts via `crypto.decrypt`, and the raw key never appears).
- **Note (build-system):** there is no pytest suite wired today (CONTEXT §"apps/api … No pytest
  suite — verified by app-run + interface_conformance.py"). The executioner adds this as a
  standalone runnable test module under `apps/api/` (run via the venv python) — it does NOT require
  standing up pytest infra if that's heavy; a plain assert-driven `__main__` runner is acceptable and
  matches the repo's "verified by app-run" convention. Pick the lightest option that runs both adapters.

### 10.2 Static / review checks (stand in for live-DB, run by executioner + conductor static review)
- **Leaf-boundary AST check** (reuse the existing import-boundary check): `postgres_store.py` imports
  ONLY stdlib + `psycopg`/`psycopg_pool` + the leaf's own modules; the scoring path
  (`engine`/`signals`/`live`/`darkpool`/`chain_store`/bundle) does NOT import the auth leaf — 0
  scoring modules import auth (the byte-identity guarantee).
- **Byte-identity check (existing):** `opportunity_score`/`opportunity_tier`/`state_fingerprint`
  unchanged with `ACCOUNT_STORE=memory` (the default) — re-run the user-accounts/byo-ai-key fixture
  (score 24 / actionable / `79373ef9194e`). The Postgres path cannot affect scoring (leaf), but confirm
  the default path is byte-identical and the import didn't perturb anything.
- **Secret-scan:** grep the diff + a boot log scan — no plaintext key, no ciphertext, no `DATABASE_URL`,
  no DB password, no `AI_KEY_ENCRYPTION_KEY`/`AUTH_SESSION_SIGNING_KEY` ever logged or in a response.
  `.env.example` has `DATABASE_URL` value-less; `.dockerignore` still excludes `.env*`.
- **`interface_conformance.py`** unchanged green (the endpoints/shapes/statuses didn't change;
  `ACCOUNT_STORE=memory` default keeps the sweep working). Note: the cookie-gated key endpoints are
  verified by the port-contract test, as today (the sweep is cookieless — CONTEXT §7h known item).
- **SQL parity review:** diff `postgres_store.py`'s SQL against `sqlite_store.py` statement-for-statement
  — same tables/columns/keys, only the §3.5 dialect deltas. This diff-ability is WHY raw SQL was chosen.
- **Boot-without-DB check:** with `ACCOUNT_STORE=postgres` + an unreachable/bad `DATABASE_URL`, the
  process must **boot** (no crash) and a gated action must return 503 `auth_unavailable` / who-am-I 200
  anonymous (fail-closed, trader path up) — verifiable WITHOUT a real DB (point at a dead host:port).

### 10.3 Runtime-verify steps the OWNER runs (deferred — needs a real Postgres)
Provide a `DATABASE_URL` (local Docker Postgres `docker run -e POSTGRES_PASSWORD=… -p 5432:5432
postgres:16`, or a managed one) + set stable `AI_KEY_ENCRYPTION_KEY` + `AUTH_SESSION_SIGNING_KEY`, then:
1. `ACCOUNT_STORE=postgres DATABASE_URL=… nx serve api` → boots; tables auto-created.
2. Sign up an account, save settings, save an AI key (masked `····last4` shows) — all 200.
3. **Restart the backend** → `GET /api/auth/session` still authenticated (cookie verifies), settings
   intact, AI key still usable (rec works / hint shows the same last4). **This is the headline
   acceptance: state survives restart.**
4. Run the optional Postgres-parametrized port-contract test against the same `DATABASE_URL`.
5. (Multi-replica) point two backend instances at the same `DATABASE_URL` + identical stable keys → an
   account/session/key created on one is visible on the other.
6. **Outage drill:** stop Postgres mid-session → who-am-I → 200 anonymous; a gated POST → 503
   `auth_unavailable`; the **bundle `/api/ticker` + SSE keep working** (trader path up). Restart
   Postgres → auth recovers (pool reconnects on next use).

---

## 11. The byte-identity / one-way-leaf guarantee (restated)

The Postgres adapter lives entirely inside `src/auth/` (the one-way leaf). The scoring/bundle/SSE path
imports NONE of it. No user/session/setting/credential datum can become an input to
`signals`/`opportunity_score`/`opportunity_tier`/`state_fingerprint`/the entry gate — the module
boundary is the enforcement, exactly as for the in-memory adapter. The default `memory` path is
unchanged. Therefore score byte-identity is structurally preserved, regardless of the store backend.

---

## 12. Owner notes (PM/UX skipped on this infra fast-path)

No product/UX questions — this is an internal storage swap with no user-visible surface. The
following are owner-facing operational decisions / deferred seams (NOT blockers for the build):

1. **Pick a Postgres instance** to run the deferred runtime-verify (local Docker Postgres or a managed
   one) and provide a `DATABASE_URL`. The build proceeds correct-by-construction without it.
2. **Set stable `AI_KEY_ENCRYPTION_KEY` + `AUTH_SESSION_SIGNING_KEY`** for any persistent/replicated
   deploy (§8) — else durable AI keys become unreadable + users get logged out on every deploy.
3. **Deferred seam — centralize the AI-metering counters** (§6.5): the per-admin shared-key allowance +
   per-identity cooldown are process-local/ephemeral and per-replica today. If/when multi-replica
   metering accuracy matters, that is a future feature (a 5th port + a `metering` table, or Redis) —
   explicitly out of scope here and NOT a regression introduced by this swap.
4. **Deferred seam — schema-version/migration** (§3.7): the first real schema change adopts a
   `schema_version` table or a migration tool; the fresh-schema bootstrap is all this feature ships.
5. **`deploy` is the next feature**; **Security/red-team (system-6)** activates at go-live (CONTEXT
   §7f/§7h/§7i) — credential custody + the deploy/secret-handling artifacts get adversarial review there.

---

## 13. Executioner handoff (backend executioner — PM/UX skipped)

1. **Add `src/auth/postgres_store.py`** — raw-SQL psycopg3-**sync** adapter mirroring
   `sqlite_store.py` statement-for-statement (the four port impls returning the SAME `ports.py`
   dataclasses), over a single process-wide `psycopg_pool.ConnectionPool` (§1, §3.5); `make_stores(database_url)`
   runs the idempotent `CREATE TABLE/INDEX IF NOT EXISTS` bootstrap on construction (§3.7) and must
   NOT crash boot when the DB is unreachable.
2. **Schema = the four tables in §3** (`users`/`sessions`/`settings`/`ai_credentials`), Postgres types
   per §3.5 (`DOUBLE PRECISION`, `BOOLEAN`, `%s`, `ON CONFLICT`), `email_lower UNIQUE` (case-insensitive)
   + `google_sub UNIQUE` + `idx_sessions_user_id`; **`ai_credentials.ciphertext` is the Fernet token
   ONLY** (§3.4/§8); no DB CHECK on theme, no real FK on `sessions.user_id` (§3.2/§3.3). Concurrency via
   atomic upserts/transactions per §6 (NOT a process lock).
3. **Wire the factory** — register `"postgres": _make_postgres_stores` in `src/auth/__init__.py`
   (reads `DATABASE_URL`, raises a clear ValueError if `ACCOUNT_STORE=postgres` but it's unset);
   **memory stays default** (§4). Add `psycopg[binary]` + `psycopg-pool` to `requirements.txt` (§1.4).
   Add `DATABASE_URL=` (value-less) + the STABLE-KEY comment block (both keys) to `apps/api/.env.example` (§8/§9).
4. **Fail-closed DB-outage mode (§5)** — the adapter RAISES on DB errors (never swallows into a false
   success/empty); the existing `main.py`/`service.py`/`router.py` machinery then yields 503
   `auth_unavailable` (signup/login/gated) or anonymous (who-am-I) while the **bundle/SSE path stays
   up**; harden `service.get_settings`/`write_settings` to map a non-`AuthError` store fault to
   `auth_unavailable` (internal-leaf only, no interface change).
5. **Verify per §10 (live-DB DEFERRED)** — write the dual-adapter **port-contract test** (in-memory +
   disk-sqlite stand-in always; Postgres when `DATABASE_URL` is set), run the leaf-boundary AST check +
   the `memory`-default byte-identity (24 / actionable / `79373ef9194e`) + secret-scan + the SQL-parity
   diff + the boot-without-DB fail-closed check. Leave the **live-Postgres restart-survives + outage
   drill + multi-replica** acceptance to the owner-provided `DATABASE_URL` (§10.3). NEVER log a key,
   ciphertext, `DATABASE_URL`, or DB password.
