# Portfolio demo — conductor checkpoint

**Resume status:** ACTIVE — activation repair locally verified; fresh Linux CI and hosted QA owed
**Date:** 2026-10-08
**Branch:** codex/portfolio-demo-platform
**Baseline:** 8932fc1176543eff3fa826de6924e12ec52f3310
**Published source:** 2211d829e9315077ca26fedd5a6441580be08c1c. The new repair is its follow-up; re-read Git for the current commit.
**Draft PR:** https://github.com/ariasr47/convexa/pull/76 (attached, unmerged)

Boot, discovery, council, S2 and PLAN are complete. Do not reboot. Contract: 20 ACs, 14 tasks, six retained groups, NO_BACKEND_CHANGE. User authorized the visual atlas, synthetic portfolio demo, TA/Research, env-selected live mode, Nx production optimization, economical verification and a static Pages preview. No main merge/Railway deployment: its predeploy migration needs separate chat authority.

## Current candidate

The shared help control now distinguishes completed activation from hover. Hover listeners are suspended while explicitly activated, and a queued mouseleave cannot dismiss that activation. Genuine Escape, blur and existing touch-end dismissal restore ordinary hover behavior. A native tap → hover → pointer-exit sequence reproduced the defect before the repair and passed afterward. The original Linux event identity remains unproven; do not claim that the queued-close guard restores a touch timer already replaced before activation committed. Receipt: `docs/backend-atlas/evidence/chromium-activation-followup.json`.

Builder AC35/U32 passed 8/8 across 44 site/width pairs, no retries, native exit 0 (59.4 s). Natural touch dismissal measured 1512.2 ms; touch-away, Escape, blur, keyboard and hover restoration passed. Full dashboard/e2e typechecks and source formatting passed. Root added two real touch help sites to the existing G1 demo journey, using a separate hasTouch context, the resolved HTTPS policy and blocked egress. No new retained test group.

**Final frozen DEMO:** `.spire/tmp/portfolio-qa-demo-activation-dist`, 199 files; index SHA256 `7DE6CC4E392D1D8D34BDC9BB8560E495D34FFD586F82D9DDB271A4D126078506`. Current `apps/dashboard/dist` matches all 199 files. Independent QA confirmed that match, passed expanded G1 1/1 in 55.2 s with exact CSP/local HTTPS and zero forbidden egress, passed all eight focused native AC35/U32 cases with zero retries, and separately observed mixed touch/Escape/Tab/blur plus desktop hover. Filtered eight-case reporter output is incomplete versus the 128-case inventory; it is not a full Chromium gate.

**Current GATE Q remains FAIL: 19 PASS / 1 FAIL.** AC14 is reopened on published source2211 Linux counterevidence until the repaired source passes fresh Linux verification. Successful local/hosted observations are retained with their scope. `qa_browser_followup` owns QA_REPORT.md and qa-browser-followup.json.

Final matrix: demo normal miss 24.1205477 s, hash103667181284566249; demo hit 5.9061708 s; LIVE cache hit 6.2104163 s, hash10649328654748830058; demo restore hit 6.2488567 s. All native exit0; restored public/private digests match. Initial build overlapped format check, so this is not an isolated benchmark (Nx target reported6.8 s). 199 public files, 46 private maps plus manifest, 48 JS, six seed assets; 55 bundle checks passed. Complete boot224030B Brotli; TA2457B; Research1732B. Latest receipts are demo-build-matrix.json and demo-boot-closure.json; old raw matrix records remain preserved under their original prefixes.

## Published preview and completed CI

https://a17bba43.convexa.pages.dev is exact source2211. Hosted G6 passed six direct routes plus six hard refreshes: HTTP200, demo/scenario provenance, exact CSP, strict TLS, zero forbidden requests or page/console errors. This does not approve the newer repair. Older source219d preview https://0c9f45c7.convexa.pages.dev and its receipts retain historical scope. Branch alias: https://codex-portfolio-demo-platfor.convexa.pages.dev.

CI https://github.com/ariasr47/convexa/actions/runs/37737797873 completed FAILURE at source2211. Backend (including Cargo release build), capacity, frontend lint/typecheck/units/build/bundle passed. Compatibility15/15, accessibility35/35 executions, visual6/6 passed. Chromium120/128 passed, eight failed, zero flaky: every AC35/U32 width, initial and retry. Intended help text opens then immediately exits; missing hasTouch, stale bundle and initial-only readiness were ruled out. G5/demo build/G1 skipped. Portable receipt: `docs/backend-atlas/evidence/ci-run-2211d829.json`; raw artifacts and first/retry traces: `.spire/tmp/ci-observation-2211d829/`.

Linux visual reference acceptance44894ccd5fa8e8e986c66bd3e6c4841d remains pinned to source219d. All six expected/actual CI2211 images matched those accepted hashes. Do not relabel the acceptance source. Earlier Windows acceptance remains bound to4c4fb358. Preserve hash-bound source patches exactly, including context whitespace.

## Secret-scan and policy boundary

CI2211 policy failed on26 npm, one Cargo and three repository-secret matches. Dependency failing check records/counts match the previous baseline, but empty findings arrays prevent advisory-ID identity claims. Policy report revisionbddb6c20 is a PR merge SHA, separate from source2211.

All three new secret matches were proven false positives: the deliberately public localhost test key and two reproducible report run_key hashes. `.gitleaksignore` acknowledges exactly their historical2211 commit/path/rule/line fingerprints. Pinned Gitleaks8.30.1 bounded scan now returns native0 with zero findings; omitting each acknowledgment or changing its path/commit restores one finding/native1. Original key/cert/reports unchanged; no rule or path disabled. Receipt: `docs/backend-atlas/evidence/secret-scan-followup.json`. Native binary: `.spire/tmp/gitleaks-8.30.1-diagnostic/bin/gitleaks.exe`. Scan the new committed history before pushing to catch any new metadata false positives. Fresh Linux publication proof still owed; never rewrite the failed CI receipt as pass.

## Next sequence

1. Wait for QA/docs owners to report their files stable. Source repair and root G1 edit are done; root owns final dist. No more builds while QA observes it. Full format check passed; protected backend/quant/generated/Cargo/Railway diff remains empty; contract lint passed with two existing context-size warnings.
2. Stage the exact24 task paths (20 modified plus .gitleaksignore and three new evidence JSONs); preserve462 unrelated untracked generation/upgrade/explainer files. Review staged diff, commit, run pinned redacted history scan with the new HEAD, then push only this feature branch.
3. Reuse ci_preview_observer for fresh CI and exact immutable Pages URL. Send new SHA/URL to qa_browser_followup for hosted G6. Require Linux Chromium and expanded demo G1 evidence before restoring AC14. Do not turn local passes into a Linux pass.
4. Update final docs/PR body/manifest/RESUME with actual outcomes. Do not push another docs-only commit while a full run is active (it cancels the run). Remaining baseline policy failures may keep VERIFY and the draft PR open; do not claim all CI green or complete Spire delivery. CLOSURE scan has eight pending flags; ledger has no graduates; no IN_FLIGHT row existed. Memory contains an active §7bb and three watch keys, without canon promotions or archive moves.

## Guardrails and retained context

PowerShell loginfalse, absolute paths, NX_DAEMON=false NX_NO_CLOUD=true. Nx/Vite/Playwright/Git writes need native escalation; no reinstall for sandbox EPERM. gh: C:/Users/rodri/tools/gh/bin/gh.exe. Atlas http://127.0.0.1:4387 was HTTP200; verify before final and show the atlas/demo in the app.

The earlier automatic approval review rejected QA's independent G5 repeat because it could change build artifacts. Do not retry, repackage or reroute that repeat. Original root G5 4/4 remains valid; normal existing CI G5 is distinct. Final answer must state this rejected-repeat limitation in a short separate paragraph. No routine permission questions, stash, broad staging, other-repo work or production migrations.

The product has six symbols ×seven expiry selections, lazy authored seeds, isolated convexa.demo.v1 storage, bounded October7 sample playback, exact variant/export fingerprints, all normal supporting widgets, the explicit position_eval unavailable exception, 60-bar TA and six Research cases. Earlier dashboard3150/API59 tests and16 clean new-route axe views remain source-scoped; live accessibility has seven moderate findings. Trace diagrams are source-derived, not production spans. Do not reboot or redesign settled scope.
