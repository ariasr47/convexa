# RESUME-B5 — archive-coverage-guardrails

**Resume status:** DONE

## Done

- Direct-edited `apps/api/openapi/precutover-operation-baseline.json`: added
  `GET /api/_research/session-archive/coverage`; `operation_count` **53**
- Pins 52→53: `api_contract_parity.rs`, `api_contract_router.rs`,
  `tools/api-contract.mjs` (`validateRegistrationPairs` default + `baseline()` length),
  `tools/api-contract.spec.mjs` (pairing title + both length asserts + inventory)
- `tools/api-contract.mjs` maps `session-archive` **before** `session` in
  `routeSourceModule` / `routeResponseType` (`CoverageResponse`) /
  `sourceRegistryTarget` → `research_session_coverage.rs::contract_representative_response`
- Regenerated via live `npm run api:contract:generate`: OpenAPI, parity, manifest,
  boundary-evidence, `libs/api/src/generated/schema.ts`
- Boundary evidence macro + `ids.len()` 181→185; path count 45→46; HTTP harness
  observed 52→53
- Frozen compile-probe id `openapi-router-integration-all-52` left historical

## Verified

- RED (pre-edit): router 3 fail (53 vs 52); parity typed-responses / paths / bijection;
  node pairing `53/52`
- `npm run api:contract:generate` → EXIT=0
- `npm run api:contract:check` → EXIT=0
  (`API contract check passed: generated artifacts match the Rust API contract.`)
- `cargo test -p api-rust --test api_contract_router -- --nocapture` → **7 passed**, EXIT=0
- `cargo test -p api-rust --test api_contract_parity -- --nocapture` → **216 passed**, EXIT=0
- `node --test tools/api-contract.spec.mjs` → **61 passed**, EXIT=0
- Facades (`convexa.ts` / `client.ts` / `broker.ts`) have no coverage helper
- Archived compile-probe receipt untouched; NUL scan = 0 on all B5 paths

## Next (not this task)

- **B6** isolation + HTTP evidence (`archive_coverage_guardrails*.rs`,
  `api_contract_runtime_auth_research.rs`)
- **B7** closer receipt only

## Gotchas

- Do **not** use `api:contract:baseline:accept` (would amend INTERFACE_CONTRACT.md)
- `api-contract-baseline.mjs candidate` still reads frozen revision → **52** ops;
  that historical assert stays 52
- Do not retarget `validateCompileProbeReceipt` / probe_id `…-all-52`
- No `conformance-receipt.json` in B5
