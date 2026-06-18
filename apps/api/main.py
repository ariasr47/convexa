import asyncio
import sys
import logging
import json
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from src.core.engine import QuantEngine
from src.core.massive_client import MassiveDataInterface
from src.models.market_data import MarketState

formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
stream_handler = logging.StreamHandler(sys.stdout)
stream_handler.setFormatter(formatter)
stream_handler.flush = sys.stdout.flush

logger = logging.getLogger("GammaFlowAsync")
logger.setLevel(logging.INFO)
logger.addHandler(stream_handler)
logger.propagate = False

quant_engine = QuantEngine(risk_free_rate=0.045)
data_provider = MassiveDataInterface()
current_market_state = {}


async def market_data_engine_loop():
    """Background loop processing native SDK responses into unified memory structures."""
    target_ticker = "TSLA"

    while True:
        try:
            logger.info(f"Requesting synchronized macro frame for {target_ticker}")

            # 1. Gather Option Chain Snapshot Framework via SDK Client
            market_data = await asyncio.to_thread(
                data_provider.fetch_synchronized_options_market_state, target_ticker
            )

            # 2. Gather Underlier Historical Closing Bars via SDK Client
            underlying_history = await asyncio.to_thread(
                data_provider.fetch_historical_underlying_metrics, target_ticker
            )

            if market_data and market_data.get("synchronized_spot", 0) > 0:
                contracts = market_data.get("contracts", [])
                exp_counts = {}
                for c in contracts:
                    exp = c.get("expiration_date")
                    exp_counts[exp] = exp_counts.get(exp, 0) + 1

                sorted_exps = dict(sorted(exp_counts.items()))

                logger.info(f"--- SDK CHAIN RECONCILIATION VERIFICATION ---")
                logger.info(f"Total Unique Expiration Dates: {len(sorted_exps)}")
                logger.info(f"Nearest Expiration Cycle: {list(sorted_exps.keys())[:1]}")
                logger.info(f"---------------------------------------------")

                # Compute core structural hedging levels using state-locked spot references
                gex_metrics = quant_engine.process_gex_profile(market_data)

                # Extract the flat chronological close price array required by the 30d HV engine
                historical_closes = [
                    bar["close"] for bar in underlying_history if bar.get("close") is not None
                ]

                # Isolate the current day's VWAP anchor from the end of the chronological list
                latest_raw_vwap = (
                    underlying_history[-1]["vwap"]
                    if underlying_history and underlying_history[-1].get("vwap") is not None
                    else 0.0
                )

                # Compute 30-day realized volatility metrics via sorted bar lists
                hv_30d = quant_engine.calculate_historical_volatility_30d(historical_closes)

                # Compute statistical deviation bands around our active VWAP anchor
                vwap_bands = quant_engine.calculate_vwap_bands(latest_raw_vwap, historical_closes)

                # Massive returns IV as a decimal (0.486); express as a percentage to match hv_30d.
                atm_iv = market_data["atm_iv"] * 100.0

                # Formulate structural proxy for Volatility Risk Premium (VRP)
                iv_hv_ratio = round(atm_iv / hv_30d, 4) if hv_30d > 0.0 else 0.0

                # Commit mutations down to shared memory
                current_market_state.update({
                    "ticker": market_data["ticker"],
                    "price": market_data["synchronized_spot"],
                    "timestamp": market_data["timestamp"],

                    "call_wall": gex_metrics["call_wall"],
                    "put_wall": gex_metrics["put_wall"],
                    "gamma_flip": gex_metrics["gamma_flip"],
                    "net_gex": gex_metrics["net_gex"],
                    "net_vanna": gex_metrics["net_vanna"],
                    "net_charm": gex_metrics["net_charm"],
                    "net_volga": gex_metrics["net_volga"],
                    "put_call_ratio": gex_metrics["put_call_ratio"],

                    "vwap": vwap_bands["vwap"],
                    "vwap_upper_2": vwap_bands["vwap_upper_2"],
                    "vwap_upper_3": vwap_bands["vwap_upper_3"],
                    "vwap_lower_2": vwap_bands["vwap_lower_2"],
                    "vwap_lower_3": vwap_bands["vwap_lower_3"],

                    "atm_iv": round(atm_iv, 4),
                    "hv_30d": hv_30d,
                    "iv_hv_ratio": iv_hv_ratio,
                    "net_flow": 0.0,

                    "macro_priority": "General",
                    "news_summary": None
                })

                logger.info(
                    f"Frame Complete. Spot Locked: ${current_market_state['price']} | "
                    f"HV_30d: {current_market_state['hv_30d']}% | "
                    f"Net GEX: ${current_market_state['net_gex']}"
                )

                with open("market_data.json", "w") as f:
                    json.dump(current_market_state, f, indent=4)

            else:
                logger.warning("Empty data frame received from provider.")

        except asyncio.CancelledError:
            logger.info("Engine loop task cancelled via server lifespan shutdown.")
            break
        except Exception as e:
            logger.error(f"Error encountered during refresh loop: {str(e)}")

        await asyncio.sleep(900)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global current_market_state
    if os.path.exists("market_data.json"):
        try:
            with open("market_data.json", "r") as f:
                current_market_state.update(json.load(f))
            logger.info("Successfully seeded local memory from market_data.json cache on startup.")
        except Exception as e:
            logger.warning(f"Failed to bootstrap memory cache from disk: {e}")

    engine_task = asyncio.create_task(market_data_engine_loop())
    yield
    logger.info("Initiating structural cleanup sequence...")
    engine_task.cancel()
    try:
        await engine_task
    except asyncio.CancelledError:
        logger.info("Background options ingestion thread terminated safely.")


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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)