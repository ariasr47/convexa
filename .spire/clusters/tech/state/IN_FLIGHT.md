# IN_FLIGHT — one row per active branch

Written at GATE R. A branch abandoned before GATE S leaves a stale row; removing it is a one-line
manual edit. A thin or absent file is **not** evidence of no overlap — it may just mean no session
has reached GATE R yet.

| branch | touching | last gate | updated |
|---|---|---|---|
| spire/mainline-integration-2026-09 | merge of `origin/codex/browser-quality-gates` into main at worktree `.worktrees/mainline-integration`; GATE Q interrupted mid-run (independent conformance 34/34 written, no `QA_REPORT.md`) | GATE Q | 2026-09-02 |
| main | `docs/HANDOVER-2026-09-01-main-reconciliation.md`; `contracts/capacity-baseline/` (QA evidence copied in); `state/main/RESUME.md`; `.nxignore` — reconciliation only, no feature build | GATE R | 2026-09-01 |
