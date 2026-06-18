from pydantic import BaseModel
from typing import Optional

class MarketState(BaseModel):
    # Core Data
    ticker: str
    price: float           # current (live/delayed) spot for display
    gex_spot: Optional[float] = None  # spot the GEX/greek levels were computed at (cash close after hours; == price during RTH)
    timestamp: int  # nanoseconds since epoch (int avoids float64 precision loss at 19 digits)
    timestamp_iso: Optional[str] = None  # human-readable UTC ISO-8601 for the consuming AI

    # Dealer Liquidity Levels (Structural Constraints)
    call_wall: float       # strike with the most call open interest (OI-based wall)
    put_wall: float        # strike with the most put open interest (OI-based wall)
    peak_gex_strike: Optional[float] = None  # strike with the most gross gamma (price magnet)
    gamma_flip: float
    max_pain: Optional[float] = None         # nearest-monthly-OPEX price minimizing total option payout
    max_pain_expiration: Optional[str] = None  # which (monthly) expiration max_pain is computed for
    net_gex: float

    # Gross gamma breakdown (mirrors the Call/Put/Total GEX shown on retail dashboards)
    call_gex: Optional[float] = None         # sum of call dollar GEX (>= 0)
    put_gex: Optional[float] = None          # sum of put dollar GEX (<= 0)
    total_gex: Optional[float] = None        # |call_gex| + |put_gex|

    # Dealer Hedging Dynamics (The "Dealer Traps")
    net_vanna: Optional[float] = None
    net_charm: Optional[float] = None
    net_volga: Optional[float] = None

    # Statistical Mean-Reversion Anchors (session-anchored VWAP ± volume-weighted std)
    # Null when intraday bars are unavailable / too sparse to form stable bands.
    vwap: Optional[float] = None
    vwap_upper_2: Optional[float] = None
    vwap_upper_3: Optional[float] = None
    vwap_lower_2: Optional[float] = None
    vwap_lower_3: Optional[float] = None

    # Volatility & Sentiment
    atm_iv: float
    hv_30d: float
    iv_hv_ratio: float
    net_flow: Optional[float] = None  # Order flow aggression; null until computed from the trades tape
    put_call_ratio: float