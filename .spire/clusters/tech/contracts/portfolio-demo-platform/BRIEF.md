# portfolio-demo-platform — brief

Goal: Turn Convexa into a portfolio-ready, convincingly populated demonstration that does not require any paid market-data or AI provider. First deliver a visual backend atlas grounded in the repository: system design, architecture, stack, module map, API/data/store boundaries, request traces, jobs, user journeys and deployment. Add env-selectable demo/live composition, seed every exposed data-dependent surface (including portfolio and screener), and add useful technical-analysis and research experiences. Research current Nx guidance, measure and improve production builds and economical verification, and deploy the verified demo to an existing suitable hosting target.
Decision impact: A visitor can understand and explore the product without credentials or paid feeds; Rodrigo can visually trace each screen to its source and understand how to restore live data. Cost budget: at most 8 new retained behavior tests/journeys initially, target less than 30 seconds added frontend unit CI and one bounded demo browser smoke; guard accidental paid egress, live/demo state contamination, incomplete visible data paths, numeric indicator mistakes and build-mode cache collisions. Any budget adjustment must name a measured risk and cost.
Feasibility: pass — existing frontend API client, fixture artifacts, provider ports and static deployment are reusable; source audits must identify remaining unhandled boundaries before build.
Effort: L
Invariant watch: best-effort-isolated-or-null; additive-keeps-score-byte-identical; live-vs-static-isolation; operator-vs-trader-path-separation; no-real-order-path; server-side-gate-enforcement; loss-free-durable-migration; secret-encrypted-at-rest; no-secrets-in-image; production-fails-closed; single-shared-sim-entry-dialog; theme-token-discipline; model-read-carries-its-assumptions; digested-labels-not-raw-dump; absent-is-not-none; structural-over-prose-enforcement; single-motion-moment; ai-asserted-numbers-are-traceable; cited-code-is-verified-not-assumed; local-evidence-is-not-hosted-evidence; present-is-live-paid-only; route-growth-repins-api-artifact-oracle; a11y-gate-scans-both-schemes-and-overlays.
Context tags: architecture,frontend,overview
Source: Rodrigo's direct request in this chat, 2026-10-07. Massive subscription ended; project has no revenue and no current live-data budget. Rodrigo delegates the facade/provider architecture choice and authorizes in-repo work and deployment. No paid service signup, schema/data migration, or production data edits are authorized by this feature.
Backlog item: none (direct owner-selected portfolio initiative)
Considered: isolated demo composition through the existing frontend facade (preferred after preliminary source audit; to be settled by council); backend-wide demo composition (possible but larger because production rejects test fixtures intentionally); replacing real widget components with a separate pretend site (culled: duplicates UI and fails to demonstrate the application); re-enabling Massive (culled: no budget); changing production data or migration requirements (culled: outside authorization).

## Binding scope and authorization

- Deliver the atlas as durable, accessible, interactive documentation in `docs/backend-atlas/`, with readable source references and static code traces explicitly distinguished from runtime observations. Include visual current-state and proposed-state diagrams, a widget/data map, a mode comparison, environment/runbook, test/deploy rationale and known limitations. Never label invented metrics as measured.
- The new user-facing demo truth indication and technical-analysis/research experience require a reviewable design canvas in `docs/backend-atlas/` before implementation. Use the SET Curvature Terminal v2 canon; do not invent a second product design system.
- The user chose the initiative and delegated implementation choices; use reversible, documented defaults and continue. Do not stop for routine confirmation or an inferred spec approval. Report concrete decisions and permit steering while work proceeds.
- Demo is explicitly synthetic/sample data, not current market data, a historical claim, a real AI response, or a paid live book. It must not animate with the app's genuinely-live status signals. Mock/live switching must be an environment configuration change, documented with rebuild/restart semantics.
- All exposed data paths must be covered: regular HTTP, SSE/streaming, auth, AI, broker/account flows, research, client stores and direct fetches. A fail-closed unsupported operation is preferable to silent fallback to a paid/network path. Avoid wrapping every component; prefer the smallest complete data boundary.
- No real broker order, user data overwrite, production database migration, weakening of Rust production checks, or hidden credential requirement. Keep existing live behavior available; separate demo browser state and prevent demo-to-live synchronization.
- Technical analysis should expose meaningful indicators with named window/basis and chart context; research should support an understandable simulated exploration using deterministic sample data. Existing operator diagnostics remain separate and unlinked from trader UI.
- Preserve current hosted backend and its production data. Prefer an existing static-host deployment of demo assets that has no dependency on Railway migration hooks. Inspect hosting before any mutation; do not create chargeable resources.
- Design, plan, build and independent QA follow the installed Spire roles. Tests earn their place by silent-costly failure coverage; do not invoke generic test-driven-development.

## Source discovery artifacts

- `docs/backend-atlas/backend-source-audit.md`
- `docs/backend-atlas/frontend-source-audit.md`
- `docs/backend-atlas/nx-production-research.md`

These audits are evidence inputs, not contracts. The council must verify any precise source fact it uses.
