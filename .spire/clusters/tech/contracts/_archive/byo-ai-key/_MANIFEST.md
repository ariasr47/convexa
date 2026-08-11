# byo-ai-key — pipeline manifest
Entry:        architect-first
Stage:        SHIPPED + ARCHIVED (GATE S) — folded into canon, committed
Repos:        both
Brief:        BRIEF.md present
Contracts:
  - ARCHITECTURE_CONTRACT.md   locked
  - PRODUCT_CONTRACT.md        locked
  - UX_BLUEPRINT.md            n/a
  - INTERFACE_CONTRACT.md      n/a
  - BACKEND_EXECUTION_CONTRACT.md   n/a
  - FRONTEND_EXECUTION_CONTRACT.md  n/a
Open amendments: FRONTEND_EXECUTION_CONTRACT CONTESTED (owner: Frontend) — AC-19 has no named test (suite green but AC uncovered)
QA (GATE Q):  QA_REPORT PASS (re-run) — 26/26 ACs, 0 FAIL; dashboard 313/313; @org/api 13/13; conformance + security floor + byte-identical all PASS (AC-19 FAIL→fixed→re-verified)
Last gateway:  GATE S @ 2026-06-29
Note:         Hybrid BYO AI key — regular users BYO (0 free), admin free allowance on the shared key.
              Minimal admin concept + encrypted-at-rest user keys. system-6 deferred (credential custody →
              its eventual first client). GATE S graduated server-side-gate-enforcement into canon.
