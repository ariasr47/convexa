import asyncio
import sys
import time
import logging
import hmac
import json
import os
import zoneinfo
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Path, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

from src.core.engine import QuantEngine
from src.core.signals import (generate_signals, evaluate_gate,
                              compute_opportunity_tier, position_fingerprint)
from src.core.live import LiveHub
from src.core import chain_store
from src.core.darkpool import analyze_off_exchange
from src.core import observability as obs
from src.core import personas as personas_lib
from src.core import ratelimit
# AI Recommendations: the ISOLATED best-effort in-app LLM proxy + state-export serializer. This is
# a one-way LEAF — engine/signals/live/darkpool do NOT import it (the structural guarantee of score
# byte-identity); main.py imports it ONLY for the three recommendation endpoints, never on the
# bundle/SSE path. The key (ANTHROPIC_API_KEY) is read ONLY inside this module.
from src.core import ai_recommendation as ai_rec
# Auth (user-accounts): the ONE-WAY LEAF (ARCHITECTURE §6). engine/signals/live/darkpool/
# chain_store/the bundle-compute path NEVER import this; main.py is the only orchestration boundary
# that imports it — to mount the auth router, resolve the session cookie, and enforce the two gated
# surfaces. No auth datum (user/session/setting) can become a scoring input (the module boundary is
# the structural guarantee of score byte-identity). The session-signing key / Google secret are read
# only inside src/auth/, never serialized into any payload, never reach the browser.
from src import auth
from src.auth.router import router as auth_router
from src.providers import get_provider
from src.models.market_data import MarketState

logger = logging.getLogger("Convexa")
logger.setLevel(logging.INFO)
logger.propagate = False

# Configure the handler exactly once. This module can be imported more than once
# under uvicorn's reloader, and re-adding a handler each time is what causes every
# log line to be printed twice.
if not logger.handlers:
    formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)

quant_engine = QuantEngine(risk_free_rate=0.045)
# Data source is chosen via the DATA_PROVIDER env var (default "massive"); main.py only
# depends on the MarketDataProvider port, never a concrete vendor SDK.
data_provider = get_provider()

DATA_DIR = "data"

# --- Polling / freshness / gate config (env-overridable) ---
# Cache TTL should match the consumer's poll interval (default 60s): repeated polls within
# the window are served from memory with no upstream call.
CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", "60"))
# Snapshot age (now - options snapshot time) beyond which the data is flagged stale and the
# AI gate is forced off. Real-time tier: ~120s so the stale warning stops firing spuriously
# mid-session (ticker-load-experience INTERFACE §4, AC-Stale-1/2). Operator-overridable via env.
STALE_AFTER_SECONDS = int(os.getenv("STALE_AFTER_SECONDS", "120"))
# opportunity_score at/above which a snapshot is worth escalating to the strategy AI.
GATE_SCORE = int(os.getenv("GATE_SCORE", "50"))

# --- Live (real-time) config ---
FLOW_WINDOW_SECONDS = int(os.getenv("FLOW_WINDOW_SECONDS", "300"))   # rolling net-flow window
LIVE_THROTTLE_SECONDS = float(os.getenv("LIVE_THROTTLE_SECONDS", "1.5"))  # SSE broadcast cadence
CHAIN_REFRESH_SECONDS = int(os.getenv("CHAIN_REFRESH_SECONDS", "120"))    # live chain re-fetch

# --- Chain pre-warm (ticker-load-experience ARCH §4 / INTERFACE §4) ---
# A cold REST bundle request short-circuits its chain fetch to the live session's shared chain
# snapshot ONLY when that snapshot's capture age is within this budget. BINDING freshness gate:
# the budget MUST be ≤ CHAIN_REFRESH_SECONDS (the live refresh cadence) AND ≤ STALE_AFTER_SECONDS
# (the bundle staleness contract) — never serve a chain the freshness contract would flag stale.
# Default = min(both); env override is additionally clamped to that ceiling.
_PREWARM_DEFAULT = min(CHAIN_REFRESH_SECONDS, STALE_AFTER_SECONDS)
CHAIN_PREWARM_MAX_AGE_SECONDS = min(
    int(os.getenv("CHAIN_PREWARM_MAX_AGE_SECONDS", str(_PREWARM_DEFAULT))),
    CHAIN_REFRESH_SECONDS, STALE_AFTER_SECONDS)

# --- Dark-pool / off-exchange config ---
# Default inclusion; per-request `dark_pool` query param overrides. When excluded, the
# off_exchange block is omitted from the bundle (so the downstream AI never sees it) AND the
# opportunity-score confluence bonus is not applied.
INCLUDE_DARK_POOL = os.getenv("INCLUDE_DARK_POOL", "true").lower() == "true"
DARKPOOL_LOOKBACK_SECONDS = int(os.getenv("DARKPOOL_LOOKBACK_SECONDS", "3600"))  # bounded window
# Institutional-size threshold (shares) for a single off-exchange print to count as a "block".
# Fixed in v1 (no ADV-relative sizing); display-only, never feeds the opportunity score.
BLOCK_MIN_SHARES = int(os.getenv("BLOCK_MIN_SHARES", "5000"))

# --- Vol/OI config ---
# Single explainable cutoff above which a strike's volume/OI ratio reads as "unusual".
# Echoed to the FE as `vol_oi_unusual_threshold` so the caption ("Vol/OI >= Nx") and the
# unusual-strike selection stay server-defined. Operator-tunable; no ADV/percentile model in v1.
VOL_OI_UNUSUAL_THRESHOLD = float(os.getenv("VOL_OI_UNUSUAL_THRESHOLD", "1.0"))

# --- Opportunity-tier bands (ghost-trade escalation ladder) ---
# Operator-config score thresholds mapping opportunity_score -> a fixed tier vocabulary
# (dormant|watch|actionable|prime). ACTIONABLE defaults to the AI gate score; PRIME also
# requires ai_eval.ready. Display/dedupe overlay only -- does not change the score or the gate.
TIER_WATCH_SCORE = int(os.getenv("TIER_WATCH_SCORE", "25"))
TIER_ACTIONABLE_SCORE = int(os.getenv("TIER_ACTIONABLE_SCORE", str(GATE_SCORE)))
TIER_PRIME_SCORE = int(os.getenv("TIER_PRIME_SCORE", "75"))

# --- Backend observability config ---
# Instrumentation default ON (off => no trace_id/timings, no metrics recorded, bundle identical).
# `?debug=1` per request adds the verbose `meta.timings` block. The aggregate is a rolling window
# of the last METRICS_WINDOW_SIZE requests (process-local, resets on restart).
OBSERVABILITY_ENABLED = os.getenv("OBSERVABILITY_ENABLED", "true").lower() == "true"
METRICS_WINDOW_SIZE = int(os.getenv("METRICS_WINDOW_SIZE", "500"))
METRICS_RECENT_TRACES = int(os.getenv("METRICS_RECENT_TRACES", "25"))
obs.configure(OBSERVABILITY_ENABLED, METRICS_WINDOW_SIZE, METRICS_RECENT_TRACES)

# --- Public-endpoint per-IP rate limit (system-6 HIGH-2) ---
# Best-effort, in-memory, per-IP, per-minute throttle on the anonymous, vendor-cost-bearing
# read endpoints (/api/ticker/* + /api/stream/*) so an arbitrary-ticker enumeration loop can't
# drain Massive vendor spend. Configured by PUBLIC_RATE_LIMIT_PER_MIN (0/unset/disable => OFF,
# so LOCAL dev is unchanged). Process-local (per-replica, like the per-admin AI metering). It is
# OUTSIDE the scoring path and fail-OPEN — a limiter fault never 5xx's the endpoint or touches
# the bundle/score ([additive-keeps-score-byte-identical]).
public_rate_limiter = ratelimit.PublicRateLimiter()
if public_rate_limiter.enabled:
    logger.info(f"Public rate limit: {public_rate_limiter.limit} req/min per IP "
                f"(/api/ticker/*, /api/stream/*)")

# --- Operator metrics token gate (system-6 HIGH-1) ---
# When METRICS_SECRET_TOKEN is SET, GET /api/_metrics requires it (Authorization: Bearer <token>
# OR the X-Metrics-Token header). When UNSET, today's behavior is preserved (LOCAL dev unchanged);
# PROD MUST set it (Railway Variable) — the Railway *.up.railway.app origin is internet-reachable
# and the readout leaks operator diagnostics. Read at request time so the operator can rotate it
# without a code change.


def _metrics_token_ok(request: Request) -> bool:
    """
    True when the request may read /api/_metrics. If METRICS_SECRET_TOKEN is unset/empty, the gate
    is OPEN (preserves the pre-fix local behavior). Otherwise require a matching token via either
    `Authorization: Bearer <token>` or the `X-Metrics-Token` header. Constant-time compare.
    """
    expected = os.getenv("METRICS_SECRET_TOKEN", "").strip()
    if not expected:
        return True  # unset => local-dev behavior unchanged (prod MUST set it)
    presented = ""
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        presented = auth_header[7:].strip()
    if not presented:
        presented = request.headers.get("x-metrics-token", "").strip()
    if not presented:
        return False
    return hmac.compare_digest(presented, expected)


def _rate_limit_or_response(request: Request) -> JSONResponse | None:
    """
    Best-effort per-IP throttle for the public, vendor-cost-bearing endpoints. Returns a 429
    JSONResponse (with a Retry-After header) when the caller is over the limit, else None
    (proceed). The 429 path makes NO vendor call — it is checked BEFORE _serve / subscribe. Any
    limiter fault fails OPEN (returns None), so the endpoint can never 5xx from the limiter.
    """
    try:
        if not public_rate_limiter.enabled:
            return None
        ip = ratelimit.client_ip_from_request(request)
        allowed, retry_after = public_rate_limiter.check(ip)
        if allowed:
            return None
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded. Try again shortly."},
            headers={"Retry-After": str(retry_after)},
        )
    except Exception:
        logger.warning("ratelimit: gate faulted; failing open", exc_info=False)
        return None

# In-memory state. Mutated only from the event loop (after awaiting the worker thread), so
# no locking is needed. _cache is keyed by (ticker, min_dte, max_dte); _last_fingerprint
# tracks the last DISTINCT fingerprint per ticker for the `changed` dedupe flag.
_cache: dict = {}
_last_fingerprint: dict = {}
# Filter-INDEPENDENT full chain snapshot per ticker, captured on every compute, so the
# tracked-contract lookup can resolve a held contract even when it's outside the display
# window -- WITHOUT a new vendor fetch. Keyed by ticker (the snapshot ignores the DTE filter).
_snapshot_cache: dict = {}
# Last DISTINCT position-aware fingerprint per ticker, for the position_eval `changed` dedupe
# (sibling of _last_fingerprint; the entry gate's dedupe is untouched).
_last_position_fingerprint: dict = {}
# In-flight compute de-duplication (ARCH §3 request-coalescing), keyed by the SAME full cache key
# (ticker, min_dte, max_dte, expirations, dark_pool). Concurrent misses on one key await a single
# shared compute future instead of each running the full vendor load. Event-loop-resident, lock-free
# (single writer per key); the entry is removed as soon as its compute settles.
_inflight: dict = {}

# Real-time hub: one live stream/session per active ticker, ref-counted by SSE subscribers.
live_hub = LiveHub(data_provider, quant_engine, flow_window=FLOW_WINDOW_SECONDS,
                   throttle=LIVE_THROTTLE_SECONDS, chain_refresh=CHAIN_REFRESH_SECONDS)


_EXCHANGE_TZ = zoneinfo.ZoneInfo("America/New_York")


def _dte_days(date_str: str) -> int | None:
    """
    Whole CALENDAR days to an expiration date (YYYY-MM-DD), measured in exchange time.
    This is the conventional DTE: an option expiring today is 0 (0DTE), tomorrow is 1, etc.
    -- options settle end-of-day on the expiration date, so a fractional "to midnight"
    figure would understate the real time remaining. None on parse failure.
    """
    try:
        expiry = datetime.strptime(date_str[:10], "%Y-%m-%d").date()
        return (expiry - datetime.now(_EXCHANGE_TZ).date()).days
    except Exception:
        return None


def _build_market_state(ticker: str, market_data: dict, underlying_history: list,
                        intraday_bars: list, min_dte: int | None = None,
                        max_dte: int | None = None,
                        expirations: tuple | None = None) -> tuple[dict, list]:
    """Compute the full market_state dict and per-strike profile for one ticker.

    min_dte / max_dte bound the expiration window the gamma structure (walls, GEX,
    gamma flip) is computed over; expirations restricts it to an explicit set of dates.
    None leaves the full chain. Max pain and the put/call ratio stay on the full chain
    regardless (see QuantEngine.process_gex_profile).
    """
    gex_metrics = quant_engine.process_gex_profile(
        market_data, max_days_to_expiry=max_dte, min_days_to_expiry=min_dte,
        expirations=set(expirations) if expirations else None)

    # IV skew + term structure: cross-/single-tenor metrics on the FULL chain (independent of the
    # DTE window). Each is its own best-effort helper returning None on failure -- isolated from
    # GEX and from each other. The skew anchor reuses the provider's ATM-IV tenor (nearest >= 7 DTE).
    all_contracts = market_data.get("contracts", [])
    sync_spot = market_data["synchronized_spot"]
    iv_skew = quant_engine.compute_iv_skew(
        all_contracts, sync_spot, market_data.get("atm_iv_expiration"), market_data.get("atm_iv_dte"))
    term_structure = quant_engine.compute_term_structure(all_contracts, sync_spot)

    historical_closes = [b["close"] for b in underlying_history if b.get("close") is not None]
    hv_30d = quant_engine.calculate_historical_volatility_30d(historical_closes)

    vwap_bands = quant_engine.calculate_vwap_bands(intraday_bars)
    if not vwap_bands:
        logger.warning(f"[{ticker}] VWAP bands unavailable (no/sparse intraday bars); VWAP fields null")

    # Massive returns IV as a decimal (0.486); express as a percentage to match hv_30d.
    atm_iv = market_data["atm_iv"] * 100.0
    iv_hv_ratio = round(atm_iv / hv_30d, 4) if hv_30d > 0.0 else 0.0

    snapshot_ns = int(market_data["timestamp"])
    timestamp_iso = (datetime.fromtimestamp(snapshot_ns / 1e9, tz=timezone.utc).isoformat()
                     if snapshot_ns > 0 else None)

    # price = current (live/delayed) spot for display; gex_spot = the spot the levels were
    # actually computed at (last completed session close after hours). They coincide in RTH.
    display_spot = market_data.get("current_spot") or market_data["synchronized_spot"]

    state = {
        "ticker": market_data["ticker"],
        "price": display_spot,
        "gex_spot": market_data["synchronized_spot"],
        "timestamp": snapshot_ns,
        "timestamp_iso": timestamp_iso,

        "call_wall": gex_metrics["call_wall"],
        "put_wall": gex_metrics["put_wall"],
        "peak_gex_strike": gex_metrics["peak_gex_strike"],
        "gamma_flip": gex_metrics["gamma_flip"],
        "max_pain": gex_metrics["max_pain"],
        "max_pain_expiration": gex_metrics["max_pain_expiration"],
        "net_gex": gex_metrics["net_gex"],
        "call_gex": gex_metrics["call_gex"],
        "put_gex": gex_metrics["put_gex"],
        "total_gex": gex_metrics["total_gex"],
        "net_vanna": gex_metrics["net_vanna"],
        "net_charm": gex_metrics["net_charm"],
        "net_volga": gex_metrics["net_volga"],
        "put_call_ratio": gex_metrics["put_call_ratio"],

        # DEX — net dealer dollar delta exposure (window-scoped, like GEX). Independently
        # nullable: null when vendor delta is missing chain-wide; GEX is untouched.
        "net_dex": gex_metrics["net_dex"],
        "call_dex": gex_metrics["call_dex"],
        "put_dex": gex_metrics["put_dex"],

        # Vol/OI — full-chain session volume vs OI (independent of the DTE window).
        "total_volume": gex_metrics["total_volume"],
        "chain_vol_oi_ratio": gex_metrics["chain_vol_oi_ratio"],
        "vol_oi_unusual_threshold": VOL_OI_UNUSUAL_THRESHOLD,

        # IV skew (single anchor tenor) + term structure (cross-tenor). Independently nullable.
        "iv_skew": iv_skew,
        "term_structure": term_structure,

        "vwap": vwap_bands.get("vwap"),
        "vwap_upper_2": vwap_bands.get("vwap_upper_2"),
        "vwap_upper_3": vwap_bands.get("vwap_upper_3"),
        "vwap_lower_2": vwap_bands.get("vwap_lower_2"),
        "vwap_lower_3": vwap_bands.get("vwap_lower_3"),

        "dte_min": min_dte,
        "dte_max": max_dte,

        "atm_iv": round(atm_iv, 4),
        "hv_30d": hv_30d,
        "iv_hv_ratio": iv_hv_ratio,
        "net_flow": None,  # null until computed from the trades tape
    }
    return state, gex_metrics["strike_profile"]


def _write_ticker_files(ticker: str, state: dict, profile: list, sig: dict):
    """Persist per-ticker JSON for inspection / piping to the downstream AI."""
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(os.path.join(DATA_DIR, f"{ticker}_market_state.json"), "w") as f:
        json.dump(state, f, indent=4)
    with open(os.path.join(DATA_DIR, f"{ticker}_signals.json"), "w") as f:
        json.dump(sig, f, indent=4)
    with open(os.path.join(DATA_DIR, f"{ticker}_strike_profile.json"), "w") as f:
        json.dump({"ticker": ticker, "spot": state["price"], "strikes": profile}, f, indent=4)


async def _acquire_vendor_inputs(ticker: str, dark_pool: bool) -> tuple:
    """
    Acquire the three INDEPENDENT vendor inputs (chain / daily bars / intraday bars) for one
    ticker, on the event loop, and return (market_data, underlying_history, intraday_bars).

    Two ticker-load-experience moves live here (ARCH §4 + §5.1), acquisition-only — neither
    touches the `compute_ticker` transform; same inputs in → byte-identical bundle out:

    - CHAIN PRE-WARM (§4): if a live session for this ticker holds a FRESH shared chain snapshot
      (capture age ≤ CHAIN_PREWARM_MAX_AGE_SECONDS), the chain INPUT is short-circuited to it
      (a near-zero-cost shared-hit) instead of paying the ~3.5s cold chain re-fetch. Best-effort:
      any miss/stale/store error falls back to a normal vendor fetch with no error surfaced
      (`[best-effort-isolated-or-null]`). The shared market_data is READ-ONLY (never mutated).

    - 3-FETCH CONCURRENCY (§5.1): the three fetches overlap (gather of `to_thread` calls) rather
      than running sequentially. Per-stage best-effort isolation SURVIVES concurrency: each fetch
      keeps its own None/empty fallback and one fetch's failure NEVER cancels or corrupts the
      others (`return_exceptions=True` + per-call containment, never a fail-fast gather). When the
      chain is a pre-warm hit, only daily + intraday are fetched concurrently.

    Observability honesty (§6): the `vendor_fetch` span wraps the concurrent acquisition; each
    fetch keeps its own `vendor_call` timing. A pre-warmed chain records a `shared_hit` vendor_call
    whose near-zero duration reflects reality (not a fabricated vendor latency), and a `chain_source`
    marker is stamped on the trace for the operator readout — purely additive, operator-only.
    """
    prewarmed = chain_store.get_fresh(ticker, CHAIN_PREWARM_MAX_AGE_SECONDS)
    chain_source = "shared_hit" if prewarmed is not None else "vendor_fetch"

    async def _chain():
        # PRE-WARM hit: a fresh shared snapshot exists → use it as the chain INPUT (read-only),
        # short-circuiting the chain fetch. Recorded as a near-zero-cost shared-hit so the operator
        # trace stays honest about where the time went.
        if prewarmed is not None:
            with obs.vendor_call("fetch_options_market_state[shared_hit]"):
                return prewarmed
        with obs.vendor_call("fetch_options_market_state"):
            return await asyncio.to_thread(data_provider.fetch_options_market_state, ticker)

    async def _daily():
        with obs.vendor_call("fetch_daily_bars"):
            return await asyncio.to_thread(data_provider.fetch_daily_bars, ticker)

    async def _intraday():
        with obs.vendor_call("fetch_intraday_bars"):
            return await asyncio.to_thread(data_provider.fetch_intraday_bars, ticker)

    with obs.span("vendor_fetch"):
        # return_exceptions=True so one fetch's failure never cancels its siblings (per-stage
        # best-effort isolation survives concurrency — ARCH §5.1). Each result is then normalized
        # to its existing empty/None fallback, identical to the prior sequential semantics.
        market_data, underlying_history, intraday_bars = await asyncio.gather(
            _chain(), _daily(), _intraday(), return_exceptions=True)

    if isinstance(market_data, Exception):
        # Chain fetch failed → no usable chain, the existing no-chain 404 path (callers 404).
        logger.warning(f"[{ticker}] Option-chain fetch failed: {market_data}")
        market_data = None
    if isinstance(underlying_history, Exception):
        logger.warning(f"[{ticker}] Daily-bars fetch failed; HV degrades to null: {underlying_history}")
        underlying_history = []
    if isinstance(intraday_bars, Exception):
        logger.warning(f"[{ticker}] Intraday-bars fetch failed; VWAP degrades to null: {intraday_bars}")
        intraday_bars = []

    return market_data, underlying_history, intraday_bars, chain_source


def compute_ticker(ticker: str, market_data: dict | None,
                   underlying_history: list, intraday_bars: list,
                   min_dte: int | None = None,
                   max_dte: int | None = None,
                   expirations: tuple | None = None,
                   dark_pool: bool = False) -> dict | None:
    """
    Compute everything for ONE ticker from PRE-FETCHED vendor inputs and return the full bundle.
    Returns None when the symbol has no usable option chain (so callers can 404).

    The vendor acquisition (chain/daily/intraday) now happens in `_acquire_vendor_inputs` on the
    event loop (concurrent + pre-warm-aware); this function is the SOLE transform and is unchanged
    in what it produces — same `market_data` in → byte-identical bundle out (AC-Invariant-1).

    `expirations` (a tuple of YYYY-MM-DD dates) restricts the gamma structure to those
    expirations; None uses the full chain (subject to min/max DTE).

    `dark_pool`: when True, compute off-exchange volume context, include it in the bundle,
    and apply its (capped) confluence bonus to the opportunity score. When False, it is
    omitted entirely -- not in the bundle and not in scoring.

    Synchronous (CPU + the dark-pool recent-trades I/O + disk persist); run in a worker thread.
    """
    logger.info(f"[{ticker}] On-demand refresh (min_dte={min_dte}, max_dte={max_dte}, "
                f"expirations={len(expirations) if expirations else 'all'}, dark_pool={dark_pool})")

    if not market_data or market_data.get("synchronized_spot", 0) <= 0:
        logger.warning(f"[{ticker}] No option-chain data returned")
        return None

    contracts = market_data.get("contracts", [])
    all_exps = sorted({c.get("expiration_date", "")[:10] for c in contracts if c.get("expiration_date")})
    logger.info(
        f"[{ticker}] Option chain: {len(contracts)} contracts across {len(all_exps)} expirations "
        f"(nearest {all_exps[0] if all_exps else 'n/a'}, farthest {all_exps[-1] if all_exps else 'n/a'})"
    )
    # Available expirations (today + future) for the UI selector: date + calendar DTE.
    available_expirations = []
    for e in all_exps:
        dte = _dte_days(e)
        if dte is not None and dte >= 0:
            available_expirations.append({"date": e, "dte": dte})

    # engine_build (CPU): GEX/greeks/walls/flip/DEX/Vol-OI/skew/term + HV + VWAP.
    with obs.span("engine_build", count=len(contracts)):
        state, profile = _build_market_state(
            ticker, market_data, underlying_history, intraday_bars, min_dte, max_dte, expirations)

    # Off-exchange ("dark pool") context — only when enabled. Derived from the trade tape
    # (trf-reported prints); used as a capped confluence bonus and passed to the AI. Omitted
    # entirely when off so it influences neither the score nor the downstream AI.
    #
    # BEST-EFFORT + ISOLATED: any failure here (trade-fetch error, parse error, empty tape)
    # is caught and yields off_exchange = None, leaving market_state + strike_profile and the
    # rest of the bundle fully intact. This must never turn into an HTTP error.
    #
    # Instrumentation: the off_exchange STAGE wraps the existing try/except (preserving the
    # None-on-failure semantics); the recent-trades fetch is also timed in the vendor section.
    # When dark_pool is off the stage is recorded as `skipped` (never a fabricated 0).
    off_exchange = None
    if dark_pool:
        with obs.span("off_exchange"):
            try:
                with obs.vendor_call("fetch_recent_trades"):
                    trades = data_provider.fetch_recent_trades(ticker, DARKPOOL_LOOKBACK_SECONDS)
                off_exchange = analyze_off_exchange(
                    trades, state["price"], block_min_shares=BLOCK_MIN_SHARES)
            except Exception:
                logger.exception(f"[{ticker}] Off-exchange computation failed; omitting off_exchange "
                                 f"(bundle unaffected)")
                off_exchange = None
    else:
        obs.mark_skipped("off_exchange")

    # signals (CPU): setups/score + the AI entry gate.
    with obs.span("signals"):
        sig = generate_signals(state, off_exchange)
        ai_eval = evaluate_gate(sig, GATE_SCORE)  # `changed` + staleness filled in at serve time

    top = sig["setups"][0]["name"] if sig["setups"] else "none"
    logger.info(
        f"[{ticker}] Refresh complete | spot ${state['price']:.2f} | "
        f"net GEX ${state['net_gex'] / 1e6:,.1f}M | flip ${state['gamma_flip']:.2f} | "
        f"call/put wall ${state['call_wall']:.0f}/${state['put_wall']:.0f} | "
        f"regime {sig['regime']} | score {sig['opportunity_score']} | top: {top}"
    )

    # persist (I/O): write the per-ticker JSON files to disk.
    with obs.span("persist"):
        _write_ticker_files(ticker, state, profile, sig)
    bundle = {
        "market_state": state,
        "signals": sig,
        "strike_profile": {"ticker": ticker, "spot": state["price"], "strikes": profile},
        "expirations": available_expirations,  # for the UI expiration selector (all future dates)
        "ai_eval": ai_eval,
    }
    if off_exchange is not None:
        bundle["off_exchange"] = off_exchange  # present only when dark_pool is enabled
    # Stash the full chain snapshot (filter-independent) for the tracked-contract lookup; the
    # serve path moves it into _snapshot_cache (keyed by ticker) and strips it from the cached
    # bundle so it isn't duplicated per filter key or surfaced in any response.
    bundle["_snapshot"] = market_data
    return bundle


app = FastAPI(
    title="Convexa Volatility API",
    description="Serves net dealer gamma profiles, greeks, and trade signals for a single "
                "ticker on demand, over a selectable expiration (DTE) window.",
    version="3.0.0",
)

# CORS allowlist (env-gated, defense-in-depth) — [R2]. Under the deployed shape the browser is
# SAME-ORIGIN (the Cloudflare Pages Function proxies /api/* on the *.pages.dev origin), so this
# middleware is not on the browser's hot path; but a locked, env-driven allowlist is the security
# floor and the clean fallback for a CORS world. Read ALLOWED_ORIGINS (comma-separated) and default
# to the existing localhost dev origins when unset so LOCAL dev is byte-for-byte unchanged. NEVER
# "*" with credentials (incompatible with allow_credentials=True and a real leak). Config-only — no
# scoring/engine/state_fingerprint touch.
_DEFAULT_DEV_ORIGINS = ["http://localhost:3000", "http://localhost:5173"]
_cors_env = os.environ.get("ALLOWED_ORIGINS", "").strip()
_allowed_origins = (
    [o.strip() for o in _cors_env.split(",") if o.strip()] if _cors_env else _DEFAULT_DEV_ORIGINS
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# HIGH-3 (system-6 S4e): conspicuous startup WARNING when ACCOUNT_STORE=postgres but a stable key
# is missing. In persistent mode the ephemeral per-process fallback is a silent data-integrity trap:
# missing AUTH_SESSION_SIGNING_KEY => all sessions invalid on every restart/deploy (users logged
# out); missing AI_KEY_ENCRYPTION_KEY => stored encrypted AI keys permanently undecryptable on
# redeploy. This logs LOUDLY (does NOT crash, does NOT change the ephemeral fallback) so the
# misconfiguration is visible in the Railway log stream. It fires here at import/boot, before any DB
# use. Runs ONLY for ACCOUNT_STORE=postgres (memory/local dev is unaffected).
def _warn_missing_stable_keys() -> None:
    if os.getenv("ACCOUNT_STORE", "memory").strip().lower() != "postgres":
        return
    if not os.getenv("AUTH_SESSION_SIGNING_KEY", "").strip():
        logger.warning(
            "STABLE-KEY MISSING: ACCOUNT_STORE=postgres but AUTH_SESSION_SIGNING_KEY is unset. "
            "Sessions will be UNVERIFIABLE after every restart/deploy (all users logged out). "
            "Set a stable AUTH_SESSION_SIGNING_KEY in Railway Variables (reuse the same value on "
            "every deploy).")
    if not os.getenv("AI_KEY_ENCRYPTION_KEY", "").strip():
        logger.warning(
            "STABLE-KEY MISSING: ACCOUNT_STORE=postgres but AI_KEY_ENCRYPTION_KEY is unset. "
            "Stored encrypted AI keys will be PERMANENTLY UNDECRYPTABLE after a redeploy (users must "
            "re-enter their key). Set a stable AI_KEY_ENCRYPTION_KEY (Fernet) in Railway Variables "
            "(reuse the same value on every deploy).")


_warn_missing_stable_keys()

# Mount the auth surface (user-accounts) — /api/auth/*. The auth subpackage is a leaf the engine/
# scoring path never imports (ARCHITECTURE §6); this is the single orchestration boundary that wires
# it. Eagerly build the service so the in-memory store (single shared connection) is created once at
# boot; a config error surfaces here rather than mid-request. Absent Google creds ⇒ google_available
# false, NO crash (AC-G2).
app.include_router(auth_router)
try:
    auth.get_service()
except Exception:
    logger.warning("auth: service init deferred (will retry on first request)", exc_info=False)


def _seed_test_account() -> None:
    """
    DEV-ONLY: seed a stable, always-available test account for manual testing. GATED — runs ONLY when
    SEED_TEST_ACCOUNT is truthy AND ACCOUNT_STORE != postgres, so a fixed-credential account is NEVER
    auto-created in the persistent/deployed backend. Idempotent + best-effort (never crashes boot).
    Credentials are dev defaults, overridable via env; NO AI key is seeded (set it via the Settings
    UI after signing in). The in-memory store resets on restart, so this re-seeds each boot → the
    account is "always available" in local dev.
    """
    def _truthy(v: str) -> bool:
        return v.strip().lower() in ("1", "true", "yes", "on")

    if not _truthy(os.getenv("SEED_TEST_ACCOUNT", "")):
        return
    if os.getenv("ACCOUNT_STORE", "memory").strip().lower() == "postgres":
        logger.warning("SEED_TEST_ACCOUNT ignored: refusing to seed a fixed-credential test account "
                       "into ACCOUNT_STORE=postgres (dev-only feature).")
        return
    email = os.getenv("TEST_ACCOUNT_EMAIL", "demo@convexa.io").strip()
    password = os.getenv("TEST_ACCOUNT_PASSWORD", "convexa-test-2026")
    display_name = (os.getenv("TEST_ACCOUNT_DISPLAY_NAME", "Demo (test account)").strip() or None)
    try:
        created = auth.get_service().ensure_account(
            email=email, password=password, display_name=display_name)
    except Exception:
        logger.warning("seed: test-account seed faulted (skipping)", exc_info=False)
        return
    try:
        # Advertise the seeded account in who-am-I so the login form can pre-fill it (dev-only).
        auth.get_service().set_demo_seed_hint(email)
    except Exception:
        pass
    logger.info("seed: test account '%s' %s (dev-only; set the AI key via Settings after sign-in).",
                email, "created" if created else "already present")


_seed_test_account()


def _resolve_auth(request: Request):
    """
    Resolve the (optional) session cookie → ResolvedSession for a GATED action. BEST-EFFORT in the
    AC-J1 sense: an auth-subsystem fault must surface 503 `auth_unavailable` on a gated action (the
    honest "couldn't reach sign-in"), NEVER a misleading 200/bad-credentials, and NEVER touch the
    trader bundle/SSE path. Returns (resolved | None-on-fault). The (None-on-fault) signal lets the
    caller emit 503 vs the 403 of a cleanly-anonymous request.
    """
    try:
        svc = auth.get_service()
        return svc.resolve_session(request.cookies.get(auth.COOKIE_NAME)), True
    except Exception:
        logger.warning("auth: gated-action session resolution faulted", exc_info=False)
        return None, False


def _gate_or_response(request: Request):
    """
    Enforce the auth gate on a state/cost-bearing action (ARCHITECTURE §8a). Returns:
      - None when a VALID session is present (proceed), or
      - a JSONResponse carrying the auth error class (403 auth_required when cleanly anonymous,
        503 auth_unavailable when the subsystem faulted — AC-E1/E4/E7, AC-J1 gated side).
    The auth gate is the OUTERMOST precondition; the caller runs its own logic only past it.
    """
    resolved, ok = _resolve_auth(request)
    if not ok:
        err = auth.errors.auth_unavailable()
        return JSONResponse(status_code=err.status, content=err.envelope())
    if resolved is None or not resolved.authenticated:
        err = auth.errors.auth_required()
        return JSONResponse(status_code=err.status, content=err.envelope())
    return None


# byo-ai-key §5: the MINIMAL admin allowlist (NOT RBAC). Comma-separated emails, matched
# case-insensitively against the resolved session email. Read NOWHERE except the shared-allowance
# decision. Re-read per call so dropping an admin loses the allowance on the next request (AC-19).
def _admin_emails() -> set[str]:
    raw = os.getenv("AI_REC_ADMIN_EMAILS", "")
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def _is_admin(email: str | None) -> bool:
    return bool(email) and email.strip().lower() in _admin_emails()


def _resolve_ai_key(resolved) -> "ai_rec.ResolvedKey":
    """
    byo-ai-key §1: build the per-request resolved-key VALUE OBJECT at the main.py orchestration
    boundary from the authenticated session. Decryption happens HERE (in the auth leaf) and the
    admin allowlist is read HERE; the rec leaf then applies the owner-fixed resolution ORDER
    (own → shared-admin-if-configured-and-allowance → none/distinguished-reason). Own-key-first
    even for admins. A decrypt failure ⇒ own_key is None ⇒ falls through to the role no-key path
    (unavailable, not 5xx, no leak — AC-16). The raw key is held transiently in the VO; never logged.
    """
    user = resolved.user
    own_key = None
    try:
        own_key = auth.get_service().get_decrypted_ai_key(user.id)
    except Exception:
        logger.warning("ai-rec: own-key decryption faulted; treating as no key", exc_info=False)
        own_key = None
    return ai_rec.resolve_key(
        user_id=user.id, own_key=own_key, is_admin=_is_admin(user.email))


def _parse_expirations(csv: str | None) -> tuple | None:
    """Normalize a comma-separated expirations param to a sorted tuple (cache-stable), or None."""
    if not csv:
        return None
    items = sorted({e.strip()[:10] for e in csv.split(",") if e.strip()})
    return tuple(items) or None


async def _compute_entry(t: str, key: tuple, min_dte: int | None, max_dte: int | None,
                         expirations: tuple | None, dark_pool: bool, now: float, trace) -> dict:
    """
    Run ONE full compute for a cache miss and install the resulting `_cache` entry, returning it.
    Owned by the request that won the in-flight slot for `key` (ARCH §3 coalescing); concurrent
    misses on the same key await its future rather than re-running this.

    Acquisition (chain pre-warm + 3-fetch concurrency) happens here on the event loop; the
    `compute_ticker` transform then runs in a worker thread. Same inputs → byte-identical bundle.
    """
    market_data, underlying_history, intraday_bars, chain_source = \
        await _acquire_vendor_inputs(t, dark_pool)
    # Observability honesty (ARCH §4.4 / §6): mark how the chain was acquired (shared-hit vs
    # vendor fetch) on the trace dims — additive, operator-only, never a trader-facing field.
    if trace is not None:
        try:
            trace.dims["chain_source"] = chain_source
        except Exception:
            pass

    bundle = await asyncio.to_thread(
        compute_ticker, t, market_data, underlying_history, intraday_bars,
        min_dte, max_dte, expirations, dark_pool)
    if bundle is None:
        raise HTTPException(status_code=404, detail=f"No option-chain data available for {t}.")
    # Move the filter-independent snapshot into its ticker-keyed cache, then drop it from
    # the cached bundle (so it isn't duplicated per filter key or ever serialized).
    _snapshot_cache[t] = {"market_data": bundle.pop("_snapshot"), "computed_at": now}
    # Resolve the dedupe flag against the last DISTINCT picture for this ticker.
    fingerprint = bundle["ai_eval"]["state_fingerprint"]
    changed = fingerprint != _last_fingerprint.get(t)
    _last_fingerprint[t] = fingerprint
    entry = {"bundle": bundle, "computed_at": now, "changed": changed,
             "trace_id": trace.trace_id if trace else None}
    _cache[key] = entry
    # Opportunistically drop other expired keys so the cache can't grow unbounded.
    for k in [k for k, e in _cache.items() if now - e["computed_at"] >= CACHE_TTL_SECONDS]:
        _cache.pop(k, None)
    return entry


async def _serve(ticker: str, min_dte: int | None, max_dte: int | None,
                 expirations: tuple | None = None, dark_pool: bool = False,
                 position_ctx: dict | None = None, verbose: bool = False) -> dict:
    """
    Cache-aware serve path: returns the full wrapped bundle (market_state + signals +
    strike_profile + expirations + ai_eval + meta [+ off_exchange]) for one ticker. Computes
    on cache-miss (in a worker thread, since the SDK blocks), serves from memory within
    CACHE_TTL_SECONDS. 404 when the symbol has no option chain.

    position_ctx (optional, request-time overlay; NOT part of the cache key) carries an open
    ghost position so the envelope can add `position_eval` -- a sibling of `ai_eval`.

    Observability: a request-local RequestTrace is created here, carried via a ContextVar into the
    worker thread (so the six stage spans inside compute_ticker fill it), and folded into the
    process-local aggregate after the response is assembled. All best-effort -- a None trace (when
    instrumentation is disabled) makes every span a no-op and the bundle byte-identical.
    """
    t = ticker.upper()
    key = (t, min_dte, max_dte, expirations, dark_pool)
    now = time.time()

    trace = obs.new_trace(t, {"min_dte": min_dte, "max_dte": max_dte,
                              "expirations_present": expirations is not None, "dark_pool": dark_pool})
    token = obs.set_current(trace)
    try:
        entry = _cache.get(key)
        hit = entry is not None and (now - entry["computed_at"]) < CACHE_TTL_SECONDS

        if not hit:
            # REQUEST-COALESCING (ARCH §3): concurrent misses on the SAME full filter key await ONE
            # shared compute future instead of each running the full vendor load. The first miss
            # owns the future; later misses arriving before it resolves await the same result.
            # Same inputs → same output, fewer redundant computes (AC-Coalesce-1, AC-Invariant-1).
            inflight = _inflight.get(key)
            if inflight is not None:
                entry = await inflight   # coalesced: ride the in-flight compute's result
                if trace is not None:
                    # Coalesced miss: this request ran no compute of its own; its lineage points at
                    # the trace that actually produced the shared bundle (honest attribution).
                    trace.computed_trace_id = entry.get("trace_id")
            else:
                fut = asyncio.get_event_loop().create_future()
                _inflight[key] = fut
                try:
                    entry = await _compute_entry(t, key, min_dte, max_dte, expirations,
                                                 dark_pool, now, trace)
                    fut.set_result(entry)
                except BaseException as e:
                    fut.set_exception(e)
                    raise
                finally:
                    _inflight.pop(key, None)
        elif trace is not None:
            # Cache HIT: no compute ran; lineage points back to the trace that produced the bundle.
            trace.computed_trace_id = entry.get("trace_id")

        wrapped = _wrap(entry, hit, now, t, position_ctx, trace=trace, verbose=verbose)
        # Fold the finished trace into the aggregate on the event loop (single-writer, lock-free),
        # then emit the additive structured request-summary log line.
        obs.fold(trace)
        obs.emit_request_log(trace)
        return wrapped
    finally:
        obs.reset_current(token)


def _wrap(entry: dict, hit: bool, now: float, ticker: str,
          position_ctx: dict | None = None, trace=None, verbose: bool = False) -> dict:
    """Assemble the response envelope at serve time so freshness/age are always current."""
    _sw_start = time.perf_counter()   # serialize_wrap stage timer (the envelope build)
    bundle = entry["bundle"]
    state = bundle["market_state"]

    snapshot_ns = state.get("timestamp") or 0
    data_age = int(now - snapshot_ns / 1e9) if snapshot_ns > 0 else None
    stale = data_age is not None and data_age > STALE_AFTER_SECONDS

    ai_eval = dict(bundle["ai_eval"])
    ai_eval["changed"] = entry["changed"]
    if stale:
        # Never ask the AI to trade on stale data.
        ai_eval["ready"] = False
        ai_eval["reasons"] = list(ai_eval["reasons"]) + ["stale data"]

    # --- Opportunity tiering (best-effort overlay; never breaks the bundle). Computed at
    # serve time so it reflects the finalized ai_eval.ready (Prime forced off when stale).
    # Copy `signals` so the cached object -- and the entry-gate fingerprint computed from it
    # -- stay untouched.
    signals = dict(bundle["signals"])
    try:
        tier = compute_opportunity_tier(
            signals.get("opportunity_score") or 0, bool(ai_eval.get("ready")),
            watch=TIER_WATCH_SCORE, actionable=TIER_ACTIONABLE_SCORE, prime=TIER_PRIME_SCORE)
        signals["opportunity_tier"] = tier
        signals["prime_prompt_eligible"] = tier == "prime"
    except Exception:
        logger.exception(f"[{ticker}] Opportunity tiering failed; emitting dormant")
        tier = "dormant"
        signals["opportunity_tier"] = None
        signals["prime_prompt_eligible"] = False

    wrapped = {
        "market_state": state,
        "signals": signals,
        "strike_profile": bundle["strike_profile"],
        "expirations": bundle.get("expirations", []),
        "ai_eval": ai_eval,
        # position_eval: sibling of ai_eval, present only with an open-position context; else
        # null. Best-effort -- any failure yields null, never an error.
        "position_eval": _position_eval(ticker, state, tier, position_ctx),
        "meta": {
            "served_at": datetime.fromtimestamp(now, tz=timezone.utc).isoformat(),
            "cache": {"hit": hit, "age_seconds": int(now - entry["computed_at"]),
                      "ttl_seconds": CACHE_TTL_SECONDS},
            "freshness": {"snapshot_iso": state.get("timestamp_iso"),
                          "data_age_seconds": data_age, "stale": stale,
                          "stale_after_seconds": STALE_AFTER_SECONDS},
        },
    }
    if "off_exchange" in bundle:   # present only when dark_pool was enabled at compute time
        wrapped["off_exchange"] = bundle["off_exchange"]

    # Observability (best-effort): close the serialize_wrap stage and stamp the envelope. On a
    # cache HIT this is the ONLY stage recorded for the trace (near-zero compute), distinguishing
    # hit from miss cost. `meta.trace_id` is always present when instrumentation is enabled;
    # `meta.timings` only with the verbose switch. A failure here never affects the served bundle.
    if trace is not None:
        try:
            sw_ms = (time.perf_counter() - _sw_start) * 1000.0
            trace.add_stage("serialize_wrap", "serialize", sw_ms, "ok")
            trace.cache_hit = hit
            trace.cache_age_seconds = int(now - entry["computed_at"])
            trace.finish()
            wrapped["meta"]["trace_id"] = trace.trace_id
            if verbose:
                wrapped["meta"]["timings"] = trace.timings_block()
        except Exception:
            logger.debug("observability: envelope stamping failed", exc_info=True)
    return wrapped


def _position_eval(ticker: str, state: dict, tier: str,
                   position_ctx: dict | None) -> dict | None:
    """
    position_eval = {changed, fingerprint} for an OPEN ghost position. Reuses the de-dupe
    primitive over a position-aware fingerprint (held contract vs walls/flip, P/L band, DTE
    band, tier) so reassessment alerts fire ONCE per material event. Sibling of ai_eval -- it
    does not alter the entry gate. Absent context => None. Best-effort: any failure => None.
    """
    if not position_ctx:
        return None
    try:
        fp = position_fingerprint(
            state, strike=position_ctx.get("strike"), right=position_ctx.get("right"),
            pl_pct=position_ctx.get("pl_pct"), dte=position_ctx.get("dte"), tier=tier)
        # Raw de-dupe, mirroring ai_eval.changed: flips once when the position fingerprint
        # changes vs the last distinct compute, then stays false while it persists. Stale/
        # overnight ALERT suppression is the FE's job (UX blueprint §E) -- the backend does not
        # special-case it here, keeping `changed` meaning exactly "the picture moved."
        changed = fp != _last_position_fingerprint.get(ticker)
        _last_position_fingerprint[ticker] = fp
        return {"changed": changed, "fingerprint": fp}
    except Exception:
        logger.exception(f"[{ticker}] position_eval failed; emitting null")
        return None


async def _ensure_snapshot(ticker: str) -> dict:
    """
    Return the filter-independent full chain snapshot for `ticker`, refreshing it via the
    normal serve path when stale (no extra vendor fetch when warm). Raises 404 when the symbol
    has no option chain (propagates the serve-path 404).
    """
    t = ticker.upper()
    snap = _snapshot_cache.get(t)
    if snap is None or (time.time() - snap["computed_at"]) >= CACHE_TTL_SECONDS:
        await _serve(t, None, None, None, INCLUDE_DARK_POOL)  # populates _snapshot_cache on miss
        snap = _snapshot_cache.get(t)
    if snap is None:
        raise HTTPException(status_code=404, detail=f"No option-chain snapshot available for {t}.")
    return snap


# Shared filter query params. min_dte/max_dte bound the gamma-structure window (None = full
# chain); expirations restricts it to an explicit comma-separated set of YYYY-MM-DD dates
# (None = all). For longer-dated/swing levels try min_dte=7&max_dte=45.
_MinDTE = Query(None, ge=0, description="Drop contracts with fewer than this many days to expiry.")
_MaxDTE = Query(None, ge=0, description="Drop contracts with more than this many days to expiry.")
_Expirations = Query(None, description="Comma-separated YYYY-MM-DD expirations to include (default: all).")
_DarkPool = Query(INCLUDE_DARK_POOL, description="Include off-exchange (dark-pool) context in the "
                  "bundle and opportunity score. False omits it from both.")


@app.get("/api/ticker/{ticker}")
async def get_ticker_bundle(
    request: Request,
    ticker: str = Path(..., description="Underlying symbol, e.g. TSLA"),
    min_dte: int | None = _MinDTE,
    max_dte: int | None = _MaxDTE,
    expirations: str | None = _Expirations,
    dark_pool: bool = _DarkPool,
    pos_expiration: str | None = Query(None, description="Open ghost position: contract expiration (YYYY-MM-DD)."),
    pos_strike: float | None = Query(None, description="Open ghost position: strike."),
    pos_right: str | None = Query(None, description="Open ghost position: 'call' or 'put'."),
    pos_pl_pct: float | None = Query(None, description="Open ghost position: current P/L %, for the position_eval band."),
    debug: bool = Query(False, description="Operator verbose switch: add per-stage meta.timings (default off)."),
):
    """Full bundle (market_state + signals + strike_profile + expirations + ai_eval +
    position_eval [+ off_exchange]). Pass the `pos_*` params (held contract + P/L%) to receive
    `position_eval`; omit them for `position_eval: null`. `?debug=1` adds operator `meta.timings`."""
    # HIGH-2: per-IP throttle BEFORE any vendor fetch. 429 (no vendor call) when over the limit;
    # fail-open otherwise. Outside the scoring path — the success path below is unchanged.
    limited = _rate_limit_or_response(request)
    if limited is not None:
        return limited
    position_ctx = None
    if pos_expiration and pos_strike is not None and pos_right:
        position_ctx = {"expiration": pos_expiration[:10], "strike": pos_strike,
                        "right": pos_right.lower(), "pl_pct": pos_pl_pct,
                        "dte": _dte_days(pos_expiration)}
    return await _serve(ticker, min_dte, max_dte, _parse_expirations(expirations), dark_pool,
                        position_ctx=position_ctx, verbose=debug)


@app.get("/api/market-data", response_model=MarketState)
async def get_market_data(
    ticker: str = Query(..., description="Underlying symbol, e.g. TSLA"),
    min_dte: int | None = _MinDTE,
    max_dte: int | None = _MaxDTE,
    expirations: str | None = _Expirations,
    dark_pool: bool = _DarkPool,
):
    return (await _serve(ticker, min_dte, max_dte, _parse_expirations(expirations), dark_pool))["market_state"]


@app.get("/api/strike-profile")
async def get_strike_profile(
    ticker: str = Query(..., description="Underlying symbol, e.g. TSLA"),
    min_dte: int | None = _MinDTE,
    max_dte: int | None = _MaxDTE,
    expirations: str | None = _Expirations,
    dark_pool: bool = _DarkPool,
):
    return (await _serve(ticker, min_dte, max_dte, _parse_expirations(expirations), dark_pool))["strike_profile"]


@app.get("/api/signals")
async def get_signals(
    ticker: str = Query(..., description="Underlying symbol, e.g. TSLA"),
    min_dte: int | None = _MinDTE,
    max_dte: int | None = _MaxDTE,
    expirations: str | None = _Expirations,
    dark_pool: bool = _DarkPool,
):
    return (await _serve(ticker, min_dte, max_dte, _parse_expirations(expirations), dark_pool))["signals"]


@app.get("/api/contract/{ticker}")
async def get_tracked_contract(
    ticker: str = Path(..., description="Underlying symbol, e.g. TSLA"),
    expiration: str = Query(..., description="Contract expiration, YYYY-MM-DD."),
    strike: float = Query(..., description="Contract strike (bare number)."),
    right: str = Query(..., description="Contract right: 'call' or 'put'."),
):
    """
    Tracked-contract stats for one option, resolved from the **full chain snapshot**
    (filter-INDEPENDENT — a held contract resolves even when outside the current DTE window)
    with **no new vendor fetch**. Returns `option_quote{bid,ask,mid}|null`, per-greek
    `greeks`, `iv`, and `dte`.

    Presence semantics (binding):
    - Contract **not in the snapshot** -> HTTP 404 (the FE shows "tracking unavailable").
    - Contract **present but no NBBO quote** -> 200 with `option_quote: null` (NOT an error;
      the FE falls back to a theoretical mark).
    """
    t = ticker.upper()
    right_l = right.lower()
    if right_l in ("c", "call"):
        right_l = "call"
    elif right_l in ("p", "put"):
        right_l = "put"
    else:
        raise HTTPException(status_code=422, detail="right must be 'call' or 'put'.")

    snap = await _ensure_snapshot(t)   # raises 404 if the symbol has no chain
    exp10 = expiration[:10]
    match = next(
        (c for c in snap["market_data"].get("contracts", [])
         if (c.get("expiration_date") or "")[:10] == exp10
         and abs(float(c.get("strike_price") or 0) - strike) < 1e-6
         and (c.get("contract_type") or "").lower() == right_l),
        None,
    )
    if match is None:
        raise HTTPException(
            status_code=404,
            detail=f"Contract not in current snapshot: {t} {exp10} {strike} {right_l}.")

    # option_quote: present only with a usable NBBO mid (needs both sides); else null.
    q = match.get("quote") or {}
    bid, ask = q.get("bid"), q.get("ask")
    option_quote = None
    if bid is not None and ask is not None:
        option_quote = {"bid": bid, "ask": ask, "mid": round((bid + ask) / 2.0, 4)}

    g = match.get("greeks") or {}
    iv = match.get("implied_volatility")
    return {
        "ticker": t, "expiration": exp10, "strike": strike, "right": right_l,
        "option_quote": option_quote,
        "greeks": {"delta": g.get("delta"), "gamma": g.get("gamma"),
                   "theta": g.get("theta"), "vega": g.get("vega")},
        "iv": iv if iv else None,      # 0.0 (unpriced) -> null
        "dte": _dte_days(exp10),
    }


@app.get("/api/personas")
async def get_personas():
    """
    Read-only trader-persona data (side-effect-free): the canonical DECOMPOSED hand-off template
    (FIXED text + named PERSONA slot ids) for both prompts, the slot-fill maps, the byte-identical
    Default rendering, and the 7 built-in PersonaDefinitions. The FE assembles per-persona prompts
    client-side from this; the server ships NO per-persona text, NO `meta.handoff`, NO `?persona=`.

    Persona is a prompt projection only — it never touches `market_state`/`signals`/`ai_eval` (those
    are byte-identical across personas) and triggers no recompute. No vendor fetch, no LLM call.
    """
    return personas_lib.readout()


# ----------------------------------------------------------------------------- AI Recommendations
# Three NEW best-effort, isolated, gated endpoints (INTERFACE §1.1/§1.2/§1.3). They are pure
# CONSUMERS of the already-computed cached bundle: they never write to or influence signals /
# opportunity_score / opportunity_tier / ai_eval / state_fingerprint / the gate, and never touch the
# SSE path. Every LLM/cap/key fault is a contained HTTP 200 (status field), NEVER a 5xx.

from pydantic import BaseModel


class RecRequest(BaseModel):
    """INTERFACE §1.1 request body. Carries NO bundle payload and NO key — only identifiers + the
    gating context the FE already has on the page."""
    persona_id: str | None = None
    snapshot_fingerprint: str
    dte_min: int | None = None
    dte_max: int | None = None
    dark_pool: bool = True
    override: bool = False
    # ai-rec-backtest-orders (INTERFACE §1.1): OPTIONAL scripted-scenario selector; absent == null
    # ⇒ the shipped real path byte-for-byte (AC-45). Non-null ⇒ the keyless, meter-bypassing
    # scenario branch gated by AI_REC_SCENARIOS_ENABLED (default OFF ⇒ contained refusal).
    scenario_id: str | None = None


def _latest_cache_entry_for(ticker: str, dte_min: int | None, dte_max: int | None,
                            dark_pool: bool):
    """
    Return the (key, entry) of an EXISTING cached bundle for `ticker` — preferring the exact filter
    key the page is on (dte_min/dte_max/dark_pool), else the freshest cached entry for the ticker
    across any filter key. None when the ticker has never been computed. Pure READ of the cache; no
    recompute, no vendor fetch. (Mirrors the dashboard's own cached state — the rec/export path must
    be OFF the bundle critical path and must not trigger a new vendor fetch.)
    """
    t = ticker.upper()
    exact = (t, dte_min, dte_max, None, dark_pool)
    if exact in _cache:
        return exact, _cache[exact]
    candidates = [(k, e) for k, e in _cache.items() if k[0] == t]
    if not candidates:
        return None
    # Freshest computed entry for this ticker.
    return max(candidates, key=lambda ke: ke[1]["computed_at"])


async def _served_bundle_for_rec(ticker: str, dte_min: int | None, dte_max: int | None,
                                 dark_pool: bool) -> dict:
    """
    Obtain the ALREADY-CACHED, serve-wrapped bundle for the recommendation/export/status path — the
    same cached MarketState/signals/strike_profile/meta the dashboard holds (60s cache).

    BINDING (BACKEND §1.1/§1.2): NO new vendor fetch on the rec path. We READ the freshest EXISTING
    cached bundle for the ticker and re-wrap it (serve-time envelope: meta/freshness/finalized
    ai_eval) WITHOUT recomputing — even past the TTL (a rec is a static artifact pinned to whatever
    snapshot is on the page; honest-at-birth `stale_born` captures staleness). Only when the ticker
    has NEVER been computed do we compute once via the normal serve path (cold start; 404 if no
    chain). This keeps the multi-second-LLM/slow-vendor concerns off the bundle critical path.
    """
    t = ticker.upper()
    found = _latest_cache_entry_for(t, dte_min, dte_max, dark_pool)
    if found is None:
        # Cold start: never been computed. One compute via the normal path (raises 404 if no chain).
        return await _serve(t, dte_min, dte_max, None, dark_pool)
    _key, entry = found
    # Read-only re-wrap of the EXISTING cached bundle. No recompute, no vendor fetch. A None trace
    # makes the wrap's observability spans no-ops; freshness/stale are recomputed from the snapshot
    # timestamp so `stale_born` is honest even on an aged cache entry.
    return _wrap(entry, hit=True, now=time.time(), ticker=t, position_ctx=None, trace=None)


@app.post("/api/recommendation/{ticker}")
async def post_recommendation(
    body: RecRequest,
    request: Request,
    ticker: str = Path(..., description="Underlying symbol, e.g. SPY"),
):
    """
    Request an in-app AI recommendation (INTERFACE §1.1). ALWAYS HTTP 200 for produced / no_trade /
    unavailable / gated_off — the `status` field distinguishes them; an LLM/cap/key fault is a
    contained `unavailable`, never a 5xx that breaks the bundle/SSE/page. Serializes ALREADY-CACHED
    state (no recompute, no new vendor fetch, null stays null). The key is server-side only.

    AUTH GATE (user-accounts, ARCHITECTURE §8a / D6f): the session gate is the OUTERMOST precondition.
    With no valid session this returns 403 `auth_required` and does NOT invoke the LLM and does NOT
    run or surface ai-rec's existing ai_eval/cooldown/cap/no_key gating (those compose AFTER auth —
    AC-E4). A failing auth subsystem surfaces 503 `auth_unavailable` (AC-J1 gated side). With a valid
    session it proceeds into the EXISTING ai-rec gating UNCHANGED (AC-E5). The non-LLM export floor
    (`GET /api/recommendation/export/{ticker}`) stays anonymous-usable (AC-E6).

    ai-rec-backtest-orders: the OPTIONAL `scenario_id` selector routes (auth-gated, readiness-gated)
    requests to the deterministic, keyless scripted-scenario branch — flag-gated by
    `AI_REC_SCENARIOS_ENABLED` (default OFF ⇒ contained `scenario_unavailable` refusal), never a
    paid LLM call, never a 5xx, meter untouched. Absent/null ⇒ this endpoint is byte-for-byte the
    shipped behavior.
    """
    gate = _gate_or_response(request)
    if gate is not None:
        return gate
    # Past the outermost auth gate ⇒ a valid session. Resolve it again (cheap, in-memory) to build
    # the per-request resolved-key VO (byo-ai-key §1): own → shared-admin-if-configured → none.
    resolved, _ok = _resolve_auth(request)
    if body.scenario_id is not None:
        # ai-rec-backtest-orders (BACKEND §2.1): a scenario-selecting request is KEYLESS — key
        # resolution is SKIPPED entirely (no stored-key read/decrypt, no admin-allowance read),
        # under flag ON *and* OFF (the flag-off refusal also does no key resolution — AC-35/37).
        # The VO carries only the metering identity so the leaf's gate/cap response snapshots
        # report the real, untouched per-identity values.
        resolved_key = ai_rec.ResolvedKey(
            key_source="none", metering_identity=resolved.user.id)
    else:
        resolved_key = _resolve_ai_key(resolved)
    t = ticker.upper()
    bundle = await _served_bundle_for_rec(t, body.dte_min, body.dte_max, body.dark_pool)
    # The LLM call is blocking + multi-second; run it OFF the event loop so it can never stall the
    # cached bundle or the SSE stream. The proxy owns its own bounded timeout. (A scenario branch
    # is instant + keyless, but riding the same worker keeps ONE code path.)
    return await asyncio.to_thread(
        ai_rec.generate_recommendation, t, bundle,
        persona_id=body.persona_id, dte_min=body.dte_min, dte_max=body.dte_max,
        override=body.override, snapshot_fingerprint=body.snapshot_fingerprint,
        resolved=resolved_key, scenario_id=body.scenario_id)


@app.post("/api/positions/sim-trade/gate")
async def positions_sim_trade_gate(request: Request):
    """
    Server-side auth gate for the Positions sim-trade WRITE actions (ARCHITECTURE §8a / D6e/D6a).

    Positions data is CLIENT-LOCAL this phase (no server positions store — ARCHITECTURE §3.3); the
    server enforcement of record is the auth check on the state/cost-bearing write request (open/
    edit/close a sim position, place a resting limit, save a named view, accept an AI rec into the
    tracker). The Positions ROUTE is NOT gated (viewable anonymously, AC-E3) — only these writes.

    Outcome: 200 `{authorized:true}` with a valid session (the FE then runs its existing mandatory-
    confirm SIMULATED flow), 403 `auth_required` when cleanly anonymous (AC-E1/E7), 503
    `auth_unavailable` on a subsystem fault (AC-J1). No broker/order/execution path is added —
    `[no-real-order-path]` untouched; Positions stays SIMULATED.
    """
    gate = _gate_or_response(request)
    if gate is not None:
        return gate
    return {"authorized": True}


@app.get("/api/recommendation/export/{ticker}")
async def get_recommendation_export(
    ticker: str = Path(..., description="Underlying symbol, e.g. SPY"),
    persona_id: str | None = Query(None, description="Persona framing for the prompt (default: Default)."),
    min_dte: int | None = _MinDTE,
    max_dte: int | None = _MaxDTE,
    dark_pool: bool = _DarkPool,
):
    """
    The structured state export (INTERFACE §1.2) — the floor that feeds BOTH the in-app call and the
    manual hand-off. Triggers NO LLM call, costs nothing, available even when in-app AI is
    unavailable. Read+serialize of the cached bundle; null stays null. 200 when a bundle exists, 404
    if the ticker was never fetched. Egress is ONLY {context, persona_prompt, glossary} + identifiers.
    """
    t = ticker.upper()
    bundle = await _served_bundle_for_rec(t, min_dte, max_dte, dark_pool)  # 404 if no chain
    return ai_rec.build_export(t, bundle, persona_id)


@app.get("/api/recommendation/status/{ticker}")
async def get_recommendation_status(
    request: Request,
    ticker: str = Path(..., description="Underlying symbol, e.g. SPY"),
    min_dte: int | None = _MinDTE,
    max_dte: int | None = _MaxDTE,
    dark_pool: bool = _DarkPool,
):
    """
    Gating + cap + availability (INTERFACE §1.3/§2.2) WITHOUT requesting a rec. Cheap,
    side-effect-FREE (does NOT pre-commit a free use), always HTTP 200. Derives
    gate.state from the EXISTING ai_eval machinery (read-only) + the PER-IDENTITY cooldown window;
    reports the daily cap, in-app availability, and — for an authenticated admin on a shared-key
    path — the additive `remaining_free_uses`/`free_uses_total` so the panel can pre-render the
    admin's count (byo-ai-key §2.2). Stays anonymous-readable (the auth gate is only on the POST).

    ai-rec-backtest-orders: also carries the ALWAYS-present `scenarios` advertisement
    (`{enabled, catalog[]}` — empty catalog while `AI_REC_SCENARIOS_ENABLED` is off; the picker's
    single source when on). Still side-effect-free.
    """
    t = ticker.upper()
    bundle = await _served_bundle_for_rec(t, min_dte, max_dte, dark_pool)  # 404 if no chain
    # Best-effort identity resolution for the additive free-use fields. Anonymous / fault ⇒ no VO
    # ⇒ null free-use fields (a regular/anonymous read never carries a counter). NEVER mutates.
    resolved, ok = _resolve_auth(request)
    resolved_key = None
    if ok and resolved is not None and resolved.authenticated:
        resolved_key = _resolve_ai_key(resolved)
    return ai_rec.status_payload(bundle.get("ai_eval"), resolved_key)


@app.get("/api/_metrics")
async def get_metrics_readout(request: Request):
    """
    Operator metrics readout (read-only, side-effect-free): the rolling MetricsAggregate snapshot
    — total + per-stage p50/p95/max/count, cache hit/miss/ratio/age, vendor call count/latency/min
    rate-limit headroom (or null ⇒ "unknown"), per-ticker rolled up to global, and recent traces.

    Reading this NEVER triggers a vendor fetch, recompute, or cache mutation. Operator-gated (not
    linked from the trader UI). The window is process-local + ephemeral (resets on restart).

    HIGH-1 token gate: when METRICS_SECRET_TOKEN is SET, the request MUST present it as
    `Authorization: Bearer <token>` OR an `X-Metrics-Token` header, else 401. When the env is UNSET,
    the gate is open (LOCAL dev unchanged) — PROD MUST set it (the Railway origin is public).
    """
    if not _metrics_token_ok(request):
        raise HTTPException(
            status_code=401,
            detail="Metrics require a valid token (Authorization: Bearer <token> or X-Metrics-Token).",
        )
    return obs.readout()


@app.get("/api/stream/{ticker}")
async def stream_ticker(
    request: Request,
    ticker: str = Path(..., description="Underlying symbol, e.g. TSLA"),
    min_dte: int | None = _MinDTE,
    max_dte: int | None = _MaxDTE,
    expirations: str | None = _Expirations,
):
    """
    Server-Sent Events stream of the live payload (mid, spread, net_flow, and the gamma flip
    repriced at the live mid over the requested DTE/expiration filter). One stock stream per
    ticker is shared across subscribers; it tears down when the last subscriber disconnects.

    Disconnect handling: we do NOT poll request.is_disconnected() (it fights Starlette's own
    disconnect listener for the single ASGI receive channel). Instead Starlette cancels this
    generator on client disconnect, and the `finally` unsubscribes -> the session stops when
    its last subscriber leaves.
    """
    # HIGH-2: per-IP throttle BEFORE the live session subscribe (which opens the Massive WebSocket
    # feed). 429 (no vendor call) when over the limit; fail-open otherwise. Outside the score path.
    limited = _rate_limit_or_response(request)
    if limited is not None:
        return limited
    t = ticker.upper()
    filt = (min_dte, max_dte, _parse_expirations(expirations))
    queue = await live_hub.subscribe(t, filt)

    async def event_gen():
        try:
            yield ": connected\n\n"
            while True:
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {json.dumps(payload)}\n\n"
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"   # keep the connection alive between events
        finally:
            await live_hub.unsubscribe(t, queue)

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


# Friendly per-ticker route (e.g. /TSLA). Declared LAST and constrained to letters so it
# can't shadow /docs, /openapi.json, or the /api/* routes above.
@app.get("/{ticker}")
async def get_ticker_page(
    ticker: str = Path(..., pattern=r"^[A-Za-z]{1,6}$", description="Underlying symbol, e.g. TSLA"),
    min_dte: int | None = _MinDTE,
    max_dte: int | None = _MaxDTE,
    expirations: str | None = _Expirations,
    dark_pool: bool = _DarkPool,
):
    """Same full bundle as /api/ticker/{ticker}, on the friendly /SYMBOL URL."""
    return await _serve(ticker, min_dte, max_dte, _parse_expirations(expirations), dark_pool)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
