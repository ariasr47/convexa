"""Runnable event-calendar loader check (tradeable-rec-inputs item 4). No pytest (apps/api convention).
Run: apps/api/.venv/Scripts/python.exe -m src.scanner.events_selftest   (cwd = apps/api)
Exits 0 = all pass, 1 = a failure (prints which). Uses temp files; nothing persists.

The centerpiece assertion is the honesty contract: **absent (None) must never collapse to empty ([])**.
"""
from __future__ import annotations

import json
import os
import tempfile
from datetime import date

from .events import EVENT_TYPES, load_events


def _write(payload) -> str:
    fd, path = tempfile.mkstemp(suffix=".json")
    os.close(fd)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f)
    return path


def run() -> None:
    # 1. THE HONESTY CONTRACT: unknown (None) vs verified-empty ([]) are distinguishable.
    p = _write({
        "as_of": "2026-07-27", "horizon_end": "2026-12-31",
        "symbols": {
            "nvda": {"events": [
                {"date": "2026-08-27", "type": "earnings", "confirmed": True,
                 "session": "amc", "source": "IR", "avg_abs_move_pct": 8.4}]},
            "SPY": {"events": []},
        },
    })
    try:
        cfg = load_events(path=p, universe=["NVDA", "SPY", "AAPL"])
        assert cfg.events_for("AAPL") is None, "a symbol NEVER curated must be None (unknown), not []"
        assert cfg.events_for("SPY") == [], "a curated symbol with no events must be [] (verified none)"
        assert cfg.events_for("AAPL") != cfg.events_for("SPY"), \
            "HONESTY CONTRACT VIOLATED: unknown and verified-empty are indistinguishable"
        assert cfg.is_known("SPY") and not cfg.is_known("AAPL"), "is_known must track curation"

        # 2. canonicalization + field parsing
        ev = cfg.events_for("NVDA")
        assert ev is not None and len(ev) == 1, f"lower-case key must canonicalize: {ev}"
        assert ev[0].type == "earnings" and ev[0].confirmed is True, ev[0]
        assert ev[0].session == "amc" and ev[0].avg_abs_move_pct == 8.4, ev[0]
        assert cfg.curated_count == 2, cfg.curated_count

        # 3. staleness is a first-class state, not a footnote
        assert cfg.is_expired(today=date(2027, 1, 1)) is True, "past horizon_end must read EXPIRED"
        assert cfg.is_expired(today=date(2026, 8, 1)) is False, "inside the horizon must not read expired"
    finally:
        os.remove(p)

    # 4. no horizon stated => cannot be trusted as current
    p2 = _write({"symbols": {"SPY": {"events": []}}})
    try:
        assert load_events(path=p2).is_expired(today=date(2026, 8, 1)) is True, \
            "a calendar with no horizon_end must read EXPIRED (unverifiable currency)"
    finally:
        os.remove(p2)

    # 5. malformed rows are DROPPED, not passed through with an unknown label
    p3 = _write({"as_of": "2026-07-27", "horizon_end": "2026-12-31", "symbols": {"SPY": {"events": [
        {"date": "08/27/2026", "type": "earnings", "confirmed": True},   # non-ISO date
        {"date": "2026-08-27", "type": "wildcard", "confirmed": True},   # unknown type
        {"date": "2026-08-28", "type": "ex_div", "confirmed": False},    # good
    ]}}})
    try:
        ev = load_events(path=p3).events_for("SPY")
        assert ev is not None and [e.type for e in ev] == ["ex_div"], \
            f"malformed rows must be dropped, not surfaced: {ev}"
        assert ev[0].confirmed is False, "confirmed must round-trip false, not default true"
    finally:
        os.remove(p3)

    # 6. best-effort: a missing/corrupt file degrades to all-unknown, never raises
    cfg_missing = load_events(path=os.path.join(tempfile.gettempdir(), "definitely-absent.json"))
    assert cfg_missing.curated_count == 0 and cfg_missing.events_for("SPY") is None, \
        "a missing calendar must degrade to UNKNOWN, not empty-and-confident"
    p4 = _write("not-a-dict")
    try:
        assert load_events(path=p4).curated_count == 0, "malformed JSON must degrade, not raise"
    finally:
        os.remove(p4)

    # 7. the CHECKED-IN config parses and honours its own contract
    real = load_events()
    assert real.events_for("SPY") is None or isinstance(real.events_for("SPY"), list)
    assert "earnings" in EVENT_TYPES and "ex_div" in EVENT_TYPES


def main() -> int:
    try:
        run()
    except AssertionError as e:
        print(f"FAIL: {e}")
        return 1
    print("PASS: event calendar honours absent-is-not-none, staleness, and best-effort degradation")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
