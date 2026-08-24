# api-contract-generation — implementation plan

**Goal:** make the existing Rust HTTP boundary the executable source of truth for all 52 production
operations, generate deterministic checked OpenAPI and TypeScript artifacts from it, and preserve the
public `@convexa/api` API and every runtime/UI behavior.

**Architecture:** route-owned Serde/utoipa DTOs and concrete response enums feed one
`OpenApiRouter<AppState>`. A pure exporter and repository-owned Node orchestrator produce canonical
OpenAPI, schema-v2 two-tier executable parity coverage, `openapi-typescript` types, and a structured
artifact manifest.
Ordinary HTTP goes through one `openapi-fetch` client behind the existing facade; the one native
`EventSource` adapter retains lifecycle ownership. An immutable source-parsed pre-cutover baseline
prevents runtime and OpenAPI from co-omitting an operation.

**Stack:** Rust 2021; Axum `0.8.9`; utoipa `5.5.0`; utoipa-axum `0.2.0`; Serde; Node built-ins;
openapi-typescript `7.13.0`; openapi-fetch `0.17.0`; TypeScript `5.9.3`; Nx 23; Vitest; hermetic
Axum/Tower fixtures.

## Global Constraints

- `NO_WIRE_BEHAVIOR_CHANGE` and `NO_UI_CHANGE`: preserve every method, path, status, meaningful
  header, media type, body meaning, auth/cookie rule, redirect, SSE behavior, public export, score,
  tier, fingerprint, quant result, route, link, copy, and state.
- B0 is a hard stop. A real handler annotation contains no parallel `responses(...)`; its concrete
  return enum owns Axum `IntoResponse` and utoipa `IntoResponses`. If a status/header/media/body
  mutation does not automatically change/fail the emitted response contract, stop at GATE Z before B1.
- Capture and accept the 52-operation baseline before changing `apps/api/src/routes/mod.rs`. Generate,
  check, CI, build, and release have read-only access to it.
- `apps/api/src/routes/mod.rs` is the only post-cutover runtime/OpenAPI registration graph. Register one
  operation per `.routes(routes!(handler))`; aliases use distinct thin handlers. Preserve stream route
  order. Do not add a handwritten operation list.
- HTTP/OpenAPI types stay under `apps/api/src/routes/**` plus `apps/api/src/openapi.rs`. Services,
  domain modules, and `libs/quant-engine/**` remain free of utoipa and wire concerns.
- Typed JSON uses concrete DTOs and typed maps. Required-nullable, omitted optional, empty, unknown,
  and inapplicable remain distinct. A closed policy may classify genuine free-form/HTML/redirect/
  bodyless surfaces, but cannot hide a typed wire shape.
- OpenAPI owns SSE parameters, event DTOs, pre-stream errors, headers, and `text/event-stream`. Only
  `GET /api/stream/{ticker}` at `libs/api/src/lib/convexa.ts#streamTicker` may remain a manual native
  EventSource lifecycle adapter; it imports generated types and never becomes an HTTP fallback.
- The committed artifact set is exactly the immutable baseline plus mutable
  `convexa.openapi.json`, `parity-coverage.json`, `schema.ts`, and
  `generated-artifacts.manifest.json`. JSON remains valid and receives no comment/marker field.
  `schema.ts` alone starts at byte zero with the contracted three comment lines and one newline.
- Generate/check are offline after installation, deterministic across time/root, and pure: no state,
  listener, worker, store, vendor, production config, runtime values, origin, secret, SHA, timestamp,
  random id, or absolute path enters ordinary generated output. Failed installation restores the full
  prior mutable set; check never writes.
- `parity-coverage.json` uses schema version `2` and only the top-level fields contracted by
  `INTERFACE_CONTRACT.md`: source-derived operations/boundaries, two closed evidence modes, closed
  runtime-router rows, one evidence catalog, one normalizer catalog, and a direct-HTTP scenario
  projection. Response-conversion evidence is bijective with the 181 derived material boundaries;
  direct HTTP is risk-tiered but covers all 52 source-derived operations. No generator-authored second
  operation/outcome map, generic catalog assignment, unexecuted fixture row, or relabeled request counts
  as evidence. Referenced, catalogued, implemented, and observed IDs are set-equal in their mode.
- Consumers import only `@convexa/api`. Facade wire names may be pure indexed aliases into generated
  `paths`/`operations`/`components`; handwritten property-shape duplication, arbitrary JSON casts, and
  generated deep imports fail the normal check.
- Stage and commit only task-owned paths. Preserve unrelated dirty provider/Spire installation files.
  Use scoped formatting. An implementation conflict with the approved contract returns to GATE Z.

## Conformance spec

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/health",
      "path_params": {},
      "query": {},
      "required": {
        "status": "string",
        "service": "string",
        "price_cache": "string",
        "durable_store": "string",
        "data_feed": "string",
        "gex_kernel": "string",
        "scanner.enabled": "boolean",
        "scanner.embedded": "boolean",
        "scanner.board.rows": "number",
        "rate_limit.public_per_min": "number",
        "rate_limit.enabled": "boolean",
        "metrics_auth": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/health",
      "path_params": {},
      "query": {},
      "required": {
        "status": "string",
        "service": "string",
        "price_cache": "string",
        "durable_store": "string",
        "data_feed": "string",
        "gex_kernel": "string",
        "scanner.enabled": "boolean",
        "scanner.embedded": "boolean",
        "scanner.board.rows": "number",
        "rate_limit.public_per_min": "number",
        "rate_limit.enabled": "boolean",
        "metrics_auth": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/auth/session",
      "path_params": {},
      "query": {},
      "required": {
        "authenticated": "boolean",
        "user": "object|null",
        "google_available": "boolean",
        "settings": "object|null",
        "demo_seed": "object|null"
      }
    },
    {
      "method": "POST",
      "path": "/api/auth/logout",
      "path_params": {},
      "query": {},
      "required": {
        "authenticated": "boolean"
      }
    }
  ]
}
```

## Backend and shared-foundation track

### B0 — Prove concrete response inference or stop

**Files:** `apps/api/Cargo.toml`; `Cargo.lock`; `apps/api/src/routes/health.rs`.

1. Add exact Cargo pins:

   ```toml
   utoipa = { version = "=5.5.0", features = ["axum_extras", "auto_into_responses"] }
   utoipa-axum = "=0.2.0"
   ```

2. First add focused tests proving `/api/health` runtime status/headers/body match the pre-edit fixture,
   its `#[utoipa::path]` has no `responses(...)`, and emitted responses equal the concrete
   `HealthResponse::responses()` set. Observe the response-inference test red before conversion.
3. Introduce concrete `HealthPayload` and `HealthResponse` route types; implement `IntoResponse` on the
   enum and derive `IntoResponses`. Annotate the real handler with only method, path, operation id,
   parameters/security, and return `HealthResponse`.
4. Run the focused tests green; mutate the enum's `200` to `201`, observe the emitted-contract test red,
   restore `200`, and rerun green. If this requires a handler response list or stays green, stop with
   `GATE Z: auto_into_responses cannot bind concrete handler response sets`.
5. Run `cargo tree -p api-rust -i axum` and require one Axum `0.8.9`; commit
   `test(api): prove structural response inference`.

### B1 — Add the refusing pre-cutover route parser

**Files:** `tools/api-contract-baseline.mjs`; `tools/api-contract-baseline.spec.mjs`; `package.json`.

1. Add scripts:

   ```json
   "api:contract:baseline:candidate": "node tools/api-contract-baseline.mjs candidate",
   "api:contract:baseline:accept": "node tools/api-contract-baseline.mjs accept"
   ```

2. Write 12 Node tests, initially red, for literal and multiline `.route()` calls, chained
   GET/POST/PUT/DELETE, sorting, duplicates, dynamic paths, unknown combinators, unconsumed `.route(`,
   empty input, exact hashes/revision, initial acceptance, reviewed-change acceptance, tamper detection,
   and atomic refusal.
3. Implement a balanced Rust-token scanner that recognizes only literal Axum registrations and refuses
   every unsupported registration instead of skipping it. Candidate output records schema version,
   full 40-hex source revision, router path/hash, tool path/hash, parser version, exact command/time,
   count, and sorted unique uppercase method/path pairs.
4. Implement `accept` as the sole same-directory-temp/rename writer. Initial mode requires absence of
   the baseline and exact equality to the interface's 52 rows. Update mode requires the exact
   `API_BASELINE_CHANGE_APPROVED` candidate hash, exact added/removed pairs, reason, provenance, clean
   diff, and verified source/tool hashes.
5. Run `node --test tools/api-contract-baseline.spec.mjs`; require 12 passed, 0 failed. Commit
   `feat(api): add refusing precutover route capture`.

### B2 — Capture the immutable 52-operation baseline

**Files:** `apps/api/openapi/precutover-operation-baseline.json`.

1. Confirm `apps/api/src/routes/mod.rs` is unchanged from the committed pre-cutover graph, then run:

   ```powershell
   $sourceRevision=(git rev-parse HEAD).Trim()
   npm run api:contract:baseline:candidate -- --source-revision $sourceRevision --out .tmp/api-contract-baseline-candidate.json
   npm run api:contract:baseline:accept -- --initial --candidate .tmp/api-contract-baseline-candidate.json --review-contract .spire/clusters/tech/contracts/api-contract-generation/INTERFACE_CONTRACT.md --reason api-contract-generation-precutover --reviewer-provenance GATE-I-interface-inventory-reviewed-2026-08-22
   ```

2. Assert the exact interface schema, 52 sorted unique pairs, `POST /api/auth/logout`, no DELETE logout,
   full revision, router/tool hashes, capture commands/time, and initial acceptance provenance. Re-run
   accept and require refusal with byte-identical baseline.
3. Commit only the baseline as `chore(api): lock the 52-operation precutover baseline`, recording its
   SHA-256 in the commit body.

### B3 — Establish shared contract policy

**Files:** `apps/api/src/openapi.rs`; `apps/api/src/lib.rs`;
`apps/api/tests/api_contract_policy.rs`.

1. Write five red policy tests for closed/value-free security modes; required-nullable versus optional
   versus empty; typed-map refusal of unconstrained values; closed specialized-surface/risk vocabularies;
   and absence of utoipa/OpenAPI authority from domain/services/quant.
2. Add shared route-boundary primitives:

   ```rust
   pub enum SecurityMode { Public, OptionalSession, Session, OperatorToken, OAuthState }
   pub enum SurfaceClass { Json, Html, Redirect, Bodyless, Sse, OperatorResearch, Alias }
   pub const RISK_CLASSES: [&str; 9] = [
       "success-json", "declared-error-json", "auth-denial", "cookie-set-or-clear",
       "redirect", "html-or-empty-body", "sse-stream", "null-absent-empty",
       "operator-trader-isolation",
   ];
   #[derive(serde::Serialize, utoipa::ToSchema)]
   pub struct WireError { pub error: String, pub message: String }
   ```

   Add OpenAPI security schemes without values/examples and response helpers for `Set-Cookie`,
   `Location`, `Retry-After`, HTML, no-body, and SSE. Helpers are consumed by response enums, never a
   parallel handler response list.
3. Make the structural test scan `apps/api/src/domain`, `apps/api/src/services`, and
   `libs/quant-engine`; prove each in-memory poison is caught. Run 5 passed, 0 failed and commit
   `feat(api): add route contract policy`.

### B4a — Type public, metrics, market, demo, and stream routes

**Files:** `apps/api/src/routes/demo.rs`; `apps/api/src/routes/health.rs`;
`apps/api/src/routes/price.rs`; `apps/api/src/routes/market.rs`;
`apps/api/src/routes/candidates.rs`; `apps/api/src/routes/contract.rs`;
`apps/api/src/routes/ticker.rs`; `apps/api/src/routes/stream.rs`.

1. Add failing route matrices for interface rows 1–5, 12–21, and 51–52. For every operation add one
   stable operation id, concrete path/query/request/success/error/event DTOs, one response enum,
   exact security/surface classification, and evidence/risk extensions. Add thin alias handlers for
   `/`, `/demo`, `/health`, and `/api/health` where distinct operation identities require them.
2. Replace handler-boundary `Json<Value>`/erased responses with concrete route types and explicit
   conversions while preserving service/domain computation. Every response enum declares all observed
   status/header/media/body arms. SSE declares event DTOs, pre-stream errors, headers, and
   `text/event-stream` without changing cadence, capacity, heartbeat, or reconnect behavior.
3. Run the owned module and runtime-fixture tests; require all rows accounted for and byte/semantic
   parity green. Commit `feat(api): type public market and stream contracts`.

### B4b — Type book, auth, broker, recommendation, and gate routes

**Files:** `apps/api/src/routes/book.rs`; `apps/api/src/routes/auth.rs`;
`apps/api/src/routes/broker.rs`; `apps/api/src/routes/recommendation.rs`.

1. Add failing matrices for rows 10–11 and 22–44, including public/optional/required/OAuth modes,
   validation/conflict/non-enumerating refusals, no-mutation gates, cookies, redirects, absent/null,
   and write-only secret non-egress.
2. Convert each handler to route-owned DTOs and a concrete response enum. Keep `POST` as the sole logout
   method. Declare `Set-Cookie`/`Location` and every real error status, but preserve existing server-side
   `require_user`, encryption, rate/cooldown, and simulated-trade gate enforcement.
3. Run auth, cookie, book, broker, recommendation, positions-gate, and production-guardrail suites.
   Commit `feat(api): type identity and durable contracts`.

### B4c — Type research and scanner routes

**Files:** `apps/api/src/routes/research_chain_snapshots.rs`;
`apps/api/src/routes/research_session_books.rs`; `apps/api/src/routes/scan.rs`.

1. Add failing matrices for rows 6–9 and 45–50 with exact operator-token denial/success, stored-source
   provenance, zero vendor calls, scanner optional/session modes, and absent/empty history semantics.
2. Add route-owned DTOs/response enums and typed maps. Do not introduce vendor/recompute calls, trader
   links, request-path scanner recomputation, or client-side auth authority.
3. Run research, scanner, isolation, and policy suites. Commit
   `feat(api): type research and scanner contracts`.

### B5 — Cut over to one runtime/OpenAPI graph and pure exporter

**Files:** `apps/api/src/routes/mod.rs`; `apps/api/src/server.rs`;
`apps/api/src/bin/export_openapi.rs`; `apps/api/tests/api_contract_router.rs`.

1. Add seven red tests for exactly 52 unique method/path pairs, stable unique operation ids, closed
   specialized classifications, runtime/OpenAPI shared mutation, baseline equality, fallback/implicit
   runtime behavior, and pure deterministic export.
2. Replace the router builder with this sole shape and enumerate every real handler once:

   ```rust
   pub fn contract_router() -> utoipa_axum::router::OpenApiRouter<AppState> {
       OpenApiRouter::new()
           .routes(routes!(demo::progressive_demo))
           .routes(routes!(demo::progressive_demo_alias))
           // one separate .routes(routes!(handler)) for each remaining operation
           .routes(routes!(stream::stream_prices))
           .routes(routes!(stream::stream_ticker))
   }
   pub fn router(state: AppState) -> axum::Router {
       let (router, _) = contract_router().split_for_parts();
       router.with_state(state)
   }
   pub fn openapi() -> utoipa::openapi::OpenApi {
       let (_, document) = contract_router().split_for_parts();
       document
   }
   ```

3. Keep server middleware/state attachment order unchanged. The exporter calls only `routes::openapi()`,
   recursively orders maps, and writes pretty UTF-8 JSON with one newline to stdout; a structural test
   rejects config/state/service/store/vendor/server imports.
4. Delete one test operation from the shared graph and prove runtime/OpenAPI both lose it but the
   immutable baseline still fails with the named pair. Restore; require 7 passed, 0 failed. Commit
   `refactor(api): share runtime and OpenAPI graph`.

### B6 — Build the deterministic artifact, parity, and drift pipeline

**Files:** `tools/api-contract.mjs`; `tools/api-contract.spec.mjs`; `package.json`;
`package-lock.json`; `libs/api/package.json`; `apps/api/openapi/convexa.openapi.json`;
`apps/api/openapi/parity-coverage.json`; `apps/api/openapi/generated-artifacts.manifest.json`;
`libs/api/src/generated/schema.ts`; `apps/api/tests/api_contract_parity.rs`;
`apps/api/tests/api_contract_response_conversion.rs`;
`apps/api/tests/api_contract_runtime_auth_research.rs`;
`apps/api/tests/api_contract_runtime_market_stream.rs`;
`apps/api/src/routes/contract_evidence.rs`; `apps/api/src/routes/mod.rs`;
`apps/api/tests/fixtures/api_contract/**`.

**Amendment starting point:** the current artifact derives 52 operations and 181 material boundaries,
and the shared router harness plus dedicated auth/research and market/stream fragments already exist.
They are not schema-v2 proof: the strict check currently stops on an uncovered executed outcome (first
reported at `GET /api/_research/chain-snapshots/{symbol}` `500`) because schema v1 generically assigns
catalog rows to OpenAPI boundaries. B6 is the backend integrator repair that replaces that mechanism;
it must not bless the existing generic catalog or reduce the derived boundary set.

1. Pin root `openapi-typescript` and TypeScript and package-local `openapi-fetch` exactly:

   ```json
   "openapi-typescript": "7.13.0",
   "typescript": "5.9.3",
   "openapi-fetch": "0.17.0"
   ```

   Add only `api:contract:generate = node tools/api-contract.mjs generate` and
   `api:contract:check = node tools/api-contract.mjs check`; invoke installed binaries directly.
2. Preserve the existing 50 Node tests, then add 14 red schema-v2 tests (64 total) for the exact
   top-level/key sets, the two evidence modes, boundary/evidence bijection, executable-case/outcome
   binding, source-derived direct-operation references, operation-complete/risk-tiered scenario coverage,
   runtime-only outcomes, shared-mapping-family identity, and independent missing/extra/duplicate/unknown/
   mis-mode/unexecuted/relabel mutations. Keep the existing determinism, offline, canonical JSON/newline,
   header, manifest, result-category, rollback, non-writing, baseline, scan, manual-boundary, and
   normalizer tests red until the same candidate pipeline satisfies them.
3. Implement one candidate pipeline:

   ```js
   async function buildCandidate(root) {
     // pure Rust export -> lexical OpenAPI canonicalization/validation/policy/baseline checks
     // -> execute and collect response-conversion/direct-http outcomes
     // -> schema-v2 parity projection + set-equality validation -> openapi-typescript -> TS header
     // -> strict generated/facade compile -> artifact scan -> exact manifest -> byte manifest
   }
   ```

   Use a temporary root. Validate all candidate bytes before install. Generate atomically replaces only
   OpenAPI, parity, schema, and manifest, with manifest last and a rollback journal; it never rewrites
   baseline. Check regenerates in temp, validates and byte-compares all four mutable outputs, and writes
   nothing. Both force offline child-process policy after dependency installation.
4. Validate OpenAPI 3.1, refs, unique ids, exact responses/media/headers/security, specialized policies,
   typed JSON, and separate baseline/OpenAPI/runtime/parity set equality. Use the eight closed result
   categories and exact success/drift/coverage copy; never infer a category from guessed stderr.
5. Replace schema-v1 `http_parity.cases`, `allowed_outcomes`, `runtime_evidence_catalog`, and the
   `ops.map()` generic evidence assignment with the exact schema-v2 projection. Derive operation keys,
   boundary IDs, status, media, security, headers, body-schema signatures, and risk classes only from the
   canonical OpenAPI/runtime graph. Collect executable outcomes from named Rust commands, then build:

   ```js
   const operationKeys = new Set(operations.map(({ method, path }) => `${method} ${path}`));
   const responseOutcomes = await collectEvidence('response-conversion');
   const directOutcomes = await collectEvidence('direct-http');
   const parity = {
     schema_version: 2,
     source: { openapi: files.openapi, sha256: sourceSha },
     operation_count: operations.length,
     risk_classes: [...RISK_CLASSES].sort(),
     evidence_modes: ['direct-http', 'response-conversion'],
     operations: deriveOperationBoundaries(openapi, responseOutcomes),
     runtime_router_boundaries: deriveRuntimeRouterRows(directOutcomes),
     evidence_catalog: projectExecutedEvidence(responseOutcomes, directOutcomes),
     normalizer_catalog: validatedNormalizers(),
     http_parity: { scenarios: projectDirectHttpScenarios(directOutcomes, operationKeys) },
   };
   ```

   Each boundary has exactly one `response_conversion_evidence` ID. Every catalog row has the exact
   common fields `id`, `mode`, `command`, `target`, `test`, `case_id`, `fixture`, `setup_fixture`,
   `request_fixture`, `expected_response`, and `effect_assertion`; mode-specific fields are exactly those
   in the interface contract. Reject unknown/extra fields and any operation vocabulary not derived from
   `operations[]`. Preserve the single manual boundary for `GET /api/stream/{ticker}`.
6. Add a production-owned envelope registry at `apps/api/src/routes/contract_evidence.rs`, exposed from
   `routes/mod.rs`, and make `api_contract_response_conversion.rs` its exhaustive collector. The registry
   must not import, parse, or receive committed/candidate OpenAPI or parity JSON. Start from the 181
   independently persisted pre-cutover signatures in `boundary-matrix.json`; give every signature one
   unique source-registry entry containing its source ID, persisted-signature ID, constructor/rejection
   input, and actual `IntoResponse` or extractor-response production path. Executing an entry constructs
   a valid representative Axum response through that production conversion and asserts the persisted
   envelope: exact status, meaningful header set and value policy, media/no-body, body category, a valid
   representative body, security binding, and explicit effects. It then emits one deterministic outcome
   keyed by the evidence ID. This proof is envelope-level: it must not claim representative bodies are
   exact DTO-byte parity. The collector first proves registry-source, persisted-signature, evidence, and
   emitted-outcome sets bijective without OpenAPI; only afterward may the Node checker compare those sets
   with the independently OpenAPI-derived 181 material boundary IDs. Mutations independently remove,
   add, duplicate, drift, comment out, or reduce an entry to metadata and must fail; OpenAPI replay,
   prewritten response bytes, generic fabricated envelopes, and unexecuted labels also fail.

   Keep exact typed-schema proof separate from the envelope registry: mutate each route-owned Rust DTO/
   `IntoResponses` schema signature and require the deterministic OpenAPI and generated TypeScript to
   change or reject drift, then strictly compile the generated facade/consumers. Preserve static
   `body_schema_signature` set equality for all 181 boundaries. Direct-HTTP high-risk scenarios in step 7
   assert their actual body shapes so a valid representative registry body cannot masquerade as typed
   DTO parity.
7. Rework the existing Tower/Axum harness and the two dedicated runtime suites into direct-HTTP evidence,
   not a second route catalog. Every scenario sends one distinct hermetic request through
   `routes::router(AppState::for_runtime_guardrail_tests(...))`/the router produced from
   `contract_router()`, emits its source-derived `operation_key` (or closed runtime-router key), unique
   `scenario_id`, request/setup fixture, exact response, coverage tags, optional shared mapping family,
   and durable/memory/cookie pre/post assertion. Cover all 52 operations plus fallback/implicit method;
   public, optional-session, required-session, OAuth-state, and operator-token positive/negative modes;
   cookie-bearing and mutating success/refusal/validation/conflict; OAuth redirect/cookie; research
   success/denial/not-found/fault; SSE open/validation/drop/capacity/pre-stream JSON; trader/operator
   isolation; and representative shared `400`, `401`, `403`, `404`, `409`, `422`, `500`, `502`, and
   `503` production mapping families. A shared fault observation may name one real mapping family only;
   the same request/outcome cannot be relabeled for another operation or family. Neither evidence mode
   may read candidate or committed `parity-coverage.json` to decide which case to execute or which result
   to expect; response expectations come from independent pre-cutover fixtures and the emitted operation
   references are validated afterward against the exporter-derived operation vocabulary.
8. Make generate/check execute the named evidence commands and parse only canonical
   `CONTRACT_EVIDENCE_OUTCOME <json>` lines emitted after assertions pass. Enforce set equality for
   derived/reference/catalog/implemented/observed operation, boundary, runtime-only, source-registry,
   persisted-signature, evidence, case, outcome, scenario, body-schema-signature, and normalizer IDs. Add
   mutations that independently remove, add, duplicate, drift, comment out, reduce to metadata, mis-mode,
   redirect, or leave unobserved each class; replace a real case with an unexecuted fixture; change
   case/outcome binding; relabel a direct request; and reuse a shared-family label. Each mutation fails
   the check or named Rust command; the restored control passes.
9. Build the exact manifest entries for OpenAPI, parity, baseline, and schema; hash final bytes, omit the
   manifest itself, validate JSON without sentinel fields/comments, scan every listed artifact plus the
   manifest, and restore the prior mutable set on any install failure.
10. Run 64/64 Node tests and all three Rust evidence binaries. Require emitted summaries exactly
    `response-envelope conversions 181/181`, `typed-schema signatures 181/181`,
    `direct-http operations 52/52`, `runtime-router 2/2`, and zero missing, extra, duplicate, drifted,
    mode-mismatched, metadata-only, or unobserved IDs; generate twice; require identical hashes and exact
    clean-success plus coverage-warning output. Commit
    `feat(api): generate deterministic checked contract artifacts`.

## Frontend and shared-client track

The migration work below is retained as the completed dependency history. For this amendment, frontend
ownership is limited to F3 step 3 (README count/hierarchy wording) and F4 (receipt); there is no UI or
frontend transport implementation work.

### F0 — Characterize the public facade

**Files:** `libs/api/src/lib/convexa.spec.ts`;
`libs/api/src/lib/contract-compat.spec.ts`.

1. Before transport migration, add ten characterization tests for named exports, ordinary success,
   known null/not-found adaptation, `ApiError`, `AuthError`, same-origin credentials, abort/coalescing,
   native EventSource malformed/heartbeat/close/reconnect/no-duplicate behavior, and absent/null/empty.
2. Add a compile fixture importing the actual consumer-used public values/types only from
   `@convexa/api`; observe a deliberate export removal fail, restore, and require the original 21 plus
   10 tests pass. Commit `test(api-client): lock facade compatibility`.

### F1 — Migrate ordinary Convexa HTTP through generated authority

**Files:** `libs/api/src/lib/client.ts`; `libs/api/src/lib/convexa.ts`;
`libs/api/src/index.ts`; `libs/api/tsconfig.lib.json`.

**Depends on:** B6, F0.

1. Add a red strict-compile fixture for wrong method/path/body and a green public-export fixture. Create
   exactly one client:

   ```ts
   import createClient from 'openapi-fetch';
   import type { paths } from '../generated/schema';
   export const http = createClient<paths>({ baseUrl: '', credentials: 'same-origin' });
   ```

2. Replace ordinary raw `fetch` calls with typed `http.GET/POST/PUT/DELETE`, checking status before
   data/error. Preserve ticker normalization, query omission, abort, coalescing, credentials, semantic
   errors, and deliberate null/not-found adaptations.
3. Replace migrated wire declarations only with indexed generated aliases, for example
   `components['schemas']['TickerBundleWire']` or an operation request body. Keep semantic classes.
   Keep `streamTicker` native EventSource with generated input/event/error aliases and unchanged lifecycle.
4. Run strict typecheck, 31 facade tests, and dashboard typecheck/build. Commit
   `refactor(api-client): consume generated contract types`.

### F2 — Migrate broker transport

**Files:** `libs/api/src/lib/broker.ts`; `libs/api/src/lib/broker.spec.ts`.

**Depends on:** F1.

1. Add six red tests for credential read/write/delete, book/refresh, auth/validation mapping,
   write-only-secret non-echo, unknown/empty distinction, and public exports.
2. Replace broker wire declarations with generated aliases and all five raw calls with the shared `http`
   client. Preserve `toBrokerGateError`, method/body semantics, credentials, and no secret echo.
3. Require broker 6/6 and full library 37/37. Commit
   `refactor(api-client): migrate broker transport`.

### F3 — Enforce one wire authority and document it

**Files:** `libs/api/src/lib/contract-authority.spec.ts`; `libs/api/README.md`.

**Depends on:** B6, F1, F2.

1. Add four red AST-policy tests for a duplicate interface, duplicate object-literal wire type,
   dashboard generated deep import, and an allowed generated indexed alias/semantic class.
2. Exercise B6's checker: only `client.ts`, `convexa.ts`, and `broker.ts` may import generated internals;
   applications import `@convexa/api`; migrated aliases are indexed access; diagnostics contain only
   repo-relative locations. Prove every poison red and restored fixture green.
3. Replace the placeholder README with the Rust source of truth, generate/check commands, closed result
   meanings, the exact generated/manual boundary, `Streaming and manual boundaries` copy, migration,
   troubleshooting, atomic rollback, ownership, manifest, schema-v2 two-tier parity artifact, and live
   conformance. Remove the stale `179 generated response boundaries`/`181 executable evidence entries`
   claim. If README displays a count, read it from the generated artifact/checker summary: this snapshot
   is 52 operations and 181 material response boundaries; never maintain an endpoint/evidence catalog in
   prose. State the proof hierarchy exactly: response-envelope conversion is exhaustive; exact schemas
   are enforced separately through Rust DTO/`IntoResponses` to deterministic OpenAPI to generated
   TypeScript compilation; direct HTTP is risk-tiered, covers every source-derived operation, and checks
   actual high-risk bodies/effects; the four live calls substitute for none of those proofs. Include this
   exact warning (byte-for-byte, on one line): `Coverage note: the four-call live conformance block is supplementary; response-envelope conversions are exhaustive, typed schemas are enforced through the Rust-to-OpenAPI-to-TypeScript graph, and direct HTTP evidence is risk-tiered across every source-derived operation.`
4. Run 4/4 authority tests, 37/37 library tests, typecheck, and contract check. Commit
   `docs(api-client): enforce generated authority`.

## Integration and closers

### B7 — Wire the non-writing check into normal and release gates

**Files:** `package.json`; `apps/api/project.json`; `libs/api/package.json`; `nx.json`;
`.github/workflows/ci.yml`; `.github/workflows/conformance.yml`;
`apps/api/tests/api_contract_gate_isolation.rs`.

**Depends on:** B6, F1, F2, F3.

1. Add six red structural tests for root build/CI, API build/test, API-library typecheck/test, both CI
   jobs, conformance release build, and poison-sensitive source guards.
2. Add a non-recursive `api-contract-check` Nx target whose command is
   `node tools/api-contract.mjs check`. Configure API build/test and `@convexa/api` typecheck/test to
   depend on it. Split current root script bodies into internal gate-free scripts; public `build` and
   `ci` begin with one direct `npm run api:contract:check` without recursive re-entry.
3. In frontend CI run check immediately after `npm ci`. In backend CI install Node, run `npm ci`, then
   check before Cargo test/build. In local-auth conformance run `npm ci` and check before release build.
   Never generate in CI/build/release/startup.
4. Mutate a Rust response without regeneration and require direct check plus each relevant Nx/root/
   workflow edge red with `contract drift`; restore/regenerate and require all edges green. Commit
   `ci(api): fail normal gates on contract drift`.

### B8-backend-closer — Verify serving and write backend receipt only

**Files:** `.spire/clusters/tech/contracts/api-contract-generation/conformance-receipt.json`.

**Depends on:** B0–B7.

Run canonical check, backend contract/parity suites, release+postgres build, and a hermetic server with
generation dependencies unavailable at runtime. Probe no OpenAPI/Swagger/Redoc/Scalar route, execute
the four-call interface command from V8, and verify the schema-v2 collector reports 181/181 independent
response-envelope conversions, 181/181 typed-schema signatures, 52/52 direct-HTTP operations, 2/2
runtime-router rows, every required risk/access/body/effect/error family, and exact ID-set equality. Write
only the machine receipt with 4 pass / 0 fail. Report revision, URL/PID, command exits, and receipt path;
do not repair worker files.

### F4-frontend-closer — Verify unchanged consumers and write frontend receipt only

**Files:** `.spire/clusters/tech/contracts/api-contract-generation/frontend-conformance-receipt.json`.

**Depends on:** F0–F3, B7.

Run canonical check, 37-test library suite, dashboard typecheck/build, and existing landing/ticker/
scanner/positions/settings/operator journeys. Write only a receipt with revision, commands/exits,
named-export verdict, journeys, `NO_UI_CHANGE`, generated-deep-import count `0`, and manual boundary
set equality `1/1`; confirm README reports the schema-v2 hierarchy/current generated counts without the
stale 179-boundary claim; do not repair worker files or UI.

## Independence

Frontend rows are `no` because SPEC §4 does not name their exact implementation files. B4a/B4b/B4c
are the only backend `yes` rows; their write paths are disjoint. Shared/root/generated paths stay on
backend `no` tasks. Each lane has exactly one closer.

| Task | Lane | Paths | Depends on | Independent |
|---|---|---|---|---|
| B0 | backend | `apps/api/Cargo.toml`; `Cargo.lock`; `apps/api/src/routes/health.rs` | — | no |
| B1 | backend | `tools/api-contract-baseline.mjs`; `tools/api-contract-baseline.spec.mjs`; `package.json` | B0 | no |
| B2 | backend | `apps/api/openapi/precutover-operation-baseline.json` | B1 | no |
| B3 | backend | `apps/api/src/openapi.rs`; `apps/api/src/lib.rs`; `apps/api/tests/api_contract_policy.rs` | B2 | no |
| B4a | backend | `apps/api/src/routes/demo.rs`; `apps/api/src/routes/health.rs`; `apps/api/src/routes/price.rs`; `apps/api/src/routes/market.rs`; `apps/api/src/routes/candidates.rs`; `apps/api/src/routes/contract.rs`; `apps/api/src/routes/ticker.rs`; `apps/api/src/routes/stream.rs` | B3 | yes |
| B4b | backend | `apps/api/src/routes/book.rs`; `apps/api/src/routes/auth.rs`; `apps/api/src/routes/broker.rs`; `apps/api/src/routes/recommendation.rs` | B3 | yes |
| B4c | backend | `apps/api/src/routes/research_chain_snapshots.rs`; `apps/api/src/routes/research_session_books.rs`; `apps/api/src/routes/scan.rs` | B3 | yes |
| B5 | backend | `apps/api/src/routes/mod.rs`; `apps/api/src/server.rs`; `apps/api/src/bin/export_openapi.rs`; `apps/api/tests/api_contract_router.rs` | B2, B3, B4a, B4b, B4c | no |
| B6 | backend | `tools/api-contract.mjs`; `tools/api-contract.spec.mjs`; `package.json`; `package-lock.json`; `libs/api/package.json`; `apps/api/openapi/convexa.openapi.json`; `apps/api/openapi/parity-coverage.json`; `apps/api/openapi/generated-artifacts.manifest.json`; `libs/api/src/generated/**`; `apps/api/tests/api_contract_parity.rs`; `apps/api/tests/api_contract_response_conversion.rs`; `apps/api/tests/api_contract_runtime_auth_research.rs`; `apps/api/tests/api_contract_runtime_market_stream.rs`; `apps/api/src/routes/contract_evidence.rs`; `apps/api/src/routes/mod.rs`; `apps/api/tests/fixtures/api_contract/**` | B5 | no |
| B7 | backend | `package.json`; `apps/api/project.json`; `libs/api/package.json`; `nx.json`; `.github/workflows/ci.yml`; `.github/workflows/conformance.yml`; `apps/api/tests/api_contract_gate_isolation.rs` | B6, F1, F2, F3 | no |
| B8-backend-closer | backend | `.spire/clusters/tech/contracts/api-contract-generation/conformance-receipt.json` | B0, B1, B2, B3, B4a, B4b, B4c, B5, B6, B7 | no |
| F0 | frontend | `libs/api/src/lib/convexa.spec.ts`; `libs/api/src/lib/contract-compat.spec.ts` | B2 | no |
| F1 | frontend | `libs/api/src/lib/client.ts`; `libs/api/src/lib/convexa.ts`; `libs/api/src/index.ts`; `libs/api/tsconfig.lib.json` | B6, F0 | no |
| F2 | frontend | `libs/api/src/lib/broker.ts`; `libs/api/src/lib/broker.spec.ts` | F1 | no |
| F3 | frontend | `libs/api/src/lib/contract-authority.spec.ts`; `libs/api/README.md` | B6, F1, F2 | no |
| F4-frontend-closer | frontend | `.spire/clusters/tech/contracts/api-contract-generation/frontend-conformance-receipt.json` | F0, F1, F2, F3, B7 | no |

## Verification track

Run from the workspace root after both closers. A missing isolated root, offline control, parity fixture,
or live server is `UNVERIFIABLE`, not PASS.

### V1 — Mechanism and baseline

```powershell
cargo test -p api-rust routes::health:: -- --nocapture
cargo tree -p api-rust -i axum
node --test tools/api-contract-baseline.spec.mjs
```

Expected: B0 tests pass; one Axum `0.8.9`; baseline parser 12 passed / 0 failed. QA repeats the response
status mutation and baseline overwrite refusal, observes red, restores, and observes green/unchanged hash.

### V2 — Runtime/OpenAPI inventory and policy

```powershell
cargo test -p api-rust --test api_contract_policy -- --nocapture
cargo test -p api-rust --test api_contract_router -- --nocapture
```

Expected: 5/5 and 7/7; exactly 52 unique operations; POST logout only; all classifications and response
sets complete. The shared co-omission mutation fails against the unchanged baseline, then restoration passes.

### V3 — Deterministic, offline, structured artifacts

```powershell
node --test tools/api-contract.spec.mjs
$env:npm_config_offline='true'
$env:HTTP_PROXY='http://127.0.0.1:9'
$env:HTTPS_PROXY='http://127.0.0.1:9'
npm run api:contract:generate
$hashA=Get-FileHash apps/api/openapi/convexa.openapi.json,apps/api/openapi/parity-coverage.json,apps/api/openapi/generated-artifacts.manifest.json,libs/api/src/generated/schema.ts -Algorithm SHA256
npm run api:contract:generate
$hashB=Get-FileHash apps/api/openapi/convexa.openapi.json,apps/api/openapi/parity-coverage.json,apps/api/openapi/generated-artifacts.manifest.json,libs/api/src/generated/schema.ts -Algorithm SHA256
Compare-Object $hashA.Hash $hashB.Hash
npm run api:contract:check
```

Expected: 64/64; both generations/check exit 0; comparison prints nothing; JSON parses without comments/
extra fields; parity reports schema version 2, two closed evidence modes, 52 source-derived operations,
181 source-derived material boundaries, and no schema-v1 generic runtime catalog; schema header is exact;
manifest has exact constants, four sorted entries, and matching hashes; check prints the exact
clean-success sentence and coverage warning without changing the tree.

### V4 — Different-root and negative controls

Create two disposable Git worktrees with distinct absolute roots; run `npm ci --offline` and generate in
each. Expected: all mutable artifact hashes match. In disposable copies, individually poison missing/
empty/invalid/drift/unsupported/tooling/compile/coverage states, secrets/env/origins/absolute paths,
manifest fields, manual boundary, every schema-v2 operation/boundary/runtime-only/evidence/case/outcome/
scenario/normalizer set, both evidence modes, executed-outcome binding, direct request identity, shared
mapping-family identity, and install interruption. Each emits its contracted category safely, writes no
forbidden bytes, and the restored control passes. A source scan also rejects reintroducing a generator-
authored `http_parity.cases`/52-route outcome map.

### V5 — Exhaustive parity and protected behavior

```powershell
cargo test -p api-rust --test api_contract_response_conversion -- --nocapture
cargo test -p api-rust --test api_contract_parity -- --nocapture
cargo test -p api-rust --test api_contract_runtime_auth_research -- --nocapture
cargo test -p api-rust --test api_contract_runtime_market_stream -- --nocapture
cargo test -p api-rust --test production_runtime_guardrails -- --nocapture
cargo test -p api-rust --test score_identity
cargo test -p quant-engine --test golden --test signals_characterization
```

Expected: all commands exit 0. Without reading OpenAPI, the production route/source registry emits and
asserts exactly 181 unique envelope outcomes against 181 persisted pre-cutover signatures: exact status,
meaningful header/value policy, media/no-body, body category, valid representative body, security, and
effects. Registry-source, persisted-signature, evidence, and outcome IDs are bijective; the checker then
proves them equal to the independently OpenAPI-derived 181 material boundary IDs. Missing, extra,
duplicate, drifted, comment-only, metadata-only, or unexecuted registry mutations fail. Separately, all
181 Rust DTO/`IntoResponses` body-schema signatures survive OpenAPI generation, generated-TypeScript
compilation, and signature mutations. Direct HTTP emits distinct scenarios covering exactly all 52
source-derived operation keys plus the two closed runtime-router keys, with no unknown/relabelled request;
coverage tags include every access mode, cookie/mutation, OAuth, operator/research, SSE, isolation, actual
high-risk body shape, and shared `400`/`401`/`403`/`404`/`409`/`422`/`500`/`502`/`503` family required by
the contract. Referenced, catalogued, implemented, and observed IDs are set-equal; manual boundary is
1/1; null/empty and score bytes match.

### V6 — Generated client, facade, and consumers

```powershell
npx nx typecheck @convexa/api
npx nx test @convexa/api -- --run --reporter=dot
npx nx typecheck @convexa/dashboard
npx nx build @convexa/dashboard --configuration=production
```

Expected: all exit 0; library 37/37; public exports compile; duplicate-wire/deep-import poisons fail;
native EventSource lifecycle remains green; dashboard has no tooling route/link/copy/state/visual change.

### V7 — Full normal/release gates

```powershell
cargo test -p api-rust -p quant-engine
cargo check -p api-rust --all-targets --features postgres
cargo fmt --all -- --check
cargo clippy -p api-rust --all-targets --features postgres -- -D warnings
npm run typecheck
npm run test
npm run build
npm run ci
```

Expected: every command exits 0; each configured normal gate invokes non-writing contract check. A Rust
contract poison makes direct/Nx/root/release edges fail with drift; restored regenerated controls pass.
No feature diff enters quant math or dashboard UI source.

### V8 — Live supplementary conformance and runtime absence

```powershell
node .codex/tools/gates.mjs interface_conformance --contract .spire/clusters/tech/contracts/api-contract-generation/INTERFACE_CONTRACT.md --url http://127.0.0.1:8000 --report .spire/clusters/tech/contracts/api-contract-generation/conformance-receipt.json
docker build -f apps/api/Dockerfile -t convexa-api:api-contract-generation .
docker run --rm convexa-api:api-contract-generation sh -c "test ! -e /app/convexa.openapi.json && test ! -e /app/node_modules"
```

Expected: receipt PASS, 4/4; production image/start works without generation packages/artifacts and as
the existing non-root user; documentation-route probes return existing fallback behavior.

### V9 — Rollback, formatting, and clean regeneration

In a disposable branch, revert the complete feature and prove the pre-feature gates still pass; restore
only generated artifacts against changed Rust and require drift. Then run:

```powershell
npx prettier --check tools/api-contract-baseline.mjs tools/api-contract-baseline.spec.mjs tools/api-contract.mjs tools/api-contract.spec.mjs package.json libs/api/package.json libs/api/README.md apps/api/openapi/*.json
npm run api:contract:check
git diff --exit-code -- apps/api/openapi/convexa.openapi.json apps/api/openapi/parity-coverage.json apps/api/openapi/generated-artifacts.manifest.json libs/api/src/generated/schema.ts
```

Expected: formatting/check succeed; regeneration is clean; persisted data is untouched; README contains
all required guidance and the exact amended coverage warning, distinguishes exhaustive response envelopes
from the separate exact typed-schema graph, names operation-complete risk-tiered HTTP proof with actual
high-risk bodies/effects, does not claim 179 boundaries or 181 total evidence entries, and presents any
current 52-operation/181-boundary count only as generated artifact output.

## Acceptance coverage

| Criterion | Owning tasks | Verification |
|---|---|---|
| AC-01 | B2, B4a–B5 | V1–V2 |
| AC-02 | B3, B4a–B5 | V2 |
| AC-03 | B5–B6 | V2–V5 |
| AC-04 | B0, B4a–B6 | V1–V3 |
| AC-05 | B3, B4a–B4c, B6, F1–F2 | V2–V6 |
| AC-06 | B5–B6 | V3–V4 |
| AC-07 | B6 | V3–V4 |
| AC-08 | B6 | V3, V9 |
| AC-09 | B6, F1–F2 | V3, V6 |
| AC-10 | B6, F1–F3 | V4, V6 |
| AC-11 | B6–B7 | V3–V4, V7 |
| AC-12 | B6–B7 | V4, V7 |
| AC-13 | B6 | V4 |
| AC-14 | B6 | V4 |
| AC-15 | B6 | V4 |
| AC-16 | B3, B6 | V2, V4 |
| AC-17 | B4a–B6 | V2–V4 |
| AC-18 | B6 | V4 |
| AC-19 | B6 | V4 |
| AC-20 | B6, F1–F2 | V4, V6 |
| AC-21 | B6–B7 | V3, V7 |
| AC-22 | B5–B6 | V3–V4, V8 |
| AC-23 | B6 | V4, V8 |
| AC-24 | B4a–B6 | V2, V4–V5 |
| AC-25 | B4a–B6 | V4–V5 |
| AC-26 | B4b, B6, F0–F2 | V5–V6 |
| AC-27 | B4a, B6, F0–F1 | V5–V6 |
| AC-28 | B3, B4a–B4c, B6, F0–F2 | V2, V5–V6 |
| AC-29 | B4a–B6 | V5, V7 |
| AC-30 | B4b–B6, F1–F4 | V5–V8 |
| AC-31 | F0–F4 | V6 |
| AC-32 | F4 | V6, V8 |
| AC-33 | B5–B8 | V7–V8 |
| AC-34 | F3 | V6, V9 |
| AC-35 | B6 | V3–V4, V9 |
| AC-36 | B6–B7 | V9 |
| AC-37 | B4a–B6 | V2–V5 |
| AC-38 | B1–B2 | V1 |
| AC-39 | B5–B6 | V2–V4 |
| AC-40 | B1–B2, B6 | V1, V4 |
| AC-41 | B6 | V3–V4, V9 |
| AC-42 | B6, B8-backend-closer | V4–V5, V8 |
