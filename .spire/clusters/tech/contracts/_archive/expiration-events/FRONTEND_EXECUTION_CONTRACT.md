# expiration-events — FRONTEND_EXECUTION_CONTRACT

> **NO_UI_CHANGE** — GATE M backend fast-path. `market_state.event_calendar.expirations[]` is added to
> the bundle; the frontend consumes nothing and renders nothing this phase. When a surface does render
> it, `INTERFACE_CONTRACT.md` §3 is binding: **read `event_calendar.state` FIRST** — an empty
> `expirations` under `state: "unknown"` means *we don't know*, never *no expiry is affected*. No build
> in this phase.
