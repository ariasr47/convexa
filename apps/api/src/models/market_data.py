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


class TrendDirectionRead(BaseModel):
    """Trend direction: close vs EMA20 vs EMA50 (daily closes). Warm-up >= 100 bars, else null."""
    label: str                        # "uptrend" | "downtrend" | "mixed" (ties = mixed)
    close: float                      # last close ($), 2dp
    ema20: float                      # EMA20 of closes ($), 2dp
    ema50: float                      # EMA50 of closes ($), 2dp
    window: str                       # fixed descriptor (self-describing AI export)
    thresholds: str                   # fixed descriptor


class TrendStrengthRead(BaseModel):
    """Trend strength: Wilder ADX(14). Warm-up >= 43 bars w/ valid high/low, else null."""
    label: str                        # "weak" | "moderate" | "strong"
    adx: float                        # Wilder ADX(14), 2dp
    window: str
    thresholds: str


class MomentumStateRead(BaseModel):
    """Momentum state: Wilder RSI(14) on daily closes. Warm-up >= 42 bars, else null."""
    label: str                        # "overbought" | "bullish" | "neutral" | "bearish" | "oversold"
    rsi: float                        # Wilder RSI(14), 2dp
    window: str
    thresholds: str


class TrendMomentumRead(BaseModel):
    """TI regime read off the fetched daily bars (may include the in-progress partial bar).

    Three independently-nullable labels; the child is null when all three are null or the
    read raised. `as_of_session` = the last daily bar's ET session date.
    """
    as_of_session: str                # ISO YYYY-MM-DD
    direction: Optional[TrendDirectionRead] = None
    strength: Optional[TrendStrengthRead] = None
    momentum: Optional[MomentumStateRead] = None


class GexProfileShapeRead(BaseModel):
    """Shape scalars over the ALREADY-computed window-scoped per-strike net_gex (vendor gamma),
    anchored at gex_spot. ALL-OR-NULL (one compute; needs >= 5 eligible strikes & sum|net_gex|>0).
    """
    concentration: float              # normalized HHI in [0,1], 2dp (0 = uniform, 1 = one strike)
    concentration_label: str          # "concentrated" | "mixed" | "dispersed"
    balance: float                    # in [-1,+1], signed, 2dp (+ = weight above spot)
    balance_label: str                # "above_skewed" | "balanced" | "below_skewed"
    center_of_mass_distance: float    # signed FRACTION of spot_basis (+ above / - below), 4dp
    eligible_strikes: int             # strikes with |net_gex| > 0 in the selected window
    spot_basis: float                 # gex_spot the shape was computed at (close-anchored, NOT live)
    thresholds: str                   # fixed descriptor


class DivergenceLocation(BaseModel):
    """Where today's option volume sits vs where standing OI sits (strike-share distributions)."""
    label: str                        # "aligned" | "rotating" | "divergent"
    distribution_shift: float         # in [0,1], 2dp (0 = identical, 1 = entirely elsewhere)
    thresholds: str


class DivergenceComposition(BaseModel):
    """Which right today's activity favors vs the standing book. When present, ALL THREE scalars
    are non-null (null iff the tilt is undeterminable: call volume = 0 or oi_pcr <= 0)."""
    label: str                        # "flow_put_tilted" | "consistent" | "flow_call_tilted"
    volume_pcr: float                 # today's put/call VOLUME ratio, 2dp
    oi_pcr: float                     # standing full-chain put/call OI ratio (== put_call_ratio), 2dp
    tilt_ratio: float                 # volume_pcr / oi_pcr, 2dp
    thresholds: str


class FlowVsPositioningRead(BaseModel):
    """Flow-vs-positioning divergence. Flow basis PINNED: the chain snapshot's same-day cumulative
    option volume — UNSIGNED (no buy/sell side), full-chain, NEVER the SSE net flow. Two
    independently-nullable sub-components; child null when both are null or the read raised."""
    flow_basis: str                   # fixed descriptor
    location: Optional[DivergenceLocation] = None
    composition: Optional[DivergenceComposition] = None


class AtrHorizon(BaseModel):
    """One ATR horizon: simple mean of True Range over the last n bars (NOT Wilder-smoothed).
    Requires the n+1 tail bars all with valid high/low, else null — never a fabricated 0."""
    value: float                      # $ (2dp)
    pct_of_close: float               # PERCENT of close_basis (2dp; 2.31 = 2.31%)
    window_bars: int


class AtrRead(BaseModel):
    """Multi-horizon ATR (5/14/30 trading bars), each horizon independently nullable; child null
    when all horizons are null or the read raised."""
    as_of_session: str                # ISO YYYY-MM-DD (same convention as trend_momentum)
    close_basis: float                # last bar's close ($) the percentages are against, 2dp
    method: str                       # fixed descriptor
    atr_5d: Optional[AtrHorizon] = None
    atr_14d: Optional[AtrHorizon] = None
    atr_30d: Optional[AtrHorizon] = None


class MarketContextPack(BaseModel):
    """The "Market context" pack (ai-context-pack) — four additive, best-effort, STATIC advisory
    reads, computed in the one-way-leaf src/core/context_pack.py from data already fetched and
    attached AFTER generate_signals returns. Advisory CONTEXT only — NEVER an input to signals /
    opportunity_score / opportunity_tier / the entry gate / state_fingerprint. Each child is
    independently nullable; the whole object is null only when ALL FOUR are unavailable OR the
    wrapper raised (the market_context KEY itself is ALWAYS emitted, object|null)."""
    trend_momentum: Optional[TrendMomentumRead] = None
    gex_profile_shape: Optional[GexProfileShapeRead] = None
    flow_vs_positioning: Optional[FlowVsPositioningRead] = None
    atr: Optional[AtrRead] = None


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

    # Market-context pack (STATIC, additive, advisory context only — NOT scored). Four
    # independently-nullable reads (TI regime / GEX shape / flow-vs-positioning / ATR) computed
    # in the one-way-leaf src/core/context_pack.py and attached AFTER generate_signals returns.
    # The KEY is ALWAYS emitted (object|null); null only when all four reads are unavailable OR
    # the wrapper raised ([best-effort-isolated-or-null]).
    market_context: Optional[MarketContextPack] = None

    # Volatility & Sentiment
    atm_iv: float
    hv_30d: float
    iv_hv_ratio: float
    net_flow: Optional[float] = None  # Order flow aggression; null until computed from the trades tape
    put_call_ratio: float