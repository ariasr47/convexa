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

The final joined implementation covers six symbols × seven expiry selections, six distinct Research cases, and all listed normal widgets. Canonical local checks passed: dashboard 262 files / 3,150 tests, API 8 files / 59 tests, typecheck and generated API contract, format check, and lint across three projects (exit 0 with advisory warnings). The full lint command reported zero errors; warnings were advisory.

Live Chromium passed 128/128 and cross-browser compatibility passed 15/15. Final accessibility execution passed 35/35 with native exit 0, while reporting seven unwaived moderate findings: five missing-H1 findings on ticker routes and two heading-order findings on Positions. Passing execution is not a zero-findings claim. Visual baseline review is pending.

Final G1 production-demo journey passed in 54.159 seconds with zero egress; the MSFT 60-source probe passed. Independent QA against 20 acceptance criteria is still running; visual baseline review is pending. CI and hosted Pages/deep-link checks have not run, so there is no hosted URL, overall PASS, or release claim. These receipts describe a worktree before its checkpoint commit, not a deployed hash. Preserve the original Rust-backed architecture as a separate source-derived path; the demo facade runs in the browser and does not route demo data through Rust.
