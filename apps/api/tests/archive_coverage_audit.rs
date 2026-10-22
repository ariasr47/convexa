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
    let lines: Vec<_> = result.text.lines().collect();
    assert_eq!(lines[0], "Archive coverage — 2026-08-26T14:00:00-04:00");
    assert_eq!(
        lines[1],
        "Scope: SPY, QQQ, IWM · 2026-08-26–2026-08-26 ET · checkpoint 10:30:00 ET"
    );
    assert_eq!(lines[2], "Readable: 3 of 3 expected books");
    assert_eq!(lines[3], "Missing: 0 · Unreadable: 0 · Present: 3");
    assert_eq!(
        &lines[4..7],
        [
            "SPY 2026-08-26 ET — readable",
            "QQQ 2026-08-26 ET — readable",
            "IWM 2026-08-26 ET — readable"
        ]
    );
    assert_eq!(lines.len(), 11);
    assert!(lines[7].starts_with("SPY — last readable 2026-08-26 ET · source "));
    assert!(lines[8].starts_with("QQQ — last readable 2026-08-26 ET · source "));
    assert!(lines[9].starts_with("IWM — last readable 2026-08-26 ET · source "));
    assert_eq!(lines[10], "PASS — every expected book is readable.");
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
    assert!(result.text.contains("SPY 2026-08-26 ET — missing"));
    assert!(result.text.contains("QQQ 2026-08-26 ET — missing"));
    assert!(result.text.contains("IWM 2026-08-26 ET — missing"));
    assert!(result
        .text
        .contains("FAIL — 3 missing and 0 unreadable expected books."));
}

#[tokio::test]
async fn indexed_missing_or_corrupt_body_is_unreadable() {
    let archive = SessionChainArchive::memory();
    let as_of = Utc.with_ymd_and_hms(2026, 8, 26, 18, 0, 0).unwrap();
    archive
        .insert_if_absent(
            "SPY",
            "2026-08-26",
            as_of,
            MarketDataSourceKind::Fixture,
            b"corrupt",
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
    assert!(result.text.contains("SPY 2026-08-26 ET — unreadable"));
    assert!(result
        .text
        .contains("Missing: 2 · Unreadable: 1 · Present: 1"));
    assert!(result
        .text
        .contains("FAIL — 2 missing and 1 unreadable expected books."));
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
    assert!(result.text.contains("SPY 2026-08-26 ET — unreadable"));
    assert!(result
        .text
        .contains("Missing: 2 · Unreadable: 1 · Present: 1"));
    assert!(result
        .text
        .contains("FAIL — 2 missing and 1 unreadable expected books."));
}

#[tokio::test]
async fn invalid_range_is_bounded_error_without_counts_claim() {
    let (calendar, policy, now) = setup();
    for request in [
        AuditRequest {
            from: now.date_naive(),
            to: NaiveDate::from_ymd_opt(2026, 8, 25).unwrap(),
        },
        AuditRequest {
            from: NaiveDate::from_ymd_opt(2025, 12, 31).unwrap(),
            to: now.date_naive(),
        },
    ] {
        let result = run_audit(
            &ProductionLiveArchiveReader::new(SessionChainArchive::memory()),
            &calendar,
            &policy,
            request,
            now,
        )
        .await;
        assert_ne!(result.exit, std::process::ExitCode::SUCCESS);
        assert!(result
            .text
            .starts_with("ERROR — archive coverage could not be checked:"));
        assert!(!result.text.contains("Readable:") && !result.text.contains("Missing:"));
    }
}

#[tokio::test]
async fn closed_or_preactivation_range_is_zero_expected() {
    let (calendar, policy, now) = setup();
    for (from, to) in [
        ("2026-08-22", "2026-08-23"),
        ("2026-07-03", "2026-07-03"),
        ("2026-01-02", "2026-01-02"),
    ] {
        let result = run_audit(
            &ProductionLiveArchiveReader::new(SessionChainArchive::memory()),
            &calendar,
            &policy,
            AuditRequest {
                from: NaiveDate::parse_from_str(from, "%Y-%m-%d").unwrap(),
                to: NaiveDate::parse_from_str(to, "%Y-%m-%d").unwrap(),
            },
            now,
        )
        .await;
        assert_eq!(result.exit, std::process::ExitCode::SUCCESS);
        assert!(result
            .text
            .ends_with("No books were expected in this window."));
        assert!(!result.text.contains("PASS") && !result.text.contains("Readable:"));
    }
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
    assert_eq!(result.text.matches("not due until 10:30:00 ET").count(), 3);
    assert!(!result.text.contains("Readable:") && !result.text.contains("Missing:"));
    assert!(result
        .text
        .ends_with("No books were expected in this window."));
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
    let base = std::env::temp_dir().join(format!(
        "archive_audit_{}_{}",
        std::process::id(),
        Utc::now().timestamp_nanos_opt().unwrap()
    ));
    let index = base.join("index");
    let ring = base.join("ring");
    let bodies = base.join("bodies");
    let seeded = SessionChainArchive::open_json(&index, &ring, &bodies)
        .await
        .unwrap();
    add_book(&seeded, "SPY", "2026-08-26").await;
    let before = tree_snapshot(&base);
    let archive = SessionChainArchive::open_json_read_only(&index, &ring, &bodies)
        .await
        .unwrap();
    let (calendar, policy, now) = setup();
    let _ = run_audit(
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
    assert_eq!(tree_snapshot(&base), before);
    let source = include_str!("../src/db/pg_session_chain_archive.rs");
    assert!(source.contains("SELECT symbol, et_date, source_as_of, source"));
    let _ = std::fs::remove_dir_all(base);

    // The Postgres arm migrates a disposable database of its own and builds its config without
    // reading the process environment, so it needs only TEST_DATABASE_URL (an admin connection).
    #[cfg(feature = "postgres")]
    {
        let admin_url = std::env::var("TEST_DATABASE_URL")
            .expect("TEST_DATABASE_URL is required: real PostgreSQL fixture is mandatory");
        let admin = sqlx::postgres::PgPoolOptions::new()
            .max_connections(2)
            .connect(&admin_url)
            .await
            .expect("connect TEST_DATABASE_URL admin");
        let db_name = format!(
            "archive_audit_{}_{}",
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap()
        );
        sqlx::query(&format!(r#"CREATE DATABASE "{db_name}""#))
            .execute(&admin)
            .await
            .expect("create disposable database");
        let mut parsed = url::Url::parse(&admin_url).expect("TEST_DATABASE_URL must be a URL");
        parsed.set_path(&format!("/{db_name}"));
        parsed.set_query(None);
        let database_url = parsed.to_string();
        let migrated = std::process::Command::new(env!("CARGO_BIN_EXE_api-rust"))
            .arg("postgres-migrate")
            .env("DATABASE_URL", &database_url)
            .output()
            .expect("run postgres-migrate");
        assert!(
            migrated.status.success(),
            "postgres-migrate failed: {}",
            String::from_utf8_lossy(&migrated.stdout)
        );
        let pg = api_rust::db::postgres::Pg::connect(&database_url)
            .await
            .expect("connect disposable database");

        // One readable book, so the row and file comparisons below have something to lose.
        let pg_base = std::env::temp_dir().join(&db_name);
        let pg_bodies = pg_base.join("bodies");
        let as_of = DateTime::parse_from_rfc3339("2026-08-26T18:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let as_of_ns = as_of.timestamp_nanos_opt().unwrap();
        let locator = format!("SPY/2026-08-26/{as_of_ns}-0000000000000000.bin");
        let body_path = pg_bodies.join(&locator);
        std::fs::create_dir_all(body_path.parent().unwrap()).unwrap();
        let wire = to_wire(&fixture_probe_bundle("SPY", as_of));
        std::fs::write(&body_path, serialize_capture(&wire).unwrap()).unwrap();
        sqlx::query(
            "INSERT INTO session_chain_archive (symbol, et_date, source_as_of, source_as_of_ns, source, body_locator) VALUES ('SPY', '2026-08-26', $1, $2, 'fixture', $3)",
        )
        .bind(as_of.to_rfc3339_opts(chrono::SecondsFormat::Nanos, true))
        .bind(as_of_ns)
        .bind(&locator)
        .execute(&pg.pool)
        .await
        .expect("seed one archive row");

        let before_rows = sqlx::query_as::<_, (String, String, String, String, Option<String>)>(
            "SELECT symbol, et_date, source_as_of, source, body_locator FROM session_chain_archive ORDER BY symbol, et_date",
        )
        .fetch_all(&pg.pool)
        .await
        .expect("snapshot archive rows before audit");
        assert_eq!(before_rows.len(), 1);
        let before_files = tree_snapshot(&pg_base);
        let mut config = api_rust::state::test_stub_config();
        config.database_url = Some(database_url);
        config.session_chain_archive_enabled = true;
        config.session_chain_archive_body_root = Some(pg_bodies.clone());
        let reader = api_rust::services::session_chain_archive::audit::open_configured(&config)
            .await
            .expect("open configured postgres archive read-only");
        let (calendar, policy, now) = setup();
        let _ = run_audit(
            &reader,
            &calendar,
            &policy,
            AuditRequest {
                from: now.date_naive(),
                to: now.date_naive(),
            },
            now,
        )
        .await;
        let after_rows = sqlx::query_as::<_, (String, String, String, String, Option<String>)>(
            "SELECT symbol, et_date, source_as_of, source, body_locator FROM session_chain_archive ORDER BY symbol, et_date",
        )
        .fetch_all(&pg.pool)
        .await
        .expect("snapshot archive rows after audit");
        assert_eq!(after_rows, before_rows);
        assert_eq!(tree_snapshot(&pg_base), before_files);
        drop(reader);
        pg.pool.close().await;
        let _ = sqlx::query(&format!(
            r#"DROP DATABASE IF EXISTS "{db_name}" WITH (FORCE)"#
        ))
        .execute(&admin)
        .await;
        let _ = std::fs::remove_dir_all(pg_base);
    }
}

fn tree_snapshot(root: &std::path::Path) -> Vec<(String, Vec<u8>, u128)> {
    fn walk(root: &std::path::Path, dir: &std::path::Path, out: &mut Vec<(String, Vec<u8>, u128)>) {
        for entry in std::fs::read_dir(dir).unwrap() {
            let path = entry.unwrap().path();
            let rel = path
                .strip_prefix(root)
                .unwrap()
                .to_string_lossy()
                .replace('\\', "/");
            let meta = std::fs::symlink_metadata(&path).unwrap();
            let stamp = meta
                .modified()
                .unwrap()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let bytes = if meta.is_file() {
                std::fs::read(&path).unwrap()
            } else {
                Vec::new()
            };
            out.push((rel, bytes, stamp));
            if meta.is_dir() {
                walk(root, &path, out);
            }
        }
    }
    let mut out = Vec::new();
    walk(root, root, &mut out);
    out.sort_by(|a, b| a.0.cmp(&b.0));
    out
}
