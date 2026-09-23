//! Strict, read-only archive coverage audit.

use super::coverage::{evaluate, BookCoverageStatus, CoverageRange, LiveArchiveRead};
use super::et_date::et_date_from_as_of;
use super::market_calendar::{CoveragePolicy, MarketCalendar};
use super::store::{SessionBookMeta, SessionChainArchive};
use crate::config::Config;
use crate::error::{AppError, AppResult};
use crate::services::chain_snapshot::wire::deserialize_capture;
use chrono::{DateTime, NaiveDate, Utc};
use futures_util::future::BoxFuture;
use std::process::ExitCode;

#[derive(Clone)]
pub struct ProductionLiveArchiveReader {
    archive: SessionChainArchive,
}

/// Build the audit reader from configured production storage only.
pub async fn open_configured(config: &Config) -> AppResult<ProductionLiveArchiveReader> {
    if !config.session_chain_archive_enabled {
        return Err(AppError::Config("session archive audit is disabled".into()));
    }
    let body_root = config
        .session_chain_archive_body_root
        .as_deref()
        .ok_or_else(|| AppError::Config("session archive body root unavailable".into()))?;
    if body_root.as_os_str().is_empty() {
        return Err(AppError::Config(
            "session archive body root unavailable".into(),
        ));
    }
    #[cfg(not(feature = "postgres"))]
    if config
        .database_url
        .as_deref()
        .is_some_and(|url| !url.trim().is_empty())
    {
        return Err(AppError::Config(
            "postgres archive audit requires the postgres feature".into(),
        ));
    }
    #[cfg(feature = "postgres")]
    let bodies = super::body_store::FsBodyStore::open_read_only(body_root)?;
    #[cfg(feature = "postgres")]
    if let Some(url) = config
        .database_url
        .as_deref()
        .filter(|url| !url.trim().is_empty())
    {
        let pg = crate::db::postgres::Pg::connect(url).await?;
        return Ok(ProductionLiveArchiveReader::new(
            SessionChainArchive::open_postgres(pg, bodies),
        ));
    }
    let archive = SessionChainArchive::open_json_read_only(
        &config.session_chain_archive_store_path,
        &config.chain_snapshot_store_path,
        body_root,
    )
    .await?;
    Ok(ProductionLiveArchiveReader::new(archive))
}

impl ProductionLiveArchiveReader {
    pub fn new(archive: SessionChainArchive) -> Self {
        Self { archive }
    }
}

impl LiveArchiveRead for ProductionLiveArchiveReader {
    fn metadata<'a>(
        &'a self,
        symbol: &'a str,
        et_date: NaiveDate,
    ) -> BoxFuture<'a, Result<Option<SessionBookMeta>, super::coverage::CoverageFailure>> {
        Box::pin(async move {
            self.archive
                .metadata(symbol, &et_date.to_string())
                .await
                .map_err(|_| super::coverage::CoverageFailure {
                    range: None,
                    reason: super::coverage::CoverageFailureReason::Reader,
                })
        })
    }

    fn strict_load<'a>(
        &'a self,
        meta: &'a SessionBookMeta,
    ) -> BoxFuture<'a, Result<super::coverage::StrictBook, super::coverage::CoverageFailure>> {
        Box::pin(async move {
            let loaded = self
                .archive
                .load(&meta.symbol, &meta.et_date)
                .await
                .map_err(|_| super::coverage::CoverageFailure {
                    range: None,
                    reason: super::coverage::CoverageFailureReason::Reader,
                })?;
            let Some(loaded) = loaded else {
                return Err(super::coverage::CoverageFailure {
                    range: None,
                    reason: super::coverage::CoverageFailureReason::Reader,
                });
            };
            let wire = deserialize_capture(&loaded.body).map_err(|_| {
                super::coverage::CoverageFailure {
                    range: None,
                    reason: super::coverage::CoverageFailureReason::Reader,
                }
            })?;
            let wire_et =
                et_date_from_as_of(wire.as_of).ok_or_else(|| super::coverage::CoverageFailure {
                    range: None,
                    reason: super::coverage::CoverageFailureReason::Reader,
                })?;
            if wire.symbol != meta.symbol
                || wire_et != meta.et_date
                || wire.as_of != meta.source_as_of
            {
                return Err(super::coverage::CoverageFailure {
                    range: None,
                    reason: super::coverage::CoverageFailureReason::Reader,
                });
            }
            Ok(super::coverage::StrictBook {
                symbol: wire.symbol,
                et_date: wire_et,
                source_as_of: wire.as_of,
            })
        })
    }
}

#[derive(Clone, Debug)]
pub struct AuditRequest {
    pub from: NaiveDate,
    pub to: NaiveDate,
}

#[derive(Clone, Debug)]
pub struct AuditResult {
    pub text: String,
    pub exit: ExitCode,
}

/// CLI-facing configured audit. All malformed/configuration/reader failures use the same
/// single terminal ERROR line as an evaluated audit; no caller needs to inspect internals.
pub async fn run_configured(
    config: &Config,
    from: &str,
    to: &str,
    now_utc: DateTime<Utc>,
) -> AuditResult {
    let from = match NaiveDate::parse_from_str(from, "%Y-%m-%d") {
        Ok(v) => v,
        Err(_) => return error_result("invalid --from date; expected YYYY-MM-DD"),
    };
    let to = match NaiveDate::parse_from_str(to, "%Y-%m-%d") {
        Ok(v) => v,
        Err(_) => return error_result("invalid --to date; expected YYYY-MM-DD"),
    };
    let reader = match open_configured(config).await {
        Ok(v) => v,
        Err(_) => return error_result("configured archive storage is unavailable"),
    };
    let calendar = match MarketCalendar::production() {
        Ok(v) => v,
        Err(_) => return error_result("production calendar configuration is invalid"),
    };
    let policy = match CoveragePolicy::production() {
        Ok(v) => v,
        Err(_) => return error_result("production coverage policy configuration is invalid"),
    };
    run_audit(
        &reader,
        &calendar,
        &policy,
        AuditRequest { from, to },
        now_utc,
    )
    .await
}

pub async fn run_audit<R: LiveArchiveRead>(
    reader: &R,
    calendar: &MarketCalendar,
    policy: &CoveragePolicy,
    request: AuditRequest,
    now_utc: DateTime<Utc>,
) -> AuditResult {
    if request.from > request.to {
        return error_result("the requested date range is reversed");
    }
    if request.from < calendar.domain_start || request.to > calendar.domain_end {
        return error_result("the requested date is outside the calendar domain");
    }
    let selected = CoverageRange {
        start: request.from,
        end: request.to,
    };
    let evidence = evaluate(
        reader,
        calendar,
        policy,
        selected,
        now_utc,
        &mut super::coverage::SuccessVerificationCache::disabled(),
    )
    .await;
    let evidence = match evidence {
        Ok(e) => e,
        Err(e) => return error_result(&e.reason.to_string()),
    };
    let evaluated_at = now_utc.with_timezone(&chrono_tz::America::New_York);
    let checkpoint = policy.checkpoint_et.format("%H:%M:%S");
    let mut lines = vec![
        format!("Archive coverage — {}", evaluated_at.to_rfc3339()),
        format!(
            "Scope: SPY, QQQ, IWM · {}–{} ET · checkpoint {} ET",
            request.from, request.to, checkpoint
        ),
    ];
    if evidence.counts.expected > 0 {
        lines.extend([
            format!(
                "Readable: {} of {} expected books",
                evidence.counts.readable, evidence.counts.expected
            ),
            format!(
                "Missing: {} · Unreadable: {} · Present: {}",
                evidence.counts.missing, evidence.counts.unreadable, evidence.counts.present
            ),
        ]);
    }
    for book in &evidence.books {
        let status = match book.status {
            BookCoverageStatus::Readable => "readable".to_string(),
            BookCoverageStatus::Missing => "missing".to_string(),
            BookCoverageStatus::Unreadable => "unreadable".to_string(),
            BookCoverageStatus::NotDue => format!("not due until {} ET", checkpoint),
        };
        lines.push(format!("{} {} ET — {}", book.symbol, book.et_date, status));
    }
    for row in &evidence.last_readable {
        match (row.et_date, row.source_as_of) {
            (Some(date), Some(source)) => lines.push(format!(
                "{} — last readable {} ET · source {}",
                row.symbol,
                date,
                source.to_rfc3339_opts(chrono::SecondsFormat::Nanos, true)
            )),
            _ => lines.push(format!(
                "{} — no readable book found in the checked window",
                row.symbol
            )),
        }
    }
    if evidence.counts.expected == 0 {
        lines.push("No books were expected in this window.".into());
        return AuditResult {
            text: lines.join("\n"),
            exit: ExitCode::SUCCESS,
        };
    }
    let exit = if evidence.counts.missing == 0 && evidence.counts.unreadable == 0 {
        lines.push("PASS — every expected book is readable.".into());
        ExitCode::SUCCESS
    } else {
        lines.push(format!(
            "FAIL — {} missing and {} unreadable expected books.",
            evidence.counts.missing, evidence.counts.unreadable
        ));
        ExitCode::from(1)
    };
    AuditResult {
        text: lines.join("\n"),
        exit,
    }
}

fn error_result(reason: &str) -> AuditResult {
    AuditResult {
        text: format!(
            "ERROR — archive coverage could not be checked: {}. No completeness claim was produced.",
            bounded_reason(reason)
        ),
        exit: ExitCode::from(1),
    }
}

fn bounded_reason(reason: &str) -> String {
    reason
        .chars()
        .filter(|c| !c.is_control())
        .take(160)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> Config {
        Config {
            massive_api_key: String::new(),
            data_feed: crate::config::DataFeed::Delayed,
            rest_base: "https://api.massive.com".into(),
            redis_url: None,
            http_bind: "127.0.0.1:0".into(),
            gex_cache_ttl_secs: 10,
            gex_cache_ttl_liquid_secs: 20,
            warm_symbols: vec![],
            liquid_symbols: Default::default(),
            warm_interval_secs: 25,
            warm_concurrency: 2,
            warm_enabled: false,
            scan_enabled: false,
            scan_universe_path: "universe.json".into(),
            scan_fast_interval_secs: 30,
            scan_slow_batch_size: 4,
            scan_promotion_cap: 2,
            scan_stale_after_secs: 180,
            scan_market_hours_only: false,
            scan_store_path: "scan.sqlite3".into(),
            scan_database_url: None,
            auth_store_path: "auth.sqlite3".into(),
            auth_session_signing_key: "dev".into(),
            auth_cookie_secure: false,
            auth_cookie_samesite: "lax".into(),
            auth_session_idle_secs: 3600,
            auth_session_absolute_secs: 86400,
            auth_registration_open: true,
            auth_demo_seed: None,
            include_dark_pool: true,
            darkpool_lookback_secs: 3600,
            block_min_shares: 5000,
            iv_store_path: "iv.json".into(),
            database_url: None,
            public_rate_limit_per_min: 0,
            metrics_secret_token: None,
            chain_snapshot_max_age_secs: 1_209_600,
            chain_snapshot_max_per_symbol: 48,
            chain_snapshot_store_path: "chain-snapshots".into(),
            chain_snapshot_enabled: false,
            chain_snapshot_backend: crate::config::ChainSnapshotBackend::Disabled,
            chain_snapshot_backend_explicit: false,
            session_chain_archive_enabled: true,
            session_chain_archive_store_path: "archive".into(),
            session_chain_archive_body_root: None,
            session_day_tape_body_root: None,
            massive_flat_files_body_root: None,
            massive_files_access_key: String::new(),
            massive_files_secret: String::new(),
            liquid_session_ensure_enabled: false,
            max_live_sessions: 0,
            max_live_subscribers: 0,
            workspace_root: ".".into(),
            market_data_mode: crate::config::MarketDataMode::Live,
        }
    }

    #[tokio::test]
    async fn configured_factory_refuses_disabled_archive() {
        let mut config = test_config();
        config.session_chain_archive_enabled = false;
        assert!(open_configured(&config).await.is_err());
    }

    #[tokio::test]
    async fn configured_factory_refuses_missing_body_root_without_creation() {
        let mut config = test_config();
        let absent = std::env::temp_dir().join(format!(
            "archive-audit-factory-{}",
            Utc::now().timestamp_nanos_opt().unwrap()
        ));
        config.session_chain_archive_body_root = Some(absent.clone());
        assert!(open_configured(&config).await.is_err());
        assert!(!absent.exists());
    }

    #[tokio::test]
    async fn configured_factory_refuses_absent_configured_index_without_creation() {
        let mut config = test_config();
        let base = std::env::temp_dir().join(format!(
            "archive-audit-factory-existing-{}",
            Utc::now().timestamp_nanos_opt().unwrap()
        ));
        let bodies = base.join("bodies");
        std::fs::create_dir_all(&bodies).unwrap();
        config.session_chain_archive_body_root = Some(bodies);
        config.session_chain_archive_store_path = base.join("index");
        assert!(open_configured(&config).await.is_err());
        assert!(!config.session_chain_archive_store_path.exists());
        let _ = std::fs::remove_dir_all(base);
    }

    #[cfg(not(feature = "postgres"))]
    #[tokio::test]
    async fn configured_factory_rejects_postgres_url_without_feature() {
        let mut config = test_config();
        config.database_url = Some("postgres://configured-but-unsupported".into());
        let root = std::env::temp_dir().join(format!(
            "archive-audit-factory-pg-{}",
            Utc::now().timestamp_nanos_opt().unwrap()
        ));
        std::fs::create_dir_all(&root).unwrap();
        config.session_chain_archive_body_root = Some(root.clone());
        let error = match open_configured(&config).await {
            Ok(_) => panic!("postgres URL unexpectedly accepted without feature"),
            Err(error) => error.to_string(),
        };
        assert!(error.contains("postgres feature"));
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn configured_factory_has_no_mutating_or_arbitrary_path_seam() {
        let source = include_str!("audit.rs");
        let body = &source[source.find("pub async fn open_configured").unwrap()
            ..source.find("impl ProductionLiveArchiveReader").unwrap()];
        for forbidden in [
            "AppState::new",
            "open_json(",
            "migrate",
            "seed",
            "insert",
            "delete",
            "prune",
        ] {
            assert!(
                !body.contains(forbidden),
                "factory contains forbidden {forbidden}"
            );
        }
        assert!(body.contains("config.session_chain_archive_store_path"));
        assert!(!body.contains("PathBuf") && !body.contains("fixture"));
    }

    #[test]
    fn pg_metadata_sql_is_select_only() {
        let source = include_str!("../../db/pg_session_chain_archive.rs");
        let start = source.find("pub async fn metadata(").unwrap();
        let end = source[start..]
            .find("    pub async fn list(")
            .map(|offset| start + offset)
            .unwrap_or(source.len());
        let method = &source[start..end];
        assert!(method.contains("SELECT symbol, et_date, source_as_of, source"));
        for forbidden in ["INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP"] {
            assert!(
                !method.contains(forbidden),
                "metadata SQL contains {forbidden}"
            );
        }
    }
}
