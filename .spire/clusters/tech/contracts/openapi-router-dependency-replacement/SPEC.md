# openapi-router-dependency-replacement — spec

**Source brief:** .spire/clusters/tech/contracts/openapi-router-dependency-replacement/BRIEF.md
**Council:** R1 positions · R2 critiques · R3 reconciliations · decisions.md (under council/)
**Status:** draft

## 1. Goal + scope

Ship an internal maintenance replacement that removes the dependency chain responsible for the named `RUSTSEC-2024-0436` unmaintained advisory while preserving every externally observable API, application, and contributor-workflow behavior established by `api-contract-generation`. The feature replaces only the Axum/OpenAPI registration integration with a repository-owned mechanism; it does not replace Axum, `utoipa`, the runtime router graph, or the wire contract. Completion is bounded to the candidate passing `cargo deny check advisories licenses sources bans` with no `RUSTSEC-2024-0436` finding and to `utoipa-axum` and `paste` being absent from project manifests and the locked resolved Cargo graph. This does not establish advisory-database freshness, future safety, or repository-wide security, and the contracts must not describe the removed chain as vulnerable or call the result secure, safe, vulnerability-free, all-advisories-fixed, or dependency-free.

<!-- spire:council-resolution:v1 196875871f102fec32c549746e9d383bb23f41a2870ccc11c2f01e112247cc78 folded -->

The preserved inventory is exactly 52 source-derived production operations, not 52 public operations. It contains public, optional-session, session-required, OAuth, operator-token, operator/research, and currently unconsumed surfaces; every operation retains its existing access classification and none becomes publicly documented or trader-linked.

<!-- spire:council-resolution:v1 158168cf1be74d324a77c9b993b93cbe34c2442c45c1efd88a6b0978442abef8 folded -->

**In scope:**

- Remove `utoipa-axum` from `apps/api/Cargo.toml` and remove `utoipa-axum` and `paste` from the root `Cargo.lock` and locked resolved production package graph, while retaining the exact `utoipa = 5.5.0` pin.
- Add a repository-owned handler-plus-`__path_*` route package and one consuming `ContractRouter` graph that installs each existing Axum handler and merges that same registration's pinned-`utoipa` metadata into OpenAPI.
- Preserve the canonical OpenAPI 3.1 and generated TypeScript bytes, parity artifact, generated-artifact manifest, public `@convexa/api` facade, generate/check workflow, and closed result vocabulary.
- Preserve the immutable 52-operation baseline and the current generated `apps/api/openapi/parity-coverage.json` sets of 181 executable response-conversion outcomes and 87 distinct direct-HTTP outcomes, plus the four-call live conformance block, as independently executable evidence.
- Preserve all existing methods, paths, operation identities, request and response shapes, statuses, meaningful headers, media types, auth classifications, cookie effects, redirects, SSE lifecycle, errors, absence meanings, state effects, score/quant outputs, and operator/trader isolation.
- Extend existing contract and supply-chain gates with non-vacuous pairing, invalid-graph, and forbidden-package mutations.

**Out of scope:**

- Any added, removed, renamed, or reclassified operation, including a documentation, OpenAPI, Swagger, Redoc, Scalar, dependency-status, or advisory-status endpoint.
- Any UI, product copy, route, link, control, loading, empty, error, offline/stale, navigation, layout, or visual change.
- Any API redesign/versioning, public SDK or docs publication, runtime validation, generator upgrade, generated SSE transport, runtime document generation, or second contract surface.
- Handler, extractor, middleware, state, DTO, response-conversion, persistence, vendor, worker, listener, secret, deployment-policy, scoring, quant, recommendation, account, broker, or data-migration changes.
- A local proc-macro crate, vendored general-purpose router, hand-authored OpenAPI operation inventory, parallel Axum/OpenAPI lists, advisory waiver, suppression, or unreleased Git dependency.
- Rewriting archived contracts or accepting changed generated artifacts merely to make the dependency cleanup pass.

**Future (deliberately deferred):**

- A future published upstream route/OpenAPI integration may be evaluated in a separately reviewed maintenance feature with the same preservation proof.
- API versioning, public documentation/SDKs, runtime schema validation, generator upgrades, alternative streaming transports, and broader advisory remediation remain separate decisions.

## 2. Architecture

### Repository-owned registration seam

Create `apps/api/src/routes/contract_router.rs` beside the existing production graph and keep the 52 production registrations in `apps/api/src/routes/mod.rs`. The local module owns these data structures and no application or domain authority:

- `ContractRouter<S>` contains exactly two values: the Axum `Router<S>` used at runtime and the `utoipa::openapi::OpenApi` used by the pure exporter. `split_for_parts(self)` consumes the graph once and returns those two parts.
- A private route package carries one Axum `MethodRouter<S>` built around the named handler plus the path, supported HTTP methods, operation, tags, and referenced schemas derived from that handler's matching `__path_*` metadata type.
- `ContractGraphError` is a typed closed error for unsupported or empty HTTP method metadata, duplicate path-method registration, and duplicate operation identity. It carries only the safe handler, method/path, or operation identifier needed by §5.
- `contract_route!(handler_path, matching___path_metadata_type)` is the sole production-registration form. It uses pinned `utoipa` traits (`Path`, `__dev::Tags`, and `SchemaReferences`) to read path, method, operation, tags, and schemas; maps every supported `utoipa::openapi::HttpMethod` to the corresponding Axum `MethodFilter`; builds the runtime method router around that exact handler; and returns one route package.
- `ContractRouter::route(package)` is the single consuming operation. It installs the package's method router at its metadata-derived path and merges the same package's operation and referenced schemas into the OpenAPI document. It refuses invalid or colliding graph state before either half can be used. No runtime-only method/path literal or second operation list is permitted.

The explicit handler/metadata pair is binding because stable `macro_rules!` cannot concatenate a handler identifier into the generated `__path_<handler>` name; `utoipa-axum` used `paste` for that concatenation. The explicit pair keeps the mechanism within the existing Rust crate and makes a future incompatible change to the doc-hidden name fail at compilation under the pinned `utoipa = 5.5.0` boundary. A local proc macro would add a compiler plugin and parsing surface merely to hide the second identifier, while vendoring the published integration would retain unrelated nesting, layer, and service APIs.

### Pairing bijection and one graph

A repository-owned guard integrated into the normal contract check parses every production `contract_route!` registration and proves a bijection: exactly one unique handler, exactly one unique companion, and a companion basename exactly equal to `__path_` plus the handler basename. Its positive control must discover exactly the same 52 registrations as the immutable baseline. Independent poisoned fixtures swap companions, omit a registration, duplicate either side, and use a wrong suffix; every poison must fail through the normal gate and the restored source must pass. This source-derived guard is a validator of the one registration graph, not another authored method/path catalog.

The existing disposable operation mutation continues through the same `ContractRouter::route` path. Adding it changes the runtime and OpenAPI inventories together from 52 to 53, after which the independent immutable 52-operation baseline rejects the candidate. Deleting the same real operation from runtime and OpenAPI also remains rejected. These controls prove both graph coupling and protection against a mutually consistent omission.

### Data flow and compatibility boundary

`contract_router()` builds one `ContractRouter<AppState>` from the 52 packages and returns a typed failure rather than an Axum-only or OpenAPI-only partial graph. Runtime startup consumes the Axum half, attaches the already-built `AppState`, and then applies the existing rate-limit, CORS, trace, and other middleware exactly where it does today. `apps/api/src/bin/export_openapi.rs` consumes the OpenAPI half without constructing application state, reading environment values, contacting network/vendor/store services, or starting listeners/workers.

The repository-owned constructor explicitly reproduces the approved artifact's OpenAPI 3.1 bootstrap metadata that the published integration formerly supplied. The approved pre-change `apps/api/openapi/convexa.openapi.json` bytes are the oracle; this compatibility metadata is not an operation inventory. Existing route-owned annotations and DTO/response types remain the wire authority. Existing manual schema-root registration, security application, lexical canonicalization, fixed trailing newline, parity generation, TypeScript generation, strict compilation, safe artifact scan, manifest hashing, and atomic install/check stages remain downstream of `split_for_parts` and are not reimplemented in the local router seam.

The response-conversion registry remains independent of both the graph builder and candidate OpenAPI and retains one executed outcome per 181 derived material boundaries. The direct-HTTP suite continues to send 87 distinct cases through the Axum half returned by the local graph. The immutable baseline, canonical artifact, parity artifact, and runtime operation set remain set-equal to exactly 52 source-derived production operations. The four live calls remain supplementary smoke evidence and cannot replace the 52/181/87 proof.

### Immutable pre-edit compatibility oracle

Before any route registration, manifest, lockfile, exporter, generated artifact, or evidence fixture is edited, the API contract owner must capture and accept `apps/api/openapi/router-integration-prechange-baseline.json`. This is a one-time repository-owned migration oracle, separate from the existing operation baseline and generated-artifact manifest. Its exact schema and historical OpenAPI `info` values are authoritative in `INTERFACE_CONTRACT.md`.

The candidate/accept flow records a full committed source revision, capture-tool repo-relative path and raw SHA-256, review-contract path, reviewer provenance, and the following values from the verified pre-edit repository state:

- raw-byte SHA-256 values for `apps/api/openapi/convexa.openapi.json`, `libs/api/src/generated/schema.ts`, `apps/api/openapi/parity-coverage.json`, and `apps/api/openapi/generated-artifacts.manifest.json`;
- the exact OpenAPI version and `info` object, including the historical package-specific title, version, description, contact, and license values; these are compatibility bytes from the approved artifact, not current contributor or product documentation;
- count `181` and a canonical sorted-set hash of every `response-conversion` evidence ID; and count `87` and a canonical sorted-set hash of every `direct-http` evidence ID; and
- independent equality proof between IDs parsed from the committed parity artifact and IDs emitted by the executed production response-conversion/direct-HTTP fixtures before either set is hashed.

`tools/api-router-integration-baseline.mjs` owns the flow. `npm run api:router-integration:baseline:candidate -- --source-revision <full-40-hex-sha> --out <temporary-path>` is the non-writing pre-edit capture command. `npm run api:router-integration:baseline:accept -- --candidate <temporary-path> --review-contract .spire/clusters/tech/contracts/openapi-router-dependency-replacement/INTERFACE_CONTRACT.md --reviewer-provenance <review-record>` is the sole writer. Accept refuses capture unless the existing contract check, manifest hash validation, 52-operation baseline comparison, 181 response-conversion run, and 87 direct-HTTP run pass against bytes equal to the recorded source revision. It creates the baseline only when absent and never overwrites it. A stale, missing, partially regenerated, unexecuted, dirty, or internally inconsistent pre-edit artifact set cannot be accepted. The baseline is intentionally not listed in `generated-artifacts.manifest.json`, because that manifest's own pre-edit raw hash is one of the pinned values and adding the baseline would create migration-oracle drift.

The accepted baseline must be committed as its own reviewed pre-edit checkpoint before any route/dependency/artifact replacement commit. Both comparators locate the repository-history commit that first added the baseline, require its parent to equal the recorded pre-edit source revision for every pinned input, and compare the current baseline bytes to that first-added blob. They also reconstruct raw artifact hashes, OpenAPI metadata, and declared evidence IDs directly from `git show <source.revision>:<repo-relative-path>`. Thus a later edit, deletion, relabel, source-revision substitution, or same-PR attempt to add the baseline after route changes fails even if the altered baseline is internally self-consistent. CI must fetch enough repository history to resolve this checkpoint; missing history is blocked evidence, never a pass.

After acceptance, both `npm run api:router-integration:candidate` and ordinary `npm run api:contract:check` independently regenerate into separate temporary roots, parse the baseline themselves, and compare all four raw-byte hashes, the OpenAPI version and complete `info` object, and both independently extracted evidence-ID sets/counts. Neither command may rely on a cached pass receipt or rewrite/normalize the baseline. Missing, extra, duplicated, relabeled, co-omitted, count-preserving ID substitution, artifact-byte change, metadata change, manifest-hash change, baseline-field change, or baseline deletion fails. Only a GATE-Z behavior-change contract may authorize replacing this oracle; this maintenance feature cannot.

### Required compiled-registration receipt

The named command `npm run api:router-integration:compile-probe`, implemented by `tools/api-router-integration-compile-probe.mjs`, must compile the local macro and all 52 production handler/`__path_*` packages. Its final GATE invocation atomically emits `.spire/clusters/tech/contracts/openapi-router-dependency-replacement/router-integration-compile-probe-receipt.json`; the non-writing candidate and contract-check commands invoke the same tool with `--out <temporary-path>` and validate the independently produced temporary receipt without changing repository bytes. A valid `PASS` receipt is bound to the candidate source revision, probe-tool raw hash, pinned `utoipa = 5.5.0`, the immutable 52-operation set, and the exact probe command. The receipt must report:

- 52 unique production registrations compiled through the one `ContractRouter` graph;
- compile-time trait checks for `utoipa::Path`, `utoipa::__dev::Tags`, and `utoipa::__dev::SchemaReferences` on every paired metadata type;
- mapping probes for every OpenAPI/Axum-supported method in this seam: `GET`, `PUT`, `POST`, `DELETE`, `OPTIONS`, `HEAD`, `PATCH`, and `TRACE`;
- named compiled witnesses for an SSE handler, a stateful/session-auth handler, and a handler with declared non-success/error responses; and
- pairing-guard count/set result, candidate OpenAPI operation-set hash, and zero invalid-graph outcomes.

The receipt is verification evidence, not a generated production artifact or second operation list. It contains hashes/counts and the named category witnesses, not a copied 52-row catalog. Missing receipt at final GATE, wrong revision/toolchain, skipped witness, missing trait/method arm, count/set mismatch, or a receipt produced without executing the compiled probe fails; a handwritten or stale retained receipt cannot satisfy the independent temporary rerun.

### Failure modes + isolation

- Graph construction is transactional: invalid method metadata, path-method collision, or duplicate operation identity returns `ContractGraphError`; no partial runtime or document half is exposed and no fallback registration is installed.
- Startup consumes the already-validated graph before the listener and workers start. Export converts a typed invalid-graph result to the existing closed diagnostic described in §5 and exits non-zero. Unexpected panic, serialization failure, or exporter-process failure stays a tooling failure.
- The local module may import Axum and `utoipa`; it must not import `AppState`, services, stores, configuration, vendors, workers, listeners, quant/scoring modules, or generated artifacts. Generic state type parameters are allowed; state values remain outside the module.
- Runtime handlers, extractors, middleware, response conversions, DTOs, security metadata, cookie behavior, fallback/implicit-method behavior, SSE logic, and post-processing are mounted or called unchanged. There is no payload normalization or best-effort route fallback.
- Package absence is established before compilation from manifests, `Cargo.lock`, and the locked resolved graph. A production binary built from that proven graph must then start and pass the existing probes; package “unavailability at runtime” is not a separate claim because these crates are compile-time graph members.

<!-- spire:council-resolution:v1 14564e74b72eb4477da4cbdb03c3bd99e648faed261b9b12082bd7409602f6cd folded -->

### Not buildable / rejected approaches

- Parallel Axum and `#[derive(OpenApi)]` operation lists, runtime-only registrations, or hand-authored operation catalogs are rejected because both halves can omit the same route and still agree.
- A local proc-macro crate is rejected because it adds a compiler-plugin and token-parsing surface solely to synthesize the `__path_*` identifier.
- Vendoring `utoipa-axum` or a general-purpose router is rejected because the repository needs only construction, registration, and split behavior and must not inherit unrelated API ownership.
- Waiting for upstream, pinning an unreleased Git revision, suppressing the advisory, or adding a waiver is rejected by the operator's settled immediate-removal and approved-source decisions.
- Replacing Axum, `utoipa`, the OpenAPI/TypeScript toolchain, route annotations, or the whole API contract is rejected as unnecessary compatibility risk.

## 3. Acceptance criteria (with user stories)

Every row blocks ship. Shared high-level suites may satisfy multiple rows, but each row receives an independent GATE-Q verdict and evidence reference.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-01 | As a release operator, I want the named advisory chain removed. | On the candidate revision, `cargo deny check advisories licenses sources bans` completes successfully with no `RUSTSEC-2024-0436` finding; the result makes no broader security or advisory-freshness claim. | test |
| AC-02 | As a release operator, I want graph removal to be complete. | Project manifests, the root `Cargo.lock`, and the locked resolved production package set contain neither `utoipa-axum` nor `paste`, and no published replacement integration is introduced; independently reintroducing either forbidden package makes a normal repository gate fail, and restoring the candidate returns it to green. | test |
| AC-03 | As an API consumer, I want the operation surface preserved. | Candidate runtime, canonical OpenAPI, parity artifact, immutable operation baseline, and accepted pre-edit compatibility oracle are set-equal to the existing 52 source-derived production operations with no method/path addition, removal, rename, or access-classification change; simultaneous runtime/OpenAPI deletion and a disposable 53rd operation each fail against the baselines. | test |
| AC-04 | As a reviewer, I want every handler bound to its own metadata. | The pairing gate positively discovers all 52 production registrations; swapped, missing, duplicated, or misnamed handler/`__path_*` pairs each fail the normal contract gate, and restoring each mutation passes. | test |
| AC-05 | As a contributor, I want invalid graphs rejected truthfully. | Empty or unsupported HTTP method metadata, a duplicate path-method registration, and a duplicate operation identity each fail non-zero as `incomplete contract coverage` with the safe identifier specified in §5; none produces a partial route/document graph or a clean/drift result, and restored controls pass. | test |
| AC-06 | As an API consumer, I want generated contract bytes and compatibility metadata preserved. | Two clean candidate generations are byte-for-byte identical, and raw OpenAPI, generated TypeScript, parity, and manifest hashes equal the accepted pre-edit oracle; the candidate OpenAPI version and complete historical `info` object equal the oracle field-for-field. Either independent comparator rejects any difference, and only a completed byte comparison may report `contract drift`. | test |
| AC-07 | As a reviewer, I want response preservation exhaustive. | The candidate executes exactly 181 response-conversion cases through the production conversion paths with the approved status, meaningful headers, media/no-body category, representative body validity, security binding, and declared effects; parity-derived and execution-emitted ID sets independently equal the pre-edit oracle's count and canonical set hash. Missing, extra, duplicate, relabeled, co-omitted, count-preserving substitution, metadata-only, comment-only, or unexecuted evidence fails. | test |
| AC-08 | As a reviewer, I want runtime preservation proportional to risk. | Exactly 87 distinct direct-HTTP cases pass through the production Tower/Axum router, cover every source-derived operation plus the approved fallback/error families, and preserve actual body/envelope and pre/post cookie, memory, and durable effects; parity-derived and execution-emitted ID sets independently equal the pre-edit oracle's count and canonical set hash. Relabeling, co-omission, count-preserving substitution, or reusing one request as another operation/family fails. | test |
| AC-09 | As a release operator, I want deployed behavior sampled independently. | Against the running candidate service, the unchanged four-call conformance block in `INTERFACE_CONTRACT.md` passes with the same statuses and required shapes; it is reported as supplementary to the 52/181/87 evidence. | test |
| AC-10 | As an anonymous or signed-in user, I want access enforcement unchanged. | Existing public and optional-session valid/invalid cases retain their outcomes, session-required and operator-token success cases still succeed for authorized actors, and unauthenticated/forbidden/invalid-token cases retain distinct refusals and perform no protected mutation. | test |
| AC-11 | As a user, I want cookie behavior unchanged. | Existing signup, login, logout, settings, credential, OAuth, and other cookie-bearing flows preserve cookie presence, security attributes, clearing, browser-owned transport, redirects, non-enumerating failures, and server-side refusal when client checks are bypassed. | test |
| AC-12 | As a consumer, I want errors and absence to retain meaning. | Approved invalid, not-found, conflict, upstream-failure, and unavailable fixtures preserve their status/body/effect outcomes, while absent, null, empty, and populated fixtures remain distinguishable in generated types, the public facade, and application behavior. | test |
| AC-13 | As a trader, I want streaming unchanged. | Approved SSE fixtures preserve open, consume, heartbeat, malformed-event isolation, close, reconnect, validation, capacity, and pre-stream JSON outcomes; one logical subscription is not duplicated, and a post-load drop retains the existing last-known static content and offline treatment. | test |
| AC-14 | As a trader, I want decision outputs isolated from maintenance. | Across pinned fixtures, entry eligibility, gate result, opportunity score, opportunity tier, state fingerprint, and established quant outputs are byte-for-byte identical before and after the replacement. | test |
| AC-15 | As an application consumer, I want the client boundary unchanged. | Existing consumers compile and pass affected tests through the same `@convexa/api` imports, named exports, and semantic error, null, cancellation, coalescing, credential, cookie, and streaming behavior; no generated deep import or duplicate wire declaration is introduced. | test |
| AC-16 | As a contributor, I want the workflow deterministic and recoverable. | With dependencies installed, canonical generate/check complete offline; check is non-writing; missing output, zero-operation output, drift, invalid output, incomplete coverage, unsupported schema, exporter/tooling failure, and generated-client compilation failure retain their closed meanings; interrupted or failed generation leaves the previously committed artifact set byte-identical. | test |
| AC-17 | As a security reviewer, I want safe diagnostics and artifacts. | Existing negative scans reject credential-like values, current environment values, production origins, cookies/tokens, absolute machine paths, bodies, and forbidden bytes without printing them; clean candidate artifacts and diagnostics expose only vouched package/advisory/stage data, stable identifiers, and repo-relative paths. | test |
| AC-18 | As a trader or operator, I want maintenance to remain invisible. | Existing landing, ticker, scanner, positions, settings, and operator journeys show no added or removed control, link, route, copy, navigation outcome, loading/empty/error/offline/stale treatment, or visual change attributable to this feature. | review |
| AC-19 | As a security reviewer, I want no public tooling surface. | Production route probing and application-link inspection find no added OpenAPI, Swagger, Redoc, Scalar, dependency-status, advisory-status, or equivalent endpoint or link. | test |
| AC-20 | As a contributor, I want documentation to remain factual without narrative drift. | Active documentation remains byte-identical unless implementation makes a live instruction false; if so, only that sentence uses the neutral wording `The repository-owned route/OpenAPI integration is built on Axum and utoipa.` Historical archived contracts remain unchanged, and no second handwritten 52/181/87 source or maintenance announcement is added. | review |
| AC-21 | As a release operator, I want build removal separated from runtime proof. | A production binary built from the locked resolved Cargo graph already proven to contain neither `utoipa-axum` nor `paste` starts and serves the established compatibility probes; the runtime does not consult generation tools or generated contract files. | test |
| AC-22 | As an operator, I want no data consequence. | Completing the replacement and reverting the complete replacement leave persisted user and market data unchanged; restoring generated artifacts without the matching source remains rejected as drift. | test |
| AC-23 | As a reviewer, I want the migration oracle captured before the implementation can redefine success. | Before any route/dependency/artifact replacement edit, the candidate/accept flow creates the previously absent `router-integration-prechange-baseline.json` from a clean, passing, source-revision-matched repository and commits it as a reviewed checkpoint whose parent contains the pre-edit graph. Ordinary generate/check and repeated accept attempts leave that first-added blob byte-identical; stale artifacts, dirty pinned inputs, missing history/execution evidence, reordered capture, baseline/source-revision mutation, and every hash/metadata/ID-set poison fail. | test |
| AC-24 | As a reviewer, I want the pinned `utoipa` seam proven across the complete graph. | `npm run api:router-integration:compile-probe` emits the required revision-bound `PASS` receipt only after all 52 packages compile and the SSE, stateful/auth, declared-error, eight-method, three-metadata-trait, pairing, and operation-set probes pass. A missing, stale, hand-edited, skipped, partial, wrong-count, wrong-set, or wrong-toolchain receipt fails the normal gate. | test |

## 4. UI + interaction

**Flows:** `NO_UI_CHANGE`. No product flow is created. Landing, ticker, scanner, positions, settings, and operator flows—including their success, loading, empty, error, offline, and stale states—remain unchanged.

**Component states:** There is no feature-owned component. Existing product default/loading/empty/error/offline/stale states and copy remain byte-for-byte and behaviorally unchanged; no dependency, advisory, OpenAPI, or documentation status is rendered in the application.

**Copy:** No new user-facing or contributor success slogan is introduced. Existing generate/check strings and coverage warning remain unchanged. Evidence uses the bounded advisory and inventory wording from §1; it never uses the forbidden broader security claims.

**Design authority:** `NO_UI_CHANGE`. `.spire/clusters/tech/context/DESIGN_SYSTEM.md` remains the project design authority and receives no amendment for this backend/shared-tooling maintenance.

**Design direction:** None. No new hierarchy, component, state, keyboard/focus behavior, motion, responsive behavior, or theme token is introduced.

## 5. Error handling

No feature-owned product error state or retry is added. Existing HTTP errors, cookie effects, redirects, pre-stream JSON errors, SSE degradation, facade errors, and application recovery remain unchanged. The local graph must fail before exposing either graph half, so construction cannot silently degrade into an undocumented Axum-only route or an OpenAPI-only entry.

Contributor-visible construction diagnostics use the existing closed contract-check vocabulary exactly:

| Failure | Required category and safe diagnostic |
|---|---|
| Unsupported or empty HTTP method metadata | `incomplete contract coverage: unsupported or empty HTTP method metadata for <handler>` |
| Duplicate path-method registration | `incomplete contract coverage: duplicate path-method registration for <METHOD> <repo-route-path>` |
| Duplicate operation identity | `incomplete contract coverage: duplicate operation identity <operation-id>` with affected safe operation identifiers |
| Actual schema-representation rejection | Existing `unsupported schema construct`; never used for route-metadata invalidity |
| Unexpected constructor panic, serialization failure, or exporter-process failure | Existing `generation tooling failure` with stage and safe underlying diagnostic |
| Completed candidate/committed byte mismatch | Existing `contract drift`; only a completed comparison may say match or drift |

The pure exporter converts every typed `ContractGraphError` into non-zero exit while the existing orchestrator retains the required prefix. Package/advisory failures remain factual native supply-chain diagnostics and are not relabeled as contract drift or generation tooling failure. Missing, skipped, unavailable, or unresolved evidence blocks completion; it is not an empty success. No new wrapper command, progress promise, or success slogan is required.

## 6. Interface — pointer ← THE LOAD-BEARING LINK

**Interface:** `.spire/clusters/tech/contracts/openapi-router-dependency-replacement/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** This is a backend implementation change with `NO_WIRE_BEHAVIOR_CHANGE` and `NO_UI_CHANGE`: no endpoint, field, status, media type, auth mode, cookie, redirect, or SSE semantic changes. The companion file preserves the existing four-call machine-checkable live block and points to the generated/immutable sources of the unchanged 52-operation truth; it does not create a second operation list.

## 7. Testing strategy

Automation owns every silent-regression risk. The normal suite must exercise the local router's method mapping, same-path/different-method merge, duplicate same-method refusal, tag/schema collection, stateful-handler compilation, metadata-derived path normalization, OpenAPI compatibility constructor, and typed error mapping. Pairing and graph poison tests prove accepting and rejecting paths before restored controls pass; their positive controls prove the scanners discover all 52 registrations so the guards cannot pass vacuously.

The existing `npm run api:contract:check`, API contract tool tests, Rust contract/router/parity/direct-HTTP suites, frontend/shared-client tests, production build/start probes, interface-conformance runner, and supply-chain verification remain the evidence tiers. Before implementation, the one-time baseline candidate/accept commands capture the immutable pre-edit oracle; after implementation, the replacement candidate comparison and ordinary contract check independently recompute and compare the four artifact bytes, complete historical metadata, and both observed/declared evidence-ID sets. The preservation oracles are, in order: the pre-edit compatibility oracle; immutable 52-operation baseline and set equality; the required all-52 compile-probe receipt; exact canonical OpenAPI/TypeScript/parity/manifest bytes; 181 executable response conversions; 87 distinct direct-HTTP outcomes; affected application/client tests; and the supplementary four-call live check. Counts alone never substitute for executed identity evidence.

The compiled-registration command must produce the named receipt only from the real compile/test output. Its test matrix includes all eight supported HTTP-method mappings, all three pinned metadata traits, every production pair, and explicit SSE, stateful/auth, and non-success response witnesses. Receipt validation is part of both the candidate comparison and normal contract check; deleting or hand-editing the receipt, bypassing a test, or changing its source revision/count/set/toolchain must be mutation-tested red before the restored control passes.

The accepted supply-chain run includes `cargo deny check advisories licenses sources bans`, root-manifest/lock inspection, and locked resolved-graph proof, with mutations reintroducing each forbidden package. The candidate then passes the production API build and established probes. Generation/check remain offline after dependency installation, deterministic across repeated runs and filesystem roots, non-writing in check mode, and atomic on failure.

Review is appropriate only for the deliberately visible documentation/UI negative space in AC-18 and AC-20. QA inspects the existing journeys and active documentation because an intentional wording or visual edit would be visible; all contract, graph, behavior, absence, auth, cookie, SSE, deterministic-byte, and supply-chain invariants use automated tests because they can regress silently.

## 8. Guardrails this feature must not break

- **`[structural-over-prose-enforcement]`:** one consuming `ContractRouter::route`, a handler/companion bijection, the accepted pre-edit compatibility oracle, immutable operation-baseline comparison, the required all-52 compile receipt, full-byte and ID-set equality, and poisoned red/green controls enforce the single graph. A reminder to synchronize lists is not accepted.
- **`[server-side-gate-enforcement]`:** the exact existing handlers, extractors, middleware, and state continue to authorize requests. OpenAPI security metadata and generated clients remain descriptive; direct server calls still prove refusal and no mutation.
- **`[production-fails-closed]`:** invalid graph construction, unresolved evidence, artifact drift, or a forbidden package blocks build/release/startup before listener and workers. No development fallback, partial graph, runtime generation, or waiver is allowed.
- **`[no-secrets-in-image]`:** the seam is source-only, uses fixed public compatibility metadata, reads no environment, and adds no runtime artifact. Existing artifact scans, runtime-only configuration, and non-root image rules remain intact.
- **`[best-effort-isolated-or-null]`:** no optional computation, handler, bundle, response conversion, or SSE implementation changes. Existing optional failures remain null/omitted and never become routing failures.
- **`[additive-keeps-score-byte-identical]`:** the local seam has no quant/scoring import and supplies no score input; gate, score, tier, and fingerprint fixtures remain byte-identical.
- **`[operator-vs-trader-path-separation]`:** existing access classifications and middleware remain mounted unchanged; generation invokes neither surface, and no operator/research route becomes trader-linked or publicly documented.
- **`[absent-is-not-none]`:** route-owned Serde DTOs, response enums, generated schemas/types, and full OpenAPI bytes remain unchanged; the seam performs no payload transformation that could collapse absent, null, empty, or populated states.
- **Existing API contract authority:** Axum 0.8.9 handlers plus pinned `utoipa = 5.5.0` annotations/DTOs remain the source of methods, paths, shapes, security, cookies, redirects, and SSE data. The historical package-specific OpenAPI `info` object is preserved solely as pre-edit compatibility bytes and does not describe current ownership. Generated OpenAPI/TypeScript and the stable `@convexa/api` facade remain downstream; no second wire authority is introduced.
- **Supply-chain authority:** root manifests and root `Cargo.lock` remain resolution authorities; approved registry/license/source/ban policy remains unchanged. `utoipa-axum`, `paste`, and `RUSTSEC-2024-0436` receive no exception.

## 9. Open questions

None. The operator already chose the immediate repository-owned integration path, and the council settled advisory wording, build-graph/runtime proof separation, inventory terminology, construction-failure categories, pairing mechanism, and documentation stability.

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"source":"R2-architect.md","index":0,"conflict_id":"196875871f102fec32c549746e9d383bb23f41a2870ccc11c2f01e112247cc78","disposition":"folded","section":"§1"},{"source":"R2-architect.md","index":1,"conflict_id":"14564e74b72eb4477da4cbdb03c3bd99e648faed261b9b12082bd7409602f6cd","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":0,"conflict_id":"158168cf1be74d324a77c9b993b93cbe34c2442c45c1efd88a6b0978442abef8","disposition":"folded","section":"§1"}]}
-->
