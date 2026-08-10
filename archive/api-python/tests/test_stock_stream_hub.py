"""
The shared stock-stream multiplexer (2026-08-06).

Risk-based. The whole point of this change is a resource count, so the tests are mostly about
counting — plus the two ways a refcounted shared resource goes wrong in production.

  1. **N tickers cost ONE connection.** If this regresses, nothing breaks visibly; you just quietly
     go back to burning connections and hit the vendor's cap again.
  2. **Messages reach the right symbol, and only it.** A routing bug on a shared socket shows up as
     one ticker displaying another's price — a wrong number that looks like a real quote.
  3. **Subscriptions are released.** The failure is a leak: a symbol nobody watches still costs a
     subscription, and the socket never closes.

Also pinned: the socket closes when the last subscriber leaves, a symbol survives while *any*
watcher remains, and the bounded queue drops the OLDEST rather than blocking the socket's callback.
"""
from __future__ import annotations

import asyncio

from src.providers.stock_stream_hub import QUEUE_MAXSIZE, StockStreamHub


class FakeSocket:
    """Records channel subscriptions and lifecycle; never touches a network."""

    def __init__(self):
        self.channels: set[str] = set()
        self.closed = False
        self.connect_calls = 0
        self.processor = None

    def subscribe(self, *chans):
        self.channels.update(chans)

    def unsubscribe(self, *chans):
        self.channels.difference_update(chans)

    async def connect(self, processor):
        self.connect_calls += 1
        self.processor = processor
        await asyncio.Event().wait()   # the SDK's connect blocks; so does this

    async def close(self):
        self.closed = True


def _hub():
    """Returns (hub, sockets) — `sockets` grows by one per socket the hub opens, which is the
    number the whole feature is about."""
    sockets: list[FakeSocket] = []

    def open_socket():
        s = FakeSocket()
        sockets.append(s)
        return s

    def decode(m):
        return (m["sym"], {"kind": "quote", "px": m["px"]}) if m.get("sym") else None

    return StockStreamHub(open_socket=open_socket, decode=decode, label="test"), sockets


async def _watch(hub, symbol):
    """Start a subscriber and let its attach complete.

    An async generator does not execute until first iterated, and this one blocks on an empty queue
    at its first yield — so priming it with `asend(None)` would hang. Driving it from a task and
    yielding the loop once is the honest way to reach the attached-and-waiting state the tests care
    about. Returns (task, received-list, close-coroutine-factory)."""
    received: list = []

    async def pump():
        async for ev in hub.stream(symbol):
            received.append(ev)

    task = asyncio.create_task(pump())
    await asyncio.sleep(0)          # let the generator attach and park on queue.get()
    await asyncio.sleep(0)
    return task, received


async def _stop(*tasks):
    for t in tasks:
        t.cancel()
    for t in tasks:
        try:
            await t
        except asyncio.CancelledError:
            pass
    await asyncio.sleep(0)          # let each generator's finally run its detach


async def _settle():
    for _ in range(3):
        await asyncio.sleep(0)



# --------------------------------------------------------------------- 1. the connection count

def test_many_symbols_open_exactly_one_socket():
    async def run():
        hub, sockets = _hub()
        tasks = []
        for sym in ("SPY", "NVDA", "AAPL", "TSLA", "QQQ"):
            t, _ = await _watch(hub, sym)
            tasks.append(t)
        assert len(sockets) == 1, f"opened {len(sockets)} sockets for 5 symbols"
        assert sockets[0].connect_calls == 1
        assert hub.symbol_count == 5
        assert sockets[0].channels == {
            "Q.SPY", "T.SPY", "Q.NVDA", "T.NVDA", "Q.AAPL", "T.AAPL",
            "Q.TSLA", "T.TSLA", "Q.QQQ", "T.QQQ"}
        await _stop(*tasks)
    asyncio.run(run())


def test_two_watchers_of_the_same_symbol_subscribe_once():
    async def run():
        hub, sockets = _hub()
        a, _ = await _watch(hub, "SPY")
        b, _ = await _watch(hub, "SPY")
        assert len(sockets) == 1
        assert hub.symbol_count == 1
        assert sockets[0].channels == {"Q.SPY", "T.SPY"}
        await _stop(a)
        await _settle()
        assert sockets[0].channels == {"Q.SPY", "T.SPY"}, "dropped a symbol another watcher held"
        assert not sockets[0].closed
        await _stop(b)
    asyncio.run(run())


# --------------------------------------------------------------------- 2. routing

def test_a_message_reaches_only_its_own_symbol():
    async def run():
        hub, sockets = _hub()
        spy_t, spy_rx = await _watch(hub, "SPY")
        nvda_t, nvda_rx = await _watch(hub, "NVDA")

        await sockets[0].processor([{"sym": "SPY", "px": 500.0}])
        await _settle()
        assert spy_rx == [{"kind": "quote", "px": 500.0}]
        assert nvda_rx == [], "NVDA received SPY's tick — a cross-wired price looks like a real one"

        await sockets[0].processor([{"sym": "NVDA", "px": 120.0}])
        await _settle()
        assert nvda_rx == [{"kind": "quote", "px": 120.0}]
        assert len(spy_rx) == 1
        await _stop(spy_t, nvda_t)
    asyncio.run(run())


def test_both_watchers_of_one_symbol_each_get_the_tick():
    async def run():
        hub, sockets = _hub()
        a, a_rx = await _watch(hub, "SPY")
        b, b_rx = await _watch(hub, "SPY")
        await sockets[0].processor([{"sym": "SPY", "px": 501.5}])
        await _settle()
        assert a_rx == b_rx == [{"kind": "quote", "px": 501.5}]
        await _stop(a, b)
    asyncio.run(run())


def test_an_undecodable_message_is_skipped_not_fatal():
    async def run():
        hub, sockets = _hub()
        t, rx = await _watch(hub, "SPY")
        await sockets[0].processor([{"sym": None}, {"sym": "SPY", "px": 7.0}])
        await _settle()
        assert rx == [{"kind": "quote", "px": 7.0}]
        await _stop(t)
    asyncio.run(run())


# --------------------------------------------------------------------- 3. release + lifecycle

def test_the_last_subscriber_leaving_closes_the_socket():
    async def run():
        hub, sockets = _hub()
        t, _ = await _watch(hub, "SPY")
        assert hub.socket_open
        await _stop(t)
        await _settle()
        assert hub.symbol_count == 0
        assert sockets[0].closed, "the socket outlived its last subscriber"
        assert not hub.socket_open
    asyncio.run(run())


def test_a_symbol_is_unsubscribed_when_its_last_watcher_leaves():
    async def run():
        hub, sockets = _hub()
        spy_t, _ = await _watch(hub, "SPY")
        nvda_t, _ = await _watch(hub, "NVDA")
        await _stop(spy_t)
        await _settle()
        assert sockets[0].channels == {"Q.NVDA", "T.NVDA"}
        assert not sockets[0].closed, "closed the socket while NVDA was still watched"
        await _stop(nvda_t)
    asyncio.run(run())


def test_a_new_subscriber_after_a_full_teardown_opens_a_fresh_socket():
    async def run():
        hub, sockets = _hub()
        first, _ = await _watch(hub, "SPY")
        await _stop(first)
        await _settle()
        second, _ = await _watch(hub, "SPY")
        assert len(sockets) == 2, "did not reopen after a clean teardown"
        assert hub.socket_open
        await _stop(second)
    asyncio.run(run())


# --------------------------------------------------------------------- the bounded queue

def test_overflow_drops_the_OLDEST_and_never_blocks_the_socket():
    """A wedged consumer must not stall the shared callback — on a shared socket that would stall
    every OTHER symbol too, which is the failure sharing introduces."""
    async def run():
        hub, sockets = _hub()
        # Attach WITHOUT draining: subscribe a queue directly so nothing consumes it.
        import asyncio as _a
        q: _a.Queue = _a.Queue(maxsize=QUEUE_MAXSIZE)
        await hub._attach("SPY", q)
        await _settle()          # let the connect task register its processor callback

        overflow = QUEUE_MAXSIZE + 50
        await sockets[0].processor([{"sym": "SPY", "px": float(i)} for i in range(overflow)])

        assert q.qsize() == QUEUE_MAXSIZE, "queue grew past its bound"
        first = q.get_nowait()
        assert first["px"] >= overflow - QUEUE_MAXSIZE - 1, "kept the stalest tick"
        await hub._detach("SPY", q)
    asyncio.run(run())


# --------------------------------------------------------------------- tape instrumentation

def test_tape_stats_count_messages_per_symbol_and_survive_an_empty_hub():
    """The always-on decision rests on these numbers, so a silently-zero counter would be worse
    than no instrumentation at all — it would read as 'the tape is cheap'."""
    async def run():
        hub, sockets = _hub()
        assert hub.tape_stats()["messages_total"] == 0        # empty hub must not raise

        spy_t, _ = await _watch(hub, "SPY")
        nvda_t, _ = await _watch(hub, "NVDA")
        await sockets[0].processor(
            [{"sym": "SPY", "px": float(i)} for i in range(30)]
            + [{"sym": "NVDA", "px": 1.0}])
        await _settle()

        st = hub.tape_stats()
        assert st["messages_total"] == 31
        assert st["symbols_subscribed"] == 2
        assert st["socket_open"] is True
        top = {r["symbol"]: r["messages"] for r in st["top_symbols"]}
        assert top["SPY"] == 30 and top["NVDA"] == 1
        # Busiest first — the always-on cost is driven by the top of this list, not the mean.
        assert st["top_symbols"][0]["symbol"] == "SPY"
        assert st["messages_per_second"] > 0
        assert st["decode_load_pct"] >= 0.0
        await _stop(spy_t, nvda_t)
    asyncio.run(run())


def test_dropped_messages_are_counted_not_hidden():
    """A drop means a consumer could not keep up. If that is happening, the operator must see it —
    silently dropping ticks while reporting a healthy rate is the worst of both."""
    async def run():
        hub, sockets = _hub()
        q: asyncio.Queue = asyncio.Queue(maxsize=QUEUE_MAXSIZE)
        await hub._attach("SPY", q)
        await _settle()
        await sockets[0].processor(
            [{"sym": "SPY", "px": float(i)} for i in range(QUEUE_MAXSIZE + 25)])
        assert hub.tape_stats()["messages_dropped"] == 25
        await hub._detach("SPY", q)
    asyncio.run(run())
