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
