"""Embedded-mode runnable check for the two-speed loop (Scanner v1 Plan 2 Task 6). No pytest, NO live
vendor key: a stub snapshot fn + a canned async compute fn drive a bounded run against a REAL
SqliteScanStore (temp file). Proves rows land (ok), the bundle-blob is written, the heartbeat carries
the universe size + a completed full pass, and a store outage does NOT crash the loop.
Run: apps/api/.venv/Scripts/python.exe -m src.scanner.loop_selftest  (cwd = apps/api). 0=pass,1=fail."""
from __future__ import annotations

import asyncio
import json
import os
import tempfile

from src.scanstore.sqlite_store import SqliteScanStore, _SharedDB

from .loop import LoopConfig, LoopDeps, run
from .projection import TierBands
from .tiering import SweepConfig

UNIV = ["AAA", "BBB", "CCC"]
BANDS = TierBands(watch=25, actionable=50, prime=75)


def _canned_bundle(sym: str) -> dict:
    return {
        "market_state": {"price": 100.0, "gamma_flip": 95.0, "call_wall": 110.0,
                         "put_wall": 90.0, "timestamp": 0},
        "signals": {"opportunity_score": 80, "regime": "positive_gamma", "vol_regime": "iv_rich"},
        "ai_eval": {"ready": True},
        "_snapshot": {"ticker": sym, "synchronized_spot": 100.0},
    }


def _stub_snapshots(tickers):
    # Price every symbol; BBB moved far vs a would-be last-compute price (exercises move flag path).
    return {t.upper(): {"symbol": t.upper(),
                        "price": 100.0 if t.upper() != "BBB" else 130.0,
                        "chg_pct": 1.0, "as_of_ns": 1}
            for t in tickers}


async def _compute(sym: str) -> dict:
    return _canned_bundle(sym)


def _make_store():
    fd, path = tempfile.mkstemp(suffix=".sqlite3")
    os.close(fd)
    return SqliteScanStore(_SharedDB(path)), path


def _fake_clock():
    t = {"v": 1000.0}
    def clock():
        t["v"] += 1.0
        return t["v"]
    return clock


async def _noop_sleep(_):  # deterministic: no real waiting
    return None


async def _run_ok(store) -> None:
    deps = LoopDeps(universe=UNIV, store=store, bands=BANDS,
                    fetch_snapshots=_stub_snapshots, compute_bundle=_compute,
                    clock=_fake_clock(), sleep=_noop_sleep,
                    config=LoopConfig(fast_interval=30.0, stale_after=180.0,
                                      sweep=SweepConfig(slow_batch_size=2, promotion_cap=1)))
    # batch size 2 over 3 symbols -> 2 cycles guarantees a full pass.
    await run(deps, max_slow_cycles=2)


class _BrokenStore(SqliteScanStore):
    def upsert_row(self, row):  # simulate a store outage on writes
        raise RuntimeError("store down")
    def write_heartbeat(self, hb):
        raise RuntimeError("store down")
    def write_bundle_blob(self, blob):
        raise RuntimeError("store down")


async def _run_store_outage(path2) -> None:
    broken = _BrokenStore(_SharedDB(path2))
    deps = LoopDeps(universe=UNIV, store=broken, bands=BANDS,
                    fetch_snapshots=_stub_snapshots, compute_bundle=_compute,
                    clock=_fake_clock(), sleep=_noop_sleep,
                    config=LoopConfig(sweep=SweepConfig(slow_batch_size=2, promotion_cap=1)))
    await run(deps, max_slow_cycles=2)   # must NOT raise despite every write failing


def run_all() -> None:
    store, path = _make_store()
    _, path2 = _make_store()
    try:
        asyncio.run(_run_ok(store))
        rows = {r.symbol: r for r in store.read_rows()}
        assert set(rows) == set(UNIV), f"all symbols persisted, got {set(rows)}"
        assert all(r.status == "ok" for r in rows.values()), \
            f"all rows computed ok, got {[(s, r.status) for s, r in rows.items()]}"
        assert rows["AAA"].score == 80 and rows["AAA"].tier == "prime", rows["AAA"]
        # bundle-blob written for every symbol (warm-click source).
        for s in UNIV:
            blob = store.read_bundle_blob(s)
            assert blob is not None, f"missing bundle-blob for {s}"
            assert json.loads(blob.bundle_json)["signals"]["opportunity_score"] == 80, s
        hb = store.read_heartbeat()
        assert hb is not None and hb.universe_size == 3, hb
        assert hb.sweep_last_completed is not None, "a full pass must mark sweep_last_completed"

        # store outage: the loop must survive every write failing (best-effort isolation).
        asyncio.run(_run_store_outage(path2))
    finally:
        for p in (path, path + "-wal", path + "-shm", path2, path2 + "-wal", path2 + "-shm"):
            try:
                os.remove(p)
            except OSError:
                pass


def main() -> int:
    try:
        run_all()
    except AssertionError as e:
        print(f"FAIL: {e}")
        return 1
    print("PASS: two-speed loop persists rows+blobs+heartbeat and survives a store outage")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
