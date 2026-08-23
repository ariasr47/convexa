# R1 — pm position: supply-chain-automation

## Position

### Product outcome

This feature turns dependency and build-supply-chain health into a normal, reviewable release condition. A maintainer should be able to reproduce the supported build from a clean environment; a reviewer should receive bounded dependency proposals whose intent is obvious; and a release owner should be able to tell whether a run passed, passed with advisories, or was blocked without reconstructing the answer from raw logs.

The product promise is deliberately fail-closed. A missing scanner, unreadable policy, skipped required surface, expired exception, or missing required artifact is not a clean result. It blocks the affected gate until the check can produce a trustworthy answer. The automation may propose or diagnose dependency changes, but it must never merge them automatically, silently downgrade them, or rewrite the dependency graph merely to make a scan green.

This is an internal delivery feature. It must not add or change trader-facing behavior, application runtime behavior, public application contracts, scoring, tiers, gates, or fingerprints.

### Grounded starting point

The current repository does not yet express one exact supported toolchain across all build contexts: `.nvmrc` selects an exact Node release, the root package manifest permits broader Node/npm ranges, GitHub CI selects the moving Rust stable channel, and the production API container selects a floating Rust major line. The primary CI already performs locked npm installation, tests, and production builds. These statements are grounded in the current `.nvmrc`, `package.json`, `.github/workflows/ci.yml`, `apps/api/Dockerfile`, and `apps/dashboard/Dockerfile`, read on 2026-08-22.

The exact Node/npm and Rust versions are not a PM choice. The product constraint is that the selected Node line is supported LTS, the selected Rust release is supported by the application, and every contributor, CI, and production-build selector resolves to the same exact approved versions.

### Users and business stories

- **US-1 — Maintainer:** As a maintainer, I want one supported, exact toolchain selection so that a clean build does not depend on when or where I run it.
- **US-2 — Dependency reviewer:** As a reviewer, I want dependency changes proposed in intentionally named, bounded groups so that I can understand and approve one risk domain at a time.
- **US-3 — Security owner:** As a security owner, I want advisory, license, dependency-source, source/configuration, and container findings classified by policy so that prohibited conditions stop delivery and lower-risk conditions remain visible.
- **US-4 — Remediation owner:** As the owner of an affected dependency or build surface, I want every finding to identify who acts next and what acceptable resolution paths exist so that failures do not become ownerless red checks.
- **US-5 — Release owner:** As a release owner, I want a machine-verifiable report and software bill of materials tied to the exact revision and shipped artifact so that I can prove what was evaluated and what was built.
- **US-6 — Product owner:** As the product owner, I want supply-chain work isolated from application behavior so that production correctness improves without changing the trader experience or scoring semantics.

### Scope

#### In

- One exact approved Node/npm toolchain and one exact approved Rust toolchain, selected consistently for contributor setup, GitHub checks, and production builds.
- Reproducible locked dependency installation for both npm and Rust, with drift or implicit lockfile rewrites rejected.
- Scheduled and on-demand dependency proposals, divided into named groups with a stated purpose and owner.
- Separate treatment for production/runtime dependencies, development/build dependencies, major upgrades, and security-driven remediation; a proposal must not cross those boundaries merely to reduce proposal count.
- Advisory policy for npm and Rust dependencies; license policy; approved dependency-source policy; supported source/configuration scanning; and supported container/image scanning.
- A closed three-outcome vocabulary: **pass**, **pass with advisories**, and **blocked**.
- Explicit, scoped, human-approved, time-bounded exceptions with an owner and expiry. An exception is evidence of a temporary decision, not disappearance of a finding.
- A machine-readable policy report for every completed run and a machine-verifiable SBOM for every deployable artifact that reaches a policy-passing build.
- Human-readable GitHub summaries that link findings, remediation ownership, exceptions, reports, and SBOMs to the revision under review.
- Structural proof that application runtime behavior, public contracts, score, tier, gate, and fingerprint remain unchanged.

#### Out

- Any trader-facing page, setting, message, route, workflow, or product capability.
- Any application API, scoring, tiering, gate, fingerprint, market-data, authentication, broker, or persistence behavior change.
- Automatic merging, automatic deployment, or approval on behalf of a human reviewer.
- Broad dependency modernization unrelated to a bounded proposal; framework migrations; or source rewrites undertaken only to satisfy a scanner.
- Silent dependency downgrades, removal of a required package, or lockfile regeneration solely to suppress a finding.
- A claim that the selected scanners cover surfaces or threat classes they do not support.
- Runtime threat monitoring, incident response, secret rotation, or replacement of the existing release process.
- Reopening any standing product invariant. In particular, build artifacts and reports must preserve `[no-secrets-in-image]`, production checks must preserve `[production-fails-closed]`, and the feature must satisfy `[structural-over-prose-enforcement]` and `[cited-code-is-verified-not-assumed]`.

#### Future-dated

- Cryptographic signing and external transparency publication of SBOMs or build provenance.
- Reachability or exploitability analysis that can safely narrow advisory impact beyond the initial policy.
- Automatic merge for narrowly proven low-risk groups after a measured history of clean proposals and an explicit owner decision.
- Private dependency registries, organization-wide dependency policy, and cross-repository portfolio reporting.
- Runtime image monitoring and post-deploy revocation when a new advisory appears after release.
- Broader scanners or additional artifact formats beyond the selected tools' verified coverage.

### Product behavior and policy

#### Dependency proposals

Each automated proposal belongs to exactly one named group and one ecosystem. Routine production dependencies, development/build tooling, security remediation, and major upgrades are reviewed separately. A major upgrade is always isolated from routine updates. A proposal states why the group exists, every included dependency and version movement, the affected artifact or build surface, the checks run, the policy outcome, and the responsible reviewer. No eligible updates means a successful “no eligible updates” run, not an empty proposal.

Proposals never auto-merge. A proposal that is blocked remains visibly blocked; automation does not respond by downgrading another package, loosening policy, deleting a dependency, or editing application behavior. If the intended update cannot pass, the owner chooses among upgrading differently, replacing or removing the dependency through a separately reviewed change, requesting a scoped exception, or deferring with a documented advisory decision where policy permits.

#### Blocking versus advisory findings

A **blocked** outcome means delivery must stop. Blocking conditions include: an unexcepted prohibited advisory affecting a shipped dependency; a development/build advisory that can affect shipped output, CI credentials, or release integrity; a denied license; an unapproved dependency source; a prohibited source/configuration or image condition; an expired or mismatched exception; an unreadable or missing policy; a required scanner that did not complete; an unscanned required surface; a malformed or missing required report; or a missing, malformed, or mismatched SBOM.

A **pass with advisories** outcome may proceed, but is not presented as clean. It is reserved for an allowed condition that still needs human attention, such as an allowed license with notice obligations or a development-only advisory shown not to affect shipped output or release integrity. Every advisory has an owner, rationale, and decision or review date. If those are missing or overdue, the finding becomes blocking.

A **pass** has no blockers and no advisories. Zero reported findings counts as a pass only when all declared required surfaces completed successfully under the approved policy. “No findings” from a skipped or failed scan is forbidden.

An exception is valid only for the exact finding, component and version range, affected surface, rationale, approver, owner, and expiry it names. It remains visible in every report while active. Scope drift or expiry makes the original finding blocking again.

#### Remediation ownership

Every dependency group and required scan surface has a named owning role. Every blocker and advisory identifies that owner and one or more permitted next actions. Security policy ownership decides classification and exceptions; dependency or surface ownership performs remediation; the release owner decides whether a **pass with advisories** result may proceed under the standing policy. No role may convert a blocker to an advisory merely to unblock its own proposal.

#### Reproducibility and evidence

Two clean, supported environments evaluating the same revision must select the same exact toolchains, resolve the same dependency identities and versions, reach the same policy classification, and produce the same SBOM component identity set. Run timestamps and transport metadata may differ; dependency, policy, and artifact identity may not.

The policy report is retained for successful and failed runs whenever reporting can execute. It identifies the revision, selected toolchains, policy revision, declared surfaces, completion state of each surface, findings, active exceptions, ownership, and final outcome. A partial report is visibly incomplete and can never support a passing outcome.

Every deployable artifact that passes policy has its own SBOM tied to the source revision and the artifact actually produced. The SBOM identifies included component names, versions, and origins sufficiently for an independent machine check. A report or SBOM must not expose secrets, credentials, tokens, or secret values from the build environment.

### Risk posture

- **False confidence is worse than a delayed build.** Scanner or reporting failure blocks rather than yielding an empty result.
- **Existing transitive development advisories need an explicit disposition.** They may be remediated or, only when policy permits, carried as visible time-bounded advisories with an owner; blind downgrade is not acceptable.
- **Proposal volume can overwhelm review.** Named bounded groups, major-version isolation, and no empty proposals are required to keep automation useful.
- **Exceptions can become permanent debt.** Exact scope, visible recurrence, ownership, and expiry are mandatory; overdue exceptions fail closed.
- **SBOM presence can be mistaken for provenance.** The artifact/revision link and independent machine check are required; a detached inventory file is insufficient.
- **Tool coverage can be overstated.** Reports must distinguish completed, unsupported, skipped, failed, and clean surfaces; the feature claims only verified coverage.
- **Supply-chain changes can accidentally alter the product.** Existing behavior and score/fingerprint pins are release conditions, not a review note.
- **Reports themselves can leak secrets.** Logs and artifacts are treated as distributable evidence and must be safe to retain.

### Rollout

1. **Baseline and ownership:** select exact supported toolchains, declare required scan surfaces and closed policy classes, inventory current findings, and assign every dependency group and finding an owner. Baseline results may be observed while rules are being classified, but no baseline observation is represented as a production pass.
2. **Proposal and evidence burn-in:** enable bounded proposals and reports without auto-merge. Repair grouping noise, incomplete ownership, unstable outputs, and false positives. Existing findings must be remediated or receive a valid time-bounded disposition before enforcement.
3. **Required gates:** make the approved policy, reproducibility checks, reports, and SBOM checks required on pull requests and the protected main branch. From this point, unavailable or incomplete verification blocks; there is no fail-open fallback.
4. **Steady state:** review advisory debt and exceptions on their named dates, keep proposal groups intentionally small, and change tool or policy versions only through reviewed revisions with before/after evidence.

If proposal automation becomes noisy, its schedule may be paused while repaired; required policy checks on code and release changes may not be bypassed. Recovery from a faulty scanner or policy release is a reviewed rollback or forward fix followed by a complete rerun, never an unrecorded override.

### Acceptance criteria

`test` marks silent-regression risks that require automated evidence. `review` marks visible, intentional wording or grouping judgments. One high-level check may verify several criteria; there is no one-test-per-criterion requirement.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 | US-1 | Given the same revision in two clean supported environments, both runs report the same exact Node, npm, and Rust versions. | test |
| AC-2 | US-1 | Given a missing or unsupported toolchain, the build is rejected before dependency installation or application compilation and the result states the expected and detected versions. | test |
| AC-3 | US-1 | Given the same committed lockfiles in two clean supported environments, both installations resolve the same npm package identities and versions and the same Rust crate identities and versions. | test |
| AC-4 | US-1 | A clean install, policy scan, and production build leave both committed lockfiles unchanged; any implicit lockfile rewrite blocks the run. | test |
| AC-5 | US-2 | When eligible routine updates exist, every generated proposal contains dependencies from exactly one named group and one ecosystem. | test |
| AC-6 | US-2 | A major-version update is proposed separately from routine production and development/build updates. | test |
| AC-7 | US-2 | A dependency proposal visibly states the group purpose, included version movements, affected artifact or build surface, policy outcome, checks run, and responsible reviewer. | review |
| AC-8 | US-2 | When no eligible updates exist, the scheduled run records “no eligible updates” and creates no empty proposal. | test |
| AC-9 | US-2 | A generated proposal is never merged without an explicit human approval and never triggers an automatic production deployment. | test |
| AC-10 | US-2 | When a proposal fails a required check, it remains visibly blocked and automation does not alter unrelated dependencies or application behavior in response. | test |
| AC-11 | US-3 | An unexcepted prohibited advisory affecting a shipped dependency produces a blocked outcome. | test |
| AC-12 | US-3 | A development/build advisory that can affect shipped output, CI credentials, or release integrity produces a blocked outcome. | test |
| AC-13 | US-3 | An allowed development-only advisory that does not affect shipped output or release integrity produces “pass with advisories,” not “pass,” and remains visible. | test |
| AC-14 | US-3 | A denied license or unapproved dependency source produces a blocked outcome. | test |
| AC-15 | US-3 | An allowed license with a notice or attribution obligation produces “pass with advisories” and identifies the outstanding obligation. | test |
| AC-16 | US-3 | A prohibited finding on a declared source, configuration, or container surface produces a blocked outcome. | test |
| AC-17 | US-3 | A run with zero findings produces “pass” only when every required surface completed successfully under the approved policy. | test |
| AC-18 | US-3 | If a required scanner is unavailable, times out, errors, or returns an unreadable result, the run is blocked and is not reported as zero findings. | test |
| AC-19 | US-3 | If a declared required surface is unsupported, skipped, or only partially scanned, the run is blocked and identifies that surface as unverified. | test |
| AC-20 | US-3 | An unreadable, missing, or internally invalid policy produces a blocked outcome before any clean claim is emitted. | test |
| AC-21 | US-3 | A valid exception remains visible and suppresses only the exact finding, component/version scope, and surface approved for its stated lifetime. | test |
| AC-22 | US-3 | An expired, overdue, or scope-mismatched exception causes the underlying finding to become blocking again. | test |
| AC-23 | US-4 | Every blocker and advisory names a remediation owner and at least one permitted next action; a finding missing either is blocking. | test |
| AC-24 | US-4 | Every advisory states its rationale and next review or decision date; when that date passes without a new decision, the finding becomes blocking. | test |
| AC-25 | US-4 | A dependency scanner never changes dependency versions, removes a dependency, or rewrites a lockfile to obtain a passing result. | test |
| AC-26 | US-5 | Every completed policy run retains a machine-readable report tied to the evaluated revision, selected toolchains, and approved policy revision. | test |
| AC-27 | US-5 | The retained report states a completion result for every declared surface and distinguishes clean, findings-present, unsupported, skipped, and failed outcomes. | test |
| AC-28 | US-5 | Each reported finding carries its blocking/advisory classification, affected surface, remediation owner, and active exception or unexcepted status. | test |
| AC-29 | US-5 | When scanning or reporting fails after partial progress, any retained report is marked incomplete and cannot support a passing outcome. | test |
| AC-30 | US-5 | Each deployable artifact that reaches a policy-passing build has a machine-verifiable SBOM tied to that revision and to the artifact actually produced. | test |
| AC-31 | US-5 | An independent check of an SBOM can identify the included component names, versions, and origins and can detect an SBOM belonging to a different artifact or revision. | test |
| AC-32 | US-5 | A missing, malformed, or artifact-mismatched required report or SBOM produces a blocked outcome. | test |
| AC-33 | US-5 | Two policy-passing builds of the same revision produce the same SBOM component identity set and the same final policy classification, excluding run timestamps and transport metadata. | test |
| AC-34 | US-5 | Reports, SBOMs, retained logs, and GitHub summaries contain no build credentials, tokens, secret values, or injected runtime secrets. | test |
| AC-35 | US-5 | A blocked GitHub check summary identifies each blocker, its owner, its next action, and the retained evidence without requiring a reviewer to search raw logs. | review |
| AC-36 | US-6 | On fixed application fixtures, the pre-feature and post-feature builds return byte-identical opportunity score, opportunity tier, entry-gate decision, and state fingerprint outputs. | test |
| AC-37 | US-6 | Existing public application conformance produces the same observable outcomes before and after the feature. | test |
| AC-38 | US-6 | The shipped application presents no new or changed trader-facing page, control, message, route, or workflow as a result of this feature. | review |
| AC-39 | US-6 | The feature introduces no new or changed public application contract behavior. | test |
| AC-40 | US-6 | Existing application test and production-build gates pass under the pinned supported toolchains without weakening their assertions or skipping their existing coverage. | test |

## Risks I see

- The phrase “all advisories block” would be simple but is not defensible against transitive development tooling with no safe compatible fix. The defensible promise is stricter: shipped and release-integrity risk blocks; genuinely isolated development-only risk may proceed only as a visible owned advisory with a deadline.
- Conversely, an overly broad “dev-only” carve-out could hide tooling that handles CI credentials or produces shipped bytes. Classification must be based on effect, not dependency label alone.
- A policy exception process can become a shadow allowlist. Without expiry, exact version/surface scope, an approver, and recurrence in every report, exceptions will silently become permanent.
- Reproducibility can be claimed too loosely if runs compare only successful exit codes. Toolchain identity, resolved dependency identity, policy classification, and SBOM component identity all need independent comparisons.
- A generated SBOM can be technically valid but attached to the wrong artifact. Revision and artifact linkage is a release promise, not optional metadata.
- Proposal grouping can optimize for fewer pull requests at the expense of reviewability. Major upgrades, production dependencies, and build tooling should remain separate even when one proposal would be cheaper to generate.
- Scanner coverage may be constrained by selected tools. The product must withdraw any “clean” claim for unsupported or incomplete required surfaces rather than implying comprehensive coverage.
- Fail-closed checks will occasionally delay delivery because of tool outages or malformed feeds. That is an accepted tradeoff for protected branches and releases; the remediation path is repair and rerun, not bypass.
- Dependency or toolchain updates may subtly change generated application bytes while tests stay green. Score/fingerprint identity and public conformance are explicit release evidence because “no product behavior” is load-bearing here.
- Reports can leak secret values through command arguments, environment dumps, or scanner diagnostics. Artifact retention expands the audience of a leak, so secret absence must be verified rather than assumed.

## Assumptions I'm making about the other two lanes

- The architecture lane can name a single authoritative selection path that makes contributor, GitHub, and production-build environments resolve the same exact Node/npm and Rust versions.
- The architecture lane can enforce locked npm and Rust resolution without permitting scanners or proposal automation to mutate lockfiles during verification.
- The architecture lane can select scanners whose verified capabilities cover the declared npm, Rust, license, dependency-source, source/configuration, and container surfaces, or will explicitly mark a required surface unsupported rather than claim coverage.
- The architecture lane can produce machine-verifiable reports and per-artifact SBOMs whose revision and artifact linkage can be independently checked.
- The architecture lane can keep scan/report failures fail-closed while still retaining safe partial evidence for diagnosis.
- The architecture lane can structurally prove that the supply-chain feature does not reach application runtime, public contracts, scoring, tiers, gates, or fingerprints.
- The architecture lane can prevent secret-bearing build inputs from appearing in retained reports, SBOMs, logs, and summaries.
- The UX/tech-writer lane will keep all interaction inside GitHub proposals, checks, and retained evidence; it will introduce no trader-facing application surface.
- The UX/tech-writer lane will define distinct, unambiguous language for **pass**, **pass with advisories**, **blocked**, **incomplete**, and **no eligible updates** without using “clean” for a failed or partial scan.
- The UX/tech-writer lane will make blocker ownership and next action visible in the check summary while keeping detailed evidence available without forcing raw-log archaeology.
- The selected supported Node LTS and Rust releases can run the existing application tests and production builds without requiring a product behavior change.
- Current transitive development-tool findings can either be remediated safely or receive an explicit, time-bounded advisory disposition without a blind downgrade.
- GitHub artifact retention is available on both successful and failed runs whenever the reporting step itself can execute.
