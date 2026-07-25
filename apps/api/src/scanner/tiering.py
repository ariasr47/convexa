"""Tiering / promotion PURE LOGIC (crux c — the one algorithm that would silently rot). Move-detection
thresholding, promotion-queue capping, and round-robin fairness as PURE functions with an INJECTED
clock (`now`), isolated from the vendor and the store so they are unit-testable without either.

The binding property (D4) is the FAIRNESS / ANTI-HERD guarantee: a cycle NEVER computes more than
`slow_batch_size` symbols regardless of how many moved, and at most `min(promotion_cap, slow_batch_size)`
slots go to promotions — so at least `slow_batch_size - promotion_cap` baseline round-robin slots are
guaranteed every cycle, meaning a market-wide move degrades to base cadence (the round-robin still
advances) rather than a thundering herd. Priority within promotions: never-computed ('building') first,
then moved symbols by most-overdue (now - last_compute_at) desc."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class SweepConfig:
    move_threshold_pct: float = 0.75    # D4: > this % move since last compute -> promotion candidate
    slow_batch_size: int = 4            # pool ~4 (the concurrency bound = symbols computed per cycle)
    promotion_cap: int = 2              # max promotion slots per cycle (anti-herd; < slow_batch_size)


@dataclass(frozen=True)
class SymbolSched:
    symbol: str
    last_compute_at: Optional[float]    # None = never computed (a 'building' symbol)
    last_compute_price: Optional[float]


@dataclass(frozen=True)
class CyclePlan:
    batch: list[str]        # the symbols to compute this cycle (<= slow_batch_size)
    next_cursor: int        # advanced round-robin cursor
    promoted: list[str]     # the subset of `batch` that jumped the queue (building + moved)


def pct_move(old: Optional[float], new: Optional[float]) -> Optional[float]:
    """Absolute % move from `old` to `new`. None when `old` is missing/non-positive or `new` is
    missing (we never fabricate a move on a symbol we couldn't price)."""
    if old is None or old <= 0 or new is None:
        return None
    return abs(new - old) / old * 100.0


def detect_moves(universe: list[str], scheds: dict, prices: dict,
                 threshold_pct: float) -> list[str]:
    """Universe symbols (already computed at least once) whose live price moved STRICTLY MORE than
    `threshold_pct` since their last compute. Order-preserving over `universe`."""
    moved: list[str] = []
    for sym in universe:
        sched = scheds.get(sym)
        if sched is None or sched.last_compute_at is None:
            continue  # never computed -> handled as 'building', not a move
        mv = pct_move(sched.last_compute_price, prices.get(sym))
        if mv is not None and mv > threshold_pct:
            moved.append(sym)
    return moved


def _round_robin(universe: list[str], cursor: int, n: int, exclude: set) -> "tuple[list[str], int]":
    """Collect up to `n` symbols walking `universe` from `cursor`, skipping `exclude`, wrapping AT
    MOST once (so it terminates even when n > available). Returns (picked, next_cursor)."""
    out: list[str] = []
    total = len(universe)
    if total == 0 or n <= 0:
        return out, (cursor % total) if total else 0
    i = cursor % total
    steps = 0
    while len(out) < n and steps < total:
        sym = universe[i]
        if sym not in exclude:
            out.append(sym)
        i = (i + 1) % total
        steps += 1
    return out, i


def plan_cycle(universe: list[str], scheds: dict, prices: dict, rr_cursor: int,
               cfg: SweepConfig, now: float, moved: Optional[list] = None) -> CyclePlan:
    """Plan ONE slow-lane cycle. `moved` may be precomputed (the fast lane's running set); when None
    it is derived here via detect_moves. Deterministic given `now`."""
    building = [s for s in universe
                if s in scheds and scheds[s].last_compute_at is None]
    if moved is None:
        moved_list = detect_moves(universe, scheds, prices, cfg.move_threshold_pct)
    else:
        moved_list = [s for s in universe
                      if s in set(moved) and s in scheds and scheds[s].last_compute_at is not None]

    # Rank promotions: building first (order-preserving), then moved by most-overdue desc.
    moved_ranked = sorted(
        moved_list, key=lambda s: now - (scheds[s].last_compute_at or now), reverse=True)
    ranked = building + moved_ranked

    promo_slots = min(cfg.promotion_cap, cfg.slow_batch_size)
    promoted = ranked[:promo_slots]
    remaining = cfg.slow_batch_size - len(promoted)
    baseline, next_cursor = _round_robin(universe, rr_cursor, remaining, exclude=set(promoted))
    return CyclePlan(batch=promoted + baseline, next_cursor=next_cursor, promoted=promoted)
