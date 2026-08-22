# postgres-release-safety — implementation plan

> **For the backend executioner:** execute B0 through B6 in order from the workspace root. Every
> implementation task uses failing test → observe the named failure → smallest implementation →
> observe pass → commit. If a step contradicts the current tree or the locked contracts, stop and
> report the conflict; do not weaken the atomic-version, read-only-startup, evidence, or output claims.

**Goal:** make PostgreSQL schema changes an explicit, serialized release operation while making
production API startup a strictly read-only readiness check that refuses before listener or worker
side effects when the database is not exactly ready for the running release.

**Architecture:** `migrations.rs` becomes the immutable manifest and SQL-validation authority;
`migration_runner.rs` is the sole writer and owns one dedicated session, a bounded advisory lock, and
one transaction per version; `schema_verifier.rs` is the shared read-only history/probe capability.
The `postgres-migrate` CLI reaches the writer without constructing `AppState`; `serve` reaches only the
verifier. Railway runs the exact migration command from the built image before deployment and uses the
existing health endpoint as its configured health check.

**Tech stack:** Rust 2021, Tokio, SQLx 0.8 with the existing `postgres` feature, Clap and Serde JSON;
PostgreSQL 17 in GitHub Actions; Node 24 built-ins for the repository receipt tool; Railway
config-as-code; existing Axum `/api/health` conformance. Backend-only, `NO_UI_CHANGE`,
`NO_PUBLIC_HTTP_CHANGE`.

## Track map

| Track | Tasks | Execution shape |
|---|---|---|
| Backend | B0–B6 | One sequential executioner. The manifest, writer, verifier, CLI, startup, process tests, and release evidence repeatedly cross the same database/bootstrap seams, so splitting them would create overlapping ownership. |
| Frontend | none | Intentionally empty. No file under `apps/dashboard/**`, `apps/dashboard-e2e/**`, or `libs/api/**` may change. |
| Verification | V1–V10 | Runs after B6. Real PostgreSQL and the live Railway review are mandatory; neither may be replaced by a fake database or local prose. |

## Global Constraints

- The only schema writer is `apps/api/src/db/migration_runner.rs`, reached only by the
  `postgres-migrate` CLI. `serve`, `server.rs`, `state.rs`, routes, workers, and durable-store adapters
  cannot import or call it.
- Validate the complete manifest before reading `DATABASE_URL` or opening PostgreSQL. Compare ordered
  `(version, name)` pairs, never sets and never version-only history. Do not add checksums to the legacy
  ledger.
- The release command uses `PgConnection`, not `PgPool`. It must own the fixed session advisory lock
  before ledger bootstrap or any state read that authorizes a write, then re-read under the lock.
- Every pending version is one SQLx transaction containing all split statements and the ledger insert.
  No statement-by-statement commit, `ON CONFLICT DO NOTHING`, non-transactional escape hatch, repair,
  down migration, or continuation after a failure is allowed.
- `serve` opens a bounded pool without DDL, ledger insert, transaction, or advisory-lock calls. It
  accepts only exact current history plus all required-schema probes and refuses before router, listener,
  or worker evidence otherwise.
- stdout for `postgres-migrate` is JSON Lines only: zero or more progress objects and exactly one
  terminal object. All human copy, reason/outcome, and exit status must match the contract. Tracing and
  sanitized SQLSTATE class diagnostics stay on stderr.
- Never serialize raw SQL, SQL previews, `sqlx`/driver error text, connection strings, credentials,
  query parameters, bound values, arbitrary environment values, or secret-bearing receipt fields.
- `MIGRATION_LOCK_TIMEOUT_SECONDS` is `1..=3600`, default `120`; invalid input fails closed before
  PostgreSQL with `execution failed` / `internal failure`. Lock expiry is `execution failed` /
  `migration owner busy`.
- The current official Railway authority is binding: `deploy.preDeployCommand` runs from the built
  application image before deployment in a separate container, has service env/private-network access,
  stops deployment on nonzero exit, and has no mounted volume. Config-as-code defines
  `deploy.preDeployCommand`, and committed config overrides dashboard settings for that deployment.
  Do not claim filesystem persistence. If these semantics cannot be re-confirmed from
  <https://docs.railway.com/deployments/pre-deploy-command> and
  <https://docs.railway.com/config-as-code/reference> at B5, stop and report a host-authority blocker.
- AC28 ownership is concrete: **the root GATE-S release conductor is the accountable live Railway
  reviewer**. QA owns the independent repository/process receipt validation and may also perform the
  live review if it has host access, but the root GATE-S conductor must record the final `Live Railway
  review` block, reviewer identity, project/environment/service/deployment ids, expected SHA and image
  revision, config-source observation, exact terminal-object comparison, Railway `SUCCESS`, and direct
  health `200` before ship closure.
- `libs/quant-engine/**`, scoring, entry gate, fingerprint code, public routes/responses, and all frontend
  paths are read-only. Preserve current score/tier/fingerprint and quantitative goldens.
- Use `cargo fmt`, not a repository-wide formatter. Stage and commit only task-owned paths; preserve all
  unrelated dirty workspace changes.

The following block is copied verbatim from `INTERFACE_CONTRACT.md`.

## Conformance spec

The live runner starts only after the release command has produced a zero-exit terminal outcome. It checks the unchanged anonymous health response; operational CLI, pre-bind refusal, database mutation, concurrency, and host ordering are process/database/deployment evidence and cannot be represented as HTTP endpoints.

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/health",
      "path_params": {},
      "query": {},
      "required": {
        "status": "string",
        "service": "string",
        "durable_store": "string",
        "metrics_auth": "string"
      }
    }
  ]
}
```

## Ground truth before implementation

- `apps/api/src/db/migrations.rs` currently holds twelve ordered `(version, name, SQL)` tuples but its
  `apply` function executes each statement and ledger insert separately. It logs raw driver errors and a
  SQL preview; both must disappear.
- `apps/api/src/db/postgres.rs::connect_strict` currently compares version sets, invokes
  `pg.migrate()`, and therefore mutates during production startup. `Pg::connect` also attempts migration.
- `apps/api/src/runtime_guardrails/preflight.rs` calls `Pg::connect_strict`; `server.rs` already orders
  schema preflight before archive probe, state construction, listener bind, and worker start. Preserve
  that outer order while replacing the schema mechanism.
- `apps/api/src/state.rs` accepts the preflighted production `Pg`; non-production Postgres construction
  currently uses the mutating `Pg::connect` path. Remove migration ownership from both pool constructors.
- `apps/api/src/main.rs` has a Clap subcommand dispatcher and one generic error printer. The migration
  arm must bypass the generic printer so every expected failure still emits exactly one terminal JSON
  object and no alternate stdout protocol.
- `.github/workflows/ci.yml` already provides PostgreSQL 17 and runs the production guardrail harness;
  extend that same unskippable backend job.
- `railway.json` currently contains only `build.watchPatterns`; it has no `deploy` object.
- Baseline observed at planning: `cargo test -p api-rust -p quant-engine -- --list` enumerates exactly
  **637 tests**; `cargo test -p api-rust --features postgres --lib -- --list` enumerates exactly
  **453 tests**. B0 records fresh baseline output before edits rather than assuming no concurrent work.

---

### Task B0 — Lock the manifest and read-only state model

**Files:** `apps/api/src/db/migrations.rs`; `apps/api/src/db/schema_verifier.rs` (create);
`apps/api/src/db/mod.rs`.

1. Record the current results and exact counts:

```powershell
cargo test -p api-rust -p quant-engine
cargo test -p api-rust --features postgres --lib -- --list
git diff --stat -- apps/dashboard apps/dashboard-e2e libs/api libs/quant-engine
```

Expected baseline: both Cargo commands exit 0; the first runs 637 tests and the postgres library list
contains 453; the protected-tree diff is empty for this feature. If concurrent changes alter counts,
record the actual named baseline in the commit and carry the delta forward rather than deleting tests.

2. First add failing table-driven tests in the two owned Rust modules. They must cover positive,
strictly increasing unique versions; unique non-empty names; non-empty and splittable SQL; empty,
duplicate, non-increasing, duplicate-name, empty-body, and unterminated-body rejection; and the complete
ordered-history matrix (absent, empty/exact prefix, current, hole, reorder, duplicate, renamed known
version, and unknown future version). The six exact new test names are
`compiled_manifest_validates_and_preserves_twelve`,
`invalid_manifest_matrix_refuses_before_database_access`,
`classification_absent_empty_prefix_and_current_is_ordered`,
`classification_hole_reorder_duplicate_and_rename_is_diverged`,
`classification_unknown_version_is_future`, and
`verifier_probe_and_startup_failure_vocabulary_is_closed`. Observe the named tests fail.

3. Replace raw tuples at the authority boundary with these concrete shapes; keep the twelve SQL bodies
byte-identical:

```rust
#[derive(Debug, Clone, Copy)]
pub struct Migration {
    pub version: i64,
    pub name: &'static str,
    pub sql: &'static str,
}

#[derive(Debug, Clone)]
pub struct ValidatedMigration {
    pub version: i64,
    pub name: &'static str,
    pub statements: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct ValidatedManifest {
    pub entries: Vec<ValidatedMigration>,
    pub target_version: i64,
}

pub fn validate_manifest(entries: &[Migration]) -> Result<ValidatedManifest, ManifestError>;
pub fn compiled_migrations() -> &'static [Migration];
```

`validate_manifest` performs every check and split in one pass before returning. Remove `apply`,
`table_exists`, the `PgPool` import, raw driver formatting, SQL preview logging, and the legacy
version-stamping branch. Preserve `split_sql_statements` as the one PostgreSQL-aware splitter.

4. Create the read-only model in `schema_verifier.rs`:

```rust
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct LedgerEntry { pub version: i64, pub name: String }

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HistoryState { Absent, PendingSuffix, Current, Diverged, Future }

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VerificationFailure { Missing, Inconsistent, Future, Incompatible, Unverifiable }

pub fn classify_history(manifest: &ValidatedManifest, ledger: Option<&[LedgerEntry]>) -> HistoryState;
pub async fn verify_pool(pool: &sqlx::PgPool, manifest: &ValidatedManifest)
    -> Result<(), VerificationFailure>;
pub(crate) async fn verify_connection(
    connection: &mut sqlx::PgConnection,
    manifest: &ValidatedManifest,
) -> Result<HistoryState, VerificationFailure>;
```

The classifier checks unknown versions before ordinary mismatch only when an actual ledger entry has a
version not in the manifest; otherwise a hole/reorder/duplicate/name mismatch is `Diverged`. Database
reads first use `to_regclass('public.schema_migrations')`, then select ordered `version,name`; probes move
unchanged from `postgres.rs` and execute only for `Current`. The module contains no `CREATE`, `ALTER`,
`DROP`, `INSERT`, `UPDATE`, `DELETE`, transaction, or advisory-lock operation.

5. Export `migrations` and `schema_verifier` behind the existing postgres feature. Do not export
`migration_runner` yet. Run the named tests and postgres library suite; commit:
`refactor(postgres): validate manifest and classify schema read-only`.

**Reviewer probe:** poison the manifest with a duplicate name and the test fails before any database
fixture is opened; poison an ordered ledger name and it becomes `Diverged`, not `PendingSuffix`.

---

### Task B1 — Implement the dedicated-session transactional migration runner

**Files:** `apps/api/src/db/migration_runner.rs` (create); `apps/api/src/db/mod.rs`.

1. Add failing unit and real-PostgreSQL tests inside `migration_runner.rs` under `#[cfg(test)]`. The
private test harness may inject a `&[Migration]`, but no production environment variable, file, or public
API may replace the compiled manifest. Tests use `TEST_DATABASE_URL`, create uniquely named disposable
databases, and fail rather than skip when it is absent in the CI command. Add exactly four pure tests
(`event_schema_state_and_copy_matrix_is_exact`, `terminal_reason_outcome_exit_matrix_is_closed`,
`lock_timeout_configuration_matrix_is_bounded`, `safe_diagnostic_projection_rejects_canaries`) and the
six real-PG tests named in step 6. Together with B0, this is the sixteen-test postgres-library delta used
by V2.

2. Implement the closed event/result vocabulary exactly:

```rust
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(untagged)]
pub enum CommandEvent {
    Progress(ProgressRecord),
    Terminal(TerminalRecord),
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct ProgressRecord {
    pub schema_version: u8,
    pub kind: ProgressKind,
    pub state: ProgressState,
    pub message: String,
    pub elapsed_ms: u64,
    pub version: Option<i64>,
    pub name: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub enum ProgressKind { #[serde(rename = "progress")] Progress }

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub enum TerminalKind { #[serde(rename = "terminal")] Terminal }

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct TerminalRecord {
    pub schema_version: u8,
    pub kind: TerminalKind,
    pub outcome: TerminalOutcome,
    pub reason: TerminalReason,
    pub message: String,
    pub target_version: Option<i64>,
    pub highest_committed_version: Option<i64>,
    pub failing_version: Option<i64>,
    pub elapsed_ms: u64,
}

pub struct CommandResult { pub terminal: TerminalRecord, pub exit_code: u8 }
pub async fn run_compiled(emitter: &mut dyn EventEmitter) -> CommandResult;
```

Use closed Rust enums with explicit Serde spellings for every interface token. Constructors, not callers,
pair outcome/reason/message/exit. `EventEmitter` writes one compact JSON object plus `\n` per call and
tracks whether a terminal was already emitted; a second terminal is an error in tests and impossible in
the public runner.

3. Validate the compiled manifest and timeout before reading `DATABASE_URL`. Connect with
`sqlx::PgConnection::connect`, never a pool. Use the fixed signed `i64` lock key and this bounded loop:

```rust
loop {
    let owned: bool = sqlx::query_scalar("SELECT pg_try_advisory_lock($1)")
        .bind(CONVEXA_MIGRATION_LOCK_KEY)
        .fetch_one(&mut connection)
        .await?;
    if owned { break; }
    emitter.waiting(started.elapsed());
    if started.elapsed() >= timeout { return owner_busy(...); }
    tokio::time::sleep(std::cmp::min(Duration::from_millis(250), remaining)).await;
}
```

After ownership, create `schema_migrations` with its existing three columns, re-read/classify history,
and refuse diverged/future without mutation beyond the absent-ledger bootstrap authorized by the
contract. Do not use a pre-lock classification to select work.

4. Apply each pending version using one `connection.begin()` transaction. Execute every already-split
statement against `&mut *transaction`, then use a plain ledger insert:

```sql
INSERT INTO schema_migrations (version, name) VALUES ($1, $2)
```

Commit before advancing. On statement/insert failure, explicitly roll back; emit `version_rolled_back`
only after rollback returns success. Stop immediately. Earlier committed versions remain and later
versions are untouched. Never use `ON CONFLICT`, `execute_many`, or a non-transactional fallback.

5. After work, re-read exact history and run required probes on the same dedicated connection. Map a
deterministic current-history probe mismatch to the contract's schema outcome; map a post-apply probe
failure to `post-apply schema rejected`. On commit error, perform only a fresh bounded ledger read; if it
cannot prove an exact prefix, return `commit status unverifiable` and make no commit/rollback claim.
Explicitly run `pg_advisory_unlock` when the connection remains usable, then close it; all early returns
flow through one cleanup owner. Session teardown is the fallback release.

6. Permit stderr diagnostics only through an allowlisted type:

```rust
struct SafeDiagnostic {
    phase: &'static str,
    version: Option<i64>,
    statement_ordinal: Option<usize>,
    sqlstate_class: Option<String>,
}
```

Never format an error with `{e}`, `{:?}`, a query, a URL, or an environment value. Run the six planned
real-PG runner tests: `runner_fresh_prefix_and_current_matrix`,
`runner_concurrency_has_one_owner_and_post_lock_reread`,
`runner_rollback_preserves_only_prefix_stops_later_and_retry_resumes`,
`runner_diverged_future_and_incompatible_matrix_is_non_mutating`,
`runner_lock_timeout_and_session_teardown_release_ownership`, and
`runner_unsupported_ddl_and_indeterminate_commit_have_no_fallback`. Commit:
`feat(postgres): add single-owner atomic migration runner`.

**Reviewer probe:** change one version loop to execute on `connection` instead of `transaction`; the
rollback test must leave an object behind and fail. Remove the post-lock reread; the contender test fails.

---

### Task B2 — Add the closed `postgres-migrate` process command

**Files:** `apps/api/src/main.rs`; `apps/api/src/db/mod.rs`;
`apps/api/tests/postgres_release_safety_postgres.rs` (create).

1. Add failing Clap/process tests for exact command presence with `--features postgres`, success and all
failure exit families, JSONL parsing, exact field sets/copy, and secret canaries. Build the test binary
once and spawn it with isolated environment maps. Do not parse stderr to decide success.

2. Add `Commands::PostgresMigrate` behind `#[cfg(feature = "postgres")]`. Expose only one narrow library
entry from `db/mod.rs`:

```rust
#[cfg(feature = "postgres")]
mod migration_runner;

#[cfg(feature = "postgres")]
pub async fn postgres_migrate_cli() -> std::process::ExitCode {
    migration_runner::run_stdout().await
}
```

No writer type, injected manifest, lock method, transaction method, or apply method is public. In
`main`, dispatch this command directly to `postgres_migrate_cli()` after logging initialization and
before the generic `run(cli)` error printer. Every other command retains current behavior. This command
must never call `Config::from_env`, `server::serve`, `AppState`, router code, vendor/cache/archive openers,
or worker starters.

3. The process tests must parse every stdout line as `CommandEvent`, assert exactly one terminal and that
it is last, assert no ANSI, and compare exact key sets. Cover each progress state and every legal terminal
pair through real database setup or a private runner test where an OS-level failure cannot be made
deterministic. Capture stdout/stderr with canaries in URL username/password/query, SQL literal, and
unrelated environment secret; assert no canary or raw SQL occurs.

4. Add cancellation handling using a cancellation future owned by the runner. Cancellation before lock
or between versions yields the exact `cancelled` terminal; cancellation does not interrupt a commit and
invent its status. Run the focused process suite and commit:
`feat(postgres): expose closed release migration command`.

**Reviewer probe:** route a migration error through main's generic `eprintln!("error: {e:#}")`; the exact
one-terminal/redaction process test must fail.

---

### Task B3 — Make all API startup paths read-only and fail closed

**Files:** `apps/api/src/db/postgres.rs`; `apps/api/src/runtime_guardrails/preflight.rs`;
`apps/api/src/state.rs`; `apps/api/src/server.rs`;
`apps/api/tests/postgres_release_safety_postgres.rs`.

1. First extend the real-PG process suite with current-schema positive startup, absent/prefix/diverged/
future/incompatible/unverifiable refusal matrices, simultaneous serve processes, database fingerprints,
and listener/worker event observation. Observe current startup mutate fresh/prefix databases and fail the
new assertions.

2. Delete `Pg::migrate` and all calls to `migrations::apply`. Pool construction is now only:

```rust
pub async fn connect(database_url: &str) -> AppResult<Self>;
pub async fn connect_strict(database_url: &str) -> AppResult<Self> {
    let pg = Self::connect(database_url).await?;
    let manifest = migrations::validate_manifest(migrations::compiled_migrations())
        .map_err(|_| safe_config_error())?;
    schema_verifier::verify_pool(&pg.pool, &manifest)
        .await
        .map_err(map_startup_verification)?;
    Ok(pg)
}
```

`connect` opens the pool and performs no schema operation; `connect_strict` adds only verifier reads.
Remove set/subset version comparisons and raw `sqlx` error formatting. Non-production `AppState` may
degrade to local stores on connection failure as before, but it may not migrate a configured database.

3. Preserve the server phase order while mapping verifier outcomes to exact startup messages. Emit a
schema-verification-started event before the read and schema-verification-finished only after current
history/probes. Refusals return before archive probe, state/router construction, listener bind, or any
worker start. `serve` never waits on the migration advisory lock.

4. Fingerprint the schema and ledger before and after each refusal and simultaneous-start case using a
canonical sorted metadata query hashed by the test harness. The positive case must observe verifier
finish before listener/worker events and issue a real `GET /api/health`, retaining its existing shape.
Run the real-PG process suite and current production guardrail suite; commit:
`refactor(postgres): verify schema read-only before serving`.

**Reviewer probe:** add `crate::db::postgres::Pg::migrate()` to preflight or state construction; the
fingerprint and structural tests must fail before a listener appears.

---

### Task B4 — Prove isolation, real-PostgreSQL behavior, and CI enforcement

**Files:** `apps/api/tests/postgres_release_safety_isolation.rs` (create);
`apps/api/tests/postgres_release_safety_postgres.rs`; `.github/workflows/ci.yml`.

1. Create exactly six non-Postgres structural tests:

- `writer_is_reachable_only_from_the_cli_entry_and_guard_bites`
- `serve_graph_contains_no_ddl_transaction_or_advisory_lock_and_guard_bites`
- `migration_command_contains_no_app_state_router_vendor_cache_archive_or_worker_and_guard_bites`
- `migration_and_startup_paths_do_not_import_quant_scoring_gate_or_fingerprint`
- `terminal_diagnostics_and_receipt_paths_reject_secret_egress_and_guard_bites`
- `public_http_and_frontend_contract_paths_have_no_feature_diff`

The first three must call the scan predicate with a poisoned source string and assert it detects the
violation. Scan concrete server/state/route/worker paths recursively; assert a nonzero inspected-file
count. The last test checks the protected source paths or locked public route definitions without
rewriting them.

2. Finish `postgres_release_safety_postgres.rs` at exactly eight top-level tests, using matrices inside
each test:

- `cli_fresh_prefix_current_jsonl_and_exit_contract`
- `cli_refusal_failure_cancellation_and_secret_matrix`
- `two_release_processes_have_one_owner_and_contender_rereads`
- `atomic_version_failure_preserves_only_proved_prefix_and_retry_resumes`
- `serve_current_binds_after_verify_and_health_shape_is_unchanged`
- `serve_refusal_matrix_is_read_only_pre_bind_pre_worker`
- `simultaneous_serve_processes_are_read_only`
- `same_revision_missing_migrations_negative_control_is_closed`

The final test writes the exact negative-control object only when
`POSTGRES_RELEASE_NEGATIVE_CONTROL_OUT` is set. It obtains `git_sha` from required
`RELEASE_GIT_SHA`, validates lowercase 40-hex, records only contract fields, and computes equal SHA-256
fingerprints. It must not invent a local success object.

3. Extend the backend CI job with an unskippable step before the release build:

```yaml
- name: PostgreSQL release safety
  run: cargo test -p api-rust --features postgres --test postgres_release_safety_postgres -- --nocapture
  env:
    TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/convexa_test
    RELEASE_GIT_SHA: ${{ github.sha }}
    POSTGRES_RELEASE_NEGATIVE_CONTROL_OUT: ${{ runner.temp }}/postgres-release-negative-control.json
```

Upload the negative-control file as a named artifact in a following `if: always()` step, but make a
missing file fail the test step. Keep the existing production guardrail and release-build steps.

4. Run default tests (baseline 637 + exactly six new structural tests = **643**) and the eight-test
real-PG file. Commit: `test(postgres): enforce release safety in real postgres CI`.

**Reviewer probe:** temporarily import `migration_runner` in `server.rs`; the isolation suite turns red.
Temporarily remove the CI step; the workflow-source assertion turns red.

---

### Task B5 — Bind Railway config, deterministic receipt tooling, and operator guidance

**Files:** `railway.json`; `tools/postgres-release-receipt.mjs` (create);
`tools/postgres-release-receipt.spec.mjs` (create); `docs/DEPLOY_RUNBOOK.md`;
`docs/API_RUST_DEPLOY.md`.

1. **Host-authority precondition:** re-open both official Railway pages named in Global Constraints and
record the access date and verified claims in the B5 commit body. Stop before editing if
`deploy.preDeployCommand` no longer runs from the built image before deployment, nonzero no longer blocks,
config-as-code no longer overrides dashboard values, or deployment details no longer expose the config
source. The separate container has no volume: the migration command must use only `DATABASE_URL` and may
not inspect `SESSION_CHAIN_ARCHIVE_BODY_ROOT`.

2. First write exactly ten Node tests covering: canonical repository root; immutable commit/blob lookup;
wrong/missing SHA/root/blob; exact command/health path; terminal exact schema and success arms; negative
control exact schema; receipt raw-byte hashes; every forbidden key/pattern; working-tree mutation ignored;
all live-host/timestamp/locator flags rejected; producer/validator independent recomputation; and one
complete accepting round trip. Use a temporary Git repository created by the test, commit
`railway.json`, then mutate its working tree to prove `git show <sha>:railway.json` is the authority.

3. Implement the Node CLI using only built-in `node:fs`, `node:path`, `node:crypto`,
`node:child_process`, and `node:url`. Parse arguments through a closed allowlist per subcommand; reject
duplicates, unknown flags, missing values, timestamps, duration/order flags, deployment ids/status,
health results, image revisions, host logs, locators, or config-source claims. Export pure validators for
the test file, and run `main()` only when invoked directly.

Both `produce` and `validate` must:

- canonicalize `--repository-root`, compare it to `git rev-parse --show-toplevel`, require exact lowercase
  40-hex SHA, and run `git cat-file -e <sha>^{commit}`;
- read raw bytes only from `git show <sha>:railway.json`, parse them, require
  `deploy.preDeployCommand` exactly `['api-rust postgres-migrate']` and `deploy.healthcheckPath` exactly
  `/api/health`, and hash those immutable raw bytes;
- parse one terminal-object file and one negative-control file with exact key-set/type/value validation;
- recursively apply the contract denylist and three value regexes before constructing output;
- compute SHA-256 from each exact input file's raw bytes and emit the closed receipt with
  `scope: 'repository_and_process_only'` and `result: 'PASS'` only.

`validate` independently recomputes every value/hash from the same explicit inputs and deep-compares the
closed receipt; it must not trust stored derived fields.

4. Add the exact deploy config while preserving `build.watchPatterns`:

```json
"deploy": {
  "preDeployCommand": ["api-rust postgres-migrate"],
  "healthcheckPath": "/api/health"
}
```

Do not add volume commands, shell redirection, credentials, retries, or a second migration owner.

5. Rewrite the two deployment documents so the release order is: target image built → Railway
pre-deploy `api-rust postgres-migrate` → stop promotion on either nonzero outcome → start replica →
health check. Include every exact progress/terminal/startup copy from SPEC §4, explain exact-prefix versus
inconsistent/future history, and state earlier versions may remain committed when a later version fails.
Remove language saying startup applies migrations or that migration success proves the whole deployment
safe/healthy/verified.

6. Add a `Live Railway review` checklist naming the **root GATE-S release conductor** as accountable
reviewer and QA as independent machine-receipt validator. It must require project, environment, service,
deployment id, expected SHA/image revision, `railway.json` source attribution, exact observed terminal
object, Railway `SUCCESS`, and direct `/api/health` 200. State explicitly that the machine receipt does
not prove these host observations.

7. Run the ten Node tests and scoped Prettier check; commit:
`feat(release): enforce railway migration gate and evidence`.

**Reviewer probe:** mutate working-tree `railway.json` after committing the expected SHA; the tool still
validates the committed blob. Change the committed command or add `deployment_id` to an input; validation
fails.

---

### Task B6-backend-closer — Run the integrated service and write only conformance evidence

**Files:** `.spire/clusters/tech/contracts/postgres-release-safety/conformance-receipt.json`.

**Depends on:** B0, B1, B2, B3, B4, B5. This is the sole backend closer. It does not edit or
re-implement worker-owned source, workflow, config, tool, test, or documentation paths.

1. Start from a disposable real PostgreSQL database. Run the built target revision's
`api-rust postgres-migrate`, save its one terminal object separately from progress output, and require
exit 0. Then start `api-rust serve` with a valid production profile and the current schema.

2. Run the interface conformance command from V7 and write only the generic conformance receipt at the
owned path. Expected: one endpoint checked, one passed, zero failed.

3. Hand the exact terminal-object file, same-SHA CI negative-control artifact, expected 40-hex SHA, and
canonical repository root to QA for independent repository receipt validation. Do not fabricate a live
Railway review or write a live PASS locally.

4. Report the listening URL/process id and stop the local server after QA capture. Commit the conformance
receipt only if current repository practice tracks it; otherwise leave it as gate evidence and report its
path.

**Reviewer probe:** starting `serve` before the migration command must refuse without opening the
conformance URL; after migration it must pass exactly 1/1.

## Independence

All backend rows are `no`. B0–B4 deliberately overlap the same database modules and real-PG harness;
B5 owns disjoint release files but depends on the final command/evidence shape; B6 is the mandatory
integrated closer. There is no frontend work and therefore no frontend closer.

| Task | Lane | Paths | Depends on | Independent |
|---|---|---|---|---|
| B0 | backend | `apps/api/src/db/migrations.rs`; `apps/api/src/db/schema_verifier.rs`; `apps/api/src/db/mod.rs` | — | no |
| B1 | backend | `apps/api/src/db/migration_runner.rs`; `apps/api/src/db/mod.rs` | B0 | no |
| B2 | backend | `apps/api/src/main.rs`; `apps/api/src/db/mod.rs`; `apps/api/tests/postgres_release_safety_postgres.rs` | B1 | no |
| B3 | backend | `apps/api/src/db/postgres.rs`; `apps/api/src/runtime_guardrails/preflight.rs`; `apps/api/src/state.rs`; `apps/api/src/server.rs`; `apps/api/tests/postgres_release_safety_postgres.rs` | B2 | no |
| B4 | backend | `apps/api/tests/postgres_release_safety_isolation.rs`; `apps/api/tests/postgres_release_safety_postgres.rs`; `.github/workflows/ci.yml` | B3 | no |
| B5 | backend | `railway.json`; `tools/postgres-release-receipt.mjs`; `tools/postgres-release-receipt.spec.mjs`; `docs/DEPLOY_RUNBOOK.md`; `docs/API_RUST_DEPLOY.md` | B4 | no |
| B6-backend-closer | backend | `.spire/clusters/tech/contracts/postgres-release-safety/conformance-receipt.json` | B0, B1, B2, B3, B4, B5 | no |

## Verification track

Run in order after B6. Check `$LASTEXITCODE` after every command. Any unavailable real PostgreSQL or
Railway access is `UNVERIFIABLE` and ship-blocking, not a pass.

### V1 — Default Rust regression and protected-tree fence

```powershell
cargo test -p api-rust -p quant-engine
git diff --stat -- apps/dashboard apps/dashboard-e2e libs/api libs/quant-engine
```

Expected: Cargo exits 0 with **643 tests** when no concurrent test additions occurred (637 recorded
baseline + six B4 structural tests); the protected-tree diff is empty for this feature. If B0 recorded a
different baseline because of concurrent work, expected count is that recorded baseline + six.

### V2 — Postgres library mechanisms

```powershell
$env:TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/convexa_test'
cargo test -p api-rust --features postgres --lib -- --nocapture
```

Expected: exit 0 with **469 library tests** when the 453-test planning baseline still applies: exactly
sixteen B0/B1 tests cover manifest validation, closed classification/vocabulary, redaction, and the six
real-PG runner matrices. No test is ignored or skipped.

### V3 — Real-PostgreSQL process/startup suite

```powershell
$env:TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/convexa_test'
$env:RELEASE_GIT_SHA=(git rev-parse HEAD).Trim()
$env:POSTGRES_RELEASE_NEGATIVE_CONTROL_OUT=(Resolve-Path .).Path + '\.tmp\postgres-release-negative-control.json'
cargo test -p api-rust --features postgres --test postgres_release_safety_postgres -- --nocapture
```

Expected: exit 0, exactly **8 passed, 0 failed, 0 ignored**; the negative-control file exists, has only
the ten contract fields, has nonzero exit, both booleans false, and equal 64-hex fingerprints.

### V4 — Existing production startup regression

```powershell
$env:TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/convexa_test'
cargo test -p api-rust --features postgres --test production_runtime_guardrails_postgres -- --nocapture
cargo test -p api-rust --features postgres --test production_runtime_guardrails -- --nocapture
```

Expected: both commands exit 0. The Postgres file has **2 passed** and the transport file has **3 passed**;
fresh-schema setup in the old harness must be updated to invoke the release runner explicitly rather than
rely on startup migration, without weakening its persistence/refusal assertions.

### V5 — Repository/process receipt tool

```powershell
node --test tools/postgres-release-receipt.spec.mjs
```

Expected: exit 0, exactly **10 passed, 0 failed**; output includes accepting round trip plus immutable
blob, schema, secret, and forbidden-live-input mutation coverage.

### V6 — Production compilation and image command

```powershell
cargo check -p api-rust --all-targets --features postgres
cargo build -p api-rust --release --features postgres
docker build -f apps/api/Dockerfile -t convexa-api:postgres-release-safety .
docker run --rm convexa-api:postgres-release-safety api-rust postgres-migrate --help
```

Expected: all commands exit 0; the image installs its sole executable at
`/usr/local/bin/api-rust`, the exact bare Railway executable `api-rust` resolves from the standard
runtime path, and the image still runs as uid 10001. The help run requires no secret and prints no
embedded credential. A real command run receives `DATABASE_URL` only at runtime.

### V7 — Live generic interface conformance

After B6 starts the migrated production-profile server:

```powershell
node .codex/tools/gates.mjs interface_conformance `
  --contract .spire/clusters/tech/contracts/postgres-release-safety/INTERFACE_CONTRACT.md `
  --url http://127.0.0.1:8000 `
  --report .spire/clusters/tech/contracts/postgres-release-safety/conformance-receipt.json
```

Expected: exit 0; receipt verdict `PASS`; summary is exactly **1 pass, 0 fail, 1 total**; `/api/health`
retains required string fields.

### V8 — Machine receipt on immutable target revision

Using the exact terminal object from B6 and negative-control file from V3:

```powershell
$repo=(Resolve-Path .).Path
$sha=(git rev-parse HEAD).Trim()
node tools/postgres-release-receipt.mjs produce --repository-root "$repo" --expected-git-sha "$sha" --expected-pre-deploy-command "api-rust postgres-migrate" --expected-healthcheck-path "/api/health" --migration-terminal .tmp/postgres-migration-terminal.json --negative-control .tmp/postgres-release-negative-control.json --out .spire/clusters/tech/state/conformance/postgres-release-safety-repository.json
node tools/postgres-release-receipt.mjs validate --repository-root "$repo" --expected-git-sha "$sha" --expected-pre-deploy-command "api-rust postgres-migrate" --expected-healthcheck-path "/api/health" --migration-terminal .tmp/postgres-migration-terminal.json --negative-control .tmp/postgres-release-negative-control.json --receipt .spire/clusters/tech/state/conformance/postgres-release-safety-repository.json
```

Expected: both exit 0 and print `PASS repository_and_process_only`; receipt is closed, hashes the
immutable commit's `railway.json` plus exact two input files, and contains no live-host claim.

### V9 — Isolation, math identity, formatting, and lint

```powershell
cargo test -p api-rust --test postgres_release_safety_isolation -- --nocapture
cargo test -p api-rust --test score_identity
cargo test -p quant-engine --test golden --test signals_characterization
cargo fmt --all -- --check
cargo clippy -p api-rust --all-targets --features postgres -- -D warnings
npx prettier --check railway.json tools/postgres-release-receipt.mjs tools/postgres-release-receipt.spec.mjs docs/DEPLOY_RUNBOOK.md docs/API_RUST_DEPLOY.md
```

Expected: isolation **6/6**, score identity **3/3**, quant integration **5/5**, and all format/lint
commands exit 0. No score, tier, fingerprint, quant golden, public route, or frontend change appears.

### V10 — Live Railway GATE-S review (ship blocker, accountable owner named)

The **root GATE-S release conductor** uses current Railway tooling against the target deployment and
records this exact evidence block in GATE-S ship evidence (or QA_REPORT if QA has host access):

```text
Live Railway review
reviewer: <root GATE-S conductor identity>
project_id: <observed>
environment_id: <observed>
service_id: <observed>
deployment_id: <observed>
expected_git_sha: <40-hex target SHA>
observed_git_sha: <same>
observed_image_revision: <target built image revision>
config_source: railway.json
pre_deploy_command: api-rust postgres-migrate
terminal_object_equal_to_machine_input: yes
railway_status: SUCCESS
direct_health_status: 200
verdict: PASS
```

Expected: every value is directly observed for one deployment id; SHA/image/config/terminal identities
match; status is `SUCCESS`; direct health is 200 and V7 shape passes. Missing access or any mismatch is
FAIL/UNVERIFIABLE and blocks merge/deploy closure. Do not add these facts to the machine receipt and do
not compare clocks across containers.

## Acceptance coverage map

| SPEC criteria | Plan owners |
|---|---|
| AC1–3 | B0–B2; V2–V3 |
| AC4–5 | B1, B4; V2–V3 |
| AC6–10 | B1, B4; V2–V3 |
| AC11–16 | B0–B2, B4; V2–V3 |
| AC17 | B2, B4; V3, V9 |
| AC18–23 | B3–B4, B6; V3–V4, V7 |
| AC24 | B1; V2 |
| AC25 | B1–B2, B4–B5; V3, V5, V8–V9 |
| AC26 | B3–B4, B6; V1, V4, V7, V9 |
| AC27 | B4; V9 |
| AC28 | B4–B6; V3, V5, V8, and accountable live review V10 |
| AC29 | B5; exact-copy review in V10 handoff |
