# ticker-load-experience — INTERFACE CONTRACT (FE↔BE single source of truth)

> The FE↔BE truth ONLY: the field name/type/presence/nullability both lanes bind to, the SSE
> semantics, the config surface, and the standalone conformance reference. NO UI detail, NO server
> internals. Both the BACKEND and FRONTEND execution contracts reference THIS file for what crosses the
> wire. Restated binding invariants this file touches: `additive-keeps-score-byte-identical`,
> `best-effort-isolated-or-null`, `live-vs-static-isolation`, `live-spot=NBBO-mid` carve-out.

---

## 1. The wire delta, in one line

**SSE `/api/stream/{ticker}` GAINS one live last-trade field. The REST `/api/ticker/{ticker}` bundle
is BYTE-IDENTICAL (unchanged).** Everything else in this feature (skeleton-first, pre-warm,
concurrency, coalescing, freshness config) changes WHEN/HOW the backend obtains inputs or WHEN the FE
paints — none of it changes a payload shape. The bundle interface is therefore NOT re-specified here;
it points at the existing `TickerBundle` shape (`libs/api/src/lib/gammaflow.ts`).

---

## 2. SSE `last_trade` field (the ONLY new field both lanes bind to)

Added to the SSE broadcast `base` payload (the per-tick object on `/api/stream/{ticker}`), alongside
the existing `mid`/`spread`/`net_flow`/`gamma_flip`/`live`/`tick_age_s`/`market_session`.

| Property | Value |
|---|---|
| **Field name (wire)** | `last_trade` |
| **TS type (`LiveUpdate`)** | `last_trade: number \| null` |
| **Semantics** | the last actual TRADE print price off the live trade tape (`LiveSession.last_trade_price`). NOT the NBBO mid. |
| **Presence** | ALWAYS present on every SSE payload (key always emitted; value nullable). |
| **Nullability** | `null` when there is no recent print — between trades, overnight, before the session's first print, or when the tape has produced nothing yet. Null is the honest state, NEVER an error. |
| **Units / rounding** | a price in dollars; rounded to 2 decimals (consistent with `mid`). |
| **Live/static class** | **LIVE-DERIVED.** Governed by the SAME existing honesty flags already on the payload (`live`, `tick_age_s`, `market_session`). On a transport drop the FE stops receiving payloads entirely (the gap-watchdog flips `streamOffline`); the FE then degrades `last_trade` WITH the other live fields. The field carries no separate freshness/age of its own — it inherits the payload-level `live`/`tick_age_s`. |

**Binding semantics both lanes agree to:**
- `[live-vs-static-isolation]` — `last_trade` is live-derived: it rides SSE only, degrades on an SSE
  drop like `mid`/`spread`/`net_flow`/`gamma_flip`, and is NOT a static bundle read.
- `[live-spot=NBBO-mid]` (locked carve-out) — `last_trade` is a DISPLAY-ONLY sibling of the mid. It
  MUST NOT feed the headline spot anchor, the levels (walls/flip/peak/max-pain), the live gamma-flip
  reprice, net-flow sign logic, or any score/gate input. The BE emits it; the FE renders it as a
  readout. The mid stays the anchor on both sides.
- `[best-effort-isolated-or-null]` — `last_trade` is independently nullable; its absence/null never
  fails the payload or the page.
- `[additive-keeps-score-byte-identical]` — `last_trade` rides the SSE path, which is off the
  bundle/scoring/fingerprint path. Adding it leaves `opportunity_score`/`opportunity_tier`/the entry
  gate/`state_fingerprint` byte-identical.

**No other SSE field changes.** No new query param, no new SSE event type, no new endpoint.

---

## 3. REST bundle — explicitly UNCHANGED (the point of the feature)

The pre-warm (§4 arch), the 3-fetch concurrency (§5.1 arch), and the request-coalescing (§3 arch)
change only the SOURCE/timing of `compute_ticker`'s inputs and how concurrent misses are served — NOT
what `compute_ticker` produces. **Same inputs → byte-identical bundle.** Therefore:
- `TickerBundle` / `MarketState` / `Signals` / `Meta` / `OffExchange` shapes are UNCHANGED.
- `opportunity_score`, `opportunity_tier`, the entry gate, and `state_fingerprint` are BYTE-IDENTICAL
  before vs after (`[additive-keeps-score-byte-identical]`, AC-Invariant-1).
- The conformance reference for the bundle is the EXISTING bundle shape (the `/api/ticker/{ticker}`
  endpoint); this feature adds no bundle conformance assertions because it adds no bundle fields.

---

## 4. Config surface (Conventions — env, not a payload)

| Env var | Role for this feature | Binding |
|---|---|---|
| `STALE_AFTER_SECONDS` | governs `meta.freshness.stale` + forces the AI gate off when stale. On the real-time tier it drops toward ~120s so the stale warning stops firing spuriously mid-session (AC-Stale-1/2). | The §4-arch pre-warm freshness budget MUST be ≤ this value (never serve a chain the freshness contract would flag stale). |
| `CHAIN_REFRESH_SECONDS` (120) | live chain re-fetch cadence; upper bound on the pre-warm budget. | pre-warm budget ≤ `CHAIN_REFRESH_SECONDS` AND ≤ `STALE_AFTER_SECONDS`. |
| `CACHE_TTL_SECONDS` (60) | bundle cache TTL / poll cadence; unchanged role. | unchanged. |

This is a threshold/env concern only: it shifts WHEN data is flagged stale, never a computed value
(`[additive-keeps-score-byte-identical]` holds — the `stale`/`ready` overlay is already a non-
fingerprint serve-time overlay).

---

## 5. Observability honesty (operator-surface only — no trader-facing AC)

A pre-warmed chain acquisition is a near-zero-cost shared-hit, not a vendor fetch. The operator
trace/metrics MUST stay truthful: the `vendor_fetch` / `fetch_options_market_state` timing for a
pre-warmed load reflects the real (near-zero) shared-hit cost, not a fabricated vendor latency. Whether
the trace adds a distinguishing marker (e.g. a "chain source: shared-hit vs vendor-fetch" attribute on
the existing `meta.timings`/trace) is a BACKEND decision (see BACKEND_EXECUTION_CONTRACT) — if added it
is additive and optional on `meta` (the trader FE already ignores `meta.trace_id`/`meta.timings`). This
touches no trader-facing AC and changes no FE-consumed shape.

---

## 6. Conformance spec

The runnable (system-1) conformance spec is the STANDALONE file
**`.claude/tools/conformance/ticker-load-experience.json`** — the flat
`{method, path, path_params, query, body, required}` schema that `interface_conformance.py` executes
(same precedent as `conformance/ai_recommendations.json` and `conformance/api_metrics.json`). Do NOT
embed a rich nested block here; this section REFERENCES that file.

What it asserts (and why it is REST, not SSE): `interface_conformance.py` runs HTTP request/response
checks; it cannot subscribe to an SSE stream. The only wire delta is on SSE, which the runnable tool
cannot probe directly. So the standalone spec asserts the REGRESSION floor that bounds this feature —
that the `/api/ticker/{ticker}` bundle stays well-formed and byte-stable on its score/fingerprint path
(AC-Invariant-1's wire face) — plus the existing `/api/_metrics` readout still parses (the operator-
honesty surface §5 rides it). The SSE `last_trade` field's presence/nullability is bound here in §2 and
verified by the FE component/flow tests (FRONTEND_EXECUTION_CONTRACT §6) and the BE live-payload check
(BACKEND_EXECUTION_CONTRACT §5), since SSE is outside the runnable HTTP harness.

```text
spec file: .claude/tools/conformance/ticker-load-experience.json
asserts:
  - GET /api/ticker/{ticker}  → bundle well-formed; market_state + signals.opportunity_score +
                                signals.opportunity_tier + ai_eval.state_fingerprint present & typed
                                (the byte-identity / additive-invariant floor, AC-Invariant-1).
  - GET /api/_metrics         → operator readout still parses (observability-honesty surface, §5).
SSE last_trade: bound in §2; verified off-harness by FE + BE live-payload tests (SSE not HTTP-probable).
```
