# app-shell-landing — pipeline manifest
Entry:        architect-first
Stage:        QA PASS (42/42 ACs · 171 tests green · invariants clean · no regression · de-correlated on Sonnet); ready to ship (GATE S)
Repos:        frontend (FE-only restructure + Convexa landing; NO_BACKEND_CHANGE)
Brief:        BRIEF.md present
Contracts:
  - ARCHITECTURE_CONTRACT.md        locked
  - PRODUCT_CONTRACT.md             locked (42 ACs enumerated)
  - UX_BLUEPRINT.md                 locked
  - INTERFACE_CONTRACT.md           locked (NO_BACKEND_CHANGE — consumes existing endpoints)
  - BACKEND_EXECUTION_CONTRACT.md   NO_BACKEND_CHANGE
  - FRONTEND_EXECUTION_CONTRACT.md  locked
Open amendments: UX_AMENDMENTS.md — degraded-mark wording RESOLVED (reuse existing PositionRow wording; behavior satisfies AC-PosLive-2/3/4; no re-build)
QA (GATE Q):  QA_REPORT PASS
Last gateway:  GATE Q @ 2026-06-24
Program:      Owner pivot (positions-centric multi-page) — Track A, feature 1 of 4
