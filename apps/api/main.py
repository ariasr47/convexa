import asyncio
import sys
import logging
import json
import os
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from src.core.engine import QuantEngine
from src.core.massive_client import MassiveDataInterface
from src.models.market_data import MarketState

logger = logging.getLogger("GammaFlowAsync")
logger.setLevel(logging.INFO)
logger.propagate = False

# Configure the handler exactly once. This module can be imported more than once
# under uvicorn's reloader, and re-adding a handler each time is what causes every
# log line to be printed twice.
if not logger.handlers:
    formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)

quant_engine = QuantEngine(risk_free_rate=0.045)
data_provider = MassiveDataInterface()
current_market_state = {}
# Per-strike GEX/OI profile, kept separate from market_state so the AI payload stays lean.
current_strike_profile = []


async def market_data_engine_loop():
    """Background loop processing native SDK responses into unified memory structures."""
    target_ticker = "TSLA"

    while True:
        try:
            logger.info(f"[{target_ticker}] Starting market data refresh")

            # 1. Gather Option Chain Snapshot Framework via SDK Client
            market_data = await asyncio.to_thread(
                data_provider.fetch_synchronized_options_market_state, target_ticker
            )

            # 2. Gather Underlier Historical Closing Bars via SDK Client
            underlying_history = await asyncio.to_thread(
                data_provider.fetch_historical_underlying_metrics, target_ticker
            )

            # 3. Gather intraday 1-minute bars for the session-anchored VWAP + bands
            intraday_bars = await asyncio.to_thread(
                data_provider.fetch_intraday_session_bars, target_ticker
            )

            if market_data and market_data.get("synchronized_spot", 0) > 0:
                contracts = market_data.get("contracts", [])
                expirations = sorted({c.get("expiration_date") for c in contracts if c.get("expiration_date")})
                nearest_exp = expirations[0] if expirations else "n/a"
                farthest_exp = expirations[-1] if expirations else "n/a"

                logger.info(
                    f"[{target_ticker}] Option chain: {len(contracts)} contracts across "
                    f"{len(expirations)} expirations (nearest {nearest_exp}, farthest {farthest_exp})"
                )

                # Compute core structural hedging levels using state-locked spot references
                gex_metrics = quant_engine.process_gex_profile(market_data)

                # Extract the flat chronological close price array required by the 30d HV engine
                historical_closes = [
                    bar["close"] for bar in underlying_history if bar.get("close") is not None
                ]

                # Compute 30-day realized volatility metrics via sorted bar lists
                hv_30d = quant_engine.calculate_historical_volatility_30d(historical_closes)

                # Compute the session-anchored VWAP and volume-weighted deviation bands
                vwap_bands = quant_engine.calculate_vwap_bands(intraday_bars)
                if not vwap_bands:
                    logger.warning(f"[{target_ticker}] VWAP bands unavailable (no/sparse intraday bars); VWAP fields set to null")

                # Massive returns IV as a decimal (0.486); express as a percentage to match hv_30d.
                atm_iv = market_data["atm_iv"] * 100.0

                # Formulate structural proxy for Volatility Risk Premium (VRP)
                iv_hv_ratio = round(atm_iv / hv_30d, 4) if hv_30d > 0.0 else 0.0

                # Derive a human-readable UTC timestamp from the nanosecond epoch value.
                snapshot_ns = int(market_data["timestamp"])
                timestamp_iso = (
                    datetime.fromtimestamp(snapshot_ns / 1e9, tz=timezone.utc).isoformat()
                    if snapshot_ns > 0 else None
                )

                # price = current (live/delayed) spot for display; gex_spot = the spot the
                # GEX/greek levels were actually computed at (the cash close after hours).
                # They coincide during RTH and differ after hours by post-close drift.
                display_spot = market_data.get("current_spot") or market_data["synchronized_spot"]

                # Commit mutations down to shared memory
                current_market_state.update({
                    "ticker": market_data["ticker"],
                    "price": display_spot,
                    "gex_spot": market_data["synchronized_spot"],
                    "timestamp": snapshot_ns,
                    "timestamp_iso": timestamp_iso,

                    "call_wall": gex_metrics["call_wall"],
                    "put_wall": gex_metrics["put_wall"],
                    "peak_gex_strike": gex_metrics["peak_gex_strike"],
                    "gamma_flip": gex_metrics["gamma_flip"],
                    "max_pain": gex_metrics["max_pain"],
                    "max_pain_expiration": gex_metrics["max_pain_expiration"],
                    "net_gex": gex_metrics["net_gex"],
                    "call_gex": gex_metrics["call_gex"],
                    "put_gex": gex_metrics["put_gex"],
                    "total_gex": gex_metrics["total_gex"],
                    "net_vanna": gex_metrics["net_vanna"],
                    "net_charm": gex_metrics["net_charm"],
                    "net_volga": gex_metrics["net_volga"],
                    "put_call_ratio": gex_metrics["put_call_ratio"],

                    "vwap": vwap_bands.get("vwap"),
                    "vwap_upper_2": vwap_bands.get("vwap_upper_2"),
                    "vwap_upper_3": vwap_bands.get("vwap_upper_3"),
                    "vwap_lower_2": vwap_bands.get("vwap_lower_2"),
                    "vwap_lower_3": vwap_bands.get("vwap_lower_3"),

                    "atm_iv": round(atm_iv, 4),
                    "hv_30d": hv_30d,
                    "iv_hv_ratio": iv_hv_ratio,
                    "net_flow": None,  # null until computed from the trades tape
                })

                s = current_market_state
                logger.info(
                    f"[{target_ticker}] Refresh complete | spot ${s['price']:.2f} | "
                    f"net GEX ${s['net_gex'] / 1e6:,.1f}M | gamma flip ${s['gamma_flip']:.2f} | "
                    f"call/put wall ${s['call_wall']:.0f}/${s['put_wall']:.0f} | "
                    f"ATM IV {s['atm_iv']:.2f}% | HV30 {s['hv_30d']:.2f}% | IV/HV {s['iv_hv_ratio']:.2f}"
                )

                # Per-strike profile kept separate (UI chart + diagnostics), not in the
                # AI-facing market_state payload.
                current_strike_profile[:] = gex_metrics["strike_profile"]

                with open("market_data.json", "w") as f:
                    json.dump(current_market_state, f, indent=4)

                with open("strike_profile.json", "w") as f:
                    json.dump(
                        {"ticker": s["ticker"], "spot": s["price"], "strikes": current_strike_profile},
                        f, indent=4,
                    )

            else:
                logger.warning(f"[{target_ticker}] No option-chain data returned; skipping this cycle")

        except asyncio.CancelledError:
            logger.info("Market data loop cancelled on shutdown")
            break
        except Exception as e:
            logger.error(f"[{target_ticker}] Market data refresh failed: {e}", exc_info=True)

        await asyncio.sleep(900)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global current_market_state
    if os.path.exists("market_data.json"):
        try:
            with open("market_data.json", "r") as f:
                current_market_state.update(json.load(f))
            logger.info("Loaded cached market state from market_data.json on startup")
        except Exception as e:
            logger.warning(f"Could not load cached market state from market_data.json: {e}")

    engine_task = asyncio.create_task(market_data_engine_loop())
    yield
    logger.info("Shutting down; stopping market data loop")
    engine_task.cancel()
    try:
        await engine_task
    except asyncio.CancelledError:
        logger.info("Market data loop stopped")


app = FastAPI(
    title="GammaFlow Volatility API",
    description="Serves localized option Greeks and net dealer profile aggregations natively from Massive SDK.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/market-data", response_model=MarketState)
async def get_market_data():
    if not current_market_state:
        raise HTTPException(
            status_code=503,
            detail="The market data engine is currently bootstrapping. Please try again shortly."
        )
    return current_market_state


@app.get("/api/strike-profile")
async def get_strike_profile():
    if not current_strike_profile:
        raise HTTPException(
            status_code=503,
            detail="The strike profile is currently bootstrapping. Please try again shortly."
        )
    return {
        "ticker": current_market_state.get("ticker"),
        "spot": current_market_state.get("price"),
        "strikes": current_strike_profile,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)