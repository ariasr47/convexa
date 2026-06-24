import asyncio
import sys
import time
import logging
import json
import os
import zoneinfo
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Path, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from src.core.engine import QuantEngine
from src.core.signals import (generate_signals, evaluate_gate,
                              compute_opportunity_tier, position_fingerprint)
from src.core.live import LiveHub
from src.core.darkpool import analyze_off_exchange
from src.core import observability as obs
from src.core import personas as personas_lib
# AI Recommendations: the ISOLATED best-effort in-app LLM proxy + state-export serializer. This is
# a one-way LEAF — engine/signals/live/darkpool do NOT import it (the structural guarantee of score
# byte-identity); main.py imports it ONLY for the three recommendation endpoints, never on the
# bundle/SSE path. The key (ANTHROPIC_API_KEY) is read ONLY inside this module.
from src.core import ai_recommendation as ai_rec
from src.providers import get_provider
from src.models.market_data import MarketState

logger = logging.getLogger("GammaFlowAsync")
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
# AI gate is forced off. Default ~15-min delay + slack; drop to ~120 on a real-time tier.
STALE_AFTER_SECONDS = int(os.getenv("STALE_AFTER_SECONDS", "1200"))
# opportunity_score at/above which a snapshot is worth escalating to the strategy AI.
GATE_SCORE = int(os.getenv("GATE_SCORE", "50"))

# --- Live (real-time) config ---
FLOW_WINDOW_SECONDS = int(os.getenv("FLOW_WINDOW_SECONDS", "300"))   # rolling net-flow window
LIVE_THROTTLE_SECONDS = float(os.getenv("LIVE_THROTTLE_SECONDS", "1.5"))  # SSE broadcast cadence
CHAIN_REFRESH_SECONDS = int(os.getenv("CHAIN_REFRESH_SECONDS", "120"))    # live chain re-fetch

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


def compute_ticker(ticker: str, min_dte: int | None = None,
                   max_dte: int | None = None,
                   expirations: tuple | None = None,
                   dark_pool: bool = False) -> dict | None:
    """
    Fetch + compute everything for ONE ticker on demand and return the full bundle.
    Returns None when the symbol has no usable option chain (so callers can 404).

    `expirations` (a tuple of YYYY-MM-DD dates) restricts the gamma structure to those
    expirations; None uses the full chain (subject to min/max DTE).

    `dark_pool`: when True, compute off-exchange volume context, include it in the bundle,
    and apply its (capped) confluence bonus to the opportunity score. When False, it is
    omitted entirely -- not in the bundle and not in scoring.

    Synchronous (does blocking SDK I/O); endpoints run it in a worker thread.
    """
    logger.info(f"[{ticker}] On-demand refresh (min_dte={min_dte}, max_dte={max_dte}, "
                f"expirations={len(expirations) if expirations else 'all'}, dark_pool={dark_pool})")
    # vendor_fetch (I/O): the three chain/bar fetches; each logical call also timed for the vendor
    # metrics section. (fetch_recent_trades for dark_pool is timed under the off_exchange stage +
    # the vendor section, since it happens after engine_build.)
    with obs.span("vendor_fetch"):
        with obs.vendor_call("fetch_options_market_state"):
            market_data = data_provider.fetch_options_market_state(ticker)
        with obs.vendor_call("fetch_daily_bars"):
            underlying_history = data_provider.fetch_daily_bars(ticker)
        with obs.vendor_call("fetch_intraday_bars"):
            intraday_bars = data_provider.fetch_intraday_bars(ticker)

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
    title="GammaFlow Volatility API",
    description="Serves net dealer gamma profiles, greeks, and trade signals for a single "
                "ticker on demand, over a selectable expiration (DTE) window.",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _parse_expirations(csv: str | None) -> tuple | None:
    """Normalize a comma-separated expirations param to a sorted tuple (cache-stable), or None."""
    if not csv:
        return None
    items = sorted({e.strip()[:10] for e in csv.split(",") if e.strip()})
    return tuple(items) or None


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
            bundle = await asyncio.to_thread(compute_ticker, t, min_dte, max_dte, expirations, dark_pool)
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
    ticker: str = Path(..., description="Underlying symbol, e.g. SPY"),
):
    """
    Request an in-app AI recommendation (INTERFACE §1.1). ALWAYS HTTP 200 for produced / no_trade /
    unavailable / gated_off — the `status` field distinguishes them; an LLM/cap/key fault is a
    contained `unavailable`, never a 5xx that breaks the bundle/SSE/page. Serializes ALREADY-CACHED
    state (no recompute, no new vendor fetch, null stays null). The key is server-side only.
    """
    t = ticker.upper()
    bundle = await _served_bundle_for_rec(t, body.dte_min, body.dte_max, body.dark_pool)
    # The LLM call is blocking + multi-second; run it OFF the event loop so it can never stall the
    # cached bundle or the SSE stream. The proxy owns its own bounded timeout.
    return await asyncio.to_thread(
        ai_rec.generate_recommendation, t, bundle,
        persona_id=body.persona_id, dte_min=body.dte_min, dte_max=body.dte_max,
        override=body.override, snapshot_fingerprint=body.snapshot_fingerprint)


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
    ticker: str = Path(..., description="Underlying symbol, e.g. SPY"),
    min_dte: int | None = _MinDTE,
    max_dte: int | None = _MaxDTE,
    dark_pool: bool = _DarkPool,
):
    """
    Gating + cap + availability (INTERFACE §1.3) WITHOUT requesting a rec. Cheap, side-effect-free,
    always HTTP 200. Derives gate.state from the EXISTING ai_eval machinery (read-only) + the
    cooldown window; reports the daily cap and in-app availability. The FE drives the action's
    enabled/disabled presentation from this.
    """
    t = ticker.upper()
    bundle = await _served_bundle_for_rec(t, min_dte, max_dte, dark_pool)  # 404 if no chain
    return ai_rec.status_payload(bundle.get("ai_eval"))


@app.get("/api/_metrics")
async def get_metrics_readout():
    """
    Operator metrics readout (read-only, side-effect-free): the rolling MetricsAggregate snapshot
    — total + per-stage p50/p95/max/count, cache hit/miss/ratio/age, vendor call count/latency/min
    rate-limit headroom (or null ⇒ "unknown"), per-ticker rolled up to global, and recent traces.

    Reading this NEVER triggers a vendor fetch, recompute, or cache mutation. Operator-gated (not
    linked from the trader UI). The window is process-local + ephemeral (resets on restart).
    """
    return obs.readout()


@app.get("/api/stream/{ticker}")
async def stream_ticker(
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
