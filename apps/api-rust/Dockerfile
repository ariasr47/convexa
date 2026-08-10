# syntax=docker/dockerfile:1
# ============================================================================
# Convexa api-rust — production image (Axum / Tokio).
#
# Build from REPO ROOT (workspace Cargo.toml + libs/quant-engine):
#   docker build -f apps/api-rust/Dockerfile -t convexa-api-rust .
#
# Railway:
#   Root Directory = (empty / repo root)
#   Dockerfile path = apps/api-rust/Dockerfile
#   The full monorepo must be on the branch Railway builds (commit + push).
#
# NO SECRETS ARE BAKED IN. Inject at runtime (Railway Variables).
#
# Required: MASSIVE_API_KEY, AUTH_SESSION_SIGNING_KEY, AI_KEY_ENCRYPTION_KEY
# Multi-instance: DATABASE_URL=${{Postgres.DATABASE_URL}}  (this image enables postgres)
# Optional: REDIS_URL, GOOGLE_*, ANTHROPIC_API_KEY, POSITIONS_PROVIDER=stub, …
# ============================================================================

# ---- build ----
FROM rust:1.85-bookworm AS builder
WORKDIR /src

# Fail fast if the monorepo workspace is missing from build context
# (usually: files never committed/pushed, or Railway Root Directory not empty).
COPY Cargo.toml Cargo.lock ./
COPY libs/quant-engine/Cargo.toml libs/quant-engine/Cargo.toml
COPY apps/api-rust/Cargo.toml apps/api-rust/Cargo.toml

# Dummy sources so the dependency graph resolves and cargo can cache crates.io
RUN mkdir -p libs/quant-engine/src apps/api-rust/src \
    && printf 'pub fn _x(){}\n' > libs/quant-engine/src/lib.rs \
    && printf 'fn main(){}\n' > apps/api-rust/src/main.rs \
    && printf 'pub fn _x(){}\n' > apps/api-rust/src/lib.rs

# Fetch + compile deps only (dummy package bodies). Real sources overwrite next.
RUN cargo build -p api-rust --release --features postgres \
    && rm -rf apps/api-rust/src libs/quant-engine/src \
    && rm -f target/release/api-rust target/release/deps/api_rust* \
           target/release/deps/libapi_rust* target/release/deps/quant_engine* \
           target/release/deps/libquant_engine* \
    && rm -rf target/release/.fingerprint/api-rust-* \
              target/release/.fingerprint/quant-engine-* \
              target/release/.fingerprint/libapi_rust* \
              target/release/.fingerprint/libquant_engine*

# Real sources
COPY libs/quant-engine/src libs/quant-engine/src
COPY libs/quant-engine/Cargo.toml libs/quant-engine/Cargo.toml
COPY apps/api-rust/src apps/api-rust/src
COPY apps/api-rust/Cargo.toml apps/api-rust/Cargo.toml
# Force rebuild of our crates (not deps)
RUN touch libs/quant-engine/src/lib.rs apps/api-rust/src/lib.rs apps/api-rust/src/main.rs \
    && cargo build -p api-rust --release --features postgres \
    && test -x target/release/api-rust \
    && strip target/release/api-rust

# ---- runtime ----
FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 appuser \
    && mkdir -p /app/data \
    && chown -R appuser:appuser /app

WORKDIR /app
COPY --from=builder /src/target/release/api-rust /app/api-rust
# Universe JSON for scanner (same as Python path layout under workspace)
COPY apps/api/src/scanner/config/universe.json /app/universe.json

ENV RUST_LOG=info,api_rust=info \
    HTTP_BIND=0.0.0.0:8000 \
    SCAN_UNIVERSE_PATH=/app/universe.json \
    AUTH_STORE_PATH=/app/data/auth.json \
    IV_STORE_PATH=/app/data/iv_timeseries.json \
    SCAN_STORE_PATH=/app/data/scan.json \
    AUTH_COOKIE_SECURE=true \
    POSITIONS_PROVIDER=stub

USER appuser
EXPOSE 8000
# Railway injects PORT — honor it when set
CMD ["sh", "-c", "export HTTP_BIND=0.0.0.0:${PORT:-8000}; exec /app/api-rust serve"]
