# R1 — architect position: supply-chain-automation

## Position

### Source-grounded starting point

The current repository has the right raw material for a reproducible supply chain, but not one authority or one fail-closed policy:

- The root npm lock is lockfile v3 and all non-workspace resolutions observed in it use `registry.npmjs.org` with integrity hashes. The root Cargo lock uses only the crates.io registry with checksums. Those two root locks should remain the dependency-resolution authorities.
- `.nvmrc` selects Node `26.7.0`, which is a Current release on 2026-08-22, while `apps/dashboard/Dockerfile` selects the floating `node:24-alpine` LTS line. `package.json` accepts ranges (`node >=24`, `npm >=10`), so a developer, GitHub runner, and container can presently select different toolchains for the same revision.
- There is no repository Rust toolchain file. Both Rust workflows install the moving `stable` channel; the API image uses moving `rust:1-bookworm`; and only `libs/quant-engine` declares a `rust-version` (`1.75`) even though the API Dockerfile records that the current lock needs Rust 1.88 or newer. The declared support floor therefore does not describe the workspace that is actually built.
- `ci.yml` and `conformance.yml` correctly use the root Node pin and root Cargo workspace, and all existing workflows start from read-only repository permissions. They nevertheless invoke every third-party action through mutable major/channel tags (`checkout@v4`, `setup-node@v4`, `rust-toolchain@stable`, `rust-cache@v2`, and `upload-artifact@v4`).
- No Dependabot/Renovate policy, Rust deny policy, CodeQL workflow, dependency-review gate, repository/image/config/secret scan, SBOM generation, or provenance attestation exists at source.
- `npm audit --package-lock-only` on 2026-08-22 reports 14 high findings, all in the development graph; `npm audit --omit=dev` reports zero. The 14 package nodes collapse to two vulnerable transitives: `nx@23.1.1` pins `brace-expansion@5.0.8` affected by `GHSA-rgw5-rvv9-x895`, and Vite/PostCSS resolves `nanoid@3.3.16` affected by `GHSA-2v37-7h3g-55p8`. npm's proposed “fix” is an Nx downgrade to `22.6.5`, which would cross the workspace toolchain major and is not acceptable without an intentional migration.

### One supported toolchain tuple

Adopt exactly **Node 24.19.0, npm 11.17.0, and Rust 1.98.0**. Node 24.19.0 is the latest LTS release and bundles npm 11.17.0 as of the design date; Rust 1.98.0 is the current stable release. Node 26 Current is not a production support target. This is a single supported tuple, not a minimum range or a test matrix.

The mechanism is three checked-in authorities plus a parity guard:

1. `.nvmrc` is the Node authority and contains `24.19.0`. `package.json` declares the exact Node/npm tuple and an exact package-manager identity; repository npm configuration makes an engine mismatch fatal. GitHub setup reads `.nvmrc`, and a first-step toolchain guard compares the running `node --version` and `npm --version` with those declarations before install.
2. A root `rust-toolchain.toml` is the Rust authority with channel `1.98.0`, minimal profile, and only the components used by gates (`rustfmt` and `clippy` when those gates exist). Workspace packages inherit one `rust-version` matching the supported compiler. Because these are private applications rather than a published compatibility library, retaining an untested 1.75 MSRV adds cost and false confidence with no consumer benefit.
3. Builder images use exact version tags **and immutable image digests** matching those authorities; runtime base images are also digest-pinned. Dockerfiles must repeat a version in `FROM`, so a repository parity check compares those repeats with `.nvmrc`/`rust-toolchain.toml` and fails on divergence. GitHub jobs use `ubuntu-24.04`, not `ubuntu-latest`, while acknowledging that GitHub's hosted image is still a serviced environment rather than a bit-reproducible VM.

All npm installs remain `npm ci`; all Cargo builds, tests, metadata, and policy commands use the root lock with `--locked`. The nested `libs/quant-engine/Cargo.lock` is not a workspace build authority and should be removed or structurally rejected so a reviewer cannot mistake it for a separately supported graph. The mechanism guarantees deterministic selection from checked-in inputs; it does not pretend that two Docker builds are bit-identical when an upstream OS repository or hosted runner changes.

I choose one exact production tuple over “latest LTS/stable” channels or an N-version matrix. It has the fewest states and lowest CI cost, matches this team's existing single-path workflows, and scales to this repository's one application deployment. The decisive axes are complexity and team familiarity. Security updates move the tuple through reviewed bot PRs; they do not mutate it under an unchanged revision.

### Dependency-update automation

Use **Renovate** as the one proposal engine. Dependabot is more familiar and has lower initial configuration cost, but it cannot make `.nvmrc`, `rust-toolchain.toml`, all Docker digests, npm, Cargo, and GitHub Actions participate in one intentional grouping policy without a second custom updater. Renovate's higher configuration complexity is justified here because completeness and reviewability dominate; two partially overlapping bots would create more states and more review load.

Renovate opens PRs but never auto-merges. It updates locks in the PR and uses these bounded groups:

- the Node/npm/Rust toolchain tuple and their matching builder-image digests;
- GitHub Actions, with tag labels retained as comments but executable references replaced by full commit SHAs;
- production npm dependencies, grouped only by an actual coupled family (React, MUI/Emotion, or a directly coupled runtime family), never one catch-all production PR;
- the Nx family as one atomic group because its plugins must stay on one release line;
- Vite/Vitest and their Nx adapters as one build/test family only when their peer ranges prove compatible;
- other npm development dependencies in small tool-purpose groups;
- Cargo runtime crates in semantically coupled families (Tokio/Axum/Tower, Rustls/Reqwest/WebSocket, SQLx/Postgres, and crypto/auth), with unrelated crates separate;
- Docker runtime bases separately from builder toolchains.

Major upgrades are always isolated. Normal proposals are weekly with a short release-age floor; security proposals bypass that wait and are opened as soon as the advisory source identifies a fixed version. A low concurrent-PR limit prevents bot churn. Every proposal must pass the same locked install, policy, build, test, scan, SBOM-validation, and negative-control jobs as a human PR. “Green lockfile” is not sufficient proof.

### Advisory, license, and source policy

Policy is repository data, parsed before a build, not prose in a workflow comment. A checked-in exception registry contains the advisory/license/source identifier, ecosystem, exact package and dependency path, runtime versus development reachability, rationale, compensating control, owner, creation date, expiry date, and intended fixed version. Unknown keys, missing evidence, or an expired entry fail the gate. Exceptions cannot use package-name globs and cannot suppress a future advisory with a different identifier.

For npm:

- The complete lock is scanned. Production dependencies fail on any known advisory (`low` or higher), because the current production graph is already at zero and relaxing that baseline buys nothing. Development dependencies fail on high or critical advisories; moderate/low findings remain visible and enter scheduled remediation rather than silently disappearing.
- The existing high development findings are repaired without `npm audit fix --force` and without downgrading Nx. Keep Nx at 23.1.1, override only the vulnerable Nx edge to `brace-expansion@5.0.9`, and override the compatible PostCSS edge to `nanoid@3.3.18`; regenerate the lock, run `npm ci`, run both full and production-only audits, and run the complete existing CI battery. These are patch replacements inside the affected dependency families, not application dependency rewrites. If either override cannot pass that proof, retain the current direct versions and create a short-lived, exact-GHSA development-only exception while an upstream fixed Nx/Vite release is tested. No broad “Nx” waiver and no major downgrade is allowed.
- A full-graph license check uses SPDX expressions. The normal allow set is permissive licenses already expected in this stack (MIT, Apache-2.0 including LLVM exception, BSD-2-Clause, BSD-3-Clause, ISC, Zlib, Unicode-3.0, CC0-1.0, and approved data-only attribution licenses); MPL-2.0 is permitted only under its file-level terms. GPL, AGPL, SSPL, BUSL, Commons-Clause/source-available terms, missing/unknown licenses, and unparseable expressions fail unless an exact reviewed exception exists. LGPL or any new reciprocal expression stops for explicit review rather than being guessed into either bucket.
- Every registry package must resolve from HTTPS `registry.npmjs.org` and carry integrity. Workspace links may point only inside the declared npm workspaces. Git, branch, arbitrary tarball, HTTP, and undeclared registry sources fail a lockfile source guard.

For Rust, one exact-version `cargo-deny` installation runs `advisories`, `licenses`, `bans`, and `sources` checks against the root Cargo lock. RustSec yanks are denied unless an exact exception exists; known vulnerabilities fail at every severity unless their advisory is explicitly ignored with the same expiring record. crates.io with checksum and workspace-local path crates are the only allowed sources; git dependencies, alternate registries, duplicate critical crypto versions, and wildcard dependencies fail. The license policy uses the same SPDX posture as npm and handles multi-license expressions according to an allowed branch rather than flattening them to “unknown.”

GitHub dependency review runs on pull requests to reject a newly introduced vulnerable dependency, disallowed license, or prohibited source before it reaches the full graph. Full npm and Rust scans also run on a schedule and on the default branch so a newly published advisory can make an unchanged revision fail. That time variance is deliberate security freshness, not toolchain drift; each run records scanner version and advisory-database revision in its receipt.

### Code, workflow, config, secret, and image surfaces

CodeQL advanced setup covers only live languages and live source: `javascript-typescript` for the dashboard, shared client, Pages function, and repository Node tools; `rust` for `apps/api` and `libs/quant-engine`; and `actions` for `.github/workflows`. Archived Python is explicitly out because project context marks it non-ground-truth. Generated output, caches, `node_modules`, `target`, and vendored/build artifacts are excluded; generated source that is committed and executed remains included. Security-extended query suites run on pull requests, default-branch pushes, and a weekly schedule. CodeQL build/upload jobs receive only `contents: read` plus job-local `security-events: write` where required.

Use **Trivy** as the common repository/config/image policy engine and **Gitleaks** for repository-history and PR-diff secret detection. Exact tool releases and downloaded binary checksums live in a checked-in security-tool manifest. Trivy scans Dockerfiles, Compose, Railway config, GitHub workflow configuration, the repository dependency surfaces, and each final API/dashboard image by digest. Final-image scans include OS/application vulnerabilities, configuration findings, licenses, and secrets. High/critical vulnerabilities and misconfigurations fail; any secret match fails; “unfixed” is not an automatic pass and must use the same exact, expiring exception mechanism. Gitleaks scans the committed revision and PR range so deleting a secret from the final filesystem does not erase it from reachable history.

The image path preserves `[no-secrets-in-image]` by construction: build contexts remain filtered by the checked-in Docker ignore rules, secret/config values enter only at runtime, build arguments do not carry secrets, and final images run non-root. A negative policy test poisons a fixture with a forbidden lock source, an expired exception, a mutable action tag, and an unpinned image reference and proves each guard turns red; this satisfies `[structural-over-prose-enforcement]` without committing a real credential.

### SBOM and provenance flow

Syft, pinned by exact version and checksum, generates CycloneDX 1.6 JSON for the root dependency source and for each built image by immutable digest. Each SBOM is schema-validated, scanned, hashed, and uploaded with a small receipt containing repository revision, tool versions, lockfile hashes, image or dashboard artifact digest, scan result, and advisory-data revisions. An SBOM missing either npm or Cargo components, or referring to a digest different from the scanned artifact, fails publication.

On trusted default-branch/release events, GitHub artifact attestation signs build provenance and the SBOM association for the exact API image digest and dashboard build archive. The release job gets only job-local `id-token: write` and `attestations: write` (plus `packages: write` if it publishes an image); pull-request jobs receive none of those permissions and never publish. Attestation actions are themselves full-SHA pinned. The output is verifiable from repository identity, workflow identity, commit, and subject digest rather than from an unsigned filename.

The current Railway and Cloudflare arrangements rebuild from source outside this GitHub artifact boundary. Therefore this feature must not claim that a GitHub attestation proves the bytes presently deployed by those hosts. The in-scope claim is exact: GitHub-built artifacts and images have verified SBOM/provenance. Making the hosts consume those exact immutable subjects is a later deployment cutover unless the owner explicitly expands this feature.

### Gate data flow, isolation, and permissions

The data flow is:

`human/Renovate change → pin and lock parity → locked installs → source/license/advisory policy → CodeQL + workflow/config/secret checks → existing lint/typecheck/tests/build → image build once → image scan → SBOM generation/validation → trusted-event attestation/publication`.

No scanner mutates a manifest or lock. No “fix” command runs in CI. The built image is addressed by digest after creation, and that same digest is scanned, described by the SBOM, and attested; a rebuild between those steps is forbidden. Publication/deployment jobs depend on every required gate and cannot run with `continue-on-error`. Scanner download failure, advisory-database failure, malformed report, missing artifact, expired exception, or report upload failure is a hard failure. Reports are artifacts, not runtime data, and contain paths/identifiers but no environment values or secret material.

All workflows set `contents: read` by default. Checkout disables persisted credentials. Every `uses:` reference is a full 40-character commit SHA with the human-readable release tag in a comment, and Renovate proposes SHA movement. Write capabilities are job-local and absent from untrusted pull requests: `security-events: write` only for SARIF upload; `id-token`/`attestations` only for trusted provenance; `packages: write` only for trusted image publication. No general `pull-requests: write`, `actions: write`, or repository write token is needed for gates.

This gate architecture is isolated from the application: it adds no application state, network request, route, payload, compute, scoring, trader path, or UI behavior. It restates and holds the binding constraints touched here:

- **`[no-secrets-in-image]`** — contexts, layers, SBOMs, reports, and final images contain no secrets; runtime injection and non-root execution remain mandatory.
- **`[production-fails-closed]`** — prohibited or unverifiable supply-chain state blocks publication before a production artifact exists; there is no warning-only fallback.
- **`[structural-over-prose-enforcement]`** — exact pins, source guards, exception expiry, permission checks, and poison tests make drift build-breaking.
- **`[cited-code-is-verified-not-assumed]`** — every reuse claim above was read from the live root manifests, lockfiles, Dockerfiles, Railway config, and three current workflows; archived Python is not cited as implementation ground truth.
- **`[secret-encrypted-at-rest]`** remains unchanged: this feature neither reads nor handles stored application secrets, and its artifacts must not expose ciphertext or secret-bearing environment values.
- **`[additive-keeps-score-byte-identical]`** — the scoring, tier, entry gate, and fingerprint modules are outside the write surface; supply-chain changes must demonstrate an empty application-runtime behavior delta.
- **`[operator-vs-trader-path-separation]`** — CI/security evidence remains an operator/build concern, with no trader route or trader-visible surface.

### Explicit non-goals

- We do not change application runtime behavior, API/interface shape, quant math, scoring, authentication, persistence, trader UI, or user-facing copy because the brief is an internal build/release correctness feature.
- We do not auto-remediate or auto-merge dependency changes. Tools propose and reject; humans review the resulting bounded change.
- We do not downgrade Nx to satisfy npm's suggested fix, flatten every dependency into exact manifest versions, or delete lockfiles. Reproducibility comes from exact toolchains plus committed locks.
- We do not promise bit-for-bit reproducible hosted-runner or OS-package builds. We pin selectable inputs, record actual subjects, and attest their provenance.
- We do not claim CodeQL covers archived Python, container OS packages, secrets, or dependency advisories; the named scanners own those separate surfaces.
- We do not claim GitHub provenance for independently rebuilt Railway/Cloudflare production bytes until deployment consumes the attested immutable subject.
- We do not introduce a second registry, private package source, custom certificate authority, binary vendoring scheme, or self-hosted runner in this feature.

## Risks I see

- **The Nx transitive override may expose an undocumented compatibility assumption.** The containment mechanism is exact-edge overrides plus a fresh lock, clean `npm ci`, all audits, and the complete Nx lint/typecheck/test/build/e2e battery. If that proof fails, the claim is withdrawn and the exact, expiring dev-only exception path is used; a major downgrade is still not inferred to be safe.
- **Fresh advisory data makes a previously green revision red.** That is intentional fail-closed behavior, but it can block urgent releases. The mechanism is a scheduled gate, explicit database revision in receipts, and a narrowly scoped emergency exception with owner and expiry—not `continue-on-error`.
- **Renovate grouping can hide causality if groups are too broad.** Coupled-family groups and isolated majors bound the blast radius; unrelated production packages never share a catch-all PR.
- **License metadata can be incomplete or expressed as a choice.** SPDX-expression evaluation and exact package exceptions avoid treating dual licensing as a flat string; unknown remains a stop, not an inferred permissive license.
- **Image scanners produce base-image findings the application cannot directly patch.** Digest update PRs are the normal remediation. A no-fixed-version finding still needs an exact expiring risk decision; `ignore-unfixed` is deliberately not global.
- **Action SHA pinning reduces update visibility if no bot owns it.** Renovate's GitHub Actions manager owns SHA updates and retains the recognizable release tag in comments; a guard rejects reintroduction of mutable tags.
- **SBOM/provenance can become theater if subject identity drifts.** One build produces a digest used by scan, SBOM, and attestation, and the validator fails any subject mismatch. The design explicitly withholds claims about host-side rebuilds.
- **GitHub security features and attestations depend on repository visibility/plan.** If CodeQL Rust/Actions upload or private artifact attestation is unavailable, the fallback must be decided before implementation; silently skipping the job would violate the brief.
- **The root and nested Cargo locks invite split authority.** The root workspace lock is the chosen authority; leaving the nested lock without a rejection guard risks reviewers or tools scanning the wrong graph.
- **Tool installers are themselves supply-chain inputs.** Scanner and SBOM binaries need exact versions, checksums, and trusted download origins; using `latest` installers would recreate the problem at a new layer.

## Assumptions I'm making about the other two lanes

- I assume the PM lane accepts Node 24 LTS, npm 11.17.0, and Rust 1.98.0 as the sole supported build tuple; if the product requires a second supported local or deployment toolchain, the single-tuple cost model and parity mechanism must be revised.
- I assume the PM lane treats every required security check and the pin-parity check as branch-protection requirements, not informational dashboards; if any is optional, “normal GitHub gates reject policy drift” is not met.
- I assume the PM lane accepts installing/configuring Renovate and enabling the eligible GitHub security/attestation features as operator prerequisites; if external repository administration is out of scope, update automation and provenance need a different owner/mechanism.
- I assume the PM lane accepts exact, expiring exceptions as the only emergency release valve and does not require an unconditional deploy bypass; if an unconditional bypass is required, production is not fail-closed.
- I assume the PM lane agrees that GitHub attestations cover GitHub-built subjects only and will not describe current Railway/Cloudflare rebuilds as attested; if deployed-byte provenance is required now, immutable-artifact deployment must be added to scope.
- I assume the UX/tech-writer lane will define no trader-facing states or copy because this feature has no user-visible surface; if security status must appear in-product, that creates a new application boundary outside this position.
- I assume the UX/tech-writer lane may document maintainer-facing remediation and exception procedures but will not rename scanner states or weaken exact policy meanings; if those meanings need different operator language, the closed exception/report vocabulary must be reconciled before R4.
- I assume neither other lane will introduce API endpoints, payload fields, runtime telemetry, or application configuration for CI evidence; if they do, the no-runtime-change boundary is false and the architecture must be re-opened.
