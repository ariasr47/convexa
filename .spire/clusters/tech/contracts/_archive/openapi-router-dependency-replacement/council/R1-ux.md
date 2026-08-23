# R1 — ux position: openapi-router-dependency-replacement

## Position

### Intended people, job, and scope

This feature has no product UI surface. Its intended readers are API contributors, reviewers, and release operators. Their job is to verify that the route/OpenAPI integration dependency changed while the generated contract, runtime behavior, and application stayed the same.

`NO_UI_CHANGE` is binding. Landing, ticker, scanner, positions, settings, and operator journeys gain no control, route, link, label, loading treatment, empty treatment, error treatment, offline treatment, or visual change. No OpenAPI, Swagger, Redoc, Scalar, dependency-status, or advisory-status page is added or linked. The project design system is therefore not amended by this feature.

The primary information hierarchy remains:

1. The Rust Axum route graph is the HTTP-contract source of truth.
2. `npm run api:contract:generate` writes the deterministic generated artifacts.
3. `npm run api:contract:check` is the non-writing contract drift/policy/compile check.
4. The supply-chain evidence is the named `cargo deny check advisories licenses sources bans` result plus manifest/resolved-graph absence of `utoipa-axum` and `paste`.
5. Runtime, contract, and application parity is demonstrated by the existing gates; no terminal sentence or document may turn a passing dependency check alone into a broader compatibility claim.

The current `libs/api/README.md` opening remains accurate because it says the Rust Axum route graph is the source of truth without naming `utoipa-axum`. A dependency-removal narrative is not required there merely because the internal seam changed. If implementation makes an active contributor or runbook sentence inaccurate, replace only the inaccurate sentence. The supported neutral description is: `The repository-owned route/OpenAPI integration is built on Axum and utoipa.` Do not rewrite archived contracts as though they were current setup guidance; they are historical evidence of the pre-replacement mechanism.

### User vocabulary and copy integrity

Use these terms consistently:

- `repository-owned route/OpenAPI integration` for the replacement seam;
- `Rust Axum route graph` for the source of HTTP methods, paths, and wire behavior;
- `generated artifacts` for OpenAPI, parity coverage, generated TypeScript, and their manifest;
- the existing closed contract-check categories verbatim: `contract drift`, `missing output`, `zero-operation output`, `unsupported schema construct`, `incomplete contract coverage`, `invalid OpenAPI artifact`, `generation tooling failure`, and `generated-client compilation failure`;
- `RUSTSEC-2024-0436 finding` for the specific advisory result.

Do not use `secure`, `safe`, `vulnerability-free`, `all advisories fixed`, or `dependency-free`. The evidence can vouch only that the named finding was not reported by the named check and that the two named packages are absent from the inspected manifests and resolved Cargo graph. Do not call the change a `router replacement`: that can be read as a runtime/router-graph change. The truthful phrase is `router integration dependency replacement` or `route/OpenAPI integration replacement`.

No new success slogan is required. Preserve the established contract-tool output exactly where it already applies:

- Generation: `Generated API contract artifacts.` This does not claim the output matches committed artifacts or that dependency checks passed.
- Clean comparison: `API contract check passed: generated artifacts match the Rust API contract.` This appears only after the existing completed contract validation, generation, scan, compile, and byte comparison.
- Drift: `API contract drift detected. Generated artifacts do not match the Rust API contract.`
- Drift recovery: `Run npm run api:contract:generate, review the diff, and commit the generated files.`
- Coverage warning: `Coverage note: the four-call live conformance block is supplementary; response-envelope conversions are exhaustive, typed schemas are enforced through the Rust-to-OpenAPI-to-TypeScript graph, and direct HTTP evidence is risk-tiered across every source-derived operation.`

The dependency/advisory command should retain its own factual diagnostics. A wrapper, if another lane already requires one, may say only `OpenAPI router dependency replacement checks passed.` and only after all of the brief's named dependency, advisory, contract, runtime, application, and live-conformance gates have completed successfully. On failure it must preserve the failing command's concrete package, advisory ID, repo-relative manifest path, or stage instead of collapsing the result into `contract drift` or `generation tooling failure`. Those categories describe the established contract checker, not every build failure.

Counts must remain sourced, not narrated. The operation, response-boundary, response-conversion, and direct-HTTP counts shown in `libs/api/README.md` are read from the generated parity artifact. This feature must not add another handwritten count. The approved snapshot values—52 operations, 181 material response boundaries/conversion cases, and 87 direct-HTTP cases—may be displayed only where the generated artifact remains the cited source.

### Complete component states

There is no feature component in the product, so default/loading/empty/error/offline/stale/success product states are all unchanged existing application states. The operator-facing surfaces have this bounded state model:

| Surface | State | What the person sees or does | What must not be claimed |
|---|---|---|---|
| Product application | default, loading, empty, error, offline, stale, success | Existing behavior and copy, with no feature-owned element | No dependency, OpenAPI, advisory, or documentation status in the app |
| `libs/api/README.md` | default | Existing source-of-truth, commands, boundaries, ownership, rollback, and conformance guidance; amend only a sentence made false by the implementation | No claim that a package swap alone proves compatibility or security |
| Active docs | stale wording | If an active instruction prescribes `utoipa-axum` or `paste`, replace that instruction with the neutral repository-owned-integration wording | Do not rewrite historical archived evidence; do not imply an archive is current guidance |
| Contract generate command | running | Normal shell execution/cancellation behavior; no new progress language required | Running is not success; generation is not comparison |
| Contract generate command | success/error | Existing exact success and stage-specific error language; prior committed bytes remain governed by the existing atomic behavior | No dependency/advisory result is inferred from generation |
| Contract check command | running | Normal shell execution/cancellation behavior; no new progress language required | No `match`, `stale`, or clean claim before completed comparison |
| Contract check command | success/error | Existing exact clean sentence or existing closed category and recovery | Do not relabel dependency/advisory failure as a contract-check category |
| Dependency/advisory gate | success | Native command output, or the bounded wrapper sentence only after every brief-named gate passes | No `vulnerability-free`, future-safety, or whole-repository security claim |
| Dependency/advisory gate | error | Native factual diagnostic identifying the observed package, finding, manifest, resolved graph, or failing stage | Do not guess connectivity, advisory-database freshness, or root cause |
| Dependency/advisory gate | offline/stale | No special state is invented. If the underlying tool vouches for a network or advisory-database freshness problem, relay that fact; otherwise use the observed tooling failure | A missing network/freshness signal is not evidence that the database is current or stale |
| Dependency/advisory gate | empty/missing evidence | Treat a missing manifest, unresolved graph, skipped advisory stage, or absent command outcome as failure/incomplete evidence | Absence of evidence is not a clean result |

Status must be conveyed by words and process exit, never color alone. Diagnostics must retain the established safe-output discipline: repo-relative paths and stable identifiers are useful; credentials, cookies, tokens, environment values, configured origins, absolute machine paths, request/response bodies, and forbidden artifact bytes are not.

### Acceptance-criteria contribution and AC-to-state mapping

These are the UX/tech-writing requirements I expect the synthesized acceptance table to carry. `test` protects silent invariants and negative space; `review` is reserved for visible, intentional wording/presence.

| UX AC | Observable acceptance criterion | Component state(s) | Verify by |
|---|---|---|---|
| UX-01 | Existing landing, ticker, scanner, positions, settings, and operator journeys show no added or removed control, route, link, copy, navigation outcome, loading/offline/error treatment, or visual change attributable to this feature. | Product application: all existing states | review |
| UX-02 | Production route probing and application-link inspection find no OpenAPI/Swagger/Redoc/Scalar, dependency-status, or advisory-status endpoint or link. | Product application: default and navigation; negative space | test |
| UX-03 | Existing `api:contract:generate` and `api:contract:check` success, drift, recovery, coverage-warning, and closed error-category meanings remain unchanged; a dependency/advisory failure is not mislabeled as contract drift or generation tooling failure. | Contract commands: success and error | test |
| UX-04 | Active contributor documentation continues to identify the Rust Axum route graph as source of truth and the repository-owned integration as Axum + utoipa if the mechanism is named; it does not prescribe `utoipa-axum` or `paste`, overstate security, or create a second handwritten count source. Historical archived contracts remain identifiable as historical evidence rather than current setup guidance. | README default; active-doc stale wording | review |
| UX-05 | Any feature-specific wrapper success is withheld until every brief-named dependency, advisory, contract, runtime, application, and live-conformance gate has passed; missing/skipped evidence fails, and failures retain the factual package/advisory/stage diagnostic. | Dependency/advisory gate: success, error, empty/missing evidence | test |
| UX-06 | Operator-facing diagnostics expose only vouched package names, the advisory ID, stages, safe identifiers, and repo-relative paths; negative fixtures or scans prevent credentials, tokens, cookies, environment values, production origins, absolute paths, bodies, or forbidden bytes from appearing. | Contract and dependency/advisory gates: error | test |
| UX-07 | The numbers 52, 181, and 87 remain unchanged where currently displayed, and any displayed operation/boundary/evidence count remains attributed to and checked against the generated parity artifact rather than maintained as a second catalog. | README default; gate success summary | test |

The design-review stop condition applies: because there is no new rendered surface, there is no new hierarchy, interaction, keyboard, focus, motion, responsive, or theme-token design to invent. Review is limited to proving the absence of a UI change and the clarity/truth of the repository and terminal surfaces above.

## Risks I see

- An implementation-focused edit could replace the accurate `Rust Axum route graph` phrase with `custom router`, falsely suggesting a runtime routing redesign.
- A green `cargo deny` run could be summarized as `secure` or `all vulnerabilities fixed`; neither claim is vouched by the narrow advisory/package evidence.
- `RUSTSEC-2024-0436` may disappear from one command while `utoipa-axum` or `paste` remains in a manifest or resolved graph. A success sentence before all named checks would conceal incomplete work.
- The archived API-contract spec names `utoipa-axum` because it records the prior mechanism. Editing that archive would erase useful historical evidence, while linking it as current setup guidance would mislead contributors.
- The integration refactor could accidentally alter existing command first-line meanings, causing a package/advisory failure to look like contract drift or causing generation to look like a clean comparison.
- A new status page, docs endpoint, dashboard link, or operator widget would violate the brief even if it seems to make the dependency work more discoverable.
- A copied `52`, `181`, or `87` outside the generated-artifact-backed documentation pattern could become stale while still looking authoritative.
- Treating missing command output, an unresolved Cargo graph, or an unavailable advisory database as a clean/empty state would turn absence of evidence into a security claim.
- Adding progress percentages, duration promises, or network/freshness wording would invent data and guarantees not supplied by the brief or the existing contract tooling.

## Assumptions I'm making about the other two lanes

- The architect lane will define a repository-owned Axum + utoipa integration seam that preserves one source-derived runtime/OpenAPI graph and keeps the existing generate/check commands and their observable result categories intact.
- The architect lane will provide machine-checkable evidence for manifest absence, resolved-graph absence, the specific `RUSTSEC-2024-0436` result, no new documentation route, and all preserved 52/181/87/four-call gates, so terminal copy never has to infer those facts.
- The PM lane will keep `NO_UI_CHANGE`, no documentation endpoint, and no trader/operator navigation addition as explicit acceptance criteria rather than treating them as implementation notes.
- The PM lane will require compatibility and supply-chain completion to be reported as separate observed facts, and will not define a broad `secure` or `vulnerability-free` product claim.
- The PM lane will treat active contributor documentation as the only wording that may need correction and archived contracts as historical evidence, unless a separate archival policy decision says otherwise.
