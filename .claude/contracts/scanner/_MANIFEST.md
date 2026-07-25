# scanner — pipeline manifest
Entry:        architect-first
Stage:        P2 SHIPPED (sweep worker) — GATE Q PASS 7/7 (de-correlated Sonnet, incl. a LIVE byte-identity
              spot-check). NEXT = system-12 (conformance-doc reconcile) → P3 (read API) GATE U·X.
              (P1 ScanStore SHIPPED — GATE Q PASS 8/8, pushed `7269fa2`.)
Repos:        both (backend worker+store+API [P1–P3] + the Scanner page [P4]) — architect confirmed
Brief:        BRIEF.md present (v1, supersedes the AI-inclusive scope; design authority = the spec)
Design:       docs/superpowers/specs/2026-07-23-scanner-v1-design.md (owner-approved) +
              docs/superpowers/plans/2026-07-23-scanner-01-scanstore.md (P1 no-placeholder plan)
Phases:       P1 ScanStore · P2 worker+snapshot · P3 API+conformance+warm-click+view · P4 frontend
              (sequenced P1→P4, each its own execution contract + GATE Q, like the redesign stages)
Contracts:
  - ARCHITECTURE_CONTRACT.md   locked (2026-07-23; lint 0/0; boundaries + 4 cruxes + phase seams +
    the single-ticker re-justification + PM open questions §10)
  - PRODUCT_CONTRACT.md        locked (2026-07-24; GATE P·X; resolves §10 Q1/Q2/Q4/Q5 as D1–D4;
    defers Q3 copy→UX, Q6 columns→UX, Q7 wire→Interface; 13 risk-tagged ACs; lint 0/0)
  - UX_BLUEPRINT.md            n/a (GATE U·X — deferred to P3/P4; P1–P2 are backend-only)
  - INTERFACE_CONTRACT.md      n/a through P2 (worker has no HTTP surface; wire + scanner.json land at P3)
  - BACKEND_EXECUTION_CONTRACT.md   locked — PHASE P2 (binds Plan 2; worker/snapshot/tiering/blob;
    byte-identity GATE-Q surface). P1 version superseded (P1 shipped + archived in git history).
  - FRONTEND_EXECUTION_CONTRACT.md  NO_UI_CHANGE (P2 backend-only; the /scanner page is P4)
Conformance:  n/a until GATE U·X. **system-12 lands HERE** — the runnable convention is a standalone
              `.claude/tools/conformance/{feature}.json` (precedent: `iv_rank.json`), but the authoring docs
              still say "embed the block." Reconcile BEFORE this feature's GATE U·X or repeat the
              ai-recommendations GATE-Z bounce. See BACKLOG §E system-12.
Open amendments: none
QA (GATE Q):  P2 — QA_REPORT PASS (7/7, de-correlated Sonnet, 2026-07-24): six `_selftest`s GREEN +
              independent tiering anti-herd RED·restore · projection tier==helper + erratum-applied ·
              snapshot ABC · bundle-blob round-trip + PG parity · loop store-outage survival · **LIVE
              byte-identity** (SPY 59/actionable/`4df5c37bd833` worker-absent==present, fresh compute) ·
              0 scoring-file edits · `SCANNER_EMBEDDED`-guard both directions · leaf boundary · secret-scan.
              (P1 — QA_REPORT PASS 8/8, preserved at git `7269fa2`.) P3/P4 QA pending.
Invariant watch (from BRIEF): **revisits the locked "single-ticker, on-demand" decision** (PROJECT_CONTEXT
              §5 — the watchlist scan was dropped for being too slow; the architect MUST re-justify with a
              perf design and keep the scan bounded to an explicit watchlist, never a market sweep) ·
              additive-keeps-score-byte-identical (the scanner CONSUMES scores, never an input) ·
              best-effort-isolated-or-null (a failed ticker degrades its row alone) · live-vs-static-isolation
              (rows are snapshot reads; no per-row SSE fan-out without the architect sizing it) ·
              server-side-gate-enforcement (batch-rec + any watchlist server persistence are gated) ·
              no-real-order-path (display + links only)
Notes:        Standing NEXT since the owner's 2026-07-01 directive (item 5); **displaced 5×** since
              2026-06-25 (ticker-load-experience → user-accounts → the infra program → the AI-enrichment
              pool → iv-rank), never dropped. Effort L.
Last gateway:  P2 EXECUTION opened @ 2026-07-24 — Plan 2 (`docs/superpowers/plans/2026-07-24-scanner-02-worker.md`)
              written no-placeholder; BACKEND_EXECUTION_CONTRACT re-scoped to P2 (backend fast-path, still
              no FE↔BE surface). Two Plan-2 clarifications reviewed + judged consume-not-derive (NOT GATE-Z):
              tier via the shared `compute_opportunity_tier`; flip/wall distances as display transport.
              (Prior: GATE P·X @ 2026-07-24 PRODUCT locked D1–D4; P1 GATE Q PASS.)
