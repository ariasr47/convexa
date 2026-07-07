"""
Persistent Postgres adapter for the IV time-series store port (iv-rank ARCHITECTURE §Q3).

A drop-in sibling of `sqlite_store.py`, implementing the SAME port (`IvTimeSeriesStore`) so the
accumulated IV history SURVIVES restarts and spans replicas in prod — selected by the env factory
(`IV_STORE=postgres` + `IV_DATABASE_URL`, falling back to the shared `DATABASE_URL`). The on-disk
SQLite adapter stays the default.

Design (mirrors src/auth/postgres_store.py, the parity precedent):
  - RAW parameterized SQL mirroring `sqlite_store.py` (no ORM, no Alembic), so the two adapters stay
    diff-able. The dialect deltas: `?`->`%s`, `REAL`->`DOUBLE PRECISION`, `INSERT OR IGNORE`->
    `INSERT ... ON CONFLICT (ticker, session_date) DO NOTHING`.
  - psycopg 3 in SYNCHRONOUS mode (the port is a sync ABC; NO async/await — matches the existing
    concurrency model, a true drop-in).
  - A single process-wide `psycopg_pool.ConnectionPool` (like auth's), REPLACING the sqlite lock:
    Postgres handles concurrency server-side (the PK UNIQUE + `ON CONFLICT`).
  - Idempotent `CREATE TABLE IF NOT EXISTS` bootstrap run once at `make_store()` construction; an
    UNREACHABLE DB does NOT crash boot — the fault DEFERS to first use (`no-secrets-in-image` +
    the auth defer-fault-to-first-use precedent).

HARD CONSTRAINT: Postgres is NOT runtime-verified this gate (the dev box has no local Postgres). It
is a parity-reviewed prod adapter behind the port; the port contract is the review surface.

Connection string: read from RUNTIME env ONLY (`IV_DATABASE_URL` / `DATABASE_URL`) — never baked,
never committed (`no-secrets-in-image`).

This module is part of the marketdata LEAF: it imports ONLY stdlib + `psycopg`/`psycopg_pool` + the
leaf's own port. engine/signals/live/darkpool/chain_store/the bundle-compute path NEVER import it.
"""
from __future__ import annotations

import logging
import os

import psycopg
from psycopg_pool import ConnectionPool

from .ports import IvSample, IvTimeSeriesStore

logger = logging.getLogger("Convexa")

_DEFAULT_POOL_MAX = int(os.getenv("IV_DATABASE_POOL_MAX", os.getenv("DATABASE_POOL_MAX", "10")))


class _SharedPool:
    """One process-wide connection pool + the schema bootstrap (mirrors auth's _SharedPool)."""

    def __init__(self, database_url: str, pool_max: int = _DEFAULT_POOL_MAX):
        # open=False + a non-blocking open so an UNREACHABLE DB at boot does NOT crash the process:
        # the fault surfaces on FIRST USE (where the read/write wrapper in main.py swallows it and
        # emits iv_rank=null). A real DB boots the pool and the bootstrap below runs the DDL.
        self._pool = ConnectionPool(
            conninfo=database_url, min_size=1, max_size=max(1, pool_max), open=False)
        try:
            self._pool.open(wait=False)
        except Exception:
            logger.warning("marketdata/postgres: pool open deferred (DB unreachable at boot?)",
                           exc_info=False)
        self._init_schema_best_effort()

    def _init_schema_best_effort(self) -> None:
        try:
            self._init_schema()
        except Exception:
            logger.warning("marketdata/postgres: schema bootstrap deferred (DB unreachable at "
                           "boot?); will run on first reachable use", exc_info=False)

    def _init_schema(self) -> None:
        # Mirrors sqlite_store._SharedDB._init_schema table-for-table, Postgres types.
        with self._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS iv_samples (
                        ticker       TEXT NOT NULL,
                        session_date TEXT NOT NULL,
                        iv_value     DOUBLE PRECISION NOT NULL,
                        iv_basis     TEXT NOT NULL,
                        basis_dte    DOUBLE PRECISION NOT NULL,
                        captured_at  DOUBLE PRECISION NOT NULL,
                        PRIMARY KEY (ticker, session_date)
                    )
                    """
                )
            conn.commit()


class PgIvTimeSeriesStore(IvTimeSeriesStore):
    def __init__(self, pool: _SharedPool):
        self._p = pool

    def upsert_if_absent(self, sample: IvSample) -> None:
        # ON CONFLICT DO NOTHING on the (ticker, session_date) PK == idempotent upsert-if-absent.
        with self._p._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO iv_samples "
                    "(ticker, session_date, iv_value, iv_basis, basis_dte, captured_at) "
                    "VALUES (%s,%s,%s,%s,%s,%s) "
                    "ON CONFLICT (ticker, session_date) DO NOTHING",
                    (sample.ticker, sample.session_date, sample.iv_value, sample.iv_basis,
                     sample.basis_dte, sample.captured_at),
                )
            conn.commit()

    def read_recent(self, ticker: str, limit: int) -> list[IvSample]:
        with self._p._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT ticker, session_date, iv_value, iv_basis, basis_dte, captured_at "
                    "FROM iv_samples WHERE ticker = %s "
                    "ORDER BY session_date DESC LIMIT %s",
                    ((ticker or "").upper(), int(limit)),
                )
                rows = cur.fetchall()
        samples = [
            IvSample(
                ticker=r[0], session_date=r[1], iv_value=r[2],
                iv_basis=r[3], basis_dte=r[4], captured_at=r[5],
            )
            for r in rows
        ]
        samples.reverse()  # ORDER BY DESC fetched newest-first; return ASCENDING (oldest -> newest)
        return samples


def make_store(database_url: str) -> IvTimeSeriesStore:
    """Construct the store over a single process-wide pool, running the idempotent schema bootstrap.
    A DB unreachable at boot does NOT crash here — the fault surfaces on first use."""
    if not database_url:
        raise ValueError("postgres_store.make_store requires a non-empty connection string")
    return PgIvTimeSeriesStore(_SharedPool(database_url))
