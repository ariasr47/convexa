"""
The marketdata subpackage — the project's FIRST persistent MARKET-DATA store (iv-rank).

A ONE-WAY LEAF (ARCHITECTURE §4/§6 / BACKEND_EXECUTION_CONTRACT §1), a SIBLING of `src/auth/` (NOT
an auth port). `main.py` is the ONLY module that imports it — to wire the IV write-through +
rank read at the attach-after-`generate_signals` boundary. This subpackage imports stdlib + math +
its own port/adapters (+ the DB driver lazily in the Postgres adapter only) — and NEVER
engine.py / signals.py / live.py / darkpool.py / chain_store.py / the bundle-compute path. That
module boundary is the structural guarantee of score byte-identity: no IV sample can ever become an
input to opportunity_score / opportunity_tier / state_fingerprint / the entry gate.

Public surface:
- `get_store()` — the env-selected `IvTimeSeriesStore` over the active backend (cached).
- `derive_cm30_sample`, `compute_iv_rank_read`, `session_date_from_ns` — the compute helpers.
- `IvSample`, `IvTimeSeriesStore` — the port + record (for tests / parity review).

Store factory (`IV_STORE` env, default "disk"), mirroring `ACCOUNT_STORE` / `DATA_PROVIDER`: the
on-disk SQLite adapter is the DEFAULT (survives restart so history actually accumulates in dev); the
Postgres adapter registers behind the SAME port. The connection string is read from RUNTIME env only
(`IV_DATABASE_URL`, falling back to `DATABASE_URL`) — never baked (`no-secrets-in-image`).
"""
from __future__ import annotations

import logging
import os

from .compute import (compute_iv_rank_read, derive_cm30_sample,  # re-exported for main.py
                      session_date_from_ns)
from .ports import IvSample, IvTimeSeriesStore

logger = logging.getLogger("Convexa")


def _make_disk_store() -> IvTimeSeriesStore:
    from .sqlite_store import make_store
    return make_store()


def _make_postgres_store() -> IvTimeSeriesStore:
    """The PERSISTENT Postgres adapter. Reads `IV_DATABASE_URL` (falling back to the shared
    `DATABASE_URL`) from RUNTIME env ONLY (never baked — `no-secrets-in-image`). A missing/empty
    connection string is a config error surfaced here. An UNREACHABLE DB does NOT crash boot — the
    adapter defers the fault to first use, where the write/read wrapper in main.py swallows it and
    emits iv_rank=null (mirrors auth/__init__._make_postgres_stores)."""
    database_url = (os.getenv("IV_DATABASE_URL", "").strip()
                    or os.getenv("DATABASE_URL", "").strip())
    if not database_url:
        raise ValueError(
            "IV_STORE=postgres requires IV_DATABASE_URL or DATABASE_URL "
            "(e.g. postgresql://user:pass@host:port/db). Set it via runtime env; it is never "
            "committed or baked into an image.")
    from .postgres_store import make_store
    return make_store(database_url)


# name -> store factory. The on-disk SQLite adapter is the DEFAULT (disk); the Postgres adapter
# registers behind the SAME port (ARCHITECTURE §Q3).
_STORE_FACTORIES = {
    "disk": _make_disk_store,
    "postgres": _make_postgres_store,
}

_store: IvTimeSeriesStore | None = None


def available_stores() -> list[str]:
    return sorted(_STORE_FACTORIES)


def get_store() -> IvTimeSeriesStore:
    """Build (once) the IV time-series store over the env-selected backend (`IV_STORE`, default
    "disk"). Cached for the process lifetime. Raises ValueError on an unknown backend name."""
    global _store
    if _store is not None:
        return _store
    name = os.getenv("IV_STORE", "disk").lower()
    factory = _STORE_FACTORIES.get(name)
    if factory is None:
        raise ValueError(
            f"Unknown IV_STORE '{name}'. Available: {', '.join(available_stores())}")
    _store = factory()
    return _store


__all__ = [
    "get_store", "available_stores",
    "derive_cm30_sample", "compute_iv_rank_read", "session_date_from_ns",
    "IvSample", "IvTimeSeriesStore",
]
