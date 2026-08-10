"""
The auth subpackage — the project's first stateful backend surface + credential stores (user
accounts + the per-user encrypted BYO-AI-key, byo-ai-key).

It is a ONE-WAY LEAF (ARCHITECTURE §6 / BACKEND_EXECUTION_CONTRACT §1): `main.py` is the ONLY
module that imports it (to wire the auth endpoints + session resolution + the two gated-surface
gates). The auth subpackage imports stdlib + its hashing/OAuth deps + its own ports — and NEVER
engine.py / signals.py / live.py / darkpool.py / chain_store.py / the bundle-compute path. That
module boundary is the structural guarantee of score byte-identity: no auth datum (user, session,
setting) can ever become an input to opportunity_score / opportunity_tier / state_fingerprint /
the entry gate.

Public surface:
- `get_service()` — the env-selected `AuthService` over the active store backend (cached).
- `AuthError`, `COOKIE_NAME`, `errors` — for the router/main to map the error class + the cookie.

Store factory (`ACCOUNT_STORE` env, default "memory"), mirroring `get_provider()` + `DATA_PROVIDER`:
the in-memory SQLite adapter is the ONLY adapter this phase; a persistent adapter is a future
drop-in registered in `_STORE_FACTORIES`. Nothing else changes.
"""
from __future__ import annotations

import logging
import os

from . import errors as errors  # re-exported for main.py
from .cookies import COOKIE_NAME
from .errors import AuthError
from .ports import AuthStores
from .service import AuthService

logger = logging.getLogger("Convexa")


def _make_memory_stores() -> AuthStores:
    from .sqlite_store import make_stores
    return make_stores()


def _make_postgres_stores() -> AuthStores:
    """
    The PERSISTENT Postgres adapter (persistent-db ARCHITECTURE §4). Reads `DATABASE_URL` from
    RUNTIME env ONLY (never baked, never committed — [no-secrets-in-image]) and builds the
    pool-backed four-port bundle. A missing/empty `DATABASE_URL` is a config error surfaced here
    (same shape as the "Unknown ACCOUNT_STORE" raise). An UNREACHABLE DB does NOT crash boot — the
    adapter defers the fault to first use, where it surfaces as the auth error class (§5).
    """
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise ValueError(
            "ACCOUNT_STORE=postgres requires DATABASE_URL (e.g. postgresql://user:pass@host:port/db). "
            "Set it via runtime env; it is never committed or baked into an image.")
    from .postgres_store import make_stores
    return make_stores(database_url)


# name -> store-bundle factory. The in-memory SQLite adapter is the DEFAULT (memory); the persistent
# Postgres adapter (persistent-db) registers behind the SAME four ports (ARCHITECTURE §4/§5.2).
_STORE_FACTORIES = {
    "memory": _make_memory_stores,
    "postgres": _make_postgres_stores,
}

_service: AuthService | None = None


def available_stores() -> list[str]:
    return sorted(_STORE_FACTORIES)


def get_service() -> AuthService:
    """
    Build (once) the AuthService over the env-selected store backend (`ACCOUNT_STORE`, default
    "memory"). Cached for the process lifetime — the in-memory store must be a single shared DB.
    Raises ValueError on an unknown backend name (config error, surfaced at boot/first use).
    """
    global _service
    if _service is not None:
        return _service
    name = os.getenv("ACCOUNT_STORE", "memory").lower()
    factory = _STORE_FACTORIES.get(name)
    if factory is None:
        raise ValueError(
            f"Unknown ACCOUNT_STORE '{name}'. Available: {', '.join(available_stores())}")
    logger.info(f"Auth store backend: {name}")
    _service = AuthService(factory())
    return _service


__all__ = ["get_service", "available_stores", "AuthError", "COOKIE_NAME", "errors"]
