# Convexa backend atlas

This atlas explains the current repository and the portfolio demo initiative. The source baseline is `8932fc1176543eff3fa826de6924e12ec52f3310` (2026-10-07 audit). It is not a production telemetry report.

## Read visually

- [Interactive atlas](index.html) — system map, request walkthroughs, data ownership, stack and user journeys.
- [Experience canvas](design-canvas.html) — proposed demo indication, technical-analysis and research experience, created before product implementation; desktop/phone, dark/light and degraded states.
- `backend-source-audit.md` — Rust architecture and provider/storage/worker evidence.
- `frontend-source-audit.md` — page/widget to source map and browser-state boundaries.
- `nx-production-research.md` — current official guidance, repository findings and production/test recommendations.

Open `index.html` directly, or run `node docs/backend-atlas/serve.mjs` from the repository and visit `http://127.0.0.1:4387/`. The atlas has no external runtime dependencies. Source links pin the audited Git revision. The diagram and walkthrough controls work locally.

## Current boundary

The paid Massive subscription is no longer active. The current backend supports `MARKET_DATA_MODE=live|paused`; paused avoids vendor workers and denies unavailable market-data requests. Existing fixture/replay adapters are research/test facilities and must not be relabeled as paid live observations.

The portfolio composition uses the real frontend behind an explicit, build-selected demo adapter. Its shared provider foundation is implemented locally; dashboard integration and hosted delivery are still pending. Synthetic market data, sample analysis and the separate sample portfolio must never call paid services, masquerade as current market data, or write into a visitor's live saved state. The approved interfaces and scope are in `.spire/clusters/tech/contracts/portfolio-demo-platform/`.

## Evidence legend

- **Source-derived:** read directly in code, with file/line references. A sequence diagram proves structure, not that an actual request ran.
- **Measured locally:** a command/browser observation with revision, mode, exit code and result.
- **Hosted:** observed on the deployed revision. Local green is never substituted for this.
- **Proposed:** design not yet implemented or verified.

Recorded evidence is under `evidence/`: local production-build/test baseline, atlas/canvas review, and a separate two-endpoint anonymous hosted API shape check. That API check does not establish paid-feed operation or deployment of the new demo.

## Demo mode runbook and current status

Set `VITE_DATA_MODE=demo` or `VITE_DATA_MODE=live` before `npm run build:dashboard`. An unset value resolves to `live`, except that the wrapper chooses `demo` when `CF_PAGES=1` and `CF_PAGES_BRANCH=codex/portfolio-demo-platform`; any other explicit value fails before Nx. Mode is included in the Nx build identity, so changing it requires a new build and deployment. Do not switch modes by editing browser storage.

Demo catalog coverage is six symbols: SPY, QQQ, AAPL, MSFT, NVDA and TSLA. The authored expiries are 2026-10-09 (2 DTE), 2026-10-16 (9 DTE) and 2026-11-20 (44 DTE), with seven curated nonempty expiry selections. Dark-pool-only queries and unsupported operations are explicitly unavailable. Sample bars and research are demo-only; live mode reports the provider as unavailable rather than borrowing demo data. The demo preview is intended to use static Pages routes with Functions excluded. Loaded and cached content can remain visible offline; uncached routes or chunks are not promised offline behavior. To return to live behavior, build and deploy with `VITE_DATA_MODE=live`.

Current local evidence is scoped to the shared foundation: four focused Vitest files (nine checks), the G5 build-mode/routing/cache guard (four checks), and the API library typecheck have passed. These results do not establish a complete dashboard build or browser experience. The production build/cache mode matrix, bundle closure, composed dashboard journey, hosted route/no-egress observation, CI gates and final independent QA remain **NOT RUN**. See [demo-local evidence](evidence/demo-local.md) for exact commands, exits and limitations.

## Delivery boundary

Prefer a static demo deployment using existing hosting. This work does not authorize production database migrations or modifications to production data. Existing Railway configuration includes a migration hook; avoid that deployment path for a static demo.
