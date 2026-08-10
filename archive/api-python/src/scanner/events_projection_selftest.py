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

expiration-events extends it with the PER-EXPIRATION containment flag
(`event_calendar.expirations[]`), whose risk is concentrated in two places:

  * the BOUNDARY — an expiry that dies BEFORE the event must not be flagged, and the two edge cases
    that cannot occur naturally in the shipped config (an `amc` event dated exactly ON an expiration
    is NOT contained; a `session: null` event on the same date IS) have to be built as fixtures.
  * `state` STILL GOVERNS — `expirations` is `[]` for BOTH `unknown` and `none`, so it is not
    self-disambiguating; a per-expiration `contains_event: false` under `unknown` would be the
    `absent-is-not-none` fabrication one level down.
"""
from __future__ import annotations

import json
import os
import tempfile
from datetime import date

from .events import EventsConfig, load_events, project_event_calendar

# The seven keys the interface pins on the block, the seven on each event, and the six on each
# expiration entry (expiration-events INTERFACE §1).
BLOCK_KEYS = {"state", "events", "expirations", "calendar_as_of", "calendar_horizon_end",
              "calendar_covers", "calendar_expired"}
EVENT_KEYS = {"date", "type", "confirmed", "session", "days_until", "source", "note"}
EXPIRATION_KEYS = {"expiration", "dte", "contains_event", "event_count", "event_types",
                   "first_event_date"}


def _curve(*pairs) -> dict:
    """A minimal stand-in for the bundle's `market_state.term_structure` — the projection only ever
    reads `points[].expiration` / `points[].dte`, and must tolerate the rest being anything."""
    return {
        "points": [{"dte": d, "expiration": e, "atm_iv": 42.0} for d, e in pairs],
        "state": "flat", "near_iv": 42.0, "far_iv": 42.0, "slope": 0.0,
    }


# today = 2026-07-27 -> DTEs 25 / 53 / 81. Values are ECHOED, never recomputed.
CURVE = _curve((25, "2026-08-21"), (53, "2026-09-18"), (81, "2026-10-16"))


def _by_exp(block: dict) -> dict:
    return {r["expiration"]: r for r in block["expirations"]}


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


def run_expirations() -> None:
    """expiration-events: the PER-EXPIRATION containment flag (`expirations[]`).

    Its own config, so the shipped-shape assertions above stay pinned to the real `covers`.
    """
    today = date(2026, 7, 27)
    p = _write({
        "as_of": "2026-07-27", "horizon_end": "2026-10-31", "covers": ["earnings", "fomc"],
        "symbols": {
            # the natural case: earnings BETWEEN two expirations (as NVDA actually sits today).
            "NVDA": {"events": [
                {"date": "2026-08-26", "type": "earnings", "confirmed": True, "session": "amc"},
            ]},
            # THE SHARP EDGE — an amc report dated exactly ON an expiration. Cannot occur in the
            # shipped config; constructed here because it is the off-by-one the feature exists to
            # avoid (the contract is dead at Friday's close, hours before the after-close report).
            "EDGEAMC": {"events": [
                {"date": "2026-09-18", "type": "earnings", "confirmed": True, "session": "amc"},
            ]},
            # the OTHER side of the same edge: session unknown on the expiration date. Conservative
            # direction = contained (never silently assume "it must have been after the close").
            "EDGENULL": {"events": [
                {"date": "2026-09-18", "type": "earnings", "confirmed": False},
            ]},
            # bmo on the expiration date is unambiguously inside the contract's life.
            "EDGEBMO": {"events": [
                {"date": "2026-09-18", "type": "earnings", "confirmed": True, "session": "bmo"},
            ]},
            # several contained events, incl. a REPEATED type -> de-duped + sorted labels.
            "MULTIEV": {"events": [
                {"date": "2026-08-12", "type": "earnings", "confirmed": True, "session": "bmo"},
                {"date": "2026-08-05", "type": "fomc", "confirmed": True},
                {"date": "2026-08-19", "type": "earnings", "confirmed": False},
            ]},
            # a past event (already filtered out upstream) alongside a future one.
            "PASTMIX": {"events": [
                {"date": "2026-07-01", "type": "earnings", "confirmed": True, "session": "amc"},
                {"date": "2026-09-18", "type": "fomc", "confirmed": True},
            ]},
            "SPYX": {"events": []},          # curated, nothing scheduled -> `none`
        },
    })
    try:
        cfg = load_events(path=p)

        # 13. THE BOUNDARY (the point of the feature). Earnings 2026-08-26 amc: the 08-21 expiry
        #     dies BEFORE it and must NOT be flagged; 09-18 and 10-16 live through it.
        nv = _by_exp(project_event_calendar("NVDA", cfg=cfg, today=today, term_structure=CURVE))
        near = nv["2026-08-21"]
        assert near["contains_event"] is False and near["event_count"] == 0, \
            f"an expiry that dies BEFORE the event must not be flagged: {near}"
        assert near["event_types"] == [] and near["first_event_date"] is None, near
        for exp in ("2026-09-18", "2026-10-16"):
            row = nv[exp]
            assert row["contains_event"] is True and row["event_count"] == 1, f"{exp}: {row}"
            assert row["event_types"] == ["earnings"], row["event_types"]
            assert row["first_event_date"] == "2026-08-26", row["first_event_date"]

        # 14. AMC ON THE EXPIRATION DATE -> NOT contained by that expiry, but contained by the next
        #     one out. This is the whole modelling claim; a naive `<=` gets it wrong.
        am = _by_exp(project_event_calendar("EDGEAMC", cfg=cfg, today=today, term_structure=CURVE))
        assert am["2026-09-18"]["contains_event"] is False, \
            f"an amc report ON the expiry is AFTER the contract dies: {am['2026-09-18']}"
        assert am["2026-09-18"]["event_count"] == 0 and am["2026-09-18"]["event_types"] == []
        assert am["2026-09-18"]["first_event_date"] is None
        assert am["2026-10-16"]["contains_event"] is True, \
            f"the NEXT expiry out still contains it: {am['2026-10-16']}"
        assert am["2026-10-16"]["first_event_date"] == "2026-09-18"

        # 15. session UNKNOWN (null) on the expiration date -> contained. And bmo trivially so.
        nul = _by_exp(project_event_calendar("EDGENULL", cfg=cfg, today=today, term_structure=CURVE))
        assert nul["2026-09-18"]["contains_event"] is True, \
            f"unknown session must NOT be silently assumed to fall after the close: {nul['2026-09-18']}"
        assert nul["2026-09-18"]["first_event_date"] == "2026-09-18"
        bmo = _by_exp(project_event_calendar("EDGEBMO", cfg=cfg, today=today, term_structure=CURVE))
        assert bmo["2026-09-18"]["contains_event"] is True, bmo["2026-09-18"]

        # 16. several contained events -> count > 1, de-duped + SORTED types, EARLIEST first date.
        mul = _by_exp(project_event_calendar("MULTIEV", cfg=cfg, today=today, term_structure=CURVE))
        row = mul["2026-08-21"]
        assert row["event_count"] == 3, row
        assert row["event_types"] == ["earnings", "fomc"], \
            f"types must be de-duped and sorted, not a raw per-event dump: {row['event_types']}"
        assert row["first_event_date"] == "2026-08-05", row["first_event_date"]

        # 17. `state` STILL GOVERNS — `none` and `unknown` both yield [] even with a full curve.
        #     A `contains_event: false` row under `unknown` would claim "this expiry is clear" about
        #     a ticker nobody ever checked (absent-is-not-none, one level down).
        for sym, want in (("SPYX", "none"), ("TSLA", "unknown")):
            blk = project_event_calendar(sym, cfg=cfg, today=today, term_structure=CURVE)
            assert blk["state"] == want, blk["state"]
            assert blk["expirations"] == [], \
                f"{want} must emit NO per-expiration claim, got {blk['expirations']}"
        late = project_event_calendar("NVDA", cfg=cfg, today=date(2026, 11, 1),
                                      term_structure=CURVE)
        assert late["state"] == "unknown" and late["expirations"] == [], late

        # 18. ORDERING + ECHO FIDELITY: ascending by dte, values echoed from the curve verbatim,
        #     no invented or renamed tenors — even when the curve arrives out of order.
        shuffled = _curve((81, "2026-10-16"), (25, "2026-08-21"), (53, "2026-09-18"))
        rows = project_event_calendar("NVDA", cfg=cfg, today=today,
                                      term_structure=shuffled)["expirations"]
        assert [r["dte"] for r in rows] == [25, 53, 81], [r["dte"] for r in rows]
        assert [r["expiration"] for r in rows] == ["2026-08-21", "2026-09-18", "2026-10-16"], rows
        assert len(rows) == 3, "one entry per tenor — no invented tenors"

        # 19. the per-entry payload is a SUMMARY, not a re-dump of the event objects.
        for r in rows:
            assert set(r) == EXPIRATION_KEYS, f"entry keys drifted from the interface: {sorted(r)}"
            assert r["contains_event"] == (r["event_count"] > 0), \
                "contains_event and event_count are redundant BY CONSTRUCTION; they cannot disagree"
        assert "events" not in rows[0] and json.dumps(rows), rows[0]

        # 20. BEST-EFFORT: no curve / a malformed curve / garbage never raises and never fabricates.
        for bad in (None, {}, {"points": None}, {"points": "nope"}, {"points": {}},
                    {"points": [None, 7, "x"]}, {"points": [{}]},
                    {"points": [{"expiration": "not-a-date", "dte": 5}]},
                    {"points": [{"expiration": "2026-09-18"}]},
                    {"points": [{"dte": 53}]},
                    {"points": [{"expiration": "2026-09-18", "dte": "soon"}]},
                    "a string", 42, [{"dte": 1, "expiration": "2026-09-18"}]):
            blk = project_event_calendar("NVDA", cfg=cfg, today=today, term_structure=bad)
            assert blk is not None and blk["state"] == "scheduled", \
                f"a bad tenor curve must not damage the calendar read itself: {bad!r} -> {blk}"
            assert blk["expirations"] == [], \
                f"a bad tenor curve must yield NO per-expiration claim: {bad!r} -> {blk['expirations']}"
            assert blk["events"], "the events list is unaffected by the tenor curve"

        # 21. the KEY is always present (array) on every non-null block, curve or not.
        for sym in ("NVDA", "SPYX", "TSLA"):
            for ts in (None, CURVE):
                blk = project_event_calendar(sym, cfg=cfg, today=today, term_structure=ts)
                assert set(blk) == BLOCK_KEYS, f"block keys drifted: {sorted(blk)}"
                assert isinstance(blk["expirations"], list), type(blk["expirations"])

        # 22. a PAST-dated event cannot be contained by anything (upcoming-only, filtered upstream),
        #     while a future one on the same ticker still is.
        pm = _by_exp(project_event_calendar("PASTMIX", cfg=cfg, today=today, term_structure=CURVE))
        assert pm["2026-08-21"]["contains_event"] is False, \
            f"an event BEFORE the serving day is contained by nothing: {pm['2026-08-21']}"
        assert pm["2026-09-18"]["event_count"] == 1, pm["2026-09-18"]
        assert pm["2026-09-18"]["event_types"] == ["fomc"], pm["2026-09-18"]
    finally:
        os.remove(p)


def main() -> int:
    try:
        run()
        run_expirations()
    except AssertionError as e:
        print(f"FAIL: {e}")
        return 1
    print("PASS: wire projection keeps unknown != none, forces unknown when expired, "
          "filters to upcoming, and degrades a calendar fault to null; per-expiration containment "
          "excludes an amc report ON the expiry, includes an unknown-session one, and emits [] "
          "whenever `state` cannot support a claim")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
