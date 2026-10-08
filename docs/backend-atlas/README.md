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

The local demo uses static assets and makes no API or vendor request by design. An earlier local production demo journey ran in 54.159 seconds with zero egress, and the separate MSFT 60-source probe passed. This is local worktree evidence, not hosted traffic. Already-loaded views can continue to use local data offline; an uncached lazy view still needs its static chunk.

## Verification status

[Open the published portfolio demo](https://0c9f45c7.convexa.pages.dev) · [Branch preview alias](https://codex-portfolio-demo-platfor.convexa.pages.dev). The published source `219d73a67b6f7a284172afaa3fc24b1b850e3319` retains **20 PASS / 0 FAIL / 0 UNVERIFIABLE** independent QA. Its [hosted G6 receipt](evidence/qa-hosted-g6-success.json) records six routes by direct navigation and hard refresh: 12/12 HTTP 200, demo provenance, zero forbidden requests and zero page errors under unchanged CSP. The 46.7 s CSP-aware local G1 and 16 clean settled state/scheme axe views also retain their earlier artifact scope. The branch alias can advance; the exact URL identifies this verified deployment.

A newer worktree includes native help interaction, local HTTPS and reporter repairs. Its frozen demo is `.spire/tmp/portfolio-qa-demo-touch-dist`, with `index.html` SHA-256 `237FA0E7A081F1D4C433869ED0EE4E48230F0A4E8C3975B7752DAE26A08E6087`. Independent QA, a new CI run and redeployment of this artifact remain pending. Published QA does not certify these later changes. The final full format check and contract lint exited 0 (two pre-existing context-size warnings); the protected backend/quant/generated/Cargo/Railway diff is empty.

The latest [production matrix](evidence/demo-build-matrix.json) passed four builds, all native exit 0: demo miss 8.2160274 s (`7825241614970460158`), demo hit 4.5857889 s, live miss 6.9397955 s (`17629102782126001067`), and demo restore hit 5.8126887 s. These were normal cache-enabled misses, not `NX_SKIP_NX_CACHE`; restored public/private digests match. Output contains 199 public files, 46 private maps plus manifest, six seeds and 48 JavaScript files; 55 bundle checks passed with unchanged caps. The [static Brotli q11 boot](evidence/demo-boot-closure.json) is 223,993 bytes (218.743 KiB); Technical analysis adds 2,456 bytes and Research 1,725 bytes. Static graph size is not observed transfer. The original baseline was 196,143 bytes, so the full boot is larger.

[CI run 37732918597](https://github.com/ariasr47/convexa/actions/runs/37732918597) **completed with failure**. Backend and capacity jobs passed; frontend lint, typecheck, units, build and bundle checks passed. Accessibility executed 35/35 with seven recorded findings. The browser gate failed on five WebKit TLS failures, one flaky Chromium identity and two changed visual references; retry attempts were also incorrectly counted as distinct tests. CI G5 and G1 were skipped. The [completed-run receipt](evidence/ci-run-219d73a6.json) preserves exact counts and diagnoses; raw summaries were not rewritten.

The newer repairs have focused local evidence: [local HTTPS parity](evidence/local-https-parity.json) preserves exact artifact CSP while retaining strict certificate checks for hosted URLs; reporter checks passed 13/13, native exit 0, retained all 149 attachments and kept flaky results failing. [Native help follow-up](evidence/chromium-touch-followup.json) passed AC35/U32 8/8 with zero retries across 44 site/width pairs and unchanged closed layout. The original Linux synthetic first-attempt flake has no retained trace, so its precise cause is not established. These receipts do not turn the failed CI run into a pass.

Linux LIVE references were independently accepted as `44894ccd5fa8e8e986c66bd3e6c4841d` at source `219d73a67b6f7a284172afaa3fc24b1b850e3319`. [Candidate workflow 37735626254](https://github.com/ariasr47/convexa/actions/runs/37735626254) succeeded with two 6/6 stable, zero-retry comparisons; independent review covered 20 images and validators exited 0. The [acceptance receipt](../../apps/dashboard-e2e/visual-review/acceptances/44894ccd5fa8e8e986c66bd3e6c4841d.json) applies to that Linux LIVE source, not the later repairs, DEMO or all CI. Earlier Windows LIVE acceptance remains pinned to `4c4fb35814a79de16f0d069f34a4f4d7b7797cd5`.

Policy and aggregate checks also failed. The [policy baseline comparison](evidence/ci-policy-baseline-comparison.json) found identical failing check records/counts (26 npm, one Cargo), a matching policy hash and unchanged dependencies. Empty findings arrays and a null npm evidence hash prevent advisory-ID identity claims. The emitted policy revision is PR merge SHA `35acd624f1a3a1cd9e15115fc06838b729de8899`, not the head SHA. CI and manual Linux visual workflows are active; other workflows were untouched. No all-CI-green or approval of the newer repaired artifact is claimed.

Historical context: the `3c08d719` preview was blank because CSP blocked an inline bootstrap. The same-origin external bootstrap repaired it without weakening CSP, as recorded by [hosted failure](evidence/hosted-g6-failure-3c08d719.json), [HTTP parity](evidence/csp-server-parity.json) and [browser parity](evidence/qa-csp-parity.json) receipts. Earlier local dashboard 3,150/API 59 tests and G5 4/4 retain their original scope; automatic approval review rejected the independent G5 repeat because it could change build artifacts. The [Linux authorization helper verification](evidence/linux-authorization-restore.json) independently restored 19 files and rejected four invalid cases without writes; it is separate from browser evidence.
