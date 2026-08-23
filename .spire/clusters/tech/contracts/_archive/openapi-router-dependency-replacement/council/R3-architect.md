# R3 — architect reconciliation: openapi-router-dependency-replacement

## 1. `vulnerable dependency chain`

**Accept.** `RUSTSEC-2024-0436` is an informational `unmaintained` advisory, so `vulnerable` claims
more than the evidence establishes.

Exact proposed wording:

> Ship an internal maintenance replacement that removes the dependency chain responsible for the
> `RUSTSEC-2024-0436` unmaintained finding while preserving every externally observable API,
> application, and contributor-workflow behavior established by `api-contract-generation`.

The mechanism of proof remains three independent observations: the named finding is absent from the
accepted `cargo deny` result, both package names are absent from workspace manifests, and both names
are absent from the resolved Cargo package set. None of those observations supports a broader
vulnerability-free claim.

## 2. Removed packages `unavailable at runtime`

**Accept.** The two Rust crates are compile-time graph members, not dynamically loaded runtime
packages. Runtime unavailability is therefore not a meaningful independent condition.

Exact proposed wording:

> After all checks pass, a production binary built from the locked resolved Cargo graph proven to
> contain neither `utoipa-axum` nor `paste` starts and serves the established compatibility probes.

The mechanism separates build-graph proof from runtime behavior proof: manifest and resolved-package
set checks prove removal before compilation; production build/start plus the established probes prove
the resulting binary still behaves correctly. Runtime-isolation checks remain appropriate for actual
generation tools or generated files that the process could consult after build, but not for removed
Rust source crates.

## 3. Closed failure-category mapping for route construction

**Accept the UX ask.** Unsupported or empty method metadata, a duplicate path-method registration,
and a duplicate operation identity all map to the existing `incomplete contract coverage` category.
They mean the source graph cannot produce one closed, uniquely identified runtime/OpenAPI inventory.
They do not map to `unsupported schema construct`, because the failure is route metadata rather than
a wire-schema representation; they do not map to `generation tooling failure`, because they are
expected invalid-source states rather than unexpected exporter execution failures.

Exact diagnostic wording:

> incomplete contract coverage: unsupported or empty HTTP method metadata for `<handler>`

> incomplete contract coverage: duplicate path-method registration for `<method> <path>`

> incomplete contract coverage: duplicate operation identity `<operation-id>`

The named mechanism is a typed `ContractGraphError` returned by repository-owned graph construction,
with distinct variants for those three states. The pure exporter converts each variant to non-zero
exit plus the corresponding safe diagnostic above, and the existing orchestrator preserves the
`incomplete contract coverage` prefix. Only an unexpected panic, serialization failure, or exporter
process failure remains `generation tooling failure`. Poison tests independently introduce each
invalid state, assert the category and safe detail, and then prove the restored graph passes.
