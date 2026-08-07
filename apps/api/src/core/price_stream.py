"""
Multi-symbol LIVE PRICE fan-out for the scanner (2026-08-06).

**Why this is not `LiveSession`.** The obvious move — point each scanner row at `/api/stream/{t}` —
would be a disaster: `LiveSession` is far more than a price feed. It holds a rolling trade window,
recomputes net flow, and runs `_chain_loop`, which re-fetches the **option chain** over REST every
`chain_refresh` seconds. Twenty scanner rows would mean twenty chain-refresh loops. The scanner
wants the cheapest thing the vendor sends — a quote — and nothing else.

**What this is.** One consumer per requested symbol over `provider.stream_stock`, which already
multiplexes onto ONE shared vendor socket (`providers/stock_stream_hub`). Latest price per symbol is
kept in memory and flushed to the client on a throttle, so a fast tape cannot flood the SSE
connection. No chain, no greeks, no flow, no scoring — this touches nothing on the scoring path
(`additive-keeps-score-byte-identical`).

**Degradation** (`best-effort-isolated-or-null`): a symbol that never ticks simply never appears in
a payload; the row keeps the polled price the sweep gave it. A provider fault kills that symbol's
consumer task and the others carry on. Nothing here raises into the request.

**What the client may conclude** (`live-vs-static-isolation`): a price from this stream is
LIVE-DERIVED and must degrade visibly when the stream drops. Everything else on a scanner row —
score, tier, flip, walls — is STATIC, comes from the sweep, and keeps rendering untouched.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import AsyncIterator, Iterable

logger = logging.getLogger("Convexa")

# Hard cap on symbols per connection. Sized above the curated universe (69) with headroom, and
# present so a hand-rolled query string cannot ask the process to hold arbitrary state.
MAX_SYMBOLS = 120

# Minimum seconds between flushes to one client. The tape can tick many times a second per symbol;
# the scanner is a glanceable table, not a tape reader.
DEFAULT_THROTTLE = 1.0


class PriceStream:
    """Fan-in from N per-symbol tick generators, fan-out as one throttled batch to one client."""

    def __init__(self, provider, *, throttle: float = DEFAULT_THROTTLE) -> None:
        self._provider = provider
        self._throttle = throttle

    async def stream(self, symbols: Iterable[str]) -> AsyncIterator[dict]:
        """
        Yields `{"prices": {SYM: {"price": float, "ts": int}}, "as_of": epoch}` — only symbols whose
        price CHANGED since the previous flush, so a quiet tape costs nothing on the wire.
        """
        syms = _clean(symbols)
        if not syms:
            return

        latest: dict[str, dict] = {}
        dirty: set[str] = set()
        tasks: list[asyncio.Task] = []

        async def consume(sym: str) -> None:
            try:
                async for ev in self._provider.stream_stock(sym):
                    price = _price_of(ev)
                    if price is None:
                        continue
                    prev = latest.get(sym)
                    if prev is not None and prev["price"] == price:
                        continue          # unchanged; do not mark dirty
                    latest[sym] = {"price": price, "ts": ev.get("ts", 0) or 0}
                    dirty.add(sym)
            except asyncio.CancelledError:
                raise
            except Exception:
                # One symbol's feed failing must not take the others down with it.
                logger.warning("[price-stream] %s consumer stopped", sym, exc_info=False)

        for s in syms:
            tasks.append(asyncio.create_task(consume(s)))

        try:
            while True:
                await asyncio.sleep(self._throttle)
                if not dirty:
                    continue
                batch = {s: latest[s] for s in dirty if s in latest}
                dirty.clear()
                if batch:
                    yield {"prices": batch, "as_of": int(time.time())}
        finally:
            for t in tasks:
                t.cancel()
            # Let each generator's finally run so the hub detaches every subscription; without this
            # a disconnect would leak symbol subscriptions on the shared socket.
            await asyncio.gather(*tasks, return_exceptions=True)


def _clean(symbols: Iterable[str]) -> list[str]:
    """Upper-case, de-duplicate, drop anything that is not a plain ticker, and cap the count.
    Order is preserved so the cap is predictable rather than arbitrary."""
    out: list[str] = []
    seen: set[str] = set()
    for raw in symbols:
        s = (raw or "").strip().upper()
        if not s or len(s) > 8 or not s.replace(".", "").replace("-", "").isalnum():
            continue
        if s in seen:
            continue
        seen.add(s)
        out.append(s)
        if len(out) >= MAX_SYMBOLS:
            break
    return out


def _price_of(ev) -> float | None:
    """A trade price is the truth when we have one; otherwise the NBBO mid, matching the anchor rule
    the rest of the app uses (`live-spot=NBBO-mid`, with last-trade as a display-only sibling)."""
    kind = ev.get("kind")
    if kind == "trade":
        p = ev.get("price") or 0.0
        return float(p) if p > 0 else None
    if kind == "quote":
        bid, ask = ev.get("bid") or 0.0, ev.get("ask") or 0.0
        if bid > 0 and ask > 0:
            return round((bid + ask) / 2.0, 4)
    return None
