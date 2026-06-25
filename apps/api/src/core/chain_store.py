"""
Process-local SHARED CHAIN STORE — the input cache that lets a cold REST bundle request hit a
warm path when a live SSE session for the same ticker is already holding a fresh chain.

ARCHITECTURE (ticker-load-experience §4, binding):
- PRODUCER: `LiveSession._refresh_chain` stashes the FULL, UNFILTERED `market_data`
  (`fetch_options_market_state`'s return) here on every refresh, BEFORE its own greeks-filter.
- CONSUMER: the REST miss path (`compute_ticker`'s chain-fetch site) reads it best-effort and
  freshness-gated, short-circuiting ONLY the chain fetch (daily/intraday bars still fetch fresh).

LOAD-BEARING ISOLATION RULES:
- This is a CHAIN-INPUT cache, never a bundle-output cache. It holds `market_data`, ticker-keyed +
  timestamped. `compute_ticker` stays the sole transform — same `market_data` in → byte-identical
  bundle out (`[additive-keeps-score-byte-identical]`, AC-Invariant-1).
- READ-ONLY to every consumer: the stored dict is never mutated in place (engine/_build_market_state
  already treat `market_data` as read-only input; preserve that).
- BEST-EFFORT: any miss/stale/error here falls back to the normal vendor fetch with NO error surfaced
  (`[best-effort-isolated-or-null]`). Pre-warm is a pure acceleration, never a dependency, never a
  correctness factor.
- No active session → no entry → no behavior change (the common first-cold-visit case).

Concurrency: written from the event loop (after the live session's `to_thread` chain fetch resolves)
and read on the REST miss path (also event-loop-resident before dispatching `compute_ticker` to a
worker thread). Single-writer-per-ticker from the loop, like the existing `_cache` discipline — no
lock needed. All entry points are defensively wrapped so a store fault never escapes.
"""
import logging
import time

logger = logging.getLogger("GammaFlowAsync")

# ticker -> {"market_data": dict, "captured_at": float-epoch-seconds}
_store: dict = {}


def put(ticker: str, market_data: dict) -> None:
    """
    PRODUCER entry: stash the full unfiltered chain `market_data` for `ticker` with a capture
    timestamp. Best-effort — a store fault is swallowed (the live path proceeds unchanged).
    Only stores a usable chain (a real synchronized_spot); a degenerate/empty snapshot is ignored
    so the consumer never short-circuits onto a chain that would 404 anyway.
    """
    try:
        if not market_data or market_data.get("synchronized_spot", 0) <= 0:
            return
        _store[(ticker or "").upper()] = {"market_data": market_data, "captured_at": time.time()}
    except Exception:
        logger.debug("chain_store: put failed", exc_info=True)


def get_fresh(ticker: str, max_age_seconds: float) -> dict | None:
    """
    CONSUMER entry: return the shared `market_data` for `ticker` IFF a fresh entry exists whose
    capture age ≤ `max_age_seconds`; else None. Returns the stored reference (read-only to the
    caller — never mutate it in place). Best-effort: any fault yields None (→ normal vendor fetch).
    """
    try:
        entry = _store.get((ticker or "").upper())
        if entry is None:
            return None
        if (time.time() - entry["captured_at"]) > max_age_seconds:
            return None  # stale beyond the pre-warm budget → caller fetches fresh
        md = entry.get("market_data")
        # Defensive re-validation: only hand back a usable chain.
        if not md or md.get("synchronized_spot", 0) <= 0:
            return None
        return md
    except Exception:
        logger.debug("chain_store: get_fresh failed", exc_info=True)
        return None


def evict(ticker: str) -> None:
    """Best-effort eviction when a session tears down. A stale leftover is harmless (the freshness
    gate rejects it), so this is purely hygienic."""
    try:
        _store.pop((ticker or "").upper(), None)
    except Exception:
        logger.debug("chain_store: evict failed", exc_info=True)
