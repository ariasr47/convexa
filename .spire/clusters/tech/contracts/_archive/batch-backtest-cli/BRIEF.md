# batch-backtest-cli — brief
Goal:            Replay the paid options books we now keep (`chain-snapshot-capture`) through
                 our own compute, offline, and emit a research report — so the $199+$199/mo
                 Massive subscriptions produce a measurement, not only a live desk. Today
                 `score-lab` ranks the digested structure diary against joined daily bars
                 (P2). It never reloads a stored chain. P3 is the CLI that lists/loads
                 dated snapshots (zero Massive calls) and runs `compute_analytics_from_vendor`
                 on each, with multi-symbol + time-based splits and an artifact report.
                 It does **not** buy hist-chain products, change live scoring, or add a
                 trader UI.

Decision impact: Whether the score / structure / GEX path is any good on the **exact books
                 we already paid for**. Observed by: one CLI run over stored snapshots
                 produces a dated report with **zero live Massive calls**; a second run on
                 the same corpus is byte-identical; turning capture off / empty store is
                 an honest empty, not a silent live fetch.

Feasibility:     pass — `ChainSnapshotStore` + research list/load shipped 2026-08-18;
                 `compute_analytics_from_vendor` and `MarketDataPort::fixture` already
                 exist. **Blocked-on extra spend / not this feature:** vendor hist-chain
                 (P7), historical IV, indices. Architect names CLI flags, split rule, and
                 how this relates to (does not silently replace) `score-lab`. Must not
                 call Massive on replay. Must not sit on the trader request path.

Effort:          M  (research CLI + report + hermetic tests; no trader UI)

Invariant watch: `operator-vs-trader-path-separation` (**HARD** — CLI/research only;
                 unlinked from trader UI; a replay must not trigger a vendor fetch) ·
                 `best-effort-isolated-or-null` (empty/unreadable corpus is honest empty,
                 not an HTTP error on the desk) · `additive-keeps-score-byte-identical`
                 (replay never writes live score/tier/fingerprint) ·
                 `score-change-is-deliberate-and-measured` (a report does **not** authorize
                 a live score change) · `cited-code-is-verified-not-assumed` (cite live
                 `chain_snapshot/`, `compute_analytics_from_vendor`, `cmd_score_lab` —
                 not Python) · `no-secrets-in-image` · `absent-is-not-none` (no snapshot
                 ≠ empty book ≠ replay error) · Massive license: replay is **our research**,
                 never a trader feed

Context tags:    backend,architecture,decisions

Source:          Owner `go` 2026-08-18 after `chain-snapshot-capture` ship — that feature
                 existed so these subscriptions are not wasted. Design doc
                 `docs/SYSTEM_DESIGN_AND_BACKTEST.html` §12 P3: “Replay from capture;
                 multi-symbol; artifact reports; time-based splits.” Unblocked at that
                 GATE S.

Considered:      batch-backtest-cli / P3 (CHOSEN — the only item whose failure is paying
                 $398/mo for books we keep but never measure) ·
                 project-context-s2-is-python-era (culled: system-of-building **N/A** —
                 still unpaid; do not bundle; this BRIEF cites live Rust) ·
                 score-lab-b0b-outcomes (blocked-on: never synthesize outcomes; no key
                 in the build env) ·
                 score-lab-symbols-dedup (culled: cosmetic) ·
                 P4 AI lab (culled: blocked-on this) ·
                 P7 vendor hist-chain (culled: extra Massive product) ·
                 degradation-visibility (culled: decision-impact **N/A**, fifth gate) ·
                 sse-connection-ceiling / S5c (culled: availability **N/A**) ·
                 hygiene batch (culled: tooling **N/A**)
