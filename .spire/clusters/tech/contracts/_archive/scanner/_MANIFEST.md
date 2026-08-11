# scanner — pipeline manifest
Entry:        architect-first
Stage:        **ALL 4 PHASES SHIPPED + GATE Q PASS — AWAITING GATE S (ship/archive).**
              P4 (/scanner page) GATE Q PASS: 75 files/645 tests · lint 29/0 errors (baseline) · tsc/
              typecheck/build clean · e2e 15/15 (incl. /scanner 393px) · `apps/api` diff EMPTY vs `eb478df` ·
              conformance 2/2 live. **13/13 PRODUCT ACs closed across P1–P4; 0 FAIL, 0 UNVERIFIABLE.**
              (P1 8/8 `7269fa2` · P2 7/7 `9d92fed` · P3 PASS `eb478df`.)
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
  - UX_BLUEPRINT.md            locked (P3 GATE U·X — Q6 columns/sort/density/mobile + Q3 freshness copy +
    the 4 states; design authority for P4)
  - INTERFACE_CONTRACT.md      locked (P3 — 4 endpoints: GET /api/scan · /api/scan/universe · GET+PUT
    /api/scan/view [PUT server-gated]; warm-click = boundary in the existing ticker endpoint; binds the
    shipped ScanRow/SweepHeartbeat wire keys; references standalone scanner.json)
  - scanner.json (conformance) locked (standalone flat, iv_rank.json shape; anon sweep = GET /api/scan +
    /api/scan/universe; gated PUT excluded like ai-rec's POST)
  - BACKEND_EXECUTION_CONTRACT.md   locked — PHASE P3 (reads + server-gated view on the settings record +
    ticker warm-click read-through; byte-preserving; GATE-Q surface incl. gated-write RED→GREEN + live
    conformance). P1/P2 versions superseded (shipped, in git history).
  - FRONTEND_EXECUTION_CONTRACT.md  NO_UI_CHANGE (P3 backend+wire only; the /scanner page + libs/api
    fetchers are P4, built against UX_BLUEPRINT + INTERFACE)
Conformance:  P3 authors a standalone `.spire/clusters/tech/state/conformance/scanner.json` (flat schema:
              path_params/query/body/required — the `iv_rank.json` precedent), REFERENCED from
              INTERFACE_CONTRACT. **system-12 handling (owner decision A, 2026-07-24):** scanner is
              unblocked by authoring the canonical standalone convention DIRECTLY (as iv-rank did) rather
              than blocking on the kit-doc fix. The kit-doc/tool reconciliation (COMPRESSOR #3 · delivery-ux ·
              ORCHESTRATOR GATE U·X/Q · contract_lint M7 · interface_conformance regex) stays a deliberate
              framework task in delivery-kit `KIT_BACKLOG.md §B` — NOT rushed mid-feature. GATE Q runs
              `interface_conformance.py` live against scanner.json (the P3 endpoints DO have a FE↔BE surface).
Open amendments: none
QA (GATE Q):  P3 — QA_REPORT PASS (de-correlated Sonnet, 2026-07-26): live conformance `scanner.json` 2/2 +
              `iv_rank.json` regression floor 1/1 · route-order RED·restore · **gated WRITE** (cookieless 403,
              persists nothing; signed-in 200+persists; 422 off-universe/bad-enum/empty; independent RED
              reproduced the outermost-gate finding) · store-outage → 200 degraded never 5xx · D2's 3 branches
              + building-fill RED · **warm-click byte-identity proven LIVE** (injected marker bundle served
              exactly on a real miss; 600s-stale blob correctly MISSED to vendor; `src/core/` 0-diff) · leaf
              AST · no-SSE. **ACs: 11 PASS / 0 FAIL / AC-11 + visual halves DEFERRED-TO-P4.** `NO_UI_CHANGE`
              confirmed (empty `apps/dashboard`+`libs/api` diff). Root-level selftests judged acceptable.
              (P1 — PASS 8/8 at git `7269fa2`.)
              (P2 — QA_REPORT PASS 7/7 at git `9d92fed`, 2026-07-24): six `_selftest`s GREEN +
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
Last gateway:  P3 GATE U·X @ 2026-07-24 — delivery-ux wrote UX_BLUEPRINT + INTERFACE + standalone
              scanner.json + P3 BACKEND contract + FRONTEND NO_UI; lint 0/0; scanner.json valid + iv_rank
              shape. system-12 handled by authoring standalone directly (owner decision A). No GATE-Z.
              (Prior: P1 GATE Q 8/8 `7269fa2`; P2 GATE Q 7/7 `9d92fed`.)
