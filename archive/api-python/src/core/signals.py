"""
Signals layer: turns a computed market_state into ranked, explainable trade setups.

This is interpretation, not new measurement -- it reads the gamma/vol/level fields the
engine already produces and applies a transparent, regime-first rule set:

  1. Regime (net_gex sign) decides the playbook: positive gamma -> mean-reversion /
     premium-selling; negative gamma -> momentum / premium-buying.
  2. Levels (walls, peak GEX, VWAP bands) provide entries/targets.
  3. The IV/HV ratio biases structure (sell vs buy premium).
  4. Confluence (multiple factors agreeing) raises conviction and the opportunity score.

All thresholds are module constants so they are easy to tune. Every setup carries a
plain-English rationale so the downstream AI (and you) can see why it fired.
"""
import hashlib
import logging

logger = logging.getLogger("Convexa")

# --- Tunable thresholds ---
NEAR_LEVEL_PCT = 0.0075      # within 0.75% of a level counts as "at" it
FAR_LEVEL_PCT = 0.03         # proximity score decays to 0 by 3% away
IV_RICH = 1.10               # iv_hv_ratio above -> IV rich (favor selling premium)
IV_CHEAP = 0.90              # iv_hv_ratio below -> IV cheap (favor buying premium)
FLIP_PROXIMITY_PCT = 0.01    # within 1% of gamma_flip -> regime-transition risk

DEFAULT_GATE_SCORE = 50      # opportunity_score at/above which a snapshot is AI-worthy
ACTIONABLE_CONVICTIONS = {"medium", "high"}


def _signed_pct(level, price):
    """Signed distance from price to a level, as a fraction of price (+ = level above)."""
    if not level or not price:
        return None
    return (level - price) / price


def _near(level, price, pct=NEAR_LEVEL_PCT):
    d = _signed_pct(level, price)
    return d is not None and abs(d) <= pct


DARK_POOL_NEAR_PCT = 0.005   # off-exchange level within 0.5% of a gamma level = confluence
DARK_POOL_BONUS_EACH = 3     # points per coinciding level
DARK_POOL_BONUS_CAP = 6      # max total dark-pool confluence bonus


def _dark_pool_confluence(state: dict, off_exchange: dict | None) -> tuple[int, list]:
    """
    Small, capped opportunity bonus when an off-exchange volume level coincides with a gamma
    level (wall/flip/peak). Confirmation only -- off-exchange side/intent is unknown, so this
    never drives the score on its own. Returns (bonus, matched-level descriptions).
    """
    if not off_exchange or not off_exchange.get("levels"):
        return 0, []
    gamma_levels = {
        "call_wall": state.get("call_wall"), "put_wall": state.get("put_wall"),
        "gamma_flip": state.get("gamma_flip"), "peak_gex_strike": state.get("peak_gex_strike"),
    }
    matches = []
    for lvl in off_exchange["levels"]:
        p = lvl.get("price")
        if not p:
            continue
        for name, gl in gamma_levels.items():
            if gl and abs(p - gl) / gl <= DARK_POOL_NEAR_PCT:
                matches.append({"off_exchange_price": p, "coincides_with": name, "level": gl})
                break
    bonus = min(DARK_POOL_BONUS_CAP, len(matches) * DARK_POOL_BONUS_EACH)
    return bonus, matches


def generate_signals(state: dict, off_exchange: dict | None = None) -> dict:
    """
    Produce regime, vol regime, level distances, setups, and a 0-100 opportunity score.

    off_exchange (when provided) adds a small capped confluence bonus to the score where an
    off-exchange volume level overlaps a gamma level. Pass None to exclude it entirely (no
    bonus, no confluence field) -- this is how the dark-pool toggle keeps it out of scoring.
    """
    price = state.get("price") or state.get("gex_spot")
    flip = state.get("gamma_flip")
    net_gex = state.get("net_gex")
    call_wall = state.get("call_wall")
    put_wall = state.get("put_wall")
    peak = state.get("peak_gex_strike")
    max_pain = state.get("max_pain")
    ivhv = state.get("iv_hv_ratio")
    vu2 = state.get("vwap_upper_2")
    vl2 = state.get("vwap_lower_2")

    out = {
        "ticker": state.get("ticker"),
        "regime": None,
        "regime_note": None,
        "vol_regime": "neutral",
        "distances": {},
        "setups": [],
        "opportunity_score": 0,
    }

    if not price or flip is None or net_gex is None:
        out["regime_note"] = "insufficient data"
        return out

    # --- Regime (net gamma sign is the direct measure) ---
    positive_gamma = net_gex > 0
    out["regime"] = "positive_gamma" if positive_gamma else "negative_gamma"
    out["regime_note"] = (
        "Dealers long gamma -> hedging dampens moves; range-bound / mean-reverting."
        if positive_gamma else
        "Dealers short gamma -> hedging amplifies moves; trending / breakout-prone."
    )

    # --- Distances to key levels (signed % of price) ---
    dist = {
        "call_wall_pct": _signed_pct(call_wall, price),
        "put_wall_pct": _signed_pct(put_wall, price),
        "gamma_flip_pct": _signed_pct(flip, price),
        "peak_gex_pct": _signed_pct(peak, price),
        "max_pain_pct": _signed_pct(max_pain, price),
    }
    out["distances"] = {k: (round(v, 4) if v is not None else None) for k, v in dist.items()}

    near_flip = dist["gamma_flip_pct"] is not None and abs(dist["gamma_flip_pct"]) <= FLIP_PROXIMITY_PCT

    # --- Vol regime ---
    if ivhv:
        if ivhv >= IV_RICH:
            out["vol_regime"] = "iv_rich"      # options expensive vs realized -> sell premium
        elif ivhv <= IV_CHEAP:
            out["vol_regime"] = "iv_cheap"     # options cheap -> buy premium
    sell_prem = out["vol_regime"] == "iv_rich"
    buy_prem = out["vol_regime"] == "iv_cheap"

    setups = []

    def add(name, bias, strategy, rationale, conviction):
        setups.append({"name": name, "bias": bias, "strategy": strategy,
                       "rationale": rationale, "conviction": conviction})

    # --- Regime-transition alert (highest priority context) ---
    if near_flip:
        add(
            "Gamma-flip transition", "volatility",
            "long straddle / long vol" if buy_prem else "reduce size, expect expansion",
            f"Price within {FLIP_PROXIMITY_PCT:.0%} of zero-gamma ${flip:.2f}; a cross flips the "
            f"regime and tends to expand volatility.",
            "high" if buy_prem else "medium",
        )

    if positive_gamma:
        # Mean-reversion fades toward the magnet
        target = peak or max_pain
        if _near(call_wall, price):
            add(
                "Fade call wall", "short",
                "short / call credit spread" if sell_prem else "short toward magnet",
                f"Price at call wall ${call_wall:.2f} in positive gamma (resistance); dealers sell "
                f"rallies here. Target the magnet ${target:.2f}." + (" IV rich favors selling premium." if sell_prem else ""),
                "high" if sell_prem else "medium",
            )
        if _near(put_wall, price):
            add(
                "Fade put wall", "long",
                "long / put credit spread" if sell_prem else "long toward magnet",
                f"Price at put wall ${put_wall:.2f} in positive gamma (support); dealers buy dips here. "
                f"Target the magnet ${target:.2f}." + (" IV rich favors selling premium." if sell_prem else ""),
                "high" if sell_prem else "medium",
            )
        if vu2 and price >= vu2:
            add(
                "VWAP band reversion", "short", "short toward VWAP",
                f"Price at/above the +2σ VWAP band (${vu2:.2f}) in a mean-reverting regime.",
                "medium",
            )
        if vl2 and price <= vl2:
            add(
                "VWAP band reversion", "long", "long toward VWAP",
                f"Price at/below the -2σ VWAP band (${vl2:.2f}) in a mean-reverting regime.",
                "medium",
            )
        # Range / premium-sell when boxed between walls and IV is rich
        if sell_prem and call_wall and put_wall and not _near(call_wall, price) and not _near(put_wall, price):
            add(
                "Range premium sell", "neutral", "iron condor / short strangle",
                f"Positive gamma pins price between put wall ${put_wall:.2f} and call wall ${call_wall:.2f}; "
                f"IV rich (IV/HV {ivhv:.2f}) favors selling the range.",
                "medium",
            )

    else:  # negative gamma -> momentum
        if dist["put_wall_pct"] is not None and price < put_wall:
            add(
                "Put-wall breakdown", "short",
                "long puts / put debit spread" if buy_prem else "momentum short",
                f"Price below put wall ${put_wall:.2f} in negative gamma; dealer hedging accelerates "
                f"downside." + (" IV cheap favors buying premium." if buy_prem else ""),
                "high" if buy_prem else "medium",
            )
        if dist["call_wall_pct"] is not None and price > call_wall:
            add(
                "Call-wall breakout (squeeze)", "long",
                "long calls / call debit spread" if buy_prem else "momentum long",
                f"Price above call wall ${call_wall:.2f} in negative gamma; hedging can fuel a squeeze."
                + (" IV cheap favors buying premium." if buy_prem else ""),
                "high" if buy_prem else "medium",
            )
        if not setups or all(s["name"] == "Gamma-flip transition" for s in setups):
            add(
                "Trend regime", "directional", "trade with momentum, avoid fading",
                "Negative gamma: moves tend to extend. Favor breakouts; do not fade levels.",
                "low",
            )

    # --- Pin confluence: peak GEX and max pain agree near price ---
    if peak and max_pain and abs(_signed_pct(peak, price) or 1) < 0.02 and abs((peak - max_pain) / peak) < 0.01:
        add(
            "Pin confluence", "neutral", "expect pinning into monthly expiry",
            f"Gamma magnet ${peak:.2f} and max pain ${max_pain:.2f} coincide near price -> stronger pin.",
            "medium",
        )

    out["setups"] = setups
    score = _opportunity_score(dist, ivhv, setups, near_flip)
    dp_bonus, dp_matches = _dark_pool_confluence(state, off_exchange)
    if dp_bonus:
        score = min(100, score + dp_bonus)
        out["dark_pool_confluence"] = dp_matches
    out["opportunity_score"] = score
    return out


def _opportunity_score(dist: dict, ivhv, setups: list, near_flip: bool) -> int:
    """0-100 ranking score: proximity to an actionable level + vol extremity + confluence."""
    # Proximity: closeness to the nearest of call wall / put wall / gamma flip.
    candidates = [abs(d) for d in (dist["call_wall_pct"], dist["put_wall_pct"], dist["gamma_flip_pct"])
                  if d is not None]
    proximity = 0.0
    if candidates:
        nearest = min(candidates)
        proximity = max(0.0, 40.0 * (1.0 - nearest / FAR_LEVEL_PCT))

    vol = min(25.0, abs((ivhv or 1.0) - 1.0) * 50.0)
    setup = min(25.0, len(setups) * 8.0)
    transition = 10.0 if near_flip else 0.0

    return int(round(min(100.0, proximity + vol + setup + transition)))


def _sign(x) -> int:
    """-1 / 0 / +1 sign of a number, treating None as 0 (level above vs below price)."""
    if x is None:
        return 0
    return (x > 0) - (x < 0)


def state_fingerprint(sig: dict) -> str:
    """
    Short stable hash of the *material* picture, so a consumer (and our dedupe) can tell
    "same picture" from "new picture" across polls. Deliberately COARSE -- the
    opportunity_score is bucketed and only the SIGN of each level distance is used -- so a
    60s poll on a quiet tape yields an identical fingerprint, and it only changes when the
    regime, vol regime, the set of setups, the score bucket, or which side of a level
    price sits on actually changes.
    """
    dist = sig.get("distances") or {}
    parts = [
        sig.get("regime"),
        sig.get("vol_regime"),
        ",".join(sorted(s["name"] for s in sig.get("setups", []))),
        (sig.get("opportunity_score") or 0) // 10,
        _sign(dist.get("call_wall_pct")),
        _sign(dist.get("put_wall_pct")),
        _sign(dist.get("gamma_flip_pct")),
    ]
    raw = "|".join(str(p) for p in parts)
    return hashlib.sha1(raw.encode()).hexdigest()[:12]


# --- Opportunity tiering + position-aware eval (ghost-trade tracker) -----------------------
# These are DISPLAY/dedupe overlays. They do NOT alter opportunity_score, the entry gate, or
# the entry `state_fingerprint`. Tier bands are operator config (passed in from main.py); the
# tier vocabulary is fixed: dormant | watch | actionable | prime.
TIER_ORDER = ("dormant", "watch", "actionable", "prime")


def compute_opportunity_tier(score: int, ai_ready: bool, *, watch: int,
                             actionable: int, prime: int) -> str:
    """
    Map opportunity_score (+ the entry gate's `ready`) onto a fixed escalation tier.
    Bands are operator config. **Prime additionally requires `ai_ready`** (actionable) so the
    top tier only fires when the rule layer agrees there is an edge -- not on score alone.
    """
    if score >= prime and ai_ready:
        return "prime"
    if score >= actionable:
        return "actionable"
    if score >= watch:
        return "watch"
    return "dormant"


def _pl_band(pl_pct) -> str:
    """Coarse P/L bucket (percent) so the position fingerprint only flips on a material move."""
    if pl_pct is None:
        return "na"
    for hi, label in ((-50, "<-50"), (-25, "-50:-25"), (-10, "-25:-10"),
                      (10, "-10:10"), (25, "10:25"), (50, "25:50")):
        if pl_pct < hi:
            return label
    return ">=50"


def _dte_band(dte) -> str:
    """Coarse DTE bucket so the fingerprint flips once at each horizon threshold, not daily."""
    if dte is None:
        return "na"
    for hi in (1, 7, 21, 45):
        if dte <= hi:
            return f"<={hi}"
    return ">45"


def position_fingerprint(state: dict, *, strike, right, pl_pct, dte, tier: str) -> str:
    """
    Coarse, stable hash of an OPEN position's material picture -- the sibling of
    `state_fingerprint`, used to fire reassessment alerts once per event (de-dupe). It folds
    only the held contract's side of each level (call/put wall, gamma flip), the P/L band, the
    DTE band, and the current tier, so a 60s poll on a quiet position yields an identical
    fingerprint and it only flips on a material change. Reuses the entry gate's `_sign`
    coarsening; it does NOT touch the entry gate's own fingerprint or semantics.
    """
    def rel(level):
        return _sign(strike - level) if (level and strike) else 0
    parts = [
        right,
        rel(state.get("call_wall")),
        rel(state.get("put_wall")),
        rel(state.get("gamma_flip")),
        _pl_band(pl_pct),
        _dte_band(dte),
        tier,
    ]
    raw = "|".join(str(p) for p in parts)
    return hashlib.sha1(raw.encode()).hexdigest()[:12]


def evaluate_gate(sig: dict, score_threshold: int = DEFAULT_GATE_SCORE) -> dict:
    """
    Cheap rule-layer gate that decides whether a snapshot is worth escalating to the
    downstream strategy AI. Keeps the AI off a firehose: it only fires when something is
    actually actionable. Stateless -- the `changed` dedupe (needs the prior fingerprint)
    is resolved by the caller; staleness is also forced off by the caller.

    ready = True when ANY of:
      - opportunity_score >= score_threshold
      - any setup has medium/high conviction
      - price is near the gamma flip (regime-transition risk)
    """
    reasons = []

    score = sig.get("opportunity_score") or 0
    if score >= score_threshold:
        reasons.append(f"score>={score_threshold}")

    for s in sig.get("setups", []):
        if s.get("conviction") in ACTIONABLE_CONVICTIONS:
            reasons.append(f"setup:{s['name']}({s['conviction']})")

    dist = (sig.get("distances") or {}).get("gamma_flip_pct")
    if dist is not None and abs(dist) <= FLIP_PROXIMITY_PCT:
        reasons.append("near gamma flip")

    return {"ready": bool(reasons), "reasons": reasons,
            "state_fingerprint": state_fingerprint(sig), "score_threshold": score_threshold}
