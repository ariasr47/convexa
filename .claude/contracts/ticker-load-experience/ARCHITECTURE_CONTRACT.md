# ticker-load-experience — ARCHITECTURE CONTRACT (GATE A·X)

> Technical SHAPE only: data-structure CONTENT, data-flow, component boundaries, isolation/error
> rules, restated binding constraints, non-goals. NO UI/layout, NO endpoint signatures, NO
> payload/JSON field names, NO copy — those are the PM's / UX's / Interface's to settle (collected in
> "Open questions" below). Stands alone against `PROJECT_CONTEXT.md` (§2/§3/§5/§7) + `BRIEF.md` +
> the MEASURED LATENCY block. Decisions, not deliberation.

---

## 0. What this feature is, in one paragraph

Make `/ticker/:symbol` feel instant and its price fully trusted, via three ADDITIVE moves on one
surface: (1) a **skeleton-first** loading model that paints page chrome + every component's
structure immediately and fills each independently as its own data source resolves; (2) **cut the
real cold-load cost**, whose measured shape is `vendor_fetch` ≈87% and within it the SINGLE
options-chain call ≈75% — primarily by **reusing the full chain the live SSE session already holds
in memory** (pre-warm the REST cache off it), secondarily by parallelizing the independent vendor
fetches and a chain-pagination concurrency check, with engine vectorization as a cheap CPU win; and
(3) a **live last-trade readout** surfaced as a display-only SIBLING of the NBBO mid. Every move is
additive and MUST leave `opportunity_score` / `opportunity_tier` / `state_fingerprint` / the entry
gate byte-identical.

This contract does NOT change what `compute_ticker` *produces* for a given key — only *when* and
*how* the inputs are obtained and *when* structure paints. Same inputs → byte-identical bundle.

---

## 1. The audited reality this shapes against (verified in code, do not re-audit)

- **`_serve` (main.py:373) has NO in-flight de-duplication.** Cache hit/miss is a simple
  `_cache.get(key)` + TTL check; on a miss it calls `compute_ticker` in a worker thread. Two
  concurrent misses on the SAME key BOTH run the full vendor load. This is THE trap for any
  fetch-splitting design. (See §3.)
- **The options-chain fetch is SERIALLY PAGINATED.** `massive.fetch_options_market_state`
  (massive.py:173) drives `client.list_snapshot_options_chain(..., limit=250)` and iterates the
  auto-`next_url`-following generator. The docstring's "single pass / no manual pagination" is API
  *ergonomics*, not concurrency: for SPY's 13,354 contracts at 250/page this is ≈54 SEQUENTIAL
  network round-trips inside one synchronous call. That serialization is the measured 75% bottleneck.
- **The live session already holds a fresh full chain per active ticker.** `LiveSession.contracts`
  (live.py:73) is populated by `_refresh_chain` (live.py:99) at start and re-fetched every
  `CHAIN_REFRESH_SECONDS` (120s) by `_chain_loop`. CRITICAL: the live session filters the chain to
  greeks-priced contracts only (`gamma is not None`, live.py:102), and does NOT retain
  `synchronized_spot` / `current_spot` / `timestamp` / `atm_iv` / quote / volume / unpriced-OI
  contracts. It is a PARTIAL chain — **not** a substitute for the bundle's `market_data` dict.
- **`compute_ticker` does three sequential vendor fetches** (chain, daily bars, intraday bars —
  main.py:261-267) inside one `vendor_fetch` span, then a 4th (recent trades) under `off_exchange`
  when `dark_pool`. Each is wrapped in its own `obs.vendor_call`. These three are INDEPENDENT.
- **`process_gex_profile` (engine.py:259) is a per-contract Python `for` loop** over every contract
  (up to ~13k), the ~10% `engine_build` CPU cost. Max-pain/PCR accumulate per-expiration BEFORE the
  DTE filter (full-chain); Vol/OI accumulates full-chain; only the gamma structure is window-scoped.
- **`last_trade_price` is tracked but never broadcast.** `LiveSession.last_trade_price` (live.py:71,
  set at live.py:127/160) is maintained by the trade tape but absent from the SSE `base` payload
  (live.py:185-201).
- **FE gates the whole page on the bundle.** `TickerDashboard` renders `<CircularProgress/>` when
  `!data` (lines ~497, 512: the entire `{!noneSelected && m && (...)}` block is bundle-gated). Price
  (SSE), bundle (REST 60s poll), and AI-rec already fetch on independent lifecycles; `streamOffline`
  is a post-load payload-gap watchdog (>15s), distinct from cold-load.

---

## 2. Loading-state taxonomy (the boundary spine — settle this first)

These four states are DISTINCT data/flow conditions and MUST NOT be conflated. Each component on the
page resolves its own structure→data independently; the page-level monolithic gate is removed.

| State | Meaning | Source condition (data-flow) | Treatment class |
|---|---|---|---|
| **COLD-LOAD** | No bundle has EVER loaded this ticker/filter | `data == null && error == null` | Skeleton (structure painted, no data yet) |
| **STATIC-BUNDLE-PERSISTS** | A bundle loaded; a later REST poll failed | `data != null && error != null` | Keep last bundle, soft refresh warning (existing path) |
| **SSE-OFFLINE-DEGRADE** | A bundle loaded; the LIVE transport dropped post-load | `data != null && streamOffline` (watchdog >15s) | Dim only live-derived data; static reads keep rendering (existing path) |
| **COLD-START-FAILURE** | First-ever load errored, nothing on screen | `data == null && error != null` | The ONLY blank/error screen (existing Retry path) |

Binding rules:
- **Skeleton (cold-load) ≠ offline-degrade.** A skeleton means "never loaded — structure only";
  offline means "loaded, then the live transport dropped — last bundle still valid." They use
  different visual classes and MUST be driven by different conditions. (`[live-vs-static-isolation]`.)
- The skeleton model replaces ONLY the `!data` monolithic gate. The three post-load states
  (static-persists, sse-offline, cold-start-failure) are ALREADY shipped and are preserved as-is.
- Skeleton resolution is **per data-source, not per-tile**: a tile fills when ITS source resolves.
  Sources are: the REST bundle (most tiles + chart + static reads), the SSE live payload
  (price/mid/spread/net-flow/live-flip/**last-trade**), and the async AI-rec (its own surface). A
  per-component "unavailable this cycle" (a resolved-but-null datum) is NOT a skeleton — it is the
  existing best-effort null state and must remain visually distinct from "still loading."

---

## 3. Loading MODEL: skeleton over the single bundle — NOT a fetch split (binding)

**Decision: skeleton-first over the existing SINGLE monolithic bundle fetch. Do NOT split the cold
bundle into N independent slice-fetches.**

Rationale (the trap, restated as a constraint): `_serve` has no in-flight de-dup, so N parallel
slice-fetches on a cold cache each independently miss and each runs a full `compute_ticker` = N×
vendor load (N× the 75% chain cost). The brief's entry rationale names this explicitly.

So the loading model is:
- The page renders skeleton STRUCTURE for every component immediately (no data dependency).
- The component tree fills from the SAME single bundle response it already consumes today (one
  `getTicker` per ticker/filter), plus the independent SSE payload and the independent AI-rec — all
  three of which ALREADY have separate lifecycles. The win is removing the monolithic GATE, not
  adding fetches. This is purely additive on the FE and needs no new data shape.

**Conditional carve-out — IF any future split is ever proposed:** it is FORBIDDEN unless
`_serve` first grows **request-coalescing** (in-flight de-duplication keyed by the SAME cache key
`(ticker, min_dte, max_dte, expirations, dark_pool)`), so that concurrent misses on one key await a
single shared `compute_ticker` future instead of each running their own. This contract does NOT
require building a split; it BINDS that a split without coalescing is out of bounds. Request
coalescing is itself a legitimate, low-risk additive hardening of `_serve` (it changes nothing about
the produced bundle — same inputs, same output, fewer redundant computes) and the PM MAY scope it on
its own merits as cold-start protection; see Open Questions.

---

## 4. Chain-sharing / pre-warm boundary (the #1 lever — shape carefully, binding)

**Goal:** when a live `LiveSession` for a ticker is active, a cold REST bundle request for that
ticker should be able to hit the WARM path (~7ms) instead of paying the ~3.5s cold chain re-fetch,
because the session already re-fetches the identical chain every 120s.

### 4.1 What may and may NOT be shared

- The live session's `self.contracts` is a **greeks-filtered, lossy projection** of the chain. It is
  NOT sufficient to reconstruct `compute_ticker`'s `market_data` (missing: `synchronized_spot`,
  `current_spot`, `timestamp`, `atm_iv` + its tenor, per-contract `quote`/`volume`, and the unpriced
  contracts max-pain/PCR need). **Therefore the shared artifact MUST be the full, unfiltered
  `OptionsMarketState` dict** (`fetch_options_market_state`'s return), captured at the live session's
  fetch site BEFORE any filtering — not the post-filtered `self.contracts` list.
- **Decision: the live `_refresh_chain` becomes a PRODUCER of the shared chain snapshot.** It already
  calls `fetch_options_market_state`; it stashes the FULL returned `market_data` (unfiltered) into a
  process-local, ticker-keyed shared store at fetch time, with a freshness timestamp, THEN does its
  own greeks-filtering for `self.contracts` as today. The live path's behavior is otherwise unchanged.

### 4.2 The boundary: chain-INPUT sharing, NOT bundle-output sharing (binding isolation rule)

The shared artifact is the **vendor chain INPUT** (`market_data`), consumed by `compute_ticker`
exactly where it calls `fetch_options_market_state` today. It is NOT the computed bundle and NOT the
`_cache` entry. This is the load-bearing isolation decision:

- `compute_ticker` stays the single authority that turns `market_data` → bundle. Pre-warm changes
  ONLY the SOURCE of `market_data` (live-shared vs fresh vendor fetch), never the transform. Same
  `market_data` in → byte-identical bundle out → `opportunity_score`/`tier`/`state_fingerprint`
  byte-identical (`[additive-keeps-score-byte-identical]`).
- The existing `_cache` (keyed by the full filter tuple) and `_snapshot_cache` (ticker-keyed) keep
  their exact current semantics. Pre-warm does not pre-populate `_cache` directly; it lets the
  normal miss path run `compute_ticker` but with the chain fetch SHORT-CIRCUITED to the shared
  snapshot. (Daily bars + intraday bars + recent-trades are still fetched normally — they are only
  ~12% + the dark-pool 4th fetch, and are NOT what the live session holds.)

### 4.3 Freshness / ownership / no-session fallback (binding)

- **Freshness gate:** the shared chain snapshot is consumable by the REST path ONLY if its capture
  timestamp is within a bounded staleness budget. The budget MUST be ≤ the live chain-refresh
  cadence (`CHAIN_REFRESH_SECONDS`, 120s) AND MUST honor the bundle's own staleness contract
  (`STALE_AFTER_SECONDS`; §6). If the shared snapshot is older than the budget, the REST path fetches
  fresh (no pre-warm) — never serve a chain the freshness contract would flag stale just to save time.
- **Ownership / lifecycle:** the live session OWNS the shared snapshot for its ticker; it is written
  on every `_refresh_chain` and is best-effort evicted/ignored when the session tears down (8s grace,
  live.py). A stale leftover after teardown is harmless because the freshness gate rejects it.
- **No active session → no behavior change.** If no `LiveSession` is active for the ticker (the
  common case for a first cold visit before SSE attaches), the shared store has no fresh entry and
  the REST path fetches the chain exactly as today. Pre-warm is a pure ACCELERATION when a session
  happens to be live; it is never a dependency and never a correctness factor.
- **Concurrency / mutation safety:** the shared store is written from the event loop (after the live
  session's `to_thread` fetch resolves) and read on the REST miss path (also event-loop-resident
  before dispatching `compute_ticker` to a thread). The shared `market_data` MUST be treated as
  read-only by every consumer (do not mutate the dict in place — `_build_market_state` /
  `process_gex_profile` already treat it as read-only input; preserve that). The REST path captures
  the reference (or a snapshot copy if any consumer mutates) before handing it to the worker thread.

### 4.4 Best-effort isolation of the pre-warm itself

Pre-warm is a best-effort optimization: ANY failure to obtain/validate the shared snapshot
(missing, stale, malformed, store error) falls back to the normal vendor fetch with no error
surfaced (`[best-effort-isolated-or-null]`). It must NEVER turn a cold load into a failure, and must
NEVER change the produced bundle. The per-stage observability (`vendor_fetch` / `fetch_options_
market_state` `vendor_call`) must remain honest: a pre-warmed chain is a near-zero-cost
chain-acquisition (its timing reflects reality — a shared-hit, not a fabricated vendor latency).
(Whether/how the trace distinguishes a pre-warmed acquisition is an observability detail flagged to
the PM/Interface, not a math concern.)

---

## 5. Vendor-fetch concurrency + chain-fetch scoping

### 5.1 Concurrency of the three independent fetches (data-flow + isolation)

The three `vendor_fetch` sub-calls (chain / daily bars / intraday bars) are INDEPENDENT and MAY run
concurrently. Shape:

- Run them concurrently off the event loop (each `fetch_*` is blocking, already dispatched via
  `to_thread`; concurrency = gathering three `to_thread` calls rather than three sequential blocking
  calls inside one worker thread). The exact mechanism (gather of `to_thread`s vs a thread pool) is
  an executioner detail; the SHAPE requirement is that the three overlap.
- **Per-stage best-effort isolation MUST survive concurrency** (`[best-effort-isolated-or-null]`).
  Each fetch's existing failure semantics are preserved INDEPENDENTLY: a chain failure →
  `market_data` empty → the existing 404-path (no usable chain); a daily-bars failure → empty list →
  HV degrades to null/0 as today; an intraday failure → empty → VWAP null as today. One fetch's
  failure or exception MUST NOT cancel or corrupt the other two, and MUST NOT raise out of
  `vendor_fetch` as an HTTP error beyond the existing no-chain 404. Gather with per-call exception
  containment (each call's result OR its already-handled empty fallback), never a fail-fast gather
  that abandons siblings.
- **Observability:** each fetch keeps its own `vendor_call` timing. Under concurrency the
  `vendor_fetch` SPAN wall-time becomes ~max(child) rather than sum(child); the per-call latencies
  stay individually attributed. This is the intended, honest result (the ~12% overlap win). No
  fabricated numbers.
- This concurrency change is additive: identical fetched data → identical `market_data` → identical
  bundle.

### 5.2 Chain-pagination parallelization — technical position

The dominant cost is the chain's ~54 SERIAL paginated round-trips. A clear position:

- **In-house parallelization of the pagination is BLOCKED by the current vendor seam.** The Massive
  SDK's `list_snapshot_options_chain` returns an opaque auto-`next_url`-following generator; page N+1's
  cursor is only known after page N returns, so the pages cannot be issued concurrently WITHOUT
  reaching past the port into vendor-specific cursor/HTTP mechanics. Doing so would violate the
  vendor-agnostic provider port (§5 key decision "Vendor-agnostic provider port"): engine/signals/
  main never see vendor internals, and a chain-fetch optimization must stay sealed inside the adapter.
- **Therefore: pagination parallelization is an ADAPTER-INTERNAL concern, explicitly OPTIONAL for
  this feature, and contingent on a vendor capability** (e.g. a direct-HTTP adapter or an SDK affordance
  exposing page cursors / strike-range partitioning that lets the adapter issue concurrent ranged
  requests). If pursued, it MUST live entirely inside `massive.py` behind the unchanged
  `fetch_options_market_state` signature and MUST return the IDENTICAL normalized
  `OptionsMarketState` (same contracts, same spot/timestamp/atm_iv) so the bundle is byte-identical.
  This contract does NOT mandate it; it BOUNDS it. The headline lever is the §4 pre-warm, which
  sidesteps the cost entirely when a session is live.

### 5.3 Chain-fetch SCOPING — bounded by the full-chain math (binding)

**The chain fetch MUST NOT be naively narrowed to the display DTE window.** §3 core-math is binding:
max-pain (nearest-monthly-OPEX) and PCR (put OI / call OI) are **full-chain**, and Vol/OI / term
structure are full-chain/cross-tenor. The DTE/expiration filter shapes ONLY the gamma structure
(walls/GEX/flip), and it does so DOWNSTREAM in `process_gex_profile`, not at the fetch. Any scoping
that drops contracts the vendor returns would change max-pain/PCR/Vol-OI/term and is FORBIDDEN as a
score/output-altering change. Net position: the fetch stays full-chain; speed comes from §4 sharing,
§5.1 concurrency, and (optionally, adapter-internal) §5.2 — not from narrowing what is fetched.

### 5.4 Engine vectorization — bounded CPU lever (binding output rule)

`process_gex_profile`'s per-contract loop (≈10% `engine_build`) MAY be vectorized as a CPU win. This
is OUT of this feature's required scope (it is named a secondary/cheap lever) but if scoped, the
binding rule is: **vectorization MUST be output-identical** — same `opportunity_score` inputs, same
walls/GEX/flip/DEX/Vol-OI, same `state_fingerprint`, within the existing numeric tolerance the
vectorized gamma-flip already established ("~330× faster, identical output", §5 key decisions). A
vectorization that changes any emitted value is a violation, not an optimization.

---

## 6. last-trade as a data element (binding live/static classification)

**Decision: `last_trade` is a LIVE-DERIVED, display-only SIBLING of the NBBO mid. The NBBO mid
REMAINS the sole anchor for the headline spot, the levels, and the live gamma flip.**

- **Source:** the live trade tape — the already-tracked `LiveSession.last_trade_price` (live.py:71),
  added to the SSE broadcast `base` payload alongside `mid`/`spread`/`net_flow`. No new fetch, no new
  stream. It is purely additive to the existing SSE payload shape.
- **Nullability (best-effort):** null between prints, overnight, and pre-first-print — exactly like
  the existing live fields degrade. Null is the honest state, never an error
  (`[best-effort-isolated-or-null]`). The FE renders "no last print" rather than a stale value.
- **Live-vs-static classification:** `last_trade` is LIVE-DERIVED. It degrades on an SSE drop with
  the same treatment as `mid`/`spread`/`net_flow`/live-flip (dim + offline, never blanked-into-a-lie),
  and is governed by the same `live`/`tick_age`/`market_session` honesty flags already on the
  payload. It is NOT a static bundle read. (`[live-vs-static-isolation]`.)
- **HARD BOUNDARY — `live-spot=NBBO-mid` (locked, §5 / THREADS §9):** `last_trade` MUST NEVER feed:
  the headline spot anchor, the levels (walls/flip/peak/max-pain), the live gamma-flip reprice
  (`_levels_for_filter` keeps `self.mid`), `net_flow` sign logic, or any score/gate input. It is a
  READOUT. The mid stays the anchor. This is the owner-approved carve-out named in the brief — an
  ADDITIVE readout, NOT a reversal of the anchor decision. See §9 binding note.
- **Score isolation:** `last_trade` is not a `signals`/scoring/fingerprint input (it rides SSE, which
  is uninstrumented and off the bundle path). `[additive-keeps-score-byte-identical]`.

---

## 7. Real-time-tier freshness config (data-freshness boundary)

The advanced/real-time vendor tier implies tighter data-freshness semantics. The architecture
concern (the env-surface specifics are Conventions / Interface, §7):

- **`STALE_AFTER_SECONDS`** governs the bundle's `meta.freshness.stale` flag and FORCES the AI gate
  off when stale (`_wrap`, main.py:441-448). On a real-time tier the doc calls for dropping it toward
  ~120s. The binding architecture boundary: this is the bundle's STATIC-data staleness contract and
  it must stay consistent with the §4 pre-warm freshness budget — **the pre-warm budget must be ≤ the
  bundle staleness threshold** so pre-warm never serves data the freshness contract would flag stale.
- **`CACHE_TTL_SECONDS`** (60s, = poll cadence) and **`CHAIN_REFRESH_SECONDS`** (120s, live refresh)
  keep their roles; pre-warm's budget sits between/under them (§4.3). No new cache layer is
  introduced — pre-warm short-circuits the chain INPUT, it does not add a parallel bundle cache.
- This is a config/threshold concern only: it changes when data is FLAGGED stale and when the AI gate
  is suppressed — it never changes a computed value, so `[additive-keeps-score-byte-identical]`
  holds (the score/fingerprint are computed identically; only the serve-time `stale`/`ready` overlay
  shifts, which is already a non-fingerprint serve-time overlay today).

---

## 8. Component boundaries & data-flow summary

```
                         [ massive.fetch_options_market_state ]  (serial-paginated; full chain)
                                          |  produces OptionsMarketState (market_data)
        +---------------------------------+----------------------------------+
        | LiveSession._refresh_chain (120s)                                  | compute_ticker (REST miss)
        |   - stash FULL market_data -> SHARED CHAIN STORE (ticker, ts)      |   - chain INPUT:
        |   - then greeks-filter -> self.contracts (live flip/SSE only)      |       if SHARED fresh -> use it (PRE-WARM)
        |                                                                    |       else -> fetch_options_market_state
        v                                                                    |   - daily bars / intraday bars: CONCURRENT
   SSE base payload (mid, spread, net_flow, live-flip, + last_trade [NEW])   |   - _build_market_state -> engine (UNCHANGED transform)
        |  (live-derived; degrades on SSE drop)                              |   - signals/gate/fingerprint UNCHANGED
        v                                                                    v
   FE live surfaces (price/last-trade/flow/spread/flip)             _cache[key] (UNCHANGED semantics) -> _wrap -> bundle
                                                                             |
                          FE: skeleton structure paints immediately; fills per-source:
                          REST bundle | SSE live payload | async AI-rec   (3 independent lifecycles)
```

Boundaries (binding):
- **`compute_ticker` is the sole bundle-producing transform.** Pre-warm changes its chain INPUT
  source only. Concurrency changes the bars/chain acquisition only. Neither touches the transform.
- **The SHARED CHAIN STORE is an input cache, not an output cache.** It holds `market_data`, is
  ticker-keyed + timestamped, written by the live session, read best-effort by the REST miss path,
  read-only to all consumers, freshness-gated. It is invisible to the bundle output and to the FE.
- **The SSE path remains the only carrier of live data** (now including `last_trade`); it stays
  uninstrumented and off the bundle/scoring path.
- **The FE removes ONLY the monolithic `!data` gate;** the three independent data lifecycles and the
  three post-load states are unchanged.

---

## 9. Restated binding constraints (Invariant watch — cite where touched)

- **`[additive-keeps-score-byte-identical]`** — skeletons (FE-only), chain pre-warm (input-source
  swap, §4.2), fetch concurrency (acquisition only, §5.1), engine vectorization (output-identical,
  §5.4), `last_trade` (SSE-only readout, §6), and freshness config (serve-time overlay, §7) are ALL
  additive. `opportunity_score` / `opportunity_tier` / `state_fingerprint` / the entry gate stay
  BYTE-IDENTICAL; none is a scoring input. Pre-warm MUST NOT change what `compute_ticker` produces:
  same `market_data` in → same bundle out.
- **`[best-effort-isolated-or-null]`** — each vendor stage stays best-effort (None/empty/omitted on
  failure, never an HTTP error beyond the existing no-chain 404); concurrency preserves this
  per-stage (§5.1); pre-warm failure falls back to a normal fetch (§4.4); `last_trade` is
  independently nullable (§6); off-exchange/4th-fetch isolation is untouched.
- **`[live-vs-static-isolation]`** — `last_trade` is live-derived (degrades on SSE drop like
  mid/spread/flow, §6); static bundle reads keep rendering the last bundle; skeleton (cold-load) is a
  DISTINCT state from offline-degrade (post-load), and from static-persists and cold-start-failure
  (§2).
- **`live-spot=NBBO-mid` (locked, §5 / THREADS §9)** — `last_trade` is ADDITIVE display only; the mid
  stays the anchor for headline spot, levels, and the live flip. This is the owner-approved carve-out
  named in the brief (a readout added), NOT a reversal of the anchor. **Future-feature binding note:**
  THREADS §9 currently reads "Keep mid; do not add last-trade" — this feature is the deliberate,
  owner-sourced narrowing of that line to "mid stays the ANCHOR; last-trade may be ADDED as a
  display-only sibling." Any future feature that lets last-trade drive the anchor/levels/flip is a
  GATE-Z reversal, not an extension.

---

## 10. Explicit NON-GOALS

- **Own-gamma unification / consistent-flip is OUT OF SCOPE.** That is the separate
  `gamma-unification` track (measure-first per the standing "measure the divergence before
  calibrating" rule). `gamma-sourcing-split` (§3) is NOT touched: walls keep VENDOR gamma; the flip
  (static + live) keeps ANALYTIC BS gamma. This feature changes neither math source.
- **No change to the scoring / gate / fingerprint path.** Not a single value is recomputed
  differently. The module boundary (`signals`/`engine` never importing this feature's seams) is the
  enforcement.
- **No real order path.** Nothing here touches orders/brokers (`[no-real-order-path]` untouched).
- **No new trader-vs-operator boundary change** (`[operator-vs-trader-path-separation]` untouched;
  observability stays operator-only, read-only).
- **No required chain-pagination parallelization and no required engine vectorization** — both are
  bounded OPTIONAL levers (§5.2/§5.4), not deliverables of this contract.
- **No fetch-splitting of the cold bundle** (§3) — forbidden without request-coalescing, which is
  itself not required by this feature.
- **No overnight-coverage change** — the Massive overnight gap (THREADS §2) is orthogonal and
  untouched; `last_trade` is null overnight, honestly.

---

## 11. Open questions for the next role (PM)

1. **Scope of the §4 pre-warm vs the §5.1 concurrency for v1.** Pre-warm is the #1 lever but only
   helps when a session is already live (return visits / active page); concurrency helps every cold
   miss but only ~12%. Which ships in v1, and is the first-ever cold visit (no session yet)
   explicitly accepted as still-slow-but-skeletoned? (Architecture supports both; sequencing is a PM
   call.)
2. **Is request-coalescing on `_serve` (§3) in or out of scope** as cold-start hardening? It's a
   low-risk additive change that protects every cold key from duplicate compute and is the
   prerequisite for any future split. Recommend in; PM decides.
3. **`STALE_AFTER_SECONDS` real-time value (§7)** — confirm the target (~120s) and that the pre-warm
   budget is pinned ≤ it. This is an env/threshold call with a freshness-contract implication.
4. **Last-trade display semantics & acceptance** (UX/Interface, but PM frames the ACs): the exact
   field name on the SSE payload + the `@org/api` type, the "no last print"/overnight copy, and how
   it sits visually relative to the mid so a trader never mistakes it for the anchor. (Architecture
   fixes it as a live-derived nullable sibling; naming/copy/layout are downstream.)
5. **Skeleton granularity & acceptance bar** — which components get individual skeletons and what
   "time-to-first-meaningful-paint" the ACs assert. (Architecture fixes per-source fill + the
   4-state taxonomy; the component inventory + copy are UX's.)
6. **Optional levers gating (§5.2 pagination, §5.4 vectorization)** — does the PM want either scoped
   now, or filed as deferred seams? Both require live measurement (advanced-tier key) to value, per
   the brief's feasibility note.
7. **Observability honesty for a pre-warmed acquisition** — should a pre-warmed chain be distinguishable
   in the trace/metrics (a "shared-hit" vs a vendor fetch) so the operator readout stays truthful about
   where the time went? (Interface/observability detail; flagged so it isn't lost.)
```
