# FRONTEND EXECUTION CONTRACT — Dark-pool block trades + isolation

> For the Frontend Executioner (Session 4B). Binds to GAMMAFLOW_CONTEXT.md + INTERFACE_CONTRACT.md
> + the UX_BLUEPRINT component states. UI work ONLY — no server internals. Implement to spec.

## Files / components to modify
- `libs/api/src/lib/gammaflow.ts` — add a `BlockPrint` interface (`price`, `shares`, `notional`,
  `proximity_pct`, `age_seconds`); extend `OffExchange` with `blocks: BlockPrint[]`. No call-shape
  change (the `dark_pool` param already exists).
- `apps/dashboard/src/app/app.tsx`:
  - Add the **Off-exchange blocks** section (below `GexProfileChart`, above `Setups`) — see states.
  - Add **Stream Offline** detection + a single connection chip; dim live-derived tiles when offline.
  - **Fix the cold-start-vs-refresh-failure split** (current `error` Alert blanks the view even when
    a prior bundle exists — must not, per the contract).

## Consumes (from INTERFACE_CONTRACT.md)
- `off_exchange.blocks[]`: `shares`, `price`, `notional`, `proximity_pct` (signed vs spot),
  `age_seconds`. Already **largest-notional-first, top-N (5)** from the backend — render in order,
  do **not** re-sort or re-cap. Present only when `dark_pool` on; `off_exchange` may be **absent**
  (best-effort miss). `blocks` may be `[]`.
- `off_exchange.blocks` carries **no side/direction** — render none; the proximity chip is neutral
  (NOT green/red).
- Offline detection inputs: `live.live` (bool), `live.tick_age_s`, `live.market_session`, **plus**
  the `EventSource` transport (onerror / readyState / payload-gap). A dropped stream sends **no
  payloads**, so it cannot be detected from `live.*` alone.
- **Do not** read or surface any block contribution to `opportunity_score` (display-only in v1).

## Component states to implement (from UX_BLUEPRINT.md)
**Live-derived tiles** (headline price, `Net flow`, `Spread`, `Gamma flip (live)`):
- **Normal** (`live.live === true`): live values + accents, as today.
- **Loading (cold)**: price → bundle `market_state.price`; `Net flow`/`Spread` → `—`; flip → static
  `market_state.gamma_flip`; toolbar spinner; no offline badge.
- **Stream Offline**: keep **last value, dimmed** (reduced opacity) + a small `⏸ offline` caption
  under the tile label; never blank, never present a frozen number as current. Flip tile **drops the
  "(live)" suffix** and shows the static `market_state.gamma_flip`. Headline price reverts to
  `market_state.price`. `Net flow`/`Spread` keep `—`.
- **Session-explained** (payload with `live === false`, e.g. overnight/closed): unchanged — the
  existing session chip explains why. This is NOT the offline state.

**Off-exchange blocks section** (mirror the `Setups` section pattern):
- **Hidden**: `Dark pool` toggle off → section absent entirely.
- **Normal**: `off_exchange.blocks` non-empty → header `Off-exchange blocks` + ⓘ tooltip + binding
  caption + a row per block: `{shares} sh @ ${price}` · neutral proximity chip `±x.x% vs spot` ·
  `{age} ago` (reuse `humanAge`).
- **Empty (in-window)**: toggle on, `off_exchange` present, `blocks` empty → muted
  `No blocks ≥ {threshold} shares in the recent window.`
- **Unavailable**: toggle on, `off_exchange` **absent** → muted `Off-exchange data unavailable this
  cycle.` (chart + all other stats still render normally).

**Connection / page level:**
- **Stream Offline / reconnecting**: single warning chip `⚠ Live offline — reconnecting…` triggered
  by EventSource `onerror` after OPEN **or** no payload for `> STREAM_OFFLINE_MS` (~15s). Clears on
  the next payload (auto-reconnect; no manual refresh).
- **Bundle refresh failed (after ≥1 success)**: keep the whole last bundle on screen; inline warning
  `Couldn't refresh — showing data from {age} ago. Retrying automatically.` — **never blank.**
- **Cold-start error (only blank screen)**: `getTicker` rejects with `!data` → error detail + a
  `Retry` button.
- Reused unchanged: bundle-stale alert (`data is {age} old …`), no-expirations info alert,
  session-aware live chip.

Exact copy strings: see UX_BLUEPRINT.md → "Microcopy & tooltips". Use them verbatim.

## Degradation behavior (isolation — binding)
- A **stream error degrades ONLY the live-derived tiles + the connection chip.** The `GexProfileChart`
  and every static tile (`Call wall`, `Put wall`, `Net GEX`, `Max pain`, `IV/HV`, `VWAP`,
  `Off-exchange %`, `Opportunity`) and the **blocks section** keep rendering from the last bundle.
- **Bind the chart's `gammaFlip` and `spot` to bundle values** when offline (it already falls back to
  `m.gamma_flip` / `m.gex_spot`); the chart must never depend on `live.*` to render.
- **Blocks ride the bundle only** — they must never update from the SSE stream and have no offline
  state of their own (they age with the bundle freshness indicator).
- **No frozen value masquerades as live** (dim + `⏸ offline`); **one** connection chip, not per-tile.

## Verification
- [ ] Kill the backend SSE mid-session → `⚠ Live offline — reconnecting…` chip appears, live tiles
      dim with `⏸ offline`, and the GEX chart + every static stat + the blocks section stay fully
      rendered and unchanged.
- [ ] Restart SSE → live tiles resume, offline chip clears, **no manual refresh**.
- [ ] Toggle `Dark pool` on → blocks list shows largest-notional-first, ≤ 5 rows, each with size,
      price, neutral ±% proximity, age, and **no** side/direction; toggle off → section gone.
- [ ] Stop the bundle endpoint after one successful load → chart + stats stay on screen with
      `Couldn't refresh — showing data from {age} ago.`; screen does not blank.
- [ ] Cold-load against an unknown ticker → error + `Retry` (the only blank/error screen).
- [ ] Bundle good but `off_exchange` absent → chart + all other stats normal; blocks area shows
      `Off-exchange data unavailable this cycle.`

## Out of scope
- No backend. No data-shape changes (bind to the interface contract). No new endpoints.
- No block → opportunity-score wiring. No re-sorting/re-capping blocks client-side.

## Definition of done
- [ ] UI implemented to spec and verified (see Verification).
- [ ] `.claude/GAMMAFLOW_CONTEXT.md` refreshed if the UI changed the system's described
      behavior/state (re-read touched files; same section structure).
- [ ] This feature's `.claude/contracts/<feature>/` folder archived (it's shipped), and
      `.claude/OPEN_THREADS.md` updated for anything opened/closed. (Coordinate with backend so
      the folder is archived once both lanes land.)
- [ ] Committed.
