# Baseline — lean tests and CI, 2026-10-08

Audited: the **default branch `main` at `8932fc11`** (worktree `../worktrees/convexa-lean`, branch
`chore/lean-tests-ci-2026-10`). The owner's working branch is `codex/portfolio-demo-platform`
(16 commits ahead of `main`, draft PR #76); the main checkout currently sits on
`spire/v4.9-install-2026-10-08`, an empty branch equal to `main`. Nothing here audits the feature
branch's extra tests (demo build guard G5, demo journey G1).

Machine: macOS 26 (darwin-arm64, M1 Pro, 16 GB). Every timing below is local, measured with
`$EPOCHREALTIME` around one command, cold Nx cache (`--skip-nx-cache`), `NX_NO_CLOUD=true`,
`NX_DAEMON=false`. Exit codes are native process codes. Raw logs live in the session scratchpad and
are not committed; this file is the record.

## 1. Stack

| Item | Value | Evidence |
|---|---|---|
| Languages | TypeScript (React 19 + Vite dashboard, shared TS API client), Rust (Axum/Tokio API, quant-engine) | `nx show projects` |
| Package manager | npm 11.19.0 (Node 26.7.0 from `.nvmrc`); `pnpm` not installed | `nx report` exit 0 |
| Nx | `nx.json` present; nx 23.1.1, plugins `@nx/js/typescript`, `@nx/vite/plugin`, `@nx/vitest`, `@nx/playwright/plugin`, `@nx/eslint/plugin` | `node_modules/.bin/nx report` exit 0 |
| Nx projects | `@convexa/dashboard`, `@convexa/api`, `api` (Rust, run-commands), `dashboard-e2e`, **`tech`** — the last is `.spire/clusters/tech/project.json` (a Spire file) picked up as an Nx project with a `lint` target | `nx show projects`, `nx show project tech` |
| Test runners | Vitest 4 (jsdom) for dashboard + libs/api; `node:test` for tools; Playwright 1.62.1 for browser gates; `cargo test` for Rust | runner output below |
| Rust toolchain | local `rustc 1.98.0` (Homebrew); CI pins `1.97.1`; no `rust-toolchain.toml` | `rustc --version`; `ci.yml` |
| Spire | `.spire/version` = 4.8.0; `.spire/clusters/tech/state/` exists (retirement log goes to `.spire/clusters/tech/state/RETIRED.md`). The v4 kernel is machine-local to Windows; this Mac has the tracked 4.8.0 adapter files only | `.spire/version`; `.spire/installation.json` root `C:/Dev/convexa` |
| Default branch | `main` | `git remote show origin` → HEAD branch: main |
| Earlier ledgers | none (`docs/testing/` did not exist) | `ls docs/testing` |

`npm ci` (frozen lockfile) exit 0, 33 s. npm 11 skipped install scripts for `@swc/core`, `fsevents`×2
and `nx` (`allowScripts` not set); Nx and all suites ran correctly without them.

## 2. Local verification (workflow order, `ci.yml` on `main`)

| # | Command | Exit | Wall | Notes |
|---|---|---|---|---|
| 1 | `npx tsc -p libs/api/tsconfig.lib.json` | 0 | 0.7 s | |
| 2 | `npm run api:contract:check` | 0 | 42.2 s | cold `cargo run --bin export_openapi` |
| 3 | `npm run format:check` | 0 | 10.3 s | |
| 4 | `nx run-many -t lint` (3 projects) | 0 | 6.3 s | |
| 5 | `nx run-many -t typecheck` (2 projects) | 0 | 10.7 s | |
| 6 | Vitest `@convexa/dashboard` | 0 | 85.0 s | 261 files / 3,139 tests; default workers (CI uses `--maxWorkers=2`) |
| 7 | Vitest `@convexa/api` | 0 | 7.4 s | 4 files / 45 tests |
| 8 | `npm run test:tools` | 0 | 87.4 s | 11 files / 150 tests. A direct `node --test` run (no `npm_execpath`) fails 1 test by design (`api-router-integration-baseline.mjs:160-161`) |
| 9 | `nx build @convexa/dashboard --configuration=production` | 0 | 5.1 s | vite "built in 627ms" |
| 10 | `npm run check:bundle` | 0 | 2.1 s | |
| 11 | `cargo test -p api-rust -p quant-engine --locked` | 0 | 197.8 s | 64 binaries / 1,643 passed / 0 ignored; debug compile included |
| 12 | `cargo run --release -- capacity load` (CI env `APP_ENV=dev CONVEXA_CAPACITY_CI_STEP=1`) | 0 | 29.1 s | first attempt without the CI env exit 1 in 217.1 s (3m36s release compile + correct "set APP_ENV" refusal) |
| 13 | `cargo test --test capacity_isolation` | 0 | 13.2 s | |
| 14 | `node --test tools/capacity-gate.spec.mjs` | 0 | 3.3 s | |
| 15–17 | capacity self-tests connector-poison / optional-fault / byte-identity | 0 / 0 / 0 | 4.0 / 2.9 / 20.7 s | |
| 18 | `npm run capacity:baseline` | **1** | 120.7 s | **not runnable on macOS**: "capacity sample failed: unsupported platform" — sampler is `cfg(linux|windows)` only (`apps/api/src/capacity/resources/mod.rs:24-40`) |
| 19 | `npm run browser:chromium` | 0 | 57.2 s | 128/128, 0 flaky (5 workers, local) |
| 20 | `npm run browser:a11y` (`BROWSER_QUALITY_PORT=4212`) | 0 | 32.8 s | 35/35, 0 flaky. First attempt exit 1 in 2.3 s: port 4200 held by the orphaned Vite the chromium gate left behind (mine; stopped) |
| — | `npm run browser:compat` | NOT RUN | | Firefox 1538 / WebKit 2336 not installed locally; no download made |
| — | `npm run browser:visual` | NOT RUN | | baselines exist only for `linux` and `win32` (`apps/dashboard-e2e/src/quality/snapshots/`) |
| 21 | Postgres guardrails (`--features postgres`, own Postgres 16.15 on localhost:54329) | 0 | 4.9 s | 2/2; compile of the postgres feature set took 51.4 s (listing step). CI uses Postgres 17.10 |
| 22 | Postgres release safety | 0 | 9.0 s | 9/9 |
| 23 | `chain_snapshot_export_postgres` (not run by CI) | 0 | 3.0 s | 1/1 |
| 24 | `cargo build --release --features postgres` | 0 | 219.0 s | the production image feature set; release profile shared with step 12 |

**Sum of the green local path** (steps 1–17, 19–23, excluding the macOS-impossible baseline and the
failed first attempts): about 9.5 minutes of wall time on this machine, dominated by `cargo test`
(198 s), Vitest dashboard (85 s), `test:tools` (87 s) and the Chromium gate (57 s).

**Finding — orphaned dev servers.** Run standalone, `apps/dashboard-e2e/tools/run-gate.mjs` leaves its
Playwright `webServer` (Vite) alive with PPID 1 on `[::1]:<port>` (observed twice: 4200, 4212). The next
gate on the same port then fails in ~2 s. This is the `CLAUDE.md` "orphaned dev servers" trap, and it
is reproducible.

## 3. Test inventory (from the runners)

| Suite | Command | Files | Cases | Runs where |
|---|---|---|---|---|
| Vitest dashboard | `nx run @convexa/dashboard:test -- --run --reporter=json` | 261 | 3,139 | CI frontend; `npm test` |
| Vitest libs/api | `nx run @convexa/api:test -- --run --reporter=json` | 4 | 45 | CI frontend; `npm test` |
| Rust api-rust + quant-engine | `cargo test -p api-rust -p quant-engine --locked -- --list` | 203 (55 integration files, 148 unit-test modules) | 1,643 | CI backend; `npm test` (via `nx run api:test`) |
| Rust postgres-gated | `cargo test --features postgres --test … -- --list` | 3 | 12 | CI runs 2 of 3 files (11 cases) |
| node:test tools (top level) | `npm run test:tools` (JUnit) | 11 | 150 | **by hand only**; CI runs `capacity-gate.spec.mjs` (12) |
| node:test supply-chain | `node --test` over 15 hermetic files (not `cli.integration`, `policy`) | 17 | 288 across these 15 + the 20 e2e files below | **no runner** (no script, workflow or tool names them) |
| node:test e2e tools | `node --test` over 20 hermetic files (not `real-negative-controls`) | 21 | (in the 288 above) | **no runner** |
| Playwright Chromium | `playwright test --list --config playwright.config.ts` | 7 | 128 (`no-overflow.spec.ts` 93) | CI `browser:quality` |
| Playwright compat | `--config playwright.compat.config.ts` | 1 | 15 | CI |
| Playwright a11y | `--config playwright.a11y.config.ts` | 1 | 35 | CI |
| Playwright visual | `--config playwright.visual.config.ts` | 1 | 6 | CI (Linux baselines) |
| Playwright audit | `AUDIT_OUT=… --config playwright.audit.config.ts` | 1 | 50 | **no runner** (manual design-fidelity harness) |
| **Total** | | **531 files** | **5,499 counted cases** (+12 postgres; 3 non-hermetic never-run files uncounted) | |

Per-area Vitest split (files / cases / summed file wall): ticker AI-rec 26 / 507 / 166.9 s;
ticker other 49 / 487 / 53.3 s; trading 70 / 1,051 / 91.1 s; auth+alerts 13 / 114 / 25.7 s;
shared+shell+theme 47 / 357 / 16.7 s; other pages 37 / 416 / 52.5 s; root structural + src/lib +
libs/api 23 / 252 / 12.8 s. Rust split: security/contracts 36 / 256; money/math/parsers 42 / 282;
research/tape/archive 41 / 363; flat-file/snapshot/capacity 29 / 154; integration (contracts,
guardrails) 25 / 379 (+12 postgres); integration (capacity, capture, replay) 30 / 209.

### 20 slowest tests (Vitest per-test duration; Rust has no per-test timing on stable)

1. 7.17 s `features/trading/orders/orders.risk.spec.tsx` — scenario harness keyless_scenario_run_not_b…
2. 6.88 s same file — end-to-end rec → order → position
3. 5.40 s `pages/ticker/widgets/ai-rec/ai-rec.absence.spec.tsx` — AC-14 verdict renders unchanged
4. 5.10 s `pages/positions/positions-page.spec.tsx` — track-record AC-1 placement
5. 4.70 s `ai-rec.risk.spec.tsx` — Accept review confirmation writes exactly one position
6. 4.43 s `ai-rec.grounding.spec.tsx` — AC-68 prefill gate end to end
7. 4.17 s `features/trading/broker/broker.integration.spec.tsx` — broker-connect journey
8. 4.13 s `features/auth/aiProviders.flow.spec.tsx` — add / replace / remove per provider
9. 3.92 s `ai-rec.risk.spec.tsx` — create-order confirmation writes one simulated order
10. 3.53 s `ai-rec.risk.spec.tsx` — create-order cancel writes no order
11. 3.49 s `pages/ticker/ticker.risk.spec.tsx` — SSE drop degrades only live tiles
12. 3.37 s `orders.risk.spec.tsx` — server 403 aborts confirm with zero orders
13. 3.17 s `ai-rec.grounding.spec.tsx` — AC-34 prose numbers acquire no marker
14. 3.15 s `shell/shell-live-lifecycle.flow.spec.tsx` — live lifecycle journey
15. 3.09 s `features/trading/shared-entry.flow.spec.tsx` — one shared dialog across both pages
16. 3.05 s `features/trading/positions/positions.risk.spec.tsx` — centerpiece flow
17. 3.03 s `ai-rec.risk.spec.tsx` — conflicting level renders in its own fields
18. 3.00 s `ai-rec.risk.spec.tsx` — scenario transport fault keeps Retry actionable
19. 2.92 s `features/auth/auth.risk.spec.tsx` — session lifecycle
20. 2.91 s `ai-rec.risk.spec.tsx` — denied no-fresh-edge transport fault

Slowest files (wall): `ai-rec.risk.spec.tsx` 79.6 s (73 cases), `ai-rec.grounding.spec.tsx` 40.7 s,
`ai-rec.absence.spec.tsx` 32.0 s, `orders.risk.spec.tsx` 23.2 s. Slowest Rust binaries: lib unit
tests 30.1 s, `capacity_load.rs` 28.6 s, `archive_coverage_runtime.rs` 22.2 s.

### Failures and flakes (each is a finding)

- **CI flake, recurring:** the Chromium gate's AC-35 / U-32 "tap AND keyboard path" cases
  (`apps/dashboard-e2e/src/e2e/curvature-v2.spec.ts:555`) flaked on Linux in runs 36394664105
  (2026-09-28, `main`-based Dependabot PR) and 37750021768 (2026-10-08, feature branch: 2 flaky,
  126 passed). The gate refuses any retry pass (`summary.mjs:87`), so these redden CI. BACKLOG F-L
  (`BACKLOG.md:246-266`) names a product race: `enterTouchDelay={0}` arms a 0 ms timer that
  `touchend` clears. Locally on macOS the gate passed 128/128.
- **Never-run suites are red:** `node --test` over the 35 hermetic never-run files: 288 tests,
  281 pass, **7 fail** —
  `tools/supply-chain/workflow-guard.spec.mjs:24` (the live repo fails the guard:
  `apps/api/Dockerfile:mutable-image`), `scanner-adapters.spec.mjs:43` (stale HEALTHCHECK regex; the
  image now wraps the healthcheck in `convexa-entrypoint`), `publication.spec.mjs:200`
  (`renderSummaryCli` returns 2: `sanitize()` rejects the spec's own fixture; root cause not
  isolated), `candidate.spec.mjs:26` (pass vs blocked), `remediation.spec.mjs:28` (fail vs blocked),
  `apps/dashboard-e2e/tools/visual-frame.spec.mjs:27` (stale launchOptions regex),
  `process.spec.mjs:7` (needs a Windows npm path). NOT RUN, not hermetic:
  `tools/supply-chain/cli.integration.spec.mjs` and `policy.spec.mjs` (network: registry fetch,
  tool downloads, docker), `apps/dashboard-e2e/tools/real-negative-controls.spec.mjs` (spawns
  Playwright and a long-lived server).
- **Supply-chain policy job:** red on every CI run in the last 10 (F-J: `js-yaml` 4 advisories with
  no fixed upstream; `BACKLOG.md:222-236`, `DECISION_LEDGER.md:1239`). Owner-ruled baseline red.
- No skipped tests anywhere: Vitest pending/todo 0, node:test skipped 0, cargo ignored 0.

## 4. Workflows

GitHub plan facts (docs.github.com, fetched 2026-10-08): Free = 2,000 min/month; Linux 2-core
$0.006/min, Windows 2-core $0.010, macOS $0.062; **each job rounds up to the whole minute**
(`/billing/reference/actions-runner-pricing`); Dependabot on standard runners is free
(`/billing/concepts/product-billing/github-actions`). The pricing page lists no OS multipliers; a
"Linux-equivalent" minute here is cost ÷ $0.006. Every workflow below runs on `ubuntu-24.04` only, so
raw = Linux-equivalent.

`gh workflow list --all` (exit 0): CI **active**; Supply-chain evidence **active**; Browser visual
Linux candidates **active**; musl debug **active** (file not on `main`; last run 2026-09-02);
Conformance **disabled_manually**; Deploy smoke **disabled_manually**. The repo is **private**.
(The 2026-10-08 brief said convexa's workflows are disabled; CI and supply-chain are not.)

| Workflow | Class | Triggers | Jobs (runner) | timeout-minutes | Caching | Cron | Billed min/run (45-day median) |
|---|---|---|---|---|---|---|---|
| `ci.yml` CI | ci | `push: main`, `pull_request` | supply-chain (reusable), frontend, backend (+postgres service), capacity-linux — all `ubuntu-24.04` | **none** (360 default) | npm (setup-node), Swatinem rust-cache ×2; **no Playwright browser cache** (installs 3 engines `--with-deps` every run) | — | PR 55 (backend 26, frontend 17, capacity 7, supply-chain 6); push 68 (+artifacts 10) |
| `supply-chain.yml` | ci (also `workflow_call` from CI) | `workflow_call`, `push: main`, `schedule`, `workflow_dispatch` | identity, policy, capabilities, artifacts, aggregate | **none** | npm | `17 3 * * 1` (weekly Mon) | push 15; schedule 6; dispatch 14 |
| `conformance.yml` | ops (prod-public half hits production) + ci (local-auth half) | `push: main`, `schedule`, `workflow_dispatch` | prod-public, local-auth | **none** | npm, rust-cache | `15 6 * * *` (daily) | 13–14 |
| `deploy-smoke.yml` | ops (read-only checks against production) | `push: main`, `workflow_dispatch` | smoke | **none** | — | — | 1 |
| `browser-visual-linux-candidates.yml` | ops (authorized baseline generation) | `workflow_dispatch` | candidates | **none** | npm | — | 4 |

**Billed minutes, last 30 days** (to 2026-10-08, jobs rounded up; Dependabot excluded as free):
CI/pull_request 54 runs 3,502 · CI/push 13 runs 816 · Conformance/schedule 29 runs 234 ·
Supply-chain/push 14 runs 200 · Conformance/push 13 runs 169 · Supply-chain/schedule 4 runs 20 ·
Deploy smoke/push 13 runs 14 · Browser visual/dispatch 1 run 4 → **4,959 Linux minutes**, 2.48× the
2,000 included. At list price the overage is 2,959 × $0.006 ≈ **$17.75 for 30 days**. Run
36571583750 (2026-09-29) was refused: "The job was not started because an Actions budget is
preventing further use."

**Duplicate on every push to `main`:** CI calls supply-chain via `workflow_call` (artifacts path,
10 min) and `supply-chain.yml`'s own `push: main` trigger runs it again (15 min median).

### Last 10 runs per workflow and the cause of each failure

| Workflow | Last 10 | Causes |
|---|---|---|
| CI | 10 failure | supply-chain `policy` red on F-J advisories (10/10; owner-ruled baseline). Frontend `Browser quality gate`: Chromium flake gate on AC-35/U-32 (37750021768, 37743441304, 37737797873 [8 failed], 37732918597, 36394664105, 36394485951, 36394455118). `Bundle size gate`: entry chunk 22.9 KB brotli > 22 KB cap after a vite bump (36394488155) — a correct catch; its four `Upload … evidence` steps then failed only because `if: always()` + `if-no-files-found: error` had nothing to upload (knock-on noise). |
| Supply-chain evidence | 9 failure, 1 cancelled | `policy` red on F-J (9/9) |
| Conformance | 9 success, 1 failure | 36571583750: refused by the Actions budget |
| Deploy smoke | 6 success, 4 failure | Ticker SPY probe expected 200 while production market data was paused (503); fixed by `a6a15859` (2026-09-23) |
| Browser visual Linux candidates | 1 success | — |
| musl debug | 1 success, 1 failure | one-off `debug/musl-build` branch (docker build), 2026-09-02 |

## 5. What waits on CI

- `railway.json` has no CI wait (watch patterns + `preDeployCommand: api-rust postgres-migrate` +
  healthcheck). Railway service `api-rust` (production) reports `source.checkSuites: false`
  (read-only `get-service-config`, 2026-10-08): **deploys do not wait for GitHub checks**.
- No `.railway/`, no `vercel.json`. Cloudflare Pages previews are deployed outside these workflows.
- Branch rules: `gh api repos/ariasr47/convexa/rulesets`, `…/branches/main/protection` and
  `…/rules/branches/main` all return 403 "Upgrade to GitHub Pro or make this repository public" —
  no required checks can exist on this plan.
- Verdict: **not BLOCKED-ON-DEPLOY.**
- Guards that pin workflow text (a CI change must keep them green in the same commit):
  `tools/supply-chain/workflow-guard.mjs:65-82` (requires `supply-chain.yml` to keep
  `push: [main]`, a `schedule:` and the `workflow_dispatch` options, and `ci.yml` to call it),
  `tools/ci-resource-guards.spec.mjs` (backend `cargo clean` steps), Rust
  `api_contract_gate_isolation.rs`, `capacity_isolation.rs`, `capacity_baseline_isolation.rs`
  (read `ci.yml`), `apps/dashboard-e2e/tools/wiring.spec.mjs`.

## 6. Hooks (read only)

- `git config --get core.hooksPath` → exit 1 (unset).
- No tracked hooks folder (`.githooks`, `tools/hooks` absent).
- `.git/hooks/` (shared by every worktree): only `*.sample` files; **no `pre-push`**.
