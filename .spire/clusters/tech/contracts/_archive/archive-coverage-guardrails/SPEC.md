# archive-coverage-guardrails — spec

**Source brief:** .spire/clusters/tech/contracts/archive-coverage-guardrails/BRIEF.md
**Council:** R1 positions · R2 critiques · decisions.md   (under council/)
**Status:** APPROVED 2026-08-26

## 1. Goal + scope

Give Convexa's operator prompt, trustworthy evidence when an expected SPY, QQQ, or IWM session book is missing or unreadable, without contacting the paid vendor, changing trader behavior, or requiring a monitoring subscription. Runtime evidence covers a declared, bounded recent window; a strict local command audits any selected inclusive ET range. Production coverage begins on **2026-08-24 America/New_York**, preserving the known August 24–25 SPY gaps as failures whenever they fall inside the checked window. This date is an owner-ruled fact because inferring the start from the first stored row would erase leading gaps.

**In scope:**

- A deterministic, read-only coverage evaluator shared by the runtime monitor and local audit.
- SPY, QQQ, and IWM symbol-session identities; one shared offline U.S. market-session calendar; and a daily **10:30 a.m. America/New_York** checkpoint.
- An additive coverage object on the existing operator-token-protected `GET /api/_metrics` response.
- One structured warning per affected `(symbol, ET date)` during a continuous process run.
- Process-local total and per-symbol archive-write-failure counters with their observation start.
- A local `archive-coverage-audit --from YYYY-MM-DD --to YYYY-MM-DD` command that reads only the configured production session-book namespace and exits nonzero for incomplete or uncheckable due coverage.
- Separate Postgres and API durable-volume guidance in `docs/DEPLOY_RUNBOOK.md`: warning at 70% used and critical at 85% used.

**Out of scope:**

- Browser or trader UI, navigation, copy, motion, visual treatment, public status pages, or a new operator dashboard.
- Paid monitoring, paging, email/chat delivery, hosted telemetry, or a new subscription.
- Repair, backfill, reconstruction, deletion, pruning, retention changes, volume resizing, cleanup, or any archive mutation by the evaluator, metrics request, or audit.
- Fabricating the unrecoverable August 24–25 SPY books or letting fixtures/reconstructions satisfy live coverage.
- Vendor requests, analytics recomputation, trader-route work, SSE data, scoring, recommendation, tier, entry-gate, or fingerprint changes.
- Mixed-origin storage inside the production live-book namespace.

**Future (deliberately deferred):**

- Optional external alert delivery after an owner selects a provider and budget.
- A separately typed and stored partial-reconstruction corpus whose provenance can never satisfy live coverage.
- Cross-restart warning suppression, directory-level capacity attribution, retention forecasting, automated volume growth, and separately authorized reclamation.

## 2. Architecture

### 2.1 Shared policy and market calendar

Add a typed `CoveragePolicy` under `apps/api/src/services/session_chain_archive/` with these owner-ruled production values: activation date `2026-08-24` ET, checkpoint `10:30:00 America/New_York`, and runtime lookback `5` eligible sessions. The production policy is checked in, constructed explicitly, and validated before listener/worker startup; development and tests may inject alternate validated policies. Invalid dates, a zero-sized runtime window, or a window above the compile-time ceiling are rejected. A historical coverage gap is an operator incident after startup and is never itself a startup refusal.

Add one offline `market_calendar` module used by both the ensure producer and coverage evaluator. Its sole holiday authority is the checked-in artifact `apps/api/src/services/session_chain_archive/calendars/xnys_full_day_2026_2035.v1.json`, embedded into the binary and identified by `calendar_id: "XNYS-full-day"`, `schema_version: 1`, `calendar_version: "2026-2035@2026-08-26.1"`, `domain_start: "2026-01-01"`, and `domain_end: "2035-12-31"`. The closed scheduled-holiday vocabulary is New Year's Day, Martin Luther King Jr. Day, Washington's Birthday, Good Friday, Memorial Day, Juneteenth National Independence Day, Independence Day, Labor Day, Thanksgiving Day, and Christmas Day. Early-close sessions are explicitly excluded.

The artifact enumerates every actual full-day closure as `{nominal_date, closed_et_date, name, observance}`. `observance` is exactly `actual`, `friday_before`, or `monday_after`; the runtime performs no inferred weekend shift. Good Friday is listed with its actual Friday date. A separate `exceptional_full_day_closures` array contains exact exchange-announced closure dates and bounded reasons; it is empty in version `2026-2035@2026-08-26.1`, meaning no exceptional date is approved in that version—not that future exceptional closures are impossible. Adding or changing a scheduled/observed/exceptional date requires a new `calendar_version`, artifact review, and producer/detector fixture update in the same change. Duplicate/out-of-domain dates, unknown names/observance tokens, or a current production ET date outside the declared domain invalidate the calendar and refuse production startup. An audit date outside the domain returns `ERROR` and exits nonzero.

The shared function classifies a date as eligible only when it is a weekday inside the artifact domain and absent from both closure arrays. It performs no network or vendor call. Saturday, Sunday, and every enumerated full-day closure are ineligible for both producer and detector. The existing weekday-only helper in `ensure.rs` ceases to be the eligibility authority. This is a deliberately authorized capture-policy correction: producer and detector change together so a recognized closed-market date cannot produce either a forced capture or a false missing warning.

The runtime range is the most recent five eligible ET dates, never earlier than 2026-08-24, and the published snapshot names its exact start and end. When the current date is eligible but its checkpoint has not passed, it may appear as `not_due`; it is excluded from expected/missing/unreadable counts and produces no warning. The explicit audit applies the same activation, calendar, checkpoint, and status rules to its selected inclusive range; it is the mechanism for inspecting dates that have aged out of runtime monitoring.

<!-- spire:council-resolution:v1 c90f0ab780767587263a648e1a303575d7b2a7452a8ddfe33d91c4db44d12a48 folded -->
<!-- spire:council-resolution:v1 10b3aa28e7ac985b77e7ba8f42654bc55eff3061551b3b745706a8da2b0c091c folded -->
<!-- spire:council-resolution:v1 9c89b57e2e40af48d2d11dbdd02a9ff4b0f67456206f4049e7517bc13ba981cc folded -->
<!-- spire:council-resolution:v1 c697d8edea5b9050d2b189887c2b898f5af872edb919348effa4f20557d26d34 folded -->
<!-- spire:council-resolution:v1 4ea6314fa023cf3f581b88e39b3ac64339e57fb898f5a726720445388d14276c folded -->

### 2.2 Coverage model and strict reader

Add a deterministic evaluator in `apps/api/src/services/session_chain_archive/coverage.rs`. It accepts only:

- a closed SPY/QQQ/IWM identity set;
- the validated policy and shared calendar;
- an injected clock; and
- a narrow read-only live-archive capability supporting metadata lookup and strict load.

It has no insert/delete/prune method and cannot access Massive, analytics, cache mutation, scoring, trader routes, or SSE. The same evaluator returns a closed status for every successfully inspected selected identity: `not_due`, `readable`, `missing`, or `unreadable`. Evaluation-level failures are represented separately as `stale` when last-good evidence exists or `unavailable` when it does not. An empty `books` array under `unavailable` means **no identity evidence was produced**—never an empty successful matrix—and all six counts remain null rather than fabricated zeros.

Strict readability requires all of the following: an index record exists; the body load succeeds; the existing chain-capture decoder accepts the bytes; and decoded symbol, ET date derived from the decoded timestamp, and decoded source timestamp exactly agree with index metadata. An absent index is `missing`; an indexed body that cannot be read, decoded, or reconciled is `unreadable`. `present` counts indexed identities, while `readable` counts only strict successes.

Live provenance is structural. Runtime and CLI readers are bound only to the configured production session-book namespace; fixtures and reconstructions use separate test or future reconstruction adapters/namespaces. An original production identity is never copied into a fixture namespace to make a test pass, and a fixture/reconstruction can never be presented through the live-reader capability. Mixed-origin production storage remains rejected until a separate feature defines a persisted closed origin marker.

The evaluator returns the most recent strictly readable identity per symbol inside the checked window, including ET date and mandatory source timestamp. If none exists, it returns an explicit absence rather than a fabricated date.

<!-- spire:council-resolution:v1 f28fa9077f5bd67d9befe0142618459b4e96a6f4c2c4a892cfe5a09fc50f028b folded -->

### 2.3 Runtime data flow, caching, and isolation

The existing minute `ensure_worker` remains off the request path. Each pass:

1. completes current eligible SPY/QQQ/IWM ensure attempts;
2. evaluates the bounded coverage window;
3. atomically replaces the immutable in-memory operator snapshot; and
4. applies warning policy to the new classifications.

Evaluation happens after ensure attempts to avoid warning before that pass has attempted the book. A success-verification cache keyed by `(symbol, ET date, immutable source timestamp)` may retain strict successes for at most **5 minutes**; new or changed identities are loaded immediately. A full revalidation after the bound detects a body that became unreadable. The audit disables this cache and strictly loads every selected due identity.

`AppState` owns the latest immutable snapshot, process observation start, write-failure telemetry, and warning ledger. The existing `GET /api/_metrics` handler reads only that snapshot. An HTTP request performs no archive list/load, vendor call, ensure wake, repair, recomputation, database mutation, cache mutation, or trader-route call. If a worker evaluation fails after last-good evidence exists, the handler exposes `stale` plus that timestamped data. If the runtime range is computed successfully but the first strict inspection fails, the handler preserves the known range and exposes `unavailable`, `data_stale=false`, a bounded `status_detail`, all six counts null, `books=[]`, and three `per_symbol` rows whose last-readable values are null; process observation/write counters remain truthful. If policy/calendar range computation itself fails before a range exists, the same unavailable shape uses null range endpoints. In both unavailable forms, the empty books array means no evidence, not zero expected books or complete coverage. The next off-path pass retries.

`archive.rs` remains the best-effort insert boundary. Each failed SPY/QQQ/IWM insert increments one tracked total and the matching symbol's process-local atomic counter, then returns normally. Counters and warnings reset on restart; `observation_started_at_utc` makes that boundary explicit. They are diagnostic facts, not durable lifetime history and not completeness counts.

### 2.4 Warning policy

After 10:30 a.m. ET, each `missing` or `unreadable` identity is eligible for one structured warning. Deduplication is keyed only by `(symbol, ET date)` for the continuous process run—not by failure class. A later missing↔unreadable change updates metrics and audit output without another warning. Becoming readable updates current coverage but does not clear the warning key; a restart may warn once again and starts a visibly new observation run. The bounded ledger ages identities out with the runtime window.

Warnings include symbol, ET date, current condition, checkpoint, observation start, and evaluation time. They exclude body bytes, locators, absolute paths, secrets, credentials, and environment values.

<!-- spire:council-resolution:v1 5980c27eb0b18c33213100f2e35b3e8e6ea10b99eb79c344f2bffbfe937f2c5f folded -->
<!-- spire:council-resolution:v1 1e5b8614d39f1f2e0a0cef5b0868cacace9496209495a6c66be45367450d6358 folded -->
<!-- spire:council-resolution:v1 249c0f77f3782f831f4f7246f4b77adaf36d9734b4b1ebbd6485778a5ea47940 folded -->

### 2.5 Local audit and operational documentation

Add `archive-coverage-audit` to the existing clap command graph in `apps/api/src/main.rs`, with required `--from` and `--to` inclusive ET dates. A dedicated audit factory opens only already-existing configured archive metadata/body storage in read-only mode. It must not call the current JSON `SessionChainArchive::open_json` path because source inspection confirms that path creates directories and performs inline-body migration. The audit never creates, migrates, repairs, inserts, deletes, prunes, fetches, or rewrites.

The command prints the scope, closed matrix, per-symbol last-readable result, and terminal outcome specified in §4. It exits zero only when all due expected books are readable, or when a valid range contains zero due expected sessions and therefore makes no completeness claim. Missing, unreadable, unavailable/inaccessible storage, unsupported calendar dates, malformed dates, or a reversed range exit nonzero.

Update the existing `docs/DEPLOY_RUNBOOK.md` Railway operations seam. Postgres and the API durable-data volume are measured independently from used/provisioned capacity. At 70%, measure contributing directories, recent growth, and runway, then plan expansion or separately authorized cleanup. At 85%, increase capacity immediately and verify free space afterward. Neither threshold authorizes deletion of session books or research evidence, and storage pressure never changes archive-coverage classification.

### 2.6 Existing seams verified at source

These reuse claims were read in the current Rust source: `archive.rs` swallows best-effort insert errors; `ensure.rs` owns the closed three-symbol set and current weekday eligibility; `ensure_worker.rs` runs an off-path 60-second pass; `store.rs` exposes list/load and its JSON open path creates directories and migrates inline bodies; `routes/research_session_books.rs` uses the capture decoder on research loads; `state.rs` owns archive/ensure state and contains atomic-metrics precedent; `routes/health.rs` owns `GET /api/_metrics` and its operator-token gate; `main.rs` owns the clap command graph; `server.rs` validates production before bind and starts the ensure worker off-request-path; and `docs/DEPLOY_RUNBOOK.md` is the current Railway operations document.

**Failure modes + isolation:** Invalid guardrail policy or an unusable required production archive location refuses production startup before listener/workers. A historical or newly detected coverage gap does not stop startup or trading. Insert failure increments telemetry and remains best-effort. Evaluation failure publishes stale/unavailable evidence and retries. Metrics remains a snapshot projection. Audit failure exits nonzero without mutation. No failure in this leaf propagates into trader routes, SSE, scoring, recommendations, or fingerprints.

**Not buildable / rejected approaches:** Computing coverage inside the metrics request is rejected because polling would amplify multi-megabyte archive I/O. Separate runtime and CLI evaluators are rejected because their calendar/readability semantics could drift. Persistent warning deduplication is rejected for this one-replica slice because it introduces a write dependency during storage incidents. Detector-only holiday exceptions are rejected because producer and detector would disagree. Inferring activation from stored rows is rejected because it erases leading gaps. Reconstructing missing books is rejected because exact historical Greeks/IV/OI/source provenance cannot be recovered honestly.

## 3. Acceptance criteria (with user stories)

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 | As an operator, I want bounded complete runtime evidence so that I can see current archive health. | After the checkpoint, an authorized operator read names activation date `2026-08-24`, evaluation time, checkpoint, and the exact most-recent-five-eligible-session range, and accounts for every due SPY/QQQ/IWM identity in that range as exactly `readable`, `missing`, or `unreadable`. | test |
| AC-2 | As an operator, I need record presence and body readability distinguished. | An identity with no index record is `missing`; an indexed identity whose body cannot be read, decoded, or reconciled with its metadata is `unreadable`; neither is counted as readable, while only indexed identities count as present. | test |
| AC-3 | As an operator, I need the newest usable evidence for each symbol. | For each required symbol, runtime and audit output identify the newest strictly readable ET date and source timestamp inside the checked window, or explicitly report that no readable book was found without inventing a date. | test |
| AC-4 | As an incident responder, I need honest active-failure evidence. | The operator readout reports total and per-symbol failed archive writes observed since its displayed process observation start, and a restart resets both the timestamp and counts rather than presenting them as lifetime history. | test |
| AC-5 | As an operator, I need the current session kept pending before it is due. | Before 10:30 a.m. America/New_York, an eligible current symbol-date is `not_due`, contributes to none of the expected/missing/unreadable totals, and emits no coverage warning; after the checkpoint it is evaluated normally. | test |
| AC-6 | As an operator, I do not want market-closure false alarms. | For every date in calendar artifact `XNYS-full-day` version `2026-2035@2026-08-26.1`, Saturdays, Sundays, and each enumerated scheduled/observed/exceptional full-day closure produce no expected identity, ensure attempt, or warning; every other in-domain weekday is eligible identically for producer and detector, while out-of-domain dates fail explicitly. | test |
| AC-7 | As an operator, I want one useful warning without a log storm. | After the checkpoint, the first observed missing or unreadable identity emits one warning naming symbol, ET date, actual condition, checkpoint, and the exact same-date command `cargo run -p api-rust -- archive-coverage-audit --from {et_date} --to {et_date}`; repeat checks and missing↔unreadable changes emit no additional warning for that identity during the same process run. | test |
| AC-8 | As an operator, I want recovery reflected without rewriting history. | When an affected identity later becomes strictly readable, the next snapshot and audit classify it as readable, but the current run emits no second warning for that identity. | test |
| AC-9 | As an operator, I need inspection failure stated honestly. | If strict inspection first fails after range computation, `GET /api/_metrics` reports `unavailable`, preserves the known range, sets all six counts null, returns `books=[]`, null last-readable values for all three per-symbol rows, `data_stale=false`, and a bounded reason; if range computation itself fails first, range endpoints are also null. Neither shape fabricates zero/complete coverage, while a later failure with last-good evidence reports `stale` with that timestamped evidence. | test |
| AC-10 | As a security owner, I need coverage details kept operator-only. | In production, missing or incorrect operator credentials receive the existing 401 metrics denial without coverage details, while either accepted operator-token header returns the metrics response with the additive coverage object. | test |
| AC-11 | As a release owner, I want a trustworthy complete audit. | Given a valid inclusive range where every due expected identity is strictly readable, the audit prints the requested range, expected/present/readable/missing/unreadable totals, one row per selected identity, each symbol's last-readable result, and `PASS — every expected book is readable.`, then exits zero. | test |
| AC-12 | As a release owner, I need missing books to fail an audit. | If any due expected identity is absent, the audit lists every such identity as `missing`, prints `FAIL` with missing and unreadable totals, emits no `PASS`, and exits nonzero. | test |
| AC-13 | As a release owner, I need broken bodies to fail an audit. | If any indexed due identity cannot be strictly loaded, the audit lists it as `unreadable` rather than missing/readable, emits no `PASS`, and exits nonzero. | test |
| AC-14 | As a release owner, I need uncheckable audits to fail closed. | A malformed/reversed range, unsupported calendar date, or inaccessible/unavailable archive prints the bounded `ERROR` result, makes no completeness claim or fabricated zero-count statement, and exits nonzero. | test |
| AC-15 | As a release owner, I need a valid range with no due sessions handled honestly. | When a valid selected range maps to zero due expected sessions, the audit prints exactly `No books were expected in this window.`, emits no `PASS`, emits no warning, and exits zero. | test |
| AC-16 | As a research owner, I need provenance protected. | A fixture or partial reconstruction stored outside the configured live namespace cannot change a live missing/unreadable identity to readable; a live strict read succeeds only when decoded identity/source timestamp match production index metadata. | test |
| AC-17 | As a cost owner, I need zero-vendor, read-only inspection. | Runtime evaluation, warning emission, metrics reads, and local audits produce zero vendor calls and no archive/database/cache/trader-state mutation; the audit refuses a path that would create or migrate storage. | test |
| AC-18 | As a trader, I need guardrail isolation. | Across current, missing, unreadable, stale, and unavailable coverage states, the same stored market input produces unchanged trader HTTP/SSE responses, recommendation behavior, opportunity score/tier, entry gate, and state fingerprint. | test |
| AC-19 | As a production owner, I need startup semantics preserved. | Invalid coverage policy or an unusable required archive location refuses production before listener/workers, while a historical or current coverage gap alone permits normal trader-service startup and appears only as operator evidence. | test |
| AC-20 | As a trader, I expect no visible change. | Inspection of the shipped application finds no new or changed trader page, component, control, navigation item, status, copy, motion, or visual treatment. | review |
| AC-21 | As an operator, I need actionable storage guidance. | The deployment runbook separately names Postgres and API durable-data volumes; sets warning at 70% and critical at 85%; and states measurement, growth/runway, expansion, post-action verification, and no-unauthorized-deletion actions without equating volume usage with archive completeness. | review |
| AC-22 | As an operator without a monitoring subscription, I need a usable local procedure. | The documented audit and runbook procedure require only the repository, local process access, and existing Railway access; they do not require enrolling in a paid monitoring or alerting service. | review |
| AC-23 | As an operator, I need unambiguous plain-text outcomes. | Audit scope precedes counts, each symbol-date has one closed status, and the terminal uses exactly one applicable `PASS`, `FAIL`, `ERROR`, or zero-expected outcome without relying on color, icons, animation, or the word `offline`. | review |

Silent calendar, classification, deduplication, auth, exit-code, provenance, side-effect, startup, and trader-isolation regressions require automation. Visible no-UI confirmation and runbook/terminal wording are reviewed. These methods select risk-appropriate evidence and do not require one test per row.

<!-- spire:council-resolution:v1 568491e1bc1c5bec3e9bd34c75fc16da3d18e6112926922ad799d1983bdbc7ce folded -->

## 4. UI + interaction

**Flows:** `NO_UI_CHANGE`. There is no browser flow. The operator either reads the existing protected metrics endpoint, observes a structured warning, runs the local audit, or follows the deployment runbook. None is linked from trader navigation.

**Component states:** No browser component is added or changed. Operator states are represented in JSON/log/plain text, with the following behavior:

| Surface | default/current | loading | empty/not due | error | stale |
|---|---|---|---|---|---|
| Operator metrics | Latest bounded snapshot and process counters | No request-time loading state; snapshot read is immediate | `not_due` rows are excluded from expected counts | `unavailable`: bounded reason, six null counts, empty evidence array, null last-readable values; known range retained when already computed | `stale`, last-good timestamps/counts, current failure reason |
| Local audit | Scope, matrix, last-readable details, one terminal outcome | Optional transient `Checking archive coverage…` before results only | Exact zero-expected sentence and exit 0, without PASS | Exact ERROR line and nonzero exit | Not applicable; audit disables the verification cache |
| Structured warning | One missing/unreadable identity after checkpoint | Not applicable | No warning before checkpoint or for zero expected sessions | Warning itself is evidence, never a repair claim | No repeat for the same identity during the run |

**Copy:**

Audit header and counts:

```text
Archive coverage — {evaluated_at_et}
Scope: SPY, QQQ, IWM · {start_date}–{end_date} ET · checkpoint {checkpoint_et} ET
Readable: {readable} of {expected} expected books
Missing: {missing} · Unreadable: {unreadable} · Present: {present}
```

Per-identity and last-readable lines:

```text
{symbol} {et_date} ET — readable
{symbol} {et_date} ET — missing
{symbol} {et_date} ET — unreadable
{symbol} {et_date} ET — not due until {checkpoint_et} ET
{symbol} — last readable {et_date} ET · source {source_as_of}
{symbol} — no readable book found in the checked window
```

Exactly one applicable terminal outcome:

```text
PASS — every expected book is readable.
FAIL — {missing} missing and {unreadable} unreadable expected books.
ERROR — archive coverage could not be checked: {reason}. No completeness claim was produced.
No books were expected in this window.
```

Warning:

```text
Session archive incomplete after {checkpoint_et} ET: {symbol} {et_date} ET is {missing|unreadable}. Run: cargo run -p api-rust -- archive-coverage-audit --from {et_date} --to {et_date}
```

Warnings must not say `lost`, `recovered`, `restored`, or `complete`. Audit/access faults are `ERROR`, never `offline`. Any future reconstruction must read `Partial reconstruction — not an original session book.` and remains outside exact coverage counts.

**Design authority:** `NO_UI_CHANGE`. No browser design authority or design-system amendment is exercised.

**Design direction:** Preserve the existing application exactly. Operator output is semantic plain text/JSON with no color, icon, animation, or celebratory styling dependency.

## 5. Error handling

- **Missing index:** classify the due identity `missing`; metrics remain 200 for authorized operators; warn once after checkpoint; audit exits nonzero.
- **Indexed but unreadable/mismatched body:** classify `unreadable`; do not fall back to a fixture, reconstruction, ring row, or vendor fetch; warn once after checkpoint; audit exits nonzero.
- **Evaluation/store fault:** publish `stale` with last-good evidence and timestamps when available. With no last-good evidence, publish `unavailable`, a bounded reason, six null counts, `books=[]`, and null per-symbol last-readable values; preserve a range already computed, otherwise keep range endpoints null. Empty books means no evidence. Retry on the next worker pass; the trader service stays up.
- **Archive insert fault:** increment total and symbol counter, log a bounded warning without path/body/secret data, and return normally to the caller.
- **Before checkpoint/future selected identity:** classify `not_due`; exclude it from expected failure totals and warnings.
- **Valid zero-expected audit range:** print only the defined scope/evidence plus `No books were expected in this window.` as the terminal result; no PASS; exit 0.
- **Invalid audit input, unsupported calendar date, or inaccessible archive:** print the exact ERROR line with a bounded reason; no counts presented as clean; exit nonzero.
- **Unauthorized metrics request:** retain the existing production 401 response and reveal no coverage details. No session cookie grants operator access.
- **Invalid production policy or unusable required archive root:** refuse before listener/workers. Corpus incompleteness never triggers this startup refusal.
- **Storage threshold:** runbook action is capacity measurement/expansion or separately authorized cleanup; the application performs no automatic deletion or resize.

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/archive-coverage-guardrails/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** The existing `GET /api/_metrics` gains one additive operator-only archive-coverage object while retaining its operator-token production boundary and existing denial semantics. No trader endpoint, SSE payload, or browser client contract changes; the local audit is a CLI specified here, not an HTTP endpoint.

## 7. Testing strategy

- Unit-test the shared calendar artifact schema/id/version/domain, closed holiday/observance vocabularies, exact enumerated scheduled and observed dates, empty v1 exceptional-closure set, early-close exclusion, duplicate/out-of-domain rejection, shared producer/detector membership, and out-of-domain refusal; also test activation floor, ET/DST checkpoint, five-session range, zero-expected range, strict classifications, identity reconciliation, last-readable selection, stale/unavailable state, cache expiry, and identity-only warning deduplication with injected time/readers.
- Integration-test runtime ordering (ensure attempt before evaluation), best-effort write-failure counters, recovery/status changes, restart reset semantics, and metrics snapshot reads without archive I/O.
- Exercise authorized 200 and unauthorized 401 metrics paths, then run interface conformance against the additive response shape in `INTERFACE_CONTRACT.md`. The generic conformance runner validates the 200 shape using a harness where the metrics token is deliberately unset; route tests cover both accepted operator-token headers and denial because session-cookie `auth` is not this endpoint's boundary.
- Run the CLI against read-only temporary live-store fixtures covering complete, missing, unreadable, mismatched, inaccessible, invalid, pre-checkpoint, holiday-only, and zero-expected ranges. Assert terminal text, exit status, and unchanged storage bytes/metadata before versus after.
- Mutation-prove dependency/source guards: poisoning the coverage leaf with Massive, analytics, scoring, trader-route, archive insert/delete/prune, or mutating-open imports must make the guard fail; restore and observe green. Pin that dashboard runtime source and scoring/fingerprint paths have no feature diff.
- Verify production startup accepts the owner-ruled policy, rejects invalid injected policy before bind, preserves the existing archive-root refusal, and does not refuse solely for a planted historical gap.
- Review `docs/DEPLOY_RUNBOOK.md` against AC-21/22 and inspect the app for AC-20. CLI copy/plain-text ordering is reviewed against §4 after automated behavior is green.
- GATE Q records exact current-byte commands, exit codes, failure/skip counts, and per-AC evidence. A green lint/build alone is not behavioral evidence.

## 8. Guardrails this feature must not break

- **`[operator-vs-trader-path-separation]`:** coverage remains on the existing protected operator route and local CLI, unlinked from trader UI. Metrics requests are read-only in-memory projection and never trigger archive I/O or trader work.
- **`[production-fails-closed]`:** invalid production policy and unusable required storage refuse before bind; later corpus gaps degrade only operator evidence and never take trading down.
- **`[structural-over-prose-enforcement]`:** read-only capabilities, closed states, exhaustive matches, injected time, immutable snapshot ownership, and mutation-proved import/write guards enforce isolation.
- **`[cited-code-is-verified-not-assumed]`:** §2.6 records the source-checked seams; any implementation divergence discovered later triggers GATE Z rather than silent adaptation.
- **Best-effort archive isolation:** a failed session-book write or evaluator pass cannot fail ring capture, ticker/scanner work, trader HTTP, SSE, scoring, or recommendation paths.
- **Scoring isolation:** no coverage datum enters `quant-engine::signals`, opportunity score/tier, entry gate, recommendation inputs, or fingerprint basis; the same stored market input remains byte-identical across coverage states.
- **Data/cost isolation:** runtime/audit inspection performs zero Massive calls, zero reconstruction, and no automatic storage mutation. First-wins `(symbol, ET date)` identity and mandatory source timestamp remain authoritative.
- **Security:** metrics retains operator-token authorization in production. Warnings, metrics, and audit output expose no secrets, body bytes, locators, absolute paths, credentials, or environment values.
- **No subscription/UI expansion:** this slice remains usable with existing repository/platform access and introduces no paid service or browser change.

## 9. Open questions

None. The owner settled the holiday calendar, warning key, runtime window, and activation date; the technical exchange settled live provenance and zero-expected audit semantics.

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"source":"R2-architect.md","index":0,"conflict_id":"c90f0ab780767587263a648e1a303575d7b2a7452a8ddfe33d91c4db44d12a48","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":1,"conflict_id":"c697d8edea5b9050d2b189887c2b898f5af872edb919348effa4f20557d26d34","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":2,"conflict_id":"f28fa9077f5bd67d9befe0142618459b4e96a6f4c2c4a892cfe5a09fc50f028b","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":3,"conflict_id":"5980c27eb0b18c33213100f2e35b3e8e6ea10b99eb79c344f2bffbfe937f2c5f","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":0,"conflict_id":"10b3aa28e7ac985b77e7ba8f42654bc55eff3061551b3b745706a8da2b0c091c","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":1,"conflict_id":"1e5b8614d39f1f2e0a0cef5b0868cacace9496209495a6c66be45367450d6358","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":2,"conflict_id":"568491e1bc1c5bec3e9bd34c75fc16da3d18e6112926922ad799d1983bdbc7ce","disposition":"folded","section":"§3"},{"source":"R2-ux.md","index":0,"conflict_id":"9c89b57e2e40af48d2d11dbdd02a9ff4b0f67456206f4049e7517bc13ba981cc","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":1,"conflict_id":"249c0f77f3782f831f4f7246f4b77adaf36d9734b4b1ebbd6485778a5ea47940","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":2,"conflict_id":"4ea6314fa023cf3f581b88e39b3ac64339e57fb898f5a726720445388d14276c","disposition":"folded","section":"§2"}]}
-->
