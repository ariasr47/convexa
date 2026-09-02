# massive-flat-file-keep — brief
Goal:            Download and keep the **S3 flat files the $199+$199
                 already include**, for the locked watchlist **SPY / QQQ /
                 IWM**, so a cancelled Massive feed does not leave days we
                 never taped (or taped incompletely) without a
                 reconstructable **price/quote history**. Vendor files are
                 next-day ~11:00 ET compressed CSVs (stocks trades / quotes
                 / aggregates) on `https://files.massive.com`. This slice
                 stores them as a **provenance-labeled research corpus**.
                 It does **not** reconstruct chain greeks, insert as
                 `LiveMassive`, change live scoring, add a second live UI
                 path, download OPRA/indices/crypto, or convert files into
                 the session-day-tape player this gate.

Decision impact: Whether we **keep the tape the paid plan already
                 entitles** after Massive is cancelled — not only the
                 same-day Path-A sidecar we now capture, and not only a
                 first-wins session book. Observed by: for a named locked-
                 watchlist symbol and a completed ET session date D, after
                 vendor files are published (~11:00 ET the next day), an
                 operator command stores the entitled stocks trades and
                 quotes (aggregates are a council lock) as artifacts whose
                 provenance is **not** `live_massive`; coverage `present`
                 still means a loadable `LiveMassive` book; production
                 serve without this construct still talks to Massive
                 REST/WS; score/tier/fingerprint stay byte-identical
                 (`Authorizes: nothing`). A day not yet published is
                 not-elapsed, not a miss. A missing file after it is due
                 is a miss, not an empty tape.

Feasibility:     pass — code-grounded 2026-08-30: `infrastructure/massive/`
                 is `rest.rs` + `ws.rs` + `market_phase.rs` only (no files
                 client; no `files.massive.com`). REST is
                 `MASSIVE_API_KEY` + `MASSIVE_REST_BASE`
                 (`https://api.massive.com`, `config.rs`).
                 `MassiveRestClient::fetch_recent_trades` is
                 `GET /v3/trades/{ticker}` lookback, **not** a daily S3
                 file. `MarketDataSourceKind` is
                 `{LiveMassive, Fixture, SessionTape}`
                 (`market_data/mod.rs`) — no flat-file kind.
                 `insert_if_absent` + coverage `present` = loadable
                 `LiveMassive` only. Tape root
                 `SESSION_DAY_TAPE_BODY_ROOT` collides with ring / archive
                 index / archive body (`tape_root_conflicts` in
                 `config.rs`). Watchlist
                 `TAPE_WATCHLIST` / `ENSURE_SYMBOLS` = SPY, QQQ, IWM
                 (`day_tape/watchlist.rs`, `ensure.rs`). Tape CLI
                 standing: “not OPRA options-quote flat files; not S3
                 hist-chain.” Pages still 404s `/api/_research`
                 (`functions/api/[[path]].ts`). Replay
                 (`session-day-replay`) walks the **day_tape store**, not
                 gzip CSV. `apps/api/Cargo.toml` has reqwest, no AWS S3
                 SDK. Vendor docs (not in-repo; 2026-08-30
                 `massive.com/docs/flat-files/quickstart`): S3-compatible
                 endpoint `https://files.massive.com`, bucket `flatfiles`,
                 prefix e.g. `us_stocks_sip/trades_v1/YYYY/MM/YYYY-MM-DD.csv.gz`;
                 **Access Key + Secret from the Massive dashboard** — a
                 different credential than `MASSIVE_API_KEY`. Files are
                 **universe-per-day**, not per ticker. Chain snapshot Plan
                 History remains not applicable (greeks stay live
                 snapshots). Council locks: stocks SIP trades/quotes vs
                 also aggregates vs OPRA; dedicated body root vs tape
                 root; raw gzip corpus vs convert into Path-A; S3 keys
                 env vs reuse REST key; SigV4/reqwest vs new crate; CLI
                 + `_research` vs trader chrome.

Effort:          M  (S3-compatible fetch + dedicated root + watchlist
                 extract from universe CSV; no new vendor product; no
                 trader UI)

Invariant watch: `present-is-live-paid-only` (**HARD** — reconstructed
                 files never insert as `LiveMassive` / coverage
                 `present`) ·
                 `operator-vs-trader-path-separation` (CLI + `_research`;
                 Pages still 404; no ticker player chrome) ·
                 `additive-keeps-score-byte-identical` (`Authorizes:
                 nothing`) ·
                 `production-fails-closed` (armed download with missing
                 S3 keys / unwritable root refuses; production unset does
                 not fetch files) ·
                 `absent-is-not-none` (not-elapsed ≠ miss ≠ empty extract
                 ≠ unreadable ≠ not-storing ≠ live tape) ·
                 `no-secrets-in-image` (S3 access/secret + REST key never
                 in list/load/CLI) ·
                 `cited-code-is-verified-not-assumed` (cite live massive
                 REST/WS + tape root + source kind above — not briefing
                 HTML, not Python) ·
                 `structural-over-prose-enforcement` (poison:
                 `insert_if_absent` as LiveMassive; reuse tape root;
                 REST apiKey as S3 secret) ·
                 `local-evidence-is-not-hosted-evidence` ·
                 `best-effort-isolated-or-null` (download fault never
                 5xx the desk) ·
                 `single-ticker-on-demand` (fetch is off the trader
                 request path) ·
                 Massive license: kept files are **our research**, never
                 redistributed as a live vendor feed

Context tags:    backend,architecture,observability,decisions

Source:          Owner `go` 2026-08-30 after `day-replay-mock-adapter`
                 GATE S. Harvest default if `go` unnamed: this item.
                 Evidence: `docs/briefings/product-roadmap-2026-08-28.html`
                 + vendor flat-files quickstart (endpoint/bucket/prefix
                 cited above). keep-paid-books #5 wait is a clock, not a
                 build.

Considered:      massive-flat-file-keep (CHOSEN — $199+$199 already
                 includes unlimited file downloads we do not keep;
                 reconstructs price/quote history for days the live tape
                 missed; clock now exists so this is sequenced, not
                 bundled into replay; never fake `live_massive`; owner
                 unnamed-`go` harvest default) ·
                 research-lab-surface (culled this gate: seeing the
                 corpus is not keeping entitled files) ·
                 grounded-morning-snapshot (culled: later; cited AI on
                 data we already have) ·
                 remote-archive-body-store (parked — production-maturity
                 #6, next **in that program**; our object store for
                 session bodies, not `files.massive.com`) ·
                 telemetry-slos (parked — production-maturity #7, after
                 #6) ·
                 supply-chain-automation (blocked, not re-chosen — live
                 GATE Q FAIL: historical secret, RUSTSEC-2024-0436,
                 hosted evidence) ·
                 session-corpus-wait (not a build — reliable clock
                 2026-08-26; 4–6 ET weeks not elapsed) ·
                 ai-rec-lab-p4 (blocked-on #5 clock + boring P2–P3) ·
                 day-replay-mock-adapter (already SHIPPED 2026-08-30) ·
                 session-day-tape-capture (already SHIPPED 2026-08-30) ·
                 archive-coverage-guardrails (already SHIPPED 2026-08-29) ·
                 x1-snaptrade-readonly (parked — explicit product go, not
                 this drain) ·
                 squeeze-scanner / news-terminal / benzinga-earnings /
                 RL-on-score / P7 hist-chain / public-SaaS / indices
                 (`I:VIX`/`I:SPX`) (culled — harvest parked cluster) ·
                 Kubernetes/Kafka/service-mesh/GraphQL/microservices
                 (culled — production-maturity forbids without a measured
                 bottleneck and a separate owner decision)
