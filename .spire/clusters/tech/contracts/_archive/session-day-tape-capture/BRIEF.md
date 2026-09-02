# session-day-tape-capture — brief
Goal:            Persist a **replayable open-to-close day** for a **closed
                 watchlist**: append-only Path-A stock ticks that today hit
                 `PriceCache` and die, plus timed Path-B options-structure
                 snapshots the warmer already fetches and **drops**. Production
                 already keeps one first-wins session book per ET day (often
                 midnight start-of-day) and a 48/14d ring of cold/scanner
                 captures; it does **not** keep the intraday stream. This
                 feature adds a **research tape store** so a cancelled Massive
                 subscription does not erase Tuesday. It does **not** play the
                 tape back into the ticker page, download S3 flat files, change
                 live scoring, insert reconstructions as `LiveMassive`, add a
                 trader UI, or move session-archive bodies.

Decision impact: Whether, after Massive is cancelled, the operator still has
                 Tuesday’s **price tape + periodic GEX structure** for the
                 watchlist — not only a start-of-day session book. Observed by:
                 for each locked watchlist symbol on an ET weekday, Path-A
                 `StreamEvent`s (stocks WS, not OPRA) append to a day tape
                 instead of only latest-wins `price:{SYM}`; Path-B
                 `VendorBundle`s persist at a locked interval with provenance
                 that is **not** `live_massive`; tape write failure leaves
                 bundle / scan / SSE / ensure intact; Pages trader origin still
                 404s `/api/_research`; coverage holes stay holes (this slice
                 does not fill session-archive identities). `Authorizes:
                 nothing` on live score.

Feasibility:     pass — code-grounded 2026-08-29: Path A is Massive stocks WS
                 → `StockStreamHub` (`infrastructure/massive/ws.rs`, one
                 socket, `subscribe_events()` broadcast cap 4096) →
                 `PriceCache.set_price` latest-wins
                 (`services/price_stream.rs`); Path B warmer calls
                 `refresh_analytics` every `WARM_INTERVAL_SECS` **default 25**
                 (`config.rs`) and **intentionally drops** `_vendor`
                 (`analytics.rs` “warmer / refresh_analytics must not
                 capture”); `spawn_capture` is only ticker-cold /
                 `load_or_compute` miss / scanner slow-lane
                 (`chain_snapshot/capture.rs`); session archive is first-wins
                 `(symbol, et_date)` (`session_chain_archive/`);
                 `ENSURE_SYMBOLS` = SPY, QQQ, IWM (`ensure.rs`);
                 `MarketDataPort::Fixture` is a frozen `VendorBundle` at
                 `as_of`, not a clock (`market_data/mod.rs`). QQQ/IWM 24–26
                 Aug session books had **0 trades** (first-wins start-of-day).
                 Council locks: closed watchlist (do not default to
                 `WARM_SYMBOLS` / universe); Path-A sidecar vs second socket;
                 Path-B cadence (downsample warmer `_vendor` vs new REST);
                 trades vs quotes volume; tape-store identity (not session
                 archive, not 48/14d ring); provenance enum (never
                 `LiveMassive`).

Effort:          M  (Path-A sidecar + Path-B downsample persist + research
                 list/load; no trader UI; no new vendor product)

Invariant watch: `operator-vs-trader-path-separation` (**HARD** — tape is
                 research; trader SSE unchanged; no extra vendor fetch on a
                 tape **read**) · `best-effort-isolated-or-null` (tape write
                 failure never fails bundle / scan / SSE / ensure) ·
                 `additive-keeps-score-byte-identical` (tape is never a
                 scoring input) · `live-vs-static-isolation` (sidecar must
                 not dim or blank live ticks) · `present-is-live-paid-only`
                 (tape / reconstructed occupants are never `present`
                 `LiveMassive` session books) · `absent-is-not-none`
                 (no-ticks ≠ not-storing ≠ unreadable ≠ coverage missing) ·
                 `no-secrets-in-image` · `cited-code-is-verified-not-assumed`
                 (cite live Rust above — not Python, not briefing HTML as an
                 oracle) · `structural-over-prose-enforcement` (poison:
                 warmer still must not `spawn_capture` into the 48/14d ring;
                 tape must not `insert_if_absent` as LiveMassive) ·
                 `local-evidence-is-not-hosted-evidence` ·
                 `single-ticker-on-demand` (capture is off the trader
                 request path) ·
                 Massive license: stored ticks/snapshots remain **our
                 research**, never redistributed on a trader route; this is
                 the stocks WS + paid REST we already fetch, **not** OPRA
                 options-quote flat files

Context tags:    backend,architecture,observability,decisions

Source:          Owner `go` 2026-08-29 after `archive-coverage-guardrails`
                 GATE S. Harvest default if `go` unnamed: this item, then
                 day-replay. Evidence:
                 `docs/briefings/product-roadmap-2026-08-28.html` +
                 `docs/briefings/options-snapshot-change-2026-08-28.html`.
                 keep-paid-books #5 wait is a clock, not a build.

Considered:      session-day-tape-capture (CHOSEN — only item whose failure
                 is “Massive cancelled and Tuesday’s open-to-close is gone”;
                 coverage now shipped so a later replay is not certified on
                 a silent hole; owner unnamed-`go` harvest default) ·
                 day-replay-mock-adapter (blocked-on this tape — Fixture
                 already freezes a snapshot, which is not a clock; do not
                 bundle) ·
                 massive-flat-file-keep (culled this gate: next-day ~11:00
                 ET S3 reconstructs **price/quote history**, not same-day
                 greeks/IV/OI; OPRA quote files are not this slice; never
                 fake `live_massive`) ·
                 research-lab-surface (culled: visibility of the lab, not
                 capturing the day) ·
                 grounded-morning-snapshot (culled: later; cited AI on data
                 we already have) ·
                 remote-archive-body-store (parked — production-maturity #6,
                 next **in that program**; insurance for body location, not
                 a replayable day) ·
                 telemetry-slos (parked — production-maturity #7, after #6) ·
                 supply-chain-automation (blocked, not re-chosen — live
                 GATE Q FAIL: historical secret, RUSTSEC-2024-0436, hosted
                 evidence) ·
                 session-corpus-wait (not a build — reliable clock
                 2026-08-26; 4–6 ET weeks not elapsed) ·
                 ai-rec-lab-p4 (blocked-on #5 clock + boring P2–P3) ·
                 archive-coverage-guardrails (already SHIPPED 2026-08-29) ·
                 x1-snaptrade-readonly (parked — explicit product go, not
                 this drain) ·
                 squeeze-scanner / news-terminal / benzinga-earnings /
                 RL-on-score / P7 hist-chain / public-SaaS (culled —
                 harvest parked cluster) ·
                 Kubernetes/Kafka/service-mesh/GraphQL/microservices
                 (culled — production-maturity forbids without a measured
                 bottleneck and a separate owner decision)
