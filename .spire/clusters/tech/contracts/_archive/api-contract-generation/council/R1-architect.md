# R1 — architect position: api-contract-generation

## Position

### Grounded seam and architectural decision

- The live HTTP graph is centralized in `apps/api/src/routes/mod.rs` and built as an Axum `Router<AppState>`. The route modules currently mix concrete Serde structs with `serde_json::Value`, raw `Response`, and `json!` construction. `apps/api/Cargo.toml` has no OpenAPI/schema dependency. The shared TypeScript boundary is hand-maintained in `libs/api/src/lib/convexa.ts` and `libs/api/src/lib/broker.ts`, including browser fetch behavior, auth error translation, special not-found handling, and native `EventSource` lifecycle. These are source-verified facts, not context-pack assumptions.
- Adopt pinned `utoipa` plus `utoipa-axum` for Rust-side OpenAPI 3.1 generation. The decisive axis is structural enforcement: `utoipa_axum::OpenApiRouter` and its `routes!` macro can register an annotated handler into the Axum router and OpenAPI graph in the same expression. Compared with a hand-authored document, this removes the second route list; compared with `aide`, it is the smaller change for the current macro-and-Serde style and has direct Axum 0.8 support. Build/operating cost is local compile-time work, expected scale is one process and tens rather than thousands of operations, and the team already works in Axum/Serde. No scalability advantage justifies a separate schema service.
- Use exact dependency versions in `Cargo.lock` and `package-lock.json`; do not float generator versions. `[lane-check]` The backend lane must compile the selected `utoipa`/`utoipa-axum` versions against this workspace's Axum 0.8 toolchain before broad DTO migration. Current upstream documentation says the bindings support Axum 0.8, but this repository has not yet compiled that combination.

### One route graph, not a runtime graph plus a documentation graph

- Refactor route composition into a pure `contract_router()` that returns `OpenApiRouter<AppState>` without constructing `AppState`, touching a vendor, opening a store, reading an environment secret, or starting a worker. Runtime startup converts the router half and attaches the already-created state; the exporter takes the OpenAPI half. Thus runtime and artifact enumerate methods and paths from the same calls.
- Every currently registered HTTP operation belongs in that graph, including JSON APIs, SSE, redirects, HTML responses, operator routes, and research routes. “Internal” changes security/tagging and generated export policy; it does not permit an undocumented runtime route. Implicit framework behavior such as HEAD handling is represented according to Axum/OpenAPI semantics and pinned by a route inventory test.
- Each operation has one stable, unique operation identity. Generation rejects a missing or duplicate identity because client function naming otherwise becomes order-dependent or changes accidentally.
- Do not serve the artifact from the production router and do not add Swagger/Redoc/Scalar dependencies. The artifact is a checked repository/build product, not a new public or operator endpoint.

### Wire data structures are explicit at the HTTP boundary

- Add route-owned wire DTO modules under the API route layer. Request bodies derive Serde deserialization plus OpenAPI schema; path/query structures derive Serde deserialization plus OpenAPI parameters; successful response bodies derive Serde serialization plus OpenAPI schema. Service/domain types remain free of HTTP/OpenAPI dependencies, especially `libs/quant-engine`.
- Replace handler-level `serde_json::Value` and `json!` response assembly with typed wire DTO construction. This is not permission to change the wire. For each migrated response family, serialize the typed DTO to `serde_json::Value` and compare it to a captured current fixture under the hermetic market-data/state adapters before removing the old assembly. Equality includes field presence, nullability, closed enum values, numeric representation, and nesting.
- OpenAPI optionality must follow serialization, not Rust convenience. A semantically nullable value remains required-and-nullable when the wire always emits it; an omitted value is optional only when Serde actually omits it. A closed state vocabulary remains the discriminator for unknown/empty/inapplicable distinctions. A generic empty object, unconstrained `Value`, or `any` is rejected for JSON request/success/error bodies unless an explicit allowlist records a genuinely free-form document boundary.
- Dynamic keyed collections are typed as maps with a typed value schema, not empty objects. Redirect and HTML responses declare their media type and relevant headers without inventing JSON models.
- Success and failure paths use concrete response enums that implement both Axum `IntoResponse` and utoipa `IntoResponses`. The actual handler return type is the documented response set. Prefer utoipa's response inference only if its pinned `auto_into_responses` path compiles and passes a non-vacuous parity test; otherwise an AST-based contract lint must prove that the response type named in an operation annotation is the handler's concrete return type. This avoids relying on a prose convention. `[lane-check]` The backend lane must resolve this compile-time choice before converting handlers; it may not fall back to unverified handwritten response lists.

### Request, response, error, SSE, and cookie coverage

- JSON operations document all path/query/header inputs, request bodies, successful statuses, declared non-success statuses, and the exact body schema for each status. Shared transport failures use a reusable typed error envelope; auth/gate failures retain their own typed error family and real status distinctions. A catch-all server-error response may reuse the common envelope, but it may not erase known validation, authorization, conflict, not-found, rate-limit, upstream, or unavailable cases.
- Error conversion remains at the route boundary. Services return domain/service errors; a route response enum maps them once into status, headers, and a typed body. The same enum generates the response documentation, so changing a status or error body changes the artifact. Existing non-enumerating auth behavior and browser-facing error translation remain unchanged.
- SSE operations declare `text/event-stream` success content whose schema is the data-event DTO, plus typed pre-stream JSON failures and response headers such as retry guidance. Comment-only connected/heartbeat frames remain transport heartbeats and are not modeled as data events. The runtime stream serializes the same event DTO that provides the OpenAPI schema; it no longer assembles data events with untyped `json!`.
- Generate an SSE SDK operation from the event-stream response, but preserve the existing `@convexa/api` subscription contract through a thin facade. The facade keeps close/unsubscribe behavior, malformed-event isolation, and reconnect behavior while importing the generated parameter and event types. It may use the pinned generator's SSE transport only after parity tests demonstrate those semantics; otherwise it retains native `EventSource` and only the lifecycle adapter remains handwritten. OpenAPI is authoritative for the request and data/failure shapes, not for browser scheduling details that OpenAPI cannot express. `[lane-check]` Verify that the selected pinned `@hey-api/openapi-ts` release recognizes the emitted event-stream operation and generates its SSE function; upstream currently ships an SSE client, but this repository has not generated from its spec yet.
- Define cookie session security in OpenAPI and apply it to protected operations; hybrid/optional-auth operations explicitly permit anonymous access. Session-creating and session-clearing responses document the `Set-Cookie` header and redirect operations document `Location` where applicable. Cookie values, signing material, encryption material, and stored third-party secrets never appear as examples, defaults, generated constants, or artifact content.
- The browser client is configured once with same-origin credentials. It does not attempt to read or synthesize the HTTP-only session cookie; the browser owns cookie transport. Server enforcement remains authoritative, and conformance must call protected operations without the generated facade to prove the gate cannot be bypassed client-side.
- Operator/research token schemes are documented separately from session auth. Merely generating functions for those operations does not link them into trader code, invoke them, or expose token values.

### Deterministic artifact and TypeScript generation

- A small Rust exporter binary calls only the pure contract graph, normalizes OpenAPI maps into stable lexical order, serializes canonical pretty JSON with a fixed trailing newline, and writes the checked artifact at one repository path owned by the API. It must be offline and deterministic across repeated runs on the same locked toolchain. Time, host path, git SHA, environment values, and random identifiers are excluded from the document.
- Generate `libs/api/src/generated/` from that checked artifact with exact-locked `@hey-api/openapi-ts`, its TypeScript-types plugin, SDK plugin, and fetch client. This option wins over OpenAPI Generator's Java/container toolchain on complexity, build cost, and team familiarity; both scale adequately. The generated directory is replaced atomically from a temporary directory, never edited in place, and carries a generated-file banner.
- `libs/api/src/index.ts` continues to expose the stable `@convexa/api` package. The handwritten facade becomes a semantic compatibility layer: it imports/re-exports generated wire types and delegates HTTP work to generated SDK functions while retaining existing consumer function names and deliberate behaviors such as error classes, null-on-specific-status semantics, abort handling, request coalescing, and SSE subscription lifecycle. It must not redeclare wire interfaces or cast arbitrary JSON to response types.
- Dashboard code continues importing only `@convexa/api`, not generated file paths. This keeps generator layout churn inside the library boundary and prevents application modules from binding to generated filenames.
- Generated code is committed so review shows backend-to-client contract impact and production builds do not need network access or runtime generation. The artifact and client contain no secrets and are included in existing secret scanning/image hygiene checks.

### Checked-drift gates and non-vacuous enforcement

- One repository command performs the full offline pipeline into a temporary directory: compile/export OpenAPI, validate it, generate the TypeScript tree with locked versions, and byte-compare both outputs with the committed artifact/tree. Any difference, missing file, extra generated file, schema-less JSON operation, duplicate operation identity, or generation/typecheck failure exits non-zero and prints the exact stale paths.
- The Rust test gate generates OpenAPI in memory from `contract_router()` and compares canonical bytes with the committed artifact. Because the runtime consumes that same router, adding/removing/changing a registered operation changes the test input automatically.
- The `@convexa/api` test/typecheck gate regenerates into a temporary directory and compares the complete generated-tree manifest plus file hashes, then compiles the compatibility facade against it. The normal root test/build scripts and the existing CI frontend/backend jobs invoke the drift check before building deployable artifacts; a stale client cannot pass merely because TypeScript still compiles.
- A schema-policy test walks the generated OpenAPI and rejects operations with missing success/error content, untyped JSON, undocumented security mode, an SSE success without event-stream content, or a secret-shaped example/default. Narrow, reviewed allowlists identify any unavoidable free-form or bodyless operation and are themselves set-equality pinned.
- Prove the checker bites. A test mutates an in-memory copy of the canonical spec and a temporary generated-tree file and asserts the drift command fails for each poison; the clean controls must pass in the same test. Route/DTO integration tests also inject a test-only schema change and prove canonical comparison fails. This is the `[structural-over-prose-enforcement]` negative control, not a claim that reviewers will remember to regenerate.
- Preserve behavioral conformance independently of generation: existing live-router conformance remains, and representative typed DTO fixtures compare actual HTTP status, headers, JSON, cookie attributes, and SSE data events to the pre-feature behavior. Generated types do not validate runtime values by themselves.

### Data flow and isolation

1. Domain/services compute the same values and errors as today.
2. Route adapters convert service results into typed wire DTOs/response enums.
3. The single annotated route graph feeds both the production Axum router and the pure OpenAPI exporter.
4. Canonical OpenAPI feeds the pinned TypeScript generator.
5. Generated SDK/types feed the `@convexa/api` compatibility facade; dashboard consumers remain behind that package boundary.
6. Drift and conformance gates compare both static artifacts and observed runtime behavior before release.

- Contract generation has no runtime state and no failure fallback. A generation problem fails development/CI/release gates; it cannot take down a running trader route, vendor stream, database, cache, or worker.
- No build step fetches the live API or vendor. This avoids nondeterminism, secret requirements, rate consumption, and accidental operator/trader-path coupling.
- A malformed optional response subsection remains isolated according to current endpoint behavior; this feature does not turn best-effort nullable data into a whole-response error. Conversely, auth failures remain real HTTP errors and are not incorrectly absorbed by the bundle's best-effort rule.
- A generator upgrade is a deliberate dependency change with a regenerated diff and full gates, not an incidental lockfile refresh.

### Binding canon restated

- `[production-fails-closed]`: production images are built only after the offline drift check passes. Generation never happens at server startup and there is no stale-development-client fallback in a release. Existing configuration/schema preflight before listener/workers is untouched.
- `[structural-over-prose-enforcement]`: runtime and OpenAPI share one registration graph; wire schemas come from concrete response/request types; stale artifacts and generated clients fail byte comparison; poisoned controls prove those gates are non-vacuous.
- `[cited-code-is-verified-not-assumed]`: the Axum route graph, untyped response seams, current TypeScript clients, cookie behavior, SSE adapter, Cargo dependencies, and CI jobs cited above were read at source. Remaining library-integration uncertainty is marked `[lane-check]`.
- `[no-secrets-in-image]`: generators are offline; schemas contain no secret values/defaults/examples; checked artifacts do not require environment secrets; the existing non-root/runtime-secret model is unchanged.
- `[server-side-gate-enforcement]`: security declarations and generated client behavior document/consume the gate but never replace it. Unauthorized direct HTTP calls still fail at the server.
- `[absent-is-not-none]`: serialization-derived required/null/omitted semantics and closed state vocabularies are carried into generated TypeScript; policy tests reject unconstrained JSON that could collapse those distinctions.
- `[operator-vs-trader-path-separation]`: operator/research operations may be represented in the artifact but generation performs no fetch/recompute/mutation and adds no trader link or runtime docs route.
- `[additive-keeps-score-byte-identical]`: no OpenAPI dependency enters `quant-engine` or signal/fingerprint modules; route DTO conversion is serialization-equivalent and existing score identity fixtures remain byte-identical.
- Core math remains untouched: vendor gamma still owns profile/walls, analytic Black-Scholes gamma still owns flip, and all established DTE/GEX/DEX/HV/VWAP/spot rules remain unchanged. They are response content carried by DTOs, not recomputed by contract tooling.

### Explicit non-goals

- No GraphQL, microservices, API redesign/versioning, public Swagger UI, runtime code generation, runtime schema validation, or schema registry service.
- No endpoint behavior, status, cookie policy, SSE cadence/reconnect semantics, score/tier/fingerprint, quant math, trader-visible behavior, or UI/layout/copy change.
- No generated Rust server from OpenAPI; Rust handler/request/response definitions remain the executable source.
- No direct dashboard imports from generated internals and no removal of the stable `@convexa/api` facade.
- No supply-chain automation, capacity baseline, remote archive body store, telemetry/SLO, replica-worker, recovery, or broader resilience work from later production-maturity slices.

## Risks I see

- The largest implementation risk is migration breadth, not library setup: several live handlers construct large nested values dynamically. A partial conversion that leaves unconstrained schemas would produce an impressive artifact without making the wire authoritative. The schema-policy gate must block that state rather than declaring “most routes” done.
- OpenAPI can describe SSE media, event data, pre-stream failures, and headers, but not all `EventSource` lifecycle behavior. Replacing the native adapter solely because a generator emits an SSE function could change reconnect or cancellation behavior; the facade and parity tests are the isolation mechanism.
- Utoipa annotations can become a new duplication point if response bodies/statuses are written manually beside concrete return types. Response inference or the AST equality lint is therefore load-bearing, and its `[lane-check]` cannot be waved through.
- Code generators can rename symbols or alter nullability across upgrades. Exact lock versions, committed output, the stable facade, and a deliberate upgrade diff contain this; semver ranges do not.
- A typed DTO conversion can accidentally change omitted-versus-null, number formatting, enum spelling, cookie attributes, or error status even when the Rust compiler is green. Pre/post `serde_json::Value` fixtures and live-router conformance are required because schema generation alone cannot detect behavioral equivalence.
- Documenting every registered route makes operator/research surface metadata visible in a checked repository artifact. Since the code already contains those routes, this is not a new runtime exposure, but no production docs endpoint may be added and security schemes must be exact.
- Generated fetch error semantics differ from current custom throwing/null behavior. The compatibility facade must adapt generated results centrally; migrating dashboard callers directly would spread behavior changes and defeat isolation.
- The checked generated tree may be large. If review noise is materially high, split generated types and SDK by tags while retaining one artifact and one package facade; do not retreat to handwritten wire types.

## Assumptions I'm making about the other two lanes

- Product will require complete coverage of every currently registered HTTP operation, not only the subset the dashboard calls; if it permits a narrower surface, the route-inventory and “authoritative” claims need explicit scope instead of a silent allowlist.
- Product will treat preservation of current statuses, headers, auth/gate behavior, cookie behavior, SSE lifecycle, and special client return/error semantics as acceptance requirements; if any are intentionally changeable, the compatibility facade scope changes.
- Product will accept committed OpenAPI and generated TypeScript artifacts as reviewable build products and a non-zero drift check as a normal local/CI failure; if generated files must not be committed, deterministic review and offline production builds need a different artifact mechanism.
- UX/tech-writing will not introduce a public documentation surface or trader-facing contract tooling; if an operator-facing viewer is desired, it is a separate product surface subject to operator-route isolation.
- UX/tech-writing will preserve all current trader-visible behavior and wording while `@convexa/api` changes underneath it; if copy/state changes are requested, they must not be smuggled into this tooling migration.
- The frontend lane will keep dashboard imports behind `@convexa/api` and will accept a stable compatibility facade over generated internals; if it requires direct generated imports, generator naming/layout becomes a product-wide breaking surface.
- Both lanes will distinguish wire-schema authority from browser transport lifecycle: generated request/response/event types are mandatory, while the SSE facade may remain handwritten to preserve native `EventSource` behavior.
