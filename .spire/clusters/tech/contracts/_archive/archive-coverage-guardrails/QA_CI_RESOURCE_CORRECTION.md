# QA — hosted CI resource correction

**Branch:** `codex/archive-coverage-guardrails`  
**Committed base:** `60f8b46f3d31834509655dd0fe2ed2d588fc296b`  
**Scope:** independent verification of `GATE_Z_HOSTED_CI_DISK.md`; no product repair performed

| Check | Verdict | Independent evidence |
| --- | --- | --- |
| Correction scope | PASS | `git diff --name-only HEAD --` reports only `.github/workflows/ci.yml` and `tools/ci-resource-guards.spec.mjs`; the only other working-tree byte is the untracked accepted GATE-Z note. No product, API, database/schema/data, scoring, UI, runtime, dependency, Railway, Docker, or deployment source is changed. |
| Workflow order | PASS | Current workflow lines 185–216 execute default-feature `Cargo test` → `Free default-feature debug build space` (`cargo clean`) → both PostgreSQL debug tests → evidence upload → retained `Free debug build space` (`cargo clean`) → PostgreSQL release build. |
| RED / guard non-vacuity | PASS | The new guard's exact ordering predicate was executed against `HEAD:.github/workflows/ci.yml`, where the pre-PostgreSQL cleanup is absent. It exited `1` at `cleanup must follow the default-feature Rust tests`. |
| Focused GREEN | PASS | `node --test tools/ci-resource-guards.spec.mjs` exited `0`: 2 tests, 2 pass, 0 fail/skip/todo. Both cleanup-order assertions passed. |
| Full tools suite | PASS | `npm run test:tools` exited `0`: 145 tests, 145 pass, 0 fail/cancelled/skipped/todo. |
| Format and diff integrity | PASS | `npx prettier --check .github/workflows/ci.yml tools/ci-resource-guards.spec.mjs` exited `0`; Prettier parsed the workflow; `git diff --check` exited `0`. |
| Interface/runtime continuity | PASS | `git diff --name-only HEAD --` over the archived `INTERFACE_CONTRACT.md`, `apps/api`, `libs/api`, `apps/dashboard`, `docs`, Railway/Docker files, Cargo manifests, package manifests, and Nx configuration returned zero paths. The archived live `conformance-receipt-qa.json` therefore remains authoritative: `PASS`, 1/1 endpoint, 27 required fields, checked `2026-08-27T02:12:23Z`. |
| Critical security/integrity sweep | PASS | The changed workflow and source guard introduce no authn/authz, tenant, secret, destructive-data, product-state, or binding-invariant path. No Critical finding. `NO_UI_CHANGE` remains exact; no browser/design surface exists to inspect. |
| Fresh hosted backend proof on corrected bytes | UNVERIFIABLE | The correction is uncommitted. `origin/codex/archive-coverage-guardrails` still points to `60f8b46f3d31834509655dd0fe2ed2d588fc296b`, so no hosted run can contain these bytes. The latest run, GitHub Actions `33032735899` / backend job `98388695221`, is the pre-correction failure: default Cargo tests passed, the first PostgreSQL compile failed with `No space left on device (os error 28)`, and the later PostgreSQL test, evidence, cleanup, and release build did not complete successfully. |

SUMMARY: 8 PASS / 0 FAIL / 1 UNVERIFIABLE

NOTE: VISUAL_EVIDENCE_UNAVAILABLE

GATE Q: FAIL

Amendments bounced to CI / backend verification:

- Commit and push the exact reviewed correction, then observe one fresh hosted backend job on that commit.
- The hosted job must pass the default-feature suite, the pre-PostgreSQL cleanup, both PostgreSQL checks, evidence upload, the retained pre-release cleanup, and the PostgreSQL release build without disk exhaustion.
- Re-open this supplemental gate only against that exact hosted SHA; local green evidence does not substitute for the required bounded-runner observation.
