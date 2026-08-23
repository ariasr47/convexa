# R3 — decisions: supply-chain-automation

## Human rulings

None required for the conservative baseline. The owner already approved this implementation tranche and
its order. R3 resolves every cross-layer conflict by taking the narrower fail-closed path: no paid GitHub
plan or repository-visibility change, no deployment-path replacement, no cryptographic-attestation claim,
no bot auto-merge, and no security-advisory risk acceptance. Any later expansion of those boundaries is a
new owner decision through GATE Z.

## Product resolutions

### Evaluation truth uses distinct result and delivery states

Each check has one terminal state: `pass`, `pass_with_advisories`, `fail`, `blocked`, or an explicitly
policy-authorized surface-only `skipped`. `fail` means a completed evaluation found a prohibited
condition; `blocked` means no trustworthy evaluation exists. A missing, stale, unauthorizedly skipped,
or failed-to-start required check is `blocked`, never zero findings.

Aggregate precedence is `blocked` → `fail` → `pass_with_advisories` → `pass`. GitHub maps `pass` and
`pass_with_advisories` to success, and `fail`/`blocked` to failure; an always-running aggregator emits the
decision, so GitHub's native skipped conclusion never substitutes for it. Security advisories do not
qualify for `pass_with_advisories` in this tranche. That state is limited to evidence-backed non-security
obligations such as permitted licenses requiring notice or attribution. A security exception requires a
future owner ruling and cannot be invented during execution.

This resolves conflicts
`401978c1df635cd0f3e1a52de95eabef9b330f3e40647687de1bbf2cf8e98eb7`,
`24c7f24b99f1f265c6bfae9e083a2bf3843c6d6fb89f4884fbbca72cc455b026`,
`40145f0c324ec828c9d501460d509ad32f30695c4ab0be22ee9f3fb8339f0047`,
`008ded8db3c7dcc3c3086cff6447fbe5adfec034b210362e1b83dc691151e07c`, and
`d8ea28f54a2b45a112839b1fd71ce36fd9dad1a9f1768a78439651b64c33ecba`.

### License policy preserves the current graph without pretending to be legal advice

The initial license baseline is the exact set of SPDX expressions observed in the current committed npm
and Cargo graphs. It is a continuity rule, not general legal approval. Existing notice/attribution
obligations remain visible as `pass_with_advisories`. A missing, unparseable, new, or changed expression,
or an overdue obligation, fails pending explicit review. No open-ended phrase such as “approved data-only
license” and no inferred reciprocal-license decision is permitted.

This resolves conflict
`bae6830242e59a2c6664fd7d2e20ac02a779c12aead344b7486cfc30ce0b560d`.

### Evidence subjects are closed and do not claim deployed-byte provenance

Required SBOM subjects are exactly the GitHub-built API production image addressed by digest and the
GitHub-built dashboard distribution archive addressed by digest. The dashboard container is not a
required subject unless CI actually produces it as a supported artifact. Full-lock policy reports own
the source dependency inventory; no third root-source SBOM is required.

Every summary states: `This evidence does not identify bytes independently rebuilt or deployed by
Railway or Cloudflare.` The words `shipped`, `deployed`, `production provenance`, `signed`, and `attested`
are forbidden for these subjects. Cryptographic attestations and a host cutover to immutable GitHub-built
subjects are future work.

This resolves conflicts
`9ab2c6128de7f43144ae7a234d699689caf7731b77021284c3172967ee6cc74c`,
`e4814a6e0ebdcfbbc423371836fa575560004f7d6ee457e6e893105b7678061c`,
`6f905a72f94e06ea4863775ee36ceb27520b13f52af694fb79c892d5867745c9`,
`cc6018813865fc5241d52f58e1a5d49bf8ea07e16dd25e4a00f9efc610dee9eb`,
`4b8da7b444061cfe6764f798beb33735833678416b2dee5c985ca4c6c512fadf`,
`8dbdfe269bb018f3760442e36424f9c629f55552973950df79627c4ce6e01397`,
`59e99f2ed96a91abbb4e1e126e8d6fe153107d1b8b3700a7eed2f0fa185d7eba`,
`768604565bb69ea244bfc2807150f3311ed7c56e5fd7729243563097c254bdea`,
`cbb8c977b784745892d15ec57ecf4df80963d0be3280bb8d972203a8fd6aa0a5`, and
`d847e530dab51455688828dca78ab3b207a9723985834b7e6ff7718773e05e81`.

### Required work follows an event matrix

- **Pull request:** toolchain/action/image/lock parity, full dependency policy, repository secret and
  applicable configuration checks, mutation guards, and existing build/test gates block merge.
- **Default branch artifact run:** freshly build the two named subjects once; scan the applicable subject;
  generate and validate target-specific SBOMs and retained receipts for the same SHA and digest.
- **Schedule:** refresh time-varying advisory evaluation against the current default revision. A failure
  makes that revision non-releaseable but does not rewrite earlier evidence.
- **Manual dispatch:** repeats the applicable current-revision path for diagnosis; it cannot bless stale
  evidence.

Artifact evidence is required only where its named subject exists. Every evidence key includes revision,
policy hash, tool version, advisory-data revision where available, and subject digest. No event can use an
older revision's result as a substitute.

This resolves conflicts
`78aa522804dde4cdefeee000ec2457b21571b9c2759bf5d066fce5abd526e134`,
`deadd20c6e55141a57f536ea40b7b9c1c4a0d59672bedea36b493191a5799bf7`, and
`2d1c5cc829866479ba0d3c74fd63ee3c0067b78f7df375ade9d96bafdbefde6a`.

### Bots propose; humans merge; existing CD remains unchanged

Dependabot proposal bodies own stable facts only: ecosystem, configured group, grouping rationale, base
revision, package deltas, touched manifests/locks, vouched advisory reason, responsible reviewer, and the
no-auto-merge statement. Native checks and the supply-chain summary exclusively own live status. No bot
auto-merges. After human approval and required checks, the current main-merge-triggered Railway and
Cloudflare behavior remains unchanged; this feature does not claim to deploy or to hold a separate release.

This resolves conflicts
`f72b4d767734d10719252c67e01a778ea288214e624a9445f93ab1387275147f` and
`7a81080cc381b4017fa532a1f463d9ce212e6b4e73a1b966d7006d1c2618a9bd`.

### Summaries are bounded; evidence is complete

The GitHub summary always shows aggregate verdict, revision, policy version, every declared check/surface,
and SBOM subject/digest links. Required actions collapse by unique `(owner, action_code,
review-or-expiry-state)`. A finding preview shows at most 20 rows and at most three examples per
`(check, rule_id)`, blockers before advisories. Overflow says: `Showing {shown} of {total} finding groups.
Open the sanitized report for complete evidence.` Complete findings remain in the sanitized machine report.

Each finding references `owner_id` and `action_code`; advisories also require rationale, approver,
`review_at`, and `expires_at`. Missing or overdue accountability blocks. This resolves conflicts
`10dcfae979a78a534494142ff215f908586dcdd69f4c3a43e5a07b5982f93c51` and
`0974a0565f8ec51c3cfbbe3729dd608b4059090cf6c39d04ba50f77b836cb748`.

## Technical resolutions

### The candidate toolchain must earn the pin

Node `24.19.0`, npm `11.17.0`, and Rust `1.98.0` are the candidate tuple, not an assumed compatible
fact. They become binding only when a same-SHA receipt records exact versions and lock hashes; clean
`npm ci` and Cargo `--locked`; API-contract, lint, typecheck, unit, e2e, default/Postgres Rust, production
build, and both Docker build results; unchanged lockfiles; and parity across `.nvmrc`, package metadata,
`rust-toolchain.toml`, CI, and Dockerfiles. Failure without weakening tests or changing product behavior is
a GATE-Z stop, not permission to restore moving channels.

This resolves conflicts
`0b8164cc8b5d92d246748bf6f7c83148c6b98006c96a31509ea278084a555ed6` and
`7dd322ef081bab91928e0bd551545122d6ebdfd83a4e6f2cfbe8509ec8d077bb`.

### Dependabot and CI-local policy are the supported baseline

Use native Dependabot for bounded npm, Cargo, Docker, and GitHub Actions proposals, with coupled families
grouped, majors isolated, and auto-merge absent. Exact Node/Rust pin changes use explicit reviewed
maintenance PRs. The current repository is private and user-owned, so CodeQL, hosted dependency review,
and GitHub artifact attestations are not required or claimed. There is no broad application-source SAST
claim in this feature; CodeQL becomes future work if repository eligibility changes.

This resolves conflicts
`c052fa60076464168820fa1f3c3a550ecd11936df202e4a0f25d4e081eba7342`,
`53db3f530cda47ae5ba5a44e38122bfea2cbad02bde6092f9ebf6e6391c54d39`,
`5f8aba1053ee4ce650a8f8977e6b277d0e676fdaf7b04b76521f7cb7ed127492`, and
`930f93d3cda5a4632933b7dc6366b339bb4742930bf2cd41a075d53f38ae2696`.

### Each surface has one classification authority

- npm advisories: `npm audit`;
- npm licenses: one exact-pinned inventory tool plus the checked-in policy normalizer;
- npm source/integrity: a checked-in package-lock guard;
- Rust advisories/licenses/sources/bans: `cargo-deny`;
- repository/history secrets: Gitleaks;
- Docker/workflow configuration and final API-image findings: Trivy;
- target SBOM generation: Syft;
- aggregate classification and publication: one checked-in normalizer.

Trivy does not duplicate npm/Cargo advisory or license authority, and no one tool is mislabeled source
SAST. Tool releases and acquisition checksums are exact. This resolves conflict
`b2dfc7315cfa3f50c35c4b48e3ed7ea811b2eb69758defaf64bebfb5175090b6`.

### Existing npm findings are a bounded remediation experiment

Test only the explicit reviewed resolution changes Nx→`brace-expansion@5.0.9` and
PostCSS→`nanoid@3.3.18`; record before/after paths, verify upstream constraints, preserve direct Nx 23.1.1,
run full and production audits and the complete current application/tooling/image battery, then rescan.
These are lock-graph changes and must be described as such. If either experiment fails, remove the
override and stop: this tranche does not have owner approval to carry a security advisory. Never run
`npm audit fix --force` and never automatically downgrade Nx.

This resolves conflicts
`2a19784414ff85bdab589f80d2dfd7afe5aef07dba57f9b606cb452f1cc9545d`,
`eea54d448de8dddf5f2810351d0a81728d492926d54c59b3973655fb900289dc`, and
`b75a3050c2a691371f7ae2af1faf9d904acdd69c28c2b08ec726cace4937f9c0`.

### Reproducibility and freshness are separate claims

The same revision and lockfiles must select identical toolchains and dependency identities. The same
classification additionally requires identical policy, scanner, and advisory-database revisions.
Scheduled runs intentionally allow newer security knowledge to make an unchanged dependency revision red.
An artifact SBOM is bound to the exact subject digest actually scanned; independent rebuilds are not
claimed bit-identical.

This resolves conflicts
`0daa0b904efa19a3e6adc5d066649f2b875526d6421424f7ac5a4bda27edfcf2` and
`ff0a1c7f12ea4eef412d0c0a114ce646b63572cb6c6e62a55604f14e98e5b1ea`.

### Normalization, sanitization, exceptions, and pins are structural

A checked-in strict report schema records revision/event, subject digest, declared scope, tool/version,
policy/advisory-data revision, completion state, findings, exceptions, and artifact hashes. Unknown or
malformed tool output blocks. Raw output is ephemeral and never uploaded. An allowlist publication adapter
removes snippets, environment/command values, authorization headers, credentialized URL user-info/query,
and unsafe artifact metadata before emitting JSON, annotations, summaries, logs, filenames, or SBOM
metadata. Canary poison tests cover every publication channel and emit `Some diagnostic text was redacted
before publication.` only when an actual redaction occurred.

Exception identity, scope, creation evidence, and expiry are immutable. Renewal is a new reviewed record
referencing its predecessor; in-place expiry extension, disguised scope broadening, missing predecessors,
expired records, or multiple active records for one finding/scope fail. No security exception is created in
this tranche.

Every external `uses:` reference is a full 40-character commit SHA (local actions/workflows excepted), and
every `FROM` uses an exact tag plus `sha256` manifest digest. Dependabot proposes SHA/digest movement;
humans approve. A parity guard and non-vacuous poison tests reject mutable action tags, floating images,
lock mutation, stale SHA, digest mismatch, prohibited source/license/advisory, scanner failure without
report, expired exception, and secret-bearing diagnostic input.

This resolves conflicts
`768f4a87fddd0ec12fa1ed3b392a147e7824ecfbfa0a80612d5d033103f61645` and the remaining technical asks.

## Boundary and documentation

This is `NO_UI_CHANGE`: no trader route, navigation, component, product copy, API, scoring, persistence,
or runtime behavior changes. The root README owns exact pinned setup plus a link; `docs/SUPPLY_CHAIN.md`
owns scope/limits, states, reproduction, remediation, ownership, degradation, and evidence interpretation;
`docs/DEPLOY_RUNBOOK.md` owns one prerequisite link immediately beside the host-rebuild limitation.

Per-check copy is exactly:

- `Passed — No policy violations or advisories were reported in the declared scope.`
- `Passed with advisories — No blocking policy violations were found. {count} allowed advisory finding(s) require review.`
- `Failed — {count} blocking policy violation(s) were found.`
- `Blocked — {check_name} did not produce a trustworthy result. No pass result is available.`
- `Skipped — {check_name} did not run. Authorized by {rule_id}. Reason: {reason}.`

An SBOM success sentence may be emitted only from normalized evidence and reads: `SBOM generated and
schema-validated for GitHub-built {target} at revision {sha}, subject digest {digest}.` It is immediately
followed by the Railway/Cloudflare limitation. Proposal bodies do not mirror transient GitHub status.

## Product decisions still open

None. The conditional implementation stop remains: if the candidate toolchain or either current advisory
cannot pass the full capability/remediation proof without product/runtime changes, GATE Z rather than an
unapproved exception.

## R3 exchange closure

- Architect: `ACCEPT` — no current GATE-Z blocker; the candidate tuple and SBOM support are capability
  gates, not presumed facts.
- PM: `ACCEPT` — no security advisory may proceed as an advisory in this conservative baseline; no owner
  ruling remains.
- UX: `ACCEPT` — copy is bound to the normalizer and sanitizer; no retained raw-tool channel is allowed.
