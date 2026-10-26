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
