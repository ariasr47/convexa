# capacity-baseline — interface contract

**Spec:** `.spire/clusters/tech/contracts/capacity-baseline/SPEC.md` (§6 points here)
**Backend:** `apps/api` (crate `api-rust`) — operator CLI + hermetic constructor; production HTTP graph unchanged
**Frontend:** none — `NO_UI_CHANGE` (SPEC §4); trader routes must not consume capacity receipts
**Status:** draft

`NO_BACKEND_CHANGE` **of the production HTTP / FE↔BE contract only.**

This banner does **not** mean zero `api-rust` edits. This slice **does** change in-repo backend **test seams**: clap nested `capacity {load|soak}`, uncached Nx/npm targets, `AppState::for_capacity_harness`, additive `vendor_fixture` on `AppState` (Some only on the harness constructor), a Path-B fixture arm that skips Massive when Some, a dedicated nested probe `LiveCapacity::new` / probe AppState for overflow (not a ceiling setter on the hold instance), a **second loopback bind** of `routes::router(probe state)` on `127.0.0.1:0` so overflow 503 is observed as HTTP, and a **harness-only hub** whose `subscribe` updates the symbol set and does not enqueue vendor `HubCmd`. Production `server::serve` construct, production `StockStreamHub::subscribe` / `admit_and_subscribe`, and the 52-operation router graph stay the HTTP contract they are today.

## What this feature adds to the FE↔BE HTTP interface: nothing

This feature adds **no** endpoint, **no** route, **no** handler, **no** query parameter, **no** header contract, and **no** field on any existing wire payload. OpenAPI and generated `@convexa/api` client bytes stay identical. A dashboard or `/_ops` surface for harness p95 would breach `[operator-vs-trader-path-separation]`; SPEC §4 carries `NO_UI_CHANGE`.

The harness is an **HTTP test client** of **existing** trader-path routes on throwaway `127.0.0.1:0` listeners (production router, non-production constructor: hold state on the first bind, dedicated probe state on the second). It must **not** call those routes on the production host. It must **not** drive streams only via an in-process shortcut that skips HTTP. Live interface-conformance against ticker/SSE would be a production/Massive measurement this feature forbids.

Existing production envelopes remain authoritative where the throwaway process reuses them — consumed, not restated, not amended:

- `GET /api/ticker/{ticker}` — ticker-bundle HTTP (anonymous)
- `GET /api/stream/{ticker}` — per-ticker SSE (`text/event-stream`; 503 + `Retry-After: 30` on LiveCapacity refuse; trader detail unchanged)
- `GET /api/stream/prices` — prices SSE (same refuse class)

Do not mark `"auth": true` on those routes here: they stay anonymous-open. Do not add a capacity URL. Do not reshape 503/429 bodies.

Standing public-surface contracts (references only; this file does not restate their fields):

- `.spire/clusters/tech/state/conformance/public-surface.json`

### Explicit non-endpoints

| Not added | Why |
| --- | --- |
| Any `/api/_ops/capacity*`, `/api/_research/capacity*`, or `/api/capacity*` | CLI-only; operator/trader separation |
| Any new ticker/SSE query or payload field | Production endpoints unchanged |
| Harness p95 on `GET /api/_metrics` | Different datum; would collapse labels |
| A session-gated capacity route | No new auth surface |

## Operator interface (CLI + receipt — not HTTP)

Invocation (SPEC §2): `cargo run -p api-rust -- capacity load` | `capacity soak`; npm `capacity:load` / `capacity:soak`. Receipt file under `data/capacity/`. Stdout is human; standing is the first block. Default: standing first on stdout + receipt file; stderr is progress (`[RUNNING]`) only. `--json`: stdout = receipt JSON including `standing`; standing prose + progress on stderr. There is **no** clap flag that relabels `Evidence` (`ci` is `GITHUB_ACTIONS` or a capacity-step-only env per SPEC §2; ambient `CI=true` is `local`). This is **not** an HTTP body and is **not** executed by `interface_conformance.mjs`.

Auth: none (no session cookie, no metrics token). Error semantics: process exit 0 only on pass; non-zero for `[FAIL]` / `[BLOCKED]` / `[INCOMPLETE]` / `[ERROR]`. Streaming: the harness **HTTP-clients** existing SSE on the throwaway binds; it does not add a stream contract. Load hold is 8 per-ticker SSE + 1 prices SSE at subscriber ceiling **9**. Overflow HTTP 503 is observed on the **probe** listener only.

## Conformance spec

```json
{
  "endpoints": []
}
```

The empty endpoint set is intentional and machine-checkable: **no production HTTP contract is introduced or amended**. It is not a claim that `api-rust` is untouched. Runtime load/soak evidence is the named CLI, exit code, and capacity receipt under `SPEC.md`; those runs must not be used as live API conformance against Massive.

## What a FAIL here means

- **A new capacity HTTP route appearing in live inventory** — scope breach; this contract pins an empty set.
- **OpenAPI / generated client delta** — someone added or reshaped an operation while building the CLI (SPEC AC-47).
- **Ticker/SSE 503/429 copy or status class changed** — production refuse surfaces were edited; this feature may **exercise** them on throwaway listeners and must not **relabel** them.
