# S2 — skeptic findings: openapi-router-dependency-replacement

## Critical  (blocks — must loop back to R4)
- None found after checking all three R2 conflicts against the folded resolutions and §9; the remaining concerns below are important implementation-proof gaps rather than dropped conflicts.

## Important  (should fix)
- The bootstrap metadata preservation requirement is asserted but not made mechanically complete as an independent contract oracle. The approved OpenAPI currently contains package-specific values (`info.title` is `utoipa-axum`, with its version, description, contact, and license), yet the spec only says to “reproduce the approved artifact's OpenAPI 3.1 bootstrap metadata” and the interface contract does not enumerate or pin those values. A replacement can therefore appear to preserve the 52 operation set while silently changing metadata unless the exact metadata fixture/field set is explicitly included in the preservation proof. — evidence: `apps/api/openapi/convexa.openapi.json:5370-5379`; `SPEC.md:64`; `INTERFACE_CONTRACT.md:22-24`
- The 52/181/87 preservation proof has counts and byte comparisons, but no separately named immutable identity oracle for the 181 response boundaries or 87 direct-HTTP cases. The spec says these cases are “independently identified” and that relabeling fails, while the interface contract only points to the mutable/generated `parity-coverage.json` and gives the three counts. Without a pinned pre-change case-ID/status/method/path set (or a hash plus an independent parser), a test can execute a different set of 181/87 cases and still satisfy the stated count. — evidence: `SPEC.md:66`, `SPEC.md:98-99`, `SPEC.md:152-154`; `INTERFACE_CONTRACT.md:11-18`

## Minor / advisory
- The stable-macro feasibility is described rather than independently evidenced: the design relies on `utoipa = 5.5.0` generated `__path_*` types implementing the named `Path`, `__dev::Tags`, and `SchemaReferences` surfaces, and on mapping every supported `HttpMethod` to Axum filters. Require the all-52 compile probe (including an SSE, authenticated error, and stateful handler) to remain a named receipt, not merely a planned test. — evidence: `SPEC.md:47-52`, `SPEC.md:152`; `council/R3-architect.md:35-57`

## Checked and clean
- Dropped conflicts: checked all R2 conflicts (`196875…`, `14564…`, `158168…`) against `SPEC.md:11-13, 62-73, 173-175`; each is folded and §9 is explicitly closed.
- Unobservable acceptance criteria: checked AC-01 through AC-22; command, artifact, graph, runtime, conformance, and review criteria each identify an observable test/review boundary.
- Component states: checked §4; `NO_UI_CHANGE` explicitly covers existing default/loading/empty/error/offline/stale states and adds no feature-owned component.
- Interface mismatch: checked the data-flow, preserved-behavior, error, and four-call blocks in `SPEC.md:60-73, 127-148` against `INTERFACE_CONTRACT.md:7-46, 48-114`; no contradictory field, method, path, or conformance shape found.
- Internal contradiction: checked the one-graph transaction, split boundary, error taxonomy, byte/determinism claims, and rollback/guardrail language; no direct section-to-section contradiction found.
- Guardrails: checked all listed §8 guardrails, including single-graph enforcement, server-side authorization, fail-closed construction, absent-vs-null, operator/trader separation, no secrets, and `NO_UI_CHANGE`; no explicit breach found.
- Dependency removal and live seams: checked current `apps/api/Cargo.toml`, `Cargo.lock`, `apps/api/src/routes/mod.rs`, `apps/api/src/bin/export_openapi.rs`, and the current OpenAPI artifact for the stated package, graph, route, exporter, and metadata boundary claims. No fix was made.

