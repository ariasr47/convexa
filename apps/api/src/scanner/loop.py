"""The two-speed sweep loop (Scanner v1 Plan 2). FAST lane: one multi-ticker snapshot poll (~30s) ->
prices + move detection (feeds the promotion set). SLOW lane: a concurrency-bounded chain sweep
(pool == slow_batch_size) through the UNCHANGED compute_ticker -> one ScanRow per ticker, latest-wins
into the store, plus the bundle-blob for the warm-click. HEARTBEAT every tick + last-completed-pass.

All I/O is INJECTED (fetch_snapshots / compute_bundle / store / clock / sleep) so the loop is testable
against a stub with no live key. Both lanes run as cooperative asyncio tasks on ONE event loop, so the
shared SweepState needs no lock (single-threaded). Every store call is best-effort: a store outage
skips the write and the loop keeps running ([best-effort-isolated-or-null]); a per-ticker compute
failure degrades that row to `error` and the sweep continues."""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Awaitable, Callable, Optional

from src.core.live import classify_session
from src.scanstore import BundleBlob, ScanRow, ScanStore, SweepHeartbeat

from .projection import (TierBands, project_building, project_error, project_price_only,
                         project_row, refresh_status)
from .session_gate import should_sweep
from .tiering import SweepConfig, SymbolSched, plan_cycle, pct_move

logger = logging.getLogger("Convexa")


@dataclass
class LoopConfig:
    fast_interval: float = 30.0     # D4 fast-lane poll cadence (seconds)
    stale_after: float = 180.0      # structure freshness budget (~3 min) -> `stale`
    # Heartbeat cadence while the market-hours gate holds the sweep off. Slow on purpose: it exists
    # only so an intentionally idle worker stays distinguishable from a dead one.
    idle_interval: float = 300.0
    sweep: SweepConfig = field(default_factory=SweepConfig)


@dataclass
class LoopDeps:
    universe: list[str]
    store: ScanStore
    bands: TierBands
    fetch_snapshots: Callable[[list[str]], dict]                 # sync -> {symbol: StockSnapshot}
    compute_bundle: Callable[[str], Awaitable[Optional[dict]]]   # async -> bundle | None
    clock: Callable[[], float]
    sleep: Callable[[float], Awaitable[None]]
    config: LoopConfig = field(default_factory=LoopConfig)
    # Injected like every other input so the gate is testable without controlling the clock.
    session: Callable[[], str] = classify_session


class SweepState:
    """Mutable per-run state (single event loop; no lock)."""
    def __init__(self, universe: list[str]):
        self.universe = universe
        self.scheds: dict[str, SymbolSched] = {s: SymbolSched(s, None, None) for s in universe}
        self.rows: dict[str, ScanRow] = {s: project_building(s) for s in universe}
        self.prices: dict[str, tuple] = {}          # symbol -> (price, chg_pct)
        self.moved: set = set()                     # symbols flagged by the fast lane
        self.rr_cursor: int = 0
        self.swept_since_pass: set = set()          # symbols computed since the last full-pass marker
        self.sweep_last_completed: Optional[float] = None


# --- best-effort store wrappers (a store outage must never break the loop) ---
def _safe_upsert(store: ScanStore, row: ScanRow) -> None:
    try:
        store.upsert_row(row)
    except Exception:
        logger.debug("scan loop: upsert_row skipped (store outage)", exc_info=True)


def _safe_heartbeat(store: ScanStore, hb: SweepHeartbeat) -> None:
    try:
        store.write_heartbeat(hb)
    except Exception:
        logger.debug("scan loop: write_heartbeat skipped (store outage)", exc_info=True)


def _safe_blob(store: ScanStore, symbol: str, bundle: dict, as_of: float) -> None:
    try:
        import json
        store.write_bundle_blob(BundleBlob(symbol=symbol.upper(), as_of=as_of,
                                           bundle_json=json.dumps(bundle, default=str)))
    except Exception:
        logger.debug("scan loop: write_bundle_blob skipped", exc_info=True)


async def fast_tick(deps: LoopDeps, st: SweepState) -> None:
    """One fast-lane poll: update prices + move flags for the whole universe, upsert each row, beat."""
    now = deps.clock()
    try:
        snaps = await asyncio.to_thread(deps.fetch_snapshots, deps.universe)
    except Exception:
        logger.warning("scan loop: snapshot poll failed; freezing prices", exc_info=True)
        snaps = {}
    for sym in deps.universe:
        snap = snaps.get(sym)
        prev = st.rows.get(sym)
        if snap is not None and snap.get("price") is not None:
            price, chg = snap["price"], snap.get("chg_pct")
            st.prices[sym] = (price, chg)
            sched = st.scheds[sym]
            mv = pct_move(sched.last_compute_price, price)
            if mv is not None and mv > deps.config.sweep.move_threshold_pct:
                st.moved.add(sym)
            st.rows[sym] = project_price_only(sym, prev, price, chg, now, deps.config.stale_after)
        else:
            # No price this poll -> freeze the row, just age the status ([best-effort-...]).
            st.rows[sym] = refresh_status(prev, now, deps.config.stale_after)
        _safe_upsert(deps.store, st.rows[sym])
    _safe_heartbeat(deps.store, SweepHeartbeat(updated_at=now,
                    sweep_last_completed=st.sweep_last_completed, universe_size=len(deps.universe)))


async def slow_cycle(deps: LoopDeps, st: SweepState) -> None:
    """One slow-lane cycle: plan the batch (promotions + round-robin), compute it concurrently through
    the UNCHANGED compute_bundle, project + persist each row + its bundle-blob."""
    now = deps.clock()
    prices = {s: st.prices.get(s, (None, None))[0] for s in deps.universe}
    plan = plan_cycle(deps.universe, st.scheds, prices, st.rr_cursor,
                      deps.config.sweep, now, moved=list(st.moved))
    st.rr_cursor = plan.next_cursor

    async def _compute_one(sym: str) -> None:
        try:
            bundle = await deps.compute_bundle(sym)
        except Exception:
            logger.warning(f"[{sym}] scan compute failed; row -> error", exc_info=True)
            bundle = None
        cnow = deps.clock()
        if bundle is None:
            st.rows[sym] = project_error(sym, st.rows.get(sym), cnow)
        else:
            price, chg = st.prices.get(sym, (None, None))
            st.rows[sym] = project_row(sym, bundle, cnow, deps.bands, price=price, chg_pct=chg)
            anchor = (bundle.get("market_state", {}) or {}).get("price")
            st.scheds[sym] = SymbolSched(sym, cnow, anchor)
            st.moved.discard(sym)
            _safe_blob(deps.store, sym, bundle, cnow)
        _safe_upsert(deps.store, st.rows[sym])
        st.swept_since_pass.add(sym)

    # Bounded concurrency == the batch size (== pool). gather is fine: the batch is already capped.
    await asyncio.gather(*[_compute_one(s) for s in plan.batch])

    # Full-pass completion: every universe symbol computed at least once since the last marker.
    if set(deps.universe).issubset(st.swept_since_pass):
        st.sweep_last_completed = deps.clock()
        st.swept_since_pass = set()
        _safe_heartbeat(deps.store, SweepHeartbeat(updated_at=deps.clock(),
                        sweep_last_completed=st.sweep_last_completed, universe_size=len(deps.universe)))


def _idle_heartbeat(deps: LoopDeps, st: SweepState) -> None:
    """Write the heartbeat WITHOUT sweeping, so a deliberately-resting worker stays distinguishable
    from a dead one (`model-read-carries-its-assumptions`; the shipped worker-down banner keys off
    heartbeat age). `sweep_last_completed` is carried forward UNCHANGED — the page must keep showing
    honestly how old the structure data is, not pretend a pass just finished."""
    _safe_heartbeat(deps.store, SweepHeartbeat(updated_at=deps.clock(),
                    sweep_last_completed=st.sweep_last_completed,
                    universe_size=len(deps.universe)))


async def _fast_lane(deps: LoopDeps, st: SweepState, stop: asyncio.Event) -> None:
    idle = False
    while not stop.is_set():
        if should_sweep(deps.session):
            if idle:
                logger.info("[worker] market-hours gate: session covered -> resuming the sweep")
                idle = False
            await fast_tick(deps, st)
            await deps.sleep(deps.config.fast_interval)
        else:
            if not idle:
                logger.info("[worker] market-hours gate: outside vendor coverage -> idling the "
                            "sweep; heartbeat continues every %ss", deps.config.idle_interval)
                idle = True
            _idle_heartbeat(deps, st)
            await deps.sleep(deps.config.idle_interval)


async def _slow_lane(deps: LoopDeps, st: SweepState, stop: asyncio.Event,
                     max_slow_cycles: Optional[int], *, respect_gate: bool = True) -> None:
    cycles = 0
    while not stop.is_set():
        # The expensive lane — this is the one actually re-fetching whole option chains overnight.
        # It writes no heartbeat while idle: the fast lane owns that, so the two cannot disagree.
        if respect_gate and not should_sweep(deps.session):
            await deps.sleep(deps.config.idle_interval)
            continue
        await slow_cycle(deps, st)
        cycles += 1
        if max_slow_cycles is not None and cycles >= max_slow_cycles:
            return
        await deps.sleep(0)   # yield; the slow lane runs compute-bound, back-to-back


async def run(deps: LoopDeps, *, stop_event: Optional[asyncio.Event] = None,
              max_slow_cycles: Optional[int] = None) -> None:
    """Run the two-speed loop. Seeds `building` rows + an initial heartbeat immediately so the store
    is populated before the first compute. `max_slow_cycles` bounds the slow lane for tests (and runs
    a deterministic fast_tick first so move detection + prices are exercised)."""
    st = SweepState(deps.universe)
    now0 = deps.clock()
    for sym in deps.universe:
        _safe_upsert(deps.store, st.rows[sym])
    _safe_heartbeat(deps.store, SweepHeartbeat(updated_at=now0, sweep_last_completed=None,
                                               universe_size=len(deps.universe)))
    stop = stop_event or asyncio.Event()

    if max_slow_cycles is not None:
        # Deterministic bounded run (tests): one fast poll, then the slow lane to completion.
        # `respect_gate=False` ON PURPOSE. This path must complete a fixed number of cycles; with
        # the gate on it would idle forever whenever the suite happens to run outside 04:00–20:00 ET
        # or at a weekend, turning every scanner test into a time-of-day flake. The gate is covered
        # directly in test_scanner_session_gate.py instead, which is where it belongs.
        await fast_tick(deps, st)
        await _slow_lane(deps, st, stop, max_slow_cycles, respect_gate=False)
        stop.set()
        return

    logger.info(f"[worker] sweep loop start: universe={len(deps.universe)}, "
                f"fast={deps.config.fast_interval}s, pool={deps.config.sweep.slow_batch_size}")
    tasks = [asyncio.create_task(_fast_lane(deps, st, stop)),
             asyncio.create_task(_slow_lane(deps, st, stop, None))]
    try:
        await asyncio.gather(*tasks)
    finally:
        stop.set()
        for t in tasks:
            t.cancel()
