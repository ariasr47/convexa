"""
The broker subpackage — broker-connect's ONE-WAY LEAF (a structural sibling of `src/auth/`,
`src/marketdata/`).

`main.py` is the ONLY module that imports it (the two book endpoints + per-request credential
resolution). The leaf imports stdlib + its own modules + (inside the Webull adapter ONLY) the
pinned Webull SDK read subset — and NEVER auth, engine, signals, live, darkpool, chain_store
or the bundle-compute path. That boundary is the structural guarantee that a real position can
never become a scoring input (`[additive-keeps-score-byte-identical]`), and it is pinned by
the B6 source-scan tests, not by prose.

Factory: `POSITIONS_PROVIDER` env (default `webull`), mirroring `get_provider()`/
`ACCOUNT_STORE`. `stub` serves keyless verification; `snaptrade` is RESERVED (the named later
adapter — designed-for at the port, zero code).
"""
from __future__ import annotations

import os

from .ports import (BrokerBook, BrokerCredential, BrokerFact, BrokerLeg, BrokerPosition,
                    PositionsProvider, ProviderCapabilities)

_RESERVED = {"snaptrade": "reserved for the named v2 adapter (external users, OAuth) — "
                          "designed-for at the port, deliberately zero code in v1"}


def get_positions_provider(name: str | None = None) -> PositionsProvider:
    """Env-selected provider factory. Raises ValueError on unknown/reserved names (config
    error, surfaced at first use — the `get_provider()` precedent)."""
    resolved = (name or os.getenv("POSITIONS_PROVIDER") or "webull").strip().lower()
    if resolved == "stub":
        from .stub import StubProvider
        return StubProvider()
    if resolved == "webull":
        from .webull_adapter import WebullProvider
        return WebullProvider()
    if resolved in _RESERVED:
        raise ValueError(f"POSITIONS_PROVIDER '{resolved}' is {_RESERVED[resolved]}.")
    raise ValueError(f"Unknown POSITIONS_PROVIDER '{resolved}'. Available: webull, stub.")


__all__ = ["get_positions_provider", "BrokerBook", "BrokerCredential", "BrokerFact",
           "BrokerLeg", "BrokerPosition", "PositionsProvider", "ProviderCapabilities"]
