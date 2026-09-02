# archive-coverage-guardrails — brief
Goal:            Make a missing or unreadable **SPY / QQQ / IWM** session book
                 visible the **same ET day it is missing**, instead of discovering
                 it after the 48-slot ring has pruned the only copy. Production
                 already stores prune-proof `(symbol, et_date)` books; it does
                 not say which expected weekday identities are present, missing,
                 or unreadable, and write failures can log thousands of times
                 without one checkpoint signal. This feature adds a **read-only
                 coverage matrix + one structured warning per symbol/session
                 after a locked ET checkpoint + a local audit command that
                 exits non-zero** on a hole. It does **not** fetch Massive, fill
                 gaps with reconstructed history, change live scoring, tape
                 SSE ticks, add a trader UI, or move bodies to object storage.

Decision impact: Whether the operator notices a lost **$199 Options** day
                 **before prune deletes the ring copy**. Observed by: on an
                 eligible ET weekday after the checkpoint, each of
                 `ENSURE_SYMBOLS` (SPY, QQQ, IWM) is classified
                 `present` | `missing` | `unreadable` with last readable
                 identity when any; a missing/unreadable row produces
                 **exactly one** structured warning for that `(symbol, et_date)`
                 (not a permission-denied flood); `cargo run -p api-rust --
                 archive-coverage` (council may rename) prints the same matrix
                 and exits **non-zero** iff any expected identity is missing or
                 unreadable; a reconstructed/flat-file artifact is **never**
                 inserted as `live_massive`. Pages trader origin still 404s
                 `/api/_research`. Zero Massive on the coverage path.

Feasibility:     pass — code-grounded 2026-08-29: session archive
                 `list`/`load` already exist
                 (`apps/api/src/services/session_chain_archive/store.rs`);
                 liquid-name set is `ENSURE_SYMBOLS = SPY, QQQ, IWM` with
                 `is_et_weekday` (`ensure.rs`); research list/load is
                 token-gated, zero-vendor
                 (`routes/research_session_books.rs`); operator metrics
                 already live at `GET /api/_metrics` (`routes/health.rs`);
                 clap research commands already sit on `main.rs` `Commands`.
                 2026-08-26 production audit: 7/9 expected books; SPY 24–25
                 unrecoverable (Plan History N/A on Massive chain snapshot).
                 Council locks: expected-identity rule (weekdays only, seed
                 fixture excluded), ET checkpoint clock, warning identity
                 (one per `(symbol, et_date)`), audit command name, whether
                 coverage rides `_metrics` vs a sibling `_research` read
                 (both must stay operator-token, zero Massive, unlinked from
                 trader UI).

Effort:          S–M  (coverage derive + one warning + CLI; no trader UI;
                 no new vendor)

Invariant watch: `operator-vs-trader-path-separation` (**HARD** — coverage is
                 operator/research; unlinked from trader UI; no vendor fetch
                 on a coverage read) · `best-effort-isolated-or-null`
                 (coverage/warning failure never fails bundle / scan / SSE /
                 ensure) · `additive-keeps-score-byte-identical` (coverage is
                 never a scoring input) · `absent-is-not-none` (`missing` ≠
                 `unreadable` ≠ disabled store ≠ weekend ineligible) ·
                 `no-secrets-in-image` · `cited-code-is-verified-not-assumed`
                 (cite live Rust above — not Python, not the 26 Aug prose
                 as an oracle) · `structural-over-prose-enforcement` (a test
                 that a missing expected book fails the audit command; a
                 reconstructed body must not count as `present` /
                 `live_massive`) · `local-evidence-is-not-hosted-evidence`
                 (a local audit receipt is not production coverage) ·
                 Massive license: stored books remain **our research**, never
                 redistributed on a trader route

Context tags:    backend,architecture,observability,decisions

Source:          Owner `go` 2026-08-29 after deep-research harvest
                 (`docs/briefings/product-roadmap-2026-08-28.html` +
                 `docs/research/ARCHIVE_COVERAGE_AUDIT_2026-08-26.md` +
                 `docs/briefings/options-snapshot-change-2026-08-28.html`).
                 Harvest default if `go` unnamed: this item, then tape/replay.
                 keep-paid-books #5 wait is a clock, not a build.

Considered:      archive-coverage-guardrails (CHOSEN — only item whose failure
                 is “we paid for Tuesday’s book and learned it was gone after
                 prune”; 26 Aug audit already specified the slice; owner `go`
                 default) ·
                 session-day-tape-capture (culled this gate: sequencing not
                 merit — the insurance day is worthless if we still lose days
                 silently; do not bundle with coverage) ·
                 day-replay-mock-adapter (blocked-on a captured tape + this
                 coverage so replay is not certified on a hole) ·
                 massive-flat-file-keep (culled: tape reconstruction, not
                 same-day missing-book detection; never fake `live_massive`) ·
                 research-lab-surface (culled: visibility of the lab, not
                 the silent-loss alarm) ·
                 grounded-morning-snapshot (culled: later; cited AI on data
                 we already have) ·
                 remote-archive-body-store (parked — production-maturity #6,
                 next **in that program**; insurance for body location, not
                 coverage honesty) ·
                 telemetry-slos (parked — production-maturity #7, after #6) ·
                 supply-chain-automation (blocked, not re-chosen — live GATE Q
                 FAIL: historical secret, RUSTSEC-2024-0436, hosted evidence) ·
                 session-corpus-wait (not a build — reliable clock 2026-08-26;
                 4–6 ET weeks not elapsed) ·
                 ai-rec-lab-p4 (blocked-on #5 clock + boring P2–P3) ·
                 score-lab-b0b-outcomes (blocked-on MASSIVE_API_KEY in the
                 build env; never synthesise outcomes) ·
                 x1-snaptrade-readonly (parked — explicit product go, not this
                 drain) ·
                 squeeze-scanner / news-terminal / benzinga-earnings / RL-on-score
                 / P7 hist-chain / public-SaaS (culled — harvest parked cluster;
                 decision-impact fails or extra product line) ·
                 Kubernetes/Kafka/service-mesh/GraphQL/microservices (culled —
                 production-maturity forbids without a measured bottleneck and
                 a separate owner decision)
