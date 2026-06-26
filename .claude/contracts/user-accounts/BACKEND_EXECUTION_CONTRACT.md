# user-accounts — BACKEND_EXECUTION_CONTRACT

> Server work ONLY. References `INTERFACE_CONTRACT.md` for what it must EMIT. NO UI detail. Reader has ONLY
> `.claude/PROJECT_CONTEXT.md` + `INTERFACE_CONTRACT.md` + this file. Target: `apps/api`. Verified by
> app-run + `.claude/tools/interface_conformance.py --spec .claude/tools/conformance/user-accounts.json`
> (no pytest suite — CLAUDE.md). Run: `npx nx serve api` (uvicorn :8000).

FEATURE = `user-accounts`. This is the **first stateful backend surface + first credential store**. The
"stateless server" property is **narrowed to the trading path** (GATE S ledger note, ARCHITECTURE §2) — the
trading path (bundle/SSE/ghost-trade math) stays stateless; auth introduces a contained, swappable store
outside it.

---

## 1. Module placement — the auth subpackage as a ONE-WAY LEAF (ARCHITECTURE §6, hard)

- Create a **new self-contained auth subpackage** under `apps/api/src/` (e.g. `src/auth/` — name is BE's
  call, PM/UX-neutral) holding: the three store ports + the in-memory SQLite adapter + the env-selected
  factory, password hashing, the session mechanism, the Google Authorization-Code flow, and the auth error
  class.
- **LEAF rule (the structural guarantee of score byte-identity):** `engine.py` / `signals.py` / `live.py` /
  `darkpool.py` / `chain_store.py` / the bundle-compute path / the SSE path **MUST NOT import the auth
  subpackage** and have **no dependency on it**. The dependency arrow points **one way**: `main.py` imports
  the auth subpackage to wire the auth endpoints + session resolution + the two gated-surface gates. The
  auth subpackage imports stdlib + its hashing/OAuth deps + its own ports — **never** the engine/signals/
  scoring modules.
- **Proof obligation (the standard way, AC-I1/AC-I2/AC-F4):**
  1. An **import-boundary / AST check** that the scoring path does not import the auth subpackage.
  2. **Score byte-identity:** `opportunity_score` / `opportunity_tier` / `state_fingerprint` for a fixed
     ticker+filter are **byte-identical** for an anonymous request vs a request carrying a valid signed-in
     session (identity changes nothing the engine sees).
  3. **No new required input on the bundle path:** `GET /api/ticker/*` + the SSE stream gain **no required
     auth header and no new query param**; the (optional) session cookie is read ONLY for the gate surfaces.

---

## 2. The three store ports + in-memory SQLite adapter + env-selected factory (ARCHITECTURE §5.2)

Mirror the `MarketDataProvider` port pattern (`src/providers/base.py` ABC + `get_provider()` factory +
`DATA_PROVIDER` env). Define **three ports** (ABCs / Protocols) — the §3-record content is the contract:

- **`UserStore`** — create/lookup user by email (case-insensitive unique), by stable id, by linked Google
  subject; create with a password hash; attach a Google identity to an existing user.
- **`SessionStore`** — create a session for a user; resolve session id → (user | none/expired/revoked);
  revoke a session; (designed-for, not built) revoke-all-for-user.
- **`UserSettingsStore`** — read/write the bounded per-user settings bag (`active_persona_id`,
  `default_ticker`, `theme`).

**In-memory SQLite adapter (the ONLY adapter this phase):** a `:memory:` DB that **persists across requests
for the process lifetime** and resets on restart (accepted prototype property). Use a **single shared
connection** or SQLAlchemy `StaticPool` with `check_same_thread=False` or `file::memory:?cache=shared` — BE
picks the exact mechanism; the binding requirement is **one process-wide in-memory DB that survives across
requests** and is **thread-safe under FastAPI's threaded handling** (bundle compute already runs in worker
threads via `to_thread`; the store must be thread-safe / connection-pooled accordingly).

**Env-selected factory:** an `ACCOUNT_STORE` / `AUTH_DB`-style env switch (default = in-memory), mirroring
`get_provider()` + `DATA_PROVIDER`. The persistent (Postgres/file) adapter is **NOT built this phase**
(Non-goal) — the seam is shaped so it (and, later, the heavy localStorage stores) is one adapter behind the
same port family.

---

## 3. Records (content; field names per INTERFACE_CONTRACT, ARCHITECTURE §3)

- **User:** stable opaque id (never the email); email (required, unique, **case-insensitive**); display
  handle (optional, **non-unique, display-only** — D2); **password hash only** (bcrypt/argon2 incl. its own
  salt; **null/absent for a Google-only account**); auth-method/linkage facts (has-local-password,
  linked-Google-`sub`); created-at + last-login-at. **Plaintext password never persisted or logged.**
- **Session:** opaque high-entropy id (what the signed cookie carries); owning-user FK; issued-at +
  **absolute expiry** AND a **rolling/idle refresh** (D4 — active use keeps the session alive, abandoned
  expires); **revocation state** (server-authoritative invalidation independent of the cookie).
- **Settings:** owning-user FK (one row per user); `active_persona_id`, `default_ticker`, `theme` —
  **presentation/preference only, NEVER read by the scoring path** (AC-F4).

---

## 4. Password hashing + security floor (ARCHITECTURE §2, hard)

- Hash with **bcrypt or argon2** (passlib/bcrypt or argon2-cffi). **Never** store/log/return plaintext —
  even in the in-memory DB (AC-H1).
- The **session-signing key**, **Google client secret**, and **server session secret** are **server-side
  only**, env-supplied + gitignored (mirror `MASSIVE_API_KEY` / `ANTHROPIC_API_KEY`). **None ever appears in
  a response body, error message, log line, or serialized payload** (AC-H2).
- Login failure is **generic + non-enumerating** (same 401 `bad_credentials` for unknown-email vs
  wrong-password — AC-C3/H3). Use a constant-time compare / always-hash pattern so timing does not enumerate.

---

## 5. Session mechanism (ARCHITECTURE §5.1) — server-side session over a signed HTTP-only cookie

- Decision is fixed: a **server-side session record** keyed by an opaque id; the browser holds only a
  **signed, HTTP-only, Secure, SameSite cookie** carrying that id (no user data in the cookie). The cookie is
  signed with the server-side signing key (tamper-detectable); the **session row is the source of truth**.
- **Expiry:** absolute + rolling/idle (D4); an expired session ⇒ anonymous.
- **Logout** (`POST /api/auth/logout`): revoke the session row server-side AND clear the cookie; idempotent
  200 (AC-D1).
- **Invalidation:** a **stale/expired/revoked/unknown** cookie resolves to **anonymous, never to a valid
  session** (AC-D2). `GET /api/auth/session` is **always 200** with `authenticated:false` in that case.

---

## 6. Google Authorization-Code flow — built but config-gated OFF (ARCHITECTURE §4, D9)

- **Server-side Authorization-Code** flow (Authlib or google-auth): browser → Google → **server-side
  callback** → the **server** exchanges the code for tokens. The browser never sees the client secret or
  Google tokens (AC-H2).
- **Config-gated:** client ID / secret / redirect URI are server-side env. **Absent creds ⇒ Google is
  unavailable**, exactly as missing `ANTHROPIC_API_KEY` ⇒ AI-rec `unavailable:no_key`. **Absent creds cause
  no crash, no error on boot, and no broken auth screen** (AC-G2). `GET /api/auth/session.google_available`
  reports `false` when unconfigured, `true` when configured — **config-only, no rebuild** (AC-G1/G3).
- **Anti-CSRF `state`** issued + verified on callback (standard hygiene).
- **Identity → user mapping (ARCHITECTURE §4.2):** known `sub` → login; verified-email match to an existing
  local account → **auto-link** (D3 — no confirm step this phase, Google is disabled); no match → create a
  Google-only user (no local password) + its settings row.
- `start` while unconfigured returns **409 `google_unavailable`** (defensive; the FE control is disabled so
  this is normally unreachable).

---

## 7. Auth error class (ARCHITECTURE §7) — real HTTP statuses, carved out of the null rule

- The auth endpoints return **real HTTP status codes** per `INTERFACE_CONTRACT §3`: 200 / 302 / 401 / 403 /
  409 / 422 / 503. They are a **different class** from added bundle computations — do NOT mis-apply
  "null-not-error" to them.
- Error envelope `{ error, message }` with the codes pinned in `INTERFACE_CONTRACT §2` (`bad_credentials`,
  `email_taken`, `validation`, `auth_required`, `auth_unavailable`, `google_unavailable`). `message` is
  server-safe + non-enumerating; **no secret/hash/stack** in any error body or log.
- **The carve-out does NOT weaken the trading path (AC-J1):** because auth is a leaf (§1), an exception in
  session resolution / store / OAuth **cannot reach engine compute**. The bundle/SSE path keeps its
  None-on-failure semantics and a broken auth subsystem degrades to **"treat as anonymous"** on the trader
  path — `GET /api/ticker/*` never 500s from an auth fault, the SSE stream never blanks. On a **gated
  action**, a failing subsystem surfaces **503 `auth_unavailable`** (the honest "couldn't reach sign-in"),
  never a misleading bad-credentials.

---

## 8. Server-side enforcement of the two gated surfaces (ARCHITECTURE §8a, D6e)

- **The server is the enforcement boundary** (binding) — a FE check is UX sugar, not the boundary of record.
- **AI-rec "ask AI" invoke** (`POST /api/recommendation/{ticker}`): add the **auth gate as the OUTERMOST
  precondition** (D6f) — resolve the session cookie FIRST; if no valid session, return **403 `auth_required`**
  and **do not invoke the LLM** and **do not run / surface** ai-rec's existing `ai_eval`/cooldown/cap/`no_key`
  gating (those compose AFTER auth — AC-E4). With a valid session, proceed into the EXISTING ai-rec gating
  unchanged (AC-E5). The non-LLM floor `GET /api/recommendation/export/{ticker}` stays **anonymous-usable**
  (AC-E6). Observable order: **auth first, then ai-rec's own gates.**
- **Positions sim-trade WRITE actions:** positions data is **client-local this phase** (no server positions
  store — ARCHITECTURE §3.3). The server gate is the **auth check on the action request** the FE makes for a
  state/cost-bearing write (open/edit/close a sim position, place a resting limit, save a named view, accept
  an AI rec into the tracker) — no valid session ⇒ **403 `auth_required`** (AC-E1/E7). The Positions **route
  is NOT gated** (D6a — viewable anonymously, AC-E3). *(Implementation note: the BE provides the
  session-resolving gate the FE write actions call; no broker/order path is added — `[no-real-order-path]`
  untouched, Positions stays `SIMULATED`.)*

---

## 9. Settings endpoints (INTERFACE §2.6/§2.7)

- `GET /api/auth/settings` (signed in) → the bag; anonymous → 401 `auth_required` (anonymous prefs stay
  client-local — AC-F3). The §2.1 session read also embeds `settings` for the common path.
- `PUT /api/auth/settings` (signed in) → write-through; **server-wins** (D7); echo the full saved bag
  (AC-F1). **Per-account isolation** — account X's bag is never returned to account Y (AC-F2). 422 on a bad
  `theme`. Anonymous → 401.
- **HARD INVARIANT:** settings are NEVER read by `signals`/`engine`/`live`/`darkpool`/scoring/tiering/the
  fingerprint (AC-F4). They are an opaque preferences bag from the engine's perspective; the leaf boundary
  (§1) structurally guarantees it.

---

## 10. New Python deps + setup

- Add to `apps/api/requirements.txt` and install into `apps/api/.venv`:
  - password hashing (**passlib[bcrypt]** or **argon2-cffi**),
  - OAuth (**Authlib** or **google-auth** + the chosen HTTP client),
  - (if used) SQLAlchemy for the `StaticPool` in-memory setup (else stdlib `sqlite3` with a shared
    connection).
- Install: `cd apps/api && .venv/Scripts/python.exe -m pip install -r requirements.txt`.
- New env keys (server-side, gitignored): the **session-signing key / session secret**, the **Google client
  ID / client secret / redirect URI**, the **`ACCOUNT_STORE`/`AUTH_DB`** store switch, and the session
  duration / idle-window config (durations are operator config, not product copy — D4). Absent Google creds
  ⇒ `google_available=false`, no crash (AC-G2).

---

## 11. Proof obligations recap (what "done" must demonstrate — for QA at GATE Q)

- `interface_conformance.py --spec .claude/tools/conformance/user-accounts.json --url <backend>` PASSES
  (`GET /api/auth/session` anonymous shape + `POST /api/auth/signup` success shape on a fresh boot).
- **Score byte-identity** anonymous vs signed-in (`opportunity_score`/`opportunity_tier`/`state_fingerprint`)
  + the **import-boundary AST check** that the scoring path never imports auth (AC-I1, AC-F4).
- **No new required header / query param** on `GET /api/ticker/*` or the SSE path (AC-I2).
- **Auth-subsystem fault ⇒ bundle/SSE intact** (degrade to anonymous on the trader path; gated actions
  return 503 `auth_unavailable`) — AC-J1.
- **Non-enumerating login** (401 identical for unknown-email vs wrong-password) — AC-C3/H3.
- **No secret / no plaintext password / no hash** in any response, error, or log — AC-H1/H2.
- **Stale/expired/revoked cookie ⇒ anonymous** (AC-D2); **logout revokes server-side + clears cookie**
  (AC-D1).
- **Google config-gated:** `google_available` false when unconfigured (no crash), true when configured
  (AC-G1/G2/G3).
