from pydantic import BaseModel
from typing import Optional

class MarketState(BaseModel):
    # Core Data
    ticker: str
    price: float
    timestamp: float

    # Dealer Liquidity Levels (Structural Constraints)
    call_wall: float
    put_wall: float
    gamma_flip: float
    net_gex: float

    # Dealer Hedging Dynamics (The "Dealer Traps")
    net_vanna: Optional[float] = None
    net_charm: Optional[float] = None
    net_volga: Optional[float] = None

    # Statistical Mean-Reversion Anchors (VWAP Deviations)
    vwap: float
    vwap_upper_2: float
    vwap_upper_3: float
    vwap_lower_2: float
    vwap_lower_3: float

    # Volatility & Sentiment
    atm_iv: float
    hv_30d: float
    iv_hv_ratio: float
    net_flow: float  # Order flow aggression (Volume Ask - Volume Bid)
    put_call_ratio: float

    # Macro Regime (Flag for Tier 1 Catalyst Override)
    macro_priority: str = "General"  # e.g., 'Tier1' or 'General'
    news_summary: Optional[str] = None