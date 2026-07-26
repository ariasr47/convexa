"""Runnable check for the ticker warm-click read-through (Scanner v1 Plan 3 Task 5). No pytest, no
live uvicorn, no vendor key: unit-tests main._scan_warm_bundle (freshness / tracked-only / canonical-
filter gates) + an end-to-end TestClient GET that serves a worker bundle-blob's bytes. Run:
apps/api/.venv/Scripts/python.exe warmclick_selftest.py  (cwd = apps/api). 0=pass,1=fail."""
from __future__ import annotations

import json
import os
import tempfile
import time

os.environ.setdefault("SCAN_STORE_PATH", os.path.join(tempfile.mkdtemp(), "scan.sqlite3"))

from fastapi.testclient import TestClient       # noqa: E402
import main                                      # noqa: E402
from src.scanstore import BundleBlob             # noqa: E402

client = TestClient(main.app)


def _bundle(fp: str = "warmfp-1", score: int = 82) -> dict:
    now_ns = int(time.time() * 1e9)
    return {
        "market_state": {"ticker": "SPY", "price": 500.0, "gex_spot": 500.0, "timestamp": now_ns,
                         "timestamp_iso": None, "gamma_flip": 495.0, "call_wall": 510.0,
                         "put_wall": 490.0},
        "signals": {"opportunity_score": score, "regime": "positive_gamma",
                    "vol_regime": "iv_rich", "setups": []},
        "strike_profile": {"ticker": "SPY", "spot": 500.0, "strikes": []},
        "expirations": [],
        "ai_eval": {"ready": True, "reasons": [], "state_fingerprint": fp},
        "_snapshot": {"ticker": "SPY", "contracts": []},
    }


def check_warm_unit() -> None:
    store = main.scanstore.get_store()
    now = time.time()
    dp = main.INCLUDE_DARK_POOL
    # fresh tracked canonical blob -> returned.
    store.write_bundle_blob(BundleBlob(symbol="SPY", as_of=now, bundle_json=json.dumps(_bundle())))
    got = main._scan_warm_bundle("SPY", None, None, None, dp, now)
    assert got is not None and got["ai_eval"]["state_fingerprint"] == "warmfp-1", got
    # STALE blob (as_of past the budget) -> MISS.
    stale_as_of = now - (main.SCAN_WARM_MAX_AGE_SECONDS + 10)
    store.write_bundle_blob(BundleBlob(symbol="SPY", as_of=stale_as_of, bundle_json=json.dumps(_bundle())))
    assert main._scan_warm_bundle("SPY", None, None, None, dp, now) is None, "stale blob must MISS"
    # UNTRACKED symbol -> MISS (even with a fresh blob present).
    store.write_bundle_blob(BundleBlob(symbol="ZZZZ", as_of=now, bundle_json=json.dumps(_bundle())))
    assert main._scan_warm_bundle("ZZZZ", None, None, None, dp, now) is None, "untracked must MISS"
    # DTE-FILTERED request -> MISS (only the canonical full-chain bundle is eligible).
    store.write_bundle_blob(BundleBlob(symbol="SPY", as_of=now, bundle_json=json.dumps(_bundle())))
    assert main._scan_warm_bundle("SPY", 7, 45, None, dp, now) is None, "DTE-filtered must MISS"


def check_warm_served_bytes() -> None:
    store = main.scanstore.get_store()
    store.write_bundle_blob(BundleBlob(
        symbol="SPY", as_of=time.time(),
        bundle_json=json.dumps(_bundle(fp="warmfp-int", score=91))))
    main._cache.clear()   # force a MISS that consults the warm blob (no in-process cache hit)
    r = client.get("/api/ticker/SPY")   # no filters + default dark_pool -> the canonical bundle
    assert r.status_code == 200, f"warm ticker GET {r.status_code}: {r.text[:200]}"
    b = r.json()
    # the served bytes came from the worker's blob (byte-identical score/tier/fingerprint) — no vendor
    # fetch happened (there is no live key here; a non-warm path would 404/degrade).
    assert b["signals"]["opportunity_score"] == 91, b["signals"].get("opportunity_score")
    assert b["signals"]["opportunity_tier"] == "prime", b["signals"].get("opportunity_tier")
    assert b["ai_eval"]["state_fingerprint"] == "warmfp-int", b["ai_eval"].get("state_fingerprint")


def main_() -> int:
    try:
        check_warm_unit()
        check_warm_served_bytes()
    except AssertionError as e:
        print(f"FAIL: {e}")
        return 1
    print("PASS: warm-click serves fresh tracked blobs byte-identically; stale/untracked/filtered MISS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main_())
