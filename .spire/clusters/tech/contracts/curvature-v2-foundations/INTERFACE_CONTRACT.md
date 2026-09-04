# INTERFACE CONTRACT — curvature-v2-foundations (FE↔BE truth)

**Spec:** `.spire/clusters/tech/contracts/curvature-v2-foundations/SPEC.md`
**Posture:** **`NO_BACKEND_CHANGE`**

## Posture: `NO_BACKEND_CHANGE` — the `apps/api` diff must be empty

This phase is **frontend-only**. It introduces no endpoint, no payload field, no field-presence rule,
no query parameter, no persistence shape, no route, no score input and no change to streaming
behaviour. The `apps/api` diff for this feature is **empty**, enforced as a build step
(`git diff --name-only <merge-base>..HEAD -- apps/api` returns zero lines) under
`[additive-keeps-score-byte-identical]`. Nothing here reaches `opportunity_score`,
`opportunity_tier`, the entry gate or `state_fingerprint`.

Every wire fact the phase depends on already ships and is consumed exactly as it is today.

## Endpoints consumed (unchanged)

| Method | Path | Purpose in this phase | Auth | Error semantics |
|---|---|---|---|---|
| `GET` | `/api/ticker/{ticker}` | The bundle behind the 16 converted `FigureCell` sites — the dealer-positioning cells and the static half of the live tape. Consumed via the shipped `getTicker()` client. | Anonymous-open | `404` only when the ticker has no chain at all. Added/optional computations are `null`/omitted, never an HTTP error (`[best-effort-isolated-or-null]`). |
| `GET` | `/api/scan` | The **one-shot read on palette open** that supplies the ⌘K palette's per-symbol tier, score, status and freshness. Consumed via the shipped `getScan()` client; the palette adds no poll and `useScan` stays the `/scanner` page's only fetcher. | Anonymous-open | Server-side best-effort **always 200** — a store outage degrades content, never status. A non-2xx is therefore a transport/proxy fault; the client rejects and the palette shows its unavailable state. |
| `GET` | `/api/stream` (SSE) | The page-scoped live tape that drives the connection chip and the three live-dot-bearing cells. Consumed unchanged via `EventSource`. | Anonymous-open | Payload-gap watchdog at 15s → `offline`. **Not machine-checkable by `interface_conformance.mjs`** — the runner does not read event streams. Its contract is unchanged from the shipped SSE surface and is verified by the frontend flow-integration tests instead. |

**Field notes that are load-bearing for the SPEC and are pinned below.**

- `market_state.vwap` is a **bundle** field. This is why VWAP may never wear a live dot
  (SPEC §2.3, AC-1c): its value never arrives from the stream.
- `market_state.gamma_flip` is a bundle field the live tape falls back to when the stream is not
  delivering. The live dot on the Gamma flip cell is therefore keyed on the *stream* value, never on
  the rendered value.
- `market_state.max_pain` is nullable. A null renders the bare `—` literal with **no unit**;
  `$—` is a defect, not a state (AC-19b).
- `rows[].status` is the **authoritative closed vocabulary** (`ok | stale | error | building`). The
  palette renders it through a closed lookup and never re-derives a label from the score
  (`[digested-labels-not-raw-dump]`).
- `rows[].tier` and `rows[].score` are independently nullable — a partial or failed compute yields an
  honest row, never a fabricated `0`.
- `sweep.sweep_last_completed` plus `rows[].as_of` are the freshness facts the palette renders beside a
  score, so a ranked figure is never shown without its as-of (AC-29b). `sweep` is `null` only when the
  worker has never written one; the palette treats that as the unavailable arm, not as "fresh".
  **Both are pinned below, and they are not pinned equally — read the pin, not the intent.**
  `rows[].as_of` is pinned outright (`"number"`), so a rename or a removal is a FAIL.
  `sweep.sweep_last_completed` carries the optional marker (`"number|null?"`) and **cannot honestly be
  pinned harder**: `sweep` is a legitimate `null` on the wire
  (`apps/api/src/routes/scan.rs:84` — `pub sweep: Option<SweepHeartbeatDto>`, `required` in the schema
  but nullable), and the runner has no "required-only-when-the-parent-is-present" form. An unmarked pin
  would FAIL every run against a backend whose scanner has not yet written a heartbeat — a false FAIL
  that sends GATE Q to the backend lane to hunt a bug that does not exist. So this pin **type-checks the
  field on any run where a heartbeat exists** and, by construction, **cannot distinguish a rename from a
  cold store**. What closes that residual rename risk is named under the block, not left implicit.

## Conformance spec

Machine-checkable. `interface_conformance.mjs` runs this against the live backend at G1. It pins the
existing wire this frontend-only phase binds to, so a silent field rename or a nullability change is
caught before GATE Q rather than as a blank cell on the desk.

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/ticker/{ticker}",
      "path_params": { "ticker": "SPY" },
      "query": {},
      "required": {
        "market_state": "object",
        "market_state.price": "number|null?",
        "market_state.call_wall": "number|null?",
        "market_state.put_wall": "number|null?",
        "market_state.gamma_flip": "number|null?",
        "market_state.max_pain": "number|null?",
        "market_state.net_gex": "number|null?",
        "market_state.net_dex": "number|null?",
        "market_state.vwap": "number|null?",
        "market_state.market_phase": "string|null?",
        "signals": "object",
        "signals.opportunity_score": "number|null?",
        "signals.opportunity_tier": "string|null?"
      }
    },
    {
      "method": "GET",
      "path": "/api/scan",
      "query": {},
      "required": {
        "rows": "array",
        "rows[].symbol": "string",
        "rows[].status": "string",
        "rows[].tier": "string|null",
        "rows[].score": "number|null",
        "rows[].as_of": "number",
        "sweep": "object|null",
        "sweep.sweep_last_completed": "number|null?",
        "view": "object"
      }
    }
  ]
}
```

**Why a block at all under `NO_BACKEND_CHANGE`.** The marker alone would exempt this file, but the
phase's honesty rules depend on wire facts — VWAP being a bundle read, `tier`/`score` being nullable,
`status` being a closed vocabulary, `sweep`/`as_of` existing at all. **What the block buys, stated
exactly, so no reader trusts it for more than it checks:** AC-1c (VWAP is a bundle field and may
therefore never wear a live dot) and AC-29 (`status`, `tier`, `score` present and correctly nullable)
become checked outright; AC-29b's freshness pair is checked **asymmetrically** — `rows[].as_of`
outright, `sweep.sweep_last_completed` only on a run where a heartbeat exists, per the field note above.

**The rename that pin cannot see is closed elsewhere, not left open.** First, `apps/api` is byte-frozen
for this phase (AC-51, empty diff proved by a build step), so no rename can originate here. Second, the
palette reads the field through the generated wire type — `SweepHeartbeat`
(`libs/api/src/lib/convexa.ts:1165`) is `components['schemas']['SweepHeartbeatDto']` from
`libs/api/src/generated/schema.ts`, where `sweep_last_completed: number | null` is a required key — so a
rename landing from a later backend phase is a **compile error**, caught by `npm run typecheck`, which
AC-56 already requires with its exit code recorded separately from `nx test`.

No field above is new; nothing here authorises a backend edit. If the runner cannot reach a live
backend, this is a `NO_BACKEND_CHANGE` feature and the exemption stands — record it as such rather than
inventing a sample pass.
