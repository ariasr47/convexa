# user-accounts — FRONTEND_EXECUTION_CONTRACT

> UI work + component states ONLY. References `INTERFACE_CONTRACT.md` for what it CONSUMES + `UX_BLUEPRINT.md`
> for surfaces/copy/states. NO server internals. Reader has ONLY `.claude/PROJECT_CONTEXT.md` +
> `INTERFACE_CONTRACT.md` + `UX_BLUEPRINT.md` + this file. Target: `apps/dashboard` (+ `libs/api`). Tests:
> `npx nx test dashboard` (Vitest + jsdom + Testing Library + user-event), colocated `*.spec.tsx`.

FEATURE = `user-accounts`. **The FE does not decide the requirement set** — the "Tests to write" matrix (§4)
is the floor (each AC × component state × edge/invariant). The FE implements that set + may add unit tests;
it never silently drops a listed case (untestable ⇒ GATE Z bounce). QA traces every AC to ≥1 named passing
test at GATE Q.

---

## 1. What the FE consumes (from INTERFACE_CONTRACT — names only)

- **`GET /api/auth/session`** (who-am-I) → `authenticated`, `user{id,email,display_name,auth_methods}|null`,
  `google_available`, `settings{active_persona_id,default_ticker,theme}|null`. Called on mount + after every
  auth transition. **On failure/unreachable ⇒ treat as anonymous** + set a transient `subsystem_degraded`
  flag (drives gated-action "couldn't reach sign-in" copy only — NEVER the trader path).
- **`POST /api/auth/signup`** / **`POST /api/auth/login`** → success ⇒ identity shape; errors via status +
  `error` code (`email_taken`/`validation`/`bad_credentials`/`auth_unavailable`).
- **`POST /api/auth/logout`** → flip to anonymous.
- **`GET /api/auth/settings`** / **`PUT /api/auth/settings`** → the prefs bag; anonymous → 401.
- **Gated-action outcome** → 403 `auth_required` (sign-in prompt) / 503 `auth_unavailable` (couldn't reach).
- **The bundle/SSE path is UNCHANGED** — `getTicker` / `streamTicker` gain **no new header, no new query
  param** (AC-I2). Auth is a separate concern from the trading bundle.

Add the auth fetchers + types to `@org/api` (`libs/api/src/lib/gammaflow.ts`) so components never call
`fetch` directly (mirror the existing client pattern). New types: `SessionStatus`, `AuthUser`,
`UserSettings`.

---

## 2. Surfaces to build (per UX_BLUEPRINT §2 — copy is binding there)

1. **Account control** in `AppShell` (top-right): loading / unauthenticated (`Sign in`) / authenticated
   (name + menu: `Settings`, `Log out`) / subsystem-degraded (treated as unauthenticated).
2. **Sign-up form** (dialog/page): default / loading / duplicate-email / validation / auth-unavailable /
   success. Includes the **Continue with Google** control.
3. **Log-in form**: default / loading / **bad-credentials NON-ENUMERATING** (single generic message) /
   validation / auth-unavailable / success. Includes the **Continue with Google** control.
4. **Continue with Google control** (in both forms): unavailable (present + disabled, default this phase) ↔
   available (enabled), driven by `google_available` from who-am-I (config-only flip, no rebuild).
5. **Positions gated WRITE actions** (in `apps/dashboard/src/app/positions/`): viewable-anonymous (route NOT
   blocked) / write-gated-logged-out (visible sign-in prompt, no execute) / write-enabled-signed-in
   (existing mandatory confirm, `SIMULATED`) / server-rejected (FE shows prompt). The **honest disclosure
   banner** is always shown on the Positions surface.
6. **Ask-AI gated action** (in `apps/dashboard/src/app/ai-rec/`): ask-AI-gated-logged-out (sign-in prompt,
   NO cooldown/cap/no_key shown — auth outermost) / manual-floor-anonymous (export floor works) /
   ask-AI-enabled-signed-in (then existing ai-rec gating). **Auth gate composes IN FRONT of** the existing
   ai-rec gating — do not modify ai-rec's internal gating.
7. **Settings UI** (3 prefs): signed-in server-wins / loading / save-in-flight / save-error / anonymous
   (client-local unchanged) / isolation. Theme adds `light`/`system` to the existing dark theme — wire a
   theme provider that reads the pref (server when signed in, client-local when anonymous).

---

## 3. Live-vs-static / degraded rules (binding — the central invariant)

- **Auth-subsystem failure ⇒ trader path degrades to anonymous.** The Ticker bundle (`getTicker`), the SSE
  subscription (`streamTicker`), and the GEX chart **NEVER break** because who-am-I failed. A failed who-am-I
  ⇒ render anonymous-capable UI; the chart/tiles/stream render exactly as today (AC-J1, AC-A1).
- **Zero regression to anonymous browsing / persona / theme.** When never signed in: Landing, Ticker viewer,
  Scanner, the four metrics, dark-pool, personas read, and persona/theme selection behave **exactly as
  today** off the existing client-local stores (`gammaflow.personas.v1`, the client-local theme/default-ticker
  behavior). No server pref applied (AC-A1/A2/A3, AC-F3).
- **Settings never touch the score** — the FE wires NO pref into any bundle/score path; a pref change only
  changes which default a UI lands on (AC-F4).
- **who-am-I is non-blocking** — the account control may show a brief loading placeholder, but the rest of
  the app renders immediately (anonymous-capable). No full-page auth spinner.

---

## 4. Tests to write (REQUIRED matrix — each AC × component state × edge/invariant)

> The FE implements EVERY case below (the floor). Name each test so QA can trace AC → test at GATE Q. Mock
> ONLY the network boundary (who-am-I, signup/login/logout, settings, gated-action outcomes, getTicker/SSE);
> never a live backend. The **flow-integration spec is the centerpiece** — it drives the real user flow
> end-to-end. Suggested files: `auth.flow.spec.tsx` (centerpiece), `auth-entry.spec.tsx`,
> `google-control.spec.tsx`, `gated-positions.spec.tsx`, `gated-ai-rec.spec.tsx`, `settings.spec.tsx`,
> `auth-invariants.spec.tsx`.

| # | AC | Test case (named behavioral assertion) | Component state / edge |
|---|---|---|---|
| T-A1 | AC-A1 | Anonymous: Landing opens, navigate to `/ticker/:symbol`, bundle (chart + tiles) renders + SSE behaves as today; no sign-in wall | trader path, anonymous |
| T-A2 | AC-A2 | Anonymous: Scanner stub, four metrics, dark-pool, personas read all reachable + behave as today | trader path, anonymous |
| T-A3 | AC-A3 | Anonymous: persona + theme selection behave per today's client-local stores, no regression | Settings anonymous |
| T-B1 | AC-B1 | Sign up with valid new email+password (+optional name) ⇒ signed-in immediately (account control flips) | Sign-up success |
| T-B2 | AC-B2 | Sign up with already-registered email ⇒ "That email is already registered…" inline, no account, not a generic error, not silent success | Sign-up duplicate-email (409) |
| T-B3 | AC-B3 | Sign up with malformed email OR short password ⇒ field-level validation, no account created | Sign-up validation (422) |
| T-C1 | AC-C1 | Log in with correct email+password ⇒ signed-in state reached | Log-in success |
| T-C2 | AC-C2 | After login, remount/reload ⇒ who-am-I reports same user, still signed in | Auth entry, reload persistence |
| T-C3 | AC-C3 | Log in with wrong password ⇒ generic "Those credentials didn't match…"; log in with unknown email ⇒ **identical** message; assert the two messages are byte-identical and neither reveals email existence; no session | Log-in bad-credentials NON-ENUMERATING (401) |
| T-D1 | AC-D1 | Signed-in user logs out ⇒ account control flips to `Sign in`, gated actions revert to prompting, who-am-I anonymous | Logout success |
| T-D2 | AC-D2 | who-am-I returns anonymous despite a (stale) cookie present ⇒ gated actions prompt sign-in, account control shows `Sign in` | Stale/expired/revoked ⇒ anonymous |
| T-E1 | AC-E1 | Logged out, trigger a Positions write (Open position / Save view) ⇒ visible sign-in prompt, action does NOT execute (no position, no view), not a silent no-op | Positions write-gated logged out |
| T-E2 | AC-E2 | Signed in, same Positions write ⇒ works (position created / view saved) behind the existing mandatory confirm, `SIMULATED` | Positions write-enabled signed in |
| T-E3 | AC-E3 | Logged out, navigate to `/positions` ⇒ surface renders (route not blocked); only write actions prompt | Positions viewable-anonymous |
| T-E4 | AC-E4 | Logged out, "ask AI" ⇒ visible sign-in prompt, LLM NOT invoked, and ai-rec's cooldown/cap/`no_key` messaging is NOT shown (auth outermost) | Ask-AI gated logged out |
| T-E5 | AC-E5 | Signed in, "ask AI" ⇒ proceeds and from there behaves under EXISTING ai-rec gating (ready/changed, cooldown, cap, no_key); assert auth-first-then-ai-rec order | Ask-AI enabled signed in |
| T-E6 | AC-E6 | Logged out, the manual hand-off / state-export floor works without signing in | Ask-AI manual floor anonymous |
| T-E7 | AC-E7 | A gated action with no valid session is rejected (server 403 `auth_required`) even if a FE check were bypassed ⇒ nothing persists, prompt shown | Server-enforced gate |
| T-F1 | AC-F1 | Signed-in change a pref (persona/ticker/theme); simulate logout→login on the SAME account (who-am-I returns the saved value) ⇒ app reflects the saved pref (server-wins) | Settings server-wins |
| T-F2 | AC-F2 | Account X saved a pref; sign in as account Y (who-am-I returns Y's own value/default) ⇒ Y's value shown, not X's; FE does not overwrite server value from local state | Settings isolation |
| T-F3 | AC-F3 | Anonymous ⇒ persona/theme behave per client-local stores, no server pref applied | Settings anonymous |
| T-F4 | AC-F4 | Changing any pref does NOT change any rendered bundle value; assert `getTicker` is not re-called with a pref param and no score/tier/fingerprint changes in the UI | Settings score-neutral |
| T-G1 | AC-G1 | `google_available=false` ⇒ "Continue with Google" present but disabled (not hidden, not clickable into a flow) + helper copy | Google control unavailable |
| T-G2 | AC-G2 | `google_available=false` ⇒ sign-up/log-in load fine, credentials path works end-to-end, no crash/error/broken screen from absent creds | Google control + forms, no-crash |
| T-G3 | AC-G3 | Flip `google_available` false→true at the network boundary ⇒ control flips present-disabled → present-enabled with no rebuild | Google control config-only activation |
| T-H1 | AC-H1 | No response/error the FE renders ever contains a raw password (signup, login, who-am-I, settings, errors) — assert no password echoed in any surfaced state | Security floor |
| T-H2 | AC-H2 | No session id / signing key / Google secret / session secret appears in any consumed field or rendered surface | Security floor |
| T-H3 | AC-H3 | Login-failure copy is identical for wrong-email vs wrong-password and does not reveal email existence (copy-level re-assert of C3) | Non-enumerating copy |
| T-I1 | AC-I1 | (FE-observable) bundle render is identical anonymous vs signed-in for the same ticker+filter (no UI difference driven by identity); pairs with the BE byte-identity proof | Trader path invariant |
| T-I2 | AC-I2 | `getTicker` + `streamTicker` are called with NO new auth header / query param whether anonymous or signed-in | Trader path invariant |
| T-J1 | AC-J1 | who-am-I fails/unreachable ⇒ bundle + SSE still load and render (anonymous), chart never blanks; gated actions show "couldn't reach sign-in" (503) | Auth-subsystem failure ⇒ anonymous |

**Edge/degraded cases that are their own tests** (already rows above; restated so none is buried): duplicate
email (T-B2), invalid input (T-B3), non-enumerating bad-creds (T-C3/T-H3), stale-cookie ⇒ anonymous (T-D2),
server-enforced gate (T-E7), auth-outermost-over-ai-rec (T-E4/T-E5), per-account isolation (T-F2),
Google-disabled no-crash + config-flip (T-G1/G2/G3), subsystem-failure ⇒ trader-path-intact (T-J1).

---

## 5. Done criteria (GATE Q)

- `npx nx test dashboard` green with every T-row above named + passing; QA traces each AC → ≥1 named test.
- No regression of the existing suites (ticker, positions, ai-rec, personas, shell-live-lifecycle).
- The bundle/SSE path is provably unchanged (no new header/param; T-I2).
- Anonymous browsing/persona/theme behave exactly as today (T-A1/A2/A3, T-F3).
- Interface conformance (run by the BE/QA lane): `interface_conformance.py --spec
  .claude/tools/conformance/user-accounts.json` PASS.
