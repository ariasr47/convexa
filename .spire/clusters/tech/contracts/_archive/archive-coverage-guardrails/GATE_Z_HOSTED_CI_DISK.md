# GATE Z — hosted backend runner disk correction

Status: ACCEPTED
Owner: CI / backend verification
Task: B6-ci-runner-disk

## Observed failure

GitHub Actions run `33032735899`, backend job `98388695221`, passed the complete default-feature
Rust suite and then failed while compiling `production_runtime_guardrails_postgres` with
`No space left on device (os error 28)`. The runner reported 19 MB free. The PostgreSQL service
itself was healthy; the later release-safety test and release build were skipped.

## Narrow correction

Add one `cargo clean` step between the default-feature Rust test suite and the first PostgreSQL-
feature test. Retain the existing cleanup between PostgreSQL evidence and the production release
build. This separates three incompatible build modes on the bounded hosted runner without changing
application, database, API, scoring, dashboard, deployment, or runtime behavior.

The implementation may edit only `.github/workflows/ci.yml` and the colocated resource-order guard
in `tools/ci-resource-guards.spec.mjs`.

## Required proof

- RED: the resource-order guard fails when the pre-PostgreSQL cleanup is absent.
- GREEN: `node --test tools/ci-resource-guards.spec.mjs` passes both cleanup-order assertions.
- `npm run test:tools` passes on the final bytes.
- Prettier and `git diff --check` pass for the changed files.
- A fresh hosted backend job passes the default tests, both PostgreSQL checks, evidence upload, and
  PostgreSQL release build without exhausting disk.
- No product, API, database schema/data, scoring, UI, deployment configuration, or runtime source
  changes are present.
