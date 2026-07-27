# redesign-auth — pipeline manifest
Entry:        gate-v (UX → Frontend; PM/Architect skipped — architecture settled by redesign-foundation)
Stage:        Two preview-fixes landed (nav→signup + display-name field removed → modal = email+password per design; Google honest-disabled stays; 359 tests; apps/api untouched) — AWAITING OWNER RE-PREVIEW sign-off before GATE Q
Repos:        frontend
Brief:        BRIEF.md present
Contracts:
  - ARCHITECTURE_CONTRACT.md   n/a (GATE V — settled by redesign-foundation)
  - PRODUCT_CONTRACT.md        n/a (GATE V)
  - UX_BLUEPRINT.md            locked
  - INTERFACE_CONTRACT.md      locked   <- NO_BACKEND_CHANGE (existing /api/auth/* unchanged)
  - BACKEND_EXECUTION_CONTRACT.md   NO_BACKEND_CHANGE
  - FRONTEND_EXECUTION_CONTRACT.md  locked
Design ref:   ../redesign-foundation/DESIGN_HANDOFF.md §6 (Settings/Auth) + 05-signin.png + owner reference
Owner gate:   LOCAL PREVIEW + owner approval required before GATE Q (per the program)
QA (GATE Q):  n/a
Last gateway:  FE preview-fix (display-name removed) @ 2026-06-29 → owner re-preview (:4200, click "Sign in")
