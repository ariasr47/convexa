"""Runnable check for the server-gated PUT /api/scan/view (Scanner v1 Plan 3 Task 4). No pytest, no
live uvicorn, no vendor key: TestClient against main.app. Proves the WRITE gate is server-side (a
cookieless PUT is refused, nothing persists), a signed-in PUT echoes + persists across a re-read, and
off-universe / bad-enum bodies are 422. Run: apps/api/.venv/Scripts/python.exe scan_view_write_selftest.py
(cwd = apps/api). 0=pass,1=fail."""
from __future__ import annotations

import os
import tempfile

os.environ.setdefault("SCAN_STORE_PATH", os.path.join(tempfile.mkdtemp(), "scan.sqlite3"))
# The signed-in path needs the session cookie to STICK over http (TestClient is http, not https).
os.environ["AUTH_COOKIE_SECURE"] = "false"

from fastapi.testclient import TestClient   # noqa: E402
import main                                 # noqa: E402

EMAIL = "viewtest@convexa.io"
PASSWORD = "convexa-view-2026"


def _signed_in_client() -> TestClient:
    main.auth.get_service().ensure_account(email=EMAIL, password=PASSWORD, display_name="View Test")
    c = TestClient(main.app)
    r = c.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200, f"login failed {r.status_code}: {r.text[:200]}"
    return c


def check_anon_gate() -> None:
    anon = TestClient(main.app)   # no cookie
    r = anon.put("/api/scan/view", json={"symbols": ["SPY"]})
    # a REAL auth refusal (repo precedent: 403 auth_required). NOT a 200, NOT a 422 (gate is outermost).
    assert r.status_code in (401, 403), f"cookieless PUT must be gate-refused, got {r.status_code}"


def check_signed_in_echo_and_persist(c: TestClient) -> None:
    body = {"symbols": ["qqq", "SPY"], "name": "Mine",
            "sort": {"key": "symbol", "dir": "asc"}, "density": "comfortable"}
    r = c.put("/api/scan/view", json=body)
    assert r.status_code == 200, f"signed-in PUT {r.status_code}: {r.text[:200]}"
    v = r.json()
    assert v["source"] == "account" and v["authenticated"] is True, v
    assert v["symbols"] == ["QQQ", "SPY"], f"canon/order: {v['symbols']}"   # lower-in -> UPPER-out
    assert v["sort"] == {"key": "symbol", "dir": "asc"} and v["density"] == "comfortable", v
    # persists across a re-read (AC-2): GET now returns the account view.
    v2 = c.get("/api/scan/view").json()
    assert v2["source"] == "account" and v2["symbols"] == ["QQQ", "SPY"], v2
    # and GET /api/scan reflects the saved view's symbols (order = the view).
    scan = c.get("/api/scan").json()
    assert scan["view"]["symbols"] == ["QQQ", "SPY"], scan["view"]


def check_422(c: TestClient) -> None:
    assert c.put("/api/scan/view", json={"symbols": ["ZZZZ"]}).status_code == 422, "off-universe symbol"
    assert c.put("/api/scan/view",
                 json={"symbols": ["SPY"], "sort": {"key": "nope", "dir": "asc"}}).status_code == 422, "bad sort.key"
    assert c.put("/api/scan/view",
                 json={"symbols": ["SPY"], "density": "cozy"}).status_code == 422, "bad density"
    assert c.put("/api/scan/view", json={"symbols": []}).status_code == 422, "empty symbols"


def main_() -> int:
    try:
        check_anon_gate()
        c = _signed_in_client()
        check_signed_in_echo_and_persist(c)
        check_422(c)
    except AssertionError as e:
        print(f"FAIL: {e}")
        return 1
    print("PASS: PUT /api/scan/view server-gated (403 anon) + 200 echo/persist + 422 validation")
    return 0


if __name__ == "__main__":
    raise SystemExit(main_())
