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
