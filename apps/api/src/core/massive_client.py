import os
import logging
from datetime import datetime, time, timezone, timedelta
import zoneinfo
from typing import Any

from dotenv import load_dotenv

# Native SDK Client Import
from massive import RESTClient

from typing import TypedDict

class UnderlyingBarMetrics(TypedDict):
    close: float
    vwap: float


load_dotenv()
logger = logging.getLogger("GammaFlowAsync")


def extract(obj, key, default=None):
    """Institutional Data Pipeline Utility for safe dictionary/object extraction."""
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


class MassiveDataInterface:
    def __init__(self):
        self.api_key = os.getenv("MASSIVE_API_KEY")
        if not self.api_key:
            logger.error("MASSIVE_API_KEY is not set; all Massive API calls will fail")
        # Unified SDK Session initialization
        self.client = RESTClient(self.api_key)

    def _is_market_closed(self, timestamp_ns: int) -> bool:
        """Determines if the options snapshot timestamp occurs outside regular market hours (EST)."""
        if timestamp_ns == 0:
            return False

        # Parse nanoseconds timestamp directly into UTC, then shift to Eastern Time
        dt = datetime.fromtimestamp(timestamp_ns / 1e9, tz=timezone.utc)
        dt_est = dt.astimezone(zoneinfo.ZoneInfo("America/New_York"))

        # Weekend check
        if dt_est.weekday() >= 5:
            return True

        market_open = time(9, 30)
        market_close = time(16, 0)
        return not (market_open <= dt_est.time() <= market_close)

    def fetch_historical_underlying_metrics(self, ticker: str) -> list[UnderlyingBarMetrics]:
        """
        Queries the Custom Bars API natively via the Massive RESTClient generator loop.
        Applies direct keyword argument pass-throughs as required by the native SDK.
        """
        ticker_upper = ticker.upper()
        now = datetime.now()

        # Generate standard 60-calendar-day lookback bounds matching current 2026 timeline
        from_date = (now - timedelta(days=60)).strftime("%Y-%m-%d")
        to_date = now.strftime("%Y-%m-%d")

        historical_underlying_metrics: list[UnderlyingBarMetrics] = []

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
                historical_underlying_metrics.append(UnderlyingBarMetrics(close=close_val, vwap=vwap_val))

            logger.info(f"[{ticker_upper}] Fetched {len(historical_underlying_metrics)} daily bars")

            return historical_underlying_metrics

        except Exception as e:
            logger.error(
                f"SDK Exception during daily bar ingestion for {ticker_upper}: {str(e)} "
                f"(returning {len(historical_underlying_metrics)} bars collected before failure)")
            return historical_underlying_metrics

    def _days_to_expiry(self, expiry_str: str) -> float:
        """Calendar days from now (UTC) to an option's expiration date. Negative on parse failure."""
        try:
            expiry = datetime.strptime(expiry_str[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
            return (expiry - datetime.now(timezone.utc)).total_seconds() / 86400.0
        except Exception:
            return -1.0

    def fetch_intraday_session_bars(self, ticker: str) -> list[dict]:
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

        rows: list[dict] = []
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
                rows.append({
                    "session": et.date().isoformat(),
                    "minute": et.time(),
                    "vw": float(vw),
                    "v": float(vol),
                })

            logger.info(f"[{ticker_upper}] Fetched {len(rows)} intraday bars")
            return rows

        except Exception as e:
            logger.error(f"[{ticker_upper}] Failed to fetch intraday bars: {e}")
            return rows

    def fetch_synchronized_options_market_state(self, underlying: str) -> dict:
        """
        Queries the Massive v3 Options Chain Snapshot for an underlying and returns a
        normalized payload (spot, timestamp, ATM IV, and the full contract list).

        The SDK's list_snapshot_options_chain auto-follows next_url, so a single pass
        over the returned generator yields the entire chain across all strikes and
        expirations. No manual strike pagination is required.

        Implied volatility is returned by the API as a decimal (e.g. 0.486 == 48.6%);
        it is passed through unscaled here and standardized downstream in the engine.
        """
        underlying_upper = underlying.upper()
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

                strike = float(extract(details, "strike_price", 0.0))
                contract_type = extract(details, "contract_type", "").lower()
                if strike <= 0.0 or contract_type not in ("call", "put"):
                    continue  # malformed contract

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

            # --- Spot for GEX/greek calculations. Outside RTH the options have stopped
            # trading, so the closing greeks correspond to the cash close -- pairing them
            # with the official close (not the drifting after-hours underlying) keeps the
            # calculations consistent with the gamma the greeks were priced at. The live
            # snapshot underlying is returned separately as current_spot (for display).
            # During RTH the two coincide.
            final_target_spot = synchronized_spot_price

            if self._is_market_closed(snapshot_timestamp):
                logger.info(f"[{underlying_upper}] Market closed at snapshot time; using official cash close")
                try:
                    ticker_snapshot = self.client.get_snapshot_ticker("stocks", underlying_upper)
                    day_bar = extract(ticker_snapshot, "day", {})
                    cash_close = extract(day_bar, "close")
                    if cash_close is not None and float(cash_close) > 0:
                        logger.info(
                            f"[{underlying_upper}] Spot reconciled: snapshot ${synchronized_spot_price:.2f} "
                            f"-> cash close ${float(cash_close):.2f}")
                        final_target_spot = float(cash_close)
                except Exception as sdk_err:
                    logger.warning(
                        f"[{underlying_upper}] Cash-close lookup failed; keeping snapshot spot "
                        f"${synchronized_spot_price:.2f}: {sdk_err}")
            else:
                logger.info(f"[{underlying_upper}] Market open; using live snapshot spot ${final_target_spot:.2f}")

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