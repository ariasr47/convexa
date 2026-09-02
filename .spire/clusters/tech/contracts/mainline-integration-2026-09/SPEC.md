# mainline-integration-2026-09 — spec

**Source brief:** .spire/clusters/tech/contracts/mainline-integration-2026-09/BRIEF.md
**Council:** none — owner-directed integration fast-path (ruling A, 2026-09-01). The product design of
every feature being landed is already locked in its own archived SPEC; this spec governs only the merge.
**Status:** APPROVED 2026-09-01 (owner ruling A)

## 1. Goal + scope

Produce one merge commit on branch `spire/mainline-integration-2026-09` whose parents are `origin/main`
(`52d6cfd3`) and `origin/codex/browser-quality-gates` (`6cb93812`), in which both lines' code compiles,
tests pass, every promoted conformance spec passes against the merged server, and hosted CI is green.

**In scope:** conflict resolution in the 22 code/tooling files left unmerged after the conductor's
pass; regeneration of generated artifacts; a holiday-calendar parity test; the builder conformance
receipt. **Out of scope:** any product behavior change, any new route or field, any change to
opportunity score / tier / fingerprint, retiring either capacity harness or either coverage
implementation (owner rulings D2/D3 are queued and separate), dashboard source edits beyond what the
branch already ships. **Future:** unify the two capacity harnesses and the two coverage builds under
their own features once the owner rules.

## 2. Architecture — conflict resolution rules (binding on the backend lane)

The conductor has already resolved and staged: `.spire/**` records and canon (branch's
archive-coverage record landed as `_archive/archive-coverage-guardrails-research-read/`, its conformance
JSON as `state/conformance/archive-coverage-guardrails-research-read.json`), `.spire/installation.json`
and `.spire/version` (main's 3.19.1), `docs/**`. The lane must not touch those paths.

| files | rule |
|---|---|
| `apps/api/src/main.rs` | keep every clap subcommand from both parents: main's `ArchiveCoverageAudit`, `CapacityBaseline`, `ExportChainSnapshots`, `Healthcheck`; branch's `Capacity { Load, Soak }`, `ArchiveCoverage`, `SessionDayTape`, `SessionDayReplay`, `FlatFiles { Keep }`. No subcommand is dropped or renamed. |
| `apps/api/src/state.rs`, `routes/{price,stream,ticker}.rs`, `services/analytics.rs`, `infrastructure/massive/ws.rs` | union of both parents' additions; where both edited the same function, the branch's harness-only hub (`StockStreamHub` without `HubCmd` enqueue) and main's lifecycle probes must both survive; inspect the code, do not trust either record's prose (`cited-code-is-verified-not-assumed`). |
| `services/session_chain_archive/{coverage,ensure_worker,mod}.rs` | both coverage implementations stay: main's `CoveragePolicy` + `market_calendar` + audit feed `/api/_metrics`; the branch's coverage evaluator feeds `routes/research_session_coverage.rs`. One calendar source: main's `calendars/xnys_full_day_2026_2035.v1.json` (`shared-session-eligibility-calendar`); if the branch's evaluator carries its own date set, point it at the shared calendar. |
| `apps/api/project.json` | keep main's `capacity-baseline*` targets and add the branch's `capacity-load` / `capacity-soak` targets. |
| `apps/api/openapi/*.json`, `libs/api/src/generated/schema.ts` | never hand-merge; regenerate from the merged router with the repo's `api:contract` scripts (`package.json`), then `npm run api:contract:check` must exit 0. |
| `tools/api-contract*.mjs`, `tools/api-router-integration-*.mjs` | take the branch's versions where they are supersets of main's (branch commit `fe3d7926`); run `node --test tools/*.spec.mjs` for the touched specs; keep main's behavior where a main-only test would break. |
| `.github/workflows/ci.yml` | main's structure is the base (postgres jobs, `Free … build space` steps, `contract_base_revision`, `ref:` inputs, `# vX.Y.Z` pin comments); add the branch's `Capacity load harness` step (`cargo run -p api-rust --locked --release -- capacity load`, env `CONVEXA_CAPACITY_CI_STEP=1`, `APP_ENV=dev`) after `Cargo test` in the backend job. |
| `Cargo.lock` | auto-merged; `cargo build --locked` must succeed without further edits, else re-resolve with `cargo update -p <crate> --precise` only for crates the branch added. |

## 3. Acceptance criteria

| # | Criterion (observable) | Verify by |
|---|---|---|
| AC-1 | On the integration branch, `git merge-base --is-ancestor origin/main HEAD` and `git merge-base --is-ancestor origin/codex/browser-quality-gates HEAD` both exit 0, and `git grep -n -E '^(<<<<<<<|=======|>>>>>>>)'` over the tree prints nothing. | review |
| AC-2 | `cargo test -p api-rust -p quant-engine --locked` exits 0 on the merged tree. | test |
| AC-3 | `npx tsc --build --force` for `apps/dashboard/tsconfig.app.json` and `tsconfig.spec.json`, `npx nx test @convexa/dashboard --skip-nx-cache`, and `npx nx lint @convexa/dashboard --skip-nx-cache` each exit 0. | test |
| AC-4 | `npm run api:contract:check` exits 0 and `git diff --stat -- apps/api/openapi libs/api/src/generated` shows the artifacts were regenerated (both changed relative to `origin/main`), not hand-merged. | test |
| AC-5 | With the backend served the project way, `node .claude/tools/gates.mjs interface_conformance --contract .spire/clusters/tech/contracts/mainline-integration-2026-09/INTERFACE_CONTRACT.md --url <base> --report …` reports `verdict: PASS`. | test |
| AC-6 | With the backend served, every JSON under `.spire/clusters/tech/state/conformance/` passes individually via `interface_conformance --spec <file> --url <base>` (including the six branch-promoted specs and `archive-coverage-guardrails-research-read.json`); the run log lists each file with its verdict. | test |
| AC-7 | `cargo run -p api-rust -- --help` lists both `capacity-baseline` and `capacity` (with `load` and `soak`), both `archive-coverage-audit` and `archive-coverage`, plus `session-day-tape`, `session-day-replay`, `flat-files`. | review |
| AC-8 | `npm run capacity:baseline:self-test:byte-identity` exits 0 (v1 harness; score/tier/fingerprint byte-identical to the approved artifacts) and `cargo run -p api-rust --locked --release -- capacity load` exits 0 printing `CAPACITY HARNESS`, `NOT A PRODUCTION MEASUREMENT` and `Evidence: local` (v2 harness). | test |
| AC-9 | For each of the six branch records under `contracts/_archive/` and for `_archive/archive-coverage-guardrails-research-read/`, `git diff origin/codex/browser-quality-gates:<branch path> HEAD:<landed path>` is empty (records land verbatim); main's `_archive/archive-coverage-guardrails/` and `_archive/browser-quality-gates/` are byte-identical to `origin/main`. | review |
| AC-10 | `OPEN_THREADS.md`, `BACKLOG.md`, `PROJECT_CONTEXT.md` contain every `## ` heading of both parents exactly once, with the branch's colliding thread numbers renumbered (no two sections share a `7a?` number). | review |
| AC-11 | A checked-in test `tools/holiday-calendar-parity.spec.mjs` proves the dashboard's `nyseFullDayHolidays.ts` date set equals the backend `xnys_full_day_2026_2035.v1.json` set for every year both cover, and `node --test tools/holiday-calendar-parity.spec.mjs` exits 0. | test |
| AC-12 | On the pushed integration branch, the hosted `CI`, `Supply-chain evidence` and `Deploy smoke` workflows conclude `success` for the merge commit (`gh run list --branch spire/mainline-integration-2026-09`). | test |
| AC-13 | `node .claude/tools/gates.mjs contract_lint mainline-integration-2026-09` exits 0 and `node .spire/bin/spire.mjs run tech --provider claude` exits 0 in the merged tree. | review |

## 4. Component states / UI

No new user-facing surface. The dashboard files that change are the branch's already-QA'd feature code
(research-lab-surface, holiday list, structural specs) landing unchanged. The design canon is SET; no
copy changes.

## 5. Error handling

A merge that cannot satisfy both parents' contracts for the same field is a **GATE Z bounce**, not a
judgment call in the lane: the lane records the field, both expected shapes, and stops. A failing
promoted spec is likewise a bounce. Nothing is weakened to pass.

## 6. Interface

The FE↔BE truth for this feature is `INTERFACE_CONTRACT.md` in this folder: the union of the seven
archived contracts' conformance probes. It is referenced here, never restated.

## 7. Testing strategy

Backend lane: `cargo test` per crate, the two CLI smoke runs (AC-7/AC-8), the new parity test (AC-11),
regeneration plus `api:contract:check` (AC-4), a full local conformance sweep (AC-5/AC-6) before writing
`conformance-receipt.json`. QA re-runs AC-1..AC-11 fresh and owns AC-12 after the push. Session budget
applies: checkpoint to `RESUME.md` at a clean boundary rather than pushing a deep session.
