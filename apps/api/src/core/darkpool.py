"""
Off-exchange ("dark pool") activity from the trade tape.

Off-exchange prints are trades reported via a TRF (trf_id present) — dark pools/ATSs AND
internalized retail (wholesalers). So this is NOT a clean "institutions accumulating"
signal: side/intent are unknown and much of the volume is retail. We surface it only as
neutral CONTEXT: where off-exchange volume concentrated, and how much of total volume was
off-lit. The downstream AI is told not to infer direction.

Computed over a bounded recent window (see DARKPOOL_LOOKBACK_SECONDS) — not a multi-session
accumulation view, which would need a heavy batched pull.
"""
import logging
import time

logger = logging.getLogger("GammaFlowAsync")

# Default institutional-size threshold for a "block" print (shares). Env-tunable via
# BLOCK_MIN_SHARES in main.py; this is the fallback used when a caller doesn't pass one.
DEFAULT_BLOCK_MIN_SHARES = 5000


def analyze_off_exchange(trades: list, spot: float, *, top_n: int = 5,
                         bucket_pct: float = 0.0025, min_level_share: float = 0.03,
                         block_min_shares: int = DEFAULT_BLOCK_MIN_SHARES,
                         block_top_n: int = 5, now_ns: int | None = None) -> dict | None:
    """
    Summarize off-exchange prints into volume-by-price levels + an off-exchange ratio,
    plus the largest individual block prints.

    trades: list of TradePrint dicts (price, size, timestamp[ns], off_exchange).
    spot:   current/display spot, for proximity.
    Buckets prices to `bucket_pct` of spot (default 0.25%); keeps the top_n off-exchange
    levels that each hold >= min_level_share of off-exchange volume.

    `blocks`: each single off-exchange print with shares >= `block_min_shares`, ranked
    DESCENDING by notional (price*shares), capped at `block_top_n` (default 5). Derived in
    this same pass from the same trades (no new fetch). Display-only: no side is inferred.
    `proximity_pct` is SIGNED vs spot (+ above, - below); `age_seconds` is the print's age
    within the recent window (relative to `now_ns`, defaulting to wall-clock now).

    Returns None when there's nothing usable so the caller can omit the block entirely.
    """
    if not trades or spot <= 0:
        return None

    if now_ns is None:
        now_ns = time.time_ns()

    total_vol = 0.0
    offex_vol = 0.0
    by_bucket: dict = {}   # bucketed price -> off-exchange shares
    blocks: list = []      # individual off-exchange prints >= block_min_shares
    step = max(spot * bucket_pct, 0.01)

    for tr in trades:
        size = tr.get("size") or 0.0
        if size <= 0:
            continue
        total_vol += size
        if not tr.get("off_exchange"):
            continue
        offex_vol += size
        price = tr["price"]
        bucket = round(round(price / step) * step, 2)
        by_bucket[bucket] = by_bucket.get(bucket, 0.0) + size
        if size >= block_min_shares:
            ts = tr.get("timestamp") or 0
            age_seconds = int(max(0, (now_ns - ts) / 1e9)) if ts else 0
            blocks.append({
                "price": price,
                "shares": int(size),
                "notional": round(price * size, 2),
                "proximity_pct": round((price - spot) / spot, 4),
                "age_seconds": age_seconds,
            })

    if offex_vol <= 0:
        return None

    levels = []
    for price, shares in sorted(by_bucket.items(), key=lambda kv: kv[1], reverse=True):
        if shares / offex_vol < min_level_share:
            continue
        levels.append({
            "price": price,
            "shares": int(shares),
            "share_of_offex_pct": round(100.0 * shares / offex_vol, 1),
            "proximity_pct": round((price - spot) / spot, 4),
        })
        if len(levels) >= top_n:
            break

    # Largest notional first; drop ties/overflow beyond the cap.
    blocks.sort(key=lambda b: b["notional"], reverse=True)
    blocks = blocks[:block_top_n]

    return {
        "ratio_pct": round(100.0 * offex_vol / total_vol, 1) if total_vol > 0 else None,
        "offex_shares": int(offex_vol),
        "total_shares": int(total_vol),
        "levels": levels,
        "blocks": blocks,
        "block_min_shares": int(block_min_shares),  # threshold a print needed to count as a block
        "note": "Off-exchange/TRF prints over a recent window; side & intent unknown, "
                "includes internalized retail. Use as context, not a directional signal.",
    }
