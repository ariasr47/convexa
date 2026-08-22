# R1 — pm position: postgres-release-safety

## Position

### Product outcome

PostgreSQL schema changes become an explicit release step that an operator can run and evaluate before any application replica starts. A PostgreSQL-backed serve process validates the schema it receives but never upgrades, repairs, or records that schema. A healthy release therefore has an unambiguous order: complete the migration operation, receive a successful terminal outcome, and only then start replicas.

This is an internal reliability feature. It adds no trader-facing workflow and must not change existing trading, quantitative, authentication, research, or public API behavior when the database is current.

### User stories

- **US-1 — Release operator:** As a release operator, I want one explicit migration operation with a closed terminal outcome so that I can decide mechanically whether a release may advance to application startup.
- **US-2 — Release operator under concurrency:** As a release operator, I want simultaneous migration attempts to take ownership one at a time so that two deployment jobs cannot change the same schema concurrently.
- **US-3 — Service owner:** As a service owner, I want each schema version and its recorded completion to succeed or fail as one unit so that a failed release cannot advertise a version it did not fully install.
- **US-4 — On-call operator:** As an on-call operator, I want production startup to refuse an unsafe schema before network traffic or background work begins so that a bad rollout fails visibly instead of serving against uncertain state.
- **US-5 — Trader:** As a trader, I want database release hardening to leave the application’s existing outputs unchanged so that infrastructure work cannot alter market analysis or trading decisions.

### Scope

**In**

- One independently runnable PostgreSQL migration operation for the same application revision that will later serve traffic.
- Exclusive migration ownership across concurrent processes targeting the same database.
- Per-version atomicity between the schema effects of a migration and the fact that the version completed.
- Honest terminal outcomes for applied work, an already-current database, a refused database state, and an execution failure.
- PostgreSQL startup preflight that is read-only and completes before any listener or worker begins.
- Separate refusal behavior for missing, internally inconsistent, future, and unusable production schemas.
- Runtime-only database configuration and secret-safe operator output.
- Real PostgreSQL verification of concurrency, rollback, retry, and startup refusal behavior.
- Release guidance that puts migration completion before replica startup.

**Out**

- Trader-facing UI, workflow, or copy changes.
- Public API contract changes or generated API clients.
- Automatic schema repair, destructive downgrade, or acceptance of an unknown future schema.
- Designing zero-downtime compatibility rules for every future schema change.
- Backup/restore automation, staging promotion, or general rollback orchestration.
- Splitting API and background-worker deployments or adding general leader election.
- Changes to market-data calculations, opportunity scoring, tiers, fingerprints, or trade behavior.

**Future — after this feature**

- API contract generation is the next owner-sequenced stack upgrade and remains a separate feature.
- Broader recovery/deployment maturity will add backup/restore drills, promotion gates, and rollback orchestration after this release boundary is proven.
- Replica-safe background-worker coordination remains a later scaling feature; this slice prevents replicas from coordinating migrations by accident.

### Product behavior

1. The migration operation may advance a fresh or consistently behind PostgreSQL database to the schema expected by its own application revision. It may also report that no work was needed. Neither case starts the application server or its background work.
2. If two migration operations target the same database, only one may perform schema work at a time. A contender waits without applying work, then reassesses the database after ownership becomes available rather than acting on its earlier view.
3. Each migration version is its own all-or-nothing release unit. If one version fails, its schema effects and its completion record are both absent. Versions committed before it remain committed; later versions are not attempted.
4. A corrected retry starts from the first version that is still unapplied and does not duplicate or re-run versions already committed.
5. A database that is newer than the running revision, internally inconsistent, unreachable, or insufficiently usable never produces a successful migration outcome.
6. Every migration invocation ends with exactly one machine-checkable terminal outcome from a closed semantic set: work applied, already current, refused because the database state is unsafe, or failed because the operation could not complete. Human-readable context may accompany that outcome but may not contradict it.
7. Any PostgreSQL-backed serve invocation treats schema state as read-only. A current schema permits startup; an unsafe schema stops startup before the process can accept traffic or start background work.
8. Normal healthy-start behavior remains externally unchanged. The current public conformance surface and pinned trading/quantitative outputs remain identical.

### Acceptance criteria

All criteria below are ship-blocking. The `test` marks protect silent production invariants; the sole `review` mark covers the intentionally visible release guidance.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 | US-1 | Given a fresh PostgreSQL database, running the migration operation completes successfully and leaves the database at exactly the schema version expected by that application revision. | test |
| AC-2 | US-1 | Given a consistently behind PostgreSQL database, running the migration operation applies every pending version in order and ends at exactly the expected version. | test |
| AC-3 | US-1 | Given an already-current PostgreSQL database, running the migration operation succeeds without changing the schema or its recorded migration history. | test |
| AC-4 | US-2 | Given two migration operations against the same database, observation of their database activity shows that schema-changing work never overlaps. | test |
| AC-5 | US-2 | Given a second migration operation that began while another held ownership, the second reassesses the database after ownership is released and does not reapply work completed by the first. | test |
| AC-6 | US-3 | Given a forced failure after a migration version has begun, none of that failing version’s schema effects remain after the operation exits. | test |
| AC-7 | US-3 | Given a forced failure before a migration version completes, that failing version is not recorded as completed. | test |
| AC-8 | US-3 | Given a release containing a successful version followed by a failing version, the previously successful version remains committed after the operation exits. | test |
| AC-9 | US-3 | Given a release containing a failing version followed by another version, the later version is not attempted. | test |
| AC-10 | US-3 | Given the cause of a prior migration failure has been corrected, retrying resumes at the first unapplied version and reaches the expected version without duplicating already-committed work. | test |
| AC-11 | US-1 | Given a database whose recorded version is newer than the application revision expects, the migration operation exits unsuccessfully and makes no schema or migration-history change. | test |
| AC-12 | US-1 | Given a database whose recorded version and required schema disagree, the migration operation exits unsuccessfully and makes no repair or migration-history change. | test |
| AC-13 | US-1 | Given an unreachable database or insufficient database permission, the migration operation exits unsuccessfully and never reports either work-applied or already-current success. | test |
| AC-14 | US-1 | Every migration invocation emits exactly one parseable terminal outcome whose meaning is one of: work applied, already current, unsafe database refused, or execution failed. | test |
| AC-15 | US-1 | Running the migration operation to completion does not bind an application listener or start application background work. | test |
| AC-16 | US-4 | Given a current and usable PostgreSQL schema, the serve process may bind its listener and start background work only after schema validation succeeds. | test |
| AC-17 | US-4 | Given a production database with the expected schema missing, the serve process exits unsuccessfully before binding a listener or starting background work. | test |
| AC-18 | US-4 | Given a production database whose recorded version and required schema disagree, the serve process exits unsuccessfully before binding a listener or starting background work. | test |
| AC-19 | US-4 | Given a production database whose recorded version is newer than the application revision expects, the serve process exits unsuccessfully before binding a listener or starting background work. | test |
| AC-20 | US-4 | Given a production database that cannot be reached or inspected with the configured permission, the serve process exits unsuccessfully before binding a listener or starting background work. | test |
| AC-21 | US-4 | Given any consistently behind PostgreSQL database, invoking the serve process leaves both the schema and migration history unchanged. | test |
| AC-22 | US-4 | Given multiple application replicas starting against a current PostgreSQL database, all successful replicas leave the schema and migration history unchanged. | test |
| AC-23 | US-1 | Given canary secret values in runtime database configuration, migration and startup output contain none of those values. | test |
| AC-24 | US-5 | After a successful migration and healthy start, the existing public conformance checks pass and pinned opportunity score, tier, fingerprint, and quantitative outputs are byte-identical to their pre-feature expectations. | test |
| AC-25 | US-1 | The release guidance places the migration operation before application replica startup and identifies every non-successful terminal outcome as a stop to release promotion. | review |

### Binding constraints restated

- **`production-fails-closed` (watch):** missing, inconsistent, future, or unusable production schemas stop the process before listener bind or worker start.
- **`structural-over-prose-enforcement`:** serialization, atomic rollback, and read-only startup are ship claims only when demonstrated against real PostgreSQL, including rejecting and accepting paths; documentation alone is not evidence.
- **`no-secrets-in-image`:** the migration operation uses runtime-injected configuration; no database credential or other secret is added to a build or deploy artifact, and operator output must not disclose runtime secret values.
- **`cited-code-is-verified-not-assumed`:** this position makes no claim about reusable source locations or current implementation mechanisms. Those are explicit other-lane assumptions below until verified at source.
- Existing trading and quantitative outputs, including opportunity score, tier, and fingerprint identity, remain untouched.

## Risks I see

- A terminal message that is readable but not mechanically unambiguous could let deployment automation promote a failed or refused release.
- A contender that acts on schema state observed before it receives ownership could replay a migration the first owner already completed.
- A migration containing work that cannot participate in the required all-or-nothing boundary would make the atomicity promise false unless the release refuses it.
- A version record alone may say “current” while required schema is missing or malformed. If inconsistency detection is too shallow, startup could accept a partially usable database.
- An unbounded ownership wait could look like a hung deployment. The operation must remain observably pending and must never translate external cancellation into a success result.
- Moving migration responsibility out of startup creates a sequencing dependency in deployment automation. A platform that starts replicas before the migration outcome is known will now fail closed, as intended, but may lengthen a rollout until its order is corrected.
- Future migrations can still be operationally unsafe even when they are atomic, such as changes that break compatibility with an older replica. Cross-version rollout compatibility is explicitly outside this slice and must not be implied by a green migration outcome.
- Secret-bearing connection failures are a leakage risk because database clients often include connection details in their native errors.
- A safety feature that changes ordinary healthy responses or quantitative results would exceed its internal-correctness scope even if its migration behavior is correct.

## Assumptions I'm making about the other two lanes

- The architecture lane can name a PostgreSQL mechanism that grants exclusive ownership across independent processes targeting the same database and releases ownership when its owning process terminates.
- The architecture lane can name a transaction boundary that commits one migration version’s schema effects and completion record together, and will identify or refuse any migration operation that cannot honor that boundary.
- The architecture lane can define a read-only schema validation that distinguishes current, missing, internally inconsistent, future, and unusable states before listener bind or worker start.
- The architecture lane can keep the independently runnable migration operation and the serve lifecycle on the same application revision without either path accidentally starting the other.
- The architecture lane will verify at source which existing migration and startup surfaces are reusable; this position does not assume filenames, modules, commands, or current locking behavior.
- The architecture lane can exercise concurrency, injected migration failure, permission failure, and multi-replica startup against real PostgreSQL in verification environments.
- The UX/tech-writer lane can define concise operator-facing wording that distinguishes applied, already-current, refused, failed, and waiting states without exposing database credentials.
- The UX/tech-writer lane can make a non-terminal ownership wait visibly different from a terminal success or failure while preserving exactly one final machine-checkable outcome.
- The UX/tech-writer lane will keep this feature off trader-facing UI and will confine its guidance to operator release documentation and command output.
