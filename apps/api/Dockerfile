# syntax=docker/dockerfile:1
# ============================================================================
# Convexa backend (FastAPI / uvicorn) — production-shaped image.
#
# Build context  : apps/api  (the backend is workspace-independent — it does NOT
#                   import the JS/Nx workspace).
#   docker build -f apps/api/Dockerfile -t convexa-api apps/api
#
# NO SECRETS ARE BAKED IN. All config + secrets are injected at RUNTIME via the
# process environment (12-factor); a stray local .env / .venv / conf/token.txt is
# kept out of the build context by apps/api/.dockerignore. load_dotenv() is a bare
# read of ./.env relative to cwd — in the container no .env is present, so it is a
# harmless no-op and the real values come from the injected environment.
#
# Runtime env vars (NAMES ONLY — see apps/api/.env.example; never set values here):
#   MASSIVE_API_KEY, DATA_FEED, DATA_PROVIDER
#   CACHE_TTL_SECONDS, STALE_AFTER_SECONDS, GATE_SCORE, FLOW_WINDOW_SECONDS,
#   LIVE_THROTTLE_SECONDS, CHAIN_REFRESH_SECONDS, CHAIN_PREWARM_MAX_AGE_SECONDS,
#   INCLUDE_DARK_POOL, DARKPOOL_LOOKBACK_SECONDS, BLOCK_MIN_SHARES,
#   VOL_OI_UNUSUAL_THRESHOLD, TIER_WATCH_SCORE, TIER_ACTIONABLE_SCORE,
#   TIER_PRIME_SCORE, OBSERVABILITY_ENABLED, METRICS_WINDOW_SIZE,
#   METRICS_RECENT_TRACES
#   ANTHROPIC_API_KEY, AI_REC_MODEL, AI_REC_COOLDOWN_SECONDS, AI_REC_DAILY_CAP,
#   AI_REC_TIMEOUT_SECONDS, AI_REC_IN_APP_ENABLED, AI_REC_STUB
#   ACCOUNT_STORE, AUTH_SESSION_SIGNING_KEY,
#   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
#   AI_KEY_ENCRYPTION_KEY, AI_REC_ADMIN_EMAILS, AI_REC_ADMIN_FREE_DAILY
#
# STATELESS / restart-resettable: the auth/session/AI-key stores are in-memory
# SQLite (reset on restart) and DATA_DIR=./data is ephemeral. The persistent
# store is the NEXT feature (`persistent-db`) — documented in docker-compose.yml,
# not solved here.
# ============================================================================

# Owner-overridable; 3.12 ships manylinux wheels for numpy/scipy/argon2-cffi/
# cryptography/pydantic, so no compiler/apt build toolchain is needed on -slim.
ARG PYTHON_VERSION=3.12
FROM python:${PYTHON_VERSION}-slim

# uvicorn binds 0.0.0.0 inside the container; flush stdout for live logs.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# 1) Dependencies first (layer-cache: only re-runs when requirements.txt changes).
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 2) Application code + the assets the app reads at RUNTIME:
#    - main.py                      : the FastAPI app (main:app)
#    - src/                         : engine/signals/live/providers/auth/...
#    - prompts/                     : personas.py opens prompts/strategy_prompt.md
#                                     + prompts/reassessment_prompt.md (cwd=/app)
#    - market_state_glossary.md     : ai_recommendation.py reads it at the app root
#                                     (_REPO_ROOT = the app dir)
#    Explicit COPYs (no `COPY . .`) so no .env/.venv/conf/data ever enters a layer
#    even independently of .dockerignore.
COPY main.py ./
COPY src ./src
COPY prompts ./prompts
COPY market_state_glossary.md ./

# 3) Non-root runtime. DATA_DIR="data" is cwd-relative (./data == /app/data) and
#    must be writable by the non-root user (the ephemeral per-ticker dumps).
RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /app/data \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Liveness probe (HC-1 resolved): a Python socket connect to the runtime port. This
# needs no curl/wget layer (Python is already present), is unauthenticated,
# side-effect-free, and asserts uvicorn is accepting connections without coupling
# health to any app endpoint or to OBSERVABILITY_ENABLED. No new endpoint is added.
# The probe reads ${PORT:-8000} so it tracks the SAME port the CMD binds (Railway may
# inject a different $PORT); locally / in compose $PORT is unset ⇒ 8000 (unchanged).
# Shell form so ${PORT:-8000} expands (exec form does no shell substitution).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import os,socket,sys; s=socket.create_connection(('127.0.0.1',int(os.environ.get('PORT','8000'))),3); s.close(); sys.exit(0)"

# Production-shaped start: --host 0.0.0.0 (accept connections from the compose
# network / host) and NO --reload (dev-only). Invoke the uvicorn console script
# directly so the main.py __main__ reload block is bypassed; main:app resolves
# because WORKDIR is the app root (same module layout as cwd=apps/api in dev).
# Shell-form CMD so ${PORT:-8000} expands at runtime: Railway injects $PORT and routes
# its public edge to it; locally / in compose $PORT is unset ⇒ binds 8000 (so compose +
# nginx proxy_pass http://api:8000 + the TCP healthcheck stay valid). [R1, $PORT bind]
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
