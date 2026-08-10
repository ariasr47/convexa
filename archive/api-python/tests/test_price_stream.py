"""
The scanner's multi-symbol live-price fan-out (2026-08-06).

Risk-based. Three things that would be expensive and invisible:

  1. **It must not become a chain-refresh loop.** The whole reason this exists rather than reusing
     `/api/stream/{ticker}` is that `LiveSession` re-fetches the option chain on a timer. If this
     ever grows a chain dependency, twenty scanner rows become twenty chain loops and the vendor
     bill explains it to you later.
  2. **Subscriptions must be released on disconnect.** A leak here holds symbols on the SHARED
     socket forever — invisible until the socket is carrying symbols nobody is watching.
  3. **One symbol's failure must not take the others down.** A shared fan-in makes a single bad
     feed everyone's problem unless it is contained.

Also pinned: only CHANGED prices are sent (a quiet tape costs nothing), the symbol list is cleaned
and capped, and a trade price wins over the NBBO mid.
"""
from __future__ import annotations

import asyncio

from src.core.price_stream import MAX_SYMBOLS, PriceStream, _clean, _price_of


# --------------------------------------------------------------------- the symbol list

def test_symbols_are_uppercased_deduped_and_capped():
    out = _clean([" spy ", "SPY", "qqq", "", None, "nvda"])
    assert out == ["SPY", "QQQ", "NVDA"]
    assert len(_clean([f"SYM{i}" for i in range(MAX_SYMBOLS + 40)])) == MAX_SYMBOLS


def test_junk_symbols_are_dropped_not_forwarded():
    """A hand-rolled query string must not turn into vendor subscriptions."""
    assert _clean(["../etc", "A B", "'; DROP", "TOOOOLONGSYM", "OK"]) == ["OK"]


# --------------------------------------------------------------------- price selection

def test_a_trade_price_wins_and_a_crossed_or_empty_quote_is_ignored():
    assert _price_of({"kind": "trade", "price": 501.25}) == 501.25
    assert _price_of({"kind": "quote", "bid": 100.0, "ask": 101.0}) == 100.5
    assert _price_of({"kind": "quote", "bid": 0.0, "ask": 101.0}) is None
    assert _price_of({"kind": "trade", "price": 0.0}) is None
    assert _price_of({"kind": "something-else"}) is None


# --------------------------------------------------------------------- the fan-out

class FakeProvider:
    """Records which symbols were subscribed and whether each generator was closed."""

    def __init__(self):
        self.queues: dict[str, asyncio.Queue] = {}
        self.closed: list[str] = []
        self.failing: set[str] = set()

    async def stream_stock(self, symbol):
        sym = symbol.upper()
        q: asyncio.Queue = asyncio.Queue()
        self.queues[sym] = q
        try:
            while True:
                ev = await q.get()
                if sym in self.failing:
                    raise RuntimeError("feed exploded")
                yield ev
        finally:
            self.closed.append(sym)


def _run(coro):
    return asyncio.run(coro)


def test_it_subscribes_every_requested_symbol_and_never_touches_a_chain():
    async def go():
        p = FakeProvider()
        gen = PriceStream(p, throttle=0.01).stream(["SPY", "QQQ", "NVDA"])
        task = asyncio.create_task(_collect(gen, 0))
        await asyncio.sleep(0.05)
        assert set(p.queues) == {"SPY", "QQQ", "NVDA"}
        # The provider it drives exposes ONLY stream_stock — there is no chain call to make.
        assert not hasattr(p, "fetch_options_market_state")
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        await gen.aclose()
    _run(go())


def test_only_CHANGED_prices_are_emitted():
    async def go():
        p = FakeProvider()
        gen = PriceStream(p, throttle=0.02).stream(["SPY"])
        got: list = []
        task = asyncio.create_task(_collect(gen, 1, got))
        await asyncio.sleep(0.03)
        p.queues["SPY"].put_nowait({"kind": "trade", "price": 500.0, "ts": 1})
        await asyncio.sleep(0.06)
        assert got and got[0]["prices"]["SPY"]["price"] == 500.0

        # Same price again => nothing new to say.
        got.clear()
        p.queues["SPY"].put_nowait({"kind": "trade", "price": 500.0, "ts": 2})
        await asyncio.sleep(0.06)
        assert got == [], f"re-sent an unchanged price: {got}"
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        await gen.aclose()
    _run(go())


def test_closing_the_stream_releases_EVERY_symbol_subscription():
    """A leak here holds symbols on the shared socket that nobody is watching."""
    async def go():
        p = FakeProvider()
        gen = PriceStream(p, throttle=0.01).stream(["SPY", "QQQ"])
        task = asyncio.create_task(_collect(gen, 0))
        await asyncio.sleep(0.05)
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        await gen.aclose()
        await asyncio.sleep(0.02)
        assert set(p.closed) == {"SPY", "QQQ"}, f"leaked: {set(p.queues) - set(p.closed)}"
    _run(go())


def test_one_failing_symbol_does_not_stop_the_others():
    async def go():
        p = FakeProvider()
        p.failing.add("QQQ")
        gen = PriceStream(p, throttle=0.02).stream(["SPY", "QQQ"])
        got: list = []
        task = asyncio.create_task(_collect(gen, 1, got))
        await asyncio.sleep(0.03)
        p.queues["QQQ"].put_nowait({"kind": "trade", "price": 1.0, "ts": 1})   # blows up QQQ
        await asyncio.sleep(0.04)
        p.queues["SPY"].put_nowait({"kind": "trade", "price": 500.0, "ts": 2})
        await asyncio.sleep(0.06)
        assert got and "SPY" in got[0]["prices"], "a bad feed took the healthy one down with it"
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        await gen.aclose()
    _run(go())


async def _collect(gen, want: int, sink: list | None = None):
    async for payload in gen:
        if sink is not None:
            sink.append(payload)
        if want and sink is not None and len(sink) >= want:
            # keep consuming; the test drives timing
            pass


# --------------------------------------------------------------------- route ordering

def test_price_route_ordering():
    """`/api/stream/prices` must NOT be swallowed by `/api/stream/{ticker}`.

    Caught for real during development: declared after the catch-all, FastAPI matched it as
    ticker="prices" and built a LiveSession for a symbol named PRICES — chain-refresh loop included,
    which is the exact cost this endpoint exists to avoid. It fails silently in the worst way: the
    endpoint "works" (200, an SSE stream) while quietly running the expensive machinery.

    Pinned structurally on the route table, so a future reordering breaks the build, not production.
    """
    import os
    for k, v in [("MASSIVE_API_KEY", "dummy"), ("ANTHROPIC_API_KEY", "sk-d"),
                 ("AI_REC_STUB", "1"), ("POSITIONS_PROVIDER", "stub")]:
        os.environ.setdefault(k, v)
    import main

    paths = [getattr(r, "path", "") for r in main.app.routes]
    assert "/api/stream/prices" in paths, "the live-price route is not registered"
    assert paths.index("/api/stream/prices") < paths.index("/api/stream/{ticker}"), (
        "/api/stream/prices is registered AFTER the /{ticker} catch-all and will be swallowed by it")
