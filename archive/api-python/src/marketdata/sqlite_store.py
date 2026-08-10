"""
File/SQLite-on-disk adapter — the DEFAULT no-external-service backend for the IV time-series store
(iv-rank ARCHITECTURE §Q3, the architect's recommended default; product D7 preference).

WHY on-disk (not `:memory:` like the auth default): this data is INHERENTLY ACCUMULATIVE and is
NOT re-creatable (unlike auth state, which is re-creatable by re-signup). A pure-memory store that
reset on restart would perpetually re-enter 'building history' and never reach the 20-sample floor
in dev, undermining the ability to DEMONSTRATE a real Computed rank. On-disk persistence under
`DATA_DIR` lets the store actually accumulate across restarts.

One shared connection for the process lifetime (`check_same_thread=False`) guarded by a
module-level lock — giving one process-wide DB that survives across requests and is thread-safe
under FastAPI's threaded handling (bundle compute runs in to_thread). WAL mode so concurrent
readers don't block the single writer.

The Postgres adapter (`postgres_store.py`) is the prod drop-in behind the SAME port (`ports.py`).
The seam: implement the port, register in the factory (`__init__.get_store`), set `IV_STORE`.

This module is part of the marketdata LEAF: it imports only stdlib + its own port. It is NEVER
imported by engine/signals/live/darkpool/chain_store/the bundle-compute path.
"""
from __future__ import annotations

import logging
import os
import sqlite3
import threading
import time

from .ports import IvSample, IvTimeSeriesStore

logger = logging.getLogger("Convexa")

# Default on-disk location under DATA_DIR (cwd-relative "data", same base main.py writes ticker
# JSON to). Overridable via IV_STORE_PATH for tests / alternate mounts.
_DEFAULT_DATA_DIR = os.getenv("DATA_DIR", "data")


def _default_db_path() -> str:
    override = os.getenv("IV_STORE_PATH", "").strip()
    if override:
        return override
    return os.path.join(_DEFAULT_DATA_DIR, "iv_timeseries.sqlite3")


class _SharedDB:
    """One shared on-disk connection + a lock. All ops below share this instance."""

    def __init__(self, db_path: str):
        directory = os.path.dirname(db_path)
        if directory:
            os.makedirs(directory, exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        # WAL: concurrent readers don't block the single writer (bundle compute runs in threads).
        with self._conn:
            self._conn.execute("PRAGMA journal_mode=WAL")
        self._init_schema()

    def _init_schema(self):
        with self._conn:
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS iv_samples (
                    ticker       TEXT NOT NULL,
                    session_date TEXT NOT NULL,
                    iv_value     REAL NOT NULL,
                    iv_basis     TEXT NOT NULL,
                    basis_dte    REAL NOT NULL,
                    captured_at  REAL NOT NULL,
                    PRIMARY KEY (ticker, session_date)
                )
                """
            )


class SqliteIvTimeSeriesStore(IvTimeSeriesStore):
    def __init__(self, db: _SharedDB):
        self._db = db

    def upsert_if_absent(self, sample: IvSample) -> None:
        # INSERT OR IGNORE on the (ticker, session_date) PK == idempotent upsert-if-absent. A row
        # already present for today is left untouched (first-write-wins for the UTC day).
        with self._db._lock:
            with self._db._conn:
                self._db._conn.execute(
                    "INSERT OR IGNORE INTO iv_samples "
                    "(ticker, session_date, iv_value, iv_basis, basis_dte, captured_at) "
                    "VALUES (?,?,?,?,?,?)",
                    (sample.ticker, sample.session_date, sample.iv_value, sample.iv_basis,
                     sample.basis_dte, sample.captured_at),
                )

    def read_recent(self, ticker: str, limit: int) -> list[IvSample]:
        with self._db._lock:
            rows = self._db._conn.execute(
                "SELECT ticker, session_date, iv_value, iv_basis, basis_dte, captured_at "
                "FROM iv_samples WHERE ticker = ? "
                "ORDER BY session_date DESC LIMIT ?",
                ((ticker or "").upper(), int(limit)),
            ).fetchall()
        # Fetched most-recent-first (LIMIT bounds the window); return ASCENDING (oldest -> newest).
        samples = [
            IvSample(
                ticker=r["ticker"], session_date=r["session_date"], iv_value=r["iv_value"],
                iv_basis=r["iv_basis"], basis_dte=r["basis_dte"], captured_at=r["captured_at"],
            )
            for r in rows
        ]
        samples.reverse()
        return samples


def make_store() -> IvTimeSeriesStore:
    """Construct the on-disk IV time-series store over a shared connection."""
    db_path = _default_db_path()
    logger.info(f"IV time-series store (sqlite-disk): {db_path}")
    return SqliteIvTimeSeriesStore(_SharedDB(db_path))
