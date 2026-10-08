# Batches — lean tests and CI, 2026-10

One batch = one area and one kind of change. Order: retirements (risk-gone, structure, duplicate),
trims and consolidations, speed-ups, CI, Nx, verify and hook, new behavior tests. Trim batches for
A7 and R4a come first in their phase because other areas' removals depend on them (A7's needle fold
into `batch-backtest-cli.structural.spec.ts`; R4a's `golden.rs` hard-assert).

Every retirement commit: delete the files, edit every config/script/workflow line that names them,
append one `RETIRED: <path>; parent <sha>; <kind>; <n> tests` line per file to
`.spire/clusters/tech/state/RETIRED.md`, then run the full Phase 0 verification. Counts in `( )` are
the runner's own case counts at `8932fc11`.

## Retirements and trims (generated from audit.csv)

### Batch 1 — A2-ticker-other: retire 1 risk-gone file(s)

Deletes 3 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/dashboard/src/app/pages/ticker/widgets/structure-history/StructureHistory.spec.tsx` — 3 — RETIRE/risk-gone

### Batch 2 — A3a-trading-positions: retire 1 risk-gone file(s)

Deletes 10 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/dashboard/src/app/features/trading/positions/fixtures.spec.ts` — 10 — RETIRE/risk-gone

### Batch 3 — A5-shared-shell-theme: retire 1 risk-gone file(s)

Deletes 4 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/dashboard/src/app/shared/theme/blog-tokens.spec.ts` — 4 — RETIRE/risk-gone

### Batch 4 — R3a-rust-research-tape-archive: retire 1 risk-gone file(s)

Deletes 4 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/api/src/services/research/score_lab.rs` — 4 — RETIRE/risk-gone

### Batch 5 — R4a-rust-it-contracts-guardrails: retire 1 risk-gone file(s)

Deletes 4 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/api/tests/production_runtime_guardrails_receipts.rs` — 4 — RETIRE/risk-gone

### Batch 6 — T1-e2e-tool-specs: retire 6 risk-gone file(s) — contains BLOCKED items

Deletes 0 runner-counted cases (+6 file(s) with no runner count). One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/dashboard-e2e/tools/d7-boundary.spec.mjs` — pending — RETIRE/risk-gone
- `apps/dashboard-e2e/tools/d8-boundary.spec.mjs` — pending — RETIRE/risk-gone
- `apps/dashboard-e2e/tools/isolation.spec.mjs` — pending — RETIRE/risk-gone
- `apps/dashboard-e2e/tools/visual-authority.matrix.spec.mjs` — pending — RETIRE/risk-gone — **BLOCKED: falls with visual.spec.ts (owner ruling)**
- `apps/dashboard-e2e/tools/visual-review.spec.mjs` — pending — RETIRE/risk-gone — **BLOCKED: falls with visual.spec.ts (owner ruling)**
- `apps/dashboard-e2e/tools/visual-update.spec.mjs` — pending — RETIRE/risk-gone — **BLOCKED: falls with visual.spec.ts (owner ruling)**

### Batch 7 — T1-playwright-specs: retire 1 risk-gone file(s)

Deletes 50 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/dashboard-e2e/src/audit/fidelity.spec.ts` — 50 — RETIRE/risk-gone — **SAME COMMIT: playwright.audit.config.ts:28 (retire the config with it)**

### Batch 8 — T1-supply-chain-specs: retire 1 risk-gone file(s)

Deletes 0 runner-counted cases (+1 file(s) with no runner count). One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `tools/supply-chain/remediation.spec.mjs` — pending — RETIRE/risk-gone

### Batch 9 — T1-tools-specs: retire 5 risk-gone file(s)

Deletes 56 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `tools/api-contract-baseline.spec.mjs` — 12 — RETIRE/risk-gone — **SAME COMMIT: apps/dashboard-e2e/tools/isolation.mjs list entries**
- `tools/api-router-integration-baseline.spec.mjs` — 20 — RETIRE/risk-gone — **SAME COMMIT: isolation.mjs:13**
- `tools/api-router-integration-compile-probe.spec.mjs` — 13 — RETIRE/risk-gone — **SAME COMMIT: isolation.mjs:15**
- `tools/api-router-integration-rollback.spec.mjs` — 4 — RETIRE/risk-gone — **SAME COMMIT: isolation.mjs:17**
- `tools/vite-mui-path-imports.spec.mjs` — 7 — RETIRE/risk-gone

### Batch 10 — A1-ticker-ai-rec: retire 4 structure file(s)

Deletes 123 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AiRecPanelBlocks.spec.tsx` — 2 — RETIRE/structure
- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/FigureClause.spec.tsx` — 1 — RETIRE/structure
- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/ReadSheet.spec.tsx` — 7 — RETIRE/structure
- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/readLayout.spec.ts` — 113 — RETIRE/structure

### Batch 11 — A2-ticker-other: retire 11 structure file(s)

Deletes 67 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/dashboard/src/app/pages/ticker/stage3-headings.spec.tsx` — 7 — RETIRE/structure
- `apps/dashboard/src/app/pages/ticker/ticker-age-basis.spec.tsx` — 2 — RETIRE/structure
- `apps/dashboard/src/app/pages/ticker/ticker-hierarchy.spec.tsx` — 10 — RETIRE/structure
- `apps/dashboard/src/app/pages/ticker/ticker-semantics.spec.tsx` — 2 — RETIRE/structure
- `apps/dashboard/src/app/pages/ticker/connection/LivenessAnnouncer.spec.tsx` — 4 — RETIRE/structure
- `apps/dashboard/src/app/pages/ticker/recentTickers/navigation.spec.ts` — 2 — RETIRE/structure
- `apps/dashboard/src/app/pages/ticker/widgets/_kit/lookalikes.spec.ts` — 4 — RETIRE/structure
- `apps/dashboard/src/app/pages/ticker/widgets/_kit/type-floor.spec.tsx` — 9 — RETIRE/structure
- `apps/dashboard/src/app/pages/ticker/widgets/chrome/QuickSymbols.spec.tsx` — 7 — RETIRE/structure
- `apps/dashboard/src/app/pages/ticker/widgets/read-strip/ReadStrip.spec.tsx` — 15 — RETIRE/structure
- `apps/dashboard/src/app/pages/ticker/widgets/structure-hero/TapeTrailRow.spec.tsx` — 5 — RETIRE/structure

### Batch 12 — A3a-trading-positions: retire 6 structure file(s)

Deletes 19 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/dashboard/src/app/features/trading/positions/PlSparkline.spec.ts` — 3 — RETIRE/structure
- `apps/dashboard/src/app/features/trading/positions/PositionRow.a11y.spec.tsx` — 1 — RETIRE/structure — **SAME COMMIT: apps/dashboard-e2e/tools/isolation.mjs:53 (d8-boundary pin retires in T1 risk-gone)**
- `apps/dashboard/src/app/features/trading/positions/future-copy.spec.ts` — 3 — RETIRE/structure
- `apps/dashboard/src/app/features/trading/positions/offlineLayout.spec.tsx` — 1 — RETIRE/structure
- `apps/dashboard/src/app/features/trading/positions/pauseGlyph.spec.ts` — 4 — RETIRE/structure
- `apps/dashboard/src/app/features/trading/positions/positions-stage0.spec.tsx` — 7 — RETIRE/structure — **STALE POINTER: docs/superpowers/plans/2026-07-26-scanner-04-frontend.md:29,3955 (leave the plan; note in commit)**

### Batch 13 — A3b-trading-broker-orders-outcomes: retire 1 structure file(s)

Deletes 2 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/dashboard/src/app/features/trading/orders/copy.spec.ts` — 2 — RETIRE/structure

### Batch 14 — A4-auth-alerts: retire 1 structure file(s)

Deletes 6 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/dashboard/src/app/features/auth/validation.spec.ts` — 6 — RETIRE/structure

### Batch 15 — A5-shared-shell-theme: retire 13 structure file(s)

Deletes 85 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/dashboard/src/app/shell/ConvexaMark.spec.tsx` — 4 — RETIRE/structure
- `apps/dashboard/src/app/shared/theme/banned-hexes.spec.ts` — 5 — RETIRE/structure
- `apps/dashboard/src/app/shared/theme/brand-assets.spec.ts` — 9 — RETIRE/structure
- `apps/dashboard/src/app/shared/theme/font-glyph-coverage.spec.ts` — 7 — RETIRE/structure
- `apps/dashboard/src/app/shared/theme/radius-scale.spec.ts` — 8 — RETIRE/structure
- `apps/dashboard/src/app/shared/theme/scales.spec.ts` — 5 — RETIRE/structure
- `apps/dashboard/src/app/shared/theme/spacing-ladder.spec.ts` — 4 — RETIRE/structure
- `apps/dashboard/src/app/shared/theme/stage1-tokens.spec.ts` — 11 — RETIRE/structure
- `apps/dashboard/src/app/shared/ui/ArcDivider.spec.tsx` — 3 — RETIRE/structure
- `apps/dashboard/src/app/shared/ui/Refused.spec.tsx` — 1 — RETIRE/structure
- `apps/dashboard/src/app/shared/ui/arc.spec.ts` — 9 — RETIRE/structure
- `apps/dashboard/src/app/shared/charts/structure-field/levelStrokes.spec.ts` — 11 — RETIRE/structure
- `apps/dashboard/src/app/shared/charts/structure-field/markerLayout.spec.ts` — 8 — RETIRE/structure

### Batch 16 — A6-pages-other: retire 5 structure file(s)

Deletes 33 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/dashboard/src/app/pages/lab/structureFieldDemo.spec.ts` — 4 — RETIRE/structure
- `apps/dashboard/src/app/pages/operator-metrics/useLatencyTrend.spec.tsx` — 1 — RETIRE/structure
- `apps/dashboard/src/app/pages/landing/GammaSurfaceHero.spec.tsx` — 10 — RETIRE/structure
- `apps/dashboard/src/app/pages/landing/display-face.spec.tsx` — 5 — RETIRE/structure
- `apps/dashboard/src/app/pages/landing/landing-structure.spec.tsx` — 13 — RETIRE/structure

### Batch 17 — A7-root-structural-lib: retire 4 structure file(s)

Deletes 15 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/dashboard/src/app/curvature-v2-landing-samples.structural.spec.ts` — 3 — RETIRE/structure
- `apps/dashboard/src/app/day-replay-mock-adapter.structural.spec.ts` — 4 — RETIRE/structure
- `apps/dashboard/src/app/index-head.structural.spec.ts` — 7 — RETIRE/structure
- `libs/api/src/lib/contract-compat.spec.ts` — 1 — RETIRE/structure

### Batch 18 — R1-rust-security-contracts: retire 1 structure file(s)

Deletes 5 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/api/src/routes/recommendation.rs` — 5 — RETIRE/structure

### Batch 19 — R2-rust-money-math-parsers: retire 1 structure file(s)

Deletes 1 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/api/src/infrastructure/redis/price_cache.rs` — 1 — RETIRE/structure

### Batch 20 — R3b-rust-flatfile-snapshot-capacity: retire 2 structure file(s)

Deletes 3 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/api/src/capacity/harness_app.rs` — 2 — RETIRE/structure
- `apps/api/src/services/capacity_harness/inject.rs` — 1 — RETIRE/structure

### Batch 21 — T1-e2e-tool-specs: retire 5 structure file(s) — contains BLOCKED items

Deletes 0 runner-counted cases (+5 file(s) with no runner count). One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/dashboard-e2e/tools/browser-policy.spec.mjs` — pending — RETIRE/structure
- `apps/dashboard-e2e/tools/d7-fixture-repairs.spec.mjs` — pending — RETIRE/structure
- `apps/dashboard-e2e/tools/process.spec.mjs` — pending — RETIRE/structure
- `apps/dashboard-e2e/tools/visual-frame.spec.mjs` — pending — RETIRE/structure — **BLOCKED: falls with visual.spec.ts (owner ruling)**
- `apps/dashboard-e2e/tools/wiring.spec.mjs` — pending — RETIRE/structure

### Batch 22 — T1-playwright-specs: retire 2 structure file(s) — contains BLOCKED items

Deletes 99 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/dashboard-e2e/src/e2e/no-overflow.spec.ts` — 93 — RETIRE/structure — **SAME COMMIT: playwright.config.ts:37, tools/lib/manifest.mjs + manifest.json + manifest.spec.mjs, quality-reporter gate counts**
- `apps/dashboard-e2e/src/quality/visual.spec.ts` — 6 — RETIRE/structure — **BLOCKED: owner ruling (browser-quality guards are floor; pixel snapshots are structure)**

### Batch 23 — T1-supply-chain-specs: retire 3 structure file(s)

Deletes 0 runner-counted cases (+3 file(s) with no runner count). One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `tools/supply-chain/acquire-tools.spec.mjs` — pending — RETIRE/structure
- `tools/supply-chain/dependabot.spec.mjs` — pending — RETIRE/structure
- `tools/supply-chain/docs-and-isolation.spec.mjs` — pending — RETIRE/structure

### Batch 24 — T1-tools-specs: retire 2 structure file(s)

Deletes 15 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `tools/capacity-gate.spec.mjs` — 12 — RETIRE/structure — **SAME COMMIT: drop ci.yml:272 and capacity_isolation.rs:191**
- `tools/ci-resource-guards.spec.mjs` — 3 — RETIRE/structure — **SAME COMMIT as the CI batch that removes the cargo-clean steps, or alone (no runner names it)**

### Batch 25 — A1-ticker-ai-rec: retire 3 duplicate file(s)

Deletes 12 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/planScopeCaption.render.spec.tsx` — 6 — RETIRE/duplicate
- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/powering.banned.spec.ts` — 1 — RETIRE/duplicate
- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/reservedMark.render.spec.tsx` — 5 — RETIRE/duplicate

### Batch 26 — A2-ticker-other: retire 3 duplicate file(s)

Deletes 22 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/dashboard/src/app/pages/ticker/liveTapeStore.spec.ts` — 1 — RETIRE/duplicate
- `apps/dashboard/src/app/pages/ticker/widgets/level-ladder/LevelLadder.spec.tsx` — 19 — RETIRE/duplicate
- `apps/dashboard/src/app/pages/ticker/widgets/off-exchange-blocks/OffExchangeBlocks.spec.tsx` — 2 — RETIRE/duplicate

### Batch 27 — A5-shared-shell-theme: retire 1 duplicate file(s)

Deletes 4 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/dashboard/src/app/shared/theme/banned-literals.spec.ts` — 4 — RETIRE/duplicate

### Batch 28 — A6-pages-other: retire 2 duplicate file(s)

Deletes 16 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/dashboard/src/app/pages/landing/cta-contrast.spec.tsx` — 7 — RETIRE/duplicate
- `apps/dashboard/src/app/pages/landing/svg-build-constraint.spec.ts` — 9 — RETIRE/duplicate

### Batch 29 — A7-root-structural-lib: retire 3 duplicate file(s)

Deletes 10 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/dashboard/src/app/day-replay-mock-adapter.spec.tsx` — 2 — RETIRE/duplicate
- `apps/dashboard/src/app/exchange-holiday-calendar.structural.spec.ts` — 6 — RETIRE/duplicate
- `apps/dashboard/src/testing/operatorSessionArchiveAllowlist.spec.ts` — 2 — RETIRE/duplicate

### Batch 30 — R1-rust-security-contracts: retire 6 duplicate file(s)

Deletes 11 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/api/src/routes/candidates.rs` — 1 — RETIRE/duplicate
- `apps/api/src/routes/contract.rs` — 2 — RETIRE/duplicate
- `apps/api/src/routes/demo.rs` — 1 — RETIRE/duplicate
- `apps/api/src/routes/market.rs` — 2 — RETIRE/duplicate
- `apps/api/src/routes/ticker.rs` — 4 — RETIRE/duplicate
- `apps/api/src/services/auth/grok_oauth.rs` — 1 — RETIRE/duplicate

### Batch 31 — R2-rust-money-math-parsers: retire 1 duplicate file(s)

Deletes 4 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `libs/quant-engine/src/max_pain.rs` — 4 — RETIRE/duplicate — **DEPENDS: golden.rs hard-assert CONSOLIDATE (R4a trim batch) must land first**

### Batch 32 — R3a-rust-research-tape-archive: retire 2 duplicate file(s)

Deletes 3 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/api/src/services/day_tape/literals.rs` — 1 — RETIRE/duplicate
- `apps/api/src/services/day_tape/mod.rs` — 2 — RETIRE/duplicate

### Batch 33 — R4a-rust-it-contracts-guardrails: retire 1 duplicate file(s)

Deletes 8 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/api/tests/archive_coverage_isolation.rs` — 8 — RETIRE/duplicate

### Batch 34 — R4b-rust-it-capacity-capture-replay: retire 2 duplicate file(s)

Deletes 6 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/api/tests/capacity_harness.rs` — 3 — RETIRE/duplicate
- `apps/api/tests/live_capacity_isolation.rs` — 3 — RETIRE/duplicate

### Batch 35 — T1-e2e-tool-specs: retire 2 duplicate file(s)

Deletes 0 runner-counted cases (+2 file(s) with no runner count). One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/dashboard-e2e/tools/mutations.spec.mjs` — pending — RETIRE/duplicate
- `apps/dashboard-e2e/tools/negative-controls.spec.mjs` — pending — RETIRE/duplicate

### Batch 36 — T1-playwright-specs: retire 4 duplicate file(s)

Deletes 15 runner-counted cases. One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `apps/dashboard-e2e/src/e2e/app-loads.spec.ts` — 1 — RETIRE/duplicate — **SAME COMMIT: playwright.config.ts:31 + manifest**
- `apps/dashboard-e2e/src/e2e/broker-grouping.spec.ts` — 4 — RETIRE/duplicate — **SAME COMMIT: playwright.config.ts:32 + manifest**
- `apps/dashboard-e2e/src/e2e/broker.spec.ts` — 4 — RETIRE/duplicate — **SAME COMMIT: playwright.config.ts:33 + manifest**
- `apps/dashboard-e2e/src/e2e/desk-and-read.spec.ts` — 6 — RETIRE/duplicate — **SAME COMMIT: playwright.config.ts:35 + manifest**

### Batch 37 — T1-supply-chain-specs: retire 1 duplicate file(s)

Deletes 0 runner-counted cases (+1 file(s) with no runner count). One `RETIRED:` line per file in `.spire/clusters/tech/state/RETIRED.md`.

- `tools/supply-chain/cli.integration.spec.mjs` — pending — RETIRE/duplicate

### Batch 38 — A7-root-structural-lib: trim/consolidate 8 file(s) (part 1/2)

120 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/A7-root-structural-lib.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/dashboard/src/app/app.risk.spec.tsx` — 22 — TRIM/structure — reconciled (see audit.csv evidence)
- `apps/dashboard/src/app/batch-backtest-cli.structural.spec.ts` — 16 — TRIM/structure
- `apps/dashboard/src/app/chain-archive-object-store.structural.spec.ts` — 14 — CONSOLIDATE/duplicate
- `apps/dashboard/src/app/chain-snapshot-capture.structural.spec.ts` — 10 — CONSOLIDATE/duplicate
- `apps/dashboard/src/app/curvature-v2-deny-list.structural.spec.ts` — 4 — TRIM/structure
- `apps/dashboard/src/app/curvature-v2-landing-and-site.structural.spec.ts` — 25 — TRIM/structure
- `apps/dashboard/src/app/liquid-names-session-capture.structural.spec.ts` — 13 — CONSOLIDATE/duplicate
- `apps/dashboard/src/app/massive-flat-file-keep.structural.spec.ts` — 16 — CONSOLIDATE/duplicate

### Batch 39 — A7-root-structural-lib: trim/consolidate 8 file(s) (part 2/2)

107 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/A7-root-structural-lib.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/dashboard/src/app/replay-outcome-join.structural.spec.ts` — 15 — CONSOLIDATE/duplicate
- `apps/dashboard/src/app/research-lab-surface.structural.spec.ts` — 10 — TRIM/duplicate
- `apps/dashboard/src/app/route-boundaries.structural.spec.ts` — 6 — TRIM/structure
- `apps/dashboard/src/app/session-chain-archive.structural.spec.ts` — 13 — CONSOLIDATE/duplicate
- `apps/dashboard/src/app/session-day-tape-capture.structural.spec.ts` — 19 — CONSOLIDATE/duplicate
- `libs/api/src/lib/broker.spec.ts` — 6 — TRIM/structure
- `libs/api/src/lib/contract-authority.spec.ts` — 7 — TRIM/structure
- `libs/api/src/lib/convexa.spec.ts` — 31 — TRIM/structure

### Batch 40 — R4a-rust-it-contracts-guardrails: trim/consolidate 8 file(s) (part 1/3)

295 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/R4a-rust-it-contracts-guardrails.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/api/tests/api_contract_gate_isolation.rs` — 8 — TRIM/structure
- `apps/api/tests/api_contract_parity.rs` — 232 — TRIM/structure
- `apps/api/tests/api_contract_policy.rs` — 5 — TRIM/structure — reconciled (see audit.csv evidence)
- `apps/api/tests/api_contract_router.rs` — 7 — TRIM/structure
- `apps/api/tests/api_contract_runtime_auth_research.rs` — 7 — TRIM/duplicate
- `apps/api/tests/api_contract_runtime_market_stream.rs` — 5 — TRIM/duplicate
- `apps/api/tests/archive_coverage_guardrails_isolation.rs` — 12 — TRIM/duplicate
- `apps/api/tests/archive_coverage_runtime.rs` — 19 — TRIM/duplicate

### Batch 41 — R4a-rust-it-contracts-guardrails: trim/consolidate 8 file(s) (part 2/3)

42 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/R4a-rust-it-contracts-guardrails.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/api/tests/candidate_isolation.rs` — 5 — TRIM/duplicate
- `apps/api/tests/postgres_release_safety_isolation.rs` — 6 — TRIM/structure
- `apps/api/tests/production_runtime_guardrails.rs` — 3 — TRIM/duplicate
- `apps/api/tests/production_runtime_guardrails_isolation.rs` — 12 — TRIM/duplicate
- `apps/api/tests/research_isolation.rs` — 5 — TRIM/structure
- `libs/quant-engine/tests/golden.rs` — 3 — CONSOLIDATE/duplicate — reconciled (see audit.csv evidence)
- `libs/quant-engine/tests/scalar_gex.rs` — 8 — TRIM/duplicate — reconciled (see audit.csv evidence)
- `apps/api/tests/postgres_release_safety_postgres.rs` — pending — TRIM/structure

### Batch 42 — R4a-rust-it-contracts-guardrails: trim/consolidate 1 file(s) (part 3/3)

0 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/R4a-rust-it-contracts-guardrails.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/api/tests/production_runtime_guardrails_postgres.rs` — pending — TRIM/structure

### Batch 43 — A1-ticker-ai-rec: trim/consolidate 8 file(s) (part 1/2)

201 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/A1-ticker-ai-rec.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AiRecPanel.reasoning.spec.tsx` — 10 — TRIM/structure
- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AnalysisSurface.spec.tsx` — 21 — TRIM/structure
- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/DecisionCard.spec.tsx` — 28 — TRIM/structure — reconciled (see audit.csv evidence)
- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/NumbersSaidStrip.spec.tsx` — 9 — TRIM/duplicate
- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/StateExportDrawer.spec.tsx` — 8 — TRIM/structure
- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/ai-rec.absence.spec.tsx` — 20 — TRIM/duplicate
- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/ai-rec.grounding.spec.tsx` — 32 — TRIM/duplicate — reconciled (see audit.csv evidence)
- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/ai-rec.risk.spec.tsx` — 73 — TRIM/duplicate

### Batch 44 — A1-ticker-ai-rec: trim/consolidate 8 file(s) (part 2/2)

158 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/A1-ticker-ai-rec.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/bannedWords.scan.spec.ts` — 6 — TRIM/duplicate
- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/copy.plan.spec.ts` — 8 — TRIM/structure
- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/decisionCard.structural.spec.ts` — 8 — TRIM/duplicate
- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/literals.spec.ts` — 53 — CONSOLIDATE/duplicate
- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/planLiterals.spec.ts` — 7 — TRIM/duplicate
- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/planScopeCaption.spec.ts` — 8 — CONSOLIDATE/structure
- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/presentationPolicy.spec.ts` — 32 — CONSOLIDATE/duplicate
- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/readLayout.render.spec.tsx` — 36 — TRIM/structure

### Batch 45 — A2-ticker-other: trim/consolidate 8 file(s) (part 1/4)

94 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/A2-ticker-other.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/dashboard/src/app/pages/ticker/sessionTapeStanding.spec.ts` — 13 — TRIM/duplicate
- `apps/dashboard/src/app/pages/ticker/single-name-caveat.spec.tsx` — 8 — TRIM/duplicate
- `apps/dashboard/src/app/pages/ticker/ticker-desk-composition.spec.tsx` — 10 — TRIM/structure
- `apps/dashboard/src/app/pages/ticker/ticker-invariants.spec.tsx` — 2 — TRIM/duplicate
- `apps/dashboard/src/app/pages/ticker/ticker.risk.spec.tsx` — 21 — TRIM/structure
- `apps/dashboard/src/app/pages/ticker/connection/ConnectionChip.spec.tsx` — 19 — TRIM/structure
- `apps/dashboard/src/app/pages/ticker/connection/connectionState.spec.ts` — 13 — TRIM/structure
- `apps/dashboard/src/app/pages/ticker/recentTickers/store.spec.ts` — 8 — TRIM/structure

### Batch 46 — A2-ticker-other: trim/consolidate 8 file(s) (part 2/4)

112 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/A2-ticker-other.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/dashboard/src/app/pages/ticker/widgets/quiet-band.register.spec.tsx` — 12 — TRIM/structure
- `apps/dashboard/src/app/pages/ticker/widgets/_kit/FigureCell.spec.tsx` — 22 — TRIM/structure
- `apps/dashboard/src/app/pages/ticker/widgets/_kit/TintChip.spec.tsx` — 6 — TRIM/structure
- `apps/dashboard/src/app/pages/ticker/widgets/_kit/copy.spec.ts` — 21 — TRIM/structure
- `apps/dashboard/src/app/pages/ticker/widgets/_kit/distanceToLevel.spec.ts` — 7 — TRIM/duplicate
- `apps/dashboard/src/app/pages/ticker/widgets/chrome/CommandDeck.spec.tsx` — 29 — TRIM/duplicate
- `apps/dashboard/src/app/pages/ticker/widgets/chrome/TapePulseStrip.spec.tsx` — 11 — TRIM/structure
- `apps/dashboard/src/app/pages/ticker/widgets/chrome/TickerHeader.liveStatus.spec.ts` — 4 — TRIM/duplicate

### Batch 47 — A2-ticker-other: trim/consolidate 8 file(s) (part 3/4)

108 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/A2-ticker-other.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/dashboard/src/app/pages/ticker/widgets/fresh-positioning/FreshPositioning.spec.tsx` — 2 — TRIM/structure
- `apps/dashboard/src/app/pages/ticker/widgets/dealer-flow-projection/DealerFlowProjection.spec.tsx` — 5 — TRIM/duplicate
- `apps/dashboard/src/app/pages/ticker/widgets/iv-rank/IvRank.spec.tsx` — 14 — TRIM/risk-gone
- `apps/dashboard/src/app/pages/ticker/widgets/level-ladder/LadderFoot.spec.tsx` — 5 — TRIM/structure
- `apps/dashboard/src/app/pages/ticker/widgets/level-ladder/ladderModel.spec.ts` — 23 — TRIM/structure
- `apps/dashboard/src/app/pages/ticker/widgets/live-tape/LiveTape.spec.tsx` — 17 — TRIM/structure
- `apps/dashboard/src/app/pages/ticker/widgets/market-context/MarketContext.spec.tsx` — 11 — TRIM/duplicate
- `apps/dashboard/src/app/pages/ticker/widgets/read-strip/readStripModel.spec.ts` — 31 — TRIM/structure

### Batch 48 — A2-ticker-other: trim/consolidate 2 file(s) (part 4/4)

28 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/A2-ticker-other.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/dashboard/src/app/pages/ticker/widgets/straddle-move/StraddleMove.spec.tsx` — 12 — TRIM/structure
- `apps/dashboard/src/app/pages/ticker/widgets/structure-hero/StructureHeroPanel.spec.tsx` — 16 — TRIM/duplicate

### Batch 49 — A3a-trading-positions: trim/consolidate 8 file(s) (part 1/3)

142 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/A3a-trading-positions.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/dashboard/src/app/features/trading/positions/bannerRegion.spec.tsx` — 9 — TRIM/structure
- `apps/dashboard/src/app/features/trading/positions/defaults.spec.ts` — 21 — TRIM/structure
- `apps/dashboard/src/app/features/trading/positions/derive.spec.ts` — 19 — TRIM/duplicate
- `apps/dashboard/src/app/features/trading/positions/evalSubject.spec.ts` — 11 — TRIM/structure
- `apps/dashboard/src/app/features/trading/positions/faulted.a11y.spec.tsx` — 24 — TRIM/structure
- `apps/dashboard/src/app/features/trading/positions/faulted.spec.tsx` — 17 — TRIM/structure
- `apps/dashboard/src/app/features/trading/positions/legDisclosure.spec.tsx` — 14 — TRIM/structure
- `apps/dashboard/src/app/features/trading/positions/maxLoss.spec.ts` — 27 — TRIM/duplicate

### Batch 50 — A3a-trading-positions: trim/consolidate 8 file(s) (part 2/3)

134 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/A3a-trading-positions.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/dashboard/src/app/features/trading/positions/maxLossCell.spec.tsx` — 7 — TRIM/structure
- `apps/dashboard/src/app/features/trading/positions/positionCard.spec.tsx` — 11 — TRIM/structure
- `apps/dashboard/src/app/features/trading/positions/positions.risk.spec.tsx` — 32 — TRIM/structure
- `apps/dashboard/src/app/features/trading/positions/readonly.spec.tsx` — 7 — TRIM/duplicate
- `apps/dashboard/src/app/features/trading/positions/structure.spec.ts` — 42 — TRIM/structure
- `apps/dashboard/src/app/features/trading/positions/tint.spec.tsx` — 13 — TRIM/structure
- `apps/dashboard/src/app/features/trading/positions/usePortfolio.views.spec.tsx` — 16 — TRIM/duplicate
- `apps/dashboard/src/app/features/trading/positions/useTrends.spec.ts` — 6 — TRIM/structure

### Batch 51 — A3a-trading-positions: trim/consolidate 1 file(s) (part 3/3)

30 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/A3a-trading-positions.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/dashboard/src/app/features/trading/positions/view.spec.ts` — 30 — CONSOLIDATE/structure

### Batch 52 — A3b-trading-broker-orders-outcomes: trim/consolidate 8 file(s) (part 1/3)

161 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/A3b-trading-broker-orders-outcomes.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/dashboard/src/app/features/trading/multiLegEntry.spec.tsx` — 17 — TRIM/structure
- `apps/dashboard/src/app/features/trading/model/store.spec.ts` — 7 — TRIM/duplicate — reconciled (see audit.csv evidence)
- `apps/dashboard/src/app/features/trading/orders/engine.spec.ts` — 17 — TRIM/duplicate
- `apps/dashboard/src/app/features/trading/orders/store.spec.ts` — 9 — TRIM/structure
- `apps/dashboard/src/app/features/trading/broker/BrokerGroupHeader.spec.tsx` — 36 — TRIM/duplicate
- `apps/dashboard/src/app/features/trading/broker/BrokerTabPanel.spec.tsx` — 18 — TRIM/duplicate
- `apps/dashboard/src/app/features/trading/broker/broker.risk.spec.tsx` — 28 — CONSOLIDATE/duplicate
- `apps/dashboard/src/app/features/trading/broker/brokerView.spec.ts` — 29 — TRIM/structure

### Batch 53 — A3b-trading-broker-orders-outcomes: trim/consolidate 8 file(s) (part 2/3)

204 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/A3b-trading-broker-orders-outcomes.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/dashboard/src/app/features/trading/broker/genericOptionRow.spec.tsx` — 29 — TRIM/duplicate
- `apps/dashboard/src/app/features/trading/broker/grouping.integration.spec.tsx` — 23 — TRIM/duplicate
- `apps/dashboard/src/app/features/trading/broker/grouping.spec.ts` — 31 — TRIM/structure
- `apps/dashboard/src/app/features/trading/broker/renderState.spec.ts` — 16 — TRIM/duplicate
- `apps/dashboard/src/app/features/trading/outcomes/archive.spec.ts` — 24 — TRIM/duplicate
- `apps/dashboard/src/app/features/trading/outcomes/boundaries.spec.ts` — 28 — TRIM/structure
- `apps/dashboard/src/app/features/trading/outcomes/copy.spec.ts` — 10 — TRIM/structure
- `apps/dashboard/src/app/features/trading/outcomes/ledger.spec.ts` — 43 — TRIM/duplicate

### Batch 54 — A3b-trading-broker-orders-outcomes: trim/consolidate 1 file(s) (part 3/3)

28 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/A3b-trading-broker-orders-outcomes.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/dashboard/src/app/features/trading/outcomes/track-record.flow.spec.tsx` — 28 — TRIM/duplicate

### Batch 55 — A4-auth-alerts: trim/consolidate 8 file(s) (part 1/2)

80 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/A4-auth-alerts.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/dashboard/src/app/features/alerts/store.spec.ts` — 9 — TRIM/duplicate
- `apps/dashboard/src/app/features/auth/RequireAuth.spec.tsx` — 7 — TRIM/structure
- `apps/dashboard/src/app/features/auth/aiProviderLabels.spec.ts` — 8 — TRIM/duplicate
- `apps/dashboard/src/app/features/auth/aiProviders.flow.spec.tsx` — 9 — TRIM/structure
- `apps/dashboard/src/app/features/auth/auth.risk.spec.tsx` — 13 — TRIM/structure
- `apps/dashboard/src/app/features/auth/brokerageSection.spec.tsx` — 7 — TRIM/structure
- `apps/dashboard/src/app/features/auth/firstPaintTheme.spec.ts` — 15 — TRIM/risk-gone
- `apps/dashboard/src/app/features/auth/riskInputs.spec.tsx` — 12 — TRIM/duplicate

### Batch 56 — A4-auth-alerts: trim/consolidate 3 file(s) (part 2/2)

23 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/A4-auth-alerts.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/dashboard/src/app/features/auth/settings.register.spec.tsx` — 15 — TRIM/structure
- `apps/dashboard/src/app/features/auth/theme-color.spec.tsx` — 3 — TRIM/duplicate
- `apps/dashboard/src/app/features/auth/useSettings.spec.tsx` — 5 — CONSOLIDATE/duplicate

### Batch 57 — A5-shared-shell-theme: trim/consolidate 8 file(s) (part 1/3)

69 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/A5-shared-shell-theme.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/dashboard/src/app/shell/AppShell.footer.spec.tsx` — 11 — TRIM/structure
- `apps/dashboard/src/app/shell/AppShell.keyboard.spec.tsx` — 3 — TRIM/duplicate
- `apps/dashboard/src/app/shell/TopNav.spec.tsx` — 12 — TRIM/duplicate — reconciled (see audit.csv evidence)
- `apps/dashboard/src/app/shared/a11y/modalFocusHandoff.spec.tsx` — 8 — TRIM/structure
- `apps/dashboard/src/app/shared/copy/disclaimer.spec.tsx` — 5 — TRIM/structure
- `apps/dashboard/src/app/shared/figure/figureState.spec.ts` — 17 — TRIM/structure
- `apps/dashboard/src/app/shared/hooks/usePollingResource.spec.tsx` — 7 — TRIM/structure
- `apps/dashboard/src/app/shared/theme/focus-visible.spec.tsx` — 6 — TRIM/structure

### Batch 58 — A5-shared-shell-theme: trim/consolidate 8 file(s) (part 2/3)

80 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/A5-shared-shell-theme.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/dashboard/src/app/shared/theme/fonts.spec.ts` — 14 — TRIM/structure
- `apps/dashboard/src/app/shared/theme/stage3-amber.spec.ts` — 17 — TRIM/structure
- `apps/dashboard/src/app/shared/theme/steel2-contrast.spec.ts` — 6 — CONSOLIDATE/duplicate
- `apps/dashboard/src/app/shared/theme/text-dim-contrast.spec.ts` — 4 — CONSOLIDATE/duplicate
- `apps/dashboard/src/app/shared/theme/text-info-contrast.spec.ts` — 6 — CONSOLIDATE/duplicate
- `apps/dashboard/src/app/shared/theme/token-parity.spec.ts` — 5 — TRIM/duplicate
- `apps/dashboard/src/app/shell/CommandPalette/CommandPalette.spec.tsx` — 14 — TRIM/structure
- `apps/dashboard/src/app/shell/CommandPalette/format.spec.ts` — 14 — CONSOLIDATE/duplicate

### Batch 59 — A5-shared-shell-theme: trim/consolidate 4 file(s) (part 3/3)

34 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/A5-shared-shell-theme.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/dashboard/src/app/shell/CommandPalette/palette.flow.spec.tsx` — 5 — TRIM/duplicate
- `apps/dashboard/src/app/shared/charts/structure-field/StructureFieldCanvas.spec.tsx` — 3 — TRIM/structure
- `apps/dashboard/src/app/shared/charts/structure-field/paintStep.spec.ts` — 7 — TRIM/structure
- `apps/dashboard/src/app/shared/ui/Widget/Widget.spec.tsx` — 19 — TRIM/structure

### Batch 60 — A6-pages-other: trim/consolidate 8 file(s) (part 1/3)

94 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/A6-pages-other.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/dashboard/src/app/pages/alerts/alerts.risk.spec.tsx` — 23 — TRIM/structure
- `apps/dashboard/src/app/pages/blog/blog.spec.tsx` — 6 — TRIM/structure
- `apps/dashboard/src/app/pages/methodology/copy.spec.ts` — 26 — TRIM/structure
- `apps/dashboard/src/app/pages/methodology/methodology.spec.tsx` — 8 — TRIM/structure
- `apps/dashboard/src/app/pages/not-found/not-found.spec.tsx` — 4 — TRIM/structure
- `apps/dashboard/src/app/pages/landing/HeroCurve.spec.tsx` — 8 — TRIM/structure
- `apps/dashboard/src/app/pages/landing/landing-samples.spec.tsx` — 11 — TRIM/structure
- `apps/dashboard/src/app/pages/landing/landing.spec.tsx` — 8 — TRIM/structure

### Batch 61 — A6-pages-other: trim/consolidate 8 file(s) (part 2/3)

50 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/A6-pages-other.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/dashboard/src/app/pages/operator-session-archive/OperatorSessionArchive.spec.tsx` — 7 — TRIM/duplicate
- `apps/dashboard/src/app/pages/operator-session-archive/OperatorSessionArchive.states.spec.tsx` — 12 — TRIM/duplicate
- `apps/dashboard/src/app/pages/operator-session-archive/copy.spec.ts` — 6 — TRIM/structure
- `apps/dashboard/src/app/pages/operator-session-archive/digest.spec.ts` — 2 — TRIM/structure
- `apps/dashboard/src/app/pages/operator-session-archive/occupancy.spec.ts` — 6 — TRIM/duplicate
- `apps/dashboard/src/app/pages/operator-session-archive/researchClient.spec.ts` — 6 — TRIM/duplicate
- `apps/dashboard/src/app/pages/operator-session-archive/schedule.spec.ts` — 6 — TRIM/structure
- `apps/dashboard/src/app/pages/operator-session-archive/useSessionArchive.spec.tsx` — 5 — TRIM/duplicate

### Batch 62 — A6-pages-other: trim/consolidate 6 file(s) (part 3/3)

168 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/A6-pages-other.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/dashboard/src/app/pages/operator-session-archive/viewModel.spec.ts` — 20 — TRIM/duplicate
- `apps/dashboard/src/app/pages/scanner/format.spec.ts` — 30 — TRIM/duplicate
- `apps/dashboard/src/app/pages/scanner/scanner.register.spec.tsx` — 53 — TRIM/duplicate
- `apps/dashboard/src/app/pages/scanner/scanner.risk.spec.tsx` — 33 — TRIM/structure
- `apps/dashboard/src/app/pages/positions/positions-page.spec.tsx` — 17 — TRIM/duplicate
- `apps/dashboard/src/app/pages/positions/positions.integration.spec.tsx` — 15 — TRIM/structure — reconciled (see audit.csv evidence)

### Batch 63 — R1-rust-security-contracts: trim/consolidate 8 file(s) (part 1/3)

91 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/R1-rust-security-contracts.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/api/src/config.rs` — 16 — TRIM/duplicate
- `apps/api/src/main.rs` — 28 — TRIM/structure
- `apps/api/src/openapi.rs` — 9 — TRIM/duplicate — reconciled (see audit.csv evidence)
- `apps/api/src/routes/auth.rs` — 5 — TRIM/duplicate
- `apps/api/src/routes/contract_router.rs` — 4 — TRIM/structure
- `apps/api/src/routes/health.rs` — 13 — TRIM/structure
- `apps/api/src/routes/research_chain_snapshots.rs` — 5 — TRIM/structure
- `apps/api/src/routes/research_flat_files.rs` — 11 — TRIM/duplicate

### Batch 64 — R1-rust-security-contracts: trim/consolidate 8 file(s) (part 2/3)

77 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/R1-rust-security-contracts.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/api/src/routes/research_session_books.rs` — 11 — TRIM/structure
- `apps/api/src/routes/research_session_coverage.rs` — 12 — TRIM/duplicate
- `apps/api/src/routes/research_session_day_tape.rs` — 17 — TRIM/duplicate
- `apps/api/src/routes/scan.rs` — 3 — TRIM/duplicate
- `apps/api/src/routes/stream.rs` — 19 — TRIM/duplicate
- `apps/api/src/runtime_guardrails/config.rs` — 7 — TRIM/duplicate
- `apps/api/src/services/auth/cookies.rs` — 4 — TRIM/structure
- `apps/api/src/services/auth/crypto.rs` — 4 — TRIM/structure

### Batch 65 — R1-rust-security-contracts: trim/consolidate 1 file(s) (part 3/3)

19 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/R1-rust-security-contracts.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/api/src/state.rs` — 19 — TRIM/risk-gone

### Batch 66 — R2-rust-money-math-parsers: trim/consolidate 8 file(s) (part 1/4)

57 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/R2-rust-money-math-parsers.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/api/src/domain/market.rs` — 6 — CONSOLIDATE/duplicate
- `apps/api/src/domain/nyse_full_day.rs` — 14 — TRIM/duplicate
- `apps/api/src/infrastructure/flatfiles/client.rs` — 5 — TRIM/duplicate
- `apps/api/src/infrastructure/flatfiles/credentials.rs` — 6 — CONSOLIDATE/duplicate
- `apps/api/src/infrastructure/flatfiles/sigv4.rs` — 4 — TRIM/structure
- `apps/api/src/infrastructure/massive/market_phase.rs` — 3 — CONSOLIDATE/duplicate
- `apps/api/src/infrastructure/massive/ws.rs` — 6 — TRIM/structure
- `apps/api/src/services/analytics.rs` — 13 — TRIM/duplicate

### Batch 67 — R2-rust-money-math-parsers: trim/consolidate 8 file(s) (part 2/4)

79 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/R2-rust-money-math-parsers.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/api/src/services/live_capacity.rs` — 8 — CONSOLIDATE/duplicate
- `apps/api/src/services/llm.rs` — 13 — CONSOLIDATE/duplicate
- `apps/api/src/services/llm_catalog.rs` — 7 — CONSOLIDATE/duplicate
- `apps/api/src/services/market_data/mod.rs` — 4 — TRIM/duplicate — reconciled (see audit.csv evidence)
- `apps/api/src/services/rec_inputs/cap_check.rs` — 6 — CONSOLIDATE/duplicate
- `apps/api/src/services/rec_inputs/cited.rs` — 7 — CONSOLIDATE/duplicate
- `apps/api/src/services/rec_inputs/field_reasons.rs` — 16 — CONSOLIDATE/duplicate
- `apps/api/src/services/rec_inputs/grounding.rs` — 18 — TRIM/duplicate

### Batch 68 — R2-rust-money-math-parsers: trim/consolidate 8 file(s) (part 3/4)

72 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/R2-rust-money-math-parsers.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/api/src/services/rec_inputs/max_risk.rs` — 9 — TRIM/duplicate
- `apps/api/src/services/recommendation.rs` — 25 — TRIM/structure
- `apps/api/src/services/scanner/mod.rs` — 3 — CONSOLIDATE/duplicate
- `apps/api/src/services/scanner/store.rs` — 15 — CONSOLIDATE/duplicate
- `libs/quant-engine/src/candidates.rs` — 9 — TRIM/duplicate
- `libs/quant-engine/src/gamma_flip.rs` — 3 — TRIM/duplicate
- `libs/quant-engine/src/gex.rs` — 4 — TRIM/duplicate — reconciled (see audit.csv evidence)
- `libs/quant-engine/src/greeks.rs` — 4 — TRIM/duplicate

### Batch 69 — R2-rust-money-math-parsers: trim/consolidate 4 file(s) (part 4/4)

22 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/R2-rust-money-math-parsers.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `libs/quant-engine/src/iv_structure.rs` — 7 — TRIM/structure
- `libs/quant-engine/src/signals.rs` — 3 — TRIM/duplicate
- `libs/quant-engine/src/soa.rs` — 6 — TRIM/duplicate — reconciled (see audit.csv evidence)
- `libs/quant-engine/src/vol_gex.rs` — 6 — CONSOLIDATE/duplicate

### Batch 70 — R3a-rust-research-tape-archive: trim/consolidate 8 file(s) (part 1/4)

73 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/R3a-rust-research-tape-archive.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/api/src/services/day_tape/cli.rs` — 8 — CONSOLIDATE/duplicate
- `apps/api/src/services/day_tape/construct.rs` — 11 — TRIM/structure
- `apps/api/src/services/day_tape/fs.rs` — 5 — TRIM/duplicate
- `apps/api/src/services/day_tape/occupancy.rs` — 15 — TRIM/duplicate
- `apps/api/src/services/day_tape/path_a.rs` — 12 — TRIM/duplicate — reconciled (see audit.csv evidence)
- `apps/api/src/services/day_tape/path_b.rs` — 8 — TRIM/duplicate
- `apps/api/src/services/day_tape/player.rs` — 12 — TRIM/duplicate
- `apps/api/src/services/day_tape/replay_occupancy.rs` — 2 — TRIM/structure

### Batch 71 — R3a-rust-research-tape-archive: trim/consolidate 8 file(s) (part 2/4)

92 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/R3a-rust-research-tape-archive.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/api/src/services/day_tape/replay_timeline.rs` — 5 — TRIM/duplicate
- `apps/api/src/services/day_tape/store.rs` — 5 — TRIM/structure
- `apps/api/src/services/day_tape/watchlist.rs` — 2 — TRIM/duplicate
- `apps/api/src/services/research/artifact.rs` — 17 — TRIM/structure/duplicate
- `apps/api/src/services/research/batch_backtest.rs` — 26 — TRIM/structure/duplicate — reconciled (see audit.csv evidence)
- `apps/api/src/services/research/candidates.rs` — 14 — TRIM/structure
- `apps/api/src/services/research/comparison.rs` — 17 — TRIM/duplicate
- `apps/api/src/services/research/derivation.rs` — 6 — TRIM/structure/duplicate

### Batch 72 — R3a-rust-research-tape-archive: trim/consolidate 8 file(s) (part 3/4)

96 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/R3a-rust-research-tape-archive.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/api/src/services/research/fixtures.rs` — 7 — TRIM/duplicate
- `apps/api/src/services/research/labels.rs` — 4 — TRIM/structure
- `apps/api/src/services/research/outcomes.rs` — 4 — TRIM/structure
- `apps/api/src/services/research/render.rs` — 13 — TRIM/structure/duplicate
- `apps/api/src/services/research/replay_outcome_join.rs` — 18 — TRIM/structure
- `apps/api/src/services/research/run.rs` — 9 — CONSOLIDATE/duplicate
- `apps/api/src/services/research/vocabulary.rs` — 10 — TRIM/structure/duplicate
- `apps/api/src/services/session_chain_archive/coverage/matrix.rs` — 31 — TRIM/duplicate

### Batch 73 — R3a-rust-research-tape-archive: trim/consolidate 6 file(s) (part 4/4)

65 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/R3a-rust-research-tape-archive.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/api/src/services/session_chain_archive/coverage/policy.rs` — 15 — TRIM/risk-gone/duplicate/structure
- `apps/api/src/services/session_chain_archive/ensure.rs` — 16 — TRIM/risk-gone/duplicate
- `apps/api/src/services/session_chain_archive/ensure_worker.rs` — 8 — TRIM/duplicate
- `apps/api/src/services/session_chain_archive/market_calendar.rs` — 11 — TRIM/structure/duplicate
- `apps/api/src/services/session_chain_archive/migrate.rs` — 2 — TRIM/risk-gone
- `apps/api/src/services/session_chain_archive/store.rs` — 13 — TRIM/duplicate/structure

### Batch 74 — R3b-rust-flatfile-snapshot-capacity: trim/consolidate 8 file(s) (part 1/3)

37 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/R3b-rust-flatfile-snapshot-capacity.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/api/src/capacity/identity.rs` — 3 — TRIM/structure
- `apps/api/src/capacity/runner.rs` — 10 — TRIM/structure
- `apps/api/src/services/capacity_harness/clients.rs` — 3 — TRIM/structure
- `apps/api/src/services/capacity_harness/evidence.rs` — 5 — CONSOLIDATE/duplicate
- `apps/api/src/services/capacity_harness/overflow.rs` — 3 — TRIM/duplicate
- `apps/api/src/services/capacity_harness/receipt.rs` — 4 — TRIM/structure — reconciled (see audit.csv evidence)
- `apps/api/src/services/capacity_harness/run.rs` — 6 — TRIM/duplicate — reconciled (see audit.csv evidence)
- `apps/api/src/services/capacity_harness/standing.rs` — 3 — TRIM/structure

### Batch 75 — R3b-rust-flatfile-snapshot-capacity: trim/consolidate 8 file(s) (part 2/3)

73 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/R3b-rust-flatfile-snapshot-capacity.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/api/src/services/capacity_harness/thresholds.rs` — 5 — TRIM/structure
- `apps/api/src/services/chain_snapshot/capture.rs` — 7 — TRIM/structure
- `apps/api/src/services/chain_snapshot/store.rs` — 11 — TRIM/structure
- `apps/api/src/services/chain_snapshot/wire.rs` — 4 — TRIM/duplicate
- `apps/api/src/services/flat_file_keep/cli.rs` — 19 — TRIM/duplicate
- `apps/api/src/services/flat_file_keep/clocks.rs` — 4 — TRIM/duplicate
- `apps/api/src/services/flat_file_keep/keep.rs` — 21 — TRIM/duplicate
- `apps/api/src/services/flat_file_keep/mod.rs` — 2 — TRIM/duplicate

### Batch 76 — R3b-rust-flatfile-snapshot-capacity: trim/consolidate 2 file(s) (part 3/3)

8 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/R3b-rust-flatfile-snapshot-capacity.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/api/src/services/flat_file_keep/store.rs` — 6 — TRIM/duplicate
- `apps/api/src/services/flat_file_keep/watchlist.rs` — 2 — TRIM/duplicate

### Batch 77 — R4b-rust-it-capacity-capture-replay: trim/consolidate 8 file(s) (part 1/3)

68 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/R4b-rust-it-capacity-capture-replay.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/api/tests/batch_backtest_cli.rs` — 2 — TRIM/duplicate
- `apps/api/tests/batch_backtest_isolation.rs` — 4 — TRIM/structure/duplicate
- `apps/api/tests/capacity_baseline_isolation.rs` — 31 — TRIM/duplicate/structure
- `apps/api/tests/capacity_cli.rs` — 5 — TRIM/duplicate
- `apps/api/tests/capacity_clients.rs` — 3 — TRIM/duplicate
- `apps/api/tests/capacity_identity.rs` — 7 — TRIM/duplicate/structure
- `apps/api/tests/capacity_isolation.rs` — 10 — TRIM/structure/duplicate — reconciled (see audit.csv evidence)
- `apps/api/tests/capacity_manifest_report.rs` — 6 — TRIM/duplicate/risk-gone

### Batch 78 — R4b-rust-it-capacity-capture-replay: trim/consolidate 8 file(s) (part 2/3)

75 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/R4b-rust-it-capacity-capture-replay.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/api/tests/capacity_process.rs` — 12 — TRIM/structure/duplicate
- `apps/api/tests/capacity_resources.rs` — 12 — TRIM/duplicate/structure
- `apps/api/tests/capacity_self_tests.rs` — 8 — TRIM/duplicate/structure
- `apps/api/tests/chain_archive_object_store_isolation.rs` — 10 — TRIM/risk-gone/structure/duplicate
- `apps/api/tests/chain_snapshot_isolation.rs` — 4 — CONSOLIDATE/duplicate
- `apps/api/tests/liquid_names_session_capture_isolation.rs` — 9 — TRIM/structure/duplicate
- `apps/api/tests/massive_flat_file_isolation.rs` — 16 — TRIM/duplicate/structure
- `apps/api/tests/replay_outcome_join_cli.rs` — 4 — TRIM/duplicate — reconciled (see audit.csv evidence)

### Batch 79 — R4b-rust-it-capacity-capture-replay: trim/consolidate 5 file(s) (part 3/3)

47 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/R4b-rust-it-capacity-capture-replay.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/api/tests/replay_outcome_join_isolation.rs` — 4 — TRIM/structure/duplicate
- `apps/api/tests/session_chain_archive_isolation.rs` — 8 — TRIM/duplicate/structure
- `apps/api/tests/session_day_replay.rs` — 9 — TRIM/duplicate
- `apps/api/tests/session_day_replay_isolation.rs` — 14 — TRIM/duplicate/structure — reconciled (see audit.csv evidence)
- `apps/api/tests/session_day_tape_isolation.rs` — 12 — TRIM/duplicate/structure — reconciled (see audit.csv evidence)

### Batch 80 — T1-e2e-tool-specs: trim/consolidate 3 file(s)

0 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/T1-tools-playwright.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/dashboard-e2e/tools/manifest.spec.mjs` — pending — TRIM/duplicate
- `apps/dashboard-e2e/tools/quality-reporter.spec.mjs` — pending — TRIM/structure
- `apps/dashboard-e2e/tools/run-quality.spec.mjs` — pending — TRIM/structure

### Batch 81 — T1-playwright-specs: trim/consolidate 2 file(s)

20 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/T1-tools-playwright.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `apps/dashboard-e2e/src/e2e/curvature-v2.spec.ts` — 14 — TRIM/structure
- `apps/dashboard-e2e/src/e2e/navigation.spec.ts` — 6 — TRIM/duplicate

### Batch 82 — T1-supply-chain-specs: trim/consolidate 7 file(s)

0 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/T1-tools-playwright.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `tools/supply-chain/capabilities.spec.mjs` — pending — TRIM/structure
- `tools/supply-chain/foundation.spec.mjs` — pending — TRIM/structure
- `tools/supply-chain/normalizer.spec.mjs` — pending — TRIM/structure
- `tools/supply-chain/policy.spec.mjs` — pending — TRIM/structure
- `tools/supply-chain/publication.spec.mjs` — pending — TRIM/structure
- `tools/supply-chain/scanner-adapters.spec.mjs` — pending — TRIM/structure
- `tools/supply-chain/workflow-guard.spec.mjs` — pending — TRIM/structure

### Batch 83 — T1-tools-specs: trim/consolidate 1 file(s)

61 cases live in these files today; the exact cases to remove or merge, with before → after counts, are in `areas/T1-tools-playwright.md` (NOTES). Trim-ledger row per file in AUDIT.md.

- `tools/api-contract.spec.mjs` — 61 — TRIM/structure

## Speed-ups of slow kept tests (record time before and after each)

### Batch 84 — A6: OperatorSessionArchive typing cost
`OperatorSessionArchive.states.spec.tsx` (16.3 s / 12 cases) and `OperatorSessionArchive.spec.tsx`: replace the per-keystroke `user.type` of the 21+3-character unlock fields (`states.spec.tsx:70-77`) with `user.paste` / `fireEvent.change`; keep `user.click` for Unlock. Also move `makeRow`/`fakeGate` out of `scanner.risk.spec.tsx` into a non-spec `scanner.testkit.ts` so `scanner.register.spec.tsx:43` stops re-registering all 33 risk cases (runner count 53 = 20 + 33).

### Batch 85 — A3a/A3b: entry-flow typing cost (two commits, one per area)
`positions.risk.spec.tsx` (15.0 s): `userEvent.setup({ delay: null })`; seed via `putPosition` where entry is not under test (`:453`, `:481`, `:579`, `:687`, `:757`). `orders.risk.spec.tsx` (23.2 s): `delay: null`; cases 2 and 5 on a narrow `OrdersWidget` + `useOrderEngine` host (pattern `useOrderEngine.spec.tsx:167-176`).

### Batch 86 — A4: auth typing cost
`auth.risk.spec.tsx` (12.8 s), `aiProviders.flow.spec.tsx` (6.5 s), `brokerageSection.spec.tsx`: `delay: null` + `user.paste` for keys and passwords; pre-import the lazy positions route in `beforeAll`.

### Batch 87 — R1: SSE keep-alive injectable
`apps/api/src/routes/stream.rs:31` keep-alive (5 s) becomes injectable configuration (default 5 s); tests at `:1366` (~30 s), `:1301`, `:1421`, `:1327` use ~50 ms. Likely the critical path of the 30.1 s `src/lib.rs` test binary. Also `[profile.dev.package.argon2] opt-level = 3` (+ `blake2`) for the 9 signup tests (measure first; it is a build-profile change).

### Batch 88 — R4b/R3b: capacity holds
`tests/capacity_load.rs` (28.6 s, kept per reconciliation): short `http_hold_override`/`sse_hold_override` (`run.rs:42-45`); CI's release `capacity load` step keeps the full 20+5 s run. `capacity_baseline_isolation.rs` (8.0 s): `short_hooks` holds 2 s → ~250 ms where the verdict is forced by hooks. `session_day_replay.rs`: `#[tokio::test(start_paused = true)]` where the pump is a `tokio::time::interval`.

### Batch 89 — R2: analytics fixture cost
`services/analytics.rs` five tests parse the 5.7 MB `gex_SPY.json` (`:598`, `:617`, `:644`, `:828`, `:865`): use the 1.2 KB `gex_synthetic_mini.json` or one shared static.

### Batch 90 — T1: api-contract.spec spawn cost
`tools/api-contract.spec.mjs`: set `API_CONTRACT_EXPORT_FIXTURE` (supported, `:637`) for every spawn except one real export; share one `check` result across the determinism and no-write cases. Fix the in-repo `mkdtemp` (`:618`).

## CI (Phase 3 rules; repository is NOT blocked-on-deploy)

### Batch 91 — ci.yml: manual mode, header, timeouts, affected_only
- Header: `# CI mode (2026-10-08): manual. Reason: cost. Restore: push: [main], pull_request.`
- `on: workflow_dispatch` with input `affected_only: {type: boolean, default: false}`; the affected path checks out with `fetch-depth: 0` (already) and runs `nrwl/nx-set-shas` (pinned by SHA + release comment, added to the approved pins `workflow-guard.mjs` reads) then `nx affected -t lint typecheck test build`; the default path stays `nx run-many`.
- `timeout-minutes` (longest of last 10 successful × 1.5, floor 15, cap 45): frontend 37 (24.1 m), backend 45 (30.4 m), capacity-linux 15 (6.7 m). The `supply-chain` job calls a reusable workflow: no timeout (its jobs carry them, batch 93).
- Minutes comments beside each job (estimate at an assumed 8 dispatches/month; raw = Linux-equivalent, ubuntu only).
- SAME COMMIT: `apps/api/tests/api_contract_gate_isolation.rs` (reads ci.yml step names/order), `capacity_baseline_isolation.rs:144-236,485-520`, `capacity_isolation.rs:153` — re-pin to the new text, never delete the check. `workflow-guard.mjs:79-82` requires `ci.yml` to keep calling `supply-chain.yml` with `contract_path: policy` — kept.
- Proof already on file: `nx show projects --affected` is non-empty for `5733ba8c^..5733ba8c` (PROGRESS.md).

### Batch 92 — ci.yml: cut repeated work inside the run
- API contract check runs in frontend (3.0 m) and backend (2.5 m): keep the frontend one.
- Backend builds release twice (capacity load 4.2 m incl. compile; release postgres build 6.0 m): build `--release --features postgres` once and run `capacity load` from that binary (re-pin `capacity_baseline_isolation.rs:485-520` in the same commit).
- Browser engines: cache `~/.cache/ms-playwright` keyed on the Playwright version (pinned `actions/cache`), or run the browser step in the digest-pinned `mcr.microsoft.com/playwright:v1.62.1-noble` image (removes the apt `--with-deps` step that once took 20 minutes, run 37743441304).
- Evidence uploads: `if: always()` + `if-no-files-found: error` turned a bundle-gate failure into four extra red steps (run 36394488155); upload only when the gate step ran (`if: always() && steps.<gate>.outcome != 'skipped'`).
- Once batches retire `tools/ci-resource-guards.spec.mjs`, the two `cargo clean` cycles may be measured for removal (disk is freed up front); keep them unless `df -h` proves headroom.

### Batch 93 — supply-chain.yml: timeouts only
`timeout-minutes: 15` on identity, policy, capabilities, artifacts, aggregate (longest successful 0.3 / 1.1 / 2.1 / 10.0 / 0.3 m). **Mode and cron BLOCKED:** `tools/supply-chain/workflow-guard.mjs:65-70` (a floor guard) requires `push: [main]`, `schedule:` and the dispatch options. Moving it to manual and dropping the weekly cron needs the owner's ruling and a same-commit guard change. Note: with CI manual, the duplicate supply-chain run on every push to `main` disappears by itself.

### Batch 94 — ops workflows: no trigger change (listed)
`conformance.yml` (disabled_manually; `push: main`, daily cron `15 6 * * *`, dispatch; prod-public half hits production), `deploy-smoke.yml` (disabled_manually; `push: main`, dispatch; production), `browser-visual-linux-candidates.yml` (dispatch-only; authorized baseline generation — becomes risk-gone if the owner retires `visual.spec.ts`). Optional, owner's call: `timeout-minutes: 15` on each.

### Batch 95 — root causes of Phase 0 failures
- AC-35/U-32 flake: product race in `AccessibleHelp` (`enterTouchDelay={0}` timer cleared by `touchend`, BACKLOG F-L). The fix belongs to the code, not the test: open on `touchstart`/click for coarse pointers, with a fake-timer RED test in `shared/ui/AccessibleHelp.spec.tsx`. **BLOCKED:** the owner's PR #76 already edits this component (`cc4df79c`); land it there to avoid a conflict.
- Policy job red: F-J advisories, owner-ruled baseline (`DECISION_LEDGER.md:1239`) — no change.
- Bundle gate on a vite bump: correct catch — no change; upload noise fixed in batch 92.
- Deploy smoke paused 503: fixed by `a6a15859`.

## Nx (Phase 4)

### Batch 96 — nx.json inputs, .nxignore, Rust targets
- `targetDefaults.typecheck.inputs` → `["default", "^production"]`. Proven bug: with a TS error in `arc.spec.ts`, cached typecheck exit 0, uncached exit 1 (PROGRESS.md). Re-prove after the change.
- `sharedGlobals` += `{"runtime": "node --version"}` (nx.dev `/docs/reference/inputs`, runtime inputs).
- `.nxignore` += `.spire` (removes the stray `tech` project made from Spire's `project.json`); keep `.worktrees`.
- Rust `api` targets are `nx:run-commands` with `cache: false`: give `api:test` explicit inputs (`apps/api/**`, `libs/quant-engine/**`, `Cargo.toml`, `Cargo.lock`, `{"runtime":"rustc --version"}`) and `cache: true`; capacity targets stay uncached (pinned by `capacity_isolation.rs` `nx_targets_match_public_commands_and_are_uncached`).
- Evidence: `nx graph --file=docs/testing/2026-10/graph.json`; run a target twice and show the second restores from cache. No Nx Cloud (no `nxCloudId` in nx.json; remote cache would need an account — owner decision).

## Verify and hook (Phase 5)

### Batch 97 — npm run verify
`tools/verify.mjs`: `NX_NO_CLOUD=true nx affected -t lint typecheck test --base=$(git merge-base HEAD origin/main)`; then the hermetic guard specs (`node --test` over `tools/**/*.spec.mjs` and `apps/dashboard-e2e/tools/*.spec.mjs`, minus the network/Playwright ones). Target under 2 minutes; measure on a dashboard-only and a Rust-only change.

### Batch 98 — wire the never-run guard proofs (floor gap)
`package.json` `test:tools` glob → recurse into `tools/supply-chain/` and include `apps/dashboard-e2e/tools/`. First fix the four kept reds at their root: `workflow-guard.spec.mjs:24` (live `apps/api/Dockerfile:mutable-image` — the guard flags `FROM scratch`, which pulls nothing; exempt `scratch` with a poison proof), `scanner-adapters.spec.mjs:43` (update to the `convexa-entrypoint` HEALTHCHECK while keeping the non-root assertion), `publication.spec.mjs:200` (root cause not isolated — investigate `sanitize()` vs the fixture), `candidate.spec.mjs:26` (UNSURE: is candidate qualification still used?). Add `npm run test:tools` to the CI frontend job.

### Batch 99 — pre-push hook + run-gate orphan fix + docs
- `tools/hooks/pre-push`: `nx affected -t lint typecheck` only (< 1 minute, measured). Not installed by me: the owner runs `git config core.hooksPath tools/hooks` (no `core.hooksPath` and no `.git/hooks/pre-push` today).
- `apps/dashboard-e2e/tools/run-gate.mjs`: kill the Playwright `webServer` process tree on exit (it orphans Vite on `[::1]:<port>`; reproduced twice).
- README: the verify command and the hook. Root `AGENTS.md` is Spire-owned (`.spire/installation.json`): not edited.

## New behavior tests (floor gaps; one batch per area)

### Batch 100 — R1 auth/security
Session idle and absolute expiry (break B2 found no test: `service.rs:404` `now >= expires_at` / `absolute_expires_at`); broker credential stored as ciphertext and never echoed (`service.rs:986-1035`); book PUT latest-wins (`routes/book.rs:480-503`, Postgres job) and PUT 403/400; paused `/api/price` returns the exact 503 (add to `market_data_paused_no_vendor_contact.rs:118-131`); production CORS rejection of a foreign origin.

### Batch 101 — R2 money and vendor parsers
Massive chain normalizer (`rest.rs:964` `normalize_contract`, `:1028` `compute_atm_iv` with an injected date, `:878` `parse_fast_snapshot`); exact 30-day HV (`hv.rs`, ddof=1, √252); exact VWAP and ±2σ bands (`vwap.rs`); dark-pool bonus capped at 6 and score byte-identical without `off_exchange` (`signals.rs`).

### Batch 102 — R3a/R3b/R4b data writes
`pairing.rs:128` horizon filter; chain-snapshot prune failure neither fails capture nor skips the archive write (`capture.rs:72-76`); `classify_evidence` routed through `classify_with`; replay/tape/keep never pollute the session archive (replace the three vacuous fresh-archive checks); session-day-tape read requires the operator token; connector-poison control that can actually fail (`self_test.rs:140-154`).

### Batch 103 — dashboard money and contracts
`closePosition` realized P/L write (`usePortfolio.ts:516-537`); exact netted `netPl` and summed `capitalAtRisk`; `capital_at_risk` with an ineligible open position (after the owner answers UNSURE); `paintStep` `fmtM`/`gexAt`; `ivRankStripFigure` wire-band authority; `useAiRecommendation` request body; `StateExportDrawer` AC-95 as-sent counts; `brokerBookFromWire` parser; Pages proxy `functions/api/[[path]].ts` `onRequest` 404s (replaces 15 source scans).

### Batch 104 — T1 a11y gate proof
Re-point `apps/dashboard-e2e/tools/a11y-policy.spec.mjs` at the real `src/quality/a11y.ts` (`validateWaivers`, `hasBlockingAxeFinding`), add the `*`-selector case, delete the unused copy `tools/lib/a11y.mjs`.
