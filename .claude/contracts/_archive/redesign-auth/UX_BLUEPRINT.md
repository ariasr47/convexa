# UX_BLUEPRINT — redesign-auth (auth MODAL reskin)

> Scope: the auth **MODAL** only — `apps/dashboard/src/app/auth/AuthDialog.tsx` +
> `auth/GoogleButton.tsx`. NO_BACKEND_CHANGE. A **visual reskin** of an existing, already-wired
> component: the data flow, error mapping, gate, and security floor are PRESERVED, only the
> presentation changes. The full-page `/auth` route is OUT of scope (separate follow-on).
>
> Canon: DESIGN_HANDOFF §6 "Auth modal" + "Design Tokens" + the owner's "Create your account"
> reference (the `05-signin.png` reskin). Token reuse from `apps/dashboard/src/app/theme.ts`;
> prototype-only extras go in `sx` (NOT new theme keys) — same rule as redesign-foundation.

---

## 1. What this surface is

A single centered MUI `Dialog` that toggles between two modes — **signup** ("Create your
account") and **login** ("Sign in") — both embedding the email + masked password fields, a
primary submit, an "or" divider, the white "Continue with Google" control, and a mode-switch
link. It is opened by the nav "Sign in" pill (in `signup` mode by design) and by every gated
CTA via `useGate` / `AuthDialogProvider` (in `login` mode with a `reason` line). On success it
closes and re-runs the originally-gated action.

The reskin changes the look (centered card, backdrop blur, the new field/divider/button
styling, the multicolor Google G, the owner's subhead) — it does **not** restructure the form,
the modes, the error mapping, or the open/success wiring.

---

## 2. Visual spec (reskin delta vs. today)

All hex below comes from the DESIGN_HANDOFF token table; reuse the theme, fold prototype-only
extras into `sx`.

- **Dialog surface:** centered, `maxWidth="xs"` `fullWidth` (unchanged sizing intent),
  `background.paper` (`#161b22`) card, `shape.borderRadius` 10. Backdrop: dim + `backdrop-filter:
  blur(…)` on the `Dialog` backdrop (sx-only; ~`blur(6–12px)` to match the foundation's
  translucent-blur language). Close affordance: a top-right `×` icon button (the screenshot shows
  it) AND backdrop click — both call the existing `onClose` (which is suppressed while
  `submitting`, preserved).
- **Title:** `Create your account` (signup) / `Sign in` (login), 700 weight, ~h1/section scale.
  Keep `data-testid="auth-dialog-title"`.
- **Subhead (signup only — NEW):** secondary text (`#8b949e`) line directly under the title:
  **"Save personas, sync settings, and unlock AI reads."** Login mode has no subhead (or a
  parallel minimal one — the reference only specifies the signup subhead; login stays clean).
- **Fields:** EMAIL then PASSWORD, labels as small uppercase eyebrow labels per the reference
  (`EMAIL`, `PASSWORD`) — rendered via the existing `TextField` `label`/copy; password `type=
  "password"` (masked, preserved). Email placeholder `you@email.com` (presentational; the label
  copy `c.email` is unchanged). Display-name field (signup only) stays where it is today.
- **Primary button:** full-width contained, `primary.main` (`#4f9cff`), 600 weight — "Create
  account" (signup) / "Sign in" (login).
- **Divider:** the existing `Divider flexItem` reading **`or`**, restyled (subtle slate
  `divider`, centered label).
- **Google button:** full-width **white** button, **multicolor Google G** mark, label "Continue
  with Google" — see §2.4 below. (The reskin swaps the monochrome MUI `GoogleIcon` for the
  multicolor G; this is a presentational asset swap, behavior unchanged.)
- **Mode-switch link:** `primary.main` link — "Already have an account? **Sign in**" (signup) /
  "New here? Create an account" (login). Keep `data-testid="auth-mode-switch"`.
- **Motion:** ≤180ms fade (foundation rule); no flashy motion.

### 2.4 The Google control (present-but-disabled-when-unconfigured)

Reskin of `GoogleButton.tsx` — the **present-but-disabled** behavior is a SECURITY-FLOOR
invariant and is PRESERVED byte-for-byte:

- **available (enabled):** white button, multicolor G, "Continue with Google"; clickable → full-
  page redirect to `/api/auth/google/start` (server-side flow). No helper line.
- **unavailable (disabled — DEFAULT this phase):** the SAME button rendered **greyed +
  disabled** (NOT hidden), wrapped in a tooltip span so the tooltip fires, with the quiet helper
  caption below it. Driven by `auth.googleAvailable` from who-am-I — a **config flip**, no
  rebuild. Absent creds cause NO crash; the email/password path stays fully usable.

---

## 3. Microcopy (verbatim — the SINGLE source is `auth/copy.ts`; do NOT improvise)

The binding framing (non-enumerating login failure, the Google-disabled affordance, the gate
reason lines) is carried entirely by these strings. The reskin reuses `AUTH_COPY` unchanged.

| Slot | Mode | Copy (verbatim from `AUTH_COPY`) |
|---|---|---|
| Title | signup | `Create your account` |
| Title | login | `Sign in` |
| Subhead (NEW, presentational) | signup | `Save personas, sync settings, and unlock AI reads.` |
| Email label | both | `Email` |
| Password label | both | `Password` |
| Display name label | signup | `Display name (optional)` |
| Submit (resting) | signup | `Create account` |
| Submit (loading) | signup | `Creating account…` |
| Submit (resting) | login | `Sign in` |
| Submit (loading) | login | `Signing in…` |
| Divider | both | `or` |
| Google label | both | `Continue with Google` |
| Google helper (disabled) | both | `Google sign-in isn't available yet — use your email and password.` |
| Google tooltip (disabled) | both | `Google sign-in is wired up but turned off until Google credentials are configured for this server. Email + password works now.` |
| Mode-switch | signup | `Already have an account? Sign in` |
| Mode-switch | login | `New here? Create an account` |
| Bad-credentials (NON-ENUMERATING) | login | `Those credentials didn't match. Check your email and password and try again.` |
| Empty password | login | `Enter your password.` |
| Invalid email | both | `Enter a valid email address.` |
| Email taken | signup | `That email is already registered. Try signing in instead.` |
| Password floor | signup | `Password must be at least {N} characters.` (`{N}` read from the server 422; never hardcoded) |
| Password floor (generic) | signup | `Password is too short.` |
| Auth unavailable (degraded) | both | `Couldn't reach sign-in right now. Please try again in a moment.` |
| Reason line (gated open) | login | the gate `reason` passed in (e.g. `Sign in to track simulated positions.`, `Sign in to ask AI.`) |

The "Save personas, sync settings, and unlock AI reads." subhead is the one NEW string. If it is
added to `AUTH_COPY` it must live under `AUTH_COPY.signup` (e.g. `subhead`); otherwise it is an
sx/presentational literal. Either way it is signup-only.

---

## 4. Component states → microcopy/affordance map

| State | When | What renders |
|---|---|---|
| **Default — signup** | opened in `signup` mode (nav "Sign in" pill) | Title + subhead + EMAIL/PASSWORD/display-name + "Create account" + "or" + Google + "Already have an account? Sign in". No banners. |
| **Default — login** | opened in `login` mode (gated CTA) | Title + EMAIL/PASSWORD + "Sign in" + "or" + Google + "New here? Create an account". If opened with a `reason`, an info reason banner (`data-testid="auth-reason"`) at the top. |
| **Loading (submitting)** | after submit, request in flight | Submit shows the `submitting` label (`Creating account…` / `Signing in…`); fields + submit **disabled**; backdrop/× close **suppressed** (`onClose` undefined while submitting). |
| **Field validation error** | client (`isLikelyEmail` / empty password) OR server `validation` (422) | Inline `helperText` under the offending field (email: `invalidEmail`; password: floor/generic copy reading `{N}`). NO network call on client-side validation failure. Password is NEVER echoed. |
| **Bad credentials (login, NON-ENUMERATING)** | server `bad_credentials` (401) | A single form-level error banner (`data-testid="auth-form-error"`, `severity="error"`) with the EXACT generic copy — **byte-identical** for wrong-email and wrong-password. Never reveals whether the email exists. |
| **Duplicate email (signup)** | server `email_taken` | Inline email-field error: `That email is already registered. Try signing in instead.` (field-level, not a generic banner). |
| **Auth unavailable (degraded)** | server `auth_unavailable` (503) or any non-AuthError | Form-level banner (`auth-form-error`, `severity="warning"` in signup mode) with the "Couldn't reach sign-in right now…" copy. Never a misleading/leaky error. |
| **Google present-vs-disabled** | `auth.googleAvailable` | true → white enabled "Continue with Google"; false → same button greyed + disabled (`aria-disabled`) + tooltip + `google-helper` caption. Config flip, no rebuild. |
| **Success** | signup/login resolves OK | Password cleared, `onSuccess?.()` fires (return-to-gated-action), dialog **closes**. |

Note — there is no separate stale/offline/empty state for this surface: the auth modal is a
transactional form, not a live data surface. The "degraded" axis is the auth-unavailable banner
above. (The trader path's stale/offline states are out of this feature's scope.)

---

## 5. AC → state matrix (this IS the required-tests matrix for the FE)

Each AC maps to the component state(s) that satisfy it; the FRONTEND_EXECUTION_CONTRACT "Tests
to write" section enumerates exactly these so the FE *implements* them and never *chooses* the
requirement set.

| AC | Requirement | State(s) it lands in |
|---|---|---|
| **AC-1** | Signup default renders title + NEW subhead + fields + reskinned controls | Default — signup |
| **AC-2** | Login default renders title + fields + reskinned controls (+ reason banner when gated) | Default — login |
| **AC-3** | Mode-switch toggles signup↔login (copy + fields change; password never carried over) | Default — signup ↔ Default — login |
| **AC-4** | Valid submit calls the right endpoint and resolves signed-in | Loading → Success |
| **AC-5** | Loading disables fields/submit, shows `submitting` copy, suppresses close | Loading |
| **AC-6** | Client + server field validation surfaces inline field copy; no network on client fail | Field validation error |
| **AC-7 (FLOOR)** | Bad credentials shows the single generic NON-ENUMERATING banner, byte-identical for both shapes | Bad credentials (login) |
| **AC-8** | Duplicate email shows the field-level "already registered" copy | Duplicate email (signup) |
| **AC-9 (FLOOR)** | Auth-unavailable / non-AuthError shows the safe degraded banner, never a leak | Auth unavailable |
| **AC-10 (FLOOR)** | Password masked + NEVER echoed into any surfaced state/error/log | all states (asserted in Field-validation + Bad-credentials) |
| **AC-11 (FLOOR)** | Google present-but-DISABLED when `google_available` false (helper + tooltip, no crash) | Google present-vs-disabled |
| **AC-12 (FLOOR)** | Google flips disabled→enabled on a config-only who-am-I refresh (no rebuild) | Google present-vs-disabled |
| **AC-13 (FLOOR)** | Enabled Google → full-page redirect to the server flow; secret stays server-side | Google present-vs-disabled |
| **AC-14 (FLOOR)** | Success closes the modal AND re-runs the originally-gated action (`onSuccess`) | Success |
| **AC-15 (FLOOR)** | The gate stays server-authoritative — the modal is UX over the existing server gate (it does not weaken it) | Default — login (gated open) + Success |
| **AC-16** | Every existing auth `data-testid` is PRESERVED (selectors unchanged) | all states |

FLOOR = security-floor / preservation AC (HARD; do not weaken).

---

## 6. PRESERVATION list (carried into the FE contract)

The reskin MUST keep, unchanged:

1. **Every auth `data-testid`:** `auth-dialog`, `auth-dialog-title`, `auth-reason`,
   `auth-form-error`, `auth-email`, `auth-password`, `auth-display-name`, `auth-submit`,
   `auth-mode-switch`, `google-button`, `google-helper`.
2. **The security floor:** password masked + never echoed/logged; non-enumerating
   bad-credentials (one generic 401 banner, byte-identical for both shapes); the existing mapped
   auth error codes → copy (`email_taken` / `bad_credentials` / `validation` / `auth_unavailable`
   / default); Google secret server-side (redirect to `/api/auth/google/start`, no client secret);
   Google **present-but-disabled** when `google_available` is false (config flip, no rebuild).
3. **The gate behavior:** the modal is UX over the existing server-authoritative gate; on success
   the modal closes and the originally-gated action re-runs (`onSuccess` → `onClose`). Close is
   suppressed while submitting. Transient state resets on open / mode-flip (password never
   carried over).
4. **The wiring:** `AuthContext` (`signIn`/`signUp`/`googleAvailable`), `AuthDialogProvider`
   (`reason` + `onSuccess`), `useGate` — all consumed unchanged. The copy source `AUTH_COPY` and
   the `validation.ts` helpers are reused unchanged (except the optional new signup subhead
   string).

---

## 7. Server contract (consumed unchanged)

The FE consumes the existing endpoints via `@org/api` (`signIn`/`signUp`/`getSession` and the
Google start redirect) with NO field or shape change. See `INTERFACE_CONTRACT.md` —
NO_BACKEND_CHANGE. The fields the UI reads from who-am-I: `authenticated`, `user`,
`google_available`, `settings`. The fields submitted: `{ email, password, display_name? }`
(signup) / `{ email, password }` (login). Errors arrive as `AuthError` with a `code` the form
maps to copy.
