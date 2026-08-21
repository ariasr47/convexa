# replay-outcome-join — brief
Goal:            Attach the **next-session stock-bar labels we already pay for** (Massive
                 daily aggs via shipped `join-outcomes`) to the **replayed scores** from
                 stored options books (`batch-backtest`), so we can measure whether the
                 score computed on the book we paid $199 Options for ranked the next
                 day's move. Today those two tools do not meet: `score-lab` ranks the
                 *digested* structure diary; `batch-backtest` reprints Path-B numbers
                 with **Authorizes: nothing** and no forward label. This feature joins
                 them. It does **not** change the live score, buy hist-chain, or add a
                 trader UI.

Decision impact: Whether the live opportunity score (on the **exact paid chain**) is
                 any good at ranking large next-day moves — the same question the
                 2026-08-11 score-lab slice asked (AUC 0.467 on digested samples) but
                 now on **replayed books**. Observed by: one research run produces a
                 dated report with paired (replayed score, 1d/5d label), zero Options
                 API calls, Stocks aggs only if labels are missing; a second run on
                 the same corpus+labels is byte-identical; empty/unlabeled rows are
                 honest (`no label` ≠ `empty book` ≠ `no snapshot`), never a silent
                 live options fetch.

Feasibility:     pass — `join-outcomes` already fetches `/v2/aggs` (Stocks $199);
                 `batch-backtest` already emits replayed score/tier/walls without
                 Massive; labels are session-count horizons (1d/5d). Architect names
                 whether this extends `score-lab`, extends `batch-backtest`, or is a
                 third CLI that consumes both artifacts. Must not call Options
                 snapshot APIs. Must not write live score/weights.

Effort:          M  (research join + report + hermetic tests; no trader UI)

Invariant watch: `score-change-is-deliberate-and-measured` (**HARD** — a report does
                 not authorize a live score change; first slice already showed the
                 composite failing this KPI) · `operator-vs-trader-path-separation` ·
                 `additive-keeps-score-byte-identical` · `best-effort-isolated-or-null` ·
                 `absent-is-not-none` (no snapshot ≠ no label ≠ empty book) ·
                 `cited-code-is-verified-not-assumed` (cite `cmd_join_outcomes`,
                 `cmd_batch_backtest`, `cmd_score_lab`, `chain_snapshot/`) ·
                 `model-read-carries-its-assumptions` (horizon, n, window on every rate) ·
                 Massive license: research only

Context tags:    backend,architecture,decisions

Source:          Owner `go` 2026-08-18 after back-test evaluation — chose **next build**
                 (not a docs-only runbook). The evaluation's gap: tools exist, measurement
                 of paid books vs next-day moves does not. Unblocks using Stocks $199 for
                 labels on Options $199 books we now keep.

Considered:      replay-outcome-join (CHOSEN — only item whose failure is “we save and
                 replay books but still cannot say if the score worked”) ·
                 weekly-runbook-as-docs (culled: owner chose a **build**, not a memo) ·
                 P4 AI lab (culled: blocked-on boring P2–P3 use; we have not run a
                 multi-week corpus yet) ·
                 P7 hist-chain (culled: extra Massive product) ·
                 project-context-s2-is-python-era (culled: system-of-building **N/A** —
                 still unpaid; do not bundle; this BRIEF cites live Rust) ·
                 score-lab-b0b-outcomes (blocked-on: never synthesize outcomes) ·
                 degradation-visibility (culled: decision-impact **N/A**) ·
                 hygiene batch (culled: tooling **N/A**)
