# supply-chain-automation — spec

**Source brief:** `.spire/clusters/tech/contracts/supply-chain-automation/BRIEF.md`  
**Council:** R1 positions · R2 critiques · `decisions.md` (under `council/`)  
**Status:** draft

## 1. Goal + scope

Select one reviewed toolchain, use non-overlapping authorities, publish sanitized evidence, and stop on
absent/untrustworthy proof. This R3 baseline adds no paid-plan, deployment, or waiver scope.

**In scope:**

- Candidate Node `24.19.0`, npm `11.17.0`, and Rust `1.98.0` must earn a same-revision compatibility
  receipt before becoming the single exact supported tuple.
- Exact repository pins for toolchains, external GitHub Actions, Docker base images, and every acquired
  policy/inventory tool; locked npm and Cargo resolution; structural parity and mutation guards.
- Native Dependabot for npm, Cargo, Docker, and Actions; grouped families, isolated majors, human approval,
  and no auto-merge.
- CI-local npm/Cargo/source/secret/config/image policy, lock-derived dependency inventories associated with
  named subject digests, strict normalization/sanitization,
  executable poison proofs, retained receipts, and bounded summaries.
- Associated dependency-inventory evidence for exactly the GitHub-built API-image and dashboard-archive digests.
- Root setup, one operator runbook, and a deploy prerequisite beside the host-rebuild limitation.

**Out of scope:**

- Trader UI, application/API/runtime/persistence, quant/scoring, market-data, auth, or deployment behavior.
- CodeQL/hosted dependency review/attestation, paid-plan/visibility changes, or a source-SAST claim.
- Security exceptions, bot merge/deploy/release holds, auto-fix, forced audit repair, or Nx downgrade.
- Any claim that GitHub evidence identifies independently rebuilt Railway/Cloudflare bytes.
- A root/source inventory, a required dashboard-container inventory, and duplicate advisory/license classification
  by Trivy for npm or Cargo.

**Future (deliberately deferred):** eligible hosted security/provenance, immutable-subject deployment,
deployed-byte identity, runtime revocation, reachability, organization policy, and measured auto-merge.

<!-- spire:council-resolution:v1 53db3f530cda47ae5ba5a44e38122bfea2cbad02bde6092f9ebf6e6391c54d39 folded -->
<!-- spire:council-resolution:v1 6f905a72f94e06ea4863775ee36ceb27520b13f52af694fb79c892d5867745c9 folded -->
<!-- spire:council-resolution:v1 768604565bb69ea244bfc2807150f3311ed7c56e5fd7729243563097c254bdea folded -->
<!-- spire:council-resolution:v1 f72b4d767734d10719252c67e01a778ea288214e624a9445f93ab1387275147f folded -->

## 2. Architecture

### 2.1 Authorities and repository boundaries

The root `package-lock.json` and root `Cargo.lock` remain the only dependency-resolution authorities.
The nested `libs/quant-engine/Cargo.lock` is removed and a guard rejects any reappearance. npm commands
use `npm ci`; Cargo build/test/metadata/policy commands use the workspace root and `--locked`. CI never
runs an auto-fix command and rejects a manifest or lockfile mutation made during verification.

Repository-owned machine authorities are:

- `.nvmrc`, exact `package.json` engine/package-manager declarations, `.npmrc` engine enforcement, and a
  root `rust-toolchain.toml`; workspace crates inherit the one exact `rust-version`.
- `.supply-chain/tools.json`: exact versions, trusted acquisition locations, and SHA-256 checksums for
  CI-local tools. A missing checksum, moving version, failed download, or checksum mismatch is blocked.
- `.supply-chain/policy.json`, `.supply-chain/license-baseline.json`,
  `.supply-chain/exceptions.json`, and strict JSON schemas under `.supply-chain/schemas/`.
- `deny.toml` for the Cargo advisory/license/source/bans engine, `.github/dependabot.yml` for proposals,
  and checked-in `tools/supply-chain/` adapters for parity, source/integrity checks, normalization,
  sanitization, summary rendering, subject receipts, and poison cases.
- `.github/workflows/ci.yml` for pull-request enforcement and a dedicated supply-chain artifact/scheduled
  workflow for subject production and freshness. Workflow-level permissions remain read-only; no new
  write permission is needed.

The candidate tuple is not binding because its releases are current. Qualification starts from an
immutable `base_revision_sha`: a bootstrap verified independently of the live selectors creates an
isolated candidate workspace, applies only the allowlisted candidate selector patch, records its patch and
tree hashes as `candidate_revision_id`, then runs the full battery under `24.19.0 / 11.17.0 / 1.98.0`.
Candidate parity is evaluated inside that workspace and never rewritten as parity of the base revision.
Only a complete qualification permits the byte-identical patch to enter the reviewed branch. The resulting
real `accepted_revision_sha` runs ordinary CI under its own standard `run_key`; the final binding receipt
joins that complete/pass CI receipt with file/tool/lock/Action/image parity before support. Candidate pins remain
explicitly unaccepted until that post-accept receipt passes. The receipt records selection and evidence;
it does not claim hosted runners or independently rebuilt OS layers are bit-reproducible.

### 2.2 Policy authorities and classification

Each surface has exactly one classifier:

| Surface | Authority | Required meaning |
|---|---|---|
| npm advisories | `npm audit` against the committed full lock | Any advisory blocks; production-zero remains separately demonstrated. |
| npm licenses | exact-pinned inventory tool + checked-in normalizer | The exact current SPDX-expression inventory is the continuity baseline. |
| npm source/integrity | checked-in lock guard | HTTPS npm registry + integrity or declared in-workspace link only. |
| Cargo advisories/licenses/sources/bans | exact-pinned `cargo-deny` | RustSec/yank/source/license/bans policy over root `Cargo.lock`. |
| repository/history secrets | exact-pinned Gitleaks | Current revision and applicable PR history/range; raw matches stay ephemeral. |
| Docker/workflow config and API-image findings | exact-pinned Trivy | Configuration plus final API-image OS/application/secret findings only. |
| associated dependency inventory | exact-pinned Syft | Lock-derived CycloneDX JSON associated with the named digest; Syft does not observe subject bytes. |
| aggregate result/publication | checked-in normalizer/sanitizer | Closed schema, precedence, safe retained evidence, and GitHub conclusion. |

Trivy must not classify npm/Cargo advisory or license outcomes, and none of these tools is described as
application-source SAST. Unknown, malformed, unsupported, timed-out, unavailable, partially evaluated, or
unparseable required input becomes `blocked`, never an empty success. Security findings never qualify for
`pass_with_advisories` in this tranche. The only permitted advisory class is an evidence-backed current-
baseline license notice/attribution obligation with owner, approver, rationale, review date, and expiry;
new/missing/changed/unparseable license expressions fail pending explicit review.

The two current npm advisory paths are a bounded remediation experiment: keep direct Nx `23.1.1`, test
only explicit reviewed resolutions to `brace-expansion@5.0.9` on the Nx edge and `nanoid@3.3.18` on the
PostCSS edge, record before/after paths, validate upstream constraints, regenerate the lock intentionally,
run full and production audits plus the entire tuple battery, then rescan. These are declared lock-graph
changes. If either experiment fails, its override is removed and the feature stops at GATE Z; no security
waiver, forced audit fix, unrelated rewrite, or Nx major downgrade is authorized.

### 2.3 Result flow, events, and subject identity

Data flows one way:

`reviewed inputs → parity → locked install → one authority per surface → existing gates → build subjects
once → Trivy scans API bytes → derive lock closures → Syft emits inventories from synthetic catalogs →
associate named digests → normalize → sanitize → aggregate → publish`.

The event matrix is binding:

| Event | Required work | Subject rule |
|---|---|---|
| Pull request | pin/action/image/lock parity; full dependency policy; repository secret and applicable configuration checks; mutation and poison guards; existing application gates | no artifact evidence before a named subject exists |
| Default-branch artifact run | build the API image and dashboard archive once; Trivy scans the image bytes; generate lock-derived inventories and associate receipts to the same SHA/digests | never rebuild between scan/validation, inventory association, and receipt |
| Schedule | refresh time-varying advisory evaluation for the current default revision | failure makes that revision non-releaseable; prior evidence is not rewritten |
| Manual dispatch | repeat the applicable current-revision path for diagnosis | cannot bless stale or other-revision evidence |

Every evidence key contains revision, event, policy hash, tool version, available advisory-data revision,
scope, and applicable subject digest. Identity is reproducible for equal revision/locks; classification
also fixes policy/scanner/advisory data. New advisory data may turn unchanged dependencies red. Trivy
observes API-image bytes; Syft's lock-derived inventory is only associated with the named digest.

Required subjects are closed:

1. `api-production-image`: the GitHub-built API OCI image addressed by `sha256` digest, with target-
   bound Cargo normal/build dependency closure and required named seeds.
2. `dashboard-distribution-archive`: an archive created from the one GitHub production dashboard build,
   addressed by SHA-256 digest, with the lock-derived npm production/workspace closure and named seeds.

No source inventory is required. A dashboard container requires a GATE-Z scope amendment. Every subject
summary and deploy prerequisite carries exactly: `This evidence does not
identify bytes independently rebuilt or deployed by Railway or Cloudflare.`

### 2.4 Proposal automation and ownership

Native Dependabot alone covers npm, Cargo, both Dockerfiles, and Actions weekly using the exact §9 groups;
unmatched packages and majors are separate. Node/Rust pins stay human PRs. No auto-merge.

Dependabot bodies remain native, bot-generated output; no custom-body updater or write token is added.
Checked-in group names/commit prefixes, static ecosystem/ownership labels, and the runbook link carry the
configured review context. Native checks own live status. Existing main-triggered Railway/Cloudflare
behavior continues only after a human-approved merge.

### 2.5 Normalizer, sanitizer, exceptions, and evidence publication

The checked-in normalizer accepts only `INTERFACE_CONTRACT.md` §§5–6 schemas. Unknown/malformed/missing/
stale input, unauthorized skip, digest mismatch, or missing accountability is `blocked`; aggregate
precedence is `blocked` → `fail` → `pass_with_advisories` → `pass`. An always-running aggregator prevents
native skip from authorizing delivery.

Raw tool output is ephemeral. One allowlist sanitizer derives every retained/public channel, stripping
snippets, environment/command values, authorization data, credentialized URL parts, and unsafe metadata.
Canary secret/URL poison must disappear everywhere; redaction copy appears only for a recorded redaction.

No security exception ships. Non-security exception identity/scope/creation/expiry are immutable; renewal
is a new record naming its predecessor. Extension, broadening, missing predecessor, expiry, duplicate
active scope, or globbed identity blocks. Summaries retain every surface but preview at most 20 rows and
three examples per `(check, rule_id)`, group actions by the R3 ownership tuple, and link the complete
sanitized report with the exact overflow copy in §4.

### 2.6 Failure modes + isolation

- Candidate tuple, current-advisory remediation, security-tool capability, sanitizer poison, dependency-inventory
  binding, or always-running aggregator failure is a GATE-Z stop. Execution may not silently select an
  older/moving toolchain, waive the advisory, omit the surface, retain raw output, or weaken tests.
- A scanner acquisition/checksum/database/execution/reporting failure blocks only the delivery evidence;
  it never modifies source dependencies or starts the application.
- A partial report may be retained for diagnosis only with `complete:false` and aggregate `blocked`.
- No scanner or evidence artifact receives application runtime secrets. Workflow permissions remain
  `contents: read` by default, checkout does not persist credentials, and final images remain non-root.
- Supply-chain modules, workflows, docs, and repository metadata do not import or execute scoring/trader
  modules except through the existing tests/builds being verified.

**Not buildable / rejected approaches:** moving `stable`/major-only toolchains; Renovate plus Dependabot;
hosted CodeQL/dependency review/attestation without eligibility; duplicate Trivy dependency authority;
severity-only dev classification; an open license allowlist invented without inventory; a security
exception; one combined/source inventory; artifact evidence before a subject exists; scan-time auto-fix; mutable
Action tags or image tags without digests; and any claim that host rebuilds equal GitHub subjects.

<!-- spire:council-resolution:v1 0daa0b904efa19a3e6adc5d066649f2b875526d6421424f7ac5a4bda27edfcf2 folded -->
<!-- spire:council-resolution:v1 9ab2c6128de7f43144ae7a234d699689caf7731b77021284c3172967ee6cc74c folded -->
<!-- spire:council-resolution:v1 0b8164cc8b5d92d246748bf6f7c83148c6b98006c96a31509ea278084a555ed6 folded -->
<!-- spire:council-resolution:v1 c052fa60076464168820fa1f3c3a550ecd11936df202e4a0f25d4e081eba7342 folded -->
<!-- spire:council-resolution:v1 5f8aba1053ee4ce650a8f8977e6b277d0e676fdaf7b04b76521f7cb7ed127492 folded -->
<!-- spire:council-resolution:v1 b2dfc7315cfa3f50c35c4b48e3ed7ea811b2eb69758defaf64bebfb5175090b6 folded -->
<!-- spire:council-resolution:v1 2a19784414ff85bdab589f80d2dfd7afe5aef07dba57f9b606cb452f1cc9545d folded -->
<!-- spire:council-resolution:v1 e4814a6e0ebdcfbbc423371836fa575560004f7d6ee457e6e893105b7678061c folded -->
<!-- spire:council-resolution:v1 7dd322ef081bab91928e0bd551545122d6ebdfd83a4e6f2cfbe8509ec8d077bb folded -->
<!-- spire:council-resolution:v1 eea54d448de8dddf5f2810351d0a81728d492926d54c59b3973655fb900289dc folded -->
<!-- spire:council-resolution:v1 24c7f24b99f1f265c6bfae9e083a2bf3843c6d6fb89f4884fbbca72cc455b026 folded -->
<!-- spire:council-resolution:v1 bae6830242e59a2c6664fd7d2e20ac02a779c12aead344b7486cfc30ce0b560d folded -->
<!-- spire:council-resolution:v1 cc6018813865fc5241d52f58e1a5d49bf8ea07e16dd25e4a00f9efc610dee9eb folded -->
<!-- spire:council-resolution:v1 4b8da7b444061cfe6764f798beb33735833678416b2dee5c985ca4c6c512fadf folded -->
<!-- spire:council-resolution:v1 78aa522804dde4cdefeee000ec2457b21571b9c2759bf5d066fce5abd526e134 folded -->
<!-- spire:council-resolution:v1 59e99f2ed96a91abbb4e1e126e8d6fe153107d1b8b3700a7eed2f0fa185d7eba folded -->
<!-- spire:council-resolution:v1 2d1c5cc829866479ba0d3c74fd63ee3c0067b78f7df375ade9d96bafdbefde6a folded -->
<!-- spire:council-resolution:v1 b75a3050c2a691371f7ae2af1faf9d904acdd69c28c2b08ec726cace4937f9c0 folded -->
<!-- spire:council-resolution:v1 d847e530dab51455688828dca78ab3b207a9723985834b7e6ff7718773e05e81 folded -->
<!-- spire:council-resolution:v1 ff0a1c7f12ea4eef412d0c0a114ce646b63572cb6c6e62a55604f14e98e5b1ea folded -->
<!-- spire:council-resolution:v1 930f93d3cda5a4632933b7dc6366b339bb4742930bf2cd41a075d53f38ae2696 folded -->
<!-- spire:council-resolution:v1 d8ea28f54a2b45a112839b1fd71ce36fd9dad1a9f1768a78439651b64c33ecba folded -->

## 3. Acceptance criteria (with user stories)

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 | As a maintainer, I want a proven toolchain so clean environments agree. | From a base SHA, qualification records distinct candidate patch/tree identities; only that patch enters an accepted revision, whose binding receipt joins same-revision ordinary CI by recomputed `run_key` and required-check-set hash with exact tool/lock/file/Action/image parity before support. | test |
| AC-2 | As a maintainer, I want incompatibility to stop visibly. | If any candidate-tuple tier fails without a product/runtime change or weakened assertion, the run reports the failed tier and GATE-Z stop, and neither moving channels nor a different unproved tuple is accepted. | test |
| AC-3 | As a maintainer, I want one selector everywhere. | Candidate selectors are never labeled supported before the accepted-revision receipt; after acceptance, any mismatch among `.nvmrc`, package metadata, `rust-toolchain.toml`, crate `rust-version`, CI, or Docker selectors fails before install and reports expected/detected values. | test |
| AC-4 | As a reviewer, I want immutable automation inputs. | A fixture containing a mutable external Action tag, non-40-hex Action reference, floating image, missing image digest, stale SHA, or tag/digest mismatch makes its guard fail; exact SHA/digest inputs pass. | test |
| AC-5 | As a maintainer, I want locks to be authoritative. | Clean npm and Cargo verification uses the root locks, leaves manifests/locks byte-unchanged, and rejects a reintroduced nested `libs/quant-engine/Cargo.lock` or any scan-time dependency mutation. | test |
| AC-6 | As a dependency reviewer, I want bounded proposals. | Dependabot validates for npm, Cargo, Docker, and GitHub Actions; every routine proposal belongs to one configured ecosystem/group or is individually named, and major movements are excluded from routine groups. | test |
| AC-7 | As a dependency reviewer, I want human control. | Dependabot config validates exact groups, commit prefixes, static ecosystem/ownership labels, and the review-runbook link; there is no auto-merge, custom-body updater, or write token, native bodies remain bot-owned, and post-human-merge CD behavior is unchanged. | test |
| AC-8 | As a security owner, I want security knowledge to block. | Any npm or Cargo advisory, including a current development/build advisory, yields aggregate `fail` unless remediated and rescanned; no security finding or exception can yield `pass_with_advisories`. | test |
| AC-9 | As a maintainer, I want bounded remediation rather than a blind downgrade. | The two named transitive override experiments record before/after paths and constraints, preserve direct Nx `23.1.1`, run full/production audits and the complete tuple battery, and remain only if all evidence passes; a failing experiment stops without `npm audit fix --force`, Nx downgrade, or unrelated graph change. | test |
| AC-10 | As a policy owner, I want honest license continuity. | The exact current SPDX-expression inventory passes as the checked baseline; an unchanged notice obligation yields `pass_with_advisories` with accountability, while a new, changed, missing, unparseable, or overdue expression/obligation yields `fail`. | test |
| AC-11 | As a policy owner, I want dependency sources constrained. | A lock fixture using HTTP, git, an alternate npm registry, an npm package without integrity, an out-of-workspace link, an alternate Cargo registry, an unapproved git source, checksum absence, or wildcard Cargo dependency is rejected; current approved registry/workspace sources pass. | test |
| AC-12 | As a release owner, I want one answer per surface. | Each declared surface is classified by its named authority only; enabling overlapping Trivy npm/Cargo advisory/license classification makes the configuration guard fail. | test |
| AC-13 | As a release owner, I want evaluation failure distinguished from violations. | The normalized per-check state is exactly `pass`, `pass_with_advisories`, `fail`, `blocked`, or policy-authorized `skipped`; malformed/unknown/missing/timed-out/unavailable/partial required input is `blocked`, and a completed prohibited finding is `fail`. | test |
| AC-14 | As a release owner, I want the aggregate to fail closed. | The always-running aggregate applies precedence `blocked` → `fail` → `pass_with_advisories` → `pass`; a missing, stale, failed-to-start, native-skipped, or unauthorizedly skipped required job cannot produce GitHub success. | test |
| AC-15 | As an operator, I want event-appropriate gates. | PR, default-branch, schedule, and manual-dispatch fixtures resolve the event matrix; dispatch accepts only the closed `path` choice, and every child/aggregate receipt matches the current revision, dispatch path, subject-set hash, and computed `run_key`. | test |
| AC-16 | As a security owner, I want current knowledge without false nondeterminism. | Equal revision/locks select equal toolchain/dependency identities; equal policy/tool/advisory-data revisions classify equally; changing only advisory-data revision may change classification and the report exposes that revision. | test |
| AC-17 | As a security owner, I want immutable exceptions. | Poisoned in-place expiry extension, scope broadening, missing predecessor, duplicate active record, expired record, wildcard identity, or security exception is rejected; a valid non-security renewal is a new record naming its predecessor. | test |
| AC-18 | As a reviewer, I want retained evidence safe to share. | Every publication channel is generated from sanitized schemas; child stdout/stderr and raw annotations/excerpts are suppressed. Canary values appear in no log, JSON, annotation, summary, artifact metadata, receipt, or inventory metadata; the dedicated canary-stop receipt is distinct from a safely published policy `fail`. | test |
| AC-19 | As a reviewer, I want complete evidence and a readable summary. | Strict check/finding/subject/artifact schemas retain every declared surface using bounded safe references and 30-day retention; the summary caps at 20 rows/three examples per `(check, rule_id)`, blockers first, groups actions by ownership tuple, and emits exact overflow copy. | test |
| AC-20 | As a remediation owner, I want accountable results. | Every owner/action/evidence reference resolves through the checked-in closed catalogs; advisories also resolve rationale, approver, review and expiry dates, and unknown/missing/overdue references block normalization. | test |
| AC-21 | As a release owner, I want API evidence tied to one subject. | Trivy scans the exact API-image bytes. Separately, Syft emits the RFC-8785-verified Cargo lock-derived inventory and its receipt associates it with that digest without claiming byte observation; zero, missing, duplicate, arbitrary, cross-subject, or mismatched identities block. | test |
| AC-22 | As a release owner, I want dashboard evidence tied to one subject. | The dashboard dist passes the deterministic TAR validator. Separately, Syft emits the RFC-8785-verified npm lock-derived inventory and associates it with the TAR digest without claiming byte observation; unsafe members, zero/arbitrary components, or mismatch block. | test |
| AC-23 | As a release owner, I want missing artifact evidence to stop release claims. | Generation/validation failure, missing or expired artifact, failed seeded-component mutation probe, wrong family, canonical-identity/provenance/association mismatch, or stale digest is `blocked`; an inventory is never proof of subject-byte contents. | test |
| AC-24 | As a release owner, I want evidence claims bounded. | Every successful association uses the exact §4 inventory sentence, then `Syft did not observe or catalog the subject bytes; the digest is an association key.`, then the exact Railway/Cloudflare disclaimer; forbidden subject claims never appear. | review |
| AC-25 | As an operator, I want actionable states without log archaeology. | The GitHub summary renders the exact §4 copy, revision/policy/scope, every surface, ownership/action groups, and evidence links in verdict-first order without relying on color or fabricated source locations. | review |
| AC-26 | As a maintainer, I want tool failure to stop rather than disappear. | Every closed capability ID has an executable probe receipt showing its exact pass, policy-fail, and unavailable triggers through the real adapter; any missing/duplicate probe, wrong exit/state, checksum/tool/database failure, or unproved required capability is `blocked` and a GATE-Z stop. | test |
| AC-27 | As a product owner, I want no trader change. | The shipped dashboard route/nav/component inventory and trader-visible copy have no supply-chain additions or changes, and there is no new product UI surface. | review |
| AC-28 | As a product owner, I want no application contract change. | Existing public/auth conformance produces the same outcomes before and after this feature, and the `apps/api/src`, dashboard runtime source, and generated public API contract have no supply-chain behavior delta. | test |
| AC-29 | As a product owner, I want score semantics preserved. | Fixed application fixtures return byte-identical opportunity score, opportunity tier, entry-gate decision, and state fingerprint before and after the feature. | test |
| AC-30 | As an operator, I want one truthful runbook. | README setup values are sourced from the pins and link to `docs/SUPPLY_CHAIN.md`; that runbook owns policy/state/reproduction/remediation/limits; `docs/DEPLOY_RUNBOOK.md` links the prerequisite beside the exact host-rebuild disclaimer without duplicating policy. | review |

All silent/fail-closed/negative-space promises use automated tests. Copy placement and documentation
reading order use review because their changes are intentionally visible. The suite may satisfy several
rows through one high-level poison/integration run; a green command with a skipped or vacuous assertion is
not evidence.

## 4. UI + interaction

`NO_UI_CHANGE`. There is no trader-facing component, route, notification, setting, navigation entry, or
product copy. The only interaction surfaces are native GitHub checks, Dependabot pull requests, retained
artifacts, README, and operator runbooks.

**Flows:** a maintainer opens/reviews a proposal or change → required event-appropriate checks run → the
normalizer emits one result per declared surface → the always-running aggregate decides delivery → the
summary gives the first safe next action and links the sanitized report/inventory evidence. A manual dispatch
repeats current-revision evidence for diagnosis and cannot bless stale evidence.

**Component states:**

| Component | default | loading | empty | error | offline/stale |
|---|---|---|---|---|---|
| Supply-chain aggregate | `Supply-chain checks are waiting to start. No result yet.` | `Supply-chain checks are running. No result yet.` | `No required checks were resolved for this revision. Supply-chain evaluation is blocked.` | Exact terminal copy below | `Stale evidence — this result was generated for {evidence_short_sha}, not current revision {current_short_sha}. Re-run the check.` |
| Per-check row | Declared scope with no result | `{check_name} is scanning {scope}.` | Required absence becomes `blocked` | One exact terminal state below | Cached/older evidence cannot satisfy the current revision |
| Dependabot proposal | `Dependency proposal ready for review.` | `Dependency proposal checks are running. Do not merge until the required checks finish.` | `No eligible dependency updates were proposed in this run.` only after a completed zero-update run | `Dependency proposal blocked: required evidence is missing or did not complete.` | `Superseded by {proposal_link}.` only when supplied |
| Dependency-inventory evidence | Required target named, no result | `Generating lock-derived dependency inventory for {target}. No artifact is available yet.` | Missing required target is blocked | Missing/generation/validation/association states remain distinct | Wrong revision or unavailable/expired artifact is blocked and must be regenerated |

**Copy:**

- `Passed — No policy violations or advisories were reported in the declared scope.`
- `Passed with advisories — No blocking policy violations were found. {count} allowed advisory finding(s) require review.`
- `Failed — {count} blocking policy violation(s) were found.`
- `Blocked — {check_name} did not produce a trustworthy result. No pass result is available.`
- `Skipped — {check_name} did not run. Authorized by {rule_id}. Reason: {reason}.`
- Aggregate success: `Required supply-chain checks passed for revision {short_sha}.`
- Aggregate advisory: `Required supply-chain checks passed with advisories for revision {short_sha}.`
- Aggregate failure: `Supply-chain policy failed for revision {short_sha}.`
- Aggregate blocked: `Supply-chain checks are blocked for revision {short_sha}. No pass result is available.`
- Inventory success: `CycloneDX lock-derived dependency inventory generated and schema-validated for dependencies associated with GitHub-built {target} at revision {sha}, subject digest {digest}.`
- Inventory boundary: `Syft did not observe or catalog the subject bytes; the digest is an association key.`
- Host limitation: `This evidence does not identify bytes independently rebuilt or deployed by Railway or Cloudflare.`
- Redaction disclosure: `Some diagnostic text was redacted before publication.` only when redaction occurred.
- Summary overflow: `Showing {shown} of {total} finding groups. Open the sanitized report for complete evidence.`

The summary order is aggregate verdict → revision/policy/scope → results → required next action → inventory
evidence → provenance. Text carries all meaning; native color/icons are optional and never authoritative.

**Design authority:** `NO_UI_CHANGE`; `.spire/clusters/tech/context/DESIGN_SYSTEM.md` is not amended.

**Design direction:** use native GitHub Markdown headings, tables, annotations, and artifact links. Do not
imitate the product design system or add an application status surface.

<!-- spire:council-resolution:v1 401978c1df635cd0f3e1a52de95eabef9b330f3e40647687de1bbf2cf8e98eb7 folded -->
<!-- spire:council-resolution:v1 40145f0c324ec828c9d501460d509ad32f30695c4ab0be22ee9f3fb8339f0047 folded -->
<!-- spire:council-resolution:v1 10dcfae979a78a534494142ff215f908586dcdd69f4c3a43e5a07b5982f93c51 folded -->
<!-- spire:council-resolution:v1 008ded8db3c7dcc3c3086cff6447fbe5adfec034b210362e1b83dc691151e07c folded -->
<!-- spire:council-resolution:v1 cbb8c977b784745892d15ec57ecf4df80963d0be3280bb8d972203a8fd6aa0a5 folded -->
<!-- spire:council-resolution:v1 0974a0565f8ec51c3cfbbe3729dd608b4059090cf6c39d04ba50f77b836cb748 folded -->
<!-- spire:council-resolution:v1 7a81080cc381b4017fa532a1f463d9ce212e6b4e73a1b966d7006d1c2618a9bd folded -->

## 5. Error handling

Policy violations render `fail`; an untrustworthy result renders `blocked`. Failed-to-start required checks
are never `skipped`, and partial zero counts are never `pass`. Published blockers carry sanitized subject,
rule, owner, action, and evidence; tool-supplied locations are never fabricated. Raw output is not retained.

Tool/service/auth/rate-limit/timeout/input/policy/report failures retain the last safe partial report only
as `complete:false`, never reuse earlier/cached evidence, and instruct repair then rerun. If the sanitizer
records a redaction it adds the exact disclosure; it never publishes the removed value. Report/inventory upload
failure blocks because retained evidence is part of the promise.

Capability-stop conditions do not degrade: a candidate toolchain that cannot pass, a current advisory that
cannot be remediated through the two bounded experiments, a required tool that cannot emit the needed
local deterministic result, an unbindable inventory association, an unsanitizable publication channel, or an
aggregator that cannot run after upstream failure stops at GATE Z. No fallback may omit or weaken the
criterion.

<!-- spire:council-resolution:v1 768f4a87fddd0ec12fa1ed3b392a147e7824ecfbfa0a80612d5d033103f61645 folded -->

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/supply-chain-automation/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** `NO_BACKEND_CHANGE` and no public application API change. The
companion file is authoritative for repository/CI command, report, exception, event, proposal, inventory,
ownership, and failure boundaries. Existing live application conformance specs are pointers only and
remain unchanged.

<!-- spire:council-resolution:v1 8dbdfe269bb018f3760442e36424f9c629f55552973950df79627c4ce6e01397 folded -->

## 7. Testing strategy

One fixture harness sends clean and poisoned cases through the production normalizer/sanitizer/aggregator.
It proves both arms for pins, sources, advisory/license policy, authority overlap, exceptions, tool failure,
stale evidence, lock mutation, canary diagnostics, summary bounds, and inventory digest/revision/target mismatch.

Tuple qualification runs the current contract, formatting, lint, typecheck, Node-tool, unit, Playwright,
bundle, Rust default/Postgres guardrail/release-safety, release-build, both Docker-build, conformance, and
score-identity tiers listed in the interface receipt. Evidence records exact commands and non-vacuous
outcomes. Dependabot fixtures prove grouping/major isolation. QA re-runs application conformance and
score/tier/gate/fingerprint pins. With no product UI, exact copy/order/docs use review; silent boundaries
use automation.

<!-- spire:council-resolution:v1 deadd20c6e55141a57f536ea40b7b9c1c4a0d59672bedea36b493191a5799bf7 folded -->

## 8. Guardrails this feature must not break

- **`[no-secrets-in-image]`** — Docker contexts, images, dependency inventories, reports, summaries, annotations, logs, and
  artifact metadata contain no secret values; runtime injection and non-root final images remain intact.
- **`[production-fails-closed]`** — prohibited or unverifiable supply-chain state blocks eligible evidence;
  no warning-only or development fallback can authorize release.
- **`[structural-over-prose-enforcement]`** — exact pins, strict schemas, source guards, exception
  immutability, parity checks, and non-vacuous poison tests make violations build-breaking.
- **`[cited-code-is-verified-not-assumed]`** — implementation rechecks the current manifests, workflows,
  Dockerfiles, locks, and deploy docs before modifying them; archived Python is never implementation truth.
- **`[secret-encrypted-at-rest]`** — storage is untouched; evidence exposes no secret material or env value.
- **`[additive-keeps-score-byte-identical]`** — entry gate, opportunity score/tier, and fingerprint outputs
  remain byte-identical; supply-chain code cannot become a scoring input.
- **`[operator-vs-trader-path-separation]`** — evidence stays in repository/GitHub/operator docs, never a trader route.

## 9. Open questions

None. R3 closed all product and technical conflicts. The conditional stops in §§2 and 5 are capability
failures that require GATE Z, not deferred design choices.

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"source":"R2-architect.md","index":0,"conflict_id":"401978c1df635cd0f3e1a52de95eabef9b330f3e40647687de1bbf2cf8e98eb7","disposition":"folded","section":"§4"},{"source":"R2-architect.md","index":1,"conflict_id":"0daa0b904efa19a3e6adc5d066649f2b875526d6421424f7ac5a4bda27edfcf2","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":2,"conflict_id":"9ab2c6128de7f43144ae7a234d699689caf7731b77021284c3172967ee6cc74c","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":3,"conflict_id":"0b8164cc8b5d92d246748bf6f7c83148c6b98006c96a31509ea278084a555ed6","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":4,"conflict_id":"c052fa60076464168820fa1f3c3a550ecd11936df202e4a0f25d4e081eba7342","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":5,"conflict_id":"53db3f530cda47ae5ba5a44e38122bfea2cbad02bde6092f9ebf6e6391c54d39","disposition":"folded","section":"§1"},{"source":"R2-architect.md","index":6,"conflict_id":"5f8aba1053ee4ce650a8f8977e6b277d0e676fdaf7b04b76521f7cb7ed127492","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":7,"conflict_id":"b2dfc7315cfa3f50c35c4b48e3ed7ea811b2eb69758defaf64bebfb5175090b6","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":8,"conflict_id":"2a19784414ff85bdab589f80d2dfd7afe5aef07dba57f9b606cb452f1cc9545d","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":9,"conflict_id":"e4814a6e0ebdcfbbc423371836fa575560004f7d6ee457e6e893105b7678061c","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":0,"conflict_id":"7dd322ef081bab91928e0bd551545122d6ebdfd83a4e6f2cfbe8509ec8d077bb","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":1,"conflict_id":"eea54d448de8dddf5f2810351d0a81728d492926d54c59b3973655fb900289dc","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":2,"conflict_id":"24c7f24b99f1f265c6bfae9e083a2bf3843c6d6fb89f4884fbbca72cc455b026","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":3,"conflict_id":"bae6830242e59a2c6664fd7d2e20ac02a779c12aead344b7486cfc30ce0b560d","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":4,"conflict_id":"6f905a72f94e06ea4863775ee36ceb27520b13f52af694fb79c892d5867745c9","disposition":"folded","section":"§1"},{"source":"R2-pm.md","index":5,"conflict_id":"cc6018813865fc5241d52f58e1a5d49bf8ea07e16dd25e4a00f9efc610dee9eb","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":6,"conflict_id":"4b8da7b444061cfe6764f798beb33735833678416b2dee5c985ca4c6c512fadf","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":7,"conflict_id":"78aa522804dde4cdefeee000ec2457b21571b9c2759bf5d066fce5abd526e134","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":8,"conflict_id":"40145f0c324ec828c9d501460d509ad32f30695c4ab0be22ee9f3fb8339f0047","disposition":"folded","section":"§4"},{"source":"R2-pm.md","index":9,"conflict_id":"10dcfae979a78a534494142ff215f908586dcdd69f4c3a43e5a07b5982f93c51","disposition":"folded","section":"§4"},{"source":"R2-pm.md","index":10,"conflict_id":"8dbdfe269bb018f3760442e36424f9c629f55552973950df79627c4ce6e01397","disposition":"folded","section":"§6"},{"source":"R2-pm.md","index":11,"conflict_id":"59e99f2ed96a91abbb4e1e126e8d6fe153107d1b8b3700a7eed2f0fa185d7eba","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":12,"conflict_id":"2d1c5cc829866479ba0d3c74fd63ee3c0067b78f7df375ade9d96bafdbefde6a","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":13,"conflict_id":"deadd20c6e55141a57f536ea40b7b9c1c4a0d59672bedea36b493191a5799bf7","disposition":"folded","section":"§7"},{"source":"R2-ux.md","index":0,"conflict_id":"008ded8db3c7dcc3c3086cff6447fbe5adfec034b210362e1b83dc691151e07c","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":1,"conflict_id":"d8ea28f54a2b45a112839b1fd71ce36fd9dad1a9f1768a78439651b64c33ecba","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":2,"conflict_id":"768604565bb69ea244bfc2807150f3311ed7c56e5fd7729243563097c254bdea","disposition":"folded","section":"§1"},{"source":"R2-ux.md","index":3,"conflict_id":"cbb8c977b784745892d15ec57ecf4df80963d0be3280bb8d972203a8fd6aa0a5","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":4,"conflict_id":"b75a3050c2a691371f7ae2af1faf9d904acdd69c28c2b08ec726cace4937f9c0","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":5,"conflict_id":"768f4a87fddd0ec12fa1ed3b392a147e7824ecfbfa0a80612d5d033103f61645","disposition":"folded","section":"§5"},{"source":"R2-ux.md","index":6,"conflict_id":"d847e530dab51455688828dca78ab3b207a9723985834b7e6ff7718773e05e81","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":7,"conflict_id":"ff0a1c7f12ea4eef412d0c0a114ce646b63572cb6c6e62a55604f14e98e5b1ea","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":8,"conflict_id":"f72b4d767734d10719252c67e01a778ea288214e624a9445f93ab1387275147f","disposition":"folded","section":"§1"},{"source":"R2-ux.md","index":9,"conflict_id":"0974a0565f8ec51c3cfbbe3729dd608b4059090cf6c39d04ba50f77b836cb748","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":10,"conflict_id":"930f93d3cda5a4632933b7dc6366b339bb4742930bf2cd41a075d53f38ae2696","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":11,"conflict_id":"7a81080cc381b4017fa532a1f463d9ce212e6b4e73a1b966d7006d1c2618a9bd","disposition":"folded","section":"§4"}]}
-->
