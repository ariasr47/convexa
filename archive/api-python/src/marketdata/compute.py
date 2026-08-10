"""
IV-rank compute helper (iv-rank BACKEND_EXECUTION_CONTRACT §2/§3, ARCHITECTURE §Q1/§Q4).

Two pure functions over already-fetched inputs — NO vendor call, NO new greeks:

  - `derive_cm30_sample(...)` — derive the current-cycle CM30 IV sample by linear-interpolating
    the already-computed term-structure curve in DTE space at DTE=30, with the defined fallbacks
    (nearest-tenor, then the raw atm_iv scalar). Returns an `IvSample` (ready to upsert) or None
    when no usable IV exists this cycle (a degenerate/null IV is SKIPPED — an honest gap).

  - `compute_iv_rank_read(...)` — read the ticker's most-recent-N samples from the store and build
    the `market_state.iv_rank` wire dict (the `computed` / degenerate-flat / `building` states, or
    None when the whole read is unavailable). Emits EXACTLY the INTERFACE_CONTRACT §3 shape.

ONE-WAY LEAF: imports stdlib/math + its own port ONLY. NEVER imports signals/engine/live/darkpool/
chain_store/the scoring path. `main.py` is the sole caller, after `generate_signals` returns.
"""
from __future__ import annotations

import logging
import math
import time
from datetime import datetime, timezone
from typing import Optional

from .ports import IvSample, IvTimeSeriesStore

logger = logging.getLogger("Convexa")

# --------------------------------------------------------------------------- pinned constants
CM30_TARGET_DTE = 30.0        # the constant-maturity target (the "IV30" convention)
WINDOW_CAP = 252              # rolling trailing window cap (~1 trading year), D-locked
N_MIN = 20                    # minimum-sample floor (D3, LOCKED) — rank AND percentile gate here
BAND_RICH_AT = 70.0          # rank >= 70 -> premium_rich (D2, LOCKED cut)
BAND_CHEAP_BELOW = 30.0      # rank < 30 -> premium_cheap; [30,70) -> neutral

# Wire-only descriptor strings (for the AI export self-description; the FE renders its OWN copy).
_ADVISORY_NOTE = ("Advisory context - where current implied volatility sits within this ticker's "
                  "own recently-accumulated history. Not a forecast, not a scored signal, not a "
                  "guarantee.")


def _num(v) -> Optional[float]:
    """A finite float or None (never lets a NaN/inf/non-number leak into a sample or read)."""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if math.isfinite(f) else None


# --------------------------------------------------------------------------- CM30 derivation
def _interpolate_cm30(points: list) -> Optional[tuple[float, str, float]]:
    """Interpolate ATM IV at DTE=30 from an ascending-by-DTE list of {dte, atm_iv} points.
    Returns (iv_value, iv_basis, basis_dte) or None. Never extrapolates."""
    clean = []
    for p in points or []:
        dte = _num(p.get("dte"))
        iv = _num(p.get("atm_iv"))
        if dte is None or iv is None or dte <= 0 or iv <= 0:
            continue
        clean.append((dte, iv))
    if not clean:
        return None
    clean.sort(key=lambda x: x[0])

    # Exact hit on a tenor.
    for dte, iv in clean:
        if dte == CM30_TARGET_DTE:
            return (iv, "interpolated_30d", 30.0)

    below = [(d, iv) for d, iv in clean if d < CM30_TARGET_DTE]
    above = [(d, iv) for d, iv in clean if d > CM30_TARGET_DTE]

    if below and above:
        d0, iv0 = below[-1]           # nearest tenor below 30
        d1, iv1 = above[0]            # nearest tenor above 30
        frac = (CM30_TARGET_DTE - d0) / (d1 - d0)
        iv = iv0 + frac * (iv1 - iv0)
        return (iv, "interpolated_30d", 30.0)

    # All tenors on one side of 30 -> do NOT extrapolate; fall back to the single nearest tenor.
    nearest = min(clean, key=lambda x: abs(x[0] - CM30_TARGET_DTE))
    return (nearest[1], "nearest_tenor", nearest[0])


def derive_cm30_sample(ticker: str, market_state: dict, market_data: dict,
                       session_date: str) -> Optional[IvSample]:
    """Derive the current-cycle CM30 sample from the already-computed term-structure curve.

    Fallback ladder (ARCHITECTURE §Q1): interpolate at 30 from the curve; if all tenors sit on one
    side of 30, use the single nearest tenor (`nearest_tenor` + its DTE); if the curve is
    unavailable, fall back to the raw nearest->=7-DTE `atm_iv` scalar (`nearest_tenor` + atm_iv_dte).
    Returns None (SKIP the write) when no usable positive IV / real spot exists this cycle.
    """
    spot = _num(market_state.get("gex_spot")) or _num(market_state.get("price"))
    if spot is None or spot <= 0:
        return None

    ts = (market_state.get("term_structure") or {})
    iv_basis = None
    resolved = _interpolate_cm30(ts.get("points") or [])
    if resolved is not None:
        iv_value, iv_basis, basis_dte = resolved
    else:
        # Curve unavailable -> raw nearest->=7-DTE atm_iv scalar (percentage points already).
        iv_value = _num(market_state.get("atm_iv"))
        basis_dte = _num(market_data.get("atm_iv_dte"))
        if iv_value is None or iv_value <= 0 or basis_dte is None or basis_dte <= 0:
            return None
        iv_basis = "nearest_tenor"

    if iv_value is None or iv_value <= 0:
        return None

    return IvSample(
        ticker=(ticker or "").upper(),
        session_date=session_date,
        iv_value=round(iv_value, 4),
        iv_basis=iv_basis,
        basis_dte=round(basis_dte, 2),
        captured_at=time.time(),
    )


def session_date_from_ns(timestamp_ns) -> Optional[str]:
    """The UTC calendar date 'YYYY-MM-DD' of a nanosecond snapshot timestamp (the daily grain)."""
    ns = _num(timestamp_ns)
    if ns is None or ns <= 0:
        return None
    return datetime.fromtimestamp(ns / 1e9, tz=timezone.utc).date().isoformat()


# --------------------------------------------------------------------------- rank/percentile read
def _band_from_rank(rank: float) -> str:
    if rank >= BAND_RICH_AT:
        return "premium_rich"
    if rank < BAND_CHEAP_BELOW:
        return "premium_cheap"
    return "neutral"


def _window_descriptor(window_sessions: int, sample_count: int) -> str:
    return (f"{window_sessions} of the last {WINDOW_CAP} sessions "
            f"({sample_count} accumulated; floor {N_MIN})")


def _basis_descriptor(iv_basis: str, basis_dte: float) -> str:
    if iv_basis == "interpolated_30d":
        return "constant-maturity 30-day ATM IV, interpolated from the term-structure curve"
    return f"nearest-tenor ATM IV fallback at {basis_dte:g} DTE (no clean 30-day interpolation)"


def compute_iv_rank_read(store: IvTimeSeriesStore, ticker: str,
                         current_sample: Optional[IvSample]) -> Optional[dict]:
    """Read the ticker's most-recent-N samples and build the `market_state.iv_rank` wire dict.

    Ordering choice (pinned, kept consistent): the read uses whatever the store currently holds.
    Because the write-through upsert runs BEFORE this read in the same serve (see main.py), today's
    just-written sample IS included in the window — the reported `sample_count` always matches what
    the read used. `current_sample` supplies the current IV / basis descriptors when it was derived
    this cycle (even if the write was skipped/failed, its value is still the honest current IV).

    Returns the read dict (`computed` / degenerate-flat / `building`) or None when the whole read is
    unavailable (no history AND no current sample). Every child nullable per the presence matrix.
    """
    samples = store.read_recent((ticker or "").upper(), WINDOW_CAP)
    sample_count = len(samples)

    # Current-IV basis: prefer this cycle's derived sample; else the most-recent stored sample.
    basis_sample = current_sample if current_sample is not None else (samples[-1] if samples else None)

    if sample_count == 0 and basis_sample is None:
        return None  # nothing to say this cycle -> whole read null (key still emitted by main.py)

    current_iv = round(basis_sample.iv_value, 4) if basis_sample is not None else None
    iv_basis = basis_sample.iv_basis if basis_sample is not None else None
    basis_dte = basis_sample.basis_dte if basis_sample is not None else None

    window_sessions = min(sample_count, WINDOW_CAP)

    # ---- building: below the floor ----
    if sample_count < N_MIN:
        read = {
            "state": "building",
            "rank": None,
            "rank_unavailable_reason": None,
            "percentile": None,
            "band": None,
            "current_iv": current_iv,
            "window_sessions": window_sessions,
            "sample_count": sample_count,
            "window_cap": WINDOW_CAP,
            "min_samples": N_MIN,
            "iv_basis": iv_basis,
            "basis_dte": basis_dte,
            "window_descriptor": _window_descriptor(window_sessions, sample_count),
            "basis_descriptor": (_basis_descriptor(iv_basis, basis_dte)
                                 if iv_basis is not None else "no current IV sample this cycle"),
            "advisory_note": _ADVISORY_NOTE,
        }
        return read

    # ---- computed: >= floor. Need a current IV to place within the window. ----
    if current_iv is None:
        # We have >=20 samples but no usable current IV this cycle -> honest null read.
        return None

    ivs = [s.iv_value for s in samples]
    iv_min = min(ivs)
    iv_max = max(ivs)

    percentile = round(100.0 * sum(1 for v in ivs if v < current_iv) / window_sessions, 2)

    if iv_max == iv_min:
        # Degenerate-flat: rank undefined, NEVER a fabricated 50. Percentile still defined (D8b).
        rank = None
        rank_unavailable_reason = "flat_window"
        band = None
    else:
        rank = round(100.0 * (current_iv - iv_min) / (iv_max - iv_min), 2)
        rank = min(max(rank, 0.0), 100.0)  # clamp float noise only
        rank_unavailable_reason = None
        band = _band_from_rank(rank)

    return {
        "state": "computed",
        "rank": rank,
        "rank_unavailable_reason": rank_unavailable_reason,
        "percentile": percentile,
        "band": band,
        "current_iv": current_iv,
        "window_sessions": window_sessions,
        "sample_count": sample_count,
        "window_cap": WINDOW_CAP,
        "min_samples": N_MIN,
        "iv_basis": iv_basis,
        "basis_dte": basis_dte,
        "window_descriptor": _window_descriptor(window_sessions, sample_count),
        "basis_descriptor": _basis_descriptor(iv_basis, basis_dte),
        "advisory_note": _ADVISORY_NOTE,
    }
