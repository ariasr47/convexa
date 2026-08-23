# R3 — decisions: api-contract-generation

## Human rulings

None required. The product conflicts are bounded implementation and contributor-workflow choices inside
the already approved API-contract-generation slice. They do not change trader behavior, public scope,
or the production-maturity program order.

## Product resolutions

### Coverage is exhaustive statically and risk-tiered dynamically

The source-derived production operation inventory must account for every operation intentionally
registered by the production Axum router, including aliases, research/operator/demo surfaces,
redirects, HTML or bodyless responses, and SSE. Framework fallback behavior and implicit methods are
tested as router behavior but are not invented as OpenAPI operations.

Every inventoried operation must have contract coverage or a closed, machine-checked specialized
surface classification. Runtime parity is required at every materially distinct status or transport
boundary, with explicit evidence for authentication, cookie effects, SSE lifecycle, absent/null/empty
values, redirects, and operator/trader isolation. One hermetic flow may cover multiple inventory rows;
literal body equality for every nondeterministic or external-integration operation is not required.
Only reviewed normalizers may remove genuinely nondeterministic fields.

This resolves conflicts
`e4c0cbdddb505a8835df7dce34abe907798cc5d3278f024edb312be6955c81f4` and
`97caa19ae3e606038072373f485811c74f755d1893065d4a006e8bc37c1e5363`.

### Manual adapters cannot become a second HTTP contract

Manual adapters are allowed only for transport or lifecycle behavior that OpenAPI does not establish,
principally the browser-native EventSource open/consume/close/reconnect boundary. Request, response,
error, security, cookie, and event DTO wire shapes remain Rust-derived and generated. Every exception
must remain represented in OpenAPI, appear in a set-equality-pinned exception catalog, delegate to
generated types, and own parity evidence. Generator inability to express a typed HTTP wire shape blocks
the mechanism or requires changing the representation; it does not authorize a handwritten fallback.

The default recovery is: `Generation did not complete. Change the contract representation or the
pinned generation chain, then rerun.`

This resolves conflicts
`6c98f56c0c6797d7fb259d1873a72005b2632fb31327fbce3800d61222b0f63d`,
`939210608a0b6b4dec99b92e3467495e46fe2352af3c56679812734ad0167f3d`, and
`8b1bda5146941df0b8750847b979ab3de2b3eaa92bff19981d5c2effc85b7daa`.

### Failure states remain truthful and independently actionable

The closed contributor-facing result categories are:

- `contract drift`: byte comparison completed and reports changed repo-relative artifact paths;
- `missing output`: required artifact paths do not exist;
- `zero-operation output`: the artifact exists but contains no production operations;
- `unsupported schema construct`: a repository policy rule or stable tool diagnostic identifies an
  unsupported construct and its vouched source location when available;
- `incomplete contract coverage`: the inventory is missing an operation or a required
  response/security/media shape;
- `invalid OpenAPI artifact`: completed OpenAPI validation failed;
- `generation tooling failure`: generation failed, named by stage;
- `generated-client compilation failure`: generated TypeScript failed with a compiler location.

Only completed byte comparison may say `stale` or `match`. The one-shot commands have no
duration-dependent progress-copy acceptance requirement; success and every refusal remain distinct.

This resolves conflicts
`00aadbd59341933939ad6158e469b03f0ac1ecc29263173ec63ea3d3beb5a9a5`,
`547baf64e6ffed4ab49c69533562e604ec1bb71bc46dfa08427bc1756295b94b`,
`94ace541491e829be4d44c33a4d8e58ecdc11420c7b43ff0d89ed658585b48b9`,
`d8f28f6dc91b5d0245daf041173692b43e62cbbf06800d81baab11012549d436`, and
`51c13008ccb3439a4cc8dc4cafaa8bf414a68fa3c837bab8ba1e7e3eb6b78791`.

### Preservation and documentation criteria are separated by observable boundary

Ordinary HTTP parity, authentication/status parity, cookie/session effects, SSE lifecycle, public
`@convexa/api` import compatibility, and trader-visible behavior are independent acceptance criteria,
although shared high-level tests may provide evidence for several. Package documentation must make the
source of truth, canonical generate/check commands, result meanings, generated/manual boundary,
migration, troubleshooting, rollback, and ownership concise and discoverable; exact section order is
not binding.

This resolves conflicts
`174b9b4428c34263fe9e2d0e339fd0d0e3537896f4d88ec933438bbe564f4164` and
`5e827c20bc827d6c7596a8f6013e596364d90fcb7e0d1fd587882b050ab32aa3`.

## Technical resolutions

### The proven clean-audit mechanism is binding

The compatibility spike passed with the workspace's locked Axum 0.8.9, `utoipa` 5.5.0,
`utoipa-axum` 0.2.0, `openapi-typescript` 7.13.0, `openapi-fetch` 0.17.0, and TypeScript 5.9.3. It
compiled a shared runtime/OpenAPI route graph, exported byte-identical OpenAPI twice, generated
byte-identical TypeScript offline twice, strictly compiled typed JSON and native-EventSource consumers,
and returned zero production-dependency audit findings for the tested lock tree.

`openapi-typescript` generates `paths`/`operations`/`components`; `openapi-fetch` supplies the generic
typed HTTP client behind the existing named `@convexa/api` facade functions. Emitting one SDK function
file per operation is not required and would trigger GATE Z because it was not proven with a clean
dependency tree. `@hey-api/openapi-ts` 0.99.0 is rejected for this slice because the tested production
tree reported four high-severity audit findings.

This resolves conflict
`39e7ebbcf600d9660ba21bcdee20f764491b837f9700ed12917de40aecc1795b`.

### SSE schema authority is unconditional; browser transport is evidence-driven

OpenAPI covers the stream request, event DTO, pre-stream failures, media type, and contract-meaningful
headers. The stable `@convexa/api` facade preserves native EventSource lifecycle behavior. A generated
SSE operation may be used only if the pinned generator produces a usable operation and parity proves
open, consume, close, reconnect, and no-duplicate behavior. Otherwise generation supplies the DTOs and
the existing native adapter remains the sole approved lifecycle exception.

This resolves conflict
`bbb110d4aecf86160d1319a1fb629e0c8b69adc186b9469d2b5860413ed458c0`.

### Canonical generation is deterministic and offline

After declared dependencies are installed, canonical generate and check commands make no network
requests. Connectivity guidance belongs only to dependency bootstrap. Every generated text file gets
the generated-file notice through a supported generator hook or one deterministic repository-owned
postprocessor before hashing; any non-text output uses a generated-directory sentinel and manifest.

Generated artifacts are produced without runtime values or examples. A named negative artifact scan
checks committed bytes for forbidden credential values, environment values, production origins, and
absolute machine paths. No unsupported claim about an existing repository-wide secret scanner is made.

This resolves conflicts
`d3d68368d7aafbb161b9e71cf8cb334dc82e00a56152b6105946c7ec70afec0d`,
`a80c842fc4eb2480087620fd0032944becc35349ec3b5aa7cac77b68ec36e23d`, and
`5ec10cebeec21ff1593bd2eed1c8d33a5975b39ca193956c7645c35929f961f7`.

### Migration completeness targets duplicate wire authority

Consumers continue importing only `@convexa/api`, never a generated internal path. The compatibility
facade may retain semantic error classes, request coalescing, return-shape adaptation, and the approved
SSE lifecycle adapter, but it declares no migrated request/response/error/event wire shapes. Structural
checks report repo-relative declarations or internal imports that recreate duplicate authority.

This resolves conflict
`4da32e0f06d1d45bae1fdd4c6e24fbf5742c06a60f271cd8da8a059803b1b3bc`.

### Rollback is atomic

Rollback reverts the complete matching Rust contract, OpenAPI artifact, generated tree, and public
facade change together. The canonical drift check must pass afterward. Restoring generated artifacts
alone is prohibited because it creates a stale contract.

This resolves conflict
`f9f46e45401243b7f5a3bf15f21cf02a52cfaf1912c46aba95efa6e552d0c190`.

## Product decisions still open

None.

## R3 exchange closure

- PM: `ACCEPT` — the spike proves mechanism compatibility only; implementation must still prove
  exhaustive inventory coverage, canonical full-graph determinism, response-set structural
  enforcement, and risk-tiered parity at every materially distinct status/transport boundary.
- UX: `ACCEPT` — synthesis must use the proven clean `openapi-typescript`/`openapi-fetch` mechanism and
  the existing native EventSource lifecycle adapter. A generated SSE transport or per-operation SDK is
  a GATE-Z design change, not execution discretion.
