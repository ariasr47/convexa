"""
Market-context pack ("Market context") — ai-context-pack.

Four additive, best-effort, STATIC advisory reads bundled into ONE independently-nullable
object attached to `market_state.market_context` (INTERFACE_CONTRACT is the wire truth):

  - `trend_momentum`     — TI regime read off the fetched daily bars: direction (close vs
                           EMA20 vs EMA50), strength (Wilder ADX-14), momentum (Wilder RSI-14).
  - `gex_profile_shape`  — shape scalars over the ALREADY-computed window-scoped per-strike
                           `net_gex` (vendor gamma) anchored at `gex_spot`. No gamma recompute.
  - `flow_vs_positioning`— where/which-right TODAY's unsigned option volume sits vs standing OI
                           (chain-snapshot day volume — NEVER the SSE net flow, never tick data).
  - `atr`                — multi-horizon (5/14/30 trading bars) simple-mean true range.

ONE-WAY LEAF (structural byte-identity guarantee): this module imports STDLIB/MATH ONLY —
never `signals`/`engine`/`live`/`darkpool`/`observability`/`ai_recommendation`/`auth`/any
vendor SDK — and `signals`/`engine`/`live`/`darkpool` never import it. `main.py` is the SOLE
caller (the `off_exchange` orchestration-boundary precedent), and it attaches the result
AFTER `generate_signals` returns, so no pack field can exist at score/gate/fingerprint time
(`[additive-keeps-score-byte-identical]`).

BEST-EFFORT AT FIVE LEVELS (`[best-effort-isolated-or-null]`): each leaf (TI label / ATR
horizon / divergence sub-component) fails to ITS OWN null; each of the four reads fails to
its own null; the whole pack is None only when all four reads are None (the caller guards the
wrapper itself). Insufficient history / eligibility floors => null — NEVER a fabricated 0,
never a silently-emitted implausible value, never an HTTP error.

Labels are computed from UNROUNDED scalars; wire scalars are rounded (2dp; the center-of-mass
fraction 4dp) AFTER label determination, so a threshold-edge value can never disagree with
its label. Threshold constants are pinned v1 module constants — no env/tuning knob (a future
feature, never silent drift). The fixed descriptor strings below are wire constants, verbatim
from the INTERFACE_CONTRACT (they make the AI export self-describing — the substitute for any
prompt-template change).
"""
import logging
import math

logger = logging.getLogger("Convexa")

# --------------------------------------------------------------------------- pinned v1 constants
# TI regime windows + warm-up floors (ARCHITECTURE §3a — under-warmed => null, never silent).
EMA_FAST_PERIOD = 20
EMA_SLOW_PERIOD = 50
DIRECTION_MIN_BARS = 100          # 2 x 50
ADX_PERIOD = 14
STRENGTH_MIN_BARS = 43            # 3 x 14 + 1, all with valid high/low
RSI_PERIOD = 14
MOMENTUM_MIN_BARS = 42            # 3 x 14

# ADX bands: weak < 20; moderate 20 <= ADX < 25; strong >= 25.
ADX_WEAK_BELOW = 20.0
ADX_STRONG_AT = 25.0
# RSI bands: >= 70 overbought; [55,70) bullish; [45,55) neutral; (30,45) bearish; <= 30 oversold.
RSI_OVERBOUGHT_AT = 70.0
RSI_BULLISH_AT = 55.0
RSI_NEUTRAL_AT = 45.0
RSI_OVERSOLD_AT = 30.0

# GEX shape: eligibility + label thresholds.
SHAPE_MIN_ELIGIBLE_STRIKES = 5
HHI_CONCENTRATED_AT = 0.35
HHI_MIXED_AT = 0.15
BALANCE_SKEW_AT = 0.20

# Flow-vs-positioning label thresholds.
SHIFT_ALIGNED_BELOW = 0.35
SHIFT_DIVERGENT_AT = 0.60
TILT_PUT_AT = 1.25
TILT_CALL_AT = 0.80

# ATR horizons (trading bars), each independently nullable.
ATR_HORIZONS = (5, 14, 30)

# Fixed descriptor strings — VERBATIM from INTERFACE_CONTRACT.md "Payload addition".
DIRECTION_WINDOW = "close vs EMA20 vs EMA50, daily closes"
DIRECTION_THRESHOLDS = ("uptrend: close > EMA20 > EMA50; downtrend: close < EMA20 < EMA50; "
                        "else mixed (ties = mixed)")
STRENGTH_WINDOW = "ADX(14), Wilder, daily high/low/close"
STRENGTH_THRESHOLDS = "weak: ADX < 20; moderate: 20 <= ADX < 25; strong: ADX >= 25"
MOMENTUM_WINDOW = "RSI(14), Wilder, daily closes"
MOMENTUM_THRESHOLDS = ("overbought: RSI >= 70; bullish: 55-70; neutral: 45-55; bearish: 30-45; "
                       "oversold: RSI <= 30")
SHAPE_THRESHOLDS = ("concentrated: HHI >= 0.35; mixed: 0.15-0.35; dispersed: < 0.15 | "
                    "above_skewed: balance >= +0.20; balanced: -0.20..+0.20; "
                    "below_skewed: <= -0.20")
FLOW_BASIS = ("today's session cumulative option volume, unsigned (no buy/sell side), "
              "full chain, captured at the last chain snapshot")
LOCATION_THRESHOLDS = "aligned: shift < 0.35; rotating: 0.35-0.60; divergent: >= 0.60"
COMPOSITION_THRESHOLDS = ("flow_put_tilted: tilt >= 1.25; consistent: 0.80-1.25; "
                          "flow_call_tilted: tilt <= 0.80")
ATR_METHOD = "simple mean of true range over the last n bars (not Wilder-smoothed)"


# ------------------------------------------------------------------------------------ utilities
def _num(v):
    """A finite float or None (never lets a NaN/inf/non-number leak into a read)."""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if math.isfinite(f) else None


def _leaf(fn, *args):
    """Run one LEAF compute under its own guard -> its own null (level-1 isolation)."""
    try:
        return fn(*args)
    except Exception:
        logger.debug("context_pack: leaf %s failed; emitting null", fn.__name__, exc_info=True)
        return None


def _read(fn, *args):
    """Run one of the four READS under its own guard -> that read's null (level-2 isolation)."""
    try:
        return fn(*args)
    except Exception:
        logger.debug("context_pack: read %s failed; emitting null", fn.__name__, exc_info=True)
        return None


# ---------------------------------------------------------------------------------- TI helpers
def _ema(closes: list, period: int) -> float:
    """EMA seeded as the SMA of the first `period` closes, recursion over the full series."""
    seed = sum(closes[:period]) / period
    k = 2.0 / (period + 1.0)
    ema = seed
    for c in closes[period:]:
        ema = c * k + ema * (1.0 - k)
    return ema


def _wilder_rsi(closes: list, period: int):
    """Wilder RSI over the full close series (first averages simple, then Wilder-smoothed)."""
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    if len(deltas) < period:
        return None
    avg_gain = sum(max(d, 0.0) for d in deltas[:period]) / period
    avg_loss = sum(max(-d, 0.0) for d in deltas[:period]) / period
    for d in deltas[period:]:
        avg_gain = (avg_gain * (period - 1) + max(d, 0.0)) / period
        avg_loss = (avg_loss * (period - 1) + max(-d, 0.0)) / period
    total = avg_gain + avg_loss
    if total <= 0.0:
        return 50.0  # perfectly flat tail: no gains, no losses -> neutral by definition
    return 100.0 * avg_gain / total  # == 100 - 100/(1+RS)


def _wilder_adx(highs: list, lows: list, closes: list, period: int):
    """Wilder ADX: smoothed +DM/-DM/TR -> DI -> DX -> Wilder-smoothed ADX. None if undeterminable."""
    m = len(highs)
    trs, pdms, ndms = [], [], []
    for i in range(1, m):
        up = highs[i] - highs[i - 1]
        dn = lows[i - 1] - lows[i]
        pdms.append(up if (up > dn and up > 0.0) else 0.0)
        ndms.append(dn if (dn > up and dn > 0.0) else 0.0)
        trs.append(max(highs[i] - lows[i],
                       abs(highs[i] - closes[i - 1]),
                       abs(lows[i] - closes[i - 1])))
    # Need `period` smoothed values before the first DX, and `period` DX values to seed ADX.
    if len(trs) < 2 * period:
        return None
    s_tr = sum(trs[:period])
    s_pdm = sum(pdms[:period])
    s_ndm = sum(ndms[:period])
    dxs = []
    for i in range(period, len(trs) + 1):
        if s_tr > 0.0:
            di_plus = 100.0 * s_pdm / s_tr
            di_minus = 100.0 * s_ndm / s_tr
            di_sum = di_plus + di_minus
            dxs.append(100.0 * abs(di_plus - di_minus) / di_sum if di_sum > 0.0 else 0.0)
        else:
            dxs.append(0.0)  # zero true range across the window: no directional movement at all
        if i < len(trs):
            s_tr = s_tr - s_tr / period + trs[i]
            s_pdm = s_pdm - s_pdm / period + pdms[i]
            s_ndm = s_ndm - s_ndm / period + ndms[i]
    if len(dxs) < period:
        return None
    adx = sum(dxs[:period]) / period
    for dx in dxs[period:]:
        adx = (adx * (period - 1) + dx) / period
    return adx


# ------------------------------------------------------------------------- read 1: TI regime
def _direction_read(closes: list):
    if len(closes) < DIRECTION_MIN_BARS:
        return None  # warm-up floor: null, never a silently-emitted under-warmed value
    close = closes[-1]
    ema20 = _ema(closes, EMA_FAST_PERIOD)
    ema50 = _ema(closes, EMA_SLOW_PERIOD)
    # Label from the UNROUNDED scalars; strict chains, ties = mixed.
    if close > ema20 > ema50:
        label = "uptrend"
    elif close < ema20 < ema50:
        label = "downtrend"
    else:
        label = "mixed"
    return {"label": label, "close": round(close, 2), "ema20": round(ema20, 2),
            "ema50": round(ema50, 2), "window": DIRECTION_WINDOW,
            "thresholds": DIRECTION_THRESHOLDS}


def _strength_read(daily_bars: list):
    # ADX needs an unbroken high/low/close tail (a gap corrupts TR/DM chaining): take the
    # longest CONSECUTIVE valid tail and require the 43-bar floor on it.
    highs, lows, closes = [], [], []
    for b in reversed(daily_bars):
        h, l, c = _num(b.get("high")), _num(b.get("low")), _num(b.get("close"))
        if h is None or l is None or c is None:
            break
        highs.append(h)
        lows.append(l)
        closes.append(c)
    highs.reverse()
    lows.reverse()
    closes.reverse()
    if len(highs) < STRENGTH_MIN_BARS:
        return None  # floor (>= 43 bars all with valid high/low) — incl. adapters w/o high/low
    adx = _wilder_adx(highs, lows, closes, ADX_PERIOD)
    if adx is None:
        return None
    if adx < ADX_WEAK_BELOW:
        label = "weak"
    elif adx < ADX_STRONG_AT:
        label = "moderate"
    else:
        label = "strong"
    return {"label": label, "adx": round(adx, 2), "window": STRENGTH_WINDOW,
            "thresholds": STRENGTH_THRESHOLDS}


def _momentum_read(closes: list):
    if len(closes) < MOMENTUM_MIN_BARS:
        return None
    rsi = _wilder_rsi(closes, RSI_PERIOD)
    if rsi is None:
        return None
    if rsi >= RSI_OVERBOUGHT_AT:
        label = "overbought"
    elif rsi >= RSI_BULLISH_AT:
        label = "bullish"
    elif rsi >= RSI_NEUTRAL_AT:
        label = "neutral"
    elif rsi > RSI_OVERSOLD_AT:
        label = "bearish"
    else:
        label = "oversold"
    return {"label": label, "rsi": round(rsi, 2), "window": MOMENTUM_WINDOW,
            "thresholds": MOMENTUM_THRESHOLDS}


def _trend_momentum(daily_bars: list):
    """TI regime read. Child null when all three labels are null (or the shared basis is)."""
    if not daily_bars:
        return None
    # Shared as-of: the LAST daily bar's ET session date (series may include the in-progress
    # session's partial bar — the same acceptance the shipped HV makes). A missing session date
    # means the read cannot self-describe -> honest child null (presence rule: as_of_session
    # is non-null within a non-null child; never fabricated).
    as_of = daily_bars[-1].get("session")
    if not as_of:
        return None
    closes = [c for c in (_num(b.get("close")) for b in daily_bars) if c is not None]
    direction = _leaf(_direction_read, closes)
    strength = _leaf(_strength_read, daily_bars)
    momentum = _leaf(_momentum_read, closes)
    if direction is None and strength is None and momentum is None:
        return None
    return {"as_of_session": str(as_of)[:10], "direction": direction,
            "strength": strength, "momentum": momentum}


# --------------------------------------------------------------------- read 2: GEX profile shape
def _gex_profile_shape(strike_profile: list, market_state: dict):
    """Shape scalars over the already-computed window-scoped |net_gex| profile. ALL-OR-NULL."""
    spot = _num(market_state.get("gex_spot"))
    if spot is None or spot <= 0.0:
        return None
    rows = []
    for r in strike_profile or []:
        k = _num(r.get("strike"))
        g = _num(r.get("net_gex"))
        if k is None or g is None or abs(g) <= 0.0:
            continue  # eligibility: strikes with |net_gex| > 0 in the selected window
        rows.append((k, abs(g)))
    n = len(rows)
    total = sum(w for _, w in rows)
    if n < SHAPE_MIN_ELIGIBLE_STRIKES or total <= 0.0:
        return None
    shares = [(k, w / total) for k, w in rows]
    # Concentration: normalized HHI in [0,1] (0 = uniform, 1 = one strike).
    hhi_raw = sum(s * s for _, s in shares)
    concentration = (hhi_raw - 1.0 / n) / (1.0 - 1.0 / n)
    concentration = min(max(concentration, 0.0), 1.0)  # clamp float noise only
    # Balance: (sum strictly above spot - sum strictly below) / their sum; strike == spot excluded.
    above = sum(w for k, w in rows if k > spot)
    below = sum(w for k, w in rows if k < spot)
    side_total = above + below
    if side_total <= 0.0:
        return None  # all eligible weight exactly at spot: balance undeterminable (all-or-null)
    balance = (above - below) / side_total
    # Center of mass: signed FRACTION of spot_basis (+ above / - below).
    com_strike = sum(k * s for k, s in shares)
    center = (com_strike - spot) / spot
    # Labels from UNROUNDED scalars.
    if concentration >= HHI_CONCENTRATED_AT:
        concentration_label = "concentrated"
    elif concentration >= HHI_MIXED_AT:
        concentration_label = "mixed"
    else:
        concentration_label = "dispersed"
    if balance >= BALANCE_SKEW_AT:
        balance_label = "above_skewed"
    elif balance <= -BALANCE_SKEW_AT:
        balance_label = "below_skewed"
    else:
        balance_label = "balanced"
    return {"concentration": round(concentration, 2), "concentration_label": concentration_label,
            "balance": round(balance, 2), "balance_label": balance_label,
            "center_of_mass_distance": round(center, 4), "eligible_strikes": n,
            "spot_basis": round(spot, 2), "thresholds": SHAPE_THRESHOLDS}


# ------------------------------------------------------------------ read 3: flow vs positioning
def _divergence_location(strike_profile: list):
    """distribution_shift = 0.5 * sum |v_k - o_k| over profile strikes w/ volume>0 or total_oi>0."""
    rows = [r for r in (strike_profile or [])
            if (_num(r.get("volume")) or 0.0) > 0.0 or (_num(r.get("total_oi")) or 0.0) > 0.0]
    if not rows:
        return None
    tot_v = sum((_num(r.get("volume")) or 0.0) for r in rows)
    tot_o = sum((_num(r.get("total_oi")) or 0.0) for r in rows)
    if tot_v <= 0.0 or tot_o <= 0.0:
        return None  # needs chain volume available, sum(volume) > 0, sum(OI) > 0
    shift = 0.5 * sum(abs((_num(r.get("volume")) or 0.0) / tot_v
                          - (_num(r.get("total_oi")) or 0.0) / tot_o) for r in rows)
    shift = min(max(shift, 0.0), 1.0)  # clamp float noise only
    if shift < SHIFT_ALIGNED_BELOW:
        label = "aligned"
    elif shift < SHIFT_DIVERGENT_AT:
        label = "rotating"
    else:
        label = "divergent"
    return {"label": label, "distribution_shift": round(shift, 2),
            "thresholds": LOCATION_THRESHOLDS}


def _divergence_composition(market_data: dict, market_state: dict):
    """volume_pcr (today's by-right day volume from the RAW chain snapshot) vs the standing
    full-chain OI PCR. Null iff the tilt is undeterminable (call volume = 0 or oi_pcr <= 0);
    when present, ALL THREE scalars are non-null. A by-right AGGREGATION — no greek recompute."""
    put_vol = 0.0
    call_vol = 0.0
    for c in (market_data or {}).get("contracts", []):
        v = _num(c.get("volume"))
        if v is None or v <= 0.0:
            continue
        right = (c.get("contract_type") or "").lower()
        if right in ("call", "c"):
            call_vol += v
        elif right in ("put", "p"):
            put_vol += v
    oi_pcr = _num(market_state.get("put_call_ratio"))
    if call_vol <= 0.0 or oi_pcr is None or oi_pcr <= 0.0:
        return None
    volume_pcr = put_vol / call_vol
    tilt = volume_pcr / oi_pcr
    # Label from the UNROUNDED tilt.
    if tilt >= TILT_PUT_AT:
        label = "flow_put_tilted"
    elif tilt <= TILT_CALL_AT:
        label = "flow_call_tilted"
    else:
        label = "consistent"
    return {"label": label, "volume_pcr": round(volume_pcr, 2), "oi_pcr": round(oi_pcr, 2),
            "tilt_ratio": round(tilt, 2), "thresholds": COMPOSITION_THRESHOLDS}


def _flow_vs_positioning(strike_profile: list, market_state: dict, market_data: dict):
    """Child null when BOTH sub-components are null. Flow basis PINNED: the chain snapshot's
    same-day cumulative option volume — unsigned, full-chain, NOT the SSE net flow, NOT ticks."""
    location = _leaf(_divergence_location, strike_profile)
    composition = _leaf(_divergence_composition, market_data, market_state)
    if location is None and composition is None:
        return None
    return {"flow_basis": FLOW_BASIS, "location": location, "composition": composition}


# --------------------------------------------------------------------------------- read 4: ATR
def _atr_horizon(daily_bars: list, n: int, close_basis: float):
    """Simple mean of True Range over the last n TRs. Requires the n+1 tail bars ALL with valid
    high/low (and close, which TR's prev-close term needs) — no silent close-to-close fallback,
    never a fabricated 0."""
    tail = daily_bars[-(n + 1):]
    if len(tail) < n + 1:
        return None
    highs, lows, closes = [], [], []
    for b in tail:
        h, l, c = _num(b.get("high")), _num(b.get("low")), _num(b.get("close"))
        if h is None or l is None or c is None:
            return None
        highs.append(h)
        lows.append(l)
        closes.append(c)
    trs = [max(highs[i] - lows[i],
               abs(highs[i] - closes[i - 1]),
               abs(lows[i] - closes[i - 1])) for i in range(1, n + 1)]
    value = sum(trs) / n
    return {"value": round(value, 2), "pct_of_close": round(value / close_basis * 100.0, 2),
            "window_bars": n}


def _atr(daily_bars: list):
    """Child null when all horizons are null (or the shared basis is undeterminable)."""
    if not daily_bars:
        return None
    as_of = daily_bars[-1].get("session")
    close_basis = _num(daily_bars[-1].get("close"))
    if not as_of or close_basis is None or close_basis <= 0.0:
        return None
    horizons = {f"atr_{n}d": _leaf(_atr_horizon, daily_bars, n, close_basis)
                for n in ATR_HORIZONS}
    if all(v is None for v in horizons.values()):
        return None
    return {"as_of_session": str(as_of)[:10], "close_basis": round(close_basis, 2),
            "method": ATR_METHOD, **horizons}


# ------------------------------------------------------------------------------------- wrapper
def compute_market_context(daily_bars: list, strike_profile: list,
                           market_state: dict, market_data: dict):
    """
    Build the market-context pack from READ-ONLY, already-fetched inputs.

    Returns the pack dict — all four child keys ALWAYS present (each object|None) — or None
    when all four reads are None. Each read runs under its own guard (its own null); the
    caller (main.py) guards this wrapper itself and always emits the `market_context` KEY
    (object|null). Pure read: never mutates any input; no vendor fetch; nothing rides SSE.
    """
    trend = _read(_trend_momentum, daily_bars)
    shape = _read(_gex_profile_shape, strike_profile, market_state)
    flow = _read(_flow_vs_positioning, strike_profile, market_state, market_data)
    atr = _read(_atr, daily_bars)
    if trend is None and shape is None and flow is None and atr is None:
        logger.info("context_pack: all four reads unavailable this cycle; market_context=null")
        return None
    return {"trend_momentum": trend, "gex_profile_shape": shape,
            "flow_vs_positioning": flow, "atr": atr}
