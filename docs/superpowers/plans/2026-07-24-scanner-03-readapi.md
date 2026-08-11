# Scanner v1 — Plan 3 of 4: The read API + server-gated per-account view + ticker warm-click read-through

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the **web surface** that READS what P1 (`ScanStore`) + P2 (sweep worker + bundle-blob) produce — `GET /api/scan` (requested-or-default view + building-fill + sweep metadata, anonymous-open, always-200), `GET /api/scan/universe`, `GET /api/scan/view`, and the **server-gated** `PUT /api/scan/view` (per-account view persisted as a field on the existing settings record) — plus a best-effort, byte-preserving **warm-click read-through** of P2's bundle-blob inside the EXISTING ticker endpoint.

**Architecture:** All on `apps/api`'s existing web surface; `main.py` is the sole orchestration boundary. Three anonymous-open reads + one server-gated write register **before** the `/{ticker}` catch-all alias. The per-account view rides the **existing `src/auth/` settings ports** (D1) — an additive nullable `scan_view` JSON field on `SettingsRecord`, written through the same `PUT /api/auth/settings` gate machinery (`_gate_or_response`). The warm-click seeds `main._cache` from the P2 `read_bundle_blob` **before** the vendor when a **tracked** symbol's canonical (unfiltered) bundle is requested and the blob is fresh — the `chain_store` pre-warm precedent extended across the process boundary. `compute_ticker` is **never edited and never re-forked**: a warm hit serves bytes a prior `compute_ticker` produced; a miss/stale falls straight through to the identical normal path.

**Tech Stack:** Python 3.12, FastAPI (existing `main.app` + the existing auth router/service/ports), the P1 `scanstore` leaf (`get_store`, `read_rows`, `read_heartbeat`, `read_bundle_blob`), the P2 `src/scanner/universe.py` loader, stdlib `json`. FastAPI's bundled `TestClient` (httpx 0.28 present) drives the no-live-server selftests; the standalone `.spire/clusters/tech/state/conformance/scanner.json` (already authored by GATE U·X) drives the live conformance gate. No new pip dependency.

## Global Constraints

Every task's requirements implicitly include these (copied verbatim from `INTERFACE_CONTRACT.md` §1–§5, `BACKEND_EXECUTION_CONTRACT.md` §1–§4, `ARCHITECTURE_CONTRACT.md` §3.3/§3.4/§3.5/§5, and `.spire/clusters/tech/state/conformance/scanner.json`):

- **`[additive-keeps-score-byte-identical]` (HARD — the load-bearing boundary).** The warm-click **must not change the served bundle's bytes.** `compute_ticker` stays the **sole transform** — it is **not edited, not forked** (`engine.py`/`signals.py`/`live.py`/`darkpool.py`/`chain_store.py`/`compute_ticker` get **0 edits**); the read-through only changes **where the bundle came from** (a prior worker `compute_ticker`, JSON-round-tripped), exactly like `chain_store` changes where the chain INPUT came from. Score / tier / `state_fingerprint` / the entry gate stay **byte-identical** whether the blob was hit or the vendor was fetched, and whether the scanner exists or not (a miss falls through to the exact current code path). `scanstore/` stays a **one-way leaf**: `main.py` (web) is the only orchestration boundary that reads it — **no scoring module imports `scanstore/` or `src/scanner/`**. No scan row / view / heartbeat / blob is ever a scoring input.
- **`[best-effort-isolated-or-null]`.** Every **READ** (`/api/scan`, `/api/scan/universe`, `/api/scan/view`) is best-effort **200 + status**: a store outage / read fault degrades content (stale rows if any, `sweep: null`, per-row `stale`/`error`, a `building`-filled view) but **never 5xx's for scan trouble**. A single failed symbol degrades **that row alone**. The scan reads are **not** an auth failure domain. **Auth carve-out — WRITES only:** `PUT /api/scan/view` is the one gated, state-bearing action and returns a **real 401/403** (repo precedent: **403** `auth_required` / **503** `auth_unavailable`) when signed-out. The warm-click **adds no new failure surface** to the ticker endpoint (any miss/stale/fault falls straight through).
- **`[server-side-gate-enforcement]`.** The view WRITE gate is enforced **server-side**, never FE-only — a signed-out `PUT` is refused at the server and persists **nothing**, even if the FE guard is bypassed/absent (the `PUT /api/auth/settings` / sim-trade / ai-rec gate precedent). The gate is the **OUTERMOST** precondition (before body validation), so a cookieless malformed PUT is refused (403), never pre-empted by a validation 422.
- **`[live-vs-static-isolation]`.** The scan reads are **poll-based** (plain REST reads of the store) — **no SSE, no per-row streams, no WebSocket** on the scan surface.
- **`[model-read-carries-its-assumptions]` / `[digested-labels-not-raw-dump]`.** The response carries per-row `as_of` + closed `status` + the heartbeat epochs; closed enums + scalars only, **no raw series**, no pre-rendered freshness copy, never the word "live". For a synthesized `building` row `as_of` is **not a freshness claim** (numeric fields `null`, `status: 'building'`; the FE branches on `status === 'building'` before reading `as_of`).
- **`[no-real-order-path]`.** Display/read + a persisted view only. No broker/order/execution path.
- **`[no-secrets-in-image]`.** All new tunables are **runtime env only** (`SCAN_DEFAULT_VIEW_N`, `SCAN_WARM_MAX_AGE_SECONDS`). No secret is added.
- **Wire keys are FIXED by the shipped P1 records** — `GET /api/scan` rows are `ScanRow.to_wire()` and `sweep` is `SweepHeartbeat.to_wire()` from `apps/api/src/scanstore/ports.py`; **do not rename or add row/heartbeat keys.** Emit **exactly** the interface envelopes (`ScanView`/`ScanResponse`/`UniverseResponse`, INTERFACE §2–§3). No new market math; closed enums only.
- **Route registration order (HARD).** All four `/api/scan*` routes register **before** any `/{ticker}` catch-all alias (`main.py:1403`, `@app.get("/{ticker}")`), so `scan`/`universe`/`view` are never swallowed as a ticker symbol.
- **Default-view resolution (D2).** Signed-in with a saved view → that account view. Otherwise → the **owner-curated default view**: the explicit `default_view` list from `config/universe.json` when non-empty (the shipped config lists 8); when unset → **top-`SCAN_DEFAULT_VIEW_N`-by-current-score** (N=20) from the store; when the store holds no computed rows → the configured/universe symbols as `building` (never a dead screen). Deterministic, no per-user state for the default path.
- **Test convention:** `apps/api` has **no pytest suite** (CLAUDE.md). Every task is verified by a **runnable assert-based `_selftest` module** run with `apps/api/.venv/Scripts/python.exe` (cwd = `apps/api`), RED→GREEN like a test — **not** pytest. The read/write endpoints are exercised with FastAPI's **`TestClient(main.app)`** (no live uvicorn, no vendor key); the **live conformance + curl gate** (Task 6) needs a running server. Adopting pytest stays a separate owner decision (see `## Open decisions`).
- **Python idioms:** additive edits open `from __future__ import annotations` where new modules are created; logger is `logging.getLogger("Convexa")`; the venv Python is `apps/api/.venv/Scripts/python.exe`; module runs use `cwd = apps/api` so `src` / `main` resolve.

## Open decisions (surface to the owner; do not block this plan)

1. **pytest for the backend.** Unchanged from Plans 1–2: this plan uses runnable `_selftest` modules (convention-compatible). Adopting pytest is a one-task toolchain add — raise it at review.
2. **Auth Postgres schema-evolution seam (a possible GATE-Z clarification).** The auth Postgres adapter (`apps/api/src/auth/postgres_store.py`) carries an explicit note (§3.7, at `_init_schema`): *"the FIRST future schema change adds a tiny `schema_version` table + ordered idempotent steps here, OR adopts a migration tool then."* Adding the `scan_view` column is exactly that first change. This plan takes the **lightest loss-free path**: an idempotent `ALTER TABLE settings ADD COLUMN IF NOT EXISTS scan_view TEXT` (Postgres supports `IF NOT EXISTS`; existing rows keep their data, the new column defaults NULL — additive + multi-replica-safe, honoring `[loss-free-durable-migration]`-adjacent care). The in-memory SQLite adapter is recreated fresh each boot, so it only needs the column added to its `CREATE TABLE` DDL. **Flag for the owner:** confirm the idempotent `ADD COLUMN IF NOT EXISTS` is acceptable vs. standing up the `schema_version` table now. (Both are additive; the ALTER is minimal and reversible.)
3. **View storage locus + the auth envelope (RESOLVED here; not a GATE-Z).** D1 is settled: the view is a field on the existing `SettingsRecord` behind the auth-settings ports. This plan deliberately **does NOT add `scan_view` to `SettingsRecord.to_wire()`** — so the `/api/auth/session` + `GET/PUT /api/auth/settings` envelopes stay **byte-identical** (INTERFACE §3.4: "whether the view also rides the `/api/auth/settings` echo is a backend impl choice and is not part of this contract"). The dedicated `/api/scan/view` endpoints are the FE↔BE truth for the view. A guard in the Task-1 selftest asserts `to_wire()` never grows a `scan_view` key.
4. **Route-order guard scope (transparency).** The shipped catch-all is `@app.get("/{ticker}")` constrained to `^[A-Za-z]{1,6}$` — a **single-segment** route that cannot match a two-segment `/api/scan*` path, so `/api/scan/universe` is not functionally swallowable today. The plan still registers the scan routes **before** it (the HARD contract clause) and adds a **structural ordering assertion** over `app.routes` so the invariant is enforced + future-proof (if the catch-all ever broadens). The RED→GREEN is on that structural ordering (Task 2).

## File Structure

```
apps/api/
  src/auth/ports.py            # +scan_view field on SettingsRecord (ADDITIVE; NOT in to_wire)
  src/auth/sqlite_store.py     # +scan_view column (in-memory settings table) + read/allow-list
  src/auth/postgres_store.py   # +scan_view column (CREATE + idempotent ALTER IF NOT EXISTS) + read/allow-list
  src/auth/service.py          # +get_scan_view / save_scan_view (mirror get_settings/write_settings)
  src/auth/_scanview_selftest.py     # NET-NEW runnable: view round-trip behind the ports + to_wire guard
  src/scanner/universe.py      # +get_universe() cached web-side accessor (ADDITIVE; load_universe unchanged)
  src/scanner/__init__.py      # +re-export get_universe
  main.py                      # +scanstore/universe imports; the Scanner read API section (4 routes,
                               #   registered BEFORE the /{ticker} catch-all); the warm-click hook in
                               #   _compute_entry; 2 config constants. compute_ticker UNCHANGED.
  scan_universe_selftest.py    # NET-NEW runnable: GET /api/scan/universe + route-order (TestClient)
  scan_read_selftest.py        # NET-NEW runnable: GET /api/scan (default-view + building-fill) + GET /api/scan/view
  scan_view_write_selftest.py  # NET-NEW runnable: PUT /api/scan/view gate + 422 + persist (RED→GREEN gate)
  warmclick_selftest.py        # NET-NEW runnable: _scan_warm_bundle unit + served-bytes integration (RED→GREEN freshness)
  .env.example / Dockerfile    # +SCAN_DEFAULT_VIEW_N / SCAN_WARM_MAX_AGE_SECONDS doc block (names only)
```

Each new module has one responsibility. The auth field is a minimal additive extension of the shipped settings path; the read API is a cohesive `main.py` section; the warm-click is a single guarded branch inside the existing miss path. `.spire/clusters/tech/state/conformance/scanner.json` is **already authored** (GATE U·X) — this plan **runs** it, it does not write it.

---

### Task 1: The per-account view field on the settings record (auth ports + both adapters + service) — D1

> The D1 storage locus: the view is a nullable JSON field on the existing `SettingsRecord`, written through the **existing auth-settings ports** (the same ports `PUT /api/auth/settings` rides). Additive + parity-mirrored across the in-memory + Postgres adapters. Verified by a runnable selftest that round-trips the field behind the ports and **guards the auth wire** (`to_wire()` must NOT grow the field).

**Files:**
- Modify: `apps/api/src/auth/ports.py` (add `scan_view` to `SettingsRecord`)
- Modify: `apps/api/src/auth/sqlite_store.py` (column + read + update allow-list)
- Modify: `apps/api/src/auth/postgres_store.py` (column + idempotent ALTER + read + update allow-list)
- Modify: `apps/api/src/auth/service.py` (two thin methods)
- Create: `apps/api/src/auth/_scanview_selftest.py`

**Interfaces:**
- Produces (Tasks 3–4 consume via the service):
  - `SettingsRecord.scan_view: Optional[str]` — a JSON string of the saved view bag (`{symbols, name, sort, density}`), or `None`. **NOT** emitted by `to_wire()`.
  - `AuthService.get_scan_view(user: UserRecord) -> Optional[str]` — the stored JSON string or None (best-effort: a store fault → None).
  - `AuthService.save_scan_view(user: UserRecord, view_json: str) -> None` — persist behind `UserSettingsStore.update`; a store fault raises `errors.auth_unavailable()` (503, the write_settings precedent).

- [ ] **Step 1: Add the `scan_view` field to `SettingsRecord` (NOT in `to_wire`)**

In `apps/api/src/auth/ports.py`, extend the `SettingsRecord` dataclass — add the field after `theme`, leave `to_wire()` **unchanged**:

```python
@dataclass
class SettingsRecord:
    """The bounded per-user settings bag (ARCHITECTURE §3.3).

    Presentation/preference ONLY — NEVER read by signals/engine/live/darkpool/scoring/tiering/the
    fingerprint (AC-F4). Defaults are null (⇒ app default) except theme.
    """
    user_id: str
    active_persona_id: Optional[str] = None
    default_ticker: Optional[str] = None
    theme: str = "dark"
    # Scanner v1 P3 (D1): the per-account scan VIEW, stored as a JSON string ({symbols, name, sort,
    # density}) or None. Presentation/preference only — never a scoring input. Deliberately NOT in
    # to_wire(): the /api/scan/view endpoints are the FE↔BE truth for the view, so the auth session /
    # settings envelope stays byte-identical (INTERFACE §3.4). Read/written via the existing ports.
    scan_view: Optional[str] = None

    def to_wire(self) -> dict:
        """The settings bag as INTERFACE §2.1/§2.6/§2.7 emits it."""
        return {
            "active_persona_id": self.active_persona_id,
            "default_ticker": self.default_ticker,
            "theme": self.theme,
        }
```

- [ ] **Step 2: Add the column + read + allow-list to the in-memory SQLite adapter**

In `apps/api/src/auth/sqlite_store.py`, add `scan_view` to the `settings` DDL (inside `_init_schema`'s `executescript`):

```python
                CREATE TABLE IF NOT EXISTS settings (
                    user_id           TEXT PRIMARY KEY,
                    active_persona_id TEXT,
                    default_ticker    TEXT,
                    theme             TEXT NOT NULL DEFAULT 'dark',
                    scan_view         TEXT
                );
```

Then extend `SqliteUserSettingsStore` — the `get` / `upsert_defaults` reads must carry `scan_view`, and the `update` allow-list must include it. Replace the three `SettingsRecord(...)` constructions and the `update` column loop:

```python
class SqliteUserSettingsStore(UserSettingsStore):
    def get(self, user_id: str) -> Optional[SettingsRecord]:
        with _db._lock:
            row = _db._conn.execute(
                "SELECT * FROM settings WHERE user_id = ?", (user_id,)).fetchone()
        if not row:
            return None
        return SettingsRecord(
            user_id=row["user_id"], active_persona_id=row["active_persona_id"],
            default_ticker=row["default_ticker"], theme=row["theme"],
            scan_view=row["scan_view"],
        )

    def upsert_defaults(self, user_id: str) -> SettingsRecord:
        with _db._lock:
            with _db._conn:
                _db._conn.execute(
                    "INSERT OR IGNORE INTO settings (user_id, active_persona_id, default_ticker, "
                    "theme) VALUES (?, NULL, NULL, 'dark')", (user_id,))
            row = _db._conn.execute(
                "SELECT * FROM settings WHERE user_id = ?", (user_id,)).fetchone()
        return SettingsRecord(
            user_id=row["user_id"], active_persona_id=row["active_persona_id"],
            default_ticker=row["default_ticker"], theme=row["theme"],
            scan_view=row["scan_view"],
        )

    def update(self, user_id: str, patch: dict) -> SettingsRecord:
        # Validate theme (the only enumerated field) BEFORE the write; 422 on a bad value.
        if "theme" in patch and patch["theme"] is not None and patch["theme"] not in _VALID_THEMES:
            raise errors.validation(
                "theme must be one of 'dark', 'light', or 'system'.")
        with _db._lock:
            with _db._conn:
                _db._conn.execute(
                    "INSERT OR IGNORE INTO settings (user_id, active_persona_id, default_ticker, "
                    "theme) VALUES (?, NULL, NULL, 'dark')", (user_id,))
                # Apply only the keys present in the patch (subset write; server-wins, D7).
                for col in ("active_persona_id", "default_ticker", "theme", "scan_view"):
                    if col in patch:
                        _db._conn.execute(
                            f"UPDATE settings SET {col} = ? WHERE user_id = ?",
                            (patch[col], user_id))
            row = _db._conn.execute(
                "SELECT * FROM settings WHERE user_id = ?", (user_id,)).fetchone()
        return SettingsRecord(
            user_id=row["user_id"], active_persona_id=row["active_persona_id"],
            default_ticker=row["default_ticker"], theme=row["theme"],
            scan_view=row["scan_view"],
        )
```

- [ ] **Step 3: Add the column + idempotent migration + read + allow-list to the Postgres adapter (parity)**

In `apps/api/src/auth/postgres_store.py`, add `scan_view` to the `settings` CREATE and an idempotent `ALTER` for already-deployed DBs — inside `_init_schema`, replace the `settings` `CREATE TABLE` block with:

```python
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS settings (
                        user_id           TEXT PRIMARY KEY,
                        active_persona_id TEXT,
                        default_ticker    TEXT,
                        theme             TEXT NOT NULL DEFAULT 'dark',
                        scan_view         TEXT
                    )
                    """
                )
                # Scanner v1 P3 schema-evolution (ARCHITECTURE §3.7 first change): additively add the
                # scan_view column to an ALREADY-DEPLOYED settings table. Idempotent + multi-replica-
                # safe (ADD COLUMN IF NOT EXISTS); existing rows keep their data, the new column
                # defaults NULL ([loss-free-durable-migration]).
                cur.execute(
                    "ALTER TABLE settings ADD COLUMN IF NOT EXISTS scan_view TEXT")
```

Then extend the settings column list + mapper + update allow-list:

```python
def _row_to_settings(row) -> SettingsRecord:
    return SettingsRecord(
        user_id=row[0], active_persona_id=row[1],
        default_ticker=row[2], theme=row[3], scan_view=row[4],
    )


_SETTINGS_COLS = "user_id, active_persona_id, default_ticker, theme, scan_view"
```

In `PgUserSettingsStore.update`, extend the column loop to include `scan_view`:

```python
                # Apply only the keys present in the patch (subset write; server-wins, D7).
                for col in ("active_persona_id", "default_ticker", "theme", "scan_view"):
                    if col in patch:
                        cur.execute(
                            f"UPDATE settings SET {col} = %s WHERE user_id = %s",
                            (patch[col], user_id))
```

(The `get` / `upsert_defaults` reads already `SELECT {_SETTINGS_COLS}` + `_row_to_settings`, so extending those two constants is the whole change there. The `upsert_defaults`/`update` `INSERT ... VALUES (%s, NULL, NULL, 'dark')` is unchanged — `scan_view` defaults NULL via the column default.)

- [ ] **Step 4: Add the two service methods (mirror `get_settings` / `write_settings`)**

In `apps/api/src/auth/service.py`, add after `write_settings` (in the `# settings` section of `AuthService`):

```python
    def get_scan_view(self, user: UserRecord) -> Optional[str]:
        """Scanner v1 P3: read the raw scan-view JSON string for `user` (or None). Best-effort — a
        store fault degrades to None (the caller falls back to the default view; a scan READ is never
        an auth failure domain). Never raises."""
        try:
            settings = self.stores.settings.get(user.id)
        except Exception:
            logger.warning("auth: scan-view read faulted; treating as unset", exc_info=False)
            return None
        return settings.scan_view if settings else None

    def save_scan_view(self, user: UserRecord, view_json: str) -> None:
        """Scanner v1 P3: persist the per-account scan view (a pre-serialized JSON string) behind the
        existing settings port (subset write; server-wins, D7). A non-`AuthError` STORE fault maps to
        `auth_unavailable` (503), mirroring write_settings — keeps the view in the auth-class
        envelope, no bare 500."""
        try:
            self.stores.settings.update(user.id, {"scan_view": view_json})
        except errors.AuthError:
            raise
        except Exception:
            logger.warning("auth: scan-view write faulted; reporting auth unavailable", exc_info=False)
            raise errors.auth_unavailable()
```

- [ ] **Step 5: Write the runnable selftest (view round-trip behind the ports + the `to_wire` guard)**

Create `apps/api/src/auth/_scanview_selftest.py`:

```python
"""Runnable check for the per-account scan-view field on the settings record (Scanner v1 Plan 3
Task 1). No pytest, no live server: drives the in-memory auth settings store directly. Proves the
scan_view JSON round-trips behind the EXISTING settings ports, a subset update does NOT clobber the
other fields, and — the load-bearing guard — SettingsRecord.to_wire() still does NOT carry scan_view
(the /api/auth/session + /api/auth/settings envelope stays byte-identical, INTERFACE §3.4).
Run: apps/api/.venv/Scripts/python.exe -m src.auth._scanview_selftest  (cwd = apps/api). 0=pass,1=fail."""
from __future__ import annotations

import json

from .ports import SettingsRecord
from .sqlite_store import make_stores


def run() -> None:
    stores = make_stores()
    uid = "user-scanview-1"
    stores.settings.upsert_defaults(uid)

    # 1. to_wire MUST NOT carry scan_view (the auth envelope byte-identity guard).
    wire = SettingsRecord(user_id=uid).to_wire()
    assert set(wire.keys()) == {"active_persona_id", "default_ticker", "theme"}, \
        f"settings to_wire drifted: {set(wire.keys())}"
    assert "scan_view" not in wire, "scan_view must NOT ride the settings wire (auth envelope)"

    # 2. round-trip the view JSON through the settings port (the D1 storage locus).
    view = {"symbols": ["SPY", "QQQ"], "name": "Morning",
            "sort": {"key": "score", "dir": "desc"}, "density": "compact"}
    stores.settings.update(uid, {"scan_view": json.dumps(view)})
    rec = stores.settings.get(uid)
    assert rec is not None and rec.scan_view is not None, "scan_view not persisted"
    assert json.loads(rec.scan_view) == view, f"scan_view round-trip failed: {rec.scan_view}"

    # 3. a later subset update (theme) must NOT clobber the saved scan_view (server-wins subset).
    stores.settings.update(uid, {"theme": "light"})
    rec2 = stores.settings.get(uid)
    assert rec2.theme == "light" and json.loads(rec2.scan_view) == view, \
        f"subset theme update clobbered scan_view: {rec2}"

    # 4. updating scan_view must NOT clobber theme.
    view2 = dict(view); view2["density"] = "comfortable"
    stores.settings.update(uid, {"scan_view": json.dumps(view2)})
    rec3 = stores.settings.get(uid)
    assert rec3.theme == "light" and json.loads(rec3.scan_view)["density"] == "comfortable", \
        f"scan_view update clobbered theme: {rec3}"


def main() -> int:
    try:
        run()
    except AssertionError as e:
        print(f"FAIL: {e}")
        return 1
    print("PASS: scan_view rides the settings ports; to_wire stays byte-identical")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 6: RED — break the `to_wire` guard, observe FAIL**

Temporarily add `"scan_view": self.scan_view,` to `SettingsRecord.to_wire()` (Step 1), then run:
```bash
cd apps/api && .venv/Scripts/python.exe -m src.auth._scanview_selftest
```
Expected: `FAIL: settings to_wire drifted: {...'scan_view'...}` (exit 1). **Restore** `to_wire()` to the three-key form (no `scan_view`).

- [ ] **Step 7: GREEN — full contract passes + Postgres import-safety**

```bash
cd apps/api && .venv/Scripts/python.exe -m src.auth._scanview_selftest
```
Expected: `PASS: scan_view rides the settings ports; to_wire stays byte-identical` (exit 0).
```bash
cd apps/api && .venv/Scripts/python.exe -c "import src.auth.postgres_store as p; print('pg settings cols:', p._SETTINGS_COLS); import inspect; assert 'scan_view' in p._SETTINGS_COLS; print('pg ok')"
```
Expected: `pg settings cols: user_id, active_persona_id, default_ticker, theme, scan_view` then `pg ok`.

Parity-review checklist (record in the commit body — crux (d), no live PG): the `settings` table carries `scan_view TEXT` (nullable) on **both** adapters; the Postgres adapter additionally runs the idempotent `ALTER TABLE settings ADD COLUMN IF NOT EXISTS scan_view TEXT` for already-deployed DBs; the `update` allow-list `("active_persona_id","default_ticker","theme","scan_view")` matches on both; `_row_to_settings` / the `SELECT *`-mapped reads reconstruct `scan_view` in both.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/auth/ports.py apps/api/src/auth/sqlite_store.py apps/api/src/auth/postgres_store.py apps/api/src/auth/service.py apps/api/src/auth/_scanview_selftest.py
git commit -m "feat(scanner): per-account scan-view field on the settings record (auth ports + sqlite/postgres adapters + service; to_wire unchanged)"
```

---

### Task 2: The universe accessor + `GET /api/scan/universe`, registered before the `/{ticker}` catch-all

> Item **1** (the universe read). Adds a process-cached web-side accessor over the P2 loader, the first `/api/scan*` route, and the **route-registration-order** discipline the whole read API depends on. Verified by `TestClient` (no live server) + a structural ordering assertion.

**Files:**
- Modify: `apps/api/src/scanner/universe.py` (add `get_universe()` cached accessor)
- Modify: `apps/api/src/scanner/__init__.py` (re-export `get_universe`)
- Modify: `apps/api/main.py` (imports + the Scanner read API section + `GET /api/scan/universe`, before the catch-all)
- Create: `apps/api/scan_universe_selftest.py`

**Interfaces:**
- Produces (Tasks 3–5 + the warm-click consume these):
  - `src.scanner.universe.get_universe() -> UniverseConfig` — process-cached (loaded once; edit-config-and-restart is the D3 story). The worker calls `load_universe()` fresh at start; the web app memoizes here.
  - `GET /api/scan/universe` → `{"symbols": list[str], "universe_size": int}` (UniverseResponse), anonymous-open, always 200.

- [ ] **Step 1: Add the cached web-side accessor to `universe.py`**

In `apps/api/src/scanner/universe.py`, append after `load_universe` (leave `load_universe` **unchanged** — the worker uses it fresh):

```python
_CACHED: UniverseConfig | None = None


def get_universe() -> UniverseConfig:
    """Process-cached universe config for the WEB read path (Scanner v1 P3). Loaded ONCE (D3: edit the
    checked-in config + restart to change it — no hot-reload). The sweep worker calls load_universe()
    fresh at its own start; the web app memoizes it here so /api/scan* reads don't re-read the file per
    request. Raises the same ValueError as load_universe on a missing/empty config."""
    global _CACHED
    if _CACHED is None:
        _CACHED = load_universe()
    return _CACHED
```

Re-export it from `apps/api/src/scanner/__init__.py` — replace the import + `__all__`:

```python
from .universe import UniverseConfig, get_universe, load_universe  # noqa: E402

__all__ = ["UniverseConfig", "get_universe", "load_universe"]
```

- [ ] **Step 2: Import the leaf + universe accessor into `main.py`**

In `apps/api/main.py`, add these imports next to the existing leaf imports (after `from src import auth` / `from src.auth.router import router as auth_router`, ~line 46). `scanstore` + `scanner.universe` are one-way leaves; `main.py` is the sole web orchestration boundary that reads them (the invariant):

```python
# Scanner (Scanner v1): two one-way LEAVES read ONLY here (main.py is the sole web orchestration
# boundary; no scoring module imports them). `scanstore` is the sweep's persistent store (read for
# /api/scan* + the warm-click bundle-blob); `src.scanner.universe` is the owner-curated universe the
# read API + the view validator resolve against. NEVER imported by engine/signals/live/darkpool/
# chain_store/compute_ticker ([additive-keeps-score-byte-identical]).
from src import scanstore
from src.scanner.universe import get_universe
```

- [ ] **Step 3: Add the Scanner read API section with `GET /api/scan/universe` (before the catch-all)**

In `apps/api/main.py`, insert this section **immediately before** the `# Friendly per-ticker route` comment / `@app.get("/{ticker}")` catch-all (currently `main.py:1401`). This task adds only the universe route + the shared response helper; Tasks 3–5 extend this same section. Registering here (before the catch-all decorator executes) guarantees the routes register first:

```python
# ============================================================================ Scanner read API (P3)
# The scanner's WEB surface: three anonymous-open, best-effort-200 READS + one server-gated WRITE, all
# reading the P1/P2 ScanStore. Registered HERE — BEFORE the /{ticker} catch-all alias below — so
# scan/universe/view are never swallowed as a ticker symbol (INTERFACE §1 / ARCHITECTURE §9). These
# reads are NOT an auth failure domain: a store outage degrades to a 200 + status, never a 5xx.

def _scan_view_response(view: dict, source: str, authenticated: bool) -> dict:
    """The ScanView wire (INTERFACE §2.3). `source`/`authenticated` are response-time facts (not
    stored); the rest comes from the resolved view dict, with the closed defaults applied."""
    return {
        "source": source,
        "authenticated": authenticated,
        "name": view.get("name"),
        "symbols": list(view.get("symbols") or []),
        "sort": view.get("sort") or {"key": "score", "dir": "desc"},
        "density": view.get("density") or "compact",
    }


@app.get("/api/scan/universe")
async def get_scan_universe():
    """The read-only owner-curated tracked universe for the view editor (INTERFACE §3.2). Anonymous-
    open, always 200. No add/request/remove path in v1 ([no-universe-admin])."""
    try:
        symbols = list(get_universe().universe)
    except Exception:
        logger.warning("scan: universe config unavailable; returning empty list", exc_info=False)
        symbols = []
    return {"symbols": symbols, "universe_size": len(symbols)}
```

- [ ] **Step 4: Write the universe + route-order selftest (TestClient; no live server)**

Create `apps/api/scan_universe_selftest.py`:

```python
"""Runnable check for GET /api/scan/universe + the route-registration-order invariant (Scanner v1
Plan 3 Task 2). No pytest, no live uvicorn, no vendor key: FastAPI's TestClient against main.app.
Run: apps/api/.venv/Scripts/python.exe scan_universe_selftest.py  (cwd = apps/api). 0=pass,1=fail."""
from __future__ import annotations

import os
import tempfile

# Point the scan store at a throwaway sqlite so nothing writes into ./data (the store is opened
# lazily on first /api/scan* hit). Set BEFORE importing main.
os.environ.setdefault("SCAN_STORE_PATH", os.path.join(tempfile.mkdtemp(), "scan.sqlite3"))

from fastapi.testclient import TestClient   # noqa: E402
import main                                 # noqa: E402

client = TestClient(main.app)


def _route_index(path: str) -> int:
    for i, r in enumerate(main.app.routes):
        if getattr(r, "path", None) == path:
            return i
    return -1


def check_universe() -> None:
    r = client.get("/api/scan/universe")
    assert r.status_code == 200, f"universe status {r.status_code}"
    body = r.json()
    assert isinstance(body.get("symbols"), list) and body["symbols"], f"symbols empty: {body}"
    assert body.get("universe_size") == len(body["symbols"]), f"size mismatch: {body}"
    # not swallowed as a ticker: this is the universe envelope, NOT a ticker bundle.
    assert "market_state" not in body, "universe route swallowed by a ticker handler"


def check_route_order() -> None:
    catchall = _route_index("/{ticker}")
    assert catchall >= 0, "the /{ticker} catch-all route must exist"
    for p in ("/api/scan", "/api/scan/universe", "/api/scan/view"):
        idx = _route_index(p)
        assert idx >= 0, f"scan route {p} is not registered"
        assert idx < catchall, f"{p} (idx {idx}) must register BEFORE /{{ticker}} (idx {catchall})"


def main_() -> int:
    try:
        check_universe()
        check_route_order()
    except AssertionError as e:
        print(f"FAIL: {e}")
        return 1
    print("PASS: /api/scan/universe envelope + scan routes register before the /{ticker} catch-all")
    return 0


if __name__ == "__main__":
    raise SystemExit(main_())
```

(The `check_route_order` also references `/api/scan` and `/api/scan/view`, which land in Tasks 3–4; at Task 2 those `_route_index` lookups return `-1` → the assertion FAILs with "is not registered". That is expected until Task 4. Run **only `check_universe`** at Task 2 by temporarily commenting `check_route_order()` in `main_()`, or accept the ordering block lights up green only once all four routes exist — see Step 5.)

- [ ] **Step 5: Run it (GREEN for the universe slice)**

At Task 2 only `/api/scan/universe` exists, so run the universe check in isolation:
```bash
cd apps/api && .venv/Scripts/python.exe -c "import scan_universe_selftest as s; s.check_universe(); print('PASS: universe envelope')"
```
Expected: logs (`Market-data provider: massive`, `[universe] loaded 25 …`, `Scan store (sqlite-disk): …`) then `PASS: universe envelope`. The full `scan_universe_selftest.py` (with the route-order block) goes GREEN once Task 4 registers `/api/scan/view`; re-run it there.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/scanner/universe.py apps/api/src/scanner/__init__.py apps/api/main.py apps/api/scan_universe_selftest.py
git commit -m "feat(scanner): GET /api/scan/universe + cached universe accessor; scan routes register before the /{ticker} catch-all"
```

---

### Task 3: `GET /api/scan` (default-view D2 + building-fill) + `GET /api/scan/view`

> Item **1** (the scan + view reads). Resolves the requested-or-default view (D2), applies the **building-fill** rule (every view symbol present; synthesize a `building` placeholder when the store has no row), and returns the `ScanResponse` envelope. Both anonymous-open, best-effort **always 200 + status, never 5xx**. Verified by `TestClient` with an injected store row.

**Files:**
- Modify: `apps/api/main.py` (config constant + view-resolution helpers + the two GET routes, in the Scanner read API section)
- Create: `apps/api/scan_read_selftest.py`

**Interfaces:**
- Consumes: `scanstore.get_store().read_rows` / `read_heartbeat`, `get_universe()`, `auth.get_service().get_scan_view`, `_resolve_auth`, `_scan_view_response` (Task 2).
- Produces (Task 6 conformance asserts):
  - `GET /api/scan/view` → a `ScanView` (INTERFACE §3.3).
  - `GET /api/scan` → `{"view": ScanView, "rows": ScanRow[], "sweep": SweepHeartbeat|null}` (INTERFACE §3.1).
  - Module helpers `_effective_view(request) -> tuple[dict, str, bool]`, `_default_view_dict() -> dict`, `_building_row_wire(symbol) -> dict`, `_parse_saved_view(raw) -> dict|None`.

- [ ] **Step 1: Add the default-view fallback-size config constant**

In `apps/api/main.py`, add near the tier-band config (after `TIER_PRIME_SCORE`, ~line 119):

```python
# --- Scanner default-view (D2) fallback size (Scanner v1 P3) ---
# When no explicit owner default_view list is configured, the anonymous/new-user view falls back to
# the top-N tracked symbols by current score (empty store -> the first N universe symbols as
# `building`). N=20 (INTERFACE §3.1). The shipped config carries an explicit default_view, so this
# path is the unset-config fallback. Operator-tunable; runtime env only.
SCAN_DEFAULT_VIEW_N = int(os.getenv("SCAN_DEFAULT_VIEW_N", "20"))
```

- [ ] **Step 2: Add the view-resolution + building-fill helpers + the two GET routes**

In `apps/api/main.py`, in the Scanner read API section (after `_scan_view_response`, before the `/{ticker}` catch-all), add:

```python
def _parse_saved_view(raw: str) -> "dict | None":
    """Deserialize a stored scan_view JSON string into a view dict; None on any parse fault (a
    corrupt/legacy value degrades to the default view, never a 5xx)."""
    try:
        v = json.loads(raw)
    except Exception:
        return None
    if not isinstance(v, dict) or not isinstance(v.get("symbols"), list):
        return None
    return v


def _default_view_symbols() -> list:
    """D2 default-view symbol list. Explicit owner default_view when non-empty; else top-N-by-current-
    score from the store (empty store -> the first N universe symbols, which become `building` rows).
    Best-effort: a universe/store fault degrades gracefully (never a 5xx)."""
    try:
        cfg = get_universe()
    except Exception:
        return []
    if cfg.default_view:
        return list(cfg.default_view)
    try:
        rows = {r.symbol: r for r in scanstore.get_store().read_rows(cfg.universe)}
    except Exception:
        rows = {}
    # Rank universe symbols by current score desc (None/absent last); stable in universe order. Empty
    # store -> every score is -inf -> the first N universe symbols (all become `building`).
    ranked = sorted(
        cfg.universe,
        key=lambda s: (rows[s].score if s in rows and rows[s].score is not None else float("-inf")),
        reverse=True)
    return ranked[:SCAN_DEFAULT_VIEW_N]


def _default_view_dict() -> dict:
    """The owner-curated default view bag (source: 'default')."""
    return {"symbols": _default_view_symbols(), "name": None,
            "sort": {"key": "score", "dir": "desc"}, "density": "compact"}


def _effective_view(request: Request) -> "tuple[dict, str, bool]":
    """Resolve the caller's effective view (D2). Signed-in with a saved view -> ('account', that view);
    otherwise -> ('default', the owner-curated default). `authenticated` reflects whether a session
    exists. A read is NEVER gated (AC-4): anonymous always gets a readable default."""
    resolved, ok = _resolve_auth(request)
    authed = bool(ok and resolved is not None and resolved.authenticated)
    if authed:
        try:
            raw = auth.get_service().get_scan_view(resolved.user)
        except Exception:
            raw = None
        if raw:
            parsed = _parse_saved_view(raw)
            if parsed is not None:
                return parsed, "account", True
    return _default_view_dict(), "default", authed


def _building_row_wire(symbol: str) -> dict:
    """A synthesized `building` placeholder row (INTERFACE §3.1 building-fill): present, honestly
    not-yet-computed (numeric fields null, status 'building', as_of 0.0 — NOT a freshness claim).
    Mirrors src.scanner.projection.project_building's shape via the P1 ScanRow wire."""
    return scanstore.ScanRow(
        symbol=symbol.upper(), price=None, chg_pct=None, score=None, tier=None, regime=None,
        vol_regime=None, flip=None, dist_to_flip_pct=None, call_wall=None, put_wall=None,
        dist_to_wall_pct=None, as_of=0.0, status="building").to_wire()


@app.get("/api/scan/view")
async def get_scan_view(request: Request):
    """The caller's effective view (INTERFACE §3.3). Anonymous-open, always 200 — a read is never
    gated; anonymous always gets a readable default (AC-4)."""
    view, source, authed = _effective_view(request)
    return _scan_view_response(view, source, authed)


@app.get("/api/scan")
async def get_scan(request: Request):
    """The requested-or-default view as slim rows + sweep metadata (INTERFACE §3.1). Anonymous-open,
    best-effort ALWAYS 200 + status — a store outage degrades content (stale/building rows, sweep
    null), never a 5xx. Every view symbol is present in `rows` (building-fill)."""
    view, source, authed = _effective_view(request)
    view_wire = _scan_view_response(view, source, authed)
    symbols = view_wire["symbols"]

    try:
        stored = {r.symbol: r for r in scanstore.get_store().read_rows(symbols)}
    except Exception:
        logger.warning("scan: read_rows faulted; serving building-filled degraded 200", exc_info=False)
        stored = {}
    # Building-fill: the stored row as-is (worker owns its status) or a synthesized building placeholder.
    rows = [stored[s].to_wire() if s in stored else _building_row_wire(s) for s in symbols]

    try:
        hb = scanstore.get_store().read_heartbeat()
    except Exception:
        logger.warning("scan: read_heartbeat faulted; sweep=null", exc_info=False)
        hb = None
    return {"view": view_wire, "rows": rows, "sweep": hb.to_wire() if hb is not None else None}
```

- [ ] **Step 3: Write the read selftest (default view + building-fill; TestClient)**

Create `apps/api/scan_read_selftest.py`:

```python
"""Runnable check for GET /api/scan + GET /api/scan/view (Scanner v1 Plan 3 Task 3). No pytest, no
live uvicorn, no vendor key: TestClient against main.app, with a real row injected into the store to
exercise building-fill. Run: apps/api/.venv/Scripts/python.exe scan_read_selftest.py (cwd=apps/api)."""
from __future__ import annotations

import os
import tempfile

os.environ.setdefault("SCAN_STORE_PATH", os.path.join(tempfile.mkdtemp(), "scan.sqlite3"))

from fastapi.testclient import TestClient   # noqa: E402
import main                                 # noqa: E402
from src.scanstore import ScanRow           # noqa: E402

client = TestClient(main.app)


def _ok_row(sym: str) -> ScanRow:
    return ScanRow(symbol=sym, price=500.0, chg_pct=1.2, score=82.0, tier="prime",
                   regime="positive_gamma", vol_regime="iv_rich", flip=495.0, dist_to_flip_pct=1.0,
                   call_wall=510.0, put_wall=490.0, dist_to_wall_pct=-2.0, as_of=1000.0, status="ok")


def check_view_default() -> None:
    r = client.get("/api/scan/view")
    assert r.status_code == 200, f"view status {r.status_code}"
    v = r.json()
    assert v["source"] == "default" and v["authenticated"] is False, v
    assert isinstance(v["symbols"], list) and v["symbols"], v
    assert v["sort"] == {"key": "score", "dir": "desc"} and v["density"] == "compact", v
    assert v["name"] is None, v


def check_scan_building_fill() -> None:
    # Inject a real row for a default-view symbol (SPY is in the shipped config's default_view).
    main.scanstore.get_store().upsert_row(_ok_row("SPY"))
    r = client.get("/api/scan")
    assert r.status_code == 200, f"scan status {r.status_code}"
    body = r.json()
    assert set(body) >= {"view", "rows", "sweep"}, f"envelope keys: {set(body)}"
    rows = {row["symbol"]: row for row in body["rows"]}
    # every view symbol is present (building-fill): no dead screen.
    assert set(rows) == set(body["view"]["symbols"]), \
        f"building-fill gap: {set(rows)} vs {body['view']['symbols']}"
    # the stored row is returned as-is (ok + consumed score).
    assert rows["SPY"]["status"] == "ok" and rows["SPY"]["score"] == 82.0, rows["SPY"]
    # a symbol with no stored row is a synthesized building placeholder (nulls, as_of=0.0).
    other = next(s for s in body["view"]["symbols"] if s != "SPY")
    assert rows[other]["status"] == "building" and rows[other]["as_of"] == 0.0, rows[other]
    assert rows[other]["score"] is None and rows[other]["price"] is None, rows[other]
    # sweep is object|null — null on a fresh boot (no heartbeat written).
    assert body["sweep"] is None or isinstance(body["sweep"], dict), body["sweep"]
    # row wire keys are the FIXED P1 ScanRow.to_wire keys (no rename/add).
    assert set(rows["SPY"]) == {
        "symbol", "price", "chg_pct", "score", "tier", "regime", "vol_regime", "flip",
        "dist_to_flip_pct", "call_wall", "put_wall", "dist_to_wall_pct", "as_of", "status"}, rows["SPY"]


def main_() -> int:
    try:
        check_view_default()
        check_scan_building_fill()
    except AssertionError as e:
        print(f"FAIL: {e}")
        return 1
    print("PASS: /api/scan default-view + building-fill + /api/scan/view (anonymous-open, 200)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main_())
```

- [ ] **Step 4: RED — break building-fill, observe FAIL**

Temporarily change `get_scan`'s row comprehension to skip missing symbols:
`rows = [stored[s].to_wire() for s in symbols if s in stored]`, then run:
```bash
cd apps/api && .venv/Scripts/python.exe scan_read_selftest.py
```
Expected: `FAIL: building-fill gap: {'SPY'} vs [...]` (exit 1). **Restore** the building-filled comprehension (`stored[s].to_wire() if s in stored else _building_row_wire(s)`).

- [ ] **Step 5: GREEN**

```bash
cd apps/api && .venv/Scripts/python.exe scan_read_selftest.py
```
Expected: `PASS: /api/scan default-view + building-fill + /api/scan/view (anonymous-open, 200)` (exit 0).

- [ ] **Step 6: Commit**

```bash
git add apps/api/main.py apps/api/scan_read_selftest.py
git commit -m "feat(scanner): GET /api/scan (default-view D2 + building-fill) + GET /api/scan/view — anonymous-open best-effort 200"
```

---

### Task 4: The server-gated `PUT /api/scan/view` (401/403 · 422 · 200 echo)

> Item **2** (the server-gated write). Persists the per-account view behind the Task-1 settings ports, enforced **server-side**: real **403/503** signed-out (nothing persists even if the FE guard is bypassed), **422** for an off-universe symbol / bad sort / bad density, **200** echo of the saved view for a signed-in caller. RED→GREEN: drop the gate → an anonymous PUT is no longer refused → FAIL; restore → PASS.

**Files:**
- Modify: `apps/api/main.py` (sort/density enums + the loose write body + validation + the `PUT` route, in the Scanner read API section)
- Create: `apps/api/scan_view_write_selftest.py`

**Interfaces:**
- Consumes: `_gate_or_response`, `_resolve_auth`, `get_universe()`, `auth.get_service().save_scan_view`, `auth.AuthError`, `_scan_view_response` (Tasks 1–3).
- Produces:
  - `PUT /api/scan/view` (body `ViewWriteBody`, INTERFACE §3.4): 200 echo `ScanView(source:'account')` · 403/503 signed-out · 422 validation.
  - `ScanViewBody` (loose pydantic model — validation runs server-side after the gate); `SCAN_SORT_KEYS`, `SCAN_SORT_DIRS`, `SCAN_DENSITIES` closed enums; `_normalize_view_or_422(body, cfg) -> tuple[dict|None, JSONResponse|None]`.

- [ ] **Step 1: Add the enums, the loose write body, the validator, and the gated PUT**

In `apps/api/main.py`, in the Scanner read API section (after `get_scan`, before the `/{ticker}` catch-all), add. `BaseModel` is already imported at `main.py:1146` (the AI-rec section, above this one), so it is in scope here:

```python
# Closed view-write vocabularies (INTERFACE §2.3). A value outside these is a 422 (AC-13): the editor
# cannot invent, add, or request universe symbols / sort keys / densities.
SCAN_SORT_KEYS = ("score", "symbol", "price", "chg_pct", "dist_to_flip_pct", "dist_to_wall_pct")
SCAN_SORT_DIRS = ("asc", "desc")
SCAN_DENSITIES = ("compact", "comfortable")


class ScanViewBody(BaseModel):
    """PUT /api/scan/view body (INTERFACE §3.4). LOOSE types on purpose: semantic validation runs
    INSIDE the handler, AFTER the auth gate, so a cookieless malformed PUT is refused by the gate
    (403) — never pre-empted by a pydantic 422 ([server-side-gate-enforcement]: nothing validates or
    persists signed-out)."""
    symbols: list[str] | None = None
    name: str | None = None
    sort: dict | None = None
    density: str | None = None


def _v422(detail: str) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": detail})


def _normalize_view_or_422(body: ScanViewBody, cfg) -> "tuple[dict | None, JSONResponse | None]":
    """Validate the write body against the CURRENT universe; return (normalized_view, None) or
    (None, 422). Symbols must be a non-empty subset of the universe (canonical UPPER, order + de-dupe
    preserved); sort/density are closed enums."""
    if not isinstance(body.symbols, list) or not body.symbols:
        return None, _v422("symbols must be a non-empty subset of the tracked universe.")
    universe = set(cfg.universe)
    seen: set = set()
    symbols: list = []
    for s in body.symbols:
        u = (s or "").strip().upper()
        if not u:
            continue
        if u not in universe:
            return None, _v422(f"'{u}' is not in the tracked universe.")
        if u not in seen:
            seen.add(u)
            symbols.append(u)
    if not symbols:
        return None, _v422("symbols must include at least one universe symbol.")
    sort = body.sort or {"key": "score", "dir": "desc"}
    key = sort.get("key", "score")
    direction = sort.get("dir", "desc")
    if key not in SCAN_SORT_KEYS:
        return None, _v422(f"sort.key must be one of {list(SCAN_SORT_KEYS)}.")
    if direction not in SCAN_SORT_DIRS:
        return None, _v422("sort.dir must be 'asc' or 'desc'.")
    density = body.density or "compact"
    if density not in SCAN_DENSITIES:
        return None, _v422("density must be 'compact' or 'comfortable'.")
    return ({"symbols": symbols, "name": (body.name or None),
             "sort": {"key": key, "dir": direction}, "density": density}, None)


@app.put("/api/scan/view")
async def put_scan_view(body: ScanViewBody, request: Request):
    """Save the signed-in user's per-account view (INTERFACE §3.4). The server-side gate is the
    OUTERMOST precondition: a signed-out caller is refused (403 auth_required / 503 auth_unavailable)
    and NOTHING is validated or persisted, even if the FE guard is bypassed (AC-3,
    [server-side-gate-enforcement]). 422 on an off-universe symbol / bad sort / bad density (AC-13).
    200 echoes the saved ScanView (source:'account'; server-wins persistence-echo, the
    PUT /api/auth/settings precedent). Persisted behind the existing auth-settings ports (D1)."""
    gate = _gate_or_response(request)
    if gate is not None:
        return gate
    resolved, _ok = _resolve_auth(request)   # a valid session is guaranteed past the gate
    try:
        cfg = get_universe()
    except Exception:
        return JSONResponse(status_code=503, content={"detail": "scan universe unavailable."})
    normalized, err = _normalize_view_or_422(body, cfg)
    if err is not None:
        return err
    try:
        auth.get_service().save_scan_view(resolved.user, json.dumps(normalized))
    except auth.AuthError as e:
        return JSONResponse(status_code=e.status, content=e.envelope())
    return _scan_view_response(normalized, "account", True)
```

- [ ] **Step 2: Write the gated-write selftest (TestClient; anon gate + signed-in echo + 422)**

Create `apps/api/scan_view_write_selftest.py`:

```python
"""Runnable check for the server-gated PUT /api/scan/view (Scanner v1 Plan 3 Task 4). No pytest, no
live uvicorn, no vendor key: TestClient against main.app. Proves the WRITE gate is server-side (a
cookieless PUT is refused, nothing persists), a signed-in PUT echoes + persists across a re-read, and
off-universe / bad-enum bodies are 422. Run: apps/api/.venv/Scripts/python.exe scan_view_write_selftest.py
(cwd = apps/api). 0=pass,1=fail."""
from __future__ import annotations

import os
import tempfile

os.environ.setdefault("SCAN_STORE_PATH", os.path.join(tempfile.mkdtemp(), "scan.sqlite3"))
# The signed-in path needs the session cookie to STICK over http (TestClient is http, not https).
os.environ["AUTH_COOKIE_SECURE"] = "false"

from fastapi.testclient import TestClient   # noqa: E402
import main                                 # noqa: E402

EMAIL = "viewtest@convexa.io"
PASSWORD = "convexa-view-2026"


def _signed_in_client() -> TestClient:
    main.auth.get_service().ensure_account(email=EMAIL, password=PASSWORD, display_name="View Test")
    c = TestClient(main.app)
    r = c.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200, f"login failed {r.status_code}: {r.text[:200]}"
    return c


def check_anon_gate() -> None:
    anon = TestClient(main.app)   # no cookie
    r = anon.put("/api/scan/view", json={"symbols": ["SPY"]})
    # a REAL auth refusal (repo precedent: 403 auth_required). NOT a 200, NOT a 422 (gate is outermost).
    assert r.status_code in (401, 403), f"cookieless PUT must be gate-refused, got {r.status_code}"


def check_signed_in_echo_and_persist(c: TestClient) -> None:
    body = {"symbols": ["qqq", "SPY"], "name": "Mine",
            "sort": {"key": "symbol", "dir": "asc"}, "density": "comfortable"}
    r = c.put("/api/scan/view", json=body)
    assert r.status_code == 200, f"signed-in PUT {r.status_code}: {r.text[:200]}"
    v = r.json()
    assert v["source"] == "account" and v["authenticated"] is True, v
    assert v["symbols"] == ["QQQ", "SPY"], f"canon/order: {v['symbols']}"   # lower-in -> UPPER-out
    assert v["sort"] == {"key": "symbol", "dir": "asc"} and v["density"] == "comfortable", v
    # persists across a re-read (AC-2): GET now returns the account view.
    v2 = c.get("/api/scan/view").json()
    assert v2["source"] == "account" and v2["symbols"] == ["QQQ", "SPY"], v2
    # and GET /api/scan reflects the saved view's symbols (order = the view).
    scan = c.get("/api/scan").json()
    assert scan["view"]["symbols"] == ["QQQ", "SPY"], scan["view"]


def check_422(c: TestClient) -> None:
    assert c.put("/api/scan/view", json={"symbols": ["ZZZZ"]}).status_code == 422, "off-universe symbol"
    assert c.put("/api/scan/view",
                 json={"symbols": ["SPY"], "sort": {"key": "nope", "dir": "asc"}}).status_code == 422, "bad sort.key"
    assert c.put("/api/scan/view",
                 json={"symbols": ["SPY"], "density": "cozy"}).status_code == 422, "bad density"
    assert c.put("/api/scan/view", json={"symbols": []}).status_code == 422, "empty symbols"


def main_() -> int:
    try:
        check_anon_gate()
        c = _signed_in_client()
        check_signed_in_echo_and_persist(c)
        check_422(c)
    except AssertionError as e:
        print(f"FAIL: {e}")
        return 1
    print("PASS: PUT /api/scan/view server-gated (403 anon) + 200 echo/persist + 422 validation")
    return 0


if __name__ == "__main__":
    raise SystemExit(main_())
```

- [ ] **Step 3: RED — drop the gate, prove the server-side enforcement**

Temporarily comment out the gate in `put_scan_view` (the two lines `gate = _gate_or_response(request)` / `if gate is not None: return gate`), then run:
```bash
cd apps/api && .venv/Scripts/python.exe scan_view_write_selftest.py
```
Expected: `FAIL: cookieless PUT must be gate-refused, got 500` (a cookieless PUT now reaches `_resolve_auth` → `resolved` is None → `resolved.user` raises; the point is it is **no longer refused with 401/403** — the gate was the enforcement). **Restore** the gate. (This is the `[server-side-gate-enforcement]` RED→GREEN: without the gate an anonymous write is not refused; with it, 403 + nothing persists.)

- [ ] **Step 4: GREEN + re-run the Task-2 route-order selftest (all four routes now exist)**

```bash
cd apps/api && .venv/Scripts/python.exe scan_view_write_selftest.py
```
Expected: `PASS: PUT /api/scan/view server-gated (403 anon) + 200 echo/persist + 422 validation` (exit 0).
```bash
cd apps/api && .venv/Scripts/python.exe scan_universe_selftest.py
```
Expected: `PASS: /api/scan/universe envelope + scan routes register before the /{ticker} catch-all` (exit 0) — the route-order block is now fully satisfied (`/api/scan`, `/api/scan/universe`, `/api/scan/view` all registered, all before `/{ticker}`).

- [ ] **Step 5: Commit**

```bash
git add apps/api/main.py apps/api/scan_view_write_selftest.py
git commit -m "feat(scanner): server-gated PUT /api/scan/view (403/503 signed-out, 422 off-universe/bad enum, 200 echo)"
```

---

### Task 5: The ticker warm-click read-through of the P2 bundle-blob

> Item **3** (the warm-click). The EXISTING ticker endpoint consults the P2 bundle-blob for **tracked** symbols **before** the vendor: a fresh blob is served (a cross-process cache seed); a **miss/stale/fault falls straight through** to the normal fetch. **HARD:** the served bundle's bytes are unchanged — `compute_ticker` stays the sole transform, never edited. RED→GREEN: a stale blob must be a MISS (drop the freshness `>` check → a stale blob is served → FAIL).

**Files:**
- Modify: `apps/api/main.py` (warm-click config constant; `_tracked_symbols` + `_scan_warm_bundle` helpers in the Scanner read API section; the single guarded branch in `_compute_entry`)
- Create: `apps/api/warmclick_selftest.py`

**Interfaces:**
- Consumes: `scanstore.get_store().read_bundle_blob`, `get_universe()`, `INCLUDE_DARK_POOL`, the existing `_compute_entry` install logic.
- Produces:
  - `SCAN_WARM_MAX_AGE_SECONDS` (config, clamped ≤ `STALE_AFTER_SECONDS`).
  - `_tracked_symbols() -> frozenset`; `_scan_warm_bundle(t, min_dte, max_dte, expirations, dark_pool, now) -> dict|None` (the fresh, tracked, canonical-filter bundle from the blob, or None).
  - The warm branch in `_compute_entry` (chain_source marker `"scan_warm_hit"`; no `compute_ticker` call on a hit).

- [ ] **Step 1: Add the warm-click freshness-budget config constant**

In `apps/api/main.py`, add after the chain pre-warm config (after `CHAIN_PREWARM_MAX_AGE_SECONDS`, ~line 95):

```python
# --- Scanner warm-click read-through (Scanner v1 P3) ---
# A cold ticker request for a TRACKED symbol may serve the sweep worker's freshly-computed bundle-blob
# instead of paying the cold vendor fetch — the chain_store pre-warm precedent extended across the
# process boundary (worker writes, web reads). FRESHNESS-GATED: a blob older than this budget is a
# MISS (never served as fresh) -> normal vendor fetch. Clamped <= STALE_AFTER_SECONDS so a served blob
# can never be one the freshness contract would immediately flag stale. Only the CANONICAL bundle
# (no DTE/expiration filter, dark_pool == INCLUDE_DARK_POOL — exactly what the worker computes) is
# eligible; any filtered request differs in structure and always falls through to a fresh compute.
SCAN_WARM_MAX_AGE_SECONDS = min(
    int(os.getenv("SCAN_WARM_MAX_AGE_SECONDS", str(STALE_AFTER_SECONDS))), STALE_AFTER_SECONDS)
```

- [ ] **Step 2: Add the warm-click helpers to the Scanner read API section**

In `apps/api/main.py`, in the Scanner read API section (they are module-level; `_compute_entry` calls them at request time, so the forward reference from the earlier `_compute_entry` is fine), add:

```python
def _tracked_symbols() -> frozenset:
    """Cached frozenset of the universe (tracked) symbols for the warm-click tracked-only gate.
    Best-effort: a universe-load fault yields an empty set (no warm-click), never an error."""
    try:
        return frozenset(get_universe().universe)
    except Exception:
        return frozenset()


def _scan_warm_bundle(t: str, min_dte, max_dte, expirations, dark_pool: bool,
                      now: float) -> "dict | None":
    """Best-effort warm-click source: the sweep worker's freshly-computed bundle-blob for a TRACKED
    symbol's CANONICAL (unfiltered) request, or None (miss/stale/fault -> normal vendor fetch). It
    changes only WHERE the bundle came from — never its bytes: the blob was produced by compute_ticker
    in the worker, so compute_ticker stays the sole transform ([additive-keeps-score-byte-identical])."""
    # Only the canonical full-chain bundle the worker computes is eligible (a DTE/expiration/dark_pool-
    # varied request has a different structure and must NOT be served the worker's blob).
    if min_dte is not None or max_dte is not None or expirations is not None \
            or dark_pool != INCLUDE_DARK_POOL:
        return None
    try:
        if t.upper() not in _tracked_symbols():
            return None
        blob = scanstore.get_store().read_bundle_blob(t)
    except Exception:
        logger.debug("warm-click: bundle-blob read skipped (store outage)", exc_info=True)
        return None
    if blob is None:
        return None
    # FRESHNESS GATE: a stale blob is a MISS (never served as fresh).
    if (now - blob.as_of) > SCAN_WARM_MAX_AGE_SECONDS:
        return None
    try:
        bundle = json.loads(blob.bundle_json)
    except Exception:
        logger.debug("warm-click: bundle-blob deserialize failed; falling through to vendor",
                     exc_info=True)
        return None
    # Defensive shape gate: only a well-formed compute_ticker bundle is served.
    if not isinstance(bundle, dict) or "market_state" not in bundle \
            or "state_fingerprint" not in (bundle.get("ai_eval") or {}):
        return None
    return bundle
```

- [ ] **Step 3: Add the single guarded warm branch in `_compute_entry`**

In `apps/api/main.py`, replace the top of `_compute_entry` (the acquisition + `compute_ticker` block, currently lines ~778–795) with the warm-first branch. Everything from `_snapshot_cache[t] = ...` onward is unchanged except `pop("_snapshot")` becomes `pop("_snapshot", None)`:

```python
    # Scanner warm-click read-through (Scanner v1 P3): a cold request for a TRACKED symbol may serve
    # the sweep worker's freshly-computed bundle-blob instead of the cold vendor fetch — the
    # chain_store pre-warm precedent extended across the process boundary (worker writes, web reads).
    # BYTE-PRESERVING: the blob was produced by compute_ticker in the worker, so compute_ticker stays
    # the SOLE transform; the read-through only changes where the bundle came from (never its bytes).
    # Best-effort + freshness-gated: any miss/stale/fault falls straight through to the normal fetch
    # (no new failure surface — ARCHITECTURE §5.3).
    warm = _scan_warm_bundle(t, min_dte, max_dte, expirations, dark_pool, now)
    if warm is not None:
        bundle = warm
        chain_source = "scan_warm_hit"
        if trace is not None:
            try:
                trace.dims["chain_source"] = chain_source
            except Exception:
                pass
    else:
        market_data, underlying_history, intraday_bars, chain_source = \
            await _acquire_vendor_inputs(t, dark_pool)
        # Observability honesty (ARCH §4.4 / §6): mark how the chain was acquired (shared-hit vs
        # vendor fetch) on the trace dims — additive, operator-only, never a trader-facing field.
        if trace is not None:
            try:
                trace.dims["chain_source"] = chain_source
            except Exception:
                pass
        bundle = await asyncio.to_thread(
            compute_ticker, t, market_data, underlying_history, intraday_bars,
            min_dte, max_dte, expirations, dark_pool)
    if bundle is None:
        raise HTTPException(status_code=404, detail=f"No option-chain data available for {t}.")
    # Move the filter-independent snapshot into its ticker-keyed cache, then drop it from
    # the cached bundle (so it isn't duplicated per filter key or ever serialized).
    _snapshot_cache[t] = {"market_data": bundle.pop("_snapshot", None), "computed_at": now}
```

(The rest of `_compute_entry` — the `fingerprint`/`changed` dedupe, the `_cache[key]` install, the expired-key sweep — is **unchanged**: a warm bundle and a fresh bundle install identically and serve through the identical `_wrap`, so the served bytes are byte-identical for the same inputs.)

- [ ] **Step 4: Write the warm-click selftest (unit freshness gate + served-bytes integration)**

Create `apps/api/warmclick_selftest.py`:

```python
"""Runnable check for the ticker warm-click read-through (Scanner v1 Plan 3 Task 5). No pytest, no
live uvicorn, no vendor key: unit-tests main._scan_warm_bundle (freshness / tracked-only / canonical-
filter gates) + an end-to-end TestClient GET that serves a worker bundle-blob's bytes. Run:
apps/api/.venv/Scripts/python.exe warmclick_selftest.py  (cwd = apps/api). 0=pass,1=fail."""
from __future__ import annotations

import json
import os
import tempfile
import time

os.environ.setdefault("SCAN_STORE_PATH", os.path.join(tempfile.mkdtemp(), "scan.sqlite3"))

from fastapi.testclient import TestClient       # noqa: E402
import main                                      # noqa: E402
from src.scanstore import BundleBlob             # noqa: E402

client = TestClient(main.app)


def _bundle(fp: str = "warmfp-1", score: int = 82) -> dict:
    now_ns = int(time.time() * 1e9)
    return {
        "market_state": {"ticker": "SPY", "price": 500.0, "gex_spot": 500.0, "timestamp": now_ns,
                         "timestamp_iso": None, "gamma_flip": 495.0, "call_wall": 510.0,
                         "put_wall": 490.0},
        "signals": {"opportunity_score": score, "regime": "positive_gamma",
                    "vol_regime": "iv_rich", "setups": []},
        "strike_profile": {"ticker": "SPY", "spot": 500.0, "strikes": []},
        "expirations": [],
        "ai_eval": {"ready": True, "reasons": [], "state_fingerprint": fp},
        "_snapshot": {"ticker": "SPY", "contracts": []},
    }


def check_warm_unit() -> None:
    store = main.scanstore.get_store()
    now = time.time()
    dp = main.INCLUDE_DARK_POOL
    # fresh tracked canonical blob -> returned.
    store.write_bundle_blob(BundleBlob(symbol="SPY", as_of=now, bundle_json=json.dumps(_bundle())))
    got = main._scan_warm_bundle("SPY", None, None, None, dp, now)
    assert got is not None and got["ai_eval"]["state_fingerprint"] == "warmfp-1", got
    # STALE blob (as_of past the budget) -> MISS.
    stale_as_of = now - (main.SCAN_WARM_MAX_AGE_SECONDS + 10)
    store.write_bundle_blob(BundleBlob(symbol="SPY", as_of=stale_as_of, bundle_json=json.dumps(_bundle())))
    assert main._scan_warm_bundle("SPY", None, None, None, dp, now) is None, "stale blob must MISS"
    # UNTRACKED symbol -> MISS (even with a fresh blob present).
    store.write_bundle_blob(BundleBlob(symbol="ZZZZ", as_of=now, bundle_json=json.dumps(_bundle())))
    assert main._scan_warm_bundle("ZZZZ", None, None, None, dp, now) is None, "untracked must MISS"
    # DTE-FILTERED request -> MISS (only the canonical full-chain bundle is eligible).
    store.write_bundle_blob(BundleBlob(symbol="SPY", as_of=now, bundle_json=json.dumps(_bundle())))
    assert main._scan_warm_bundle("SPY", 7, 45, None, dp, now) is None, "DTE-filtered must MISS"


def check_warm_served_bytes() -> None:
    store = main.scanstore.get_store()
    store.write_bundle_blob(BundleBlob(
        symbol="SPY", as_of=time.time(),
        bundle_json=json.dumps(_bundle(fp="warmfp-int", score=91))))
    main._cache.clear()   # force a MISS that consults the warm blob (no in-process cache hit)
    r = client.get("/api/ticker/SPY")   # no filters + default dark_pool -> the canonical bundle
    assert r.status_code == 200, f"warm ticker GET {r.status_code}: {r.text[:200]}"
    b = r.json()
    # the served bytes came from the worker's blob (byte-identical score/tier/fingerprint) — no vendor
    # fetch happened (there is no live key here; a non-warm path would 404/degrade).
    assert b["signals"]["opportunity_score"] == 91, b["signals"].get("opportunity_score")
    assert b["signals"]["opportunity_tier"] == "prime", b["signals"].get("opportunity_tier")
    assert b["ai_eval"]["state_fingerprint"] == "warmfp-int", b["ai_eval"].get("state_fingerprint")


def main_() -> int:
    try:
        check_warm_unit()
        check_warm_served_bytes()
    except AssertionError as e:
        print(f"FAIL: {e}")
        return 1
    print("PASS: warm-click serves fresh tracked blobs byte-identically; stale/untracked/filtered MISS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main_())
```

- [ ] **Step 5: RED — break the freshness gate, observe FAIL**

Temporarily change `_scan_warm_bundle`'s freshness gate `if (now - blob.as_of) > SCAN_WARM_MAX_AGE_SECONDS:` to `if False:`, then run:
```bash
cd apps/api && .venv/Scripts/python.exe warmclick_selftest.py
```
Expected: `FAIL: stale blob must MISS` (exit 1) — a stale blob would now be served as fresh. **Restore** the freshness gate.

- [ ] **Step 6: GREEN + confirm `compute_ticker` is untouched**

```bash
cd apps/api && .venv/Scripts/python.exe warmclick_selftest.py
```
Expected: `PASS: warm-click serves fresh tracked blobs byte-identically; stale/untracked/filtered MISS` (exit 0).
```bash
cd C:/Dev/convexa && git diff --stat apps/api/src/core/ ; echo "---" ; git diff apps/api/main.py | grep -n "def compute_ticker" || echo "compute_ticker signature/body NOT in the diff (unchanged)"
```
Expected: `apps/api/src/core/` has **no** changed files, and `compute_ticker` does **not** appear in the `main.py` diff — the sole transform is untouched (`[additive-keeps-score-byte-identical]`).

- [ ] **Step 7: Commit**

```bash
git add apps/api/main.py apps/api/warmclick_selftest.py
git commit -m "feat(scanner): ticker warm-click read-through of the P2 bundle-blob (freshness-gated, byte-preserving; compute_ticker unchanged)"
```

---

### Task 6: Live conformance + GATE-Q verification sweep + env docs

> Item **4** (conformance) + the mechanical GATE-Q surface. Boots uvicorn once, runs the standalone `scanner.json` conformance (envelope-only; `rows` may be `[]`, `sweep` `null` on a fresh boot — both PASS), the cookieless anonymous-reads + gated-write curl gate, the route-order + leaf/boundary AST checks, and documents the two new env vars. No code change to the endpoints — this is the verification + docs task.

**Files:**
- Modify: `apps/api/.env.example` (worker→read-API env doc block)
- Modify: `apps/api/Dockerfile` (runtime-env header comment — names only)

**Interfaces:**
- Consumes: the shipped endpoints (Tasks 2–5) + `.spire/clusters/tech/state/conformance/scanner.json` (already authored by GATE U·X).
- Produces: the GATE-Q evidence (conformance PASS, curl gate, AST clean) + the env documentation.

- [ ] **Step 1: Re-run every P3 selftest (full surface intact)**

```bash
cd apps/api && .venv/Scripts/python.exe -m src.auth._scanview_selftest && .venv/Scripts/python.exe scan_universe_selftest.py && .venv/Scripts/python.exe scan_read_selftest.py && .venv/Scripts/python.exe scan_view_write_selftest.py && .venv/Scripts/python.exe warmclick_selftest.py
```
Expected: five `PASS: …` lines, exit 0.

- [ ] **Step 2: Leaf/boundary AST — no scoring module imports the scanner leaves (HARD)**

```bash
cd C:/Dev/convexa && rg -n "scanstore|from src.scanner|import scanner" apps/api/src/core/engine.py apps/api/src/core/signals.py apps/api/src/core/live.py apps/api/src/core/darkpool.py apps/api/src/core/chain_store.py || echo "CLEAN: no scoring module imports scanstore/scanner"
```
Expected: `CLEAN: no scoring module imports scanstore/scanner` (zero matches). Confirm the only readers are `main.py` (web) + `worker.py` (producer):
```bash
cd C:/Dev/convexa && rg -l "from src import scanstore|from src.scanner" apps/api/main.py apps/api/worker.py
```
Expected: both files listed (they are the two allowed orchestration boundaries).

- [ ] **Step 3: Boot the backend (live) for the conformance + curl gate**

Boot uvicorn on :8000 with a throwaway scan store (so no `data/` file is written) and cookie-insecure for the signed-in curl (optional). Prefer the nx target; fall back to the venv Python directly if node/nvm is not on PATH:
```bash
cd C:/Dev/convexa && npx nx serve api
# fallback (no node on PATH): cd apps/api && SCAN_STORE_PATH="$(python -c 'import tempfile,os;print(os.path.join(tempfile.mkdtemp(),"scan.sqlite3"))')" AUTH_COOKIE_SECURE=false .venv/Scripts/python.exe main.py
```
Wait for `Uvicorn running on http://127.0.0.1:8000`. (Leave it running in a second terminal for Steps 4–6.)

- [ ] **Step 4: Run the standalone conformance spec live (system-1 GREEN)**

```bash
cd C:/Dev/convexa && apps/api/.venv/Scripts/python.exe .claude/tools/interface_conformance.py --spec .spire/clusters/tech/state/conformance/scanner.json --url http://127.0.0.1:8000
```
Expected:
```
interface_conformance — 2 endpoint(s)
  PASS  GET /api/scan — 7 required field(s) present + well-typed
  PASS  GET /api/scan/universe — 2 required field(s) present + well-typed

  0 endpoint failure(s).
```
(Envelope-only: `rows` may be `[]` and `sweep` `null` on a fresh boot — both PASS. No ticker warm-up needed — these are store reads, not a cold vendor fetch.)

- [ ] **Step 5: Anonymous-open reads + the route-order not-swallowed check (curl gate)**

```bash
cd C:/Dev/convexa
curl -s -o /dev/null -w "scan=%{http_code}\n"          http://127.0.0.1:8000/api/scan
curl -s -o /dev/null -w "universe=%{http_code}\n"      http://127.0.0.1:8000/api/scan/universe
curl -s -o /dev/null -w "view=%{http_code}\n"          http://127.0.0.1:8000/api/scan/view
curl -s http://127.0.0.1:8000/api/scan/universe | python -c "import sys,json;d=json.load(sys.stdin);print('universe_size' in d and 'market_state' not in d)"
```
Expected: `scan=200`, `universe=200`, `view=200`, then `True` (the universe route returns the universe envelope — **not** a ticker bundle → not swallowed by `/{ticker}`).

- [ ] **Step 6: The gated WRITE (the `[server-side-gate-enforcement]` catch — cookieless)**

```bash
cd C:/Dev/convexa
curl -s -o /dev/null -w "anon_put=%{http_code}\n" -X PUT http://127.0.0.1:8000/api/scan/view \
  -H "Content-Type: application/json" -d '{"symbols":["SPY"]}'
curl -s -o /dev/null -w "bad_symbol_needs_auth=%{http_code}\n" -X PUT http://127.0.0.1:8000/api/scan/view \
  -H "Content-Type: application/json" -d '{"symbols":["ZZZZ"]}'
```
Expected: `anon_put=403` (a real auth refusal — nothing persisted), and `bad_symbol_needs_auth=403` (the gate is OUTERMOST — a cookieless caller is refused **before** the 422 validation runs, so nothing validates or persists signed-out). The signed-in 200-echo/422 paths are covered by `scan_view_write_selftest.py` (Task 4). Stop the server when done.

- [ ] **Step 7: Document the two new env vars (docs, not secrets)**

Append to `apps/api/.env.example` after the existing Scanner sweep-worker block:
```
# --- Scanner read API (Scanner v1 P3). All optional; defaults shown. ---
# SCAN_DEFAULT_VIEW_N=20            # default-view fallback size (top-N by score) when no explicit default_view list
# SCAN_WARM_MAX_AGE_SECONDS=120    # ticker warm-click freshness budget (clamped <= STALE_AFTER_SECONDS); older blob => miss
```
Add the var NAMES to the `apps/api/Dockerfile` runtime-env header comment (names only, never values), extending the existing Scanner list:
```
#   SCAN_DEFAULT_VIEW_N, SCAN_WARM_MAX_AGE_SECONDS
```
(The Dockerfile `CMD` stays `uvicorn main:app …` — no image change; the read API rides the existing web process.)

- [ ] **Step 8: Commit**

```bash
git add apps/api/.env.example apps/api/Dockerfile
git commit -m "chore(scanner): P3 conformance + gate/route-order/leaf-AST verification + read-API env docs"
```

---

## Self-Review

- **Spec coverage (the 4 items the plan MUST cover):**
  1. **The scan read endpoints** → Task 2 (`GET /api/scan/universe`) + Task 3 (`GET /api/scan` with D2 default-view resolution + building-fill + the `ScanResponse` envelope; `GET /api/scan/view`). Anonymous-open, best-effort **always 200** (store faults wrapped → degraded 200, never 5xx). Registered before the `/{ticker}` catch-all (Task 2 placement + the Task-2 ordering assertion). ✓
  2. **The server-gated `PUT /api/scan/view`** → Task 4 (persisted as the `scan_view` field on `SettingsRecord` behind the existing auth-settings ports — Task 1; enforced server-side: 403/503 signed-out, 422 off-universe/bad sort/density, 200 echo; nothing persists signed-out even if the FE guard is bypassed — RED→GREEN Step 3). ✓
  3. **The ticker warm-click read-through** → Task 5 (the existing `_compute_entry` consults `read_bundle_blob` for **tracked** symbols on the **canonical** filter **before** the vendor; best-effort, freshness-gated, miss/stale → normal fetch; `compute_ticker` unchanged — Step 6 diff proof; served bytes byte-identical — the served-bytes integration check). ✓
  4. **Conformance** → Task 6 (live `interface_conformance.py --spec .spire/clusters/tech/state/conformance/scanner.json` GREEN on both anonymous reads, envelope-only; `rows`=`[]` / `sweep`=`null` on a fresh boot both PASS). ✓
- **Invariants structurally preserved:** `[additive-keeps-score-byte-identical]` — warm-click serves a prior-`compute_ticker` bundle (never re-transforms); 0 edits to `engine.py`/`signals.py`/`live.py`/`darkpool.py`/`chain_store.py`/`compute_ticker` (Task 5 Step 6 + Task 6 Step 2 AST); `scanstore`/`scanner` read only in `main.py`/`worker.py`. `[best-effort-isolated-or-null]` — every read wrapped best-effort → degraded 200; auth carve-out on the PUT only (403/503). `[server-side-gate-enforcement]` — the PUT gate is outermost + server-side (RED→GREEN). `[live-vs-static-isolation]` — plain REST store reads, no SSE. `[model-read-carries-its-assumptions]`/`[digested-labels-not-raw-dump]` — per-row `as_of`+`status`, building-fill `as_of` not a freshness claim, closed enums, no raw series. `[no-secrets-in-image]` — only two non-secret env tunables added. `[loss-free-durable-migration]`-adjacent — the Postgres `scan_view` column uses idempotent `ADD COLUMN IF NOT EXISTS`.
- **Placeholder scan:** no TBD/TODO; every step has runnable code + an exact command (cwd noted) + expected output. Four RED→GREEN disciplines (Task 1 to_wire guard, Task 3 building-fill, Task 4 the gate, Task 5 the freshness gate).
- **Type consistency:** `ScanRow.to_wire()` / `SweepHeartbeat.to_wire()` P1 keys reused verbatim (never renamed); `ScanView`/`ScanResponse`/`UniverseResponse` match INTERFACE §2–§3; `SettingsRecord.scan_view` field + `get_scan_view`/`save_scan_view` names identical across ports/adapters/service/main; `SCAN_SORT_KEYS`/`SCAN_SORT_DIRS`/`SCAN_DENSITIES` match `SortKey`/`ViewSort`/`density` (INTERFACE §2.3); `_scan_warm_bundle` reads the P2 `BundleBlob.as_of`/`bundle_json`; `_gate_or_response`/`_resolve_auth`/`compute_opportunity_tier` called with their real signatures.
- **Grounded in real code:** mirrors `apps/api/main.py::_acquire_vendor_inputs` (the `chain_store.get_fresh` pre-warm precedent the warm-click extends across the process boundary) + `_compute_entry`/`_serve`/`_wrap` (the cache-install + serve-time-tier-overlay path a warm bundle rides unchanged) + `_gate_or_response`/`_resolve_auth` (the sim-trade/ai-rec/`PUT /api/auth/settings` gate the view WRITE mirrors) + the `@app.get("/{ticker}")` catch-all at `main.py:1403` (the route-order anchor); `apps/api/src/auth/{ports,service,router,sqlite_store,postgres_store}.py` (the `SettingsRecord`/`UserSettingsStore.update` subset-write the `scan_view` field rides + the §3.7 schema-evolution seam); `apps/api/src/scanner/universe.py` (the P2 loader the cached `get_universe()` wraps); `apps/api/src/scanstore/ports.py` (`ScanRow`/`SweepHeartbeat`/`BundleBlob` + `read_rows`/`read_heartbeat`/`read_bundle_blob`); `.claude/tools/interface_conformance.py` + `.spire/clusters/tech/state/conformance/scanner.json`/`iv_rank.json` (the standalone-spec run precedent).

## The rest of Scanner v1 — Plan 4 (roadmap; write it when P3 lands)

- **Plan 4 — Frontend `/scanner` page.** Swap the stub (`apps/dashboard/src/pages/scanner/Scanner.tsx`); the dense terminal table + view editor + the **four states** (skeleton / empty / worker-down banner / per-row degrade) + mobile card collapse + the `libs/api` fetchers (`getScan`/`getScanUniverse`/`getScanView`/`saveScanView`) that CONSUME this P3 wire. References `docs/design/DESIGN_SYSTEM.md` + the **convexa-design** skill (StatTile / TintChip[`emphasis` tone for tier] / `useFlashOnChange` for the sanctioned price-cell flash / Widget); the FE derives "sweep last ran Xm ago" from the `SweepHeartbeat` epochs (never the word "live"); renders `tier`/`regime`/`vol_regime`/`status` via a **closed lookup** (an unknown value renders no label); branches on `status === 'building'` before reading `as_of`; green/red for **price direction only**; the view editor selects only from `GET /api/scan/universe` and is gated on save by `PUT /api/scan/view`'s real 401/403. `/scanner` joins the 393px no-overflow e2e route set. Consumes Plan 3's API.
