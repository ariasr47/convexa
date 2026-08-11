# INTERFACE CONTRACT — positions-legs (FE↔BE truth)

**Spec:** `.spire/clusters/tech/contracts/positions-legs/SPEC.md`
**Posture:** **`NO_BACKEND_CHANGE`**

> Written at GATE C by the council's R4 synthesis, alongside `SPEC.md`. Both build lanes bind to this
> file; `interface_conformance.py --contract INTERFACE_CONTRACT.md` reads it unchanged. A change to it
> after approval is a GATE Z amendment.

---

## Posture: `NO_BACKEND_CHANGE` — the `apps/api` diff must be EMPTY

This feature is **frontend + durable-schema only**. It introduces **no new endpoint, no new payload
field, no changed field name, no changed presence semantics, and no new query parameter.** Positions
are **client-local** (`localStorage`, versioned, exportable) and are **never a scoring input**, so
`additive-keeps-score-byte-identical` holds by construction: score, tier, the entry gate and
`state_fingerprint` are untouched, and the backend cannot observe that the position model changed.

Concretely, the reviewable claim at GATE Q is: **`git diff` over `apps/api/` is empty.** If any lane
finds it needs a backend field, that is a GATE Z amendment against this file — not a quiet addition.

What *does* change on the client side is the **shape of the consumption**, not the contract:

- The tracked-contract lookup is now fanned out **per leg** instead of per position, and
  **de-duplicated by distinct `(ticker, expiration, strike, right)` across the whole portfolio** — a
  condor plus a covered call on the same underlying must not issue duplicate lookups. Per-contract
  isolation is preserved: one contract's 404 marks only the legs referencing it and every other row
  keeps rendering.
- Equity legs **never issue a contract lookup at all** — an equity leg's mark is the live underlying
  mid (the bundle `price` when not live), multiplier 1. That branch lives in the FE resolver, never
  inside the per-contract mark ladder.
- The position-context params keep their **current shape**, derived from a single selected primary leg
  (`SPEC.md` §2.8). The request is issued **unconditionally and its shape never branches**, so it stays
  byte-identical; the suppression of multi-leg evaluation is a **render** decision, FE-side only.

## Endpoints this feature consumes (all existing, all unchanged)

### 1. `GET /api/contract/{ticker}` — the tracked-contract lookup **(the checked seam)**

- **Purpose:** filter-independent stats for **one** option contract, resolved from the full chain
  snapshot with **no new vendor fetch** — a held contract resolves even when it sits outside the
  current DTE window. Client: `fetchTrackedContract` in `libs/api/src/lib/convexa.ts`; server:
  `get_tracked_contract` in `apps/api/main.py`.
- **Consumed for:** the running per-leg mark that feeds the composed position mark and P/L, entry-fill
  resolution (market / limit / manual contract stats), and the resting-limit cross.
- **Path param:** `ticker` (underlying symbol, upper-cased by the client).
- **Query params (all three required):** `expiration` (`YYYY-MM-DD`), `strike` (bare number),
  `right` (`call` | `put`; the server also accepts `c`/`p`).
- **Auth:** none.
- **Error semantics, binding and unchanged:**
  - **404** ⇒ the contract is **not in the snapshot** ⇒ the client returns `null` ⇒ the FE renders that
    **leg** as unresolved. Under the all-or-nothing rule that withholds the whole position's `mark`,
    `pl` and `pl_pct` (`unavailable`) and excludes the row from the group subtotal **while counting
    it** — never a partial sum. Every other row keeps rendering.
  - **200 with `option_quote: null`** ⇒ present but no usable NBBO (needs both sides) ⇒ the FE falls
    back to a **theoretical** (Black-Scholes) mark. **This is a valid result, not an error**, and it
    lowers the composed position's basis to the weakest leg's basis.
  - **422** ⇒ `right` was neither call nor put. Client-side never reachable (the value is a typed enum).
  - Any other non-2xx ⇒ the client throws ⇒ the same per-leg unresolved treatment.
- **Streaming/SSE semantics:** none — plain JSON.

### 2. `GET /api/stream/{ticker}` (SSE) — the live payload

- **Purpose:** the live underlying mid, the live/closed session classification, and the transport-drop
  watchdog. Client: `streamTicker` → `LiveUpdate`.
- **Consumed for:** equity-leg marks, the modeled-mark branch of the per-contract ladder, and the
  `streamOffline` degrade that this feature must leave **behaviourally unchanged**
  (`live-vs-static-isolation`).
- **Streaming semantics, unchanged:** a **transport drop** is no payload for more than
  `STREAM_OFFLINE_MS` (15s) after the first payload ⇒ the FE flips `streamOffline`; live-derived cells
  degrade (dim + `⏸`, never blanked), every leg resolves to `last_known` so a dimmed number still
  exists, and resting limits stop evaluating. The next payload clears it.
- **Not in the conformance block below**, deliberately: it is an event stream, not a JSON document, so
  `interface_conformance.py` (a single `urlopen` + `json.loads`) cannot validate it. It is verified by
  the FE integration tier, which mocks the network boundary only.

### 3. The ticker bundle's position-context read — unchanged, and not re-verified here

The bundle's `position_eval` (produced only when the `pos_*` params are supplied) keeps its current
shape. This feature adds **no** position params, changes **no** param name, and feeds **nothing** to
scoring. `position_eval` is a dedupe/changed convenience, never a scoring input. It is excluded from
the block below because supplying a meaningful `pos_*` context requires a live position fixture, which
would make the gate environment-dependent for no added coverage — the FE-side change (suppress the
multi-leg evaluation, keep single-leg byte-identical) is verified by `SPEC.md` AC-73/74/75, and the
byte-identity of the request shape by AC-77.

## Persistence (FE-local — NOT a backend surface)

Positions, legs, the unified decision log, customization and saved views persist in the **client-local
durable store** under `convexa.positions.v3`, migrated once as a **union** of `convexa.positions.v2` /
`gammaflow.positions.v2` and `convexa.ghost-trade.v1` / `gammaflow.ghost-trade.v1`. This is **not** a
server contract: no server-side persistence, no account scoping, no cross-device sync is introduced.
The durable shape, the migration rules and the faulted-store behaviour live in `SPEC.md` §2 and are
**out of scope for this file** — the interface is the wire, and the wire is unchanged.

## Binding constraints

`additive-keeps-score-byte-identical` (empty `apps/api` diff) · `no-real-order-path` (no code path
places a real order; nothing here reaches a broker) · `best-effort-isolated-or-null` (a 404 or throw
degrades one leg, never the page) · `live-vs-static-isolation` (the SSE-drop degrade survives the
refactor unchanged) · `loss-free-durable-migration` (client-side; see `SPEC.md` §2.6/§8).

## Conformance spec

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/contract/{ticker}",
      "path_params": { "ticker": "TSLA" },
      "query": { "expiration": "2026-08-21", "strike": 400, "right": "call" },
      "required": {
        "ticker": "string",
        "expiration": "string",
        "strike": "number",
        "right": "string",
        "option_quote": "object|null",
        "option_quote.bid": "number?",
        "option_quote.ask": "number?",
        "option_quote.mid": "number?",
        "greeks": "object",
        "greeks.delta": "number|null",
        "greeks.gamma": "number|null",
        "greeks.theta": "number|null",
        "greeks.vega": "number|null",
        "iv": "number|null",
        "dte": "number"
      }
    }
  ]
}
```

**How to run it, and how to read a failure.** The block asserts the *existing, unchanged* shape the
positions surface consumes, so GATE Q can prove the consumed shape still holds even though the feature
adds nothing to the wire:

```
<project.json backend.python> .claude/tools/interface_conformance.py \
  --contract .spire/clusters/tech/contracts/positions-legs/INTERFACE_CONTRACT.md \
  --url http://127.0.0.1:<project.json backend.port>
```

- `path_params` + `query` are a **fixture, not part of the contract.** `/api/contract` resolves one
  specific live contract, so `expiration` and `strike` go stale as expirations roll. **A 404 here means
  the fixture is stale, not that the interface broke** — substitute a `(ticker, expiration, strike,
  right)` triple that exists in the current snapshot and re-run. Do not "fix" a stale fixture by
  loosening a required field.
- Deterministic alternative when no live snapshot is available: capture one response and validate it
  offline —
  `interface_conformance.py --contract <this file> --sample resp.json --endpoint /api/contract/{ticker}`.
- `option_quote` is asserted as `object|null` (a null quote is a **valid** result), so its three leaves
  are marked optional — absent ⇒ pass, present ⇒ must be numbers. That is deliberate: making them
  required would turn the documented theoretical-mark fallback into a gate failure.
- Every `greeks` leaf is `number|null` because a per-greek null is normal for an unpriced contract, and
  `iv` is nulled server-side when it is `0.0`.
