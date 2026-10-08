# portfolio-demo-platform — implementation handoff

**Resume status:** ACTIVE
Date: 2026-10-07
Branch: `codex/portfolio-demo-platform`
Last verified HEAD: `1e5aa40e` (local shared provider/build foundation commit; not pushed)

## Goal and authorization

Owner invoked spire-tech and requested visual backend atlas, complete env-switchable synthetic portfolio demo, technical analysis/research, researched Nx production/test optimization, and deployment. Architecture delegated; keep working without routine approval questions. No other repo, paid subscription, production data or schema migration authorized. Railway's existing predeploy migrates Postgres, so do not deploy Railway or merge main. Use static feature Pages preview after independent QA.

## Verified completed

- Baseline source `8932fc1176543eff3fa826de6924e12ec52f3310`. Shared foundation implementation is complete; app integration is active. Preserve 462 unrelated pre-existing untracked files (Spire generations/upgrade effects + one docs/explainer).
- `docs/backend-atlas/` interactive atlas, source audits, design canvas, Nx research and baseline evidence committed in `53d000d1`; default LF attribute added, byte-exact/binary overrides retained. Browser inspected atlas and phone/light design canvas before product build. Docs server active at 127.0.0.1:4387 (exec session11247), no Rust server started.
- Uncached live frontend baseline build native exit0,10.39s wall,43Brotli bundle checks passed. Existing frontend test baseline native exit0,261files/3139tests,84.65s wall. Raw logs retained locally; compact evidence in docs.
- Council R1/R2/R3/R4 and independent S2 complete. Five conflicts folded; S2 repair1 resolved C1/I1/I2/I3. Current S2 PASS0Critical/0Important. `contract_lint` exit0,0errors,2existing context-size warnings.
- SPEC approved under owner-delegated implementation authority; INTERFACE NO_BACKEND_CHANGE. Rule18 demo provenance exception and ledger captured. These context/contracts edits and the plan are committed in `65ff54e7`.

## Active work / next

PLAN.md is complete (11 tasks, one frontend lane, no backend work); latest contract_lint exit0. S1–S5 completed by `build_shared_foundation`, receipt FOUNDATION_REPORT.md. Root independently reran full API facade Vitest after the retained contract-authority fix: exit0,8files55tests,758ms. Active `build_app_state` owns remaining F2/F3; F1 is frozen. Active `build_analysis_views` owns F5 under the planner's explicit disjoint-work amendment. Neither commits or deploys; do not spawn duplicates.

After F2/F3 completes, dispatch fresh F4 app shell/model worker; it may overlap the existing F5 worker if still active (at most two frontend workers). After F4/F5 join, dispatch generic scoped F6 sole closer for routes/e2e/evidence plus CI outside the stock frontend fence. Read PLAN Independence table for exact paths/dependencies. Follow independent QA before deployment. SPEC/INTERFACE are binding; no direct root edits to those files. Root stages only completed paths, excluding active app/view edits.

## Critical carry-forward

- Current workers: `build_app_state` F1 frozen (16 actual generated-bootstrap tests green), continuing F2/F3; `build_analysis_views` owns only new Technical analysis/Research directories (F5). Planner amended scheduling: F5 may overlap F2/F3 after frozen F1/shared runtime; at most two frontend workers; serialize shared-output builds. F3 owns narrowly added frame plumbing in PositionsPage.tsx, liveTapeStore.ts and TickerDashboard.tsx; F6 later owns ticker route/tab visuals sequentially. Do not spawn F4 until app-state worker completes.
- After app type build exposed new foundation test strict-null errors, foundation owner reproduced and repaired only catalog.spec.ts and transport.spec.ts. API project-reference `tsc --build --emitDeclarationOnly libs/api/tsconfig.json --pretty false` exit0; affected2files3tests green. No production shared code changed. Root captured original static startup dependency closure before replacing dist:12assets196143BrotliBytes(191.55KiB), details/hashes baseline-boot-closure.json; original index hash matches initial build log. This is an artifact graph, not observed browser transfer; final closure must include mountApp.
- PLAN F6 now also owns `.github/workflows/ci.yml`: preserve existing live/browser/backend gates, then run G5 tool checks, wrapper demo build and G1 with separate evidence. A draft PR is required to trigger existing CI; feature push alone only exercises hosting integrations. Plan amendment lint exit0,2 existing warnings.
- F1 must bypass live AuthContext book pull/push in demo: generated wire arrays must never hydrate the rich browser v3 object-map store. Foundation seeds full logical keys (convexa.demo.v1.convexa.positions.v3 etc). Shared public exports frozen per FOUNDATION_REPORT; app worker must report shared gaps rather than edit libs/api. Foundation fixed ticker fractional distances versus scanner percent/sign semantics, totals, selected-variant analysis, canonical book projection and source authority; API facade full55tests now green. These are unit/source checks, not built UI/hosted evidence.
- Early S1 source audit found wrong first-paint logical keys, theme-color parse ordering, invalid-env CLI bypass, an unhashed output override and stale no-map output; builder fixed these before foundation handoff. Latest builder G5 receipt is exit0,4tests; full provider receipt FOUNDATION_REPORT.md. Root independently reran full API Vitest after the last source fixes: exit0,8files55tests,758ms. Production app/cache matrix and independent QA are still pending.
- VITE_DATA_MODE=demo|live, defaultlive; invalid explicit mode fails. Pages branch wrapper selects demo before Nx hashing only for exact feature branch when CF_PAGES=1 unless explicit env set. Existing Pages Git preview success proven for prior branches, but actual current remote build command/filter inaccessible without Cloudflare login. GH CLI works escalated; no need to ask for login until real deploy attempt fails.
- Six symbols, fixed2026-10-07T18:30Z anchor, three expiries, seven coherent nonempty expiry variants per symbol, finite controller to19:00Z, every sample-only clock/order path follows contract. No fake genuine-live status, no real/paid fallback, no new Rust engine.
- Shared generated bootstrap drives classic first-paint theme and app mode/key resolver; minimal main awaits storage-only init before dynamic mount imports. All current/legacy/theme/outcome/export/book paths must isolate demo keys. Reset reloads; corrupt bytes preserved.
- Never publish existing captured owner broker fixtures: POS_CAPTURE_*, POS_CB_*, BOOK_CAPTURED_COMPLETE in broker/fixtures.ts are labeled real Webull-derived. Author new synthetic records. Never production-import auth/testBackend.ts (Vitest). Existing fixture data is shape material, not coherent public seed.
- New TA/Research local views, fourglobalnavlinks unchanged. Existing live capability unavailable honest. No PWA scope; only loaded/cached static views usable offline.
- At most six meaningful new test groups, brief cap8, target<30s frontendunit addition; use existing guards plus one-time evidence. No genericTDD skill.
- Hosted baseline conformance: anonymous GET session and scan returned HTTP200 with required shapes, nativeexit0,2PASS at2026-10-08T01:34:56Z. Receipt under docs/backend-atlas/evidence/backend-anonymous-baseline.json. No auth/signup/deploy; not evidence of paidfeed or newdemo. Cloudflare official routing supports demo output include:[/*],exclude:[/*] with exclude precedence; live routing retained. Complete initial boot closure includes new mountApp chunk for performance measurement.
- Windows PowerShell commands absolutepaths/loginfalse; npm Nx requires require_escalated for native platform dependency here. Do not reinstall dependencies for sandbox's misleading MissingPlatformDependency. No auto-review rejections so far.
- Browser CUA handles atlasPreview(tab2) and canvasPreview(tab3) in IAB; both marked deliverables for current turn. Reload CUA docs after context compaction before interactions. Cloudflare login tab in Chrome isn't authenticated and isn't a deliverable.

## Remaining outcome

Implement, typecheck/test/build both modes, compare measured production behavior, independent QA18AC, commit/push feature only, inspect Pages deployment/check outputs and hosted direct routes/noegress, attach any created PR using app tool, record exact shipped URL and limitations. Local evidence must never stand in for hosted evidence.
