# BACKEND EXECUTION CONTRACT — Dark-pool block trades + isolation

> For the Backend Executioner (Session 4A). Binds to GAMMAFLOW_CONTEXT.md + INTERFACE_CONTRACT.md.
> Server work ONLY — no UI. Implement to spec; do not redesign or add features.

## Files / functions to modify
- `src/providers/base.py` — add a `BlockPrint` TypedDict; extend the `OffExchange` TypedDict with
  `blocks: list[BlockPrint]`.
- `src/core/darkpool.py` — in the existing off-exchange analysis pass (the one that already builds
  `levels` from the recent trade tape), derive `blocks` in the **same pass, from the same trades**
  (no new fetch). Wrap the whole off-exchange computation so any failure yields `off_exchange =
  None`.
- `main.py` — add `BLOCK_MIN_SHARES` env (int, institutional-size default); ensure `compute_ticker`
  treats off-exchange as **best-effort** (try/except around it → `off_exchange = None`, bundle still
  returned). Confirm the SSE generator / `LiveSession` path shares no failure surface with bundle
  computation.
- `src/core/signals.py` — **no change.** Blocks must NOT feed `opportunity_score` or
  `dark_pool_confluence` in v1.

## Spec
Honor these binding constraints (from GAMMAFLOW_CONTEXT + ARCHITECTURE_CONTRACT):
- **Off-exchange = `trf_id` present.** Recent-window only (`DARKPOOL_LOOKBACK_SECONDS`); reuse the
  existing trade pull — **no new fetch.**
- **A block** = a single off-exchange print with `shares >= BLOCK_MIN_SHARES`.
  - `notional = price * shares`.
  - `proximity_pct` = **signed** percentage vs spot (`+` above spot, `−` below) — same convention as
    the existing `levels[].proximity_pct`.
  - `age_seconds` = age of the print within the window.
- **Ranking + cap:** sort **descending by `notional`**, take **top-N = 5**. Drop ties/overflow.
- **Gamma sourcing untouched:** this feature does not read or alter vendor/analytic gamma, the
  flip, or walls.
- **Isolation (critical):** dark-pool computation is non-critical. Any exception (trade-fetch error,
  parse error, empty tape) must be **caught + logged**, returning `off_exchange = None`, leaving
  `market_state` + `strike_profile` (the GEX chart arrays) and the rest of the bundle fully intact.
  The SSE code path stays independent and per-tick fault-tolerant; it must not produce chart arrays
  or block data.

## Must emit (from INTERFACE_CONTRACT.md)
- `off_exchange.blocks[]` with per-item `price` (number), `shares` (int), `notional` (number),
  `proximity_pct` (signed number), `age_seconds` (int).
- Present only when `dark_pool=true`. `blocks` may be `[]` (none ≥ threshold). On best-effort
  failure, omit the **entire** `off_exchange` object (NOT an HTTP error).
- **No `side`/`direction`/`bias` field on a block.**
- `opportunity_score` / `signals.dark_pool_confluence` unchanged (no block contribution).

## Verification
- [ ] `curl '/api/ticker/TSLA?dark_pool=true'` → `off_exchange.blocks` is a list, **descending
      notional**, length ≤ 5, each item has `price/shares/notional/proximity_pct/age_seconds`, no
      `side`.
- [ ] `curl '/api/ticker/TSLA?dark_pool=false'` → `off_exchange` (and `blocks`) absent.
- [ ] Force a trade-fetch/parse failure → bundle still 200 with valid `market_state` +
      `strike_profile`; `off_exchange` omitted (not a 500).
- [ ] A session with no prints ≥ threshold → `off_exchange` present, `blocks: []`.
- [ ] `opportunity_score` identical with/without a block present at a wall/flip (no score change).

## Out of scope
- No frontend. No endpoint shape changes beyond the interface contract. No gamma-math changes.
- No ADV-relative threshold (fixed `BLOCK_MIN_SHARES` only in v1). No multi-session accumulation.

## Definition of done
- [ ] Code implemented to spec and verified (see Verification).
- [ ] `.claude/GAMMAFLOW_CONTEXT.md` refreshed to reflect the merged code (re-read touched
      files; same section structure), and `market_state_glossary.md` updated with the
      `off_exchange.blocks[]` fields (draft in UX_BLUEPRINT.md → glossary addition).
- [ ] This feature's `.claude/contracts/<feature>/` folder archived (it's shipped), and
      `.claude/OPEN_THREADS.md` updated for anything opened/closed. (Coordinate with frontend so
      the folder is archived once both lanes land.)
- [ ] Committed.
