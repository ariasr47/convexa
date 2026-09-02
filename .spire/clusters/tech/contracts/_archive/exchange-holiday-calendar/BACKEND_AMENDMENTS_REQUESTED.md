# BACKEND_AMENDMENTS_REQUESTED — exchange-holiday-calendar

B.closer cargo full: `trader_dashboard_sources_have_no_coverage_chrome` FAIL because
`apps/dashboard/src/app/pages/operator-session-archive/copy.ts` contains
`Command: archive-coverage` / coverage framing (intended operator chrome from
`research-lab-surface`).

**Why it can't stand:** that scan is trader-dashboard poison. `/pages/operator-session-archive/`
is the operator allowlist, not trader chrome.

**Closest buildable:** skip that folder in `walk_dashboard_product_sources` (or this test only)
in `apps/api/tests/archive_coverage_guardrails_isolation.rs`. Keep trader needles. Anti-vacuity:
poison a ticker/scanner source with `archive-coverage` still goes red. Do not delete the operator
copy. Do not widen to `/pages/`.
