# scanner — pipeline manifest
Entry:        architect-first
Stage:        GATE I — brief written; entry role NOT yet launched (pre-pipeline)
Repos:        both (expected — a scan-slice/batch backend surface + the Scanner page; the architect confirms)
Brief:        BRIEF.md present
Contracts:
  - ARCHITECTURE_CONTRACT.md   n/a (not yet authored — next artifact, GATE A·X)
  - PRODUCT_CONTRACT.md        n/a
  - UX_BLUEPRINT.md            n/a
  - INTERFACE_CONTRACT.md      n/a
  - BACKEND_EXECUTION_CONTRACT.md   n/a
  - FRONTEND_EXECUTION_CONTRACT.md  n/a
Conformance:  n/a until GATE U·X. **system-12 lands HERE** — the runnable convention is a standalone
              `.claude/tools/conformance/{feature}.json` (precedent: `iv_rank.json`), but the authoring docs
              still say "embed the block." Reconcile BEFORE this feature's GATE U·X or repeat the
              ai-recommendations GATE-Z bounce. See BACKLOG §E system-12.
Open amendments: none
QA (GATE Q):  n/a
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
Last gateway:  GATE I @ 2026-07-01 (manifest created 2026-07-16 — the folder predated it, which is why the
              linter ERRORed; state below is unchanged, only now recorded)
