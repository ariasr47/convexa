import os
import logging
from collections import defaultdict
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
            logger.error("CRITICAL: MASSIVE_API_KEY missing from environment variables!")
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
            logger.info(f"SDK Query: Streaming daily custom bars for {ticker_upper} from {from_date} to {to_date}")

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

            logger.info(f"SDK Ingestion: Successfully parsed {len(historical_underlying_metrics)} bars sequentially for the realized variance engine.")

            return historical_underlying_metrics

        except Exception as e:
            logger.info(
                f"SDK Ingestion: Successfully parsed {len(historical_underlying_metrics)} bars sequentially for the realized variance engine.")
            return historical_underlying_metrics

    def fetch_synchronized_options_market_state(self, underlying: str) -> dict:
        """
        Queries the Massive API v3 Options Chain Snapshot using our deterministic
        strike-slicing pagination loop, with session-aware close price reconciliation.
        """
        underlying_upper = underlying.upper()
        all_contracts = []
        synchronized_spot_price = 0.0
        snapshot_timestamp = 0

        # Pagination controls
        current_strike_floor = 0.0
        has_more_pages = True
        page_count = 0

        try:
            logger.info(f"Initiating full-chain SDK deep ingestion for: {underlying_upper}")

            while has_more_pages:
                page_count += 1

                # Native SDK Options Chain processing
                chain_page = self.client.list_snapshot_options_chain(
                    underlying_upper,
                    params={
                        "limit": 250,
                        "sort": "strike_price",
                        "order": "asc",
                        "strike_price.gt": current_strike_floor
                    }
                )

                page_contracts_found = 0
                max_strike_in_page = current_strike_floor

                for contract in chain_page:
                    page_contracts_found += 1

                    # Capture the synchronized spot asset and timestamp on first contract view
                    if synchronized_spot_price == 0.0:
                        underlying_asset = extract(contract, "underlying_asset", {})
                        synchronized_spot_price = float(extract(underlying_asset, "price", 0.0))
                        snapshot_timestamp = int(extract(underlying_asset, "last_updated", 0))

                    details = extract(contract, "details", {})
                    greeks = extract(contract, "greeks", {})

                    strike = float(extract(details, "strike_price", 0.0))
                    if strike > max_strike_in_page:
                        max_strike_in_page = strike

                    if not greeks or extract(greeks, "gamma") is None:
                        continue

                    contract_dict = {
                        "strike_price": strike,
                        "contract_type": extract(details, "contract_type", "").lower(),
                        "expiration_date": extract(details, "expiration_date", ""),
                        "open_interest": int(extract(contract, "open_interest", 0)),
                        "implied_volatility": float(extract(contract, "implied_volatility", 0.0)),
                        "greeks": {
                            "delta": float(extract(greeks, "delta", 0.0)),
                            "gamma": float(extract(greeks, "gamma", 0.0)),
                            "theta": float(extract(greeks, "theta", 0.0)),
                            "vega": float(extract(greeks, "vega", 0.0))
                        }
                    }
                    all_contracts.append(contract_dict)

                if page_contracts_found < 250 or max_strike_in_page == current_strike_floor:
                    has_more_pages = False
                else:
                    current_strike_floor = max_strike_in_page

            if not all_contracts:
                logger.warning(f"No valid option contracts compiled for {underlying_upper}.")
                return {}

            # --- DYNAMIC TARGET SPOT PRICING CONSTRAINTS RECONCILIATION ---
            final_target_spot = synchronized_spot_price

            if self._is_market_closed(snapshot_timestamp):
                logger.info(
                    f"Market Closed state active for timestamp ({snapshot_timestamp}). Querying cash close bar.")
                try:
                    # Native SDK call to Single Ticker Snapshot endpoint
                    ticker_snapshot = self.client.get_snapshot_ticker("stocks", underlying_upper)

                    day_bar = extract(ticker_snapshot, "day", {})
                    cash_close = extract(day_bar, "close")

                    if cash_close is not None and float(cash_close) > 0:
                        final_target_spot = float(cash_close)
                        logger.info(
                            f"Reconciliation Complete. Overriding post-market drift price ${synchronized_spot_price} -> Close: ${final_target_spot}")
                except Exception as sdk_err:
                    logger.warning(
                        f"Failed to isolate cash close via SDK, maintaining synchronized spot fallback: {sdk_err}")
            else:
                logger.info(
                    f"Market Active. Utilizing perfectly synchronized option snapshot spot: ${final_target_spot}")

            # ATM IV Isolation Sequence
            expiration_oi_map = defaultdict(int)
            for c in all_contracts:
                expiration_oi_map[c["expiration_date"]] += c["open_interest"]

            if not expiration_oi_map:
                return {}

            primary_front_expiration = max(expiration_oi_map, key=expiration_oi_map.get)
            front_month_contracts = [c for c in all_contracts if c["expiration_date"] == primary_front_expiration]

            atm_contract = min(
                front_month_contracts,
                key=lambda x: abs(x["strike_price"] - final_target_spot)
            )
            atm_iv = atm_contract["implied_volatility"]

            return {
                "ticker": underlying_upper,
                "synchronized_spot": final_target_spot,
                "timestamp": snapshot_timestamp,
                "atm_iv": atm_iv,
                "contracts": all_contracts
            }

        except Exception as e:
            logger.error(f"SDK Exception during paginated options extraction: {str(e)}")
            return {}