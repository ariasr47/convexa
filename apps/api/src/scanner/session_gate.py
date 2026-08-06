"""
Market-hours gate for the sweep worker (owner-directed 2026-08-06, ahead of the worker's first
deploy).

**The problem it solves.** The two-speed loop sweeps forever at its configured cadence with no
session awareness. Locally nobody notices — the worker is started and stopped by hand. On Railway it
is an always-on second service, and PROJECT_CONTEXT §4 records that the vendor has **no overnight
coverage (20:00–04:00 ET)**. So for roughly a third of every day the worker re-fetches full option
chains to recompute values that cannot have changed, and pays for it.

**Why it ships BEFORE the worker's first deploy:** it is far cheaper than reading a surprising
vendor bill and back-deriving the cause.

Three rules, each load-bearing:

1. **Fails OPEN.** If the session lookup raises, we sweep. A gate that fails closed would silently
   stop the scanner for everyone on a clock/zoneinfo error — worse than the waste it prevents.
2. **Default ON.** Unset `SCAN_MARKET_HOURS_ONLY` means gated, because the deployed always-on case
   is the one that costs money and the local case is the one someone is watching.
3. **An idle worker must stay distinguishable from a dead one** (`model-read-carries-its-
   assumptions`). The gate only decides whether to *sweep*; the loop keeps writing the heartbeat on
   a slow tick while idle, so the shipped worker-down banner does not fire for a worker that is
   deliberately resting.

Scheduling only — `compute_ticker` and every scoring path are untouched
(`additive-keeps-score-byte-identical`).

⚠ **Holidays are NOT covered**, and this module does not pretend otherwise. `classify_session()`
carries no holiday calendar (documented at its definition), so a market holiday reads as its weekday
session and we sweep through it. Weekends *are* covered — they classify as `closed`. Closing the
holiday gap needs a real exchange calendar; that is a separate change, not a silent claim here.
"""
from __future__ import annotations

import logging
import os
from typing import Callable

logger = logging.getLogger("Convexa")

# The sessions the vendor actually covers (`src/core/live.py:classify_session`). Sweeping outside
# these re-fetches chains that cannot have moved. `overnight` (20:00–04:00) and `closed` (weekend)
# are the two we skip.
VENDOR_COVERED_SESSIONS = frozenset({"premarket", "regular", "afterhours"})

_TRUTHY = {"1", "true", "yes", "on"}
_FALSY = {"0", "false", "no", "off"}


def market_hours_only() -> bool:
    """Read the knob. **Unset ⇒ True** (gated), unlike most flags in this codebase — the expensive
    default is the always-on deployed worker, so the safe default is the frugal one. Only an
    explicit falsy value disables the gate; anything unrecognised keeps it on and says so."""
    raw = os.getenv("SCAN_MARKET_HOURS_ONLY", "").strip().lower()
    if raw == "":
        return True
    if raw in _TRUTHY:
        return True
    if raw in _FALSY:
        return False
    logger.warning("[worker] SCAN_MARKET_HOURS_ONLY=%r is not recognised; keeping the gate ON", raw)
    return True


def should_sweep(session_fn: Callable[[], str]) -> bool:
    """
    True when the sweep should run right now.

    `session_fn` is injected rather than imported so the loop stays testable with no clock control,
    matching how every other input to the loop is supplied.
    """
    if not market_hours_only():
        return True
    try:
        session = session_fn()
    except Exception:
        # FAIL OPEN — see rule 1. A broken clock must not silently stop the scanner.
        logger.warning("[worker] session lookup failed; sweeping anyway (gate fails open)",
                       exc_info=False)
        return True
    return session in VENDOR_COVERED_SESSIONS
