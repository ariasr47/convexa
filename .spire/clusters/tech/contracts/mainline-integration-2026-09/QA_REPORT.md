# QA_REPORT

| AC | Verdict | Evidence |
| --- | --- | --- |
| On the integration branch, `git merge-base --is-ancestor origin/main HEAD` and `git merge-base --is-ancestor origin/codex/browser-quality-gates HEAD` both exit 0, and `git grep -n -E '^(<<<<<<<\|=======\|>>>>>>>)'` over the tree prints nothing. | PASS | RUN:git.merge-base.is-ancestor,RUN:git.grep.conflict-markers |
| `cargo test -p api-rust -p quant-engine --locked` exits 0 on the merged tree. | PASS | RUN:cargo.test.locked |
| `npx tsc --build --force` for `apps/dashboard/tsconfig.app.json` and `tsconfig.spec.json`, `npx nx test @convexa/dashboard --skip-nx-cache`, and `npx nx lint @convexa/dashboard --skip-nx-cache` each exit 0. | PASS | RUN:tsc.build.force.app,RUN:tsc.build.force.spec,RUN:frontend.test_cmd.skip-nx-cache,RUN:nx.lint.skip-nx-cache |
| `npm run api:contract:check` exits 0 and `git diff --stat -- apps/api/openapi libs/api/src/generated` shows the artifacts were regenerated (both changed relative to `origin/main`), not hand-merged. | PASS | RUN:npm.api-contract-check,RUN:git.diff.stat.generated-artifacts |
| With the backend served the project way, `node .claude/tools/gates.mjs interface_conformance --contract .spire/clusters/tech/contracts/mainline-integration-2026-09/INTERFACE_CONTRACT.md --url <base> --report …` reports `verdict: PASS`. | UNVERIFIABLE | RUN:backend.serve_cmd,RUN:qa.interface_conformance,ARTIFACT:.spire/clusters/tech/contracts/mainline-integration-2026-09/conformance-receipt-qa.json |
| With the merged backend served under the same dev env as main (`apps/api/.env` copied from the main worktree, untracked; `SESSION_CHAIN_ARCHIVE_BODY_ROOT=data/session_chain_archive_bodies`), every JSON under `.spire/clusters/tech/state/conformance/` is run individually via `interface_conformance --spec <file> --url <base>`: the six branch-promoted specs (`day-replay-mock-adapter`, `exchange-holiday-calendar`, `massive-flat-file-keep`, `research-lab-surface`, `session-day-tape-capture`, `archive-coverage-guardrails-research-read`) and main's `archive-coverage-guardrails.json` PASS; for every other spec the verdict on the merged server is not worse than the verdict on `origin/main`'s server under the same env (differential sweep, both runs logged per file). Specs that are not pure JSON or declare no endpoints are listed as such, not counted as failures. **Amended 2026-09-01:** the earlier "every JSON passes" form ignored environmental failures main already has. | UNVERIFIABLE | RUN:backend.serve_cmd,ARTIFACT:.spire/clusters/tech/state/conformance |
| `cargo run -p api-rust -- --help` lists both `capacity-baseline` and `capacity` (with `load` and `soak`), both `archive-coverage-audit` and `archive-coverage`, plus `session-day-tape`, `session-day-replay`, `flat-files`. | PASS | RUN:cargo.run.help,RUN:api-rust.capacity.help |
| `npm run capacity:baseline:self-test:byte-identity` exits 0 (v1 harness; score/tier/fingerprint byte-identical to the approved artifacts) and `cargo run -p api-rust --locked --release -- capacity load` exits 0 printing `CAPACITY HARNESS`, `NOT A PRODUCTION MEASUREMENT` and `Evidence: local` (v2 harness). | PASS | RUN:npm.capacity-baseline-self-test-byte-identity,RUN:npm.capacity-load,RUN:cargo.run.release.capacity-load.APP_ENV-dev |
| For each of the six branch records under `contracts/_archive/` and for `_archive/archive-coverage-guardrails-research-read/`, `git diff origin/codex/browser-quality-gates:<branch path> HEAD:<landed path>` is empty (records land verbatim); main's `_archive/archive-coverage-guardrails/` and `_archive/browser-quality-gates/` are byte-identical to `origin/main`. | FAIL | RUN:git.diff.archive-records |
| `OPEN_THREADS.md`, `BACKLOG.md`, `PROJECT_CONTEXT.md` contain every `## ` heading of both parents exactly once, with the branch's colliding thread numbers renumbered (no two sections share a `7a?` number). | PASS | RUN:git.show.headings.comm,RUN:git.show.section-body.diff |
| A checked-in test `tools/holiday-calendar-parity.spec.mjs` proves the dashboard's `nyseFullDayHolidays.ts` date set equals the backend `xnys_full_day_2026_2035.v1.json` set for every year both cover, and `node --test tools/holiday-calendar-parity.spec.mjs` exits 0. | PASS | RUN:node.test.holiday-calendar-parity |
| On the pushed integration branch, the hosted `CI`, `Supply-chain evidence` and `Deploy smoke` workflows conclude `success` for the merge commit (`gh run list --branch spire/mainline-integration-2026-09`). | UNVERIFIABLE | RUN:gh.run.list,RUN:gh.pr.list |
| `node .claude/tools/gates.mjs contract_lint mainline-integration-2026-09` exits 0 and `node .spire/bin/spire.mjs run tech --provider claude` exits 0 in the merged tree. | PASS | RUN:gates.contract_lint,RUN:spire.run.tech |
| `cargo run -p api-rust --features postgres -- serve` (what `npx nx serve api` runs) built in debug on this Windows box binds and answers `GET /api/health` with 200 — the merge-introduced main-thread stack overflow (measured ~471 KB `routes::router` frame at opt-level 0, fixed in `5de8c29d`) does not recur. **Added 2026-09-01.** | UNVERIFIABLE | RUN:backend.serve_cmd |

SUMMARY: 9 PASS / 1 FAIL / 4 UNVERIFIABLE
NOTE: VISUAL_EVIDENCE_UNAVAILABLE
GATE Q: FAIL

## Amendments bounced to conductor (records path is conductor-owned; SPEC §2 forbids lanes touching `.spire/**` records)

| AC | Expected | Observed | Owner |
| --- | --- | --- | --- |
| AC-9 | `git diff origin/codex/browser-quality-gates:.spire/clusters/tech/contracts/_archive/archive-coverage-guardrails HEAD:.spire/clusters/tech/contracts/_archive/archive-coverage-guardrails-research-read` is empty | Exit 1: one added file `README-INTEGRATION.md` (+11 lines, authored in merge commit `7c61cf8`). Every file the branch record shipped is byte-identical; the six other branch records (`capacity-baseline`, `day-replay-mock-adapter`, `exchange-holiday-calendar`, `massive-flat-file-keep`, `research-lab-surface`, `session-day-tape-capture`) diff empty; main's `archive-coverage-guardrails/` and `browser-quality-gates/` diff empty vs `origin/main`; `state/conformance/archive-coverage-guardrails-research-read.json` diff empty vs the branch's `archive-coverage-guardrails.json`. Resolution is either drop the README or amend AC-9 to permit an additive integration note — an owner call, not a lane task. | Conductor (neither Backend nor Frontend) |

## Session facts (fresh QA, macOS, 2026-09-02)

- Worktree `/Users/rodrigoarias/dev/convexa/.worktrees/mainline-integration`, branch `spire/mainline-integration-2026-09` @ `0d9e80f`; `origin/main` = `d0874ce`, `origin/codex/browser-quality-gates` = `6cb9381`.
- `conformance-receipt-qa.json` in this folder was overwritten by the gate tool from **this** run; it records 0/34 with every probe `unreachable/error — fetch failed` because no backend could be served (see AC-5). The previous 34/34 receipt (Windows, 2026-09-02T06:25Z) and the backend lane's `conformance-receipt.json` (34/34, 06:03Z) are NOT this session's evidence and were not used for any verdict.
- Tree side effects observed and not mine: `.spire/clusters/tech/receipts/selection.json` was already modified when this session started and is rewritten by `spire run tech` (AC-13). One untracked `convexa-api-contract-candidate-<sha>.ok` marker appeared at the repo root during the tooling runs and was removed by QA; `tools/api-contract.mjs:485-489` writes that cache marker to `process.env.TEMP ?? process.env.TMP ?? '.'`, which resolves to the repo root on macOS. The code is byte-identical on both parents (not merge-introduced); portability nit, not Critical.

## Command refs (what each `RUN:` token executed, with exit codes observed)

| ref | command | exit / observation |
| --- | --- | --- |
| git.merge-base.is-ancestor | `git merge-base --is-ancestor origin/main HEAD`; same for `origin/codex/browser-quality-gates` | 0 and 0 |
| git.grep.conflict-markers | `git grep -n -E '^(<<<<<<<\|=======\|>>>>>>>)'` | no output, exit 1 (nothing found) |
| cargo.test.locked | `cargo test -p api-rust -p quant-engine --locked` | 0; 62 test binaries, 1617 passed, 0 failed, no `FAILED`/`panicked` lines |
| tsc.build.force.app / .spec | `npx tsc --build --force apps/dashboard/tsconfig.app.json` / `…tsconfig.spec.json` | 0 / 0 |
| frontend.test_cmd.skip-nx-cache | `npx nx test @convexa/dashboard --skip-nx-cache` | 0; 200 files / 2216 tests passed, 0 skipped, 0 todo |
| nx.lint.skip-nx-cache | `npx nx lint @convexa/dashboard --skip-nx-cache` | 0 |
| npm.api-contract-check | `npm run api:contract:check` | 0 ("generated artifacts match the Rust API contract") |
| git.diff.stat.generated-artifacts | `git diff --stat origin/main HEAD -- apps/api/openapi libs/api/src/generated` | 5 files changed: `convexa.openapi.json`, `generated-artifacts.manifest.json`, `parity-coverage.json`, `precutover-operation-baseline.json`, `libs/api/src/generated/schema.ts` |
| backend.serve_cmd | `npx nx serve api` (= `cargo run -p api-rust --features postgres -- serve`), `WARM_ENABLED=0 SCAN_ENABLED=0 HTTP_BIND=127.0.0.1:8010`; also the prebuilt `target/debug/api-rust serve` | both exit 1 before bind: `error: config: MASSIVE_API_KEY is not set (check apps/api/.env)`; `apps/api/.env` absent in this worktree and in `/Users/rodrigoarias/dev/convexa/apps/api/.env`; `MASSIVE_API_KEY` absent from the environment; no listener on :8010. No `.env` was created and no key invented. |
| qa.interface_conformance | `node .claude/tools/gates.mjs interface_conformance --contract …/INTERFACE_CONTRACT.md --url http://127.0.0.1:8010 --report …/conformance-receipt-qa.json` | exit 1; verdict FAIL 0/34, all 34 `unreachable/error — fetch failed` (no server) |
| cargo.run.help | `cargo run -p api-rust -- --help` | 0; lists `capacity-baseline`, `capacity`, `archive-coverage-audit`, `archive-coverage`, `session-day-tape`, `session-day-replay`, `flat-files` (and `healthcheck`, `production-volume-drill`, research CLIs) |
| api-rust.capacity.help | `target/debug/api-rust capacity --help` | 0; subcommands `load`, `soak` |
| npm.capacity-baseline-self-test-byte-identity | `npm run capacity:baseline:self-test:byte-identity` (= `cargo run -p api-rust -- capacity-baseline self-test --case byte-identity`) | 0; fail-closed self-test printed no `error:` line |
| cargo.run.release.capacity-load (bare, as written in AC-8) | `cargo run -p api-rust --locked --release -- capacity load` with no `APP_ENV` | **exit 1**: `Production startup refused … Runtime mode: set APP_ENV to prod, dev, test, or staging.` (`production-fails-closed`) |
| npm.capacity-load | `npm run capacity:load` (nx target `api:capacity-load`, which sets `APP_ENV=dev` — the same env SPEC §2's CI rule prescribes for this exact command) | 0; prints `CAPACITY HARNESS — MOCKED VENDORS · NOT A PRODUCTION MEASUREMENT`, `Command:     load`, `Evidence:    local`, `[PASS] load — … unexpected errors 0` |
| cargo.run.release.capacity-load.APP_ENV-dev | `APP_ENV=dev cargo run -p api-rust --locked --release -- capacity load` | 0; same three strings |
| git.diff.archive-records | `git diff --quiet <branch>:<record> HEAD:<record>` for the six branch records + the research-read rename; `git diff --quiet origin/main:<record> HEAD:<record>` for main's two | six branch records 0; research-read **1** (README-INTEGRATION.md added); main's two 0 |
| git.show.headings.comm | per file, `## ` headings of `origin/main`, `origin/codex/browser-quality-gates`, `HEAD` compared with `comm`; duplicate check with `uniq -d` on heading text and on `## <number><letters>` | OPEN_THREADS: every main heading present; branch's `7aq`/`7ar`/`7as` present as `7ay`/`7az`/`7ba` (explicitly marked "renumbered from 7aq/7ar/7as at mainline-integration-2026-09"); no duplicate heading text, no duplicate `7a?` number. BACKLOG (67) and PROJECT_CONTEXT (10): union complete, no duplicates, no headings outside both parents. 0 NUL bytes in all three files. |
| git.show.section-body.diff | body of branch `7aq`/`7ar`/`7as` vs HEAD `7ay`/`7az`/`7ba` | 0 differing lines for all three |
| node.test.holiday-calendar-parity | `node --test tools/holiday-calendar-parity.spec.mjs` | 0; 3/3 pass (dashboard↔JSON, backend table↔JSON, dashboard↔backend). Both replicas no longer contain `2021-12-31`, `2027-12-31`, `2032-12-31` |
| gh.run.list / gh.pr.list | `gh run list --branch spire/mainline-integration-2026-09 --limit 5`; `gh pr list --head spire/mainline-integration-2026-09 --state all` | both exit 0 with **zero rows**. Remote `origin/spire/mainline-integration-2026-09` is at `31f735e`; HEAD `0d9e80f` (the two repair commits) is not pushed. `ci.yml` triggers `push: main` + `pull_request`; `deploy-smoke.yml` `push: main` + dispatch; `supply-chain.yml` is `workflow_call` only — none can have run without a PR. |
| gates.contract_lint | `node .claude/tools/gates.mjs contract_lint mainline-integration-2026-09` | 0; 0 errors, 2 warnings (PROJECT_CONTEXT §5/§6 oversize) |
| spire.run.tech | `node .spire/bin/spire.mjs run tech --provider claude` | 0; "selected spire:tech delivery for claude"; `.spire/bin/spire` is mode 100755 in the index; `.gitattributes` has `.spire/bin/spire.cmd text eol=crlf` after the blanket `eol=lf` rule — the `0d9e80f` repair verified by execution, not by reading |

## AC-14 scoping

The criterion is written against "this Windows box" and a 1 MB main-thread stack at opt-level 0. This QA ran on macOS (8 MB main thread); the overflow cannot reproduce here, so a green boot would not have earned the criterion. Additionally the debug `--features postgres` binary (`npx nx serve api`) built and launched but exited at `Config::from_env()` (`MASSIVE_API_KEY` unset) before `AppState`/router construction — the frame in question was never entered. Fix commit `5de8c29d` (per-route `#[inline(never)]` registration in `apps/api/src/routes/mod.rs`) is an ancestor of HEAD (read at source). Verdict stays UNVERIFIABLE; needs a Windows run with `apps/api/.env` present.

## Independent conformance (method §3)

- Could not run live: see `backend.serve_cmd`. Receipt written by the tool records the blocked attempt (0/34 unreachable). Compared with the backend lane's `conformance-receipt.json` (34/34 PASS, Windows, :8010, 06:03Z): not contradicted, not confirmed — no comparable run exists on this box. Per the agent's stop rule this is a **blocked conformance** on a feature with backend changes; the overall verdict is FAIL/blocked, not PASS.
- AC-6 static half observed: 40 files under `state/conformance/`; 3 are not pure JSON (`chain-archive-object-store.json`, `liquid-names-session-capture.json`, `session-chain-archive.json` — bare `"endpoints": [` fragments); 3 declare no endpoints (`postgres-release-safety-repository.json`, `production-runtime-guardrails-transport.json`, `production-runtime-guardrails-volume.json`); 34 are endpoint-bearing, including all seven the criterion names. The differential sweep (merged vs `origin/main` server) is blocked by the same missing `.env`.

## Invariant watch (BRIEF) + promoted canon (OPEN_THREADS §9)

| invariant | observation |
| --- | --- |
| `additive-keeps-score-byte-identical` | byte-identity self-test exit 0; `apps/api/tests/fixtures/capacity-baseline/v1/identity/before/**` has an empty diff vs `origin/main`; `identity.rs` changes are exactly the five artifact SHAs and `52 → 57` (ruled, Item 2). HOLDS. |
| `shared-session-eligibility-calendar` | parity test 3/3; the three Saturday-New-Year Fridays removed from both replicas; dashboard `nyseFullDayHolidays.spec.ts` 3/3 in the suite. HOLDS. |
| `production-fails-closed` | observed live: `capacity load` without `APP_ENV` refused to start; `state.rs:421-425` refuses production without `METRICS_SECRET_TOKEN` (read at source). HOLDS. |
| `operator-vs-trader-path-separation` | branch research handlers (`research_session_day_tape.rs`, `research_flat_files.rs`, `research_session_coverage.rs`, `research_session_books.rs`) all use the `/api/_metrics` token gate (`token_gate` → `metrics_token_ok`), declare "Zero Massive I/O" with must-stay-0 counters; the only `insert_if_absent` calls are inside `#[cfg(test)]`. Dashboard structural specs (`batch-backtest-cli.structural`, `session-day-tape-capture.structural`, `research-lab-surface.structural`) green with their anti-vacuity and mutation cases. HOLDS (at source + tests; not runtime-observed). |
| `best-effort-isolated-or-null`, `reconstruction-never-satisfies-live-coverage`, `present-is-live-paid-only` | not runtime-observable this session (no server); backend suite green. NOT CONTRADICTED. |
| `cited-code-is-verified-not-assumed` | this report cites only what was executed or read at source. |
| §9 first bullet: "The compatibility inventory remains 52 operations / 181 response conversions / 87 direct HTTP cases" | **Canon text is now contradicted by the merged tree**: 57 operations (re-pinned by the Item 2 ruling) and 201/100 evidence outcomes (Item 5, CONTESTED, awaiting D4). Not a lane defect — a canon line that the ruling on Item 2 already superseded in part; the conductor should amend it when D4 is ruled. Recorded, not counted against any AC. |

## BACKEND_AMENDMENTS_REQUESTED Item 5 — state recorded (CONTESTED, not a lane failure)

- `npm run test:tools` on this box: 148/149 pass, exit 1; the single failure is `tools/api-router-integration-baseline.spec.mjs` › "real candidate CLI executes npm evidence without command shim" → `Error: response evidence set (201/181)` at `api-router-integration-baseline.mjs:236` (`runEvidence`). Exactly the contested pin; nothing else red.
- Standalone `node --test tools/api-router-integration-baseline.spec.mjs` fails the same test earlier with `npm CLI path is missing or invalid` because `npm_execpath` is only set when invoked under npm (`api-router-integration-baseline.mjs:155-165`); this is an invocation-environment difference, not a second defect.
- Hosted CI never runs `test:tools` (confirmed by reading `.github/workflows/*.yml`), so AC-12 is unaffected by Item 5.

## Join audit (method §5)

`PLAN.md ## Independence` has no `Independent: yes` row (B1–B3 `no`, B4 `no (closer)`), so the Workers audit is not triggered. `_MANIFEST.md` `Workers:` is present: backend B1–B5 with closer B5 @ `d60af115`; frontend F1 `28618b9f`, F2 `4de098b9` (both commits verified in the log). `RESUME.md` in this folder is `**Resume status:** ACTIVE` — it is the conductor's own GATE Q interruption checkpoint for this re-run, not a lane resume; it must be closed by the conductor when this GATE Q is recorded.

## Criteria-independent Critical sweep (method §6)

Scope: the merge commit `7c61cf8`'s combined diff (conflict-resolved files), the fourteen post-merge commits (`b844c2c..0d9e80f`), and the full `origin/main..HEAD` diff for secret patterns.

- Secrets: no added line matches api-key/secret/token/password literals, AWS `AKIA` ids, private-key blocks, or `sk-…` keys (fixtures/openapi/generated/`.spire`/docs excluded from the literal grep; the whole diff scanned for `AKIA`/PEM/`sk-`). The only token-looking literal is a test constant inside `#[cfg(test)]` (`research_session_coverage.rs:354`).
- Auth/authz: every new `/api/_research/*` route is gated by the same `METRICS_SECRET_TOKEN` bearer/`X-Metrics-Token` check as `/api/_metrics`; open only when the token is unset, which production refuses (`state.rs:421`). No cross-tenant surface is introduced (operator routes are not per-user).
- CI: `ci.yml` delta is exactly the `Capacity load harness` step after `Cargo test` with `CONVEXA_CAPACITY_CI_STEP=1`, `APP_ENV=dev`; no secret exposure, no new permissions.
- Repo integrity: `.gitattributes` adds `eol=crlf` for `.spire/bin/spire.cmd` and `eol=lf` for the capacity fixture tree; `.spire/bin/spire` mode `100644 → 100755`; `.nxignore` loses one blank line. All benign.
- Destructive data: none; `identity/before/*` untouched; the identity re-pin is additive hashes + count.
- Finding (non-Critical): `tools/api-contract.mjs` cache marker lands in the repo root on macOS (see Session facts). Pre-existing on both parents.

**No Critical finding.** GATE Q FAIL is driven by AC-9 (letter of the criterion) and by the four UNVERIFIABLE criteria that need a Windows box with `apps/api/.env` (AC-5, AC-6, AC-14) and a pushed branch with an open PR (AC-12).

## Spec-text amendments suggested (not lane bounces)

- AC-8: state `APP_ENV=dev` for the release `capacity load` arm (the bare command as written exits 1 by `production-fails-closed`; SPEC §2 already prescribes that env for the CI step).
- AC-9: either permit an additive `README-INTEGRATION.md` in the research-read record or remove the file.
- OPEN_THREADS §9 compatibility-inventory line: reconcile with the Item 2 ruling (57 operations) and the pending D4 ruling on 181/87 vs 201/100.
