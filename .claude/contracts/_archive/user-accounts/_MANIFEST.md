# user-accounts — pipeline manifest
Entry:        architect-first
Stage:        SHIPPED + ARCHIVED (GATE S) — folded into canon, committed
Repos:        both
Brief:        BRIEF.md present
Contracts:
  - ARCHITECTURE_CONTRACT.md   locked
  - PRODUCT_CONTRACT.md        locked
  - UX_BLUEPRINT.md            locked
  - INTERFACE_CONTRACT.md      locked
  - BACKEND_EXECUTION_CONTRACT.md   locked
  - FRONTEND_EXECUTION_CONTRACT.md  locked
Open amendments: FRONTEND_EXECUTION_CONTRACT CONTESTED (owner: Frontend) — AC-E7: Positions sim-trade write gate is FE-only; FE never calls server POST /api/positions/sim-trade/gate. Plus resolved — GATE Z: ai_recommendations.json conformance spec amended (auth-gated POST removed from anonymous sweep)
QA (GATE Q):  QA_REPORT PASS (re-run) — 30 PASS / 0 FAIL / 0 UNVERIFIABLE; conformance 2/2; dashboard 246/246; @org/api 7/7 (AC-E7 FAIL→fixed→re-verified)
Build:        backend — src/auth/ subpackage + main.py wiring; conformance 2/2; score byte-identical (score 24, fp 79373ef9194e); import-boundary clean; 47 runtime assertions
              frontend — auth module + @org/api client; nx test dashboard 244 passed (196 prior + 48 new); all T-A1..T-J1 matrix rows named
Last gateway:  GATE S @ 2026-06-25 (shipped + archived)
