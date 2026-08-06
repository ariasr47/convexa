# Convexa — deploy runbook (current)

> **This supersedes** `.claude/contracts/_archive/deploy/ARCHITECTURE_CONTRACT.md` §7, which was written
> **2026-06-29** and predates the Scanner. Follow **this** document. The archived contract remains the
> authority on _why_ the architecture is shaped this way (Pages Function, cross-origin, security review) —
> it is historical record and is deliberately not edited.
>
> **Last updated 2026-07-27.** Host shape unchanged: backend + worker on **Railway**, frontend on
> **Cloudflare Pages**, cross-origin `/api` via a streaming Pages Function.
>
> **This is an OWNER runbook.** Every step is dashboard work and secret entry. It cannot be automated by an
> assistant, and secrets must never be committed or pasted into a repo file.

---

## 0. What changed since the original runbook

Four features shipped after it was written. Following the old runbook verbatim today produces a working
site with a **permanently empty `/scanner` page**, because nothing starts the sweep worker.

| Shipped since               | Deploy impact                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `scanner` (P1–P4)           | **A SECOND Railway service** (the sweep worker) + a shared **Postgres-backed** scan store + new `SCAN_*` env |
| `bundle-events`             | none — reads a checked-in config already inside the image                                                    |
| `expiration-events`         | none — derived at serve time                                                                                 |
| Curvature Terminal redesign | none — frontend only                                                                                         |

**The one structural change:** the app is now **two processes**, not one. Same image, different start
command. Everything else below is the original runbook with the scanner steps folded in.

⚠ **Prerequisite (already fixed in-repo 2026-07-27):** `apps/api/Dockerfile` must `COPY worker.py ./`.
The image uses explicit COPYs, and the worker entrypoint was missing — a worker service built from an
older image dies instantly with _"can't open file '/app/worker.py'"_. Verify the line is present before
deploying.

---

## Phase 1 — Backend (web) on Railway

1. Railway → **New Project** → Deploy from GitHub repo `ariasr47/convexa`.
2. Service → Settings → Build: **Dockerfile**, Dockerfile path `apps/api/Dockerfile`, **Root Directory
   `apps/api`**. Name it something like **`api`** — you will add a sibling shortly.
3. Add the **Postgres** plugin to the project.
4. Service → **Variables**:

   **Required**
   - `ACCOUNT_STORE=postgres`
   - `DATABASE_URL` = reference the plugin: `${{Postgres.DATABASE_URL}}`
   - `AUTH_SESSION_SIGNING_KEY` = freshly generated **stable** random string — _keep it; reuse on every
     deploy or every session cookie dies_
   - `AI_KEY_ENCRYPTION_KEY` = freshly generated **stable** Fernet key — _keep it; reuse or every stored
     user AI key becomes undecryptable_
   - `MASSIVE_API_KEY`, `DATA_FEED`

   **AI + admin**
   - `ANTHROPIC_API_KEY`, `AI_REC_ADMIN_EMAILS` (your login email), `AI_REC_ADMIN_FREE_DAILY`,
     `AI_REC_DAILY_CAP`

   **Security**
   - `METRICS_SECRET_TOKEN`, `PUBLIC_RATE_LIMIT_PER_MIN`
   - Confirm `AUTH_COOKIE_SECURE=true` (or unset — defaults true) and `AUTH_COOKIE_SAMESITE=lax`
   - `ALLOWED_ORIGINS` — set in step 15 once the Pages URL exists. ⚠ **CORRECTED 2026-08-06 — the old
     warning here was stale.** It said "leaving it unset does NOT fail closed: it defaults to the
     localhost dev list." That was true before the system-6 S2-prod fix; **the code now fails CLOSED**
     (`main.py:747` — unset ⇒ `[]` ⇒ deny-all, with a conspicuous startup WARNING). Under the deployed
     shape the browser is **same-origin** (the Pages Function proxies `/api/*`), so deny-all is the
     correct resting state and an unset value will NOT break the site. Set it anyway for defence in
     depth, but it is no longer the emergency the old wording implied.

   **NEW — Private-testing lockdown (2026-08-06). Set these or you will deploy a site you cannot log
   into.** Registration is closed and fails closed, so there is no "sign up" path in production.
   - Leave `SIGNUPS_ENABLED` **unset** — unset means sign-ups are OFF, which is the intended
     production state. Set it to `1` only when you decide to reopen registration.
   - `OWNER_EMAIL` + `OWNER_PASSWORD` — your account. Seeded idempotently at every boot; on Postgres
     the row persists and the seed is a no-op. **This is the only way to get an account in prod**,
     because `SEED_TEST_ACCOUNT` deliberately refuses to run against Postgres.
   - `OWNER_EMAILS` — comma-separated; these addresses may register even while sign-ups are closed.
     Include `OWNER_EMAIL`. Add a second address here if you want to invite someone without reopening
     registration to the world.
   - `SEED_ACCOUNTS` — **your testing logins, which stay valid and active under the lockdown.** JSON
     array: `[{"email":"qa1@…","password":"…","display_name":"QA 1"}]`. Seeded idempotently at every
     boot on the same path as `OWNER_EMAIL`, and it *does* work on Postgres. JSON rather than
     `email:password` because a delimiter format silently truncates any password containing `:` or
     `,`. ⚠ Do **not** try to use `SEED_TEST_ACCOUNT` for this — it seeds a fixed credential whose
     default password is published in this repo, and it deliberately refuses to run against Postgres.
     That guard is intentional; use `SEED_ACCOUNTS` with passwords you choose.
   - Keep `AI_REC_ADMIN_EMAILS` aligned with your login email (above) or you get no shared-key AI
     allowance and must BYO key.

   **NEW — Scanner (web side)**
   - `SCAN_STORE=postgres` — ⚠ **critical.** The default is `disk` (a local SQLite file). Two Railway
     services have **separate filesystems**, so on `disk` the worker writes where the web service can
     never read, and the scanner silently stays empty forever.
   - `SCAN_DATABASE_URL` — optional; omit and it falls back to `DATABASE_URL`.
   - Leave `SCANNER_EMBEDDED` **unset**. It is a local one-terminal dev shortcut; setting it in prod runs
     a sweep inside every web replica.
   - Leave `SCAN_UNIVERSE_PATH` / `SCAN_EVENTS_PATH` unset — the curated configs ship inside the image.

5. **Deploy.** First boot runs the idempotent `CREATE TABLE IF NOT EXISTS` bootstrap — no manual migration.
   Note the URL `https://<service>.up.railway.app`.
6. **Smoke-test the Railway URL directly:**
   - `GET /api/personas` → 200
   - `GET /api/ticker/TSLA` → a bundle (proves `MASSIVE_API_KEY`)
   - `GET /api/scan` → ⚠ **CORRECTED 2026-08-06: this is now `403 auth_required` when signed out**, not
     a 200 with `rows: []`. The lockdown session-gated the three scan reads. To smoke-test the store,
     log in first (below) and re-issue it with the session cookie: **then** expect `200` with
     `rows: []` and a null/absent sweep heartbeat — _empty is correct here, no worker is running yet._
     A 5xx behind the session means the scan store is misconfigured; fix before continuing.
   - ⚠ **CORRECTED 2026-08-06: do NOT "sign up" — registration is closed in production.** Instead
     confirm the owner seed worked: the boot log should carry `[main] owner account seeded` (or
     `already present (no-op)` on later deploys). Then **log in** with `OWNER_EMAIL`/`OWNER_PASSWORD`
     → save an AI key → **redeploy** → key still usable (proves the stable keys + Postgres).
   - Confirm the lockdown is actually on: `POST /api/auth/signup` with a throwaway address →
     **`403 signups_closed`**. A `200` here means `SIGNUPS_ENABLED` is set when it should not be.

---

## Phase 1b — Sweep worker on Railway (NEW — this is the part the old runbook lacks)

7. In the **same** Railway project → **New Service** → **same GitHub repo**, same build settings as step 2
   (Dockerfile `apps/api/Dockerfile`, root `apps/api`). Name it **`worker`**.
8. Service → Settings → **Start Command**: `python worker.py`
   _(This is the only difference from the web service — same image, different entrypoint.)_
9. Service → Variables — the worker needs the **data + store** vars, not the web/AI ones:
   - `SCAN_STORE=postgres`, `DATABASE_URL=${{Postgres.DATABASE_URL}}`
   - `MASSIVE_API_KEY`, `DATA_FEED`
   - Optional cadence tuning (defaults are sane): `SCAN_FAST_INTERVAL_SECONDS` (30),
     `SCAN_SLOW_BATCH_SIZE` (4), `SCAN_MOVE_THRESHOLD_PCT` (0.75), `SCAN_PROMOTION_CAP`,
     `SCAN_STALE_AFTER_SECONDS`
   - Leave `SCANNER_EMBEDDED` unset here too.
10. **Replicas: exactly 1.** ⚠ v1 has **no multi-worker coordination** (an explicit non-goal). Two workers
    would not corrupt data — rows are latest-wins — but they would double vendor spend and race the
    promotion queue. Do not autoscale this service.

**Verify the worker:** its logs should show `[universe] loaded 69 symbols`, then
`[worker] sweep loop start: universe=69, fast=30.0s, pool=4`, then per-ticker fetches. Within ~2–3 minutes
`GET /api/scan` on the **web** service should return populated rows with a fresh heartbeat. If rows stay
empty while the worker logs look healthy, `SCAN_STORE` is wrong on one of the two services — that is the
single most likely misconfiguration in this whole runbook.

---

## Phase 2 — Frontend on Cloudflare Pages

11. Pages → **Create project** → connect `ariasr47/convexa`.
12. Build configuration: command `npx nx build @org/dashboard`, output `apps/dashboard/dist`, root dir
    empty, framework preset **None**.
13. Pages → Settings → Environment variables: `API_ORIGIN=https://<service>.up.railway.app`,
    `NODE_VERSION=20`.
14. Deploy. Note `https://<project>.pages.dev`.
15. **Back-fill the CORS allowlist:** set Railway `ALLOWED_ORIGINS` to the actual `*.pages.dev` URL on the
    **web** service, then redeploy it. (See the warning in step 4.)

---

## Phase 3 — Verify end-to-end

16. Open `https://<project>.pages.dev`. The SPA calls relative `/api/*` → Pages Function → Railway. Check:
    - the ticker bundle loads, and **SSE live tiles update** (the Function streams) — the ticker and
      landing pages stay **public** under the lockdown, so this must work signed out
    - ⚠ **CORRECTED 2026-08-06:** `/scanner` and `/positions` now show a **sign-in wall** signed out.
      That is correct, not a broken deploy. **login** (not sign-up — it is closed) sets the session
      cookie first-party on `*.pages.dev`; both pages then render.
    - a gated sim-trade write succeeds signed-in and **403s logged-out**
    - the AI rec works for the admin email
17. **NEW — Scanner:** open `/scanner`. Rows should populate with scores and a freshness header. Confirm:
    - not stuck on skeleton, and no permanent **"Sweep last ran …"** worker-down banner
    - uncurated tickers (TSLA, MU, CSCO, UNH) show event state **unknown** — _not_ "no earnings"
    - clicking a row lands on a **fast** ticker page (the warm-click read-through)
18. Confirm `/api/_metrics` is **not** reachable from `*.pages.dev` (the Function must not proxy it).

---

## Risks to accept knowingly before you start

- **First-ever execution of the scan schema.** `scan_rows`, `scan_heartbeat`, `scan_bundles` and the
  `scan_view` column on `settings` have been **parity-reviewed but never run against a live Postgres** —
  there is no local Postgres on the dev box. This deploy is their first real execution. They bootstrap
  idempotently, but watch the first boot logs. Tracked as `auth-schema-migrations` (BACKLOG §B).
- **The worker sweeps 24/7.** There is no market-hours gate yet, and the vendor has **no overnight data**
  (8pm–4am ET), so roughly a third of its API calls fetch nothing new. That is a second always-on service
  plus continuous vendor spend. Tracked as `scanner-market-hours-gate` (BACKLOG §B) — worth doing _before_
  a long-running deploy if cost matters.
- **`ALLOWED_ORIGINS` fails open, not closed** (MEDIUM, from the original security review). Step 15 is not
  optional.
- **This is a large first delta.** Nothing is currently live, so this ships the Curvature Terminal redesign,
  the Scanner, and both event features at once.
- **Free-tier longevity.** When the Railway trial lapses the backend stops and the Pages SPA 502s on
  `/api`. Two always-on services consume it faster than one.

---

## If you need to roll back

Railway keeps previous deployments — redeploy the prior build on the **web** service. The **worker** can be
stopped independently at any time with **no effect on the site**: the scan store keeps its last rows, the
scanner shows them behind an honest "sweep last ran X ago" banner, and every other page is untouched. That
separation is by design — the worker is a background producer, never a dependency of the request path.
