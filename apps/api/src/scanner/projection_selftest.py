"""Runnable projection check (Scanner v1 Plan 2 Task 5). No pytest. Uses a CANNED bundle (no vendor).
Run: apps/api/.venv/Scripts/python.exe -m src.scanner.projection_selftest  (cwd = apps/api)."""
from __future__ import annotations

from src.core.signals import compute_opportunity_tier
from .projection import (TierBands, project_building, project_error, project_price_only,
                         project_row, refresh_status)

BANDS = TierBands(watch=25, actionable=50, prime=75)


def _bundle(score, ready, price=100.0, flip=95.0, call_wall=115.0, put_wall=90.0):
    return {
        "market_state": {"price": price, "gamma_flip": flip,
                         "call_wall": call_wall, "put_wall": put_wall, "timestamp": 0},
        "signals": {"opportunity_score": score, "regime": "positive_gamma", "vol_regime": "iv_rich"},
        "ai_eval": {"ready": ready},
    }


def run() -> None:
    # 1. Full projection consumes score/regime/vol_regime/flip/walls; tier via the SAME helper.
    b = _bundle(score=80, ready=True)
    row = project_row("spy", b, now=1000.0, bands=BANDS)
    assert row.symbol == "SPY" and row.status == "ok" and row.as_of == 1000.0
    assert row.score == 80 and row.regime == "positive_gamma" and row.vol_regime == "iv_rich"
    assert row.flip == 95.0 and row.call_wall == 115.0 and row.put_wall == 90.0
    # tier must EQUAL what the serve path computes for the same inputs (AC-10 consumption fidelity).
    assert row.tier == compute_opportunity_tier(80, True, watch=25, actionable=50, prime=75) == "prime", row.tier
    # distances are pure transport: price 100 vs flip 95 -> +5.0%; nearer wall = put 90 -> +10.0%.
    assert row.dist_to_flip_pct == 5.0, row.dist_to_flip_pct
    assert row.dist_to_wall_pct == 10.0, row.dist_to_wall_pct

    # 2. Prime requires ai_ready: same score, ready=False -> actionable (mirrors serve-path rule).
    row2 = project_row("qqq", _bundle(score=80, ready=False), 1000.0, BANDS)
    assert row2.tier == "actionable", row2.tier

    # 3. Fast-lane price override: price/chg come from the poll, structure from the bundle.
    row3 = project_row("iwm", _bundle(score=30, ready=False), 1000.0, BANDS, price=201.0, chg_pct=1.2)
    assert row3.price == 201.0 and row3.chg_pct == 1.2 and row3.tier == "watch"

    # 4. building: present, not-yet-scored, honest.
    bld = project_building("nvda")
    assert bld.status == "building" and bld.score is None and bld.as_of == 0.0 and bld.price is None

    # 5. price-only merge onto structure: keeps as_of, ages status to stale past the budget.
    fresh = project_row("amd", _bundle(score=60, ready=True), now=1000.0, bands=BANDS)
    merged = project_price_only("amd", fresh, price=105.0, chg_pct=0.4, now=1000.0 + 999.0,
                                stale_after=180.0)
    assert merged.price == 105.0 and merged.chg_pct == 0.4 and merged.as_of == 1000.0
    assert merged.status == "stale", f"structure aged past budget -> stale, got {merged.status}"
    # within budget stays ok.
    ok_merge = project_price_only("amd", fresh, 106.0, 0.5, now=1000.0 + 10.0, stale_after=180.0)
    assert ok_merge.status == "ok", ok_merge.status

    # 6. error keeps prior structure but flips status; a building->error keeps building numerics.
    err = project_error("amd", fresh, now=2000.0)
    assert err.status == "error" and err.flip == fresh.flip, err
    err2 = project_error("meta", None, now=2000.0)
    assert err2.status == "error" and err2.score is None, err2

    # 7. price-only on a building row stays building (never fabricates structure).
    bld_priced = project_price_only("nvda", bld, price=500.0, chg_pct=2.0, now=1000.0, stale_after=180.0)
    assert bld_priced.status == "building" and bld_priced.price == 500.0, bld_priced

    # 8. refresh_status ages a stranded ok row without touching values.
    aged = refresh_status(fresh, now=1000.0 + 500.0, stale_after=180.0)
    assert aged.status == "stale" and aged.price == fresh.price, aged


def main() -> int:
    try:
        run()
    except AssertionError as e:
        print(f"FAIL: {e}")
        return 1
    print("PASS: projection consumes the bundle (tier via serve-path helper; distances = transport)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
