"""The scanstore subpackage — the Scanner sweep's persistent output sink (Scanner v1). Structural
sibling of src/marketdata/; a one-way leaf (see ports.py) NEVER imported by the scoring path.

Store factory (`SCAN_STORE` env, default "disk"), mirroring `IV_STORE`/`ACCOUNT_STORE`: the on-disk
SQLite adapter is the DEFAULT; the Postgres adapter registers behind the SAME port. The connection
string is RUNTIME env only (`SCAN_DATABASE_URL`, falling back to `DATABASE_URL`) — never baked
(`no-secrets-in-image`)."""
from __future__ import annotations

import logging
import os

from .ports import ScanRow, ScanStore, SweepHeartbeat, BundleBlob, SCAN_STATUSES

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


__all__ = ["get_store", "available_stores", "ScanRow", "ScanStore", "SweepHeartbeat",
           "BundleBlob", "SCAN_STATUSES"]
