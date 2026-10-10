# Lean tests and CI — report (2026-10-09)

Branch `chore/lean-tests-ci-2026-10` in the worktree `../worktrees/convexa-lean`, from `origin/main`
(audited the default branch, not the main checkout's working branch). 109 commits, local only:
nothing pushed, no PR, CI untouched on GitHub. Every number below was measured by a runner; the
evidence lines are in [PROGRESS.md](PROGRESS.md), the per-file verdicts in [audit.csv](audit.csv),
the plan in [AUDIT.md](AUDIT.md) and [BATCHES.md](BATCHES.md).

## Tests (runner counts, before → after)

| Suite | Before (8a7c1e2a) | After (5c2fa2de) |
|---|---|---|
| Vitest `@convexa/dashboard` | 3,139 | 1,736 |
| Vitest `@convexa/api` (libs/api) | 45 | 47 |
| Rust `api-rust` + `quant-engine` (`cargo test`, default features) | 1,643 | 1,147 |
| `npm run test:tools` (node --test) | 150 | 178 (now includes the supply-chain and browser-gate guard specs that ran nowhere) |
| Playwright Chromium gate | 128 | 13 |
| Playwright compatibility (journeys × 3 engines) | 5 × 3 = 15 | 6 × 3 = 18 |
| Playwright accessibility | 35 | 35 |
| Playwright pixel visual gate | 6 | 0 (retired, owner ruling) |
| Postgres-only Rust (guardrails, release safety, export) | 2 + 9 + 1 = 12 | 2 + 10 + 1 = 13 |
| **Total** | **5,173** | **3,187** |

106 whole files retired (920 cases), each with a `RETIRED:` line in
`.spire/clusters/tech/state/RETIRED.md`; every TRIM and CONSOLIDATE is a row in the trim ledger in
AUDIT.md. Batches 100–104 added floor tests (runner-counted net: Rust +31, dashboard Vitest +45 =
48 added − 3 source scans retired, libs/api +12, test:tools +3, Postgres +2, compatibility +3 arms); each
was proven able to fail with a one-line break of the code it guards (bite proofs in PROGRESS.md). Skips: 0 before, 0 after.

## Local suite time (same machine, same commands; `vb.sh` steps, seconds)

| Step | Before (baseline run) | After (final run) |
|---|---|---|
| Vitest dashboard | 78.8 | 42.9 |
| Vitest libs/api | 7.0 | 7.5 |
| `test:tools` | 89.3 (150 tests) | 65.2 (178 tests) |
| API contract check | 14.1 | 5.5 |
| `cargo test` (api-rust + quant-engine) | 165.7 | 465.4 in the run; **76.7 / 94.1 warm after `cargo clean`** (see below) |
| Capacity load (release) | 217.7 | 28.6 |
| Chromium gate | 53.1 (128 tests) | 19.0 (13 tests) |
| Accessibility gate | 31.5 | 32.6 |
| Postgres guardrails + release safety + export | 35.1 | 71.9 (includes a postgres-feature compile) |
| Lint, typecheck, format, build, bundle, capacity isolation and self-tests | 70.2 | 86.5 |
| **Whole run** | **766** | **825 as measured; ~437 with the clean-target cargo time (computed: 825 − 465.4 + 76.7)** |

The cargo step grew from 166 s to 466 s over the session while its test count fell by a third and its
own test time halved (per-binary "finished in" sum ~110 s → ~50 s). Cause: this worktree's `target/`
reached 27 GB with 671,857 files in `target/debug/deps` (stale artifacts of ~100 rebuilds); cargo's
per-target bookkeeping slowed with it (one test binary: 0.8 s run directly, 28 s through `cargo test`).
After `cargo clean` (11,514 files) the same step took 76.7 s and 94.1 s, and the single target 14.4 s.
Owner note: a long-lived checkout's `target/` gets the same drag; `cargo clean` resets it.

## Verify and hook

- `npm run verify` (tools/verify.mjs): affected lint, typecheck and test since the merge base, plus
  `test:tools` when tools/, functions/, .github/, .supply-chain/ or package files change.
  - One-line dashboard change: **47–55 s**, exit 0 (was 453 s before batch 97a scoped out `api`).
  - One-line Rust change: **115 s**, exit 0 (contract check + `api:test`, the full Rust suite for that project).
- Pre-push hook `tools/hooks/pre-push` (affected lint + typecheck): **23 s** uncached on a dashboard
  change, exit 0. Not installed (see Owner commands).

## CI (all jobs ubuntu-24.04: raw minutes = Linux-equivalent; Linux $0.006/min)

| Workflow | Class | Mode | Triggers | Timeouts | Minutes/month before → after |
|---|---|---|---|---|---|
| `ci.yml` | ci | manual | `workflow_dispatch` (+`affected_only`) | frontend 37, backend 45, capacity 15 | 4,318 → ~408 at 8 dispatches (frontend ~18, backend ~26, capacity ~7 per run) |
| `supply-chain.yml` | ci (reusable) | manual | `workflow_call` (from ci.yml) + `workflow_dispatch` | 15 on all 5 jobs | 220 → ~48 (6 per CI dispatch; own dispatch on demand) |
| `conformance.yml` | ops | unchanged (disabled on GitHub) | push main, daily cron, dispatch | unchanged | 403 → 0 while disabled |
| `deploy-smoke.yml` | ops | unchanged (disabled on GitHub) | push main, dispatch | unchanged | 14 → 0 while disabled |
| `browser-visual-linux-candidates.yml` | ops | unchanged (listed for the owner) | dispatch | unchanged | 4 → on demand |

Measured billed Linux minutes in the 30 days before: **4,959** (2.48× the 2,000 free). After, at an
assumed 8 CI dispatches a month: **~456**. Every kept job carries a minutes comment in its workflow.
`workflow-guard.mjs` now refuses a push, schedule or pull_request trigger on supply-chain (re-pinned,
batch 93). CI also runs `npm run test:tools` now (frontend job, ~1 min). Confirmed `on:` blocks
match each mode (PROGRESS.md, Phase 7). On GitHub, `CI` is still `active` with `main`'s old
push/pull_request triggers until this branch is merged.

## Nx

- `typecheck` inputs `["default","^production"]`: proven bug — a TS error in a spec was a cached
  green before (exit 0 "existing outputs match the cache"), exit 1 after.
- `sharedGlobals` += `{runtime: "node --version"}`; `.nxignore` += `.spire/**/project.json` (drops
  the stray `tech` project).
- `api:test` cacheable with explicit inputs (Rust sources, the repo files its tests read, rustc
  version): 494.5 s cold → 41.0 s on a cache hit. Capacity targets stay uncached (pinned).
- Dashboard typecheck writes to `out-tsc/app`, not `dist` (batch 97a): removes a build/typecheck race
  (TS6305) and stops `.d.ts` files landing in the deployable bundle.
- Graph: [graph.json](graph.json). No Nx Cloud (owner decision).

## Pins (Phase 1 deliberate breaks, repeated at the end)

| Break | Caught before | Caught after |
|---|---|---|
| B1 money: `maxLoss.ts:114` condor narrower wing | 1 test (`maxLoss.spec.ts`) | 1 test (same), Vitest 1 of 1,736 failed |
| B2 permission: `service.rs:404` revoked/expired sessions accepted | 1 test (`api_contract_parity` logout replay) | 3 tests: that one + `session_is_rejected_after_its_idle_deadline` + `..._absolute_deadline` (floor gap closed) |
| B3 data write: `resolveDurable.ts` deletes the legacy blob | 15 tests | the same 15 |

Each break was restored with `git restore`; `git status` identical before and after.

## Commits

| Batch | Commit | Subject |
|---|---|---|
| audit | 8a7c1e2a | docs(testing): lean tests and CI audit 2026-10 |
| 1 | 643a5396 | test(dashboard): retire StructureHistory wrapper spec, risk-gone |
| 2 | df6ca407 | test(dashboard): retire positions fixtures self-test, risk-gone |
| 3 | c412a03b | test(dashboard): retire blog-tokens generator check, risk-gone |
| 4 | d4bbc269 | test(api): remove score_lab's in-file oracle tests, risk-gone |
| 5 | 9248aa9d | test(api): retire one-off guardrail receipt validator test, risk-gone |
| 6 | c1c5f79b | test(e2e-tools): retire six never-run lane and visual tooling specs, risk-gone |
| 7 | 353bd391 | test(e2e): retire the design-fidelity survey and its config, risk-gone |
| 8 | 94e54487 | test(supply-chain): retire one-off override-remediation evidence spec, risk-gone |
| 9 | 3bf04dde | test(tools): retire five one-off tooling specs from test:tools, risk-gone |
| 10 | 268779d0 | test(dashboard): retire 4 structure-only ai-rec specs |
| 11 | c8a727e7 | test(dashboard): retire 11 structure-only ticker specs |
| 12 | 10000ed1 | test(dashboard): retire 6 structure-only positions specs |
| 13 | 3fbaa144 | test(dashboard): retire orders copy truncation spec, structure |
| 13a | a8a29c99 | fix(capacity): pin the identity SSE tick age to the fixed clock |
| 14 | 46130b37 | test(dashboard): retire sign-up form validation copy spec, structure |
| 15 | 5c205479 | test(dashboard): retire 13 structure-only theme, shell and chart specs |
| 16 | 9494b956 | test(dashboard): retire 5 structure-only landing, lab and operator-metrics specs |
| 17 | a277b450 | test(dashboard,api-lib): retire 4 structure-only structural specs |
| 18 | 536b33f1 | test(api): remove routes/recommendation.rs structure-only test modules |
| 19 | d20546a2 | test(api): remove price_cache's in-file map test, structure |
| 20 | b5a677aa | test(api): remove capacity harness_app and inject in-file tests, structure |
| 21 | a4956334 | test(e2e-tools): retire five never-run structure tool specs |
| 22 | 24c26d50 | test(e2e): retire the no-overflow layout spec and the pixel visual gate |
| 23 | 6160467e | test(supply-chain): retire three never-run structure specs |
| 24 | 55ab4f16 | test(tools): retire capacity-gate and ci-resource-guards specs, structure |
| 25 | 38e123bf | test(dashboard): retire 3 duplicate ai-rec specs |
| 26 | b13931d1 | test(dashboard): retire 3 duplicate ticker specs |
| 27 | 1bc9af5c | test(dashboard): retire banned-literals scan, duplicate of hex-discipline |
| 28 | a25ca75a | test(dashboard): retire 2 duplicate landing specs |
| 29 | 3af33965 | test(dashboard): retire 3 duplicate root-level specs |
| 29a | 93682d09 | fix(api-tests): make release-safety fixture names unique per process |
| 30 | 70710258 | test(api): remove 11 duplicate in-file route and auth tests |
| 32 | b7d0b120 | test(api): remove 3 duplicate in-file day-tape tests |
| 33 | 9c27a3c1 | test(api): retire duplicate archive-coverage isolation scan |
| 34 | b0430286 | test(api): retire 2 duplicate capacity integration files |
| 35 | ffa87f11 | test(e2e): retire 2 duplicate gate tool specs and their helper |
| 22 follow-up | 0f68885c | chore(e2e): drop the retired overflow spec's file name from comments |
| 36 | a60a98c5 | test(e2e): retire 4 duplicate Chromium specs, inventory 35 -> 20 |
| 37 | ce4312da | test(supply-chain): retire duplicate CLI integration spec |
| 37a | 2f4d0ed3 | test(e2e): measure the AC-34 drawer controls at rest, not mid-slide |
| 38 | 7eafcd56 | test(dashboard): consolidate operator-separation scans, trim 4 root specs |
| 39 | a894806c | test(dashboard,api): retire 3 folded separation specs, trim 5 |
| 40 | b998ee46 | test(api): trim 8 contract and archive-coverage test files |
| 41 | c14228c4 | test(api,quant): trim 8 guardrail and GEX test files, hard-assert golden set |
| 31 | 3d9ee546 | test(quant): remove 4 duplicate in-file max-pain tests |
| 42 | 0c9f8c04 | test(api): drop a framework-behavior case from the Postgres guardrails |
| 43 | 5e1c5d0b | test(dashboard): trim 8 AI-recommendation specs, 201 -> 59 cases |
| 44 | 4a943275 | test(dashboard): consolidate AI-rec literal and layout specs, 166 -> 84 cases |
| 45 | 82d6bd0c | test(dashboard): trim 8 ticker page specs, 94 -> 45 cases |
| 46 | d514f2dc | test(dashboard): trim 8 ticker widget kit and chrome specs, 112 -> 48 cases |
| 47 | 96c18cff | test(dashboard): trim 8 ticker widget specs, 108 -> 57 cases |
| 48 | 16417dc3 | test(dashboard): trim straddle-move and structure-hero specs, 28 -> 14 cases |
| 49 | d062ff32 | test(dashboard): trim 8 positions specs, 142 -> 80 cases |
| 50 | 12b04e1d | test(dashboard): trim 8 positions specs, 134 -> 93 cases |
| 51 | 601d4583 | test(dashboard): consolidate positions view spec, 30 -> 18 cases |
| 52 | e1217fae | test(dashboard): trim 8 trading, broker and order specs, 161 -> 113 cases |
| 53 | b63d503f | test(dashboard): trim 8 broker and outcomes specs, 204 -> 184 cases |
| 54 | d966e050 | test(dashboard): trim track-record flow spec, 28 -> 20 cases |
| 55 | 16e59a5f | test(dashboard): trim 8 auth and alerts specs, 80 -> 53 cases |
| 56 | 91ac6e6a | test(dashboard): trim settings specs, 23 -> 10 cases |
| 57 | 3ea59d2b | test(dashboard): trim 8 shell and shared specs, 69 -> 41 cases |
| 58 | 79ba0146 | test(dashboard): consolidate 3 token contrast specs, trim 5 theme and palette specs |
| 59 | afe14e60 | test(dashboard): trim palette flow, structure-field and Widget specs, 34 -> 9 cases |
| 60 | 0ce1cce2 | test(dashboard): trim 8 page specs, 94 -> 37 cases |
| 61 | 8ed128fd | test(dashboard): trim 8 operator session-archive specs, 50 -> 26 cases |
| 62 | 7faab974 | test(dashboard): trim 6 scanner, positions page and archive view-model specs, 168 -> 93 cases |
| 63 | 55280916 | test(api): trim in-file tests in 8 API source files, 91 -> 43 |
| 64 | a5e568db | test(api): trim in-file tests in 8 API source files, 77 -> 53 |
| 65 | 34db8bcc | test(api): remove 3 risk-gone state tests |
| 66 | 1be8dd15 | test(api): trim and consolidate in-file tests in 8 domain and infra files, 57 -> 28 |
| 66a | 7b1a3b11 | test(api): make the four-fetch scan read production analytics code only |
| 67 | 1f2ff0d6 | test(api): consolidate rec-input, LLM and capacity in-file tests, 79 -> 41 |
| 68 | 785b5000 | test(api,quant): trim money and quant in-file tests, 69 -> 47 |
| 69 | 12b60c8e | test(quant): trim iv-structure, signals, soa and vol-gex in-file tests, 22 -> 12 |
| 70 | c27eabd1 | test(api): trim day-tape in-file tests, 73 -> 59 |
| 71 | 18c5fe0a | test(api): trim day-tape and research in-file tests, 92 -> 57 |
| 72 | 50845937 | test(api): trim research and coverage-matrix in-file tests, 96 -> 69 |
| 73 | f33544da | test(api): trim session-chain-archive in-file tests, 65 -> 50 |
| 74 | 7a5205ec | test(api): trim capacity harness in-file tests, 42 -> 21 |
| 75 | 3ad6cd83 | test(api): trim chain-snapshot, flat-file-keep and threshold in-file tests, 73 -> 61 |
| 76 | 9e05ba64 | test(api): trim flat-file-keep store and watchlist in-file tests |
| 77 | e841fff2 | test(api): trim 8 capacity and backtest integration-test files, 67 -> 28 |
| 78 | d38a9c01 | test(api): trim 8 capacity, archive and snapshot integration-test files, 75 -> 26 |
| 79 | 3a3ce12a | test(api): trim 5 replay, tape and archive isolation-test files, 47 -> 16 |
| 80 | 35e38522 | test(e2e): trim 3 gate tool specs, 16 -> 8 |
| 81 | a4527704 | test(e2e): retire 7 Chromium cases, inventory 20 -> 13 |
| 82 | b1d6f14e | test(supply-chain): trim 7 supply-chain specs, 143 -> 79 |
| 83 | 86970de7 | test(tools): trim api-contract tool spec, 61 -> 44 |
| 84 | 5f8dd3de | refactor(dashboard-tests): paste the operator-archive unlock fields instead of typing them |
| 86 | fd7e1151 | refactor(dashboard-tests): paste credential fields in the auth specs |
| 87 | 2bd744ba | refactor(api): make the SSE occupancy keep-alive configurable; tests use 50 ms |
| 88 | 1deb7769 | refactor(api-tests): shorten capacity test holds |
| 90 | 3e6b08fc | refactor(tools-tests): feed the api-contract spawns the committed OpenAPI export |
| 91 | 252e3ccd | ci: run CI on manual dispatch with an affected-only option and job timeouts |
| 92 | acd02b83 | ci: stop repeating work inside a CI run |
| 93 | c6ab002f | ci(supply-chain): manual mode and job timeouts; re-pin the event-matrix guard |
| 94-95 | 2059935c | docs(testing): list the ops workflows and record CI failure root causes |
| 96 | 813a4299 | build(nx): typecheck hashes spec files, cache api:test, drop the stray tech project |
| 97 | f6b9db8a | build(tools): add npm run verify, the affected-only local check |
| 97a | d037c7aa | build(dashboard): move app declarations out of dist; verify skips api without a Rust change |
| 98 | a4340171 | test(tools): fix the four red guard specs at cause and run every hermetic tool spec |
| 99 | f3760edf | fix(e2e): stop gate web servers with SIGTERM so Vite no longer outlives them; add a pre-push hook |
| 100 | ad53ea00 | test(api): pin session expiry, broker secret at rest, book PUT guards, paused price and production CORS |
| 101 | ab375031 | test(quant): pin HV, VWAP bands, dark-pool cap and the Massive chain parsers |
| 102 | f93105f8 | test(api): prove data writes stay where they belong; make the connector poison control able to fail |
| 103 | 6ace171f | test(dashboard): pin realized P/L, book totals, rec request body and the Pages proxy by behavior |
| 104 | 3647131c | fix(e2e): accessibility waivers refuse a '*' selector and a missing id |
| 104 | 5c2fa2de | test(e2e): add the AI-recommendation open flow as the sixth compatibility journey |

## Still open (owner items; nothing here was changed)

**Blocked (unchanged):**
- `capital_at_risk` with an ineligible open position (`digest.ts:115-119` counts it as 0, no
  incompleteness signal) — UNSURE, not tested.
- Batch 95's AC-35/U-32 Chromium flake fix waits on PR #76; the 8 cases stay unconsolidated.

**Agent instructions (Phase 6):** the risk-based block is in `CLAUDE.md` (owner yes, 2026-10-10). The rule that demands a test per change lives in
`.spire/clusters/tech/context/PROJECT_CONTEXT.md:1398-1412` ("each AC = a required behavioral
test", AC↔test traceability at GATE Q); it is Spire product memory, which this job may not edit.

**Questions found while writing floor tests:**
- Stale book PUT (`book.rs:420-428`) answers 200 and echoes the rejected blob; equal `updated_at`
  overwrites; its 400 body `{detail}` differs from the declared `{error,message}`.
- Paused `/api/price` with a cached price answers 200 from cache.
- `closePosition` on a multi-leg position with an unpriced leg applies one mark to every leg
  (`usePortfolio.ts:523-530`).
- Operator token gates fail open when `METRICS_SECRET_TOKEN` is unset (production refuses to boot
  without it).
- The connector inventory's `massive_rest` signature `MassiveRestClient::new` no longer exists.
- Pages proxy refusal is exact-prefix and case-sensitive (`/API/_metrics`, `/api//_metrics` are
  forwarded and rely on the upstream token); `functions/` is never typechecked.
- `fmtM` prints `1000`, `1000K` and `-0` at its edges; one bad broker row rejects the whole book.
- Massive parsers: a zero last trade hides the minute/day fallbacks; a zero bid hides the Polygon
  key; ATM IV counts days from the UTC date, not ET.

**Reported, not fixed:**
- `now_secs()` (`service.rs:1100-1103`) reads the clock twice; expiry can run up to 1 s late.
- `/api/auth/*` is exempt from the only rate limiter (`rate_limit.rs:93-99`).
- `assertArtifactSafe` has no caller: CI uploads browser evidence unscanned.
- `tools/supply-chain/policy.spec.mjs` and `real-negative-controls.spec.mjs` stay out of
  `test:tools` (network / browser + server).
- `ai-rec.risk.spec.tsx` (~27 s) is the slowest Vitest file; `capacity_self_tests` (~27 s) the
  slowest cargo binary.
- Postgres-only code CI never runs: `chain_snapshot_export_postgres.rs`; the Postgres arm of
  `archive_coverage_audit.rs:313-350`.
- More, with file and line, in the PROGRESS.md "REPORT" lines and AUDIT.md "UNSURE".

**Process notes:** three harness mistakes of mine, each caught and redone (PROGRESS.md): a bite
runner that restored from the wrong temp dir (three quant files stayed mutated until restored), a
bite pass whose test command never ran (exit 127), and a mislabeled Vitest "files" count (it is
suites). Homebrew Rust moved 1.98 → 1.99 mid-run (not by this job).

## Restore a retired file

```bash
git show <parent-sha>:<path> > <path>
```

`<parent-sha>` and `<path>` are on the file's `RETIRED:` line in
`.spire/clusters/tech/state/RETIRED.md`.

## Owner commands

Install the pre-push hook (per clone):

```bash
git config core.hooksPath tools/hooks
```

Resume CI after merging (manual dispatch only):

```bash
gh workflow run ci.yml --ref main
```
