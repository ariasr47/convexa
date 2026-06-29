"""
Market-data provider PORT (the facade boundary).

Convexa's engine and signals layers consume plain dicts and never import a vendor SDK.
This module formalizes that boundary: a data source plugs in by subclassing
`MarketDataProvider` and translating its vendor payloads into the TypedDict contracts
below. Swapping Massive for another vendor means writing one new adapter + registering it
in `src/providers/__init__.py` -- no change to engine.py, signals.py, or main.py.

The TypedDicts ARE the contract. An adapter is correct iff it returns these shapes.
"""
from abc import ABC, abstractmethod
from datetime import time
from typing import AsyncIterator, Literal, Optional, TypedDict


class OptionGreeks(TypedDict):
    """Per-contract greeks. Any field may be None when the vendor could not price it;
    the engine treats a None `gamma` as 'unpriced' and skips it for GEX/greeks."""
    delta: Optional[float]
    gamma: Optional[float]
    theta: Optional[float]
    vega: Optional[float]


class OptionQuote(TypedDict):
    """The option's NBBO quote from the chain snapshot. OPTIONAL on a contract: consumers
    derive `mid = (bid+ask)/2` and fall back to a theoretical mark when it (or the whole
    quote) is absent -- never an error. bid/ask may be None individually."""
    bid: Optional[float]
    ask: Optional[float]


class OptionContract(TypedDict):
    """One option contract, normalized across vendors."""
    strike_price: float
    contract_type: str          # "call" | "put"
    expiration_date: str        # "YYYY-MM-DD"
    open_interest: int
    implied_volatility: float   # DECIMAL form (0.486 == 48.6%); 0.0 when unpriced
    volume: Optional[float]     # session traded volume; None when the vendor doesn't report it
    quote: Optional[OptionQuote]  # option NBBO bid/ask (for the tracked-contract mark); None if absent
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


class TradePrint(TypedDict):
    """A single executed trade, normalized across vendors (for order-flow backfill)."""
    price: float
    size: float
    timestamp: int          # nanoseconds since epoch
    conditions: list[int]
    off_exchange: bool      # True if reported via a TRF (off-exchange / "dark pool" / internalized)


class OffExchangeLevel(TypedDict):
    """A volume-by-price concentration of off-exchange prints over the recent window."""
    price: float
    shares: int
    share_of_offex_pct: float    # % of off-exchange shares at this bucketed price
    proximity_pct: float         # SIGNED fraction vs spot (+ above, - below)


class BlockPrint(TypedDict):
    """A single large off-exchange print (institutional-size, trf_id present).

    Display-only context: no side/direction is inferred (off-exchange prints carry no
    reliable side and include internalized retail). Largest notional first, top-N.
    """
    price: float            # print price
    shares: int             # print size
    notional: float         # price * shares (ranking key)
    proximity_pct: float    # SIGNED fraction vs spot (+ above, - below)
    age_seconds: int        # age of the print within the recent window


class OffExchange(TypedDict):
    """Off-exchange ("dark pool") activity summary over the recent trade tape.

    Best-effort context only: omitted entirely from the bundle when computation fails
    (the caller drops the whole object), never an error. Side/intent are unknown.
    """
    ratio_pct: Optional[float]          # off-exchange shares / total shares, as %
    offex_shares: int
    total_shares: int
    levels: list[OffExchangeLevel]
    blocks: list[BlockPrint]            # largest-notional off-exchange prints, top-N
    block_min_shares: int               # share threshold a print needed to count as a block
    note: str


class VendorCallMetric(TypedDict, total=False):
    """
    Normalized telemetry for one logical vendor call (observability seam). All vendor-specific
    fields are OPTIONAL: an adapter emits only what its SDK/transport exposes. `name` + `duration_ms`
    are captured at the call site regardless; `rate_limit` is None when the vendor doesn't report it
    (the operator readout then shows "unknown", never a fabricated number).
    """
    name: str
    duration_ms: float
    http_status: Optional[int]
    retries: int
    rate_limit: Optional[dict]   # {"remaining": int, "limit": int} | None


class StreamEvent(TypedDict, total=False):
    """One real-time event off the stock stream. `kind` discriminates the payload:
    - "quote": NBBO update -> bid/ask/bid_size/ask_size
    - "trade": execution    -> price/size
    All carry `ts` (ns)."""
    kind: Literal["quote", "trade"]
    ts: int
    bid: float
    ask: float
    bid_size: float
    ask_size: float
    price: float
    size: float


class MarketDataProvider(ABC):
    """
    Port every market-data source implements. Adapters do all vendor-specific work
    (auth, SDK calls, market-phase/spot selection, payload mapping) internally and return
    only the normalized contracts above.

    The fetch_* methods are synchronous and may block on network I/O; main.py runs them in a
    worker thread. They should NOT raise on a missing/unknown symbol -- return an empty
    OptionsMarketState ({} or synchronized_spot <= 0) / empty lists so callers can 404.
    """
    name: str = "base"
    feed_label: str = "unknown"   # "realtime" | "delayed" -- for freshness reporting

    # Optional observability seam (additive — NOT a method-signature change, so "add a vendor =
    # one adapter, nothing else changes" still holds). When an orchestrator sets this to a sink
    # exposing `record_vendor_call(name, duration_ms, http_status=, retries=, rate_limit=)`, an
    # adapter MAY enrich its vendor calls with rate-limit headroom / http_status / retries that
    # only it (seeing raw responses) can know. Adapters that don't implement it emit nothing;
    # logical call count + wall latency are captured at the orchestration call site regardless.
    metrics_sink: object = None

    @abstractmethod
    def fetch_options_market_state(self, ticker: str) -> OptionsMarketState | dict:
        """Full normalized option-chain snapshot for one underlying."""

    @abstractmethod
    def fetch_daily_bars(self, ticker: str) -> list[UnderlyingBar]:
        """Daily underlying bars, ascending (latest last). ~60d lookback is enough."""

    @abstractmethod
    def fetch_intraday_bars(self, ticker: str) -> list[IntradayBar]:
        """1-minute bars over a short trailing window for VWAP bands."""

    @abstractmethod
    def fetch_recent_trades(self, ticker: str, lookback_seconds: int) -> list[TradePrint]:
        """Recent executed trades (ascending) over a trailing window, to seed order flow."""

    @abstractmethod
    async def stream_stock(self, ticker: str) -> AsyncIterator[StreamEvent]:
        """
        Async stream of live NBBO quotes + trades for one stock ticker. Yields StreamEvents
        until the consumer stops iterating (which must tear the underlying connection down).
        Implemented as an async generator.
        """
        raise NotImplementedError
        yield  # pragma: no cover  (marks this as an async generator for typing)
