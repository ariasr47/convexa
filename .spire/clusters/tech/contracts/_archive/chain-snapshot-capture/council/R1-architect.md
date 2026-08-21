# R1 — architect position: chain-snapshot-capture

## Position

### Goal (technical)

Keep the already-fetched live `VendorBundle` after a paid Massive cycle so research can later rebuild analytics with **zero** new vendor I/O. Today the scanner persists a digested `StructureSample` into `scan_structure_history` and exposes a latest-wins `scan_bundles` table (`ON CONFLICT (symbol)`), while `compute_analytics` builds a `VendorBundle` and drops it when the function returns. This feature adds an **append-only raw-snapshot side-store** beside those surfaces — it does not replace them.

### Binding constraints (restated)

- **`[operator-vs-trader-path-separation]`** — capture write and stored-blob read are research/operator. They stay unlinked from trader UI. A stored-blob read must not call Massive (`massive/rest.rs` fetch paths stay cold).
- **`[best-effort-isolated-or-null]`** — a capture write failure never fails bundle / scan / SSE. Mechanism: fire-and-forget task after the trader path already holds its `AnalyticsSnapshot` / scan row; errors inside the task log and return; the request/sweep task never joins the write for success.
- **`[additive-keeps-score-byte-identical]`** — stored blobs are never a scoring input. Mechanism: one-way leaf module boundary — `signals` / score / fingerprint / gate code never imports the capture store; capture receives a clone of an already-built `VendorBundle`, never feeds back into `compute_analytics_from_vendor` on the live path.
- **`[no-secrets-in-image]` / no secrets in stored JSON** — persist only already-parsed domain structs (`OptionsMarketState`, bars, trades, `as_of`, `source`). Never persist request URLs, `apiKey` query fragments, env, or client config. `massive/rest.rs` injects `apiKey` into HTTP URLs; that string must not cross the serialize boundary.
- **`[cited-code-is-verified-not-assumed]`** — cite live Rust only: `market_data/live.rs` (`LiveMarketData::resolve` joins options + daily + minutes + trades into `VendorBundle`), `massive/rest.rs` (`fetch_options_market_state` and companions), `scan_structure_history` (append + ring prune), `scan_bundles` (`ON CONFLICT (symbol)` latest-wins — **not** a history). Do not cite Python `scanstore`.
- **`[single-ticker-on-demand]` (narrowed)** — request path stays one ticker; multi-ticker capture rides only the existing sweep worker’s already-fetched cycles.
- **Massive license** — stored snapshots are our research corpus; never redistribute raw blobs on a trader route.
- **BRIEF hard scope** — persist what we already fetch; no new Massive product; no hist-chain invention; trader UI out of scope.

### Data-structure content

**Unit of capture = one `VendorBundle` already materialized this cycle**, not a digested score row and not a raw HTTP body.

Content (domain, not wire names):

| Part | Source (verified) | Role |
| --- | --- | --- |
| symbol | `VendorBundle.symbol` / `OptionsMarketState.ticker` | identity |
| as_of | `VendorBundle.as_of` (`Utc::now()` in `live.rs` / `compute_analytics`) | identity + replay clock |
| source | `MarketDataSourceKind` (`LiveMassive` \| `Fixture`) | lineage |
| market | `OptionsMarketState` (spots, ATM IV metadata, phase, full `contracts[]`) | required for GEX replay |
| daily_bars | best-effort vec from the same parallel fetch | HV / context replay |
| minutes | best-effort vec | VWAP replay |
| trades | best-effort vec (may be empty when dark-pool off) | dark-pool replay when present |

**Identity mechanism:** composite key **`(symbol, as_of)`** (symbol upper/trim-normalized like structure history). A second successful fetch gets a new `as_of` and therefore a new row — it must not erase the first. **Do not overload `scan_bundles` PK `symbol`.** That table is latest-wins by construction (`INSERT … ON CONFLICT (symbol) DO UPDATE`); treating it as history would silently destroy prior paid snapshots.

**Optional lineage link (non-scoring):** when a `StructureSample` is appended in the same slow-lane success, research may join sample ↔ blob by matching `(symbol, as_of)` clocks. The blob is not an input to the sample, and the sample is not required for blob durability.

**Serialization mechanism:** `VendorBundle` itself does not derive `Serialize` today; fixtures already round-trip the same payload via `OptionsMarketState` + `DailyBarWire` / `IntradayBarWire` / `TradePrintWire` + `Contract`. Capture uses that **parsed-domain → capture wire → bytes** path (symmetric to fixture load), so replay rebuilds a `VendorBundle` and calls existing `compute_analytics_from_vendor` with **no network**.

### Storage shape (chosen)

**Chosen: append-only side-store with dual backend parity to `ScanStore` (JSON-on-disk local / Postgres when `DATABASE_URL` + postgres feature), keyed by `(symbol, as_of)`, body = opaque serialized capture bytes + small metadata columns needed for list/prune without deserializing the chain.**

Compared options:

| Option | Complexity | Cost | Scalability | Familiarity |
| --- | --- | --- | --- | --- |
| **A. New append table / JSON map `(symbol, as_of)` + blob body** | Low–med | DB/disk under retention | Adequate if retention bounds rows/symbol | **High** (mirrors `pg_scan` / `ScanStore`) |
| B. Object-store files + thin Postgres index (`chain_blob_uri`) | High (new infra) | Better $/GB long-term | Best for multi-MB chains | Low — no object-store code in `apps/api` today |
| C. Overload `scan_bundles` | Low but wrong | — | — | Forbidden by BRIEF / ledger |

**Decisive axes:** team familiarity + complexity under effort **M**, with retention as the cost governor. Object-store (SYSTEM_DESIGN §4.2 / P0 leftover “Object-store chain blobs”) stays a **later swap behind a blob-port** if row size or volume forces it — not v1.

**Explicit non-overload:** `scan_structure_history` stays the digested feature diary (score, walls, flip, net GEX, IV/HV, drivers). Capture does not widen those columns into a chain dump.

### Data-flow + component boundaries

```
Massive REST (already paid this cycle)
    → VendorBundle materialized in compute_analytics / LiveMarketData::resolve consumers
    → Path B: compute_analytics_from_vendor → AnalyticsSnapshot → trader/scan continue unchanged
    → Capture leaf (parallel): clone VendorBundle → enqueue off-path write → side-store append
Research replay:
    side-store load (symbol, as_of) → VendorBundle → compute_analytics_from_vendor
    (MarketDataPort::Fixture remains for hermetic CI; live capture feeds the durable corpus)
```

**Producer rule (load-bearing):** capture runs **only when this cycle already holds a fresh `VendorBundle`** (post-fetch in `compute_analytics`, or an equivalent resolve that did not skip vendor I/O). A `gex_cache` hit that returns an `AnalyticsSnapshot` without rebuilding vendor inputs **does not** capture and **must not** re-fetch to “fill in” a blob. Mechanism: hook at the site where `VendorBundle { … }` is constructed, before it drops out of scope — not at every scan upsert.

**Off request path:** the trader/serve future must not await capture I/O. Mechanism: after snapshot success is assured for the caller, `tokio::spawn` (or an existing bounded worker queue if one is introduced) performs serialize+write; join handles are dropped. Scanner slow-lane already runs off the ticker request path; capture there is still best-effort relative to row upsert + structure append (those remain authoritative for the desk).

**Multi-ticker:** only the existing sweep worker may produce many symbols per cycle; each symbol’s capture is independent and still only on fresh-vendor success.

**Research read boundary:** load APIs / CLIs are operator-research. They reconstruct vendor state and compute offline. They never warm trader caches as a side effect of read, and never call `MassiveRestClient` fetch methods.

### Retention + thinning

Full chains are large; unbounded append would dominate Postgres/disk.

- **Thinning mechanism:** before append, if the newest blob for `symbol` is younger than a configured minimum interval, skip write (same idea as `STRUCTURE_HISTORY_MIN_INTERVAL_SECS` on structure history). Skips are success no-ops, not errors.
- **Retention mechanism:** per-symbol ring (count cap) and/or max-age prune after successful append; prune failure logs and does not fail the append (copy the structure-history prune isolation in `pg_scan.rs`).
- Exact interval/cap numbers are a product dial — see assumptions — but the mechanisms above are required so cost has a named governor.

### Isolation / error rules

| Failure | Observable result |
| --- | --- |
| Serialize / write / prune error | log + drop; trader/scan/SSE unchanged |
| Read miss / corrupt blob | research path gets absent/error for that snapshot only; no vendor fallback fetch on the read path |
| Partial vendor (daily/minutes/trades empty) | still persist if `market` (chain) present — matches live best-effort companions in `live.rs` / `compute_analytics` |
| Cache-hit cycle (no `VendorBundle`) | no blob; no fetch |

### Explicit non-goals

- New Massive historical options / IV / indices products or invented hist-chain endpoints.
- Overloading `scan_bundles` or rewriting `scan_structure_history` into a raw-chain store.
- Trader UI, trader-route redistribution of blobs, or any capture control on ticker/scanner pages.
- Re-fetching Massive to populate capture on cache hits.
- Batch backtest CLI (P3) — blocked-on this corpus, not in scope.
- Object-store infra in v1 (deferred behind a port if retention economics demand it).
- Changing score / tier / fingerprint / gate inputs or outputs.

## Risks I see

1. **Cache-hit gap vs BRIEF wording.** If “successful scan/serve cycle” is read as every desk refresh, cache hits produce no blob under the no-extra-fetch rule. Mechanism conflict must be resolved by defining producers as **fresh-vendor cycles only** — otherwise someone will “fix” it with a forbidden re-fetch.
2. **Blob volume.** Options chains × universe × cadence can overwhelm DB disk faster than structure samples (576-cap ring). Thinning + ring are mandatory; wrong defaults fail operationally, not architecturally.
3. **as_of collision / clock skew.** `as_of = Utc::now()` at build time is wall clock, not vendor `timestamp`. Retries in the same second could `ON CONFLICT DO NOTHING` and look like a silent skip — acceptable if documented; using vendor snapshot timestamp alone is weaker across call/put merge.
4. **Secret leakage via lazy raw dumps.** Persisting vendor HTTP payloads or `next_url` strings would embed `apiKey`. Domain-struct serialize is the enforcement; a “dump the response body” shortcut violates `[no-secrets-in-image]`.
5. **Dual-write drift.** Structure sample append and blob append are separate best-effort leaves; one can succeed without the other. Research joins must tolerate missing blob or missing sample rather than assuming 1:1.
6. **`scan_bundles` confusion.** The table/API shape exists (`BundleBlob`, `write_bundle_blob`) with latest-wins semantics and **no production caller found outside the store**. Engineers may mistakenly wire capture there; the architecture forbids it.

## Assumptions I'm making about the other two lanes

- **PM** will accept “fresh-vendor cycles only” as the producer definition (scanner slow-lane compute miss and/or serve-path cold compute), and will not require a blob on every cache-hit poll.
- **PM** will set the retention dials (min capture interval, per-symbol max blobs and/or max age) as product/cost policy; I only require that those dials exist and are enforced by ring/interval mechanisms.
- **PM** will treat research observability (counts, last capture age, backend kind) as acceptance evidence, analogous to structure-history health — without placing that evidence on a trader route.
- **PM** will keep batch-backtest CLI / hist-chain spend out of this feature’s acceptance bar (blocked-on / culled per BRIEF).
- **UX** will not introduce a trader-facing capture surface; any human readout stays operator/research (or CLI-only), preserving `[operator-vs-trader-path-separation]`.
- **UX / Interface (later)** will name any research read transport and bytes shape; this position intentionally omits endpoint signatures and JSON field names.
- **UX** will not require the live ticker page to visualize or link stored blobs as part of this feature.
- **Both lanes** will leave score/tier/fingerprint semantics untouched and will not ask capture status to appear inside scoring payloads.
