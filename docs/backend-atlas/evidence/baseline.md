# Before implementation: frontend production baseline

Date: 2026-10-07 America/Los_Angeles. Product source baseline: `8932fc1176543eff3fa826de6924e12ec52f3310`. Only atlas/design documents had been added; no application/build configuration had changed.

Command: `npm exec --no -- nx build @convexa/dashboard --configuration=production --skip-nx-cache` with `NX_DAEMON=false`, `NX_NO_CLOUD=true`, `VITE_DATA_MODE=live`. The current source does not yet consume the data-mode variable. Ran outside the sandbox because the same native Nx/SWC path access is restricted inside it.

- Native exit: **0**.
- Measured wall time around npm/Nx invocation: **10.39 s**.
- Nx-reported task duration: **4.8 s**; Vite-reported build: **2.69 s**. These use different timer boundaries.
- Source maps: 35 moved to private timestamped output; precompression: 41 sources → 82 gzip/Brotli siblings.
- `node tools/check-dashboard-bundle.mjs`: native exit **0**; **43 checks**, 36 JS assets; PositionsPage chart-dependency guard passed.

Representative measured Brotli q11 chunk sizes (KiB, checker rounded): entry **17.9**, React **47.2**, MUI **87.2**, router **12.3**, TickerDashboard **40.2**, PositionsPage **27.5**, Scanner **10.6**, FigureCell **25.6**, operator-metrics **89.1**. These are individual chunks, not summed route-transfer sizes.

The raw command output is in `baseline-build.log`. This is local build evidence only. No application tests, live provider calls, backend process, hosted demo or production migration are implied.

## Existing frontend test baseline

Before application edits, live mode with Nx daemon/cloud disabled: npm exec --no -- nx test @convexa/dashboard --run --skip-nx-cache. Native exit code **0**; **261 files / 3,139 tests passed**. Wall time **84.65 s**, Vitest **80.75 s**. Parallel aggregate phase durations exceed wall time and are not added together. The log includes existing jsdom canvas and React/colour warnings; these are not new failures. Raw log: baseline-tests.log. Resolved target: dashboard-resolved-baseline.json. This is local evidence, not a GitHub CI or hosted result.

Raw command logs and the full inferred-target dump remain local and are ignored by Git. The compact resolved build/test/typecheck evidence is retained in dashboard-targets-baseline.json.
