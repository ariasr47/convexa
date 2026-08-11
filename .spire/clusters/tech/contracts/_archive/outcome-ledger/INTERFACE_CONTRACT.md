# outcome-ledger — INTERFACE_CONTRACT

> The FE↔BE integration truth for this feature. Both lanes bind to this file.
> Self-contained against `.spire/clusters/tech/context/PROJECT_CONTEXT.md` — assume no chat history.

---

## Verdict: **`NO_BACKEND_CHANGE` — there is NO FE↔BE surface in this feature.**

This is not a template gap. It is the feature's **defining structural property**.

- **No new endpoint.** No changed endpoint. No new query param, no new request field, no new response
  field, **nothing on SSE**.
- **This feature consumes no endpoint at all.** Not `GET /api/ticker`, not `GET /api/contract`, not
  `streamTicker`, not `POST /api/positions/sim-trade/gate`, not `GET /api/_metrics`. The Positions page
  already polls a bundle + opens one SSE **for the position book's marks** — the track-record readout
  consumes **none of it** and takes no prop from it (`[live-vs-static-isolation]`; see
  `FRONTEND_EXECUTION_CONTRACT` §3).
- **`apps/api` diff MUST be empty.** This is a GATE Q check.
- **No `## Conformance spec` block is emitted, by decision.** `interface_conformance.py` (system-1)
  verifies a **live backend** against an interface's promised field paths. There is **no backend surface
  here to verify**. An invented spec block would assert something false. *(contract_lint.py WARNs on a
  locked interface with no Conformance spec — that WARN is **expected and correct** for this feature;
  do not silence it by fabricating endpoints or payloads. The system-12 embed-vs-standalone convention
  question therefore does not bite this feature; it still lands on `scanner`.)*

### Why the empty diff is load-bearing, not incidental

The `NO_BACKEND_CHANGE` verdict **IS** the structural no-auto-tuning guarantee for
`[additive-keeps-score-byte-identical]` (HARD) + `[score-change-is-deliberate-and-measured]`:

> **A statistic that never leaves the browser cannot reach `signals.py`.**

The readout is a pure client-local derived read over durable stores that already exist. It introduces
**zero new durable keys**, **zero new stores**, and **zero wire fields**. It is the **enabler** of a
future deliberate human score change — **never its exerciser**. (`ARCHITECTURE_CONTRACT` §5.1, boundary 1
of 4.)

---

## What the feature DOES bind to (in place of an endpoint)

The FE binds to the **client-local durable store shapes** and the **derived read** the
`ARCHITECTURE_CONTRACT` defines. **That contract is the schema of record for this feature.** Both of the
sections below are pointers, not restatements — read the named sections.

### Durable sources (read-only; all pre-existing keys — **no new key is created**)

| Key | Holds | Read by this feature for |
|---|---|---|
| `convexa.ghost-trade.v1` | the Ticker page's `DecisionRecord[]` log **+** its `trades` map (`GhostTrade`) | decision index **and** position index |
| `convexa.positions.v2` | the Positions page's `DecisionRecord[]` log **+** the `Position` map | decision index **and** position index |
| `convexa.orders.v1` | the `SimOrder` map | order index (never-filled counts, `provenance`) |

⚠ **The decision log and the position map are each SPLIT across TWO of those keys** (a verified,
pre-existing defect — logged to BACKLOG §B as `split-decision-log`; **this feature does not fix it**,
`ARCHITECTURE_CONTRACT` §8 non-goal 3). Both indices are the **de-duped UNION of both sources**.
**The counted numerator and the coverage denominator M MUST come from the SAME unioned, de-duped index**
or the coverage statement can report a numerator that exceeds its denominator — i.e. it lies, in the
direction of flattering the feature. (`ARCHITECTURE_CONTRACT` §2/Q3.1 consequence 6 · §3.3 · §3.4.3.)

### The only durable WRITE this feature adds (additive, optional, no version bump)

`ARCHITECTURE_CONTRACT` **§3.1 + §2/Q2** are binding and complete:
- an **optional nested digest object** on `DecisionRecord`, attached at the 5 decision-point events
  (`open` · `accept` · `reject` · `order_placed` · `order_filled`), each field independently nullable;
- an **optional per-record id** on newly-written records.
- **No key change. No shape break. No `SCHEMA_VERSION` bump. No backfill, ever.**
- **Digest ABSENT = pre-capture epoch. Digest PRESENT with a null field = captured, source unavailable
  that cycle.** This distinction is load-bearing twice over (the epoch marker **and** the per-family
  coverage counts) — see `ARCHITECTURE_CONTRACT` §3.4.4 / §3.4.6.

### The derived read the UI consumes (fields only — the shape is the architect's)

Named here **only so the UI's data needs are unambiguous**; the authoritative definition is
`ARCHITECTURE_CONTRACT` §3.4, which the FE lane must read in full. The read's root has **three
non-optional siblings** — a consumer cannot obtain the cohorts without the coverage and the basis:

1. **cohorts** (§3.4.1) — per cell family, a discriminated union per cell:
   - `building`: `n`, `n_min` — **has no rate field**
   - `computed`: `hit_rate`, its **Wilson 95% interval**, `n`, `mean_pl_pct`, `stdev_pl_pct`,
     `window {first, last}`, `basis_class` — **all non-optional siblings**
2. **the readout-level coverage roll-up** (§3.4.3) — **integers only**: `counted`, `recorded_closed` (M),
   `excluded_by_reason` {`no_decision_record`, `unresolved_join`, `scenario_sourced`, `unpriced_basis`,
   `modeled_basis`, `malformed`}, `adjacent` {`open_not_counted`, `never_filled`, `unreadable_records`}
   — plus, per cell family, `counted_total` / `pre_capture` / `unavailable_at_capture` / `attributed`
   (+ `not_attributable_by_path` on the AI-rec family only) (§3.4.4)
3. **the read's basis** (§3.4.6) — sources spanned, the de-dupe identity, `sources_complete`, and the
   **capture epoch, DERIVED FROM THE DATA** (`null` when no record carries a digest). ⚠ **Never a
   hardcoded ship date** — an archive import can carry records from a browser whose capture began earlier.

**Two binding, testable identities** (CI assertions — **never a runtime throw**,
`[best-effort-isolated-or-null]`):
```
recorded_closed (M) == counted + Σ excluded_by_reason        # nothing in `adjacent` participates
counted_total       == attributed + unavailable_at_capture + pre_capture      # per family
                    (+ not_attributable_by_path, AI-rec family only)
```
Reason attribution is **FIRST MATCH, then STOP**, in this precedence order (`ARCHITECTURE_CONTRACT`
§3.4.3): `malformed` → `no_decision_record` → `unresolved_join` → `scenario_sourced` → `unpriced_basis`
→ `modeled_basis`.

### The archive envelope (a FILE — not a store, not a wire format)

`ARCHITECTURE_CONTRACT` §3.5 is binding: ONE versioned envelope spanning **all three** stores, with a
schema/version stamp + export timestamp. **The export format IS the import format** (round-trippable by
construction). Its field names are the FE lane's detail — **it never touches the network and never
touches `localStorage` directly** (writes go only through the existing store append/put APIs).

---

## Error / SSE semantics

- **SSE:** untouched. The readout **subscribes to nothing**, degrades on nothing, and renders
  **unchanged and un-dimmed** on a stream drop (`[live-vs-static-isolation]`, AC-E17).
- **Errors:** there is no network call, so there is no HTTP error semantic. A corrupt/unreadable store
  yields an **empty, unreadable, or partial** readout **with a stated reason** — never a throw, never a
  broken page, never a disturbed bundle/SSE path, and **never a write back to the store**
  (`[best-effort-isolated-or-null]` + `[loss-free-durable-migration]`).
- **Gating:** **none, by decision.** No server call ⇒ **no boundary at which a gate could be enforced**
  ⇒ an FE-only gate would be **decorative and is forbidden** (`[server-side-gate-enforcement]`;
  `PRODUCT_CONTRACT` §4.13, AC-25). The readout **and** the archive import are fully available
  anonymously.

---

## Lane binding

- **`BACKEND_EXECUTION_CONTRACT.md`** — binds to this interface: it emits **nothing**. `NO_BACKEND_CHANGE`
  stub; no backend lane spawns.
- **`FRONTEND_EXECUTION_CONTRACT.md`** — binds to this interface: it consumes **no endpoint**, and instead
  consumes the durable store shapes + the derived read named above.
