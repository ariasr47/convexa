# app-shell-landing — BACKEND EXECUTION CONTRACT

## `NO_BACKEND_CHANGE`

This feature is frontend-only. **No backend work.** No new endpoint, no payload change, no SSE change, no
config change on `apps/api`. The relocated Ticker viewer + standalone Positions page consume the
**existing** `GET /api/ticker`, the existing SSE stream, `GET /api/contract`, `GET /api/recommendation/*`,
and `GET /api/personas` unchanged (see INTERFACE_CONTRACT.md). The operator `GET /api/_metrics` is
untouched and stays off the product nav. Backend lane: nothing to do.
