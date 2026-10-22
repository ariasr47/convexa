//! Durable storage backends.
//!
//! - **JSON-on-disk** (default): single-process local/dev — no external DB.
//! - **Postgres** (`--features postgres` + `DATABASE_URL`): multi-instance / Railway.
//!
//! Schema mirrors Python `auth/postgres_store.py` + `marketdata` + `scanstore` so a
//! shared Postgres plugin can serve both stacks during cutover if needed.

use std::path::{Path, PathBuf};

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

/// JSON-on-disk store file for a configured (possibly SQLite-named) store path.
/// Shared by the auth and scanner JSON stores.
pub(crate) fn normalize_json_path(path: &Path) -> PathBuf {
    let s = path.to_string_lossy();
    if s.ends_with(".sqlite3") || s.ends_with(".sqlite") || s.ends_with(".db") {
        PathBuf::from(
            s.replace(".sqlite3", ".json")
                .replace(".sqlite", ".json")
                .replace(".db", ".json"),
        )
    } else if s.ends_with(".json") {
        path.to_path_buf()
    } else {
        path.with_extension("json")
    }
}
