"""Project a computed bundle into ONE ScanRow — CONSUME, never re-derive. score/regime/vol_regime/
flip/walls are read straight off the bundle compute_ticker produced. `tier` is consumed via the SAME
helper the serve path uses (src.core.signals.compute_opportunity_tier), with the same env-config bands
and the same ai_eval.ready — so a scanner row's tier equals the Ticker page's tier for the same
compute (AC-10); this is consuming the transform, not re-deriving math. `dist_to_flip_pct` /
`dist_to_wall_pct` are pure DISPLAY TRANSPORT (signed % of price vs the consumed level), exactly as the
Ticker page renders them — no engine/greeks math. Every numeric field is nullable: a partial/failed
compute still yields an honest row. as_of = the STRUCTURE compute time; a fast-lane price update keeps
as_of and only refreshes price/status (two-speed honesty)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from src.core.signals import compute_opportunity_tier
from src.scanstore import ScanRow


@dataclass(frozen=True)
class TierBands:
    watch: int
    actionable: int
    prime: int


def _signed_dist_pct(price: Optional[float], level: Optional[float]) -> Optional[float]:
    """Signed % of `price` relative to `level` (+ above the level, - below). Pure transport."""
    if price is None or price <= 0 or level is None:
        return None
    return round((price - level) / price * 100.0, 2)


def _nearer_wall_dist(price: Optional[float], call_wall: Optional[float],
                      put_wall: Optional[float]) -> Optional[float]:
    walls = [w for w in (call_wall, put_wall) if w is not None]
    if price is None or price <= 0 or not walls:
        return None
    nearer = min(walls, key=lambda w: abs(price - w))
    return round((price - nearer) / price * 100.0, 2)


def _status_for(as_of: float, now: float, stale_after: float, base: str = "ok") -> str:
    return "stale" if (as_of > 0 and (now - as_of) > stale_after) else base


def project_row(symbol: str, bundle: dict, now: float, bands: TierBands,
                price: Optional[float] = None, chg_pct: Optional[float] = None) -> ScanRow:
    """Full projection from a fresh compute. `price`/`chg_pct` override the display spot with the
    fast-lane poll value when provided (fresher); else the bundle's display price is used."""
    state = bundle.get("market_state", {}) or {}
    sig = bundle.get("signals", {}) or {}
    ai_eval = bundle.get("ai_eval", {}) or {}

    score = sig.get("opportunity_score")
    try:
        tier = compute_opportunity_tier(
            int(score or 0), bool(ai_eval.get("ready")),
            watch=bands.watch, actionable=bands.actionable, prime=bands.prime)
    except Exception:
        tier = None

    display_price = price if price is not None else state.get("price")
    flip = state.get("gamma_flip")
    call_wall = state.get("call_wall")
    put_wall = state.get("put_wall")

    return ScanRow(
        symbol=symbol.upper(),
        price=display_price,
        chg_pct=chg_pct,
        score=score,
        tier=tier,
        regime=sig.get("regime"),
        vol_regime=sig.get("vol_regime"),
        flip=flip,
        dist_to_flip_pct=_signed_dist_pct(display_price, flip),
        call_wall=call_wall,
        put_wall=put_wall,
        dist_to_wall_pct=_nearer_wall_dist(display_price, call_wall, put_wall),
        as_of=now,
        status="ok",
    )


def project_building(symbol: str) -> ScanRow:
    """A tracked-but-never-computed symbol: present, honestly not-yet-scored (as_of=0.0)."""
    return ScanRow(symbol=symbol.upper(), price=None, chg_pct=None, score=None, tier=None,
                   regime=None, vol_regime=None, flip=None, dist_to_flip_pct=None,
                   call_wall=None, put_wall=None, dist_to_wall_pct=None, as_of=0.0, status="building")


def project_error(symbol: str, prev: Optional[ScanRow], now: float) -> ScanRow:
    """This symbol's last compute failed: degrade THIS row to `error`, keeping any prior structure
    (frozen) so the table still shows the last-known values with an honest status."""
    if prev is None:
        r = project_building(symbol)
        return ScanRow(**{**r.__dict__, "status": "error"})
    return ScanRow(**{**prev.__dict__, "status": "error"})


def project_price_only(symbol: str, prev: Optional[ScanRow], price: Optional[float],
                       chg_pct: Optional[float], now: float, stale_after: float) -> ScanRow:
    """Fast-lane price update: merge the poll price/chg onto the prior STRUCTURE row, keep as_of at
    the structure compute time, and recompute status by structure age (ok<->stale). A `building` row
    stays building (still no structure) but shows the price. Never fabricates a structure."""
    if prev is None:
        prev = project_building(symbol)
    dist_flip = _signed_dist_pct(price, prev.flip)
    dist_wall = _nearer_wall_dist(price, prev.call_wall, prev.put_wall)
    if prev.status == "building":
        status = "building"
    else:
        status = _status_for(prev.as_of, now, stale_after, base="ok")
    return ScanRow(**{**prev.__dict__, "price": price, "chg_pct": chg_pct,
                      "dist_to_flip_pct": dist_flip, "dist_to_wall_pct": dist_wall,
                      "status": status})


def refresh_status(row: ScanRow, now: float, stale_after: float) -> ScanRow:
    """Recompute a row's status by structure age only (used when a poll had no price for a symbol —
    freeze everything, just age the status). `building` stays building."""
    if row.status == "building":
        return row
    return ScanRow(**{**row.__dict__, "status": _status_for(row.as_of, now, stale_after,
                                                             base="ok" if row.status == "ok" else row.status)})
