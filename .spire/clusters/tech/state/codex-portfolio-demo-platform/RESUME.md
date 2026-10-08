# Portfolio demo — conductor checkpoint

**Resume status:** ACTIVE
**Date:** 2026-10-08
**Branch:** codex/portfolio-demo-platform
**Baseline:** 8932fc1176543eff3fa826de6924e12ec52f3310
**Verified HEAD before final checkpoint:** b45c5f56d6a689009bdedae085f4fbc0d1a77ff4 plus task changes; not pushed.

Boot, discovery, council, skeptic and PLAN are complete. Do not reboot. Contracts contain 20 ACs, 14 frontend tasks and six retained test groups. NO_BACKEND_CHANGE. The request covers an interactive backend atlas, comprehensive synthetic portfolio demo with TA/Research, env-switchable live mode, researched Nx production setup, economical tests and deployment.

## Current state

All implementation is joined. F6 final production DEMO build and G1 passed natively (one journey, zero unexpected/flaky, 54.159s). The one-time MSFT Research disclosure probe passed and verified 60 unique source IDs. Root inspected corrected Overview and MSFT pixels. That probe replaced the main G1 results.json; the closer receipt identifies it honestly. Fresh QA independently reruns the main journey.

Final LIVE build and accessibility passed natively: 35/35, including 28 axe scans and seven behavior checks. Seven unwaived moderate findings remain (five missing-H1 reports on ticker, two heading-order reports on Positions). They are retained in live-accessibility-final.json. Previous Chromium128/128 and compatibility15/15 passed. No visual baseline refresh has been accepted yet.

Independent spire-tech-qa agent independent_portfolio_qa is active. It uses the frozen production snapshot at .spire/tmp/portfolio-qa-demo-dist via localhost:4388. Root's first server process did not remain reachable, so QA owns restarting/proving that server. Snapshot has196files and indexSHA6012A42D8CFA0D7BBE7CE7E2D8EAEA93B967CA1EB7EA0BD65603C7434F4590F8. QA independently passed both anonymous live conformance pins. Its full20AC runtime/source/unit review and final report are pending. Hosted AC18 is NOT RUN until exact preview exists. Atlas server4387 may need liveness recheck; do not stop a healthy atlas server.

Canonical joined dashboard units passed262files3150tests, native0. API8files59tests native0. Final value repair extended the existing42-case matrix and passed; display/freshness repair passed47existingtests. Root final typecheck including generated API contract native0/10.8s; full formatnative0; full lintthreeprojects native0 with warnings. All protected backend/quant/generated/Cargo/railway.json paths remain unchanged against baseline.

## Final production evidence

Four sequential builds completed with native0: forced-fresh DEMO8.394s → cache5.596s → forced-fresh LIVE7.968s → DEMO cache restore5.589s. Forced builds use NX_SKIP_NX_CACHE=true; do not call them naturally cold. Nx task hashes: demo18087900803837621755, live3739905099639827135. Public demo digest2aa3d8a20b4d9550ec348005c19ea2ff1f1bdabd08f379643187819f488ac2e6 restored byte-for-byte; private maps restored; six seed assets identical across modes; no public maps/declarations/buildinfo. Invalid mode returns2 beforeNx; forbidden public fixture/map scan returns1(no match).

Complete demo boot graph is223650Brotli bytes (218.408KiB) versus196143B baseline (191.546KiB); TA increment2411B and Research1675B. This is static dependency-graph measurement, not browser transfer. Existing bundle caps pass54checks across47JS assets. Metrics/evidence are docs/backend-atlas/evidence/demo-{build-matrix,boot-closure}.json. Current apps/dashboard/dist is DEMO after matrix; root owns it now.

## Next sequence

1. atlas_final_local_evidence updates four atlas docs to current local evidence. Commit only exact task paths after source/evidence join; preserve462 unrelated untracked generation/upgrade/explainer files.
2. Root true-production LIVE build and visual compare. Source-bound Windows candidate authorization, independent image/source review, acceptance and two clean comparisons. No thresholds/masks/waivers. Authorized agent reviewers must use honest delegated identities, never impersonate Rodrigo.
3. Local independent QA findings may require bounded repair; no overallPASS until required evidence. After local review, push only feature branch and create draftPR for CI; attach via app tool. No existing PR was found on this branch.
4. Existing Linux candidate workflow now safely builds live production first, fetches source history, runs authorized candidate update, then two compare-only zero-retry runs with separate evidence. It writes no acceptance. Use after real Linux failed-compare evidence/authorization; Windows PNGs cannot substitute. Workflow source change and PLAN ownership are complete, syntax/format checked, not remotely executed yet.
5. Observe exact-head Pages preview and CI. Run hosted G6/direct routes/reloads/zero forbidden egress, then ask existing QA role to finalize hosted AC18. No main merge or Railway: predeploy migrates production and user has not authorized migrations.
6. Final docs/atlas metrics, URLs, exact release limitations, and Spire closure after QA PASS.

## Safety and runtime constraints

PowerShell loginfalse and absolute paths. Nx/Vite/Playwright require escalated native helper access on this Windows host; NX_DAEMON=false NX_NO_CLOUD=true. Do not reinstall dependencies for sandbox EPERM. No auto-review rejections. Keep build/typecheck exclusive: typecheck emits declarations into appdist. QA snapshot avoids collisions.

Demo uses static public API prebootstrap before dynamic mountApp, six same-host JSON seed assets with successful/inflight cache and failed-request eviction, one bounded serialized scenario controller18:30→19:00UTC with no catchup and eligibility rechecks after await. All storage/legacy/theme keys isolate under convexa.demo.v1; preserve bad bytes and explicit empty state. No paid fallback, credentials, broker execution, false live=true, Rust or generated-wire edits. Six symbols×seven selections; position_eval=null is the sole locked normal unavailable widget. Source audits and all prior failure/repair history remain in APP_BUILD_REPORT.md and IMPLEMENTATION_AMENDMENTS.md.
