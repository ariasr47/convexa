# Shared foundation receipt (S1–S5)

Date: 2026-10-07. Scope: shared frontend provider, local scenario/workspace and build foundation only. This receipt does not claim the dashboard is complete, built, browser-verified or deployed.

## Implemented paths

- S1 build/mode artifact: `package.json`, `apps/dashboard/package.json`, `apps/dashboard/vite.config.mts`, `apps/dashboard/index.html`, `tools/build-dashboard.mjs`, `tools/write-dashboard-routes.mjs`, `tools/archive-sourcemaps.mjs`, `tools/build-dashboard.spec.mjs`.
- S2 scenario catalog: `libs/api/src/lib/demo/catalog/{shared,index,spy,qqq,aapl,msft,nvda,tsla}.ts` and `catalog/catalog.spec.ts`.
- S3 provider/views/math: `libs/api/src/lib/client.ts`, public barrel `libs/api/src/index.ts`, `libs/api/src/lib/demo/{mode,transport,views,types,indicators}.ts`, plus `transport.spec.ts` and `indicators.spec.ts`.
- S4 local workspace/streams: `libs/api/src/lib/demo/{workspace,streams}.ts`, `libs/api/src/lib/convexa.ts`, `libs/api/src/index.ts`, `workspace.spec.ts`.
- S5 atlas/status: `docs/backend-atlas/{index.html,atlas.js,README.md}` and `docs/backend-atlas/evidence/demo-local.md`.

No backend, Rust, generated schema, quant engine, deployment, commit or push work was performed by this foundation task. Existing unrelated dirty files and documentation were preserved.

## Verification receipts

Commands ran from absolute PowerShell workdirs with Nx daemon/cloud disabled. Vitest and Nx guard commands ran escalated because the sandbox cannot access the installed Windows native dependency/temp operations; no dependency was reinstalled.

| Check | Native result |
|---|---|
| `node tools/build-dashboard.spec.mjs` (`NX_DAEMON=false`, `NX_NO_CLOUD=true`) | **Exit 0; 4/4 passed; 2.19 s.** Covers invalid mode, demo/live route and receipt output, resolved Nx identity and a poisoned missing-input assertion, deterministic private map output/history/no-map manifest. |
| `npx vitest run --config vite.config.mts src/lib/demo/indicators.spec.ts src/lib/demo/catalog/catalog.spec.ts src/lib/demo/transport.spec.ts src/lib/demo/workspace.spec.ts` from `C:\Dev\convexa\libs\api` | **Exit 0; 4 files / 10 tests passed; 0.693 s.** Includes corrupt settings/view/book preservation and write refusal. |
| `npm exec --no -- vitest run --config C:/Dev/convexa/libs/api/vite.config.mts --reporter=dot` | **Exit 0; 8 files / 55 tests passed; 0.753 s.** Existing contract-authority and API tests included. |
| `npx tsc --noEmit -p libs/api/tsconfig.lib.json` | **Exit 0; 3.44 s.** Generated DTO success builders are checked against generated schema types. |
| `npx tsc --build --emitDeclarationOnly libs/api/tsconfig.json --pretty false` | **Exit 0.** Project-reference declaration build includes API specs. |
| Focused follow-up: `npx vitest run --config vite.config.mts src/lib/demo/catalog/catalog.spec.ts src/lib/demo/transport.spec.ts` from `C:\Dev\convexa\libs\api` | **Exit 0; 2 files / 3 tests passed; 0.847 s.** |
| `node --check docs/backend-atlas/atlas.js` | **Exit 0.** |
| `git diff --check` across owned implementation and atlas paths | **Exit 0.** Git reported existing CRLF-to-LF normalization warnings on a few repository files; no whitespace errors. |

G4 can-fail proof: temporarily changed the ATR divisor from 14 to 13, then ran `npx vitest run --config vite.config.mts src/lib/demo/indicators.spec.ts` from `libs/api`. Native exit **1**; the independent flat vector expected 2 and received 2.1538461538461537 (one failed, one passed). Restored the divisor to 14 and reran the focused G2–G4 set above: **exit 0, 9/9 passed**.

G2 includes the poisoned-variant oracle in `catalog/catalog.spec.ts`: it supplies the November patch with the full-chain fingerprint to `assertCuratedVariants` and asserts that the invariant throws. G5 similarly runs the real Nx query then asserts a poisoned mode-input identity is rejected. These are checked counterexamples inside the green test suites; they do not substitute for a full product-level QA run.

The follow-up project-reference declaration build initially surfaced test-only strict-null errors: the nullable lazy SPY scenario, discriminated expiry result, and optional `score_drivers`. Specs now assert and explicitly narrow those states before inspecting required fields; no nullability was erased with casts. The declaration build and both focused specs pass after that fix.

## Frozen public interface

Import through `@convexa/api` / `libs/api/src/index.ts`:

- Mode and provenance: `dataMode`, `scenarioProvenance`, `demoStorageKey`; types `DataMode`, `SupportedDemoSymbol`, `ScenarioProvenance`, `BuildBootstrap`.
- Local optional views: `loadSampleBars`, `loadSampleResearch`; types `LocalOutcome`, `SampleBarsView`, `SampleBar`, `SampleResearchCase`, `IndicatorName`, `IndicatorPoint`.
- Workspace: `initializeDemoWorkspace`, `resetDemoWorkspace`, `demoClock`, `subscribeDemoClock`, `resumeDemoPlayback`, `demoNowMs`, `canSimulatePaperAction`; types `DemoClock`, `DemoOrderFrame`, `Unsubscribe`.
- Existing public stream facade is demo-safe: `streamTicker`; shared subscriptions: `subscribeTicker`, `subscribeScannerPrices`; types `MarketStreamEvent`, `ScannerPrice`.

Demo transport dispatches the 30 current HTTP method/path dispositions using generated DTO checks. The generated `components` type is re-exported by the existing `convexa.ts` authority and consumed from there, satisfying the retained import-boundary guard. Catalogs cover the six contracted symbols and seven curated expiry sets, with lazy symbol imports. Broker examples, authored analysis and browser seed records are synthetic and internally linked. Demo storage uses the single bootstrap resolver and isolated namespace; per-key read/shape failures latch writes, and malformed settings, scanner view or book bytes remain intact. Book PUT validates the existing positions/orders/touch/overlay stores and its next projection before writing. The clock only advances while observed and waits for a fresh frame before evaluating pending orders. The dashboard integration lane must seed before dynamic App import and must not hydrate the generated array book DTO over the richer v3 browser store.

## Remaining verification

The dashboard app integration has not joined this receipt. Full production demo/live build and cache matrix, bundle/initial-boot closure, full unit suites, app/browser journey, attempted-request counter, static Pages preview routing, CI and hosted evidence are **NOT RUN**. QA must observe the complete built application before claiming feature acceptance. The foundation code is ready for the sequential F1–F3 dashboard integration against the public boundary above.
