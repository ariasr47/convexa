# R1 — ux position: capacity-baseline

## Position

### Surface and user

- **Intended user:** the developer or release verifier who runs the local capacity check and consumes its machine-readable evidence. This feature has no trader-facing or dashboard surface.
- **Primary job:** determine whether the current revision satisfies the explicitly contracted local REST/SSE capacity thresholds, with a failed threshold producing a failed normal verification run.
- **Information structure:** measurements and their threshold outcomes belong only to the harness's machine-readable report and process result. Nothing is added to dashboard navigation, routes, components, states, copy, tooltips, glossary, or trader payloads.
- **Binding scope:** `NO_UI_CHANGE`. The dashboard retains its existing behavior and wording. The harness must remain off trader routes and must not change the single-ticker request path, SSE behavior, scoring, recommendation math, or trader-visible data.

### Vocabulary and claim integrity

The report vocabulary must preserve the measured concepts named by the brief: REST `warm`, `cold`, and `parallel`; SSE `connect`, `hold`, `disconnect`, `cap`, and `refusal`; and the measured dimensions `latency`, `error`, `concurrency`, `memory`, `file descriptor`, and `task recovery`. A reported value must retain its unit, scenario, statistic or sampling basis, threshold, and pass/fail direction wherever those are necessary to interpret it. A missing, unsupported, or skipped measurement must not be presented as a passing measurement.

This local, fixture- or mock-backed result must not be labeled or described as proof of production capacity, production safety, vendor performance, or a scaling guarantee. It is local baseline evidence for the tested revision and scenarios. No additional user-facing microcopy, tooltip, or glossary is warranted by the brief; final machine-report field names are a contract concern outside this lane.

### Component states and datum placement

The component-state matrix is **not applicable**: there is no component and no default, loading, stale, offline, empty, error, or success state to add to the dashboard. No datum from the harness surfaces in the UI. Harness startup, collection, threshold evaluation, and failure behavior are execution/report states owned by the backend contract, not UI states to be disguised as product states.

### Acceptance coverage and Verify by

Until PM supplies the final atomic acceptance-criteria rows, the brief-level requirements map as follows. All are `test` because each can silently regress while the existing product still looks normal; no separate UX test matrix is proposed.

| Brief-level observable requirement | Component state(s) | Verify by |
| --- | --- | --- |
| The harness exercises representative REST warm, cold, and parallel traffic. | N/A — no UI surface | `test` |
| The harness exercises SSE connect, hold, disconnect, configured cap, and refusal behavior. | N/A — no UI surface | `test` |
| Explicit latency, error, concurrency, and resource-recovery thresholds are evaluated rather than merely recorded. | N/A — no UI surface | `test` |
| A breached or unavailable required threshold produces a non-zero result in the normal local verification path. | N/A — no UI surface | `test` |
| The same controlled inputs produce a deterministic machine-readable report, apart from any fields the final contract explicitly defines as variable evidence. | N/A — no UI surface | `test` |
| The run contacts no live vendor or production service and requires no paid subscription. | N/A — no UI surface | `test` |
| Dashboard source, navigation, trader-facing copy, trader payloads, and trader-visible behavior remain unchanged. | N/A — no UI surface | `test` |
| The harness leaves the single-ticker request path, gamma sources, scoring, recommendation math, and SSE runtime behavior unchanged outside the isolated test run. | N/A — no UI surface | `test` |

PM should preserve these as automated requirements when assigning final AC identifiers. A criterion about visible copy, presence, or ordering would normally be `review`, but this brief authorizes no such change.

## Risks I see

- A report label such as “production capacity,” “safe,” or “vendor latency” would overclaim what hermetic local fixture/mock evidence supports.
- Values without units, scenario identity, statistic/sampling basis, or threshold direction could be technically present yet operationally misleading.
- Treating a skipped or unavailable sample as zero, success, or omission could make an incomplete run read as a passing run.
- Adding a dashboard status, operator page, trader-route field, or explanatory product copy would violate `NO_UI_CHANGE`, even if described as observability.
- Relying on visual review for vendor isolation, deterministic output, threshold failure, resource recovery, or no-UI drift would leave silent regressions unprotected.

## Assumptions I'm making about the other two lanes

- PM will turn every must-clause in the brief into atomic, observable acceptance criteria without adding a UI, a hosted service, a paid dependency, or a production-capacity claim.
- PM will define “representative” REST/SSE scenarios and the decision-relevant threshold outcomes precisely enough that pass, fail, and required-measurement-unavailable cannot be confused.
- Architecture will name a hermetic enforcement mechanism that makes any live-vendor or production-service contact fail the run, rather than relying on instructions or operator care.
- Architecture will define the portable runner boundary, resource-sampling basis, recovery observation window, deterministic report contract, and normal local-gate integration without changing trader routes or runtime semantics.
- Architecture will keep the harness isolated from scoring, recommendation math, gamma-source selection, the single-ticker trading request path, and the normal SSE runtime after the test process exits.
