# supply-chain-automation — implementation plan

**Goal:** make Convexa's dependency and build supply chain exact, reviewable, fail-closed, and capable
of producing safe machine evidence without changing application, API, scoring, persistence, deployment,
or trader behavior.

**Architecture:** repository-owned Node adapters wrap one pinned authority per policy surface, reduce
ephemeral tool output into strict JSON, sanitize it once, and feed an always-running GitHub aggregate.
The API image and deterministic dashboard TAR are built once on the artifact path; Trivy observes only
the API bytes, while Syft emits explicitly lock-derived inventories whose receipts associate them with
the named digests. Toolchain selectors are a candidate overlay until a separate accepted-revision CI
receipt joins the qualification proof; no selector becomes supported merely by appearing in a file.

**Stack:** Node `24.19.0` candidate; npm `11.17.0` candidate; Rust `1.98.0` candidate; Nx 23; Node
built-ins plus exact locked schema/format parsers; npm audit; an exact npm license inventory tool;
`cargo-deny`; Gitleaks; Trivy; Syft; Docker Buildx/OCI layout; GitHub Actions; native Dependabot;
CycloneDX 1.6 JSON; RFC 8785 canonical JSON.

## Global Constraints

- `NO_BACKEND_CHANGE` and `NO_UI_CHANGE`: do not edit `apps/api/src/**`, dashboard runtime source,
  `libs/api/src/**`, generated public API artifacts, quant/scoring code, routes, persistence, or product
  copy. Supply-chain modules may execute existing checks/builds but may not become an application import.
- Preserve the current dirty/shared workspace. Before every task record `git status --short`, inspect
  task-owned diffs, and never restore, delete, stage, or rewrite another feature's work. All temporary
  mutation and poison cases run in an OS temporary directory or an explicit detached worktree resolved
  from a recorded base SHA.
- No implementation task commits, pushes, merges, deploys, changes repository visibility/plan, or grants
  a write token. The method's normal commit checkpoint is replaced, under the current authorization, by
  `git diff --check` plus a task-path-only diff inventory. The accepted-revision binding may run only
  after the conductor supplies a human-created reviewed `accepted_revision_sha`; absence of that SHA is
  a visible GATE-Z stop, never permission for a worker to create a commit.
- Exact Node `24.19.0`, npm `11.17.0`, and Rust `1.98.0` remain `candidate` until B9 passes. B9 must
  qualify a clean immutable base SHA with an independently acquired toolchain and byte-identical selector
  patch, then join the resulting qualification to a complete ordinary-CI receipt for the real accepted
  revision. Failure at either phase stops; do not restore a moving channel or choose another tuple.
- Test the two and only two npm resolution experiments: Nx's edge to `brace-expansion@5.0.9` and
  PostCSS's edge to `nanoid@3.3.18`. Preserve direct Nx `23.1.1`; record before/after paths and constraints.
  If either override cannot make the complete full-graph audit and battery pass, remove it and stop at
  GATE Z. Never run `npm audit fix`, `npm audit fix --force`, or downgrade Nx.
- Root `package-lock.json` and root `Cargo.lock` are the only locks. Remove
  `libs/quant-engine/Cargo.lock` deliberately and fail any reappearance. Every install/build/policy command
  uses `npm ci` or Cargo `--locked`; capture manifest/lock hashes before and after every scanner and require
  byte equality.
- Every external `uses:` value is a full lowercase/uppercase-insensitive 40-hex commit SHA with a readable
  release comment. Every live `FROM` is an exact tag plus `@sha256:<64 lowercase hex>`; pin service images
  and syntax frontend images too. Resolve a tag and digest independently, prove the pair, then check in the
  immutable value. No `latest`, major tag, moving Rust channel, unverified download, or installer pipe.
- One authority owns each surface: npm audit / npm license inventory / npm lock guard / cargo-deny /
  Gitleaks / Trivy config+API-image / Syft associated lock inventory / the repository normalizer. Trivy
  must not duplicate npm/Cargo advisory or license classification and none is called source SAST.
- Required tools and all eleven capability IDs must have three non-vacuous production-adapter probes with
  exact `0/pass`, `1/fail`, and `2/blocked` semantics. A missing capability, checksum/database/tool failure,
  wrong exit/state, leaked canary, or vacuous poison is a GATE-Z stop.
- Raw child stdout/stderr is always piped to ephemeral files and never inherited, teed, uploaded, or
  interpolated into workflow commands. Every retained/public channel comes from the strict normalizer and
  one allowlist sanitizer. A canary byte in any channel is a GATE-Z stop, not a redacted success.
- Associated inventories are truthfully named lock-derived CycloneDX dependency inventories. Syft reads
  deterministic synthetic catalogs only; it does not observe image/TAR bytes. Use the RFC-8785 identity
  algorithm and exact association copy from the contract. Trivy alone scans API image bytes.
- Aggregate precedence is `blocked` then `fail` then `pass_with_advisories` then `pass`. Only a current-
  baseline, accountable non-security license notice/attribution obligation may be advisory. Security has
  no exception or advisory arm. Missing/stale/native-skipped/unauthorizedly-skipped evidence blocks.
- Native Dependabot only; humans merge. No custom PR-body writer, auto-merge, auto-deploy, release hold,
  CodeQL, hosted dependency review, attestation, or deployed-byte identity claim.
- Scans and evidence never receive application runtime secrets. GitHub permissions remain read-only,
  checkout credentials are not persisted, uploads enumerate exact sanitized files, and retention is 30 days.
- If implementation discovers that a live application endpoint/payload, UI surface, product behavior,
  score/tier/fingerprint, deployment path, security exception, or uncontracted subject is needed, stop at
  GATE Z rather than expanding this plan.

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

## Backend repository/tooling track

### B0 — Establish the refusing schema, canonicalization, and process foundation

**Files:** `.supply-chain/schemas/tool-manifest.schema.json`;
`.supply-chain/schemas/command-catalog.schema.json`;
`.supply-chain/schemas/qualification.schema.json`;
`.supply-chain/schemas/binding.schema.json`;
`.supply-chain/schemas/capability-probe.schema.json`;
`tools/supply-chain/lib/canonical.mjs`; `tools/supply-chain/lib/paths.mjs`;
`tools/supply-chain/lib/process.mjs`; `tools/supply-chain/lib/schema.mjs`;
`tools/supply-chain/foundation.spec.mjs`; `.gitignore`.

1. First write 18 failing Node tests covering RFC-8785 object ordering/number/string cases; unsigned
   lexicographic UTF-8 identity ordering; SHA-256; `repo_path`, safe ID/text/ref/digest/name grammars;
   symlink/path escape; strict unknown keys; duplicate array entries; direct-spawn `shell:false`; piped
   child output; timeout/unavailable mapping; atomic sanitized-file installation; and an ignored, fenced
   `.supply-chain/out/` directory. Run `node --test tools/supply-chain/foundation.spec.mjs` and require a
   nonzero result before implementation.
2. Implement `canonicalBytes(value)` as RFC 8785 UTF-8 and `canonicalSha256(value)` over those exact
   bytes. Component sets use this exact shape:

   ```js
   const encoded = identities.map((identity) => canonicalBytes(identity));
   encoded.sort(Buffer.compare);
   const sorted = encoded.map((bytes) => JSON.parse(bytes.toString('utf8')));
   const componentSetSha256 = sha256(canonicalBytes(sorted)); // no newline or delimiter
   ```

   `bom-ref` is `urn:convexa:component:sha256:` plus the hash of one identity's canonical bytes.
3. Implement `resolveRepoPath(root, value)` with the interface grammar, `realpath`/ancestor checks, and
   symlink refusal. Implement `spawnCaptured` with an argv array, `shell:false`, piped stdio, bounded
   timeout/output, an OS-temporary directory, and terminal `{state, raw_exit_code, raw_output_sha256}`;
   raw bytes never leave the temporary directory.
4. Compile every schema with strict mode and reject unknown formats/keys. All schemas set
   `additionalProperties:false`; arrays state bounds and uniqueness. The schemas in this task encode
   every field and closed ID from interface §§3–4, including all 21 qualification `check_id` values.
5. Add `.supply-chain/out/` to `.gitignore`; never ignore policy, fixtures, receipts, or schemas. Run the
   18 tests green, `git diff --check`, and list only B0 paths. Reviewer probes: mutate one property name,
   path segment, canonical field order, and child stdio mode; each must fail and restoration must pass.

### B1 — Build exact tool acquisition and the independent candidate bootstrap

**Files:** `.supply-chain/candidate-toolchain.json`; `.supply-chain/tools.json`;
`.supply-chain/commands.json`; `tools/supply-chain/acquire-tools.mjs`;
`tools/supply-chain/bootstrap-candidate.mjs`; `tools/supply-chain/run-promoted-conformance.mjs`;
`tools/supply-chain/run-promoted-conformance.spec.mjs`; `tools/supply-chain/candidate.spec.mjs`;
`package.json`; `package-lock.json`.

1. Add 16 red tests for the exact candidate tuple/status/path set; missing/moving/checksumless tools;
   credentialized/non-HTTPS sources; platform mismatch; selector self-vouching; dirty/unresolvable base;
   path/AST patch escape; candidate patch/tree/revision formulas; absolute candidate executable paths;
   command-catalog set equality; shell metacharacters/env interpolation; cleanup; unchanged base tree;
   and `0/1/2` command exits.
2. Check in the exact `candidate-toolchain.json` object from interface §3.1. `allowed_selector_paths` is
   set-equal, not a permissive glob. `commands.json` contains one entry for each of the 21 check IDs, using
   these existing commands and direct executable/argv records:

   ```text
   npm_ci                         npm ci
   cargo_locked                   cargo metadata --locked --format-version 1
   api_contract                   npm run api:contract:check
   format                         npm run format:check
   lint                           npm run lint
   typecheck                      npm run typecheck
   node_tool_tests                npm run test:tools
   frontend_unit                  npx nx test @convexa/dashboard -- --run
   shared_client_unit             npx nx test @convexa/api -- --run
   playwright_e2e                 npx nx run dashboard-e2e:e2e
   dashboard_production_build     npx nx build @convexa/dashboard --configuration=production
   bundle_budget                  npm run check:bundle
   rust_default_tests             cargo test -p api-rust -p quant-engine --locked
   rust_postgres_tests            cargo test -p api-rust --features postgres --locked
   production_runtime_guardrails  cargo test -p api-rust --features postgres --test production_runtime_guardrails_postgres --locked -- --nocapture
   postgres_release_safety        cargo test -p api-rust --features postgres --test postgres_release_safety_postgres --locked -- --nocapture
   rust_release_build             cargo build -p api-rust --release --features postgres --locked
   api_docker_build               docker buildx build --file apps/api/Dockerfile --output type=oci,dest=<temp>/api.oci.tar .
   dashboard_docker_build         docker buildx build --file apps/dashboard/Dockerfile --output type=oci,dest=<temp>/dashboard.oci.tar .
   application_conformance        node tools/supply-chain/run-promoted-conformance.mjs
   score_tier_gate_fingerprint_identity cargo test -p api-rust --test score_identity --locked
   ```

   The stored catalog uses safe `${TEMP}` typed tokens resolved internally, not literal shell syntax.
3. Populate `tools.json` only after resolving exact releases and checksums. For each upstream release,
   retrieve its signed/checksum asset over credential-free HTTPS, independently hash the archive, execute
   `--version`, then freeze `{tool_id,version,source_locator,sha256,platform,capabilities}`. Repository tools
   hash their checked-in entry file; npm records the bundled version and candidate Node distribution hash.
   Abort without installing a record if published and computed hashes differ.
4. Install exact locked schema/parser/license-inventory development dependencies with
   `npm install --save-dev --save-exact`; immediately run `npm audit --json` and
   `npm audit --omit=dev --json`. Keep the addition only if the production audit is zero and any new full-
   graph finding is absent; otherwise remove it and use a repository implementation that satisfies the
   same fixture. Do not hide a tool dependency advisory.
5. Implement the bootstrap to resolve a clean immutable base, download candidate Node/npm/Rust without
   reading live selectors, create an isolated worktree/copy, apply only the AST-aware selector patch,
   compute the exact `sca-candidate-v1\0...` identity, run commands by direct spawn, and emit the strict
   qualification schema. It is allowed to emit `fail` or `blocked`; it is not allowed to accept.
6. Implement `run-promoted-conformance.mjs` as a direct-spawn wrapper over the four exact promoted specs
   in the copied conformance block. It accepts a loopback URL only, suppresses child raw output, and emits
   one safe hash/state per spec; a missing/non-pass spec makes the qualification check fail or block.
7. Add the root script exactly:

   ```json
   "supply-chain:candidate": "node tools/supply-chain/bootstrap-candidate.mjs"
   ```

   Run 16/16 candidate and 6/6 promoted-conformance tests green. Reviewer probes: add a dependency field,
   permission, trigger, command, or non-allowlisted
   path to the selector patch; each must exit 2, leave the base byte-identical, and publish no raw output.

### B2 — Remediate the two current npm advisory paths or stop

**Files:** `package.json`; `package-lock.json`; `.supply-chain/fixtures/advisory-remediation/**`;
`tools/supply-chain/remediation.mjs`; `tools/supply-chain/remediation.spec.mjs`.

1. Capture the current full and production audit JSON hashes and `npm ls brace-expansion nanoid nx vite
   postcss --all --json` in an ephemeral baseline. Write 10 red tests for exact vulnerable paths, upstream
   range compatibility, direct Nx `23.1.1`, only-two-override shape, unrelated graph delta, full/production
   audit outcomes, override removal on failure, forbidden audit-fix strings, and receipt sanitization.
2. Add exact root overrides, no broader range:

   ```json
   "overrides": {
     "nx": { "brace-expansion": "5.0.9" },
     "postcss": { "nanoid": "3.3.18" }
   }
   ```

   Regenerate the root lock intentionally with npm `11.17.0`. Assert the before path
   `nx@23.1.1 -> brace-expansion@5.0.8` becomes only `5.0.9`, and the PostCSS/Vite path to
   `nanoid@3.3.16` becomes only `3.3.18`; direct Nx stays `23.1.1` and unrelated package identities match.
3. Run `npm ci`, `npm audit --json`, `npm audit --omit=dev --json`, tool tests, lint, typecheck, unit tests,
   dashboard build, bundle check, Rust default/Postgres tests, release build, and both Docker builds in the
   candidate environment. Require both audits to report 0 vulnerabilities and the complete battery to pass.
4. If any requirement fails, remove the override and regenerated lock delta, retain only a sanitized
   failed-experiment receipt, and report GATE Z. If all pass, run 10/10 tests and keep the exact override.
   Reviewer probe: add one unrelated override; the graph-delta guard must fail.

### B3 — Implement policy catalogs and the four dependency authorities

**Files:** `.supply-chain/policy.json`; `.supply-chain/license-baseline.json`;
`.supply-chain/owners.json`; `.supply-chain/actions.json`; `.supply-chain/exceptions.json`;
`deny.toml`; `.supply-chain/schemas/policy.schema.json`;
`.supply-chain/schemas/license-baseline.schema.json`;
`.supply-chain/schemas/exception-registry.schema.json`;
`.supply-chain/fixtures/npm-audit/**`; `.supply-chain/fixtures/npm-license/**`;
`.supply-chain/fixtures/npm-lock/**`; `.supply-chain/fixtures/cargo-deny/**`;
`tools/supply-chain/policy/npm-audit.mjs`; `tools/supply-chain/policy/npm-license.mjs`;
`tools/supply-chain/policy/npm-lock.mjs`; `tools/supply-chain/policy/cargo-deny.mjs`;
`tools/supply-chain/policy/registry.mjs`; `tools/supply-chain/policy.spec.mjs`.

1. Write 28 red tests for the four capability rows' pass/fail/unavailable fixtures; npm production/full
   audit separation; exact SPDX continuity; notice accountability; new/changed/missing/unparseable/overdue
   expressions; npm HTTPS registry/integrity/workspace links; all denied npm sources; Cargo advisory,
   license, source, bans, yank, checksum, alternate registry/git/wildcard cases; root-lock-only enforcement;
   manifest/lock mutation; authority overlap; and every exception-registry poison/valid renewal rule.
2. Derive `.supply-chain/license-baseline.json` from the current committed, post-B2 npm/Cargo graphs. Each
   row records package/crate, exact version, ecosystem, normalized SPDX expression, origin lock hash, and
   obligation. This is continuity, explicitly not legal approval. The initial exceptions array is empty;
   no security record is representable through the production CLI.
3. Populate `owners.json` with closed IDs and valid current GitHub logins, and `actions.json` with exactly:
   `upgrade_dependency`, `replace_dependency`, `repair_policy_input`, `restore_allowed_source`,
   `refresh_tool_data`, `rerun_current_revision`, `rebuild_subject`, `repair_sanitizer`, and
   `review_license_obligation`. Findings may reference only these catalogs.
4. Configure `deny.toml` over root `Cargo.lock` for advisories/yanks, exact observed license continuity,
   crates.io/checksum/workspace paths only, and reviewed duplicate crypto constraints. The adapter runs
   cargo-deny against each fixture through the same production argv path; network/database absence is
   `blocked`, never zero advisories.
5. Implement the npm audit adapter against machine JSON and reject transport/error/non-JSON as blocked;
   implement the exact-pinned license inventory adapter plus baseline normalizer; implement the lock-v3
   source/integrity/workspace guard. Before/after file hashes prove all four are read-only.
6. Remove `libs/quant-engine/Cargo.lock`; add a positive root-lock test and a poison that recreates the
   nested lock. Run 28/28 green. Reviewer probes every denied source and mutates one license expression;
   each must return exit 1 with a safe rule ID, while malformed input returns exit 2.

### B4 — Implement secret/config/image authorities and all capability receipts

**Files:** `.supply-chain/fixtures/gitleaks/**`; `.supply-chain/fixtures/trivy-config/**`;
`.supply-chain/fixtures/trivy-image/**`; `.supply-chain/fixtures/capabilities.json`;
`tools/supply-chain/policy/gitleaks.mjs`; `tools/supply-chain/policy/trivy.mjs`;
`tools/supply-chain/capabilities.mjs`; `tools/supply-chain/capabilities.spec.mjs`.

1. Write 14 red tests for the three Gitleaks and two Trivy capability rows, exact current/history ranges,
   a committed-then-deleted canary, absent base SHA, config authority exclusions, image-by-digest scan,
   nonexistent digest, tool/database/checksum failure, raw-output suppression, receipt set equality, and
   a missing/duplicate/wrong-state probe.
2. Create isolated two-commit Gitleaks fixture repositories at test time from committed seed files. The
   production adapter uses current revision plus applicable PR base range; it never publishes match bytes.
3. Configure Trivy to scan live Docker/workflow configuration and exact API OCI digest. Disable npm/Cargo
   advisory and license classification in this authority and make the overlap guard inspect effective
   argv/config, not comments. The image pass/fail fixtures are digest-addressed scratch OCI layouts.
4. Implement `capabilities.mjs` to run exactly the 11 IDs and three fixture IDs from interface §4.2 through
   the real adapter. It writes 33 strict sanitized receipts only when tool/version/hash/fixture hash,
   expected/actual exit, expected/actual state, and probe verdict match. For the sanitizer canary-stop arm,
   `actual_state=blocked`, `actual_adapter_exit=2`, `publication_canary_leaked=false`, and
   `probe_verdict=pass` is the only safe expected result.
5. Run B3's four plus B4's three surface probes and temporarily register placeholder failing tests for the
   four B5/B6 inventory/normalizer/sanitizer capabilities, proving the 33-receipt set cannot pass early.
   After B6, rerun the complete set. Reviewer probe: mark one unavailable fixture pass; set validation must fail.

### B5 — Build the strict normalizer, sanitizer, renderer, and event/run-key join

**Files:** `.supply-chain/schemas/policy-report.schema.json`;
`.supply-chain/schemas/subject-receipt.schema.json`;
`.supply-chain/schemas/artifact.schema.json`; `.supply-chain/messages.json`;
`.supply-chain/fixtures/normalizer/**`; `.supply-chain/fixtures/sanitizer/**`;
`tools/supply-chain/normalize.mjs`; `tools/supply-chain/sanitize.mjs`;
`tools/supply-chain/render-summary.mjs`; `tools/supply-chain/run-key.mjs`;
`tools/supply-chain/publication.mjs`; `tools/supply-chain/policy.mjs`;
`tools/supply-chain/verify.mjs`; `.supply-chain/tools.json`;
`tools/supply-chain/normalizer.spec.mjs`;
`tools/supply-chain/publication.spec.mjs`.

1. Write 42 red tests covering every strict §5 object/array/format/bound; state/completion legality;
   declared-check set equality; finding counts; owner/action/evidence resolution; security blockers;
   license-only accountable advisory; authorized skips; missing/stale/partial/native-skip; aggregate
   precedence; exact four event/path/subject matrices; RFC-8785 subject-set hash and `sca-run-v1` run key;
   child/aggregate cross-run rejection; artifact hash/media/retention/reference joins; summary order/copy;
   20-row and three-example caps; blocker-first/action grouping/overflow; and redaction disclosure iff used.
2. Implement the run identity exactly:

   ```js
   const subjectSetSha256 = sha256(canonicalBytes([...subjectIds].sort()));
   const runKey = sha256(Buffer.concat([
     Buffer.from('sca-run-v1\0'), Buffer.from(event), Buffer.from('\0'),
     Buffer.from(revisionSha), Buffer.from('\0'), Buffer.from(path), Buffer.from('\0'),
     Buffer.from(subjectSetSha256),
   ]));
   ```

   Fixed paths are PR/schedule `policy` and default branch `artifacts`; dispatch accepts only the closed
   `path` input and selected `github.sha`. Artifact paths include the complete policy path.
3. Implement strict per-check normalization and aggregate precedence. Unknown/malformed/missing/stale/
   duplicate input yields `complete:false` and `blocked`; a completed prohibited finding yields `fail`.
   GitHub success maps only pass/advisory. Do not accept a raw tool zero count without completed evidence.
4. Implement one field allowlist sanitizer for JSON, receipts, Markdown, annotation records, filenames,
   inventory metadata, and wrapper logs. Remove snippets, authorization, URL user-info/query, environment,
   command values, control bytes, and unsafe names; never substitute a clean claim. Annotation output
   percent-encodes `%`, CR, LF and omits unsafe locations.
5. Publication wrappers spawn child tools with captured stdio and emit only
   `SCA_RESULT <check_id> <state> <artifact_name>`. The staging directory contains enumerated validated
   files only. Poison scans intercepted wrapper streams, summary/annotation bytes, JSON/receipts/inventory,
   and artifact names/metadata for exact canary/header/credentialized-URL values.
6. Render the exact component-state and terminal copy from SPEC §4, exact inventory boundary text, and
   exact overflow sentence. Summary order is contract §10 and links only safe artifact refs.
7. Add `policy.mjs` as the closed adapter orchestrator and `verify.mjs` as the event-aware command that
   always invokes the aggregate even after child failure. Both accept only interface §2 flags, compute the
   current run key internally, and publish through `publication.mjs`. Refresh repository-tool hashes for
   normalizer/sanitizer in `tools.json` only after their bytes are final.
8. Run 42/42 green. Reviewer poisons every public channel and one child native skip; canaries must cause
   exit 2/capability stop, while a safe policy fail must publish as exit 1/fail with no leaked bytes.

### B6 — Build deterministic subjects and associated lock-derived inventories

**Files:** `.supply-chain/schemas/component-identity.schema.json`;
`.supply-chain/schemas/inventory-receipt.schema.json`;
`.supply-chain/fixtures/inventory/**`; `tools/supply-chain/oci.mjs`;
`tools/supply-chain/tar.mjs`; `tools/supply-chain/component-oracle.mjs`;
`tools/supply-chain/syft-inventory.mjs`; `tools/supply-chain/artifacts.mjs`;
`tools/supply-chain/inventory.spec.mjs`; `tools/supply-chain/artifacts.spec.mjs`.

1. Write 30 red tests for safe OCI subject extraction/digest, single-build reuse, deterministic POSIX ustar
   bytes, every forbidden TAR member/type/path/header, safe extraction, Cargo and npm closure rules,
   named seeds/families, decoded strings/provenance, RFC-8785 component/bom-ref hashes, zero/missing/
   duplicate/arbitrary/wrong-family/provenance/cross-subject mutations, Syft omission non-synthesis,
   CycloneDX 1.6 validation, exact receipt joins, and stale/missing/expired/mismatched artifacts.
2. Build the API once with Buildx OCI output and derive `api-production-image` from the OCI manifest bytes;
   pass that exact digest/layout to Trivy. Do not rebuild between scan, oracle, Syft, receipt, and upload.
3. Build dashboard once, then write an uncompressed POSIX ustar TAR of `apps/dashboard/dist` under `dist/`
   with bytewise UTF-8 order, zero mtime/uid/gid, empty owners, `0755` dirs, `0644` files, and no extension.
   Validate every header before extracting into a new empty OS temp directory and hash exact TAR bytes.
4. Derive API identities with locked Cargo metadata for `api-rust`, Linux target, Postgres feature, and
   normal/build edges only; derive dashboard identities from lock-v3 root production/workspace closure,
   excluding dev-only reachability. Require the exact workspace families and all named seeds in §8.3.
5. Present only the canonical lock identities to Syft's deterministic synthetic-catalog adapter. Normalize
   its emitted components but never synthesize omissions. Require set/hash equality and exact unique
   bom-refs, then emit the §8.4 receipt with `inventory_basis:lock_derived`,
   `association_kind:named_subject_digest`, and `subject_bytes_observed_by_generator:false`.
6. `api` receipt links the exact Trivy byte-scan hash and null archive validation; dashboard receipt does
   the inverse. Copy is exactly the three contracted sentences in order. Run 30/30 green, then rerun all
   33 capability probes; require exactly 33 valid receipts and no capability stop.

### B7 — Add native proposals, immutable automation inputs, and event workflows

**Files:** `.github/dependabot.yml`; `.github/workflows/ci.yml`;
`.github/workflows/conformance.yml`; `.github/workflows/deploy-smoke.yml`;
`.github/workflows/supply-chain.yml`; `apps/api/Dockerfile`; `apps/dashboard/Dockerfile`;
`package.json`; `tools/supply-chain/workflow-guard.mjs`;
`tools/supply-chain/workflow-guard.spec.mjs`; `tools/supply-chain/dependabot.spec.mjs`.

1. Write 24 red structural tests for all five Dependabot ecosystems/directories, weekly cadence, PR limit
   five, exact groups/patterns/update types, isolated majors/unmatched dependencies, exact commit prefixes,
   labels/owners/reviewers, no auto-merge/custom body/write token; full-SHA Actions; tag+digest images;
   tag/digest mismatch/stale SHA; read-only permissions; `persist-credentials:false`; no direct scanners,
   inherited stdio, `tee`, tracing/env dump, broad uploads, or `continue-on-error`; all event/path jobs;
   always aggregate with current run key; and exact 30-day retained files.
2. Add native Dependabot version 2 entries and every exact group in interface §9. Use labels
   `dependencies`, ecosystem label, and `owner:<safe owner_id>`. Link
   `docs/SUPPLY_CHAIN.md#dependency-proposals` from the native check summary, not a body updater.
3. Resolve each Action release tag to its immutable commit with `git ls-remote`/GitHub API, compare the
   release repository, and write `uses: owner/action@<40-hex> # <release>`. Do the same for every existing
   workflow, including checkout/setup/cache/upload. Hash the sorted action pin set for receipts.
4. Resolve every Docker `FROM` tag to a manifest-list digest and independently verify platform manifest
   selection. Rewrite each live `FROM exact-tag@sha256:digest`; pin the Dockerfile frontend and Postgres
   service image as well. Hash the sorted tag/digest set. Keep application commands, ports, files, and
   runtime user behavior unchanged. If a final image is not non-root under its effective image config,
   stop at GATE Z; this feature is not authorized to change runtime behavior to repair it.
5. Extend root scripts exactly:

   ```json
   "supply-chain:toolchain": "node tools/supply-chain/toolchain.mjs",
   "supply-chain:policy": "node tools/supply-chain/policy.mjs",
   "supply-chain:artifacts": "node tools/supply-chain/artifacts.mjs",
   "supply-chain:poison": "node tools/supply-chain/capabilities.mjs",
   "supply-chain:verify": "node tools/supply-chain/verify.mjs"
   ```

6. PR CI runs parity, complete policy, Gitleaks/config, mutation/poison, and existing application gates;
   every worker stages a strict child receipt. An `if: always()` aggregate validates current run key and
   declared job set and alone decides supply-chain success.
7. `supply-chain.yml` runs on main/default artifact, schedule, and dispatch. Default/artifacts build both
   subjects once; schedule uses current default SHA and policy only; dispatch has one required `path`
   choice (`policy|artifacts`, default `policy`) and no SHA/subject override. Upload exact sanitized files
   with 30-day retention. No event deploys or changes current post-merge CD.
8. Run 24/24 workflow tests. Reviewer poisons every mutable tag/image, skipped child, stale receipt,
   direct scanner call, upload glob, or write permission; the aggregate must become blocked.

### B8 — Write the operator documentation and prove negative application space

**Files:** `README.md`; `docs/SUPPLY_CHAIN.md`; `docs/DEPLOY_RUNBOOK.md`;
`tools/supply-chain/docs-and-isolation.spec.mjs`.

1. Write 12 red tests for README values sourced from `candidate-toolchain.json` before binding and set-equal
   to live selectors after binding; one canonical
   runbook link; required runbook sections; exact state/copy/commands; proposal instructions;
   authority/scope/retention; remediation; candidate/binding distinction; associated-inventory wording;
   forbidden provenance/attestation/deploy words in subject claims; deploy-runbook adjacent link+exact
   disclaimer; and source-tree negative space.
2. Update README prerequisites/install commands to the exact candidate values and state that the tuple is
   supported only when the current accepted-revision binding receipt passes; before that proof the
   applicable label is `Candidate — qualification pending` or `Candidate — acceptance recheck pending`.
   Use `npm ci`, not `npm install`, and link once to `docs/SUPPLY_CHAIN.md` for policy details.
3. `docs/SUPPLY_CHAIN.md` owns states, event/path matrix, authorities, exact commands/exits, evidence and
   30-day retention, toolchain qualification/binding, dependency-proposal groups/human review, license
   continuity, remediation/GATE-Z stops, sanitizer behavior, and truthful inventory association/limits.
4. Beside the current Railway/Cloudflare host rebuild/CD text in `docs/DEPLOY_RUNBOOK.md`, add the runbook
   prerequisite link followed immediately by exactly:
   `This evidence does not identify bytes independently rebuilt or deployed by Railway or Cloudflare.`
   Do not duplicate policy or imply a release hold/deployed-byte proof.
5. The isolation test snapshots the pre-feature route/nav/component/copy inventory and rejects supply-chain
   additions under `apps/api/src/**`, dashboard runtime source, `libs/api/src/**`, generated API contracts,
   and quant/scoring modules. It also runs API contract check and fixed score identity. Run 12/12 green.

### B9 — Qualify the full candidate and accept selectors only after a real accepted revision

**Files:** `.nvmrc`; `.npmrc`; `package.json`; `Cargo.toml`; `apps/api/Cargo.toml`;
`libs/quant-engine/Cargo.toml`; `rust-toolchain.toml`; `apps/api/Dockerfile`;
`apps/dashboard/Dockerfile`; `.github/workflows/ci.yml`; `.github/workflows/conformance.yml`;
`.github/workflows/supply-chain.yml`; `tools/supply-chain/toolchain.mjs`;
`tools/supply-chain/toolchain.spec.mjs`.

1. Write 18 red tests for candidate/base/accepted identity separation; allowlisted AST-only selector patch;
   all 21 check IDs; lock/policy/action/image hashes; parity across every selector; candidate labels;
   qualification artifact hash/ref; accepted-CI required-check-set RFC-8785 hash; standard run-key join;
   exact selector-set equality; missing/duplicate/non-pass CI checks; changed qualification/lock/tool;
   detected-version mismatch; and supported-copy refusal before binding.
2. From a recorded clean immutable base SHA containing B0–B7 but not accepted selector changes, run:

   ```powershell
   npm run supply-chain:candidate -- --base <40-hex-base-sha>
   ```

   The hosted Ubuntu 24.04 qualification must run all 21 checks with exact Node `24.19.0`, npm `11.17.0`,
   Rust `1.98.0`, Postgres, Playwright, and Docker. Docker-unavailable local output is `UNVERIFIABLE` and
   cannot bind support. Require complete/pass, unchanged locks, exact parity, and a sanitized qualification.
3. If any tier fails, publish the safe failed tier and stop at GATE Z. Do not edit the candidate tuple,
   weaken a test, switch channel, or accept selectors. If it passes, apply only the byte-identical recorded
   selector patch to the reviewed branch: `.nvmrc=24.19.0`; `packageManager=npm@11.17.0`; exact engines;
   `.npmrc` engine strict; `rust-toolchain.toml` channel `1.98.0`; inherited workspace/crate
   `rust-version=1.98`; exact workflow/Docker selector values.
4. A worker must not manufacture the required commit. Once the conductor supplies the human-reviewed real
   `accepted_revision_sha`, ordinary CI emits `accepted_revision_ci` with all 21 checks, complete/pass,
   required-check-set hash, and standard policy run key. Run:

   ```powershell
   npm run supply-chain:toolchain -- --mode accepted --qualification artifact:toolchain-qualification#/receipt
   ```

   The binding command recomputes the accepted selector set, candidate selector set, artifact hashes,
   locks, detected tools, parity, CI run key, and required set. Only exact equality emits complete/pass.
5. Documentation and summaries say `Candidate — qualification pending` or
   `Candidate — acceptance recheck pending` until binding passes. Missing accepted SHA or CI receipt is a
   GATE-Z stop. Run 18/18 tests and the accepted command only when the external reviewed revision exists.

## Integration closer

### B10-backend-closer — Run the complete gate and write only the conformance receipt

**Files:** `.spire/clusters/tech/contracts/supply-chain-automation/conformance-receipt.json`.

**Depends on:** B0, B1, B2, B3, B4, B5, B6, B7, B8, B9.

Do not repair worker paths. Recompute the current revision and run key, run the full poison/capability suite,
policy path, artifact path on hosted Ubuntu/Docker, and ordinary application battery. Serve the unchanged API
in a hermetic local configuration and run the four promoted conformance specs. Write only a strict receipt
recording commands/exits, exact 33/33 capability receipts, all 21 qualification/accepted-CI checks, policy and
artifact aggregates, two subject/digest associations, four conformance results, score identity, source negative
space, `NO_BACKEND_CHANGE`, and `NO_UI_CHANGE`. If no reviewed accepted revision exists, write no pass receipt
and return the B9 GATE-Z stop.

## Independence

All work is repository/CI/tooling outside the application lane roots and has intentionally been assigned to
the backend lane as `Independent: no`. The tasks share root manifests, policy catalogs, adapters, and workflow
joins, so splitting them would violate the path-prefix rule. There is no frontend execution work because
SPEC §4 is `NO_UI_CHANGE` and names no frontend implementation file. B10 is the one active-lane closer.

| Task | Lane | Paths | Depends on | Independent |
|---|---|---|---|---|
| B0 | backend | `.supply-chain/schemas/**`; `tools/supply-chain/lib/**`; `tools/supply-chain/foundation.spec.mjs`; `.gitignore` | — | no |
| B1 | backend | `.supply-chain/candidate-toolchain.json`; `.supply-chain/tools.json`; `.supply-chain/commands.json`; `tools/supply-chain/acquire-tools.mjs`; `tools/supply-chain/bootstrap-candidate.mjs`; `tools/supply-chain/run-promoted-conformance.mjs`; `tools/supply-chain/run-promoted-conformance.spec.mjs`; `tools/supply-chain/candidate.spec.mjs`; `package.json`; `package-lock.json` | B0 | no |
| B2 | backend | `package.json`; `package-lock.json`; `.supply-chain/fixtures/advisory-remediation/**`; `tools/supply-chain/remediation.mjs`; `tools/supply-chain/remediation.spec.mjs` | B1 | no |
| B3 | backend | `.supply-chain/policy.json`; `.supply-chain/license-baseline.json`; `.supply-chain/owners.json`; `.supply-chain/actions.json`; `.supply-chain/exceptions.json`; `.supply-chain/schemas/**`; `.supply-chain/fixtures/**`; `deny.toml`; `tools/supply-chain/policy/**`; `tools/supply-chain/policy.spec.mjs`; `libs/quant-engine/Cargo.lock` | B0, B2 | no |
| B4 | backend | `.supply-chain/fixtures/**`; `tools/supply-chain/policy/**`; `tools/supply-chain/capabilities.mjs`; `tools/supply-chain/capabilities.spec.mjs` | B1, B3 | no |
| B5 | backend | `.supply-chain/schemas/**`; `.supply-chain/messages.json`; `.supply-chain/fixtures/**`; `.supply-chain/tools.json`; `tools/supply-chain/normalize.mjs`; `tools/supply-chain/sanitize.mjs`; `tools/supply-chain/render-summary.mjs`; `tools/supply-chain/run-key.mjs`; `tools/supply-chain/publication.mjs`; `tools/supply-chain/policy.mjs`; `tools/supply-chain/verify.mjs`; `tools/supply-chain/normalizer.spec.mjs`; `tools/supply-chain/publication.spec.mjs` | B0, B3, B4 | no |
| B6 | backend | `.supply-chain/schemas/**`; `.supply-chain/fixtures/**`; `tools/supply-chain/oci.mjs`; `tools/supply-chain/tar.mjs`; `tools/supply-chain/component-oracle.mjs`; `tools/supply-chain/syft-inventory.mjs`; `tools/supply-chain/artifacts.mjs`; `tools/supply-chain/inventory.spec.mjs`; `tools/supply-chain/artifacts.spec.mjs` | B0, B3, B5 | no |
| B7 | backend | `.github/dependabot.yml`; `.github/workflows/**`; `apps/api/Dockerfile`; `apps/dashboard/Dockerfile`; `package.json`; `tools/supply-chain/workflow-guard.mjs`; `tools/supply-chain/workflow-guard.spec.mjs`; `tools/supply-chain/dependabot.spec.mjs` | B2, B4, B5, B6 | no |
| B8 | backend | `README.md`; `docs/SUPPLY_CHAIN.md`; `docs/DEPLOY_RUNBOOK.md`; `tools/supply-chain/docs-and-isolation.spec.mjs` | B7 | no |
| B9 | backend | `.nvmrc`; `.npmrc`; `package.json`; `Cargo.toml`; `apps/api/Cargo.toml`; `libs/quant-engine/Cargo.toml`; `rust-toolchain.toml`; `apps/api/Dockerfile`; `apps/dashboard/Dockerfile`; `.github/workflows/**`; `tools/supply-chain/toolchain.mjs`; `tools/supply-chain/toolchain.spec.mjs` | B0, B1, B2, B3, B4, B5, B6, B7, B8 | no |
| B10-backend-closer | backend | `.spire/clusters/tech/contracts/supply-chain-automation/conformance-receipt.json` | B0, B1, B2, B3, B4, B5, B6, B7, B8, B9 | no |

## Verification track

Run from repository root. Use a disposable clean worktree for mutation tests. The Windows development host
may run pure Node/Rust tests, but Docker/image and authoritative candidate acceptance require the contracted
Ubuntu 24.04 environment. A missing Docker/Postgres/accepted revision is `UNVERIFIABLE` or GATE Z, never pass.

### V1 — Foundation, schemas, acquisition, and candidate bootstrap

```powershell
node --test tools/supply-chain/foundation.spec.mjs
node --test tools/supply-chain/candidate.spec.mjs
node --test tools/supply-chain/toolchain.spec.mjs
```

Expected: 18/18, 16/16, and 18/18; zero failures/skips. Unknown schema keys, path escapes, mutable or
checksum-mismatched tools, selector self-vouching, patch escapes, wrong candidate identity, and premature
supported copy each turn the applicable suite red; restored controls pass with no raw output.

### V2 — Advisory remediation and dependency policy

```powershell
node --test tools/supply-chain/remediation.spec.mjs
node --test tools/supply-chain/policy.spec.mjs
npm ls brace-expansion nanoid nx postcss --all
npm audit --json
npm audit --omit=dev --json
cargo metadata --locked --format-version 1 > $null
```

Expected: 10/10 and 28/28; Nx remains `23.1.1`; its owned brace-expansion is `5.0.9`; PostCSS's nanoid is
`3.3.18`; both audits report total 0; Cargo resolves only root `Cargo.lock`; nested Cargo lock is absent.
Every advisory/license/source/bans poison exits 1, every unavailable/malformed arm exits 2, and no scan
changes a manifest or lock hash.

### V3 — Normalizer, publication, capabilities, and workflows

```powershell
node --test tools/supply-chain/normalizer.spec.mjs
node --test tools/supply-chain/publication.spec.mjs
node --test tools/supply-chain/capabilities.spec.mjs
node --test tools/supply-chain/workflow-guard.spec.mjs
node --test tools/supply-chain/dependabot.spec.mjs
npm run supply-chain:poison
```

Expected: 42/42 normalizer/publication assertions, 14/14 capability harness assertions, 24/24 workflow+
Dependabot assertions, and exactly 33 complete capability receipts (three for each of 11 IDs). Canary bytes
occur in no wrapper log, JSON, annotation, summary, artifact name/metadata, receipt, or inventory metadata.
Safe policy-fail fixture exits 1/fail; sanitizer canary-stop exits 2/blocked with `probe_verdict=pass` and
`publication_canary_leaked=false`. Every `uses:` is full SHA and every image selector is tag+digest.

### V4 — Deterministic subjects and truthful associated inventories

```powershell
node --test tools/supply-chain/inventory.spec.mjs
node --test tools/supply-chain/artifacts.spec.mjs
npm run supply-chain:artifacts -- --event workflow_dispatch --path artifacts --run-key <recomputed-64-hex>
```

Expected: 30/30 inventory/artifact assertions; one API OCI build and one dashboard build; Trivy report hash
matches exact API digest; deterministic TAR validation passes and repeat TAR hashes match; both inventories
have positive component counts, exact families/seeds, equal oracle/emitted set hashes, unique bom-refs, and
`subject_bytes_observed_by_generator:false`. A seed removal, extra/duplicate identity, traversal, wrong digest,
or stale run key fails/blocks and never becomes a byte-observation claim.

### V5 — Candidate qualification hard stop

Run on hosted `ubuntu-24.04` from the clean immutable B0–B7 base:

```bash
npm run supply-chain:candidate -- --base "$BASE_REVISION_SHA"
```

Expected: a complete qualification with exact candidate/detected `24.19.0 / 11.17.0 / 1.98.0`, exact
candidate patch/tree/revision hashes, unchanged locks, every parity flag true, and all 21 required check IDs
exactly once in `pass`. Any failed tier yields exit 1; bootstrap/input/capability failure yields exit 2; either
stops before live selector acceptance.

### V6 — Accepted-revision binding and event aggregation

After a human-reviewed accepted revision exists and ordinary CI completes:

```powershell
npm run supply-chain:toolchain -- --mode accepted --qualification artifact:toolchain-qualification#/receipt
npm run supply-chain:verify -- --event pull_request
npm run supply-chain:verify -- --event default_branch
npm run supply-chain:verify -- --event schedule
npm run supply-chain:verify -- --event workflow_dispatch --path policy
```

Expected: binding receipt complete/pass; accepted selector set equals candidate selector set; qualification
and accepted-CI hashes resolve; accepted CI has all 21 pass checks, correct required-check-set hash and run key;
locks/detected tools/parity match. Each event resolves its exact path/subject set; missing/stale/native-skipped
child makes the always-running aggregate blocked. Without accepted SHA/receipt, this step returns GATE Z.

### V7 — Full application regression and non-interface proof

```powershell
npm run api:contract:check
npm run format:check
npm run lint
npm run typecheck
npm run test:tools
npx nx test @convexa/dashboard -- --run
npx nx test @convexa/api -- --run
npx nx run dashboard-e2e:e2e
npx nx build @convexa/dashboard --configuration=production
npm run check:bundle
cargo fmt --all -- --check
cargo test -p api-rust -p quant-engine --locked
cargo test -p api-rust --features postgres --locked
cargo build -p api-rust --release --features postgres --locked
cargo test -p api-rust --test score_identity --locked
node --test tools/supply-chain/docs-and-isolation.spec.mjs
```

Expected: every command exits 0; documentation/isolation 12/12; API contract generated bytes are clean;
fixed score/tier/gate/fingerprint pins are byte-identical; no supply-chain delta exists under application,
dashboard runtime, shared client, generated contract, or quant/scoring source; no new route/nav/copy/UI surface.

### V8 — Promoted live conformance and closer receipt

Serve the unchanged API at `http://127.0.0.1:8000`, then run:

```powershell
node .codex/tools/gates.mjs interface_conformance --contract .spire/clusters/tech/contracts/supply-chain-automation/INTERFACE_CONTRACT.md --url http://127.0.0.1:8000 --report .spire/clusters/tech/contracts/supply-chain-automation/conformance-receipt.json
```

The closer additionally executes the four promoted standalone specs listed in the copied conformance block.
Expected: four applicable specs pass with zero fail, the closer receipt resolves exact current revision/run
keys and sanitized artifact hashes, and no application/runtime/UI delta is reported. The contract command is a
pointer/no-backend check; it does not invent a new endpoint.

### V9 — Formatting, mutation rollback, and dirty-workspace integrity

```powershell
npx prettier --check package.json .github/dependabot.yml .github/workflows/*.yml .supply-chain/**/*.json tools/supply-chain/**/*.mjs README.md docs/SUPPLY_CHAIN.md docs/DEPLOY_RUNBOOK.md
git diff --check
git status --short
```

Expected: formatting and diff checks pass. In disposable worktrees, every required negative mutation fails,
then restoration returns the exact original file hashes and green controls. In the shared workspace, status
still contains all pre-existing unrelated edits; no task staged, reverted, deleted, committed, pushed, or
deployed them.

## Acceptance coverage

| Criterion | Owning tasks | Verification |
|---|---|---|
| AC-1 | B1, B9 | V1, V5–V6 |
| AC-2 | B1, B9 | V5–V6 |
| AC-3 | B7, B9 | V1, V5–V6 |
| AC-4 | B7 | V3 |
| AC-5 | B0, B3 | V2, V9 |
| AC-6 | B7 | V3 |
| AC-7 | B7 | V3, V6 |
| AC-8 | B2, B3, B5 | V2–V3 |
| AC-9 | B2, B9 | V2, V5 |
| AC-10 | B3, B5 | V2–V3 |
| AC-11 | B3 | V2 |
| AC-12 | B3, B4 | V2–V3 |
| AC-13 | B5 | V3 |
| AC-14 | B5, B7 | V3, V6 |
| AC-15 | B5, B7 | V3, V6 |
| AC-16 | B1, B5 | V1, V3, V6 |
| AC-17 | B3, B5 | V2–V3 |
| AC-18 | B4, B5 | V3 |
| AC-19 | B5 | V3 |
| AC-20 | B3, B5 | V2–V3 |
| AC-21 | B4, B6 | V3–V4 |
| AC-22 | B6 | V4 |
| AC-23 | B6, B7 | V4, V6 |
| AC-24 | B6, B8 | V4, V7 |
| AC-25 | B5, B8 | V3, V7 |
| AC-26 | B1, B3, B4, B5, B6 | V1–V4 |
| AC-27 | B8 | V7 |
| AC-28 | B8, B10-backend-closer | V7–V8 |
| AC-29 | B8, B10-backend-closer | V7–V8 |
| AC-30 | B8, B9 | V6–V7 |
