# bundle-events — FRONTEND_EXECUTION_CONTRACT

> **NO_UI_CHANGE** — GATE M backend fast-path. The bundle gains an additive nullable
> `market_state.event_calendar` block; the frontend consumes nothing and renders nothing this phase
> (the `meta.trace_id` precedent — the trader dashboard ignored it until a surface wanted it).
> A later FE pass may render the event chip / flag "this expiration contains an event" per
> `INTERFACE_CONTRACT.md`, at which point the closed `state` lookup (`unknown` / `none` / `scheduled`)
> is binding: **`unknown` must never render as "no earnings scheduled"**. No build in this phase.
