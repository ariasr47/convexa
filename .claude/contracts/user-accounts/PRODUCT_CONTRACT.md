# user-accounts — PRODUCT_CONTRACT

> PM → UX/Tech-Writer handoff. Reader has ONLY `.claude/PROJECT_CONTEXT.md` + the
> `ARCHITECTURE_CONTRACT.md` in this folder + this file. Product layer ONLY — user stories, scope,
> product behavior, acceptance criteria. **No code, math, endpoint signatures, payload/field names, or
> UI layout** (those are UX/BE's call). Decisions, not deliberation.
>
> Every **AC** below is a REQUIRED BEHAVIORAL TEST: one observable behavior apiece, verifiable WITHOUT
> reading code, that the FE executioner must cover and QA will trace 1:1 at GATE Q. Degraded/edge cases
> (stale / offline / empty / error / null / duplicate / unconfigured) are their OWN ACs, never buried.

FEATURE = `user-accounts`. Entry: architect-first (this contract derives its goal from the
ARCHITECTURE_CONTRACT + BRIEF; it does not re-scope the technical shape).

---

## 1. Goal (derived from the ARCHITECTURE_CONTRACT + BRIEF — not re-invented)

Give Convexa real user accounts. A visitor can **sign up and log in with email/username + password**
(the functional path now), see a **"Continue with Google" option that is present but disabled** because
no Google credentials are provisioned this phase, and **stay signed in across reloads** via a
server-side session. Signed-in users get **per-user settings** (a small bounded prefs set) persisted
server-side. The app stays **fully usable anonymously for browsing**; **two surfaces require sign-in** —
the **simulated Positions tracker / sim-trade actions** and the **in-app AI recommendation ("ask AI")
call**. This is the foundation for the later `broker-connect` track.

This is an **enabler feature** (trading-edge N/A) — judged on product/persistence value, not on score.

---

## 2. Binding constraints the next role (UX) MUST NOT violate

Restated from the ARCHITECTURE_CONTRACT §2/§6/§7 + the BRIEF's Invariant watch. These are promoted
canon; reopen only via GATE Z. UX must author no flow, copy, or component that breaks any of these.

- **`[additive-keeps-score-byte-identical]`** — auth / sessions / settings are a **separate concern
  from the trading bundle.** `opportunity_score` / `opportunity_tier` / `state_fingerprint` / the entry
  gate / `signals` stay **byte-identical** whether the requester is anonymous or signed-in. **No user
  setting is EVER a scoring input.** A setting may change which default a UI lands on; it can NEVER
  change a computed bundle value. The anonymous bundle/SSE request behaves **exactly as today** — no new
  required header, no new query param on the bundle path.
- **`[best-effort-isolated-or-null]` — WITH THE AUTH CARVE-OUT.** The "fail to null/omitted, never an
  HTTP error" rule governs **added bundle computations on the trading path** only. The **auth surface is
  a different class** that legitimately returns real HTTP statuses (signup/login/logout/session-status/
  gated actions). UX must NOT design auth errors as silent nulls. BUT: an **auth-subsystem failure must
  never break the bundle/SSE path** — the trader path degrades to **"treat as anonymous,"** never 500s.
- **`[no-real-order-path]`** — **HONORED, UNTOUCHED.** Accounts add no broker, no order/execution path,
  no real-position source. Positions stays `SIMULATED` (paper) behind its mandatory confirm; the "Live"
  tab stays zero-import LOCKED. Gating Positions behind login is **access control on a surface**, not a
  step toward real orders, and **not** a data-residency change (positions stay client-local this phase).
- **`[operator-vs-trader-path-separation]` (kinship)** — auth is a cross-cutting leaf that must NOT gate
  or perturb the anonymous trader bundle/SSE path.
- **Security floor (hard, regardless of scope):** passwords **hashed (bcrypt/argon2), never stored or
  logged or returned in plaintext** — even in the in-memory DB. The Google client secret + the
  session-signing key are **server-side only, never shipped to the browser**, env-supplied + gitignored.
  No raw password / session secret / signing key / Google secret ever appears in a response body, an
  error message, a log line, or a serialized payload. UX copy/states must never surface a secret and
  must keep failure copy **non-enumerating** (see §6, AC group H).
- **Prototype property (accepted):** the store is **in-memory and resets on process restart.** This is
  an owner-accepted limitation, not a bug. UX should not promise durable cross-restart accounts; the
  honest framing is "prototype / accounts reset when the server restarts" where it would mislead.

---

## 3. Product decisions made here (resolving ARCHITECTURE_CONTRACT §9, each in order)

> The Architect deferred eight items to the PM. Each is RESOLVED below as a recorded decision (not a
> deferral). Wire shape (endpoint names, field names, status-code numbers, layout, copy) stays with
> UX/BE — these decisions fix **product behavior**, not wire shape.

### D1 — API surface intent (resolves §9.1)
The user-facing operations that MUST exist this phase, named by INTENT only (UX/BE design the wire
shape and names):
- **Sign up** with email/username + password.
- **Log in** with credentials.
- **Log out** (ends the current session).
- **Session status / "who am I"** — a server-authoritative read the FE uses to learn signed-in-vs-
  anonymous, who the user is, and to resolve auth on reload. Must also expose **whether Google sign-in
  is currently available** (configured vs unconfigured/disabled) so the FE can render the Google option
  correctly without guessing.
- **Google start** + **Google callback** (built end-to-end, config-gated OFF this phase — see D9).
- **Settings read** + **settings write** (the bounded prefs bag, D7).

No "log out everywhere," password-reset, or email-verification operation ships this phase (D4, D8).

### D2 — Username: required vs optional, unique vs display-only (resolves §9.2)
**Decision: username is OPTIONAL and DISPLAY-ONLY. Email is the sole unique identity key.**
- Sign up requires **email + password**; username is an optional display handle.
- Login is by **email + password** (the canonical, always-present identifier). *(Whether the login
  field also accepts a username as an alias is a UX/BE convenience detail, NOT required this phase; the
  email path is the binding one.)*
- Username is **not** unique and is **not** an identity key — it is a presentation label only. Two
  accounts may share a display name; that is acceptable for a prototype.
- Rationale (recorded, not deliberated): email is already the unique, case-insensitive join key the
  Architect fixed (§3.1) and the key Google account-linking hinges on (§4). Making username also-unique
  would add a second uniqueness namespace and collision-copy surface for no product value this phase.

### D3 — Account-linking policy on verified-email Google match (resolves §9.3)
**Decision: AUTO-LINK on a verified-email Google match — no separate explicit-confirm step this phase.**
- When a Google callback returns a **verified email that matches an existing local account**, the server
  links the Google identity onto that existing user (one user, both a local password and a linked Google
  identity), per Architect mapping rule §4.2, and signs them in.
- Rationale: Google is **disabled this phase** (D9), so this path is **unreachable in production until
  creds are provisioned** — it cannot be exercised by a real user now. Adding a confirm-consent flow
  would be unverifiable UX built around a disabled path. Auto-link is the simpler buildable behavior and
  is the standard "same verified email = same person" assumption. **Future-dated (F-fut, §5):** if/when
  Google is enabled and red-team (system-6) re-activates, revisit whether an explicit "link to your
  existing account?" confirm is warranted before go-live.
- UX constraint: because Google is disabled now, **no linking-consent screen is required this phase.**
  Do not build a confirm-link flow against a path that cannot run.

### D4 — Session duration / rolling-vs-absolute / "remember me" / "log out everywhere" (resolves §9.4)
**Decisions:**
- **Absolute expiry, with a rolling (idle) refresh.** A session has a fixed maximum lifetime AND
  refreshes its idle window on activity, so an actively-used session does not expire mid-use but an
  abandoned one eventually does. Concrete durations are **security/operator config** (env), not product
  copy — the PM fixes the *behavior* (sessions expire; active use keeps you signed in; an expired
  session is anonymous), not the numbers.
- **No "remember me" toggle this phase.** Sessions persist across reload by default (the whole point);
  a separate remember-me control adds a duration-policy surface with no clear product win for a
  prototype. **Future-dated (F-fut).**
- **"Log out everywhere" does NOT ship this phase** (Architect §8 non-goal; SessionStore is shaped to
  allow it later — designed-for, not built). Logout this phase is **single-session.**
- Observable consequence the ACs cover: signed-in survives reload; logout clears it; an expired/revoked/
  unknown session resolves to **anonymous** (AC groups C, D).

### D5 — Auth error → case mapping & non-enumerating copy intent (resolves §9.5)
**Decision (product intent; exact status NUMBERS + envelope shape are UX/BE):** the auth surface returns
**real, distinguishable outcomes** for at least these product cases, each with its own user-visible
treatment:
- **Bad credentials on login** (wrong email or wrong password) → a single **generic "those credentials
  didn't match"** outcome. It MUST be **non-enumerating**: the same message whether the email is unknown
  or the password is wrong — never "no account with that email" vs "wrong password." (Architect §7
  security-of-errors.)
- **Duplicate email on signup** (email already registered) → a distinct **"that email is already
  registered"** outcome (a deliberate, accepted enumeration on the SIGNUP path only — necessary to tell
  the user to log in instead; this is standard and acceptable). Login stays non-enumerating; signup may
  reveal email-taken.
- **Unauthenticated on a gated surface/action** → a distinct **"sign in to do this"** outcome the FE
  turns into a sign-in prompt (D6), never a silent proceed and never a generic crash.
- **Validation failures** (e.g. malformed email, empty password, password below a minimal length floor)
  → a clear field-level **"fix this input"** outcome. *(The minimal password floor is a UX/BE detail; a
  floor must exist, but its value is not product copy here.)*
- **Auth-subsystem failure** (store/session/OAuth broke) → on the **trader path**, degrade to anonymous
  (never 500 the bundle/SSE); on a **gated action**, surface an honest "couldn't reach sign-in right
  now" rather than a misleading "wrong password." (AC groups H, J.)

### D6 — Gated-surface product behavior (resolves §9.6, the §8a OPEN TENSION — strict-PM call)
The Architect flagged this as the central product tension. Decisions, made deliberately:

- **D6a — Positions gating granularity: GATE THE WRITE/STATE-BEARING ACTIONS, not the whole route.**
  The Positions **page/route is viewable anonymously** (you can navigate to it and see the surface), but
  every **sim-trade write/state-bearing action** — opening a simulated position, editing/closing one,
  placing a resting limit, saving a named view, accepting an AI rec into the tracker — **requires a
  signed-in session and is server-enforced (D6e).** Rationale: the heavy positions store is client-local
  this phase (Architect §3.3) so there is no server data to hide; gating *viewing* a local-only surface
  adds friction with no security benefit, while gating the *actions* delivers the owner's intent
  (account-gate the state/cost-bearing behavior) and is the honest server-enforceable boundary. An
  anonymous visitor sees the Positions surface with its actions **prompting sign-in** (D6c).
  - *UX note:* the FE-side disable/prompt is necessary-for-UX but is **not** the enforcement of record —
    the **server** is (D6e). Do not present the FE check as the security boundary.

- **D6b — AI-rec gating: the "ask AI" call requires a signed-in session.** The in-app AI recommendation
  invocation is a cost/state-bearing action and is gated. Everything ELSE about the rec surface that
  does not invoke the LLM (e.g. the always-available manual hand-off / state-export floor) **stays
  anonymous-usable**, consistent with Architect §8a (the manual floor is not the gated cost-bearing
  action). UX decides which controls render disabled-with-prompt vs available; the binding line is: **the
  LLM-invoking "ask AI" action is sign-in-gated and server-enforced.**

- **D6c — Sign-in prompt behavior on each gated surface.** When logged out, each gated action presents a
  **clear, in-context prompt to sign in** (the action is visibly unavailable with a path to sign-in),
  **never** a silent no-op and **never** a misleading error. After a successful sign-in the user returns
  to the surface they were on and the action becomes available. (Layout/copy = UX; the binding behavior
  is: visible-prompt-not-silent, and works-after-sign-in.)

- **D6d — localStorage positions across logout / different-user-same-browser (the data-residency
  reality).** Adopting the owner-blessed default (Architect §8a / the owner steer), recorded as a
  **strict-PM decision with an explicit, documented limitation**:
  - On **logout**, the browser-local simulated positions are **NOT cleared** and are **NOT account-
    scoped.** They remain in localStorage.
  - If a **different user signs in on the same browser**, they will **see the same browser-local
    positions** (positions are not yet partitioned per account).
  - This is a **known, documented limitation of the prototype**, cleaned up when the heavy stores migrate
    server-side later (Architect "design-for" seam). UX MUST surface this honestly where it would
    otherwise mislead — i.e. the positions surface should make clear (in copy) that **simulated positions
    are stored in this browser and are not tied to your account yet**, so a user does not assume their
    sim portfolio is private-to-their-login or synced across devices.
  - Strict-PM check (why I did not override the default): clearing or hiding positions on logout would
    risk **silent data loss** of a user's paper-sim work for a privacy guarantee we cannot actually keep
    (the data never left the browser), which is worse than an honest "stored in this browser" disclosure.
    Bounce candidate considered and REJECTED — see §7 (no amendment needed; the honest-disclosure path is
    buildable within the technical shape).

- **D6e — Enforcement is SERVER-SIDE (binding).** For BOTH gated surfaces, the **server** resolves the
  session and rejects an unauthenticated/expired/revoked gated action with the auth "sign-in-required"
  outcome (D5). The FE prompt is UX sugar on top; it is not the boundary of record. (Architect §8a.)

- **D6f — Precedence of the auth-gate vs ai-rec's existing cap/gate messaging.** The **auth-gate is the
  OUTERMOST precondition** and is evaluated FIRST. If the user is not signed in, the surface shows
  **"sign in to ask AI"** and does NOT show ai-rec's internal `ai_eval`/cooldown/daily-cap/`no_key`
  messaging at all (those are only meaningful once you're allowed to ask). Only AFTER sign-in does the
  existing ai-rec gating (ready/changed, 60s cooldown, 50/day cap, `unavailable:no_key`) apply and
  surface as it does today. The new auth gate **composes in front of** the existing gating; it does not
  replace it (Architect §8a). Observable order: **auth first, then ai-rec's own gates.** (AC group E.)

### D7 — Settings catalog this phase + server-pref-vs-localStorage precedence (resolves §9.7)
**Decision — the closed settings catalog this phase is exactly THREE light prefs:**
1. **Active persona** (which trader persona is selected).
2. **Default ticker** (the ticker the Ticker viewer lands on by default).
3. **Theme** (the UI theme preference).

No other setting persists server-side this phase (the heavy positions/saved-views stores stay
client-local — Architect §3.3 non-goal). Each value is **presentation/preference only** and is **NEVER**
read by `signals`/`engine`/`live`/`darkpool`/scoring/tiering/the fingerprint (§2 hard invariant).

**Precedence on a signed-in reload (server pref vs the existing client-local persona/theme stores):**
- **When SIGNED IN: the server-side per-user setting WINS** and is the source of truth. On sign-in /
  reload-while-signed-in, the app reflects the **server** value for active-persona / default-ticker /
  theme (so the same account sees its own prefs on any reload). A change made while signed in is written
  through to the server and becomes the value the account carries to its next login.
- **When ANONYMOUS: the existing client-local stores remain in effect, unchanged** (anonymous users keep
  today's localStorage-backed persona/theme behavior — no regression). UX must ensure the anonymous
  experience for persona/theme is **exactly as today**.
- **On sign-in:** the **server value takes over** for these three prefs. *(Whether a one-time "adopt my
  current local choices into my new/just-signed-in account" merge happens on FIRST sign-up is a UX
  nicety, allowed but not required; the binding rule is server-wins-while-signed-in, anonymous-unchanged.
  Do not silently and repeatedly overwrite the server value from local state on every login — that would
  break per-account isolation, AC group F.)*

### D8 — Minimal email-verification / password-reset in scope? (resolves §9.8)
**Decision: OUT this phase → FUTURE.** I adopt the Architect's default. Rationale (recorded): the store
is in-memory and resets on restart (a reset/verify flow has no durable target), email-verification needs
an email-sending dependency the owner has not provisioned, and red-team is deferred. There is no product
reason to override — these flows have no functional home in a prototype that forgets accounts on restart.
The architecture does not preclude them later (the user record can carry verification state). **Future-
dated (F-fut, §5.)**

### D9 — Google ships WIRED-BUT-DISABLED as a first-class state (owner steer 1, made explicit)
This is a fixed owner decision; recording the product layer around it:
- "Continue with Google" is **built end-to-end on the server but config-gated OFF** until Google
  credentials are supplied — exactly the missing-`ANTHROPIC_API_KEY` ⇒ AI-rec `unavailable:no_key`
  precedent.
- **Disabled-when-unconfigured is a FIRST-CLASS SHIPPING STATE**, not a fallback. It has its own ACs
  (AC group G): the Google option is **visibly present but disabled/unavailable**, the **credentials
  path works** as the functional login/signup, and **absent Google creds cause no error, no crash, and
  no broken sign-in screen.**
- **Enabling Google later is config-only (no rebuild):** supply the env creds and the option becomes
  available; the session-status read already reports availability (D1) so the FE flips to enabled without
  a code change. **Future-dated activation (F-fut).**

### D10 — Anonymous browsing is unchanged (owner steer 2 corollary, made explicit)
Landing, the Ticker/GEX viewer, the Scanner stub, the four metrics, dark-pool, personas read, and the
bundle/SSE itself **stay anonymous-usable and behave exactly as today.** Adding accounts changes nothing
for a user who never signs in except that the **gated actions** (D6) now prompt for sign-in. (AC group A.)

---

## 4. User stories

- **U1 — Anonymous browser.** As a visitor who never signs in, I can use Landing, the Ticker/GEX viewer,
  and the Scanner stub exactly as before, so accounts don't get in my way.
- **U2 — New user (credentials).** As a new visitor, I can sign up with my email + password (optionally a
  display name) and be signed in, so I have an account.
- **U3 — Returning user (credentials).** As a returning user, I can log in with my email + password and
  stay signed in across reloads, so I don't re-authenticate constantly.
- **U4 — Logout.** As a signed-in user, I can log out and be returned to the anonymous experience, so I
  can end my session.
- **U5 — Gated Positions.** As a user, the simulated Positions actions (open/edit/close a sim trade, save
  a view) prompt me to sign in when I'm logged out and work when I'm signed in, so those actions are
  account-gated.
- **U6 — Gated AI rec.** As a user, the "ask AI" recommendation call prompts me to sign in when I'm
  logged out and works when I'm signed in (then behaves per its existing gating), so the AI call is
  account-gated.
- **U7 — Google option (disabled now).** As a user, I see a "Continue with Google" option that is clearly
  present but unavailable this phase, with credentials as the working path, so the feature is honest about
  what works.
- **U8 — Per-user prefs.** As a signed-in user, my active persona / default ticker / theme persist with my
  account across logout→login on the same account, and a different account sees its own prefs, so the app
  remembers me.
- **U9 — Resilient trader.** As any user, if the sign-in subsystem is having problems, the Ticker bundle
  and live stream keep working (I'm just treated as anonymous), so auth never takes the chart down.

---

## 5. Scope

### In scope (this phase)
- Credentials **signup / login / logout** (email unique + case-insensitive; username optional display-
  only — D2).
- **Server-side session** that survives reload and clears on logout; stale/expired/revoked ⇒ anonymous
  (D4).
- **Session-status / who-am-I** read, including **Google-availability** flag (D1).
- **"Continue with Google" present-but-disabled** (config-gated OFF; first-class state — D9).
- **Two server-enforced gated surfaces**: Positions sim-trade actions (D6a) + the "ask AI" call (D6b),
  with sign-in prompts (D6c) and the auth-gate-first precedence over ai-rec gating (D6f).
- **Per-user settings**: active persona, default ticker, theme — server-wins-while-signed-in,
  anonymous-unchanged, per-account isolated (D7).
- Honest **disclosure** that simulated positions are browser-local and not yet account-scoped (D6d).
- The **security floor** observable in product behavior (no plaintext password / secret ever surfaced —
  AC group H).

### Out of scope (this phase)
- **"Log out everywhere" / multi-device session sync / admin console** (D4; designed-for, not built).
- **"Remember me" toggle** (D4).
- **Persistent-DB adapter** — the store resets on restart (accepted prototype property); the swap seam is
  built but no Postgres/file adapter.
- **Migrating heavy client-local stores** (positions portfolio, saved views) to the server — they stay
  client-local; settings = the three light prefs only.
- **Account-scoped / per-user partitioning of the browser-local positions** (D6d limitation).
- **Real broker / order / execution path** — `[no-real-order-path]` honored; "Live" tab stays LOCKED.
- **Red-team / system-6 hardening** (owner-deferred while in-memory/pre-live; the §2 floor still applies).

### Future-dated (F-fut — explicitly named, not silently dropped)
- **Enable Google login** by provisioning env creds (config-only, no rebuild — D9).
- **Explicit account-linking confirm** on verified-email Google match, revisited with red-team before
  go-live (D3).
- **Email-verification + password-reset** flows once persistence + an email dependency exist (D8).
- **"Remember me," "log out everywhere," multi-device session management** (D4).
- **Migrate heavy stores server-side + account-scope the positions** (closes the D6d limitation).

---

## 6. Acceptance criteria (each AC = one observable behavioral test; degraded cases are their own ACs)

> Observable WITHOUT reading code. QA traces each to ≥1 named passing test. Grouped for readability; the
> ID is the traceable unit.

### Group A — Anonymous browsing unchanged
- **AC-A1** — Without signing in, a visitor can open Landing, navigate to the Ticker/GEX viewer for a
  symbol, and see the bundle render exactly as it does today (chart + tiles), with the live stream
  behaving as today. No sign-in wall blocks browsing.
- **AC-A2** — Without signing in, the Scanner stub, the four positioning metrics, dark-pool section, and
  the personas read are all reachable and behave exactly as today.
- **AC-A3** — Anonymous persona/theme selection behaves exactly as today (client-local), with no
  regression from the addition of accounts.

### Group B — Signup
- **AC-B1** — A visitor signs up with a valid new email + password (optionally a display name) and ends
  up signed in (the app reflects a signed-in state immediately).
- **AC-B2 (edge: duplicate email)** — Signing up with an email that is already registered yields the
  distinct "email already registered" outcome (D5), not a generic error and not a silent success, and no
  second account is created.
- **AC-B3 (edge: invalid input)** — Signing up with a malformed email or a password below the minimal
  floor yields a clear field-level validation outcome and does NOT create an account.

### Group C — Login + session survives reload
- **AC-C1** — A registered user logs in with the correct email + password and reaches a signed-in state.
- **AC-C2** — After logging in, **reloading the page keeps the user signed in** (the session is resolved
  from the cookie server-side; who-am-I reports the same user).
- **AC-C3 (edge: bad credentials, non-enumerating)** — Logging in with a wrong password OR an
  unregistered email yields the **same single generic "credentials didn't match"** outcome — the two
  cases are indistinguishable to the user (no "no such email" vs "wrong password"). No session is
  created.

### Group D — Logout + stale-cookie ⇒ anonymous
- **AC-D1** — A signed-in user logs out and is returned to the anonymous experience; who-am-I reports
  anonymous and the gated actions go back to prompting for sign-in.
- **AC-D2 (edge: stale/expired/revoked cookie)** — A request carrying a session cookie that points at an
  expired, revoked, or unknown session resolves to **anonymous** (never to a valid session) — observable
  as: the gated actions prompt for sign-in and who-am-I reports anonymous, despite the cookie's presence.

### Group E — Gated surfaces (prompt when logged out, work when signed in)
- **AC-E1 (Positions, logged out)** — While logged out, attempting a Positions sim-trade write action
  (e.g. open a simulated position / save a named view) presents a visible **sign-in prompt** and the
  action does NOT execute (no position created, no view saved). It is not a silent no-op.
- **AC-E2 (Positions, signed in)** — While signed in, the same Positions sim-trade action **works** (the
  simulated position is created / the view is saved), `SIMULATED`, behind its existing mandatory confirm.
- **AC-E3 (Positions route still viewable anonymously)** — While logged out, navigating to the Positions
  route still shows the surface (D6a — the route is not blocked); only the write actions prompt to sign
  in.
- **AC-E4 (AI rec, logged out)** — While logged out, the "ask AI" call presents a visible sign-in prompt
  and does NOT invoke the LLM; ai-rec's own cooldown/cap/`no_key` messaging is NOT shown at this point
  (auth-gate is outermost — D6f).
- **AC-E5 (AI rec, signed in)** — While signed in, the "ask AI" call is allowed to proceed and from that
  point behaves under its EXISTING gating (ready/changed, cooldown, daily cap, `no_key`) exactly as
  today — i.e. sign-in unlocks the call, it does not bypass ai-rec's internal gates.
- **AC-E6 (manual floor stays anonymous)** — The always-available manual hand-off / state-export floor
  (the non-LLM path) remains usable without signing in (D6b).
- **AC-E7 (server-enforced)** — A gated action attempted without a valid session is rejected at the
  server with the auth "sign-in-required" outcome even if a FE check were bypassed — i.e. the enforcement
  is server-side, not FE-only (D6e). *(Observable via the gated action failing server-side when no valid
  session is present.)*

### Group F — Per-user settings persistence + isolation
- **AC-F1** — A signed-in user changes a light pref (active persona / default ticker / theme); after
  **logout → login on the SAME account**, the app reflects the saved pref value (server-wins — D7).
- **AC-F2 (isolation)** — A pref saved by account X is NOT seen by account Y: signing in as a different
  account reflects **that account's own** pref value (or its default), not account X's. Per-account
  isolation holds.
- **AC-F3 (anonymous unchanged)** — While anonymous, persona/theme behave per today's client-local
  stores with no server pref applied (no regression — D7 / AC-A3).
- **AC-F4 (settings never touch the score)** — Changing any light pref does NOT change any computed
  bundle value: `opportunity_score` / `opportunity_tier` / `state_fingerprint` for a given ticker+filter
  are byte-identical before and after the pref change. (Settings are presentation-only — §2.)

### Group G — Google present-but-disabled-when-unconfigured (first-class state)
- **AC-G1** — With no Google credentials configured, the "Continue with Google" option is **visibly
  present but disabled/unavailable** (not hidden, not clickable into a broken flow), and the
  session-status read reports Google as unavailable.
- **AC-G2 (no crash from absent creds)** — With no Google credentials configured, the sign-in/sign-up
  experience loads and the **credentials path works end-to-end**; absent Google creds produce **no error,
  no crash, and no broken auth screen** (the missing-`ANTHROPIC_API_KEY` precedent).
- **AC-G3 (config-only activation, observable)** — When Google credentials ARE present (e.g. in a
  configured environment), the option reports available/enabled via the session-status read — i.e.
  availability is driven by config, not a rebuild (D9). *(Verifiable by toggling the configured-state at
  the network boundary; the FE flips present-disabled ↔ present-enabled off the availability signal.)*

### Group H — Security floor (observable: no secret ever surfaces)
- **AC-H1** — At no point does a **raw password** appear in any response body, error message, or
  client-visible payload (signup, login, who-am-I, settings, errors) — passwords are never echoed back.
- **AC-H2** — No **session-signing key, Google client secret, or server session secret** ever reaches the
  browser (not in any response, not in any config the FE receives, not in an error).
- **AC-H3 (non-enumerating login copy)** — The login-failure outcome copy does not reveal whether the
  email exists (re-asserts AC-C3 at the copy level — the wrong-email and wrong-password messages are
  identical).

### Group I — Score byte-identity anonymous vs signed-in (the central invariant)
- **AC-I1** — For the same ticker + DTE/expiration filter, the bundle's `opportunity_score`,
  `opportunity_tier`, and `state_fingerprint` are **byte-identical** whether the request is anonymous or
  carries a valid signed-in session. Identity changes nothing the engine sees.
- **AC-I2** — The anonymous bundle/SSE request behaves exactly as today: no new required header and no
  new query param on the bundle path are needed to fetch a bundle or open the stream.

### Group J — Auth-subsystem failure degrades to anonymous (does not break the trader path)
- **AC-J1** — When the auth subsystem is failing (store/session/OAuth error), fetching the Ticker bundle
  and opening the live SSE stream **still work** — the trader path is treated as **anonymous** and is not
  broken (no 500 on the bundle, no blanked chart caused by auth). The gated actions correctly show their
  sign-in-required / "couldn't reach sign-in" outcome, but the anonymous trading experience is intact
  (D5 / §2 carve-out).

---

## 7. Amendments bounced to the Architect

**None.** Every product outcome decided in §3 is buildable within the technical shape the Architect
fixed (records §3, mechanism §5, leaf isolation §6, auth error class §7, gated-surface server enforcement
§8a). The one tension that risked a bounce — D6d (browser-local positions not account-scoped) — is
resolved by **honest disclosure**, which is fully buildable on the existing client-local store and
requires no architecture change. The technical shape supports every needed product behavior; no
ARCHITECTURE_CONTRACT amendment is requested.

---

## 8. Constraints restated for UX (the next role) — do not violate

1. **No setting is a scoring input; score byte-identical anon vs signed-in** — UX must not wire any pref
   into a bundle/score path (it cannot, by the leaf boundary, but no UX flow should imply it does).
2. **Auth errors are real HTTP outcomes, NOT silent nulls** — UX designs distinct, honest states for
   bad-credentials / duplicate-email / sign-in-required / validation / subsystem-down; but **login copy
   stays non-enumerating** (wrong-email and wrong-password look identical).
3. **Server is the enforcement boundary for the two gated surfaces** — the FE prompt/disable is UX sugar;
   never present it as the security boundary.
4. **Google disabled-when-unconfigured is a first-class state with its own copy/treatment** — present but
   unavailable, credentials path works, no crash. Do not hide it and do not let it open a broken flow.
5. **Honest disclosure for browser-local positions** — copy must make clear simulated positions are
   stored in this browser and are not yet tied to the account (not cleared on logout, visible to a
   different account on the same browser).
6. **No secret in the browser, no plaintext password anywhere** — no UX state, debug surface, or error
   may render a secret/hash/raw password.
7. **Auth-gate is outermost over ai-rec gating** — logged-out "ask AI" shows "sign in," not ai-rec's
   cooldown/cap/`no_key`; those only appear after sign-in.
8. **Anonymous experience is unchanged** — adding accounts must not regress any of today's anonymous
   browsing, persona, or theme behavior.
