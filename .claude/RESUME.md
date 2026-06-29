# RESUME — handoff snapshot (2026-06-29)

> For a fresh **Delivery Conductor** session. The standard `/conductor` boot reconstructs full state from
> `PROJECT_CONTEXT.md` + `BACKLOG.md` + `OPEN_THREADS.md` + `DECISION_LEDGER.md` (all current as of this
> snapshot). This file is the "where we are right now + what's next" overlay. Self-contained against the canon.

## Status: Convexa is SHIPPED + LIVE in production 🎉
- **Frontend:** https://convexa.pages.dev (Cloudflare Pages; static Vite build of `apps/dashboard`).
- **Backend:** https://convexa-production.up.railway.app (Railway; the `apps/api` Dockerfile container, app on `$PORT`=8080) + managed **Postgres** (`ACCOUNT_STORE=postgres`).
- **Cross-origin `/api`:** a streaming **Cloudflare Pages Function** (`functions/api/[[path]].ts`) proxies `/api/*` → the Railway backend (reads `API_ORIGIN` env). Same-origin to the browser; SSE-safe.
- Verified end-to-end: SPA 200; `convexa.pages.dev/api/auth/session` returns real Postgres-backed JSON via the proxy. `HEAD` on `main` is pushed to `github.com/ariasr47/convexa` (public).

## The infra/deploy program is COMPLETE
`containerize-apps` → `persistent-db` → `deploy` all shipped + archived (`.claude/contracts/_archive/`). Earlier this session also shipped: `user-accounts`, `rebrand-convexa` (full GammaFlow→Convexa), `byo-ai-key`. Pipeline **queue is drained** — a fresh conductor at GATE I picks the next item.

## Immediate next steps / open items (post-launch, none blocking)
1. **Security hardening (from `_archive/deploy/SECURITY_REVIEW.md`):** set `ALLOWED_ORIGINS=https://convexa.pages.dev` in Railway (lock CORS — the proxy is same-origin so it isn't hit today, but lock it). Then the **3 MED + 3 LOW** fast-follows (CORS localhost-default-in-prod, `AUTH_COOKIE_SECURE` confirm, SSE connection ceiling; public OpenAPI docs, broad CORS methods/headers, Google OAuth state cleanup).
2. **Prerender public pages (SSG) + SEO hygiene** — BACKLOG §B (landing/blog crawlable + meta/OG/sitemap; full SSR was evaluated + rejected).
3. **CI/CD** — GitHub Actions: run `nx test` + `interface_conformance.py` on push, then deploy (Railway + Pages auto-deploy on push to `main` already).
4. **Custom domain** (optional) on both hosts.
5. **Centralize the per-replica AI metering counters** (currently process-local; named deferred seam in `persistent-db`).
6. **Track A:** `scanner` (revisits the single-ticker decision; perf design). **Track B (gated):** `broker-connect` (Webull, blocked on API access + re-triggers system-6).
7. Optional: provision a **Google Cloud OAuth client** → set `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` in Railway to enable "Continue with Google" (currently shows disabled — correct).

## Gotchas for the next session
- **Stable keys are set in Railway — do NOT rotate** `AI_KEY_ENCRYPTION_KEY` (Fernet) or `AUTH_SESSION_SIGNING_KEY` (would invalidate all sessions + make stored AI keys undecryptable). All secrets live in Railway Variables only, never in the repo/image.
- **Railway domain port = 8080** (matches the app's `$PORT`); if a future Dockerfile change alters the port, re-align the domain.
- **Dev box has no Docker / Postgres / Massive-live by default** — local keyless boot = `MASSIVE_API_KEY=dummy-verify AI_REC_STUB=1`; deploy-time verify happens on Railway. `apps/api/.env` holds the real local keys (gitignored).
- **`gh` CLI** is the portable build at `C:\Users\rodri\tools\gh\bin\gh.exe` (not on the harness PATH).
- **Toolchain:** node via nvm (`/c/nvm4w/nodejs`), `py` not `python`, backend venv `apps/api/.venv`.
- Local dev servers (`:8000`/`:4200`) may or may not still be running from this session; restart with `npm run dev` if needed.
