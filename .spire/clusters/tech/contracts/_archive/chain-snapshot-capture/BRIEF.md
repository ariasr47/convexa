# chain-snapshot-capture — brief
Goal:            Keep the Massive options chain (and the stock bars we already pull with it)
                 after we pay to fetch them, so research can replay our compute later without
                 another vendor call. Today the scanner writes a **digested** structure row
                 (`scan_structure_history`: score, walls, flip, net GEX, IV/HV) and a
                 **latest-wins** `scan_bundles` cache (one row per symbol, overwritten). The
                 live `VendorBundle` from `market_data/live.rs` (options snapshot + daily
                 bars + minutes + trades) is then discarded. This feature appends those
                 already-fetched snapshots off the trader request path. It does **not** buy
                 a new Massive product, invent historical-chain endpoints, or put a capture
                 surface on the trader UI.

Decision impact: Whether we can later measure if the score / structure / AI rec was any
                 good on the **exact book we already paid for**. Observed by: after a
                 successful scan (or serve) cycle, a dated raw snapshot exists for that
                 ticker and can be loaded with **no live Massive call**; a second cycle
                 does not erase the first. Paying $199+$199/mo without this means the
                 Options snapshot evaporates after one request.

Feasibility:     pass for persist-what-we-already-fetch (write-through / side-store, bounded
                 retention). **Blocked-on extra spend / not this feature:** Massive
                 point-in-time historical options chains, historical IV, indices (VIX/SPX),
                 Benzinga earnings — owner already holds top Stocks + Options personal
                 plans; those are different product lines. Architect names storage +
                 retention + identity (do **not** overload `scan_bundles` PK `symbol`).
                 Capture must not add vendor fetches and must not sit on the ticker
                 request path.

Effort:          M  (side-store + append identity + retention + research read; no trader UI)

Invariant watch: `operator-vs-trader-path-separation` (**HARD** — capture/read is research;
                 unlinked from trader UI; no vendor fetch on an operator read of stored
                 blobs) · `best-effort-isolated-or-null` (a capture write failure never
                 fails bundle / scan / SSE) · `additive-keeps-score-byte-identical`
                 (blobs are never a scoring input) · `no-secrets-in-image` (no key in
                 stored JSON) · `cited-code-is-verified-not-assumed` (cite live Rust
                 `live.rs` / `massive/rest.rs` / `scan_structure_history` /
                 `scan_bundles` ON CONFLICT symbol — not Python `scanstore`) ·
                 `single-ticker-on-demand` narrowed form (request path stays one ticker;
                 multi-ticker capture only on the existing sweep worker) · Massive
                 license: stored snapshots are **our research**, never redistributed on a
                 trader route

Context tags:    backend,architecture,decisions

Source:          Owner 2026-08-18 after `ai-providers` ship — cannot sustain $199 Stocks +
                 $199 Options/mo unless we keep what those calls already return. Extends
                 shipped P0 capture spine (`docs/RESEARCH_CAPTURE_P0.md` leftover:
                 "Object-store chain blobs") and `SYSTEM_DESIGN_AND_BACKTEST.html` §11–12
                 ("Capture daily/slow-lane now"; P3 batch CLI waits on this).

Considered:      chain-snapshot-capture (CHOSEN — owner-named; the only item whose failure
                 is throwing away a paid Options snapshot after one request) ·
                 batch-backtest-cli / P3 (culled: blocked-on this — nothing durable to
                 replay) ·
                 vendor-hist-chain / P7 (culled: blocked-on extra Massive product; paying
                 more on Stocks/Options does not buy it) ·
                 project-context-s2-is-python-era (culled: system-of-building **N/A** —
                 unpaid; this BRIEF already cites live Rust) ·
                 degradation-visibility (culled: decision-impact **N/A**) ·
                 sse-connection-ceiling (culled: availability **N/A**)
