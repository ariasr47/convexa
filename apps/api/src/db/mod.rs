//! Durable storage backends.
//!
//! - **JSON-on-disk** (default): single-process local/dev — no external DB.
//! - **Postgres** (`--features postgres` + `DATABASE_URL`): multi-instance / Railway.
//!
//! Schema mirrors Python `auth/postgres_store.py` + `marketdata` + `scanstore` so a
//! shared Postgres plugin can serve both stacks during cutover if needed.

#[cfg(feature = "postgres")]
mod migration_runner;
#[cfg(feature = "postgres")]
pub mod migrations;
#[cfg(feature = "postgres")]
pub mod schema_verifier;

#[cfg(feature = "postgres")]
pub async fn postgres_migrate_cli() -> std::process::ExitCode {
    migration_runner::run_stdout().await
}
#[cfg(feature = "postgres")]
pub mod pg_auth;
#[cfg(feature = "postgres")]
pub mod pg_chain_snapshot;
#[cfg(feature = "postgres")]
pub mod pg_iv;
#[cfg(feature = "postgres")]
pub mod pg_scan;
#[cfg(feature = "postgres")]
pub mod pg_session_chain_archive;
#[cfg(feature = "postgres")]
pub mod pg_session_day_tape;
#[cfg(feature = "postgres")]
pub mod postgres;

/// True when this build includes the Postgres client and `DATABASE_URL` is set.
pub fn postgres_configured() -> bool {
    #[cfg(feature = "postgres")]
    {
        std::env::var("DATABASE_URL")
            .ok()
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false)
    }
    #[cfg(not(feature = "postgres"))]
    {
        false
    }
}

/// Human label for logs/health.
pub fn backend_label() -> &'static str {
    if postgres_configured() {
        "postgres"
    } else {
        "json"
    }
}
