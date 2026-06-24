# INTERFACE CONTRACT — Dark-pool block trades + live-stream isolation

> The single source of FE↔BE integration truth. Both execution contracts bind to THIS file.
> Producer: Split Compressor (Session 3 exit). Consumers: Backend (4A) + Frontend (4B).
> Self-contained against `.claude/GAMMAFLOW_CONTEXT.md`.

## Endpoints touched
- `GET /api/ticker/{ticker}` (+ alias `GET /{ticker}`) — the cached bundle. **Only the
  `off_exchange` object changes** (new `blocks[]`). Existing query params unchanged:
  `min_dte`, `max_dte`, `expirations`, `dark_pool` (bool). `off_exchange` (and therefore
  `blocks`) is present **only when `dark_pool=true`**.
- `GET /api/stream/{ticker}` — SSE live payload. **No shape change.** Listed only to pin the
  fields the FE uses for offline detection (below).

## Payload additions — bundle `off_exchange`
`off_exchange` is present only when `dark_pool=true`. The whole object **may be omitted** even
when `dark_pool=true` if block/off-exchange computation failed for that cycle — this is a
best-effort miss, **NOT an error**, and the rest of the bundle (`market_state`,
`strike_profile`, `signals`, `meta`) is fully intact.

```jsonc
"off_exchange": {
  "ratio_pct": 0.0,                 // number | null  (unchanged)
  "offex_shares": 0,                // int            (unchanged)
  "total_shares": 0,                // int            (unchanged)
  "levels": [                        // unchanged
    { "price": 0, "shares": 0, "share_of_offex_pct": 0, "proximity_pct": 0 }
  ],
  "blocks": [                        // NEW — largest notional first, top-N (N = 5), may be []
    {
      "price": 0,                    // number  — print price
      "shares": 0,                   // int     — print size
      "notional": 0,                 // number  — price * shares (ranking key)
      "proximity_pct": 0,            // number  — SIGNED vs spot: + above spot, − below
      "age_seconds": 0               // int     — age of the print within the recent window
    }
  ],
  "block_min_shares": 0,             // NEW (amendment) — int; active block threshold this cycle
  "note": "string"                   // unchanged
}
```

> **Amendment (post-ship):** `block_min_shares` was added to the `off_exchange` object so the FE
> can label the blocks empty-state ("No blocks ≥ N shares…") from the payload instead of a
> hardcoded mirror of the backend default. Additive + always present when `off_exchange` is.

Binding presence/ordering rules:
- `blocks` ordering: **descending `notional`** (largest first). Ties/overflow beyond N are not
  emitted.
- `blocks` cap: **top-N where N = 5.**
- A block = a single off-exchange print (`trf_id` present) with `shares >= BLOCK_MIN_SHARES`
  (env-tunable; institutional-size default). Recent-window only (same `DARKPOOL_LOOKBACK_SECONDS`
  as existing off-exchange), no new fetch.
- **No `side`/`direction`/`bias` field exists on a block, now or in v1.** The FE must not invent one.
- `blocks` may be `[]` (toggle on, bundle good, none ≥ threshold in window) — distinct from
  `off_exchange` being **absent** (best-effort failure).

## Opportunity-score isolation
- Blocks are **display-only in v1.** They do **not** affect `opportunity_score` and are **not**
  reflected in `signals.dark_pool_confluence`. `dark_pool_confluence` continues to reflect ONLY
  the existing aggregate **levels** bonus (unchanged, already capped + toggleable).

## Live payload (SSE) — fields the FE binds for offline detection (unchanged)
- `live` (bool) — true only if a real tick arrived recently.
- `tick_age_s` (number | null).
- `market_session` (string: `premarket | regular | afterhours | overnight | closed`).
- These distinguish a **healthy-but-quiet** session (`live=false`, session chip explains why) from
  a **dropped stream**. A dropped stream sends **no payloads at all**, so it is detected at the
  **transport layer** (EventSource `onerror` / `readyState` / payload-gap), NOT via a new field.

## Error / stream semantics (the isolation contract)
- **Bundle 404** (no chain for ticker) → cold-start error path on the FE (only when no prior bundle).
- **Best-effort off-exchange failure** → `off_exchange` omitted from an otherwise-valid bundle.
  This is **not** an HTTP error; the chart + all non-off-exchange stats still render.
- **Bundle refresh failure after a prior success** → FE keeps the last good bundle (REST is
  pollable + cached); reuse `meta.freshness` for age. The backend emits nothing new here.
- **SSE disconnect** → FE treats the last bundle as authoritative; `EventSource` auto-reconnects;
  on reconnect the next payload clears the FE offline state. The backend's live loop stays
  per-tick fault-tolerant (an SSE-side exception must not touch bundle computation).
- **Binding rule:** **no field the GEX chart or any static tile depends on may come from the SSE
  stream.** Chart + static stats + blocks all travel in the REST bundle.
