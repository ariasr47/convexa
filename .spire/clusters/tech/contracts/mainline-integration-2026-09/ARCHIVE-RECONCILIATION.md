# archive-coverage-guardrails — research-read build (parallel record)

This folder is the `codex/browser-quality-gates` line's record for a feature that was ALSO built and
shipped on `main` (PR #34, folder `_archive/archive-coverage-guardrails/`). The two councils ran
independently (this one has R3 rounds), and the two implementations differ: `main` ships the
`archive-coverage-audit` CLI, `market_calendar.rs` and the XNYS full-day calendar JSON; this line
ships `routes/research_session_coverage.rs` (the `/api/_research/session-archive/coverage` route the
research-lab-surface, exchange-holiday-calendar, session-day-tape-capture and day-replay features
consume). Both records are kept verbatim; the merge that reconciled the code is feature
`mainline-integration-2026-09` (2026-09-01). Its promoted conformance spec is
`state/conformance/archive-coverage-guardrails-research-read.json`.
