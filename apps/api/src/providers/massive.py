"""
Massive adapter: implements MarketDataProvider against the Massive REST SDK.

All Massive-specific concerns -- auth, the v3 options-chain snapshot shape, market-phase
spot selection, the `extract` payload helper -- are sealed in here. The rest of Convexa
only sees the normalized contracts from `base.py`.
"""
import os
import asyncio
import logging
from datetime import datetime, time, timezone, timedelta
from typing import AsyncIterator
import zoneinfo

from dotenv import load_dotenv

# Native SDK Client Import
from massive import RESTClient
from massive.websocket import WebSocketClient
from massive.websocket.models import Feed, Market

from .base import (
    MarketDataProvider, OptionsMarketState, UnderlyingBar, IntradayBar,
    TradePrint, StreamEvent,
)

load_dotenv()
logger = logging.getLogger("Convexa")


def extract(obj, key, default=None):
    """Institutional Data Pipeline Utility for safe dictionary/object extraction."""
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


class MassiveProvider(MarketDataProvider):
    name = "massive"

    # Observability seam (base.MarketDataProvider.metrics_sink): the Massive SDK's model iterators
    # do NOT surface response rate-limit headers (the client only retains request headers), so this
    # adapter emits no rate-limit headroom / http_status through the optional sink -- the operator
    # readout's `min_rate_limit_headroom` is therefore `null` ("unknown"), which is the honest
    # result. Logical vendor-call COUNT + wall LATENCY are still captured at the orchestration call
    # site (main.compute_ticker), independent of this seam. A future transport that exposes the
    # headers (e.g. a direct-HTTP adapter) can populate `metrics_sink.record_vendor_call(...)` with
    # no change to the port.

    def __init__(self):
        self.api_key = os.getenv("MASSIVE_API_KEY")
        if not self.api_key:
            logger.error("MASSIVE_API_KEY is not set; all Massive API calls will fail")
        # Unified SDK Session initialization
        self.client = RESTClient(self.api_key)
        # Live websocket feed: realtime (Advanced plan) or delayed, from DATA_FEED env.
        self._feed = (os.getenv("DATA_FEED", "realtime") or "realtime").lower()
        self.feed_label = "realtime" if self._feed == "realtime" else "delayed"

    def _current_market_phase(self) -> str:
        """
        Classifies the current Eastern-Time market phase, which decides the spot used
        for GEX/greek calculations:
          - 'rth'         : regular session in progress -> greeks priced at the live spot
          - 'after_close' : weekday past the close -> greeks reflect today's session close
          - 'closed_pre'  : before today's open, weekend, or holiday -> greeks reflect the
                            previous completed session's close
        """
        now_et = datetime.now(zoneinfo.ZoneInfo("America/New_York"))
        if now_et.weekday() >= 5:
            return "closed_pre"  # weekend -> last completed session is prior (Friday)
        t = now_et.time()
        if time(9, 30) <= t <= time(16, 0):
            return "rth"
        if t > time(16, 0):
            return "after_close"  # today's session just completed
        return "closed_pre"       # before the open -> last completed session is the prior day

    def fetch_daily_bars(self, ticker: str) -> list[UnderlyingBar]:
        """
        Queries the Custom Bars API natively via the Massive RESTClient generator loop.
        Applies direct keyword argument pass-throughs as required by the native SDK.
        """
        ticker_upper = ticker.upper()
        now = datetime.now()

        # Generate standard 60-calendar-day lookback bounds matching current 2026 timeline
        from_date = (now - timedelta(days=60)).strftime("%Y-%m-%d")
        to_date = now.strftime("%Y-%m-%d")

        daily_bars: list[UnderlyingBar] = []

        try:
            logger.info(f"[{ticker_upper}] Fetching daily bars ({from_date} to {to_date})")

            bars_generator = self.client.list_aggs(
                ticker_upper,
                1,
                "day",
                from_date,
                to_date,
                True,
                "asc",
                120
            )

            # Iterate directly through the generator stream to collect closed session prints
            for bar in bars_generator:
                close_val = extract(bar, "close")
                vwap_val = extract(bar, "vwap")
                daily_bars.append(UnderlyingBar(close=close_val, vwap=vwap_val))

            logger.info(f"[{ticker_upper}] Fetched {len(daily_bars)} daily bars")

            return daily_bars

        except Exception as e:
            logger.error(
                f"SDK Exception during daily bar ingestion for {ticker_upper}: {str(e)} "
                f"(returning {len(daily_bars)} bars collected before failure)")
            return daily_bars

    def _days_to_expiry(self, expiry_str: str) -> float:
        """Calendar days from now (UTC) to an option's expiration date. Negative on parse failure."""
        try:
            expiry = datetime.strptime(expiry_str[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
            return (expiry - datetime.now(timezone.utc)).total_seconds() / 86400.0
        except Exception:
            return -1.0

    def fetch_intraday_bars(self, ticker: str) -> list[IntradayBar]:
        """
        Streams 1-minute bars over a short trailing window so the engine can build a
        session-anchored VWAP and volume-weighted deviation bands. A multi-day window
        is requested as a cushion for weekends/holidays; the engine selects the latest
        session. Each row carries the bar's volume-weighted price (vw) and volume (v),
        plus the Eastern-Time session date and minute for RTH filtering.
        """
        ticker_upper = ticker.upper()
        now = datetime.now()
        from_date = (now - timedelta(days=4)).strftime("%Y-%m-%d")
        to_date = now.strftime("%Y-%m-%d")

        rows: list[IntradayBar] = []
        try:
            logger.info(f"[{ticker_upper}] Fetching 1-minute bars ({from_date} to {to_date})")
            bars = self.client.list_aggs(ticker_upper, 1, "minute", from_date, to_date, True, "asc", 50000)

            et_zone = zoneinfo.ZoneInfo("America/New_York")
            for bar in bars:
                ts_ms = extract(bar, "timestamp")
                vw = extract(bar, "vwap")
                vol = extract(bar, "volume")
                if ts_ms is None or vw is None or vol is None:
                    continue
                et = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).astimezone(et_zone)
                rows.append(IntradayBar(
                    session=et.date().isoformat(),
                    minute=et.time(),
                    vw=float(vw),
                    v=float(vol),
                ))

            logger.info(f"[{ticker_upper}] Fetched {len(rows)} intraday bars")
            return rows

        except Exception as e:
            logger.error(f"[{ticker_upper}] Failed to fetch intraday bars: {e}")
            return rows

    def fetch_options_market_state(self, ticker: str) -> OptionsMarketState | dict:
        """
        Queries the Massive v3 Options Chain Snapshot for an underlying and returns a
        normalized payload (spot, timestamp, ATM IV, and the full contract list).

        The SDK's list_snapshot_options_chain auto-follows next_url, so a single pass
        over the returned generator yields the entire chain across all strikes and
        expirations. No manual strike pagination is required.

        Implied volatility is returned by the API as a decimal (e.g. 0.486 == 48.6%);
        it is passed through unscaled here and standardized downstream in the engine.
        """
        underlying_upper = ticker.upper()
        all_contracts = []
        synchronized_spot_price = 0.0
        snapshot_timestamp = 0

        try:
            logger.info(f"[{underlying_upper}] Fetching option chain")

            # Single auto-paginated pass over the entire option chain.
            chain = self.client.list_snapshot_options_chain(
                underlying_upper,
                params={"limit": 250},
            )

            for contract in chain:
                # Capture the synchronized spot + snapshot timestamp from the first
                # contract that carries a valid underlying price.
                if synchronized_spot_price <= 0.0:
                    underlying_asset = extract(contract, "underlying_asset", {})
                    px = float(extract(underlying_asset, "price", 0.0))
                    if px > 0.0:
                        synchronized_spot_price = px
                        snapshot_timestamp = int(extract(underlying_asset, "last_updated", 0))

                details = extract(contract, "details", {})
                greeks = extract(contract, "greeks", {})
                day = extract(contract, "day", {})

                strike = float(extract(details, "strike_price", 0.0))
                contract_type = extract(details, "contract_type", "").lower()
                if strike <= 0.0 or contract_type not in ("call", "put"):
                    continue  # malformed contract

                # Session option volume from the snapshot's `day` block (already in the
                # parsed payload -- no extra request). None when the vendor omits it, so the
                # engine's Vol/OI degrades to null rather than misreading a 0.
                raw_volume = extract(day, "volume", None)
                volume = float(raw_volume) if raw_volume is not None else None

                # Option NBBO quote from the snapshot's `last_quote` block (already parsed --
                # no extra request). Feeds the tracked-contract mark; absent => None so the
                # consumer falls back to a theoretical mark (never an error).
                lq = extract(contract, "last_quote", None)
                quote = None
                if lq is not None:
                    q_bid = extract(lq, "bid", None)
                    q_ask = extract(lq, "ask", None)
                    if q_bid is not None or q_ask is not None:
                        quote = {"bid": float(q_bid) if q_bid is not None else None,
                                 "ask": float(q_ask) if q_ask is not None else None}

                # Contracts Massive could not price greeks for (often deep ITM) are still
                # kept so their open interest counts toward put/call ratio and max pain.
                # Greeks are set to None so the engine excludes them from GEX/greeks only.
                has_greeks = bool(greeks) and extract(greeks, "gamma") is not None

                all_contracts.append({
                    "strike_price": strike,
                    "contract_type": contract_type,
                    "expiration_date": extract(details, "expiration_date", ""),
                    "open_interest": int(extract(contract, "open_interest", 0)),
                    "implied_volatility": float(extract(contract, "implied_volatility", 0.0)) if has_greeks else 0.0,
                    "volume": volume,
                    "quote": quote,
                    "greeks": {
                        "delta": float(extract(greeks, "delta", 0.0)) if has_greeks else None,
                        "gamma": float(extract(greeks, "gamma", 0.0)) if has_greeks else None,
                        "theta": float(extract(greeks, "theta", 0.0)) if has_greeks else None,
                        "vega": float(extract(greeks, "vega", 0.0)) if has_greeks else None,
                    },
                })

            if not all_contracts:
                logger.warning(f"[{underlying_upper}] No valid option contracts returned")
                return {}

            # --- Spot for GEX/greek calculations. Greeks are priced at the live spot
            # during RTH; once the market closes they reflect the last completed session's
            # close. So we use today's session close after the close, and the prior
            # session's close pre-market / on weekends & holidays. The live (or
            # after-hours) snapshot underlying is reported separately as current_spot for
            # display. During RTH the two coincide.
            final_target_spot = synchronized_spot_price
            phase = self._current_market_phase()

            if phase == "rth":
                logger.info(f"[{underlying_upper}] Market open; using live snapshot spot ${final_target_spot:.2f}")
            else:
                try:
                    snap = self.client.get_snapshot_ticker("stocks", underlying_upper)
                    day_close = extract(extract(snap, "day", {}), "close")
                    prev_close = extract(extract(snap, "prev_day", {}), "close")

                    # After today's close use today's session; pre-market/weekend use the
                    # prior session. Each falls back to the other if its bar is missing.
                    if phase == "after_close":
                        candidates = [("today's close", day_close), ("prior session close", prev_close)]
                    else:  # closed_pre
                        candidates = [("prior session close", prev_close), ("today's close", day_close)]

                    chosen, chosen_label = None, None
                    for label, c in candidates:
                        if c is not None and float(c) > 0:
                            chosen, chosen_label = float(c), label
                            break

                    if chosen is not None:
                        final_target_spot = chosen
                        logger.info(
                            f"[{underlying_upper}] Market closed ({phase}); using {chosen_label} "
                            f"${chosen:.2f} (live underlying ${synchronized_spot_price:.2f})")
                    else:
                        logger.warning(
                            f"[{underlying_upper}] No session close available; keeping snapshot spot "
                            f"${synchronized_spot_price:.2f}")
                except Exception as sdk_err:
                    logger.warning(
                        f"[{underlying_upper}] Session-close lookup failed; keeping snapshot spot "
                        f"${synchronized_spot_price:.2f}: {sdk_err}")

            # --- ATM IV: take the NEAREST tenor that is at least MIN_DTE out (avoids
            # 0DTE/expiring noise), not the highest-OI expiration. This keeps the IV
            # horizon roughly aligned with the 30d HV used for the IV/HV ratio.
            MIN_DTE = 7.0
            expirations = {c["expiration_date"] for c in all_contracts if c["expiration_date"]}
            dte_map = {e: self._days_to_expiry(e) for e in expirations}

            eligible = {e: d for e, d in dte_map.items() if d >= MIN_DTE}
            if eligible:
                target_expiration = min(eligible, key=eligible.get)   # nearest >= MIN_DTE
            elif dte_map:
                target_expiration = max(dte_map, key=dte_map.get)      # fallback: furthest available
            else:
                target_expiration = None

            atm_iv = 0.0
            atm_dte = None
            if target_expiration is not None:
                atm_dte = round(dte_map[target_expiration], 2)
                # Live IV quotes only, within the chosen tenor.
                tenor = [
                    c for c in all_contracts
                    if c["expiration_date"] == target_expiration and c["implied_volatility"] > 0.0
                ]
                if tenor:
                    atm_strike = min(tenor, key=lambda x: abs(x["strike_price"] - final_target_spot))["strike_price"]
                    # Average call+put IV at the ATM strike to mitigate vertical skew.
                    strike_ivs = [c["implied_volatility"] for c in tenor if c["strike_price"] == atm_strike]
                    atm_iv = sum(strike_ivs) / len(strike_ivs)

            return {
                "ticker": underlying_upper,
                "synchronized_spot": final_target_spot,        # spot for GEX/greeks (cash close when market closed)
                "current_spot": synchronized_spot_price,       # live/delayed snapshot underlying (for display)
                "timestamp": snapshot_timestamp,
                "atm_iv": atm_iv,                       # decimal form, e.g. 0.486
                "atm_iv_expiration": target_expiration, # tenor used for ATM IV (transparency)
                "atm_iv_dte": atm_dte,                  # calendar days to that expiration
                "contracts": all_contracts,
            }

        except Exception as e:
            logger.error(f"[{underlying_upper}] Failed to fetch option chain: {e}")
            return {}

    # Hard cap on trades scanned in one fetch, so a long dark-pool lookback on a liquid name
    # can't run away. Newest-first so a cap keeps the most recent prints.
    _MAX_TRADES = 120000

    def fetch_recent_trades(self, ticker: str, lookback_seconds: int) -> list[TradePrint]:
        """
        Recent executed trades over a trailing window, ascending. Each carries off_exchange
        (TRF-reported) so callers can derive order flow AND off-exchange/dark-pool activity.
        """
        ticker_upper = ticker.upper()
        now_ns = int(datetime.now(timezone.utc).timestamp() * 1e9)
        start_ns = now_ns - int(lookback_seconds * 1e9)
        out: list[TradePrint] = []
        try:
            # Pull newest-first so the cap retains recent prints, then return ascending.
            trades = self.client.list_trades(
                ticker_upper, timestamp_gte=start_ns, timestamp_lte=now_ns,
                order="desc", sort="timestamp", limit=50000,
            )
            for tr in trades:
                price = extract(tr, "price")
                size = extract(tr, "size")
                ts = extract(tr, "sip_timestamp") or extract(tr, "participant_timestamp")
                if price is None or size is None or ts is None:
                    continue
                out.append(TradePrint(
                    price=float(price), size=float(size), timestamp=int(ts),
                    conditions=extract(tr, "conditions") or [],
                    off_exchange=extract(tr, "trf_id") is not None,
                ))
                if len(out) >= self._MAX_TRADES:
                    break
            out.reverse()  # ascending by time
            logger.info(f"[{ticker_upper}] Pulled {len(out)} trades over last {lookback_seconds}s")
            return out
        except Exception as e:
            logger.error(f"[{ticker_upper}] Failed to fetch trades: {e}")
            return out

    async def stream_stock(self, ticker: str) -> AsyncIterator[StreamEvent]:
        """
        Live NBBO quotes + trades for one stock ticker via the Massive WebSocket. Bridges the
        SDK's callback/reconnect loop into an async generator through an asyncio.Queue; closing
        the generator cancels the connect task and closes the socket.
        """
        ticker_upper = ticker.upper()
        feed = Feed.RealTime if self._feed == "realtime" else Feed.Delayed
        ws = WebSocketClient(api_key=self.api_key, feed=feed, market=Market.Stocks)
        ws.subscribe(f"Q.{ticker_upper}", f"T.{ticker_upper}")
        queue: asyncio.Queue = asyncio.Queue()

        async def processor(msgs):
            for m in msgs:
                ev = getattr(m, "event_type", None)
                if ev == "Q":
                    queue.put_nowait(StreamEvent(
                        kind="quote", ts=getattr(m, "timestamp", 0) or 0,
                        bid=getattr(m, "bid_price", 0.0) or 0.0,
                        ask=getattr(m, "ask_price", 0.0) or 0.0,
                        bid_size=float(getattr(m, "bid_size", 0) or 0),
                        ask_size=float(getattr(m, "ask_size", 0) or 0),
                    ))
                elif ev == "T":
                    queue.put_nowait(StreamEvent(
                        kind="trade", ts=getattr(m, "timestamp", 0) or 0,
                        price=getattr(m, "price", 0.0) or 0.0,
                        size=float(getattr(m, "size", 0) or 0),
                    ))

        task = asyncio.create_task(ws.connect(processor))
        logger.info(f"[{ticker_upper}] Opened {self.feed_label} stock stream (Q+T)")
        try:
            while True:
                yield await queue.get()
        finally:
            task.cancel()
            try:
                await ws.close()
            except Exception:
                pass
            logger.info(f"[{ticker_upper}] Closed stock stream")
