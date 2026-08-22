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
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PreflightFailure {
    TimedOut,
    UnreachableOrUnusable,
    Schema(String),
}

#[cfg(feature = "postgres")]
impl std::fmt::Display for PreflightFailure {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::TimedOut => {
                formatter.write_str("Startup refused: the PostgreSQL schema could not be verified.")
            }
            Self::UnreachableOrUnusable => {
                formatter.write_str("Startup refused: the PostgreSQL schema could not be verified.")
            }
            Self::Schema(message) => formatter.write_str(message),
        }
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
            .map_err(|error| PreflightFailure::Schema(error.to_string()))?;
        emit_startup_event("schema_preflight_finished", &startup_id);
        Ok(Self { pg, startup_id })
    }
}

#[cfg(feature = "postgres")]
pub fn emit_startup_event(event: &'static str, startup_id: &str) {
    tracing::info!(
        event,
        startup_id,
        release_git_sha = %effective_release_git_sha(
            std::env::var("RAILWAY_GIT_COMMIT_SHA").ok().as_deref(),
            std::env::var("RELEASE_GIT_SHA").ok().as_deref(),
        ),
        railway_deployment_id = %std::env::var("RAILWAY_DEPLOYMENT_ID").unwrap_or_else(|_| "unknown".into()),
        utc = %chrono::Utc::now().to_rfc3339(),
        "production startup phase"
    );
}

/// Select the immutable provider commit when Railway supplies it, while
/// retaining the explicit release override used by local and non-Railway
/// environments. Empty values are treated as absent so they cannot hide a
/// valid fallback (or produce a blank startup diagnostic).
pub fn effective_release_git_sha<'a>(
    railway_git_commit_sha: Option<&'a str>,
    release_git_sha: Option<&'a str>,
) -> &'a str {
    railway_git_commit_sha
        .filter(|value| !value.trim().is_empty())
        .or_else(|| release_git_sha.filter(|value| !value.trim().is_empty()))
        .unwrap_or("unknown")
}

#[cfg(all(test, feature = "postgres"))]
mod tests {
    use super::effective_release_git_sha;

    #[test]
    fn railway_commit_is_preferred_over_release_override() {
        assert_eq!(
            effective_release_git_sha(Some("railway-commit"), Some("stale-release")),
            "railway-commit"
        );
    }

    #[test]
    fn release_override_is_fallback_when_railway_commit_is_unavailable() {
        assert_eq!(
            effective_release_git_sha(None, Some("local-release")),
            "local-release"
        );
    }

    #[test]
    fn empty_values_are_ignored_and_unknown_is_used_when_both_are_empty() {
        assert_eq!(
            effective_release_git_sha(Some("  "), Some("release")),
            "release"
        );
        assert_eq!(
            effective_release_git_sha(Some("commit"), Some("  ")),
            "commit"
        );
        assert_eq!(effective_release_git_sha(Some("\t"), Some("")), "unknown");
    }
}
