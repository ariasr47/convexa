# R1 — architect position: archive-coverage-guardrails

## Position

### Technical shape

This should be a backend-only reliability leaf inside `apps/api/src/services/session_chain_archive/`, not a new trader-path service. The load-bearing mechanism is one deterministic coverage evaluator shared by the runtime monitor and the local audit command. It consumes only a narrow read-only archive-reader capability, an injected clock, and a validated policy; it has no access to Massive, analytics computation, the GEX cache, scoring, SSE, or an archive insert method.

The evaluator's internal data model should contain:

- a coverage identity made only from the closed ensured-symbol set and an ET calendar date;
- a validated policy containing an explicit coverage epoch, an ET checkpoint, and a bounded number of recent eligible dates;
- a closed classification for each required identity: not yet due, present and strictly readable, missing after due, unreadable after due, or evaluation unavailable;
- the newest strictly readable identity per symbol, including its mandatory source timestamp;
- the evaluation time and strict-verification time, so a cached success cannot be mistaken for a fresh disk read;
- the process-local archive write-failure count paired with the time at which that counter began.

`not yet due`, `missing`, `unreadable`, and `evaluation unavailable` must remain distinct types. This restates `[absent-is-not-none]`: a store fault or an evaluation that has not run cannot collapse to an empty/missing matrix, and a pre-checkpoint absence cannot be reported as a failed session.

The expected-date mechanism must not infer its beginning from the first stored row, because that would erase exactly the leading gaps this feature exists to detect. Production supplies and validates an explicit coverage epoch before the listener starts; development may use a documented local default. The runtime window is the later of that epoch and a bounded recent-date window, preventing archive reads from growing without bound. The evaluator must reuse the existing `ENSURE_SYMBOLS`, `America/New_York`, and `is_et_weekday` rules from `ensure.rs`, so producer and detector cannot disagree about symbol or weekday eligibility by construction. Exact checkpoint and lookback values are policy decisions for the other lanes, but invalid dates, an empty window, or values above a compile-time ceiling must be rejected by typed configuration.

Strict readability means the existing store load succeeds, the stored bytes deserialize through the same capture decoder used by the research load path, and decoded symbol/date/source timestamp agree with index metadata. A small process cache keyed by identity plus immutable source timestamp may retain successful verification until a bounded revalidation interval; new identities are verified immediately, and all cached identities are reverified periodically. This keeps each minute pass cheap while still detecting a body that becomes unreadable after an earlier success. The local audit disables this cache and strictly loads every identity in its requested window.

### Data flow and boundaries

1. `archive.rs` remains the single best-effort insert boundary. It currently swallows insert errors and emits an unbounded warning; it should instead record the exact failed insert in an `Arc<AtomicU64>` telemetry object and still return normally. The atomic update cannot fail or block the caller. No archive error may become a ring-capture, ticker, scanner, or SSE error.
2. The existing off-request-path worker in `ensure_worker.rs` remains the coordinator. Each pass first completes the current SPY/QQQ/IWM ensure attempts, then evaluates coverage, publishes an immutable in-memory snapshot, and finally applies warning policy. Evaluating after the ensure attempts prevents a checkpoint race from warning before that pass has tried to repair the identity.
3. The warning policy consumes the classified snapshot only after the ET checkpoint. A bounded process-local set keyed by identity plus failure class permits one structured warning for a missing or unreadable identity and suppresses every repeat from later minute ticks. The warning contains identity, classification, evaluation time, and counter context, but never body bytes, locators, filesystem paths, credentials, or environment values. If the identity becomes readable, the report changes but the historical warning key remains until it ages out of the bounded window.
4. `AppState` owns the telemetry counter, latest immutable coverage snapshot, and warning ledger. This follows the existing `CacheMetrics` atomic-counter pattern in `state.rs`; it does not add database state or a migration.
5. The existing token-protected operator metrics handler in `routes/health.rs` projects only the latest in-memory snapshot. It must not list or load archive books, call the worker, trigger repair, or fetch vendor data during a request. This restates `[operator-vs-trader-path-separation]`: the operator read remains read-only, off trader routes, unlinked from trader UI, and side-effect-free.
6. A new CLI arm in the existing clap command graph in `main.rs` constructs a dedicated read-only archive adapter and calls the same evaluator with an injected evaluation time and explicit range. The adapter exposes list and strict-load only. It must not reuse `SessionChainArchive::open_json` because source inspection shows that constructor creates directories and runs inline-body migration; the audit factory must require existing paths and refuse rather than create, migrate, repair, prune, or insert. Any missing, unreadable, unavailable, or semantically mismatched required identity produces a nonzero outcome; a complete strictly readable window produces zero.
7. `docs/DEPLOY_RUNBOOK.md` is the verified operations seam for the two independent Railway volumes. The addition should state warning/critical utilization bands and separate responses for Postgres and API durable data. It must require measurement before deletion and must not automate cleanup. Exact percentages and operator-facing wording belong to PM/UX; the architecture requires ratios to be calculated independently from used and provisioned capacity and never inferred from the session-book byte total.

### Isolation and error rules

- `[production-fails-closed]` applies to guardrail configuration, not to corpus completeness: production refuses an invalid or absent epoch/checkpoint/window policy before listener or workers, while a later missing book remains an operator incident and never takes down the trader service. Existing archive-root writability/flushability preflight remains unchanged.
- Best-effort archive isolation remains binding. Insert failure increments telemetry and the caller proceeds; evaluator failure publishes an explicit unavailable state and retries on the next off-path pass; operator projection returns last-good data with its verification age plus the current unavailable state rather than fabricating zeros.
- `[structural-over-prose-enforcement]` is met by the read-only capability given to the evaluator/CLI, closed classifications with exhaustive matches, injected time, and a dependency guard that fails if the coverage leaf imports Massive, analytics, capture/insert APIs, scoring, or trader-route modules. Mutation tests must prove each forbidden import/write guard actually turns red.
- Scoring isolation is structural: the coverage leaf lives under the API service and is not imported by `quant-engine::signals`; score, tier, entry gate, and fingerprint paths receive no new input. A source-boundary guard and an empty scoring-path diff should pin the brief's no-scoring constraint.
- Runtime observation is process-local by deliberate choice. Compared with a persistent warning ledger, the in-memory atomic/set design has lower complexity, no migration or new failure dependency, zero subscription cost, and matches the supported one-replica production profile. Scalability is bounded by three symbols times the configured recent-date ceiling. Team familiarity is highest because it reuses the existing cache-metrics and ensure-worker patterns. The tradeoff is that a process restart may emit each unresolved warning once again and resets the failure counter; the snapshot must expose its observation start so this cannot be mistaken for lifetime history.
- Computing coverage inside the operator request was rejected: it is simpler in parts but couples request latency to multi-megabyte body reads and permits dashboard polling to amplify filesystem load. The cached off-path snapshot wins on isolation and predictable cost.
- Duplicating separate runtime and CLI checks was rejected: it lowers initial wiring complexity but permits the command and metrics to disagree about expected dates or readability. One evaluator with two adapters wins on correctness and team familiarity.

### Restated binding constraints

- The feature is `NO_UI_CHANGE`; it adds no trader surface, trader-route work, SSE datum, or frontend state.
- It performs zero vendor fetches and zero analytics recomputation. The only runtime inputs are archive metadata/body reads, injected time, validated policy, and process-local telemetry.
- It does not change gamma sourcing, any math invariant, opportunity scoring, tiering, entry gating, or fingerprinting.
- Operator and research paths authorize nothing. A healthy or unhealthy coverage report cannot change production scoring or permit a trade action.
- No secret, body locator, absolute storage path, or archive body may enter warnings, reports, or CLI artifacts.
- Existing first-wins `(symbol, ET date)` identity and mandatory successful-load source timestamp remain authoritative.

### Explicit non-goals

- No backfill, recovery, mutation, prune, deletion, volume resize, or automatic remediation.
- No insertion of reconstructed history into the live session archive. The August 24–25 SPY gaps remain unrecoverable facts documented in `docs/research/ARCHIVE_COVERAGE_AUDIT_2026-08-26.md`.
- No partial-reconstruction format in this feature. If later built, it must use a separate store/type with provenance that cannot satisfy the live-session reader capability.
- No paid monitoring service, alert-routing integration, SLO program, remote body-store migration, Postgres reclamation, or storage attribution scan.
- No exchange-holiday calendar expansion in this slice unless the other lanes reject the existing producer-compatible weekday rule.

### Source seams verified

The claims above were checked at source: `archive.rs` is the swallowed-error write boundary; `ensure.rs` owns the closed symbol set, ET weekday rule, retry spacing, and typed outcomes; `ensure_worker.rs` is the minute, off-path coordinator; `store.rs` provides list/load and its JSON open path mutates by creating/migrating; `research_session_books.rs` performs strict load plus capture deserialization; `state.rs` owns the store/worker state and provides the atomic metrics precedent; `routes/health.rs` owns token-protected operator metrics; `main.rs` owns the clap research commands; `server.rs` validates production before bind and starts the archive worker off-request-path; and `docs/DEPLOY_RUNBOOK.md` is the current Railway operations document. The production audit establishes 7/9 readable live books, two unrecoverable SPY gaps, repeated permission failures, and independent Postgres/API-volume utilization.

## Risks I see

- The existing eligibility rule is weekday-only, not an exchange calendar. A weekday market holiday can be classified as expected and warn falsely. I prefer producer/detector consistency in this slice; if PM requires true trading sessions, both the ensure producer and detector need one shared maintained calendar, not a detector-only exception.
- A process-local warning ledger deduplicates storms but not restarts. Persisting dedupe would add a migration/write dependency precisely when storage may be impaired; I reject that cost for the supported single-replica profile unless “exactly once across restarts” is a product requirement.
- Full body deserialization is real I/O. The bounded verification cache and revalidation interval control it, but an excessively large lookback or short interval could still pressure the API volume. The policy ceiling and instrumentation-age fields are required, not optional prose.
- If runtime metrics and the CLI do not share the exact evaluator, they will drift on checkpoint/date/readability semantics. Separate implementations should be considered a contract violation.
- The write-failure counter is observational, not durable. Without its observation-start time, a restart could misleadingly appear to clear the incident.
- A metrics handler that directly touches the archive would violate operator/trader isolation under polling load even though it makes no vendor call. The in-memory snapshot boundary must be enforced.
- Known unrecoverable historical gaps can create permanent failures if the production coverage epoch predates the ownership repair. The epoch must be an explicit owner-selected truth, not inferred or silently defaulted.

## Assumptions I'm making about the other two lanes

- PM will choose an explicit production coverage epoch at or after the repaired archive became trustworthy; if PM chooses an earlier date, the audit will intentionally remain nonzero for the unrecoverable SPY gaps.
- PM will define one ET checkpoint and bounded recent-session lookback; if those remain unspecified, production configuration cannot be validated honestly.
- PM accepts one warning per identity and failure class per process lifetime, with at most one repeat after restart; if “exactly once across restarts” is required, the in-memory design must be replaced by a durable ledger.
- PM will decide whether weekday compatibility is acceptable on exchange holidays; if not, the scope expands to a shared producer/detector trading-calendar mechanism.
- PM will define warning and critical utilization percentages independently for the Postgres and API volumes, plus distinct operator actions; architecture will not invent those business thresholds.
- UX/tech-writing will keep this entirely out of trader navigation and trader-facing copy; if a visible operator page change is requested, that is a separate frontend scope not assumed here.
- UX/tech-writing will preserve distinct human meanings for pending, missing, unreadable, and unavailable rather than collapsing them into one absence label.
- UX/tech-writing will state that the report and audit authorize no scoring change, repair, or reconstruction, and will not describe a partial artifact as a live session book.
