# portfolio-demo-platform — implementation handoff

**Resume status:** ACTIVE
Date: 2026-10-07
Branch: `codex/portfolio-demo-platform`
Last verified HEAD: `53d000d1` (local atlas/docs commit; not pushed)

## Goal and authorization

Owner invoked spire-tech and requested visual backend atlas, complete env-switchable synthetic portfolio demo, technical analysis/research, researched Nx production/test optimization, and deployment. Architecture delegated; keep working without routine approval questions. No other repo, paid subscription, production data or schema migration authorized. Railway's existing predeploy migrates Postgres, so do not deploy Railway or merge main. Use static feature Pages preview after independent QA.

## Verified completed

- Baseline source `8932fc1176543eff3fa826de6924e12ec52f3310`. Application source remains unmodified at this handoff. Preserve 462 unrelated pre-existing untracked files (Spire generations/upgrade effects + one docs/explainer).
- `docs/backend-atlas/` interactive atlas, source audits, design canvas, Nx research and baseline evidence committed in `53d000d1`; default LF attribute added, byte-exact/binary overrides retained. Browser inspected atlas and phone/light design canvas before product build. Docs server active at 127.0.0.1:4387 (exec session11247), no Rust server started.
- Uncached live frontend baseline build native exit0,10.39s wall,43Brotli bundle checks passed. Existing frontend test baseline native exit0,261files/3139tests,84.65s wall. Raw logs retained locally; compact evidence in docs.
- Council R1/R2/R3/R4 and independent S2 complete. Five conflicts folded; S2 repair1 resolved C1/I1/I2/I3. Current S2 PASS0Critical/0Important. `contract_lint` exit0,0errors,2existing context-size warnings.
- SPEC approved under owner-delegated implementation authority; INTERFACE NO_BACKEND_CHANGE. Rule18 demo provenance exception and ledger captured. Those context/contracts edits are not yet committed.

## Active work / next

PLAN.md is complete (11 tasks, one frontend lane, no backend work); contract_lint exit0. Active generic execute-tier `build_shared_foundation` agent owns S1–S5 exact paths and FOUNDATION_REPORT.md, with no commits/deploy. Do not spawn a duplicate. After that join: scoped stock frontend F1–F3 sequential app/store/order integration, then disjoint F4/F5 app shell/model and new TA/Research views (at most two concurrent frontend workers), then generic scoped F6 sole closer for route integration/e2e/evidence outside the stock frontend fence. Read PLAN Independence table for exact paths/dependencies. Stock backend role cannot write libs/api; shared foundation is frontend work assigned Independent:no under PLAN_METHOD. Follow independent QA before deployment. SPEC/INTERFACE are binding; no direct root edits to those files. Root currently stages only complete design/plan/evidence bookkeeping; foundation source files are excluded.

## Critical carry-forward

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
