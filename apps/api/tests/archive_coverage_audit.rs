use api_rust::services::chain_snapshot::wire::{fixture_probe_bundle, serialize_capture, to_wire};
use api_rust::services::market_data::MarketDataSourceKind;
use api_rust::services::session_chain_archive::audit::{
    run_audit, AuditRequest, ProductionLiveArchiveReader,
};
use api_rust::services::session_chain_archive::{
    CoveragePolicy, MarketCalendar, SessionChainArchive,
};
use chrono::{DateTime, NaiveDate, TimeZone, Utc};

fn setup() -> (MarketCalendar, CoveragePolicy, DateTime<Utc>) {
    (
        MarketCalendar::production().unwrap(),
        CoveragePolicy::production().unwrap(),
        Utc.with_ymd_and_hms(2026, 8, 26, 18, 0, 0).unwrap(),
    )
}

async fn add_book(archive: &SessionChainArchive, symbol: &str, date: &str) {
    let as_of = DateTime::parse_from_rfc3339(&format!("{date}T18:00:00Z"))
        .unwrap()
        .with_timezone(&Utc);
    let wire = to_wire(&fixture_probe_bundle(symbol, as_of));
    archive
        .insert_if_absent(
            symbol,
            date,
            as_of,
            MarketDataSourceKind::Fixture,
            &serialize_capture(&wire).unwrap(),
        )
        .await
        .unwrap();
}

#[tokio::test]
async fn complete_due_range_has_ordered_scope_counts_matrix_last_readable_and_pass() {
    let archive = SessionChainArchive::memory();
    for symbol in ["SPY", "QQQ", "IWM"] {
        add_book(&archive, symbol, "2026-08-26").await;
    }
    let (calendar, policy, now) = setup();
    let result = run_audit(
        &ProductionLiveArchiveReader::new(archive),
        &calendar,
        &policy,
        AuditRequest {
            from: NaiveDate::from_ymd_opt(2026, 8, 26).unwrap(),
            to: NaiveDate::from_ymd_opt(2026, 8, 26).unwrap(),
        },
        now,
    )
    .await;
    assert_eq!(result.exit, std::process::ExitCode::SUCCESS);
    assert!(result.text.contains("Readable: 3 of 3 expected books"));
    assert!(result.text.contains("SPY — last readable 2026-08-26 ET"));
    assert!(result
        .text
        .ends_with("PASS — every expected book is readable."));
}

#[tokio::test]
async fn absent_index_is_missing_and_fails() {
    let (calendar, policy, now) = setup();
    let result = run_audit(
        &ProductionLiveArchiveReader::new(SessionChainArchive::memory()),
        &calendar,
        &policy,
        AuditRequest {
            from: now.date_naive(),
            to: now.date_naive(),
        },
        now,
    )
    .await;
    assert_ne!(result.exit, std::process::ExitCode::SUCCESS);
    assert!(result.text.contains("missing") && result.text.contains("FAIL"));
}

#[tokio::test]
async fn indexed_missing_or_corrupt_body_is_unreadable() {
    let archive = SessionChainArchive::memory();
    add_book(&archive, "SPY", "2026-08-26").await;
    let (calendar, policy, now) = setup();
    let result = run_audit(
        &ProductionLiveArchiveReader::new(archive),
        &calendar,
        &policy,
        AuditRequest {
            from: now.date_naive(),
            to: now.date_naive(),
        },
        now,
    )
    .await;
    assert_ne!(result.exit, std::process::ExitCode::SUCCESS);
    assert!(result.text.contains("unreadable"));
    assert!(!result.text.contains("PASS"));
}

#[tokio::test]
async fn decoded_identity_mismatch_is_unreadable() {
    let archive = SessionChainArchive::memory();
    let as_of = Utc.with_ymd_and_hms(2026, 8, 26, 18, 0, 0).unwrap();
    let wire = to_wire(&fixture_probe_bundle("QQQ", as_of));
    archive
        .insert_if_absent(
            "SPY",
            "2026-08-26",
            as_of,
            wire.source,
            &serialize_capture(&wire).unwrap(),
        )
        .await
        .unwrap();
    let (calendar, policy, now) = setup();
    let result = run_audit(
        &ProductionLiveArchiveReader::new(archive),
        &calendar,
        &policy,
        AuditRequest {
            from: now.date_naive(),
            to: now.date_naive(),
        },
        now,
    )
    .await;
    assert_ne!(result.exit, std::process::ExitCode::SUCCESS);
    assert!(result.text.contains("unreadable"));
}

#[tokio::test]
async fn invalid_range_is_bounded_error_without_counts_claim() {
    let (calendar, policy, now) = setup();
    let result = run_audit(
        &ProductionLiveArchiveReader::new(SessionChainArchive::memory()),
        &calendar,
        &policy,
        AuditRequest {
            from: now.date_naive(),
            to: NaiveDate::from_ymd_opt(2026, 8, 25).unwrap(),
        },
        now,
    )
    .await;
    assert_ne!(result.exit, std::process::ExitCode::SUCCESS);
    assert!(result
        .text
        .starts_with("ERROR — archive coverage could not be checked:"));
    assert!(!result.text.contains("Readable:"));
}

#[tokio::test]
async fn closed_or_preactivation_range_is_zero_expected() {
    let (calendar, policy, now) = setup();
    let result = run_audit(
        &ProductionLiveArchiveReader::new(SessionChainArchive::memory()),
        &calendar,
        &policy,
        AuditRequest {
            from: NaiveDate::from_ymd_opt(2026, 8, 22).unwrap(),
            to: NaiveDate::from_ymd_opt(2026, 8, 23).unwrap(),
        },
        now,
    )
    .await;
    assert_eq!(result.exit, std::process::ExitCode::SUCCESS);
    assert!(result
        .text
        .ends_with("No books were expected in this window."));
    assert!(!result.text.contains("PASS"));
}

#[tokio::test]
async fn precheckpoint_current_date_is_not_due_without_warning() {
    let archive = SessionChainArchive::memory();
    let (calendar, policy, _) = setup();
    let now = chrono_tz::America::New_York
        .with_ymd_and_hms(2026, 8, 26, 10, 0, 0)
        .unwrap()
        .with_timezone(&Utc);
    let result = run_audit(
        &ProductionLiveArchiveReader::new(archive),
        &calendar,
        &policy,
        AuditRequest {
            from: now.date_naive(),
            to: now.date_naive(),
        },
        now,
    )
    .await;
    assert_eq!(result.exit, std::process::ExitCode::SUCCESS);
    assert!(result.text.contains("not due until 10:30:00 ET"));
    assert!(!result.text.contains("Session archive incomplete"));
}

#[tokio::test]
async fn absent_json_roots_are_refused_without_creation() {
    let base = std::env::temp_dir().join(format!("archive_audit_absent_{}", std::process::id()));
    let index = base.join("index");
    let bodies = base.join("bodies");
    let result =
        SessionChainArchive::open_json_read_only(&index, &base.join("ring"), &bodies).await;
    assert!(result.is_err());
    assert!(!index.exists());
    assert!(!bodies.exists());
}

#[tokio::test]
async fn audit_leaves_files_metadata_tree_and_database_rows_identical() {
    let archive = SessionChainArchive::memory();
    add_book(&archive, "SPY", "2026-08-26").await;
    let before = archive.list("SPY", None).await.unwrap();
    let (calendar, policy, now) = setup();
    let _ = run_audit(
        &ProductionLiveArchiveReader::new(archive.clone()),
        &calendar,
        &policy,
        AuditRequest {
            from: now.date_naive(),
            to: now.date_naive(),
        },
        now,
    )
    .await;
    assert_eq!(archive.list("SPY", None).await.unwrap().len(), before.len());
    assert_eq!(
        archive.list("SPY", None).await.unwrap()[0].source,
        before[0].source
    );
}
