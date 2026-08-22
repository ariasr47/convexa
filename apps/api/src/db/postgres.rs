//! Postgres pool + numbered schema migrations (sqlx, rustls).

use crate::db::migrations;
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
    /// Strict production connection: migrations and schema failures are fatal to the caller.
    #[cfg(feature = "postgres")]
    pub async fn connect_strict(database_url: &str) -> AppResult<Self> {
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
        let known: std::collections::HashSet<i64> = migrations::compiled_migrations()
            .iter()
            .map(|(v, _, _)| *v)
            .collect();
        let versions: Vec<i64> = sqlx::query_scalar("SELECT version FROM schema_migrations")
            .fetch_all(&pg.pool)
            .await
            .unwrap_or_default();
        if versions.iter().any(|v| !known.contains(v)) {
            return Err(AppError::Config(
                "postgres schema contains a future migration".into(),
            ));
        }
        pg.migrate().await?;
        let expected: std::collections::HashSet<i64> = known;
        let recorded: std::collections::HashSet<i64> =
            sqlx::query_scalar("SELECT version FROM schema_migrations")
                .fetch_all(&pg.pool)
                .await
                .map_err(|e| AppError::Config(format!("schema versions: {e}")))?
                .into_iter()
                .collect();
        if !expected.is_subset(&recorded) {
            return Err(AppError::Config("postgres schema is incomplete".into()));
        }
        let _: i32 = sqlx::query_scalar("SELECT 1")
            .fetch_one(&pg.pool)
            .await
            .map_err(|e| AppError::Config(format!("postgres readiness: {e}")))?;
        for probe in REQUIRED_SCHEMA_PROBES {
            sqlx::query(probe)
                .execute(&pg.pool)
                .await
                .map_err(|_| AppError::Config("postgres current schema is unusable".into()))?;
        }
        Ok(pg)
    }

    /// Connect + apply numbered migrations. Does not crash the process on a dead DB at boot
    /// if migrate fails — first op may succeed after DB comes up.
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
        } else {
            info!(max_connections = max, "postgres pool ready + schema ok");
        }
        Ok(pg)
    }

    pub async fn migrate(&self) -> AppResult<()> {
        migrations::apply(&self.pool).await
    }
}

#[cfg(feature = "postgres")]
const REQUIRED_SCHEMA_PROBES: &[&str] = &[
    "SELECT id,email,email_lower FROM users LIMIT 0",
    "SELECT id,user_id,expires_at,absolute_expires_at,revoked FROM sessions LIMIT 0",
    "SELECT user_id,theme,scan_view,risk_account_size,ai_provider,ai_model FROM user_settings LIMIT 0",
    "SELECT user_id,kind,provider,ciphertext,last4 FROM credentials LIMIT 0",
    "SELECT ticker,session_date,iv_value,iv_basis,basis_dte FROM iv_samples LIMIT 0",
    "SELECT symbol,price,score,tier FROM scan_rows LIMIT 0",
    "SELECT id FROM scan_heartbeat LIMIT 0",
    "SELECT symbol,bundle_json FROM scan_bundles LIMIT 0",
    "SELECT symbol,as_of,score_drivers FROM scan_structure_history LIMIT 0",
    "SELECT symbol,as_of,horizon,label_version FROM structure_outcomes LIMIT 0",
    "SELECT day_et,identity,count FROM ai_rec_daily LIMIT 0",
    "SELECT user_id,schema_version,blob_json FROM user_book LIMIT 0",
    "SELECT user_id,status FROM grok_links LIMIT 0",
    "SELECT symbol,captured_at,body FROM chain_snapshots LIMIT 0",
    "SELECT symbol,et_date,body_locator FROM session_chain_archive LIMIT 0",
];
