# Portfolio demo — conductor checkpoint

**Resume status:** ACTIVE
**Date:** 2026-10-08
**Branch:** codex/portfolio-demo-platform
**Baseline:** 8932fc1176543eff3fa826de6924e12ec52f3310
**Verified HEAD:** 3c08d71978745962a1dadfeb8ea9038e96769438, pushed with draft PR https://github.com/ariasr47/convexa/pull/76 (attached). Uncommitted CSP startup repair and evidence now await local QA/redeployment.

Boot, discovery, council, skeptic and PLAN are complete. Do not reboot. Contracts contain 20 ACs, 14 frontend tasks and six retained test groups. NO_BACKEND_CHANGE. The request covers an interactive backend atlas, synthetic portfolio demo with TA/Research, env-switchable live mode, researched Nx production setup, economical tests and deployment.

## Current join

**Latest authoritative update:** Pages deployed source3c08d719 at https://bf7f65f4.convexa.pages.dev (branch alias https://codex-portfolio-demo-platfor.convexa.pages.dev), but hosted G6 found a blank app: existing `script-src 'self'` blocks the inline bootstrap. QA is19 PASS/1 FAIL (AC18), not a release PASS. The deployment success is not application success. Failure preserved in docs/backend-atlas/evidence/hosted-g6-failure-3c08d719.json. Root enabled existing CI and manual Linux candidate workflows (both were disabled_manually; repo Actions globally enabled). Both are now active; next push should trigger CI. Conformance/Deploy smoke remain disabled; no main/Railway changes.

Repair source is joined: Vite emits the unchanged841-character mode/key/theme bootstrap as content-hashed external classic JS and injects a blocking src-only head tag; firstPaintTheme16existingtests0, scopedlint0. serve-dist now sends artifact global CSP; one-off16HTTPchecks0, no retainedcase added. Independent QA proved old artifact now fails locally with exact same CSP/missing-bootstrap error. New immutable snapshot `.spire/tmp/portfolio-qa-demo-csp-dist` has199files,indexSHA256 `18DF9B810222DEDDE55B3ED00436E270A82DCE34B94FD0103652C769BBA7D320`, external `assets/convexa-bootstrap-aafa561a8b237e2a.js`. QA independently passed first-paint isolation (demo light versus live dark before module) and full G1 on these bytes under CSP:1/1native0,46.7s,zeroegress. Receipt docs/backend-atlas/evidence/qa-csp-parity.json. No builder active; finaldistDEMO.

Latest matrix supersedes older numbers below: native0 DEMO miss8.1052879s/hash5456579965763133353 →same hit4.7503575s →LIVE miss7.6202695s/hash4748686420162933255 →DEMO restore4.8517883s. Byte-identical restoration;199publicfiles/47privatefiles,48JS,55bundlechecks0. Typecheck0/9.5s. Fullboot223992B incl370B externalbootstrap; TA2457B/Research1734B. PLAN updated within existing tasks; implementation amendment recorded. final_evidence_docs updating6docs to current failure/repair; QA ownsQA_REPORT. Root must join local pass, exact-path commit CSP repair/evidence, push, get new PagesURL+CI exactSHA, hostedQA then Linuxvisual evidence. CI observer agent can be re-triggered with newSHA after push. Linux sourceS for authorization will be this NEW commit, not3c08d719. All future scopes retain true sources.

All app source is joined. Fresh QA independently passed API 8 files/59 tests, dashboard 262 files/3150 tests, two safe anonymous live conformance reads and atlas observations. Initial AC14 contrast/headings defects are fixed. On the final frozen artifact QA observed 16/16 settled new-route state/scheme axe cases with zero violations and one H1 each, and G1 1/1 native0 in52.0s with zero forbidden egress. QA_REPORT is19 PASS /0 FAIL /1 UNVERIFIABLE, solely hosted AC18; no bounce remains. Proceed with the static feature preview for that final observation.

Latest production matrix after all accessibility fixes: DEMO normal miss7.9866264s (hash102652253033440566), DEMO hit5.0205449s, LIVE normal miss7.3364123s (hash12233153773887572285), DEMO restore hit5.3877042s. All native0; public demo bytes identical after restore;196 public files;46 private maps plus manifest. Final typecheck native0/11.8s;54 bundle checks native0. Complete boot223622 Brotli bytes versus196143B baseline; TA increment2457B and Research1734B. These are normal cache-enabled misses, not forced builds. NX_SKIP_NX_CACHE skips cache writes too.

Final immutable DEMO snapshot: `.spire/tmp/portfolio-qa-demo-contrast-dist`, indexSHA256 `56472E23E599BC899814F60E137813B1924BDFF1CDE369DB53C7A71392E74FD1`,196files. QA owns a new server for exact bytes; old4388/4389 snapshots are preserved. Atlas4387 was observed healthy. No builder active; apps/dashboard/dist is final DEMO. Do not run shared-output typecheck/build concurrently with browser evidence.

Windows LIVE candidate `68f647210293cad6724475d0a75932f4` at source4c4fb35814a79de16f0d069f34a4f4d7b7797cd5 was independently reviewed and accepted. Six actual/expected images, two diffs, review, acceptance, and two6/6 zero-flaky compare runs are on disk; validated stability receipt under `apps/dashboard-e2e/visual-review/evidence/win32-portfolio-demo-4c4fb35-20261008/stability.json`. This does not approve later source or Linux pixels. Final live accessibility35/35 retains seven existing moderate findings (five tickerH1, two Positions heading-order); no waiver or zero-findings claim.

One automatic approval review rejected QA's independent G5 repeat because it could change build artifacts. Do not retry around it. Earlier G5 4/4 native0 remains genuine; retain independent-repeat limitation and explain it briefly in final. All other independent work continued.

## Linux source-bound review path

Commit new `tools/restore-visual-authorization.mjs` and workflow into source S BEFORE first Linux failed compare. Later receipt/evidence commit A must preserve authorization.source_revision=S. Dispatch workflow at branch A with input source_revision=S, authorization_path=that receipt. Checkout is S; helper restores ONLY auth/hash-bound evidence from dispatch github.sha=A; HEAD/app code stay S. Existing strict scope validator remains unchanged. One-off independent synthetic Git fixture passed (driver0):19 exact files restored, HEAD/tracked diff unchanged, unrelated A code excluded; four rejection cases each1/zero writes. Compact receipt: docs/backend-atlas/evidence/linux-authorization-restore.json. No Linux browser execution yet.

After first real failed Linux CI compare, download browser-quality-visual into original repo-relative output paths so raw summary image references resolve. Run `.spire/tmp/prepare-visual-authorization.mjs linux <summary>` while HEAD is exact S. Preserve raw summary/hashes. Commit only new authorization/evidence as A, push, dispatch workflow with S. Download Linux candidates and two comparison summaries. Independently review six PNGs/source diff, write/validate acceptance, validate two stable runs by sorted scenario IDs while retaining raw summaries unchanged. Never substitute Windows PNGs or fake source SHA.

## Next sequence

1. Join QA local recheck. final_evidence_docs owns six atlas/report updates to latest receipts; QA owns QA_REPORT/conformance receipt; root owns manifest/resume/deploy. Contract lint0 with two existing context-size warnings. Protected backend/quant/generated/Cargo/railway paths unchanged against baseline.
2. Exact-path commit final source/docs/Windows acceptance/evidence/helper. Preserve462 unrelated untracked generation/upgrade/explainer files. Push only feature branch; create draft PR using prepared `.spire/tmp/portfolio-demo-pr-body.md`, attach via app tool. No existing PR at last read.
3. Observe exact-head CI and Pages check URL. Linux visual review as above if needed. Run hosted G6/direct routes/reloads/zero forbidden egress; existing QA independently finalizes AC18. Do not claim CI green if existing supply-chain policy still fails.
4. Final URLs/metrics/QA docs and Spire closure only after required evidence. Never merge main or deploy Railway: its predeploy migration needs separate chat authorization.

## Runtime constraints

PowerShell loginfalse and absolute paths. Nx/Vite/Playwright and Git writes require escalation on this Windows host; NX_DAEMON=false NX_NO_CLOUD=true. Do not reinstall for sandbox EPERM. Demo uses static API prebootstrap, six canonical JSON assets with cache/retry, bounded serialized scenario18:30→19:00UTC, isolated convexa.demo.v1 storage, no paid fallback or provider credentials. Backend/quant/generated-wire code is unchanged; source audit and correction history remain in APP_BUILD_REPORT and IMPLEMENTATION_AMENDMENTS.
