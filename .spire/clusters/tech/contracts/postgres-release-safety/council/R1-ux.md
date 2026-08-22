# R1 — ux position: postgres-release-safety

## Position

`NO_UI_CHANGE` is binding for this feature. It adds no dashboard route, component, control, notification, or trader-visible datum. The project design system is therefore not engaged and needs no amendment. The user-facing surface is operational: a release operator or CI job runs the PostgreSQL release command and reads its terminal outcome; an operator reads a production-startup refusal when the schema is not acceptable.

### Intended user, primary job, and information structure

- **Intended user:** the release operator and the CI/deployment automation acting on the operator's behalf.
- **Primary job:** decide, without inspecting source or guessing from free-form logs, whether migrations were committed, no work was needed, the run was refused before mutation, or an attempted migration failed.
- **Information order:** terminal outcome first; current and target schema-version facts when they are known; a stable reason when the outcome is not successful; then a concise human diagnostic. Progress diagnostics must never be mistaken for the terminal outcome.
- **Vocabulary:** say **migration**, **schema version**, **current**, **refused**, and **failed**. Do not substitute broader claims such as “database healthy,” “deployment safe,” or “release verified”; this command can vouch only for its PostgreSQL migration result.
- **Machine/human parity:** the human summary, process exit status, and closed machine outcome must describe the same state. A success-sounding line must never accompany a non-success outcome or non-zero exit.

### Operational state matrix

| State | What the operator sees | What the operator can do next | Must not happen |
| --- | --- | --- | --- |
| checking | `Checking PostgreSQL schema…` as a progress diagnostic | Wait for a terminal outcome | No success token or zero-exit implication before the check finishes |
| waiting for another run | `Another migration run is active. Waiting…` | Continue waiting or stop the invoking job according to deployment policy | Do not call the database unavailable, do not claim a migration ran, and do not emit a terminal success while still waiting |
| up to date | `PostgreSQL schema is already current.` | Continue the release | Do not say migrations were applied when no version changed |
| migrated | `PostgreSQL migrations completed.` | Continue the release | Emit only after the schema changes and their version records are committed |
| refused before mutation | A reason-specific refusal from the closed copy set below | Correct the release/schema mismatch, then run again | Do not imply partial success; do not use the same success exit semantics as `up to date` or `migrated` |
| migration failed | `Migration failed. No schema version was committed.` | Inspect the sanitized diagnostic, correct the migration, then run again | Do not print a success outcome, expose credentials, or claim a version was recorded |
| PostgreSQL unavailable | `Migration failed: PostgreSQL is unavailable.` | Restore connectivity/configuration, then run again | Do not guess whether the cause is DNS, credentials, networking, or server health unless a separately vouched reason establishes it |
| application startup accepted | No new trader-facing message; normal startup may continue | None | Acceptance must not say the release command ran during API startup |
| application startup refused | One exact reason-specific startup refusal below | Run the release command or correct the release/schema mismatch | No listener, worker, or trader-facing degraded mode may start |

The browser component inventory is deliberately **N/A**: default, loading, empty, error, offline, stale, success/confirmation, focus, keyboard, and responsive states do not exist because no browser surface changes. Operational `checking`, `waiting`, terminal outcomes, and startup refusal are the complete state set for this feature.

### Exact degraded-state wording

Release-command refusal copy:

- Future schema: `Migration refused: the database schema is newer than this release.`
- Partial schema: `Migration refused: the database schema is incomplete.`
- Unusable/unverifiable schema: `Migration refused: the database schema could not be verified.`

Production-startup refusal copy:

- Missing versions: `Startup refused: required PostgreSQL migrations are missing.`
- Partial schema: `Startup refused: the PostgreSQL schema is incomplete.`
- Future schema: `Startup refused: the PostgreSQL schema is newer than this release.`
- Unusable/unverifiable schema: `Startup refused: the PostgreSQL schema could not be verified.`

These messages must be useful without ANSI color, animation, or a spinner. Color may supplement severity but may not carry the distinction. Diagnostics must redact connection strings, credentials, query parameters, and secret values. Raw database errors may be retained only if the emitting lane can prove they are sanitized; otherwise the closed reason and the copy above are the honest surface.

### Brief-outcome-to-state and verification map

The BRIEF contains outcome statements rather than numbered acceptance criteria, so this map gives each stated outcome a stable UX reference for synthesis; it does not add product scope.

| Ref | Brief outcome | State(s) that make it observable | UX requirement | Verify by |
| --- | --- | --- | --- | --- |
| UX-B1 | Concurrent migration attempts serialize safely | waiting for another run → migrated or up to date | A contending run is visibly waiting and cannot emit a premature success outcome | test |
| UX-B2 | A failed statement leaves neither partial schema changes nor a recorded version | migration failed | Failure copy says only that no schema version was committed; outcome and exit status are non-success | test |
| UX-B3 | The release command produces closed machine-checkable outcomes | up to date; migrated; refused before mutation; migration failed | Each terminal outcome has one meaning, agrees with its human summary and exit status, and is distinguishable without parsing prose | test |
| UX-B4 | Production startup refuses missing, partial, future, or unusable schemas | application startup refused | Each cause has distinct, exact wording; none is collapsed into “healthy,” “empty,” or a generic success-like degraded state | test |
| UX-B5 | Refused production startup binds no listener and starts no workers | application startup refused | Refusal remains an operator error, never a trader-facing offline/stale mode | test |
| UX-B6 | Internal production-correctness change only | all browser states N/A | `NO_UI_CHANGE`; no dashboard route, component, trader copy, or frontend contract is introduced | test |
| UX-B7 | Outcomes and diagnostics disclose no secrets | every operational state | Copy and machine output remain useful after redaction and never include database credentials or secret values | test |
| UX-B8 | Operator wording matches the established migration vocabulary | all operational states | Exact visible phrases, ordering, and absence of unsupported “safe/healthy/verified” claims match this position | review |

All behavioral rows are `test` because a mismatch between state, exit status, mutation result, startup behavior, or redaction can regress silently while ordinary output still looks plausible. The final wording row is `review` because it is an intentional copy choice. There is no separate test matrix.

## Risks I see

- A progress line or lock-acquisition line can be consumed as success if the command does not reserve one unambiguous terminal outcome.
- “Migrations completed” emitted before commit would assert a stronger state than the database can support.
- Calling every refusal “migration failed” would erase the operational difference between no mutation, an attempted-and-failed migration, and an unavailable database.
- Repeating a raw driver error can leak a connection URL, username, password, host detail, SQL text, or secret-bearing query parameter.
- “Schema current” can be misused to mean “database healthy” or “release safe”; those broader meanings are not vouched by this feature.
- If waiting is silent, a correctly serialized run looks hung and encourages an operator to start competing retries.
- If production startup performs migrations while saying only “checking schema,” the copy conceals that application replicas are acting as migration coordinators.
- A browser banner or degraded trader mode would incorrectly turn a release-boundary refusal into an application state and would violate `NO_UI_CHANGE`.

## Assumptions I'm making about the other two lanes

- The architecture lane will make two independently started release commands unable to apply the same version concurrently, and a waiting contender will observe the committed result before it reports its own terminal outcome.
- The architecture lane will ensure a migration version and its schema statements become visible together or neither becomes visible; the `No schema version was committed` copy depends on that property.
- The architecture lane will provide a closed, exhaustively handled distinction among up-to-date, migrated, refused-before-mutation, and attempted-but-failed outcomes so the UX does not infer state from free-form error text.
- The architecture lane will make production startup validation observational only: it will not apply migrations, bind a listener, or start workers while the schema is missing, partial, future, or unverifiable.
- The architecture lane will expose current and target schema versions only when both are actually known; the UX will not fabricate either value from migration-file counts.
- The architecture lane will provide sanitized diagnostics or a closed reason; it will not require the UX wording layer to inspect arbitrary database-driver strings for secrets.
- The product lane will keep the release command and startup refusal as operator/automation surfaces with no dashboard, trader notification, admin page, or public API behavior.
- The product lane will define success as `up to date` or `migrated`, and will treat refused and failed outcomes as non-success for deployment automation.
- The product lane will not require progress percentages, completion estimates, “healthy,” “safe,” or “verified” labels, because the BRIEF supplies no vouched source for those claims.
- The product lane will make the four production-startup refusal causes independently observable acceptance criteria rather than treating a single generic startup failure as sufficient.
