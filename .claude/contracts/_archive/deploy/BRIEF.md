# deploy — brief

Goal:            Take Convexa **live**: the FastAPI backend (the shipped `apps/api/Dockerfile`) + **managed
                 Postgres** on **Railway**, the static Vite frontend on **Cloudflare Pages** — wired
                 cross-origin (`/api` → Railway). Produce the **exact, copy-pasteable config the owner
                 applies in the dashboards** (this feature is part repo-config, part guided ops): the Railway
                 service settings (Dockerfile path, port, healthcheck, Postgres plugin → `DATABASE_URL`) + a
                 **complete env/secret manifest** (incl. `ACCOUNT_STORE=postgres`, a **stable**
                 `AI_KEY_ENCRYPTION_KEY` + `AUTH_SESSION_SIGNING_KEY`, `MASSIVE_API_KEY`, `ANTHROPIC_API_KEY`,
                 `AI_REC_ADMIN_EMAILS`); the Cloudflare Pages **build settings** for the Nx monorepo
                 (build command `npx nx build @org/dashboard`, output `apps/dashboard/dist`, root dir, the
                 `@org/api`-as-source consideration); and the **cross-origin `/api` wiring**. This is the
                 **public go-live**, so it runs **WITH the Security/red-team review (system-6)**.

Decision impact: **N/A** (deploy/infra — trading-decision cull N/A; judged on a working, secure go-live).
                 Makes the product publicly reachable for the first time.

Feasibility:    pass. The container + Postgres adapter + Pages-ready static build all shipped
                 (`containerize-apps`, `persistent-db`); Railway builds the Dockerfile + provides Postgres →
                 `DATABASE_URL`; Cloudflare Pages builds the static bundle. The **runtime verification finally
                 happens for real here** (Railway actually builds the image + runs Postgres; the deferred
                 Docker/Postgres verifies from the prior two features get exercised). Owner has the accounts
                 (Railway 30-day/$5 trial; Cloudflare). The one genuine design call is the cross-origin
                 `/api`.

Effort:          M (config + the security review; most "execution" is guided ops the owner performs)

Invariant watch: **`[no-secrets-in-image]` — GRADUATES here** (its 3rd, finally-runtime-real instance:
                 containerize authored it, persistent-db reaffirmed it, deploy *pushes an image to a
                 registry* — the rule about published artifacts is now load-bearing). Secrets go ONLY into
                 Railway's Variables panel, never committed/baked; the owner enters values.
                 **`[secret-encrypted-at-rest]` (canon)** — a **stable** `AI_KEY_ENCRYPTION_KEY` is now
                 mandatory (in-memory→Postgres is persistent; an ephemeral key would make stored keys
                 unreadable after a redeploy).
                 **`[additive-keeps-score-byte-identical]`** — deploy is config/wiring; no app-behavior change.
                 **Security floor → system-6 ACTIVATES** — the deferred adversarial review lands now: secrets
                 handling, the **CORS/origin allowlist** (lock to the Pages origin, not `*`), public attack
                 surface, auth/credential exposure, rate-limit/abuse on the now-public endpoints, the
                 ANTHROPIC/MASSIVE cost exposure. Ideally a **different model** than the builders.

Context tags:    architecture,backend,frontend,api,conventions,decisions

Entry point:     architect-first — pivotal calls: (1) the **cross-origin `/api`** approach — a **Cloudflare
                 Pages proxy/rewrite** of `/api/*` → the Railway URL (preferred: keeps it same-origin to the
                 browser, no CORS) **vs CORS** on FastAPI (env-gated origin allowlist) — pick one, with the
                 repo artifact it needs (a Pages `_redirects`/Function/`wrangler`/`_routes.json`, or a
                 FastAPI `CORSMiddleware` keyed by an env allowlist); (2) the **Railway service shape**
                 (Dockerfile build, the `PORT` convention — Railway injects `$PORT`, our CMD hardcodes 8000,
                 reconcile —, healthcheck, Postgres plugin → `DATABASE_URL`); (3) the **Cloudflare Pages
                 build** for the monorepo; (4) the **env/secret manifest** (names + where each goes, values
                 owner-entered); (5) the **system-6 review scope**. Identify exactly which (if any) repo files
                 must be added/changed vs pure dashboard config. Non-goals: no custom domain (use the free
                 `*.pages.dev` / `*.up.railway.app` first), no CI/CD pipeline yet (manual first deploy),
                 no app/scoring change.

Source:          Owner 2026-06-29 — step 3 of the infra/deploy program; accounts created (Railway trial +
                 Cloudflare Pages, both GitHub-connected to `ariasr47/convexa`). The "going live" trigger that
                 re-promotes the deferred Security/red-team role (system-6).
