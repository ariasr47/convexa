# Archive reconciliation — why two `archive-coverage-guardrails` records exist

`archive-coverage-guardrails` was built and shipped **twice, independently**: once on `main`
(PR #34, record `_archive/archive-coverage-guardrails/`) and once on the
`codex/browser-quality-gates` line (record `_archive/archive-coverage-guardrails-research-read/`,
which has R3 rounds). This merge — feature `mainline-integration-2026-09`, 2026-09-01 — reconciled
the two code lines but deliberately kept **both records verbatim**, because each is the honest
history of the council that actually ran.

The two implementations differ:

| | `main`'s build | the research-read build |
| --- | --- | --- |
| ships | `archive-coverage-audit` CLI, `market_calendar.rs`, the XNYS full-day calendar JSON | `routes/research_session_coverage.rs` — the `/api/_research/session-archive/coverage` route |
| consumed by | operator tooling | `research-lab-surface`, `exchange-holiday-calendar`, `session-day-tape-capture`, `day-replay` |

The research-read build's promoted conformance spec is
`state/conformance/archive-coverage-guardrails-research-read.json`.

> This note lives with the merge rather than inside either record on purpose. SPEC §3 AC-9 requires
> archived records to land byte-verbatim, and GATE Q (2026-09-02) correctly failed an earlier draft
> that placed it inside `_archive/archive-coverage-guardrails-research-read/`. The provenance is a
> property of *this merge*, so it belongs in this folder.
