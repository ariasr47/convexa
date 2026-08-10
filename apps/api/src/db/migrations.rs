//! Numbered Postgres migrations (idempotent baseline + forward-only versions).
//!
//! Applied once at boot and recorded in `schema_migrations`. Each migration body
//! may contain multiple statements — they are split and executed one-by-one
//! (sqlx extended protocol = one statement per call).

use crate::error::{AppError, AppResult};
use sqlx::PgPool;
use tracing::info;

/// (version, name, sql body). Versions must be unique and strictly increasing.
const MIGRATIONS: &[(i64, &str, &str)] = &[
    (
        1,
        "baseline_core",
        r#"
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
"#,
    ),
    (
        2,
        "scan_store",
        r#"
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
"#,
    ),
    (
        3,
        "scan_structure_history",
        r#"
CREATE TABLE IF NOT EXISTS scan_structure_history (
    symbol           TEXT NOT NULL,
    as_of            DOUBLE PRECISION NOT NULL,
    price            DOUBLE PRECISION,
    score            DOUBLE PRECISION,
    tier             TEXT,
    regime           TEXT,
    vol_regime       TEXT,
    flip             DOUBLE PRECISION,
    dist_to_flip_pct DOUBLE PRECISION,
    call_wall        DOUBLE PRECISION,
    put_wall         DOUBLE PRECISION,
    dist_to_wall_pct DOUBLE PRECISION,
    PRIMARY KEY (symbol, as_of)
);
CREATE INDEX IF NOT EXISTS scan_structure_history_symbol_as_of_idx
    ON scan_structure_history (symbol, as_of DESC);
"#,
    ),
    (
        4,
        "ai_rec_metering",
        r#"
-- Shared AI-rec daily counters (multi-replica). Keyed by ET calendar day + identity
-- ('shared' for process/shared-admin path, or user id for own-key metering).
CREATE TABLE IF NOT EXISTS ai_rec_daily (
    day_et     TEXT NOT NULL,
    identity   TEXT NOT NULL,
    count      INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (day_et, identity)
);
"#,
    ),
    (
        5,
        "user_book_blob",
        r#"
-- Server-side durable book (positions/orders v3 JSON blob per user).
-- FE still keeps a local cache; signed-in clients sync via GET/PUT /api/book.
CREATE TABLE IF NOT EXISTS user_book (
    user_id        TEXT PRIMARY KEY,
    schema_version INT NOT NULL DEFAULT 3,
    blob_json      TEXT NOT NULL,
    updated_at     DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS user_book_updated_at_idx ON user_book (updated_at DESC);
"#,
    ),
    (
        6,
        "structure_capture_spine",
        r#"
-- P0 research capture: extend live structure samples with score drivers + vol/GEX
-- features, and durable forward-outcome rows (not pruned with the sample ring).
ALTER TABLE scan_structure_history ADD COLUMN IF NOT EXISTS score_drivers TEXT;
ALTER TABLE scan_structure_history ADD COLUMN IF NOT EXISTS net_gex DOUBLE PRECISION;
ALTER TABLE scan_structure_history ADD COLUMN IF NOT EXISTS iv_hv_ratio DOUBLE PRECISION;
ALTER TABLE scan_structure_history ADD COLUMN IF NOT EXISTS atm_iv DOUBLE PRECISION;
ALTER TABLE scan_structure_history ADD COLUMN IF NOT EXISTS hv_30d DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS structure_outcomes (
    symbol         TEXT NOT NULL,
    as_of          DOUBLE PRECISION NOT NULL,
    horizon        TEXT NOT NULL,
    ret_simple     DOUBLE PRECISION,
    ret_log        DOUBLE PRECISION,
    abs_move       DOUBLE PRECISION,
    hit_call_wall  BOOLEAN,
    hit_put_wall   BOOLEAN,
    crossed_flip   BOOLEAN,
    label_version  TEXT NOT NULL,
    bars_source    TEXT NOT NULL,
    joined_at      DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (symbol, as_of, horizon)
);
CREATE INDEX IF NOT EXISTS structure_outcomes_symbol_as_of_idx
    ON structure_outcomes (symbol, as_of DESC);
"#,
    ),
];

/// Apply all pending migrations. Safe to call on every boot.
pub async fn apply(pool: &PgPool) -> AppResult<()> {
    sqlx::query(
        r#"CREATE TABLE IF NOT EXISTS schema_migrations (
             version     BIGINT PRIMARY KEY,
             name        TEXT NOT NULL,
             applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
           )"#,
    )
    .execute(pool)
    .await
    .map_err(|e| AppError::Config(format!("schema_migrations table: {e}")))?;

    let applied: Vec<i64> = sqlx::query_scalar("SELECT version FROM schema_migrations ORDER BY version")
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Config(format!("schema_migrations read: {e}")))?;
    let applied: std::collections::HashSet<i64> = applied.into_iter().collect();

    // Pre-versioned DBs already have core tables from the old bootstrap string.
    // If `users` exists and version 1 is missing, stamp 1–3 as applied only when
    // the corresponding objects already exist — still re-run idempotent DDL so
    // missing pieces (e.g. structure history) land.
    let legacy = table_exists(pool, "users").await?;

    for &(version, name, body) in MIGRATIONS {
        if applied.contains(&version) {
            continue;
        }
        info!(version, name, "postgres migration applying");
        for (i, stmt) in split_sql_statements(body).into_iter().enumerate() {
            sqlx::query(&stmt).execute(pool).await.map_err(|e| {
                let preview: String = stmt.chars().take(96).collect();
                AppError::Config(format!(
                    "migration v{version}/{name} stmt#{i}: {e} | {preview}"
                ))
            })?;
        }
        // Always record — even on legacy DBs after re-applying idempotent DDL.
        let _ = legacy; // reserved for future skip heuristics
        sqlx::query(
            r#"INSERT INTO schema_migrations (version, name) VALUES ($1, $2)
               ON CONFLICT (version) DO NOTHING"#,
        )
        .bind(version)
        .bind(name)
        .execute(pool)
        .await
        .map_err(|e| AppError::Config(format!("schema_migrations insert v{version}: {e}")))?;
        info!(version, name, "postgres migration applied");
    }
    Ok(())
}

async fn table_exists(pool: &PgPool, name: &str) -> AppResult<bool> {
    let exists: bool = sqlx::query_scalar(
        r#"SELECT EXISTS (
             SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = $1
           )"#,
    )
    .bind(name)
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Config(format!("table_exists({name}): {e}")))?;
    Ok(exists)
}

/// Split a SQL script into individual statements on `;`.
pub fn split_sql_statements(script: &str) -> Vec<String> {
    script
        .split(';')
        .filter_map(|chunk| {
            let trimmed = chunk.trim();
            if trimmed.is_empty() {
                return None;
            }
            let has_sql = trimmed.lines().any(|line| {
                let l = line.trim();
                !l.is_empty() && !l.starts_with("--")
            });
            if !has_sql {
                return None;
            }
            Some(trimmed.to_string())
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_are_ordered_and_unique() {
        let mut prev = 0i64;
        let mut seen = std::collections::HashSet::new();
        for &(v, name, body) in MIGRATIONS {
            assert!(v > prev, "versions must increase ({name})");
            assert!(seen.insert(v), "duplicate version {v}");
            assert!(!name.is_empty());
            assert!(!split_sql_statements(body).is_empty(), "{name} empty");
            prev = v;
        }
    }

    #[test]
    fn structure_history_migration_present() {
        assert!(MIGRATIONS
            .iter()
            .any(|(_, n, b)| *n == "scan_structure_history"
                && b.contains("scan_structure_history")));
    }

    #[test]
    fn capture_spine_migration_present() {
        assert!(MIGRATIONS.iter().any(|(_, n, b)| *n == "structure_capture_spine"
            && b.contains("structure_outcomes")
            && b.contains("score_drivers")
            && b.contains("net_gex")));
    }
}
