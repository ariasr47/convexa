# day-replay-mock-adapter — brief
Goal:            Play a **captured session day** for SPY / QQQ / IWM through
                 the **same ticker live path** the desk already uses, so a
                 cancelled Massive feed does not leave Tuesday as a frozen
                 snapshot. Production already stores an open-to-close research
                 tape (Path-A trades+quotes + Path-B 5-minute structure).
                 `MarketDataPort::Fixture` already resolves a frozen
                 `VendorBundle` at `as_of` — that is **not** a clock. This
                 feature adds a **replay adapter** that emits stored Path-A
                 ticks (and periodic Path-B structure) on the existing SSE /
                 price-hub contract at original timestamps or a locked speed
                 multiplier. It does **not** fetch Massive, download S3 files,
                 change live scoring, insert tape as `LiveMassive`, or add a
                 second live UI path.

Decision impact: Whether, after Massive is cancelled, the operator can **walk
                 Tuesday on the ticker as if the clock were running** — not
                 only load a JSON tape or replay scores in `batch-backtest`.
                 Observed by: for a named locked-watchlist `(symbol, et_date)`
                 with a stored tape, the ticker’s existing live contract
                 receives Path-A trade/quote events in time order and Path-B
                 structure at the stored 5-minute marks; copy/provenance never
                 says `live` / `live_massive`; production serve without an
                 explicit replay arm still talks to Massive; score/tier/
                 fingerprint stay the live formula on replayed inputs
                 (`Authorizes: nothing` on changing the formula). A missing
                 tape is an honest miss, not a fabricated day.

Feasibility:     pass — code-grounded 2026-08-30: tape list/load
                 `GET /api/_research/session-day-tape/{symbol}` + `/day`
                 (`routes/research_session_day_tape.rs`); store
                 `services/day_tape/`; Path-A sidecar
                 `day_tape/path_a.rs` on `StockStreamHub.subscribe_events`;
                 Path-B persist in `refresh_analytics` (`path_b.rs`);
                 `MarketDataPort::{Live, Fixture}` in
                 `services/market_data/mod.rs` — Fixture is nearest frozen
                 sample ≤ `as_of`, not a clock; hub
                 `harness_local()` + `publish_event` already used by the
                 capacity harness (`infrastructure/massive/ws.rs`); ticker
                 SSE `routes/stream.rs` consumes hub events into
                 `PriceCache`. Council locks: replay arm vs new port kind;
                 original timestamps vs speed multiplier; operator-only
                 vs trader ticker (same SSE, honest not-live copy);
                 production default remains Live Massive; missing-tape
                 occupancy.

Effort:          M  (replay clock + hub emit + existing ticker consume;
                 no second live path; no new vendor)

Invariant watch: `present-is-live-paid-only` (**HARD** — replayed tape is
                 never a `LiveMassive` session book) ·
                 `operator-vs-trader-path-separation` (research tape read
                 stays `_research`; replay **may** feed the existing ticker
                 SSE but must not pretend the feed is live Massive) ·
                 `live-vs-static-isolation` (replay ticks declare
                 live-derived-from-tape vs static bundle; drop/end-of-tape
                 degrades honestly) · `best-effort-isolated-or-null`
                 (replay fault never 5xx the desk’s live path) ·
                 `additive-keeps-score-byte-identical` (replay does not
                 change the scoring formula; `Authorizes: nothing`) ·
                 `production-fails-closed` (production construct does not
                 silently become replay) · `absent-is-not-none` (no tape ≠
                 empty tape ≠ live Massive) · `no-secrets-in-image` ·
                 `cited-code-is-verified-not-assumed` (cite live tape +
                 Fixture + hub above — not Python, not briefing HTML) ·
                 `structural-over-prose-enforcement` (poison: replay
                 cannot `insert_if_absent` as LiveMassive; production Live
                 port still used when replay unset) ·
                 `local-evidence-is-not-hosted-evidence` ·
                 `single-ticker-on-demand` (replay still one ticker on the
                 request path) · Massive license: replayed ticks remain
                 **our research**, never redistributed as a live vendor feed

Context tags:    backend,architecture,frontend,observability,decisions

Source:          Owner `go` 2026-08-30 after `session-day-tape-capture`
                 GATE S. Harvest default if `go` unnamed: this item, then
                 S3 flat-file keep. Evidence:
                 `docs/briefings/product-roadmap-2026-08-28.html`.
                 keep-paid-books #5 wait is a clock, not a build.

Considered:      day-replay-mock-adapter (CHOSEN — tape now exists; only
                 item whose failure is “we saved Tuesday and still cannot
                 walk it as a day”; owner unnamed-`go` harvest default;
                 Fixture is not a clock; do not bundle S3) ·
                 massive-flat-file-keep (culled this gate: next-day ~11:00
                 ET S3 reconstructs **price/quote history**, not same-day
                 greeks; sequencing after a clock exists; never fake
                 `live_massive`) ·
                 research-lab-surface (culled: seeing the corpus is not
                 playing the day on the ticker) ·
                 grounded-morning-snapshot (culled: later; cited AI on
                 data we already have) ·
                 remote-archive-body-store (parked — production-maturity
                 #6, next **in that program**; body location, not a clock) ·
                 telemetry-slos (parked — production-maturity #7, after
                 #6) ·
                 supply-chain-automation (blocked, not re-chosen — live
                 GATE Q FAIL: historical secret, RUSTSEC-2024-0436, hosted
                 evidence) ·
                 session-corpus-wait (not a build — reliable clock
                 2026-08-26; 4–6 ET weeks not elapsed) ·
                 ai-rec-lab-p4 (blocked-on #5 clock + boring P2–P3) ·
                 session-day-tape-capture (already SHIPPED 2026-08-30) ·
                 archive-coverage-guardrails (already SHIPPED 2026-08-29) ·
                 x1-snaptrade-readonly (parked — explicit product go, not
                 this drain) ·
                 squeeze-scanner / news-terminal / benzinga-earnings /
                 RL-on-score / P7 hist-chain / public-SaaS (culled —
                 harvest parked cluster) ·
                 Kubernetes/Kafka/service-mesh/GraphQL/microservices
                 (culled — production-maturity forbids without a measured
                 bottleneck and a separate owner decision)
