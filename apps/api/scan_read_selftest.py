"""Runnable check for GET /api/scan + GET /api/scan/view (Scanner v1 Plan 3 Task 3). No pytest, no
live uvicorn, no vendor key: TestClient against main.app, with a real row injected into the store to
exercise building-fill. Run: apps/api/.venv/Scripts/python.exe scan_read_selftest.py (cwd=apps/api)."""
from __future__ import annotations

import os
import tempfile

os.environ.setdefault("SCAN_STORE_PATH", os.path.join(tempfile.mkdtemp(), "scan.sqlite3"))

from fastapi.testclient import TestClient   # noqa: E402
import main                                 # noqa: E402
from src.scanstore import ScanRow           # noqa: E402

client = TestClient(main.app)


def _ok_row(sym: str) -> ScanRow:
    return ScanRow(symbol=sym, price=500.0, chg_pct=1.2, score=82.0, tier="prime",
                   regime="positive_gamma", vol_regime="iv_rich", flip=495.0, dist_to_flip_pct=1.0,
                   call_wall=510.0, put_wall=490.0, dist_to_wall_pct=-2.0, as_of=1000.0, status="ok")


def check_view_default() -> None:
    r = client.get("/api/scan/view")
    assert r.status_code == 200, f"view status {r.status_code}"
    v = r.json()
    assert v["source"] == "default" and v["authenticated"] is False, v
    assert isinstance(v["symbols"], list) and v["symbols"], v
    assert v["sort"] == {"key": "score", "dir": "desc"} and v["density"] == "compact", v
    assert v["name"] is None, v


def check_scan_building_fill() -> None:
    # Inject a real row for a default-view symbol (SPY is in the shipped config's default_view).
    main.scanstore.get_store().upsert_row(_ok_row("SPY"))
    r = client.get("/api/scan")
    assert r.status_code == 200, f"scan status {r.status_code}"
    body = r.json()
    assert set(body) >= {"view", "rows", "sweep"}, f"envelope keys: {set(body)}"
    rows = {row["symbol"]: row for row in body["rows"]}
    # every view symbol is present (building-fill): no dead screen.
    assert set(rows) == set(body["view"]["symbols"]), \
        f"building-fill gap: {set(rows)} vs {body['view']['symbols']}"
    # the stored row is returned as-is (ok + consumed score).
    assert rows["SPY"]["status"] == "ok" and rows["SPY"]["score"] == 82.0, rows["SPY"]
    # a symbol with no stored row is a synthesized building placeholder (nulls, as_of=0.0).
    other = next(s for s in body["view"]["symbols"] if s != "SPY")
    assert rows[other]["status"] == "building" and rows[other]["as_of"] == 0.0, rows[other]
    assert rows[other]["score"] is None and rows[other]["price"] is None, rows[other]
    # sweep is object|null — null on a fresh boot (no heartbeat written).
    assert body["sweep"] is None or isinstance(body["sweep"], dict), body["sweep"]
    # row wire keys are the FIXED P1 ScanRow.to_wire keys (no rename/add).
    assert set(rows["SPY"]) == {
        "symbol", "price", "chg_pct", "score", "tier", "regime", "vol_regime", "flip",
        "dist_to_flip_pct", "call_wall", "put_wall", "dist_to_wall_pct", "as_of", "status"}, rows["SPY"]


def main_() -> int:
    try:
        check_view_default()
        check_scan_building_fill()
    except AssertionError as e:
        print(f"FAIL: {e}")
        return 1
    print("PASS: /api/scan default-view + building-fill + /api/scan/view (anonymous-open, 200)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main_())
