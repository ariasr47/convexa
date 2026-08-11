# INTERFACE_CONTRACT — redesign-auth

## NO_BACKEND_CHANGE

This feature is a **frontend-only visual reskin** of the auth modal (`AuthDialog` +
`GoogleButton`). It consumes the EXISTING auth endpoints **unchanged** — no new endpoint, no new
request field, no new response field, no shape/semantics change. There is nothing new for GATE Q
to verify on the backend side.

## Endpoints consumed (existing, unchanged)

Reached through the `@org/api` client (`signIn`/`signUp`/`getSession`, the Google start
redirect) exactly as today:

| Endpoint | Method | Used by | FE consumes (unchanged) |
|---|---|---|---|
| `/api/auth/signup` | POST | `auth.signUp` | request `{ email, password, display_name? }` → `SessionStatus`; errors → `AuthError(code)` (`email_taken` / `validation`) |
| `/api/auth/login` | POST | `auth.signIn` | request `{ email, password }` → `SessionStatus`; errors → `AuthError(code)` (`bad_credentials` (401) / `auth_unavailable` (503)) |
| `/api/auth/session` | GET | `auth.refresh` (who-am-I) | `SessionStatus { authenticated, user, google_available, settings }` |
| `/api/auth/google/start` | GET (full-page redirect) | `GoogleButton` (enabled only) | server-side OAuth flow; the Google secret stays server-side |
| `/api/auth/logout` | POST | `auth.signOut` (not exercised by the modal reskin) | idempotent |

The `google_available` boolean on the who-am-I (`/api/auth/session`) response drives the
present-but-disabled Google control. It is an EXISTING field; the reskin reads it unchanged
(config flip, no rebuild).

## Fields the UI reads / writes (naming only — no new fields)

- **Reads (who-am-I `SessionStatus`):** `authenticated`, `user`, `google_available`, `settings`.
- **Writes (submit):** signup `{ email, password, display_name? }`; login `{ email, password }`.
- **Errors:** `AuthError` carrying a `code` ∈ `{ email_taken, bad_credentials, validation,
  auth_unavailable }` (+ default). The code → copy mapping lives entirely in the FE
  (`AuthDialog.mapError` + `AUTH_COPY`); no server copy change.

## Conformance spec

```json
{
  "feature": "redesign-auth",
  "backend_change": false,
  "new_endpoints": [],
  "changed_endpoints": [],
  "new_request_fields": [],
  "new_response_fields": [],
  "removed_fields": [],
  "consumed_endpoints_unchanged": [
    "POST /api/auth/signup",
    "POST /api/auth/login",
    "GET /api/auth/session",
    "GET /api/auth/google/start",
    "POST /api/auth/logout"
  ],
  "consumed_session_fields": ["authenticated", "user", "google_available", "settings"],
  "error_codes_consumed": ["email_taken", "bad_credentials", "validation", "auth_unavailable"],
  "security_floor": {
    "password_never_returned_or_echoed": true,
    "bad_credentials_non_enumerating": true,
    "google_secret_server_side": true,
    "gate_server_authoritative": true
  },
  "gate_q_action": "NONE — no endpoint or field surface changed; nothing new to verify"
}
```

system-1 / GATE Q: this is a `backend_change: false` feature. The conformance check is a no-op —
no endpoint or field surface changed. The security-floor invariants above are enforced and
verified on the **frontend** side (see `FRONTEND_EXECUTION_CONTRACT.md` "Tests to write").
