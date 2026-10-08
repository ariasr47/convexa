# Shared foundation receipt (S1–S5)

Date: 2026-10-07. Scope: shared frontend provider, local scenario/workspace and build foundation only. This receipt does not claim the dashboard is complete, built, browser-verified or deployed.

## Implemented paths

- S1 build/mode artifact: `package.json`, `apps/dashboard/package.json`, `apps/dashboard/vite.config.mts`, `apps/dashboard/index.html`, `tools/build-dashboard.mjs`, `tools/write-dashboard-routes.mjs`, `tools/archive-sourcemaps.mjs`, `tools/build-dashboard.spec.mjs`.
- S2 scenario catalog: `libs/api/src/lib/demo/catalog/{shared,index,assets,asset-fetch,scenario-loader,spy,qqq,aapl,msft,nvda,tsla}.ts`, six `*.seed.json` canonical authored seeds, minimal `libs/api/src/vite-env.d.ts`, and `catalog/catalog.spec.ts`.
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
| Focused S3/S4 follow-up: `npm exec --no -- vitest run --config C:/Dev/convexa/libs/api/vite.config.mts C:/Dev/convexa/libs/api/src/lib/demo/transport.spec.ts C:/Dev/convexa/libs/api/src/lib/demo/workspace.spec.ts --reporter=dot` | **Exit 0; 2 files / 7 tests passed; 0.615 s.** Covers API consumer vocabulary/threshold/normalization, separate recommendation status/export, read-only sample broker refresh, and blocked-storage startup pause/recovery while preserving existing bytes. |
| `npm exec --no -- vitest run --config C:/Dev/convexa/libs/api/vite.config.mts --reporter=dot` | **Exit 0; 8 files / 56 tests passed; 0.820 s.** Existing contract-authority and API tests included. |
| `npx tsc --noEmit -p libs/api/tsconfig.lib.json` | **Exit 0; 3.44 s.** Generated DTO success builders are checked against generated schema types. |
| `npx tsc --build --emitDeclarationOnly libs/api/tsconfig.json --pretty false` | **Exit 0.** Project-reference declaration build includes API specs. |
| `npx nx run @convexa/dashboard:typecheck --skip-nx-cache` with `NX_DAEMON=false`, `NX_NO_CLOUD=true` | **Exit 0; Nx succeeded; 0.944 s.** Includes the dashboard and emitted API declarations after the joined F2 work. |
| Current full API Vitest suite after lazy-asset, controller-race and exact recommendation selector changes | `npm exec --no -- vitest run --config C:/Dev/convexa/libs/api/vite.config.mts --reporter=dot` | **Exit 0; 8 files / 58 tests passed; 1.13 s.** |
| Current API library and spec no-emit typechecks | `npx tsc --noEmit -p C:/Dev/convexa/libs/api/tsconfig.lib.json --pretty false` and `npx tsc --noEmit -p C:/Dev/convexa/libs/api/tsconfig.spec.json --pretty false` | **Both exit 0.** |
| Latest joined dashboard typecheck attempt | `npx nx run @convexa/dashboard:typecheck --skip-nx-cache` with `NX_DAEMON=false`, `NX_NO_CLOUD=true` | **Exit 1.** Current diagnostics are in app-owned `useTickerPageModel.ts` (seven fields absent from `TickerBundle`) and `AppShell.tsx:111` (MUI Stack props). API declarations and specs emitted without diagnostics. This is an app integration blocker for the root/F4 owner; foundation did not edit app paths. |
| Focused follow-up: `npx vitest run --config vite.config.mts src/lib/demo/catalog/catalog.spec.ts src/lib/demo/transport.spec.ts` from `C:\Dev\convexa\libs\api` | **Exit 0; 2 files / 3 tests passed; 0.847 s.** |
| `node --check docs/backend-atlas/atlas.js` | **Exit 0.** |
| `git diff --check` across owned implementation and atlas paths | **Exit 0.** Git reported existing CRLF-to-LF normalization warnings on a few repository files; no whitespace errors. |

G4 can-fail proof: temporarily changed the ATR divisor from 14 to 13, then ran `npx vitest run --config vite.config.mts src/lib/demo/indicators.spec.ts` from `libs/api`. Native exit **1**; the independent flat vector expected 2 and received 2.1538461538461537 (one failed, one passed). Restored the divisor to 14 and reran the focused G2–G4 set above: **exit 0, 9/9 passed**.

G2 includes the poisoned-variant oracle in `catalog/catalog.spec.ts`: it supplies the November patch with the full-chain fingerprint to `assertCuratedVariants` and asserts that the invariant throws. G5 similarly runs the real Nx query then asserts a poisoned mode-input identity is rejected. These are checked counterexamples inside the green test suites; they do not substitute for a full product-level QA run.

The follow-up project-reference declaration build initially surfaced test-only strict-null errors: the nullable lazy SPY scenario, discriminated expiry result, and optional `score_drivers`. Specs now assert and explicitly narrow those states before inspecting required fields; no nullability was erased with casts. Both API no-emit typechecks pass. A later joined Nx run currently fails only in the named dashboard files above.

S3 follow-up reconciles demo wire values with the current consumers: scanner rows use `ok`, the actionable cutoff includes score 60, ticker paths normalize lowercase symbols, setups report `medium` conviction and straddle data uses `rth`. Recommendation POST now selects by exact existing `snapshot_fingerprint`, supports the catalog's noncontiguous expiry variant and rejects absent/unknown/mismatched fingerprints or out-of-bound dates. Export can receive the selected fingerprint through a demo-only `fetchRecExport` option/header; live request shape stays unchanged. Recommendation status reports an available local gate with no AI capability; the POST returns a complete authored sample result; export returns its own context, authored analysis and all six `sent: false` disclosures. Broker refresh returns the same synthetic cache snapshot as read without attempting a connection. The storage getter failure case marks the demo clock paused, refuses reset while storage is inaccessible, and allows resume/seed after access returns without changing pre-existing namespaced or live bytes.

S2 runtime loading now fetches one of six canonical JSON seed assets via static `?url&no-inline` imports. The loader validates seed identity and finite parameters, deduplicates in-flight work, caches only success and clears rejected attempts so explicit controller retry can recover from a failed asset request. The old symbol `.ts` files are retained as compatibility/test wrappers over those same JSON seeds; they are not runtime loader paths. G1 still needs to observe built-asset HTTP failure and retry in the joined application.

S4 frame generation is serialized and bounded. The clock advances by five seconds per observed second even while a catalog load is pending; no second batch starts until the first settles. Each awaited load rechecks playback generation, captured offset and original subscriber cohort before dispatch. Pause/end invalidates the batch, and load rejection pauses/stops until explicit resume. The audit's pre-fix deferred-loader probe measured 6 pre-subscription frames delivered to a replacement subscriber, 6 frames after pause, and 2,154 frames after end. The current `workspace.spec.ts` regression covers unsubscribe/resubscribe during a held load, storage-fault pause, stale success rejection, current-offset failure pause, explicit retry, hard end and late completion; the full API suite is green at 58/58.

## Frozen public interface

Import through `@convexa/api` / `libs/api/src/index.ts`:

- Mode and provenance: `dataMode`, `scenarioProvenance`, `demoStorageKey`; types `DataMode`, `SupportedDemoSymbol`, `ScenarioProvenance`, `BuildBootstrap`.
- Local optional views: `loadSampleBars`, `loadSampleResearch`; types `LocalOutcome`, `SampleBarsView`, `SampleBar`, `SampleResearchCase`, `IndicatorName`, `IndicatorPoint`.
- Workspace: `initializeDemoWorkspace`, `resetDemoWorkspace`, `demoClock`, `subscribeDemoClock`, `resumeDemoPlayback`, `demoNowMs`, `canSimulatePaperAction`; types `DemoClock`, `DemoOrderFrame`, `Unsubscribe`.
- Existing public stream facade is demo-safe: `streamTicker`; shared subscriptions: `subscribeTicker`, `subscribeScannerPrices`; types `MarketStreamEvent`, `ScannerPrice`.

Demo transport dispatches the 30 current HTTP method/path dispositions using generated DTO checks. The generated `components` type is re-exported by the existing `convexa.ts` authority and consumed from there, satisfying the retained import-boundary guard. Catalogs cover the six contracted symbols and seven curated expiry sets, fetched from static JSON assets through the retryable lazy loader. Broker examples, authored analysis and browser seed records are synthetic and internally linked. Demo storage uses the single bootstrap resolver and isolated namespace; per-key read/shape failures latch writes, and malformed settings, scanner view or book bytes remain intact. Book PUT validates the existing positions/orders/touch/overlay stores and its next projection before writing. The clock only advances while observed and waits for a fresh frame before evaluating pending orders. The dashboard integration lane must seed before dynamic App import and must not hydrate the generated array book DTO over the richer v3 browser store.

AI panel integration handoff: keep `fetchRecStatus().availability.in_app_enabled === false` because no model capability exists. F4 owns the explicit demo presentation/action branch: label the separate action as authored sample analysis, call the ordinary local `requestRecommendation` POST without an AI key, and label the returned content as authored scenario analysis. The existing export facade accepts `sampleFingerprint` locally so the selected authored variant can be exported. Do not present it as model-generated, provider-backed, or an operator-run scenario.

## Remaining verification

The dashboard app integration has not joined this receipt. The latest joined Nx typecheck exits 1 on app-owned `useTickerPageModel.ts` and `AppShell.tsx` diagnostics; the API library/spec checks remain green. Root/F4 owns those app paths. Full production demo/live build and cache matrix, bundle/initial-boot closure, full dashboard suites, app/browser journey, attempted-request counter, static Pages preview routing, CI and hosted evidence are **NOT RUN**. QA must observe the complete built application before claiming feature acceptance.
