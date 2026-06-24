# UX BLUEPRINT — Backend Observability (operator metrics readout)

> Producer: UX/Tech-Writer (this session). Consumers: Backend & Frontend Executioners (via the
> Split Compressor → INTERFACE + BACKEND + FRONTEND contracts). No production code.
> Grounded against `.claude/GAMMAFLOW_CONTEXT.md` + ARCHITECTURE_CONTRACT.md + PRODUCT_CONTRACT.md
> and the existing `meta` envelope (`meta.cache`, `meta.freshness`) in `libs/api/src/lib/gammaflow.ts`.
> Translates the contracts into operator-facing readout design + copy only — no server internals, no
> math, no final payload schema (only the field NAMES the readout/meta expose; Interface finalizes).

## Audience & the binding "no trader change" rule
This feature is **operator/developer-facing**. The **trader dashboard is unchanged** — no latency,
percentile, headroom, or stage-timing number ever appears in the trader view. The **only** trader-path
touch is in response **metadata**: a `trace_id` (always present) and an **optional, default-off**
per-stage `timings` block. The trader FE must **ignore both** (render nothing new). Everything else
lives on a **separate operator readout surface**.

## "Live-stream loss vs bundle-fetch loss" — explicit disposition for THIS feature
The standard trader degraded-state copy (`⚠ Live offline — reconnecting…`, `Couldn't refresh —
showing data from {age} ago.`, cold-start error) is **UNCHANGED and out of scope here**: this feature
does **not** instrument SSE, does **not** alter any served bundle value, and adds **no** trader-facing
failure surface. The analogous "honest degraded states" for this feature belong to the **operator
readout** and are defined below (empty / unknown / disabled / reset / readout-unavailable). Per the
honest-data invariant, none ever shows a fabricated or zeroed number as real.

## The operator readout — what it is
A **read-only, side-effect-free** view of the ephemeral `MetricsAggregate` (reading it **never**
triggers a vendor fetch, never mutates the bundle cache, never touches the bundle path). Canonical
form = a **read-only JSON readout** (operator/dev consume via curl/tooling; this is also the future
OTel/Prometheus export seam). An **optional lightweight operator page** may render that JSON; it is
**not** part of the trader flow and is gated to operators. Field names below are what the readout
exposes (Interface finalizes shape/endpoint).

### Readout information design (rendered form — ASCII)
```
GammaFlow · Operator Metrics            [Instrumentation: ON]   ⟳ read-only
Rolling window: last ~500 req / ~15 min · uptime 2h 14m · resets on restart (ephemeral)

GLOBAL ROLL-UP                                          requests: 1,284
  Stage            kind   p50     p95     max     count   ok/err/skip
  vendor_fetch     I/O    180ms   520ms   1.2s    1,284   1280/4/0
  engine_build     CPU     22ms    48ms    90ms   1,284   1284/0/0
  off_exchange     CPU      6ms    14ms    40ms     900   900/0/384      ← skipped when dark_pool off
  signals          CPU      3ms     8ms    21ms   1,284   1284/0/0
  persist          I/O      9ms    31ms   140ms   1,284   1284/0/0
  serialize_wrap   CPU      4ms    11ms    28ms   1,284   1284/0/0
  ─────────────────────────────────────────────────────────────────
  TOTAL                   230ms   610ms   1.4s   1,284
  Cache:  hits 1,020 · misses 264 · hit ratio 79% · current data age 12s
  Vendor: calls 264 · latency p50 180ms / p95 520ms · min headroom 142 / 300

PER-TICKER  ▸ TSLA (842) · NVDA (300) · SPY (142)   [expand for the same table per ticker]

RECENT TRACES (newest first)
  trace_id            ticker  dims                 cache   total
  9f3a…c2  TSLA   7–45d · dark_pool   miss    612ms   ▸ inspect
  8b1d…77  TSLA   all · dark_pool     hit(↳9f3a…c2)  4ms  ▸ inspect
```

### Where each datum surfaces
- **Per-stage table** (global + per-ticker): `stage` (fixed vocabulary), an **I/O vs CPU tag**,
  `p50`, `p95`, `max`, `count`, and the **ok/error/skipped** mix. `off_exchange` shows `skipped` when
  `dark_pool` was off — never a fake 0.
- **Total latency** row: `p50/p95/max/count`.
- **Cache** line: `hits`, `misses`, `hit_ratio`, `current_data_age_seconds`.
- **Vendor** line: `call_count`, latency `p50/p95`, and **min rate-limit headroom** (`remaining/limit`)
  or **unknown**.
- **Per-ticker** breakdown rolls up to the **global** section (same table shape).
- **Recent traces**: one row per request — `trace_id`, `ticker`, filter `dims`, `cache_hit`,
  `total_ms`, and on a hit the `computed_trace_id` lineage pointer. "Inspect" expands a single
  `RequestTrace` (dims, cache hit/age, total, the stage timings, the vendor calls).
- **Window/uptime/reset caption** + the **Instrumentation ON/OFF** indicator.

## Component states (operator readout)
| State | Trigger | Appearance / copy |
|---|---|---|
| **Empty / cold** | instrumentation on, **no requests served yet** | All values `—`; banner: **"No requests recorded yet — serve a bundle to populate the baseline."** |
| **Populated** | ≥1 request in the window | Tables render as above. |
| **Unknown (vendor)** | vendor doesn't expose rate-limit headroom | Headroom shows **"unknown"** + caption **"this vendor doesn't report rate-limit headroom"** — never a number, never an error. |
| **Disabled** | instrumentation env flag **off** | Readout renders a single notice: **"Instrumentation disabled — no metrics are being recorded. Enable it via the observability flag to populate this readout."** No fake zeros. |
| **Reset (post-restart)** | process restarted | Back to Empty/cold with the caption stating the window **"resets on restart (ephemeral baseline)"**; uptime small. |
| **Readout unavailable** | the metrics endpoint/page itself errors | Operator-tool error only: **"Metrics readout unavailable."** — **the trader bundle and SSE are unaffected** (separate surface). |
| **Loading** | fetching the readout | Lightweight spinner / "Loading metrics…". (Reading is cheap + side-effect-free.) |
| **Cache hit vs miss (per trace)** | inspecting a trace | A **warm** trace is labeled **"cache hit · near-zero compute"** (only `serialize_wrap` timed); a **cold** trace **"cache miss · full compute"** — warm vs cold cost never conflated. |

- **Low headroom — honest, NON-alerting:** present the **min headroom** factually as
  `{remaining} of {limit} remaining (minimum observed this window)` with a neutral caption
  `bounds safe scanner fan-out`. **No threshold, no pass/fail, no alert** (alerting is future-dated) —
  a low number reads as a low number, not a warning state.

## Response-metadata states (the only trader-path touch)
| State | Trigger | Shape / copy (operator-read; trader FE renders nothing) |
|---|---|---|
| **trace_id (always)** | every served bundle | `meta.trace_id` present on every response. |
| **timings (verbose only)** | request sets the verbose/debug switch | `meta.timings` block (total + per-stage `{stage, kind, duration_ms, status}` + vendor calls) appears **only** then; default-off ⇒ absent, response otherwise unchanged. |
| **Instrumentation off** | env flag off | `meta.trace_id` may be absent/empty and `meta.timings` never appears; bundle serves identically. |

## Structured-log states (third leg)
- **Request summary at INFO** + **per-stage detail at DEBUG**, each line carrying the `trace_id`
  (+ ticker, stage, duration, status), machine-parseable.
- **Additive, not doubled:** the existing human-readable lines still appear and are **not** duplicated.
- An instrumentation/emit failure is **swallowed** — a missing line, never a broken or doubled log,
  never a request error.

## Microcopy & glossary (exact strings; Tech-Writer deliverable)
**Readout copy**
- Empty: `No requests recorded yet — serve a bundle to populate the baseline.`
- Unknown headroom: `unknown` · caption `this vendor doesn't report rate-limit headroom`.
- Disabled: `Instrumentation disabled — no metrics are being recorded. Enable it via the
  observability flag to populate this readout.`
- Window caption: `Rolling window: last {size} · uptime {uptime} · resets on restart (ephemeral baseline).`
- Min headroom: `{remaining} of {limit} remaining (minimum observed this window) · bounds safe scanner fan-out.`
- Cache line: `hits {h} · misses {m} · hit ratio {pct}% · current data age {age}.`
- Trace inspect — warm: `cache hit · near-zero compute` · cold: `cache miss · full compute`.
- Readout unavailable: `Metrics readout unavailable.` (+ note: trader bundle unaffected).

**Glossary / operator-doc entries (draft)**
- **Pipeline stages (fixed vocabulary):** `vendor_fetch` (vendor REST: chain + daily/intraday bars,
  + recent trades when dark_pool) · `engine_build` (GEX/greeks/walls/flip/DEX/Vol-OI/skew/term + HV +
  VWAP) · `off_exchange` (off-exchange/blocks pass; `skipped` when dark_pool off) · `signals`
  (setups/score + gate) · `persist` (writes ticker files to disk) · `serialize_wrap` (envelope +
  tiering + position_eval + serialization).
- **I/O vs CPU tag:** `I/O` = `vendor_fetch`/`persist` (bound by network/disk → parallelizable and/or
  cacheable at fan-out); `CPU` = `engine_build`/`off_exchange`/`signals`/`serialize_wrap` (bound by
  compute → needs worker/process parallelism). Load-bearing for the future scanner's fan-out plan.
- **p50 / p95:** median and 95th-percentile latency over the current rolling window (plus `count` and
  `max`); p95 catches the slow tail a mean would hide.
- **Cache hit/miss + data age:** `hit` = served warm from the ~60s cache (near-zero compute); `miss`
  = full recompute; `data age` = how old the served snapshot is. Warm vs cold cost is never conflated.
- **Rate-limit headroom:** the vendor's remaining calls vs its limit; the readout shows the **minimum
  observed** in the window (the tightest the run got). **Best-effort** — vendors that don't expose it
  show **unknown**, never a fabricated number. Bounds how much a future multi-ticker scanner can fan
  out before throttling.
- **Trace id (correlation):** one id per served bundle, appearing in that request's **structured
  logs**, its **verbose response `meta.timings`**, and the **readout's recent-traces** list — so a
  single request is traceable end-to-end. On a cache hit, a `computed_trace_id` points back to the
  miss-trace that produced the served bundle.
- **Ephemeral window caveat:** the aggregate is **process-local and resets on restart** — a live
  baseline tool, not a historical store. (Persisted baselines + OTel/Prom export are future-dated.)
- **Config flags (operator doc):** an **instrumentation env flag, default ON** (off ⇒ no metrics
  recorded, bundle identical); a **per-request verbose/debug switch, default OFF** (on ⇒ `meta.timings`
  present). Exact flag/switch names + default rolling-window size are the operator-doc/Interface call.

## Consumed-field naming (readout + meta; Interface owns final shape/presence)
- **`meta.trace_id`** (string, always) · **`meta.timings`** (object, present only when verbose):
  `{ total_ms, stages: [{ stage, kind, duration_ms, status }], vendor_calls: [...] }`.
- **Readout** (read-only): `instrumentation_enabled` (bool); `window { size_desc, uptime_seconds,
  request_count }`; `global` and `per_ticker[ticker]`, each:
  - `latency_total { p50_ms, p95_ms, max_ms, count }`
  - `stages: [{ stage, kind, p50_ms, p95_ms, max_ms, count, ok, error, skipped }]`
  - `cache { hits, misses, hit_ratio, current_data_age_seconds }`
  - `vendor { call_count, latency_p50_ms, latency_p95_ms, min_rate_limit_headroom: { remaining, limit } | null }`
  - optional `recent_traces: [{ trace_id, ticker, dims{min_dte,max_dte,expirations_present,dark_pool},
    cache_hit, cache_age_seconds, total_ms, computed_trace_id? }]`.
- `kind` ∈ `io_vendor | cpu_engine | cpu_signals | io_disk | serialize`; the UI maps `io_*` → **I/O**
  tag, the rest → **CPU** tag (precise `kind` available on hover/in JSON).
- `min_rate_limit_headroom: null` ⇒ render **unknown** (not 0). Empty window ⇒ all numerics render `—`.

## Acceptance-criteria → state map
| PRODUCT_CONTRACT acceptance criterion | Satisfied by |
|---|---|
| Readout shows total + per-stage p50/p95 (+ count, max) and request count | Readout·Populated (stage table + total row) |
| Readout shows cache hit/miss + ratio + data age | Readout cache line |
| Readout shows vendor call count, latency, min headroom (or unknown) | Readout vendor line + Unknown(vendor) state |
| Metrics available per-ticker and global roll-up | Per-ticker breakdown + Global roll-up |
| Each stage labeled I/O- or CPU-bound | I/O vs CPU tag (from `kind`) in the stage table + trace |
| Cache-hit request distinguishable from cache-miss | Cache hit vs miss (per-trace label; near-zero compute) |
| Every served bundle has a trace id, present in its structured logs | meta.trace_id (always) + Structured-log states |
| Structured logs additive, not doubled | Structured-log states (additive, INFO/DEBUG, not doubled) |
| Instrumentation disabled → serves identically, no metrics recorded | Disabled state + meta "Instrumentation off" |
| Per-stage timings in meta only when verbose switch set | Response-metadata "timings (verbose only)" |
| Instrumentation failure → bundle unchanged (200, same values), only span missing | Best-effort isolation (readout-unavailable + missing-span; trader path untouched) |
| Instrumentation on → SSE unchanged, no added latency | "no trader change" rule + SSE explicitly not instrumented |
| On vs off → no meaningful trader latency difference | Hot-path-not-slowed (capture off response-critical path) |
| Reading metrics surface triggers no vendor fetch, no cache mutation | Readout = read-only, side-effect-free (binding) |
| Aggregate resets on restart; presents unknown/empty gracefully before any requests | Reset + Empty/cold states |
