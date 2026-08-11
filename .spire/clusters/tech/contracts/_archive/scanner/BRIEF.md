# scanner — brief (v1, SUPERSEDED the 2026-07-01 AI-inclusive scope 2026-07-23)

> **Authoritative design:** `docs/superpowers/specs/2026-07-23-scanner-v1-design.md` (owner-approved,
> 4 sections, 2026-07-23). **Plan 1 of 4** (the ScanStore layer, complete no-placeholder) at
> `docs/superpowers/plans/2026-07-23-scanner-01-scanstore.md`. This BRIEF seeds the pipeline; the
> spec is the design authority, the ARCHITECTURE_CONTRACT (next) is the build authority.

Goal:            Replace the `/scanner` stub with a real multi-ticker surface — **morning triage
                 first, ambient radar after**: one dense honest table answering "which ticker
                 deserves the deep-dive now?" from live-scored data, every row one click (warm)
                 from the Ticker page. **v1 scope (owner 2026-07-23): NO AI** (AI-seeded views +
                 batch recs deferred to v2). Global **owner-curated tracked universe on the
                 server** (50–100 tickers); **per-account views** are subsets of it; anonymous
                 users get a read-only default view.
Decision impact: N/A (restores the multi-ticker view the product dropped for perf — the trader
                 picks WHICH ticker deserves the deep-dive from a live-scored shortlist instead
                 of guessing). Observed: watchlist persists, rows show real scores, row-click
                 lands warm, sweep age is honest.
Feasibility:     pass WITH the perf re-justification (below) — **approach C** (owner pick): a
                 separate sweep **worker** (2nd process, same image) + a shared **ScanStore**
                 (marketdata/iv-rank store family) + a best-effort **warm-click read-through** of
                 stored bundles. Two-speed sweep: one multi-ticker snapshot poll (~30s → prices +
                 move-detection) + a concurrency-bounded chain sweep through the UNCHANGED
                 `compute_ticker`; move-triggered promotion. The highest Massive plan removes the
                 vendor as the constraint (snapshot has no per-ticker cap; <100 req/s) — the bound
                 is our own engine CPU, held by the pool.
Effort:          L (decomposed into 4 sequenced pipeline phases — see below).
Invariant watch: **Revisits & FORMALLY re-justifies the locked "single-ticker, on-demand"
                 decision (PROJECT_CONTEXT §5)** — approach C IS the perf design (bounded
                 owner-curated universe, budgeted concurrency, move-triggered priority, NO market
                 sweep); narrow the decision at GATE S. · additive-keeps-score-byte-identical (the
                 ScanStore is a one-way leaf; `compute_ticker` unchanged; scanner CONSUMES score/
                 tier, never inputs) · best-effort-isolated-or-null (per-row/per-subsystem
                 degradation; auth carve-out on view WRITES) · live-vs-static-isolation (poll-based
                 rows, declared basis, NO SSE) · server-side-gate-enforcement (view writes) ·
                 no-real-order-path (display + links only) · model-read-carries-its-assumptions
                 (as-of + basis per row + two-speed header) · digested-labels-not-raw-dump (closed
                 enums; no raw series in rows) · theme-token-discipline + the convexa-design skill
                 (data-signal flash exemption; tier emphasis per the amber census; green/red for
                 PRICE DIRECTION only) · no-secrets-in-image (worker config env-injected) ·
                 first persistent scan store (extends the "trading path stays stateless" narrowing).
Phases (4):      **P1 ScanStore** (persistence leaf — Plan 1 written) · **P2 sweep worker** (+ the
                 net-new multi-ticker snapshot provider method; the two-speed loop; tiering/
                 promotion pure logic; heartbeat; bundle-blob write) · **P3 read API** (`/api/scan`,
                 `/api/scan/universe`, `/api/scan/view` server-gated; standalone `scanner.json`
                 conformance; the ticker warm-click read-through) · **P4 frontend** (the `/scanner`
                 table + view editor + 4 states + mobile cards; references `docs/design/DESIGN_SYSTEM.md`
                 — StatTile/TintChip[emphasis]/useFlashOnChange/Widget; joins the 393 no-overflow e2e).
                 Run sequenced (P1→P4), each its own execution contract + GATE Q, like the redesign stages.
⚠ system-12:     **BEFORE P3's GATE U·X**, reconcile the conformance-spec authoring docs (they still
                 say "embed the ```json block"; the standalone `.spire/clusters/tech/state/conformance/{feature}.json`
                 convention is canonical — precedent `iv_rank.json`). Kit-managed framework files →
                 the fix flows back via the kit (BACKLOG §E), not an in-place edit. Skipping it repeats
                 the ai-recommendations GATE-Z bounce.
Context tags:    architecture,features,decisions,ai,data
Entry point:     architect-first — the approach-C shape (worker/store/warm-click/two-speed sweep)
                 + the single-ticker re-justification bound the whole feature; the spec has done the
                 design, the architect RATIFIES it into ARCHITECTURE_CONTRACT.md + the phase seams.
Source:          Owner directive 2026-07-01 item 5 (promoted the queued Track-A scanner) → brainstormed
                 + owner-approved v1 design 2026-07-23 (the spec). Displaced 7× since 2026-06-25, never
                 dropped.
