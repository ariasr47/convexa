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

The proposed portfolio composition uses the real frontend behind an explicit, environment-selected demo adapter. Synthetic market data, sample recommendations and a separate sample portfolio must never call paid services, masquerade as current market data, or write into a visitor's real saved state. The Spire design artifacts in `.spire/clusters/tech/contracts/portfolio-demo-platform/` will settle the exact interfaces before build.

## Evidence legend

- **Source-derived:** read directly in code, with file/line references. A sequence diagram proves structure, not that an actual request ran.
- **Measured locally:** a command/browser observation with revision, mode, exit code and result.
- **Hosted:** observed on the deployed revision. Local green is never substituted for this.
- **Proposed:** design not yet implemented or verified.

## Delivery boundary

Prefer a static demo deployment using existing hosting. This work does not authorize production database migrations or modifications to production data. Existing Railway configuration includes a migration hook; avoid that deployment path for a static demo.
