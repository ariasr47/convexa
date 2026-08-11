# app-shell-landing — INTERFACE CONTRACT (FE ↔ BE truth)

> Compressor #3 output. The single source of truth for what crosses the FE↔BE seam. Emitted from
> UX_BLUEPRINT.md. Self-contained; assume no chat history.

## Posture: `NO_BACKEND_CHANGE`

This feature is a **frontend-only restructure + one new static page** (the Convexa landing) + one new
static placeholder (`/scanner`). It **adds no backend surface, changes no endpoint, changes no payload,
and changes no SSE behavior.** It consumes the EXISTING backend exactly as the shipped single-page
dashboard does today.

- **No new endpoint.** No route added on `apps/api`.
- **No payload/field change.** No request param added/removed; no response field added/removed/renamed.
- **No SSE change.** The live stream contract (mid / spread / net_flow / live gamma_flip / session) is
  unchanged; only **where** the FE mounts/unmounts the subscription changes (page-scoped to the relocated
  Ticker viewer — that is purely client lifecycle, invisible to the backend beyond the existing
  ref-counted `LiveHub` teardown).

## Existing endpoints this feature consumes (UNCHANGED — pointer only)

| Endpoint / channel | Consumed by | Notes (existing behavior; not changed here) |
|---|---|---|
| `GET /api/ticker/{ticker}` (+ `GET /{ticker}` alias, slices) | Relocated Ticker viewer (`/ticker/:symbol`) | The heavy GEX bundle, polled ~60s, cached. DTE/expiration/dark-pool/position query params unchanged. |
| SSE live stream (`streamTicker`, EventSource) | Relocated Ticker viewer (page-scoped) + standalone Positions marks (per Q2, existing mechanism) | Light live payload. `LiveHub` ref-counts one session per ticker (8s grace). At most one SSE per ticker at a time — preserved structurally (Ticker page unmounted while on `/positions`). |
| `GET /api/contract/{ticker}` | Relocated Positions page (standalone mark sourcing, Q2) + ghost-trade | Filter-independent tracked-contract lookup. `404` → tracking-unavailable; `option_quote: null` → no-live-quote fallback. Degrade-to-last-known is a **client** behavior; the endpoint is unchanged. |
| `GET /api/recommendation/*`, `GET /api/personas` | Relocated Ticker viewer (ai-rec / personas, unchanged) | Moved with the Ticker viewer; not re-wired. |
| `GET /api/_metrics` | `/_ops/metrics` operator surface (UNCHANGED, off the shell) | Not reachable from the product nav (AC-Inv-7). |

## Surfaces that touch the backend NOT AT ALL (new chrome)

- **`Landing` (`/`)** — static. No fetch, no SSE, no compute. (AC-Route-1, AC-Nav-5.)
- **`AppShell`** — chrome only. No fetch. (AC-Nav-1..4.)
- **`Scanner` (`/scanner`)** — static "coming soon". No fetch, no SSE, no scan/compute, no backend call.
  Observable: no network request is issued when the Scanner page is shown. (AC-Scan-1.)
- **Landing "connect your brokerage" / waitlist affordance** — non-navigating coming-soon
  acknowledgement. No broker call, no order path, no real-position read. (AC-Land-5, `[no-real-order-path]`.)

## Conformance spec

**None required for this feature.** Per the `NO_BACKEND_CHANGE` posture there is no new or changed
backend surface to machine-check, so **no `## Conformance spec` JSON block is emitted** (and
`.claude/tools/interface_conformance.py` has nothing new to assert here). The existing endpoints retain
their already-verified contracts; this feature's correctness is verified entirely by the FE test suite
(the FRONTEND_EXECUTION_CONTRACT "Tests to write" matrix) + the standing interface conformance of the
unchanged endpoints. If any executioner discovers a backend change is actually needed, that is a GATE-Z
bounce — it must NOT be introduced silently here.
