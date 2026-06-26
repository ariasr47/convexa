# user-accounts — UX_BLUEPRINT

> UX/Tech-Writer design layer. Reader has ONLY `.claude/PROJECT_CONTEXT.md` + the
> `PRODUCT_CONTRACT.md` + `ARCHITECTURE_CONTRACT.md` in this folder + this file. This file translates the
> 38 ACs + D1–D10 into concrete component states, where each datum surfaces, exact user-facing copy, and
> the AC → component-state mapping (which IS the required-tests matrix). It names the fields the UI
> consumes; it makes **no** server-implementation or final-payload decision beyond naming (those are
> pinned in `INTERFACE_CONTRACT.md`).

FEATURE = `user-accounts`. Lane: UX. No server internals, no math.

---

## 0. Design principles binding this feature (restated from the PRODUCT_CONTRACT §8)

1. **No setting wired into any bundle/score path** — settings change only which default a UI lands on.
2. **Auth errors are real, honest HTTP outcomes** — never silent nulls; each case has distinct copy.
3. **Server is the enforcement boundary** for the two gated surfaces; the FE prompt/disable is UX sugar.
4. **Google disabled-when-unconfigured is a first-class shipping state** — present, unavailable, no crash;
   availability comes from the session-status read so config-only enabling flips disabled↔enabled with no
   rebuild.
5. **Honest browser-local-positions disclosure** — copy must not imply sync/privacy/account-scoping.
6. **No secret / no plaintext password** in any state, error, debug surface, or payload.
7. **Auth-gate is OUTERMOST over ai-rec gating** — logged-out "ask AI" shows "sign in," never cooldown/cap/no_key.
8. **Anonymous experience unchanged** — zero regression to browsing / persona / theme when never signed in.

---

## 1. The fields the UI consumes (naming only — wire shape pinned in INTERFACE_CONTRACT)

The FE drives every state below off ONE server-authoritative read — **the session-status / who-am-I read**
— plus the per-action auth outcomes. The UI consumes:

- **Session status read** → `authenticated` (boolean), `user` (object | null: `id`, `email`, `display_name|null`,
  `auth_methods` e.g. `["password"]`/`["password","google"]`), `google_available` (boolean — the
  config-gated Google availability flag, D9), `settings` (object | null: `active_persona_id|null`,
  `default_ticker|null`, `theme` ∈ `"dark"|"light"|"system"`). When the read **fails or is unreachable**,
  the FE treats the result as **anonymous** (`authenticated=false`, `user=null`) AND records a transient
  `subsystem_degraded` UI flag (drives the "couldn't reach sign-in" copy on gated actions — never on the
  trader path).
- **Signup / login outcomes** → success ⇒ same identity shape as who-am-I; failure ⇒ a status code + an
  `error` code the FE maps to copy (`bad_credentials`, `email_taken`, `validation`, `auth_unavailable`).
- **Logout outcome** → success ⇒ FE flips to anonymous (the read now returns anonymous).
- **Gated-action outcome** → an `auth_required` (signed-out / expired / revoked) status the FE turns into a
  sign-in prompt; the action does NOT execute.
- **Settings write outcome** → success ⇒ the saved bag (echoed back, server-wins).

The UI **never** consumes a password, a session id, a signing key, a Google secret, or a password hash —
none of those appear in any field above (AC-H1, AC-H2).

---

## 2. Surfaces & component states

> States listed per surface: **default / loading / empty / error / unauthenticated / authenticated**, plus
> the surface-specific honest/degraded states. Copy is in quotes and is the binding microcopy.

### 2.1 Auth entry — the account menu / sign-in surface

The persistent `AppShell` nav gains an **account control** (top-right). It reflects who-am-I.

| State | Trigger | Render | Binding copy |
|---|---|---|---|
| **loading** | who-am-I in flight on first mount | account control shows a neutral placeholder (skeleton or muted icon); the rest of the app renders normally (anonymous-capable) | — (no spinner blocks browsing) |
| **unauthenticated** | `authenticated=false` | a **"Sign in"** control | `Sign in` |
| **authenticated** | `authenticated=true` | the account control shows the display name or email; opens a menu with **Log out** + a link to **Settings** | name → `display_name` else `email`; menu items `Settings`, `Log out` |
| **subsystem-degraded** | who-am-I failed/unreachable | treated as **unauthenticated** (shows `Sign in`); the trader path is unaffected. If the user then opens the dialog and submits, see "auth unavailable" below | `Sign in` (unchanged); the degraded copy surfaces only on submit |

### 2.2 Sign-up form (dialog/page)

| State | Render | Binding copy |
|---|---|---|
| **default** | fields: **Email** (required), **Password** (required), **Display name** (optional). A primary **Create account** button. Below: the **"Continue with Google"** control (§2.4). A link **"Already have an account? Sign in"** | labels `Email`, `Password`, `Display name (optional)`, button `Create account`, link `Already have an account? Sign in` |
| **loading** | Create-account button shows a busy state; fields disabled | button `Creating account…` |
| **error: duplicate email (AC-B2)** | inline error on the Email field; no account created | `That email is already registered. Try signing in instead.` |
| **error: validation (AC-B3)** | field-level errors; no account created. Malformed email → email field; short password → password field | email: `Enter a valid email address.` · password: `Password must be at least {N} characters.` (the `{N}` floor is supplied by the interface; copy reads the number, does not hardcode it) |
| **error: auth unavailable** | a non-field banner; no account created | `Couldn't reach sign-in right now. Please try again in a moment.` |
| **success (AC-B1)** | dialog closes; account control flips to **authenticated**; the app reflects signed-in immediately | — |

The password field is masked; the form **never** echoes the password back in any error or payload (AC-H1).

### 2.3 Log-in form (dialog/page)

| State | Render | Binding copy |
|---|---|---|
| **default** | fields **Email** + **Password**, a primary **Sign in** button, the **"Continue with Google"** control (§2.4), a link **"New here? Create an account"** | labels `Email`, `Password`, button `Sign in`, link `New here? Create an account` |
| **loading** | Sign-in button busy; fields disabled | button `Signing in…` |
| **error: bad credentials — NON-ENUMERATING (AC-C3, AC-H3)** | a single generic form-level error; identical whether the email is unknown OR the password is wrong; no session created | `Those credentials didn't match. Check your email and password and try again.` — **this exact message is used for both wrong-email and wrong-password.** It MUST NOT say "no account with that email," "email not found," or "wrong password." |
| **error: validation** | field-level (malformed email / empty password) | email: `Enter a valid email address.` · password: `Enter your password.` |
| **error: auth unavailable (AC-J1 gated-action side)** | non-field banner; no session created; never the bad-credentials copy | `Couldn't reach sign-in right now. Please try again in a moment.` |
| **success (AC-C1)** | dialog closes; account control flips to **authenticated**; if the user was returned from a gated action, they land back on that surface with the action now available (AC-C1/D6c) | — |

### 2.4 "Continue with Google" control — PRESENT-BUT-DISABLED-WHEN-UNCONFIGURED (D9, first-class)

Renders inside BOTH the sign-up and log-in forms. Its state is driven by `google_available` from who-am-I
(NOT a build flag) so config-only enabling flips it with no rebuild (AC-G3).

| State | Trigger | Render | Binding copy |
|---|---|---|---|
| **unavailable (DEFAULT this phase, AC-G1)** | `google_available=false` | the control is **visibly present but disabled** (greyed, not clickable, not hidden); a quiet helper line explains why | button label `Continue with Google` (disabled) · helper `Google sign-in isn't available yet — use your email and password.` |
| **available (AC-G3)** | `google_available=true` (config supplied) | the control becomes **enabled/clickable** and starts the server-side Google flow | `Continue with Google` (enabled), no helper line |

Absent Google creds cause **no error, no crash, no broken screen** — the credentials path works end-to-end
beside the disabled control (AC-G2). The control is never a clickable path into a broken flow.

### 2.5 Logout control

| State | Render | Binding copy |
|---|---|---|
| **authenticated** | **Log out** in the account menu | `Log out` |
| **on logout success (AC-D1)** | account control flips to **unauthenticated** (`Sign in`); gated actions revert to prompting sign-in; who-am-I reports anonymous | — |

Logout is single-session this phase (D4 — no "log out everywhere").

### 2.6 Positions gated WRITE actions (NOT the whole route — D6a, AC-E1/E2/E3)

The Positions **route stays viewable anonymously** (AC-E3). Only the **write/state-bearing actions** gate:
open a sim position, edit/close one, place a resting limit, save a named view, accept an AI rec into the
tracker.

| State | Trigger | Render | Binding copy |
|---|---|---|---|
| **viewable-anonymous (AC-E3)** | logged out, on `/positions` | the surface renders; the positions table/cards render exactly as today; the **honest disclosure banner** (§2.8) is shown; write controls are in their **prompt-to-sign-in** state | (see disclosure §2.8) |
| **write-gated, logged out (AC-E1)** | logged out, user triggers a write action (e.g. taps **Open position**, **Save view**, **Accept rec**) | the action **does NOT execute** (no position created, no view saved); a **visible in-context sign-in prompt** appears (inline near the control or a small dialog), never a silent no-op and never a misleading error | `Sign in to track simulated positions.` + a `Sign in` button. For save-view: `Sign in to save a view.` For accept-rec: `Sign in to add this to your tracker.` |
| **write-enabled, signed in (AC-E2)** | signed in, user triggers a write action | the action **works** — the existing flow runs (the **mandatory confirm** dialog, `SIMULATED`) exactly as today | — (existing confirm copy unchanged) |
| **server-rejected (AC-E7)** | the FE check were bypassed / cookie stale | the server rejects with the auth-required outcome; the FE surfaces the same sign-in prompt; nothing is persisted | `Sign in to track simulated positions.` |
| **after sign-in return (D6c)** | user signs in from the prompt | returns to `/positions`; the write action is now available | — |

### 2.7 "Ask AI" gated action (D6b, D6f — auth-gate OUTERMOST, AC-E4/E5/E6)

The AI-rec surface (`apps/dashboard/src/app/ai-rec/`) is reachable anonymously; the **manual hand-off /
state-export floor stays anonymous-usable** (AC-E6). Only the **LLM-invoking "ask AI" action** gates.

| State | Trigger | Render | Binding copy |
|---|---|---|---|
| **ask-AI gated, logged out (AC-E4, D6f)** | logged out, user looks at / triggers the "ask AI" control | the control is in a **sign-in-prompt** state; the LLM is NOT invoked; **ai-rec's own `ai_eval`/cooldown/daily-cap/`no_key` messaging is NOT shown** | `Sign in to ask AI.` + a `Sign in` button |
| **manual floor stays anonymous (AC-E6)** | logged out | the **manual hand-off / state-export** controls render and work exactly as today | (existing export-floor copy unchanged) |
| **ask-AI enabled, signed in (AC-E5, D6f)** | signed in | the auth gate passes; from this point the control behaves under ai-rec's EXISTING gating (ready/changed, 60s cooldown, 50/day cap, `unavailable:no_key`) exactly as today — sign-in unlocks the call, it does not bypass ai-rec's internal gates. **Observable precedence order: auth first, then ai-rec's own gates.** | (existing ai-rec gating/cap/availability copy, only after sign-in) |
| **server-rejected (AC-E7)** | FE bypassed / cookie stale | server rejects the invoke with the auth-required outcome; FE shows the sign-in prompt; LLM not invoked | `Sign in to ask AI.` |

### 2.8 Honest browser-local-positions disclosure (D6d, mandatory — PRODUCT_CONTRACT §8.5)

A **persistent, non-dismissable-by-default informational banner** (or caption) on the Positions surface.
It must NOT imply sync, privacy, or account-scoping. Binding copy:

> **Simulated positions are stored in this browser, not tied to your account yet.** They aren't synced
> across devices and aren't cleared when you log out — anyone using this browser will see them.

This copy is shown **whether signed in or signed out** (it is a property of the data residency, not of
auth state). Do not write copy that says "your portfolio," "synced," "private to your account," or
"backed up."

### 2.9 Settings UI — the 3 light prefs (D7, AC-F1/F2/F3/F4)

A **Settings** surface (reachable from the account menu when signed in). Exactly three controls:

1. **Active persona** — a selector mirroring the existing persona picker's options.
2. **Default ticker** — a text/symbol input; the symbol the Ticker viewer lands on for `/ticker` (bare).
3. **Theme** — a selector: `Dark` · `Light` · `System` (values `dark`/`light`/`system`).

| State | Trigger | Render | Binding copy |
|---|---|---|---|
| **default, signed in (server-wins, D7)** | signed in; who-am-I returned `settings` | each control is pre-set to the **server** value; on `null` server values, control shows its app default (persona = Default, ticker = `TSLA`, theme = `dark`) | section title `Settings`; `Active persona`, `Default ticker`, `Theme` |
| **loading** | who-am-I / settings read in flight | controls show a brief disabled/placeholder state | — |
| **save in flight** | user changes a pref | the change is written through to the server (server-wins becomes the account's carried value) | a quiet `Saved` confirmation on success |
| **save error** | settings write fails | the control reverts to the last confirmed value; a non-blocking error | `Couldn't save that setting. Please try again.` |
| **anonymous (AC-F3, AC-A3)** | logged out | the **Settings surface is not the source of truth**; persona/theme behave **exactly as today** off the existing client-local stores (`gammaflow.personas.v1` for active persona; the theme/default-ticker client-local behavior). No server pref is applied. **Zero regression.** | — |
| **isolation (AC-F2)** | account Y signs in after account X saved a pref | the controls reflect **account Y's own** server value (or its default), never account X's | — |
| **score-neutral (AC-F4)** | any pref change | changing a pref does **NOT** change any computed bundle value (`opportunity_score`/`opportunity_tier`/`state_fingerprint`) — it only changes which default a UI lands on | — |

**Precedence rule (D7):** signed-in ⇒ server pref WINS and is source of truth; anonymous ⇒ client-local
stores unchanged; on sign-in ⇒ server value takes over. The FE MUST NOT repeatedly overwrite the server
value from local state on each login (that would break AC-F2 isolation).

### 2.10 Resilient trader path (AC-J1, AC-I1, AC-I2 — the central invariant)

The Ticker bundle + live SSE **never** depend on auth. When the auth subsystem fails:

- who-am-I resolves to **anonymous** (FE treats `subsystem_degraded`).
- The Ticker bundle (`GET /api/ticker/:symbol`) + the SSE stream open and render **exactly as today** — no
  500, no blanked chart caused by auth, no new required header / query param on the bundle path (AC-I2).
- The gated actions correctly show their **sign-in-required / "couldn't reach sign-in"** outcome, but the
  anonymous trading experience is intact.
- Score byte-identity (AC-I1) holds anonymous-vs-signed-in: identity changes nothing the engine sees.

---

## 3. Glossary / tooltip text (jargon honesty)

- **"Continue with Google" (disabled)** tooltip: `Google sign-in is wired up but turned off until Google
  credentials are configured for this server. Email + password works now.`
- **Honest-positions caption** (compact form, where space is tight): `Stored in this browser — not tied to
  your account.`
- **"Sign in to ask AI"** tooltip: `The AI recommendation call requires an account. Signing in unlocks it;
  the AI's own rate limits still apply afterward.`
- **Settings → Default ticker** helper: `The symbol the Ticker viewer opens to by default.`
- **Settings → Theme** helper: `Affects appearance only.` (reinforces score-neutrality, AC-F4.)

No tooltip, debug surface, or error renders a password, hash, session id, or secret (AC-H1/H2).

---

## 4. AC → component-state matrix (THIS IS THE REQUIRED-TESTS MATRIX)

> Each row maps one AC to the surface + component state(s) that satisfy it. The FE
> `FRONTEND_EXECUTION_CONTRACT.md` "Tests to write" matrix enumerates these as named cases so the FE
> implements the full set and never chooses the requirement set. QA traces every AC to ≥1 passing test at
> GATE Q. Server-enforcement ACs (E7, H1, H2, I1, J1) also bind the backend lane.

| AC | Surface · component state(s) | Lane(s) verifying |
|---|---|---|
| **AC-A1** anon browsing unchanged | Trader path §2.10 — bundle+SSE render as today, no sign-in wall | FE |
| **AC-A2** scanner/metrics/dark-pool/personas anon | Trader path §2.10 — those surfaces reachable + behave as today | FE |
| **AC-A3** anon persona/theme as today | Settings §2.9 anonymous state — client-local unchanged | FE |
| **AC-B1** signup success | Sign-up §2.2 success | FE |
| **AC-B2** duplicate email | Sign-up §2.2 error: duplicate email | FE + BE (409 distinct) |
| **AC-B3** invalid input | Sign-up §2.2 error: validation | FE + BE |
| **AC-C1** login success | Log-in §2.3 success | FE |
| **AC-C2** session survives reload | Auth entry §2.1 — who-am-I on remount reports same user | FE + BE (cookie resolve) |
| **AC-C3** bad creds non-enumerating | Log-in §2.3 error: bad credentials (single generic msg) | FE + BE (401 generic) |
| **AC-D1** logout → anonymous | Logout §2.5 success; gated actions revert to prompt | FE + BE |
| **AC-D2** stale/expired/revoked ⇒ anonymous | Auth entry §2.1 + gated actions — who-am-I anonymous despite cookie | FE + BE |
| **AC-E1** Positions write gated, logged out | Positions §2.6 write-gated logged out (visible prompt, no execute) | FE + BE |
| **AC-E2** Positions write works signed in | Positions §2.6 write-enabled signed in (mandatory confirm, SIMULATED) | FE + BE |
| **AC-E3** Positions route viewable anon | Positions §2.6 viewable-anonymous | FE |
| **AC-E4** ask-AI gated logged out | Ask-AI §2.7 ask-AI gated logged out — no LLM, no cooldown/cap/no_key shown | FE + BE |
| **AC-E5** ask-AI works signed in then existing gates | Ask-AI §2.7 ask-AI enabled signed in (auth-first, then ai-rec gates) | FE + BE |
| **AC-E6** manual floor stays anon | Ask-AI §2.7 manual floor anonymous | FE |
| **AC-E7** server-enforced gate | Positions §2.6 / Ask-AI §2.7 server-rejected | BE (primary) + FE |
| **AC-F1** pref survives logout→login same account | Settings §2.9 default signed-in (server-wins) | FE + BE |
| **AC-F2** per-account isolation | Settings §2.9 isolation | FE + BE |
| **AC-F3** anonymous prefs unchanged | Settings §2.9 anonymous | FE |
| **AC-F4** settings never touch score | Settings §2.9 score-neutral | BE (proof) + FE (no wiring) |
| **AC-G1** Google present-but-disabled | Google control §2.4 unavailable | FE + BE (`google_available=false`) |
| **AC-G2** no crash from absent creds | Google control §2.4 + Sign-up/Log-in load; credentials path works | FE + BE |
| **AC-G3** config-only activation | Google control §2.4 available (flips off `google_available`) | FE + BE |
| **AC-H1** no raw password surfaced | All auth surfaces — no password in any response/error/payload | BE (primary) + FE |
| **AC-H2** no secret reaches browser | All — no signing key / Google secret / session secret in any field | BE (primary) + FE |
| **AC-H3** non-enumerating login copy | Log-in §2.3 error: bad credentials (identical wrong-email == wrong-password) | FE + BE |
| **AC-I1** score byte-identity anon vs signed-in | Trader path §2.10 | BE (proof) + FE |
| **AC-I2** anon bundle/SSE unchanged | Trader path §2.10 — no new header/query param | BE + FE |
| **AC-J1** auth-subsystem failure ⇒ anon, trader path intact | Trader path §2.10 (subsystem-degraded) | BE + FE |

---

## 5. What this blueprint does NOT decide (deferred to INTERFACE/BE/FE)

- Final endpoint paths, methods, exact JSON field names/types, status numbers — `INTERFACE_CONTRACT.md`.
- Session mechanism, hashing, store ports, OAuth wiring, server enforcement — `BACKEND_EXECUTION_CONTRACT.md`.
- React component structure, hooks, test files — `FRONTEND_EXECUTION_CONTRACT.md`.
- The minimal password-length floor `{N}` — a BE/interface detail; the copy reads the number.
