# Portfolio demo foundation — local evidence

Date: 2026-10-07 America/Los_Angeles. Scope: shared frontend provider/build foundation S1–S4 only. Dashboard composition is not yet joined. This is local source and unit evidence, not a built-app, CI, hosted or production receipt.

## Measured checks

| Check | Command | Native result |
|---|---|---|
| G5 wrapper, route receipt and resolved Nx identity | `node tools/build-dashboard.spec.mjs` with `NX_DAEMON=false` and `NX_NO_CLOUD=true` | **Exit 0; 4 passed, 0 failed; 2.19 s** |
| G2–G4 focused provider checks | From `C:\Dev\convexa\libs\api`: `npx vitest run --config vite.config.mts src/lib/demo/indicators.spec.ts src/lib/demo/catalog/catalog.spec.ts src/lib/demo/transport.spec.ts src/lib/demo/workspace.spec.ts` | **Exit 0; 4 files, 10 tests passed; 0.693 s** |
| Full API Vitest suite | `npm exec --no -- vitest run --config C:/Dev/convexa/libs/api/vite.config.mts --reporter=dot` | **Exit 0; 8 files, 55 tests passed; 0.753 s** |
| API library typecheck | `npx tsc --noEmit -p libs/api/tsconfig.lib.json` | **Exit 0; 3.44 s** |
| Atlas JavaScript syntax | `node --check docs/backend-atlas/atlas.js` | **Exit 0** |

The G5 guard includes invalid explicit mode rejection, both live/demo route receipts, an assertion that the resolved Nx build identity contains mode and postprocessor inputs (and rejects a poisoned identity), and deterministic private-map output including a no-map manifest. The focused G2–G4 checks pin selected catalog coherence, ticker/scanner dependent values and DTO projection, local book round-trip/linkage, stream lifecycle/timestamps, corrupt settings/view/book byte preservation, and indicator vectors. The full API suite also verifies generated wire authority and existing API contract behavior.

## Can-fail proof

G4 ATR divisor proof was run against the focused indicator spec. I changed only the simple ATR divisor from 14 to 13; command `npx vitest run --config vite.config.mts src/lib/demo/indicators.spec.ts` exited **1**, with the independent flat-vector expectation failing (`expected value: 2`, received `2.1538461538461537`; 1 failed, 1 passed). I restored 14 and reran the entire focused G2–G4 command above: **exit 0, 9/9 passed**.

## Not measured

The demo/live production build and Nx cache sequence, bundle limits/complete boot closure, composed dashboard behavior, full frontend suites, static artifact browser journey, attempted-request/no-egress counter, Pages preview routing, CI, hosted behavior and independent QA are all **NOT RUN**. Do not infer any of those results from the foundation checks or the pre-change baseline. The anonymous live API receipt elsewhere in this directory is not evidence for demo behavior.
