# R1 — pm position: capacity-baseline

## Position

### Product outcome

Release owners need a repeatable local answer to “does this revision still meet the service’s minimum REST and stream capacity guardrails?” The answer is evidence for regression and scaling decisions, not a forecast of production capacity. A single documented verification action must start the isolated local exercise, evaluate fixed thresholds, retain a machine-readable report whether it passes or fails, and return a failing process result for any breached or unverifiable required check.

### User stories

- As a developer, I want representative cold, warm, and parallel REST traffic to run against fixtures so that I can catch a performance regression before sharing a revision.
- As a release owner, I want stream connection, hold, disconnect, subscriber-cap, and refusal behavior checked together so that a revision cannot pass while leaking or over-admitting stream subscribers.
- As an operator, I want latency, error, concurrency, and post-load resource recovery compared with explicit thresholds so that the result is actionable rather than anecdotal.
- As a reviewer, I want hermeticity and deterministic evidence to be part of the verdict so that a pass cannot depend on a live vendor, a production service, a paid account, or hand interpretation.

### Scope

**In**

- One operator/developer-only local runner for Windows 11 and Linux x64, using repository-declared prerequisites and no paid subscription or secret.
- Fixture-backed REST exercises covering: 12 cold observations with an empty application cache; 200 warm requests at concurrency 16; and 320 requests at concurrency 32.
- Fixed REST guardrails: cold p95 at or below 3,000 ms and no observation above 5,000 ms; warm p95 at or below 250 ms and no observation above 1,000 ms; parallel p95 at or below 1,500 ms and no observation above 5,000 ms; zero unexpected response or transport errors in every scenario.
- Stream exercises using a local subscriber cap of 32: 32 successful connections held for 60 seconds, a 33rd connection refused without disturbing accepted connections, and 10 full connect/disconnect churn waves.
- Fixed stream guardrails: connection p95 at or below 500 ms; zero unexpected disconnects while held; the over-cap attempt refused within 1,000 ms; and every accepted client able to disconnect cleanly.
- A 10-minute combined soak at REST concurrency 16 with 32 held stream clients. During the soak: REST p95 at or below 1,000 ms, zero unexpected REST errors, zero unexpected stream disconnects, resident memory no more than 128 MiB above the stabilized baseline, and open handles/descriptors and runtime tasks no more than 8 above baseline.
- Recovery observed 30 seconds after all generated traffic is drained: no harness-owned request or stream remains active; open handles/descriptors and runtime tasks are each no more than 2 above baseline; resident memory is no more than 64 MiB above baseline.
- A stable machine-readable report that identifies the revision and environment, records every required scenario’s observations beside its threshold and verdict, distinguishes expected refusal/not-found outcomes from unexpected errors, and gives one overall verdict.
- Strict isolation: only the locally launched service and fixture/mock market data participate; an attempted live-provider or production-service contact is a failed run.
- Placement in the normal local verification path, with a total target runtime of at most 15 minutes on a supported development machine meeting the repository’s documented prerequisites.
- `NO_UI_CHANGE`; trader behavior, scoring, recommendations, and live production configuration remain unchanged.

**Out**

- Claiming production throughput, sizing replicas, setting an SLO, or replacing production telemetry.
- Calling live market-data providers, production services, brokers, LLMs, or any paid dependency.
- A dashboard, trader-visible capacity indicator, alerts, hosted-runner evidence, or changes to trading and stream behavior.
- Automatically changing thresholds from the latest result or allowing a new baseline to turn a failing revision green.

**Future-dated**

- macOS support, hosted-runner comparison, 30-minute and overnight endurance profiles, multi-replica exercises, and production-telemetry correlation require separate approval and evidence.

### Acceptance criteria

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 | As a developer, I want one repeatable check. | From a clean checkout on each supported platform, the documented local verification action completes without a paid account, vendor credential, or production credential. | test |
| AC-2 | As a developer, I want cold-path evidence. | With the application cache empty before each observation, 12 fixture-backed REST observations produce p95 latency at or below 3,000 ms, no observation above 5,000 ms, and zero unexpected errors. | test |
| AC-3 | As a developer, I want warm-path evidence. | After warm-up, 200 fixture-backed REST requests at concurrency 16 produce p95 latency at or below 250 ms, no observation above 1,000 ms, and zero unexpected errors. | test |
| AC-4 | As a developer, I want parallel-path evidence. | Under 320 fixture-backed REST requests at concurrency 32, p95 latency is at or below 1,500 ms, no observation exceeds 5,000 ms, and no unexpected error occurs. | test |
| AC-5 | As a developer, I need expected absence distinguished from failure. | A request for a symbol deliberately absent from the fixture corpus is recorded as the expected not-found outcome and is not counted as either a successful data response or an unexpected error. | test |
| AC-6 | As a release owner, I want the supported stream load checked. | With the local subscriber cap set to 32, all 32 stream clients connect, connection p95 is at or below 500 ms, and all remain connected for the 60-second hold unless the client intentionally closes. | test |
| AC-7 | As a release owner, I want over-cap behavior checked. | While 32 accepted stream clients remain connected, the 33rd attempt is refused within 1,000 ms and none of the accepted clients is disconnected by that refusal. | test |
| AC-8 | As a release owner, I want reconnect leaks caught. | Across 10 waves in which 32 stream clients connect and then disconnect, every accepted client closes cleanly and no harness-owned stream remains active after each wave drains. | test |
| AC-9 | As an operator, I want sustained mixed-load evidence. | During the 10-minute combined soak at REST concurrency 16 and 32 held streams, REST p95 stays at or below 1,000 ms, with zero unexpected REST errors and zero unexpected stream disconnects. | test |
| AC-10 | As an operator, I want bounded resource use during soak. | At every soak checkpoint, resident memory is no more than 128 MiB above the stabilized pre-load baseline, and open handles/descriptors and runtime tasks are each no more than 8 above baseline. | test |
| AC-11 | As an operator, I want resource recovery after traffic. | Thirty seconds after all generated traffic drains, no harness-owned request or stream remains active; handles/descriptors and runtime tasks are each no more than 2 above baseline; and resident memory is no more than 64 MiB above baseline. | test |
| AC-12 | As a reviewer, I want proof that the run is hermetic. | A complete passing run makes no connection to a live vendor, production service, broker, LLM, or other non-local service. | test |
| AC-13 | As a reviewer, I want isolation failures to be unmistakable. | When the service attempts any forbidden external connection during a scenario, that scenario and the overall run fail even if all latency and error thresholds otherwise pass. | test |
| AC-14 | As a reviewer, I want stable evidence. | Re-emitting the report from the same completed observations produces byte-identical report bytes, including stable scenario ordering, units, thresholds, and verdicts. | test |
| AC-15 | As a reviewer, I want complete evidence. | The report contains one result for every required REST, stream, soak, recovery, and isolation check; an omitted required result makes the overall verdict fail. | test |
| AC-16 | As a developer, I need missing fixtures handled honestly. | When the required fixture corpus is empty, missing, or unreadable, no performance scenario is reported as passing and the verification action exits unsuccessfully with the fixture problem identified. | test |
| AC-17 | As an operator, I need unsupported measurement handled honestly. | When any required latency or resource observation cannot be collected on the current platform, the affected check and overall run fail instead of recording a pass or substituting a null value. | test |
| AC-18 | As a developer, I need startup errors preserved. | When the local service cannot start or become ready, the verification action exits unsuccessfully and retains a machine-readable failure report that identifies startup as the failed stage. | test |
| AC-19 | As a release owner, I need threshold breaches to block verification. | For each latency, error, connection, memory, handle/descriptor, task, and recovery guardrail, a controlled observation beyond that guardrail makes the overall process result non-zero while preserving the measured value and breached threshold in the report. | test |
| AC-20 | As a reviewer, I need the claim bounded. | The operator-facing guidance states that a pass is a local regression baseline, not proof of production capacity, production availability, or an SLO. | review |
| AC-21 | As a trader, I expect no product change. | A reviewer exercising the trader application before and after this feature observes no new or changed trader-facing control, copy, status, workflow, score, recommendation, or stream behavior. | review |

## Risks I see

- Fixed latency thresholds may punish slower supported development machines rather than product regressions; the first measured implementation pass must challenge the numbers, but any revision requires an explicit product decision rather than silent auto-baselining.
- A 10-minute soak inside normal verification increases feedback time; excluding it from the normal path would undermine the stated goal, while exceeding the 15-minute total target would make routine use less likely.
- A report can look deterministic while measurements are not. Stable serialization and fixed traffic are necessary, but repeat-run variance still needs to be visible rather than averaged away.
- “No external traffic observed” can become a weak claim if enforcement only checks known vendor hosts. Any external connection must fail, including an unexpected new dependency.
- Resource counts can differ by operating system and background activity. The thresholds are deliberately relative to a stabilized per-run baseline, but unsupported or missing samples must fail visibly.
- The local cap of 32 validates behavior at a representative boundary; it does not establish the safe subscriber count in production.

## Assumptions I'm making about the other two lanes

- The architecture lane can make any attempted non-local network connection a hard, observable failure rather than relying only on omitted credentials.
- The architecture lane can give the runner observable, platform-consistent counts for active harness-owned requests/streams, runtime tasks, resident memory, and handles/descriptors on Windows 11 and Linux x64.
- The architecture lane can establish an empty-cache cold precondition and a stable warm precondition without changing trader-serving behavior.
- The architecture lane can configure a local stream cap of exactly 32 and observe acceptance/refusal without adding or changing a trader-facing surface.
- The architecture lane can retain a machine-readable report after startup failure, interruption, threshold breach, or isolation breach.
- The UX/tech-writer lane will keep all guidance operator/developer-facing and introduce no dashboard or trader-visible copy.
- The UX/tech-writer lane will use language that distinguishes an expected cap refusal or not-found response from an unexpected failure and never calls a local pass “production-ready.”
- The UX/tech-writer lane will make the failing scenario, observed value, threshold, and recovery action understandable without requiring the reader to inspect source code.
