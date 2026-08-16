# Task 1 report

Implemented the pure `deriveAiRecPresentation` policy and focused matrix coverage in the two owned
files. The policy consumes only existing `RecResponse`, `RecCap`, and `RiskInputs` fields, centralizes
request/result precedence, structural completeness, supersession detection, and action safety. No
live/SSE concepts or backend/contract files were touched.

RED was observed with the focused Vitest command failing to resolve `./presentationPolicy`.

Verification:

- `npx vitest run src/app/pages/ticker/widgets/ai-rec/presentationPolicy.spec.ts` — pass, 1 file / 19 tests.
- `npx nx typecheck @convexa/dashboard` — pass.

Promoted invariants checked: static recommendation/live-tape isolation (no SSE/live symbols or inputs),
no real-order path (only policy booleans), traceable existing fields only, and safe absence handling
using trim plus finite-strike checks.

Commit: `task: centralize AI recommendation action policy`

## Round 1/5 fix evidence

Updated recovery/action gating so degraded refresh requires the derived `requestState === 'idle'`;
generic unavailable retry remains available only through its own signed-in, available-gate path. The
signed-out outer gate now suppresses ask-anyway, retry, and settings regardless of retained/error data.
Added explicit coverage for absent soft fields, blocked cap refresh, scenario cooldown bypass,
incomplete structural trades, and signed-out recovery suppression.

Verification:

- `npx vitest run src/app/pages/ticker/widgets/ai-rec/presentationPolicy.spec.ts` — pass, 1 file / 24 tests.
- `npx nx typecheck @convexa/dashboard` — pass.
