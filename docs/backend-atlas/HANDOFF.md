# Portfolio demo — Mac / Claude Code handoff

**Owner stopped this session for a machine change on October 8, 2026. Resume at VERIFY.**
The implementation is built and publicly deployed. Do not repeat discovery, council, design or planning.

## Start here

1. Fetch and check out `codex/portfolio-demo-platform` from `https://github.com/ariasr47/convexa.git`. Preserve any work already present on the Mac.
2. Read this file, `.spire/clusters/tech/state/codex-portfolio-demo-platform/RESUME.md`, and `.spire/clusters/tech/contracts/portfolio-demo-platform/_MANIFEST.md`. Use the repository's Claude Code conductor/resume instructions; the existing SPEC and INTERFACE_CONTRACT remain locked.
3. Inspect [CI run 37750021768](https://github.com/ariasr47/convexa/actions/runs/37750021768) before running more tests or changing code. Its tested revision is `aac3ced7f6484ce05fd975eca3f0f8932f8a56fb`. The later handoff commit changes documentation/evidence only and uses `[skip ci]` to avoid another full run.

**Draft PR:** [#76](https://github.com/ariasr47/convexa/pull/76), attached, unmerged.
**Verified public demo:** [771ed561.convexa.pages.dev](https://771ed561.convexa.pages.dev), exact deployment `771ed561-9c63-4073-a113-8225e57735bf`, source `aac3ced7`.
**Atlas:** `docs/backend-atlas/index.html`; run `node docs/backend-atlas/serve.mjs` and open `http://127.0.0.1:4387/`.

## What is implemented

- Interactive, source-linked backend atlas: system architecture, request traces, data/widget ownership, user journeys, stack/operations, and demo/live/paused-backend comparison. Diagrams are source-derived, not production tracing spans.
- Browser-local synthetic providers for six symbols and seven expiry selections, seeded scanner and normal supporting widgets, isolated paper portfolio/orders/preferences/reset, and bounded sample playback. No paid API, broker, OAuth or AI calls in the tested demo journeys.
- Ticker Technical analysis with 60 authored daily bars and six distinct authored Research cases. These new capabilities are demo-only for now; live mode reports them unavailable. Sample position evaluation is also explicitly unavailable.
- Build-time `VITE_DATA_MODE=demo|live`, with validation before Nx, separate cache identities, lazy assets/views, compressed assets, private source maps and unchanged bundle caps. Rebuild/redeploy to change modes. `MARKET_DATA_MODE=paused` is a separate backend setting.
- Production measurements and official Nx/Vite research are in `docs/backend-atlas/nx-production-research.md` and `docs/backend-atlas/evidence/`.

## Verification at the stop

The final read at **2026-10-08 08:42:59 UTC / 01:42:59 PDT** showed CI 37750021768 still running: frontend in Vitest; backend in its capacity load harness; capacity job passed. Supply-chain policy failed only its baseline-equivalent npm 26 / Cargo 1 checks; repository secrets passed with zero findings. The policy report's merge SHA is `486909cb29a995ec79ff70e4b94cf277e2340f92`, distinct from the tested head. Matching failed check records do not establish identical advisory IDs.

Independent hosted QA of the current preview passed six direct routes plus six hard refreshes: 12/12 HTTP 200, demo/October 7 provenance, exact production CSP, normal TLS, zero forbidden egress and zero page/console errors. See `evidence/qa-browser-followup.json`. No served-byte equality between deployments is claimed.

**GATE Q remains 19 PASS / 1 FAIL, pending clean Linux browser verification. Do not label CI or delivery green.** The final test correction passed locally:

- AC35/U32: 8/8, zero retries/flakes, 57.2 seconds, against the frozen LIVE artifact.
- G1 demo journey: 1/1, exit 0, 53.2 seconds test / 55.9 seconds total, against the frozen DEMO artifact.
- Full E2E TypeScript, formatting of both edited tests, and whitespace checks: exit 0.

The last complete CI on prior source `cc4df79c` had backend/capacity PASS; Chromium 127 passed / 0 failed / 1 flaky; compatibility 15/15, accessibility execution 35/35, visual 6/6 PASS. G5/demo build/G1 were skipped after the flaky gate. Accessibility execution PASS does not mean zero findings: seven existing moderate findings remain. That CI and its infrastructure retry are retained in `evidence/ci-run-cc4df79c.json`.

## Why the last change exists

The shared help activation repair is already deployed. The remaining first-attempt Linux flake was in the added test: `locator.hover()` waited **2075ms** for layout stability, longer than the component's intentional **1500ms** natural touch dismissal. The later assertion inspected natural expiry. The original failure and passing retry remain recorded.

Commit `aac3ced7` changes only two Playwright helpers plus docs/evidence. It uses trusted mouse movement at the rendered trigger coordinates, asserts that the pointer actually reaches the trigger, then exits and retains the tooltip assertions. No app timeout, application source, backend, dependency, build configuration or assertion was relaxed. See `evidence/pointer-test-timing-followup.json`. Do not treat a retry pass as a clean gate or arbitrarily increase timeouts.

## Remaining work

1. Read the current run's completed frontend steps and download its source-bound browser artifacts. Require full Chromium with zero failed/flaky outcomes and actual G5, demo-build and G1 results. If something fails, inspect the first-attempt trace before changing code.
2. Have independent QA adjudicate AC14 from the fresh evidence. Update QA_REPORT only when justified; keep earlier failures and source scopes intact.
3. Update the atlas's current status, README/build report, checkpoint and PR description. The last GitHub PR body may lag the newer receipts; a prepared draft existed only in Windows ignored scratch, so reconstruct it from tracked current evidence.
4. Pin `docs/backend-atlas/atlas.js`'s mutable `demoBase` source link to the final verified implementation SHA and update README provenance. Its original live/backend links stay pinned to `8932fc1176543eff3fa826de6924e12ec52f3310`.
5. Keep the draft PR and VERIFY state while release gates remain unresolved. Do not silently expand this feature into 27 dependency-policy remediations or waive them. No main merge/Railway deployment: Railway's predeploy runs a production migration, which requires Rodrigo's explicit chat authorization.

## Mac setup and portability

- Use Node **26.7.0** from `.nvmrc` and the existing lockfile; `npm ci`. Do not upgrade dependencies just to change machines.
- Windows `node_modules`, `.nx` cache, `apps/dashboard/dist` and `.spire/tmp` scratch are not in Git. Rebuild locally if needed; recorded Windows artifacts are evidence, not files expected to exist on the Mac.
- Demo build: `VITE_DATA_MODE=demo NX_DAEMON=false NX_NO_CLOUD=true npm run build:dashboard`. Atlas viewing needs only Node.
- Existing CI runs `npm run browser:quality` for LIVE, then the normal G5 guard, then a DEMO production build and `npx playwright test --config apps/dashboard-e2e/playwright.demo.config.ts`. Consult the checked-in workflow/config for exact environment and local HTTPS settings. Hosted checks must keep normal TLS validation.
- Retrieve missing raw traces from the linked GitHub Actions run artifacts; tracked receipts retain artifact IDs and hashes. For the last flaky run, use run **37743441304**, artifact **browser-quality-chromium**, attachment **14-2-trace.zip**. It contains the failed execution trace; no separate passing-retry trace was emitted.
- Linux visual reference acceptance `44894ccd5fa8e8e986c66bd3e6c4841d` remains bound to source `219d73a67b6f7a284172afaa3fc24b1b850e3319`. Do not replace or relabel it with Mac screenshots.
- Earlier automatic approval review rejected QA's independent local repeat of G5 because it could modify build artifacts. Do not reroute that rejected duplicate; the original local 4/4 result remains recorded and the existing normal CI G5 is a separate authorized check.
- Preserve unrelated work. This Windows checkout has unrelated untracked generation/upgrade/explainer files that were deliberately not staged. No stash, blanket add, main merge or cleanup of those files was performed.

This is a handoff checkpoint, not a completed Spire delivery. No automated follow-up was scheduled and no background agent should continue this session.
