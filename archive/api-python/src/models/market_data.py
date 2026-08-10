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


class IvRankRead(BaseModel):
    """The IV-Rank/Percentile read (iv-rank) — an additive, best-effort, STATIC advisory read
    attached to market_state.iv_rank AFTER generate_signals returns. NEVER an input to signals /
    opportunity_score / opportunity_tier / the entry gate / state_fingerprint.

    Three mutually-exclusive states via `state` (+ null when the whole read is unavailable, expressed
    by market_state.iv_rank == null, NOT a state value). Every computed-number child is nullable
    (null in 'building'; `rank` also null in the degenerate-flat sub-case with
    rank_unavailable_reason='flat_window'). The `*_descriptor`/`advisory_note` strings are WIRE-ONLY
    (for the AI export self-description; the FE renders its own copy). No raw IV series on the wire."""
    state: str                                       # 'computed' | 'building'
    rank: Optional[float] = None                     # 0-100; null in building/degenerate-flat
    rank_unavailable_reason: Optional[str] = None    # 'flat_window' when computed && rank is null
    percentile: Optional[float] = None               # 0-100; present whenever state == 'computed'
    band: Optional[str] = None                        # 'premium_rich'|'neutral'|'premium_cheap'; null off a null rank
    current_iv: Optional[float] = None               # measured IV this cycle (percentage points)
    window_sessions: int                              # sessions used (== sample_count until 252)
    sample_count: int                                 # total accumulated for this ticker
    window_cap: int                                   # 252
    min_samples: int                                  # N_min floor (20)
    iv_basis: Optional[str] = None                    # 'interpolated_30d' | 'nearest_tenor'
    basis_dte: Optional[float] = None                 # 30 for a clean interp; else the fallback DTE
    window_descriptor: str
    basis_descriptor: str
    advisory_note: str


class CalendarEventRead(BaseModel):
    """One UPCOMING calendar event on the wire. `confirmed` distinguishes a company-announced date
    from a projection, and `note` carries any recorded source DISAGREEMENT — both are signal, not
    decoration. `session` null means genuinely unknown, NOT "assume amc". The loader-internal
    `avg_abs_move_pct` is deliberately absent (the wire carries the pinned shape, not a raw dump)."""
    date: str                          # ISO YYYY-MM-DD
    type: str                          # earnings|ex_div|fomc|cpi|pce|nfp|product|lockup
    confirmed: bool                    # true ONLY when company-announced
    session: Optional[str] = None      # 'bmo' | 'amc' | null
    days_until: int                    # >= 0, relative to the serving day
    source: Optional[str] = None       # provenance URL
    note: Optional[str] = None         # caveats / source disagreement


class ExpirationEventRead(BaseModel):
    """One tenor of the bundle's own full-chain expiration curve, flagged for event containment
    (expiration-events). `expiration`/`dte` are ECHOED from `market_state.term_structure` — the curve
    is read after scoring, never recomputed or decorated at source.

    Containment: `serving_day <= event.date <= expiration`, EXCEPT an `amc` event dated exactly ON
    the expiration (the contract dies at the close, hours before an after-close report). An event
    with `session: null` on the expiration date IS contained — an unknown session is never silently
    assumed to fall after the close.

    The payload is a SUMMARY, not a re-dump: the event objects live once, in `events`.
    `contains_event` and `event_count` are redundant by construction (the boolean is what a consumer
    branches on, the count is what it reports)."""
    expiration: str                    # ISO YYYY-MM-DD, echoed from the tenor curve
    dte: int                           # echoed from the tenor curve
    contains_event: bool               # == event_count > 0
    event_count: int                   # >= 0 — events contained by THIS expiration
    event_types: list[str] = []        # closed tokens, de-duped + sorted; [] when not contained
    first_event_date: Optional[str] = None   # earliest contained event, else null


class EventCalendarRead(BaseModel):
    """The owner-curated event-calendar read (bundle-events) — additive, best-effort, STATIC advisory
    context attached to market_state.event_calendar AFTER generate_signals returns. NEVER an input to
    signals / opportunity_score / opportunity_tier / the entry gate / state_fingerprint.

    `state` is the AUTHORITATIVE closed token and the ONLY disambiguator on the wire: `unknown` (the
    ticker is not curated — we do not know) and `none` (curated; nothing scheduled within
    `calendar_covers`) BOTH carry `events: []`, and collapsing them would let the app claim "no
    earnings scheduled" for a ticker nobody ever checked. A consumer must render `state` through a
    closed lookup and never re-derive it from `len(events)`.

    Self-describing by design: it carries the calendar file's OWN `as_of` / `horizon_end` / `covers` /
    `expired`, because a date is only as trustworthy as the file's freshness — and
    `calendar_expired: true` FORCES `state: 'unknown'`."""
    state: str                                   # 'unknown' | 'none' | 'scheduled'
    events: list[CalendarEventRead] = []         # [] unless state == 'scheduled'; upcoming only
    # Per-expiration containment (expiration-events). ALWAYS present; `[]` for `unknown` AND `none`
    # AND a bundle with no usable tenor curve — so it is NOT self-disambiguating and `state` must be
    # read first. An empty list under `unknown` means "we cannot say", never "no expiry is affected".
    expirations: list[ExpirationEventRead] = []
    calendar_as_of: Optional[str] = None         # when the file was last verified
    calendar_horizon_end: Optional[str] = None   # entries claimed valid only to here
    calendar_covers: list[str] = []              # WHICH event types the curation pass covered
    calendar_expired: bool = True                # horizon passed (or unset) => do not trust


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

    # IV-Rank/Percentile read (iv-rank; STATIC, additive, advisory context only — NOT scored).
    # Where current IV sits within this ticker's own accumulated CM30 history. Computed in the
    # one-way-leaf src/marketdata/ and attached AFTER generate_signals returns. The KEY is ALWAYS
    # emitted (object|null); null on a store outage / no current IV / read fault
    # ([best-effort-isolated-or-null]).
    iv_rank: Optional[IvRankRead] = None

    # Owner-curated EVENT CALENDAR (bundle-events; STATIC, additive, advisory context only — NOT
    # scored). Read from the checked-in src/scanner/config/events.json via the one-way-leaf
    # src/scanner/events.py and attached AFTER generate_signals returns. The KEY is ALWAYS emitted
    # (object|null); null when the calendar could not be loaded at all — a fault is never an error
    # ([best-effort-isolated-or-null]). See EventCalendarRead for why `state` is load-bearing.
    event_calendar: Optional[EventCalendarRead] = None

    # Volatility & Sentiment
    atm_iv: float
    hv_30d: float
    iv_hv_ratio: float
    net_flow: Optional[float] = None  # Order flow aggression; null until computed from the trades tape
    put_call_ratio: float