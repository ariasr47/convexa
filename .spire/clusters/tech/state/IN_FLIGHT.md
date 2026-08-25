# IN_FLIGHT — one row per active branch

Written at GATE R. A branch abandoned before GATE S leaves a stale row; removing it is a one-line
manual edit. A thin or absent file is **not** evidence of no overlap — it may just mean no session
has reached GATE R yet.

| branch | touching | last gate | updated |
|---|---|---|---|
| codex/post-merge-ci-repair | `.github/workflows/{conformance,supply-chain}.yml`; rollback proof + workflow guard tests | GATE R | 2026-08-25 |
