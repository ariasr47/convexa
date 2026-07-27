# redesign-foundation — pipeline manifest
Entry:        architect-first
Stage:        FE preview-fix landed (shared TopNav; 350/350 tests; lint 0-err; apps/api untouched) — Landing now renders the top nav; AWAITING OWNER RE-PREVIEW before GATE Q
Repos:        frontend
Brief:        BRIEF.md present
Contracts:
  - ARCHITECTURE_CONTRACT.md   locked (amended @ GATE Z — token strategy)
  - PRODUCT_CONTRACT.md        locked
  - UX_BLUEPRINT.md            locked
  - INTERFACE_CONTRACT.md      locked   <- NO_BACKEND_CHANGE (existing endpoints unchanged)
  - BACKEND_EXECUTION_CONTRACT.md   NO_BACKEND_CHANGE
  - FRONTEND_EXECUTION_CONTRACT.md  locked
Open amendments: none (FRONTEND_AMENDMENTS_REQUESTED.md RESOLVED @ owner re-preview 2026-06-29; ARCHITECT amendment resolved earlier)
Design ref:   DESIGN_HANDOFF.md (canonical) + Convexa.dc.html + login-page.png + convexa-redesign-screens/*.png
Owner gate:   ✅ APPROVED by owner 2026-06-29 (local-preview sign-off)
QA (GATE Q):  ✅ QA_REPORT PASS — 24/24 ACs, 359/359 Vitest, apps/api empty diff, all invariants hold
              (qa-verify on Sonnet, de-correlated). Visual-fidelity ACs owner-approved-preview.
Stage:        ✅ SHIPPED (GATE S @ 2026-06-29) — recorded in OPEN_THREADS §7l + DECISION_LEDGER + PROJECT_CONTEXT.
              **Archive move DEFERRED:** DESIGN_HANDOFF.md is the shared program design canon that the
              in-flight redesign-ticker + redesign-auth still reference by `../redesign-foundation/` —
              physically move this folder to _archive ONLY after those siblings ship (avoid breaking
              their refs + don't touch the parallel auth session's files).
Code state:   QA-passed + approved, UNCOMMITTED in the working tree. Commit/push (→ auto-deploy to prod)
              is a SEPARATE owner-controlled step — entangled with the parallel auth WIP in the same tree.
Last gateway:  GATE S (ship) @ 2026-06-29

## ⚠ ARCHIVED 2026-07-27 — the deferred archive-move, finally executed
This folder SHIPPED on 2026-06-29 and its physical archive move was deliberately deferred so the two
in-flight siblings (`redesign-ticker`, `redesign-auth`) could keep referencing `DESIGN_HANDOFF.md` via
`../redesign-foundation/`. **That reason is now gone: both siblings are SUPERSEDED and archived in the
same move**, so the relative refs still resolve (all three now sit side by side under `_archive/`).
**Two stale claims above, corrected here rather than edited out** (the record should show what was
believed at the time): (1) *"Code state: QA-passed + approved, UNCOMMITTED in the working tree"* — that
work shipped as **`convexa-redesign`** and merged to `main` (OPEN_THREADS §7l); (2) the QA note that
`nx typecheck` was RED on main — since fixed; it ran clean in the scanner P4 battery (2026-07-26).
QA note:       pre-existing `nx typecheck` (tsc --build) is RED on main (jest-dom/DOM-lib config gap, 502 errs, NOT from this feature) — QA uses the authoritative Vitest result (344/344 green), not that target
