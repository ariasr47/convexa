# App integration checkpoint — F1–F3 and F5

This is a builder handoff checkpoint, not the independent QA verdict or a deployment receipt.

## Completed scope

- F1 initializes the isolated workspace before dynamically mounting application stores. Demo identity and capabilities are local; operator modules remain gated.
- F2 resolves all current/legacy durable keys through the bootstrap resolver, preserves visitor edits and corrupt bytes, and skips live server book synchronization.
- F3 wires scenario-time frames into both the host and pure order engine. Initial retained frames do not fill orders; pause/end/missing marks do not fill; create/cancel/expiry/decision times use scenario time. Scanner distinguishes sample mode from a missing live sweep.
- F5 exports independent, lazy-ready TechnicalAnalysisView and ResearchView components with loading, unsupported, live-unavailable, cold retry and retained-failure states. F6 will join routes and inspect them in the running production artifact.

## Builder command receipts

The app-state builder reported a final scoped Vitest run of **9 files / 117 tests, native exit 0** (1.52 s), canonical dashboard Nx typecheck exit 0, and diff check exit 0. Coverage includes 16 actual generated-bootstrap first-paint checks, namespace/corruption/reset behavior, future-host-date pure and host order paths, and sample scanner mode. Existing React act warnings remain in the older isolation test.

A read-only audit then reproduced a persona data-loss path: a throwing read was treated as an absent record, allowing saveActiveId to erase unread custom personas. The new demo-only direct guarded read now latches writes after acquisition/read failure; live resolution is unchanged. The regression failed with the observed before/after stored bytes before repair, then the complete G3 flow file passed **6/6, native exit 0** (1.54 s). A contemporaneous dashboard check returned exit 1 because the shared provider owner was still connecting two new helpers; the completed shared join subsequently passed the canonical dashboard check.

The foundation owner repaired the storage-getter startup failure and exact API-consumer vocabulary/status/export seams, then reported **8 API files / 56 tests, exit 0** (0.820 s), focused transport/workspace **7/7, exit 0**, and canonical dashboard Nx typecheck **exit 0**. See FOUNDATION_REPORT.md for commands and boundary details.

The F5 builder reported canonical dashboard Nx typecheck, scoped Prettier and diff checks **exit 0**. Browser inspection was explicitly **NOT RUN** by this worker.

## Conductor observations

- `npm run api:contract:check` completed with native **exit 0** after these app changes; generated artifacts match the Rust contract.
- Protected-path diff against source baseline `8932fc1176543eff3fa826de6924e12ec52f3310` returned **exit 0** with no changes to apps/api, libs/quant-engine, generated API types, Cargo manifests/lock or railway.json.
- `contract_lint portfolio-demo-platform` returned **exit 0**, zero errors and two pre-existing context-size warnings after the F4 ownership amendment.

## Still owed

F4 visible shell/capability/sample-analysis integration; F6 route/tab join, production build/browser journey and CI wiring; final full test/type/lint/build-cache/bundle/browser checks; fresh independent QA; feature-only preview deployment and hosted smoke. None of those outcomes is established by this checkpoint.

## First composed full-suite run (before F6)

The conductor ran `npm exec --no -- vitest run --config C:/Dev/convexa/apps/dashboard/vite.config.mts --reporter=dot` from the workspace root. Native **exit 1**; **5 failed / 257 passed files, 6 failed / 3,133 passed tests**, duration **77.07 s**. Raw local log: `.spire/tmp/portfolio-dashboard-unit.log`.

One suite could not collect because its existing source scan assumes dashboard cwd; the final full run must use the canonical Nx target or dashboard cwd. The real failures were three AppShell keyboard cases whose API mock lacks the new demoClock helper, the focus-install source guard still expecting the moved call in main.tsx instead of mountApp.tsx, the amber-link guard's pinned export-callback marker, and the outcome ledger's no-API-import guard encountering the pure demoStorageKey resolver. Assigned repairs preserve keyboard/focus ordering, link color and no-network protections; no test is removed. This failed run is not a final verification result.

## F4 join and guard repairs

F4 completed shell provenance/visitor/reset/Retry, typed scanner subscription and non-flashing demo updates, read-only capability/sample holdings presentation, and the explicit authored-analysis action. The export drawer receives a demo-only optional fingerprint; F6 still supplies it from the selected ticker at the final route join.

The F4 builder corrected DTO reads to use nullable projections under market_state, and uses the returned effective expirations for the displayed bundle's basis. Its final canonical dashboard typecheck, Prettier and diff checks returned **exit 0**. Focused keyboard, amber-link and BrokerTabPanel suites returned **38/38, exit 0**. The separate F1/F2 owner repaired the actual startup-path and exact pure-storage-helper guards; **2 files / 37 tests, exit 0**. Neither repair removed the corresponding accessibility, color or network restriction.

After all provider changes, the conductor independently reran the full API suite from the API project cwd: **8 files / 58 tests, native exit 0, 938 ms**. This includes the JSON asset loader, clock lifecycle and exact fingerprint selection. F6 now owns the final production/browser integration; the final full dashboard run remains owed.
