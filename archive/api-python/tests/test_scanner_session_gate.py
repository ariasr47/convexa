"""
The sweep worker's market-hours gate (owner-directed 2026-08-06, ahead of the worker's first deploy).

Risk-based: the three things that would each be expensive and invisible in production.

  1. **It fails OPEN.** A gate that fails closed silently stops the scanner for everyone on a clock
     or zoneinfo error — strictly worse than the waste it exists to prevent.
  2. **It defaults ON.** Unset must mean gated: the always-on deployed worker is the case that costs
     money, and it is also the case nobody is watching.
  3. **An idle worker keeps its heartbeat.** Without this the shipped worker-down banner fires on a
     worker that is deliberately resting, and the operator cannot tell "asleep" from "crashed" —
     which is the exact `model-read-carries-its-assumptions` failure.

Also pinned: the slow lane (the one actually re-fetching whole option chains) does no work while
gated, and `sweep_last_completed` is NOT advanced by an idle heartbeat — the page must keep telling
the truth about how old the structure data is.
"""
from __future__ import annotations

import asyncio

import pytest

from src.scanner import session_gate
from src.scanner.loop import LoopConfig, LoopDeps, SweepState, _fast_lane, _slow_lane


# --------------------------------------------------------------------------- the knob

def test_unset_means_gated(monkeypatch):
    monkeypatch.delenv("SCAN_MARKET_HOURS_ONLY", raising=False)
    assert session_gate.market_hours_only() is True


@pytest.mark.parametrize("value", ["0", "false", "FALSE", "no", "off"])
def test_only_an_explicit_falsy_value_disables_it(monkeypatch, value):
    monkeypatch.setenv("SCAN_MARKET_HOURS_ONLY", value)
    assert session_gate.market_hours_only() is False


@pytest.mark.parametrize("value", ["1", "true", "yes", "on", "", "  "])
def test_truthy_and_empty_keep_it_on(monkeypatch, value):
    monkeypatch.setenv("SCAN_MARKET_HOURS_ONLY", value)
    assert session_gate.market_hours_only() is True


def test_an_unrecognised_value_keeps_the_gate_ON(monkeypatch):
    """A typo must not silently switch the expensive behaviour back on."""
    monkeypatch.setenv("SCAN_MARKET_HOURS_ONLY", "flase")
    assert session_gate.market_hours_only() is True


# --------------------------------------------------------------------------- the predicate

@pytest.mark.parametrize("session,expected", [
    ("premarket", True), ("regular", True), ("afterhours", True),
    ("overnight", False),   # 20:00-04:00 — the vendor has no coverage; this is the waste
    ("closed", False),      # weekend
])
def test_sweeps_only_inside_vendor_coverage(monkeypatch, session, expected):
    monkeypatch.setenv("SCAN_MARKET_HOURS_ONLY", "1")
    assert session_gate.should_sweep(lambda: session) is expected


def test_the_gate_FAILS_OPEN_when_the_session_lookup_raises(monkeypatch):
    """Rule 1. Stopping the scanner on a clock error would be worse than the waste."""
    monkeypatch.setenv("SCAN_MARKET_HOURS_ONLY", "1")

    def boom() -> str:
        raise RuntimeError("zoneinfo exploded")

    assert session_gate.should_sweep(boom) is True


def test_disabled_gate_sweeps_even_overnight(monkeypatch):
    monkeypatch.setenv("SCAN_MARKET_HOURS_ONLY", "0")
    assert session_gate.should_sweep(lambda: "overnight") is True


def test_an_unknown_session_string_is_treated_as_not_covered(monkeypatch):
    """Closed vocabulary: only the three named sessions sweep. A new session name added upstream
    must not silently start costing money before someone decides it should."""
    monkeypatch.setenv("SCAN_MARKET_HOURS_ONLY", "1")
    assert session_gate.should_sweep(lambda: "some_new_session") is False


# --------------------------------------------------------------------------- the lanes

class _RecordingStore:
    """Captures heartbeats/upserts; every ScanStore call the loop makes is best-effort."""
    def __init__(self):
        self.heartbeats = []
        self.rows = []
        self.blobs = []

    def upsert_row(self, row):
        self.rows.append(row)

    def write_heartbeat(self, hb):
        self.heartbeats.append(hb)

    def put_bundle(self, *a, **k):
        self.blobs.append(a)


def _deps(store, session: str, *, computed: list) -> LoopDeps:
    def _fetch(_symbols):
        raise AssertionError("the fast lane must not fetch while gated")

    async def _compute(sym):
        computed.append(sym)
        return None

    async def _sleep(_s):
        await asyncio.sleep(0)

    return LoopDeps(
        universe=["SPY"], store=store, bands=None,
        fetch_snapshots=_fetch, compute_bundle=_compute,
        clock=lambda: 1000.0, sleep=_sleep,
        config=LoopConfig(idle_interval=1.0),
        session=lambda: session,
    )


async def _spin(lane, deps: LoopDeps, st: SweepState, turns: int, extra: tuple = ()) -> None:
    """Run a lane for a few event-loop turns, then stop it. This repo has no pytest-asyncio, so the
    tests stay plain sync functions driving `asyncio.run` — three tests do not justify a dependency."""
    stop = asyncio.Event()
    task = asyncio.create_task(lane(deps, st, stop, *extra))
    for _ in range(turns):
        await asyncio.sleep(0)
    stop.set()
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


def test_idle_fast_lane_still_writes_a_heartbeat(monkeypatch):
    """Rule 3 — the resting worker must not look dead."""
    monkeypatch.setenv("SCAN_MARKET_HOURS_ONLY", "1")
    store = _RecordingStore()
    computed: list = []
    deps = _deps(store, "overnight", computed=computed)
    st = SweepState(deps.universe)
    asyncio.run(_spin(_fast_lane, deps, st, 20))

    assert store.heartbeats, "an idle worker wrote NO heartbeat — it is indistinguishable from dead"
    # It did not sweep: `_fetch` would have raised, and nothing was computed.
    assert computed == []


def test_an_idle_heartbeat_does_not_advance_sweep_last_completed(monkeypatch):
    """The page must keep telling the truth about structure-data age while the worker rests."""
    monkeypatch.setenv("SCAN_MARKET_HOURS_ONLY", "1")
    store = _RecordingStore()
    deps = _deps(store, "closed", computed=[])
    st = SweepState(deps.universe)
    st.sweep_last_completed = 123.0
    asyncio.run(_spin(_fast_lane, deps, st, 10))

    assert store.heartbeats
    assert all(hb.sweep_last_completed == 123.0 for hb in store.heartbeats)


def test_the_expensive_slow_lane_computes_nothing_while_gated(monkeypatch):
    """The whole point: no chain re-fetches outside vendor coverage."""
    monkeypatch.setenv("SCAN_MARKET_HOURS_ONLY", "1")
    store = _RecordingStore()
    computed: list = []
    deps = _deps(store, "overnight", computed=computed)
    st = SweepState(deps.universe)
    asyncio.run(_spin(_slow_lane, deps, st, 20, extra=(None,)))

    assert computed == [], f"the slow lane computed {computed} while the market was shut"
    # And it wrote no heartbeat — the fast lane owns that, so the two can never disagree.
    assert store.heartbeats == []
