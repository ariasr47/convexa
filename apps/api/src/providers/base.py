"""
Market-data provider PORT (the facade boundary).

GammaFlow's engine and signals layers consume plain dicts and never import a vendor SDK.
This module formalizes that boundary: a data source plugs in by subclassing
`MarketDataProvider` and translating its vendor payloads into the TypedDict contracts
below. Swapping Massive for another vendor means writing one new adapter + registering it
in `src/providers/__init__.py` -- no change to engine.py, signals.py, or main.py.

The TypedDicts ARE the contract. An adapter is correct iff it returns these shapes.
"""
from abc import ABC, abstractmethod
from datetime import time
from typing import Optional, TypedDict


class OptionGreeks(TypedDict):
    """Per-contract greeks. Any field may be None when the vendor could not price it;
    the engine treats a None `gamma` as 'unpriced' and skips it for GEX/greeks."""
    delta: Optional[float]
    gamma: Optional[float]
    theta: Optional[float]
    vega: Optional[float]


class OptionContract(TypedDict):
    """One option contract, normalized across vendors."""
    strike_price: float
    contract_type: str          # "call" | "put"
    expiration_date: str        # "YYYY-MM-DD"
    open_interest: int
    implied_volatility: float   # DECIMAL form (0.486 == 48.6%); 0.0 when unpriced
    greeks: OptionGreeks


class OptionsMarketState(TypedDict):
    """The option-chain snapshot the engine turns into a GEX profile.

    `synchronized_spot` is the spot the levels are computed at (e.g. last completed
    session close when the market is closed); `current_spot` is the live/delayed display
    spot. They coincide during regular trading hours.
    """
    ticker: str
    synchronized_spot: float
    current_spot: float
    timestamp: int                      # nanoseconds since epoch (snapshot time)
    atm_iv: float                       # DECIMAL form
    atm_iv_expiration: Optional[str]
    atm_iv_dte: Optional[float]
    contracts: list[OptionContract]


class UnderlyingBar(TypedDict):
    """A daily underlying bar; only `close` is required by the engine (for 30d HV)."""
    close: float
    vwap: float


class IntradayBar(TypedDict):
    """A 1-minute intraday bar used to build session-anchored VWAP bands."""
    session: str        # Eastern-Time session date, ISO (YYYY-MM-DD)
    minute: time        # Eastern-Time minute-of-day
    vw: float           # volume-weighted price for the bar
    v: float            # volume for the bar


class MarketDataProvider(ABC):
    """
    Port every market-data source implements. Adapters do all vendor-specific work
    (auth, SDK calls, market-phase/spot selection, payload mapping) internally and return
    only the normalized contracts above.

    Methods are synchronous and may block on network I/O; main.py runs them in a worker
    thread. They should NOT raise on a missing/unknown symbol -- return an empty
    OptionsMarketState ({} or synchronized_spot <= 0) / empty lists so callers can 404.
    """
    name: str = "base"

    @abstractmethod
    def fetch_options_market_state(self, ticker: str) -> OptionsMarketState | dict:
        """Full normalized option-chain snapshot for one underlying."""

    @abstractmethod
    def fetch_daily_bars(self, ticker: str) -> list[UnderlyingBar]:
        """Daily underlying bars, ascending (latest last). ~60d lookback is enough."""

    @abstractmethod
    def fetch_intraday_bars(self, ticker: str) -> list[IntradayBar]:
        """1-minute bars over a short trailing window for VWAP bands."""
