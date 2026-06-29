# deploy — ARCHITECTURE CONTRACT (deploy plan + config spec + ordered owner ops + system-6 scope)

> Role: Architect (architect-first, infra fast-path — PM/UX skipped; this is the public GO-LIVE so
> system-6 Security/red-team runs alongside). Technical shape only — no UI/layout/copy/payload-field
> design. Grounded against the repo (`apps/api/Dockerfile`, `docker-compose.yml`,
> `apps/dashboard/Dockerfile`, `apps/dashboard/nginx.conf`, `libs/api/src/lib/convexa.ts`,
> `apps/dashboard/vite.config.mts`, `apps/api/main.py`, `apps/api/src/auth/*`, `apps/api/.env.example`).
>
> **Target shape:** FastAPI backend (the shipped `apps/api/Dockerfile`) + managed Postgres on **Railway**;
> static Vite SPA on **Cloudflare Pages**; `/api` wired cross-origin. Repo: GitHub `ariasr47/convexa`
> (both Railway + Pages already GitHub-connected). Free subdomains first (`*.up.railway.app` /
> `*.pages.dev`) — no custom domain, no CI/CD pipeline, no app/scoring change.

---

## 0. Binding constraints restated (this feature touches these)

- **`[no-secrets-in-image]` — GRADUATES HERE** (3rd, finally-runtime-real instance). `containerize-apps`
  authored it, `persistent-db` reaffirmed it; **deploy pushes/builds an image on a hosting provider**, so
  the rule about *published artifacts* is now load-bearing. **Enforcement:** every secret value is entered
  **only** in **Railway → Variables** (never in `.env` committed, never in a Dockerfile `ENV`, never in a
  Pages env var beyond the build-public ones). The repo's structural guards stay in force: the two
  `.dockerignore`s + the explicit-COPY backend Dockerfile (no `COPY . .`) + the value-less `.env.example`.
  The static Pages bundle is **server-side-key-free by construction** — the SPA never holds
  `ANTHROPIC_API_KEY`/`MASSIVE_API_KEY`/any signing/encryption key (the client only ever calls relative
  `/api/*` — grep-confirmed, §1).
- **`[secret-encrypted-at-rest]` (canon)** — a **stable** `AI_KEY_ENCRYPTION_KEY` is now **MANDATORY**:
  persistence is real (`ACCOUNT_STORE=postgres`), so an ephemeral per-process key would make every stored
  per-user Anthropic key undecryptable after each redeploy (and differ per replica). The ciphertext-only
  store boundary is unchanged (already shipped in `persistent-db`); deploy must only ensure the **key is
  set + stable**. Same mandate for `AUTH_SESSION_SIGNING_KEY` (else every deploy logs all users out).
- **`[additive-keeps-score-byte-identical]`** — deploy is **config/wiring only**. No engine/signals/score/
  tier/`state_fingerprint` change; `compute_ticker` is untouched. Any repo change in §6 is infra plumbing
  (port binding, CORS gating, a Pages proxy file) — none is a scoring input.
- **`[server-side-gate-enforcement]` (canon)** — going public makes the gated endpoints internet-reachable;
  the server stays the boundary of record (the gate is NOT relaxed). system-6 (§5) verifies it holds over
  the open internet, not just the dev proxy.
- **Security floor → system-6 ACTIVATES** (§5). The deferred adversarial review lands now.

Non-goals (explicit): **no custom domain** (free `*.pages.dev`/`*.up.railway.app` first); **no CI/CD
pipeline** (manual first deploy from the GitHub connection / dashboard "Deploy"); **no app or scoring
behavior change**; **no Google OAuth go-live** (creds remain unprovisioned → button stays
present-but-disabled — provision later, config-only); **no real-order / broker path** (Positions stays
`SIMULATED`, Live tab stays the zero-import locked placeholder — `[no-real-order-path]` untouched).

---

## 1. PIVOTAL CALL — Cross-origin `/api`: **(A) Cloudflare Pages proxy/rewrite** (DECIDED)

### Ground truth (why A, decisively)
The frontend client `libs/api/src/lib/convexa.ts` builds **every** API URL as a **relative path** —
`fetch('/api/auth/session', { credentials: 'same-origin' })`, `fetch('/api/ticker/...')`,
`new EventSource('/api/stream/{ticker}...')`, `/api/recommendation/*`, `/api/auth/ai-key`,
`/api/_metrics`. There is **no `VITE_`-prefixed base URL**, **no configurable absolute API base**, and the
SSE stream + the auth cookie (`gf_session`, `credentials: 'same-origin'`) all assume **same-origin**. The
Vite dev proxy (`vite.config.mts`) and the container nginx proxy (`apps/dashboard/nginx.conf`) already
recreate this same-origin shape locally. Option (A) is the **direct production analogue of the proxy that
already exists in two places** — zero client change, no CORS, the cookie stays first-party.

> **Option (B) CORS is REJECTED** for go-live: it would require introducing a build-time `VITE_`-style
> absolute API base into the client (a real code change the client is not built for), a credentialed
> cross-site cookie (`SameSite=None; Secure`, third-party-cookie blocking risk in browsers), and an
> env-gated FastAPI allowlist. B is documented below only as the **fallback seam** if A ever can't carry
> SSE. A keeps the browser same-origin (`*.pages.dev`), so **`[server-side-gate-enforcement]` and the
> first-party `SameSite=Lax` cookie keep working unchanged**.

### The artifact (DECIDED): a Cloudflare **Pages Function** catch-all proxy
**Chosen over `_redirects`/`_routes.json`-alone** because Pages static `_redirects` proxying of an external
origin is constrained and does **not** reliably stream a long-lived `text/event-stream` (SSE) — and SSE is
load-bearing for the live tiles. A **Pages Function** (an edge Worker) can `fetch()` the Railway origin and
**return the upstream `Response` body unbuffered**, which streams SSE through edge-to-client. This is the one
form that supports BOTH the Railway origin AND the SSE pass-through.

**File to ADD (repo change — see §6.R3):** `apps/dashboard/functions/api/[[path]].ts` — a catch-all that
proxies `/api/*` to the Railway backend origin. Technical shape (NOT final code — the execution pass writes
it; field/copy choices are not the architect's):
- Reads the Railway backend origin from a **Pages environment variable** (e.g. `API_ORIGIN`, value
  `https://<service>.up.railway.app`) — set in the Pages dashboard, NOT committed.
- Rebuilds the upstream URL preserving the full path + query string (`/api/stream/TSLA?min_dte=...`).
- Forwards method, request headers (incl. `Cookie`), and body; sets/forwards `Cookie`/`Set-Cookie` so the
  `gf_session` cookie round-trips first-party on the `*.pages.dev` origin.
- **Streams the response body** (`return new Response(upstream.body, { status, headers })`) — does **NOT**
  buffer; preserves `Content-Type: text/event-stream` and the upstream `X-Accel-Buffering: no` so SSE flushes
  event-by-event. No `Cache-Control` rewrite that would buffer.
- A `functions/` directory in the Pages **build output root** is auto-detected by Pages; this file must end
  up alongside the built static bundle (the Pages build serves `apps/dashboard/dist` as the static root —
  reconcile the Functions directory location with the output dir at execution time; if Pages requires
  `functions/` at the project root rather than inside the publish dir, the execution pass places it there
  and points the proxy at the same `API_ORIGIN`). **OPEN QUESTION OQ-1.**

**Why SSE survives A:** the Railway backend already sets `X-Accel-Buffering: no` on the stream and emits a
heartbeat ~every 1.5s; the Pages Function returns the upstream body as a stream (no buffering); the browser's
`EventSource` reconnects on any drop. End-to-end: browser → `*.pages.dev/api/stream/...` (same-origin) →
Pages Function → `https://...up.railway.app/api/stream/...` → uvicorn SSE.

**Net repo impact of A:** ONE new file (the Pages Function) + ONE Pages env var (`API_ORIGIN`, owner-entered,
the Railway URL — public, not a secret). The FastAPI CORS middleware becomes **irrelevant to the browser path
under A** (the browser is same-origin), but it is currently mis-set (§6.R2) and should be cleaned/env-gated as
a defense-in-depth + a clean fallback for B — see §6.

---

## 2. Railway service shape

**One Railway service**, built from the repo Dockerfile. Postgres is a **Railway Postgres plugin** in the
same project.

| Setting | Value | Notes |
|---|---|---|
| Source | GitHub `ariasr47/convexa` (connected) | Manual deploy on push / dashboard "Deploy" — no CI pipeline (non-goal). |
| Builder | **Dockerfile** | Railway "Build" → Dockerfile. |
| Dockerfile path | `apps/api/Dockerfile` | |
| **Build context / root dir** | **`apps/api`** | The backend Dockerfile's `COPY requirements.txt` / `COPY main.py` / `COPY src` are **context-relative to `apps/api`** (compose builds it with `context: ./apps/api`). Railway "Root Directory" / build-context MUST be set to `apps/api` so these COPYs resolve. **(Distinct from the dashboard build, which is repo-root — §4.)** |
| Port binding | **`$PORT`** — see the reconcile below (**repo change §6.R1**) | |
| Healthcheck | TCP/HTTP to the app port | The Dockerfile `HEALTHCHECK` is a Python TCP socket connect to `127.0.0.1:8000` — it is **hardcoded to 8000** and is for the container runtime, not Railway's HTTP healthcheck. Railway can use its own HTTP healthcheck path; **there is no dedicated health endpoint** (containerize-apps deliberately added none). Use a **lightweight existing GET** as the Railway healthcheck path, e.g. `GET /api/personas` (always-200, no vendor fetch, no LLM, no auth) — or leave Railway's default TCP check. **OQ-2.** |
| Restart policy | on-failure (Railway default) | Stateless container; Postgres holds durable state. |

### `$PORT` reconcile (THE Railway-convention fix) — repo change, flagged not edited
**Finding:** `apps/api/Dockerfile` line 84 hardcodes
`CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]`, and the `EXPOSE 8000` + the
`HEALTHCHECK` connect to `8000`. **Railway injects `$PORT`** at runtime and routes its public edge to that
port; a service that ignores `$PORT` and listens only on a fixed 8000 may not receive traffic on Railway.

**Required minimal fix (execution pass, §6.R1):** make the start honor `${PORT:-8000}` so the container
works **both** on Railway (`$PORT` set) **and** locally / in compose (defaults to 8000, so compose +
nginx `proxy_pass http://api:8000` + the TCP healthcheck stay valid). Because the exec-form `CMD` does not
do shell `${VAR}` expansion, the fix is a **shell-form CMD** (or an entrypoint), e.g. conceptually:
`CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}`. The architect flags the change; the executioner
writes the exact line and confirms the local TCP healthcheck still targets the right port (if `$PORT` is set
to non-8000 on Railway, Railway's own healthcheck — not the container `HEALTHCHECK` — governs; the container
healthcheck staying on 8000 is acceptable as long as Railway doesn't set `$PORT≠8000`, but the safer exec
choice is for the start command to bind `$PORT` and rely on Railway's HTTP check). **This is the one genuinely
load-bearing repo change for Railway.**

### Postgres plugin → `DATABASE_URL` wiring
- Add the **Railway Postgres plugin** to the project. Railway exposes a `DATABASE_URL` (and component vars)
  as a **reference variable**.
- In the API service Variables, set `DATABASE_URL` to the Postgres plugin's connection string **via Railway's
  variable reference** (e.g. `${{Postgres.DATABASE_URL}}`) so it is injected at runtime, never committed.
- Set **`ACCOUNT_STORE=postgres`** (the shipped persistent adapter — `src/auth/postgres_store.py`, psycopg3
  sync, idempotent `CREATE TABLE IF NOT EXISTS` bootstrap, so **no manual migration step** is needed; first
  boot creates the 4 tables). Optional `DATABASE_POOL_MAX` (default 10).
- **Fail mode (already shipped, restated):** a Postgres outage fails auth **closed** (503 `auth_unavailable`
  / anonymous who-am-I) while the **anonymous bundle/SSE/trader path never touches the DB and stays up**.
- **STABLE-KEY mandate (§0):** with `ACCOUNT_STORE=postgres`, `AUTH_SESSION_SIGNING_KEY` +
  `AI_KEY_ENCRYPTION_KEY` MUST be set to stable values (else durable cookies/encrypted keys break on each
  deploy). These are the load-bearing go-live secrets.

---

## 3. Complete env/secret manifest (deployed BACKEND — Railway Variables)

All values are **owner-entered in Railway → Variables**, **never committed**, **never baked into the image**
(`[no-secrets-in-image]`). Names + roles derived from `PROJECT_CONTEXT §7` + `apps/api/.env.example`. Grouped
by go-live necessity.

### A. REQUIRED for a correct, secure public go-live
| Var | Value source | Why required now |
|---|---|---|
| `MASSIVE_API_KEY` | owner's Massive key | Market-data vendor; absent ⇒ provider errors (no bundle). |
| `ACCOUNT_STORE` | `postgres` | Selects the persistent adapter (persistence is the point of go-live). |
| `DATABASE_URL` | Railway Postgres reference (`${{Postgres.DATABASE_URL}}`) | The Postgres connection; runtime-only. |
| `AUTH_SESSION_SIGNING_KEY` | **owner-generated stable random** (HMAC key) | **Mandatory in persistent mode** — else every deploy logs all users out. Stable across restarts + replicas. |
| `AI_KEY_ENCRYPTION_KEY` | **owner-generated stable Fernet key** | **Mandatory (`[secret-encrypted-at-rest]`)** — else stored per-user Anthropic keys become undecryptable after a redeploy. Stable across restarts + replicas. |
| `DATA_FEED` | `realtime` or `delayed` | Vendor feed tier (owner's Massive plan). |

### B. RECOMMENDED at go-live (admin AI allowance + cost posture)
| Var | Value source | Why |
|---|---|---|
| `ANTHROPIC_API_KEY` | owner's Anthropic key | The **shared** key — server-side only, gives the free admin allowance. Absent ⇒ admins see `shared_key_unconfigured`; regular users must BYO. **A public, now-internet-reachable cost surface — see system-6 §5.** |
| `AI_REC_ADMIN_EMAILS` | the owner's **login email** | Allowlist that gets the shared-key free allowance; everyone else gets 0 (must BYO). Locks shared-key cost to the owner. |
| `AI_REC_ADMIN_FREE_DAILY` | default `3` | Per-admin daily free allowance on the shared key (cost cap). |
| `AI_REC_DAILY_CAP` | default `50` | Global shared-key daily cap (cost cap). |

### C. OPTIONAL — tuning / behavior (defaults are fine; set only to override)
`CACHE_TTL_SECONDS` (60), `STALE_AFTER_SECONDS` (120), `GATE_SCORE` (50), `FLOW_WINDOW_SECONDS` (300),
`LIVE_THROTTLE_SECONDS` (1.5), `CHAIN_REFRESH_SECONDS` (120), `CHAIN_PREWARM_MAX_AGE_SECONDS`,
`INCLUDE_DARK_POOL` (true), `DARKPOOL_LOOKBACK_SECONDS` (3600), `BLOCK_MIN_SHARES` (5000),
`VOL_OI_UNUSUAL_THRESHOLD` (1.0), `TIER_WATCH_SCORE` (25), `TIER_ACTIONABLE_SCORE` (=GATE_SCORE),
`TIER_PRIME_SCORE` (75), `OBSERVABILITY_ENABLED` (true), `METRICS_WINDOW_SIZE` (500),
`METRICS_RECENT_TRACES` (25), `DATA_PROVIDER` (massive), `AI_REC_MODEL`, `AI_REC_COOLDOWN_SECONDS` (60),
`AI_REC_TIMEOUT_SECONDS` (60), `AI_REC_IN_APP_ENABLED` (true), `AI_REC_STUB` (off), `DATABASE_POOL_MAX` (10).

### D. COOKIE / CORS posture (set explicitly for production — relevant to system-6)
| Var | Production value | Why |
|---|---|---|
| `AUTH_COOKIE_SECURE` | `true` (the default) | The cookie MUST be `Secure` over public HTTPS. Confirm it is NOT set to `false` (the local-dev override). |
| `AUTH_COOKIE_SAMESITE` | `lax` (the default) | Under option A the browser is **same-origin** (`*.pages.dev`), so `SameSite=Lax` is correct + sufficient; the cookie is first-party. (Only a CORS/option-B world would need `None`.) |
| `ALLOWED_ORIGINS` (if §6.R2 env-gates CORS) | the Pages origin only (e.g. `https://convexa.pages.dev`) — **NOT `*`** | Defense-in-depth; under A the browser path doesn't hit CORS, but a locked allowlist is the security floor. |

### E. DELIBERATELY ABSENT at this go-live
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` — leave **unset** (Google sign-in stays
present-but-disabled; provision later, config-only, no rebuild). Per-user `ANTHROPIC` keys are **never** env
vars — they are stored encrypted per-user via the app (BYO-key), never in Railway Variables.

---

## 4. Cloudflare Pages build settings (Nx monorepo)

Paste into the Pages project **Build configuration** screen. The build runs from **repo root** because the
dashboard imports `@org/api` from `libs/api` **as source** (the `@org/source` customCondition + npm-workspace
symlink) — exactly why `apps/dashboard/Dockerfile` builds at repo-root context. Pages clones the whole repo,
so a repo-root build is natural here.

| Field | Value |
|---|---|
| Framework preset | **None** (custom — Nx/Vite, do not pick a built-in preset) |
| **Build command** | `npx nx build @org/dashboard` |
| **Build output directory** | `apps/dashboard/dist` |
| **Root directory** | repo root (leave **empty / `/`**) — NOT `apps/dashboard` (the build needs root `package.json` + `package-lock.json` + `nx.json` + `tsconfig.base.json` + `libs/api/src`) |
| Node version | **20** (matches the dashboard Docker builder `node:20-alpine`) — set via a `NODE_VERSION` Pages env var or `.nvmrc`; do not let Pages pick a stale default. **OQ-3.** |
| Install command | Pages default (`npm ci` / detected from `package-lock.json`) — installs the workspace so the `@org/api` symlink materializes (same as the Docker `npm ci`). |
| Build env var | `API_ORIGIN` = the Railway backend URL (the Pages Function reads it — §1). **Public, not a secret.** |

**No `VITE_` build var is needed** — the client is relative-path only (§1). The Pages Function (§1) is the
only thing that needs to know the Railway URL, and it reads it from `API_ORIGIN` at the edge.

**`@org/api`-as-source consideration:** the build MUST run `npx nx build @org/dashboard` (NOT a raw
`vite build`) so the Nx project graph + the `@org/source` customCondition resolve `@org/api` from
`libs/api/src`. A raw vite build from `apps/dashboard` fails — same constraint the Dockerfile documents.

---

## 5. system-6 — Security / red-team review scope (feeds a separate review pass; ideally a different model)

This go-live makes the API **internet-reachable for the first time**. The security pass MUST check, at
minimum:

**S1 — Secrets handling (`[no-secrets-in-image]` graduating).**
- No secret value in the repo, in any committed file, in a Dockerfile `ENV`, or in a Pages build var (only
  the public `API_ORIGIN` + `NODE_VERSION`). Verify `apps/api/.env.example` is value-less and `.env` is
  gitignored + `.dockerignore`'d.
- Verify the **pushed/built image has no secret layer** (the containerize-apps spot check: `docker history`
  shows no `.env`/`.venv`/`conf/token.txt` layer; explicit-COPY backend confirms it).
- Verify all secrets live ONLY in Railway → Variables and Postgres `DATABASE_URL` is a runtime reference.
- Confirm the **static Pages bundle is key-free** (grep the built `dist` for any leaked key/origin secret;
  the client is relative-path + the keys are backend-only by construction).

**S2 — CORS / origin allowlist locked down.**
- **Finding (must be addressed):** `apps/api/main.py:445-451` mounts `CORSMiddleware` with
  `allow_origins=["http://localhost:3000", "http://localhost:5173"]` + `allow_credentials=True`,
  **hardcoded** (and not even the actual dev port 4200). Under option A this is irrelevant to the browser
  (same-origin), but a hardcoded list is fragile and `allow_credentials=True` with a stale list is a smell.
  **Required:** env-gate the allowlist to the **Pages origin only** (NEVER `*`, and `*` is incompatible with
  `allow_credentials=True` anyway) — §6.R2. Verify no `allow_origins=["*"]` ships.

**S3 — Public attack surface (which endpoints are now internet-reachable).**
- Enumerate every now-public route: `/api/ticker/*`, `/api/stream/*`, `/api/contract/*`,
  `/api/recommendation/*`, `/api/personas`, `/api/auth/*`, `/api/positions/sim-trade/gate`, **`/api/_metrics`**.
- **Finding (must be addressed):** `GET /api/_metrics` (`main.py:1074`) is **NOT auth-gated** — it is
  read-only + side-effect-free but exposes operator diagnostics (per-ticker stage timings, vendor latency,
  rate-limit headroom, recent traces) to the public internet. The trader-vs-operator separation
  (`[operator-vs-trader-path-separation]`) keeps it off the trader UI but does NOT make it private.
  **Required decision (OQ-4):** for public go-live, `/api/_metrics` must **NOT be openly exposed** — either
  (a) gate it behind the auth/admin check, (b) block `/api/_metrics` at the Pages-Function edge (don't proxy
  it), or (c) accept the exposure with eyes open (least preferred — it leaks operational shape). The Pages
  Function (§1) is a natural choke point: **the safest minimal move is to NOT proxy `/api/_metrics` through
  the public Function** (the operator reads it via the Railway URL directly / a private path). Flag for the
  review + the execution pass.

**S4 — Auth / credential exposure.**
- Cookies: `Secure` (S2/D), `HttpOnly` (already), `SameSite=Lax` (correct under A); confirm `AUTH_COOKIE_SECURE`
  is not flipped to `false` in prod.
- The encrypted-key boundary (`[secret-encrypted-at-rest]`): the per-user Anthropic key is ciphertext-only in
  Postgres, **never** returned/logged/sent to the browser (write-only + masked last4). Verify the
  stable-key mandate is honored (else not a leak, but a silent break).
- Non-enumerating auth (identical 401 for bad email vs bad password) holds over the public surface.
- Confirm a raw password / hash / signing key / Google secret / API key never appears in a response or a log
  line (the shipped security-floor log scan, re-run against the deployed config).

**S5 — Rate-limit / abuse + cost exposure on now-public endpoints.**
- **The ANTHROPIC + MASSIVE cost surfaces are now internet-reachable.** Check:
  - The shared `ANTHROPIC_API_KEY` allowance is locked to admins (`AI_REC_ADMIN_EMAILS` = owner only),
    regular users get 0 (must BYO) — so an anonymous/abusive caller cannot burn the owner's Anthropic spend
    via the in-app rec. The auth gate is **outermost** on `POST /api/recommendation/{ticker}` (logged-out ⇒
    no call). Verify the global `AI_REC_DAILY_CAP` + per-admin `AI_REC_ADMIN_FREE_DAILY` caps are set.
  - **MASSIVE cost/abuse:** the bundle + SSE endpoints are **anonymous** (browsing is hybrid-open by design)
    and each cold miss drives Massive vendor fetches. A public, uncapped `/api/ticker/{arbitrary}` /
    `/api/stream/{arbitrary}` is an **abuse/cost vector** (vendor bill, vendor rate-limit exhaustion,
    SSE-session resource use). There is **no rate-limiting today**. The review must assess this and
    recommend a floor (edge rate-limit at Cloudflare, a ticker allowlist, or an accepted-risk note for the
    low-traffic launch). **OQ-5 — likely a fast-follow, not a go-live blocker, but must be named.**
- SSE resource exhaustion: many concurrent `EventSource` connections open ref-counted live sessions; assess
  a connection ceiling.

**S6 — Unsafe-in-production defaults.**
- `--reload` is OFF in the container CMD (confirmed). No debug server. `?debug=1` only adds `meta.timings`
  (not a secret leak but operational detail — fine).
- `OBSERVABILITY_ENABLED=true` is fine; pairs with the S3 `/api/_metrics` decision.
- Confirm no stack traces / internal errors leak to clients (FastAPI default 500 is opaque — verify no
  `debug=True` on the app).
- TLS: Railway + Pages both terminate HTTPS on the free subdomains by default — confirm the public URLs are
  `https://` and HTTP redirects/upgrades.

> **Deliverable of system-6:** a pass/fail on S1–S6 with the must-fix set (expected non-negotiables: S2 CORS
> env-gate + Pages origin lock, S3 `/api/_metrics` not publicly proxied, S4 cookie `Secure` + stable keys,
> S5 cost caps confirmed). Run ideally on a **different model** than the deploy builders.

---

## 6. Repo changes vs pure-dashboard ops (clean separation)

### Repo changes (a small EXECUTION pass — backend/infra lane; NOT the architect, no `Edit` here)
- **R1 — `$PORT` bind (REQUIRED for Railway).** `apps/api/Dockerfile` CMD → honor `${PORT:-8000}`
  (shell-form CMD or entrypoint). Must keep working locally + in compose (defaults 8000). §2.
- **R2 — CORS env-gate (security floor, recommended).** `apps/api/main.py:445-451` — replace the hardcoded
  `allow_origins` with an **env-driven allowlist** (e.g. `ALLOWED_ORIGINS`, comma-split; default to the
  current localhost dev origins when unset so dev is unchanged), locked to the Pages origin in prod, **never
  `*`** (incompatible with `allow_credentials=True`). Pure config plumbing — no scoring/behavior change. §5/S2.
- **R3 — Pages Function proxy (REQUIRED for option A).** ADD `apps/dashboard/functions/api/[[path]].ts` (or the
  Pages-correct location per OQ-1) — the streaming `/api/*` → `API_ORIGIN` proxy that preserves SSE +
  cookies, and (per S3/OQ-4) does **not** proxy `/api/_metrics` to the public edge. §1.
- **R4 (conditional) — `/api/_metrics` gating.** If OQ-4 resolves to "gate it server-side" rather than
  "don't proxy it", a small auth/admin gate on `GET /api/_metrics` in `main.py`. Otherwise R3's edge block
  covers it. §5/S3.

> All four are config/plumbing — none touches `engine`/`signals`/scoring/`state_fingerprint`
> (`[additive-keeps-score-byte-identical]` holds). R1 + R3 are load-bearing for the deploy to function; R2
> + R4 are the security floor.

### Pure dashboard / ops steps (no repo change) — the owner performs these
Railway: create service from `ariasr47/convexa`, set Dockerfile path + root dir `apps/api`, add Postgres
plugin, enter all §3 Variables. Cloudflare Pages: create project from the repo, paste §4 build settings, set
`API_ORIGIN` + `NODE_VERSION`. (Full ordered sequence in §7.)

---

## 7. Ordered owner ops-steps (the copy-pasteable runbook)

> Do **repo changes R1+R3 (and R2)** FIRST and push to GitHub, so the first Railway build + Pages build pick
> them up. Then:

**Phase 1 — Backend on Railway**
1. Railway → New Project → Deploy from GitHub repo `ariasr47/convexa`.
2. Service → Settings → Build: **Dockerfile**, Dockerfile path `apps/api/Dockerfile`, **Root Directory
   `apps/api`**.
3. Add the **Postgres** plugin to the project.
4. Service → Variables: set the §3.A REQUIRED set —
   - `ACCOUNT_STORE=postgres`
   - `DATABASE_URL` = reference the Postgres plugin (`${{Postgres.DATABASE_URL}}`)
   - `AUTH_SESSION_SIGNING_KEY` = a freshly generated **stable** random string (keep it safe — reuse on every
     deploy)
   - `AI_KEY_ENCRYPTION_KEY` = a freshly generated **stable** Fernet key (keep it safe — reuse on every deploy)
   - `MASSIVE_API_KEY`, `DATA_FEED`
   - then §3.B: `ANTHROPIC_API_KEY`, `AI_REC_ADMIN_EMAILS` (owner's login email), `AI_REC_ADMIN_FREE_DAILY`,
     `AI_REC_DAILY_CAP`
   - §3.D: confirm `AUTH_COOKIE_SECURE=true` (or leave unset = default true), `AUTH_COOKIE_SAMESITE=lax`,
     and (if R2 shipped) `ALLOWED_ORIGINS=https://<your-pages-domain>.pages.dev`.
5. Deploy. First boot runs the idempotent Postgres `CREATE TABLE IF NOT EXISTS` bootstrap (no manual
   migration). Note the public URL `https://<service>.up.railway.app`.
6. Smoke-test the Railway URL directly: `GET /api/personas` → 200; `GET /api/ticker/TSLA` → a bundle (proves
   `MASSIVE_API_KEY`); sign up → save an AI key → **redeploy** → key still usable (proves stable keys +
   Postgres).

**Phase 2 — Frontend on Cloudflare Pages**
7. Pages → Create project → connect `ariasr47/convexa`.
8. Build configuration (§4): command `npx nx build @org/dashboard`, output `apps/dashboard/dist`, root dir
   empty, framework preset None.
9. Pages → Settings → Environment variables: `API_ORIGIN=https://<service>.up.railway.app`, `NODE_VERSION=20`.
10. Deploy. Note the public URL `https://<project>.pages.dev`.
11. **Back-fill the CORS allowlist:** set Railway `ALLOWED_ORIGINS` to the actual `*.pages.dev` URL (R2),
    redeploy the API.

**Phase 3 — Cross-origin verify (the whole point)**
12. Open `https://<project>.pages.dev`. The SPA calls relative `/api/*` → the Pages Function → Railway.
    Verify: ticker bundle loads, the **SSE live tiles update** (the Function streams), sign-up/login sets the
    `gf_session` cookie (first-party on `*.pages.dev`), a gated sim-trade write succeeds signed-in / 403s
    logged-out, the AI rec works for the admin email.
13. Confirm `/api/_metrics` is NOT reachable from `*.pages.dev` (per S3/OQ-4) — i.e. the Function doesn't
    proxy it.

**Phase 4 — system-6 review** (separate pass, §5; ideally a different model) over the deployed config +
artifacts before declaring go-live.

---

## 8. Open questions (for the conductor / execution pass / system-6 — NOT architect-decidable)

- **OQ-1 — Pages Functions directory location.** Whether Cloudflare Pages auto-detects `functions/` at the
  **project root** vs inside the **build output dir** for an Nx monorepo whose publish dir is
  `apps/dashboard/dist`. The execution pass must place the Function file where Pages discovers it (root
  `functions/` is the common convention; verify against the actual Pages build). If root, the file lives at
  repo-root `functions/api/[[path]].ts` and is committed there; if it must ride the publish dir, the Nx build
  must emit it. (Alternatively, evaluate a `_redirects` proxy IF testing shows it streams SSE — but the
  Function is the safe default.)
- **OQ-2 — Railway healthcheck path.** Use Railway's default TCP check, or point its HTTP healthcheck at an
  existing always-200 route (`GET /api/personas`)? No dedicated `/health` endpoint exists (adding one is out
  of lane unless the conductor wants it).
- **OQ-3 — Node version pin on Pages.** `NODE_VERSION=20` env var vs a committed `.nvmrc`/`.node-version`.
  Pick the one Pages honors; 20 matches the Docker builder.
- **OQ-4 — `/api/_metrics` public exposure (security must-decide).** Gate server-side (R4) vs block at the
  Pages-Function edge (don't proxy) vs accept. Architect recommends **don't proxy it through the public
  Function** (cheapest, keeps it operator-only). system-6 confirms.
- **OQ-5 — Rate-limit / cost floor on anonymous MASSIVE-driven endpoints.** Likely a fast-follow (Cloudflare
  edge rate-limit / ticker allowlist) rather than a go-live blocker for a low-traffic launch — but system-6
  must name the accepted risk. Not architect-decidable (it's a product/cost-tolerance call → the conductor).
- **OQ-6 — Free-tier longevity.** Railway's 30-day/$5 trial — when it lapses, the backend sleeps/stops; the
  Pages SPA + Function then 502 on `/api`. Out of scope for the first deploy (non-goal: cost/plan), flagged
  for the owner's awareness.

---

## 9. Non-goals (restated, explicit)

No custom domain (free subdomains first). No CI/CD pipeline (manual first deploy). No app/scoring/engine
change (config + plumbing only; `state_fingerprint` byte-identical). No Google OAuth go-live (creds stay
unset → present-but-disabled). No real-order/broker path (Positions `SIMULATED`, Live tab locked). No
persistent-store redesign (the shipped Postgres adapter is used as-is). No multi-replica metering
centralization (the per-admin AI counters stay process-local — a known `persistent-db` deferred seam,
out of scope).

---

## 10. COMPRESSOR #2 — handoff to the CONDUCTOR (PM/UX skipped; next = small repo execution pass + system-6 + guided owner ops)

> The contract above IS the spec. This is the orientation for what the conductor schedules next. No PM ACs /
> no UX execution contract for this infra feature.

- **Pivotal call DECIDED — option (A) Cloudflare Pages Function proxy.** Grounded: the client
  (`libs/api/src/lib/convexa.ts`) is **relative-`/api/*` only**, no `VITE_` base, SSE via `EventSource`,
  cookie `same-origin` — so a same-origin edge proxy is the zero-client-change fit; CORS (B) rejected (would
  need a new build-time API base + cross-site cookie). The Function must **stream** the body so SSE survives.
- **Three load-bearing repo changes for a small execution pass (no Edit by the architect): R1** `$PORT` —
  `apps/api/Dockerfile` CMD must honor `${PORT:-8000}` (Railway injects `$PORT`; currently hardcoded 8000,
  shell-form CMD fix, keep compose/local on 8000); **R3** ADD the Pages Function `functions/api/[[path]].ts`
  (streaming proxy → `API_ORIGIN`, forwards cookies, does NOT proxy `/api/_metrics`); **R2** env-gate the
  hardcoded `CORSMiddleware` (`main.py:445-451`) to an `ALLOWED_ORIGINS` allowlist (never `*`). All
  config-only — `state_fingerprint` byte-identical (`[additive-keeps-score-byte-identical]`).
- **Two security must-decides surfaced for system-6 (run on a different model):** `GET /api/_metrics` is
  **un-gated and would be internet-reachable** (recommend: don't proxy it through the public Function); and
  the **anonymous MASSIVE-driven bundle/SSE endpoints have no rate-limit** (cost/abuse vector — likely a
  fast-follow, but must be named). Plus the routine floor: secrets-only-in-Railway, CORS locked to the Pages
  origin, cookie `Secure`+`SameSite=Lax` (correct under A), the ciphertext-only AI-key boundary, the
  ANTHROPIC cost lock (admin allowlist = owner only). Full S1–S6 scope in §5.
- **Mandatory stable secrets (the go-live trap):** `ACCOUNT_STORE=postgres` makes persistence real, so
  `AUTH_SESSION_SIGNING_KEY` + `AI_KEY_ENCRYPTION_KEY` MUST be set to **stable** values in Railway (else every
  deploy logs all users out / makes stored AI keys undecryptable — `[secret-encrypted-at-rest]`). Full env
  manifest in §3 (Railway service root dir = `apps/api`; Postgres plugin → `DATABASE_URL` reference; idempotent
  schema bootstrap = no migration step). Pages build (§4): `npx nx build @org/dashboard` → `apps/dashboard/dist`,
  **repo-root** dir (because `@org/api` is source-consumed), Node 20, `API_ORIGIN` env var.
- **Sequence:** push R1+R3(+R2) → Railway service (Dockerfile, root `apps/api`, Postgres, §3 vars) → Pages
  project (§4 build + `API_ORIGIN`) → back-fill `ALLOWED_ORIGINS` with the real `*.pages.dev` → cross-origin
  verify (bundle + **streaming SSE** + first-party cookie + gated write) → system-6 pass on S1–S6 → declare
  go-live. **Six open questions** (OQ-1..6) are flagged in §8 — OQ-1 (Functions dir location) and OQ-4
  (`/api/_metrics` exposure) need resolution during the execution pass; OQ-5 is a conductor product-risk call.
