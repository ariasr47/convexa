# user-accounts — ARCHITECTURE_CONTRACT

> Architect → PM handoff. Reader has ONLY `.claude/PROJECT_CONTEXT.md` + this file. Compressed for the
> PM: decisions, not deliberation. Technical shape ONLY — no UI/layout, no endpoint signatures, no
> payload/JSON field names, no copy. Those are deferred as explicit **Open questions for the PM** (§9).
> The Architect cannot run or edit code (Read/Grep/Glob/Write only).

FEATURE = `user-accounts`. Entry: architect-first.

---

## 1. Goal (restated, scoped to technical shape)

Add user accounts to Convexa: email/username + password signup & login, "Continue with Google" (OAuth
Authorization-Code), and a **persisted server-side session** that survives reload. Back it with an
**in-memory SQLite (`:memory:`)** credential/settings store as the first cut (a prototype that resets on
process restart), behind a **clean swap seam** to a persistent DB later. Store a small **per-user settings**
record server-side (basics + light prefs only). **Hybrid access:** the app stays usable anonymously for
browsing (Landing, Ticker/GEX viewer, Scanner stub); **two surfaces require a signed-in session** — the
simulated Positions tracker / sim-trade actions AND the in-app AI recommendation ("ask AI") call.

This is the **first stateful backend surface + first credential store** in the project.

---

## 2. Binding constraints this feature MUST NOT violate (restated from PROJECT_CONTEXT §5)

These are promoted canon. Reopen only via GATE Z. Each is restated because this feature touches it.

- **`[additive-keeps-score-byte-identical]`** — auth, sessions, and per-user settings are a **separate
  concern from the trading bundle.** `signals` / `opportunity_score` / `opportunity_tier` /
  `state_fingerprint` / the entry gate stay **byte-identical**. **No user setting is EVER a scoring input.**
  An anonymous bundle/SSE request behaves **exactly as today** (same bytes, same timings, no new required
  header, no new query param on the bundle path). Enforcement = the module boundary in §6.

- **`[best-effort-isolated-or-null]` — WITH AN EXPLICIT AUTH CARVE-OUT (see §7).** The rule "an added
  computation fails to null/omitted, never an HTTP error" governs **ADDED BUNDLE COMPUTATIONS** on the
  trading path. The **auth surface is a NEW, separate class** that legitimately returns real HTTP status
  codes (401 / 403 / 409, etc.). The carve-out does NOT relax the trading path: an auth-subsystem failure
  must **never** break the bundle/SSE path (which keeps its None-on-failure semantics). Downstream MUST NOT
  mis-apply "null-not-error" to the auth endpoints.

- **`[no-real-order-path]`** — **HONORED, UNTOUCHED.** Accounts add no broker, no order/execution path, no
  real-position data source. The Positions tracker stays `SIMULATED` (paper). Gating Positions behind login
  is an **access control on a surface**, not a step toward real orders. The "Live" tab stays zero-import
  LOCKED.

- **`[operator-vs-trader-path-separation]` (kinship)** — auth is a new cross-cutting surface that must NOT
  gate or perturb the anonymous trader bundle/SSE path. It is not an operator route, but it inherits the
  spirit: a leaf that the trader/engine path never imports.

**Security floor (hard, feature-binding, regardless of scope):**
- Passwords **hashed (bcrypt or argon2)**, never stored or logged in plaintext — even in the in-memory DB.
- Google client secret + session-signing key are **server-side only, never shipped to the browser**,
  env-supplied + gitignored (mirrors the `MASSIVE_API_KEY` / `ANTHROPIC_API_KEY` pattern).
- A raw password / session secret / signing key / Google secret **never appears in a log line, a response
  body, an error message, or a serialized payload.**

**Architectural note (GATE S, NOT a GATE Z reversal):** the project's "stateless server" property is
**narrowed to the trading path** (which stays stateless: bundle, SSE, ghost-trade math all remain
client-local / recompute-from-vendor). Auth introduces a **contained, swappable state store** that lives
entirely outside that path. This narrows a descriptive property; it reverses no promoted canon. File as a
GATE S ledger note.

---

## 3. Data-structure CONTENT (the records — content & semantics, NOT field names/wire shape)

> The Architect specifies WHAT each record holds and the invariants on it. Concrete field NAMES, types,
> and the API wire shape are the PM's / UX's call (Open questions §9). Three records, three stores (§5).

### 3.1 User record (the credential / identity content)
- **Stable internal identifier** — opaque, server-assigned, never the email (email can change later);
  this is the foreign key sessions and settings hang off.
- **Email** — required, **unique (case-insensitive)**; the canonical identity key for both local and Google
  accounts (drives account-linking, §4).
- **Username/display handle** — present per the BRIEF ("email/username"); the PM decides whether it is
  required, unique, or display-only. (Open question §9.)
- **Password credential** — a **hash only** (bcrypt/argon2 incl. the algorithm's own salt). **Null/absent
  for a Google-only account** (no local password). The plaintext is never persisted or logged.
- **Auth-method / linkage facts** — enough to know "has a local password" and "has a linked Google identity"
  (the Google subject/`sub` identifier stored server-side for re-login matching). A single user may carry
  BOTH (linked — §4). Content only; the PM/UX name the fields.
- **Lifecycle timestamps** — created-at, last-login-at (audit/basics). No PII beyond what login requires.

### 3.2 Session record (server-side session — the chosen mechanism, §5.1)
- **Opaque session identifier** — high-entropy, server-generated; this (not user data) is what the cookie
  carries. The cookie value is signed; the session row is the source of truth.
- **Owning user** — FK to the user's stable identifier.
- **Issued-at + expiry** — absolute expiry (and optionally an idle/rolling expiry — PM call). Drives §5.1
  expiry/invalidation.
- **Revocation state** — a session can be invalidated server-side (logout, "log out everywhere", admin
  kill) **independently of the cookie** — the core reason for choosing server-side sessions (§5.1).
- **Minimal context** (optional) — created-from coarse context for audit; **no secret material.**

### 3.3 Per-user settings record (server-side, basics + LIGHT PREFS ONLY)
- **Owning user** — FK; one settings row per user.
- **Light prefs** — a SMALL, bounded set, e.g. **active persona id, default ticker, theme.** Treated as an
  opaque preferences bag from the engine's perspective.
- **HARD INVARIANT:** every value here is **presentation/preference only** and is **NEVER read by**
  `signals` / `engine` / `live` / `darkpool` / scoring / tiering / the fingerprint. A setting can change the
  default a UI lands on; it can **never** change a computed bundle value. This is the §2
  `additive-keeps-score-byte-identical` guarantee applied to settings.
- **NON-GOAL (this phase):** the **heavy client-local stores stay client-local** — the positions portfolio
  (`gammaflow.positions.v2`) and saved views remain in `localStorage`. Settings is basics + light prefs
  only. The future migration of those heavy stores to the server is a **"Design-for" seam** (the store port
  §5.2 is shaped so it could host them later), **NOT scoped here.**

---

## 4. Google OAuth — server-side Authorization-Code flow shape

- **Flow:** server-side **Authorization-Code** flow (not implicit, not browser-token). The browser is
  redirected to Google; Google redirects back to a **server-side callback**; the **server** exchanges the
  authorization code for tokens. The browser never sees the client secret or the Google tokens.
- **Secret custody:** Google **client ID, client secret, redirect URI** are **server-side env config**,
  mirroring `ANTHROPIC_API_KEY` / `MASSIVE_API_KEY` — env-supplied, gitignored. The **architecture must not
  require real credentials to be designed** (config-gated: absent creds ⇒ "Continue with Google" is
  unavailable/disabled, exactly as a missing `ANTHROPIC_API_KEY` ⇒ AI-rec `unavailable:no_key`). The owner
  provisions real creds for a *working* Google login, like the Massive/Anthropic keys.
- **CSRF/state:** the flow carries an anti-CSRF `state` value the server issues and verifies on callback
  (standard Authorization-Code hygiene). Mechanism is the BE executioner's; the contract requires it exist.
- **Identity → user mapping (account model):** on a successful Google callback the server reads the verified
  Google identity (stable `sub` + verified email). Mapping rules:
  1. **Known Google identity** (a user already linked to this `sub`) → log that user in.
  2. **New Google identity, email matches an existing local account** → **LINK** the Google identity onto
     the existing user (same stable identifier; the email is the join key). The result is one user with both
     a local password AND a linked Google identity. *(Whether linking is automatic on verified-email match
     or requires an explicit confirm step is a PM/UX/security policy call — Open question §9.)*
  3. **New Google identity, no matching email** → **create** a new user record (Google-only: no local
     password hash) + its settings row.
- **Out of the engine's path entirely** — OAuth lives in the auth leaf (§6); nothing on the bundle/SSE path
  imports or depends on it.

---

## 5. PIVOTAL ARCHITECT DECISIONS (made, with rationale)

### 5.1 Session mechanism — **DECIDED: signed HTTP-only cookie OVER a server-side session table**
(vs a stateless self-contained signed token / JWT-style.)
- **Decision:** a **server-side session record** (§3.2) keyed by an opaque high-entropy id; the browser holds
  only a **signed, HTTP-only, Secure, SameSite cookie** carrying that id (no user data in the cookie). The
  cookie is signed with the **server-side session-signing key** to make tampering detectable; the session
  row is the source of truth.
- **Rationale / trade-off:** a stateless signed token is cheaper (no store lookup, trivially horizontally
  scalable) but is **not server-invalidatable before expiry** — you cannot truly "log out" or revoke a
  leaked token without extra denylist machinery, which re-introduces server state anyway. Because this
  feature is the **foundation for Track B `broker-connect`** (real broker linkage → revocation/logout-
  everywhere matter) and we are already standing up a state store, the **server-side session is the right
  primitive.** It is also a near-zero marginal cost: the same store seam (§5.2) that holds users/settings
  holds sessions.
- **Expiry / logout / invalidation (required behaviors; concrete durations are PM/security config — §9):**
  - **Expiry:** every session has an absolute expiry; an expired session is treated as anonymous. (Optional
    rolling/idle expiry — PM call.)
  - **Logout:** deletes/revokes the session row server-side AND clears the cookie. Revocation is
    **server-authoritative** — a stale cookie pointing at a revoked/expired/unknown session resolves to
    **anonymous**, never to a valid session.
  - **Invalidation:** a session can be killed server-side independently of the browser (logout, future
    "log out everywhere", a rotation of the signing key invalidates all outstanding cookies). Designed-for,
    minimum = single-session logout this phase.

### 5.2 In-memory SQLite + the swap seam — **DECIDED**
- **`:memory:` persistence within a process:** a bare `sqlite3 :memory:` database is **per-connection** — it
  vanishes when that connection closes, so naive per-request connections would lose all state. The store
  MUST be set up so the in-memory DB **persists across requests for the process lifetime**: a **single
  shared connection** (or SQLAlchemy **`StaticPool`** with `check_same_thread=False`, or the
  `file::memory:?cache=shared` shared-cache form). The BE executioner picks the exact mechanism; the binding
  requirement is: **one process-wide in-memory database that survives across requests and resets on restart**
  (the prototype property the owner accepted), and that is **safe under FastAPI's threaded request handling**
  (bundle compute already runs in worker threads — main.py runs `fetch_*` in `to_thread`; the store must be
  thread-safe / connection-pooled accordingly).
- **The storage-port abstraction (the named seam) — MIRRORS `MarketDataProvider` (`src/providers/base.py`):**
  define **three ports (abstract base classes / Protocols)** so the persistence backend is a contained
  adapter swap, not a rewrite:
  - **`UserStore`** — create/lookup user by email, by stable id, by linked Google subject; create with a
    password hash; attach a Google identity to an existing user.
  - **`SessionStore`** — create a session for a user; resolve a session id → (user | none/expired/revoked);
    revoke a session; (designed-for) revoke-all-for-user.
  - **`UserSettingsStore`** — read/write the bounded per-user settings bag.
  - These ports define the **content contract** (the §3 records as the normalized shapes), exactly as the
    TypedDicts ARE the provider contract. The **in-memory SQLite implementation is ONE adapter**; a future
    Postgres/SQLite-file adapter is **another adapter behind the same ports** — and that is the *entire*
    swap (mirroring "add a vendor = one adapter, register it, nothing else changes").
  - **A factory selects the backend by env** (mirroring `get_provider()` + `DATA_PROVIDER`): an
    `ACCOUNT_STORE` / `AUTH_DB` style env switch (default = in-memory). **The Architect names the seam; the
    persistent adapter is NOT built this phase** (Non-goal §8).
  - **Design-for (not built):** the heavy localStorage stores (positions, saved views) could later become a
    server store behind a port of this same family — the seam is shaped to allow it; out of scope now.
- **Where it lives (module placement):** a new self-contained **auth subpackage** under `apps/api/src/`
  (e.g. `src/core/auth/` or `src/auth/` — exact name PM/UX-neutral, BE's call) holding the ports +
  in-memory adapter + session/password/OAuth logic. **It is a leaf** (§6).
- **New deps:** password hashing (passlib/bcrypt or argon2) + OAuth (Authlib or google-auth) added to
  `apps/api/requirements.txt` and installed into the `.venv` (per the BRIEF's note). Process/setup detail
  for the BE executioner.

### 5.3 Auth ↔ trading-path isolation — **DECIDED: auth is a one-way leaf the engine path never imports** (see §6)

### 5.4 Auth's own error class — **DECIDED: a NEW HTTP-status-bearing class, carved out of the null-rule** (see §7)

### 5.5 Per-user settings shape — **DECIDED: §3.3** (bounded light-prefs bag, strictly out of the scoring path)

### 5.6 Gated-surface enforcement boundary — **DECIDED: server-side gate on the two surfaces** (see §8a)

---

## 6. Module boundary — the structural guarantee of score byte-identity

This is the central invariant's enforcement. It mirrors the existing **one-way-leaf** pattern used by
`ai_recommendation.py` and the observability Level-1 boundary.

- The **auth subpackage is a LEAF**: `engine.py` / `signals.py` / `live.py` / `darkpool.py` /
  `chain_store.py` / the bundle-compute path / the SSE path **MUST NOT import it** and have **no dependency
  on it**. (This is the same structural rule that already guarantees personas / observability / ai-rec
  cannot perturb the score.)
- The dependency arrow points **only one way**: `main.py` (the orchestration boundary) imports the auth
  subpackage to wire auth endpoints + session resolution + the gate (§8a). The auth subpackage imports
  stdlib + its hashing/OAuth deps + its own ports — **never** the engine/signals/scoring modules, and the
  scoring path **never** imports auth.
- **Consequence (provable, the way score-identity is already proven elsewhere):** because nothing on the
  scoring path can reach a user, a session, or a setting, no auth datum can become an input to
  `opportunity_score` / `opportunity_tier` / `state_fingerprint` / the entry gate. **An anonymous bundle/SSE
  request is byte-identical to today**, and a signed-in request produces the **same bundle bytes** (identity
  changes nothing the engine sees). The BE executioner proves it the standard way (score + `state_fingerprint`
  byte-identical anonymous vs signed-in; AST/import-boundary check that the scoring path does not import
  auth).
- **No new required input on the bundle path:** the bundle/SSE endpoints gain **no required auth header and
  no new query param.** Auth state is read from the (optional) session cookie purely for the **gate**
  surfaces; its absence is the normal anonymous case.

---

## 7. Auth's error class — the explicit carve-out (downstream MUST NOT mis-apply the null-rule)

- The promoted `[best-effort-isolated-or-null]` rule ("a failed added computation returns null/omitted,
  **never an HTTP error**, bundle + SSE intact") **governs ADDED BUNDLE COMPUTATIONS on the trading path.**
- **The auth surface is a DIFFERENT class.** Auth endpoints legitimately and correctly return **real HTTP
  status codes** as their normal contract — e.g. **401** (bad credentials), **403** (unauthenticated on a
  gated surface), **409** (duplicate email on signup), and other standard auth/validation statuses. *(Exact
  status→case mapping & any wire envelope is the PM/UX call — §9; the Architect only fixes that this class
  uses real statuses, not null.)*
- **The carve-out does NOT weaken the trading path.** Two hard requirements coexist:
  1. Auth endpoints MAY (and should) return real error statuses.
  2. An **auth-subsystem failure must NEVER break the bundle/SSE path.** Because auth is a leaf (§6), an
     exception in session resolution / store / OAuth cannot reach engine compute; the bundle path keeps its
     existing None-on-failure semantics, and a broken auth subsystem degrades to **"treat as anonymous"** on
     the trader path rather than 500-ing the bundle. (The gated surfaces themselves correctly return their
     auth statuses; only the *anonymous trading path* must stay unbreakable.)
- **Security-of-errors:** auth error responses are **generic and non-enumerating** where it matters (e.g.
  login failure should not reveal whether the email exists — a `[best-effort-isolated-or-null]`-adjacent
  hygiene point the PM/UX should honor in copy). No secret/hash/stack ever appears in an error body or log.

---

## 8a. Gated-surface enforcement boundary (the two surfaces that require a session)

- **Two surfaces require a signed-in session** (owner-fixed hybrid model): (1) the **simulated Positions
  tracker / sim-trade actions**, and (2) the **in-app AI recommendation ("ask AI") call**. Everything else
  (Landing, Ticker/GEX viewer, Scanner stub, the four metrics, dark-pool, personas read, the bundle/SSE
  itself) stays **anonymous-usable, unchanged.**
- **Enforcement is SERVER-SIDE** (the binding requirement): the gate is enforced **at the server boundary**
  of any state-bearing/cost-bearing action on those two surfaces — the server resolves the session cookie →
  user, and an unauthenticated/expired/revoked session on a gated action yields the auth **403** class (§7),
  never silently proceeds. A FE-only check is necessary-for-UX but **not** the enforcement of record.
- **How the FE learns auth state:** there is a **server-authoritative way for the FE to read "am I signed in
  / who am I"** (a session-status read), so the FE can show the right state (prompt-to-sign-in vs enabled)
  and resolve auth on reload. The **shape/endpoint/fields of that read are the PM/UX's call** (§9); the
  Architect fixes only that it exists and is server-authoritative.
- **The AI-rec gate composes with the EXISTING ai-rec gating, does not replace it.** ai-rec already has its
  own `ai_eval`-derived gate + cooldown + daily cap + `no_key` handling. The **new auth gate is an
  additional precondition in front of those** (must be signed in to invoke), not a rewrite of ai-rec's
  internal gating. Order of precedence (auth-gate vs cap/gate messaging) is a PM/UX detail (§9).
- **OPEN TENSION FOR THE PM (flagged, NOT resolved here — product scope, out of the Architect's lane):** the
  Positions data is **client-local `localStorage` today.** So "gating Positions behind login" is an **ACCESS
  gate on the surface/actions**, **NOT a data-residency change** — the simulated positions are still stored
  in the browser this phase (no server-side positions store; §3.3 keeps heavy stores client-local). The PM
  must decide the product behavior of the gate: e.g. is the whole Positions *page/route* gated, or only the
  *sim-trade write actions*? what happens to positions already in localStorage when signed out / when a
  different user signs in on the same browser? This is a **product decision the Architect explicitly defers**
  (Open question §9).

---

## 8. Non-goals (explicit — out of scope this phase)

- **No real broker / order / execution path.** Positions stays `SIMULATED` (paper). `[no-real-order-path]`
  untouched; the "Live" tab stays zero-import LOCKED. Gating is access control, not order-path work.
- **No migration of the heavy localStorage stores** (positions portfolio `gammaflow.positions.v2`, saved
  views) to the server. They stay client-local; settings = basics + light prefs only. Future "Design-for"
  seam only (§5.2 / §3.3).
- **No persistent-DB adapter.** The swap **seam (ports + factory) is built; a Postgres/file adapter is NOT.**
  In-memory SQLite is the only adapter this phase; it resets on restart (accepted prototype property).
- **No red-team / system-6 work.** Owner-deferred while in-memory/pre-live; re-activates when persistence
  becomes real or the app is publicly exposed. (The hygiene **floor** in §2 still applies now.)
- **Password-reset & email-verification flows: OUT this phase → FUTURE.** Rationale: the store is in-memory
  and resets on restart (a reset/verify flow has no durable target and typically needs an email-sending
  dependency the owner has not provisioned), and red-team is deferred. The architecture **does not preclude
  them** (the user record can carry verification state later). If the PM judges a minimal verify/reset
  in-scope for product reasons, that is a PM scope call — default is **Future.**
- **No multi-device session sync / "log out everywhere" UI / admin console** this phase (the SessionStore is
  shaped to allow revoke-all later — designed-for, not built).

---

## 9. Open questions for the PM (explicitly deferred — NOT the Architect's lane)

UI/layout, endpoint signatures, payload/JSON field names, and copy are all PM/UX/BE-executioner decisions.
Specifically:

1. **API surface:** the concrete endpoints + methods + payload field names for signup, login, logout,
   session-status/"who am I", the Google start + callback, and settings read/write. (Architect fixed the
   *records' content* §3, the *mechanism* §5, and the *error class* §7 — not the wire shape.)
2. **Username:** required vs optional, unique vs display-only.
3. **Account-linking policy:** on a verified-email Google match to an existing local account, **auto-link**
   vs **require an explicit confirm** (a UX + security-policy choice). Architect fixed the *mapping rules*
   (§4); the consent UX is the PM's.
4. **Session durations / rolling-vs-absolute expiry**, "remember me", and whether to ship "log out
   everywhere" now (SessionStore supports it; shipping the surface is a PM call).
5. **Auth error→status mapping & copy:** the exact status code per case, the response envelope shape, and
   non-enumerating failure copy (§7 fixes "real statuses, generic where it matters"; the mapping is the PM's).
6. **Gated-surface product behavior (the §8a OPEN TENSION):** is the whole Positions *route* gated or only
   the *sim-trade write actions*? what is the sign-in prompt UX on each gated surface? what happens to
   localStorage positions on logout / on a different user signing in on the same browser? precedence of the
   auth-gate vs ai-rec's cap/gate messaging.
7. **Settings catalog:** the exact closed list of light prefs to persist this phase (the Architect bounded
   it to "basics + light prefs, e.g. active persona / default ticker / theme"; the final list is the PM's),
   and the merge/precedence with the existing client-local persona/theme stores (server pref vs localStorage
   on a signed-in reload).
8. **Whether minimal email-verification / password-reset is in product scope** now (Architect default:
   Future — §8).

---

## 10. Acceptance shape (what "done" must demonstrate — for the PM to turn into ACs)

The Architect does not write ACs, but binds the technical truths the PM's ACs must cover:
- Sign up + log in with **email/username + password**; log in / sign up with **Google** (config-gated —
  verifiable with stub/absent creds that the path is wired and disabled-when-unconfigured).
- A signed-in **session survives a page reload** and **clears on logout** (server-authoritative; a stale
  cookie ⇒ anonymous).
- The **two gated surfaces** prompt for sign-in when logged out and work when logged in (server-enforced).
- A saved **light pref** set while signed in survives **logout → login on the same account**, and a
  **different account sees its own** settings.
- **Password hash only** — no plaintext password in the store, in any log, or in any response; **no secret /
  signing key / Google secret reaches the browser.**
- **Score byte-identity:** `opportunity_score` / `opportunity_tier` / `state_fingerprint` byte-identical
  anonymous-vs-signed-in; the anonymous bundle/SSE path is unchanged from today; the scoring path does not
  import the auth subpackage.
- **Auth-subsystem failure does not break the bundle/SSE path** (degrades to anonymous on the trader path).
