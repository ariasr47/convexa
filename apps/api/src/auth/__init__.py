"""
The auth subpackage — the project's first stateful backend surface + first credential store.

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

logger = logging.getLogger("GammaFlowAsync")


def _make_memory_stores() -> AuthStores:
    from .sqlite_store import make_stores
    return make_stores()


# name -> store-bundle factory. The in-memory SQLite adapter is the only one built this phase;
# a persistent (Postgres/file) adapter registers here behind the same ports (ARCHITECTURE §5.2).
_STORE_FACTORIES = {
    "memory": _make_memory_stores,
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
