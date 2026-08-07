"""
One vendor WebSocket, many symbol subscriptions (2026-08-06).

**The problem.** `stream_stock(ticker)` used to construct a `WebSocketClient` per call, so N watched
tickers cost N connections. Vendors of this family meter **connections**, not symbols — a single
socket carries as many `Q.`/`T.` channels as you subscribe it to. The old shape spent the scarce
resource on the abundant one, and `LiveHub`'s `max_sessions=50` ceiling existed precisely because
each session held its own socket.

**The shape now.** One socket per provider instance. A symbol→subscriber registry fans each decoded
message out to every generator watching that symbol. The socket opens on the first subscriber and
closes when the last one leaves; a symbol is subscribed on its first watcher and unsubscribed on its
last, so an idle symbol costs nothing.

**Deliberately unchanged:** `stream_stock`'s signature and its contract — an async generator that
yields until the consumer stops iterating, and tears its own subscription down on close. Nothing in
`LiveSession` or the SSE path needed to change.

**Deliberate behaviour change, called out because it is a change:** each subscriber's queue is now
BOUNDED and drops the OLDEST tick under overflow. Previously the queue was unbounded, so one stalled
consumer could grow it without limit. On a shared socket that risk is worse (a stall no longer costs
only its own connection), and for a quote feed the newest tick is the only one that matters — a
dropped stale quote is strictly better than unbounded memory.

**Known consequence of sharing:** a reconnect now affects every watcher at once rather than one. The
vendor SDK owns reconnect and re-subscribes its channel set, so this is a widened blast radius
rather than a new failure mode — but it is the reason the socket lifecycle is logged loudly.

Provider-agnostic and fully injectable (`open_socket`, `decode`) so the routing, refcounting and
lifecycle are testable with no key, no network, and no vendor SDK.
"""
from __future__ import annotations

import asyncio
import logging
from typing import AsyncIterator, Callable, Optional

logger = logging.getLogger("Convexa")

# Per-subscriber backlog. Deep enough to absorb a burst, shallow enough that a wedged consumer
# cannot hold meaningful memory. Overflow drops the OLDEST (see module docstring).
QUEUE_MAXSIZE = 256


class StockStreamHub:
    """
    Multiplexes one vendor stock WebSocket across many symbol subscriptions.

    `open_socket()` returns a client exposing `subscribe(*channels)`, `unsubscribe(*channels)`,
    `connect(processor)` (awaitable) and `close()` (awaitable).
    `decode(msg)` returns `(SYMBOL, event)` or `None` for a message this hub does not care about.
    """

    def __init__(self, *, open_socket: Callable[[], object],
                 decode: Callable[[object], Optional[tuple]],
                 label: str = "stocks") -> None:
        self._open_socket = open_socket
        self._decode = decode
        self._label = label
        self._subs: dict[str, set[asyncio.Queue]] = {}
        self._ws = None
        self._task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------ public

    @property
    def symbol_count(self) -> int:
        return len(self._subs)

    @property
    def socket_open(self) -> bool:
        return self._ws is not None

    async def stream(self, symbol: str) -> AsyncIterator:
        """Per-symbol view of the shared socket. Same contract as the old per-ticker generator."""
        sym = symbol.upper()
        queue: asyncio.Queue = asyncio.Queue(maxsize=QUEUE_MAXSIZE)
        await self._attach(sym, queue)
        try:
            while True:
                yield await queue.get()
        finally:
            # Runs on consumer close AND on cancellation — the only place a subscription is
            # released, so a generator that is never closed is the one way to leak one.
            await self._detach(sym, queue)

    # ------------------------------------------------------------------ internals

    async def _attach(self, sym: str, queue: asyncio.Queue) -> None:
        async with self._lock:
            first_ever = not self._subs
            first_for_symbol = sym not in self._subs
            self._subs.setdefault(sym, set()).add(queue)

            if first_ever:
                self._ws = self._open_socket()
                self._task = asyncio.create_task(self._ws.connect(self._processor))
                logger.info("[stream/%s] opened ONE shared socket", self._label)

            if first_for_symbol:
                self._ws.subscribe(f"Q.{sym}", f"T.{sym}")
                logger.info("[stream/%s] +%s (%d symbol(s) on one socket)",
                            self._label, sym, len(self._subs))

    async def _detach(self, sym: str, queue: asyncio.Queue) -> None:
        async with self._lock:
            holders = self._subs.get(sym)
            if holders is None:
                return
            holders.discard(queue)
            if holders:
                return                      # other watchers remain; keep the subscription
            self._subs.pop(sym, None)
            try:
                if self._ws is not None:
                    self._ws.unsubscribe(f"Q.{sym}", f"T.{sym}")
            except Exception:
                logger.warning("[stream/%s] unsubscribe %s failed", self._label, sym,
                               exc_info=False)
            logger.info("[stream/%s] -%s (%d left)", self._label, sym, len(self._subs))

            if not self._subs:
                await self._close_locked()

    async def _close_locked(self) -> None:
        task, ws = self._task, self._ws
        self._task, self._ws = None, None
        if task is not None:
            task.cancel()
        if ws is not None:
            try:
                await ws.close()
            except Exception:
                pass
        logger.info("[stream/%s] last subscriber left -> socket closed", self._label)

    async def _processor(self, msgs) -> None:
        """The single callback for the whole socket: decode, then route by symbol."""
        for m in msgs:
            try:
                decoded = self._decode(m)
            except Exception:
                continue
            if decoded is None:
                continue
            sym, event = decoded
            for q in self._subs.get(sym, ()):  # snapshot-free: set is only mutated under the lock
                if q.full():
                    try:
                        q.get_nowait()        # drop the OLDEST; newest tick wins
                    except asyncio.QueueEmpty:
                        pass
                q.put_nowait(event)
