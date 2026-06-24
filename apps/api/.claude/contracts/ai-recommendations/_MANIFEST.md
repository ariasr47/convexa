# ai-recommendations — pipeline manifest
Entry:        architect-first
Stage:        GATE Q FAIL → GATE Z bounce to Frontend (one required named test, E3, absent).
              Backend: conformance 4/4, score byte-identical, isolation. Frontend: gammaflow-web 42212f5,
              nx test 25/25 + api 7/7 green. 18/18 ACs PASS, all invariants clean — only the E3 named
              test missing (AC↔test traceability rule caught it despite a green suite). Fix + re-verify pending.
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
QA (GATE Q):  QA_REPORT FAIL (bounced: Frontend) — 18/18 ACs PASS, conformance 4/4, invariants clean;
              required named test E3 (`additive-keeps-score-byte-identical`, with/without + persona
              override) absent. Verified by qa-verify on Sonnet (de-correlated). Re-runs on the fix.
Canon note:   RELAXES promoted invariant `ai-external-no-llm` by owner decision (2026-06-23); pending
              formal demotion in GAMMAFLOW_CONTEXT §8 / OPEN_THREADS §9 + DECISION_LEDGER at GATE S.
Last gateway:  GATE U·X @ 2026-06-23
