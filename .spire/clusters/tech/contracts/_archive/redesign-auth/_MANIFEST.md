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

## ⚠ SUPERSEDED — ARCHIVED 2026-07-27 WITHOUT REACHING GATE Q
**Never QA'd, never shipped as its own feature.** It stalled awaiting the owner's local-preview sign-off on
2026-06-29; while it waited, its scope was delivered elsewhere. **Archived as superseded.**

**Evidence (verified 2026-07-27):**
1. **OPEN_THREADS §7l (`convexa-redesign`, SHIPPED + ARCHIVED)** lists **"Settings + Auth modal (`AuthModal`
   component set)"** among the surfaces it re-skinned and merged to `main`.
2. §7l also records an **owner scope cut this contract predates**: the full-page `/auth` route was
   **DROPPED**, with the modal (`AuthDialog`) kept as the auth surface. The live components today are
   `features/auth/AuthDialog.tsx` + `AuthDialogProvider.tsx`.
3. The 4-stage **Curvature Terminal** program (2026-07-22) re-skinned Settings/Auth again on top, and the
   whole `auth/` folder moved to `features/auth/` in the 2026-07-16 restructure — so this contract's paths
   are stale twice over.

**If someone wants to revive this:** open a fresh feature against the CURRENT structure
(`apps/dashboard/src/app/README.md`) and the `convexa-design` skill; do not restart from these contracts.
**Caveat worth flagging:** an untracked `apps/dashboard/src/app/auth/auth-reskin.spec.tsx` was written
2026-07-27 08:11 at the **pre-restructure** path (`app/auth/`, which no longer exists — the live path is
`app/features/auth/`). If that is live work by a parallel session, it is building against a superseded
layout and should be reconciled before it is committed.
