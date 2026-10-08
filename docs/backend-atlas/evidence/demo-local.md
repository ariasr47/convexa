# Portfolio demo foundation — local evidence

Date: 2026-10-07 America/Los_Angeles. Scope: shared frontend provider/build foundation S1–S4 only. Dashboard composition is not yet joined. This is local source and unit evidence, not a built-app, CI, hosted or production receipt.

## Measured checks

| Check | Command | Native result |
|---|---|---|
| G5 wrapper, route receipt and resolved Nx identity | `node tools/build-dashboard.spec.mjs` with `NX_DAEMON=false` and `NX_NO_CLOUD=true` | **Exit 0; 4 passed, 0 failed; 2.19 s** |
| S3/S4 focused follow-up | `npm exec --no -- vitest run --config C:/Dev/convexa/libs/api/vite.config.mts C:/Dev/convexa/libs/api/src/lib/demo/transport.spec.ts C:/Dev/convexa/libs/api/src/lib/demo/workspace.spec.ts --reporter=dot` | **Exit 0; 2 files, 7 tests passed; 0.615 s** |
| Full API Vitest suite (latest) | `npm exec --no -- vitest run --config C:/Dev/convexa/libs/api/vite.config.mts --reporter=dot` | **Exit 0; 8 files, 58 tests passed; 0.964 s** |
| API library and spec no-emit typechecks | `npx tsc --noEmit -p C:/Dev/convexa/libs/api/tsconfig.lib.json --pretty false` and `npx tsc --noEmit -p C:/Dev/convexa/libs/api/tsconfig.spec.json --pretty false` | **Both exit 0** |
| Earlier dashboard Nx typecheck | `npx nx run @convexa/dashboard:typecheck --skip-nx-cache` with `NX_DAEMON=false`, `NX_NO_CLOUD=true` | **Exit 0; Nx succeeded; 0.944 s**, before latest app integration edits |
| Latest joined dashboard Nx typecheck | same command, run after API changes | **Exit 1**; app-owned `useTickerPageModel.ts` expects seven fields absent from `TickerBundle`, and `AppShell.tsx:111` has MUI Stack prop errors. API declarations emitted with no diagnostics. Foundation did not edit app files. |
| Atlas JavaScript syntax | `node --check docs/backend-atlas/atlas.js` | **Exit 0** |

The G5 guard includes invalid explicit mode rejection, both live/demo route receipts, an assertion that the resolved Nx build identity contains mode and postprocessor inputs (and rejects a poisoned identity), and deterministic private-map output including a no-map manifest. Focused G2–G4 checks cover catalog coherence, ticker/scanner dependent values and DTO projection, local book round-trip/linkage, stream lifecycle/timestamps, corrupt settings/view/book byte preservation, indicator vectors, distinct recommendation status/export projections, local broker refresh, and storage-getter failure pause/recovery without modifying existing bytes. The scanner projection is checked for the consumer vocabulary (`ok`), the score-60 actionable boundary, lowercase ticker normalization, `rth` session basis, and `medium` conviction. The full API suite also verifies generated wire authority and existing API contract behavior.

The lazy scenario loader uses canonical JSON asset URLs and validates the seed before success caching. A rejected fetch clears its in-flight entry; the catalog test retries that same URL and recovers, covering the failure path without importing failed JavaScript modules. Recommendation POST and selected export now consume the exact catalog fingerprint, including the noncontiguous Oct 9 + Nov 20 set; export selection header is sent only in demo mode.

## Can-fail proof

G4 ATR divisor proof was run against the focused indicator spec. I changed only the simple ATR divisor from 14 to 13; command `npx vitest run --config vite.config.mts src/lib/demo/indicators.spec.ts` exited **1**, with the independent flat-vector expectation failing (`expected value: 2`, received `2.1538461538461537`; 1 failed, 1 passed). I restored 14 and reran the entire focused G2–G4 command above: **exit 0, 9/9 passed**.

The read-only deferred-loader probe found the pre-fix lifecycle bug: replacing a subscriber during a held load delivered 6 old frames to the replacement, storage pause still emitted 6, and a held load emitted 2,154 frames after the 30-minute hard end. The current G3 workspace regression holds and then resolves/rejects the loader across unsubscribe/resubscribe, pause, resume and end; it asserts zero stale or post-end frames and explicit retry behavior. It passes in the latest 58-test API suite.

## Not measured

The demo/live production build and Nx cache sequence, bundle limits/complete boot closure, composed dashboard behavior, full frontend suites, static artifact browser journey, attempted-request/no-egress counter, Pages preview routing, CI, hosted behavior and independent QA are all **NOT RUN**. Do not infer any of those results from the foundation checks or the pre-change baseline. The anonymous live API receipt elsewhere in this directory is not evidence for demo behavior.
