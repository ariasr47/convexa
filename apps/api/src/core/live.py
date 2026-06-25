"""
Real-time layer: live spot, order flow, and live GEX levels for ONE active ticker.

Architecture (see plan): the options chain is REST-polled slowly; the spot streams live over
the stock WebSocket. Each LiveSession holds a live NBBO + a rolling window of signed trades
(net flow), periodically refreshes the cached option chain, and on a throttle reprices the
gamma levels at the live mid via QuantEngine.compute_levels_at_spot. Payloads fan out to SSE
subscriber queues. LiveHub keeps exactly one session per ticker, ref-counted by subscribers.
"""
import asyncio
import time
import logging
import zoneinfo
from collections import deque
from datetime import datetime

from src.core import chain_store

logger = logging.getLogger("GammaFlowAsync")

# A spot is "live" only if a Q/T tick arrived within this many seconds; otherwise it's a
# stale last-known value (market closed, or the feed doesn't cover this session).
LIVE_TICK_MAX_AGE = 30.0

_ET = zoneinfo.ZoneInfo("America/New_York")


def classify_session() -> str:
    """
    Current US-equities session in exchange time, so the UI can explain *why* there are no
    live ticks rather than just showing a frozen price:
      premarket  4:00-9:30   | regular 9:30-16:00 | afterhours 16:00-20:00  (Massive covers these)
      overnight  20:00-4:00  -> NOT covered by Massive (Blue Ocean ATS territory)
      closed     weekend
    Note: no holiday calendar -- a market holiday reads as its weekday session (the UI then
    shows "no live ticks", which is acceptable).
    """
    now = datetime.now(_ET)
    wd, hm = now.weekday(), now.hour * 60 + now.minute  # wd: 0=Mon..6=Sun
    if wd == 5:                       # Saturday
        return "closed"
    if wd == 6 and hm < 20 * 60:      # Sunday before the 8pm overnight open
        return "closed"
    if 4 * 60 <= hm < 9 * 60 + 30:
        return "premarket"
    if 9 * 60 + 30 <= hm < 16 * 60:
        return "regular"
    if 16 * 60 <= hm < 20 * 60:
        return "afterhours"
    return "overnight"               # 20:00-04:00 -- outside Massive coverage


class LiveSession:
    def __init__(self, ticker, provider, engine, *, flow_window, throttle, chain_refresh):
        self.ticker = ticker
        self.provider = provider
        self.engine = engine
        self.flow_window = flow_window      # seconds of trades kept for rolling net flow
        self.throttle = throttle            # seconds between broadcasts
        self.chain_refresh = chain_refresh  # seconds between option-chain REST refreshes

        # Live NBBO + derived spot.
        self.bid = self.ask = 0.0
        self.bid_size = self.ask_size = 0.0
        self.mid = 0.0
        self.spot_ts = 0                    # ns of last quote
        self.last_tick_wall = None          # wall-clock secs of the last Q/T actually received

        # Rolling signed-trade flow: deque of (ts_seconds, signed_size).
        self.trades: deque = deque()
        self.last_trade_price = None
        self.buy_vol = 0.0
        self.sell_vol = 0.0

        # Cached priced option contracts (refreshed on the slow chain loop).
        self.contracts: list = []

        # subscriber queue -> filter tuple (min_dte, max_dte, expirations_tuple)
        self.subscribers: dict = {}
        self._tasks: list = []
        self._stopped = asyncio.Event()

    # --- lifecycle ---------------------------------------------------------
    async def start(self):
        await self._refresh_chain()   # initial chain + seed mid from snapshot
        await self._seed_flow()       # backfill recent trades for net flow
        self._tasks = [
            asyncio.create_task(self._stream_loop()),
            asyncio.create_task(self._broadcast_loop()),
            asyncio.create_task(self._chain_loop()),
        ]
        logger.info(f"[{self.ticker}] Live session started ({self.provider.feed_label})")

    async def stop(self):
        self._stopped.set()
        for t in self._tasks:
            t.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)

    # --- data acquisition --------------------------------------------------
    async def _refresh_chain(self):
        md = await asyncio.to_thread(self.provider.fetch_options_market_state, self.ticker)
        if md and md.get("synchronized_spot", 0) > 0:
            # PRODUCER (ARCH §4): stash the FULL UNFILTERED market_data into the process-local
            # shared chain store BEFORE greeks-filtering, so a cold REST bundle request for this
            # ticker can short-circuit its chain fetch to this fresh snapshot. Read-only to
            # consumers; best-effort (a store fault never affects the live path).
            chain_store.put(self.ticker, md)
            self.contracts = [c for c in md.get("contracts", [])
                              if (c.get("greeks") or {}).get("gamma") is not None]
            if self.mid <= 0:  # no live quote yet -> seed from the snapshot spot
                self.mid = md.get("current_spot") or md.get("synchronized_spot") or 0.0

    async def _chain_loop(self):
        try:
            while not self._stopped.is_set():
                await asyncio.sleep(self.chain_refresh)
                await self._refresh_chain()
        except asyncio.CancelledError:
            pass

    async def _seed_flow(self):
        try:
            trades = await asyncio.to_thread(
                self.provider.fetch_recent_trades, self.ticker, self.flow_window)
        except Exception as e:
            logger.warning(f"[{self.ticker}] flow seed failed: {e}")
            return
        for tr in trades:  # backfill: tick rule (no time-aligned NBBO)
            p = tr["price"]
            if self.last_trade_price is not None and p != self.last_trade_price:
                sign = 1.0 if p > self.last_trade_price else -1.0
                self.trades.append((tr["timestamp"] / 1e9, sign * tr["size"]))
            self.last_trade_price = p
        self._recompute_flow(time.time())

    async def _stream_loop(self):
        try:
            async for ev in self.provider.stream_stock(self.ticker):
                self.last_tick_wall = time.time()  # a real tick arrived
                if ev["kind"] == "quote":
                    self.bid, self.ask = ev.get("bid", 0.0), ev.get("ask", 0.0)
                    self.bid_size, self.ask_size = ev.get("bid_size", 0.0), ev.get("ask_size", 0.0)
                    self.spot_ts = ev.get("ts", 0)
                    if self.bid > 0 and self.ask > 0:
                        self.mid = (self.bid + self.ask) / 2.0
                elif ev["kind"] == "trade":
                    self._on_trade(ev)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"[{self.ticker}] stream loop error: {e}")

    def _on_trade(self, ev):
        p, size = ev.get("price", 0.0), ev.get("size", 0.0)
        if p <= 0 or size <= 0:
            return
        # Quote rule against the live NBBO; tick-rule fallback at the midpoint.
        if self.ask > 0 and p >= self.ask:
            sign = 1.0
        elif self.bid > 0 and p <= self.bid:
            sign = -1.0
        elif self.last_trade_price is not None and p != self.last_trade_price:
            sign = 1.0 if p > self.last_trade_price else -1.0
        else:
            sign = 0.0
        self.last_trade_price = p
        if sign != 0.0:
            self.trades.append((time.time(), sign * size))

    def _recompute_flow(self, now):
        cutoff = now - self.flow_window
        while self.trades and self.trades[0][0] < cutoff:
            self.trades.popleft()
        self.buy_vol = sum(s for _, s in self.trades if s > 0)
        self.sell_vol = -sum(s for _, s in self.trades if s < 0)

    # --- broadcast ---------------------------------------------------------
    async def _broadcast_loop(self):
        # Per-tick try/except: one bad tick must NOT exit the loop, which would leave a
        # registered-but-silent session that new subscribers join and get nothing from.
        while not self._stopped.is_set():
            try:
                await asyncio.sleep(self.throttle)
                now = time.time()
                self._recompute_flow(now)
                # "live" iff a real Q/T tick arrived recently. When the market is closed (or
                # the feed lacks this session, e.g. overnight), mid is a stale last-known value
                # and we must NOT present it as live.
                tick_age = (now - self.last_tick_wall) if self.last_tick_wall else None
                is_live = tick_age is not None and tick_age < LIVE_TICK_MAX_AGE
                base = {
                    "ticker": self.ticker,
                    "mid": round(self.mid, 2) if self.mid else None,
                    # last_trade (ticker-load-experience INTERFACE §2): the last actual TRADE print
                    # off the live tape — a DISPLAY-ONLY sibling of the NBBO mid, NOT the anchor.
                    # Always present (key emitted every payload); null between prints / overnight /
                    # pre-first-print. HARD BOUNDARY (`live-spot=NBBO-mid`): this is a readout only —
                    # it MUST NOT feed self.mid, the levels, the live gamma-flip reprice, or net-flow
                    # sign logic (those stay on self.mid). Rides the existing payload-level
                    # live/tick_age_s/market_session honesty flags; carries no separate age.
                    "last_trade": round(self.last_trade_price, 2) if self.last_trade_price else None,
                    "bid": self.bid or None,
                    "ask": self.ask or None,
                    "spread": round(self.ask - self.bid, 4) if (self.bid > 0 and self.ask > 0) else None,
                    "net_flow": round(self.buy_vol - self.sell_vol),
                    "buy_vol": round(self.buy_vol),
                    "sell_vol": round(self.sell_vol),
                    "flow_window_s": self.flow_window,
                    "spot_ts": self.spot_ts,
                    "live": is_live,
                    "tick_age_s": int(tick_age) if tick_age is not None else None,
                    "market_session": classify_session(),
                    "feed": self.provider.feed_label,
                    "ts": int(now * 1000),
                }
                # Reprice levels once per distinct filter, then fan out.
                levels_cache: dict = {}
                for q, filt in list(self.subscribers.items()):
                    if filt not in levels_cache:
                        levels_cache[filt] = self._levels_for_filter(filt)
                    payload = {**base, **levels_cache[filt]}
                    if not q.full():
                        q.put_nowait(payload)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[{self.ticker}] broadcast tick error: {e}")

    def _levels_for_filter(self, filt):
        # Only the gamma flip is live-recomputed: it's the spot-sensitive regime trigger and
        # uses the same analytic gamma as the bundle (so they stay consistent). Walls stay on
        # the bundle (vendor gamma); the UI measures price-vs-wall from the live mid.
        if self.mid <= 0 or not self.contracts:
            return {"gamma_flip": None}
        contracts = self._filter_contracts(*filt)
        return {"gamma_flip": self.engine._find_gamma_flip(contracts, self.mid)}

    def _filter_contracts(self, min_dte, max_dte, exps):
        if min_dte is None and max_dte is None and not exps:
            return self.contracts
        out = []
        for c in self.contracts:
            days = self.engine._calculate_time_to_expiry(str(c.get("expiration_date", ""))) * 365.0
            if min_dte is not None and days < min_dte:
                continue
            if max_dte is not None and days > max_dte:
                continue
            if exps and c.get("expiration_date", "")[:10] not in exps:
                continue
            out.append(c)
        return out


class LiveHub:
    """
    One LiveSession per ticker, ref-counted by SSE subscribers. Teardown is deferred by a
    short GRACE period: when the last subscriber leaves we schedule a stop, but a new
    subscriber arriving within the window cancels it and reuses the live session. This
    absorbs React StrictMode's mount/unmount/remount, fast ticker switch-backs, and brief
    reconnects -- which would otherwise tear down and rebuild the (expensive) ws stream
    repeatedly, leaving racey gaps with no data.
    """
    GRACE_SECONDS = 8.0

    def __init__(self, provider, engine, *, flow_window, throttle, chain_refresh):
        self.provider = provider
        self.engine = engine
        self.flow_window = flow_window
        self.throttle = throttle
        self.chain_refresh = chain_refresh
        self.sessions: dict = {}
        self._pending_stop: dict = {}   # ticker -> scheduled-stop task
        self._lock = asyncio.Lock()

    async def subscribe(self, ticker: str, filt: tuple) -> asyncio.Queue:
        async with self._lock:
            pending = self._pending_stop.pop(ticker, None)
            if pending:
                pending.cancel()        # a new subscriber arrived within the grace window
            sess = self.sessions.get(ticker)
            if sess is None:
                sess = LiveSession(ticker, self.provider, self.engine,
                                   flow_window=self.flow_window, throttle=self.throttle,
                                   chain_refresh=self.chain_refresh)
                await sess.start()
                self.sessions[ticker] = sess
            q: asyncio.Queue = asyncio.Queue(maxsize=100)
            sess.subscribers[q] = filt
            return q

    async def unsubscribe(self, ticker: str, q: asyncio.Queue):
        async with self._lock:
            sess = self.sessions.get(ticker)
            if not sess:
                return
            sess.subscribers.pop(q, None)
            if not sess.subscribers and ticker not in self._pending_stop:
                self._pending_stop[ticker] = asyncio.create_task(self._delayed_stop(ticker))

    async def _delayed_stop(self, ticker: str):
        try:
            await asyncio.sleep(self.GRACE_SECONDS)
        except asyncio.CancelledError:
            return                      # subscriber returned; keep the session alive
        async with self._lock:
            self._pending_stop.pop(ticker, None)
            sess = self.sessions.get(ticker)
            if sess and not sess.subscribers:
                await sess.stop()
                self.sessions.pop(ticker, None)
                # Best-effort evict the shared chain snapshot this session owned. Harmless if it
                # races a fresh write — the consumer's freshness gate rejects anything stale anyway.
                chain_store.evict(ticker)
                logger.info(f"[{ticker}] Live session stopped (grace elapsed, no subscribers)")

    def active_tickers(self) -> list:
        return list(self.sessions)
