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

[Open the published portfolio demo](https://a17bba43.convexa.pages.dev) · [Branch preview alias](https://codex-portfolio-demo-platfor.convexa.pages.dev). Source `2211d829e9315077ca26fedd5a6441580be08c1c` passed [hosted G6](evidence/qa-browser-followup.json): six routes by direct navigation and hard refresh, 12/12 HTTP 200, demo provenance, exact CSP, strict TLS, zero forbidden requests and zero page or console errors. **Overall independent QA is now 19 PASS / 1 FAIL / 0 UNVERIFIABLE; GATE Q FAIL.** AC14 reopened after the full Linux Chromium help-interaction failures below. Hosted success does not clear that failure.

[CI run 37737797873](https://github.com/ariasr47/convexa/actions/runs/37737797873) **completed with failure**. Backend/capacity, frontend units/build/bundle, compatibility 15/15, accessibility execution 35/35 and visual comparison 6/6 passed. Accessibility execution does not mean zero findings. Full Linux Chromium finished **120 passed / 8 failed / 0 flaky**: every AC35/U32 width failed its native help interaction. The intended tooltip opens then immediately closes; the original Linux closing event has not been identified directly. CI G5, the demo build and G1 were skipped. The [completed-run receipt](evidence/ci-run-2211d829.json) retains exact gate counts and source bindings.

A new **uncommitted local candidate** is recorded in [activation follow-up](evidence/chromium-activation-followup.json). Completed click/tap explicitly activates help and suspends hover listeners; an already-queued mouseleave is guarded. A native mixed-input failure reproduced locally, then passed with the repair. Eight local AC35/U32 cases passed in 59.4 s with zero retries across 44 site/width pairs; genuine Escape, blur, touch dismissal and restored ordinary hover were checked. The original Linux close-event identity remains unknown, and the receipt retains the pre-commit shared-timer limitation and failed diagnostic probe. The fresh DEMO snapshot `.spire/tmp/portfolio-qa-demo-activation-dist` has 199 files and index SHA-256 `7DE6CC4E392D1D8D34BDC9BB8560E495D34FFD586F82D9DDB271A4D126078506`. Independent candidate QA matched 199/199 files and passed expanded G1 1/1, native exit 0, in 55.2 s under local HTTPS with exact CSP and native DEMO mixed touch. Focused AC35/U32 passed 8/8 with zero retries across four widths; its reporter is incomplete against the 128-case manifest, so this is not a full Chromium gate. Direct native mixed touch, Escape, Tab, blur and desktop hover checks passed with zero forbidden egress or page errors. This candidate is not committed, hosted or Linux-verified and does not clear published-source AC14 or GATE Q.

The earlier published-source [local browser follow-up](evidence/qa-browser-followup.json) remains valid within its scope: all 199 frozen files matched `.spire/tmp/portfolio-qa-demo-touch-dist`; `index.html` SHA-256 is `237FA0E7A081F1D4C433869ED0EE4E48230F0A4E8C3975B7752DAE26A08E6087`. Local DEMO G1 passed 1/1, native exit 0, 50.1 s, zero forbidden egress; four focused native AC35 viewport cases passed without retries. Initial pre-ready probe conflicts remain recorded; settled interactions passed. This filtered local run is not the full Linux LIVE gate and cannot override its eight failures.

The candidate [production matrix](evidence/demo-build-matrix.json) passed all four steps, native exit 0: demo miss 24.1205477 s (`103667181284566249`), demo hit 5.9061708 s, LIVE cache hit 6.2104163 s (`10649328654748830058`), demo restore hit 6.2488567 s. LIVE was already cached by the focused verification; it was not a cache miss. No cache was cleared or forced off, and restored public/private digests match. The initial demo build overlapped format checking, so these wall times are not an isolated benchmark. Output has 199 public files, 46 private maps plus manifest and 48 JavaScript files; 55 bundle checks passed with unchanged caps. The candidate [static Brotli q11 boot](evidence/demo-boot-closure.json) is 224,030 bytes (218.779 KiB), with Technical analysis adding 2,457 bytes and Research 1,732 bytes. These graph sizes are not observed transfer. Full format exited 0 and protected backend/quant/generated/Cargo/Railway source remains unchanged; earlier contract lint exited 0 with two pre-existing context-size warnings.

The earlier HTTPS, reporter and native-help work has [local HTTPS parity](evidence/local-https-parity.json) and [touch follow-up](evidence/chromium-touch-followup.json) receipts. Reporter checks passed 13/13, retained all 149 attachments and kept flaky outcomes failing. Earlier AC35/U32 local checks passed 8/8 without retries across 44 site/width pairs with unchanged closed layout. The original `219d73a6` synthetic first-attempt flake also remains unexplained. These local results do not establish the cause or resolution of the current `2211d829` Linux failures.

Linux LIVE reference acceptance `44894ccd5fa8e8e986c66bd3e6c4841d` remains bound to source `219d73a67b6f7a284172afaa3fc24b1b850e3319`. Its [workflow 37735626254](https://github.com/ariasr47/convexa/actions/runs/37735626254) had two stable 6/6, zero-retry comparisons, independent review of 20 images and validator exit 0. Current `2211d829` visual comparison passed 6/6 against those accepted references; this is a current comparison, not a new baseline acceptance or overall QA approval. See the [acceptance receipt](../../apps/dashboard-e2e/visual-review/acceptances/44894ccd5fa8e8e986c66bd3e6c4841d.json).

Current policy failed with **26 npm, one Cargo and three repository-secret findings**. Only the npm/Cargo check records match the earlier [baseline comparison](evidence/ci-policy-baseline-comparison.json); the entire policy result is not baseline-equivalent, and empty findings arrays still prevent npm advisory-ID identity proof. The current policy report binds PR merge SHA `bddb6c202821ef154d85d42fb81c738bb99ccb1e`, not source `2211d829`. [Secret-scan follow-up](evidence/secret-scan-followup.json) conclusively identified the three new matches as a public localhost test key and two deterministic `run_key` hashes. Three exact historical fingerprints were added to uncommitted `.gitleaksignore`; pinned local Gitleaks exited 0 with zero findings, while omission and wrong-identity controls restored the intended findings. No broad ignore was added. This Windows local follow-up is not a published Linux CI pass; policy and overall CI remain failed.

History remains scoped: `219d73a6` had its own [hosted pass](evidence/qa-hosted-g6-success.json); the earlier `3c08d719` inline-bootstrap CSP failure was repaired without weakening CSP. Earlier local dashboard 3,150/API 59 tests, G5 4/4 and source-pinned Windows visual acceptance are not promoted to the current Linux result. CI and manual Linux visual workflows are active; other workflows were untouched. The open release blocker is AC14, alongside the failed CI/policy status. No all-CI-green claim is made.
