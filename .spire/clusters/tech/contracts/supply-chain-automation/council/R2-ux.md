```json
{
  "role": "ux",
  "agree": [
    "This is an internal delivery feature. It must not add or change trader-facing behavior, application runtime behavior, public application contracts, scoring, tiers, gates, or fingerprints.",
    "The product promise is deliberately fail-closed.",
    "A partial report is visibly incomplete and can never support a passing outcome.",
    "The mechanism guarantees deterministic selection from checked-in inputs; it does not pretend that two Docker builds are bit-identical when an upstream OS repository or hosted runner changes.",
    "Therefore this feature must not claim that a GitHub attestation proves the bytes presently deployed by those hosts.",
    "No scanner mutates a manifest or lock."
  ],
  "conflicts": [
    {
      "quote": "A closed three-outcome vocabulary: **pass**, **pass with advisories**, and **blocked**.",
      "source": "pm",
      "why": "[UX-C01] Owner ruling: required. This vocabulary overloads `blocked` with two meanings that require different recovery: a completed policy evaluation that found a prohibited condition, and an evaluation that produced no trustworthy result. It also omits an authorized per-surface `skipped` state, while GitHub has no native `pass with advisories` check conclusion. This would make the machine state, visible copy, and branch-protection result disagree. This also self-revises UX R1: its `pass|fail|blocked|skipped` set likewise omitted the PM's stronger need to keep allowed advisories visible if the owner permits them to proceed.",
      "proposal": "Use report outcomes `pass|pass_with_advisories|fail|blocked`, plus `skipped` only as a declared surface completion state. Map `pass` and owner-approved `pass_with_advisories` to GitHub success, with the latter visibly labeled in the summary and warning annotations; map `fail` and `blocked` to GitHub failure. A required or unauthorized skip makes the aggregate `blocked`. The owner must rule whether any advisory class may proceed at all and, if yes, name those classes.",
      "kind": "product"
    },
    {
      "quote": "Development dependencies fail on high or critical advisories; moderate/low findings remain visible and enter scheduled remediation rather than silently disappearing.",
      "source": "architect",
      "why": "[UX-C02] Owner ruling: required. Severity plus the `development` label does not support the implied policy meaning. The PM correctly notes that development tooling can produce shipped bytes or handle CI credentials, while a high advisory can also be isolated from those paths. Copy cannot call a condition blocking or advisory until the policy records the relevant effect/reachability evidence; otherwise the same package label is being renamed into a risk decision.",
      "proposal": "Make severity an input, not the sole classification. Shipped/runtime and release-integrity impact block under the owner-approved policy; a development-only advisory may become `pass_with_advisories` only when the report carries the evidence, owner, rationale, and review/expiry date the PM requires. Unknown impact is `blocked`, not advisory.",
      "kind": "product"
    },
    {
      "quote": "On trusted default-branch/release events, GitHub artifact attestation signs build provenance and the SBOM association for the exact API image digest and dashboard build archive.",
      "source": "architect",
      "why": "[UX-C03] Owner ruling: required. The PM explicitly future-dates cryptographic signing/build provenance, and the BRIEF requires machine-verifiable SBOMs but does not require attestation. Adding GitHub attestation also introduces hosted-feature eligibility and trusted-event permissions that the architect acknowledges are not yet verified. This is scope expansion, not merely stronger wording.",
      "proposal": "Keep in scope the target/revision binding, schema validation, artifact digest, generator version, and machine-readable receipt. Defer attestation/signing unless the owner expands scope after repository eligibility and cost are verified. If expanded, label the subject narrowly as a GitHub-built artifact, never the currently deployed Railway/Cloudflare bytes.",
      "kind": "product"
    },
    {
      "quote": "As a release owner, I want a machine-verifiable report and software bill of materials tied to the exact revision and shipped artifact so that I can prove what was evaluated and what was built.",
      "source": "pm",
      "why": "[UX-C04] Owner ruling: required. `Shipped artifact` is not supported by the current deployment path: the architect establishes that Railway and Cloudflare rebuild outside the GitHub artifact boundary. Using `shipped` would tell the release owner that evidence covers deployed bytes when it covers only a GitHub-built deployable subject.",
      "proposal": "For this feature, say `GitHub-built deployable artifact` and expose its immutable digest. If the owner requires evidence for deployed bytes now, expand scope so Railway/Cloudflare consume or prove identity with that exact subject; only then may summaries say `shipped artifact`.",
      "kind": "product"
    },
    {
      "quote": "These are patch replacements inside the affected dependency families, not application dependency rewrites.",
      "source": "architect",
      "why": "[UX-C05] Owner ruling: not required. An npm `overrides` change plus regenerated lockfile does rewrite dependency resolution. Calling it `not ... rewrites` withdraws the very fact reviewers need, even if the change is intentional, bounded, and preferable to a major Nx downgrade. The BRIEF prohibits silent rewrites by scanning tools; it does not require pretending a reviewed proposal made no graph change.",
      "proposal": "Call these `explicit reviewed transitive overrides that change the resolved lock graph without changing the direct Nx/Vite versions`. Show the before/after transitive versions, the advisory identifier, the override entry, and locked-test evidence. Keep scanner execution read-only after the proposal creates that reviewed input.",
      "kind": "technical"
    },
    {
      "quote": "Reports are artifacts, not runtime data, and contain paths/identifiers but no environment values or secret material.",
      "source": "architect",
      "why": "[UX-C06] Owner ruling: not required. This is an outcome claim with no named sanitization boundary. Secret scanners can include matched snippets, and tool diagnostics can echo arguments, URLs, or environment-derived text. Gitleaks/Trivy/CodeQL/cargo-deny output is not secret-safe merely because it is an artifact. The claim cannot be emitted until the retained bytes, annotations, and logs are proven sanitized.",
      "proposal": "Define a publication adapter that consumes raw tool output in ephemeral job storage, removes secret/snippet fields and credential-bearing URL material, emits a closed sanitized report, and uploads only that report. Add a synthetic canary secret and credentialized-URL fixture proving the retained report, job summary, annotations, artifact metadata, and captured log excerpt contain neither value. Use `Some diagnostic text was redacted before publication.` only when the adapter records an actual redaction.",
      "kind": "technical"
    },
    {
      "quote": "An SBOM missing either npm or Cargo components, or referring to a digest different from the scanned artifact, fails publication.",
      "source": "architect",
      "why": "[UX-C07] Owner ruling: not required. This applies a root-source expectation to every per-artifact SBOM. A dashboard image is not required to contain Cargo components, and an API runtime image is not required to contain npm components. The rule would either falsely block valid target-specific SBOMs or encourage one combined inventory whose scope no longer matches the artifact named in the copy.",
      "proposal": "Define expected component families per target. The root source/dependency SBOM may require both root npm and root Cargo lock coverage; each image/archive SBOM must match its own immutable subject and target-specific component expectations. The summary names target and coverage separately and never calls one SBOM repository-complete.",
      "kind": "technical"
    },
    {
      "quote": "Two clean, supported environments evaluating the same revision must select the same exact toolchains, resolve the same dependency identities and versions, reach the same policy classification, and produce the same SBOM component identity set.",
      "source": "pm",
      "why": "[UX-C08] Owner ruling: not required. `Same revision` is insufficient to vouch for the same policy classification because the architect intentionally allows fresh advisory data to make an unchanged revision red. The sentence also lacks the same scanner/policy/advisory-database inputs needed for a reproducibility claim. Without those qualifiers, a legitimate new advisory looks like nondeterminism.",
      "proposal": "Require the same classification and SBOM identity set only for the same revision, declared targets, pinned tools, policy revision, lockfiles/base-image digests, and advisory-data revision. Separately require fresh scheduled runs to record their advisory-data revision and allow a newer database to change classification without changing dependency identity.",
      "kind": "technical"
    },
    {
      "quote": "A generated proposal is never merged without an explicit human approval and never triggers an automatic production deployment.",
      "source": "pm",
      "why": "[UX-C09] Owner ruling: required. The first clause fits the brief; the second contradicts the current documented release process, where an approved merge to `main` can trigger Railway and Cloudflare continuous deployment. Preventing deployment for dependency PRs would replace or condition the existing release process, which the PM separately places out of scope.",
      "proposal": "Require human approval and prohibit bot auto-merge. After a human merges, preserve the existing main-branch deployment behavior unless the owner explicitly expands this feature to add a distinct release hold. Copy should say `This proposal has not been merged`; it should not promise what happens after an approved merge unless that release behavior is changed.",
      "kind": "product"
    },
    {
      "quote": "A blocked GitHub check summary identifies each blocker, its owner, its next action, and the retained evidence without requiring a reviewer to search raw logs.",
      "source": "pm",
      "why": "[UX-C10] Owner ruling: required. Rendering every image, dependency, or source finding inline can turn the summary into another raw report, burying the first actionable cause and exceeding practical GitHub summary/annotation limits. Complete evidence and an understandable summary are separate jobs.",
      "proposal": "Keep every blocker, owner reference, action code, and evidence pointer in the sanitized machine-readable report. In the GitHub summary, group by check/policy rule/owner, show total counts and a bounded actionable sample, then link the complete report. Always show every distinct blocked surface and every distinct recovery action even when individual findings are collapsed. The owner should rule the desired inline cap or grouping policy.",
      "kind": "product"
    },
    {
      "quote": "GitHub dependency review runs on pull requests to reject a newly introduced vulnerable dependency, disallowed license, or prohibited source before it reaches the full graph.",
      "source": "architect",
      "why": "[UX-C11] Owner ruling: not required for the capability check. The repository currently contains no dependency-review gate, and the position supplies no repository visibility/plan receipt proving the hosted feature can run with the named coverage. The BRIEF requires selected-tool capabilities and limits to be verified before implementation is locked; the architect's own risk acknowledges this dependency.",
      "proposal": "Make hosted dependency review and CodeQL/attestation use conditional on a pre-implementation capability receipt for this repository. If unavailable, select a pinned local mechanism for the required advisory/license/source behavior and document the narrower coverage. An owner ruling is needed only if satisfying the feature would require a paid-plan or visibility change.",
      "kind": "technical"
    },
    {
      "quote": "A dependency proposal body exposes ecosystem, configured group, base revision, each supported package delta, touched manifest/lockfile, required evidence status, and a review-next-step; it never calls an unmerged update approved, compatible, safe, or fixed without supporting evidence.",
      "source": "ux",
      "why": "[UX-C12] Owner ruling: not required. This self-revises UX R1. Renovate can own stable proposal facts, but the selected design does not establish that it can continuously rewrite custom PR-body fields with live GitHub check status and evidence links. Duplicating dynamic status in the bot body creates drift from native checks and the generated job summary.",
      "proposal": "Keep ecosystem, configured group, base revision, package deltas, touched manifests/locks, grouping reason, and review-next-step in the Renovate body. Let GitHub's native check list and the supply-chain job summary own live outcome and evidence status. The body may link to the workflow category or runbook, but it must not mirror transient results unless a tested updater mechanism is selected.",
      "kind": "technical"
    }
  ],
  "asks": [
    "PM: Will the owner permit any `pass_with_advisories` result to merge/release, and if so, which exact evidence-backed advisory classes may proceed?",
    "Architect: What checked-in adapter normalizes npm, cargo-deny, Trivy, Gitleaks, CodeQL/dependency-review, SBOM validation, and tool/service failures into the closed report vocabulary and GitHub conclusion mapping?",
    "Architect: What repository visibility/plan capability receipt proves that the proposed GitHub dependency-review, CodeQL Rust/Actions, artifact-attestation, and provenance features are available with the claimed scopes?",
    "Architect: What exact sanitizer fields and poison fixtures prove retained reports, annotations, summaries, logs, artifact metadata, and SBOM metadata cannot publish secret values or credential-bearing URLs?",
    "PM: Does `shipped artifact` mean the GitHub-built deployable subject in this tranche, or must Railway and Cloudflare consume/prove identity with that exact subject now?",
    "PM: What bounded summary grouping or inline finding cap preserves complete evidence without turning the GitHub job summary into the full scanner report?"
  ]
}
```
