# GATE Z — hosted typecheck fixture correction

Status: ACCEPTED
Owner: Frontend
Task: B5-typecheck-fixture

## Observed failure

GitHub Actions run `33031240789`, frontend job `98384009490`, passed API contract generation,
format, and lint, then failed `npm run typecheck`. Local reproduction is exact:

`apps/dashboard/src/app/pages/operator-metrics/useLatencyTrend.spec.tsx` constructs a typed
`MetricsAggregate` fixture without the newly required additive `session_archive_coverage` member.

## Narrow correction

B5 may edit only
`apps/dashboard/src/app/pages/operator-metrics/useLatencyTrend.spec.tsx`, adding one truthful,
fully typed coverage object to the existing aggregate fixture. This is test data only.

No production dashboard source, component, hook, UI state, copy, design, motion, navigation, API
contract, generated client, backend behavior, quant/scoring behavior, or state fingerprint may change.
The feature remains `NO_UI_CHANGE` in observable product behavior.

## Required proof

- `npx nx run @convexa/dashboard:typecheck --skip-nx-cache`
- the named `useLatencyTrend` unit test
- full configured dashboard test command
- `npm run typecheck`
- empty production-dashboard diff outside the one authorized spec file
- fresh GATE Q and hosted checks after the correction
