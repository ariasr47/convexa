```json
{
  "role": "pm",
  "agree": [
    "The mechanism guarantees deterministic selection from checked-in inputs; it does not pretend that two Docker builds are bit-identical when an upstream OS repository or hosted runner changes.",
    "Renovate opens PRs but never auto-merges.",
    "Exceptions cannot use package-name globs and cannot suppress a future advisory with a different identifier.",
    "No scanner mutates a manifest or lock.",
    "The current Railway and Cloudflare arrangements rebuild from source outside this GitHub artifact boundary.",
    "Therefore this feature must not claim that a GitHub attestation proves the bytes presently deployed by those hosts.",
    "This feature has an operator/developer surface and **no trader-facing surface**.",
    "A required check that fails to start is `blocked`, not `skipped`.",
    "It does not by itself claim that the target is vulnerability-free or license-compliant.",
    "Do not fabricate a source location."
  ],
  "conflicts": [
    {
      "quote": "Adopt exactly **Node 24.19.0, npm 11.17.0, and Rust 1.98.0**.",
      "source": "architect",
      "why": "[PM-C01] The releases' current/LTS status is a verifiable fact, but adopting them as Convexa's supported tuple is a design conclusion that the position does not support with a complete repository build, test, e2e, contract-generation, container-build, and Rust-postgres receipt. Latest is not the same as compatible. Owner ruling: not required; this is technical feasibility.",
      "proposal": "Treat this tuple as the candidate, run the complete current battery and both production builds under it, and lock the exact tuple only after the evidence is green; otherwise choose the newest supported tuple that passes without changing product behavior.",
      "kind": "technical"
    },
    {
      "quote": "Keep Nx at 23.1.1, override only the vulnerable Nx edge to `brace-expansion@5.0.9`, and override the compatible PostCSS edge to `nanoid@3.3.18`; regenerate the lock, run `npm ci`, run both full and production-only audits, and run the complete existing CI battery.",
      "source": "architect",
      "why": "[PM-C02] Calling the two replacements compatible before the regenerated graph and full battery pass turns an implementation hypothesis into a contract fact. A reviewed override may be valid, but the brief expressly rejects dependency rewriting merely to make a scan green. Owner ruling: not required; compatibility is technical.",
      "proposal": "Record each exact override as a candidate remediation. Permit it only when upstream constraints accept it, the lock remains coherent, the full current battery passes, and the resulting graph is independently rescanned; otherwise keep the direct versions and use the short-lived exact advisory disposition while an upstream release is tested.",
      "kind": "technical"
    },
    {
      "quote": "Development dependencies fail on high or critical advisories; moderate/low findings remain visible and enter scheduled remediation rather than silently disappearing.",
      "source": "architect",
      "why": "[PM-C03] Severity alone is an unsafe product boundary: a development tool can generate shipped bytes, execute untrusted pull-request input, or hold CI credentials, while a high finding may be unreachable from those effects. This also leaves the current Nx findings vulnerable to repeated short exceptions without an effect-based exit. Owner ruling: required; this is the organization's risk-acceptance policy.",
      "proposal": "Use severity as prioritization, not the sole gate. Block any unexcepted advisory that affects shipped output, CI credentials, untrusted-change execution, or release integrity; allow a development-only advisory only with evidence of isolation, a named owner, a non-silent review date, an upstream/remediation link, and an expiry whose renewal requires a new explicit decision.",
      "kind": "product"
    },
    {
      "quote": "The normal allow set is permissive licenses already expected in this stack (MIT, Apache-2.0 including LLVM exception, BSD-2-Clause, BSD-3-Clause, ISC, Zlib, Unicode-3.0, CC0-1.0, and approved data-only attribution licenses); MPL-2.0 is permitted only under its file-level terms.",
      "source": "architect",
      "why": "[PM-C04] Architecture can implement SPDX evaluation, but it cannot approve the organization's license risk. The phrase 'approved data-only attribution licenses' is also not a closed, independently enforceable category. Owner ruling: required; license acceptance and notice obligations are product/legal policy.",
      "proposal": "Inventory the licenses actually present, present a closed allow/review/deny table with notice obligations, and have the owner approve it. Unknown or unparseable expressions remain blocking until that ruling; the mechanism must not infer approval.",
      "kind": "product"
    },
    {
      "quote": "On trusted default-branch/release events, GitHub artifact attestation signs build provenance and the SBOM association for the exact API image digest and dashboard build archive.",
      "source": "architect",
      "why": "[PM-C05] Cryptographic provenance attestation is not required by the brief, adds permissions and plan/administration dependencies, and cannot establish the currently deployed Railway or Cloudflare bytes. My R1 explicitly future-dated signing; bringing it into this tranche is scope inflation unless its incremental value is chosen deliberately. Owner ruling: required.",
      "proposal": "Keep in scope a machine-verifiable SBOM plus revision, tool, policy, lock, and artifact-digest receipt. Defer signed attestations until deployment consumes the exact immutable GitHub-built subjects, unless the owner explicitly expands this feature and accepts the added administration and permissions.",
      "kind": "product"
    },
    {
      "quote": "Trivy scans Dockerfiles, Compose, Railway config, GitHub workflow configuration, the repository dependency surfaces, and each final API/dashboard image by digest.",
      "source": "architect",
      "why": "[PM-C06] The dashboard container is not the current Cloudflare Pages deployment artifact, so calling it a final dashboard image risks producing strong evidence for an artifact the product does not ship while leaving the Pages-built static output unbound. Owner ruling: not required to correct the factual target description; deployed-byte provenance would require a separate product ruling.",
      "proposal": "Name the API container image and GitHub-built dashboard distribution archive as build evidence subjects, treat the dashboard Docker image only as a container surface when it is actually built, and state that neither result proves the independently rebuilt Railway/Cloudflare deployed bytes.",
      "kind": "technical"
    },
    {
      "quote": "Syft, pinned by exact version and checksum, generates CycloneDX 1.6 JSON for the root dependency source and for each built image by immutable digest.",
      "source": "architect",
      "why": "[PM-C07] The brief requires machine-verifiable SBOMs, but it does not require both a repository-source inventory and duplicate per-image inventories. Each extra artifact creates a completeness claim, retention burden, and mismatch state. Owner ruling: required because the additional source SBOM is a scope/value choice.",
      "proposal": "Require an SBOM for each GitHub-built deployable subject. Add the root source SBOM only if the architect demonstrates a product-relevant coverage gap that the per-subject SBOMs cannot expose and defines the distinct claim it supports.",
      "kind": "product"
    },
    {
      "quote": "I assume the PM lane treats every required security check and the pin-parity check as branch-protection requirements, not informational dashboards; if any is optional, “normal GitHub gates reject policy drift” is not met.",
      "source": "architect",
      "why": "[PM-C08] 'Required' does not mean 'runs on every event.' Pull requests, scheduled freshness scans, default-branch monitoring, and artifact-specific release checks have different available subjects and trust. A scheduled advisory refresh cannot be a pending PR branch-protection check, and an image/SBOM check cannot run before its subject exists. Owner ruling: required because event-to-gate policy controls delivery throughput and risk.",
      "proposal": "Define an event matrix: PRs block on pin/lock parity, introduced-dependency review, applicable full-graph policy, changed/current source-config checks, and existing build/test gates; scheduled/default-branch runs refresh full advisory and secret/source evidence and create a release-blocking red state; release/artifact runs block on the exact built subject's image scan, SBOM, and receipt. No required result may be silently skipped on an event where it applies.",
      "kind": "product"
    },
    {
      "quote": "Every resolved scan result renders exactly one of `Passed`, `Failed`, `Blocked`, or `Skipped`, with the machine outcome as the sole source; required missing/errored/timed-out checks cannot render pass or skipped.",
      "source": "ux",
      "why": "[PM-C09] This closed set cannot represent the PM-required 'pass with advisories' state, while its use of 'Blocked' means evaluation failure rather than the aggregate delivery decision. Conflating check execution with release eligibility either hides accepted advisory debt or labels a completed policy violation and an unavailable scanner with the same meaning. Owner ruling: required because this is the operator-visible risk vocabulary.",
      "proposal": "Use two explicit layers: per-check execution/result states such as passed, violations-found, evaluation-blocked, and policy-authorized skipped; and aggregate delivery states pass, pass-with-advisories, and blocked. A completed allowed advisory renders pass-with-advisories; an unavailable required check and a prohibited finding both block delivery but retain their different causes.",
      "kind": "product"
    },
    {
      "quote": "A failed result presents each finding with a sanitized subject, detected condition, policy rule, evidence pointer, and concrete next step; absent source locations are not invented.",
      "source": "ux",
      "why": "[PM-C10] The proposed finding presentation omits the remediation owner and, for advisories/exceptions, the review or expiry date. A concrete next step without accountable ownership still produces an ownerless red gate and allows advisory debt to become permanent. Owner ruling: required because remediation accountability is a product operating rule.",
      "proposal": "Add remediation owner to every blocker and advisory. Add next review/decision date to advisories and owner, approver, and expiry to active exceptions; missing or overdue ownership data must itself block under the approved policy.",
      "kind": "product"
    },
    {
      "quote": "Add one pre-deploy prerequisite/link in `docs/DEPLOY_RUNBOOK.md`: the current revision's required supply-chain checks and SBOM evidence must have accepted results.",
      "source": "ux",
      "why": "[PM-C11] Without a subject limitation, this copy implies the SBOM evidence vouches for what Railway and Cloudflare deploy, which the architect correctly shows is impossible under their current host-side rebuilds. Owner ruling: not required to correct the unsupported claim; an owner ruling is required only if deployed-byte provenance is added to scope.",
      "proposal": "State that the prerequisite accepts the source revision and named GitHub-built evidence subjects only, and explicitly disclose that current Railway/Cloudflare deployed bytes are independently rebuilt and not proven by that SBOM.",
      "kind": "technical"
    },
    {
      "quote": "Each deployable artifact that reaches a policy-passing build has a machine-verifiable SBOM tied to that revision and to the artifact actually produced.",
      "source": "pm",
      "why": "[PM-C12] I withdraw this unqualified R1 claim. It can be defended for named GitHub-built subjects, but not for the artifacts currently rebuilt and deployed by Railway and Cloudflare. The architect's deployment-boundary statement is stronger and should control synthesis. Owner ruling: required only for the choice between narrowing the claim and expanding deployment scope.",
      "proposal": "Narrow the criterion to each named GitHub-built deployable subject and disclose the host rebuild boundary. If the owner requires deployed-byte SBOM/provenance now, add immutable-artifact deployment as an explicit scope expansion rather than pretending the current hosts consume the subjects.",
      "kind": "product"
    },
    {
      "quote": "Two clean, supported environments evaluating the same revision must select the same exact toolchains, resolve the same dependency identities and versions, reach the same policy classification, and produce the same SBOM component identity set.",
      "source": "pm",
      "why": "[PM-C13] I withdraw the policy-classification clause as written. Fresh advisory data intentionally makes an unchanged revision change from green to red; environment reproducibility and time-varying security knowledge are different promises. The architect's explicit advisory-database revision is the stronger account. Owner ruling: not required; this is a technical correction.",
      "proposal": "Require identical toolchains, dependency identities, and SBOM component identity for the same revision. Require the same policy result only when scanner version, policy revision, and advisory-database revision are also held constant; otherwise record those versions and allow newly published advisories to change the result fail-closed.",
      "kind": "technical"
    },
    {
      "quote": "3. **Required gates:** make the approved policy, reproducibility checks, reports, and SBOM checks required on pull requests and the protected main branch.",
      "source": "pm",
      "why": "[PM-C14] I withdraw this event-agnostic rollout claim. It demands artifact evidence before some subjects exist and fails to distinguish PR-introduced drift from scheduled advisory freshness and release-subject validation. The UX state model and architect data flow are stronger when applied through an event matrix. Owner ruling: required because the exact blocking matrix is a delivery-risk decision.",
      "proposal": "Adopt the PR/scheduled-default/release matrix proposed in PM-C08, with each applicable required check fail-closed and no event using an older revision's result as a substitute.",
      "kind": "product"
    }
  ],
  "asks": [
    "[PM-A01] Architect: what complete, current-repository receipt will prove the candidate Node/npm/Rust tuple before the versions become contract facts?",
    "[PM-A02] Architect: can each proposed transitive npm override be shown accepted by upstream constraints and independently rescanned after the full battery, without any audit-fix command?",
    "[PM-A03] Architect: which selected tools and GitHub features are actually available under this repository's current visibility and plan, and what minimum capability-preserving fallback exists for each unavailable feature?",
    "[PM-A04] Architect: which exact GitHub-built subjects can be built once, scanned, described by an SBOM, and retained without implying identity with the Railway/Cloudflare rebuilds?",
    "[PM-A05] Architect: can the event matrix reuse one result per revision/subject where trust permits, or would it duplicate expensive full scans across PR, default-branch, schedule, and release events?",
    "[PM-A06] Architect: what structural rule makes an exception renewal a new reviewed decision rather than an edit that silently extends permanent debt?",
    "[PM-A07] UX: how will the summary render per-check execution state separately from aggregate pass, pass-with-advisories, and blocked delivery state without presenting advisory debt as clean?",
    "[PM-A08] UX: where will remediation owner, advisory review date, and exception approver/expiry appear without forcing a reviewer into raw artifacts?",
    "[PM-A09] UX: can the deploy runbook state the GitHub-subject versus Railway/Cloudflare deployed-byte limitation adjacent to the prerequisite rather than burying it in the detailed runbook?"
  ]
}
```
