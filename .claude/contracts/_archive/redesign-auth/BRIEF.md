# redesign-auth — brief
Goal:            Reskin the **auth modal (sign-up / sign-in prompt)** to the new Convexa design — the
                 `apps/dashboard/src/app/auth/AuthDialog.tsx` (+ `GoogleButton.tsx`) opened from the nav
                 "Sign in" pill + the gated CTAs (`useGate`). Match the canonical design (DESIGN_HANDOFF §6
                 "Auth modal" + the owner's reference): centered card + backdrop blur; "Create your account"
                 ↔ sign-in toggle; subhead "Save personas, sync settings, and unlock AI reads."; EMAIL +
                 masked PASSWORD; primary "Create account" / "Sign in"; "or" divider; white "Continue with
                 Google" (multicolor G mark); "Already have an account? Sign in" / "…Sign up" mode-switch.
                 Reuse the existing theme + the feature-1 reskin patterns. The MODAL only.
Decision impact: N/A (UX / brand class).
Feasibility:     pass — FE-only **NO_BACKEND_CHANGE** (reskins the existing `AuthDialog` + `GoogleButton`;
                 consumes the existing `/api/auth/*` endpoints unchanged). Architecture settled by
                 `redesign-foundation` (token reuse + sx-extras). The full-page **`/auth` ROUTE**
                 (login-page.png) is OUT of scope here — a NEW route, its own follow-on; this is the MODAL.
Effort:          S–M.
Invariant watch: additive-keeps-score-byte-identical (`apps/api` untouched), server-side-gate-enforcement
                 (the modal is UX over the EXISTING server-authoritative gate — the reskin must NOT weaken
                 it; success → close + re-run the gated action), **security floor (HARD)**: password never
                 echoed/logged, non-enumerating bad-creds (401), mapped auth error codes, Google secret
                 stays server-side, present-but-disabled-when-unconfigured Google button driven by
                 `google_available`. loss-free-durable-migration (no durable-key change).
Context tags:    frontend,ui,auth,conventions
Entry point:     **GATE V fast-path** (UX → Frontend; skip PM/Architect/math) — a visual reskin of an
                 existing component, NO_BACKEND_CHANGE, architecture already settled.
Source:          Owner-directed (2026-06-29): "implement the new sign-up/sign-in prompt" — the Claude Design
                 auth-modal redesign (DESIGN_HANDOFF §6, in `../redesign-foundation/`). Pulls the auth slice
                 of the program's feature 4 forward.
