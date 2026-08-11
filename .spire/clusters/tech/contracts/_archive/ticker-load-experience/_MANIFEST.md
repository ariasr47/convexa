# ticker-load-experience — pipeline manifest
Entry:        architect-first
Stage:        SHIPPED + ARCHIVED (GATE S @ 2026-06-25) — code commit 10971f3; canon folded; narrowed live-spot=NBBO-mid
Repos:        both
Brief:        BRIEF.md present
Contracts:
  - ARCHITECTURE_CONTRACT.md   locked
  - PRODUCT_CONTRACT.md        locked
  - UX_BLUEPRINT.md            locked
  - INTERFACE_CONTRACT.md      locked   <- FE↔BE binding (SSE `last_trade`; bundle byte-identical)
  - BACKEND_EXECUTION_CONTRACT.md   locked
  - FRONTEND_EXECUTION_CONTRACT.md  locked
Conformance spec: .claude/tools/conformance/ticker-load-experience.json (standalone, system-12)
Open amendments: none
QA (GATE Q):  QA_REPORT PASS (Sonnet, de-correlated — 26/26 ACs, conformance 2/2, 196/196 tests)
Last gateway:  GATE S @ 2026-06-25 (SHIPPED + ARCHIVED)
