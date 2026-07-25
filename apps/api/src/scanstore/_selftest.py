"""Runnable ScanStore behaviour + parity check (Scanner v1 Plan 1). No pytest (apps/api convention).
Run: apps/api/.venv/Scripts/python.exe -m src.scanstore._selftest   (cwd = apps/api)
Exits 0 = all pass, 1 = a failure (prints which). Uses a temp on-disk sqlite so nothing persists."""
from __future__ import annotations

import os
import tempfile

from .ports import BundleBlob, ScanRow, SweepHeartbeat


def _row(symbol: str, score: float, status: str = "ok", as_of: float = 1.0) -> ScanRow:
    return ScanRow(symbol=symbol, price=100.0, chg_pct=0.5, score=score, tier="prime",
                   regime="pinned", vol_regime="calm", flip=95.0, dist_to_flip_pct=-5.0,
                   call_wall=110.0, put_wall=90.0, dist_to_wall_pct=10.0, as_of=as_of, status=status)


def _make_sqlite():
    from .sqlite_store import SqliteScanStore, _SharedDB
    fd, path = tempfile.mkstemp(suffix=".sqlite3")
    os.close(fd)
    return SqliteScanStore(_SharedDB(path)), path


def run_store_contract(store) -> None:
    """The behaviour contract every adapter must satisfy. Called per-adapter for parity."""
    # 1. wiped/empty store: no rows, no heartbeat.
    assert store.read_rows() == [], "empty store must return []"
    assert store.read_heartbeat() is None, "empty store heartbeat must be None"

    # 2. upsert + read-all (symbol-ascending, canonical upper-case).
    store.upsert_row(_row("spy", 80.0))   # lower-case in -> canonical out
    store.upsert_row(_row("QQQ", 60.0))
    allrows = store.read_rows()
    assert [r.symbol for r in allrows] == ["QQQ", "SPY"], f"order/canon wrong: {[r.symbol for r in allrows]}"

    # 3. latest-wins (NOT insert-if-absent): re-upsert SPY overwrites.
    store.upsert_row(_row("SPY", 42.0, status="stale", as_of=2.0))
    spy = store.read_rows(["SPY"])
    assert len(spy) == 1 and spy[0].score == 42.0 and spy[0].status == "stale" and spy[0].as_of == 2.0, \
        f"latest-wins failed: {spy}"

    # 4. subset read: missing symbols simply absent (no placeholder rows).
    subset = store.read_rows(["SPY", "NOPE"])
    assert [r.symbol for r in subset] == ["SPY"], f"subset should drop unknown: {[r.symbol for r in subset]}"
    assert store.read_rows([]) == [], "empty symbol list -> []"

    # 5. heartbeat round-trip + overwrite.
    store.write_heartbeat(SweepHeartbeat(updated_at=10.0, sweep_last_completed=None, universe_size=2))
    hb = store.read_heartbeat()
    assert hb is not None and hb.universe_size == 2 and hb.sweep_last_completed is None, f"hb1 {hb}"
    store.write_heartbeat(SweepHeartbeat(updated_at=20.0, sweep_last_completed=19.0, universe_size=3))
    hb = store.read_heartbeat()
    assert hb.updated_at == 20.0 and hb.sweep_last_completed == 19.0 and hb.universe_size == 3, f"hb2 {hb}"

    # 7. bundle-blob: absent -> None, write -> read round-trip, latest-wins overwrite.
    assert store.read_bundle_blob("SPY") is None, "absent blob must be None"
    store.write_bundle_blob(BundleBlob(symbol="spy", as_of=5.0, bundle_json='{"v":1}'))
    b = store.read_bundle_blob("SPY")   # lower-case in -> canonical read
    assert b is not None and b.symbol == "SPY" and b.as_of == 5.0 and b.bundle_json == '{"v":1}', f"blob rt {b}"
    store.write_bundle_blob(BundleBlob(symbol="SPY", as_of=6.0, bundle_json='{"v":2}'))
    b = store.read_bundle_blob("SPY")
    assert b.as_of == 6.0 and b.bundle_json == '{"v":2}', f"blob latest-wins failed: {b}"

    # 6. to_wire shape is stable (the conformance spec pins these keys).
    assert set(spy[0].to_wire().keys()) == {
        "symbol", "price", "chg_pct", "score", "tier", "regime", "vol_regime", "flip",
        "dist_to_flip_pct", "call_wall", "put_wall", "dist_to_wall_pct", "as_of", "status"}, "wire keys drift"


def main() -> int:
    store, path = _make_sqlite()
    try:
        run_store_contract(store)
    except AssertionError as e:
        print(f"FAIL (sqlite): {e}")
        return 1
    finally:
        for p in (path, path + "-wal", path + "-shm"):
            try:
                os.remove(p)
            except OSError:
                pass
    print("PASS: SqliteScanStore satisfies the store contract")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
