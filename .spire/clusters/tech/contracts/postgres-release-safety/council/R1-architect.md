# R1 — architect position: postgres-release-safety

## Position

### Evidence-backed starting point

The present Rust path couples schema mutation to application startup. `Pg::connect_strict` reads the
ledger, calls `migrate`, and then probes the resulting schema; `server::serve` calls that path before
archive probing, state construction, listener bind, and worker startup. The current migration runner
executes a version's statements individually and inserts its ledger row afterward, without enclosing
those operations in one transaction. The CLI has no schema-only release command. I verified those facts
at source in `apps/api/src/db/postgres.rs`, `apps/api/src/db/migrations.rs`,
`apps/api/src/runtime_guardrails/preflight.rs`, `apps/api/src/server.rs`, and `apps/api/src/main.rs`.

The feature should replace that coupling with two deliberately unequal capabilities:

1. A **migration runner** is the only schema writer. It is reachable from a dedicated release CLI
   command and is not constructed by the HTTP server.
2. A **schema verifier** is read-only. Production startup uses it to decide whether the database is
   exactly usable by this release, but it has no method that can apply or record a migration.

That type/module split is the primary `[structural-over-prose-enforcement]` mechanism: server startup
cannot become an accidental migration coordinator because the object it receives has no schema-write
capability. A build-breaking dependency guard must reject imports of the runner from the server/state/
worker graph, with a mutation test proving that adding such an import makes the guard fail.

### Migration data and schema-state model

Keep one immutable, ordered compiled manifest as the shared truth for both capabilities. Each definition
contains a positive version, a stable name, and its SQL body. Before touching Postgres, pure validation
must reject an empty body, duplicate or non-increasing versions, duplicate names, or SQL that the existing
Postgres-aware splitter cannot parse. This preserves the current team's embedded-Rust migration model
while making its invariants executable.

Read ledger entries as ordered version/name pairs. Classify the database into a closed internal state:

- **absent** — the ledger itself does not exist;
- **current** — ledger entries exactly equal the full compiled manifest by version and name;
- **pending suffix** — ledger entries are an exact prefix of the manifest;
- **diverged** — there is a hole, reordered entry, or a known version has a different name;
- **future** — any recorded version is unknown to this release; or
- **unusable** — the ledger is current but a required relation/column/readiness probe fails.

Only the release command may turn `absent` or `pending suffix` into `current`. It must refuse
`diverged` and `future`; filling a historical hole after a later version is recorded would invent an
ordering that never happened. Production startup accepts only `current` plus successful usability probes.
Every other state is a pre-bind refusal.

I choose exact version/name comparison rather than adding a checksum column in this slice. Checksums would
improve historical-body tamper detection, but the existing production ledger has twelve rows without
checksums; backfilling compiled hashes would falsely claim those exact historical bytes were applied.
Compared on the required axes, upgrading the existing manifest has lower complexity and adoption cost,
equal single-database scalability, and higher team familiarity than converting the live database to
`sqlx::migrate!` or an external Flyway/Atlas-style tool. Existing-database adoption risk is the decisive
axis. A future checksum migration remains possible if it records an explicit legacy-unverified epoch rather
than fabricating provenance.

### Single-owner release flow

The release command must use one **dedicated, non-pooled Postgres session** for the entire write flow:

1. Validate the compiled manifest without database side effects.
2. Connect using the runtime-injected database URL.
3. Poll `pg_try_advisory_lock` on a fixed Convexa migration-lock namespace until a bounded deadline.
4. After acquiring the lock, create the ledger table if absent, then re-read and classify the ledger.
5. Refuse divergence/future state. For each pending version, open one Postgres transaction, execute all
   split statements through that transaction, insert the version/name ledger entry through the same
   transaction, and commit.
6. Re-run the read-only exact-manifest and required-schema probes, emit one terminal outcome, explicitly
   unlock, and close the session.

The dedicated session matters: a session advisory lock on a pooled connection can survive when the
connection is returned to the pool. Here every success and error path closes the non-pooled connection;
Postgres also releases the lock if the process crashes or the network session dies. Failed lock polls hold
no lock. The lock serializes every cooperating release attempt against the same database, including
deployment retries; after the first owner commits, the waiter re-reads under the lock and returns
already-current rather than replaying work.

Each migration version is atomic because its DDL statements and ledger insert share one database
transaction. A statement error, cancellation, or connection loss before commit rolls back both schema
changes and the row. A crash after commit leaves both. The runner must never catch an error and continue
to the next version.

Postgres supports transactional DDL for the current manifest. Commands that require running outside a
transaction (for example concurrent index construction) are explicitly unsupported in this slice: if a
future migration uses one, real-Postgres CI must fail it inside the transaction before release. Supporting
online/non-transactional migration phases would weaken the BRIEF's atomic-version guarantee and requires a
separate design.

### Read-only production startup flow

Production `serve` must perform this order:

1. Validate the existing closed production configuration profile.
2. Open a bounded Postgres connection/pool without creating tables or running migrations.
3. Read and classify the ledger, accepting only exact `current`.
4. Execute the existing required-schema/readiness probes without writes.
5. Probe the archive root, construct production state, bind the listener, and only then start workers.

Startup does not wait for or acquire the migration writer lock. Deployment ordering is deliberate: the
release command finishes first; a replica started early sees a missing/partial schema and exits. This keeps
the application from becoming a second migration coordinator. The existing startup phase events remain
the evidence boundary for proving that no listener or worker followed a refusal.

The release command must construct neither `AppState` nor the router, vendor clients, archive-body stores,
caches, listeners, or workers. Its dependency direction is CLI -> migration manifest/runner -> Postgres.
The application direction is server -> schema verifier -> Postgres. Neither path imports
`quant-engine`, and the scoring/entry-gate/fingerprint modules remain outside the write scope; existing
trading and quantitative outputs therefore remain byte-identical by an empty engine/scoring diff plus the
existing golden tests.

### Closed outcomes and error isolation

The release process needs a closed terminal result family that distinguishes: applied one-or-more
versions, already current, lock deadline exhausted, manifest/database refusal, migration transaction
failure, and post-apply unusable schema. Success outcomes exit zero; every other terminal outcome exits
nonzero. Progress events may describe lock waiting and version begin/commit/rollback, but automation must
consume the single terminal record rather than scrape prose. The synthesizer/UX lane owns exact field
names, serialization, and operator wording.

Diagnostics may contain the migration version, stable name, statement ordinal, elapsed duration, release
identity, and a sanitized database error class/SQLSTATE. They must contain neither the database URL nor
SQL bodies/previews, bound values, key material, or other environment values. This restates
`[no-secrets-in-image]`: the same non-root image contains the command, while credentials remain runtime
environment input and never enter the image or receipt.

`[production-fails-closed]` is preserved through three mechanisms: release failures are nonzero and never
fall back to a local store; startup never mutates a schema to rescue itself; and any absent, incomplete,
diverged, future, unreachable, or unusable schema stops before listener/worker side effects.

### Verification shape

Real-Postgres CI must prove the mechanisms rather than only inspect code:

- two concurrent runners execute a barrier-controlled test migration with a measured maximum of one
  owner in the critical section; one applies and the other observes current;
- a version containing successful DDL followed by a forced failing statement leaves neither the DDL
  object nor its ledger row, and a corrected retry can apply once;
- fresh/absent and exact-prefix databases migrate to current, while hole, renamed, future, and unusable
  databases are refused without mutation;
- production startup against absent, prefix, hole, future, and unusable states preserves the database
  fingerprint and emits no listener-bound or worker-started evidence;
- the same release-mode binary first runs the migration command and then starts successfully against that
  database, while starting it before the command refuses; and
- every terminal result parses as one closed outcome and a canary database URL/secret/SQL literal is
  absent from stdout, stderr, logs, and receipts.

The repository already has an unskippable real-Postgres CI service and production schema harness in
`.github/workflows/ci.yml` and `apps/api/tests/production_runtime_guardrails_postgres.rs`; extend that
harness rather than introduce a simulated database. The deployment lane must additionally prove that the
host's pre-deploy/release hook runs this command from the exact image/release before replicas start
`[lane-check: current Railway hook semantics and configuration have not been source-verified in this R1]`.

### Explicit non-goals

- No HTTP endpoint, trader UI, frontend type, bundle/SSE field, or public API behavior changes.
- No down migrations or automatic rollback of previously committed versions; rollback here means the
  current failed version's database transaction.
- No automatic repair of ledger holes, renamed history, unknown future versions, or manually damaged
  schema. Those states refuse for operator investigation.
- No online expand/contract compatibility framework for old and new replicas, and no destructive or
  non-transactional migration choreography. Release authors must keep migrations compatible with the
  deployment overlap until a later deployment-maturity feature supplies stronger gates.
- No multi-database/global lock, external migration service, Kubernetes, Kafka, service mesh, or
  microservice split. The advisory lock is intentionally scoped to one Postgres database.
- No backup/restore drill, staging promotion, or automated application rollback; those belong to
  `recovery-deployment-maturity`.
- No generated OpenAPI/client work; `api-contract-generation` is the next separate slice.

## Risks I see

- **A pooled-session implementation would leak the advisory lock.** The mechanism must use a dedicated
  non-pooled connection and close it on every path; a concurrency test must catch a stranded lock.
- **A ledger that is merely a set can hide illegal history.** Exact-prefix ordering for migration and
  exact-full ordering for startup are required; subset checks are insufficient.
- **Not all PostgreSQL operations are transactional.** Admitting one into the manifest either breaks at
  release or pressures the runner to weaken atomicity. This slice chooses refusal and real-Postgres CI.
- **A migration can be atomic yet incompatible with replicas still serving the old release.** The owner
  must retain backward-compatible expand/contract discipline until the later deployment-maturity slice;
  this feature does not claim to solve overlap compatibility.
- **A lock timeout can race a slow legitimate migration.** The waiter must return a distinct busy outcome,
  never begin unlocked, and operators must be able to correlate it with the owner release identity.
- **Sanitization can regress through database error formatting.** Emit a typed, allowlisted diagnostic
  projection rather than serializing raw `sqlx` errors or statement previews.
- **A host release hook could run a different image or run after replicas.** Same-release identity and
  startup ordering need deployment evidence; the Railway mechanism remains a `[lane-check]` until verified.

## Assumptions I'm making about the other two lanes

- PM will treat both “applied pending versions” and “already current” as successful release outcomes, and
  every lock/refusal/failure outcome as a deployment-stopping nonzero result.
- PM will require an operator to run the release command before application replicas, rather than defining
  “replicas may start and wait while one of them migrates” as acceptable behavior.
- PM will accept exact-prefix-only forward progress: a ledger hole, renamed historical entry, or future
  version requires investigation and is never auto-repaired.
- PM will keep online destructive-migration compatibility, down migrations, backup/restore, staging, and
  application rollback outside this feature rather than treating them as implied by “release safety.”
- UX/Tech Writer will define concise machine and human diagnostics for the closed outcomes without asking
  the architect lane to choose JSON field names or exact copy.
- UX/Tech Writer will keep the release surface operator-only and will not introduce a trader-facing page,
  status widget, or public endpoint for migrations.
- UX/Tech Writer will preserve secret-safe diagnostics: no database URL, raw SQL/body preview, bound value,
  or environment value in progress events, terminal output, logs, or receipts.
- Both lanes will accept that a production replica started before the release command fails immediately
  instead of waiting, because deployment sequencing—not API startup—is the migration coordinator.
