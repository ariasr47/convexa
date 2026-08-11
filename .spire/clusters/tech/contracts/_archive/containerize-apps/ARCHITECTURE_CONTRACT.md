# ARCHITECTURE_CONTRACT — containerize-apps

> **Role / lane:** Architect (GATE-M infra fast-path). PM + UX are **skipped** — there is no product
> surface and `NO_INTERFACE_CHANGE`. **This contract doubles as the BUILD SPEC**: the §"Files to create"
> section is implementable directly by the infra executioner with no further design pass.
> **Docker is NOT installed here** — this spec is authored correct-by-construction. The executioner
> CANNOT `docker build`; §"Review checklist (stands in for a build)" + §"Owner runtime build-verify" are
> the verification contract.
> Self-contained: grounded against the repo at lock time, assumes no chat history.

---

## 0. Goal (one line)

Produce production-shaped, portable container artifacts — a backend `Dockerfile` (`apps/api`), a
multi-stage frontend `Dockerfile` (`apps/dashboard`), a root `docker-compose.yml` for one-command local
full-stack, and a `.dockerignore` set — with **no secrets baked in**, **non-root** runtime, and **no app
code change**. Packaging only; the engine/bundle/score/`state_fingerprint` are untouched.

---

## 1. Binding constraints (restated — apply to every artifact)

- **`[no-secrets-in-image]` (HARD, feature-binding).** No secret, key, `.env`, or credential is ever
  copied into any image layer. All config + secrets are injected at **runtime via environment**
  (12-factor): `MASSIVE_API_KEY`, `ANTHROPIC_API_KEY`, `AI_KEY_ENCRYPTION_KEY`,
  `AUTH_SESSION_SIGNING_KEY`, `AI_REC_ADMIN_EMAILS`, `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`, plus the
  tuning knobs (§PROJECT_CONTEXT 7). A `COPY . .` that pulls `.env` / `.venv` / `conf/token.txt` into a
  layer is a **hard FAIL** — the `.dockerignore` is the structural guard.
- **`[non-root]` (HARD).** Every image's final runtime stage runs as a non-root user (explicit `USER`).
- **`[additive-keeps-score-byte-identical]`** — holds **trivially**: no app code, no `requirements.txt`
  change, no Vite/Nx config change, no `main.py` change. The engine, bundle, `opportunity_score`,
  `opportunity_tier`, and `state_fingerprint` are byte-identical to today. If any artifact would require
  editing app code, that is out of lane → bounce.
- **`NO_INTERFACE_CHANGE`** — no endpoint, payload field, or copy is touched. The FE↔BE seam
  (`/api/*` proxy → uvicorn :8000) is preserved, just relocated from the Vite dev proxy to nginx.

## 2. Explicit non-goals (do NOT do these — they are sequenced follow-on features)

- **NO host / registry / deploy** — no `docker push`, no cloud config, no domain/TLS, no reverse-proxy-for-
  internet. (Follow-on: `deploy`.)
- **NO CI workflow** — no GitHub Actions / build pipeline.
- **NO persistent-DB swap.** The auth/session/AI-key stores stay **in-memory SQLite** (`:memory:`) and the
  per-ticker `data/` dumps stay ephemeral. **Containers are STATELESS and restart-resettable** — every
  container restart loses all sessions, accounts, stored AI keys, and persisted dumps, and nothing is
  shared across replicas. This contract **documents** that; it does not solve it. The fix is the **NEXT
  feature, `persistent-db`** — this is the required successor. (See §6 "Stateless / data" + the
  `AUTH_SESSION_SIGNING_KEY` / `AI_KEY_ENCRYPTION_KEY` note: leaving them unset ⇒ ephemeral per-process
  keys, which compounds the restart-reset; set stable values once `persistent-db` lands.)
- **NO secrets-management system** beyond plain runtime env injection (no Vault/SOPS/secret-store).
- **NO real-order path / broker** — unrelated; `[no-real-order-path]` untouched.

---

## 3. Grounding facts (verified against the repo at lock — load-bearing)

These drove every decision below; the executioner must not re-derive them.

**Backend (`apps/api`):**
- Entrypoint: `apps/api/main.py` ends with `uvicorn.run("main:app", host="127.0.0.1", port=8000,
  reload=True)`. `nx serve api` runs `.venv\Scripts\python.exe main.py` with **`cwd: apps/api`**
  (`apps/api/project.json`).
- **`load_dotenv()` is bare** (`src/providers/massive.py:27`) → it reads `./.env` relative to the
  **process cwd**. With cwd = the app dir, that file is `apps/api/.env`. **In the container we DO NOT copy
  a `.env`** — env is injected by Docker, so `load_dotenv()` is a harmless no-op (no file present) and the
  real values come from the process environment. This is correct and intended.
- **`DATA_DIR = "data"`** (`main.py:55`), used via `os.makedirs(DATA_DIR, exist_ok=True)` +
  `open(os.path.join(DATA_DIR, ...))` — **cwd-relative**. With cwd = the app workdir, dumps land in
  `<workdir>/data`. This must be a **writable** path for the non-root user (the dumps are ephemeral
  prototype state, NOT baked data).
- Deps (`apps/api/requirements.txt`): `numpy`, `scipy`, `requests`, `fastapi`, `uvicorn`, `pydantic`,
  `python-dotenv`, **`tzdata`** (IANA tz db — required, no system tz on the base in scope), `massive`,
  **`argon2-cffi`**, **`authlib`**, **`cryptography`**. All ship wheels — **no system build toolchain
  expected** on a slim base (argon2-cffi/cryptography publish manylinux wheels). The executioner should
  install with no apt build deps first; only if a wheel is unavailable for the chosen base does a build
  stage become necessary (see §"Files" note).
- **No pinned Python version** anywhere in the repo (no `.python-version`, no `requires-python`). Decision
  in §4.1.
- Port **8000**.

**Frontend (`apps/dashboard`):**
- Build: the `@nx/vite` plugin infers a `build` target; Vite `build.outDir: './dist'` (relative to
  `apps/dashboard`) ⇒ static bundle output is **`apps/dashboard/dist`**.
- `index.html` uses `<base href="/" />` and absolute asset paths — serves cleanly from a web root at `/`.
- **`@org/api` is consumed as SOURCE.** `libs/api/package.json` `exports["."].import` →
  `./src/index.ts`, resolved via the **`@org/source` customCondition** in `tsconfig.base.json` and the npm
  **workspace** link (`package.json` `workspaces: ["apps/*","libs/*"]`). `apps/dashboard` imports
  `@org/api` directly (e.g. `AiRecPanel.tsx`). **Therefore a frontend image built in isolation from
  `apps/dashboard` alone FAILS** — the build needs `libs/api/src`, the root `tsconfig.base.json`, the root
  `package.json` + lockfile, `nx.json`, and the workspace `node_modules`. **Build context = repo root.**
- Dev proxy `/api → http://127.0.0.1:8000` lives in `vite.config.mts` `server.proxy` — **dev-only**, not
  in the static bundle. In the container the static server (nginx) must re-create the `/api` proxy.

**Repo hygiene (already present — reuse, don't fight):**
- Root `.gitignore` already excludes `dist`, `node_modules`, `.nx/cache`, `apps/api/.venv/`,
  `apps/api/.env`, `apps/api/.env.*`, `apps/api/data/`, `/data/`, `apps/api/conf/token.txt`, `out-tsc`,
  `test-output`, `coverage`. `apps/api/.gitignore` mirrors it. **The `.dockerignore` files mirror this set
  but are SEPARATE — `.gitignore` does not govern the Docker build context.**

---

## 4. Technical decisions (with rationale)

### 4.1 Backend `Dockerfile` (`apps/api/Dockerfile`)

- **Base image:** `python:3.12-slim` (Debian-slim). Rationale: repo pins no version; 3.12 is the current
  stable widely-wheeled CPython — `numpy`/`scipy`/`argon2-cffi`/`cryptography`/`pydantic` all publish 3.12
  manylinux wheels, so no compiler is needed. `-slim` (not `-alpine`): musl breaks manylinux wheels and
  forces source builds of scipy/cryptography. **Owner-overridable** via a single `ARG PYTHON_VERSION=3.12`
  at the top.
- **Working dir + build context:** build context = **`apps/api`** (the backend is self-contained; it does
  NOT import the JS workspace). `WORKDIR /app`. cwd = `/app`, so `load_dotenv()` and `DATA_DIR="data"`
  resolve exactly as in dev (relative to the app dir). Copy `requirements.txt` first (layer-cache), then
  `pip install`, then copy `main.py` + `src/` (+ `prompts/`, `market_state_glossary.md`, and any runtime
  assets `main.py`/`src` read — see §"Files" copy-list note).
- **Dependency install:** `pip install --no-cache-dir -r requirements.txt`. No apt build toolchain in the
  first pass (wheels only). Two-stage *optional* optimization (builder venv → copy site-packages) is
  allowed but NOT required; keep it single-stage + slim unless a wheel gap forces a builder.
- **Start command:** mirror `nx serve api` but **production-shaped**: `CMD ["uvicorn", "main:app",
  "--host", "0.0.0.0", "--port", "8000"]`. Differences from dev, deliberate: **`--host 0.0.0.0`** (dev
  binds `127.0.0.1`; the container must accept connections from the compose network / host) and
  **`--reload` REMOVED** (dev-only; reload watches the filesystem and is wrong for a built image). Invoke
  the `uvicorn` console script directly rather than `python main.py` so the `__main__` reload block is
  bypassed cleanly. `app` is importable as `main:app` because WORKDIR is the app root (same module layout
  as cwd=`apps/api`).
- **Non-root:** create a dedicated user (e.g. `useradd --create-home --uid 10001 appuser`); `chown` the
  workdir + the writable `data` dir; `USER appuser` before `CMD`. Ensure `DATA_DIR` (`/app/data`) is
  owned/writable by `appuser` (create it in the image as an empty dir, then chown).
- **Env at runtime:** NO `.env` copied. Document the required/optional env in the Dockerfile header
  comment, but inject at run (compose `env_file` / `-e`). Absent-secret behavior is already graceful
  (no `MASSIVE_API_KEY` ⇒ provider errors per existing behavior; no `ANTHROPIC_API_KEY` ⇒ ai-rec `no_key`;
  no Google creds ⇒ button disabled; no signing/encryption key ⇒ ephemeral per-process key). Do not change
  any of that.
- **HEALTHCHECK:** `HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD <probe>`.
  **Probe target = an existing, cheap, side-effect-free GET endpoint.** Candidate: `GET /api/_metrics`
  (read-only, always-200 when `OBSERVABILITY_ENABLED`, no vendor fetch) — but it can be disabled by env and
  is operator-scoped. **OPEN QUESTION HC-1 (executioner must resolve by grounding):** confirm the exact
  always-available unauthenticated 200 path before writing the probe. Options in priority order: (a) a
  dedicated lightweight liveness route IF one exists (grep `main.py` for `@app.get("/health"`/`"/"`);
  (b) `/api/_metrics`; (c) the docs route `/docs` (FastAPI default, 200 if not disabled). **Do NOT invent a
  new endpoint** — that is an app-code change / interface change, out of lane. If none of (a)-(c) is
  suitable, the probe falls back to a TCP-connect check on :8000 (a Python one-liner
  `python -c "import socket,sys; s=socket.create_connection(('127.0.0.1',8000),3); sys.exit(0)"`), which
  needs no curl in the image and asserts the port is listening. **Recommend (c) `/docs` or the TCP probe**
  to avoid coupling health to `OBSERVABILITY_ENABLED`. Use `curl` only if added to the image; prefer the
  Python socket probe (Python is already present, zero extra layer).
- **EXPOSE 8000** (documentation; the publish is in compose).

### 4.2 Frontend `Dockerfile` (`apps/dashboard/Dockerfile`)

- **Multi-stage, build context = repo ROOT** (mandatory — see §3 `@org/api` source-consumption). The
  Dockerfile lives at `apps/dashboard/Dockerfile` but is built with `-f apps/dashboard/Dockerfile .` from
  the repo root (compose sets `context: .` + `dockerfile: apps/dashboard/Dockerfile`).
- **Stage 1 (builder) — `node:20-alpine` (or `node:22-alpine`):** match an Nx 23 / Vite 8 supported Node.
  Steps: copy the workspace files needed to install + build — `package.json`, the lockfile
  (`package-lock.json` — confirm the lockfile filename via grounding; if pnpm/yarn lockfile is present use
  that), `nx.json`, `tsconfig.base.json`, then `apps/dashboard/` and `libs/` (and `libs/api` specifically),
  then the rest as needed. Simplest correct approach: `COPY . .` (the `.dockerignore` keeps it tight) after
  the install layer. Run `npm ci` (deterministic from lockfile) to materialize workspace symlinks
  (`node_modules/@org/api` → `libs/api`). Then build with **Nx** so the project graph + customCondition
  resolution are honored: `npx nx build @org/dashboard` (project name `@org/dashboard`, build target from
  the `@nx/vite` plugin). Output lands at **`apps/dashboard/dist`**.
  - Rationale for building through Nx (not raw `vite build`): the `@org/source` customCondition + workspace
    resolution are what make `@org/api`-as-source resolve; `nx build` runs Vite with the workspace
    context intact. Raw `vite build` from `apps/dashboard` alone would not resolve the source import.
- **Stage 2 (runtime) — `nginx:1.27-alpine`:** `COPY --from=builder /app/apps/dashboard/dist
  /usr/share/nginx/html`. Add an `nginx.conf` (see §Files) that: serves the SPA with `try_files $uri
  /index.html` (client-side routing — `react-router` BrowserRouter needs the fallback), and **proxies
  `/api` to the backend** (`proxy_pass http://api:8000;` — `api` = the compose service name), with SSE
  kept working: `proxy_buffering off;` + `proxy_read_timeout` raised on the `/api` location (SSE is a
  long-lived stream; nginx default buffering/timeout would break `EventSource`). Listen on **8080** (a
  non-privileged port so the non-root nginx can bind it — see non-root below) or 80 with the unprivileged
  image; standardize on **8080**.
- **Non-root:** use the official `nginxinc/nginx-unprivileged:1.27-alpine` image (runs as non-root,
  listens on 8080 by default) **OR** the stock nginx with an added non-root user + writable
  `/var/cache/nginx` + `pid` path. **Recommend `nginxinc/nginx-unprivileged`** — it is purpose-built for
  this and avoids hand-rolling the chown/pid dance. Final stage runs as the image's non-root user; no
  `USER root` at the end.
- **No secrets:** the static bundle has no secrets (the `ANTHROPIC_API_KEY` etc. are all server-side); the
  build args carry nothing secret. The `.dockerignore` still excludes `.env*` so a stray dev `.env` can't
  enter the build context.
- **HEALTHCHECK:** `CMD` probing `http://127.0.0.1:8080/` (the SPA index) — use the Python/curl/wget
  available in the nginx-alpine image (`wget -q -O- http://127.0.0.1:8080/ >/dev/null` — busybox `wget` is
  present in alpine). Confirm `wget` availability; else a TCP probe on 8080.
- **EXPOSE 8080.**
- **NON-GOAL note (must be a comment in the Dockerfile + restated in §6):** in production the static bundle
  commonly ships to a **CDN / object storage**, not a container. This container is the correct
  local/self-hosted artifact; the CDN path is a `deploy`-time decision, intentionally NOT designed here.

### 4.3 Root `docker-compose.yml`

- **Purpose: dev/local one-command full-stack** (`docker compose up`). Two services:
  - **`api`**: `build: { context: ./apps/api, dockerfile: Dockerfile }`; `env_file: ./apps/api/.env`
    (references the developer's **local, gitignored** `.env` at **run time** — NEVER copied into an image;
    compose injects it as process env). `ports: ["8000:8000"]` (optional for direct access/debug; the FE
    proxy reaches it over the compose network regardless). `healthcheck` mirroring the Dockerfile probe.
    No volume for `data/` by default (stateless is the documented property); optionally a named volume
    `api-data:/app/data` MAY be added with a comment that it only persists the ephemeral dumps and is NOT
    the `persistent-db` fix.
  - **`web`**: `build: { context: ., dockerfile: apps/dashboard/Dockerfile }` (context = repo root, see
    §4.2). `ports: ["8080:8080"]`. `depends_on: { api: { condition: service_healthy } }` so the proxy
    target is up. nginx `proxy_pass` uses the service DNS name `api`.
  - **`networks`**: default bridge — both services on it; nginx resolves `api` by service name. No host
    networking.
- **Env passthrough:** `env_file` points at `apps/api/.env` (the existing local secret file). Document an
  alternative: per-var passthrough (`environment: - MASSIVE_API_KEY=${MASSIVE_API_KEY}`) for CI/host where
  no `.env` file exists. **Never** an `environment:` block with literal secret values committed.
- **Dev-vs-prod (document, don't build prod):** this compose is **local/dev**. For prod the changes are:
  static bundle → CDN (or this image behind a real ingress), real secret injection (orchestrator
  secrets, not a local `.env`), a **persistent** datastore (`persistent-db` feature) replacing in-memory
  SQLite, healthcheck-gated rollout, and TLS termination at an ingress — all **out of scope here**, noted
  for the reader.

### 4.4 `.dockerignore` set (image-hygiene floor — HARD)

Two files, because the two builds have different contexts:
- **Root `/.dockerignore`** (governs the FE build, context = repo root) — MUST exclude, at minimum:
  `**/.env`, `**/.env.*`, `apps/api/.venv`, `apps/api/conf/token.txt`, `**/node_modules`, `.git`,
  `.gitignore`, `**/dist`, `.nx`, `apps/api/data`, `/data`, `**/out-tsc`, `**/test-output`, `**/coverage`,
  `**/__pycache__`, `**/*.py[cod]`, `.claude`, `**/.vscode`, `**/.idea`, `Dockerfile`, `docker-compose*.yml`,
  `*.md` (optional — keeps context tiny; do NOT exclude files the build reads). **Critically include
  `libs/` and `apps/dashboard/` source** (do not over-exclude — the FE build needs them).
- **`apps/api/.dockerignore`** (governs the backend build, context = `apps/api`) — MUST exclude: `.env`,
  `.env.*`, `.venv`, `conf/token.txt`, `data`, `__pycache__`, `*.py[cod]`, `.pytest_cache`, `.mypy_cache`,
  `.ruff_cache`, `*.key`, `*.pem`, `.vscode`, `.idea`. **Keep** `main.py`, `src/`, `requirements.txt`, and
  any runtime assets the app reads (prompts, glossary).
- Rationale: smaller context = faster, safer builds; the exclusions are the structural guarantee of
  `[no-secrets-in-image]`. `.dockerignore` is NOT inherited from `.gitignore` — it must be authored.

---

## 5. Component boundaries / isolation rules

- **Backend image is workspace-independent** — context `apps/api`, no JS/Nx. **Frontend image is
  workspace-dependent** — context = repo root because `@org/api` is source. Do not "fix" the FE by copying
  a built `@org/api` artifact (there is none; it's source-consumed) and do not vendor `libs/api` into
  `apps/dashboard` (that's an app-structure change, out of lane).
- **The `/api` proxy boundary moves but does not change:** Vite dev proxy (dev) → nginx `proxy_pass`
  (container). Same origin to the browser, same `/api/*` paths, SSE preserved. `NO_INTERFACE_CHANGE`.
- **No app code, config, or dependency edits.** New files only: 2 Dockerfiles, 1 compose, 2 `.dockerignore`,
  1 `nginx.conf` (+ optional `.env.example` doc — see Files). If anything forces an app-code edit, STOP and
  bounce (GATE Z), don't quietly edit.
- **Stateless boundary preserved/ documented** — see §6.

---

## 6. Stateless / data / restart-reset (MUST be documented to the reader)

- Containers are **stateless and restart-resettable.** In-memory SQLite (`ACCOUNT_STORE=memory`,
  `:memory:`) loses **all accounts, sessions, and stored AI keys** on container restart and shares nothing
  across replicas. The per-ticker `data/*.json` dumps are ephemeral prototype output, regenerated on
  demand; losing them is harmless.
- If `AUTH_SESSION_SIGNING_KEY` / `AI_KEY_ENCRYPTION_KEY` are left unset, the app falls back to an
  **ephemeral per-process key** — combined with the in-memory store this means cookies + stored keys are
  invalidated on every restart. Set **stable** values via runtime env if you need them to survive a restart
  (still NOT in the image).
- **The required successor feature is `persistent-db`** — swap the in-memory SQLite adapter for a
  persistent store (the seam already exists per PROJECT_CONTEXT §2/§5). Until then, treat every container
  as fresh state. This contract documents the limitation; it does not solve it (explicit non-goal §2).
- The dashboard container is a self-hosting artifact; **prod often serves the static bundle from a CDN**
  instead (designed-but-noted; not built here).

---

## 7. Files to create + their responsibility (BUILD SPEC — implement directly)

> Paths absolute. New files only; no edits to existing files.

1. **`C:\Dev\gammaflow-web\apps\api\Dockerfile`** — backend image. `ARG PYTHON_VERSION=3.12`; `FROM
   python:${PYTHON_VERSION}-slim`; `WORKDIR /app`; copy `requirements.txt` → `pip install --no-cache-dir`;
   copy `main.py`, `src/`, and the runtime read assets (`prompts/`, `market_state_glossary.md`, and any
   other files `main.py`/`src/` open at runtime — grep before finalizing the copy list); create
   `/app/data` writable; create non-root `appuser` (uid 10001), `chown`; `USER appuser`;
   `EXPOSE 8000`; `HEALTHCHECK` (resolve HC-1, §4.1); `CMD ["uvicorn","main:app","--host","0.0.0.0",
   "--port","8000"]`. Header comment listing the runtime env vars (no values).
2. **`C:\Dev\gammaflow-web\apps\api\.dockerignore`** — backend hygiene (§4.4 list).
3. **`C:\Dev\gammaflow-web\apps\dashboard\Dockerfile`** — multi-stage FE image. Stage 1 `node:20-alpine`
   builder: `WORKDIR /app`; copy workspace install inputs + `COPY . .` (context = repo root); `npm ci`;
   `npx nx build @org/dashboard`; output `apps/dashboard/dist`. Stage 2
   `nginxinc/nginx-unprivileged:1.27-alpine`: `COPY --from=builder /app/apps/dashboard/dist
   /usr/share/nginx/html`; `COPY apps/dashboard/nginx.conf /etc/nginx/conf.d/default.conf`; `EXPOSE 8080`;
   `HEALTHCHECK` (§4.2); runs non-root by default (don't switch to root at the end).
4. **`C:\Dev\gammaflow-web\apps\dashboard\nginx.conf`** — SPA + API proxy. `listen 8080;`; root
   `/usr/share/nginx/html`; `location / { try_files $uri /index.html; }`; `location /api { proxy_pass
   http://api:8000; proxy_buffering off; proxy_read_timeout 1h; proxy_set_header Host $host; }` (SSE-safe).
5. **`C:\Dev\gammaflow-web\.dockerignore`** (repo root) — FE build hygiene (§4.4 list); MUST keep
   `libs/`, `apps/dashboard/`, root `package.json`/lockfile/`nx.json`/`tsconfig.base.json`.
6. **`C:\Dev\gammaflow-web\docker-compose.yml`** — `api` + `web` services (§4.3). `api`: `build` context
   `./apps/api`, `env_file: ./apps/api/.env`, port 8000, healthcheck. `web`: `build` context `.` +
   `dockerfile: apps/dashboard/Dockerfile`, port 8080, `depends_on api: service_healthy`. Shared default
   network. Comments marking it dev/local + the prod-delta + the stateless note.
7. *(Optional, recommended)* **`C:\Dev\gammaflow-web\apps\api\.env.example`** — a **value-less** template
   listing every env var name (from PROJECT_CONTEXT §7) with comments, committed as documentation so a
   fresh clone knows what to inject. Contains **no real values**. (If this risks being mistaken for a real
   `.env`, skip it and document in a comment block instead.)

**Grounding the executioner MUST do before finalizing (cannot be guessed):**
- The exact **lockfile filename** (`package-lock.json` vs `pnpm-lock.yaml` vs `yarn.lock`) → drives
  `npm ci` vs `pnpm i --frozen-lockfile`. (Repo shows npm `workspaces` in `package.json` → likely
  `package-lock.json`; confirm.)
- The **runtime-read asset list** for the backend (grep `main.py` + `src/` for `open(`, file reads,
  `prompts/`, `.md` loads) → the exact `COPY` lines.
- **HC-1**: the health-probe endpoint (§4.1) — confirm an always-200 unauthenticated path; do NOT add one.
- The **Nx build target name** for `@org/dashboard` (`npx nx show project @org/dashboard --json` → the
  `build` target) and that it emits to `apps/dashboard/dist`.

---

## 8. Review checklist (stands in for a build — Docker absent)

The executioner CANNOT `docker build` here. These static checks are the acceptance gate; each must pass by
inspection.

**Secrets / hygiene (HARD — any miss = FAIL):**
- [ ] Root `.dockerignore` excludes `**/.env`, `**/.env.*`, `apps/api/.venv`, `apps/api/conf/token.txt`,
      `**/node_modules`, `.git`, `**/dist`, `.nx`, `apps/api/data`, `/data`, `**/test-output`,
      `**/coverage`, `**/__pycache__`.
- [ ] `apps/api/.dockerignore` excludes `.env`, `.env.*`, `.venv`, `conf/token.txt`, `data`, `__pycache__`,
      `*.key`, `*.pem`.
- [ ] Neither Dockerfile has a `COPY` that can pull a `.env`/`.venv`/`token.txt`/key into a layer (no
      `COPY apps/api/.env`, and `COPY . .` is paired with a `.dockerignore` that excludes them).
- [ ] No secret literal appears in any Dockerfile, compose file, or `nginx.conf`. Compose injects via
      `env_file`/`${VAR}` only.

**Non-root (HARD):**
- [ ] Backend final stage: explicit non-root `USER` before `CMD`; `data` dir writable by that user.
- [ ] FE final stage: non-root (unprivileged nginx image or explicit non-root user); listens on a
      non-privileged port (8080).

**Correctness:**
- [ ] Backend `CMD` is `uvicorn main:app --host 0.0.0.0 --port 8000` (0.0.0.0, **no** `--reload`).
- [ ] Backend WORKDIR is the app root so `load_dotenv()`/`DATA_DIR="data"` resolve relative to it.
- [ ] FE build context = repo root; `libs/` present in context; built via `nx build @org/dashboard`;
      copies `apps/dashboard/dist`.
- [ ] `nginx.conf`: SPA fallback `try_files $uri /index.html`; `/api` → `proxy_pass http://api:8000` with
      `proxy_buffering off` (SSE-safe).
- [ ] Both Dockerfiles have a `HEALTHCHECK`; probes hit a real always-available path/port.
- [ ] `EXPOSE` 8000 (api) / 8080 (web); compose maps ports + `depends_on: service_healthy`; compose
      `web` context = `.` with the `apps/dashboard/Dockerfile`.
- [ ] No existing app file is modified (git: only new files added).
- [ ] Stateless/restart-reset + `persistent-db`-is-next is documented in the compose comments and/or a note.

## 9. Owner runtime build-verify (deferred — after Docker Desktop install)

The OWNER runs these once Docker Desktop (Windows) is installed; they are the deferred runtime gate
(precedent: ticker-load's latency magnitude needed a live key — artifact correctness does not depend on
building here):
1. `docker build -f apps/api/Dockerfile -t convexa-api apps/api` → builds; inspect `docker history` shows
   no `.env` layer.
2. `docker build -f apps/dashboard/Dockerfile -t convexa-web .` (context = repo root) → builds; `@org/api`
   resolves, bundle produced.
3. `docker compose up` → `api` becomes healthy, `web` starts after; open `http://localhost:8080` → SPA
   loads, `/api/*` proxied (bundle + SSE live-update), routes deep-link (SPA fallback works).
4. `docker compose exec api whoami` / `web` → non-root user (not `root`).
5. Restart a container → confirm the documented stateless reset (sessions/accounts gone) — expected, the
   `persistent-db` signal.

---

## 10. Open questions for follow-on (not blocking this build)

- **HC-1** (above) — health endpoint choice; resolve by grounding, do not add an endpoint.
- Lockfile + package-manager confirmation for `npm ci`.
- Whether to ship `.env.example` (doc value vs confusion risk).
- (Deferred features, not this contract): host/registry/`deploy`, CI, `persistent-db`, CDN for the static
  bundle, secrets manager.
