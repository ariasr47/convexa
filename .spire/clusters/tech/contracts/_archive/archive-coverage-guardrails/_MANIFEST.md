# archive-coverage-guardrails — pipeline manifest
Stage:        GATE S — shipped and archived after supplemental CI resource correction
Repos:        backend
Brief:        BRIEF.md present
Contracts:
  - SPEC.md                    locked
  - INTERFACE_CONTRACT.md      locked
Open amendments: none; GATE_Z_HOSTED_CI_DISK.md satisfied by exact-SHA hosted rerun
QA (GATE Q):  QA_REPORT PASS; supplemental CI review 10 PASS / 0 FAIL / 0 UNVERIFIABLE @ c88ddf10623c98e81e3584e4eb30363dae14ea73
Workers:      backend=[B1-core-policy,B2-readonly-audit] closer=B4-backend-closer; frontend=[B5-typecheck-fixture] closer=B5-typecheck-fixture; ci=[B6-ci-runner-disk]
Last gateway:  GATE S after supplemental QA PASS 10/10 and exact-SHA hosted CI success @ 2026-08-27 UTC
Corrections:
  - B4 owns apps/api/src/routes/mod.rs only to register the approved metrics coverage DTO schemas for OpenAPI generation
  - B4 owns apps/api/tests/fixtures/capacity-baseline/v1/identity/manifest.json only to refresh deterministic generated API/client hashes; the reference revision and all ticker/SSE/decision oracle hashes remain locked
  - B4 owns apps/api/src/capacity/identity.rs only to synchronize its five API_ARTIFACTS hash constants with the same deterministic current artifact bytes; no capacity logic or other oracle may change
  - B5 owns apps/dashboard/src/app/pages/operator-metrics/useLatencyTrend.spec.tsx only to add the required session_archive_coverage member to the existing MetricsAggregate fixture; production UI, hooks, copy, styling, navigation, and behavior remain locked
  - B6 owns .github/workflows/ci.yml and tools/ci-resource-guards.spec.mjs only to free default-feature Rust artifacts before PostgreSQL compilation; application, database, API, scoring, UI, deployment, and runtime behavior remain locked
