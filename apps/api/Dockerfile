# syntax=docker/dockerfile:1
# ============================================================================
# Convexa api — production image (Axum / Tokio).
#
# Build from REPO ROOT (workspace Cargo.toml + libs/quant-engine):
#   docker build -f apps/api/Dockerfile -t convexa-api .
#
# Railway:
#   Root Directory = (empty / repo root)
#   Dockerfile path = apps/api/Dockerfile
#
# NO SECRETS ARE BAKED IN. Inject at runtime (Railway Variables).
#
# Required in production: APP_ENV=prod, MASSIVE_API_KEY, DATABASE_URL,
# ALLOWED_BROWSER_ORIGINS, METRICS_SECRET_TOKEN, addressed session/encryption key maps,
# SESSION_CHAIN_ARCHIVE_BODY_ROOT. Legacy key names may remain during rotation overlap.
# Multi-instance: DATABASE_URL=${{Postgres.DATABASE_URL}}  (this image enables postgres)
# Optional: REDIS_URL, GOOGLE_*, ANTHROPIC_API_KEY, POSITIONS_PROVIDER=stub, …
# ============================================================================

# ---- build ----
# Cargo.lock pulls crates that need rustc ≥1.88 (e.g. home@0.5, icu_*@2.2).
FROM rust:1-bookworm AS builder
WORKDIR /src

COPY Cargo.toml Cargo.lock ./
COPY libs/quant-engine/Cargo.toml libs/quant-engine/Cargo.toml
COPY apps/api/Cargo.toml apps/api/Cargo.toml

# Dummy sources so the dependency graph resolves and cargo can cache crates.io.
RUN mkdir -p libs/quant-engine/src libs/quant-engine/benches apps/api/src \
    && printf 'pub fn _x(){}\n' > libs/quant-engine/src/lib.rs \
    && printf 'fn main(){}\n' > libs/quant-engine/benches/gex_bench.rs \
    && printf 'fn main(){}\n' > apps/api/src/main.rs \
    && printf 'pub fn _x(){}\n' > apps/api/src/lib.rs

RUN cargo build -p api-rust --release --features postgres \
    && rm -rf apps/api/src libs/quant-engine/src \
    && rm -f target/release/api-rust target/release/deps/api_rust* \
           target/release/deps/libapi_rust* target/release/deps/quant_engine* \
           target/release/deps/libquant_engine* \
    && rm -rf target/release/.fingerprint/api-rust-* \
              target/release/.fingerprint/quant-engine-* \
              target/release/.fingerprint/libapi_rust* \
              target/release/.fingerprint/libquant_engine*

COPY libs/quant-engine/src libs/quant-engine/src
COPY libs/quant-engine/Cargo.toml libs/quant-engine/Cargo.toml
COPY apps/api/src apps/api/src
COPY apps/api/static apps/api/static
COPY apps/api/Cargo.toml apps/api/Cargo.toml
RUN touch libs/quant-engine/src/lib.rs apps/api/src/lib.rs apps/api/src/main.rs \
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
COPY apps/api/config/universe.json /app/universe.json

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
CMD ["sh", "-c", "export HTTP_BIND=0.0.0.0:${PORT:-8000}; exec /app/api-rust serve"]
