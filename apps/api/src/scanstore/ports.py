"""
Ports + records for the ScanStore — the sweep worker's output sink and the read API's source
(Scanner v1, Plan 1). A ONE-WAY LEAF, structural sibling of `src/marketdata/`: imports ONLY stdlib.
NEVER imported by engine/signals/live/darkpool/chain_store/the bundle-compute path — that boundary
is the score-byte-identity guarantee (no scan row can become a scoring input).

Two records: ScanRow (one CURRENT row per tracked symbol; latest-wins) and SweepHeartbeat (one row,
the worker's liveness + last-full-pass marker). The port has four methods — two for rows, two for
the heartbeat. Postgres and SQLite adapters implement it identically (parity tested in _selftest.py).
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Sequence

# Row status vocabulary (closed set — the FE renders these via a closed lookup, never re-derives).
#   ok        -> a fresh full compute produced this row
#   stale     -> last compute is older than the freshness budget (worker behind / down)
#   error     -> this symbol failed its last compute (degrades this row alone)
#   building  -> tracked but not yet computed once (cold universe entry)
SCAN_STATUSES = ("ok", "stale", "error", "building")


@dataclass
class ScanRow:
    """One current scan row for a tracked symbol. Every numeric field is Optional — a partial
    compute (price only, or a failed structure pass) still produces an honest row."""
    symbol: str                       # canonical UPPER-case
    price: Optional[float]            # last poll price
    chg_pct: Optional[float]         # % change since prior session close
    score: Optional[float]           # opportunity_score (CONSUMED from the bundle, never re-derived)
    tier: Optional[str]              # opportunity_tier enum
    regime: Optional[str]            # regime label enum
    vol_regime: Optional[str]        # vol-regime label enum
    flip: Optional[float]            # gamma flip level
    dist_to_flip_pct: Optional[float]
    call_wall: Optional[float]
    put_wall: Optional[float]
    dist_to_wall_pct: Optional[float]  # signed % to the nearer wall
    as_of: float                      # epoch-seconds of the compute that produced this row
    status: str                       # one of SCAN_STATUSES

    def to_wire(self) -> dict:
        """The FE-facing shape (the /api/scan row). Keys are stable — the conformance spec pins them."""
        return {
            "symbol": self.symbol,
            "price": self.price,
            "chg_pct": self.chg_pct,
            "score": self.score,
            "tier": self.tier,
            "regime": self.regime,
            "vol_regime": self.vol_regime,
            "flip": self.flip,
            "dist_to_flip_pct": self.dist_to_flip_pct,
            "call_wall": self.call_wall,
            "put_wall": self.put_wall,
            "dist_to_wall_pct": self.dist_to_wall_pct,
            "as_of": self.as_of,
            "status": self.status,
        }


@dataclass
class SweepHeartbeat:
    """The worker's liveness marker + last-full-pass completion. One row (singleton) in the store.
    The read API surfaces these so the page can say 'sweep last ran Xm ago' over stale rows."""
    updated_at: float                      # last worker tick (epoch seconds)
    sweep_last_completed: Optional[float]  # epoch seconds of the last COMPLETED full pass, or None
    universe_size: int                     # number of symbols the worker is tracking

    def to_wire(self) -> dict:
        return {
            "updated_at": self.updated_at,
            "sweep_last_completed": self.sweep_last_completed,
            "universe_size": self.universe_size,
        }


@dataclass
class BundleBlob:
    """The full computed bundle for a tracked symbol, serialized (json) + freshness-stamped
    (§4.3). Latest-wins by symbol. It is a freshness-GATED cache blob for Plan 3's warm-click
    read-through — NOT re-shaped or re-scored on read: the web app either serves it (fresh) or
    ignores it (stale/miss → normal vendor fetch). `compute_ticker` stays the sole transform."""
    symbol: str            # canonical UPPER-case
    as_of: float           # epoch-seconds of the compute that produced the bundle
    bundle_json: str       # json.dumps(bundle) — the same object the ticker endpoint serves

    def to_wire(self) -> dict:
        return {"symbol": self.symbol, "as_of": self.as_of, "bundle_json": self.bundle_json}


class ScanStore(ABC):
    """The sweep worker writes; the read API reads. Latest-wins by symbol (rows are current state,
    NOT an accumulating series — this is the one deliberate divergence from the iv-rank store)."""

    @abstractmethod
    def upsert_row(self, row: ScanRow) -> None:
        """Insert or OVERWRITE the row for `row.symbol` (latest-wins)."""

    @abstractmethod
    def read_rows(self, symbols: Optional[Sequence[str]] = None) -> list[ScanRow]:
        """All rows (symbols=None) or the subset for the given symbols. Missing symbols are simply
        absent from the result (no placeholder rows). Order: by symbol ascending (stable)."""

    @abstractmethod
    def write_heartbeat(self, hb: SweepHeartbeat) -> None:
        """Overwrite the singleton heartbeat row."""

    @abstractmethod
    def read_heartbeat(self) -> Optional[SweepHeartbeat]:
        """The heartbeat, or None if the worker has never written one."""

    @abstractmethod
    def write_bundle_blob(self, blob: BundleBlob) -> None:
        """Insert or OVERWRITE the bundle blob for `blob.symbol` (latest-wins)."""

    @abstractmethod
    def read_bundle_blob(self, symbol: str) -> Optional[BundleBlob]:
        """The current bundle blob for `symbol`, or None if absent. Freshness is the caller's to
        judge (the blob carries `as_of`); the store returns whatever it last stored."""
