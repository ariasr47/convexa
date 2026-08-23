# INTERFACE CONTRACT — supply-chain-automation

**Spec:** `.spire/clusters/tech/contracts/supply-chain-automation/SPEC.md`  
**Posture:** **`NO_BACKEND_CHANGE` · `NO_UI_CHANGE`**  
**Boundary:** repository inputs → CI-local tools → normalized/sanitized evidence → GitHub checks/artifacts

This file is the integration truth for the supply-chain repository/CI surface. It adds no application
endpoint, request, response, auth rule, runtime environment variable, persistence shape, or trader-facing
surface. Any need to change the live application boundary is a GATE-Z amendment.

## 1. Ownership and paths

| Boundary | Canonical path/owner | Contract |
|---|---|---|
| Candidate bootstrap | `.supply-chain/candidate-toolchain.json`, `tools/supply-chain/bootstrap-candidate.*` | pre-pin isolated overlay; never a supported-selector authority |
| Node/npm selector | `.nvmrc`, `package.json`, `.npmrc` | exact values become supported only after accepted-revision receipt |
| Rust selector | `rust-toolchain.toml`, root/workspace `Cargo.toml` | one exact channel and inherited `rust-version` |
| Dependency locks | root `package-lock.json`, root `Cargo.lock` | sole authorities; nested Cargo lock forbidden |
| Tool acquisition | `.supply-chain/tools.json` | exact version + HTTPS source + SHA-256 for each non-bundled tool |
| Policy | `.supply-chain/policy.json`, `.supply-chain/license-baseline.json`, `deny.toml` | checked-in classification inputs |
| Ownership/actions | `.supply-chain/owners.json`, `.supply-chain/actions.json` | closed reference catalogs; findings cannot carry free-form ownership/action |
| Qualification commands | `.supply-chain/commands.json` | closed argv catalog; receipts publish IDs, never raw commands |
| Exceptions | `.supply-chain/exceptions.json` | immutable, exact, expiring; no security record in this tranche |
| Schemas | `.supply-chain/schemas/*.schema.json` | strict (`additionalProperties:false`) receipt/report/exception contracts |
| Adapters | `tools/supply-chain/` | parity, lock/source guards, tool runners, normalizer, sanitizer, renderer, poison harness |
| Proposal bot | `.github/dependabot.yml` | npm/Cargo/Docker/Actions proposals; no auto-merge |
| PR gate | `.github/workflows/ci.yml` | event-appropriate required checks and always-running aggregate |
| Artifact/freshness gate | dedicated `.github/workflows/supply-chain.yml` | default-branch subjects, schedule, manual diagnosis |
| Maintainer docs | `README.md`, `docs/SUPPLY_CHAIN.md`, `docs/DEPLOY_RUNBOOK.md` | concise setup → canonical runbook → bounded deploy prerequisite |
| Policy classification | security owner role | owns policy/exception approval; cannot self-remediate into advisory |
| Dependency/surface remediation | configured `owner_id` | performs the action referenced by `action_code` |
| Delivery decision | always-running aggregate | closed precedence; no stale/native-skipped substitution |

Implementations may split adapter modules internally, but there is one public command and one normalized
schema. Raw tool output is never a retained interface.

## 2. Commands and exit semantics

The root package scripts expose these stable commands:

| Command | Purpose | Exit 0 | Exit 1 | Exit 2 |
|---|---|---|---|---|
| `npm run supply-chain:candidate -- --base <sha>` | bootstrap exact candidate tools independently of live selectors, create isolated overlay workspace, run qualification | complete qualification candidate | completed candidate check failure | bootstrap/input/capability blocked |
| `npm run supply-chain:toolchain -- --mode accepted --qualification <safe-ref>` | post-accept exact-file/tool/lock/pin parity and binding receipt | accepted tuple bound | completed mismatch | missing/malformed qualification or tool/input blocked |
| `npm run supply-chain:policy -- --event <event> --path policy --run-key <hex>` | run applicable non-artifact authorities, normalize, sanitize, render | aggregate `pass` or permitted `pass_with_advisories` | aggregate `fail` | aggregate `blocked` or invalid invocation |
| `npm run supply-chain:artifacts -- --event <event> --path artifacts --run-key <hex>` | build named subjects once; scan API bytes; generate/validate associated dependency inventories and receipts | both subjects accepted | completed policy violation | missing/invalid/mismatched subject or tool failure |
| `npm run supply-chain:poison` | run accepting/rejecting fixtures through real guards/normalizer/sanitizer | every positive/negative oracle behaved as declared | any poison was accepted or valid fixture rejected | harness/configuration failure |
| `npm run supply-chain:verify -- --event <event>` | orchestrate the applicable commands and always emit an aggregate | `pass`/allowed advisory | `fail` | `blocked` |

`<event>` is exactly `pull_request | default_branch | schedule | workflow_dispatch`; `<path>` is exactly
`policy | artifacts`. Unknown values exit 2. `workflow_dispatch` defines one required choice input named
`path`, default `policy`, with those two options; the selected Git ref supplies `revision_sha` and no input
may override it. All commands run from the repository root and expose no waiver/ignore/fix/suppress flag.

Output locations are deterministic under an ignored run directory (for example
`.supply-chain/out/<revision>/<event>/`) until sanitized artifacts are copied to the runner artifact
staging directory. Raw tool results are ephemeral and excluded from uploads.

## 3. Toolchain qualification receipt

Candidate constants are Node `24.19.0`, npm `11.17.0`, and Rust `1.98.0`. Qualification is explicitly
two-phase so proposed selectors cannot vouch for themselves.

### 3.1 Pre-pin candidate workspace

`candidate-toolchain.json` is strict and never an accepted-selector file:

```json
{
  "schema_version": 1,
  "status": "candidate",
  "node": "24.19.0",
  "npm": "11.17.0",
  "rust": "1.98.0",
  "allowed_selector_paths": [
    ".nvmrc", ".npmrc", "package.json", "Cargo.toml", "apps/api/Cargo.toml",
    "libs/quant-engine/Cargo.toml", "rust-toolchain.toml", "apps/api/Dockerfile",
    "apps/dashboard/Dockerfile", ".github/workflows/ci.yml",
    ".github/workflows/conformance.yml", ".github/workflows/supply-chain.yml"
  ]
}
```

The path array is set-equality checked. An AST-aware patch guard permits only Node/npm engine/package-
manager fields, workspace/crate Rust-version fields, the Rust toolchain file, Docker `FROM` selectors, and
workflow `runs-on`/external `uses`/toolchain-selector scalars; any command, test, application, dependency,
permission, trigger, or other YAML/JSON/TOML field delta blocks. There is no `accepted` value; acceptance
exists only in the post-accept receipt.

1. Resolve `base_revision_sha` to a clean immutable Git tree before any selector change.
2. A bootstrap executable whose own version and SHA-256 are checked from `tools.json` reads
   `candidate-toolchain.json`, downloads/verifies exact Node/npm/Rust distributions into an OS temporary
   directory, and invokes them by absolute path. It must not read `.nvmrc`, `rust-toolchain.toml`, package
   engines, or a Docker `FROM` to select the candidate.
3. Create a temporary worktree/copy from `base_revision_sha`. Apply a candidate patch restricted to
   `.nvmrc`, `.npmrc`, `package.json`, root/workspace Cargo manifests, `rust-toolchain.toml`, live
   Dockerfiles, live workflows, and the pin manifest. Any other changed path blocks bootstrap.
4. Compute `candidate_patch_sha256`, Git-style `candidate_tree_sha256`, and
   `candidate_revision_id = sha256("sca-candidate-v1\0" + base_revision_sha + "\0" +
   candidate_patch_sha256 + "\0" + candidate_tree_sha256)`. Run the full check set in this workspace.
   Candidate parity means parity of this recorded candidate tree only; it says nothing about the base.
5. Delete the temporary workspace after its sanitized evidence is staged. The base worktree is unchanged.

The strict qualification receipt is:

```json
{
  "schema_version": 1,
  "receipt_kind": "toolchain_qualification",
  "base_revision_sha": "40 lowercase hex",
  "candidate_patch_sha256": "64 lowercase hex",
  "candidate_tree_sha256": "64 lowercase hex",
  "candidate_revision_id": "64 lowercase hex",
  "bootstrap": {
    "tool_id": "candidate-bootstrap",
    "version": "exact version",
    "sha256": "64 lowercase hex",
    "selection_source": "candidate-toolchain.json"
  },
  "candidate": {
    "node": "24.19.0",
    "npm": "11.17.0",
    "rust": "1.98.0"
  },
  "detected": {
    "node": "24.19.0",
    "npm": "11.17.0",
    "rust": "1.98.0"
  },
  "inputs": {
    "package_lock_sha256": "64 lowercase hex",
    "cargo_lock_sha256": "64 lowercase hex",
    "policy_sha256": "64 lowercase hex",
    "action_pin_set_sha256": "64 lowercase hex",
    "image_pin_set_sha256": "64 lowercase hex"
  },
  "parity": {
    "nvmrc": true,
    "package_metadata": true,
    "rust_toolchain": true,
    "crate_rust_version": true,
    "ci": true,
    "dockerfiles": true,
    "actions_full_sha": true,
    "images_tag_and_digest": true,
    "root_locks_only": true
  },
  "checks": [
    {
      "check_id": "closed identifier",
      "command_id": "closed command catalog identifier",
      "state": "pass|fail|blocked",
      "evidence_sha256": "64 lowercase hex"
    }
  ],
  "locks_unchanged": true,
  "complete": "boolean",
  "outcome": "pass|fail|blocked"
}
```

Required `check_id` values are exactly:

`npm_ci`, `cargo_locked`, `api_contract`, `format`, `lint`, `typecheck`, `node_tool_tests`,
`frontend_unit`, `shared_client_unit`, `playwright_e2e`, `dashboard_production_build`, `bundle_budget`,
`rust_default_tests`, `rust_postgres_tests`, `production_runtime_guardrails`, `postgres_release_safety`,
`rust_release_build`, `api_docker_build`, `dashboard_docker_build`, `application_conformance`, and
`score_tier_gate_fingerprint_identity`. `command_id` resolves through the checked-in command catalog; no
raw command string is published.

`commands.json` contains exactly one entry per required check:
`{command_id, executable, argv, working_directory}` with `additionalProperties:false`. `command_id` equals
the check ID; executable is a verified absolute candidate-tool path or repository `repo_path`; working
directory is a `repo_path`; `argv` has 0–64 tokens, each 1–240 bytes with no control, shell metacharacter
expansion, environment interpolation, URL credentials, or secret value. The bootstrap uses direct process
spawn with `shell:false`; duplicate/missing commands or an executable hash mismatch blocks.

### 3.2 Accepted-revision binding

After qualification passes, execution applies exactly the recorded patch to the reviewed branch. The
resulting Git commit is `accepted_revision_sha`; proposal/merge presence alone does not bind support. The
accepted revision first runs the full ordinary CI battery under normal selectors. Its always-running job
emits a separate receipt:

```json
{
  "schema_version": 1,
  "receipt_kind": "accepted_revision_ci",
  "accepted_revision_sha": "40 lowercase hex",
  "event": "pull_request|default_branch",
  "path": "policy",
  "subject_set_sha256": "SHA-256 of RFC 8785 canonical []",
  "run_key": "section 7 run key for this revision/event/path",
  "required_check_set_sha256": "64 lowercase hex",
  "checks": [
    { "check_id": "required section 3.1 ID", "state": "pass|fail|blocked", "evidence_sha256": "64 lowercase hex|null" }
  ],
  "complete": "boolean",
  "outcome": "pass|fail|blocked"
}
```

`required_check_set_sha256` hashes the RFC 8785 UTF-8 serialization of the lexicographically sorted unique
required check-ID array. A missing/duplicate/non-pass check or wrong standard §7 `run_key` rejects the CI
receipt. Only after that receipt exists does the post-accept aggregation command emit:

```json
{
  "schema_version": 1,
  "receipt_kind": "toolchain_binding",
  "accepted_revision_sha": "40 lowercase hex",
  "qualification_ref": "artifact:toolchain-qualification#/receipt",
  "qualification_sha256": "64 lowercase hex",
  "base_revision_sha": "40 lowercase hex",
  "candidate_revision_id": "64 lowercase hex",
  "accepted_selector_set_sha256": "64 lowercase hex",
  "candidate_selector_set_sha256": "same 64 lowercase hex",
  "accepted_ci_ref": "artifact:accepted-revision-ci#/receipt",
  "accepted_ci_sha256": "64 lowercase hex",
  "accepted_ci_run_key": "64 lowercase hex",
  "accepted_ci_required_check_set_sha256": "64 lowercase hex",
  "accepted_ci_complete": true,
  "accepted_ci_outcome": "pass",
  "detected": { "node": "24.19.0", "npm": "11.17.0", "rust": "1.98.0" },
  "locks": { "package": "64 lowercase hex", "cargo": "64 lowercase hex" },
  "locks_match_qualification": true,
  "parity": {
    "nvmrc": true,
    "package_metadata": true,
    "rust_toolchain": true,
    "crate_rust_version": true,
    "ci": true,
    "dockerfiles": true,
    "actions_full_sha": true,
    "images_tag_and_digest": true,
    "root_locks_only": true
  },
  "complete": "boolean",
  "outcome": "pass|fail|blocked"
}
```

The accepted selector-set hash must equal the candidate selector-set hash, the qualification artifact hash
and accepted-CI artifact hashes/refs must resolve, the CI run key must recompute for the same accepted
revision, its check-set hash must equal the contract set, locks must match, detected tools must equal the
candidate, and all CI/parity fields must pass. The binding receipt is therefore the join, not a substitute
for accepted-revision CI. Until it passes, documentation and summaries label the tuple
`Candidate — qualification pending` or
`Candidate — acceptance recheck pending`, never supported. Missing/duplicate checks, a false flag, changed
hash, or malformed identity blocks and triggers the capability stop; it never authorizes a moving channel.

## 4. Policy and tool manifest

### 4.1 Exact tool acquisition record

Each `.supply-chain/tools.json` entry is:

```json
{
  "tool_id": "candidate-bootstrap|npm|npm-license-inventory|npm-lock-guard|cargo-deny|gitleaks|trivy|syft|normalizer|sanitizer",
  "version": "exact non-moving version",
  "source_kind": "external_download|bundled_with_node|repository",
  "source_locator": "credential-free HTTPS URL or repo_path",
  "sha256": "64 lowercase hex",
  "platform": "linux-x64",
  "capabilities": ["one or more identifiers from section 4.2"]
}
```

External sources require credential-free HTTPS without query; repository tools name a `repo_path`, and npm
is `bundled_with_node` with its exact detected version and distribution hash. The implementation verifies
the exact release, archive/source checksum, local exit behavior, machine output,
and required capability before adding it. `latest`, channels/ranges, installer pipes, unauthenticated HTTP,
unverified archives, or a capability assertion unsupported by a poison fixture are invalid. Tool
acquisition failure is `blocked`. Required evidence runs on `ubuntu-24.04`/`linux-x64`; another local host
may invoke the checked command through a matching environment but is not a second supported policy-tool
platform.

### 4.2 Closed executable capability proof

Capability IDs are exactly:

`npm-audit.full-lock-json`, `npm-license.spdx-inventory`, `npm-lock.source-integrity`,
`cargo-deny.advisories-licenses-sources-bans`, `gitleaks.history-range-json`, `trivy.config-json`,
`trivy.api-image-digest-json`, `syft.api-lock-inventory-cyclonedx`, `syft.dashboard-lock-inventory-cyclonedx`,
`normalizer.strict-aggregate`, and `sanitizer.all-publication-channels`.

Every capability runs three committed fixtures through the real production adapter. The adapter exit
contract is exact: `0 = expected pass`, `1 = completed policy/oracle failure`, `2 = unavailable,
untrustworthy, or malformed evaluation`. Production commands expose no fixture/tool-path injection; the
poison harness injects only under its own test entrypoint.

| Capability | Pass trigger (`exit 0`) | Policy-fail trigger (`exit 1`) | Unavailable trigger (`exit 2`) |
|---|---|---|---|
| `npm-audit.full-lock-json` | minimal lock with no dependencies, reachable audit service, valid JSON zero | committed lock containing the exact known vulnerable-version fixture and matched advisory ID | empty cache + registry `http://127.0.0.1:9`; transport/error output cannot parse as findings |
| `npm-license.spdx-inventory` | fixture packages with exact MIT and dual SPDX expressions | seeded missing/unparseable/new expression rejected by policy | checksum-verified executable path absent |
| `npm-lock.source-integrity` | registry-integrity and in-workspace-link fixture | HTTP/git/alternate-registry/missing-integrity/traversal fixture | unreadable or malformed lock JSON |
| `cargo-deny.advisories-licenses-sources-bans` | clean locked fixture satisfies all four sections | one committed denied advisory/license/source/banned-duplicate case per section | empty advisory DB with network disabled for advisory probe, or malformed root lock |
| `gitleaks.history-range-json` | two-commit range with no canary | canary committed then deleted inside the tested range is still found | named base SHA absent from the fixture repository |
| `trivy.config-json` | pinned safe Dockerfile/workflow fixture | floating `FROM` plus mutable Action fixture | checksum-verified executable absent or unreadable machine output |
| `trivy.api-image-digest-json` | scratch fixture image addressed by digest with no finding seed | scratch image addressed by digest containing the documented Trivy secret canary | nonexistent image digest |
| `syft.api-lock-inventory-cyclonedx` | synthetic catalog from a fixture Cargo lock closure emits the exact required identities | remove one required seed, duplicate it, or inject an identity outside the computed closure | malformed synthetic catalog or Syft output not valid CycloneDX JSON |
| `syft.dashboard-lock-inventory-cyclonedx` | synthetic catalog from a fixture npm production closure emits the exact required identities | remove one seed, add an arbitrary identity, or associate the inventory with the wrong archive digest | unsafe archive validation or unreadable CycloneDX output |
| `normalizer.strict-aggregate` | complete valid check set resolves expected precedence | completed blocker resolves `fail` | unknown key/state, missing check, stale run key, or malformed report resolves `blocked` |
| `sanitizer.all-publication-channels` | `sanitizer.safe_publication`: safe catalog values publish, exit `0`, state `pass` | `sanitizer.policy_fail_preserved`: a normalized completed policy blocker publishes safely, exit `1`, state `fail` | `sanitizer.canary_publication_stop`: canary/header/URL/env/control/unsafe-name input publishes no unsafe byte, exit `2`, state `blocked` |

Each run emits one strict receipt:

```json
{
  "schema_version": 1,
  "receipt_kind": "capability_probe",
  "capability_id": "closed identifier above",
  "tool_id": "matching tools.json identifier",
  "tool_version": "exact version",
  "tool_sha256": "64 lowercase hex",
  "fixture_id": "exact fixture ID from the capability table",
  "fixture_sha256": "64 lowercase hex",
  "expected_adapter_exit": 0,
  "actual_adapter_exit": 0,
  "expected_state": "pass|fail|blocked",
  "actual_state": "pass|fail|blocked",
  "raw_exit_code": 0,
  "raw_output_sha256": "64 lowercase hex",
  "sanitized_evidence_ref": "artifact:capability-receipts#/receipts/0",
  "probe_verdict": "pass|capability_stop",
  "publication_canary_leaked": "boolean",
  "complete": true
}
```

There must be exactly three receipts per capability with exits `0/1/2` and matching states
`pass/fail/blocked`. Non-sanitizer fixture IDs are `<capability>.pass`, `<capability>.policy_fail`, and
`<capability>.unavailable`; the sanitizer uses its three exact IDs above. Its canary-stop receipt has
`expected_state=actual_state=blocked`, `expected_adapter_exit=actual_adapter_exit=2`,
`publication_canary_leaked=false`, and `probe_verdict=pass`: the blocked state is the expected safe adapter
behavior, not the harness verdict. If any canary byte leaks, the harness still exits `2` but records
`publication_canary_leaked=true`, `probe_verdict=capability_stop`, invalidates the three-receipt set, and
stops at GATE Z. Other receipts set `publication_canary_leaked=false`. Raw output is hashed in ephemeral
storage, not published. Missing/duplicate probes, wrong fixture/tool hash, wrong exit/state, a vacuous fail
fixture, or an unproved required capability is `blocked` and a GATE-Z stop.

### 4.3 One authority per surface

Closed check IDs and authorities are:

| `check_id` | Authority | Declared scope | Must not classify |
|---|---|---|---|
| `npm_advisories` | npm audit | full root npm lock; production subset also reported | licenses, source, Cargo |
| `npm_licenses` | pinned inventory + normalizer | full root npm lock | advisories, Cargo |
| `npm_sources` | lock guard | npm resolved URLs, integrity, workspace links | advisory/license risk |
| `cargo_policy` | cargo-deny | root Cargo lock: advisories/licenses/sources/bans | npm or image OS |
| `repository_secrets` | Gitleaks | current revision and applicable PR history/range | dependency/license risk |
| `configuration` | Trivy | live Dockerfiles and GitHub workflows | application source SAST or npm/Cargo policy |
| `api_image` | Trivy | exact API image digest | dashboard archive or source SAST |
| `api_dependency_inventory` | Syft + validator | Cargo lock-derived identities associated with exact API image digest | image-byte, dashboard, or source completeness |
| `dashboard_dependency_inventory` | Syft + validator | npm lock-derived identities associated with exact dashboard archive digest | archive-byte, API, or source completeness |

The policy normalizer rejects a duplicate authority or a report that claims an excluded scope.

### 4.4 License continuity

`.supply-chain/license-baseline.json` contains the exact package/crate, version, ecosystem, normalized SPDX
expression, origin lock hash, and any notice/attribution obligation observed in the committed current
graphs. This is a continuity inventory, not legal approval. Exact unchanged entries pass; unchanged
obligations may be `pass_with_advisories` only with complete accountability. New, changed, removed without
an accompanying dependency removal, missing, unknown, unparseable, or overdue obligation is `fail`.

### 4.5 npm/Cargo source policy

- npm registry packages: `https://registry.npmjs.org/` and integrity are required.
- npm workspace links: target must resolve inside a declared root workspace.
- npm HTTP, git, alternate registry, arbitrary tarball, escaped link, or missing integrity is denied.
- Cargo registry packages: crates.io index plus checksum are required; workspace-local paths must resolve
  inside a declared workspace member.
- Cargo git/alternate registry/checksum absence/wildcard dependency is denied.
- `cargo-deny` also denies yanked/advisory entries and policy-defined duplicate critical crypto versions.

## 5. Normalized policy report

Every object described in §§3–8 has `additionalProperties:false`; every array has explicit item schema,
`uniqueItems:true` where scalar, and the cardinality stated below. Shared bounded formats are:

- `safe_id`: `^[a-z0-9][a-z0-9._-]{0,63}$`.
- `sha256`: `^[a-f0-9]{64}$`; Git SHA: `^[a-f0-9]{40}$`; digest: `^sha256:[a-f0-9]{64}$`.
- `repo_path`: 1–240 UTF-8 bytes, `/` separators, no leading `/`, drive/URI prefix, backslash, control,
  empty segment, or `.`/`..` segment; it must resolve inside the checked-out repository.
- `package_subject`: ecosystem plus exact package/version from the normalizer, at most 240 UTF-8 bytes,
  no CR/LF/control/URL credentials; `digest_subject` is the digest grammar above.
- `safe_text`: 1–512 UTF-8 bytes, no CR/LF/control/ANSI/workflow-command prefix; it must be rendered from
  a closed `message_code` template plus typed parameters, never copied from tool output.
- `evidence_ref`: `^artifact:[a-z0-9][a-z0-9._-]{0,63}(#/(?:[A-Za-z0-9._~-]+/)*[A-Za-z0-9._~-]+)?$`,
  at most 256 bytes. Reports contain no filesystem path or URL evidence pointer.
- `artifact_name`: `^[a-z0-9][a-z0-9._-]{0,95}$`, not equal to `.`/`..`, with no secret-derived text, SHA prefix
  shorter than 12 hex, or user/tool diagnostic. All evidence artifacts retain for exactly 30 days.

`reason_params`/`message_params` have `additionalProperties:false` and may contain only `check_name`,
`rule_id`, `reason_code`, `target` (`safe_id`), `count`, `shown`, `total` (nonnegative integers), `sha`,
`evidence_short_sha`, `current_short_sha` (hex), and `digest` (digest grammar). The checked-in message
catalog declares the exact required subset for each code; missing or surplus parameters block.

Only a schema-valid sanitized report is retained. Top-level shape:

```json
{
  "schema_version": 1,
  "report_kind": "supply_chain_policy",
  "revision_sha": "40 lowercase hex",
  "event": "pull_request|default_branch|schedule|workflow_dispatch",
  "path": "policy|artifacts",
  "run_key": "64 lowercase hex",
  "policy_sha256": "64 lowercase hex",
  "created_at": "RFC3339 UTC timestamp",
  "retention_days": 30,
  "complete": true,
  "aggregate": "pass|pass_with_advisories|fail|blocked",
  "toolchain": {
    "node": "exact version",
    "npm": "exact version",
    "rust": "exact version"
  },
  "checks": [],
  "findings": [],
  "exceptions": ["safe exception_id references"],
  "subjects": [],
  "redaction": {
    "count": 0,
    "kinds": ["snippet|authorization|url_userinfo|url_query|environment|command|filename|control_character"]
  },
  "artifacts": []
}
```

Each `checks[]` item is:

```json
{
  "check_id": "closed identifier",
  "authority": "closed authority identifier",
  "required": true,
  "scope": ["one or more repo_path, package_subject, or digest_subject values"],
  "tool": "exact tool identifier",
  "tool_version": "exact version",
  "advisory_data_revision": "string|null",
  "state": "pass|pass_with_advisories|fail|blocked|skipped",
  "completion": "complete|failed_to_start|timed_out|unavailable|malformed|partial|authorized_skip",
  "rule_id": "safe_id|null",
  "reason_code": "safe_id|null",
  "reason_params": { "closed_template_parameter": "bounded typed value" },
  "finding_count": 0,
  "evidence_sha256": "64 lowercase hex|null"
}
```

Each `findings[]` item is:

```json
{
  "finding_id": "safe_id authority-stable exact identifier",
  "check_id": "closed identifier",
  "rule_id": "closed policy rule",
  "classification": "blocker|advisory",
  "subject_kind": "repo_path|package|digest",
  "subject": "value matching its shared bounded format",
  "message_code": "safe_id closed template",
  "message_params": { "closed_template_parameter": "bounded typed value" },
  "owner_id": "safe_id resolving through owners.json",
  "action_code": "safe_id resolving through actions.json",
  "evidence_ref": "safe artifact-local pointer",
  "rationale": "string|null",
  "approver_id": "string|null",
  "review_at": "RFC3339 date|null",
  "expires_at": "RFC3339 date|null",
  "exception_id": "string|null"
}
```

Each `subjects[]` item is:

```json
{
  "subject_id": "api-production-image|dashboard-distribution-archive",
  "subject_kind": "oci_image|file_archive",
  "digest": "sha256:<64 lowercase hex>",
  "revision_sha": "40 lowercase hex",
  "run_key": "64 lowercase hex",
  "build_run_id": "decimal GitHub run id as string",
  "source_inputs_sha256": "64 lowercase hex",
  "scan_artifact_id": "safe_id|null",
  "dependency_inventory_artifact_id": "safe_id",
  "inventory_receipt_artifact_id": "safe_id"
}
```

Each `artifacts[]` item is:

```json
{
  "artifact_id": "safe_id",
  "kind": "policy_report|capability_receipts|toolchain_receipt|scan_report|component_oracle|subject_archive|dependency_inventory|dependency_inventory_receipt|summary",
  "file_name": "artifact_name",
  "media_type": "application/json|text/markdown|application/vnd.cyclonedx+json|application/x-tar",
  "sha256": "64 lowercase hex",
  "size_bytes": "integer 1..1073741824",
  "created_at": "RFC3339 UTC timestamp",
  "retention_days": 30,
  "expires_at": "created_at plus exactly 30 days"
}
```

`subjects[]` is empty for policy-only events and contains exactly the event-required closed subjects for an
artifact path. Every referenced artifact ID exists exactly once, matches kind/media type, shares run key
through its containing report, and has matching bytes/hash/retention. `exceptions[]`, owner IDs, action IDs,
and artifact IDs are unique and must resolve.

Check/authority/tool IDs resolve through §§4.2–4.3 and `tools.json`; tool versions are exact and at most 64
bytes. Advisory-data revisions are null only when the tool cannot supply one and policy permits that
surface; otherwise they are `safe_text` ≤128 bytes. Finding rationale is `safe_text`; approver IDs resolve
through owners; timestamps are RFC3339 UTC. Evidence refs resolve to the same report's artifact table and
their JSON Pointer target must exist.

`.supply-chain/owners.json` contains `{owner_id, display_name, github_login}` entries: IDs are `safe_id`,
display names are `safe_text` ≤64 bytes, and logins match `^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$`.
`.supply-chain/actions.json` contains exactly these action codes with one `safe_text` template each:
`upgrade_dependency`, `replace_dependency`, `repair_policy_input`, `restore_allowed_source`,
`refresh_tool_data`, `rerun_current_revision`, `rebuild_subject`, `repair_sanitizer`, and
`review_license_obligation`. Unknown/unresolved references block.

Rules:

- A `blocker` requires owner/action/evidence and forces check `fail` unless evaluation itself is
  untrustworthy, in which case check/aggregate are `blocked`.
- An `advisory` additionally requires rationale, approver, review and expiry; it is permitted only for a
  current-baseline non-security notice/attribution obligation.
- Security findings always have `classification:blocker` and `exception_id:null` in this tranche.
- `finding_count` must equal the check's findings. Zero is valid only for completed `pass`.
- `skipped` requires `completion:authorized_skip`, `rule_id`, `reason_code`, and bounded parameters, and is illegal for a required
  surface on an applicable event.
- `complete:false`, an absent declared check, stale SHA, unknown key/state, missing evidence, or overdue
  accountability forces aggregate `blocked`.
- Aggregate precedence is `blocked`, then `fail`, then `pass_with_advisories`, then `pass`.

## 6. Exception registry

The registry root is `{ "schema_version": 1, "exceptions": [] }`. Each possible non-security record is:

```json
{
  "exception_id": "immutable unique identifier",
  "predecessor_id": "string|null",
  "finding_id": "exact non-glob finding identifier",
  "ecosystem": "npm|cargo|image|configuration|license",
  "package": "exact package or null",
  "version_or_range": "exact affected version/range or null",
  "dependency_path": ["exact path entries"],
  "surface": "exact declared surface",
  "rule_id": "exact policy rule",
  "rationale": "non-empty",
  "compensating_control": "non-empty",
  "owner_id": "closed configured owner role",
  "approver_id": "closed configured approver role",
  "created_at": "RFC3339 date",
  "review_at": "RFC3339 date",
  "expires_at": "RFC3339 date",
  "intended_fixed_version": "exact version or null"
}
```

Creation identity/scope/dates are immutable. Renewal creates a new ID naming the immediately preceding
record; the predecessor must exist and be inactive. In-place expiry extension, broader identity/scope,
multiple active records for one finding/scope, missing predecessor, expiration, globbed ID/package, or an
advisory ID not exactly matching the finding blocks. The initial shipped registry contains no security
exception. Adding one is a GATE-Z owner decision, not an execution-lane choice.

IDs/rules/owners use `safe_id`; package/path/surface values use the §5 bounded union; dependency paths have
1–64 exact package subjects; rationale/compensating control are `safe_text`; approver resolves through the
owner catalog; dates are UTC and satisfy `created_at < review_at <= expires_at <= created_at + 30 days`.
`version_or_range` is the scanner-vouched exact affected range, at most 128 bytes, without glob. Every
field is required except the explicitly nullable ones shown, and every registry item is unique by ID and
active `(finding_id, surface, package, version_or_range)` tuple.

## 7. Event matrix and required surfaces

| Event | Required checks | Artifact subjects | Accepted aggregate |
|---|---|---|---|
| `pull_request` | toolchain/action/image/lock parity; npm advisory/license/source; Cargo policy; repository secrets; applicable config; mutation/poison; existing CI battery | none | `pass` or license-only `pass_with_advisories` |
| `default_branch` | all applicable PR checks plus artifact build, API byte scan, associated dependency inventories, and receipts | API image and dashboard dist archive, built once for this SHA | `pass` or license-only `pass_with_advisories` |
| `schedule` | time-varying npm/Cargo advisory and repository-secret/config refresh on current default SHA; aggregate/report | none unless explicitly rebuilding through the default-branch artifact path | `pass` or license-only `pass_with_advisories` |
| `workflow_dispatch` + `path=policy` | complete policy matrix for selected current ref | none | `pass` or license-only `pass_with_advisories` |
| `workflow_dispatch` + `path=artifacts` | complete policy matrix plus fresh artifact build, API byte scan, associated dependency inventories, and receipts | both closed subjects | `pass` or license-only `pass_with_advisories` |

An always-running aggregate job depends on every applicable job with `if: always()` semantics and reads
their current-revision sanitized receipts. Missing/native-skipped/stale jobs become `blocked`. Schedule red
makes the current default revision non-releaseable and creates fresh evidence; it does not mutate or
reinterpret old receipts.

The join identity is exact. `subject_set_sha256` is SHA-256 of RFC 8785-canonical JSON containing the
sorted required subject IDs (`[]` for policy-only). `run_key = sha256("sca-run-v1\0" + event + "\0" +
revision_sha + "\0" + path + "\0" + subject_set_sha256)`. Every child receipt and the aggregate carries
all five values. The aggregator rejects a missing/duplicate child, another workflow run/revision/path,
wrong subject set, or recomputed-key mismatch. `workflow_dispatch` uses only the selected ref's
`github.sha`; there is no user-supplied SHA or subject override.

Fixed paths are `pull_request=policy`, `schedule=policy`, and `default_branch=artifacts`; only
`workflow_dispatch` reads the closed `path` input. An artifacts path includes the full policy path before
subject evidence, so it cannot produce an artifact-only pass.

## 8. Associated lock-derived dependency inventories

### 8.1 Closed subject associations

These are **CycloneDX lock-derived dependency inventories associated with named subject digests**. Syft
reads only the deterministic synthetic catalogs derived from the canonical locks; it does not read,
observe, scan, or catalog the API-image or dashboard-TAR bytes. The digest is an association/join key, not
a claim that inventory components were discovered in the subject. Trivy alone scans the actual API-image
bytes. Dashboard TAR validation proves archive identity and safety, not component presence in its bytes.

| `subject_id` | `subject_kind` | Identity | Closed component families |
|---|---|---|---|
| `api-production-image` | `oci_image` | immutable `sha256:<64 hex>` from the one GitHub build | `convexa-workspace`, `cargo-normal-build` |
| `dashboard-distribution-archive` | `file_archive` | SHA-256 of the exact TAR below | `convexa-workspace`, `npm-production-closure` |

The dashboard container and a root/source inventory are not subjects. Neither dependency inventory may be labeled
repository-complete, vulnerability-free, license-compliant, signed, attested, shipped, deployed, or
production provenance. API OS-package observation and risk remain in the digest-bound Trivy report; OS
packages are not silently mixed into the lock-derived application-dependency inventory.

### 8.2 Dashboard archive format

The archive is an uncompressed POSIX ustar TAR of `apps/dashboard/dist` under one `dist/` prefix. Entries
are UTF-8 bytewise sorted and are regular files/directories only; empty directories are omitted. Headers
use `mtime=0`, `uid=gid=0`, empty owner/group names, directory mode `0755`, file mode `0644`, and no PAX/GNU
extensions. The archive contains no absolute path, `.`/`..`/empty segment, backslash, duplicate normalized
path, symlink, hardlink, device, FIFO, socket, or member outside `dist/`.

Validation parses every header before extraction, enforces the rules and declared sizes, extracts into a
new OS-temporary empty directory without following links, recomputes each file SHA-256, and then computes
the TAR-byte digest used as the subject identity. A traversal/link/device poison blocks before extraction.

### 8.3 Canonical component identity oracle

The oracle derives identities from canonical locks; it does not trust finding count or Syft presence.

- API: run Cargo metadata locked for `api-rust`, Linux target, Postgres feature; start at `api-rust` and
  traverse only normal/build dependency kinds. The workspace family is
  exactly `api-rust@0.1.0` and `quant-engine@0.1.0`; the normal/build family is the remaining traversal.
  Required seeds are `api-rust`, `quant-engine`, `axum`, `tokio`, `sqlx`, and `reqwest`.
- Dashboard: from lockfile-v3 `packages`, start with the production dependency names in root
  `package.json`, workspace `@convexa/dashboard`, and its workspace-reachable `@convexa/api`; traverse
  declared dependency edges only, excluding packages reachable solely through dev dependencies. Workspace family is
  exactly `@convexa/dashboard@0.0.1` and `@convexa/api@0.0.1`; required seeds also include `react`,
  `react-dom`, `react-router-dom`, `@mui/material`, `@emotion/react`, `recharts`, and `openapi-fetch`.

Every expected and emitted component is normalized to exactly this object; additional keys are forbidden:

```json
{
  "family": "convexa-workspace|cargo-normal-build|npm-production-closure",
  "ecosystem": "cargo|npm",
  "name": "exact decoded lock/manifest package name",
  "version": "exact decoded lock/manifest version",
  "provenance": {
    "kind": "registry|workspace",
    "source": "exact decoded credential-free lock source or workspace",
    "integrity": "exact decoded registry checksum/SRI|null",
    "path": "repo_path|null",
    "manifest_sha256": "64 lowercase hex|null"
  }
}
```

Names, versions, sources, and integrity values are the decoded JSON/TOML strings with no case folding or
Unicode normalization; invalid Unicode, control characters, credential-bearing sources, or a value beyond
the §5 bounded grammar blocks. Registry provenance requires `source` and `integrity` and requires null
`path`/`manifest_sha256`. Workspace provenance requires `source="workspace"`, a safe repository-relative
manifest `path`, its byte SHA-256, and null `integrity`.

Canonicalization is exact: serialize each identity object with RFC 8785 to UTF-8 bytes, sort those byte
strings in unsigned lexicographic byte order, place the corresponding objects in that order in one JSON
array, serialize the array with RFC 8785 to UTF-8, and SHA-256 those bytes. No newline or delimiter is
added. The lowercase hex result from the lock closure is `component_oracle_sha256`; applying the identical
procedure to normalized Syft components yields `component_identity_set_sha256`. Each component's `bom-ref`
is `urn:convexa:component:sha256:` plus the lowercase SHA-256 of that component's individual RFC 8785
UTF-8 identity bytes and is unique.

A deterministic temporary catalog containing only the canonical lock identities is presented to Syft.
The validator requires exact hash and set equality: zero components, a missing required seed, duplicate
identity, arbitrary extra identity, wrong family, or provenance mismatch is `fail`. The normalizer may
reorder/map safe fields but may not synthesize a component Syft omitted. Remove-one-seed, add-arbitrary,
duplicate, zero, and cross-subject mutations prove the oracle is non-vacuous.

### 8.4 Associated inventory receipt

```json
{
  "schema_version": 1,
  "receipt_kind": "associated_dependency_inventory",
  "subject_id": "api-production-image|dashboard-distribution-archive",
  "subject_kind": "oci_image|file_archive",
  "subject_digest": "sha256:<64 lowercase hex>",
  "revision_sha": "40 lowercase hex",
  "run_key": "64 lowercase hex",
  "build_run_id": "sanitized GitHub run identifier",
  "builder": "github-actions-ubuntu-24.04",
  "generator": {
    "name": "syft",
    "version": "exact version"
  },
  "inventory_basis": "lock_derived",
  "association_kind": "named_subject_digest",
  "subject_bytes_observed_by_generator": false,
  "format": "CycloneDX 1.6 JSON dependency inventory",
  "schema_version_declared": "1.6",
  "inventory_sha256": "64 lowercase hex",
  "policy_sha256": "64 lowercase hex",
  "validation": "pass|fail|blocked",
  "component_families": ["exact two identifiers declared for target"],
  "component_count": "positive integer",
  "component_oracle_sha256": "64 lowercase hex",
  "component_identity_set_sha256": "same 64 lowercase hex",
  "required_seed_count": "positive integer",
  "required_seeds_present": true,
  "source_inputs_sha256": "64 lowercase hex",
  "byte_scan_evidence_sha256": "64 lowercase hex|null",
  "archive_validation_sha256": "64 lowercase hex|null",
  "complete": true
}
```

For `api-production-image`, `byte_scan_evidence_sha256` is the Trivy report over the exact image digest and
`archive_validation_sha256` is null. For `dashboard-distribution-archive`, the byte-scan field is null and
`archive_validation_sha256` hashes the successful §8.2 validation receipt. The validator rejects a wrong
run/revision/association/digest, generator, basis, policy, schema, inventory/source/evidence hash, family,
nonpositive count, seed flag/count, oracle/set inequality, missing artifact, malformed document, any true
`subject_bytes_observed_by_generator`, or `complete:false`. Build, applicable byte scan/archive validation,
inventory association, receipt, summary, and upload use the same subject digest; no rebuild occurs.

Successful normalized copy is exactly:

`CycloneDX lock-derived dependency inventory generated and schema-validated for dependencies associated with GitHub-built {target} at revision {sha}, subject digest {digest}.`

It is immediately followed by:

`Syft did not observe or catalog the subject bytes; the digest is an association key.`

and then:

`This evidence does not identify bytes independently rebuilt or deployed by Railway or Cloudflare.`

## 9. Dependabot contract

All update entries use `version: 2`, weekly cadence, and `open-pull-requests-limit: 5`. Ecosystems and
directories are npm `/`, Cargo `/`, GitHub Actions `/`, Docker `/apps/api` and `/apps/dashboard`.

Routine group membership is exact/non-overlapping:

| Group | Ecosystem | Include | Exclude/rule |
|---|---|---|---|
| `npm-react-runtime` | npm | `react`, `react-dom`, `react-router-dom`, `recharts` | major updates excluded |
| `npm-mui-emotion` | npm | `@mui/*`, `@emotion/*` | major updates excluded |
| `npm-nx` | npm | `nx`, `@nx/*` | atomic family; major updates excluded |
| `npm-vite-vitest` | npm | `vite`, `vitest`, `@vitejs/*`, `@vitest/*` | `@nx/*` excluded; major updates excluded |
| `npm-playwright-testing` | npm | `@playwright/*`, `@testing-library/*` | major updates excluded |
| `cargo-axum-runtime` | Cargo | `axum`, `tokio`, `tokio-stream`, `tower`, `tower-http`, `futures-util` | major updates excluded |
| `cargo-http-tls` | Cargo | `reqwest`, `rustls*`, `tokio-tungstenite`, `url` | major updates excluded |
| `cargo-sqlx-postgres` | Cargo | `sqlx`, `sqlx-*` | major updates excluded |
| `cargo-crypto-auth` | Cargo | `aes-gcm`, `argon2`, `hmac`, `sha1`, `sha2`, `subtle`, `rand` | major updates excluded |
| `github-actions` | GitHub Actions | all external Actions | execute only full SHA; readable release comment retained |

Docker proposal entries remain scoped to the relevant Dockerfile directory; builder and runtime base
movements must remain separately reviewable where native grouping cannot prove a coupled movement.
Unmatched dependencies get individual proposals. Major movements are individual. No group is named
`miscellaneous` or mixes ecosystems. Exact Node/Rust pin changes are human maintenance PRs.

Only fields native Dependabot configuration controls are contractual: group/pattern/update-type rules,
weekly schedule, open-PR limit, ecosystem-specific commit-message prefix, static labels
`dependencies`, `ecosystem:<npm|cargo|docker|actions>`, and `owner:<safe owner_id>`, plus configured
reviewers when a current catalog login is valid. The required check summary links the static
`docs/SUPPLY_CHAIN.md#dependency-proposals` review instructions. Dependabot's generated title/body/package
deltas remain bot-owned and are not parsed or rewritten by Convexa. No post-creation updater, pull-request
write token, custom-body promise, or exact body sentence exists. Absence of auto-merge is enforced by
configuration/workflow scan; live policy/dependency-inventory status remains exclusively in native checks and summary.

## 10. Summary and publication contract

The summary order is fixed:

1. aggregate verdict and exact lead copy;
2. full revision, policy hash/version, event, and declared scope;
3. one row for every declared check/surface;
4. required actions collapsed by `(owner_id, action_code, review-or-expiry-state)`;
5. bounded finding preview;
6. dependency-inventory association/digest/evidence links when applicable;
7. provenance: exact toolchains, tools, advisory-data revisions, workflow run.

At most 20 preview rows and at most three examples per `(check_id, rule_id)` appear; blockers precede
advisories. Overflow uses exactly: `Showing {shown} of {total} finding groups. Open the sanitized report
for complete evidence.` The report—not the summary—contains every finding.

Per-check lead copy is exactly:

- `Passed — No policy violations or advisories were reported in the declared scope.`
- `Passed with advisories — No blocking policy violations were found. {count} allowed advisory finding(s) require review.`
- `Failed — {count} blocking policy violation(s) were found.`
- `Blocked — {check_name} did not produce a trustworthy result. No pass result is available.`
- `Skipped — {check_name} did not run. Authorized by {rule_id}. Reason: {reason}.`

The sanitizer allowlists fields from the normalized schemas. It never publishes raw snippets/matches,
environment values, command arguments containing values, authorization headers, URL user-info/query,
credential-bearing locations, unsafe artifact names, or raw tool output. It replaces no value with a
misleading clean claim. `Some diagnostic text was redacted before publication.` appears if and only if
normalized `redaction.count > 0`.

### 10.1 Closed publication channels

| Channel | Only permitted input/output | Raw-bypass prevention |
|---|---|---|
| GitHub runner step log | wrapper emits one bounded `SCA_RESULT <check_id> <state> <artifact_name>` line or generic blocked code | child processes are spawned with piped stdout/stderr into ephemeral files; never `inherit`, `tee`, `set -x`, env dump, or direct tool invocation in YAML |
| GitHub job summary | Markdown rendered only from the sanitized report/message catalog | write one generated file to `GITHUB_STEP_SUMMARY`; no raw interpolation |
| GitHub annotations | optional rows rendered from safe `repo_path`, code, and params | percent-encode `%`, CR and LF; omit annotation when no safe tool-supplied repo path exists; raw tools cannot emit workflow commands |
| Sanitized policy JSON | strict §5 object | publication adapter allowlist only; raw outputs stay outside staging |
| Receipts/capability evidence | strict §§3–8 objects | safe refs/hashes only, no raw body or command |
| CycloneDX dependency inventory | schema-valid lock-derived components that pass §8 oracle; sanitized metadata properties | no subject-byte observation claim, tool diagnostics, environment, credential-bearing URL, or arbitrary component property |
| Uploaded artifact name/metadata | `artifact_name`, fixed kind, hash/size/retention from §5 | staging directory contains only schema-validated files; upload uses explicit files, never a directory glob |
| Dependabot PR title/body | native Dependabot output only | Convexa passes no scanner/tool text into it and owns no updater token |

There is no retained raw-log or captured-excerpt channel. Diagnostic meaning is a closed
`message_code`/parameter record; if a tool cannot be normalized without publishing raw text, that channel
is suppressed and the check is `blocked`. GitHub masking is defense-in-depth, not sanitization evidence.

The poison harness creates its canary inside the child fixture file (never command arguments, environment,
workflow YAML, or artifact name), intercepts wrapper stdout/stderr, and scans every staged file plus the
rendered summary/annotation stream. A structural workflow test rejects direct scanner execution, inherited
stdio, `tee`, shell tracing, environment printing, broad upload globs, and unsafe workflow-command writes.
The complete canary/header/credentialized-URL values must be absent byte-for-byte. Any unsafe byte is a
failed capability probe and GATE-Z stop, not a redacted success.

## 11. Failure and stop semantics

| Condition | Result | Permitted recovery |
|---|---|---|
| Completed prohibited finding | `fail` | change reviewed input/policy separately, then complete rerun |
| Tool/input/service/report unavailable, malformed, timed out, partial, or untrustworthy | `blocked` | repair capability/input/service, then complete rerun |
| Required job missing, stale, failed to start, or native-skipped | aggregate `blocked` | run current applicable path; no cached substitute |
| Candidate tuple fails full battery | GATE-Z stop | amend the selected exact tuple with evidence; never use moving channel |
| Either named current npm advisory cannot be remediated by the bounded experiment | GATE-Z stop | owner decides a later path; no exception in this tranche |
| Required tool cannot satisfy exact local capability/exit/schema/checksum requirements | GATE-Z stop | replace tool through amendment or narrow feature with owner approval |
| Sanitizer poison appears in any retained channel | GATE-Z stop | repair publication boundary and rerun every channel |
| Dependency inventory cannot associate the exact named subject/expected component family | GATE-Z stop | repair lock/oracle/association boundary; do not omit the target |
| Aggregate cannot always decide after upstream failure | GATE-Z stop | repair workflow architecture; native skip cannot authorize |

No command uses `continue-on-error` to convert required evidence into success. Diagnostic retries may retry
transport, but only a fresh complete result counts. Scanners are read-only; mutation of a manifest/lock
rejects the run. Workflow reports and artifacts contain no application runtime secret, secret ciphertext,
or environment dump.

## 12. Explicit non-interfaces

- No HTTP, SSE, WebSocket, browser storage, database, application config, or generated API-client change.
- No application-source SAST coverage claim.
- No deployment action, release hold, provenance signature, attestation, or host-artifact identity claim.
- No dashboard-container or root/source dependency-inventory requirement.
- No security exception and no auto-remediation/auto-merge path.

## Conformance spec

**`NO_BACKEND_CHANGE`.** There is no new or changed live endpoint to encode in a conformance JSON block.
The unchanged application boundary remains machine-checked by the promoted specs:

- `.spire/clusters/tech/state/conformance/public-surface.json`
- `.spire/clusters/tech/state/conformance/auth-gated.json`
- `.spire/clusters/tech/state/conformance/scanner.json`
- `.spire/clusters/tech/state/conformance/api-contract-generation.json`

GATE Q re-runs the applicable existing specs and proves no application contract delta. The new
machine-checkable interfaces are the strict repository/CI schemas and commands defined above. If execution
discovers an application endpoint/payload change is required, this posture is false and work stops for a
GATE-Z amendment rather than inventing an endpoint here.
