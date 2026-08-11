# containerize-apps — brief

Goal:            Author production-ready **Docker artifacts** so each app is a portable container (the
                 anti-lock-in step + the prerequisite for deploy). Deliverables: a **`Dockerfile` for the
                 FastAPI backend** (`apps/api` — runs uvicorn, slim base, **non-root**, config/secrets read
                 from the ENVIRONMENT at runtime, NOT baked in); a **`Dockerfile` for the dashboard**
                 (`apps/dashboard` — multi-stage: Nx/Vite build → serve the static bundle, e.g. via nginx),
                 a root **`docker-compose.yml`** for one-command local full-stack (backend + frontend +
                 networking/proxy), and **`.dockerignore`** files. Monorepo-aware build contexts (the
                 dashboard consumes `@org/api` from `libs/api` as SOURCE, so its build context must include
                 `libs/` + the Nx workspace).

Decision impact: **N/A** (deploy-readiness / infra class — trading-decision cull N/A; judge on portability +
                 image hygiene, not trading edge). Makes the host a swappable decision; the prerequisite for
                 the `deploy` feature.

Feasibility:    pass to **AUTHOR**. **Docker is NOT installed in this environment** → the artifacts are
                 written correct-by-construction + reviewed for best-practice; **actually building/running
                 (`docker build` / `docker compose up`) requires Docker Desktop (Windows, owner-installed)**
                 and is the **deferred runtime verification** (precedent: ticker-load's latency magnitude
                 needed a live key; the artifacts' correctness does not depend on building here). No
                 app-code change — new files only.

Effort:          M

Invariant watch: **Additive / no behavior change** — containerization is PACKAGING only; the engine /
                 bundle / scoring / `state_fingerprint` are untouched (`additive-keeps-score-byte-identical`
                 holds trivially — no app code changes).
                 **Image-hygiene security floor (HARD, feature-binding):** **no secrets baked into any
                 image** — the `.dockerignore` MUST exclude `.env` / `.env.*` / `apps/api/.venv` /
                 `apps/api/conf/token.txt` / `node_modules` / `.git` / `dist` / `.nx` / `data/`; config +
                 secrets (`MASSIVE_API_KEY`, `ANTHROPIC_API_KEY`, `AI_KEY_ENCRYPTION_KEY`,
                 `AUTH_SESSION_SIGNING_KEY`, `AI_REC_ADMIN_EMAILS`, …) are injected at **runtime via env**
                 (12-factor), never copied into the layer. Run as a **non-root** user.
                 **Known follow-on (NOT fixed here):** containers are **stateless + restart-resettable**, but
                 the auth/session/AI-key stores are still **in-memory** — they reset on every container
                 restart and aren't shared across replicas. The persistent-DB swap is the NEXT feature
                 (`persistent-db`); this feature must DOCUMENT that, not solve it.

Context tags:    architecture,backend,frontend,conventions,api

Entry point:     architect-first — **GATE-M-style infra fast-path** (architect → one infra build pass; skip
                 PM/UX — no product/UX surface, no interface change → `NO_INTERFACE_CHANGE`). The
                 ARCHITECTURE_CONTRACT doubles as the build spec. Pivotal calls: base images + multi-stage
                 strategy (slim Python for the API; node-build → static-serve for the FE); the **monorepo
                 build context** (the FE Dockerfile must build through Nx with `libs/api` available — likely
                 build context = repo root with a targeted `.dockerignore`); the **runtime config/secrets**
                 model (env injection, nothing baked); dev-vs-prod `docker-compose`; the `.dockerignore`
                 set; non-root user; healthcheck; and explicit non-goals (no host/registry/deploy, no DB
                 swap, no CI workflow — those are later features).

Source:          Owner 2026-06-29 — "continue the infrastructure work: find a host + deploy backend &
                 frontend; containerize with Docker." Containerize is **step 1** (the standing BACKLOG §B
                 candidate); the host pick + `deploy` + the `persistent-db` swap are the sequenced
                 follow-ons. Owner is learning the system-design topics alongside.
