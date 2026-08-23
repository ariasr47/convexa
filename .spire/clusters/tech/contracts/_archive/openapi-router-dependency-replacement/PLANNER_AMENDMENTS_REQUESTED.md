# Amendments bounced to Planner

**Status:** RESOLVED 2026-08-23 — PLAN.md now inserts append-only `B1a-preedit-artifacts`; commits `25cf594` and `140297d` remain unchanged.

## B1 Windows CLI entrypoint defect

- **Observed:** after append-only B1a commit `55d299c`, the committed baseline tool compares `import.meta.url` to a hand-built Windows `file://C:/...` URL instead of the canonical `file:///C:/...`; `candidate` and `accept` return success without dispatching the CLI.
- **Why the current plan cannot stand:** B2 cannot capture a truthful baseline, while rewriting B1 or B1a remains forbidden.
- **Closest buildable alternative:** insert serialized append-only `B1b-baseline-entrypoint-repair` after B1a and before B2. It owns only `tools/api-router-integration-baseline.mjs` and its spec, first adds a Windows canonical-URL/real-CLI RED oracle, then repairs entrypoint detection using `pathToFileURL(resolve(process.argv[1])).href` (or an equivalent cross-platform standard-library comparison) and commits the focused repair. B2 records the B1b commit as `source.revision` and remains its baseline-only child. Preserve all existing commits.

**Status:** RESOLVED 2026-08-23 — PLAN.md now inserts append-only `B1b-baseline-entrypoint-repair`; commits `25cf594`, `140297d`, and `55d299c` remain unchanged.

## B1 child-process npm runner defect

- **Observed:** after append-only B1b commit `071734e`, the real candidate dispatches but the committed tool calls `spawnSync('npm.cmd', ...)`, which returns `EINVAL` with no status or output on this Windows host even though interactive `npm run api:contract:check` succeeds.
- **Why the current plan cannot stand:** B2 cannot execute the required evidence command, and modifying B1/B1b history is forbidden.
- **Closest buildable alternative:** insert serialized append-only `B1c-baseline-npm-runner-repair` after B1b and before B2. It owns only the same tool/spec, adds a real child-process RED oracle, then invokes npm through `process.execPath` plus a validated `process.env.npm_execpath` (or equivalent canonical npm CLI JS path) with `shell:false`; missing/invalid CLI paths fail closed. Commit exactly the two paths. B2 records B1c as `source.revision` and remains its baseline-only child. Preserve all existing commits.

**Status:** RESOLVED 2026-08-23 — PLAN.md now inserts append-only `B1c-baseline-npm-runner-repair`; the chain through `071734e` remains unchanged.

## Post-cutover baseline comparator rejects authorized source delta

- **Observed:** after committed B3–B7 replacement, `npm run api:contract:check` passes, all four generated artifacts are byte-identical, and the 52-pair compile receipt passes, but `npm run api:router-integration:candidate` rejects any current pinned-source diff from the pre-edit `source.revision`.
- **Why the current plan cannot stand:** the comparator confuses B2 capture-time cleanliness with post-cutover migration comparison; the authorized route/tool/manifest removal necessarily differs from the pre-edit source while its artifacts/evidence must remain identical.
- **Closest buildable alternative:** insert append-only `B7a-postcutover-baseline-comparator-repair` after B7 and before B8. It owns only `tools/api-router-integration-baseline.mjs` and its spec. Add a RED fixture with the exact allowed B3–B7 source delta plus unchanged artifact/metadata/181/87 identities; change capture/accept to retain strict source-revision cleanliness, while `compare` independently accepts only the contract's bounded replacement delta and still rejects unrelated source drift, changed artifacts, changed evidence sets, forbidden packages, non-removal Cargo deltas, and baseline/history mutations. Commit exactly the two paths and rerun candidate/check/mutation suites.

**Status:** RESOLVED 2026-08-23 — PLAN.md now inserts append-only `B7a-postcutover-baseline-comparator-repair` after `7d5095f`; prior history remains unchanged.

## Post-cutover verification depended on unstaged source residue

- **Observed:** after B7a commit `96aad2b`, two unstaged edits remain: `contract_router.rs` changes metadata paths from `&'static str` to the actual `String` returned by `utoipa::Path::path()`, and `stream.rs` unwraps the now-fallible `routes::openapi()` in its existing response-contract test. All reported checks ran with these edits present.
- **Why the current plan cannot stand:** the committed branch may not compile or pass independently, and the two paths belong to earlier tasks whose commits may not be amended.
- **Closest buildable alternative:** insert append-only `B7b-committed-tree-integration-repair` after B7a and before B8. It owns exactly `apps/api/src/routes/contract_router.rs` and `apps/api/src/routes/stream.rs`, first proves the committed `HEAD` versions fail in a disposable clean worktree while the two-file candidate passes, then commits the minimal existing diffs. Rerun focused router/stream tests, full contract candidate/check, full Rust check/tests, and verify no task-owned unstaged source remains. Preserve all history.

**Status:** RESOLVED 2026-08-23 — PLAN.md now inserts append-only `B7b-committed-tree-integration-repair` after `96aad2b`; prior history remains unchanged.

## B0 artifact checkpoint omission

- **Observed:** commits `25cf594` (B0) and `140297d` (B1) exist, but the four required pre-edit files under `apps/api/openapi/` remain untracked because B0 did not stage that directory.
- **Why the current plan cannot stand:** B2 requires its parent/source revision to contain the approved pre-edit artifacts. Rewriting, amending, squashing, or rebasing either existing commit is explicitly forbidden.
- **Closest buildable alternative:** insert a serialized append-only `B1a-preedit-artifacts` task before B2. It must stage and commit exactly the four existing pre-edit files under `apps/api/openapi/`, after verifying their hashes and current `api:contract:check`; it may stage nothing else. B2 then records this new commit as `source.revision`, so the baseline-only B2 child retains the exact parent relationship. Update dependencies, V0, history language, and AC-23 traceability accordingly. Preserve all existing commits and contract requirements.
