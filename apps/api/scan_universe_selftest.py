"""Runnable check for GET /api/scan/universe + the route-registration-order invariant (Scanner v1
Plan 3 Task 2). No pytest, no live uvicorn, no vendor key: FastAPI's TestClient against main.app.
Run: apps/api/.venv/Scripts/python.exe scan_universe_selftest.py  (cwd = apps/api). 0=pass,1=fail."""
from __future__ import annotations

import os
import tempfile

# Point the scan store at a throwaway sqlite so nothing writes into ./data (the store is opened
# lazily on first /api/scan* hit). Set BEFORE importing main.
os.environ.setdefault("SCAN_STORE_PATH", os.path.join(tempfile.mkdtemp(), "scan.sqlite3"))

from fastapi.testclient import TestClient   # noqa: E402
import main                                 # noqa: E402

client = TestClient(main.app)


def _route_index(path: str) -> int:
    for i, r in enumerate(main.app.routes):
        if getattr(r, "path", None) == path:
            return i
    return -1


def check_universe() -> None:
    r = client.get("/api/scan/universe")
    assert r.status_code == 200, f"universe status {r.status_code}"
    body = r.json()
    assert isinstance(body.get("symbols"), list) and body["symbols"], f"symbols empty: {body}"
    assert body.get("universe_size") == len(body["symbols"]), f"size mismatch: {body}"
    # not swallowed as a ticker: this is the universe envelope, NOT a ticker bundle.
    assert "market_state" not in body, "universe route swallowed by a ticker handler"


def check_route_order() -> None:
    catchall = _route_index("/{ticker}")
    assert catchall >= 0, "the /{ticker} catch-all route must exist"
    for p in ("/api/scan", "/api/scan/universe", "/api/scan/view"):
        idx = _route_index(p)
        assert idx >= 0, f"scan route {p} is not registered"
        assert idx < catchall, f"{p} (idx {idx}) must register BEFORE /{{ticker}} (idx {catchall})"


def main_() -> int:
    try:
        check_universe()
        check_route_order()
    except AssertionError as e:
        print(f"FAIL: {e}")
        return 1
    print("PASS: /api/scan/universe envelope + scan routes register before the /{ticker} catch-all")
    return 0


if __name__ == "__main__":
    raise SystemExit(main_())
