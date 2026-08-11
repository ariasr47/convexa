# user-accounts — INTERFACE_CONTRACT

> The FE↔BE truth ONLY. Both lanes bind to THIS file. It fixes endpoints, methods, payload field
> names/types/presence, the auth error-status semantics (ARCHITECTURE §7), and how the session-status read
> reports identity + Google-availability. Reader has ONLY `.claude/PROJECT_CONTEXT.md` + this file.
> No UI detail (→ FRONTEND_EXECUTION_CONTRACT), no server internals (→ BACKEND_EXECUTION_CONTRACT).

FEATURE = `user-accounts`. The auth surface is a **new HTTP-status-bearing class** (ARCHITECTURE §7),
NOT governed by the null-on-failure bundle rule. The **bundle/SSE path gains no new endpoint, no new
required header, and no new query param** (ARCHITECTURE §6 / AC-I2) — it is untouched by this contract.

---

## 1. Conventions

- **Base:** all auth endpoints are under `/api/auth/*`; settings under `/api/auth/settings`. The Vite dev
  proxy already forwards `/api → 127.0.0.1:8000`.
- **Session transport:** a **signed, HTTP-only, Secure, SameSite cookie** carries an opaque session id
  (ARCHITECTURE §5.1). The browser holds ONLY the cookie; **no session id, signing key, or secret appears
  in any response body** (AC-H2). The FE never reads the cookie value (it is HTTP-only). Auth state is
  learned ONLY via the session-status read (§2.1).
- **Content-Type:** request + response bodies are JSON.
- **Error envelope:** non-2xx auth responses carry `{ "error": "<code>", "message": "<safe text>" }`. The
  `message` is server-safe (never enumerating, never a secret/hash/password). The FE maps off `error`
  (codes enumerated per endpoint); `message` is a fallback only.
- **Security floor (binding on every endpoint below):** no response, error, or log line EVER contains a raw
  password, a password hash, the session-signing key, the Google client secret, or the server session
  secret (AC-H1, AC-H2).

---

## 2. Endpoints

### 2.1 Session status / who-am-I — `GET /api/auth/session`

Server-authoritative read the FE uses on mount + after every auth transition to learn signed-in-vs-anonymous,
who the user is, the Google-availability flag, and the user's settings. **Always 200** (anonymous is a normal
result, not an error). Resolves the cookie server-side; a stale/expired/revoked/unknown cookie ⇒ anonymous
(AC-D2). If the auth subsystem is failing, the server still returns 200 with `authenticated:false`
(degrade-to-anonymous; never 500 here — supports AC-J1).

**Response (200):**
| Field | Type | Presence | Notes |
|---|---|---|---|
| `authenticated` | boolean | always | `false` ⇒ anonymous |
| `user` | object \| null | always | `null` when anonymous |
| `user.id` | string | when `user` ≠ null | opaque stable id (never the email) |
| `user.email` | string | when `user` ≠ null | canonical identity (case-insensitive unique) |
| `user.display_name` | string \| null | when `user` ≠ null | optional display handle (D2) |
| `user.auth_methods` | array (of string) | when `user` ≠ null | e.g. `["password"]` or `["password","google"]` |
| `google_available` | boolean | always | D9 config-gated flag; `true` iff Google creds configured. Drives the present-disabled↔present-enabled control (AC-G1/G3) |
| `settings` | object \| null | always | `null` when anonymous; the bag below when signed in |
| `settings.active_persona_id` | string \| null | when `settings` ≠ null | server-side active persona (D7); `null` ⇒ app default |
| `settings.default_ticker` | string \| null | when `settings` ≠ null | default symbol for bare `/ticker`; `null` ⇒ app default (`TSLA`) |
| `settings.theme` | string | when `settings` ≠ null | one of `"dark"`/`"light"`/`"system"` |

**Never** returns a password, hash, session id, or secret.

### 2.2 Sign up — `POST /api/auth/signup`

**Request:** `{ email: string (required), password: string (required), display_name: string|null (optional) }`.

**Success (200):** the **same identity shape as §2.1** — `{ authenticated:true, user{…}, google_available,
settings }` — so the FE flips straight to signed-in (AC-B1) and a session cookie is set. Creates the
user's settings row (defaults) server-side.

**Errors:**
| Status | `error` code | Case | AC |
|---|---|---|---|
| 409 | `email_taken` | email already registered (deliberate signup-only enumeration, D5) | AC-B2 |
| 422 | `validation` | malformed email / password below floor `{N}` / missing required field | AC-B3 |
| 503 | `auth_unavailable` | auth subsystem failing | (degrade copy) |

No account is created on any error path. The minimal password floor `{N}` is a backend constant surfaced
in the 422 `message` (FE copy reads it).

### 2.3 Log in — `POST /api/auth/login`

**Request:** `{ email: string (required), password: string (required) }`.

**Success (200):** identity shape as §2.1; a session cookie is set (AC-C1).

**Errors:**
| Status | `error` code | Case | AC |
|---|---|---|---|
| 401 | `bad_credentials` | wrong email OR wrong password — **single generic, NON-ENUMERATING** outcome; the response MUST be identical for unknown-email vs wrong-password (AC-C3, AC-H3) | AC-C3 |
| 422 | `validation` | malformed email / empty password | — |
| 503 | `auth_unavailable` | auth subsystem failing | AC-J1 (gated side) |

No session is created on any error path. The 401 `message` MUST NOT reveal whether the email exists.

### 2.4 Log out — `POST /api/auth/logout`

Revokes the session row server-side AND clears the cookie. **200** regardless of prior state (idempotent).
After logout, §2.1 reports anonymous (AC-D1). Single-session this phase (D4).

### 2.5 Google start + callback (built, config-gated OFF — D9)

- `GET /api/auth/google/start` — when `google_available=false`, returns **409 `google_unavailable`** (or is
  simply never invoked by the FE because the control is disabled); when available, **302** redirect to
  Google with an anti-CSRF `state` (ARCHITECTURE §4). **Environment-dependent** — not conformance-asserted.
- `GET /api/auth/google/callback` — server-side Authorization-Code exchange; verifies `state`; maps identity
  per ARCHITECTURE §4.2 (known sub → login; verified-email match → auto-link, D3; else create); sets the
  session cookie; redirects back into the app. **Environment-dependent** — not conformance-asserted.

The browser **never** receives the Google client secret or Google tokens (AC-H2).

### 2.6 Settings read — `GET /api/auth/settings`

**Signed in (200):** `{ active_persona_id: string|null, default_ticker: string|null, theme: "dark"|"light"|"system" }`.
**Anonymous (401 `auth_required`):** there is no server settings bag for an anonymous user — the FE uses its
client-local stores instead (AC-F3). (The §2.1 read already embeds `settings` for the common path; this
dedicated read is for explicit refresh.)

### 2.7 Settings write — `PUT /api/auth/settings`

**Request (signed in):** any subset of `{ active_persona_id: string|null, default_ticker: string|null,
theme: "dark"|"light"|"system" }`. **Success (200):** echoes the full saved bag (server-wins, D7; AC-F1).
**Anonymous (401 `auth_required`):** rejected — anonymous prefs stay client-local (AC-F3). **422
`validation`** on a bad `theme` value.

Settings are **presentation-only** and are NEVER read by `signals`/`engine`/`live`/`darkpool`/scoring/
tiering/the fingerprint (AC-F4; ARCHITECTURE §3.3). They change only which default a UI lands on.

### 2.8 Gated actions — server-enforced auth class (D6e, ARCHITECTURE §8a)

The two gated surfaces are enforced **at the server boundary** of their state/cost-bearing actions:

- **Positions sim-trade WRITE actions** (open/edit/close a sim position, place a resting limit, save a named
  view, accept an AI rec into the tracker) — NOT the whole route (D6a). *Note: positions data stays
  client-local this phase (no server positions store); the server enforcement is the auth gate on the action
  request, returning the auth class when no valid session is present. The FE prompt is UX sugar (D6e).*
- **AI-rec "ask AI" LLM invoke** — `POST /api/recommendation/{ticker}` (the existing endpoint) gains the
  **auth gate as its OUTERMOST precondition** (D6f): with no valid session it returns **403 `auth_required`**
  and does NOT invoke the LLM and does NOT surface ai-rec's `ai_eval`/cooldown/cap/`no_key` (AC-E4). With a
  valid session it proceeds into the EXISTING ai-rec gating unchanged (AC-E5). The non-LLM manual
  export/hand-off floor (`GET /api/recommendation/export/{ticker}`) stays **anonymous-usable** (AC-E6).

**Auth-required outcome (binding for any gated action without a valid session):** HTTP **403** with
`{ "error": "auth_required", "message": "Sign in to do this." }` (AC-E1/E4/E7). A failing auth subsystem on
a gated action surfaces **503 `auth_unavailable`** (the "couldn't reach sign-in" copy) rather than a
misleading bad-credentials/200 (D5, AC-J1 gated side). **The anonymous bundle/SSE path is never gated**
(AC-I2, AC-J1).

---

## 3. Status-code semantics summary (ARCHITECTURE §7)

| Status | Meaning | Where |
|---|---|---|
| 200 | success / anonymous-is-normal (session read, logout) | §2.1–§2.4, §2.6, §2.7 |
| 302 | OAuth redirect | §2.5 |
| 401 | bad credentials (login, non-enumerating) / no-session on a settings read | §2.3, §2.6 |
| 403 | unauthenticated on a gated action | §2.8 |
| 409 | duplicate email on signup / Google start while unconfigured | §2.2, §2.5 |
| 422 | validation failure (malformed email, short password, bad theme) | §2.2, §2.3, §2.7 |
| 503 | auth subsystem failing (signup/login/gated action) | §2.2, §2.3, §2.8 |

The bundle/SSE path keeps its existing None-on-failure semantics and is **untouched** — an auth-subsystem
fault must never produce a non-200 on `GET /api/ticker/*` or break the SSE stream (AC-J1).

---

## 4. Conformance spec

The runnable, canonical machine-checkable spec for this feature lives in the standalone file
**`.claude/tools/conformance/user-accounts.json`** (the user-accounts standalone convention, mirroring
`.claude/tools/conformance/ai_recommendations.json` + `api_metrics.json`; `interface_conformance.py`
supports POST bodies). Run it at GATE Q:

```
apps/api/.venv/Scripts/python.exe .claude/tools/interface_conformance.py \
  --spec .claude/tools/conformance/user-accounts.json --url http://127.0.0.1:8000
```

**Conformance targets (statically checkable, environment-INDEPENDENT in shape):**
1. **`GET /api/auth/session` (anonymous)** — sent with no cookie ⇒ deterministically `authenticated:false`,
   `user:null`, `google_available:<boolean>`, `settings:null`. The `google_available` *value* depends on
   config, but its **presence + boolean type** is invariant (that is what is asserted).
2. **`POST /api/auth/signup` (fresh unique email)** — against a freshly-booted in-memory store ⇒ 200 +
   the signed-in identity shape (`authenticated`, `user{id,email,display_name,auth_methods}`,
   `google_available`, `settings`). Proves the success response carries identity and never a
   password/hash/secret.

**Environment-dependent (NOT conformance-asserted here, verified by FE/BE tests instead):**
- The **login non-enumerating bad-credentials** path (§2.3) returns 401 by design — the 200-only conformance
  tool cannot assert it; the FE flow test + the BE non-enumeration proof cover it (AC-C3/H3).
- The **Google start/callback** (§2.5) — config-dependent (302/redirect only when creds present).
- The **403 gated-action** outcomes (§2.8) — depend on session state.

The `## Conformance spec` heading above is the QA reference; the **runnable** spec is the standalone JSON.

```json
{
  "_runnable_spec": ".claude/tools/conformance/user-accounts.json",
  "note": "The canonical machine-runnable spec is the standalone file above (user-accounts standalone convention, system-1 + system-12). This block intentionally references it rather than restating it, so there is a single runnable source of truth. interface_conformance.py is invoked with --spec .claude/tools/conformance/user-accounts.json.",
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/auth/session",
      "required": {
        "authenticated": "boolean",
        "user": "object|null",
        "google_available": "boolean",
        "settings": "object|null"
      }
    }
  ]
}
```
