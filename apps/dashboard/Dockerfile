# syntax=docker/dockerfile:1.26.0@sha256:ecfaec9ed6d810b56388c508f4121597bfbba70d41a6dfeee4d8cad5f295fc32
# ============================================================================
# Convexa dashboard (React 19 + Vite + MUI) — multi-stage image.
#
# BUILD CONTEXT = REPO ROOT (mandatory). The dashboard imports @convexa/api from
# libs/api as SOURCE (workspace), so building from apps/dashboard alone FAILS —
# the build needs libs/api/src, the root package.json + package-lock.json, nx.json,
# and tsconfig.base.json. Build it from the repo root:
#   docker build -f apps/dashboard/Dockerfile -t convexa-web .
# The root .dockerignore keeps the context tight (excludes node_modules/.git/dist/
# .env*/apps/api/.venv/etc.) while KEEPING libs/ + apps/dashboard/ source.
#
# Production build also runs tools/precompress-dashboard.mjs → dist/**/*.br + *.gz
# for nginx brotli_static / gzip_static (zero CPU at request time).
#
# No secrets: the static bundle is server-side-key-free (ANTHROPIC_API_KEY etc.
# are all backend-only). NON-GOAL (noted, not built): in production the static
# bundle commonly ships to a CDN / object storage rather than a container; that
# is a `deploy`-time decision, intentionally not designed here.
# ============================================================================

# ----------------------------------------------------------------------------
# Stage 1 — builder: install the workspace + build the dashboard through Nx.
# ----------------------------------------------------------------------------
FROM node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS builder
WORKDIR /app

# Bring in the whole (dockerignore-filtered) workspace, then install. We copy
# everything because the Nx project graph + workspace resolution need the root
# manifests AND libs/api source present together. node_modules is excluded by
# .dockerignore, so `npm ci` materializes the workspace symlinks deterministically.
COPY . .
RUN npm ci

# Production build: Vite + precompress (.br / .gz siblings).
# Output: apps/dashboard/dist
RUN npx nx build @convexa/dashboard --configuration=production

# ----------------------------------------------------------------------------
# Stage 2 — runtime: nginx with ngx_brotli (brotli_static + gzip_static).
# ----------------------------------------------------------------------------
# fholzer/nginx-brotli includes static + dynamic brotli modules. Listens on 80 by
# default; we override the server block to 8080 for compose/k8s parity with the
# previous unprivileged image (map host ports as needed).
FROM fholzer/nginx-brotli:v1.31.3@sha256:e1e3c88f7df467e7c7d67dd4e167c6ef05f8cca819e2c9617f932f2cb628b140

# SPA + /api proxy + static compression config.
COPY apps/dashboard/nginx.conf /etc/nginx/conf.d/default.conf

# Built static bundle (includes .br / .gz siblings).
COPY --from=builder /app/apps/dashboard/dist /usr/share/nginx/html

RUN touch /var/run/nginx.pid /var/run/nginx.lock \
    && chown nginx:nginx /var/run/nginx.pid /var/run/nginx.lock \
    && chown -R nginx:nginx /var/cache/nginx /usr/share/nginx/html

USER nginx
EXPOSE 8080

# Liveness probe: busybox wget against the SPA index.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
