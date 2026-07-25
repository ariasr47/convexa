"""The scanner subpackage — the Scanner sweep worker's producer-side logic (Scanner v1 Plan 2).
A NET-NEW orchestration/provider subpackage: pure, injectable pieces (universe loader, tiering
pure-logic, row projection, the two-speed loop). It CALLS the unchanged compute_ticker and CONSUMES
its output; it is NEVER imported by engine/signals/live/darkpool/chain_store/the bundle-compute path
(the score-byte-identity boundary). The worker entrypoint is apps/api/worker.py."""
from __future__ import annotations

from .universe import UniverseConfig, load_universe  # noqa: E402

__all__ = ["UniverseConfig", "load_universe"]
