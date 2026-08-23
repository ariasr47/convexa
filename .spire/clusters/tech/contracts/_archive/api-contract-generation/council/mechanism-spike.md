# Mechanism compatibility spike — api-contract-generation

Date: 2026-08-22  
Scope: disposable compile/export/generate probes only; no product source, `SPEC.md`, or `INTERFACE_CONTRACT.md` changed.

## Verdict

The Rust mechanism is compatible with the actual workspace: `utoipa = 5.5.0` plus `utoipa-axum = 0.2.0` compiled with the locked `axum = 0.8.9`, produced OpenAPI 3.1.0, and exported byte-identical JSON twice. The verified construction is one `OpenApiRouter` with a separate `.routes(routes!(handler))` registration for each operation/path.

For TypeScript, prefer the exact clean-audit pair `openapi-typescript = 7.13.0` plus `openapi-fetch = 0.17.0`, with `typescript = 5.9.3`. The generator consumed the local artifact with npm offline mode and dead HTTP(S) proxies, produced byte-identical output twice, and a strict TypeScript probe compiled a typed JSON call plus a native-`EventSource` facade whose path, data-event, and pre-stream error types came from the generated contract. `openapi-fetch` supplies the generic typed HTTP client behind the existing named facade functions; generation does not need to emit one function file per operation.

Do **not** pin `@hey-api/openapi-ts = 0.99.0` now. It functionally passed generation, determinism, SSE-function generation, and strict typecheck, but its installed tree reported four high-severity audit findings. Nearby stable versions did not yield a clean alternative in this bounded probe.

**GATE-Z recommendation: no GATE Z is required for the core mechanism if the design adopts the clean `openapi-typescript`/`openapi-fetch` boundary and retains native `EventSource` lifecycle. Trigger GATE Z if the contract requires generated per-operation SDK files, a generated SSE transport, or browser access to typed pre-stream SSE error bodies; none of those requirements is proven safe by this spike.**

## Workspace and exact versions

| Item | Observed pin/result |
|---|---|
| Workspace backend | `apps/api/Cargo.toml` declares Axum `0.8`; root `Cargo.lock` resolves `axum 0.8.9` |
| Rust toolchain | `rustc 1.97.1 (8bab26f4f 2026-07-14)`; `cargo 1.97.1 (c980f4866 2026-06-30)` |
| Rust contract crates | `utoipa 5.5.0`; `utoipa-axum 0.2.0`; probe also pinned `axum 0.8.9`, `serde 1.0.228`, `futures-util 0.3.31` |
| Node toolchain | Node `26.7.0`; npm `11.17.0` |
| Recommended TS chain | `openapi-typescript 7.13.0`; `openapi-fetch 0.17.0`; `typescript 5.9.3` |
| Rejected TS candidate | `@hey-api/openapi-ts 0.99.0`; `@hey-api/client-fetch 0.13.1` is deprecated because the generator now bundles its client |

Primary mechanism/package references: [utoipa 5.5.0](https://docs.rs/utoipa/5.5.0/utoipa/), [utoipa-axum `OpenApiRouter` 0.2.0](https://docs.rs/utoipa-axum/0.2.0/utoipa_axum/router/struct.OpenApiRouter.html), [openapi-typescript 7.13.0 package metadata](https://www.npmjs.com/package/openapi-typescript/v/7.13.0), [openapi-fetch 0.17.0 package metadata](https://www.npmjs.com/package/openapi-fetch/v/0.17.0), and the [official openapi-fetch documentation](https://openapi-ts.dev/openapi-fetch/).

## Rust compile/export probe

The disposable fixture defined:

- a normal JSON operation with a typed success DTO;
- an Axum `Sse<impl Stream<...>>` operation;
- `text/event-stream` success content referencing a typed event DTO;
- a typed `503 application/json` response;
- a typed `Retry-After` response header; and
- one `OpenApiRouter` split into its runtime `Router` and OpenAPI document with `split_for_parts()`.

Representative commands:

```text
cargo search utoipa --limit 3
cargo info utoipa@5.5.0
cargo info utoipa-axum@0.2.0
cargo check --locked
cargo run --locked --quiet > openapi-a.json
cargo run --locked --quiet > openapi-b.json
cargo tree -i axum --locked
```

Observed results:

- `cargo check --locked` passed.
- `cargo tree -i axum --locked` showed the same `axum 0.8.9` under both the fixture and `utoipa-axum 0.2.0`; no second Axum major/minor entered the graph.
- Both exports had SHA-256 `971E618A1F1535B9EA0608F6A6FE50B474036BDEC5F1FC87733D3C59202E2A00` and were byte-equal.
- The document declared OpenAPI `3.1.0`.
- The SSE `200` content key was `text/event-stream` and referenced the event schema.
- The `503` content key was `application/json` and referenced the error schema.
- The `Retry-After` header schema type was `string`.

Two failures found useful integration constraints:

1. Pinning `serde = 1.0.219` failed dependency resolution against Axum's newer Serde core requirement. `serde = 1.0.228` resolved and compiled. The implementation must take the workspace-compatible locked Serde version rather than copying an old example pin.
2. `OpenApiRouter::new().routes(routes!(probe, stream_ticker))` with two different GET paths compiled but panicked during router construction with `Overlapping method route. Cannot add two method routes that both handle GET`. Registering each operation separately with `.routes(routes!(probe)).routes(routes!(stream_ticker))` passed. Route composition must follow this verified shape; a single macro invocation must not be treated as an arbitrary multi-path route list.

This proves compatibility and same-graph export, not full-repository determinism. The production exporter still needs fixed ordering/canonical serialization, a fixed trailing newline, exact lockfiles, and a repeated-run byte comparison over the full live graph.

## TypeScript probes

### Recommended: openapi-typescript plus openapi-fetch

Registry metadata selected exact versions `openapi-typescript 7.13.0`, `openapi-fetch 0.17.0`, and peer-compatible `typescript 5.9.3`. Representative commands after dependency installation:

```text
set npm_config_offline=true
set HTTP_PROXY=http://127.0.0.1:9
set HTTPS_PROXY=http://127.0.0.1:9
node_modules/.bin/openapi-typescript openapi-a.json -o schema-a.ts
node_modules/.bin/openapi-typescript openapi-a.json -o schema-b.ts
node_modules/.bin/tsc --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler consumer.ts schema-a.ts
npm audit --omit=dev --json
```

Observed results:

- Both generated files had SHA-256 `D164E879BC30E3B79E4BC1989523E6FE3D871F0A67A6E066E385C7E11B334532` and were byte-equal.
- Generated types retained the SSE path parameter, the `text/event-stream` success event DTO, the `503 application/json` error DTO, and the typed JSON probe response.
- A strict consumer using `createClient<paths>()` for the JSON call and generated `operations`/`components` types in a native `EventSource` facade exited `0` under TypeScript 5.9.3.
- `npm audit --omit=dev` reported zero vulnerabilities in the installed exact-pin tree at probe time.
- The generation processes succeeded with only local input and the local binary while npm offline mode and unreachable proxies were set. This is process-level evidence, not a packet capture.

The component boundary is therefore:

```text
Rust DTO/response declarations
  -> utoipa-axum shared route graph
  -> deterministic OpenAPI JSON
  -> openapi-typescript generated paths/operations/components
  -> openapi-fetch generic typed JSON client
  -> existing @convexa/api named compatibility facade

generated SSE parameter/event/error types
  -> existing @convexa/api native EventSource lifecycle adapter
```

### Rejected now: @hey-api/openapi-ts

`@hey-api/openapi-ts 0.99.0` with TypeScript 5.9.3 did functionally work:

- two offline/dead-proxy runs emitted 16 files with no generated-tree hash differences;
- the tree-manifest SHA-256 was `7652D221CB2F2894AA891177B8C3C2CC9E44AF0DD6FCC1A293CE1278F17BDF97`;
- it emitted a typed `streamTicker` SSE SDK function and a fetch/stream-parser implementation; and
- strict TypeScript compilation passed.

It is not the recommended production pin because `npm audit` reported four high-severity findings through `@hey-api/json-schema-ref-parser`, `@hey-api/shared`, and vulnerable `js-yaml` ranges. The relevant upstream advisories included [GHSA-52cp-r559-cp3m](https://github.com/advisories/GHSA-52cp-r559-cp3m) and [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj). Testing nearby releases did not produce a clean stable pin: 0.97.0 had a direct moderate issue fixed in 0.97.3 ([GHSA-hhx9-57xq-r5rw](https://github.com/advisories/GHSA-hhx9-57xq-r5rw)); 0.97.3 then reported one high and three moderate findings through its parser dependency. No override was promoted without a compatibility/security review.

Also, installing current TypeScript `7.0.2` satisfied the generator's broad peer range but crashed `@hey-api/openapi-ts 0.99.0` at startup with `TypeError: Cannot read properties of undefined (reading 'AnyKeyword')`. Pinning TypeScript 5.9.3 avoided that failure. Exact compiler pinning is load-bearing even if this rejected generator is reconsidered later.

## Safe SSE boundary

OpenAPI is authoritative for what it can encode and the probe verified:

- request path/query/header structure;
- `text/event-stream` response media type;
- the JSON shape carried by data events;
- declared pre-stream HTTP error statuses and JSON body schemas; and
- response headers such as `Retry-After`.

It is not authoritative for native browser lifecycle. The current `@convexa/api` code uses `EventSource`, ignores comment heartbeats by browser semantics, relies on automatic reconnect, isolates malformed JSON in the message callback, and returns a close/unsubscribe function. Keep that handwritten lifecycle adapter and import its request/event/error type aliases from generated output. Do not call `openapi-fetch` for the streaming body, and do not adopt a generated fetch-based SSE parser merely because it exists.

A native `EventSource` error event does not expose a typed pre-stream JSON body/status to the facade. The OpenAPI error declaration still documents and checks the server contract, but it does not create browser access to that body. If product acceptance requires the browser to inspect the `503` body or `Retry-After` before streaming, that is a transport redesign (for example a typed preflight or fetch-based SSE implementation) and requires GATE Z plus lifecycle parity tests.

Generated TypeScript types provide compile-time shape only. `JSON.parse` remains unvalidated at runtime, so the existing malformed-event isolation must remain; runtime schema validation is outside this feature unless separately approved.

## Binding constraints and remaining lane-checks

- Generation stays offline, build-time only, and fails closed in drift/release gates. No runtime documentation endpoint or runtime generation is introduced.
- Exact Cargo/npm/TypeScript versions and lockfiles are required. Version or advisory changes require regeneration, typecheck, audit, and review.
- The full implementation must prove operation identity uniqueness, canonical full-graph ordering, typed cookie/security declarations, all real response statuses/headers, and null-versus-omitted parity. This fixture does not prove those route-by-route facts.
- `utoipa` annotations can still duplicate a handler's concrete response set. This spike did not verify `auto_into_responses`; use typed response enums plus a proven inference/lint mechanism before claiming response coverage is structural.
- The clean TypeScript chain generates contract types, while the stable facade continues owning named client functions and deliberate error/null/coalescing semantics. Dashboard modules must not import generated paths directly.
- Audit results are time-sensitive. The zero-vulnerability observation is evidence for the tested lock tree on 2026-08-22, not a permanent property of package names.
- No scoring, quant math, auth enforcement, cookie behavior, SSE cadence/reconnect behavior, operator/trader separation, UI, or endpoint wire behavior may change as part of adopting these mechanisms.
