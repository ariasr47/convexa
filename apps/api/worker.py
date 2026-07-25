"""Scanner sweep WORKER — the NET-NEW 2nd process (Scanner v1 Plan 2, crux b). Built from the SAME
apps/api image with a DIFFERENT start command (the Railway 2nd-service shape). It exposes NO HTTP
surface; its only outputs are writes to the ScanStore. All config is RUNTIME env-injected
([no-secrets-in-image]).

It REUSES the web module verbatim — main.compute_ticker (the UNCHANGED sole transform),
main._acquire_vendor_inputs (the concurrent + pre-warm-aware vendor acquisition), main.data_provider,
and main's tier bands — so a scanner row is byte-identical to what the Ticker page would compute. The
worker adds NO scoring math.

Run modes:
  - STANDALONE (production): `python worker.py`  (nx: `nx run api:serve-worker`).
  - EMBEDDED (one-terminal dev): set SCANNER_EMBEDDED=1 and run the normal dev server; main.py's
    guarded startup hook (Task 7 Step 2) launches run_worker() inside the API process.

Lifecycle: the loop runs until cancelled; main_entry() adds a restart-with-backoff guard so a fatal
error (e.g. a bad universe config surfaced at start) is logged and retried rather than crash-looping
hot. In production, Railway's restart policy is the outer supervisor."""
from __future__ import annotations

import asyncio
import logging
import os
import sys
import time

import main  # the UNCHANGED web module (imports it; does NOT start uvicorn — that's under __main__)
from src import scanstore
from src.scanner import loop as sweep_loop
from src.scanner.loop import LoopConfig, LoopDeps
from src.scanner.projection import TierBands
from src.scanner.tiering import SweepConfig
from src.scanner.universe import load_universe

logger = logging.getLogger("Convexa")


def _loop_config() -> LoopConfig:
    """All cadence/threshold tunables from RUNTIME env, D4 defaults."""
    return LoopConfig(
        fast_interval=float(os.getenv("SCAN_FAST_INTERVAL_SECONDS", "30")),
        stale_after=float(os.getenv("SCAN_STALE_AFTER_SECONDS", "180")),
        sweep=SweepConfig(
            move_threshold_pct=float(os.getenv("SCAN_MOVE_THRESHOLD_PCT", "0.75")),
            slow_batch_size=int(os.getenv("SCAN_SLOW_BATCH_SIZE", "4")),
            promotion_cap=int(os.getenv("SCAN_PROMOTION_CAP", "2")),
        ),
    )


def _fetch_snapshots(symbols: list[str]) -> dict:
    """Fast-lane poll via the injected provider's net-new multi-ticker snapshot method."""
    return main.data_provider.fetch_stock_snapshots(symbols)


async def _compute_bundle(ticker: str) -> "dict | None":
    """The slow-lane compute: EXACTLY the web serve path — concurrent vendor acquisition, then the
    unchanged compute_ticker in a worker thread. Same inputs in -> byte-identical bundle out."""
    market_data, underlying_history, intraday_bars, _src = await main._acquire_vendor_inputs(
        ticker, dark_pool=main.INCLUDE_DARK_POOL)
    return await asyncio.to_thread(
        main.compute_ticker, ticker, market_data, underlying_history, intraday_bars,
        dark_pool=main.INCLUDE_DARK_POOL)


def build_deps() -> LoopDeps:
    """Wire the real deps: the checked-in universe, the env-selected store, the live provider, and
    main's tier bands."""
    cfg = load_universe()
    store = scanstore.get_store()
    bands = TierBands(watch=main.TIER_WATCH_SCORE, actionable=main.TIER_ACTIONABLE_SCORE,
                      prime=main.TIER_PRIME_SCORE)
    return LoopDeps(universe=cfg.universe, store=store, bands=bands,
                    fetch_snapshots=_fetch_snapshots, compute_bundle=_compute_bundle,
                    clock=time.time, sleep=asyncio.sleep, config=_loop_config())


async def run_worker(stop_event: "asyncio.Event | None" = None,
                     max_slow_cycles: "int | None" = None) -> None:
    """Build deps once (universe read at start — D3) and run the two-speed loop."""
    deps = build_deps()
    await sweep_loop.run(deps, stop_event=stop_event, max_slow_cycles=max_slow_cycles)


def main_entry() -> None:
    """Standalone-process entry with a restart-with-backoff guard (fatal errors retried, not hot-
    looped). In production Railway's restart policy is the outer supervisor."""
    logger.info("[worker] Scanner sweep worker starting (standalone)")
    backoff = 2.0
    while True:
        try:
            asyncio.run(run_worker())
            return  # normal completion (only happens if the loop returns; it runs forever otherwise)
        except KeyboardInterrupt:
            logger.info("[worker] interrupted; shutting down")
            return
        except Exception:
            logger.exception(f"[worker] fatal error; restarting in {backoff:.0f}s")
            time.sleep(backoff)
            backoff = min(backoff * 2, 60.0)


if __name__ == "__main__":
    sys.exit(main_entry())
