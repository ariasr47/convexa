# FRONTEND_EXECUTION_CONTRACT — redesign-auth (auth MODAL reskin)

> Build spec for the auth-modal reskin. Source of truth for look/copy/states: `UX_BLUEPRINT.md`
> (this folder) + DESIGN_HANDOFF §6 "Auth modal" + the owner's "Create your account" reference.
> **NO_BACKEND_CHANGE** — see `INTERFACE_CONTRACT.md`. Backend lane: `NO_BACKEND_CHANGE`.
>
> This is a **presentation-only** change. The form structure, modes, error mapping, gate wiring,
> and security floor are PRESERVED — reskin and re-lay-out, keep the wiring. Reuse the existing
> theme (`apps/dashboard/src/app/theme.ts`); prototype-only extras go in `sx`, NOT new theme keys.

---

## 1. Files in scope

- `apps/dashboard/src/app/auth/AuthDialog.tsx` — reskin the dialog (centered card, backdrop
  blur, top-right `×`, the signup subhead, restyled fields/divider/submit/mode-switch).
- `apps/dashboard/src/app/auth/GoogleButton.tsx` — reskin to a white "Continue with Google"
  button with a **multicolor Google G** mark (asset swap), keeping the present-but-disabled
  behavior byte-for-byte.
- `apps/dashboard/src/app/auth/copy.ts` — ONLY if the new signup subhead string is added here
  (under `AUTH_COPY.signup`). No other copy change.

**Out of scope:** `AuthContext`, `AuthDialogProvider`, `useGate`, `validation.ts`, the full-page
`/auth` route, Settings, any backend. Do not touch the network boundary or error mapping logic.

---

## 2. What to build (reskin delta)

Per `UX_BLUEPRINT.md` §2:

1. **Dialog surface:** keep `maxWidth="xs"` `fullWidth`; `background.paper` card, radius 10;
   add a **backdrop blur** (`sx` on the Dialog backdrop, ~6–12px) + dim. Add a **top-right `×`
   icon button** wired to the existing `onClose` (suppressed while `submitting`, same as
   backdrop close today).
2. **Title:** 700 weight; signup `Create your account` / login `Sign in`. Keep
   `data-testid="auth-dialog-title"`.
3. **Subhead (signup only — NEW):** secondary-text line under the title:
   `Save personas, sync settings, and unlock AI reads.` Login mode shows no subhead.
4. **Fields:** EMAIL then PASSWORD with the uppercase eyebrow labels from the reference; email
   placeholder `you@email.com` (presentational); password stays `type="password"` (masked).
   Display-name (signup only) unchanged in position. Keep all field `data-testid`s.
5. **Primary submit:** full-width contained `primary.main`, 600 weight; resting/loading copy
   from `AUTH_COPY` unchanged. Keep `data-testid="auth-submit"`.
6. **"or" divider:** existing `Divider flexItem` reading `or`, restyled subtle.
7. **Google button:** full-width **white** button, **multicolor G**, "Continue with Google" —
   §3 preservation below. Keep `data-testid="google-button"` + `google-helper`.
8. **Mode-switch link:** `primary.main`; copy from `AUTH_COPY`. Keep `data-testid="auth-mode-switch"`.
9. **Motion:** ≤180ms fades; no flashy motion.

All copy is reused VERBATIM from `AUTH_COPY` (`UX_BLUEPRINT.md` §3). The only new string is the
signup subhead.

---

## 3. PRESERVATION list (HARD — encode as preservation tests)

The reskin MUST NOT change any of the following. These are the security floor + the gate +
the selector contract.

### 3a. Existing auth `data-testid`s (selectors unchanged)
`auth-dialog`, `auth-dialog-title`, `auth-reason`, `auth-form-error`, `auth-email`,
`auth-password`, `auth-display-name`, `auth-submit`, `auth-mode-switch`, `google-button`,
`google-helper`. (If the new `×` close button gets a testid, ADD it — do not rename/remove any
existing one.)

### 3b. Security floor (HARD)
- **Password masked + never echoed/logged:** password field stays `type="password"`; the typed
  password is NEVER written into any error/state/banner. On submit success and on open/mode-flip
  the password is cleared. Error mapping reads the server `code`, never a leaked detail/value.
- **Non-enumerating bad-credentials:** `bad_credentials` (401) → ONE generic form banner
  (`auth-form-error`), **byte-identical** for wrong-email and wrong-password. Never reveals
  whether the email exists.
- **Mapped error codes unchanged:** `email_taken` → email-field copy; `bad_credentials` → generic
  form banner; `validation` → field copy (password floor reads `{N}` from the server message);
  `auth_unavailable` / default / any non-AuthError → the safe degraded banner.
- **Google secret server-side:** enabled Google → full-page redirect to `/api/auth/google/start`;
  no client secret, no client OAuth.
- **Google present-but-disabled when `google_available` is false:** the button is rendered
  greyed + disabled (NOT hidden) with the tooltip + helper caption; absent creds cause NO crash;
  the email/password path stays fully usable. Driven by `auth.googleAvailable` (who-am-I) — a
  **config flip**, no rebuild: a `false→true` who-am-I refresh flips disabled→enabled.

### 3c. Gate + success behavior (server-authoritative)
- The modal is **UX over the existing server-authoritative gate** — the reskin does NOT weaken
  it. The gate decision and enforcement stay in `useGate`/the server (unchanged).
- **On success:** the password is cleared, `onSuccess?.()` fires (return-to-gated-action), and
  the dialog **closes** (`onClose`). Close is suppressed while `submitting`.
- Transient state (password, errors, submitting) resets on open / mode-flip — the password is
  never carried across a mode toggle.

---

## 4. Constraints

- Reuse `theme.ts` tokens; prototype-only hexes (`#1c2330`, `#8b949e`, etc.) go in `sx`, never
  new theme keys.
- No change to data flow, fetch logic, store shapes, gating, or error mapping.
- Lane: `scope:frontend`. Tests: `nx test @org/dashboard` (Vitest + Testing Library).
- Keep the existing specs green; ADD the reskin/preservation cases below.

---

## 5. Tests to write (required cases — each AC × state/behavior → a named test)

This matrix is derived from `UX_BLUEPRINT.md` §5; the FE *implements* these, it does not *choose*
the set. Existing auth specs (`auth-entry.spec.tsx`, `google-control.spec.tsx`,
`auth.flow.spec.tsx`, `auth-invariants.spec.tsx`) already cover most floor behaviors and MUST
stay green — reuse / extend them rather than duplicate. New reskin cases are marked **(new)**.

| Test name | AC | State / behavior asserted |
|---|---|---|
| `signup default renders title + subhead + reskinned controls` **(new)** | AC-1 | Default — signup: `auth-dialog-title` = "Create your account", the subhead string is present, email/password/display-name fields + submit + divider + Google + mode-switch all render |
| `login default renders title + fields + reason banner when gated` | AC-2 | Default — login: title "Sign in", fields render; a passed `reason` shows in `auth-reason` |
| `mode-switch toggles signup↔login and never carries the password` | AC-3 | switch flips copy/fields; the password field is cleared across the toggle (asserts AC-10 too) |
| `T-B1: valid signup submits and resolves signed-in` | AC-4 | Loading → Success: `signup` endpoint called once, state flips signed-in |
| `T-C1: valid login submits and resolves signed-in` | AC-4 | Loading → Success: `login` endpoint called once |
| `submitting disables fields/submit, shows loading copy, suppresses close` **(new)** | AC-5 | Loading: submit shows `Creating account…`/`Signing in…`, fields disabled, backdrop/× close is a no-op while in flight |
| `T-B3 (client): malformed email blocks submit with field copy, no network call` | AC-6, AC-10 | Field validation error (client): `invalidEmail` under email, zero network calls |
| `empty password blocks login submit with field copy, no network call` | AC-6, AC-10 | Field validation error (client): `emptyPassword`, zero network calls |
| `T-B3: server validation maps to the password-floor copy reading {N}` | AC-6 | Field validation error (server `validation`): floor copy reads the server number |
| `T-C3 / T-H3: bad credentials → single generic NON-ENUMERATING banner` | AC-7 | Bad credentials: `auth-form-error` = the exact generic copy, contains no enumerating phrase |
| `T-H3: login-failure copy byte-identical for wrong-email vs wrong-password` | AC-7 | Bad credentials: both shapes render the identical message |
| `T-B2: duplicate email → field-level "already registered" copy` | AC-8 | Duplicate email (signup): email-field copy, not a generic banner |
| `auth-unavailable → safe degraded banner, never a misleading/leaky error` | AC-9 | Auth unavailable: the "Couldn't reach sign-in…" banner; no leaked detail |
| `T-H1: password is never echoed into any surfaced state after an error` | AC-10 | the typed secret appears in NO error/banner/text node (only the masked field holds it) |
| `T-G1: google_available=false → present, disabled, helper + tooltip` | AC-11 | Google present-vs-disabled: `google-button` disabled, `google-helper` shows the copy |
| `T-G2: absent Google creds → no crash; email/password path still works` | AC-11 | Google disabled AND a login submit still succeeds |
| `T-G3: who-am-I flip false→true → button becomes enabled, no rebuild` | AC-12 | Google present-vs-disabled: a `refresh()` after `setGoogle(true)` flips disabled→enabled |
| `enabled Google → full-page redirect to /api/auth/google/start` | AC-13 | Google present-vs-disabled: click navigates to the server flow; no client secret |
| `T-E1: success closes the modal and re-runs the originally-gated action` | AC-14, AC-15 | Success: after sign-in the dialog closes and the gated action becomes available (`onSuccess`); the gate stayed server-authoritative |
| `every existing auth data-testid is still present after the reskin` **(new)** | AC-16 | all states: the full §3a selector list resolves in the reskinned dialog |

Where an existing named test already asserts the row (e.g. `T-B1`, `T-C3`, `T-G1`), KEEP it and
ensure it passes against the reskinned component; only add the **(new)** rows. Every AC in
`UX_BLUEPRINT.md` §5 has ≥1 named test above (traceable at GATE Q on the FE side — the backend
lane is `NO_BACKEND_CHANGE`).
