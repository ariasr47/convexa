#[cfg(feature = "postgres")]
use crate::db::postgres::Pg;
#[cfg(feature = "postgres")]
use std::time::Duration;

#[cfg(feature = "postgres")]
pub const PRODUCTION_SCHEMA_PREFLIGHT_TIMEOUT: Duration = Duration::from_secs(20);

#[cfg(feature = "postgres")]
pub struct SchemaPreflight {
    pub pg: Pg,
    pub startup_id: String,
}

#[cfg(feature = "postgres")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PreflightFailure {
    TimedOut,
    UnreachableOrUnusable,
}

#[cfg(feature = "postgres")]
impl std::fmt::Display for PreflightFailure {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("Postgres must be reachable and usable before startup.")
    }
}

#[cfg(feature = "postgres")]
impl SchemaPreflight {
    pub async fn run(database_url: &str, timeout: Duration) -> Result<Self, PreflightFailure> {
        use rand::RngCore;
        let mut bytes = [0_u8; 16];
        rand::thread_rng().fill_bytes(&mut bytes);
        let startup_id = hex::encode(bytes);
        emit_startup_event("schema_preflight_started", &startup_id);
        let pg = tokio::time::timeout(timeout, Pg::connect_strict(database_url))
            .await
            .map_err(|_| PreflightFailure::TimedOut)?
            .map_err(|_| PreflightFailure::UnreachableOrUnusable)?;
        emit_startup_event("schema_preflight_finished", &startup_id);
        Ok(Self { pg, startup_id })
    }
}

#[cfg(feature = "postgres")]
pub fn emit_startup_event(event: &'static str, startup_id: &str) {
    tracing::info!(
        event,
        startup_id,
        release_git_sha = %std::env::var("RELEASE_GIT_SHA").unwrap_or_else(|_| "unknown".into()),
        railway_deployment_id = %std::env::var("RAILWAY_DEPLOYMENT_ID").unwrap_or_else(|_| "unknown".into()),
        utc = %chrono::Utc::now().to_rfc3339(),
        "production startup phase"
    );
}
