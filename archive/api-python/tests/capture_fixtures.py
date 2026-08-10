"""
Capture golden fixtures for the scoring characterization tests.

WHY THIS EXISTS AS A SCRIPT, not a one-off: the fixtures are REAL production payloads, and the point
of a characterization test is that its expectations came from the system itself rather than from
someone's idea of what the system should do. When the score is DELIBERATELY changed (which
`[score-change-is-deliberate-and-measured]` permits — with a stated rationale, a recorded
before/after on real tickers, and a fingerprint-basis version bump), you re-run this to re-baseline,
and the diff of the committed JSON *is* the recorded before/after that rule asks for.

USAGE — needs a running API with real vendor data:
    npx nx serve api                       # in another terminal
    apps/api/.venv/Scripts/python.exe apps/api/tests/capture_fixtures.py

It writes apps/api/tests/fixtures/signals_<TICKER>.json, each holding the exact `market_state` and
`off_exchange` that went IN and the `signals` that came OUT. Nothing here runs during the test suite.
"""
from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.core.signals import state_fingerprint  # noqa: E402 - after the sys.path bootstrap


def _fingerprint_of(signals: dict) -> str:
    """The fingerprint is derived, not served — see the note on the captured field."""
    return state_fingerprint(signals)


BASE = "http://localhost:8000"
# A spread of underlyings rather than one: the scorer branches on regime, distance-to-level, IV/HV
# and setup composition, so a single ticker would pin one path through it and call that coverage.
TICKERS = ["SPY", "TSLA", "NVDA", "GLD"]
OUT = Path(__file__).parent / "fixtures"


def capture(ticker: str) -> dict | None:
    url = f"{BASE}/api/ticker/{ticker}?dark_pool=true"
    try:
        with urllib.request.urlopen(url, timeout=120) as r:
            bundle = json.load(r)
    except Exception as exc:  # noqa: BLE001 - a capture script, not production
        print(f"  {ticker}: SKIPPED ({exc})")
        return None

    state = bundle.get("market_state")
    signals = bundle.get("signals")
    if not state or not signals:
        print(f"  {ticker}: SKIPPED (no market_state/signals in the bundle)")
        return None

    return {
        "_note": (
            "Golden fixture captured from a live bundle. `inputs` are exactly what "
            "generate_signals() was called with; `expected_signals` is exactly what it returned, "
            "MINUS the serve-time tier keys which are added after it by main.py. Regenerate with "
            "tests/capture_fixtures.py."
        ),
        "ticker": ticker,
        "captured_at": bundle.get("meta", {}).get("served_at"),
        "inputs": {
            "market_state": state,
            "off_exchange": bundle.get("off_exchange"),
        },
        # Serve-time additions (main.py `_wrap`), NOT produced by generate_signals — excluded so the
        # fixture pins the transform's own output and nothing else.
        "serve_time_keys": ["opportunity_tier", "prime_prompt_eligible"],
        "expected_signals": signals,
        # `state_fingerprint` is NOT on the wire, so unlike everything above it cannot be captured
        # from the response — it is computed here from the code under test. That IS circular as a
        # correctness oracle and is not pretending otherwise: its job is to be a CHANGE DETECTOR.
        # The fingerprint is the dedupe key the whole AI-gating path keys off, so a silent change to
        # its basis is exactly the regression worth catching.
        "expected_state_fingerprint": _fingerprint_of(signals),
    }


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    written = 0
    for t in TICKERS:
        fx = capture(t)
        if fx is None:
            continue
        path = OUT / f"signals_{t}.json"
        path.write_text(json.dumps(fx, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        score = fx["expected_signals"].get("opportunity_score")
        regime = fx["inputs"]["market_state"].get("regime") or fx["expected_signals"].get("regime")
        print(f"  {t}: score={score} regime={regime} -> {path.name}")
        written += 1
    print(f"\n{written} fixture(s) written to {OUT}")
    return 0 if written else 1


if __name__ == "__main__":
    sys.exit(main())
