# Cloudflare Pages setup (Convexa SPA)

First-time production frontend. Backend stays on **Railway**; the SPA is static on
**Cloudflare Pages** with an edge Function that proxies `/api/*` → Railway so
cookies + SSE stay same-origin.

```
Browser  →  https://<project>.pages.dev
              ├── static assets (Vite dist)
              └── /api/*  →  functions/api/[[path]].ts  →  Railway api-rust
```

## Prerequisites

- Cloudflare account (free is fine): https://dash.cloudflare.com/sign-up
- GitHub repo connected: `ariasr47/convexa` (or your fork)
- Railway API already live: **`https://convexa-production.up.railway.app`**
  - Smoke: open `/api/health` → `"status":"ok"`, `"service":"api-rust"`

## Step 1 — Create the Pages project

1. Open **[Cloudflare Dashboard](https://dash.cloudflare.com)** → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Authorize GitHub if asked; pick **`ariasr47/convexa`**.
3. Project settings:

| Field | Value |
|--------|--------|
| **Project name** | `convexa` (gives `https://convexa.pages.dev` — matches OG/canonical tags in the SPA) |
| **Production branch** | `main` |
| **Framework preset** | **None** |
| **Root directory** | *(empty / repo root)* |
| **Build command** | `npm run build:dashboard` |
| **Build output directory** | `apps/dashboard/dist` |

Prefer **`npm run build:dashboard`** over a raw `nx build @…/dashboard` string. The script lives in root `package.json` and always targets the current package name (`@convexa/dashboard`), so a future rename will not leave Pages stuck on a dead project id.

4. **Environment variables** (Production + Preview if you want previews to hit prod API):

| Name | Value |
|------|--------|
| `NODE_VERSION` | `26` (or `26.7.0` — **required**; package `engines` is `node >= 24`. CF default Node 20 fails engine checks and is EOL) |
| `API_ORIGIN` | `https://convexa-production.up.railway.app` |

`API_ORIGIN` has **no trailing slash**. It is not a secret; it is the public API URL.

5. Click **Save and Deploy**. First build is ~2–5 minutes.

The repo already includes:

- `functions/api/[[path]].ts` — proxies `/api/*` (SSE-safe, blocks `/api/_metrics`; adds nosniff / frame / HSTS on the proxy response)
- `apps/dashboard/public/_redirects` — SPA fallback so `/scanner`, `/ticker/...` work
- `apps/dashboard/public/_headers` — CSP, HSTS, `X-Frame-Options: DENY`, nosniff (Cloudflare Pages static headers)

## Step 2 — Note your Pages URL

After a green deploy:

- Production: `https://convexa.pages.dev` (or `https://<project-name>.pages.dev`)
- Deployments tab shows logs if the build fails

## Step 3 — Allow the SPA origin on Railway

On the **api-rust** service variables:

| Name | Value |
|------|--------|
| `ALLOWED_ORIGINS` | `https://convexa.pages.dev` |
| `AUTH_COOKIE_SECURE` | `true` |

If you later add a custom domain (e.g. `https://app.convexa.com`), add it comma-separated:

```text
https://convexa.pages.dev,https://app.convexa.com
```

Redeploy is usually not required for env-only changes on Railway, but a restart is fine.

## Step 4 — Smoke checklist

Open `https://convexa.pages.dev` (or your project URL):

1. **Landing** loads (static SPA).
2. **`/api/health`** in the browser (same origin) returns JSON with `"status":"ok"` and `"service":"api-rust"`.  
   If you see `API_ORIGIN is not configured` → Pages env missing; fix Step 1.4 and redeploy.
3. **Ticker** (e.g. SPY) loads data; live tiles / SSE should update when the market path is warm.
4. **`/scanner` / `/positions`** may show a **sign-in wall** when logged out — expected.
5. **Login** sets a cookie on `*.pages.dev` (first-party); gated routes then work.
6. **`/api/_metrics`** should **404** from Pages (operator-only; not proxied).

Direct API check (not via Pages):

```bash
curl -sS https://convexa-production.up.railway.app/api/health
```

## Optional — CLI (Wrangler)

Useful for deploys without the dashboard after the project exists:

```bash
npx wrangler login
# one-time browser OAuth

# Deploy a prebuilt dist (run build first)
npx nx build @convexa/dashboard --configuration=production
npx wrangler pages deploy apps/dashboard/dist --project-name=convexa
```

Git-connected deploys (push to `main`) are usually enough; Wrangler is optional.

## Optional — custom domain

1. Pages → project → **Custom domains** → add `app.yourdomain.com` (or apex).
2. Follow Cloudflare DNS (automatic if the domain is already on CF).
3. Add the custom origin to Railway `ALLOWED_ORIGINS`.
4. Update SPA canonical/OG URLs later if you want marketing on the custom host.

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Build fails: Node / nx not found | Set `NODE_VERSION=26.7.0`; build from **repo root**, not `apps/dashboard` |
| **`Cannot find project '@org/dashboard'`** | **Stale Pages build command** (seen 2026-08-10). Dashboard still has `npx nx build @org/dashboard` after the package rename to `@convexa/*`. **Fix (dashboard, not git):** Pages → project → **Settings → Builds & deployments** → **Build configuration** → Build command = `npm run build:dashboard` → Save → **Deployments → ⋯ → Retry deployment** on latest `main`. |
| Node 20 / `EBADENGINE` / EOL warning | Set env **`NODE_VERSION=26`** (Production). Repo requires Node ≥ 24 (see `.nvmrc` / `package.json` engines). |
| Site looks weeks old / old blog posts | **Failed deploys leave the last good build live.** Fix the build command (row above), retry, then hard-refresh (`Ctrl+Shift+R`). |
| Two blog cards that were deleted in git | SPA is client-rendered from the **deployed** JS. `main` only lists `how-we-read-dealer-structure`. Old AI-team cards ⇒ production is still on a pre-rename deploy. |
| SPA loads, `/api/*` → 502 `API_ORIGIN is not configured` | Env var not set on **Production** environment, or not redeployed after add |
| `/api/*` → 502 / connection errors | Wrong `API_ORIGIN`, Railway sleeping/down, or typo in URL |
| Login works then immediately logged out | Cookie `Secure` over HTTP; use HTTPS Pages URL; check `AUTH_COOKIE_SECURE=true` on API |
| Hard refresh deep link 404 | Missing `_redirects` SPA rule (should ship from `public/`) |
| CORS errors in console | Railway `ALLOWED_ORIGINS` missing your Pages origin |

## What not to do

- Do **not** set Root directory to `apps/dashboard` unless you also change the Function path layout (Functions live at repo `functions/`).
- Do **not** bake secrets into the SPA build; only public config belongs in `API_ORIGIN`.
- Do **not** point `API_ORIGIN` at the old Python service — only `api-rust` / `convexa-production.up.railway.app`.
