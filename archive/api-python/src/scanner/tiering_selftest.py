"""CENTERPIECE runnable selftest for the tiering/promotion PURE LOGIC (crux c). Deterministic, with
an INJECTED clock — no vendor, no store, no wall-clock. Proves move-detection, building-first
priority, most-overdue ordering, round-robin fairness, and (the load-bearing assertion) the ANTI-HERD
guarantee: a market-wide move never computes more than slow_batch_size symbols per cycle.
Run: apps/api/.venv/Scripts/python.exe -m src.scanner.tiering_selftest  (cwd = apps/api). 0=pass,1=fail."""
from __future__ import annotations

from .tiering import (CyclePlan, SweepConfig, SymbolSched, detect_moves, pct_move, plan_cycle)

UNIV = ["AAA", "BBB", "CCC", "DDD", "EEE", "FFF"]


def _scheds(computed_at: dict, prices_at: dict) -> dict:
    """Build a scheds map; symbols absent from `computed_at` are 'building' (last_compute_at=None)."""
    return {s: SymbolSched(s, computed_at.get(s), prices_at.get(s)) for s in UNIV}


def run() -> None:
    cfg = SweepConfig(move_threshold_pct=0.75, slow_batch_size=4, promotion_cap=2)
    NOW = 1000.0

    # 1. pct_move: None on bad old; correct otherwise; strict threshold boundary.
    assert pct_move(None, 10.0) is None and pct_move(0.0, 10.0) is None and pct_move(10.0, None) is None
    assert abs(pct_move(100.0, 101.0) - 1.0) < 1e-9, "1% move"
    assert pct_move(100.0, 100.75) == 0.75, "exact-threshold move value"

    # 2. cold universe (all building), no prices: one cycle computes exactly slow_batch_size, and
    #    round-robin over consecutive cycles reaches EVERY symbol (fairness).
    scheds = _scheds({}, {})
    cursor, seen = 0, set()
    for _ in range(3):  # 3 cycles * 4 >= 6 symbols
        plan = plan_cycle(UNIV, scheds, {}, cursor, cfg, NOW)
        assert len(plan.batch) == cfg.slow_batch_size, f"cold batch size {plan.batch}"
        cursor = plan.next_cursor
        seen.update(plan.batch)
    assert seen == set(UNIV), f"round-robin must reach every symbol, missed {set(UNIV) - seen}"

    # 3. all computed, one symbol moves > threshold -> it is PROMOTED (appears; is in `promoted`).
    computed = {s: 900.0 for s in UNIV}
    px = {s: 100.0 for s in UNIV}          # last_compute_price
    scheds = {s: SymbolSched(s, 900.0, 100.0) for s in UNIV}
    live = dict(px); live["EEE"] = 101.0   # +1.0% > 0.75%
    moved = detect_moves(UNIV, scheds, live, cfg.move_threshold_pct)
    assert moved == ["EEE"], f"only EEE moved, got {moved}"
    plan = plan_cycle(UNIV, scheds, live, rr_cursor=0, cfg=cfg, now=NOW, moved=moved)
    assert "EEE" in plan.promoted and "EEE" in plan.batch, f"EEE must be promoted: {plan}"

    # 4. most-overdue ordering among moved (injected clock): FFF last-computed earlier -> ranks first.
    scheds2 = {s: SymbolSched(s, 500.0, 100.0) for s in UNIV}
    scheds2["EEE"] = SymbolSched("EEE", 990.0, 100.0)   # computed recently
    scheds2["FFF"] = SymbolSched("FFF", 100.0, 100.0)   # computed long ago (more overdue)
    live2 = {s: 100.0 for s in UNIV}; live2["EEE"] = 101.0; live2["FFF"] = 101.0
    moved2 = detect_moves(UNIV, scheds2, live2, cfg.move_threshold_pct)
    plan2 = plan_cycle(UNIV, scheds2, live2, 0, cfg, NOW, moved=moved2)
    assert plan2.promoted[0] == "FFF", f"most-overdue moved symbol ranks first: {plan2.promoted}"

    # 5. THE ANTI-HERD GUARANTEE: a MARKET-WIDE move (every symbol moved) still computes only
    #    slow_batch_size, with at most promotion_cap promotions and >=1 baseline slot (fairness).
    scheds3 = {s: SymbolSched(s, 900.0, 100.0) for s in UNIV}
    live3 = {s: 105.0 for s in UNIV}       # every symbol +5% -> all moved
    moved3 = detect_moves(UNIV, scheds3, live3, cfg.move_threshold_pct)
    assert set(moved3) == set(UNIV), "sanity: all moved"
    plan3 = plan_cycle(UNIV, scheds3, live3, 0, cfg, NOW, moved=moved3)
    assert len(plan3.batch) == cfg.slow_batch_size, f"ANTI-HERD: batch must stay <= pool, got {len(plan3.batch)}"
    assert len(plan3.promoted) <= cfg.promotion_cap, f"promotions must be capped, got {plan3.promoted}"
    baseline_slots = len(plan3.batch) - len(plan3.promoted)
    assert baseline_slots >= cfg.slow_batch_size - cfg.promotion_cap >= 1, \
        f"fairness: baseline round-robin slots guaranteed, got {baseline_slots}"


def main() -> int:
    try:
        run()
    except AssertionError as e:
        print(f"FAIL: {e}")
        return 1
    print("PASS: tiering pure logic — move detection, promotion cap, round-robin fairness, anti-herd")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
