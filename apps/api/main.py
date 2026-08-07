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
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

from src.core.engine import QuantEngine
from src.core.signals import (generate_signals, evaluate_gate,
                              compute_opportunity_tier, position_fingerprint)
from src.core.live import LiveCapacityError, LiveHub
from src.core import chain_store
from src.core.darkpool import analyze_off_exchange
# Market-context pack (ai-context-pack): a ONE-WAY LEAF like darkpool/ai_recommendation —
# signals/engine/live/darkpool NEVER import it, it imports stdlib/math only, and main.py is the
# sole caller. Its output is attached to market_state AFTER generate_signals returns, so no pack
# field can exist at score/gate/fingerprint time ([additive-keeps-score-byte-identical]).
from src.core import context_pack
# Marketdata (iv-rank): a ONE-WAY LEAF sibling of src/auth/ — the project's first persistent
# market-data store. signals/engine/live/darkpool NEVER import it; it imports stdlib/math + its own
# port/adapters only; main.py is the sole caller. Its output (market_state.iv_rank) is attached
# AFTER generate_signals returns, so it cannot exist at score/gate/fingerprint time
# ([additive-keeps-score-byte-identical]). Best-effort: any store/read/write fault -> iv_rank null.
from src import marketdata
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
from src.auth.router import broker_credential_router
# Scanner (Scanner v1): two one-way LEAVES read ONLY here (main.py is the sole web orchestration
# boundary; no scoring module imports them). `scanstore` is the sweep's persistent store (read for
# /api/scan* + the warm-click bundle-blob); `src.scanner.universe` is the owner-curated universe the
# read API + the view validator resolve against. NEVER imported by engine/signals/live/darkpool/
# chain_store/compute_ticker ([additive-keeps-score-byte-identical]).
from src import scanstore
from src.core import price_stream
from src.scanner.universe import get_universe
# bundle-events: the event-calendar WIRE PROJECTION. One-way leaf — main.py is the sole caller and
# it is invoked only AFTER generate_signals returns; no scoring module imports it.
from src.scanner.events import project_event_calendar
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

# --- Scanner warm-click read-through (Scanner v1 P3) ---
# A cold ticker request for a TRACKED symbol may serve the sweep worker's freshly-computed bundle-blob
# instead of paying the cold vendor fetch — the chain_store pre-warm precedent extended across the
# process boundary (worker writes, web reads). FRESHNESS-GATED: a blob older than this budget is a
# MISS (never served as fresh) -> normal vendor fetch. Clamped <= STALE_AFTER_SECONDS so a served blob
# can never be one the freshness contract would immediately flag stale. Only the CANONICAL bundle
# (no DTE/expiration filter, dark_pool == INCLUDE_DARK_POOL — exactly what the worker computes) is
# eligible; any filtered request differs in structure and always falls through to a fresh compute.
SCAN_WARM_MAX_AGE_SECONDS = min(
    int(os.getenv("SCAN_WARM_MAX_AGE_SECONDS", str(STALE_AFTER_SECONDS))), STALE_AFTER_SECONDS)

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

# --- Scanner default-view (D2) fallback size (Scanner v1 P3) ---
# When no explicit owner default_view list is configured, the anonymous/new-user view falls back to
# the top-N tracked symbols by current score (empty store -> the first N universe symbols as
# `building`). N=20 (INTERFACE §3.1). The shipped config carries an explicit default_view, so this
# path is the unset-config fallback. Operator-tunable; runtime env only.
SCAN_DEFAULT_VIEW_N = int(os.getenv("SCAN_DEFAULT_VIEW_N", "20"))

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
# S5c (system-6 fast-follow, MEDIUM): the subscribers dict was UNBOUNDED. Two ceilings, defaults on
# — this is a capacity guard, so unlike the fail-open rate limiter it is worth having by default.
# 0/unset disables either one. See LiveHub's docstring for why sessions and subscribers are capped
# separately rather than with one blunt total.
MAX_LIVE_SESSIONS = int(os.getenv("MAX_LIVE_SESSIONS", "50"))
MAX_LIVE_SUBSCRIBERS = int(os.getenv("MAX_LIVE_SUBSCRIBERS", "500"))
live_hub = LiveHub(data_provider, quant_engine, flow_window=FLOW_WINDOW_SECONDS,
                   throttle=LIVE_THROTTLE_SECONDS, chain_refresh=CHAIN_REFRESH_SECONDS,
                   max_sessions=MAX_LIVE_SESSIONS, max_subscribers=MAX_LIVE_SUBSCRIBERS)
logger.info(f"Live hub ceilings: max_sessions={MAX_LIVE_SESSIONS or 'OFF'} "
            f"max_subscribers={MAX_LIVE_SUBSCRIBERS or 'OFF'}")


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

        # Projected dealer flow (STATIC, additive, advisory context only -- NOT scored). A pure
        # transform over the window-scoped net_charm/net_vanna + the next monthly-OPEX date,
        # computed in the engine. Two independently-nullable limbs; null (whole object) only when
        # both are unavailable OR the compute raised. `signals` reads none of it.
        "dealer_flow_projection": gex_metrics["dealer_flow_projection"],

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

    # market_context (ai-context-pack): the additive, best-effort "Market context" pack — four
    # independently-nullable reads (TI regime / GEX shape / flow-vs-positioning / ATR) computed in
    # the one-way-leaf src/core/context_pack.py from data ALREADY fetched (daily bars, the built
    # state, the window-scoped profile rows, the raw chain snapshot). Attached AFTER
    # generate_signals returned, so the fields did not exist at score/gate/fingerprint time (belt)
    # and signals.py reads none of them (suspenders) — [additive-keeps-score-byte-identical].
    #
    # BEST-EFFORT + ISOLATED ([best-effort-isolated-or-null]): each read fails to its OWN null
    # inside the leaf; this outer guard catches a wrapper fault -> market_context = None. The KEY
    # is ALWAYS emitted (object|null) — a pack failure can never turn the 200 bundle into an
    # error or touch market_state core / strike_profile / the cache / the SSE path. STATIC:
    # cached with the bundle (60s), recomputed only on a cache miss; nothing rides SSE.
    market_context = None
    try:
        with obs.span("context_pack"):
            market_context = context_pack.compute_market_context(
                underlying_history, profile, state, market_data)
    except Exception:
        logger.exception(f"[{ticker}] Market-context pack failed; emitting market_context=null "
                         f"(bundle unaffected)")
        market_context = None
    state["market_context"] = market_context

    # iv_rank (iv-rank): the additive, best-effort, STATIC IV-Rank/Percentile read. Accumulates one
    # CM30 IV sample per ticker per UTC day into the persistent marketdata store (write-through), then
    # reads the ticker's rolling <=252-session window to compute the rank/percentile (or the
    # 'building'/null state). Attached AFTER generate_signals returned, so it never existed at
    # score/gate/fingerprint time (belt) and signals.py imports none of the leaf (suspenders) —
    # [additive-keeps-score-byte-identical].
    #
    # BEST-EFFORT + ISOLATED ([best-effort-isolated-or-null]): the WRITE is wrapped so ANY store
    # fault is swallowed and NEVER perturbs the served bundle / cache / SSE / market_state core. The
    # READ is wrapped so any fault -> iv_rank = null. The KEY is ALWAYS emitted (object|null). Ordering:
    # write-through BEFORE the read, so today's just-written sample is in the window and the reported
    # sample_count matches what the read used. STATIC: cached with the 60s bundle; nothing rides SSE.
    iv_rank = None
    try:
        with obs.span("iv_rank"):
            iv_store = marketdata.get_store()
            session_date = marketdata.session_date_from_ns(state.get("timestamp"))
            current_sample = None
            if session_date:
                current_sample = marketdata.derive_cm30_sample(
                    ticker, state, market_data, session_date)
                # WRITE-THROUGH: idempotent upsert-if-absent; only a valid sample is written. Any
                # store fault is swallowed here so it never reaches the bundle.
                if current_sample is not None:
                    try:
                        iv_store.upsert_if_absent(current_sample)
                    except Exception:
                        logger.debug(f"[{ticker}] iv_rank write-through failed (bundle unaffected)",
                                     exc_info=True)
                # READ: compute the rank over accumulated history (best-effort inside the wrapper).
                iv_rank = marketdata.compute_iv_rank_read(iv_store, ticker, current_sample)
    except Exception:
        logger.exception(f"[{ticker}] IV-rank read failed; emitting iv_rank=null (bundle unaffected)")
        iv_rank = None
    state["iv_rank"] = iv_rank

    # event_calendar (bundle-events): the additive, best-effort, STATIC read of the OWNER-CURATED
    # calendar (src/scanner/config/events.json, process-cached by the one-way-leaf
    # src/scanner/events.py — edit + restart, no hot-reload). Attached AFTER generate_signals
    # returned, so the field did not exist at score/gate/fingerprint time (belt) and signals.py
    # imports none of the leaf (suspenders) — [additive-keeps-score-byte-identical]. It is context
    # for the downstream AI and the Ticker page, NEVER a scoring input.
    #
    # THE LOAD-BEARING SEMANTICS ([digested-labels-not-raw-dump] + absent-is-not-none): the closed
    # `state` token is authoritative on the wire. `unknown` (nobody curated this ticker) and `none`
    # (curated; nothing scheduled within `calendar_covers`) BOTH carry `events: []` — `state` is the
    # only thing that separates them, and collapsing them would fabricate "no earnings scheduled"
    # for a ticker nobody ever checked. An EXPIRED calendar is forced to `unknown`.
    #
    # BEST-EFFORT + ISOLATED ([best-effort-isolated-or-null]): the projection already degrades
    # internally, but this outer guard exists so that NO fault in the calendar path can escape into
    # the response — a missing/corrupt config yields event_calendar = null with the bundle still 200
    # and market_state core / strike_profile / the cache / SSE untouched. The KEY is ALWAYS emitted
    # (object|null). STATIC: cached with the 60s bundle; nothing rides SSE.
    #
    # expiration-events (additive to the SAME block): `event_calendar.expirations[]` — one summary
    # row per tenor saying whether a scheduled event falls inside that option's life. The tenor curve
    # is READ off the state dict computed above (`market_state.term_structure`, produced by
    # QuantEngine.compute_term_structure) and is NEVER decorated at source: engine.py stays 0-diff,
    # which is what keeps [additive-keeps-score-byte-identical] true. `state` still governs — the
    # list is [] for `unknown` AND `none` AND a missing/unusable curve, so it is not
    # self-disambiguating (INTERFACE §3).
    event_calendar = None
    try:
        with obs.span("event_calendar"):
            event_calendar = project_event_calendar(
                ticker, term_structure=state.get("term_structure"))
    except Exception:
        logger.exception(f"[{ticker}] Event-calendar read failed; emitting event_calendar=null "
                         f"(bundle unaffected)")
        event_calendar = None
    state["event_calendar"] = event_calendar

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


# S3c (system-6 fast-follow, LOW): FastAPI publishes Swagger UI at /docs, ReDoc at /redoc and the
# schema at /openapi.json BY DEFAULT. That hands the public internet the full route list, request/
# response schemas and parameter definitions — not an auth bypass, but free enumeration and
# fingerprinting. Gated behind an OPT-IN env so an unconfigured deployment (i.e. production) is
# closed; set ENABLE_API_DOCS=1 in a local .env when you want the interactive docs. Config-only —
# no scoring/engine/state_fingerprint touch.
_docs_enabled = os.environ.get("ENABLE_API_DOCS", "").strip() in ("1", "true", "True")

app = FastAPI(
    title="Convexa Volatility API",
    description="Serves net dealer gamma profiles, greeks, and trade signals for a single "
                "ticker on demand, over a selectable expiration (DTE) window.",
    version="3.0.0",
    docs_url="/docs" if _docs_enabled else None,
    redoc_url="/redoc" if _docs_enabled else None,
    openapi_url="/openapi.json" if _docs_enabled else None,
)


# --------------------------------------------------------------- 422 body echo (M-1, GATE Z)
# FastAPI's DEFAULT RequestValidationError handler echoes the offending value back to the
# client under `input` (and sometimes `ctx`). On the credential routes that value IS the
# secret: a wrong-TYPED `app_key` / `app_secret` / AI `key` returned the raw submitted key
# verbatim in a 422 body — reproduced live on BOTH `PUT /api/broker/credential` and the
# already-shipped `PUT /api/auth/ai-key`.
#
# `src/auth/router.py` already defends the MISSING-half case by making the fields optional at
# the Pydantic layer and doing the both-halves 422 itself; that defense simply does not reach
# a type error, which Pydantic raises before any router code runs. So the fix goes where it
# cannot be bypassed: APP-WIDE, on the handler itself. No endpoint in this app needs its
# request value read back to it, and `[secret-encrypted-at-rest]` is explicit that a stored
# secret is never returned in a response — a 422 body is a response.
#
# `type`, `loc` and `msg` are KEPT: the client must still learn WHICH field was wrong and why.
# Only the submitted VALUE is dropped.
@app.exception_handler(RequestValidationError)
async def _validation_error_without_body_echo(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": [{"type": e.get("type"), "loc": list(e.get("loc", [])),
                             "msg": e.get("msg")}
                            for e in exc.errors()]})

# --- Scanner embedded-worker seam (Scanner v1 P2, default OFF). When SCANNER_EMBEDDED=1, run the
# sweep loop INSIDE this API process (one-terminal dev). Production runs the worker as a SEPARATE
# process (worker.py / nx serve-worker). This is orchestration-only: it imports worker lazily and
# spawns a background task; it NEVER touches compute_ticker/scoring, and unset => byte-identical app.
if os.getenv("SCANNER_EMBEDDED", "").strip() in ("1", "true", "True"):
    @app.on_event("startup")
    async def _start_embedded_scanner():   # pragma: no cover - dev convenience seam
        import worker
        logger.info("[main] SCANNER_EMBEDDED=1 -> launching in-process sweep worker")
        app.state._scanner_task = asyncio.create_task(worker.run_worker())

# Owner-account seed (owner lockdown, 2026-08-06). Idempotent: creates the owner's account at
# startup ONLY if that email has no user yet. Two reasons it exists:
#   1. With sign-ups closed, there must still be a way to HAVE an account.
#   2. The local/default store is in-memory SQLite and RESETS ON RESTART (accepted prototype) —
#      re-seeding each boot is what makes "an account that persists restarts" true on a dev box.
#      On Railway (ACCOUNT_STORE=postgres) the row survives and this is a cheap no-op.
# Unset OWNER_EMAIL/OWNER_PASSWORD => nothing happens, app byte-identical. Never logs the password.
def _extra_seed_accounts() -> list[tuple[str, str, str | None]]:
    """
    Additional accounts to seed at boot — the owner's testing logins, which must stay valid and
    active in production while registration is closed.

    JSON, deliberately: `SEED_ACCOUNTS=[{"email":"a@b.c","password":"...","display_name":"QA"}]`.
    A `email:password` delimiter format cannot survive a password containing `:` or `,`, and
    silently truncating someone's password to a shorter working one is the kind of bug that only
    shows up as "I can't log in" months later.

    NOT a relaxation of the `SEED_TEST_ACCOUNT` Postgres guard, which stays exactly as it is: that
    path seeds a FIXED credential whose default password is published in this repo, and putting it
    in a production database would be a real hole. This path only ever creates accounts whose
    passwords the operator chose and injected as runtime env ([no-secrets-in-image]).
    """
    raw = os.getenv("SEED_ACCOUNTS", "").strip()
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        out: list[tuple[str, str, str | None]] = []
        for entry in parsed:
            email = str(entry.get("email", "")).strip()
            password = str(entry.get("password", ""))
            if not email or not password:
                logger.warning("[main] SEED_ACCOUNTS: skipping an entry missing email or password")
                continue
            name = entry.get("display_name")
            out.append((email, password, str(name).strip() if name else None))
        return out
    except Exception:
        # Never take boot down over a malformed env; loud, and names no secret.
        logger.warning("[main] SEED_ACCOUNTS is not valid JSON — no extra accounts seeded")
        return []


@app.on_event("startup")
async def _seed_owner_account():
    accounts = _extra_seed_accounts()
    email = os.getenv("OWNER_EMAIL", "").strip()
    password = os.getenv("OWNER_PASSWORD", "")
    if email and password:
        accounts.insert(0, (email, password, os.getenv("OWNER_DISPLAY_NAME", "").strip() or None))
    for acct_email, acct_password, acct_name in accounts:
        _seed_one_account(acct_email, acct_password, acct_name)


def _seed_one_account(email: str, password: str, display_name: str | None) -> None:
    try:
        # `ensure_account` is the established operator-seed path: idempotent, race-safe on the
        # unique-email constraint, opens no session, and bypasses the signup validation floor by
        # design (an operator seed is not user input). Unlike SEED_TEST_ACCOUNT this is NOT
        # refused on Postgres — a persistent owner account in production is the entire point.
        created = auth.get_service().ensure_account(
            email=email, password=password, display_name=display_name)
        # Logs the ADDRESS (needed to tell which seed ran) and never the password.
        logger.info("[main] seed: account %s %s", email,
                    "created" if created else "already present (no-op)")
    except Exception:
        # Never take the app down over a seed; sign-in simply won't have an account to find,
        # which is loud in the only place it matters (someone tries to log in and cannot).
        logger.warning("[main] seed: account seed failed for %s", email, exc_info=False)


# CORS allowlist (env-gated, defense-in-depth) — [R2]. Under the deployed shape the browser is
# SAME-ORIGIN (the Cloudflare Pages Function proxies /api/* on the *.pages.dev origin), so this
# middleware is not on the browser's hot path; but a locked, env-driven allowlist is the security
# floor and the clean fallback for a CORS world. Read ALLOWED_ORIGINS (comma-separated) and default
# to the existing localhost dev origins when unset so LOCAL dev is byte-for-byte unchanged. NEVER
# "*" with credentials (incompatible with allow_credentials=True and a real leak). Config-only — no
# scoring/engine/state_fingerprint touch.
# S2-prod (system-6 fast-follow, MEDIUM): the unset default USED TO BE the localhost dev list, which
# fails OPEN in the wrong direction — an unconfigured production deployment would accept credentialed
# cross-origin requests from a page served at localhost:3000, bypassing the Pages proxy entirely.
# Now unset => [] (DENY ALL), so a deployment that forgets ALLOWED_ORIGINS fails CLOSED.
#
# This costs local dev nothing: the dashboard dev server proxies /api -> :8000, so the browser is
# SAME-ORIGIN at :4200 and this middleware is never on its path. If you do need cross-origin locally,
# set ALLOWED_ORIGINS in apps/api/.env (see .env.example).
_cors_env = os.environ.get("ALLOWED_ORIGINS", "").strip()
_allowed_origins = [o.strip() for o in _cors_env.split(",") if o.strip()] if _cors_env else []
if not _allowed_origins:
    # Deliberately conspicuous, matching the HIGH-3 stable-key warning below: a silent deny-all is
    # indistinguishable from a broken deployment when someone is debugging a CORS error.
    logger.warning(
        "[security] ALLOWED_ORIGINS is unset -> CORS deny-all (fail-closed). This is correct for "
        "the proxied same-origin deployment; set ALLOWED_ORIGINS if a browser must call this API "
        "cross-origin."
    )
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    # S6g (system-6 fast-follow, LOW): was ["*"]/["*"]. Wildcards with credentials are unnecessarily
    # permissive even behind a locked origin list; these are the methods and headers this API
    # actually uses.
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Cookie", "Authorization"],
)

# S3c, second half — the part that is easy to miss. The friendly `/{ticker}` catch-all at the bottom
# of this file was safe ONLY because FastAPI registered /docs, /redoc and /openapi.json ahead of it.
# Turning the docs off removes those routes, and "docs" is a perfectly valid 4-letter ticker: the
# path then falls through to the catch-all and triggers a REAL VENDOR FETCH for a symbol named
# "DOCS" (observed: a full computed bundle came back). These explicit stubs keep the paths claimed so
# they 404 cleanly instead of costing a vendor call. Registered here, well before the catch-all.
if not _docs_enabled:
    for _docs_path in ("/docs", "/redoc", "/openapi.json"):

        @app.get(_docs_path, include_in_schema=False)
        async def _docs_disabled():  # noqa: F811 — one handler per path, intentionally identical
            raise HTTPException(status_code=404, detail="Not Found")

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
# broker-connect: the /api/broker/credential trio lives in the auth leaf (it is credential
# storage — the byo-ai-key shape on kind="broker_webull"); the /api/broker/book endpoints are
# wired below at the same orchestration boundary. Server-gated, all five.
app.include_router(broker_credential_router)
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


# --- broker-connect (B5): the read-only broker book surface --------------------------------
# The broker subpackage is a ONE-WAY LEAF (a sibling of src/auth/ — see src/broker/__init__).
# main.py is the sole orchestration boundary: it resolves the session + the stored credential
# per request and hands the leaf an in-memory VALUE OBJECT; the leaf never imports auth, and
# nothing on the bundle/SSE/scoring path imports the leaf ([additive-keeps-score-byte-identical],
# pinned by tests/test_broker_isolation.py). Broker-side trouble is NEVER a 5xx here: every
# fault degrades to a typed state inside a 200 ([best-effort-isolated-or-null]; the auth GATE
# refusals stay real 401/403 — the carve-out).

_broker_service = None


def _get_broker_service():
    """Build (once) the book service over the env-selected provider (POSITIONS_PROVIDER:
    webull default | stub) and register the credential-delete cache invalidation hook —
    a deleted credential must never leave a ghost book (AC-3)."""
    global _broker_service
    if _broker_service is None:
        from src.broker import get_positions_provider
        from src.broker.service import BrokerBookService
        _broker_service = BrokerBookService(get_positions_provider())
        try:
            auth.get_service().set_broker_cache_invalidator(_broker_service.invalidate)
        except Exception:
            logger.warning("broker: cache-invalidator registration deferred", exc_info=False)
    return _broker_service


try:
    # Eager wiring at boot so the delete-invalidation hook exists before any request; a config
    # error (unknown POSITIONS_PROVIDER) defers to first use rather than crashing boot.
    _get_broker_service()
except Exception:
    logger.warning("broker: service init deferred (will retry on first request)", exc_info=False)


def _resolve_broker_credential(user):
    """
    Per-request credential resolution at THIS boundary (the byo-ai-key precedent): returns
    ("ok", BrokerCredential) | ("none", None) | ("unreadable", None). Decryption happens in
    the auth leaf; the plaintext lives only in the request-scope VO. A decrypt failure is
    `unreadable` — no-usable-credential, never a leak, never "Webull rejected".
    """
    from src.broker.ports import BrokerCredential
    svc = auth.get_service()
    hint = svc.broker_credential_hint(user)
    if not hint.get("set"):
        return ("none", None)
    pair = svc.get_decrypted_broker_credential(user.id)
    if pair is None:
        return ("unreadable", None)
    return ("ok", BrokerCredential(app_key=pair[0], app_secret=pair[1]))


async def _serve_broker_book(request: Request, *, refresh: bool):
    gate = _gate_or_response(request)
    if gate is not None:
        return gate                      # real 401/403/503 — the auth carve-out
    resolved, _ok = _resolve_auth(request)
    user = resolved.user
    try:
        service = _get_broker_service()
        resolution = _resolve_broker_credential(user)
        call = service.refresh_book if refresh else service.get_book
        # The provider fetch blocks (HTTP to the broker); keep it OFF the event loop so a slow
        # broker can never stall the bundle or the SSE stream.
        book = await asyncio.to_thread(call, user.id, resolution)
        return book.to_wire()
    except Exception:
        # Never a 5xx for broker-side trouble — the typed catch-all arm.
        logger.warning("broker: book serve faulted (adapter_fault)", exc_info=False)
        return {"state": "unknown", "reason": "adapter_fault", "positions": []}


@app.get("/api/broker/book")
async def broker_book(request: Request):
    """Read the owner's broker book (INTERFACE §6): TTL cache when fresh (`basis: cache`),
    else fetch. No credential ⇒ the `unknown`/`no_credential_stored` 200 product state."""
    return await _serve_broker_book(request, refresh=False)


@app.post("/api/broker/book/refresh")
async def broker_book_refresh(request: Request):
    """Force-fetch (C4): always REQUESTS a fresh read; the server may throttle (cached
    snapshot, `last_attempt_at` unmoved — visibly not an attempt), never a silent no-op."""
    return await _serve_broker_book(request, refresh=True)


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
    # Scanner warm-click read-through (Scanner v1 P3): a cold request for a TRACKED symbol may serve
    # the sweep worker's freshly-computed bundle-blob instead of the cold vendor fetch — the
    # chain_store pre-warm precedent extended across the process boundary (worker writes, web reads).
    # BYTE-PRESERVING: the blob was produced by compute_ticker in the worker, so compute_ticker stays
    # the SOLE transform; the read-through only changes where the bundle came from (never its bytes).
    # Best-effort + freshness-gated: any miss/stale/fault falls straight through to the normal fetch
    # (no new failure surface — ARCHITECTURE §5.3).
    warm = _scan_warm_bundle(t, min_dte, max_dte, expirations, dark_pool, now)
    if warm is not None:
        bundle = warm
        chain_source = "scan_warm_hit"
        if trace is not None:
            try:
                trace.dims["chain_source"] = chain_source
            except Exception:
                pass
    else:
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
    _snapshot_cache[t] = {"market_data": bundle.pop("_snapshot", None), "computed_at": now}
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


# HIGH-2 BYPASS CLOSED (2026-07-28). The throttle was applied to /api/ticker and /api/stream only,
# but EVERY route below calls the same `_serve` and therefore triggers the same vendor fetches. An
# attacker enumerating tickers against /api/market-data — or the friendly /SYMBOL route — did exactly
# the damage the limiter exists to prevent, uncounted. Same helper, same fail-open semantics, checked
# BEFORE any vendor call. Returning the 429 Response directly bypasses `response_model`, which is
# what we want: an over-limit reply is not a MarketState.
@app.get("/api/market-data", response_model=MarketState)
async def get_market_data(
    request: Request,
    ticker: str = Query(..., description="Underlying symbol, e.g. TSLA"),
    min_dte: int | None = _MinDTE,
    max_dte: int | None = _MaxDTE,
    expirations: str | None = _Expirations,
    dark_pool: bool = _DarkPool,
):
    limited = _rate_limit_or_response(request)
    if limited is not None:
        return limited
    return (await _serve(ticker, min_dte, max_dte, _parse_expirations(expirations), dark_pool))["market_state"]


@app.get("/api/strike-profile")
async def get_strike_profile(
    request: Request,
    ticker: str = Query(..., description="Underlying symbol, e.g. TSLA"),
    min_dte: int | None = _MinDTE,
    max_dte: int | None = _MaxDTE,
    expirations: str | None = _Expirations,
    dark_pool: bool = _DarkPool,
):
    limited = _rate_limit_or_response(request)
    if limited is not None:
        return limited
    return (await _serve(ticker, min_dte, max_dte, _parse_expirations(expirations), dark_pool))["strike_profile"]


@app.get("/api/signals")
async def get_signals(
    request: Request,
    ticker: str = Query(..., description="Underlying symbol, e.g. TSLA"),
    min_dte: int | None = _MinDTE,
    max_dte: int | None = _MaxDTE,
    expirations: str | None = _Expirations,
    dark_pool: bool = _DarkPool,
):
    limited = _rate_limit_or_response(request)
    if limited is not None:
        return limited
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


# ⚠ REGISTERED BEFORE /api/stream/{ticker} ON PURPOSE. FastAPI matches in registration
# order, so declared after it this route is swallowed as ticker="prices" — which builds a
# LiveSession for a symbol named PRICES, chain-refresh loop and all. Same trap the scan
# routes call out against the /{ticker} catch-all; verified by test_price_route_ordering.
# --- Live scanner prices (2026-08-06) ------------------------------------------------------------
# ONE SSE connection carrying live prices for MANY symbols, backed by the shared vendor socket.
# Deliberately NOT /api/stream/{ticker} per row: that route builds a LiveSession, which runs a
# chain-refresh loop — twenty rows would mean twenty option-chain REST loops. This carries the
# cheapest thing the vendor sends and nothing else.
# Session-gated like the rest of the scanner surface ([server-side-gate-enforcement]).
_price_stream = None


def _get_price_stream():
    global _price_stream
    if _price_stream is None:
        _price_stream = price_stream.PriceStream(data_provider)
    return _price_stream


@app.get("/api/stream/prices")
async def stream_prices(request: Request, symbols: str = ""):
    """
    SSE of live prices for up to 120 symbols on ONE connection. Payload carries only symbols whose
    price CHANGED since the last flush, so a quiet tape costs nothing.

    The prices here are LIVE-DERIVED: the client must degrade them visibly when this stream drops
    ([live-vs-static-isolation]). Every other scanner field is STATIC, from the sweep, and keeps
    rendering regardless. Touches no scoring path.
    """
    gate = _gate_or_response(request)
    if gate is not None:
        return gate
    limited = _rate_limit_or_response(request)
    if limited is not None:
        return limited

    requested = [s for s in (symbols or "").split(",") if s.strip()]
    if not requested:
        return JSONResponse(status_code=422, content={"detail": "symbols is required"})

    async def event_gen():
        yield ": connected\n\n"
        gen = _get_price_stream().stream(requested)
        try:
            while True:
                try:
                    payload = await asyncio.wait_for(gen.__anext__(), timeout=15.0)
                    yield f"data: {json.dumps(payload)}\n\n"
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"     # quiet tape — hold the connection open
                except StopAsyncIteration:
                    break
        finally:
            await gen.aclose()   # releases every symbol subscription on the shared socket

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


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
    # S5c: the hub refuses at its ceiling BEFORE opening a Massive WebSocket. 503 (not 429) because
    # this is a SERVER capacity limit, not a per-caller quota — a well-behaved client that happens to
    # arrive when the box is full gets an honest "try again", with Retry-After. The FE already treats
    # a failed stream as the live-offline degrade, so the static bundle keeps rendering
    # ([live-vs-static-isolation]) rather than the page breaking.
    try:
        queue = await live_hub.subscribe(t, filt)
    except LiveCapacityError as exc:
        logger.warning(f"[{t}] live subscribe REFUSED — {exc.kind} ceiling {exc.limit} reached")
        return JSONResponse(
            status_code=503,
            content={"detail": "Live streaming is at capacity. Try again shortly."},
            headers={"Retry-After": "30"},
        )

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


# ============================================================================ Scanner read API (P3)
# The scanner's WEB surface: three anonymous-open, best-effort-200 READS + one server-gated WRITE, all
# reading the P1/P2 ScanStore. Registered HERE — BEFORE the /{ticker} catch-all alias below — so
# scan/universe/view are never swallowed as a ticker symbol (INTERFACE §1 / ARCHITECTURE §9). These
# reads are NOT an auth failure domain: a store outage degrades to a 200 + status, never a 5xx.

def _scan_view_response(view: dict, source: str, authenticated: bool) -> dict:
    """The ScanView wire (INTERFACE §2.3). `source`/`authenticated` are response-time facts (not
    stored); the rest comes from the resolved view dict, with the closed defaults applied."""
    return {
        "source": source,
        "authenticated": authenticated,
        "name": view.get("name"),
        "symbols": list(view.get("symbols") or []),
        "sort": view.get("sort") or {"key": "score", "dir": "desc"},
        "density": view.get("density") or "compact",
    }


@app.get("/api/scan/universe")
async def get_scan_universe(request: Request):
    """The read-only owner-curated tracked universe for the view editor (INTERFACE §3.2).
    **OWNER LOCKDOWN 2026-08-06: now SESSION-GATED.** Was anonymous-open; the private-testing
    lockdown closed the scanner to signed-out callers ([server-side-gate-enforcement])."""
    gate = _gate_or_response(request)
    if gate is not None:
        return gate
    try:
        symbols = list(get_universe().universe)
    except Exception:
        logger.warning("scan: universe config unavailable; returning empty list", exc_info=False)
        symbols = []
    return {"symbols": symbols, "universe_size": len(symbols)}


def _parse_saved_view(raw: str) -> "dict | None":
    """Deserialize a stored scan_view JSON string into a view dict; None on any parse fault (a
    corrupt/legacy value degrades to the default view, never a 5xx)."""
    try:
        v = json.loads(raw)
    except Exception:
        return None
    if not isinstance(v, dict) or not isinstance(v.get("symbols"), list):
        return None
    return v


def _default_view_symbols() -> list:
    """D2 default-view symbol list. Explicit owner default_view when non-empty; else top-N-by-current-
    score from the store (empty store -> the first N universe symbols, which become `building` rows).
    Best-effort: a universe/store fault degrades gracefully (never a 5xx)."""
    try:
        cfg = get_universe()
    except Exception:
        return []
    if cfg.default_view:
        return list(cfg.default_view)
    try:
        rows = {r.symbol: r for r in scanstore.get_store().read_rows(cfg.universe)}
    except Exception:
        rows = {}
    # Rank universe symbols by current score desc (None/absent last); stable in universe order. Empty
    # store -> every score is -inf -> the first N universe symbols (all become `building`).
    ranked = sorted(
        cfg.universe,
        key=lambda s: (rows[s].score if s in rows and rows[s].score is not None else float("-inf")),
        reverse=True)
    return ranked[:SCAN_DEFAULT_VIEW_N]


def _default_view_dict() -> dict:
    """The owner-curated default view bag (source: 'default')."""
    return {"symbols": _default_view_symbols(), "name": None,
            "sort": {"key": "score", "dir": "desc"}, "density": "compact"}


def _effective_view(request: Request) -> "tuple[dict, str, bool]":
    """Resolve the caller's effective view (D2). Signed-in with a saved view -> ('account', that view);
    otherwise -> ('default', the owner-curated default). `authenticated` reflects whether a session
    exists. A read is NEVER gated (AC-4): anonymous always gets a readable default."""
    resolved, ok = _resolve_auth(request)
    authed = bool(ok and resolved is not None and resolved.authenticated)
    if authed:
        try:
            raw = auth.get_service().get_scan_view(resolved.user)
        except Exception:
            raw = None
        if raw:
            parsed = _parse_saved_view(raw)
            if parsed is not None:
                return parsed, "account", True
    return _default_view_dict(), "default", authed


def _building_row_wire(symbol: str) -> dict:
    """A synthesized `building` placeholder row (INTERFACE §3.1 building-fill): present, honestly
    not-yet-computed (numeric fields null, status 'building', as_of 0.0 — NOT a freshness claim).
    Mirrors src.scanner.projection.project_building's shape via the P1 ScanRow wire."""
    return scanstore.ScanRow(
        symbol=symbol.upper(), price=None, chg_pct=None, score=None, tier=None, regime=None,
        vol_regime=None, flip=None, dist_to_flip_pct=None, call_wall=None, put_wall=None,
        dist_to_wall_pct=None, as_of=0.0, status="building").to_wire()


@app.get("/api/scan/view")
async def get_scan_view(request: Request):
    """The caller's effective view (INTERFACE §3.3).
    **OWNER LOCKDOWN 2026-08-06: now SESSION-GATED.** Was anonymous-open with a readable default
    (AC-4); the private-testing lockdown supersedes that ([server-side-gate-enforcement])."""
    gate = _gate_or_response(request)
    if gate is not None:
        return gate
    view, source, authed = _effective_view(request)
    return _scan_view_response(view, source, authed)


@app.get("/api/scan")
async def get_scan(request: Request):
    """The requested-or-default view as slim rows + sweep metadata (INTERFACE §3.1).
    **OWNER LOCKDOWN 2026-08-06: now SESSION-GATED.** Was anonymous-open. Past the gate the
    best-effort rule is unchanged: ALWAYS 200 + status, a store outage degrades content
    (stale/building rows, sweep null) and never a 5xx, every view symbol present in `rows`.
    The gate is the OUTERMOST precondition and is the one thing that MAY refuse
    ([server-side-gate-enforcement]; the auth carve-out on [best-effort-isolated-or-null])."""
    gate = _gate_or_response(request)
    if gate is not None:
        return gate
    view, source, authed = _effective_view(request)
    view_wire = _scan_view_response(view, source, authed)
    symbols = view_wire["symbols"]

    try:
        stored = {r.symbol: r for r in scanstore.get_store().read_rows(symbols)}
    except Exception:
        logger.warning("scan: read_rows faulted; serving building-filled degraded 200", exc_info=False)
        stored = {}
    # Building-fill: the stored row as-is (worker owns its status) or a synthesized building placeholder.
    rows = [stored[s].to_wire() if s in stored else _building_row_wire(s) for s in symbols]

    try:
        hb = scanstore.get_store().read_heartbeat()
    except Exception:
        logger.warning("scan: read_heartbeat faulted; sweep=null", exc_info=False)
        hb = None
    return {"view": view_wire, "rows": rows, "sweep": hb.to_wire() if hb is not None else None}


# Closed view-write vocabularies (INTERFACE §2.3). A value outside these is a 422 (AC-13): the editor
# cannot invent, add, or request universe symbols / sort keys / densities.
SCAN_SORT_KEYS = ("score", "symbol", "price", "chg_pct", "dist_to_flip_pct", "dist_to_wall_pct")
SCAN_SORT_DIRS = ("asc", "desc")
SCAN_DENSITIES = ("compact", "comfortable")


class ScanViewBody(BaseModel):
    """PUT /api/scan/view body (INTERFACE §3.4). LOOSE types on purpose: semantic validation runs
    INSIDE the handler, AFTER the auth gate, so a cookieless malformed PUT is refused by the gate
    (403) — never pre-empted by a pydantic 422 ([server-side-gate-enforcement]: nothing validates or
    persists signed-out)."""
    symbols: list[str] | None = None
    name: str | None = None
    sort: dict | None = None
    density: str | None = None


def _v422(detail: str) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": detail})


def _normalize_view_or_422(body: ScanViewBody, cfg) -> "tuple[dict | None, JSONResponse | None]":
    """Validate the write body against the CURRENT universe; return (normalized_view, None) or
    (None, 422). Symbols must be a non-empty subset of the universe (canonical UPPER, order + de-dupe
    preserved); sort/density are closed enums."""
    if not isinstance(body.symbols, list) or not body.symbols:
        return None, _v422("symbols must be a non-empty subset of the tracked universe.")
    universe = set(cfg.universe)
    seen: set = set()
    symbols: list = []
    for s in body.symbols:
        u = (s or "").strip().upper()
        if not u:
            continue
        if u not in universe:
            return None, _v422(f"'{u}' is not in the tracked universe.")
        if u not in seen:
            seen.add(u)
            symbols.append(u)
    if not symbols:
        return None, _v422("symbols must include at least one universe symbol.")
    sort = body.sort or {"key": "score", "dir": "desc"}
    key = sort.get("key", "score")
    direction = sort.get("dir", "desc")
    if key not in SCAN_SORT_KEYS:
        return None, _v422(f"sort.key must be one of {list(SCAN_SORT_KEYS)}.")
    if direction not in SCAN_SORT_DIRS:
        return None, _v422("sort.dir must be 'asc' or 'desc'.")
    density = body.density or "compact"
    if density not in SCAN_DENSITIES:
        return None, _v422("density must be 'compact' or 'comfortable'.")
    return ({"symbols": symbols, "name": (body.name or None),
             "sort": {"key": key, "dir": direction}, "density": density}, None)


@app.put("/api/scan/view")
async def put_scan_view(body: ScanViewBody, request: Request):
    """Save the signed-in user's per-account view (INTERFACE §3.4). The server-side gate is the
    OUTERMOST precondition: a signed-out caller is refused (403 auth_required / 503 auth_unavailable)
    and NOTHING is validated or persisted, even if the FE guard is bypassed (AC-3,
    [server-side-gate-enforcement]). 422 on an off-universe symbol / bad sort / bad density (AC-13).
    200 echoes the saved ScanView (source:'account'; server-wins persistence-echo, the
    PUT /api/auth/settings precedent). Persisted behind the existing auth-settings ports (D1)."""
    gate = _gate_or_response(request)
    if gate is not None:
        return gate
    resolved, _ok = _resolve_auth(request)   # a valid session is guaranteed past the gate
    try:
        cfg = get_universe()
    except Exception:
        return JSONResponse(status_code=503, content={"detail": "scan universe unavailable."})
    normalized, err = _normalize_view_or_422(body, cfg)
    if err is not None:
        return err
    try:
        auth.get_service().save_scan_view(resolved.user, json.dumps(normalized))
    except auth.AuthError as e:
        return JSONResponse(status_code=e.status, content=e.envelope())
    return _scan_view_response(normalized, "account", True)


def _tracked_symbols() -> frozenset:
    """Cached frozenset of the universe (tracked) symbols for the warm-click tracked-only gate.
    Best-effort: a universe-load fault yields an empty set (no warm-click), never an error."""
    try:
        return frozenset(get_universe().universe)
    except Exception:
        return frozenset()


def _scan_warm_bundle(t: str, min_dte, max_dte, expirations, dark_pool: bool,
                      now: float) -> "dict | None":
    """Best-effort warm-click source: the sweep worker's freshly-computed bundle-blob for a TRACKED
    symbol's CANONICAL (unfiltered) request, or None (miss/stale/fault -> normal vendor fetch). It
    changes only WHERE the bundle came from — never its bytes: the blob was produced by compute_ticker
    in the worker, so compute_ticker stays the sole transform ([additive-keeps-score-byte-identical])."""
    # Only the canonical full-chain bundle the worker computes is eligible (a DTE/expiration/dark_pool-
    # varied request has a different structure and must NOT be served the worker's blob).
    if min_dte is not None or max_dte is not None or expirations is not None \
            or dark_pool != INCLUDE_DARK_POOL:
        return None
    try:
        if t.upper() not in _tracked_symbols():
            return None
        blob = scanstore.get_store().read_bundle_blob(t)
    except Exception:
        logger.debug("warm-click: bundle-blob read skipped (store outage)", exc_info=True)
        return None
    if blob is None:
        return None
    # FRESHNESS GATE: a stale blob is a MISS (never served as fresh).
    if (now - blob.as_of) > SCAN_WARM_MAX_AGE_SECONDS:
        return None
    try:
        bundle = json.loads(blob.bundle_json)
    except Exception:
        logger.debug("warm-click: bundle-blob deserialize failed; falling through to vendor",
                     exc_info=True)
        return None
    # Defensive shape gate: only a well-formed compute_ticker bundle is served.
    if not isinstance(bundle, dict) or "market_state" not in bundle \
            or "state_fingerprint" not in (bundle.get("ai_eval") or {}):
        return None
    return bundle


# Friendly per-ticker route (e.g. /TSLA). Declared LAST and constrained to letters so it can't
# shadow the /api/* routes above.
#
# ⚠ IT NO LONGER SHADOW-PROOFS ITSELF AGAINST THE DOCS PATHS. That used to be free: FastAPI
# registered /docs, /redoc and /openapi.json ahead of this route, so they always won. Disabling the
# docs (S3c) REMOVES those routes — and `/docs` is a valid 4-letter ticker, so it fell straight
# through to here and triggered a REAL VENDOR FETCH for a symbol named "DOCS". The explicit 404
# stubs registered next to the CORS block above restore the invariant this comment used to describe.
@app.get("/{ticker}")
async def get_ticker_page(
    request: Request,
    ticker: str = Path(..., pattern=r"^[A-Za-z]{1,6}$", description="Underlying symbol, e.g. TSLA"),
    min_dte: int | None = _MinDTE,
    max_dte: int | None = _MaxDTE,
    expirations: str | None = _Expirations,
    dark_pool: bool = _DarkPool,
):
    """Same full bundle as /api/ticker/{ticker}, on the friendly /SYMBOL URL."""
    # HIGH-2 BYPASS: this route is the SAME bundle as /api/ticker/{ticker} and was completely
    # unthrottled — the cheapest way to enumerate tickers against the vendor bill. It is also the
    # route every stray crawler hit lands on (`/health`, `/login`, … are all valid 1-6 letter
    # "tickers"), so it is the one that most needs the guard, not the one that least does.
    limited = _rate_limit_or_response(request)
    if limited is not None:
        return limited
    return await _serve(ticker, min_dte, max_dte, _parse_expirations(expirations), dark_pool)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
