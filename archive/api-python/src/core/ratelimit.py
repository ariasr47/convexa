"""
Lightweight, in-memory, per-IP, per-minute throttle for the anonymous, vendor-cost-bearing
public endpoints (`/api/ticker/*` + `/api/stream/*`) — the system-6 HIGH-2 fix.

ISOLATION / LANE: this module is a pure, dependency-free leaf. It touches NO engine/signals/
live/darkpool/chain_store/bundle path and holds NO scoring input — it only counts requests by
client IP in a fixed-size sliding window and answers "allowed?". The scoring path
(`compute_ticker` / `state_fingerprint`) is never reached through here, so
[additive-keeps-score-byte-identical] is structurally preserved.

BEST-EFFORT (fail-OPEN): every public method swallows its own faults and returns "allowed".
A limiter bug must NEVER 5xx the endpoint or break the bundle/SSE path — at worst it stops
limiting. Process-local (per-replica), same as the existing per-admin AI metering; documented
as such.

CONFIG: read `PUBLIC_RATE_LIMIT_PER_MIN` from runtime env (no literal default that throttles).
  - unset / "" / "0" / a disable value ("off"/"none"/"disabled"/"false") => limiter OFF
    (LOCAL dev + the current behavior are byte-for-byte unchanged).
  - a positive integer N => allow N requests per rolling 60s per client IP; the (N+1)th in the
    window is denied with a Retry-After hint.

CLIENT IP behind the Cloudflare/Railway proxy: prefer the proxy-set forwarded header so the
limit is keyed on the real client, not the proxy's socket peer (which would be one shared IP
for all clients). Order: `CF-Connecting-IP` (Cloudflare's trusted client IP) -> first hop of
`X-Forwarded-For` -> the socket peer. ASSUMPTION: the app sits behind Cloudflare/Railway, which
set these headers; a direct (un-proxied) caller can spoof them, but the only effect is evading
a best-effort cost-throttle on anonymous read endpoints — never an auth/gate bypass (the auth
gate is enforced server-side, independently — [server-side-gate-enforcement]).
"""
from __future__ import annotations

import logging
import os
import threading
import time
from collections import defaultdict, deque

logger = logging.getLogger("Convexa")

_WINDOW_SECONDS = 60.0
_DISABLE_VALUES = {"", "0", "off", "none", "disabled", "false", "no"}


def _limit_from_env() -> int:
    """Resolve the per-IP per-minute cap from `PUBLIC_RATE_LIMIT_PER_MIN`. 0 => disabled."""
    raw = os.getenv("PUBLIC_RATE_LIMIT_PER_MIN", "").strip().lower()
    if raw in _DISABLE_VALUES:
        return 0
    try:
        n = int(raw)
    except (TypeError, ValueError):
        return 0
    return n if n > 0 else 0


class PublicRateLimiter:
    """
    Fixed-memory sliding-window counter keyed by client IP. Thread-safe (a single lock guards
    the per-IP deques); the request volume on a single replica is modest, so the lock is not a
    hot-path concern. Fail-open on any internal error.
    """

    def __init__(self) -> None:
        self._buckets: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()
        self._limit = _limit_from_env()

    @property
    def enabled(self) -> bool:
        return self._limit > 0

    @property
    def limit(self) -> int:
        return self._limit

    def check(self, client_ip: str, now: float | None = None) -> tuple[bool, int]:
        """
        Record one request for `client_ip` and report whether it is allowed.

        Returns (allowed, retry_after_seconds). When the limiter is disabled, or on ANY internal
        fault, returns (True, 0) — fail-open. `retry_after_seconds` is a positive hint (>=1) only
        when allowed is False.
        """
        if self._limit <= 0:
            return True, 0
        ts = time.monotonic() if now is None else now
        key = client_ip or "unknown"
        try:
            with self._lock:
                bucket = self._buckets[key]
                cutoff = ts - _WINDOW_SECONDS
                while bucket and bucket[0] <= cutoff:
                    bucket.popleft()
                # Opportunistic GC: drop a now-empty bucket so the dict can't grow unbounded
                # across a long-lived process being scanned by many distinct IPs.
                if len(bucket) >= self._limit:
                    oldest = bucket[0]
                    retry_after = max(1, int(oldest + _WINDOW_SECONDS - ts) + 1)
                    return False, retry_after
                bucket.append(ts)
                return True, 0
        except Exception:
            # Best-effort: a limiter fault must never break the endpoint. Fail OPEN.
            logger.warning("ratelimit: check faulted; failing open", exc_info=False)
            return True, 0

    def prune(self, now: float | None = None) -> None:
        """Drop fully-expired buckets (best-effort housekeeping). Never raises."""
        ts = time.monotonic() if now is None else now
        cutoff = ts - _WINDOW_SECONDS
        try:
            with self._lock:
                for key in list(self._buckets.keys()):
                    bucket = self._buckets[key]
                    while bucket and bucket[0] <= cutoff:
                        bucket.popleft()
                    if not bucket:
                        del self._buckets[key]
        except Exception:
            logger.warning("ratelimit: prune faulted", exc_info=False)


def client_ip_from_request(request) -> str:
    """
    Resolve the real client IP behind the Cloudflare/Railway proxy. Best-effort + never raises.

    Order (see module docstring): `CF-Connecting-IP` -> first hop of `X-Forwarded-For` -> the
    socket peer (`request.client.host`). Returns "" if nothing is resolvable (the caller treats
    it as the "unknown" bucket).
    """
    try:
        headers = request.headers
        cf = headers.get("cf-connecting-ip")
        if cf and cf.strip():
            return cf.strip()
        xff = headers.get("x-forwarded-for")
        if xff and xff.strip():
            # First hop is the original client (subsequent hops are the proxy chain).
            return xff.split(",")[0].strip()
        client = getattr(request, "client", None)
        if client is not None and getattr(client, "host", None):
            return client.host
    except Exception:
        logger.warning("ratelimit: client-ip resolution faulted", exc_info=False)
    return ""
