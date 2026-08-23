# R3 — UX/tech-writer reconciliation: openapi-router-dependency-replacement

## 1. Evidence-bounded advisory wording — ACCEPT

Accept the architect's correction and reject the PM phrase `known vulnerable dependency chain`. The cited RustSec record is an `unmaintained` advisory; the feature evidence does not vouch a vulnerability finding or a broad security state.

Exact copy constraints:

- Use `the dependency chain responsible for the RUSTSEC-2024-0436 unmaintained advisory` when naming why the chain is removed.
- Completion may say: `The candidate passes cargo deny check advisories licenses sources bans with no RUSTSEC-2024-0436 finding; utoipa-axum and paste are absent from project manifests and the resolved Cargo graph.`
- Do not use `vulnerable dependency chain`, `vulnerability fixed`, `vulnerability-free`, `secure`, `safe`, `all advisories fixed`, or `dependency-free`.
- Do not infer advisory-database freshness, future safety, or repository-wide security from the named command result.
- Omit the conditional feature-specific wrapper success sentence from R1 UX. No new wrapper command or success slogan is required; native command output and the existing gate receipts are the evidence.

## 2. Operation-inventory wording — ACCEPT

Accept `52 source-derived production operations` and reject `52 public operations`. The inventory contains public, authenticated, operator-token, operator/research, and currently unconsumed production surfaces; `public` incorrectly renames their access and audience meaning.

Exact copy constraints:

- Preferred: `the existing 52 source-derived production operations`.
- Also acceptable where space is tight: `the existing 52-operation runtime/contract inventory`.
- Do not use `52 public operations`, `public API inventory`, or wording that implies all inventoried routes are publicly accessible, publicly documented, or trader-linked.
- When access meaning matters, retain each operation's existing access classification; do not summarize the whole set under one access label.

## 3. Construction-failure categories — ACCEPT WITH EXACT MAPPING

Accept the architect's fail-closed construction behavior, provided contributor-visible output uses the existing closed contract-check vocabulary. `closed construction failure` is an architectural description, not a new terminal category or first-line label.

Exact mapping and copy constraints:

- Unsupported method metadata maps to `unsupported schema construct` only when repository policy or a stable tool diagnostic vouches the affected operation/construct and repo-relative source location. If that evidence is unavailable, retain `generation tooling failure` with the construction/export stage and safe underlying diagnostic; do not guess.
- Empty method metadata for a production registration maps to `incomplete contract coverage` when the affected registration/operation can be identified.
- Duplicate path-method registration maps to `incomplete contract coverage` and identifies the affected method/path using safe repository-relative diagnostics.
- Duplicate operation identity maps to `incomplete contract coverage` and identifies the duplicated stable identity and affected operations without printing payloads or environment data.
- An unexpected constructor panic or unclassified exporter failure remains `generation tooling failure`; it is never `contract drift`, because completed byte comparison did not occur.
- `contract drift` remains reserved for completed byte comparison. No constructor failure may say `match`, `stale`, or use the clean-success sentence.
- Do not add `closed construction failure`, `router integration failure`, or `dependency replacement failure` to the closed result vocabulary.

## 4. Active documentation stability — ACCEPT

Accept byte-identical active documentation as the default. The inspected `libs/api/README.md` already names the Rust Axum route graph as source of truth and does not prescribe either removed package, so this feature requires no README or runbook wording change. Archived contracts remain unchanged historical evidence.

Exact copy constraints:

- Do not add a dependency-removal narrative, migration note, advisory badge/status, new documentation section, served documentation route, application link, or product copy.
- Do not edit active documentation merely to announce the maintenance change.
- If implementation makes a live active sentence factually false, change only that sentence. The allowed neutral mechanism wording is: `The repository-owned route/OpenAPI integration is built on Axum and utoipa.`
- Do not edit archived contracts to replace their historical `utoipa-axum` description, and do not present an archived contract as current setup guidance.
- Existing contract generate/check success, drift, recovery, coverage-warning, and error-category copy remains byte-for-byte unchanged unless the implementation independently proves an existing sentence false; this reconciliation authorizes no such change.
