//! Postgres pool + idempotent schema bootstrap (sqlx, rustls).

use crate::error::{AppError, AppResult};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use tracing::{info, warn};

/// Process-wide connection pool.
#[derive(Clone)]
pub struct Pg {
    pub pool: PgPool,
}

impl Pg {
    /// Connect + bootstrap schema. Does not crash the process on a dead DB at boot
    /// if `lazy` — but we prefer fail-fast on Railway so misconfig is obvious.
    pub async fn connect(database_url: &str) -> AppResult<Self> {
        let max = std::env::var("DATABASE_POOL_MAX")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(10_u32)
            .max(1);

        let pool = PgPoolOptions::new()
            .max_connections(max)
            .acquire_timeout(std::time::Duration::from_secs(15))
            .connect(database_url)
            .await
            .map_err(|e| AppError::Config(format!("postgres connect: {e}")))?;

        let pg = Self { pool };
        if let Err(e) = pg.migrate().await {
            warn!(error = %e, "postgres schema migrate failed (will retry on use)");
            // Still return pool — first op may succeed after DB comes up.
        } else {
            info!(max_connections = max, "postgres pool ready + schema ok");
        }
        Ok(pg)
    }

    pub async fn migrate(&self) -> AppResult<()> {
        sqlx::query(SCHEMA)
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::Config(format!("postgres migrate: {e}")))?;
        Ok(())
    }
}

/// Idempotent multi-statement schema (Python-compatible table names).
const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL,
    email_lower   TEXT NOT NULL UNIQUE,
    display_name  TEXT,
    password_hash TEXT,
    google_sub    TEXT UNIQUE,
    created_at    DOUBLE PRECISION NOT NULL,
    last_login_at DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS sessions (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at          DOUBLE PRECISION NOT NULL,
    expires_at          DOUBLE PRECISION NOT NULL,
    absolute_expires_at DOUBLE PRECISION NOT NULL,
    revoked             BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS user_settings (
    user_id           TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    active_persona_id TEXT,
    default_ticker    TEXT,
    theme             TEXT NOT NULL DEFAULT 'dark',
    scan_view         TEXT
);

CREATE TABLE IF NOT EXISTS credentials (
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL,
    ciphertext  TEXT NOT NULL,
    last4       TEXT NOT NULL,
    provider    TEXT NOT NULL DEFAULT 'anthropic',
    created_at  DOUBLE PRECISION NOT NULL,
    updated_at  DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (user_id, kind)
);

CREATE TABLE IF NOT EXISTS iv_samples (
    ticker       TEXT NOT NULL,
    session_date TEXT NOT NULL,
    iv_value     DOUBLE PRECISION NOT NULL,
    iv_basis     TEXT NOT NULL,
    basis_dte    DOUBLE PRECISION NOT NULL,
    captured_at  DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (ticker, session_date)
);
CREATE INDEX IF NOT EXISTS iv_samples_ticker_date_idx
    ON iv_samples (ticker, session_date DESC);

CREATE TABLE IF NOT EXISTS scan_rows (
    symbol           TEXT PRIMARY KEY,
    price            DOUBLE PRECISION,
    chg_pct          DOUBLE PRECISION,
    score            DOUBLE PRECISION,
    tier             TEXT,
    regime           TEXT,
    vol_regime       TEXT,
    flip             DOUBLE PRECISION,
    dist_to_flip_pct DOUBLE PRECISION,
    call_wall        DOUBLE PRECISION,
    put_wall         DOUBLE PRECISION,
    dist_to_wall_pct DOUBLE PRECISION,
    as_of            DOUBLE PRECISION NOT NULL,
    status           TEXT NOT NULL,
    score_drivers    TEXT
);

-- Additive column for pre-existing DBs that created scan_rows without score_drivers.
ALTER TABLE scan_rows ADD COLUMN IF NOT EXISTS score_drivers TEXT;

CREATE TABLE IF NOT EXISTS scan_heartbeat (
    id                    INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    updated_at            DOUBLE PRECISION NOT NULL,
    sweep_last_completed  DOUBLE PRECISION,
    universe_size         INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS scan_bundles (
    symbol       TEXT PRIMARY KEY,
    as_of        DOUBLE PRECISION NOT NULL,
    bundle_json  TEXT NOT NULL
);
"#;
