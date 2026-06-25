# ticker-load-experience — BACKEND EXECUTION CONTRACT (→ apps/api)

> Server work ONLY. References `INTERFACE_CONTRACT.md` for what the backend EMITS; carries NO UI /
> `.tsx` / React detail. Restated binding invariants this lane touches:
> `additive-keeps-score-byte-identical`, `best-effort-isolated-or-null`, `live-vs-static-isolation`,
> `live-spot=NBBO-mid` carve-out, `operator-vs-trader-path-separation`.

---

## 0. Lane summary

This lane has REAL backend work (it is NOT `NO_BACKEND_CHANGE`). It emits the one new SSE field, and it
implements the server-side speed/hardening moves whose whole point is to leave the produced bundle
byte-identical. All work is additive: the score/tier/gate/fingerprint path is untouched.

---

## 1. Emit the SSE `last_trade` field (the wire delta — see INTERFACE §2)

- Add `last_trade` to the SSE broadcast `base` payload in `apps/api/src/core/live.py` (the `base` dict
  built in `_broadcast_loop`, alongside `mid`/`spread`/`net_flow`/`live`/`tick_age_s`/`market_session`).
- Value = `LiveSession.last_trade_price` (already tracked at live.py:69, set at :127/:160 by the trade
  tape) — `round(value, 2)` when present, else `null`.
- **Presence:** always emit the key on every payload (value nullable). **Null** between prints /
  overnight / pre-first-print (`last_trade_price is None`) — never an error
  (`[best-effort-isolated-or-null]`).
- It rides the existing payload-level honesty flags (`live`/`tick_age_s`/`market_session`); add no
  separate per-field age.
- **HARD BOUNDARY (`live-spot=NBBO-mid`):** `last_trade_price` MUST NOT feed `self.mid`, the live-flip
  reprice (`_levels_for_filter` keeps `self.mid`), net-flow sign logic, or any level/score input. It is
  emitted as a readout only. (The tape already uses `last_trade_price` internally for tick-rule sign;
  that internal use is unchanged — this lane only ADDS it to the outbound payload.)
- `[additive-keeps-score-byte-identical]` — SSE is off the bundle/scoring/fingerprint path; this
  changes no computed bundle value.

## 2. Chain pre-warm (ARCHITECTURE §4 — input-source swap, byte-identical output)

- Make `LiveSession._refresh_chain` a PRODUCER of a process-local, ticker-keyed SHARED CHAIN STORE: at
  the existing `fetch_options_market_state` call site, stash the FULL UNFILTERED `market_data` dict
  (before the greeks-filter that builds `self.contracts`) with a capture timestamp. The live path's
  own behavior is otherwise unchanged.
- On the REST miss path (`compute_ticker` chain-fetch site in `apps/api/main.py`), short-circuit the
  chain INPUT to the shared snapshot IFF a fresh entry exists; else fetch fresh as today.
- **Freshness gate (binding):** consume the shared snapshot only if its capture age ≤ the pre-warm
  budget, where budget ≤ `CHAIN_REFRESH_SECONDS` AND ≤ `STALE_AFTER_SECONDS` (INTERFACE §4). Otherwise
  fetch fresh — never serve a chain the freshness contract would flag stale.
- **Isolation (`best-effort-isolated-or-null`):** any failure to obtain/validate the shared snapshot
  (missing / stale / malformed / store error / no active session) falls back to the normal vendor
  fetch with NO error surfaced. Pre-warm is a pure acceleration; never a dependency, never a
  correctness factor (AC-Isolation-1, AC-PreWarm-1).
- **Byte-identity (binding):** the shared artifact is the chain INPUT, not the bundle output.
  `compute_ticker` stays the sole transform; same `market_data` in → byte-identical bundle out
  (AC-PreWarm-3, AC-Invariant-1). The shared `market_data` is READ-ONLY to every consumer (do not
  mutate in place). It does NOT pre-populate `_cache`.

## 3. Vendor-fetch concurrency (ARCHITECTURE §5.1 — acquisition only)

- Run the three INDEPENDENT vendor fetches (chain, daily bars, intraday bars) concurrently instead of
  sequentially (gather of `to_thread` calls). The dark-pool 4th fetch keeps its existing isolation.
- **Per-stage best-effort isolation MUST survive concurrency:** one fetch's failure/exception must not
  cancel or corrupt the other two and must not raise out of `vendor_fetch` beyond the existing no-chain
  404. Each fetch keeps its existing None/empty fallback (chain fail → existing 404 path; daily fail →
  HV null/0; intraday fail → VWAP null) (`[best-effort-isolated-or-null]`, AC-Isolation-2).
- **Byte-identity:** identical fetched data → identical `market_data` → identical bundle. Concurrency
  changes only the wall-time of acquisition (AC-Concurrency-1, AC-Invariant-1).

## 4. Request-coalescing on `_serve` (ARCHITECTURE §3 — cold-start hardening)

- Add in-flight de-duplication on `_serve` keyed by the SAME cache key
  `(ticker, min_dte, max_dte, expirations, dark_pool)`: concurrent misses on one key await a single
  shared `compute_ticker` future instead of each running the full vendor load.
- Same inputs → same output, fewer redundant computes. It changes nothing about the produced bundle
  (AC-Coalesce-1, AC-Invariant-1). The chain stays FULL-chain — NO narrowing (ARCH §5.3): any scoping
  that drops contracts the vendor returns is FORBIDDEN (would alter max-pain/PCR/Vol-OI/term).

## 5. Verification (no pytest suite — app-run + conformance + live-payload check)

- Run `.claude/tools/interface_conformance.py` against the standalone spec
  `.claude/tools/conformance/ticker-load-experience.json` (boot the backend, fetch SPY once first):
  asserts the bundle byte-identity floor + the `/api/_metrics` readout still parses (INTERFACE §6).
- **SSE `last_trade` check (off the HTTP harness):** boot the backend, subscribe to
  `/api/stream/SPY`, and verify every payload carries the `last_trade` key with a `number|null` value,
  null when no recent print, and that it pauses (the stream simply stops) with the other live fields on
  a transport drop. (SSE is not HTTP-probable by the conformance tool — INTERFACE §6.)
- **Byte-identity check (AC-Invariant-1):** confirm `opportunity_score` / `opportunity_tier` / the
  entry gate / `ai_eval.state_fingerprint` for an identical request are byte-identical with the
  pre-warm path taken vs the cold-fetch path taken (e.g. same SPY request served warm-via-session vs
  cold). They MUST match exactly.

## 6. Observability honesty (INTERFACE §5 — operator-surface only)

- Keep the per-stage timing HONEST: a pre-warmed chain acquisition reflects its real near-zero
  shared-hit cost in `vendor_fetch` / `fetch_options_market_state` timing — never a fabricated vendor
  latency. Optionally (additive) distinguish a shared-hit from a vendor fetch in the existing
  trace/`meta.timings` so the operator readout stays truthful about where time went. This stays on the
  operator surface (`[operator-vs-trader-path-separation]`); it touches no trader-facing field and no
  FE-consumed shape.

## 7. Out of bounds for this lane (restate)

- NO change to `signals`/`engine` scoring, the gate, or `state_fingerprint` (module boundary is the
  enforcement). If a speed/last-trade outcome would require touching any of those → GATE Z bounce, do
  not narrow scope silently.
- NO chain narrowing (full-chain math, ARCH §5.3). NO fetch-splitting of the cold bundle (forbidden;
  ARCH §3). NO required chain-pagination parallelization, NO required engine vectorization (bounded
  optional levers — out of this lane's required scope). NO new error surface (`[best-effort-isolated-
  or-null]` everywhere; only the existing no-chain 404 / first-load-failed path).
- NO UI work — that is the FRONTEND lane.
