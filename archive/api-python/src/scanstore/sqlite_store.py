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

from .ports import BundleBlob, ScanRow, ScanStore, SweepHeartbeat

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
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS scan_bundles (
                    symbol      TEXT PRIMARY KEY,
                    as_of       REAL NOT NULL,
                    bundle_json TEXT NOT NULL
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

    def write_bundle_blob(self, blob: BundleBlob) -> None:
        symbol = (blob.symbol or "").upper()
        with self._db._lock:
            with self._db._conn:
                self._db._conn.execute(
                    "INSERT INTO scan_bundles (symbol, as_of, bundle_json) VALUES (?,?,?) "
                    "ON CONFLICT(symbol) DO UPDATE SET as_of=excluded.as_of, "
                    " bundle_json=excluded.bundle_json",
                    (symbol, blob.as_of, blob.bundle_json),
                )

    def read_bundle_blob(self, symbol: str) -> Optional[BundleBlob]:
        sym = (symbol or "").upper()
        with self._db._lock:
            r = self._db._conn.execute(
                "SELECT symbol, as_of, bundle_json FROM scan_bundles WHERE symbol = ?",
                (sym,)).fetchone()
        if r is None:
            return None
        return BundleBlob(symbol=r["symbol"], as_of=r["as_of"], bundle_json=r["bundle_json"])


def make_store() -> ScanStore:
    db_path = _default_db_path()
    logger.info(f"Scan store (sqlite-disk): {db_path}")
    return SqliteScanStore(_SharedDB(db_path))
