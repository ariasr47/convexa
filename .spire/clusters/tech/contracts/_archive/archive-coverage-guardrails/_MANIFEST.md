# archive-coverage-guardrails — pipeline manifest
Stage:        GATE S — shipped and archived
Repos:        backend
Brief:        BRIEF.md present
Contracts:
  - SPEC.md                    locked
  - INTERFACE_CONTRACT.md      locked
Open amendments: none
QA (GATE Q):  QA_REPORT PASS
Workers:      backend=[B1-core-policy,B2-readonly-audit] closer=B4-backend-closer; frontend=n/a
Last gateway:  GATE S after QA PASS 23/23 and independent live conformance PASS 1/1 @ 2026-08-26
Corrections:
  - B4 owns apps/api/src/routes/mod.rs only to register the approved metrics coverage DTO schemas for OpenAPI generation
  - B4 owns apps/api/tests/fixtures/capacity-baseline/v1/identity/manifest.json only to refresh deterministic generated API/client hashes; the reference revision and all ticker/SSE/decision oracle hashes remain locked
  - B4 owns apps/api/src/capacity/identity.rs only to synchronize its five API_ARTIFACTS hash constants with the same deterministic current artifact bytes; no capacity logic or other oracle may change
