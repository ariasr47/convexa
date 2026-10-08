# Convexa backend atlas

This atlas explains the original Rust-backed live service and the implemented browser-local portfolio demo. Live-source links remain pinned to `8932fc1176543eff3fa826de6924e12ec52f3310` (the October 7, 2026 audit); demo links point to the `codex/portfolio-demo-platform` implementation. Neither source diagrams nor local checks claim hosted traffic.

## Read visually

- [Interactive atlas](index.html) — live system map, request traces, data ownership, user journeys, and the implemented demo flow.
- [Experience canvas](design-canvas.html) — the **pre-build proposed canvas**, including desktop/phone, dark/light and degraded states. It is a design artifact, not a screenshot of the shipped app.
- `backend-source-audit.md` — Rust architecture and provider/storage/worker evidence.
- `frontend-source-audit.md` — page/widget-to-source map and browser-state boundaries.
- [Nx production research](nx-production-research.md) — build/cache findings, deployment research and official source links.

Open `index.html` directly, or serve the atlas from the repository with `node docs/backend-atlas/serve.mjs` and visit `http://127.0.0.1:4387/`. It has no external runtime dependencies. Select a diagram node or section tab to read its responsibility, evidence class and source links.

## How to read the evidence

- **Source-derived** means the referenced code describes the path; it does not prove a request ran.
- **Locally measured** means the command or browser observation completed locally with an exit code and result.
- **Hosted** means the exact deployed revision and URL were observed. Local success cannot substitute for it.
- **Proposed** identifies a design direction, including the pre-build experience canvas.

The original live service is a Rust/Axum application behind the Pages proxy. Its market-data subscription has ended. `MARKET_DATA_MODE=paused` stops its five market-data producers and refuses market reads; it does not select or populate the demo. The demo is a separate build-selected dashboard path. It uses authored synthetic data, browser-local services and storage, and does not establish that the Rust service processed the visitor's request.

## Portfolio demo: current behavior

The built demo uses the existing dashboard composition with a local API-compatible facade, one fixed scenario clock, and the `convexa.demo.v1.*` storage namespace. The catalog supports SPY, QQQ, AAPL, MSFT, NVDA and TSLA, with three authored expiries and seven curated nonempty expiry selections per symbol. Scanner rows and prices, the editable paper portfolio, simulated orders, settings and sample stream remain local. Read-only sample broker holdings are a separate dataset.

Technical analysis and Research are separate lazy-loaded views within each ticker. The normal sample bundle is authored for all six symbols and all seven nonempty expiry selections: IV skew, full-chain term structure, both dealer-flow limbs, all four Market Context groups, full-chain IV rank, selected-variant normalized GEX, a quoted selected-expiry straddle, three qualifying positioning rows, and side-unknown off-exchange blocks. Technical analysis reads 60 authored daily bars. Research has six distinct cases, each linked to source items, evidence, risks and invalidation; both are separate from operator archive research. Demo export carries the exact selected expiry variant fingerprint and sample provenance. Live mode reports local bars and research cases as unavailable. Sample-tape figures retain app-local standing and live=false. Final joined local coverage and the user journey were observed; the static data inventory alone does not certify every value/source relationship.

Choose the build mode in PowerShell from `C:\Dev\convexa`:

```powershell
$env:VITE_DATA_MODE = 'demo'
npm run build:dashboard
```

Use `live` to build the live dashboard. When the variable is unset, the wrapper defaults to live, except for the configured Cloudflare Pages feature branch (`CF_PAGES=1` and `CF_PAGES_BRANCH=codex/portfolio-demo-platform`), which defaults to demo. Invalid explicit values fail before Nx starts. Mode enters the build identity, so switching modes requires another build. Both modes use the production optimization target.

For ordinary local builds, clear the variable to restore the live default:

```powershell
Remove-Item Env:VITE_DATA_MODE -ErrorAction SilentlyContinue
npm run build:dashboard
```

The local demo uses static assets and makes no API or vendor request by design. The final production demo journey ran in 54.159 seconds with zero egress, and the separate MSFT 60-source probe passed. This is local worktree evidence, not hosted traffic. Already-loaded views can continue to use local data offline; an uncached lazy view still needs its static chunk.

## Verification status

The [preview at revision `3c08d719`](https://bf7f65f4.convexa.pages.dev) deployed but is blank: `script-src 'self'` blocked the inline build bootstrap. Hosted G6 failed at landing before deep-route/refresh checks, so AC18 is FAIL, with no zero-egress claim for that failed run. See the [hosted failure](evidence/hosted-g6-failure-3c08d719.json) and [deployment/workflow receipt](evidence/pages-preview-3c08d719.json). The preview is not yet usable.

Vite now emits a content-hashed, blocking same-origin bootstrap (`aafa561a8b237e2a`); CSP is unchanged. The first-paint theme checks passed 16/16, native exit 0. The local artifact server now applies the artifact's global CSP; [16 one-time HTTP parity checks](evidence/csp-server-parity.json) passed, and independent QA reproduced the old blank-page failure through that server. The repaired 199-file artifact includes 370 Brotli bytes of external bootstrap in its 223,992-byte boot closure. Independent local G1 passed 1/1, native exit 0, 46.7 s, zero egress, with the artifact CSP applied; a new Pages deployment and hosted checks are still required. CI and the manual Linux visual workflow are now active; exact-revision CI and Linux results remain pending.

The final joined implementation covers six symbols × seven expiry selections, six distinct Research cases, and all listed normal widgets. Canonical local checks passed: dashboard 262 files / 3,150 tests, API 8 files / 59 tests, typecheck and generated API contract, format check, and lint across three projects (exit 0 with advisory warnings). The full lint command reported zero errors; warnings were advisory.

The [independent CSP parity observation](evidence/qa-csp-parity.json) confirms the new external classic bootstrap sets demo mode before modules, selects demo light theme despite a live dark key, and retains that first theme through Technical analysis mount with its H1. The old artifact still reproduced the blank-page failure under the same CSP.

Live Chromium passed 128/128 and cross-browser compatibility passed 15/15. Final live accessibility execution passed 35/35 with native exit 0, while reporting seven existing unwaived moderate findings: five missing-H1 findings on ticker routes and two heading-order findings on Positions. Passing execution is not a zero-findings claim.

The current measured [production build matrix](evidence/demo-build-matrix.json) has four native exit-0 results: demo cache miss 8.1052879 s, identical demo hit 4.7503575 s, live cache miss 7.6202695 s, and demo restore hit 4.8517883 s. The misses used normal cache-enabled builds after source edits, without clearing the machine cache. Demo and live hashes differ; demo public assets and private maps restore byte-identically. Output contains 199 public files and 46 private maps plus their manifest; the bundle gate passed 55 checks. The [complete boot closure](evidence/demo-boot-closure.json) is 223,992 bytes Brotli q11; Technical analysis adds 2,457 bytes and Research 1,734 bytes. These are static graph sizes, not observed transfer. These measurements include the completed contrast and heading repairs; the external-bootstrap repair also joins this artifact; independent local G1 passed 1/1, native exit 0, 46.7 s, zero egress, with the artifact CSP applied.

Six Windows LIVE visual references were [accepted](../../apps/dashboard-e2e/visual-review/acceptances/68f647210293cad6724475d0a75932f4.json) at source `4c4fb35814a79de16f0d069f34a4f4d7b7797cd5`; two compare-only runs passed 6/6 with native exit 0 and [validated stability evidence](../../apps/dashboard-e2e/visual-review/evidence/win32-portfolio-demo-4c4fb35-20261008/stability.json). This source-pinned acceptance does not cover later changes, DEMO, Linux, or the whole release.

The earlier G1 production-demo journey passed in 54.159 seconds with zero egress; the MSFT 60-source probe passed. Independent QA confirmed 3,150 dashboard and 59 API tests, and its first 20-criterion review found 18 PASS, one accessibility FAIL and one hosted UNVERIFIABLE. Independent retesting passed the Reset Demo contrast and Technical analysis/Research heading repairs, but settled light-theme scans found additional low-contrast route links, Refresh sample buttons and the Technical analysis EMA20 legend (3.01:1 or 3.26:1); textAmber now styles those controls and legend, and ready/loading/error branches have H1 headings. Hosted QA now records 19 PASS / 1 FAIL: AC18 failed because the deployed inline bootstrap was blocked by the existing same-origin script policy, leaving the preview blank. A same-origin external bootstrap repair is built; independent local G1 passed 1/1 with native exit 0 in 46.7 s (45.9 s test time), zero egress, on the CSP-aware server. Hosted redeployment and verification remain pending. Before the CSP repair, independent G1 passed 1/1 with native exit 0 in 52.0 s. Before the CSP repair, all 16 settled Technical analysis/Research scans across ready, unsupported, cold-error and held-loading states in dark/light passed with zero axe violations and one H1 each. Prior dark-theme scans found zero findings. Earlier G5 remains 4/4, native exit 0; automatic approval review rejected the independent repeat because it could change build artifacts, so that repeat is not a pass. See [local evidence](evidence/demo-local.md) and the [QA report](../../.spire/clusters/tech/contracts/portfolio-demo-platform/QA_REPORT.md).

The deployed Pages preview failed hosted AC18 and remains unusable. Redeployment, exact-revision CI and Linux visual results remain pending. No overall PASS or release is claimed. Local receipts retain their individual source/artifact scope; none identifies a deployed hash. The original Rust-backed architecture remains a separate source-derived path; the demo facade runs in the browser and does not route demo data through Rust.
