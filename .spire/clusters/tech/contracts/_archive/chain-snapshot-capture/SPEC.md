# chain-snapshot-capture — spec

**Source brief:** .spire/clusters/tech/contracts/chain-snapshot-capture/BRIEF.md
**Council:** R1 positions · R2 critiques · decisions.md   (under council/)
**Status:** draft

## 1. Goal + scope

Keep the Massive options chain (and the stock bars already pulled with it) after we pay to fetch
them, so research can later replay our compute on the **exact book we already paid for** without
another vendor call. Today the scanner writes a digested structure diary and a latest-wins
`scan_bundles` cache, then discards the live `VendorBundle`. This feature appends those
already-fetched snapshots off the trader request path as a research/operator corpus. It does not
buy a new Massive product, invent historical-chain endpoints, or put capture on the trader UI.

**In scope:**

- Append-dated raw snapshots of the options chain + accompanying stock bars already obtained on a
  **fresh-vendor** scan or serve cycle (no extra Massive fetch for capture itself).
- Append identity `(symbol, as_of)` — a second paid cycle does not erase the first inside the
  active retention policy.
- Dual retention governor: **max-age AND per-symbol count cap** (architect-named defaults below);
  never latest-wins collapse; never min-interval thinning in v1 (**D1**, **D-ret**).
- Research/operator **list** and **load** of stored snapshots with **zero** live Massive calls
  (including on miss).
- Best-effort isolation: capture write failure never fails bundle / scan / SSE; capture stays off
  the trader request latency path.
- Score / tier / fingerprint byte-identity; stored blobs are never scoring inputs.
- Secret hygiene: no API keys or secrets in stored JSON.
- Operator observability (counts / list / load / closed research-read wording) **without** the
  trader UI (**D-copy**).

**Out of scope:**

- Buying Massive point-in-time historical options / historical IV / indices / Benzinga products.
- Inventing vendor hist-chain endpoints or pretending live snapshot capture is vendor history.
- Any trader UI surface (Ticker, Settings, Ask-AI, Scanner, Positions, Landing, shell nav) for
  capture browse, replay, or stored-blob download.
- Redistributing stored snapshots on a trader route (Massive license: our research only) —
  including proxying `/api/_research/*` through the public Pages trader origin.
- P3 batch backtest CLI / multi-symbol replay reports (blocked-on this corpus).
- Changing score / tier / gate / fingerprint math.
- Replacing or deleting `scan_structure_history` or `scan_bundles`.
- Object-store infra in v1 (deferred behind a blob-port if retention economics demand it).
- Min-interval thinning / “capture skipped — within min interval” (rejected by **D1**).
- Warmer / `refresh_analytics` capture this ship (explicitly excluded under §2.3 — retention burn).

**Future (deliberately deferred):**

- P3 batch backtest CLI (replay from captured books).
- Vendor PIT historical chains if the owner later buys that Massive product line.
- Longer / tiered cold retention and object-store swap.
- Optional unlinked operator dashboard for capture health.
- Store-vouched prune-vs-never-captured miss distinction (v1 uses one honest miss string).
- Optional warmer-loop capture if retention dials are raised enough to absorb it (GATE Z).

## 2. Architecture

### 2.1 Unit of capture

**Unit = one already-materialized `VendorBundle`** from this cycle — not a digested score row and
not a raw HTTP body.

| Part | Source (live Rust) | Role |
| --- | --- | --- |
| symbol | `VendorBundle.symbol` / `OptionsMarketState.ticker` | identity (upper/trim-normalized) |
| as_of | `VendorBundle.as_of` (`Utc::now()` at build in `live.rs` / `compute_analytics`) | identity + replay clock (**sub-second** — see §2.6) |
| source | `MarketDataSourceKind` (`LiveMassive` \| `Fixture`) → wire `live_massive` \| `fixture` | lineage token (not a Live badge) |
| market | `OptionsMarketState` (spots, ATM IV metadata, phase, full `contracts[]`, `timestamp`) | required for GEX replay |
| daily_bars | best-effort vec from the same parallel fetch → wire `DailyBarWire[]` | HV / context |
| minutes | best-effort vec → wire `IntradayBarWire[]` | VWAP |
| trades | best-effort vec (may be empty when dark-pool off) → wire `TradePrintWire[]` | dark-pool when present |

**Identity:** composite key **`(symbol, as_of)`**. Do **not** overload `scan_bundles` PK `symbol`
(`ON CONFLICT (symbol)` latest-wins is forbidden as history).

**Serialization:** parsed-domain → capture wire → bytes (symmetric to fixture load:
`OptionsMarketState` + `DailyBarWire` / `IntradayBarWire` / `TradePrintWire`). Never persist
request URLs, `apiKey` query fragments, env, or client config (`massive/rest.rs` injects `apiKey`
into HTTP URLs — that string must not cross the serialize boundary). Research load returns that
same typed shape so `compute_analytics_from_vendor` can replay without re-typing the world.

### 2.2 Storage shape

**Chosen:** append-only side-store with dual backend parity to `ScanStore` (JSON-on-disk local /
Postgres when `DATABASE_URL` + postgres feature), keyed by `(symbol, as_of)`, body = opaque
serialized capture bytes + small metadata columns for list/prune without deserializing the chain.

Object-store + thin index stays a **later** swap behind a blob-port — not v1.

`scan_structure_history` remains the digested feature diary. Capture does not widen those columns
into a chain dump. Optional non-scoring research join to a same-cycle `StructureSample` by matching
`(symbol, as_of)` clocks is tolerated as best-effort (one leaf may succeed without the other;
`StructureSample.as_of` is `f64` / `DOUBLE PRECISION` while capture `as_of` is `DateTime<Utc>` —
conversion is best-effort, not a typed join contract this ship).

### 2.3 Producer + data flow

```
Massive REST (already paid this cycle)
  → VendorBundle materialized (compute_analytics fresh path / live.rs resolve)
  → Path B: compute_analytics_from_vendor → AnalyticsSnapshot → trader/scan unchanged
  → Capture leaf (parallel): clone VendorBundle → off-path serialize+append → side-store
Research replay:
  side-store load (symbol, as_of) → VendorBundle → compute_analytics_from_vendor
  (zero Massive I/O; MarketDataPort::Fixture remains for hermetic CI)
```

**Producer rule (load-bearing):** capture runs **only when this cycle already holds a fresh
`VendorBundle`** (post-fetch). A `gex_cache` hit that returns an `AnalyticsSnapshot` without
rebuilding vendor inputs **does not** capture and **must not** re-fetch to fill a blob.

**Every successful paid (fresh-vendor) fetch on an in-scope producer path appends** a dated
snapshot (**D1**). There is **no** `STRUCTURE_HISTORY_MIN_INTERVAL`-style skip in v1. A paid
cycle on an in-scope path that obtains a book and writes nothing (when storage is configured and
writable) is a **defect**, not an intentional skip class.
<!-- spire:council-resolution:v1 18414e85c4d01e6b1aa0185d0aa136f7640ee7779a22019a1d51efb9107ca752 folded -->
<!-- spire:council-resolution:v1 4f26c095410a75c60462f59bf0d3cffc704fd0824a2c58c3ec3202c44d9e8c8c folded -->
<!-- spire:council-resolution:v1 5b58c3634615a52d3611d0d48fdbfa196f2baa34d928f4fc2cf8bef82136fa79 folded -->
<!-- spire:council-resolution:v1 7a522d83fd466a4457dcf3a12fe279d1ee6253349c2540afb19f028ef863ad24 folded -->

**In-scope producers this round (named):**

- **Scanner slow-lane** — on each fresh-vendor success for a symbol (`load_or_compute` →
  `compute_analytics`, including whatever DTE filter that cycle already applied; capture stores
  the book that cycle paid for — no separate DTE-bypass fetch for capture).
- **Serve / ticker cold compute** — same append rule via `load_analytics` → `compute_analytics`,
  fired with `tokio::spawn` (or equivalent) after the caller already holds its
  `AnalyticsSnapshot`; the serve future must not await capture I/O.

**Explicitly excluded this round:** warmer / `refresh_analytics` (default-on ~25s cadence would
burn the 48-cap in minutes and make the 14-day age dial a dead letter on warm symbols). Capture
must not hook the warmer loop; a warmer paid fetch that writes nothing is **out of AC-28** this
ship. Raising retention enough to absorb warmer capture is GATE Z, not silent scope creep.

**Multi-ticker:** only the existing bounded sweep worker may produce many symbols per cycle; each
symbol’s capture is independent and still only on fresh-vendor success. Request path stays
single-ticker-on-demand.

### 2.4 Retention (dual bound — D-ret)

Cost is governed **only** by dual retention — **not** by interval thinning.

| Dial | Default (architect-named) | Meaning |
| --- | --- | --- |
| `CHAIN_SNAPSHOT_MAX_AGE_SECS` | **1_209_600** (14 days) | Snapshots older than this are pruned |
| `CHAIN_SNAPSHOT_MAX_PER_SYMBOL` | **48** | Per-symbol count ring; oldest dropped first when over cap |

Both bounds always apply. Prune runs after successful append; prune failure logs and does **not**
fail the append (same isolation pattern as structure-history prune in `pg_scan.rs`). Retention
never collapses the store to a single latest row per symbol while younger history remains inside
the active policy. Count-only with no max-age is forbidden; age-only with unbounded same-day
volume is forbidden.
<!-- spire:council-resolution:v1 ccc9fc0a570f28b70558fb227f359ce1e818c790453d9b740f3dbf56d61c44da folded -->
<!-- spire:council-resolution:v1 0ff2384466076a4b23bfb0dae68bf57eb1901231c7b19edd447d2c0814cb8f0d folded -->
<!-- spire:council-resolution:v1 66ce89ed30e5033f2efa693cb6f12f5ff01edd8aed0ed22ce2e0ed76fa3fb60f folded -->

**Why these numbers:** 14 days matches the research window intent of the P0 structure spine;
48 caps multi-MB chain blobs under high-cadence fresh-vendor serve/scan (digested history’s 576
ring is the wrong order of magnitude for raw books). Changing either dial is a GATE Z product
cost decision.

### 2.5 Research read boundary

Architect-named **domain facts** on every research list/load: symbol identity, `as_of` (capture
clock for operator `captured at` UTC), store outcome class **`hit` / `miss` / `error`**, and the
hard rule that list/load never call Massive. Transport and bytes live in
`INTERFACE_CONTRACT.md` (**T3**).

Research reads never warm trader caches as a side effect and never call `MassiveRestClient` fetch
methods. v1 uses a **single** honest miss string for absent identity (never-captured and
retention-pruned are not store-distinguished this ship). That closed string is mandatory on both
**list miss** (`count === 0`) and **load 404** — see INTERFACE.

**Edge isolation:** `/api/_research/*` is Railway-direct operator surface. The Cloudflare Pages
trader origin must **404** `/api/_research` the same way it 404s `/api/_metrics`
(`functions/api/[[path]].ts`) — token gate alone is not the `_metrics` posture.

### 2.6 Failure modes + isolation

| Failure | Observable result |
| --- | --- |
| Serialize / write / prune error | log + drop; trader/scan/SSE unchanged; no new dated snapshot; operator log `capture skipped — trader path unchanged` |
| Storage unavailable / not configured | desk remains up; no false stored success; operator-visible **`capture not storing`** (log and/or research `store=error` + `detail`) |
| Read miss | research path: `miss` + closed miss `detail`; **no** vendor fill-in |
| Corrupt / unreadable blob | research path: `error` + `detail` `stored snapshot unreadable: …`; **no** live Massive fallback |
| Partial vendor (daily/minutes/trades empty) | still persist if `market` (chain) present |
| Cache-hit cycle (no `VendorBundle`) | no blob; no fetch |
| Exact `(symbol, as_of)` rewrite | `ON CONFLICT DO NOTHING` / equivalent — **idempotent rewrite of the same bundle identity only**; not a second paid fetch vanishing |

**`as_of` precision (one rule):** `as_of` is RFC 3339 UTC **with fractional seconds** (sub-second /
nanos preserved from `DateTime<Utc>`). Two distinct paid fetches in one UTC second **both**
persist as two rows. “Same-second retry” language means only an idempotent no-op when the
**exact same** `(symbol, as_of)` identity is rewritten — never “truncate to whole seconds and drop
a second paid book.”

**Off-path completion:** serve/ticker capture is spawned after the trader response path already
holds its snapshot. Append completion is observed by **polling research list until count +1**
(default list, no `limit`), **or** a structured operator log line `chain snapshot appended`
(symbol + as_of), **or** an explicit test barrier — never by asserting on the trader 200 alone.

Module boundary: capture is a **one-way leaf** — `signals` / score / fingerprint / gate never import
the capture store; capture receives a clone of an already-built `VendorBundle` and never feeds
back into live `compute_analytics_from_vendor` on the trader path.

### 2.7 Not buildable / rejected approaches

- Overloading `scan_bundles` as history.
- Min-interval thinning skips as success no-ops (**D1**).
- Re-fetching Massive on cache hits or research misses to “fill in” blobs.
- Object-store infra as v1 requirement.
- Trader-route redistribution or trader UI chrome for capture.
- Invented Massive hist-chain / PIT product endpoints.
- Truncating `as_of` to whole seconds so two paid fetches collide.
- Silently wiring warmer / `refresh_analytics` into capture without a GATE Z retention change.

## 3. Acceptance criteria (with user stories)

Actors: research operator / owner. Not the signed-in trader on Landing / Ticker / Positions /
Scanner.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 **(SB)** | US-1: As the research operator, I want each successful paid fetch to leave a dated raw book so the $199+$199/mo spend is not thrown away after one request. | After one successful **fresh-vendor** scan cycle that already fetched a paid options book for ticker T on an **in-scope producer**, once append completion is observed (poll default research list until +1, or `chain snapshot appended` log / test barrier — not the trader 200 alone), the research store shows a **new dated snapshot** for T (operator list/count for T increases by one versus the pre-cycle baseline) **when the new row remains inside the active retention policy** (same caveat as AC-4; at the per-symbol cap, prune-after-append may keep count flat while the new identity is still loadable). | test |
| AC-2 **(SB)** | US-1 | After one successful **fresh-vendor** serve/cold-compute cycle that already fetched a paid options book for ticker T, once append completion is observed the same way as AC-1, the research store likewise shows a **new dated snapshot** for T (subject to the same retention caveat); the trader-facing serve success/failure semantics are unchanged. | test |
| AC-3 **(SB)** | US-1 | A research **load 200** for a retained snapshot returns a typed body sufficient to replay GEX: `market` includes spots, ATM IV fields, `market_phase`, `timestamp`, and `contracts[]`, plus typed `daily_bars` / `minutes` / `trades` arrays (fixture-symmetric wire; companions may be empty) — not merely a digested score/levels summary row. | test |
| AC-4 **(SB)** | US-2: As the research operator, I want a second cycle to keep the first snapshot so I can compare across time. | Given an existing dated snapshot for T from cycle 1, after a later successful **fresh-vendor** cycle 2 for T on an in-scope producer, **both** dated snapshots are still present **unless** cycle 1 has since been removed by the **active retention policy** (count for T is +1 vs post-cycle-1 when both remain inside policy, and cycle 1’s identity remains loadable when still retained). | test |
| AC-5 **(SB)** | US-2 | The research snapshot store is **not** “one row per symbol overwritten”: overwriting or deleting cycle 1 as a side effect of writing cycle 2 while cycle 1 is still inside the active retention policy fails this criterion. | test |
| AC-6 **(SB)** | US-3: As the research operator, I want to load a stored dated snapshot with no live Massive call. | Loading a stored dated snapshot for research completes with **zero live Massive calls** for that load (`vendor_called` stays false / vendor call counter for the load path stays at 0). | test |
| AC-7 **(SB)** | US-3 | Listing or counting stored snapshots for a ticker completes with **zero live Massive calls**. | test |
| AC-8 **(SB)** | US-4: As the research operator, I want honest empty / missing / write-failure outcomes. | On a fresh empty store, operator list/count reports **empty** (zero snapshots) without fabricating a chain and without calling Massive. | test |
| AC-9 **(SB)** | US-4 | Requesting snapshots for a ticker that has none (research **list**, `count === 0` / `store=miss`) reports operator-visible wire **`detail` exactly `no stored snapshot for <SYMBOL>`** (distinct from “empty chain book” / market-empty language) and does **not** call Massive to create one. | test |
| AC-10 **(SB)** | US-4 | Requesting a specific dated identity that was never captured or has been pruned reports **miss / not found** for that identity with the same closed miss family (`detail` may append ` at <as_of>`) and does **not** silently substitute another date’s book. | test |
| AC-11 **(SB)** | US-4 | When the upstream cycle fails to obtain a vendor book (or is a cache-hit with no `VendorBundle`), **no raw snapshot row is invented** for that cycle. | test |
| AC-12 **(SB)** | US-5: As the desk owner, I want capture failures best-effort and isolated. | If the capture write fails after a successful vendor fetch, the trader-facing scan/serve still **succeeds**, and the research store does **not** gain a new dated snapshot for that cycle. | test |
| AC-13 **(SB)** | US-5 | If research storage is unavailable / not configured, the trader desk remains available; capture does **not** report a false stored success; the operator can observe closed **`capture not storing`** (log and/or research `store=error` + `detail`). | test |
| AC-14 **(SB)** | US-5 | Enabling capture does not place capture work on the trader request latency path in a way that makes a capture stall fail or delay the trader response — capture remains side/best-effort relative to the desk. | test |
| AC-15 **(SB)** | US-6: As the desk owner, I want capture off the trader UI and off trader redistribution. | No trader UI route, nav item, or trader-facing screen exposes capture browse, historical chain replay, or stored-blob download (structural empty-diff / no capture affordance on trader routes). | test |
| AC-16 **(SB)** | US-6 | No trader-facing product path redistributes stored snapshots as a market-data feed to end traders: `/api/_research/*` is absent from trader UI clients, and the Pages trader origin returns **404** for `/api/_research` (and subpaths) the same way it 404s `/api/_metrics`. | test |
| AC-17 **(SB)** | US-7: As the desk owner, I want stored snapshots to be non-inputs to scoring. | For the same market inputs, opportunity score / tier / fingerprint are **byte-identical** with capture on vs off and with capture write succeeding vs failing. | test |
| AC-18 **(SB)** | US-1 | Capture itself performs **no additional Massive fetches** beyond the fetch the scan/serve cycle already made for its own work. | test |
| AC-19 **(SB)** | US-8: As the research operator, I want bounded retention without latest-wins. | Snapshots outside the **active retention policy** (older than max-age **or** beyond the per-symbol count cap) are no longer loadable; snapshots still inside the policy remain listable/loadable. | test |
| AC-20 **(SB)** | US-8 | Retention pruning removes snapshots by the dual policy; it does **not** collapse the store to a single latest row per symbol while younger history is still inside the policy. | test |
| AC-21 **(SB)** | US-1 | Stored snapshot material contains **no API keys or other secrets**. | test |
| AC-22 | US-9: As the owner, I want this feature to unblock P3 later without absorbing P3 now. | This ship does **not** include the P3 batch backtest CLI; P3 remains Future / blocked-on durable capture. | review |
| AC-23 | US-6 | Operator verification of capture (counts / list / load) is available **without** using the trader UI. | review |
| AC-24 **(SB)** | US-1 | Multi-ticker capture, if any, runs only via the existing bounded sweep worker path — not as an unbounded on-request market sweep from a trader action. | review |
| AC-25 **(SB)** | US-4 / UX honesty | A successful research read of a stored snapshot surfaces framing that includes **stored** / **captured at** (UTC) and **loaded from store · no vendor call**, and displays **no** Live badge/chip and **no** label that means “this quote is live.” Closed wire lineage `source: live_massive` or `source: fixture` is **allowed and required** — it is provenance, not a live-market claim. | test |
| AC-26 **(SB)** | US-4 / UX honesty | Store read failure surfaces wire `store=error` with `detail` `stored snapshot unreadable: …` (operator copy may echo that string) and does **not** invoke or describe a live vendor fetch as recovery. | test |
| AC-27 **(SB)** | US-6 / UX silence | Capture write failure produces **no** trader-visible chrome and does not change trader error/empty/offline copy. | test |
| AC-28 **(SB)** | US-1 / D1 | After a successful fresh-vendor paid fetch on an **in-scope producer** (scanner slow-lane or serve/ticker cold compute — **not** warmer / `refresh_analytics`), failing to append a dated snapshot (when storage is configured and writable) is treated as a **defect** — there is no intentional min-interval “success no-op skip” class in v1. | test |

<!-- spire:council-resolution:v1 200df8d4e93023cccff67dacbbc22e00b305fcfccff849e4dd5cac962d590b1a folded -->
<!-- spire:council-resolution:v1 8c938b8bd1495576813a103432d517ba23ec7cd807412d33b032ab87f2b255c2 folded -->

**Ship-blocking set:** AC-1–AC-21, AC-24–AC-28. AC-22/23 are required honesty checks (`review`).

**Method notes (risk-based):**

- **`test`** concentrates on silent money/correctness failures: append-vs-overwrite, zero-vendor-on-read,
  empty/missing/no-fabricate (including list-miss `detail`), desk isolation, no trader redistribution /
  Pages `_research` 404 / no trader chrome, score byte-identity, no extra vendor fetch, dual-retention
  append-shaped pruning, no secrets, no live-market badge on research read (with `live_massive`
  lineage carve-out), load-hit typed payload (AC-3), D1 no silent skip on in-scope producers.
- **`review`** owns P3 not absorbed (AC-22), positive operator path without trader UI (AC-23), and
  sweep-only multi-ticker framing (AC-24).
- Prefer **one** integration pass: two successful fresh-vendor cycles on an in-scope producer → wait
  for append completion → assert count + both identities loadable (when inside policy) + vendor-call
  counter 0 on load + desk still OK when write is force-failed — over per-AC micro-harnesses.
- No DOM harness is required for ship; trader-chrome absence is a structural/source scan on
  `apps/dashboard`, not a Playwright suite. Pages `_research` 404 is a Functions edge assertion.

## 4. UI + interaction

**`NO_UI_CHANGE`.** This feature touches **no** dashboard surface — no route, no component, no token,
no new motion, and no `DESIGN_SYSTEM.md` amendment. Anyone proposing a Ticker tile, Settings
control, Ask-AI disclosure, `/_ops` chain browser, or a Live badge on stored data is re-scoping.

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (`Status: SET` — The Curvature
Terminal). **Design direction:** does not apply — no trader presentation ships.

Operator CLI / ops-check **wording under the closed vocabulary is In** (**D-copy**) — not “microcopy
polish.”
<!-- spire:council-resolution:v1 b9b5ba17dac09e5aabf852432306843657565771b4926dd043fa7d86af4adc3e folded -->

**Flows (operator / research only):**

1. Paid fresh-vendor cycle on an in-scope producer completes → dated snapshot appends (invisible on
   trader path; observe via list poll / append log).
2. Operator lists snapshots for a symbol via research list (HTTP; CLI may wrap the same store).
3. Operator loads one `(symbol, as_of)` → stored book for replay prep; zero Massive calls.

**Component states — trader path (S0):** one required state — **unchanged**. Capture success and
failure are both invisible on Ticker / Settings / Ask-AI / Scanner / Positions / Landing / shell nav.

**Component states — research read (S1):**

| State | When | What the operator sees | What must **not** happen |
|---|---|---|---|
| Default (stored hit) | Dated snapshot exists and loads from store | Framing + identity + provenance below; wire may show `source: live_massive` as lineage | Live badge/chip; any label meaning “this quote is live”; Massive network call |
| Loading | Store read in flight | Phase line that names **store read** (e.g. `reading stored snapshot: TSLA …`) | “fetching chain” / “refreshing from Massive” |
| Empty (miss) | No snapshot for ticker (list `count===0`) or dated identity (load 404) | Exact wire/operator `detail`: `no stored snapshot for <SYMBOL>` (optional ` at <as-of>` when a dated identity was requested). **No** “STORED CHAIN SNAPSHOT” claim on an empty list | `no options`, `empty chain`, `market closed`, trader `—`, fabricated book |
| Error (store) | Store unreachable / corrupt / identity invalid / unreadable blob | `stored snapshot unreadable: <reason>` · `store=error` · research-only | Silent fallback to live Massive; trader-shaped HTTP error |
| Capture write failure (operator log only) | Write-through failed after a paid fetch | Structured operator log: `capture skipped — trader path unchanged` | Toast on Ticker; failing scan/serve/SSE |
| Storage not configured | Capture side-store absent / unavailable | Operator-visible **`capture not storing`** (log and/or research `store=error` + that `detail`) | False stored success; trader chrome |

**Closed vocabulary (operator-visible):**

| Concept | Approved term | Banned |
|---|---|---|
| Persisted paid fetch | **stored chain snapshot** / **captured snapshot** | “live chain”, “Massive historical chain”, “hist options product” |
| When taken | **captured at \<UTC\>** / **as-of \<UTC\>** | “last updated”, “fresh”, “now”, “current book” |
| How obtained on read | **loaded from store · no vendor call** | “refreshed”, “fetched”, “synced from Massive” (on research read) |
| Activity | **research read** | “market view”, “ticker reload”, “live replay for traders” |
| Digested P0 row | **structure history sample** (digested) | “full chain”, “raw snapshot”, “stored chain snapshot” |
| Latest-wins cache | **scan bundle cache** (latest-wins, not history) | “history”, “archive”, “append log”, “stored chain snapshot” |
| Store miss | **no stored snapshot for \<SYMBOL\>** | “no options”, “empty chain”, “none for this ticker” as a competing approved empty |
| Capture write failure | **capture skipped — trader path unchanged** (operator log only) | trader-visible error / toast |
| Storage not configured | **capture not storing** | false “stored” success |
| Store read fault | **stored snapshot unreadable: \<reason\>** | “retry from Massive”, “refreshing chain” |
| Lineage wire token | **`live_massive` / `fixture`** on field `source` | treating that token as a Live market badge |
| License | **Our research · not redistributed on a trader route.** | “shareable feed”, “customer export of vendor chain” |

**Hard ban — live-as-market-feed presentation:** on any research-read of a stored snapshot, a Live
badge/chip and any label that means “this quote is live” are **forbidden**. This ban does **not**
forbid the closed lineage wire values `live_massive` or `fixture` on the `source` field (those are
required provenance tokens from `MarketDataSourceKind`). Automated “no `live` token” scans must
carve out that field — failing a test because `source` equals `live_massive` is a false failure.

**Mandatory research-read order (CLI / ops print before any chain dump) — hit only:**

1. `RESEARCH READ — STORED CHAIN SNAPSHOT`
2. Identity: symbol · **captured at** UTC · store identity · lineage `source`
3. `loaded from store · no vendor call`
4. Is / is-not block (stored paid book; **not** Massive PIT hist-chain; **not** structure history;
   **not** scan_bundles; **not** a trader market view)
5. Payload confirmation
6. `Our research · not redistributed on a trader route.`

**Miss (list empty or load 404):** print/return the closed `detail` only — do **not** emit line 1
`RESEARCH READ — STORED CHAIN SNAPSHOT` when no row exists. List miss framing constant (if present)
is `RESEARCH READ — NO STORED SNAPSHOT`.

## 5. Error handling

| Class | Operator / research sees | Trader sees | Log / retry |
|---|---|---|---|
| Capture serialize/write fail | Count unchanged; operator log `capture skipped — trader path unchanged` | Nothing new | Log + drop; no retry storm on the request path |
| Storage not configured | **`capture not storing`** · no false stored success · research may expose `store=error` + that `detail` | Desk up | Honest operator signal; no invented blob |
| Research miss (list or load) | `detail: no stored snapshot for <SYMBOL>` · `store=miss` · `vendor_called=false` | N/A | No vendor retry |
| Research store error | `detail: stored snapshot unreadable: <reason>` · `store=error` · `vendor_called=false` | N/A | No Massive fallback |
| Upstream vendor fail / cache hit | No invented blob | Existing desk behavior | No capture |
| Retention prune | Identity becomes miss under the single miss string | N/A | Prune failure does not fail append |
| Exact `(symbol, as_of)` rewrite | No second row for the **same** identity; not reported as interval-thin skip | Unchanged | Idempotent conflict no-op only |

Research-read **offline/error is not a license to hit Massive**. Missing stays missing.

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/chain-snapshot-capture/INTERFACE_CONTRACT.md`

**Summary:** This feature **adds** backend surface — an append-only capture side-store (write is
off-path, not a trader route) plus operator/research **list** and **load** under
`/api/_research/chain-snapshots/...` (Railway-direct; Pages trader origin 404s the prefix). It is
**not** `NO_BACKEND_CHANGE`. No Massive hist-chain endpoints. No capture on trader routes.
Transport/bytes are authoritative in the interface file (**T3**); this section does not restate
field lists.
<!-- spire:council-resolution:v1 5e9322d5f1d127dd7ebdcdaf1fa5f861c6b1677be722636b080087a1855ba8a2 folded -->

## 7. Testing strategy

**Automate (silent-regression class):**

- Two fresh-vendor cycles on an in-scope producer → wait for append completion → append count + both
  identities loadable inside policy; cycle-2 must not clobber cycle-1.
- Force capture write failure → desk still 200 / scan ok; count unchanged.
- List + load with vendor-call counter / `vendor_called` stuck at false (including miss).
- List miss (`ZZZZNOPE` / empty ticker): `store=miss` and `detail` exactly
  `no stored snapshot for <SYMBOL>`.
- Load hit body: typed `market` (+ ATM/phase/contracts) and typed bar/trade arrays (AC-3).
- Cache-hit cycle → no blob invented; no extra Massive fetch.
- Dual retention: age eviction and count-cap eviction leave policy-compliant rows; never
  latest-wins collapse while younger history remains.
- Score / tier / fingerprint byte-identity with capture on/off and write ok/fail.
- Secrets scan of serialized blobs (no `apiKey` / env leakage).
- Structural absence of capture chrome on trader routes (`apps/dashboard` empty-diff / affordance
  scan).
- Pages edge: `/api/_research` (and subpaths) 404 on the trader origin, matching `_metrics`.
- Research-read framing invariants: no Live badge / no live-as-market-feed label; closed
  `source: live_massive|fixture` **carved out**; closed miss string; store-error `detail` without
  vendor recovery; empty-list does not claim STORED CHAIN SNAPSHOT.
- `as_of` sub-second: two distinct paid fetches inside one UTC second both listable when inside
  policy.

**Review:**

- P3 not absorbed; operator path exists without trader UI; sweep-only multi-ticker framing.

**Integration shape:** one harness that covers append → await completion → list → load hit →
force-fail write → list/load miss, preferring store-level + HTTP research routes over per-AC
theater. FE tiers are N/A (`NO_UI_CHANGE`); any dashboard check is structural absence only.

## 8. Guardrails this feature must not break

- **`[operator-vs-trader-path-separation]`** (HARD) — capture/read is research; unlinked from trader
  UI; no vendor fetch on an operator read of stored blobs; no redistribution on trader routes;
  Pages origin 404s `/api/_research/*` like `/api/_metrics`.
- **`[best-effort-isolated-or-null]`** — capture write failure never fails bundle / scan / SSE.
- **`[additive-keeps-score-byte-identical]`** — blobs are never a scoring input.
- **`[no-secrets-in-image]`** — no key in stored JSON (and no secret in build artifacts).
- **`[cited-code-is-verified-not-assumed]`** — cite live Rust `live.rs` / `massive/rest.rs` /
  `scan_structure_history` / `scan_bundles` ON CONFLICT symbol / `warmer.rs` exclusion — not
  Python `scanstore`.
- **`[single-ticker-on-demand]` (narrowed)** — request path stays one ticker; multi-ticker capture
  only on the existing sweep worker.
- **Massive license** — stored snapshots are our research, never redistributed on a trader route.
- **`[absent-is-not-none]`** — store miss ≠ empty chain book; closed miss vocabulary on list and load.
- **`[single-motion-moment]` / `[theme-token-discipline]`** — no new motion or tokens (`NO_UI_CHANGE`).

## 9. Open questions

None. All R3 product calls (**D1**, **D-ret**, **D-copy**) and technical folds (**T1**–**T3**) are
settled. Serve-path capture is in scope under the off-path spawn rule (AC-2). Warmer /
`refresh_analytics` is an explicit exclusion this ship (§2.3), not an open product call. v1 uses a
single miss string (no store-vouched prune-vs-never distinction). Retention numeric defaults are
architect-named in §2.4; revisiting them (including warmer capture) is GATE Z, not an open council
question.

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"source":"R2-architect.md","index":0,"conflict_id":"18414e85c4d01e6b1aa0185d0aa136f7640ee7779a22019a1d51efb9107ca752","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":1,"conflict_id":"ccc9fc0a570f28b70558fb227f359ce1e818c790453d9b740f3dbf56d61c44da","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":0,"conflict_id":"4f26c095410a75c60462f59bf0d3cffc704fd0824a2c58c3ec3202c44d9e8c8c","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":1,"conflict_id":"5b58c3634615a52d3611d0d48fdbfa196f2baa34d928f4fc2cf8bef82136fa79","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":2,"conflict_id":"66ce89ed30e5033f2efa693cb6f12f5ff01edd8aed0ed22ce2e0ed76fa3fb60f","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":3,"conflict_id":"0ff2384466076a4b23bfb0dae68bf57eb1901231c7b19edd447d2c0814cb8f0d","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":0,"conflict_id":"200df8d4e93023cccff67dacbbc22e00b305fcfccff849e4dd5cac962d590b1a","disposition":"folded","section":"§3"},{"source":"R2-ux.md","index":1,"conflict_id":"b9b5ba17dac09e5aabf852432306843657565771b4926dd043fa7d86af4adc3e","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":2,"conflict_id":"8c938b8bd1495576813a103432d517ba23ec7cd807412d33b032ab87f2b255c2","disposition":"folded","section":"§3"},{"source":"R2-ux.md","index":3,"conflict_id":"5e9322d5f1d127dd7ebdcdaf1fa5f861c6b1677be722636b080087a1855ba8a2","disposition":"folded","section":"§6"},{"source":"R2-ux.md","index":4,"conflict_id":"7a522d83fd466a4457dcf3a12fe279d1ee6253349c2540afb19f028ef863ad24","disposition":"folded","section":"§2"}]}
-->
