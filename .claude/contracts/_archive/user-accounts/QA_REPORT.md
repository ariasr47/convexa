# user-accounts — QA_REPORT (GATE Q)

> QA role — fresh session, de-correlated from builder lanes. Observed against a live backend
> (`npx nx serve api` → :8000, dummy keyless config) and the test suite (`npx nx test dashboard`).
> Date: 2026-06-26. Backend: apps/api (FastAPI). Frontend: apps/dashboard (Vite/React 19).

---

## 1. Conformance Result

Command run (first boot, fresh in-memory store):
```
apps/api/.venv/Scripts/python.exe .claude/tools/interface_conformance.py \
  --spec .claude/tools/conformance/user-accounts.json --url http://127.0.0.1:8000
```

**Result on first run (fresh backend):**
```
interface_conformance — 2 endpoint(s)
  PASS  GET /api/auth/session — 4 required field(s) present + well-typed
  PASS  POST /api/auth/signup — 8 required field(s) present + well-typed

  0 endpoint failure(s).
```

The second run returned 409 for the signup probe (expected per the spec comment: the in-memory
store already had the conformance probe email from the first run; the spec explicitly notes
"Re-run without restart ⇒ 409"). Conformance PASS on first run.

---

## 2. Frontend Test Suite

Command: `npx nx test dashboard`

**Result:** 244 tests in 25 files — all PASS. No failures.

Auth-feature spec files and counts:
- `auth.flow.spec.tsx` — 5 tests
- `auth-entry.spec.tsx` — 10 tests
- `auth-invariants.spec.tsx` — 6 tests
- `gated-positions.spec.tsx` — 3 tests
- `gated-ai-rec.spec.tsx` — 4 tests
- `settings.spec.tsx` — 4 tests
- `google-control.spec.tsx` — 5 tests
- `useSettings.spec.tsx` — 5 tests
- `validation.spec.ts` — 6 tests

Pre-existing suites (positions, ai-rec, ticker, personas, shell) all pass without regression.

---

## 3. AC↔Test Traceability Audit

| AC | Named passing test(s) | Status |
|---|---|---|
| AC-A1 | T-A1 in `auth.flow.spec.tsx` | Traced |
| AC-A2 | T-A2 in `auth-invariants.spec.tsx` | Traced |
| AC-A3 | T-A3 in `auth-invariants.spec.tsx`; T-F3 in `settings.spec.tsx` | Traced |
| AC-B1 | T-B1 in `auth.flow.spec.tsx`; T-B1 in `auth-entry.spec.tsx` | Traced |
| AC-B2 | T-B2 in `auth-entry.spec.tsx` | Traced |
| AC-B3 | T-B3 (two tests) in `auth-entry.spec.tsx` | Traced |
| AC-C1 | T-C1 in `auth-entry.spec.tsx` | Traced |
| AC-C2 | T-B1/C2/D1 in `auth.flow.spec.tsx` | Traced |
| AC-C3 | T-C3/H3 in `auth-entry.spec.tsx`; T-H3 describe in `auth-entry.spec.tsx` | Traced |
| AC-D1 | T-B1/C2/D1 in `auth.flow.spec.tsx` | Traced |
| AC-D2 | T-D2 in `auth.flow.spec.tsx` | Traced |
| AC-E1 | T-E1 in `auth.flow.spec.tsx`; T-E1 in `gated-positions.spec.tsx` | Traced |
| AC-E2 | T-E2 in `gated-positions.spec.tsx` | Traced |
| AC-E3 | T-E3 in `gated-positions.spec.tsx` | Traced |
| AC-E4 | T-E4 in `gated-ai-rec.spec.tsx` | Traced |
| AC-E5 | T-E5 in `gated-ai-rec.spec.tsx` | Traced |
| AC-E6 | T-E6 in `gated-ai-rec.spec.tsx` | Traced |
| AC-E7 | T-E7 in `gated-ai-rec.spec.tsx` (AI rec surface) + T-E7 (positions) in `gated-positions.spec.tsx` (Positions surface, added by fix) | Traced — FULL (both surfaces now covered) |
| AC-F1 | T-F1 in `settings.spec.tsx`; `useSettings.spec.tsx` "writes a pref through to the server" | Traced |
| AC-F2 | T-F2 in `settings.spec.tsx`; `useSettings.spec.tsx` "shows account Y own value" | Traced |
| AC-F3 | T-F3 in `settings.spec.tsx`; T-A3 in `auth-invariants.spec.tsx` | Traced |
| AC-F4 | T-F4 in `auth-invariants.spec.tsx` | Traced |
| AC-G1 | T-G1 (x2) in `google-control.spec.tsx` | Traced |
| AC-G2 | T-G2 in `google-control.spec.tsx` | Traced |
| AC-G3 | T-G3 in `google-control.spec.tsx` | Traced |
| AC-H1 | T-H1/H2 in `auth-invariants.spec.tsx`; T-H1 describe in `auth-entry.spec.tsx` | Traced |
| AC-H2 | T-H1/H2 in `auth-invariants.spec.tsx` | Traced |
| AC-H3 | T-C3/H3 in `auth-entry.spec.tsx`; T-H3 describe in `auth-entry.spec.tsx` | Traced |
| AC-I1 | T-I1 in `auth-invariants.spec.tsx` | Traced |
| AC-I2 | T-I2 in `auth-invariants.spec.tsx` | Traced |
| AC-J1 | T-J1 in `auth.flow.spec.tsx` | Traced |

---

## 4. AC Verdict Table

| AC | Verdict | Evidence |
|---|---|---|
| **AC-A1** Anonymous: Landing/Ticker/bundle/live-stream work, no sign-in wall | **PASS** | Confirmed by live `GET /api/ticker/TSLA` (200, no auth header needed); `GET /api/auth/session` (anonymous 200); T-A1 in the test suite exercises the full app mount. |
| **AC-A2** Scanner stub, four metrics, dark-pool, personas reachable anonymously | **PASS** | All these paths call unauthenticated endpoints. T-A2 (`auth-invariants.spec.tsx`) verifies Scanner stub renders for anonymous user. Bundle endpoints require no session. |
| **AC-A3** Anonymous persona/theme per today's client-local stores, no regression | **PASS** | T-A3 verifies anonymous app renders with dark theme (client-local). Settings.spec.tsx T-F3 confirms anonymous changes go to client-local store, never server. Suite green (no regression). |
| **AC-B1** Valid signup → immediately signed-in | **PASS** | Observed: `POST /api/auth/signup` with `testqauser@example.com` + password → `{"authenticated":true,"user":{...},"settings":{...}}` (200). T-B1 in both flow and entry specs. |
| **AC-B2** Duplicate email → "email already registered" distinct outcome, no second account | **PASS** | Observed: second signup with `testqadup@example.com` → `{"error":"email_taken","message":"An account with that email already exists."}` (409). T-B2 in `auth-entry.spec.tsx`. |
| **AC-B3** Malformed email OR short password → field-level validation, no account created | **PASS** | Observed: `email=notanemail` → `{"error":"validation","message":"Enter a valid email address."}` (422); `password=abc` (< 8 chars) → `{"error":"validation","message":"Password must be at least 8 characters."}` (422). T-B3 (x2) in `auth-entry.spec.tsx`. |
| **AC-C1** Login with correct email+password → signed-in | **PASS** | Observed: `POST /api/auth/login` with correct creds → `{"authenticated":true,...}` (200) with session cookie set. T-C1 in `auth-entry.spec.tsx`. |
| **AC-C2** After login, page reload keeps session (cookie resolved server-side) | **PASS** | Observed: login sets cookie; subsequent `GET /api/auth/session` with same cookie returns `{"authenticated":true,"user":{"email":"testqauser@example.com",...}}`. T-B1/C2/D1 in `auth.flow.spec.tsx` remounts the app and verifies same user reported. |
| **AC-C3** Wrong password OR unknown email → same single generic "credentials didn't match" outcome | **PASS** | Observed: wrong password → `{"error":"bad_credentials","message":"Incorrect email or password."}` (401); unknown email → identical `{"error":"bad_credentials","message":"Incorrect email or password."}` (401). Messages byte-identical. T-C3/H3 in `auth-entry.spec.tsx`. |
| **AC-D1** Logout → anonymous; gated actions prompt sign-in | **PASS** | Observed: `POST /api/auth/logout` → 200; subsequent `GET /api/auth/session` → `{"authenticated":false,"user":null,...}`. T-B1/C2/D1 in `auth.flow.spec.tsx` verifies account control flips to "Sign in". |
| **AC-D2** Stale/expired/revoked cookie → resolves to anonymous | **PASS** | Observed: `GET /api/auth/session` with `session_id=fake_invalid_session_id_xyz` → `{"authenticated":false,"user":null,...}`. T-D2 in `auth.flow.spec.tsx`. |
| **AC-E1** Logged out: Positions write action → visible sign-in prompt, action NOT executed | **PASS** | Observed via test: T-E1 in `gated-positions.spec.tsx` clicks "Open entry" while anonymous → `positions-signin-prompt` appears with binding copy; entry dialog does NOT open. T-E1 also confirmed in `auth.flow.spec.tsx` full flow. |
| **AC-E2** Signed in: Positions write action works (behind mandatory confirm, SIMULATED) | **PASS** | Observed via test: T-E2 in `gated-positions.spec.tsx` with signed-in session → entry dialog opens, no sign-in prompt. Server gate returns `{"authorized":true}` for authenticated session (confirmed via `POST /api/positions/sim-trade/gate` with valid cookie). |
| **AC-E3** Positions route viewable anonymously (only writes prompt sign-in) | **PASS** | Observed via test: T-E3 in `gated-positions.spec.tsx` verifies route renders, `portfolio-panel` present, disclosure banner shows, no prompt until a write is triggered. Backend `/positions` route is FE-side (no backend gating of the route). |
| **AC-E4** Logged out: "ask AI" → sign-in prompt, LLM NOT invoked, ai-rec cooldown/cap/no_key NOT shown | **PASS** | Observed: `POST /api/recommendation/TSLA` with valid body but no session → `{"error":"auth_required","message":"Sign in to do this."}` (403). Backend does NOT run ai-rec gating. T-E4 in `gated-ai-rec.spec.tsx` verifies no cooldown/cap/no_key messaging shown. |
| **AC-E5** Signed in: "ask AI" proceeds into EXISTING ai-rec gating (auth first, then ai-rec) | **PASS** | Observed: `POST /api/recommendation/TSLA` with valid session cookie (requires body with `snapshot_fingerprint`) proceeds to ai-rec gating. T-E5 in `gated-ai-rec.spec.tsx` confirms the POST is issued after auth resolves. |
| **AC-E6** Manual hand-off/state-export floor stays anonymous-usable | **PASS** | Observed: `GET /api/recommendation/export/TSLA` returns 200 with full export JSON (200KB context payload) — no auth required. T-E6 in `gated-ai-rec.spec.tsx`. |
| **AC-E7** Gated action without valid session is rejected server-side even if FE check bypassed | **PASS** | **AI rec surface: PASS** (unchanged) — `POST /api/recommendation/TSLA` (with body, no session) → 403 `auth_required`; T-E7 in `gated-ai-rec.spec.tsx`. **Positions surface: NOW PASS** — `PortfolioPanel.tsx` `handleConfirm()` calls `gate.guard(..., () => pf.openPosition(input), { serverGate: gate.simTradeGate })` where `gate.simTradeGate = simTradeGate` from `@org/api` (newly added). `simTradeGate()` POSTs `POST /api/positions/sim-trade/gate` (observed: no session → 403 `auth_required`; valid session → 200 `{authorized:true}`). A 403 throws `AuthError(auth_required)`, which `gate.guard` catches → sets `promptText`, never calls `pf.openPosition()` → nothing is persisted. Tested in T-E7 (positions) and T-E7 (positions, allowed) in `gated-positions.spec.tsx`: 403 path: `backend.calls.simTradeGate === 1`, `allPositions().length === 0`, `positions-signin-prompt` shown; 200 path: `simTradeGate === 1`, `allPositions().length === 1`, no prompt. |
| **AC-F1** Signed in: change a light pref → after logout+login on SAME account, saved pref reflected | **PASS** | Observed: `PUT /api/auth/settings` with `{theme:light, default_ticker:NVDA}` → 200; logout; login; `GET /api/auth/session` shows `settings.theme:light, default_ticker:NVDA`. T-F1 in `settings.spec.tsx` + `useSettings.spec.tsx`. |
| **AC-F2** Pref saved by account X NOT seen by account Y | **PASS** | Observed: user1 has `{theme:light, default_ticker:AAPL}` after settings write; user2 (separate signup, different email) has `{theme:dark, default_ticker:null}` (server default). Per-account isolation confirmed. T-F2 in `settings.spec.tsx` + `useSettings.spec.tsx`. |
| **AC-F3** Anonymous: persona/theme behave per client-local stores, no server pref applied | **PASS** | Observed: `GET /api/auth/settings` without session → 401 `auth_required`. FE uses client-local stores when anonymous. T-F3 in `settings.spec.tsx`; T-A3 in `auth-invariants.spec.tsx`. |
| **AC-F4** Changing a light pref does NOT change any computed bundle value | **PASS** | Import boundary verified: `signals.py`/`engine.py`/`live.py`/`darkpool.py`/`chain_store.py` do NOT import the auth subpackage. Settings are read ONLY by the auth/session path. T-F4 in `auth-invariants.spec.tsx` confirms `getTicker` not re-called with pref params. |
| **AC-G1** No Google creds configured → option present but disabled, google_available=false | **PASS** | Observed: `GET /api/auth/session` → `"google_available":false`. T-G1 (x2) in `google-control.spec.tsx` verifies button is present and disabled when `google_available=false`. |
| **AC-G2** No Google creds → no error, no crash, credentials path works end-to-end | **PASS** | Observed: Backend boots successfully with no Google env vars (no crash, no error log). `POST /api/auth/signup` and `POST /api/auth/login` work normally. `GET /api/auth/google/start` returns 409 `google_unavailable` (defensive, not a crash). T-G2 in `google-control.spec.tsx`. |
| **AC-G3** Google availability is config-only (no rebuild needed to flip) | **PASS** | Verified mechanically: `google_oauth.available()` reads `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI` at call time from env (not cached at import). Setting those env vars and restarting would flip `google_available` to `true` with no code change. T-G3 in `google-control.spec.tsx` flips `google_available` false→true at the network boundary and verifies the button becomes enabled. |
| **AC-H1** No raw password in any response body, error, or payload | **PASS** | Observed: `POST /api/auth/signup` response contains `"auth_methods":["password"]` (the auth method label — not the password value). The actual password `SecurePass123!` does NOT appear in any response. Verified: `"TestPassword123"` not in signup response. `auth_methods` value `"password"` is a METHOD descriptor, not the credential. T-H1/H2 in `auth-invariants.spec.tsx` and T-H1 in `auth-entry.spec.tsx`. |
| **AC-H2** No session-signing key/Google secret/session secret in any response | **PASS** | Observed: all auth responses contain only `{authenticated, user{id,email,display_name,auth_methods}, google_available, settings}`. No signing key, no cookie value, no Google secret. Backend log: no signing key emitted. T-H1/H2 in `auth-invariants.spec.tsx`. |
| **AC-H3** Login-failure copy identical for wrong-email vs wrong-password | **PASS** | Observed: wrong password → `"message":"Incorrect email or password."` (401); unknown email → `"message":"Incorrect email or password."` (401). Messages are byte-identical. T-H3 (x2 describes) in `auth-entry.spec.tsx`. |
| **AC-I1** Bundle `opportunity_score`/`opportunity_tier`/`state_fingerprint` byte-identical anon vs signed-in | **PASS** | Observed: `GET /api/ticker/TSLA?min_dte=1&max_dte=30` anonymous → score:81, tier:prime, fp:None; same with signed-in cookie → score:81, tier:prime, fp:None (cache hit). Import boundary verified: auth subpackage not imported by `engine.py`/`signals.py`/`live.py`/`darkpool.py`/`chain_store.py`. T-I1 in `auth-invariants.spec.tsx`. |
| **AC-I2** Anonymous bundle/SSE request: no new required header, no new query param | **PASS** | Observed: `GET /api/ticker/TSLA` returns 200 with no cookie/auth header; same with signed-in session (cookie is not required). T-I2 in `auth-invariants.spec.tsx` asserts `getTicker` called with no auth header and no auth/session/persona/theme query param. |
| **AC-J1** Auth subsystem failing → bundle/SSE still work (trader path treated as anonymous) | **PASS** | Verified mechanically: the bundle/SSE path (`serve_ticker`, `stream_ticker`) in `main.py` never calls `_resolve_auth()` or `_gate_or_response()`. Auth failure can only reach `_resolve_auth` which is only called from `post_recommendation` and `positions_sim_trade_gate`. The session router is a separate FastAPI router. T-J1 in `auth.flow.spec.tsx` simulates a `failSession()` (who-am-I 503s) and verifies the bundle still renders, chart never blanks, account shows "Sign in". |

---

## 5. Invariant Checks

### `[additive-keeps-score-byte-identical]`
**PASS.** Import boundary check confirms `engine.py`, `signals.py`, `live.py`, `darkpool.py`, and `chain_store.py` do NOT import the `src.auth` subpackage. Score byte-identity observed: anonymous and signed-in requests for the same ticker+filter return identical `opportunity_score` (81) and `opportunity_tier` (prime). Settings are never read by the scoring path.

### `[best-effort-isolated-or-null]` (with AUTH CARVE-OUT)
**PASS.** Auth endpoints correctly return real HTTP status codes (401, 403, 409, 422, 503) per the carve-out. The bundle/SSE path keeps its None-on-failure semantics (`GET /api/ticker/*` never returns a non-200 from an auth fault). `_gate_or_response()` is only called from the two gated endpoints, never from the bundle/SSE path.

### `[no-real-order-path]`
**PASS.** The positions write actions remain client-local (localStorage). `POST /api/positions/sim-trade/gate` is an AUTH gate that carries no positions payload and triggers no broker/order path — it resolves the session from the HTTP-only cookie and returns `{authorized:true}` or 403. No new broker, order, or real-position source was introduced. The Live tab in PortfolioPanel remains the zero-import LOCKED placeholder. `acceptance.spec.tsx` test `no_real_order_path_anywhere_simulated_unmistakable` and the `score_tier_fingerprint_byte_identical` invariant (which explicitly excludes the auth-class `/api/positions/sim-trade/gate` call while asserting no `/api/ticker/` call) remain substantive and green.

### `[operator-vs-trader-path-separation]` (kinship)
**PASS.** The auth router (`/api/auth/*`) is a separate FastAPI router included in `main.py`. It does not gate or perturb any trader bundle or SSE path. The session read happens at dedicated endpoints only.

### Security Floor
**PASS.** Password hashing uses argon2-cffi with a dummy hash for timing-safe non-enumeration. No plaintext password, hash, signing key, Google secret, or session id appears in any observed response body. Backend log shows no password or secret logged. The `AUTH_SESSION_SIGNING_KEY` log entry says "using ephemeral per-process key" (no key value logged). The new `simTradeGate()` sends no positions data and no secret — it is an empty-body POST that only carries the HTTP-only session cookie automatically.

### Score Byte-Identity (Binding — `additive-keeps-score-byte-identical`)
**PASS.** Independently confirmed: anonymous and signed-in requests for `/api/ticker/TSLA?min_dte=1&max_dte=30` return identical `opportunity_score:81`, `opportunity_tier:prime`. Import boundary clean. The `score_tier_fingerprint_byte_identical_with_or_without_portfolio` test in `acceptance.spec.tsx` still genuinely asserts its invariant: it confirms no `/api/ticker/` call was issued by the portfolio module, and that all non-auth, non-gate fetch calls are only to `/api/contract/`. The gate call exclusion at line 584 is correct and non-vacuous — the auth gate carries no scoring input and never touches the bundle path.

---

## 6. Summary

**30 AC total** (AC-A1 through AC-J1):

| Verdict | Count | ACs |
|---|---|---|
| **PASS** | **30** | AC-A1, A2, A3, B1, B2, B3, C1, C2, C3, D1, D2, E1, E2, E3, E4, E5, E6, **E7**, F1, F2, F3, F4, G1, G2, G3, H1, H2, H3, I1, I2, J1 |
| **FAIL** | **0** | — |
| **UNVERIFIABLE** | **0** | — |

Conformance: **2/2 PASS** (on first fresh-boot run; see §1).
Test suite: **246/246 PASS** (25 spec files).
@org/api suite: **7/7 PASS** (1 spec file).
Traceability: Every AC has ≥1 named passing test. AC-E7 now has T-E7 (AI rec) in `gated-ai-rec.spec.tsx` AND T-E7 (positions) + T-E7 (positions, allowed) in `gated-positions.spec.tsx`.

---

## 7. Overall GATE Q Verdict

**FAIL**

One AC fails and requires a bounce:

---

## 8. Amendments bounced to Frontend

### AC-E7 — Server-enforced gate for Positions writes NOT exercisable

**AC (verbatim):** "A gated action attempted without a valid session is rejected at the server with the auth 'sign-in-required' outcome even if a FE check were bypassed — i.e. the enforcement is server-side, not FE-only (D6e). (Observable via the gated action failing server-side when no valid session is present.)"

**Expected behavior:** When a Positions sim-trade write action is attempted, the FE calls the server (e.g. `POST /api/positions/sim-trade/gate`) which rejects with 403 `auth_required` when no valid session is present — making the gate server-enforceable even if the FE auth check is bypassed.

**Observed behavior:** The FE's `PortfolioPanel.tsx` `handleConfirm()` wraps `pf.openPosition(input)` with `gate.guard()`. `openPosition()` is a client-local write (to `localStorage`). There is NO server call for position writes. The `POST /api/positions/sim-trade/gate` endpoint exists on the backend and correctly returns 403 when called without a session, but the FE never calls it. If a user bypasses the FE `auth.authenticated` check (e.g. by manipulating client state), `openPosition()` would succeed locally with no server rejection.

**Minimal repro:** In `PortfolioPanel.tsx`, `handleConfirm()` calls `pf.openPosition(input)` (a local localStorage write) without any prior server-side auth validation call. No `POST /api/positions/sim-trade/gate` call exists in `gammaflow.ts` or anywhere in the positions module.

**Owning lane:** Frontend

**Required fix (lane's call on implementation):** The positions write path (at minimum `handleConfirm` in `PortfolioPanel.tsx`) must call the server gate before executing the local write, OR alternatively: add a named test `T-E7 (positions)` that exercises the gate behavior with the server returning 403 and confirms nothing is written locally. If the positions data is fully client-local and no server call is practical, the PRODUCT_CONTRACT AC-E7 must be scoped to AI rec only (requires a GATE Z bounce to amend the contract). Note: `T-E7` in `gated-ai-rec.spec.tsx` correctly covers the AI rec surface; the gap is the Positions surface.

---

---

## GATE Q RE-RUN (2026-06-26)

> QA re-run — fresh session, de-correlated from the builder who applied the fix. Verifies the
> AC-E7 fix holds and no previously-passing AC was regressed. Date: 2026-06-26. Backend: running
> at :8000 (same keyless config). Frontend: `npx nx test dashboard` run fresh.

### RE-RUN Scope

The Frontend lane reported the following fix for AC-E7:
1. Added `simTradeGate()` to `libs/api/src/lib/gammaflow.ts` calling `POST /api/positions/sim-trade/gate`.
2. Wired `simTradeGate` into `PortfolioPanel.tsx` `handleConfirm()` and `guardSaveView()` via `gate.guard(..., { serverGate: gate.simTradeGate })`.
3. Added `simTradeGate` to `useGate.ts` GateApi as `() => Promise<unknown>`.
4. Added named tests `T-E7 (positions)` and `T-E7 (positions, allowed)` in `gated-positions.spec.tsx`.
5. Updated 4 pre-existing write specs (`acceptance.spec.tsx`, `positions-portfolio.flow.spec.tsx`, `positions-page.spec.tsx`) and the score-invariant assertion to mock the gate call as authorized (signed-in path).

---

### RE-RUN 1: AC-E7 Primary Re-Verification

**Verdict: PASS**

**Code path observation (PortfolioPanel.tsx lines 77–93):**
`handleConfirm()` now reads:
```
void gate.guard(AUTH_COPY.positions.gateTrack, () => {
  const res = pf.openPosition(input);
  ...
}, { serverGate: gate.simTradeGate });
```
and `guardSaveView()`:
```
void gate.guard(AUTH_COPY.positions.gateSaveView, run, { serverGate: gate.simTradeGate });
```

`gate.simTradeGate` is the `simTradeGate` function from `@org/api`, imported into `useGate.ts`. `gate.guard()` (in `useGate.ts` lines 68–96) calls `await opts.serverGate()` BEFORE `await fn()`, so a 403 from the server throws `AuthError(auth_required)` and `pf.openPosition()` NEVER runs.

**Live endpoint verification:**
- `POST /api/positions/sim-trade/gate` without a session cookie → `{"error":"auth_required","message":"Sign in to do this."}` (403). Observed directly.
- `POST /api/positions/sim-trade/gate` with valid session cookie → `{"authorized":true}` (200). Observed directly after login.

**Test observations (from `gated-positions.spec.tsx` run):**
- `T-E7 (positions)`: FE believes it is signed-in (`gatedAction: 'auth_required'` on the backend mock causes the gate to return 403). After clicking open + confirming, `backend.calls.simTradeGate === 1` (server called), `allPositions().length === 0` (write aborted), `positions-signin-prompt` shown with binding copy. PASS.
- `T-E7 (positions, allowed)`: Gate returns 200. After confirming, `backend.calls.simTradeGate === 1`, `allPositions().length === 1` (write proceeded), no prompt. PASS.

**Both tests named and passing in the suite (line 314): `src/app/auth/gated-positions.spec.tsx (5 tests)` — all 5 pass including both T-E7 variants.**

**AI-rec server gate still confirmed PASS (no regression):** `T-E7` in `gated-ai-rec.spec.tsx` still passes (4/4 in that file).

**AC-E3 regression check:** T-E3 still passes — route viewable anonymously, disclosure banner present, no prompt until write triggered. The fix only adds a server call on WRITE; it does not gate the route.

---

### RE-RUN 2: Frontend Test Suite (`npx nx test dashboard`)

**Result: 246/246 PASS (25 spec files). No failures.**

Increase from prior run (244/244): 2 new passing tests (`T-E7 (positions)` and `T-E7 (positions, allowed)`).

`gated-positions.spec.tsx` now shows 5 tests (was 3):
- T-E3 (PASS), T-E1 (PASS), T-E2 (PASS), T-E7 (positions) (PASS), T-E7 (positions, allowed) (PASS)

All pre-existing suites remain green:
- positions/acceptance.spec.tsx — 41/41 (unchanged)
- positions/positions-portfolio.flow.spec.tsx — 6/6 (unchanged; gate mock added but assertions unweakened)
- positions/positions-page.spec.tsx — 12/12 (unchanged)
- ai-rec/ai-rec.spec.tsx — 23/23 (unchanged; includes T-E7 AI-rec surface)
- All other 20 spec files — unchanged

### RE-RUN 3: @org/api Test Suite (`npx nx test @org/api`)

**Result: 7/7 PASS (1 spec file). No failures.**

The `libs/api/src/lib/gammaflow.spec.ts` file tests `requestRecommendation`, `fetchRecStatus`, `fetchRecExport`, `fetchPersonas`. Note: no dedicated unit test for `simTradeGate` exists in `gammaflow.spec.ts`; the function is exercised by the integration specs in `gated-positions.spec.tsx` (T-E7 variants). This is acceptable — the function is 7 lines, mirrors the existing `requestRecommendation` pattern exactly, and its behavior is fully observed via the integration tests.

### RE-RUN 4: Runtime Conformance

**`GET /api/auth/session`: PASS** — 4 required fields present and well-typed (`authenticated:boolean`, `user:object|null`, `google_available:boolean`, `settings:object|null`). Observed directly: `{"authenticated":false,"user":null,"google_available":false,"settings":null}`.

**`POST /api/auth/signup`: PASS on first fresh-boot run** — The conformance tool uses a fixed probe email (`conformance-probe-9f3a2@example.test`). In this QA session, the first conformance run succeeded (the tool ran immediately after the initial backend boot), but a subsequent run returned 409 because the probe email was already in the in-memory store. This is the documented behavior (spec comment: "Re-run without restart ⇒ 409"). Shape verified by manual probe with a fresh unique email: `{"authenticated":true,"user":{"id":"...","email":"...","display_name":"QA Re-run","auth_methods":["password"]},"google_available":false,"settings":{"active_persona_id":null,"default_ticker":null,"theme":"dark"}}` — all 8 required fields present. PASS on shape.

**`POST /api/positions/sim-trade/gate` (INTERFACE_CONTRACT §2.8 gated action):** Not in the conformance spec (it is session-state-dependent, excluded per the spec's "environment-dependent" note). Verified directly: no session → 403 `{"error":"auth_required","message":"Sign in to do this."}`; valid session → 200 `{"authorized":true}`. PASS per contract.

**Overall conformance: 2/2 PASS (shape verified; probe-collision 409 on re-run is the documented non-issue).**

### RE-RUN 5: AC↔Test Traceability (Updated)

| AC | Named passing test(s) | Status |
|---|---|---|
| AC-E7 | T-E7 in `gated-ai-rec.spec.tsx` (AI rec surface) + **T-E7 (positions)** + **T-E7 (positions, allowed)** in `gated-positions.spec.tsx` | **FULLY TRACED (both surfaces)** |
| All other ACs | Unchanged from prior run (§3 above) | All Traced |

**No AC is now untraced. AC-E7 has 3 named passing tests covering both required surfaces (AI rec + Positions).**

### RE-RUN 6: Invariant Regression Check

**`[additive-keeps-score-byte-identical]`:** PASS (unchanged). The `simTradeGate` function in `@org/api` carries no scoring inputs and calls `POST /api/positions/sim-trade/gate` which is an auth-leaf endpoint that never imports or touches `engine.py`/`signals.py`/`live.py`/`darkpool.py`/`chain_store.py`. The `score_tier_fingerprint_byte_identical_with_or_without_portfolio` test in `acceptance.spec.tsx` was updated to exclude the auth-class `/api/positions/sim-trade/gate` call from its "non-scoring fetch" assertion — this exclusion is correct and non-vacuous: the test still asserts no `/api/ticker/` call was made and all remaining non-auth calls are only to `/api/contract/`. The gate call carries no scoring input.

**`[no-real-order-path]`:** PASS (unchanged). `POST /api/positions/sim-trade/gate` is an AUTH gate with an empty request body that returns only `{authorized:true}` or an auth error. No positions data is sent to the server; no broker, order, or real-position path is introduced. The server resolves only the session cookie. The `no_real_order_path_anywhere_simulated_unmistakable` test remains green and unweakened.

**`[best-effort-isolated-or-null]` (AUTH CARVE-OUT):** PASS (unchanged). The gate endpoint returns 403/503/200 per the auth error class (carve-out behavior is correct). The bundle/SSE path is untouched.

**`[operator-vs-trader-path-separation]`:** PASS (unchanged). No new endpoint or call was added to the trader bundle path.

**Security floor:** PASS. `simTradeGate()` sends no credentials, no session id (the HTTP-only cookie is browser-managed), and no positions payload. The response `{authorized:true}` contains no secret. No regression in the security floor.

### RE-RUN 7: Typecheck Note (Pre-Existing Condition)

`npx tsc --build` is RED on `main` with 394 errors. **This is PRE-EXISTING and UNRELATED to the user-accounts fix.** Evidence:
- All errors are jest-dom matcher type complaints (`toBeInTheDocument`, `toBeDisabled`, `toHaveAttribute`, etc.) in spec files across ALL feature directories: `positions/` (112 errors), `auth/` (87), `ai-rec/` (73), `ticker/` (70), `shell/` (4), `app.spec.tsx`, `libs/api/src/lib/gammaflow.spec.ts`.
- Files outside the user-accounts feature (`app.spec.tsx`, `ticker/`, `shell/`, pre-existing `positions/acceptance.spec.tsx`, `ai-rec/ai-rec.spec.tsx`) ALL have the same jest-dom type errors — proving this is a repo-wide tsconfig/typing issue, not introduced by this feature.
- Confirmed pre-existing: stashing the fix and running `tsc --build` yields 417 errors; restoring the fix yields 394 errors. The fix REDUCED the error count by 23 (it did not introduce any new errors).
- The vitest test runner is the deliverable gate for spec files and is not affected by these type declarations; the test suite passes 246/246.

**Finding: typecheck errors are pre-existing, repo-wide, and NOT introduced by the user-accounts feature or its fix. No FAIL attributed to this feature.**

---

### RE-RUN Summary

| Check | Result |
|---|---|
| AC-E7 (Positions surface — the failing AC) | **PASS** (fix holds; server gate called, 403 aborts write, 200 allows) |
| AC-E7 (AI rec surface — was PASS) | **PASS** (no regression) |
| AC-E3 (Positions route viewable anonymously) | **PASS** (no regression) |
| All other 27 ACs | **PASS** (no regression; all 25 spec files green) |
| `npx nx test dashboard` | **246/246 PASS** (25 spec files; +2 new T-E7 tests) |
| `npx nx test @org/api` | **7/7 PASS** (no regression) |
| Runtime conformance `user-accounts.json` | **2/2 PASS** (shape; probe-collision 409 documented) |
| `[additive-keeps-score-byte-identical]` invariant | **PASS** (score-invariant assertion substantive, unweakened) |
| `[no-real-order-path]` invariant | **PASS** (gate is auth-only, no positions payload, no broker path) |
| Security floor | **PASS** (no secret/credential in gate request or response) |
| Typecheck (`tsc --build`) | Pre-existing RED (417→394 errors; 23 reduced by fix; NOT introduced by feature) |

**Overall: 30 PASS / 0 FAIL / 0 UNVERIFIABLE**

---

## Overall GATE Q Verdict (RE-RUN)

**PASS**

All 30 ACs pass. No previously-passing AC regressed. Binding invariants intact. Both test suites green (246/246 dashboard, 7/7 @org/api). Conformance 2/2. AC-E7 is now fully traced to 3 named passing tests across both required surfaces (AI rec + Positions). The typecheck RED is pre-existing, repo-wide, and not attributable to this feature.
