# user-accounts — brief

Goal:            Add **user accounts** to Convexa — email/username + password signup & login, **"Continue
                 with Google"** (OAuth), and a persisted **server-side session** so a signed-in user stays
                 signed in across reloads. Back it with an **in-memory SQL database** (SQLite `:memory:`) as
                 the first credential/settings store — explicitly a prototype that resets on restart, designed
                 so swapping in a persistent DB later is a contained change (a storage seam, not a rewrite).
                 Store a small set of **per-user settings** server-side (basics + light prefs only — e.g.
                 active persona, default ticker, theme). **Google is WIRED BUT SHIPS DISABLED this phase
                 (owner decision 2026-06-25):** no Google Cloud OAuth client is provisioned yet, so the
                 server-side Google flow is built end-to-end but **config-gated OFF** — "Continue with Google"
                 renders unavailable/disabled until creds are supplied (exactly the `ANTHROPIC_API_KEY`-absent
                 ⇒ AI-rec `unavailable:no_key` pattern). **Email/username+password is the FUNCTIONAL login/
                 signup path now**; enabling Google later is **config-only** (set the env creds — no rebuild).
                 Access model is **hybrid (owner decision):** the app
                 stays usable anonymously for browsing — Landing, the Ticker/GEX viewer, the Scanner stub —
                 but two surfaces **require a signed-in session: the simulated Positions tracker / sim-trade
                 actions and the in-app AI recommendation ("ask AI") call.** Passwords are **hashed
                 (bcrypt/argon2), never stored or logged in plaintext**, even in the in-memory DB; all secrets
                 (Google client secret, the session-signing key) stay **server-side only, never in the
                 browser**.

Decision impact: Not a trading-edge feature — judged on **enabler/product value** (trading-decision cull
                 **N/A**, same class as operator/build-system features). It unlocks: per-user persistence of
                 settings, the owner's gating of cost/state-bearing features (sim positions + AI rec) behind a
                 real account, and is the **foundation Track B (`broker-connect`) requires** (you can't attach
                 real broker positions to "the current browser"). Observed via: a user can sign up and log in
                 with email/password AND with Google; the session survives a page reload (and clears on
                 logout); the two gated surfaces prompt for sign-in when logged out and work when logged in;
                 and a saved light pref (e.g. active persona / default ticker / theme) set while signed in
                 survives logout→login on the **same** account, while a different account sees its own.

Feasibility:    pass — config-gated for Google. In-memory SQLite is stdlib/SQLAlchemy (mind the
                 single-shared-connection / `StaticPool` setup so `:memory:` survives across requests rather
                 than vanishing per-connection); password hashing is a standard lib (passlib/bcrypt or
                 argon2); a server-side session is a signed HTTP-only cookie over a session record (mechanism
                 = the Architect's call: server session table vs stateless signed token). **Google OAuth** is
                 the server-side Authorization-Code flow (Authlib or google-auth) and needs a **Google Cloud
                 OAuth client (client ID + secret + redirect URI)** supplied via env — exactly the pattern of
                 the existing server-side `ANTHROPIC_API_KEY`. The *architecture* does not need real
                 credentials; the *working* Google login does (owner to provision, like the Massive/Anthropic
                 keys). NOTE: new backend Python deps (hashing + OAuth) must be added to `apps/api/
                 requirements.txt` and installed into the `.venv`.

Effort:          L

Invariant watch: `[additive-keeps-score-byte-identical]` (CONTEXT §5, locked) — auth, sessions, and per-user
                 settings are a **separate concern from the trading bundle**: `signals` /
                 `opportunity_score` / `opportunity_tier` / `state_fingerprint` / the entry gate stay
                 **byte-identical**, and **no user setting is ever a scoring input**. The existing bundle/SSE
                 path behaves identically for an anonymous request.
                 `[best-effort-isolated-or-null]` (CONTEXT §5, locked) — **with a deliberate carve-out the
                 Architect must frame:** the *bundle/SSE path* keeps its best-effort/None-on-failure semantics
                 and an auth-subsystem failure must never break it — BUT the **auth endpoints themselves are a
                 NEW class that legitimately returns real HTTP error codes** (e.g. 401 bad credentials, 409
                 duplicate email, 403 unauthenticated-on-a-gated-surface). The "null, never an HTTP error"
                 rule governs *added bundle computations*, not an auth surface; do not mis-apply it.
                 `[no-real-order-path]` (CONTEXT §5, locked) — **HONORED, untouched.** Accounts add no broker,
                 no order/execution path; the Positions tracker stays `SIMULATED` (paper). Gating it behind
                 login is an access control, not a step toward real orders.
                 `[operator-vs-trader-path-separation]` (CONTEXT §5) — kinship only: auth is a new
                 cross-cutting surface that must NOT gate or perturb the anonymous trader bundle/SSE path.
                 **NEW architectural note (not a promoted-canon reversal):** this is the **first stateful
                 backend surface + first credential store** — the project's "stateless server" property (today
                 true of the ghost-trade/bundle path) is *narrowed to the trading path*; auth introduces a
                 contained, swappable state store. The Architect frames the isolation; likely a GATE S ledger
                 note, not a GATE Z reversal.
                 **Feature-binding security floor (hard, regardless of scope):** passwords hashed (bcrypt/
                 argon2), never plaintext / never logged; Google client secret + session-signing key
                 server-side only, never shipped to the browser, env-supplied + gitignored. Red-team
                 (system-6) is **deferred** by owner decision (in-memory prototype = pre-live); it re-activates
                 when persistence becomes real or the app is publicly exposed.

Context tags:    architecture,backend,frontend,api,ui,conventions,decisions,features

Entry point:     architect-first — the dominant uncertainty is technical shape, not product (the owner
                 already fixed the product shape: hybrid gating + basics/light-prefs). Pivotal calls for the
                 Architect: the **session mechanism** (signed HTTP-only cookie over a server session table vs
                 a stateless signed token), the **in-memory SQLite setup + the persistent-DB swap seam** (a
                 `UserStore`/`SessionStore` port mirroring the existing `MarketDataProvider` /
                 `PositionsProvider`-port pattern), the **Google OAuth Authorization-Code flow** shape, the
                 **auth↔bundle isolation** (auth never perturbs the scoring/SSE path; auth's own error class),
                 the **per-user settings store** shape, and the **enforcement boundary** for the two gated
                 surfaces (how "requires a session" is checked server-side and reflected in the FE). It must
                 leave endpoints/payloads/UI/copy to downstream as open questions.

Source:          Owner request 2026-06-25: "add login/signup + user sessions; store certain settings for the
                 user; use an in-memory SQL database for credentials at first (email/username/password);
                 allow login or signup with Google." Clarified via GATE I questions — login is **optional
                 overall but required for the sim Positions tracker + the AI-rec call** (hybrid gating);
                 settings scope = **basics + light prefs** (heavy client-local stores — positions portfolio,
                 saved views — stay in localStorage for now, migrate later); security = **prototype-now with
                 the hygiene floor above, red-team (system-6) deferred** until real persistence / public
                 exposure. Advances the OWNER PIVOT program (accounts are a prerequisite for Track B
                 `broker-connect`). **Follow-up clarification 2026-06-25:** no Google Cloud OAuth client is
                 set up yet — ship the Google flow **wired but disabled** (config-gated OFF, enable later via
                 env), with **credentials login/signup as the functional path** for now.
