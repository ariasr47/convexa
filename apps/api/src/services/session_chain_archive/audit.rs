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
