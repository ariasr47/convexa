# Trim ledger (2026-10-22 test plan)

One row per single case or in-file test module that a batch of [TEST_PLAN.md](TEST_PLAN.md) removes
while its file stays (TEST_PLAN.md §7.2 step 3), in the format of the 2026-10 trim ledger
(`docs/testing/2026-10/AUDIT.md:400-404`). A deleted file gets a `RETIRED:` line in
`.spire/clusters/tech/state/RETIRED.md` instead. Batch 15 created this file. Append only: a later batch
adds its own rows and never edits an earlier one. Both counts come from the runner's own listing
(`cargo test -- --list`, `node --test`, `vitest list`), before at the batch's parent commit and after
at the batch commit.

| Batch | File | Cases before → after | Removed or merged (named in the commit) |
|---|---|---|---|
| 16 | `apps/api/tests/capacity_isolation.rs` (case-level; risk-gone) | 3 → 2 | removed: linux_ci_runs_normal_gate_and_retains_all_four_reports |
| 16 | `apps/api/tests/capacity_baseline_isolation.rs` (case-level, with its 3 `ci.yml` helpers; risk-gone) | 13 → 12 | removed: ci_backend_job_runs_capacity_load_and_not_soak |
