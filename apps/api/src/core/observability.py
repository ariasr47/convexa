"""
Backend observability for the REST bundle pipeline (Level-1, orchestration-boundary only).

This module owns the whole telemetry surface so the pure compute modules stay clean:
`engine.py` / `signals.py` / `darkpool.py` do NOT import it. `main.py` wraps the six pipeline
stages with `span(...)`, creates a `RequestTrace` per serve, and folds the finished trace into a
process-local `MetricsAggregate` after the response is assembled.

Design invariants (from the observability contracts):
- **Best-effort + isolated.** Every span/metric/emit is wrapped so an instrumentation exception is
  swallowed (logged at debug); the wrapped computation proceeds and re-raises its OWN errors
  unchanged. Instrumentation can never turn a 200 into a non-200 or blank a value.
- **No new hot-path locking.** The worker thread fills a request-local trace (carried via a
  `ContextVar`, which `asyncio.to_thread` copies into the thread); the event loop folds it into the
  aggregate after the response — single-writer, lock-free, like the existing cache discipline.
- **Process-local + ephemeral.** The aggregate is a bounded rolling window; it resets on restart.
- **Honest data.** A stage that didn't run is `skipped` (never a fabricated 0); vendor rate-limit
  headroom is `None` ("unknown") when the vendor doesn't expose it.
"""
import logging
import math
import time
import uuid
from collections import deque
from contextlib import contextmanager
from contextvars import ContextVar

logger = logging.getLogger("Convexa")

# Fixed stage vocabulary + their I/O-vs-CPU kind classifier (load-bearing for the future scanner).
STAGES = ("vendor_fetch", "engine_build", "off_exchange", "signals", "persist", "serialize_wrap")
STAGE_KIND = {
    "vendor_fetch": "io_vendor",
    "engine_build": "cpu_engine",
    "off_exchange": "cpu_engine",
    "signals": "cpu_signals",
    "persist": "io_disk",
    "serialize_wrap": "serialize",
}

# --- Module config (owned by main.py via configure()) ---
_ENABLED = True
_WINDOW_SIZE = 500
_RECENT_SIZE = 25
_aggregate: "MetricsAggregate | None" = None

# Request-local current trace. asyncio.to_thread copies the context, so a trace set on the event
# loop is visible (and mutable) inside the worker thread; appends are visible back on the loop.
_current_trace: ContextVar = ContextVar("convexa_request_trace", default=None)


def configure(enabled: bool, window_size: int = 500, recent_size: int = 25) -> None:
    """Initialize the module from main.py's env config. Call once at startup."""
    global _ENABLED, _WINDOW_SIZE, _RECENT_SIZE, _aggregate
    _ENABLED = bool(enabled)
    _WINDOW_SIZE = max(1, int(window_size))
    _RECENT_SIZE = max(0, int(recent_size))
    _aggregate = MetricsAggregate(_WINDOW_SIZE, _RECENT_SIZE)


def enabled() -> bool:
    return _ENABLED and _aggregate is not None


# ----------------------------------------------------------------------------- trace data model
class RequestTrace:
    """One request's telemetry, request-local (never global). Filled by the worker thread + loop."""

    __slots__ = ("trace_id", "ticker", "dims", "cache_hit", "cache_age_seconds",
                 "computed_trace_id", "_start", "total_ms", "stages", "vendor_calls")

    def __init__(self, ticker: str, dims: dict):
        self.trace_id = uuid.uuid4().hex[:12]
        self.ticker = (ticker or "").upper()
        self.dims = dims
        self.cache_hit = False
        self.cache_age_seconds = None
        self.computed_trace_id = None
        self._start = time.perf_counter()
        self.total_ms = None
        self.stages = []        # list[dict]: {stage, kind, duration_ms, status, count?}
        self.vendor_calls = []  # list[dict]: {name, duration_ms, http_status, retries, rate_limit}

    def add_stage(self, stage, kind, duration_ms, status, count=None):
        rec = {"stage": stage, "kind": kind,
               "duration_ms": round(duration_ms, 3), "status": status}
        if count is not None:
            rec["count"] = count
        self.stages.append(rec)

    def add_vendor_call(self, name, duration_ms, http_status=None, retries=0, rate_limit=None):
        self.vendor_calls.append({
            "name": name, "duration_ms": round(duration_ms, 3),
            "http_status": http_status, "retries": retries, "rate_limit": rate_limit})

    def finish(self):
        if self.total_ms is None:
            self.total_ms = round((time.perf_counter() - self._start) * 1000.0, 3)
        return self

    def timings_block(self) -> dict:
        """The verbose `meta.timings` block for this request."""
        return {
            "total_ms": self.total_ms if self.total_ms is not None else
                        round((time.perf_counter() - self._start) * 1000.0, 3),
            "stages": [dict(s) for s in self.stages],
            "vendor_calls": [dict(v) for v in self.vendor_calls],
        }


# ----------------------------------------------------------------------------- trace lifecycle
def new_trace(ticker: str, dims: dict):
    """Create a RequestTrace at serve entry, or None when instrumentation is disabled."""
    if not enabled():
        return None
    try:
        return RequestTrace(ticker, dims)
    except Exception:
        logger.debug("observability: new_trace failed", exc_info=True)
        return None


def set_current(trace):
    return _current_trace.set(trace)


def reset_current(token):
    try:
        _current_trace.reset(token)
    except Exception:
        logger.debug("observability: reset_current failed", exc_info=True)


def current():
    return _current_trace.get()


# ----------------------------------------------------------------------------- capture primitives
@contextmanager
def span(stage: str, count=None):
    """
    Time a pipeline stage into the current RequestTrace. Records status `ok`, or `error` if the
    wrapped block raises (then re-raises — the computation's own error is never swallowed). The
    bookkeeping itself is best-effort: a telemetry failure never affects the wrapped block.
    """
    trace = _current_trace.get()
    start = time.perf_counter()
    status = "ok"
    try:
        yield
    except Exception:
        status = "error"
        raise
    finally:
        try:
            if trace is not None:
                dur = (time.perf_counter() - start) * 1000.0
                trace.add_stage(stage, STAGE_KIND.get(stage, "serialize"), dur, status, count)
                logger.debug("trace stage trace_id=%s ticker=%s stage=%s kind=%s duration_ms=%.3f status=%s",
                             trace.trace_id, trace.ticker, stage, STAGE_KIND.get(stage), dur, status)
        except Exception:
            logger.debug("observability: span bookkeeping failed", exc_info=True)


def mark_skipped(stage: str) -> None:
    """Record a stage that deliberately did not run (e.g. off_exchange with dark_pool off)."""
    trace = _current_trace.get()
    if trace is None:
        return
    try:
        trace.add_stage(stage, STAGE_KIND.get(stage, "serialize"), 0.0, "skipped")
    except Exception:
        logger.debug("observability: mark_skipped failed", exc_info=True)


@contextmanager
def vendor_call(name: str):
    """
    Time one logical vendor call into the current trace (count + wall latency — captured at the
    call site, no adapter seam needed). Rate-limit headroom / http_status ride the optional
    adapter sink (see record_vendor_call); absent ⇒ left None ("unknown").
    """
    trace = _current_trace.get()
    start = time.perf_counter()
    try:
        yield
    finally:
        try:
            if trace is not None:
                dur = (time.perf_counter() - start) * 1000.0
                trace.add_vendor_call(name, dur)
        except Exception:
            logger.debug("observability: vendor_call bookkeeping failed", exc_info=True)


def record_vendor_call(name, duration_ms, http_status=None, retries=0, rate_limit=None) -> None:
    """Optional adapter-sink entry point: a normalized VendorCallMetric with vendor-specific fields."""
    trace = _current_trace.get()
    if trace is None:
        return
    try:
        trace.add_vendor_call(name, duration_ms, http_status, retries, rate_limit)
    except Exception:
        logger.debug("observability: record_vendor_call failed", exc_info=True)


# ----------------------------------------------------------------------------- aggregation + emit
def fold(trace) -> None:
    """Fold a finished trace into the process-local aggregate (call on the event loop)."""
    if trace is None or _aggregate is None:
        return
    try:
        trace.finish()
        _aggregate.fold(trace)
    except Exception:
        logger.debug("observability: fold failed", exc_info=True)


def emit_request_log(trace) -> None:
    """One additive, machine-parseable INFO summary line per request (carries the trace_id)."""
    if trace is None:
        return
    try:
        stage_str = ",".join(f"{s['stage']}:{s['duration_ms']}:{s['status']}" for s in trace.stages)
        logger.info("trace request trace_id=%s ticker=%s cache_hit=%s total_ms=%s "
                    "vendor_calls=%d stages=[%s] computed_trace_id=%s",
                    trace.trace_id, trace.ticker, trace.cache_hit, trace.total_ms,
                    len(trace.vendor_calls), stage_str, trace.computed_trace_id)
    except Exception:
        logger.debug("observability: emit_request_log failed", exc_info=True)


def readout() -> dict:
    """Read-only snapshot of the rolling aggregate. Side-effect-free (no compute, no vendor, no cache)."""
    if _aggregate is None:
        return {"instrumentation_enabled": False, "window": {"size_desc": "instrumentation disabled",
                "uptime_seconds": 0, "request_count": 0}, "global": _empty_section(),
                "per_ticker": {}, "recent_traces": []}
    try:
        return _aggregate.readout()
    except Exception:
        logger.debug("observability: readout failed", exc_info=True)
        return {"instrumentation_enabled": _ENABLED, "window": {"size_desc": "unavailable",
                "uptime_seconds": 0, "request_count": 0}, "global": _empty_section(),
                "per_ticker": {}, "recent_traces": []}


# ----------------------------------------------------------------------------- percentile helpers
def _pct(sorted_vals, p):
    """Linear-interpolated percentile (p in [0,1]) over a pre-sorted list; 0 on empty."""
    n = len(sorted_vals)
    if n == 0:
        return 0.0
    if n == 1:
        return round(sorted_vals[0], 3)
    k = (n - 1) * p
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return round(sorted_vals[int(k)], 3)
    return round(sorted_vals[f] * (c - k) + sorted_vals[c] * (k - f), 3)


def _empty_section() -> dict:
    return {
        "latency_total": {"p50_ms": 0, "p95_ms": 0, "max_ms": 0, "count": 0},
        "stages": [],
        "cache": {"hits": 0, "misses": 0, "hit_ratio": 0, "current_data_age_seconds": 0},
        "vendor": {"call_count": 0, "latency_p50_ms": 0, "latency_p95_ms": 0,
                   "min_rate_limit_headroom": None},
    }


def _section(summaries: list) -> dict:
    """Compute one readout section (global or a single ticker) over a list of trace summaries."""
    if not summaries:
        return _empty_section()

    totals = sorted(s["total_ms"] for s in summaries if s.get("total_ms") is not None)
    latency_total = {"p50_ms": _pct(totals, 0.5), "p95_ms": _pct(totals, 0.95),
                     "max_ms": round(max(totals), 3) if totals else 0, "count": len(totals)}

    # Per-stage roll-up in the fixed vocabulary order.
    stage_rows = []
    for stage in STAGES:
        durs, ok, err, skip, kind = [], 0, 0, 0, STAGE_KIND[stage]
        for s in summaries:
            for st in s["stages"]:
                if st["stage"] != stage:
                    continue
                kind = st["kind"]
                if st["status"] == "skipped":
                    skip += 1
                elif st["status"] == "error":
                    err += 1
                    durs.append(st["duration_ms"])
                else:
                    ok += 1
                    durs.append(st["duration_ms"])
        if ok == err == skip == 0:
            continue  # stage never appeared in this window
        sd = sorted(durs)
        stage_rows.append({
            "stage": stage, "kind": kind,
            "p50_ms": _pct(sd, 0.5), "p95_ms": _pct(sd, 0.95),
            "max_ms": round(max(sd), 3) if sd else 0,
            "count": ok + err + skip, "ok": ok, "error": err, "skipped": skip,
        })

    hits = sum(1 for s in summaries if s["cache_hit"])
    misses = len(summaries) - hits
    # current data age = the most recent request's served data age (last folded).
    last_age = next((s["cache_age_seconds"] for s in reversed(summaries)
                     if s.get("cache_age_seconds") is not None), 0)
    cache = {"hits": hits, "misses": misses,
             "hit_ratio": round(hits / len(summaries), 4) if summaries else 0,
             "current_data_age_seconds": last_age}

    vcalls = [v for s in summaries for v in s["vendor_calls"]]
    vdurs = sorted(v["duration_ms"] for v in vcalls)
    # Min rate-limit headroom = the tightest (lowest remaining) seen; None when no vendor exposes it.
    headrooms = [v["rate_limit"] for v in vcalls
                 if v.get("rate_limit") and v["rate_limit"].get("remaining") is not None]
    min_headroom = min(headrooms, key=lambda r: r["remaining"]) if headrooms else None
    vendor = {"call_count": len(vcalls),
              "latency_p50_ms": _pct(vdurs, 0.5), "latency_p95_ms": _pct(vdurs, 0.95),
              "min_rate_limit_headroom": min_headroom}

    return {"latency_total": latency_total, "stages": stage_rows, "cache": cache, "vendor": vendor}


class MetricsAggregate:
    """Process-local, ephemeral rolling window of trace summaries. Bounded; resets on restart."""

    def __init__(self, window_size: int, recent_size: int):
        self.window = deque(maxlen=window_size)   # list[summary dict]
        self.recent = deque(maxlen=recent_size)   # list[recent-trace row], newest first
        self.start_time = time.time()
        self.window_size = window_size

    def fold(self, trace: RequestTrace) -> None:
        self.window.append({
            "ticker": trace.ticker,
            "cache_hit": trace.cache_hit,
            "cache_age_seconds": trace.cache_age_seconds,
            "total_ms": trace.total_ms,
            "stages": trace.stages,
            "vendor_calls": trace.vendor_calls,
        })
        self.recent.appendleft({
            "trace_id": trace.trace_id, "ticker": trace.ticker, "dims": trace.dims,
            "cache_hit": trace.cache_hit, "cache_age_seconds": trace.cache_age_seconds,
            "total_ms": trace.total_ms, "computed_trace_id": trace.computed_trace_id,
        })

    def readout(self) -> dict:
        summaries = list(self.window)
        per_ticker: dict = {}
        by_ticker: dict = {}
        for s in summaries:
            by_ticker.setdefault(s["ticker"], []).append(s)
        for tkr, rows in by_ticker.items():
            per_ticker[tkr] = _section(rows)
        return {
            "instrumentation_enabled": _ENABLED,
            "window": {
                "size_desc": f"last ~{self.window_size} req",
                "uptime_seconds": int(time.time() - self.start_time),
                "request_count": len(summaries),
            },
            "global": _section(summaries),
            "per_ticker": per_ticker,
            "recent_traces": list(self.recent),
        }
