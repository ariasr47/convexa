# Portfolio demo — local evidence

## Current joined checkpoint

Updated 2026-10-08 UTC. These are local source/artifact receipts; Linux/remote CI and hosted Pages verification remain pending at this checkpoint. The historical foundation results below are preserved with their original scope and are superseded where the joined receipts provide later evidence.

| Check | Observed result | Scope |
|---|---|---|
| Joined unit suites | Dashboard 262 files / 3,150 tests; API 8 files / 59 tests; native exit 0 | Totals independently confirmed by QA; [joined checks](joined-local-checks.json) |
| Typecheck and generated API contract | Native exit 0; subsequent source typecheck also native exit 0 | Local source checks |
| Lint and format | Native exit 0; lint across three projects with advisory warnings | [Joined checks](joined-local-checks.json) |
| Production mode/cache matrix | Demo miss 7.9866264 s; demo hit 5.0205449 s; live miss 7.3364123 s; demo restore hit 5.3877042 s; all native exit 0 | [Matrix](demo-build-matrix.json); normal cache-enabled misses after source edits, no global cache clearing and no `NX_SKIP_NX_CACHE` |
| Artifact identity | Demo hash `102652253033440566`; live hash `12233153773887572285`; demo public/private digests match after restore | 196 public files; 46 private maps plus manifest; six canonical seeds in each mode |
| Final QA artifact | `index.html` SHA-256 `56472E23E599BC899814F60E137813B1924BDFF1CDE369DB53C7A71392E74FD1` | Rebuilt 196-file demo artifact; independent local QA complete; hosted AC18 remains unverified |
| Bundle and static graph | 54 bundle checks passed; boot 223,622 B Brotli q11; Technical analysis adds 2,457 B; Research adds 1,734 B | [Boot closure](demo-boot-closure.json); static graph, not observed transfer; includes the contrast and heading repairs; independent local QA complete; hosted AC18 remains unverified |
| Earlier G1 production journey | 1/1, native exit 0, 54.159 s, zero egress | Earlier recorded demo artifact; separate MSFT probe passed with 60 distinct source IDs |
| Independent final G1 | 1/1, native exit 0, 52.0 s, zero egress | Final rebuilt artifact identified by the `index.html` SHA-256 above |
| Independent new-route accessibility | 16/16 settled scans; zero axe violations; one H1 each | Technical analysis/Research × ready/unsupported/cold-error/held-loading × dark/light |
| Live browser suites | Chromium 128/128; compatibility 15/15; accessibility 35/35, native exit 0 | Accessibility retains seven existing unwaived moderate findings: five ticker H1 and two Positions heading-order findings |
| Windows LIVE visual references | Six accepted at source `4c4fb35814a79de16f0d069f34a4f4d7b7797cd5`; two compare-only runs each 6/6, native exit 0 | [Acceptance](../../../apps/dashboard-e2e/visual-review/acceptances/68f647210293cad6724475d0a75932f4.json) / [stability](../../../apps/dashboard-e2e/visual-review/evidence/win32-portfolio-demo-4c4fb35-20261008/stability.json); no acceptance of later source, DEMO, Linux or overall release |
| G5 wrapper guard | Earlier 4/4, native exit 0 | Independent repeat was rejected by automatic approval review because it could change build artifacts; no repeat pass is claimed |

Independent QA initially reported 18 PASS / 1 FAIL / 1 UNVERIFIABLE across 20 criteria. The Reset Demo contrast and Technical analysis/Research heading repairs passed independent retesting. Settled light-theme scans then found additional low-contrast route links, Refresh sample buttons and the Technical analysis EMA20 legend (3.01:1 or 3.26:1); textAmber now styles those controls and legend, and ready/loading/error branches have H1 headings. Independent final QA now records 19 PASS / 0 FAIL / 1 UNVERIFIABLE, with hosted AC18 the sole unverified criterion. G1 passed 1/1 with native exit 0 in 52.0 s on the final artifact. All 16 settled Technical analysis/Research scans across ready, unsupported, cold-error and held-loading states in dark/light passed with zero axe violations and one H1 each. Prior dark-theme scans found zero findings. The [QA report](../../../.spire/clusters/tech/contracts/portfolio-demo-platform/QA_REPORT.md) owns the independent verdict. Hosted behavior remains unverified; no overall PASS or release is claimed.

The F6 Linux visual workflow now uses `tools/restore-visual-authorization.mjs` to restore only the authorization and hash-bound evidence from later dispatch revision A while retaining the exact failed source S for the build. It verifies source/platform and evidence hashes before writing. Independent one-time helper verification passed: native exit 0, 19 evidence files restored with HEAD and tracked diff unchanged, and four negative cases each exited 1 with zero writes; this source change is not a remote CI or Linux visual pass.

The helper verification receipt is [linux-authorization-restore.json](linux-authorization-restore.json). It used a synthetic Git fixture whose source S already contained the helper; it did not run Linux browsers or remote CI.

## Historical foundation checkpoint — superseded scope

Date: 2026-10-07 America/Los_Angeles. Scope: shared frontend provider/build foundation S1–S4 only. Dashboard composition is not yet joined. This is local source and unit evidence, not a built-app, CI, hosted or production receipt.

### Foundation measured checks

| Check | Command | Native result |
|---|---|---|
| G5 wrapper, route receipt and resolved Nx identity | `node tools/build-dashboard.spec.mjs` with `NX_DAEMON=false` and `NX_NO_CLOUD=true` | **Exit 0; 4 passed, 0 failed; 2.19 s** |
| S3/S4 focused follow-up | `npm exec --no -- vitest run --config C:/Dev/convexa/libs/api/vite.config.mts C:/Dev/convexa/libs/api/src/lib/demo/transport.spec.ts C:/Dev/convexa/libs/api/src/lib/demo/workspace.spec.ts --reporter=dot` | **Exit 0; 2 files, 7 tests passed; 0.615 s** |
| Full API Vitest suite (latest) | `npm exec --no -- vitest run --config C:/Dev/convexa/libs/api/vite.config.mts --reporter=dot` | **Exit 0; 8 files, 58 tests passed; 0.964 s** |
| API library and spec no-emit typechecks | `npx tsc --noEmit -p C:/Dev/convexa/libs/api/tsconfig.lib.json --pretty false` and `npx tsc --noEmit -p C:/Dev/convexa/libs/api/tsconfig.spec.json --pretty false` | **Both exit 0** |
| Earlier dashboard Nx typecheck | `npx nx run @convexa/dashboard:typecheck --skip-nx-cache` with `NX_DAEMON=false`, `NX_NO_CLOUD=true` | **Exit 0; Nx succeeded; 0.944 s**, before latest app integration edits |
| Latest joined dashboard Nx typecheck | same command, run after API changes | **Exit 1**; app-owned `useTickerPageModel.ts` expects seven fields absent from `TickerBundle`, and `AppShell.tsx:111` has MUI Stack prop errors. API declarations emitted with no diagnostics. Foundation did not edit app files. |
| Atlas JavaScript syntax | `node --check docs/backend-atlas/atlas.js` | **Exit 0** |

The G5 guard includes invalid explicit mode rejection, both live/demo route receipts, an assertion that the resolved Nx build identity contains mode and postprocessor inputs (and rejects a poisoned identity), and deterministic private-map output including a no-map manifest. Focused G2–G4 checks cover catalog coherence, ticker/scanner dependent values and DTO projection, local book round-trip/linkage, stream lifecycle/timestamps, corrupt settings/view/book byte preservation, indicator vectors, distinct recommendation status/export projections, local broker refresh, and storage-getter failure pause/recovery without modifying existing bytes. The scanner projection is checked for the consumer vocabulary (`ok`), the score-60 actionable boundary, lowercase ticker normalization, `rth` session basis, and `medium` conviction. The full API suite also verifies generated wire authority and existing API contract behavior.

The lazy scenario loader uses canonical JSON asset URLs and validates the seed before success caching. A rejected fetch clears its in-flight entry; the catalog test retries that same URL and recovers, covering the failure path without importing failed JavaScript modules. Recommendation POST and selected export now consume the exact catalog fingerprint, including the noncontiguous Oct 9 + Nov 20 set; export selection header is sent only in demo mode.

### Foundation can-fail proof

G4 ATR divisor proof was run against the focused indicator spec. I changed only the simple ATR divisor from 14 to 13; command `npx vitest run --config vite.config.mts src/lib/demo/indicators.spec.ts` exited **1**, with the independent flat-vector expectation failing (`expected value: 2`, received `2.1538461538461537`; 1 failed, 1 passed). I restored 14 and reran the entire focused G2–G4 command above: **exit 0, 9/9 passed**.

The read-only deferred-loader probe found the pre-fix lifecycle bug: replacing a subscriber during a held load delivered 6 old frames to the replacement, storage pause still emitted 6, and a held load emitted 2,154 frames after the 30-minute hard end. The current G3 workspace regression holds and then resolves/rejects the loader across unsubscribe/resubscribe, pause, resume and end; it asserts zero stale or post-end frames and explicit retry behavior. It passes in the latest 58-test API suite.

### Not measured at the foundation checkpoint

At this historical foundation checkpoint, the demo/live production build and Nx cache sequence, bundle limits/complete boot closure, composed dashboard behavior, full frontend suites, static artifact browser journey, attempted-request/no-egress counter, Pages preview routing, CI, hosted behavior and independent QA were **NOT RUN**. Later local results are recorded above; hosted behavior and Linux/remote CI still remain pending. The anonymous live API receipt elsewhere in this directory is not evidence for demo behavior.
