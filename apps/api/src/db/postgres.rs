//! Postgres pool + numbered schema migrations (sqlx, rustls).

use crate::db::{migrations, schema_verifier};
use crate::error::{AppError, AppResult};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

pub const POSTGRES_ACQUIRE_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(15);

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
            .acquire_timeout(POSTGRES_ACQUIRE_TIMEOUT)
            .connect(database_url)
            .await
            .map_err(|e| AppError::Config(format!("postgres connect: {e}")))?;
        let pg = Self { pool };
        let manifest = migrations::validate_manifest(migrations::compiled_manifest())
            .map_err(|_| AppError::Config("postgres migration manifest is invalid".into()))?;
        schema_verifier::verify_pool(&pg.pool, &manifest)
            .await
            .map_err(|failure| {
                AppError::Config(match failure {
                    schema_verifier::VerificationFailure::Missing => {
                        "Startup refused: required PostgreSQL migrations are missing.".into()
                    }
                    schema_verifier::VerificationFailure::Inconsistent => {
                        "Startup refused: the PostgreSQL migration history is inconsistent with this release.".into()
                    }
                    schema_verifier::VerificationFailure::Future => {
                        "Startup refused: the database records migrations newer than this release.".into()
                    }
                    schema_verifier::VerificationFailure::Incompatible => {
                        "Startup refused: the PostgreSQL schema is incomplete or incompatible with this release.".into()
                    }
                    schema_verifier::VerificationFailure::Unverifiable => {
                        "Startup refused: the PostgreSQL schema could not be verified.".into()
                    }
                })
            })?;
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
            .acquire_timeout(POSTGRES_ACQUIRE_TIMEOUT)
            .connect(database_url)
            .await
            .map_err(|e| AppError::Config(format!("postgres connect: {e}")))?;

        Ok(Self { pool })
    }
}
