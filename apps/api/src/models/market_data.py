from pydantic import BaseModel
from typing import Optional


class IvSkew(BaseModel):
    """Put-vs-call IV skew at a single anchor tenor (nearest expiration >= 7 DTE)."""
    slope: float                      # put_iv - call_iv, in IV points (downside richer => +)
    put_iv: float                     # downside reference IV (%)
    call_iv: float                    # upside reference IV (%)
    dte: Optional[int] = None         # tenor used (calendar days)
    expiration: str
    reference: str                    # "25d" | "moneyness" -- which reference rule produced the IVs


class TermPoint(BaseModel):
    dte: int
    expiration: str
    atm_iv: float                     # ATM IV at this tenor (%)


class TermStructure(BaseModel):
    """Cross-tenor ATM-IV curve (full available curve, ascending by DTE)."""
    points: list[TermPoint]
    state: str                        # "contango" | "backwardation" | "flat" (server-emitted)
    near_iv: float                    # near-tenor ATM IV (%)
    far_iv: float                     # far-tenor ATM IV (%)
    slope: float                      # far_iv - near_iv


class DealerFlowCharm(BaseModel):
    """Charm limb: projected cumulative delta drift to the next monthly OPEX, holding spot & vol.

    Linear/first-order (net_charm * horizon_days), NOT path-integrated. Window-scoped like
    net_charm (moves with the DTE window). null (whole limb) when net_charm is unavailable OR
    no future monthly OPEX exists in the chain.
    """
    projected_delta: float            # signed $-delta drift to horizon (= net_charm * horizon_days), 2dp
    per_day_base: float               # signed $-delta per +1 calendar day (= net_charm), 2dp
    horizon_days: int                 # calendar days to next monthly OPEX, >= 1
    opex_date: str                    # ISO YYYY-MM-DD the drift is projected to (next monthly OPEX)


class DealerFlowVanna(BaseModel):
    """Vanna limb: projected delta change if implied vol moves (instantaneous, no time horizon).

    Pre-scaled on the wire (the FE renders directly, never multiplies). null when net_vanna
    is unavailable.
    """
    projected_delta: float            # signed $-delta at the base move (= net_vanna * move_iv_points), 2dp
    move_iv_points: float             # base assumed vol move, IV points (fixed 1.0)
    illustrative_move_iv_points: float  # illustrative shock, IV points (fixed 5.0)
    illustrative_projected_delta: float  # PRE-SCALED $-delta at the illustrative move (= net_vanna * 5), 2dp
    reference_direction: str          # direction the quote assumes; value is "increase"


class DealerFlowProjection(BaseModel):
    """Forward-looking, additive, STATIC projected dealer-hedging-flow read.

    A pure transform over the already-computed window-scoped net_charm/net_vanna aggregates +
    the chain's next monthly-OPEX date. Advisory CONTEXT only — NEVER an input to signals /
    opportunity_score / opportunity_tier / the entry gate / state_fingerprint. The two limbs
    are independently nullable; the whole object is null only when BOTH limbs are unavailable
    OR the compute raised.
    """
    spot_basis: float                 # synchronized_spot / gex_spot the flow was computed at (close-anchored)
    charm: Optional[DealerFlowCharm] = None
    vanna: Optional[DealerFlowVanna] = None


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

    # DTE window the gamma structure was computed over (null = full chain). Echoes the
    # min_dte/max_dte the caller requested, for transparency. Does not affect max pain.
    dte_min: Optional[int] = None
    dte_max: Optional[int] = None

    # Net dealer DELTA exposure ($), window-scoped like GEX. Vendor delta (no analytic
    # repricing). Independently nullable: null when vendor delta is missing chain-wide.
    net_dex: Optional[float] = None          # signed sum (calls +, puts -)
    call_dex: Optional[float] = None         # gross call-side dollar DEX (>= 0)
    put_dex: Optional[float] = None          # gross put-side dollar DEX (<= 0)

    # Vol/OI -- FULL CHAIN (independent of the DTE window; same basis as max_pain / PCR).
    total_volume: Optional[float] = None        # full-chain session option volume; null if vendor has none
    chain_vol_oi_ratio: Optional[float] = None  # total_volume / total OI; null if no volume or no OI
    vol_oi_unusual_threshold: float = 1.0       # cutoff above which a strike's vol/OI reads "unusual"

    # IV skew (single anchor tenor) + term structure (cross-tenor). Independently nullable.
    iv_skew: Optional[IvSkew] = None
    term_structure: Optional[TermStructure] = None

    # Projected dealer-hedging flow (STATIC, additive, advisory context only — NOT scored).
    # A pure transform over the window-scoped net_charm/net_vanna + the next monthly-OPEX date;
    # two independently-nullable limbs (charm/vanna). null (whole object) only when BOTH limbs are
    # unavailable OR the compute raised. Mirrors the iv_skew/term_structure nested-optional pattern.
    dealer_flow_projection: Optional[DealerFlowProjection] = None

    # Volatility & Sentiment
    atm_iv: float
    hv_30d: float
    iv_hv_ratio: float
    net_flow: Optional[float] = None  # Order flow aggression; null until computed from the trades tape
    put_call_ratio: float