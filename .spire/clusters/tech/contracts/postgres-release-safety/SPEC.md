# postgres-release-safety — spec

**Source brief:** .spire/clusters/tech/contracts/postgres-release-safety/BRIEF.md
**Council:** R1 positions · R2 critiques · decisions.md   (under council/)
**Status:** APPROVED 2026-08-22
**GATE Z amendment 2026-08-22 (evidence repair 3):** AC28 now separates deterministic repository/process validation from direct live Railway review. The repository tool makes no claim that it independently validates host logs, deployment status, health, or config-source attribution. The migration terminal schema is unchanged.

## 1. Goal + scope

Make PostgreSQL schema changes a deliberate release operation for Convexa operators and deployment automation. One dedicated command owns migration writes, each version commits its schema effects and ledger entry atomically, and production API startup only verifies an already-ready schema before it binds a listener or starts workers. The feature changes no trader workflow or public API behavior.

**In scope:**

- A PostgreSQL-only `api-rust postgres-migrate` release command in the same image and application revision as `api-rust serve`.
- One migration owner per PostgreSQL database through a dedicated non-pooled session and a bounded session advisory lock.
- An immutable ordered migration manifest, exact version/name history classification, and manifest validation before database side effects.
- One PostgreSQL transaction per pending version, containing every statement for that version and its migration-ledger insert.
- Read-only production startup verification that accepts only the exact current history plus successful required-schema probes.
- Closed, parseable command outcomes; exact operator copy; nonzero deployment-stopping failures; and secret-safe diagnostics.
- Real-PostgreSQL concurrency, rollback, retry, refusal, startup, and release-order verification.
- Deployment configuration and owner guidance that complete the migration command successfully before replicas start.

**Out of scope:**

- Any dashboard, trader-facing notification, frontend type, public endpoint, SSE field, or response-shape change.
- Down migrations, automatic repair, automatic rollback of versions committed before a later failure, or acceptance of unknown future history.
- Migration checksums for the existing twelve-row legacy ledger; this slice must not fabricate provenance for historical SQL bytes.
- Non-transactional or online migration phases, destructive-migration choreography, and a general expand/contract compatibility framework.
- Backup/restore drills, staging promotion, application rollback orchestration, or recovery automation.
- Multi-database/global locks, external migration services, Kubernetes, Kafka, service mesh, or a microservice split.
- Background-worker leader election or changing the supported replica model beyond removing migration ownership from replicas.
- Generated OpenAPI or clients, which belong to `api-contract-generation`.

**Future (deliberately deferred):**

- A checksum-aware manifest may be added only with an explicit legacy-unverified epoch.
- Online/non-transactional migration phases require a separate contract that replaces, rather than weakens, the atomic-version promise.
- Recovery/deployment maturity will add backup/restore drills, promotion gates, and application rollback orchestration.
- Replica-safe worker ownership and API contract generation remain separate owner-sequenced features.

## 2. Architecture

### 2.1 Capability and file boundaries

The backend has two deliberately unequal PostgreSQL capabilities:

- `apps/api/src/db/migrations.rs` remains the single immutable ordered manifest and PostgreSQL-aware statement-splitting/validation authority. Each entry has a positive version, stable unique name, and non-empty SQL body. Validation rejects duplicate or non-increasing versions, duplicate names, empty bodies, and unsplittable SQL before connecting.
- New `apps/api/src/db/migration_runner.rs` is the only schema writer. It owns the dedicated session, advisory lock, ledger bootstrap, per-version transactions, final verification, and terminal result.
- New `apps/api/src/db/schema_verifier.rs` owns read-only ledger classification and required-schema probes. It exposes no apply, DDL, ledger-insert, transaction, or advisory-lock method.
- `apps/api/src/db/postgres.rs` opens the production pool without creating tables or applying migrations, then delegates only to the read-only verifier.
- `apps/api/src/main.rs` adds `postgres-migrate`; `apps/api/src/server.rs` retains the pre-bind serve order and may import only the verifier path.
- `apps/api/src/db/mod.rs` exposes the writer only to the CLI entry path. A mutation-tested dependency guard in `apps/api/tests/postgres_release_safety_isolation.rs` rejects any import of the writer from the server, state, route, or worker graph and proves the guard turns red when a forbidden import is injected.
- `apps/api/tests/postgres_release_safety_postgres.rs` extends the existing real-PostgreSQL harness; `.github/workflows/ci.yml` keeps that job unskippable. `tools/postgres-release-receipt.mjs` is the repository-owned deployment-evidence producer and validator, with its rejecting/accepting tests in `tools/postgres-release-receipt.spec.mjs`. `railway.json`, `docs/DEPLOY_RUNBOOK.md`, and `docs/API_RUST_DEPLOY.md` carry the same-image migration-before-start release boundary.

The migration and serve paths do not import `quant-engine`, scoring, entry-gate, or fingerprint modules. No frontend file is in the write scope.

### 2.2 Manifest and database-state model

Both capabilities compare the ordered ledger `(version, name)` pairs to the same compiled manifest. Classification is closed:

| State | Definition | Release command | Production startup |
|---|---|---|---|
| `absent` | Migration ledger does not exist | May create the ledger and apply the full manifest | Refuse before bind/workers |
| `pending_suffix` | Ledger is an exact, possibly empty, prefix of the manifest | Apply only the missing suffix | Refuse without mutation |
| `current` | Ledger exactly equals the full manifest | Run required-schema probes; report already current only if they pass | Run required-schema probes; continue only if they pass |
| `diverged` | Hole, reorder, duplicate, or version/name disagreement | Refuse without repair or mutation | Refuse without mutation |
| `future` | Any recorded version is unknown to this release | Refuse without mutation | Refuse without mutation |
| `unusable` | History is current but deterministic required-schema probes find a missing or incompatible relation/column | Refuse without repair | Refuse without mutation |
| `unverifiable` | Connectivity, permission, cancellation, or probe-execution failure prevents a trustworthy classification | Fail without a success claim | Refuse startup before bind/workers |

An exact prefix is migratable, not inconsistent. A hole, reordered/duplicated history, or renamed known version is inconsistent and must never be filled automatically. Version/name comparison is the truth for this slice because retroactive checksums would falsely vouch for historical bytes that the current ledger never recorded.

### 2.3 Single-owner release data flow

`api-rust postgres-migrate` performs this sequence:

1. Validate the compiled manifest without database access.
2. Read runtime-only `DATABASE_URL`, open one dedicated non-pooled PostgreSQL session, and never construct `AppState`, the router, vendor clients, caches, archive stores, listeners, or workers.
3. Poll `pg_try_advisory_lock` with the fixed `CONVEXA_MIGRATION_LOCK_KEY` until `MIGRATION_LOCK_TIMEOUT_SECONDS` expires. The default is 120 seconds; accepted values are integers from 1 through 3600. Waiting emits progress but never a terminal success.
4. After ownership is acquired, create the ledger if absent, then re-read and classify history under the lock. No state read before ownership may authorize a write.
5. Refuse `diverged`, `future`, or `unusable`. For `absent` or `pending_suffix`, apply each pending version in order. Each version uses one PostgreSQL transaction containing every split statement and the version/name ledger insert; commit before advancing. On error, roll back that version and stop. Versions committed earlier remain committed; later versions are not attempted.
6. Re-read the ledger and run the read-only required-schema probes. Emit exactly one terminal record, explicitly unlock when the session is still usable, and close the dedicated session on every path. PostgreSQL session teardown remains the crash-safe lock release.

The command does not support a statement that PostgreSQL refuses inside the required transaction. Real-PostgreSQL CI must reject such a manifest; the runner must never fall back to executing it outside the transaction.

### 2.4 Read-only production startup data flow

`api-rust serve` performs: closed production configuration validation → bounded pool connection without DDL → exact ledger classification → required-schema probes → archive-root probe → state/router construction → listener bind → worker start. It does not acquire or wait on the migration lock. An early replica sees `absent`, `pending_suffix`, `diverged`, `future`, `unusable`, or `unverifiable` and exits nonzero before any listener or worker evidence. A current usable schema permits the existing startup flow without changing its public responses.

The release boundary is migration completion first, replica startup second. Current Railway authority is explicit: its [pre-deploy command](https://docs.railway.com/deployments/pre-deploy-command) runs from the built application image between build and deployment, in a separate container with the service environment and private network; a nonzero exit prevents deployment, and volumes are not mounted. Its [config-as-code reference](https://docs.railway.com/config-as-code/reference) defines `deploy.preDeployCommand`, makes committed config override dashboard values for that deployment, and exposes the originating config file in deployment details. Therefore the target `railway.json` must contain `deploy.preDeployCommand` exactly `["api-rust postgres-migrate"]` and `deploy.healthcheckPath` exactly `"/api/health"`. The pre-deploy command uses only runtime `DATABASE_URL` over the private network and never relies on the unmounted archive volume or mutable filesystem.

Platform lifecycle, not a comparison of clocks in separate containers, is the order authority: a target deployment cannot proceed to its application container when the pre-deploy command exits nonzero; with the configured healthcheck, Railway reaches successful/running status only after the application starts and `/api/health` returns `200`. Evidence is deliberately split. The repository tool deterministically proves the immutable git object's `railway.json` bytes/hash/command/healthcheck, a single closed success terminal-object file, and the same-revision real-PostgreSQL missing-migrations refusal object. QA/GATE S separately observes the live Railway deployment details, config-source attribution, pre-deploy terminal log, `SUCCESS` status, and health `200` directly with current host tooling and records that review with the deployment id. The machine receipt does not contain or vouch for those live observations. Caller timestamps and cross-container clock comparisons remain prohibited. The command terminal object remains unchanged.

### 2.5 Terminal-result model

The command's authoritative record is the terminal JSON object defined in `INTERFACE_CONTRACT.md`. Its top-level outcome is exactly one of `work applied`, `already current`, `unsafe database refused`, or `execution failed`. The first two exit zero; the other two exit nonzero. Lock-deadline exhaustion is `execution failed` with reason `migration owner busy`, never a fifth outcome and never an unsafe-schema claim. Optional highest-committed evidence is non-null only after a fresh ledger read proves an exact manifest prefix.

**Failure modes + isolation:** A contender cannot write before advisory-lock ownership and must re-read after acquiring it. A statement failure rolls back only the active version's DDL and ledger row. A lost connection with indeterminate commit status claims neither commit nor rollback. A post-apply probe failure reports that migrations committed but the resulting schema was not accepted; it does not attempt a down migration. Any release failure is nonzero and has no local-store fallback. Any production-startup failure is pre-bind and pre-worker. Diagnostics use an allowlisted projection of stable version/name, statement ordinal, elapsed time, outcome/reason, and sanitized SQLSTATE class only; raw SQL, raw driver text, URLs, credentials, bound values, key material, and arbitrary environment values are forbidden.

**Not buildable / rejected approaches:** No pooled connection may hold the session advisory lock because returning it could strand ownership. No set/subset ledger comparison may replace ordered exact-prefix comparison. The API server may not retain a hidden migration method or elect a startup replica as owner. Versions may not run statement-by-statement outside a transaction, continue after failure, or run non-transactional DDL as an exception. No checksum backfill may claim unrecorded legacy provenance. No external migration framework is introduced in this slice because the embedded manifest has lower adoption risk for the live ledger and equal single-database scope.

## 3. Acceptance criteria (with user stories)

Each criterion is observable without reading source. All are ship-blocking; `test` protects silent correctness and isolation risks. `review` covers exact visible guidance/copy and AC28's direct live-platform observations; AC28 also requires its automated repository/process prerequisite.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 1 | As a release operator, I want a deliberate schema operation so that a release can prepare PostgreSQL before serving. | Given a fresh PostgreSQL database, `api-rust postgres-migrate` exits zero with `work applied` and leaves the ordered ledger and required schema exactly current for that binary. | test |
| 2 | As a release operator, I want a behind database to advance safely so that normal upgrades are repeatable. | Given an ordered exact-prefix ledger, the command applies every missing version in order, exits zero with `work applied`, and ends exactly current. | test |
| 3 | As a release operator, I want idempotent retries so that deployment retries do not replay work. | Given a current usable database, the command exits zero with `already current` and the before/after schema and ledger fingerprints are identical. | test |
| 4 | As a release operator, I want one owner so that deployment jobs cannot overlap schema writes. | Given two command processes released simultaneously against one database, observed critical-section activity has a maximum of one owner and no schema-changing transaction overlaps another. | test |
| 5 | As a contending release operator, I want state reassessed after waiting so that another job's commits are not replayed. | A contender that waits for an owner to finish re-reads history only after acquiring ownership and returns `already current` without reapplying the first process's committed versions. | test |
| 6 | As a service owner, I want atomic versions so that failed DDL cannot remain partially installed. | Given a version with successful DDL followed by a forced failing statement, the command exits nonzero and none of that version's schema objects remain. | test |
| 7 | As a service owner, I want the ledger to tell the truth so that an incomplete version is never advertised. | The forced-failure case in criterion 6 leaves no ledger row for the failing version. | test |
| 8 | As a service owner, I want earlier progress preserved so that atomicity is scoped honestly. | Given one successful version followed by a failing version, the first version's schema effects and ledger row remain committed while the failing version's effects and row are absent. | test |
| 9 | As a service owner, I want failure to stop the sequence so that later migrations never run over an uncertain state. | Given a failing version followed by another version, no statement or ledger row from the later version is observed. | test |
| 10 | As a release operator, I want a corrected retry so that recovery resumes from proved history. | After correcting the failure in criterion 8, a retry starts at the first unapplied version, commits it once, and reaches current without altering the already-committed prefix. | test |
| 11 | As a release operator, I want inconsistent history refused so that the tool never invents repair history. | A hole, reorder, duplicate, or version/name disagreement produces nonzero `unsafe database refused` with reason `inconsistent history` and identical before/after schema and ledger fingerprints. | test |
| 12 | As a release operator, I want future history refused so that an older image cannot downgrade a database. | An unknown recorded version produces nonzero `unsafe database refused` with reason `future history` and identical before/after schema and ledger fingerprints. | test |
| 13 | As a release operator, I want a current-looking but unusable schema refused so that ledger equality is not mistaken for readiness. | A current ledger with a deterministic missing/incompatible required-schema probe produces nonzero `unsafe database refused` with reason `schema incompatible` and performs no repair. | test |
| 14 | As a release operator, I want dependency failures to stop promotion so that absence of evidence never reads as success. | An unreachable database, insufficient inspection permission, invalid manifest, cancellation, or lock timeout exits nonzero with `execution failed`, never emits either success outcome, and performs no unlocked migration work. | test |
| 15 | As deployment automation, I want a closed terminal protocol so that promotion does not scrape prose. | Every parsed command invocation emits exactly one terminal JSON record with the interface fields, a top-level outcome from the four-member set, a reason valid for that outcome, and an exit code consistent with the outcome. | test |
| 16 | As an operator, I want failure claims bounded by proof so that output never lies about commits. | A transaction failure uses reason `transaction failed` and says the failing version was not committed only after rollback or a ledger reread proves absence; a post-apply probe failure says migrations committed; an indeterminate commit uses `commit status unverifiable` and claims neither commit nor rollback. | test |
| 17 | As an operator, I want the migration command isolated from serving so that release preparation cannot accept traffic. | Running the command through every terminal outcome binds no HTTP listener, constructs no application router/state, and starts no scanner, warmer, ensure, or other background worker. | test |
| 18 | As an on-call operator, I want healthy startup preserved so that hardening does not disrupt normal serving. | Given a current usable database, `api-rust serve` completes schema verification before listener/worker evidence and then serves the existing `/api/health` conformance shape. | test |
| 19 | As an on-call operator, I want missing migrations refused so that replicas do not become migration coordinators. | Given an absent or exact-prefix ledger, `api-rust serve` exits nonzero before listener bind or worker start and leaves schema and ledger fingerprints unchanged. | test |
| 20 | As an on-call operator, I want inconsistent history refused so that serving never repairs it. | Given a hole, reorder, duplicate, or version/name disagreement, `api-rust serve` exits nonzero before listener bind or worker start and leaves the database unchanged. | test |
| 21 | As an on-call operator, I want future history refused so that an old release cannot serve against a new schema. | Given an unknown recorded version, `api-rust serve` exits nonzero before listener bind or worker start and leaves the database unchanged. | test |
| 22 | As an on-call operator, I want unusable or unverifiable schemas refused so that the service fails closed. | Given a current-ledger schema mismatch, unreachable database, or insufficient inspection permission, `api-rust serve` exits nonzero before listener bind or worker start and emits the matching closed startup refusal. | test |
| 23 | As a service owner, I want replica startup read-only so that scale cannot create schema races. | Multiple simultaneous serve processes against a current usable database may start, but their combined before/after schema and ledger fingerprints remain identical. | test |
| 24 | As a release operator, I want migration authors held to the atomicity promise so that unsupported DDL cannot silently weaken it. | A test manifest containing PostgreSQL DDL that cannot run in the required transaction fails the real-PostgreSQL release test and is never executed through a non-transactional fallback. | test |
| 25 | As a security owner, I want runtime-only credentials and safe diagnostics so that release output cannot leak secrets. | Canary database URLs, usernames, passwords, query parameters, SQL literals, bound values, and environment secrets are absent from command stdout/stderr, startup output, logs, and conformance receipts across success and every refusal/failure family. | test |
| 26 | As a trader, I want release hardening isolated from analytics so that infrastructure work cannot change my decisions. | After migration and healthy startup, existing public conformance passes and pinned opportunity score, tier, fingerprint, and quantitative golden outputs are byte-identical to their pre-feature expectations. | test |
| 27 | As a maintainer, I want write capability structurally excluded from serving so that a later refactor cannot silently restore startup migration. | The dependency guard passes on the intended graph, fails when a forbidden migration-runner import is injected into the server/state/worker graph, and passes again when the injection is removed. | test |
| 28 | As a release owner, I want deployment order proved so that replicas start only after the schema operation succeeds. | Two ship-blocking parts must both pass. **Machine prerequisite:** the repository/process validator uses the required repository root and exact expected 40-hex git SHA to load immutable `railway.json` bytes from that git object, proves the exact migration command/healthcheck and single success terminal object, and validates the same-revision real-PostgreSQL missing-migrations refusal object. **Live GATE-S review:** QA/GATE S directly observes Railway deployment details for one recorded deployment id, confirms that deployment's same git SHA/image revision and `railway.json` config-source attribution, observes the closed zero-exit terminal object in that deployment's pre-deploy log, then observes Railway `SUCCESS` and `/api/health` `200`. Any missing/mismatched machine evidence or live observation blocks ship; the repository tool does not claim to validate the live part. | review |
| 29 | As a release operator, I want unambiguous guidance and wording so that I know when promotion must stop. | The runbooks place `api-rust postgres-migrate` before replica startup, identify both nonzero outcomes as promotion stops, and use the exact progress, success, refusal, failure, and startup copy in §4 without broader “deployment safe,” “database healthy,” or “release verified” claims. | review |

`test` = automated real-PostgreSQL, process-level, structural, conformance, or golden checks selected by silent-regression risk. `review` = exact copy/runbook inspection or direct live-platform observation recorded by QA/GATE S. No frontend/DOM harness is required because `NO_UI_CHANGE` is binding.

## 4. UI + interaction

`NO_UI_CHANGE`. There is no dashboard route, component, control, notification, trader-visible datum, frontend contract, or design-canon amendment. The interaction surface is the operator CLI and production-startup diagnostics only.

**Flows:** A release operator or deployment job runs `api-rust postgres-migrate`, observes progress, consumes exactly one terminal record, and advances only on `work applied` or `already current`. Production replicas then run `api-rust serve`; current usable schema continues normally, while every other schema/inspection state exits before serving.

**Component states** — browser states are N/A; the complete operational states are:

| Component | default | loading | empty | error | offline/stale |
|---|---|---|---|---|---|
| Migration CLI | Not running; no outcome exists | `checking`, then optionally `waiting` or per-version progress; none implies success | No pending versions becomes terminal `already current`, never an empty result | Exactly one `unsafe database refused` or `execution failed` terminal record with nonzero exit | Unreachable/unverifiable PostgreSQL is an error, never stale-success or local fallback |
| Production startup | Pre-bind schema verification | Bounded connection, ordered-history read, and required-schema probes | Absent or exact-prefix history is “missing migrations” and refuses | Inconsistent, future, incompatible, or unverifiable state refuses before bind/workers | No degraded/offline trader mode starts; the process exits nonzero |

**Copy:** Progress copy is closed and is emitted only for its matching state:

- `checking`: `Checking PostgreSQL schema…`
- `waiting`: `Another migration run is active. Waiting…`
- `version_started`: `Applying migration {version} ({name})…`
- `version_committed`: `Migration {version} ({name}) committed.`
- `version_rolled_back`: `Migration {version} ({name}) rolled back.`

`{version}` is the positive compiled manifest version and `{name}` is its stable manifest name. `version_rolled_back` is emitted only after rollback completes. Terminal `work applied` says `Migrations applied. The PostgreSQL schema is ready for this release.` Terminal `already current` says `No migrations were needed. The PostgreSQL schema is ready for this release.`

Closed release failure/refusal copy is:

- Inconsistent history: `Migration refused: the database migration history is inconsistent with this release.`
- Future history: `Migration refused: the database records migrations newer than this release.`
- Deterministic schema mismatch: `Migration refused: the PostgreSQL schema is incomplete or incompatible with this release.`
- Unverifiable schema: `Migration failed: the PostgreSQL schema could not be verified.`
- PostgreSQL unavailable: `Migration failed: PostgreSQL is unavailable.`
- Migration owner busy: `Migration failed: another migration run remained active past the wait deadline.`
- Transaction rollback proved: `Migration failed. The failing schema version was not committed.`
- Post-apply probe failure: `Migrations were committed, but the resulting PostgreSQL schema was not accepted for this release.`
- Indeterminate commit: `Migration failed. Commit status could not be verified.`
- Invalid manifest: `Migration failed: this release contains an invalid migration manifest.`
- Cancelled: `Migration failed: the migration operation was cancelled.`
- Internal failure: `Migration failed: the migration operation could not complete.`

`Highest committed version: {version}.` is permitted only when a fresh post-failure ledger read proves an exact manifest prefix; it is omitted otherwise. It names only the stable manifest version/name. The transaction-failure sentence is permitted only after rollback completion or a fresh ledger read proves the failing version absent. Earlier versions from the same invocation may remain committed.

Closed production-startup copy is:

- Missing versions: `Startup refused: required PostgreSQL migrations are missing.`
- Inconsistent history: `Startup refused: the PostgreSQL migration history is inconsistent with this release.`
- Future history: `Startup refused: the database records migrations newer than this release.`
- Deterministic schema mismatch: `Startup refused: the PostgreSQL schema is incomplete or incompatible with this release.`
- Unverifiable schema: `Startup refused: the PostgreSQL schema could not be verified.`

All copy remains meaningful without ANSI color. Color may supplement but never carry state. Human text, machine outcome/reason, and process exit status must agree. The command never claims the whole deployment/application/release is safe, healthy, or verified.

<!-- spire:council-resolution:v1 a7b7c448944b35185751734bb52599df195ed3e87f432d7f0fb50c1c4ea26b68 folded -->
<!-- spire:council-resolution:v1 7ed24b8f28d71c09e47f183d5daec9f6f851d69a52b73047ad85be728291ad18 folded -->
<!-- spire:council-resolution:v1 6f12209156ff14c9f242179a2fec8c3635a881545cb62291b41a179f51b0ec1e folded -->
<!-- spire:council-resolution:v1 8d15f95578d65de0b8478ade5ff17038a744806450e54faf9c1163b518c3c84f folded -->

**Design authority:** `NO_UI_CHANGE`; `.spire/clusters/tech/context/DESIGN_SYSTEM.md` is not engaged by an operator-only CLI/startup change.

**Design direction:** No product component or visual pattern is added. Operational output follows the project's honesty rule by showing only states and facts the database boundary can vouch for.

## 5. Error handling

- **Invalid manifest/configuration:** Refuse before database access. Emit nonzero `execution failed` with an allowlisted reason and no raw environment value.
- **Lock contention:** Emit waiting progress while polling. At the bounded deadline, emit nonzero `execution failed` / `migration owner busy`; never proceed unlocked. A later deployment retry is safe.
- **Inconsistent/future/unusable database:** Emit nonzero `unsafe database refused` with the distinct reason/copy in §4. Do not repair, reorder, downgrade, or mutate.
- **Transaction statement failure:** Stop the sequence and roll back the active version. Use the proved-rollback copy only after rollback or ledger reread establishes absence. Earlier committed versions remain; later versions are untouched. A corrected command invocation is the retry.
- **Connection loss around commit:** If the ledger cannot prove commit or rollback, emit nonzero `execution failed` / `commit status unverifiable` and claim neither. Operator investigation/retry begins with a fresh exact-history read.
- **Post-apply required-schema probe failure:** Emit nonzero `execution failed` / `post-apply schema rejected` and state that migrations committed but the schema was not accepted. Do not attempt an automatic down migration.
- **Connectivity/permission/probe-execution failure:** Emit a sanitized nonzero execution failure; never rename an unclassified state as incomplete or inconsistent and never fall back to a local store.
- **Production startup refusal:** Emit the matching closed startup copy and exit before listener/router/worker side effects. Startup never retries by applying migrations and never waits on the writer lock.
- **Diagnostics/logging:** Log only allowlisted stable fields. Raw `sqlx` errors and SQL text are not serialized. A sanitized SQLSTATE class may be logged when available; stdout remains the JSON Lines protocol and carries exactly one terminal record.

## 6. Interface — pointer  ← THE LOAD-BEARING LINK

**Interface:** `.spire/clusters/tech/contracts/postgres-release-safety/INTERFACE_CONTRACT.md`
**Summary for readers of this spec:** This backend-only feature adds the operator command contract and changes no public HTTP endpoint or response field. The companion file defines the command/output/exit truth and pins the existing anonymous `/api/health` shape as live conformance evidence after successful startup.

## 7. Testing strategy

- Pure unit tests validate the manifest and every ordered-history classification, including duplicate/non-increasing versions, duplicate names, empty/unsplittable bodies, exact prefixes, holes, reordered/renamed entries, and future versions.
- Real-PostgreSQL integration tests own concurrency, bounded lock behavior, session teardown, per-version DDL+ledger atomicity, earlier-version persistence, later-version suppression, corrected retry, unsupported non-transactional DDL refusal, deterministic schema probes, and read-only multi-replica startup. They extend the repository's existing Postgres CI service and may not be skipped or replaced by a simulated database.
- Process-level CLI tests parse every progress/terminal line, assert exactly one terminal object, verify outcome/reason/exit parity and exact copy, and scan stdout/stderr/log/receipt bytes for canary secrets, raw SQL, and connection values.
- Startup integration tests assert the sequence of schema-check, listener-bound, and worker-start events and fingerprint the database before/after every refusal class. A current-schema positive control must bind and pass `/api/health` conformance.
- A mutation-tested dependency guard poisons the server/state/worker graph with a migration-runner import and must turn the build red; its clean graph and restoration are the accepting controls.
- Existing public interface conformance and score/tier/fingerprint/quantitative golden suites protect the intentionally empty product/API/math delta.
- AC28 has two evidence owners. The real-PostgreSQL CI process test writes the same-revision missing-migrations startup-refusal object. The repository tool's `produce` and independent `validate` commands both require `--repository-root` and exact lowercase 40-hex `--expected-git-sha`; they resolve the canonical git toplevel, use `git cat-file -e <sha>^{commit}` and `git show <sha>:railway.json`, never read working-tree config bytes, and validate only immutable config plus the supplied terminal/negative-control objects. They emit `.spire/clusters/tech/state/conformance/postgres-release-safety-repository.json`, explicitly scoped to repository/process evidence. Separately, QA or GATE S—whichever has live host access—uses current Railway tooling to inspect the live deployment details and logs, records a `Live Railway review` block with project/environment/service/deployment id and same SHA/image revision in `QA_REPORT.md` or the GATE-S ship evidence before ship closure, confirms the config source and exact terminal object, and records observed `SUCCESS` plus live `/api/health` `200`. That direct review is the final AC28 verdict. No opaque live locator, fixed live status/health value, or caller chronology enters the repository tool or receipt.
- Exact runbook ordering and wording are reviewed once; behavioral and negative-space claims remain automated because they can regress silently.

## 8. Guardrails this feature must not break

- **`[structural-over-prose-enforcement]`:** the writer/verifier type and module split, per-version transaction, dedicated-session lock, and mutation-proved dependency guard make forbidden startup migration impossible or build-breaking; prose alone is not evidence.
- **`[no-secrets-in-image]`:** the existing non-root image gains the command but no credential. `DATABASE_URL` and every secret remain runtime-injected; command output, logs, tests, and receipts exclude secret values and raw SQL.
- **`[cited-code-is-verified-not-assumed]`:** source-verified Rust paths and current `railway.json` are named directly. Railway pre-deploy/config-source/lifecycle claims are bound to the official authorities cited in §2.4 and to deployment-details evidence for the target release.
- **`[production-fails-closed]` (watch):** release failures are nonzero with no fallback, startup never mutates, and absent, incomplete, inconsistent, future, unreachable, or unusable PostgreSQL stops before listener/worker effects.
- Existing trading and quantitative outputs remain untouched: no change to the entry gate, `opportunity_score`, `opportunity_tier`, `state_fingerprint`, or quant-engine calculations is authorized.

## 9. Open questions

None. The Railway lifecycle mechanism is settled by the verified authority in §2.4; target-release config, terminal, deployment-status, health, and negative-control evidence remain ship-blocking proof rather than open design.

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"source":"R2-architect.md","index":0,"conflict_id":"a7b7c448944b35185751734bb52599df195ed3e87f432d7f0fb50c1c4ea26b68","disposition":"folded","section":"§4"},{"source":"R2-pm.md","index":0,"conflict_id":"7ed24b8f28d71c09e47f183d5daec9f6f851d69a52b73047ad85be728291ad18","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":0,"conflict_id":"6f12209156ff14c9f242179a2fec8c3635a881545cb62291b41a179f51b0ec1e","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":1,"conflict_id":"8d15f95578d65de0b8478ade5ff17038a744806450e54faf9c1163b518c3c84f","disposition":"folded","section":"§4"}]}
-->
