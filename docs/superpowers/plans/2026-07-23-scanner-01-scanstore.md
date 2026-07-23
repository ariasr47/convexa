# Scanner v1 — Plan 1 of 4: The ScanStore persistence layer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the persistent `ScanStore` — the sink the sweep worker writes scan rows + a heartbeat into, and the source the read API serves from — mirroring the shipped `marketdata` (iv-rank) store pattern exactly.

**Architecture:** Approach C (separate sweep worker + shared store + warm-click read-through). This plan is the store only: a new one-way-leaf subpackage `apps/api/src/scanstore/` with a record + port (ABC) + on-disk SQLite adapter (default) + Postgres adapter (prod, behind the same port) + an env-selected factory. It is a **structural sibling of `src/marketdata/`** and is NEVER imported by engine/signals/live/darkpool/the bundle-compute path — that boundary is the score-byte-identity guarantee.

**Tech Stack:** Python 3.12, stdlib `sqlite3` (default adapter), `psycopg` 3 + `psycopg_pool` (Postgres adapter — already a backend dependency), FastAPI backend under `apps/api`. No new pip dependency.

## Global Constraints

Every task's requirements implicitly include these (copied from the spec + project canon):

- **Leaf import rule (structural):** `scanstore/` imports ONLY stdlib (+ `psycopg` lazily, in the Postgres adapter only). It NEVER imports `engine.py` / `signals.py` / `live.py` / `darkpool.py` / `chain_store.py` / `main.py`. This is what makes `[additive-keeps-score-byte-identical]` hold by construction — no scan row can become a scoring input.
- **`[best-effort-isolated-or-null]`:** a store fault is a caught, logged degradation, never a crash. An unreachable Postgres at boot must NOT crash the process — defer the fault to first use (mirror `marketdata/postgres_store.py`).
- **`[no-secrets-in-image]`:** the Postgres connection string is read from RUNTIME env only (`SCAN_DATABASE_URL`, falling back to `DATABASE_URL`) — never baked, never committed.
- **Latest-wins semantics (NOT iv-rank's insert-if-absent):** scan rows are CURRENT STATE, not an accumulating time series. `upsert_row` overwrites the row for a symbol (`ON CONFLICT … DO UPDATE`), unlike iv-rank's `INSERT OR IGNORE`. This is the one deliberate divergence from the template.
- **Symbols are canonicalized upper-case** at the store boundary (as `marketdata` does with tickers).
- **Test convention:** `apps/api` has **no pytest suite** (CLAUDE.md: "verified by app-run + `interface_conformance.py`"). This plan follows that convention — the store is verified by a **runnable assert-based self-check module** (`scanstore/_selftest.py`) run with the venv Python, RED→GREEN like a test. Adopting pytest for the backend is a **separate owner decision** (flagged in `## Open decision` below), deliberately NOT baked here.
- **Python idioms:** every module opens `from __future__ import annotations`; logger is `logging.getLogger("Convexa")`; the venv Python is `apps/api/.venv/Scripts/python.exe` (Windows).

## Open decision (surface to the owner; does not block this plan)

Backend TDD currently has no runner. This plan uses a runnable self-check (convention-compatible). If the owner wants real pytest for the backend going forward, that is a one-task toolchain add (`pip install pytest`, a `test` nx target, convert `_selftest.py` asserts to `test_*` functions) — recommend raising it at this plan's review, not deciding it mid-plan.

## File Structure

```
apps/api/src/scanstore/
  __init__.py          # env-selected factory: get_store() (SCAN_STORE, default "disk"), cached; re-exports port + record
  ports.py             # ScanRow + SweepHeartbeat dataclasses; ScanStore ABC (4 methods)
  sqlite_store.py      # _SharedDB (one shared on-disk conn + lock + WAL) + SqliteScanStore + make_store()
  postgres_store.py    # _SharedPool (deferred-fault pool) + PgScanStore + make_store(database_url)
  _selftest.py         # runnable assert-based parity/behaviour check (the RED→GREEN harness)
```

Each file has one responsibility; the split mirrors `apps/api/src/marketdata/` 1:1 (port · sqlite · postgres · factory) so a reviewer who knows that subpackage reviews this one instantly.

---

### Task 1: The record + port (`ports.py`)

**Files:**
- Create: `apps/api/src/scanstore/ports.py`
- Create: `apps/api/src/scanstore/__init__.py` (minimal, so the package imports; the factory body lands in Task 4)

**Interfaces:**
- Produces (later tasks + Plans 2–3 rely on these EXACT names/types):
  - `ScanRow` dataclass — fields listed below; `.to_wire() -> dict`
  - `SweepHeartbeat` dataclass — `updated_at: float`, `sweep_last_completed: Optional[float]`, `universe_size: int`; `.to_wire() -> dict`
  - `ScanStore` ABC — `upsert_row(row: ScanRow) -> None`, `read_rows(symbols: Optional[Sequence[str]] = None) -> list[ScanRow]`, `write_heartbeat(hb: SweepHeartbeat) -> None`, `read_heartbeat() -> Optional[SweepHeartbeat]`

- [ ] **Step 1: Write the port + records**

Create `apps/api/src/scanstore/ports.py`:

```python
"""
Ports + records for the ScanStore — the sweep worker's output sink and the read API's source
(Scanner v1, Plan 1). A ONE-WAY LEAF, structural sibling of `src/marketdata/`: imports ONLY stdlib.
NEVER imported by engine/signals/live/darkpool/chain_store/the bundle-compute path — that boundary
is the score-byte-identity guarantee (no scan row can become a scoring input).

Two records: ScanRow (one CURRENT row per tracked symbol; latest-wins) and SweepHeartbeat (one row,
the worker's liveness + last-full-pass marker). The port has four methods — two for rows, two for
the heartbeat. Postgres and SQLite adapters implement it identically (parity tested in _selftest.py).
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Sequence

# Row status vocabulary (closed set — the FE renders these via a closed lookup, never re-derives).
#   ok        -> a fresh full compute produced this row
#   stale     -> last compute is older than the freshness budget (worker behind / down)
#   error     -> this symbol failed its last compute (degrades this row alone)
#   building  -> tracked but not yet computed once (cold universe entry)
SCAN_STATUSES = ("ok", "stale", "error", "building")


@dataclass
class ScanRow:
    """One current scan row for a tracked symbol. Every numeric field is Optional — a partial
    compute (price only, or a failed structure pass) still produces an honest row."""
    symbol: str                       # canonical UPPER-case
    price: Optional[float]            # last poll price
    chg_pct: Optional[float]         # % change since prior session close
    score: Optional[float]           # opportunity_score (CONSUMED from the bundle, never re-derived)
    tier: Optional[str]              # opportunity_tier enum
    regime: Optional[str]            # regime label enum
    vol_regime: Optional[str]        # vol-regime label enum
    flip: Optional[float]            # gamma flip level
    dist_to_flip_pct: Optional[float]
    call_wall: Optional[float]
    put_wall: Optional[float]
    dist_to_wall_pct: Optional[float]  # signed % to the nearer wall
    as_of: float                      # epoch-seconds of the compute that produced this row
    status: str                       # one of SCAN_STATUSES

    def to_wire(self) -> dict:
        """The FE-facing shape (the /api/scan row). Keys are stable — the conformance spec pins them."""
        return {
            "symbol": self.symbol,
            "price": self.price,
            "chg_pct": self.chg_pct,
            "score": self.score,
            "tier": self.tier,
            "regime": self.regime,
            "vol_regime": self.vol_regime,
            "flip": self.flip,
            "dist_to_flip_pct": self.dist_to_flip_pct,
            "call_wall": self.call_wall,
            "put_wall": self.put_wall,
            "dist_to_wall_pct": self.dist_to_wall_pct,
            "as_of": self.as_of,
            "status": self.status,
        }


@dataclass
class SweepHeartbeat:
    """The worker's liveness marker + last-full-pass completion. One row (singleton) in the store.
    The read API surfaces these so the page can say 'sweep last ran Xm ago' over stale rows."""
    updated_at: float                      # last worker tick (epoch seconds)
    sweep_last_completed: Optional[float]  # epoch seconds of the last COMPLETED full pass, or None
    universe_size: int                     # number of symbols the worker is tracking

    def to_wire(self) -> dict:
        return {
            "updated_at": self.updated_at,
            "sweep_last_completed": self.sweep_last_completed,
            "universe_size": self.universe_size,
        }


class ScanStore(ABC):
    """The sweep worker writes; the read API reads. Latest-wins by symbol (rows are current state,
    NOT an accumulating series — this is the one deliberate divergence from the iv-rank store)."""

    @abstractmethod
    def upsert_row(self, row: ScanRow) -> None:
        """Insert or OVERWRITE the row for `row.symbol` (latest-wins)."""

    @abstractmethod
    def read_rows(self, symbols: Optional[Sequence[str]] = None) -> list[ScanRow]:
        """All rows (symbols=None) or the subset for the given symbols. Missing symbols are simply
        absent from the result (no placeholder rows). Order: by symbol ascending (stable)."""

    @abstractmethod
    def write_heartbeat(self, hb: SweepHeartbeat) -> None:
        """Overwrite the singleton heartbeat row."""

    @abstractmethod
    def read_heartbeat(self) -> Optional[SweepHeartbeat]:
        """The heartbeat, or None if the worker has never written one."""
```

- [ ] **Step 2: Create the minimal package init (factory lands in Task 4)**

Create `apps/api/src/scanstore/__init__.py`:

```python
"""The scanstore subpackage — the Scanner sweep's persistent output sink (Scanner v1).
Structural sibling of src/marketdata/; a one-way leaf (see ports.py). The env-selected factory
(get_store) lands in Task 4."""
from __future__ import annotations

from .ports import ScanRow, ScanStore, SweepHeartbeat, SCAN_STATUSES

__all__ = ["ScanRow", "ScanStore", "SweepHeartbeat", "SCAN_STATUSES"]
```

- [ ] **Step 3: Verify it imports (RED→GREEN via the venv Python)**

Run:
```bash
apps/api/.venv/Scripts/python.exe -c "from src.scanstore import ScanRow, ScanStore, SweepHeartbeat, SCAN_STATUSES; r=ScanRow(symbol='SPY',price=1.0,chg_pct=None,score=80.0,tier='prime',regime='r',vol_regime='v',flip=None,dist_to_flip_pct=None,call_wall=None,put_wall=None,dist_to_wall_pct=None,as_of=1.0,status='ok'); print(r.to_wire()['symbol'], SCAN_STATUSES)"
```
Run it from `apps/api` (cwd) so `src` resolves. Expected: prints `SPY ('ok', 'stale', 'error', 'building')`. (Before Step 1 this fails with `ModuleNotFoundError`.)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/scanstore/ports.py apps/api/src/scanstore/__init__.py
git commit -m "feat(scanstore): ScanRow/SweepHeartbeat records + ScanStore port (Scanner v1 Plan 1)"
```

---

### Task 2: The SQLite adapter (`sqlite_store.py`) — the default

**Files:**
- Create: `apps/api/src/scanstore/sqlite_store.py`

**Interfaces:**
- Consumes: `ScanRow`, `SweepHeartbeat`, `ScanStore` from `.ports`.
- Produces: `class SqliteScanStore(ScanStore)`; `def make_store() -> ScanStore` (no args); env `SCAN_STORE_PATH` override, default `os.path.join(DATA_DIR, "scan.sqlite3")`.

- [ ] **Step 1: Write the SQLite adapter**

Create `apps/api/src/scanstore/sqlite_store.py` (mirrors `marketdata/sqlite_store.py`: one shared on-disk connection + lock + WAL; the ONE difference is `ON CONFLICT DO UPDATE` for latest-wins):

```python
"""
File/SQLite-on-disk adapter — the DEFAULT no-external-service ScanStore backend (mirrors
marketdata/sqlite_store.py). One shared on-disk connection for the process lifetime
(check_same_thread=False) guarded by a lock; WAL so the API's reads don't block the worker's writes.
On-disk (not :memory:) so a locally-run worker's rows survive a dev restart. The Postgres adapter is
the prod drop-in behind the SAME port. Leaf: imports only stdlib + its own port.
"""
from __future__ import annotations

import logging
import os
import sqlite3
import threading
from typing import Optional, Sequence

from .ports import ScanRow, ScanStore, SweepHeartbeat

logger = logging.getLogger("Convexa")

_DEFAULT_DATA_DIR = os.getenv("DATA_DIR", "data")


def _default_db_path() -> str:
    override = os.getenv("SCAN_STORE_PATH", "").strip()
    if override:
        return override
    return os.path.join(_DEFAULT_DATA_DIR, "scan.sqlite3")


class _SharedDB:
    """One shared on-disk connection + a lock. All ops share this instance."""

    def __init__(self, db_path: str):
        directory = os.path.dirname(db_path)
        if directory:
            os.makedirs(directory, exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        with self._conn:
            self._conn.execute("PRAGMA journal_mode=WAL")
        self._init_schema()

    def _init_schema(self):
        with self._conn:
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS scan_rows (
                    symbol            TEXT PRIMARY KEY,
                    price             REAL,
                    chg_pct           REAL,
                    score             REAL,
                    tier              TEXT,
                    regime            TEXT,
                    vol_regime        TEXT,
                    flip              REAL,
                    dist_to_flip_pct  REAL,
                    call_wall         REAL,
                    put_wall          REAL,
                    dist_to_wall_pct  REAL,
                    as_of             REAL NOT NULL,
                    status            TEXT NOT NULL
                )
                """
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS scan_heartbeat (
                    id                   INTEGER PRIMARY KEY CHECK (id = 1),
                    updated_at           REAL NOT NULL,
                    sweep_last_completed REAL,
                    universe_size        INTEGER NOT NULL
                )
                """
            )


_ROW_COLS = ("symbol", "price", "chg_pct", "score", "tier", "regime", "vol_regime", "flip",
             "dist_to_flip_pct", "call_wall", "put_wall", "dist_to_wall_pct", "as_of", "status")


def _row_from_sqlite(r: sqlite3.Row) -> ScanRow:
    return ScanRow(**{c: r[c] for c in _ROW_COLS})


class SqliteScanStore(ScanStore):
    def __init__(self, db: _SharedDB):
        self._db = db

    def upsert_row(self, row: ScanRow) -> None:
        symbol = (row.symbol or "").upper()
        with self._db._lock:
            with self._db._conn:
                self._db._conn.execute(
                    "INSERT INTO scan_rows "
                    "(symbol, price, chg_pct, score, tier, regime, vol_regime, flip, "
                    " dist_to_flip_pct, call_wall, put_wall, dist_to_wall_pct, as_of, status) "
                    "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) "
                    "ON CONFLICT(symbol) DO UPDATE SET "
                    " price=excluded.price, chg_pct=excluded.chg_pct, score=excluded.score, "
                    " tier=excluded.tier, regime=excluded.regime, vol_regime=excluded.vol_regime, "
                    " flip=excluded.flip, dist_to_flip_pct=excluded.dist_to_flip_pct, "
                    " call_wall=excluded.call_wall, put_wall=excluded.put_wall, "
                    " dist_to_wall_pct=excluded.dist_to_wall_pct, as_of=excluded.as_of, "
                    " status=excluded.status",
                    (symbol, row.price, row.chg_pct, row.score, row.tier, row.regime,
                     row.vol_regime, row.flip, row.dist_to_flip_pct, row.call_wall, row.put_wall,
                     row.dist_to_wall_pct, row.as_of, row.status),
                )

    def read_rows(self, symbols: Optional[Sequence[str]] = None) -> list[ScanRow]:
        with self._db._lock:
            if symbols is None:
                rows = self._db._conn.execute(
                    "SELECT * FROM scan_rows ORDER BY symbol ASC").fetchall()
            else:
                wanted = [(s or "").upper() for s in symbols]
                if not wanted:
                    return []
                placeholders = ",".join("?" for _ in wanted)
                rows = self._db._conn.execute(
                    f"SELECT * FROM scan_rows WHERE symbol IN ({placeholders}) ORDER BY symbol ASC",
                    wanted,
                ).fetchall()
        return [_row_from_sqlite(r) for r in rows]

    def write_heartbeat(self, hb: SweepHeartbeat) -> None:
        with self._db._lock:
            with self._db._conn:
                self._db._conn.execute(
                    "INSERT INTO scan_heartbeat (id, updated_at, sweep_last_completed, universe_size) "
                    "VALUES (1,?,?,?) "
                    "ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at, "
                    " sweep_last_completed=excluded.sweep_last_completed, "
                    " universe_size=excluded.universe_size",
                    (hb.updated_at, hb.sweep_last_completed, hb.universe_size),
                )

    def read_heartbeat(self) -> Optional[SweepHeartbeat]:
        with self._db._lock:
            r = self._db._conn.execute(
                "SELECT updated_at, sweep_last_completed, universe_size "
                "FROM scan_heartbeat WHERE id = 1").fetchone()
        if r is None:
            return None
        return SweepHeartbeat(updated_at=r["updated_at"],
                              sweep_last_completed=r["sweep_last_completed"],
                              universe_size=r["universe_size"])


def make_store() -> ScanStore:
    db_path = _default_db_path()
    logger.info(f"Scan store (sqlite-disk): {db_path}")
    return SqliteScanStore(_SharedDB(db_path))
```

- [ ] **Step 2: Write the runnable self-check (the RED→GREEN harness)**

Create `apps/api/src/scanstore/_selftest.py` — assert-based, exits non-zero on failure (the backend's no-pytest convention):

```python
"""Runnable ScanStore behaviour + parity check (Scanner v1 Plan 1). No pytest (apps/api convention).
Run: apps/api/.venv/Scripts/python.exe -m src.scanstore._selftest   (cwd = apps/api)
Exits 0 = all pass, 1 = a failure (prints which). Uses a temp on-disk sqlite so nothing persists."""
from __future__ import annotations

import os
import tempfile

from .ports import ScanRow, SweepHeartbeat


def _row(symbol: str, score: float, status: str = "ok", as_of: float = 1.0) -> ScanRow:
    return ScanRow(symbol=symbol, price=100.0, chg_pct=0.5, score=score, tier="prime",
                   regime="pinned", vol_regime="calm", flip=95.0, dist_to_flip_pct=-5.0,
                   call_wall=110.0, put_wall=90.0, dist_to_wall_pct=10.0, as_of=as_of, status=status)


def _make_sqlite():
    from .sqlite_store import SqliteScanStore, _SharedDB
    fd, path = tempfile.mkstemp(suffix=".sqlite3")
    os.close(fd)
    return SqliteScanStore(_SharedDB(path)), path


def run_store_contract(store) -> None:
    """The behaviour contract every adapter must satisfy. Called per-adapter for parity."""
    # 1. wiped/empty store: no rows, no heartbeat.
    assert store.read_rows() == [], "empty store must return []"
    assert store.read_heartbeat() is None, "empty store heartbeat must be None"

    # 2. upsert + read-all (symbol-ascending, canonical upper-case).
    store.upsert_row(_row("spy", 80.0))   # lower-case in -> canonical out
    store.upsert_row(_row("QQQ", 60.0))
    allrows = store.read_rows()
    assert [r.symbol for r in allrows] == ["QQQ", "SPY"], f"order/canon wrong: {[r.symbol for r in allrows]}"

    # 3. latest-wins (NOT insert-if-absent): re-upsert SPY overwrites.
    store.upsert_row(_row("SPY", 42.0, status="stale", as_of=2.0))
    spy = store.read_rows(["SPY"])
    assert len(spy) == 1 and spy[0].score == 42.0 and spy[0].status == "stale" and spy[0].as_of == 2.0, \
        f"latest-wins failed: {spy}"

    # 4. subset read: missing symbols simply absent (no placeholder rows).
    subset = store.read_rows(["SPY", "NOPE"])
    assert [r.symbol for r in subset] == ["SPY"], f"subset should drop unknown: {[r.symbol for r in subset]}"
    assert store.read_rows([]) == [], "empty symbol list -> []"

    # 5. heartbeat round-trip + overwrite.
    store.write_heartbeat(SweepHeartbeat(updated_at=10.0, sweep_last_completed=None, universe_size=2))
    hb = store.read_heartbeat()
    assert hb is not None and hb.universe_size == 2 and hb.sweep_last_completed is None, f"hb1 {hb}"
    store.write_heartbeat(SweepHeartbeat(updated_at=20.0, sweep_last_completed=19.0, universe_size=3))
    hb = store.read_heartbeat()
    assert hb.updated_at == 20.0 and hb.sweep_last_completed == 19.0 and hb.universe_size == 3, f"hb2 {hb}"

    # 6. to_wire shape is stable (the conformance spec pins these keys).
    assert set(spy[0].to_wire().keys()) == {
        "symbol", "price", "chg_pct", "score", "tier", "regime", "vol_regime", "flip",
        "dist_to_flip_pct", "call_wall", "put_wall", "dist_to_wall_pct", "as_of", "status"}, "wire keys drift"


def main() -> int:
    store, path = _make_sqlite()
    try:
        run_store_contract(store)
    except AssertionError as e:
        print(f"FAIL (sqlite): {e}")
        return 1
    finally:
        for p in (path, path + "-wal", path + "-shm"):
            try:
                os.remove(p)
            except OSError:
                pass
    print("PASS: SqliteScanStore satisfies the store contract")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 3: Run it to verify RED first**

At this point `sqlite_store.py` exists (Step 1) so it will PASS. To see the RED→GREEN discipline, temporarily break `upsert_row`'s `ON CONFLICT` clause (change `DO UPDATE` to `DO NOTHING`) and run:
```bash
cd apps/api && .venv/Scripts/python.exe -m src.scanstore._selftest
```
Expected: `FAIL (sqlite): latest-wins failed: …` (exit 1). Restore `DO UPDATE`.

- [ ] **Step 4: Run it to verify GREEN**

```bash
cd apps/api && .venv/Scripts/python.exe -m src.scanstore._selftest
```
Expected: `PASS: SqliteScanStore satisfies the store contract` (exit 0).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/scanstore/sqlite_store.py apps/api/src/scanstore/_selftest.py
git commit -m "feat(scanstore): on-disk SQLite adapter (latest-wins) + runnable contract self-check"
```

---

### Task 3: The Postgres adapter (`postgres_store.py`) — prod drop-in

**Files:**
- Create: `apps/api/src/scanstore/postgres_store.py`

**Interfaces:**
- Consumes: `ScanRow`, `SweepHeartbeat`, `ScanStore` from `.ports`.
- Produces: `class PgScanStore(ScanStore)`; `def make_store(database_url: str) -> ScanStore`.

**Note (project reality):** the dev box has **no local Postgres** (per canon — iv-rank's Postgres path is "live-verify deferred, verified by parity review + the SQLite regression"). So this task's verification is **statement-level parity review** against Task 2's SQL + the leaf/deferred-fault assertions below, NOT a live PG run. Mirror `apps/api/src/marketdata/postgres_store.py` exactly for the pool/boot-safety shape.

- [ ] **Step 1: Write the Postgres adapter**

Create `apps/api/src/scanstore/postgres_store.py`:

```python
"""
Postgres adapter — the prod drop-in behind the SAME ScanStore port (mirrors
marketdata/postgres_store.py). psycopg 3 (synchronous) over a small connection pool. An UNREACHABLE
DB at boot does NOT crash: the pool opens with wait=False and the fault defers to first use, where
the worker/API caller swallows it per `[best-effort-isolated-or-null]`. Leaf: imports stdlib +
psycopg only. Connection string is RUNTIME env only (never baked — `no-secrets-in-image`).
"""
from __future__ import annotations

import logging
import os
from typing import Optional, Sequence

import psycopg
from psycopg_pool import ConnectionPool

from .ports import ScanRow, ScanStore, SweepHeartbeat

logger = logging.getLogger("Convexa")

_ROW_COLS = ("symbol", "price", "chg_pct", "score", "tier", "regime", "vol_regime", "flip",
             "dist_to_flip_pct", "call_wall", "put_wall", "dist_to_wall_pct", "as_of", "status")


class _SharedPool:
    def __init__(self, database_url: str):
        max_size = int(os.getenv("SCAN_DATABASE_POOL_MAX", os.getenv("DATABASE_POOL_MAX", "10")))
        self._pool = ConnectionPool(conninfo=database_url, min_size=1, max_size=max_size, open=False)
        try:
            self._pool.open(wait=False)  # boot-safe: never blocks / crashes on an unreachable DB
        except Exception:  # pragma: no cover - defensive; fault defers to first use
            logger.exception("Scan Postgres pool open deferred (fault will surface at first use)")
        self._init_schema_best_effort()

    def _init_schema_best_effort(self):
        ddl_rows = (
            "CREATE TABLE IF NOT EXISTS scan_rows ("
            " symbol TEXT PRIMARY KEY, price DOUBLE PRECISION, chg_pct DOUBLE PRECISION,"
            " score DOUBLE PRECISION, tier TEXT, regime TEXT, vol_regime TEXT,"
            " flip DOUBLE PRECISION, dist_to_flip_pct DOUBLE PRECISION, call_wall DOUBLE PRECISION,"
            " put_wall DOUBLE PRECISION, dist_to_wall_pct DOUBLE PRECISION,"
            " as_of DOUBLE PRECISION NOT NULL, status TEXT NOT NULL)"
        )
        ddl_hb = (
            "CREATE TABLE IF NOT EXISTS scan_heartbeat ("
            " id INTEGER PRIMARY KEY CHECK (id = 1), updated_at DOUBLE PRECISION NOT NULL,"
            " sweep_last_completed DOUBLE PRECISION, universe_size INTEGER NOT NULL)"
        )
        try:
            with self._pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(ddl_rows)
                    cur.execute(ddl_hb)
                conn.commit()
        except Exception:
            logger.exception("Scan Postgres schema init deferred (will retry at first use)")


class PgScanStore(ScanStore):
    def __init__(self, pool: _SharedPool):
        self._pool = pool

    def upsert_row(self, row: ScanRow) -> None:
        symbol = (row.symbol or "").upper()
        with self._pool._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO scan_rows "
                    "(symbol, price, chg_pct, score, tier, regime, vol_regime, flip,"
                    " dist_to_flip_pct, call_wall, put_wall, dist_to_wall_pct, as_of, status) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
                    "ON CONFLICT (symbol) DO UPDATE SET "
                    " price=EXCLUDED.price, chg_pct=EXCLUDED.chg_pct, score=EXCLUDED.score,"
                    " tier=EXCLUDED.tier, regime=EXCLUDED.regime, vol_regime=EXCLUDED.vol_regime,"
                    " flip=EXCLUDED.flip, dist_to_flip_pct=EXCLUDED.dist_to_flip_pct,"
                    " call_wall=EXCLUDED.call_wall, put_wall=EXCLUDED.put_wall,"
                    " dist_to_wall_pct=EXCLUDED.dist_to_wall_pct, as_of=EXCLUDED.as_of,"
                    " status=EXCLUDED.status",
                    (symbol, row.price, row.chg_pct, row.score, row.tier, row.regime,
                     row.vol_regime, row.flip, row.dist_to_flip_pct, row.call_wall, row.put_wall,
                     row.dist_to_wall_pct, row.as_of, row.status),
                )
            conn.commit()

    def read_rows(self, symbols: Optional[Sequence[str]] = None) -> list[ScanRow]:
        with self._pool._pool.connection() as conn:
            with conn.cursor() as cur:
                if symbols is None:
                    cur.execute(f"SELECT {', '.join(_ROW_COLS)} FROM scan_rows ORDER BY symbol ASC")
                else:
                    wanted = [(s or "").upper() for s in symbols]
                    if not wanted:
                        return []
                    cur.execute(
                        f"SELECT {', '.join(_ROW_COLS)} FROM scan_rows "
                        "WHERE symbol = ANY(%s) ORDER BY symbol ASC", (wanted,))
                fetched = cur.fetchall()
        return [ScanRow(**dict(zip(_ROW_COLS, r))) for r in fetched]

    def write_heartbeat(self, hb: SweepHeartbeat) -> None:
        with self._pool._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO scan_heartbeat (id, updated_at, sweep_last_completed, universe_size) "
                    "VALUES (1,%s,%s,%s) "
                    "ON CONFLICT (id) DO UPDATE SET updated_at=EXCLUDED.updated_at,"
                    " sweep_last_completed=EXCLUDED.sweep_last_completed,"
                    " universe_size=EXCLUDED.universe_size",
                    (hb.updated_at, hb.sweep_last_completed, hb.universe_size))
            conn.commit()

    def read_heartbeat(self) -> Optional[SweepHeartbeat]:
        with self._pool._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT updated_at, sweep_last_completed, universe_size "
                            "FROM scan_heartbeat WHERE id = 1")
                r = cur.fetchone()
        if r is None:
            return None
        return SweepHeartbeat(updated_at=r[0], sweep_last_completed=r[1], universe_size=r[2])


def make_store(database_url: str) -> ScanStore:
    if not (database_url or "").strip():
        raise ValueError("PgScanStore requires a non-empty database_url")
    logger.info("Scan store (postgres): pool opening (boot-safe)")
    return PgScanStore(_SharedPool(database_url))
```

- [ ] **Step 2: Parity review (no live PG) + import-safety check**

Review checklist (record the result in the commit body): (a) every SQL statement matches Task 2's SQLite semantics — same columns, `ON CONFLICT … DO UPDATE` for both `upsert_row` and `write_heartbeat`, `ORDER BY symbol ASC`, `WHERE symbol = ANY(%s)` mirrors the SQLite `IN (…)`; (b) `_row_from` reconstructs `ScanRow` from the same `_ROW_COLS` order; (c) the pool opens `wait=False` inside try/except (boot-safe). Verify the module at least IMPORTS (psycopg is installed) without a live DB:
```bash
cd apps/api && .venv/Scripts/python.exe -c "import src.scanstore.postgres_store as p; print('import ok', hasattr(p, 'make_store'))"
```
Expected: `import ok True`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/scanstore/postgres_store.py
git commit -m "feat(scanstore): Postgres adapter behind the same port (parity-reviewed; live-verify deferred)"
```

---

### Task 4: The env-selected factory (`__init__.py`)

**Files:**
- Modify: `apps/api/src/scanstore/__init__.py` (replace the Task 1 minimal init)

**Interfaces:**
- Produces: `get_store() -> ScanStore` (cached), `available_stores() -> list[str]`; env `SCAN_STORE` (default `"disk"`), Postgres URL from `SCAN_DATABASE_URL` → `DATABASE_URL`.

- [ ] **Step 1: Write the factory** (mirrors `marketdata/__init__.py`)

Replace `apps/api/src/scanstore/__init__.py`:

```python
"""The scanstore subpackage — the Scanner sweep's persistent output sink (Scanner v1). Structural
sibling of src/marketdata/; a one-way leaf (see ports.py) NEVER imported by the scoring path.

Store factory (`SCAN_STORE` env, default "disk"), mirroring `IV_STORE`/`ACCOUNT_STORE`: the on-disk
SQLite adapter is the DEFAULT; the Postgres adapter registers behind the SAME port. The connection
string is RUNTIME env only (`SCAN_DATABASE_URL`, falling back to `DATABASE_URL`) — never baked
(`no-secrets-in-image`)."""
from __future__ import annotations

import logging
import os

from .ports import ScanRow, ScanStore, SweepHeartbeat, SCAN_STATUSES

logger = logging.getLogger("Convexa")


def _make_disk_store() -> ScanStore:
    from .sqlite_store import make_store
    return make_store()


def _make_postgres_store() -> ScanStore:
    database_url = (os.getenv("SCAN_DATABASE_URL", "").strip()
                    or os.getenv("DATABASE_URL", "").strip())
    if not database_url:
        raise ValueError(
            "SCAN_STORE=postgres requires SCAN_DATABASE_URL or DATABASE_URL. Set it via runtime "
            "env; it is never committed or baked into an image.")
    from .postgres_store import make_store
    return make_store(database_url)


_STORE_FACTORIES = {"disk": _make_disk_store, "postgres": _make_postgres_store}
_store: ScanStore | None = None


def available_stores() -> list[str]:
    return sorted(_STORE_FACTORIES)


def get_store() -> ScanStore:
    """Build (once) the ScanStore over the env-selected backend (`SCAN_STORE`, default "disk").
    Cached for the process lifetime. Raises ValueError on an unknown backend name."""
    global _store
    if _store is not None:
        return _store
    name = os.getenv("SCAN_STORE", "disk").lower()
    factory = _STORE_FACTORIES.get(name)
    if factory is None:
        raise ValueError(f"Unknown SCAN_STORE '{name}'. Available: {', '.join(available_stores())}")
    _store = factory()
    return _store


__all__ = ["get_store", "available_stores", "ScanRow", "ScanStore", "SweepHeartbeat", "SCAN_STATUSES"]
```

- [ ] **Step 2: Verify the factory selects disk by default and round-trips through the public surface**

```bash
cd apps/api && SCAN_STORE_PATH="$(python -c 'import tempfile,os;print(os.path.join(tempfile.mkdtemp(),"scan.sqlite3"))')" .venv/Scripts/python.exe -c "from src import scanstore; s=scanstore.get_store(); print(type(s).__name__); print(scanstore.available_stores())"
```
Expected: prints `SqliteScanStore` then `['disk', 'postgres']`. (On Windows Git Bash the inline env var works; if not, `export SCAN_STORE_PATH=...` first.)

- [ ] **Step 3: Run the self-check once more (full package intact)**

```bash
cd apps/api && .venv/Scripts/python.exe -m src.scanstore._selftest
```
Expected: `PASS: SqliteScanStore satisfies the store contract`.

- [ ] **Step 4: Register the new env vars (docs, not secrets)**

Add to `apps/api/.env.example` (value-less, like the existing `IV_STORE` block) and to the `apps/api/Dockerfile` env header comment:
```
# Scanner sweep store (Scanner v1). Mirrors IV_STORE.
SCAN_STORE=disk           # disk (default, on-disk sqlite under DATA_DIR) | postgres
# SCAN_DATABASE_URL=      # required when SCAN_STORE=postgres (falls back to DATABASE_URL); runtime env only
# SCAN_STORE_PATH=        # optional on-disk path override (default DATA_DIR/scan.sqlite3)
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/scanstore/__init__.py apps/api/.env.example apps/api/Dockerfile
git commit -m "feat(scanstore): env-selected factory (SCAN_STORE, default disk) + .env.example/Dockerfile docs"
```

---

## Self-Review

- **Spec coverage (§C2 store):** ScanRow carries every §C2 field (symbol, price, chg_pct, score, tier, regime, vol_regime, flip, dist_to_flip_pct, call_wall, put_wall, dist_to_wall_pct, as_of, status) ✓; heartbeat + universe metadata → `SweepHeartbeat` ✓; SQLite-default + Postgres-behind-same-port + env factory (§2 architecture) ✓; wiped-store-returns-empty (§6 test) ✓; leaf import rule / byte-identity (§7) ✓; `no-secrets-in-image` for the PG URL (§7) ✓. The **bundle-blob** store method (§C3 warm-click) is deliberately deferred to Plan 3 (added when the reader needs it) — noted, not dropped.
- **Placeholder scan:** no TBD/TODO; every step has runnable code + an exact command + expected output.
- **Type consistency:** `ScanRow`/`SweepHeartbeat`/`ScanStore` names + `_ROW_COLS` order identical across ports/sqlite/postgres/selftest; `get_store`/`make_store` signatures match the `marketdata` template.
- **Divergence flagged:** latest-wins (`ON CONFLICT DO UPDATE`) vs iv-rank's insert-if-absent — stated in Global Constraints and asserted in `_selftest` step 3.

---

## The rest of Scanner v1 — Plans 2–4 (roadmap; write each when its predecessor lands)

This plan is the foundation. The remaining plans are sequenced (each depends on the prior), each an independently-testable deliverable — to be written in full (same no-placeholder standard) when it comes up:

- **Plan 2 — The sweep worker** (`apps/api/worker.py` + new nx `serve-worker` target + a new multi-ticker snapshot method on the `MarketDataProvider` port & Massive adapter). The two-speed loop (snapshot poll → prices + move-detection; concurrency-bounded chain sweep → `compute_ticker` → `ScanRow`); the tiering/promotion **pure logic** (injected clock — the one algorithm that would silently rot, unit-tested via a `_selftest`); heartbeat writes; the bundle-blob write (§C3). Consumes Plan 1's `ScanStore`. **First task reads `apps/api/src/providers/massive.py` `fetch_options_market_state` to mirror its request/auth/parse idiom for the new snapshot call.**
- **Plan 3 — The read API + conformance + warm-click + per-account view.** `GET /api/scan`, `GET /api/scan/universe`, `GET/PUT /api/scan/view` (view stored behind the auth-settings ports, server-gated via `_gate_or_response`); the standalone `.claude/tools/conformance/scanner.json`; the ticker endpoint's best-effort **warm-click read-through** of the Plan-2 bundle blob. Routes registered under `/api/` (before the `/{ticker}` catch-all). Consumes Plan 1 + Plan 2.
- **Plan 4 — The frontend `/scanner` page.** Swap the stub (`pages/scanner/Scanner.tsx`); the dense terminal table + view editor + the four states (skeleton / empty / worker-down banner / per-row degrade) + mobile card collapse + the `libs/api` fetchers (`getScan`/`getScanView`/`saveScanView`). **All component work references `docs/design/DESIGN_SYSTEM.md`** — the table consumes `StatTile`, `TintChip` (note the `emphasis` tone for tier), `useFlashOnChange` (the permitted data-signal flash on price cells), and `Widget`; green/red only for price *direction*; `/scanner` joins the 393px no-overflow e2e set. Consumes Plan 3's API.
