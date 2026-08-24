# R1 — ux position: supply-chain-automation

## Position

### Boundary, intended user, and primary job

This feature has an operator/developer surface and **no trader-facing surface**. `NO_UI_CHANGE` is
binding: no dashboard route, navigation item, notification, product label, score, tier, or trading copy
changes. The intended users are repository maintainers, pull-request reviewers, and release operators.
Their primary job is to answer, without reading raw logs:

1. Is this exact revision allowed to advance?
2. If not, did a policy finding occur, or did the check fail to produce a result?
3. What input and policy scope were actually checked?
4. What evidence can be downloaded or reproduced?
5. What is the smallest honest next step?

The information order on every summary is therefore **verdict → revision and scope → findings → next
step → evidence/provenance**. Tool branding and raw log volume are secondary.

The project design canon is `Status: SET`, but it does not create a product-UI obligation here. GitHub's
native pull-request, check-run, annotation, Markdown-summary, and artifact surfaces are the interface.
No design-system amendment is needed. Native headings, tables, lists, links, and status text must carry
meaning without relying on color or icons.

### Existing-surface placement

| Datum or action | Primary surface | Secondary surface | Placement rule |
| --- | --- | --- | --- |
| Supported Node/npm/Rust versions and local bootstrap | Root `README.md`, in one consolidated prerequisites/toolchains block | Supply-chain runbook | Values come from the selected repository pins, not duplicated prose or a runner's incidental version. |
| Dependency update group, package deltas, source manifests, and review state | Automated dependency pull-request body | Pull-request title/labels | A proposal is reviewable change, never described as approved, compatible, or safe before evidence supports that claim. |
| Overall gate verdict for the current revision | GitHub required-check title plus job summary | Pull-request check list | The title is concise; the summary carries revision, scope, evidence, and recovery. |
| Individual advisory/license/source/image/source-code/config finding | Check annotation on the relevant checked-in file and line when the scanner supplies one | Findings table in the job summary plus machine-readable artifact | Do not fabricate a source location. When none is supplied, link the report from the summary rather than annotating an arbitrary file. |
| Full scanner output | Machine-readable workflow artifact in the selected tool's supported format | Short sanitized log excerpt only when useful | Raw output is not the primary explanation and must not expose credentials, credential-bearing URLs, environment values, or secret material. |
| SBOM | Downloadable workflow/release artifact tied to target and revision | SBOM evidence table in the job summary and release runbook | The summary says what was generated and validated; it does not claim completeness, security, or license compliance. |
| Policy meaning, declared scan scope, skip rules, local reproduction, and remediation | A dedicated `docs/SUPPLY_CHAIN.md` operator/developer runbook | Root README link | One canonical glossary prevents workflow YAML, README, and deploy docs from defining competing meanings. |
| Release use of supply-chain evidence | `docs/DEPLOY_RUNBOOK.md`, as a pre-deploy prerequisite/link | Release summary | Keep deployment mechanics in the deploy runbook; do not duplicate the supply-chain policy tables there. |

The current `.github/workflows/ci.yml` is the normal pull-request gate and already has separate frontend
and backend jobs. The current conformance and deploy-smoke workflows are runtime/wire checks, so their
summaries should not become the canonical home for dependency policy. The exact workflow split remains
a technical decision; this position defines the operator-facing behavior wherever those jobs land.

The root README currently repeats Node prerequisites with different framing and still contains stale
Python/FastAPI repository labels, while CI installs an unpinned Rust `stable` toolchain and no repository
Rust toolchain file exists. Any in-scope README edit must consolidate the supported-toolchain story from
the new pins rather than echoing those statements into another section.

### Status vocabulary and evidence rules

Use the following closed outcome vocabulary for an individual check. The machine state is authoritative;
the visible label is a one-to-one rendering and is never inferred from finding count alone.

| Outcome | Meaning that must be vouched by evidence | Exact lead copy | Gate treatment |
| --- | --- | --- | --- |
| `pass` | The check completed for the declared inputs and policy, and reported zero policy violations. | **Passed** — `No policy violations were found in the scanned inputs.` | May satisfy the check for this revision. |
| `fail` | The check completed and reported at least one policy violation. | **Failed** — `{count} policy violation(s) were found. This revision does not meet {policy_name}.` | Rejects the gate. If a trustworthy count is unavailable, omit the number: `Policy violations were found. This revision does not meet {policy_name}.` |
| `blocked` | The check could not produce a trustworthy policy result because its tool, input, configuration, evidence, or required external service failed. | **Blocked** — `{check_name} did not complete, so no policy result is available.` | Rejects the gate when the check is required. Never render as pass or empty. |
| `skipped` | Policy explicitly says the check does not run for this revision and supplies a reason. | **Skipped** — `{check_name} did not run for this revision. Reason: {reason}.` | Does not imply pass. A required check that fails to start is `blocked`, not `skipped`. |

Every terminal row follows with:

`Scope: {declared_inputs}. Revision: {full_sha}. Tool: {tool_name} {tool_version}. Policy: {policy_name_or_version}.`

If any one of those facts is not supplied by the selected mechanism, omit only that unsupported field
and raise the missing provenance as a blocked/contract gap where policy requires it. Never fill a blank
with `latest`, `all`, `complete`, `secure`, `safe`, or `verified`.

`Passed` means only that this scanner reported no violations in its stated scope. It must never become
`No vulnerabilities`, `All dependencies are safe`, `License compliant` without a named scope, or
`Supply chain verified`. Different scanners keep separate rows even when they share a gate.

### Complete operator/developer state matrix

#### Supply-chain gate summary

| State | What the user sees | Available next action | Must not happen |
| --- | --- | --- | --- |
| Default / ready | Heading `Supply-chain checks` followed by the current revision and one row per required check. | Open a row's evidence or the runbook. | Do not show an aggregate green state until every required row has an accepted current-revision result. |
| Waiting | `Supply-chain checks are waiting to start. No result yet.` | Open workflow details. | Waiting must not read as skipped or passed. |
| Running / loading | `Supply-chain checks are running. No result yet.` Individual row: `{check_name} is scanning {scope}.` | Open live logs if authorized. | Partial zero findings must not be summarized as pass. |
| Success | `Required supply-chain checks passed for revision {short_sha}.` followed by the per-check qualified pass rows and evidence links. | Review evidence or continue the normal merge/release flow. | The aggregate must not hide a skipped, blocked, stale, or missing required check. |
| Failure | `Supply-chain policy failed for revision {short_sha}.` followed by findings grouped by check. | Follow the first concrete remediation and rerun. | Do not use celebratory styling or a success sentence on partial pass. |
| Blocked / error | `Supply-chain checks are blocked for revision {short_sha}. No pass result is available.` | Follow the named recovery step and rerun. | Do not replace this with `No findings` or preserve an earlier green aggregate. |
| External service unavailable / offline | `{service_name} could not be reached. {check_name} is blocked; earlier or cached results do not count for revision {short_sha}.` | Retry after service recovery; use an approved offline database only if policy explicitly supports and identifies it. | Do not guess that connectivity is the cause unless the tool reports it; otherwise use the generic blocked copy. |
| Stale | `Stale evidence — this result was generated for {evidence_short_sha}, not current revision {current_short_sha}. Re-run the check.` | Rerun on the current revision. | A stale artifact must not satisfy a current gate even if it passed. |
| Empty configuration | `No required checks were resolved for this revision. Supply-chain evaluation is blocked.` | Inspect policy/workflow configuration. | An empty check set must not produce aggregate success. |

#### Individual scan result

| State | Exact copy and behavior |
| --- | --- |
| Pass | `No policy violations were found in the scanned inputs.` Then show scope, revision, tool version, policy identifier, duration if emitted, and evidence link. |
| Fail | `{count} policy violation(s) were found.` Show a finding table ordered by policy severity/order, not by color: `Subject · Detected condition · Policy rule · Evidence · Next step`. |
| Blocked — tool error | `{check_name} stopped before it produced a policy result. Review the sanitized diagnostic, then rerun.` |
| Blocked — invalid/missing policy | `{check_name} could not load {policy_name}. No policy result is available.` |
| Blocked — missing input | `{check_name} could not read {sanitized_input}. No policy result is available.` |
| Blocked — timeout | `{check_name} timed out before the scan completed. No policy result is available.` |
| Blocked — authentication | `{service_name} rejected the configured credential. Review the GitHub secret configuration; do not paste its value into logs or comments.` |
| Blocked — rate limit | `{service_name} reported that its request limit was reached. {check_name} is blocked; retry after the reported reset time.` Show the reset time only when supplied by the service. |
| Skipped | `{check_name} did not run for this revision. Reason: {reason}.` A policy-authorized skip shows the rule that authorized it. |
| Sanitized diagnostic | `Some diagnostic text was redacted before publication.` Render only when redaction actually occurred. |

#### Dependency proposal

| State | Exact copy and behavior |
| --- | --- |
| Ready for review | `Dependency proposal ready for review.` Show update group, ecosystem, base revision, package deltas, touched manifests/lockfiles, and required evidence. |
| Checks running | `Dependency proposal checks are running. Do not merge until the required checks finish.` |
| Review blocked | `Dependency proposal blocked: required evidence is missing or did not complete.` Link the non-pass rows. |
| No eligible proposal | `No eligible dependency updates were proposed in this run.` Use only after the automation completed and explicitly reported zero eligible proposals. |
| Metadata unavailable | `Dependency metadata could not be refreshed. No update decision is available.` This is blocked, not empty. |
| Superseded | `Superseded by {proposal_link}.` Use only when the automation supplies that relationship. |
| Closed without merge | `Closed without merge.` Do not rewrite this as remediated or rejected unless the recorded close reason supports it. |
| Merged | `Dependency proposal merged at {merge_sha}.` This says what happened; it does not claim the update is vulnerability-free or compatible outside the tested evidence. |

The pull-request body direction is:

```markdown
## Dependency proposal

Status: Ready for review
Update group: {group_name}
Ecosystem: {npm|Cargo}
Base revision: {full_sha}
Why grouped: {rule-owned explanation}

### Proposed changes

| Dependency | Relationship | From | To | Source files |
| --- | --- | --- | --- | --- |
| {package} | {direct|transitive, only when known} | {old_version} | {new_version} | {manifest_or_lockfile} |

### Required evidence

- Dependency policy: {status_and_link}
- Source/config/container scans: {status_and_link}
- Build and tests: {status_and_link}
- SBOM: {status_and_link}

### Reviewer next step

Review the version changes and linked upstream notes, then approve or request changes. This proposal has not been merged.
```

Do not label a proposal `security update` solely because a version changed. When an advisory source
actually drives the proposal, use: `Reason: {scanner_name} matched {advisory_id} to {package}
{installed_version}.` Link the source supplied by the scanner. Do not call the new version `fixed`
unless the advisory/tool result specifically vouches for that affected/fixed range.

Grouping must stay legible. A package delta cannot be hidden behind `miscellaneous updates`; each changed
direct dependency is listed, and transitive changes are summarized from the lockfile evidence without
claiming they were intentionally selected. A proposal title should name the ecosystem and configured
group, for example `deps(npm): update {group_name}`; the actual group names belong to policy/product
decisions, not UX invention.

#### SBOM evidence

| State | Exact copy and behavior |
| --- | --- |
| Available and schema-valid | `SBOM generated and validated for {target} at revision {short_sha}.` Show target, artifact filename, declared format/schema version, generator/version, revision, validation result, digest, and download link. |
| Generating | `Generating SBOM for {target}. No artifact is available yet.` |
| Generation failed | `SBOM generation failed for {target}. No SBOM artifact was produced.` |
| Validation failed | `SBOM validation failed for {target}. The artifact does not match the required format or schema.` |
| Missing required target | `Required SBOM evidence is missing for {target}. Release evidence is blocked.` |
| Revision mismatch / stale | `SBOM evidence is for {evidence_short_sha}, not current revision {current_short_sha}. Regenerate it before release.` |
| Artifact unavailable/expired | `SBOM artifact is unavailable. Re-run the workflow for revision {short_sha}.` Do not say it never existed unless provenance supports that. |

Job-summary direction:

```markdown
## SBOM evidence

Status: {Available|Blocked|Invalid|Stale}
Revision: {full_sha}

| Target | Format / schema | Generator | Validation | Artifact | Digest |
| --- | --- | --- | --- | --- | --- |
| {target} | {format_and_version} | {name_and_version} | {result} | {link} | {algorithm}:{digest} |

This evidence confirms artifact format, revision linkage, and the stated validation result. It does not by itself claim that the target is vulnerability-free or license-compliant.
```

If the generator reports a component count, label it `Components reported by {generator}: {count}`.
Do not relabel it `All dependencies`, because generator and build-target coverage may be narrower.

### Remediation guidance

Every failure or block has one evidence-bound next step. Guidance identifies the checked subject without
publishing secrets and does not silently edit or downgrade application dependencies.

| Condition | Finding copy | Next-step copy |
| --- | --- | --- |
| Advisory match | `{scanner_name} matched {advisory_id} to {package} {installed_version}.` | `Review the advisory and dependency path, change the dependency or policy in a separate reviewed change, then rerun this check.` |
| Prohibited license | `{package} {installed_version} reported license {license_id}, which does not meet policy rule {rule_id}.` | `Review the package's recorded license and the policy rule, then replace the dependency or make the policy change separately and rerun.` |
| License unknown/unreadable | `License data for {package} {installed_version} could not be evaluated.` | `Confirm the package metadata or source evidence, then rerun. No compliant-license claim is available.` |
| Source policy | `The recorded source for {package} {installed_version} does not meet policy rule {rule_id}.` | `Review the sanitized source identifier, use an allowed source or change policy separately, then regenerate the lockfile and rerun.` |
| Container/image finding | `{scanner_name} reported a policy violation for image {immutable_image_identifier}.` | `Open the finding evidence, change the image input or policy separately, rebuild, and scan the new image digest.` |
| Source/config finding | `{scanner_name} reported {rule_id} in {repository_relative_path}.` | `Review the annotation and rule guidance, change the checked source/configuration, then rerun.` |
| Scanner changed dependency files | `The scan changed dependency files, so its result was rejected.` | `Restore the proposal input and rerun the scanner in the approved read-only mode.` |
| External service failure | `{service_name} did not return the data required by {check_name}. No policy result is available.` | `Retry after service recovery or use the policy-approved offline source identified in the runbook.` |
| Missing/invalid SBOM | `Required SBOM evidence for {target} is {missing|invalid|stale}.` | `Regenerate and validate the SBOM for the current revision and target.` |

`Scan mode: read-only; dependency files unchanged.` may appear only when an explicit diff/identity check
vouches for it. Otherwise omit it. Never use a green result created by a tool that rewrote or downgraded
the dependency graph during the scan.

Finding subjects use repository-relative paths, package name/version, advisory/rule identifiers, and
immutable image digests where available. Credential-bearing registry URLs are sanitized before display.
Logs, job summaries, annotations, artifact names, and SBOM metadata must not echo secret values. A
redaction marker is evidence that output was sanitized, not evidence that the repository or image
contains no secrets.

### Summary template

The overall GitHub job summary should use this stable shape:

```markdown
# Supply-chain checks

Verdict: {Passed|Failed|Blocked}
Revision: {full_sha}

{qualified aggregate lead sentence}

## Results

| Check | Outcome | Scope | Findings | Evidence |
| --- | --- | --- | --- | --- |
| {check_name} | {Passed|Failed|Blocked|Skipped} | {declared_scope} | {count_or_em_dash} | {link} |

## Required next step

{one concrete next action, or `None — all required checks produced accepted results for this revision.`}

## SBOM evidence

{target table or exact blocked state}

## Provenance

- Toolchains: Node {version} · npm {version} · Rust {version}
- Policy: {identifier}
- Workflow run: {run_link}
```

Use `—` in the findings column only when a count is not applicable, such as a blocked or skipped check;
zero belongs only to a completed result that vouches for zero. `None` is never a synonym for unknown.

### Documentation direction

1. Consolidate the root README's toolchain prerequisites into one source-linked block: selected Node,
   npm, and Rust pins; deterministic install commands; the single local supply-chain command; and a link
   to the canonical runbook. Do not repeat scanner capability claims in the README.
2. Create `docs/SUPPLY_CHAIN.md` as the canonical operator/developer runbook. It owns: supported targets;
   declared scan coverage and explicit limits; policy file locations; the closed outcome glossary above;
   proposal grouping rules; local reproduction; remediation; external-service degradation; SBOM target,
   format, validation, and retention details; and how to interpret machine-readable artifacts.
3. Add one pre-deploy prerequisite/link in `docs/DEPLOY_RUNBOOK.md`: the current revision's required
   supply-chain checks and SBOM evidence must have accepted results. Keep the existing migration/startup
   copy and release sequence intact.
4. Do not place this material in `apps/dashboard/src/app/README.md`; that file is the authoritative
   frontend source map, and this feature does not change the frontend structure.
5. Treat scanner/tool documentation as capability boundaries. State exactly which manifests, lockfiles,
   source/config paths, container target/digest, advisory database, license fields, and dependency source
   forms were examined. Anything outside that list is not implied covered.

### UX acceptance criteria and AC-to-state mapping

These are the UX-owned observable requirements for synthesis. `Verify by` follows silent-regression
risk: invariants, negative space, fail-closed behavior, and provenance are `test`; visible copy,
placement, and reading order are `review`.

| ID | Acceptance criterion | Component state(s) | Verify by |
| --- | --- | --- | --- |
| UX-1 | No trader route, dashboard navigation item, product notification, trader-facing label, or dashboard component changes for this feature; operator/developer evidence remains in GitHub and documentation surfaces. | All | test |
| UX-2 | Every resolved scan result renders exactly one of `Passed`, `Failed`, `Blocked`, or `Skipped`, with the machine outcome as the sole source; required missing/errored/timed-out checks cannot render pass or skipped. | Success, failure, blocked, skipped | test |
| UX-3 | `Passed` appears only after a completed scan reports zero policy violations and is immediately qualified by declared scope, revision, tool/version, and policy provenance when supplied. | Success | test |
| UX-4 | Aggregate success is withheld when any required result is missing, running, failed, blocked, stale, or unauthorizedly skipped. | Waiting, running, failure, blocked, stale, empty configuration | test |
| UX-5 | A failed result presents each finding with a sanitized subject, detected condition, policy rule, evidence pointer, and concrete next step; absent source locations are not invented. | Failure | test |
| UX-6 | External-service, credential, rate-limit, timeout, invalid-policy, and missing-input failures render as `Blocked` with `No policy result is available`; earlier/cached evidence cannot satisfy the current revision unless policy explicitly identifies and validates an approved offline source. | Offline/degraded, blocked, stale | test |
| UX-7 | `Skipped` is shown only with an explicit policy-authorized reason and never implies pass; a required check that fails to start is `Blocked`. | Skipped, blocked | test |
| UX-8 | A dependency proposal body exposes ecosystem, configured group, base revision, each supported package delta, touched manifest/lockfile, required evidence status, and a review-next-step; it never calls an unmerged update approved, compatible, safe, or fixed without supporting evidence. | Ready, running, blocked, merged | test |
| UX-9 | `No eligible dependency updates were proposed in this run` appears only after a completed automation run reports zero eligible proposals; metadata/service failure uses the distinct blocked copy. | No eligible proposal, metadata unavailable | test |
| UX-10 | Each required SBOM target exposes target, artifact, declared format/schema, generator/version, revision, validation result, digest, and link; missing, invalid, stale, or unavailable required evidence blocks release and uses the exact distinct state copy. | Generating, available, failed, invalid, missing, stale, unavailable | test |
| UX-11 | A schema-valid SBOM is not labeled complete, vulnerability-free, license-compliant, or supply-chain verified; any generator count is labeled `Components reported by {generator}`. | Available | test |
| UX-12 | Scanner output, summaries, annotations, proposal bodies, artifact metadata, and remediation copy do not expose credential values, credential-bearing URLs, environment secret values, or secret material; any actual redaction is disclosed with the exact redaction sentence. | All terminal and degraded states | test |
| UX-13 | Scan execution cannot silently modify or downgrade manifests/lockfiles to obtain a green result; any detected dependency-file change rejects the result with the specified copy. | Success candidate, failure | test |
| UX-14 | The job summary follows verdict → revision/scope → results → required next step → SBOM → provenance, uses text labels in addition to any native color/icon, and links detailed evidence instead of requiring raw-log reading. | Default, success, failure, blocked | review |
| UX-15 | The root README owns concise pinned setup and links to one canonical supply-chain runbook; the runbook owns scope/limits, outcome meanings, reproduction, remediation, degradation, and SBOM interpretation; deploy docs link the prerequisite without duplicating policy. | Documentation default | review |
| UX-16 | Queued, running, pass, fail, blocked, skipped, stale, no-proposal, SBOM-generating, SBOM-invalid, and external-service-degraded copies match the evidence meanings above and remain readable in native GitHub Markdown without color dependence. | All named states | review |

## Risks I see

- `Passed` can be misread as a global security guarantee if scope, tool version, policy identity, or
  revision is omitted.
- A scanner outage or missing advisory database can collapse to an empty findings list and create a false
  pass unless `blocked` is a first-class machine and copy state.
- GitHub conditional execution can make a required job look intentionally skipped. The policy must
  distinguish authorized skip from failure-to-run, and the aggregate gate must enforce that distinction.
- Grouped dependency proposals can become unreviewable if the body hides individual direct-package deltas
  or uses a generic `miscellaneous` rationale.
- Semver labels, advisory matches, and changelog links can tempt copy to claim compatibility or remediation
  that neither tests nor the scanner establishes.
- An SBOM can be schema-valid yet describe the wrong revision or target, omit build-time/runtime material
  outside generator coverage, or expire from artifact storage. `valid` must not be relabeled `complete`.
- A report or source URL can leak registry credentials even when application images remain secret-free.
  Publication paths need sanitization independent of the image scan.
- Tool or scanner auto-fix behavior can mutate a lockfile and make its own scan green. A read-only/diff
  invariant is needed before the copy may say dependencies were unchanged.
- README toolchain prose already conflicts with repository state and contains stale architecture labels.
  Adding a second setup table would deepen drift instead of explaining the pinned workflow.
- Raw GitHub logs are transient, noisy, and sometimes permission-limited. If the summary contains only
  `See logs`, reviewers cannot distinguish policy failure from infrastructure failure.
- Counts are easy to overstate: a scanner's reported component or finding count is not necessarily the
  repository's total dependency or risk count.

## Assumptions I'm making about the other two lanes

- The architect lane will select and pin exact supported Node, npm, and Rust versions in repository-owned
  machine-readable files, so visible toolchain values do not come from README prose or runner defaults.
- The architect lane will select scanners whose actual supported modes can emit a deterministic terminal
  outcome, declared scan scope, tool version, sanitized machine-readable evidence, and nonzero exit on
  required policy failure or blocked evaluation.
- The architect lane will define how the current revision and immutable container target/digest are bound
  to each result and SBOM artifact.
- The architect lane will provide a structural check that required scans do not rewrite manifests or
  lockfiles, and that a poisoned prohibited condition makes the gate red.
- The architect lane will make external advisory/service/authentication/rate-limit/timeout failures
  distinguishable from a completed zero-finding result.
- The PM lane will define which npm, Cargo, source/config, container, advisory, license, source, and SBOM
  checks are required for each change class, including any policy-authorized skip conditions.
- The PM lane will define the acceptable dependency-update groups and their product rationale; UX will
  render those names and reasons without inventing `safe`, `compatible`, or `security` classifications.
- The PM lane will define the required SBOM targets and release-blocking retention/evidence expectations;
  UX will not infer that one artifact covers every runtime or build target.
- The PM lane will preserve `NO_UI_CHANGE`, `operator-vs-trader-path-separation`,
  `no-secrets-in-image`, `production-fails-closed`, and `structural-over-prose-enforcement` as acceptance
  boundaries for this feature.
