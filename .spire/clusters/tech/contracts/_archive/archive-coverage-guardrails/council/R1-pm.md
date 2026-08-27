# R1 — pm position: archive-coverage-guardrails

## Position

### Product promise

Convexa should make session-book loss visible on the day it happens, without changing the trader experience, contacting the paid data vendor, or requiring a monitoring subscription. An operator should be able to answer four questions from one read-only view: what coverage was expected, which books are readable, which identities are missing or unreadable, and whether writes have failed during the current process run.

Coverage uses one honest, exclusive classification for each expected SPY, QQQ, and IWM identity: **readable**, **missing**, or **unreadable**. “Present” is not sufficient when the indexed body cannot be loaded. Coverage begins on the declared production activation date and ends at the latest eligible ET trading session whose checkpoint has passed. Saturdays, Sundays, and recognized full-day US market holidays are not expected sessions.

The daily checkpoint is **10:30 a.m. America/New_York**. Before that time, the current session is pending and must not be described or warned as missing. At or after the checkpoint, each identity that is not readable produces one warning during a continuous process run. Repeated checks must not create a log storm. A restart may emit a new warning because it begins a new observation run, and that run boundary must be visible in operator evidence.

The local audit is the release and incident-response floor. It reports the same coverage classifications for an inclusive ET date range and succeeds only when every expected identity in that range is readable. Missing, unreadable, inaccessible, or invalid evidence produces a non-zero result; an eligible range with no expected sessions reports that fact and succeeds. The audit never repairs, backfills, fetches, deletes, or rewrites anything.

Storage guidance belongs in the existing deployment runbook, not in trader UI. Postgres and API durable storage are judged separately: **warning at 70% used** and **critical at 85% used**. Warning means measure the contributing directories, calculate recent growth and runway, and plan a volume increase or separately authorized cleanup. Critical means increase available capacity immediately, verify free space afterward, and do not delete session books or research evidence merely to clear the alert.

### User and operator stories

- As an operator, I want a complete expected/readable/missing/unreadable coverage summary so that I can detect silent corpus loss before another session passes.
- As an incident responder, I want the last readable book and current-run write-failure evidence per tracked symbol so that I can distinguish an old gap from an active write incident.
- As a release owner, I want one local, read-only audit with a trustworthy process result so that missing evidence blocks a claimed-clean audit without requiring a hosted service.
- As a trader, I want archive guardrails isolated from trading so that a diagnostic failure cannot change prices, recommendations, scores, streams, or page behavior.
- As a research owner, I want fixtures and future partial reconstructions excluded from live coverage so that a reconstructed artifact can never erase an honest gap.

### Scope

**In**

- Read-only operator coverage evidence for SPY, QQQ, and IWM from the declared activation date through the latest passed checkpoint.
- Distinct readable, missing, unreadable, pending-current-session, and coverage-unavailable outcomes.
- Last readable identity per symbol and write-failure count with an explicit current-process observation boundary.
- One deduplicated warning per affected symbol/session during a continuous process run after 10:30 a.m. ET.
- A local, zero-vendor, read-only audit over an inclusive ET date range with an honest zero/non-zero result.
- Deployment-runbook thresholds and actions for the Postgres and API durable-data volumes.
- Structural separation from trader behavior and exclusion of fixtures or non-live reconstructions from live coverage.

**Out**

- Any trader UI, design, navigation, copy, browser workflow, public status page, or new trader-facing control.
- Paid telemetry, paging, email, chat notifications, hosted dashboards, or a new subscription.
- Automatic repair, backfill, deletion, retention change, volume resize, or incident remediation.
- Fabricating the unrecoverable SPY books for August 24–25, or changing an existing artifact’s provenance.
- Vendor requests, scoring changes, recommendation changes, fingerprint changes, archive capture-policy changes, or production-capacity benchmarking.

**Future-dated**

- Optional external alert delivery after an owner chooses a provider and operating budget.
- A separately contracted partial-reconstruction corpus whose provenance can never satisfy live-book coverage.
- Retention forecasting, directory-level capacity attribution, automated volume growth, and separately authorized reclamation.
- Cross-restart warning suppression if repeated restart alerts prove noisy in production.

### Acceptance criteria

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 | As an operator, I want complete coverage evidence. | At or after 10:30 a.m. ET, the operator readout states its activation date and observation time and accounts for every expected SPY, QQQ, and IWM session through the latest passed checkpoint as exactly one of readable, missing, or unreadable. | test |
| AC-2 | As an operator, I need missing and broken bodies distinguished. | An expected identity with no session book is reported as missing, while an indexed identity whose body cannot be loaded is reported as unreadable; neither is counted as readable. | test |
| AC-3 | As an operator, I need to know the latest usable evidence. | For each tracked symbol, the readout identifies the most recent book that can actually be loaded, or states that no readable book exists in the reporting window. | test |
| AC-4 | As an incident responder, I need active-failure evidence. | The readout reports archive write failures observed during the current process run and states when that observation run began, so a restart cannot make zero look like a lifetime count. | test |
| AC-5 | As an operator, I need honest pending state. | Before 10:30 a.m. ET, the current eligible session is identified as pending and is excluded from missing/unreadable totals and warnings. | test |
| AC-6 | As an operator, I do not want calendar false alarms. | Saturdays, Sundays, and recognized full-day US market holidays create no expected identities and no coverage warnings. | test |
| AC-7 | As an operator, I want prompt warning without spam. | At or after 10:30 a.m. ET, each SPY, QQQ, or IWM identity that is missing or unreadable produces one warning naming the symbol, ET session date, condition, and checkpoint, and repeated checks during the same continuous process run produce no additional warning for that identity. | test |
| AC-8 | As an operator, I want recovery reflected. | When a previously missing or unreadable identity becomes readable, the next operator readout classifies it as readable and no further warning for it is produced during that process run. | test |
| AC-9 | As an operator, I need dependency failure stated honestly. | If coverage cannot be inspected, the operator surface remains available but reports coverage unavailable with the reason and does not present zero missing, zero unreadable, or complete coverage. | test |
| AC-10 | As a security owner, I need archive details kept operator-only. | A request without valid operator authorization cannot read coverage details, while the existing authorized operator path can. | test |
| AC-11 | As a release owner, I want a trustworthy local audit. | For a valid inclusive ET range in which every expected identity is readable, the audit prints the range, expected/readable/missing/unreadable totals, per-identity matrix, and an unambiguous pass summary, then exits zero. | test |
| AC-12 | As a release owner, I need gaps to fail. | If any expected identity in the selected range is missing, the audit lists each missing identity, reports a non-pass summary, and exits non-zero. | test |
| AC-13 | As a release owner, I need unreadable evidence to fail. | If any indexed book in the selected range cannot be loaded, the audit lists it as unreadable rather than missing or readable and exits non-zero. | test |
| AC-14 | As a release owner, I need audit faults to fail closed. | An invalid range or inaccessible/unavailable archive produces a specific non-pass explanation and non-zero exit; it never emits a clean or zero-gap result. | test |
| AC-15 | As a release owner, I need empty ranges handled honestly. | A valid range containing no eligible trading sessions reports no expected sessions and exits zero without fabricating missing identities. | test |
| AC-16 | As a research owner, I need provenance protected. | Conformance fixtures and any artifact not proven to be an original live session book are excluded from readable live coverage and cannot change a missing live identity into a pass. | test |
| AC-17 | As a cost owner, I need zero-vendor inspection. | Reading operator coverage, emitting its warnings, and running the local audit make no vendor request and perform no archive, database, cache, or trader-state mutation. | test |
| AC-18 | As a trader, I need guardrail isolation. | With coverage healthy, missing, unreadable, or unavailable, the same stored market input produces unchanged trader-route, stream, scoring, recommendation, and fingerprint behavior. | test |
| AC-19 | As a production owner, I need startup policy preserved. | A historical coverage gap does not by itself prevent the trader service from starting, while the existing refusal for an unusable required production archive location remains in force. | test |
| AC-20 | As a trader, I expect no visible change. | Review of the shipped application finds no new or changed trader page, control, navigation item, status, copy, motion, or visual treatment. | review |
| AC-21 | As an operator, I need actionable storage guidance. | The deployment runbook separately names the Postgres and API durable-data volumes, defines warning at 70% used and critical at 85% used, and gives the measurement, growth/runway, expansion, post-action verification, and no-unauthorized-deletion actions for each threshold. | review |
| AC-22 | As an operator without a monitoring subscription, I need the feature usable locally. | The documented coverage audit and runbook procedure can be completed with repository and existing platform access only and does not require enrollment in a paid monitoring or alerting service. | review |

Verification is risk-based: automation protects classification, calendar/checkpoint boundaries, deduplication, failure exits, authorization, zero-side-effect inspection, provenance exclusion, and trader-path isolation because those can regress silently. Review is reserved for the visible no-UI confirmation and bounded runbook wording; no one-test-per-criterion rule is implied.

## Risks I see

- A “present” index entry could mask an unreadable body unless the product keeps unreadable separate from readable.
- A weekday-only rule would create predictable false warnings on full-day market holidays and train operators to ignore the signal.
- A warning count without a process-start boundary would look cumulative after restart and misstate incident severity.
- Persistent warning suppression could hide a continuing failure after restart; process-scoped deduplication intentionally favors one fresh reminder per run.
- The operator readout and local audit could drift into different definitions of expected coverage, producing contradictory incident evidence.
- A historical gap could accidentally become a production-startup blocker, turning a research-data incident into trader downtime.
- A fixture or future partial reconstruction could be counted as live evidence and falsely “heal” an unrecoverable gap.
- Storage thresholds without explicit actions would be decorative; actions that encourage deletion could destroy the corpus the guardrail exists to protect.
- An unbounded lifetime list may become unwieldy as the archive grows; the reporting window must stay declared and the audit must remain range-selectable.

## Assumptions I'm making about the other two lanes

- The technical lane can determine one declared activation date and recognized full-day US market holidays without contacting a paid service during an operator read or audit.
- The technical lane can classify every expected identity as readable, missing, or unreadable by inspecting retained archive evidence without vendor access or mutation.
- The technical lane can expose write-failure evidence with a falsifiable current-process start boundary and can deduplicate one warning per symbol/session within that run.
- The technical lane can make the operator readout and local audit use the same coverage semantics, including checkpoint, calendar, provenance, and unreadable-book rules.
- The technical lane can preserve the existing operator authorization boundary and keep all coverage work off trader routes, streams, scoring, recommendations, and fingerprints.
- The technical lane can demonstrate that a historical gap does not block startup while an unusable required production archive location still does.
- The UX/tech-writing lane will treat this as an operator-only, no-trader-UI feature and will not introduce a dashboard, banner, navigation item, or trader-facing copy.
- The UX/tech-writing lane can provide warning, audit, and runbook language that distinguishes pending, missing, unreadable, unavailable, and recovered states without calling any of them “live” or “complete” incorrectly.
