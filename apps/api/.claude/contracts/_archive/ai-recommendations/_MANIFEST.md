# ai-recommendations — pipeline manifest
Entry:        architect-first
Stage:        SHIPPED + ARCHIVED (GATE S @ 2026-06-23). Backend eec3a3a; frontend 42212f5 + a2f6ae3.
              QA PASS (Sonnet, de-correlated). Demoted `ai-external-no-llm` (system-7, narrowed). Canon
              refreshed: CONTEXT §2/§6/§7/§8, OPEN_THREADS §7b, DECISION_LEDGER (Demoted + rows), BACKLOG §A.
Repos:        both
Brief:        BRIEF.md present
Contracts:
  - ARCHITECTURE_CONTRACT.md   locked
  - PRODUCT_CONTRACT.md        locked
  - UX_BLUEPRINT.md            locked
  - INTERFACE_CONTRACT.md      locked   <- FE↔BE binding (incl. ## Conformance spec for system-1)
  - BACKEND_EXECUTION_CONTRACT.md   locked
  - FRONTEND_EXECUTION_CONTRACT.md  locked
Open amendments: GATE Z (conformance-spec convention) RESOLVED 2026-06-23 → standalone-file canonical
              (BACKLOG §E system-12); INTERFACE_CONTRACT §3 now references
              `.claude/tools/conformance/ai_recommendations.json` (the runnable spec). Backend lane in lane.
QA (GATE Q):  QA_REPORT PASS — initial FAIL (E3 missing) RESOLVED by gammaflow-web a2f6ae3 + targeted
              re-verify (nx test 26/26, E3 passing). 18/18 ACs PASS, conformance 4/4, invariants clean.
              Original verification by qa-verify on Sonnet (de-correlated).
Canon note:   RELAXES promoted invariant `ai-external-no-llm` by owner decision (2026-06-23); pending
              formal demotion in GAMMAFLOW_CONTEXT §8 / OPEN_THREADS §9 + DECISION_LEDGER at GATE S.
Last gateway:  GATE U·X @ 2026-06-23
