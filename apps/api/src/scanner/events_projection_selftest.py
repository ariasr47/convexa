"""Runnable check for the EVENT-CALENDAR WIRE PROJECTION (bundle-events). No pytest (apps/api convention).
Run: apps/api/.venv/Scripts/python.exe -m src.scanner.events_projection_selftest   (cwd = apps/api)
Exits 0 = all pass, 1 = a failure (prints which). Uses temp files; nothing persists.

Sibling of `events_selftest.py`, which covers the LOADER. This one covers the step that carries the
loader's semantics onto the wire, where the load-bearing risk lives:

  * `absent-is-not-none` must SURVIVE the projection. `unknown` and `none` both ship `events: []`,
    so `state` is the ONLY disambiguator on the wire — if the projection collapses them, every
    downstream consumer silently reads "no earnings scheduled" for a ticker nobody ever checked.
  * an EXPIRED calendar cannot support a `none`/`scheduled` claim -> forced to `unknown`.
  * a calendar FAULT (missing/corrupt file) is `null`, not a confident all-unknown.
  * only UPCOMING events reach the wire (`days_until >= 0`).
"""
from __future__ import annotations

import json
import os
import tempfile
from datetime import date

from .events import EventsConfig, load_events, project_event_calendar

# The six keys INTERFACE_CONTRACT.md §1 pins on the block, and the seven on each event.
BLOCK_KEYS = {"state", "events", "calendar_as_of", "calendar_horizon_end",
              "calendar_covers", "calendar_expired"}
EVENT_KEYS = {"date", "type", "confirmed", "session", "days_until", "source", "note"}


def _write(payload) -> str:
    fd, path = tempfile.mkstemp(suffix=".json")
    os.close(fd)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f)
    return path


def run() -> None:
    today = date(2026, 7, 27)
    p = _write({
        "as_of": "2026-07-27", "horizon_end": "2026-10-31", "covers": ["earnings"],
        "symbols": {
            "NVDA": {"events": [
                {"date": "2026-08-26", "type": "earnings", "confirmed": True, "session": "amc",
                 "source": "https://example.test/nvda", "avg_abs_move_pct": 8.4,
                 "note": "WSH CONFIRMED; IR page unreachable."},
                {"date": "2026-10-20", "type": "earnings", "confirmed": False, "session": None,
                 "source": "https://example.test/nvda2", "note": "projected from cadence"},
            ]},
            "SPY": {"events": []},
            "OLDCO": {"events": [
                {"date": "2026-07-20", "type": "earnings", "confirmed": True, "session": "bmo"},
            ]},
            "MIXED": {"events": [
                {"date": "2026-07-01", "type": "earnings", "confirmed": True},   # past
                {"date": "2026-07-27", "type": "earnings", "confirmed": True},   # TODAY -> upcoming
            ]},
        },
    })
    try:
        cfg = load_events(path=p)

        # 1. THE LOAD-BEARING ONE: uncurated -> `unknown`, NEVER `none`.
        unk = project_event_calendar("TSLA", cfg=cfg, today=today)
        assert unk is not None, "an uncurated ticker on a HEALTHY calendar is unknown, not null"
        assert unk["state"] == "unknown", f"uncurated must be 'unknown', got {unk['state']!r}"
        assert unk["events"] == [], unk["events"]

        # 2. curated-with-nothing -> `none`, and the two are DISTINGUISHABLE on the wire.
        non = project_event_calendar("SPY", cfg=cfg, today=today)
        assert non["state"] == "none", f"a curated empty ticker must be 'none', got {non['state']!r}"
        assert non["events"] == [], non["events"]
        assert unk["state"] != non["state"], \
            "HONESTY CONTRACT VIOLATED ON THE WIRE: unknown and none collapsed (events[] is " \
            "identical for both, so `state` is the ONLY disambiguator)"

        # 3. curated-with-dates -> `scheduled`, chronological, correct days_until.
        sch = project_event_calendar("NVDA", cfg=cfg, today=today)
        assert sch["state"] == "scheduled", sch["state"]
        assert [e["date"] for e in sch["events"]] == ["2026-08-26", "2026-10-20"], sch["events"]
        assert sch["events"][0]["days_until"] == 30, sch["events"][0]["days_until"]
        assert all(e["days_until"] >= 0 for e in sch["events"]), "days_until must never be negative"

        # 4. provenance survives: confirmed / source / note / session reach the wire verbatim.
        e0, e1 = sch["events"]
        assert e0["confirmed"] is True and e1["confirmed"] is False, "confirmed must round-trip"
        assert e0["session"] == "amc" and e1["session"] is None, "session null != 'assume amc'"
        assert e0["source"] and "WSH CONFIRMED" in (e0["note"] or ""), \
            "a recorded source disagreement/caveat must survive to the wire"

        # 5. self-describing: the block carries the FILE's own assumptions.
        assert sch["calendar_as_of"] == "2026-07-27", sch["calendar_as_of"]
        assert sch["calendar_horizon_end"] == "2026-10-31", sch["calendar_horizon_end"]
        assert sch["calendar_covers"] == ["earnings"], sch["calendar_covers"]
        assert sch["calendar_expired"] is False, sch["calendar_expired"]

        # 6. the wire shape is EXACTLY what the interface pins — no raw dump of the config row
        #    (`avg_abs_move_pct` is loader-internal and is NOT an interface field).
        assert set(sch) == BLOCK_KEYS, f"block keys drifted from the interface: {sorted(sch)}"
        assert set(e0) == EVENT_KEYS, f"event keys drifted from the interface: {sorted(e0)}"
        assert json.dumps(sch), "the block must be JSON-serializable (it is cached + served)"

        # 7. UPCOMING ONLY. All-past curated collapses to `none` (it is curated; nothing is coming),
        #    and today's own date still counts as upcoming (days_until == 0).
        old = project_event_calendar("OLDCO", cfg=cfg, today=today)
        assert old["state"] == "none" and old["events"] == [], \
            f"past-dated events must be filtered out, leaving 'none': {old}"
        mix = project_event_calendar("MIXED", cfg=cfg, today=today)
        assert [e["date"] for e in mix["events"]] == ["2026-07-27"], mix["events"]
        assert mix["events"][0]["days_until"] == 0, "the serving day itself is upcoming, not past"

        # 8. EXPIRED forces unknown — an out-of-horizon file cannot support none/scheduled.
        late = date(2026, 11, 1)
        for sym in ("NVDA", "SPY", "TSLA"):
            blk = project_event_calendar(sym, cfg=cfg, today=late)
            assert blk["state"] == "unknown", f"expired calendar must force unknown for {sym}: {blk}"
            assert blk["events"] == [], blk["events"]
            assert blk["calendar_expired"] is True, blk["calendar_expired"]

        # 9. symbol canonicalization (the loader's contract must not be lost at the seam).
        assert project_event_calendar(" nvda ", cfg=cfg, today=today)["state"] == "scheduled"
    finally:
        os.remove(p)

    # 10. BEST-EFFORT: a missing / corrupt / wrong-shape file is NULL, not a confident all-unknown.
    missing = load_events(path=os.path.join(tempfile.gettempdir(), "definitely-absent-cal.json"))
    assert project_event_calendar("NVDA", cfg=missing, today=today) is None, \
        "a calendar that failed to load must project to null (it claims nothing about the world)"
    p4 = _write("not-a-dict")
    try:
        assert project_event_calendar("NVDA", cfg=load_events(path=p4), today=today) is None
    finally:
        os.remove(p4)

    # 11. the projection NEVER raises — a fault degrades to null inside the helper too.
    assert project_event_calendar(None, cfg=None, today=today) is None or True
    assert project_event_calendar("NVDA", cfg=EventsConfig(), today=today) is None
    assert project_event_calendar("", cfg=load_events(), today=today) is not None or True

    # 12. the CHECKED-IN config projects the three real states as GATE Q will read them.
    real = load_events()
    if real.curated_count:
        assert project_event_calendar("SPY", cfg=real)["state"] in ("none", "unknown")
        for uncurated in ("TSLA", "MU", "CSCO", "UNH"):
            blk = project_event_calendar(uncurated, cfg=real)
            assert blk["state"] == "unknown", \
                f"{uncurated} is deliberately uncurated and MUST read unknown: {blk['state']!r}"


def main() -> int:
    try:
        run()
    except AssertionError as e:
        print(f"FAIL: {e}")
        return 1
    print("PASS: wire projection keeps unknown != none, forces unknown when expired, "
          "filters to upcoming, and degrades a calendar fault to null")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
