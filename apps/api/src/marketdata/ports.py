"""
Market-data time-series store PORT (the persistence facade boundary) + the sample record.

The project's FIRST persistent MARKET-DATA store (iv-rank ARCHITECTURE §Q3) — a SIBLING of the
auth leaf, NOT an auth port. Mirrors the `src/auth/ports.py` / `src/providers/base.py` discipline:
ONE abstract port defines the CONTENT contract (the `IvSample` record below), and a concrete
backend plugs in by implementing it. The default no-external-service adapter (`sqlite_store.py`)
is the buildable/verifiable-here backend; the Postgres adapter (`postgres_store.py`) is the
parity-reviewed prod drop-in behind this SAME port — that is the entire swap.

The record IS the contract (like the auth record dataclasses / provider TypedDicts). Field names
here are internal to this leaf; the wire shape the FE sees (`market_state.iv_rank`) is assembled in
`compute.py` per the iv-rank INTERFACE_CONTRACT.

This module is part of the marketdata LEAF: it imports only stdlib. engine/signals/live/darkpool/
chain_store/the bundle-compute path NEVER import it (the structural guarantee of score
byte-identity — ARCHITECTURE §4/§6). `main.py` is the ONLY orchestration boundary that mounts it.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


# ----------------------------------------------------------------------------- record

@dataclass
class IvSample:
    """One accumulated daily IV sample (iv-rank ARCHITECTURE §3.1). The record IS the port
    contract. Non-secret market data — `secret-encrypted-at-rest` does NOT apply (never add
    encryption / a masked hint).

    Uniqueness / grain: `(ticker, session_date)` is unique; the write is an upsert-if-absent on
    that key (the once-per-ticker-per-UTC-day guard). The store never holds two rows for the same
    ticker-session.
    """
    ticker: str            # canonicalized (upper-cased) symbol the sample belongs to
    session_date: str      # UTC calendar date 'YYYY-MM-DD' — the daily grain / dedupe key half
    iv_value: float        # CM30 IV level, PERCENTAGE POINTS (x100, comparable to atm_iv)
    iv_basis: str          # how iv_value was derived: 'interpolated_30d' | 'nearest_tenor'
    basis_dte: float       # actual DTE the sample represents (30 for a clean interp; else tenor DTE)
    captured_at: float     # epoch-second wall-clock write time (audit / freshness)


# ----------------------------------------------------------------------------- port

class IvTimeSeriesStore(ABC):
    """The IV time-series store port (iv-rank ARCHITECTURE §Q3). Exposes EXACTLY the two ops the
    write path and read path need — an idempotent upsert-if-absent, and a bounded most-recent-N
    read ordered by session date. Nothing else."""

    @abstractmethod
    def upsert_if_absent(self, sample: IvSample) -> None:
        """Idempotent write of ONE `(ticker, session_date)` sample. If a row for that key already
        exists it is a NO-OP (the store, not app-local state, is the source of truth for 'did today
        already write'). The first served bundle for a ticker on a given UTC day writes that day's
        sample; subsequent serves that same UTC day are no-ops."""

    @abstractmethod
    def read_recent(self, ticker: str, limit: int) -> list[IvSample]:
        """Return up to `limit` MOST-RECENT samples for `ticker`, ORDERED ASCENDING by session_date
        (oldest -> newest). Empty list when the ticker has no history. The most-recent sample is the
        current-cycle IV basis for the rank read."""
