# HANDOVER — 2026-10-10 — lean tests and CI (branch `chore/lean-tests-ci-2026-10`)

**Continuity status:** SUPERSEDED (as of 2026-10-12) — merged to `main` as PR #77 (merge commit
`4ce47caf`); the branch and its worktree are deleted. Current state: `docs/testing/2026-10/REPORT.md`.
The text below is the 2026-10-10 snapshot, kept as written.

Written for whoever picks up this branch, human or agent. Everything below was read from git and from
runner output on disk, not recalled. Re-verify anything you act on.

## Where it is

- Worktree `../worktrees/convexa-lean`, branch `chore/lean-tests-ci-2026-10`, local only. Nothing was
  pushed; no PR; no GitHub setting or workflow state was changed.
- All 104 approved batches are committed (plus fixes 13a, 29a, 37a, 66a, 97a). Final full run green at
  `5c2fa2de`: 21 steps exit 0, 0 skips. Results, timings, CI minutes and the commit list:
  [docs/testing/2026-10/REPORT.md](testing/2026-10/REPORT.md). Step-by-step evidence:
  [PROGRESS.md](testing/2026-10/PROGRESS.md).
- Spire was not booted. This handover lives in `docs/` because the job could not write under
  `.spire/` (only `RETIRED.md`); no RESUME, IN_FLIGHT or handover was consumed.

## Waiting on the owner

1. **Merge or not.** Merging puts `ci.yml` and `supply-chain.yml` in manual mode (~456 CI minutes a
   month at 8 dispatches, from 4,959 measured). Until then `main`'s CI keeps push/pull_request
   triggers.
2. **The `CLAUDE.md` risk-based-testing block** is applied (owner yes, 2026-10-10). The test-per-AC rule itself is in `.spire/clusters/tech/context/PROJECT_CONTEXT.md:1398-1412`,
   which a Spire lane or the owner must change.
3. **Blocked items:** `capital_at_risk` with an ineligible open position (UNSURE); the AC-35/U-32 fix
   in PR #76.
4. **Questions** raised while writing floor tests, each with file and line, in REPORT.md.

## If you continue here

- Verify a change: `npm run verify` (dashboard change ~50 s, Rust change ~115 s). Optional hook:
  `git config core.hooksPath tools/hooks`.
- Retire a test by deleting it and appending a `RETIRED:` line to
  `.spire/clusters/tech/state/RETIRED.md` in the same commit (form in REPORT.md).
- If `cargo test` gets slow, check `target/` size; `cargo clean` reset 466 s to ~80 s here.
- The Postgres-only tests need `TEST_DATABASE_URL`. This job used its own throwaway Postgres 16 on
  `localhost:54329` (data dir in its scratchpad), stopped when the job ended; your Postgres on
  `/tmp:5432` was never touched.
