# ARCHITECTURE CONTRACT — Dark-pool block trades + live-stream isolation

> Producer: Architect (Session 1). Consumer: PM (Session 2).
> Reader has only `.claude/GAMMAFLOW_CONTEXT.md` + this file. No UI, no endpoint signatures.

## Goal
Two coupled upgrades: (a) add **dark-pool BLOCK trades** (individual large off-exchange prints)
to the off-exchange data structure, and (b) formalize an **isolation boundary** so a live-stream
(SSE) disconnect can never degrade the static GEX chart arrays or any cached bundle data.

## Binding constraints (must not be violated)
- **Gamma sourcing unchanged:** vendor gamma for the per-strike profile/walls; analytic
  Black-Scholes only for the gamma-flip ±20% grid search. This feature touches neither.
- r = 4.5%; dividend yield q; time-to-expiry floored at 1/365.
- Dark-pool data is **context, not directional** (off-exchange volume includes internalized
  retail; prints have no reliable side). No accumulation/distribution inference.
- The DTE/expiration filter shapes gamma structure only; off-exchange/blocks are independent of it.

## Data structures (the deliverable)
Extend the existing off-exchange layer (`src/core/darkpool.py`, `src/providers/base.py`):

- New `BlockPrint` (per individual large off-exchange trade):
  - `price: float`, `shares: int`, `notional: float` (= price·shares),
  - `timestamp: int` (ns), `age_seconds: int`, `proximity_pct: float` (signed, vs spot).
- Extend `OffExchange` with `blocks: list[BlockPrint]` (largest-notional first, top-N), alongside
  the existing `ratio_pct`, `offex_shares`, `total_shares`, `levels[]`, `note`.
- A block = off-exchange print (`trf_id` present) with `shares >= BLOCK_MIN_SHARES`
  (env-tunable; default a fixed share threshold, with an ADV-relative option noted as future).
- Reuse the existing trade pull (`fetch_recent_trades`, already carries `off_exchange`); blocks
  are derived in the same pass as `levels` — **no new fetch**. Recent-window only (same bounded
  `DARKPOOL_LOOKBACK_SECONDS`); multi-session block history is explicitly out of scope.

## Data-flow & component changes
- **Static path (REST, cached):** `compute_ticker` already computes `off_exchange` from the REST
  trade tape and places it in the bundle. Block detection lives here too. Therefore blocks and all
  GEX/chart arrays travel together over the cached bundle — **structurally independent of SSE.**
- **Live path (SSE):** `LiveSession`/`LiveHub` stream mid/spread/net-flow/live-flip only. They do
  NOT produce chart arrays or block data.
- No new cross-dependency may be introduced between these paths.

## Error-isolation design (the deliverable)
There is no separate gateway process; isolation is **architectural** (decoupled paths) and must be
guaranteed by these rules:
1. **Independent code paths.** Bundle endpoints and the SSE endpoint share no failure surface; an
   exception in the SSE generator/`LiveSession` cannot propagate into bundle computation, and vice
   versa. (The live broadcast loop is already per-tick fault-tolerant; keep it so.)
2. **Best-effort dark-pool.** The block/off-exchange computation is non-critical: any failure
   (trade-fetch error, parse error) must be caught and yield `off_exchange = None`, leaving
   `market_state` + `strike_profile` (the GEX chart arrays) fully intact. The chart never depends
   on dark-pool data.
3. **Chart binds to bundle, never to live.** The GEX chart arrays come from the cached bundle
   (REST). A dropped/abandoned SSE connection changes only the live-derived fields.
4. **Degraded-but-served.** On SSE loss the system continues serving the last cached bundle; the
   live layer's existing `live=false` + `market_session` already signal staleness. The contract:
   static data stays authoritative and visible; only live-derived fields go "offline."

## Non-goals (out of scope)
- No UI/layout, no component states, no endpoint signatures (PM/UX/Interface own those).
- No multi-session block accumulation map (needs a heavier batched pull).
- No change to gamma math, the flip, walls, or the provider port shape beyond the new TypedDicts.

## Open questions for downstream
- Block threshold: fixed share count vs % of ADV (PM to set the user-facing rule).
- Should blocks that coincide with a gamma wall/flip add to the confluence bonus, or stay
  display-only? (PM decides; keep any bonus capped, per GAMMAFLOW_CONTEXT decisions.)
- Stream-offline UX specifics (badge, frozen tiles, retain-cached-chart) → PM + UX.
