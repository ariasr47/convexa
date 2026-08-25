# Resume — post-merge CI repair

**Resume status:** CONSUMED (as of 2026-08-25)

## Objective

Close three release-automation defects discovered after PR #31 merged, without changing product
behavior or UI. Publish a focused follow-up PR, obtain hosted evidence, and return the merge decision
to the operator. Do not merge the follow-up PR without fresh authorization.

## Workspace identity

- Worktree: `C:\Dev\convexa\.worktrees\post-merge-ci-repair`
- Branch: `codex/post-merge-ci-repair`
- Base/HEAD: `7079d92517867fbf4358af0b80bf4f99716cafd5` (`origin/main` when created)
- Changes are currently uncommitted.
- `npm ci` completed in this worktree; local `node_modules` is available.

## Production state

- PR #31 merged as `7079d92517867fbf4358af0b80bf4f99716cafd5`.
- Railway production deployment `6093406515`: `success` at `2026-08-25T22:40:59Z`.
- Cloudflare Pages check for the merge commit: `success`.
- Post-deployment smoke rerun `32907525800`: `success` for health, ticker, scanner, history, and
  optional Pages checks.
- No rollback is indicated; production is healthy.

## Diagnosed failures

1. Conformance run `32906928950` failed in both jobs before live checks. A clean checkout ran
   `npm run api:contract:check` before building `libs/api/dist/index.d.ts`, producing TS6305 and
   cascading type errors. The already-green CI workflow proves the required prerequisite command:
   `npx tsc -p libs/api/tsconfig.lib.json --pretty false`.
2. Default-branch supply runs attempted `render-summary.mjs` on a policy-only report whose overall
   path was `artifacts`. The policy checks and uploaded report were PASS, but the sanitizer correctly
   refused a partial artifact-path report without the two final subject associations. Final artifact
   evidence and aggregate validation run in later jobs, so the policy-only summary must run only for
   `path == policy`. Policy and aggregate failures remain fail-closed.
3. The rollback proof captured `git diff --binary` with Node's default 1 MiB subprocess buffer. The
   PR #31 merge diff exceeded that bound and produced `spawnSync git ENOBUFS`. The proof now uses an
   explicit bounded 64 MiB buffer and has a stable 2 MiB binary-patch regression.

## Files changed

- `.github/workflows/conformance.yml` — build generated API declarations before each contract check.
- `.github/workflows/supply-chain.yml` — render the policy-only summary only on the policy path.
- `tools/supply-chain/workflow-guard.spec.mjs` — guards both workflow invariants.
- `tools/api-router-integration-rollback.mjs` — bounded 64 MiB replacement-patch capture.
- `tools/api-router-integration-rollback.spec.mjs` — stable large-patch rollback regression.
- This resume file and this branch's `IN_FLIGHT.md` row are GATE R continuity state.

## Verification completed

- RED observed: workflow guard failed both missing invariants.
- GREEN: workflow/publication focused suite passed `26/26`.
- Clean-checkout reproduction: contract check failed without declarations, then passed after the
  exact `tsc` prerequisite.
- Rollback RED observed on both the real merge diff and the stable 2 MiB fixture.
- Rollback focused suite passed `3/3` after the bounded buffer change.
- Full `npm run test:tools` passed `144/144` in `89.2s` on final working bytes.
- Prettier check passed for changed workflow/tool files.
- `git diff --check` passed.

## In progress at checkpoint

- No local process is running; the checkpoint is at a safe boundary.
- Original main CI run `32906929302` was still in progress when checkpointed. Its conformance and
  standalone supply failures are already diagnosed above; it does not contain the follow-up fix.
- The focused repair has not been committed, pushed, or opened as a PR.

## Next concrete steps

1. Reconfirm `git status --short`, `git diff --check`, and the five intended implementation/test
   files plus the two GATE R continuity files.
2. Commit with a focused message such as `fix(ci): close post-merge verification gaps`.
3. Push `codex/post-merge-ci-repair` and open a PR targeting `main`.
4. Monitor normal PR checks.
5. From the pushed branch, manually dispatch `conformance.yml` and `supply-chain.yml` with
   `path=artifacts` so the two default-branch-only paths are directly proven before merge.
6. Audit the resulting conformance, artifact, and aggregate evidence. Ask the operator before
   merging; another `main` merge will automatically deploy Railway and Cloudflare.

## Gotchas

- Do not modify product/UI code; this repair is workflow/tooling only.
- Do not merge or deploy the follow-up without explicit operator authorization.
- Preserve unrelated dirty Spire/user files in `C:\Dev\convexa\.worktrees\capacity-baseline`; this
  repair uses its own worktree.
- On fresh boot, read this overlay last, deliver the re-orientation card, then run:
  `node .codex/tools/continuity.mjs mark-consumed .spire/clusters/tech/state/codex-post-merge-ci-repair/RESUME.md`.
